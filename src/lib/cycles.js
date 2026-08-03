/**
 * Toán của màn "Nhìn lại" — gấp sổ chu kỳ thành tiền, thuần hàm.
 *
 * Ba sổ chu kỳ (`quota-cycles`, `ag-cycles`, `cursor-cycles`) ghi cùng một khuôn v2
 * (xem `collect/quotalog.js`), nhưng ba công cụ đo bằng ba đơn vị không quy đổi được:
 * Claude và AG ghi PHẦN TRĂM đã tiêu, Cursor ghi CENTS thật. Module này là chỗ duy nhất
 * biến chúng thành tiền — mỗi công cụ theo đúng luật tiền của nó
 * (docs/PROPOSAL-nhin-lai.md, mục "ba luật tiền"):
 *
 * - **Claude**: $/tháng → $/cửa sổ 7 ngày ($200 → $46,0). Khung 5 giờ KHÔNG mang tiền —
 *   một tuần có ~34 chu kỳ 5h, phần lớn rơi vào lúc ngủ, tô tiền lên chúng là đỏ rực
 *   vô nghĩa. Dãy 5h chỉ trả lời "trần 5h có bao giờ là ràng buộc không".
 * - **Cursor**: cents thật, so với `planCents` của CHÍNH chu kỳ đó (gói đổi được giữa
 *   hai chu kỳ). Bỏ phí = phần gói đã trả mà không dùng tới; vượt gói là quà nhà cung
 *   cấp, không phải chi phí.
 * - **AG**: tiền neo trọn vào túi Gemini ($20 → $4,60/tuần). Túi Claude/GPT cùng gói
 *   không quy tiền — một gói mua HAI túi song song, tách giá là bịa một phép chia
 *   không tồn tại.
 *
 * ## Sổ AG có rác, và phải nói tên nó
 *
 * Hai túi 5 giờ của AG (`3p-5h`, `gemini-5h`) có mốc reset TRƯỢT theo lượt đọc — đo
 * 30/7: hai lượt cách 5 phút cho hai `resetsAt` cách đúng 5 phút. Mỗi lượt đọc thành một
 * "chu kỳ" một mẫu, peak là trị tức thời — 328 bản ghi rác trong sổ sau hai ngày. Chúng
 * không phải chu kỳ (không có ranh cố định để đóng), nên mọi phép gấp ở đây chỉ nhận
 * kind có ranh thật, khai tường minh ở từng hàm. Sổ vẫn ghi chúng — vô hại, bị
 * `trimCycles` chặn trần — nhưng người đọc sổ thì phải biết mà bỏ.
 *
 * Mọi hàm nhận `now` tường minh — bài học B17: "hôm nay" là đầu vào ẩn dễ quên nhất.
 */

/** Giá một tuần của gói trả theo tháng: $200 → 45,996 ≈ $46,0. Hiển thị làm tròn ở view. */
export const usdPerWeek = (usdMonth) => (usdMonth * 12 * 7) / 365.25;

/**
 * Theo tới ngần này phần cửa sổ thì đỉnh coi như chắc — TRÙNG trị với `quotalog.js`
 * (hai chỗ nhắc tên nhau). Đỉnh ghi được là cận DƯỚI: đóng máy giữa chu kỳ thì phần
 * sau không ai nhìn, và "bỏ phí" suy từ đỉnh hụt là cận TRÊN — tô tiền lên nó là vẽ
 * ra một khoản lỗ không có gì bảo đảm. Chu kỳ thiếu vẫn hiện, nhưng không mang tiền.
 */
const WATCHED_ENOUGH = 0.9;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Chu kỳ ĐÃ ĐÓNG của một sổ, lọc theo kind, cũ → mới.
 *
 * Chu kỳ đang chạy không có mặt: đỉnh của nó chưa phải đỉnh, và nó đã có nguồn sống
 * (`state.quota` / `state.cursor` / `state.agQuota`) kể về mình bằng cả dự phóng —
 * sổ chỉ giữ lịch sử.
 */
export function foldCycles(map, kinds, now = Date.now()) {
  const want = new Set(kinds);
  const rows = [];
  for (const c of map?.values?.() ?? []) {
    if (!want.has(c.kind) || c.resetsAt > now) continue;
    // Cùng phép suy với `cyclesOf`: độ phủ đo từ MỐC THỜI GIAN, không tin `elapsedFrac`
    // của lượt đọc — chu kỳ chỉ được nhìn mười phút đầu vẫn phải khai là theo hụt.
    const watchedTo = c.windowMs ? clamp01((c.windowMs - (c.resetsAt - c.lastAt)) / c.windowMs) : null;
    rows.push({ ...c, watchedTo, partial: watchedTo == null || watchedTo < WATCHED_ENOUGH });
  }
  return rows.sort((a, b) => a.resetsAt - b.resetsAt);
}

/** Sổ mở từ bao giờ — bản ghi sớm nhất của các kind được kể. `null` khi chưa có gì. */
export function openedAtOf(map, kinds) {
  const want = new Set(kinds);
  let min = null;
  for (const c of map?.values?.() ?? []) {
    if (!want.has(c.kind) || !Number.isFinite(c.firstAt)) continue;
    if (min == null || c.firstAt < min) min = c.firstAt;
  }
  return min;
}

/**
 * Tiền của một dãy chu kỳ tính theo PHẦN TRĂM (Claude 7 ngày, túi Gemini tuần).
 *
 * `wasteUsd` chỉ có ở chu kỳ theo đủ (`partial` thì `null`, không phải 0 — "không biết"
 * và "không bỏ phí" là hai câu khác nhau). Tổng tiền cũng chỉ cộng phần theo đủ, và
 * `paidUsd` đếm đúng bấy nhiêu chu kỳ — tử số và mẫu số phải cùng một tập.
 */
function pctMoney(rows, cycleUsd) {
  const out = rows.map((c) => ({
    resetsAt: c.resetsAt,
    windowMs: c.windowMs,
    used: c.peak,
    waste: Math.max(0, 100 - c.peak),
    watchedTo: c.watchedTo,
    partial: c.partial,
    samples: c.samples,
    wasteUsd: c.partial ? null : (Math.max(0, 100 - c.peak) / 100) * cycleUsd,
  }));
  const solid = out.filter((c) => !c.partial);
  const wasteUsd = solid.reduce((n, c) => n + c.wasteUsd, 0);
  const worst = solid.reduce((w, c) => (w == null || c.wasteUsd > w.wasteUsd ? c : w), null);
  return {
    cycles: out,
    money: {
      closed: out.length,
      solid: solid.length,
      paidUsd: solid.length * cycleUsd,
      wasteUsd,
      worst: worst && worst.wasteUsd > 0 ? { resetsAt: worst.resetsAt, wasteUsd: worst.wasteUsd } : null,
    },
  };
}

/**
 * Claude — dãy 7 ngày mang tiền, dãy 5 giờ trung tính.
 *
 * `fives` cắt còn 12 cột gần nhất cho payload (mỗi ngày đóng ~4 chu kỳ, cả sổ là 120);
 * `fiveMax` thì đo trên TOÀN sổ — "trần 5h có bao giờ là ràng buộc không" phải trả lời
 * bằng cả lịch sử, không phải bằng đúng mấy cột đang vẽ.
 */
export function claudeLookback(map, { now = Date.now(), planUsd } = {}) {
  const cycleUsd = usdPerWeek(planUsd);
  const sevens = pctMoney(foldCycles(map, ['seven'], now), cycleUsd);
  const fives = foldCycles(map, ['five'], now);
  return {
    planUsd,
    cycleUsd,
    sevens: sevens.cycles,
    money: sevens.money,
    fives: fives.slice(-12).map((c) => ({ resetsAt: c.resetsAt, used: c.peak })),
    fiveMax: fives.length ? Math.max(...fives.map((c) => c.peak)) : null,
    fiveCount: fives.length,
    openedAt: openedAtOf(map, ['five', 'seven']),
  };
}

/**
 * Cursor — cents thật, so với gói của CHÍNH chu kỳ đó.
 *
 * `planCents` đi kèm từng bản ghi (xem `cursorCycleWindows`); thiếu thì rơi về
 * `fallbackPlanUsd` từ config — sổ đời đầu chưa ghi trường này.
 */
export function cursorLookback(map, { now = Date.now(), planUsd } = {}) {
  const rows = foldCycles(map, ['billing'], now).map((c) => {
    const planCents = Number.isFinite(c.planCents) ? c.planCents : Math.round(planUsd * 100);
    const wasteCents = Math.max(0, planCents - c.peak);
    return {
      resetsAt: c.resetsAt,
      windowMs: c.windowMs,
      cents: c.peak,
      planCents,
      bonusCents: c.bonusCents ?? null,
      watchedTo: c.watchedTo,
      partial: c.partial,
      over: c.peak > planCents,
      wasteUsd: c.partial ? null : wasteCents / 100,
    };
  });
  const solid = rows.filter((c) => !c.partial);
  return {
    planUsd,
    cycles: rows,
    money: {
      closed: rows.length,
      solid: solid.length,
      paidUsd: solid.reduce((n, c) => n + c.planCents / 100, 0),
      wasteUsd: solid.reduce((n, c) => n + c.wasteUsd, 0),
      overCount: solid.filter((c) => c.over).length,
    },
    openedAt: openedAtOf(map, ['billing']),
  };
}

/**
 * Antigravity — tiền neo vào túi Gemini; túi Claude/GPT chỉ ra chữ, không ra đô.
 *
 * CHỈ hai kind `-weekly` được đọc. `3p-5h`/`gemini-5h` là rác cửa sổ trượt (đầu file),
 * và mọi kind lạ sau này cũng bị bỏ cho tới khi có người nhìn nó tận mắt — sổ này là
 * thứ người ta đọc để quyết giữ hay hạ một gói $20, thà thiếu còn hơn cộng nhầm rác.
 */
export function agLookback(map, { now = Date.now(), planUsd } = {}) {
  const cycleUsd = usdPerWeek(planUsd);
  const gemini = pctMoney(foldCycles(map, ['gemini-weekly'], now), cycleUsd);
  const threep = foldCycles(map, ['3p-weekly'], now);
  return {
    planUsd,
    cycleUsd,
    gemini: gemini.cycles,
    money: gemini.money,
    threep: threep.map((c) => ({ resetsAt: c.resetsAt, used: c.peak, partial: c.partial })),
    openedAt: openedAtOf(map, ['gemini-weekly', '3p-weekly']),
  };
}

/** Khối "Xu hướng tuần" cần ít nhất ngần này tuổi sổ mới đứng vững. */
export const TREND_NEED_MS = 21 * 86400_000;

/**
 * Cổng theo-dữ-liệu-có-thật của khối C: mở khi sổ NON NHẤT đã đủ 3 tuần.
 *
 * `max` chứ không phải `min`: khối này so tuần của ba công cụ với nhau, mà so trên một
 * sổ mới hai tuần là vẽ một cột cụt đứng cạnh các cột đủ — sổ non nhất đặt nhịp chung.
 * Sổ chưa từng mở (`null`) thì KHÔNG kể vào phép chờ: công cụ không có sổ sẽ không có
 * dải tuần, không có lý do bắt hai công cụ kia chờ nó vô hạn.
 */
export function gateOf(openedAts, { now = Date.now(), needMs = TREND_NEED_MS } = {}) {
  const known = openedAts.filter((v) => Number.isFinite(v));
  if (!known.length) return { open: false, openedAt: null, opensAt: null };
  const openedAt = Math.max(...known);
  const opensAt = openedAt + needMs;
  return { open: now >= opensAt, openedAt, opensAt };
}
