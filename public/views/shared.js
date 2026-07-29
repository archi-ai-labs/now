import { html, hueOf, ago, clock, JUST_NOW_MS } from '../lib/dom.js';
import { t } from '../lib/i18n.js';

/** Biểu tượng độ nóng — không đổi theo ngôn ngữ. Nhãn lấy từ `heatLabel()`. */
export const HEAT_ICON = { now: '◆', soon: '◈', later: '◇' };

export const heatLabel = (h) => t(`heat.${h}`);

export const healthLabel = (health) => t(`hstatus.${health}`);

const HP_COLOR = {
  fresh: 'var(--ok)',
  drifting: 'var(--warn)',
  stale: 'var(--crit)',
  broken: 'var(--crit)',
  unknown: 'var(--faint)',
};

export const hpColor = (health) => HP_COLOR[health] ?? 'var(--faint)';

/**
 * Độ toàn vẹn của một board, 0–100. Tuổi và độ lệch mỗi thứ ăn tối đa nửa thanh
 * vì chúng bắt hai kiểu hỏng khác nhau: board mới tinh sau 20 commit thì cũ, mà
 * board 0 commit để 10 ngày cũng cũ.
 */
export function integrity(p, thresholds) {
  if (p.parseError) return 0;
  if (p.git.unknownCommit) return 25;
  const age = Math.min(1, (p.ageDays ?? 0) / (thresholds?.staleDays ?? 7));
  const drift = Math.min(1, (p.git.driftCommits ?? 0) / (thresholds?.staleCommits ?? 15));
  return Math.max(0, Math.round(100 - age * 50 - drift * 50));
}

/** Thanh liền kiểu máu/XP. `variant` = '' | 'slim' | 'tall'. */
export const bar = (pct, color, variant = '') =>
  html`<span class="bar ${variant}" style="--b-c:${color}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>`;

export const heat = (h) => html`<span class="heat ${h}">${HEAT_ICON[h] ?? '·'} ${HEAT_ICON[h] ? heatLabel(h) : h}</span>`;

export const projectChip = (name) => html`<span class="chip" style="--h:${hueOf(name)}">${name}</span>`;

/**
 * Một câu chép được. Là `<button>` chứ không phải `<code>` vì bấm vào nó có
 * chuyện xảy ra — mà một thứ có chuyện xảy ra thì phải Tab tới được và Enter bấm
 * được. Dáng chữ mono trong khung mờ giữ nguyên qua class `.code`.
 *
 * `aria-label` nói cả việc lẫn nội dung: nhãn hiện ra thường là chữ rút gọn
 * ("chốt d-42", "mở Claude ở đây"), nên nghe mỗi nhãn thì không biết bấm xong
 * clipboard có gì.
 */
export const copyCode = (text, label) =>
  html`<button type="button" class="copy code" data-copy="${text}" aria-label="${t('common.copyAria', { text })}">${label ?? text}</button>`;

export const ulabel = (text) => html`<span class="ulabel">${text}</span>`;

/**
 * Nhãn của một khối hạn mức: tên NGUỒN in đậm, phần đuôi để nhạt.
 *
 * Ba khối đứng cạnh nhau và cả ba kết thúc bằng đúng một cụm — "hạn mức đã tiêu" — nên
 * thứ duy nhất phân biệt chúng là ba chữ đầu. Để cả dòng cùng một sắc thì mắt phải đọc
 * hết mới biết đang xem khối nào, mà ba khối ấy chính là ba câu trả lời khác nhau cho
 * cùng một câu hỏi: chỗ nào sắp chặn tôi trước.
 *
 * Tên nguồn KHÔNG đi qua `t()`: Claude, Cursor, Antigravity là danh từ riêng, giống nhau
 * ở mọi thứ tiếng. Tách chúng ra khỏi chuỗi dịch còn xoá luôn ba cặp khoá chỉ khác nhau
 * đúng cái tên.
 */
export const srcLabel = (name, tail, chip = '') =>
  html`<span class="ulabel"><b class="src">${name}</b>${chip} · ${tail}</span>`;

/**
 * Bậc gói, đứng ngay cạnh tên nguồn — TRƯỚC dấu `·`, không phải sau cả nhãn.
 *
 * Nó là MẪU SỐ của mọi phần trăm trong khối, nên chỗ của nó là cạnh cái tên chứ không
 * phải một hàng riêng ở đâu đó: "58%" một mình không so được qua thời gian — 58% của
 * Max 20x và 58% của Pro lệch nhau cả bậc token. Nâng gói xong mà không thấy nhãn đổi
 * theo thì cả lịch sử cũ lặng lẽ đổi nghĩa.
 *
 * Đứng sau đuôi nhãn thì nó bổ nghĩa cho cụm gần nhất — "hạn mức đã tiêu Max 20x" —
 * trong khi thứ nó thật sự nói tên là NGUỒN: gói Max 20x là gói của Claude, không phải
 * của con số. Ghép thẳng vào tên nguồn còn giữ được cả câu khi khối hẹp và nhãn xuống
 * dòng: "Claude Max 20x" không bao giờ bị tách khỏi nhau.
 *
 * **Gạch chân chấm = dashboard SUY RA, không phải nguồn tự khai.** Cursor không gửi tên
 * gói ở bất kỳ trường nào; cái tên đó là kết quả tra ngược bảng giá (xem `collect/plans.js`).
 * Dùng nét gạch chứ không dùng màu: máy này để theme daltonized, nên màu không bao giờ
 * được làm kênh phân biệt duy nhất.
 */
export function planChip(plan, tipKey, vars = {}) {
  if (!plan?.ok) return '';
  // Suy ra mà không tra được tên thì in đúng thứ đo được — "$25/tháng" vẫn đúng, còn một
  // cái tên đoán sai thì người đọc mang đi đối chiếu hoá đơn rồi kết luận dashboard hỏng.
  const text = plan.label ?? (plan.cents ? t('plan.perMonth', { money: `$${(plan.cents / 100).toFixed(0)}` }) : null);
  if (!text) return '';
  return html`<span class="q-plan ${plan.derived ? 'derived' : ''}" tabindex="0"
    data-tip="${t(tipKey, { ...plan, ...vars })}">${text}</span>`;
}

/**
 * Token rút gọn. Ngưỡng đặt ở một chữ số thập phân cho M/B: "1,4M" đọc được ngay,
 * còn "1.437.221" thì phải đếm dấu chấm mới biết là triệu hay tỷ.
 *
 * Ở ĐÂY chứ không ở `views/usage.js`, dù màn Token là chỗ dùng nhiều nhất: phần Cursor của
 * cùng màn ấy cũng in token và tiền, và hai nửa import lẫn nhau thì thành vòng. Hai hàm này
 * không biết gì về màn nào cả — chúng chỉ là cách viết một con số.
 */
export function tok(n) {
  const v = Math.round(n);
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return String(v);
}

/**
 * Tiền ước lượng. Dưới 100$ giữ hai số lẻ, trên thì làm tròn — lúc đó xu là nhiễu.
 * Số 0 viết gọn là `$0`: vạch gốc trục Y ghi "$0.00" cạnh "$500" trông như hai
 * đơn vị khác nhau.
 */
export function usd(n) {
  if (n == null) return '—';
  if (!n) return '$0';
  return n >= 100 ? `$${Math.round(n).toLocaleString('en-US')}` : `$${n.toFixed(2)}`;
}

/**
 * Dòng "dữ liệu cập nhật lúc nào · cách đây bao lâu" — đặt NGAY DƯỚI khối số nó nói về.
 *
 * Thanh trên cùng đã có giờ quét, nhưng nó nói về CẢ lượt quét; mỗi tab của màn Token
 * lại đọc từ một nguồn có nhịp làm mới riêng (transcript quét mỗi lượt, sổ sự kiện
 * Cursor kéo theo TTL riêng), nên con số phải đứng cạnh dữ liệu của chính nó — không
 * thì "1.0M hôm nay" và "đọc lúc 12:08" là hai mảnh ở hai góc màn, người đọc tự ghép.
 *
 * Cùng khuôn hai khoá với `quota.at`/`quota.atFresh`: dưới `JUST_NOW_MS` thì `ago()`
 * trả "vừa xong" — một mệnh đề trọn vẹn, ghép thêm "trước" là thành "vừa xong trước".
 */
export function dataAt(ts) {
  if (ts == null) return '';
  const age = Date.now() - ts;
  return html`<p class="data-at">${t(age < JUST_NOW_MS ? 'usage.dataAtFresh' : 'usage.dataAt', { time: clock(ts), age: ago(age) })}</p>`;
}

export function empty(icon, msg, hint) {
  return html`<div class="empty">
    <div class="big">${icon}</div>
    <div class="msg">${msg}</div>
    ${hint ? html`<div class="hint">${hint}</div>` : ''}
  </div>`;
}

export const matches = (q, ...parts) => !q || parts.filter(Boolean).join(' ').toLowerCase().includes(q);
