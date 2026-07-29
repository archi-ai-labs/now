import fs from 'node:fs/promises';
import path from 'node:path';
import { TASKS_DIR } from '../config.js';

/**
 * Danh sách todo của một phiên: `~/.claude/tasks/<sessionId>/<n>.json`, mỗi file
 * một việc. Cho biết phiên đang *thực sự* làm gì — chi tiết hơn NOW board, vốn
 * chỉ ghi được tối đa 3 `sideTracks` cho toàn dự án.
 */
export async function readTodos(sessionId) {
  const dir = path.join(TASKS_DIR, sessionId);
  let files;
  try {
    files = (await fs.readdir(dir)).filter((f) => /^\d+\.json$/.test(f));
  } catch {
    return null;
  }
  if (!files.length) return null;

  files.sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]));
  const items = [];
  for (const f of files) {
    try {
      const t = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      if (t?.subject) {
        items.push({
          id: String(t.id ?? f.split('.')[0]),
          subject: t.subject,
          activeForm: t.activeForm || null,
          status: t.status || 'pending',
        });
      }
    } catch {
      /* file đang được ghi dở — bỏ qua, lượt sau đọc lại */
    }
  }
  if (!items.length) return null;

  const done = items.filter((t) => t.status === 'completed').length;
  const active = items.find((t) => t.status === 'in_progress') || null;
  return {
    total: items.length,
    done,
    active,
    /** Việc sẽ lấy tiếp nếu không có việc nào đang chạy. */
    next: active ? null : items.find((t) => t.status === 'pending') || null,
    items,
  };
}
