import { html, ago, clock } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { reportBtn } from '../lib/report.js';
import { empty, tok, ulabel, usd } from './shared.js';
import { forecastText, forecastTip, pctText, stamp, toneOf, wasteOf } from '../lib/quota.js';
import { flatTip } from '../lib/tip.js';

/**
 * Màn "Nhìn lại" (phím 8) — ba gói trả tháng, đọc theo TỪNG CHU KỲ ĐÃ QUA.
 *
 * Mọi màn khác là ảnh chụp hiện tại; màn này là chỗ duy nhất đọc lịch sử, và nó tồn tại
 * cho đúng một quyết định: giữ hay hạ ba gói $240/tháng. Bố cục là hợp đồng đã duyệt
 * 28/7 (design/mock-nhin-lai.html) — làm khác phải quay lại hỏi.
 *
 * Ba khối, thứ tự có chủ ý:
 *   A. "Gói có đáng tiền không" — mỗi thẻ chạy trên chu kỳ của CHÍNH công cụ đó, không
 *      ép trục chung. Dữ liệu: state.lookback (sổ chu kỳ đã gấp + tiền, server tính) và
 *      chu kỳ ĐANG chạy đọc thẳng từ state.quota / state.cursor / state.agQuota.
 *   B. "Nhịp 14 ngày" — gấp NGAY Ở ĐÂY từ các series đã có sẵn trong payload
 *      (usage.series, cursorEvents.series, agTurns.series), không bắt server chở một
 *      bản thứ hai — đúng cam kết "không nuôi B14" của đề xuất.
 *   C. "Xu hướng tuần" — đứng sau cổng 3 tuần (state.lookback.gate). Cổng đóng thì nói
 *      rõ đang chờ gì và mở lúc nào, đúng bài học B15: trạng thái non phải tự khai.
 *
 * Luật tiền (docs/PROPOSAL-nhin-lai.md): dãy 5 giờ của Claude trung tính không đô;
 * Cursor đo bằng cents thật, vượt gói là quà ăn màu --cheer; tiền AG neo trọn vào túi
 * Gemini, túi Claude/GPT chỉ ra chữ.
 */

/* ── Ngày tháng, thuần hàm — export cho test ─────────────────────────────── */

const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Ngày ĐỊA PHƯƠNG của một mốc ms — cùng lịch với khoá `day` của mọi sổ phía server. */
export const localDayOf = (ts) => isoOf(new Date(ts));

/**
 * Trục `n` ngày CHỐT Ở HÔM NAY, lấp ngày vắng bằng hàng rỗng.
 *
 * `today` là THAM SỐ, không phải đồng hồ — bài học B17: "hôm nay" là đầu vào ẩn dễ quên
 * nhất. Và không được cắt đuôi series rồi thôi: sổ sự kiện Cursor kết thúc ở ngày có
 * lượt gọi CUỐI, nghỉ ba ngày là series hụt ba ngày — trục mà đi theo nó thì dải "14
 * ngày qua" lặng lẽ kết thúc ở tuần trước. Ngày không có hàng là ngày KHÔNG DÙNG, và
 * nó phải hiện ra là một cột trống chứ không phải biến mất khỏi trục.
 */
export function lastDaysAxis(series, n, today) {
  const by = new Map((series ?? []).map((d) => [d.day, d]));
  const end = parseDay(today);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    const iso = isoOf(d);
    out.push(by.get(iso) ?? { day: iso });
  }
  return out;
}

/**
 * Gấp series ngày thành tuần, tuần mở THỨ HAI — trả về `weeks` tuần cuối, cũ → mới.
 *
 * Thứ hai chứ không phải chủ nhật hay mốc reset của một công cụ nào: khối C so BA công
 * cụ trên cùng một trục, mà ba mốc reset của chúng lệch nhau — trục trung lập duy nhất
 * là tuần dương lịch.
 */
export function weeksOf(series, val, weeks = 8) {
  const by = new Map();
  for (const d of series ?? []) {
    const dt = parseDay(d.day);
    const monday = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - ((dt.getDay() + 6) % 7));
    const key = isoOf(monday);
    by.set(key, (by.get(key) ?? 0) + (val(d) || 0));
  }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-weeks)
    .map(([week, v]) => ({ week, v }));
}

/* ── Chữ và hình nhỏ ─────────────────────────────────────────────────────── */

const dmy = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
};
const dmyMs = (ms) => (ms == null ? '—' : dmy(localDayOf(ms)));

/** Xu → chữ đô. Cùng khuôn với màn Token: usd() nhận đô. */
const money = (cents) => (cents == null ? '—' : usd(cents / 100));

/**
 * Sắc của một chu kỳ ĐÃ ĐÓNG theo thang bỏ phí — cùng băng với `verdictOf` bên
 * `lib/quota.js`, chép ngưỡng có chủ ý: bên đó chấm DỰ PHÓNG của cửa sổ sống, bên này
 * chấm KẾT CỤC của chu kỳ đã chốt, hai đầu vào khác nhau đi qua cùng một thang màu.
 * Chu kỳ theo dõi hụt thì về xám: đỉnh của nó là cận dưới, tô màu lên là chấm điểm
 * một con số không đáng tin.
 */
function wasteTone(waste, partial) {
  if (partial) return 'mute';
  if (waste >= 50) return 'crit';
  if (waste >= 10) return 'warn';
  return 'ok';
}

/**
 * Một dãy cột kiểu mock: cột = một chu kỳ / một ngày, nhãn nằm trên đầu cột.
 *
 * KHÔNG dùng `columns()` của lib/chart.js: dãy này cần sắc RIÊNG TỪNG CỘT theo thang
 * bỏ phí và viền đứt cho cột đang chạy — hai thứ nằm ngoài khuôn một-màu-một-chart của
 * lib. Mọi cột vẫn theo luật bàn phím của nhà: tabindex, aria-label, tooltip.
 */
function bars(items) {
  return html`<div class="lb-bars">
    ${items.map(
      (b) => html`<div
        class="lb-bar ${b.cls ?? 'mute'} ${b.run ? 'run' : ''}"
        style="height:${Math.max(3, Math.min(100, b.h)).toFixed(1)}%"
        tabindex="0"
        data-tip="${b.tip}"
        aria-label="${flatTip(b.tip)}"
      >
        ${b.label != null ? html`<i>${b.label}</i>` : ''}
      </div>`,
    )}
  </div>`;
}

const cap = (left, mid, right) =>
  html`<div class="lb-cap"><span>${left ?? ''}</span><span>${mid ?? ''}</span><span>${right ?? ''}</span></div>`;

/** Tìm một túi hạn mức AG theo bucketId — `gemini-weekly`, `3p-weekly`, `3p-5h`… */
function agBucket(ag, key) {
  for (const g of ag?.groups ?? []) for (const b of g.buckets ?? []) if (b.key === key) return b;
  return null;
}

/** $/tuần của gói trả tháng — chép `usdPerWeek` của src/lib/cycles.js (client không với tới src/). */
const usdWeek = (usdMonth) => (usdMonth * 12 * 7) / 365.25;

/** "$46,0" viết kiểu một số lẻ — giá một chu kỳ là hằng số, không cần hai số lẻ của usd(). */
const cycleUsdText = (v) => `$${v.toFixed(1)}`;

/* ── Khối A — ba thẻ ─────────────────────────────────────────────────────── */

/**
 * Dòng dự phóng của một cửa sổ SỐNG: câu của `forecastText` (đã lo đủ mọi ca không đoán
 * được) + đuôi tiền quy đô của phần bỏ phí — đuôi chỉ xuất hiện khi có gì để mất.
 */
function projLine(w, cycleUsd) {
  if (!w) return '';
  const tone = toneOf(w);
  const say = forecastText(w);
  if (!say) return '';
  const waste = wasteOf(w);
  const tail = w.forecast?.known ? t('lookback.wasteTail', { usd: usd((waste / 100) * cycleUsd) }) : '';
  return html`<div class="lb-line"><b class="lb-${tone}">${say}</b>${tail ? html` · ${tail}` : ''}</div>`;
}

function claudeCard(s) {
  const lb = s.lookback.claude;
  const seven = s.quota?.ok ? s.quota.sevenDay : null;
  const five = s.quota?.ok ? s.quota.fiveHour : null;

  // Hạn mức tuần riêng theo model, cái đã tiêu nhiều nhất — mẫu số là trần RIÊNG của nó.
  const scoped = (s.quota?.ok ? (s.quota.scoped ?? []) : [])
    .filter((w) => !w.expired && w.used != null)
    .sort((a, b) => b.used - a.used)[0];

  const lead = seven
    ? html`<div class="lb-lead num">${pctText(seven.used)} <small>${t('lookback.leadClaude', { at: stamp(seven.resetsAt) })}</small></div>`
    : html`<div class="lb-lead num">— <small>${t('lookback.noLive')}</small></div>`;

  // Cột 7 ngày kèm tiền chỉ có sau khi cửa sổ đầu tiên đóng (31/7); tới lúc đó thẻ vẽ
  // dãy 5 giờ trung tính — đúng trạng thái 1 của mock. Có cột tiền rồi thì dãy 5 giờ
  // thu về một mẩu chữ trong dòng tiền, khỏi chiếm chỗ.
  const hasSevens = lb.sevens.length > 0;
  const partialN = lb.sevens.filter((c) => c.partial).length;

  // Nhãn cột là SỐ TRẦN (21, 84) theo đúng mock: cả dãy cùng một đơn vị đã khai ở nhãn
  // dải, in "%" mười ba lần là mười ba lần nói cùng một chữ và các nhãn chen nhau.
  const sevenBars = [
    ...lb.sevens.map((c) => ({
      h: c.used,
      cls: wasteTone(c.waste, c.partial),
      label: Math.round(c.used),
      tip: t('lookback.tipSeven', {
        end: `${dmyMs(c.resetsAt)} ${clock(c.resetsAt)}`,
        used: pctText(c.used),
        waste: pctText(c.waste),
        usd: c.wasteUsd == null ? null : usd(c.wasteUsd),
        watched: c.watchedTo == null ? '—' : pctText(c.watchedTo * 100),
        partial: c.partial,
      }),
    })),
    ...(seven
      ? [{ h: seven.used, cls: 'mute', run: true, label: Math.round(seven.used), tip: forecastTip({ w: seven, label: t('quota.sevenDay') }) }]
      : []),
  ];

  const fiveBars = [
    ...lb.fives.map((c) => ({
      h: c.used,
      cls: 'mute',
      label: Math.round(c.used),
      tip: t('lookback.tipFive', { end: `${dmyMs(c.resetsAt)} ${clock(c.resetsAt)}`, used: pctText(c.used) }),
    })),
    ...(five
      ? [{ h: five.used, cls: 'mute', run: true, label: Math.round(five.used), tip: forecastTip({ w: five, label: t('quota.fiveHour') }) }]
      : []),
  ];

  // Trần 5h có bao giờ là ràng buộc không — đo trên TOÀN sổ, không phải trên 12 cột.
  const fiveSay =
    lb.fiveMax == null
      ? ''
      : lb.fiveMax >= 100
        ? t('lookback.fiveHit', { max: pctText(lb.fiveMax) })
        : t('lookback.fiveNever', { max: pctText(lb.fiveMax) });

  const m = lb.money;
  const moneyLine = hasSevens
    ? html`${t('lookback.sevenMoney', { n: m.solid, waste: usd(m.wasteUsd), paid: usd(m.paidUsd) })}${m.worst
        ? html` · ${t('lookback.sevenWorst', { week: dmyMs(m.worst.resetsAt), usd: usd(m.worst.wasteUsd) })}`
        : ''}${partialN ? html` · ${t('lookback.partialSkip', { n: partialN })}` : ''}${lb.fiveMax != null
        ? html` · ${t('lookback.fiveStill', { n: lb.fiveCount, max: pctText(lb.fiveMax) })}`
        : ''}`
    : t('lookback.sevenYoung', {
        opened: lb.openedAt ? dmyMs(lb.openedAt) : '—',
        first: seven?.resetsAt ? dmyMs(seven.resetsAt) : '—',
      });

  return html`<div class="lb-card">
    <h4>Claude <span class="lb-plan">${t('lookback.planClaude', {
      tier: s.plans?.claude?.ok ? s.plans.claude.label : '—',
      plan: lb.planUsd,
      cycle: cycleUsdText(lb.cycleUsd),
    })}</span></h4>
    ${lead}
    ${projLine(seven, lb.cycleUsd)}
    ${scoped ? html`<div class="lb-line">${t('lookback.scopedShare', { model: scoped.model ?? '?', pct: pctText(scoped.used) })}</div>` : ''}
    ${hasSevens
      ? html`${bars(sevenBars)}${cap(
          t('lookback.capWindow', { from: lb.sevens.length ? dmyMs(lb.sevens[0].resetsAt) : '' }),
          t('lookback.sevenCapNote'),
          seven ? t('lookback.capRun') : '',
        )}`
      : html`${bars(fiveBars)}${cap(
          t('lookback.fivesCap', { from: lb.openedAt ? dmyMs(lb.openedAt) : '—' }),
          '',
          five ? t('lookback.capRun') : '',
        )}${fiveSay ? html`<div class="lb-line">${fiveSay}</div>` : ''}`}
    <div class="lb-money">${moneyLine}</div>
  </div>`;
}

function cursorCard(s) {
  const lb = s.lookback.cursor;
  const c = s.cursor?.ok ? s.cursor : null;
  const cents = c?.total?.cents ?? null;
  const plan = c?.planCents ?? Math.round(lb.planUsd * 100);
  const over = cents != null && cents > plan;
  const elapsed = c?.cycle?.elapsedFrac ?? null;

  const lead =
    cents != null
      ? html`<div class="lb-lead num ${over ? 'lb-cheer' : ''}">${money(cents)} <small>${t(
          over ? 'lookback.leadCursorOver' : 'lookback.leadCursorUnder',
          { plan: Math.round(plan / 100), x: (cents / plan).toFixed(1) },
        )}</small></div>`
      : html`<div class="lb-lead num">— <small>${t('lookback.noLive')}</small></div>`;

  const line =
    cents == null
      ? ''
      : over
        ? t('lookback.cursorOverLine', {
            plan: Math.round(plan / 100),
            bonus: money(c?.bonusCents ?? cents - plan),
            elapsed: elapsed == null ? '—' : pctText(elapsed * 100),
          })
        : t('lookback.cursorUnderLine', {
            left: money(plan - cents),
            elapsed: elapsed == null ? '—' : pctText(elapsed * 100),
          });

  // Thang cột là CENTS trên cùng một trục — chu kỳ vượt gói cao hơn chu kỳ hụt gói đúng
  // theo tiền, không phải theo phần trăm bị kẹp trần.
  const rows = [
    ...lb.cycles.map((cy) => ({
      cents: cy.cents,
      cls: cy.partial ? 'mute' : cy.over ? 'cheer' : wasteTone(((cy.planCents - cy.cents) / cy.planCents) * 100, false),
      label: `${Math.round((cy.cents / cy.planCents) * 100)}%`,
      tip: t('lookback.tipBilling', {
        end: dmyMs(cy.resetsAt),
        cents: money(cy.cents),
        plan: money(cy.planCents),
        bonus: cy.bonusCents == null ? '—' : money(cy.bonusCents),
        waste: cy.wasteUsd == null ? '—' : usd(cy.wasteUsd),
        partial: cy.partial,
      }),
    })),
    ...(cents != null
      ? [
          {
            cents,
            cls: over ? 'cheer' : 'mute',
            run: true,
            label: `${Math.round((cents / plan) * 100)}%`,
            tip: t('lookback.tipCursorRun', {
              cents: money(cents),
              plan: money(plan),
              elapsed: elapsed == null ? '—' : pctText(elapsed * 100),
              reset: c?.cycle?.endAt ? dmyMs(c.cycle.endAt) : '—',
            }),
          },
        ]
      : []),
  ];
  const maxCents = Math.max(1, ...rows.map((r) => r.cents));
  const cBars = rows.map((r) => ({ ...r, h: (r.cents / maxCents) * 100 }));

  // Dự phóng tiền chỉ đáng nói khi chưa vượt gói: vượt rồi thì bỏ phí đã chốt là $0.
  const proj = !over && cents != null && elapsed > 0.05 ? cents / elapsed : null;
  const m = lb.money;
  const moneyLine = over
    ? t('lookback.cursorMoneyOverRun')
    : proj != null
      ? t('lookback.cursorMoneyProj', {
          to: c?.cycle?.endAt ? dmyMs(c.cycle.endAt) : '—',
          proj: money(proj),
          waste: usd(Math.max(0, plan - proj) / 100),
        })
      : '';
  const closedLine = m.closed
    ? html`${t('lookback.cursorCycles', { n: m.solid, waste: usd(m.wasteUsd) })}${m.solid && m.overCount === m.solid
        ? t('lookback.cursorAllOver', { plan: Math.round(plan / 100) })
        : ''}`
    : '';

  return html`<div class="lb-card">
    <h4>Cursor <span class="lb-plan">${t('lookback.planCursor', {
      tier: s.plans?.cursor?.ok && s.plans.cursor.label ? s.plans.cursor.label : '—',
      plan: Math.round(plan / 100),
      from: c?.cycle?.startAt ? dmyMs(c.cycle.startAt) : '—',
      to: c?.cycle?.endAt ? dmyMs(c.cycle.endAt) : '—',
    })}</span></h4>
    ${lead}
    ${line ? html`<div class="lb-line">${line}</div>` : ''}
    ${bars(cBars)}
    ${cap(
      t('lookback.cursorCap', {
        from: c?.cycle?.startAt ? dmyMs(c.cycle.startAt) : lb.cycles.length ? dmyMs(lb.cycles[0].resetsAt) : '—',
        to: c?.cycle?.endAt ? dmyMs(c.cycle.endAt) : '—',
      }),
      t('lookback.cursorCapNote'),
      cents != null ? t('lookback.capRun') : '',
    )}
    <div class="lb-money">${closedLine ? html`${closedLine}${moneyLine ? html` · ${moneyLine}` : ''}` : moneyLine}</div>
  </div>`;
}

function agCard(s) {
  const lb = s.lookback.ag;
  const gem = agBucket(s.agQuota, 'gemini-weekly');
  const threeW = agBucket(s.agQuota, '3p-weekly');
  const three5 = agBucket(s.agQuota, '3p-5h');

  const lead = gem
    ? html`<div class="lb-lead num">${pctText(gem.used)} <small>${t('lookback.leadAg', { at: stamp(gem.resetsAt) })}</small></div>`
    : html`<div class="lb-lead num">— <small>${t('lookback.noLive')}</small></div>`;

  const gBars = [
    ...lb.gemini.map((c) => ({
      h: c.used,
      cls: wasteTone(c.waste, c.partial),
      label: Math.round(c.used),
      tip: t('lookback.tipGemini', {
        end: `${dmyMs(c.resetsAt)} ${clock(c.resetsAt)}`,
        used: pctText(c.used),
        waste: pctText(c.waste),
        usd: c.wasteUsd == null ? null : usd(c.wasteUsd),
        watched: c.watchedTo == null ? '—' : pctText(c.watchedTo * 100),
        partial: c.partial,
      }),
    })),
    ...(gem
      ? [{ h: gem.used, cls: toneOf(gem), run: true, label: Math.round(gem.used), tip: forecastTip({ w: gem, label: gem.label ?? 'Gemini' }) }]
      : []),
  ];

  // Túi Claude/GPT: một câu, không một đô — và câu phải theo dữ liệu thật chứ không
  // theo khuôn: đã chạm trần tuần thì nói chạm trần, đừng in "mới trôi 55%" cạnh 100%.
  let threep = '';
  if (threeW) {
    const used = pctText(threeW.used);
    const el = threeW.elapsedFrac == null ? null : threeW.elapsedFrac * 100;
    const capped5 = three5 && three5.used >= 99.5;
    const base =
      threeW.used >= 99.5
        ? t('lookback.threepCapped', { at: stamp(threeW.resetsAt) })
        : t('lookback.threepLine', { used, elapsed: el == null ? '—' : pctText(el) }) +
          (el > 5 && threeW.used / el > 1.15 ? t('lookback.threepPace', { x: (threeW.used / el).toFixed(1) }) : '');
    threep = html`<div class="lb-line">${base}${capped5 ? html` · <b class="lb-crit">${t('lookback.threep5h')}</b>` : ''}
      ${t('lookback.threepNoMoney', { plan: lb.planUsd })}</div>`;
  }

  const m = lb.money;
  const moneyLine = lb.gemini.length
    ? t('lookback.agMoney', { n: m.solid, waste: usd(m.wasteUsd), paid: usd(m.paidUsd) })
    : t('lookback.agYoung', {
        opened: lb.openedAt ? dmyMs(lb.openedAt) : '—',
        first: gem?.resetsAt ? dmyMs(gem.resetsAt) : '—',
      });

  return html`<div class="lb-card">
    <h4>Antigravity <span class="lb-plan">${t('lookback.planAg', {
      tier: s.plans?.antigravity?.ok ? s.plans.antigravity.label : '—',
      plan: lb.planUsd,
      cycle: cycleUsdText(lb.cycleUsd),
    })}</span></h4>
    ${lead}
    ${projLine(gem, lb.cycleUsd)}
    ${bars(gBars)}
    ${cap(
      lb.gemini.length || gem
        ? t('lookback.agWeekCap', {
            from: dmyMs(lb.gemini.length ? lb.gemini[0].resetsAt - 7 * 86400_000 : gem ? gem.resetsAt - (gem.windowMs ?? 0) : 0),
            to: dmyMs(lb.gemini.length ? (gem?.resetsAt ?? lb.gemini.at(-1).resetsAt) : gem?.resetsAt),
          })
        : '',
      '',
      gem ? t('lookback.capRun') : '',
    )}
    ${threep}
    <div class="lb-money">${moneyLine}</div>
  </div>`;
}

/**
 * Dòng cộng ngang duy nhất — chỗ DUY NHẤT được quy ba gói về một trục, và phải mang
 * nhãn quy đổi ("quy cùng về tuần") ngay trong câu. Phần bỏ phí là DỰ PHÓNG của các
 * cửa sổ đang chạy, quy tuần: Cursor chạy theo tháng nên phần bỏ phí dự phóng của nó
 * được chia lại theo 7 ngày trước khi cộng.
 */
function weekTotal(s) {
  const lb = s.lookback;
  const sumWeek = usdWeek(lb.claude.planUsd + lb.cursor.planUsd + lb.ag.planUsd);

  const parts = [];
  const seven = s.quota?.ok ? s.quota.sevenDay : null;
  if (seven?.forecast?.known) parts.push({ tool: 'Claude', usd: (wasteOf(seven) / 100) * lb.claude.cycleUsd });
  const gem = agBucket(s.agQuota, 'gemini-weekly');
  if (gem?.forecast?.known) parts.push({ tool: 'Antigravity', usd: (wasteOf(gem) / 100) * lb.ag.cycleUsd });
  const c = s.cursor?.ok ? s.cursor : null;
  if (c?.total?.cents != null && c.cycle?.elapsedFrac > 0.05 && c.cycle?.windowMs) {
    const proj = c.total.cents / c.cycle.elapsedFrac;
    const plan = c.planCents ?? lb.cursor.planUsd * 100;
    parts.push({ tool: 'Cursor', usd: (Math.max(0, plan - proj) / 100) * ((7 * 86400_000) / c.cycle.windowMs) });
  }
  if (!parts.length) return '';

  const waste = parts.reduce((n, p) => n + p.usd, 0);
  const worst = parts.slice().sort((a, b) => b.usd - a.usd)[0];
  return html`<div class="lb-total">
    ${t('lookback.weekTotal', { sum: usd(sumWeek), waste: usd(waste) })}
    ${waste < 1 ? t('lookback.weekTight') : t('lookback.weekLoose', { tool: worst.tool })}
  </div>`;
}

/* ── Khối B — nhịp 14 ngày ───────────────────────────────────────────────── */

const RHYTHM_DAYS = 14;

/**
 * Một dải ngày: cột trung tính, chỉ đỉnh mang nhãn — dải đo NHỊP, không chấm điểm,
 * nên không cột nào ăn màu của thang bỏ phí.
 */
function strip({ title, src, rows, fmt, tip, zeroNote }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  const peak = rows.reduce((p, r) => (r.v > (p?.v ?? 0) ? r : p), null);
  const items = rows.map((r) => ({
    h: (r.v / max) * 100,
    cls: 'mute',
    label: peak && r.v === peak.v && r.v > 0 ? fmt(r.v) : null,
    tip: tip(r),
  }));
  return html`<div class="lb-strip">
    <h4>${title} <span>${src}</span></h4>
    ${bars(items)}
    ${cap(
      dmy(rows[0].day),
      peak && peak.v > 0 ? t('lookback.peakAt', { day: dmy(peak.day), v: fmt(peak.v) }) : (zeroNote ?? ''),
      dmy(rows.at(-1).day),
    )}
    ${zeroNote && peak && peak.v > 0 ? html`<div class="lb-line">${zeroNote}</div>` : ''}
  </div>`;
}

/** Những ngày trống của một dải, viết ra được: ít thì kể tên, nhiều thì đếm. */
function zeroText(rows, val, tool) {
  const zero = rows.filter((r) => !val(r));
  if (!zero.length) return '';
  if (zero.length > 4) return t('lookback.zeroMany', { n: zero.length, tool });
  return t('lookback.zeroDays', { days: zero.map((r) => dmy(r.day)).join(' · '), tool });
}

function rhythmBlock(s) {
  const today = localDayOf(s.generatedAt);
  const out = [];

  if (s.usage?.ok && s.usage.series?.length) {
    const rows = lastDaysAxis(s.usage.series, RHYTHM_DAYS, today).map((d) => ({ day: d.day, v: d.out ?? 0, msgs: d.msgs ?? 0 }));
    out.push(
      strip({
        title: t('lookback.stripClaude'),
        src: t('lookback.stripClaudeSrc', { days: Math.min(s.usage.series.length, s.usage.windowDays ?? 45) }),
        rows,
        fmt: tok,
        tip: (r) => t('lookback.tipClaudeDay', { day: r.day, out: tok(r.v), msgs: r.msgs }),
      }),
    );
  }

  if (s.cursorEvents?.ok && s.cursorEvents.series?.length) {
    const rows = lastDaysAxis(s.cursorEvents.series, RHYTHM_DAYS, today).map((d) => ({
      day: d.day,
      v: d.events ?? 0,
      cents: d.cents ?? 0,
    }));
    out.push(
      strip({
        title: t('lookback.stripCursor'),
        src: t('lookback.stripCursorSrc', { days: s.cursorEvents.days ?? s.cursorEvents.series.length }),
        rows,
        fmt: String,
        tip: (r) => t('lookback.tipCursorDay', { day: r.day, events: r.v, cost: money(r.cents) }),
        zeroNote: zeroText(rows, (r) => r.v, 'Cursor'),
      }),
    );
  }

  if (s.agTurns?.ok && s.agTurns.series?.length) {
    const rows = lastDaysAxis(s.agTurns.series, RHYTHM_DAYS, today).map((d) => ({ day: d.day, v: d.turns ?? 0, out: d.out ?? 0 }));
    out.push(
      strip({
        title: t('lookback.stripAg'),
        src: t('lookback.stripAgSrc', { days: s.agTurns.series.length }),
        rows,
        fmt: String,
        tip: (r) => t('lookback.tipAgDay', { day: r.day, turns: r.v, out: tok(r.out) }),
        zeroNote: zeroText(rows, (r) => r.v, 'Antigravity'),
      }),
    );
  } else {
    out.push(html`<p class="ch-note lb-prose">${t('lookback.agNoDaily')}</p>`);
  }

  return out;
}

/* ── Khối C — xu hướng tuần, sau cổng 3 tuần ─────────────────────────────── */

function trendBlock(s) {
  const gate = s.lookback.gate;
  if (!gate.open) {
    return html`<p class="ch-note lb-prose">${gate.opensAt
      ? t('lookback.trendWait', { opens: dmyMs(gate.opensAt), opened: dmyMs(gate.openedAt) })
      : t('lookback.trendNoLedger')}</p>`;
  }

  const parts = [];
  if (s.usage?.ok && s.usage.series?.length) {
    const wk = weeksOf(s.usage.series, (d) => d.out ?? 0);
    if (wk.length >= 2) {
      parts.push(
        strip({
          title: t('lookback.trendClaude'),
          src: t('lookback.trendWeeks', { n: wk.length }),
          rows: wk.map((w) => ({ day: w.week, v: w.v })),
          fmt: tok,
          tip: (r) => t('lookback.tipWeek', { week: dmy(r.day), v: tok(r.v) }),
        }),
      );
    }
  }
  if (s.cursorEvents?.ok && s.cursorEvents.series?.length) {
    const wk = weeksOf(s.cursorEvents.series, (d) => d.cents ?? 0);
    if (wk.length >= 2) {
      parts.push(
        strip({
          title: t('lookback.trendCursor'),
          src: t('lookback.trendWeeks', { n: wk.length }),
          rows: wk.map((w) => ({ day: w.week, v: w.v })),
          fmt: (v) => money(v),
          tip: (r) => t('lookback.tipWeek', { week: dmy(r.day), v: money(r.v) }),
        }),
      );
    }
  }
  // Tuần AG không cần gấp: mỗi chu kỳ đóng của túi Gemini ĐÃ là một tuần trọn.
  const gw = s.lookback.ag.gemini;
  if (gw.length >= 2) {
    parts.push(
      strip({
        title: t('lookback.trendAg'),
        src: t('lookback.trendWeeks', { n: gw.length }),
        rows: gw.map((c) => ({ day: localDayOf(c.resetsAt), v: c.used })),
        fmt: (v) => pctText(v),
        tip: (r) => t('lookback.tipWeek', { week: dmy(r.day), v: pctText(r.v) }),
      }),
    );
  }
  return parts.length ? html`${parts}` : html`<p class="ch-note lb-prose">${t('lookback.trendThin')}</p>`;
}

/* ── Màn ─────────────────────────────────────────────────────────────────── */

export function renderLookback(s) {
  const lb = s.lookback;
  if (!lb?.ok) return empty('⟲', t('lookback.broken'), lb?.error ?? '');

  return html`<div class="lb-tools">${reportBtn('lookback')}</div>

    <div class="sec-h">${ulabel(t('lookback.buySection'))}</div>
    <p class="ch-note lb-q">${t('lookback.buyQ')}</p>
    <div class="lb-cards">${claudeCard(s)}${cursorCard(s)}${agCard(s)}</div>
    ${weekTotal(s)}

    <div class="sec-h" style="margin-top:26px">${ulabel(t('lookback.rhythmSection'))}</div>
    <p class="ch-note lb-q">${t('lookback.rhythmQ')}</p>
    ${rhythmBlock(s)}

    <div class="sec-h" style="margin-top:26px">${ulabel(t('lookback.trendSection'))}</div>
    <p class="ch-note lb-q">${t('lookback.trendQ')}</p>
    ${trendBlock(s)}

    <p class="ch-note lb-foot">${t('lookback.note')}</p>`;
}
