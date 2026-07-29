import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from '../public/lib/report.js';

/* ── Báo cáo dán được ───────────────────────────────────────────────────────────
 *
 * Chỉ tầng THUẦN được test ở đây. `scrapeView` chạm DOM nên nó phải chạy trong trình
 * duyệt; đổi lại nó cố tình mỏng (đọc `textContent`, không tính toán gì), còn chỗ dễ
 * sai — thoát ký tự bảng, hàng thiếu ô, khối rỗng — nằm hết ở tầng này.
 */

const at = '19:30';

test('báo cáo mở đầu bằng tên màn, dấu thời gian và khối cách đọc', () => {
  const md = renderReport({ view: 'usage', at, blocks: [] });
  assert.match(md, /^# NOW dashboard — Token/, 'dòng đầu phải nói đây là màn nào');
  assert.ok(md.includes(at), 'phải mang dấu thời gian của dữ liệu');
  assert.match(md, /ƯỚC TÍNH/, 'màn Token phải kèm cảnh báo tiền là ước tính');
  assert.match(md, /gói thuê bao/, 'và nói rõ tài khoản trả theo gói, không theo lượt');
});

test('màn không có khối cách đọc riêng thì không mượn của màn khác', () => {
  const md = renderReport({ view: 'health', at, blocks: [] });
  assert.ok(!md.includes('ƯỚC TÍNH'), 'cảnh báo tiền chỉ đúng ở màn Token');
  assert.match(md, /^# NOW dashboard — /, 'vẫn phải có tiêu đề');
});

test('chart thành tiêu đề + phụ đề + bảng Markdown đủ cột', () => {
  const md = renderReport({
    view: 'usage',
    at,
    blocks: [
      {
        kind: 'chart',
        title: 'Chi phí ước tính theo ngày',
        sub: '15 ngày · tổng $4.535',
        notes: ['trần trên'],
        cols: ['Ngày', 'Ước tính', 'Lượt gọi'],
        rows: [
          ['2026-07-25', '$612', '2.000'],
          ['2026-07-26', '$533', '2.922'],
        ],
      },
    ],
  });
  assert.match(md, /### Chi phí ước tính theo ngày/);
  assert.match(md, /_15 ngày · tổng \$4\.535_/, 'phụ đề mang mẫu số, không được rơi');
  assert.match(md, /> trần trên/, 'ghi chú của chart đi cùng chart');
  assert.match(md, /\| Ngày \| Ước tính \| Lượt gọi \|/);
  assert.match(md, /\| --- \| --- \| --- \|/);
  assert.match(md, /\| 2026-07-26 \| \$533 \| 2\.922 \|/);
});

test('hàng thiếu ô được đệm cho đủ cột', () => {
  // Bảng Markdown lệch số cột thì bên nhận dồn cột sai, và mọi trị sau đó bị đọc dưới
  // nhãn của cột khác — sai lặng lẽ, tệ hơn hẳn thiếu một ô trống.
  const md = renderReport({
    view: 'usage',
    at,
    blocks: [{ kind: 'chart', title: 'X', sub: '', cols: ['a', 'b', 'c'], rows: [['1']] }],
  });
  const row = md.split('\n').find((l) => l.startsWith('| 1 '));
  assert.equal(row, '| 1 |  |  |');
});

test('dấu | trong nội dung được thoát, không cắt hàng thành thêm cột', () => {
  const md = renderReport({
    view: 'usage',
    at,
    blocks: [{ kind: 'chart', title: 'X', sub: '', cols: ['Tên', 'Sinh ra'], rows: [['a|b', '1K']] }],
  });
  const row = md.split('\n').find((l) => l.startsWith('| a'));
  assert.equal(row, '| a\\|b | 1K |');
});

test('chart chưa có bảng số thì vẫn còn tiêu đề, không sinh bảng rỗng', () => {
  const md = renderReport({
    view: 'usage',
    at,
    blocks: [{ kind: 'chart', title: 'Trả thêm vì cache nguội', sub: 'tối đa $165', cols: [], rows: [] }],
  });
  assert.match(md, /### Trả thêm vì cache nguội/);
  assert.ok(!md.includes('---'), 'không có cột thì không được in vạch phân cách');
});

test('khối danh sách in nhãn ↔ trị, kèm phần chi tiết của thẻ hạn mức', () => {
  const md = renderReport({
    view: 'usage',
    at,
    blocks: [
      {
        kind: 'list',
        title: 'Hạn mức',
        rows: [
          { label: '5 giờ', val: 'reset sau 2 giờ', detail: 'Đã tiêu: 30% · Dự phóng: 51%' },
          { label: '7 ngày', val: '', detail: 'Đã tiêu: 42%' },
        ],
        notes: ['số chốt lúc 19:28'],
      },
    ],
  });
  assert.match(md, /## Hạn mức/);
  assert.match(md, /- \*\*5 giờ\*\*: reset sau 2 giờ — Đã tiêu: 30% · Dự phóng: 51%/);
  assert.match(md, /- \*\*7 ngày\*\*: Đã tiêu: 42%$/m, 'ô rỗng không được để lại dấu gạch trống');
  assert.match(md, /> số chốt lúc 19:28/);
});

test('không có dòng trống ba lần liền, và không mở đầu/kết thúc bằng khoảng trắng', () => {
  const md = renderReport({
    view: 'usage',
    at,
    blocks: [
      { kind: 'sec', title: 'A' },
      { kind: 'note', text: '' },
      { kind: 'chart', title: 'B', sub: '', cols: [], rows: [] },
      { kind: 'note', text: 'cuối' },
    ],
  });
  assert.ok(!md.includes('\n\n\n'), 'ghép khối không được để lại dòng trống dồn cục');
  assert.equal(md, md.trim());
});
