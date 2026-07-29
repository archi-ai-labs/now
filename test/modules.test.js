import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Mọi module phía client phải NẠP ĐƯỢC.
 *
 * Test này tồn tại vì một lỗi đã lọt: một comment HTML bên trong template `html` có chứa
 * backtick, và backtick đó đóng luôn chuỗi — cả `views/usage.js` thành lỗi cú pháp. Toàn
 * bộ 207 test lúc ấy vẫn xanh, vì không test nào import một file trong `public/views/`;
 * `npm test` báo sạch trong khi màn hình chỉ hiện "đang nối…" và console không có một dòng
 * nào (script module hỏng cú pháp thì không có gì chạy để mà log).
 *
 * Nên đây là lưới chặn rẻ nhất có thể cho cả một lớp lỗi: chỉ import, không kiểm hành vi.
 * Nó bắt lỗi cú pháp, import sai tên, import vòng, và cả lỗi lúc nạp module — bốn thứ mà
 * mọi test khác trong bộ này không thể bắt vì chúng không chạm tới các file đó.
 *
 * Danh sách tự quét thư mục, không viết tay: file mới thêm vào là tự được che, không phải
 * nhớ cập nhật một danh sách — mà lưới chặn cần được nhớ mới hoạt động thì không phải lưới.
 */

const ROOT = path.join(import.meta.dirname, '..', 'public');

const jsIn = (dir) =>
  fs
    .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.js'))
    .map((e) => `${dir}/${e.name}`);

const FILES = [...jsIn('lib'), ...jsIn('views'), 'app.js'];

test('quét được cả hai thư mục module client', () => {
  // Nếu cây thư mục đổi mà bộ chọn ở trên không đổi theo thì danh sách teo lại về rỗng và
  // test dưới "xanh" vì không kiểm gì cả — im lặng đúng kiểu tệ nhất.
  assert.ok(FILES.length >= 15, `chỉ tìm thấy ${FILES.length} module, bộ chọn có vẻ đã hụt`);
  assert.ok(FILES.includes('views/usage.js'));
  assert.ok(FILES.includes('lib/report.js'));
});

for (const rel of FILES) {
  // `app.js` gắn listener vào `document` ngay lúc nạp, nên ở Node nó luôn ném — với nó thì
  // chỉ kiểm CÚ PHÁP, tức là đúng cái lớp lỗi đã lọt. Lỗi cú pháp xảy ra lúc BIÊN DỊCH, tức
  // là trước khi thân module chạy, nên hai loại lỗi phân biệt được rạch ròi.
  test(`${rel} — ${rel === 'app.js' ? 'cú pháp hợp lệ' : 'nạp được'}`, async () => {
    try {
      await import(new URL(`file://${path.join(ROOT, rel)}`).href);
    } catch (err) {
      assert.ok(!(err instanceof SyntaxError), `lỗi cú pháp trong ${rel}: ${err.message}`);
      // Chỉ `app.js` được phép ném vì lý do khác (chạm `document` lúc nạp). Module nào khác
      // mà ném thì đó là lỗi thật: không có gì trong `lib/` hay `views/` được chạy tác dụng
      // phụ lúc nạp — chúng phải nạp được ở cả Node lẫn trình duyệt.
      if (rel !== 'app.js') throw err;
    }
  });
}
