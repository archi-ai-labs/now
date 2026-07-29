import { html, ago, agoFrom, clock, raw } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copyCode, empty, matches, ulabel, bar } from './shared.js';
import { isRawSurface, surfaceIcon, surfaceName, surfaceOf } from '../lib/surface.js';

/**
 * Màn này trả lời câu hỏi mà NOW board KHÔNG trả lời được: hai chục phiên cùng
 * mở trong một repo thì phiên nào đang cầm mạch nào. Board chỉ ghi được tối đa
 * 3 `sideTracks`; ở đây đọc thẳng từ registry phiên + todo của từng phiên.
 */
function unit(x) {
  const td = x.todos;
  const pct = td && td.total ? Math.round((td.done / td.total) * 100) : 0;
  const doing = td?.active?.activeForm || td?.active?.subject || (td?.next ? t('sessions.next', { subject: td.next.subject }) : null);
  // Ký hiệu là của BỀ MẶT, không phải của `entrypoint`. Hai phiên cùng mang nhãn
  // `claude-vscode` mà một chạy trong Cursor một chạy trong VS Code thì trước đây đội
  // chung một ký hiệu — nhìn vào không biết mở cửa sổ nào để quay lại.
  const surface = surfaceOf(x);

  // Thời điểm hoạt động đứng ĐẦU dòng meta: khi một repo có hai chục phiên, thứ
  // dùng để nhận ra "cái mình vừa ở trong" là nó, không phải uuid.
  //
  // "NGỦ" thì không in ra: nó đã nằm ở màu viền trái, ở avatar xám, và ở dòng
  // "0 thức / 22" trên đầu nhóm. Chỉ trạng thái NGOẠI LỆ — đang thức — mới đáng
  // tốn mực. Cả cụm dồn về trái để mắt không phải nhảy ngang cả màn hình mới ghép
  // được tên phiên với giờ của nó.
  return html`<div class="unit ${x.sleeping ? 'sleeping' : 'awake'} ${t ? '' : 'no-cast'}">
    <span class="unit-av" title="${surfaceName(surface)}">${surfaceIcon(surface)}</span>

    <div>
      <div class="u-title">${x.title ?? x.name ?? x.short}</div>
      <div class="u-meta">
        ${x.sleeping
          ? html`<span>${t('sessions.asleep', { ago: ago(x.idleMs) })}</span>`
          : html`<span class="u-state">${t('sessions.awakeState', { ago: agoFrom(x.lastActivityAt) })}</span>`}
        <span>${x.short}</span>
        <span class="u-surface ${isRawSurface(surface) ? 'vague' : ''}">${surfaceName(surface)}</span>
        ${x.viaWorktree ? html`<span>⑂ ${x.viaWorktree}</span>` : ''}
        ${x.startedAt ? html`<span>${t('sessions.opened', { time: clock(x.startedAt) })}</span>` : ''}
      </div>
    </div>

    <div class="u-cast">
      ${td
        ? html`<div class="lbl"><span>${t('sessions.tasks', { done: td.done, total: td.total })}</span><span>${pct}%</span></div>
            ${bar(pct, pct === 100 ? 'var(--ok)' : 'var(--accent)', 'slim')}
            ${doing ? html`<div class="doing">${doing}</div>` : ''}`
        : ''}
    </div>

    <div class="u-right">
      ${copyCode(x.resumeCmd, 'resume')}
      ${x.ccdId ? copyCode(t('sessions.archivePrompt', { id: x.ccdId }), 'archive') : ''}
    </div>
  </div>`;
}


/**
 * Một hội thoại Antigravity.
 *
 * Cùng khuôn `.unit` với phiên Claude, và đó là chủ ý: chúng là hai loại việc khác
 * nhau nhưng cùng chiếm một chỗ trong đầu người dùng — "cái gì đang chạy ở dự án này".
 * Cho chúng hai kiểu thẻ khác nhau là bắt mắt học hai bảng chú giải cho một câu hỏi.
 *
 * Khác biệt thì nằm ở chỗ khác biệt THẬT: không có `resume` (Antigravity không có lệnh
 * nối lại từ ngoài), không có todo, và cột giữa đo bằng SỐ BƯỚC agent đã đi thay vì
 * tiến độ việc — vì đó là thứ sổ của nó ghi lại.
 */
function convoUnit(c) {
  return html`<div class="unit convo ${c.sleeping ? 'sleeping' : 'awake'}">
    <span class="unit-av" title="${surfaceName('antigravity')}">${surfaceIcon('antigravity')}</span>

    <div>
      <div class="u-title">${c.title ?? t('convo.untitled')}</div>
      <div class="u-meta">
        ${c.sleeping
          ? html`<span>${t('sessions.asleep', { ago: ago(c.idleMs) })}</span>`
          : html`<span class="u-state">${t('sessions.awakeState', { ago: agoFrom(c.at) })}</span>`}
        <span>${c.id.slice(0, 8)}</span>
        <span class="u-surface">${surfaceName('antigravity')}</span>
        ${c.steps ? html`<span>${t('convo.steps', { n: c.steps })}</span>` : ''}
        ${c.createdAt ? html`<span>${t('sessions.opened', { time: clock(c.createdAt) })}</span>` : ''}
      </div>
    </div>

    <div class="u-cast"></div>

    <div class="u-right">
      ${c.cwd
        ? html`<button type="button" class="copy code" data-open="${c.cwd}" data-open-app="antigravity"
            title="${c.cwd}">${t('convo.openIn')}</button>`
        : ''}
    </div>
  </div>`;
}

/**
 * Dải bề mặt — câu trả lời cho "sở chỉ huy này đang trông coi những gì".
 *
 * Chấm sáng = app đang chạy. Con số là đơn vị RIÊNG của từng bề mặt (phiên với Claude
 * Code, hội thoại với Antigravity) nên nhãn phải nói ra đơn vị, không được để trần một
 * con số rồi mặc cho người đọc tưởng chúng cùng loại mà đem so.
 */
function surfaceMeta(f) {
  // Chỉ kể những gì KHÁC 0. "0 phiên · 3 thư mục đang mở" bắt mắt đọc qua một con số
  // rỗng để tới con số thật; và với Cursor thì 0 phiên Claude là chuyện bình thường,
  // không phải một khoảng trống đáng báo.
  const bits = [];
  if (f.awake) bits.push(html`<b>${f.awake}</b> ${t('surface.running')}`);
  if (f.sessions) bits.push(f.convos ? t('surface.convos', { n: f.sessions }) : t('surface.sessions', { n: f.sessions }));
  // Hai nguồn khác nhau nên hai câu khác nhau: Cursor/VS Code đọc được DANH SÁCH CỬA SỔ
  // đang mở; Antigravity không có thứ đó, chỗ gần nhất đọc được trung thực là workspace
  // của những hội thoại còn thức. Dùng chung một chữ "đang mở" là hứa quá lời.
  if (f.folders?.length) bits.push(t(f.convos ? 'surface.foldersActive' : 'surface.folders', { n: f.folders.length }));
  if (!bits.length) bits.push(t(f.running ? 'surface.idle' : 'surface.off'));
  return html`${bits.map((b, i) => html`${i ? ' · ' : ''}${b}`)}`;
}

function surfaces(s) {
  const list = s.surfaces ?? [];
  if (!list.length) return '';
  return html`<section class="surf">
    ${list.map(
      (f) => html`<div class="surf-i ${f.running ? 'on' : 'off'}">
        <span class="surf-ic" aria-hidden="true">${surfaceIcon(f.key)}</span>
        <div class="surf-b">
          <div class="surf-n">${f.name}<span class="dot" aria-hidden="true"></span></div>
          <div class="surf-m">${surfaceMeta(f)}</div>
          ${f.folders?.length
            ? html`<div class="surf-f">
                ${f.folders.map(
                  (dir) => html`<button type="button" class="deb" data-open="${dir}" data-open-app="${f.key}"
                    title="${t('quest.openInTitle', { name: f.name })} — ${dir}">${dir.split('/').pop()}</button>`,
                )}
              </div>`
            : ''}
        </div>
      </div>`,
    )}
  </section>`;
}

export function renderSessions(s, q) {
  // Phiên Claude và hội thoại Antigravity gom vào CÙNG một nhóm dự án. Tách hai khối
  // riêng thì câu "dự án này đang có gì chạy" phải ghép từ hai chỗ trên màn hình — mà
  // đó đúng là câu duy nhất màn này tồn tại để trả lời.
  const groups = s.projects
    .map((p) => ({ name: p.name, group: p.group, sessions: p.sessions, convos: p.convos ?? [] }))
    .concat(
      s.unassignedSessions.length || (s.unassignedConvos?.length ?? 0)
        ? [{ name: t('sessions.unassigned'), sessions: s.unassignedSessions, convos: s.unassignedConvos ?? [] }]
        : [],
    )
    .map((g) => ({
      ...g,
      sessions: g.sessions
        .filter((x) => matches(q, x.title, x.name, x.short, x.folder, x.entrypoint, x.host, x.todos?.active?.subject))
        .sort((a, b) => Number(a.sleeping) - Number(b.sleeping) || (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0)),
      convos: g.convos
        .filter((c) => matches(q, c.title, c.folder, 'antigravity'))
        .sort((a, b) => Number(a.sleeping) - Number(b.sleeping) || (b.at ?? 0) - (a.at ?? 0)),
    }))
    .filter((g) => g.sessions.length || g.convos.length);

  if (!groups.length) return empty('◇', q ? t('sessions.noMatch') : t('sessions.empty'));

  const withTodos = s.sessions.filter((x) => x.todos).length;

  return html`
    <div class="player-stats" style="margin-bottom:14px">
      <div class="pstat live">${ulabel(t('sessions.statAwake'))}<span class="v">${s.stats.awake}<small>/${s.stats.sessions}</small></span></div>
      ${s.stats.convos
        ? html`<div class="pstat ${s.stats.convosAwake ? 'live' : ''}">${ulabel(t('sessions.statConvos'))}<span class="v">${s.stats.convosAwake}<small>/${s.stats.convos}</small></span></div>`
        : ''}
      <div class="pstat">${ulabel(t('sessions.statProjects'))}<span class="v">${groups.length}</span></div>
      <div class="pstat">${ulabel(t('sessions.statHasTodos'))}<span class="v">${withTodos}</span></div>
      ${s.ghostSessionFiles ? html`<div class="pstat">${ulabel(t('sessions.statGhost'))}<span class="v">${s.ghostSessionFiles}</span></div>` : ''}
    </div>

    ${surfaces(s)}

    ${groups.map((g) => {
      // Một repo có thể có hai chục phiên mở suốt ngày. Hiện hết thì trang thành
      // bãi rác; nên luôn hiện phiên đang thức + vài phiên ngủ gần nhất, phần
      // còn lại gập vào cho ai thực sự đi tìm.
      const all = [
        ...g.sessions.map((x) => ({ awake: !x.sleeping, at: x.lastActivityAt ?? 0, el: unit(x) })),
        ...g.convos.map((c) => ({ awake: !c.sleeping, at: c.at ?? 0, el: convoUnit(c) })),
      ].sort((a, b) => Number(a.awake ? 0 : 1) - Number(b.awake ? 0 : 1) || b.at - a.at);
      const awake = all.filter((x) => x.awake).length;
      const keep = Math.max(awake, Math.min(all.length, 5));
      const head = all.slice(0, keep);
      const rest = all.slice(keep);
      return html`<section class="sess-group">
        <div class="sess-group-h">
          <span class="n">${g.name}</span>
          ${g.group ? html`<span class="badge">${g.group}</span>` : ''}
          <span class="c">${t('sessions.awakeCount', { awake, total: all.length })}</span>
        </div>
        ${head.map((x) => x.el)}
        ${rest.length
          ? html`<details class="more" data-k="sess:${g.name}">
              <summary>${t('sessions.moreAsleep', { n: rest.length })}</summary>
              ${rest.map((x) => x.el)}
            </details>`
          : ''}
      </section>`;
    })}

    <div style="font:12px/1.7 var(--sans);color:var(--faint);margin-top:14px">
      ${raw(t('sessions.foot'))} ${copyCode('claude --resume <uuid>', 'claude --resume …')} ${t('sessions.footEnd')}
      <div style="margin-top:6px">${raw(t('sessions.footArchive'))}</div>
      ${s.stats.convos ? html`<div style="margin-top:6px">${t('surface.note')}</div>` : ''}
    </div>`;
}
