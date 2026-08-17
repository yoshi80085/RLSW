## 5. 🧭 START HERE — session handoff, 2026-08-17 (late)

> ✅ **THE PREVIOUS SESSION IS COMMITTED** — `fee7be0`, and §5-eve's "STILL
> NOTHING COMMITTED" banner below is stale as a result; it is left in place
> rather than edited so the sequence still reads. **This** session's work is
> uncommitted: ~20 files, all suites green. Read this, then
> `BOT_STRATEGY_HANDOFF.md` §6.6.8.

### 5.A″ The pattern is seven for seven — and this time the sign was inverted

§5.A named the most reliable bug predictor in this repo:

> The game rewards something. The evaluator has no term for it — or has a term
> for the reward's RESULT but not for the act of going and getting it. So the bot
> never does it, nothing errors, every suite stays green.

| # | the blind spot | symptom it wore |
|---|---|---|
| 10 | the pose paid **nothing** headlessly (`HARNESS_GAPS.pose`) | 34 poses struck across 44 matches, **0 rounds ever banked** |
| 11 | `hook('leftLimelight')` had no headless implementation | a bot shoved off the Limelight rolled a **zero defence die for the rest of the match** |

🎯 **AND #11 IS THE PATTERN WITH THE SIGN FLIPPED, WHICH IS NEW.** Every previous
sighting was a reward the bot could not reach. This was a PENALTY IT COULD NOT
TAKE OFF — welded onto a Spirit who never chose to keep posing, running the whole
time in the direction nobody audits. A hook nobody implements is a rule that only
applies to humans.

### 5.B″ What shipped (uncommitted)

- ✨ **`state.limelight`** — `posing` + `scores`, the last two React-owned slices
  any rule depended on. `engine/systems/limelight.js` owns the ladder, which had
  **three separate transcriptions** that agreed only by convention.
- 🌟 **`poseConsequences`** in `battleFlow.js` — the FP grant and the Sustain
  toll as one ordered beat, through `grantFame` like every other payout.
  `transition.js`'s `endTurn` drives it; **`HARNESS_GAPS.pose` is deleted.**
- 🪦 **`leftLimelight` is a rule, not a hook.** All three pose drop sites —
  walking out, being shoved out, hitting the floor — are engine rules now.
- 🎤 **`evaluate`'s `view` argument carries NO game state.** Only
  `weightOverrides`, the bench's instrument, is left in it.
- ✨ **`posePlay` + `POSE_LOOKAHEAD` + `POSE_RISK`** — see 5.C″.
- 🎸 **The monolith is rewired onto all of it**, and four rule reads that used the
  render snapshot now read `engineRef.current` (a rival shoved off the Limelight
  mid-tick used to read as still posing — i.e. as a free clean hit).
- 🔬 eval 124→134, transition 222→232. harness 1681→**1680** — ⚠️ not a lost
  test: it asserts once per action played, so the count tracks the bot's
  decisions. See §6.6.8.

### 5.C″ 🎯 THE FINDING — a greedy search cannot climb a back-loaded ladder

Wiring the payout up was **not enough**, and the reason is a property of the
searcher rather than of the pose.

`pose` costs 0 AP and moves one flag; the FP lands at `endTurn`. So to a
per-action search, posing scores **exactly the same** as not posing — a coin
flip — while handing over the defence die. And the ladder makes it worse, not
better: round one pays 1 FP and round four pays 4, so held from a standing start
the flight is **10 FP, more than two lives** — but the FIRST rung is priced at a
quarter of the cap against a board where a fight is worth 2.5, available now.

📌 **A search that declines the first step of a staircase whose value is entirely
in the last is not malfunctioning. It is correct, once per turn, forever.**

⚠️ **AND THE FIRST FIX WAS MIS-SHAPED IN A WAY WORTH REMEMBERING.** Scaling the
risk with the prize made paying the term MORE buy LESS of it — poses fell from 18
to 13 when the payoff tripled, because the same factor amplified the penalty for
posing in company. The prize grows with the ladder; the danger does not.

### 5.D″ THE STATE OF THE GAME RIGHT NOW

**Same seeds, same fixture, HEAD vs this pass, 44 matches:** mean length
206→**156** turns, decided 24/44→**30/44**, Fame per turn 0.050→**0.089**, and
pose rounds paid **0→39**. On the §6.6 bench (50 matches, searcher vs unranked):
inconclusive 70%→**58%**, draw-inclusive 49%→**53%**.

⚠️ **NEITHER GATE CLEARS AND 50 MATCHES IS ±21 POINTS.** The inconclusive rate is
still four times its bar. This is a direction, not a measurement, and quoting it
as one would repeat exactly the mistake §5.A was written about.

### 5.E″ 🎯 NEXT, IN DEPENDENCY ORDER

1. 🎤 **DRIVE RIFF-OFF ROUND 2.** Now the largest unlit engine: `verdict.close`
   is computed and ignored headlessly, so close duels never escalate — which
   under-pays the biggest Fame play in the rules by 2 FP, a damage band, and the
   entire both-paid consolation. Alex's direction puts riff-offs at the top of
   the Fame economy; the bench still cannot see most of one.
2. 🔊 **MAKE `centreStage` CONDITIONAL ON RANGE** (carried from §5.D′, and
   §6.6.8 made it sharper rather than settling it). The middle is outside a
   tier-0 rig, so centre and `inRig` fight and the beam loses — and the pose is
   now a second reason to stand there. Range I/II is the game's own answer.
3. 📏 **THEN A REAL BENCH.** ⚠️ Every number in §6.6.8 is 44–50 matches. §6.6's
   bar is ~2000. The two-gate instrument exists and nothing else is blocking it;
   what is missing is the patience to run it before touching another weight.
4. 🪦 **THE SMASH IS STILL UNMODELLED**, and §7 explicitly wants to hold its fix
   until §6.6 can measure it. That debt is now the oldest one on this list.

### 5.F″ 📌 Housekeeping

`.scratch/` gained `posecount`, `posesweep`, `posepaid`, `posetrace`, `ab68` —
every number in §6.6.8 came out of one of them. ⚠️ **`ab68.mjs` is the one to
keep**: it runs UNCHANGED on both trees (an older checkout simply reports 0 in
the pose columns), which is what made a real before/after possible instead of a
weight-regime comparison inside one tree. `_sec668.md` is a scratch copy of the
handoff section and can go.

📌 `_to_delete/` still holds `riffLibrary.js` and `RiffBanner.jsx` from the
morning session. Still needs removing by hand.

---

