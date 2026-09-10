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
 * Luật của các mảng trong `now.schema.json`, chép sang JS để giữ zero-dependency.
 *
 * Xuất ra vì `test/now.test.js` đối chiếu bảng này với file schema THẬT: đã chép tay thì
 * phải có người canh hai bên khỏi lệch, và người canh phải là test chứ không phải trí nhớ.
 * `keys: null` nghĩa là mảng chuỗi, không có key để soát.
 */
export const LIST_RULES = {
  sideTracks: { max: 3, required: ['title'], keys: ['title', 'owner'] },
  recentlyDone: { max: 5, required: ['date', 'title'], keys: ['date', 'title', 'ref'] },
  decisionsNeeded: {
    max: 5,
    required: ['title', 'heat', 'blocks'],
    keys: ['id', 'title', 'heat', 'blocks', 'question', 'ref', 'since'],
  },
  waitingOn: { max: 5, required: ['what', 'who'], keys: ['what', 'who', 'since', 'ref'] },
  upNext: { max: 5, required: ['title'], keys: ['title', 'ref'] },
};

/** Ba mảng nằm trong `focus`. `blockedBy` là mảng mà `state.js` gọi `.map()` lên. */
export const FOCUS_LIST_RULES = {
  refs: { max: 3, required: ['label', 'ref'], keys: ['label', 'ref'] },
  laterSteps: { max: 3, required: [], keys: null },
  blockedBy: { max: 3, required: ['id'], keys: ['id', 'note'] },
};

/** `additionalProperties: false` ở cấp gốc. `$comment` là khoá hợp lệ của JSON Schema. */
export const ROOT_KEYS = [
  '$comment',
  'schemaVersion',
  'project',
  'branch',
  'updatedAt',
  'updatedAtCommit',
  'updatedBy',
  'focus',
  ...Object.keys(LIST_RULES),
];

const typeName = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

/**
 * Luật SHA của `updatedAtCommit`, chép nguyên `pattern` trong `now.schema.json`.
 *
 * Xuất ra vì `src/state.js` cũng phải biết luật này để quyết có hỏi `git rev-list` hay
 * không. Mỗi file giữ một bản riêng thì hai bên lệch nhau lúc nào không hay, nên
 * `test/now.test.js` vừa đối chiếu `source` của nó với `pattern` trong file schema thật,
 * vừa canh `state.js` không mọc lại bản chép tay thứ hai.
 */
export const SHA_RE = /^[0-9a-fA-F]{7,40}$/;

/**
 * Mốc commit có hỏi được git hay không — hẹp hơn `SHA_RE` đúng một ca.
 *
 * `0000000` là sentinel board dùng khi thư mục chưa phải repo git, nên schema vẫn nhận và
 * `validateNow` không được kêu. Nhưng thư mục ấy về sau có thể thành repo trong khi board
 * còn giữ sentinel, và từ lúc đó `git rev-list 0000000..HEAD` thoát 128 ở MỖI lượt quét,
 * đẻ một dòng rác cố định trong sổ lỗi mà người đọc không sửa được bằng cách đọc nó.
 */
export function isBoardCommit(value) {
  const s = String(value);
  return SHA_RE.test(s) && !/^0+$/.test(s);
}

/**
 * Soát một mảng: đúng kiểu, không quá dài, mỗi mục đủ key bắt buộc và không thừa key lạ.
 *
 * Sai kiểu là lỗi vì nó làm hỏng chỗ khác: `state.js` gọi `.map()` lên `focus.blockedBy`,
 * nên một chuỗi ở đó ném TypeError giữa lượt dựng dự án.
 */
function checkList(name, value, rule, errors, warnings) {
  if (value == null) return;
  if (!Array.isArray(value)) {
    errors.push(`\`${name}\` phải là mảng (đang là ${typeName(value)})`);
    return;
  }
  if (value.length > rule.max) {
    warnings.push(`\`${name}\` có ${value.length} mục, schema cho tối đa ${rule.max}`);
  }
  value.forEach((item, i) => {
    if (rule.keys === null) {
      if (typeof item !== 'string') errors.push(`\`${name}[${i}]\` phải là chuỗi (đang là ${typeName(item)})`);
      return;
    }
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`\`${name}[${i}]\` phải là object (đang là ${typeName(item)})`);
      return;
    }
    for (const k of rule.required) if (item[k] == null) errors.push(`\`${name}[${i}]\` thiếu \`${k}\``);
    for (const k of Object.keys(item)) if (!rule.keys.includes(k)) warnings.push(`\`${name}[${i}]\` có key lạ \`${k}\``);
  });
}

/**
 * Kiểm tra NOW.json theo schema v1 (xem `findNowSchema()`), tách làm hai mức.
 *
 * Cố ý viết tay thay vì kéo thư viện JSON Schema: dashboard giữ nguyên tắc zero-dependency.
 * Đổi lại phải tự phân mức, và chủ dự án đã chốt ranh giới theo câu hỏi "đọc board này còn
 * tin được không":
 *
 * - `errors` — thiếu field bắt buộc, sai kiểu, sai pattern, sai enum. Nội dung không dùng
 *   được như đã hứa, hoặc làm chỗ khác ném lỗi.
 * - `warnings` — vượt `maxItems` và key lạ. Board vẫn hiện được và mọi con số vẫn đúng, chỉ
 *   là lệch hợp đồng; đánh dấu để người viết board sửa, đừng bắt màn Sức khoẻ kêu như lỗi.
 *
 * Đôi `validateNow` / `validateNowDetail` đi theo đúng khuôn `run` / `runDetail` ở
 * `lib/sh.js`: dạng đơn giản trả về đúng thứ mọi chỗ gọi đang cần (một mảng chuỗi lỗi,
 * `public/views/health.js` duyệt thẳng), còn chỗ nào cần đủ hai mức thì gọi bản detail.
 */
export function validateNowDetail(data) {
  const errors = [];
  const warnings = [];

  // Cấp gốc phải là object thuần, và phải chặn ngay tại đây chứ không để mấy vòng soát bên
  // dưới chạy tiếp: `Object.keys()` của một mảng là danh sách chỉ số, nên một NOW.json viết
  // nhầm thành mảng 40 phần tử đẻ ra 40 dòng "cấp gốc có key lạ `0`" và chôn mất dòng duy
  // nhất nói đúng chuyện.
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    errors.push(`NOW.json phải là một object ở cấp gốc (đang là ${typeName(data)})`);
    return { errors, warnings };
  }

  for (const k of ['schemaVersion', 'project', 'branch', 'updatedAt', 'updatedAtCommit', 'updatedBy', 'focus']) {
    if (data[k] == null) errors.push(`thiếu \`${k}\``);
  }

  if (data.schemaVersion !== 1) errors.push(`schemaVersion phải là 1 (đang là ${JSON.stringify(data.schemaVersion)})`);
  if (data.updatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(data.updatedAt)) errors.push('`updatedAt` sai định dạng YYYY-MM-DD');
  if (data.updatedAtCommit && !SHA_RE.test(data.updatedAtCommit)) errors.push('`updatedAtCommit` không phải SHA hợp lệ');

  for (const k of Object.keys(data)) {
    if (!ROOT_KEYS.includes(k)) warnings.push(`cấp gốc có key lạ \`${k}\``);
  }

  const f = data.focus;
  if (f != null && (typeof f !== 'object' || Array.isArray(f))) {
    errors.push(`\`focus\` phải là object (đang là ${typeName(f)})`);
  } else if (f) {
    for (const k of ['title', 'context', 'nextAction', 'resume', 'confidence']) {
      if (f[k] == null) errors.push(`focus thiếu \`${k}\``);
    }
    if (f.confidence && !['confirmed', 'inferred'].includes(f.confidence)) {
      errors.push('`focus.confidence` phải là confirmed hoặc inferred');
    }
    if (f.resume && (!f.resume.workingState || !f.resume.howToContinue)) {
      errors.push('`focus.resume` thiếu workingState hoặc howToContinue');
    }
    for (const [k, rule] of Object.entries(FOCUS_LIST_RULES)) checkList(`focus.${k}`, f[k], rule, errors, warnings);
  }

  for (const [k, rule] of Object.entries(LIST_RULES)) checkList(k, data[k], rule, errors, warnings);

  // Chỉ duyệt khi đúng là mảng: `checkList` đã kêu ở trên rồi, mà `for…of` trên một chuỗi
  // thì chạy được và đẻ ra một dòng lỗi cho MỖI ký tự.
  if (Array.isArray(data.decisionsNeeded)) {
    for (const d of data.decisionsNeeded) {
      if (d && typeof d === 'object' && !['now', 'soon', 'later'].includes(d.heat)) {
        errors.push(`decision "${d.title ?? '?'}" có heat lạ: ${d.heat}`);
      }
    }
  }

  return { errors, warnings };
}

/** Chỉ danh sách lỗi. Giữ nguyên hợp đồng cũ cho mọi chỗ đang gọi. */
export function validateNow(data) {
  return validateNowDetail(data).errors;
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
    const { errors, warnings } = validateNowDetail(data);
    return { data, errors, warnings, parseError: null };
  } catch (err) {
    return { data: null, errors: [], warnings: [], parseError: err.message };
  }
}
