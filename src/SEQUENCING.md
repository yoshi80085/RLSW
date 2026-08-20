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

## 5. 🧭 START HERE — session handoff, 2026-08-20

> ⚠️ **UNCOMMITTED.** `src/rlsw-simulator-v3_8_1.jsx`, `src/engine/policies/play.js`,
> `src/engine/policies/evaluate.js`, `src/engine/botTraceCheck.mjs`,
> `src/data/skillTree.js`, `src/CHARACTER_HANDOFF.md`, and nine probes in
> `.scratch/`. The session before this one is §5-aug19 below.
>
> 🌀 **PSYCHO BUSHIDO NEVER LANDED ITS PAYLOAD, AND IT WAS BROKEN FOR HUMANS TOO**
> — §5.A⁶. A `setTimeout` handed the strike a closure that predated the dash, so
> the bonus Drive was computed, logged, written to state and then read at its
> pre-dash value. The only deferred call to `initiateSwing` in the file.
>
> 🌀 **AND THE PAYOUT WAS INVERTED** — §5.B⁶. `apLeft - distToTarget` paid MOST
> for a charge of zero hexes and NOTHING for a full-length one. Alex found it by
> reading the table. One sign flip, and the ability now polices itself.
>
> 🧭 **THE BOTS WERE SPINNING ON THE SPOT** — §5.C⁶, `BOT_STRATEGY_HANDOFF.md`
> §6.6.16. `face` was 41.7% of the Ronin's AP, 100% of multi-face runs were an
> A→B→A→B oscillation, and **a facing term made it worse before the guard fixed
> it**. Read that section before adding a term to anything.
>
> 🗡️ **THE RONIN CANNOT USE THREE OF HIS FOUR ABILITIES** — §5.D⁶. They are not
> action kinds at all. He aims 45% of his skill savings at them anyway.

### 5.A⁶ 🌀 PSYCHO BUSHIDO WAS THROWING ITS OWN PAYLOAD AWAY

`resolvePsychoBushido` ended with `setTimeout(() => initiateSwing(targetId), 100)`
— **the only deferred call to `initiateSwing` anywhere in the monolith.** Every
other call site is synchronous inside a click handler, so `initiateSwing` read its
rule inputs from render-scoped values and was correct BY ACCIDENT.

| what the deferred strike read | value it saw |
|---|---|
| `actionTokenUsed` (:7085) | stale — token looked unspent |
| `moveStepsLeft` (:7090) | stale — pool looked full |
| `spirits.find(...)` (:7086) | stale — **the PRE-DASH hex** |
| `noteStates[attacker.id]` (:7118) | stale — **`tempDrive` predated the buff** |

The two guards passing on stale data is the only reason the swing fired at all.
`nsA` being stale is why **the entire bonus never reached the blow**, and
`clearBattleBuffs` then zeroed it unspent.

⚠️ **THE FILE ALREADY KNEW.** The refs at :1313–1314 sit under *"live-state
mirrors so the async bot loop never reads stale closures"*, and `defenderPosing`
was fixed this exact way in §6.6.8 — twenty lines further down the same function.

**Shipped:** `initiateSwing` reads `engineRef.current` (strictly fresher than the
render values at every call site, not merely equivalent); Bushido pays
`beatsSpent(apLeft - 1, false)` for the dash and lets the Swing spend its own AP
and burn its own token; the strike is synchronous; and a `rockGodActive` guard is
mirrored up front, because the dash commits the turn before the strike is tried.

### 5.B⁶ 🌀 AND THE PAYOUT REWARDED NOT CHARGING

`bonusDrive = max(0, apLeft - distToTarget)`, and the dash warps to
`distToTarget - 1`:

| rival at | hexes charged | bonus (speed 5) |
|---|---|---|
| 1 | **0** | **+4** |
| 5 | **4** | **0** |

**Maximum payout at zero charge.** Alex: *"the player is incentivized to be as
close to the Rival as possible... which is literally the opposite effect of what
I want."*

**Shipped:** `bonusDrive = max(0, distToTarget - 1)` — the ground he covered.

🎯 **AND THAT IS WHY IT NEEDS NO MINIMUM RANGE, which was the other half of the
proposal.** The move already consumes ALL remaining AP, so the flipped sign
polices itself: charging from next door spends five AP for +0 — strictly worse
than the 1 AP Swing — while charging four spends the same five for +4. The cost
scales with the reward with no rule to teach.

⚠️ **AND A HARD GATE WOULD PROBABLY HAVE BEEN A DEAD ABILITY.**
`.scratch/bushidowindow.mjs`, 8261 Ronin decision points, walking all six axes and
stopping at the first body:

| rival on an unblocked axis at | |
|---|---|
| exactly 1 hex | **86.2%** |
| exactly 3 | 0.4% |
| ≥3, with the AP for it | **0.4%** |

⚠️ **A FLOOR, NOT A VERDICT** — these are bot boards, and §6.6.7 documents why the
bots clump (*"declining to travel"*, 83% of turns in contact). A human spaces out
far more. But the direction matters: the game's resting state is everyone
touching, and `eleven` (legal 760×, chosen **0×**) and `tentacle` (legal 9×,
chosen 0×) are what a too-narrow window looks like after it ships.

📌 **THE `tempDrive` WORDING WAS DRIFT, AND THE CODE WON.** The skill said
*"bonus Drive on top of your Drive stack"*; it writes `tempDrive`, a battle-scoped
attack bonus under `ATK_BONUS_CAP` that `clearBattleBuffs` wipes. Alex's call:
code is right. `skillTree.js`, `CHARACTER_HANDOFF.md` and the unlock log line now
say so.

### 5.C⁶ 🧭 THE SPIN — full account in `BOT_STRATEGY_HANDOFF.md` §6.6.16

`face` was 41.7% of the Ronin's entire AP budget; 100% of multi-face runs were a
perfect two-facing oscillation with `endTurn` legal on every step; 16% of all AP
went into it. No term in `evaluate` read `.facing` — every facing priced
identically to four decimals.

⚠️ **THE FACING TERM ALONE DOUBLED IT** (32.7% → 55.7% of actions), because
`legalActions` excludes the facing you are already in, so value on facing is fuel
for the oscillation. The fix is the **dominance guard**: price standing still, and
drop any `face` that does not beat it.

| 60 matches, same seeds | decided | turns | `face` | dominated | `move` | attacks |
|---|---|---|---|---|---|---|
| guard OFF | 49/60 | 104.8 | 55.1% | 8933 | 6.6% | 439 |
| guard ON, `facing: 0` | 59/60 | 43.3 | 10.2% | 0 | 40.6% | 449 |
| **guard ON + term** | **59/60** | **29.1** | **6.5%** | **0** | 36.3% | **508** |

⚠️ 60 matches. §6.6's bar is ~2000 and §5.C⁗'s lesson stands.

### 5.D⁶ 🗡️ THE RONIN'S ARSENAL IS NOT IN THE ENGINE'S VOCABULARY

`MODELLED_KINDS` has no entry for `psycho_bushido`, `shadow_illusion` or
`cursed_shamisen` — not filtered like the Smash, **absent**. Only `wa_no_koe`
works, because it is a passive. The Monster's four are all first-class.

| Ronin skill-target aims, 24 matches | | |
|---|---|---|
| `psycho_bushido` | **24** | ❌ unusable |
| `shadow_illusion` | **24** | ❌ unusable |
| `cursed_shamisen` | 15 | ❌ unusable |
| everything else | 76 | ✅ passive |

🎯 **His top two picks are his two most expensive dead ends** — 63 of 139 aims
(45%) point the Db bar at an ability he has no action for, and §3.2's whole
premise is that Db is finite. Every Ronin bench number ever recorded was a Ronin
with no arsenal.

### 5.E⁶ 🎯 NEXT, IN DEPENDENCY ORDER

1. 🌀 **PLAY-TEST PSYCHO BUSHIDO.** Client-only, no suite covers it. Dash with
   spare AP: does the battle overlay's attack stat include the bonus the log
   promises, and does the blow come from the hex he dashed TO?
2. 🗡️ **WIRE THE RONIN'S THREE ACTIVES INTO `legalActions` + `transition`.**
   §5.D⁶. The biggest open item on the roster and the one that makes him a real
   opponent. ⚠️ Bushido is aimed by FACING, so it depends on §5.C⁶ having landed.
3. 🧪 **THE OOZE STILL DOES NOTHING IN ANY BENCH MATCH** (carried, §5.E⁵ 1b).
   `hexHazards` is not in `harnessHooks`. Unchanged.
4. 🎸 **THE LEGACY BOT STILL DOES NOT PAY FOR ITS CHORDS** (carried, §5.E⁵ 1c).
5. ✨ **WHY DID POSES FALL 1054 → 224 WHEN THE FACING TERM WENT IN?** New, §6.6.16.
   Match length explains some of it and not all. Nobody has looked.
6. 🔊 **GIVE `evaluate` A TERM FOR BEING LOUD** (carried, #15). Still legal
   hundreds of times, chosen 0×.
7. 🧮 **RE-PRICE `awardRiffFame` INTO THE BAND** (carried, §5.C‴).
8. 📏 **THEN A REAL BENCH.** §6.6's bar is ~2000. Nothing here is above 135.
9. 🪦 **THE SMASH IS STILL UNMODELLED.** Oldest debt, unchanged.

### 5.F⁶ 📌 Housekeeping

⚠️ **THE SECTION NAMING CHANGED.** The 2026-08-19 handoff is now `## 5-aug19.`
rather than `## 5-prev.`, because `## 5-prev.` was already taken by 2026-08-18
(evening) and the cascade had run out of words. Dated suffixes from here.
This session uses `⁶` subsection markers.

Nine probes in `.scratch/`, all cheap and worth keeping:
- **`facestreak.mjs`** — face run lengths and provably-dominated AP. The
  regression witness for the spin.
- **`facespin.mjs`** — proves the oscillation is A→B→A→B and that `endTurn` was
  legal throughout.
- **`facewhy.mjs`** — the full priced menu on one spin. The clearest single
  picture of why the bot preferred turning to stopping.
- **`faceguardab.mjs`** — the three-arm A/B. ⚠️ **Arms run SEPARATELY** (`noguard`
  / `guard` / `noterm`); the whole thing in one process exceeds the tool's 45s cap
  on this machine, and a truncated run reports nothing at all.
- **`bushidowindow.mjs`** — how often a charge lane is open, by distance.
- **`roninkit.mjs`** — legal-vs-chosen for the Ronin, plus the arsenal-vs-
  `MODELLED_KINDS` table.
- **`ronininvest.mjs`** — what the Ronin saves up for, and how much of it is dead.
- **`faceab.mjs`** — ⚠️ its `apBanked: 0` arm is RETIRED. That hypothesis was
  wrong: zeroing the AP term made the spin worse, not better, because it made
  turning free. Kept as the record of an exonerated suspect.
- **`facewaste.mjs`** — superseded by `facestreak.mjs`. Bin it.

📌 Git writes still fail from the agent's shell on this mount. Commit from a
normal terminal. `_to_delete/` still needs removing by hand.

---

## 5-aug19. 🧭 session handoff, 2026-08-19

> ⚠️ **UNCOMMITTED.** `src/engine/policies/play.js`, `src/engine/policies/botJournal.js`,
> `src/engine/botTraceCheck.mjs`, `src/ui/BotReview.jsx`, `src/rlsw-simulator-v3_8_1.jsx`
> (one constant), `.scratch/journal.mjs`, `.scratch/reviewsmoke.jsx`, and two new
> probes `.scratch/stackorder.mjs` / `.scratch/stackab.mjs`. The session before
> this one is §5-prev below (partly `230ff8e`).
>
> 🥁 **THE BOTS COULD NOT REACH A STACK COMMIT UNTIL THE MELODY LINE WAS FULL** —
> §5.A⁵. Alex found it by playing; it reproduced on the first headless look. It
> is an ARRAY ORDER, not a judgement, and it had been live in every searcher
> match ever benched.
>
> 🧠 **AND THE JOURNAL WAS BLIND TO THE WHOLE COMPOSITION PHASE** — §5.B⁵. The one
> column built to catch "legal again and again, never once picked" could not see
> half of any turn. Fixed in the same pass, which is the only reason the fix can
> be checked by the instrument rather than by a probe written for it.
>
> 🎯 **AND THE CLOSE CALLS NOW NAME THEMSELVES** — §5.C⁵. 70–79% of decisions were
> near coin flips and nothing could say what they were flipping on. They are
> flipping on `posePlay`, `beamSetup`, `centreStage` and `apBanked`. **`pressure`
> and `fame` are in none of the top fours.**
>
> ✅ **THE TWO OWED VERIFICATIONS ARE DONE** — §5.G⁵, on Alex's machine, and they
> cover this session's edits as well as the previous one's: `npm run check:bundle`
> is clean in 2.6s (6 pre-existing `different-path-case` warnings on the standee
> PNGs, unchanged) and `.scratch/reviewsmoke.jsx` renders the panel at 8220 bytes
> with all eleven of its assertions green.
>
> 🏆 **AND A FAME WIN COULD BE SWALLOWED WHOLE** — §5.G⁵. Alex played a match to
> ⭐27/21 and no finishing screen ever came. The client's copy of `grantFame`
> never got the `ROCK_GODS_SHELVED` disjunct the engine's copy got on 2026-08-18.

### 5.A⁵ 🥁 THE FINDING — the stacks were unreachable, and it was an array order

Full account in `BOT_STRATEGY_HANDOFF.md` §6.6.14.

`composePhase` extended its line with `beamActions(steps, { limit: 1, … })[0]`.
`beamActions` groups by KIND and emits groups in first-appearance order;
`legalActions` pushes every `melodyNote` before every `stackCommit`. So `[0]` was
a melody note whenever one was legal, and a commit was unreachable until the
8-note track was full. Over 18 headless matches the picker was offered both kinds
**455 times and took a note 455 times**; every commit in the sample was a
leftover on a full track.

⚠️ **THE TWO KINDS COULD NOT HAVE BEEN COMPARED.** `makeActionScorer`'s contract
is "higher is better, WITHIN A KIND". There is no cross-kind number in it. The
fix gives that one question to `evaluate`, at the confirm, for the same reason
`evaluate` already owned "how many notes".

🎯 **AND IT IS A NEW SHAPE — WORTH A ROW OF ITS OWN IN §5.A's TABLE.** The old
predictor is *the evaluator has no term, so the bot never does it*. Here the term
exists in every column of `EVAL_WEIGHTS`, and forcing commits first through the
**same** evaluator preferred the commits-first line on **231 of 310 turns**.

> **The evaluator already wanted the stacks. It was never consulted, because the
> search could not reach the branch to ask about it.** A term nobody disputes is
> worth nothing if no line ever carries it.

⚠️ **AND THE SHIPPED BUG STILL PRODUCED 148 COMMITS**, so "does it ever commit"
was green throughout. `botTraceCheck` §3b now asserts a commit on a SHORT track
specifically, and the comment says why.

| 18 matches, searcher both seats | before | after |
|---|---|---|
| commits on a track shorter than 8 | **0** | 268 |
| turns that loaded a stack (Ronin/Int/Metal) | 15%/12%/12% | 22%/23%/33% |
| Drive stack at confirm, mean | 2.08/0.78/1.35 | 3.43/3.51/3.00 |
| ...empty at confirm | 11%/46%/27% | **0%/0%/0%** |

### 5.B⁵ 🧠 THE JOURNAL COULD NOT SEE THE COMPOSITION PHASE AT ALL

`journalSummary` bumped `chosen` with the literal `'confirmMelody'` for every
compose entry, and `legalSeen` was fed only from action entries. `melodyNote` and
`stackCommit` could therefore appear in **neither** `chosen` nor `neverChosen`.

🎯 **§5.A's automated predictor was blind to half of every turn.** It found #15
on its first run and could not have found this one, however long it ran.

**Shipped:** compose entries carry `legalKinds`, `chosenKinds`, per-step
`steps[{i, took, cands}]` and the winning line's `terms`; `journalSummary` feeds
composition kinds into the same two columns as action kinds and reports
`meanNotes` / `meanCommits` / `composeTurnsWith`; the 🧠 REVIEW panel grew two
tiles and a compose row that says "5 notes + 2 🥁" instead of "a 7-step track".

### 5.C⁵ 🎯 WHAT THE CLOSE CALLS TURN ON — the term-swing column

§5.J⁗ left "57–79% of decisions are close calls" as unquotable, because nothing
could say whether that was a bad threshold or a bot flipping coins. The journal
now records `evaluate`'s term vector on the top two priced options, and the
summary reports the mean absolute per-term difference between them over close
calls only:

| Spirit | close calls turn on |
|---|---|
| cosmic_ronin | `posePlay` 0.158, `beamSetup` 0.110, `centreStage` 0.052, `apBanked` 0.051 |
| intergalactic_0 | `apBanked` 0.191, `beamSetup` 0.179, `posePlay` 0.057, `centreStage` 0.037 |
| Metalness_Monster | `beamSetup` 0.120, `apBanked` 0.075, `posePlay` 0.037, `centreStage` 0.034 |

**`pressure` and `fame` appear in none of them.** The turns are being decided by
the positioning-and-setup terms, not by either win condition. That is §6.6.10's
rule — *a term that scores GETTING READY must be capped below what DOING it pays*
— measured for the first time instead of inferred from a symptom.

⚠️ **RAW TERMS, NOT WEIGHTED.** A big swing on a small weight moves a lot and
decides little. Read this beside `EVAL_WEIGHTS`, never instead of it.

### 5.D⁵ THE STATE OF THE GAME RIGHT NOW

120 matches a tree, same seeds, 3 lives, same script both trees (the
`pressureab.mjs` discipline, since a formula change cannot go through
`weightOverrides`): decided 119/120 → 119/120, mean turns 36 → 38, FP per turn
0.713 → **0.772**, duels 189 → **251**, swings 719 → **456**, Sonics 158 → 197,
poses 880 → 1221, lives lost 291 → 249. Wall clock 21.4s → **27.8s**.

🎯 **READ IT AS "IT FIGHTS DIFFERENTLY", NOT "IT FIGHTS MORE."** Swings down 37%
while duels are up 33% and Fame per turn is up 8%: a Spirit that walks in with a
loaded Drive stack takes the shot that pays instead of the one that is available.

⚠️ **A 50-MATCH RUN OF THE SAME PROBE SAID "mean turns 43 → 37" AND 120 ERASED
IT.** §5.C⁗'s object lesson, again, at a fifth of the sample. The turn count is
quoted above only to be disowned.

⚠️ **THE FIX COSTS ~30% OF SEARCH TIME.** Every composition step prices two
candidates to their confirm rather than taking the head of a list. Free in the
client (the driver waits ~520ms a tick on animation — §6.6.12), a real tax on a
2000-match bench.

⚠️ **`twogate.mjs` CANNOT MEASURE THIS FIX** — `unranked` gets the cross-kind
price too, deliberately, so both arms have it. 60 seeds read 38.3% ±12.3 before
and 41.4% ±12.7 after: a "nothing broke" reading and nothing more.

📌 **Suites, this pass:** engine ✅, legal 580, eval 151, transition 241, turnflow
61, determinism 22, battleflow 50, melody 159, slime 127, eleven 38, score 122,
**harness 1738 → 1843**, skilltree 208, **trace 1435 → 1700**, riffparity 127598.
⚠️ Neither moved count is coverage. `harness` tracks how many actions the bots
take. `trace` went 1435 → **1363** on the fix alone — 1 fewer action decision, 48
fewer `considered` pairs, 17 fewer curve points, because commits spend stock that
melody notes used to spend — and the new assertions took it to 1700. Nothing was
removed or weakened.

### 5.E⁵ 🎯 NEXT, IN DEPENDENCY ORDER

1. ✅ ~~**RUN `check:bundle` AND `reviewsmoke` ON A REAL MACHINE.**~~ **DONE**,
   §5.G⁵ — both clean, and they now also cover §5.G⁵'s own two edits.
1b. 🧪 **THE OOZE DOES NOTHING IN ANY BENCH MATCH EVER RUN** — new, §5.G⁵, and it
   goes at the top because it invalidates readings rather than adding one.
   `harnessHooks` implements `declareWinner` and `knockOut` and nothing else, so
   the `hexHazards` hook — `play.js` §91 says so out loud, *"client-owned,
   skipped"* — never fires; `transition.js`'s `case 'move'` has no slime cost
   either. So `slimeBites` is called from the CLIENT AND NOWHERE ELSE. Every
   Metalness weight in `EVAL_WEIGHTS` was tuned in a game where his trail cannot
   hurt anybody, and the searcher walks rivals' ooze for free in its own head and
   pays 1 Vibe a step for it on the real board. ⚠️ This is §6.6.8's
   `leftLimelight` finding again, in the hook right next to it: **a hook nobody
   implements is a rule that only applies to humans.**
1c. 🎸 **THE LEGACY BOT DOES NOT PAY FOR ITS CHORDS** — new, §5.G⁵.
   `botExecuteStackCommits` pushes straight onto `driveStack`/`sustainStack` and
   never spends the stock slot; the searcher commits through `clickNoteStock`,
   which does. The monolith's own comment at the `stackCommit` case says this and
   it had no consequence until 2026-08-19 — §5.A⁵ took commits on a short track
   from **0 to 268**, so the searcher has just started paying a bill the old bot
   has never once paid. Alex, playing: *"The Smart bot got crushed. The old bot
   lasted a bit longer than the smart one."*
2. 🥁 **WHY IS `face` HALF THE TURN?** Promoted, because §5.C⁵ has finally aimed
   at it. Before the fix the Ronin chose `face` on **534 of 1162** action
   decisions at `FACE_AP_COST` 1 — about half its AP — and attacked on 5.4%. The
   close-call column says `beamSetup` and `posePlay` are what it is buying. This
   is §6.6.10's "getting ready outranks doing it" for the FOURTH time, and it is
   the first one with an instrument pointed at it before the fix rather than
   after.
3. 🔊 **GIVE `evaluate` A TERM FOR BEING LOUD** (carried, #15). `eleven` legal
   **331×**, chosen 0× on the post-fix run — the detector has not gone quiet, and
   should not until the term lands.
4. 🧮 **RE-PRICE `awardRiffFame` INTO THE BAND** (carried, §5.C‴). Now more
   urgent, not less: duels are up 33% and every term in the payout is still
   invisible to the searcher.
5. 🔊 **MAKE `centreStage` CONDITIONAL ON RANGE** (carried). It is third or fourth
   in every column of §5.C⁵'s table, which is new evidence for an old item.
6. 📏 **THEN A REAL BENCH.** §6.6's bar is ~2000. Nothing here is above 120.
7. 🪦 **THE SMASH IS STILL UNMODELLED.** Oldest debt on the list, unchanged.

### 5.F⁵ 📌 Housekeeping

⚠️ **THE ⁴ MARKERS MOVED DOWN A SECTION.** The 2026-08-18 (evening) handoff is now
`## 5-prev.` and keeps its `⁗` subsection markers; this session uses `⁵`.

Two new probes in `.scratch/`, both worth keeping:
- **`stackorder.mjs`** — what the composition step-picker actually returns, and
  what the bot goes into the action phase holding. ⚠️ Its `[control]` row calls
  the OLD picker directly and will keep reporting `stackCommit 0×` forever; that
  is the regression witness for the ordering bug, not a live reading.
- **`stackab.mjs`** — notes-first vs commits-first through the same evaluator.
  The template for asking *"does the evaluator want the thing the search cannot
  reach"*, which is a question this repo is now known to need.

`BOT_JOURNAL_MAX` in the monolith went **4000 → 12000**, because entries are
several times bigger (term vectors on the top two options, per-step candidates on
a compose entry). Leaving it would have quietly turned "a long match" into "the
last third of a long match".

📌 Git writes still fail from the agent's shell on this mount (§5-prev). Commit
from a normal terminal. `_to_delete/` still needs removing by hand.

### 5.G⁵ 🏆 THE FINISHING SCREEN THAT NEVER CAME — one rule, two copies

Alex played a match to ⭐**27/21** on `first to 21 FP wins` and the game just kept
going. The Fame target is tested in **exactly one place** — the bottom of
`grantFame` — and there are **two `grantFame`s**:

| | `engine/systems/battleFlow.js` | `rlsw-simulator-v3_8_1.jsx` |
|---|---|---|
| who routes through it | Fame banked inside a BATTLE | riff-off payouts, cadences, Azrael streaks, poses, boss damage |
| `ROCK_GODS_SHELVED` disjunct | ✅ added 2026-08-18 | ❌ **never added** |
| `cap` argument (`RIFF_FP_TURN_CAP`) | ✅ added 2026-08-18 | ❌ **never added** — see below |

🎯 **AND THE SUMMON IS A ONE-WAY DOOR.** Crossing the target with a lead under
`ROCK_GOD_RUNAWAY_LEAD` (3) called `summonRockGod` — a finale the design SHELVED
on 2026-08-18 — and `rockGod.summoned` then gates that same branch *for the rest
of the match*. One close crossing outside a battle and the Fame win is
unreachable forever, which is exactly what ⭐27/21-and-still-playing looks like.

**Shipped:** the client's copy gains `ROCK_GODS_SHELVED ||`, so one shelf is read
in both places.

⚠️ **AND A SECOND FIX, BECAUSE THE FIRST ONE ONLY CLOSES THE BRANCH WE FOUND.**
`checkStandingFameWin` now runs at the top of `startNewTurnNotes`. The old check
fires on a TRANSITION and so cannot notice a state the game is already IN — and
at least three routes return from `grantFame` before reaching it: the ⛔ per-turn
cap (`finalFp <= 0`), a throw inside `checkStageFxThresholds` (which runs first),
and the God gate. Whoever is over the line at the top of any turn is crowned
then, whatever happened on the beat they crossed it.

📌 **THE `cap` DRIFT IS LEFT ALONE AND WRITTEN DOWN INSTEAD.** Alex's scope call.
`RIFF_FP_TURN_CAP = 8` exists so a duel can bank more than an ordinary turn's 4 —
and the client's `grantFame` has no `cap` parameter at all, so **in the shipped
game every duel payout is still clipped at 4**. `battleFlowCheck` §5a is green on
the engine's copy throughout. This is the same shape as the row above it.

### 5.H⁵ ⬇ THE JOURNAL DOWNLOAD WROTE 0 BYTES AND SAID NOTHING

Two `bot-journal-*.json` in `.scratch/journals/`, both empty, both from a session
where the panel was showing 80 decisions. A save dialog CREATES the file when it
is confirmed and the bytes only arrive at `close()`, so anything that throws in
between leaves the named file on disk at zero length — and `download()` wrapped
the whole picker branch in a bare `catch {}`, so nothing reached the console
either. **The cause is still unknown and that is the finding**: the instrument
destroyed its own evidence.

**Shipped:** the JSON is built BEFORE the picker opens (so an unserialisable
journal is reported before a file is named), `AbortError` is the only swallowed
error, every other failure is `console.error`'d AND shown in red beside the ⬇
button, and the Blob fallback still runs after a picker failure.

📌 `.scratch/jsonprobe.mjs` rules out the obvious suspect: a 171-entry journal
stringifies fine at 571 KB, and the only non-JSON-safe value in it is a
`-Infinity` score, which serialises to `null` rather than throwing.

### 5.I⁵ 🧪 WHAT THE MONSTER ACTUALLY DOES WITH HIS OOZE

`.scratch/slimeuse.mjs`, 24 matches, searcher every seat, 3 lives, legal-vs-chosen
per kind:

| Metalness_Monster | legal | chosen | took it |
|---|---|---|---|
| `slime` | 478× | 254× | **53.1%** |
| `slide` | 441× | 147× | 33.3% |
| `tentacle` | 9× | **0×** | 0% |
| `eleven` | 760× | **0×** | 0% |
| `swing` | 427× | 24× | 5.6% |

🎯 **HE CALLS SLIME MORE THAN HE DOES ANYTHING BUT MOVE AND FACE — AND NOT ONE
TERM IN `evaluate` MENTIONS THE TRAIL.** `legalActions` hands `slime` an
`apGranted: SLIME_MOVE_STEPS`, and `apBanked` is in every column of §5.C⁵'s
close-call table. **He is not laying ooze; he is buying steps, and the ooze is a
side effect he cannot see.** §5.A's predictor in its purest form.

⚠️ **AND THE BENCH CANNOT DISAGREE, BECAUSE IN THE BENCH THE TRAIL IS INERT** —
§5.E⁵ item 1b. The 53% is a reading of a game where slime is a free AP button
with no downside for anyone.

📌 `eleven` legal **760×**, chosen **0×** — carried item #3, and the detector is
getting louder, not quieter (331× at the last count).

### 5.J⁵ 📌 Housekeeping

Suites, unchanged and quoted because they are: engine ✅, legal 580, eval 151,
transition 241, turnflow 61, determinism 22, battleflow 50, melody 159, slime 127,
eleven 38, score 122, harness 1843, skilltree 208, trace 1700, riffparity 127598.
⚠️ **NOTHING MOVED, AND NOTHING SHOULD HAVE.** Both edits are in the monolith and
in `ui/`, which no suite covers — the win rule has no test because the client's
copy of it has never had one. `reviewsmoke` covers the `BotReview` edit; the
`grantFame` copy is covered by `check:bundle` and by nothing else.

Two new probes in `.scratch/`, both cheap and both worth keeping:
- **`slimeuse.mjs`** — legal-vs-chosen per kind for the whole kit, per seat.
- **`jsonprobe.mjs`** — reproduces `BotReview`'s `payload()` on a real journal.

---

## 5-prev. 🧭 session handoff, 2026-08-18 (evening)

> ⚠️ **PARTLY COMMITTED.** §5.A⁗–5.I⁗ (the `pressure` fix and the searcher
> wiring) are in `230ff8e`; 5.J⁗'s journal is NOT — `package.json`, `play.js`,
> the monolith, `policies/botJournal.js`, `engine/botTraceCheck.mjs`,
> `ui/BotReview.jsx`, `.scratch/journal.mjs`. All suites green. The session
> before this one (§5-day) is `6f2fe00`.
>
> 🧹 **AND `230ff8e` SWALLOWED THE SCRATCH JUNK.** `_to_delete/session0818b/`
> carried a **4.4MB** throwaway tarball and a copy of HEAD's `evaluate.js` into
> history, alongside `_to_delete/gitlocks/`. ⚠️ The agent cannot delete files on
> this mount (`unlink: Operation not permitted`), which is why they were parked in
> `_to_delete/` in the first place — `git rm -r _to_delete` by hand, and note the
> blobs stay in history regardless unless somebody decides that matters.
>
> 🧠 **AND IT REVIEWS ITSELF NOW** — 5.J⁗, the 🧠 REVIEW button. On its first run
> it found #15: Metalness has never once played Goes to Eleven, legal 263 times.
>
> 🧠 **AND THE SEARCHER IS PLAYABLE FOR THE FIRST TIME** — 5.I⁗. Tick the `🧠`
> box next to a CPU corner in the Lobby. Everything §5/§6.6 has been tuning was
> headless-only until tonight; the client did not import `play.js` at all.
>
> ✅ **§5.E‴ ITEM 2 IS CLOSED** — `pressure`'s knockback inversion. Read
> `BOT_STRATEGY_HANDOFF.md` §6.6.11.
>
> 🎯 **AND THE BENCH TOOK YESTERDAY'S WIN RATE BACK.** §6.6.10's "searcher
> 52.5% ±12.7" was 60 seeds. At **300 seeds it is 42.7% ±5.7**, and the fixed
> tree is 41.1% ±5.6 — one point apart, 50% outside both intervals. The beam's
> ranking is not buying nothing; **it is losing to its own absence.** That makes
> §5.E‴ item 4 the top of the list, and it now has a number instead of a shrug.

### 5.A⁗ The pattern is TEN for ten — and a machine found the tenth

§5.A's predictor, unchanged:

> The game rewards something. The evaluator has no term for it — or has a term
> for the reward's RESULT but not for the act of going and getting it. So the bot
> never does it, nothing errors, every suite stays green.

| # | the blind spot | symptom it wore |
|---|---|---|
| 14 | chip Vibe reach-weighted at full strength, against a rule where **every attack knocks the target back** | a landed blow scored `pressure` **negative** on 3% of hits — all of them hits on somebody nearly down |
| 15 | `evaluate` has no term for being LOUD — `atEleven` is in no row of the weight table | 🔊 `eleven` legal on **263** decisions across 12 matches, chosen **0** times (5.J⁗) |

🎯 **#14 IS #10's SHAPE FOR THE THIRD TIME IN THREE SESSIONS.** `adjWounded`
scored standing next to a bleeding rival, so finishing them paid nothing.
`beamSetup` scored lining a Sonic up, so firing it cost 1.96. `pressure` scored
being close enough to convert damage, so dealing it lost more than it gained.
**Every term that scores GETTING READY has to be capped below what DOING it
pays** — that rule has now been derived independently three times, and
`chargeSeek` is still the only term that shipped with it written down.

### 5.B⁗ What shipped (uncommitted)

- 💢 **`chipReachWeight`** in `evaluate.js` — `reachWeight` mixed back toward 1 by
  `PRESSURE_CHIP_REACH_MIX`, and it is the chip-Vibe half of `pressure` that reads
  it. `reachWeight` itself is untouched, because `beamSetup` and `evalCheck` both
  depend on its shape.
- 🧮 **The mix is DERIVED FROM THE ROSTER, not tuned** —
  `0.9 / ((maxVibePool − 1) × (1 − PRESSURE_REACH_FLOOR))`, which is the worst-case
  ratio (a 1-point hit on a rival at 2 Vibe, knocked the full 2 hexes) rearranged.
  0.346 today. A deeper Vibe pool tightens the ratio, so a hard-coded number would
  be correct now and wrong the day the roster grows.
- 🔬 **`evalCheck` 134 → 151 assertions** — the property SWEPT (every roster Vibe
  pool × every Vibe level × knockback 1 and 2), plus three that stop the fix from
  passing by flattening the gradient into a constant. HEAD's own 134 assertions
  were also run against the new `evaluate` and all passed.
- 📒 **`.scratch/pressureswing.mjs`** — the inversion probe. Walks real matches,
  keeps only blows that LANDED, reports the `pressure` delta next to the geometry.
- 📏 **`.scratch/pressureab.mjs`** — the A/B. Runs UNCHANGED on both trees
  (`ab68.mjs` discipline), because a formula change cannot be expressed through
  `weightOverrides`; the header says how to build the HEAD checkout.
- 🧠 **THE SEARCHER, WIRED IN** (5.I⁗) — `botSearcherStep` and its translation
  table in the monolith, a `botPolicy` toggle in `ui/Lobby.jsx`,
  `BOT_CLIENT_KINDS`/`BOT_CLIENT_GAPS` in `policies/bot.js`,
  `legalActionsCheck` §16, and `.scratch/clientkinds.mjs`. `clickNoteStock`'s
  `_forceChordMode` may now NAME the stack ('drive' | 'sustain'); every existing
  caller passed `true` and still means Drive.
- 🧠 **THE JOURNAL** (5.J⁗) — `policies/botJournal.js`, `trace`/`audit` on
  `searcherPolicy`, `ui/BotReview.jsx`, `npm run test:trace` (1435 assertions),
  `.scratch/journal.mjs`.
- 🔧 **The bot watchdog re-arms per ACTION, not per turn**, and the searcher
  driver carries its own 60-tick ceiling because that re-arm opens a live-lock
  the watchdog can no longer see. Both explained in §6.6.12.

### 5.C⁗ 🎯 THE FINDING — the ranking is behind, and 60 seeds hid it

| two-gate, three lives | HEAD | this pass |
|---|---|---|
| 60 seeds | 52.5% ±12.7 | 38.3% ±12.3 |
| **300 seeds** | **42.7% ±5.7** | **41.1% ±5.6** |

Read the top row as an object lesson. It reproduces §6.6.10's headline number
exactly, and it disagrees with the fixed tree by 14 points — a difference that is
entirely gone at 300 seeds. **Two configurations that are one point apart looked
like a 14-point swing.** §6.6's own bar is ~2000 matches and every number in
§6.6.9–11 is 30–300; this is what that warning cashes out as.

⚠️ **AND THE LEVEL MATTERS MORE THAN THE DELTA.** `unranked` is the same searcher
with the beam's `score` turned off, so ~42% with 50% outside the interval says the
ranking is actively costing the bot games. It is not a tie and it is not an edge.

### 5.D⁗ THE STATE OF THE GAME RIGHT NOW

200 matches a tree, same seeds, three lives: decided 199/200 → 198/200, mean turns
35 → 37, FP per turn 0.711 → 0.697, duels 277 → **297**, Sonics 218 → **279**,
swings 1259 → 1207. Two lives: FP per turn 0.716 → **0.759**, duels 255 → 278.

⚠️ **ONLY THE SONIC COLUMN IS A RESULT.** +28%, and it is the action a knockback-
charging term punished hardest — a Sonic shoves the target down the beam by
definition. Everything else is population noise at n=200. Nothing here is quoted
as an improvement; the fix is worth having because the sign was wrong, not because
the bench moved.

📌 **Suites, this pass:** engine ✅, legal 547, eval **151**, transition 241,
turnflow 61, determinism 22, battleflow 50, melody 159, slime 127, eleven 38,
score 122, harness **1738**, riffparity 127598, skilltree 208, `check:bundle` OK.
⚠️ **`harness` went 1709 → 1738 and that is NOT new coverage** — `harnessCheck`
asserts inside `for (const turn of log) for (const a of turn.actions)`, so its
count tracks how many actions the bots take. More Sonics, more assertions. A count
that moves with behaviour cannot be read as a coverage signal in either direction.

### 5.E⁗ 🎯 NEXT, IN DEPENDENCY ORDER

1. 🥁 **WHY IS THE RANKING BEHIND?** Promoted from item 4, and it is the whole
   list's blocker. At 300 seeds the beam's `score` loses to its own absence —
   42.7% / 41.1% against 50%, with 50 outside both intervals.

   🎯 **THE AUDIT HAS ALREADY HALVED THE QUESTION** (5.J⁗). Two hypotheses were on
   the table: the ranking prunes a branch the evaluator would have liked (a SEARCH
   bug), or the evaluator is confidently wrong about a class of position and
   ranking by it just arrives there faster (an EVAL bug). Over ~1,860 action
   decisions the beam threw away a better option **15 times, worth 5.6 points
   total** — so it is not pruning wrong, and the first hypothesis is dead. What is
   left is the expensive one, which is also the one that explains why three
   sessions of eval fixes have not moved this number.

   🧠 **AND THERE ARE TWO INSTRUMENTS ON IT NOW: play it, and read the journal**
   (5.I⁗, 5.J⁗). One candidate no bench could ever have produced is in §6.6.12's
   open list — `attackParams` (what the searcher plans against) and
   `initiateSwing` (what the client actually resolves) are not pinned to each
   other, and nothing in the repo would say so if they disagreed.

2. 🔊 **GIVE `evaluate` A TERM FOR BEING LOUD** (5.J⁗, bug #15). `eleven` legal
   263×, chosen 0×. The Sustain stack leaving is visible to the weight table and
   nothing arriving is. ⚠️ Same shape as `kit` before §6.6.6 — and note that the
   fix is a NEW TERM, which §5's Earned lens says must trace to a decision rather
   than a stat block. It is also the cheapest possible test of the journal: the
   detector should go quiet when the term lands, and if it does not, the term is
   wrong.
3. 🧮 **RE-PRICE `awardRiffFame` INTO THE BAND** (§5.C‴, carried). Mean uncapped
   award 15.85 against a cap of 8, 96% clipped, dominant term `ceil(margin / 2)`
   where `margin` grows with riff LENGTH for no reason a player could see. Every
   term in the payout is invisible to the searcher until this lands.
4. 🔊 **MAKE `centreStage` CONDITIONAL ON RANGE** (carried, unchanged, from §5.E″
   item 2). The middle is outside a tier-0 rig, so centre and `inRig` fight and the
   beam loses.
5. 📏 **THEN A REAL BENCH.** ⚠️ 300 seeds was enough to delete a headline this
   session. §6.6's bar is ~2000 and nothing in §6.6.9–11 is close to it.
6. 🪦 **THE SMASH IS STILL UNMODELLED.** Oldest debt on the list, unchanged.

### 5.I⁗ 🧠 THE SEARCHER IS IN THE CHAIR — Alex's call, and it was the right one

> *"I think a med student can study all the science behind health and the body all
> she wants, but until she gets put in the situation where the tools become
> necessary all it is is theory."*

He asked to have a go at one of these. Checking what he could actually have a go
AT turned up the thing this list should have opened with: **the client imports
`bot.js` and `legalActions.js` and nothing else from `policies/`.** Not `play.js`,
not `evaluate.js`, not `transition.js`. Four sessions of weight tuning, and none
of it had ever run in the game.

**Shipped:** a `🧠` toggle per CPU corner writes `botPolicy` onto the spirit, and
the step-machine hands over to a driver that keeps its CADENCE and replaces its
JUDGEMENT — `POLICIES.searcher` chooses, the existing client functions execute,
one action per tick. `playTurn` is deliberately unused: it would advance the
seeded cursor outside `dispatch()` and desync every peer, and the client resolves
a Swing as a cinematic rather than a call. Full reasoning in
`BOT_STRATEGY_HANDOFF.md` §6.6.12.

🎯 **AND THE FIRST MEASUREMENT PAID FOR THE WHOLE EXERCISE.**
`.scratch/clientkinds.mjs` counts what the searcher CHOOSES against what the
client can PERFORM: **6.50% of decisions contained a kind with no client path**,
all of it Metalness's trail and dial (`slime` 2.8% of actions, `slide` 0.6%). He
would have visibly given up mid-turn in front of a player. Wiring `callSlime`,
`callEleven` and `slide` — three switch cases over functions that already existed
— took it to **0.00%**. No bench could have found that, because the bench IS the
thing that has no client.

⚠️ **THE TWO BOTS ARE NOT THE SAME BOT.** Before anyone compares them: the Smash
and the Blaster are `UNMODELLED_KINDS`, so the searcher can never choose the
legacy bot's two best attacks; and `botExecuteStackCommits` never spends
`usedStockIdx`, so the legacy bot has been getting its chords for free while the
searcher pays. Both are named in §6.6.12 and neither is fixed here.

📌 Pinned: `BOT_CLIENT_KINDS` / `BOT_CLIENT_GAPS` in `bot.js`, asserted both ways
against `MODELLED_KINDS` in `legalActionsCheck` §16 (547 → **580**). It cannot see
the switch statement, and the comment says so.


### 5.J⁗ 🧠 THE FEEDBACK LOOP — and bug #15, found by it on its first run

Alex: *"Is there a way to hook up the Computer players to a feedback system that
can be reviewed after every game?"* There was, and it was nearly free: the
searcher already prices every option the beam keeps and then discards all but the
winner. A `trace` sink keeps them. Full account in `BOT_STRATEGY_HANDOFF.md`
§6.6.13.

**Shipped:** `policies/botJournal.js` (entry shapes + a pure `journalSummary`),
`trace` and `audit` options on `searcherPolicy`, `ui/BotReview.jsx` behind a 🧠
REVIEW button with a JSON download, `npm run test:trace` (**1435** assertions),
and `.scratch/journal.mjs` for the same summary over a bench run.

⚠️ **THE ASSERTION IT ALL RESTS ON:** the same seed played untraced, traced, and
traced-with-audit produces the same winner, the same turns, the same Fame **and
the same list of chosen actions**. A journal that changed the game it journalled
would make every reading taken through it describe a bot nobody plays against.

#### 🐛 #15 — GOES TO ELEVEN HAS NEVER BEEN PLAYED

| # | the blind spot | symptom it wore |
|---|---|---|
| 15 | `evaluate` has no term for being LOUD — `atEleven` is in no row of the weight table | 🔊 `eleven` was legal on **263** decisions across 12 matches and chosen **0** times, while `slime` was chosen 122× from the same kit |

The centrepiece of `METALNESS_REWORK_DESIGN.md` §0 — armour into volume, the one
rule that finally reads his Sustain stat — and the searcher can see the Sustain
stack LEAVE and cannot see anything arrive. Nine for nine on §5.A's predictor, and
this is the first one a machine found rather than a person.

#### 🎯 AND HALF AN ANSWER TO ITEM 1, FROM THE AUDIT

Over ~1,860 action decisions the beam threw away a better option **15 times, worth
5.6 points total**. **The ranking is not losing the game by pruning wrong.** That
kills the cheaper of item 1's two hypotheses and leaves the expensive one: the
evaluator is confidently wrong about a class of position and ranking by it simply
arrives there sooner.

📌 Two unsettled readings, both in §6.6.13: `face` is the single most-chosen action
in the game (349 of the Ronin's 913 decisions), and 57–79% of decisions are
"close calls" — which is either a badly-chosen threshold or a bot whose turns are
coin flips between its top two options. Neither is quotable yet.

### 5.F⁗ 📌 Housekeeping

⚠️ **GIT WRITES FAIL FROM THE AGENT'S SHELL ON THIS MOUNT.** `git stash` died with
`unable to unlink .git/index.lock — Operation not permitted` and left a zero-byte
lock behind; the working tree was untouched, and the lock is now in
`_to_delete/gitlocks/`. **Commit from a normal terminal, not from the agent.**
The A/B's HEAD checkout was built by `cp` + `git show HEAD:…` into `/tmp` for the
same reason — no worktree was created, so §5.G‴'s stale registration is still the
only one and `git worktree prune` is still owed.

`.scratch/` gained `journal.mjs` (the review panel's summary over a bench run —
5.J⁗), `clientkinds.mjs` (what the searcher chooses vs what the
client can perform — 5.I⁗), `pressureswing.mjs` (the inversion probe) and
`pressureab.mjs` (the A/B). Both are worth keeping: the first is the only thing in
the repo that measures whether an attack SCORES like an attack, and the second is
the template for A/B-ing a formula rather than a weight.

⚠️ **AND A PROBE BUG WORTH REMEMBERING:** the first cut of `pressureab.mjs` read
`r.lives` off the match result and reported "lives lost 0" — on **both** trees.
`runMatch` returns `winner / turns / reason / fame / limelightScores / duels` and
nothing else. A metric that reads a field that does not exist reports a tidy zero
and agrees with itself perfectly. Lives are counted off the board between policy
calls now.

📌 `_to_delete/` still holds `riffLibrary.js`, `RiffBanner.jsx` and `mono.diff`,
plus this session's `gitlocks/` and `session0818b/` (throwaway tarball + a HEAD
copy of `evaluate.js`). Still needs removing by hand.

---

## 5-day. 🧭 session handoff, 2026-08-18 (day)

> ⚠️ **NOTHING IS COMMITTED THIS SESSION** — 12 files, all suites green. Read
> this, then `BOT_STRATEGY_HANDOFF.md` §6.6.9. The previous session (§5-late) is
> committed as `805b1ec`.
>
> 🪦 **AND TWO OF ALEX'S CALLS LANDED TODAY:** Rock Gods are shelved (5.F‴), and
> the riff-off has its own Fame ceiling (5.C‴).
>
> 🎯 **THEN ALEX ASKED THE RIGHT QUESTION AND IT BROKE THE SESSION OPEN** — see
> 5.H‴ and `BOT_STRATEGY_HANDOFF.md` §6.6.10. The bots were not failing to finish
> matches. **They were choosing not to play**, and one over-weighted evaluator
> term was the whole of it. Inconclusive matches: **65% → 2%.**

### 5.A‴ The pattern is eight for eight — and this is the THIRD sign it wears

§5.A named the most reliable bug predictor in this repo:

> The game rewards something. The evaluator has no term for it — or has a term
> for the reward's RESULT but not for the act of going and getting it. So the bot
> never does it, nothing errors, every suite stays green.

| # | the blind spot | symptom it wore |
|---|---|---|
| 12 | `verdict.close` was computed and read only by the client | **0 of 238 bench duels ever reached Round 2** — the majority of duels, by the rules |
| 13 | the Round-2 bonus is granted in full and **clipped to nothing** | escalation landed, and FP per turn moved 0.067 → 0.066 |

🎯 **#13 IS A SHAPE THIS LIST HAS NOT HELD BEFORE.** #10 was a reward the bot
could not reach. #11 was a penalty it could not shed. This one is a reward it
reaches, collects, and then hands to `grantFame`, which throws it away at the
4 FP-per-turn cap. A rule can be present, reachable, exercised and green, and
still pay zero.

### 5.B‴ What shipped (uncommitted)

- ⚡ **Round 2 is driven headlessly** — `transition.js`'s `riffOff` case
  escalates on `verdict.close`, the client's own gate, capped at two rounds.
  `HARNESS_GAPS.riffRound2` is **deleted**. 116 of 205 duels (57%) now go to
  sudden death; the both-paid consolation, which `bothStrong` gates on
  `round >= 2`, fires for the first time.
- 📒 **The duel ledger** — `playTurn`/`runMatch` return
  `{ fought, round2, ties, bothPaid, fp, fpRound2 }`. `fp` is the FP that
  actually LANDED, for the same reason `limelightScores` exists: a duel resolved
  and a duel paid are different events, and only the second one is the economy.
- 🔬 **9 new transition assertions**, sweeping 60 seeds rather than pinning one —
  close escalates, decisive does not, nothing reaches Round 3, no close duel is
  allowed to stop at Round 1, and the loser of a hard-fought duel gets paid.
- 📌 **`HARNESS_GAPS.riffRound2Speed`** — sudden death's 0.58× chart is played at
  Round-1 difficulty, because `simulateRiffPerformance` has no tempo term.
  Declared, not patched with a guessed penalty.
- 🎤 **`RIFF_FP_TURN_CAP` = 8** (Alex's call) — a HIGHER cap for the duel, not an
  exemption: overflow is still discarded and `fameThisTurn` is still one shared
  window, so a Spirit carried past 4 by a duel banks nothing else that turn.
  `grantFame` took a `cap` argument to do it; every other caller is unchanged
  because it defaults to `FAME_PER_TURN_CAP`. 5 new battleFlow assertions.
- 🪦 **Rock Gods shelved** (Alex's call) — `ROCK_GODS_SHELVED` in
  `data/rockGods.js`; `grantFame` crowns on the Fame target at any number of
  lives. See 5.F‴.

### 5.C‴ 🎯 THE FINDING — the Fame cap is the ceiling on every play in the game

`awardRiffFame` builds the duel's payout out of six terms and the underdog
multiplier. `grantFame` then clips the lot at `FAME_PER_TURN_CAP` = **4**.

| duels that… | count | FP banked per duel |
|---|---|---|
| ended in Round 1 | 37 | **3.89** |
| went to Round 2 | 57 | **3.81** |

A Round-1 win on margin 2 is already at the ceiling. So sudden death's +2 is
awarded and discarded — and so are the margin scaling, the perfect bonus, the
Headliner belt, the stage-FX rider and the underdog multiplier, all of them, all
the time.

📌 **The biggest Fame play in the rules pays a bot exactly what a pose round
pays it.** `POSE_FP_MAX` is 4 too, matched to the cap on purpose.

✅ **ALEX'S CALL, SAME DAY: the duel gets its own ceiling** — `RIFF_FP_TURN_CAP`
= `FAME_PER_TURN_CAP × 2` = 8. And the searcher answered immediately: duels
chosen went **28 → 37** at two lives and **12 → 29** at three, on the same
policy, the same beam and the same weights. It was never avoiding riff-offs; it
was correctly pricing an action whose reward was deleted after the fact.

⚠️ **THE LADDER IS STILL SATURATED, THOUGH — Round 1 now pays 7.77 and Round 2
7.79.** Instrumenting every riff grant says why: mean base **8.34** before
multipliers, mean crowd multiplier **×1.90**, mean uncapped award **15.85**, mean
banked 7.81, **96% clipped**. `awardRiffFame` is writing 16 FP cheques against a
4 FP account, and a whole life is worth 8. The dominant term is
`ceil(margin / 2)`, where `margin` is a SCALED SCORE GAP that grows with riff
length — the same objection `RIFF_CLOSE_QUALITY_GAP` was introduced to fix on the
Round-2 gate, never carried across to the payout.

📌 **And the cap is load-bearing, so nobody should be tempted to delete it:**
with the duel ceiling lifted entirely, matches end in a mean of **14 turns**,
40/40 decided. The cap is the only thing that has been balancing the riff-off.

### 5.D‴ THE STATE OF THE GAME RIGHT NOW

Same seeds, same fixture, HEAD vs this pass, **250 matches each**: mean length
188 → **182** turns, decided 153/250 → **158/250**, FP per turn 0.067 →
**0.066**, duels reaching Round 2 **0 → 116**.

⚠️ **THE FIRST THREE COLUMNS ARE NOISE AND MUST BE READ AS NOISE.** 250 matches
is roughly ±6 points on the decided rate, and Round 2 draws from the rng, so
every roll after the first duel diverges — these are population comparisons, not
paired ones. The only column that measures the change is the last, and the FP
column is the finding precisely because it did NOT move.

### 5.E‴ 🎯 NEXT, IN DEPENDENCY ORDER

1. ✅ ~~**FIND OUT WHY HALF OF ALL THREE-LIFE MATCHES NEVER FINISH.**~~ **DONE
   THE SAME SESSION — see 5.H‴.** It was not the Fame economy drying up. It was
   `beamSetup` priced above the Fame it sets up, so `endTurn` outscored every
   action on the board. Inconclusive 65% → 2%, three lives is the default, and
   the diagnosis that replaced it is in §6.6.10.
2. ✅ ~~**FIX `pressure`'s KNOCKBACK INVERSION**~~ **DONE 2026-08-18 (evening) — see §5 above and `BOT_STRATEGY_HANDOFF.md` §6.6.11.** The reach gradient is bounded below one point of damage now; 3% of landed blows scored negative, 0% do. (5.H‴). A swing that LANDS scores
   `pressure` **−0.41**, because the term reach-weights chip Vibe and a good hit
   shoves the rival out of reach. §5's comment block solved exactly this for
   lives and left chip Vibe exposed. One variable, one A/B — and it is the last
   term still telling the bot that hurting somebody is a bad idea.
3. 🧮 **RE-PRICE `awardRiffFame` INTO THE BAND** (§5.C‴). Not the cap again — the
   award. Get the uncapped payout to land between 4 and 8 across the realistic
   spread of margins, perfects and rounds, and every term in it becomes visible
   to the searcher for the first time. Start with `ceil(margin / 2)`, where
   `margin` scales with riff LENGTH for no reason a player could see.
4. 🥁 **ASK WHY THE RANKING BUYS NOTHING.** The two-gate bench now runs on a
   population where 98% of matches finish, and the searcher beats the SAME
   searcher-with-ranking-off **52.5% ±12.7**. That is not an edge. It was
   unanswerable while two thirds of matches were excluded; it is answerable now.
5. 🔊 **MAKE `centreStage` CONDITIONAL ON RANGE** (carried, unchanged, from
   §5.E″ item 2). The middle is outside a tier-0 rig, so centre and `inRig`
   fight and the beam loses.
6. 📏 **THEN A REAL BENCH.** ⚠️ Every number in §6.6.9–10 is 30–250 matches;
   §6.6's bar is ~2000. The inconclusive gate finally has a value worth setting:
   2%.
7. 🪦 **THE SMASH IS STILL UNMODELLED.** Oldest debt on the list, unchanged.

### 5.F‴ 🪦 ROCK GODS ARE SHELVED — Alex, 2026-08-18

The finale is off the roadmap for now. The bot's only God-aware behaviour is four
lines in `botPlanMove` (converge on the God while one is summoned), now marked 🪦
and left standing: it cannot fire while nothing summons a God, and cutting a
working rule to express a scheduling decision turns a shelf into a rewrite.
`HARNESS_GAPS.summonRockGod` now names a shelved subsystem rather than owed work.

✅ **AND THE RULE MOVED WITH IT (Alex's call).** `grantFame` no longer summons:
reaching the Fame target crowns a Legend outright at any number of lives. That
was the only thing forcing `matchConfig`'s TWO-life matches, which §3.2 and §3.6
are both clear under-rate every investment term the bot has.

⚠️ **THE BENCH DEFAULT STAYED AT TWO ANYWAY, AND THAT IS A FINDING, NOT A
HESITATION** — see 5.E‴ item 1. Three lives is rule-legal and the game will not
finish it. Pass `startingLives: 3` deliberately to reproduce.

### 5.H‴ 🎯 THE ONE THAT MATTERED — the bots were not playing the game

Alex, reading 5.C‴: *"Yo these bots have a problem if they can't finish a game of
like a race to 20 FP."* He was right, and 5.E‴'s original item 1 — "the Fame
economy stops producing" — was wrong.

A stalled 400-turn match, instrumented: the two Spirits stand **adjacent for 417
of 427 samples**, both in rig, and over those 400 turns they play **2,178 melody
notes, 400 confirms, 5 swings and 0 duels**, finishing on 1 Fame and 3. Nose to
nose, fully armed, composing.

The decision dump at turn 120 says why. Scoring every option the way the searcher
does: the position as it stands **14.42**, `endTurn` 13.52, `move` 13.43, `face`
13.25, a live **riff-off 11.19**, `swing` 10.52. **Doing nothing was the best
move on the board.**

🎯 **ONE TERM CARRIES IT.** Taking the duel loses **1.96** of `beamSetup` — which
scores how close you are to firing a Sonic, and firing it knocks the rival off
the line the term is scoring — and gains **0.73** of `fame` for 8 FP, a third of
a 24-point race. A positional term with a cheap full range outweighed a third of
the win condition.

📌 **AND THE RULE IT BROKE IS ONE TERM ABOVE IT IN THE SAME FILE.** `chargeSeek`
ships with an explicit inequality — `charge` > `chargeSeek` — and an explicit
reason: without the hand-off the bot loiters beside a Charge Zone forever rather
than stepping on it. `beamSetup` was written in the same pass with no hand-off
partner and no inequality, and produced exactly that failure. **Any term that
scores getting ready must be capped below what doing it pays.**

Shipped: the `beamSetup` column scaled ×0.32 (Zero 0.9, Ronin 0.7, Metalness 0.5,
default 0.7), keeping the roster ordering, which is character. Three lives, 30
matches: decided **12/30 → 30/30**, mean turns **267 → 34**, FP per turn
**0.070 → 0.742**, duels **20 → 43**. Two-gate bench over 60 seeds: inconclusive
**65% → 2%**, searcher 42.9% ±21.2 → **52.5% ±12.7**.

⚠️ **THE WIN RATE IS THE HONEST HALF OF THAT.** `unranked` is the same searcher
with the beam's ranking off, so ~52% says the RANKING buys little once both seats
will fight. New question, clean instrument — 5.E‴ item 4.

### 5.G‴ 📌 Housekeeping

⚠️ **`git worktree` left a stale registration.** This session compared trees with
a detached worktree at `/tmp/rlsw-head`; the directory is gone but the metadata
in `.git/worktrees/rlsw-head` could not be removed from where the work was done.
One command clears it: `git worktree prune`.

`.scratch/` gained `ab669.mjs`, the A/B behind every number in §6.6.9, and three
probes behind §6.6.10:

- **`whyendturn.mjs` — the one to keep.** The decision dump: every legal action
  scored the way the searcher scores it, plus the WEIGHTED TERM DELTAS for the
  duel and the swing. It is the file that turned "the economy dries up" into
  "`beamSetup` is 1.96 and the Fame is 0.73". ⚠️ Takes the old weight as a second
  argument, because on the fixed tree these matches END and there is no turn 120
  left to dump: `.scratch/whyendturn.mjs 120 2.2`.
- **`beamsweep.mjs`** — the sweep, and **`twogate.mjs`** — the win rate and the
  inconclusive rate reported together, which is the shape §6.6 asked for. Both
  drive the change through `weightOverrides`, so neither needs a code edit to
  re-run against a future weight table. Like
`ab68.mjs` it runs UNCHANGED on both trees — an older checkout has no `duels` on
its match result and simply reports zeros — which is what makes a real
before/after possible instead of a comparison inside one tree. It also gained
`enginesrc.tgz` / `headsrc.tgz`, throwaway tarballs of the engine subset; both
can go.

📌 `_to_delete/` still holds `riffLibrary.js`, `RiffBanner.jsx` and `mono.diff`.
Still needs removing by hand.

---

## 5-late. 🧭 session handoff, 2026-08-17 (late)

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
weight-regime comparison inside one tree. `_sec668.md` and `_sec5.md` are scratch copies
of the two handoff sections written this session and can go.

📌 `_to_delete/` still holds `riffLibrary.js` and `RiffBanner.jsx` from the
morning session. Still needs removing by hand.

---

## 5-eve. 🧭 session handoff, 2026-08-17 (evening)

> ~~⚠️ **STILL NOTHING COMMITTED.**~~ ✅ It is — `fee7be0`, 2026-08-17 22:22.
> Left struck through rather than deleted: a handoff that quietly rewrites its
> own history is harder to trust than one that shows the correction. One working
> tree, ~25 files, all suites green. The morning session's handoff is kept below
> as §5-am — read this first, then `BOT_STRATEGY_HANDOFF.md` §6.6.7.

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
