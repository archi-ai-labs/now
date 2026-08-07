# Changelog

Notable changes to the **dashboard**. The plugin that ships in `plugin/` keeps its
own history in [`plugin/CHANGELOG.md`](plugin/CHANGELOG.md) and its own tags
(`now-board--v<version>`), because the two halves ship on separate clocks.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
