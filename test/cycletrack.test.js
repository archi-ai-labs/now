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

/* ── Sổ tự lành ở MỖI lượt ghi ───────────────────────────────────────────────── */

const WEEK = 7 * 86400_000;

/** Sổ bẩn đúng kiểu bản cũ ghi ra: mỗi ảnh chụp một khoá, mốc reset bò theo đồng hồ. */
const dirtyLedger = (n) => {
  const m = new Map();
  for (let i = 0; i < n; i++) {
    const at = AT + i * 5 * 60_000;
    m.set(`3p-weekly|${at + WEEK}`, {
      kind: '3p-weekly',
      resetsAt: at + WEEK,
      windowMs: WEEK,
      peak: 0,
      samples: 1,
      firstAt: at,
      lastAt: at,
    });
  }
  return m;
};

test('writeCycles gộp cửa sổ lăn và trả về map ĐÃ gộp', async () => {
  // Gộp chỉ ở `readCycles` thì một tiến trình chạy liền hai tuần là hai tuần không ai dọn,
  // vì bản ghi của cửa sổ lăn có mốc reset ở tương lai nên `trimCycles` miễn cắt cho nó.
  const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'cyc-')), 'ag-cycles.json');
  // Dọn xong là tin lành, nên nó phải đi stdout. `service.err.log` là chỗ người ta mở ra khi
  // nghi có sự cố, và mọi dòng khác của nhánh sổ chu kỳ ở đó đều là một lượt ghi hỏng.
  const out = [];
  const errs = [];
  const realLog = console.log;
  const realError = console.error;
  console.log = (...a) => out.push(a.join(' '));
  console.error = (...a) => errs.push(a.join(' '));
  let kept;
  try {
    kept = await writeCycles(dirtyLedger(20), file, AT + 100 * 60_000);
  } finally {
    console.log = realLog;
    console.error = realError;
  }
  assert.equal(kept.size, 1, 'map trả về phải là map đã gộp, không thì bộ nhớ lệch với đĩa');
  assert.equal([...kept.values()][0].samples, 20, 'samples của cả nhóm phải cộng dồn');
  assert.deepEqual(errs, [], 'dọn sổ thành công không được lẫn vào stderr');
  assert.equal(out.length, 1, 'phải có đúng một dòng báo dọn, và nó ở stdout');
  assert.match(out[0], /gộp 19 bản ghi của cửa sổ lăn \(20 → 1\)/);
  const onDisk = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(Object.keys(onDisk.cycles).length, 1, 'đĩa cũng phải sạch ngay lượt ghi này');
});

test('tracker: mười lượt gấp một ảnh chụp chỉ tính một lượt đọc', async () => {
  // Nhịp production: `ag.at` là thời điểm FETCH và ảnh chụp sống 5 phút, còn tracker được
  // gọi 30 giây một lần. Trước khi sửa, sáu ảnh chụp ra sáu khoá (một khoá gộp cộng năm
  // khoá rác `samples: 1`), và sổ AG thật phồng lên 158 KB theo đúng đường đó.
  //
  // Sáu lượt fetch ở đây chạy nối đuôi trong cùng một tick, tức sáu lượt ghi chồng lên
  // nhau. Nuốt được nhịp đó là phần việc của tên file tạm riêng từng lượt ghi
  // (`cyclesTmpPath`); test bắt luôn stderr để một lượt ghi hỏng không lặng lẽ trôi qua và
  // để khẳng định về nội dung file khỏi đọc trúng bản của lượt ghi cũ.
  const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'cyc-')), 'ag-cycles.json');
  const track = makeTracker(file);
  const errs = [];
  const realError = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  let last = null;
  try {
    for (let f = 0; f < 6; f++) {
      const at = AT + f * 5 * 60_000;
      for (let i = 0; i < 10; i++) last = await track([{ kind: '3p-weekly', resetsAt: at + WEEK, windowMs: WEEK, used: 40 + f }], at);
    }
    await track._flush();
  } finally {
    console.error = realError;
  }
  assert.deepEqual(errs, [], 'không lượt ghi nào được hỏng — mỗi lượt phải có file tạm riêng');
  assert.equal(last.size, 1, 'sáu ảnh chụp của một cửa sổ đang lăn phải nằm chung một hàng');
  assert.equal([...last.cycles.values()][0].kind, '3p-weekly');
  // Chỉ khẳng định SỐ KHOÁ, không khẳng định `samples`: tracker ghi đĩa không await rồi mới
  // gán lại memo, nên một lượt ghi về muộn có thể kéo memo lùi về ảnh chụp cũ. Số khoá thì
  // miễn nhiễm với chuyện đó vì mọi bản trung gian đều đúng một khoá. Phép cộng `samples`
  // và MAX của đỉnh đã được khoá ở `quotalog.test.js`, nơi gọi thẳng `bumpWindows`.
  const onDisk = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(Object.keys(onDisk.cycles).length, 1, 'đĩa cũng chỉ được có một hàng');
  assert.deepEqual(await fs.readdir(path.dirname(file)), ['ag-cycles.json'], 'không được để lại file tạm');
});
