/**
 * `state.lookback` — phần lịch sử chu kỳ cho màn "Nhìn lại" (phím 8).
 *
 * Đây là bộ LẮP RÁP, không phải bộ đọc đĩa: ba sổ chu kỳ đã nằm sẵn trong memo của các
 * tracker (`trackQuota` giữ sổ Claude, hai tracker ở `cycletrack.js` giữ sổ AG/Cursor),
 * và `buildState` đưa thẳng ba cái Map ấy vào đây. Đọc lại từ đĩa là đọc đúng thứ vừa
 * được ghi ra một nhịp trước — thêm ba lượt I/O mỗi 30 giây để lấy dữ liệu đã có trong
 * bộ nhớ.
 *
 * ## Cái gì KHÔNG nằm trong `state.lookback`
 *
 * Chỉ phần gấp từ sổ + tiền + cổng 3 tuần — vài KB. Ba thứ còn lại của màn đã có chỗ ở
 * trong payload và client tự đọc, không chép thêm bản thứ hai (đúng cam kết "không nuôi
 * B14" của đề xuất):
 *
 * - chu kỳ ĐANG chạy (kèm dự phóng) — `state.quota` / `state.cursor` / `state.agQuota`;
 * - nhịp 14 ngày — `state.usage.series` / `state.cursorEvents.series` /
 *   `state.agTurns.series`;
 * - xu hướng tuần của Claude/Cursor — gấp phía client từ chính hai series trên
 *   (tuần AG thì mỗi chu kỳ đóng của túi Gemini ĐÃ là một tuần, nằm ở `ag.gemini`).
 *
 * Giá gói là config tay (`PLANS`) — đổi gói mà quên sửa thì tiền trên màn sai, nên màn
 * in giá đang khai ngay cạnh số cho mắt bắt được.
 */

import { PLANS } from '../config.js';
import { agLookback, claudeLookback, cursorLookback, gateOf } from '../lib/cycles.js';

export function collectLookback({ claude, cursor, ag, now = Date.now() } = {}) {
  const c = claudeLookback(claude ?? new Map(), { now, planUsd: PLANS.claude });
  const cu = cursorLookback(cursor ?? new Map(), { now, planUsd: PLANS.cursor });
  const a = agLookback(ag ?? new Map(), { now, planUsd: PLANS.antigravity });
  return {
    ok: true,
    at: now,
    claude: c,
    cursor: cu,
    ag: a,
    gate: gateOf([c.openedAt, cu.openedAt, a.openedAt], { now }),
  };
}
