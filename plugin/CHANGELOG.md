# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] — 2026-09-10

The read path stops writing, and three rules that only worked on one machine
were corrected against what the machine actually does.

### Fixed

- **`/now-board:now` no longer writes anything.** It used to run `update` on your
  behalf whenever the board had drifted past five commits or three days, and
  create a board from scratch in a repo that had none, which meant the command
  documented as read-only rewrote `NOW.json`, re-rendered `NOW.md` and appended to
  `.gitignore`. On a real machine that was not an edge case: eight of nine boards
  measured were over the threshold, so the read path was the write path. It now
  prints one stale line and stops. This is also what unblocks a Claude-invocable
  read-only skill, which could never have been split out while the read path wrote.
- **Drift is measured with the marker checked first.** `git log <sha>..HEAD | wc -l`
  answers confidently when it should not: a marker no longer in history (a rebase,
  a `filter-repo`) counts the entire branch, and a marker that is not a SHA at all
  sends `git` to stderr and leaves `wc -l` counting an empty stdout as zero, which
  reads as "not drifted". Three of nine boards on the author's machine hit one of
  those two. The skill now runs `git cat-file -e` and `git merge-base --is-ancestor`
  before counting, and falls back to the date alone under the same name the
  dashboard already uses for it, `unknownCommit`.
- **The transcript directory is resolved the way Claude Code names it.** Session
  names for `sideTracks` were looked up under `$(pwd | sed 's|/|-|g')`, but Claude
  Code replaces *every* non-alphanumeric character, not just the slash. A repo
  called `now_dashboard` therefore looked in a directory that does not exist, the
  `cd` failed, and the whole "two ways back into that session" block came out empty
  with nothing said. It now substitutes `[^A-Za-z0-9]` and prints the path it tried.
- **Nothing is installed on your machine.** "Use `jsonschema` if available" was
  loose enough that one run resolved it by shelling out to `pip3 install jsonschema`
  mid-update, which contradicts the promise that the skill only writes inside your
  repo. The check is now one fixed probe with a documented built-in fallback, and
  exceeding a `maxItems` ceiling warns instead of refusing to write: a long board is
  a real board, but a board that fails to save is twenty minutes gone.

### Changed

- `/now-dash` finds the installed dashboard by the LaunchAgent's new public label
  `io.github.archi-ai-labs.now-dash` (renamed from the author-personal
  `dev.hoanluu.now-dash`; the dashboard's `install-app` migrates old installs).
  Shipped in the repo on 8 Aug but never released, so every installed copy kept
  probing the old label, concluded nothing was installed, and would have offered to
  clone a second one right next to the first.
- **The claim that a project-local skill overrides the plugin was wrong**, and wrong
  in the most expensive direction: it sent people to edit a copy that never loads.
  Measured on a repo carrying both, ten out of ten loads resolved to the personal
  copy in `~/.claude/skills/now/`. The skill now says to keep exactly one copy and
  to flag duplicates rather than guess which one wins.
- `all` scans `NOW_ROOTS` (comma-separated, defaulting to `~/Projects`) instead of a
  hard-coded `~/Projects`, which is the same variable the dashboard reads. A board
  outside that path used to show up on the dashboard while staying invisible to the
  skill that writes boards. Its "repos with recent commits and no board" step, which
  was prose where every other step was a command, is now a command.

## [0.2.0] — 2026-08-05

The plugin moved into the repo that holds the dashboard reading its boards, and
gained a skill for installing that dashboard.

### Added

- `now-dash` skill — installs or updates the NOW dashboard. macOS only, and
  closed to Claude like `now`, so it runs only when typed. It never installs
  *from* the plugin cache: `bin/install-app` bakes an absolute `ROOT` into the
  compiled binary, and the cache path carries a version number, so one plugin
  upgrade would leave a LaunchAgent calling a path that no longer exists. The
  skill puts the source where you choose and builds it there.

### Changed

- Lives at `plugin/` inside [archi-ai-labs/now](https://github.com/archi-ai-labs/now)
  instead of a repo of its own. The catalog entry switched to a `git-subdir`
  source; measured before switching, the cache layout is byte-for-byte what it
  was when the plugin was its own repo, so `${CLAUDE_PLUGIN_ROOT}` and every
  path resolved from it are unchanged. Nothing to do on an installed machine
  beyond `/plugin marketplace update`.
- Release tags are now `now-board--v<version>`; a bare `v<version>` no longer
  says which half of the repo it marks.

## [0.1.0] — 2026-08-04

First release. Extracted from a personal skill that lived in
`~/.claude/skills/now/` and was copied between machines by hand.

### Added

- `now` skill — read the board, `update` to rewrite `NOW.json` + `NOW.md`, `all`
  to scan every project under `~/Projects`. Every mode lists stray worktrees.
- `skills/now/now.schema.json` — the `schemaVersion: 1` contract for `NOW.json`,
  shipped with the skill so the writer and any reader agree on one file.
- CI: `claude plugin validate . --strict`, tag-matches-version, and a check that
  the schema is still where `SKILL.md` says it is.

### Changed from the personal skill

- The skill is **closed to Claude** (`disable-model-invocation: true`). The
  personal copy triggered on its own when you asked "where was I"; this one runs
  only when typed. It writes files, and a plugin skill's frontmatter cannot be
  overridden by the person who installs it — so always-on cost is 0 tokens and
  the write path is never entered without being asked for.
- The schema is resolved from `${CLAUDE_PLUGIN_ROOT}`, not from a hard-coded
  `~/.claude/skills/now/` path that does not exist for an installed plugin.

[Unreleased]: https://github.com/archi-ai-labs/now/compare/now-board--v0.2.1...HEAD
[0.2.1]: https://github.com/archi-ai-labs/now/releases/tag/now-board--v0.2.1
[0.2.0]: https://github.com/archi-ai-labs/now/releases/tag/now-board--v0.2.0
[0.1.0]: https://github.com/archi-ai-labs/now-board/releases/tag/v0.1.0
