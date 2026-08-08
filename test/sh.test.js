import test from 'node:test';
import assert from 'node:assert/strict';
import { runDetail, run, drainRunFailures } from '../src/lib/sh.js';

/**
 * Test trên tiến trình THẬT, cùng lý do như `git.test.js`: toàn bộ giá trị của `run()`
 * nằm ở chỗ đọc đúng hình dạng lỗi mà Node ném ra từ `execFile`. Mock `execFile` đi thì
 * test chỉ còn khẳng định mock khớp mock — mà chính cái hình dạng ấy là thứ `B13` phân
 * loại, và là thứ sẽ đổi khi nâng Node.
 *
 * `sh -c` có ở mọi máy chạy được repo này, và cả bốn ca dưới chạy dưới 200ms.
 */

// Sổ là trạng thái dùng chung ở mức module. Mỗi test tự dọn trước khi đo, nếu không thì
// thứ tự chạy quyết định kết quả — đúng kiểu test xanh trên máy này, đỏ trên CI.
const fresh = () => drainRunFailures();

test('lệnh chạy được thì không ghi vào sổ hỏng', async () => {
  fresh();
  const r = await runDetail('sh', ['-c', 'printf ok']);
  assert.equal(r.out, 'ok');
  assert.equal(r.failed, false);
  assert.equal(r.reason, null);
  assert.equal(drainRunFailures().total, 0);
});

test('thoát khác 0 là `exit` kèm mã — KHÔNG phải máy hỏng', async () => {
  fresh();
  const r = await runDetail('sh', ['-c', 'exit 3']);
  assert.equal(r.failed, true);
  assert.equal(r.reason, 'exit');
  assert.equal(r.code, 3);
  // Đây là ca của `git rev-parse` trong thư mục không phải repo, tức ca thường gặp nhất
  // trong cả lượt quét. Nó phải đếm vào `total` nhưng KHÔNG vào `broken`, vì màn Sức
  // khoẻ chỉ được kêu ở `broken` — lẫn hai cái là màn ấy ồn ngay ngày đầu.
  const book = drainRunFailures();
  assert.equal(book.total, 1);
  assert.equal(book.broken, 0);
});

test('không có lệnh thì ra `not-found`, không lẫn với thoát khác 0', async () => {
  fresh();
  const r = await runDetail('now-dash-khong-co-lenh-nay', []);
  assert.equal(r.reason, 'not-found');
  const book = drainRunFailures();
  assert.equal(book.broken, 1, 'thiếu lệnh là máy hỏng thật, phải lên màn Sức khoẻ');
  assert.equal(book.rows[0].cmd, 'now-dash-khong-co-lenh-nay');
});

test('quá giờ thì ra `timeout`, không đọc nhầm thành tràn đệm', async () => {
  fresh();
  const r = await runDetail('sh', ['-c', 'sleep 2'], { timeout: 60 });
  assert.equal(r.reason, 'timeout');
  assert.equal(r.out, '', 'cắt ngang thì bỏ luôn phần đã in ra — giữ hành vi cũ');
  assert.equal(drainRunFailures().broken, 1);
});

test('`run()` vẫn trả chuỗi rỗng ở mọi ca hỏng — sáu module đang dựa vào đó', async () => {
  fresh();
  assert.equal(await run('sh', ['-c', 'exit 1']), '');
  assert.equal(await run('now-dash-khong-co-lenh-nay', []), '');
  assert.equal(await run('sh', ['-c', 'printf x']), 'x');
  fresh();
});

test('cùng một kiểu hỏng thì cộng dồn một dòng, không đẻ dòng mới', async () => {
  fresh();
  for (let i = 0; i < 3; i++) await runDetail('sh', ['-c', 'exit 7']);
  const book = drainRunFailures();
  assert.equal(book.rows.length, 1);
  assert.equal(book.rows[0].n, 3);
  assert.equal(book.total, 3);
});

test('vét sổ là dọn sổ — lượt quét sau không được thấy lại lỗi của lượt trước', async () => {
  fresh();
  await runDetail('sh', ['-c', 'exit 1']);
  assert.equal(drainRunFailures().total, 1);
  assert.equal(drainRunFailures().total, 0, 'một lượt hỏng thoáng qua phải tự biến mất');
});

test('sổ không bao giờ chở đối số hay output — `collect/cursor.js` đọc token qua đúng hàm này', async () => {
  fresh();
  await runDetail('sh', ['-c', 'echo bi-mat-khong-duoc-lo; exit 1']);
  const book = drainRunFailures();
  const dump = JSON.stringify(book);
  assert.ok(!dump.includes('bi-mat-khong-duoc-lo'), 'output không được rò vào sổ');
  assert.ok(!dump.includes('echo'), 'đối số không được rò vào sổ');
  assert.deepEqual(Object.keys(book.rows[0]).sort(), ['cmd', 'code', 'n', 'reason', 'sample']);
});

test('cùng một lệnh hỏng ở nhiều repo vẫn là MỘT dòng, kèm một ví dụ', async () => {
  // Ca thật đã đo: bỏ `git` khỏi PATH rồi quét một lượt. Gộp theo cả chỗ xảy ra thì ra
  // 24 dòng y hệt nhau — vừa đúng trần sổ, và người đọc phải tự tìm ra điểm chung.
  fresh();
  const { git } = await import('../src/lib/sh.js');
  await git('/tmp', 'rev-parse');
  await git('/usr', 'rev-parse');
  await git('/etc', 'rev-parse');
  const rows = drainRunFailures().rows;
  assert.equal(rows.length, 1, 'ba repo, một kiểu hỏng → một dòng');
  assert.equal(rows[0].n, 3);
  assert.ok(['/tmp', '/usr', '/etc'].includes(rows[0].sample), 'giữ đúng một chỗ làm ví dụ');
});

test('`sinceMs` là ĐỘ DÀI cửa sổ, không phải một mốc', async () => {
  fresh();
  const book = drainRunFailures(Date.now() + 5000);
  assert.ok(book.sinceMs >= 5000 && book.sinceMs < 6000, `nhận ${book.sinceMs}`);
});
