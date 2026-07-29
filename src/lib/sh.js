import { execFile } from 'node:child_process';

/**
 * Chạy lệnh ngoài, không bao giờ ném lỗi — trả về chuỗi rỗng khi thất bại.
 * Dashboard chỉ đọc, một repo hỏng không được phép làm sập cả trang.
 */
export function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { timeout: opts.timeout ?? 4000, maxBuffer: 8 * 1024 * 1024, cwd: opts.cwd },
      (err, stdout) => resolve(err ? '' : String(stdout)),
    );
  });
}

export const git = (cwd, ...args) => run('git', ['-C', cwd, ...args]);

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
