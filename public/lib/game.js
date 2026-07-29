/**
 * Các con số đo được về nhịp làm việc.
 *
 * Nguyên tắc duy nhất: **mọi con số phải có thật**.
 *
 * `chốt d-game` (2026-07-23) — đã BỎ: XP, hạng D→S, và dấu ưu tiên `!!` `!` `~`.
 * Lý do không phải thẩm mỹ mà là chính nguyên tắc trên. XP cũ =
 * `việc×25 + chuỗi×30 + board tươi×10`: ba đầu vào đều thật, nhưng ba trọng số
 * thì bịa, và `done7` lại dựng trên `recentlyDone` — thứ mà chính màn Thống kê
 * ghi rõ là **sàn**, không phải tổng (mỗi board chỉ giữ 5 mục). Một con số bịa
 * đặt lên một con số thiếu, rồi quy thành hạng chữ cái, là đúng cái kiểu "thanh
 * XP bịa" mà bản đầu tiên tự cảnh báo phải tránh.
 *
 * Giữ lại nguyên vẹn phần ĐO ĐƯỢC: chuỗi ngày liên tiếp và số việc xong 7 ngày.
 * Chúng vẫn là câu trả lời thật cho "mấy hôm nay mình làm được gì", chỉ khác là
 * giờ được hiện thẳng dạng số thay vì quy đổi qua một cái thang tự chế.
 */

import { t } from './i18n.js';

/** Số ngày liên tiếp tính từ hôm nay (hoặc hôm qua) mà có ít nhất một việc xong. */
export function streak(timeline) {
  if (!timeline.length) return 0;
  const has = new Set(timeline.filter((d) => d.items.length).map((d) => d.date));
  const dayStr = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  // Cho phép bắt đầu từ hôm qua — sáng sớm chưa kịp làm gì mà chuỗi đã tụt về 0
  // thì con số này chỉ gây bực chứ không nói lên điều gì.
  let start = has.has(dayStr(0)) ? 0 : has.has(dayStr(1)) ? 1 : -1;
  if (start < 0) return 0;
  let n = 0;
  while (has.has(dayStr(start + n))) n++;
  return n;
}

/** Nhịp làm việc — chỉ những gì đếm được thẳng từ board, không quy đổi. */
export function score(state) {
  return {
    done7: state.timeline.filter((d) => (d.ageDays ?? 99) <= 7).reduce((n, d) => n + d.items.length, 0),
    streak: streak(state.timeline),
    fresh: state.projects.filter((p) => p.health === 'fresh').length,
  };
}

/**
 * Tình trạng một dự án — nói bằng CHỮ, không bằng hạng chữ cái hay dấu `!!`.
 *
 * Bản cũ dùng `!!` / `!` / `~` / `✓`. Vấn đề: người đọc phải học một bảng ký hiệu
 * riêng trước khi hiểu được màn hình, mà thứ nó mã hoá thì viết thẳng ra chỉ mất
 * hai chữ. Màu vẫn giữ, nhưng luôn đi KÈM chữ chứ không bao giờ đứng một mình.
 */
export function projectState(p) {
  if (p.counts.hot) return { label: t('pstate.blocked'), color: 'var(--crit)' };
  if (p.health === 'stale' || p.health === 'broken') return { label: t('pstate.stale'), color: 'var(--warn)' };
  if (p.health === 'drifting' || p.counts.decisions) return { label: t('pstate.pending'), color: 'var(--warn)' };
  return { label: t('pstate.ok'), color: 'var(--ok)' };
}

/**
 * Độ gấp của một quyết định: càng treo lâu càng cao, và khoá đúng việc đang làm
 * thì cộng thêm. Đây là cách duy nhất để hai quyết định cùng mức `now` vẫn xếp
 * được thứ tự nên trả lời cái nào trước.
 */
export function threat(d) {
  const age = Math.min(60, (d.ageDays ?? 0) * 6);
  const base = d.heat === 'now' ? 40 : d.heat === 'soon' ? 20 : 8;
  return Math.min(100, base + age + (d.blocksFocus ? 20 : 0));
}

/** Lớp nhân vật của một phiên Claude — suy từ nơi nó được mở. */
export function unitClass(entrypoint) {
  if (entrypoint === 'cli') return { icon: '⌘', label: 'terminal' };
  if (entrypoint === 'claude-vscode') return { icon: '◫', label: t('unit.editor') };
  if (entrypoint === 'claude-desktop') return { icon: '◈', label: t('unit.desktop') };
  return { icon: '◇', label: entrypoint || t('unit.other') };
}
