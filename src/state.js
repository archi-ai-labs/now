import path from 'node:path';
import fs from 'node:fs/promises';
import { PROJECT_ROOTS, ORPHAN_ACTIVE_DAYS, WAITING_NUDGE_DAYS, HEALTH } from './config.js';
import { scanRoots, readBoard, healthOf, daysSince } from './collect/now.js';
import { collectGit } from './collect/git.js';
import { collectSessions } from './collect/sessions.js';
import { collectUsage } from './collect/usage.js';
import { collectQuota } from './collect/quota.js';
import { collectCursor } from './collect/cursor.js';
import { collectCursorEvents } from './collect/cursorevents.js';
import { trackQuota } from './collect/quotalog.js';
import { trackAgCycles, trackCursorCycles } from './collect/cycletrack.js';
import { collectLookback } from './collect/lookback.js';
import { collectAntigravity } from './collect/antigravity.js';
import { collectAgTurns } from './collect/agturns.js';
import { collectAgQuota } from './collect/agquota.js';
import { collectPlans } from './collect/plans.js';
import { collectEditors } from './collect/editors.js';
import { syncHosts } from './collect/hosts.js';
import { appRunning } from './collect/procs.js';
import { mapLimit, git, drainRunFailures } from './lib/sh.js';

const HEAT_RANK = { now: 0, soon: 1, later: 2 };

/** Nhãn ngắn cho nhóm dự án — thư mục cha ngay dưới root (vd `archimonde12`, `local`). */
function groupOf(dir) {
  for (const root of PROJECT_ROOTS) {
    if (dir.startsWith(root + path.sep)) {
      const rel = dir.slice(root.length + 1);
      const parts = rel.split(path.sep);
      return parts.length > 1 ? parts[0] : null;
    }
  }
  return null;
}

function relOf(dir) {
  for (const root of PROJECT_ROOTS) {
    if (dir.startsWith(root + path.sep)) return dir.slice(root.length + 1);
  }
  return dir;
}

/**
 * Tên nhánh đọc thẳng từ `.git/HEAD`, không spawn `git`.
 *
 * Repo chưa có board chiếm tới 15 trong 44 lần spawn mỗi lượt quét, mà thứ duy nhất cần
 * ở chúng là tên nhánh — một dòng `ref: refs/heads/<tên>`. Định dạng này ổn định từ đời
 * đầu của git. Worktree phụ có `.git` là FILE trỏ sang chỗ khác nên đọc hụt là chuyện
 * bình thường: trả `null` rồi thôi, không đáng đánh đổi một tiến trình con.
 */
async function headBranch(dir) {
  try {
    const head = await fs.readFile(path.join(dir, '.git', 'HEAD'), 'utf8');
    const m = head.match(/^ref:\s*refs\/heads\/(.+)$/m);
    return m ? m[1].trim() : 'detached';
  } catch {
    return null;
  }
}

/** Số ngày kể từ một chuỗi ngày tự do (`since` trong board có thể là YYYY-MM-DD hoặc chữ). */
function ageFromSince(since) {
  if (!since) return null;
  const m = String(since).match(/\d{4}-\d{2}-\d{2}/);
  return m ? daysSince(m[0]) : null;
}

/**
 * `watched` = có người đang thực sự nhìn dashboard. `badge` = mục trên thanh menu đang hỏi.
 *
 * Chỉ ba nguồn hạn mức quan tâm tới hai cờ này — Claude, Cursor, Antigravity — và chỉ vì
 * chúng là những nguồn duy nhất phải GỌI RA NGOÀI. Mọi thứ khác đọc đĩa nên quét không ai
 * xem cũng chẳng phiền tới ai.
 *
 * Hai cờ chứ không phải một, vì hai bề mặt cho xem hai lượng thông tin khác nhau. Mục trên
 * thanh menu in ĐÚNG hai con số của Claude (xem `badgeOf` trong `server.js`) — nó là một
 * người đọc thật, nên nó phải giữ được lượt gọi Claude sống; nhưng nó không in gì của
 * Cursor hay Antigravity, nên đánh thức hai nguồn kia theo nó là trả tiền cho thứ không
 * hiện lên đâu cả. Popover thì bày cả ba, và popover hỏi `/api/state` với `watched`.
 */
/**
 * Cửa sổ hạn mức Claude, phẳng hoá thành đầu vào của `collectUsage`.
 *
 * Khoá phải TRÙNG với `windowsOf` trong `public/lib/quota.js` — `five`, `seven`,
 * `scoped-<i>` — vì đó là chỗ hai nửa gặp nhau. Trùng bằng quy ước, không có gì bắt được
 * lúc nó lệch, nên hai chỗ đó nhắc tên nhau.
 */
function spendWindows(quota) {
  if (!quota?.ok) return [];
  const out = [];
  const add = (key, w, model = null) => {
    if (w?.resetsAt == null || !w.windowMs) return;
    out.push({ key, startMs: w.resetsAt - w.windowMs, model });
  };
  add('five', quota.fiveHour);
  add('seven', quota.sevenDay);
  for (const [i, w] of (quota.scoped ?? []).entries()) add(`scoped-${i}`, w, w.model);
  return out;
}

/**
 * Gắn tiền-theo-cửa-sổ vào từng cửa sổ, bằng BẢN SAO.
 *
 * Không sửa tại chỗ: `collectQuota` giữ memo và trả lại đúng object đó cho lượt quét sau,
 * nên viết vào nó là để một trị của lượt này sống lẫn sang lượt khác — kiểu lỗi chỉ hiện
 * ra sau khi hạn mức reset.
 */
function withSpend(quota, spentIn) {
  if (!quota?.ok || !spentIn) return quota;
  const put = (w, key) => (w && spentIn[key] ? { ...w, spent: spentIn[key] } : w);
  return {
    ...quota,
    fiveHour: put(quota.fiveHour, 'five'),
    sevenDay: put(quota.sevenDay, 'seven'),
    scoped: (quota.scoped ?? []).map((w, i) => put(w, `scoped-${i}`)),
  };
}

export async function buildState({ watched = true, badge = false } = {}) {
  const t0 = Date.now();
  const [{ boards, repos }, claudeLive, editors, quota, cursor, cursorEvents] = await Promise.all([
    scanRoots(),
    collectSessions(),
    collectEditors().catch(() => ({})),
    collectQuota({ watched: watched || badge }).catch((err) => ({ ok: false, reason: 'broken', error: err.message })),
    collectCursor({ watched }).catch((err) => ({ ok: false, reason: 'broken', error: err.message })),
    // Trả về ngay cái sổ đang có rồi tự làm mới ở NỀN — lượt kéo nguội mất ~10 giây và
    // không được phép nằm trong đường đi của một lượt quét (xem `collect/cursorevents.js`).
    collectCursorEvents({ watched }).catch((err) => ({ ok: false, reason: 'broken', error: err.message, series: [], convos: [] })),
  ]);
  const { sessions, ghosts, hosts, procs } = claudeLive;

  // Sổ hạn mức chốt NGAY sau lượt đọc, trước mọi việc khác của lượt quét: đây là con số
  // duy nhất trong dashboard không dựng lại được sau (endpoint chỉ có trạng thái hiện
  // tại, không có lịch sử — xem `collect/quotalog.js`). Bỏ qua nó một lượt là mất một
  // mảnh chu kỳ vĩnh viễn, nên nó không được đứng sau bất cứ thứ gì có thể ném.
  // `ledger` (Map sổ thô) TÁCH RA trước khi phần còn lại vào state: Map qua JSON thành
  // `{}` — không phồng payload nhưng cũng không mang gì. Nó chỉ sống server-side, làm
  // đầu vào cho `collectLookback` ở cuối hàm.
  const { ledger: claudeLedger, ...quotaCycles } = await trackQuota(quota).catch((err) => ({
    kinds: [],
    cycles: [],
    error: err.message,
  }));
  // Sổ chu kỳ Cursor cùng luật, cùng chỗ đứng — màn "Nhìn lại" đọc nó qua `cycles`.
  const cursorLedger = await trackCursorCycles(cursor).catch((err) => {
    console.error(`cycletrack cursor: ${err.message}`);
    return null;
  });

  // Sổ app chủ phải được chốt TRƯỚC khi quét token: bảng "nơi mở Claude" tra vào nó,
  // và một phiên vừa tắt giữa hai lượt quét thì lượt này là cơ hội cuối để ghi lại.
  const hostBook = await syncHosts(hosts).catch(() => new Map());

  const [usage, antigravity, agQuota] = await Promise.all([
    // Không được phép làm sập lượt quét: transcript là dữ liệu của công cụ khác,
    // định dạng có thể đổi bất cứ lúc nào, và cả dashboard vẫn dùng được khi
    // thiếu mỗi màn Token.
    // `windows` đi kèm để lượt quét này cộng luôn tiền kể từ mốc mở của từng cửa sổ hạn
    // mức — cùng một vòng lặp đã chạy trên 28 nghìn hàng, không phải một lượt đọc thứ hai.
    // Quét token nằm sau lượt đọc hạn mức chính vì chỗ này.
    collectUsage({ hosts: hostBook, windows: spendWindows(quota) }).catch((err) => ({ ok: false, error: err.message })),
    // Cùng một luật, và ở đây còn gắt hơn: sổ của Antigravity là protobuf không có
    // tài liệu, do một app hoàn toàn khác ghi ra.
    collectAntigravity({ running: appRunning('antigravity', procs) }).catch((err) => ({
      ok: false,
      reason: 'broken',
      error: err.message,
      convos: [],
    })),
    // Hạn mức Antigravity đứng ở lượt SAU vì nó cần bảng `ps`: PID của `language_server`
    // là thứ dẫn tới cổng loopback, và cổng đó đổi mỗi lần app khởi động lại.
    collectAgQuota({ watched, procs }).catch((err) => ({ ok: false, reason: 'broken', error: err.message })),
  ]);

  // Sổ chu kỳ AG chốt NGAY sau lượt đọc của nó, trước mọi thứ có thể ném — gắt hơn cả
  // hai sổ trên: ảnh chụp AG bị ghi đè mỗi lượt, đây là chỗ DUY NHẤT giữ được đỉnh tuần.
  const agLedger = await trackAgCycles(agQuota).catch((err) => {
    console.error(`cycletrack ag: ${err.message}`);
    return null;
  });

  // Màn "Nhìn lại": gấp ba sổ chu kỳ thành tiền + cổng 3 tuần. Thuần lắp ráp từ ba Map
  // đang nằm trong bộ nhớ — không I/O; hỏng thì mất mỗi màn đó, không được kéo lượt quét.
  let lookback;
  try {
    lookback = collectLookback({ claude: claudeLedger, cursor: cursorLedger?.cycles, ag: agLedger?.cycles });
  } catch (err) {
    lookback = { ok: false, error: err.message };
  }

  // Bậc gói đứng sau cả hai vì nó ĂN kết quả của chúng: Cursor suy ra từ `planCents`,
  // Antigravity lấy từ khối `plan` mà lượt RPC vừa rồi đã moi sẵn. Chỉ Claude là đọc đĩa
  // riêng — và đó là một lượt đọc một file, không đáng cho vào `Promise.all` nào.
  const plans = await collectPlans({ cursor, agQuota }).catch((err) => ({
    claude: { ok: false, reason: 'broken', error: err.message },
    cursor: { ok: false, reason: 'broken' },
    antigravity: { ok: false, reason: 'broken' },
  }));

  // Lượt gọi Antigravity chạy SAU, vì nó nhận thẳng danh sách hội thoại vừa lọc theo ngưỡng
  // ngày ở trên — không có nó thì module kia phải tự quét lại thư mục và tự lọc lần nữa.
  // Sổ mục lục hỏng thì không có hội thoại nào để mở, và đó đúng là "không có gì để đọc".
  const agTurns = await collectAgTurns({ convos: antigravity.convos ?? [] }).catch((err) => ({
    ok: false,
    reason: 'broken',
    error: err.message,
    turns: 0,
    series: [],
    models: [],
    ctxBands: [],
    byConvo: {},
  }));

  const projects = await mapLimit(boards, 6, async (dir) => {
    const { data, errors, parseError } = await readBoard(dir);
    const gitInfo = await collectGit(dir, data?.updatedAtCommit);
    const ageDays = daysSince(data?.updatedAt);
    const health = parseError
      ? 'broken'
      : healthOf({ ageDays, driftCommits: gitInfo.driftCommits, unknownCommit: gitInfo.unknownCommit });

    let hasMd = false;
    try {
      await fs.access(path.join(dir, 'NOW.md'));
      hasMd = true;
    } catch {
      /* board chưa render view — không phải lỗi, chỉ là thiếu */
    }

    const decisions = data?.decisionsNeeded ?? [];
    const blockerIds = new Set((data?.focus?.blockedBy ?? []).map((b) => b.id));

    return {
      id: relOf(dir),
      name: data?.project || path.basename(dir),
      folder: path.basename(dir),
      path: dir,
      group: groupOf(dir),
      now: data,
      hasMd,
      parseError,
      schemaErrors: errors,
      git: gitInfo,
      ageDays,
      health,
      counts: {
        decisions: decisions.length,
        hot: decisions.filter((d) => d.heat === 'now').length,
        waiting: (data?.waitingOn ?? []).length,
        queue: (data?.upNext ?? []).length,
        done: (data?.recentlyDone ?? []).length,
        sideTracks: (data?.sideTracks ?? []).length,
        worktrees: gitInfo.worktrees?.length ?? 0,
        worktreeWarn: (gitInfo.worktrees ?? []).filter((w) => w.warn).length,
      },
      blockerIds: [...blockerIds],
      sessions: [],
      /** Hội thoại Antigravity mở trên chính thư mục này — bề mặt làm việc thứ hai. */
      convos: [],
      /** Bề mặt đang có việc của dự án này (xem khối `surfaces` ở cuối hàm). */
      openIn: [],
    };
  });

  const live = projects.filter(Boolean);

  // Gắn phiên vào dự án. cwd của phiên có thể là worktree phụ chứ không phải repo
  // gốc, nên khớp cả theo đường dẫn worktree; chọn đường dẫn khớp DÀI NHẤT để
  // repo lồng nhau không bị gán nhầm vào repo cha.
  const claim = [];
  for (const p of live) {
    claim.push({ path: p.path, project: p, viaWorktree: null });
    for (const wt of p.git.worktrees ?? []) claim.push({ path: wt.path, project: p, viaWorktree: wt.name });
  }
  claim.sort((a, b) => b.path.length - a.path.length);

  const unassigned = [];
  for (const s of sessions) {
    const hit = claim.find((c) => s.cwd === c.path || s.cwd?.startsWith(c.path + path.sep));
    if (hit) {
      s.projectId = hit.project.id;
      s.viaWorktree = hit.viaWorktree;
      hit.project.sessions.push(s);
    } else {
      s.projectId = null;
      unassigned.push(s);
    }
  }
  // Hội thoại Antigravity gắn vào dự án theo workspace của nó — dùng lại đúng bảng tra
  // vừa dựng cho phiên Claude, và cũng khớp đường dẫn DÀI NHẤT vì cùng một lý do: repo
  // lồng nhau. Antigravity hoàn toàn không biết gì về `~/.claude`, nên đây là chỗ duy
  // nhất trong cả dashboard mà hai bề mặt làm việc gặp nhau.
  const unassignedConvos = [];
  for (const c of antigravity.convos ?? []) {
    const hit = c.cwd ? claim.find((x) => c.cwd === x.path || c.cwd.startsWith(x.path + path.sep)) : null;
    c.projectId = hit ? hit.project.id : null;
    c.project = hit ? hit.project.name : null;
    if (hit) hit.project.convos.push(c);
    else unassignedConvos.push(c);
  }

  for (const p of live) {
    p.counts.sessions = p.sessions.length;
    p.counts.awake = p.sessions.filter((s) => !s.sleeping).length;
    p.counts.convos = p.convos.length;
    p.counts.convosAwake = p.convos.filter((c) => !c.sleeping).length;
  }

  // Token gom theo `cwd` thô vì collector không biết gì về danh sách dự án. Gán
  // tên ở đây, dùng lại đúng bảng tra vừa dựng cho phiên — cwd của một lượt gọi
  // cũng có thể là worktree phụ, và cũng phải khớp đường dẫn DÀI NHẤT vì đúng lý
  // do đó: repo lồng nhau.
  if (usage.ok) {
    const byProject = new Map();
    for (const row of usage.projects) {
      const hit = claim.find((c) => row.key === c.path || row.key?.startsWith(c.path + path.sep));
      const id = hit ? hit.project.id : null;
      const name = hit ? hit.project.name : row.key ? path.basename(row.key) : '—';
      const prev = byProject.get(name);
      // Nhiều cwd gộp về một dự án (worktree phụ, thư mục con) — cộng lại chứ
      // không để dự án hiện nhiều dòng rời rạc trong bảng xếp hạng.
      if (prev) {
        for (const k of ['msgs', 'inTok', 'out', 'cw5', 'cw1', 'cr', 'cost', 'unpriced']) prev[k] += row[k];
      } else {
        byProject.set(name, { ...row, key: name, projectId: id, orphan: !hit });
      }
    }
    usage.projects = [...byProject.values()].sort((a, b) => b.out - a.out);

    // Phiên cũng mang `cwd` thô, và cũng phải đi qua ĐÚNG bảng tra ấy. Bảng phiên mà gọi
    // dự án bằng tên thư mục trong khi bảng xếp hạng ngay trên gọi bằng tên dự án thì hai
    // bảng cùng màn nói về cùng một chỗ bằng hai cái tên — người đọc phải tự ghép, và
    // worktree phụ thì ghép sai (tên thư mục là tên nhánh, không phải tên dự án).
    const nameOf = (cwd) => {
      if (!cwd) return '—';
      const hit = claim.find((c) => cwd === c.path || cwd.startsWith(c.path + path.sep));
      return hit ? hit.project.name : path.basename(cwd);
    };
    for (const list of [usage.eff?.sessions?.recent, usage.eff?.sessions?.top]) {
      for (const s of list ?? []) s.project = nameOf(s.cwd);
    }
  }

  // Quyết định xuyên dự án — thứ duy nhất thực sự chặn user.
  const decisions = live
    .flatMap((p) =>
      (p.now?.decisionsNeeded ?? []).map((d) => ({
        ...d,
        project: p.name,
        projectId: p.id,
        projectPath: p.path,
        ageDays: ageFromSince(d.since),
        blocksFocus: d.id ? p.blockerIds.includes(d.id) : false,
      })),
    )
    .sort(
      (a, b) =>
        (HEAT_RANK[a.heat] ?? 3) - (HEAT_RANK[b.heat] ?? 3) ||
        Number(b.blocksFocus) - Number(a.blocksFocus) ||
        (b.ageDays ?? 0) - (a.ageDays ?? 0),
    );

  const waiting = live
    .flatMap((p) =>
      (p.now?.waitingOn ?? []).map((w) => {
        const ageDays = ageFromSince(w.since);
        return { ...w, project: p.name, projectId: p.id, ageDays, nudge: (ageDays ?? 0) > WAITING_NUDGE_DAYS };
      }),
    )
    .sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));

  const queue = live.flatMap((p) =>
    (p.now?.upNext ?? []).map((q, i) => ({ ...q, rank: i + 1, project: p.name, projectId: p.id })),
  );

  // Dòng thời gian: gộp mọi `recentlyDone` theo ngày.
  const byDay = new Map();
  for (const p of live) {
    for (const d of p.now?.recentlyDone ?? []) {
      if (!byDay.has(d.date)) byDay.set(d.date, []);
      byDay.get(d.date).push({ ...d, project: p.name, projectId: p.id, group: p.group });
    }
  }
  const timeline = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, ageDays: daysSince(date), items }));

  // Repo còn hoạt động mà chưa có NOW board → chỗ bạn đang bay mù.
  // Worktree phụ cũng có `.git` nên lọt vào danh sách repo; chúng đã được kể ở
  // dự án mẹ rồi, liệt kê lại thành "chưa có board" là báo động giả.
  const boardSet = new Set(boards);
  const worktreePaths = new Set(live.flatMap((p) => (p.git.worktrees ?? []).map((w) => w.path)));
  const orphanCandidates = repos.filter((r) => !boardSet.has(r) && !worktreePaths.has(r));
  const orphans = (
    await mapLimit(orphanCandidates, 6, async (dir) => {
      const ts = (await git(dir, 'log', '-1', '--format=%ct')).trim();
      if (!ts) return null;
      const lastCommitAt = Number(ts) * 1000;
      const ageDays = Math.floor((Date.now() - lastCommitAt) / 86400000);
      if (ageDays > ORPHAN_ACTIVE_DAYS) return null;
      const branch = await headBranch(dir);
      return {
        id: relOf(dir),
        name: path.basename(dir),
        path: dir,
        group: groupOf(dir),
        branch,
        lastCommitAt,
        ageDays,
        sessions: sessions.filter((s) => s.cwd === dir || s.cwd?.startsWith(dir + path.sep)).length,
      };
    })
  )
    .filter(Boolean)
    .sort((a, b) => a.ageDays - b.ageDays);

  // Thứ tự lưới: nóng nhất lên trước — có quyết định 🔥, rồi board lệch, rồi phiên thức.
  const healthRank = { broken: 0, stale: 1, unknown: 2, drifting: 3, fresh: 4 };
  live.sort(
    (a, b) =>
      b.counts.hot - a.counts.hot ||
      (healthRank[a.health] ?? 9) - (healthRank[b.health] ?? 9) ||
      b.counts.awake - a.counts.awake ||
      (b.git.lastCommitAt ?? 0) - (a.git.lastCommitAt ?? 0),
  );

  /**
   * Bề mặt làm việc — nơi công việc thật sự diễn ra, và cũng là câu trả lời cho
   * "sở chỉ huy này đang trông coi những gì".
   *
   * Ba loại, khác nhau ở chỗ đo được cái gì:
   * - `agent` — Claude Desktop: đo bằng PHIÊN Claude Code.
   * - `ide`   — Cursor / VS Code: đo bằng THƯ MỤC đang mở, cộng phiên Claude Code nếu
   *              người dùng chạy Claude bên trong nó.
   * - `ide`   — Antigravity: không đụng gì tới Claude Code, đo bằng HỘI THOẠI của
   *              agent riêng của nó.
   *
   * Bề mặt không chạy VÀ không có gì để kể thì không xuất hiện: máy không cài Cursor
   * mà vẫn hiện một dòng "Cursor — 0" là bịa ra một khoảng trống không có thật.
   */
  const surfaceSessions = (key) => sessions.filter((x) => x.host === key);
  const editorSurface = (key, name) => {
    const st = editors?.[key] ?? null;
    const mine = surfaceSessions(key);
    const running = appRunning(key, procs);
    return {
      key,
      name,
      kind: 'ide',
      running,
      // Chỉ có nghĩa khi app ĐANG CHẠY: `backupWorkspaces` không được dọn lúc thoát, nên
      // với app đã tắt nó là danh sách của phiên trước — đọc ra thành "VS Code đang mở
      // hai thư mục" trong khi VS Code còn không chạy.
      //
      // `null` = không đọc được, `[]` = đọc được và đang không mở thư mục nào. Gộp hai
      // cái đó làm một là biến "chưa biết" thành "không có".
      folders: running ? (st?.folders ?? null) : [],
      emptyWindows: running ? (st?.empty ?? 0) : 0,
      sessions: mine.length,
      awake: mine.filter((x) => !x.sleeping).length,
    };
  };

  const desk = surfaceSessions('claude-desktop');
  const term = surfaceSessions('terminal');
  const agConvos = antigravity.convos ?? [];
  const surfaces = [
    {
      key: 'claude-desktop',
      name: 'Claude Desktop',
      kind: 'agent',
      running: appRunning('claude-desktop', procs),
      folders: null,
      sessions: desk.length,
      awake: desk.filter((x) => !x.sleeping).length,
    },
    editorSurface('cursor', 'Cursor'),
    editorSurface('vscode', 'VS Code'),
    {
      key: 'antigravity',
      name: 'Antigravity',
      kind: 'ide',
      running: antigravity.running,
      // Antigravity không có `backupWorkspaces`; thứ gần nhất với "đang mở" mà đọc được
      // trung thực là workspace của những hội thoại còn thức.
      folders: [...new Set(agConvos.filter((c) => !c.sleeping && c.cwd).map((c) => c.cwd))],
      sessions: agConvos.length,
      awake: agConvos.filter((c) => !c.sleeping).length,
      convos: true,
      degraded: antigravity.ok ? null : antigravity.reason,
    },
    {
      key: 'terminal',
      name: 'Terminal',
      kind: 'shell',
      running: term.length > 0,
      folders: null,
      sessions: term.length,
      awake: term.filter((x) => !x.sleeping).length,
    },
  ].filter((x) => x.running || x.sessions > 0);

  /**
   * Dự án nào đang mở ở bề mặt nào.
   *
   * Một nghĩa duy nhất cho mọi bề mặt — "chỗ này đang có việc của dự án này" — dù thứ
   * đo được ở mỗi chỗ một khác: Cursor/VS Code đo bằng thư mục đang mở, Claude Code đo
   * bằng phiên còn sống, Antigravity đo bằng hội thoại còn thức. Gán cho mỗi bề mặt một
   * nghĩa riêng thì hàng chip trên thẻ dự án thành một câu đố.
   */
  const mark = (dir, key) => {
    const hit = claim.find((c) => dir === c.path || dir.startsWith(c.path + path.sep));
    if (hit && !hit.project.openIn.includes(key)) hit.project.openIn.push(key);
  };
  for (const f of surfaces) for (const dir of f.folders ?? []) mark(dir, f.key);
  for (const p of live) {
    // `p.sessions` chỉ chứa phiên CÒN SỐNG (`collectSessions` đã lọc), nên có mặt ở đây
    // là đủ điều kiện; không cần xét `sleeping` — ngủ vẫn là đang mở.
    for (const x of p.sessions) if (x.host && !p.openIn.includes(x.host)) p.openIn.push(x.host);
    if (p.convos.some((c) => !c.sleeping) && !p.openIn.includes('antigravity')) p.openIn.push('antigravity');
    p.openIn.sort();
  }

  // Hội thoại Antigravity chỉ được serialize MỘT lần.
  //
  // Mỗi hội thoại vốn nằm hai chỗ trong cùng một payload: `antigravity.convos` — danh
  // sách đầy đủ mà màn Công cụ đọc — và `projects[].convos` / `unassignedConvos`, tức
  // CHÍNH những object ấy gom lại theo dự án. Đo trên máy này: 65,9 KB đi đúp, 12,7%
  // payload. Tỉ lệ ấy đi theo dữ liệu (ở đây chưa hội thoại nào gán được dự án nên hai
  // danh sách trùng khít), nhưng chuyện đi đúp thì không — nó là hình dạng của state.
  //
  // Hai chỗ sau đổi thành danh sách id, vì chúng là cách GOM chứ không phải nguồn.
  // Đổi TÊN trường luôn, không giữ `convos` với kiểu mới: một chỗ đọc sót sẽ nhận
  // `undefined` rồi ra danh sách rỗng, thay vì nhận mảng chuỗi rồi vẽ ra một hàng loạt
  // thẻ trống — hỏng im lặng khó tìm hơn hỏng thấy được.
  //
  // Chuyển ở ĐÂY, không sớm hơn: cả khối `counts` lẫn `openIn` phía trên đang đọc
  // trường thật của từng object.
  for (const p of live) {
    p.convoIds = p.convos.map((c) => c.id);
    delete p.convos;
  }

  return {
    generatedAt: Date.now(),
    buildMs: Date.now() - t0,
    roots: PROJECT_ROOTS,
    thresholds: HEALTH,
    projects: live,
    sessions,
    unassignedSessions: unassigned,
    ghostSessionFiles: ghosts,
    decisions,
    waiting,
    queue,
    timeline,
    orphans,
    usage,
    quota: withSpend(quota, usage.spentIn),
    quotaCycles,
    lookback,
    cursor,
    cursorEvents,
    surfaces,
    antigravity,
    agTurns,
    agQuota,
    plans,
    unassignedConvoIds: unassignedConvos.map((c) => c.id),
    /**
     * Các lượt gọi tiến trình ngoài đã hỏng trong cửa sổ vừa rồi — xem `lib/sh.js`.
     *
     * Vét sổ ở ĐÂY, cuối lượt dựng, là chỗ duy nhất gọi `drainRunFailures`. Gọi thêm
     * chỗ nào nữa là hai người đọc cùng vét một cuốn sổ và mỗi người mất một nửa.
     */
    runFailures: drainRunFailures(),
    stats: {
      projects: live.length,
      sessions: sessions.length,
      awake: sessions.filter((s) => !s.sleeping).length,
      hotDecisions: decisions.filter((d) => d.heat === 'now').length,
      decisions: decisions.length,
      waiting: waiting.length,
      nudge: waiting.filter((w) => w.nudge).length,
      needsUpdate: live.filter((p) => p.health === 'stale' || p.health === 'broken').length,
      drifting: live.filter((p) => p.health === 'drifting').length,
      worktreeWarn: live.reduce((n, p) => n + p.counts.worktreeWarn, 0),
      orphans: orphans.length,
      convos: (antigravity.convos ?? []).length,
      convosAwake: (antigravity.convos ?? []).filter((c) => !c.sleeping).length,
      surfaces: surfaces.filter((x) => x.running).length,
      schemaProblems: live.filter((p) => p.parseError || p.schemaErrors.length).length,
      tokensToday: usage.ok ? usage.today.out + usage.today.inTok + usage.today.cw5 + usage.today.cw1 : 0,
    },
  };
}
