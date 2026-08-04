import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { collectGit } from '../src/collect/git.js';

/**
 * Test trên repo git THẬT, không phải mock.
 *
 * Lý do: `collectGit` không có logic riêng đáng test — toàn bộ giá trị của nó nằm ở
 * chỗ đọc đúng output của `git`. Mock `git` đi thì test chỉ còn khẳng định rằng mock
 * khớp với mock. Dựng repo thật trong thư mục tạm mất ~1 giây và bắt được đúng loại
 * lỗi mà việc gộp lệnh (`B4`) có thể gây ra.
 */

const sh = (cwd, ...args) =>
  new Promise((resolve, reject) =>
    execFile('git', args, { cwd }, (err, stdout) => (err ? reject(err) : resolve(String(stdout).trim()))),
  );

/** Commit không phụ thuộc cấu hình git của máy chạy test. */
const commit = (cwd, msg) =>
  sh(cwd, '-c', 'user.email=t@t', '-c', 'user.name=T', 'commit', '--no-gpg-sign', '-m', msg);

/**
 * Dựng fixture bằng một promise dùng chung thay vì `test.before`: hook đó chỉ có từ
 * Node 18.8 và chạy khác nhau giữa các bản. Promise thì bản nào cũng như bản nào, và
 * các test vẫn chạy tuần tự nên repo được dựng đúng một lần.
 */
const fixture = (async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'nowdash-git-'));
  // Chỗ thứ hai, cố tình KHÔNG nằm dưới thư mục tạm hệ thống: luật `inTmp` chỉ soi
  // `/tmp` và `/private/tmp`, mà trên Linux `os.tmpdir()` chính là `/tmp`. Muốn kiểm
  // nhánh "sạch, ngoài /tmp" thì phải có một chỗ ngoài /tmp trên MỌI hệ, và thư mục
  // nhà là chỗ duy nhất chắc chắn như vậy mà không phải đoán.
  const outside = await fs.mkdtemp(path.join(os.homedir(), '.nowdash-git-test-'));
  const repo = path.join(base, 'repo');
  await fs.mkdir(repo);
  await sh(repo, '-c', 'init.defaultBranch=main', 'init');
  await fs.writeFile(path.join(repo, 'a.txt'), 'một\n');
  await sh(repo, 'add', '.');
  await commit(repo, 'commit đầu');
  return { base, outside, repo };
})();

test('repo sạch: đọc đúng nhánh, HEAD, và không có file bẩn', async () => {
  const { repo } = await fixture;
  const g = await collectGit(repo);
  assert.equal(g.isRepo, true);
  assert.equal(g.branch, 'main');
  assert.equal(g.dirty, 0);
  assert.deepEqual(g.dirtyFiles, []);
  assert.match(g.head, /^[0-9a-f]{7,}$/);
  assert.equal(g.lastCommit.subject, 'commit đầu');
  assert.ok(g.lastCommitAt > 0);
  assert.equal(g.upstream, null, 'chưa có remote thì không được bịa ra upstream');
  assert.equal(g.ahead, null);
  assert.equal(g.behind, null);
});

test('file chưa commit được đếm đúng', async () => {
  const { repo } = await fixture;
  await fs.writeFile(path.join(repo, 'b.txt'), 'hai\n');
  await fs.writeFile(path.join(repo, 'c.txt'), 'ba\n');
  const g = await collectGit(repo);
  assert.equal(g.dirty, 2);
  assert.equal(g.dirtyFiles.length, 2);
  await fs.rm(path.join(repo, 'b.txt'));
  await fs.rm(path.join(repo, 'c.txt'));
});

test('độ lệch = số commit sau mốc board', async () => {
  const { repo } = await fixture;
  const mốc = await sh(repo, 'rev-parse', 'HEAD');
  for (const n of ['hai', 'ba', 'bốn']) {
    await fs.appendFile(path.join(repo, 'a.txt'), `${n}\n`);
    await sh(repo, 'add', '.');
    await commit(repo, `commit ${n}`);
  }
  const g = await collectGit(repo, mốc);
  assert.equal(g.driftCommits, 3);
  assert.equal(g.unknownCommit, false);
  assert.equal(
    g.driftList,
    undefined,
    'driftList bị bỏ có chủ ý ở B4: nó tốn thêm một lần spawn `git log` cho MỖI repo mỗi ' +
      '30 giây, đi kèm trong payload 116KB, mà không màn nào vẽ nó. Thêm lại thì phải có ' +
      'chỗ dùng thật trước.',
  );

  const vuaCapNhat = await collectGit(repo, await sh(repo, 'rev-parse', 'HEAD'));
  assert.equal(vuaCapNhat.driftCommits, 0, 'board vừa cập nhật thì lệch 0, không phải null');
});

test('mốc board đã bị rebase/amend mất → unknownCommit, KHÔNG phải lệch 0', async () => {
  const { repo } = await fixture;
  const g = await collectGit(repo, 'deadbeefdeadbeef');
  assert.equal(g.unknownCommit, true);
  assert.equal(g.driftCommits, null, 'trả 0 ở đây là làm board cũ trông tươi — đúng cái bẫy cần chặn');
});

test('không phải repo git thì nói thẳng, không ném', async () => {
  const { base } = await fixture;
  const trơ = path.join(base, 'khong-phai-repo');
  await fs.mkdir(trơ);
  const g = await collectGit(trơ);
  assert.equal(g.isRepo, false);
  assert.equal(g.nestedIn, undefined);
});

test('B3 — board nằm TRONG repo cha không được mượn số của repo cha', async () => {
  const { repo } = await fixture;
  const con = path.join(repo, 'packages', 'api');
  await fs.mkdir(con, { recursive: true });

  const g = await collectGit(con);
  assert.equal(g.isRepo, false, 'thư mục con không phải một repo riêng');
  assert.ok(g.nestedIn, 'phải chỉ ra gốc repo mẹ để màn Sức khoẻ nói được');
  assert.equal(await fs.realpath(g.nestedIn), await fs.realpath(repo));
  assert.equal(g.branch, undefined, 'tuyệt đối không được hiện nhánh của repo mẹ');
  assert.equal(g.dirty, undefined, 'cũng không được hiện số file bẩn của repo mẹ');
});

test('worktree phụ: nhận diện được, cờ cảnh báo đúng, KHÔNG tính repo chính vào', async () => {
  const { repo, outside } = await fixture;
  // Worktree này phải nằm NGOÀI /tmp, nên nó không dùng `base` như các test khác:
  // `os.tmpdir()` là `/var/folders/…` trên macOS nhưng đúng `/tmp` trên Linux. Đặt nó
  // trong `base` thì trên máy Linux nó rơi thẳng vào luật `inTmp`, và bài test "sạch
  // thì không cảnh báo" trở thành bài test không dựng được cảnh cần kiểm — xanh trên
  // máy dev, đỏ trên CI, mà cái đỏ ấy không nói gì về code.
  const wt = path.join(outside, 'wt-tinh-nang');
  await sh(repo, 'worktree', 'add', '-b', 'tinh-nang', wt);

  const g = await collectGit(repo);
  assert.equal(g.worktrees.length, 1, 'mục đầu của `worktree list` là repo chính, phải bị loại');
  const [w] = g.worktrees;
  assert.equal(w.name, 'wt-tinh-nang');
  assert.equal(w.branch, 'tinh-nang');
  assert.equal(w.dirty, 0);
  assert.equal(w.warn, false, 'worktree sạch ngoài /tmp thì không cảnh báo');

  await fs.writeFile(path.join(wt, 'do-dang.txt'), 'công chưa commit\n');
  const g2 = await collectGit(repo);
  assert.equal(g2.worktrees[0].dirty, 1);
  assert.equal(g2.worktrees[0].warn, true, 'còn file chưa commit là phải cảnh báo — dễ quên nhất');
});

test('worktree trong thư mục tạm hệ thống không bị báo nhầm là "lồng repo"', async () => {
  const { repo } = await fixture;
  // Trên macOS `/var` và `/tmp` là symlink tới `/private/…`, git luôn trả bản đã giải.
  // So chuỗi thô ở đây từng làm mọi repo dưới thư mục tạm bị gắn cờ nested.
  const g = await collectGit(repo);
  assert.equal(g.isRepo, true);
  assert.equal(g.nestedIn, undefined);
});

test('dọn thư mục tạm', async () => {
  const { base, outside } = await fixture;
  for (const dir of [base, outside]) {
    await fs.rm(dir, { recursive: true, force: true });
    assert.equal(await fs.access(dir).then(() => true, () => false), false, `còn sót ${dir}`);
  }
});
