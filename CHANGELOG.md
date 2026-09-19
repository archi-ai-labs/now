# Changelog

Notable changes to the **dashboard**. The plugin that ships in `plugin/` keeps its
own history in [`plugin/CHANGELOG.md`](plugin/CHANGELOG.md) and its own tags
(`now-board--v<version>`), because the two halves ship on separate clocks.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Safari kept reloading the dashboard web app with "This web app was reloaded because it was
using significant memory." The leak lives in WebKit's style cache, and the fix lives in the
one function that writes HTML.

### Fixed

- **Safari no longer grows the page's memory on every redraw.** Measured on Safari 17.6:
  the WebContent process gained **64.5 MB per 100 redraws** of the Projects screen, linear,
  untouched by a full JS garbage collection, while Chrome stayed flat. Bisecting inside the
  page pinned it to one thing: custom properties declared in a `style="--x:…"` attribute. Each
  `Style::Resolver` keeps a `MatchedDeclarationsCache` keyed partly by the *address* of the
  parent's inherited custom-property data, and entries are only swept when one of their
  declaration blocks loses its last owner. An element that declares custom properties inline
  gets a fresh data object every time it is re-created, so every descendant (pseudo-elements
  included) hashes to a key the cache has never seen and gets a new ~1 KB entry, built from
  `styles.css` declarations that are never released. The Projects screen has 27 such elements
  covering 346 of the 385 elements in `#view`, which is about 315 permanent entries per redraw.
  WebKit acknowledged the unbounded growth (bug 312236, commit `ebcf88c1bc`) and capped it at
  16k entries on main only; Safari 17.6 has no cap.

  `mount()` now moves every `style` attribute that declares a custom property, whole, into one
  generated rule such as `.nv-12 { --a: x !important; width: 3px !important }` in a
  constructed stylesheet adopted by the document, and gives the element that class instead of
  the attribute. The plain declarations in that attribute (`width`, `z-index`,
  `animation-delay`) move with it, in written order: an element that keeps even one inline
  declaration still brings a new declaration block on every rebuild, misses the cache, and
  hands its descendants a fresh custom-property object. An attribute without custom properties
  stays inline byte for byte, and an attribute with any declaration that cannot be copied into
  a rule safely stays inline whole. Names and values are trimmed of CSS whitespace only (space,
  tab, newline, carriage return, form feed), so a value that starts with a no-break space keeps
  it, exactly as the inline style did. Re-applying the same declarations through
  `element.style.setProperty` was measured too and is not a fix (54.5 MB), because it is still
  inline style.

  Measured on Safari 17.6 against this exact code, MB of process footprint per 100 redraws
  with a state pushed twice a second, before the fix → after it: **Projects 64.5 → 0.1**,
  Sessions 3.0 → 1.3, **Decisions 32.9 → 0.4**, Timeline 8.3 → 0.9, **Tokens 83.8 → 1.2**,
  Health 7.0 → 0.4, Lookback flat → 0.7, Bench 1.6 → 2.4 over 338 redraws and 1.2 over 915,
  which is where it sat before the fix as well, and the shop from a 127–829 MB
  sawtooth to 0.5 MB per 100 pushes over 1,432 of them (85 → 92 MB, peak 96). Stats has no
  usable "before": the run that was meant to measure it was confounded, and it reads 0.5 now.
  The baselines were re-measured on the same harness in the same session and reproduced the
  originals (Projects 64.4, Tokens 83.9), so the two columns compare like with like.

  Those figures include the identical-HTML skip further down, which on several screens means
  no redraw happens at all. Measured again on a copy of the tree with `unchanged()` forced to
  `false` — one changed line, so the class move is priced on its own — the same screens read
  Projects 0.5, Sessions 2.7, Decisions 0.6, Timeline 0.5, Stats −0.2, Tokens 3.7, Health 0.7,
  Lookback 1.0, Bench 1.8 and the shop 1.0 over 343 real redraws. The long runs on that copy
  are what rules out "merely slower": **1,398 consecutive Decisions redraws moved the
  footprint from 70 to 71 MB**, 1,396 Projects redraws from 81 to 85, 1,396 Tokens redraws
  0.6 per 100. `vmmap` says the same from the other side: across 674 Projects redraws,
  WebKit's malloc zone stayed between 21.6 and 29.0 MB and between 113k and 137k live
  allocations with no trend, where the same zone on Decisions before the table fix grew by
  2.65k allocations per push, 23 → 63 MB.

- **A `style` attribute that reads a variable moves to a class too.** WebKit shares identical
  inline style blocks through a deduplication table
  (`ImmutableStyleProperties::createDeduplicating`), but a value containing `var()` or `env()`
  cannot be hashed, so such a block is never shared: every redraw hands the element a new
  block, a cache miss and a new entry, which only the sweep a minute later removes. Memory
  therefore swings with the number of redraws per minute. Measured on Safari 17.6 on the
  Decisions screen redrawn every 500 ms with the identical-HTML skip disabled: 15.0 MB per 100
  redraws, 4.3 with `var()` removed from inline styles. `mount()` and `setVars()` now move an
  attribute that declares a custom property *or* reads one (`color:var(--dim)`) into a class.
  An attribute that does neither still stays inline, because WebKit can share it.
- **Tables are no longer re-created on every redraw.** Each WebKit `<table>` creates one
  declaration block shared by all its cells (`HTMLTableElement::additionalCellStyle`, which
  carries the default `padding: 1px`), and adds it to every `td`/`th` match as a cacheable
  declaration. A new table means a new block, so every cell misses the cache. When a table has
  two or more kinds of cells (`th` next to `td`, or a `td` with its own style), those entries
  all hold the shared block, it never gets down to one owner, and the sweep never removes them.
  Measured on Safari 17.6: the Decisions screen kept 40–50 KB per redraw until the resolver
  was rebuilt, regardless of redraw rate (2nd-half slopes of 5.0 and 4.3 MB per 100 redraws at
  500 ms and 2 s); Decisions and Health with inline `var()` removed and tables replaced by
  `div`/`span` were flat (0.0 and −0.3 MB per 100 redraws). `mount()` now swaps each newly
  parsed `<table>` for the table element it created in the same position on the previous
  write: the old element takes the new attributes and
  children and stands where the new one was, so the DOM is identical but the shared block keeps
  its address and cells hit the cache. WebKit only drops that block when `border`, `frame`,
  `rules` or `cellpadding` changes; no template sets them, and a test holds that. Tables left
  over from a screen with more tables release their children and wait to be reused.

  Measured on Safari 17.6 against this exact code, MB per 100 redraws: Decisions 0.4 with the
  identical-HTML skip, which in the replay leaves it redrawing nothing at all, and 0.6 with the
  skip disabled — against 18.7 with the skip disabled and the tables still re-created, and 32.9
  before the fix. Health reads 0.4 and 0.7, against 7.0. The long run settles it: 1,398
  consecutive Decisions redraws with the skip disabled moved the footprint from 70 to 71 MB,
  with no sweep sawtooth and no drops. A census of the running DOM on both screens finds no
  `style` attribute left that declares or reads a custom property, 4 tables and 202 cells on
  Decisions, 2 tables and 82 cells on Health. The drawer of the Projects screen, which is where
  that screen's own tables live, was not measured open.

- **`!important` is kept away from the three places where it differs from inline style.** The
  generated rules use `!important` to stand in for inline precedence over normal author rules.
  It differs in three places. It beats CSS animations, which inline normal declarations do not.
  It changes the ordering against any other author `!important` rule, in `styles.css` today or
  in a stylesheet added later. And `revert-layer` (or `revert-rule`) rolls back to a different
  place: inline, `font-size: revert-layer` falls back to the normal rules of `styles.css`, while
  in an `!important` rule it falls back past them (measured in Chrome). A declaration whose value
  contains either keyword is never moved, so its whole attribute stays inline; nothing in
  `public/` uses them. For the first two, two tests hold the line.
  No custom property registered with `@property` or animated by `@keyframes` may be set inline
  anywhere in `public/`. No plain property in a `style` attribute that gets moved (one that
  declares or reads a variable), in the screens rendered from the test fixture, in any template
  in the source or in any `setVars()` call, may be animated by a `@keyframes` block or declared
  `!important` in the page's CSS, where a shorthand, its longhands and logical aliases (`inset`
  and `top`, `width` and `inline-size`, `transform` and `translate`) count as the same property.
  A template value the scan cannot resolve counts as possibly reading a variable, unless a unit
  follows it (`${w}px`). The reviewed exceptions, each re-checked against the CSS and the source
  on every run: `height` on the town's roads and on food being eaten (the only animation of
  `height` is `mb-blink-lid`, which runs solely on `.mb-lid`); `background` on the donut chart's
  legend swatch, which can be `var(--later)` (`qb-march` runs solely on `.qb-pred`, whose style
  is never moved, and `ring-out` runs solely through the countdown ring's inline `animation`,
  whose style is all numbers); and `clip-path` on the area and donut charts, whose values are
  `polygon()`s built from numbers and so never move.
- **The generated stylesheet is bounded.** Once it passes max(512, 2 × the classes still in use
  at the last sweep), rules for classes no longer present in the document are deleted, after
  the new content is in the DOM. That matters on the screens whose markup changes on every
  rebuild: the `--now` phase clock of the shop, the bench and the popover, the walkers'
  `animation-delay` and the lag of food being eaten all produce a new set, and so a new rule,
  on each rebuild. Each inserted rule makes WebKit discard the style resolver and restyle the
  whole page. Measured on Safari 17.6: one inserted rule plus a style flush costs 24 ms on the
  632-element Projects DOM and 49 ms on the 7,106-element shop, against 0 and 5 ms for a class
  toggle; a shop redraw takes 81 ms of write against 64 ms before the fix, every one of them
  inserting a rule, while the bench did not get slower at all (27.0 against 27.0 ms) because
  the `<style>` block inside its `#view` already rebuilt the resolver on every redraw.
  On the shop, that per-rebuild resolver reset is also what currently masks a second WebKit
  effect: the town map carries 6,757 inline pixel styles with 2,216 distinct strings, over the
  1,024-entry deduplication table, so shared blocks are evicted and re-created
  constantly; with `--now` frozen and no rule inserted, memory swung between 148 and 819 MB. The
  popover is bounded for a simpler reason: the menu-bar app reloads `menubar.html` every time
  the popover opens (`showPopover` in `app/NowMenuBar.swift`), so each popover document lives for
  a few redraws.

  Measured on Safari 17.6 against this exact code. **The shop** holds: 0.5 MB per 100 pushes
  over 1,432 of them, 85 → 92 MB, peak 96, with 11 real redraws in the lot; WebKit's malloc
  zone stayed between 42.7 and 58.0 MB and between 230k and 249k allocations over 674 pushes
  with no trend. With the identical-HTML skip disabled it redrew 343 times and sat between 99
  and 118 MB, also with no trend, because each of those redraws inserts its `--now` rule and
  resets the resolver. The CPU bill is where the skip pays for itself: a real shop redraw costs
  81 ms of write against 64 ms before the fix, the extra 17 ms being the rule insert and the
  restyle it forces, but only 3 pushes in 278 cause a redraw at all, so **a whole push fell
  from 74.5 ms to 11.4 ms**. Projects went from 11.2 to 5.7 ms per push, on one redraw in the entire run. Where
  the skip does not engage, the fix costs the string scan that finds the attributes to move:
  Tokens redraws on every push in the replay and pays 40.2 ms per push against 36.4, the bench
  33.7 against 31.6, even though the Tokens write itself came out 1.2 ms cheaper. **The bench**
  shows no write-time regression (27.0 against 27.0 ms) for the reason above, and its memory
  sits at baseline: 1.2 MB per 100 over 915 redraws, 91 → 104 MB and levelling, against 1.6
  before the fix. The registry ends a 278-push run at 43 rules on the shop with the skip and
  403 without, 285 on the bench, 73 on Tokens, 13 on Projects. **The popover** was not measured
  this round; it is bounded by the reload described above. One caveat on all of it: the replay
  pushes twice a second, roughly 60× the production cadence of one push per 30 s, so per unit
  of time every cost above is two orders of magnitude smaller in use.

- **New rules are inserted after the new markup and its classes are in place.** Reading the
  Safari 17.6 source (not measured): the page uses `:has()`, so replacing `#view`'s children
  makes WebKit build a style resolver right away, and a rule inserted before that would throw
  it away and build it twice per redraw.
- **Custom properties set from JavaScript follow the same rule.** `setVars()` routes them
  through the same registry: plain declarations passed alongside a custom property join its
  class, a set with no custom property or with a declaration that cannot be copied is set inline
  whole, and inline properties left by an earlier fallback are removed when the element goes
  back to a class. The town map's `--town-k` on `#view` uses it. While the window is being
  resized below the town's width, the value is rounded down to hundredths, so a drag reuses at
  most a hundred rules instead of inserting one per frame. Once the width has been still for
  150 ms, the exact value is set, so at rest the town is exactly as wide as before (rounding
  alone made it up to 1% narrower, 6.8 px in a 679 px `#view`). Checked in Chrome against the
  old code at 600 px: within the settle window the factor reads 0.76 against 0.7617647, and
  once settled both read 0.7617647 exactly, as does a page loaded at that width. `mount()` and
  `setVars()` leave a detached element inline, because eviction only counts classes found in
  the document.
- **Every HTML write goes through `mount()`.** The bench's measurement line was the last write
  outside it. New tests in `test/dom.test.js` cover the string transform on every screen's
  real output, the bounded registry, the rule-insert order on a minimal fake DOM, and the
  source guards: every HTML write goes through `mount()`, no custom property is set through the
  CSSOM outside `setVars()`, the two `!important` guards above, no `<table>` sets `border`,
  `frame`, `rules` or `cellpadding`, every `Date.now()` that flows into a `style` attribute is
  wrapped in `phase()`, and `element.style` is touched only at listed, reviewed places. The last
  one matters because reading `el.style` makes WebKit switch the element to a mutable inline
  style, which is never cached; on an element that declares custom properties that hands its
  descendants a new custom-property object on every restyle (measured: 24.6 MB per 100 shop
  redraws when `.pet-art` styles were read).
- **What is still not flat, in those same numbers.** Tokens climbs about 12 MB over its first
  200 redraws and then holds 113–119 MB for the next 1,200, second-half slope −0.1. It is a
  warm-up plateau and not either mechanism above: stripping every `style` attribute (2.3) and
  replacing every table with `div`/`span` (2.2) leave the same shape. The bench drifts
  91 → 104 MB over 915 redraws and levels off, at the rate it drifted before the fix (1.6). The
  shop's markup still holds those 2,216 distinct inline pixel strings over WebKit's 1,024-entry
  deduplication table, so the 148–819 MB sawtooth is still written down in the town map; it is
  out of reach today only because the screen almost never redraws and any redraw that does
  happen resets the resolver, and one refactor that redraws the town without inserting a rule
  brings it back. Expressing sprite positions as classes or grid areas is what would remove it.
  One 3-minute excursion to 110–138 MB turned up in the first long Projects run and released on
  its own; 2,070 later redraws never reproduced it and the zone data stayed flat throughout, so
  it is bounded and unattributed rather than accumulation.
- **The fix renders identically to the code before it, checked in Chrome 152.** 424 paired
  base-against-fix checks over 1,504,383 element pairs found **0 computed-style differences**
  on the element, `::before` and `::after`, and 0 differences in tag, child count, direct text,
  classes other than the generated `nv-*` ones and attributes other than `class`, `style` and
  the temporary marker. Every timed check also found identical animation inventories, sampled
  at 0, 250, 1,300 and 7,700 ms with the document timeline frozen. The coverage is the awkward
  states, not just the happy path: both themes on all ten screens, the Projects drawer, the
  five shop panels and all seven decor shelves, the three Tokens tabs across four skins with
  every `<details>` open, the town at 600 px wide and dragged from 1,440 to 600 and back, the
  butler walking, eating and strolling, `prefers-reduced-motion`, a 15-hash tour on one page,
  seven content-changing pushes per screen, the menu-bar popover, and Pomicon private-use
  characters injected into 634 text fields. Deliberately broken controls were caught
  (shifting the fix's animations by 400 ms: 101 property differences on the shop) and returned
  to 0 when reset. The table reuse was observed doing its job in the same harness: across nine
  pushes the fix kept 13 of 13 Tokens tables and 2 of 2 Health tables, the base kept none, and
  the resulting DOM compared equal.

### Changed

- **A hidden tab no longer redraws.** While `document.visibilityState` is `hidden`, SSE
  pushes still update `app.state` and the stash still runs on hide, but `render()` does not
  touch the DOM: it records that a redraw is owed and pays it once, with the latest state, when
  the tab becomes visible. The butler's 8-second slide timer stops while hidden and restarts in
  step with its progress bar on return, the first-load `/api/ping` poll pauses, and the
  connection pulse skips its forced-layout heartbeat. The shop's one-second tick needs no gate
  of its own: it only ever re-arms from inside a render. Verified on Safari 17.6 with the
  window ordered out: across 264 hidden pushes every HTML-write counter stood still — 111
  navigation bars, 2 `#view` writes — and the footprint stayed between 90 and 93 MB; the owed
  redraw was paid once on return. Before the fix the same hidden phase kept redrawing (75 → 231
  navigation bars) and swung between 160 and 965 MB.
- **A redraw that produces identical HTML keeps the DOM.** When the freshly built `#view`
  string is byte-identical to what `mount()` last wrote there, the view is left alone, so
  focus, text selection and open `<details>` survive, and nothing is re-created for the style
  cache to key on. The butler block is
  deliberately excluded because its slide progress bar restarts by being re-mounted. On the
  Projects screen the saving is the whole redraw: in a 337-push replay it was byte-identical
  every single time, so `#view` was written once, and the cost of a push fell from 11.2 to
  5.7 ms. Decisions, Timeline and Stats also wrote nothing after the first mount. Tokens and
  the bench never take the shortcut in that replay, because their markup differs on every state
  push beyond the phase values; whether their real-world redraws differ that much was not
  tested. Keeping the DOM exposed one stale-state bug that the old
  remount had been hiding: clicking a report button twice in a row left its tooltip stuck on
  the "copied" message, because the second click saved that message as the tooltip to restore.
  The button now restores any pending tooltip before saving it. Likewise, a hidden tab that
  became visible again while the first-load `/api/ping` was still in flight no longer starts a
  second poll loop.
- **A `#view` redraw that differs only in animation phase keeps the DOM too.** The shop, the
  bench and the popover lock animations to the wall clock with a negative `animation-delay`
  computed at render time (`--now` from `lifeClock`, the walkers, the butler strolling or
  pacing), so their HTML used to differ on every redraw and every redraw rebuilt the town,
  inserted a new `--now` rule and paid the resolver rebuild above. Those values are now wrapped
  in `phase()`, and the identical-HTML check of `#view` ignores them: when nothing else changed,
  the running DOM is already at the phase the new numbers would set, so the redraw of the shop
  or the bench is skipped. A redraw with any other change still rebuilds with fresh phase
  values. The popover has no such check (`menubar.js` calls `mount()` directly), so it still
  rebuilds and inserts a `--now` rule on every redraw; one opening redraws only a few times
  (cached state, freshly built state, the butler ledger, then clicks) and the document is
  discarded when the popover closes. `phase()` wraps its value in two private-use characters
  (U+E000, U+E001) that `mount()` strips before anything reaches the DOM. Content can contain
  those characters too (Nerd Fonts put their Pomicons glyphs there), so `esc()` writes them as
  character references: such a glyph in a project name still renders, and an edit next to it
  still redraws. Why not a fixed pool of `--now` rules reused in turn: the cache key is the
  address of the parent's custom-property data, so every distinct `--now` still produces a new
  generation of entries for every descendant of `.shop`, which only a resolver rebuild clears,
  and editing a rule that is in use rebuilds the resolver just like inserting one.
- **One-shot CSS animations inside `#view` no longer replay on a push with identical HTML.**
  An animation that runs once (no `infinite`) used to start over on every push, because every
  push re-created its element. The element is now kept when the HTML has not changed, so the
  animation plays once and holds its end state until the screen's HTML actually changes.
  Infinite animations are unaffected, and the navigation bar, the quota strip, the butler
  slots and the drawer still remount on every redraw. One click depends on such an animation:
  clicking the town place that is already open produces the same HTML, so the shop panel's
  arrival animation (`came`) is restarted on the kept element instead, and the click still shows
  something when the panel is already in view.
- **A looping animation with a fixed delay now keeps its own phase instead of restarting.**
  The same keeping of the DOM changes when a loop that is *not* locked to the wall clock
  starts from. The bench's menu-bar lid (`mb-blink-lid`, a fixed `-5.3 s` delay) used to be
  re-created, and so restarted, by every push; it now runs on from the mount that created it
  (measured in Chrome after a soak: started 2,983 ms ago against 733 ms on the old code). The
  same goes for the town's wall-clock loops, which come out a few tens of milliseconds off a
  freshly mounted copy (61.8 ms against 46 ms after a 120-second soak, 109.5 against 75.7 after
  30 seconds). That offset is mount latency, and it does not grow with time.

## [1.2.1] — 2026-09-10

One test, red on every CI job at 1.2.0 and green on the author's machine, because it
asserted a property of the SQLite build rather than of this code.

### Fixed

- **The orphaned-WAL test no longer asserts which SQLite build is installed.** Whether
  `mode=ro` can open a WAL-mode `.db` whose `-wal` and `-shm` have both been cleaned up is
  decided by the build: 3.43.2, the Apple build, returns `SQLITE_CANTOPEN(14)` and falls
  through to the `immutable=1` branch, while the build on ubuntu-latest opens it directly and
  recreates `-wal`. The test asserted the first, so it could only ever be green on half the
  machines that run it. What the scan actually promises is narrower and is what the test
  checks now: the conversation still yields its turns, and the `.db` is not changed by a byte,
  verified by md5 across the read. Recreating a sidecar file is allowed; touching the user's
  data is not. The docblock above `query()` made the same overstatement and now says "some
  builds", with both measurements written down.

## [1.2.0] — 2026-09-10

The sit-too-long ladder reaches the menu-bar icon, the focus rhythm drops to an hour, and
the suite learns to render. Most of the Fixed section below comes out of a review pass that
read the whole working tree twice: once to find the defects and once to check the fixes, so
several entries are corrections to work done earlier in this same release.

### Added

- **The sit-too-long ladder now reaches the menu-bar icon.** Until now every part of the
  break system — the focus bar, the nudge line, the five verified moves — lived *behind*
  the click that opens the popover, which means it only ever reminded people who had
  already asked. Three stages, every threshold **derived** from the focus cycle rather than
  invented: the end of the alert phase (the same boundary the focus bar draws) puts an
  amber dot on the icon, a full cycle turns it into a red disc with an exclamation mark,
  and two cycles without one counted break tint the whole badge red. Written against a
  90-minute cycle, those read 70 / 90 / 180; the cycle dropped to 60 minutes later in this
  same release (see below) and the three marks slid to **40 / 60 / 120** without a line
  being edited, which is the whole argument for deriving them. The stage is decided server-side (`rest` on `/api/badge`); the Swift app
  keeps its no-rules boundary and just paints. Clears the moment a verified break lands,
  ten silent minutes pass, or the game is off; while a move is running the icon stays
  quiet instead of nagging the person who just obeyed it. Colored stages leave template
  mode — a first for this icon — and the snapshot harness caught the one real trap: colors
  must stay *dynamic* and resolve inside the button's own draw pass, not be resolved at
  paint time against the app's appearance (a bare binary resolves to Aqua and the text
  vanishes on a dark bar; measured, reverted, documented in place).

  A day later the pet's **starving** state was given its own rung at the red disc, and a
  month after that it was taken back off, which is worth writing down because the second
  measurement is the useful one. The case for adding it was real: the user sat hungry and
  tired at a silent icon (screenshot, 9 Aug), because the ladder read only the sitting
  clock and could show `stateOf`'s #3 state (spent) while staying mute on #2 (starving).
  The case for removing it is that `fedAt` in the pet ledger had stood still since 7 Sep,
  so the icon carried a red disc for over two days on account of a game state the owner
  simply was not feeding (measured 10 Sep). The red disc is the channel the token quota and
  the sitting ladder use to say "something really needs doing", and a red mark ignored for
  two days teaches the eye to skip the whole channel. So **only the `rest` ladder lights the
  icon**, and hunger is still *said* rather than shown: once a real rest stage has fired,
  the tooltip carries the `badge.starve` sentence alongside it. What did survive the
  reversal is the split it forced: the server resolves the final *picture* (`alert.level`:
  dot / bang / flood) plus the tooltip sentence, and the Swift side dropped its one
  hardcoded sentence and paints three named shapes, so a third cause someday costs no
  app rebuild (the `rest` data field stays for older builds). Ordinary hunger never
  reaches the icon either — a 16-hour cycle still comes around about once a day, and a daily
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

- **The minutes you have been sitting now show beside the butler, and the badge around them
  is for sale.** The number had been pulled off the status sheet a round earlier on the
  grounds that `nudgeOf` already prints it — true only half the time, because `nudgeOf`
  returns `null` while `focusMood` is `sharp`, so the whole stretch you are *actually*
  focused had no number anywhere. It hangs on the butler's **left** shoulder: the right half
  of the sky belongs to the speech and thought bubbles, and the sleeping z's, so a number
  over there fights for a corner every time the butler has something to say. Click the
  sprite open and the badge switches off — the stat sheet takes that same column — and the
  number moves into the focus row as a tail. The switch is a CSS rule, not a JS branch:
  opening a `details` does not rebuild the DOM, so a branch decided at render time would
  freeze and the number would vanish for good on the next fold.

  The badge is two layers, and the outer one is a shop item: six **clock faces** in a new
  `clock` slot, 90 → 1120 coins on the same tier ladder the other six slots use. The slot
  sells a *shell*, not an object — no sprite, and never will have one, because what it wraps
  is a number the browser draws — so `face: true` says so in `ITEMS` and every sprite-side
  check reads that field instead of being loosened to tolerate six items with no art. Its
  own rule replaces the one it cannot take: **a dearer face changes one more channel, not
  one more shade** — brass and wood swap material, slate adds an inner ring (thicker rule,
  same box: widening `border-width` would push a left-anchored badge toward the sprite),
  ticket adds a dashed edge, neon adds a glow around the digits themselves, and pulse — the
  top of the ladder — adds a run bar under the number as long as the rhythm you have left,
  so it is the one face that answers "how much longer" without opening anything. That ladder
  is counted (the `--sat-*` declarations per rule) and a test refuses to let it go backwards
  against price. The shop previews each face with the *real* badge at the *real* current
  minute — the same `satChip` the popover calls — because a shelf that mocks up what it
  sells is the worst mistake a shop can make. First try shipped the run bar as a 2px line
  and it failed on screen: 85%, 42% and 8% all looked identical at a 19px box, so it gained
  a 40% wash across the whole background and the bar kept only the job of marking the exact
  end.

  **Second pass, after the owner looked at them: "the clock faces aren't pretty yet."** Four
  things were wrong and none of them was taste. All six were the same *shape* — a rounded box
  with a 1px rule — so at real size they were six labels in different colors; brass and wood
  shared one brown-gold tone; the pulse wash cut vertically through the digits, reading as a
  render bug rather than a bar; and a hard `1px 1px 0` shadow made every face read as a
  sticker pasted onto the picture. The root cause was one line: the badge was anchored by its
  LEFT edge, so anything that made it wider pushed it toward the butler, which banned every
  channel that changes width — typeface, tracking, clip shape. Anchoring the RIGHT edge
  instead makes it grow *away* from him into 100+ px of empty sky, and fixes a live bug on the
  way: `2g05` is six pixels wider than `47′`, and those six pixels used to land on the sprite.
  With that unlocked, each face became a different *object* rather than a different shade —
  brass a struck coin (pill, top-lit rim, serif digits), wood an engraved tag (uneven grain,
  incised text), slate an eight-sided chip with letter-spaced sans, ticket a real perforated
  stub with a tear line, neon a glowing tube, pulse a bar in a *bed* (the missing half: a
  progress bar needs the trough as much as the fill, which is why the first version was
  invisible and the wash that replaced it was worse). The test that guards the price ladder
  earned its keep immediately — it failed the moment ticket at 400 coins declared fewer
  channels than slate at 240.

### Changed

- **The focus rhythm drops 90 minutes → 60.** Owner's call (*"lower the rhythm to 60 minutes
  for me"*), and the honest part is what it costs: the 90-minute step was anchored to a
  *whole* BRAC cycle, and 60 is not a landmark of that model at all — it is the **alert
  phase** (the first 60–70 minutes). So the bar stops claiming to measure a cycle and now
  measures the stretch where attention holds, draining exactly when that stretch ends. Read
  that way it stands up, and it lands closer to the project's *original* request ("drains
  over 1 hour") than the step it replaces, which had needed a paragraph explaining the gap.
  The thing to watch: nudges fire 1.5× more often now, and a permanent reminder is a line
  people learn not to see — if the nudge starts getting ignored, this is the first place to
  suspect, and the way back is 75 minutes, not 90. Nothing needed hand-editing downstream:
  the trough stays 20 *real* minutes (`FOCUS_DIP` derives from it), `stretch` gives back half
  a rhythm rather than a hardcoded 45, and the icon's three sit-too-long marks slid 70/90/180
  → 40/60/120 on their own because they were always derived. Six tests that had copied
  minute figures by hand now derive them too, so the next rhythm change breaks none of them.
  Two price comments left over from the 16-hour hunger step were stale in the same way and
  got corrected alongside.

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
- **A repo the dashboard could not read no longer gets invented git numbers.** `unreadable()`
  returned the same shape as a successful scan, so `integrity()` scored a board it had never
  measured at 93/100, the Δ column printed `0` and the Dirty cell came out blank, all three
  indistinguishable from a clean repo with nothing to report. An unreadable repo now carries
  `unknownCommit`, which is the one flag `integrity()` listens to: the same one-day-old board
  scores **25/100** with the flag set against 93/100 without it, and the two cells print `?`
  and `—` instead of a number and a blank. A project card that throws while being built now
  gets its own bilingual label rather than borrowing "NOW.json couldn't be read", which named
  the wrong cause.

- **Turning the pet game off now actually stops it.** The `on === false` gate sat only on the
  30-second background tick, while `/api/badge` — the endpoint the menu-bar app polls every
  30 seconds — went straight past it and kept accruing coins, observing rest and writing the
  ledger. The gate moved into `withPet`, so every read-only path is covered by the same rule
  rather than by each caller remembering it. Switching the game back on loses no coins,
  because accrual is keyed by calendar day and reconciled against the series.

- **The Antigravity cycle ledger repairs itself on every write instead of growing one row per
  snapshot**: 512 rows / 158 KB fold back to 35 rows / 46 KB. Two overlapping writes no longer
  lose a snapshot to `ENOENT` either, now that each write gets its own PID-tagged temp filename
  instead of all of them racing for one `.tmp`.

- **An Antigravity chart that parses nothing now says so instead of leaving a blank rectangle.**
  A scan that opens every conversation and extracts zero calls used to set `ok: false` on a
  signal nothing read, so the chart block simply vanished. It now renders a titled notice
  carrying the file count. The scan payload also reports `parsed` next to `rows`, so partial
  breakage is countable rather than inferred (measured 10 Sep: 226 files, 11,477 rows, 11,477
  parsed, 11,204 calls inside the 14-day window).

- **The data-directory ownership warning now fires on the `now-dash` bin entry too.** The
  startup guard compared the entry *filename* against `server.js`, which is exactly the check
  that fails on the symlink an npm install creates, so the guard switched itself off on the
  one path a packaged install takes. It compares entry realpaths now. Measured end to end by
  launching the real server through a `now-dash` symlink: 0 `owner.json` written before, 1
  after.

- **The local-day test now goes red at UTC, so the whole CI matrix can catch the timezone bug
  it was written for.** Its expected value was a line-for-line copy of `localDay` (same `Date`
  getters, same `padStart`) and its only `notEqual` was skipped at offset 0, so replacing the
  function with `iso.slice(0, 10)` left every test green on all four Node versions CI runs. It
  builds the expected day through `Intl.formatToParts` now, compares one instant written two
  ways (`2026-07-25T20:30Z` against `2026-07-26T03:30+07:00`), and rejects `2026-07-32T10:00Z`,
  which slicing would happily accept. The slice mutant is red in all 12 zones measured, UTC
  included.

- **The suite now renders every screen instead of only importing it.** `modules.test.js` had
  imported the view modules without calling them, which is the "288 tests green and `#view`
  is empty" hole this project had already written down once. `test/views.test.js` walks all
  ten render functions in both languages against a real state snapshot. The snapshot is
  anonymised on purpose, since this repo is public: it is checked for machine paths and the
  author's org name on every run, and the key list it asserts covers every branch a view
  *reads*, not merely the ones that used to throw.

- **The session-host ledger stops losing writes, and the test that went red about one run in
  six stops doing that.** `syncHosts` deliberately does not await its write, so two writes
  issued close together were in flight at once. They shared one temp filename, so whichever
  renamed second hit `ENOENT` and vanished; and even once each write got its own name, they
  could still land in the order the disk chose rather than the order they were issued, which
  let an older snapshot overwrite a newer one with nothing thrown anywhere. Writes are queued
  now, each taking its snapshot when it is issued, so the last caller wins. Measured by
  forcing two writes back to back: the parallel version loses the newer one in roughly 2% of
  rounds, the queued version in 0 of 1,200. A 40-round ordering test locks it, and it is red
  on the parallel version in 6 of 10 runs.

- **CI now runs the suite in three timezones rather than one.** Los Angeles was already there;
  Pacific/Kiritimati (UTC+14) is the far-east mirror that breaks the same day-boundary
  assumption in the opposite direction, and Pacific/Chatham (UTC+12:45) catches anything that
  assumes offsets land on a whole hour. All three were run by hand at 635/635 first, because a
  zone that arrives red teaches people to ignore the job.

- Tests: 510 → 636, and the suite passes in all six timezones measured (Asia/Ho_Chi_Minh, UTC,
  America/Los_Angeles, Europe/Berlin, Pacific/Kiritimati, Pacific/Chatham).

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

[Unreleased]: https://github.com/archi-ai-labs/now/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/archi-ai-labs/now/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/archi-ai-labs/now/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/archi-ai-labs/now/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/archi-ai-labs/now/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/archi-ai-labs/now/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/archi-ai-labs/now/releases/tag/v1.0.0
