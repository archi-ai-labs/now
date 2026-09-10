import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { ANTIGRAVITY_CONVOS, CONVO_KEEP_DAYS } from '../config.js';
import { all, decode, int, str, sub, timestampMs } from '../lib/pb.js';
import { localDay } from './usage.js';

/**
 * Từng lượt gọi model của Antigravity, đọc thẳng từ đĩa.
 *
 * `collect/antigravity.js` đọc sổ mục lục và dừng ở đó — nó biết có bao nhiêu hội thoại và
 * mỗi hội thoại chạy bao nhiêu **bước**, nhưng "bước" là đơn vị của giao diện (một lần bấm
 * chạy tool cũng là một bước), không phải đơn vị của hạn mức. Nên tab Antigravity cho tới
 * giờ là tab duy nhất không có lấy một con số token nào, trong khi khối hạn mức ngay trên
 * nó thì nói bằng phần trăm đã tiêu — hai thứ không nối được với nhau.
 *
 * Số ấy CÓ trên đĩa. Mỗi `conversations/<id>.db` là SQLite, và bảng `gen_metadata` giữ đúng
 * một bản ghi cho mỗi lượt gọi model, dưới dạng protobuf không tài liệu. Đo trên máy này:
 * **101 hội thoại · 4.836 lượt · 14 ngày**, hoàn toàn vô hình cho tới bản này.
 *
 * ## Hình dạng đã dò được (2026-07-27, Antigravity 2.3.1)
 *
 * ```
 * <blob>          1 = lượt gọi
 *   lượt gọi      4  = { 3 = token sinh ra }          ← SUY RA, xem dưới
 *                 9  = { 4  = Timestamp lúc gọi
 *                        10 = { 1 = ngữ cảnh đã dùng, 4 = trần ngữ cảnh } }
 *                 19 = mã model      ("gemini-3.6-flash")
 *                 20 = { 1 = tên nhãn, 2 = trị }  (lặp)
 *                 21 = tên hiển thị  ("Gemini 3.6 Flash (High)")
 * ```
 *
 * ## Hình dạng đã đổi (2026-08-19, Antigravity 2.12.2)
 *
 * Bản này bỏ hẳn hai trường, và bộ đọc cũ vì thế trả 0 lượt cho mọi file từ 19/8 mà không
 * kêu lấy một tiếng. Đo trên 543 file ở đây: mọi file có mtime ≤ 18/8 bóc được 100% số
 * hàng, mọi file từ 19/8 trở đi bóc được 0%.
 *
 * ```
 *   lượt gọi      9.4  ĐÃ MẤT — không còn Timestamp nào trong chính bản ghi
 *                 21   ĐÃ MẤT — chỉ còn mã model ở 19 ("gemini-3.8-flash")
 *                 4    { 3 = token sinh ra }  giữ nguyên
 *                 9.10 { 1 = ngữ cảnh, 4 = trần }  giữ nguyên
 *                 20   { 1 = "last_step_index", 2 = "8" }  ← mối nối sang bảng `steps`
 * ```
 *
 * Mốc thời gian chuyển sang bảng `steps` của cùng file `.db`: nhãn `last_step_index` là
 * khoá chính `steps.idx`, và `steps.metadata` mở đầu bằng một `google.protobuf.Timestamp`
 * ở trường 1. Đây là quan sát chứ không phải phỏng đoán, dựa trên ba phép đo:
 *
 * - Nối đủ **27.070/27.070** hàng trên toàn bộ 543 file, kể cả file bản cũ.
 * - Trên file bản cũ (còn 9.4 để đối chiếu), mốc lấy từ `steps` sớm hơn 9.4 **112 ms**
 *   ở trung vị và lệch dưới 60 giây ở 99% số hàng — tức là hai trường đo cùng một lượt,
 *   một cái lúc bước bắt đầu, một cái lúc bản ghi được chốt.
 * - Trong một hội thoại, mốc ấy tăng đơn điệu theo `gen_metadata.idx` và không lặp lại
 *   (498 hàng ra đúng 498 mốc khác nhau), nên nó là mốc của TỪNG lượt chứ không phải
 *   một mốc chung dán cho cả nhóm.
 *
 * ## Vì sao chỉ có một con số token, không phải bốn
 *
 * Trường 4 mang bảy số nguyên. Ba trong số đó gần như chắc chắn là token, nhưng chỉ **một**
 * được dùng ở đây:
 *
 * - Trường `4.3` — tổng **4,3 triệu** trên toàn bộ 4.836 lượt, và tỉ số so với ngữ cảnh đọc
 *   là **82×**, rơi đúng vào dải mà Claude Code cho ra ở cùng loại công việc. Đó là hai dấu
 *   hiệu độc lập cùng chỉ về "token model viết ra", nên nó được dùng — **kèm chữ suy ra**.
 * - Hai trường còn lại (tổng 48,9M và 352M) đều chạm trần 245k ở lượt lớn nhất, tức là cả
 *   hai đều có thể là "toàn bộ prompt" hay "phần đọc lại từ cache". Không tách được bằng
 *   quan sát, nên chúng **không lên hình**: một con số dán nhãn sai còn tệ hơn một chỗ trống
 *   có chú thích.
 *
 * Ngược lại, **ngữ cảnh thì chắc chắn**: trần của nó chỉ nhận đúng ba trị 128k · 160k · 256k
 * — ba cỡ cửa sổ ngữ cảnh có thật — và không lượt nào vượt trần của chính nó.
 *
 * ## Vì sao KHÔNG có chart "theo hồ hạn mức"
 *
 * Cám dỗ rõ ràng nhất là nối từng lượt về đúng hồ hạn mức đang hiện ở khối trên (Gemini với
 * Claude+GPT). Bản ghi có sẵn nhãn `used_claude` và `used_non_gemini_model` trông như dành
 * cho việc đó — nhưng hai nguồn **không khớp**: nhãn đếm ra 200 lượt ngoài-Gemini trong khi
 * đếm theo tên model chỉ ra 161. Lệch 20% nghĩa là ít nhất một trong hai không mang cái nghĩa
 * ta tưởng, và một chart quy trách nhiệm sai hồ thì tệ hơn hẳn không có chart. Tên model đã
 * lên hình rồi, mà "Gemini" hay "Claude" thì đọc thẳng ra được từ đó.
 */

/** Một lượt gọi `sqlite3`. Trả `null` khi lệnh hỏng, chuỗi output khi chạy được. */
function runSqlite(uri, sql) {
  return new Promise((resolve) => {
    execFile(
      'sqlite3',
      [uri, sql],
      // 64MB: một hội thoại dài cho ra vài nghìn hàng, mỗi hàng ~1KB blob in ra hex là 2KB.
      // Trần 8MB của `lib/sh.js` đủ cho mọi thứ khác trong dashboard nhưng không đủ ở đây,
      // và tràn trần thì `execFile` giết tiến trình — im lặng mất nguyên một hội thoại.
      { timeout: 10_000, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout) => resolve(err ? null : String(stdout)),
    );
  });
}

/**
 * Đọc một bảng, phân biệt được "không có hàng" với "không đọc được".
 *
 * `mode=ro` là bắt buộc, không phải cẩn thận thừa. Mở đường thường (đọc-ghi) khiến SQLite
 * checkpoint WAL vào file chính: đo trên một bản sao có WAL 5,6 MB thì sau đúng một câu
 * `select`, WAL về 0 byte, md5 file đổi và mtime nhảy lên hiện tại. Mà
 * `collect/antigravity.js` lấy mtime file trên đĩa làm mốc "hội thoại còn thức", nên
 * dashboard tự đẩy mtime rồi đọc lại chính dấu tay của mình thành hoạt động. Cùng lý do đã
 * ghi ở `collect/cursor.js`.
 *
 * Dù vậy `mode=ro` không phải là không chạm gì cả: nó vẫn cập nhật mtime của `-shm`. Đo
 * 2026-09-10 trên một bản sao thì sau một câu `select`, `.db` giữ nguyên md5 lẫn mtime và
 * `-wal` giữ nguyên 8.272 byte, còn mtime của `-shm` nhảy lên đúng thời điểm đọc. Hiện vô
 * hại vì `touchTimes` bên `collect/antigravity.js` chỉ nhìn `.db` và `-wal`, nhưng ai lấy
 * `-shm` làm mốc hoạt động sau này sẽ đọc lại đúng dấu tay của dashboard.
 *
 * Lượt đầu **không** dùng `immutable=1`: cờ đó bỏ qua WAL, tức là bỏ luôn những lượt gọi
 * vừa xảy ra và còn nằm trong `-wal` chưa checkpoint.
 *
 * Lượt hai mới dùng, và chỉ khi `-wal` vắng mặt hoặc dài 0 byte. Lý do: một `.db` ở chế độ
 * WAL mà mất CẢ `-wal` lẫn `-shm` bên cạnh thì trên MỘT SỐ bản SQLite, `mode=ro` trả
 * SQLITE_CANTOPEN(14), vì mở WAL là phải dựng lại hai file ấy. Thiếu mỗi `-shm` thôi thì bản
 * nào cũng mở được, vì SQLite tự dựng lại nó.
 *
 * "Một số bản" chứ không phải "mọi bản", và đây là chỗ bản trước nói quá: sqlite3 3.43.2 (bản
 * Apple) trả CANTOPEN rồi rơi xuống nhánh dưới, còn bản trên ubuntu-latest mở thẳng được và
 * dựng lại `-wal`. Nhánh dưới vì vậy là lưới đỡ chứ không phải đường đi bắt buộc, và một bài
 * test khẳng định `-wal` không được dựng lại sẽ đỏ ở đúng nửa số máy — nó đã đỏ thật trên CI.
 *
 * Đo 2026-09-10: 3/547 file rơi vào ca này, và con số ấy trôi theo thời gian, vì mỗi lượt mở
 * đọc-ghi lại sinh ra hai file kia. Khi WAL vắng hoặc rỗng thì không có hàng nào để bỏ sót,
 * nên `immutable=1` đọc ra đúng cùng một tập hàng; còn WAL có byte thì thà báo không đọc
 * được, chứ đọc thiếu mà im lặng thì tệ hơn.
 */
async function query(file, sql) {
  const out = await runSqlite(`file:${file}?mode=ro`, sql);
  if (out != null) return { ok: true, out };

  let walBytes = 0;
  try {
    walBytes = (await fs.stat(`${file}-wal`)).size;
  } catch {
    /* chưa có WAL — coi như rỗng */
  }
  if (walBytes > 0) return { ok: false };

  const alt = await runSqlite(`file:${file}?mode=ro&immutable=1`, sql);
  return alt == null ? { ok: false } : { ok: true, out: alt };
}

/** Mọi hàng của `gen_metadata`, mỗi hàng một dòng hex. */
const GEN_SQL = 'select hex(data) from gen_metadata';

/**
 * `idx|hex` của 32 byte ĐẦU mỗi `steps.metadata`.
 *
 * Cắt ngắn vì Timestamp luôn là trường đầu tiên của blob ấy (đo: 1.027/1.027 hàng mở đầu
 * bằng byte `0A`, thân dài 10–12 byte), trong khi phần còn lại chở nguyên nội dung bước.
 * Lấy đủ thì một hội thoại tốn 2,3 MB hex chỉ để đọc ra vài trăm con số.
 */
const STEP_SQL = "select idx || '|' || hex(substr(metadata, 1, 32)) from steps where metadata is not null";

/**
 * Bảng tra `steps.idx → mốc thời gian (ms)`, dựng từ output của `STEP_SQL`.
 *
 * Hàm thuần trên chuỗi, nên test được mà không cần file `.db` nào.
 */
export function parseStepTimes(out) {
  const times = new Map();
  for (const line of String(out).split('\n')) {
    const bar = line.indexOf('|');
    if (bar < 1) continue;
    const idx = Number(line.slice(0, bar));
    const hex = line.slice(bar + 1).trim();
    if (!Number.isInteger(idx) || !hex) continue;
    const ts = timestampMs(decode(Buffer.from(hex, 'hex')), 1);
    if (ts) times.set(idx, ts);
  }
  return times;
}

/** Trị của một nhãn trong `20 = { 1 = tên, 2 = trị }` (lặp). `null` khi không có nhãn ấy. */
function label(g, name) {
  for (const b of all(g, 20)) {
    if (!Buffer.isBuffer(b)) continue;
    const kv = decode(b);
    if (str(kv, 1) === name) return str(kv, 2);
  }
  return null;
}

/** Mốc thời gian tra qua bảng `steps`, đường duy nhất còn lại từ Antigravity 2.12.2. */
function stepTime(g, stepTimes) {
  if (!stepTimes?.size) return null;
  const raw = label(g, 'last_step_index');
  // Vắng nhãn phải trả `null` ngay: `Number(null)` ra 0, và 0 là một `steps.idx` có thật,
  // nên mọi hàng thiếu nhãn sẽ nhận chung mốc của bước đầu tiên.
  if (raw == null) return null;
  const idx = Number(raw);
  return Number.isInteger(idx) ? (stepTimes.get(idx) ?? null) : null;
}

/**
 * Một hàng `gen_metadata` → một lượt gọi. `null` khi hàng không mang đủ thứ để đếm.
 *
 * `stepTimes` là bảng tra `steps.idx → ms` mà chỗ gọi dựng sẵn bằng `parseStepTimes`, và
 * chỉ được dùng khi bản ghi không tự mang mốc thời gian (xem sơ đồ 2.12.2 ở đầu file).
 * Bỏ trống thì hàm vẫn chạy đúng cho bản ghi cũ, nên nó vẫn thuần trên một `Buffer` và
 * test được bằng protobuf dựng tay, không cần SQLite.
 */
export function parseGenRow(buf, stepTimes = null) {
  let g;
  try {
    g = sub(decode(buf), 1);
  } catch {
    return null;
  }
  if (!g) return null;

  const nine = sub(g, 9);
  const ts = timestampMs(nine, 4) ?? stepTime(g, stepTimes);
  // Không có mốc thời gian thì lượt ấy không vào được chart nào theo ngày, và để nó lọt
  // vào mấy tổng khác thì hai con số cạnh nhau lại phủ hai khoảng khác nhau.
  if (!ts) return null;

  const ctx = sub(nine, 10);
  const ctxUsed = int(ctx, 1);
  const ctxMax = int(ctx, 4);
  return {
    ts,
    model: str(g, 19) || null,
    // Tên hiển thị mới là thứ người dùng thấy trong app ("Gemini 3.6 Flash (High)"); mã
    // model giữ lại cho bảng số, vì đó là chuỗi đi grep được.
    name: str(g, 21) || str(g, 19) || null,
    ctx: ctxUsed != null && ctxUsed >= 0 ? ctxUsed : null,
    ctxMax: ctxMax != null && ctxMax > 0 ? ctxMax : null,
    out: int(sub(g, 4), 3) ?? null,
  };
}

/**
 * Băng độ đầy ngữ cảnh.
 *
 * Băng cuối hở phải ở 90% chứ không phải 100%: ngữ cảnh gần trần là lúc app bắt đầu phải
 * cắt bớt lịch sử, và mốc đó tới trước khi chạm 100%. Chia đều năm băng 20% thì đúng cái
 * băng đáng chú ý nhất lại bị trộn chung với những lượt còn thoải mái.
 */
export const CTX_BANDS = [
  { key: 'b0', lo: 0, hi: 25 },
  { key: 'b25', lo: 25, hi: 50 },
  { key: 'b50', lo: 50, hi: 75 },
  { key: 'b75', lo: 75, hi: 90 },
  { key: 'b90', lo: 90, hi: null },
];

const bandOf = (frac) => {
  const p = frac * 100;
  return CTX_BANDS.find((b) => p >= b.lo && (b.hi == null || p < b.hi)) ?? CTX_BANDS[0];
};

/** Trung vị. Bản riêng vì `collect/efficiency.js` không xuất ra và bốn dòng thì rẻ hơn một module chung. */
function median(list) {
  if (!list.length) return null;
  const a = list.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/**
 * Gộp mọi lượt thành các bảng mà giao diện ăn được. Hàm thuần.
 *
 * Ngữ cảnh dùng **trung vị**, không dùng tổng: tổng ngữ cảnh đọc là 352M trên máy này, gấp
 * 82 lần token viết ra, nên một chart "ngữ cảnh mỗi ngày" chỉ nói lại được đúng một điều —
 * hôm đó ngồi máy bao lâu. Trung vị của một lượt thì trả lời câu khác hẳn và có ích hơn:
 * *một lượt điển hình hôm nay to bằng nào*. Cùng lý do với `chartCtxByTurn` ở tab Claude.
 */
export function digest(turns, { now = Date.now(), keepDays = CONVO_KEEP_DAYS } = {}) {
  const floor = now - keepDays * 86400_000;
  const live = turns.filter((t) => t.ts >= floor);
  // Nhánh rỗng trả về ĐỦ mọi khoá của nhánh thường, chỉ khác giá trị. Thiếu khoá thì chỗ
  // gọi phải nhớ dùng `?.` ở đúng những chỗ nào — mà cái trí nhớ ấy hỏng lặng lẽ.
  if (!live.length) {
    return {
      turns: 0,
      out: 0,
      ctx: 0,
      ctxMedian: null,
      ctxKnown: 0,
      from: null,
      to: null,
      series: [],
      models: [],
      ctxBands: CTX_BANDS.map((b) => ({ ...b, turns: 0 })),
      banded: 0,
      byConvo: {},
    };
  }

  const days = new Map();
  const models = new Map();
  const convos = new Map();
  const bands = new Map(CTX_BANDS.map((b) => [b.key, 0]));
  let ctxTotal = 0;
  let outTotal = 0;
  let ctxKnown = 0;

  for (const t of live) {
    const day = localDay(new Date(t.ts).toISOString());
    if (!days.has(day)) days.set(day, { day, turns: 0, out: 0, ctxList: [] });
    const d = days.get(day);
    d.turns += 1;
    d.out += t.out ?? 0;
    if (t.ctx != null) d.ctxList.push(t.ctx);

    const key = t.name ?? '—';
    if (!models.has(key)) models.set(key, { key, model: t.model ?? null, turns: 0, out: 0, ctxList: [] });
    const m = models.get(key);
    m.turns += 1;
    m.out += t.out ?? 0;
    if (t.ctx != null) m.ctxList.push(t.ctx);

    if (!convos.has(t.convo)) convos.set(t.convo, { turns: 0, out: 0, ctx: 0 });
    const c = convos.get(t.convo);
    c.turns += 1;
    c.out += t.out ?? 0;
    c.ctx += t.ctx ?? 0;

    // Băng chỉ tính được khi biết CẢ trần: cùng một 120k là thoải mái trong cửa sổ 256k
    // nhưng đã tràn trong cửa sổ 128k. Thiếu trần thì lượt ấy không vào băng nào.
    if (t.ctx != null && t.ctxMax) {
      const b = bandOf(t.ctx / t.ctxMax).key;
      bands.set(b, bands.get(b) + 1);
    }
    if (t.ctx != null) {
      ctxTotal += t.ctx;
      ctxKnown += 1;
    }
    outTotal += t.out ?? 0;
  }

  const strip = ({ ctxList, ...rest }) => ({ ...rest, ctx: ctxList.reduce((n, v) => n + v, 0), ctxMedian: median(ctxList) });
  const banded = [...bands.values()].reduce((n, v) => n + v, 0);

  return {
    turns: live.length,
    out: outTotal,
    ctx: ctxTotal,
    ctxMedian: median(live.map((t) => t.ctx).filter((v) => v != null)),
    ctxKnown,
    from: [...days.keys()].sort()[0] ?? null,
    to: [...days.keys()].sort().at(-1) ?? null,
    series: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)).map(strip),
    models: [...models.values()].map(strip).sort((a, b) => b.turns - a.turns),
    // Băng giữ CẢ băng rỗng: "không lượt nào chạm 90% trần" là một kết luận, không phải
    // một chỗ trống — cùng lý do `chartRewarm` ở tab Claude không đi qua `ranked()`.
    ctxBands: CTX_BANDS.map((b) => ({ ...b, turns: bands.get(b.key) })),
    banded,
    byConvo: Object.fromEntries(convos),
  };
}

/**
 * Bộ nhớ theo TỪNG file, khoá bằng `mtime:size` của cả `.db` lẫn `-wal`.
 *
 * Đo 2026-09-10 trên 226 hội thoại trong cửa sổ giữ: lượt quét nguội tốn 1,7–9,4 giây tuỳ
 * tải máy và cache hệ tệp (trung vị 3,9 giây trên tám lượt), vì từ bản 2.12.2 mỗi file tốn
 * tới hai lượt gọi `sqlite3`. Lượt có memo nóng chỉ tốn 20–200 ms. Nhịp quét khi có người
 * xem là 30 giây (`SCAN_MS.watched` ở `server.js`), nên một lượt nguội vẫn lọt vào một
 * nhịp, nhưng nó ăn 6–31% nhịp ấy; khoá theo mtime+size nên lượt sau chỉ đọc lại đúng file
 * vừa được ghi, và chi phí thường trực tụt về gần bằng không.
 *
 * `-wal` phải nằm trong khoá vì `mode=ro` đọc CẢ nội dung WAL: lượt gọi vừa xảy ra rơi vào
 * `-wal` trong khi `.db` chưa đổi lấy một byte, nên khoá chỉ theo `.db` sẽ trả lại bản cũ
 * cho tới lúc app checkpoint — đo được một hội thoại có `.db` mtime 22:09 mà `-wal` mtime
 * 22:13 với 5,6 MB chưa checkpoint.
 */
const memo = new Map();

/**
 * Kết luận sức khoẻ của cả lượt quét, từ số hàng THÔ đã nhìn thấy và số lượt bóc được.
 *
 * Mở được từng file mà không bóc nổi một hàng nào trong TẤT CẢ chúng nghĩa là Google đã
 * đổi hình dạng bản ghi, đúng ca mà `parseSummaries` bên `collect/antigravity.js` trả
 * `reason: 'shape'`. Bộ đếm `unreadable` không bắt được ca này vì file mở ra bình thường:
 * nó chỉ ra 0 lượt, mà 0 lượt trông y hệt một tuần không đụng tới Antigravity. Đúng lỗi ấy
 * đã giấu ba tuần dữ liệu, từ 19/8 tới 10/9.
 *
 * Ngưỡng đặt ở "không còn gì để hiện" chứ không phải ở một tỉ lệ phần trăm, vì giao diện
 * ẩn nguyên khối chart khi `ok: false`. Hỏng một phần mà đã trả `ok: false` thì phần file
 * còn đọc được cũng biến mất theo, tức là đổi một chỗ đếm hụt lấy một chỗ trắng hoàn toàn.
 * Ca hỏng một phần nói bằng ba con số `shape`, `rows` và `parsed`, luôn có mặt trong
 * payload. Cặp so sánh đúng là `rows` với `parsed`, vì cả hai đều đếm hàng THÔ; lấy `rows`
 * trừ `turns` thì ra một con số không có nghĩa, do `turns` đã bị `digest` lọc theo cửa sổ
 * giữ. Đo 2026-09-10: rows 11.477, parsed 11.477, turns 11.204, tức là không hàng nào bóc
 * hỏng và cả 273 hàng chênh kia chỉ là hàng cũ hơn 14 ngày.
 *
 * Tách ra khỏi `collectAgTurns` để test được mà không cần một file `.db` nào.
 */
export function scanVerdict({ seen = 0, parsed = 0 } = {}) {
  return seen > 0 && parsed === 0 ? { ok: false, reason: 'shape' } : { ok: true };
}

/** Đọc một file hội thoại. `null` khi không mở được; `{ rows, seen }` khi đọc được. */
async function readConvo(file) {
  const res = await query(file, GEN_SQL);
  if (!res.ok) return null;

  const hexes = res.out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const rows = [];
  const late = [];
  for (const hex of hexes) {
    const buf = Buffer.from(hex, 'hex');
    const row = parseGenRow(buf);
    if (row) rows.push(row);
    else late.push(buf);
  }

  // Mở bảng `steps` CHỈ khi có hàng chưa ra được mốc thời gian. File bản cũ vì thế vẫn
  // chỉ tốn một lượt gọi `sqlite3`, còn file từ 2.12.2 trả thêm một lượt để lấy lại thứ
  // Google đã bỏ khỏi `gen_metadata`.
  if (late.length) {
    const steps = await query(file, STEP_SQL);
    if (steps.ok) {
      const times = parseStepTimes(steps.out);
      if (times.size) {
        for (const buf of late) {
          const row = parseGenRow(buf, times);
          if (row) rows.push(row);
        }
      }
    }
  }
  // Thứ tự hàng không còn theo `idx` sau nhánh trên, nhưng `digest` gộp theo ngày chứ
  // không theo vị trí, nên không có gì phụ thuộc vào thứ tự ấy.
  return { rows, seen: hexes.length };
}

/**
 * Chạy `task` trên từng phần tử, tối đa `WIDTH` lượt cùng lúc.
 *
 * Từ bản 2.12.2 mỗi file tốn tới hai lượt gọi `sqlite3`, và thả hết một lúc cho vài trăm
 * hội thoại là vài trăm tiến trình chen nhau. Đo trên 330 hội thoại: không hàng đợi thì lượt
 * quét nguội mất 43 giây và 188 file bị BÁO NHẦM là không đọc được, chỉ vì `execFile` không
 * spawn nổi. Cùng công việc ấy qua hàng đợi rộng 8 thì không file nào hỏng.
 */
const WIDTH = 8;
async function pooled(list, task) {
  let next = 0;
  const worker = async () => {
    while (next < list.length) await task(list[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(WIDTH, list.length) }, worker));
}

/**
 * Đọc lượt gọi của những hội thoại đang được giữ.
 *
 * Nhận thẳng danh sách hội thoại từ `collect/antigravity.js` chứ không tự quét thư mục:
 * danh sách ấy đã lọc theo ngưỡng ngày rồi, nên không có file nào bị mở ra chỉ để rồi bị
 * ném đi. Nó cũng là chỗ duy nhất biết hội thoại nào thuộc dự án nào — nhưng phép nối ấy
 * để cho giao diện làm, module này chỉ trả về bảng theo id.
 */
export async function collectAgTurns({ convos = [], now = Date.now(), keepDays = CONVO_KEEP_DAYS } = {}) {
  const t0 = Date.now();
  if (!convos.length)
    return {
      ok: true,
      at: now,
      ...digest([], { now, keepDays }),
      files: 0,
      unreadable: 0,
      shape: 0,
      rows: 0,
      parsed: 0,
      convos: 0,
      scanMs: 0,
    };

  const turns = [];
  let unreadable = 0;
  let read = 0;
  let shape = 0;
  let seenTotal = 0;
  let parsedTotal = 0;

  await pooled(convos, async (c) => {
    const file = path.join(ANTIGRAVITY_CONVOS, `${c.id}.db`);
    let st;
    try {
      st = await fs.stat(file);
    } catch {
      // Sổ mục lục nhắc tới một hội thoại mà file đã bị dọn. Không phải hỏng — chỉ là
      // không còn gì để đọc, và số hội thoại ở khối trên vẫn đúng.
      return;
    }
    let wal = { mtimeMs: 0, size: 0 };
    try {
      wal = await fs.stat(`${file}-wal`);
    } catch {
      /* chưa có WAL, hoặc app đã checkpoint xong và dọn đi */
    }
    const key = `${st.mtimeMs}:${st.size}:${wal.mtimeMs}:${wal.size}`;

    const hit = memo.get(c.id);
    const got = hit?.key === key ? hit : await readConvo(file);
    if (!got) {
      unreadable += 1;
      return;
    }
    if (got !== hit) memo.set(c.id, { key, rows: got.rows, seen: got.seen });

    read += 1;
    seenTotal += got.seen;
    parsedTotal += got.rows.length;
    // File mở ra bình thường, có hàng, mà không bóc nổi lấy một hàng = hình dạng đã đổi.
    if (got.seen && !got.rows.length) shape += 1;
    turns.push(...got.rows.map((r) => ({ ...r, convo: c.id })));
  });

  // Hội thoại đã rời cửa sổ giữ thì bỏ luôn khỏi bộ nhớ, nếu không nó phình mãi theo
  // số hội thoại đã từng tồn tại chứ không theo số đang được nhìn.
  const alive = new Set(convos.map((c) => c.id));
  for (const id of memo.keys()) if (!alive.has(id)) memo.delete(id);

  return {
    ...scanVerdict({ seen: seenTotal, parsed: parsedTotal }),
    at: now,
    files: read,
    // Nói ra chứ không nuốt: một file không đọc được là một mảng dữ liệu bị thiếu, và
    // mấy con số bên cạnh sẽ nhỏ hơn sự thật mà không có gì báo.
    unreadable,
    /** Số file có hàng mà bóc ra 0 lượt. */
    shape,
    /** Hàng thô nhìn thấy, và hàng bóc được từ đúng mớ ấy. Cùng đơn vị nên trừ nhau được. */
    rows: seenTotal,
    parsed: parsedTotal,
    convos: read,
    scanMs: Date.now() - t0,
    ...digest(turns, { now, keepDays }),
  };
}
