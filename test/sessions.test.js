import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProcStartUtc, encodeCwd } from '../src/collect/sessions.js';

/**
 * Bẫy múi giờ — đã sập một lần rồi, nên phải có test giữ.
 *
 * `procStart` trong `~/.claude/sessions/<pid>.json` ghi theo **UTC**, còn `ps lstart`
 * in theo giờ **địa phương**. So chuỗi trực tiếp thì KHÔNG phiên nào khớp và cả
 * dashboard hiện "0 phiên sống" — mà im lặng, trông y hệt như thật sự không có phiên nào.
 */

test('procStart được đọc là UTC, không phải giờ máy', () => {
  const t = parseProcStartUtc('Thu Jul 23 04:00:55 2026');
  assert.equal(t, Date.parse('2026-07-23T04:00:55Z'));
});

test('cùng một mốc, đọc theo giờ máy sẽ lệch — đây chính là cái bug cũ', () => {
  const s = 'Thu Jul 23 04:00:55 2026';
  const đúng = parseProcStartUtc(s);
  const sai = Date.parse(s); // cách đọc cũ: để Date.parse tự suy theo giờ máy
  const lệchGiờ = Math.abs(đúng - sai) / 3600000;
  const offsetMáy = new Date('2026-07-23T04:00:55Z').getTimezoneOffset() / -60;
  assert.equal(lệchGiờ, Math.abs(offsetMáy), 'độ lệch phải đúng bằng offset của máy chạy test');
});

test('chuỗi hỏng hoặc thiếu trả null chứ không phải NaN', () => {
  assert.equal(parseProcStartUtc(''), null);
  assert.equal(parseProcStartUtc(null), null);
  assert.equal(parseProcStartUtc(undefined), null);
  assert.equal(parseProcStartUtc('không phải ngày'), null);
});

test('ngưỡng lệch 2 giây: ps làm tròn tới giây nên phải cho phép sai số', () => {
  const base = parseProcStartUtc('Thu Jul 23 04:00:55 2026');
  const alive = (ps) => Math.abs(ps - base) <= 2000;

  assert.equal(alive(base), true);
  assert.equal(alive(base + 1500), true, 'lệch 1,5 giây vẫn là cùng một tiến trình');
  assert.equal(alive(base + 2000), true, 'đúng ngưỡng thì vẫn tính là sống');
  assert.equal(alive(base + 2001), false, 'quá ngưỡng là PID đã được cấp lại cho tiến trình khác');
});

test('encodeCwd khớp cách Claude Code đặt tên thư mục transcript', () => {
  assert.equal(
    encodeCwd('/Users/hoanluu/Projects/local/now_dashboard'),
    '-Users-hoanluu-Projects-local-now-dashboard',
    'gạch dưới trong tên thư mục cũng thành gạch ngang — sai chỗ này là mất tên phiên',
  );
});
