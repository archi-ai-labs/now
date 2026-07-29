import test from 'node:test';
import assert from 'node:assert/strict';
import { ceilingFrom, parseCursorUsage } from '../src/collect/cursor.js';

/**
 * Hạn mức Cursor.
 *
 * Toàn bộ giá trị của module ấy nằm ở đúng một phép suy: **trần đô không có trong phản
 * hồi, phải suy ngược ra từ phần trăm**. Nên phần lớn test ở đây là về phép suy đó, và
 * đặc biệt là về cái bẫy nó tránh — trường `limit` mà Cursor gửi kèm trông y hệt một cái
 * trần, nằm ngay cạnh `totalSpend`, và lấy nó chia thì ra 244% trong khi chính phản hồi
 * ấy nói 14%.
 *
 * Dữ liệu dưới đây là phản hồi THẬT, chép nguyên từ hai lượt gọi ngày 2026-07-26 (đã bỏ
 * mấy chuỗi quảng cáo dài). Bịa số cho tròn thì test không còn chứng minh được điều duy
 * nhất đáng chứng minh: rằng ba con số $300 / $45 / $345 rơi ra từ dữ liệu thật chứ không
 * phải từ một giả định thuận tay.
 */

const PERIOD = {
  billingCycleStart: '1783064339000',
  billingCycleEnd: '1785742739000',
  planUsage: {
    totalSpend: 4883,
    includedSpend: 2000,
    bonusSpend: 2883,
    limit: 2000,
    remainingBonus: false,
    autoPercentUsed: 15.726666666666667,
    apiPercentUsed: 3.6666666666666665,
    totalPercentUsed: 14.153623188405797,
  },
  displayThreshold: 200,
  enabled: true,
  displayMessage: "You've hit your usage limit",
  autoModelSelectedDisplayMessage: "You've used 14% of your included total usage",
  autoBucketModels: [
    'default',
    'composer-2.5',
    'composer-2.5-fast',
    'cursor-grok-4.5-high-fast',
    'grok-4.5-fast-xhigh',
  ],
};

const AGG = {
  aggregations: [
    { modelIntent: 'cursor-grok-4.5-high-fast', inputTokens: '3107136', outputTokens: '348488', cacheReadTokens: '24948608', totalCents: 3156.9393, tier: 2 },
    { modelIntent: 'composer-2.5', inputTokens: '3124562', outputTokens: '369217', cacheReadTokens: '27298028', totalCents: 794.65576, tier: 2 },
    { modelIntent: 'composer-2.5-fast', inputTokens: '452725', outputTokens: '67300', cacheReadTokens: '4777302', totalCents: 471.25915, tier: 2 },
    { modelIntent: 'default', inputTokens: '441155', outputTokens: '59716', cacheReadTokens: '7730359', totalCents: 284.23295, tier: 2 },
    { modelIntent: 'claude-opus-4-8-thinking-medium', inputTokens: '36', outputTokens: '10725', cacheWriteTokens: '139287', cacheReadTokens: '1019013', totalCents: 164.835525, tier: 1 },
    { modelIntent: 'grok-4.5-fast-xhigh', inputTokens: '43845', outputTokens: '1369', cacheReadTokens: '28032', totalCents: 11.4027, tier: 2 },
  ],
  totalInputTokens: '7169459',
  totalOutputTokens: '856815',
  totalCacheWriteTokens: '139287',
  totalCacheReadTokens: '65801342',
  totalCostCents: 4883.325385,
};

/** Giữa chu kỳ, để `forecast` có mẫu đủ dài mà chia. */
const NOW = 1785083000000;
const AT = NOW - 1000;

test('trần suy ngược ra ba số tròn, khớp tới từng đô', () => {
  const r = parseCursorUsage(PERIOD, AGG, AT, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.total.ceilCents, 34500);
  assert.equal(r.auto.ceilCents, 30000);
  assert.equal(r.named.ceilCents, 4500);
  // Hai nhóm cộng lại đúng bằng tổng. Không có gì trong phản hồi bắt buộc điều này, nên
  // nó là bằng chứng phép suy đúng chứ không phải một ràng buộc được áp đặt.
  assert.equal(r.auto.ceilCents + r.named.ceilCents, r.total.ceilCents);
});

test('`limit` KHÔNG được dùng làm trần — đó là giá gói', () => {
  const r = parseCursorUsage(PERIOD, AGG, AT, NOW);
  assert.notEqual(r.total.ceilCents, PERIOD.planUsage.limit);
  // Vẽ thẳng totalSpend/limit ra 244%; số thật là 14%. Khoảng cách ấy là toàn bộ lý do
  // module tồn tại, nên nó được viết ra thành một phép so, không chỉ nằm trong comment.
  const naive = (PERIOD.planUsage.totalSpend / PERIOD.planUsage.limit) * 100;
  assert.ok(naive > 200, `phép chia ngây thơ phải ra >200%, ra ${naive}`);
  assert.ok(r.total.used < 20);
  assert.equal(r.planCents, 2000);
});

test('phần trăm là số gốc: mất bảng model thì vẫn còn trần tổng', () => {
  const r = parseCursorUsage(PERIOD, null, AT, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.total.ceilCents, 34500, 'trần tổng chỉ cần totalSpend + phần trăm');
  // Hai nhóm mất trần vì không có chỗ nào khác chia tiền theo nhóm — nhưng phần trăm của
  // chúng do server gửi thẳng nên vẫn còn nguyên. Mất phần suy ra, không mất phần đo được.
  assert.equal(r.auto.ceilCents, null);
  assert.equal(r.auto.used, 15.726666666666667);
  assert.equal(r.models.length, 0);
  assert.equal(r.tokens, null);
});

test('chia nhóm theo autoBucketModels, không theo tier', () => {
  const r = parseCursorUsage(PERIOD, AGG, AT, NOW);
  const named = r.models.filter((m) => !m.auto).map((m) => m.model);
  assert.deepEqual(named, ['claude-opus-4-8-thinking-medium']);

  // Danh sách vắng mặt thì rơi về `tier`. Đây là nhánh dự phòng thật, không phải trang
  // trí: `autoBucketModels` là trường không có tài liệu như mọi trường khác ở đây.
  const noList = parseCursorUsage({ ...PERIOD, autoBucketModels: undefined }, AGG, AT, NOW);
  assert.deepEqual(
    noList.models.filter((m) => !m.auto).map((m) => m.model),
    ['claude-opus-4-8-thinking-medium'],
  );
});

test('số nguyên 64-bit về dạng CHUỖI vẫn ra số', () => {
  const r = parseCursorUsage(PERIOD, AGG, AT, NOW);
  assert.equal(r.tokens.inTok, 7169459);
  assert.equal(r.tokens.cr, 65801342);
  assert.equal(r.models[0].cr, 24948608);
  // Cộng lại phải khớp tổng server tự khai — nếu một trường lỡ thành `NaN` hay `0` thì
  // phép cộng này là chỗ duy nhất phát hiện ra.
  assert.equal(
    r.models.reduce((n, m) => n + m.out, 0),
    7169459 - 7169459 + 856815,
  );
});

test('bảng model xếp theo tiền, giảm dần', () => {
  const r = parseCursorUsage(PERIOD, AGG, AT, NOW);
  const cents = r.models.map((m) => m.cents);
  assert.deepEqual(cents, [...cents].sort((a, b) => b - a));
  assert.equal(r.models[0].model, 'cursor-grok-4.5-high-fast');
});

test('mỗi nhóm mang đúng hình dạng cửa sổ mà lib/quota.js ăn được', () => {
  const r = parseCursorUsage(PERIOD, AGG, AT, NOW);
  for (const b of [r.total, r.auto, r.named]) {
    for (const k of ['used', 'remaining', 'resetsAt', 'resetsInMs', 'expired', 'windowMs', 'elapsedFrac', 'forecast']) {
      assert.ok(k in b, `nhóm ${b.key} thiếu ${k}`);
    }
    assert.equal(b.resetsAt, 1785742739000);
    assert.equal(b.expired, false);
    assert.ok(b.elapsedFrac > 0 && b.elapsedFrac < 1);
  }
  // Đã tiêu 14% khi chu kỳ đã trôi ~75% → dự phóng thấp hơn hẳn trần. Đó là "bỏ phí",
  // đúng cái kết cục mà thanh hạn mức tô màu cảnh báo.
  assert.equal(r.total.forecast.known, true);
  assert.ok(r.total.forecast.projected < 30);
  assert.equal(r.total.forecast.willExhaust, false);
});

test('phản hồi hỏng thành `reason`, không thành ngoại lệ', () => {
  for (const body of [null, undefined, 'nope', 42, {}, { planUsage: null }, { planUsage: {} }]) {
    const r = parseCursorUsage(body, AGG, AT, NOW);
    assert.equal(r.ok, false, `${JSON.stringify(body)} phải hỏng có kiểm soát`);
    assert.ok(['broken', 'empty'].includes(r.reason));
  }
});

test('chu kỳ đã lăn qua mốc reset thì cờ `expired` bật', () => {
  const after = 1785742739000 + 3600_000;
  const r = parseCursorUsage(PERIOD, AGG, after - 1000, after);
  assert.equal(r.total.expired, true);
  assert.ok(r.cycle.resetsInMs < 0);
});

test('ceilingFrom: chia cho phần trăm gần 0 thì thà không có số', () => {
  assert.equal(ceilingFrom(4883, 14.153623188405797), 34500);
  // Đầu chu kỳ, chưa tiêu gì: không có gì để chia, và một con số bịa ở đây sẽ đi thẳng
  // lên thẻ hạn mức dưới dạng "$0 trên $12".
  assert.equal(ceilingFrom(0, 0), null);
  assert.equal(ceilingFrom(1, 0.001), null);
  assert.equal(ceilingFrom(null, 14), null);
  assert.equal(ceilingFrom(4883, null), null);
  // Làm tròn về đô chẵn: phép chia thật nhả ra 30003,1 vì `totalSpend` là số nguyên xu
  // đã cắt đuôi trong khi phần trăm thì không.
  assert.equal(ceilingFrom(4718.48986, 15.726666666666667), 30000);
});
