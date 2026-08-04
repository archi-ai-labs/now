# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/archi-ai-labs/now-board/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/archi-ai-labs/now-board/releases/tag/v0.1.0
