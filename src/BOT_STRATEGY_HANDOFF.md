# BOT STRATEGY HANDOFF — 🧠 the cost web, the kits, and what replaces personas

> **For AI editors + Alex.** The decision model a searching bot reads: every
> currency in the game, every place the rules force one choice to be paid for
> with another, and per-Spirit evaluation weights that replace the four generic
> bot personas. Written 2026-08-12. Companion to `CHARACTER_HANDOFF.md` (the
> kits), `ECONOMY_HANDOFF.md` (the currencies), `MULTIPLAYER_HANDOFF.md` §5e
> (bot policies), and `ARCHITECTURE.md` (the STICs + Earned lenses).
> 🧭 **For what order this gets built in relative to the Metalness rework and the
> Theory routes, see `SEQUENCING.md`.**
>
> Unlike the other handoffs, **almost nothing here is shipped code yet.** This
> is the spec the search bot is built against. Every number is cited to the
> constant it came from; anything transcribed from a design doc rather than
> read out of source is marked 🟡 and must be re-checked before it is trusted.

---

## 0. Rulings that govern everything

1. **Personas are retired. The Spirit IS the plan.** `BOT_PERSONALITIES`
   (maestro / moshlord / diva / saboteur) was written when Spirits were stat
   blocks. They now own exclusive arsenals via `SPIRIT_ONLY_ROUTE`, and the
   persona `skillOrder` arrays are entirely generic rungs (`theory_major`,
   `amp_1`, `range_1`…). A moshlord piloting Intergalactic 0 — speed 4, a
   blink, a vortex, a hidden-info bluff — plays *against* its own kit. The
   evaluation weights in §5 come from the Spirit. Difficulty comes from search
   depth. Character and skill become independent dials, which they are not today.
2. **⚠️ AP and movement are ONE pool, and that is the spine of the game.**
   `moveStepsLeft` is granted from the committed Melody Line
   (`moveBudgetSet(hexes)`, where `hexes = usableMoves`) and is then spent by
   *both* walking and fighting — Swing 1 AP, Sonic 2 AP, Smash 2 AP. **The
   melody you commit literally buys your ability to act.** Any evaluator that
   scores position and offence separately has already missed the game.
3. **Nothing is scored that a player did not choose.** Same Earned lens as
   `ARCHITECTURE.md`: an eval term tracing back to a stat block rather than a
   decision will teach the bot to value the wrong things, and it will look
   *right* while doing it, because stat-driven play still wins some games.
4. **Search runs on `rng.fork('search')`, never the live stream.** Burning
   cursor draws inside a hypothetical desyncs every replay and every online
   client (they compare cursors frame-by-frame and freeze on mismatch). This
   fails silently and is exactly what §8d was built to hunt.
5. **Three Spirits, not four.** `Glamarchy` is in `IN_DEVELOPMENT` — a stat
   block with no innate and no arsenal. She is out of scope here. `Metalness_Monster`
   is in scope but is the thin one: arsenal exists, innate identity is Poison
   Slime and little else (`CHARACTER_HANDOFF.md` "NEXT TASK").

---

## 1. The spine: one pool, three destinations

Per turn a Spirit receives **6 refilled stock slots** (`STOCK_REFILL_RATE`)
into a reservoir of **10 notes** (11 for Ronin — `economy.js: stockSize`).
Stock is a reservoir, not a hand: unspent notes carry over.

Those notes go to exactly three places, and the split is the whole decision:

| Destination | Buys | Budget | Persists? |
|---|---|---|---|
| **Drive Stack** | attack rating + attack ammo | ≤3 notes/turn total across both stacks (`STACK_COMMIT_BUDGET`) | yes — spent by attacking |
| **Sustain Stack** | defence rating + armour | (shares the same 3) | yes — chipped when hit |
| **Melody Line** | **movement AND action points** | the rest | cleared on confirm |

Stack capacity is **earned, not fixed**: `stackCapFor()` gives 3 slots
baseline, +1 each for `theory_dom7`, `theory_modes`, `theory_chromatic`, hard
ceiling 6 (`STACK_CAP_MAX`).

> ⚠️ **DOC DRIFT — RESOLVED, source wins.** `DRIVE_SUSTAIN_SPLIT_DESIGN.md` §1
> states a flat cap of **5 notes** per stack. That doc is **stale**:
> `gameConstants.js` records that "the old flat `STACK_CAP = 5` export is GONE
> on purpose," and `stackCapFor()` is now the single source of truth (3 → 6).
> Build the evaluator against `stackCapFor()`. An evaluator that thinks slot 4
> is free will systematically over-rate the Theory route's early rungs — slots
> are precisely what makes that ladder pay (Harmonic Lock climbs 0.00 → 0.83 Db
> on slots alone).

**The trade, stated plainly:** every note committed to a stack is a hex you
cannot walk and an attack you cannot afford. Every note left for the melody is
Drive or Sustain you do not have when someone reaches you. There is no
dominant side. A bot that always feeds stacks strands itself; a bot that
always feeds melody arrives everywhere with nothing to hit with.

---

## 2. Currency map

| Currency | Earned by | Buys | Cap / rate | The sacrifice |
|---|---|---|---|---|
| **Notes (stock)** | refill, Lost Chords, charge assist | stacks + melody | 10 (Ronin 11), +6/turn | §1 — the spine |
| **AP / `moveStepsLeft`** | committing the Melody Line | movement, Swing (1), Sonic (2), Smash (2) | = committed track length | distance vs. violence |
| **Db (Decibills)** | melody commits (`scoreTrackDB` + context) | skill unlocks **and** per-use ability fuel | threshold 4 (`DB_UPGRADE_THRESHOLD`); mean ≈2.6/commit | **unlock vs. fire** — see §3.2 |
| **HC (Harmonic Charge)** | performance quality only | skill route progress | `scoreTrackHC` + `perfHcBonus` | performance vs. tempo |
| **FP (Fame)** | battles only, + Pose + Azrael | **winning** | **4/turn hard cap** (`FAME_PER_TURN_CAP`) | overflow is DISCARDED |
| **Fans** | performance, ring position, trivia, cadences | multiply *all* FP | ×2.0 cap; diehard 0.10, casual 0.03 | centre pays, centre kills |
| **Vibe** | — (it's health) | survival | 4–5 by Spirit | the only truly scarce thing |
| **Charge (⚡)** | 2 fixed lightning hexes | die floor (≥3) or die ceiling (d6→d8) | 2 turns, dies on any battle | **roam vs. fight** |

**Win condition:** `fameToWin = startingLives × fpPerLife(playerCount)`, where
`fpPerLife = max(5, 10 − playerCount)`. At 4 players that is 6 FP per life.
⚠️ With `FAME_PER_TURN_CAP = 4`, **a match cannot be shorter than
`fameToWin / 4` of your own turns.** The bot should know its own theoretical
floor — it changes whether a greedy line is even worth taking.

---

## 3. The opportunity-cost web

Each trade below is a place the rules force a real sacrifice. The **verdict**
column is the heuristic a shallow bot uses and the searcher should be allowed
to overrule.

### 3.1 Notes → Melody vs. Stacks · *the spine*
Costs AP/reach for Drive/Sustain, or the reverse.
**Verdict:** feed stacks when a rival is already within reach next turn (the
AP has nowhere useful to go); feed melody when the board matters — objectives,
charge zones, escaping a rig radius. ⚠️ Feeding stacks while stranded outside
your own rig radius is the worst square on the board: you defend on a bare
**d4** (`SONIC_DEF_DIE_OUT_OF_RIG`) and cannot riff-off at all.

### 3.2 Db: unlock vs. fuel
`dbCost` on `SKILL_TREE` is the **one-time unlock**. Several abilities then
charge **per use** from the same pool: Cursed Shamisen 2/use, Space is
Displaced 1/use, Gravity Control 1/use, Code Injection 1/use, Sunbeam 2/use.
**Verdict:** this is the sharpest tension in the game and the one the current
bot has no concept of. Saving toward a 14–16 Db capstone means an entire arc of
turns where the arsenal you already own goes unfired. Weight unlocks by
*remaining match length* — a capstone bought at fame 20/24 never pays for itself.

### 3.3 Strike a Pose: FP vs. **zero defence**
A posing Spirit rolls **no defence die at all** (`combat.js` — `defTotal` is a
flat 0), costs `POSE_SUSTAIN_COST` 1 Sustain note per round, and earns
`POSE_FP_STEP` 1 FP per round survived, cumulative, capped at
`POSE_FP_MAX` 4.
**Verdict:** the payout escalates, so posing is a *commitment*, not a tap. Only
open a pose with reach denial — nobody able to close for 2+ AP — or with a
lead worth defending. A maxed poser earns a full turn's FP ceiling standing
still, which makes them the whole table's problem, and the bot should read
*rival* pose counts as a threat signal, not just its own.

### 3.4 The Smash: everything now, nothing next turn
Costs `SMASH_AP_COST` 2 AP (and **ends all remaining movement**), every unused
note in stock, the **entire** Drive Stack, and `SMASH_SELF_SUSTAIN` 1 off
Sustain. Pays, undefendably: `SMASH_DAMAGE` 2 Vibe, `SMASH_SUSTAIN_STRIP` 2
notes off their Sustain, `SMASH_KNOCKBACK` 2 hexes.
> ⚠️ **CORRECTED 2026-08-14 — this section invented a mechanic, source wins.**
> It previously read "it sets `smashExposed` — the next blow to land on them
> ignores their Sustain entirely… a Smash immediately followed by any hit is the
> highest-damage sequence available to a bot that can see two plies." **None of
> that is true.** `resolveSmash` does not set `smashExposed` at all; the
> 2026-08-05 rework deleted it and left the reason in the code — *"No Exposed
> flag any more — the cost IS the drawback."* Where the flag IS set — Blaster of
> Ra, and the shadow-whiff — it goes on the **ATTACKER**, as a self-debuff
> ("ride the recoil into Exposed"), cleared at the start of their own turn
> (`turnFlow.js`). `attackParams` reads the *defender's* copy, which is correct:
> it is a vulnerability you inflict on yourself. Third doc inversion after §3.7
> and §1's stack cap; the pattern is always the same, a design intention outliving
> the code that carried it.

**Verdict:** it is a *defence-breaker*, not a finisher — but ⚠️ **you cannot cash
the hole you tear.** `actionTokenUsed` is one token per turn, so no follow-up
this turn; and next turn your Drive Stack is EMPTY, so your Swing has nothing to
spend and your Sonic has no Drive either. The strip is cashed by **somebody
else** — and §3.7 says the money is in punching up, so the rival best placed to
cash it is the leader. **The cost is private and the payout is public**, which in
a 3–4 player FFA makes it a losing trade by construction rather than by tuning.

Where it IS correct, and the evaluator should say so:
- **Lethal.** 2 undefendable Vibe on a rival at ≤2 is a guaranteed life with no
  defence roll. A Swing can whiff; this cannot. Cleanest closer in the game.
- **Edge-of-stage knockouts** — 2 hexes of undefendable push.
- **🧪 Metalness with Slime unlocked** — halved rival refill on top, for 1 Db.
- **⚠️ THE UNPRICED LINE: the Smash is CHEAPEST on the turn you commit a long
  melody.** A long track drains stock (that is what the notes bought) *and*
  grants the AP, so "long melody → Smash" hurls almost nothing, while "short
  melody → Smash" throws a full reservoir away. Nothing scores this today, and
  §6d is what finally makes it visible.

### 3.5 Charge zones: roam vs. fight
A charge lasts `CHARGE_ZONE_BOOST_TURNS` 2 turns **or until any battle
resolves, win or lose**.
**Verdict:** never pick up a charge and open a fight in the same turn — that is
strictly worse than fighting without it, because the pickup walk cost AP. For
Intergalactic 0 this is not a boost but his **entire mobility identity** (§4.2).

### 3.6 Position: fans vs. safety
`FAN_GAIN_BY_RING` pays main 2 / pit 1 / floor 1 / **back 0**, and after
`FAN_BORED_AFTER` 3 turns in the outer ring `FAN_DECAY` sheds 2 casuals/turn.
Fans cap at ×2.0 on *every* FP payout.
**Verdict:** the fan multiplier is a compounding lead, so early centre-stage
turns are worth more than late ones. But centre is also the Limelight, i.e. the
most contested hex on the board. The bot should treat fan multiplier as an
*investment horizon* term, decaying in weight as `fameToWin` approaches.

### 3.7 Underdog: punch UP, or collect nothing
`UNDERDOG_MIN_DEFICIT` 6 behind, +0.5 mult per `UNDERDOG_DEFICIT_PER_STEP` 6,
up to `UNDERDOG_MAX_MULT` 2.5.

> ⚠️ **CORRECTED 2026-08-14 — this section was inverted, source wins.** It
> previously read "beating up the last-place Spirit *pays them* — prefer second
> place." That is backwards. `combat.js`:
> `underdogBonus(winnerFame, loserFame)` → `deficit = loserFame - winnerFame`,
> and the multiplier is applied to the **winner's** payout. Nobody is ever paid
> for being hit. The bonus belongs to whoever wins **from behind**.

**Verdict:** the money is in punching **up**. A trailing bot should hunt the
fame **leader** — the same knockout is worth up to ×2.5 there and ×1 against
last place. A leading bot gets no multiplier from anyone and should pick targets
on damage and position alone. `botPickTarget`'s `targetLeader` flag turns out to
be the right instinct wired to the wrong justification: it is not a saboteur
personality trait, it is arithmetic, and it should be *conditional on trailing*.
Shipped as the `targetUpside` term in `policies/evaluate.js`, cross-checked
against `underdogBonus` itself in `evalCheck.mjs` §13 so the two cannot drift
apart again.

---

## 4. The kits

### 4.1 Shredding Ronin (`cosmic_ronin`) — 8/5/5/5 Shred · the fragile virtuoso
**Innate:** Performance Score ≥5 wins ~2× fans (<5 sheds them); his own Smash
hits soft, a Smash *on* him double-scatters; ~50% bonus note off a Lost Chord;
11-slot stock.
**Arsenal:** Psycho Bushido (6 Db, 2-round CD — dash in facing line, leftover AP
becomes bonus Drive) · Shadow Illusion (6 Db + 1 Drive token — stacked decoy,
**own movement pool**, 3 turns) · Cursed Shamisen (8 Db, 2/use — 3-stage
stalking aura) · Wa no Koe (12 Db — melody/chord alignment pays +1 Drive or Sustain).

- **Win path:** FP off high-margin battles, funded by the fan multiplier his
  virtuosity innate compounds faster than anyone's.
- **Maximise:** Performance Score ≥5 — it is a *cliff*, not a slope, and it is
  the single highest-leverage number in his kit.
- **Refuse:** trading Vibe. 5 Vibe with 5 Sustain is the softest real body in
  the game, and a Smash on him double-scatters.
- **Bot must understand:** Psycho Bushido converts *unspent AP into Drive* —
  that inverts §1 for one turn and is the only place in the game where a long
  melody directly becomes attack power. And Shadow Illusion's free movement
  pool means the decoy is a **zoning tool**, not just a bluff.

### 4.2 Intergalactic 0 (`intergalactic_0`) — 6/7/4/4 Groove · the cosmic controller
**Innate:** speed 4; knockback −1 ("Rolls Hard"); Freestyle (first out-of-scale
note per turn is free +Flair; cluster reads 8/2); +1 Sustain on every voicing;
**📻 Boom Box** — while holding a charge, `distFromHome` reads **0** anywhere.
**Arsenal:** Blaster of Ra (10 Db — replaces Smash, ranged piercing, keeps the
old throw-count scaling) · Space is Displaced (8 Db, 1/use — blink to ring 2–3,
**no AP**, movement untouched) · Gravity Control (6 Db, 1/use — vortex, drags
ring-2 rivals in, `refillDrain` 2 notes) · Code Injection (6 Db, 1/use — hidden
re-roll on the first rival attack that would beat him) · Sunbeam (14 Db, 2/use —
blinds on any connecting hit).

- **Win path:** denial. Drain rival refills, deny position, win on attrition
  and defence rather than damage.
- **⚠️ The Boom Box is the whole character.** Charged, he goes from stranded
  2d6 to portable **2d8+2d6**, keeps the riff-off gate open, and defends on d6
  instead of d4. The bot must treat "hold a charge" as a near-permanent
  objective, and must know it **dies on any battle** — so his correct shape is
  *charge → reposition → deny → only then fight*.
- **Gravity Control is the best Db-per-effect in the game at 6 unlock / 1 use:**
  `GRAVITY_NOTE_DRAIN` 2 notes off a refill is a third of a rival's turn income.
  Evaluate it as **tempo denial**, not damage, or the bot will never cast it.
- **Code Injection needs an honest prior.** Measured save rates (20k trials):
  Thrash single die 36%, Sonic 1 amp 22%, 2 amps 15%, 3 amps 16%, maxed 3d8 12%.
  ⚠️ It is *worse* the bigger the attacker's rig. Do not let the bot spend it
  into a maxed rig.

### 4.3 Metalness Monster (`Metalness_Monster`) — 7/6/4/5 Shred · the bruiser
**Innate:** Poison Slime — slime on every vacated hex, 1 Vibe to any rival who
enters or is pushed in, immune to his own, trail lasts a full round (lifetime
counted in spirit-turns seeded with the living-Spirit count).
**Arsenal:** Number of the Beast (6 Db) · Master of Moshpits (8 Db) · Slime
(10 Db) · Azrael (12 Db — knockdown streak → FP).

- **Win path:** attrition that snowballs. Azrael is the payoff engine; slime is
  the board tax that funds it.
- 📌 **A full kit redesign now exists — `METALNESS_REWORK_DESIGN.md`.** The
  arsenal below is the SHIPPED one; that doc proposes cutting Azrael and Number
  of the Beast and rebuilding around the trail as a currency. `SEQUENCING.md`
  step 3 is where it lands, and it is the step that unblocks this section.
- **⚠️ Thinnest kit of the three, by design gap not by balance.** `CHARACTER_HANDOFF.md`
  lists him as "arsenal, **no innate identity**." **Do not tune his eval weights
  against the other two until that lands** — a bot that plays him "correctly"
  today is playing a half-finished character, and any win-rate reading from the
  §6 harness will be measuring the gap, not the skill.
- **Bot must understand:** slime makes his *vacated* hexes dangerous, so his
  movement is an attack. No current bot scorer models "where I came from."

---

## 5. Evaluation weights — the persona replacement

> ✅ **SHIPPED 2026-08-14** — `src/engine/policies/evaluate.js`, covered by
> `src/engine/evalCheck.mjs` (`npm run test:eval`, 85 assertions).

`evaluate(state, spiritId, view) → { score, terms, weights }`, weights keyed by
Spirit. Values are starting points to be tuned by the §6 harness, **not**
measurements.

**Three things about the shipped shape that the table above does not say.**

1. **It returns the breakdown, not just the number.** A single score tells you
   the bot preferred a line but never *why*, and a mis-signed term looks exactly
   like a good bot until it has lost 2000 matches. Log `terms`, don't trust
   `score`.
2. **The `view` argument carries what the engine still doesn't own.** `posing`
   and `limelightScores` are React state (`state.js` null slices), so they are
   passed in and default to empty — an eval with no view scores every other term
   correctly and is simply blind to §3.3. Delete the argument when those slices
   land in the engine; nothing else changes.
3. **Sign convention (an ambiguity in the table, now resolved).** Every weight is
   a **positive magnitude**; every term value is signed in `[-1, 1]` where
   positive means "good for me". The table below printing `underdog` as −1.0
   while printing `rival pose` as +1.0 was drift, not a distinction. Terms are
   also **clamped** to `[-1, 1]` — the weight column is the only place tuning
   happens, so no single row is allowed to swamp the sum.

Normalisation worth knowing: `survival` folds lives and Vibe into one fraction
so losing a life always outranks being chipped; `fanMult` and `dbHorizon` are
both multiplied by an **investment horizon** (`1 - fame/fameToWin`) per §3.6 and
§3.2; `perfCliff` is a step at 5, never a slope; `drive`/`sustain` divide by
`stackCapFor()`, never a flat 5.

| Term | Ronin | Intergalactic 0 | Metalness |
|---|---|---|---|
| own Vibe remaining | **1.4** | 1.0 | 0.7 |
| own FP (vs. `fameToWin`) | 1.2 | 1.0 | 1.1 |
| fan multiplier | **1.3** | 0.7 | 0.6 |
| Performance Score ≥5 (step, not slope) | **2.0** | 0.4 | 0.3 |
| Drive Stack quality | 1.1 | 0.6 | **1.3** |
| Sustain Stack quality | 0.7 | **1.2** | 1.0 |
| AP banked at turn end | 0.9 (Bushido) | 0.5 | 0.5 |
| inside own rig radius | 1.0 | **1.6** | 0.8 |
| holding a ⚡ charge | 0.5 | **2.2** | 0.5 |
| rival refill denied | 0.3 | **1.5** | 0.4 |
| adjacency to wounded rival | 0.8 | 0.4 | **1.5** |
| distance from board edge | **1.3** | 0.9 | 0.6 |
| Db banked vs. match remaining | 1.0 | 1.0 | 1.0 |
| rival pose count (threat) | 1.0 | 1.0 | 1.0 |
| **target upside** (was "underdog penalty") | 1.0 | 1.0 | 1.0 |

⚠️ **The last two rows are new terms with no equivalent in `botHexScore` today.**
They are also the two most likely to change observed win rates, because they
correct outright blind spots rather than re-weighting existing sight. Term keys
in code, in table order: `survival`, `fame`, `fanMult`, `perfCliff`, `drive`,
`sustain`, `apBanked`, `inRig`, `charge`, `refillDenied`, `adjWounded`,
`edgeSafety`, `dbHorizon`, `rivalPose`, `targetUpside`.

🔎 **`apBanked` is scored 0 for any Spirit who is not `state.acting`.** Only the
acting Spirit has a live `moveStepsLeft`; for everyone else the value is
*unknowable*, not zero, and guessing it would have the searcher hallucinate
tempo for rivals. Re-read this when the searcher starts scoring opponent replies.

---

## 6. What the searcher needs (build order)

1. ~~**`legalActions(state, spiritId) → action[]`**~~ ✅ **DONE 2026-08-14** —
   `policies/legalActions.js`, pinned by `legalActionsCheck.mjs`
   (`npm run test:legal`). Every current bot function is a *chooser*
   (`botPlanMove` → one hex, `botPlanNoteStep` → one step, `botPickTarget` →
   one target); this returns the branches instead. See §6a for the schema.
2. ~~**`evaluate(state, spiritId)`** — §5.~~ ✅ **DONE** —
   `policies/evaluate.js`. `botHexScore` scores a hex; this scores a position.
   Left deliberately un-wired: nothing calls it yet, because the thing that
   should call it is (1), and hanging it off the existing choosers early would
   bake in the hex-at-a-time framing it exists to replace.
3. **Beam, not full width.** `beamActions(actions, { limit, score })` ships
   alongside `legalActions`. ⚠️ It beams **per kind**, not globally, and that
   detail is load-bearing: with twenty melody notes on offer a global top-5 is
   five melody notes, and the bot silently loses the ability to consider
   attacking at all. Per-kind capping bounds the tree while guaranteeing that
   if a Smash was legal, a Smash is still on the table. Ties keep source order
   rather than relying on sort stability, so the §6.6 determinism regression
   cannot fail intermittently.
   **Still to do:** wire the existing planners in as the `score` function so
   their tuning is preserved — they currently rank nothing, and an unranked
   beam is just "the first 5".
4. **Expectimax / sampled rollouts, not minimax.** Swing is d6, Sonic is
   keep-highest, knockback scatters, events draw. Plain minimax will
   systematically over-value high-variance lines.
5. **Time budget already exists.** `schedule()` / `botStepRef: 'pending'` insert
   cinematic delay per bot step — hundreds of ms of thinking that costs the
   player nothing.
6. **Harness = the test bench.** Now UNBLOCKED — `applyBotAction` is the step
   function it was missing, and `transitionCheck.mjs` section 9 already pins the
   determinism property it depends on. Headless `while (!state.winner)` on seeded rng,
   new bot vs. current bot, ~2000 matches. Bar: **≥60%** or it isn't smarter.
   Plus the determinism regression already patterned in Phase 7c — same seed +
   same state ⇒ identical action sequence.
   ✅ **And its results are now readable as melody evidence** — §6b.1's caveat is
   lifted. The transition prices a long track correctly, so a win rate that moves
   when melody length changes is measuring strategy rather than a blind spot.

---

### 6b. The transition — `applyBotAction`

> ✅ **SHIPPED 2026-08-14** — `policies/transition.js` + `systems/attackParams.js`,
> covered by `transitionCheck.mjs` (`npm run test:transition`).

`legalActions` says what may happen; `evaluate` says how good a position is.
Neither is worth anything without the piece in the middle — a way to actually
TAKE an action and get the next state. `applyBotAction(state, action, ctx) ->
{ state, view, ok, reason, logs }`.

**It owns no rules.** Every kind routes into the existing engine: `applyAction`
(the reducer), `attackParams` (new — the stat derivation), `battleConsequences`
(the ordered aftermath, the same generator the UI drives). Where a rule would
have to be *re-implemented* to make a kind work, the kind is declared
**unmodelled** instead. A transition that quietly invents rules is worse than
one that admits a gap: the gap shows up as a bot that never considers a line,
which is visible; an invented rule shows up as a bot that is confidently wrong,
which is not.

`ok: false` leaves state untouched and names one of two *different* facts:
`'illegal'` (the rules refuse it — a caller feeding straight from `legalActions`
should never see this, and if it does, the two files have drifted) or
`'unmodelled'` (the rules allow it, the engine cannot yet run it headlessly).

**What is not modelled yet — read this before trusting any win rate:**

1. ~~**`confirmMelody` is PARTIAL**~~ ✅ **CLOSED 2026-08-14 — see §6d.**
   `PARTIAL_KINDS` is now `{}`, and that emptiness is a *claim* the checks back:
   `transitionCheck.mjs` §2 asserts the Db actually reaches the sheet, so an
   empty declaration cannot coast on saying nothing. What is left rides
   `melodyCommit.CLIENT_OWNED` and is reported per call.
2. **`smash` / `blaster` are UNMODELLED.** They are not `attackRolled` attacks —
   undefendable, with a long bespoke chain (whole Drive stack spent, stock
   hurled, movement zeroed). ⚠️ Only the **Blaster** runs on `smashOutcome`'s
   throw curve and only the Blaster sets `smashExposed` (on ITSELF — §3.4); the
   Smash is flat and sets nothing. They are one `kind` pair in `legalActions`
   and two different actions underneath, which is the trap to avoid when
   modelling them.
3. **`pose` moves `view.posing` only** — the per-round FP tick and Sustain toll
   are on the client's turn clock.

Everything else — movement, facing, melody notes, stack commits, skill unlocks,
Swing, Sonic, end of turn — is exact.

**`applyBotLine` is ATOMIC**: all of it applies or none of it does. Returning a
partially-advanced state would let a caller score a *truncated* line as the line
it asked for — "walk in, then Smash" scored as "walk in", a position that looks
safe precisely because the dangerous half silently did not happen. Rollback is
free, because engine states are immutable snapshots.

**`ctx.rng` must be a fork** (`rng.fork('search')`) whenever this is called
speculatively — section 0.4. This file cannot enforce that; the caller must.

Two facts the check pinned that are easy to get wrong in a searcher:

- **Walking re-faces you.** `applyMoveStep` spends the AP *and* sets facing down
  the direction of travel. Stepping toward a rival turns your back on whatever
  was behind you, and `isRearHit` reads that on defence.
- **The Smash exposure is consumed by being READ.** `attackParams` is pure and
  cannot clear `smashExposed`, so the transition clears it after the blow that
  read it. Miss that and the rival's armour stays switched off for the rest of
  the match.

### 6c. `attackParams` — and how much of the old preamble is dead

The stat derivation lifted out of `resolveSwing` / `initiateSonicAttack`:
`(state, attackerId, defenderId, kind, view)` -> the `attackRolled` payload.
Pure — it rolls nothing, so every draw still happens inside `applyAttackRolled`
off the seeded stream.

**Most of the modifier tower it looked like it needed is inert, and has been for
a while.** `getBattleSkillMods` returns `halveDef:false, fogActive:false,
pyroBonus:0` — the stage-effect battle buffs were retired when Stage Effects
moved onto the board; the flags survive only so downstream visuals don't crash.
`edgeCombatMods()` returns zeroes — the Dissonance Edge is removed. Those
branches are therefore **not** re-implemented. Reproducing `+ 0` in four places
would imply the systems still exist and invite someone to "fix" the bot by
tuning them. If a stage effect ever bites in battle again, it enters there, once.

`BEAST_DRIVE = 6` is a bare local inside the monolith rather than a gameConstant,
so `attackParams` carries a **transcription** of it. Hoist it when convenient.
Likewise `spiritChord` now exists in **three** byte-identical copies (monolith,
`bot.js`'s `botSpiritChord`, `attackParams`) — the new one is the copy a
headless caller should use; collapse the others when those files are next touched.

### 6d. The commit's economy — `commitMelodyEconomy`

> ✅ **SHIPPED 2026-08-14** — `systems/melodyCommit.js`, covered by
> `melodyCommitCheck.mjs` (`npm run test:melody`, 146 assertions).

§1 says the melody you commit buys your ability to act. The engine only ever
owned the *mechanical* half of that sentence. The economic half — Db, the
Performance Score, the fans, the bank, the riff, the cadence — lived ~600 lines
deep in `confirmNoteTrack`, welded to React setters, and **that asymmetry had a
direction**: a searcher could see that three notes cost less stock than six and
could not see that six notes pay Db, flair and a crowd. It did not make the bot
noisy, it made it *systematically wrong in one direction*, which is the harder
kind to notice from a win rate.

`commitMelodyEconomy(state, spiritId, ctx) -> { patch, effects, hexes, report,
logs, flashLines }`. **Pure — it computes, it does not write.** It returns a note
sheet patch and an ordered effects list; the caller applies them through the
reducer. That is what lets one piece of arithmetic serve three callers that
cannot share a call stack (the client's setters, `applyBotAction`, a server)
without a fourth copy of it.

**Four things worth knowing before touching it:**

1. **⚠️ THE ORDER OF `effects` IS LOAD-BEARING.** The client fires these at
   0ms / 0ms / 500ms / 700ms, and the stagger is not cosmetic: a riff's Fame is
   multiplied by the crowd, so it must see the fans *this* commit won and **not**
   the cadence fans that land after it. Walk the list in order and the arithmetic
   matches the shipped game; reorder it and a riff quietly pays a different
   number of FP, with no symptom until someone asks why.
2. **The mic skill SHADOWS the track.** A passed voice roll appends a note the
   player never placed, and everything downstream scores the shadowed line — Db,
   P, the ending, **and the AP grant**. `transition.js` therefore takes `hexes`
   from the kernel instead of re-deriving `melodyLine.length`; re-deriving it is
   the single easiest way to reintroduce the bug. Draw accounting is pinned: one
   draw on a miss, two on a hit, and **no rng means the mic is skipped**, never
   silently rolled off `Math.random`.
3. **Two of the five declared gaps were never gaps.** `modeDerivation` is B8's
   job and already belonged to `turnFlow.js` — the mode written at commit is a
   placeholder turn start overwrites. `bankedNote` was three lines of overflow
   arithmetic. The real work was `dbPayout`, `perfScore` and `fanGain`. Worth
   recording because it is the reverse of the usual drift: a doc that *over*-stated
   what was missing.
4. **Fans fold sequentially, never sum.** Position → performance → deed, each
   capped in turn, then emitted as one write. Summing the gains first would let a
   single commit vault the casual cap. And a discordant track does not merely pay
   zero — `gainFans` returns before touching `centerStreak`, so it does not even
   advance the promotion clock. That distinction is pinned.

**✅ REWIRED 2026-08-15 — the arithmetic now exists ONCE.** `confirmNoteTrack` is
a UI shell over this kernel: it applies `patch`, walks `effects` in order, and
renders `logs` / `flashLines`. It owns no commit arithmetic. Two further copies
went with it — `checkWaNoKoe` and `applyWaNoKoe` were both defined in the
monolith, putting the rule in three places and the write in two.

⚠️ **The one line to protect is the rng shim.** The kernel asks for `rng.int(n)`;
the client passes `{ int: (n) => drawSeededInt(n) }` so the mic's voice roll
advances the cursor through `randomBatchDrawn` — a LOGGED action the netcode
relays. A bare `makeRng()` there rolls identical numbers off an unlogged stream
and desyncs every replay SILENTLY (§0.4). Pinned by `melodyCommitCheck` §14.

`melodyCommitCheck` §14 was **inverted rather than deleted**: the old drift guard
asked "does the second copy still match?", the new one asks "is there a second
copy?" and fails if any pinned expression returns to the monolith. See
`SEQUENCING.md` §3 for the deliberate behaviour changes the rewire carried.

### 6a. The action schema

`legalActions(state, spiritId, view) → action[]`. Pure, and deliberately
**dumb**: it answers *what is legal*, never *what is good*. Ranking belongs to
`evaluate.js` and narrowing to `beamActions` — a preference smuggled in here
would be invisible to tuning, because the harness only ever sees what survived.

**⚠️ THE TURN HAS TWO PHASES, and that is the whole shape.** `hasConfirmed`
splits it, and the split *is* §1's spine:

| Phase | Gate | Spends | Actions |
|---|---|---|---|
| **Composition** | `!hasConfirmed` | stock | `melodyNote` · `stackCommit` · `confirmMelody` |
| **Action** | `hasConfirmed` | AP | `move` · `face` · `swing` · `sonic` · `smash`/`blaster` · `pose` · `endTurn` |
| *(either)* | Db, not AP | Db | `skillUnlock` |

`confirmMelody` carries `apGranted = min(trackLen, speed)` so a searcher can
price the commit without re-deriving §1.

**Three rules that collapse the branching factor, all easy to search straight past:**

- **⚠️ ONE token, ONE attack.** `actionTokenUsed` is a single token: a turn holds
  at most one Swing **or** Sonic **or** Smash, *ever*. A search that considers
  two attacks in a turn is searching a game that does not exist. Movement is
  **not** the token — you can still walk after attacking.
- **⚠️ `face` is not gated on the token, and this was a real bug caught by the
  check.** Facing looks like pure aiming, but `isRearHit` reads it on
  **defence** — a blow in your rear wedge strips an extra Sustain note. Turning
  to meet a threat with the token already spent is a legitimate play, and
  `botPlanMove`'s `rearFear` term already knew it.
- **The Sonic is OFFLINE outside your own rig radius.** Not weak — *absent*.
  §3.1's worst square, made concrete in the generator.

**Geometry is three different shapes, and "adjacent" is none of them:** Swing
takes the **cone** (forward hex + two diagonals, `CONE_HALF_ARC` imported from
`bot.js` so there is one number to retune); Sonic takes a **straight beam** of 3;
Smash takes the cone; 🌀 Blaster of Ra **replaces** the Smash for Intergalactic 0
with the beam, pierces every rival in line (`targetIds`, a list), and swaps the
fuel bar (2 unused notes, no Drive-stack requirement — that gate is the Smash's).
`smash`/`blaster` carry `endsMovement: true`, because `apCost: 2` understates
"2 AP **and everything after it**".

**What the `view` argument carries** — the same honest pattern as `evaluate`:
`posing`, `amps` (furniture blocks movement), `shadowHex` (👤 the decoy blocks
like a body, or the pathing itself leaks the bluff), `skillById` (SKILL_TREE is
still in the monolith — without it the `skillUnlock` family is *absent* rather
than guessed), `rockGodActive` (PvP is off entirely during the God fight).

**Non-acting Spirits get `[]`.** They have no AP, no token and no turn, and
emitting hypothetical actions for them would let a search invent replies the
rules never offered. ⚠️ This is the first thing that has to change when the
searcher starts scoring opponent replies — as does `evaluate`'s `apBanked`,
which zeroes for the same reason.

---

## 7. Open questions

- ~~Stack cap drift (§1)~~ — **resolved**: `stackCapFor()` is authoritative,
  `DRIVE_SUSTAIN_SPLIT_DESIGN.md` §1 is stale. Fix that doc when convenient.
- ~~Combat note consumption~~ — **verified against the resolver**: Sonic spends
  **1** Drive note hit-or-miss (`sonicSpendN = 1`); Swing spends **2**
  ON HIT ONLY (whiffing no longer burns the stack). Both match the design doc.
  Also found and now priced in §3.4: `smashExposed` zeroes the next defender's
  Sustain, and `swingExposed` costs the *attacker* −1 Sustain until their next
  turn — melee-only, Sonic keeps you safe. The evaluator must charge the Swing
  that self-debuff or it will over-rate melee.
- ~~§3.7's underdog direction~~ — **resolved 2026-08-14**: the doc was inverted,
  `combat.js` wins. Punch up. Guarded by `evalCheck.mjs` §13.
- ~~`confirmMelody`'s economy is the biggest remaining hole~~ — **closed
  2026-08-14**, §6d. The searcher now prices a long melody correctly and §6.6
  win rates are melody evidence again.
- ~~**REWIRE `confirmNoteTrack` ONTO THE KERNEL**~~ — ✅ **DONE 2026-08-15**,
  §6d. The commit economy is in one place. §14 was inverted into a delegation
  guard rather than deleted. 🧭 **The new top item is `SEQUENCING.md` step 2 —
  lock Theory's architecture** (the spine/branch split and the three slot-rung
  renames), because it is Spirit-agnostic, cheap, and constrains every rung
  written after it.
- **🐛 WA NO KOE SILENTLY EATS THE DRIVE BOOST, and the kernel reproduces it.**
  In Game, `applyWaNoKoe` reads `curTemp` off the *render-scoped* `actingNoteState`
  — the PRE-commit value — and writes `curTemp + 1` over the `tempDrive` the
  commit patch just set. So on a turn where the Ronin earns **both** a diatonic
  Drive boost and Wa no Koe, the boost is discarded and he ends on
  `oldTempDrive + 1`. It is reproduced in `melodyCommit.js` on purpose: a kernel
  that quietly plays a *better* game than the client is the same class of failure
  as an invented rule. ✅ **The rewire landed, so this IS now a one-place edit** —
  change `melodyCommit.js`'s Wa no Koe block to read the patch's `newTempDrive`
  instead of `prevTempDrive`, and drop the pin in `melodyCommitCheck` §13. The
  monolith's own `applyWaNoKoe` is gone, so there is nothing left to keep in
  step. (This is the second bug of exactly this shape in this one function —
  B10's `driveStack ?? sustainStack` was the first.)
- **Opponent replies need a second mode.** Both `legalActions` (returns `[]`)
  and `evaluate` (`apBanked` → 0) deliberately refuse to speak for a Spirit who
  is not `state.acting`. That is right for a one-ply generator and wrong for
  expectimax. Decide whether the searcher hands rivals a *hypothetical* turn
  (grant them a melody, then their AP) or scores replies structurally.
- Metalness's missing innate (§4.3) blocks honest cross-Spirit tuning.
- **💥 THE SMASH PUNISHES YOU FOR HAVING A GOOD TURN** (§3.4). Its cost is
  variable — every unused note — and its payout is fixed at 2/2/2, so hurling
  eight notes and hurling one pay the same. It is therefore *worst* exactly when
  you are richest, which is the opposite of a haymaker. ⚠️ Do **not** fix this by
  restoring the `smashOutcome` curve: `gameConstants` records why it was
  flattened ("a numbers puzzle — hoard stock, then dump — rather than a
  decision"), and that reasoning still holds. **The surgical fix is a FIXED fuel
  price** — spend 2 unused notes, the way the Blaster's gate already reads,
  instead of "everything." Keeps "the Smash is your chord, swung" (the Drive
  Stack still goes), keeps the flat payout, removes the wealth tax. One constant
  and two lines.
  The larger lever — an exposure on the TARGET lasting until the smasher's next
  turn, i.e. actually building what §3.4 wrongly claimed — would turn the private
  cost into a private benefit, but **hold it until §6.6 can measure it.** §5's
  weights are explicitly not measurements, and tuning the Smash before anything
  has played 2000 matches is tuning blind.
- **`PERF_CLIFF = 5` now lives in TWO policy files** — `evaluate.js` and
  `melodyCommit.js` (`RONIN_PERF_CLIFF`), because `gameConstants` still holds no
  per-Spirit innate numbers at all. Two copies is the threshold at which this
  stops being a judgement call: **the next innate that needs a number should
  arrive with an innate-constants module**, and take these two with it.
- Legendary riffs paying FP directly is still the open 💬 in `ECONOMY_HANDOFF.md`.
  If it changes, the FP terms in §5 move with it.
- Should search depth be per-Spirit? A deep Intergalactic 0 (denial, long
  horizons) may be far stronger than a deep Metalness (short, greedy lines) at
  identical depth — which would make "depth = difficulty" non-linear across the
  roster, and needs measuring before it is promised in a UI.
