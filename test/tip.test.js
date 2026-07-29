import test from 'node:test';
import assert from 'node:assert/strict';
import { addRow, flatTip, parseTip, tipOf } from '../public/lib/tip.js';
import { wedge } from '../public/lib/chart.js';

/**
 * Tooltip đi qua một thuộc tính HTML rồi mới quay lại thành DOM, nên nó là một ĐỊNH DẠNG
 * chứ không phải một cấu trúc — và định dạng thì hỏng thầm lặng: một cái tab lọt vào tên
 * dự án là cả tooltip lệch cột mà không có lỗi nào được ném ra.
 *
 * Hai luật giữ ở đây:
 *
 * 1. Đóng gói rồi bung ra phải về đúng chỗ cũ.
 * 2. Chuỗi CŨ (chưa chuyển đổi) vẫn hiện được. Toàn bộ giá trị của cách làm này nằm ở chỗ
 *    chuyển đổi được từng chỗ một; mất tính tương thích ngược thì phải sửa hết trong một
 *    lần, mà "sửa hết trong một lần" chính là thứ không ai kiểm nổi.
 */

test('đóng gói rồi bung ra thì về đúng chỗ cũ', () => {
  const s = tipOf({
    head: 'Khung 5 giờ',
    rows: [
      ['Đã tiêu', '32%'],
      ['Bỏ phí', '52%', 'warn'],
    ],
    note: 'chưa đủ dữ liệu để đoán nhịp',
  });
  assert.deepEqual(parseTip(s), {
    head: 'Khung 5 giờ',
    rows: [
      { k: 'Đã tiêu', v: '32%', tone: '' },
      { k: 'Bỏ phí', v: '52%', tone: 'warn' },
    ],
    notes: ['chưa đủ dữ liệu để đoán nhịp'],
  });
});

test('hàng không có trị thì bị bỏ — ô trống trông như đang hỏng, không như đang thiếu', () => {
  const s = tipOf({ head: 'x', rows: [['Nhịp', ''], ['Đã tiêu', '5%'], ['Lúc reset', null], null] });
  assert.deepEqual(
    parseTip(s).rows.map((r) => r.k),
    ['Đã tiêu'],
  );
});

test('SỐ 0 là một trị, không phải một ô trống — nó thường là con số đáng đọc nhất bảng', () => {
  // `filter(Boolean)` từng lọc mất `0`, ra một hàng có nhãn mà không có trị. Nằm im được
  // lâu vì hầu hết chỗ gọi truyền vào CHUỖI đã định dạng ("0", truthy); chart hâm-lại-cache
  // là chỗ đầu tiên truyền số nguyên thô, và ở đó 0 nghĩa là "nghỉ 40 phút không tốn gì".
  const rows = parseTip(tipOf({ head: 'nghỉ 5–15 phút', rows: [['Lượt ghi lại', 0], ['Trả thêm', 0]] })).rows;
  assert.deepEqual(rows, [
    { k: 'Lượt ghi lại', v: '0', tone: '' },
    { k: 'Trả thêm', v: '0', tone: '' },
  ]);
  assert.match(flatTip(tipOf({ head: 'h', rows: [['Lượt ghi lại', 0]] })), /Lượt ghi lại: 0/);
});

test('giọng vẫn được phép vắng — chỉ nó là thứ tuỳ chọn trong một hàng', () => {
  const s = tipOf({ head: 'h', rows: [['a', 1], ['b', 2, 'warn']] });
  assert.deepEqual(parseTip(s).rows, [
    { k: 'a', v: '1', tone: '' },
    { k: 'b', v: '2', tone: 'warn' },
  ]);
});

test('chuỗi cũ không có tab vẫn hiện được, tách theo dấu chấm giữa', () => {
  const legacy = '12/7 — $4.20 ước tính · 18 lượt gọi';
  const { head, rows, notes } = parseTip(legacy);
  assert.equal(head, '');
  assert.deepEqual(rows, []);
  assert.deepEqual(notes, ['12/7 — $4.20 ước tính', '18 lượt gọi']);
});

test('bản một dòng cho aria-label gọi tên từng trị, không để số dính vào nhau', () => {
  const s = tipOf({ head: 'Khung 5 giờ', rows: [['Đã tiêu', '32%'], ['Bỏ phí', '52%']] });
  assert.equal(flatTip(s), 'Khung 5 giờ — Đã tiêu: 32% · Bỏ phí: 52%');
  // Chuỗi cũ thì trả về nguyên nó, không bịa thêm tiêu đề.
  assert.equal(flatTip('12/7 — 18 lượt gọi'), '12/7 — 18 lượt gọi');
});

test('addRow nối thêm một hàng, và không nối gì khi không có trị', () => {
  const base = tipOf({ head: 'dự án', rows: [['Sinh ra', '1.9M']] });
  assert.equal(parseTip(addRow(base, 'Tỉ lệ', '9.4%')).rows.length, 2);
  assert.equal(addRow(base, 'Tỉ lệ', ''), base);
  assert.equal(addRow(base, 'Tỉ lệ', null), base);
});

/* ── Vùng bắt chuột của mảnh quạt tròn ──────────────────────────────────────── */

/** Đọc lại các đỉnh trong chuỗi `polygon(...)` thành cặp số. */
const pts = (poly) =>
  poly
    .slice('polygon('.length, -1)
    .split(',')
    .map((p) => p.trim().split(/\s+/).map((v) => Number.parseFloat(v)));

test('hình quạt bắt đầu từ tâm và ôm đúng cung của mảnh', () => {
  // Mảnh 25% đầu tiên: từ 12 giờ quay tới 3 giờ.
  const p = pts(wedge(0, 90));
  assert.deepEqual(p[0], [50, 50], 'đỉnh đầu phải là tâm, không thì hình quạt thành hình quạt cụt');
  const [sx, sy] = p[1];
  const [ex, ey] = p.at(-1);
  assert.ok(Math.abs(sx - 50) < 0.01 && sy < 0, 'mở ở 12 giờ');
  assert.ok(ex > 100 && Math.abs(ey - 50) < 0.01, 'đóng ở 3 giờ');
});

test('mọi đỉnh cung nằm ngoài mép vành — hụt vào trong là mất một dải không bắt được chuột', () => {
  for (const [a, b] of [
    [0, 12],
    [0, 90],
    [137.5, 300],
    [350, 360],
  ]) {
    for (const [x, y] of pts(wedge(a, b)).slice(1)) {
      const r = Math.hypot(x - 50, y - 50);
      assert.ok(r > 50, `đỉnh (${x}, ${y}) chỉ cách tâm ${r.toFixed(2)} — chưa tới mép vành`);
    }
  }
});

test('cung càng rộng càng nhiều đỉnh, và mảnh mỏng nhất vẫn là một hình quạt thật', () => {
  assert.ok(pts(wedge(0, 300)).length > pts(wedge(0, 30)).length);
  // Mảnh 0,3% (≈1°) vẫn phải có tâm + hai đầu cung, nếu không nó biến mất khỏi lớp bắt chuột.
  assert.equal(pts(wedge(0, 1)).length, 3);
});
