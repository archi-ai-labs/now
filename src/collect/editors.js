import fs from 'node:fs/promises';
import { EDITOR_STORAGE } from '../config.js';

/**
 * Cửa sổ đang mở của họ nhà VS Code (Cursor, VS Code — và bất kỳ bản fork nào giữ
 * nguyên đường dẫn dữ liệu của VS Code).
 *
 * Đọc `backupWorkspaces` chứ KHÔNG đọc `windowsState`, và khác biệt này quan trọng:
 * `windowsState` chỉ được ghi lúc app thoát, nên trong lúc app đang chạy nó là ảnh của
 * phiên TRƯỚC — đo trên máy này, Cursor đang mở ba thư mục mà `windowsState.openedWindows`
 * rỗng trơn. `backupWorkspaces` tồn tại đúng bằng thời gian cửa sổ mở (nó phục vụ cơ
 * chế hot-exit), nên nó mới trả lời được câu "ngay lúc này đang mở gì".
 *
 * Đánh đổi đã biết: cửa sổ trống (chưa mở thư mục nào) chỉ hiện ra dưới dạng
 * `emptyWindows`, không có đường dẫn — đếm được chứ không gọi tên được. Đó là giới hạn
 * của nguồn dữ liệu, không phải chỗ để đoán.
 */

/** `file:///Users/…` → `/Users/…`; bỏ qua mọi thứ không phải file cục bộ (remote, wsl…). */
export function pathOfUri(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('file://')) return null;
  try {
    return decodeURIComponent(new URL(uri).pathname) || null;
  } catch {
    return null;
  }
}

/** Bóc phần `backupWorkspaces` của một `storage.json`. Tách khỏi I/O để test được. */
export function parseEditorStorage(raw) {
  const b = raw?.backupWorkspaces;
  if (!b || typeof b !== 'object') return { folders: [], empty: 0 };
  const folders = [
    ...(Array.isArray(b.folders) ? b.folders : []).map((f) => pathOfUri(f?.folderUri)),
    // Workspace nhiều thư mục (`.code-workspace`) là một FILE mô tả, không phải thư mục
    // dự án — nên chỉ lấy được đường dẫn file đó. Vẫn hơn là bỏ hẳn.
    ...(Array.isArray(b.workspaces) ? b.workspaces : []).map((w) => pathOfUri(w?.configURIPath)),
  ].filter(Boolean);
  return {
    folders: [...new Set(folders)],
    empty: Array.isArray(b.emptyWindows) ? b.emptyWindows.length : 0,
  };
}

async function readEditor(file) {
  try {
    return parseEditorStorage(JSON.parse(await fs.readFile(file, 'utf8')));
  } catch {
    // Chưa cài, hoặc file đang được ghi dở. Cả hai đều là "chưa biết", và cả hai đều
    // KHÔNG được phép thành "không mở thư mục nào" — nên trả null để chỗ gọi phân biệt.
    return null;
  }
}

export async function collectEditors() {
  const keys = Object.keys(EDITOR_STORAGE);
  const read = await Promise.all(keys.map((k) => readEditor(EDITOR_STORAGE[k])));
  return Object.fromEntries(keys.map((k, i) => [k, read[i]]));
}
