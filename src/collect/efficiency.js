/**
 * Hiệu quả token — bốn phép đo trả lời câu "tiền có đi vào việc, hay đang rỉ ra đâu đó".
 *
 * `collect/usage.js` đếm TỔNG: theo ngày, theo model, theo dự án, theo thứ gọi ra. Mọi
 * con số ở đó là khối lượng, và khối lượng thì không tự nói được nó đáng hay không đáng.
 * "$1.369 hôm 23/7" là nhiều hay ít thì tuỳ hôm đó làm được bao nhiêu việc — mà mẫu số
 * ấy nằm ở một chart khác, nên phép chia không ai làm hộ.
 *
 * Năm phép đo ở đây đều là TỈ SỐ hoặc là một mảng lãng phí gọi được đúng tên:
 *
 * 1. `turnBands`  — ngữ cảnh phình theo lượt. Lượt thứ 120 đọc lại gấp bốn lượt thứ 5 để
 *    sinh ra cùng một lượng chữ. Đây là chỗ tiền rỉ ra mà không lượt nào trông bất thường.
 * 2. `rewarmCost` — phần trả thêm vì cache nguội trong lúc nghỉ. Mảng duy nhất trong nhóm
 *    này đặt được vào cùng từ vựng với hạn mức: *bỏ phí*.
 * 3. `sessionRoll` — theo PHIÊN, không theo ngày. Một ngày gộp năm phiên thì đột biến của
 *    một phiên bị pha loãng mất.
 * 4. `ratioBands` — phân bố của tỉ số `ngữ cảnh / sinh ra` theo phiên. `sessionRoll` đã có
 *    tỉ số ấy cho từng phiên và một trung vị cho tất cả, nhưng trung vị không nói được HÌNH
 *    DẠNG — mà cái đuôi mới là chỗ đáng đi soi.
 * 5. `sideSplit`  — subagent so với lượt chính. Trường `isSidechain` đã nằm trong
 *    transcript từ đầu và chưa từng được dùng.
 *
 * ## Cả bốn chỉ đọc được từ transcript CÒN SỐNG
 *
 * Sổ cộng dồn (`usage-rollup.json`) khoá theo `ngày × model`, nên không tái dựng được
 * phiên, thứ tự lượt, hay khoảng nghỉ giữa hai lượt. Claude Code thì tự dọn transcript cũ.
 * Vì vậy mọi con số ở đây chỉ phủ phần còn trên đĩa — HẸP HƠN các chart theo ngày ở màn
 * Token, và chỗ gọi phải nói ra khoảng phủ đó thay vì để người đọc tưởng hai khối cùng
 * một tầm nhìn. Muốn giữ lịch sử thì phải có sổ thứ hai khoá theo phiên; chưa làm.
 */

import { costOf } from './usage.js';

/** Tổng cache ghi của một hàng, đã gộp bản ghi đời cũ (không tách TTL) về mức 5 phút. */
const cwOf = (r) => (r.cw5 + r.cw1 ? r.cw5 + r.cw1 : r.cw);

/** Ngữ cảnh ĐỌC VÀO của một lượt — cả ba đường vào, không tính phần sinh ra. */
export const ctxOf = (r) => r.inTok + cwOf(r) + r.cr;

const sum = (a) => a.reduce((n, x) => n + x, 0);

/**
 * Giá mỗi **1M token sinh ra** — mẫu số chuẩn hoá duy nhất dùng được.
 *
 * Token sinh ra là phần việc Claude thật sự làm ra, nên chia cho nó thì "đắt" mới có
 * nghĩa. Chia theo SỐ LƯỢT thì một lượt trả lời "ok" đếm bằng một lượt viết cả file, và
 * tỉ số ra vô nghĩa. Chia theo GIỜ thì đo được thời gian ngồi máy, không đo được gì khác.
 *
 * Mốc 1M chứ không phải 1K: output đo bằng triệu, nên 1M cho ra số nguyên đọc được ngay
 * ($131, $283) thay vì $0,131 — mà ba số lẻ thì trục Y ghi "$0,100" cạnh "$0,200" và cả
 * năm vạch trông như một. Cùng một đại lượng, chỉ khác chỗ đặt dấu phẩy.
 *
 * `null` khi chưa sinh ra gì: 0 ở đây đọc thành "miễn phí", đúng nghĩa ngược với "chưa
 * đo được".
 */
const unitOf = (cost, out) => (out > 0 ? (cost / out) * 1e6 : null);

/**
 * Trung vị, không phải trung bình.
 *
 * Phân bố ngữ cảnh lệch nặng về phải: một lượt `/compact` hay một lần dán 300K vào đủ kéo
 * trung bình của cả băng lên trên mọi lượt thật trong băng đó. Trung vị nói "lượt điển
 * hình ở đây to bằng này", và đó mới là câu người đọc đang hỏi.
 */
export function median(list) {
  if (!list.length) return 0;
  const a = list.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/**
 * Gom hàng theo phiên rồi xếp theo thời gian trong từng phiên.
 *
 * Xếp theo `ts` chứ không theo thứ tự đọc file: một phiên nằm rải trong nhiều transcript
 * sau mỗi lần `--resume`, và `mapLimit` quét song song nên thứ tự file không phải thứ tự
 * thời gian. Hàng không có `ts` hoặc không có `session` bị bỏ — thứ tự lượt là toàn bộ
 * giá trị của phép gom này, mà không có mốc thời gian thì không có thứ tự.
 */
export function bySession(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!r.session || !r.ts) continue;
    if (!m.has(r.session)) m.set(r.session, []);
    m.get(r.session).push(r);
  }
  for (const list of m.values()) list.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  return m;
}

/* ── 1. Ngữ cảnh phình theo lượt ──────────────────────────────────────────── */

/**
 * Băng lượt. Băng cuối là **hở phải** (`101+`) chứ không phải một khoảng đóng: phiên dài
 * nhất trên máy này có 705 lượt, mà chia đều tới đó thì bốn mươi băng gần cuối mỗi băng
 * có vài mẫu — trung vị của bốn mẫu không phải một con số đáng vẽ. Băng hở gom hết cái
 * đuôi vào một chỗ có đủ mẫu, và nhãn nói rõ nó hở.
 */
export const TURN_BANDS = [
  [1, 20],
  [21, 50],
  [51, 100],
  [101, Infinity],
];

/**
 * Phiên ngắn hơn ngần này lượt bị BỎ khỏi phép đo ngữ cảnh-theo-lượt.
 *
 * Phiên 3 lượt chỉ góp mẫu vào băng đầu, nên nếu tính cả chúng thì băng đầu đầy những
 * phiên chưa kịp phình còn băng cuối chỉ có phiên dài — hai băng khác nhau về BẢN CHẤT
 * mẫu, và độ dốc đọc ra sẽ là dốc của phép chọn mẫu, không phải dốc của ngữ cảnh.
 *
 * Ngưỡng bằng mép trên của băng thứ hai: chỉ những phiên đã đi qua ít nhất hai băng mới
 * được góp, nên mỗi băng đều so trên cùng một lớp phiên.
 */
const MIN_TURNS = 50;

/**
 * Ngữ cảnh đọc và chi phí, theo vị trí của lượt trong phiên.
 *
 * `unit` là giá mỗi 1M token SINH RA — xem `unitOf`.
 */
export function turnBands(rows) {
  const sessions = [...bySession(rows).values()].filter((l) => l.length >= MIN_TURNS);
  const bands = TURN_BANDS.map(([lo, hi]) => ({ lo, hi, ctx: [], cost: 0, out: 0, msgs: 0 }));

  for (const list of sessions) {
    list.forEach((r, i) => {
      const turn = i + 1;
      const b = bands.find((x) => turn >= x.lo && turn <= x.hi);
      if (!b) return;
      b.ctx.push(ctxOf(r));
      b.cost += costOf(r) ?? 0;
      b.out += r.out;
      b.msgs += 1;
    });
  }

  return {
    sessions: sessions.length,
    minTurns: MIN_TURNS,
    bands: bands.map((b) => ({
      lo: b.lo,
      hi: Number.isFinite(b.hi) ? b.hi : null,
      msgs: b.msgs,
      cost: b.cost,
      out: b.out,
      ctxMedian: median(b.ctx),
      unit: unitOf(b.cost, b.out),
    })),
  };
}

/* ── 2. Hâm lại cache ─────────────────────────────────────────────────────── */

/** TTL của hai mức cache ghi. Đây là hằng số của API, không phải lựa chọn của dashboard. */
const TTL = { cw5: 5 * 60_000, cw1: 60 * 60_000 };

/**
 * Nghỉ bao lâu — gom thành băng để trả lời câu "nghỉ cỡ nào thì tốn".
 * Băng đầu là chỗ đáng nhìn nhất: đứng dậy lấy cà phê rồi quay lại gõ tiếp.
 */
const GAP_BANDS = [
  ['5-15m', 5 * 60_000, 15 * 60_000],
  ['15-60m', 15 * 60_000, 60 * 60_000],
  ['1-6h', 60 * 60_000, 6 * 3600_000],
  ['6h+', 6 * 3600_000, Infinity],
];

/**
 * Phần trả THÊM vì cache nguội trong lúc nghỉ.
 *
 * Cache ghi tính 1,25× giá input (mức 5 phút) hoặc 2× (mức 1 giờ); cache đọc tính 0,1×.
 * Nghỉ quá TTL thì cùng một tiền tố phải ghi lại thay vì đọc lại — chênh 12,5 lần cho
 * đúng một đống chữ không đổi. Con số trả về là hiệu ấy, tức là **phần lẽ ra không phải
 * trả nếu không đứng lên**.
 *
 * ## Đây là TRẦN TRÊN, không phải hoá đơn
 *
 * Phép đo giả định: lượt này ghi lại VÌ hết TTL. Có ba lý do khác cũng buộc ghi lại mà
 * mốc thời gian không phân biệt được — sửa file trong ngữ cảnh, `/compact`, đổi system
 * prompt. Chúng làm tiền tố khác đi, nên đằng nào cũng phải ghi lại dù cache còn nóng.
 * Vì vậy chỗ hiển thị phải gọi nó là "tối đa", và tuyệt đối không trừ nó vào một con số
 * nào khác như thể đã chắc.
 *
 * Hai mức TTL xét RIÊNG. Bản đầu lấy một ngưỡng 5 phút cho cả hai, và thế là mọi lượt
 * ghi mức 1 giờ sau khi nghỉ 20 phút bị chấm là lãng phí — trong khi cache 1 giờ lúc đó
 * vẫn còn nóng nguyên, chưa hết hạn, không có gì để tiếc.
 *
 * Lượt ĐẦU của mỗi phiên không tính: khởi động nguội thì không có cách nào tránh.
 */
export function rewarmCost(rows) {
  const bands = GAP_BANDS.map(([key, lo, hi]) => ({ key, lo, hi, cost: 0, calls: 0, tokens: 0 }));
  let calls = 0;
  let tokens = 0;
  let extra = 0;
  let cold = 0;

  for (const list of bySession(rows).values()) {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const split = r.cw5 + r.cw1;
      const w5 = split ? r.cw5 : r.cw;
      const w1 = split ? r.cw1 : 0;
      if (!w5 && !w1) continue;

      if (i === 0) {
        cold += w5 + w1;
        continue;
      }

      const gap = Date.parse(r.ts) - Date.parse(list[i - 1].ts);
      // Mỗi mức chỉ tính khi nghỉ vượt TTL CỦA CHÍNH NÓ.
      const stale5 = gap > TTL.cw5 ? w5 : 0;
      const stale1 = gap > TTL.cw1 ? w1 : 0;
      if (!stale5 && !stale1) continue;

      // Hiệu giá cho đúng phần token đã nguội: giá ghi trừ giá đọc, cùng model, cùng ngày
      // (giá giới thiệu áp theo ngày của lượt gọi), qua CHÍNH `costOf` để không có đường
      // nào cho hai chỗ lệch nhau một hệ số.
      const base = { model: r.model, day: r.day, speed: r.speed, inTok: 0, out: 0, cr: 0, cw: 0, cw5: 0, cw1: 0 };
      const asWrite = costOf({ ...base, cw5: stale5, cw1: stale1 });
      const asRead = costOf({ ...base, cr: stale5 + stale1 });
      if (asWrite == null || asRead == null) continue; // model không có giá — không đoán

      const delta = asWrite - asRead;
      calls += 1;
      tokens += stale5 + stale1;
      extra += delta;
      const b = bands.find((x) => gap > x.lo && gap <= x.hi);
      if (b) {
        b.cost += delta;
        b.calls += 1;
        b.tokens += stale5 + stale1;
      }
    }
  }

  return { calls, tokens, extra, cold, bands: bands.map(({ lo, hi, ...b }) => b) };
}

/* ── 3. Theo phiên ────────────────────────────────────────────────────────── */

/**
 * Bao nhiêu phiên được gửi xuống client.
 *
 * Cắt ở đây chứ không ở chỗ vẽ: payload này dựng lại mỗi 30 giây và đi qua dây. Con số
 * TỔNG (`stats`) tính trên TOÀN BỘ phiên trước khi cắt, nên phần bị cắt không làm sai
 * trung vị hay tỉ trọng top — nó chỉ không có mặt trong chart và bảng.
 *
 * 100, không phải 60. Máy này mở ~19 phiên mỗi ngày (287 phiên trong 15 ngày), nên 60 chỉ
 * phủ **hai ngày** — và một chart hai ngày không có đủ nền để nói cột nào là đột biến.
 * 100 phủ chừng năm ngày, vẫn dưới 15KB payload, và ở bề rộng nửa màn thì 100 cột mỗi cột
 * còn ~3px: không đọc được từng phiên, nhưng đọc được HÌNH — mà hình mới là thứ chart này
 * để trả lời. Từng phiên đã có tooltip và bảng số.
 */
const KEEP_SESSIONS = 100;

/**
 * Băng tỉ số `ngữ cảnh / sinh ra`.
 *
 * Mốc chia không phải số chẵn cho đẹp: chúng ôm lấy trung vị đo được của máy này (~116×)
 * sao cho băng giữa là "điển hình" và hai băng ngoài là hai kiểu lệch KHÁC NHAU về bản
 * chất, chứ không phải "hơi cao / rất cao" của cùng một kiểu.
 *
 * - `<80×`     — phiên sinh ra nhiều so với phần đọc vào. Viết code, viết văn bản dài.
 * - `80–150×`  — vùng điển hình, trung vị nằm trong này.
 * - `150–300×` — đã lết: đọc lại nhiều hơn làm ra, nhưng còn trong tầm một phiên dài bình thường.
 * - `300×+`    — phiên chỉ còn đọc lại chính nó. Đây là băng đáng đi soi từng phiên.
 *
 * Băng cuối hở phải, cùng lý do với `TURN_BANDS`: đuôi dài tới hàng nghìn lần, mà chia
 * đều tới đó thì mỗi băng cuối còn một mẫu.
 */
export const RATIO_BANDS = [
  [0, 80],
  [80, 150],
  [150, 300],
  [300, Infinity],
];

/**
 * Phiên phải sinh ra ít nhất ngần này token mới được vào phép đo phân bố tỉ số.
 *
 * Cùng cái bẫy mà `MIN_DAY_OUT` ở màn Token đã chặn, chỉ đổi trục: phiên sinh ra 200 token
 * cho ra tỉ số vài nghìn lần, và một tỉ số dựng trên hai câu trả lời ngắn không nói được
 * gì về cách làm việc — nhưng nó rơi thẳng vào băng `300×+`, đúng cái băng người ta sẽ đi
 * soi. Để nguyên thì băng đó đầy phiên "mở ra rồi đóng lại", và phiên thật sự lết bị lẫn
 * vào giữa.
 */
const MIN_SESSION_OUT = 5_000;

/**
 * Phân bố tỉ số `ngữ cảnh / sinh ra` theo phiên.
 *
 * `sessionRoll` đã tính `ctxPerOut` cho từng phiên và một trung vị cho tất cả — nhưng một
 * trung vị không nói được HÌNH DẠNG, mà hình dạng mới là câu hỏi ở đây: cái đuôi "chỉ đọc
 * lại" có mấy phiên, và chúng ăn bao nhiêu tiền.
 *
 * Mỗi băng mang cả `sessions` lẫn `cost` vì hai con số ấy hay lệch nhau, và chỗ lệch chính
 * là phát hiện: băng `300×+` thường ít phiên nhưng ăn phần tiền lớn hơn hẳn tỉ lệ đầu phiên
 * của nó. Một cột đếm phiên thì không nói được điều đó.
 */
export function ratioBands(rows) {
  const all = [];
  for (const list of bySession(rows).values()) {
    let out = 0;
    let ctx = 0;
    let cost = 0;
    for (const r of list) {
      out += r.out;
      ctx += ctxOf(r);
      cost += costOf(r) ?? 0;
    }
    if (out < MIN_SESSION_OUT) continue;
    all.push({ ratio: ctx / out, cost, out });
  }

  const bands = RATIO_BANDS.map(([lo, hi]) => ({ lo, hi, sessions: 0, cost: 0, out: 0 }));
  for (const s of all) {
    // `>= lo` ở băng đầu và `< hi` ở các băng sau: mốc 80 thuộc băng `80–150`, không thuộc
    // cả hai. Dùng `<=` cả hai đầu là đếm đúp đúng ở những giá trị tròn.
    const b = bands.find((x) => s.ratio >= x.lo && s.ratio < x.hi);
    if (!b) continue;
    b.sessions += 1;
    b.cost += s.cost;
    b.out += s.out;
  }

  const total = sum(all.map((s) => s.cost));
  return {
    sessions: all.length,
    minOut: MIN_SESSION_OUT,
    // Bỏ bao nhiêu phiên vì quá mỏng — đếm ra, không lặng lẽ. Chart nói "290 phiên" ở khối
    // bên cạnh mà khối này nói "184 phiên" thì chênh lệch đó phải có tên.
    thin: bySession(rows).size - all.length,
    median: median(all.map((s) => s.ratio)),
    bands: bands.map((b) => ({
      lo: b.lo,
      hi: Number.isFinite(b.hi) ? b.hi : null,
      sessions: b.sessions,
      cost: b.cost,
      out: b.out,
      // Tỉ trọng tiền, không phải tỉ trọng phiên: câu hỏi là "cái đuôi ăn bao nhiêu".
      share: total > 0 ? b.cost / total : 0,
    })),
  };
}

/**
 * Chi phí theo phiên, cộng với mấy con số nói được "đắt vì làm nhiều" hay "đắt vì lết dài".
 *
 * `ctxPerOut` là tỉ số đó: bao nhiêu token ngữ cảnh phải đọc cho mỗi token sinh ra. Hai
 * phiên cùng $80 mà một cái 130× còn một cái 380× là hai chuyện hoàn toàn khác nhau —
 * cái đầu làm nhiều, cái sau đọc lại nhiều.
 */
export function sessionRoll(rows) {
  const all = [];
  for (const [key, list] of bySession(rows)) {
    const acc = { key, msgs: 0, out: 0, ctx: 0, cost: 0, side: 0, unpriced: 0, cwd: null };
    for (const r of list) {
      acc.msgs += 1;
      acc.out += r.out;
      acc.ctx += ctxOf(r);
      const c = costOf(r);
      if (c == null) acc.unpriced += 1;
      else acc.cost += c;
      if (r.side) acc.side += 1;
      if (r.cwd) acc.cwd = r.cwd;
    }
    acc.t0 = Date.parse(list[0].ts);
    acc.t1 = Date.parse(list.at(-1).ts);
    acc.ctxPerOut = acc.out > 0 ? acc.ctx / acc.out : null;
    acc.unit = unitOf(acc.cost, acc.out);
    all.push(acc);
  }

  const costs = all.map((s) => s.cost);
  const total = sum(costs);
  const byCost = all.slice().sort((a, b) => b.cost - a.cost);

  return {
    stats: {
      n: all.length,
      total,
      medianCost: median(costs),
      // Tỉ trọng của mười phiên đắt nhất. Đây là câu "tiền có tập trung không": tập trung
      // thì sửa mười phiên là đủ, dàn đều thì phải sửa cách làm việc.
      top10Share: total > 0 ? sum(byCost.slice(0, 10).map((s) => s.cost)) / total : 0,
      medianCtxPerOut: median(all.map((s) => s.ctxPerOut).filter((v) => v != null)),
    },
    // Theo THỜI GIAN, mới nhất trước: chart cột đọc theo trục thời gian, và câu người ta
    // hỏi là "gần đây có phiên nào vọt lên không". Xếp theo chi phí thì mất trục ấy, còn
    // bảng số thì tự xếp lại được.
    recent: all
      .slice()
      .sort((a, b) => b.t0 - a.t0)
      .slice(0, KEEP_SESSIONS),
    top: byCost.slice(0, 12),
  };
}

/* ── 4. Subagent ──────────────────────────────────────────────────────────── */

/**
 * Subagent so với lượt chính.
 *
 * Trên máy này subagent chỉ chiếm ~1,6% tiền, nên nó KHÔNG đáng một chart — nhưng tỉ số
 * thì đáng một hàng: giá mỗi 1K token sinh ra của subagent đắt gấp mười lượt chính, vì
 * subagent đọc cả một đống ngữ cảnh rồi trả về một đoạn ngắn. Đó là bản chất của nó, và
 * biết con số ấy thì mới quyết được lúc nào nên tách subagent, lúc nào nên làm thẳng.
 */
export function sideSplit(rows) {
  const bucket = (list) => {
    const cost = sum(list.map((r) => costOf(r) ?? 0));
    const out = sum(list.map((r) => r.out));
    return {
      calls: list.length,
      cost,
      out,
      ctx: sum(list.map(ctxOf)),
      unit: unitOf(cost, out),
    };
  };
  return { side: bucket(rows.filter((r) => r.side)), main: bucket(rows.filter((r) => !r.side)) };
}

/* ── Gộp ──────────────────────────────────────────────────────────────────── */

/**
 * Khoảng phủ THẬT của bốn phép đo trên.
 *
 * Nói ra vì nó hẹp hơn các chart theo ngày ở cùng màn: chart ngày vẽ từ sổ (giữ được cả
 * ngày mà transcript đã bị dọn), còn bốn phép đo này chỉ có transcript sống. Hai khối
 * cạnh nhau mà một khối phủ 15 ngày, khối kia phủ 9 ngày, và không khối nào nói ra thì
 * người đọc sẽ so hai con số không so được với nhau.
 */
export function efficiencyOf(rows) {
  const days = rows.map((r) => r.day).filter(Boolean).sort();
  return {
    ok: rows.length > 0,
    from: days[0] ?? null,
    to: days.at(-1) ?? null,
    requests: rows.length,
    turns: turnBands(rows),
    rewarm: rewarmCost(rows),
    sessions: sessionRoll(rows),
    ratio: ratioBands(rows),
    split: sideSplit(rows),
  };
}
