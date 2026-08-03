# Design philosophy — NOW dashboard

*🇬🇧 English · 🇻🇳 [Tiếng Việt](DESIGN.vi.md)*

Why the dashboard looks and reads the way it does. File map + data sources are in
[ARCHITECTURE.md](ARCHITECTURE.md); the quota block gets its own doc,
[QUOTA.md](QUOTA.md).

## Design language

**The butler is the primary block.** Biggest, brightest, top of page: it says **two**
sentences and hands you the button to act on each one right there. The whole dashboard
reads in 30 seconds, but this block reads in 3 — glance and go, and this is what you
carry with you.

Two **fixed** slots, one per kind of concern
([`public/lib/butler.js`](../public/lib/butler.js)):

1. **Worth doing** — at most **three** items, **auto-advancing every 8 seconds**. The
   order is *what's actually blocking your hands*, not a data-type order: a hot decision
   (`now`) → an expired board → a worktree about to be lost → a decision about to become
   urgent (`soon`) → waiting on someone else → and if there's nothing else, just the next
   action.

   **No category is a binary gate anymore**, and that was the most recent correction:
   the previous version only accepted `heat === 'now'` and only accepted items pending
   over 7 days, so on this machine — 24 pending decisions with none marked `now`, two QA
   items sitting at exactly 6 days — the butler went completely silent about both
   categories, and the whole slot could only ever say one sentence. Now every item makes
   it onto the page; the threshold only changes *tone*: past 7 days it's allowed to say
   "this is nag-worthy," before that it just reports.

   Three is a **ceiling, not a quota**: once whatever's blocking you runs out, the slot
   says its piece and stops. Padding it out to three with next-actions and queue items
   would keep the slot full every single day, and a slot that's always full is a slot
   the eye learns to skip.

   Auto-advance **pauses on hover or focus into the block** (text shouldn't jump while
   you're mid-read), and pressing ‹ › **restarts the count from zero** rather than
   turning it off — a manual click earns the full eight seconds to read whatever it just
   flipped to. The progress rule next to "2/3" is the only thing that warns the text is
   about to change; without it, the jump reads as a glitch. It's also what signals the
   slot is paused — hovering makes the rule disappear.

   The cursor is measured by **actual position on every mousemove**, not by the
   `pointerenter`/`pointerleave` pair. Those two events have to fire as a matched pair to
   balance out, and `pointerleave` fails to fire in real cases (cursor leaving the window
   entirely, `mount()` replacing the DOM right under the cursor) — miss one and the slot
   sticks in paused state forever, and on screen that stuck state looks exactly like
   broken.

   **Slot one is a card with its own background, slot two is just text.** Both as plain
   text on a white background makes the taller one read as the more important one — and
   the quota slot is always roughly twice as tall, since it carries a three-sentence
   reason plus the Cursor/Antigravity lines. Racing font size doesn't fix it, it just
   makes both bigger; trimming slot two's text doesn't work either, since those
   outside-source sentences only speak once a week. So slot one wins along an axis slot
   two doesn't compete on: a background pulled from `--voice` itself, which shifts color
   with urgency and remains purely decorative — every real difference is already carried
   by text.

   All three slides have a copy button. The **waiting on someone else** category has no
   command in the `now` skill (unlike `chốt <mã>` and `/now update`), but "no command"
   isn't "nothing to hand over": the on-screen sentence gets truncated to fit the line, so
   the copy button outputs the **full version**, in the exact format `/now update` renders
   into NOW.md — `{who} — {what} · since {since}`.
2. **Token quota** — speaks every single time, even on a good day, and speaks more
   insistently the more it's being wasted. Full breakdown → [QUOTA.md](QUOTA.md).

There used to be only one place to say anything, so these two kinds of concern had to
compete for it. They're not comparable to begin with: a decision pending three days and
a window about to waste 82% don't sit on the same urgency scale, and forcing them onto
one meant the loser vanished from the page entirely — while it was still sitting there,
unresolved. "Waste" in particular has no moment that announces itself; it just quietly
happens at reset.

The on-screen text is always **the exact vocabulary you'll say back to Claude**: project,
session, decision, worktree, `chốt <mã>`, `/now update`, `resume`. The vocabulary tracks
the `now` skill precisely: 🎯 In progress · ▶ Do next · ⏭ Remaining · Awaiting your call ·
Waiting on someone else · Queue · Just finished.

Two themes, and **light is the default** (`app.js`) — the `t` key toggles.

### Where the score numbers come from

Every number has to be real — a fabricated XP bar reads as meaningless a week later and
drags the whole HUD's credibility down with it. This is exactly why XP, the `D→S` rank,
and the priority marks `!!` `!` `~` `✓` were **removed** in the decision `chốt d-game`
(2026-07-23; full reasoning is at the end of [design/README.md](../design/README.md),
under `d-game`): the old XP added three made-up weights on top of a number that was
already a floor, not a total (`recentlyDone` keeps only 5 entries per project), then
collapsed all of it into a single letter grade.

What's left is exactly the part that's **measured directly, with no conversion** —
[`public/lib/game.js`](../public/lib/game.js):

| Function | Returns |
|---|---|
| `streak()` | consecutive days with at least one thing finished (allowed to start from yesterday) |
| `score()` | `done7` (items finished in 7 days) · `streak` · `fresh` (count of fresh boards) |
| `projectState()` | project status as **text** ("Blocked" / "Needs update" / "OK"), not a rank or a mark |

No weighted formula, no rank thresholds — the three numbers above display as plain
numbers.

Project priority marks deliberately **don't** reuse the old player-rank letters S/A/B/C
— two scales sitting side by side with opposite meanings (your S is "doing great," a
project's S is "on fire") is a guaranteed misread.

## Seven screens — in detail

The quick 7-screen table is in [README.md](../README.md). Details on the Token
screen's three tabs:

The Cursor tab has three sections. **Over time** is built from
`GetFilteredUsageEvents` — 5,279 calls spanning 148 days, each with a timestamp,
computed cost, and a `kind` (so even error calls that weren't billed can be counted).
Pulling the whole thing takes ~10 seconds, so it runs **in the background** and lands in
`~/.now-dashboard/cursor-events.json`; every 15 minutes it re-pulls the last two full days
and overwrites — no accumulation, so nothing can get double-counted. **Current cycle** is
two older charts, totaled by Cursor itself. **Editor rhythm** is built from
`GetUserAnalytics` (80 days): lines *accepted into a file*, the Tab-suggestion acceptance
rate, and the kind of file being worked on — the one axis in this whole screen about
quality rather than volume.

⚠️ Cursor's dollar figure is **real money Cursor already billed**; Claude's is an
**estimate** the dashboard computes itself from the API price table. The two dollar
columns can't be added or subtracted against each other.

The Antigravity tab reads **individual model calls** from the `gen_metadata` table in
each conversation's SQLite (`src/collect/agturns.js`) — timestamp, model name, and
context are values written directly in the record. The *tokens written* column is
**inferred**: the record doesn't name the field, that number was picked for its
magnitude and because its ratio to context (82×) matches Claude Code's range — so it
only ever appears in the numeric table, never on a chart. There's no chart by **quota
pool**: the `used_claude` label in the record counts 200 non-Gemini calls while counting
by model name gives 161 — a 20% gap, so the meaning isn't settled yet.

The Token screen carries all three tools. **All three quota blocks sit at the top of the
screen, always visible** — Claude (5-hour / 7-day / weekly-per-model), Cursor (monthly
cycle), Antigravity (two pools × two windows) — because "which one runs out on me first"
is the one question on this screen that's genuinely urgent. Detail lives in **three
per-tool tabs** (`←` `→` moves between them): these three sources are measured in three
units that don't convert into each other, so at any moment the screen shows exactly one
unit. Cursor and Antigravity used to have their own screen (⬡ Tools); `#tools` now
auto-redirects to the Token screen.

"Always visible" has **exactly one exception: the tool was never installed on this
machine.** If Cursor never ran (no `…/Cursor/User/globalStorage/state.vscdb`) or
Antigravity never ran (no `~/.gemini/antigravity`), both its block and its tab disappear
— `hasCursor` / `hasAg` in [`public/views/usage.js`](../public/views/usage.js). This is
NOT the general handling for "couldn't read the number": closed, not logged in, dead
endpoint all keep the block and state which link in the chain broke, because all three
are things the user can go fix. Only "never installed" is the case with nothing to say
and one that never changes. These two cases used to share one reason string, so a
machine without Antigravity would read *"Antigravity is closed"* — telling someone to go
open an app that doesn't exist.

Other keys: `c` copies the butler's current suggestion · `o` opens the top project's
board · `/` search · `r` rescan · `←` `→` flip between projects while the detail panel
is open · `esc` closes it · `?` shows all shortcuts.

## Daily use

Three things decide whether opening this dashboard every morning is actually pleasant.

**Actions shouldn't require hunting.** The most common action is copying a sentence and
pasting it into Claude — so it has to sit right where you just read it: a button inside
the butler block (`c`), and a row of buttons that appears on hover over a project card
(copy the next-action sentence · open the folder · view the full board). The detail panel
reads the full text of `NOW.md` and flips between projects with `←` `→`, instead of
close-and-reopen for each one.

**The page must never jump on its own.** It redraws every 30 seconds; if scroll position
and any open sections got reset, whatever you were mid-read on loses its place. Both are
captured before redraw and restored right after — see `keepUI` in
[`public/app.js`](../public/app.js).

**Dead data has to look different from live data.** On disconnect, the old table just
sits there looking identical to a fresh one, so a disconnect shows as a warning band with
the snapshot's timestamp, not a 6px red dot. The last-updated time also leads the
sub-line in the top bar, ahead of every other number.

## Charts must not lie

The Stats screen is the hardest place to hold onto "every number has to be real," because
a short bar looks exactly like "did less that day" even when the truth is "that day fell
off the board's memory."

`recentlyDone` in `NOW.json` is capped to a handful of the most recent entries **per
project**. Any project that hits the cap drops older items, so plotting the raw numbers
makes it look like activity trails off the further back you look — a trend entirely
manufactured by the retention cap. `coverage()` in
[`public/views/stats.js`](../public/views/stats.js) measures exactly that: for each day,
count how many boards still have retained data reaching back that far. Any day that's
under-covered gets a dimmed bar, and the tooltip says outright "the real number is
higher." The other three charts (decisions, queue, session hours) are snapshots of the
current moment, fully counted — that's the part actually worth trusting.

Drawing conventions, held consistently across every chart:

- **One chart, one color**, unless color *carries meaning* (decision urgency — always
  paired with a legend that has both symbol and text, never color alone). Coloring each
  bar by its own value burns the color channel repeating exactly what the bar's length
  already said.
  **The donut is the sole exception**: an arc carries no text of its own, and the only
  bridge from it to a name is the legend's color swatch — there, color *is* the identity.
  The color scale rotates *hue* (200° evenly divided) rather than *lightness*: holding
  lightness constant keeps every slice at the same contrast against the background
  (measured 4.0–4.8:1 on light, 4.6–7.7:1 on dark), while still landing about 2.6× farther
  apart than the old lightness-based scale. The "rest" slice is always gray — it's a
  collapsed tail, not a category, so it doesn't get its own hue.
  Each slice has a transparent overlay cut with `clip-path` to catch the pointer (the
  ring itself is a single `conic-gradient`, no element corresponds to one slice).
  Hovering makes **every other slice go gray** — brightening the hovered slice is
  something you'd have to compare to notice, while graying out the whole ring except one
  slice reads instantly — and the matching legend line lights up too, in both directions.
  A slice's tooltip anchors to the **cursor**, not the element's bounding box: its box is
  the entire circle, so anchoring to the box would place the tooltip over whatever was
  just hovered.
- **Not every bar gets a number printed on it** — only the peak; everything else is left
  to the axis, tooltip, and the numeric table. A horizontal bar's value is printed at its
  *tip*, never inside the bar.
- **Tooltips are never the only way to read a value**: every chart ships with an
  expandable numeric table, every data point is Tab-reachable, and the whole bar area is
  the hit target, not just the painted portion.
- **A tooltip is a miniature table, not a sentence.** `data-tip` carries a
  `label \t value` format (see [`public/lib/tip.js`](../public/lib/tip.js)); `app.js`
  builds it into a two-column grid — label left, value right in aligned monospace,
  always in the same spot in every tooltip. A prose sentence reads sequentially, and two
  tooltips side by side can't be compared, since each number lands in a different
  position in the sentence. The old string format (no tab) still renders exactly as
  before, so conversion can happen one spot at a time. Content is built with
  `createElement` + `textContent`, **never** `innerHTML`: this is the one place a string
  from disk (project name, skill name) reaches the DOM without going through `html` —
  that helper auto-escapes, this path doesn't.
- Bars max out at 24px thick, 4px rounded at the data end and square at the base; grid
  lines are 1px hairlines, pushed well into the background; two adjoining segments are
  separated by a **2px background gap**, never a border — and the segment width is
  reduced by exactly that 2px so the bar still matches its number.

The **chart style** button changes the *shape*, never the numbers: same data, a bar chart
reads as a trend, a donut reads as a proportion, a treemap reads as who's taking up the
most space. Random mode only draws **from the valid list for that data shape** — a
day-by-day series never becomes a donut, a leaderboard never becomes a line
([`public/lib/skin.js`](../public/lib/skin.js)) — and only reseeds on button press, since
the page redraws itself every 30 seconds anyway. The button lives in the chart block's own
header, **not** in the top toolbar: the top toolbar is for things that change the whole
page (theme, language, rescan), this one only changes the shape of the charts right below
it.

The urgency color scale has been run through a colorblindness check (`now/soon/later`,
background `#0b0f15`): the worst adjacent pair scores ΔE 12.5 under deuteranopia,
above the 8 threshold. The four health colors only reach 7.2 — in the range that's only
valid with a secondary channel, so they're not used as chart colors here.

General density principle: **whatever repeats isn't information.** The decisions table
drops the urgency column because the whole block already sits under the heading "ABOUT
TO BLOCK · 6"; the sessions screen only prints status for sessions that are *currently
awake*, since asleep is already the default; seven repos with no board yet get collapsed
into a single chip cluster instead of seven lines all saying the same thing.
