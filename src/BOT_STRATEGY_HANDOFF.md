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
| ~~adjacency to wounded rival~~ 🪦 **CUT 2026-08-17** | ~~0.8~~ | ~~0.4~~ | ~~1.5~~ |
| distance from board edge | **1.3** | 0.9 | 0.6 |
| Db banked vs. match remaining | 1.0 | 1.0 | 1.0 |
| rival pose count (threat) | 1.0 | 1.0 | 1.0 |
| **target upside** (was "underdog penalty") | 1.0 | 1.0 | 1.0 |
| 🎓 **kit** — Db converted into capability (NEW) | 1.6 | 1.6 | 1.6 |
| 💢 **pressure** — how close the rivals are to finished (NEW) | 1.2 | 0.6 | **1.8** |

⚠️ **The last two rows are new terms with no equivalent in `botHexScore` today.**
They are also the two most likely to change observed win rates, because they
correct outright blind spots rather than re-weighting existing sight. Term keys
in code, in table order: `survival`, `fame`, `fanMult`, `perfCliff`, `drive`,
`sustain`, `apBanked`, `inRig`, `charge`, `refillDenied`, `edgeSafety`,
`dbHorizon`, `rivalPose`, `targetUpside`, `kit`, `pressure`.

💢 **`pressure` is NEW (2026-08-17) and it is the mirror `survival` never had.**
Rival lives and Vibe missing, averaged across the field, with the Vibe half
reach-weighted and the LIVES half not. Full write-up in §6.6.0; the two-line
version is that nothing in this table used to say hitting somebody was good, so
nobody ever did. Its three weights are the answer to "how much does this
character value hurting someone", which is most of what a personality is:
Metalness highest at 1.8, Intergalactic 0 lowest at 0.6 because denial is his win
path rather than damage, the Ronin between them at 1.2. **Starting points, like
every number in this table.**

🪦 **`adjWounded` was CUT the same day, and it was not a re-weighting either.**
It scored `max` over ADJACENT rivals of the fraction of Vibe they were missing —
which is exactly `pressure`'s Vibe half, hard-gated at distance 1 instead of
decayed. Keeping both priced chip damage twice, and the duplicate was the copy
that pointed backwards: it paid for **standing next to** someone bleeding, so
finishing them destroyed the payment. Measured — a rival on 1/4 Vibe beside the
Ronin was worth +0.600, and the blow that took their life dropped it to 0 because
they respawn at home across the board. Metalness held the highest weight at 1.5,
so the bruiser was the roster's *most* reluctant finisher. His character did not
go anywhere; it moved into `pressure` 1.8, where it survives being acted on.

🎓 **`kit` is NEW (2026-08-16) and it is not a re-weighting, it is a missing
half.** Without it `dbHorizon` scored the pool in one state only — banked — so
spending was a pure loss and the searcher refused every purchase in the game.
See §6.6.1. Its 1.6 is a starting point like every other number in this table;
the difference is that there is finally a harness to settle it with.

⚠️ **`dbHorizon`'s denominator was also wrong** and is corrected in the same
pass: it divided by `DB_UPGRADE_THRESHOLD` (4), the *fallback* cost when no
skill is targeted, so it saturated at 4 against skills that cost 6–16. It now
divides by the cost of the skill you are actually saving for.

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
3. ~~**Beam, not full width.**~~ ✅ **DONE 2026-08-16** — `beamActions` +
   `policies/actionScore.js`, pinned by `actionScoreCheck.mjs`
   (`npm run test:score`, 100 assertions). ⚠️ It beams **per kind**, not
   globally, and that detail is load-bearing: with twenty melody notes on offer
   a global top-5 is five melody notes, and the bot silently loses the ability
   to consider attacking at all. Per-kind capping bounds the tree while
   guaranteeing that if a Smash was legal, a Smash is still on the table. Ties
   keep source order rather than relying on sort stability, so the §6.6
   determinism regression cannot fail intermittently.

   ~~Still to do: wire the existing planners in as the `score` function.~~
   **Wired — and "wired" means CALLED, not re-derived.** Every ranking in
   `actionScore.js` delegates to a shipped planner: `move`/`face` →
   `botHexScore`, attack targets → `botPickTarget`'s comparator, `melodyNote`
   → `botPlanNoteStep`'s preference, `stackCommit` → `botPlanStackCommit`'s
   plan, `skillUnlock` → `botPickSkillTarget`'s order. Three of those were
   choosers that built a full ordering and then threw away everything but the
   head (§6.1: *"a chooser cannot be searched"*); they are now rankers in
   `bot.js` with the chooser kept as the head, so there is **one comparator per
   decision rather than two copies to keep in step**. The check's load-bearing
   assertions all have one shape: *the top-scored action of a kind is the one
   the old chooser would have chosen.*

   ⚠️ **THE SCORES ARE ONLY EVER COMPARED WITHIN A KIND**, because the beam
   groups by kind before it ranks. Nothing is calibrated across groups and no
   attempt was made — a `move` scoring 41 against a `swing` scoring 3 says
   nothing about whether to walk or hit. That question is `evaluate`'s, on the
   resulting positions. A **constant is the correct score** for a kind that
   emits at most one action (`confirmMelody`, `slime`, `slide`, `eleven`,
   `pose`, `endTurn`): zero there means *nothing to rank*, not *worthless*, and
   nothing is ever dropped from a group of one.

   ⚠️ **RANKING IS NOT A VETO, and this is the boundary to defend.** Scoring
   an action zero leaves it legal. A scorer that floored an option class to keep
   it out of the beam would be smuggling a rule into the one place tuning cannot
   see it — exactly the failure §6a's *"deliberately dumb"* rule exists to
   prevent, one file downstream. Unranked actions therefore share a single
   floor value, so the index tie-break leaves them in **source order** instead
   of half-sorting them by a preference nobody wrote down.

   🐙 **The Tentacle is what forced this, and it is the regression to keep.**
   `legalActions` emits every (rival × trail-origin) pair, so branch count now
   scales with the BOARD rather than the roster. The scorer ranks WHO you hit
   strictly above HOW MUCH ROAD IT COSTS — `rank * TENTACLE_RANK_STRIDE - reach`
   — so reach only ever separates two ways of reaching the *same* rival, and the
   cheaper one wins because the surviving road is the Slam's fuel and the next
   Slide's floor (`METALNESS_REWORK_DESIGN.md` §3's one meter). The doc's
   counter-case — *"the longer reach is sometimes the better play, because it
   strikes from a different angle"* — is real and shows up as a **different
   target set**, which the rank term already separates.
4. **Expectimax / sampled rollouts, not minimax.** Swing is d6, Sonic is
   keep-highest, knockback scatters, events draw. Plain minimax will
   systematically over-value high-variance lines.
5. **Time budget already exists.** `schedule()` / `botStepRef: 'pending'` insert
   cinematic delay per bot step — hundreds of ms of thinking that costs the
   player nothing.
6. ~~**Harness = the test bench.**~~ ✅ **DONE 2026-08-16** —
   `policies/play.js`, pinned by `harnessCheck.mjs` (`npm run test:harness`,
   **1974** assertions), driven by `npm run bench:bot`.

   📌 **That count read 2003 until 2026-08-17 and the drop is not lost coverage.**
   Most of `harnessCheck` asserts per ACTION inside `for (const a of turn.actions)`,
   so its total is a function of how long the sampled matches run. Once the bot
   could fight, those matches got shorter and more decisive (mean 167 turns
   against a 400 cap) and the loop ran fewer times. ⚠️ Worth stating because the
   general rule cuts the other way: **a falling assertion count is normally a
   coverage regression and should be explained, not waved through** — this one is
   explained by the match length moving, and if it drops again without the match
   length moving, that is a real loss.

   **Result: 65.7% over 303 decided matches (±5.3 points, 95%). Bar is ≥60% —
   cleared.** 480 matches with unlocks live, seats swapped every other match.
   Floor check: the same searcher beats uniform-legal play 89%.

   📌 **An earlier run on BASE KITS read 70.7% ±2.1 over 1749 decided matches**,
   before `SKILL_TREE` was extracted. Both numbers are kept because the gap
   between them is itself the finding: turning unlocks on narrowed the margin
   AND pushed the inconclusive rate from 12.6% to **37%**. Longer, grindier
   games — a roster with rigs and Theory rungs is harder to finish inside the
   400-turn cap. ⚠️ **37% inconclusive makes this the weaker number of the two**,
   and the honest next move is a longer cap or a shorter Fame target rather than
   more matches: more samples of a truncated game measure the cap.

   ⚠️ **BOTH NUMBERS ARE SUPERSEDED — 2026-08-17. Neither measured a game with
   fighting in it** (§6.6.0), and neither charged an attacker for attacking
   (§6.6.2). **The current reading is 56.3% ±4.5 over 469 decided matches**, from
   520 played, with `pressure` in, `adjWounded` cut and attack costs applied.

   🎯 **THAT IS BELOW THE ≥60% BAR, and it should not be explained away.** Two
   readings, and they are not exclusive:

   1. **The old numbers were computed on a biased subsample and read as though
      they were not.** `runBench` correctly excludes inconclusive matches from
      the rate — but when 37% of matches were excluded, the survivors were not a
      random 63%. A match resolved when somebody ran away with the Fame race,
      which is precisely the situation a stronger searcher creates. Dropping the
      stalls dropped the hard cases. Now that **9.8%** stall instead of 37%, the
      rate is computed over very nearly the whole population and the edge looks
      smaller because more of the difficult games are finally in it. If this is
      the whole story, 56.3% is not a regression — it is the first honest
      measurement, and the bar was set against a number that never meant what it
      appeared to.
   2. **Or the new weights are simply not tuned.** `pressure`'s three values are
      starting points that have now had exactly one bench run pointed at them,
      and §5's standing warning applies with full force.

   ⚠️ **Do not resolve this by tuning `pressure` until the two are separated.**
   The clean experiment is an A/B at fixed seeds with `pressure` at weight 0 —
   same attack costs, same everything else — which isolates what the term did
   from what the cost fix did. Reading (1) predicts the inconclusive rate stays
   near 10% and the win rate barely moves; reading (2) predicts it moves.

   📌 **And the bot is still very attack-shy.** A 12-match duel sample logs
   11,639 melody notes, 8,125 moves and **24 swings** — 2 per match, 0.012 per
   turn — with **zero Sonics ever chosen**, even though an isolated probe scores
   the Sonic ABOVE every alternative at a 4-note stack. Going from literally zero
   attacks to a handful of decisive ones was enough to make matches end (12/12
   decided, mean 167 turns). It is not enough to call combat solved, and the
   never-fired Sonic is the more suspicious half of it.

   ⚠️ **THE BASELINE IS `unranked`, NOT THE SHIPPED BOT, AND THAT IS A CHOICE.**
   The current bot is a React step-machine (`botStepRef`, `schedule()`,
   `setTimeout`, a dozen closure-scoped helpers) and cannot be lifted out
   headlessly. Re-implementing it as a baseline would create a THIRD copy of the
   bot's judgement to keep in step — the exact failure the chooser→ranker
   promotion in §6.3 was done to avoid, committed one layer up and with 2000
   matches of authority behind it. So the bench compares **the same searcher
   with the beam's `score` on versus off**, which isolates the one variable
   §6.3 changed instead of confounding ranking with search, phase order, and a
   re-implementation's own bugs. 📌 A faithful `legacy` policy gets cheap the
   day the step-machine leaves the monolith; the seat is left open in `POLICIES`
   and deliberately **not** stubbed, because a stub called `legacy` would be
   cited as "the current bot" by the first person to read a table without
   reading the file.

   ⚠️ **AND READ `HARNESS_GAPS` BEFORE QUOTING THE NUMBER.** ~~Base kits~~ ✅
   unlocks are live as of the SKILL_TREE extraction. What remains: no Smash and
   no Blaster (both UNMODELLED in `transition.js`), which means §7's "the Smash
   punishes you for having a good turn" still **cannot** be measured here —
   unfortunate, since §7 explicitly wants to hold that fix until §6.6 can measure
   it. `applySkillEffects` is still client-owned, so a skill's unlock-moment side
   effects do not fire (passive skills read off the sheet are fully live).
   Short games (2 lives) to sidestep the Rock God finale, which shortens the
   horizon and therefore under-rates the investment terms in §3.2 and §3.6.
   Client fan hooks absent.

   ✅ §6b.1's caveat stays lifted at the transition layer — but see below for
   where it came back.

### 6.6.0 ✅ RESOLVED 2026-08-17 — the evaluator can see a fight now

> **The diagnosis below was right and its evidence was wrong in two places.**
> Both corrections are marked 🩹 inline; read them before quoting any number
> from this section. The fix shipped the same day: `pressure` (§5) plus the
> attack-cost bug in §6.6.2. **Inconclusive matches fell from 37% to 9.8%** over
> 520 fresh matches, and a 12-match duel sample that previously logged ZERO
> attacks now decides 12 out of 12, mean 167 turns.

**Found 2026-08-17, and it invalidated the win rates in §6.6 as balance evidence.**

`evaluate` HAS NO TERM FOR HARMING A RIVAL. Read the §5 table again with that in
mind: twelve of the sixteen terms describe your OWN position, and the only four
that look outward are `adjWounded` (requires them to be hurt ALREADY),
`targetUpside` (requires a Fame deficit), `refillDenied` (Gravity Control's note
drain) and `rivalPose` (a threat to fear). **Rival Vibe appears nowhere.** Not as
a term, not inside another term.

So a bot maximising this score cannot see that hitting somebody is good, while it
sees the costs of hitting them.

🩹 **CORRECTION 1 — it did not see "every cost… perfectly well".** It saw the AP
and nothing else. The two Drive notes and `swingExposed` were **never applied in
the headless path at all** — every bench Swing was free. See §6.6.2. The
sentence was true of the game and false of the engine, which is the whole
recurring problem in one line.

Measured, with the Ronin standing adjacent to Intergalactic 0, facing him,
holding a legal Swing:

```
base            5.1350
  face         -0.1800   ← chosen
  move         -0.5050
  sonic        -0.5000
  swing        -0.6450   ← 🩹 NOT a hit. See below.
  endTurn      -0.9000
```

🩹 **CORRECTION 2 — THAT SWING MISSED.** The row was labelled "lands, takes the
rival 5 Vibe → 4". Re-running the identical fixture reproduces `−0.6450` exactly
and **the rival's Vibe never moves**: it is a whiff, plus the defender's counter
(−1 Vibe on the attacker) and the knockback that follows it. A swing that
actually connects scores **−0.1212**, and it is not the worst option on the
board — it beats `move`, `sonic` and `endTurn`. Worth recording as its own
lesson: the sample was chosen by one rng seed and read as though the label were
data. **A single sample of a dice game is an anecdote.** The honest shape is a
distribution — swept across Drive stack size, the Swing's hit rate runs 17.8% on
one note to 100% on eight, so "should I attack" was never one question.

🩹 **And damage was never worth literally nothing** — it pays through `fame`
(+0.063 × 1.2 = **+0.075** on a landing blow). The claim to keep is the weaker
and still-decisive one: the reward was far too small to cover the AP, and no term
grew as a rival got closer to being finished.

**Every option is a loss, and the attack is nearly the worst one.** The bot
shuffles and re-faces until its AP is gone, ends turn, repeats. Over 120 turns of
a duel: 688 melody notes, 508 moves, 120 commits — and **zero attacks of any
kind**. Two healthy, level Spirits have no reason to ever fight, so the match
cannot end, so it runs to the 400-turn cap.

⚠️ **THIS IS WHERE THE 37% INCONCLUSIVE RATE CAME FROM**, and §6.6's earlier
guess — that it was telling us something about the Fame economy — was WRONG.
Alex flagged it immediately from play experience ("I've played games that come to
an end"), which is worth recording: the human who plays the game spotted in one
sentence what a 2000-match bench reported as a number.

📌 **What this does and does not invalidate.** The searcher-vs-unranked comparison
is still a fair A/B — both sides were equally blind — so §6.3's ranking work
stands. What is worthless until this is fixed is any reading about the ROSTER, the
kits, or the pacing, because no bench match has ever contained a fight.

🔧 ✅ **THE FIX SHIPPED — `pressure`, and it is a term, not a rescue.** Rival lives
and Vibe missing, averaged across the field, as the mirror of `survival`.

⚠️ **The one design point worth carrying forward: LIVES ARE NOT REACH-WEIGHTED
AND CHIP VIBE IS.** They are different kinds of progress and collapsing them
re-creates the bug in a new place. A life taken is BANKED — it survives the
respawn and cannot be walked away from — whereas chip Vibe heals, resets on
respawn, and is only worth anything if you are close enough to convert it. Decay
the life by distance and finishing a rival scores WORSE than leaving them
bleeding beside you, because they respawn at home across the board. The reach
term is also a **floor (0.35), not a cutoff**: at zero, the score is flat
everywhere outside melee, there is no gradient pointing at the wounded one, and
the bot never walks over to finish the job.

📌 `adjWounded` was cut in the same pass — it was this term's Vibe half with a
cliff instead of a floor, and it inverted. See §5.
⚠️ It is a §5 DESIGN decision (how much should a character value hurting someone?
that answer differs per Spirit and is most of what "aggressive" means), so it
wants a deliberate pass, not a patch. Note that `adjWounded` at 1.5 for Metalness
already assumed this term existed underneath it: "finish the wounded" only reads
as a bruiser trait if "hurt people" is scored at all. ✅ It does now, and
`adjWounded` is gone — his 1.5 became `pressure` 1.8.

---

### 6.6.2 🐛 IN THE BENCH, ATTACKING WAS FREE — the fourth gate bug, and the quietest

**Found and fixed 2026-08-17, while trying to size `pressure`'s weight.** It is
the same shape as the three in §6.6.1 and it is worth its own section because of
*how* it hid.

`applyBotAction` never spent the Swing's 2 Drive notes, never set `swingExposed`,
and never spent the Sonic's 1 note. Every headless attack in every bench match
ever run was **free**: no ammunition, no dropped guard.

⚠️ **THE DEFAULT SWALLOWED THE EVIDENCE, and that is the transferable lesson.**
The client's `resolveSwing` computes `swingChordLeft` / `swingChordSpent` and
hangs them on its own React battle object; `battleConsequences` — the *shared*
generator both paths drive — destructures them as:

```js
const { …, swingChordLeft = [], swingChordSpent = [] } = battle;
```

The engine's `attackRolled` action carried a **whitelist** of fields and those
two were not on it, so `state.battle` never had them, so the generator burned
nothing, **logged nothing, and threw nothing.** A defaulted destructure cannot
tell *"this Spirit has no notes left to spend"* from *"nobody told me what to
spend"*. Both read as `[]`. This is the over-permissive failure of §6a arriving
through a language feature rather than a missing `if`.

📌 **It also means one sentence in §6b was false for as long as it has been
there:** "movement, facing, melody notes, stack commits, skill unlocks, Swing,
Sonic, end of turn — everything else is exact." The mechanics were exact. The
*prices* were not, and nothing asserted them, which is exactly how §6.6.1's
`skillUnlock` fiction survived. **A claim with no assertion behind it is a wish.**
`transitionCheck` §8a is now that assertion.

**The two kinds pay differently, and the difference is the rule:**

| | spends | when | drops guard |
|---|---|---|---|
| **Swing** | 2 Drive notes | **on a hit only** — whiffing keeps the stack | ✅ `swingExposed`, hit or miss |
| **Sonic** | 1 Drive note | **hit or miss** — the note left the rig | ❌ range is the point of it |

⚠️ The Sonic's spend is applied **after** `attackParams` derives the chord and
**before** the roll. Pay it earlier and the beam fires weaker than the one the
player throws.

⚠️ **And it changed the balance reading in the direction you would expect.** With
attacks free, a loaded Swing already scored better than shuffling; priced
correctly it costs `drive −0.27` at a 4-note stack, which is what makes
`pressure`'s weight a real trade rather than a free bonus. Sizing the term
against the unpriced version would have produced a bot that brawls constantly and
a bench number about a game nobody plays.

---

### 6.6.1 What the harness found

All three were invisible to every existing suite — one of them was actively
PINNED WRONG by a passing test — which is the argument for the instrument in a
paragraph.

- **🐛 `legalActions` OFFERED 🧪 SLIME TO EVERY SPIRIT.** The call was gated on
  AP and on `turn.slimingId` and on nothing else. No player could ever reach it
  — the button sits behind `acting?.id === 'Metalness_Monster'` in the JSX — so
  the rule lived in a *render condition*, this file had nothing to transcribe
  from, and the missing gate read as the deliberate absence of an
  `unlockedSkills` check. **Innate means no PURCHASE, not no OWNER.** The first
  headless match had the Ronin calling the ooze, laying road and sliding on it.
  That is exactly the over-permissiveness §6a calls the dangerous failure.
  Fixed: ownership now lives in `canCallSlime` beside the rest of the trail
  rules, pinned by `slimeCheck` §13 (the rule) and `harnessCheck` §3 (that no
  path through a real match reaches around it).

- **🐛 A ONE-PLY GREEDY CONFIRMS A ONE-NOTE MELODY, EVERY TURN.** Adding a note
  to the track moves no term in `evaluate`, while `confirmMelody` immediately
  raises `apBanked` — so greedy scores "confirm now" above "write more music",
  forever, and the whole commit economy (Db, Performance Score, fans, the riff)
  is skipped for 1 AP. 📌 **This is §6b.1's caveat re-appearing one layer up.**
  That caveat was about the TRANSITION being blind to the commit's economy and
  it is genuinely closed; what this found is that a one-ply POLICY cannot see
  that price no matter how correct the transition is, because the payoff lands
  entirely on one action and greedy compares one action at a time. Same blind
  spot, different organ. Fixed by searching the composition phase as a **line**:
  the scorer picks *which* note (the planners' musical judgement, per §6.3) and
  `evaluate` picks *how many*, by pricing each candidate track at its own
  confirm — never mid-track, since scoring a truncated composition compares
  "three notes written" against "one note written and cashed".

- **🐛 `skillUnlock` MODELLED A MECHANIC THIS GAME DOES NOT HAVE.** `legalActions`
  emitted `{ kind: 'skillUnlock', skillId, dbCost }` gated on
  `dbPoints >= dbCost`, and `transition.js` paid for it by subtracting the cost
  and pushing the id into `unlockedSkills`. **A shop.** There is no shop. The
  shipped flow, spelled out in the monolith: you pick a **target** skill, every
  Db earned counts toward it, and the award fires **automatically inside
  `commitMelodyEconomy`** when the bar fills. So the only decision is choosing
  what to save for, it costs nothing, and it is offered only while you have no
  target.

  ⚠️ **This is `transition.js`'s own nightmare, living inside `transition.js`.**
  Its header says an invented rule "shows up as a bot that is confidently wrong,
  which is not visible", and that is exactly what happened — for as long as
  nobody could pass a real tree, nothing could contradict it.
  📌 **And §15 of `legalActionsCheck` PASSED against it**, every assertion,
  pinning affordability gates on a mechanic that does not exist. A green test is
  not evidence that a rule is real; it is evidence that two files agree.
  Rewritten as `skillTarget` — free, not price-gated (saving toward what you
  cannot yet afford *is* §3.2), one target at a time.

- **🐛 THE EVALUATOR COULD NEVER BUY ANYTHING, and two things were wrong at once.**
  §5's table scored Db BANKED (`dbHorizon`) and had no term at all for what the
  Db bought, so every purchase was a pure loss and a greedy searcher refused all
  of them forever. Added `kit` — Db **converted into capability**, measured in Db
  invested so it is the exact mirror of `dbHorizon` (one pool, two states) and a
  12 Db capstone does not score like a 6 Db rung, multiplied by the same
  investment horizon because §3.2's verdict is that a capstone bought at 20/24
  never pays for itself.

  And `dbHorizon` divided by `DB_UPGRADE_THRESHOLD` (**4**), which is the
  *fallback* cost used when no skill is targeted — not a ceiling on banking.
  Skills cost 6–16, so the term saturated at 4 and scored 4 Db and 16 Db as
  identically good: §3.2's "saving toward a capstone", the sharpest tension in
  the game, flattened to nothing. It now divides by what you are actually saving
  for, the way `melodyCommit.js` and the client already did.
  ⚠️ **`kit`'s weight (1.6) is a starting point, not a measurement** — §5's
  standing warning applies, and §6.6 is now the tool that can settle it.

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

Everything else — movement, facing, melody notes, stack commits, skill targets,
Swing, Sonic, end of turn — is exact.

⚠️ **THIS SENTENCE WAS FALSE FOR THE ATTACKS UNTIL 2026-08-17 AND NOTHING CAUGHT
IT.** The Swing's 2 Drive notes, the Sonic's 1, and `swingExposed` were all
missing from this path — the mechanics resolved exactly and the *prices* were
never charged. §6.6.2 has the write-up. What made it survivable was that no
assertion existed for any of it, so "exact" was a claim this file made about
itself. `transitionCheck` §8a now pins all three, and the general rule is worth
stating: **when this doc says a kind is exact, there should be a check named
beside it.**

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
