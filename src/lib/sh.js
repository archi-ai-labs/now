import { execFile } from 'node:child_process';

/**
 * Kiểu hỏng của một lượt gọi tiến trình ngoài.
 *
 * Mượn nguyên tinh thần `BACKOFF_MS` trong `collect/quota.js`: phân loại theo **việc
 * người đọc phải làm**, không theo mã lỗi của Node. Hai nhóm rất khác nhau:
 *
 * - `exit` — lệnh CHẠY ĐƯỢC và trả về "không". `git rev-parse --show-toplevel` trong
 *   một thư mục không phải repo ra đúng cái này, và đó là ca thường gặp nhất trong cả
 *   dashboard. Nó KHÔNG phải trục trặc, nên màn Sức khoẻ không được kêu.
 * - mọi kiểu còn lại — lệnh không chạy được, hoặc chạy mà ta cắt ngang. Máy đang có
 *   vấn đề thật: thiếu `PATH`, chưa cài, không đủ quyền, repo to quá hoặc treo.
 *
 * Trước đây cả hai nhóm cùng ra chuỗi rỗng, nên "chưa phải repo git" và "không tìm thấy
 * lệnh git" hiện lên y hệt nhau — chính là `B13`.
 */
function reasonOf(err) {
  // Xét TRƯỚC `killed`: vượt `maxBuffer` thì Node cũng giết tiến trình con và bật cờ
  // `killed`, nên để sau là mọi ca tràn đệm đọc thành hết giờ.
  if (err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return 'overflow';
  if (err.killed || err.signal) return 'timeout';
  if (err.code === 'ENOENT') return 'not-found';
  if (err.code === 'EACCES' || err.code === 'EPERM') return 'no-access';
  if (typeof err.code === 'number') return 'exit';
  return 'spawn';
}

/**
 * Sổ các lượt gọi hỏng kể từ lần vét gần nhất.
 *
 * Vì sao là một cuốn sổ dùng chung chứ không phải giá trị trả về: `run()` được gọi từ
 * sáu module, và đường đi của nó tới `buildState` có chỗ dài bốn tầng
 * (`collectGit` → `worktreeDetails` → `mapLimit` → `git`). Luồn thêm một trường qua từng
 * tầng ấy là sửa mọi chữ ký hàm trên đường, chỉ để chở một thứ không ai ở giữa dùng tới.
 *
 * Sổ **vét sạch mỗi lượt quét** (`drainRunFailures`). Nhờ thế con số trên màn Sức khoẻ
 * là "hỏng trong lượt quét vừa rồi", không phải tổng tích luỹ từ lúc khởi động — một
 * lượt hỏng thoáng qua tự biến mất thay vì đóng đinh ở đó mãi.
 *
 * KHÔNG bao giờ ghi `args`, `stdout` hay `stderr` vào đây. `collect/cursor.js` đọc token
 * đăng nhập của Cursor qua đúng hàm `run()` này, và chú thích tại chỗ đã chốt: giá trị
 * đọc ra không được đi vào log hay payload, **kể cả khi hỏng**. Tên lệnh với kiểu hỏng
 * đủ để chẩn đoán; đối số thì không đáng đánh cược. `sample` là ngoại lệ có kiểm soát:
 * chỉ `git()` truyền vào, và chỉ truyền thư mục repo — thứ đã nằm sẵn khắp payload
 * (`p.path`), nên nó không mở thêm bề mặt lộ ra nào.
 */
const failures = new Map();
let failuresSince = Date.now();

/** Trần số dòng khác nhau giữ trong sổ — mỗi dòng vẫn đếm đủ, chỉ thôi thêm dòng MỚI. */
const MAX_KINDS = 24;

/**
 * Khoá gộp là `lệnh | kiểu hỏng | mã`, **không** kèm chỗ xảy ra.
 *
 * Bản đầu có kèm, và đo trên máy thật mới thấy hỏng: bỏ `git` khỏi PATH rồi quét một
 * lượt ra **24 dòng y hệt nhau**, mỗi dòng một repo, `n: 1` — vừa đúng trần sổ. Nhưng đó
 * là MỘT sự việc: git không có trên máy. Người đọc màn Sức khoẻ cần một dòng "git không
 * tìm thấy ×24", không phải hai mươi tư dòng phải tự đọc ra điểm chung.
 *
 * Chỗ xảy ra vẫn giữ, nhưng đổi vai: từ một phần của danh tính dòng thành **một ví dụ**
 * (`sample`, cái đầu tiên gặp). Đủ để bắt đầu đi tìm, và không nhân bản dòng nữa.
 */
function note(cmd, reason, code, label) {
  const key = `${cmd}|${reason}|${code ?? ''}`;
  const row = failures.get(key);
  if (row) {
    row.n += 1;
    return;
  }
  if (failures.size >= MAX_KINDS) return;
  failures.set(key, { cmd, reason, code: typeof code === 'number' ? code : null, sample: label ?? null, n: 1 });
}

/**
 * Lấy sổ ra và mở sổ mới. Gọi đúng một chỗ — cuối `buildState`.
 *
 * `sinceMs` là độ dài cửa sổ vừa đo, không phải một mốc: nhịp quét nền đổi theo số tab
 * đang mở (xem `server.js`), nên "12 lượt hỏng" chỉ có nghĩa khi biết nó gom trong bao lâu.
 */
export function drainRunFailures(now = Date.now()) {
  const rows = [...failures.values()].sort((a, b) => b.n - a.n);
  const sinceMs = now - failuresSince;
  failures.clear();
  failuresSince = now;
  return {
    sinceMs,
    total: rows.reduce((n, r) => n + r.n, 0),
    // `exit` là câu trả lời hợp lệ, không phải trục trặc — tách sẵn ở đây để chỗ hiển
    // thị khỏi phải tự nhớ luật ấy, và để hai con số không bao giờ lệch nhau.
    broken: rows.filter((r) => r.reason !== 'exit').reduce((n, r) => n + r.n, 0),
    rows,
  };
}

/**
 * Chạy lệnh ngoài, không bao giờ ném lỗi — trả về chuỗi rỗng khi thất bại.
 * Dashboard chỉ đọc, một repo hỏng không được phép làm sập cả trang.
 *
 * Giá trị trả về vẫn là **chuỗi**, cố ý: sáu module đang gọi nó và không module nào cần
 * biết lý do hỏng. Ai cần thì đọc sổ qua `drainRunFailures()`, hoặc gọi `runDetail()`.
 */
export function run(cmd, args, opts = {}) {
  return runDetail(cmd, args, opts).then((r) => r.out);
}

/** Bản đầy đủ: `{ out, failed, reason, code }`. `out` là '' ở mọi ca hỏng, y như `run()`. */
export function runDetail(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { timeout: opts.timeout ?? 4000, maxBuffer: 8 * 1024 * 1024, cwd: opts.cwd },
      (err, stdout) => {
        if (!err) return resolve({ out: String(stdout), failed: false, reason: null, code: 0 });
        const reason = reasonOf(err);
        note(cmd, reason, err.code, opts.label);
        resolve({ out: '', failed: true, reason, code: typeof err.code === 'number' ? err.code : null });
      },
    );
  });
}

// `label` là thư mục repo: nó đã nằm sẵn khắp payload (`p.path`) nên không thêm gì mới
// vào bề mặt lộ ra, mà lại là thứ duy nhất giúp phân biệt "một repo hỏng" với "git hỏng".
export const git = (cwd, ...args) => run('git', ['-C', cwd, ...args], { label: cwd });

export const lines = (out) =>
  String(out)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** Gom nhiều promise nhưng giới hạn số chạy song song — tránh spawn 50 tiến trình git một lúc. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        out[i] = await fn(items[i], i);
      } catch {
        out[i] = null;
      }
    }
  });
  await Promise.all(workers);
  return out;
}
