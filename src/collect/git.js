import path from 'node:path';
import fs from 'node:fs/promises';
import { gitDetail, mapLimit } from '../lib/sh.js';

/**
 * Đọc trạng thái git của một dự án.
 *
 * Nguyên tắc ở file này: **ít tiến trình con, và đừng xếp chúng nối đuôi nhau.** Spawn
 * một lệnh `git` tốn ~54ms trên máy này — nhiều hơn hẳn thời gian git thực sự làm việc —
 * nên số lệnh và số *tầng chờ* mới là thứ quyết định dashboard nhanh hay chậm, không
 * phải repo to hay nhỏ.
 *
 * Bản trước hỏi 10+ lệnh mỗi repo, xếp thành 4 tầng nối tiếp (kiểm repo → 5 lệnh song
 * song → đo lệch 2 lệnh → liệt kê worktree → status từng worktree tuần tự). Bản này:
 *
 *   tầng 1: `rev-parse --show-toplevel`   (vừa kiểm repo, vừa bắt board lồng repo cha)
 *   tầng 2: 4 lệnh SONG SONG              (status v2 · log -1 · đếm lệch · liệt kê worktree)
 *   tầng 3: status các worktree SONG SONG
 *
 * `git status --porcelain=v2 --branch` một mình thay được 5 lệnh cũ: tên nhánh, oid của
 * HEAD, upstream, ahead/behind, và danh sách file bẩn.
 */

/**
 * `--is-inside-work-tree` trả `true` cho MỌI thư mục con của một repo, nên một board đặt
 * trong `monorepo/packages/api/` sẽ lặng lẽ khoe nhánh, số file bẩn và độ lệch của cả
 * monorepo như thể là của nó. `--show-toplevel` là thứ duy nhất phân biệt được: gốc repo
 * khác thư mục board thì mọi con số dưới đây là của repo mẹ, và phải nói ra.
 */
async function repoRootOf(dir) {
  const r = await gitDetail(dir, 'rev-parse', '--show-toplevel');
  // `exit` là một câu trả lời thật: git chạy được và nói "chỗ này không phải repo" (mã 128),
  // đúng ca thường gặp nhất trong cả lượt quét. Mọi kiểu hỏng khác (hết giờ, thiếu lệnh,
  // không đủ quyền) thì ta KHÔNG biết đây có phải repo hay không, và "không biết" phải nói
  // ra chứ không được đọc thành "không phải repo".
  if (r.failed && r.reason !== 'exit') return { degraded: r.reason };
  const top = r.out.trim();
  if (!top) return null;
  // So bằng đường dẫn đã GIẢI SYMLINK, không so chuỗi thô: trên macOS `/tmp` và `/var`
  // đều là symlink (`/private/…`) và git luôn trả bản đã giải, nên so thẳng chuỗi sẽ báo
  // "lồng" cho mọi repo nằm dưới hai chỗ đó — đúng chỗ worktree tạm hay nằm.
  const real = async (p) => {
    try {
      return await fs.realpath(p);
    } catch {
      return p;
    }
  };
  const [a, b] = await Promise.all([real(top), real(dir)]);
  return { path: top, nested: a.replace(/\/+$/, '') !== b.replace(/\/+$/, '') };
}

/**
 * Bóc `git status --porcelain=v2 --branch`.
 *
 * Đếm file bẩn giữ đúng ngữ nghĩa của `--porcelain` v1 mà bản cũ dùng: mỗi mục một dòng,
 * tính cả file chưa theo dõi (`?`). Đổi cách đếm ở đây là đổi luôn con số hiện trên thẻ
 * dự án mà không ai để ý, nên test `git.test.js` khoá lại chuyện đó.
 */
export function parseStatusV2(out) {
  const st = { branch: null, upstream: null, ahead: null, behind: null, dirtyFiles: [] };

  for (const line of String(out).split('\n')) {
    if (!line) continue;

    if (line.startsWith('# branch.head ')) {
      const v = line.slice(14).trim();
      st.branch = v === '(detached)' ? 'detached' : v;
    } else if (line.startsWith('# branch.upstream ')) {
      st.upstream = line.slice(18).trim();
    } else if (line.startsWith('# branch.ab ')) {
      const m = line.slice(12).trim().match(/^\+(\d+)\s+-(\d+)$/);
      if (m) {
        st.ahead = Number(m[1]);
        st.behind = Number(m[2]);
      }
    } else if (line[0] === '?') {
      st.dirtyFiles.push(`?? ${line.slice(2)}`);
    } else if (line[0] === '1' || line[0] === '2' || line[0] === 'u') {
      // `1 XY sub mH mI mW hH hI <path>` · `2` thêm một trường điểm-đổi-tên trước path
      // và dùng TAB ngăn path mới với path cũ · `u` có 3 mã hash nên path lùi thêm 2 ô.
      const f = line.split(' ');
      const skip = line[0] === '1' ? 8 : line[0] === '2' ? 9 : 10;
      const p = f.slice(skip).join(' ').split('\t')[0];
      st.dirtyFiles.push(`${f[1]} ${p}`);
    }
  }
  return st;
}

/**
 * Worktree phụ — công đang treo ngoài repo chính, rất dễ quên.
 * Cờ cảnh báo lấy đúng theo skill `now`: nằm trong /tmp thì mất khi reboot,
 * còn file chưa commit thì đang giữ công chưa lưu.
 */
export function parseWorktreeList(out) {
  if (!out) return [];
  const entries = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (cur) entries.push(cur);
      cur = { path: line.slice(9).trim(), branch: null, detached: false };
    } else if (!cur) {
      continue;
    } else if (line.startsWith('branch ')) {
      cur.branch = line.slice(7).replace('refs/heads/', '').trim();
    } else if (line.trim() === 'detached') {
      cur.detached = true;
    } else if (line.startsWith('prunable ')) {
      cur.prunable = line.slice(9).trim();
    }
  }
  if (cur) entries.push(cur);
  // Mục đầu tiên là repo chính — phần còn lại mới là worktree phụ.
  return entries.slice(1);
}

async function worktreeDetails(list) {
  return mapLimit(
    list,
    6,
    async (wt) => {
      wt.name = path.basename(wt.path);
      wt.inTmp = /^\/(private\/)?tmp\//.test(wt.path);
      if (wt.prunable) {
        wt.dirty = 0;
      } else {
        const r = await gitDetail(wt.path, 'status', '--porcelain=v2');
        // Không đọc được thì `null`, không phải 0: "sạch" là một khẳng định, và ta vừa
        // mất đúng cái lệnh dùng để khẳng định nó.
        wt.dirty = r.failed ? null : parseStatusV2(r.out).dirtyFiles.length;
        if (r.failed && r.reason !== 'exit') wt.degraded = r.reason;
      }
      wt.warn = wt.inTmp || wt.dirty > 0 || Boolean(wt.prunable);
      return wt;
    },
    'worktree',
  );
}

/**
 * "Không đọc được", khác hẳn "đọc được và ra 0".
 *
 * Mọi con số đo được đặt `null`, còn `unknownCommit: true` đi kèm vì cả hai nói cùng một
 * chuyện: lượt quét này KHÔNG đo được độ lệch. Cờ ấy là thứ duy nhất `integrity()` trong
 * `public/views/shared.js` chịu nghe, và thiếu nó thì nhánh `driftCommits ?? 0` chấm cho
 * repo không đọc được đúng số điểm của một board vừa cập nhật: đo hôm nay, một board 1 ngày
 * tuổi ra 93/100 và thanh sức khoẻ nói dối đúng chỗ nó sinh ra để canh.
 *
 * `degraded` là chỗ phân biệt hai nguồn của cờ ấy, nên giao diện phải xét `degraded` TRƯỚC
 * khi viết ra câu nào về mốc board: `rev-list` thoát 128 nghĩa là mốc mất thật, còn ở đây
 * chỉ là ta không hỏi được git câu nào. `public/views/health.js` và `public/views/overview.js`
 * đang xét theo đúng thứ tự đó.
 *
 * `isRepo: true` là lựa chọn ít sai nhất trong hai thứ giao diện vẽ được: giá trị đúng phải
 * là "không biết", mà `false` thì `public/views/overview.js` in thẳng "chưa phải repo git" —
 * một khẳng định chắc nịch mà ta không có cơ sở nào để nói.
 */
function unreadable(reason) {
  return {
    isRepo: true,
    degraded: reason,
    branch: null,
    head: null,
    dirty: null,
    dirtyFiles: [],
    lastCommitAt: null,
    lastCommit: null,
    upstream: null,
    ahead: null,
    behind: null,
    driftCommits: null,
    unknownCommit: true,
    worktrees: [],
  };
}

/** Lệnh không được hỏi (board không có mốc commit) — khác hẳn hỏi mà không đọc được. */
const KHONG_HOI = { out: '', failed: false, reason: null, code: 0 };

export async function collectGit(dir, sinceCommit) {
  const root = await repoRootOf(dir);
  if (root?.degraded) return unreadable(root.degraded);
  if (!root) return { isRepo: false };
  if (root.nested) {
    // Không đo drift/dirty của repo mẹ rồi gán cho board: thà thiếu số còn hơn số sai.
    return { isRepo: false, nestedIn: root.path };
  }

  const [status, lastCommit, drift, worktree] = await Promise.all([
    gitDetail(dir, 'status', '--porcelain=v2', '--branch'),
    gitDetail(dir, 'log', '-1', '--format=%ct%n%h%n%s'),
    // `rev-list --count` phân biệt được hai chuyện mà `log` gộp làm một: mốc board đã
    // biến mất (git thoát khác 0) khác hẳn với lệch đúng 0 commit (in ra "0"). Bản
    // cũ phải chạy thêm `rev-parse --verify` đi trước chỉ để tách hai ca này.
    sinceCommit ? gitDetail(dir, 'rev-list', '--count', `${sinceCommit}..HEAD`) : Promise.resolve(KHONG_HOI),
    gitDetail(dir, 'worktree', 'list', '--porcelain'),
  ]);

  // `status` quyết định cả nhánh lẫn số file bẩn, tức mọi con số hiện trên thẻ dự án. Mất
  // nó thì không còn gì để hiển thị cho đúng, nên dừng ngay ở đây thay vì lắp số rỗng.
  //
  // Ở ĐÂY `exit` cũng tính là hỏng, khác với chỗ khác trong file: `git status` không có
  // câu trả lời "không" nào cả — thư mục không phải repo thì `rev-parse` phía trên đã chặn
  // rồi, nên thoát khác 0 tại đây nghĩa là repo có vấn đề chứ không phải một câu trả lời.
  // Vì vậy `degraded` mang được cả sáu lý do của `lib/sh.js`, kể cả `exit`, trong khi
  // `public/lib/i18n.js` mới có chữ cho năm lý do kia. Giao diện đọc `degraded` như một cờ
  // đúng/sai chứ không tra chữ theo nó, nên `exit` không làm thẻ nào hiện trống lý do.
  if (status.failed) return unreadable(status.reason);

  const st = parseStatusV2(status.out);
  const [ts, sha, subject] = lastCommit.out.split('\n');

  let driftCommits = null;
  let unknownCommit = false;
  // Ba lệnh còn lại hỏng thì mất một phần bức tranh chứ không mất cả: giữ những gì đọc
  // được, và ghi lý do để màn Sức khoẻ nói được vì sao chỗ đó trống.
  let degraded = [lastCommit, worktree].find((r) => r.failed && r.reason !== 'exit')?.reason ?? null;

  if (sinceCommit) {
    const n = drift.out.trim();
    if (/^\d+$/.test(n)) driftCommits = Number(n);
    // Mốc mất (`exit`) và hỏi không được (hết giờ, thiếu lệnh) khác nhau ở LÝ DO, nên
    // `degraded` chỉ ghi ca sau. Nhưng hệ quả thì một: độ lệch chưa đo được, và cờ
    // `unknownCommit` phải bật ở cả hai, không thì `integrity()` chấm điểm bằng `?? 0`.
    else if (drift.reason === 'exit') unknownCommit = true;
    else {
      unknownCommit = true;
      degraded = degraded ?? drift.reason;
    }
  }

  return {
    isRepo: true,
    degraded,
    branch: st.branch,
    head: sha || null,
    dirty: st.dirtyFiles.length,
    dirtyFiles: st.dirtyFiles.slice(0, 12),
    lastCommitAt: ts ? Number(ts) * 1000 : null,
    lastCommit: sha ? { sha, subject: subject || '' } : null,
    upstream: st.upstream,
    ahead: st.ahead,
    behind: st.behind,
    driftCommits,
    unknownCommit,
    worktrees: await worktreeDetails(parseWorktreeList(worktree.out)),
  };
}
