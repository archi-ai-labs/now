import { html } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { threat } from '../lib/game.js';
import { projectChip, copyCode, empty, matches, HEAT_ICON, heatLabel, ulabel, bar } from './shared.js';

/**
 * Bảng quyết định xuyên dự án. Ở `/now` mỗi repo tự in bảng của mình; giá trị
 * của màn này là gom tất cả lại rồi xếp theo **độ gấp** — hai quyết định cùng
 * mức `now` vẫn phải nói được nên trả lời cái nào trước.
 */
/**
 * Cột "độ nóng" cố ý KHÔNG lặp lại trong từng hàng: cả khối đã nằm dưới tiêu đề
 * “SẮP CHẶN · 6” rồi, in thêm chữ “SẮP CHẶN” sáu lần chỉ ăn chiều ngang mà không
 * thêm thông tin. Cái phân biệt được các hàng trong cùng một khối là **độ gấp** —
 * nên đó là thứ duy nhất còn lại ở cột đầu.
 */
function row(d) {
  const th = threat(d);
  const c = th >= 70 ? 'var(--now)' : th >= 40 ? 'var(--soon)' : 'var(--later)';
  return html`<tr>
    <td style="width:104px">
      <div class="urg"><b style="color:${c}">${th}<small>%</small></b>${bar(th, c, 'slim')}</div>
      ${d.blocksFocus ? html`<div class="blocks-focus">${t('decisions.blocksFocus')}</div>` : ''}
    </td>
    <td>${projectChip(d.project)}</td>
    <td>
      <div style="font-weight:650">${d.title}</div>
      ${d.question ? html`<div style="color:var(--dim);margin-top:4px">${d.question}</div>` : ''}
    </td>
    <td style="color:var(--dim)">
      ${d.blocks}
      ${d.ageDays != null ? html`<div style="color:var(--faint);font:10.5px var(--mono);margin-top:4px">${t('decisions.pending', { n: d.ageDays })}</div>` : ''}
    </td>
    <td>${d.id ? copyCode(`chốt ${d.id}: `, `chốt ${d.id}`) : html`<span style="color:var(--faint)">${t('decisions.noId')}</span>`}</td>
  </tr>`;
}

export function renderDecisions(s, q) {
  const shown = s.decisions.filter((d) => matches(q, d.title, d.question, d.blocks, d.project, d.id));
  const waiting = s.waiting.filter((w) => matches(q, w.what, w.who, w.project));

  if (!shown.length && !waiting.length) {
    return empty('◇', q ? t('decisions.noMatch') : t('decisions.empty'), t('decisions.emptyHint'));
  }

  const byHeat = ['now', 'soon', 'later']
    .map((h) => [h, shown.filter((d) => d.heat === h).sort((a, b) => threat(b) - threat(a))])
    .filter(([, l]) => l.length);

  return html`
    ${byHeat.map(
      ([h, list]) => html`<section class="sec">
        <div class="sec-h" style="--sh:var(--${h})">${ulabel(t('decisions.section', { icon: HEAT_ICON[h], label: heatLabel(h), n: list.length }))}</div>
        <table class="tbl">
          <thead><tr><th>${t('decisions.hUrg')}</th><th>${t('decisions.hProject')}</th><th>${t('decisions.hWhat')}</th><th>${t('decisions.hLocks')}</th><th>${t('decisions.hClose')}</th></tr></thead>
          <tbody>${list.map(row)}</tbody>
        </table>
      </section>`,
    )}

    ${waiting.length
      ? html`<section class="sec">
          <div class="sec-h">${ulabel(t('decisions.waiting'))}</div>
          <table class="tbl">
            <thead><tr><th>${t('decisions.wProject')}</th><th>${t('decisions.wWho')}</th><th>${t('decisions.wWhat')}</th><th>${t('decisions.wSince')}</th></tr></thead>
            <tbody>
              ${waiting.map(
                (w) => html`<tr>
                  <td>${projectChip(w.project)}</td>
                  <td style="font-weight:650">${w.who}</td>
                  <td style="color:var(--dim)">${w.what}</td>
                  <td style="white-space:nowrap">
                    <span style="font:11px var(--mono)">${w.since ?? '—'}</span>
                    ${w.nudge ? html`<div style="color:var(--warn);font:10.5px var(--mono);margin-top:4px">${t('decisions.nudge', { n: w.ageDays })}</div>` : ''}
                  </td>
                </tr>`,
              )}
            </tbody>
          </table>
        </section>`
      : ''}

    <div style="font:12px/1.8 var(--sans);color:var(--faint)">
      ${t('decisions.footPre')} ${copyCode('chốt <mã>: …')} ${t('decisions.footMid')} ${copyCode('/now update')}${t('decisions.footEnd')}
    </div>`;
}
