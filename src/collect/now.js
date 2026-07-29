import fs from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_ROOTS, SCAN_DEPTH, HEALTH } from '../config.js';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'vendor', '.venv', 'venv', '__pycache__']);

/**
 * Quét cây thư mục tìm NOW.json và repo git. Một lượt duyệt duy nhất trả về cả
 * hai để không phải đi đĩa hai lần.
 */
export async function scanRoots() {
  const boards = [];
  const repos = [];
  const seen = new Set();

  async function walk(dir, depth) {
    if (depth > SCAN_DEPTH || seen.has(dir)) return;
    seen.add(dir);

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const names = new Set(entries.map((e) => e.name));
    if (names.has('NOW.json')) boards.push(dir);
    if (names.has('.git')) repos.push(dir);

    // Repo có NOW board rồi thì không cần lặn sâu tìm repo con nữa.
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      await walk(path.join(dir, e.name), depth + 1);
    }
  }

  for (const root of PROJECT_ROOTS) await walk(root, 0);
  return { boards, repos };
}

/**
 * Kiểm tra NOW.json theo schema v1 (`~/.claude/skills/now/now.schema.json`).
 *
 * Cố ý viết tay thay vì kéo thư viện JSON Schema: dashboard giữ nguyên tắc
 * zero-dependency, và ta chỉ cần các ràng buộc mà board thật hay vi phạm —
 * thiếu field bắt buộc, sai schemaVersion, focus không đủ thông tin để quay lại việc.
 */
export function validateNow(data) {
  const errors = [];
  const req = ['schemaVersion', 'project', 'branch', 'updatedAt', 'updatedAtCommit', 'updatedBy', 'focus'];
  for (const k of req) if (data?.[k] == null) errors.push(`thiếu \`${k}\``);

  if (data?.schemaVersion !== 1) errors.push(`schemaVersion phải là 1 (đang là ${JSON.stringify(data?.schemaVersion)})`);
  if (data?.updatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(data.updatedAt)) errors.push('`updatedAt` sai định dạng YYYY-MM-DD');
  if (data?.updatedAtCommit && !/^[0-9a-fA-F]{7,40}$/.test(data.updatedAtCommit)) errors.push('`updatedAtCommit` không phải SHA hợp lệ');

  const f = data?.focus;
  if (f) {
    for (const k of ['title', 'context', 'nextAction', 'resume', 'confidence']) {
      if (f[k] == null) errors.push(`focus thiếu \`${k}\``);
    }
    if (f.confidence && !['confirmed', 'inferred'].includes(f.confidence)) {
      errors.push('`focus.confidence` phải là confirmed hoặc inferred');
    }
    if (f.resume && (!f.resume.workingState || !f.resume.howToContinue)) {
      errors.push('`focus.resume` thiếu workingState hoặc howToContinue');
    }
  }

  for (const d of data?.decisionsNeeded ?? []) {
    if (!['now', 'soon', 'later'].includes(d.heat)) errors.push(`decision "${d.title ?? '?'}" có heat lạ: ${d.heat}`);
  }

  return errors;
}

export function daysSince(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(`${dateStr}T00:00:00`);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

/**
 * Sức khoẻ board = "đọc board này còn tin được không".
 * Kết hợp tuổi (ngày) và độ lệch (commit) vì mỗi cái bắt một kiểu hỏng khác nhau:
 * board 1 ngày tuổi nhưng sau 20 commit thì cũ, board 0 commit nhưng 10 ngày cũng cũ.
 */
export function healthOf({ ageDays, driftCommits, unknownCommit }) {
  if (unknownCommit) return 'unknown';
  const age = ageDays ?? 0;
  const drift = driftCommits ?? 0;
  if (age >= HEALTH.staleDays || drift >= HEALTH.staleCommits) return 'stale';
  if (age >= HEALTH.driftDays || drift >= HEALTH.driftCommits) return 'drifting';
  return 'fresh';
}

export async function readBoard(dir) {
  const file = path.join(dir, 'NOW.json');
  try {
    const text = await fs.readFile(file, 'utf8');
    const data = JSON.parse(text);
    return { data, errors: validateNow(data), parseError: null };
  } catch (err) {
    return { data: null, errors: [], parseError: err.message };
  }
}
