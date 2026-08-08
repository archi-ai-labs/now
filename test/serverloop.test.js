import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Hai nhịp nền phải nằm rời nhau — canh bằng cách ĐỌC mã nguồn, không import.
 *
 * `server.js` mở cổng và hẹn giờ ngay lúc nạp, nên import nó trong test là dựng một
 * server thật rồi phải đi dọn. Thứ cần canh ở đây lại là hình dạng của mã chứ không phải
 * hành vi lúc chạy, nên đọc file là đủ và rẻ hơn nhiều.
 *
 * Vì sao đáng canh: `B18` (giãn nhịp quét lúc vắng người xem) nằm chờ đúng vì hai việc
 * này từng đi chung một `setInterval`. Gộp lại lần nữa thì mốc nghỉ giãn theo nhịp quét,
 * và nó hỏng đúng ở ca "làm ba tiếng không mở tab nào" — ca duy nhất mốc nghỉ tồn tại để
 * phục vụ. Đó là một lỗi không có triệu chứng nào trên màn hình: mọi thứ vẫn chạy, chỉ có
 * thanh tập trung là lặng lẽ ngừng biết mình đã nghỉ.
 */

const SRC = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server.js'),
  'utf8',
);

/** Cả khối máy móc của nhịp quét: từ lúc khai báo hàm tới lượt gọi khởi động nó. */
function scanRegion() {
  const from = SRC.indexOf('function scheduleScan()');
  const to = SRC.indexOf('\nscheduleScan();');
  assert.ok(from > 0, 'không thấy `function scheduleScan()` — test này đã lạc khỏi mã');
  assert.ok(to > from, 'không thấy lượt gọi khởi động `scheduleScan()`');
  return SRC.slice(from, to);
}

test('nhịp quét không đụng gì tới lớp trò chơi', () => {
  const region = scanRegion();
  assert.ok(!region.includes('withPet'), 'mốc nghỉ lọt vào nhịp quét — đúng cái `B18` vừa gỡ ra');
  assert.ok(!region.includes('petLock'), 'hàng đợi sổ pet lọt vào nhịp quét');
});

test('mốc nghỉ có hẹn giờ riêng, chu kỳ cố định', () => {
  const after = SRC.slice(SRC.indexOf('\nscheduleScan();'));
  assert.ok(after.includes('withPet'), 'mốc nghỉ phải nằm NGOÀI nhịp quét');
  assert.ok(/setInterval\([\s\S]{0,200}?withPet[\s\S]{0,200}?\}, PET_MS\)/.test(after), 'mốc nghỉ phải chạy theo PET_MS');
  assert.match(SRC, /const PET_MS = 30_000;/, 'mốc nghỉ giữ 30 giây — không giãn theo số tab');
});

test('nhịp quét đọc số tab ở MỖI lượt, nên phải là setTimeout tự hẹn lại', () => {
  const region = scanRegion();
  assert.ok(region.includes('setTimeout'), 'setInterval không đổi được chu kỳ giữa chừng');
  assert.ok(region.includes('scheduleScan()'), 'thiếu lượt tự hẹn lại thì nhịp nền chạy đúng một lần');
  assert.ok(region.includes('clients.size'), 'chu kỳ phải đọc số client SSE, không phải một hằng số');
});

test('một lượt quét ném lỗi không được giết cả nhịp nền', () => {
  // Cái hẹn kế tiếp nằm SAU chỗ có thể ném. Bản `setInterval` cũ không cần bắt lỗi vì
  // lượt sau vẫn tới; bản tự-hẹn-lại thì một lỗi lọt ra là im lặng dừng hẳn.
  const region = scanRegion();
  assert.ok(/catch\s*\(/.test(region), 'thiếu try/catch — một lượt hỏng là tắt nhịp nền vĩnh viễn');
});

test('lúc vắng người xem thì nhịp thưa hơn, và cả hai số đều nói ra được', () => {
  const m = SRC.match(/const SCAN_MS = \{ watched: ([\d_]+), idle: ([\d_]+) \};/);
  assert.ok(m, 'không đọc được SCAN_MS');
  const watched = Number(m[1].replace(/_/g, ''));
  const idle = Number(m[2].replace(/_/g, ''));
  assert.equal(watched, 30_000, 'có người xem thì giữ nhịp 30 giây như cũ');
  assert.equal(idle, 60_000, 'không ai xem thì 1 phút');
  assert.ok(idle > watched, 'giãn nhịp mà lại dày hơn thì cả mục này vô nghĩa');
});
