# Changelog

Notable changes to the **dashboard**. The plugin that ships in `plugin/` keeps its
own history in [`plugin/CHANGELOG.md`](plugin/CHANGELOG.md) and its own tags
(`now-board--v<version>`), because the two halves ship on separate clocks.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **The sit-too-long ladder now reaches the menu-bar icon.** Until now every part of the
  break system — the focus bar, the nudge line, the five verified moves — lived *behind*
  the click that opens the popover, which means it only ever reminded people who had
  already asked. Three stages, every threshold derived from the 90-minute cycle rather
  than invented: minute 70 (alert phase over — the same boundary the focus bar draws) puts
  an amber dot on the icon, minute 90 (a full cycle) turns it into a red disc with an
  exclamation mark, minute 180 (two cycles without one counted break) tints the whole
  badge red. The stage is decided server-side (`rest` on `/api/badge`); the Swift app
  keeps its no-rules boundary and just paints. Clears the moment a verified break lands,
  ten silent minutes pass, or the game is off; while a move is running the icon stays
  quiet instead of nagging the person who just obeyed it. Colored stages leave template
  mode — a first for this icon — and the snapshot harness caught the one real trap: colors
  must stay *dynamic* and resolve inside the button's own draw pass, not be resolved at
  paint time against the app's appearance (a bare binary resolves to Aqua and the text
  vanishes on a dark bar; measured, reverted, documented in place).

  A day later the pet's **starving** state joined the ladder at the red-disc rung — the
  user sat hungry and tired at a silent icon (screenshot, 9 Aug): the ladder read only
  the sitting clock, so the icon could show `stateOf`'s #3 state (spent) while staying
  mute on #2 (starving). The server now resolves the final *picture* (`alert.level`:
  dot / bang / flood) plus the tooltip sentence; the Swift side dropped its one
  hardcoded sentence and paints three named shapes, so a third cause someday costs no
  app rebuild (the `rest` data field stays for older builds). Ordinary hunger never
  reaches the icon — a 16-hour cycle still comes around about once a day, and a daily
  badge is a light that is always on. Anything in progress (eating, resting) silences it: busy tops `stateOf`,
  and the icon does not argue with its own model's ranking. And the stale-dim never
  stacks with a badge — dimmed text beside a red disc read as a broken icon on a light
  menu bar (owner's call on sight, 9 Aug); while a badge shows, the text keeps its
  normal weight and staleness speaks only in the tooltip. With no badge, the dim
  channel is untouched — it was born from a real six-hours-of-stale-numbers incident
  and still owns that job.
- **The five free moves are now one click from the icon.** The row appears in the popover
  under the nudge line, exactly when the nudge points at the park and nothing is already
  running — previously the walk the reminder recommended was three surfaces away (popover
  → shop → dashboard tab → park block).

- **`./bin/now-dash upgrade`** — one command for existing installs, closing the gap where
  upgrading required knowing whether a given pull needs the compiler (`app/`, `launchd/`,
  `bin/`, the icon — measured: v1.0.1 → v1.1.1 changes all three, v1.1.0 → v1.1.1 none)
  or just a service restart. Menu-bar tones are compared by *generating* them from both
  versions of `styles.css`, not by watching the file — `styles.css` changes on every UI
  round, the tones almost never. It refuses a dirty tree and a detached HEAD outright
  (the six commits this week that sat on an unpushed side branch made the case), operates
  on the copy the LaunchAgent points at rather than the clone it was called from, reads
  the port from the plist rather than assuming 4400, and notices the
  pulled-yesterday-but-never-restarted service by comparing its start time against the
  newest server-side commit.

- **The library answers the two questions people were asking a human instead.** Both
  arrived within a minute of each other (9 Aug): *"I've been sitting here for ages — how
  come focus isn't dropping?"* and *"'In the groove', 'Fine' — what are the states?"*.
  Neither was answerable from the screen, and one of them was already half-buried in a
  block titled "Where the rest mark comes from". That block is now **"Why the sitting
  clock keeps resetting itself"**, it has a formula line like the four measured blocks
  above it (`rest mark ← now, whenever Claude Code goes quiet for ≥ 10 min`, the 10 read
  from `BREAK_MS`), and it leads with the consequence rather than the mechanism: the
  clock counts silence in *Claude Code*, so reading a long answer resets it while you
  never leave the chair. It also stops claiming both failure modes under-nudge — they run
  in opposite directions, and the one that thinks you are still sitting nags an empty
  chair. Next to it, a new **"The states, and what each word means"** block renders the
  two scales as a table: four hunger words against their fullness ranges, three focus
  words against their minute ranges, every number derived from `HUNGER_MARKS` and
  `REST_STAGE_MIN` and every word read from the same i18n keys the stat strip prints, so
  a glossary that describes some other screen cannot compile. `stuffed` joined
  `HUNGER_MARKS` on the way — it had been a bare `0.85` inside `moodOf`, and a table that
  explains the marks by keeping a copy of them is the first thing that goes stale.

### Changed

- **Hunger runs at half speed: 8 hours → 16 hours to empty.** Owner's call, and a call about
  PRIORITY rather than a broken measurement — feeding is the only gauge in the project that
  asks the person to *do* something, and if that chore isn't worth doing twice a day, the
  rhythm is what has to stretch, not their memory. Sixteen hours reads as one waking day:
  feed it when you sit down in the morning, it's still fed at bedtime, and the next meal
  lands the following morning. The trade is written down rather than buried — the bar now
  drains 6.25%/hour instead of 12.5%, so two looks half an hour apart move it 3%, still
  clear of the 5%/hour that disqualified the old 20-hour step but with half the margin;
  if that bar ever reads as frozen, the way back is 12 hours, not 8. Nothing else needed
  touching: food prices derive from `FULL_MS` at a fixed 0.2 coins/hour, so every dish got
  proportionally pricier *and* longer-lasting (phở: 1.44 coins for 7.2 hours → 2.88 for
  14.4), the five-dish tray is a UI constant, and the day's food budget check is unchanged
  because both of its factors moved in opposite directions by the same ratio. The hunger
  clock's two lower countdowns now speak in hours where they used to speak in minutes, so
  the `starve*`/`empty*` minute branches gained test cases of their own rather than
  quietly losing their only caller.
- **The service sheds its author's name: `dev.hoanluu.now-dash` → `io.github.archi-ai-labs.now-dash`**
  (and `.menu`, `.launcher` along with it) — the public-release pass. Reverse-DNS that the
  org actually controls, instead of a personal label baked into every adopter's
  `launchctl` output. `install-app` migrates in place: it boots out both old-label jobs,
  removes their plists, keeps the old open-at-login choice (read before the cleanup, or
  the icon silently stops coming up after the rename), and accepts the old bundle id so
  the don't-overwrite-someone-else's-app guard doesn't block the very upgrade that
  renames it. Idempotent — a clean install finds nothing to migrate. One side effect,
  once: the popover's remembered tab/theme reset, because the WKWebView store is keyed
  by bundle id.
- **Both READMEs now say what a stranger needs before installing**: macOS 13+, Xcode CLT
  (with the honest explanation of the two "unidentified developer" login items — self-
  compiled binaries are unsigned), Node ≥ 18.10, Claude Code as the data source, and a
  table of what each login item does and what breaks if you switch it off. Plus a
  transparency section up top: every line written by Claude, product decisions from a
  human across 30+ recorded rounds, local-only (`127.0.0.1`, `~/.now-dashboard/`), MIT,
  as-is.
- **The butler only thinks when there is news.** Opening the popover used to guarantee a
  bubble: one status line plus two time-of-day filler sentences on a 42-second rotation —
  and the filler's own i18n contract admits it carries no information. Now: all quiet →
  no bubble at all; hungry or past the alert phase → exactly one status sentence, standing
  still (a lone sentence on a rotation is 36 seconds of blank where the one thing worth
  reading should be); eating or resting → the full three-sentence rotation stays, because
  it narrates an action the user just clicked and lives for one minute. The eight
  time-of-day sentences are gone from both languages.
- **Food costs a fifth of what it did: the food-aisle rate drops 1 → 0.2 coins per hour
  of fullness** — the owner's call, 9 Aug: *"food is a bit expensive — cut it 80%"*. One
  constant moved (`COIN_PER_HOUR`); the nine prices, both price tests and the in-shop
  "how these numbers are computed" sheet all derive from it, so the whole table followed
  in the same edit — coffee 2.60 → 0.52, phở 4.50 → 1.44. The number behind the call is
  a budget share: feeding is mandatory a few times a day, and at 1 coin/hour a 10-hour
  day's food bill (10 coins) took 20% of a light day's measured income ($50) — the decor
  shop, the only actual *choice* in the game, got the leftovers; at 0.2 it takes 4%.
  Decor prices stay put on purpose: they buy nothing measurable, so no formula prices
  them, and cutting both sides would have moved no balance at all.

### Fixed

- **The busy countdown ran at double speed — a one-minute meal drained in thirty seconds.**
  User measured it on screen: *"the feeding cooldown is still ticking 2s at a time"*. No
  function was wrong on its own, which is what made it invisible to the whole suite.
  `leftMs` is a DIFFERENCE, so it only means anything alongside the moment it counts from,
  and the ledger carries that moment in `at`; `livePet` keeps the pair consistent, moving
  `at` forward by exactly what it takes off `leftMs`. The shop view, though, still kept a
  second mark of its own (`petAt`, stamped on receipt and then frozen for the 30 seconds
  between fetches) and subtracted against *that* as well — one elapsed span removed twice.
  It was correct until `livePet` moved into the draw pass and took over the first
  subtraction. `doingNow` now reads `pet.at`, the mark the number actually belongs to, so
  it is right on both sides of `pet = livePet(pet)`, and the second mark is gone rather
  than kept in sync by hand. Everything gated on "is it busy" moves with it: the countdown,
  the locked buy buttons, the butler's pose, the dish draining in his hand — buttons had
  been unlocking twice as early while the server was still refusing.
- **The hunger clock counts down to the mark where the word beside it changes — not to
  0%.** The shop HUD could read "Starving · hungry in 43 min" (user's screenshot, 9 Aug):
  the countdown always aimed at empty and called that moment "hungry", while the state
  word had said "Starving" since the 12% mark. Three targets now — fed counts to
  *hungry*, hungry to *starving*, starving to *stomach empty* — read from the same
  `HUNGER_MARKS` table `moodOf` reads, so the word and the clock cannot disagree again.
  It also ceils instead of rounding: a countdown showing "0 min" reads as a bug, not as
  urgency. The dead `short` variants went with it — five keys for a popover strip that
  has not existed since round 17.
- **The "how these numbers are computed" sheet caught up with its own numbers.** It
  still said the fullness bar spans 5 hours and "1 coin buys 1 hour" — stale since round
  21 moved the bar to 8 hours, and wrong twice over after today's rate cut. The one
  surface whose entire job is declaring where every number comes from was the one lying
  about two of them. Both languages rewritten from the current constants; the formula
  line was already reading the rate off the live ledger.
- **The popover stops twitching — the "sky jitters" report, second time around.**
  Measured before touching anything: the round-23 phase lock is intact — animation
  phases survive a full re-render in Chromium *and* in real WebKit (headless WKWebView
  probe; its initial "1.5 s drift" turned out to be WebKit reporting `currentTime` as 0
  for negative-delay CSS animations, while the freshly resolved delays proved the new
  clock lands). What moves is the window itself, two ways, both closed. One: `NSPopover`
  animates every `contentSize` change the page pushes — 2–3 renders per open plus the
  `didFinish` fallback, each a visible rubber-band — so `animates` is now off and a new
  size lands in one frame. Two: the sit-too-long badge widened the button by 4 pt exactly
  while a stage was showing, so every stage flip — including the one 30 s after starting
  a verified break — shifted the whole icon row and dragged the open popover's anchor
  sideways; the 4 pt is now always reserved and the text is centred identically on both
  paint paths.
- **A malformed path answered "the server is broken" instead of "that is not a path."**
  `GET //` returned **500** and logged `Invalid URL` — found 10 Aug by a `curl` loop that
  joined one slash too many while chasing an unrelated report. The cause was not the extra
  slash: `req.url` is a *request target*, not a URL, and feeding it straight to `new URL`
  lets the second meaning of `//` in — authority. So `//` threw (empty host) and escaped
  through the last-resort catch as a 500, while the quieter sibling `//lib/pet.js` did
  *not* throw: it resolves to host `lib`, path `/pet.js`, so the router silently saw a
  different path than the client asked for. Both now answer **400** through one small
  parser (`src/reqpath.js`) that requires exactly one leading slash and still accepts a
  proxy's absolute-form; `/%` keeps its own 400 further in, where the code knows it is
  serving a file. Same rule as that older branch: a client typo gets a client error, and
  a 500 is a statement about *this* server that had better be true.
- Tests: 510 → 530.

## [1.1.1] — 2026-08-08

Three items off the backlog (`B13`, `B14`, `B18` — all three turned out to be specified
against numbers that had since moved; [`BACKLOG.md`](BACKLOG.md) records what each one
actually was once measured again), a ledger that was quietly minting phantom cycles, and
a forecast that now notices when you speed up.

### Added

- **Failed external commands now say why.** `run()` collapsed every failure into an empty
  string, so "not a git repo" and "git is not installed" reached the screen as the same
  sentence. `src/lib/sh.js` now classifies — timeout, not-found, no-access, overflow, exit,
  spawn — and the Health view leads with anything that is not a plain non-zero exit. A
  non-zero exit is a valid answer, not a malfunction: it is what `git rev-parse` returns in
  a directory that is not a repo, the most common outcome of any scan.

### Changed

- **The forecast now follows the fastest of three paces: since window open, the last 24
  hours, the last 48 hours.** The straight line from window open answers one case wrongly,
  and it is the most common case on this machine — idle for five days, then heads-down for
  two. The average is flattened by the idle days, so the projection says "90% wasted" at
  the exact moment spending is at its fastest. Max, not a weighted blend: every weight is
  an invented number that needs explaining, while "the fastest pace actually measured
  recently" is a measurement. Recent velocities come from a sample trail the cycle ledger
  now keeps on the running record (one sample per 15 minutes, 49 hours deep, stripped from
  closed records and from every payload). No trail yet — fresh install, ledger just born —
  means the formula quietly reduces to the old line; a 5-hour window reduces to it too,
  because both lookbacks are longer than the window itself. Applies to Claude (5h, 7d,
  per-model) and Antigravity buckets; Cursor is left alone — its ledger counts cents while
  its forecast speaks percent, and gluing those together needs a decision, not a formula.

- **The SSE payload is a third smaller: 519.3 → 344.3 KB.** Neither of the two heavy parts
  was data. One was a memo cache key (118 KB, 22.7%) that lived inside the object shipped to
  every tab and that no client ever read; it grew with the number of transcripts on disk.
  The other was one list of conversations serialized twice (65.9 KB) — `projects[].convos`
  and `unassignedConvos` now carry ids, because they are groupings and `antigravity.convos`
  is the source. The `/api/project/<id>` endpoint the original entry proposed was not built
  and is not needed yet.
- **The background scan drops to one minute when no tab is open**, and the game layer's
  break tick keeps its own 30-second timer. They shared one interval, which is what had
  blocked this: "head down for three hours with nothing open" is exactly the case the break
  tick exists for, and exactly the case the slower scan creates. Only the dashboard holds an
  SSE connection — the menu-bar popover polls — so no-tabs-open is the ordinary state for
  anyone using only the menu bar.
- The dashboard install block in both READMEs now opens with `git clone` — it used to
  open on `./bin/install-app`, which assumes the repo is already on disk, a thing that is
  only ever true for the person who wrote it.

### Fixed

- **The Antigravity cycle ledger was minting a new "cycle" on every read.** Three of its
  four buckets are *rolling* windows: `resetTime` means "when the oldest usage expires", so
  it crawls forward in step with the wall clock. Keying a cycle on it meant every reading
  became its own cycle — `gemini-5h` held 179 records, all `peak: 0, samples: 1`, with the
  reset mark drifting 15.5 hours across exactly 15.5 hours of real time. `trimCycles` could
  not stop it, and was not wrong to: it deliberately exempts *running* cycles from trimming,
  and a rolling window's reset mark is permanently in the future. 556 of 558 `3p-weekly`
  records were exempt on those grounds.

  Rolling windows are now recognised by behaviour, not by bucket name — the reset mark
  advancing in step with elapsed time — and folded into one record per window. Existing
  ledgers repair themselves on open, so no version bump was needed and Claude's history,
  the one thing this project cannot rebuild, is untouched (52 records in, 52 out). A
  rolling window also never appears in a list of *closed* cycles, because it never closes.
  `ag-cycles.json`: 919 records / 180.6 KB → 11 / 2.4 KB, flat over 8 minutes of live scans.

  The control case is `gemini-weekly`, Antigravity's only fixed-boundary bucket: 3 cycles
  exactly 168.0 hours apart, all three preserved. A rule that ate real cycles would have
  eaten those first.

- Tests: 476 → 510.

## [1.1.0] — 2026-08-07

The menu-bar app gets a switch, the plugin moves in next door, and the butler
introduced in 1.0 turns into something with a life of its own — sixteen `d-pet`
rounds, all recorded in [`design/README.md`](design/README.md).

### Added

- **A game layer with an owner.** The butler is one state machine both surfaces
  read, instead of two rankings of the same three sources — one in the popover's
  `moodOfScene`, one in the map's `butlerArt`, neither written down. He speaks
  (tailed bubble) as distinct from thinking (cloud), opens a status sheet on
  click, and hands out sixteen Claude tips badged by *kind* rather than one badge
  per tip.
- **Residents and ambient life in the town** — mochi and a chick in place of two
  human silhouettes, two frames and three tempos each, seven ambient rhythms
  declared beside the art that uses them.
- **Sound** (`public/lib/sound.js`) — the project's first channel that is neither
  picture nor text. Off by default.
- **A theme and language switch inside the popover** (`public/lib/mbtheme.js`).
  It runs in the native app, where there is no dashboard top bar to borrow.
- **A remembered state** (`public/lib/statecache.js`) for the worst case: a page
  opened before the server has finished its first scan. It is not a general
  speed-up — a warm server answers in 18–100ms. Written when the tab is hidden,
  never on the SSE path, and rendered down its own branch with its own label.
- **A menu-bar icon toggle** with a route back to the dashboard, and a badge that
  says *why* it is failing rather than only that it is.
- **`now-board` plugin folded into `plugin/`**, next to the dashboard that reads
  every board it writes. See [`plugin/CHANGELOG.md`](plugin/CHANGELOG.md) 0.2.0.

### Fixed

- Right-clicking the menu-bar icon killed the app — `performClick` called itself.
- The hard-coded path to the `now` skill is gone; the plugin is discovered.
- Round 24: decorations flickered because two reads landed 0ms apart on the
  animation clock. Locking it puts a real 18ms between draws. Two places are
  deliberately left unlocked, with the reason recorded in place.
- `CLAUDE.md` rule 3 — a backtick inside an HTML comment inside a template
  literal — bit three more times, once while the comment explaining it was being
  written. There is now a guard that scans the whole file, not one family of
  functions.

### Changed

- The LaunchAgent opens the app at login.
- One bilingual front door in `README.md` for both halves of the repo.
- Tests: 432 → 476.

## [1.0.1] — 2026-08-04

- English is the default README; screenshots added.
- Fixed the last of the VI/EN cross-links missed in the previous commit.

## [1.0.0] — 2026-08-04

First tagged release. `bin/install-app` installs the LaunchAgent itself, and the
README carries the install / uninstall / troubleshooting handbook.

[Unreleased]: https://github.com/archi-ai-labs/now/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/archi-ai-labs/now/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/archi-ai-labs/now/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/archi-ai-labs/now/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/archi-ai-labs/now/releases/tag/v1.0.0
