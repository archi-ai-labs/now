import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleFor, squarify, xLabels } from '../public/lib/chart.js';
import { formFor, setSkin, _setSeed } from '../public/lib/skin.js';
import { integrity } from '../public/views/shared.js';
import { streak, score, threat } from '../public/lib/game.js';

/* ── Trục chart ─────────────────────────────────────────────────────────────── */

test('trần trục luôn ≥ giá trị lớn nhất, và cột cao nhất không chạm nóc', () => {
  for (const v of [1, 3, 7, 9, 10, 23, 48, 99, 137, 1001]) {
    const { max, ticks } = scaleFor(v);
    assert.ok(max >= v, `max ${max} phải chứa được ${v}`);
    assert.equal(ticks[0], 0, 'vạch đầu luôn là 0');
    assert.equal(ticks.at(-1), max);
    assert.ok(ticks.length >= 3 && ticks.length <= 7, `${v} → ${ticks.length} vạch, quá dày hoặc quá thưa`);
  }
});

test('bước trục là 1/2/2.5/5 × 10ⁿ, không ra số lẻ khó đọc', () => {
  for (const v of [7, 23, 48, 137]) {
    const { ticks } = scaleFor(v);
    const step = ticks[1] - ticks[0];
    const mag = 10 ** Math.floor(Math.log10(step));
    assert.ok([1, 2, 2.5, 5, 10].includes(Math.round((step / mag) * 10) / 10), `bước ${step} không đẹp`);
  }
});

test('dữ liệu toàn 0 không làm vỡ trục', () => {
  const { max, ticks } = scaleFor(0);
  assert.ok(max >= 1, 'chia cho 0 là mọi cột thành NaN%');
  assert.ok(ticks.length >= 2);
});

/* ── Độ toàn vẹn board ──────────────────────────────────────────────────────── */

const th = { staleDays: 7, staleCommits: 15 };

test('integrity: board vừa cập nhật là 100, board hỏng file là 0', () => {
  assert.equal(integrity({ ageDays: 0, git: {} }, th), 100);
  assert.equal(integrity({ parseError: 'lỗi', git: {} }, th), 0);
});

test('integrity: tuổi và độ lệch mỗi thứ ăn tối đa nửa thanh', () => {
  assert.equal(integrity({ ageDays: 7, git: {} }, th), 50, 'chỉ cũ theo ngày → mất đúng nửa');
  assert.equal(integrity({ ageDays: 0, git: { driftCommits: 15 } }, th), 50, 'chỉ lệch commit → mất đúng nửa');
  assert.equal(integrity({ ageDays: 7, git: { driftCommits: 15 } }, th), 0);
});

test('integrity không bao giờ âm, dù board cũ tới đâu', () => {
  assert.equal(integrity({ ageDays: 9999, git: { driftCommits: 9999 } }, th), 0);
});

test('mất mốc commit thì cho điểm thấp cố định, không đoán bừa', () => {
  assert.equal(integrity({ ageDays: 0, git: { unknownCommit: true } }, th), 25);
});

/* ── Lớp game ───────────────────────────────────────────────────────────────── */

const ngày = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const tl = (...offsets) => offsets.map((o) => ({ date: ngày(o), ageDays: o, items: [{ title: 'x' }] }));

test('chuỗi ngày đếm đúng số ngày liên tiếp', () => {
  assert.equal(streak(tl(0, 1, 2)), 3);
  assert.equal(streak(tl(0, 1, 3)), 2, 'đứt ở ngày thứ 3 thì dừng, không nhảy qua');
  assert.equal(streak([]), 0);
});

test('sáng sớm chưa làm gì thì chuỗi vẫn tính từ hôm qua', () => {
  assert.equal(streak(tl(1, 2)), 2, 'không có việc hôm nay nhưng hôm qua có → chuỗi vẫn sống');
  assert.equal(streak(tl(2, 3)), 0, 'cách hai ngày là đứt thật');
});

test('XP chỉ đếm việc trong 7 ngày — cố ý là phong độ, không phải cấp độ tích luỹ', () => {
  const s = {
    timeline: [
      { date: ngày(1), ageDays: 1, items: [{ t: 1 }, { t: 2 }] },
      { date: ngày(30), ageDays: 30, items: [{ t: 3 }] },
    ],
    projects: [{ health: 'fresh' }],
  };
  assert.equal(score(s).done7, 2, 'việc 30 ngày trước không được tính vào phong độ tuần');
});

test('độ gấp: cùng mức heat thì cái treo lâu hơn và chặn việc đang làm phải cao hơn', () => {
  const a = threat({ heat: 'now', ageDays: 0, blocksFocus: false });
  const b = threat({ heat: 'now', ageDays: 3, blocksFocus: false });
  const c = threat({ heat: 'now', ageDays: 3, blocksFocus: true });
  assert.ok(a < b && b < c, `phải tăng dần: ${a} < ${b} < ${c}`);
  assert.ok(threat({ heat: 'later', ageDays: 0 }) < a);
  assert.ok(threat({ heat: 'now', ageDays: 999, blocksFocus: true }) <= 100, 'không được vượt 100%');
});

/* ── Nhãn trục X ────────────────────────────────────────────────────────────── */

const days = (n) => Array.from({ length: n }, (_, i) => ({ x: `${i}/7`, v: i }));

test('ít mốc thì ghi nhãn hết', () => {
  assert.deepEqual([...xLabels(days(6))], [0, 1, 2, 3, 4, 5]);
});

test('nhiều mốc thì thưa đều, và LUÔN giữ hai đầu — mất hai đầu là mất luôn phạm vi của chart', () => {
  const keep = xLabels(days(45));
  assert.ok(keep.size <= 8, `${keep.size} nhãn vẫn quá dày`);
  assert.ok(keep.has(0) && keep.has(44), 'mốc đầu và mốc cuối phải còn');
});

test('không bao giờ ghi nhãn vào hai mốc SÁT NHAU — hai nhãn kề nhau là hai chuỗi chồng lên nhau', () => {
  // Quãng 9–16 mốc là chỗ duy nhất lỗi này hiện ra: bước chia đều nhỏ hơn 2 nên phép làm
  // tròn ném hai nhãn vào hai chỉ số liền kề. 14 mốc / 8 nhãn ra bước 1,86 → chỉ số 6 và 7.
  for (let n = 9; n <= 20; n++) {
    const keep = [...xLabels(days(n))].sort((a, b) => a - b);
    for (let i = 1; i < keep.length; i++) {
      assert.ok(keep[i] - keep[i - 1] >= 2, `${n} mốc: nhãn ${keep[i - 1]} và ${keep[i]} kề nhau`);
    }
    assert.ok(keep.includes(0), `${n} mốc: mất nhãn đầu`);
    assert.ok(keep.includes(n - 1), `${n} mốc: mất nhãn cuối — mất luôn "chart này tới đâu"`);
  }
});

test('mốc call site cố ý để trống thì không được lôi về — nó đã tự thưa rồi', () => {
  // Màn Thống kê để trống nhãn giờ lẻ; thưa thêm lần nữa trên đó là xoá mất chủ ý.
  const hours = Array.from({ length: 24 }, (_, h) => ({ x: h % 3 === 0 ? String(h) : '', v: h }));
  const keep = xLabels(hours);
  assert.equal(keep.size, 8, 'tám nhãn giờ chẵn, giữ nguyên cả tám');
  for (const i of keep) assert.equal(i % 3, 0, 'không được ghi nhãn vào mốc đang để trống');
});

/* ── Treemap ────────────────────────────────────────────────────────────────── */

const W = 160;
const H = 90;
const area = (c) => c.w * c.h;

test('diện tích tỉ lệ đúng với giá trị — đây là toàn bộ lý do treemap tồn tại', () => {
  const vals = [50, 25, 15, 6, 4];
  const cells = squarify(vals, W, H);
  const unit = (W * H) / vals.reduce((a, b) => a + b, 0);
  for (const [i, v] of vals.entries()) {
    assert.ok(Math.abs(area(cells[i]) - v * unit) < 1e-6, `ô ${i} lệch diện tích`);
  }
});

test('các ô phủ kín khung và không tràn ra ngoài', () => {
  const cells = squarify([9, 7, 5, 4, 3, 2, 1, 1], W, H);
  const covered = cells.reduce((n, c) => n + area(c), 0);
  assert.ok(Math.abs(covered - W * H) < 1e-6, 'tổng diện tích phải bằng đúng khung');
  for (const c of cells) {
    assert.ok(c.x >= -1e-9 && c.y >= -1e-9, 'không ô nào bắt đầu ngoài khung');
    assert.ok(c.x + c.w <= W + 1e-6 && c.y + c.h <= H + 1e-6, 'không ô nào tràn khỏi khung');
  }
});

test('các ô không đè lên nhau', () => {
  const cells = squarify([40, 20, 14, 10, 8, 5, 3], W, H);
  const hits = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) assert.ok(!hits(cells[i], cells[j]), `ô ${i} đè ô ${j}`);
  }
});

test('ô càng nhiều thì tỉ lệ dài/rộng vẫn phải gần vuông — cắt thẳng cho ra những sợi chỉ', () => {
  const vals = Array.from({ length: 14 }, (_, i) => 14 - i);
  for (const c of squarify(vals, W, H)) {
    const ratio = Math.max(c.w / c.h, c.h / c.w);
    assert.ok(ratio < 9, `ô ${c.w.toFixed(1)}×${c.h.toFixed(1)} quá dẹt (${ratio.toFixed(1)})`);
  }
});

test('giá trị 0 và mảng rỗng không làm vỡ layout', () => {
  assert.deepEqual(squarify([], W, H), []);
  const cells = squarify([5, 0, 3], W, H);
  assert.deepEqual(cells[1], { x: 0, y: 0, w: 0, h: 0 }, 'giá trị 0 chiếm 0 diện tích, không phải NaN');
  assert.ok(Math.abs(cells[0].w * cells[0].h + cells[2].w * cells[2].h - W * H) < 1e-6);
  for (const c of squarify([0, 0], W, H)) assert.equal(c.w * c.h, 0);
});

/* ── Phong cách vẽ ──────────────────────────────────────────────────────────── */

const SERIES = ['columns', 'area', 'lollipop'];
const RANK = ['hbars', 'donut', 'treemap'];

test('phong cách xác định thì hai kiểu dữ liệu đi cùng một bậc', () => {
  for (const [i, skin] of ['plain', 'curve', 'block'].entries()) {
    setSkin(skin);
    assert.equal(formFor('series', 'x'), SERIES[i]);
    assert.equal(formFor('rank', 'x'), RANK[i]);
  }
});

test('NGẪU NHIÊN vẫn không bao giờ vẽ chuỗi thời gian thành quạt tròn', () => {
  // Đây là hàng rào duy nhất khiến nút này không phá dữ liệu: ngẫu nhiên TRONG danh
  // sách hợp lệ của từng kiểu, không phải ngẫu nhiên trên tất cả các hình.
  for (let seed = 0; seed < 200; seed++) {
    setSkin('plain');
    setSkin('random');
    _setSeed(seed);
    for (const id of ['usage-project', 'usage-mcp', 'done-by-day', 'session-hours', 'queue']) {
      assert.ok(SERIES.includes(formFor('series', id)), `series → ${formFor('series', id)}`);
      assert.ok(RANK.includes(formFor('rank', id)), `rank → ${formFor('rank', id)}`);
    }
  }
});

test('cùng một chart giữ nguyên hình qua mọi lượt vẽ lại — không thì cứ 30 giây trang lại nhảy', () => {
  setSkin('random');
  _setSeed(12345);
  const first = ['usage-project', 'usage-mcp', 'usage-skill'].map((id) => formFor('rank', id));
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(
      ['usage-project', 'usage-mcp', 'usage-skill'].map((id) => formFor('rank', id)),
      first,
    );
  }
});

test('hạt giống khác nhau thì các chart không đổi hình đồng loạt', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `chart-${i}`);
  setSkin('random');
  let mixed = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    _setSeed(seed);
    if (new Set(ids.map((id) => formFor('rank', id))).size > 1) mixed++;
  }
  assert.ok(mixed >= 4, 'gần như mọi hạt giống phải cho ra nhiều hình khác nhau trong cùng một màn');
  setSkin('plain');
});
