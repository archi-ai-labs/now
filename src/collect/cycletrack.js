/**
 * Sổ chu kỳ cho hai bề mặt còn lại — Antigravity và Cursor.
 *
 * `quotalog.js` giữ lịch sử chu kỳ cho Claude từ 26/7. Hai bề mặt kia tới 28/7 vẫn chỉ có
 * ẢNH CHỤP CUỐI (`ag-quota.json`, `cursor-usage.json`) — và ảnh AG bị ghi đè mỗi lượt,
 * nên đỉnh của một tuần biến mất đúng lúc reset: đo 28/7, túi Gemini đang 91% với mốc
 * reset 08:04 sáng 29/7 — không gấp vào sổ trước mốc đó là mất vĩnh viễn điểm dữ liệu
 * đầu tiên. Vì thế file này lên TRƯỚC màn "Nhìn lại" sẽ đọc nó
 * (docs/PROPOSAL-nhin-lai.md), đúng luật đã ghi ở `QUOTA_LOG`: sổ ghi từ lượt quét đầu,
 * kể cả khi chưa chart nào đọc.
 *
 * Dùng CHUNG khuôn sổ v2 và toàn bộ máy đọc/ghi/cắt của `quotalog.js`; chỉ khác nguồn
 * cửa sổ:
 *
 * - **AG**: mỗi bucket hạn mức là một loại chu kỳ, `kind` lấy theo `bucketId`
 *   (`gemini-weekly`, `3p-5h`…) — định danh server đặt, không phải chuỗi hiển thị.
 *   `peak` là % đã tiêu, cùng đơn vị với sổ Claude.
 * - **Cursor**: một loại duy nhất `billing`, và `peak` là **CENTS đã tiêu** — phần trăm
 *   của Cursor có ba con số trên ba mẫu số khác nhau, còn cents thì thẳng (xem đề xuất,
 *   mục luật tiền). `unit:'cents'` ghi hẳn vào bản ghi để người đọc sổ sau không phải
 *   đoán; `planCents`/`bonusCents` đi kèm TỪNG chu kỳ vì gói có thể đổi giữa hai chu kỳ.
 */

import { AG_CYCLES_LOG, CURSOR_CYCLES_LOG } from '../config.js';
import { bumpWindows, readCycles, writeCycles } from './quotalog.js';

/** Cửa sổ sổ-chu-kỳ từ một lượt đọc hạn mức AG đã bóc (`parseAgQuota`). Hàm thuần. */
export function agCycleWindows(ag) {
  if (!ag?.ok) return [];
  const out = [];
  for (const g of ag.groups ?? []) {
    for (const b of g.buckets ?? []) {
      if (!Number.isFinite(b?.used) || b.resetsAt == null) continue;
      out.push({ kind: b.key, resetsAt: b.resetsAt, windowMs: b.windowMs ?? null, used: b.used });
    }
  }
  return out;
}

/** Cửa sổ sổ-chu-kỳ từ một lượt đọc Cursor đã bóc (`parseCursorUsage`). Hàm thuần. */
export function cursorCycleWindows(cu) {
  if (!cu?.ok || cu.cycle?.endAt == null || !Number.isFinite(cu.total?.cents)) return [];
  return [
    {
      kind: 'billing',
      resetsAt: cu.cycle.endAt,
      windowMs: cu.cycle.windowMs ?? null,
      used: cu.total.cents,
      extra: { unit: 'cents', planCents: cu.planCents ?? null, bonusCents: cu.bonusCents ?? null },
    },
  ];
}

/**
 * Một sổ = một tracker, memo theo tiến trình — y khuôn `trackQuota`, kể cả chỗ ghi đĩa
 * không await: đĩa chậm không được chặn lượt quét, đỉnh vẫn nằm trong bộ nhớ cho lượt ghi
 * sau. Lỗi ghi ra stderr (launchd gom về `service.err.log`) chứ không nuốt trắng — đúng
 * bài học `B13`, vì sổ này mà câm thì không ai biết một tuần AG vừa rơi mất.
 */
export function makeTracker(file) {
  let memo = null;
  const track = async (windows, at) => {
    // Sổ được nạp CẢ KHI lượt này không mang cửa sổ nào (app đóng, nguồn hỏng): từ 30/7
    // `collectLookback` đọc lịch sử qua chính memo này, mà lịch sử trên đĩa thì không
    // phụ thuộc việc hôm nay nguồn có sống hay không — AG tắt cả ngày vẫn phải thấy
    // các tuần đã ghi.
    if (memo == null) memo = await readCycles(file);
    if (!windows.length || typeof at !== 'number') return { path: file, size: memo.size, cycles: memo };
    const next = bumpWindows(memo, at, windows);
    if (next !== memo) {
      memo = next;
      writeCycles(memo, file, at).then(
        (trimmed) => {
          memo = trimmed;
        },
        (err) => console.error(`cycletrack: ghi ${file} hỏng — ${err.message}`),
      );
    }
    // `cycles` là chính cái Map trong memo — đường đọc của `collectLookback`. Cùng cảnh
    // báo với `trackQuota`: không được để nó lọt vào state, JSON hoá Map ra `{}`.
    return { path: file, size: memo.size, cycles: memo };
  };
  // Chỉ test dùng: sổ là trạng thái toàn tiến trình, mà test thì phải độc lập nhau.
  track._reset = () => {
    memo = null;
  };
  return track;
}

const agTrack = makeTracker(AG_CYCLES_LOG);
const cursorTrack = makeTracker(CURSOR_CYCLES_LOG);

/** Gấp một lượt đọc hạn mức AG vào sổ. Đứng trong đường quét nên không bao giờ ném. */
export const trackAgCycles = (ag) => agTrack(agCycleWindows(ag), ag?.at);

/** Gấp một lượt đọc Cursor vào sổ. Cùng luật. */
export const trackCursorCycles = (cu) => cursorTrack(cursorCycleWindows(cu), cu?.at);
