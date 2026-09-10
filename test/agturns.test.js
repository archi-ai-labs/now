import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { CTX_BANDS, digest, parseGenRow, parseStepTimes, scanVerdict } from '../src/collect/agturns.js';
import { agTab } from '../public/views/tools.js';
import { esc, rawText } from '../public/lib/dom.js';
import { t } from '../public/lib/i18n.js';

/**
 * Lượt gọi model của Antigravity, đọc từ `gen_metadata`.
 *
 * Protobuf ở đây KHÔNG có schema công bố, nên mọi số hiệu trường trong `parseGenRow` là kết
 * quả dò trên máy thật. Điều đó làm test này quan trọng hơn hẳn một test bóc-dữ-liệu thường:
 * nó là chỗ duy nhất ghi lại hình dạng đã dò được: đổi một số hiệu là test đỏ, thay vì màn
 * hình lặng lẽ hiện 0 lượt.
 *
 * Buffer dựng TAY, không đọc file `.db` nào: máy chạy CI không có Antigravity, và một test
 * chỉ chạy được trên đúng máy của một người thì không phải lưới chặn.
 *
 * Nhưng buffer dựng tay chỉ khoá được thứ người viết test đã biết. Antigravity 2.12.2 đổi
 * hình dạng hôm 19/8 và cả file này vẫn xanh suốt ba tuần trong lúc màn hình hiện 0 lượt,
 * vì mọi buffer ở đây đều dựng theo hình dạng CŨ. Nên phần cuối file thêm một hàng THẬT,
 * chép nguyên byte ra khỏi `gen_metadata` của bản 2.12.2.
 */

/* ── Dựng protobuf bằng tay ───────────────────────────────────────────────── */

const varint = (n) => {
  const out = [];
  let v = BigInt(n);
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v) b |= 0x80;
    out.push(b);
  } while (v);
  return Buffer.from(out);
};

const tag = (field, wire) => varint((field << 3) | wire);
const vint = (field, n) => Buffer.concat([tag(field, 0), varint(n)]);
const bytes = (field, buf) => Buffer.concat([tag(field, 2), varint(buf.length), buf]);
const text = (field, s) => bytes(field, Buffer.from(s, 'utf8'));
const msg = (field, ...parts) => bytes(field, Buffer.concat(parts));

/** `google.protobuf.Timestamp` — giây ở trường 1, nano ở trường 2. */
const stamp = (field, ms) => msg(field, vint(1, Math.floor(ms / 1000)), vint(2, (ms % 1000) * 1e6));

/** Một hàng `gen_metadata` như đã dò được trên Antigravity 2.3.1. */
function genRow({ ts, model = 'gemini-3.6-flash', name = 'Gemini 3.6 Flash (High)', ctx = 36_364, ctxMax = 256_000, out = 79 }) {
  const inner = Buffer.concat([
    msg(4, vint(1, 1071), vint(2, 3367), vint(3, out), vint(5, 24_457)),
    msg(9, stamp(4, ts), msg(10, vint(1, ctx), vint(4, ctxMax))),
    text(19, model),
    text(21, name),
  ]);
  return Buffer.concat([msg(1, inner)]);
}

const DAY = 86_400_000;
const NOW = Date.parse('2026-07-27T12:00:00Z');

/* ── Bóc một hàng ─────────────────────────────────────────────────────────── */

test('bóc đủ mọi chiều cần thiết từ một hàng gen_metadata', () => {
  const r = parseGenRow(genRow({ ts: NOW - DAY }));
  assert.equal(r.ts, NOW - DAY);
  assert.equal(r.model, 'gemini-3.6-flash');
  assert.equal(r.name, 'Gemini 3.6 Flash (High)');
  assert.equal(r.ctx, 36_364);
  assert.equal(r.ctxMax, 256_000);
  assert.equal(r.out, 79);
});

test('tên hiển thị vắng thì lùi về mã model, không để trống', () => {
  // Trường 21 mới có từ một bản Antigravity nào đó; bản cũ hơn chỉ có mã ở trường 19. Để
  // trống thì hàng ấy dồn vào nhóm "—" và biến mất khỏi chart theo model.
  const inner = Buffer.concat([msg(9, stamp(4, NOW)), text(19, 'gemini-3.1-pro')]);
  const r = parseGenRow(Buffer.concat([msg(1, inner)]));
  assert.equal(r.name, 'gemini-3.1-pro');
});

test('hàng không có mốc thời gian bị loại, không lọt vào tổng', () => {
  // Lọt vào thì nó cộng vào mấy tổng chung nhưng không vào được chart theo ngày — hai con
  // số cạnh nhau lại phủ hai khoảng khác nhau mà không có gì nói ra.
  const inner = Buffer.concat([text(19, 'gemini-3.6-flash'), msg(9, msg(10, vint(1, 100), vint(4, 256_000)))]);
  assert.equal(parseGenRow(Buffer.concat([msg(1, inner)])), null);
});

test('blob rác trả null chứ không ném', () => {
  assert.equal(parseGenRow(Buffer.from([0xff, 0xff, 0xff])), null);
  assert.equal(parseGenRow(Buffer.alloc(0)), null);
});

test('thiếu trần ngữ cảnh vẫn giữ được lượt, chỉ mất phép chia', () => {
  const inner = Buffer.concat([msg(9, stamp(4, NOW), msg(10, vint(1, 5000))), text(19, 'm')]);
  const r = parseGenRow(Buffer.concat([msg(1, inner)]));
  assert.equal(r.ctx, 5000);
  assert.equal(r.ctxMax, null);
});

/* ── Gộp ──────────────────────────────────────────────────────────────────── */

const turn = (o) => ({ convo: 'c1', out: 100, ctx: 50_000, ctxMax: 256_000, name: 'M', model: 'm', ...o });

test('ngưỡng ngày cắt lượt cũ khỏi MỌI bảng, không chỉ khỏi chart theo ngày', () => {
  const d = digest([turn({ ts: NOW - 2 * DAY }), turn({ ts: NOW - 40 * DAY })], { now: NOW, keepDays: 14 });
  assert.equal(d.turns, 1);
  assert.equal(d.models[0].turns, 1);
  assert.equal(d.byConvo.c1.turns, 1);
});

test('ngữ cảnh dùng TRUNG VỊ, không dùng trung bình', () => {
  // Trung bình bị một lượt 250k kéo lệch hẳn; trung vị thì không. Cả chart lẫn thẻ đều đọc
  // trị này như "một lượt điển hình", nên phép trung bình sẽ nói sai đúng câu ấy.
  const ts = NOW - DAY;
  const d = digest([10_000, 20_000, 250_000].map((ctx) => turn({ ts, ctx })), { now: NOW });
  assert.equal(d.ctxMedian, 20_000);
  assert.equal(d.series[0].ctxMedian, 20_000);
  assert.equal(d.series[0].ctx, 280_000, 'tổng vẫn còn nguyên cho bảng số');
});

test('băng độ đầy chia theo TỈ LỆ với trần của chính lượt đó', () => {
  // 120k là thoải mái trong cửa sổ 256k nhưng đã tràn trong cửa sổ 128k — chia theo một trần
  // cố định thì hai lượt này rơi cùng băng, và băng "sát trần" mất đúng ca đáng báo động.
  const d = digest(
    [turn({ ts: NOW, ctx: 120_000, ctxMax: 256_000 }), turn({ ts: NOW, ctx: 120_000, ctxMax: 128_000 })],
    { now: NOW },
  );
  const at = (key) => d.ctxBands.find((b) => b.key === key).turns;
  assert.equal(at('b25'), 1, '120k/256k = 47% → băng 25–50%');
  assert.equal(at('b90'), 1, '120k/128k = 94% → băng ≥90%');
});

test('lượt thiếu trần không vào băng nào, và `banded` nói ra chỗ hụt', () => {
  // Im lặng ở đây thì tổng mấy băng nhỏ hơn tổng số lượt mà không có gì giải thích, và
  // người đọc sẽ trừ hai con số đó cho nhau.
  const d = digest([turn({ ts: NOW }), turn({ ts: NOW, ctxMax: null })], { now: NOW });
  assert.equal(d.turns, 2);
  assert.equal(d.banded, 1);
});

test('băng rỗng vẫn còn hàng — "không lượt nào sát trần" là một kết luận', () => {
  const d = digest([turn({ ts: NOW, ctx: 1000 })], { now: NOW });
  assert.equal(d.ctxBands.length, CTX_BANDS.length);
  assert.equal(d.ctxBands.at(-1).turns, 0);
});

test('rỗng trả về ĐỦ khoá của nhánh thường', () => {
  // Thiếu khoá thì chỗ gọi phải nhớ dùng `?.` ở đúng những chỗ nào, mà trí nhớ ấy hỏng lặng lẽ.
  const empty = digest([], { now: NOW });
  const full = digest([turn({ ts: NOW })], { now: NOW });
  assert.deepEqual(Object.keys(empty).sort(), Object.keys(full).sort());
});

test('gộp theo ngày ĐỊA PHƯƠNG, không cắt chuỗi ISO', () => {
  // Một lượt lúc 23:30 giờ địa phương nằm ở ngày hôm sau theo UTC. Cắt chuỗi ISO thì nó
  // nhảy sang cột hôm sau, và cột "hôm nay" hụt đi đúng những lượt làm khuya.
  const late = new Date(2026, 6, 20, 23, 30).getTime();
  const d = digest([turn({ ts: late })], { now: late + 1000, keepDays: 14 });
  assert.equal(d.series[0].day, '2026-07-20');
});

test('model xếp theo số lượt, và bảng theo model khớp tổng chung', () => {
  const d = digest(
    [
      turn({ ts: NOW, name: 'Flash' }),
      turn({ ts: NOW, name: 'Pro' }),
      turn({ ts: NOW, name: 'Pro' }),
    ],
    { now: NOW },
  );
  assert.deepEqual(d.models.map((m) => [m.key, m.turns]), [['Pro', 2], ['Flash', 1]]);
  assert.equal(d.models.reduce((n, m) => n + m.turns, 0), d.turns);
});

/* ── Hàng THẬT của Antigravity 2.12.2 ─────────────────────────────────────── */

/**
 * Một hàng `gen_metadata` chép nguyên byte từ máy thật, ngày 2026-09-10.
 *
 * Lấy bằng `sqlite3 "file:$HOME/.gemini/antigravity/conversations/<id>.db?mode=ro"
 * 'select hex(data) from gen_metadata limit 1'`. KHÔNG cắt bớt trường nào, kể cả khối 400
 * byte không đọc ra nghĩa ở trường 8: cắt đi là quay lại đúng chỗ hỏng cũ, tức là một
 * buffer dựng theo hình dạng mà người viết test tưởng là đúng.
 *
 * Hàng này không mang Timestamp ở 9.4 và không mang tên hiển thị ở 21 — hai trường mà bản
 * ≤ 2.3.1 vẫn có. Mốc thời gian của nó phải tra qua nhãn `last_step_index` sang bảng
 * `steps`; xem sơ đồ ở đầu `src/collect/agturns.js`.
 */
const REAL_GEN_ROW_2_12_2 = Buffer.from(
  `1202090A222466363766393130352D666362632D343233652D626565342D613734336332333839383632429003889CB630A5C5C9
   30F0B18F31F6B18F31FBCFF23182D0F23193E3F431C1C8FD31BAB28332BFB28332E2F78332EDF78332ACC4AE32B3C4AE32D0EDB0
   32D3EDB032F090B332F290B332D4D2B832E8EDBA32EAEDBA32A1F5BA32A6F5BA3283FFBC32CDD1BD32CFD1BD328FB0BE32C3ECBE
   32CFECBE32D1ECBE32BF82C0328EA5C23296A5C232FDBCC4328ABDC4328BBDC432A0BDC432A1BDC432B6BDC432E0D4C632E5D4C6
   32F7D4C632B886C732ADD9C732AFD9C7329487C83293BCC8329CD1C9329ED1C93291EFCB32AEEFCB32889FCC32D5D6CC32ECD6CC
   32B791CD32B991CD328493CD328793CD32CDA2CD32CFA2CD32F2A5CE32D4C1CE32E4D5D332D4EFD532CFDDD632DFF7D632DE84D7
   32E284D732FEFCDC32AAD4DD32ACD4DD32B1D4DD32B3D4DD32E9FADE32EBFADE32D2EFDF32D7DEE132D9DEE13281D9E23283D9E2
   32B5F6E432E0FCE432D2FDE432F69DE7328DADE83291ADE832C6B5E832C4B8E832EFD2E9329F82EA32A682EA32B787EA32BF87EA
   32FCE5EC32FEE5EC32AAFEEC3287FCED3289FCED3290FCED3292FCED320ACE0418A60A227708A60A10D1271860288C7F30183A28
   626F742D61353561383235312D386337622D343336382D393565302D66366233316532306538383742210A0973657373696F6E49
   4412142D333735303736333033343336323839353537394823503D5A176F725369616F4F624E37614D316538507634657069516F
   4A1510FFFFFFFFFFFFFFFFFF01520808C2DF012080D00F5A08080210F2E1B9C402620510ADA6B6078A018A01127708A60A10D127
   1860288C7F30183A28626F742D61353561383235312D386337622D343336382D393565302D66366233316532306538383742210A
   0973657373696F6E494412142D333735303736333033343336323839353537394823503D5A176F725369616F4F624E37614D3165
   38507634657069516F220F6337633930396363613931633164619A011067656D696E692D332E382D666C617368A201240A0A6D6F
   64656C5F656E756D12164D4F44454C5F504C414345484F4C4445525F4D333138A201350A0D7472616A6563746F72795F69641224
   66353765336439372D663030382D343538362D613666642D373336636430386362396437A201340A0A726571756573745F696412
   2666353765336439372D663030382D343538362D613666642D3733366364303863623964372D34A201140A0B757365645F636C61
   756465120566616C7365A201210A18757365645F636C617564655F636F6E736572766174697665120566616C7365A2011E0A1575
   7365645F6E6F6E5F67656D696E695F6D6F64656C120566616C7365A201140A0F6C6173745F737465705F696E646578120138`.replace(
    /\s+/g,
    '',
  ),
  'hex',
);

/**
 * Ba dòng THẬT như `STEP_SQL` in ra: `idx|hex(32 byte đầu của steps.metadata)`.
 *
 * Cùng file `.db`, cùng ngày. Bước số 8 là bước mà hàng trên trỏ tới qua nhãn
 * `last_step_index`, còn 7 và 9 nằm đây để test bắt được ca tra nhầm sang bước bên cạnh.
 */
const REAL_STEP_ROWS = [
  '7|0A0B08A1E98AD5061090B3A24B1802320C08A2E98AD50610B0DC86EC013A0C08',
  '8|0A0C08A2E98AD50610D898B4EC01180222E1020A0B63616C6C5F333738333738',
  '9|0A0C08A2E98AD50610F8EDCB88021802320B08A5E98AD50610B8AAF4703A0B08',
].join('\n');

/** Mốc của bước 8, đọc ra từ chính ba dòng trên. */
const REAL_TS = Date.parse('2026-09-10T13:46:10.496Z');

test('hàng THẬT của Antigravity 2.12.2 vẫn ra đủ một lượt gọi', () => {
  // Đỏ ở đây nghĩa là collector lại mù đúng như quãng 19/8 → 10/9: file mở được, hàng có
  // đó, mà tab Antigravity hiện 0 lượt và không có cảnh báo nào.
  const r = parseGenRow(REAL_GEN_ROW_2_12_2, parseStepTimes(REAL_STEP_ROWS));
  assert.ok(r, 'parseGenRow trả null trên hàng thật — hình dạng đã đổi lần nữa');
  assert.equal(r.ts, REAL_TS);
  assert.equal(r.model, 'gemini-3.8-flash');
  // Bản 2.12.2 bỏ trường 21, nên tên hiển thị lùi về mã model chứ không rơi vào nhóm "—".
  assert.equal(r.name, 'gemini-3.8-flash');
  assert.equal(r.ctx, 28_610);
  assert.equal(r.ctxMax, 256_000);
  assert.equal(r.out, 96);
});

test('hàng 2.12.2 KHÔNG tự mang mốc thời gian — thiếu bảng steps là mất trắng hàng đó', () => {
  // Đây chính là ca đã giấu ba tuần dữ liệu. Giữ lại để lần sau ai bỏ lượt đọc bảng `steps`
  // đi thì thấy ngay cái giá của nó, chứ không phải nhìn một con số 0 trông rất bình thường.
  assert.equal(parseGenRow(REAL_GEN_ROW_2_12_2), null);
  assert.equal(parseGenRow(REAL_GEN_ROW_2_12_2, new Map()), null);
});

test('tra đúng bước mà nhãn trỏ tới, không phải bước bên cạnh', () => {
  const times = parseStepTimes(REAL_STEP_ROWS);
  assert.equal(times.size, 3);
  assert.equal(times.get(8), REAL_TS);
  assert.notEqual(times.get(7), times.get(8));
  assert.notEqual(times.get(9), times.get(8));
});

test('hàng thiếu nhãn last_step_index không được nhận mốc của bước 0', () => {
  // `Number(null)` ra 0, mà 0 là một `steps.idx` có thật. Không chặn thì mọi hàng thiếu nhãn
  // đều dồn về đúng một mốc, và chart theo ngày mọc lên một cột giả ngay đầu hội thoại.
  const inner = Buffer.concat([text(19, 'gemini-3.8-flash'), msg(9, msg(10, vint(1, 100), vint(4, 256_000)))]);
  const times = new Map([[0, NOW]]);
  assert.equal(parseGenRow(Buffer.concat([msg(1, inner)]), times), null);
});

test('parseStepTimes bỏ qua dòng rác thay vì ném hoặc dựng khoá bịa', () => {
  const times = parseStepTimes(['', 'không có gạch đứng', 'x|0A0C08A2E98AD50610D898B4EC01', '3|', '4|ZZZZ'].join('\n'));
  assert.equal(times.size, 0);
});

/* ── Nói ra khi hình dạng đã đổi ──────────────────────────────────────────── */

test('mọi file có hàng mà không bóc được hàng nào → ok:false, reason shape', () => {
  // Cùng hợp đồng với `parseSummaries` bên `collect/antigravity.js`, vì giao diện đọc
  // `reason` từ một chỗ chung.
  assert.deepEqual(scanVerdict({ seen: 8_119, parsed: 0 }), { ok: false, reason: 'shape' });
});

test('chưa có hàng nào để đọc thì KHÔNG phải hỏng', () => {
  // Máy chưa cài Antigravity, hoặc cài rồi mà chưa mở hội thoại nào. Báo hỏng ở đây là dựng
  // lên một sự cố không có thật.
  assert.deepEqual(scanVerdict({ seen: 0, parsed: 0 }), { ok: true });
  assert.deepEqual(scanVerdict(), { ok: true });
});

test('hỏng MỘT PHẦN vẫn giữ ok:true, để phần đọc được còn lên hình', () => {
  // Giao diện ẩn nguyên khối chart khi `ok:false`. Trả `ok:false` lúc còn 12 lượt đọc được
  // là đổi một chỗ đếm hụt lấy một chỗ trắng hoàn toàn; ca này nói bằng `shape` và `rows`.
  assert.deepEqual(scanVerdict({ seen: 400, parsed: 12 }), { ok: true });
});

/* ── Đọc file `.db` thật ───────────────────────────────────────────────────── */

/**
 * Mấy test dưới đây chạy `collectAgTurns` trên một file `.db` thật, không phải trên hàm thuần.
 *
 * Chúng có mặt vì bản sửa quan trọng nhất của module này, tức là việc mở qua `mode=ro` để
 * SQLite không checkpoint WAL vào file chính, nằm đúng chỗ mà mọi test bóc-protobuf ở trên
 * không với tới. Bỏ chữ `?mode=ro` đi thì phần trên của file này vẫn xanh nguyên, trong khi
 * dashboard quay lại tự đẩy mtime của hội thoại rồi đọc chính dấu tay của mình thành hoạt động.
 *
 * `ANTIGRAVITY_CONVOS` dựng từ `os.homedir()` ngay lúc nạp `config.js`, nên đường duy nhất
 * trỏ nó sang thư mục tạm là chạy hẳn một tiến trình Node con với `HOME` ghi đè.
 */

const AG_MOD = new URL('../src/collect/agturns.js', import.meta.url).href;
const ANTI_MOD = new URL('../src/collect/antigravity.js', import.meta.url).href;

/** Máy CI không cài `sqlite3`, và mấy test cần nó thì bỏ qua chứ không được đỏ vì lý do ấy. */
const SQLITE = (() => {
  try {
    execFileSync('sqlite3', ['-version'], { stdio: 'ignore' });
    return false;
  } catch {
    return 'máy này không có sqlite3';
  }
})();

function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'now-ag-'));
  fs.mkdirSync(path.join(home, '.gemini', 'antigravity', 'conversations'), { recursive: true });
  return home;
}

const convoFile = (home, id) => path.join(home, '.gemini', 'antigravity', 'conversations', `${id}.db`);

/** Chạy một đoạn ESM trong tiến trình con có `HOME` trỏ vào thư mục tạm, trả về JSON nó in ra. */
function inFakeHome(home, code, args = []) {
  const runner = path.join(home, `run-${crypto.randomBytes(4).toString('hex')}.mjs`);
  fs.writeFileSync(runner, code);
  return JSON.parse(execFileSync(process.execPath, [runner, ...args], { env: { ...process.env, HOME: home }, encoding: 'utf8' }));
}

const collectIn = (home, convos, now) =>
  inFakeHome(
    home,
    `import { collectAgTurns } from ${JSON.stringify(AG_MOD)};\n` +
      'process.stdout.write(JSON.stringify(await collectAgTurns({ convos: JSON.parse(process.argv[2]), now: Number(process.argv[3]) })));\n',
    [JSON.stringify(convos), String(now)],
  );

const antigravityIn = (home, now) =>
  inFakeHome(
    home,
    `import { collectAntigravity } from ${JSON.stringify(ANTI_MOD)};\n` +
      'process.stdout.write(JSON.stringify(await collectAntigravity({ now: Number(process.argv[2]) })));\n',
    [String(now)],
  );

/**
 * Ghi vào `.db` rồi GIẾT `sqlite3` ngay sau khi lệnh chạy xong, để lại `-wal` chưa checkpoint.
 *
 * Đóng kết nối bình thường thì SQLite checkpoint hết WAL vào file chính rồi cắt `-wal` về 0
 * byte, nên một lượt ghi tử tế không dựng lại được ca cần khoá: hàng đã nằm trong `-wal`
 * trong khi `.db` chưa đổi lấy một byte. SIGKILL là cách rẻ nhất có được ca ấy.
 */
function writeLeavingWal(file, sql) {
  return new Promise((resolve, reject) => {
    const p = spawn('sqlite3', [file]);
    const bomb = setTimeout(() => p.kill('SIGKILL'), 10_000);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => {
      out += d;
      if (out.includes('READY')) p.kill('SIGKILL');
    });
    p.stderr.on('data', (d) => {
      err += d;
    });
    // Ghi tiếp vào stdin của một tiến trình vừa bị giết là EPIPE, và đó là kết cục đã tính.
    p.stdin.on('error', () => {});
    p.on('error', reject);
    p.on('exit', () => {
      clearTimeout(bomb);
      if (out.includes('READY')) resolve();
      else reject(new Error(`sqlite3 không chạy hết lệnh dựng: ${err.trim() || 'không có stderr'}`));
    });
    p.stdin.write(`pragma wal_autocheckpoint=0;\n${sql}\nselect 'READY';\n`);
  });
}

/**
 * Một hội thoại như Antigravity để lại: schema nằm trong `.db`, còn HÀNG nằm trong `-wal`.
 *
 * Chia đôi như vậy là có chủ đích. Hàng chỉ đọc ra được nếu lượt đọc nhìn cả WAL, nên test
 * dưới đồng thời khoá luôn việc lượt đầu KHÔNG được mang `immutable=1` (cờ đó bỏ qua WAL).
 * `steps: false` dựng ca hình dạng đổi: hàng vẫn có, nhưng mốc thời gian thì không tra được.
 * `keepWal: false` dựng ca ngược lại: hàng đã checkpoint vào `.db` và hai file bên cạnh bị
 * dọn sạch, tức là ca mà `mode=ro` không mở nổi và phải có nhánh dự phòng mới đọc được.
 */
async function makeConvo(home, id, { steps = true, keepWal = true } = {}) {
  const file = convoFile(home, id);
  execFileSync(
    'sqlite3',
    [
      file,
      [
        'pragma journal_mode=wal;',
        'create table gen_metadata (idx integer primary key, data blob);',
        steps ? 'create table steps (idx integer primary key, metadata blob);' : '',
      ].join('\n'),
    ],
    { stdio: 'ignore' },
  );
  const rows = [`insert into gen_metadata values (0, x'${REAL_GEN_ROW_2_12_2.toString('hex')}');`];
  if (steps) {
    for (const line of REAL_STEP_ROWS.split('\n')) {
      const [idx, hex] = line.split('|');
      rows.push(`insert into steps values (${idx}, x'${hex}');`);
    }
  }
  if (keepWal) {
    await writeLeavingWal(file, rows.join('\n'));
  } else {
    execFileSync('sqlite3', [file, rows.join('\n')], { stdio: 'ignore' });
    fs.rmSync(`${file}-wal`, { force: true });
    fs.rmSync(`${file}-shm`, { force: true });
  }
  return file;
}

const snap = (file) => ({
  md5: crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex'),
  mtimeMs: fs.statSync(file).mtimeMs,
  wal: fs.statSync(`${file}-wal`).size,
});

test('lượt quét không đổi lấy một byte của `.db` và không nuốt mất `-wal`', { skip: SQLITE }, async () => {
  const home = fakeHome();
  try {
    const file = await makeConvo(home, 'c-ro');
    const before = snap(file);
    assert.ok(before.wal > 0, 'dựng hỏng: `-wal` rỗng thì test này không khoá được gì');

    const r = collectIn(home, [{ id: 'c-ro' }], REAL_TS + 1000);
    const after = snap(file);

    assert.equal(r.turns, 1, 'không đọc ra lượt gọi nào: hàng nằm trong `-wal`, nên lượt đọc đã bỏ qua WAL');
    assert.equal(r.rows, 1);
    assert.equal(r.parsed, 1);
    assert.equal(r.shape, 0);
    assert.equal(r.unreadable, 0);

    assert.equal(after.md5, before.md5, 'lượt đọc đã ghi vào `.db`: mở đường đọc-ghi là checkpoint WAL vào file chính');
    assert.equal(after.mtimeMs, before.mtimeMs, 'mtime của `.db` nhảy, nên `collect/antigravity.js` sẽ đọc lại nó thành hoạt động');
    assert.equal(after.wal, before.wal, '`-wal` bị checkpoint mất, tức là lượt gọi vừa xảy ra đã bị dời chỗ');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('file mở được, có hàng, mà bóc ra 0 lượt → cả lượt quét trả ok:false', { skip: SQLITE }, async () => {
  // Đường này đi qua đúng `collectAgTurns`, không phải qua `scanVerdict` thuần: bộ đếm
  // `shape` nằm trong vòng lặp đọc file, và chỉ test hàm thuần thì gỡ nó đi vẫn xanh.
  const home = fakeHome();
  try {
    await makeConvo(home, 'c-shape', { steps: false });
    const r = collectIn(home, [{ id: 'c-shape' }], REAL_TS + 1000);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'shape');
    assert.equal(r.shape, 1);
    assert.equal(r.rows, 1, 'hàng thô vẫn phải được đếm, nếu không thì ca này lẫn với "chưa dùng bao giờ"');
    assert.equal(r.parsed, 0);
    assert.equal(r.turns, 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('`.db` mất cả `-wal` lẫn `-shm` vẫn đọc được, không bị khai là hỏng', { skip: SQLITE }, async () => {
  // Đo 2026-09-10: 3/547 file trong thư mục hội thoại đang ở đúng ca này, `.db` còn nguyên
  // mà hai file bên cạnh đã bị dọn. `mode=ro` trả SQLITE_CANTOPEN(14) vì mở WAL là phải dựng
  // lại chúng, nên bỏ nhánh dự phòng `immutable=1` đi là ba hội thoại ấy bị khai không đọc
  // được, dù chẳng có gì hỏng cả.
  const home = fakeHome();
  try {
    const file = await makeConvo(home, 'c-tron-trui', { keepWal: false });
    assert.equal(fs.existsSync(`${file}-wal`), false, 'dựng hỏng: còn `-wal` thì `mode=ro` mở được và ca này không xảy ra');

    const r = collectIn(home, [{ id: 'c-tron-trui' }], REAL_TS + 1000);
    assert.equal(r.unreadable, 0, 'hội thoại lành bị khai là không đọc được');
    assert.equal(r.turns, 1);
    assert.equal(fs.existsSync(`${file}-wal`), false, 'lượt đọc đã dựng lại `-wal`, tức là nó không còn chỉ đọc');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

/* ── Cửa sổ giữ đọc `-wal`, nhưng chỉ khi `-wal` còn byte ──────────────────── */

/** Sổ mục lục `agyhub_summaries_proto.pb` dựng tay, đúng hình dạng `parseSummaries` đọc. */
const summariesPb = (rows) =>
  Buffer.concat(
    rows.map((r) =>
      msg(1, text(1, r.id), msg(2, text(1, r.title), vint(2, r.steps), stamp(3, r.at), stamp(7, r.at), msg(9, text(1, 'file:///tmp/p')))),
    ),
  );

test('`-wal` RỖNG không kéo hội thoại nguội vào cửa sổ giữ, `-wal` còn byte thì có', () => {
  // Đo 2026-09-10: 543/547 hội thoại trên máy này mang một `-wal` rỗng với mtime của hôm
  // nay, do chính dashboard mở ra ở những lượt quét trước. Bỏ điều kiện "còn byte" đi thì
  // cửa sổ giữ phình từ 226 lên 334, và phần thêm ra toàn hội thoại đã nguội từ tháng trước.
  const home = fakeHome();
  try {
    const now = Date.now();
    const cold = now - 40 * DAY;
    fs.writeFileSync(
      path.join(home, '.gemini', 'antigravity', 'agyhub_summaries_proto.pb'),
      summariesPb([
        { id: 'wal-rong', title: 'nguội, chỉ bị mở ra đọc', steps: 3, at: cold },
        { id: 'wal-con-byte', title: 'nguội, nhưng còn hàng chưa checkpoint', steps: 3, at: cold },
      ]),
    );
    for (const id of ['wal-rong', 'wal-con-byte']) {
      const f = convoFile(home, id);
      fs.writeFileSync(f, '');
      fs.utimesSync(f, new Date(cold), new Date(cold));
    }
    fs.writeFileSync(`${convoFile(home, 'wal-rong')}-wal`, '');
    fs.writeFileSync(`${convoFile(home, 'wal-con-byte')}-wal`, Buffer.alloc(4096, 1));

    const r = antigravityIn(home, now);
    assert.equal(r.ok, true);
    assert.deepEqual(
      r.convos.map((c) => c.id),
      ['wal-con-byte'],
      'một `-wal` rỗng mtime hôm nay đủ kéo hội thoại 40 ngày tuổi vào cửa sổ giữ',
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

/* ── Giao diện phải NÓI RA khi hình dạng đã đổi ────────────────────────────── */

test('ok:false vì hình dạng đổi thì tab Antigravity nói ra, không để lại một khoảng trắng', () => {
  // Đây là nửa còn lại của `scanVerdict`. Tín hiệu `reason: 'shape'` mà không chỗ nào đọc
  // thì bản sửa chỉ đổi một số 0 im lặng lấy một khoảng trắng im lặng, và người dùng vẫn
  // không biết là Antigravity đã đổi cách ghi.
  const a = { convos: [{ id: 'c1', steps: 4, bytes: 1024, folder: 'now', sleeping: true }], total: 1, keepDays: 14 };
  const broken = rawText(agTab(a, { ok: false, reason: 'shape', shape: 7, rows: 8119, parsed: 0, turns: 0 }, NOW));
  assert.ok(broken.includes(esc(t('tools.agShape'))), 'tab không hiện tiêu đề "đã đổi hình dạng dữ liệu"');
  assert.ok(broken.includes(esc(t('tools.agShapeHint', { files: 7 }))), 'tab không hiện câu giải thích kèm số file đọc được');

  // Nhánh thường không được dính câu ấy, nếu không thì test trên xanh cả khi điều kiện hỏng.
  const fine = rawText(agTab(a, { ok: true, turns: 0, shape: 0, rows: 0, parsed: 0 }, NOW));
  assert.ok(!fine.includes(esc(t('tools.agShape'))), 'tab hiện cảnh báo hình dạng cả khi lượt quét lành');
});
