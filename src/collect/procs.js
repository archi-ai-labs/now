import { run } from '../lib/sh.js';

/**
 * Bảng tiến trình, đọc bằng MỘT lượt `ps`.
 *
 * Trước đây `collect/sessions.js` gọi `ps -eo pid,lstart` chỉ để chống PID tái dùng.
 * Giờ có thêm nhu cầu thứ hai — biết một phiên đang chạy trong app nào — mà nhu cầu
 * đó cần `ppid` và `args`. Gọi `ps` hai lần cho hai cột của cùng một bảng là trả giá
 * hai lần cho một thứ; nên cả hai dùng chung hàm này.
 *
 * `lstart` nằm GIỮA `ppid` và `args`, và nó là trường duy nhất có dấu cách bên trong
 * ("Sat Jul 26 09:44:01 2026"). Đặt nó cuối như `args` thì không tách được; đặt nó
 * giữa với đúng năm thành phần cố định thì regex ăn gọn. Ngày có thể được đệm bằng
 * dấu cách (`Jul  5`), nên phải cho phép nhiều khoảng trắng.
 */
const ROW = /^\s*(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s+(.*)$/;

export async function processTable() {
  const out = await run('ps', ['-eo', 'pid=,ppid=,lstart=,args=']);
  const start = new Map();
  const parent = new Map();
  const args = new Map();

  for (const line of String(out).split('\n')) {
    const m = ROW.exec(line);
    if (!m) continue;
    const pid = Number(m[1]);
    // `ps` in theo giờ ĐỊA PHƯƠNG của máy — xem `parseProcStartUtc` bên `sessions.js`.
    const t = Date.parse(m[3].replace(/\s+/g, ' '));
    if (!Number.isNaN(t)) start.set(pid, t);
    parent.set(pid, Number(m[2]));
    args.set(pid, m[4]);
  }
  return { start, parent, args };
}

/**
 * Các app có thể "chứa" một phiên Claude, và mã ngắn của chúng.
 *
 * Thứ tự KHÔNG quan trọng vì mỗi mục khớp một đường dẫn bundle khác nhau — nhưng thứ
 * tự leo cây thì có: xem `hostOf`.
 */
const BUNDLES = [
  ['/Cursor.app/', 'cursor'],
  ['/Antigravity.app/', 'antigravity'],
  ['/Visual Studio Code.app/', 'vscode'],
  ['/Windsurf.app/', 'windsurf'],
  ['/Claude.app/', 'claude-desktop'],
  ['/Ghostty.app/', 'terminal'],
  ['/iTerm.app/', 'terminal'],
  ['/Alacritty.app/', 'terminal'],
  ['/WezTerm.app/', 'terminal'],
  ['/kitty.app/', 'terminal'],
  ['/Terminal.app/', 'terminal'],
  ['/Warp.app/', 'terminal'],
];

/** Bao nhiêu đời tổ tiên thì bỏ cuộc. Cây thật sâu 4–6 đời; 24 là để không treo. */
const MAX_DEPTH = 24;

/**
 * App chủ của một tiến trình: leo ngược cây cha cho tới khi gặp một app bundle.
 *
 * **Gặp app ĐẦU TIÊN thì dừng**, và đó chính là chỗ hàm này có ích. Terminal tích hợp
 * bên trong Cursor đẻ ra `claude` với chuỗi `claude ← zsh ← Cursor helper ← Cursor.app`:
 * dừng ở mục đầu cho ra `cursor`, đúng thứ người dùng thấy trên màn hình. Đo trên máy
 * này còn một ca nữa mà không cách nào khác phân biệt được: `entrypoint: "cli"` nhưng
 * app chủ là `Claude.app` — tức là terminal nằm TRONG Claude Desktop, không phải
 * Terminal.app.
 *
 * Trả `null` khi leo hết cây mà không gặp app nào (thường là chạy từ launchd, ssh, hoặc
 * một tiến trình nền) — `null` là "không biết", KHÔNG phải "terminal".
 */
export function hostOf(pid, { parent, args }) {
  const seen = new Set();
  for (let p = pid, i = 0; p && p !== 1 && i < MAX_DEPTH; i++) {
    if (seen.has(p)) break; // cây tiến trình không có vòng, nhưng bảng đọc lỡ nhịp thì có
    seen.add(p);
    const a = args.get(p);
    if (a) {
      for (const [needle, key] of BUNDLES) if (a.includes(needle)) return key;
    }
    p = parent.get(p);
  }
  return null;
}

/** App có đang chạy không — dùng cho mọi bề mặt, kể cả bề mặt không đẻ ra phiên Claude nào. */
export function appRunning(key, { args }) {
  const needles = BUNDLES.filter(([, k]) => k === key).map(([n]) => n);
  for (const a of args.values()) {
    for (const n of needles) if (a.includes(n)) return true;
  }
  return false;
}
