# Changelog

Notable changes to the **dashboard**. The plugin that ships in `plugin/` keeps its
own history in [`plugin/CHANGELOG.md`](plugin/CHANGELOG.md) and its own tags
(`now-board--v<version>`), because the two halves ship on separate clocks.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Three items off the backlog — `B13`, `B14`, `B18`. All three turned out to be specified
against numbers that had since moved; the notes in [`BACKLOG.md`](BACKLOG.md) record what
each one actually was once measured again.

### Added

- **Failed external commands now say why.** `run()` collapsed every failure into an empty
  string, so "not a git repo" and "git is not installed" reached the screen as the same
  sentence. `src/lib/sh.js` now classifies — timeout, not-found, no-access, overflow, exit,
  spawn — and the Health view leads with anything that is not a plain non-zero exit. A
  non-zero exit is a valid answer, not a malfunction: it is what `git rev-parse` returns in
  a directory that is not a repo, the most common outcome of any scan.

### Changed

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

- Tests: 476 → 498.

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

[Unreleased]: https://github.com/archi-ai-labs/now/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/archi-ai-labs/now/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/archi-ai-labs/now/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/archi-ai-labs/now/releases/tag/v1.0.0
