import { html, agoFrom, raw } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copyCode, empty, matches, healthLabel, ulabel, bar, integrity, hpColor } from './shared.js';

/**
 * Danh sách vệ sinh: những thứ khiến dashboard nói dối nếu để lâu.
 * Sắp theo mức độ "làm sai lệch bức tranh" chứ không theo loại lỗi.
 */
function item(icon, title, desc, action) {
  return {
    search: `${title} ${desc}`,
    node: html`<div class="hitem">
      <span class="ic">${icon}</span>
      <div class="b"><div class="t">${title}</div><div class="d">${desc}</div></div>
      ${action ? html`<div class="a">${action}</div>` : ''}
    </div>`,
  };
}

export function renderHealth(s, q) {
  const rows = [];

  for (const p of s.projects) {
    if (p.parseError) rows.push(item('✖', t('health.parseError', { name: p.name }), p.parseError, copyCode('/now update')));
    for (const e of p.schemaErrors) rows.push(item('⚠', t('health.schemaError', { name: p.name }), e, copyCode('/now update')));

    if (p.git.nestedIn) {
      rows.push(
        item(
          '⌸',
          t('health.nested', { name: p.name }),
          t('health.nestedDesc', { nestedIn: p.git.nestedIn }),
          copyCode(`git -C ${p.path} init`, t('health.splitRepo')),
        ),
      );
    } else if (p.git.unknownCommit) {
      rows.push(
        item(
          '◎',
          t('health.unknownCommit', { name: p.name }),
          t('health.unknownCommitDesc', { commit: p.now?.updatedAtCommit }),
          copyCode('/now update'),
        ),
      );
    } else if (p.health === 'stale') {
      rows.push(
        item(
          '⧗',
          t('health.stale', { name: p.name }),
          t('health.staleDesc', { ageDays: p.ageDays, drift: p.git.driftCommits ?? 0 }),
          copyCode('/now update'),
        ),
      );
    } else if (p.health === 'drifting') {
      rows.push(
        item(
          '∿',
          t('health.drifting', { name: p.name }),
          t('health.driftingDesc', { ageDays: p.ageDays, drift: p.git.driftCommits ?? 0 }),
          copyCode('/now update'),
        ),
      );
    }

    if (!p.hasMd) rows.push(item('▤', t('health.noMd', { name: p.name }), t('health.noMdDesc'), copyCode('/now update')));

    for (const w of (p.git.worktrees ?? []).filter((x) => x.warn)) {
      const why = [
        w.inTmp ? t('health.wtInTmp') : null,
        w.dirty ? t('health.wtDirty', { n: w.dirty }) : null,
        w.prunable ? t('health.wtPrunable') : null,
      ]
        .filter(Boolean)
        .join(', ');
      rows.push(
        item(
          '⑂',
          t('health.wt', { name: p.name, wname: w.name }),
          t('health.wtDesc', { branch: w.branch ?? t('wt.detached'), why }),
          w.inTmp
            ? copyCode(`git -C ${p.path} worktree move ${w.path} `, t('health.wtMove'))
            : copyCode(`git -C ${p.path} worktree prune`, t('health.wtPrune')),
        ),
      );
    }
  }

  const shown = rows.filter((r) => matches(q, r.search)).map((r) => r.node);

  // Con số này phải đếm ĐÚNG số dòng hiện ra ngay bên dưới. Lấy từ `stats` thì nó
  // bỏ sót board đang lệch và các thiếu sót khác, thành ra ô ghi "1" trong khi
  // danh sách có chín dòng — mà một cái đồng hồ sai thì thà bỏ đi còn hơn.
  const chores = rows.length;

  // Repo chưa có board thì bảy dòng đều nói y một câu; xếp thành bảy dòng riêng
  // là đẩy hai việc thật sự cần làm ra khỏi tầm mắt. Gộp lại một khối, mỗi repo
  // một chip bấm được.
  const orphans = s.orphans.filter((o) => matches(q, `${o.name} ${o.branch}`));

  return html`
    <div class="player-stats" style="margin-bottom:16px">
      <div class="pstat ${chores ? 'danger' : ''}">${ulabel(t('health.statChores'))}<span class="v">${chores}</span></div>
      <div class="pstat live">${ulabel(t('health.statFresh'))}<span class="v">${s.projects.filter((p) => p.health === 'fresh').length}<small>/${s.stats.projects}</small></span></div>
      <div class="pstat">${ulabel(t('health.statOrphans'))}<span class="v">${s.stats.orphans}</span></div>
      <div class="pstat">${ulabel(t('health.statScan'))}<span class="v">${s.buildMs}<small>ms</small></span></div>
    </div>

    ${shown.length
      ? shown
      : orphans.length
        ? ''
        : empty('◈', t('health.clean'), t('health.cleanHint'))}

    ${orphans.length
      ? html`<section class="sec" style="margin-top:${shown.length ? '20px' : '0'}">
          <div class="sec-h">${ulabel(t('health.orphans', { n: orphans.length }))}</div>
          <div class="orphans">
            ${orphans.map(
              (o) => html`<button type="button" class="orphan" data-copy="cd ${o.path} && claude"
                title="${t('health.orphanTitle', { branch: o.branch })}"
                aria-label="${t('health.orphanAria', { name: o.name, ago: agoFrom(o.lastCommitAt), branch: o.branch })}">
                <b>${o.name}</b><span class="a">${agoFrom(o.lastCommitAt)}</span>
              </button>`,
            )}
          </div>
          <div style="font:12px/1.6 var(--sans);color:var(--faint);margin-top:9px">
            ${t('health.orphansPre')} ${copyCode('/now update')}.
          </div>
        </section>`
      : ''}

    <!-- Tích hợp NOW bằng prompt chat. Claude Code đã có /now update, nhưng hai bề mặt
         kia (Cursor, Antigravity) không chạy skill đó — với chúng, đường duy nhất để một
         repo có board là DÁN một prompt tự đứng được vào chat của agent đang làm việc
         trong repo. Prompt nằm trong i18n chứ không sinh động: nội dung của nó là hợp
         đồng với schema, không phụ thuộc dữ liệu lượt quét nào.
         data-k để trạng thái mở của khối xem-trước sống qua lượt vẽ lại 30 giây.
         (Không dùng backtick trong comment ở đây: cả khối nằm trong một template
         literal, một backtick lẻ đóng luôn chuỗi — bẫy đã gặp ở views/usage.js.) -->
    <section class="sec" style="margin-top:24px">
      <div class="sec-h">${ulabel(t('health.integrate'))}</div>
      <div style="font:12px/1.7 var(--sans);color:var(--faint);margin-bottom:10px">${t('health.integrateDesc')}</div>
      <button type="button" class="copy code" data-copy="${t('health.nowPrompt')}" aria-label="${t('health.integrateCopyAria')}">
        ${t('health.integrateCopy')}
      </button>
      <details class="q-help" data-k="health:nowprompt">
        <summary>${t('health.integrateShow')}</summary>
        <pre class="prompt-pre">${t('health.nowPrompt')}</pre>
      </details>
    </section>

    <section class="sec" style="margin-top:24px">
      <div class="sec-h">${ulabel(t('health.boardTable'))}</div>
      <table class="tbl">
        <thead><tr><th>${t('health.tProject')}</th><th>${t('health.tFresh')}</th><th>${t('health.tBranch')}</th><th>${t('health.tAge')}</th><th>${t('health.tDrift')}</th><th>${t('health.tDirty')}</th><th>${t('health.tSessions')}</th></tr></thead>
        <tbody>
          ${s.projects.map((p) => {
            const hp = integrity(p, s.thresholds);
            return html`<tr>
              <td><b>${p.name}</b><div style="color:var(--faint);font:10px var(--mono)">${p.id}</div></td>
              <td style="white-space:nowrap">
                <div style="width:96px">${bar(hp, hpColor(p.health), 'slim')}</div>
                <span style="font:10.5px var(--mono);color:var(--faint)">${hp}% ${healthLabel(p.health)}</span>
              </td>
              <td><code>${p.git.branch ?? '—'}</code></td>
              <td>${p.ageDays == null ? '—' : p.ageDays === 0 ? t('health.today') : t('health.ageShort', { n: p.ageDays })}</td>
              <td>${p.git.unknownCommit ? '?' : (p.git.driftCommits ?? 0)}</td>
              <td>${p.git.dirty}</td>
              <td>${p.counts.awake}/${p.counts.sessions}</td>
            </tr>`;
          })}
        </tbody>
      </table>
    </section>

    <section class="sec">
      <div class="sec-h">${ulabel(t('health.thresholds'))}</div>
      <table class="tbl">
        <thead><tr><th>${t('health.thState')}</th><th>${t('health.thCond')}</th><th>${t('health.thMean')}</th></tr></thead>
        <tbody>
          <tr><td style="color:var(--ok)">${healthLabel('fresh')}</td><td>${t('health.thFreshCond', { days: s.thresholds.driftDays, commits: s.thresholds.driftCommits })}</td><td>${t('health.thFreshMean')}</td></tr>
          <tr><td style="color:var(--warn)">${healthLabel('drifting')}</td><td>${t('health.thDriftCond', { days: s.thresholds.driftDays, commits: s.thresholds.driftCommits })}</td><td>${t('health.thDriftMean')}</td></tr>
          <tr><td style="color:var(--bad)">${healthLabel('stale')}</td><td>${t('health.thStaleCond', { days: s.thresholds.staleDays, commits: s.thresholds.staleCommits })}</td><td>${t('health.thStaleMean')}</td></tr>
        </tbody>
      </table>
      <div style="font:12px/1.7 var(--sans);color:var(--faint);margin-top:10px">
        ${raw(t('health.footPre'))} ${copyCode('/now update')} ${t('health.footEnd')}
      </div>
    </section>`;
}
