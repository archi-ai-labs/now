/**
 * Đọc protobuf ở mức DÂY, không cần file `.proto`.
 *
 * Antigravity cất sổ mục lục hội thoại dưới dạng protobuf nhị phân và không công bố
 * schema. Nhưng wire format thì tự mô tả đủ để đi lại: mỗi trường mang theo SỐ HIỆU và
 * KIỂU DÂY, nên vẫn bóc ra được cây `{số hiệu → giá trị}` mà không cần biết trường đó
 * tên gì. Cái không suy ra được là NGHĨA — chỗ đó nằm ở `collect/antigravity.js`, đọc
 * hoàn toàn phòng thủ.
 *
 * Bốn kiểu dây gặp ngoài đời: 0 (varint), 1 (64 bit), 2 (độ dài kèm trước), 5 (32 bit).
 * Kiểu 3/4 là group — đã bị bỏ từ proto2 và không xuất hiện ở đây; gặp thì dừng đọc
 * chứ không đoán, vì đọc tiếp sau một byte không hiểu là sinh ra rác trông như dữ liệu.
 */

/** Đọc một varint từ `b` tại `i`. Trả `[giá trị, vị trí kế]`, hoặc `null` nếu cụt. */
function varint(b, i) {
  let r = 0n;
  let s = 0n;
  for (let n = 0; n < 10; n++) {
    if (i >= b.length) return null;
    const x = b[i++];
    r |= BigInt(x & 0x7f) << s;
    if (!(x & 0x80)) return [r, i];
    s += 7n;
  }
  return null; // varint dài quá 10 byte = dữ liệu hỏng
}

/**
 * Bóc một message thành `Map<số hiệu, mảng giá trị>`.
 *
 * Luôn là MẢNG, kể cả trường chỉ xuất hiện một lần: proto cho phép lặp lại bất kỳ
 * trường nào, và chọn "lần cuối thắng" ở tầng này là âm thầm vứt dữ liệu. Chỗ gọi tự
 * quyết lấy cái nào.
 *
 * Không bao giờ ném: dữ liệu hỏng giữa chừng thì trả về phần đã đọc được.
 */
export function decode(buf) {
  const out = new Map();
  let i = 0;
  while (i < buf.length) {
    const key = varint(buf, i);
    if (!key) break;
    let [k, next] = key;
    i = next;
    const field = Number(k >> 3n);
    const wire = Number(k & 7n);
    if (!field) break; // số hiệu 0 không hợp lệ — chắc chắn đã lệch khung

    let value;
    if (wire === 0) {
      const v = varint(buf, i);
      if (!v) break;
      [value, i] = [v[0], v[1]];
    } else if (wire === 2) {
      const len = varint(buf, i);
      if (!len) break;
      const n = Number(len[0]);
      i = len[1];
      if (n < 0 || i + n > buf.length) break;
      value = buf.subarray(i, i + n);
      i += n;
    } else if (wire === 5) {
      if (i + 4 > buf.length) break;
      value = buf.readUInt32LE(i);
      i += 4;
    } else if (wire === 1) {
      if (i + 8 > buf.length) break;
      value = buf.readBigUInt64LE(i);
      i += 8;
    } else {
      break; // group hoặc kiểu dây lạ — dừng, đừng đoán
    }

    if (!out.has(field)) out.set(field, []);
    out.get(field).push(value);
  }
  return out;
}

/** Mọi giá trị của một trường; mảng rỗng khi vắng mặt. */
export const all = (msg, field) => msg?.get(field) ?? [];

/** Giá trị đầu tiên của một trường, hoặc `undefined`. */
export const one = (msg, field) => all(msg, field)[0];

/** Trường kiểu message con, đã giải mã. `null` khi vắng mặt hoặc không phải bytes. */
export function sub(msg, field) {
  const v = one(msg, field);
  return Buffer.isBuffer(v) ? decode(v) : null;
}

/** Trường kiểu chuỗi. `null` khi vắng mặt hoặc không phải bytes. */
export function str(msg, field) {
  const v = one(msg, field);
  return Buffer.isBuffer(v) ? v.toString('utf8') : null;
}

/** Trường kiểu số nguyên, ép về `Number`. `null` khi vắng mặt. */
export function int(msg, field) {
  const v = one(msg, field);
  if (typeof v === 'bigint') return Number(v);
  return typeof v === 'number' ? v : null;
}

/**
 * `google.protobuf.Timestamp` → mili-giây.
 *
 * Trường 1 là giây, trường 2 là nano. Bỏ qua nano là mất độ chính xác dưới giây —
 * không sao ở đây — nhưng bỏ qua việc KIỂM TRA giây thì một message rỗng sẽ ra mốc
 * 1970, và mốc 1970 trên giao diện đọc thành "56 năm trước", tức là một lời nói dối
 * trông rất tự tin.
 */
export function timestampMs(msg, field) {
  const t = sub(msg, field);
  const secs = int(t, 1);
  if (!secs) return null;
  return secs * 1000 + Math.round((int(t, 2) ?? 0) / 1e6);
}
