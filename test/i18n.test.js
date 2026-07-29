import test from 'node:test';
import assert from 'node:assert/strict';
import { tableOf } from '../public/lib/i18n.js';

/**
 * VI và EN phải có ĐÚNG cùng một bộ khoá.
 *
 * Test này tồn tại vì `t()` **im lặng rơi về tiếng Việt** khi khoá EN vắng mặt. Hành vi
 * ấy đúng lúc chạy thật — thiếu một chuỗi thì hiện tiếng Việt còn hơn hiện mã khoá —
 * nhưng nó nuốt mất lỗi: thêm một màn mới với ba chục chuỗi mà quên nửa bản EN thì không
 * có gì đỏ, không có gì log. Màn tiếng Anh chỉ đơn giản là chêm tiếng Việt vào giữa, và
 * người duy nhất phát hiện ra là người dùng tiếng Anh.
 */

const vi = tableOf('vi');
const en = tableOf('en');

test('VI và EN có cùng bộ khoá', () => {
  // Bảng teo lại về rỗng thì hai phép so dưới đây "xanh" vì không so gì cả.
  assert.ok(Object.keys(vi).length > 500, `bảng VI chỉ có ${Object.keys(vi).length} khoá — có vẻ đã hụt`);

  assert.deepEqual(
    Object.keys(vi).filter((k) => !(k in en)),
    [],
    'khoá có ở VI mà thiếu ở EN — màn tiếng Anh sẽ lặng lẽ hiện tiếng Việt',
  );
  // Chiều ngược lại cũng là lỗi, kiểu khác: một khoá chỉ có ở EN là chuỗi chết. Mọi chỗ
  // gọi đều bắt nguồn từ bản VI, nên không lối nào tới được nó.
  assert.deepEqual(
    Object.keys(en).filter((k) => !(k in vi)),
    [],
    'khoá chỉ có ở EN — chuỗi chết, không lối nào tới được',
  );
});

test('mỗi khoá cùng KIỂU ở hai ngôn ngữ', () => {
  // Hàm ở bên này, chuỗi trơ ở bên kia là lỗi khó thấy nhất trong bảng chuỗi: cả hai đều
  // hiện ra chữ, chỉ khác là một bên đã ghép tham số còn bên kia chưa. Chuỗi CÓ chỗ trống
  // `{n}` thì `t()` vẫn thay được, nên đối lập thật sự chỉ nằm ở kiểu.
  const bad = Object.keys(vi)
    .filter((k) => k in en && typeof vi[k] !== typeof en[k])
    .map((k) => `${k}: vi=${typeof vi[k]} en=${typeof en[k]}`);
  assert.deepEqual(bad, []);
});

test('phần Cursor + Antigravity có đủ chuỗi ở cả hai ngôn ngữ', () => {
  // Hai tab ngoài-Claude của màn Token — nơi duy nhất nói về hai nguồn dữ liệu không phải
  // của Anthropic, và là chỗ dễ quên một nhánh lỗi nhất. Kiểm riêng để lỗi chỉ ra thẳng
  // chỗ, thay vì lẫn trong hơn 550 khoá.
  const keys = Object.keys(vi).filter((k) => k.startsWith('tools.'));
  assert.ok(keys.length >= 30, `mới có ${keys.length} khoá tools.*`);
  assert.deepEqual(keys.filter((k) => !(k in en)), []);
  // Nhãn ba khối hạn mức không còn là ba khoá riêng: tên nguồn là danh từ riêng nên
  // `srcLabel` chêm thẳng vào, chỉ phần đuôi được dịch. Kiểm đúng cái đuôi ấy.
  for (const k of ['quota.titleTail', 'usage.tabClaude', 'usage.tabCursor', 'usage.tabAg']) {
    assert.ok(k in vi && k in en, `thiếu ${k}`);
  }
});

test('màn Công cụ đã gộp — không còn khoá mồ côi nào của nó', () => {
  // Màn Công cụ bị gộp vào màn Token. Chuỗi của một màn không còn tồn tại thì không có gì
  // báo: `t()` không bao giờ được gọi tới chúng, nên chúng nằm im trong bảng và đi theo
  // mọi lượt tải trang. Cả hai bảng phải sạch cùng lúc.
  for (const k of ['nav.tools', 'title.tools', 'viewname.tools', 'report.howTools', 'tools.intro', 'tools.claudeSection']) {
    assert.ok(!(k in vi) && !(k in en), `khoá chết còn sót: ${k}`);
  }
});
