# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `/now-dash` finds the installed dashboard by the LaunchAgent's new public label
  `io.github.archi-ai-labs.now-dash` (renamed from the author-personal
  `dev.hoanluu.now-dash`; the dashboard's `install-app` migrates old installs).

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

[Unreleased]: https://github.com/archi-ai-labs/now/compare/now-board--v0.2.0...HEAD
[0.2.0]: https://github.com/archi-ai-labs/now/releases/tag/now-board--v0.2.0
[0.1.0]: https://github.com/archi-ai-labs/now-board/releases/tag/v0.1.0
