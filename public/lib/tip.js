/**
 * Tooltip có cấu trúc.
 *
 * Trước đây `data-tip` là một câu văn xuôi và `showTip` đổ thẳng vào `textContent`:
 * *"now_dashboard — 1,9M sinh ra, 24 lượt gọi, $2.15 ước tính"*. Câu đó đọc được, nhưng
 * đọc TUẦN TỰ — muốn biết một con số thì phải quét cả dòng, và ba tooltip cạnh nhau
 * không so được với nhau vì mỗi con số rơi vào một chỗ khác nhau trên dòng.
 *
 * Tooltip là bảng số thu nhỏ chứ không phải một câu, nên ở đây nó được đóng gói thành
 * **nhãn ↔ trị**: nhãn xếp cột trái, trị xếp cột phải bằng font mono, cùng vị trí ở mọi
 * tooltip. Liếc là thấy, và hai tooltip liền nhau so được theo hàng.
 *
 * Định dạng chuỗi (phải nhét vừa một thuộc tính HTML, nên không dùng JSON — dấu nháy
 * kép trong JSON bị escape thành `&quot;` làm chuỗi dài gấp rưỡi và không đọc nổi khi
 * xem DOM):
 *
 * ```
 * dòng 0          tiêu đề
 * nhãn \t trị     một hàng
 * nhãn \t trị \t giọng
 * chữ không tab   một dòng ghi chú chạy hết bề ngang
 * ```
 *
 * Chuỗi KHÔNG chứa tab nào thì là chuỗi cũ, chưa chuyển đổi — nó vẫn hiện nguyên như
 * trước (tách theo ` · ` cho dễ đọc, không có tiêu đề). Nhờ vậy chuyển đổi được từng
 * chỗ một, không phải sửa hết mọi call site trong một lần.
 */

const ROW = '\n';
const CELL = '\t';

/** Dải phân cách của lối viết cũ — mỗi mẩu thành một dòng thay vì dính thành một câu. */
const LEGACY_SEP = ' · ';

/**
 * Đóng gói một tooltip.
 *
 * `rows` là mảng `[nhãn, trị, giọng?]`. Hàng nào không có trị thì bị bỏ — chỗ gọi khỏi
 * phải tự lọc, và một tooltip có ô trống trông như đang hỏng chứ không như đang thiếu.
 */
export function tipOf({ head = '', rows = [], note = '' }) {
  const lines = [String(head)];
  for (const r of rows ?? []) {
    if (!r) continue;
    const [k, v, tone] = r;
    if (v == null || v === '') continue;
    // `filter(Boolean)` ở đây là sai, và sai đúng vào SỐ 0: `['Lượt ghi lại', 0]` bị lọc
    // thành `['Lượt ghi lại']`, ra một hàng có nhãn mà không có trị — trông như tooltip
    // đang hỏng. Chỉ `tone` được phép vắng, nên chỉ nó cần lọc.
    //
    // Nằm im được lâu vì hầu hết chỗ gọi đã đi qua một hàm định dạng (`tok`, `usd`,
    // `pctText`) và nhận về CHUỖI "0" — chuỗi ấy truthy. Chart hâm-lại-cache là chỗ đầu
    // tiên đưa số nguyên thô vào, mà 0 ở đó lại là con số đáng đọc nhất bảng: "nghỉ 40
    // phút, không lượt nào phải ghi lại".
    lines.push(tone ? [k, v, tone].join(CELL) : [k, v].join(CELL));
  }
  if (note) lines.push(String(note));
  return lines.join(ROW);
}

/** Thêm một hàng vào tooltip đã đóng gói. Trị rỗng thì trả nguyên chuỗi cũ. */
export const addRow = (s, k, v) => (v == null || v === '' ? s : `${s}${ROW}${k}${CELL}${v}`);

/** Bung chuỗi ra lại. Chuỗi cũ (không tab) về nhánh `notes`. */
export function parseTip(s) {
  const text = String(s ?? '');
  if (!text.includes(CELL)) return { head: '', rows: [], notes: text ? text.split(LEGACY_SEP) : [] };
  const [head, ...rest] = text.split(ROW);
  const rows = [];
  const notes = [];
  for (const line of rest) {
    if (!line) continue;
    if (!line.includes(CELL)) {
      notes.push(line);
      continue;
    }
    const [k, v, tone = ''] = line.split(CELL);
    rows.push({ k, v, tone });
  }
  return { head, rows, notes };
}

/**
 * Bản một dòng, cho `aria-label`.
 *
 * Trình đọc màn hình đọc thẳng thuộc tính chứ không đi qua `showTip`, nên nó cần đúng
 * nội dung ấy ở dạng câu — tab và xuống dòng trong `aria-label` bị nuốt thành khoảng
 * trắng, và "Đã tiêu 30% Trung bình 59%" là hai con số dính liền không biết đâu là đâu.
 */
export function flatTip(s) {
  const { head, rows, notes } = parseTip(s);
  const body = [...rows.map((r) => `${r.k}: ${r.v}`), ...notes].join(LEGACY_SEP);
  if (head && body) return `${head} — ${body}`;
  return head || body;
}
