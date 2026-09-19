# Architecture — NOW dashboard

*🇬🇧 English · 🇻🇳 [Tiếng Việt](ARCHITECTURE.vi.md)*

File map, data sources, and four pitfalls that have already bitten. For why the design
looks the way it does, see [DESIGN.md](DESIGN.md); for the quota block specifically,
see [QUOTA.md](QUOTA.md).

## What it reads

Everything is a file already sitting on disk — the dashboard **only reads, never writes**.

| Source | Yields |
|---|---|
| `~/Projects/*/*/NOW.json` | focus, next action, decisions, who it's waiting on, queue, recently done |
| `~/.claude/sessions/<pid>.json` | live sessions: pid, cwd, name, opened-at |
| `~/.claude/projects/<cwd>/<uuid>.jsonl` | session name (`customTitle`/`aiTitle`) + last activity |
| `~/.claude/tasks/<sessionId>/*.json` | each session's todo list |
| `git` | branch, uncommitted files, commits behind the board's marker, extra worktrees |
| `ps -eo pid,ppid,lstart,args` | the HOST app of each session — Cursor, VS Code, Antigravity, Terminal, or Claude Desktop |
| `~/Library/…/{Cursor,Code}/User/globalStorage/storage.json` | which folders each editor has open (`backupWorkspaces`) |
| `~/.gemini/antigravity/agyhub_summaries_proto.pb` | Antigravity conversations: title, workspace, step count, created/updated marks |
| `~/.gemini/antigravity/conversations/<id>.db` | mtime = that conversation's last write |

The source of truth is still `/now update` run inside the actual project. The dashboard
is a mirror, not a pen.

### Plan tier — three sources, three trust levels

Usage answers *"how much of it have I spent"*; plan tier answers *"how much of **what**"*.
No source sends a denominator alongside its percentage, so without a plan tier, today's
58% and last month's 58% aren't comparable — upgrade your plan and the whole history
silently changes meaning.

| Tool | Read from | Does the server self-report the tier? |
|---|---|---|
| Claude | `~/.claude.json` → `oauthAccount.organizationRateLimitTier` | yes |
| Antigravity | localhost RPC `GetUserStatus` → `planInfo.planName` | yes |
| Cursor | **inferred** from `planUsage.includedSpend` ($20 → Pro) | **no** |

That's why the Cursor chip has a **dotted** border instead of solid, and its tooltip
says outright that it's a reverse price-table lookup. A stroke, not a color — the
daltonized theme collapses red/green, so color can never be the only channel carrying
a real distinction.

**Where this breaks first, and breaks silently:** the Cursor price table (`CURSOR_PLANS`
in [`src/collect/plans.js`](../src/collect/plans.js)). If Anysphere changes pricing or
adds a tier, the label goes wrong with nothing to flag it. The chosen failure mode is
the safe one: when the price can't be matched, print the measured number (`$25/month`)
instead of guessing a name — an unlabeled number is still correct, a wrongly-guessed
label sends the reader off to reconcile against an invoice and conclude the whole
dashboard is broken.

**Two places that are deliberately NOT read, even though they look like the right spot:**

- `platform.claude.com/api/oauth/usage` — has no field about the plan at all. Measured on
  this machine: `five_hour`, `seven_day`, `limits[]`, `extra_usage`, `spend` are all
  there, no tier field anywhere.
- **Keychain** `claudeAiOauth.rateLimitTier` — DOES have a field, and it's **stale**. On
  this machine it reads `default_claude_max_5x` while the account is actually on Max
  20x: the value is written at login and never touched again, so upgrading the plan
  doesn't update it. The worst kind of wrong — right format, right type, only the
  content is wrong — so no format check catches it, only eyeballing it against the app.

The one exception to "read-only": `~/.now-dashboard/` — the dashboard's own notebook
(daily token totals, quota snapshots, and the per-session host-app log). Never written
to `~/.claude` or into any project directory.

## Three surfaces

![Three work surfaces feeding one dashboard](assets/surfaces.svg)

This machine runs three things at once, and they are **not the same kind of thing** —
the command center has to measure each one in its own unit:

| Surface | Unit | Burns Claude tokens? |
|---|---|---|
| Claude Desktop · Terminal | a Claude Code session | yes |
| Cursor · VS Code | an open folder, plus any Claude Code session running inside it | yes |
| Antigravity | a conversation with its own agent | **no** — doesn't touch Claude Code at all |

A project card can jump straight to "open in Cursor / Antigravity"; the list of allowed
apps is hard-coded in `server.js`, not taken as a free-form name from the client.

## Three easy mistakes

The quota block has its own pitfalls (the two-way color scale, how "ran out before
reset" is handled) — see [QUOTA.md](QUOTA.md). The three below are about sessions
and hosts.

**1. Live vs. dead session.** `~/.claude/sessions/` doesn't clean itself up. Checking
with `kill -0 <pid>` will report "alive" even for files whose PID has since been
reassigned by the OS to an unrelated process. You have to cross-check the process's
actual start time too.

**2. `procStart` is recorded in UTC, `ps lstart` prints local time.** Comparing the
strings directly means **no session ever matches** (off by exactly 7 hours on this
machine). Both have to be normalized to epoch first, with a 2-second tolerance — see
[`src/collect/sessions.js`](../src/collect/sessions.js).

**3. `claude-vscode` is ONE name for THREE editors.** VS Code, Cursor, and every other
fork share the same extension, so the transcript logs them identically — on this
machine that's 29% of token volume sitting under a label that distinguishes nothing.
The only thing that can tell them apart is the process tree, and the process tree dies
with the session; so [`src/collect/hosts.js`](../src/collect/hosts.js) commits the host
app to its log the moment the session is still observably alive. Older history stays
under "Unknown editor," and the Token screen **states that ratio outright** instead of
lumping it in blindly.

## Layout

```
server.js              HTTP + SSE, zero-dep; watches fs, batches events, rescans every 30s
src/config.js           health thresholds, paths, port
src/badge.js            the one menu-bar item: two spent figures, waste band, and — when
                        the read is broken — the reason plus what to do about it
src/state.js            merges every source into one snapshot; attaches sessions to
                        projects; passes each quota window's open time to the token
                        scan so it can attach the dollar estimate back
src/collect/now.js      scans NOW.json, validates schema v1, scores health
src/collect/sessions.js  detects genuinely live sessions + session name + last activity
src/collect/procs.js    one shared `ps` pass: guards against PID reuse + finds host app
src/collect/hosts.js    log of "which session ran in which app," to attribute tokens
                        to the right editor
src/collect/antigravity.js  Antigravity conversations, read from an undocumented protobuf
src/collect/agturns.js  each individual Antigravity model call — timestamp, model,
                        context; reads the gen_metadata table in each conversation's SQLite
src/collect/cursor.js   Cursor plan usage + in-editor rhythm (lines accepted, Tab
                        acceptance rate)
src/collect/cursorevents.js  log of individual Cursor calls — the timeline; pulled in the
                        BACKGROUND, overwrites the last two days each round, persisted to
                        ~/.now-dashboard/cursor-events.json
src/collect/editors.js  open Cursor/VS Code folders
src/collect/git.js      branch, drift, dirty files, extra worktrees
src/collect/tasks.js    each session's todo list
src/lib/pb.js           wire-level protobuf reader, no .proto file needed
src/pet.js              the feedable butler's coin ledger: 1 coin = $1 of estimated spend,
                        credited PER DAY so refreshing the page mints nothing; the shop's
                        price table; hunger measured from the last feeding timestamp.
                        Persisted to ~/.now-dashboard/pet.json
public/app.js           shell: routing, keybindings, drawers, keeps scroll position across
                        every redraw; skips an identical #view redraw, defers redraws while
                        the tab is hidden
public/lib/dom.js       html/esc/raw templates; mount(), the one place HTML is written, which
                        moves inline styles that declare or read custom properties into
                        shared classes and reuses <table> elements; setVars(); phase();
                        time and clipboard helpers. See "Writing to the DOM" below
public/lib/butler.js    the butler's voice: TWO fixed slots — worth-doing items + token quota
public/lib/game.js      numbers measured directly: streak, done7, project status as text
public/lib/chart.js     bar / area / lollipop / stacked bar / donut / treemap, plain HTML+CSS
public/lib/skin.js      chart rendering styles + the "which shape fits which data" guardrail
public/lib/quota.js     turns quota numbers into sentences: spent, wasted, color scale,
                        reset time, the window's estimated dollar cost — the target is
                        to spend it all
public/lib/tip.js       tooltip label↔value formatting, packed into a single HTML attribute
public/lib/surface.js   name and glyph for each work surface
public/lib/tabs.js      Token screen's tab state, kept outside the DOM, remembered via
                        localStorage
public/lib/pixel.js     the 4px-grid pixel renderer + sun-direction shading, shared by the
                        butler and the objects (split out so the two do not import in a cycle)
public/lib/pet.js       food/decoration sprites + the fullness bar. Item ids must match the
                        price table in src/pet.js — test/pet.test.js guards exactly that seam
public/styles.css       the HUD design system (tokens, cornered frames, gauges)
public/views/           7 screens, one file each — except views/tools.js, which is half
                        the Cursor + Antigravity content of the Token screen, not a
                        screen of its own
```

`/api/now-md?project=<id>` returns the full text of `NOW.md`; the minimal markdown
renderer lives right inside `app.js` — just enough for headings, bullets, bold/italic,
`code`, blockquotes, exactly what `/now update` generates. No library pulled in just to
display a file the app generates itself; content is escaped first, then syntax is
recognized.

## Writing to the DOM

Three rules hold for every file in `public/`, and `test/dom.test.js` scans the source to
enforce them:

1. **Every HTML write goes through `mount()`** in [`public/lib/dom.js`](../public/lib/dom.js).
   No `innerHTML =`, `insertAdjacentHTML`, `DOMParser` or `document.write` anywhere else.
2. **Custom properties set from JavaScript go through `setVars()`**, never through
   `style.setProperty('--x', …)` or a hand-built `style` attribute. `element.style` is touched
   only at the few reviewed places the test lists: reading it makes WebKit switch the element to
   a mutable inline style that is never cached.
3. **A value that only locks an animation to the wall clock is wrapped in `phase()`**, such as
   `--now` from `lifeClock` or a walker's negative `animation-delay`. Every `Date.now()` that
   flows into a `style` attribute must be wrapped.

**Why: a style cache in Safari's WebKit that never shrinks.** Each style resolver keeps a
`MatchedDeclarationsCache` keyed partly by the *address* of the custom-property data an
element inherits from its parent, and an entry is only swept when one of its declaration
blocks loses its last owner, which never happens for declarations from `styles.css`. An
element that declares a custom property in its `style` attribute gets a fresh custom-property
object every time it is rebuilt, so each of its descendants leaves a permanent ~1 KB entry
behind on every redraw. That is what made Safari reload the Dock web app "because it was using
significant memory". WebKit tracks it as bug 312236; the upstream fix (commit `ebcf88c1bc`)
caps the cache at 16k entries on main only, and Safari 17.6 has no cap.

`mount()` therefore moves every `style` attribute that declares a custom property, whole,
into one shared generated rule (`.nv-12 { --a: x !important; width: 3px !important }`) in a
constructed stylesheet adopted by the document, and gives the element that class. Identical
attributes share one rule across redraws, so a rebuilt element points at the same declaration
block and the cache stops growing. The registry is bounded: past its cap, rules for classes no
longer in the document are deleted. `setVars()` applies the same rule to values set from
JavaScript. The `!important` stands in for inline precedence, which it does not reproduce
against CSS animations or against an existing `!important` rule, so a plain property that
shares an attribute with a custom property must not be animated by `@keyframes` or declared
`!important` in the CSS. The same test file checks that, and lists the reviewed exceptions.
A value containing `revert-layer` or `revert-rule` is never moved, because inside an
`!important` rule those keywords roll back past the normal rules that inline style falls back to.

Two more WebKit effects shape `mount()`:

- **A `style` attribute that reads a variable also moves.** WebKit shares identical inline
  style blocks, except blocks with a `var()` or `env()` value, which cannot be hashed. Such an
  element would get a new block, a cache miss and a new entry on every redraw, swept only a
  minute later, so `color:var(--dim)` moves to a class like a declared custom property does.
- **`<table>` elements are reused.** Each WebKit table creates one declaration block shared by
  all its cells, so a new table makes every cell miss the cache, and a table with both `th` and
  `td` cells leaves entries the sweep can never remove. `mount()` swaps each newly parsed table
  for the table it created in the same position on the previous write, giving the old element
  the new attributes and children. No template may set `border`, `frame`, `rules` or
  `cellpadding` on a table, since changing those replaces the shared block.

Every rule `mount()` inserts makes WebKit rebuild the style resolver and restyle the page,
measured at 24 ms on the Projects screen and 49 ms on the shop. That is why wall-clock phase
values are wrapped in `phase()`: they change on every redraw, but a `#view` redraw that differs
only in them is skipped, because the running DOM is already at that phase. The popover
(`public/menubar.js`) does not compare and rebuilds on every redraw, which is a few redraws per
opening. `phase()` returns a `raw` value, so it only works inside an `html` template, and
`esc()` writes the two marker characters (U+E000, U+E001) as character references, so escaped
text from disk can never pass for a phase value.

Two behaviours in `public/app.js` sit on top of this:

- **Identical-HTML skip.** `render()` still calls the screen's render function on every
  redraw, but when the `#view` string is byte-identical to what `mount()` last wrote there,
  apart from `phase()` values (`unchanged()`), the DOM is left alone. Nothing is rebuilt for
  the cache to key on, focus, selection and open `<details>` survive, one-shot CSS animations
  inside `#view` do not
  replay, and a looping one keeps the phase of the mount that created it instead of starting
  over. The navigation bar, the butler block and the drawer still remount on every redraw.
- **Hidden-render gate.** While `document.visibilityState` is `hidden`, SSE pushes still
  update `app.state`, but `render()` only records that a redraw is owed and pays it once, with
  the latest state, when the tab becomes visible. The butler's slide timer, the first-load
  `/api/ping` poll and the connection pulse's heartbeat pause too.

Measured on Safari 17.6, MB of process footprint per 100 redraws before the fix → after it:
Projects 64.5 → 0.1, Decisions 32.9 → 0.4, Tokens 83.8 → 1.2, and the shop from a 127–829 MB
sawtooth to 0.5 per 100 pushes. With the identical-HTML skip disabled, so that every push
really does redraw, 1,398 consecutive Decisions redraws moved the footprint from 70 to 71 MB.
The full ten-screen table, and what is still not flat, is in the CHANGELOG.

One hazard the fix does not remove: the town map still writes 6,757 inline pixel styles with
2,216 distinct strings, over the 1,024 entries WebKit keeps for sharing identical inline
blocks. It is out of reach only because the shop almost never redraws and any redraw that does
happen inserts a `--now` rule, which resets the resolver; a change that redraws the town
without inserting a rule brings back a 148–819 MB sawtooth. Keep the number of distinct
`style` strings on a screen well under 1,000, and express sprite positions as classes or grid
areas rather than pixels if the town is ever rebuilt.

## Configuring

Set environment variables before running:

```bash
NOW_PORT=5000 NOW_ROOTS=~/Projects,~/work ./bin/now-dash
```

| Variable | Default | What it does |
|---|---|---|
| `NOW_PORT` | `4400` | Port the server listens on, loopback only |
| `NOW_ROOTS` | `~/Projects` | Comma-separated roots scanned for `NOW.json`. The `now` plugin's `all` mode reads the same variable, so a board outside these roots is invisible to both halves rather than to one |
| `NOW_DATA_DIR` | `~/.now-dashboard` | Where the dashboard keeps its own notebook: the quota cycle ledgers, the token rollup, the host log, the butler's ledger |

**Set `NOW_DATA_DIR` before running a second copy.** Two dashboards sharing one data
directory overwrite each other's ledgers: each process keeps its own memo in memory and
writes the whole file, so whichever writes last wins and any cycle only the other one saw
is gone. `quota-cycles.json` is the one file in there this codebase calls unrecoverable,
which makes this the one collision worth spending a line of config on. A second copy is a
normal thing to run (a preview alongside the LaunchAgent, for instance) as long as it gets
its own directory and its own port.

The "can this board still be trusted" thresholds live in `HEALTH` in
[`src/config.js`](../src/config.js) — defaults: drifting from 3 days / 5 commits,
expired from 7 days / 15 commits.
