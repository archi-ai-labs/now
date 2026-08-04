# now-board

[![validate](https://github.com/archi-ai-labs/now/actions/workflows/plugin-validate.yml/badge.svg)](https://github.com/archi-ai-labs/now/actions/workflows/plugin-validate.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-8A63D2.svg)](https://docs.claude.com/en/docs/claude-code)

> A **Claude Code plugin** that keeps a 30-second board per repo — what you were
> doing and the one next action, what is waiting on your decision, what is waiting
> on someone else — so coming back to a project does not start with re-reading the
> diff.

*This is the plugin half of [archi-ai-labs/now](https://github.com/archi-ai-labs/now).
The other half is a dashboard that reads every board this plugin writes into one live
page — see the [repository README](../README.md), which covers both. Installing the
plugin does not install the dashboard, and does not need to.*

Coming back to a repo you left two weeks ago costs twenty minutes before you touch
anything: read the log, open the last branch, try to remember which of three
half-finished things was the one that mattered, and discover a worktree in `/tmp`
you had forgotten was holding uncommitted work. The expensive part is not the
reading — it is that nothing on disk says which thread was the live one, so you
reconstruct it every time from evidence that was never meant to carry that. This
plugin writes that one thing down, in a gitignored file per repo, and rewrites it
when you ask.

**Requirements:** Claude Code, and `git` in the repo you run it in — drift is
measured with `git log`, so outside a git repo the board still renders but stops
telling you how stale it is. `python3` is used by one optional snippet that reads
Claude session names out of transcripts; without it, parallel sessions are still
listed, just without the names that make them findable again. If the `jsonschema`
package is importable it validates `NOW.json` properly, otherwise the skill falls
back to checking required keys by hand. **The skill and the board it writes are in
Vietnamese** — the manifest and this README are the only English here.

**Menu:** [Install](#-install) · [Usage](#-usage) · [What the board holds](#-what-the-board-holds) · [Uninstall](#-uninstall) · [For maintainers](#️-for-maintainers) · [Roadmap](#️-roadmap)

---

## 🚀 Install

Two ways to install — a one-line terminal command, or from inside Claude Code.
**Option 1 is recommended.**

### Option 1 — One command in your terminal ⭐

Installs globally in your **user** settings (`~/.claude/settings.json`), so it's
active in every project. Paste this in:

```bash
curl -fsSL https://archi-ai-labs.github.io/agent-marketplace/install.sh | bash -s -- --plugins now-board
```

Want it in **one project only** instead? Add `--project` — it writes
`./.claude/settings.json` in the current folder rather than your home config:

```bash
curl -fsSL https://archi-ai-labs.github.io/agent-marketplace/install.sh | bash -s -- --plugins now-board --project
```

Either way it's safe to re-run: it backs up your existing `settings.json` first and
aborts without touching it if the JSON is invalid.

### Option 2 — Inside Claude Code (Windows / no bash)

No terminal or `bash` needed — run these from a Claude Code session, works everywhere:

```
/plugin marketplace add archi-ai-labs/agent-marketplace
/plugin install now-board@archi-ai-labs
```

The `/plugin install` step **does not default to global** — it opens a scope picker.
Choose:

- **User** — every project (same as Option 1) → **pick this for global**
- **Project** — this repo, shared with collaborators (`.claude/settings.json`)
- **Local** — this repo, just you (`.claude/settings.local.json`)

> Want global with no picker? Run the shell command
> `claude plugin install now-board@archi-ai-labs` — it installs to **User**
> scope (global) unless you pass `--scope`.

### ▶︎ After installing (either option)

1. **Restart** Claude Code (or run `/reload-plugins`) — it fetches the plugin from GitHub.
2. If asked to **trust** the `archi-ai-labs` marketplace, approve it once. ✅
3. In a repo you actually work in, run **`/now-board:now update`** — there is no
   board yet, so this is the run that writes one, and it appends `NOW.json` and
   `NOW.md` to that repo's `.gitignore`.

<details>
<summary><b>Extras</b> — read the script first · local dev · what the installer writes</summary>

### Prefer to read the script before running it?

Piping `curl` into `bash` runs code sight unseen. To inspect it first:

```bash
curl -fsSL https://archi-ai-labs.github.io/agent-marketplace/install.sh -o install.sh
less install.sh   # review
bash install.sh --plugins now-board   # then run
```

### Local dev — try it without installing

Fastest loop while editing the plugin:

```bash
claude --plugin-dir .
```

### What the installer actually writes

The install script (Option 1) deep-merges these two keys into the target
`settings.json` — you can add them by hand instead of running the script:

```json
{
  "extraKnownMarketplaces": {
    "archi-ai-labs": {
      "source": { "source": "github", "repo": "archi-ai-labs/agent-marketplace" }
    }
  },
  "enabledPlugins": {
    "now-board@archi-ai-labs": true
  }
}
```

`extraKnownMarketplaces` pre-registers the marketplace; `enabledPlugins` turns the
plugin on by default.

</details>

---

## 💡 Usage

One skill, three modes — the mode is the word you type after it:

| Command | What it does | Writes files |
|---|---|---|
| `/now-board:now` | Print this repo's board, then measure how far it has drifted from `git` | No |
| `/now-board:now update` | Rewrite `NOW.json` and re-render `NOW.md` from what you're actually doing | Yes |
| `/now-board:now all` | Scan every `NOW.json` under `~/Projects` and print one table across projects | No |

**Typical flow:** `now` when you sit down → work → `now update` before you leave.

```text
$ /now-board:now
  → prints the board, flags "12 commits since the stamp" and a worktree in /tmp
$ /now-board:now update
  → rewrites NOW.json + NOW.md from this session's work and the git log since
```

The skill is **hidden from Claude** (`disable-model-invocation: true`): it runs
only when you type it, and its description is never loaded into your context.
Measured always-on cost, by the marketplace's own recipe: **0 tokens**. That is
not thrift for its own sake — the skill writes files, and a plugin's frontmatter
cannot be overridden by the person who installed it, so the write path stays
behind an explicit ask.

Nothing here reads a board that is not yours: `all` looks under `~/Projects` only,
and every mode writes only inside the repo you ran it in.

---

## 📋 What the board holds

Two files at the repo root, both gitignored, because they are per-machine working
state and not something to merge:

- **`NOW.json`** — the machine-readable one, validated against
  [`skills/now/now.schema.json`](skills/now/now.schema.json) (`schemaVersion: 1`).
- **`NOW.md`** — rendered from the JSON in the same run, for reading without Claude.

The board is a one-way digest with `ref`s pointing back at the real sources. It is
never the source of truth, which is why it can be regenerated and why losing it
costs nothing but the twenty minutes it was there to save.

Five sections, and the rule that keeps them honest is that each one names **who
holds the ball** — a single item lives in exactly one of them:

| Section | Who holds it |
|---|---|
| 🎯 `focus` | you, right now — one deliverable, plus the next action under 30 minutes |
| 🤔 `decisionsNeeded` | your head — each row is one answerable question with a short handle |
| ⏳ `waitingOn` | someone else — who, and since when |
| 📥 `upNext` | nobody yet |
| ✅ `recentlyDone` | nobody — context only, last in the file |

A decision you have already handed to someone else is `waitingOn`, never both.
That constraint is the whole design: a board where an item can appear twice is a
board you stop trusting after the second time you act on a stale copy.

**Stray worktrees are re-scanned on every run** and never stored, because that
data goes stale within minutes. A worktree under `/tmp` gets flagged — it does not
survive a reboot — and so does one holding uncommitted work.

Anything reading `NOW.json` should read the schema, not this table. It ships in
the plugin so a writer and a reader can never be looking at two different files.

---

## 🧹 Uninstall

From inside Claude Code:

```
/plugin uninstall now-board@archi-ai-labs    # remove the plugin
/plugin marketplace remove archi-ai-labs       # also drop the catalog (optional)
```

- **Just turn it off** without removing: `/plugin disable now-board@archi-ai-labs`
- Run `/reload-plugins` (or restart Claude Code) to apply.

> Removing the marketplace uninstalls every plugin you installed from it — so if
> this was your only one, `marketplace remove` alone is enough.

**Installed with the script (Option 1)?** You can instead undo it by deleting the
two keys the installer added — `extraKnownMarketplaces["archi-ai-labs"]` and
`enabledPlugins["now-board@archi-ai-labs"]` — from your `settings.json`. The
installer left a timestamped `.bak` copy next to it to restore from.

**The boards themselves are not touched by any of this.** Uninstalling leaves
every `NOW.json` / `NOW.md` where it is; they are gitignored files in your repos,
so remove them by hand if you want them gone.

---

## 🛠️ For maintainers

<details>
<summary><b>Validate before sharing</b></summary>

```bash
claude plugin validate . --strict    # manifest + skill frontmatter
```

`--strict` turns warnings into failures. An unrecognized or slightly misspelled
field still loads at runtime, which is exactly why it has to fail here — the
field you typo is the field you believe you set.

That runs automatically on every push and PR via
[`.github/workflows/plugin-validate.yml`](../.github/workflows/plugin-validate.yml), which also
parses `now.schema.json` and asserts it is still at the path `SKILL.md` tells the
skill to resolve. `plugin validate` treats the schema as data and would not catch
either. The catalog is validated separately, in
[`archi-ai-labs/agent-marketplace`](https://github.com/archi-ai-labs/agent-marketplace).

</details>

<details>
<summary><b>Cut a release</b></summary>

The version lives in exactly one place — `.claude-plugin/plugin.json` — so it
never drifts.

1. Bump `version` in `plugin.json`.
2. Move the `Unreleased` notes into a dated section in [CHANGELOG.md](CHANGELOG.md).
3. Commit, then tag: `git tag v<x.y.z> && git push --tags`.

> CI enforces this: pushing a tag `v<x.y.z>` fails the build unless it matches
> `version` in `plugin.json` — so steps 1 and 3 can't silently drift apart.

Subscribers pick up the new version on their next `/plugin marketplace update`
(or a session restart).

</details>

<details>
<summary><b>Project layout</b> — a subdirectory plugin, not a marketplace</summary>

The plugin is a **subdirectory** of a repo that also holds the dashboard. The catalog
it is distributed through lives in
[`archi-ai-labs/agent-marketplace`](https://github.com/archi-ai-labs/agent-marketplace)
— so there is no `marketplace.json` here, only a `plugin.json`. The catalog entry uses
a `git-subdir` source pointing at `plugin`, and Claude Code sparse-clones just that
directory: nothing outside it reaches the plugin cache, and its contents land at the
root of the cached version, exactly as when the plugin was a repo of its own.

```
now/                               # the repository
├── plugin/                        # ← the plugin; everything the cache gets
│   ├── .claude-plugin/plugin.json #   the manifest (single source of version)
│   ├── skills/
│   │   ├── now/
│   │   │   ├── SKILL.md           #   hidden, writes the board
│   │   │   └── now.schema.json    #   the NOW.json contract, schemaVersion 1
│   │   └── now-dash/SKILL.md      #   installs the dashboard (macOS, call by name)
│   ├── CHANGELOG.md
│   ├── LICENSE
│   └── README.md                  #   this file
├── .github/workflows/plugin-validate.yml   # CI: manifest, schema, frontmatter
└── …                              # the dashboard: server.js, src/, public/, app/, bin/
```

Release tags are `now-board--v<version>`, not a bare `v<version>` — the repo carries two
things, so a plain version tag would not say which one it marks. `claude plugin tag`
produces that shape, and CI fails a tag whose version disagrees with `plugin.json`.

`now.schema.json` sits **inside the skill directory**, not in a top-level
`schema/`. An installed plugin is copied whole into `~/.claude/plugins/cache`, and
`SKILL.md` resolves the file through `${CLAUDE_PLUGIN_ROOT}` — keeping it beside
the skill means the fallback ("it is next to this file") is true as well, so the
path survives even in a session where that variable is not set.

</details>

<details>
<summary><b>Where this came from</b></summary>

It was a personal skill in `~/.claude/skills/now/`, copied between machines by
hand, with its schema read by an unrelated dashboard through a hard-coded
`~/.claude/skills/now/now.schema.json`. Two copies of a contract, no version on
either. Packaging it did not change the judgement in `SKILL.md` — it changed who
can get it and how a consumer finds the schema.

</details>

---

## 🗺️ Roadmap

- **An English board.** The skill's prose and every heading it renders are
  Vietnamese, which makes it useful to exactly one reader today. The blocker is
  not translation effort — it is that several of the rules in `SKILL.md` are
  phrased as much to rule out a specific past mistake as to state a rule, and a
  literal translation would keep the sentence while losing the reason. That work
  is a rewrite, and it should be done as one.
- **A read-only mode Claude may reach for.** Today the whole skill is closed
  because one of its three modes writes. Splitting the read path into a second
  skill with `disallowed-tools: Write Edit` would let Claude answer "where was I"
  without being asked — the same trade `trim-kit` makes between `status` and
  `apply`. It costs the always-on measurement above, which is why it is a
  decision rather than a cleanup.
- **A schema a stranger can validate against.** `schemaVersion: 1` is stable and
  documented, but nothing publishes it outside this repo. Anything that wants to
  read boards has to vendor a copy, which is the exact problem this plugin was
  extracted to end.
