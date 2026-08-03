import { html, raw, ago, clock, JUST_NOW_MS } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { card, dualColumns, hbars, ranked, series, stackedRows, legend, tableTwin } from '../lib/chart.js';
import { barColor, forecastText, forecastTip, pctText, quotaBar, resetLabel, toneOf, usedText } from '../lib/quota.js';
import { flatTip } from '../lib/tip.js';
import { dataAt, empty, planChip, srcLabel, tok, ulabel, usd } from './shared.js';

/**
 * Nửa NGOÀI-CLAUDE của màn Token — Cursor và Antigravity.
 *
 * Trước đây đây là một màn riêng ("Công cụ"). Nó bị gộp vào màn Token vì hai màn hỏi đúng
 * một câu — *"cái này đang tiêu tới đâu"* — và tách ra thì cả hai đều trả lời hụt: màn
 * Token biết hạn mức Claude mà không biết hai công cụ kia, màn Công cụ phải bê một hàng số
 * Claude rút gọn sang cho đỡ lệch, tức là chép lại thứ nằm ở màn bên. Giờ khối hạn mức của
 * cả ba đứng chung một chỗ, còn phần chi tiết của từng công cụ thì nằm trong tab của nó.
 *
 * ## Vì sao KHÔNG cộng chúng lại
 *
 * Cám dỗ hiển nhiên là một con số tổng: "tháng này bạn tiêu $X cho AI". Con số đó không tồn
 * tại. Ba nguồn đo ba thứ khác nhau:
 *
 * - **Claude Code** — hạn mức tính bằng **phần trăm** của hai cửa sổ trượt (5 giờ và 7
 *   ngày). Không có đô ở đây; số $ trong tab Claude là ước lượng dashboard tự nhân từ bảng
 *   giá API, mà tài khoản này trả theo gói.
 * - **Cursor** — hạn mức tính bằng **đô thật**, theo chu kỳ **tháng dương lịch**.
 * - **Antigravity** — phần trăm của **hai cửa sổ × hai hồ chứa**: Gemini và Claude+GPT
 *   tính riêng, mỗi hồ một khung 5 giờ và một khung tuần. Bốn con số, không gộp được.
 *
 * Cộng "14% của Cursor" với "38% khung 7 ngày của Claude" ra một con số không nói về cái gì
 * cả, và tệ hơn: nó trông như một con số. Nên mỗi công cụ giữ nguyên đơn vị của nó, và tab
 * làm nốt phần còn lại — mỗi lần chỉ một đơn vị đo trên màn.
 */

const COLOR = {
  cost: 'var(--accent)',
  out: 'var(--accent-ink)',
  cacheRead: 'var(--later)',
  cacheWrite: 'var(--soon)',
  input: 'var(--ok)',
  convo: 'var(--accent)',
  // Ngữ cảnh dùng đúng sắc mà tab Claude dành cho ngữ cảnh (`COLOR.ctx` ở `views/usage.js`):
  // hai tab đo cùng một đại lượng thì phải cùng một màu, không thì mắt học lại từ đầu.
  ctx: 'var(--later)',
  turns: 'var(--accent)',
  // Lượt lỗi dùng đúng sắc cảnh báo mà thanh hạn mức dành cho phần bỏ phí: hai chỗ cùng nói
  // "đã trả gì đó mà không lấy về được" thì phải cùng một màu.
  waste: 'var(--warn)',
};

/** `2026-07-18` → `18/7`. Cùng cách viết với trục ngày của tab Claude. */
const dmy = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
};

const pctOf = (v) => `${(v * 100).toFixed(1)}%`;

/** Trung vị — cho vạch mốc tham chiếu, cùng vai với `refMedian` ở tab Claude. */
function median(list) {
  if (!list.length) return 0;
  const a = list.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Xu → đô. Cursor trả mọi khoản tiền bằng xu, kể cả phần lẻ (`3156.9393`). */
const money = (cents) => (cents == null ? '—' : usd(cents / 100));

/**
 * Đô CHẴN — dùng cho trần và giá gói.
 *
 * Hai con số đó là số nguyên đô theo định nghĩa: giá gói do Cursor niêm yết, trần thì đã
 * được làm tròn về đô ngay lúc suy ra (xem `ceilingFrom`). Cho chúng đi qua `usd` thì ra
 * "$45.00" và "$20.00" — hai chữ số thập phân không mang tin, đứng cạnh "$1.65" là số có
 * phần lẻ thật, khiến hai loại số trông như cùng một độ chính xác.
 */
const flat = (cents) => (cents == null ? '—' : `$${Math.round(cents / 100).toLocaleString('en-US')}`);

/** Dung lượng, đơn vị lớn nhất còn đọc được ngay. */
const mb = (bytes) => (bytes >= 1 << 30 ? `${(bytes / (1 << 30)).toFixed(1)}GB` : `${Math.round(bytes / (1 << 20))}MB`);

/**
 * Hàng hạn mức RÚT GỌN — dùng chung cho hai khối phụ Cursor và Antigravity.
 *
 * Khối Claude giữ dạng thẻ to vì nó là khối CHÍNH: hạn mức tiêu nhanh nhất, và là thứ
 * quyết định phiên làm việc tiếp theo chạy ở đâu. Hai khối kia trả lời cùng một câu
 * ("chỗ này sắp chặn tôi chưa") nhưng ở nhịp chậm hơn hẳn — chu kỳ tháng của Cursor,
 * hai hồ ít đụng tới của Antigravity — nên chúng chỉ cần một dòng mỗi cửa sổ: nhãn,
 * thanh, phần trăm. Cùng `quotaBar`, cùng phép chấm kết cục, chỉ khác cỡ.
 *
 * Dòng dự báo đi KÈM, không phải chỉ khi có sự cố.
 *
 * Bản trước chỉ in câu ấy ở đúng một ca (sắp ngồi không), nên hai khối phụ đứng cạnh
 * khối Claude mà không có lấy một con số nào ngoài phần trăm đã tiêu — trong khi khối
 * Claude viết thẳng "mốc đều 20%", "→54%", "bỏ phí 46%" vào trong thanh. Ba khối vẽ
 * cùng một cái thanh nhưng chỉ một khối nói ra nó đang nói gì, và hai khối kia đọc
 * thành hai thanh trang trí.
 *
 * Ở đây câu là chỗ DUY NHẤT chở được mấy con số đó: thanh rút gọn hẹp quá để mang nhãn
 * trong mảng (chữ sẽ chồng lên nhau), nên phần dự phóng và phần bỏ phí phải ra chữ.
 * Nhịp, mốc reset, cặp đô và phần còn lại vẫn ở tooltip qua `entry.extra` — chúng là
 * số để tra, không phải số để liếc.
 */
/**
 * Một dòng hạn mức rút gọn.
 *
 * Mốc reset đứng ĐẦU dòng phụ, trước câu dự báo: "còn bao lâu để tiêu dần" là câu phải
 * trả lời được mà không rê chuột, và trước đây nó chỉ có trong tooltip. Nhạt và mono, tách
 * khỏi câu dự báo bằng dấu `·` — nó đo THỜI GIAN nên không được nhuộm màu của thang bỏ phí
 * (xem `resetLabel` trong `lib/quota.js`).
 *
 * `showReset: false` cho khối Cursor: ba dòng ở đó dùng CHUNG một chu kỳ tháng, nên in mốc
 * reset ba lần là ba lần nói cùng một câu. Chỗ của nó là một dòng cho cả khối.
 */
function miniRow(entry) {
  const { w, label } = entry;
  const tip = forecastTip(entry);
  const tone = toneOf(w);
  const say = forecastText(w);
  const when = entry.showReset === false ? '' : resetLabel(w);
  return html`<div class="qm-row" tabindex="0" data-tip="${tip}" data-tip-tone="${tone}" aria-label="${flatTip(tip)}">
    <span class="qm-lbl" title="${label}">${label}</span>
    ${quotaBar(w)}
    <b class="qm-val" style="color:${barColor(w)}">${usedText(w)}</b>
    ${when || say
      ? html`<span class="qm-sub"
          >${when ? html`<span class="qm-when">${when}</span>` : ''}${when && say ? ' · ' : ''}${say
            ? html`<span class="qm-say ${tone}">${say}</span>`
            : ''}</span
        >`
      : ''}
  </div>`;
}

/* ── Cursor ───────────────────────────────────────────────────────────────── */

/** Vì sao số Cursor bị cũ, nói theo đúng tầng đã tụt xuống — xem `collect/cursor.js`. */
const DEGRADED_NOTE = {
  'no-auth': 'tools.cNoAuth',
  'token-expired': 'tools.cNoAuth',
  http: 'tools.cHttp',
  timeout: 'tools.cOffline',
  network: 'tools.cOffline',
};

/**
 * Khối hạn mức Cursor — khối PHỤ, dạng rút gọn. Vẫn đứng đầu màn cạnh khối Claude,
 * KHÔNG nằm trong tab: câu "tôi sắp bị chặn ở đâu chưa" phải trả lời được mà không bấm
 * gì, và đưa vào tab thì người dùng chỉ phát hiện mình cạn Cursor lúc đã cạn.
 *
 * `collect/cursor.js` cố ý trả về đúng hình dạng cửa sổ mà `lib/quota.js` ăn được, nên
 * thanh, phép chấm kết cục và tooltip là **cùng một mã** với khối Claude — không phải
 * một bản sao trông giống. Khác đúng một chữ, và `overLabel` là chỗ nó được nói ra:
 * vượt trần bên Claude là **ngồi không** (bị chặn, hết cách), bên Cursor là **vượt phần
 * đã trả** — vẫn chạy tiếp, chỉ là sang một khoản tiền khác mà dashboard không đọc được.
 *
 * Cặp đô đi vào tooltip, KHÔNG lên dòng. Phần trăm là số Cursor thật sự gửi; cặp
 * "$48,83 trên $345" là số dashboard suy ngược ra (xem ceilingFrom trong
 * collect/cursor.js), nên nó càng không được tranh chỗ ở một khối đã rút gọn.
 */
export function cursorQuotaPanel(c, plan) {
  // Gạch chân chấm: tên gói này do dashboard SUY RA từ $20/tháng, Cursor không hề gửi nó.
  const chip = planChip(plan, 'plan.tip.cursor', { money: `$${((plan?.cents ?? 0) / 100).toFixed(0)}` });
  if (!c?.ok) {
    const why = c?.reason === 'empty' ? 'tools.cEmpty' : c?.reason === 'no-auth' ? 'tools.cNoAuth' : 'tools.cBroken';
    return html`<section class="q-panel q-mini">
      <div class="q-head">${srcLabel('Cursor', t('quota.titleTail'), chip)}</div>
      <p class="q-note">${t(DEGRADED_NOTE[c?.degraded] ?? why)}</p>
    </section>`;
  }

  const rows = [
    [c.total, t('tools.bTotal')],
    [c.auto, t('tools.bAuto')],
    [c.named, t('tools.bNamed')],
  ].filter(([b]) => b?.used != null);

  return html`<section class="q-panel q-mini">
    <div class="q-head">
      ${srcLabel('Cursor', t('quota.titleTail'), chip)}
      <span class="q-age ${c.stale ? 'stale' : ''}"
        >${t(c.ageMs < JUST_NOW_MS ? 'quota.atFresh' : 'quota.at', { time: clock(c.at), age: ago(c.ageMs) })}</span
      >
    </div>
    <!-- Một mốc reset cho CẢ khối, không phải mỗi dòng một mốc: ba nhóm hạn mức của Cursor
         nằm trong cùng một chu kỳ tháng và reset cùng lúc, nên in ba lần là ba lần nói cùng
         một câu — đúng luật "cái gì lặp lại thì không phải thông tin". Khối Antigravity thì
         ngược lại: bốn hồ × cửa sổ có bốn mốc thật khác nhau, nên mốc nằm trên từng dòng. -->
    ${resetLabel(c.total) ? html`<div class="qm-cycle">${resetLabel(c.total)}</div>` : ''}
    <div class="qm-rows">${rows.map(([b, label]) =>
      miniRow({
        w: b,
        label,
        showReset: false,
        overLabel: 'tools.rowOver',
        extra:
          b.cents == null
            ? []
            : [[t('tools.rowSpent'), b.ceilCents == null ? money(b.cents) : t('tools.spentOf', { spent: money(b.cents), cap: flat(b.ceilCents) })]],
      }),
    )}</div>
    ${c.degraded ? html`<p class="q-note">${t(DEGRADED_NOTE[c.degraded] ?? 'tools.cOffline')}</p>` : ''}
    ${c.bonusCents ? html`<p class="q-note">${t('tools.bonus', { bonus: money(c.bonusCents), plan: flat(c.planCents) })}</p>` : ''}
    <!-- Cách suy ra trần GẬP LẠI, không mở sẵn: nó là chuyện học một lần rồi thôi, mà
         mở ra thì nó là khối chữ dài nhất khối này và đứng chắn ngay trước mấy con số
         người ta vào đây để xem. Cùng lý do với "cách đọc thanh" của khối Claude. -->
    ${c.total?.derived
      ? html`<details class="q-help" data-k="tools:cap">
          <summary>${t('tools.capHelp')}</summary>
          <p class="q-note">${raw(t('tools.capNote'))}</p>
        </details>`
      : ''}
  </section>`;
}

function chartCursorCost(c) {
  const rows = c.models
    .filter((m) => m.cents > 0)
    .slice(0, 12)
    .map((m) => ({
      label: m.model,
      v: Number((m.cents / 100).toFixed(2)),
      // Nhãn nhóm đi THEO HÀNG, không tra ngược `c.models[i]`: danh sách này đã lọc và cắt
      // còn 12, nên chỉ số của nó không còn khớp với chỉ số của mảng gốc.
      bucket: t(m.auto ? 'tools.bAuto' : 'tools.bNamed'),
      tip: t('tools.tipModel', {
        model: m.model,
        cost: money(m.cents),
        bucket: t(m.auto ? 'tools.bAuto' : 'tools.bNamed'),
        out: tok(m.out),
      }),
    }));
  if (!rows.length) return '';

  return card({
    title: t('tools.cursorCost'),
    sub: t('tools.cursorCostSub'),
    body: ranked({ id: 'tools-cursor-cost', rows, color: COLOR.cost, fmt: usd }),
    table: tableTwin(
      [t('tools.cModel'), t('tools.cBucket'), t('tools.cCost')],
      rows.map((r) => [r.label, r.bucket, usd(r.v)]),
      'tools-cursor-cost',
    ),
  });
}

function chartCursorTokens(c) {
  const kinds = [
    { k: 'out', color: COLOR.out, label: t('tools.partOut') },
    { k: 'cw', color: COLOR.cacheWrite, label: t('usage.partCacheWrite') },
    { k: 'cr', color: COLOR.cacheRead, label: t('usage.partCacheRead') },
    { k: 'inTok', color: COLOR.input, label: t('usage.partInput') },
  ];

  const rows = c.models
    .map((m) => ({
      label: m.model,
      total: kinds.reduce((n, x) => n + m[x.k], 0),
      // Ở đây KHÔNG phải chia phần tiền theo trọng số như tab Claude: Cursor trả thẳng
      // bốn con số token thật cho từng model, nên mảnh nào cũng là trị đo được.
      parts: kinds.map((x) => ({
        v: m[x.k],
        color: x.color,
        tip: t('tools.tipTokPart', { model: m.model, kind: x.label, n: tok(m[x.k]) }),
      })),
      m,
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
  if (!rows.length) return '';

  return card({
    title: t('tools.cursorTok'),
    sub: t('tools.cursorTokSub'),
    body: html`${stackedRows({ rows, fmt: tok })}${legend(kinds.map((x) => ({ color: x.color, label: x.label })))}`,
    table: tableTwin(
      [t('tools.cModel'), t('usage.partInput'), t('tools.partOut'), t('usage.partCacheRead'), t('usage.partCacheWrite')],
      rows.map((r) => [r.label, tok(r.m.inTok), tok(r.m.out), tok(r.m.cr), tok(r.m.cw)]),
      'tools-cursor-tok',
    ),
  });
}

/* ── Cursor theo thời gian (sổ sự kiện) ───────────────────────────────────── */

/**
 * Tiền mỗi ngày — con số mà tab Cursor thiếu suốt từ đầu.
 *
 * Hai endpoint kia chỉ nói tổng cả chu kỳ, nên câu đơn giản nhất — *hôm qua tốn bao nhiêu* —
 * không có chỗ nào trả lời. Đây là chỗ đó, và tiền ở đây là **tiền THẬT Cursor đã tính**,
 * không phải ước lượng như cột đô của tab Claude. Hai loại đô ấy không so với nhau được, và
 * đó là điều khối hướng dẫn của báo cáo nói ra.
 */
function chartCursorCostByDay(e) {
  const days = e.series.filter((d) => d.cents > 0);
  if (days.length < 2) return '';
  const data = days.map((d) => ({
    x: dmy(d.day),
    v: Number((d.cents / 100).toFixed(2)),
    tip: t('tools.tipCurDay', { day: d.day, cost: usd(d.cents / 100), events: d.events, out: tok(d.out) }),
  }));

  return card({
    title: t('tools.curCostByDay'),
    sub: t('tools.curCostByDaySub', { total: usd(e.totals.cents / 100), from: e.from, to: e.to }),
    body: series({ id: 'tools-cur-cost-day', data, color: COLOR.cost, fmt: usd }),
    table: tableTwin(
      [t('usage.cDate'), t('tools.cCost'), t('tools.cEvents'), t('usage.cOut'), t('usage.cCacheRead')],
      e.series.map((d) => [d.day, usd(d.cents / 100), d.events, tok(d.out), tok(d.cr)]),
      'tools-cur-cost-day',
    ),
  });
}

/**
 * Lượt gọi mỗi ngày, và trong đó bao nhiêu lượt HỎNG.
 *
 * `kind` phân biệt được lượt được tính tiền với lượt lỗi-không-tính-tiền. Lượt lỗi là thứ
 * duy nhất ở tab này nói về chất lượng chứ không về khối lượng: nó không tốn tiền, nhưng nó
 * tốn thời gian chờ, và một ngày nhiều lỗi bất thường là một ngày đáng đi tìm nguyên nhân.
 *
 * Cột HAI TRỤC chứ không hai mảng chồng: lỗi chỉ chiếm ~1–2% số lượt, nên trong cột chồng
 * mảnh lỗi mỏng hơn cả khe giữa hai cột — thứ chart tồn tại để chỉ ra lại là thứ duy nhất
 * không nhìn thấy. Trục phải cho lỗi một thang riêng, và ngày lỗi bất thường nhô lên ngay.
 */
function chartCursorEventsByDay(e) {
  const days = e.series.filter((d) => d.events > 0);
  if (days.length < 2) return '';
  const data = days.slice(-30).map((d) => ({
    x: dmy(d.day),
    a: d.events,
    b: d.errored,
    tip: t('tools.tipCurCalls', { day: d.day, n: d.events, err: d.errored, cost: usd(d.cents / 100) }),
  }));

  return card({
    title: t('tools.curCallsByDay'),
    sub: t('tools.curCallsByDaySub', { n: e.totals.events, err: e.totals.errored, share: pctOf(e.totals.events ? e.totals.errored / e.totals.events : 0) }),
    body: html`${dualColumns({
      data,
      a: { color: COLOR.turns, fmt: (v) => String(Math.round(v)) },
      b: { color: COLOR.waste, fmt: (v) => String(Math.round(v)) },
    })}${legend([
      { color: COLOR.turns, label: t('tools.axCalls') },
      { color: COLOR.waste, label: t('tools.axErr') },
    ])}`,
    table: tableTwin(
      [t('usage.cDate'), t('tools.cEvents'), t('tools.partErrored'), t('tools.cCost')],
      e.series.map((d) => [d.day, d.events, d.errored, usd(d.cents / 100)]),
      'tools-cur-calls',
    ),
  });
}

/**
 * Chi phí theo hội thoại — chỗ đột biến lộ ra, đúng vai của "chi phí từng phiên" ở tab Claude.
 *
 * Chỉ 3 NGÀY gần nhất, không phải cả sổ (xem `convoDays` ở `collect/cursorevents.js`):
 * bảng xếp hạng toàn-lịch-sử bị chính lịch sử đóng băng — mười hội thoại đắt nhất của
 * 148 ngày thì tháng sau vẫn là mười cái đó, và chart thành một tấm ảnh treo tường.
 * Ba ngày là câu hỏi thật ("dạo này cái gì đang đốt tiền"), và không đủ dữ liệu trong
 * khoảng đó thì tấm này tự rút, không vẽ gượng.
 *
 * Mã hội thoại là uuid, không có tên: Cursor không gửi tiêu đề kèm sự kiện. Cắt còn 8 ký tự
 * đầu chứ không in trọn 36 — chuỗi đầy đủ chiếm hết bề ngang mà phần đuôi không giúp phân
 * biệt gì thêm, và bảng số vẫn giữ đủ để đi đối chiếu.
 */
function chartCursorConvos(e) {
  const rows = (e.convos ?? []).filter((c) => c.cents > 0).slice(0, 10);
  if (rows.length < 2) return '';

  return card({
    title: t('tools.curByConvo'),
    sub: t('tools.curByConvoSub', { n: e.convoCount, d: e.convoDays ?? 3 }),
    body: ranked({
      id: 'tools-cur-convo',
      rows: rows.map((c) => ({
        label: c.id.slice(0, 8),
        v: Number((c.cents / 100).toFixed(2)),
        tip: t('tools.tipCurConvo', { id: c.id.slice(0, 8), cost: usd(c.cents / 100), events: c.events, from: c.firstDay, to: c.lastDay }),
      })),
      color: COLOR.cost,
      fmt: usd,
    }),
    table: tableTwin(
      [t('tools.cConvoId'), t('tools.cCost'), t('tools.cEvents'), t('tools.cFirstDay'), t('tools.cLastDay')],
      e.convos.map((c) => [c.id, usd(c.cents / 100), c.events, c.firstDay, c.lastDay]),
      'tools-cur-convo',
    ),
  });
}

/* ── Cursor: nhịp trong editor (GetUserAnalytics) ─────────────────────────── */

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Dòng code THẬT SỰ vào file, theo ngày.
 *
 * Đây là trục duy nhất trong cả màn Token không đo thứ model sinh ra mà đo thứ **được nhận**.
 * Token viết ra chỉ nói model gõ bao nhiêu; dòng được nhận nói bao nhiêu trong số đó sống
 * sót qua mắt người. Hai con số đó lệch nhau bao nhiêu mới là câu đáng hỏi.
 */
function chartCursorLines(an) {
  const days = an.days.filter((d) => d.added > 0 || d.accepted > 0);
  if (days.length < 2) return '';
  const data = days.map((d) => ({
    x: dmy(isoDay(d.at)),
    v: d.accepted,
    tip: t('tools.tipCurLines', { day: isoDay(d.at), accepted: d.accepted, added: d.added, applies: d.applies, accepts: d.accepts }),
  }));

  return card({
    title: t('tools.curLines'),
    sub: t('tools.curLinesSub', { accepted: an.totals.accepted.toLocaleString('en-US'), days: days.length }),
    body: series({ id: 'tools-cur-lines', data, color: COLOR.input, fmt: (v) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(Math.round(v))) }),
    table: tableTwin(
      [t('usage.cDate'), t('tools.cAccepted'), t('tools.cAdded'), t('tools.cApplies'), t('tools.cAccepts')],
      an.days.map((d) => [isoDay(d.at), d.accepted, d.added, d.applies, d.accepts]),
      'tools-cur-lines',
    ),
  });
}

/**
 * Tỉ lệ gợi ý Tab được nhận — chỉ số CHẤT duy nhất đọc được ở đây.
 *
 * Mẫu số là số lần gợi ý hiện ra, tử số là số lần được nhận. Ngày mẫu số quá nhỏ bị bỏ khỏi
 * HÌNH: một ngày hiện 3 gợi ý và nhận 1 cho ra 33%, đứng cạnh một ngày 900/2400 cũng 37% —
 * hai con số trông như nhau mà một cái là nhiễu. Cùng cách xử lý với ngày mỏng ở chart đơn
 * giá của tab Claude, và số ngày bị bỏ được đếm ra ở phụ đề.
 */
const MIN_TABS = 20;

function chartCursorTabRate(an) {
  const thick = an.days.filter((d) => d.tabsShown >= MIN_TABS);
  if (thick.length < 2) return '';
  const thin = an.days.filter((d) => d.tabsShown > 0 && d.tabsShown < MIN_TABS).length;
  const rate = (d) => (d.tabsShown ? (d.tabsAccepted / d.tabsShown) * 100 : 0);
  const mid = median(thick.map(rate));
  const data = thick.map((d) => ({
    x: dmy(isoDay(d.at)),
    v: Number(rate(d).toFixed(1)),
    tip: t('tools.tipCurTab', { day: isoDay(d.at), rate: `${rate(d).toFixed(1)}%`, shown: d.tabsShown, accepted: d.tabsAccepted }),
  }));

  return card({
    title: t('tools.curTabRate'),
    sub: thin
      ? t('tools.curTabRateSubThin', { shown: an.totals.tabsShown.toLocaleString('en-US'), thin, min: MIN_TABS })
      : t('tools.curTabRateSub', { shown: an.totals.tabsShown.toLocaleString('en-US') }),
    body: series({ id: 'tools-cur-tab', data, color: COLOR.out, fmt: (v) => `${v}%`, ref: { v: mid, label: t('usage.refMedian') } }),
    table: tableTwin(
      [t('usage.cDate'), t('tools.cTabRate'), t('tools.cTabsShown'), t('tools.cTabsAccepted')],
      an.days.filter((d) => d.tabsShown > 0).map((d) => [isoDay(d.at), d.tabsShown >= MIN_TABS ? `${rate(d).toFixed(1)}%` : '—', d.tabsShown, d.tabsAccepted]),
      'tools-cur-tab',
    ),
  });
}

/** Làm việc trên loại file nào — thứ duy nhất ở màn này biết được nội dung công việc. */
function chartCursorExts(an) {
  const rows = an.exts.slice(0, 12);
  if (rows.length < 2) return '';
  const total = an.exts.reduce((n2, e) => n2 + e.count, 0);
  return card({
    title: t('tools.curExts'),
    sub: t('tools.curExtsSub', { n: an.exts.length }),
    body: ranked({
      id: 'tools-cur-ext',
      rows: rows.map((e) => ({
        label: `.${e.name}`,
        v: e.count,
        tip: t('tools.tipCurExt', { name: `.${e.name}`, count: e.count, share: pctOf(total ? e.count / total : 0) }),
      })),
      color: COLOR.convo,
    }),
    table: tableTwin(
      [t('tools.cExt'), t('tools.cEdits'), t('usage.cShare')],
      an.exts.map((e) => [`.${e.name}`, e.count, pctOf(total ? e.count / total : 0)]),
      'tools-cur-ext',
    ),
  });
}

/**
 * Tấm Cursor.
 *
 * KHÔNG lặp lại lý do hỏng khi rỗng: khối hạn mức Cursor ở đầu màn đã nói ra đúng mắt xích
 * nào đứt, bằng một câu dài hơn hẳn. Viết lại ở đây là hai chỗ cùng kể một chuyện, mà lúc
 * đó không chỗ nào được đọc — nên tấm này chỉ chỉ đường lên khối ấy.
 *
 * Ba mục, xếp theo ĐỘ GẤP chứ không theo nguồn dữ liệu: tiền theo thời gian trước (câu hỏi
 * hay gặp nhất), rồi chu kỳ đang chạy, rồi nhịp trong editor.
 */
export function cursorTab(c, e) {
  const an = c?.analytics;
  const ev = e?.ok && e.series?.length ? e : null;
  if (!c?.ok && !ev && !an) return empty('◧', t('tools.cursorNone'), t('tools.noneHint'));

  return html`${dataAt(ev?.at ?? c?.at)}
  ${ev
    ? html`<div class="sec-h">${ulabel(t('tools.curTimeSection'))}</div>
        <div class="ch-grid2">${chartCursorCostByDay(ev)}${chartCursorEventsByDay(ev)}</div>
        ${(() => {
          // Tấm 3-ngày tự rút khi thiếu dữ liệu — cái vỏ lưới phải rút theo, không thì
          // còn lại một khối rỗng cao 12px chen giữa hai mục.
          const convos = chartCursorConvos(ev);
          return convos ? html`<div class="ch-grid2" style="margin-top:12px">${convos}</div>` : '';
        })()}
        <p class="ch-note">${raw(t('tools.curEventsNote', { n: ev.totals.events, days: ev.days, from: ev.from, to: ev.to }))}</p>`
    : html`<p class="ch-note">${t(e?.loading || e?.warming ? 'tools.curEventsWarming' : 'tools.curEventsNone')}</p>`}

  ${c?.ok && c.models?.length
    ? html`<div class="sec-h" style="margin-top:22px">${ulabel(t('tools.curCycleSection'))}</div>
        <div class="ch-grid2">${chartCursorCost(c)}${chartCursorTokens(c)}</div>`
    : ''}

  ${an
    ? html`<div class="sec-h" style="margin-top:22px">${ulabel(t('tools.curEditorSection'))}</div>
        <div class="ch-grid2">${chartCursorLines(an)}${chartCursorTabRate(an)}</div>
        <div class="ch-grid2" style="margin-top:12px">${chartCursorExts(an)}</div>
        <p class="ch-note">${raw(t('tools.curEditorNote'))}</p>`
    : ''}`;
}

/* ── Antigravity ──────────────────────────────────────────────────────────── */

/** Vì sao số Antigravity vắng mặt, nói theo đúng mắt xích đã đứt — xem `collect/agquota.js`. */
const AG_NOTE = {
  'not-running': 'tools.agQClosed',
  'no-port': 'tools.agQNoPort',
  http: 'tools.agQHttp',
  timeout: 'tools.agQOffline',
  network: 'tools.agQOffline',
};

/**
 * Khối hạn mức Antigravity — khối PHỤ, dạng rút gọn như khối Cursor.
 *
 * Số dẫn là **đã tiêu**, giống hệt Claude và Cursor — nhưng chính app Antigravity lại
 * hiện phần CÒN LẠI. Hai con số bù nhau cho cùng một sự thật, nên phần còn lại vẫn phải
 * có mặt với nhãn rõ ràng — giờ ở tooltip của dòng, và khối hướng dẫn gập bên dưới nói
 * ra phép nối 29 + 71 = 100: người dùng mở app đối chiếu thấy 71% ở đó và 29% ở đây mà
 * không có chỗ nào nối hai số lại thì kết luận hợp lý nhất là dashboard hỏng.
 */
export function agQuotaPanel(q, plan) {
  // Bậc gói sống trong ảnh chụp, nên nó vẫn nói được sau khi Antigravity đã đóng — đúng
  // lúc khối này chỉ còn mỗi dòng "app không chạy" và không còn gì khác để nói.
  const chip = planChip(plan, 'plan.tip.ag');
  if (!q?.ok) {
    const why = q?.reason === 'empty' ? 'tools.agQEmpty' : (AG_NOTE[q?.reason] ?? 'tools.agQBroken');
    return html`<section class="q-panel q-mini">
      <div class="q-head">${srcLabel('Antigravity', t('quota.titleTail'), chip)}</div>
      <p class="q-note">${t(why)}</p>
    </section>`;
  }

  return html`<section class="q-panel q-mini">
    <div class="q-head">
      ${srcLabel('Antigravity', t('quota.titleTail'), chip)}
      <span class="q-age ${q.stale ? 'stale' : ''}"
        >${t(q.ageMs < JUST_NOW_MS ? 'quota.atFresh' : 'quota.at', { time: clock(q.at), age: ago(q.ageMs) })}</span
      >
    </div>
    <!-- Mỗi hồ chứa một cụm riêng, KHÔNG trộn bốn dòng vào một danh sách phẳng: hai hồ
         tiêu độc lập và thường lệch nhau rất xa (đo được 64% với 0% cùng lúc). Xếp liền
         nhau thì bốn dòng đọc thành bốn mặt của cùng một hạn mức. -->
    ${q.groups.map(
      (g) => html`<div class="qm-pool">
        ${g.name ? html`<div class="q-pool-h">${g.name}${g.models ? html`<small> · ${g.models}</small>` : ''}</div>` : ''}
        <div class="qm-rows">${g.buckets.map((b) => miniRow({ w: b, label: b.label, extra: [[t('tools.rowLeft'), pctText(b.remaining)]] }))}</div>
      </div>`,
    )}
    ${q.degraded ? html`<p class="q-note">${t(AG_NOTE[q.degraded] ?? 'tools.agQOffline')}</p>` : ''}
    <details class="q-help" data-k="tools:agq">
      <summary>${t('tools.agQHelp')}</summary>
      <p class="q-note">${raw(t('tools.agQNote'))}</p>
    </details>
  </section>`;
}

function agRow(a, g) {
  const convos = a?.convos ?? [];
  const steps = convos.reduce((n, c) => n + (c.steps ?? 0), 0);
  const bytes = convos.reduce((n, c) => n + (c.bytes ?? 0), 0);
  return html`<div class="player-stats">
    <!-- Đuôi "/97" chỉ hiện khi sổ có nhiều hơn số đang đếm, tức là khi ngưỡng ngày ĐÃ cắt
         mất một phần. Bằng nhau mà vẫn in ra thì nó viết đúng một con số hai lần cạnh nhau
         và người đọc phải tự kết luận là không có gì bị cắt. -->
    <div class="pstat">${ulabel(t('tools.agConvos'))}<span class="v">${convos.length}${
      (a?.total ?? convos.length) > convos.length ? html`<small>/${a.total}</small>` : ''
    }</span></div>
    <div class="pstat">${ulabel(t('tools.agAwake'))}<span class="v">${convos.filter((c) => !c.sleeping).length}</span></div>
    <div class="pstat">${ulabel(t('tools.agSteps'))}<span class="v">${steps}</span></div>
    <!-- Lượt gọi đứng CẠNH bước, không thay chỗ nó: hai con số đếm hai thứ khác nhau (bước
         là thao tác nhìn thấy trong app, lượt là lần thật sự gọi model), và trên máy này
         chúng lệch nhau khoảng gấp đôi. Thay một số bằng số kia thì con số quen thuộc biến
         mất mà không ai được báo. -->
    ${g?.turns
      ? html`<div class="pstat">${ulabel(t('tools.agTurns'))}<span class="v">${g.turns.toLocaleString()}</span></div>
          <div class="pstat">${ulabel(t('tools.agCtxMed'))}<span class="v">${tok(g.ctxMedian ?? 0)}<small>tok</small></span></div>`
      : ''}
    <div class="pstat">${ulabel(t('tools.agBytes'))}<span class="v">${mb(bytes)}</span></div>
  </div>`;
}

/**
 * Theo dự án. Vẫn xếp theo BƯỚC, nhưng giờ mang thêm lượt gọi và ngữ cảnh.
 *
 * Không đổi trục sang lượt gọi: "bước" là thứ nhìn thấy được trong app (mỗi lần chạy tool
 * là một bước), nên nó là con số người dùng đối chiếu được. Lượt gọi model thì nhiều hơn
 * hay ít hơn tuỳ hội thoại và không hiện ở đâu trong app cả — nó là số của dashboard, nên
 * nó đi vào tooltip và bảng số, chỗ dành cho thứ phải giải thích.
 */
function chartAgProjects(a, g) {
  const by = new Map();
  for (const c of a?.convos ?? []) {
    const key = c.project || c.folder || t('tools.agNoFolder');
    const cur = by.get(key) ?? { convos: 0, steps: 0, bytes: 0, turns: 0, ctx: 0 };
    cur.convos += 1;
    cur.steps += c.steps ?? 0;
    cur.bytes += c.bytes ?? 0;
    // Nối theo id hội thoại — `collect/agturns.js` cố ý trả bảng theo id chứ không tự gắn
    // dự án: nó không đọc board nào, còn phép gắn dự án thì nằm ở `state.js`.
    const gt = g?.byConvo?.[c.id];
    cur.turns += gt?.turns ?? 0;
    cur.ctx += gt?.ctx ?? 0;
    by.set(key, cur);
  }
  const rows = [...by.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a2, b) => b.steps - a2.steps)
    .slice(0, 12);
  if (!rows.length) return '';

  const hasTurns = rows.some((r) => r.turns > 0);
  return card({
    title: t('tools.agByProject'),
    sub: t('tools.agByProjectSub'),
    body: ranked({
      id: 'tools-ag-project',
      rows: rows.map((r) => ({
        label: r.label,
        v: r.steps,
        tip: t(hasTurns ? 'tools.tipAgFull' : 'tools.tipAg', {
          name: r.label,
          steps: r.steps,
          convos: r.convos,
          size: mb(r.bytes),
          turns: r.turns,
          ctx: tok(r.ctx),
        }),
      })),
      color: COLOR.convo,
    }),
    table: tableTwin(
      hasTurns
        ? [t('tools.cProject'), t('tools.cConvos'), t('tools.cSteps'), t('tools.cTurns'), t('tools.cCtxRead'), t('tools.cSize')]
        : [t('tools.cProject'), t('tools.cConvos'), t('tools.cSteps'), t('tools.cSize')],
      rows.map((r) =>
        hasTurns ? [r.label, r.convos, r.steps, r.turns, tok(r.ctx), mb(r.bytes)] : [r.label, r.convos, r.steps, mb(r.bytes)],
      ),
      'tools-ag-project',
    ),
  });
}

/* ── Lượt gọi model (đọc từ gen_metadata) ─────────────────────────────────── */

/**
 * Lượt gọi mỗi ngày — khối lượng công việc, đo bằng thứ hạn mức thật sự đếm.
 *
 * Không vẽ "tổng ngữ cảnh mỗi ngày" ở đây dù số ấy có sẵn: nó lớn gấp 82 lần token viết ra,
 * nên cột của nó chỉ nói lại được một điều — hôm đó ngồi máy bao lâu. Đúng cái bẫy mà tab
 * Claude đã gỡ ở `chartOutByDay`. Ngữ cảnh có chart riêng ngay bên cạnh, và ở đó nó được
 * chia cho số lượt nên mới thành một tỉ số đọc được.
 */
function chartAgTurnsByDay(g) {
  if (g.series.length < 2) return '';
  const data = g.series.map((d) => ({
    x: dmy(d.day),
    v: d.turns,
    tip: t('tools.tipAgDay', { day: d.day, turns: d.turns, ctx: tok(d.ctxMedian ?? 0), out: tok(d.out) }),
  }));

  return card({
    title: t('tools.agTurnsByDay'),
    sub: t('tools.agTurnsByDaySub', { n: g.turns, days: g.series.length }),
    body: series({ id: 'tools-ag-day', data, color: COLOR.turns, fmt: (v) => String(Math.round(v)) }),
    table: tableTwin(
      [t('usage.cDate'), t('tools.cTurns'), t('tools.cCtxMedian'), t('tools.cOutGuess')],
      g.series.map((d) => [d.day, d.turns, tok(d.ctxMedian ?? 0), tok(d.out)]),
      'tools-ag-day',
    ),
  });
}

/**
 * Ngữ cảnh của một lượt ĐIỂN HÌNH, theo ngày — và vì sao là trung vị chứ không phải tổng.
 *
 * Tổng ngữ cảnh của một ngày cao lên vì hai lý do khác hẳn nhau: làm nhiều hơn, hoặc mỗi
 * lượt phải đọc lại nhiều hơn. Chỉ lý do thứ hai mới là thứ sửa được (mở hội thoại mới thay
 * vì kéo dài mãi một hội thoại), nên chia cho số lượt là việc phải làm trước khi con số nói
 * được điều gì. Vạch mốc là trung vị của chính máy này — không có "ngữ cảnh đúng".
 */
function chartAgCtxByDay(g) {
  const days = g.series.filter((d) => d.ctxMedian != null);
  if (days.length < 2) return '';
  const mid = median(days.map((d) => d.ctxMedian));
  const data = days.map((d) => ({
    x: dmy(d.day),
    v: Math.round(d.ctxMedian),
    tip: t('tools.tipAgCtxDay', { day: d.day, ctx: tok(d.ctxMedian), turns: d.turns, total: tok(d.ctx) }),
  }));

  return card({
    title: t('tools.agCtxByDay'),
    sub: t('tools.agCtxByDaySub'),
    body: series({ id: 'tools-ag-ctx', data, color: COLOR.ctx, fmt: tok, ref: { v: mid, label: t('usage.refMedian') } }),
    table: tableTwin(
      [t('usage.cDate'), t('tools.cCtxMedian'), t('tools.cTurns'), t('tools.cCtxRead')],
      days.map((d) => [d.day, tok(d.ctxMedian), d.turns, tok(d.ctx)]),
      'tools-ag-ctx',
    ),
  });
}

/** Theo model — xếp theo số lượt, vì đó là thứ đếm được chắc chắn nhất trong bản ghi. */
function chartAgModels(g) {
  const rows = g.models.slice(0, 12);
  if (rows.length < 2) return '';

  return card({
    title: t('tools.agByModel'),
    sub: t('tools.agByModelSub', { n: g.models.length }),
    body: ranked({
      id: 'tools-ag-model',
      rows: rows.map((m) => ({
        label: m.key,
        v: m.turns,
        tip: t('tools.tipAgModel', { name: m.key, turns: m.turns, ctx: tok(m.ctxMedian ?? 0), out: tok(m.out) }),
      })),
      color: COLOR.convo,
    }),
    table: tableTwin(
      [t('tools.cModel'), t('tools.cTurns'), t('tools.cCtxMedian'), t('tools.cOutGuess')],
      g.models.map((m) => [m.model ?? m.key, m.turns, tok(m.ctxMedian ?? 0), tok(m.out)]),
      'tools-ag-model',
    ),
  });
}

/** `<25%` · `25–50%` · `≥90%` — con số tự nói, không cần một chuỗi dịch cho mỗi băng. */
const bandLabel = (b) => (b.hi == null ? `≥${b.lo}%` : b.lo === 0 ? `<${b.hi}%` : `${b.lo}–${b.hi}%`);

/**
 * Bao nhiêu lượt chạy sát trần ngữ cảnh — câu hỏi duy nhất ở tab này dẫn thẳng tới hành động.
 *
 * Ngữ cảnh gần đầy là lúc app phải bắt đầu cắt bớt lịch sử, và cách xử lý thì chỉ có một:
 * tách hội thoại mới. Biết "320 lượt trên 4.479 đã ở trên 90%" thì quyết được; biết "tổng
 * ngữ cảnh 352M" thì không.
 *
 * Đi thẳng `hbars` chứ không qua `ranked`, cùng lý do với `chartRewarm` ở tab Claude: băng
 * rỗng phải còn một hàng. "Không lượt nào chạm 90%" là một kết luận, mà quạt tròn và treemap
 * dựng từ diện tích nên mảnh 0 biến mất, kéo theo đúng cái kết luận ấy.
 */
function chartAgCtxFill(g) {
  if (!g.banded) return '';
  const rows = g.ctxBands.map((b) => ({
    label: bandLabel(b),
    v: b.turns,
    tip: t('tools.tipAgBand', { band: bandLabel(b), turns: b.turns, share: pctOf(b.turns / g.banded) }),
  }));
  const tail = g.ctxBands.at(-1);

  return card({
    title: t('tools.agCtxFill'),
    sub: t('tools.agCtxFillSub', { n: g.banded, tail: tail.turns, share: pctOf(tail.turns / g.banded) }),
    body: html`${hbars({ rows, color: COLOR.ctx, fmt: (v) => String(Math.round(v)) })}
      <p class="ch-note">${t('tools.agCtxFillCap')}</p>`,
    table: tableTwin(
      [t('tools.cCtxBand'), t('tools.cTurns'), t('usage.cShare')],
      g.ctxBands.map((b) => [bandLabel(b), b.turns, pctOf(b.turns / g.banded)]),
      'tools-ag-fill',
    ),
  });
}

/**
 * Tấm Antigravity — hoạt động đọc từ ĐĨA, khác nguồn với khối hạn mức ở đầu màn.
 *
 * Hai nguồn ấy hỏng độc lập nhau, nên tấm này còn số cả khi app đã tắt (lúc đó khối hạn
 * mức trên kia chỉ còn ảnh chụp cũ). Đó là lý do nó không tắt theo trạng thái của hạn mức.
 */
export function agTab(a, g, scannedAt) {
  if (!(a?.convos ?? []).length) return empty('⬡', t('tools.agNone'), t('tools.agNoneHint'));
  const turns = g?.ok && g.turns ? g : null;
  return html`${agRow(a, turns)}
    ${dataAt(scannedAt)}
    ${turns
      ? html`<div class="sec-h" style="margin-top:18px">${ulabel(t('tools.agCallSection'))}</div>
          <div class="ch-grid2">${chartAgTurnsByDay(turns)}${chartAgCtxByDay(turns)}</div>
          <div class="ch-grid2" style="margin-top:12px">${chartAgModels(turns)}${chartAgCtxFill(turns)}</div>
          <!-- Nói ra mức chắc chắn NGAY DƯỚI mấy chart nó nói về, không nhét vào một khối
               hướng dẫn ở đâu khác: bốn chart trên trộn hai loại số khác hẳn nhau về độ tin,
               và người đọc phải biết cái nào là cái nào trước khi kết luận. -->
          <p class="ch-note">${raw(t('tools.agTurnsNote', { turns: turns.turns, convos: turns.convos, from: turns.from, to: turns.to }))}</p>
          ${turns.unreadable
            ? html`<p class="ch-note"><b>${t('tools.agUnreadable', { n: turns.unreadable })}</b></p>`
            : ''}`
      : ''}

    <div class="sec-h" style="margin-top:${turns ? '22px' : '18px'}">${ulabel(t('tools.agConvoSection'))}</div>
    ${(() => {
      const chart = chartAgProjects(a, turns);
      return chart ? html`<div class="ch-grid2">${chart}</div>` : '';
    })()}
    ${a?.keepDays ? html`<p class="ch-note">${t('tools.agKeep', { d: a.keepDays })}</p>` : ''}`;
}
