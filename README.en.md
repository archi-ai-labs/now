# NOW dashboard — command center

*🇬🇧 English · 🇻🇳 [Tiếng Việt](README.md)*

[![License: MIT](https://img.shields.io/badge/license-MIT-4f46e5)](LICENSE)
[![Node](https://img.shields.io/badge/node-18.10%2B-4f46e5)](package.json)
[![Dependencies](https://img.shields.io/badge/dependencies-zero-4f46e5)](package.json)
[![Docs](https://img.shields.io/badge/docs-VI%20%7C%20EN-4f46e5)](docs/README.en.md)

![NOW dashboard](docs/assets/banner.en.svg)

One page that answers: **where every one of my projects stands, and out of two dozen open
Claude sessions, which one is holding which piece of work.**

`/now` gives you one project. `/now all` gives you a static table. This gives you the
**live** big picture, updating itself as boards or sessions change.

## Getting started

Install once, and it comes up with the machine:

```bash
cp launchd/dev.hoanluu.now-dash.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.hoanluu.now-dash.plist
```

Edit the paths in the plist if the repo does not live at `~/Projects/local/now_dashboard`.
After that, all you need is:

```bash
./bin/now-dash
```

→ http://localhost:4400 · opens a tab, and asks launchd to start the server if it is down.

| Task | Command |
|---|---|
| Stop | `launchctl bootout gui/$(id -u)/dev.hoanluu.now-dash` |
| Restart | `launchctl kickstart -k gui/$(id -u)/dev.hoanluu.now-dash` |
| Read the log | `tail -f ~/.now-dashboard/service.err.log` |

The server hangs off **launchd**, not off the terminal or the Claude session that started
it — closing any window will not kill it, and logging back in brings it up. (The previous
version `nohup`-ed it from the calling terminal, so it died with the Claude session that
ran the command — which actually happened on 27 July.)

No `npm install` needed. Zero dependencies — just Node ≥ 18.10 (the version actually
tested; `engines` used to claim ≥ 20 and nobody had checked).

```bash
npm test
```

Runs on the built-in `node:test`, no extra packages pulled in — see [test/](test/).

### Running as its own Dock app

Open `http://localhost:4400` in **Safari** → menu **File → Add to Dock…** → **Add**.

You get a dedicated WebKit app: its own Dock icon, ⌘Tab-able, no address bar, no tabs,
and **no need to open Safari**. Safari is chosen on purpose over Chrome's "Install as
app" — the same page in Chrome drags along a browser process plus a GPU process, far
pricier for something meant to stay open all day.

Three things make it read as an app instead of a web page in a frame, all living in
the `<head>` of [`public/index.html`](public/index.html):

| | |
|---|---|
| [`public/manifest.webmanifest`](public/manifest.webmanifest) | `short_name` = the label under the Dock icon. Missing it, macOS falls back to `<title>` and the label becomes "NOW — sở chỉ huy" |
| `icon-1024.png` · `icon-180.png` | the Dock icon. Source is [`design/icon.svg`](design/icon.svg), rebuilt with `node design/icon.mjs` |
| `<meta name="theme-color">` | the window title-bar color. `applyTheme()` updates it on the `t` key press — hard-coding it means half the time there's a bright strip sitting on top of the dark HUD |

The server has to actually be running, otherwise the app opens to a "cannot reach the
server" screen — the LaunchAgent under [Getting started](#getting-started) handles exactly
that, including after a reboot.

## Seven screens

| Key | Screen | Answers |
|---|---|---|
| `1` | ▦ **Projects** | What's each project doing, what's the next action, can the board still be trusted |
| `2` | ◍ **Sessions** | 20 sessions in the same repo — which one holds which thread, what command resumes it |
| `3` | ◆ **Decisions** | Cross-project, which one first (sorted by urgency) |
| `4` | ✓ **Done** | What actually got finished the last few days |
| `5` | ◔ **Stats** | Where the effort went, where the backlog is piling up, how many hours worked |
| `6` | ◈ **Token** | Three paid monthly tools: what's about to hit a wall, where tokens go, where money goes |
| `7` | ⌬ **Health** | Where the dashboard is currently lying to you |

Per-tab details (Cursor/Antigravity), keybindings, and day-to-day usage →
[docs/DESIGN.en.md](docs/DESIGN.en.md).

## Docs

| Question | See |
|---|---|
| Why the design/charts look the way they do | [docs/DESIGN.en.md](docs/DESIGN.en.md) |
| Architecture, data sources, file map, pitfalls | [docs/ARCHITECTURE.en.md](docs/ARCHITECTURE.en.md) |
| How the quota block is computed/drawn | [docs/QUOTA.en.md](docs/QUOTA.en.md) |
| Changing the UI through Claude Design | [design/README.en.md](design/README.en.md) |
| What's in progress / decisions pending | [NOW.md](NOW.md) *(Vietnamese only)* |
| Open technical work (backlog) | [BACKLOG.md](BACKLOG.md) *(Vietnamese only)* |

Configuring the port/scan roots (`NOW_PORT`, `NOW_ROOTS`) and health thresholds →
[docs/ARCHITECTURE.en.md#configuring](docs/ARCHITECTURE.en.md).
