/**
 * Bề mặt làm việc — cái cửa sổ mà người dùng đang thật sự ngồi trước.
 *
 * Máy này chạy ba thứ cùng lúc và chúng KHÔNG cùng loại:
 *
 * - **Claude Desktop / Terminal** — chạy Claude Code, để lại phiên và transcript.
 * - **Cursor / VS Code** — editor, có thể chạy Claude Code bên trong; với Claude Code
 *   thì cả hai đều tự khai là `claude-vscode`, không phân biệt được.
 * - **Antigravity** — có agent RIÊNG, không đụng gì tới Claude Code. Không có phiên,
 *   không có transcript, không có token trong sổ của ta. Đơn vị của nó là hội thoại.
 *
 * Module này là chỗ duy nhất biết tên và ký hiệu của từng bề mặt, để ba màn (Phiên,
 * Dự án, Token) không gọi cùng một thứ bằng ba cái tên.
 *
 * Tên sản phẩm giữ nguyên literal chứ không đưa vào `i18n.js`: "Cursor" và
 * "Antigravity" là danh từ riêng, dịch chúng là sai. Chỉ những nhãn MÔ TẢ
 * ("Editor chưa rõ", "Dòng lệnh") mới là chuỗi cần dịch.
 */

import { t } from './i18n.js';

const SURFACES = {
  'claude-desktop': { name: 'Claude Desktop', icon: '◈' },
  cursor: { name: 'Cursor', icon: '◧' },
  // Tam giác, không phải hình vuông như mấy bản fork VS Code: Antigravity đo bằng một
  // đơn vị khác hẳn (hội thoại, không phải phiên), và hình dạng khác nói ra điều đó
  // trước khi người xem kịp đọc chữ.
  antigravity: { name: 'Antigravity', icon: '▲' },
  vscode: { name: 'VS Code', icon: '◫' },
  windsurf: { name: 'Windsurf', icon: '◨' },
  terminal: { name: 'Terminal', icon: '⌘' },
};

/** Nhãn thô của Claude Code khi sổ app chủ chưa biết phiên đó chạy ở đâu. */
const RAW = {
  'claude-vscode': { nameKey: 'surface.someEditor', icon: '◫' },
  cli: { nameKey: 'surface.cli', icon: '⌘' },
  'sdk-cli': { name: 'Agent SDK', icon: '◇' },
};

export const surfaceIcon = (key) => SURFACES[key]?.icon ?? RAW[key]?.icon ?? '◇';

export function surfaceName(key) {
  const s = SURFACES[key];
  if (s) return s.name;
  const r = RAW[key];
  if (r) return r.name ?? t(r.nameKey);
  return key || t('surface.other');
}

/**
 * Bề mặt của một phiên Claude Code.
 *
 * App chủ (suy từ cây tiến trình) thắng `entrypoint` mỗi khi biết được, vì nó trả lời
 * đúng câu người dùng hỏi. Hai ca chỉ `host` mới nói ra được:
 * `cli` + `claude-desktop` là terminal TRONG Claude Desktop, và `claude-vscode` + `cursor`
 * là Cursor chứ không phải VS Code.
 */
export const surfaceOf = (x) => x?.host ?? x?.entrypoint ?? 'unknown';

/** Có phải bề mặt mà `host` chưa xác định được không — dùng để nói ra chỗ còn mù. */
export const isRawSurface = (key) => key in RAW;
