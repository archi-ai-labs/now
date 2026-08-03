import test from 'node:test';
import assert from 'node:assert/strict';
import { bumpWindows } from '../src/collect/quotalog.js';
import {
  agLookback,
  claudeLookback,
  cursorLookback,
  foldCycles,
  gateOf,
  openedAtOf,
  usdPerWeek,
  TREND_NEED_MS,
} from '../src/lib/cycles.js';
import { collectLookback } from '../src/collect/lookback.js';

/**
 * Toán tiền của màn "Nhìn lại".
 *
 * Sổ trong test dựng bằng CHÍNH `bumpWindows` — bộ gấp thật của cả ba tracker — chứ
 * không viết tay từng bản ghi: thứ cần khoá ở đây là "lib đọc đúng thứ tracker ghi",
 * mà bản ghi viết tay thì chỉ khẳng định lib khớp với trí nhớ của người viết test.
 */

const H = 3600_000;
const D = 24 * H;

/** Sổ dựng qua nhiều lượt đọc — mỗi phần tử là một lượt: [mốc đọc, các cửa sổ thấy]. */
function ledger(reads) {
  let map = new Map();
  for (const [at, windows] of reads) map = bumpWindows(map, at, windows);
  return map;
}

test('usdPerWeek — đúng hai con số của đề xuất', () => {
  // $200/tháng → $46,0 một cửa sổ 7 ngày; $20/tháng → $4,60 một tuần túi Gemini.
  assert.equal(usdPerWeek(200).toFixed(1), '46.0');
  assert.equal(usdPerWeek(20).toFixed(2), '4.60');
});

test('foldCycles — chu kỳ qua ranh reset tách đúng hai bản ghi, chu kỳ đang chạy không có mặt', () => {
  const r1 = 100 * D; // mốc reset chu kỳ 1
  const r2 = r1 + 5 * H; // chu kỳ kế, ranh 5 giờ
  const map = ledger([
    [r1 - 2 * H, [{ kind: 'five', resetsAt: r1, windowMs: 5 * H, used: 12 }]],
    [r1 - 10 * 60_000, [{ kind: 'five', resetsAt: r1, windowMs: 5 * H, used: 31 }]],
    // Lượt đọc đầu tiên SAU ranh: cùng kind, mốc reset mới → bản ghi mới, không đè bản cũ.
    [r1 + 20 * 60_000, [{ kind: 'five', resetsAt: r2, windowMs: 5 * H, used: 3 }]],
  ]);
  assert.equal(map.size, 2);

  // Đứng giữa chu kỳ 2: chu kỳ 1 đã đóng (đỉnh 31), chu kỳ 2 đang chạy nên vắng mặt.
  const closed = foldCycles(map, ['five'], r1 + H);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].peak, 31);
  assert.equal(closed[0].resetsAt, r1);

  // Qua ranh thứ hai thì cả hai cùng đóng, xếp cũ → mới.
  const both = foldCycles(map, ['five'], r2 + H);
  assert.deepEqual(both.map((c) => c.peak), [31, 3]);
});

test('foldCycles — chu kỳ vắt đêm giữ nguyên một bản ghi, không bị ngày cắt đôi', () => {
  // Cửa sổ 5 giờ mở 22:00 hôm trước, reset 03:00 hôm sau (mốc 100 ngày + 3 giờ).
  const reset = 100 * D + 3 * H;
  const map = ledger([
    [reset - 4 * H, [{ kind: 'five', resetsAt: reset, windowMs: 5 * H, used: 8 }]], // 23:00
    [reset - H, [{ kind: 'five', resetsAt: reset, windowMs: 5 * H, used: 27 }]], // 02:00, đã sang ngày
  ]);
  // Khoá theo mốc reset nên hai lượt đọc ở hai NGÀY khác nhau vẫn là một chu kỳ.
  assert.equal(map.size, 1);
  const [c] = foldCycles(map, ['five'], reset + H);
  assert.equal(c.peak, 27);
});

test('foldCycles — theo hụt thì partial, theo sát mốc reset thì không', () => {
  const reset = 50 * D;
  const map = ledger([
    // Lượt đọc cuối cách reset 4 ngày trên cửa sổ 7 ngày → chỉ theo được ~43%.
    [reset - 4 * D, [{ kind: 'seven', resetsAt: reset, windowMs: 7 * D, used: 60 }]],
  ]);
  const [c] = foldCycles(map, ['seven'], reset + H);
  assert.equal(c.partial, true);
  assert.ok(c.watchedTo < 0.9);

  const tight = ledger([[reset - 30 * 60_000, [{ kind: 'seven', resetsAt: reset, windowMs: 7 * D, used: 84 }]]]);
  assert.equal(foldCycles(tight, ['seven'], reset + H)[0].partial, false);
});

test('claudeLookback — cửa sổ 7 ngày mang tiền, chu kỳ theo hụt không mang', () => {
  const r1 = 70 * D;
  const r2 = r1 + 7 * D;
  const map = ledger([
    [r1 - H, [{ kind: 'seven', resetsAt: r1, windowMs: 7 * D, used: 84 }]],
    // Chu kỳ 2 bỏ theo dõi từ giữa chừng → đỉnh 40 là cận dưới, không được quy đô.
    [r2 - 5 * D, [{ kind: 'seven', resetsAt: r2, windowMs: 7 * D, used: 40 }]],
  ]);
  const c = claudeLookback(map, { now: r2 + H, planUsd: 200 });

  assert.equal(c.sevens.length, 2);
  const [solid, partial] = c.sevens;
  // Bỏ phí 16% của $46,0 = $7,36.
  assert.equal(solid.waste, 16);
  assert.equal(solid.wasteUsd.toFixed(2), '7.36');
  assert.equal(partial.partial, true);
  assert.equal(partial.wasteUsd, null);

  // Tổng tiền chỉ đếm phần theo đủ: 1 chu kỳ × $46,0.
  assert.equal(c.money.solid, 1);
  assert.equal(c.money.paidUsd.toFixed(1), '46.0');
  assert.equal(c.money.wasteUsd.toFixed(2), '7.36');
  assert.equal(c.money.worst.resetsAt, r1);
});

test('claudeLookback — dãy 5 giờ trung tính: có đỉnh, không có tiền', () => {
  const base = 30 * D;
  const reads = [];
  for (let i = 0; i < 15; i++) {
    const reset = base + i * 5 * H;
    reads.push([reset - H, [{ kind: 'five', resetsAt: reset, windowMs: 5 * H, used: (i * 7) % 40 }]]);
  }
  const c = claudeLookback(ledger(reads), { now: base + 16 * 5 * H, planUsd: 200 });
  // Cắt còn 12 cột cho payload, nhưng đỉnh đo trên TOÀN sổ 15 chu kỳ.
  assert.equal(c.fives.length, 12);
  assert.equal(c.fiveCount, 15);
  assert.equal(c.fiveMax, Math.max(...reads.map(([, [w]]) => w.used)));
  assert.ok(!('wasteUsd' in c.fives[0]), 'cột 5 giờ không được mang tiền');
});

test('cursorLookback — cents thật: vượt gói là quà, hụt gói là bỏ phí', () => {
  const r1 = 40 * D;
  const r2 = r1 + 31 * D;
  const map = ledger([
    // Chu kỳ 1: tiêu $68,07 trên gói $20 — vượt, bỏ phí 0.
    [r1 - H, [{ kind: 'billing', resetsAt: r1, windowMs: 31 * D, used: 6807, extra: { unit: 'cents', planCents: 2000, bonusCents: 4807 } }]],
    // Chu kỳ 2: tiêu $12 trên gói $20 — bỏ phí $8.
    [r2 - H, [{ kind: 'billing', resetsAt: r2, windowMs: 31 * D, used: 1200, extra: { unit: 'cents', planCents: 2000, bonusCents: 0 } }]],
  ]);
  const cu = cursorLookback(map, { now: r2 + H, planUsd: 20 });

  const [over, under] = cu.cycles;
  assert.equal(over.over, true);
  assert.equal(over.wasteUsd, 0);
  assert.equal(under.over, false);
  assert.equal(under.wasteUsd, 8);
  // Gói của TỪNG chu kỳ, không phải config: hai chu kỳ cùng trả $20 → đã trả $40.
  assert.equal(cu.money.paidUsd, 40);
  assert.equal(cu.money.wasteUsd, 8);
  assert.equal(cu.money.overCount, 1);
});

test('cursorLookback — sổ đời đầu thiếu planCents thì rơi về giá config', () => {
  const r = 40 * D;
  const map = ledger([[r - H, [{ kind: 'billing', resetsAt: r, windowMs: 31 * D, used: 500 }]]]);
  const [c] = cursorLookback(map, { now: r + H, planUsd: 20 }).cycles;
  assert.equal(c.planCents, 2000);
  assert.equal(c.wasteUsd, 15);
});

test('agLookback — chỉ đọc kind -weekly, rác cửa sổ trượt 5 giờ bị bỏ trọn', () => {
  const r = 60 * D;
  const reads = [
    [r - H, [{ kind: 'gemini-weekly', resetsAt: r, windowMs: 7 * D, used: 100 }]],
    [r - H, [{ kind: '3p-weekly', resetsAt: r + 2 * D, windowMs: 7 * D, used: 87 }]],
  ];
  // Rác thật từ máy này: túi 5 giờ có mốc reset trượt theo lượt đọc — mỗi 5 phút một
  // "chu kỳ" mới, một mẫu, đỉnh 0. Sổ hai ngày đã 328 bản ghi loại này.
  for (let i = 0; i < 50; i++) {
    const t = r - 2 * D + i * 5 * 60_000;
    reads.push([t, [{ kind: '3p-5h', resetsAt: t + 5 * H, windowMs: 5 * H, used: 0 }]]);
    reads.push([t, [{ kind: 'gemini-5h', resetsAt: t + 5 * H, windowMs: 5 * H, used: 2 }]]);
  }
  const a = agLookback(ledger(reads), { now: r + 3 * D, planUsd: 20 });

  // Túi Gemini cạn sạch trước reset (đúng tuần 29/7 ngoài đời) → bỏ phí $0.
  assert.equal(a.gemini.length, 1);
  assert.equal(a.gemini[0].used, 100);
  assert.equal(a.gemini[0].wasteUsd, 0);
  // Túi Claude/GPT ra chữ, không ra đô.
  assert.equal(a.threep.length, 1);
  assert.ok(!('wasteUsd' in a.threep[0]));
  // Mốc mở sổ cũng không được tính từ rác: rác bắt đầu sớm hơn 2 ngày.
  assert.equal(a.openedAt, r - H);
});

test('gateOf — cổng 3 tuần theo sổ NON NHẤT, sổ chưa mở không bắt ai chờ', () => {
  const t0 = 100 * D;
  // Ba sổ mở lệch nhau: sổ non nhất (t0 + 3 ngày) đặt nhịp.
  const gate = gateOf([t0, t0 + 3 * D, t0 + D], { now: t0 + 3 * D + TREND_NEED_MS - 1 });
  assert.equal(gate.open, false);
  assert.equal(gate.opensAt, t0 + 3 * D + TREND_NEED_MS);
  assert.equal(gateOf([t0, t0 + 3 * D], { now: t0 + 3 * D + TREND_NEED_MS }).open, true);

  // Một sổ chưa từng mở (null) không kéo cổng về vô hạn.
  assert.equal(gateOf([t0, null], { now: t0 + TREND_NEED_MS }).open, true);
  // Chưa sổ nào mở thì đóng, và không bịa được mốc mở.
  assert.deepEqual(gateOf([null, null], { now: t0 }), { open: false, openedAt: null, opensAt: null });
});

test('openedAtOf — chỉ đếm kind được hỏi', () => {
  const r = 10 * D;
  const map = ledger([
    [r - 9 * D, [{ kind: '3p-5h', resetsAt: r - 9 * D + 5 * H, windowMs: 5 * H, used: 0 }]],
    [r - H, [{ kind: 'gemini-weekly', resetsAt: r, windowMs: 7 * D, used: 50 }]],
  ]);
  assert.equal(openedAtOf(map, ['gemini-weekly']), r - H);
  assert.equal(openedAtOf(map, ['không-tồn-tại']), null);
});

test('collectLookback — sổ vắng hoàn toàn vẫn ra hình dạng đủ, và không chở Map nào', () => {
  const now = 200 * D;
  const lb = collectLookback({ now });
  assert.equal(lb.ok, true);
  assert.deepEqual(lb.claude.sevens, []);
  assert.deepEqual(lb.cursor.cycles, []);
  assert.equal(lb.gate.open, false);

  // Cả khối phải sống được qua JSON (đường ra client) mà không rơi rụng: một cái Map
  // lọt vào đây sẽ thành `{}` — mất dữ liệu không tiếng động.
  const json = JSON.parse(JSON.stringify(lb));
  assert.deepEqual(json, lb);
});

test('collectLookback — payload vài KB kể cả khi sổ đầy rác', () => {
  const now = 300 * D;
  const reads = [];
  // 120 chu kỳ 5 giờ Claude + 300 bản rác AG — cỡ sổ thật sau một tháng.
  for (let i = 0; i < 120; i++) {
    const reset = now - (120 - i) * 5 * H;
    reads.push([reset - H, [{ kind: 'five', resetsAt: reset, windowMs: 5 * H, used: i % 50 }]]);
  }
  const claude = ledger(reads);
  const agReads = [];
  for (let i = 0; i < 300; i++) {
    const t = now - 2 * D + i * 5 * 60_000;
    agReads.push([t, [{ kind: '3p-5h', resetsAt: t + 5 * H, windowMs: 5 * H, used: 0 }]]);
  }
  const lb = collectLookback({ claude, ag: ledger(agReads), now });
  const size = JSON.stringify(lb).length;
  assert.ok(size < 8_000, `state.lookback ${size} byte — đang chở thứ không được chở`);
});
