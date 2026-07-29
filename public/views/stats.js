import { html, raw } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { card, series, ranked, stackedRows, legend, skinSwitch, tableTwin } from '../lib/chart.js';
import { reportBtn } from '../lib/report.js';
import { score } from '../lib/game.js';
import { empty, ulabel, HEAT_ICON, heatLabel } from './shared.js';

/**
 * Màn thống kê.
 *
 * Nguyên tắc của cả dự án — **mọi con số phải có thật** — ở đây khó giữ nhất,
 * vì chart là thứ dễ nói dối nhất trên đời: một cột thấp trông y hệt "hôm đó
 * làm ít", kể cả khi sự thật là "hôm đó board đã quên mất".
 *
 * Cụ thể: `recentlyDone` trong NOW.json bị cắt còn vài mục gần nhất mỗi dự án.
 * Dự án nào chạm trần thì mọi việc cũ hơn biến mất khỏi board — nên nhìn thô,
 * ngày càng lùi về trước càng "ít việc", mà đó là **hiện tượng của trần lưu**,
 * không phải của sếp. Vẽ nguyên xi rồi để đấy là dựng một cái biểu đồ lừa người
 * xem. Nên `coverage()` bên dưới đo đúng chuyện đó và đánh dấu thẳng lên cột.
 *
 * Hai nhóm chart còn lại (quyết định, hàng đợi, phiên) là **ảnh chụp hiện tại**,
 * đếm đủ, không dính trần lưu — nên chúng mới là phần đáng tin nhất ở màn này.
 */

const COLOR = {
  done: 'var(--accent)',
  queue: 'var(--accent-ink)',
  session: 'var(--accent)',
};
const HEAT_COLOR = { now: 'var(--now)', soon: 'var(--soon)', later: 'var(--later)' };

const dmy = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
};

/**
 * Với mỗi ngày, đếm xem BAO NHIÊU dự án còn ghi lùi được tới ngày đó.
 *
 * Một dự án chỉ "phủ" ngày D nếu mục `recentlyDone` cũ nhất của nó ở ngày D
 * hoặc sớm hơn. Dự án chạm trần lưu thì cửa sổ của nó ngắn lại, những ngày
 * trước cửa sổ bị đếm thiếu — và đó chính là chỗ cột thấp một cách giả tạo.
 */
export function coverage(projects) {
  const windows = projects
    .map((p) => (p.now?.recentlyDone ?? []).map((d) => d.date).sort())
    .filter((dates) => dates.length)
    .map((dates) => dates[0]);
  return { earliest: windows, total: windows.length };
}

/** Cửa sổ tối đa của chart theo ngày. Xem `doneByDay` để biết vì sao phải có trần. */
export const MAX_DAYS = 45;

const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const shiftDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};

export function doneByDay(s) {
  if (!s.timeline.length) return null;
  const { earliest, total } = coverage(s.projects);
  const byDate = new Map(s.timeline.map((d) => [d.date, d.items.length]));

  // Cửa sổ vẽ có TRẦN, và trần này không phải chuyện thẩm mỹ.
  //
  // Ngày trong `recentlyDone` là người gõ tay vào NOW.json. Một chữ số sai — `2016` thay
  // vì `2026` — kéo khoảng vẽ ra 3.653 ngày và trang dựng 3.653 cột kèm 3.653 hàng bảng
  // số; gõ nhầm sang tương lai còn tệ hơn. Một dự án gõ sai là hỏng màn Thống kê của mọi
  // dự án, nên: chốt mốc cuối ở hôm nay, lùi tối đa 45 ngày, và **nói ra** đã bỏ bao
  // nhiêu ngày thay vì lặng lẽ cắt.
  const today = isoOf(new Date());
  const newest = s.timeline[0].date;
  const oldest = s.timeline.at(-1).date;

  const end = newest > today ? today : newest;
  const floor = shiftDays(end, -(MAX_DAYS - 1));
  const start = oldest < floor ? floor : oldest;

  const dropped = s.timeline.filter((d) => d.date < start || d.date > end);
  const droppedItems = dropped.reduce((n, d) => n + d.items.length, 0);

  const days = [];
  for (let iso = start; ; iso = shiftDays(iso, 1)) {
    const covered = earliest.filter((e) => e <= iso).length;
    const v = byDate.get(iso) ?? 0;
    days.push({
      x: dmy(iso),
      iso,
      v,
      covered,
      partial: covered < total,
      tip: t('stats.tipDoneDay', { partial: covered < total, iso, v, covered, total }),
    });
    if (iso >= end) break;
  }
  return { days, total, dropped: dropped.length, droppedItems, start, end };
}

function kpis(s) {
  const g = score(s);
  const st = s.stats;
  return html`<div class="player-stats" style="margin-bottom:18px">
    <div class="pstat flame">${ulabel(t('stats.kStreak'))}<span class="v">${g.streak}<small>${t('unit.daysShort')}</small></span></div>
    <div class="pstat">${ulabel(t('stats.kRecorded'))}<span class="v">${s.timeline.reduce((n, d) => n + d.items.length, 0)}</span></div>
    <div class="pstat ${st.hotDecisions ? 'danger' : ''}">${ulabel(t('stats.kDecisions'))}<span class="v">${st.decisions}${st.hotDecisions ? html`<small>${t('stats.kHot', { n: st.hotDecisions })}</small>` : ''}</span></div>
    <div class="pstat">${ulabel(t('stats.kQueue'))}<span class="v">${s.queue.length}</span></div>
    <div class="pstat live">${ulabel(t('stats.kAwake'))}<span class="v">${st.awake}<small>/${st.sessions}</small></span></div>
  </div>`;
}

/* ── Việc đã xong ─────────────────────────────────────────────────────────── */

function chartDoneByDay(s) {
  const d = doneByDay(s);
  if (!d) return '';
  const partial = d.days.filter((x) => x.partial).length;

  // Ngày bị bỏ vì nằm ngoài cửa sổ phải được kể ra: một chart lặng lẽ cắt bớt dữ liệu
  // cũng là một chart nói dối, chỉ là nói dối kín đáo hơn.
  const cut = d.dropped
    ? t('stats.doneByDayCut', { dropped: d.dropped, max: MAX_DAYS, items: d.droppedItems })
    : '';

  return card({
    title: t('stats.doneByDay'),
    sub:
      (partial
        ? t('stats.doneByDaySubPartial', { days: d.days.length, partial })
        : t('stats.doneByDaySubFull', { days: d.days.length, total: d.total })) + cut,
    body: series({ id: 'done-by-day', data: d.days, color: COLOR.done }),
    table: tableTwin(
      [t('stats.cDate'), t('stats.cRecorded'), t('stats.cCovered')],
      d.days.map((x) => [x.iso, x.v, `${x.covered}/${d.total}`]),
      'done-by-day',
    ),
  });
}

function chartDoneByProject(s) {
  const by = new Map();
  for (const day of s.timeline) for (const i of day.items) by.set(i.project, (by.get(i.project) ?? 0) + 1);
  const rows = [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, v]) => ({ label, v, tip: t('stats.tipDoneProject', { label, v }) }));
  if (!rows.length) return '';

  return card({
    title: t('stats.doneByProject'),
    sub: t('stats.doneByProjectSub'),
    body: ranked({ id: 'done-by-project', rows, color: COLOR.done }),
    table: tableTwin([t('stats.cProject'), t('stats.cRecorded')], rows.map((r) => [r.label, r.v]), 'done-by-project'),
  });
}

/* ── Tồn đọng ─────────────────────────────────────────────────────────────── */

function chartDecisions(s) {
  const order = ['now', 'soon', 'later'];
  const by = new Map();
  for (const d of s.decisions) {
    if (!by.has(d.project)) by.set(d.project, { now: 0, soon: 0, later: 0 });
    const b = by.get(d.project);
    if (b[d.heat] !== undefined) b[d.heat]++;
  }
  const rows = [...by.entries()]
    .map(([label, b]) => ({
      label,
      total: order.reduce((n, h) => n + b[h], 0),
      parts: order.map((h) => ({
        v: b[h],
        color: HEAT_COLOR[h],
        // Giữ nguyên hoa/thường — độ nóng giờ là NHÃN của một hàng trong tooltip, không
        // còn là một mẩu ghép giữa câu.
        tip: t('stats.tipDecision', { label, v: b[h], heat: heatLabel(h) }),
      })),
      b,
    }))
    .sort((a, b) => b.b.now - a.b.now || b.total - a.total);
  if (!rows.length) return '';

  return card({
    title: t('stats.decisionsChart'),
    sub: t('stats.decisionsChartSub'),
    body: html`${stackedRows({ rows })}
      ${legend(order.map((h) => ({ color: HEAT_COLOR[h], icon: HEAT_ICON[h], label: heatLabel(h) })))}`,
    table: tableTwin(
      [t('stats.cProject'), ...order.map((h) => heatLabel(h)), t('stats.total')],
      rows.map((r) => [r.label, ...order.map((h) => r.b[h]), r.total]),
      'decisions',
    ),
  });
}

function chartQueue(s) {
  const by = new Map();
  for (const q of s.queue) by.set(q.project, (by.get(q.project) ?? 0) + 1);
  const rows = [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, v]) => ({ label, v, tip: t('stats.tipQueue', { label, v }) }));
  if (!rows.length) return '';

  return card({
    title: t('stats.queueChart'),
    sub: t('stats.queueChartSub', { n: s.queue.length }),
    body: ranked({ id: 'queue', rows, color: COLOR.queue }),
    table: tableTwin([t('stats.cProject'), t('stats.cPending')], rows.map((r) => [r.label, r.v]), 'queue'),
  });
}

/* ── Nhịp phiên ───────────────────────────────────────────────────────────── */

function chartSessionHours(s) {
  const bins = Array.from({ length: 24 }, () => 0);
  let known = 0;
  for (const x of s.sessions) {
    if (x.startedAt == null) continue;
    bins[new Date(x.startedAt).getHours()]++;
    known++;
  }
  if (!known) return '';

  const data = bins.map((v, h) => ({
    // Nhãn 3 giờ một lần: 24 nhãn cạnh nhau thì chồng lên nhau và không đọc được cái nào.
    x: h % 3 === 0 ? String(h) : '',
    v,
    tip: t('stats.tipHour', { h: String(h).padStart(2, '0'), v }),
  }));

  return card({
    wide: true,
    title: t('stats.hoursChart'),
    sub: t('stats.hoursChartSub', { n: known }),
    body: series({ id: 'session-hours', data, color: COLOR.session, height: 108 }),
    table: tableTwin(
      [t('stats.cHour'), t('stats.cSessions')],
      bins.map((v, h) => [`${String(h).padStart(2, '0')}:00`, v]).filter(([, v]) => v > 0),
      'session-hours',
    ),
  });
}

/* ── Màn ──────────────────────────────────────────────────────────────────── */

export function renderStats(s, q) {
  if (!s.projects.length) return empty('◔', t('stats.empty'), t('stats.emptyHint'));

  // Ô tìm cố ý KHÔNG lọc màn này: thống kê lọc một phần thì mọi con số đổi nghĩa
  // mà không nói ra. Thà báo thẳng là nó không áp dụng, còn hơn nuốt mất chart.
  return html`
    ${q ? html`<p class="ch-note" style="margin:0 0 16px">${t('stats.qNote', { q })}</p>` : ''}
    ${kpis(s)}

    <div class="sec-h">${ulabel(t('stats.doneSection'))}${skinSwitch()}${reportBtn('stats')}</div>
    <div class="ch-grid2">${chartDoneByDay(s)}${chartDoneByProject(s)}</div>
    <p class="ch-note">${raw(t('stats.note'))}</p>

    <div class="sec-h" style="margin-top:22px">${ulabel(t('stats.backlogSection'))}</div>
    <div class="ch-grid2">${chartDecisions(s)}${chartQueue(s)}</div>

    <div class="sec-h" style="margin-top:22px">${ulabel(t('stats.rhythmSection'))}</div>
    <div class="ch-grid2">${chartSessionHours(s)}</div>`;
}
