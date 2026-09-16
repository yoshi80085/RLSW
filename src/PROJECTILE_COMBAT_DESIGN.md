# 🎸 PROJECTILE COMBAT — Design Spec

> **Status: Sonic design consolidated 2026-09-13. A partial prototype exists;
> implementation and verification are unfinished. This pass changes the design
> only. Swing and marquee redesigns are deferred to later sessions.**
>
> Replaces the opposed-sum attack roll with a **volley**: Drive is how many dice
> fly, Sustain is the shield they have to beat. Also re-points the **fan economy**
> from a Fame multiplier onto **die size**, and **deletes amp range**.
>
> ⚠️ **THIS SUPERSEDES THE COMBAT HALF OF `DRIVE_SUSTAIN_SPLIT_DESIGN.md` §5.**
> The two stacks stay; what they *resolve into* changes. Read that doc's §1–§4
> and §7 as still true, and its §5 as replaced by §3–§4 here.
>
> 📌 Companions: `MELODY_IDENTITY_DESIGN.md` rules 10 & 11 (the ending fork and
> the fans/Db split — **this spec is what gives them teeth**), `sonicRig.js`
> (the range system this deletes), `MARQUEE_QUIZ_DESIGN.md` §4 (whose payout
> this orphans — Alex has a replacement idea, not yet written down).
>
> 🔄 **REVISED 2026-09-11 (second pass, with Alex).** §3 is rewritten and **§3.5
> is new**: the Sonic **gets past** the Sustain shield instead of dismantling it,
> the stack is **untouched for the whole round**, and the chord frays **once, at
> the defender's own turn start**, by the number of rivals who made them hold it.
> ✅ Closes open decision **#2** and the **§5.4 dead corner**. ⚠️ Amends §4's
> *"a failed Sonic is nothing happening"*. ⛔ **Puts a hard dependency on the AP
> question**, which is promoted from #9 to a blocker.
>
> 🎬 **§12 IS NEW (2026-09-11): the presentation spec.** How a Sonic volley and
> a Swing actually play on screen, beat by beat — including the one rule the Swing
> lives or dies on (**never reveal the total, make it climb**) and §12.7's flag
> that Alex's "finisher" vision and §5.2's numbers do not yet agree.
>
> 📊 **§13 IS NEW (2026-09-14): THE ATTACK AXIS GRID** — all three modes rated
> across six axes, **every cell read out of the code**. ⭐ Read it before arguing
> any single axis: it is the check §3.3's *"three jobs and no fourth"* and §5.3's
> *"the two attacks competing"* were both reaching for without a table to point at.
> 🚩 It found two things on its first pass, one of them a live drift.
>
> 🎤 **§14 IS NEW (2026-09-14): the RIFF-OFF REWORK.** ⛔ **Proposal, not decided
> — one ⭐ ruling, everything else ⁉️.** The duel is a **bet, not an attack**; it is
> powered by the **Melody Line**, not by Drive, and it already was. ⚠️ **This pass
> did NOT answer the Swing question it started from** — §14.8 records that plainly,
> along with the Sonic-shield-as-HP proposal it set aside.
>
> 🎼 **§14.9 IS THE NOTE-STRENGTH MODEL** — what makes a melody note strong and how
> it wins a collision, **built entirely from arithmetic the commit already
> performs.** ⭐ Its §14.9.3 carries **Alex's recovered rationale for why the fifth
> pays most**, which existed in no file anywhere and includes a reason nobody could
> have reconstructed: *the fifth is stronger than the tonic to push players into
> changing chords often.* 🚨 **That makes `endingDb` a lever on the chord economy,
> not melody flavour — read §14.9.3 before touching it.**

---

## 0. Current Sonic contract — 2026-09-13

**This section and §12.1a–§12.1b take precedence over older discussion below.**
The user has settled the Sonic decisions needed for the first playtest. Exact
balance values below are initial values chosen under the user's delegation,
not claims that the game is balanced. No new gameplay input is required during
the cinematic; the automatic rhythm-game riff-off remains its own interaction.

### 0.1 Declaration, dice and the held shield

- Keep the existing attack budget: **2 AP and the turn's one attack token**.
  A projectile Sonic spends the **entire Drive stack**, hit or absorbed.
  Derive the dice and save the built chord before spending the stack. An empty
  Drive stack cannot fire.
- Target a visible Rival in the **three hexes directly ahead**; turn to aim.
  Amp distance does not restrict the shot or increase Sustain. A blown amp still
  disables Sonic. Projectiles originate in the owner's actual amp cabinets.
- Keep the existing automatic **rhythm-game riff-off** when the two Spirits
  mutually face each other within their beams and meet its existing conditions.
  Choose that branch before committing a projectile volley; do not also roll
  projectiles or add their upkeep bill for the same action.
  Riff-offs retain their existing costs; the full-stack projectile payment does
  not silently become an additional riff-off cost.
- **Drive chord value determines dice count; peak Casuals determine die size.**
  Do not substitute the number of notes in the stack or the number of cabinets.
- Roll once before firing. Freeze each die's final value and the Rival's effective
  Sustain for this volley. **Strictly greater than Sustain passes; ties absorb.**
  There is no defending die. Any existing reroll resolves before the final reveal
  and never counts as another volley for upkeep.
- Display the effective shield value, including existing Sustain modifiers.
  Posing deliberately drops the shield to zero. An empty shield has zero base
  Sustain; an existing root is protected by the upkeep floor, not invented when
  the stack is empty. Movement or loss of a pose during this volley does not
  reroll or reclassify its remaining projectiles.
- The Sustain chord remains intact during Sonic. At the defender's next own
  turn, remove **one tail note per incoming Sonic volley, capped at two**, with
  **one natural decay minimum** even without an attack. Never remove the last
  surviving root. Clear the pending tally after paying it. Blocked volleys count;
  hits and rerolls do not add extra bills. Swing does not add to this tally.

One incoming volley costs the same one-note upkeep as natural decay. A second
volley raises it to two; further volleys cannot raise it again. Thus a fully
absorbed shot does not always impose an additional cost beyond the bill already
due. Present the actual pending loss, not a new +1 for every declaration.

### 0.2 Contact, movement and interrupted volleys

**Passing dice and delivered hits are different counts.** A passing die has
earned a through-shot, but it earns Sonic Fame only when its wave reaches the
original Rival. Resolve absorbed shots first, then successful shots individually
in their original die order. Keep die identity throughout, even though this
presentation groups the two outcomes.

For each delivered hit:

1. Register that die's contact with the Rival and increment delivered hits.
2. Apply the incremental Vibe chip in §0.3. If this causes a knockdown, stop.
3. Attempt **one hex of push directly away from the attacker**. Continue the
   original hex direction; never bend a shove along the board edge.
4. Resolve the entered hex's hazards before the next projectile arrives. If the
   Rival is knocked down, eliminated, respawned or displaced by a hazard, end
   this volley against them.

Ending pursuit after nonlethal hazard displacement retains the existing
relocation-abort rule. It is separate from the user's new explicit ruling on
knockdown: this pass does not make missiles chase a teleported target.

**User decision: Sonic ignores the existing knockback resistance abilities.**
Goes to 11 does not prevent a Sonic push, and Intergalactic 0 does not subtract
a space from this volley. This decision concerns Sonic; it does not change the
resistance rules for other attacks or those abilities' other effects.

**Retained collision rule:** another Spirit or a board amp occupying the next
hex stops the push before entry. It causes no new collision damage or chain shove.
Remaining successful waves hit the stationary Rival and still count for Fame and
Vibe. Target selection remains as before: a bystander in the forward line does
not become a new target; the visual path routes around them.

Crossing the board edge causes **normal knockdown and home respawn, respecting
the match's elimination setting**. If the mode disables life loss, the ring-out
must not silently re-enable it. Otherwise a life is lost; a final-life loss uses
normal elimination. Retain the existing knockdown rewards and consequences.

**User decision: an early knockdown ends the volley.** Remaining waves dissipate
and never pursue the respawn. Award base Sonic Fame for **delivered hits only**;
the shot causing the knockdown/ring-out counts. Do not refund spent Drive or
duplicate the deferred shield bill. Unspent Vibe chip is discarded with the rest
of the volley. A normal knockdown's existing state resets still apply.

### 0.3 Initial playtest values

| Input or reward | First playtest |
|---|---|
| Chord scale | Rebase historical Drive/Sustain weights with `max(1, ceil((value − 1) / 2))`; retain chord rank and harmonic identity. Base values span 1–5; see examples below |
| Temporary Sonic Drive bonuses | At most +2 dice in total; existing innate chord adjustments remain. Goes to 11 sets the total to 11, rather than adding 11 |
| Die progression | Peak Casuals 0 / 3 / 7 / 12 → d6 / d8 / d10 / d12; losing or promoting Casuals never reduces an earned die |
| Existing charge modifiers | Ceiling charge raises each die by 2 sides once, capped at d12; a floor charge raises its minimum face, never adds an undisclosed bonus to a shown face |
| Base Sonic Fame | 1 per delivered hit, then existing applicable reward modifiers, rounding and match-mode caps |
| Vibe chip | 0 for zero delivered hits; 1 total for 1–4; 2 total for 5+. Apply 1 on the first contact and the second on the fifth, never on every wave |
| Maximum Vibe | Ronin and Metalness 15; Intergalactic 0 and the current Glamarchy seat 12. No roster replacement in this pass |
| Crowd Fame multiplier | Casuals add zero; keep the diehard contribution at +0.40 each and cap the multiplier at 3.0× |
| Crowd loss on knockdown | 1–2 Casuals flee; no fan theft; the diehard core and earned die size survive |
| Sustain upkeep | `min(max(incomingSonicVolleys, 1), 2, max(stackLength − 1, 0))` tail notes |

Chord examples (Drive / Sustain): single note or unmatched cluster **1 / 1**;
power chord **2 / 2**; major/minor triad **2 / 3**; diminished/augmented triad
**3 / 2**; suspended triad **3 / 3**; diminished/dominant seventh **4 / 3**;
major/minor seventh **3 / 4**; dominant thirteenth **5 / 4**; minor eleventh
**4 / 5**. Additional notes do not manufacture dice if they do not change the
evaluated chord.

**Shared tuning has shared effects.** Chord values, maximum Vibe and crowd Fame
weights also affect the existing Swing and other reward paths. These are
deliberate first-playtest starting values for the shared combat economy, not a
claim that legacy Swing balance is unchanged. Its new sum-versus-wall attack and
risk model remain deferred; implementation must check the shared consumers too.

The new Swing formula, Swing penalties, roster changes, marquee replacements,
and a new melody-ending reward are **later designs**. Keep the existing melody
rewards for this Sonic playtest; a reward already expressed as temporary Drive
feeds the dice bonus above. Do not create a new ending fork in this pass.
**Marquees are expressly parked for a later session.** Their old dice rewards
conflict with chord/crowd-derived Sonic dice, so the obsolete offer is a recorded
integration follow-up. This pass does not decide a replacement reward or removal
of quiz content.

### 0.4 Build acceptance, not a completion claim

- The live arena, client and replay must consume the same saved die results,
  resolved events and delivered-hit count. Camera timing never decides damage.
- Verify the full five-die example, all-absorbed and all-through volleys, ties,
  an empty charge, and a reroll with only one deferred upkeep bill.
- Verify one push per delivered contact, occupied destinations, Sonic against
  both former resistance abilities, hazard interruption, edge crossing, last-life
  elimination and no-elimination respawn. No remaining projectile can hit a
  fresh respawn or earn Fame without contact.
- Verify upkeep at the defender's own turn with 0–3 incoming volleys, a root-only
  chord and an empty chord. Upkeep is never paid once per projectile.
- Verify all dice remain readable through eleven dice, both players see the same
  outcome, all effects stay in the actual arena, and reduced-motion presentation
  preserves the same order and results.
- The current prototype needs these checks and the staging revisions below.
  A scripted preview or a successful bundle alone does not establish completion.

---

## 1. 🎯 THE CORE SWAP

**Today:** `atkStat + one kept-highest die` versus `defStat + one die`. Two
numbers vanish into an opposed sum and the player is told a verdict.

**Proposed:** the numbers become *objects on the screen*.

| stat | was | becomes |
|---|---|---|
| **Drive** | a modifier added to one die | ⭐ **the NUMBER OF DICE thrown** |
| **Sustain** | a modifier added to the defender's die | ⭐ **the TARGET each die must beat** |

🎸 **The fiction:** the Spirit summons and rolls its Drive dice first. Its amps
then fire the built chord as fluid Sonic waves that curl around the attacker and
travel toward the Rival. A wave is absorbed by Sustain or passes through to hit
the Spirit. Sonic never breaks a shield segment during the volley.

**Music is carried by the chord's sound and the waves' motion, not musical-note
glyphs.** A diminished seventh should sound and feel different from a major
seventh. The visual is a sidewinding waveform with a fluid wake, with no note
symbol at its leading edge. The held defence can resonate audibly on absorption
without losing any of its chord notes. See §12.1a–§12.1b for the current staging.

---

## 2. 🔢 THREE INPUTS, THREE SOURCES — and that is the point

| input | comes from | what it measures |
|---|---|---|
| **how many dice** | ⭐ the **chord** you built (its Drive value) | musicianship, this turn |
| **how good each die is** | ⭐ your **crowd** (fans) | performance, all match |
| **your numbers rising** | ⭐ **Db** (stack upgrades) | investment, banked |

⚠️ **THE CHORD VALUE *IS* THE DICE COUNT — NOT THE STACK NOTE COUNT.** Three
random notes throw ~1 die; a thought-out chord throws ~5. This is the whole
reason the theory ladder survives the redesign. 📌 An earlier pass of this
conversation had "one note, one die", which quietly made `CHORD_TEMPLATES`
decorative in combat. **Alex caught it. Do not reintroduce it.**

### 2.1 Re-basing the chord table

`music/chords.js` currently runs **drive 3–10, sustain 2–10** across 8 ranks.
As a raw dice count that is far too many dice.

⭐ **Early game: nothing above 5.** A junk chord ≈ **1**, a built chord ≈ **5**.
The ladder is not compressed away — it is **restored over the match** by the
other two inputs (Db raises the numbers, fans raise the die size) instead of
being carried entirely by the table.

**Initial curve selected under the user's playtest delegation:**
`max(1, ceil((historicalValue − 1) / 2))`. §0.3 records the resulting examples.
Future progression may extend the opening band; it is not an additional stat
purchase introduced by this Sonic pass.

---

## 3. 🔊 THE SONIC — spread

⭐ **THE SONIC GETS *PAST* THE SHIELD. IT DOES NOT DISMANTLE IT** (Alex,
2026-09-11). Sustain is a wall you shoot **through**, not a thing you take apart.

**Resolution:** roll **Drive** dice. Each die that **beats** Sustain is a beam
that got through — count them. The dice that failed were **absorbed**, and that
is the shield doing its entire job.

🎯 **NOTHING IN A SONIC VOLLEY TOUCHES THE DEFENDER'S `sustainStack`.** The beams
that penetrate hit the **Spirit**, not the guard. The guard is unchanged when the
volley ends.

### 3.1 Worked example — Alex's scenario, 2026-09-11

> Attacker at **Drive 5**, rival at **Sustain 4**. Five beams form behind the
> attacking Spirit and hurl at the rival. Rolled: **6 · 6 · 5 · 1 · 4.**

| die | vs Sustain 4 | what the player sees |
|---|---|---|
| **6, 6, 5** | ✅ through | three beams punch past the shield and land |
| **4** | ❌ absorbed | ties go to the defender (§10 #10) — it splashes |
| **1** | ❌ absorbed | splashes |

**Result, with clear ground and no interruption:** 3 delivered hits → **1 Vibe**,
**3 hexes of knockback**, and **3 base Fame** before existing modifiers. ⭐ **The rival's Sustain
is still 4 when it is over, and their chord is still the chord they committed.**

📌 **Hit count doing double duty as the knockback number** — 3 through, 3 hexes —
is the same reuse §4 is built on. Keep it. No second roll, no second table.

🎯 **And the defender gets to FEEL their defence work.** Two beams detonating
against the shield is better feedback than a shield shedding pieces. High Sustain
should look like **absorption**, not attrition.

### 3.2 ⚰️ Why "each hit breaks a segment" was killed

The first draft's line — *each success breaks one shield segment* — is **cut**.
It was a spiral, not a balance problem.

⚠️ **SUSTAIN IS DERIVED, NOT A POOL.** `battleFlow.js:264` strips notes from
`sustainStack`, then recomputes `chordOf(targetId, frayedNotes)` and reads the
new sustain value **off the resulting chord**. So stripping notes does not just
cost durability — **it lowers the target number.**

| defender's state | attacker's 5 dice need | expected hits |
|---|---|---|
| **Sustain 4** (fresh) | 5+ | **1.67** |
| **Sustain 1** (three stripped) | 2+ | **4.17** |

⛔ **A cascade with no bottom.** One good volley makes every following volley
**2.5× better** against a defender who can no longer get back up. It is the
`sonicRig.js` anti-spiral warning — hit → shrink → hit easier → shrink — rebuilt
in a new place, and **§8 deleted amp range specifically to escape that loop.**

⚠️ **AND IT STOLE THE SWING'S JOB.** A volley that strips three notes is a
can-opener fired at range with no `swingExposed`, no melee walk and no
all-or-nothing gamble. §4's item 2 would have had nothing left to open.

### 3.3 What a Sonic hit is for — and this is now the WHOLE list

1. 🏆 **Fame.** `sonicFame` — the primary Fame engine.
2. 🧭 **Position.** `sonicKnockback` — into hazards, away from pickups, off the edge.
3. ❤️ **Vibe.** `SONIC_VIBE_CAP = 2`, most hits deal 1.

All three land on the Spirit. Vibe chip can finish an already hurt Rival, and
position can cause a hazard knockdown or ring-out. Neither outcome strips the
held chord through Sonic contact.

⭐ **Three jobs is plenty. The Sonic does not get a fourth.**

---

## 3.5 🛡️ THE SHIELD — what it is, and what holding it costs

> 📌 **Numbered 3.5 on purpose.** It is new in the 2026-09-11 pass and belongs
> between the Sonic and the Swing; renumbering §4–§11 would have invalidated every
> cross-reference in this file and in the three companion docs. The gap is
> deliberate — do not "tidy" it.

⭐ **THE SUSTAIN STACK IS UNTOUCHED FOR THE WHOLE ROUND** (Alex, 2026-09-11).
However many rivals fire, however many beams land, **nothing comes off the stack
while it is bracing.** It holds until that Spirit's turn comes round again.

🎯 **THE STAT'S OWN NAME IS THE RULE.** Sustain is how long a note *rings*. A held
chord holds. It is not chipped away by being shot at — it stops ringing on its
own, later, **on your own clock.**

### 3.5.1 ⭐ The bill, and when it is paid

**At the START of your turn, before you commit anything:**

```
fray = clamp( number of rival ATTACKS the shield had to stop last round,
              1,                     ← floor: it stopped ringing anyway
              2 )                    ← user-confirmed cap, §0.1
```

- ⭐ **COUNTED PER ATTACK, NOT PER HIT.** Two rivals fired at you → **2 notes**,
  whether they landed nine beams or none. A shield that *worked* still had to be
  held.
- ⭐ **MINIMUM ONE, ALWAYS.** Nobody came at you? A note stopped ringing anyway.
  📌 This is what folds plain decay and the attack tax into **one rule instead of
  two** — the decay *is* the floor.
- ⭐ **OFF THE TAIL, CHEAPEST NOTE FIRST** (Alex, 2026-09-11 — *"tail end = the
  bottom, we are in agreement there"*). ⚠️ **NOT THE ROOT**, and
  `stackSlots.js:42` already decided this for a reason that is load-bearing:
  *"a Sustain root survives fraying and your hunt is stable across three
  opponents' turns, which is the half of the split that needs to be stable."*
  The root is `stack[0]` and it decides **which note you are hunting on the
  board**. Taking Sustain off the root hands three rivals the power to re-point a
  defender's board-hunt three times a round. 📌 The asymmetry is deliberate:
  **Drive spends the root** (your choice, your turn, your hunt re-points);
  **Sustain frays the tail** (their choice, their turn, your hunt holds).
- ⭐ **FLOORED AT ONE SURVIVING NOTE**, exactly as `chordFray` already floors.
  A Spirit at the floor is *weak*, never *undefended* — ⚠️ zero defence stays
  something you **choose** (`isPosing`, `POSE_SUSTAIN_COST`), never something
  done to you.

### 3.5.2 🎯 Why per-ATTACK and not per-HIT

⛔ **Per-hit is unbounded, and TURN ORDER decides it.** Four players; three rivals
throwing 3–5 dice each at ~1.5 landing apiece is **4–5 hits** before your turn
comes back. A `sustainStack` is 3–5 notes. It is gone — and the defender did
nothing wrong, they went early in the round and were worth shooting. ⚠️ **Act
first and you rebuild immediately; act last and you eat the whole round's fire on
a chord you cannot refresh.** Nobody chose that, and it would feel awful without
being nameable.

📌 **Deferring the bill to the defender's turn does not fix it.** It changes when
the lump arrives, not who wrote it.

⭐ **Per-attack is bounded by the player count** — 0–3 in a four-player game. That
bound is the entire reason the rule is safe, and §3.5.4 is what keeps it true.

🎯 **AND IT KEEPS SHIELD ARITHMETIC OUT OF THE TARGETING DECISION.** Under
hit-counting, optimal play becomes *"concentrate fire on whoever's chord you can
crack"* and the pile-on is self-reinforcing. Under per-attack, who you shoot is
decided by §3.3's three things — Vibe, knockback, Fame — which is where that
decision belongs.

### 3.5.3 The cap is two — confirmed for the first playtest

⚠️ **THE BILL MUST NEVER CONSUME A FULL TURN'S NOTE INCOME.** Notes per turn run
off the character's `speed` (🥷 Ronin is 4), and they already split three ways —
Drive, Sustain, and the bank. If the Sustain bill alone can reach 3, the leader
spends **everything** on upkeep and never puts a note into Drive again.

🚨 **THAT IS NOT EQUALISING A LEADER. IT IS REMOVING THEM FROM THE GAME AND
LEAVING THEM SITTING AT THE TABLE** — the worst state a four-player game has.

| cap | what it feels like | needs |
|---|---|---|
| **2** ⭐ *ship this first* | the popular target pays double the baseline; the 3rd attacker's tax is free | works at speed 3 |
| **3** | the full thematic pile-on | note income **4+**, or the leader cannot fight back |

**Decision: 2**, with a minimum decay of one and one surviving root. The table
above records the tuning rationale, not a still-open choice.

### 3.5.4 Retain one attack per turn

The bill is bounded **only** because a turn holds one attack. ⚠️ If AP ever allows
two Sonics in a turn, or if 🌀 Bushido / 🔊 Goes to 11 count as extra attacks, the
bound is gone and §3.5.2's per-hit disaster walks back in through the side door.

The Sonic pass retains the existing one-attack token and the explicit two-note
upkeep cap. It does not add extra attack actions through temporary Drive bonuses.
Any future extra-attack ability must explicitly preserve that cap.

### 3.5.5 ⭐ What this buys

- **Defence stops being free** — and the price is never set by somebody else.
- **Drive-vs-Sustain becomes a LIVE ALLOCATION EVERY TURN**, not a one-time build
  decision. 🎯 That is the choice worth making, and it was missing: the *build*
  cost existed (a note in Sustain is a die you do not throw), the *upkeep* cost
  did not.
- **Campers rot.** A Spirit posing in the Limelight already rolls a zero defence
  die; now the chord thins underneath them too. 🎯 A second answer to the camper
  that cost nothing new.
- ⭐ **A natural equaliser — and an EMERGENT one** (Alex, 2026-09-11). The leader
  pays more because **people shoot at leaders**, not because a formula read the
  scoreboard. 📌 Strictly better shaped than `underdogBonus`, which is still there
  underneath.
- **Immune to focus fire.** Nine beams or one, the cost is identical — which is
  correct: ⭐ **a shield doing its job should not consume the shield.**

### 3.5.6 🚨 The floor is now LOAD-BEARING

⚠️ `chordFray`'s *"one note always survives"* was written as a nicety. It is now
**the only thing standing between this design and zero** — turn-start fray and
Swing fray pull the same direction and nothing else stops them.

⭐ **The same floor applies to the turn-start bill.** 📌 Put a comment on it saying
what it is holding up, or somebody will "simplify" it away in six months.

---

## 3.6 🎯 THE SHIELDBREAKER BARRAGE — the Sustain shield as ROLLED HP

> 📌 **Added 2026-09-15.** Promoted out of `IDEAS_INBOX.md` (2026-09-14 entry),
> where it was parked with two objections to answer. **Both are answered below**
> (§3.6.3). Prototyped first: `.scratch/sonic-rework/BARRAGE_BRIEF.md` and the
> **Shieldbreaker barrage** preview, which Alex drove before ruling.
>
> ⚠️ **THIS SECTION REVERSES PARTS OF §3, §3.2 AND §3.5, AND IT SAYS SO OUT LOUD
> IN EACH PLACE.** Those sections are kept, not rewritten — they record why the
> first model was chosen, and a reversal you cannot see the reasoning behind is
> how this repo has lost decisions before. Read §3 first, then read this.
>
> 🧊 **The numbers below are FIRST VALUES from simulation, not playtested.**
> The rulings are real; the calibration is not frozen.

### 3.6.0 ⭐ THE RULING — what changed and why

⭐ **SUSTAIN ROLLS DICE TOO, AND THOSE ROLLS ARE THE SHIELD'S HP** (Alex,
2026-09-14). The defender's brace stops being a flat target number every Drive
die must individually beat, and becomes a **pool of hit points** the barrage
wears down.

🎯 **THE REASON IS ONE SENTENCE AND IT IS NOT A BALANCE ARGUMENT:** *"The
defender should get to do something."* Under §3 the defender draws **no RNG at
all** — `combat.js` passes `defDie: 0` and the header says so plainly. The
shield either held or it did not, and the player holding it never touched a die.
That is a participation problem, not a maths problem, and it is why this
outranked the model it replaces.

**Resolution, as prototyped and confirmed in the bench:**

1. Both sides roll their pools.
2. **Sustain dice SUM into one shield HP total.**
3. **Each Drive face is a projectile whose STRENGTH is that face.**
4. A projectile spends its strength against remaining HP. ⭐ **Excess reaches the
   Rival** — spillover, explicitly selected by Alex over the alternative where a
   partial hit is simply absorbed.
5. Once HP is zero, every later projectile delivers its full strength.
6. ⭐ **An exact break spends the whole projectile.** It breaks the shield, but
   carries nothing through and pushes nobody. 📌 This case is worth protecting —
   it is the only outcome where a defender who is beaten still walks away clean,
   and it is the most satisfying thing in the bench.

**Worked example** (the bench default): Drive `6,5,4,6,3` vs Sustain `5,4,3` =
12 HP. The shield falls 12 → 6 → 1 → 0. The third projectile carries **3**
through; the last two deliver **6** and **3**. ⭐ **Total strength through = 12.**

### 3.6.1 ⭐ STRENGTH THROUGH → VIBE, AND THE VIBE POOL GOES UP

⭐ **Sonic damage is `through / 3`. Swing damage is `margin / 2`. Vibe pools rise
to ~15** (Alex, 2026-09-15).

🎯 **WHY THE POOL HAD TO MOVE.** `SONIC_VIBE_CAP = 2` against pools of 4–5 was a
cap doing the work of a curve — *"most hits deal 1"* is a damage model with two
outcomes. A barrage produces a number between 0 and ~30 and **wants a scale wide
enough to spend it on.** 15 is that scale. ⚠️ This is a global re-base, not a
Sonic change: `maxVibe` in every Spirit def, `fpPerLife`, knockdown thresholds
and every Vibe term in `policies/evaluate.js` move with it.

📌 **The division is integer and floors.** `Math.floor(through / 3)` — so a
barrage that gets 2 strength through deals **nothing**, and that is correct:
it scratched the paint.

#### 3.6.1a 🚨 THE SUSTAIN POOL SIZE IS THE MOST SENSITIVE NUMBER IN THIS DESIGN

⚠️ **AND IT IS THE ONE THING THE BENCH DELIBERATELY DID NOT DECIDE.** The brief
lists *"how each chord/rig determines the Sustain pool size"* as unresolved and
makes both pools free-text fields. It is not a loose end — **it dominates every
other value here.** 200,000 seeded barrages per row:

| Drive vs Sustain | avg through | avg Vibe @1:3 | Sonics to down 15 Vibe |
|---|---|---|---|
| 5d6 vs **2**d6 | 10.49 | 3.17 | **4.7** |
| 5d6 vs **3**d6 | 7.15 | 2.08 | **7.2** |
| 5d6 vs **4**d6 | 4.25 | 1.17 | **12.8** |
| 5d6 vs **5**d6 | 2.14 | 0.55 | **27.2** |
| 5d6 vs **6**d6 | 0.93 | 0.22 | **66.9** |

🎯 **One die of defence is worth more than the entire damage ratio.** Moving the
Sustain pool by 1 changes time-to-down by ~60%; moving the divisor from 3 to 2
changes it by 33%. ⚠️ **Tune the pool before you ever touch the divisor.**

⭐ **PROPOSED RULE — the Sustain pool sits about TWO DICE BELOW the Drive pool.**
The pacing then holds as both sides grow, because it is the **gap** that sets it,
not the size:

| pools | avg Vibe @1:3 | Sonics to down 15 |
|---|---|---|
| 4d6 vs 2d6 | 2.04 | 7.4 |
| 5d6 vs 3d6 | 2.08 | 7.2 |
| 6d6 vs 4d6 | 2.11 | 7.1 |
| 8d6 vs 5d6 | 3.22 | 4.7 |

📌 **~7 Sonics to a knockdown** is close to today's pacing (cap 2 against a pool
of 4–5 is 3–5 hits) while being far more legible. 📌 **UPDATE 2026-09-15 — R5 SIMPLIFIES THIS QUESTION.** The fan-driven die
ladder (`sonicDieSides`) is **cut**, so both sides roll **d6 baseline** and the
only variable left is *how many dice*. See `CORE_LOOP_REWORK_BRIEF.md` §2.1.

⛔ **The mechanism that
produces "Drive − 2" is NOT decided here** — whether it falls out of chord
sustain value, of `sustainStack.length`, or of a `sustainRig()` mirroring
`sonicRig()`, is §3.6.5's first open item.

#### 3.6.1b ⁉️ THE SWING AT 1:2 — flagged, not settled

Same dice, summed, against the whole shield at once. At 5d6 vs 3d6 that is a
**91% hit rate and 3.34 average Vibe** — about **4.5 Swings to a knockdown**
against the Sonic's 7.2.

⚠️ **THAT IS 1.6×, AND §4 ITEM 1 SAYS THE SWING IS *HOW A MATCH ENDS*.** Today
one maximum Swing takes Intergalactic 0 from full to down. At 1:2 into a pool of
15 the *average* Swing is a quarter of a life bar. 📌 **The tail saves it** — a
5d6 sum can reach 30, so a maximum Swing still deals ~12 of 15 — but the identity
now lives in the variance rather than in the rule.

💡 **1:1 gives ~2.2 Swings to a knockdown**, which is much closer to §4's stated
job, at the cost of a genuinely swingy game.

⛔ **NOT DECIDED HERE, AND DELIBERATELY SO.** §14.8 already records the Swing's
place as open in both directions, and this is not the pass that closes it. 🧊 Per
`CLAUDE.md`, balance is deferred — **this is recorded as an imbalance and left
alone.** ⚠️ But note which way the error runs: the divisor chosen for the Swing
decides whether §4's first bullet is still true, so **the Swing ratio is a design
decision wearing a balance number's clothes.**

### 3.6.2 ⭐ A BREAK COSTS ONE NOTE — and this reverses §3.5

⭐ **A Sonic barrage that breaks the shield knocks ONE note off the tail of the
`sustainStack`** (Alex, 2026-09-15), matching the 2D board game: *the Sonic can
break through one Sustain shield.* The note **breaks**.

⚠️ **THIS REVERSES §3'S *"NOTHING IN A SONIC VOLLEY TOUCHES THE DEFENDER'S
`sustainStack`"* AND §3.5'S *"THE STACK IS UNTOUCHED FOR THE WHOLE ROUND."***
Say so when you read those sections; do not let them read as current.

✅ **The mechanism already exists and points the right way.** `battleFlow.js`'s
`chordFray` strips from the tail — `frayedNotes = stack.slice(0, stack.length -
fray)` — so a Sonic break is `chordFray` with `amount = 1`. 📌 **No new code
path.** And §3.5.6's floor (`Math.min(amount, stack.length - 1)`, one note always
survives) bounds it for free: **a Sonic can never empty a stack.**

#### 3.6.2a 🚨 "BROKE" IS THE WRONG TRIGGER — use "OVERWHELMED"

⚠️ **AT THE PROPOSED POOLS, THE SHIELD BREAKS 92–96% OF THE TIME.** A note off on
any break is a note off *almost every attack*, in a 4-player game, against a
defender whose stack is floored at 1. That is §3.2's cascade rebuilt at a slower
tick — which is exactly the objection this section has to answer, so it cannot
be waved through:

| trigger | 4d6 v 2d6 | 5d6 v 3d6 | 6d6 v 4d6 | 5d6 v 5d6 |
|---|---|---|---|---|
| shield **emptied** (`hp === 0`) | 96% | 94% | 92% | 53% |
| shield emptied **with spillover** | 94% | 91% | 88% | 46% |
| ⭐ **OVERWHELMED** (`through ≥ original HP`) | **53%** | **34%** | **21%** | **2%** |

⭐ **PROPOSED RULE: the note breaks only when the barrage carries through at
least as much strength as the shield had to begin with.** You did not squeak
past the guard — you buried it.

🎯 **AND THIS IS WHAT MAKES THE DEFENDER'S INVESTMENT REAL.** Look along the
bottom row: 34% against a thin brace, **2% against a full one.** The defender who
spends notes on Sustain is not buying a slightly better die — they are buying
their notes back. ⚠️ **No other trigger in the table has that shape**; "emptied"
barely moves between a 2-die brace and a 4-die one.

### 3.6.3 ✅ THE TWO §14.8 OBJECTIONS, ANSWERED

**Objection 1 — §3.2's derived-stat cascade.** *Sustain is derived, not a pool;
stripping notes lowers the target number, so one good volley makes every later
volley better against someone who cannot get back up.*

✅ **Answered, three ways, and the third is the one that does the work.**
(a) The shield is **rolled fresh every attack** — nothing carries between
attacks, so there is no state to spiral. (b) The strip is **one note, maximum,
ever**, against §3.2's killed version of one-per-hit — and §3.5.6's floor means a
stack never reaches zero. (c) ⭐ **The strip rate FALLS as the defender invests**
(§3.6.2a): 34% → 2% across two extra defence dice. A cascade requires the
defender's position to get worse faster than they can answer it; here answering
it is exactly what shuts the tap. ⚠️ **Objection 1 is answered by the
OVERWHELMED trigger and by nothing else** — adopt `hp === 0` instead and the
objection stands unrefuted.

**Objection 2 — summing dice collapses §4's count-versus-sum fork.** *"Count
them, or add them up" is the one branch a beginner has to learn.*

✅ **Answered, and the fork comes out sharper.** ⭐ **The barrage uses BOTH
numbers, for different jobs:**

| number | what it is | what it drives |
|---|---|---|
| **strength through** (a sum) | how much got past | **Vibe damage** |
| **pushes** (a count) | how many projectiles landed | **knockback, in hexes** |

🎯 **§3.1's reuse survives intact** — one hex per projectile that got through,
no second roll and no second table, exactly as written. And the beginner's branch
restates cleanly and *more* physically than before:

> **The Sonic spends its dice ONE AT A TIME against the wall. The Swing spends
> them ALL AT ONCE.** Many small, or one big.

⚠️ **BE HONEST THAT §4'S WORDING CHANGES.** "Count them or add them up" is no
longer literally the branch, because the Sonic now adds something up too. **Edit
§4's phrasing when the Swing is next opened; do not leave both sentences
standing.**

### 3.6.4 🚨 THE RE-PLUMB BILL — what actually moves in code

| site | today | under the barrage |
|---|---|---|
| `combat.js` `rollSonicVolley` | per-die `value > shieldValue`, returns `hitCount` | `resolveBarrage(drive, sustain)` — port from `barrageModel.mjs`, which is already model-checked |
| `combat.js` `applyAttackRolled` | `shieldValue = max(0, defStat)` | rolls the Sustain pool off the seeded rng; ⚠️ **two draws now happen where one did** — replay cursors move |
| `combat.js` `applyAttackRerolled` | re-draws attacker vs a fixed shield | ⁉️ **UNDECIDED: does Code Injection re-roll the shield too?** Its own doc says it *"rewrites the RIVAL'S roll, never your own defence"* — written when the defender had no roll. **Rule on it or the reroll is ambiguous.** |
| `attackParams.js` sonic branch | `defStat` = a scalar chord sustain | must emit a **`sustainPool`**; ⛔ no `sustainRig()` exists — see §3.6.5 |
| `battleFlow.js` `spaces = hitCount` | one hex per hit, stepped mid-flight | `pushes`, resolved as **one combined shove after the barrage lands** ⭐ so the target does not slide out from under airborne projectiles |
| `battleFlow.js` `knockback` `sonicHits` | `fx('sonicContact', …)` per shove step | contacts decouple from shove steps entirely |
| `combat.js` `sonicDamage(margin)` | `min(2, …)`, cap-shaped | `floor(through / 3)` |
| `combat.js` `sonicVolleyFame(hitCount)` | keyed to hit count | 🆕 must also carry Alex's **diminishing FP for repeat attacks on one target in a round** |
| `policies/evaluate.js` | scores Vibe against pools of 4–5 | ⚠️ every Vibe term re-bases against 15; **the bot bench numbers all move** |

#### 3.6.4a ✅ THE DIMINISHING-FP COUNTER ALREADY EXISTS — and it is DEAD

Alex, 2026-09-15: *"multiple attacks on a single target in a given round give
diminished returns on FP — just a little bit, but enough that the 4th player may
be discouraged from milking the player with low Sustain."*

⭐ **`pendingSonicAttacks` is exactly that counter**, incremented in
`combat.js:276` with a comment describing §3.5.1's turn-start bill.

🚨 **IT IS WRITTEN AND NEVER READ. A repo-wide grep finds ONE site — the
increment. Nothing consumes it and nothing resets it.** Two consequences, both
worth stating plainly:

1. ⛔ **§3.5.1's turn-start bill is a DOC-ONLY RULE.** The shield's upkeep cost —
   the thing §3.5.5 calls *"defence stops being free"* — **does not exist in the
   game.** ⚠️ Every argument in §3.5.5 is currently unpaid-for.
2. 🐛 **It never resets, so it is a lifetime tally wearing a per-round name.**
   Anything that starts reading it will be wrong on its first use.

📌 **Fix the reset in the same pass as the diminishing-FP rule** — they are one
counter, and 🎓 `SEQUENCING.md` §B's lesson about green suites over absent
mechanics is this exact shape.

### 3.6.5 ⛔ STILL OPEN — do not build past these

1. 🚨 **What produces the Sustain pool.** The single most sensitive number here
   (§3.6.1a) and there is no `sustainRig()` at all. Chord sustain value?
   `sustainStack.length`? A mirror of `sonicRig` with its own die-size ladder off
   fans? **Decide this first; everything else calibrates against it.**
2. ⁉️ **Whether Code Injection re-rolls the shield** (§3.6.4).
3. ⁉️ **The Swing divisor** — 1:2 as ruled, or 1:1 to keep §4 item 1 true
   (§3.6.1b).
4. ⁉️ **Board-edge and obstacle treatment for the combined shove**, and existing
   immunity interactions. The bench is an open lane and says so: *"a presentation
   fixture, not a second collision engine."*
5. ⁉️ **The exact Vibe re-base** — 15 is Alex's figure, and `fpPerLife` and the
   knockdown thresholds have not been re-derived against it.

📌 **What is NOT open:** the resolution model (§3.6.0), spillover, the exact-break
rule, that a break costs one note, and that damage comes off the sum while
knockback comes off the count. Those are ruled.

---

## 4. 🗡️ THE SWING — concentrated

### 4.0 ⭐ WHAT THE SWING IS — ruled 2026-09-15

> 🚨 **READ THIS BEFORE THE REST OF §4.** Everything below §4.0 was written
> against the pre-barrage model and a Vibe band of 4–5. It is **historical
> rationale**, kept for its reasoning, and it is **not a current specification**.

⭐ **THE SWING CONVERTS CONTACT INTO DAMAGE, AT THE COST OF COMMITTING YOURSELF
TO THE BRAWL** (Alex, 2026-09-15).

🎯 **THE DIFFERENTIATOR IS COST, NOT EFFECT** — and that is what finally
settles §5.3-versus-§14.8. Those two sections deadlocked because both tried to
tell the Swing apart by *what it does*: §5.3 said the shield-break was the point,
§14.8 recorded Alex reversing to *"still the big Vibe hitter."* **It is both.**
What stops it eating the Sonic's lunch is that you have to be standing in the fire
to use it. ⚠️ **It must not compete with the Sonic on range or on Fame.**

| | 🔊 Sonic | 🗡️ Swing |
|---|---|---|
| **verb** | project force | commit to physical dominance |
| **damage** | low | **high** |
| **push** | **high** (1–5) | low |
| **Fame** | **the engine** | almost none |
| **cost** | 1 AP + 1 Drive note, hit or miss | 1 AP + **2** Drive notes, hit or miss |
| **failure** | ⭐ **a spent shot** — nothing happens | ⭐ self-damage, displacement, **Fame to the defender** |

⭐ **When you reach for it:** the rival is low on Vibe and needs finishing · you
want to damage rather than push · their Sustain stack is large and worth fraying ·
a Sonic would shove them out of reach · you have a positional lock (adjacent,
behind them, near a wall or another body). 📌 **"Behind them" already pays** —
`isRearHit` and `REAR_FRAY_BONUS` are wired.

⚠️ **DO NOT ADD PUNISHMENT** (Alex): *"The risk should be readable as 'I may lose
the exchange and get shoved out,' not 'one failed Swing destroys my character.'"*
🚨 **But the Vibe re-base to 15 REMOVED punishment without anyone choosing to** —
`THRASH_WHIFF_DMG` is a flat **1**, which was 20–25% of a 4–5 pool and is **6.7%**
of 15. 🎯 **The ruling is satisfied by RE-SCALING what exists, not by adding
anything.** See `CORE_LOOP_REWORK_BRIEF.md` §2.6.

⚠️ **AND §4'S OWN BRANCH NEEDS REWORDING.** *"Count them, or add them up"* is no
longer literally true — §3.6 makes the Sonic sum too. The replacement: ⭐ **the
Sonic spends its dice ONE AT A TIME; the Swing spends them ALL AT ONCE.** Many
small, or one big. 📌 §3.6.3 carries the full argument.

⚠️ **§4.1 IS NOW PARTLY REVERSED.** *"A SONIC CANNOT REACH A HELD CHORD. A SWING
CAN"* stopped being absolute when §3.6.2 gave the Sonic a one-note break. Degree,
not kind — but §4.1's own argument still applies at reduced force and is
**unanswered**, not waived.

⚠️ **AND IN A ROUND-LIMITED MATCH, §4 ITEM 1 IS FALSE.** *"It is how a match
ENDS"* — nothing ends the match but the buzzer. ⭐ **The Swing is how you take a
scoring turn away from a rival who was about to out-earn you**, which fits the
ruling better and puts the value on timing: a knockdown on round 9 is worth far
more than the same knockdown on round 2.

⛔ **Open, and listed at `CORE_LOOP_REWORK_BRIEF.md` §2.5–§2.6:** the divisor
(1:2 as ruled gives ~4.5 Swings to a knockdown against the Sonic's 7.2; 1:1 gives
~2.2), whether the Swing sums against the **rolled** shield, and the re-scaled
whiff number. ⛔ **Deferred by the ability freeze:** multi-target and
note-sweeping — `IDEAS_INBOX.md`.

---

> **Deferred design discussion — ⚠️ HISTORICAL, SUPERSEDED BY §4.0 ABOVE.** The old
> 4–5 Vibe comparisons and proposed penalties in this section are historical
> rationale, not new Sonic rules or a finished Swing specification.

⭐ **Alex's image:** the amps fire the charge **into the player** instead of at
the rival — the guitarist winds up on the feedback and swings. 📌 This is
literally PK Thunder curving back into Ness, and naming it that way is what
makes the pair read as designed rather than assembled.

**Resolution:** roll **the same dice**, but **SUM** them. The total must beat the
**whole shield at once**.

🎯 **SAME HANDFUL OF DICE, SAME THROW, READ THE OTHER WAY.** A beginner learns
one action and one branch — *count them, or add them up*. This is what stops the
game having two unrelated combat systems.

**What it is for:**

1. 💀 **It is how a match ENDS.** `THRASH_DAMAGE_CAP = 4` against Vibe pools of
   4–5 — one maximum Swing takes Intergalactic 0 from full to knocked down,
   where the Sonic would need four or five hits. And a knockdown burns a life,
   teleports them home, and scatters their crowd. ⭐ **Under §6 it therefore
   damages their DICE PROGRESSION** — the only move in the game that attacks an
   economy rather than a health bar.
2. 🛡️ **It BREAKS the shield rather than chipping it.** `chordFrayAmount` strips
   2 notes at margin ≥3, 3 from behind (`REAR_FRAY_BONUS`), floored at 1
   surviving. 🎯 That makes the Swing a **can-opener** — and in a 4-player game a
   *social* move, because everyone else's Sonic lands for the rest of the round.
3. 🎭 **It is the only answer to a camper.** A Spirit posing in the Limelight
   rolls a **zero** defence die (`isPosing`) while hoovering Fame, and cannot be
   chipped out of it fast enough. The Swing costs you a walk into their face and
   `swingExposed` (−1 Sustain until your next turn).

⭐ **BOTH ATTACKS COST THE WHOLE CHARGE** (Alex, 2026-09-11). They are literally
spending energy to attack. ⚠️ **And the Swing must pay on a WHIFF too.** Today
`physicalDriveSpend` charges on a hit only, which makes swinging free to attempt;
under an all-or-nothing model that is fatal — you would Swing every turn and
never fire. `THRASH_WHIFF_DMG = 1` already exists as the humiliation tap: you
wound up, they blocked, the feedback blew back into you.

📌 **A failed Sonic is nothing happening. A failed Swing is you being in trouble** —
empty, guard down, standing in melee range.

📌 **`thrashDamage(margin)` already means "how far past the shield did you get"**
(1/2/3/4 by band). It was written for the old system and says exactly what the
new fiction needs. Nothing to invent.

---

### 4.1 ⭐ THE SWING IS THE EXCEPTION — and that is its whole identity

⭐ **A SONIC CANNOT REACH A HELD CHORD. A SWING CAN** (2026-09-11). The Swing
frays **immediately, on the attacker's turn, the moment it lands** — it does not
wait for the defender's turn-start bill.

🎯 **§3.5's "the stack is untouched all round" is exactly what gives this teeth.**
One rule, one exception, and the exception is the marquee move. If Sonic hits also
chipped notes, the Swing would be nothing but a faster way to do what everybody is
already doing at range — and §5.3's "they compete" problem would still be open.

🎭 **AND IT IS WHAT MAKES THE SWING SOCIAL.** It lands on your turn, the rival's
chord frays *now*, and **everyone else gets to shoot a weakened target before that
rival's turn comes round.** §4's can-opener (item 2), with a clock on it.

⚠️ **NO DOUBLE-CHARGING.** A Swing takes its notes on the spot through
`chordFrayAmount`; it does **not** also count toward that defender's turn-start
tally. ⭐ **The turn-start count is SONICS ONLY.**

✅ **And this is the one place `chordFrayAmount(margin, fromBehind)` survives the
redesign untouched** — the Swing still has a real margin (sum vs wall), so its
input never changed. 📌 One row of §9's "margin re-plumb" bill that does not come
due.

### 4.2 ⁉️ THE RISK MODEL — DISCUSSED 2026-09-11, **NOT DECIDED**

Alex: the Swing is the Hulk Smash move and *"it should definitely come with some
risk."* 💡 His opener was **a cooldown on all attacking abilities after a Swing**.

🪦 **The cooldown was argued against and not adopted** — see §11. What follows is
a **counter-offer on the table, not a decision in the spec.**

📌 **The principle:** the Swing attacks an *economy* (§4 item 1), so a failed Swing
should cost **your** economy — immediately, on the board, **scaled to how hard you
wound up.**

| price | shape | why |
|---|---|---|
| 💥 **Recoil scales with the dice** | `THRASH_WHIFF_DMG` becomes `ceil(dice/2)`, not a flat 1 | a desperate 2-die swing stays cheap to attempt; a 5-die wind-up that misses genuinely hurts. ⚠️ A flat price charges the same for a 1-die poke and for 🔊 **Goes to 11's ELEVEN dice** — making the biggest swing in the game the *cheapest* to gamble |
| 🛡️ **The guard drops to ZERO, not by one** | `swingExposed` −1 Sustain → target number **0** until your next turn | −1 is a rounding error. At zero you become, for one round, **exactly the camper the Swing exists to punish** — the same state `isPosing` puts a poser in. 🎭 And in a 4-player game everybody acts before you do |
| 🎸 **The whiff shatters the CHORD, not just the charge** | the Drive stack is knocked back toward the root on a miss | 📌 Precedent: `PSYCHO_BUSHIDO_STACK_COST`, *"the only price in the game paid in PROGRESSION currency."* 🎯 **This IS the cooldown Alex asked for** — you can swing again next turn, it will just be a 1-die swing. The recovery time is however long the rebuild takes, which the player controls and which routes **through the melody system instead of around it** |

🎯 **Why outcome-keyed beats a timer:** §5.2's table runs from 0% to 100% depending
on matchup. If the player can see the wall and their dice, *"is this worth it"* is a
live decision every single time. ⚠️ **A flat cooldown costs the same at 90% and at
5%, which flattens the only interesting part of the move.**

⁉️ **Alex's call. Nothing in this subsection is decided.**

---

## 5. 📊 THE NUMBERS — computed, early game

Drive 1–5 dice on **d6**, Sustain 1–5. Sonic has no shield-segment pool.
The Swing tables retain the historical candidate wall for its later design pass.

### 5.1 Sonic — expected passing dice per volley

`Drive × max(0, 6 − Sustain) / 6`. These become delivered hits if the volley is
not interrupted. The old table incorrectly retained a three-segment ceiling;
Sonic has no three-hit cap.

|  | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|
| **D1** | 0.83 | 0.67 | 0.50 | 0.33 | 0.17 |
| **D2** | 1.67 | 1.33 | 1.00 | 0.67 | 0.33 |
| **D3** | 2.50 | 2.00 | 1.50 | 1.00 | 0.50 |
| **D4** | 3.33 | 2.67 | 2.00 | 1.33 | 0.67 |
| **D5** | 4.17 | 3.33 | 2.50 | 1.67 | 0.83 |

### 5.2 Swing — P(sum beats the wall), wall = Sustain × 3 segments

|  | S1 (w3) | S2 (w6) | S3 (w9) | S4 (w12) | S5 (w15) |
|---|---|---|---|---|---|
| **D1** | 50.0% | 0% | 0% | 0% | 0% |
| **D2** | 91.7% | 58.3% | 16.7% | 0% | 0% |
| **D3** | 99.5% | 90.7% | **62.5%** | 25.9% | 4.6% |
| **D4** | 100% | 98.8% | 90.3% | 66.4% | 33.6% |
| **D5** | 100% | 99.9% | 98.4% | 90.2% | **69.5%** |

### 5.3 🚨 TWO PROBLEMS THESE NUMBERS EXPOSE

⛔ **1. THE WALL FORMULA IS UNSTABLE, AND IT IS THE BIGGEST OPEN ITEM.**
`Sustain × segments` multiplies two growing numbers, so it outruns a sum of dice
almost immediately:

| shield | D3 vs S3 | D5 vs S5 |
|---|---|---|
| **3 segments** | 62.5% | 69.5% |
| **5 segments** | 4.6% | 1.6% |

🎯 **Three segments and the Swing dominates; five and it is impossible.** That is
a knife edge, not a dial. The wall needs a shape that grows more slowly than the
dice sum — a fixed multiplier (`Sustain × 3`), an additive form
(`Sustain + segments`), or something else. ⁉️ **Unresolved. Decide this before
anything else in this spec.**

#### 5.3.1 🆕 RE-EXAMINE THIS BEFORE SOLVING IT (2026-09-11)

🎯 **"Segments" existed so the Sonic would have something to chip. §3 says the
Sonic no longer chips anything.** So ask the prior question first: **does the
shield still have segments at all?**

If it does not, the wall is a function of the **chord alone** — and the knife edge
in the table above is an **artifact of a concept that no longer has a job**, not a
real tuning problem. ⭐ **Do not tune `Sustain × segments` until somebody has
checked whether `segments` still refers to anything.**

✅ **2. THE TWO ATTACKS COMPETING — CLOSED 2026-09-11.**

The problem was real: at 3 segments, D3 vs S3 had the Sonic breaking 1.5 segments
on average and the Swing breaking all 3 at 62.5% — 1.88 expected — **and doing big
Vibe damage on top.** "Reliable grind versus risky haymaker" did not hold.

⭐ **Resolved by SEPARATING THE JOBS, not by nerfing the Swing's payoff.** §3: the
Sonic attacks the **Spirit** (Vibe, knockback, Fame) and cannot touch a chord.
§4.1: the Swing attacks the **chord**, and is the only thing in the game that
reaches a held one. They stop competing because they are **no longer aimed at the
same thing.**

📌 **This went the OPPOSITE way to the guess recorded here** (*"the Swing's payoff
should be Vibe damage, not shield-breaking"*). That would have handed the Swing
the Sonic's job instead of giving each its own. The shield-breaking is what makes
the Swing a **can-opener and a social move**; it is the part worth keeping.

Both proposed attacks spend their whole Drive charge, so neither keeps that
charge after firing. Their distinction must come from their outcomes and risk,
not an assumption that Sonic preserves the stack.

### 5.4 Fully absorbed volleys and the upkeep floor

Against Sustain below the die's maximum face, even one Sonic die has a chance to
pass. If the effective Sustain reaches or exceeds that maximum, the shot is
fully absorbed unless a valid modifier changes the comparison.

A fully absorbed volley deals no Vibe, causes no push and earns no Sonic Fame.
It spends the full charge and counts once toward upkeep. Because upkeep already
has a natural minimum of one and a cap of two, only the second incoming volley
increases that bill above the existing baseline (and only if enough tail notes
remain). The former claim that every doomed shot necessarily taxes the Rival
was incorrect. Keep the confirmed upkeep formula and make a no-through-shot
matchup visible before the player spends their Drive.

### 5.5 Vibe — first-playtest values selected

A landed Swing averages **~2.5 Vibe**; a landed Sonic **~1.2**. Against pools of
4–5, a Spirit dies to **two** connected Swings.

⭐ **Alex: 4–5 are "wimpy numbers" and Vibe goes up.** For a knockdown to be an
earned event of three or four solid connections rather than two lucky ones, the
band to tune against is **12–15**. §0.3 selects 15 for Ronin/Metalness and 12
for Intergalactic 0/the current Glamarchy seat, under the user's playtest
delegation. Swing's eventual damage bands must be tested against this band.

---

## 6. 🎤 THE FAN ECONOMY — re-pointed

⭐ **Casuals no longer multiply Fame. They set your DIE SIZE** (d6 → d8 → d10 →
d12 at thresholds); **diehards keep the Fame multiplier** they have today.

🎯 **WHY THIS IS BETTER THAN THE 2026-09-02 RE-WEIGHT, AND FOR THAT PASS'S OWN
REASON.** `gameConstants.js:556` records the finding: one Casual moved a 3 FP
payout from 3.87 to 3.96 — *"a fan you cannot feel is not an economy."* The
re-weight made the coefficient bigger; it is still a multiplier landing inside
`Math.round`. **A die upgrade cannot be rounded away.**

⭐ **THE PIPELINE ALREADY EXISTS AND IS WHY THE SPLIT WORKS.** `economy.js:428`
— promotion **consumes** a casual (`casuals -= 1; diehards += 1`) and requires a
`centerStreak`. So the two bands are not parallel tracks, they are one chain:

```
clean melody, anywhere  →  CASUALS  →  peak casuals set your DIE
                              │
                     hold the Limelight 3 turns
                              ▼
                          DIEHARDS  →  Fame multiplier
```

🎯 Losing casuals never costs you dice you have earned — but it starves you of
the raw material for diehards, so a bored crowd still costs you future Fame.
**That is the late-game pressure, and it needed no new system.**

🎯 **And the two halves are already paid for differently.** `FAN_GAIN_BY_RING`
gives casuals for a clean commit *anywhere*; promotion demands three consecutive
turns in the **Limelight**, which is where `isPosing` zeroes your defence roll.
**Dice are earned safely. Fame is earned exposed.**

### 6.1 ⭐ Decided rules

- ⭐ **THE DIE ONLY EVER GOES UP.** It tracks a high-water mark, never the live
  crowd. ⚠️ **Without this you get a doom loop**: knocked down → crowd flees →
  smaller die → hit weaker → knocked down. That is the same spiral `sonicRig.js`
  already warns about for the radius, rebuilt somewhere new.
- ⭐ **FANS CANNOT BE STOLEN.** `FAN_DEFECT_TO_VICTOR = 2` is **cut**. ⚠️ Under
  fans→dice it would move **permanent** combat power from loser to winner on one
  lucky roll — the worst possible thing to attach to a ratchet.
- ⭐ **A KO costs a few casuals, lightly.** `FAN_FLEE_MIN/MAX` reduced; the
  diehard core does not scatter.
- ⭐ **Progression is personal and self-paced**, not a shared venue clock (Alex,
  2026-09-11). 📌 The runaway-leader worry is answered by the maths: in an even
  fight the die ladder pays **+29 / +14 / +6** points across d6→d8→d10→d12 —
  **each step is worth about half the last**, so the field compresses on its own
  and `underdogBonus` is still there underneath.
- 💡 **Fans can never be TAKEN, but they could be SPENT** — the Genki Dama /
  Spirit Bomb move: the room lends you everything for one colossal attack, and
  the meter refills. Gives fans an infinite sink past d12. ⁉️ Not decided.

### 6.2 ⚠️ Two things to fix if this ships

- ⚠️ **`FAN_MULT_CAP` becomes a fake cap again.** Diehards alone top out at
  6 × 0.40 = **3.4×**, while the cap sits at **5.0** and binds nothing. That is
  precisely the failure the file's own comment documents about the old 2.0. Either
  re-weight diehards up (~0.67) or drop the cap to ~3.5 — **do not leave a number
  that never binds.**
- ⚠️ **Promotion becomes a chore, not a choice.** Because the die reads *peak*
  casuals, spending one on a diehard costs nothing, so promoting is always
  correct. The tension lives in the centre streak (the exposure), not the
  conversion. Fine — but know it.

### 6.3 🚩 The back-door discord penalty

`melodyCommit.js:102` — `positionFanGain` returns `null` unless the track is
**clean**, so a dirty melody earns **no positional fans at all**. Today that
costs a Fame multiplier; under §6 it costs **progress toward permanent combat
power**. ⚠️ **That quietly re-arms the discord penalty declared inert on
2026-09-09** (*"no Db, no fans, no power to resolve an ending"*). Probably right
for a music game — but it must be a decision, not a side effect.

---

## 7. 🎼 THE MELODY FORK — now with teeth

⭐ `MELODY_IDENTITY_DESIGN.md` **rule 10** (the ending is a fork: Db, or the
red/blue Drive/Sustain carrot) and **rule 11** (fans pay for *how*, mid-line; Db
pays for *which* and *where*, at the end) were both decided **2026-09-09**. Alex
re-derived the same fork from the combat side on 2026-09-11 without looking.

🎯 **This spec is what makes the fork agonising.** The melody now pays into
combat at **two moments on two time horizons**:

- **mid-line shape → fans → die SIZE.** Permanent, ratcheted, slow.
- **the landing → the fork → Db, or more Drive NOW.** Immediate, spent, gone.

📊 **The leverage, computed.** One extra die is worth **+28.9 points** of win
chance at 3-vs-3 on d6, decaying to **+7.4** at 5-vs-5 on d10. A flat +1 on the
total is worth only **+9.3** falling to **+2.2**.

**Deferred with the melody-ending redesign.** For this Sonic playtest, an
existing reward expressed as temporary Drive changes the dice count under the
+2 bonus cap (§0.3). Do not invent a separate bonus added to a settled die face.
The proposed new ending fork and its payout are not being built in this pass.

📌 **The leverage is loudest at the START of a match** (+29 on turn three, +7 in
the endgame). The moment that teaches the lesson is the most dramatic one the
player will ever get. Most games do this backwards.

⚠️ **Rule 10's own warning stands:** the fork must not inherit the Harmonic Lock
cliff (`melodyCommit.js:441` — a non-standard ending forfeits the lock too, so a
colour ending costs up to 6 Db, not 3). A fork where one prong secretly costs
extra Db is not a fork.

---

## 8. Amp radius is deleted; three-hex aiming remains

⭐ **Amps have free range. There is no radius.** `rigRadius`, `inRange`, the
out-of-rig d4 (`SONIC_DEF_DIE_OUT_OF_RIG`), the neon ring in `board/ampDecks.jsx`
and the `distFromHome` reads all go.

🎯 **This also deletes the anti-spiral `sonicRig.js` flags in its own comments** —
Sustain frays when hit → the rig shrinks → the defence die shrinks → harder hits.

**User decision: keep the three hexes directly ahead and turn to aim.** The amp
can reach its owner anywhere on the board; the Spirit cannot target an arbitrary
Rival anywhere on the board. There is no distance surcharge to Sustain. Position,
facing, hazards and the space behind the target remain central to the shot.

---

## 9. 💥 WHAT THIS BREAKS

| system | what happens |
|---|---|
| 🎪 **Marquee quiz** | ⛔ **Its entire payout is orphaned.** `rigPool`/`rigPower`, `rigTierSpend`, `rigAtrophyTick`, `RIG_TIER_MAX` exist only to grow the Sonic pool and die. 📌 Alex has a replacement idea for the marquees — **not yet written down.** |
| 🗡️ **Bushido** | **+2/+3/+4 Drive** across its window = +2/+3/+4 **dice**. At ~+26 points per die that is an auto-win. Built 2026-09-05; `test:bushido` 108 + `test:bushidoui` 331 encode the old model |
| 👤 **Shadow Illusion** | "drinks Sustain" now raises the defender's own target number rather than eating segments — ⚠️ **re-read against §3 before costing it**; the old "eats segments" reading is dead |
| 🔊 **Goes to 11** | *sets* Drive to `ELEVEN_DRIVE = 11`. **Eleven dice.** |
| ⚠️ **`ATK_BONUS_CAP = 5`** | caps stacked bonuses at +5 **dice** — a cap that caps nothing meaningful. The "cap with an exemption" pattern again, in a new place |
| 💥 **`smashExposed`** | zeroes Sustain → target number 0 → **every die hits, guaranteed.** Deterministic where it used to be a roll |
| 🤖 **The bot** | every heuristic in `evaluate.js` and the searcher's attack scoring reads the old math |
| 📐 **margin** | `sonicFame`, `sonicKnockback`, `sonicDamage`, `underdogBonus` re-plumb onto **hit count** (§3.1). ✅ **`chordFrayAmount` comes OFF this list (2026-09-11)** — fray is Swing-only now (§4.1) and the Swing still has a real margin (sum vs wall), so its input never changed |

✅ **THE ONE SAVING: the overdue Ronin re-bench should be CANCELLED, not
scheduled.** There is no point measuring him against a combat system being
replaced — the numbers would be obsolete before they finished printing.

---

## 10. Decision status and later sessions

**Sonic's first-playtest design is settled in §0 and §12.1a–§12.1b.** The latest
user decisions are Sonic first, delivered-hit Fame after early interruption,
and one-space Sonic pushes without the old ability-based resistance. Confirmed
earlier: three-hex forward targeting, automatic riff-offs, two-note upkeep cap
with natural decay, ordinary mode-aware ring-outs, and delegated initial tuning.

The following are **deferred, not decisions to guess during Sonic implementation**:

| Later topic | What remains to decide |
|---|---|
| Swing | Wall formula without obsolete segment multiplication; miss penalty; damage and immediate shield fray; tie rule; optional timing input. ⚠️ **2026-09-14: reopened and NOT resolved** — Alex's *Smack-down* image and *"still the big Vibe hitter"*, which is §5.3's closed decision proposed in reverse. See §14.8 |
| 🎤 **Riff-Off** | ⭐ **NEW 2026-09-14, §14.** What is wagered (the melody's Fame?); whether discord notes become weak projectiles; whether the defender calls with their own committed line; knockback; migrating Vibe off the legacy table. 🚨 **§14.7's bot tempo gap blocks the escalating structure** and is not a balance deferral |
| Marquees | Replacement for the obsolete pool/power upgrade payout and treatment of that existing offer; explicitly left for a later session |
| Melody ending | The new ending fork and its reward; existing temporary Drive feeds Sonic dice for this playtest |
| Roster and abilities | Roster replacement, broader kit redesigns and balance; keep the current cast for the first Sonic playtest |
| Future fan spending | Whether earned crowd can fuel a special attack; no new fan-spending mechanic here |

**Integration work still matters.** The older §9 lists callers to audit; it is
not authorization to redesign those features or proof they have been migrated.
In particular, the prototype's aggregate push/damage and hit-count Fame must be
reconciled with individual delivered contacts. Review the current client and
replay together rather than treating the prototype as the final rules.

---

## 11. 🪦 REJECTED, AND WHY

- 🪦 **The hidden bid / feint** (both players secretly commit notes; the attacker
  can fake a big swing). ⚠️ Needs hidden simultaneous commitment, which is the
  most expensive thing to add to a seeded-RNG replay architecture with desync
  checks. The bot has no tell and cannot be read, so the bluff collapses into
  expected-value maths it always wins. And it fires on somebody else's turn,
  three times a round. 🎯 **The tension already exists, earlier and in public:**
  you can see a rival's Drive stack filling and choose whether to armour up. A
  feint played across turns is a better lie than a hidden bid, because you have
  to keep telling it.
- 🪦 **A shared "venue" die** that grows for everyone on a match clock. Alex,
  2026-09-11: fans should be earned at each player's own pace and rewarded.
  §6.1's diminishing ladder is what answers the runaway worry instead.
- 🪦 **A cooldown on all attacking abilities after a Swing** (Alex's opener,
  2026-09-11 — discussed, not adopted). ⚠️ **The Swing already has a cooldown and
  it is called the Drive stack:** §4 spends the whole charge, so you are empty and
  must rebuild before you can do anything meaningful. A round-counter on top prices
  the same restraint **twice** — the `ATK_BONUS_CAP` / `PSYCHO_BUSHIDO_CD`-and-a-
  literal-`2` pattern in a new place. It also **punishes the hit and the whiff
  identically**, which turns a gamble into a tax; it **re-splits the two attacks
  into two systems** just as §4 finished making them one action with a fork; it
  charges the same for a 1-die poke and for 🔊 Goes to 11's **eleven dice**; and in
  a 4-player game a round you are forbidden to attack is a round of **spectating**,
  which is a worse failure state than losing. 🎯 §4.2's outcome-keyed prices are the
  counter-offer.
- 🪦 **Sonic hits stripping notes from `sustainStack`** — whether billed per hit
  as they land, or accumulated and billed at the defender's turn start. §3.2 and
  §3.5.2. The target number is **derived from the chord**, so stripping notes makes
  the next volley land harder: a cascade with no bottom, and **turn order decides
  who keeps a chord**. 📌 Deferring the bill does not fix it — it changes when the
  lump arrives, not who wrote it.
- 🪦 **Fraying Sustain from the ROOT end** (`stack[0]`) rather than the tail.
  §3.5.1. `stackSlots.js:42` already decided the tail and the reason is
  load-bearing: the root decides **which note you are hunting on the board**, and
  Sustain takes its damage on **other people's** turns. Root-end fray would let
  three rivals re-point a defender's board-hunt three times a round. ⭐ Drive spends
  the root (your turn, your choice); Sustain frays the tail (their turn, your hunt
  holds).
---

## 12. 🎬 HOW AN ATTACK LOOKS — the presentation spec

> **Status: Sonic staging specified; prototype incomplete.** §12.1a records the
> user's direction and §12.1b makes it reviewable for a future implementation.
> ⭐ **§12.1c is a DECISION, not a proposal** — the projectile is the ring beam,
> signed off 2026-09-13 off a live preview, and it corrects one line of §12.1b.
> Swing staging and its mechanical questions remain deferred.

### 12.0 ⭐ THE STRUCTURAL PROBLEM, and the one rule that solves it

Sonic travels across the arena as a volley, then resolves in a readable sequence:
absorptions first, individual through-shots second. The dice are fully revealed
before firing. The proposed Swing instead accumulates a sum vertically; its
"never reveal the total, make it climb" direction is **Swing-only** and must not
hide Sonic's resolved faces.

### 12.1 🔊 The Sonic — Alex's picture, 2026-09-11

> *"Different camera angles zooming and watching the Sonic attacks blast from the
> amps around the attacker and into the Rival Spirit's shield — or breaking
> through to the Rival."*

⭐ **The two outcomes must look completely different**, because §3 made them
different: a beam is **absorbed** (it detonates against the shield, which flares
and holds) or it **goes past** (it reaches the Spirit). 🎯 **This is where a
defence becomes visible** — §3.1: the defender gets to *feel* their Sustain work,
and high Sustain should read as **absorption**, not attrition.

Three delivered shots across clear ground produce three one-space pushes (§0.2).
The camera follows **each** impact and push, not a final bulk shove. A failed
projectile bursts at the held shield without stripping a note.

### 12.1a 🎬 Next-session staging notes — user direction, 2026-09-13

> **Recorded user direction; design only in this pass.** Implementation remains
> a separate task. §0 resolves the subsequent gameplay questions.

The camera should follow the combat sequence inside the 3D arena. Show both
players the resolved die faces first, with enough framing time that every number
is readable. The dice results must remain the source of truth for what follows:
each passing die becomes one through-shot and each failing die becomes one
shield impact.

The projectiles should read as sidewinder missiles made from the player's Sonic
wave, with no musical-note glyph flying in front of them. They should fire from
the owning amp stacks, curl around and past the attacking Spirit, and cross the
arena toward the Rival's Sustain shield. The chord is heard through the actual
sound of the volley: use the attacker's built chord as the Sonic sound, with
per-projectile pitch/colour/motion derived from that chord. Do not add a separate
note-shaped projectile symbol.

After the missiles pass the attacker, shift into a brief readable slow-motion
beat. Resolve absorbed missiles first: show the wave form bursting against the
Sustain shield and failing. Then resolve through-shots one at a time. Each
successful impact should be legible as its own hit, followed immediately by the
Rival Spirit being pushed back one space. Keep the cadence quick enough to avoid
lag while giving the table time to understand the die-to-projectile result.

The camera should choose the most cinematic sensible framing at each beat:

1. Frame both Spirits and the dice during the roll/reveal.
2. Follow the amp muzzle and the missile arcs as they wrap around the attacker.
3. Track the shield-facing side for absorbed impacts, with the burst held long
   enough to read as a failed shot.
4. Follow each through-shot into the Rival and pull back with every hex of
   knockback, including the final ring-out/respawn beat when applicable.

All of this remains in the arena scene; there is no separate combat overlay.

### 12.1b Shot plan, sound and readable outcomes

The camera should preserve the viewer's understanding of where both Spirits are.
Use one consistent side of the attacker–Rival line, smoothly handing focus from
dice to cabinets to leading wave to shield to moving Rival. Do not randomly
orbit, cut through scenery or frame empty space because a target was pushed.
Favour readable action over an angle that hides a die face or an impact.

| Beat | In-scene action and camera | Initial pacing target |
|---|---|---|
| Summon | Dice emerge from the attacking Spirit. Frame the full dice group, shield threshold and enough arena context to locate both players | About 0.5 s |
| Roll and reveal | Visible tumble, then stable front-readable faces. Hold every final number; show which beat Sustain, including ties. Through-shot identity must remain traceable to its die | About 1.2 s rolling + 1.0 s settled |
| Fire and wrap | Move focus to the real owned cabinets as they pulse and fire. Track the leading waves across the arena, around and past the attacker. Retain the attacker in frame during the wrap | Roughly 1.2–1.8 s; tune for travel distance |
| Slow-motion transition | Once the waves clear the attacker, ease down time and bring the shield into a close, readable angle | About 0.4 s transition, not a pause |
| Absorptions | Resolve failing dice first. Each wave flattens, curls and bursts across the shield surface; the held chord remains whole | Roughly 0.2–0.3 s between bursts |
| Through-shots | Resolve successful dice individually. Camera follows contact, then the Rival's one-space push. Remaining waves curve toward the Rival's new location without changing their saved verdicts | Roughly 0.45–0.6 s per hit and push |
| Finish | Briefly show delivered hits, actual displacement, Vibe lost and awarded Fame near the action. Follow any fall, then establish the respawn/home or elimination before handing back camera control | About 0.6 s; extend only for an actual fall |

These are tuning starting points, not fixed waits that can outrun the scene.
A typical five-die sequence should take roughly **7–9 seconds**. Compress
repeated launch and burst beats for larger volleys, while preserving the settled
dice reveal and distinguishable hit/push pairs. Do not run all-eleven-hit volleys
through eleven long dramatic pauses. Reduced-motion mode keeps the same outcome
order and readable values with stable framing, restrained bursts and short moves.

**Translate the dice visibly.** Give every die a stable index and an associated
wave tint. During reveal, use the face and threshold as well as colour, so the
mapping survives colour-vision differences. Brief contact labels such as
`5 > 4 · HIT` or `4 = 4 · ABSORBED` sit beside the relevant impact in the arena.
They are numerical feedback, never musical-note glyphs leading the projectile.
If a volley ends early, distinguish **dissipated** waves from **absorbed** ones:
they passed their dice check but never landed, and award no Sonic Fame.

**Project the built chord as the sound.** Capture its actual pitches before
Drive is spent. Sound the recognisable full voicing as the amps fire, then shape
its harmonics into the individual wave pulses and impact tails. Do not replace
it with a canned chord, unrelated scale or isolated generic pew sound. The
Rival's held Sustain voicing can answer an absorption, while the attacker's
chord remains the identity of the volley. Balance volume across large chords and
eleven-wave volleys so more projectiles do not just become louder. Slow motion
may stretch envelopes and resonance while retaining recognisable chord pitches.

**The waveform is the missile.** Use a luminous fluid core and trailing ribbons,
sidewinding along a controlled path that clears the attacker and bystanders.
Navier–Stokes-like eddies may distort the visible wake; the fluid motion is
cosmetic and never changes collision, targeting, dice or the order of contacts.
An absorbed wave spreads and disperses over the shell; a through-shot has a
distinct inward breach and Spirit impact. The shield follows the Rival during
the shove and continues to show the saved Sustain value for this volley.

**Show the delayed bill where it belongs.** A compact label attached to the
Rival's shield shows the tail-note loss due next turn, capped by the current
stack and preserving its root. Include the natural one-note decay even before
any attack. At the owner's turn start, those exact tail tones fade from the
voicing and the displayed Sustain updates. No mysterious immediate shield loss,
separate battle screen or full-screen results overlay.

Keep every outcome visible on both clients. If a reroll changes a verdict,
settle and reveal the replacement dice before firing; never silently swap a
face mid-flight. A scene-loading delay or camera transition must not hide the
roll or cause a hit/push event to execute twice. Return camera control cleanly
when the sequence ends.

### 12.1c ⭐ THE PROJECTILE IS DECIDED — the RING BEAM, 2026-09-13

> **Alex's call, off a live preview, after auditioning four treatments against the
> same volley.** This section is the decision; ⛔ the build is not done. The
> one-pass port brief is `.scratch/sonic-rework/RING_BEAM_BRIEF.md`.

**The waveform is the missile, and the missile is a stack of shock rings.** Hoops
sit at fixed stations along the flight path, ignite in turn as the wavefront
reaches them, and then **inflate** as it pulls away — so at the head there is only
a bright point, and the beam grows backwards out of it. Tight nose, full body,
tapering tail, necking down again into the impact.

⭐ **It undulates rather than zigzags.** The centreline is a sine plus a quiet
harmonic on two perpendicular axes, with the phase advancing on the clock, so the
wave runs forward *through* the beam instead of sitting frozen in the world while
the head slides along it. The flight cadence changed to match: the per-leg
dash-and-ease is gone, the growing legs are not, so the shot still crosses the
arena early and crawls the approach.

🎯 **Total flight time is UNCHANGED.** `sonicVolleyDuration` reports the same
number, so §12.1b's pacing table, the result scheduling and the per-die audio
stagger all still hold. Nothing in this decision touches a rule, a die, a
verdict or an order of contacts.

**The three treatments it beat**, all kept in the same module behind a
`strokeStyle` so the next look can be auditioned without a second module:

| treatment | why not |
|---|---|
| the shipped **note glyph** | the read Alex flagged — head + tail, no waveform |
| the **waveform** of §12.1a | clears that read, but lands closer to a control ring than a blast |
| the **cel zigzag** and its **chevron** variant | legible and hard-edged, but the zigzag is a tick where this wants a flow |

⚠️ **THIS SUPERSEDES ONE LINE OF §12.1b.** *"Use a luminous fluid core and
trailing ribbons"* described the projectile body, and the body is now the ring
stack with a single axial filament through it. **Everything else in §12.1b stands
unchanged** — the shot plan, the pacing table, the die-to-wave traceability, the
contact labels, the absorbed-vs-through distinction, the chord-as-sound rule and
the reduced-motion requirement. 📌 A future session reading §12.1b alone would
"restore" the ribbons and undo an approved look; that is why this section exists
and why it sits above the paragraph it corrects.

**The approved numbers** live in code, as `RING_TUNING` in
`board/sonicZigzagVisuals.js`, with their date and their owner on them — not in
this doc, because a number in two places is a number that drifts (§B1). The
direction behind them, which is the part worth keeping in prose: the beam went
**thinner and sparser but longer**, with a brighter filament, a far bigger
detonation and a much slower final approach. **Mass came out; contrast went in.**

⚠️ **One approved value has nowhere to land yet.** The contact push-in was dialled
to its maximum, and `arenaRenderer.js`'s `stageSonicCamera` currently has no
push-in at all — it frames a static box per phase. The volley module exposes
`getFocus()` for it. Until that is wired, the port delivers the beam but not the
shot. Brief §4.

### 12.2 ⭐ THE SWING: the dice stack IS a chord — and so is the wall

This is the answer to Alex's *"dice stack battle?"*, and the game's own fiction
does all the work.

In this proposed Swing treatment, the dice represent the notes of the attacking
chord. The wall is **their** chord, drawn as a stacked voicing with
a hard line at the top. Two columns, side by side. ⭐ **The taller one wins.**

🎯 **A voicing comparison rendered as a bar chart** — musically literal, and
instantly readable by somebody who has never played a note. And it means **you
hear both chords** at the moment of resolution: theirs ringing as the wall, yours
slamming up against it.

🎸 **The Swing is your chord played as a fast upward arpeggio.** Each die is a
note, each note lands at its own pitch, and the last one is either above their
voicing or under it.

### 12.3 🎬 THE SEVEN BEATS

| # | beat | what carries it |
|---|---|---|
| **1** | 🚶 **The walk-in** | The Swing needs melee range, so the commitment is **public before a single die exists**. Your Spirit crosses the board into their face and the whole table knows what is coming — and it is your turn, so they can only watch. ⭐ Free tension, no mechanism required |
| **2** | ⚡ **The recall** | ⭐ Alex's image, and the right one: **the amps fire at YOU.** Charges scorch back across the board into the instrument-weapon. Board desaturates, everything dims except the charge. 📷 Camera drops low |
| **3** | 🛡️ **The wall stands up — BEFORE the dice** | Their chord rises as a glowing stack with a hard line at the top, **and it rings.** ⚠️ **The player MUST see the number they have to beat before the roll**, or beat 5 has no tension. You are about to swing at a sound |
| **4** | ⏸️ **The hold** | One beat of nothing. **Longest frame in the sequence.** Let it breathe |
| **5** | 🎲 **The dice land ONE AT A TIME, and the stack climbs** | ⭐ **Not simultaneously.** 4… 9… 13… camera looking up at the line. Accelerate through the middle dice, give the last one real hang time. 🎯 **This is the entire drama of the move, and it is ninety percent pacing** |
| **6** | 💥 **The cross, or the fall short** | **Clear the line** and their chord *shatters* — notes physically fall out of the voicing and the ringing degrades in real time as they go. 🎯 §1's whole promise, cashed in one moment. **Fall short** and the stack collapses back down into your Spirit: the recoil, the feedback blowing back |
| **7** | 🩹 **The aftermath — and the two are nothing alike** | **Hit:** knockdown, Vibe, crowd scatter, §4.1's clock starts and everyone else gets to shoot a frayed rival. **Whiff:** you, standing in their face, empty, guard down — and everybody acts before you do |

### 12.4 ⭐ The stack has TEXTURE — the crowd is in the swing

Under §6 your die **size** comes from your crowd (d6 → d8 → d10 → d12). So a
late-match stack is visibly built of **fat d12s** and a turn-three stack of small
d6s. ⭐ **Your whole match history is physically in the swing, at the most dramatic
moment in the game.**

🎯 §6 argued a die upgrade **cannot be rounded away.** It also **cannot be
missed** when it is bigger on screen.

### 12.5 ⁉️ DOES THE PLAYER DO ANYTHING, OR JUST WATCH? — OPEN

Watching is defensible: the decision was made before the roll. But a single
**timing input on the follow-through** is very tempting in a music game.

⚠️ **THE COST IS REAL, AND IT IS THE SAME COST §11 REJECTED THE HIDDEN BID
OVER.** This is a seeded-RNG deterministic-replay architecture with desync checks.
A skill input inside combat resolution means **the bot has to simulate it**, and a
laggy connection changes outcomes.

💡 **The version that dodges all of it: the timing changes the PRESENTATION, not
the numbers.** Nail the downbeat and you get the hero camera, the bigger sound,
the slow-motion last die. Miss it and you get the plain cut. ⭐ **Style, not
stats** — determinism intact, and the player still leans in.

⁉️ Not decided.

### 12.6 📌 "Raw numbers" is not the problem — pacing is

Alex: *"Is this a raw numbers battle going on?"* — mechanically yes, and that is
fine.

🎯 **Balatro is literally a number climbing toward a target**, and it is one of
the most satisfying things in modern games. It runs entirely on escalation and
sound. **A sum that arrives is arithmetic; a sum that accumulates with a rising
pitch is a slot machine.**

✅ **And the machinery already exists.** `immersive-hud-handoff.md`: *"note
flights land on the live immersive dial readout"* — the same motion, already
built, already tuned.

### 12.7 ⚠️ THE VISION AND THE NUMBERS CURRENTLY DISAGREE

⭐ **Alex, 2026-09-11:** the Swing is *"something the player chooses to use once
the Rival Spirit has lost significant Vibe force, or to potentially punish a
turtle."* 📌 That is §4 items 1 and 3, arrived at independently — the fiction and
the spec are converging.

⚠️ **But §5.2 does not say "finisher."** D5 vs S5 clears at **69.5%**, which is a
perfectly good **opener**. Nothing in the current numbers makes the Swing better
against a hurt rival than against a fresh one — it is just *worth more*.

🎯 **The thing that would make it a finisher is §4.2's risk model**: the price has
to be steep enough that you only accept it when the payoff is a kill. ⭐ **§12.7
and open decision #6 are the same question**, and this vision is an argument for
resolving it toward real risk.

---

## 13. 📊 THE ATTACK AXIS GRID — the checking tool this spec has been missing

> 📌 **NEW 2026-09-14.** Alex recalled the 2D game's original attack design as a
> grid — three modes rated across five axes — and asked whether it could still be
> the foundation. It can. **Every cell below was read out of the code**, not out of
> memory or out of this document.
>
> ⚠️ **APPENDED AS §13 RATHER THAN INSERTED.** It belongs conceptually near §1, but
> renumbering §4–§12 would invalidate every cross-reference in this file and in the
> four companion docs — the same reason §3.5 carries its own "do not tidy" note.

### 13.1 ⭐ WHY THIS EXISTS, AND IT IS NOT DECORATION

**This spec has been doing grid reasoning without a grid to check against.**

- §3.3 ends with *"three jobs is plenty. The Sonic does not get a fourth."* That is
  a **budget**, written as a scold because there was nothing to point at.
- §5.3's whole crisis — *"the two attacks competing"* — and the way it closed
  (*"resolved by SEPARATING THE JOBS, not by nerfing the Swing's payoff"*) is a
  **grid operation**: make sure no two rows peak on the same axis.
- §4.1's *"a Sonic cannot reach a held chord, a Swing can"* is a **column with one
  row in it**.

🎯 Each of those was argued separately, in prose, months apart. The grid is where
they can be checked against each other in one look.

### 13.2 THE GRID — as the code actually behaves, 2026-09-14

| axis | 🗡️ Swing (Thrash) | 🔊 Sonic | 🎤 Riff-Off |
|---|---|---|---|
| **Sustain drain** | `chordFrayAmount` → 1–2, `REAR_FRAY_BONUS` +1, floored at 1 surviving | **none** | **none** |
| **Knockback** | `thrashKnockback` → flat **1** | `sonicKnockback` → **1–5** | `sonicKnockback` → **1–5** ⚠️ *identical, not lesser* |
| **Fame** | `thrashFame` → flat **1** | `sonicFame` = `ceil(margin/2)`, + `SONIC_LIMELIGHT_FP` | `RIFF_FP_FLOOR` 2 + `ceil(margin/2)` + perfects/3 + `RIFF_R2_BONUS` + headliner + fx, under `RIFF_FP_TURN_CAP` (**2× the normal per-turn cap**) |
| **Vibe damage** | `thrashDamage` 1/2/3/4, cap **4** | `sonicDamage` 1–2, cap **2** | `marginToDamage` → 1–**5** ⚠️ *the biggest in the game* |
| **Own Drive drain** | `SWING_DRIVE_SPEND` **2**, on a HIT only | `SONIC_DRIVE_SPEND` **1**, hit or miss | 1 — inherited from the Sonic it escalates out of |
| ⭐ **Miss cost** *(new column)* | `THRASH_WHIFF_DMG`, `swingExposed`, and standing in melee | nothing lands; the charge is still spent | — |

⭐ **`chordFrayAmount` HAS EXACTLY ONE CALLER IN THE REPOSITORY.** `applyChordFray`
in `rlsw-simulator-v3_8_1.jsx:6827`, inside `resolveSwing`, gated on `attackerWon`.
🎯 **So §4.1's exception was already true in the shipped 2D game.** This spec did
not invent it; it described one that existed.

### 13.3 ⭐ THE SIXTH COLUMN IS THE POINT

**Miss cost** is not in the original five and it is where the live open decision
lives. §4.2 is entirely an argument about what a failed Swing should cost, and it
had nowhere to sit. With the column drawn, §4.2's own best argument becomes visible
in one line: ⚠️ **a flat `THRASH_WHIFF_DMG` charges the same for a 1-die poke and
for 🔊 Goes to 11's ELEVEN dice.**

### 13.4 ⚠️ WHAT THE GRID CANNOT DO — read this before tuning off it

**Stars hide shape, and two cells with the same rating can be different objects.**

Sonic knockback is *1–5, scaling with margin and with the target's Vibe deficit*.
Swing knockback is *flat 1, on any hit, always* — and `thrashKnockback`'s own
comment says the flatness is deliberate: *"the push stays flat at 1 (vs Sonic's
1-5) so Sonic remains the positional weapon; Thrash just gets its due."*

⭐ **One is a curve. One is a constant. The grid rates them 3 and 1 and loses that
entirely.** Use the grid to CHECK a design — do two rows peak on the same axis? does
any row have no cost? — and the functions to SPECIFY it. 📌 A retune read off the
stars alone is a retune of a summary.

### 13.5 🚩 TWO THINGS THE GRID FOUND ON ITS FIRST PASS

**1. ⚠️ The Riff-Off is the most violent thing in the game, and nothing said so.**
Full `sonicKnockback`, the largest Vibe number in the rules, the largest Fame payout
under a doubled cap — against a single inherited note of Drive. `battleFlow.js:748`
says it out loud and only in a comment: *"the duel is symmetric… whoever loses takes
the hit, attacker or defender alike."* **A row with three peaks and one cost is a
shape prose never surfaced in eleven months.**

**2. 🚩 The Riff-Off's Vibe runs on a table the codebase declared superseded.**
`combat.js:18` — *"LEGACY damage table — still used by Smash, riff-off, and any call
site that hasn't been split yet. New code should use thrashDamage / sonicDamage."*
The Swing and the Sonic were both migrated. ⛔ **The riff-off never was**, so it is
the only attack still paying out of `marginToDamage`. 📌 §14.6 proposes the fix;
this row is the evidence that it is drift and not a design choice.

---

## 14. 🎤 RIFF-OFF REWORK — PROPOSAL, NOT DECIDED (2026-09-14)

> ⛔ **NOTHING HERE IS BUILT AND ALMOST NOTHING HERE IS DECIDED.** One ruling is
> Alex's and is marked ⭐. Everything else is ⁉️ and must not be guessed during an
> implementation pass.
>
> 📌 **Provenance.** This section came out of a conversation that opened as *"where
> does the Swing find its place?"* and became a riff-off rework instead. ⚠️ **§4's
> Swing question is therefore STILL OPEN and was not answered** — see §14.8.

### 14.1 ⭐ THE THESIS — THE RIFF-OFF IS NOT AN ATTACK, IT IS A BET

A duel has no defence because **you cannot block a wager — you can only play it.**
That is why it touches no shield, and it is why it is the only contest in the game
that can pay **both** participants (`bothStrong`, already shipped).

🎯 **And it completes a pattern the combat system was already reaching for.**
`DRIVE_SUSTAIN_SPLIT_DESIGN.md` §1 names exactly three commit destinations. They map
one-to-one onto the three modes:

| commit destination | powers |
|---|---|
| **Drive Stack** | 🔊 Sonic — count the dice · 🗡️ Swing — sum them |
| **Sustain Stack** | the defence against both |
| ⭐ **Melody Line** | 🎤 **the Riff-Off** |

⭐ **THIS IS WHY THE DUEL HAS NO SUSTAIN**, and the reason is structural rather than
a preference: the duel is fed by the one destination that **clears every turn**,
not by the two that persist. **It was never in the same economy.**

### 14.2 ⭐ IT ALREADY LIVES OFF THE MELODY — THIS IS NOT A CHANGE

`rlsw-simulator-v3_8_1.jsx:8442`, in `startRiffOff`:

```js
// Phase R1: pass the attacker's committed melody line so the engine builds
// the riff from it (Rhythm Creation Device). The commit path stashes these in
// committedMelody/committedHasRiff since melodyLine is cleared to [] after commit.
const melodyLine = atkNs.committedMelody ?? null;
```

And the bot's model is keyed the same way — `riffSkill(perfScore)` reads the last
commit's Performance Score, **not Drive**.

⚠️ **Drive's only current involvement is incidental**: the duel escalates out of a
Sonic, so `SONIC_DRIVE_SPEND` was already paid before the first gem falls.

🎸 **The musical argument, which is the real one: a chord is SIMULTANEOUS, a riff is
SEQUENTIAL.** The Drive stack is a voicing — notes with no order and no rhythm. The
melody line is a sequence of notes in time. **Only one of those two is riff-shaped.**

### 14.3 🎸 THE THESIS WAS ALREADY WRITTEN — `riff/melodyRiff.js`

> *"The game's thesis: **'the melody you build is your combat.'** A player who
> builds a chromatic melody fields a riff full of sharps; a pentatonic player gets a
> simpler one. The attacker rehearsed this riff all turn — the defender sight-reads
> it. **Complexity is a weapon paid for in preparation.**"*

⚠️ **BUT THE SHIPPED LEVER RUNS ON A DIFFERENT AXIS FROM THE PROPOSED ONE**, and
both should exist. Do not conflate them:

| | lever | what it moves | direction |
|---|---|---|---|
| ✅ **shipped** | melody complexity | **how hard the chart is** | rewards complexity |
| ⁉️ **proposed** | melody *cleanliness* | **what a landed note is worth** | punishes sloppiness |

### 14.4 ⁉️ THE RETROSPECTIVE RISK — DISCORD NOTES BECOME DUD GEMS

> ✅ **§14.9 ANSWERS THIS SUBSECTION'S OPEN QUESTION** — what makes a note strong,
> and how a strong note beats a weak one — using only arithmetic the commit already
> performs. Read this for the *idea*; read §14.9 for the *model*.

Alex, 2026-09-14: *"A melody line that doesn't get committed well could become a
risk of not producing 'strong' notes for the riff off."*

⭐ **The cleanest source is cleanliness, and there is a decided-but-unbuilt rule
waiting for exactly this job.** `STATE_OF_PLAY.md` §4: *"DISCORD NOTES ARE INERT —
no Db, no fans, no power to resolve an ending"* (decided 2026-09-09, ⛔ not built),
whose *"only uses are held for a later turn or spent as movement fuel"* — two
consolation prizes.

🎯 **This gives them a third use and a real one: a discord note in your committed
line becomes a WEAK projectile in the duel, and gets swatted.** Not "you score
less" — the note loses the collision. Play a sloppy line on Tuesday, lose the duel
on Thursday.

⚠️ **AND IT MUST BE SPELLED OUT WHEN IT LANDS, or it reads as a contradiction in six
months.** *Inert* means a discord note does not **pay**; it does not mean the note
does not **exist**. Someone will read §4's "no power" against this and file a bug.

📌 What commit already computes, and the trap in the obvious candidate:
`payout.cleanCount` · `craftFans` · `discordCount` · and `perfScore`, which is
⚠️ **explicitly IDENTITY-ONLY** (`melodyCommit.js:294`: *"`perfScore` STAYS
IDENTITY-ONLY… folding craft into it would relabel a universal payout as this
Spirit's sound"*). **`perfScore` is the wrong input for a cleanliness lever** even
though it is the one `riffSkill` already reads.

### 14.5 ⁉️ THE ALTERNATING STRUCTURE — Alex's shape, 2026-09-14

> A calls with a variation of **their** melody → B answers with a variation → **B
> now calls with THEIR committed melody** → A answers → back and forth, escalating,
> until somebody fails to answer.

⭐ **THE STATE FOR THIS ALREADY EXISTS.** `melodyCommit.js:328` stashes
`committedMelody` on **every** Spirit's note sheet at their own commit.
`startRiffOff` reads only `atkNs.committedMelody`. **The defender's line is sitting
there, unused — this is one extra read, not new state.**

✅ **What it fixes:** the asymmetry. Today the attacker brings material and the
defender brings reflexes (`generateDefenderRiff` derives the answer from the call).
Under alternating offence both players call with something they built and both
answer cold. `generateDefenderRiff`'s transform still works — it just gets two calls
to answer instead of one.

⭐ **DECIDED — THE FIRST CALLER'S ADVANTAGE STAYS** (Alex, 2026-09-14). Calling is
the stronger seat (you rehearsed; they sight-read), so whoever opens has an edge and
the player who fails is usually the one answering. **Alex's ruling:** *"that is also
their positioning that landed them with the attack that gets them a free go. I think
that is fine as it is."* 🎯 **It is paid for in board position**, which is the
existing cost of reaching a duel at all. 🪦 Three compensations were offered and all
three are **rejected by this ruling**: a warm-up opening exchange, a defender ante
as a fairness fix, and an end-only-on-a-completed-answer rule.

⚠️ **ONE THING TO VERIFY BEFORE BUILDING ON THIS.** `melodyCommit.js:325` says *"the
riff-off reads these; turn start clears them"* — **and no code that clears them was
found** in the engine or the client. If they persist, a defender always has
material; if a clear exists somewhere, a defender can arrive empty. 📌 The existing
`fromMelody` / random-fallback split (reduced pot) already handles "brought nothing"
either way, but the structure above changes shape depending on the answer.
**Confirm it; do not assume it.**

### 14.6 ⁉️ THE PROPOSED GRID ROW, AND WHAT IS STILL MISSING FROM IT

| axis | proposed | note |
|---|---|---|
| **Sustain drain** | **—** | not zero — *absent*. The only mode that does not touch the axis |
| **Knockback** | ⁉️ **OPEN** | Alex's sketch says ★★. ⚠️ It is currently **inherited, not chosen** — `startRiffOff` sets `sonicAttack: true` with the comment *"→ sonic-scale knockback"*. If the duel is a wager rather than an attack, this is the only cell still behaving like combat |
| **Fame** | ★★★, and ⭐ **uniquely pays both sides** | already shipped as `bothStrong` |
| **Vibe** | ★ — the Sonic band | 🚩 **this also closes §13.5's drift**: migrate the riff-off off `marginToDamage` (cap 5) onto `sonicDamage` (cap 2) |
| **Own Drive drain** | **—** | ⭐ this is what dissolves the 4-player problem: nobody is disarmed on a turn they did not choose |
| **Miss cost** | ⁉️ **OPEN — the whole question** | see below |

🚨 **THE ROW HAS NO COST COLUMN AND THAT IS THE OPEN DECISION.** With Sustain and
Drive both at dash, every cell is upside. §14.4's dud gems are the proposed answer
and they are *retrospective* — the price was paid on a previous turn. ⁉️ **Whether
a retrospective price alone is enough, or whether the duel also needs a cost at the
moment it is entered, is not decided.**

📌 **A wager whose chips were already cashed is not a wager.** The melody line is
spent, paid and cleared before the duel starts, so there is nothing left to lose at
the table. 💡 **One candidate, recorded and NOT decided: stake the melody's own Fame
payout** — bank what the line earned, or throw it into the duel for a much larger
pot. ⚠️ **This needs one check first**: whether the melody's Fame is already paid
before `startRiffOff` reads the stash. It was not traced.

### 14.7 🚨 THE BLOCKER — AND IT IS NOT A BALANCE ITEM

`riffOff.js:389` declares it against itself:

> *"⚠️ AND IT HAS NO TEMPO TERM. `applyRiffRound2Started` speeds sudden death up to
> 0.58× the gaps, and this function cannot see that… So a Spirit plays Round 2
> exactly as well as they played Round 1, on a chart that got half again as fast."*
> Filed as `HARNESS_GAPS.riffRound2Speed`.

Today that is a bench inconvenience. ⛔ **Under §14.5's go-until-somebody-fails
structure it becomes a bot that is immune to the difficulty ramp the entire mode is
built on, with an edge that compounds every exchange.**

🎯 **This is the §B10 exception, not a balance deferral.** It does not make the bot
*strong*; it makes the mode's central mechanic *not apply* to half the table — a
thing that cannot happen, wearing balance's clothes. **Decide this before building
escalation.**

### 14.8 🪦 REJECTED / DEFERRED IN THIS PASS

- 🪦 **Simultaneous two-sided performance with live note-on-note collision.** Alex's
  picture was *"near simultaneous… both sides of the screen."* ⛔ **Not adopted.**
  `RIFF_RESULTS_SUBMITTED` submits a completed results array *after* a performance;
  live mutual resolution means both players' inputs resolving against each other
  frame by frame inside a seeded-RNG deterministic-replay architecture with desync
  checks — ⚠️ **the exact cost §11 rejected the hidden bid over and §12.5 flagged
  against a timing input.** It also discards `generateDefenderRiff`: if both play at
  once, there is no *call* to answer.
  💡 **The version that keeps the picture for free, recorded and not decided:** keep
  call-and-response, **render it on two tracks** — their side plays back the
  *recording* of their phrase while yours is live. The projectiles genuinely
  collide on screen. **Nothing in the netcode moves.**
- 🪦 **The note pool / note stock as the duel's currency.** Considered and argued
  against: the pool is the tightest resource in the game
  (`DRIVE_SUSTAIN_SPLIT_DESIGN.md` §4, §10) and feeds Drive, Sustain *and* melody,
  so spending it would be an undifferentiated tax that **starves the melody system
  that feeds the duel** — win a riff-off, be too poor to write the line that earns
  another. 📌 It survives as a candidate for **an ante only**, which is a different
  job; ⭐ **§14.5's ruling removes the fairness argument for an ante**, so if one is
  ever added it must be for a reason of its own.
- ⛔ **THE SWING'S PLACE — STILL OPEN, AND THIS PASS DID NOT TOUCH IT.** The
  conversation opened there: Alex's *Smack-down* image (Drive energy driven into the
  instrument for an all-out melee blow) and *"I think it still earns its place as
  the big Vibe hitter."* ⚠️ **That is the reversal §5.3 recorded going the OTHER
  way** — *"the shield-breaking is what makes the Swing a can-opener and a social
  move; it is the part worth keeping."* **Unresolved.** §4.2's risk model is
  unresolved with it.
- ✅ **THE SONIC SHIELD AS ROLLED HP — ADOPTED 2026-09-15. SEE §3.6.** Alex's
  opening proposal — Sustain rolls dice into a pool that Drive projectiles wear
  down until it busts. Set aside in this pass when the conversation moved to the
  duel, prototyped in the **Shieldbreaker barrage** bench, and ruled on after he
  drove it. ⭐ **Both objections recorded here are answered at §3.6.3** — §3.2's
  derived-stat cascade (by the OVERWHELMED trigger, §3.6.2a) and §4's
  count-versus-sum fork (the barrage uses the sum for damage and the count for
  knockback, §3.6.3). ⚠️ **This bullet is kept as the record of where the idea was
  parked; it is no longer the current state.**

### 14.9 ⭐ NOTE STRENGTH — what makes a melody note strong, and how it wins a collision

> 📌 **Added 2026-09-14, same session.** This answers §14.4's open question — *what
> makes a note "strong"* — and it answers it **without inventing a single new
> judgement.** Every input below is already computed at commit.
>
> 🧊 **Alex: *"sounds like a satisfying answer — for now at least."*** Treat the
> model as **provisionally accepted**, not frozen. The ⭐ rulings inside it are
> real; the numbers are first values.

#### 14.9.0 🎓 THE CONSTRAINT THAT SHAPED IT

Alex, 2026-09-14: *"I honestly like music for the subjectivity of it, I'm not so
strong in answering objectivity — ie. Theory."*

🎯 **The game already agreed, and the decision is recorded in code.**
`melodyPayout.js`'s own header: the subjective half — `excitement`, `loyalty`, fan
promotions, `perfFansLost`, `lowPerfStreak`, *"a mood model that decided whether
you had been entertaining and took fans away when it judged you dull"* — was **cut
on purpose** and stays pinned at 0. *"The DETECTORS were arithmetic; the crowd
model around them was not, and only the arithmetic returns."*

⭐ **THE GAME HAS EXACTLY ONE PER-NOTE JUDGEMENT AND IT IS BINARY:**
`scale.includes(note)` — is this note one of your Spirit's seven (Ronin Lydian,
Metalness Phrygian, Intergalactic 0 Dorian). ⚠️ **Everything else the melody
economy measures is a property of the LINE, not of a note.** That fact is what
decides the whole design below: **do not grade notes; read the grade the line
already gave them.**

#### 14.9.1 ⭐ THE FOUR TIERS — all existing arithmetic, read twice

| tier | weight | what it is | already computed by |
|---|---|---|---|
| 💀 **Dud** | **0** | not in the Spirit's scale | `scale.includes(note)` |
| 🎵 **Plain** | **1** | clean, but standing alone | everything not below |
| ⭐ **Strong** | **2** | clean **and inside the line's craft run** — the longest same-direction passage, by step *or* by third | `craftRunFor(line, scale)` |
| 🪝 **The hook** | **+ the ending value** | the last note, if it lands | `melodyPayoutFor`'s `ending` |

⭐ **THE TIERS STACK WHERE THEY OVERLAP.** A line that climbs *into* its ending
makes its final note both a body note and the hook — **the heaviest single
projectile in the game.** 🎯 That gesture — build a run, change chord, land on the
fifth — is exactly what §14.9.3's rationale was invented to teach.

⭐ **AN UNRESOLVED LINE HAS NO HOOK.** `endingDb` is already 0 when the last note
is out of scale. Trail off and you have nothing to finish with. **No new rule.**

#### 14.9.2 ⭐ THE SPLIT — hands decide IF, melody decides HOW MUCH

- ✋ **Your performance decides whether a note FIRES.** Hit the gem, it launches;
  miss it, nothing leaves the amp.
- 🎼 **Your committed melody decides what it WEIGHS.**
- 💥 **On collision: the heavier note survives and carries on at the difference;
  equal weights annihilate; a dud is knocked out of the air by anything.**

🎯 **NEITHER HALF CAN CARRY THE DUEL ALONE, AND THAT IS THE POINT.** Flawless hands
on a sloppy line fire featherweights that get swatted. A beautiful line played
badly never leaves the amp. ⭐ **This is what finally closes the objection that
killed the Drive version** (§14.2): a currency that pays the entry fee to a contest
it has no say in. The melody pays, and the melody plays.

⁉️ **WHAT SURVIVING WEIGHT THEN DOES IS NOT DECIDED, and must not be guessed.**
📌 One candidate, recorded only: **surviving weight is the score of the exchange**,
and the duel ends when a side gets *nothing* through — which would make §14.5's
"fails to answer" the same event as the collision rather than a second system
bolted beside it.

#### 14.9.3 ⭐ WHY THE FIFTH PAYS MOST — ALEX'S RATIONALE, RECOVERED 2026-09-14

```js
const endingDb = ending === 'fifth' ? 3 : ending === 'fourth' ? 2 : ending === 'tonic' ? 1 : 0;
```

⚠️ **This line had NO COMMENT ANYWHERE.** Not in `melodyPayout.js`, not in
`melodyCommit.js`, not in `MELODY_IDENTITY_DESIGN.md`. For months a deliberate
design decision has read exactly like an arbitrary number — 🎓 **§B9 in its purest
form.** Alex's own words, 2026-09-14:

1. 🎸 **The rock argument.** *"There was a point early in building one of the first
   renditions where harmonic structure was important — usually nothing is as strong
   for Rock as the 5th."*
2. ⭐ **The systems argument, and this is the one nobody could have reconstructed.**
   *"I also wanted to have the players change chords often, so that was another
   reason it was stronger than say the tonic."*

🚨 **REASON 2 MEANS THIS NUMBER IS A LEVER ON THE CHORD ECONOMY, NOT MELODY
FLAVOUR.** Anybody tuning the duel later would have flattened the ladder without
knowing what they were switching off. 📌 **Reason 1 is guessable. Reason 2 was one
message away from being lost forever.**

#### 14.9.4 ⁉️ THE TONIC RISES — provisional

Alex, 2026-09-14: *"it's probably not to say the Tonic isn't important — it
probably should pay out 2 times or so, 1.5 even."* **Provisionally 2.**

⚠️ **THE COST, AND IT IS NOT FREE: at 2 the tonic and the fourth become the same
rung** (3 / 2 / 2), and the fourth stops meaning anything distinct. 🎯 The
defensible reading is that **there are two kinds of ending, not three** — *you
landed it* (2), or *you landed it and left it ringing* (3). If three rungs are
wanted, the only clean shape is fourth → 1.5, which says a plagal ending is the
softest landing. ⁉️ **Alex's call — the hierarchy is his.**

📌 **A practical argument for 2 over 1.5:** Db arithmetic already runs in halves
(`CLEAN_NOTE_DB` and `CLEAN_STREAK_DB` are both 0.5), so 1.5 is legal *there*. It
gets awkward only because §14.9.5 makes this same number a collision weight — does
a 1.5 beat a 1, and by how much? **Integers are kinder to a number doing two jobs.**

#### 14.9.5 ⭐ ONE NUMBER, TWO JOBS — SO GIVE IT A NAME

Alex asked whether the fifth's Db payout should also be the duel's hook weight:
*"I guess it should."* ✅ **Yes**, and for §3.1's own stated reason — *"hit count
doing double duty as the knockback number. Keep it. No second roll, no second
table."* **The note you are taught to aim for in a melody should be the note that
wins duels.** One lesson, learned once.

⚠️ **THE COST, STATED HONESTLY: a number doing two jobs cannot be tuned apart.** If
the fifth proves too strong in duels, the only lever also moves the Db economy —
and with it Alex's chord-change pressure.

🎯 **THE ANSWER IS NOT A SECOND NUMBER. IT IS A NAMED ONE.**

✅ **DONE 2026-09-15 — THE RATIONALE HAS REACHED ITS REAL HOME.** The anonymous
inline ternary is now **`ENDING_DB`**, exported from `music/melodyPayout.js`,
with §14.9.3's two reasons, §14.9.5's one-number-two-jobs cost and §14.9.4's
unsettled tonic written in the comment above it, and indexed twice in
`ARCHITECTURE.md`. **The next person can now see what they are about to break.**

📌 **THAT COMMENT IS CANONICAL FROM HERE; THIS SECTION IS THE INTERIM RECORD AND
IS NOW HISTORICAL.** ⚠️ New thinking about the ladder goes in the comment, not
here — two live copies of a rationale is the exact drift `SEQUENCING.md` §B9
charges for, and §14.9.3 exists precisely because this number had none at all.

✅ The rename is verified **behaviourally inert**: `.scratch/endingDbCheck.mjs`
replays the old ternary against the new map — **28,807 assertions, 0 failures**
over 9,600 random lines across 8 keys and 3 Spirits, checking `endingDb`, that
`db` still reconciles as `cleanDb + streakDb + endingDb`, and that `resolved`
still tracks a non-`normal` ending.

🎯 **§14.9.4's tonic number may now move safely** — the thing that had to happen
first has happened.

#### 14.9.6 🚩 THE FAN CAP IS A FAME BRAKE, NOT A QUALITY CEILING

⛔ **DO NOT SUM the middle score and the end score.** Alex's shape was *"each
bringing a score together to work out a strength variable"*, and the naive form
breaks on arithmetic that is already in the file:

- `craftFans` caps at **2** (`CRAFT_FAN_CAP`)
- `endingDb` caps at **3**

🚨 **So a flawless eight-note run scores 2 and four notes ending on the fifth scores
3 — the middle would be worth less than one well-chosen final note**, after a whole
craft layer was built to make the middle pay.

⭐ **THE CAUSE IS READING THE WRONG NUMBER, AND THE FIX IS IN THE FILE.**
`craftRunFor` returns the run's **length** (3, 4, 5, 6…); `craftFansFromRun` then
caps it. And the cap's own comment says what it is for: **`CRAFT_FAN_CAP = 2` ⚠️
fans feed FAME.** 🎯 **It is a brake on the CROWD economy and has nothing to do
with duels.**

⭐ **THE DUEL READS THE RUN LENGTH. THE FAME ROUTE KEEPS ITS CAP.** One
measurement, two consumers, each with its own ceiling.

#### 14.9.7 ⭐ QUANTITY AND QUALITY, NOT A TOTAL

| | reads | its job |
|---|---|---|
| 🎵 **The body** — the middle, the **fans** route | `craftRun` **length**, uncapped | **how many of your notes fly heavy.** A long run throws a dense volley; a wandering line throws a thin one full of holes |
| 🪝 **The hook** — the end, the **Db** route | the named ending value, 0–3 | **one shot, at the end of the phrase, worth more than any other single note** |

⭐ **NOT `body + hook`.** The middle decides **how much you are throwing**; the end
decides **whether you finish them off.** 🎯 That keeps both halves of a line doing
different work instead of competing for the same slot — which is the same move §5.3
used to stop the Sonic and the Swing competing, applied inside one melody.

#### 14.9.8 ⚠️ TWO EXISTING RULES THAT MUST RIDE ALONG

1. ⭐ **The craft run is MAXed, not summed**, and `melodyPayout.js` says why: *"a
   line is one gesture played well, not a checklist of gestures to collect."* Only
   the **longest** run makes strong notes. 🎯 **That is what stops the duel
   rewarding note-salad with good bits in it.**
2. ⭐ **The floor is FOUR and it is load-bearing.** `CRAFT_FAN_FLOOR = 4` because
   the Ronin's `scalar_shred` already fires on a **three**-note run — paying craft
   from three *"would hand him two fans for one gesture and teach nothing."* ⚠️ **A
   three-note run must make no strong notes**, or the duel pays twice for the same
   gesture and reintroduces the bug the floor was built to prevent.

#### 14.9.9 🪦 DELIBERATELY NOT BUILT — the per-Spirit signature note

A fifth tier keyed to `detectSpiritStyle` (did you play *your Spirit's* named
shape) is tempting and is what `MELODY_IDENTITY_DESIGN.md` is about. ⛔ **Not
adopted.** It would make every Spirit's duel behave differently **before the roster
is decided** (§2 of `STATE_OF_PLAY.md`), and its input is `perfScore`, which
`melodyCommit.js:294` flags **IDENTITY-ONLY** with an explicit warning against
exactly this kind of reuse. 📌 Filed, not designed.
