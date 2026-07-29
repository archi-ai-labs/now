import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Sổ app chủ — file DUY NHẤT trong cả dashboard mà lượt quét tự ghi ra ngoài.
 *
 * File này đứng riêng, và đó không phải chuyện gu: `config.js` chốt `DATA_DIR` ngay lúc
 * nạp module, còn `import` tĩnh thì bị kéo lên TRƯỚC mọi dòng lệnh — nên đặt chung với
 * các ca khác (file nào cũng nạp `config.js` gián tiếp) là biến này được đọc trước khi
 * kịp trỏ đi chỗ khác, và bộ test ghi thẳng vào sổ THẬT của người dùng. Đã xảy ra một
 * lần: ba mục `s1`/`s2`/`mới` lọt vào `~/.now-dashboard/session-hosts.json`.
 *
 * Nên ở đây: đặt biến môi trường trước, `import` động sau, và ca đầu tiên kiểm tra
 * rằng file thật sự rơi vào thư mục tạm — để lần sau hàng rào có gãy thì test đỏ chứ
 * không âm thầm ghi bậy.
 */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'now-hosts-'));
process.env.NOW_DATA_DIR = tmp;

const { syncHosts, _reset } = await import('../src/collect/hosts.js');
const { SESSION_HOST_FILE } = await import('../src/config.js');

const NOW = Date.parse('2026-07-26T09:00:00+07:00');

/**
 * Chờ tới khi sổ TRÊN ĐĨA đạt trạng thái mong đợi.
 *
 * `flush` trong `collect/hosts.js` cố ý không await — đĩa chậm không được chặn lượt quét.
 * Nên phía test phải chờ, và bản trước chờ bằng `setTimeout(60)`: đủ khi máy rỗi, không đủ
 * khi cả bộ test chạy song song. Đo được: cứ khoảng sáu lượt `npm test` thì một lượt đỏ ở
 * ca "mục quá cũ bị cắt", và đỏ vì ĐUA chứ không vì mã sai — kiểu đỏ tệ nhất, vì nó dạy
 * người ta chạy lại cho tới khi xanh.
 *
 * Chờ theo ĐIỀU KIỆN thì không có ngưỡng nào để đoán: máy nhanh xong sau một nhịp, máy tải
 * nặng xong muộn hơn, và cả hai đều đúng.
 */
async function settleUntil(pred, ms = 3000) {
  const t0 = Date.now();
  for (;;) {
    let data = null;
    try {
      data = JSON.parse(fs.readFileSync(SESSION_HOST_FILE, 'utf8'));
    } catch {
      /* chưa có file, hoặc bắt đúng lúc đang đổi tên — thử lại */
    }
    if (data && pred(data)) return data;
    if (Date.now() - t0 > ms) throw new Error(`sổ không đạt trạng thái chờ trong ${ms}ms`);
    await new Promise((r) => setTimeout(r, 15));
  }
}

test('sổ ghi vào thư mục tạm, KHÔNG vào sổ thật của người dùng', () => {
  assert.ok(SESSION_HOST_FILE.startsWith(tmp), `sổ đang trỏ vào ${SESSION_HOST_FILE}`);
});

test('chỉ ghi thêm, không bao giờ ghi đè — phiên đã chạy ở đâu thì vĩnh viễn ở đó', async () => {
  _reset();
  await syncHosts(new Map([['s1', 'cursor']]), NOW);
  const book = await syncHosts(
    new Map([
      ['s1', 'vscode'],
      ['s2', 'antigravity'],
    ]),
    NOW,
  );
  assert.equal(book.get('s1').host, 'cursor', 'lần quan sát sau chỉ có thể làm sai đi');
  assert.equal(book.get('s2').host, 'antigravity');
});

test('không biết thì không ghi — để trống còn cơ hội, ghi null là đóng băng cái sai', async () => {
  _reset();
  const book = await syncHosts(new Map([['s3', null]]), NOW);
  assert.equal(book.has('s3'), false);
});

test('sổ sống sót qua khởi động lại — đó là toàn bộ lý do nó tồn tại', async () => {
  _reset();
  await syncHosts(new Map([['s4', 'cursor']]), NOW);
  await settleUntil((d) => d.sessions?.s4);
  _reset();
  const book = await syncHosts(new Map(), NOW);
  assert.equal(book.get('s4')?.host, 'cursor');
});

test('mục quá cũ bị cắt: transcript đã bị dọn thì không còn gì để quy trách nhiệm', async () => {
  _reset();
  await syncHosts(new Map([['xua', 'cursor']]), NOW - 200 * 86400_000);
  // Chờ mục cũ CÓ MẶT trước đã: không chờ thì lượt ghi thứ hai có thể vượt lượt đầu, và ca
  // này đỏ vì mục cũ chưa từng được ghi — chứ không vì phép cắt sai.
  await settleUntil((d) => d.sessions?.xua);
  await syncHosts(new Map([['moi', 'vscode']]), NOW);
  const onDisk = await settleUntil((d) => d.sessions?.moi);
  assert.equal(onDisk.sessions.moi.host, 'vscode');
  assert.equal(onDisk.sessions.xua, undefined, 'quá 120 ngày thì bỏ');
});

test('sổ hỏng thì bắt đầu lại từ đầu, không làm sập lượt quét', async () => {
  _reset();
  fs.writeFileSync(SESSION_HOST_FILE, 'không phải JSON');
  const book = await syncHosts(new Map([['s5', 'terminal']]), NOW);
  assert.equal(book.get('s5').host, 'terminal');
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
