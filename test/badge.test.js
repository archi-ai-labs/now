import test from 'node:test';
import assert from 'node:assert/strict';
import { badgeOf } from '../src/badge.js';

/**
 * Mục trên thanh menu là bề mặt DUY NHẤT chạy suốt ngày, nên nó phải nói được cả lúc
 * mọi thứ hỏng — và đó đúng là nhánh trước nay chưa ai chạy thử, vì thử nó nghĩa là bịa
 * cho endpoint của Anthropic chết.
 *
 * Ca đã xảy ra thật (3–4/8): token OAuth trong Keychain hết hạn, `/api/state` biết thừa
 * (`degraded: "token-expired"`), mà thứ người dùng nhìn thấy suốt buổi thì không nói gì
 * cả — mất trọn một phiên đi dò một câu trả lời nằm sẵn trong API.
 */

const NOW = Date.parse('2026-08-04T02:00:00+07:00');

/** Hạn mức đọc được, nhịp tiêu bình thường. */
const healthy = (over = {}) => ({
  quota: {
    ok: true,
    at: NOW,
    ageMs: 30_000,
    stale: false,
    fiveHour: { used: 11, resetsAt: NOW + 3600_000, windowMs: 18000_000, elapsedFrac: 0.7, expired: false },
    sevenDay: { used: 41, resetsAt: NOW + 86400_000, windowMs: 604800_000, elapsedFrac: 0.57, expired: false },
    ...over,
  },
  stats: { awake: 2, hotDecisions: 3 },
});

test('bình thường: hai con số đã tiêu, không kèm lời nhắc nào', () => {
  const b = badgeOf(healthy(), NOW);
  assert.equal(b.quota.text, '11%·41%');
  assert.equal(b.quota.stale, false);
  // Tooltip lúc không hỏng gì không phải chỗ nhét thêm chữ.
  assert.equal(b.quota.note, null);
});

test('token hết hạn: nói ra CÁCH CHỮA, không chỉ nói là hỏng', () => {
  const b = badgeOf(healthy({ degraded: 'token-expired', stale: true }), NOW);
  assert.ok(b.quota.note, 'phải có lời nhắc');
  assert.match(b.quota.note, /Claude Code/, 'lời nhắc phải nói việc phải làm');
  // Số vẫn còn (rơi xuống ảnh chụp cũ) — nên `stale` là kênh DUY NHẤT nói rằng mấy con
  // số đang bày ra kia không phải số của bây giờ. Mất cờ này là mất cả cảnh báo.
  assert.equal(b.quota.stale, true);
  assert.equal(b.quota.text, '11%·41%');
});

test('mỗi lý do tụt tầng đều có câu của nó, không rơi vào im lặng', () => {
  for (const reason of ['no-auth', 'token-expired', 'http', 'timeout', 'network']) {
    const b = badgeOf(healthy({ degraded: reason }), NOW);
    assert.ok(b.quota.note, `${reason} phải nói được một câu`);
    assert.notEqual(b.quota.note, reason, `${reason} không được lọt ra màn hình ở dạng khoá`);
  }
});

test('lý do lạ vẫn ra được một câu, không lọt khoá thô ra màn hình', () => {
  const b = badgeOf(healthy({ degraded: 'chua-tung-gap' }), NOW);
  assert.ok(b.quota.note);
  assert.doesNotMatch(b.quota.note, /chua-tung-gap/);
});

test('không đọc được gì: dấu gạch, không phải "0%·0%"', () => {
  const b = badgeOf({ quota: { ok: false, degraded: 'no-auth' }, stats: {} }, NOW);
  assert.equal(b.quota.text, '—');
  assert.equal(b.quota.tone, 'mute');
  assert.equal(b.quota.stale, true);
  assert.ok(b.quota.note);
});

test('không có hạn mức nào trong trạng thái: vẫn trả huy hiệu, không ném', () => {
  const b = badgeOf({}, NOW);
  assert.equal(b.ok, true);
  assert.equal(b.quota.text, '—');
  assert.equal(b.quota.stale, true, 'không biết gì thì phải coi là số cũ, không phải số tươi');
  assert.deepEqual(b.work, { awake: 0, hot: 0 });
});

/**
 * Trường `rest` — thang ngồi-lâu đi RA icon. Ba cửa phải đóng đúng:
 * không sổ / trò chơi tắt → null (bản Swift cũ đọc badge mới cũng chỉ thấy thiếu một
 * trường), đang giữa một động tác nghỉ → bậc null (icon không được giục người vừa nghe
 * lời nó), còn lại → bậc do restStageOf quyết, đúng một nguồn.
 */
test('rest: không sổ hay trò chơi tắt thì null, không bịa số', () => {
  assert.equal(badgeOf(healthy(), NOW).rest, null, 'không truyền sổ thì không có phần nghỉ');
  assert.equal(badgeOf(healthy(), NOW, { on: false, satMin: 200 }).rest, null, 'tắt trò chơi là tắt cả icon');
});

test('rest: bậc theo số phút ngồi, và đang nghỉ dở thì icon phải im', () => {
  const at = (satMin, doing = null) => badgeOf(healthy(), NOW, { on: true, satMin, doing }).rest;
  assert.deepEqual(at(40), { satMin: 40, stage: null }, 'dưới mốc đầu là im lặng');
  assert.deepEqual(at(95), { satMin: 95, stage: 'spent' });
  assert.equal(at(95, { kind: 'move', id: 'walk', ms: 6e4, leftMs: 3e4 }).stage, null, 'vừa bấm đi bộ mà icon vẫn đỏ là huy hiệu cãi cú bấm');
  // Đang ĂN thì khác đang nghỉ: cái bát không cắt mạch ngồi, bậc phải giữ nguyên.
  assert.equal(at(95, { kind: 'food', id: 'pho', ms: 6e4, leftMs: 3e4 }).stage, 'spent');
});
