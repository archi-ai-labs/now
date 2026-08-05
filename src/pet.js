/**
 * Quản gia nuôi được — sổ xu, cơn đói, và cái cửa hàng.
 *
 * ## Vì sao lớp này được phép tồn tại, sau khi `d-game` đã gỡ đúng một lớp như thế
 *
 * Chốt `d-game` (xem `design/README.vi.md`) đã bỏ XP và hạng D→S, vì chúng phạm nguyên
 * tắc lớn nhất của dự án — *mọi con số phải có thật*. XP cũ = `việc×25 + chuỗi×30 +
 * board×10`: ba đầu vào thật, ba **trọng số bịa**, rồi quy thành một hạng chữ cái đứng
 * ngay cạnh mấy con số đo được và trông cũng y như một phép đo.
 *
 * Lớp này khác ở ba chỗ, và cả ba đều là điều kiện để nó ở lại:
 *
 * 1. **Không có trọng số nào để bịa.** Tỉ giá là `1 xu = $1` — xem `RATE`. Không phải
 *    một hệ số chọn cho "cảm giác đúng"; nó là chính con số đô-la, chỉ đổi tên. Muốn
 *    biết mình có bao nhiêu xu thì cứ đọc hoá đơn ước tính, không cần học phép quy đổi.
 * 2. **Đồng xu không giả vờ đo cái gì.** Hạng `S` nói với người đọc rằng họ đã được
 *    ĐÁNH GIÁ. Một con thú ăn hết bát phở thì không ai nhầm là số liệu.
 * 3. **Nó không đứng trên mặt số liệu.** Ví xu và cửa hàng ở màn riêng, nhân vật ở
 *    popover. Không một con số thật nào bị dán nhãn mới, không một thẻ hạn mức nào mọc
 *    thêm huy hiệu.
 *
 * Và nó THUẬN với luận điểm gốc chứ không cãi lại: luật 1 trong `CLAUDE.md` — *tiêu hết
 * là ĐÍCH*. Hạn mức trả trước không cộng dồn, phần chưa dùng lúc reset là mất trắng. Nên
 * thưởng theo tiền đã tiêu là thưởng đúng cái hành vi dự án này vẫn cổ vũ; nó không đẻ
 * ra một động cơ mới nào ngoài cái đã có.
 *
 * ## Cơn đói cũng là một số đo được
 *
 * Nó là **khoảng thời gian kể từ lần cho ăn cuối** — một hiệu số hai mốc đồng hồ, đọc ra
 * từ sổ, không phải một thanh tự tụt theo luật chơi nào. Chỗ duy nhất do người đặt là
 * `FULL_MS` (bao lâu thì hết no), và nó là một hằng số công khai chứ không phải trọng số
 * ẩn trong một tổng.
 *
 * ## Sổ nằm ở đâu, và vì sao không nằm trong localStorage
 *
 * `~/.now-dashboard/pet.json`, cạnh `usage-rollup.json`. Hai lý do:
 * - Nguồn tiền là số do SERVER tính (`collect/usage.js` đọc transcript). Để trình duyệt
 *   giữ sổ thì trình duyệt cũng phải tự cộng tiền, tức là tự đặt giá cho chính mình.
 * - Popover và dashboard là hai trang. Chúng chung origin nên chung được `localStorage`
 *   thật, nhưng xoá dữ liệu duyệt web một lần là mất sạch xu — mà xu thì đổi từ một
 *   khoản chi có thật.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './config.js';

export const PET_FILE = path.join(DATA_DIR, 'pet.json');

/**
 * Tỉ giá: **1 xu cho mỗi $1 tiêu ước tính**.
 *
 * Cố ý là 1, không phải 10 hay 0,5. Hễ tỉ giá khác 1 là lập tức có một con số phải giải
 * thích ("sao $50 lại ra 500 xu?"), và cái phép nhân ấy đúng là loại trọng số mà `d-game`
 * đã gỡ. Để nó bằng 1 thì ví xu ĐỌC RA CHÍNH hoá đơn: 213 xu nghĩa là $213 đã tiêu kể từ
 * ngày mở sổ. Không có gì để học thuộc.
 *
 * Giá hàng hoá vì thế phải neo theo nhịp tiêu thật, không neo theo cảm giác. Đo trên máy
 * này 5/8: $50/ngày, $963/tuần — nên một món ăn 6–26 xu là chuyện trong ngày, còn một
 * món trang trí 70–320 xu là chuyện vài ngày tới một tuần.
 */
export const RATE = 1;

/** No căng → đói hẳn. 20 giờ: đủ để một ngày làm việc bình thường chỉ phải cho ăn một
 *  lần, và đủ để sáng hôm sau mở popover ra thì thấy nó đang đói thật. */
export const FULL_MS = 20 * 3600 * 1000;

/**
 * Bảng hàng hoá — **giá sống ở server**, không sống ở trình duyệt.
 *
 * Trình duyệt chỉ gửi lên một mã món. Nếu giá đi kèm theo request thì mọi người mở
 * DevTools đều mua được cái mũ 320 xu với giá 0, và lúc ấy cửa hàng không còn là cửa
 * hàng. Đây cũng là lý do `buy()` tra giá từ bảng này chứ không tin gì từ đầu vào.
 *
 * `fill` (món ăn) = phần thanh đói được lấp lại, 0..1. `slot` (đồ trang trí) = chỗ đứng
 * trong khung trời của popover; mỗi chỗ chứa đúng một món nên không món nào đè món nào.
 */
export const ITEMS = {
  // ── Ăn uống: mua là ăn luôn, không có kho ────────────────────────────────
  coffee: { kind: 'food', price: 6, fill: 0.25 },
  che: { kind: 'food', price: 10, fill: 0.35 },
  beer: { kind: 'food', price: 12, fill: 0.3 },
  banhmi: { kind: 'food', price: 14, fill: 0.5 },
  pho: { kind: 'food', price: 26, fill: 0.9 },

  // ── Trang trí: mua một lần, ở lại vĩnh viễn ──────────────────────────────
  hat: { kind: 'decor', price: 70, slot: 'head' },
  plant: { kind: 'decor', price: 90, slot: 'left' },
  balloon: { kind: 'decor', price: 130, slot: 'air' },
  bunting: { kind: 'decor', price: 170, slot: 'top' },
  cat: { kind: 'decor', price: 240, slot: 'right' },
  rainbow: { kind: 'decor', price: 320, slot: 'back' },
};

export const FOODS = Object.keys(ITEMS).filter((k) => ITEMS[k].kind === 'food');
export const DECORS = Object.keys(ITEMS).filter((k) => ITEMS[k].kind === 'decor');

/** Món ăn còn nằm cạnh nhân vật bao lâu sau khi ăn. Chỉ để nhìn, không cộng gì thêm. */
export const MEAL_SHOW_MS = 45 * 60 * 1000;

/** Giữ lại ngần này ngày trong `credited`. Lớn hơn cửa sổ sổ token (45) để một ngày còn
 *  trong `series` không bao giờ bị dọn khỏi đây rồi được cộng tiền lần hai. */
const KEEP_DAYS = 120;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Sổ mới — và đây là chỗ dễ sai nhất của cả file.
 *
 * Máy này đã tiêu $6.813 trước khi trò chơi tồn tại. Cộng hết chỗ đó vào là ngay giây
 * đầu tiên đã mua sạch cửa hàng, và cái đang định làm — một lý do nhỏ để quay lại — chết
 * ngay lúc sinh ra. Nên sổ mới **đánh dấu mọi ngày CŨ là đã cộng rồi**, không phải cộng
 * chúng.
 *
 * Riêng HÔM NAY thì để nguyên 0. Mở trò chơi lúc 3 giờ chiều mà ví rỗng tới tận nửa đêm
 * thì lần mở đầu tiên chẳng có gì để làm; lấy trọn ngày hôm nay là đủ vốn mua bữa đầu
 * ngay, mà vẫn không đụng vào lịch sử.
 */
export function emptyLedger(series = [], today = null, nowMs = Date.now()) {
  const credited = {};
  for (const d of series) {
    if (today && d.day >= today) continue;
    credited[d.day] = d.cost;
  }
  return {
    v: 1,
    on: true,
    since: today,
    coins: 0,
    earned: 0,
    spent: 0,
    credited,
    fedAt: new Date(nowMs).toISOString(),
    owned: [],
    lastMeal: null,
    lastMealAt: null,
    meals: 0,
  };
}

/**
 * Cộng xu cho phần tiền chưa được cộng — **theo NGÀY, không theo tổng**.
 *
 * Cách hiển nhiên là nhớ một con số `đã cộng tới $X` rồi so với `usage.all.cost`. Nó hỏng
 * đúng ở đặc điểm đã ghi trong `config.js`: Claude Code tự xoá transcript cũ, nên tổng
 * lịch sử **tụt xuống** theo thời gian. Tổng tụt thì hiệu số âm, và ví đứng hình vĩnh
 * viễn cho tới khi tiêu bù lại đúng chỗ vừa mất — trên máy này là hàng nghìn đô.
 *
 * Khoá theo ngày thì mỗi ngày tự chốt sổ của nó. Ngày rơi khỏi `series` chỉ có nghĩa là
 * không cộng thêm gì cho ngày đó nữa, không kéo theo ai cả.
 *
 * Hàm THUẦN: trả sổ mới, không ghi đĩa. Gọi bao nhiêu lần với cùng đầu vào cũng ra cùng
 * một kết quả — đó chính là thứ làm "bấm F5 mười lần" không đẻ ra xu nào.
 */
export function accrue(ledger, series, today) {
  const credited = { ...ledger.credited };
  let minted = 0;
  for (const d of series) {
    const before = credited[d.day] ?? 0;
    // `cost` chỉ tăng trong ngày, nhưng một lượt quét lỗi có thể trả về ít hơn. Lấy phần
    // dương thôi, và KHÔNG hạ `credited` xuống — hạ xuống là mở đường cộng tiền hai lần.
    if (d.cost > before) {
      minted += (d.cost - before) * RATE;
      credited[d.day] = d.cost;
    }
  }
  // Dọn ngày đã rơi khỏi sổ token. An toàn vì chúng không bao giờ quay lại: sổ chỉ mất
  // ngày ở phía CŨ, và mốc cắt ở đây còn lùi hơn cửa sổ của sổ token.
  const cut = dayBefore(today, KEEP_DAYS);
  for (const day of Object.keys(credited)) if (cut && day < cut) delete credited[day];

  if (!minted) return { ...ledger, credited };
  return { ...ledger, credited, coins: ledger.coins + minted, earned: ledger.earned + minted };
}

/** `YYYY-MM-DD` lùi `n` ngày. Tính trên UTC vì cả hai đầu chỉ là chuỗi ngày để so sánh. */
function dayBefore(today, n) {
  const ms = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms - n * 86400000).toISOString().slice(0, 10);
}

/** Độ no, 0..1. Chỉ là hiệu hai mốc đồng hồ chia cho `FULL_MS` — không có gì hơn. */
export function fullnessOf(ledger, nowMs = Date.now()) {
  const fed = Date.parse(ledger.fedAt ?? '');
  if (Number.isNaN(fed)) return 0;
  return clamp01(1 - (nowMs - fed) / FULL_MS);
}

/**
 * Tâm trạng — suy từ độ no, và nó phải nói được bằng HÌNH chứ không chỉ bằng màu.
 *
 * Cùng lý do đã ghi cho cặp mắt mở/nhắm trong `lib/menubar-view.js`: theme daltonized
 * không được dựa vào mỗi một khác biệt màu.
 */
export function moodOf(full) {
  if (full <= 0.12) return 'starving';
  if (full <= 0.35) return 'hungry';
  if (full >= 0.85) return 'stuffed';
  return 'fine';
}

/**
 * Mua một món. Hàm THUẦN — trả `{ ledger, error }`, không ném và không ghi đĩa.
 *
 * Món ăn thì mua = ăn luôn, không có kho: một cái kho bắt người ta bấm hai lần cho một
 * việc, mà việc ấy vốn chỉ có một ý nghĩa duy nhất. Món trang trí thì mua một lần và ở
 * lại — mua lần hai bị từ chối chứ không lặng lẽ trừ tiền.
 */
export function buy(ledger, id, nowMs = Date.now()) {
  // `Object.hasOwn`, KHÔNG phải `ITEMS[id]` trơn. `ITEMS` là object literal nên nó thừa
  // kế cả `Object.prototype`: `ITEMS['constructor']` trả về một HÀM — truthy — và lọt
  // thẳng qua cửa "không có món này". Sau đó `item.price` là `undefined`, phép so
  // `coins < undefined` ra `false`, nên nó đi tiếp vào nhánh ăn và `fill` undefined biến
  // `fedAt` thành `Invalid Date`. Sổ hỏng, không một dòng lỗi nào lúc ghi.
  //
  // Đã gặp thật: `test/pet.test.js` bắt được bằng đúng `constructor` và `__proto__`.
  const item = Object.hasOwn(ITEMS, id) ? ITEMS[id] : null;
  if (!item) return { ledger, error: 'không có món này' };
  if (item.kind === 'decor' && ledger.owned.includes(id)) return { ledger, error: 'đã có rồi' };
  if (ledger.coins < item.price) return { ledger, error: 'không đủ xu' };

  const next = { ...ledger, coins: ledger.coins - item.price, spent: ledger.spent + item.price };
  if (item.kind === 'decor') return { ledger: { ...next, owned: [...ledger.owned, id] }, error: null };

  // Ăn: đẩy mốc `fedAt` về phía trước sao cho độ no tăng đúng `fill`, và KHÔNG vượt quá
  // no căng. Tính ngược từ độ no mong muốn thay vì cộng thẳng vào `fedAt` — cộng thẳng
  // thì ăn lúc đang no sẽ đẩy mốc ra tương lai, và thanh đói đứng đầy nhiều giờ liền.
  const full = clamp01(fullnessOf(ledger, nowMs) + item.fill);
  return {
    ledger: {
      ...next,
      fedAt: new Date(nowMs - (1 - full) * FULL_MS).toISOString(),
      lastMeal: id,
      lastMealAt: new Date(nowMs).toISOString(),
      meals: ledger.meals + 1,
    },
    error: null,
  };
}

/**
 * Bản gửi ra trình duyệt.
 *
 * `coins` làm tròn XUỐNG. Trong sổ nó là số thực (tiền lẻ của một ngày đang chạy phải
 * được giữ, nếu không thì mỗi lượt quét lại đánh rơi phần thập phân), nhưng đưa ra màn
 * hình thì "213 xu" — không ai đếm tiền tới bốn chữ số sau dấu phẩy.
 */
export function petView(ledger, nowMs = Date.now()) {
  const full = fullnessOf(ledger, nowMs);
  const mealAt = Date.parse(ledger.lastMealAt ?? '');
  return {
    on: ledger.on !== false,
    coins: Math.floor(ledger.coins),
    earned: Math.floor(ledger.earned),
    spent: ledger.spent,
    since: ledger.since,
    full,
    mood: moodOf(full),
    fedAt: ledger.fedAt,
    owned: ledger.owned,
    meals: ledger.meals,
    // Món vừa ăn chỉ còn đứng cạnh nhân vật một lúc. Hết giờ thì thôi, chứ không để
    // một bát phở nằm đó ba ngày.
    holding: !Number.isNaN(mealAt) && nowMs - mealAt < MEAL_SHOW_MS ? ledger.lastMeal : null,
    rate: RATE,
    fullMs: FULL_MS,
    items: Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [k, { ...v }])),
  };
}

/* ── Đĩa ──────────────────────────────────────────────────────────────────── */

/** Đọc sổ. Không có, hỏng, hay sai phiên bản → `null`, để chỗ gọi tự dựng sổ mới. */
export async function readLedger() {
  try {
    const raw = JSON.parse(await fs.readFile(PET_FILE, 'utf8'));
    if (raw?.v !== 1) return null;
    // Vá mấy trường có thể thiếu ở sổ do bản cũ ghi — rẻ hơn một lớp migrate, và sổ này
    // hỏng thì chỉ mất xu chứ không mất số liệu nào.
    return {
      ...raw,
      credited: raw.credited ?? {},
      // Cùng cái bẫy đã ghi ở `buy`: một sổ chép tay có `owned: ["constructor"]` sẽ lọt
      // qua phép lọc `ITEMS[id]` trơn rồi ném lúc vẽ.
      owned: Array.isArray(raw.owned) ? raw.owned.filter((id) => Object.hasOwn(ITEMS, id)) : [],
      coins: Number(raw.coins) || 0,
      earned: Number(raw.earned) || 0,
      spent: Number(raw.spent) || 0,
      meals: Number(raw.meals) || 0,
    };
  } catch {
    return null;
  }
}

/** Ghi sổ. Ghi tạm rồi đổi tên — cùng cách `collect/quotalog.js` làm, để một lần tắt
 *  máy giữa chừng không để lại một file JSON cụt. */
export async function writeLedger(ledger) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${PET_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(ledger, null, 1));
  await fs.rename(tmp, PET_FILE);
}
