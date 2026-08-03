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

### In the menu bar

The web app above only knows how to **open** `localhost:4400` — it cannot **start** the
server, and you have to open it to see anything. The one below sits in the menu bar all
day; a glance is enough.

```bash
./bin/install-app
```

→ `~/Applications/NOW Dashboard.app`. Run it and you get **one item** in the menu bar,
stacked two lines inside 63pt of width:

```
CLAUDE
6%·37%
```

| Channel | What it carries |
|---|---|
| bottom line | **spent** in the 5-hour · 7-day window (rule 1 — the lead number is never what's left). A window past its reset mark reads `—`, not the closed cycle's final tally |
| tooltip | which window is binding, and how much projected waste |
| popover | two things worth doing (named, clickable), three quota windows on the color scale, and a Cursor/Antigravity line whenever they have something to say |

The popover follows the butler's two fixed slots — work first, quota second — because
those two do not compare. It does **not restate the bar in prose**: where the bar has
labels, the sentence under it may only say what the labels cannot draw (`cardText`, not
`forecastText` — the rule lives in `lib/quota.js`). The previous version broke exactly
that and spent a quarter of its height on three sentences reprinting the numbers from
the bar directly above them; a window that had just rolled over said the same sentence
three times.

Stacked because the menu bar charges by **width**; two lines reuse height that was
already spent. Sessions awake and hot decisions live in the popover, not on the bar — an
earlier version gave them a second item, but two items opening the same popover are just
two identical buttons taking two slots.

The waste band **stays off the bar**: four-band marks and then a tinted label were both
tried and both dropped — one colored label in a row of gray ones reads as a rendering
bug, not as a warning. It lives in the tooltip and the popover.

The bar text is a **hand-drawn image**, not an `attributedTitle`. With `attributedTitle`
NSStatusBarButton shoves the block against the top edge — measured on a snapshot of the
button itself: 1px of space above, 6px below. Neither `baselineOffset` nor
`paragraphSpacingBefore` moves it (lines are pinned by `min/maxLineHeight`, and AppKit
ignores the spacing on the first paragraph). Drawing the image puts the coordinates back
in our hands: currently 3px above, 3px below.

To re-tune by eye without rebuilding, the app snapshots its own button to PNG:

```bash
NOW_LABEL_Y=13 NOW_SNAP=/tmp/btn.png "$HOME/Applications/NOW Dashboard.app/Contents/MacOS/now-dash-menu"
```

`NOW_LABEL_SIZE` · `NOW_VALUE_SIZE` · `NOW_LABEL_Y` · `NOW_VALUE_Y` · `NOW_BTN_H` —
defaults at the top of [`app/NowMenuBar.swift`](app/NowMenuBar.swift). This mode exists
because the menu bar **cannot be captured from a terminal** (no Screen Recording
permission), which makes tuning here blind work.

Same for the popover — `NOW_PROBE=1` opens it, measures it, prints the real size, quits:

```bash
NOW_PROBE=1 "$HOME/Applications/NOW Dashboard.app/Contents/MacOS/now-dash-menu"
```

→ `popover: 360×477pt · trang: 477pt · vừa khít`. Two different numbers mean it is being
clipped. This mode came out of a bug that had been live since day one: the app asked for
the height in `didFinish`, but at that point `menubar.js` is still `await`-ing its fetch,
so `.mb-wrap` does not exist yet — the query fell through to the `?? 320` default and the
popover was **exactly 320pt tall no matter what was inside it**. Everything below that
mark was cut off, including the button row at the bottom — so "is there no button to jump
to the app?" was a fair question: that row had never once appeared. The page now pushes
the number to the app over `webkit.messageHandlers.size`, and pushes again through a
`ResizeObserver` whenever the content changes.

Click → a popover with two tabs: **Work** (things worth doing + Claude's quota) and
**Tokens** (all three tools, one block each). The open tab is remembered — WKWebView's
separate store works in our favour here. Right-click → open the dashboard, restart the
server, toggle open-at-login. Clicking the icon in Spotlight/Finder while it runs opens
the full dashboard.

The way out to the dashboard is the **`◈ NOW`** button in the top-left corner, not a
button row at the bottom: the old row spent 48px saying something the name already says.
It carries its fill and border up front rather than waiting for a hover — this window
opens and closes in seconds, and a button that only appears on hover is a button that
does not exist. The mark-and-name pair is lifted straight from `.brand-mark` in the
dashboard's rail: same door, same face. Its target follows the open tab — on the Tokens
tab it opens the Tokens screen directly, and the tooltip names the destination because
the "NOW" label does not announce where it goes.

Cursor and Antigravity still leave a **prose line** on the Work tab when they have
something to say: a warning you can only read after switching tabs is a warning that is
not on the page.

### The pixel butler

The character's head at the top of the popover **is the `◈` mark** — a diamond, and where
the app icon puts a smaller diamond inside it, this one has two eyes. It is not a mascot
bolted on for fun. **Solid**, not a hollow outline: at 64px the hollow leaves only 4–6
cells of interior, not enough for eyes worth having, and the sky showing through dissolves
the head into the frame.

The condition for letting it take ~93px of a window we have been squeezing: **it carries
information**. High waste bands (`crit`, `warn`) → eyes shut, a floating "z". Pace on
target or better (`ok`, `cheer`, `over`) → eyes open, with a catchlight. When the money
sits idle, the butler dozes — rule 1, taken literally. Open eyes are two cells tall, shut
eyes a one-cell dash: shape is the second channel next to hue, because a daltonized theme
must never rely on colour alone.

Not to your taste? `hero: false` in `DEFAULTS` drops the popover from 598 to 505pt.

#### One light source for the whole popover

The sun sits **upper-left** inside the frame, and everything else faces it: the warm wash
on the popover background, the butler's lit edges, the highlight on every quota bar, the
hard shadow offset down-right. Two light sources and each component invents its own
direction — the page then looks assembled rather than designed.

That direction **does not change across the four times of day** — arcing the sun would
mean redoing all of `shadeOf`, and a character whose shadow flips direction four times a
day is a character the viewer has to re-recognise four times a day.

#### Four times of day, from the machine clock

`phaseOf(hour)` in `lib/menubar-view.js`: `dawn` 5–9 · `day` 9–16 · `dusk` 16–19 · `night`
19–5. At night the sun becomes a **crescent moon** (crescent, not a disc: at 28px a disc
looks exactly like the sun, and the one thing that must register instantly is "it's
night"). Stars fade by phase rather than switching off — a starfield vanishing at 9am
reads as a broken page.

The popover opens and closes in seconds, so there is no repaint timer: each open is one
clock read. The tuning bench has a phase override so you can see all four without waiting.

The line that matters: a phase only changes `--lux` / `--lux-hi` / `--sky-*` / `--halo` —
tokens belonging to the sky panel and the background wash. **`--sun-hi`, the light the
quota bars use, is fixed across all four.** The sky is a picture and may change; a bar is
data, and a segment that shifts hue by the hour is a segment the reader has to ask "was it
that colour this morning?"

Body shading is **derived from the sprite itself** (`shadeOf` in `lib/menubar-view.js`):
no diagonal neighbour on the sun side → lit edge; none on the opposite side → shadow edge.
Edit one line of the sprite and the shading follows; a hand-drawn shadow map is already
wrong by the second edit.

Three tokens to keep straight when touching the palette:

| Token | What it is | Constraint |
|---|---|---|
| `--skin` | the butler's violet | **fixed**, never varies by band — a character that changes outfit with the data is a different character every time you open the popover |
| `--sun` | coral orange | must not be amber: amber is `--warn`, and this light falls across the whole page |
| `--sun-hi` | the brightest light | used for the highlight on quota bars — mixed *with* `--c`, never replacing it |

#### The popover's quota bars differ from the web in three ways

Same `quotaBar`, three options — no second implementation:

| | Web | Popover | Why |
|---|---|---|---|
| even-pace tick | yes | `pace: false` | for the tick to mean anything it has to drag the "even pace 55%" caption along — 15px per window for a reference mark, while the things it compares already carry labels inside the bar. Dropping it: popover 600 → 573pt |
| projection hatching | static | marches right, one stripe period per 1.7s | this segment is the only thing on the bar that **hasn't happened yet**, and everything else in the popover is still — motion is the channel that says "in flight, not settled". Disabled under `prefers-reduced-motion` |
| projection label | centred in the hatch | `est` — four placements, on the tuning bench | only `mid`/`end` keep the rule "the number sits in the segment it describes"; `below` costs the 15px back, `tail` has to take the waste label's space |

Three things deliberately **not** borrowed from similar apps:

| Theirs | Here | Why |
|---|---|---|
| a 30-day strip in green/yellow/red by token volume | **no strip at all** | built, then cut on 31 Jul: our version was 12 five-hour windows in one muted hue — colour already means **waste** here, and a heavy-spend day is a *good* day. But even with the meaning fixed, the strip billed 34px against **every** popover open to answer a question asked once a week — one the **Lookback** screen already answers with a real chart, axis and per-window tooltips included |
| gradient running along the bar's length | **we do this**, but anchored to the solid fill, never to the track | the old objection still holds — a ramp along the length invites reading that axis as a second scale. Anchored to the fill, a 6% fill and a 94% fill both run the full pale→deep across their own width, so the ramp draws the same shape at every value: carrying no information, it cannot argue with the number. Anchored to the track (`background-attachment`) it does the opposite — **don't** |
| glowing eyes | **dark** eyes on the bright violet face, with a small catchlight upper-left | two lit cells two cells apart bleed into each other and the whole face reads as a diving mask |

The gradient is scoped to `.mb-wrap`, so the 15 bars on the web Token screen stay flat.

### The popover tuning bench

**Last screen on the rail — key `9`.** Also opens standalone, with nothing else in sight:

```
http://localhost:4400/menubar-demo.html
```

Two ways in, **one implementation** ([`public/views/bench.js`](public/views/bench.js)) — no
second copy to drift. It moved into the nav because until 3 Aug it only had that URL and
**nothing on the dashboard linked to it**: a tool you have to remember a URL to reach is a
tool you won't find next time you need it.

The popover on the left is drawn by **the very `popoverView` the app calls**, not a rebuild
of it — same reason as `NOW_SNAP`: an approximate copy built for looking at is a copy that
will drift from the one that ships.

The switches come in **two kinds that land in two different files** — the page prints both
blocks ready to paste:

| Kind | Switches | Paste into |
|---|---|---|
| **Layout** | tab · bar thickness · label inline · scene · projection label · width | `DEFAULTS` at the top of [`public/lib/menubar-view.js`](public/lib/menubar-view.js) |
| **Light** | background wash (size, strength) · bar gloss (strength, cut) | the `.mb-wrap` block in [`public/styles.css`](public/styles.css) |

The second kind exists because light is tuned by **eye**, not by argument: whether a wash
sits at 20% or 30% cannot be reasoned out, only looked at — and until now every look cost
an edit to `styles.css` and a reload. The bench emits a `<style>` block aimed straight at
`.mbd-stage .mb-wrap`, so what you see and what it prints can never disagree — and it
survives the dashboard's 30-second re-render, which anything written to the DOM *after* a
render does not.

**Phase** and **light/dark** belong to neither kind: the real popover takes its phase from
the machine clock and its background from the macOS appearance, with no switch at all;
these two are the bench's magnifying glass, nothing more. The background flips via
`.theme-light` / `.theme-dark` on the **stage**, not on the `html` element — flipping the
background to compare a palette is no reason for the switch panel you're reading to jump.

Below the stage is a measurement line, including this screen's height ceiling. The stage
**sticks while you scroll** — the switch panel is taller than the screen, and scrolling
down to the switch you want only to lose sight of what it changes makes the bench useless.
Switches whose labels are **levels** ("wide", "strong", "1.4") lay out as one horizontal
row rather than a stack — eleven stacked switches put the knob and the thing it changes on
different screens.

Settling the layout needs no app rebuild, not even for the width: the page declares both
dimensions to Swift.

| | |
|---|---|
| [`app/NowMenuBar.swift`](app/NowMenuBar.swift) | ~290 lines, and it **knows no quota rule**: the text comes from `/api/badge`, the popover is the web page below |
| [`public/menubar.html`](public/menubar.html) · [`menubar.js`](public/menubar.js) | the popover's guts. Calls `lib/quota.js` directly — same `quotaBar`, same sentences as the Token screen, so it cannot contradict the dashboard |
| `/api/badge` in [`server.js`](server.js) | settles text and color band in one place. The server imports `public/lib/quota.js` (a browser module) on purpose: the waste scale gets exactly one copy |
| [`app/make-tones.py`](app/make-tones.py) | lifts the five color codes out of `styles.css` at build time into `Tones.swift`. **Currently unused** — the bar text is an `isTemplate` image, which keeps alpha but not color. Still built alongside the app so turning color back on costs one line |
| [`bin/install-app`](bin/install-app) | generates `Tones.swift`, compiles with `swiftc`, cuts the `.icns` from `public/icon-1024.png`. Re-runnable; refuses to overwrite if something else is sitting there |

Needs Xcode Command Line Tools (`swiftc`) and macOS 13+. The repo path is baked into the
bundle as an absolute path at build time — same reason as the launchd plist. **Move the
repo, re-run `./bin/install-app`.**

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
