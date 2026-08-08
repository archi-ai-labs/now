import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  KEYCHAIN_SERVICE,
  QUOTA_API_CACHE,
  QUOTA_API_URL,
  QUOTA_FILE,
  QUOTA_STALE_MS,
  QUOTA_TTL_MS,
} from '../config.js';

/**
 * Hạn mức gói thuê bao: % đã dùng của khung 5 giờ, khung 7 ngày, và khung 7 ngày
 * riêng theo model.
 *
 * Con số này **không tồn tại trên đĩa**. Ban đầu module đọc nó qua `statusLine` —
 * Claude Code đút `rate_limits` vào stdin của lệnh đó mỗi lần vẽ lại thanh trạng
 * thái, `statusline-quota.sh` chộp lấy rồi ghi ra `QUOTA_FILE`. Cách đó không đụng
 * credential, nhưng **chỉ chạy ở terminal**: Claude Desktop và Cursor đều spawn
 * `claude --output-format stream-json`, chế độ không có thanh trạng thái, nên hook
 * không bao giờ được gọi. Đo trên máy này: ba phiên Desktop sinh sau khi cài hook
 * đều không để lại dấu vết nào.
 *
 * Nên đường chính giờ là gọi thẳng `QUOTA_API_URL` bằng OAuth token trong Keychain.
 * Nó đúng với mọi app, và trả về nhiều hơn hook: hook chỉ có `five_hour` với
 * `seven_day`, còn endpoint có thêm hạn mức tuần riêng cho từng model.
 *
 * Đánh đổi đã biết, và là lý do hook vẫn được giữ làm lưới đỡ:
 *
 * - **Endpoint không có tài liệu.** Anthropic đổi hình dạng là hỏng. Mọi trường đều
 *   đọc phòng thủ, và hỏng thì rơi xuống ảnh chụp cũ chứ không ném lỗi.
 * - **Token hết hạn được.** Claude Code tự làm mới và ghi lại vào Keychain; dashboard
 *   đọc lại mỗi lần gọi nên bám theo. Nhưng nếu bạn không chạy Claude đủ lâu thì token
 *   chết hẳn — lúc đó rơi xuống ảnh chụp, không tự đi làm mới hộ (ghi đè Keychain là
 *   việc của Claude Code, chen vào chỉ tổ đua nhau).
 * - **Ảnh cũ luôn sai về phía AN TOÀN.** Lúc bạn không dùng Claude thì bạn cũng không
 *   tiêu quota, mà cửa sổ vẫn trôi — phần dùng cũ rơi dần ra ngoài nên % thật chỉ có
 *   giảm. Số cũ vì thế là cận TRÊN. `conservative` đánh dấu đúng trạng thái đó.
 * - **Qua `resets_at` là số chết hẳn.** Cửa sổ đã lăn sang chu kỳ mới, % cũ không còn
 *   nghĩa gì — khác với "hơi cũ", nên có cờ riêng (`expired`).
 */

const run = promisify(execFile);

/**
 * Bao lâu thì thôi gọi lại sau một lượt hỏng, theo từng kiểu hỏng.
 *
 * `no-auth` được nghỉ dài nhất vì nó là kiểu hỏng duy nhất có thể **làm phiền người
 * dùng**: nếu macOS đang hỏi quyền Keychain mà họ bấm Deny, gọi lại mỗi 30 giây là
 * đẻ ra một hộp thoại mỗi 30 giây. Mấy kiểu còn lại chỉ tốn một lượt mạng.
 */
const BACKOFF_MS = {
  'no-auth': 10 * 60 * 1000,
  'token-expired': 5 * 60 * 1000,
  http: 5 * 60 * 1000,
  timeout: 60 * 1000,
  network: 60 * 1000,
};

let memo = null; // { at, body } — lượt gọi thành công gần nhất
let blockUntil = 0; // đừng gọi lại trước mốc này
let blockFail = null; // lượt hỏng gốc — giao diện cần lý do THẬT, không phải "đang nghỉ"
/**
 * Số lượt THỰC SỰ ra tới endpoint kể từ lúc khởi động (không tính lượt trúng cache).
 * Đi kèm trong payload để câu "dashboard đang gọi ở nhịp nào" trả lời được bằng cách
 * nhìn, thay vì phải gắn log rồi ngồi đo lại như lần này.
 */
let calls = 0;

/**
 * Mốc thời gian, chuẩn hoá về mili-giây.
 *
 * Hai nguồn dùng hai kiểu khác nhau và cùng đổ vào đây: endpoint trả chuỗi ISO có
 * timezone, hook trả epoch GIÂY. Quên nhân 1000 cho nhánh sau thì mọi mốc reset rơi
 * về năm 1970 và luôn hiện "đã qua".
 */
function toMs(v) {
  // Ngưỡng 1e11 nằm giữa epoch giây (~1,8e9) và epoch mili-giây (~1,8e12), nên
  // nhánh này vẫn đúng nếu một ngày nào đó nguồn đổi sang mili-giây.
  if (typeof v === 'number') return Number.isFinite(v) ? (v > 1e11 ? v : v * 1000) : null;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Độ dài danh nghĩa của mỗi cửa sổ.
 *
 * Endpoint chỉ trả mốc RESET, không trả mốc bắt đầu — nên phần đã trôi qua của cửa
 * sổ phải suy ngược ra từ độ dài. Hai con số này là định nghĩa của gói (khung phiên
 * 5 giờ tính từ tin nhắn đầu tiên, khung tuần 7 ngày), không phải đo được từ dữ liệu:
 * Anthropic đổi định nghĩa là mọi dự báo dưới đây lệch theo, nên nó nằm ở một chỗ
 * duy nhất và có tên.
 */
const FIVE_HOUR_MS = 5 * 3600_000;
const SEVEN_DAY_MS = 7 * 86400_000;

/**
 * Phần cửa sổ phải trôi qua trước khi cho phép ngoại suy.
 *
 * Chia cho một khoảng quá ngắn là cách chắc chắn nhất để bịa ra hoảng loạn: 1% đã dùng
 * sau 1% thời gian ra đúng "sẽ chạm 100%", mà thực tế đó chỉ là một lượt gọi lẻ ngay
 * sau reset. 3% ứng với ~9 phút của khung 5 giờ và ~5 giờ của khung 7 ngày — dưới mốc
 * đó thì nói thẳng là chưa đoán được, thay vì đưa ra một con số trông như đã biết.
 */
const MIN_ELAPSED_FRAC = 0.03;

/**
 * Ngoại suy tuyến tính: giữ nguyên nhịp tiêu từ đầu cửa sổ tới giờ thì lúc reset sẽ ở đâu.
 *
 * Đây là mô hình NGHÈO nhất có thể, và cố ý: nhịp thật giật cục (ngồi ba tiếng rồi nghỉ
 * cả ngày), nên mọi mô hình phức tạp hơn đều đòi một giả định về thói quen mà dashboard
 * không có quyền tự đặt hộ. Đường thẳng thì ai cũng kiểm tra lại được bằng đầu: "đã tiêu
 * X trong Y giờ, còn Z giờ nữa".
 *
 * `reason` nói vì sao KHÔNG có số, và ba lý do đó khác nhau thật:
 * - `early`   — cửa sổ vừa mở, mẫu quá ngắn để chia.
 * - `rolled`  — mốc reset đã qua, số hiện tại thuộc chu kỳ cũ.
 * - `unknown` — không có mốc reset, không suy ra được đã trôi bao lâu.
 */
export function forecastOf(used, resetsAt, windowMs, now) {
  if (resetsAt == null || !windowMs) return { known: false, reason: 'unknown' };
  const leftMs = resetsAt - now;
  if (leftMs <= 0) return { known: false, reason: 'rolled' };

  // Mốc reset xa hơn cả độ dài cửa sổ nghĩa là giả định độ dài ở trên sai — không đoán bừa.
  const elapsedMs = windowMs - leftMs;
  if (elapsedMs <= 0) return { known: false, reason: 'unknown' };

  const frac = elapsedMs / windowMs;
  if (frac < MIN_ELAPSED_FRAC) return { known: false, reason: 'early', elapsedMs, leftMs, frac };

  const perMs = used / elapsedMs;
  const projected = used + perMs * leftMs;
  // Đã kịch trần thì không còn gì để đoán: cạn NGAY, không phải "sẽ cạn".
  const exhaustInMs = used >= 100 ? 0 : perMs > 0 ? (100 - used) / perMs : null;

  return {
    known: true,
    elapsedMs,
    leftMs,
    frac,
    perHour: perMs * 3600_000,
    projected,
    // So với 100 chứ không với `remaining`: câu hỏi là "nhịp này có đụng trần trước khi
    // cửa sổ lăn không", và trần luôn là 100%.
    willExhaust: projected > 100,
    // Chỉ có nghĩa khi thật sự cạn TRƯỚC mốc reset — ngoài khoảng đó thì cửa sổ đã lăn rồi.
    exhaustInMs: exhaustInMs != null && exhaustInMs < leftMs ? exhaustInMs : null,
    exhaustAt: exhaustInMs != null && exhaustInMs < leftMs ? now + exhaustInMs : null,
  };
}

/** Hai quãng nhìn lại của dự phóng theo nhịp. Xuất cho test. */
export const PACE_LOOKBACKS_MS = [24 * 3600_000, 48 * 3600_000];

/**
 * Dự phóng theo nhịp NHANH NHẤT trong ba: từ đầu cửa sổ · 24 giờ qua · 48 giờ qua.
 *
 * Đường thẳng từ đầu cửa sổ (`forecastOf`) trả lời sai đúng một ca, và là ca thường gặp
 * nhất trên máy này: nghỉ năm ngày đầu tuần rồi cắm mặt hai ngày cuối. Nhịp trung bình bị
 * năm ngày nghỉ kéo bẹp, dự phóng nói "bỏ phí 90%" đúng lúc đang tiêu nhanh nhất — con số
 * mất lòng tin ngay lượt đầu tiên nó sai kiểu đó.
 *
 * Lấy MAX chứ không phải trung bình có trọng số: mọi trọng số đều là một con số bịa phải
 * giải thích, còn "nhịp nhanh nhất đo được gần đây" là một phép đo. Nó thiên về CAO — với
 * hạn mức trả trước thì đó là chiều an toàn: "sẽ dùng hết" mà hụt còn đỡ hơn "sẽ bỏ phí"
 * mà hụt, vì tiêu hết là đích chứ không phải nạn.
 *
 * Vận tốc một quãng = (đã tiêu bây giờ − đã tiêu ở mốc quãng trước) / thời gian thật giữa
 * hai mẫu. Mốc so lấy từ VỆT mẫu (`trail`) mà sổ chu kỳ giữ trên bản ghi đang chạy — xem
 * `pushTrail` trong `quotalog.js`. Không có vệt (sổ mới mở, server vừa cài) thì rơi êm về
 * đúng đường cũ, không bịa.
 *
 * Quãng nhìn lại DÀI HƠN phần cửa sổ đã trôi thì bỏ: vận tốc của nó chính là tốc độ cũ.
 * Nhờ vậy khung 5 giờ tự thoát — 24h lẫn 48h đều dài hơn cả cửa sổ, công thức tự rút về
 * đường thẳng cũ, không cần nhánh riêng. Mọi ca `known: false` (early/rolled/unknown)
 * cũng giữ nguyên — vệt không cứu được thứ chưa đủ điều kiện đoán. Riêng bucket cửa sổ
 * lăn của AG thì KHÔNG được suy từ tên: `*-5h` mang mốc reset cách đủ một cửa sổ nên rơi
 * vào `early`, còn `3p-weekly` mang mốc giữa cửa sổ và xưa nay vẫn `known:true` — với nó
 * nhịp 24/48h chỉ kéo dự phóng LÊN, và cú kẹp 0 ở dưới chặn chuyện `used` tụt sinh số âm.
 */
export function forecastWith(used, resetsAt, windowMs, now, trail) {
  const base = forecastOf(used, resetsAt, windowMs, now);
  if (!base.known || !trail?.length) return base;

  let perMs = used / base.elapsedMs; // tốc độ cũ — đường thẳng từ đầu cửa sổ
  let paceMs = null;
  for (const look of PACE_LOOKBACKS_MS) {
    if (look >= base.elapsedMs) continue;
    const target = now - look;
    let mark = null;
    for (const s of trail) {
      if (s.at <= target) mark = s;
      else break; // vệt xếp theo thời gian tăng — qua mốc là dừng
    }
    if (!mark) continue; // vệt chưa phủ tới quãng này: không đo được thì không đo
    const dt = now - mark.at;
    if (dt <= 0) continue;
    // Kẹp 0: trong một cửa sổ cố định `used` chỉ tăng, nhưng một lượt đọc lẻ có thể trả
    // thấp hơn — vận tốc âm là rác đo, không phải thông tin.
    const v = Math.max(0, used - mark.used) / dt;
    if (v > perMs) {
      perMs = v;
      paceMs = look;
    }
  }
  if (paceMs == null) return base;

  const projected = used + perMs * base.leftMs;
  const exhaustInMs = used >= 100 ? 0 : perMs > 0 ? (100 - used) / perMs : null;
  return {
    ...base,
    perHour: perMs * 3600_000,
    projected,
    willExhaust: projected > 100,
    exhaustInMs: exhaustInMs != null && exhaustInMs < base.leftMs ? exhaustInMs : null,
    exhaustAt: exhaustInMs != null && exhaustInMs < base.leftMs ? now + exhaustInMs : null,
    /** Quãng đã thắng (ms). Vắng mặt = đường cũ thắng — tooltip nói được nguồn con số. */
    paceMs,
  };
}

/** Một cửa sổ hạn mức, đã quy đổi sang thứ giao diện dùng được. */
function windowOf(used, resetsRaw, now, windowMs, extra) {
  if (typeof used !== 'number' || !Number.isFinite(used)) return null;
  const resetsAt = toMs(resetsRaw);
  const u = Math.max(0, Math.min(100, used));
  return {
    used: u,
    remaining: 100 - u,
    resetsAt,
    resetsInMs: resetsAt == null ? null : resetsAt - now,
    expired: resetsAt != null && resetsAt <= now,
    windowMs,
    // Phần cửa sổ đã trôi qua. Tách khỏi `forecast` vì nó là SỰ THẬT ĐO ĐƯỢC, không
    // phải ngoại suy — giao diện vẫn vẽ được mốc "tiêu đều" ở những lúc chưa đoán nổi
    // nhịp, và đó đúng là lúc cần một chỗ bấu víu nhất.
    elapsedFrac:
      resetsAt == null || !windowMs
        ? null
        : Math.max(0, Math.min(1, (windowMs - (resetsAt - now)) / windowMs)),
    forecast: forecastOf(u, resetsAt, windowMs, now),
    ...extra,
  };
}

/** Phần chung của cả hai nguồn: tuổi ảnh chụp và chiều sai của nó. */
function ageOf(at, now) {
  const ageMs = Math.max(0, now - at);
  const stale = ageMs > QUOTA_STALE_MS;
  // Số cũ chỉ có thể cao hơn thực tế, không bao giờ thấp hơn. Cờ này để giao diện nói
  // đúng chiều sai — "thực tế có thể thấp hơn" — thay vì chỉ kêu "dữ liệu cũ".
  return { at, ageMs, stale, conservative: stale };
}

/**
 * Bóc phản hồi endpoint thành trạng thái hạn mức.
 *
 * Hai cửa sổ chính lấy từ trường cấp cao nhất (`five_hour`/`seven_day`) chứ không
 * lấy từ `limits[]`, dù mảng đó cũng có: trường cấp cao nhất là hình dạng đơn giản
 * và ổn định hơn. `limits[]` chỉ dùng cho thứ không có chỗ nào khác — hạn mức tuần
 * theo model — và làm nguồn dự phòng khi trường cấp cao nhất vắng mặt.
 */
export function parseApiQuota(body, at, now = Date.now()) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'broken' };

  const limits = Array.isArray(body.limits) ? body.limits : [];
  const byKind = (k) => limits.find((l) => l?.kind === k) ?? null;
  // Hai nguồn gọi tên khác nhau cho cùng một thứ: cấp cao nhất là `utilization`,
  // trong `limits[]` là `percent`.
  const pct = (o) => (typeof o?.utilization === 'number' ? o.utilization : o?.percent);

  const s = body.five_hour ?? byKind('session');
  const w = body.seven_day ?? byKind('weekly_all');

  const fiveHour = windowOf(pct(s), s?.resets_at, now, FIVE_HOUR_MS);
  const sevenDay = windowOf(pct(w), w?.resets_at, now, SEVEN_DAY_MS);
  if (!fiveHour && !sevenDay) return { ok: false, reason: 'empty' };

  const scoped = limits
    .filter((l) => l?.kind === 'weekly_scoped')
    .map((l) => windowOf(pct(l), l.resets_at, now, SEVEN_DAY_MS, { model: l.scope?.model?.display_name || null }))
    .filter(Boolean);

  return { ok: true, source: 'api', ...ageOf(at, now), fiveHour, sevenDay, scoped };
}

/** Bóc file ảnh chụp của hook. Tách riêng khỏi I/O để test được. */
export function parseQuota(raw, now = Date.now()) {
  if (!raw || typeof raw.at !== 'number') return { ok: false, reason: 'broken' };

  const fiveHour = windowOf(raw.five_hour?.used_percentage, raw.five_hour?.resets_at, now, FIVE_HOUR_MS);
  const sevenDay = windowOf(raw.seven_day?.used_percentage, raw.seven_day?.resets_at, now, SEVEN_DAY_MS);
  // File có nhưng không cửa sổ nào đọc được = hook đã chạy trước lượt gọi API đầu
  // tiên. Đó không phải hỏng, chỉ là chưa tới lúc — nói khác đi để đừng dọa người dùng.
  if (!fiveHour && !sevenDay) return { ok: false, reason: 'empty' };

  return { ok: true, source: 'hook', ...ageOf(raw.at, now), fiveHour, sevenDay, scoped: [] };
}

/**
 * OAuth token của Claude Code, đọc từ Keychain.
 *
 * Blob trả về còn chứa token của mọi MCP server đã đăng nhập. Ở đây chỉ móc đúng
 * `claudeAiOauth.accessToken` ra, không giữ lại gì khác, và **không bao giờ đưa nội
 * dung blob vào log hay message lỗi** — kể cả khi JSON.parse hỏng.
 */
async function readToken() {
  let stdout;
  try {
    ({ stdout } = await run('security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'], {
      timeout: 5000,
      maxBuffer: 4 << 20,
    }));
  } catch {
    // Chưa đăng nhập, không có mục Keychain, hoặc người dùng bấm Deny. Cả ba đều là
    // "không có token" — phân biệt thêm cũng không đổi được việc gì.
    return null;
  }
  try {
    const oauth = JSON.parse(stdout)?.claudeAiOauth;
    return oauth?.accessToken ? { token: oauth.accessToken, expiresAt: oauth.expiresAt ?? null } : null;
  } catch {
    return null;
  }
}

/**
 * `Retry-After` server yêu cầu, quy về mili-giây. Header này có hai dạng hợp lệ —
 * số giây, hoặc mốc HTTP-date — và cả hai đều gặp ngoài đời.
 *
 * Bỏ qua nó là sai lầm đắt nhất khi bị 429: endpoint này từng trả `retry-after: 1602`
 * (~27 phút), mà backoff cứng của ta chỉ 5 phút. Đâm vào lại năm lần giữa lúc đang bị
 * phạt là cách chắc chắn nhất để bị phạt nặng hơn.
 */
export function retryAfterMs(res, now) {
  const raw = res.headers.get('retry-after');
  if (!raw) return null;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(raw);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

/** Một lượt gọi endpoint. Không bao giờ ném — mọi đường hỏng đều thành `reason`. */
async function fetchFresh(now) {
  calls += 1;
  const cred = await readToken();
  if (!cred) return { ok: false, reason: 'no-auth' };
  // Gọi bằng token đã chết chỉ tổ ăn 401. Chặn từ đây, và để backoff cho nó nghỉ đủ
  // lâu để Claude Code kịp làm mới trong lúc đó.
  if (cred.expiresAt && cred.expiresAt <= now) return { ok: false, reason: 'token-expired' };

  try {
    const res = await fetch(QUOTA_API_URL, {
      headers: {
        authorization: `Bearer ${cred.token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        accept: 'application/json',
        'user-agent': 'now-dashboard',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // Thân phản hồi lỗi đi ra log chứ không vào payload: nó là thứ duy nhất phân
      // biệt được "token sai" với "thiếu scope" với "gọi quá dày", nhưng không có
      // việc gì phải hiện lên giao diện.
      const detail = await res.text().catch(() => '');
      console.warn(`[quota] ${res.status} ${QUOTA_API_URL} — ${detail.slice(0, 300)}`);
      return { ok: false, reason: 'http', status: res.status, retryAfterMs: retryAfterMs(res, now) };
    }
    return { ok: true, at: now, body: await res.json() };
  } catch (err) {
    return { ok: false, reason: err?.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
}

async function readCache() {
  try {
    const snap = JSON.parse(await fs.readFile(QUOTA_API_CACHE, 'utf8'));
    return typeof snap?.at === 'number' && snap.body ? snap : null;
  } catch {
    return null;
  }
}

/** Ghi tạm rồi đổi tên: đọc trúng lúc đang ghi thì thấy bản cũ nguyên vẹn, không thấy file dở. */
async function writeCache(snap) {
  const tmp = `${QUOTA_API_CACHE}.${process.pid}`;
  try {
    await fs.mkdir(path.dirname(QUOTA_API_CACHE), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(snap));
    await fs.rename(tmp, QUOTA_API_CACHE);
  } catch {
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}

async function collectHookQuota(file, now) {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    // Chưa cài cầu nối, hoặc đã cài mà chưa phiên terminal nào chạy kể từ lúc đó.
    return { ok: false, reason: 'missing', file };
  }
  try {
    return { ...parseQuota(JSON.parse(text), now), file };
  } catch {
    return { ok: false, reason: 'broken', file };
  }
}

/**
 * Ba tầng, xuống dần theo độ tươi: endpoint → ảnh chụp endpoint gần nhất → file hook.
 *
 * `degraded` mang theo lý do phải tụt tầng, để giao diện nói được "vì sao số này cũ"
 * chứ không chỉ "số này cũ".
 */
export async function collectQuota({ now = Date.now(), watched = true } = {}) {
  // Nạp lại ảnh chụp trên đĩa sau khi khởi động, TRƯỚC khi xét TTL: không có bước này
  // thì mỗi lần restart là một lượt gọi mới, và mười lần restart trong lúc sửa code là
  // mười lượt gọi dồn vào nhau.
  if (!memo) memo = await readCache();
  if (memo && now - memo.at < QUOTA_TTL_MS) return { ...parseApiQuota(memo.body, memo.at, now), calls };

  // Không bề mặt nào đang BÀY con số này thì không gõ cửa endpoint. Nhịp dựng lại trạng
  // thái 30 giây vẫn chạy kể cả khi đã đóng hết tab, nên bỏ chốt này là dashboard nằm
  // không vẫn gọi 720 lượt mỗi ngày cho không ai đọc.
  //
  // "Bề mặt" chứ không phải "tab": mục trên thanh menu cũng in ra hai con số này, nên nó
  // cũng bật cờ (`badge` trong `buildState`). Đọc `watched` ở đây thành "có chỗ nào đang
  // hiện số", không phải "có cửa sổ trình duyệt nào đang mở".
  const attempt = !watched
    ? { ok: false, reason: 'idle' }
    : now < blockUntil
      ? blockFail
      : await fetchFresh(now);

  if (attempt.ok) {
    memo = { at: attempt.at, body: attempt.body };
    blockUntil = 0;
    blockFail = null;
    // Không await: đĩa chậm không có lý do gì chặn lượt quét, và mất bản ghi đệm chỉ
    // tốn thêm một lượt gọi sau khi khởi động lại.
    writeCache(memo);
    return { ...parseApiQuota(memo.body, memo.at, now), calls };
  }

  if (watched && now >= blockUntil) {
    // `Retry-After` của server thắng backoff của ta — nó biết mình đang phạt bao lâu,
    // ta thì đoán. Chặn trên một giờ để một header rác không giết hẳn màn hạn mức.
    const wait = Math.min(attempt.retryAfterMs ?? BACKOFF_MS[attempt.reason] ?? 60_000, 60 * 60_000);
    blockUntil = now + wait;
    blockFail = attempt;
  }

  // `status` đi kèm vì "endpoint trả lỗi" mà không có mã thì không sửa được gì — 401
  // (token sai) và 429 (gọi quá dày) đòi hai cách xử lý hoàn toàn khác nhau. Riêng
  // `idle` không phải hỏng, chỉ là chưa ai cần, nên không gắn cờ gì lên giao diện.
  const why = {
    calls,
    ...(attempt.reason === 'idle'
      ? {}
      : { degraded: attempt.reason, ...(attempt.status ? { status: attempt.status } : {}) }),
  };
  if (memo) return { ...parseApiQuota(memo.body, memo.at, now), ...why };
  return { ...(await collectHookQuota(QUOTA_FILE, now)), ...why };
}
