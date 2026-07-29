/**
 * Chart dựng bằng HTML/CSS thuần — không SVG, không thư viện.
 *
 * Cả dashboard không phụ thuộc gói nào, và chart ở đây toàn cột/thanh nên CSS
 * làm được hết: `height`/`width` phần trăm là chính giá trị, chữ giữ nguyên cỡ
 * thật khi khung co giãn (SVG scale thì chữ và nét méo theo), và mọi token màu
 * của HUD dùng lại được nguyên vẹn.
 *
 * Ba luật không được phá, vì phá là chart nói dối:
 *
 * 1. **Mỗi chart một màu** — trừ khi màu MANG NGHĨA (độ nóng quyết định). Tô mỗi
 *    cột một màu theo giá trị là đốt kênh màu để lặp lại đúng cái mà chiều dài
 *    cột đã nói rồi.
 * 2. **Không ghi số lên mọi cột** — chỉ cột đỉnh. Số dày đặc thì không ai đọc;
 *    phần còn lại để trục, tooltip và bảng số gánh.
 * 3. **Tooltip không bao giờ là đường duy nhất đọc được giá trị** — mỗi chart
 *    kèm một bảng số mở ra được, và mọi mốc đều `tabindex` để bàn phím tới được.
 */

import { html } from './dom.js';
import { t } from './i18n.js';
import { formFor, getSkin, nextSkin, SKIN_ICON } from './skin.js';
import { addRow, flatTip, tipOf } from './tip.js';

/**
 * Nút phong cách chart.
 *
 * Nó sống Ở ĐÂY, cạnh chart, chứ không trên thanh công cụ chung. Thanh trên cùng là chỗ
 * của những thứ đổi CẢ TRANG — nền, ngôn ngữ, quét lại; đứng chung với chúng là nó tự
 * hứa một tầm ảnh hưởng nó không có, và người dùng phải bấm thử mới biết nó chạm vào
 * cái gì. Thứ nó đổi chỉ là HÌNH của mấy cái chart ngay bên dưới, nên chỗ đúng của nó
 * là ngay trên đầu mấy cái chart đó.
 *
 * Ở chế độ ngẫu nhiên có thêm nút gieo lại. Không có nó thì "ngẫu nhiên" là một lần bốc
 * duy nhất rồi đứng im — muốn thấy hình khác phải bấm hết vòng bốn phong cách để quay
 * về đúng chỗ cũ.
 */
export function skinSwitch() {
  const s = getSkin();
  const tip = t('skin.title', { next: t(`skin.${nextSkin()}`) });
  return html`<span class="skin-sw">
    <button type="button" class="skin-b" data-skin="next" title="${tip}" aria-label="${tip}">
      <i class="si" aria-hidden="true">${SKIN_ICON[s] ?? SKIN_ICON.plain}</i>${t(`skin.${s}`)}
    </button>
    ${s === 'random'
      ? html`<button type="button" class="skin-b re" data-skin="reroll" title="${t('skin.reroll')}" aria-label="${t('skin.reroll')}">↻</button>`
      : ''}
  </span>`;
}

/**
 * Trục Y "đẹp": chọn bước 1/2/2.5/5 × 10ⁿ sao cho ra 3–5 vạch, rồi làm tròn trần
 * lên bội của bước. Trần bằng đúng giá trị lớn nhất thì cột cao nhất chạm nóc và
 * mất cảm giác còn bao nhiêu chỗ trống.
 */
export function scaleFor(v) {
  const top = Math.max(1, v);
  const raw = top / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => raw <= s) ?? 10 * mag;
  const max = Math.ceil(top / step) * step;
  const ticks = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
  return { max, ticks };
}

const pct = (v, max) => (max <= 0 ? 0 : Math.max(0, Math.min(100, (v / max) * 100)));

/** Khung chung: tiêu đề + phần vẽ + bảng số gập lại. */
export function card({ title, sub, body, table, wide = false }) {
  return html`<section class="ch ${wide ? 'wide' : ''}">
    <div class="ch-h">
      <div class="ch-t">${title}</div>
      ${sub ? html`<div class="ch-s">${sub}</div>` : ''}
    </div>
    ${body}
    ${table ?? ''}
  </section>`;
}

/**
 * Bảng số song sinh. Bắt buộc có ở mọi chart: người không phân biệt được màu,
 * người dùng bàn phím, và cả người chỉ muốn con số chính xác đều cần lối này.
 */
export function tableTwin(cols, rows, key) {
  // `data-k` để `keepUI` giữ trạng thái mở qua mỗi lượt quét — không có nó thì
  // cứ 30 giây bảng đang đọc dở lại tự sập xuống.
  //
  // Bảng nằm trong một hộp CUỘN NGANG riêng. Thẻ chart chỉ rộng nửa màn (~324px lúc mở cả
  // hai cột), mà một bảng năm sáu cột thì rộng 360–540px — không có hộp này thì bảng tràn
  // ra khỏi thẻ và mấy cột cuối bị thẻ bên cạnh che mất. Đo ra thì sáu bảng đang tràn, kể
  // cả ba bảng có từ trước ("theo model", "theo MCP", "theo skill") — nên đây là chỗ sửa
  // đúng: một hộp cuộn ở khuôn chung, không phải bớt cột ở từng chỗ gọi. Bảng số là lối đọc
  // CHÍNH XÁC, và bớt cột đi là bớt đúng thứ nó tồn tại để cung cấp.
  return html`<details class="ch-tw" data-k="ch:${key}">
    <summary>${t('chart.table')}</summary>
    <div class="ch-tws">
      <table class="tbl ch-tbl">
        <thead><tr>${cols.map((c, i) => html`<th class="${i ? 'num' : ''}">${c}</th>`)}</tr></thead>
        <tbody>
          ${rows.map((r) => html`<tr>${r.map((c, i) => html`<td class="${i ? 'num' : ''}">${c}</td>`)}</tr>`)}
        </tbody>
      </table>
    </div>
  </details>`;
}

/**
 * Nhãn số mặc định: in nguyên giá trị.
 *
 * Chart nào đo bằng token thì truyền `fmt` riêng — trục Y mà ghi "486778904" thì
 * năm vạch dính thành một vệt đen, và con số đó cũng không ai đọc ra được.
 */
const asIs = (v) => v;

/** Nhiều hơn ngần này nhãn trên trục X là chúng dính vào nhau thành một vệt. */
const MAX_X_LABELS = 8;

/**
 * Nhãn DÀI NHẤT của trục Y, tính theo số ký tự sau khi format.
 *
 * Rãnh trục Y từng là 22px viết cứng, mà "$1,500" đo ra 34px — nhãn tiền tràn sang
 * trái, đè lên phần đệm của thẻ. Nhét chuỗi này vào một phần tử vô hình trong `.ch-y`
 * (xem `.ch-ys`) thì cột `max-content` của grid tự nở ra đúng bề rộng cần, chart nào
 * nhãn ngắn ("5", "15") vẫn giữ rãnh hẹp như cũ.
 */
const ySizer = (ticks, fmt) => ticks.map((t) => String(fmt(t))).reduce((a, b) => (b.length > a.length ? b : a), '');

/**
 * Từ ngần này mốc trở lên, cột chuyển sang chế độ DÀY: khe 1px thay vì 2px và bo 2px
 * thay vì 4px. Chart phiên vẽ 100 cột trong một thẻ nửa màn — mỗi cột chỉ còn ~3px,
 * tức là khe 2px chiếm nhiều mực hơn chính dữ liệu, và bo 4px trên thân 3px biến cột
 * thành một giọt tròn. Ngưỡng theo SỐ MỐC chứ không theo pixel: 40 mốc trong thẻ hẹp
 * nhất (330px) là cột đã xuống dưới 6px.
 */
const DENSE_AT = 40;

/**
 * Chỉ số các mốc ĐƯỢC ghi nhãn trục X.
 *
 * Vẽ hết 45 nhãn "12/7" cạnh nhau thì không đọc được cái nào — kể cả cái đầu và cái
 * cuối, hai cái duy nhất thật sự cần. Nên khi quá dày thì lấy thưa đều, và luôn giữ
 * hai đầu để còn biết đoạn này bắt đầu và kết thúc ở đâu.
 *
 * Chỉ đụng tới những mốc mà call site ĐÃ đặt nhãn: màn Thống kê tự để trống nhãn giờ
 * lẻ rồi, thưa thêm một lần nữa trên đó là xoá mất chủ ý của nó.
 */
export function xLabels(data) {
  const at = data.map((d, i) => (d.x ? i : -1)).filter((i) => i >= 0);
  if (at.length <= MAX_X_LABELS) return new Set(at);

  const spread = [];
  for (let j = 0; j < MAX_X_LABELS; j++) {
    const k = at[Math.round((j * (at.length - 1)) / (MAX_X_LABELS - 1))];
    if (spread.at(-1) !== k) spread.push(k);
  }

  // Chia đều rồi làm tròn có thể ném hai nhãn vào hai mốc SÁT NHAU, và hai nhãn sát nhau
  // là hai chuỗi chồng lên nhau — đọc ra "19/720/7". Chỉ xảy ra khi số mốc lọt vào quãng
  // giữa (9–16): 14 mốc chia 8 nhãn ra bước 1,86, nên nhãn thứ tư và thứ năm rơi vào chỉ
  // số 6 và 7. Trên 16 mốc thì bước ≥ 2 nên không bao giờ chồng, và đó là lý do lỗi này
  // nằm im tới khi có một chart 14 ngày.
  //
  // Giữ HAI ĐẦU bằng mọi giá — chúng nói đoạn này bắt đầu và kết thúc ở đâu, thứ mà mấy
  // nhãn giữa không thay được. Nên khi mốc cuối kề mốc vừa giữ thì bỏ CÁI TRƯỚC, không bỏ
  // cái cuối. Ít nhãn hơn một cái thì vẫn đọc được; hai nhãn chồng nhau thì mất cả hai.
  const keep = [];
  for (const k of spread) {
    if (keep.length && k - keep.at(-1) < 2) {
      if (k !== spread.at(-1)) continue;
      keep.pop();
    }
    keep.push(k);
  }
  return new Set(keep);
}

/**
 * Vạch mốc tham chiếu — một đường ngang có tên.
 *
 * Chart tỉ số KHÔNG đọc được mà không có nó. "$0.26 mỗi 1K token sinh ra" đứng một mình
 * không nói được gì cả: đắt hay rẻ là so với cái gì? Cột cao nhất thì `ch-peak` đã ghi,
 * nhưng cao nhất trong mười lăm ngày vẫn có thể là bình thường. Vạch trung vị biến mỗi
 * cột thành một câu đọc được ngay — trên vạch là ngày đắt hơn thường lệ, dưới là rẻ hơn.
 *
 * Nét đứt, không nét liền: nét liền lẫn ngay vào lưới `ch-gl`, và lúc đó một mốc tham
 * chiếu MANG NGHĨA bị đọc thành một vạch lưới trang trí.
 */
const refLine = (ref, max, fmt) =>
  !ref || ref.v == null || ref.v <= 0 || ref.v > max
    ? ''
    : html`<i class="ch-ref" style="--p:${pct(ref.v, max)}%"><b>${ref.label} ${fmt(ref.v)}</b></i>`;

/**
 * Cột dọc — dùng cho chuỗi theo thời gian.
 * `data`: `[{ x, v, tip, sub }]`. Chỉ cột cao nhất được ghi số.
 * `ref`: `{ v, label }` — vạch mốc tham chiếu, xem `refLine`.
 */
export function columns({ data, color, height = 132, unit = '', fmt = asIs, form = 'columns', ref = null }) {
  const { max, ticks } = scaleFor(Math.max(0, ...data.map((d) => d.v)));
  const peak = Math.max(...data.map((d) => d.v));
  const labelled = xLabels(data);

  return html`<div class="ch-plot" style="--c:${color};--h:${height}px">
    <div class="ch-y">
      ${ticks
        .slice()
        .reverse()
        .map((t) => html`<span style="--p:${pct(t, max)}%">${fmt(t)}</span>`)}
      <b class="ch-ys" aria-hidden="true">${ySizer(ticks, fmt)}</b>
    </div>
    <div class="ch-area">
      ${ticks.map((t) => html`<i class="ch-gl" style="--p:${pct(t, max)}%"></i>`)}
      ${refLine(ref, max, fmt)}
      <div class="ch-cols ${form === 'lollipop' ? 'lolli' : ''} ${data.length >= DENSE_AT ? 'dense' : ''}">
        ${data.map(
          (d, i) => html`<div class="ch-col ${d.partial ? 'partial' : ''}" tabindex="0" data-tip="${d.tip}" aria-label="${flatTip(d.tip)}">
            ${d.v === peak && peak > 0 ? html`<b class="ch-peak" style="--p:${pct(d.v, max)}%">${fmt(d.v)}${unit}</b>` : ''}
            <i style="height:${pct(d.v, max)}%"></i>
            ${labelled.has(i) ? html`<span class="ch-x">${d.x}</span>` : ''}
          </div>`,
        )}
      </div>
    </div>
  </div>`;
}

/**
 * Bước "đẹp" cho một trục bị ÉP số vạch — bạn đồng hành của `scaleFor`.
 *
 * Trục hai bên phải dùng CHUNG một bộ vạch lưới, không thì mỗi trục kẻ một lưới riêng
 * và hình thành hai chart chồng lên nhau. Nên trục trái chọn số vạch (qua `scaleFor`),
 * còn trục phải phải ra một thang đẹp với ĐÚNG số khoảng đó — cùng thang 1/2/2.5/5×10ⁿ,
 * chỉ khác là `n` được đưa vào thay vì mặc định 4.
 */
function scaleForN(top, n) {
  const raw = Math.max(1, top) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => raw <= s) ?? 10 * mag;
  const ticks = [];
  for (let i = 0; i <= n; i++) ticks.push(Math.round(i * step * 100) / 100);
  return { max: step * n, ticks };
}

/**
 * Cột dọc HAI TRỤC — hai đại lượng trên cùng trục thời gian, lệch nhau quá xa để chung
 * một thang. Ca sinh ra nó: lượt gọi mỗi ngày (hàng trăm) và lượt hỏng (hàng đơn vị) —
 * chồng vào một cột thì mảnh lỗi mỏng hơn cả khe giữa hai cột, tức là thứ chart tồn tại
 * để chỉ ra lại là thứ duy nhất không nhìn thấy.
 *
 * Luật giữ cho hai trục không nói dối:
 *
 * - **Một bộ vạch lưới chung.** Trục phải bị ép cùng số khoảng với trục trái (xem
 *   `scaleForN`), nên mọi vạch ngang là mốc của CẢ HAI thang cùng lúc.
 * - **Nhãn trục nhuộm màu series của nó** — đó là cây cầu duy nhất nối "cột này đọc
 *   bên nào"; chú giải nói lại lần nữa bằng chữ.
 * - **Mỗi series MỘT số đỉnh** — một lần, không phải một lần mỗi ngày hoà đỉnh: series
 *   phải hay hoà (lỗi là số nguyên nhỏ, ba ngày cùng "3" là chuyện thường), mà ghi cả
 *   ba thì thành rắc số. Đỉnh phải nhường chỗ khi ngày của nó trùng ngày đỉnh trái —
 *   hai con số chồng lên nhau thì mất cả hai; hoà thì lấy ngày hoà khác, hết ngày thì
 *   thôi, số vẫn còn ở tooltip với bảng số.
 *
 * `data`: `[{ x, a, b, tip }]` — `a` đọc theo trục trái, `b` theo trục phải.
 */
export function dualColumns({ data, a, b, height = 132 }) {
  const fmtA = a.fmt ?? asIs;
  const fmtB = b.fmt ?? asIs;
  const sa = scaleFor(Math.max(0, ...data.map((d) => d.a)));
  const sb = scaleForN(
    Math.max(0, ...data.map((d) => d.b)),
    sa.ticks.length - 1,
  );
  const peakA = Math.max(...data.map((d) => d.a));
  const peakB = Math.max(...data.map((d) => d.b));
  const peakAAt = data.findIndex((d) => d.a === peakA);
  const peakBAt = data.findIndex((d, i) => d.b === peakB && i !== peakAAt);
  const labelled = xLabels(data);

  const axis = (s, fmt) => html`${s.ticks
      .slice()
      .reverse()
      .map((t) => html`<span style="--p:${pct(t, s.max)}%">${fmt(t)}</span>`)}
    <b class="ch-ys" aria-hidden="true">${ySizer(s.ticks, fmt)}</b>`;

  return html`<div class="ch-plot dual" style="--c:${a.color};--c2:${b.color};--h:${height}px">
    <div class="ch-y">${axis(sa, fmtA)}</div>
    <div class="ch-area">
      ${sa.ticks.map((t) => html`<i class="ch-gl" style="--p:${pct(t, sa.max)}%"></i>`)}
      <div class="ch-cols duo ${data.length >= DENSE_AT ? 'dense' : ''}">
        ${data.map(
          (d, i) => html`<div class="ch-col" tabindex="0" data-tip="${d.tip}" aria-label="${flatTip(d.tip)}">
            ${i === peakAAt && peakA > 0 ? html`<b class="ch-peak" style="--p:${pct(d.a, sa.max)}%">${fmtA(d.a)}</b>` : ''}
            ${i === peakBAt && peakB > 0
              ? html`<b class="ch-peak p2" style="--p:${pct(d.b, sb.max)}%">${fmtB(d.b)}</b>`
              : ''}
            <i style="height:${pct(d.a, sa.max)}%"></i>
            <i class="b2" style="height:${pct(d.b, sb.max)}%"></i>
            ${labelled.has(i) ? html`<span class="ch-x">${d.x}</span>` : ''}
          </div>`,
        )}
      </div>
    </div>
    <div class="ch-y r">${axis(sb, fmtB)}</div>
  </div>`;
}

/**
 * Vùng — cùng dữ liệu với cột, nhưng đọc ra HÌNH DÁNG của cả đoạn thay vì từng mốc.
 *
 * Dựng bằng `clip-path: polygon(...)`, không SVG: toạ độ là phần trăm nên hình co giãn
 * theo khung mà chữ không méo theo, đúng lý do cả file này không dùng SVG.
 *
 * Đường viền trên là ba lớp chồng nhau chứ không phải nét vẽ — CSS không có "stroke"
 * cho clip-path. Lớp 1 tô đặc theo đúng đa giác, lớp 2 tô màu nền theo đa giác ĐÃ TỤT
 * XUỐNG 2px, nên lớp 1 chỉ còn lộ ra đúng dải 2px ở mép trên. Lớp 3 là mảng gradient,
 * cũng theo đa giác tụt, nằm trên lớp 2 để nền không nuốt mất nó.
 */
export function area({ data, color, height = 132, unit = '', fmt = asIs, ref = null }) {
  const { max, ticks } = scaleFor(Math.max(0, ...data.map((d) => d.v)));
  const peak = Math.max(...data.map((d) => d.v));
  const n = data.length;
  const px = (i) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const top = (v) => 100 - pct(v, max);

  const at = (fn) => data.map((d, i) => `${px(i).toFixed(3)}% ${fn(d.v)}`).join(',');
  const poly = `polygon(0% 100%,${at((v) => `${top(v).toFixed(3)}%`)},100% 100%)`;
  const under = `polygon(0% 100%,${at((v) => `calc(${top(v).toFixed(3)}% + 2px)`)},100% 100%)`;

  const labelled = xLabels(data);

  return html`<div class="ch-plot" style="--c:${color};--h:${height}px">
    <div class="ch-y">
      ${ticks
        .slice()
        .reverse()
        .map((t) => html`<span style="--p:${pct(t, max)}%">${fmt(t)}</span>`)}
      <b class="ch-ys" aria-hidden="true">${ySizer(ticks, fmt)}</b>
    </div>
    <div class="ch-area">
      ${ticks.map((t) => html`<i class="ch-gl" style="--p:${pct(t, max)}%"></i>`)}
      ${refLine(ref, max, fmt)}
      <i class="ar-line" style="clip-path:${poly}"></i>
      <i class="ar-cut" style="clip-path:${under}"></i>
      <i class="ar-fill" style="clip-path:${under}"></i>
      ${data.map(
        (d, i) => html`<i
          class="ar-dot ${d.partial ? 'partial' : ''} ${d.v === peak && peak > 0 ? 'peak' : ''}"
          style="left:${px(i)}%;bottom:${pct(d.v, max)}%"
          tabindex="0"
          data-tip="${d.tip}"
          aria-label="${flatTip(d.tip)}"
        ></i>`,
      )}
      ${peak > 0
        ? html`<b class="ar-peak" style="left:${px(data.findIndex((d) => d.v === peak))}%;bottom:${pct(peak, max)}%"
            >${fmt(peak)}${unit}</b
          >`
        : ''}
      ${data.map((d, i) =>
        d.x && labelled.has(i)
          ? html`<span class="ar-x ${i === 0 ? 'first' : ''} ${i === n - 1 ? 'last' : ''}" style="left:${px(i)}%"
              >${d.x}</span
            >`
          : '',
      )}
    </div>
  </div>`;
}

/**
 * Thanh ngang — dùng khi hạng mục có tên dài (tên dự án) hoặc cần xếp hạng.
 * `rows`: `[{ label, v, tip, color? }]`. Giá trị ghi ở đầu thanh, không phải
 * trong lòng thanh: thanh ngắn thì chữ trong lòng bị cắt mất đầu đuôi.
 */
export function hbars({ rows, color, unit = '', fmt = asIs }) {
  // Thanh ngang xếp hạng KHÔNG dùng thang làm tròn của trục: ở đây không có trục,
  // giá trị đọc bằng số ghi ở đầu thanh, nên lấy thẳng giá trị lớn nhất làm 100%.
  // Dùng `scaleFor` thì lúc 9 được làm tròn lên 10 (thanh dài 90%), lúc 6 vẫn là 6
  // (thanh dài 100%) — cùng một chart mà hai hàng cùng-là-lớn-nhất lại dài khác nhau.
  const max = Math.max(0, ...rows.map((r) => r.v));
  return html`<div class="ch-rows" style="--c:${color}">
    ${rows.map(
      (r) => html`<div class="ch-row" tabindex="0" data-tip="${r.tip}" aria-label="${flatTip(r.tip)}">
        <span class="ch-lbl" title="${r.label}">${r.label}</span>
        <span class="ch-htrack"><i style="width:${pct(r.v, max)}%${r.color ? `;--c:${r.color}` : ''}"></i></span>
        <b class="ch-val">${fmt(r.v)}${unit}</b>
      </div>`,
    )}
  </div>`;
}

/**
 * Thanh ngang chia phần, nhiều hàng dùng CHUNG một thang.
 *
 * Các mảnh cách nhau bằng KHE nền 2px chứ không viền — viền là thêm mực không
 * mang dữ liệu, còn khe thì tự nó tách được. Mọi hàng đo trên cùng một `max` để
 * so được độ dài giữa hàng này với hàng kia; chuẩn hoá từng hàng về 100% thì
 * thành năm cái bánh tròn cạnh nhau, không còn so được gì.
 */
export function stackedRows({ rows, unit = '', fmt = asIs }) {
  const max = Math.max(0, ...rows.map((r) => r.total));
  const GAP = 2;

  return html`<div class="ch-rows">
    ${rows.map((r) => {
      const parts = r.parts.filter((p) => p.v > 0);
      return html`<div class="ch-row">
        <span class="ch-lbl" title="${r.label}">${r.label}</span>
        <span class="ch-htrack ch-stack">
          ${parts.map(
            // Khe 2px là khoảng cách THÊM vào, nên mảnh phải trừ lại đúng 2px, nếu
            // không hàng dài nhất tràn quá rãnh rồi bị flex bóp — mọi mảnh ngắn đi
            // một chút và thanh không còn khớp với con số nữa.
            (p, i) => html`<i
              style="width:${i < parts.length - 1 ? `calc(${pct(p.v, max)}% - ${GAP}px)` : `${pct(p.v, max)}%`};--c:${p.color}"
              tabindex="0"
              data-tip="${p.tip}"
              aria-label="${flatTip(p.tip)}"
            ></i>`,
          )}
        </span>
        <b class="ch-val">${fmt(r.total)}${unit}</b>
      </div>`;
    })}
  </div>`;
}

/* ── Chia phần: quạt tròn và treemap ─────────────────────────────────────────
   Quạt tròn KHÔNG còn chiều dài để phân biệt mảnh nữa — ở đó màu LÀ dữ liệu. Nhưng nó
   vẫn không được phá luật "mỗi chart một màu": thay vì bốc bảy sắc cầu vồng, nó dùng
   đúng MỘT sắc rồi trải theo độ đậm. Vừa phân biệt được, vừa giữ nguyên thứ tự (đậm =
   lớn) — bảy màu rời rạc không nói được điều đó, và với người mù màu thì cầu vồng còn
   tệ hơn hẳn thang một sắc.

   Treemap thì KHÔNG trải thang, và đó là một lần "bỏ bớt một món": diện tích đã nói
   đúng cái mà độ đậm định nói lại, các ô đã tách nhau bằng khe 3px rồi, và trải thang
   thì nhãn trên ô nhạt nhất tụt xuống 3,8:1 — dưới chuẩn đọc. Một màu, hết. */

/**
 * Nấc thứ `i` trên thang một sắc: đậm nhất ở phần lớn nhất, nhạt dần xuống.
 * Trộn về `--chart-void` (một màu trung tính của nền đang bật) nên thang tự lật theo
 * nền sáng/tối mà không có nhánh JS nào phải biết.
 *
 * Đáy thang dừng ở 62% chứ không đi tới cùng, và đây là một con số đo được chứ không
 * phải gu thẩm mỹ: nhạt hơn nữa thì mảnh cuối chỉ còn 2,2:1 so với nền thẻ — tức là
 * gần như biến mất. 62% giữ nó ở trên 3:1, mốc tối thiểu để một mảng màu mang thông
 * tin còn được coi là nhìn thấy được.
 *
 * Thang hẹp không làm hỏng việc dò mảnh ↔ chú giải: hai bảng xếp CÙNG một thứ tự (mảnh
 * chạy theo chiều kim đồng hồ từ 12 giờ, chú giải chạy từ trên xuống), nên người đọc dò
 * theo VỊ TRÍ, còn màu chỉ cần phân biệt được với nền.
 */
const shade = (color, i, n) =>
  `color-mix(in oklab, ${color} ${(n <= 1 ? 100 : 100 - (i / (n - 1)) * 38).toFixed(1)}%, var(--chart-void))`;

/**
 * Bảng màu của quạt tròn — chỗ DUY NHẤT trong dashboard được dùng nhiều SẮC.
 *
 * Luật "một chart một màu" đứng vững ở mọi chart khác vì ở đó nhãn dính liền với dữ
 * liệu: thanh ngang có tên ngay đầu thanh, cột có nhãn ngay dưới chân. Quạt tròn thì
 * không — một cung tròn không mang chữ nào, và cây cầu DUY NHẤT nối nó với tên là ô màu
 * bên chú giải. Ở đây màu chính là danh tính, đúng cái ngoại lệ mà luật kia chừa ra.
 *
 * Bản trước dùng thang ĐỘ SÁNG của cùng một sắc, và thang đó hỏng theo hai hướng cùng
 * lúc: nới rộng cho dễ phân biệt thì mảnh nhạt nhất tụt xuống 2,2:1 so với nền thẻ, thu
 * hẹp cho đủ tương phản thì tám mảnh gần như một màu. Xoay SẮC gỡ được cả hai: giữ
 * nguyên độ sáng và độ bão hoà nên **mọi mảnh có cùng một mức tương phản với nền**, mà
 * vẫn cách nhau 200°/n — mắt phân biệt sắc tốt hơn hẳn phân biệt độ sáng.
 *
 * Không quét trọn 360°: mảnh cuối sẽ quay về đúng sắc của mảnh đầu. Và độ sáng phải nằm
 * ở biến theo nền (`--dn-l`) — nền sáng với nền tối không thể dùng chung một trị.
 *
 * Mảnh "còn lại" luôn xám: nó không phải một hạng mục, nó là phần đuôi bị gộp. Cho nó
 * một sắc riêng là hứa một danh tính mà nó không có.
 */
const DN_SPAN = 200;
const dnColor = (color, i, n) =>
  n <= 1 ? color : `oklch(from ${color} var(--dn-l) var(--dn-c) calc(h + ${((i / (n - 1)) * DN_SPAN).toFixed(1)}))`;

/**
 * Gộp đuôi dài thành một phần "khác".
 *
 * Quạt tròn 30 mảnh và treemap 30 ô đều thành cháo. Nhưng cắt bớt mà im lặng là nói
 * dối — nên phần bị gộp vẫn được kể, vẫn chiếm đúng diện tích của nó, và nhãn nói rõ
 * nó gộp bao nhiêu hạng mục.
 */
function capped(rows, cap, unit, fmt) {
  const clean = rows.filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
  const parts =
    clean.length > cap
      ? [
          ...clean.slice(0, cap - 1),
          {
            label: t('chart.others', { n: clean.length - cap + 1 }),
            v: clean.slice(cap - 1).reduce((n, r) => n + r.v, 0),
            rest: true,
          },
        ]
      : clean;
  // Mảnh nào cũng phải có câu đọc được, kể cả mảnh gộp — nó không đến từ call site.
  return parts.map((r) => ({ ...r, tip: r.tip ?? tipOf({ head: r.label, rows: [[t('chart.value'), `${fmt(r.v)}${unit}`]] }) }));
}

/** Bước chia cung khi dựng vùng bắt chuột. 6° thì đa giác lệch khỏi cung 0,1px — đủ. */
const WEDGE_STEP = 6;

/**
 * Vùng bắt chuột của một mảnh quạt, viết bằng `clip-path`.
 *
 * Cả vành là MỘT `conic-gradient` — nhanh, sắc nét, nhưng cũng có nghĩa là không có phần
 * tử nào ứng với một mảnh để mà rê chuột vào. Nên phủ lên trên nó mấy hình quạt trong
 * suốt, mỗi hình đúng góc của một mảnh: `clip-path` cắt cả vùng nhận chuột chứ không chỉ
 * cắt hình, nên chúng phân vùng con trỏ y như thể mỗi mảnh là một phần tử thật.
 *
 * Toạ độ tính theo hệ của `conic-gradient`: 0° ở 12 giờ, quay theo chiều kim đồng hồ.
 * Bán kính 51% để đa giác phủ trọn mép vành (`.dn-ring` có `overflow:hidden` cắt lại
 * phần thừa) — 50% chẵn thì mỗi cạnh đa giác hụt vào trong một chút và viền ngoài cùng
 * của vành thành một dải chết không bắt được chuột.
 */
export function wedge(a0, a1) {
  const n = Math.max(1, Math.ceil((a1 - a0) / WEDGE_STEP));
  const pts = ['50% 50%'];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push(`${(50 + 51 * Math.sin(a)).toFixed(2)}% ${(50 - 51 * Math.cos(a)).toFixed(2)}%`);
  }
  return `polygon(${pts.join(',')})`;
}

/**
 * Quạt tròn. Đọc ra TỈ LỆ: hạng mục này chiếm bao nhiêu phần của tổng.
 *
 * Vành chia bằng `conic-gradient`, và vạch ngăn giữa hai mảnh là một nét XOAY nằm đè
 * lên trên chứ không phải một khe cắt vào gradient: khe cắt thì mỗi vạch ăn mất một
 * phần góc, mười mảnh là chart nhỏ đi 3% mà không ai nói ra.
 *
 * Mảnh và dòng chú giải là MỘT mục hiện ra ở hai chỗ, nên chúng dùng chung `data-dn` và
 * sáng lên cùng nhau (xem `hotDonut` trong `app.js`). Trước đây mảnh không rê được: lý
 * do khi ấy là "mọi con số đã nằm ở chú giải rồi". Nhưng đọc một cung tròn không phải
 * việc đọc số — nó là việc GHÉP: cung này là ai. Chú giải không giúp được, nó chỉ đưa ra
 * một bảng màu để tự dò. Rê vào mảnh mà tên hiện ra ngay tại đó thì phép ghép biến mất.
 */
export function donut({ rows, color, unit = '', fmt = asIs, cap = 8 }) {
  const parts = capped(rows, cap, unit, fmt);
  // Toàn 0 thì không có tổng để chia — quạt tròn vô nghĩa, lùi về thanh ngang.
  if (!parts.length) return hbars({ rows, color, unit, fmt });

  const total = parts.reduce((n, r) => n + r.v, 0);
  const stops = [];
  let acc = 0;
  // Mảnh "còn lại" đứng ngoài thang sắc, nên thang chỉ trải trên số mảnh THẬT — nếu
  // không thì một phần cung sắc bị tiêu vào chỗ chẳng ai nhìn.
  const hued = parts.length - (parts.at(-1)?.rest ? 1 : 0);
  const keys = parts.map((r, i) => {
    const from = (acc / total) * 100;
    acc += r.v;
    const to = (acc / total) * 100;
    const c = r.rest ? 'var(--later)' : dnColor(color, i, hued);
    stops.push(`${c} ${from.toFixed(3)}% ${to.toFixed(3)}%`);
    const share = r.v / total;
    return {
      ...r,
      c,
      share,
      from,
      to,
      // Tỉ lệ là thứ RIÊNG của quạt tròn — cùng bộ dữ liệu vẽ thành thanh ngang thì
      // không có tỉ lệ nào cả. Nên nó được ghép thêm ở đây chứ không nằm sẵn ở call site.
      tip: addRow(r.tip, t('chart.share'), shareText(share)),
    };
  });

  // Vành là một vòng KHÉP KÍN, nên số vạch ngăn bằng đúng số mảnh — kể cả vạch ở 12 giờ,
  // chỗ mảnh cuối gặp lại mảnh đầu. Bỏ vạch ấy (vì `from` của mảnh đầu bằng 0) là để hai
  // mảnh duy nhất trên vành dính liền nhau không qua khe, và mắt đọc chúng thành MỘT mảnh
  // — đúng chỗ dễ đọc nhầm nhất, vì 12 giờ cũng là nơi người ta bắt đầu dò.
  // Một mảnh thì không có gì để ngăn: vạch lúc ấy chỉ là một nét cắt ngang một vòng đặc.
  const seps = keys.length > 1 ? keys.map((k) => k.from * 3.6) : [];

  return html`<div class="ch-dn" style="--c:${color}">
    <div class="dn-ring" style="background:conic-gradient(${stops.join(',')})" role="presentation">
      ${keys.map(
        (k, i) => html`<i
          class="dn-w"
          data-dn="${i}"
          data-tip="${k.tip}"
          data-tip-c="${k.c}"
          data-tip-at="pointer"
          style="clip-path:${wedge(k.from * 3.6, k.to * 3.6)}"
        ></i>`,
      )}
      ${seps.map((deg) => html`<i class="dn-sep" style="rotate:${deg.toFixed(2)}deg"></i>`)}
      <div class="dn-hole"><b>${fmt(total)}${unit}</b><span>${t('chart.total')}</span></div>
    </div>
    <div class="dn-keys">
      ${keys.map(
        (k, i) => html`<div
          class="dn-key"
          tabindex="0"
          data-dn="${i}"
          data-tip="${k.tip}"
          data-tip-c="${k.c}"
          aria-label="${flatTip(k.tip)}"
        >
          <i style="background:${k.c}"></i>
          <span class="dn-l" title="${k.label}">${k.label}</span>
          <b class="dn-v">${fmt(k.v)}${unit}</b>
          <span class="dn-p">${shareText(k.share)}</span>
        </div>`,
      )}
    </div>
  </div>`;
}

/** Tỉ lệ: dưới 10% giữ một số lẻ, vì ở đó 0,4% và 0% là hai chuyện khác nhau. */
const shareText = (v) => `${v >= 0.1 ? Math.round(v * 100) : Math.round(v * 1000) / 10}%`;

/**
 * Xếp ô vuông theo diện tích (squarified treemap).
 *
 * Thuật toán gốc của Bruls–Huizing–van Wijk: nhét lần lượt vào một hàng dọc theo cạnh
 * NGẮN của phần còn lại, và dừng hàng ngay khi thêm một ô nữa làm tỉ lệ dài/rộng xấu
 * đi. Cắt kiểu đơn giản (chia đều theo một chiều) thì phần nhỏ thành những sợi chỉ dài
 * 200×3px — đúng diện tích, nhưng không so được với ô nào và cũng không ghi nổi nhãn.
 *
 * Xuất ra để test được: đây là chỗ duy nhất trong file có thuật toán thật sự.
 */
export function squarify(values, W, H) {
  const out = values.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  const idx = values.map((_, i) => i).filter((i) => values[i] > 0);
  const sum = idx.reduce((n, i) => n + values[i], 0);
  if (!idx.length || sum <= 0 || W <= 0 || H <= 0) return out;

  const areas = idx.map((i) => (values[i] * (W * H)) / sum);
  const span = (i, end) => {
    let s = 0;
    for (let k = i; k < end; k++) s += areas[k];
    return s;
  };
  // Tỉ lệ dài/rộng xấu nhất của hàng đang dựng — chính là hàm mục tiêu của thuật toán.
  const worst = (i, end, short) => {
    const s = span(i, end);
    if (s <= 0 || short <= 0) return Infinity;
    let hi = -Infinity;
    let lo = Infinity;
    for (let k = i; k < end; k++) {
      if (areas[k] > hi) hi = areas[k];
      if (areas[k] < lo) lo = areas[k];
    }
    if (lo <= 0) return Infinity;
    const s2 = s * s;
    const l2 = short * short;
    return Math.max((l2 * hi) / s2, s2 / (l2 * lo));
  };

  let x = 0;
  let y = 0;
  let w = W;
  let h = H;
  let i = 0;
  while (i < areas.length && w > 0 && h > 0) {
    const short = Math.min(w, h);
    let end = i + 1;
    let best = worst(i, end, short);
    while (end < areas.length) {
      const next = worst(i, end + 1, short);
      if (next > best) break;
      best = next;
      end++;
    }

    const rowArea = span(i, end);
    if (w >= h) {
      const rw = rowArea / h;
      let cy = y;
      for (let k = i; k < end; k++) {
        const rh = areas[k] / rw;
        out[idx[k]] = { x, y: cy, w: rw, h: rh };
        cy += rh;
      }
      x += rw;
      w -= rw;
    } else {
      const rh = rowArea / w;
      let cx = x;
      for (let k = i; k < end; k++) {
        const cw = areas[k] / rh;
        out[idx[k]] = { x: cx, y, w: cw, h: rh };
        cx += cw;
      }
      y += rh;
      h -= rh;
    }
    i = end;
  }
  return out;
}

/** Khung ảo của treemap. Tỉ lệ 16:9 để `squarify` tính "vuông" đúng với hình thật. */
const TM_W = 160;
const TM_H = 90;

/**
 * Treemap. Đọc ra "cái nào CHIẾM CHỖ": diện tích tỉ lệ với giá trị, nên một hạng mục
 * gấp đôi trông đúng là gấp đôi — điều mà thanh ngang cũng làm được, nhưng treemap
 * làm được cho ba mươi hạng mục trong đúng chỗ mà thanh ngang vẽ được tám.
 *
 * Ô quá nhỏ thì bỏ chữ chứ không thu nhỏ chữ: chữ 6px là mực không đọc được, còn ô
 * trống thì vẫn còn diện tích và màu để nói. Số của chúng nằm ở bảng số song sinh.
 */
export function treemap({ rows, color, unit = '', fmt = asIs, cap = 14 }) {
  const parts = capped(rows, cap, unit, fmt);
  if (!parts.length) return hbars({ rows, color, unit, fmt });

  const cells = squarify(
    parts.map((r) => r.v),
    TM_W,
    TM_H,
  );

  return html`<div class="ch-tm" style="--c:${color}">
    ${parts.map((r, i) => {
      const c = cells[i];
      const w = (c.w / TM_W) * 100;
      const h = (c.h / TM_H) * 100;
      return html`<i
        class="tm-c ${w < 16 || h < 20 ? 'bare' : ''}"
        style="left:${(c.x / TM_W) * 100}%;top:${(c.y / TM_H) * 100}%;width:calc(${w}% - 3px);height:calc(${h}% - 3px)"
        tabindex="0"
        data-tip="${r.tip}"
        aria-label="${flatTip(r.tip)}"
      >
        <b class="tm-l">${r.label}</b><b class="tm-v">${fmt(r.v)}${unit}</b>
      </i>`;
    })}
  </div>`;
}

/* ── Chọn hình theo phong cách ────────────────────────────────────────────────
   Call site khai KIỂU dữ liệu (`series` hay `rank`) và một mã ổn định, rồi `skin.js`
   quyết hình. Chỗ vẽ không cần biết đang bật phong cách nào, và quan trọng hơn: không
   có đường nào để một chart thời gian rơi vào quạt tròn. */

/** Chuỗi theo thời gian. `id` dùng luôn mã của bảng số song sinh. */
export function series({ id, data, color, height, unit, fmt, ref = null }) {
  return formFor('series', id) === 'area'
    ? area({ data, color, height, unit, fmt, ref })
    : columns({ data, color, height, unit, fmt, ref, form: formFor('series', id) });
}

/** Xếp hạng / chia phần. */
export function ranked({ id, rows, color, unit, fmt }) {
  const form = formFor('rank', id);
  if (form === 'donut') return donut({ rows, color, unit, fmt });
  if (form === 'treemap') return treemap({ rows, color, unit, fmt });
  return hbars({ rows, color, unit, fmt });
}

/** Chú giải — bắt buộc khi có từ 2 màu mang nghĩa trở lên. */
export function legend(items) {
  return html`<div class="ch-lg">
    ${items.map(
      (i) => html`<span class="ch-lgi"><i style="--c:${i.color}"></i>${i.icon ? `${i.icon} ` : ''}${i.label}</span>`,
    )}
  </div>`;
}
