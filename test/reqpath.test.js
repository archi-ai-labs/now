import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reqUrl } from '../src/reqpath.js';

/**
 * Địa chỉ của một request — và hai cái bẫy của hai dấu gạch chéo.
 *
 * Ca thật, 10/8: `GET //` trả **500** kèm log `Invalid URL`. Nguyên nhân không nằm ở dấu
 * gạch thừa mà ở chỗ `req.url` bị đối xử như một URL trọn vẹn — xem khối đầu
 * `src/reqpath.js`. Bài test này canh cả hai vế: cái ném (`//`) phải thành 400, và cái
 * KHÔNG ném (`//lib/pet.js`, phân giải ra một máy chủ khác) cũng phải thành 400 — vế thứ
 * hai mới là vế lặng lẽ, vì hôm nay nó chỉ trả sai một cái 404.
 */

test('đường dẫn thường: giữ nguyên phần đường và phần truy vấn', () => {
  assert.equal(reqUrl('/')?.pathname, '/');
  assert.equal(reqUrl('/api/state')?.pathname, '/api/state');
  const u = reqUrl('/api/state?force=1&wait=2');
  assert.equal(u.pathname, '/api/state');
  assert.equal(u.searchParams.get('force'), '1');
  assert.equal(u.searchParams.get('wait'), '2');
  // Hai dấu gạch Ở GIỮA thì vô hại — chỉ dấu gạch mở đầu mới đổi nghĩa.
  assert.equal(reqUrl('/lib//pet.js')?.pathname, '/lib//pet.js');
});

test('`//` KHÔNG được phép làm sập một lượt phục vụ — đúng ca 10/8', () => {
  assert.equal(reqUrl('//'), null);
  // Và phép cũ thật sự ném ở đây: giữ lại câu này để lần sau ai đó "đơn giản hoá" bằng
  // cách gọi thẳng `new URL` thì thấy ngay vì sao chỗ này không đơn giản.
  assert.throws(() => new URL('//', 'http://localhost'));
});

test('`//máy-chủ/đường-dẫn` bị chặn — nó phân giải ra một chỗ KHÁC chỗ client hỏi', () => {
  // Không ném, nên không lưới nào bắt được: bộ định tuyến sẽ thấy `/pet.js`.
  assert.equal(new URL('//lib/pet.js', 'http://localhost').host, 'lib');
  assert.equal(new URL('//lib/pet.js', 'http://localhost').pathname, '/pet.js');
  assert.equal(reqUrl('//lib/pet.js'), null);
  assert.equal(reqUrl('//evil.example.com/api/state'), null);
});

test('rác thì trả null, không ném — 400 là câu trả lời, không phải sự cố', () => {
  for (const bad of ['', 'api/state', '*', 'http://', 'ftp://host/x', null, undefined, 42, {}]) {
    assert.equal(reqUrl(bad), null, `${JSON.stringify(bad)} phải ra null`);
  }
});

test('absolute-form của proxy vẫn đọc được — phép cũ nhận nó, phép mới không được bỏ', () => {
  assert.equal(reqUrl('http://localhost:4400/api/pet')?.pathname, '/api/pet');
  assert.equal(reqUrl('https://example.com/api/state?force=1')?.searchParams.get('force'), '1');
});

/**
 * `/%` vẫn phải đi lọt qua cửa này.
 *
 * Nó là địa chỉ hỏng ở tầng KHÁC — hỏng lúc giải mã phần trăm, không hỏng lúc phân giải —
 * và `serveStatic` đã có nhánh 400 riêng cho nó từ trước (cùng một ca: trước đây nó giết
 * cả tiến trình). Chặn sớm ở đây thì hai nhánh cùng canh một thứ, mà nhánh kia mới là
 * nhánh biết mình đang phục vụ file.
 */
test('`/%` không bị chặn ở tầng này — nó có cửa 400 của riêng nó trong serveStatic', () => {
  assert.equal(reqUrl('/%')?.pathname, '/%');
});

test('server.js không còn tự gọi `new URL(req.url, …)` nữa', () => {
  // Canh bằng cách đọc mã: `server.js` mở cổng ngay lúc nạp nên không import được vào đây
  // (cùng lý lẽ đã ghi ở `serverloop.test.js`), mà thứ cần giữ lại đúng là hình dạng —
  // một chỗ nào đó dựng lại `new URL` từ `req.url` là cái 500 quay về.
  const src = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server.js'),
    'utf8',
  );
  assert.doesNotMatch(src, /new URL\(\s*req\.url/, 'req.url phải đi qua reqUrl()');
  assert.match(src, /reqUrl\(req\.url\)/);
});
