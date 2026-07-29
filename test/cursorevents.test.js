import test from 'node:test';
import assert from 'node:assert/strict';
import { foldEvents, shapeRollup } from '../src/collect/cursorevents.js';
import { parseCursorAnalytics } from '../src/collect/cursor.js';

/**
 * Sổ sự kiện Cursor và nhịp editor — hai endpoint mới, cả hai đều là RPC nội bộ không tài liệu.
 *
 * Test ở đây KHÔNG chạm mạng: chúng kiểm hai hàm thuần (`foldEvents`, `shapeRollup`,
 * `parseCursorAnalytics`) trên phản hồi dựng tay theo đúng hình dạng đã dò được. Đó cũng là
 * chỗ duy nhất ghi lại hình dạng ấy — Anysphere đổi tên trường thì test đỏ, thay vì màn hình
 * lặng lẽ hiện $0.
 */

const ev = (o) => ({
  timestamp: String(o.ts),
  model: o.model ?? 'cursor-grok-4.5-high-fast',
  kind: o.kind ?? 'USAGE_EVENT_KIND_INCLUDED_IN_PRO',
  chargedCents: o.cents ?? 24.311,
  conversationId: o.convo ?? 'c-1',
  isHeadless: false,
  tokenUsage: { inputTokens: o.inTok ?? 2096, outputTokens: o.out ?? 443, cacheReadTokens: o.cr ?? 226752, totalCents: o.cents ?? 24.311 },
});

/** Mốc trong ngày, giờ ĐỊA PHƯƠNG — sổ gộp theo ngày địa phương, không theo UTC. */
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

/* ── Gộp sự kiện ──────────────────────────────────────────────────────────── */

test('gộp theo ngày, cộng đủ tiền và bốn loại token', () => {
  const days = foldEvents([
    ev({ ts: at(2026, 7, 20), cents: 10, out: 100, inTok: 5, cr: 7, convo: 'a' }),
    ev({ ts: at(2026, 7, 20, 15), cents: 5, out: 50, inTok: 1, cr: 2, convo: 'b' }),
    ev({ ts: at(2026, 7, 21), cents: 3, out: 30, convo: 'a' }),
  ]);
  assert.deepEqual(Object.keys(days).sort(), ['2026-07-20', '2026-07-21']);
  assert.equal(days['2026-07-20'].events, 2);
  assert.equal(days['2026-07-20'].cents, 15);
  assert.equal(days['2026-07-20'].out, 150);
  assert.equal(days['2026-07-20'].inTok, 6);
  assert.equal(days['2026-07-20'].cr, 9);
});

test('lượt LỖI được đếm riêng nhưng vẫn nằm trong tổng lượt', () => {
  // Tách hẳn ra thì tổng lượt hụt đi và không khớp con số Cursor tự hiện; gộp im lặng thì
  // mất hẳn tín hiệu chất lượng duy nhất mà sự kiện mang theo.
  const days = foldEvents([
    ev({ ts: at(2026, 7, 20), cents: 10 }),
    ev({ ts: at(2026, 7, 20), cents: 0, kind: 'USAGE_EVENT_KIND_ERRORED_NOT_CHARGED' }),
  ]);
  assert.equal(days['2026-07-20'].events, 2);
  assert.equal(days['2026-07-20'].errored, 1);
  assert.equal(days['2026-07-20'].cents, 10);
});

test('bảng hội thoại nằm TRONG từng ngày, để ghi đè theo ngày vẫn đúng', () => {
  // Giữ tổng hội thoại ở cấp trên thì phép gộp "ghi đè hai ngày cuối" không sửa lại được
  // phần của hội thoại trải ngang ranh giới — nó sẽ cộng dồn sai mãi mãi.
  const days = foldEvents([ev({ ts: at(2026, 7, 20), convo: 'a', cents: 10 }), ev({ ts: at(2026, 7, 21), convo: 'a', cents: 4 })]);
  assert.equal(days['2026-07-20'].convos.a.cents, 10);
  assert.equal(days['2026-07-21'].convos.a.cents, 4);
});

test('sự kiện thiếu mốc thời gian bị bỏ, không rơi vào một ngày bịa', () => {
  assert.deepEqual(foldEvents([{ chargedCents: 5 }, { timestamp: 'rác', chargedCents: 5 }]), {});
});

test('sự kiện không có mã hội thoại vẫn vào tổng ngày', () => {
  const days = foldEvents([{ timestamp: String(at(2026, 7, 20)), chargedCents: 7, tokenUsage: {} }]);
  assert.equal(days['2026-07-20'].events, 1);
  assert.equal(days['2026-07-20'].cents, 7);
  assert.deepEqual(days['2026-07-20'].convos, {});
});

/* ── Sổ → hình dạng giao diện ─────────────────────────────────────────────── */

test('tổng hội thoại cộng NGANG các ngày trong cửa sổ, kèm ngày đầu và ngày cuối', () => {
  const book = { at: 1, days: foldEvents([ev({ ts: at(2026, 7, 20), convo: 'a', cents: 10 }), ev({ ts: at(2026, 7, 22), convo: 'a', cents: 4 })]) };
  const s = shapeRollup(book, { now: at(2026, 7, 22) });
  assert.equal(s.convos.length, 1);
  assert.equal(s.convos[0].cents, 14);
  assert.equal(s.convos[0].firstDay, '2026-07-20');
  assert.equal(s.convos[0].lastDay, '2026-07-22');
});

test('bảng hội thoại chỉ gom 3 NGÀY gần nhất — lịch sử cũ không đóng băng bảng xếp hạng', () => {
  // Hội thoại đắt nhất của 148 ngày thì tháng sau vẫn là nó — bảng toàn-lịch-sử là một
  // tấm ảnh treo tường. Cửa sổ 3 ngày mới trả lời "dạo này cái gì đang đốt tiền", và
  // chuỗi NGÀY thì vẫn giữ trọn lịch sử: chỉ bảng hội thoại bị cắt.
  const events = [
    ev({ ts: at(2026, 7, 15), convo: 'old', cents: 900 }), // đắt nhất cả sổ, nhưng đã nguội
    ev({ ts: at(2026, 7, 19), convo: 'a', cents: 5 }),
    ev({ ts: at(2026, 7, 21), convo: 'a', cents: 7 }),
    ev({ ts: at(2026, 7, 20), convo: 'b', cents: 2 }),
  ];
  const s = shapeRollup({ at: 1, days: foldEvents(events) }, { now: at(2026, 7, 21) });
  assert.equal(s.convoDays, 3);
  assert.equal(s.series.length, 4, 'chuỗi ngày vẫn giữ trọn lịch sử');
  assert.equal(s.convoCount, 2, 'hội thoại nguội không được đếm');
  assert.deepEqual(s.convos.map((c) => c.id), ['a', 'b']);
  assert.equal(s.convos[0].cents, 12);
  assert.equal(s.convos[0].firstDay, '2026-07-19');
});

test('hội thoại xếp theo tiền, và cắt còn 10 hàng', () => {
  const events = Array.from({ length: 60 }, (_, i) => ev({ ts: at(2026, 7, 20), convo: `c${i}`, cents: i }));
  const s = shapeRollup({ at: 1, days: foldEvents(events) }, { now: at(2026, 7, 20) });
  assert.equal(s.convoCount, 60, 'số thật vẫn được nói ra');
  assert.equal(s.convos.length, 10, 'nhưng payload chỉ chở trọn bảng xếp hạng của giao diện');
  assert.equal(s.convos[0].cents, 59);
});

test('chuỗi ngày xếp TĂNG dần dù sự kiện về theo thứ tự mới→cũ', () => {
  const s = shapeRollup({ at: 1, days: foldEvents([ev({ ts: at(2026, 7, 22) }), ev({ ts: at(2026, 7, 20) })]) }, { now: 2 });
  assert.deepEqual(s.series.map((d) => d.day), ['2026-07-20', '2026-07-22']);
  assert.equal(s.from, '2026-07-20');
  assert.equal(s.to, '2026-07-22');
});

test('sổ trống phân biệt "đang nạp" với "đã kéo mà không có gì"', () => {
  // Hai chuyện khác nhau: một cái sẽ có số sau mười giây, một cái thì không. Gộp lại thành
  // "không có dữ liệu" là bắt người dùng chờ một thứ không bao giờ tới, hoặc bỏ đi quá sớm.
  assert.equal(shapeRollup({ at: null, days: {} }).warming, true);
  assert.equal(shapeRollup({ at: 123, days: {} }).warming, false);
});

/* ── Nhịp editor ──────────────────────────────────────────────────────────── */

const day = (o) => ({
  date: String(o.at),
  linesAdded: o.added ?? 0,
  acceptedLinesAdded: o.accepted ?? 0,
  totalApplies: o.applies ?? 0,
  totalAccepts: o.accepts ?? 0,
  totalTabsShown: o.shown ?? 0,
  totalTabsAccepted: o.tabAcc ?? 0,
  extensionUsage: o.exts ?? [],
});

test('nhịp editor xếp theo ngày TĂNG dần và cộng đúng tổng', () => {
  const an = parseCursorAnalytics({
    dailyMetrics: [day({ at: at(2026, 7, 21), accepted: 30, shown: 10, tabAcc: 2 }), day({ at: at(2026, 7, 20), accepted: 12, shown: 5, tabAcc: 1 })],
  });
  assert.deepEqual(an.days.map((d) => d.accepted), [12, 30]);
  assert.equal(an.totals.accepted, 42);
  assert.equal(an.totals.tabsShown, 15);
});

test('đuôi file cộng NGANG mọi ngày, xếp theo số lần sửa', () => {
  const an = parseCursorAnalytics({
    dailyMetrics: [
      day({ at: at(2026, 7, 20), exts: [{ name: 'ts', count: 3 }, { name: 'md', count: 9 }] }),
      day({ at: at(2026, 7, 21), exts: [{ name: 'ts', count: 8 }] }),
    ],
  });
  assert.deepEqual(an.exts, [{ name: 'ts', count: 11 }, { name: 'md', count: 9 }]);
});

test('phản hồi rỗng hoặc sai hình trả null, không trả một khung số 0', () => {
  // Khung số 0 vẽ ra một chart phẳng trông như "hôm nay không làm gì", trong khi sự thật là
  // "không đọc được". Hai câu đó không được phép trông giống nhau.
  assert.equal(parseCursorAnalytics(null), null);
  assert.equal(parseCursorAnalytics({}), null);
  assert.equal(parseCursorAnalytics({ dailyMetrics: [{ linesAdded: 5 }] }), null, 'thiếu date thì hàng đó không tính');
});
