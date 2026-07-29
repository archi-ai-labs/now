import { html, agoFrom, ago } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { score, projectState } from '../lib/game.js';
import { heat, copyCode, empty, matches, healthLabel, integrity, hpColor, ulabel, bar } from './shared.js';
import { surfaceIcon, surfaceName } from '../lib/surface.js';

/**
 * Dải nhịp làm việc — bốn con số đếm thẳng được, không quy đổi.
 *
 * `chốt d-game`: thanh XP và huy hiệu hạng bị bỏ. Chúng chiếm nửa dải này để nói
 * một điều đã được nói bằng chính bốn con số bên phải, mà lại nói qua một thang
 * tự chế. Giờ chỉ còn số thật, và mỗi con số bấm được để sang đúng màn của nó.
 */
function pace(s) {
  const g = score(s);
  const st = s.stats;

  // Con số nào bấm được thì là <button>; con số nào chỉ để đọc thì vẫn là <span>.
  // Trước đây cả bốn đều là `<span>` và ba trong số đó lặng lẽ nhảy màn khi bấm —
  // không Tab tới được, và nhìn thì không phân biệt được cái nào bấm được.
  return html`<section class="strip">
    <span class="sst" title="${t('overview.streakTitle')}"><b>${g.streak}</b> ${t('overview.streakDays')}</span>
    <button type="button" class="sst" data-view="timeline"><b>${g.done7}</b> ${t('overview.done7')}</button>
    <button type="button" class="sst" data-view="sessions"><b>${st.awake}</b>/${st.sessions} ${t('overview.awakeSessions')}</button>
    ${st.hotDecisions
      ? html`<button type="button" class="sst hot" data-view="decisions"><b>${st.hotDecisions}</b> ${t('overview.hotBlocking')}</button>`
      : html`<span class="sst"><b>${g.fresh}</b>/${st.projects} ${t('overview.freshBoards')}</span>`}
  </section>`;
}

/** Trạng thái repo dạng ký hiệu ngắn — đọc bằng liếc, chi tiết nằm ở ngăn kéo. */
function repoFlags(p) {
  const out = [];
  const g = p.git;
  if (!g.isRepo) {
    return g.nestedIn
      ? [html`<span class="deb crit" title="${t('repo.nestedIn', { nestedIn: g.nestedIn })}">⌸ ${t('repo.nestedShort')}</span>`]
      : [html`<span class="deb">${t('repo.notRepo')}</span>`];
  }

  out.push(html`<span class="deb">${g.branch}</span>`);
  if (g.unknownCommit) out.push(html`<span class="deb crit" title="${t('repo.unknownCommitTitle')}">⚠ ${t('repo.unknownCommit')}</span>`);
  else if (g.driftCommits > 0) out.push(html`<span class="deb ${g.driftCommits >= 5 ? 'bad' : ''}" title="${t('repo.driftTitle')}">Δ${g.driftCommits}</span>`);
  if (g.dirty > 0) out.push(html`<span class="deb" title="${t('repo.dirtyTitle', { n: g.dirty })}">✗${g.dirty}</span>`);
  if (g.ahead) out.push(html`<span class="deb" title="${t('repo.aheadTitle')}">↑${g.ahead}</span>`);
  if (g.behind) out.push(html`<span class="deb" title="${t('repo.behindTitle')}">↓${g.behind}</span>`);

  const wt = g.worktrees ?? [];
  if (wt.length) {
    const warn = wt.filter((w) => w.warn).length;
    out.push(html`<span class="deb ${warn ? 'bad' : ''}" title="${t('repo.worktreeTitle')}">⑂${wt.length}${warn ? ' ⚠' : ''}</span>`);
  }
  return out;
}

function quest(p, thresholds, ides = []) {
  const f = p.now?.focus;
  const c = p.counts;
  const r = projectState(p);
  const hp = integrity(p, thresholds);
  const color = hpColor(p.health);
  const awake = p.sessions.filter((x) => !x.sleeping).length;
  const blockedNext = /^chốt\s/i.test(f?.nextAction ?? '');

  // Bề mặt đang mở dự án này. Đứng cạnh cờ repo vì cùng loại thông tin: trạng thái
  // NGOÀI board — thứ board không biết và cũng không nên biết.
  //
  // MỘT chip, chỉ ký hiệu. Viết đủ tên thì ba bề mặt ăn hết bề ngang hàng cờ, mà hàng
  // đó vốn nói bằng ký hiệu (`Δ5`, `✗2`, `⑂3`) — chen mấy cụm chữ vào giữa là phá luôn
  // nhịp đọc của nó. Tên vẫn còn nguyên ở tooltip và ở chữ cho trình đọc màn hình, chỗ
  // duy nhất nó thật sự cần: lúc muốn biết chính xác ký hiệu kia là app nào.
  const open = p.openIn ?? [];
  const names = open.map(surfaceName).join(', ');
  const openIn = open.length
    ? html`<span class="deb surf-chip" title="${t('quest.surfaceTitle', { names })}"
        >${open.map(surfaceIcon).join(' ')}<span class="vh">${t('quest.surfaceTitle', { names })}</span></span
      >`
    : '';

  const badges = [];
  if (c.hot) badges.push(html`<span class="badge hot" title="${t('quest.hot')}">◆ <b>${c.hot}</b></span>`);
  if (c.convos)
    badges.push(
      html`<span class="badge ${c.convosAwake ? 'live' : ''}" title="${t('quest.convoTitle', { n: c.convos })}"
        >${surfaceIcon('antigravity')} <b>${c.convosAwake || c.convos}</b></span
      >`,
    );
  if (c.decisions - c.hot > 0) badges.push(html`<span class="badge" title="${t('quest.decisions')}">◇ <b>${c.decisions - c.hot}</b></span>`);
  if (c.waiting) badges.push(html`<span class="badge" title="${t('quest.waiting')}">⧗ <b>${c.waiting}</b></span>`);
  if (c.queue) badges.push(html`<span class="badge" title="${t('quest.queue')}">▤ <b>${c.queue}</b></span>`);

  // Câu để nói lại với Claude khi quay lại dự án — thao tác hay làm nhất trên
  // trang này. Trước đây nó nằm sâu trong ngăn kéo: bấm thẻ → cuộn → mới chép
  // được. Đưa thẳng lên thẻ, hiện khi rê chuột để lúc chỉ liếc thì không ồn.
  const resume = f?.resume?.howToContinue;

  // Thẻ KHÔNG phải role=button: nó chứa sẵn ba nút bên trong (chép câu, mở thư
  // mục, xem board), mà nút lồng trong nút thì trình đọc màn hình đọc ra một mớ
  // vô nghĩa. Bấm cả thẻ vẫn mở được board — đó là tiện tay cho chuột; lối vào
  // chính thức cho bàn phím là nút "xem board đầy đủ" ở cuối thẻ.
  //
  // Nút đó mang data-open-project, KHÔNG phải data-project thứ hai: pathOf() nhận
  // diện phần tử bằng data-project, nên hai thứ cùng mang mã ấy trong một thẻ thì
  // khi khôi phục focus sau mỗi lượt quét, querySelector trả về cái đầu — là chính
  // <article>, vốn không focus được — và focus rơi về body. Cùng mã, khác tên.
  return html`<article class="quest hudp ${c.hot ? 'locked' : ''}" data-project="${p.id}"
    aria-labelledby="qn-${p.id}" style="--r-c:${r.color};--hp:${color}">
    <div class="in">
      <div class="q-head">
        <div style="min-width:0;flex:1">
          <h2 class="q-name" id="qn-${p.id}">${p.name}</h2>
          <div class="q-sub"><span class="st" style="--c:${r.color}">${r.label}</span>${p.group ? ` · ${p.group}` : ''}</div>
        </div>
        <div class="q-hp" title="${t('quest.hpTitle', { hp, label: healthLabel(p.health) })}">
          <span class="v">${hp}<small>%</small></span>
          ${bar(hp, color, 'slim')}
        </div>
      </div>

      <div class="q-debuff">${repoFlags(p)}${openIn}</div>

      <div class="q-body">
        ${f
          ? html`<div class="ulabel">
                <span class="ul-ic" aria-hidden="true">◎</span> ${t('quest.doing')}
                ${f.confidence === 'inferred'
                  ? html`<span class="tag" title="${t('quest.inferredTitle')}">${t('quest.inferred')}</span>`
                  : ''}
              </div>
              <div class="focus-title">${f.title}</div>
              <div class="next ${blockedNext ? 'blocked' : ''}">
                <span class="caret">❯</span><span>${f.nextAction}</span>
              </div>`
          : html`<div class="empty-focus">${t('quest.noFocus')}</div>`}
      </div>

      <div class="q-foot">
        <div class="badges">${badges.length ? badges : html`<span class="badge">${t('quest.clean')}</span>`}</div>
        <div class="party" title="${t('quest.partyTitle')}">
          <span class="slots">${p.sessions.slice(0, 8).map((x) => html`<i class="${x.sleeping ? '' : 'awake'}"></i>`)}</span>
          <span>${p.sessions.length ? `${awake}/${p.sessions.length}` : '—'}</span>
        </div>
      </div>

      <div class="q-act">
        ${resume
          ? html`<button type="button" class="qa" data-copy="${resume}" title="${resume}"
              aria-label="${t('quest.copyResumeAria', { name: p.name, resume })}">${t('quest.copyResume')}</button>`
          : html`<button type="button" class="qa" data-copy="/now update" title="${t('quest.noResumeTitle')}"
              aria-label="${t('quest.noResumeAria', { name: p.name })}">⧉ /now update</button>`}
        <button type="button" class="qa ghost" data-open="${p.path}" aria-label="${t('quest.openDirAria', { name: p.name })}">${t('quest.openDir')}</button>
        ${ides.map(
          (f) => html`<button type="button" class="qa ghost" data-open="${p.path}" data-open-app="${f.key}"
            title="${t('quest.openInTitle', { name: f.name })}"
            aria-label="${t('quest.openInAria', { project: p.name, name: f.name })}">${surfaceIcon(f.key)} ${f.name}</button>`,
        )}
        <button type="button" class="qa ghost more" data-open-project="${p.id}" aria-label="${t('quest.openBoardAria', { name: p.name })}">${t('quest.openBoard')}</button>
      </div>
    </div>
  </article>`;
}

/**
 * Editor có mặt trên máy này — nguồn của các nút "mở trong …" trên thẻ dự án.
 *
 * Suy từ `surfaces`, tức là chỉ hiện app THẬT SỰ đang chạy. Liệt kê cứng cả bốn editor
 * thì máy chỉ cài Cursor vẫn mọc ra nút "mở trong Windsurf", bấm vào thì hệ điều hành
 * mở hộp thoại "không tìm thấy ứng dụng" — một cái nút hứa điều nó không làm được.
 */
const ides = (s) => (s.surfaces ?? []).filter((f) => f.kind === 'ide' && f.running).map((f) => ({ key: f.key, name: f.name }));

export function renderOverview(s, q) {
  const shown = s.projects.filter((p) =>
    matches(q, p.name, p.id, p.group, p.now?.focus?.title, p.now?.focus?.nextAction, p.git.branch),
  );

  return html`
    ${q ? '' : pace(s)}
    ${shown.length
      ? html`<div class="grid">${shown.map((p) => quest(p, s.thresholds, ides(s)))}</div>`
      : s.projects.length
        ? empty('⌕', t('overview.noMatch'), t('overview.noMatchHint', { q }))
        : empty('◇', t('overview.noBoard'), t('overview.noBoardHint', { roots: s.roots.join(', ') }))}
    ${!q && s.orphans.length
      ? html`<div class="sec" style="margin-top:22px">
          <div class="sec-h">${ulabel(t('overview.orphans', { n: s.orphans.length }))}</div>
          <div class="badges">
            ${s.orphans.map((o) => html`<span class="badge" title="${o.path}">${o.name} <b>${t('health.ageShort', { n: o.ageDays })}</b></span>`)}
          </div>
          <div style="margin-top:9px;font:12px/1.6 var(--sans);color:var(--faint)">
            ${t('overview.orphansPre')} ${copyCode('/now update')} ${t('overview.orphansPost')}
          </div>
        </div>`
      : ''}`;
}

/* ── Ngăn kéo chi tiết ───────────────────────────────────────────────────── */

function focusBlock(f, p) {
  if (!f) return html`<div class="field-v" style="color:var(--faint)">${t('focus.none')}</div>`;
  const blockNote = new Map((f.blockedBy ?? []).map((b) => [b.id, b.note]));
  const decisionTitle = (id) => p.now?.decisionsNeeded?.find((d) => d.id === id)?.title ?? id;

  return html`
    <div class="field">
      <div class="field-k">${ulabel(t('focus.context'))}</div>
      <div class="field-v">${f.context}</div>
    </div>
    <div class="field">
      <div class="field-k">${ulabel(t('focus.now'))}</div>
      <div class="next"><span class="caret">❯</span><span>${f.nextAction}</span></div>
    </div>
    ${f.laterSteps?.length
      ? html`<div class="field">
          <div class="field-k">${ulabel(t('focus.later'))}</div>
          <ul class="steps">${f.laterSteps.map((x) => html`<li>${x}</li>`)}</ul>
        </div>`
      : ''}
    ${f.blockedBy?.length
      ? html`<div class="field">
          <div class="field-k">${ulabel(t('focus.blockedBy'))}</div>
          <ul class="steps">
            ${f.blockedBy.map(
              (b) => html`<li class="blocked">
                <b>[${b.id}]</b> ${decisionTitle(b.id)}${blockNote.get(b.id) ? ` — ${blockNote.get(b.id)}` : ''}
              </li>`,
            )}
          </ul>
        </div>`
      : ''}
    <div class="field">
      <div class="field-k">${ulabel(t('focus.repoState'))}</div>
      <div class="field-v mono">${f.resume?.workingState}</div>
    </div>
    <div class="field">
      <div class="field-k">${ulabel(t('focus.continue'))}</div>
      <div class="field-v cmd">${copyCode(f.resume?.howToContinue ?? '')}</div>
    </div>
    ${f.refs?.length
      ? html`<div class="field">
          <div class="field-k">${ulabel(t('focus.refs'))}</div>
          <div class="badges">${f.refs.map((r) => html`<span class="badge">${r.label} · ${r.ref}</span>`)}</div>
        </div>`
      : ''}`;
}

export function overviewDrawer(p, thresholds) {
  const n = p.now;
  const wt = p.git.worktrees ?? [];
  const hp = integrity(p, thresholds);
  const color = hpColor(p.health);
  const r = projectState(p);

  return html`
    <div class="sec">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="flex:1;min-width:0">
          <div class="q-hp-top" style="--hp:${color}">
            <span class="l">${t('drawer.freshness')}</span><span class="v">${hp}% · ${healthLabel(p.health)} · <span class="st" style="--c:${r.color}">${r.label}</span></span>
          </div>
          ${bar(hp, color, 'tall')}
        </div>
      </div>
      <div class="badges" style="margin-bottom:10px">
        <span class="badge">${p.git.branch ?? '—'}</span>
        ${p.ageDays != null ? html`<span class="badge">${p.ageDays === 0 ? t('drawer.updatedToday') : t('drawer.updatedAgo', { n: p.ageDays })}</span>` : ''}
        ${p.git.driftCommits ? html`<span class="badge">${t('drawer.driftBadge', { n: p.git.driftCommits })}</span>` : ''}
        <button type="button" class="btn" data-open="${p.path}">${t('drawer.openDir')}</button>
      </div>
      <div class="field-v mono" style="font-size:10.5px;color:var(--faint)">${p.path}</div>
    </div>

    ${p.parseError
      ? html`<div class="sec"><div class="hitem"><span class="ic">✖</span><div class="b">
          <div class="t">${t('drawer.parseError')}</div><div class="d">${p.parseError}</div></div></div></div>`
      : ''}
    ${p.schemaErrors.length
      ? html`<div class="sec">
          <div class="sec-h">${ulabel(t('drawer.schemaError'))}</div>
          <ul class="steps">${p.schemaErrors.map((e) => html`<li class="blocked">${e}</li>`)}</ul>
        </div>`
      : ''}

    <div class="sec">
      <div class="sec-h">${ulabel(t('drawer.doing'))}</div>
      ${n?.focus ? html`<div class="focus-title" style="margin-bottom:12px">${n.focus.title}</div>` : ''}
      ${focusBlock(n?.focus, p)}
    </div>

    ${n?.sideTracks?.length
      ? html`<div class="sec">
          <div class="sec-h">${ulabel(t('drawer.sideTracks'))}</div>
          ${n.sideTracks.map(
            (side) => html`<div class="field">
              <div class="field-v">${side.title}</div>
              ${side.owner ? html`<div class="field-v mono">${side.owner}</div>` : ''}
            </div>`,
          )}
        </div>`
      : ''}

    ${n?.decisionsNeeded?.length
      ? html`<div class="sec">
          <div class="sec-h">${ulabel(t('drawer.decisions'))}</div>
          <table class="tbl">
            <thead><tr><th>${t('drawer.dHeat')}</th><th>${t('drawer.dWhat')}</th><th>${t('drawer.dClose')}</th></tr></thead>
            <tbody>
              ${n.decisionsNeeded.map(
                (d) => html`<tr>
                  <td>${heat(d.heat)}</td>
                  <td>
                    <div style="font-weight:650">${d.title}</div>
                    ${d.question ? html`<div style="color:var(--dim);margin-top:3px">${d.question}</div>` : ''}
                    <div style="color:var(--faint);font:10.5px var(--mono);margin-top:5px">${t('drawer.locks', { blocks: d.blocks })}</div>
                  </td>
                  <td>${d.id ? copyCode(`chốt ${d.id}: `, `chốt ${d.id}`) : '—'}</td>
                </tr>`,
              )}
            </tbody>
          </table>
        </div>`
      : ''}

    ${n?.waitingOn?.length
      ? html`<div class="sec">
          <div class="sec-h">${ulabel(t('drawer.waiting'))}</div>
          ${n.waitingOn.map(
            (w) => html`<div class="field">
              <div class="field-v"><b>${w.who}</b> — ${w.what}</div>
              ${w.since ? html`<div style="font:10.5px var(--mono);color:var(--faint)">${t('drawer.since', { since: w.since })}</div>` : ''}
            </div>`,
          )}
        </div>`
      : ''}

    ${n?.upNext?.length
      ? html`<div class="sec">
          <div class="sec-h">${ulabel(t('drawer.queue'))}</div>
          <ul class="steps">${n.upNext.map((u) => html`<li>${u.title}</li>`)}</ul>
        </div>`
      : ''}

    ${wt.length
      ? html`<div class="sec">
          <div class="sec-h">${ulabel(t('drawer.worktrees'))}</div>
          ${wt.map(
            (w) => html`<div class="hitem">
              <span class="ic">${w.warn ? '⚠' : '⑂'}</span>
              <div class="b">
                <div class="t">${w.name} · ${w.branch ?? t('wt.detached')}</div>
                <div class="d">
                  ${w.inTmp ? t('wt.inTmp') : ''}
                  ${w.dirty ? t('wt.dirty', { n: w.dirty }) : ''}
                  ${!w.warn ? t('wt.clean') : ''}
                </div>
                <div class="field-v mono" style="font-size:10.5px;margin-top:4px">${w.path}</div>
              </div>
            </div>`,
          )}
        </div>`
      : ''}

    ${p.sessions.length
      ? html`<div class="sec">
          <div class="sec-h">${ulabel(t('drawer.sessions', { n: p.sessions.length }))}</div>
          ${p.sessions.map(
            (x) => html`<div class="unit ${x.sleeping ? 'sleeping' : 'awake'}">
              <span class="unit-av">${x.sleeping ? '◇' : '◆'}</span>
              <div>
                <div class="u-title">${x.title ?? x.name ?? x.short}</div>
                <div class="u-meta"><span>${x.entrypoint}</span><span>${x.short}</span>${x.viaWorktree ? html`<span>⑂ ${x.viaWorktree}</span>` : ''}</div>
              </div>
              <div class="u-cast">${x.todos ? html`<span style="font:10.5px var(--mono);color:var(--dim)">${x.todos.done}/${x.todos.total}</span>` : ''}</div>
              <div class="u-right">${x.sleeping ? t('drawer.asleep', { ago: ago(x.idleMs) }) : agoFrom(x.lastActivityAt)}</div>
            </div>`,
          )}
        </div>`
      : ''}

    ${n?.recentlyDone?.length
      ? html`<div class="sec">
          <div class="sec-h">${ulabel(t('drawer.recentlyDone'))}</div>
          ${n.recentlyDone.map(
            (d) => html`<div class="done-item"><span class="r">${d.date}</span><span class="t">${d.title}</span></div>`,
          )}
        </div>`
      : ''}

    ${p.hasMd
      ? html`<div class="sec">
          <div class="sec-h">${ulabel(t('drawer.mdFull'))}</div>
          <button type="button" class="btn" data-md="${p.id}">${t('drawer.mdRead')}</button>
          <div id="nowmd"></div>
        </div>`
      : ''}

    <div class="sec">
      <div class="sec-h">${ulabel(t('drawer.commands'))}</div>
      <div class="badges">
        ${copyCode(`cd ${p.path} && claude`, t('drawer.openClaudeHere'))}
        ${copyCode('/now update', t('drawer.updateBoard'))}
      </div>
    </div>`;
}
