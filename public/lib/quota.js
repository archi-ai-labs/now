/**
 * Hạn mức, đọc thành câu.
 *
 * `collect/quota.js` trả về phần trăm **đã tiêu** và một dự báo tuyến tính cho mỗi cửa
 * sổ. Module này là chỗ DUY NHẤT biến chúng thành chữ và thành thanh, để quản gia và
 * màn Token không kể hai câu chuyện khác nhau về cùng một con số — hai chỗ cùng nói về
 * hạn mức mà lệch nhau thì không chỗ nào còn đáng tin.
 *
 * **Đích là tiêu hết.** Gói thuê bao đã trả tiền rồi, còn hạn mức thì reset theo cửa sổ
 * và KHÔNG cộng dồn: phần chưa dùng tới lúc reset là mất trắng. Nên "còn nhiều" không
 * phải tin tốt — đó là tiền đã trả mà không lấy về; và "đã tiêu 90%" cũng không phải
 * cảnh báo — đó là đang dùng đúng thứ mình mua.
 *
 * Vì vậy ở đây chỉ có MỘT thất bại thật: **bỏ phí** — tới lúc reset vẫn còn hạn mức chưa
 * dùng. Cạn trước reset không phải sự cố, đó là đích; cạn sớm quá thì có cái giá riêng
 * (ngồi không chờ reset) nhưng cái giá ấy trả bằng THỜI GIAN, không phải bằng tiền, nên
 * nó được nói ra bằng chữ chứ không được cướp kênh màu.
 *
 * Ba luật:
 *
 * 1. **Số dẫn là ĐÃ TIÊU.** "Còn 57%" và "đã tiêu 43%" là cùng một con số, nhưng câu
 *    đầu khen ngầm cái đáng bị báo cáo. Phần chưa dùng chỉ xuất hiện dưới đúng tên của
 *    nó — *bỏ phí* — và chỉ ở chỗ dự báo, nơi nó thật sự là một kết cục.
 * 2. **Màu nói về BỎ PHÍ, không nói về độ đầy.** Thanh dài không còn nghĩa là nguy —
 *    ngược lại. Kênh màu đo đúng một đại lượng, và đo nó theo cả hai chiều (xem
 *    `verdictOf`).
 * 3. **Không đoán thì nói là không đoán.** `forecast.known === false` có ba lý do khác
 *    nhau và cả ba đều được viết ra, thay vì để trống cho người xem tự suy.
 */

import { html, raw, ago, clock, JUST_NOW_MS } from './dom.js';
import { locale, t } from './i18n.js';
import { flatTip, tipOf } from './tip.js';

/**
 * Mốc thời gian tuyệt đối, đủ chính xác mà không thừa.
 *
 * Trong ngày thì giờ:phút là đủ. Xa hơn thì PHẢI có thứ trong tuần: khung 7 ngày cạn
 * vào "14:20" mà không nói ngày nào là câu vô nghĩa — và tệ hơn là nghe như chiều nay.
 */
export function stamp(ts) {
  if (ts == null) return '—';
  return ts - Date.now() < 20 * 3600_000
    ? clock(ts)
    : new Date(ts).toLocaleString(locale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * "reset sau 29 phút" — bao nhiêu THỜI GIAN còn lại để tiêu.
 *
 * Ở đây chứ không ở `views/usage.js` (chỗ nó ra đời) vì cả ba khối hạn mức đều cần đúng
 * câu này: thẻ Claude, dòng rút gọn của Cursor/Antigravity, và dải quản gia. Cùng một
 * phép đo mà ba chỗ tự viết ba lần thì sớm muộn có chỗ ghi "còn 29 phút" — đúng cái chiều
 * đọc mà cả module này tồn tại để chặn.
 *
 * Nó là số ĐO THỜI GIAN, nên không bao giờ mang màu của thang bỏ phí. Xem `idleMsOf`.
 */
export function resetLabel(w) {
  if (w?.resetsInMs == null) return '';
  return w.expired ? t('quota.resetPassed') : t('quota.resetIn', { d: ago(w.resetsInMs) });
}

/**
 * Tiền đã tiêu trong cửa sổ này — ước lượng, và phải TRÔNG như ước lượng.
 *
 * `≈` là mặc định: con số là bảng giá API nhân với token đọc từ transcript, trong khi
 * tài khoản trả theo gói (xem `collect/usage.js`). `≥` thay chỗ khi cửa sổ mở trước lượt
 * gọi sớm nhất còn trên đĩa — lúc đó tổng chắc chắn THIẾU, và một dấu `≈` ở đó là nói dối
 * theo đúng cái hướng người đọc không kiểm được.
 *
 * Cách viết số trùng `usd()` ở `views/shared.js`, và đó là hai dòng CHÉP có chủ ý: hàm kia
 * ở tầng view, còn `lib/` thì không được biết gì về `views/` — nhập lên là đảo chiều phụ
 * thuộc để tiết kiệm hai dòng.
 */
/** Token rút gọn — chép `tok()` ở `views/shared.js`, cùng lý do chép như `spentText`. */
function tokShort(n) {
  const v = Math.round(n);
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return String(v);
}

export function spentText(w) {
  const s = w?.spent;
  if (!s || !Number.isFinite(s.cost) || s.cost <= 0) return '';
  const money = s.cost >= 100 ? `$${Math.round(s.cost).toLocaleString('en-US')}` : `$${s.cost.toFixed(2)}`;
  return `${s.partial ? '≥' : '≈'}${money}`;
}

/**
 * THANG BỎ PHÍ — bốn băng, và chúng nằm trên một trục liên tục có dấu.
 *
 * Đại lượng được chấm là `bỏ phí = 100 − dự phóng`, và nó ÂM ĐƯỢC: nhịp đòi 112% thì
 * "bỏ phí −12%", tức là đòi nhiều hơn cả cửa sổ có. Chấm theo đúng một trục như vậy là
 * lý do bốn băng đọc được thành một câu duy nhất — *càng về phải càng tiêu được nhiều
 * thứ đã trả tiền*:
 *
 *   bỏ phí ≥ 50%     `cold`  đỏ      quá nửa hạn mức sẽ mất trắng
 *   10% ≤ … < 50%    `slack` vàng    còn một mảng đáng kể không kịp dùng
 *   −10% ≤ … < 10%   `full`  xanh lá hạ cánh quanh đúng 100% — đích
 *   < −10%           `over`  đỏ tía  nhịp đòi hơn cả cửa sổ có — dùng hết mức
 *
 * Băng `full` rộng 20 điểm về cả hai phía vì phép ngoại suy này là một đường thẳng kẻ từ
 * đầu cửa sổ, còn nhịp thật thì giật cục: đòi nó hạ cánh đúng 100,0 rồi mới chịu gọi là
 * "đủ" thì mọi cửa sổ đều bị chấm trượt vì một chỗ lệch mà chính phép đo không phân
 * giải nổi.
 *
 * Bản trước chấm theo "có cạn trước reset hay không" và tô ĐỎ ca cạn sớm. Nó trả lời một
 * câu khác: *sẽ ngồi không bao lâu*. Câu ấy vẫn đáng hỏi — nhưng nó là chi phí THỜI GIAN,
 * còn kênh màu ở đây đã dành trọn cho chi phí TIỀN. Trộn hai đại lượng vào một kênh thì
 * cùng một sắc đỏ vừa có nghĩa "mất tiền" vừa có nghĩa "mất buổi chiều", và không nghĩa
 * nào còn đọc được. Phần ngồi không giờ nằm ở `idleMsOf` và chỉ ra chữ.
 */
const ON_TARGET = 10;
const COLD_AT = 50;

/**
 * Ngồi không bao lâu sau khi cạn — chi phí THỜI GIAN của việc chạm trần sớm.
 *
 * Trả `0` khi khoảng ấy chưa đủ dài để đáng gọi tên, nên chỗ gọi chỉ cần kiểm tra một
 * giá trị thay vì tự dựng lại ngưỡng.
 *
 * Ngưỡng phải TỈ LỆ với cửa sổ, vì hai cửa sổ lệch nhau 33 lần chiều dài: ba giờ ngồi
 * không là mất trắng hơn nửa khung 5 giờ, nhưng chỉ là 1,8% của khung tuần — nhỏ hơn cả
 * sai số của phép ngoại suy đang tính ra nó. `max` mới đúng chiều: phần trăm cầm trịch ở
 * khung dài, sàn cầm trịch ở khung ngắn. 6% ra ~10 giờ cho khung tuần (một ngày làm việc
 * bị chặn) và ~18 phút cho khung 5 giờ, nên sàn 20 phút đỡ nốt khung ngắn.
 */
const STUCK_FRAC = 0.06;
const STUCK_FLOOR_MS = 20 * 60_000;

export function idleMsOf(w) {
  const f = w?.forecast;
  if (!f?.known || f.exhaustInMs == null || w.expired) return 0;
  const ms = f.leftMs - f.exhaustInMs;
  return ms > Math.max(w.windowMs * STUCK_FRAC, STUCK_FLOOR_MS) ? ms : 0;
}

/**
 * Kết cục của một cửa sổ — một băng của thang bỏ phí, cộng hai trạng thái KHÔNG nằm
 * trên thang ấy: `unknown` (chưa đọc được nhịp) và `rolled` (số thuộc chu kỳ cũ).
 */
export function verdictOf(w) {
  if (!w) return 'unknown';
  if (w.expired) return 'rolled';
  const f = w.forecast;
  if (!f?.known) return 'unknown';
  const waste = 100 - f.projected;
  if (waste < -ON_TARGET) return 'over';
  if (waste < ON_TARGET) return 'full';
  return waste < COLD_AT ? 'slack' : 'cold';
}

/**
 * Kết cục → giọng. `mute` là giọng riêng cho "chưa biết": tô nó xanh thì một cửa sổ vừa
 * mở đọc thành một cửa sổ đã được chấm đạt.
 */
const TONE = { cold: 'crit', slack: 'warn', full: 'ok', over: 'cheer', unknown: 'mute', rolled: 'mute' };
export const toneOf = (w) => TONE[verdictOf(w)] ?? 'mute';

const TONE_COLOR = {
  crit: 'var(--crit)',
  warn: 'var(--warn)',
  ok: 'var(--ok)',
  cheer: 'var(--cheer)',
  mute: 'var(--later)',
};

/** Màu thanh = màu của kết cục (luật 2). */
export const barColor = (w) => TONE_COLOR[toneOf(w)] ?? TONE_COLOR.mute;

/** Phần trăm đọc được: to thì làm tròn, nhỏ thì giữ một số lẻ (0% và 0,4% khác nhau). */
export const pctText = (v) => `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}%`;

/**
 * Con số DẪN của một cửa sổ đang chạy — hoặc một dấu gạch khi không có con số nào.
 *
 * Cửa sổ đã qua mốc reset thì `used` không còn nói về cửa sổ đang mang cái nhãn ấy: nó là
 * số cuối của một chu kỳ ĐÃ ĐÓNG, còn chu kỳ đang chạy thì chưa ai đọc. In nó ra dưới
 * nhãn "5 giờ" là mời người đọc hiểu ngược, mà đây lại là con số to nhất khối.
 *
 * Gặp thật 3/8: bản đọc kẹt ở 17:08 vì token hết hạn, tới 23:20 vẫn còn nguyên `used: 6`
 * — trong 6,2 giờ ấy đã trôi qua **hơn một** cửa sổ 5 giờ trọn vẹn, nên 6% không phải số
 * của chu kỳ trước mà của một chu kỳ nào đó xa hơn nữa. Không có cách nào đọc ra điều đó
 * từ chữ "6%", nên chỗ này phải là dấu gạch.
 *
 * KHÔNG dùng ở màn Nhìn lại: ở đó mỗi hàng CỐ Ý nói về một chu kỳ đã đóng, và số cuối
 * của nó chính là nội dung của hàng.
 */
export const usedText = (w) => (w?.expired || w?.used == null ? '—' : pctText(w.used));

/**
 * Vì sao số bị cũ, nói theo đúng tầng đã tụt xuống — xem `collect/quota.js`. Ở đây chứ
 * không ở `views/usage.js` (chỗ nó ra đời) vì popover cũng phải nói được câu này: một
 * bản đọc kẹt 6 giờ mà cửa sổ nhỏ nhất chỉ dài 5 giờ thì mọi con số trên màn đều hỏng,
 * và đó đúng là lúc màn hình không được im lặng.
 */
const DEGRADED = {
  'no-auth': 'quota.noAuth',
  'token-expired': 'quota.tokenExpired',
  http: 'quota.httpFail',
  timeout: 'quota.offline',
  network: 'quota.offline',
};
export const degradedKey = (q, fallback = 'quota.offline') => (q?.degraded ? (DEGRADED[q.degraded] ?? fallback) : null);

/** "đọc lúc 17:08 · 6 giờ trước" — tuổi của chính BẢN ĐỌC, không phải tuổi lượt quét. */
export function readAtText(q) {
  if (q?.at == null) return '';
  return t(q.ageMs < JUST_NOW_MS ? 'quota.atFresh' : 'quota.at', { time: clock(q.at), age: ago(q.ageMs) });
}

/**
 * Nhịp tiêu, nói theo đơn vị hợp với cửa sổ: %/giờ cho khung 5 giờ, %/ngày cho khung
 * tuần. Khung tuần mà nói %/giờ thì ra "0,2%" — đúng số, nhưng không ai ước lượng
 * được gì từ nó.
 */
export function paceText(w) {
  const f = w?.forecast;
  if (!f?.known) return '';
  return w.windowMs > 24 * 3600_000
    ? t('qf.perDay', { v: pctText(f.perHour * 24) })
    : t('qf.perHour', { v: pctText(f.perHour) });
}

/** Dưới ngần này điểm phần trăm thì coi như đang đứng đúng mốc đều. */
const ON_PACE = 2;

/**
 * Lệch bao nhiêu so với mốc đều — chính là khoảng từ mép mảng đặc tới vạch dọc.
 *
 * Cố ý cụt ("chậm 21%", không phải "chậm hơn mốc đều 21%"): nó chỉ xuất hiện ngay sau
 * chữ "mốc đều 47%", nên nhắc lại chủ ngữ là bắt đọc hai lần một chuyện.
 */
export function paceGapText(w) {
  if (!w || w.expired || w.elapsedFrac == null) return '';
  const gap = w.used - w.elapsedFrac * 100;
  if (Math.abs(gap) < ON_PACE) return t('qf.onPace');
  return gap < 0 ? t('qf.behind', { gap: pctText(-gap) }) : t('qf.ahead', { gap: pctText(gap) });
}

/** Phần hạn mức nhịp này sẽ không kịp dùng. `0` khi sẽ chạm trần — không bỏ phí âm. */
export const wasteOf = (w) => (w?.forecast?.known ? Math.max(0, 100 - w.forecast.projected) : 0);

/** Nhịp này đòi nhiều hơn cả cửa sổ có. Trên trần thì "dự phóng" không còn là một MỨC. */
export const overCap = (w) => !!w?.forecast?.known && w.forecast.projected > 100;

/**
 * Dự phóng, viết ra chữ.
 *
 * Trên 100% thì con số phải đi kèm chữ "quá trần", vì đứng trơ một mình nó đọc ra nghĩa
 * ngược: "104%" trông như một mức sẽ đạt tới, trong khi cửa sổ chỉ có 100% để đạt —
 * điều nó thật sự nói là nhịp này ĐÒI nhiều hơn số có, nên sẽ cụt giữa chừng.
 */
export const projectedText = (w) =>
  !w?.forecast?.known ? '—' : overCap(w) ? t('qf.overCap', { p: pctText(w.forecast.projected) }) : pctText(w.forecast.projected);

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Tên KỲ HẠN của cửa sổ — "tuần này", "tháng này", "phiên 5h này".
 *
 * Mọi câu dự phóng phải nói ra tới KHI NÀO. Bản trước viết "nhịp này chỉ tới 52%", và
 * câu đó thiếu đúng cái làm nó dùng được: 52% *lúc nào*? Nhãn bên cạnh có ghi "5 giờ"
 * hay "7 ngày", nhưng đó là tên của cửa sổ chứ không phải một mốc, nên người đọc vẫn
 * phải tự ghép — mà phép ghép ấy là toàn bộ nội dung của con số.
 *
 * Suy từ `windowMs` chứ không từ khoá của hàng: cùng một hàm này chấm cả ba nguồn, mà
 * Cursor đo theo tháng dương lịch còn Antigravity có hai cửa sổ mỗi hồ. Khoảng nào
 * không rơi vào một kỳ hạn quen thuộc thì gọi trung tính là "cửa sổ này" — bịa ra
 * "tuần này" cho một cửa sổ hai ngày thì con số đọc ra một mốc không tồn tại.
 */
export function periodText(w) {
  const ms = w?.windowMs;
  if (!ms) return t('qf.pdWindow');
  if (ms < DAY_MS) return t('qf.pdShort', { h: Math.max(1, Math.round(ms / HOUR_MS)) });
  if (ms >= 5 * DAY_MS && ms <= 10 * DAY_MS) return t('qf.pdWeek');
  if (ms >= 25 * DAY_MS && ms <= 45 * DAY_MS) return t('qf.pdMonth');
  return t('qf.pdWindow');
}

/**
 * Câu dự báo: một dòng, tự nói ra cả trường hợp không đoán được.
 *
 * Băng `over` là băng duy nhất cần tới HAI câu, vì ở đó có một đại lượng thứ hai mà màu
 * không chở được: cạn trước reset một tiếng và cạn trước reset ba ngày đều là `over`,
 * đều đáng khen ở kênh tiền, nhưng ca sau còn kèm ba ngày ngồi không. Câu là chỗ duy
 * nhất nói ra được chuyện đó, nên nó chỉ nói khi khoảng ngồi không đủ dài (`idleMsOf`).
 */
export function forecastText(w) {
  const f = w?.forecast;
  if (!f) return '';
  if (!f.known) return t(`qf.${f.reason}`);
  const v = verdictOf(w);
  const at = { period: periodText(w), p: pctText(f.projected) };
  if (v === 'over') {
    // Ngoại suy vượt trần mà không có mốc cạn thì mốc ấy trùng đúng mốc reset
    // (xem `collect/quota.js`) — không có gì để đếm ngược, nên câu nói bằng mức.
    if (f.exhaustInMs == null) return t('qf.landsNear', at);
    const idle = idleMsOf(w);
    if (f.exhaustInMs < 60_000) return t('qf.outNow', { stuck: ago(f.leftMs - f.exhaustInMs) });
    return idle ? t('qf.overIdle', { in: ago(f.exhaustInMs), stuck: ago(idle) }) : t('qf.over', { in: ago(f.exhaustInMs) });
  }
  if (v === 'full') return f.exhaustInMs != null ? t('qf.landsFull') : t('qf.landsNear', at);
  // Hai băng bỏ phí dùng CHUNG một câu. Băng đỏ từng nói thêm "quá nửa hạn mức mất
  // trắng", nhưng đó đúng là thứ màu đã nói — và khối Cursor có ba dòng cùng băng, nên
  // mệnh đề ấy in ra ba lần cạnh nhau, thành một bức tường chữ đỏ nói đúng một câu.
  return t('qf.slack', { ...at, w: pctText(100 - f.projected) });
}

/**
 * Câu của THẺ hạn mức — bản rút của `forecastText`.
 *
 * Thẻ vẽ thanh CÓ NHÃN, nên mọi thứ nhãn đã nói thì câu không được nói lại: mốc cạn nằm
 * trong mảng gạch chéo rồi, phần bỏ phí nằm ở đuôi thanh rồi. Còn đúng một mẩu không có
 * mảng nào để vẽ — **sẽ ngồi không bao lâu** — nên chỉ mẩu đó thành câu, và chỉ khi nó
 * đủ dài để đáng gọi tên. Chỗ nào vẽ thanh KHÔNG nhãn (dải quản gia, hai khối phụ) thì
 * ngược lại: ở đó `forecastText` đầy đủ là thứ duy nhất chở nổi mấy con số ấy.
 */
export function cardText(w) {
  const f = w?.forecast;
  if (!f?.known) return forecastText(w);
  const idle = idleMsOf(w);
  if (!idle) return '';
  return f.exhaustInMs < 60_000 ? t('qf.outNow', { stuck: ago(idle) }) : t('qf.idleTail', { stuck: ago(idle) });
}

/**
 * Câu của mấy DÒNG VĂN XUÔI về nguồn ngoài (Cursor, Antigravity) — bản rút thứ hai của
 * `forecastText`, anh em với `cardText`.
 *
 * Khác `cardText` ở chỗ khác hẳn: thẻ có cái thanh đứng ngay trên câu, nên câu chỉ được
 * nói phần thanh không vẽ. Dòng văn xuôi thì KHÔNG có thanh nào cả — nó là toàn bộ thứ
 * người đọc nhận được, nên nó phải tự đủ.
 *
 * Cái nó cắt là con số DỰ PHÓNG ở băng bỏ phí. `forecastText` in cả hai vế — "dự phóng
 * tuần này 69% — bỏ phí 31%" — và đúng ở chỗ nó dùng: cạnh một cái thanh, 69% là mốc mũi
 * tên đang chỉ, còn 31% là mảng đuôi. Đứng một mình trong câu thì hai vế ấy là một sự
 * thật nói hai lần (69 + 31 = 100), mà vế đáng nói là vế mất tiền.
 *
 * Chân trời "tuần này" ở lại (CLAUDE.md mục 2): 31% là số ngoại suy, mà một số ngoại suy
 * không mang cửa sổ của nó thì người đọc phải tự ghép — ở đây không có nhãn nào cạnh bên
 * để ghép vào.
 */
export function proseText(w) {
  const f = w?.forecast;
  const v = verdictOf(w);
  if (!f?.known || (v !== 'slack' && v !== 'cold')) return forecastText(w);
  return t('qf.slackShort', { period: periodText(w), w: pctText(100 - f.projected) });
}

/**
 * Bảng số thu nhỏ cho tooltip — bản viết ra chữ của đúng những gì cái thanh đang vẽ.
 *
 * Thanh nói bằng ba mảng màu, một vạch và hai con số cụt; ai đọc được nó thì không cần
 * tooltip, ai chưa đọc được thì cần đúng một chỗ trải nó ra. Nên tooltip đi theo THỨ TỰ
 * của thanh — đã tiêu → mốc đều → nhịp → dự phóng → bỏ phí — chứ không phải một
 * tập tin tức khác được sắp lại theo thứ tự khác.
 *
 * Nhãn của các hàng dùng LẠI nhãn cột của bảng số dưới màn (`quota.cUsed`, `quota.cPace`…).
 * Cùng một đại lượng mà tooltip gọi một tên, bảng gọi tên khác thì người đọc phải tự
 * ghép hai bảng từ vựng — mà cả hai đều đang nói về đúng một con số.
 *
 * Thêm hai thứ cái thanh không vẽ được: nhịp tiêu (%/giờ, %/ngày) và mốc reset tuyệt đối.
 *
 * `entry.extra` là chỗ call site chêm hàng của riêng nguồn nó — cặp đô của Cursor, phần
 * còn lại của Antigravity. Hai khối ấy giờ vẽ dạng rút gọn (một dòng mỗi cửa sổ), nên
 * tooltip là chỗ duy nhất còn chứa được mấy con số này.
 */
export function forecastTip(entry) {
  const { w, label } = entry;
  const rows = [[t('quota.cUsed'), pctText(w.used)]];
  if (w.elapsedFrac != null && !w.expired) {
    rows.push([t('qf.rowAvg'), `${pctText(w.elapsedFrac * 100)} · ${paceGapText(w)}`]);
  }
  const f = w.forecast;
  let note = '';
  if (f?.known) {
    rows.push([t('quota.cPace'), paceText(w)], [t('quota.cProjected'), projectedText(w), overCap(w) ? 'warn' : '']);
    const waste = wasteOf(w);
    // Hai kết cục loại trừ nhau: hoặc thừa hạn mức lúc reset, hoặc chạm trần trước đó.
    // Vế thứ hai phải nói ra CẢ KHI không đủ để báo động — thẻ hạ cánh đúng đích thì im
    // lặng, nên "dự phóng 101%" đứng trơ một mình mà không có gì giải thích cái 1%.
    if (waste > 0) rows.push([t('quota.cWaste'), pctText(waste), 'warn']);
    else if (f.exhaustInMs != null) {
      // Chạm trần nghĩa gì thì tuỳ nguồn, nên nhãn hàng này do call site đặt. Với Claude
      // là "ngồi không" — hết quota là bị chặn, không còn gì làm ngoài chờ. Với Cursor thì
      // không: hết phần đã trả rồi vẫn chạy tiếp, chỉ là sang tiền khác (xem `views/tools.js`).
      // Hàng này KHÔNG tô theo thang bỏ phí — nó đo thời gian, không đo tiền (xem
      // `idleMsOf`). Nó chỉ sáng lên khi khoảng ngồi không đã đủ dài để đáng gọi tên,
      // và dùng sắc cảnh báo chứ không sắc chặn: mất một buổi chiều không bằng mất
      // nửa hạn mức, mà `crit` ở khối này đã có nghĩa sẵn là mất nửa hạn mức.
      rows.push([t(entry.overLabel ?? 'qf.rowIdle'), ago(f.leftMs - f.exhaustInMs), idleMsOf(w) ? 'warn' : '']);
    }
  } else if (f) note = forecastText(w);
  for (const r of entry.extra ?? []) rows.push(r);
  // Tiền và token của CỬA SỔ NÀY — chỉ khối Claude có (`w.spent` do `state.js` gắn vào).
  // Cursor tự gửi tiền thật của nó, còn hội thoại Antigravity không tiêu token Claude nào,
  // nên hai khối kia không bao giờ có hàng này và cũng không được có.
  //
  // Đứng SAU nhóm dự báo và TRƯỚC mốc reset: nhóm trên là chuyện sẽ tới, hai hàng này là
  // chuyện đã xảy ra, còn mốc reset thì luôn là dòng chốt.
  const spent = spentText(w);
  if (spent) {
    rows.push([t('quota.cSpent'), spent]);
    if (w.spent.out) rows.push([t('quota.cSpentOut'), tokShort(w.spent.out)]);
  }
  rows.push([t('quota.cReset'), stamp(w.resetsAt)]);
  return tipOf({ head: label, rows, note });
}

/**
 * Mọi cửa sổ, đã gắn nhãn. Thứ tự cố định: 5 giờ → 7 ngày → từng model.
 * `short` là nhãn cho chỗ hẹp (dải quản gia), `label` cho chỗ rộng (màn Token).
 */
export function windowsOf(q) {
  if (!q?.ok) return [];
  const rows = [];
  if (q.fiveHour) rows.push({ key: 'five', label: t('quota.fiveHour'), short: t('quota.fiveHourShort'), w: q.fiveHour });
  if (q.sevenDay) rows.push({ key: 'seven', label: t('quota.sevenDay'), short: t('quota.sevenDayShort'), w: q.sevenDay });
  for (const [i, w] of (q.scoped ?? []).entries()) {
    rows.push({ key: `scoped-${i}`, label: t('quota.scoped', { model: w.model || '?' }), short: w.model || '?', w });
  }
  return rows.map((r) => ({ ...r, verdict: verdictOf(r.w), tone: toneOf(r.w) }));
}

/**
 * Thứ tự "đáng nói tới trước".
 *
 * KHÔNG phải thứ tự tốt–xấu của thang bỏ phí: `cheer` là băng đẹp nhất mà vẫn đứng
 * trước `ok`, vì nó là băng duy nhất còn kèm một việc làm được — đổi model rẻ hơn để
 * kéo dài cửa sổ. `ok` thì không có gì để nói ngoài "giữ nguyên", nên nó đứng cuối
 * đúng như mọi tin tốt không đòi hành động nào.
 */
const TONE_RANK = { crit: 0, warn: 1, cheer: 2, ok: 3, mute: 4 };

/**
 * Cửa sổ đáng đưa lên câu hạn mức của quản gia.
 *
 * Trong cùng một băng thì ưu tiên mốc cạn sớm nhất chứ không phải phần trăm cao nhất:
 * khung tuần đã tiêu 70% mà còn sáu ngày thì thong thả hơn hẳn khung 5 giờ ở 55% đang
 * tiêu gấp ba lần.
 */
export function bindingOf(q) {
  const live = windowsOf(q).filter((r) => !r.w.expired);
  if (!live.length) return null;
  return live.slice().sort((a, b) => {
    const ea = a.w.forecast?.exhaustInMs ?? Infinity;
    const eb = b.w.forecast?.exhaustInMs ?? Infinity;
    // Phép so cuối là DỰ PHÓNG tăng dần, tức bỏ phí giảm dần. Bản trước so `used` giảm
    // dần — đúng hồi màu còn đo độ đầy, sai hẳn từ lúc nó đo bỏ phí: hai cửa sổ cùng
    // băng vàng, cái tiêu nhiều hơn lại là cái bỏ phí ÍT hơn, nên nó luôn cướp chỗ của
    // cái đáng nhắc. Đo được trên máy này: khung Fable bỏ phí 29% che khung 5 giờ bỏ
    // phí 46%.
    const pa = a.w.forecast?.projected ?? Infinity;
    const pb = b.w.forecast?.projected ?? Infinity;
    return TONE_RANK[a.tone] - TONE_RANK[b.tone] || ea - eb || pa - pb;
  })[0];
}

/**
 * Dải hạn mức của quản gia.
 *
 * Chỉ hai khung chung được chỗ cố định; hạn mức tuần theo model chen vào KHI VÀ CHỈ KHI
 * nó có chuyện để nói — sắp chặn, hoặc đang bỏ phí. Cho cả năm dòng vào đây thì khối
 * quan trọng nhất trang biến thành một bảng số, mà bảng số đầy đủ thì màn Token đã có rồi.
 */
export const stripRows = (rows) =>
  rows.filter((r) => r.key === 'five' || r.key === 'seven' || (r.tone !== 'ok' && r.tone !== 'mute'));

export function quotaStrip(rows) {
  if (!rows.length) return '';
  return html`<div class="qs-h">${t('quota.stripTitle')}</div>
    ${rows.map(
      (r) => html`<div
        class="qs-row"
        tabindex="0"
        data-tip="${forecastTip(r)}"
        data-tip-tone="${r.tone}"
        aria-label="${flatTip(forecastTip(r))}"
      >
        <div class="qs-top">
          <span class="qs-k" title="${r.label}">${r.short}</span>
          <b class="qs-v" style="color:${barColor(r.w)}">${usedText(r.w)}</b>
        </div>
        ${quotaBar(r.w)}
        <!-- Mốc reset ra CHỮ TRÊN MÀN, không chỉ nằm trong tooltip: câu hỏi "còn bao lâu
             để tiêu dần" không trả lời được nếu phải rê chuột mới thấy, mà cả dải này tồn
             tại để liếc một cái là xong. Dòng riêng, không nhập vào câu dự báo — dòng kia
             mang màu của thang bỏ phí, còn đây là thời gian, không được nhuộm theo. -->
        <div class="qs-when">${resetLabel(r.w)}</div>
        <div class="qs-f ${r.tone}">${forecastText(r.w)}</div>
      </div>`,
    )}`;
}

/** Vạch mốc đều sát mép thì chữ chú thích phải nép vào, không thì tràn khỏi thẻ. */
const EDGE = 24;

/**
 * Nhãn trong mảng nép về bên nào để vạch mốc đều khỏi cắt ngang chữ.
 *
 * Vạch dọc đi đâu là do đồng hồ, nhãn nằm giữa mảng là do hình học — sớm muộn gì hai
 * thứ cũng chồng lên nhau, và lúc đó vạch xẻ đôi một chữ cái. Không giấu vạch đi được
 * (đúng lúc nó chồng lên nhãn cũng là lúc nó đang nói điều đáng chú ý nhất), nên nhãn
 * là bên phải tránh: dạt về NỬA RỘNG HƠN, tức là cách vạch ít nhất nửa chiều dài mảng.
 */
const dodge = (from, to, at) => {
  if (at == null || at <= from || at >= to) return '';
  return at - from >= to - at ? 'l' : 'r';
};

/**
 * Thanh hạn mức. Ba mảng + một vạch, mỗi thứ trả lời đúng một câu:
 *
 * - **Mảng đặc** — đã tiêu bao nhiêu. Sự thật đã đo.
 * - **Mảng gạch chéo** nối ngay sau — nhịp này còn tiêu thêm tới đâu. Đây là phần DUY
 *   NHẤT do dashboard đoán ra, nên nó phải trông khác hẳn: mờ hơn, có vân, và chỉ đổi
 *   sang vân cảnh báo khi việc chạm trần sẽ khiến ngồi không thật sự.
 * - **Mảng cuối** — phần nhịp này sẽ không kịp dùng. Trước đây nó là rãnh trống, và
 *   rãnh trống đọc thành "chỗ còn dư" — tức là đúng cái nghĩa ngược. Giờ nó được tô,
 *   nhạt nhưng có màu, vì nó không trống: nó là phần đã trả tiền và sắp mất.
 * - **Vạch dọc** — mốc đều, chỗ phải đứng nếu tiêu đều theo đồng hồ. Nó cắt ngang thanh
 *   chứ không nấp ở dưới, và vì chỉ cần biết mốc reset là tính được, nó vẫn đứng đó cả
 *   lúc chưa đoán nổi nhịp — đúng lúc cần một chỗ bấu víu nhất.
 *
 * ## Ba mảng đó nằm CHỒNG lên nhau, không nối đuôi nhau
 *
 * Bản trước xếp chúng nối tiếp: mảng đặc `0 → đã tiêu`, mảng gạch `đã tiêu → dự phóng`,
 * mảng nhạt `dự phóng → 100`. Đúng số nhưng xấu ở đúng chỗ nối: mảng đặc bo tròn hai đầu
 * (nó thừa hưởng bán kính của rãnh), còn mảng gạch bắt đầu bằng một cạnh thẳng đứng — nên
 * chỗ tiếp giáp là một cái mũi tròn cắm vào một bức tường phẳng, chừa lại hai vệt trăng
 * khuyết màu nền ở trên và dưới.
 *
 * Giờ chúng là ba lớp chồng, vẽ từ sau ra trước, lớp nào cũng bắt đầu từ 0:
 *
 *   nền rãnh  `0 → 100`        — tô sắc "bỏ phí" khi có bỏ phí
 *   `.qb-pred` `0 → dự phóng`  — vân, bo tròn
 *   `.qb-fill` `0 → đã tiêu`   — đặc, bo tròn
 *
 * Mỗi lớp là một viên thuốc trọn vẹn nằm đè lên lớp rộng hơn, nên mọi mối nối đều là một
 * đầu bo tròn nằm trên một mặt phẳng — không còn cạnh nào phải khớp với cạnh nào.
 *
 * `.qb-ghost` và `.qb-waste` vẫn còn, nhưng CHỈ để chở nhãn: chúng trong suốt, giữ đúng
 * hình học của mảng mình nói về (`đã tiêu → dự phóng` và `dự phóng → 100`) để chữ nằm
 * giữa mảng và để `@container` đo đúng bề rộng thật.
 *
 * `labels` viết con số vào THẲNG trong mảng nó nói về. Chỗ rộng thì luôn nên làm vậy:
 * ba dòng chữ xếp dưới thanh bắt mắt đi đi về về giữa chữ và hình để ghép "45%" với
 * mảng nào, còn số nằm trong mảng thì phép ghép ấy khỏi phải làm. Dải quản gia hẹp
 * 214px nên vẫn dùng bản không nhãn — ở đó chữ sẽ chồng lên nhau.
 *
 * `est` chọn chỗ đứng cho nhãn dự phóng — `mid` giữa mảng gạch (mặc định, web dùng),
 * `end` sát mép phải mảng gạch, `below` một dòng dưới thanh căn phải, `tail` mép phải cả
 * rãnh. Chỉ `mid` và `end` giữ được luật "số nằm trong đúng mảng nó nói về"; hai bản kia
 * đổi luật ấy lấy chỗ, nên đang để bàn chỉnh popover chọn chứ chưa chốt.
 *
 * `pace: false` bỏ vạch mốc đều và dòng chú thích của nó. Chỉ popover thanh menu dùng:
 * ở đó mỗi cửa sổ chỉ được chừng 40px, mà vạch mốc đều muốn có nghĩa thì phải kéo theo
 * dòng chữ "mốc đều 55%" ở dưới — 15px cho một mốc tham chiếu, trong khi thứ nó dùng để
 * so (đã tiêu, dự phóng) đều đã có nhãn nằm ngay trong thân thanh. Trên web thì còn chỗ,
 * nên ở đó vạch vẫn đứng.
 *
 * **Mảng đặc không mang nhãn**, dù nó là mảng quan trọng nhất: con số của nó đã là con
 * số to nhất thẻ, ngay phía trên. In lại lần nữa vào trong mảng thì cùng một trị xuất
 * hiện hai lần cách nhau 8px — và hai chỗ cùng nói một câu thì không chỗ nào được đọc.
 *
 * Chuyện mảng nào đủ rộng để chứa chữ do CSS quyết (`@container` trong `styles.css`),
 * không phải một ngưỡng phần trăm viết ở đây: ràng buộc thật là PIXEL, mà cùng một
 * "20% bề rộng" ra 40px ở thẻ hẹp và 90px ở màn rộng.
 */
export function quotaBar(w, { tall = false, labels = false, pace = true, est = 'mid' } = {}) {
  // Cửa sổ đã qua mốc reset → rãnh TRỐNG, và không một mảng nào được vẽ. Cùng lý do với
  // `usedText`: `used` khi ấy là số cuối của một chu kỳ đã đóng, nên vẽ nó dưới nhãn của
  // cửa sổ đang chạy là khẳng định một điều không ai đo. Rãnh trống đọc ra đúng thứ đang
  // có — chưa biết gì — và nó khớp với dấu gạch `usedText` in ở ngay trên.
  //
  // Bỏ luôn `forecast` chứ không chỉ bỏ `used`: `collect/quota.js` đã trả `known: false`
  // cho ca này rồi, nhưng cái thanh không được phụ thuộc vào việc tầng thu thập nhớ làm
  // thế. Một dự phóng cho một cửa sổ đã đóng thì không có nghĩa nào cả, bất kể ai tính ra.
  const rolled = Boolean(w.expired);
  const used = rolled ? 0 : Math.max(0, Math.min(100, w.used));
  const f = rolled ? null : w.forecast;
  const projected = f?.known ? Math.min(100, f.projected) : used;
  const ghost = Math.max(0, projected - used);
  // KHÔNG có dự phóng thì KHÔNG có mảng bỏ phí. Bỏ phí là một lời tiên đoán — "cứ nhịp
  // này thì tới lúc reset còn ngần này chưa tiêu" — nên nó chỉ tồn tại khi có nhịp để
  // suy. Bản trước để `projected` rơi về `used`, và phép trừ `100 - used` vẫn ra một con
  // số trông hợp lý ở mọi ca, nên cái thanh khẳng định thay cho một phép tính chưa từng
  // chạy. Ba ca gặp thật, cả ba đều nói ngược:
  //   `early`   cửa sổ vừa mở, 8,9% → "bỏ phí 91%" nằm ngay cạnh chính câu
  //             "cửa sổ vừa mở, chưa đủ để đọc nhịp". Thanh cãi lại câu bên cạnh nó.
  //   `rolled`  cửa sổ đã sang chu kỳ mới → 6% là số CUỐI của cửa sổ trước, còn cửa sổ
  //             đang chạy thì chưa ai đọc. Vẽ 94% bỏ phí cho nó là bịa.
  //   `unknown` không có mốc reset → không biết còn bao lâu, mà "bỏ phí" đo đúng cái đó.
  // Bỏ mảng này đi thì thanh về đúng thứ nó thật sự biết: mỗi mảng đặc, sắc câm (`mute`
  // theo `verdictOf`), và câu dưới thanh nói vì sao chưa đoán được.
  const waste = f?.known ? Math.max(0, 100 - projected) : 0;
  // `at` là mốc đều. Tắt nó là tắt một lượt cả ba thứ bám vào nó — vạch dọc, dòng chú
  // thích dưới thanh, và phép nép nhãn `dodge` (không còn vạch thì không còn gì để né).
  const at = !pace || w.expired || w.elapsedFrac == null ? null : w.elapsedFrac * 100;
  // Đụng trần TRƯỚC mốc reset — điều kiện để nhãn mảng gạch nói "bao giờ cạn" thay vì
  // "tới mức nào". Đòi luôn `exhaustInMs` chứ không chỉ `projected > 100`: hạ cánh đúng
  // 100,0 thì mốc cạn trùng mốc reset, `collect/quota.js` trả `null`, và không có gì để đếm.
  const hits = f?.known && f.projected > 100 && f.exhaustInMs != null;

  // Nhãn dự phóng: cùng một chuỗi, bốn chỗ đứng. Chỗ đứng là chuyện bố cục nên nó nằm ở
  // đây; còn NÓI GÌ thì vẫn chỉ một nguồn, khỏi lệch giữa các bản.
  const estText = ghost > 0 && labels ? (hits ? t('qf.hitsIn', { in: ago(f.exhaustInMs) }) : `→${pctText(f.projected)}`) : '';
  const inGhost = estText && (est === 'mid' || est === 'end');

  return html`<span
    class="qbar est-${est} ${tall ? 'tall' : ''} ${labels && (at != null || (estText && est === 'below')) ? 'lab' : ''} ${waste > 0 ? 'wasting' : ''}"
    style="--c:${barColor(w)}"
  >
    <span class="qb-track">
      <!-- Lớp dự phóng chạy từ 0, không từ mép mảng đặc: nó nằm DƯỚI mảng đặc nên đoạn
           bị che không tốn gì, đổi lại mối nối thành một đầu bo tròn trên nền phẳng. -->
      <!-- Vân đi theo sắc của thanh, KHÔNG có bản đỏ riêng cho ca chạm trần: chạm trần
           giờ là đích chứ không phải sự cố, nên tô nó khác màu thân thanh là để hai mảng
           của cùng một cửa sổ cãi nhau. Việc "bao giờ đụng tường" đã có nhãn riêng nằm
           ngay trong chính mảng này (xem qf.hitsIn ở khối dưới).
           (Không dùng backtick trong comment ở đây: cả khối nằm trong một template
           literal, nên một backtick lẻ đóng luôn chuỗi.) -->
      ${ghost > 0 ? html`<i class="qb-pred" style="width:${projected}%"></i>` : ''}
      <i class="qb-fill" style="width:${used}%"></i>
      ${ghost > 0
        ? html`<i class="qb-ghost ${hits ? 'hits' : ''}" style="left:${used}%;width:${ghost}%"
            ><!-- Nhãn nói về MÉP PHẢI của mảng gạch — chỗ nhịp này dừng lại.
                 Dưới trần thì mép ấy là một mức, nên nhãn là mức: "→46%".
                 Chạm trần thì mép ấy là cái tường, và "→104%" là câu vô nghĩa: thanh chỉ
                 dài tới 100 nên mũi tên chỉ vào một chỗ không phải chỗ nó ghi, mà 104%
                 cũng không phải thứ sẽ xảy ra — cái sẽ xảy ra là dừng ở 100. Nên ở đó
                 nhãn đổi sang câu hỏi còn lại duy nhất: BAO GIỜ đụng tường.
                 Trị thô 104% vẫn còn nguyên ở tooltip và bảng số, kèm chữ "quá trần". -->
            ${inGhost
              ? html`<b class="${est === 'end' ? 'r' : dodge(used, projected, at)}">${estText}</b>`
              : ''}</i
          >`
        : ''}
      ${waste > 0
        ? html`<i class="qb-waste" style="left:${projected}%;width:${waste}%"
            ><!-- Đuôi thanh mang CHỮ, không chỉ con số. "49%" đứng một mình cạnh một
                 mảng nhạt đọc thành "còn 49%" — đúng cái nghĩa ngược mà cả module này
                 dựng lên để chống. Hai bản cùng có mặt, container query chọn bản vừa
                 chỗ: phải là hai chuỗi rời chứ không phải một chuỗi bị cắt, vì tiếng
                 Việt đặt chữ trước số còn tiếng Anh đặt sau. -->
            ${labels
              ? html`<b class="${dodge(projected, 100, at)}"
                  ><em>${t('qf.wasteSeg', { w: pctText(waste) })}</em><span>${pctText(waste)}</span></b
                >`
              : ''}</i
          >`
        : ''}
      <!-- Bản đuôi thanh: nhãn rời khỏi mảng gạch, neo vào mép phải của RÃNH. Nó không
           còn nằm trong mảng nó nói về nữa, nên phải trả giá bằng chỗ của nhãn bỏ phí —
           xem khối est-tail trong styles.css. -->
      ${estText && est === 'tail' ? html`<b class="qb-tail">${estText}</b>` : ''}
    </span>
    ${at == null ? '' : html`<i class="qb-pace" style="left:${at.toFixed(2)}%"></i>`}
    ${at == null || !labels
      ? ''
      : html`<span class="qb-mark ${at < EDGE ? 'l' : at > 100 - EDGE ? 'r' : ''}" style="left:${at.toFixed(2)}%"
          >${t('qf.avgMark', { p: pctText(at) })}</span
        >`}
    ${estText && est === 'below' ? html`<span class="qb-est">${estText}</span>` : ''}
  </span>`;
}

/**
 * Cửa sổ giả để vẽ thanh mẫu trong phần chú thích.
 *
 * Đây phải là một cửa sổ CÓ THẬT VỀ MẶT LOGIC, không phải mấy con số bịa cho đẹp: nó đi
 * qua đúng `quotaBar` mà mọi thẻ đi qua, nên `verdictOf` sẽ chấm nó là `slack` và tô nó
 * màu cảnh báo — đúng như một cửa sổ thật có đuôi bỏ phí 28% sẽ bị tô. Ép nó sang một
 * màu trung tính "cho đỡ giật" là dạy sai ngay ở luật mà chính khối này đang dạy: màu
 * nói về kết cục. Nên nó giữ nguyên màu, và dải ba chấm bên dưới nói ra ba màu nghĩa gì.
 *
 * Chọn `slack` chứ không phải `full` vì mảng bỏ phí là khái niệm khó nhất ở đây — thanh
 * mẫu mà không có đuôi bỏ phí thì thứ cần giải thích nhất lại không có mặt để chỉ vào.
 */
const DEMO = {
  used: 34,
  elapsedFrac: 0.46,
  windowMs: 5 * 3600_000,
  expired: false,
  resetsAt: null,
  forecast: { known: true, projected: 72, perHour: 0, leftMs: 0, exhaustInMs: null },
};

/**
 * Ô mẫu = một LÁT của cái thanh thật.
 *
 * Không phải bốn ô màu vẽ tay trong CSS riêng: chúng dùng lại đúng `.qb-fill`,
 * `.qb-pred`, `.qbar.wasting`, `.qb-pace` — cùng sắc, cùng vân, cùng bo tròn. Vẽ tay thì
 * mỗi lần chỉnh vân hay đổi sắc lại để lại một bản chú thích mô tả một cái thanh không
 * còn tồn tại, mà chú thích sai còn tệ hơn không có chú thích.
 *
 * `--c` lấy từ chính `DEMO` chứ không viết cứng một sắc trong CSS: ô mẫu phải trùng màu
 * với thanh mẫu ngay phía trên nó, không thì cây cầu duy nhất nối dòng chữ với mảng trên
 * hình bị gãy — mà cây cầu ấy là toàn bộ lý do khối này tồn tại.
 */
const swatch = (kind) => html`<span class="qbar ql-sw ${kind === 'waste' ? 'wasting' : ''}" style="--c:${barColor(DEMO)}">
  <span class="qb-track">
    ${kind === 'fill' ? html`<i class="qb-fill" style="width:100%"></i>` : ''}
    ${kind === 'pred' ? html`<i class="qb-pred" style="width:100%"></i>` : ''}
  </span>
  ${kind === 'pace' ? html`<i class="qb-pace" style="left:50%"></i>` : ''}
</span>`;

/**
 * Chú thích "cách đọc thanh", vẽ bằng chính cái thanh.
 *
 * Bản trước là năm câu văn xuôi liền mạch. Từng câu đều đúng, nhưng đọc chúng đòi một
 * việc mà văn xuôi không giúp được: giữ trong đầu bốn cái tên — *mảng đặc*, *mảng gạch
 * chéo*, *mảng nhạt cuối*, *vạch dọc* — rồi tự đi tìm từng cái trên hình. Bốn phép ghép
 * ấy là toàn bộ chỗ khó, và chúng nằm ngoài trang giấy.
 *
 * Nên chú thích giờ mang hình theo: một thanh mẫu ở trên (đủ cả bốn dấu, có nhãn thật),
 * rồi mỗi dòng bắt đầu bằng đúng cái ô mà nó đang nói tới. Phép ghép thành ra đã làm sẵn.
 *
 * Chỉ còn ba thứ giữ dạng văn xuôi, vì chúng không có hình để chỉ: dự phóng là một phép
 * ngoại suy chứ không phải lời hứa, đỏ chỉ dành cho đúng một tình huống, và số `≈$` cạnh
 * phần trăm đếm trên một phạm vi khác hẳn phần trăm (xem `qlg.money`).
 */
export function quotaLegend() {
  const keys = [
    ['fill', t('quota.cUsed'), t('qlg.solid')],
    ['pred', t('qlg.hatchName'), t('qlg.hatch')],
    ['waste', t('quota.cWaste'), t('qlg.waste')],
    ['pace', t('qf.rowAvg'), t('qlg.mark')],
  ];
  // Thứ tự XẤU → TỐT, đúng chiều của thang bỏ phí trong `verdictOf`. Bản trước mở bằng
  // xanh lá rồi mới tới hai màu cảnh báo, tức là in ra một danh sách không có chiều nào
  // — mà cả điểm của bốn màu này là chúng NẰM TRÊN một trục.
  const tones = [
    ['crit', t('qlg.toneCrit')],
    ['warn', t('qlg.toneWarn')],
    ['ok', t('qlg.toneOk')],
    ['cheer', t('qlg.toneCheer')],
  ];
  return html`<div class="q-lgd">
    <p class="q-note q-lgd-goal">${raw(t('qlg.goal'))}</p>
    <div class="q-lgd-demo">
      <span class="q-lgd-cap">${t('qlg.sample')}</span>
      ${quotaBar(DEMO, { tall: true, labels: true })}
    </div>
    <dl class="q-lgd-keys">
      ${keys.map(([k, name, what]) => html`<dt>${swatch(k)}<b>${name}</b></dt>
        <dd>${raw(what)}</dd>`)}
    </dl>
    <div class="q-lgd-tones">
      <span class="q-lgd-tt">${t('qlg.toneTitle')}</span>
      ${tones.map(([tone, label]) => html`<span class="q-lgd-tn ${tone}"><i></i>${label}</span>`)}
    </div>
    <p class="q-note">${raw(t('qlg.caveat'))}</p>
    <p class="q-note">${raw(t('qlg.money'))}</p>
  </div>`;
}
