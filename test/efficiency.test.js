import test from 'node:test';
import assert from 'node:assert/strict';
import { median, bySession, turnBands, rewarmCost, sessionRoll, ratioBands, sideSplit, ctxOf } from '../src/collect/efficiency.js';

/**
 * Năm phép đo hiệu quả. Cả năm đều dựng trên THỨ TỰ và KHOẢNG CÁCH thời gian giữa các
 * lượt, tức là trên đúng hai thứ mà mọi phép đo khác ở màn Token bỏ qua — nên chúng cũng
 * là chỗ duy nhất mà một `sort` sai hay một dấu so sánh lệch không làm sập gì cả, chỉ làm
 * con số sai đi một cách trông rất hợp lý.
 */

/** Một lượt gọi. `min` là phút kể từ mốc gốc — chỗ duy nhất bốn phép đo này quan tâm. */
const row = (min, over = {}) => ({
  id: `r${min}-${over.session ?? 's'}-${Math.random()}`,
  ts: new Date(Date.UTC(2026, 6, 20, 0, min)).toISOString(),
  day: '2026-07-20',
  model: 'claude-sonnet-5',
  speed: 'standard',
  session: 's',
  inTok: 100,
  out: 1000,
  cw: 0,
  cw5: 0,
  cw1: 0,
  cr: 50_000,
  cwd: '/tmp/proj',
  side: false,
  ...over,
});

/* ── Trung vị ───────────────────────────────────────────────────────────────── */

test('trung vị miễn nhiễm với một trị ngoại lai — trung bình thì không', () => {
  const list = [10, 10, 10, 10, 1_000_000];
  assert.equal(median(list), 10);
  assert.ok(list.reduce((a, b) => a + b) / list.length > 100_000, 'đây là lý do không dùng trung bình');
});

test('trung vị của số chẵn phần tử lấy trung bình hai trị giữa', () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), 0, 'rỗng trả 0 chứ không NaN — NaN lan ra cả chart');
});

/* ── Gom theo phiên ─────────────────────────────────────────────────────────── */

test('phiên được xếp theo MỐC THỜI GIAN, không theo thứ tự đọc file', () => {
  // `--resume` chép lịch sử cũ sang file mới, và `mapLimit` quét song song — nên thứ tự
  // hàng vào đây là thứ tự file, không phải thứ tự thời gian.
  const rows = [row(30), row(10), row(20)];
  const list = bySession(rows).get('s');
  assert.deepEqual(
    list.map((r) => new Date(r.ts).getUTCMinutes()),
    [10, 20, 30],
  );
});

test('hàng thiếu session hoặc thiếu ts bị bỏ — không có mốc thì không có thứ tự', () => {
  const rows = [row(1), row(2, { session: null }), row(3, { ts: null })];
  const m = bySession(rows);
  assert.equal(m.size, 1);
  assert.equal(m.get('s').length, 1);
});

/* ── Ngữ cảnh theo lượt ─────────────────────────────────────────────────────── */

/** Một phiên n lượt, ngữ cảnh phình dần — đúng hình mà chart này đi tìm. */
const growing = (n, session) =>
  Array.from({ length: n }, (_, i) => row(i, { session, cr: 10_000 * (i + 1) }));

test('phiên ngắn hơn ngưỡng bị bỏ — nếu không, độ dốc đọc ra là dốc của phép chọn mẫu', () => {
  // 40 lượt < MIN_TURNS(50): phiên này chỉ góp mẫu vào hai băng đầu, nên để nó vào là
  // làm băng đầu đầy phiên chưa kịp phình còn băng cuối chỉ có phiên dài.
  const short = turnBands(growing(40, 'a'));
  assert.equal(short.sessions, 0);
  assert.equal(short.minTurns, 50);
  for (const b of short.bands) assert.equal(b.msgs, 0);

  const long = turnBands(growing(60, 'a'));
  assert.equal(long.sessions, 1);
});

test('ngữ cảnh trung vị tăng theo băng lượt — đây là phát hiện cả chart dựng để nói', () => {
  const rows = [...growing(120, 'a'), ...growing(120, 'b')];
  const { bands } = turnBands(rows);
  const mids = bands.map((b) => b.ctxMedian);
  for (let i = 1; i < mids.length; i++) {
    assert.ok(mids[i] > mids[i - 1], `băng ${i} (${mids[i]}) phải phình hơn băng ${i - 1} (${mids[i - 1]})`);
  }
});

test('băng cuối HỞ PHẢI — lượt 500 vẫn phải được đếm vào đâu đó', () => {
  const { bands } = turnBands(growing(500, 'a'));
  assert.equal(bands.at(-1).hi, null, 'hi=null là dấu hiệu băng hở, để nhãn ghi "101+"');
  assert.equal(
    bands.reduce((n, b) => n + b.msgs, 0),
    500,
    'không lượt nào được rơi ra ngoài mọi băng',
  );
});

test('băng chưa sinh ra token thì unit là null, không phải 0 — 0 đọc thành "miễn phí"', () => {
  const rows = growing(60, 'a').map((r) => ({ ...r, out: 0 }));
  for (const b of turnBands(rows).bands) {
    if (b.msgs > 0) assert.equal(b.unit, null);
  }
});

/* ── Hâm lại cache ──────────────────────────────────────────────────────────── */

const withWrite = (min, over = {}) => row(min, { cr: 0, cw5: 0, cw1: 0, ...over });

test('cache ghi mức 1 GIỜ không bị chấm lãng phí khi mới nghỉ 20 phút', () => {
  // Đây là lỗi của bản đầu: một ngưỡng 5 phút dùng cho cả hai mức TTL, và thế là mọi lượt
  // ghi mức 1 giờ sau khi nghỉ 20 phút bị tính là mất tiền — trong khi cache đó còn nóng
  // nguyên. Trên máy thật 95% cache ghi ở mức 1 giờ, nên lỗi này thổi con số lên gần gấp đôi.
  const rows = [withWrite(0, { cw1: 1_000_000 }), withWrite(20, { cw1: 1_000_000 })];
  assert.equal(rewarmCost(rows).extra, 0);
});

test('cùng lượt đó, nghỉ quá 1 giờ thì mới tính — và tính đúng hiệu ghi trừ đọc', () => {
  const rows = [withWrite(0, { cw1: 1_000_000 }), withWrite(90, { cw1: 1_000_000 })];
  const rw = rewarmCost(rows);
  assert.equal(rw.calls, 1);
  assert.equal(rw.tokens, 1_000_000);
  // sonnet-5 giá giới thiệu $2/1M input tới 31/8; ghi 1 giờ ×2, đọc ×0,1 → hiệu 1,9 × $2.
  assert.ok(Math.abs(rw.extra - 1.9 * 2) < 1e-9, `hiệu phải là $3.80, ra ${rw.extra}`);
});

test('mức 5 PHÚT thì nghỉ 20 phút là đã nguội', () => {
  const rows = [withWrite(0, { cw5: 1_000_000 }), withWrite(20, { cw5: 1_000_000 })];
  assert.ok(rewarmCost(rows).extra > 0);
});

test('lượt ĐẦU phiên không tính — khởi động nguội thì không có cách nào tránh', () => {
  const rw = rewarmCost([withWrite(0, { cw1: 500_000 })]);
  assert.equal(rw.calls, 0);
  assert.equal(rw.extra, 0);
  assert.equal(rw.cold, 500_000, 'nhưng vẫn phải đếm ra, để không biến mất khỏi sổ');
});

test('băng nghỉ vẫn CÓ MẶT khi bằng 0 — "nghỉ 40 phút không tốn gì" là một kết luận', () => {
  const rw = rewarmCost([withWrite(0, { cw1: 1_000_000 }), withWrite(90, { cw1: 1_000_000 })]);
  assert.equal(rw.bands.length, 4, 'cả bốn băng phải còn, kể cả băng rỗng');
  assert.equal(rw.bands.find((b) => b.key === '5-15m').cost, 0);
  assert.ok(rw.bands.find((b) => b.key === '1-6h').cost > 0);
});

test('model không có giá thì bỏ qua, không đoán bừa thành 0', () => {
  const rows = [withWrite(0, { cw1: 1e6, model: '<synthetic>' }), withWrite(90, { cw1: 1e6, model: '<synthetic>' })];
  assert.equal(rewarmCost(rows).calls, 0);
});

/* ── Theo phiên ─────────────────────────────────────────────────────────────── */

test('ctxPerOut tách được "đắt vì làm nhiều" khỏi "đắt vì đọc lại nhiều"', () => {
  const busy = Array.from({ length: 10 }, (_, i) => row(i, { session: 'busy', cr: 10_000, out: 5_000 }));
  const lumbering = Array.from({ length: 10 }, (_, i) => row(i, { session: 'slow', cr: 400_000, out: 1_000 }));
  const { top } = sessionRoll([...busy, ...lumbering]);
  const byKey = Object.fromEntries(top.map((s) => [s.key, s]));
  assert.ok(byKey.slow.ctxPerOut > byKey.busy.ctxPerOut * 10, 'phiên lết dài phải lộ ra ở tỉ số này');
});

test('trung vị và tỉ trọng top tính trên TOÀN BỘ phiên, không chỉ phần được gửi xuống', () => {
  // 150 phiên, chỉ 100 được gửi. Nếu `stats` tính sau khi cắt thì trung vị là trung vị của
  // 100 phiên mới nhất — một con số khác, mang nhãn của con số cũ.
  const rows = [];
  for (let s = 0; s < 150; s++) rows.push(row(s, { session: `s${s}`, out: 1000 }));
  const { stats, recent } = sessionRoll(rows);
  assert.equal(stats.n, 150);
  assert.equal(recent.length, 100);
  assert.ok(Math.abs(stats.top10Share - 10 / 150) < 1e-9, 'mọi phiên bằng nhau → top 10 chiếm đúng 10/150');
});

test('recent xếp mới nhất TRƯỚC — chỗ vẽ tự đảo lại, nhưng phần bị cắt phải là phần cũ', () => {
  const rows = [];
  for (let s = 0; s < 120; s++) rows.push(row(s, { session: `s${s}` }));
  const { recent } = sessionRoll(rows);
  assert.equal(recent[0].key, 's119');
  assert.ok(recent.every((s, i) => i === 0 || s.t0 <= recent[i - 1].t0));
});

/* ── Phân bố tỉ số ngữ cảnh / sinh ra ───────────────────────────────────────── */

/** Một phiên có tỉ số đặt trước: `cr` được tính ngược từ tỉ số muốn có. */
const sessionAt = (key, ratio, { out = 20_000, min = 0 } = {}) => [
  row(min, { session: key, out, inTok: 0, cr: Math.round(ratio * out) }),
];

test('phiên rơi vào đúng băng theo tỉ số, và mốc tròn thuộc băng TRÊN', () => {
  const rows = [
    ...sessionAt('a', 50),
    ...sessionAt('b', 80, { min: 1 }), // đúng mốc: phải vào băng 80–150
    ...sessionAt('c', 200, { min: 2 }),
    ...sessionAt('d', 900, { min: 3 }),
  ];
  const r = ratioBands(rows);
  assert.deepEqual(
    r.bands.map((b) => b.sessions),
    [1, 1, 1, 1],
    'mốc 80 vào băng 80–150, không đếm đúp ở cả hai băng',
  );
  assert.equal(r.sessions, 4);
});

test('phiên sinh ra quá ít bị bỏ — không thì băng cuối đầy phiên mở-ra-đóng-lại', () => {
  // 300 token sinh ra với 3M ngữ cảnh ra tỉ số 10.000×, rơi thẳng vào băng đáng đi soi.
  const rows = [...sessionAt('tiny', 10_000, { out: 300 }), ...sessionAt('real', 100, { min: 1 })];
  const r = ratioBands(rows);
  assert.equal(r.sessions, 1, 'chỉ phiên thật được tính');
  assert.equal(r.thin, 1, 'phiên bị bỏ phải được ĐẾM RA, không lặng lẽ');
  assert.equal(r.bands.at(-1).sessions, 0, 'băng cuối sạch, không có phiên rác');
});

test('băng cuối hở phải — tỉ số nghìn lần vẫn có chỗ đứng', () => {
  const r = ratioBands([...sessionAt('x', 5000)]);
  assert.equal(r.bands.at(-1).hi, null, 'null là dấu hiệu hở phải cho chỗ vẽ nhãn');
  assert.equal(r.bands.at(-1).sessions, 1);
});

test('tỉ lệ tiền tính trên TỔNG của các phiên được tính, cộng lại đủ 1', () => {
  const rows = [...sessionAt('a', 50), ...sessionAt('b', 400, { min: 1 })];
  const r = ratioBands(rows);
  const total = r.bands.reduce((n, b) => n + b.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `tổng tỉ lệ phải bằng 1, đang là ${total}`);
});

test('băng rỗng vẫn còn hàng với 0 — "không có phiên nào lết" là dữ liệu', () => {
  const r = ratioBands([...sessionAt('a', 50)]);
  assert.equal(r.bands.length, 4, 'không băng nào bị lọc mất');
  assert.deepEqual(
    r.bands.map((b) => b.sessions),
    [1, 0, 0, 0],
  );
  assert.equal(r.bands[3].cost, 0);
});

test('không có phiên nào đủ dày thì trả về khung rỗng, không NaN', () => {
  const r = ratioBands([...sessionAt('tiny', 100, { out: 10 })]);
  assert.equal(r.sessions, 0);
  assert.equal(r.median, 0, 'NaN ở đây lan ra cả phụ đề chart');
  assert.ok(r.bands.every((b) => b.share === 0));
});

/* ── Subagent ───────────────────────────────────────────────────────────────── */

test('subagent tách riêng, và giá đơn vị của nó đắt hơn vì đọc nhiều viết ít', () => {
  const main = [row(0, { out: 10_000, cr: 100_000 })];
  const side = [row(1, { out: 200, cr: 100_000, side: true })];
  const sp = sideSplit([...main, ...side]);
  assert.equal(sp.side.calls, 1);
  assert.equal(sp.main.calls, 1);
  assert.ok(sp.side.unit > sp.main.unit * 5, 'đây là con số duy nhất khiến subagent đáng nhắc tới');
});

test('không có subagent thì unit là null, không phải 0', () => {
  const sp = sideSplit([row(0)]);
  assert.equal(sp.side.calls, 0);
  assert.equal(sp.side.unit, null);
});

/* ── Ngữ cảnh của một lượt ──────────────────────────────────────────────────── */

test('ctxOf đếm cả ba đường VÀO, không đếm phần sinh ra', () => {
  assert.equal(ctxOf({ inTok: 1, cw5: 2, cw1: 3, cw: 99, cr: 4, out: 1000 }), 10);
});

test('bản ghi đời cũ không tách TTL thì `cw` được dùng thay — không bỏ sót', () => {
  assert.equal(ctxOf({ inTok: 1, cw5: 0, cw1: 0, cw: 5, cr: 4, out: 0 }), 10);
});
