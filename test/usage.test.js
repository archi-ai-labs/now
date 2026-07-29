import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUsageLine,
  normalizeModel,
  costOf,
  localDay,
  mergeRollup,
  inputSignature,
  PRICES,
} from '../src/collect/usage.js';

/**
 * Ba chỗ mà sai là dashboard nói dối mà KHÔNG hỏng: khử trùng lặp, quy đổi ngày
 * theo giờ máy, và gộp sổ. Cả ba đều trả về một con số trông hoàn toàn hợp lý.
 */

const LINE = JSON.stringify({
  type: 'assistant',
  requestId: 'req_A',
  uuid: 'uuid_A',
  timestamp: '2026-07-25T14:05:16.561Z',
  cwd: '/Users/x/Projects/demo',
  entrypoint: 'claude-desktop',
  sessionId: 'sess_1',
  isSidechain: false,
  attributionMcpServer: 'Claude Browser',
  message: {
    model: 'claude-opus-5',
    usage: {
      input_tokens: 2,
      output_tokens: 475,
      cache_creation_input_tokens: 24137,
      cache_read_input_tokens: 29940,
      cache_creation: { ephemeral_1h_input_tokens: 24137, ephemeral_5m_input_tokens: 0 },
      speed: 'standard',
    },
  },
});

test('bóc đủ mọi chiều cần thiết từ một dòng assistant', () => {
  const r = parseUsageLine(LINE);
  assert.equal(r.id, 'req_A');
  assert.equal(r.model, 'claude-opus-5');
  assert.equal(r.out, 475);
  assert.equal(r.cr, 29940);
  assert.equal(r.cw1, 24137, 'cache ghi TTL 1 giờ đắt gấp rưỡi mức 5 phút — không được gộp chung');
  assert.equal(r.cw5, 0);
  assert.equal(r.mcp, 'Claude Browser', 'nhãn quy trách nhiệm là thứ không suy ra được từ chỗ nào khác');
});

test('dòng không mang usage bị loại — user, tool result, meta chiếm phần lớn file', () => {
  assert.equal(parseUsageLine('{"type":"user","message":{"content":"chào"}}'), null);
  assert.equal(parseUsageLine(JSON.stringify({ type: 'assistant', message: { model: 'x' } })), null);
  assert.equal(parseUsageLine(''), null);
});

test('dòng cụt (file đang được ghi dở) trả null chứ không ném', () => {
  assert.equal(parseUsageLine(LINE.slice(0, 120)), null);
});

test('thiếu requestId thì lùi về uuid — nếu không là mất hẳn hàng đó', () => {
  const noReq = JSON.parse(LINE);
  delete noReq.requestId;
  assert.equal(parseUsageLine(JSON.stringify(noReq)).id, 'uuid_A');
});

/* ── Ngày địa phương ──────────────────────────────────────────────────────── */

test('timestamp UTC được quy về ngày ĐỊA PHƯƠNG, không cắt chuỗi', () => {
  // 2026-07-25T20:30Z ở UTC+7 đã là 26/07 lúc 03:30 sáng. Cắt mười ký tự đầu
  // cho ra 25/07 — tức là dồn nhầm cả buổi sáng sang ngày hôm trước.
  const iso = '2026-07-25T20:30:00.000Z';
  const expected = new Date(Date.parse(iso));
  const want = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
  assert.equal(localDay(iso), want);
  if (new Date().getTimezoneOffset() !== 0) {
    assert.notEqual(localDay(iso), iso.slice(0, 10), 'ngoài UTC thì cắt chuỗi phải cho kết quả KHÁC — đó là cả lý do hàm này tồn tại');
  }
});

test('mốc thời gian rác trả null chứ không NaN', () => {
  assert.equal(localDay('không phải ngày'), null);
  assert.equal(localDay(undefined), null);
});

/* ── Chữ ký đầu vào (điều kiện dùng lại cache) ────────────────────────────── */

/**
 * Chữ ký này thay cho cái đồng hồ 15 giây cũ, nên nó gánh nguyên trách nhiệm "khi nào
 * thì ĐƯỢC phép trả số cũ". Sai một chiều thì dashboard đứng hình mà vẫn trông như đang
 * sống; sai chiều kia thì cả phép cộng chạy lại mỗi nửa phút cho không.
 */
const SIG = (over = {}) =>
  inputSignature(
    over.entries ?? [
      ['/t/a.jsonl', 100],
      ['/t/b.jsonl', 250],
    ],
    over.today ?? '2026-07-28',
    over.hostCount ?? 3,
    over.winSig ?? '5h:1000:|7d:2000:',
  );

test('cùng đầu vào thì cùng chữ ký, kể cả khi readdir trả ngược thứ tự', () => {
  // `findTranscripts` đi theo thứ tự `readdir`, thứ không hứa hẹn gì giữa hai lượt.
  // Không sắp xếp thì một lượt đảo thứ tự là trượt memo mà chẳng có gì đổi thật.
  assert.equal(
    SIG(),
    SIG({
      entries: [
        ['/t/b.jsonl', 250],
        ['/t/a.jsonl', 100],
      ],
    }),
  );
});

test('file dài thêm một byte là chữ ký phải đổi', () => {
  assert.notEqual(
    SIG(),
    SIG({
      entries: [
        ['/t/a.jsonl', 101],
        ['/t/b.jsonl', 250],
      ],
    }),
  );
});

test('transcript mới xuất hiện hoặc bị dọn đi đều đổi chữ ký', () => {
  const thêm = SIG({
    entries: [
      ['/t/a.jsonl', 100],
      ['/t/b.jsonl', 250],
      ['/t/c.jsonl', 0],
    ],
  });
  const bớt = SIG({ entries: [['/t/a.jsonl', 100]] });
  assert.notEqual(SIG(), thêm);
  assert.notEqual(SIG(), bớt);
  assert.notEqual(thêm, bớt);
});

test('qua nửa đêm là chữ ký đổi dù đĩa đứng yên', () => {
  // Chuỗi ngày của chart cắt theo NGÀY HÔM NAY. Bỏ ngày ra khỏi chữ ký thì lúc 00:00
  // chart treo lại ở hôm qua cho tới khi có ai đó gõ một câu vào Claude.
  assert.notEqual(SIG(), SIG({ today: '2026-07-29' }));
});

test('sổ app chủ lớn lên, hoặc hạn mức vừa reset, cũng đổi chữ ký', () => {
  assert.notEqual(SIG(), SIG({ hostCount: 4 }));
  assert.notEqual(SIG(), SIG({ winSig: '5h:9999:|7d:2000:' }));
});

/* ── Chuẩn hoá model + giá ────────────────────────────────────────────────── */

test('hậu tố ngày và cửa sổ 1M vẫn là cùng một model một giá', () => {
  assert.equal(normalizeModel('claude-haiku-4-5-20251001'), 'claude-haiku-4-5');
  assert.equal(normalizeModel('claude-fable-5[1m]'), 'claude-fable-5');
  assert.equal(normalizeModel('claude-opus-5'), 'claude-opus-5');
});

test('model lạ trả null chứ không phải 0 — 0 trông y hệt "miễn phí"', () => {
  assert.equal(costOf({ model: '<synthetic>', day: '2026-07-25', inTok: 0, out: 0, cw: 0, cw5: 0, cw1: 0, cr: 0 }), null);
  assert.equal(costOf({ model: 'claude-tương-lai-9', day: '2026-07-25', inTok: 10, out: 10, cw: 0, cw5: 0, cw1: 0, cr: 0 }), null);
});

test('hệ số cache đúng: ghi 5 phút ×1,25 · ghi 1 giờ ×2 · đọc ×0,1 giá input', () => {
  const base = { model: 'claude-opus-5', day: '2026-07-25', inTok: 0, out: 0, cw: 0, cw5: 0, cw1: 0, cr: 0 };
  const p = PRICES['claude-opus-5'];
  const at = (over) => costOf({ ...base, ...over }) * 1e6;

  assert.equal(at({ inTok: 1e6 }) / 1e6, p.in);
  assert.equal(at({ out: 1e6 }) / 1e6, p.out);
  assert.equal(at({ cw5: 1e6 }) / 1e6, p.in * 1.25);
  assert.equal(at({ cw1: 1e6 }) / 1e6, p.in * 2);
  assert.equal(at({ cr: 1e6 }) / 1e6, p.in * 0.1);
});

test('bản ghi đời cũ không tách TTL thì dồn về mức 5 phút, không bỏ sót', () => {
  const old = { model: 'claude-opus-5', day: '2026-07-25', inTok: 0, out: 0, cw: 1e6, cw5: 0, cw1: 0, cr: 0 };
  assert.equal(costOf(old) * 1e6, PRICES['claude-opus-5'].in * 1.25 * 1e6);
});

test('giá giới thiệu áp theo NGÀY của lượt gọi, không theo hôm nay', () => {
  const row = { model: 'claude-sonnet-5', inTok: 1e6, out: 0, cw: 0, cw5: 0, cw1: 0, cr: 0 };
  const intro = PRICES['claude-sonnet-5'].intro;
  assert.equal(costOf({ ...row, day: '2026-07-25' }) * 1e6, intro.in * 1e6, 'trong hạn → giá giới thiệu');
  assert.equal(costOf({ ...row, day: '2026-09-01' }) * 1e6, PRICES['claude-sonnet-5'].in * 1e6, 'quá hạn → giá thường');
  assert.equal(costOf({ ...row, day: intro.until }) * 1e6, intro.in * 1e6, 'đúng ngày cuối vẫn còn trong hạn');
});

test('fast mode tính giá riêng, không lẫn với giá thường', () => {
  const row = { model: 'claude-opus-5', day: '2026-07-25', inTok: 0, out: 1e6, cw: 0, cw5: 0, cw1: 0, cr: 0 };
  assert.equal(costOf({ ...row, speed: 'fast' }) * 1e6, PRICES['claude-opus-5'].fast.out * 1e6);
  assert.equal(costOf({ ...row, speed: 'standard' }) * 1e6, PRICES['claude-opus-5'].out * 1e6);
});

/* ── Gộp sổ ───────────────────────────────────────────────────────────────── */

const day = (v) => new Map([['claude-opus-5', { msgs: v, inTok: v, out: v, cw5: v, cw1: v, cr: v }]]);

test('sổ giữ lại ngày mà transcript đã bị Claude Code dọn mất', () => {
  const saved = new Map([['2026-07-01', day(100)]]);
  const live = new Map([['2026-07-25', day(5)]]);
  const m = mergeRollup(saved, live);
  assert.equal(m.get('2026-07-01').get('claude-opus-5').out, 100, 'ngày cũ không còn trên đĩa vẫn phải còn trong sổ');
  assert.equal(m.get('2026-07-25').get('claude-opus-5').out, 5);
});

test('gộp lấy MAX — quét live đếm hụt không được phép xoá con số đã đúng', () => {
  // Đây là ca thật: một transcript của ngày hôm đó bị xoá giữa chừng, nên lượt
  // quét sau chỉ còn thấy một phần. Đè thẳng là tự tay làm hỏng lịch sử.
  const saved = new Map([['2026-07-20', day(1000)]]);
  const live = new Map([['2026-07-20', day(30)]]);
  assert.equal(mergeRollup(saved, live).get('2026-07-20').get('claude-opus-5').out, 1000);
});

test('ngày đang chạy vẫn tăng lên được — max không đóng băng hôm nay', () => {
  const saved = new Map([['2026-07-25', day(10)]]);
  const live = new Map([['2026-07-25', day(42)]]);
  assert.equal(mergeRollup(saved, live).get('2026-07-25').get('claude-opus-5').out, 42);
});

test('gộp không sửa vào sổ cũ đang giữ trong bộ nhớ', () => {
  const saved = new Map([['2026-07-20', day(1000)]]);
  mergeRollup(saved, new Map([['2026-07-20', day(9999)]]));
  assert.equal(saved.get('2026-07-20').get('claude-opus-5').out, 1000);
});

test('model mới xuất hiện trong ngày đã có sẵn thì được thêm, không đè', () => {
  const saved = new Map([['2026-07-20', day(50)]]);
  const live = new Map([['2026-07-20', new Map([['claude-fable-5', { msgs: 1, inTok: 1, out: 7, cw5: 0, cw1: 0, cr: 0 }]])]]);
  const merged = mergeRollup(saved, live).get('2026-07-20');
  assert.equal(merged.get('claude-opus-5').out, 50);
  assert.equal(merged.get('claude-fable-5').out, 7);
});
