import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAgQuota } from '../src/collect/agquota.js';

/**
 * Hạn mức Antigravity.
 *
 * Test này tồn tại vì một lý do rất cụ thể: **đã có một bản dựng sai đúng bằng phần bù**.
 * `~/.gemini/antigravity/scratch/quota_server.py` đếm step chia cho một hằng số tự đặt,
 * in ra 70,5% và gọi là "đã dùng" — trong khi 71% là phần CÒN LẠI và số đã dùng thật là
 * 29,1%. Sai kiểu đó không có triệu chứng nào: con số nằm trong khoảng hợp lý, thanh đo
 * vẽ ra bình thường, và nó khớp với cái người dùng thấy trong app.
 *
 * Nên phép khẳng định quan trọng nhất dưới đây không phải "parse chạy được", mà là
 * **`remainingFraction: 0.715054` phải ra `used ≈ 28,5`**, không phải 71,5.
 *
 * Dữ liệu là phản hồi THẬT, chép nguyên từ một lượt gọi ngày 2026-07-27.
 */

const BODY = {
  response: {
    groups: [
      {
        displayName: 'Gemini Models',
        description: 'Models within this group: Gemini Flash, Gemini Pro',
        buckets: [
          {
            bucketId: 'gemini-weekly',
            displayName: 'Weekly Limit',
            description: 'You have used some of your weekly limit, it will fully refresh in 2 days, 7 hours.',
            window: 'weekly',
            remainingFraction: 0.715054,
            resetTime: '2026-07-29T01:04:42Z',
          },
          {
            bucketId: 'gemini-5h',
            displayName: 'Five Hour Limit',
            description: 'You have used some of your 5-hour limit, it will fully refresh in 3 hours, 25 minutes.',
            window: '5h',
            remainingFraction: 0.3937706,
            resetTime: '2026-07-26T21:17:46Z',
          },
        ],
      },
      {
        displayName: 'Claude and GPT models',
        description: 'Models within this group: Claude Opus, Claude Sonnet, GPT-OSS',
        buckets: [
          {
            bucketId: '3p-weekly',
            displayName: 'Weekly Limit',
            description: 'You have used some of your weekly limit, it will fully refresh in 5 days.',
            window: 'weekly',
            remainingFraction: 0.46214172,
            resetTime: '2026-07-31T17:53:18Z',
          },
          // Không có `description`: server bỏ trường đó khi hồ còn nguyên. Đây chính là ca
          // mà một phép đọc thiếu phòng thủ sẽ ném.
          {
            bucketId: '3p-5h',
            displayName: 'Five Hour Limit',
            window: '5h',
            remainingFraction: 1,
            resetTime: '2026-07-26T22:51:52Z',
          },
        ],
      },
    ],
    description: 'Within each group, models share a weekly limit and a 5-hour limit.',
  },
};

const AT = Date.parse('2026-07-26T17:50:00Z');
const NOW = AT;

test('remainingFraction đổi thành ĐÃ TIÊU, không phải còn lại', () => {
  const q = parseAgQuota(BODY, AT, NOW);
  assert.equal(q.ok, true);

  const [gemini, third] = q.groups;
  const gWeekly = gemini.buckets.find((b) => b.key === 'gemini-weekly');

  // 0.715054 còn lại = 28,49% đã tiêu. Đây là phép khẳng định mà cả file này tồn tại vì nó.
  assert.ok(Math.abs(gWeekly.used - 28.4946) < 0.001, `đã tiêu ra ${gWeekly.used}, phải là ~28,5`);
  assert.ok(Math.abs(gWeekly.remaining - 71.5054) < 0.001);
  assert.equal(Math.round(gWeekly.used + gWeekly.remaining), 100);

  // Hồ còn nguyên: 0% đã tiêu, KHÔNG phải 100%.
  const untouched = third.buckets.find((b) => b.key === '3p-5h');
  assert.equal(untouched.used, 0);
  assert.equal(untouched.remaining, 100);
  assert.equal(untouched.say, null, 'thiếu description phải ra null chứ không phải chuỗi "undefined"');
});

test('hai hồ giữ nguyên là hai, không gộp', () => {
  const q = parseAgQuota(BODY, AT, NOW);
  assert.equal(q.groups.length, 2);
  assert.deepEqual(
    q.groups.map((g) => g.key),
    ['gemini', '3p'],
    'khoá nhóm phải lấy từ bucketId, không lấy từ displayName tiếng Anh',
  );
  assert.equal(q.groups[0].models, 'Gemini Flash, Gemini Pro', 'phần dẫn "Models within this group:" phải bị cắt');
  // Hai hồ lệch nhau rất xa là chuyện bình thường — chính nó là lý do không được cộng.
  assert.equal(q.groups[1].buckets.find((b) => b.key === '3p-5h').used, 0);
  assert.ok(q.groups[0].buckets.find((b) => b.key === 'gemini-5h').used > 60);
});

test('mốc reset và độ dài cửa sổ quy về số dùng được', () => {
  const q = parseAgQuota(BODY, AT, NOW);
  const g5h = q.groups[0].buckets.find((b) => b.key === 'gemini-5h');

  assert.equal(g5h.resetsAt, Date.parse('2026-07-26T21:17:46Z'));
  assert.equal(g5h.windowMs, 5 * 60 * 60 * 1000);
  assert.equal(g5h.expired, false);
  // Còn 3h27 trên cửa sổ 5 giờ → đã trôi khoảng 31%.
  assert.ok(g5h.elapsedFrac > 0.3 && g5h.elapsedFrac < 0.33, `elapsedFrac = ${g5h.elapsedFrac}`);

  const gWeekly = q.groups[0].buckets.find((b) => b.key === 'gemini-weekly');
  assert.equal(gWeekly.windowMs, 7 * 24 * 60 * 60 * 1000);
});

test('mốc reset đã qua thì gắn cờ expired', () => {
  const later = Date.parse('2026-07-26T22:00:00Z');
  const q = parseAgQuota(BODY, AT, later);
  const g5h = q.groups[0].buckets.find((b) => b.key === 'gemini-5h');
  assert.equal(g5h.expired, true);
  assert.equal(g5h.forecast.known, false, 'cửa sổ đã lăn thì không còn gì để dự báo');
});

test('phản hồi hỏng không ném, chỉ nói lý do', () => {
  assert.deepEqual(parseAgQuota(null, AT, NOW), { ok: false, reason: 'broken' });
  assert.deepEqual(parseAgQuota('nope', AT, NOW), { ok: false, reason: 'broken' });
  assert.deepEqual(parseAgQuota({ response: {} }, AT, NOW), { ok: false, reason: 'empty' });
  // Nhóm có mà bucket rỗng cũng là rỗng — không phải một nhóm trống trên màn hình.
  assert.deepEqual(
    parseAgQuota({ response: { groups: [{ displayName: 'X', buckets: [] }] } }, AT, NOW),
    { ok: false, reason: 'empty' },
  );
});

test('bucket thiếu remainingFraction bị bỏ, phần còn lại vẫn hiện', () => {
  const q = parseAgQuota(
    {
      response: {
        groups: [
          {
            displayName: 'Gemini Models',
            buckets: [
              { bucketId: 'gemini-weekly', window: 'weekly', remainingFraction: 0.5, resetTime: '2026-07-29T01:04:42Z' },
              { bucketId: 'gemini-5h', window: '5h' },
            ],
          },
        ],
      },
    },
    AT,
    NOW,
  );
  assert.equal(q.ok, true);
  assert.equal(q.groups[0].buckets.length, 1, 'bucket không có số phải biến mất, không hiện thành 0%');
  assert.equal(q.groups[0].buckets[0].used, 50);
});

test('buckets phẳng không gói nhóm vẫn đọc được', () => {
  const q = parseAgQuota(
    { response: { buckets: [{ bucketId: 'gemini-5h', window: '5h', remainingFraction: 0.25 }] } },
    AT,
    NOW,
  );
  assert.equal(q.ok, true);
  assert.equal(q.groups.length, 1);
  assert.equal(q.groups[0].buckets[0].used, 75);
});

test('ảnh chụp cũ bị gắn cờ stale', () => {
  const fresh = parseAgQuota(BODY, NOW - 60_000, NOW);
  assert.equal(fresh.stale, false);
  const old = parseAgQuota(BODY, NOW - 30 * 60_000, NOW);
  assert.equal(old.stale, true);
  assert.equal(old.ageMs, 30 * 60_000);
});
