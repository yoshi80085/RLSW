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

## 5. ✅ DONE 2026-08-17 — the evaluator can see a fight

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

### 5.0a ⚠️ DO THIS BEFORE TUNING ANYTHING

**Run `pressure` at weight 0 against the same seeds.** Same attack costs, same
everything else. It is the only way to tell what the term did from what the cost
fix did, and every retune before it is guesswork wearing a number.

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
