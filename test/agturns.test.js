import test from 'node:test';
import assert from 'node:assert/strict';
import { CTX_BANDS, digest, parseGenRow } from '../src/collect/agturns.js';

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
