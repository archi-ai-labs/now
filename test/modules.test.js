import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// `import.meta.dirname` chỉ có từ Node 20.11, mà package.json khai sàn là 18.10 — trên 18
// nó là `undefined` và `path.join` ném ngay lúc nạp, giết cả file test. Dạng dưới đây chạy
// từ 18 trở đi, nên CI canh được đúng cái sàn mà badge đang hứa.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

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

/**
 * GỌI TÊN cái bẫy, chứ không chỉ bắt được nó.
 *
 * Lưới ở dưới đã bắt lớp lỗi này ngay từ lần đầu, và nó vẫn là lưới chính. Chỗ nó hụt là
 * chỗ khác: nó báo về đúng thứ mà trình biên dịch nhìn thấy — `Unexpected identifier 'left'`
 * — tức là con chữ ĐẦU TIÊN sau dấu backtick, thường cách nguyên nhân vài chục dòng và
 * không dính dáng gì tới nó. Lượt 20 mất một vòng vì thế, lượt 21 mất thêm một vòng nữa.
 *
 * Nên có thêm một phép quét chỉ để đặt tên: tìm khối chú thích HTML nào còn backtick, chỉ
 * ra số dòng, và nói thẳng phải làm gì. Nó không thay lưới kia — một dấu backtick lọt vào
 * chỗ khác trong template vẫn chỉ có lưới kia bắt được.
 *
 * Quét cả file chứ không riêng phần trong template: một khối `<!-- -->` trong mã client thì
 * gần như chắc chắn nằm trong một template `html`, và phân biệt cho đúng đòi hỏi một bộ
 * phân tích cú pháp — đắt hơn hẳn thứ nó mua về. Chú thích HTML ngoài template là thứ không
 * ai viết, nên báo nhầm là ca không tồn tại.
 */
test('không backtick nào trong chú thích HTML — nó ĐÓNG luôn template', () => {
  const hits = [];
  for (const rel of FILES) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const m of src.matchAll(/<!--[\s\S]*?-->/g)) {
      if (!m[0].includes('`')) continue;
      hits.push(`${rel}:${src.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.deepEqual(
    hits,
    [],
    `backtick trong chú thích HTML tại ${hits.join(', ')} — nó đóng luôn chuỗi template và ` +
      'cả module thành lỗi cú pháp. Bỏ hết backtick trong khối đó, viết tên class và tên file trần.',
  );
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

/* ── Bản nhớ trạng thái ─────────────────────────────────────────────────────── */

/**
 * Luật tuổi của bản nhớ dashboard — xem `lib/statecache.js`.
 *
 * Nó ở đây chứ không trong `pet.test.js` vì nó không dính gì tới trò chơi, và ở đây thì file
 * đã sẵn nhập `fs`/`path` cho mấy phép quét module.
 *
 * Ca đáng canh nhất là ca đã mắc thật lúc dựng: `/api/state` trả `generatedAt` là SỐ mili
 * giây, còn sổ quản gia trả chuỗi ISO. Một hàm chỉ biết `Date.parse` ra `NaN` cho dạng số rồi
 * lặng lẽ lùi về mốc GHI — tức là bản nhớ của tám tiếng trước vẫn được coi là tươi, đúng cái
 * ca mà trần 90 phút sinh ra để chặn.
 */
const { STALE_MAX_MS, freshEnough } = await import(
  new URL(`file://${path.join(ROOT, 'lib/statecache.js')}`).href
);

test('bản nhớ: tuổi đếm từ generatedAt, nhận cả số lẫn chuỗi ISO', () => {
  const now = 1_700_000_000_000;
  const old = now - STALE_MAX_MS - 60_000;

  // Mốc GHI mới tinh, nhưng SỐ LIỆU thì cũ — đây là tab mở suốt buổi mà server đã im.
  const staleNum = { at: now, state: { generatedAt: old } };
  const staleIso = { at: now, state: { generatedAt: new Date(old).toISOString() } };
  assert.equal(freshEnough(staleNum, now), false, 'generatedAt dạng SỐ mà quá hạn vẫn phải bị loại');
  assert.equal(freshEnough(staleIso, now), false, 'generatedAt dạng ISO mà quá hạn vẫn phải bị loại');

  const fresh = now - STALE_MAX_MS + 60_000;
  assert.equal(freshEnough({ at: now, state: { generatedAt: fresh } }, now), true);
  assert.equal(freshEnough({ at: now, state: { generatedAt: new Date(fresh).toISOString() } }, now), true);
});

test('bản nhớ: không có generatedAt thì lùi về mốc ghi, và rỗng thì loại', () => {
  const now = 1_700_000_000_000;
  assert.equal(freshEnough({ at: now - 60_000, state: { stats: {} } }, now), true, 'sổ bản cũ vẫn dùng được');
  assert.equal(freshEnough({ at: now - STALE_MAX_MS - 1, state: { stats: {} } }, now), false);
  assert.equal(freshEnough(null, now), false);
  assert.equal(freshEnough({ at: now }, now), false, 'hộp không có sổ thì không phải một bản nhớ');
});
