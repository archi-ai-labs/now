import { html, dayLabel } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { score } from '../lib/game.js';
import { projectChip, empty, matches, ulabel, bar } from './shared.js';

/**
 * Gom `recentlyDone` mọi dự án theo ngày. Mỗi board chỉ giữ 5 mục gần nhất nên
 * đây không phải nhật ký đầy đủ — nó là câu trả lời cho "mấy hôm nay mình làm
 * được cái gì", thứ hay quên nhất khi nhảy qua lại nhiều dự án.
 */
export function renderTimeline(s, q) {
  const days = s.timeline
    .map((d) => ({ ...d, items: d.items.filter((i) => matches(q, i.title, i.project, i.ref)) }))
    .filter((d) => d.items.length);

  if (!days.length) return empty('✦', q ? t('timeline.noMatch') : t('timeline.empty'));

  const g = score(s);
  const total = days.reduce((n, d) => n + d.items.length, 0);
  const best = Math.max(...days.map((d) => d.items.length));

  return html`
    <div class="player-stats" style="margin-bottom:16px">
      <div class="pstat flame">${ulabel(t('timeline.streak'))}<span class="v">${g.streak}<small>${t('unit.daysShort')}</small></span></div>
      <div class="pstat">${ulabel(t('timeline.done7'))}<span class="v">${g.done7}</span></div>
      <div class="pstat">${ulabel(t('timeline.best'))}<span class="v">${best}</span></div>
      <div class="pstat">${ulabel(t('timeline.total'))}<span class="v">${total}</span></div>
    </div>

    ${days.map((d) => {
      // Thanh mỗi ngày so với ngày làm được nhiều nhất — thấy ngay hôm nào là
      // hôm cày, hôm nào chỉ lướt qua.
      const pct = Math.round((d.items.length / best) * 100);
      return html`<div class="day">
        <div class="day-h">
          <div class="d">${dayLabel(d.date)}</div>
          <div class="s">${d.date}</div>
          <div class="xp">${t('timeline.tasks', { n: d.items.length })}</div>
          <div style="margin-top:5px">${bar(pct, 'var(--accent)', 'slim')}</div>
        </div>
        <div class="day-items">
          ${d.items.map(
            (i) => html`<div class="done-item">
              ${projectChip(i.project)}
              <span class="t">${i.title}</span>
              ${i.ref ? html`<span class="r">${i.ref}</span>` : ''}
            </div>`,
          )}
        </div>
      </div>`;
    })}`;
}
