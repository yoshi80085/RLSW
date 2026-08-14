# BOT STRATEGY HANDOFF — 🧠 the cost web, the kits, and what replaces personas

> **For AI editors + Alex.** The decision model a searching bot reads: every
> currency in the game, every place the rules force one choice to be paid for
> with another, and per-Spirit evaluation weights that replace the four generic
> bot personas. Written 2026-08-12. Companion to `CHARACTER_HANDOFF.md` (the
> kits), `ECONOMY_HANDOFF.md` (the currencies), `MULTIPLAYER_HANDOFF.md` §5e
> (bot policies), and `ARCHITECTURE.md` (the STICs + Earned lenses).
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
**Verdict:** it is a *defence-breaker*, not a finisher — it aims at their
armour, not their health. Correct use is setup for the next attacker (or your
own next turn) and edge-of-stage knockouts. ⚠️ Evaluating it on the 2 Vibe
alone will make the bot refuse it forever. The real payload is two-part: the 2
stripped Sustain notes downgrade the rival's whole chord shape, **and it sets
`smashExposed` — the next blow to land on them ignores their Sustain entirely**
(`defChordSustain = 0`, then clears). A Smash immediately followed by any hit
is the highest-damage sequence available to a bot that can see two plies.

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

1. **`legalActions(state, spiritId) → action[]`** — does not exist. Every
   current bot function is a *chooser* (`botPlanMove` → one hex,
   `botPlanNoteStep` → one step, `botPickTarget` → one target). This is the
   bulk of the work.
2. ~~**`evaluate(state, spiritId)`** — §5.~~ ✅ **DONE** —
   `policies/evaluate.js`. `botHexScore` scores a hex; this scores a position.
   Left deliberately un-wired: nothing calls it yet, because the thing that
   should call it is (1), and hanging it off the existing choosers early would
   bake in the hex-at-a-time framing it exists to replace.
3. **Beam, not full width.** Keep the existing planners as *candidate
   generators*: have each return its top 3–5 instead of top 1 and search only
   that. Preserves everything already tuned, keeps branching sane, degrades
   gracefully. Note-track construction is combinatorial and will blow up a
   naive tree — it must be beamed.
4. **Expectimax / sampled rollouts, not minimax.** Swing is d6, Sonic is
   keep-highest, knockback scatters, events draw. Plain minimax will
   systematically over-value high-variance lines.
5. **Time budget already exists.** `schedule()` / `botStepRef: 'pending'` insert
   cinematic delay per bot step — hundreds of ms of thinking that costs the
   player nothing.
6. **Harness = the test bench.** Headless `while (!state.winner)` on seeded rng,
   new bot vs. current bot, ~2000 matches. Bar: **≥60%** or it isn't smarter.
   Plus the determinism regression already patterned in Phase 7c — same seed +
   same state ⇒ identical action sequence.

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
- Metalness's missing innate (§4.3) blocks honest cross-Spirit tuning.
- **`PERF_CLIFF = 5` lives in `evaluate.js`, not `gameConstants.js`** — because
  `gameConstants` holds no per-Spirit innate numbers at all today. If a second
  innate ever needs a threshold, that is the moment to give innates their own
  constants module rather than scattering them through the policies.
- Legendary riffs paying FP directly is still the open 💬 in `ECONOMY_HANDOFF.md`.
  If it changes, the FP terms in §5 move with it.
- Should search depth be per-Spirit? A deep Intergalactic 0 (denial, long
  horizons) may be far stronger than a deep Metalness (short, greedy lines) at
  identical depth — which would make "depth = difficulty" non-linear across the
  roster, and needs measuring before it is promised in a UI.
