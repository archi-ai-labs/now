import test from 'node:test';
import assert from 'node:assert/strict';
import { decode, int, one, str, sub, timestampMs } from '../src/lib/pb.js';
import { parseSummaries } from '../src/collect/antigravity.js';
import { parseEditorStorage, pathOfUri } from '../src/collect/editors.js';
import { hostOf, appRunning } from '../src/collect/procs.js';

/**
 * Ba nguồn dữ liệu mới, ba kiểu mong manh khác nhau:
 *
 * - **Cây tiến trình** — đúng ngay lúc đọc, chết ngay khi phiên tắt.
 * - **Sổ Antigravity** — protobuf của một app khác, KHÔNG có tài liệu.
 * - **storage.json của họ VS Code** — JSON có tài liệu, nhưng ngữ nghĩa thì không:
 *   `backupWorkspaces` chỉ đúng khi app đang chạy.
 *
 * Cả ba đều phải hỏng thành "không biết", không bao giờ thành một câu trả lời sai.
 */

/* ── Bộ mã hoá protobuf tí hon, chỉ để dựng fixture ────────────────────────── */

function uvar(n) {
  const b = [];
  let v = BigInt(n);
  do {
    let x = Number(v & 0x7fn);
    v >>= 7n;
    if (v) x |= 0x80;
    b.push(x);
  } while (v);
  return Buffer.from(b);
}
const tag = (f, w) => uvar((f << 3) | w);
const pbBytes = (f, buf) => Buffer.concat([tag(f, 2), uvar(buf.length), buf]);
const pbStr = (f, s) => pbBytes(f, Buffer.from(s, 'utf8'));
const pbInt = (f, n) => Buffer.concat([tag(f, 0), uvar(n)]);
const pbTime = (f, secs, nanos = 0) => pbBytes(f, Buffer.concat([pbInt(1, secs), pbInt(2, nanos)]));

/** Một hội thoại đúng hình dạng đã dò được từ Antigravity 2.3.1. */
const convo = ({ id, title, steps, uri, created, updated }) =>
  pbBytes(
    1,
    Buffer.concat([
      pbStr(1, id),
      pbBytes(
        2,
        Buffer.concat([
          pbStr(1, title),
          pbInt(2, steps),
          pbTime(3, updated),
          pbTime(7, created),
          pbBytes(9, pbStr(1, uri)),
        ]),
      ),
    ]),
  );

/* ── pb.js ──────────────────────────────────────────────────────────────────── */

test('bóc được cả bốn kiểu dây gặp ngoài đời', () => {
  const buf = Buffer.concat([pbInt(1, 300), pbStr(2, 'xin chào'), pbBytes(3, pbInt(1, 7))]);
  const m = decode(buf);
  assert.equal(int(m, 1), 300, 'varint nhiều byte');
  assert.equal(str(m, 2), 'xin chào', 'chuỗi UTF-8, không phải ASCII');
  assert.equal(int(sub(m, 3), 1), 7, 'message lồng');
});

test('trường lặp lại giữ ĐỦ, không phải "lần cuối thắng"', () => {
  // proto cho phép lặp bất kỳ trường nào; chọn hộ một cái ở tầng giải mã là âm thầm
  // vứt dữ liệu mà chỗ gọi không có cách nào biết.
  const m = decode(Buffer.concat([pbStr(1, 'a'), pbStr(1, 'b')]));
  assert.equal(m.get(1).length, 2);
  assert.equal(str(m, 1), 'a', '`str` lấy cái đầu, nhưng cả hai vẫn còn đó');
});

test('dữ liệu cụt hoặc rác thì trả phần đọc được, KHÔNG ném', () => {
  const good = pbStr(1, 'nguyên vẹn');
  const cut = Buffer.concat([good, pbStr(2, 'bị cắt').subarray(0, 3)]);
  const m = decode(cut);
  assert.equal(str(m, 1), 'nguyên vẹn');
  assert.doesNotThrow(() => decode(Buffer.from([0xff, 0xff, 0xff])));
  assert.equal(decode(Buffer.alloc(0)).size, 0);
});

test('Timestamp rỗng ra null chứ không ra mốc 1970', () => {
  // 1970 trên giao diện đọc thành "56 năm trước" — một lời nói dối rất tự tin.
  assert.equal(timestampMs(decode(pbBytes(3, Buffer.alloc(0))), 3), null);
  assert.equal(timestampMs(decode(Buffer.alloc(0)), 3), null);
  assert.equal(timestampMs(decode(pbTime(3, 1784780045, 811297000)), 3), 1784780045811);
});

test('trường vắng mặt trả null, không ném', () => {
  const m = decode(pbStr(1, 'x'));
  assert.equal(str(m, 9), null);
  assert.equal(int(m, 9), null);
  assert.equal(sub(m, 9), null);
  assert.equal(one(m, 9), undefined);
});

/* ── Sổ Antigravity ─────────────────────────────────────────────────────────── */

const NOW = Date.parse('2026-07-26T09:00:00+07:00');
const SEC = (iso) => Math.floor(Date.parse(iso) / 1000);

const book = () =>
  Buffer.concat([
    convo({
      id: '2141d7e4-2790-43d3-b755-6cdb03736d00',
      title: 'Refactor Fact Check Script',
      steps: 27,
      uri: 'file:///Users/hoanluu/Projects/local/researcher/antigravity',
      created: SEC('2026-07-26T08:00:00+07:00'),
      updated: SEC('2026-07-26T08:50:00+07:00'),
    }),
    convo({
      id: 'ec83d83a-ef86-4364-9612-ef858fb50a2b',
      title: 'Tối Ưu Prompt Trích Xuất',
      steps: 18,
      uri: 'file:///Users/hoanluu/Projects/archimonde12/ai-agency',
      created: SEC('2026-07-20T10:00:00+07:00'),
      updated: SEC('2026-07-20T11:00:00+07:00'),
    }),
  ]);

test('bóc đủ id, tiêu đề, workspace, số bước và hai mốc thời gian', () => {
  const r = parseSummaries(book(), NOW);
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 2);
  const [a] = r.rows;
  assert.equal(a.title, 'Refactor Fact Check Script');
  assert.equal(a.steps, 27);
  assert.equal(a.cwd, '/Users/hoanluu/Projects/local/researcher/antigravity', 'URI phải thành đường dẫn thật');
  assert.ok(a.updatedAt > a.createdAt, 'trường 3 là cập nhật, trường 7 là tạo');
});

test('workspace có dấu cách được giải mã đúng — không thì gán nhầm dự án', () => {
  const buf = convo({
    id: 'x',
    title: 'y',
    steps: 1,
    uri: 'file:///Users/hoanluu/my%20work/dự%20án',
    created: SEC('2026-07-26T08:00:00+07:00'),
    updated: SEC('2026-07-26T08:00:00+07:00'),
  });
  assert.equal(parseSummaries(buf, NOW).rows[0].cwd, '/Users/hoanluu/my work/dự án');
});

test('hội thoại thiếu trường vẫn hiện ra với những gì còn đọc được', () => {
  // Google đổi hình dạng thì mất chữ, không được mất cả bản ghi.
  const bare = pbBytes(1, pbStr(1, 'chỉ-có-id'));
  const r = parseSummaries(bare, NOW);
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows[0], { id: 'chỉ-có-id', title: null, steps: null, cwd: null, createdAt: null, updatedAt: null });
});

test('phân biệt "chưa dùng bao giờ" với "hình dạng đã đổi"', () => {
  assert.equal(parseSummaries(Buffer.alloc(0), NOW).reason, 'empty');
  // Đọc được byte nhưng không ra bản ghi nào = schema đã khác. Gọi nó là "empty" thì
  // người dùng đi tìm lỗi ở chỗ họ chưa mở Antigravity, sai hẳn hướng.
  assert.equal(parseSummaries(pbStr(9, 'trường lạ'), NOW).reason, 'shape');
});

/* ── storage.json của họ VS Code ────────────────────────────────────────────── */

test('đọc đúng các thư mục đang mở từ backupWorkspaces', () => {
  const r = parseEditorStorage({
    backupWorkspaces: {
      folders: [{ folderUri: 'file:///Users/hoanluu/Projects/a' }, { folderUri: 'file:///Users/hoanluu/Projects/b' }],
      workspaces: [],
      emptyWindows: [{ backupFolder: '1785033576824' }],
    },
  });
  assert.deepEqual(r.folders, ['/Users/hoanluu/Projects/a', '/Users/hoanluu/Projects/b']);
  assert.equal(r.empty, 1, 'cửa sổ trống đếm được nhưng không gọi tên được — đó là giới hạn của nguồn');
});

test('bỏ qua thư mục ở xa: dashboard chỉ khớp được đường dẫn cục bộ', () => {
  const r = parseEditorStorage({
    backupWorkspaces: { folders: [{ folderUri: 'vscode-remote://ssh-remote+box/srv/app' }, { folderUri: 'file:///tmp/x' }] },
  });
  assert.deepEqual(r.folders, ['/tmp/x']);
});

test('thiếu backupWorkspaces thì ra rỗng, không ném', () => {
  assert.deepEqual(parseEditorStorage({}), { folders: [], empty: 0 });
  assert.deepEqual(parseEditorStorage(null), { folders: [], empty: 0 });
  assert.equal(pathOfUri('không phải uri'), null);
});

/* ── Cây tiến trình ─────────────────────────────────────────────────────────── */

const tree = (rows) => ({
  parent: new Map(rows.map(([pid, ppid]) => [pid, ppid])),
  args: new Map(rows.map(([pid, , a]) => [pid, a])),
});

test('leo cây tới app bundle gần nhất', () => {
  const t = tree([
    [100, 90, 'claude'],
    [90, 80, '/bin/zsh'],
    [80, 1, '/Applications/Cursor.app/Contents/MacOS/Cursor'],
  ]);
  assert.equal(hostOf(100, t), 'cursor');
});

test('app GẦN NHẤT thắng — terminal tích hợp trong Cursor là Cursor, không phải Terminal', () => {
  // Đây là lý do hàm này tồn tại: `entrypoint` chỉ nói "cli", còn cửa sổ người dùng
  // đang nhìn thì là Cursor.
  const t = tree([
    [100, 90, 'claude'],
    [90, 80, '/bin/zsh'],
    [80, 70, '/Applications/Cursor.app/Contents/Frameworks/Cursor Helper'],
    [70, 1, '/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal'],
  ]);
  assert.equal(hostOf(100, t), 'cursor');
});

test('không gặp app nào thì trả null — "không biết", KHÔNG phải "terminal"', () => {
  // Ghi `terminal` ở đây là đóng băng một câu trả lời sai vào sổ, vĩnh viễn.
  const t = tree([
    [100, 90, 'claude'],
    [90, 1, '/sbin/launchd'],
  ]);
  assert.equal(hostOf(100, t), null);
  assert.equal(hostOf(999, t), null, 'pid không có trong bảng');
});

test('bảng tiến trình có vòng thì dừng, không treo', () => {
  const t = tree([
    [100, 200, 'a'],
    [200, 100, 'b'],
  ]);
  assert.equal(hostOf(100, t), null);
});

test('app đang chạy hay không đọc được kể cả khi nó không đẻ ra phiên Claude nào', () => {
  const t = tree([[1, 0, '/Applications/Antigravity.app/Contents/MacOS/Antigravity']]);
  assert.equal(appRunning('antigravity', t), true);
  assert.equal(appRunning('cursor', t), false);
});
