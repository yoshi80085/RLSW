# FAME TRACK REDESIGN — ⭐ the race becomes a scoreboard

> **Design sketch, 2026-09-02. Alex's call:** *"We'd have to re-work the Fame
> track at the top of the HUD as well — since it's not a race to the finish
> anymore, it'll have to be redesigned to show by 'how much' the winner is
> winning."*
>
> ✅ **BUILT 2026-09-16.** `ui/FameRace.jsx` draws two scoreboards now — see
> §12 at the foot of this doc for what shipped, what was decided and by whom.
> The preview page stays: it is where the next change to this strip starts.
>
> ⚠️ **NOTHING HERE MAY BE BUILT STRAIGHT INTO THE CLIENT** — this is a HUD
> element, so it goes to a standalone interactive preview page in `.scratch/`
> first, Alex dials it in, and only the numbers he lands on get ported.
> `CLAUDE.md`, standing rule since 2026-08-26.
>
> Companion to `WIN_CONDITIONS_DESIGN.md` (§4.2 raises this; this doc answers it).

---

## 0. The one-line version

🏆 **Legend Run** has a finish line, so the track shows **progress toward it**.
🎸 **Battle of the Bands** has no finish line, so the same track has to show
**margin** — who is ahead and by how much — with the **round count** as the clock
that replaces the finish line.

---

## 1. ⚠️ `fameToWin` IS NOT A NUMBER IN THIS COMPONENT, IT IS THE COORDINATE SYSTEM

This is the finding that sizes the job. `ui/FameRace.jsx` is 139 lines and
`fameToWin` is load-bearing in **seven** distinct places:

| # | Role | Line |
|---|---|---|
| 1 | `at(fp)` — the position mapping. **The scale itself.** | 50 |
| 2 | The threshold filter, `t < fameToWin` | 76 |
| 3 | The **finish line** element pinned to the right edge | 83 |
| 4 | `dir` — which way tied blips fan, keyed on `fp / fameToWin < 0.5` | 100 |
| 5 | The per-blip tooltip, `⭐{fp}/{fameToWin}` | 105 |
| 6 | The **⭐N label** at the right-hand end | 133 |
| 7 | The container tooltip, *"first to N FP is crowned a Legend"* | 59 |

🎯 **So "just swap the target for something else" is not a small change** — it is
a new coordinate system, a deleted finish line, a re-derived tie-fan rule and two
rewritten pieces of copy. That is why this is a redesign and not a prop change.

---

## 2. ⚠️⚠️ THE TRAP THAT DECIDES THE WHOLE DESIGN — false motion

The obvious answer is *"pin the leader to the right-hand end and place everyone
else by their deficit."* It shows margin perfectly and it has a serious cost:

> **When the leader scores, every other blip slides LEFT — even though nobody
> else lost anything.**

📌 **This is the same class of failure the component's own header already calls
out.** The tie-fan note says that without it *"the first thing the scoreboard
ever tells you is a lie"*. A rescaling track tells that lie continuously: motion
on this strip currently means *somebody scored*, and a leader-anchored scale
makes it mean *somebody scored, or somebody else did*. The player cannot tell
which from the thing that is moving.

⚠️ **Any candidate scale must be judged on this first**, before it is judged on
how well it shows the gap.

---

## 3. Three candidate scales — build all three as a toggle, decide by looking

⚠️ **Do not pick one here.** `CLAUDE.md`: *"Every taste call is a lever."* The
scale is the biggest taste call in the component, so it is a button row on the
preview page and Alex chooses by looking at all three against the same states.

### 🅰️ Leader-anchored — right end = the current leader

- ✅ The gap is the whole picture, at maximum resolution, always.
- ⛔ **False motion (§2) at its worst** — the scale changes on every leader score.
- 📌 Softenable by **quantising** the right end (round up to the next multiple of
  N) so the track breathes in steps rather than continuously. That is a lever.

### 🅱️ Fixed scale — right end set once at match start

- ✅ **No false motion at all.** A blip moves if and only if that Spirit scored.
  Every good property of today's track survives untouched.
- ⛔ Needs a sensible guess at "a strong final score", and **that number is
  unknown until the FP inflation lands** (`WIN_CONDITIONS_DESIGN.md` §5).
- 📌 So it is a slider on the preview page, and the shipped default is set from
  whatever a played Battle of the Bands actually produces — not guessed now.
- ❓ Needs an over-run treatment for a Spirit who beats the estimate. **A blip
  pinned at the end with an "off the chart" flourish is dramatically good**, so
  this is an opportunity rather than a defect.

### 🅲 Pace line — right end = rounds elapsed × par pace

- ✅ **Rescales only with the CLOCK, never with an opponent's action.** Sidesteps
  §2 entirely while still being relative.
- ✅ Reads as *ahead of pace / behind pace*, which is a genuinely different and
  quite musical thing to know.
- ⛔ The most novel, and the one that needs the most explaining to a new player.
- ❓ Wants a visible **par marker** on the rail, or the idea is invisible.

---

## 4. ⛔ What must NOT be redesigned away

The current component earned each of these and the reasoning is in its header.
Any candidate that breaks one is wrong even if it looks better.

- **Distance on screen IS distance in points.** The scale may change; linearity
  may not. This is the property that made one shared track beat four stacked bars.
- **One row.** *"The strip has room for one row, not four."* ⚠️ Do not solve any
  problem in this doc by adding a second row.
- **The tie fan is load-bearing, not polish.** Every match starts with everyone
  on 0 — total collision is the DEFAULT state, not an edge case. ⚠️ And its
  direction rule is keyed to `fp / fameToWin`, so **rule 4 in §1 has to be
  re-derived for every candidate scale in §3**, not carried over.
- **The acting ring.** It absorbed the old "▶ `<name>`" badge; whose turn it is
  is now read off the ringed, breathing blip and nothing else says it.
- **The stage-FX threshold notches**, which exist so the two readouts of the same
  milestones cannot drift apart. ❓ `WIN_CONDITIONS_DESIGN.md` §6 item 6 already asks
  whether absolute-Fame thresholds mean anything in a score game — settle that
  there, not here.

---

## 5. 🎯 The margin readout — what Alex actually asked for

**And there is a free slot for it.** The right-hand `⭐{fameToWin}` label (§1
role 6) exists only to name the finish line. In Battle of the Bands there is no
finish line, so **that slot is vacant and it is exactly where "by how much"
belongs.** Candidates, all cheap, all levers:

- **`+7`** — the leader's margin over second place. Smallest, most direct answer
  to the question asked.
- **`⭐31`** — the leader's raw score. Says the size of the game rather than the
  gap.
- **`⭐31 +7`** — both, if the slot is wide enough at the strip's narrowest (§7).
- A **shaded span on the rail** between first and second place, so the gap is a
  shape as well as a number — most in keeping with "the gap is the SHAPE of the
  thing", and it costs no horizontal room at all.

📌 The `👑` crown already marks the leader; a margin label is the natural
companion to it and may want to live next to the crown rather than at the end.
That is a preview-page question.

---

## 6. ⏳ The clock — ⚠️ AND A COLLISION ALREADY SITTING IN THIS STRIP

In Battle of the Bands the rounds remaining *is* the drama, and it has to be
visible. **But the strip already contains a chip that looks exactly like the
obvious solution:**

```
🔥💿 DISCO INFERNO — {flamingHexes.roundsLeft} round{s} left
```

⚠️ **A second "N rounds left" chip in the same row, in the same pill shape, would
read as the same KIND of thing** — a temporary board effect — when it is in fact
the match clock. That is a rank error, and this strip has been through one
before: six preference toggles were removed from it on 2026-08-31 precisely
because they were *"drawn at the same weight as the live readouts beside them"*.

Two ways out, both for the preview page:

1. **Put the clock inside the track** — a fill or a tick-march along the rail, or
   the round count in the right-hand label. The track then carries both axes:
   position = score, fill = time. ✅ Costs no strip width, which §7 says is the
   scarce resource.
2. **Give it clearly different rank** — larger, differently shaped, and pinned to
   one end of the strip rather than floating in the chip flow.

---

## 7. 📐 The real container — and the track's width is NOT fixed

`CLAUDE.md`: *"Show it in the real container."* For this component that is a
harder requirement than usual, because **the width varies with how much else is
lit**.

The header strip is `display:flex, alignItems:center, gap:10, borderBottom`.
`FameRace` sits in it as **`flex:1, minWidth:190`**, `height: 13px`, blips 9px —
and it shares the row with, all of which can be lit at once:

- the ☰ TopMenu
- `🔥💿 DISCO INFERNO — N rounds left`
- `🧪 SLIME ROAD — N/N hexes`
- a marquee chip, a purple chip and a lime chip
- `🎤 ×N.NN ♥N 👥N` — the crowd blip
- a stencil-font chip at the end

🎯 **So the preview page must show the track at its NARROWEST (every sibling chip
lit) and at its WIDEST (none), not at one comfortable width.** A margin label
that fits with an empty strip and pushes the rail under `minWidth:190` during a
Disco Inferno is not finished.

📌 And note the crowd blip is right there in the same row — which is a nice
argument for the margin readout being visually distinct from `×2.42 ♥2 👥3`, or
the two will be read as one cluster of numbers.

---

## 8. The states the preview page must show

*"Show the states, not one happy example."*

1. **0–0 at match start** — every Spirit collided. The default state.
2. **2P, 3P and 4P** — the fan has to hold at all three.
3. **A runaway leader** — the state that motivates the whole redesign.
4. **A dead heat** at a high score.
5. **A Spirit past the fixed scale** (candidate 🅱️'s over-run).
6. **The acting ring** on the leader, and on a trailing Spirit.
7. **Threshold notches**, some passed and some not.
8. **First round and final round**, for whatever the clock becomes.
9. **A knocked-out Spirit** — ⚠️ possible in Legend Run, and *impossible* in
   Battle of the Bands with elimination off, so the dimmed-blip treatment is
   mode-specific.
10. **Legend Run near the target, `contested: true`** — the red rail and the
    `🤘 FINALE` label still have to work, because that mode is not going away.

---

## 9. The levers the page needs

- scale mode: 🅰️ leader / 🅱️ fixed / 🅲 pace
- the fixed scale's value, and the leader-anchored quantisation step
- par pace (for 🅲), and whether the par marker is drawn
- margin readout: off / `+N` / `⭐N` / both / shaded span
- clock: off / rail fill / tick march / label / separate chip
- blip size, fan spacing, rail height, glow
- strip width — a slider from `minWidth:190` to full, per §7
- **old look beside new look**, both modes, always on screen

---

## 9.5 🎨 The colour — asked, tested, and now a file (2026-09-03)

**Question, from Alex:** could the strip be built out closer to the board's own
colours — purple / magenta / blues?

**Answered by looking, not by arguing.** The preview page grew a **rail palette**
switch — `gold` / `board violet` / `board magenta` / `stage cyan`, furniture only —
and all four were rendered across §8's states. The board hues are **sampled**, not
invented: `src/board.png` reduces to a near-black `#131612` ground with `#371336` /
`#4d1d4c` deep violet and `#a148a0` / `#dfabde` neon.

⚠️ **The preview was lying about the fourth Spirit** and it mattered. Its
`SPIRITS` table carried a placeholder `#ff55aa` pink for the fourth seat, a colour
no Spirit has. That made a magenta rail look like a collision it is not, and hid
that the real fourth (Glamarchy, `#ff6600`) sits beside a WARM rail. Fixed in the
same pass — the preview now carries the four real colours off `data/spirits.js`.

**Alex's call: gold stays.** Fame is the score, the score is a crown, a crown is
gold — nobody has to be told what the gold thing on the strip is. The alternatives
were legible but had to earn a meaning gold already has.

⚠️ **The known collision, kept on purpose.** `#ffd700` sits one hue-step from
Metalness Monster's `#ffcc00`, so on the HUD bar the gold fill and one player are
nearly the same colour. **There is no free hue with four Spirits on the board** —
violet collides with Intergalactic 0's `#aa55ff`, cyan with Shredding Ronin's
`#4488ff`. This is a chosen collision, not an oversight.

📌 **And gold became a file.** `data/fameTheme.js` now owns it: `FAME`,
`FAME_CONTESTED` (the same role keys under threat), `FAME_NEUTRAL` and
`fameFill()`. The header track and the HUD bar read the same table, so the two
readouts of the same score cannot drift into two different golds — the same
failure mode §4's threshold notches exist to prevent. The extraction was proved a
**pixel no-op**: `.scratch/_famethemessr.jsx` SSRs `FameRace` at HEAD against the
migrated one over six states and diffs the markup byte for byte, then asserts all
29 deleted literals against the token expressions that replaced them.

⚠️ **If the colour question ever reopens**, the palette switch is still in the
preview page and `data/fameTheme.js` is the one file that has to change.

---

## 10. Where the code is

| Thing | File |
|---|---|
| The component | `ui/FameRace.jsx` (139 lines) |
| ⭐ The gold — every Fame colour | `data/fameTheme.js` (§9.5) |
| The colour experiment, still switchable | `.scratch/fame-track-preview.html` → 🎨 Rail palette |
| Proof the extraction moved nothing | `.scratch/_famethemessr.jsx` |
| Where it mounts, and the `contested` computation | `rlsw-simulator-v3_8_1.jsx` ~11902–11913 |
| The strip it lives in, and its sibling chips | `rlsw-simulator-v3_8_1.jsx` ~11790–11985 |
| The target it is built around | `engine/systems/battleFlow.js` — `fameToWin` |
| `FAME_RACE_CONTESTED_LEAD` | `data/gameConstants.js` |
| The mode axes this serves | `WIN_CONDITIONS_DESIGN.md` §1 |

---

## 11. ⚠️ The workflow, because it has bitten before

- **Preview page in `.scratch/` first.** No client edit until Alex has landed on
  values.
- 📌 **You cannot see where he lands.** The page runs in his browser and no state
  comes back. **Ask for a screenshot of the control panel** and read the values
  off it — and ⚠️ **warn him to screenshot BEFORE opening any new copy you send**,
  because a fresh file loads with defaults and wipes his dial-in.
- ⚠️ **Verify the port, do not assume it.** Render the shipped component through
  React SSR (`esbuild --jsx=automatic` + `react-dom/server`) and diff it against
  the preview at the same settings. `.scratch/_portcheck.jsx` and
  `.scratch/_geomdiff.jsx` are the working examples.


---

## 12. ✅ WHAT SHIPPED — 2026-09-16

### The scale: 🅱️ FIXED, and the reason is §2 rather than taste

§3 asks for all three candidates as a toggle and for Alex to choose by looking.
He built neither preference into the page — on the day he deferred the whole
look to a later 3D pass — so the call was made on §2's own terms, which are not
aesthetic: **a fixed scale is the only candidate on which a blip moves if and
only if that Spirit scored.** 🅱️ also survives a reskin; 🅰️ and 🅲️ are
behaviours, and a 3D pass would inherit their false motion untouched.

📌 **🅰️ and 🅲️ are still in the preview page.** If the fixed scale ever feels
wrong in play, they are one click away and this section is the thing to reopen.

### The right-hand end: measured, not guessed — and it moves with the CLOCK

§3🅱️'s one objection was that the number is unknowable until the FP economy
settles. So it was measured: 1080 matches, `.scratch/famescale.mjs`, searcher v
searcher at the shipped rules. Leader's final Fame, mean (p90):

|      | 10 rounds | 15 rounds | 20 rounds |
|------|-----------|-----------|-----------|
| 2P   | 37.4 (58) | 60.1 (92) | 96.5 (168) |
| 3P   | 47.1 (71) | 70.6 (101)| 105.3 (188) |
| 4P   | 43.2 (62) | 62.2 (90) | 85.2 (118) |

⚠️ **Two findings that changed the shape of the answer.**

1. **It is SUPER-LINEAR in rounds.** Fame per round climbs (3.74 → 4.01 → 4.83
   at 2P) because fans accumulate and the crowd multiplier compounds on top of
   them. A "rate × rounds" constant — the obvious shape, and the one this nearly
   shipped as — puts 18% of long 2P matches off the chart against a 10% target.
   `fameScaleFor` carries an exponent (1.27) for exactly this.
2. **It is not monotonic in player count.** 3P scores HIGHEST, above 4P and well
   above 2P: every seat plays the same number of turns whatever the table size,
   so what moves is the crowd — three bands split the fans into workable piles,
   two never get the multiplier up, four dilute it again. A single value for all
   three seat counts puts the median leader anywhere from 53% to 82% along the
   rail depending on who turned up; the per-count table holds it at 62–64%.

### §1's seven `fameToWin` roles, re-derived

| # | Role | What it became |
|---|---|---|
| 1 | `at(fp)` — the scale | `fameScaleFor(players, roundLimit)` in rounds; the target in Legend Run |
| 2 | threshold filter | filters against the scale |
| 3 | **the finish line** | ⛔ **not drawn at all** in Battle of the Bands |
| 4 | tie-fan direction | re-derived against the scale — `fp / Infinity` is 0, which would have fanned every group the same way and walked the top of the pack off the rail |
| 5 | per-blip tooltip | `⭐N · leading by M` / `· N behind` — no denominator, because a score has none |
| 6 | the ⭐N label | §5's margin readout: `+N`, `=` at a dead heat, `–` at 0–0 |
| 7 | container tooltip | names the mode and the round |

### §5 margin · §6 clock

**Margin** took the vacated right-hand slot as `+N`, narrower than the `⭐N` it
replaced — which matters at the `minWidth:190` §7 warns about. Plus the shaded
span on the rail, so the gap is a shape as well as a number.

**The clock took the LEFT label**, which §6 did not consider and which is better
than either option it did: that slot already said "⭐ RACE" about a race that is
not happening, so it was free. `⏳ 6/10`, and `🔥 LAST CALL` on the final round.
It cannot be mistaken for the `🔥💿 DISCO INFERNO` chip §6 warns about — different
shape, different rank, pinned to one end — and it costs zero strip width. A muted
wash inside the rail carries the peripheral sense of time running out.

### §4's "must not be redesigned away" — all five intact

Linearity, one row, the tie fan (re-derived, not carried over), the acting ring,
and the threshold notches. ⚠️ The notches needed catching: they divide by the
scale, and against Infinity every threshold becomes Infinity — **the Stage-FX
subsystem would have silently switched itself off**, with nothing on screen to
say so. ❓ §6 item 6 of `WIN_CONDITIONS_DESIGN.md` still asks whether absolute-Fame
thresholds mean anything in a score game; until that is settled they spread
across the scale.

### 🐛 The bug SSR caught that the eye would not

A dead heat at ⭐28 reported a margin of **+28** and shaded the whole rail. The
runner-up was found by filtering for scores strictly BELOW the leader — a set
that is empty exactly when the top is tied, collapsing second place to 0. The
strip looked perfectly fine; the number was a lie. **§11's "verify the port,
don't assume it" is now a suite** — `test:fametrack`, nine states, asserting what
the player reads rather than the markup.

### 📌 Still open

- ❓ The over-run treatment is `pin + »`. §3🅱️'s "hang half off" alternative was
  never judged against a real match.
- ❓ §9.5's colour question stays closed (gold), and `data/fameTheme.js` is still
  the one file to change if it reopens.
- ❓ The whole strip is due a 3D-aesthetic pass — Alex, 2026-09-16.
