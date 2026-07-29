import test from 'node:test';
import assert from 'node:assert/strict';
import { bumpCycles, cyclesOf, trimCycles, windowsIn } from '../src/collect/quotalog.js';

/**
 * Sổ hạn mức theo chu kỳ.
 *
 * Đây là sổ duy nhất trong dashboard mà một lỗi ghi KHÔNG sửa được sau: endpoint chỉ trả
 * trạng thái hiện tại, nên chu kỳ nào ghi sai hay ghi thiếu thì không có nguồn nào dựng
 * lại. Vì vậy test ở đây bám vào ba thứ dễ sai và đắt nhất: khoá chu kỳ (khoá lẫn là gộp
 * hai chu kỳ thành một), phép MAX của đỉnh, và độ phủ (`watchedTo`) — cái quyết định một
 * con số được lên hình hay bị đánh dấu là chưa đủ tin.
 */

const H = 3600_000;
const FIVE = 5 * H;
const SEVEN = 7 * 86400_000;

/** Một lượt đọc hạn mức, đúng hình dạng mà `parseApiQuota` trả về. */
const reading = (at, { used, resetsAt, windowMs = FIVE, seven = null } = {}) => ({
  ok: true,
  at,
  fiveHour: { used, resetsAt, windowMs },
  sevenDay: seven ? { used: seven.used, resetsAt: seven.resetsAt, windowMs: SEVEN } : null,
  scoped: [],
});

/* ── Nhập sổ ────────────────────────────────────────────────────────────────── */

test('chu kỳ khoá bằng MỐC RESET, nên nhiều lượt đọc gộp vào một hàng', () => {
  const reset = 100 * H;
  let m = new Map();
  m = bumpCycles(m, reading(96 * H, { used: 10, resetsAt: reset }));
  m = bumpCycles(m, reading(98 * H, { used: 30, resetsAt: reset }));
  assert.equal(m.size, 1, 'hai lượt đọc cùng chu kỳ không được thành hai hàng');
  assert.equal([...m.values()][0].samples, 2);
});

test('mốc reset giật ở phần lẻ giây vẫn là MỘT chu kỳ', () => {
  // Ca thật, đo trên máy này: endpoint sinh lại phần micro-giây ở mỗi lượt gọi, nên cùng
  // một mốc 16:30:00 trả về `.556746` rồi `.399430`. Khoá bằng mili-giây thô thì mỗi hai
  // phút sinh một "chu kỳ" mới, `samples` luôn bằng 1, và chart vẽ ra một cột cho mỗi lượt
  // ĐỌC thay vì mỗi chu kỳ. Đây là lỗi đã xảy ra, không phải lỗi giả định.
  const wall = Date.UTC(2026, 6, 26, 16, 30, 0);
  let m = new Map();
  m = bumpCycles(m, reading(wall - 3 * H, { used: 8, resetsAt: wall + 556 }));
  m = bumpCycles(m, reading(wall - 1 * H, { used: 19, resetsAt: wall + 399 }));
  m = bumpCycles(m, reading(wall - 30 * 60_000, { used: 24, resetsAt: wall - 443 }));
  assert.equal(m.size, 1, 'ba lượt đọc cùng một mốc tường phải gộp thành một chu kỳ');
  const c = [...m.values()][0];
  assert.equal(c.samples, 3);
  assert.equal(c.peak, 24);
  assert.equal(c.resetsAt, wall, 'mốc lưu lại phải là mốc đã làm tròn, để khoá và chỗ hiện ra khớp nhau');
});

test('hai chu kỳ 5 giờ thật vẫn tách nhau sau khi làm tròn', () => {
  const wall = Date.UTC(2026, 6, 26, 16, 30, 0);
  let m = new Map();
  m = bumpCycles(m, reading(wall - H, { used: 90, resetsAt: wall + 12 }));
  m = bumpCycles(m, reading(wall + H, { used: 5, resetsAt: wall + FIVE - 88 }));
  assert.equal(m.size, 2, 'làm tròn phút không được gộp hai chu kỳ cách nhau 5 giờ');
});

test('đỉnh lấy MAX — một lượt đọc trả về số thấp hơn không xoá con số đã đúng', () => {
  const reset = 100 * H;
  let m = new Map();
  m = bumpCycles(m, reading(96 * H, { used: 62, resetsAt: reset }));
  m = bumpCycles(m, reading(98 * H, { used: 41, resetsAt: reset }));
  assert.equal([...m.values()][0].peak, 62);
});

test('cùng một ảnh chụp gọi lại nhiều lần không làm phồng số lượt đọc', () => {
  // Nhịp dựng lại trạng thái là 30 giây còn nhịp lấy hạn mức là 2 phút, nên bốn phần năm
  // lượt gọi vào đây mang theo đúng ảnh chụp cũ. `samples` phải đếm ảnh chụp, không đếm
  // lượt quét — nó là mẫu số của mọi câu về độ phủ.
  const r = reading(96 * H, { used: 20, resetsAt: 100 * H });
  let m = new Map();
  m = bumpCycles(m, r);
  const after = bumpCycles(m, r);
  assert.equal(after, m, 'không có gì mới thì phải trả về CHÍNH map cũ — chỗ gọi dựa vào đó để khỏi ghi đĩa');
  assert.equal([...m.values()][0].samples, 1);
});

test('mốc reset đổi = chu kỳ mới, hàng mới, đỉnh không mang sang', () => {
  let m = new Map();
  m = bumpCycles(m, reading(96 * H, { used: 90, resetsAt: 100 * H }));
  m = bumpCycles(m, reading(101 * H, { used: 4, resetsAt: 105 * H }));
  assert.equal(m.size, 2);
  const peaks = [...m.values()].map((c) => c.peak).sort((a, b) => a - b);
  assert.deepEqual(peaks, [4, 90], 'đỉnh 90 của chu kỳ cũ không được rơi sang chu kỳ mới');
});

test('hai loại cửa sổ cùng lúc thành hai hàng riêng, không lẫn khoá', () => {
  let m = new Map();
  m = bumpCycles(m, reading(96 * H, { used: 20, resetsAt: 100 * H, seven: { used: 55, resetsAt: 200 * H } }));
  assert.equal(m.size, 2);
  assert.deepEqual([...m.values()].map((c) => c.kind).sort(), ['five', 'seven']);
});

test('cửa sổ không có mốc reset bị bỏ — không bịa khoá theo thời gian đọc', () => {
  // Bịa khoá thì mỗi lượt đọc thành một "chu kỳ" riêng, và sổ đầy hàng rác trong một ngày.
  const m = bumpCycles(new Map(), reading(96 * H, { used: 20, resetsAt: null }));
  assert.equal(m.size, 0);
});

test('lượt đọc hỏng không chạm vào sổ', () => {
  const m = new Map();
  assert.equal(bumpCycles(m, { ok: false, reason: 'no-auth' }), m);
  assert.equal(bumpCycles(m, { ok: true }), m, 'thiếu `at` thì không biết ảnh chụp này mới hay cũ');
  assert.equal(bumpCycles(m, null), m);
});

test('windowsIn gắn tên model vào hạn mức tuần theo model', () => {
  const kinds = windowsIn({
    fiveHour: { used: 1 },
    sevenDay: null,
    scoped: [{ used: 2, model: 'Opus 4.8' }, { used: 3, model: null }],
  }).map((x) => x.kind);
  assert.deepEqual(kinds, ['five', 'm:Opus 4.8', 'm:?']);
});

/* ── Đọc ra ─────────────────────────────────────────────────────────────────── */

const cycle = (over) => ({ kind: 'five', windowMs: FIVE, samples: 5, firstAt: 0, ...over });

test('chỉ chu kỳ ĐÃ CHỐT được đọc ra — chu kỳ đang chạy có thẻ riêng ở đầu màn', () => {
  const now = 100 * H;
  const m = new Map([
    ['five|' + 99 * H, cycle({ resetsAt: 99 * H, peak: 30, lastAt: 99 * H })],
    ['five|' + 104 * H, cycle({ resetsAt: 104 * H, peak: 12, lastAt: now })],
  ]);
  const out = cyclesOf(m, now);
  assert.equal(out.cycles.length, 1);
  assert.equal(out.cycles[0].resetsAt, 99 * H);
});

test('bỏ phí là phần bù của đỉnh', () => {
  const now = 100 * H;
  const m = new Map([['five|' + 99 * H, cycle({ resetsAt: 99 * H, peak: 22, lastAt: 99 * H })]]);
  assert.equal(cyclesOf(m, now).cycles[0].waste, 78);
});

test('độ phủ suy từ MỐC THỜI GIAN của lượt đọc cuối, không từ `now`', () => {
  // Đây là chỗ dễ sai nhất cả module: lấy `elapsedFrac` của lượt đọc thì một chu kỳ chỉ
  // được nhìn mười phút đầu vẫn ra 1 sau khi nó đã trôi qua — tự nhận đã theo trọn.
  const reset = 100 * H;
  const now = 200 * H; // rất lâu sau khi chu kỳ chốt
  const watchedEarly = new Map([['five|' + reset, cycle({ resetsAt: reset, peak: 9, lastAt: reset - 4 * H })]]);
  const watchedLate = new Map([['five|' + reset, cycle({ resetsAt: reset, peak: 9, lastAt: reset - 6 * 60_000 })]]);

  const a = cyclesOf(watchedEarly, now).cycles[0];
  const b = cyclesOf(watchedLate, now).cycles[0];
  assert.ok(Math.abs(a.watchedTo - 0.2) < 1e-9, `theo 1 trong 5 giờ → 0,2; đang là ${a.watchedTo}`);
  assert.equal(a.partial, true, 'theo được một phần năm cửa sổ thì đỉnh không đủ tin');
  assert.ok(b.watchedTo > 0.97);
  assert.equal(b.partial, false, 'theo tới sát mốc reset thì đỉnh đủ tin');
});

test('nhịp lấy số 2 phút không được làm MỌI chu kỳ bị đánh dấu là thiếu', () => {
  const reset = 100 * H;
  const m = new Map([['five|' + reset, cycle({ resetsAt: reset, peak: 50, lastAt: reset - 2 * 60_000 })]]);
  assert.equal(cyclesOf(m, reset + H).cycles[0].partial, false);
});

test('chu kỳ không biết độ dài cửa sổ thì bị đánh dấu thiếu, không đoán bừa', () => {
  const m = new Map([['five|' + 99 * H, cycle({ resetsAt: 99 * H, windowMs: null, peak: 40, lastAt: 99 * H })]]);
  const out = cyclesOf(m, 100 * H).cycles[0];
  assert.equal(out.watchedTo, null);
  assert.equal(out.partial, true);
});

test('xếp theo thời gian tăng dần, và đếm riêng phần đủ tin', () => {
  const now = 200 * H;
  const m = new Map([
    ['five|' + 99 * H, cycle({ resetsAt: 99 * H, peak: 30, lastAt: 99 * H })],
    ['five|' + 94 * H, cycle({ resetsAt: 94 * H, peak: 40, lastAt: 90 * H })], // theo hụt
    ['five|' + 104 * H, cycle({ resetsAt: 104 * H, peak: 50, lastAt: 104 * H })],
  ]);
  const out = cyclesOf(m, now);
  assert.deepEqual(
    out.cycles.map((c) => c.resetsAt / H),
    [94, 99, 104],
  );
  assert.equal(out.solid, 2, 'chu kỳ theo hụt không được đếm vào phần đủ tin');
  assert.deepEqual(out.kinds, ['five']);
});

/* ── Cắt sổ ─────────────────────────────────────────────────────────────────── */

test('cắt RIÊNG từng loại cửa sổ — khung 5 giờ không được đẩy khung 7 ngày ra', () => {
  // Khung 5 giờ chốt ~4 lần/ngày, khung 7 ngày 1 lần/tuần. Cắt chung một hạn mức thì chu
  // kỳ tuần bị đẩy ra chỉ sau vài tuần, mà nó là thứ chờ lâu nhất mới có.
  const m = new Map();
  for (let i = 0; i < 10; i++) m.set(`five|${i}`, cycle({ resetsAt: i * FIVE + 1, peak: 10, lastAt: 0 }));
  m.set('seven|x', cycle({ kind: 'seven', resetsAt: 1, peak: 90, lastAt: 0 }));

  const out = trimCycles(m, 3, 1e12);
  assert.equal([...out.values()].filter((c) => c.kind === 'five').length, 3);
  assert.equal([...out.values()].filter((c) => c.kind === 'seven').length, 1, 'chu kỳ tuần phải sống sót');
});

test('cắt giữ chu kỳ MỚI nhất, bỏ chu kỳ cũ nhất', () => {
  const m = new Map();
  for (const i of [1, 2, 3, 4]) m.set(`five|${i}`, cycle({ resetsAt: i * H, peak: i, lastAt: 0 }));
  const kept = [...trimCycles(m, 2, 1e12).values()].map((c) => c.resetsAt / H).sort((a, b) => a - b);
  assert.deepEqual(kept, [3, 4]);
});

test('chu kỳ ĐANG CHẠY không bao giờ bị cắt — nó chưa chốt và vẫn đang được ghi thêm', () => {
  const now = 100 * H;
  const m = new Map();
  for (const i of [1, 2, 3]) m.set(`five|${i}`, cycle({ resetsAt: i * H, peak: i, lastAt: 0 }));
  m.set('five|live', cycle({ resetsAt: now + H, peak: 5, lastAt: now }));
  const out = trimCycles(m, 1, now);
  assert.ok(out.has('five|live'), 'cắt mất chu kỳ đang chạy là mất luôn đỉnh đang gom');
  assert.equal(out.size, 2);
});
