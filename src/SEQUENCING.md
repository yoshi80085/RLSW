# SEQUENCING — 🧭 what order the three open arms get built in

> **For AI editors + Alex.** Three design docs are open at once and each one
> cites the other two as a prerequisite. This doc pins the order, states the
> evidence for it, and names the single step that breaks the apparent cycle.
> Written 2026-08-15 out of a design conversation. Companion to
> `BOT_STRATEGY_HANDOFF.md`, `METALNESS_REWORK_DESIGN.md`,
> `THEORY_ROUTES_DESIGN.md`.
>
> ⚠️ **This doc settles ORDER, not CONTENT.** It does not decide a single rung,
> ability or eval weight. Where it says "settle X first" it means the decision
> is cheap and constrains everything downstream, not that the answer is here.

---

## 0. The diagnosis — three docs, one deferral loop

Read the three sequencing notes side by side and the shape is obvious:

| Doc | Says it is blocked on |
|---|---|
| `BOT_STRATEGY_HANDOFF.md` §4.3 | *"Do not tune his eval weights against the other two until [Metalness's innate] lands."* |
| `METALNESS_REWORK_DESIGN.md` §5 | *"He still has nothing musical… Monster's tritone route is the intended fifth piece."* |
| `THEORY_ROUTES_DESIGN.md` §4 | *"Metalness's innate lands first… a theory route on a half-finished character measures the design gap rather than the route."* |

That reads as a cycle — bot needs character, character wants theory, theory needs
character — and it is the reason the work feels stuck. It is not a cycle. Two of
those three arrows are real dependencies and one is a wish.

⚠️ **The deeper pathology is worth naming, because the ordering below only
treats the symptom.** All three docs open with *"NOTHING HERE IS IMPLEMENTED."*
Design is running ahead of implementation on three fronts simultaneously, which
is precisely the condition under which every front can point at another one as
blocking. The cure is not to pick the right front to design harder. It is to
ship the smallest implemented thing that makes one of the docs falsifiable.

---

## 1. Where the loop breaks, and how we know

**`METALNESS_REWORK_DESIGN.md` depends on neither of the other two.** All four
abilities in §4 — Tentacle, Slam, Master of Moshpits, Goes to 11 — are board and
combat, built on the trail-as-currency spine in §3. Nothing in them reads the
melody commit. The theory route is listed in §5 under *open questions*, as a
**fifth piece**, i.e. an addition to a kit that is already coherent without it.

**And the arrow points the other way, in the text.** Monster's Theory route is
written *against* the rework's mechanics, rung by rung:

- Tier 1 **Diabolus** — *"a tritone on the track feeds the slime — a longer
  trail, or the next trail hex bites harder — see `METALNESS_REWORK_DESIGN.md`."*
  It cannot be specified, let alone costed, before the trail is a currency.
- Tier 2 **Power Chord** reads `modeFromStack`; tier 3 **Drop Tuning** reads B8's
  `newRootRaw`. Both are hooks, not inventions — but the *character* reason to
  hang them on him ("vertical and dark") came out of the Metalness work.

So the Theory doc's route content is downstream of the character. §2d makes the
same point by accident: it designs a complete ladder for **Riff Rat**, who is
not in the bot doc's roster scope at all (§0.5 — three Spirits, Glamarchy in
`IN_DEVELOPMENT`). Designing theory for characters that do not exist yet is the
failure mode already starting.

### 1.1 The distinction that makes "Theory first" half-right

Theory has two layers and only one is blocked:

| Layer | Blocked on characters? | Do it |
|---|---|---|
| **Architecture** — §1's split (shared capacity spine + per-Spirit branch), §0.3's rule (*a rung pays for a gesture, not forgives a mistake*), renaming `dom7`/`modes`/`chromatic` off the slots, the fate of the four `discord_*` rungs | **No.** All Spirit-agnostic. | Now. It is a decision, not a build, and it constrains every rung written afterwards. |
| **Content** — the twelve rungs across four Spirits | **Yes.** | After the characters. |

Conflating these two is what makes the problem feel circular. The architecture
layer is the trunk and it has no dependencies.

### 1.2 The premise that is only half true

*"I can't get a good bot program on a character that isn't developed."*

§4.3 says do not **tune** Metalness's weights. It does not say the searcher
cannot be **built**. `legalActions`, `evaluate`, `applyBotAction`, `beamActions`'
missing `score`, expectimax, the opponent-reply mode, and the §6.6 harness are
all character-agnostic machinery. The bot arm has substantial unblocked work
that waits on no design decision at all.

---

## 2. The order

> Steps 1–2 are infrastructure and outrank all three design arms. Steps 3–6 are
> the arms themselves. Step 4 runs in parallel with 1–3 — it is an instrument,
> not a consumer.

### 1. ✅ Rewire `confirmNoteTrack` onto the melody-commit kernel — **DONE 2026-08-15**
`BOT_STRATEGY_HANDOFF.md` §7 already called this the top open item. It ranks
above the design work for a reason that has nothing to do with tidiness:
**Theory routes ARE commit-phase mechanics.** Every rung in
`THEORY_ROUTES_DESIGN.md` §2 lands in the same arithmetic that was, until today,
duplicated between `systems/melodyCommit.js` and the monolith and guarded only
by a tripwire. Building Theory content on top of a forked economy would have
roughly doubled both the cost of the rewire and the surface it could drift on.

See §3 for what actually landed.

### 2. ✅ Lock Theory's ARCHITECTURE only — **DONE 2026-08-15**, `THEORY_ARCHITECTURE.md`
`THEORY_ROUTES_DESIGN.md` §1 and §0.3, plus the three open questions in §5 that
are structural rather than per-Spirit:

- Does the shared spine stay at three rungs, or compress to two?
- Do the four `discord_*` unlocks survive as shared rungs, or does Devil's
  Interval become Monster's tier 1?
- Is `theory_sus` the template for every rung rather than a stray? (It is the
  one existing rung that already pays for a gesture.)

⚠️ ~~Renaming the three slot rungs is part of this step.~~ **CLOSED — it is a
LABEL change, not an id change.** The ids are in the replay contract; the names
were never blocking anything, because branch rungs get new ids anyway. See
`THEORY_ARCHITECTURE.md` §3.3.

**Deliverable: a page. Not a build.** — `THEORY_ARCHITECTURE.md`.

⚠️ **The step turned up a correction that changes the rework's premise.** The
routes doc's §0.1 claim — that the three rungs are "storage" with the idea
deleted and the name kept — is false: `CONTEXT_TIERS` gives each of them a
pardon tier as well as a slot and a palette step, and the names are accurate to
the tier. §2c's "two tiers nobody owns" is false for the same reason. Both are
corrected in place. The diagnosis that survives is **stronger**: the rungs are
not empty, they are GENERIC, so the commit phase is the one place four
characters are indistinguishable.

Locked: two ladders; three spine rungs (slot + diatonic palette); the `literal`
pardon stays on the spine because B4's colour payout hangs off it; the
diatonic/chromatic line is the split line, so the four `discord_*` rungs become
branch tier-1s; the horizontal detectors go to the branches; **ids are kept and
labels rewritten**, which delivers §1a's intent at zero migration cost.

### 3. Land Metalness's innate + kit
`METALNESS_REWORK_DESIGN.md` §2–§4. This is the loop-breaker: it depends on
neither of the other two arms and it unblocks both.

⚠️ Two things in that doc are ordering hazards and should be settled while
building rather than after:

- **§5's trail counterplay.** The trail becomes his movement network *and* his
  attack platform *and* his Slam fuel. A resource with three uses and no contest
  is a resource rivals can only avoid.
- **§6's `beamActions` note.** Cone-from-each-trail-hex multiplies his Swing
  branches by trail length. `beamActions` caps at 5 per kind but its `score` is
  still `null`, so it would keep an arbitrary first five — which quietly makes
  the Tentacle look bad in exactly the searcher that is supposed to evaluate it.
  That makes step 4 a *co-requisite* of this one, not a successor.

### 4. ✅ **DONE 2026-08-16** — the §6.6 harness AND `beamActions`' `score`
**In parallel with 1–3.** This is the instrument, and it is upstream of all
three arms rather than downstream of any:

- §5's weight table is *"starting points to be tuned by the §6 harness, **not**
  measurements."*
- §7 on the Smash: *"tuning the Smash before anything has played 2000 matches is
  tuning blind."*
- `THEORY_ROUTES_DESIGN.md` §4.3: the harness *"is what turns 'feels better'
  into evidence."*

It is unblocked — `applyBotAction` and `commitMelodyEconomy` are both in, and
§6b.1's caveat is lifted, so a win rate that moves when melody length changes is
now measuring strategy rather than a blind spot. It is also character-agnostic:
you do not need Metalness finished to build the instrument, only to read it.

~~⚠️ The unranked beam is the nearer half of this step.~~ ✅ **BOTH HALVES
LANDED** — `policies/actionScore.js` (`npm run test:score`) and
`policies/play.js` (`npm run test:harness`, `npm run bench:bot`).
**70.7% over 1749 decided matches, ±2.1 points; the bar was ≥60%.**
⚠️ **SUPERSEDED 2026-08-17 — that run contained no fighting and charged nothing
for attacking. Current: 56.3% ±4.5 over 469 decided. See §5.0.**
See `BOT_STRATEGY_HANDOFF.md` §6.6 for what the number does and does not cover —
the short version is that it is evidence about the SEARCHER, not a balance
reading, because every bench match is played on base kits.

⚠️ **And the co-requisite in §3 was discharged in the direction it mattered.**
The `beamActions` note was the half of step 3 that could not wait for step 4 —
the Tentacle's branches multiply with trail length, so an unranked beam would
have made the ability look bad in the very searcher meant to evaluate it.
Closed. §5's trail counterplay is still open and still an ordering hazard.

🧭 ~~The instrument now exists, which moves the bottleneck.~~ ✅ **SKILL_TREE
EXTRACTED, same day** — `data/skillTree.js`, `npm run test:skilltree`. Unlocks
are live in the bench, so Metalness's rework is finally something the searcher
can play rather than something it is blind to.

⚠️ **Handing the engine a real tree armed three gates that had never fired**,
one of which was pinned wrong by a passing test — see `BOT_STRATEGY_HANDOFF.md`
§6.6.1. Worth reading before trusting any other "the engine mirrors the client"
claim in this repo: all three hid the same way, behind a rule that lived only in
a JSX render condition.

🧭 **What is left on the bench's critical path is now the Smash.** §7's "the
Smash punishes you for having a good turn" is the oldest open balance question
here and it is the one thing the harness still cannot see, because `smash` and
`blaster` are UNMODELLED in `transition.js`.

---

## 5. 🧭 START HERE — session handoff, 2026-08-17 (evening)

> ⚠️ **STILL NOTHING COMMITTED.** One working tree, ~25 files, all suites green.
> The morning session's handoff is kept below as §5-am — read this first, then
> `BOT_STRATEGY_HANDOFF.md` §6.6.7.

### 5.A′ The pattern held, and it is now six for six

§5.A named the most reliable bug predictor in this repo:

> The game rewards something. The evaluator has no term for it — or has a term
> for the reward's RESULT but not for the act of going and getting it. So the bot
> never does it, nothing errors, every suite stays green.

Today added three more sightings and one twist:

| # | the blind spot | symptom it wore |
|---|---|---|
| 7 | walking onto a Lost Chord or Charge Zone paid **nothing** headlessly | Intergalactic 0's 2.2 `charge` weight had never fired in any bench match, ever |
| 8 | `startRiffOff` was client-only, so `legalActions` emitted no `riffOff` | **no bench match in this repo's history has contained a duel** |
| 9 | every attack judged on **one dice roll** (§6.4 unbuilt) | an attack legal at 773 decision points, taken 2 times |

🎯 **AND THE TWIST, WHICH IS THE FINDING OF THE DAY.** Once attacking actually
cost something (yesterday's §6.6.2 fix), the weights became measurable — and
**taking a rival's LIFE scored less than the two Drive notes it cost.** That is
§6.6.1's `kit` bug one pool further on: a resource scored in one state only, so
spending it is a pure loss. A bug fix is a measuring instrument switching on.

### 5.B′ What shipped (uncommitted)

- 🎯 **Four board terms** — `centreStage`, `chargeSeek`, `stock`, `beamSetup`.
- 🎲 **§6.4 expectimax** — `ATTACK_SAMPLES` 6, `WIN_SCORE` finite so it averages.
- 🎤 **The riff-off runs** — `legalActions` emits it IN PLACE of the Sonic when
  the beams cross; `awardRiffFame` moved out of the monolith into `battleFlow`.
- 🎯 **Pickups modelled**, kernels in `systems/board.js`, **client rewired**.
- 🎭 **`music/spiritStyle.js`** — six per-Spirit gestures into `perfBig`, paying
  fans and never Fame. Plus the ladder that steers a track toward one.
- 🐛 **`weightsFor`** — a per-Spirit override used to NaN every other seat.
- 📊 **The §6.6 bar restated as TWO gates** in `bench.mjs`, per §5.A.
- 🔬 New assertions: eval 103→124, transition 197→222, melody 152→159,
  score 100→122.

### 5.C′ THE STATE OF THE GAME RIGHT NOW

**Fame moves again: 0.002 → 0.044 per turn, a 22× A/B on fixed seeds.** Matches
that ran 369 turns run 215; 3 in 18 decided inside the cap became 9. Sonics and
riff-offs went from literally never to 8 and 12 across 18 matches.

⚠️ **HALF THE MATCHES STILL HIT THE 400-TURN CAP**, and the new inconclusive gate
(≤15%) is nowhere near cleared. This is the honest headline, not the 22×.

### 5.D′ 🎯 NEXT, IN DEPENDENCY ORDER

1. 🎤 **MOVE `posing` / `limelightScores` INTO ENGINE STATE.** The pose is a
   whole Fame engine that pays nothing headlessly (`HARNESS_GAPS.pose`) — 1 FP
   per round survived, cumulative to 4, which is a full turn's ceiling standing
   still. It is the largest unlit engine and `evaluate`'s `view` argument was
   always documented to disappear on the day those slices land.
2. 🔊 **MAKE `centreStage` CONDITIONAL ON RANGE.** The middle is outside a tier-0
   rig, so the centre term and `inRig` currently fight, and the loser is the beam
   (§6.6.7). Range I/II is the game's own answer; the evaluator should know that
   working the middle is a thing you EARN.
3. 🎤 **DRIVE RIFF-OFF ROUND 2.** `verdict.close` is computed and ignored
   headlessly, so close duels never escalate — which under-pays them by 2 FP, a
   damage band, and the entire both-paid consolation.
4. 📏 **THEN retune against the two gates.** ⚠️ Every weight in §5 was swept on
   9–14 match samples today. That is enough to find a factor of two and nowhere
   near enough to settle a 0.2.

### 5.E′ 📌 Housekeeping

`.scratch/` gained `probe3-5`, `sweep`, `measure`, `pair`, `tension`, `ab`,
`style`, `final`, `wfix` — every number quoted above came out of one of them.
⚠️ **`ab.mjs` is the one to keep**: it is the A/B that separates this session's
evaluator from the previous one at fixed seeds.
⚠️ **A FIXTURE TRAP, WRITTEN DOWN SO NOBODY REPEATS IT.** A probe that builds
seats with `corner: 0, 1, 2` instead of `'blue' | 'purple' | 'yellow'` makes
`CORNERS[corner]` undefined, so `distFromHome` returns 0 and **every Spirit is
permanently in rig, anywhere on the board.** Half a session's tuning was done in
that regime before it was caught, and it flatters everything — Sonics and duels
are always available. Use `bench.mjs`'s `DUEL` fixture.

---

## 5-am. 🧭 session handoff, 2026-08-17 (morning)

> ⚠️ **NOTHING BELOW IS COMMITTED.** One working tree, ~20 files, all suites
> green. Read this section, then §6.6.6 → §6.6.0 in `BOT_STRATEGY_HANDOFF.md`
> (newest first) for the detail.

### 5.A What the day actually established

**One pattern, found six times, and it is now the most reliable bug predictor in
this repo:**

> The game rewards something. The evaluator has no term for it — or has a term
> for the reward's RESULT but not for the act of going and getting it. So the bot
> never does it, nothing errors, every suite stays green, and the only symptom is
> an unrelated number that looks merely disappointing.

| # | the blind spot | symptom it wore |
|---|---|---|
| 1 | no term for harming a rival | 37% of matches never ended |
| 2 | Swing/Sonic cost nothing headlessly | every bench win rate meaningless |
| 3 | nothing valued a track near a riff | 0 riffs in 1,218 commits |
| 4 | `riffBook` never maintained | every riff forever new — a 4-turn win |
| 5 | `?? []` / `?? {}` defaults | made 2 and 4 SILENT rather than loud |
| 6 | **no board-objective term at all** | bots at distance 1 for 83% of turns |

⚠️ **AND A STATISTICS LESSON WORTH KEEPING:** the §6.6 win rate tracked the
EXCLUSION rate almost perfectly across three runs (37%→65.7%, 49%→84.5%,
9.8%→56.3%). Excluding stalls is honest; the survivors are not a random sample,
because a match resolves when someone runs away with it. **The bar was measuring
its own filter.** Restate it as two gates — a win rate on a fixed denominator AND
a maximum inconclusive rate — before tuning anything against it.

### 5.B What shipped (uncommitted)

- 💢 **`pressure`** — rival lives + Vibe missing, the mirror `survival` never had.
  Lives are NOT reach-weighted, chip Vibe is; reach decays to a floor, not zero.
- 🪦 **`adjWounded` cut** — it paid the bot for NOT finishing anyone.
- 🐛 **Attack costs applied** — Swing's 2 Drive notes (on a hit), Sonic's 1
  (hit or miss), `swingExposed`. All were missing headlessly.
- 🔬 **`bench.mjs --weights='{...}'`** — isolate one term at fixed seeds.
- 🪦 **The riff library retired** — all 34, engine to UI, per Alex.

### 5.C ⚠️ THE STATE OF THE GAME RIGHT NOW — read before playing it

**The Fame economy is EMPTY. 0.000 FP per turn.** A 400-turn duel ends 0/16 on
both sides with both crowds maxed. 7 of 8 matches end by knockout, mean 125
rounds. This is the deliberate hole left by retiring the riffs, and it is
measured rather than assumed. ⚠️ `performanceScore` also lost its largest term
(`hasRiff` was +3), so **`perfCliff` — the Ronin's identity weight — is harder to
reach.** Both seats are left EMPTY rather than backfilled.

📌 **So this is a bad moment to playtest.** Finish 5.D first.

### 5.D 🎯 NEXT, IN DEPENDENCY ORDER

Alex's direction, 2026-08-17: *"Sonic should be the main way to gain Fame. And
Riff Offs even more so. And Sonic plays should be powerful for the attacker since
they get potentially more powerful dice. The system should try and devise ways to
reach these potential Fame awards."*

📌 **The combat payouts already agree** — `thrashFame()` is a flat **1**;
`sonicFame(margin)` is `max(1, ceil(margin/2))`, so the beam already scales with
the dice advantage. Nothing to design there, only to reach.

1. 🎯 **BOARD-OBJECTIVE TERMS FIRST** (§6.6.6). The Limelight / centre ring, the
   Charge Zones, the token-and-upgrade pickups. ⚠️ Before the beam term, not
   after: Alex works the middle for objectives and *manoeuvres from there* for a
   Sonic, so a beam term tuned against bots that never travel is tuned against
   the wrong board.
2. 🔊 **A SONIC-SETUP TERM.** Offered on 1.4% of decision points, chosen zero
   times. The beam is a straight line and the Spirits are jammed together.
3. 🎤 **MODEL THE RIFF-OFF TRIGGER.** `startRiffOff` is client-only;
   `legalActions` emits no `riffOff` kind. The engine already has
   `applyRiffOffStarted` AND the whole duel resolver — **only the trigger is
   missing**. Alex expects "several per game"; the bench has never had one.
   ⚠️ It rides on a Sonic, so it is strictly downstream of 2.
4. 🎸 **PER-SPIRIT STYLE → FANS** (the riff replacement). Metalness landing a
   gallop or working a tritone; a cadence that fits THAT Spirit. **Fans, not
   Fame**, so it compounds through the crowd instead of handing over a third of
   the win in one commit. `economy.js`'s `perfBig` is the seat left empty for it.
5. Then restate the §6.6 bar (5.A), and only then retune weights.

### 5.E 📌 Housekeeping

`_to_delete/` holds `riffLibrary.js` and `RiffBanner.jsx` — this session could
not delete files on the local disk, so they were moved aside. Remove the folder.
`.scratch/` holds the day's probes (`fameaudit2`, `fpsources`, `sonicwhy`,
`riffbook`, `swingsweep`, `finisher`) — they are how every number above was
measured and are worth keeping until 5.D lands.

---

## 5-old. ✅ DONE 2026-08-17 — the evaluator can see a fight

### 5.0 ✅ CLOSED — `pressure` is in, `adjWounded` is out, attacks cost something

`evaluate` had no term for harming a rival, so the bot never attacked, so bench
matches could not end. Full write-up: `BOT_STRATEGY_HANDOFF.md` §6.6.0 (and
§6.6.2 for the bug found underneath it).

**What landed:**

- 💢 **`pressure`** — rival lives and Vibe missing, averaged across the field,
  the mirror `survival` never had. Per-Spirit: Metalness **1.8**, Ronin 1.2,
  Intergalactic 0 **0.6** (denial is his win path, not damage). The load-bearing
  design point is that **lives are not reach-weighted and chip Vibe is** — a life
  taken is banked and survives the respawn, chip damage is provisional and only
  worth what you can reach. Reach decays to a **floor**, not zero, so there is a
  gradient pointing at the wounded rather than a flat board outside melee.
- 🪦 **`adjWounded` cut.** It was `pressure`'s Vibe half with a cliff instead of a
  floor — a double-count whose duplicate inverted. It paid for standing beside
  someone bleeding, so acting on it destroyed the payment, and Metalness held the
  highest weight, making the bruiser the most reluctant finisher.
- 🐛 **Attacks were FREE in the bench** and had always been. The Swing's 2 Drive
  notes, the Sonic's 1 and `swingExposed` were never applied headlessly — a
  defaulted destructure in `battleConsequences` swallowed the omission in
  silence. Fourth bug of the §5b family. `transitionCheck` §8a pins it.

**Measured:** inconclusive **37% → 9.8%** over 520 matches; a duel sample that
logged ZERO attacks now decides **12/12**, mean 167 turns.

⚠️ **BUT THE WIN RATE FELL TO 56.3% ±4.5, BELOW THE ≥60% BAR**, and that is now
the open question rather than a closed step. It may not be a regression at all —
the old 70.7%/65.7% figures were computed over the ~63% of matches that resolved,
and those were never a random sample. See §6.6's step 6 for the two competing
readings and the A/B that separates them.

### 5.0a ✅ DONE — the A/B ran, and it disqualified the bar rather than the term

**`--weights='{"pressure":0}'` over the same 520 seeds** (`bench.mjs` grew the
flag; it merges onto the Spirit's column so a one-key object moves exactly one
row). Result:

| run | inconclusive | decided-only | draw-inclusive |
|---|---|---|---|
| costed attacks, no pressure | 49.2% | **84.5%** | 67.5% |
| costed attacks, `pressure` ON | 9.8% | **56.3%** | 55.7% |

⚠️ **THE ≥60% BAR IS NOT A MEASUREMENT OF ANYTHING WHILE IT RISES WITH THE STALL
RATE.** The decided-only rate tracks the exclusion rate across all three runs on
record; under this bar the WORST configuration measured — half the matches never
finishing — scores the best. The searcher did not lose 28 points. The statistic
was reading its own filter.

📌 **`pressure` is what ends matches, not the cost fix.** Attack costs alone made
stalling worse (36.9% → 49.2%); the term took it to 9.8%.

⚠️ **An ~11.8-point residual survives** on the draw-inclusive basis, so this is
narrowed, not closed. Mean match length drops 331 → 209 turns, and short games
decided by dice compress any skill edge — that is the likelier cause than the
weights. Full write-up: `BOT_STRATEGY_HANDOFF.md` §6.6 step 6.

### 5.0b ✅ DONE 2026-08-17 — the riff ladder shipped, and matches now end on Fame

`actionScore.js` grew `riffProgress`: how many of a riff's opening intervals the
track's tail already spells, key-agnostic like `detectRiff`, scored as the GAIN a
candidate note adds. Noise floor at 2 rungs; riffs that cannot fit in the
remaining slots do not steer. Pinned by `test:score` (111, up from 100), including
that **all 34 riffs are reachable by the ladder**.

🐛 **It immediately exposed a fifth bug of the §5b shape.** `riffBook` is React
state the harness never maintained, so `!(view.riffBook ?? {})[id]` made **every
riff forever new** — the same riff paying full FP every turn. Given a reason to
chase riffs, the searcher farmed one to the 4 FP/turn cap and won in four turns.
`?? {}` could not tell "nothing discovered yet" from "not modelled". Fixed in
`transition.js` alongside `unsurePool`.

| | before | after |
|---|---|---|
| riffs matched | **0** in 1,218 commits | 5–6 distinct per match |
| matches ending by Fame | 1 of 8 | **8 of 8** |
| mean length | 89 rounds | **25 rounds** |
| inconclusive @ 520 | 9.8% | **0.0%** |

✅ **§5.0c's bar problem is discharged by construction** — nothing is excluded, so
the denominator no longer moves. ⚠️ But the 96.2% win rate is weak evidence:
`unranked` never chases riffs at all, so the A/B is close to binary. Re-run it
against `ranked: true` with the riff stride zeroed.

### 5.0d 🪦 RIFF LIBRARY RETIRED 2026-08-17 — and the Fame economy is now EMPTY

Alex's call, taken with the numbers in hand: all 34 riffs gone, the ladder gone
with them. They were not rock, and their Fame came from the note DRAW rather than
a decision — a tight game could turn on a shape one player happened to be dealt.
Full write-up and the removal list: `BOT_STRATEGY_HANDOFF.md` §6.6.5.

⚠️ **Measured consequence: 0.000 FP per turn. A 400-turn duel ends 0/16 on both
sides.** 7 of 8 matches now end by knockout, mean 125 rounds. ⚠️ And
`performanceScore` lost its largest term (`hasRiff` was +3), so **`perfCliff` —
the Ronin's identity weight — is harder to reach**. Both holes are left open
rather than backfilled.

### 5.0e ⚠️ NEXT — SONIC AND THE RIFF-OFF ARE THE NEW FAME ENGINE

> Alex, 2026-08-17: *"Sonic should be the main way to gain Fame. And Riff Offs
> even more so. And Sonic plays should be powerful for the attacker since they
> get potentially more powerful dice. The system should try and devise ways to
> reach these potential Fame awards."*

📌 **The payouts already say this** — no design needed, only measurement:
`thrashFame()` is a flat **1**; `sonicFame(margin)` is `max(1, ceil(margin/2))`,
so the beam already scales with the dice advantage. The Sonic is already the
better Fame play and the bot fires **zero**.

Three pieces, in dependency order:

1. ⚠️ **A POSITION TERM FOR BEAM RANGE.** The Sonic is offered on 1.4% of
   decision points because **the Spirits stand at distance 1 for 83% of all
   turns** — jammed together, where the cone is easy and the beam needs
   alignment. Nothing values standing off at beam range, so the bot never
   creates the shot. This is the "devise ways to reach these awards" half and it
   belongs in `evaluate`, not the scorer.
2. **Make the Sonic worth taking when it IS offered** — its Fame is a post-hit
   consequence a one-ply search discounts against immediate costs.
3. 🐛 **MODEL THE RIFF-OFF.** `startRiffOff` is client-only; `legalActions` emits
   no `riffOff` kind. The engine already has `applyRiffOffStarted` and the whole
   duel resolver — **the missing piece is only the trigger**. ⚠️ It rides on a
   Sonic, so it is strictly downstream of 1 and 2.

📌 Then the melody side: **fans for playing to the Spirit's STYLE** (a gallop, a
tritone, a Spirit-appropriate cadence) — fans, not Fame, so it compounds through
the crowd rather than handing over a third of the win in one commit.
`economy.js`'s `perfBig` is the seat left empty for it.

### 5.0f ⚠️ AND THEN — the two Fame engines still switched off

25 rounds against Alex's 15–20 is in range, and the remaining gap has named
causes rather than mystery:

- ✨ **The pose's FP tick is client-owned**, so §3.3 is unreachable headlessly —
  the bot poses and is paid nothing.
- 🎤 **The riff-off never starts.** Measured, not assumed: the Sonic IS offered
  (1.4% of action-phase decision points) and chosen zero times — outscored, not
  missing.
- 📌 And an oddity worth a look: **the two Spirits stand at distance 1 for 83% of
  all turns.**

### 5.0b-old 🎼 the finding that started it — THE BOT HAD NEVER PLAYED A RIFF

> Found 2026-08-17 from Alex: *"when I play, games end in 15-20 rounds tops."*
> Bench matches run **89 rounds**. Full write-up: `BOT_STRATEGY_HANDOFF.md`
> §6.6.3. ⚠️ **This supersedes the bar question below** — there is no point
> recalibrating a bar against a game that is missing its main scoring system.

`fameToWin` is **16 FP**; the per-turn cap is 4. The bot earns **0.105 FP per
turn — 2.6% of the ceiling** — so it cannot win the Fame race and wins by
elimination instead (7 of 8 matches). **Zero riffs and zero cadences across 1,218
melody commits**, against a library of 34 riffs worth 2–5 FP each, whose triggers
are 4 notes long, matched key-agnostically, anywhere in the line. The detector
works — that was the control. Nothing in §5 scores playing one.

**Third instance of the same shape** (§6.6.0, §6.6.1, now this): a whole scoring
system the evaluator has no term for, so the bot never touches it, every test
stays green, and the symptom surfaces as an unrelated number looking sluggish.

🔧 It is an `actionScore.js` job rather than an `evaluate.js` one — the payoff
already lands correctly *after* a riff; what is missing is anything that values a
track one note away from a trigger, and §6.3's split puts "which note" in the
scorer. 📌 Two more Fame engines ride along: the pose's FP tick is client-owned
(§3.3 is unreachable headlessly), and the riff-off is gated behind the Sonic the
bot never fires — fix that and a second engine switches on for free.

### 5.0c ⚠️ THEN — restate the bar

Two gates, not one: a win rate on a denominator that does not move, **and** a
maximum inconclusive rate. Tuning `pressure` against the current bar would be
optimising a number that rewards games not finishing. ⚠️ Do this AFTER 5.0b —
match length is currently a reading of an attrition game, not of the Fame race.

📌 **And the bot is still attack-shy** — 2 swings per match, and the Sonic is
**never chosen once**, despite scoring above every alternative in an isolated
probe at a 4-note stack. That gap between the probe and the match is a thread
worth pulling: it is the shape of a beam that is not offering the action, not of
a weight that is too low.

---

## 5b. Then — harden the bench, then audit the gates

> Written 2026-08-16 at the end of the harness work, so the next session starts
> warm. Both halves are unblocked; do them in this order.

### 5a. The bench's numbers are not yet worth quoting

**37% of matches end inconclusive** at the 400-turn cap once unlocks are live
(up from 12.6% on base kits — gear makes games grindier). `runBench` correctly
EXCLUDES those from the rate rather than scoring them as losses, so the figure
is honest, but it rests on 303 decided matches out of 480.

⚠️ **More matches will not fix this.** More samples of a truncated game measure
the cap, not the policies. The lever is one of:

- raise `MAX_TURNS` (currently 400 in `policies/play.js`) and eat the runtime;
- shorten the Fame target — `matchConfig` already runs 2 lives to sidestep the
  Rock God, and `fameToWin` is `lives × fpPerLife(count)`;
- or find out WHY games stall. ⚠️ Prefer this one first. A 400-turn two-hander
  that cannot close is telling you something about the Fame economy, and it may
  be the more interesting finding — check whether `FAME_PER_TURN_CAP` plus the
  crowd multiplier simply cannot outrun the target at bench Db rates.

📌 Runtime note: matches cost ~150–270ms each, so a 2000-match run is ~5–9
minutes. `bench.mjs` takes `[n] [a] [b] [offset] [--json]` and the seed sequence
is offset-addressable **precisely so a long run can be split into chunks and the
JSON lines summed** — chunking is not sampling twice.

### 5b. ⚠️ THE GATE AUDIT — the class of bug, not the instances

Three bugs landed in one session and **all three hid the same way**: a rule that
existed only in a JSX render condition, where `legalActions` had nothing to
transcribe from. §6.6.1 has the full write-ups. The shape is worth naming:

> The client gates a button; the engine's generator never learns the rule; the
> generator is therefore over-permissive; nothing notices, because the only
> consumer that would notice is a searcher, and the searcher was blind to that
> family for an unrelated reason.

**There is no reason to think three is all of them**, and the surface is
countable: the monolith holds **26** `acting?.id === …` conditions and **24**
`disabled={…}` button gates, against the **15** action kinds `legalActions`
emits. The audit is mechanical rather than clever — walk each client-side gate
and ask whether `legalActions` knows the same rule.

⚠️ **`legalActionsCheck` will not catch these and must not be trusted to.** §15
of that file PASSED for months against `skillUnlock`, a mechanic the game does
not have — every assertion green, pinning a fiction. A test written from the
same misunderstanding as the code agrees with the code. The audit has to read
the CLIENT as the source of truth, not the check.

### 5. Build ONE Theory route end to end — Monster's
`THEORY_ROUTES_DESIGN.md` §4.2 already says this and it is right: build one
branch, see whether a three-rung musical route actually changes how a turn
feels, and **do not commit the roster before that**. With step 4 in place, "feels
better" is now a measurement rather than an opinion.

### 6. Then, and only then: bot eval terms for the new class, and the rest of the roster
§3 of the Theory doc is the payoff — per-Spirit theory gives the searcher a
distinct commit-phase objective to score, which is *a new class of eval term*
rather than a re-weighting. §5 flags that class of change as the most likely to
move observed win rates, because it corrects a blind spot rather than adjusting
sight. That is worth having, and it is worth having **after** there is a harness
to read it with.

---

## 3. What landed today (step 1)

`confirmNoteTrack` is now a **UI shell** over `systems/melodyCommit.js`. The
client owns no commit arithmetic at all.

**Structure.** The kernel returns `patch`, an ordered `effects` list, `logs`,
`flashLines` and `report`; the client applies the patch, walks the effects, and
renders. What remains client-side is what the kernel cannot know — the d6 spin,
the riff sequence, banners, toasts, tips, fan bursts, `applySkillEffects`, and
the HUD turn-step flow. Those are declared in `melodyCommit.CLIENT_OWNED`.

**⚠️ The rng shim is the netcode contract, and it is the one line to protect.**
The kernel asks for `rng.int(n)`. The client passes
`{ int: (n) => drawSeededInt(n) }` so the mic's voice roll advances the cursor
through `randomBatchDrawn` — a **logged** engine action the netcode relays and
every replay reproduces. A bare `makeRng()` there would roll identical numbers
off an unlogged stream and desync every replay and every online client,
**silently**. That is §0.4's failure mode exactly, and it is now pinned by an
assertion.

**Ordering became structural.** The riff's Fame is multiplied by the crowd, so
it must see the fans this commit won and not the cadence fans that land after
it. The shipped client encoded that as `setTimeout(0 / 0 / 500 / 700)` — a real
rule expressed as three animation delays, breakable by anyone retiming a
banner. The effects list encodes it in the list order, so the state writes now
run synchronously and the stagger is free to be what it looks like: cosmetic.

**Two more copies went with it.** `checkWaNoKoe` and `applyWaNoKoe` were both
defined in the monolith — the rule in three places, the write in two. Both are
gone; the rule is the kernel's and the write is part of the commit patch,
**bug and all** (the B10-shaped bug where a pre-commit `tempDrive` overwrites
the Drive boost the same commit just earned is still faithfully reproduced). Its
fix is now a one-place edit, which is the whole point.

**`melodyCommitCheck` §14 was inverted, not deleted.** It was written to be
deleted the day the rewire landed. Deleting it would have thrown away the
question worth keeping. The old guard asked *"does the second copy still
match?"*; the new one asks *"is there a second copy?"* — it fails if any of the
nine pinned expressions comes back into the monolith, if `awardTargetSkill` is
called at the commit site again, or if the rng shim is replaced.

**Verification.** All nine suites green — `melody` 149, `transition` 182, `eval`
85, `legal` 545, `turnflow` 61, `determinism` 22, `battleflow` 45, `riffparity`
127,598, plus the engine selftest. `eslint` clean on the touched files; the app
bundles.

### 3.1 ⚠️ Deliberate behaviour changes — read before blaming a bug

Four, all judged worth it, none accidental:

1. **Fans, Fame and the unsure pool now land synchronously**, in effects order,
   instead of at 0 / 500 / 700 ms. The arithmetic is identical by construction —
   the constraint the delays encoded is the list order — but a player watching
   closely will see the score track move sooner after a riff.
2. **Log order within one commit shifted slightly.** The `✓ Committed` headline
   now sits below the mic line rather than above it. Cosmetic; the kernel emits
   one ordered array and the client no longer interleaves its own calls.
3. **`showTip('intervals')` now also fires on a tritone ENDING.** The client
   previously tested `isMinorSeventhEnd || isMajorThirdEnd`; it now reads
   `report.hasGatedEnding`, which is that set plus `isTritoneEnd`. This is a
   superset and arguably the intended behaviour, but it is a change.
4. **`awardTargetSkill` no longer runs at the commit site.** It must not: the
   state half is already in the patch (`targetSkillId` cleared), so the old call
   would take its no-op branch and the side-effect chain would never fire. Only
   `applySkillEffects` + `showTip('skill_unlock')` run now. The 🏆 log line is
   the kernel's and keeps the skill icon.

No copy was lost. The kernel now derives the crowd multiplier for the fan log
itself (`crowdMultiplier` was already beside `hexRingFromCenter`, and
`assignments` is on the sheet), so the `(×1.23)` suffix survives in one place
rather than two.

---

## 4. The stop rule

Each step below has a condition that says it is finished. Without one, "the
Theory arm is underdeveloped" has no end state and the loop in §0 reforms.

| Step | Done when |
|---|---|
| 1 · Rewire | ✅ nine suites green, `melodyCommitCheck` §14 inverted, no second copy |
| 2 · Theory architecture | ✅ two ladders locked, the split line drawn, the rename question closed |
| 3 · Metalness kit | the four abilities are in `legalActions` + `applyBotAction`, and the trail is a modelled state class |
| 4 · Harness | 2000 seeded headless matches run, new bot vs. current bot, ≥60% bar, determinism regression pinned |
| 5 · Monster's route | three rungs in, and the harness shows the commit phase changed — not just that it did not break |
| 6 · Roster | only after 5 reports something |

---

## 5. What this doc does NOT settle

- **Any rung, ability, name or number.** All of that is the other three docs'.
- **Whether the Smash's fixed-fuel fix (§7) goes before or after the harness.**
  The doc argues for after, on the grounds that tuning before measurement is
  tuning blind. That argument is about the *larger* exposure lever; the
  one-constant fuel price may be cheap enough to land early. Undecided.
- **Whether search depth is per-Spirit** (§7, last item). It needs measuring,
  which makes it a step-4 consumer.
- **Glamarchy.** Out of scope in `BOT_STRATEGY_HANDOFF.md` §0.5 and out of scope
  here. Adding a fourth Spirit mid-sequence would re-open every step behind it.
