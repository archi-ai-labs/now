import { html, raw } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { card, series, ranked, hbars, stackedRows, legend, skinSwitch, tableTwin } from '../lib/chart.js';
import { reportBtn } from '../lib/report.js';
import { dataAt, empty, planChip, srcLabel, tok, ulabel, usd } from './shared.js';
import { ago, clock, JUST_NOW_MS } from '../lib/dom.js';
import { barColor, cardText, forecastTip, pctText, quotaBar, quotaLegend, resetLabel, spentText, windowsOf } from '../lib/quota.js';
import { flatTip } from '../lib/tip.js';
import { surfaceName } from '../lib/surface.js';
import { getTab, tabBar, tabPanel } from '../lib/tabs.js';
import { agQuotaPanel, agTab, cursorQuotaPanel, cursorTab } from './tools.js';

/**
 * Màn token.
 *
 * Cùng một luật với màn Thống kê — **mọi con số phải có thật** — nhưng ở đây có
 * thêm một cái bẫy riêng: cache đọc lớn gấp hai trăm lần token sinh ra (3,8 tỷ so
 * với 19 triệu trên máy này). Vẽ "tổng token mỗi ngày" thì 98% chiều cao cột là
 * cache đọc, và biểu đồ chỉ còn nói được một điều: hôm đó ngồi máy bao lâu.
 *
 * Nên hai chart theo ngày đo hai thứ KHÁC nhau và cùng có nghĩa: tiền ước lượng
 * (gộp cả bốn loại token, mỗi loại đúng trọng số của nó) và token sinh ra (phần
 * việc Claude thật sự làm ra). Cache đọc vẫn được kể, nhưng ở nơi nó nói lên điều
 * gì đó: tỉ lệ cache hit.
 *
 * Chỗ dễ hiểu lầm nhất là con số đô. Đĩa KHÔNG lưu tiền — không dòng transcript
 * nào có `costUSD`. Toàn bộ số $ ở màn này do dashboard tự nhân ra từ bảng giá API
 * dán trong `collect/usage.js`, mà tài khoản này thì trả theo gói thuê bao. Vì vậy
 * mọi chỗ hiện tiền đều mang chữ "ước lượng", và ghi chú cuối màn nói thẳng ra.
 *
 * ## Màn này giờ mang cả ba công cụ
 *
 * Màn Công cụ cũ đã được gộp vào đây. Bố cục theo đúng một luật: **thứ gấp thì không nằm
 * sau một cú bấm**. Nên khối hạn mức của cả ba — Claude, Cursor, Antigravity — đứng đầu
 * màn, luôn hiện, còn phần chi tiết của từng công cụ nằm trong tab của nó (`lib/tabs.js`).
 *
 * Chia tab theo CÔNG CỤ chứ không theo chủ đề, và lý do là đơn vị đo: ba nguồn này đo bằng
 * ba đơn vị không quy đổi cho nhau được (phần trăm hai cửa sổ trượt, đô thật theo tháng,
 * phần trăm của hai hồ tách rời). Một tab "chi phí" gộp cả ba sẽ đặt ba loại số ấy cạnh
 * nhau và mời người đọc trừ chúng cho nhau. Tab theo công cụ thì mỗi lần trên màn chỉ có
 * một đơn vị đo, nên phép trừ sai ấy không có chỗ để xảy ra.
 */

/** Nhóm tab của màn này — xem `lib/tabs.js`. */
const TABS = 'usage';

const COLOR = {
  cost: 'var(--accent)',
  out: 'var(--accent-ink)',
  cacheRead: 'var(--later)',
  cacheWrite: 'var(--soon)',
  input: 'var(--ok)',
  project: 'var(--accent)',
  attribution: 'var(--accent-ink)',
  // Khối hiệu quả đo tỉ số, không đo khối lượng — hai sắc riêng để nó không bị đọc như
  // một chart khối lượng nữa. `waste` dùng đúng sắc cảnh báo của thanh hạn mức: hai chỗ
  // cùng nói "đã trả tiền rồi bỏ đi" thì phải cùng một màu.
  unit: 'var(--soon)',
  ctx: 'var(--later)',
  waste: 'var(--warn)',
};

/**
 * Trung vị. Bản của client, cho vạch mốc tham chiếu.
 *
 * Không dùng lại `median` của `collect/efficiency.js`: file đó chạy ở Node và import
 * `costOf`, kéo theo cả `node:fs`. Bốn dòng chép lại rẻ hơn hẳn việc tách một module dùng
 * chung cho đúng một phép tính không có chỗ nào để sai.
 */
function median(list) {
  if (!list.length) return 0;
  const a = list.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

const pctOf = (v) => `${(v * 100).toFixed(1)}%`;

const dmy = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
};

/** Tổng token thô của một mốc — cả bốn loại, dùng cho tooltip và bảng số. */
const total = (r) => r.inTok + r.cw5 + r.cw1 + r.cr + r.out;

/* ── Hạn mức ──────────────────────────────────────────────────────────────── */

/**
 * Một cửa sổ = một thẻ. **Mỗi con số xuất hiện đúng một lần** — luật duy nhất của thẻ này,
 * và là thứ bản trước vi phạm ở cả bốn con số nó hiện.
 *
 * Bản trước: "30%" to ở trên rồi "30%" lần nữa trong mảng đặc; "→51%" trong mảng gạch rồi
 * "chỉ tới 51%" ở câu dưới; "49%" ở đuôi thanh rồi "bỏ phí 49%" cũng ở câu ấy. Từng chỗ
 * đều có lý do riêng khi thêm vào, mà cộng lại thì mỗi trị đọc hai lần ở hai kiểu chữ khác
 * nhau — mắt phải kiểm tra xem hai cái đó có phải cùng một con số không, và câu trả lời
 * luôn là có. Toàn bộ công đó là lãng phí.
 *
 * Giờ mỗi trị có đúng một chỗ ở:
 *
 * 1. **Đã tiêu** — số to nhất thẻ, và CHỈ ở đó. Mảng đặc dưới nó không ghi lại nữa; chiều
 *    dài mảng đã là con số ấy rồi. Không phải "còn bao nhiêu": hạn mức không cộng dồn, nên
 *    phần chưa dùng không phải của cải để đếm, nó là phần sắp mất.
 * 2. **Dự phóng và bỏ phí** — trong đúng mảng của chúng trên thanh, không đâu khác.
 * 3. **Mốc đều** — chú thích dưới chân vạch.
 * 4. **Một câu, và chỉ khi cái hình không nói nổi.** Kẹt bao lâu, hay vì sao chưa đoán
 *    được — hai thứ không có mảng nào để vẽ. Còn "bỏ phí 49%" thì đuôi thanh đã nói bằng
 *    cả chữ lẫn màu, nên câu kết luận cũ bị bỏ hẳn: nó chỉ chép lại thanh thành văn xuôi.
 *
 * Số đầy đủ — nhịp %/giờ, mốc reset tuyệt đối, độ lệch so với mốc đều — nằm ở tooltip.
 * Thẻ trả lời câu "có ổn không"; tooltip trả lời câu "chính xác là bao nhiêu".
 *
 * Trước đây có thêm một **bảng số** dưới khối, sáu cột cho đúng ba hàng. Nó đã bị bỏ: cả
 * sáu cột đều đã nằm sẵn trong tooltip của chính cái thẻ, nên bảng chỉ là bản in lại của
 * thứ ngay phía trên nó — mà bảng số song sinh (`tableTwin`) sinh ra cho CHART, nơi hình
 * vẽ thật sự giấu mất trị chính xác. Ở đây hình không giấu gì: mỗi cửa sổ đã có một thẻ
 * riêng với con số của nó in to nhất khối.
 *
 * Không mất lối đọc nào. Tooltip mở bằng cả `pointerover` lẫn `focusin` (thẻ có
 * `tabindex="0"`), và cùng nội dung ấy nằm trong `aria-label` cho trình đọc màn hình.
 * Ngược lại còn được thêm hai hàng bảng chưa từng có: **mốc đều** kèm độ lệch, và
 * **ngồi không** bao lâu khi cửa sổ sẽ chạm trần trước reset.
 *
 * Thẻ chứ không phải hàng ngang chạy hết bề rộng màn: thanh dài 800px thì mắt không
 * ước lượng nổi 30% với 40%, và ba thanh dài bằng nhau nằm chồng lên nhau trông như
 * ba lần tải file chứ không như ba cửa sổ độc lập.
 *
 * ## Ngoại lệ đã được duyệt: tiền của cửa sổ nằm ở CẢ thẻ lẫn tooltip
 *
 * `≈$248` đứng ngay sau con số phần trăm, và cùng con số đó cũng có một hàng trong tooltip.
 * Đó là vi phạm luật "mỗi con số một chỗ" bên trên — vi phạm CÓ CHỦ Ý, do người dùng chọn.
 * Lý do nó đáng: phần trăm trả lời "còn bao nhiêu phần hạn mức", tiền trả lời "gói này đang
 * moi ra được bao nhiêu", và câu thứ hai là câu duy nhất so được giữa hai cửa sổ khác độ
 * dài. Bắt phải rê chuột mới thấy thì nó thành số của người đi soát, không phải số của
 * người liếc một cái rồi quyết chạy phiên tới ở đâu.
 *
 * Nó KHÔNG dùng màu của thang bỏ phí: tiền ước lượng không phải một kết cục tốt hay xấu,
 * và kênh màu ở khối này đã có nghĩa riêng.
 */
function quotaCard(entry) {
  const { w, label, tone } = entry;
  const say = cardText(w);
  const tip = forecastTip(entry);
  const spent = spentText(w);
  return html`<div class="q-card" tabindex="0" data-tip="${tip}" data-tip-tone="${tone}" aria-label="${flatTip(tip)}">
    <div class="q-top">
      <span class="q-lbl" title="${label}">${label}</span>
      <span class="q-reset">${resetLabel(w)}</span>
    </div>
    <div class="q-num">
      <b class="q-val" style="color:${barColor(w)}">${pctText(w.used)}</b>
      <span class="q-unit">${t('quota.usedUnit')}</span>
      ${spent ? html`<span class="q-spent">${spent}</span>` : ''}
    </div>
    ${quotaBar(w, { tall: true, labels: true })}
    ${say ? html`<div class="q-fc ${tone}"><span class="q-say">${say}</span></div>` : ''}
  </div>`;
}

/** Vì sao số bị cũ, nói theo đúng tầng đã tụt xuống — xem `collect/quota.js`. */
const DEGRADED_NOTE = {
  'no-auth': 'quota.noAuth',
  'token-expired': 'quota.tokenExpired',
  http: 'quota.httpFail',
  timeout: 'quota.offline',
  network: 'quota.offline',
};

/**
 * Khối hạn mức. Đứng đầu màn vì nó trả lời câu gấp nhất — "tôi sắp bị chặn chưa" —
 * còn mọi thứ dưới là chuyện đã rồi.
 *
 * Khi số cũ thì KHÔNG giấu đi mà nói rõ cũ bao lâu và sai về phía nào. Ẩn đi thì
 * người dùng mất luôn thông tin; hiện mà im lặng thì họ tưởng là số tươi.
 */
function quotaPanel(q, plan) {
  // Bậc gói đọc từ ĐĨA, hạn mức đọc từ mạng — nên nó vẫn nói được kể cả ở nhánh này,
  // lúc endpoint chết. Giấu nó đi cùng với hạn mức là gộp hai thứ hỏng độc lập làm một.
  const chip = planChip(plan, 'plan.tip.claude', { when: plan?.fetchedAt ? ago(Date.now() - plan.fetchedAt) : '—' });
  if (!q?.ok) {
    const why = q?.reason === 'missing' ? 'quota.missing' : q?.reason === 'empty' ? 'quota.warming' : 'quota.broken';
    return html`<section class="q-panel">
      <div class="q-head">${srcLabel('Claude', t('quota.titleTail'), chip)}</div>
      <p class="q-note">${t(DEGRADED_NOTE[q?.degraded] ?? why)}</p>
    </section>`;
  }

  const rows = windowsOf(q);
  const dead = rows.length > 0 && rows.every((r) => r.w.expired);
  // Chú thích cách đọc thanh chỉ có mặt khi chính các dấu nó giải thích có mặt — và
  // vạch tiến độ xuất hiện sớm hơn dự báo, ngay khi biết mốc reset.
  //
  // GẬP LẠI, mở mặc định là sai: đây là hướng dẫn đọc, học một lần rồi thôi, mà mỗi
  // lượt vào màn nó lại chiếm cả một khối ngay giữa mấy con số người ta thật sự tới xem.
  // `data-k` để trạng thái mở sống qua lượt vẽ lại 30 giây một lần.
  const marked = rows.some((r) => !r.w.expired && r.w.elapsedFrac != null);
  return html`<section class="q-panel">
    <div class="q-head">
      ${srcLabel('Claude', t('quota.titleTail'), chip)}
      <span class="q-age ${q.stale ? 'stale' : ''}"
        >${t(q.ageMs < JUST_NOW_MS ? 'quota.atFresh' : 'quota.at', { time: clock(q.at), age: ago(q.ageMs) })}</span
      >
    </div>
    <div class="q-grid">${rows.map(quotaCard)}</div>
    ${dead
      ? html`<p class="q-note">${t('quota.allExpired')}</p>`
      : html`${q.degraded ? html`<p class="q-note">${t(DEGRADED_NOTE[q.degraded] ?? 'quota.offline')}</p>` : ''}
          ${q.conservative ? html`<p class="q-note">${t('quota.conservative')}</p>` : ''}
          ${marked
            ? html`<details class="q-help" data-k="q:legend">
                <summary>${t('quota.forecastHelp')}</summary>
                ${quotaLegend()}
              </details>`
            : ''}`}
  </section>`;
}

/* ── Thẻ đầu màn ──────────────────────────────────────────────────────────── */

function kpis(u) {
  return html`<div class="player-stats" style="margin-bottom:18px">
    <div class="pstat">${ulabel(t('usage.kToday'))}<span class="v">${tok(u.today.out)}<small>${t('usage.outShort')}</small></span></div>
    <div class="pstat">${ulabel(t('usage.k7d'))}<span class="v">${tok(u.d7.out)}<small>${t('usage.outShort')}</small></span></div>
    <div class="pstat">${ulabel(t('usage.kCacheHit'))}<span class="v">${pctOf(u.cacheHit)}</span></div>
    <!-- Không có đuôi "ước tính" ở đây nữa: nhãn thẻ ĐÃ là "Ước tính 7 ngày", nên bản cũ
         viết đúng chữ ấy hai lần trong hai dòng liền nhau. Mấy thẻ kia cần đuôi vì "3.0M"
         trơ ra thì không biết là token hay gì; "$3.995" thì dấu $ đã nói xong. -->
    <div class="pstat flame">${ulabel(t('usage.kCost7d'))}<span class="v">${usd(u.d7.cost)}</span></div>
    <div class="pstat">${ulabel(t('usage.kRequests'))}<span class="v">${u.today.msgs}<small>/${u.requests}</small></span></div>
  </div>`;
}

/* ── Theo ngày ────────────────────────────────────────────────────────────── */

function chartCostByDay(u) {
  const data = u.series.map((d) => ({
    x: dmy(d.day),
    v: Number(d.cost.toFixed(2)),
    tip: t('usage.tipCostDay', { day: d.day, cost: usd(d.cost), msgs: d.msgs }),
  }));

  return card({
    title: t('usage.costByDay'),
    sub: t('usage.costByDaySub', { days: u.series.length, total: usd(u.all.cost) }),
    body: series({ id: 'usage-cost-day', data, color: COLOR.cost, fmt: (v) => usd(v) }),
    table: tableTwin(
      [t('usage.cDate'), t('usage.cCost'), t('usage.cRequests')],
      u.series.map((d) => [d.day, usd(d.cost), d.msgs]),
      'usage-cost-day',
    ),
  });
}

function chartOutByDay(u) {
  const data = u.series.map((d) => ({
    x: dmy(d.day),
    v: d.out,
    tip: t('usage.tipOutDay', { day: d.day, out: tok(d.out), total: tok(total(d)) }),
  }));

  return card({
    title: t('usage.outByDay'),
    sub: t('usage.outByDaySub', { total: tok(u.all.out) }),
    body: series({ id: 'usage-out-day', data, color: COLOR.out, fmt: tok }),
    table: tableTwin(
      [t('usage.cDate'), t('usage.cOut'), t('usage.cCacheRead')],
      u.series.map((d) => [d.day, tok(d.out), tok(d.cr)]),
      'usage-out-day',
    ),
  });
}

/* ── Hiệu quả ─────────────────────────────────────────────────────────────── */

/**
 * Bốn chart ở khối này khác mọi chart khác của màn ở một điểm: chúng đo TỈ SỐ, không đo
 * khối lượng. "$1.369 hôm 23/7" không nói được đắt hay rẻ — mẫu số nằm ở chart bên cạnh,
 * và phép chia thì không ai làm hộ. Đây là chỗ làm phép chia đó.
 *
 * Ba trong bốn chart đọc từ `u.eff`, tức là từ transcript CÒN SỐNG, nên chúng phủ hẹp hơn
 * hai chart theo ngày ở trên (vẽ từ sổ, giữ được cả ngày transcript đã bị dọn). `effNote`
 * nói ra chênh lệch đó — hai khối cạnh nhau mà lệch tầm nhìn, không khối nào nói, thì
 * người đọc sẽ trừ hai con số không trừ được cho nhau.
 */

/** Nhãn băng lượt. `hi === null` là băng hở phải — "101+", không phải "101–∞". */
const bandLabel = (b) => (b.hi == null ? `${b.lo}+` : `${b.lo}–${b.hi}`);

/**
 * Sàn để một ngày được tính vào chart TỈ SỐ.
 *
 * Ngày 12/7 trên máy này có đúng **một** lượt gọi và 75 token sinh ra — Claude Code đã dọn
 * gần hết transcript của ngày đó trước khi sổ kịp chốt. Tỉ số của nó ra $715 mỗi 1M, gấp
 * ba lần rưỡi mọi ngày còn lại, và nó nuốt trọn trục Y: mười bốn ngày thật bị ép thành một
 * vệt phẳng dưới đáy.
 *
 * Con số đó không sai — nó là phép chia đúng trên một mẫu duy nhất. Nhưng một tỉ số dựng
 * trên một lượt gọi không nói được gì về hiệu quả của ngày ấy, mà lại chiếm toàn bộ khả
 * năng đọc của chart. Nên ngày mỏng bị bỏ khỏi HÌNH, và sub-title đếm ra bao nhiêu ngày đã
 * bỏ — không lặng lẽ, vì lặng lẽ thì trục X hụt một ngày mà không ai biết vì sao.
 *
 * Hai điều kiện, không phải một: `msgs` chặn ngày một-hai lượt, `out` chặn ngày có nhiều
 * lượt nhưng toàn lượt ngắn (một buổi hỏi đáp vài chữ cũng cho tỉ số rất nhiễu).
 */
const MIN_DAY_MSGS = 10;
const MIN_DAY_OUT = 20_000;
const THICK = (d) => d.msgs >= MIN_DAY_MSGS && d.out >= MIN_DAY_OUT;

/**
 * Giá mỗi 1M token sinh ra, theo ngày — chỉ số hiệu quả duy nhất chuẩn hoá.
 *
 * Tử số và mẫu số đều đã có sẵn trong `series` (từ SỔ, nên phủ trọn 15 ngày); tới bản này
 * mới có ai chia chúng cho nhau. Vạch mốc là TRUNG VỊ của chính máy này, không phải một
 * ngưỡng nhập từ đâu: không có "giá đúng" cho một token sinh ra, chỉ có "hôm nay đắt hơn
 * thường lệ của bạn hay không".
 */
function chartUnitCost(u) {
  const unit = (d) => (d.cost / d.out) * 1e6;
  const thick = u.series.filter(THICK);
  if (thick.length < 2) return '';
  const mid = median(thick.map(unit));
  const thin = u.series.filter((d) => d.msgs > 0 && !THICK(d)).length;

  const data = thick.map((d) => ({
    x: dmy(d.day),
    v: Number(unit(d).toFixed(2)),
    tip: t('usage.tipUnitDay', { day: d.day, unit: usd(unit(d)), cost: usd(d.cost), out: tok(d.out) }),
  }));

  // Trị trung vị KHÔNG lặp lại ở phụ đề: `refLine` đã in nó ngay trên vạch, mà vạch còn
  // nói thêm được thứ phụ đề không nói nổi — nó nằm ở đâu so với từng cột. In cả hai chỗ
  // là bắt mắt đi kiểm xem "$211" trên kia với "$211" dưới này có phải một số không, và
  // câu trả lời luôn là có. Cùng luật với thẻ hạn mức, xem `quotaCard`.
  return card({
    title: t('usage.unitByDay'),
    sub: thin ? t('usage.unitByDaySubThin', { thin, min: tok(MIN_DAY_OUT) }) : t('usage.unitByDaySub'),
    body: series({ id: 'usage-unit-day', data, color: COLOR.unit, fmt: usd, ref: { v: mid, label: t('usage.refMedian') } }),
    table: tableTwin(
      [t('usage.cDate'), t('usage.cUnit'), t('usage.cCost'), t('usage.cOut')],
      // Bảng số giữ CẢ ngày mỏng, với dấu "—" ở cột tỉ số: chart bỏ chúng ra khỏi HÌNH,
      // không bỏ chúng ra khỏi sự thật. Ai đi đối chiếu vẫn phải thấy ngày đó có mặt.
      u.series.filter((d) => d.msgs > 0).map((d) => [d.day, THICK(d) ? usd(unit(d)) : '—', usd(d.cost), tok(d.out)]),
      'usage-unit-day',
    ),
  });
}

/**
 * Ngữ cảnh phình theo lượt — câu trả lời cho "lãng phí âm thầm ở đâu".
 *
 * Cột đo NGỮ CẢNH ĐỌC (trung vị), không đo tiền: tiền của một băng còn phụ thuộc băng ấy
 * có bao nhiêu lượt, mà băng cuối hở phải nên nó đông hơn hẳn — cột tiền sẽ cao vì đông,
 * và người đọc sẽ tưởng đó là phát hiện. Ngữ cảnh trung vị thì miễn nhiễm với chuyện đông
 * hay thưa: nó nói "một lượt điển hình ở khúc này to bằng này".
 *
 * Tiền và giá đơn vị vẫn còn nguyên trong tooltip và bảng số — chúng là kết luận, còn cột
 * là nguyên nhân, và đặt kết luận lên cột thì mất chỗ để nói nguyên nhân.
 */
function chartCtxByTurn(u) {
  const bands = u.eff?.turns?.bands ?? [];
  if (bands.length < 2 || !bands.some((b) => b.msgs > 0)) return '';
  const first = bands[0];
  const last = bands.at(-1);

  const data = bands.map((b) => ({
    x: bandLabel(b),
    v: b.ctxMedian,
    tip: t('usage.tipTurnBand', {
      band: bandLabel(b),
      ctx: tok(b.ctxMedian),
      unit: b.unit == null ? '—' : usd(b.unit),
      cost: usd(b.cost),
      msgs: b.msgs,
    }),
  }));

  return card({
    title: t('usage.ctxByTurn'),
    sub:
      first.unit && last.unit
        ? t('usage.ctxByTurnSub', {
            sessions: u.eff.turns.sessions,
            min: u.eff.turns.minTurns,
            a: usd(first.unit),
            b: usd(last.unit),
            x: (last.unit / first.unit).toFixed(1),
          })
        : t('usage.ctxByTurnPlain', { sessions: u.eff.turns.sessions, min: u.eff.turns.minTurns }),
    body: series({ id: 'usage-turn-ctx', data, color: COLOR.ctx, fmt: tok }),
    table: tableTwin(
      [t('usage.cTurnBand'), t('usage.cCtxMedian'), t('usage.cUnit'), t('usage.cCost'), t('usage.cRequests')],
      bands.map((b) => [bandLabel(b), tok(b.ctxMedian), b.unit == null ? '—' : usd(b.unit), usd(b.cost), b.msgs]),
      'usage-turn-ctx',
    ),
  });
}

/**
 * Nhãn trục X chỉ đặt ở chỗ ĐỔI NGÀY, và chỉ khi còn đủ chỗ.
 *
 * Dùng chung cho hai chart có nhiều mốc trên mỗi ngày (phiên: ~19/ngày, chu kỳ 5 giờ:
 * ~4/ngày). Ghi ngày lên mọi cột thì cùng một chuỗi "24/7" lặp hàng chục lần cạnh nhau.
 *
 * Nhưng "đổi ngày" là chuyện của DỮ LIỆU còn chồng chữ là chuyện của PIXEL: một ngày chỉ
 * có ba mốc thì mốc đổi ngày của nó cách mốc trước 3 cột, tức ~7px, và hai nhãn dính thành
 * "23/24/7". `xLabels` không đỡ được ca này — nó thấy bốn nhãn, dưới trần tám, nên giữ cả
 * bốn. Nên chỗ gọi tự giữ khoảng: biết mình vẽ bao nhiêu cột thì biết bao nhiêu cột là đủ
 * xa. Mốc bị bỏ nhãn vẫn còn nguyên ngày tháng trong tooltip và bảng số.
 */
function dayMarks(list, tsOf) {
  const minGap = Math.ceil(list.length / 8);
  let lastDay = null;
  let lastAt = -Infinity;
  return list.map((item, i) => {
    const day = new Date(tsOf(item)).toISOString().slice(0, 10);
    const fresh = day !== lastDay && i - lastAt >= minGap;
    if (fresh) lastAt = i;
    lastDay = day;
    return fresh ? dmy(day) : '';
  });
}

/** Nhãn băng tỉ số. `lo === 0` là băng hở trái — "<80×", không phải "0–80×". */
const ratioLabel = (b) => (b.hi == null ? `${b.lo}×+` : b.lo === 0 ? `<${b.hi}×` : `${b.lo}–${b.hi}×`);

/**
 * Phân bố `ngữ cảnh / sinh ra` theo phiên — cái đuôi, và giá của nó.
 *
 * Chart "chi phí từng phiên" ngay bên cạnh đã có tỉ số này, nhưng mỗi phiên một tooltip:
 * muốn biết có bao nhiêu phiên đang lết thì phải rê qua trăm cột và tự đếm. Đây là phép
 * đếm đó, làm sẵn.
 *
 * ## Cột đo TIỀN, và ở đây điều đó KHÔNG phải cái bẫy như ở chart băng lượt
 *
 * `chartCtxByTurn` cố ý không để tiền lên cột: băng cuối hở phải nên nó đông hơn hẳn, và
 * cột tiền cao vì đông sẽ bị đọc thành một phát hiện. Ở đây câu hỏi ĐÃ LÀ "cái đuôi ăn bao
 * nhiêu tiền", nên tiền chính là trả lời, không phải nhiễu — và số phiên, thứ có thể gây
 * hiểu lầm, được nói ra ngay trong tooltip và bảng số.
 *
 * Đi thẳng `hbars` chứ không qua `ranked`, cùng lý do với chart hâm-lại-cache: băng $0 phải
 * còn một hàng. "Không có phiên nào trên 300×" là một trong những kết luận tốt nhất chart
 * này có thể đưa ra, mà quạt tròn và treemap dựng từ diện tích nên mảnh 0 biến mất.
 */
function chartRatioDist(u) {
  const r = u.eff?.ratio;
  if (!r?.bands?.length || r.sessions < 4) return '';
  const tail = r.bands.at(-1);

  const rows = r.bands.map((b) => ({
    label: ratioLabel(b),
    v: Number(b.cost.toFixed(2)),
    tip: t('usage.tipRatioBand', {
      band: ratioLabel(b),
      sessions: b.sessions,
      cost: usd(b.cost),
      share: pctOf(b.share),
      out: tok(b.out),
    }),
  }));

  return card({
    title: t('usage.ratioDist'),
    sub: r.thin
      ? t('usage.ratioDistSubThin', { n: r.sessions, mid: Math.round(r.median), share: pctOf(tail.share), thin: r.thin, min: tok(r.minOut) })
      : t('usage.ratioDistSub', { n: r.sessions, mid: Math.round(r.median), share: pctOf(tail.share) }),
    body: html`${hbars({ rows, color: COLOR.ctx, fmt: usd })}
      <p class="ch-note">${raw(t('usage.ratioDistCap'))}</p>`,
    table: tableTwin(
      [t('usage.cRatioBand'), t('usage.cSessions'), t('usage.cCost'), t('usage.cShare'), t('usage.cOut')],
      r.bands.map((b) => [ratioLabel(b), b.sessions, usd(b.cost), pctOf(b.share), tok(b.out)]),
      'usage-ratio',
    ),
  });
}

/**
 * Chi phí từng phiên, mới nhất bên phải — chỗ đột biến lộ ra.
 *
 * Theo PHIÊN chứ không theo ngày: một ngày gộp năm phiên thì phiên vọt lên bị pha loãng
 * thành một cột hơi cao. Nhãn trục X đi qua `dayMarks` — xem hàm đó.
 *
 * Cột nói tiền, tooltip nói `ctx/out` — hai phiên cùng $80 mà một cái 130× còn một cái
 * 380× là hai chuyện khác nhau: cái đầu làm nhiều, cái sau đọc lại nhiều. Không đưa tỉ số
 * ấy lên cột được (chart chỉ có một trục), nhưng nó phải ở ngay đó khi rê vào. Phân bố của
 * chính tỉ số ấy là chart ngay bên cạnh (`chartRatioDist`).
 */
function chartSessionCost(u) {
  const list = (u.eff?.sessions?.recent ?? []).slice().reverse();
  if (list.length < 2) return '';
  const st = u.eff.sessions.stats;

  const marks = dayMarks(list, (s) => s.t0);
  const data = list.map((s, i) => {
    return {
      x: marks[i],
      v: Number(s.cost.toFixed(2)),
      tip: t('usage.tipSession', {
        project: s.project ?? '—',
        at: clock(s.t0),
        cost: usd(s.cost),
        msgs: s.msgs,
        out: tok(s.out),
        ratio: s.ctxPerOut == null ? '—' : `${Math.round(s.ctxPerOut)}×`,
        dur: ago(Math.max(0, s.t1 - s.t0)),
      }),
    };
  });

  return card({
    title: t('usage.bySession'),
    sub: t('usage.bySessionSub', { shown: list.length, n: st.n, mid: usd(st.medianCost), share: pctOf(st.top10Share) }),
    body: series({ id: 'usage-session', data, color: COLOR.cost, fmt: usd }),
    table: tableTwin(
      [t('usage.cProject'), t('usage.cStart'), t('usage.cCost'), t('usage.cRequests'), t('usage.cOut'), t('usage.cRatio')],
      u.eff.sessions.top.map((s) => [
        s.project ?? '—',
        `${new Date(s.t0).toISOString().slice(5, 10)} ${clock(s.t0)}`,
        usd(s.cost),
        s.msgs,
        tok(s.out),
        s.ctxPerOut == null ? '—' : `${Math.round(s.ctxPerOut)}×`,
      ]),
      'usage-session',
    ),
  });
}

/**
 * Hâm lại cache sau khi nghỉ — mảng lãng phí duy nhất ở màn này gọi được đúng tên "bỏ phí".
 *
 * Xếp theo BĂNG NGHỈ, không theo dự án hay ngày: câu duy nhất chart này trả lời được là
 * "nghỉ cỡ nào thì tốn", và đó cũng là câu duy nhất dẫn tới một hành động.
 *
 * ## Băng rỗng phải VẼ RA, nên chart này KHÔNG đi qua `ranked()`
 *
 * Trên máy này 95% cache ghi ở mức TTL 1 giờ, nên hai băng dưới một giờ đúng bằng 0 — và
 * "nghỉ 40 phút không tốn gì" là một trong hai kết luận hữu ích nhất của cả chart. `ranked`
 * chọn hình theo phong cách, mà quạt tròn và treemap đều dựng từ DIỆN TÍCH: mảnh 0% không
 * có diện tích nên nó biến mất, kéo theo đúng cái kết luận ấy. Còn lại là hai băng dài
 * trông như thể mọi lần nghỉ đều phải trả giá — nghĩa ngược.
 *
 * Nên nó gọi thẳng `hbars`: thanh dài 0 vẫn còn một hàng, một cái tên và một số `$0`.
 * Đây là chỗ hiếm mà "không có gì" là dữ liệu, không phải chỗ trống.
 */
function chartRewarm(u) {
  const rw = u.eff?.rewarm;
  if (!rw || rw.extra <= 0) return '';

  const rows = rw.bands.map((b) => ({
    label: t(`usage.gap${b.key}`),
    v: Number(b.cost.toFixed(2)),
    tip: t('usage.tipRewarm', { band: t(`usage.gap${b.key}`), cost: usd(b.cost), calls: b.calls, tokens: tok(b.tokens) }),
  }));

  // "95% cache ghi ở TTL 1 giờ" từng là hằng số CHÉP TAY trong chuỗi dịch. Nó đúng vào
  // ngày viết câu đó và không có gì bảo đảm ngày mai còn đúng — một câu UI khẳng định về
  // máy người dùng thì phải đo từ chính máy đó. Cùng lý do đã gỡ "$1.369" và "trung vị
  // nằm ở băng giữa" khỏi khối hướng dẫn.
  const cw = u.all.cw1 + u.all.cw5;
  return card({
    title: t('usage.rewarm'),
    sub: t('usage.rewarmSub', { extra: usd(rw.extra), share: pctOf(u.all.cost > 0 ? rw.extra / u.all.cost : 0), calls: rw.calls }),
    body: html`${hbars({ rows, color: COLOR.waste, fmt: usd })}
      <p class="ch-note">${raw(t('usage.rewarmCap', { ttl1: pctOf(cw > 0 ? u.all.cw1 / cw : 0) }))}</p>`,
    table: tableTwin(
      [t('usage.cGap'), t('usage.cExtra'), t('usage.cRequests'), t('usage.cTokens')],
      rw.bands.map((b) => [t(`usage.gap${b.key}`), usd(b.cost), b.calls, tok(b.tokens)]),
      'usage-rewarm',
    ),
  });
}

/**
 * Subagent, một DÒNG — không phải một chart.
 *
 * Trên máy này subagent chiếm 1,6% tiền. Một chart cho 1,6% là cho nó tầm quan trọng nó
 * không có, đúng cái lỗi mà `stripRows` ở `lib/quota.js` tránh. Nhưng TỈ SỐ thì đáng nói:
 * mỗi 1M token sinh ra của subagent đắt gấp mười lượt chính, vì subagent đọc cả một đống
 * ngữ cảnh rồi trả về một đoạn ngắn. Đó là bản chất của nó, và biết con số ấy thì mới
 * quyết được lúc nào nên tách subagent ra, lúc nào làm thẳng thì rẻ hơn.
 */
function sideNote(u) {
  const sp = u.eff?.split;
  if (!sp?.side?.calls || sp.side.unit == null || sp.main.unit == null) return '';
  return html`<p class="ch-note">
    ${t('usage.sideNote', {
      calls: sp.side.calls,
      cost: usd(sp.side.cost),
      share: pctOf(u.all.cost > 0 ? sp.side.cost / u.all.cost : 0),
      unit: usd(sp.side.unit),
      main: usd(sp.main.unit),
      x: (sp.side.unit / sp.main.unit).toFixed(1),
    })}
  </p>`;
}

/**
 * Cách đọc màn này — MỘT khối, và là khối duy nhất trên màn làm việc dạy.
 *
 * Trước bản này cùng một bài học được kể ở bốn chỗ: `usage.note` dưới hai chart đầu, khối
 * này ở đầu mục "có đáng không", `effNote` dưới mục đó, cộng ba chú thích dưới từng chart.
 * Bốn chỗ ấy chồng lên nhau ở đúng bốn ý — "$ không phải hoá đơn", "cột đo tiền chứ không
 * đo số phiên", "nghỉ ngắn gần như không tốn", "khác khoảng phủ nên đừng trừ hai bên" —
 * mỗi ý viết lại bằng một lối khác, nên người mới phải đọc hết cả bốn mới nhận ra chúng
 * nói cùng một chuyện. Đó là toàn bộ lý do màn này đọc mệt: không phải nhiều chart, mà là
 * mỗi chart đều dạy một lượt trước khi cho xem.
 *
 * Giờ mọi câu DẠY nằm ở đây. Thứ còn ở lại dưới chart chỉ có hai loại, và cả hai đều
 * không lặp lại được: số ĐO ĐƯỢC từ dữ liệu (khoảng phủ, số ngày hụt, thống kê quét), và
 * đúng một câu cảnh báo đọc-sai riêng của chart đó, cắt còn một dòng.
 *
 * `<dt>` lấy thẳng khoá TIÊU ĐỀ của chart chứ không giữ bản chép riêng: bản cũ có năm
 * chuỗi `effh*` trùng từng ký tự với năm tiêu đề, tức là mười chuỗi cho năm cái tên qua
 * hai ngôn ngữ, và lần đổi tiêu đề tiếp theo sẽ làm khối này gọi tên một chart không còn
 * tồn tại.
 *
 * GẬP LẠI, và đứng NGAY SAU thẻ tóm tắt. Hướng dẫn thì học một lần rồi thôi — mở sẵn là
 * đẩy toàn bộ số xuống dưới màn hình — nhưng phải nằm TRƯỚC thứ nó hướng dẫn mới có tác
 * dụng. `data-k` giữ trạng thái mở qua lượt vẽ lại 30 giây một lần.
 */
function howToRead() {
  // Bảng thuật ngữ đứng ĐẦU, trước cả câu dẫn. Bốn chữ này có mặt ở gần như mọi phụ đề,
  // tooltip và cột bảng của màn — người đọc vấp phải chúng ngay dòng đầu tiên, nên định
  // nghĩa phải đến trước phần nói chart nào đo gì. Đây là chỗ trả lời câu hỏi thẳng của
  // người dùng: "phần việc làm ra là gì?"
  const gloss = [
    ['usage.glossOut', 'usage.glossOutBody'],
    ['usage.glossCtx', 'usage.glossCtxBody'],
    ['usage.glossCall', 'usage.glossCallBody'],
    ['usage.glossSession', 'usage.glossSessionBody'],
  ];
  const rows = [
    ['usage.unitByDay', 'usage.effhUnitBody'],
    ['usage.ctxByTurn', 'usage.effhCtxBody'],
    ['usage.bySession', 'usage.effhSessionBody'],
    ['usage.ratioDist', 'usage.effhRatioBody'],
    ['usage.rewarm', 'usage.effhRewarmBody'],
  ];
  const keys = (list) => html`<dl class="eff-keys">
    ${list.map(([name, body]) => html`<dt>${t(name)}</dt>
      <dd>${raw(t(body))}</dd>`)}
  </dl>`;
  return html`<details class="q-help eff-help" data-k="usage:howto">
    <summary>${t('usage.effHelp')}</summary>
    <div class="eff-lgd">
      <p class="q-note"><b>${t('usage.glossTitle')}</b></p>
      ${keys(gloss)}
      <p class="q-note">${raw(t('usage.note'))}</p>
      <p class="q-note">${raw(t('usage.effHelpIntro'))}</p>
      ${keys(rows)}
      <p class="q-note">${raw(t('usage.effHelpDont'))}</p>
    </div>
  </details>`;
}

/**
 * Khoảng phủ của khối hiệu quả, nói ra vì nó HẸP HƠN các chart theo ngày.
 *
 * Cùng tinh thần với `coverageNote`: chỗ mù được gọi tên chứ không để một con số nhỏ hơn
 * tự đọc thành "dạo này dùng ít đi".
 */
function effNote(u) {
  const e = u.eff;
  if (!e?.ok || !e.from) return '';
  return html`<p class="ch-note">${t('usage.effNote', { from: e.from, to: e.to, n: e.requests })}</p>`;
}

/* ── Hạn mức từng chu kỳ ──────────────────────────────────────────────────── */

/** Tên loại cửa sổ. `m:` là hạn mức tuần riêng theo model — xem `windowsIn` ở server. */
function cycleKindLabel(kind) {
  if (kind === 'five') return t('quota.fiveHour');
  if (kind === 'seven') return t('quota.sevenDay');
  return t('quota.scoped', { model: kind.slice(2) });
}

/**
 * Bỏ phí hạn mức, theo chu kỳ đã chốt.
 *
 * Thẻ hạn mức ở đầu màn trả lời cho chu kỳ ĐANG chạy: "còn 78% chưa dùng, reset sau 4 giờ".
 * Chart này trả lời câu mà một cái thẻ không bao giờ trả lời được — **có thành nếp không**.
 * Một chu kỳ bỏ phí 78% là chuyện của hôm nay; hai mươi chu kỳ liền bỏ phí 78% là một cách
 * làm việc, và chỉ có lịch sử nói ra được sự khác nhau đó.
 *
 * ## Cột đo BỎ PHÍ, không đo đã tiêu
 *
 * Hai con số là phần bù của nhau nên vẽ cái nào cũng "đủ thông tin" — nhưng chúng không đọc
 * ra như nhau. Cột "đã tiêu" thấp trông như tin tốt (tiết kiệm), trong khi hạn mức không
 * cộng dồn nên phần chưa dùng lúc reset là thứ đã trả tiền rồi bốc hơi. Đặt đúng thứ đáng
 * giảm lên cột thì hình mới nói cùng một chiều với sự thật, và nó dùng đúng sắc cảnh báo
 * của mảng bỏ phí trên thanh hạn mức — hai chỗ cùng nói một chuyện thì phải cùng một màu.
 *
 * ## Chu kỳ theo dõi chưa đủ bị bỏ khỏi HÌNH, không bỏ khỏi sự thật
 *
 * Dashboard chỉ lấy được số khi nó đang mở, nên đỉnh của một chu kỳ chỉ được theo tới 40%
 * là cận DƯỚI, và "bỏ phí" suy từ đó là cận TRÊN — nó sẽ vẽ ra một cột cao mà không có gì
 * bảo đảm. Cùng cách xử lý với ngày quá mỏng ở chart đơn giá: bỏ khỏi hình, giữ trong bảng
 * số kèm cột độ phủ, và đếm ra bao nhiêu chu kỳ đã bỏ.
 */
function chartQuotaCycles(qc) {
  const all = qc?.cycles ?? [];
  const byKind = new Map();
  for (const c of all) {
    if (!byKind.has(c.kind)) byKind.set(c.kind, []);
    byKind.get(c.kind).push(c);
  }
  // Loại cửa sổ có nhiều chu kỳ đã chốt nhất được lên hình. Trên thực tế luôn là khung 5
  // giờ (chốt ~4 lần/ngày); khung 7 ngày phải chờ hàng tuần mới đủ hai cột để so.
  const best = [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const solid = (best?.[1] ?? []).filter((c) => !c.partial);

  const table = tableTwin(
    [t('usage.cCycle'), t('usage.cCycleEnd'), t('usage.cUsedPct'), t('usage.cWastePct'), t('usage.cWatched')],
    // Bảng giữ MỌI loại cửa sổ và cả chu kỳ theo dõi chưa đủ: khung 7 ngày chỉ sống ở đây
    // cho tới khi nó chốt đủ hai lần, và ai đi đối chiếu vẫn phải thấy chu kỳ bị bỏ.
    all
      .slice()
      .reverse()
      .map((c) => [
        cycleKindLabel(c.kind),
        `${new Date(c.resetsAt).toISOString().slice(5, 10)} ${clock(c.resetsAt)}`,
        pctOf(c.used / 100),
        pctOf(c.waste / 100),
        `${c.watchedTo == null ? '—' : pctOf(c.watchedTo)}${c.partial ? ' ⚠' : ''}`,
      ]),
    'usage-cycle',
  );

  // Chưa đủ hai chu kỳ đủ tin thì KHÔNG vẽ một cột lẻ trông như một chart. Nói ra sổ vừa
  // bắt đầu ghi và bao giờ thì có hình — im lặng ở đây bị đọc thành "không bỏ phí gì".
  //
  // Sổ còn TRỐNG TRƠN thì cả cái vỏ cũng thừa: một tiêu đề mục, một thẻ chart và bốn dòng
  // văn, tất cả để nói "chưa có gì". `renderUsage` nhận `warming` rồi thu cả mục thành một
  // dòng. Có chu kỳ nào rồi thì giữ thẻ, vì lúc đó bảng số đã mang dữ liệu thật.
  if (solid.length < 2) {
    if (!all.length) return { warming: true, closed: 0 };
    return {
      node: card({
        title: t('usage.cycleWaste'),
        sub: t('usage.cycleWarmingSub'),
        body: html`<p class="ch-note">${raw(t('usage.cycleWarming', { closed: all.length }))}</p>`,
        table,
      }),
    };
  }

  const mid = median(solid.map((c) => c.waste));
  const marks = dayMarks(solid, (c) => c.resetsAt);
  const data = solid.map((c, i) => ({
    x: marks[i],
    v: Number(c.waste.toFixed(1)),
    tip: t('usage.tipCycle', {
      kind: cycleKindLabel(c.kind),
      end: `${new Date(c.resetsAt).toISOString().slice(5, 10)} ${clock(c.resetsAt)}`,
      used: pctOf(c.used / 100),
      waste: pctOf(c.waste / 100),
      watched: c.watchedTo == null ? '—' : pctOf(c.watchedTo),
      samples: c.samples,
    }),
  }));

  const dropped = (best?.[1]?.length ?? 0) - solid.length;
  // Trung vị chỉ in ở vạch mốc, không in lại ở phụ đề — cùng lý do với chart đơn giá.
  return {
    node: card({
      title: t('usage.cycleWaste'),
      sub: dropped
        ? t('usage.cycleWasteSubThin', { kind: cycleKindLabel(best[0]), n: solid.length, dropped })
        : t('usage.cycleWasteSub', { kind: cycleKindLabel(best[0]), n: solid.length }),
      body: html`${series({ id: 'usage-cycle', data, color: COLOR.waste, fmt: (v) => pctOf(v / 100), ref: { v: mid, label: t('usage.refMedian') } })}
        <p class="ch-note">${raw(t('usage.cycleCap', { watched: pctOf(qc?.watchedEnough ?? 0.9) }))}</p>`,
      table,
    }),
  };
}

/* ── Phân bổ ──────────────────────────────────────────────────────────────── */

/**
 * Tiền đi đâu, tách theo model VÀ theo loại token.
 *
 * Bốn mảnh dùng CHUNG một thang nên so được model này với model kia; và vì mảnh
 * đo bằng TIỀN chứ không phải số token, cache đọc co lại đúng bằng trọng số thật
 * của nó (một phần mười giá input) thay vì nuốt trọn thanh.
 */
function chartCostByModel(u) {
  const kinds = [
    { k: 'out', color: COLOR.out, label: t('usage.partOut') },
    { k: 'cw', color: COLOR.cacheWrite, label: t('usage.partCacheWrite') },
    { k: 'cr', color: COLOR.cacheRead, label: t('usage.partCacheRead') },
    { k: 'in', color: COLOR.input, label: t('usage.partInput') },
  ];

  // Không có giá từng loại tách sẵn từ server, nên chia phần tiền theo TRỌNG SỐ
  // token đã nhân hệ số: output ×5 so với input, cache ghi ×1,25–2, cache đọc
  // ×0,1. Cùng bộ hệ số mà `costOf` dùng, nên tổng bốn mảnh khớp cột tiền.
  const weigh = (m) => ({
    out: m.out * 5,
    cw: m.cw5 * 1.25 + m.cw1 * 2,
    cr: m.cr * 0.1,
    in: m.inTok,
  });

  const rows = u.models
    .filter((m) => m.cost > 0)
    .map((m) => {
      const w = weigh(m);
      const sum = kinds.reduce((n, x) => n + w[x.k], 0) || 1;
      return {
        label: m.key.replace(/^claude-/, ''),
        total: Number(m.cost.toFixed(2)),
        parts: kinds.map((x) => ({
          v: Number(((w[x.k] / sum) * m.cost).toFixed(4)),
          color: x.color,
          // `x.label` giữ nguyên hoa/thường: nó là NHÃN của một hàng trong tooltip, không
          // còn là một mẩu ghép giữa câu như hồi tooltip là văn xuôi.
          tip: t('usage.tipModelPart', { model: m.key, kind: x.label, cost: usd((w[x.k] / sum) * m.cost) }),
        })),
        m,
      };
    });
  if (!rows.length) return '';

  return card({
    title: t('usage.costByModel'),
    sub: t('usage.costByModelSub'),
    body: html`${stackedRows({ rows, fmt: usd })}${legend(kinds.map((x) => ({ color: x.color, label: x.label })))}`,
    table: tableTwin(
      [t('usage.cModel'), t('usage.cRequests'), t('usage.cOut'), t('usage.cCacheRead'), t('usage.cCost')],
      rows.map((r) => [r.label, r.m.msgs, tok(r.m.out), tok(r.m.cr), usd(r.m.cost)]),
      'usage-model',
    ),
  });
}

function chartByProject(u) {
  const rows = u.projects.slice(0, 12).map((p) => ({
    label: p.key,
    v: p.out,
    tip: t('usage.tipProject', { name: p.key, out: tok(p.out), cost: usd(p.cost), msgs: p.msgs }),
  }));
  if (!rows.length) return '';

  const orphans = u.projects.filter((p) => p.orphan).length;
  return card({
    title: t('usage.byProject'),
    sub: orphans ? t('usage.byProjectSubOrphan', { n: orphans }) : t('usage.byProjectSub'),
    body: ranked({ id: 'usage-project', rows, color: COLOR.project, fmt: tok }),
    table: tableTwin(
      [t('usage.cProject'), t('usage.cRequests'), t('usage.cOut'), t('usage.cCost')],
      u.projects.map((p) => [p.key, p.msgs, tok(p.out), usd(p.cost)]),
      'usage-project',
    ),
  });
}

/* ── Ai gọi ra ────────────────────────────────────────────────────────────── */

/**
 * Quy trách nhiệm: transcript gắn nhãn `attributionMcpServer` / `attributionSkill`
 * / `attributionPlugin` cho từng lượt gọi, nên trả lời được câu "cái MCP nào đang
 * ăn token của tôi" — thứ không suy ra được từ bất kỳ chỗ nào khác.
 *
 * Lưu ý khi đọc: đây là token của những lượt CÓ nhãn, không phải toàn bộ. Phần
 * lớn lượt gọi không đến từ MCP hay skill nào cả, nên tổng ở đây luôn nhỏ hơn
 * tổng thật — sub-title nói ra tỉ lệ đó.
 */
function chartAttribution(u, key, titleKey, subKey, tableKey) {
  const list = u[key] ?? [];
  const rows = list.slice(0, 10).map((x) => ({
    label: x.key,
    v: x.out,
    tip: t('usage.tipAttribution', { name: x.key, out: tok(x.out), cost: usd(x.cost), msgs: x.msgs }),
  }));
  if (!rows.length) return '';

  const labelled = list.reduce((n, x) => n + x.out, 0);
  return card({
    title: t(titleKey),
    sub: t(subKey, { n: list.length, share: pctOf(u.all.out ? labelled / u.all.out : 0) }),
    body: ranked({ id: tableKey, rows, color: COLOR.attribution, fmt: tok }),
    table: tableTwin(
      [t('usage.cName'), t('usage.cRequests'), t('usage.cOut'), t('usage.cCost')],
      list.map((x) => [x.key, x.msgs, tok(x.out), usd(x.cost)]),
      tableKey,
    ),
  });
}

/**
 * Tên bề mặt, thay cho nhãn máy.
 *
 * Transcript ghi `claude-vscode` cho CẢ VS Code lẫn Cursor lẫn mọi bản fork khác — một
 * cái tên cho ba cái editor. Bản trước gọi nó là "Cursor / VS Code", tức là thú nhận
 * không phân biệt được; giờ `collect/hosts.js` chốt app chủ của từng phiên vào sổ, nên
 * hàng nào có trong sổ thì đứng dưới đúng tên editor của nó.
 *
 * Hàng chưa có trong sổ vẫn giữ nhãn thô và được gọi là "Editor chưa rõ" — sổ mới bắt
 * đầu ghi từ bản này, nên phần lịch sử cũ sẽ nằm ở đó một thời gian rồi teo dần. Nói
 * ra chỗ mù còn hơn gộp nó vào một cái tên nghe như đã biết.
 */
const entryLabel = (k) => surfaceName(k);

function chartEntrypoints(u) {
  const rows = u.entrypoints.map((e) => ({
    label: entryLabel(e.key),
    v: e.out,
    tip: t('usage.tipEntry', { name: entryLabel(e.key), out: tok(e.out), cost: usd(e.cost) }),
  }));
  if (!rows.length) return '';

  // Bao nhiêu token vẫn chưa quy được về editor nào. Nói ra tỉ lệ đó chứ không lặng lẽ
  // để một cột tên "Editor chưa rõ" đứng đấy — người đọc cần biết nó là chỗ mù của
  // dashboard, không phải một cái editor có thật.
  const vague = u.entrypoints.filter((e) => e.key === 'claude-vscode').reduce((n, e) => n + e.out, 0);

  return card({
    title: t('usage.byEntrypoint'),
    sub: html`${t('usage.byEntrypointSub')}${vague
      ? html`. ${t('usage.byEntrypointVague', { share: pctOf(u.all.out ? vague / u.all.out : 0) })}`
      : ''}`,
    body: ranked({ id: 'usage-entry', rows, color: COLOR.project, fmt: tok }),
    table: tableTwin(
      [t('usage.cEntry'), t('usage.cRequests'), t('usage.cOut'), t('usage.cCost')],
      // Bảng số giữ CẢ nhãn máy: đó là chuỗi thật trong transcript, cần cho lúc đi
      // đối chiếu bằng grep.
      u.entrypoints.map((e) => [`${entryLabel(e.key)} (${e.key})`, e.msgs, tok(e.out), usd(e.cost)]),
      'usage-entry',
    ),
  });
}

/* ── Màn ──────────────────────────────────────────────────────────────────── */

/**
 * Cảnh báo về độ phủ dữ liệu.
 *
 * Claude Code tự xoá transcript cũ, nên "không có dữ liệu trước ngày X" là hiện
 * tượng của cơ chế dọn dẹp, KHÔNG phải là "hồi đó không dùng". Nói ra chỗ hụt —
 * đúng tinh thần `coverage()` của màn Thống kê — thay vì để cột trống tự nói dối.
 */
function coverageNote(u) {
  const r = u.retention;
  if (!r.firstToken || !r.oldestInRollup || r.oldestInRollup <= r.firstToken) return '';
  const lost = Math.round((Date.parse(r.oldestInRollup) - Date.parse(r.firstToken)) / 86400000);
  if (lost <= 0) return '';
  return t('usage.gap', { lost, first: r.firstToken, oldest: r.oldestInRollup });
}

/**
 * Tấm Claude — mười hai chart, năm mục, và cả bài hướng dẫn đọc.
 *
 * Đây là phần cồng kềnh nhất màn, và đó chính là lý do nó phải nằm trong một tấm: trước khi
 * có tab, ai vào màn này để xem hạn mức Cursor đều phải cuộn qua trọn vẹn khối này trước.
 */
function claudeTab(s) {
  const u = s.usage;
  if (!u?.ok) return empty('◈', t('usage.broken'), u?.error ?? t('usage.brokenHint'));
  if (!u.requests) return empty('◈', t('usage.empty'), t('usage.emptyHint'));

  const cycles = chartQuotaCycles(s.quotaCycles);

  return html`${kpis(u)}
    ${dataAt(s.generatedAt)}
    ${howToRead()}

    <div class="sec-h">${ulabel(t('usage.flowSection'))}</div>
    <div class="ch-grid2">${chartCostByDay(u)}${chartOutByDay(u)}</div>
    <!-- Chỉ còn chỗ hụt ĐO ĐƯỢC ở lại đây. Bài giảng "$ là ước tính chứ không phải hoá
         đơn" từng đứng ngay chỗ này, dài gấp bốn lần câu này, và được kể lại nguyên ý ở
         khối hướng dẫn phía trên lẫn trong báo cáo dán được — ba bản của một câu. Nó về
         với khối hướng dẫn; số ngày hụt thì đổi theo dữ liệu nên phải ở lại cạnh chart. -->
    ${coverageNote(u) ? html`<p class="ch-note">${coverageNote(u)}</p>` : ''}

    <!-- Khối hiệu quả đứng NGAY SAU dòng chảy theo ngày, trước phần phân bổ: hai chart
         trên vừa nói "tiêu bao nhiêu", và câu tiếp theo của cùng một mạch là "bấy nhiêu
         đó có đáng không". Đẩy nó xuống cuối màn thì nó đứng sau ba khối xếp hạng, và
         mạch bị cắt bởi đúng những chart mà nó đang chuẩn hoá. -->
    <div class="sec-h" style="margin-top:22px">${ulabel(t('usage.effSection'))}</div>
    <div class="ch-grid2">${chartUnitCost(u)}${chartCtxByTurn(u)}</div>
    <!-- Phân bố tỉ số đứng cạnh chi phí từng phiên, không đứng riêng: nó là phép đếm của
         đúng cái tỉ số mà chart bên cạnh chỉ cho thấy từng phiên một trong tooltip. -->
    <div class="ch-grid2" style="margin-top:12px">${chartSessionCost(u)}${chartRatioDist(u)}</div>
    <div class="ch-grid2" style="margin-top:12px">${chartRewarm(u)}</div>
    ${effNote(u)}

    <!-- Hạn mức từng chu kỳ là khối RIÊNG, không nhập vào khối trên: mấy chart kia đọc từ
         transcript và nói về tiền ước tính, còn khối này đọc từ sổ hạn mức và nói về ràng
         buộc thật. Ghi chú khoảng phủ ở trên chỉ khai cho transcript — để chart này nằm
         trong phạm vi câu đó là gán cho nó một nguồn dữ liệu không phải của nó.
         (Không dùng backtick trong comment ở đây: cả khối này nằm trong một template
         literal, nên một dấu backtick lẻ đóng luôn chuỗi — đúng cái vừa xảy ra.)

         Sổ chưa ghi được chu kỳ nào thì cả mục thu lại thành MỘT DÒNG, không tiêu đề mục,
         không thẻ chart: một cái vỏ đầy đủ dựng lên chỉ để nói "chưa có gì" thì đọc như
         một khối hỏng, và nó đứng chen giữa hai mục có số thật. -->
    ${cycles.warming
      ? html`<p class="ch-note" style="margin-top:22px">${raw(t('usage.cycleWarmingLine'))}</p>`
      : html`<div class="sec-h" style="margin-top:22px">${ulabel(t('usage.cycleSection'))}</div>
          <div class="ch-grid2">${cycles.node}</div>`}

    <div class="sec-h" style="margin-top:22px">${ulabel(t('usage.splitSection'))}</div>
    <div class="ch-grid2">${chartCostByModel(u)}${chartByProject(u)}</div>

    <!-- KHÔNG có chart "theo plugin". Nó không gần trùng chart skill — nó trùng khít:
         attributionSkill và attributionPlugin được ghi CÙNG một lượt gọi, nên một skill
         nằm trong plugin được đếm ở cả hai chỗ, và mọi hàng plugin bằng đúng tổng mấy
         hàng skill của chính nó (1.167.651 trên 1.167.651 token trùng lúc gỡ bỏ, tức là
         chart plugin không có lấy một token nào mà chart skill chưa có). Nó tiêu một thẻ,
         mười hàng và một bảng số để gộp lại thứ nằm ngay bên cạnh.
         Đường đọc không mất: nhãn skill đã mang sẵn tên plugin ở trước dấu hai chấm, và
         phụ đề nói ra điều đó. Bản thân u.plugins vẫn còn nguyên trong /api/state.
         (Không dùng backtick trong comment ở đây — xem chú thích khối chu kỳ bên trên.) -->
    <div class="sec-h" style="margin-top:22px">${ulabel(t('usage.blameSection'))}</div>
    <div class="ch-grid2">
      ${chartAttribution(u, 'mcp', 'usage.byMcp', 'usage.byMcpSub', 'usage-mcp')}
      ${chartAttribution(u, 'skills', 'usage.bySkill', 'usage.bySkillSub', 'usage-skill')}
      ${chartEntrypoints(u)}
    </div>
    ${sideNote(u)}

    <p class="ch-note" style="margin-top:18px">
      ${t('usage.scan', { files: u.files, ms: u.scanMs, dups: u.duplicates })}
      ${u.rollupError ? html`<b>${t('usage.rollupFail', { err: u.rollupError })}</b>` : t('usage.rollupAt', { path: u.rollupPath })}
    </p>`;
}

/**
 * Ba khối hạn mức, đứng chung và ĐỨNG NGOÀI tab.
 *
 * Đây là lý do tồn tại của cả lượt gộp này. Trước đó hạn mức Claude ở một màn còn hạn mức
 * Cursor và Antigravity ở màn khác, nên câu hỏi *"chỗ nào sắp chặn tôi trước"* — câu duy
 * nhất ở đây thật sự gấp — không có chỗ nào trả lời nổi: phải nhớ số của màn này rồi bấm
 * sang màn kia mà so.
 *
 * Cả ba vẽ bằng CÙNG một `quotaBar` và cùng phép chấm kết cục của `lib/quota.js`, nên ba
 * thanh so được nhịp với nhau. So mức thì không: mỗi khối giữ nguyên đơn vị của nguồn nó,
 * và đó là chuyện được nói ra trong `views/tools.js`.
 *
 * Thứ tự cố định — Claude, Cursor, Antigravity — theo đúng thứ tự tab bên dưới. Sắp lại
 * theo "cái nào nóng nhất" thì khối này nhảy chỗ giữa hai lượt quét, và một bố cục tự dời
 * chỗ dưới mắt thì không ai học được đường đọc của nó.
 *
 * Nhưng ba khối KHÔNG cùng cỡ: Claude là khối chính (thẻ to, đủ nhãn), Cursor và
 * Antigravity là hai khối phụ dạng rút gọn đứng chung một hàng bên dưới. Cấp bậc ấy
 * theo nhịp tiêu thật: hạn mức Claude xoay vòng 5 giờ một và là thứ quyết định phiên
 * tiếp theo chạy ở đâu, hai nguồn kia đổi chậm hơn cả chục lần. Ba khối bằng vai thì
 * trang nói dối về độ gấp — và khối đáng đọc nhất phải tranh chỗ với hai khối thỉnh
 * thoảng mới có chuyện.
 */
/**
 * Công cụ có mặt trên máy này không — quyết định ở ĐÂY, một chỗ, cho cả khối lẫn tab.
 *
 * "Chưa cài" khác hẳn "đang đóng" hay "chưa đăng nhập": hai ca sau là việc bạn làm được
 * và khối phải đứng nguyên đó nói ra phải làm gì, còn ca đầu thì công cụ ấy không thuộc
 * về bạn — một khối lỗi vĩnh viễn chiếm nửa hàng, cộng một tab mở ra chỉ thấy trống, là
 * hai thứ không bao giờ đổi và cũng không bao giờ có ích. Xem `reason: 'not-installed'`
 * trong `collect/cursor.js` và `collect/agquota.js`.
 *
 * Đọc theo chiều "có, TRỪ KHI biết chắc là chưa cài": mọi kết cục khác — kể cả trạng thái
 * chưa quét lần nào — đều giữ khối lại. Ẩn nhầm một công cụ đang có thì người dùng không
 * còn chỗ nào để phát hiện ra là mình vừa mất số.
 */
const hasCursor = (s) => s?.cursor?.reason !== 'not-installed';
const hasAg = (s) => s?.agQuota?.reason !== 'not-installed';

function quotaHead(s) {
  const side = [
    hasCursor(s) ? cursorQuotaPanel(s.cursor, s.plans?.cursor) : '',
    hasAg(s) ? agQuotaPanel(s.agQuota, s.plans?.antigravity) : '',
  ].filter(Boolean);
  return html`<div class="q-all">
    ${quotaPanel(s.quota, s.plans?.claude)}
    ${side.length ? html`<div class="q-side">${side}</div>` : ''}
  </div>`;
}

export function renderUsage(s, q) {
  // Tab của công cụ chưa cài bị bỏ khỏi danh sách chứ không phải vô hiệu hoá: `getTab`
  // tự rơi về tab đầu khi tab đang nhớ trong localStorage không còn trong danh sách, nên
  // máy gỡ Cursor ra không kẹt ở một tab trống.
  const items = [
    { id: 'claude', label: t('usage.tabClaude') },
    hasCursor(s) && { id: 'cursor', label: t('usage.tabCursor') },
    hasAg(s) && { id: 'ag', label: t('usage.tabAg') },
  ].filter(Boolean);
  const active = getTab(TABS, items.map((i) => i.id));
  const body =
    active === 'cursor'
      ? cursorTab(s.cursor, s.cursorEvents)
      : active === 'ag'
        ? agTab(s.antigravity, s.agTurns, s.generatedAt)
        : claudeTab(s);

  // Ô tìm không lọc màn này, đúng lý do của màn Thống kê: lọc một phần thì mọi
  // tổng đổi nghĩa mà không nói ra.
  return html`<div class="usage">
    ${q ? html`<p class="ch-note" style="margin:0 0 16px">${t('usage.qNote', { q })}</p>` : ''}
    ${quotaHead(s)}
    <!-- Nút phong cách và nút báo cáo đứng ở THANH TAB, không ở tiêu đề mục đầu tiên như
         bản trước: phạm vi của chúng là tấm đang mở, mà thanh tab chính là chỗ chọn tấm.
         Để lại trong mục đầu tiên thì cả ba tấm đều phải có một bản, tức là ba cặp nút
         giống hệt nhau làm cùng một việc — xem tabBar trong lib/tabs.js.
         (Không dùng backtick trong comment ở đây: cả khối này nằm trong một template
         literal, nên một backtick lẻ đóng luôn chuỗi.) -->
    ${tabBar({
      group: TABS,
      items,
      active,
      label: t('usage.tabsAria'),
      tools: html`${skinSwitch()}${reportBtn('usage')}`,
    })}
    ${tabPanel({ group: TABS, active, body })}
  </div>`;
}
