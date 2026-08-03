# The quota block — why it reads backwards from a familiar progress bar

*🇬🇧 English · 🇻🇳 [Tiếng Việt](QUOTA.md)*

The design decisions behind [`public/lib/quota.js`](../public/lib/quota.js) and the
quota cards on the Token screen. For the shared file map see
[ARCHITECTURE.en.md](ARCHITECTURE.en.md).

The quota bar does NOT read the familiar "full = danger" way. The subscription is
already paid for, and quota resets per window and **does not roll over** — whatever's
unused at reset is gone for good. So "57% left" isn't good news, and "90% spent" isn't
a warning. Which is why this screen inverts the usual way of drawing it:

- The headline number is **spent**, never remaining. What's unused only ever appears
  under its actual name — *waste* — and only in the forecast column, where it's genuinely
  a possible outcome.
- Color measures **exactly one quantity: waste** (`100 − forecast`), and measures it in
  **both directions** — a negative value means this pace is asking for more than the
  window has:

  | waste | color | meaning |
  |---|---|---|
  | ≥ 50% | red | over half the quota will be lost for good |
  | 10 – 50% | yellow | a meaningful chunk won't get used in time |
  | −10% … 10% | green | landing right around 100% — the target |
  | < −10% | magenta | maxed out, current pace demands more than the cap |
  | — | gray | pace not yet readable |

  The green band is 20 points wide on each side because the forecast is a straight line
  drawn from the start of the window, while the real pace is jagged: demanding it land
  on exactly 100.0 would fail every window over a gap the measurement itself can't
  resolve.

- **Running out before reset is never red.** Running out early has its own cost — sitting
  idle until reset — but that cost is paid in *time*, while the color channel is spent
  entirely on *money*. Mixing the two into one channel means the same red simultaneously
  means "losing money" and "losing the afternoon," and neither meaning comes through
  anymore. So idle time gets spelled out in **words** instead, via `idleMsOf`, with a
  threshold of `max(6% of window length, 20 minutes)` — the percentage dominates on long
  windows (6% of a week ≈ 10 hours, an entire workday blocked), the floor dominates on
  short ones.
- The sentence for a window that's about to be exceeded **opens with the run-out point**
  — that's the part that hits the target, and now the color agrees with it. The cost
  that follows reads as a concession clause: *"runs out in 3 days, then 19 hours idle
  until reset."*
- The forecast sentence **opens with the time horizon**, not with "at this pace":
  *"this week's forecast: 73% — 27% wasted."* The earlier version wrote "at this pace,
  only reaching 73%," and that sentence was missing exactly the thing that makes the
  number usable — 73% *by when*. The label next to it says "7 days," but that's the
  window's name, not a point in time, so the composition still fell on the reader. The
  horizon is derived from `windowMs` (`periodText`), so the same sentence works for all
  three sources: *this 5-hour session* · *this week* · *this month* (Cursor's cycle).

The bar splits into **three segments**: solid = spent · hatched `→52%` = how much further
this pace will spend · light tail = `48% wasted`. The tail is deliberately **never left
empty** — an empty groove reads as "room to spare," the exact opposite of what it's
signaling — and it carries **words**, not just a number, because "48%" sitting alone next
to a pale segment reads as that same opposite meaning. The vertical tick is the **average
pace mark**, where you'd be if spending were metronomic, with a caption `avg 52%`
anchored right under its foot.

The card's rule is **every number appears exactly once**. The earlier version broke this
in all four spots: `27%` big up top, then `27%` again in the solid segment; `→52%` in the
hatched segment, then "only reaching 52%" in the sentence below; `48%` at the tail, then
"48% wasted" in that same sentence. Each one had its own reason when it was added, but
added together, every value gets read twice in two different typefaces — the eye has to
go check whether those two are the same number, and the answer is always yes. So:

- **the solid segment drops its label** — its value is already the card's biggest number,
  8px away;
- **the closing sentence is dropped entirely for the waste case** — it was just restating
  the bar as prose. Text under the bar only shows up when the shape **can't say it all**:
  about to hit the cap (how long it'll stay capped has no segment that can draw it) or
  the pace can't be estimated yet. Landing right on target stays silent.

That rule has **exactly one exception, chosen deliberately**: `≈$248` — this window's own
dollar cost — appears both on the card and in the tooltip. It earns the duplication
because the two numbers answer two different questions: the percentage says *how much
quota is left*, the dollar figure says *how much this plan is actually extracting* — and
that second question is the only one comparable across windows of different lengths.
Hidden behind a hover, it becomes a number for someone auditing, not for someone glancing
once and deciding where the next session should run.

## Where `≈$` comes from, and why it can diverge from the percentage

Window start = `resets_at − length`, both already present in the quota response. The
transcript logs a timestamp for **every single call**, so slicing by time is exact —
`collectUsage` takes the list of windows from [`src/state.js`](../src/state.js) and sums
them within a loop that already runs over 28,000 rows, no extra read needed. A daily log
can't do this: it doesn't resolve within a day.

The dollar figure is **not** the same as the percentage in three ways, and the UI states
all three (in the collapsible `qlg.money` note):

| | |
|---|---|
| Not an invoice | API price table × tokens, while the account is billed by plan |
| Different coverage | the percentage is for the **whole account**, the dollar figure reads from **this machine's** transcripts only |
| `≥` instead of `≈` | the window opened before the earliest call still on disk → the transcript's been pruned, the total undercounts |

The weekly per-model window matches by **name**: the endpoint sends
`scope.model.display_name` = `Fable` with `id` set to `null`, so `modelInScope` matches
word-for-word against the real id (`claude-fable-5`). A display-name change breaks this
silently — when it breaks, that window shows `$0`, i.e. it goes quiet instead of showing
a wrong number.

## Time to reset — three places, three placements

The question "how much time is left to spend this down" has to be answerable **without
hovering**, so the reset mark is spelled out as text in all three blocks. Placement
follows whatever real clock reading already exists in that block:

- **Claude card** — top-right of the card's header line, one mark per window.
- **Cursor** — **one line for the whole block**, right under the block's header: all
  three usage groups share one monthly cycle and reset at the same time, so printing it
  three times would say the same sentence three times.
- **Antigravity** — on **each line**, at the start of the sub-line: four pools × windows
  have four genuinely different reset marks.
- **Butler strip** — its own line under the bar, above the forecast sentence.

All of them are monospace, muted, and **never carry the waste color scale** — this is a
time measurement, and the color channel is spent entirely on money — same reasoning as
`idleMsOf`.

Whether a segment has room for its text is decided by a **container query**, not a
percentage threshold in JS: the real constraint is pixels, and the same "20% of width"
comes out to 40px on a narrow card and 90px on a wide screen. The tail carries two
versions — `48% wasted` and `48%` — CSS picks whichever fits; they're two separate
strings, not one string truncated, because Vietnamese puts the word before the number
while English puts it after. Whichever label lands on top of the average-pace tick
**dodges to the wider half** of the segment (`dodge()` in `lib/quota.js`) — the tick
itself can't be hidden, because the moment it overlaps a label is exactly the moment
it's saying the most important thing on the card.

The butler strip is 214px wide, narrow enough that it always uses the label-less bar
variant — labels would overlap there — and both spots' tooltips expand the bar into a
label↔value table, in the same order as the segments, plus the two things the bar can't
draw: the `%/hour` pace and the absolute reset timestamp.

The "how to read this bar" caption is **collapsed by default** — it's a one-time lesson,
not something that should stay open and force six lines of text to scroll past before
every visit reaches the numbers that actually matter.
