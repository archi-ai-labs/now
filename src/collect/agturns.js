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

/** Đọc một bảng, phân biệt được "không có hàng" với "không đọc được". */
function query(file, sql) {
  return new Promise((resolve) => {
    execFile(
      'sqlite3',
      [file, sql],
      // 64MB: một hội thoại dài cho ra vài nghìn hàng, mỗi hàng ~1KB blob in ra hex là 2KB.
      // Trần 8MB của `lib/sh.js` đủ cho mọi thứ khác trong dashboard nhưng không đủ ở đây,
      // và tràn trần thì `execFile` giết tiến trình — im lặng mất nguyên một hội thoại.
      { timeout: 10_000, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout) => resolve(err ? { ok: false } : { ok: true, out: String(stdout) }),
    );
  });
}

/**
 * Một hàng `gen_metadata` → một lượt gọi. `null` khi hàng không mang đủ thứ để đếm.
 *
 * Hàm thuần trên một `Buffer`, nên test được bằng protobuf dựng tay, không cần SQLite.
 */
export function parseGenRow(buf) {
  let g;
  try {
    g = sub(decode(buf), 1);
  } catch {
    return null;
  }
  if (!g) return null;

  const nine = sub(g, 9);
  const ts = timestampMs(nine, 4);
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
 * Bộ nhớ theo TỪNG file, khoá bằng `mtime:size`.
 *
 * Quét nguội cả 101 file tốn ~400ms; hội thoại thì hầu như không đổi giữa hai lượt quét
 * cách nhau 30 giây. Khoá theo mtime+size nên lượt sau chỉ đọc lại đúng file vừa được ghi,
 * và chi phí thường trực tụt về gần bằng không.
 */
const memo = new Map();

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
  if (!convos.length) return { ok: true, at: now, ...digest([], { now, keepDays }), files: 0, unreadable: 0, scanMs: 0 };

  const turns = [];
  let unreadable = 0;
  let read = 0;

  await Promise.all(
    convos.map(async (c) => {
      const file = path.join(ANTIGRAVITY_CONVOS, `${c.id}.db`);
      let st;
      try {
        st = await fs.stat(file);
      } catch {
        // Sổ mục lục nhắc tới một hội thoại mà file đã bị dọn. Không phải hỏng — chỉ là
        // không còn gì để đọc, và số hội thoại ở khối trên vẫn đúng.
        return;
      }
      const key = `${st.mtimeMs}:${st.size}`;
      const hit = memo.get(c.id);
      if (hit?.key === key) {
        turns.push(...hit.rows.map((r) => ({ ...r, convo: c.id })));
        read += 1;
        return;
      }

      const res = await query(file, 'select hex(data) from gen_metadata');
      if (!res.ok) {
        unreadable += 1;
        return;
      }
      const rows = [];
      for (const line of res.out.split('\n')) {
        const hex = line.trim();
        if (!hex) continue;
        const row = parseGenRow(Buffer.from(hex, 'hex'));
        if (row) rows.push(row);
      }
      memo.set(c.id, { key, rows });
      turns.push(...rows.map((r) => ({ ...r, convo: c.id })));
      read += 1;
    }),
  );

  // Hội thoại đã rời cửa sổ giữ thì bỏ luôn khỏi bộ nhớ, nếu không nó phình mãi theo
  // số hội thoại đã từng tồn tại chứ không theo số đang được nhìn.
  const alive = new Set(convos.map((c) => c.id));
  for (const id of memo.keys()) if (!alive.has(id)) memo.delete(id);

  return {
    ok: true,
    at: now,
    files: read,
    // Nói ra chứ không nuốt: một file không đọc được là một mảng dữ liệu bị thiếu, và
    // mấy con số bên cạnh sẽ nhỏ hơn sự thật mà không có gì báo.
    unreadable,
    convos: read,
    scanMs: Date.now() - t0,
    ...digest(turns, { now, keepDays }),
  };
}
