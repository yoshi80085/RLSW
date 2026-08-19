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

   ✅ **THE A/B RAN, 2026-08-17. `--weights='{"pressure":0}'`, same 520 seeds,
   same attack costs.** Reading (1) is right about most of it and is not the
   whole story. Three runs, and the shape is the finding:

   | run | inconclusive | decided-only rate | draw-inclusive rate |
   |---|---|---|---|
   | free attacks, no pressure | 36.9% | 65.7% | 59.9% |
   | costed attacks, no pressure | **49.2%** | **84.5%** | 67.5% |
   | costed attacks, `pressure` ON | **9.8%** | **56.3%** | 55.7% |

   ⚠️ **THE HEADLINE RATE IS LARGELY A FUNCTION OF THE EXCLUSION RATE, and that
   invalidates the ≥60% bar as written.** Read the middle two columns together:
   they move in lockstep across three independent runs. Excluding stalls is the
   right call for honesty — a timeout is not a loss — but the survivors are not a
   random sample. **A match resolves when somebody runs away with the Fame race,
   which is the situation a stronger searcher creates**, so throwing away the
   stalls throws away the hard games. At 49.2% exclusion the searcher "wins
   84.5%"; the same searcher over nearly the whole population wins 56.3%. It did
   not get worse by 28 points. The statistic was measuring its own filter.

   📌 **`pressure` — not the cost fix — is what makes matches end.** Costs alone
   made stalling *worse* (36.9% → 49.2%), which is exactly right: attacking got
   more expensive and no more attractive. The term reversed it to 9.8%.

   ⚠️ **BUT A REAL RESIDUAL SURVIVES, so do not close this.** The last column
   scores a stall as half a win, which makes the three runs comparable over the
   same denominator. On that basis the gap shrinks from 28.2 points to **11.8**
   — so exclusion bias explains roughly 60% of it and something real explains the
   rest. ⚠️ That column is a BOUND, not a measurement: it assumes stalls are
   50/50, and in the no-pressure runs stalls are half the sample.

   🧭 **The residual's likeliest cause is match LENGTH, not weights.** Mean match
   length falls from **331 turns to 209** when the term goes in. A shorter game
   gives a stronger policy less room to compound an edge, and the games now end
   through combat — dice — rather than through Fame accumulation. Both push a
   skill edge toward 50%. That is a property of measuring a game that finishes,
   not a defect in the searcher.

   🎯 **What this changes: the bar, before the weights.** "≥60% over decided
   matches" cannot gate anything while it rises with the stall rate — under it,
   the WORST configuration here (49.2% stalls) scores best. Restate it on the
   draw-inclusive basis, or split it into two gates: a win rate AND a maximum
   inconclusive rate. ⚠️ Only then is a `pressure` retune worth running, because
   only then does the number it is tuned against mean something.

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

### 6.6.13 ✅ 2026-08-18 (night) — THE JOURNAL, AND WHAT IT SAID THE FIRST TIME IT RAN

#### The ask

Alex: *"Is there a way to hook up the Computer players to a feedback system that
can be reviewed after every game?"*

Yes, and it was nearly free, because the searcher already computes the answer and
throws it away. `searcherPolicy` prices every action that survives the beam and
keeps one. A `trace` sink keeps the rest.

#### ✅ WHAT SHIPPED

- **`policies/botJournal.js`** — the entry shapes and `journalSummary(entries)`,
  pure. In the ENGINE rather than the .jsx on purpose: a summary that only exists
  inside the client cannot be tested and cannot be run over a bench.
- **`trace` and `audit` on `searcherPolicy`** — one plain object per decision. The
  action phase reports what was legal, what the beam kept, what each kept option
  scored, and what it chose. The composition phase reports THE CURVE: what each
  track LENGTH was worth, which is §6.3's argument made visible.
- 🎯 **`audit`** — also price the options the beam THREW AWAY. On in the client,
  off in the bench: it costs a second sampling pass, which is a real tax on 300
  headless matches and free in a game that spends 520ms a tick on animation.
- **`ui/BotReview.jsx` + the 🧠 REVIEW button** — the summary, the never-played
  sweep, and the decision list, with a JSON download.
- **`npm run test:trace`** — 1435 assertions, and the first one is the only one
  that really matters (below). Plus `.scratch/journal.mjs`, the same summary over
  a bench run.

⚠️ **THE ENGINE NEVER READS A CLOCK.** A search that timed itself would make the
determinism regression flicker. The client stamps the duration on the first entry
of each call and zero on the rest — one call can emit a composition entry AND an
action entry, and splitting the time between them would be inventing a
measurement nobody took.

#### 📏 THE ASSERTION THE WHOLE THING RESTS ON

A journal that changes the game it is journalling is worse than no journal: every
reading taken through it would describe a bot nobody plays against. So
`botTraceCheck` §1 plays the same seed four ways — untraced, traced, and traced
with the audit on — and pins that the winner, the turn count, the Fame, the duel
ledger AND **the full list of chosen actions** are identical. The audit is safe
for the same reason the search is: `expectedScore` runs on forks, and a fork
consumes nothing from the stream it came from.

#### 🎯 AND IT FOUND SOMETHING ON THE FIRST RUN

12 matches, three pairings, audit on — 2,218 decisions:

| seat | decisions | mean pruned | close calls | 🎯 beam cost the position | ⚠️ legal and NEVER played |
|---|---|---|---|---|---|
| Shredding Ronin | 913 | 1.0 | 523/771 (68%) | 4× (1.2 pts) | — |
| Intergalactic 0 | 403 | 2.1 | 184/325 (57%) | 6× (0.4 pts) | — |
| **Metalness Monster** | 902 | 2.0 | 607/768 (79%) | 5× (4.0 pts) | 🔊 **`eleven` — legal 263×, chosen 0×** |

🐛 **#15: GOES TO ELEVEN HAS NEVER BEEN PLAYED.** It was legal on 263 separate
decisions across twelve matches and the searcher took it **not once** — while
happily choosing `slime` 122 times and `slide` 42 times from the same kit. It is
the centrepiece of `METALNESS_REWORK_DESIGN.md` §0 — armour into volume, the one
rule that finally reads his Sustain stat — and by §5.A's predictor the diagnosis
writes itself: **`evaluate` has no term for being loud.** `atEleven` appears in no
row of the weight table, so the searcher can see the Sustain stack leave and
cannot see anything arrive. Same shape as `kit` before §6.6.6, one ability over.

🎯 **AND A PARTIAL ANSWER TO §5.E⁗ ITEM 1, FROM THE AUDIT.** Across ~1,860 action
decisions the beam threw away a better option **15 times, worth 5.6 points in
total.** So the ranking's ~42% two-gate result is **not** explained by bad
pruning — the beam is keeping the right options and something downstream of it is
losing the game. That eliminates the cheaper of the two hypotheses in §5.E⁗
item 1 and leaves the expensive one: the evaluator is confidently wrong about a
class of position, and ranking by it just arrives there faster.

📌 **Two more readings worth arguing about, neither of them settled:**
- **`face` is the most-chosen action in the game** — 349 of the Ronin's 913
  decisions and 250 of Metalness's 902. The bots spend most of their turns turning
  around. It may be correct (facing is 1 AP, not gated on the token, and matters on
  defence) or it may be `evaluate` finding a cheap way to bank a small positional
  gain. Nobody has looked.
- **57–79% of decisions are "close calls"** at `JOURNAL_CLOSE_GAP` = 0.25. Either
  the threshold is far too generous, or most turns genuinely are coin-flips
  between the top two options — and a bot whose every turn is a coin flip is not
  being steered by the weight column it was given. ⚠️ The constant is a starting
  point and is labelled as one; do not quote that percentage until it has been
  argued with.

### 6.6.12 ✅ 2026-08-18 (night) — THE SEARCHER IS IN THE CHAIR

#### 🎯 THE FINDING, AND IT IS THE OLDEST ONE ON THE LIST

Alex: *"I think a med student can study all the science behind health and the body
all she wants, but until she gets put in the situation where the tools become
necessary all it is is theory."*

Grepping the client for what it imports from `policies/`:

| imported by `rlsw-simulator-v3_8_1.jsx` | not imported |
|---|---|
| `bot.js` (18 symbols), `legalActions.js` (`tentacleOptions`) | **`play.js`, `evaluate.js`, `transition.js`, `actionScore.js`** |

**The browser game has never once run the searcher.** §5's weight table, the
`beamSetup` scale, `pressure`'s bounded reach, `chargeSeek`'s hand-off — four
sessions of work, every number of it measured against a headless bench, none of
it ever in front of a player. `play.js`'s own header explains why the *harness*
exists; nobody noticed it also explained why the tuning was unfalsifiable outside
the harness.

#### ✅ WHAT SHIPPED — judgement replaced, cadence kept

A `🧠` toggle per CPU corner in the Lobby writes `botPolicy: 'searcher' | 'legacy'`
onto the spirit (`makeInitialState` spreads unknown fields through, so this needed
no new state slice). The step-machine returns to a new driver when it is set.

⚠️ **`playTurn` IS DELIBERATELY NOT USED,** and the reasons are the whole design:

1. **It would desync every peer.** `playTurn` applies its chosen action with
   `ctx.rng` directly (`play.js:507`). The client's seeded cursor lives *inside*
   the state and only advances through `dispatch`, which logs `cursorBefore` and
   relays it; peers compare frame by frame and freeze on mismatch. A driver that
   advanced the cursor outside `dispatch` would fail silently and everywhere.
2. **The client resolves a Swing as a cinematic**, not a call: dice overlay →
   `battleState` → `closeBattleOverlay` → `runBattleFlowPaced`, several hundred ms
   and several renders later. `playTurn`'s loop is synchronous. A plan cannot be
   fired in one go even if the rng were safe.

So the searcher **chooses** and the existing client functions **execute**, one
action per tick, through the same paths a human's clicks take. Search runs on
`restoreRng(state.rng).fork('search:<turn>:<n>')` — a fork consumes nothing, so a
few thousand hypothetical dice leave the match's own cursor exactly where it was.
Speculation uses `harnessHooks`, which is engine-pure; handing it the CLIENT's
`battleFlowHooks` would have fired real fan and hazard effects during search.

#### 📊 AND THE FIRST MEASUREMENT PAID FOR ITSELF IMMEDIATELY

`.scratch/clientkinds.mjs` — what the searcher actually *chooses*, over 30 headless
matches, against what the client could actually *perform*:

| kind | share of chosen actions | client path |
|---|---|---|
| `melodyNote` | 43.9% | ✅ |
| `face` | 16.6% | ✅ |
| `move` | 10.2% | ✅ |
| `confirmMelody` / `endTurn` | 8.6% / 8.3% | ✅ |
| **`slime`** | **2.8%** | ❌ → now ✅ |
| `stackCommit` · `skillTarget` · `swing` · `pose` | 2.5% · 2.1% · 1.8% · 1.6% | ✅ |
| **`slide`** | **0.6%** | ❌ → now ✅ |
| `sonic` / `riffOff` | 0.5% / 0.5% | ✅ |

🎯 **6.50% of all decisions contained a kind the client could not perform** — and
all of it was Metalness's identity, the trail and the dial. Shipped without them,
he would have visibly given up mid-turn in front of a player. `callSlime()`,
`callEleven()` and `slide()` are zero-argument client functions that already
existed; wiring them took three switch cases and took the figure to **0.00%**.

📌 **The kind-coverage table is now pinned** — `BOT_CLIENT_KINDS` /
`BOT_CLIENT_GAPS` in `bot.js`, asserted against `MODELLED_KINDS` in
`legalActionsCheck` §16 (547 → 580 assertions), in both directions. ⚠️ **It cannot
see the switch statement** and says so out loud: it proves the SET has not grown
unnoticed, not that any translation is correct.

#### ⚠️ THE TWO BOTS ARE NOT THE SAME BOT — read this before comparing them

- 🪦 **The Smash and the Blaster are absent from searcher play.** They are
  `UNMODELLED_KINDS` (`transition.js:94`), filtered before the beam ever sees
  them — and they are the LEGACY bot's two highest-priority attacks. This is the
  single biggest behavioural difference and it is not a tuning artefact.
- 🐛 **The legacy bot gets free chords.** `botExecuteStackCommits` writes the
  stacks and the commit counter but never `usedStockIdx`, while the human path and
  `transition.js` both spend the slot. The searcher goes through the human path, so
  it PAYS for stack commits and the legacy bot does not. Not fixed here — it
  changes legacy economics and wants its own before/after.
- 📌 **No persona is passed.** §0.1 retires them; `botPersona` still runs for the
  legacy bot, so the "takes the stage as 📻 the Diva" line is legacy-only theatre.

#### 🔧 Two safety-net changes that came out of the wiring

- **The 15s watchdog now re-arms per action** (`botNudge` in its deps), not per
  turn. A searcher turn is a melody line plus movement plus a shot — comfortably
  past 15s at `BOT_TICK` pacing — so the old timer would have fired on healthy
  turns and forced an `endTurn` mid-plan.
- ⚠️ **Which opens a live-lock the watchdog can no longer see,** so the driver
  carries its own ceiling: if a client function ever refuses an action the rules
  call legal, the driver would re-plan, be refused again, and bump the nudge
  forever — keeping the stall timer permanently fresh. 60 ticks per turn
  (`MAX_ACTIONS_PER_TURN`, `play.js`) and it wraps up.

#### 🎯 WHAT THIS IS NOT — three things nobody has verified yet

1. **Nobody has played it.** Every number above is still headless. The whole point
   of the change is the numbers that come from a human at the controls.
2. ⚠️ **`attackParams` and `initiateSwing` are not pinned to each other.** The
   searcher plans a fight through `attackParams`; the client resolves one through
   `initiateSwing`'s own inline arithmetic (chord lookup, `instrumentDropped`,
   `pyroBonus`, `ATK_BONUS_CAP`, the charge dice). Nothing asserts they agree. If
   they don't, the searcher is planning against a fight the client does not run —
   and that is a candidate answer to §5.E⁗ item 1 that no bench could have found.
3. **The search's cost in a browser is unmeasured.** `window.__botSearch` carries
   `{decisions, ms, worstMs, stale, unsupported}` — check `worstMs` against the
   520ms tick before trusting the pacing.

### 6.6.11 ✅ 2026-08-18 (evening) — HURTING SOMEBODY SCORED WORSE THAN NOT HURTING THEM

#### The item, closed

§5.E‴ item 2, the second bug visible in §6.6.10's table and the last term still
telling the bot that landing a blow was a mistake.

`pressure` splits its two halves on purpose (§5, term 16): **a life taken is
banked** and is not reach-weighted, because the victim respawns across the board
and a distance-decayed life would collapse on the exact blow it should reward.
**Chip Vibe is provisional** and IS reach-weighted, because a rival on 2 Vibe
across the board is a plan rather than a position.

The split is right. The arithmetic under it was not.

#### 🐛 THE CAUSE — every attack in this game knocks the target back

`vibeMissing × reachWeight(dist)`. A landed hit adds one point of damage **and
simultaneously demotes every point already banked into a weaker reach band**,
because the rival is shoved 1–2 hexes. The two effects pull opposite ways and the
demotion is the bigger one whenever the rival is already hurt:

| the blow | before | after | Δ `pressure` |
|---|---|---|---|
| rival 2 → 1 Vibe, knocked 1 hex | 0.6/3 × 1.000 = 0.200 | 0.8/3 × 0.675 = 0.180 | **−0.020** (−0.05 weighted, Ronin) |

📌 **It is the `adjWounded` failure (term 11) surviving inside the term that
replaced it** — score the OPPORTUNITY and taking it destroys the payment. That
one paid the bot for standing next to a bleeding rival; this one paid it for not
finishing the job it had already started.

#### 📊 Measured, not argued — `.scratch/pressureswing.mjs`

Walks real searcher matches, applies every legal `swing`, keeps the cases where
the blow LANDED (Vibe or a life actually came off), and reports the `pressure`
delta next to the geometry. 200 matches a tree, three lives:

| tree | landed swings | Δ`pressure` **negative** | mean weighted Δ |
|---|---|---|---|
| HEAD | 1875 | **49 (3%)** — all 49 knockback | 0.240 |
| fixed | 1882 | **0 (0%)** | 0.268 |

⚠️ **3% IS THE HONEST SIZE OF IT, AND IT IS NOT §6.6.10.** That one moved 65% of
matches; this one is a wrong sign on the blows that matter most — the ones that
land on somebody nearly down — and it is worth fixing because it is *wrong*, not
because it is *big*. Every number below is small, and none of it is quoted as an
improvement.

#### ✅ THE FIX — `chipReachWeight`, a bounded mix, with the inequality written down

    chipReachWeight(d) = 1 − MIX · (1 − reachWeight(d))

`reachWeight` is untouched (`evalCheck` pins its shape and `beamSetup` reads the
same curve); the chip-Vibe half of `pressure` now reads the mixed one. `MIX`
bounds how much authority the reach gradient has over the damage credit, and it
is **derived, not picked**:

    MIX = 0.9 / ((maxVibePool − 1) × (1 − PRESSURE_REACH_FLOOR))    → 0.346 today

The worst case is the tightest ratio the rules allow: a 1-point hit on a rival one
point above going down (Vibe 2 → 1 — the smallest proportional gain that is not a
life) knocked the full 2 hexes, melee reach to the floor. Requiring
`(M−2)/(M−1) ≤ 1 − MIX·(1 − FLOOR)` rearranges to the line above; the 0.9 is
headroom so the guarantee is strict rather than an equality a float could tip.

🎯 **THIS IS §6.6.10's RULE APPLIED A SECOND TIME.** *Any term that scores GETTING
READY must be capped below what DOING it pays.* There, `beamSetup` scored lining
a Sonic up and outbid firing it. Here the reach gradient scores being CLOSE ENOUGH
to convert damage and outbid dealing it. Same shape, two terms apart — and both
were written in the same pass as `chargeSeek`, which is the one term that shipped
with its inequality stated.

⚠️ **DERIVED FROM THE ROSTER, FOR THE SAME REASON `dbHorizon` DIVIDES BY THE
SKILL YOU ARE SAVING FOR.** The ratio tightens as the Vibe pool deepens — one
point out of eight is a smaller share of the credit than one out of four — so a
future Spirit with a deeper pool is exactly how this comes back quietly. Hard-
coding 0.35 would have been correct today and wrong on the day the roster grew.

#### 🔬 `evalCheck` — 134 → 151 assertions

The new ones test **the property, swept**, not the instance: for every Vibe pool
on the roster, every Vibe level from full down to 1, and knockback of 1 and 2
hexes, a landed blow must not score less than not landing it. Plus three that stop
the fix from passing by flattening — `chipReachWeight(1) > chipReachWeight(3)`,
melee reach still full credit, and the mix a real blend rather than a switch. If
the sweep passed because the gradient had been deleted, the approach behaviour the
floor exists to produce would be gone and nothing would say so.

📌 HEAD's own 134 assertions were also run **against the new `evaluate`** and all
passed, which is the check that matters more than the new count.

#### 📏 The A/B — `.scratch/pressureab.mjs`, 200 matches a tree, same seeds

⚠️ **A FORMULA CANNOT BE SWEPT THROUGH `weightOverrides`,** so this is the
`ab68.mjs` discipline instead: one script, unchanged, run against a HEAD checkout
of `evaluate.js`. The script says how to build one in its header.

| three lives | HEAD | fixed |
|---|---|---|
| decided | 199/200 | 198/200 |
| mean turns | 35 | 37 |
| FP per turn | 0.711 | 0.697 |
| duels | 277 | **297** |
| Sonics | 218 | **279** |
| swings | 1259 | 1207 |
| lives taken | 507 | 483 |

| two lives | HEAD | fixed |
|---|---|---|
| FP per turn | 0.716 | **0.759** |
| duels | 255 | 278 |
| Sonics | 133 | 160 |

**The one column with a story is Sonics, +28%.** A Sonic knocks the target down
the beam, so it was the action punished hardest by a term that charged for the
knockback it caused. Everything else is inside the noise §5.D‴ describes — these
are population comparisons at n=200, not paired ones, and the decided rate, the
turn count and FP per turn should all be read as unchanged.

#### 🎯 AND THE BENCH TOOK §6.6.10's WIN RATE AWAY — 60 seeds was never enough

Two-gate, searcher vs `unranked` (the same searcher with the beam's `score` off),
three lives:

| seeds | HEAD | fixed |
|---|---|---|
| 60 | 52.5% ±12.7 · inconclusive 2% | 38.3% ±12.3 · inconclusive 0% |
| **300** | **42.7% ±5.7** · inconclusive 2% | **41.1% ±5.6** · inconclusive 3% |

⚠️ **THE 60-SEED ROW REPRODUCED §6.6.10's 52.5% EXACTLY AND THEN EVAPORATED.**
The 14-point gap between the two trees at 60 seeds is noise — at 300 they are one
point apart, well inside either interval. This change does not move the win rate.

🎯 **AND THE NUMBER IT LANDS ON IS THE FINDING: ~42%, WITH 50% OUTSIDE THE
INTERVAL.** §5.E‴ item 4 asked why the ranking buys nothing. At 300 seeds the
answer is worse than nothing: **the beam's `score` is losing to its own absence.**
§6.6.10 read 52.5% and called it "not an edge"; the honest reading is that it was
never 52.5%. Item 4 is now the top of the list and it has a number.

📌 **`RIFF_FP_TURN_CAP` and the ~2% inconclusive gate both held** across 600
matches of bench, which is the first independent confirmation of §6.6.10's
headline outside the session that produced it.

### 6.6.10 🎯 2026-08-18 — THE BOTS WERE NOT PLAYING THE GAME, AND ONE WEIGHT IS WHY

#### The headline

Alex, on being told that half of all three-life matches never finish: *"Yo these
bots have a problem if they can't finish a game of like a race to 20 FP."*

He was right, and the diagnosis in §6.6.9 — "the Fame economy stops producing" —
was **wrong**. Nothing was drying up. The bots were standing still on purpose.

A stalled 400-turn match, instrumented: the two Spirits are **adjacent for 417 of
427 samples**, both inside their own rigs, and across those 400 turns they play
**2,178 melody notes, 400 confirms, 5 swings and 0 duels**, finishing on 1 Fame
and 3 Fame. They were nose to nose, fully armed, composing.

#### 🐛 THE DECISION DUMP — every action is worse than doing nothing

Turn 120 of that match, the Ronin to act, scored the way the searcher scores
(apply the action, evaluate the resulting position):

| option | score |
|---|---|
| **the position as it stands** | **14.422** |
| `endTurn` | 13.522 |
| `move` | 13.429 |
| `face` | 13.252 |
| `riffOff` (live, against Zero) | 11.186 |
| `swing` | 10.515 |

**Doing nothing is the best available move, and a duel is the fourth-best.** Once
a board reaches that shape, it stays there for 400 turns — which is exactly what
"the median decided match is 41 turns and the p90 is 159" was telling us. Games
were bistable: bootstrap early or never start.

#### 🎯 THE CAUSE — a term that scores getting ready, priced above doing it

Weighted term deltas for the two actions that should be the game:

| action | total | the deltas that explain it |
|---|---|---|
| `riffOff` | **−2.63** | `beamSetup` **−1.96**, `fame` +0.73, `kit` −0.53, `fanMult` −0.43, `apBanked` −0.36 |
| `swing` | **−4.89** | `beamSetup` **−2.20**, `edgeSafety` −1.30, `centreStage` −0.77, `pressure` **−0.41** |

`beamSetup` scores how close a position is to firing a Sonic — and **firing it
destroys the alignment being scored**, because the rival is knocked off the line.
At `beamSetup: 2.2` that cost 1.96 points. The Fame the duel pays — 8 FP, a
THIRD of a 24-point race — scored **+0.73**, because `fame` is normalised against
the whole match while `beamSetup` swings its full range for one hex of geometry.

🎯 **AND THE RULE THIS BROKE WAS ALREADY WRITTEN DOWN, ONE TERM ABOVE IT.**
§6.6.6 shipped `chargeSeek` with an explicit inequality and an explicit reason:
*"`charge` > `chargeSeek`… the value HANDS OFF: seek goes to zero and `charge`
goes to one"*, or the bot loiters beside a Charge Zone forever rather than
stepping on it. `beamSetup` was written in the same pass, with **no hand-off
partner and no inequality** — and it produced precisely the failure the
`chargeSeek` comment predicts, one term over.

📌 **The general form, worth keeping:** any term that scores GETTING READY to do
something must be capped below what DOING it pays, or the bot will get ready
forever.

#### 📊 The sweep — one variable, via `weightOverrides`

Three lives, 30 matches a row, searcher in both seats, nothing else touched:

| `beamSetup` | decided | mean turns | FP/turn | duels | Sonics |
|---|---|---|---|---|---|
| 2.2 / 2.8 / 1.6 (shipped) | **12/30 (40%)** | 267 | 0.070 | 20 | 14 |
| 1.2 flat | 28/30 (93%) | 54 | 0.544 | 54 | 28 |
| 0.7 flat | **30/30 (100%)** | 36 | 0.760 | 43 | 37 |
| 0.3 flat | 30/30 (100%) | 31 | 0.809 | 53 | 32 |

**Shipped: the column scaled ×0.32** — Zero 0.9, Ronin 0.7, Metalness 0.5, default
0.7. The scale keeps the roster's ORDERING, which is character rather than
tuning: Zero's Blaster runs down the same line as his Sonic, Metalness is a melee
kit that has least use for a three-hex line. Verified as shipped: 30/30 decided
at three lives (mean 34 turns, FP/turn 0.742, 43 duels) and 30/30 at two (mean
24 turns).

#### 📏 The two-gate bench — 60 seeds, three lives, searcher vs unranked

| `beamSetup` | searcher win rate | inconclusive |
|---|---|---|
| shipped (2.2 / 2.8 / 1.6) | 42.9% ±21.2 | **39/60 (65%)** |
| 1.2 flat | 44.4% ±14.5 | 15/60 (25%) |
| **0.7 flat** | 48.3% ±12.9 | **2/60 (3%)** |
| the scaled column, as shipped | 52.5% ±12.7 | **1/60 (2%)** |

🎯 **THE INCONCLUSIVE GATE IS THE RESULT: 65% → 2%.** §6.6 spent three sessions
arguing that the ≥60% bar was measuring its own exclusion rate; this is the first
configuration where that argument does not apply, because there is almost nothing
left to exclude.

⚠️ **AND THE WIN RATE IS ~52%, WHICH IS NOT AN EDGE.** Read it honestly: `a` is
the searcher with the beam's ranking ON and `b` is the same searcher with it OFF,
so this says the RANKING buys little once both seats will actually fight. That is
a real open question and it now has a clean instrument pointed at it.

#### ✅ Three lives is the default now

The move `SEQUENCING.md` §5.F‴ had blocked. With the weight corrected the horizon
is not the problem it looked like: **30/30 decided at three lives, mean 34
turns.** `matchConfig` defaults to three, and every reading taken before
2026-08-18 was taken on two — do not compare across that line.

#### 🐛 AND A SECOND BUG IS VISIBLE IN THE SAME TABLE — ✅ FIXED IN §6.6.11

`pressure` went **−0.41 on a swing that landed**. The term is reach-weighted
(`vibeMissing × reach`) and a successful hit KNOCKS THE RIVAL AWAY, so the
distance penalty falls faster than the damage credit rises: **hurting somebody
can score worse than not hurting them.** §5's own comment block anticipated
exactly this for LIVES — *"decaying it by distance would mean finishing a rival
SCORES WORSE than leaving them bleeding next to you"* — and banked lives
accordingly. Chip Vibe was left reach-weighted on the argument that it is
provisional, and knockback turns that argument inside out. Not fixed here: it
wants its own A/B, and one variable at a time is how §6.6.10 stayed legible.
✅ **It got that A/B the same evening — see §6.6.11.**

#### 🎤 Footnote: the duel ceiling was NOT what was breaking the game

With the bots actually playing, the §6.6.9 ceiling sweeps clean — three lives, 30
matches: ceiling 4 → 35 turns and 30/30 decided, ceiling 6 → 47 turns and 29/30,
ceiling 8 → 36 turns and 30/30. 8 FP a duel does not run away with the match; it
buys duels (34 → 43 chosen). ⚠️ Round 1 still pays 7.64 and Round 2 7.48, so
§6.6.9's re-pricing job is untouched by any of this.

### 6.6.9 ✅ 2026-08-18 — SUDDEN DEATH RUNS, AND THE FP CAP EATS EVERY POINT OF IT

#### The headline

`transition.js`'s `riffOff` case now escalates to Round 2 on the engine's own
`verdict.close`, which is the client's gate verbatim (`fireBeamClash`: break the
beams on `!tie && !close`, otherwise surge, capped at two rounds).
`HARNESS_GAPS.riffRound2` is **deleted**, not softened.

**It fires constantly: 116 of 205 duels — 57% — go to sudden death.** That is
not a rounding error on the Fame economy; it is the majority of every duel the
bench has ever played, resolved by a rule the headless path did not run.

🎯 **AND THE PAYOUT DID NOT MOVE, WHICH IS THE REAL FINDING.**

| | HEAD (Round 1 only) | this pass (Round 2 driven) |
|---|---|---|
| matches | 250 | 250 |
| mean turns | 188 | 182 |
| decided | 153/250 (61%) | 158/250 (63%) |
| **FP per turn** | **0.067** | **0.066** |
| duels fought | 238 | 205 |
| duels reaching Round 2 | 0 | **116 (57%)** |

Same seeds, same two pairs, searcher in both seats. ⚠️ **These are population
comparisons, not paired ones** — Round 2 draws from the rng, so every roll after
the first duel diverges. The duel counts differing by 33 is that divergence, not
a preference the searcher acquired.

#### 🐛 WHY A 2 FP BONUS BOUGHT NOTHING — the ledger that answered it

`playTurn`'s duel ledger now records the FP that actually **landed** on the two
duelists across the action, because a duel resolved and a duel paid are
different events. Over 120 matches:

| | duels | FP banked per duel |
|---|---|---|
| ended in Round 1 | 37 | **3.89** |
| went to Round 2 | 57 | **3.81** |

`FAME_PER_TURN_CAP` is **4**.

🎯 **THE CAP, NOT THE LADDER, SETS THE PRICE OF A DUEL.** `awardRiffFame` builds
a payout out of six terms — floor 2, `ceil(margin/2)`, a perfect per three, the
Round-2 bonus of 2, the Headliner rider, the stage-FX rider — then hands it to
`grantFame`, which multiplies it by the crowd and clips the result at 4 per
Spirit per turn. A Round-1 win on margin 2 already reaches the ceiling before
any of that is counted. **So `RIFF_R2_BONUS` is awarded in full and banked at
zero, every time.**

⚠️ **AND IT IS NOT ONLY THE BONUS.** The same arithmetic flattens margin,
perfects, the belt, the stage effects and the underdog multiplier into the same
number. The biggest Fame play in the rules pays a bot exactly what a pose round
pays it — `POSE_FP_MAX` is 4 as well, and the constant's own comment says it was
matched to the cap deliberately. §5.A's pattern has a **third sign** now: not a
reward the bot cannot reach, not a penalty it cannot shed, but a reward it
collects and a cap that discards.

📌 **WHAT NOT TO DO WITH THIS.** Raising the cap, exempting duels from it, or
banking the overflow are all balance changes to the whole Fame economy, and the
cap is doing real work — `battleFlowCheck` §5 pins overflow as discarded, and the
per-turn window is what stops a chained payout (Azrael streaks, riff payouts
back to back) from ending a match in one beat. This is Alex's decision, not a
weight to nudge, and the evidence for it should be quoted with the sim caveat
below.

#### 🤝 The consolation is reachable, and still almost never fires

`bothStrong` requires `round >= 2` by construction, so before this pass the
both-paid consolation could not fire at all. It now can: **1 duel in 205.**
The gate is `RIFF_BOTH_PAID_QUALITY` = 75% clean **for both sides**, and the
model's ceiling is `riffSkill` = 0.97, worth about 76% expected quality — so it
needs two Spirits both at a Performance Score near 11+ **and** the variance to
land kindly. Whether that is the right rarity is a design question; what matters
here is that the rule is now on the board instead of unreachable.

#### 📏 What is modelled, and what that biases

`simulateRiffPerformance` takes a note COUNT, not a rhythm, so it cannot see that
Round 2 runs at **0.58× the gaps**. Both sides therefore play sudden death as
well as they played Round 1, on a chart that got half again as fast. Declared as
`HARNESS_GAPS.riffRound2Speed` rather than patched with a guessed penalty.

⚠️ **The bias is not symmetric in its consequences.** The verdict is roughly
unaffected — both sides are flattered equally — but `RIFF_BOTH_PAID_QUALITY` is
an ABSOLUTE bar, so the consolation fires more often here than it would with
human hands. It is also part of why the `close` gate trips so readily: two
performances drawn from the same curve at similar Performance Scores cluster
inside `RIFF_CLOSE_QUALITY_GAP` by construction. **57% escalation is a reading of
that model as much as of the game.**

#### 🔬 What the suites say

transition 232 → **241** (the escalation sweep and the both-paid probe),
harness 1681 → **1694** (2 of those are the new `HARNESS_GAPS` assertions; the
rest is the per-action loop running over slightly different matches). Every other
suite unchanged and green: engine, legal 547, eval 134, turnflow 61, determinism
22, battleflow 45, melody 159, slime 127, eleven 38, score 122, riffparity
127598, skilltree 208. `check:bundle` clean.

⚠️ The new transition assertions **sweep 60 seeds rather than pinning one**, on
purpose: which seed produces a close duel is a property of
`simulateRiffPerformance`, so a pinned seed would fail the day that curve is
retuned and read as "escalation broke". What they pin is the invariant — close
escalates, decisive does not, no duel ever reaches a third round, and no close
duel is allowed to stop at Round 1.

#### 🎤 THE DUEL GOT ITS OWN CEILING — and the searcher noticed immediately

Alex's call, same day: `RIFF_FP_TURN_CAP = FAME_PER_TURN_CAP × 2` (**8**), passed
by `awardRiffFame` into `grantFame`'s new `cap` argument. It is a HIGHER cap, not
an exemption — the overflow above 8 is still discarded, and `fameThisTurn` is
still one shared window, so a Spirit carried past 4 by a duel banks nothing from
anything else that turn. Everything else keeps the general ceiling by default.

40 matches per cell, same seeds, searcher in both seats, turn cap 400:

| lives | duel ceiling | decided | mean turns | FP/turn | duels chosen | FP/duel R1 | FP/duel R2 |
|---|---|---|---|---|---|---|---|
| 2 | 4 (old) | 26/40 (65%) | 168 | 0.073 | 28 | 3.83 | 3.88 |
| 2 | **8** | 27/40 (68%) | 156 | **0.096** | **37** | **7.77** | 7.79 |
| 3 | 4 (old) | 16/40 (40%) | 262 | 0.064 | 12 | 3.75 | 3.88 |
| 3 | **8** | 20/40 (50%) | 227 | 0.090 | **29** | 7.20 | 7.58 |

🎯 **THE DUEL COUNT IS THE RESULT, NOT THE FP.** The searcher went from 28 duels
to 37 at two lives, and from 12 to 29 at three — the same policy, the same beam,
the same weights. It was not avoiding riff-offs out of temperament; it was
correctly pricing an action whose reward was being deleted after the fact. This
is §6.6.6's lesson in the payout layer rather than the evaluator: **a term the
economy discards is a term the search cannot see.**

⚠️ **AND THE LADDER IS STILL SATURATED, SO DO NOT CALL THIS FIXED.** Round 1 pays
7.77 and Round 2 pays 7.79. The cap moved, the ceiling did not stop binding.
Instrumenting every riff grant (76,020 of them, most inside the searcher's own
lookahead) says why:

| mean base, before multipliers | mean crowd multiplier | mean uncapped award | mean banked | clipped |
|---|---|---|---|---|
| 8.34 | ×1.90 | **15.85** | 7.81 | **96%** |

**`awardRiffFame` is writing ~16 FP cheques against a 4 FP account.** A whole life
is worth 8 (`fpPerLife` at two players), so the average duel is priced at two
lives of Fame. The dominant term is `ceil(margin / 2)`, and `margin` is
`round(scoreGap × RIFF_MARGIN_SCALE)` — a scaled score gap that grows with riff
LENGTH, which is exactly the objection `RIFF_CLOSE_QUALITY_GAP` was introduced to
fix on the Round-2 gate and which nobody carried across to the payout.

📌 **PROOF THE CAP IS LOAD-BEARING, IN CASE ANYONE IS TEMPTED TO REMOVE IT:** run
the same fixture with the duel ceiling lifted entirely and matches end in a mean
of **14 turns**, 40/40 decided, FP per turn 1.649 — a duel wins the match on its
own. The cap is not a nuisance; it is the only thing that has been balancing the
riff-off.

🎯 **SO THE NEXT MOVE ON THE FAME ECONOMY IS RE-PRICING `awardRiffFame`, NOT
RAISING ITS CAP AGAIN.** Get the uncapped award to land INSIDE the band — 4 to 8
across the realistic spread of margins, perfects and rounds — and every term in
it becomes visible to the searcher for the first time. Until then the duel is
worth "8", full stop, and Round 2 is worth nothing again for a second, entirely
different reason.

#### 🕰️ THREE LIVES IS RULE-LEGAL NOW, AND THE GAME STILL WILL NOT FINISH IT

With the Gods shelved (below), `grantFame` crowns on the Fame target at any
number of lives, so `matchConfig`'s two-life default had nothing left to
sidestep. **It stayed at two anyway, and the reason is measured rather than
cautious.**

| lives | turn cap | decided | mean turns |
|---|---|---|---|
| 2 | 400 | 27/40 (68%) | 156 |
| 3 | 400 | 20/40 (50%) | 227 |
| 3 | **800** | 21/40 (53%) | 423 |

⚠️ **DOUBLING THE TURN CAP BOUGHT THREE POINTS.** The median DECIDED three-life
match is 41 turns and its p90 is 159, so a match that has not finished by roughly
200 turns never finishes — the stalls are dead games, not slow ones. Something
stops the Fame economy producing before 24 FP is reached, and `MAX_TURNS` is not
the knob. `harnessCheck` §5 refuses the default outright (2/8 decided), which is
the assertion doing its job.

📌 **This is the sharpest open question on the bench**, and it is upstream of
§6.6's "restate the bar" problem: a two-gate bar cannot be calibrated on a
horizon where half the games die of natural causes. Pass `startingLives: 3`
deliberately to reproduce.

#### 🪦 Rock Gods — shelved 2026-08-18, Alex's call

The finale is off the roadmap for now. The bot's only God-aware behaviour is four
lines in `botPlanMove` (converge on the God while one is summoned); it is marked
🪦 and left standing, because it cannot fire while nothing summons a God and
cutting a working rule to express a scheduling decision turns a shelf into a
rewrite. `HARNESS_GAPS.summonRockGod` now names a shelved subsystem rather than
owed work.

⚠️ **The cost it was carrying did not go away.** `matchConfig` plays TWO-life
matches specifically to sidestep the finale, and short games under-rate every
investment term in §3.2 and §3.6. With the Gods shelved that constraint stops
being load-bearing — but moving the bench to three lives means changing
`grantFame`'s `shortGame` branch so reaching the Fame target always crowns
outright, which is a game rule and therefore Alex's call.

### 6.6.8 ✅ 2026-08-17 (late) — THE POSE PAYS, AND THE HOOK NOBODY IMPLEMENTED

> §6.6.7 closed by naming three Fame engines that were still switched off
> headlessly. This is the largest of them, and taking it apart found a second
> bug underneath it that had been running the wrong way for months.

#### The headline

🌟 **`posing` AND `limelightScores` ARE ENGINE STATE.** They were the last two
React-owned slices any rule depended on — `evaluate` carried a whole `view`
argument for them, `legalActions` took them as a parameter, `attackParams` read
`posing` to decide whether a defender rolls a die at all, and the payout that
made them worth anything lived on the client turn clock. So a headless pose set
a flag, gave up its defence die, and earned **nothing**. `HARNESS_GAPS.pose`
said so honestly for weeks; it is deleted now, not softened.

The rule lives in three files instead of one monolith:

| | |
|---|---|
| `engine/systems/limelight.js` | the slice, the readers, and **the ladder** — `posePayout`, which had three separate transcriptions |
| `engine/systems/battleFlow.js` | `poseConsequences` — the FP grant and the Sustain toll, one ordered beat, through `grantFame` like every other payout |
| `engine/policies/transition.js` | `endTurn` drives it off the same `limelightHeld` verdict the client reads |

#### 🐛 The bug underneath, and it is the pattern with the SIGN FLIPPED

⚠️ **`hook('leftLimelight')` — the pose ending when you are SHOVED out of the
middle — was client-only, and `harnessHooks` never implemented it.** `runBattleFlow`
skips hooks it does not have, so a bench Spirit knocked off the Limelight **kept
`posing` set and rolled a ZERO defence die for the rest of the match.**

Every other sighting of §5.A's pattern has been a reward the bot could not reach.
This one is a **PENALTY THAT COULD NOT BE TAKEN OFF**, welded onto a Spirit who
never chose to keep posing, and it could only ever have made the bench's numbers
worse — quietly, in the direction nobody audits. A hook nobody implements is a
rule that only applies to humans.

📌 There were three drop sites in the client and all three are engine rules now:
walking out of the middle (`movement.js`), being shoved out of it
(`battleFlow.js`), and hitting the floor (`combat.js` — without which a Spirit
knocked down IN the Limelight keeps the dropped guard through their **recovery
turn**, which is the worst possible moment for it).

#### 🎯 THE FINDING OF THE DAY — a greedy search cannot climb a back-loaded ladder

Wiring the payout up was not enough, and the reason is a property of the
SEARCHER rather than of the pose.

`pose` costs 0 AP and moves one flag. The FP does not land until `endTurn`
resolves the Limelight verdict. **So to a per-action search, posing scores
EXACTLY the same as not posing** — a coin flip — while quietly handing over the
defence die. Measured before the term existed: the bots posed 34 times in 44
matches and banked **zero rounds**, because a pose taken by tie-break is dropped
by the next thing that looks better.

⚠️ **AND THE LADDER MAKES IT WORSE, NOT BETTER.** Round one pays 1 FP; round four
pays 4. Held from a standing start the whole flight is **1+2+3+4 = 10 FP, more
than two lives are worth** — but the FIRST rung is priced at a quarter of the cap
against a board where `pressure` is 2.5 and a fight is available now. A search
that declines the first step of a staircase whose value is entirely in the last
is not malfunctioning; it is correct, once per turn, forever.

Two things came out of that:

- ✨ **`posePlay`** — the mirror `rivalPose` never had, scoring MY pose from the
  inside. Zero unless the flag is up, which is the whole point: it has to be able
  to tell the state after a pose from the state before it.
- 🪜 **`POSE_LOOKAHEAD`** — it scores the rung the pose is HEADING FOR, not the
  one under its feet. The risk half of the term already discounts a pose that
  will be interrupted, which is exactly what a lookahead would otherwise
  over-claim.

#### 🐛 And a term where paying MORE bought LESS

⚠️ **The first draft scaled the risk with the prize** — `payoff × (2·safety − 1)`,
so one factor carried both halves. Lifting a pose's value from 0.25 to 0.75 took
poses from **18 down to 13**, because the same factor amplified the penalty for
posing in company, and in a two-handed duel a rival is nearly always in company.

A term where paying more buys less is not mistuned, it is **mis-shaped**. The
prize grows with the ladder; the danger does not — a rival next to you gets one
free clean hit whether this is your first pose round or your fourth. Split into
`payoff × safety − POSE_RISK × (1 − safety)` and the curve behaves.

#### 📊 The A/B — same seeds, same fixture, HEAD vs this pass

Ronin-vs-Intergalactic 0 and Ronin-vs-Metalness, 22 seeds each, 400-turn cap,
both seats searching. "Before" is `fee7be0` checked out clean.

| | before (fee7be0) | this pass |
|---|---|---|
| mean match length | 206 turns | **156** |
| decided inside the cap | 24/44 (55%) | **30/44 (68%)** |
| Fame per turn | 0.050 | **0.089** |
| poses struck | 34 | 50 |
| 🌟 **pose rounds PAID** | **0** | **39** |
| Sonics | 15 | 18 |
| riff-offs | 29 | 37 |

And the §6.6 bench itself, `searcher` vs `unranked`, 50 matches:

| | before | this pass |
|---|---|---|
| draw-inclusive rate | 49.0% | **53.0%** |
| inconclusive rate | 70.0% | **58.0%** |
| mean match length | 294 | **255** |

⚠️ **NEITHER GATE CLEARS, AND 50 MATCHES IS ±21 POINTS.** That is a direction,
not a measurement, and it must not be quoted as one. The inconclusive rate is
still four times its bar. What the table does support is the narrow claim: the
Limelight went from paying nothing to paying, and nothing else got worse.

#### 📏 The weight, and why it is small

Swept at 0 / 0.2 / 0.4 / 0.8 / 1.2 over 44 matches at fixed seeds:

| weight | poses | rounds BANKED | turns | decided | FP/turn |
|---|---|---|---|---|---|
| 0 | 47 | 44 | 139 | 32/44 | 0.096 |
| 0.4 | 48 | 43 | 139 | 32/44 | 0.103 |
| 1.2 | 39 | 21 | 154 | 30/44 | 0.089 |

🎯 **THE COLUMN THAT MATTERS IS "ROUNDS BANKED", NOT "POSES".** A pose struck is
not a pose paid — `limelightHeld` needs BOTH ends of a turn on hex 56 — and at
1.2 the bot posed nearly as often and collected **half** as much, because the
weight walked it into the middle in company, where it was knocked straight off
again. That is §6.6.7's centre/rig tension one term further on.

📌 0 and 0.4 are indistinguishable on every gate, and **0.4 ships anyway,
deliberately.** At 0 the bot still poses — by tie-break, because `pose` costs 0
AP and scores identically to not posing — which is the same behaviour arrived at
by accident, and it would evaporate the day somebody reorders `legalActions`. A
weight is a decision; a tie-break is a coincidence with good manners.

⚠️ **THE 18-MATCH VERSION OF THAT SWEEP SAID 0 BEAT 0.4 CLEARLY, ON THREE
SEPARATE ROWS.** It was noise. 44 matches erased it. §5.E′ warned that 9–14 match
samples find a factor of two and cannot settle a 0.2 — this is what that looks
like from the inside, and the same warning applies to the 44-match table above.

#### 🔬 What the suites say

legal 547, eval 124→**134**, transition 222→**232**, turnflow 61, determinism 22,
battleflow 45, melody 159, slime 127, eleven 38, score 122, harness 1681→**1680**,
riffparity 127598, skilltree 208. `check:bundle` clean, `eslint` clean.

📌 **harness went DOWN by one and that is not a lost test.** It asserts once per
action played across its traced matches, so the count moves whenever the
evaluator's decisions move; the file gained a static assertion (`pose` is no
longer in `HARNESS_GAPS`) and the trace played one action fewer.

#### 📌 Still switched off

Two of §6.6.7's three remain: **riff-off Round 2 is not driven** (`verdict.close`
is computed and ignored, under-paying every duel by 2 FP, a damage band and the
whole both-paid consolation), and **the Smash is still UNMODELLED**.

---

### 6.6.7 ✅ 2026-08-17 (evening) — THE BOT CAN NOW SEE THE BOARD, THE DICE, AND ITS OWN SOUND

> **Six things landed together and they are not six tweaks — five of them are the
> same bug.** Read §5.A's pattern first; every item below is another sighting.
> Full A/B at the bottom. ~~⚠️ Nothing here is committed.~~ It landed as `fee7be0`.

#### The one finding that reframes the rest

🎯 **TAKING A RIVAL'S LIFE SCORED LESS THAN THE TWO DRIVE NOTES IT COST.**
Measured on the shipped column: a Ronin Swing that lands is `drive` **−0.73**
against `pressure` +0.16 and `fame` +0.08, and even the killing blow
(`pressure` +0.60) came out behind the ammunition. So the searcher was offered an
attack at **773 decision points in one 250-turn duel and took 2**.

⚠️ **It is §6.6.1's `kit` bug, one pool further on.** `dbHorizon` scored Db in
one state only — banked — so spending was a pure loss and the bot refused every
purchase. `drive`/`sustain` scored the stacks in one state only, so ATTACKING was
a pure loss and the bot refused every fight. Db needed a second term; the stacks
did not — what a stack converts into is damage, and damage is `pressure`. They
were simply priced above what they buy.

📌 **And it was invisible until the day before.** Attacks were FREE headlessly
until §6.6.2, so the ratio between "what you hold" and "what you spend it on"
could not be wrong, because nothing was ever spent. **A bug fix is a measuring
instrument switching on**, and the thing it measured first was a factor-of-two
weighting error nobody had reason to suspect.

#### What landed

| | what it was | what it is |
|---|---|---|
| 🎯 **Board terms** (§6.6.6) | 16 terms, no term named a PLACE | `centreStage`, `chargeSeek`, `stock`, `beamSetup` |
| 🎲 **§6.4 expectimax** | every attack judged on ONE dice roll | `ATTACK_SAMPLES` = 6, `expectedScore` |
| 🎤 **The riff-off** | `startRiffOff` client-only, no `riffOff` kind | emitted, modelled, paid |
| 🎯 **Pickups** | walking onto a Lost Chord or Charge Zone paid NOTHING | `collectPickups` in `transition.js` |
| 🎭 **Per-Spirit style** | `perfBig`'s seat empty since the riffs went | `music/spiritStyle.js`, six gestures |
| 🐛 **`weightsFor`** | a per-Spirit override NaN'd every other seat | shape detected by values |

#### 🎲 §6.4, and it had the sign backwards

The handoff warned that "plain minimax will systematically OVER-value
high-variance lines". In a game where the variance is mostly DOWNSIDE and the
alternative is a safe shuffle, one sample systematically **under**-values them:
`applyBotAction` resolves the attack, so a one-sample greedy rolls the dice once
and reads the result as the action's value. A Swing's hit rate runs 17.8% on one
Drive note to 100% on eight — a single sample is not an estimate of anything.
⚠️ `WIN_SCORE` had to become finite for this: `Infinity` does not survive
averaging, or a 17% chance of victory would outrank a certainty.

#### 🎯 The pickups — the quietest of the six

`applyTokenPickedUp` and `applyChargeZoneUsed` have been correct engine reducers
for a long time with no headless caller, and the payout rules lived inside
closure-scoped client functions. So a bot walked over a Lost Chord and got no
note, and over a Charge Zone and got no charge.

⚠️ **Which means `evaluate`'s `charge` weight — Intergalactic 0's highest at 2.2,
the term §4.2 calls "the whole character" — has never once been able to fire in a
bench match.** Every number ever quoted for him is a reading of a Spirit with his
identity switched off. The kernels now live in `systems/board.js` and the CLIENT
IS REWIRED ONTO THEM, so there is one copy rather than two.

#### 🎭 The style system, and the two bugs it shipped with

`music/spiritStyle.js` fills `perfBig` — one point per completed per-Spirit
gesture, capped at 2, paying **FANS through `performanceScore` and never Fame**,
which is the rule the riffs broke. Metalness: the gallop (a pedal tone) and the
tritone walked away from. The Ronin: the run and the sweep. Intergalactic 0: the
chromatic slide and the two-note groove.

Both bugs are worth keeping because both are invisible:

1. ⚠️ **`STYLE_GAIN_FLOOR` was 0.34 and every gesture climbs in THIRDS.** Five of
   six gestures were silently unreachable; the sixth looked like the only style
   anybody had (180 hits against 11–19). A ladder whose rungs are all below its
   own floor is not a weak ladder, it is no ladder, and nothing fails.
2. ⚠️ **`notesStillNeeded` counted NOTES where progress counts INTERVALS.** An
   `n`-note shape has `n−1` rungs, so `ceil(4 × ⅓)` said a two-thirds-finished
   four-note run needed two more notes. The gesture dropped out of consideration
   exactly when it was one note from landing.

📌 A third was a design correction rather than a bug: the first draft's Ronin
gesture was "a leap, answered", which fired on **87%** of his commits — because
`melodyLine` is pitch CLASSES and the interval fold caps every distance at six
semitones, so "a leap" could only ever mean a fourth or a tritone. **There is no
such thing as a big leap in pitch-class space**, and the detector was measuring
the fold. Replaced by the sweep (three thirds in a row).

#### 🎤 The centre / rig tension — an interaction nobody predicted

⚠️ **THE MIDDLE IS OUTSIDE EVERYBODY'S RIG.** `RIG_RADIUS_BY_TIER` is 4 at tier
zero and the Limelight sits ~6 from a home corner, so a Spirit who walks to
centre stage is stranded (§3.1's "worst square"): a bare d4, **no Sonic, and no
riff-off at all**. Overpaying `centreStage` therefore switched OFF the two Fame
engines this whole pass exists to switch on. Ronin vs Metalness, 14 matches: at
1.3–1.7 they ran 326 turns, decided 3, fought **1** duel; at ~0.8 they ran ~220,
decided 7, fought **10**.

📌 **The game already has the answer and it is a purchase** — Range I takes the
radius to 5, Range II to 7. "Work the middle" is something a Spirit EARNS. The
right long-term shape is a `centreStage` conditional on having the range to shoot
from there, which reads two things at once and wants the bench, not a guess.

#### 📊 The A/B — same seeds, same fixture, both seats searching

Ronin-vs-Intergalactic 0 and Ronin-vs-Metalness, 9 seeds each, 400-turn cap.
"Pre-session" zeroes the four new terms and restores the four retuned rows to
their §5-transcribed values; everything else (riff-off, pickups, style,
expectimax) is live on both sides, so this isolates the EVALUATOR.

| | pre-session weights | this session |
|---|---|---|
| mean match length | 369 turns | **215** |
| decided inside the cap | 3/18 | **9/18** |
| Fame per turn | 0.002 | **0.044** (22×) |
| swings | 6 | **86** |
| Sonics | 0 | **8** |
| riff-offs | 0 | **12** |

⚠️ **AND IT DOES NOT CLEAR THE SECOND GATE.** Half the matches still hit the
400-turn cap. `bench.mjs` now prints §5.A's two gates — a draw-inclusive rate on
a fixed denominator AND a maximum inconclusive rate of 15% — and the inconclusive
gate is the one to chase next. ⚠️ `searcher` vs `unranked` is worse still (72.5%
inconclusive over 40): a passive baseline gives the searcher nobody to trade
with, which is a property of the A/B, not of the game.

📌 **Three Fame engines are still switched off**, and any one of them may be the
missing rate: the pose pays nothing headlessly (`view.posing` is still React
state, so §3.3 is unreachable), riff-off Round 2 is not driven, and the Smash is
still UNMODELLED.

---

### 6.6.6 🎯 `evaluate` HAS NO BOARD-OBJECTIVE TERM AT ALL — 15 terms, zero places

**Found 2026-08-17, from Alex describing how they actually play.** Asked whether
the bots' 83%-at-distance-1 clumping matched real play:

> *"Most action takes place in the middle. The Limelight spot is there, Charge up
> spots tend to be in the middle, with upgrades available, I would try and work
> it to get a good Sonic attack off. I couldn't say 'how close I am to Rivals'
> honestly. Sometimes close, it depends on what I want to do at the moment."*

⚠️ **THAT DESCRIBES A GAME ABOUT CONTESTING PLACES, AND `evaluate` HAS NO TERM
FOR A PLACE.** Grep the file for `LIMELIGHT`, `chargeZone`, `hexRingFromCenter`
or `token` and the count is **0**. The fifteen terms are:

`survival` `fame` `fanMult` `perfCliff` `drive` `sustain` `apBanked` `inRig`
`charge` `refillDenied` `edgeSafety` `dbHorizon` `kit` `rivalPose`
`targetUpside` `pressure`

Every one is a resource, a stat, or a relationship to a rival. **`edgeSafety` is
the only one that reads the board, and it only says "not the edge".** Nothing
says "the middle is where the game is."

📌 **AND THE NEAR-MISSES ARE THE TELL, because each scores the AFTERMATH of an
objective rather than the objective:**

- `charge` scores **holding** a charge (`chargeFloorTurns > 0`) — not standing on
  or moving toward a Charge Zone.
- `fanMult` scores the multiplier you **have** — not the ring you are standing
  in, even though `FAN_GAIN_BY_RING` pays `main: 2, pit: 1, floor: 1, back: 0`,
  so where you commit decides what you earn.
- `rivalPose` scores a **rival** in the Limelight — there is no term for being
  there yourself.

⚠️ **THIS IS THE SAME SHAPE AS EVERY OTHER BUG FOUND TODAY, for the sixth time**:
the game rewards something, the evaluator has a term for the reward's *result*
but none for the *act of going and getting it*, so the bot never goes.

🧭 **AND IT IS THE LIKELIEST EXPLANATION OF THE CLUMPING.** `botHexScore` — the
MOVE planner — does have `center` and `spotlight` weights, so the bot knows which
hex is better *once it has decided to move*. But `evaluate` decides **whether to
move at all**, and there `apBanked` charges for the step while nothing credits
the destination. So the bots drift, end up adjacent, and stay. They are not
choosing melee range; they are declining to travel.

🔧 The fix is a family of terms, and Alex's sentence names them: the Limelight /
centre ring, the Charge Zones, the token-and-upgrade pickups. ⚠️ Get this in
BEFORE the beam-range term — "work it to get a good Sonic off" is a manoeuvre
that happens **in the middle**, so a Sonic-setup term written against bots that
never travel would be tuned against the wrong board.

---

### 6.6.5 🪦 THE RIFF LIBRARY IS RETIRED — and the Fame hole is now 100%

**Design decision, Alex, 2026-08-17**, taken with the §6.6.3/§6.6.4 numbers in
hand. All 34 riffs are gone, along with the ladder that had just landed.

**Two reasons, and the second is the one that generalises:**

1. **They were not rock.** 13 of 34 were classical (Beethoven, Bach, Grieg,
   Wagner, Mozart) and most of the rest were named-tune references. A Spirit
   winning on Für Elise is the wrong story for this game.
2. ⚠️ **THE FAME WAS NOT EARNED BY A DECISION.** Note stock is DRAWN, so which
   riffs a player could even spell was largely their draw. At 2–5 FP against a
   16 FP target, a tight game could be decided by a shape one player happened to
   be dealt. *"I'd feel upset if a Rival won a tight game we were neck and neck
   in because he got hold of a legacy riff — something I had no control over."*

**What went, in one list:** `detectRiff` and the award in `melodyCommit`; the FP
effect; `hasRiff`'s **+3 Performance Score** in `economy.js`; `committedHasRiff`
and the riff-off's `hasRiff` flag; the `riffProgress` ladder in `actionScore`;
the riffbook, its banner and its two UI tabs; `riffLibrary.js` itself
(`PC_PLAY_NAMES` moved to `music/pitchNames.js` — it was the one thing in there
with nothing to do with riffs).

⚠️ **THE PERFORMANCE SCORE TOOK A SECOND, QUIETER HIT.** `hasRiff ? 3 : 0` was
the single largest term in `performanceScore`. Scores now sit meaningfully lower
across the board and **`perfCliff` — the Ronin's 2.0 weight, his whole identity —
is harder to reach.** That seat is left EMPTY rather than backfilled with a
stand-in number, because a stand-in would bury the hole.

#### The measured hole

| | riffs live | riffs retired |
|---|---|---|
| Fame per turn, both seats | 0.359 | **0.000** |
| matches ending by Fame | 8 of 8 | **0 of 8** |
| by knockout | 0 | **7 of 8** (1 unfinished) |
| mean length | 25 rounds | **125 rounds** |

**A 400-turn duel now ends 0/16 FP on both sides**, with both crowds maxed
(6♥/14👥) and 637 Db banked. The Fame economy is not slow, it is **empty**.

---

#### 🧭 THE REPLACEMENT — Alex's direction, 2026-08-17

Not a second riff library. Three things, in the designer's words:

> **Sonic should be the main way to gain Fame. And Riff Offs even more so. And
> Sonic plays should be powerful for the attacker since they get potentially
> more powerful dice to play with. The system should try and devise ways to
> reach these potential Fame awards.**

Plus, for the melody side: **fans for playing to the Spirit's STYLE** — Metalness
landing a gallop or working a tritone, a cadence that makes sense for *that*
Spirit. Fans rather than Fame, so it compounds through the crowd multiplier
instead of handing over a third of the win in one commit.

📌 **THE GOOD NEWS: THE COMBAT HALF ALREADY POINTS THE RIGHT WAY.** This did not
need designing, only measuring:

- `thrashFame()` returns a flat **1** — a Swing win is worth 1 FP, period.
- `sonicFame(margin)` returns `max(1, ceil(margin/2))` — **the Sonic already
  scales with the margin**, so a well-set-up beam pays 2, 3, 4. That is exactly
  "powerful for the attacker because they get more powerful dice", already in the
  code.

So the Sonic is *designed* as the better Fame play and the bot fires **zero** of
them. Measured (§6.6.4): it is offered on 1.4% of action-phase decision points
and chosen never. The two halves of that are separable and both need work:

1. ⚠️ **IT IS RARELY OFFERED, AND THE GEOMETRY IS WHY.** The Sonic is a straight
   beam; the Swing is a cone. **The two Spirits stand at distance 1 for 83% of
   all turns** — jammed together, where the cone is easy and the beam needs exact
   alignment. Nothing in `evaluate` values *standing off at beam range*, so the
   bot has no reason to make a Sonic possible. This is the "devise ways to reach
   these awards" half, and it is an `evaluate` term about POSITION, not a
   scorer change.
2. **When offered, it is outscored** — the Fame it pays is a post-hit
   consequence and one-ply search prices its costs immediately.

🐛 **AND THE RIFF-OFF IS NOT MODELLED AT ALL.** `startRiffOff` lives entirely in
the monolith; `legalActions` emits no `riffOff` kind and `transition.js` has no
case for it. The engine has `applyRiffOffStarted` and the full duel resolver —
**the ONE missing piece is the trigger**, which the client raises when a Sonic
finds a rival who is beam-to-beam and in their own rig radius. So the source Alex
wants to be the LARGEST is currently invisible to both the bot and the bench.

⚠️ Note the dependency: the riff-off trigger rides ON a Sonic. Fix the Sonic and
the riff-off becomes reachable; fix the riff-off first and nothing reaches it.

---

### 6.6.4 ✅ FIXED — the riff ladder, and the exploit it uncovered

**Shipped 2026-08-17**, `policies/actionScore.js`, pinned by `npm run test:score`
(111 assertions, up from 100).

**The term.** `riffProgress(pcs)` measures how many of a riff's opening intervals
the track's TAIL already spells — on the interval diffs, so it is key-agnostic
for free, exactly as `detectRiff` is. `melodyNote` now scores
`gain * RIFF_RANK_STRIDE + noteRank`.

Four decisions worth keeping:

- ⚠️ **THE SCORER, NOT `evaluate`.** The FP already landed correctly *after* a
  riff — `evaluate` sees it on the sheet. What was missing was anything valuing a
  track one note from a trigger, so the searcher never steered toward one. §6.3's
  split names the owner: the scorer picks WHICH note.
- ⚠️ **`gain`, NOT ABSOLUTE PROGRESS.** A note is scored on what it ADDS. A note
  that leaves the tail no closer scores like one that breaks the run, because
  both are worth nothing to a riff and the planners should settle it.
- ⚠️ **A NOISE FLOOR AT k ≥ 2.** Any two notes spell some interval; with 34 riffs
  a k of 1 fires on almost every note and would drown the shipped musical
  judgement in a signal that means nothing.
- ⚠️ **A RIFF YOU CANNOT FINISH DOES NOT STEER.** `MELODY_MAX` is 8; a trigger
  needing four more intervals with two slots left is a distraction that costs
  real notes. Skipped outright rather than scored small — a small score still
  steers.

📌 The stride (32) clears the largest possible note rank (~11), so riff progress
dominates and `botNoteStepOrder` becomes the TIE-BREAK. §6.3's "preserve the
shipped tuning" is honoured rather than overwritten. Same shape as
`TENTACLE_RANK_STRIDE`.

---

#### 🐛 AND IT IMMEDIATELY EXPOSED A FIFTH BUG OF THE SAME SHAPE

The first bench after the term read **95.4%** and matches collapsed to 30 rounds.
That is the number that should have been suspicious, and it was.

**`riffBook` IS REACT STATE, AND THE HARNESS NEVER MAINTAINED IT.**
`melodyCommit` decides a riff's payout with:

```js
const isNew = !(view.riffBook ?? {})[riffMatch.riff.id];
riffAward = { …, fp: isNew ? riffMatch.riff.fp : 1 };
```

With no book, **every riff was forever new**. The same riff paid its full 2–5 FP
every single turn. Given a reason to chase riffs for the first time, the searcher
found one and farmed it straight to the 4 FP per-turn cap — **16 FP, the entire
win condition, in four turns.**

⚠️ **`?? {}` cannot tell "nobody has discovered anything yet" from "this harness
does not model discovery."** That is the identical failure to §6.6.2's
`swingChordSpent = []`, in a different file, found the same day.

Fixed in `transition.js`, which already hands back exactly this species of client
state (`unsurePool`, `fameThisTurn`): on a discovery it writes
`riffBook[riffId] = spiritId`, mirroring the client's `setRiffBook`. 📌 The book
is **global** — the value is WHO discovered it, and everyone afterwards gets the
1 FP rate. A riff is only new to the world once.

---

#### The measurement

| | before | riff ladder | + riffbook fixed |
|---|---|---|---|
| riffs matched per 1,200 commits | **0** | — | 5–6 distinct **per match** |
| Fame rate (both seats) | 0.105 FP/turn | 0.359 | — |
| matches ending by **Fame** | 1 of 8 | 8 of 8 | 8 of 8 |
| mean match length | 177 turns (89 rounds) | 60 (30) | **49 turns (25 rounds)** |
| inconclusive @ 520 | 9.8% | 0.0% | **0.0%** |
| searcher win rate | 56.3% ±4.5 | 95.4% | **96.2% ±1.7** |

✅ **The stall problem is gone — 0 inconclusive in 520 matches** — so §6.6's bar
finally sits on a denominator that does not move, which is what §5.0c asked for.

⚠️ **BUT 96.2% IS NOT A CLAIM THAT THE SEARCHER IS 96% BETTER.** `unranked` is the
same searcher with `ranked: false`, which takes `steps[0]` during composition and
therefore **never chases a riff at all**. The A/B now largely measures "does this
policy know about the riff library", which is close to a binary. It is honest
evidence that the ladder works and poor evidence about search quality generally.
🔧 A more informative opponent is `ranked: true` with the riff stride at 0.

📌 **25 rounds against Alex's reported 15–20.** In range for the first time, and
the residual has two named causes still open: the pose's FP tick is client-owned
(§3.3 unreachable headlessly) and the riff-off never starts. On the Sonic —
measured rather than assumed this time — it **is** offered, on 1.4% of
action-phase decision points, and chosen zero times. It is outscored, not
missing. 📌 A related oddity fell out of that probe and is worth someone's
attention: **the two Spirits stand at distance 1 for 83% of all turns.**

---

### 6.6.3 🎼 THE BOT HAS NEVER PLAYED A RIFF — why bench matches run 89 rounds

**Found 2026-08-17, from Alex saying "when I play, games end in 15–20 rounds
tops."** That is the second time play experience has located in one sentence
what a 2000-match bench reported as a number (§6.6.0 was the first), and it is
worth treating as a standing method rather than a coincidence: **the bench can
only report that something is slow. A player can say what is missing.**

**The arithmetic first, because it makes the gap unarguable.** At 2 players and
2 lives, `fpPerLife(2) = 8`, so `fameToWin` is **16 FP**, and `FAME_PER_TURN_CAP`
is 4. A Spirit playing at the ceiling wins in **4 turns**. Measured over a real
bench match: **0.105 FP per turn across both seats — 2.6% of the ceiling.** Fame
sat at literally **0 for the first 40 turns** while both Spirits maxed their
crowds (6♥/14👥, both caps) and banked 75 Db.

⚠️ **SO THE BENCH DOES NOT WIN BY FAME. IT WINS BY ELIMINATION** — 7 of 8 matches
ended by knockout, 1 by Fame — and elimination is slow because attacks are rare.
Every "mean match length" figure in this file is therefore describing an attrition
game, not the Fame race the game actually is.

**Where the missing Fame went — four sources, and the bot reaches none of them:**

| FP source | client site | in the bench? |
|---|---|---|
| 🎼 **Riff discovery on commit** | `melodyCommit` → `grantFame` effect | ✅ wired, **fires 0 times** |
| ✨ **Pose in the Limelight** | monolith:9906 | ❌ client-owned (`HARNESS_GAPS.pose`) |
| 🎤 **Riff-off win** | monolith:6376–6427 | ❌ needs a Sonic; the bot fires **zero** |
| ⚔️ Combat win | `awardThrashFame` | ✅ wired, ~2 swings per match |

🐛 **THE HEADLINE: ZERO RIFFS AND ZERO CADENCES ACROSS 1,218 MELODY COMMITS.**
And it is not a broken detector — that was the control. `detectRiff` fires
correctly on all six constructed lines tested, and it is generous: **key-agnostic,
interval-only, and it scans for the trigger ANYWHERE inside the committed line.**
`fate_knocks` is `C C C Ab` — four notes, 4 FP, a quarter of the win condition.
The bot commits a 4-or-5-note melody **1,367 times** out of 1,418 and never once
lands on one of 34 shapes.

⚠️ **BECAUSE NOTHING IN §5 SCORES IT.** Read the term list again: `survival`,
`fame`, `fanMult`, `perfCliff`, `drive`, `sustain`, `apBanked`, `inRig`,
`charge`, `refillDenied`, `edgeSafety`, `dbHorizon`, `rivalPose`, `targetUpside`,
`kit`, `pressure`. **`fame` scores FP already banked — no term scores the act of
earning it.** The searcher picks notes for chord quality and Performance Score and
is blind to the riff library entirely, so it plays 1,218 melodies that are
musically reasonable and worth nothing.

📌 **This is the same shape as §6.6.0 and §6.6.1 for the third time**, and the
pattern is now the most reliable predictor of a bug in this codebase:

> A whole scoring system exists in the game. The evaluator has no term for it.
> The bot therefore never uses it, nothing errors, every test stays green, and
> the only symptom is a number somewhere else that looks merely disappointing —
> a stall rate, a match length, a win rate.

⚠️ **AND IT INVALIDATES THE MUSICAL HALF OF EVERY BENCH NUMBER ON RECORD.** §1
calls the melody the game's spine. The searcher has been optimising that spine
against an objective that omits its largest payout, which means §6d's "the
searcher now prices a long melody correctly" is true about *stock and Db* and
false about *Fame*.

🔧 **The fix is a term, and it is NOT "add riff FP to `evaluate`".** A riff pays
on the commit, so a one-ply evaluator scoring the post-commit state sees the FP
land — that already works. What is missing is that **nothing values a melody line
that is one note away from a riff**, so the searcher never steers toward one. It
wants a term over the CANDIDATE TRACK during the composition phase — the same
place `actionScore.js` already picks which note to write — scoring proximity to a
trigger shape. ⚠️ That makes it an `actionScore` change more than an `evaluate`
change, and §6.3's split is exactly right about which file owns it: **the scorer
picks *which* note, `evaluate` picks *how many*.**

📌 **Two smaller ones ride along.** The pose's FP tick is client-owned, so the
whole of §3.3 is unreachable headlessly (the bot poses 16 times in 1,218 turns
and is paid nothing for it). And the riff-off — a large FP source — is gated
behind a Sonic the bot never fires. **Fix the never-fired Sonic and a second Fame
engine switches on for free.**

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
