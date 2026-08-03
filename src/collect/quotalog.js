/**
 * Sổ hạn mức theo chu kỳ — lịch sử của thứ không có lịch sử.
 *
 * `collect/quota.js` trả về TRẠNG THÁI HIỆN TẠI: khung 5 giờ đang ở 42%, reset sau 4 giờ.
 * Câu đó trả lời được "tôi sắp bị chặn chưa", và đó là câu gấp nhất. Nhưng nó không trả lời
 * được câu đắt nhất:
 *
 *   **Mỗi chu kỳ tôi bỏ phí bao nhiêu, và có thành nếp không?**
 *
 * Hạn mức không cộng dồn. Phần chưa dùng lúc reset không phải của để dành — nó bốc hơi.
 * Thanh "bỏ phí 78%" trên thẻ hạn mức nói đúng cho chu kỳ ĐANG chạy, nhưng nếu tuần nào
 * cũng bỏ phí bấy nhiêu thì đó không còn là một con số, nó là một cách làm việc. Không có
 * sổ thì không ai biết mình đang ở trường hợp nào.
 *
 * ## Vì sao phải là một cái sổ, không phải một phép tính
 *
 * Endpoint không có tham số nào hỏi lại chu kỳ đã qua — chỉ có `utilization` của lúc này.
 * Nên chu kỳ 5 giờ nào không được ghi TRONG LÚC nó đang chạy thì mất vĩnh viễn, khác hẳn
 * token (còn nằm trong transcript ba mươi ngày, dựng lại được bất cứ lúc nào). Vì vậy sổ
 * này ghi từ lượt quét đầu tiên, kể cả trước khi có chart nào đọc nó.
 *
 * ## Đỉnh ghi được là CẬN DƯỚI, và đó là giới hạn thật của phép đo
 *
 * Dashboard chỉ lấy số khi nó đang chạy **và** có tab đang mở (xem chốt `watched` trong
 * `collectQuota`). Đóng máy lúc đang tiêu mạnh thì đỉnh của chu kỳ đó bị ghi hụt — nên
 * "đã tiêu" là cận DƯỚI và "bỏ phí" là cận TRÊN. Không có cách nào vá: số đã không tồn tại.
 *
 * Cái làm được là **nói ra độ phủ của từng chu kỳ**, và đó là việc của `watchedTo`: lượt
 * lấy số cuối cùng cách mốc reset bao xa, quy về tỉ lệ cửa sổ. Theo tới 0,95 nghĩa là đỉnh
 * gần như chắc; dừng ở 0,4 nghĩa là hơn nửa cuối chu kỳ không ai nhìn, và con số ấy không
 * được đứng cạnh mấy con số kia như thể cùng độ tin. `partial` đánh dấu đúng chỗ đó.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { QUOTA_CYCLES_KEEP, QUOTA_LOG } from '../config.js';

/**
 * Theo tới ngần này phần cửa sổ thì coi như đỉnh đã chắc.
 *
 * 0,9 chứ không phải 1: nhịp lấy số là 2 phút, nên lượt cuối của một cửa sổ 5 giờ luôn
 * cách mốc reset tới 2 phút (~0,7%), và đòi đúng 1 là đánh dấu MỌI chu kỳ là thiếu. Chừa
 * 10% cũng ôm được cả trường hợp đóng laptop mười lăm phút trước reset — quãng đó gần như
 * chắc chắn không tiêu thêm gì, vì đang không ngồi máy.
 */
const WATCHED_ENOUGH = 0.9;

/**
 * Độ hạt của khoá chu kỳ. Đây là chỗ **bắt buộc**, không phải một sự cẩn thận thêm.
 *
 * Endpoint trả mốc reset ở dạng ISO có micro-giây, và phần lẻ ấy được sinh lại ở MỖI lượt
 * gọi. Đo trên máy này, hai lượt cách nhau hai phút:
 *
 * ```
 * five_hour.resets_at = 2026-07-26T16:30:00.556746+00:00
 * five_hour.resets_at = 2026-07-26T16:30:00.399430+00:00   ← cùng chu kỳ, lệch 157ms
 * ```
 *
 * Giờ tường (16:30:00) là mốc thật và nó ổn định; phần lẻ là rác. Khoá bằng mili-giây thô
 * thì mỗi hai phút sinh ra một "chu kỳ" mới — sổ phồng lên, `samples` luôn bằng 1, và chart
 * vẽ ra hàng trăm cột mỗi cột là một lượt đọc. Bản đầu đúng như vậy, và nó lộ ra sau đúng
 * hai lượt quét.
 *
 * Cùng lý do, hạn mức tuần theo model trả `17:59:59.557015` trong khi khung tuần chung trả
 * `18:00:00.556767` — lệch một giây cho cùng một mốc.
 *
 * Một phút: đủ thô để nuốt cả hai kiểu giật trên, đủ mịn để không bao giờ gộp hai chu kỳ
 * thật (gần nhau nhất là hai chu kỳ 5 giờ, cách nhau 5 giờ).
 */
const CYCLE_GRAIN_MS = 60_000;

/** Mốc reset đã bỏ phần giật. Dùng cho CẢ khoá sổ lẫn chỗ hiện ra, để hai bên không lệch. */
export const cycleAt = (ms) => Math.round(ms / CYCLE_GRAIN_MS) * CYCLE_GRAIN_MS;

/**
 * Phiên bản sổ. Đổi số này là bỏ toàn bộ sổ cũ khi đọc — dùng khi cách KHOÁ đổi, vì lúc đó
 * hàng cũ không gộp được với hàng mới mà cứ nằm đó như dữ liệu thật.
 *
 * v1 → v2: khoá chuyển sang mốc reset đã làm tròn phút (xem `CYCLE_GRAIN_MS`).
 */
const LOG_VERSION = 2;

/** Ba loại cửa sổ, đặt tên ngắn để làm khoá sổ. `m:` giữ nguyên tên model do endpoint trả. */
export function windowsIn(q) {
  const out = [];
  if (q?.fiveHour) out.push({ kind: 'five', w: q.fiveHour });
  if (q?.sevenDay) out.push({ kind: 'seven', w: q.sevenDay });
  for (const w of q?.scoped ?? []) out.push({ kind: `m:${w.model ?? '?'}`, w });
  return out;
}

/**
 * Lõi nhập sổ — dùng chung cho cả ba bề mặt (Claude ở ngay dưới, Antigravity và Cursor ở
 * `collect/cycletrack.js`). Mỗi cửa sổ là `{ kind, resetsAt, windowMs, used, extra? }`.
 *
 * Chu kỳ được khoá bằng **mốc reset** của chính nó, không bằng thời điểm đọc: đó là mã duy
 * nhất ổn định qua nhiều lượt đọc của cùng một chu kỳ, và nó cũng có sẵn cả ở nhánh ảnh
 * chụp cũ. Khoá theo ngày thì một chu kỳ 5 giờ vắt qua nửa đêm bị tách thành hai.
 *
 * Đỉnh lấy **MAX**, đúng lý do của `mergeRollup`: trong một chu kỳ, phần đã tiêu chỉ có
 * tăng, nên max vừa đúng vừa chịu được việc một lượt đọc lẻ trả về số thấp hơn.
 *
 * `extra` là ngữ cảnh gắn theo chu kỳ (Cursor gửi kèm cents của gói). Bản ghi được dựng
 * lại từ đầu ở mỗi lượt nhập, nên phải chép `prev` vào trước rồi mới đè phần mới — không
 * thì các trường ngoài lõi lặng lẽ rụng khỏi sổ ngay lượt nhập đầu sau khi tiến trình
 * khởi động lại (sổ là thứ đọc lên từ đĩa, đâu chỉ sống trong bộ nhớ).
 *
 * Trả về CHÍNH map cũ khi không có gì mới — chỗ gọi dùng phép so tham chiếu ấy để biết có
 * cần ghi đĩa hay không. Nhịp dựng lại trạng thái là 30 giây còn nhịp lấy hạn mức là 2
 * phút, nên bốn phần năm số lượt gọi vào đây không mang theo gì mới.
 */
export function bumpWindows(cycles, at, windows) {
  if (typeof at !== 'number') return cycles;
  let out = null;

  for (const { kind, resetsAt: raw, windowMs, used, extra } of windows) {
    // Không có mốc reset thì không có chu kỳ để khoá. Bỏ, chứ không bịa một khoá theo
    // thời gian đọc — làm thế thì mỗi lượt đọc thành một "chu kỳ" riêng.
    if (raw == null || !Number.isFinite(used)) continue;
    const resetsAt = cycleAt(raw);
    const key = `${kind}|${resetsAt}`;
    const prev = (out ?? cycles).get(key);
    // Cùng một ảnh chụp đã ghi rồi. Đây là chỗ `samples` giữ được nghĩa "bao nhiêu lượt
    // đọc KHÁC NHAU", chứ không thành "bao nhiêu lượt quét".
    if (prev && at <= prev.lastAt) continue;
    if (!out) out = new Map(cycles);
    out.set(key, {
      ...prev,
      kind,
      resetsAt,
      windowMs: windowMs ?? prev?.windowMs ?? null,
      peak: Math.max(prev?.peak ?? 0, used),
      samples: (prev?.samples ?? 0) + 1,
      firstAt: prev?.firstAt ?? at,
      lastAt: at,
      ...(extra ?? {}),
    });
  }
  return out ?? cycles;
}

/** Nhập một lượt đọc hạn mức Claude vào sổ — khuôn cửa sổ lấy từ `windowsIn`. */
export function bumpCycles(cycles, q, now = Date.now()) {
  if (!q?.ok || typeof q.at !== 'number') return cycles;
  return bumpWindows(
    cycles,
    q.at,
    windowsIn(q).map(({ kind, w }) => ({ kind, resetsAt: w.resetsAt, windowMs: w.windowMs, used: w.used })),
  );
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Chu kỳ ĐÃ CHỐT, kèm phần bỏ phí và độ phủ.
 *
 * Chỉ chu kỳ đã qua mốc reset: chu kỳ đang chạy thì đỉnh của nó chưa phải đỉnh, và nó đã
 * có cả một cái thẻ riêng ở đầu màn nói về mình. Đưa nó vào đây là để một cột chưa xong
 * đứng cạnh những cột đã xong.
 */
export function cyclesOf(cycles, now = Date.now()) {
  const rows = [];
  for (const c of cycles.values()) {
    if (c.resetsAt > now) continue;
    // Độ phủ suy từ MỐC THỜI GIAN, không lấy `elapsedFrac` của lượt đọc: `elapsedFrac`
    // tính theo `now`, nên một chu kỳ chỉ được nhìn mười phút đầu vẫn ra 1 sau khi nó đã
    // trôi qua — tức là tự nhận đã theo trọn, đúng ngược sự thật.
    const watchedTo = c.windowMs ? clamp01((c.windowMs - (c.resetsAt - c.lastAt)) / c.windowMs) : null;
    rows.push({
      kind: c.kind,
      resetsAt: c.resetsAt,
      used: c.peak,
      waste: 100 - c.peak,
      samples: c.samples,
      watchedTo,
      partial: watchedTo == null || watchedTo < WATCHED_ENOUGH,
    });
  }
  rows.sort((a, b) => a.resetsAt - b.resetsAt);

  const kinds = [...new Set(rows.map((r) => r.kind))];
  return {
    watchedEnough: WATCHED_ENOUGH,
    kinds,
    cycles: rows,
    // Đếm riêng phần ĐỦ TIN, vì mọi kết luận về nếp làm việc chỉ được dựng trên phần đó.
    solid: rows.filter((r) => !r.partial).length,
  };
}

export async function readCycles(file = QUOTA_LOG) {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    // Sổ đời trước bị BỎ, không cố gộp: cách khoá đã đổi nên hàng cũ và hàng mới nói về
    // cùng một chu kỳ dưới hai cái tên, và gộp sai còn tệ hơn mất — sổ này là thứ người ta
    // sẽ đọc để kết luận về nếp làm việc.
    if (data?.version !== LOG_VERSION) return new Map();
    const out = new Map();
    for (const [key, c] of Object.entries(data.cycles ?? {})) {
      if (typeof c?.peak === 'number' && typeof c?.resetsAt === 'number') out.set(key, c);
    }
    return out;
  } catch {
    return new Map(); // chưa có sổ, hoặc sổ hỏng — bắt đầu lại, không có gì dựng lại được
  }
}

/**
 * Cắt bớt khi ghi, riêng từng loại cửa sổ.
 *
 * Cắt chung một hạn mức thì khung 5 giờ (chốt ~4 lần/ngày) đẩy khung 7 ngày (chốt 1
 * lần/tuần) ra khỏi sổ chỉ sau vài tuần — mất đúng cái chu kỳ dài mà không có cách nào
 * dựng lại. Chu kỳ ĐANG CHẠY không bao giờ bị cắt: nó chưa chốt và đang được ghi thêm.
 */
export function trimCycles(cycles, keep = QUOTA_CYCLES_KEEP, now = Date.now()) {
  const byKind = new Map();
  const live = [];
  for (const [key, c] of cycles) {
    if (c.resetsAt > now) {
      live.push([key, c]);
      continue;
    }
    if (!byKind.has(c.kind)) byKind.set(c.kind, []);
    byKind.get(c.kind).push([key, c]);
  }
  const out = new Map(live);
  for (const list of byKind.values()) {
    for (const [key, c] of list.sort((a, b) => a[1].resetsAt - b[1].resetsAt).slice(-keep)) out.set(key, c);
  }
  return out;
}

/** Ghi tạm rồi đổi tên — cùng khuôn với `writeRollup`, cùng lý do. */
export async function writeCycles(cycles, file = QUOTA_LOG, now = Date.now()) {
  const trimmed = trimCycles(cycles, QUOTA_CYCLES_KEEP, now);
  const body = { version: LOG_VERSION, updatedAt: now, cycles: Object.fromEntries(trimmed) };
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(body, null, 1));
  await fs.rename(tmp, file);
  return trimmed;
}

/* ── Trạng thái tiến trình ────────────────────────────────────────────────── */

let memo = null;
let writeError = null;

/** Chỉ dùng trong test — sổ là trạng thái toàn tiến trình, mà test thì phải độc lập nhau. */
export function _reset() {
  memo = null;
  writeError = null;
}

/**
 * Nhập một lượt đọc rồi trả về phần cho client.
 *
 * Ghi đĩa KHÔNG await: đĩa chậm không có lý do gì chặn lượt quét, và mất một lượt ghi chỉ
 * tốn đúng lượt đọc đó — lượt sau vẫn còn nguyên đỉnh trong bộ nhớ và sẽ ghi lại cả.
 */
export async function trackQuota(q, { now = Date.now(), file = QUOTA_LOG } = {}) {
  if (memo == null) memo = await readCycles(file);
  const next = bumpCycles(memo, q, now);
  if (next !== memo) {
    memo = next;
    writeCycles(memo, file, now).then(
      (trimmed) => {
        memo = trimmed;
        writeError = null;
      },
      (err) => {
        writeError = err.message;
      },
    );
  }
  // `ledger` là chính cái Map — cho `collectLookback` gấp tiền theo chu kỳ mà không phải
  // đọc lại đĩa. `state.js` PHẢI tách nó ra trước khi cho phần còn lại vào state: Map đi
  // qua JSON.stringify thành `{}` — payload không phồng nhưng dữ liệu câm lặng biến mất.
  return { ...cyclesOf(memo, now), path: file, error: writeError, ledger: memo };
}
