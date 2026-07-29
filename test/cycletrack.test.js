import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseAgQuota } from '../src/collect/agquota.js';
import { parseCursorUsage } from '../src/collect/cursor.js';
import { agCycleWindows, cursorCycleWindows, makeTracker } from '../src/collect/cycletrack.js';
import { bumpWindows, readCycles, writeCycles } from '../src/collect/quotalog.js';

/**
 * Sổ chu kỳ AG/Cursor — cùng lý do với `quotalog.test.js`: ghi sai là không dựng lại
 * được. Test bám vào hai chỗ RIÊNG của phần mở rộng này: phép ánh xạ từ hai payload khác
 * hẳn nhau về cùng một khuôn cửa sổ, và các trường ngoài lõi (`unit`, `planCents`…) phải
 * sống sót qua vòng đọc-ghi-nhập-lại — ca rụng-trường là lỗi ĐÃ suýt xảy ra khi viết
 * (bản ghi được dựng lại từ đầu ở mỗi lượt nhập, quên chép `prev` là các trường ấy lặng
 * lẽ biến mất sau lần khởi động lại tiến trình đầu tiên).
 */

const AT = Date.UTC(2026, 6, 28, 13, 30, 0);

/** Payload AG đúng hình dạng server trả — số chép từ máy thật 28/7. */
const AG_BODY = {
  response: {
    groups: [
      {
        displayName: 'Gemini Models',
        description: 'Models within this group: Gemini Flash, Gemini Pro',
        buckets: [
          {
            bucketId: 'gemini-weekly',
            displayName: 'Weekly Limit',
            window: 'weekly',
            remainingFraction: 0.090806015,
            resetTime: '2026-07-29T01:04:42Z',
          },
          {
            bucketId: 'gemini-5h',
            displayName: 'Five Hour Limit',
            window: '5h',
            remainingFraction: 0.6370353,
            resetTime: '2026-07-28T16:04:13Z',
          },
        ],
      },
      {
        displayName: 'Claude and GPT models',
        description: 'Models within this group: Claude Opus, Claude Sonnet, GPT-OSS',
        buckets: [
          { bucketId: '3p-weekly', window: 'weekly', remainingFraction: 0.129, resetTime: '2026-07-31T17:53:18Z' },
          { bucketId: '3p-5h', window: '5h', remainingFraction: 0.01, resetTime: '2026-07-28T15:36:31Z' },
        ],
      },
    ],
  },
};

/** Payload Cursor rút gọn tới đúng phần `parseCursorUsage` cần — số thật 28/7. */
const CU_BODY = {
  planUsage: {
    totalSpend: 6217,
    includedSpend: 2000,
    bonusSpend: 4217,
    totalPercentUsed: 18.02,
    autoPercentUsed: 19.87,
    apiPercentUsed: 5.67,
  },
  billingCycleStart: '1783064339000',
  billingCycleEnd: '1785742739000',
};

/* ── Ánh xạ payload → cửa sổ ─────────────────────────────────────────────────── */

test('AG: đủ bốn túi, khoá theo bucketId, used là phần ĐÃ TIÊU', () => {
  const ws = agCycleWindows(parseAgQuota(AG_BODY, AT, AT));
  assert.equal(ws.length, 4);
  assert.deepEqual(
    ws.map((w) => w.kind).sort(),
    ['3p-5h', '3p-weekly', 'gemini-5h', 'gemini-weekly'],
    'kind phải là bucketId — định danh server đặt, không phải chuỗi hiển thị',
  );
  const gw = ws.find((w) => w.kind === 'gemini-weekly');
  // Server nói CÒN 9,08% — sổ ghi ĐÃ TIÊU 90,9%. Nhầm chiều ở đây là sai đúng bằng phần
  // bù, và trông hoàn toàn hợp lý (đã có tiền lệ, xem đầu collect/agquota.js).
  assert.ok(Math.abs(gw.used - 90.9194) < 0.01, `used phải là phần đã tiêu, ra ${gw.used}`);
  assert.equal(gw.resetsAt, Date.parse('2026-07-29T01:04:42Z'));
  assert.equal(gw.windowMs, 7 * 24 * 3600_000);
});

test('AG: lượt đọc hỏng thì không có cửa sổ nào, không ném', () => {
  assert.deepEqual(agCycleWindows({ ok: false, reason: 'not-running' }), []);
  assert.deepEqual(agCycleWindows(null), []);
});

test('Cursor: một cửa sổ billing, peak là CENTS, ngữ cảnh gói đi kèm', () => {
  const ws = cursorCycleWindows(parseCursorUsage(CU_BODY, null, AT, AT));
  assert.equal(ws.length, 1);
  const w = ws[0];
  assert.equal(w.kind, 'billing');
  assert.equal(w.used, 6217, 'peak của sổ Cursor là cents đã tiêu, không phải một trong ba con số %');
  assert.equal(w.resetsAt, 1785742739000);
  assert.equal(w.windowMs, 1785742739000 - 1783064339000);
  assert.deepEqual(w.extra, { unit: 'cents', planCents: 2000, bonusCents: 4217 });
});

test('Cursor: thiếu mốc chu kỳ thì không bịa cửa sổ', () => {
  const { billingCycleEnd, ...noEnd } = CU_BODY;
  assert.deepEqual(cursorCycleWindows(parseCursorUsage(noEnd, null, AT, AT)), []);
});

/* ── Trường ngoài lõi phải sống qua đọc-ghi-nhập lại ─────────────────────────── */

test('extra sống sót qua ghi đĩa, đọc lại, và một lượt nhập KHÔNG mang extra', async () => {
  const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'cyc-')), 'cursor-cycles.json');
  const w0 = cursorCycleWindows(parseCursorUsage(CU_BODY, null, AT, AT));

  let m = bumpWindows(new Map(), AT, w0);
  await writeCycles(m, file, AT);
  m = await readCycles(file); // tiến trình "khởi động lại"

  // Lượt nhập sau: tiêu thêm, và cố tình KHÔNG gửi extra — như một nguồn chỉ biết lõi.
  m = bumpWindows(m, AT + 60_000, [{ kind: 'billing', resetsAt: 1785742739000, windowMs: null, used: 6300 }]);
  const c = [...m.values()][0];
  assert.equal(c.peak, 6300);
  assert.equal(c.samples, 2);
  assert.equal(c.unit, 'cents', 'trường ngoài lõi phải được chép từ bản ghi cũ, không được rụng');
  assert.equal(c.planCents, 2000);
  assert.equal(c.windowMs, 1785742739000 - 1783064339000, 'windowMs thiếu ở lượt sau thì giữ của lượt trước');
});

/* ── Tracker ─────────────────────────────────────────────────────────────────── */

test('tracker bỏ qua lượt đọc hỏng — không tạo sổ, không ném', async () => {
  const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'cyc-')), 'ag-cycles.json');
  const track = makeTracker(file);
  const r1 = await track([], AT); // nguồn hỏng → không cửa sổ
  const r2 = await track(agCycleWindows(null), undefined); // thiếu mốc thời gian đọc
  assert.equal(r1.size, 0);
  assert.equal(r2.size, 0);
  await assert.rejects(fs.access(file), 'không có gì để ghi thì không được đẻ file');
});
