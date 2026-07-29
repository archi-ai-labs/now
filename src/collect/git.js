import path from 'node:path';
import fs from 'node:fs/promises';
import { git, lines, mapLimit } from '../lib/sh.js';

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
  const top = (await git(dir, 'rev-parse', '--show-toplevel')).trim();
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
  return mapLimit(list, 6, async (wt) => {
    wt.name = path.basename(wt.path);
    wt.inTmp = /^\/(private\/)?tmp\//.test(wt.path);
    wt.dirty = wt.prunable ? 0 : parseStatusV2(await git(wt.path, 'status', '--porcelain=v2')).dirtyFiles.length;
    wt.warn = wt.inTmp || wt.dirty > 0 || Boolean(wt.prunable);
    return wt;
  });
}

export async function collectGit(dir, sinceCommit) {
  const root = await repoRootOf(dir);
  if (!root) return { isRepo: false };
  if (root.nested) {
    // Không đo drift/dirty của repo mẹ rồi gán cho board: thà thiếu số còn hơn số sai.
    return { isRepo: false, nestedIn: root.path };
  }

  const [statusOut, lastCommitRaw, driftOut, worktreeOut] = await Promise.all([
    git(dir, 'status', '--porcelain=v2', '--branch'),
    git(dir, 'log', '-1', '--format=%ct%n%h%n%s'),
    // `rev-list --count` phân biệt được hai chuyện mà `log` gộp làm một: mốc board đã
    // biến mất (git lỗi → chuỗi rỗng) khác hẳn với lệch đúng 0 commit (in ra "0"). Bản
    // cũ phải chạy thêm `rev-parse --verify` đi trước chỉ để tách hai ca này.
    sinceCommit ? git(dir, 'rev-list', '--count', `${sinceCommit}..HEAD`) : Promise.resolve(''),
    git(dir, 'worktree', 'list', '--porcelain'),
  ]);

  const st = parseStatusV2(statusOut);
  const [ts, sha, subject] = lastCommitRaw.split('\n');

  let driftCommits = null;
  let unknownCommit = false;
  if (sinceCommit) {
    const n = driftOut.trim();
    if (/^\d+$/.test(n)) driftCommits = Number(n);
    else unknownCommit = true;
  }

  return {
    isRepo: true,
    branch: st.branch || 'detached',
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
    worktrees: await worktreeDetails(parseWorktreeList(worktreeOut)),
  };
}
