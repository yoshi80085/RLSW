# 🎸 PROJECTILE COMBAT — Design Spec

> **Status: DESIGN ONLY. Nothing built. Opened 2026-09-10/11 in conversation with Alex.**
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

---

## 1. 🎯 THE CORE SWAP

**Today:** `atkStat + one kept-highest die` versus `defStat + one die`. Two
numbers vanish into an opposed sum and the player is told a verdict.

**Proposed:** the numbers become *objects on the screen*.

| stat | was | becomes |
|---|---|---|
| **Drive** | a modifier added to one die | ⭐ **the NUMBER OF DICE thrown** |
| **Sustain** | a modifier added to the defender's die | ⭐ **the TARGET each die must beat** |

🎸 **The fiction:** the amps fire Drive-many sonic projectiles at the rival
(Ness-style, *Smash Bros.*). A Sustain shield stands in the way. Time slows, the
dice are summoned, and each one either gets absorbed or punches a segment out of
the shield.

⚠️ **THE PROJECTILES MUST BE NOTES, NOT BOLTS.** A dim7 volley should look and
sound different from a maj7 volley, and a broken shield segment is a note leaving
the rival's voicing — their chord audibly gets worse. Without this the game is
generic wizard-bolts on a hex grid and the music layer stops being visible in the
one place every player looks. 🎯 This is the whole reason the redesign is worth
doing: it is the first combat system where you can **hear what a rival's defence
is made of**.

> 🔄 **AMENDED 2026-09-11 — §3 and §3.5.** *"each one either gets absorbed or
> punches a segment out of the shield"* is **no longer how the Sonic resolves**: a
> beam is absorbed or it **goes past** the shield and hits the Spirit, and the
> shield is unchanged either way (§3.2 explains why the segment model was a
> cascade). 🎯 **The paragraph above survives intact in every other respect, and
> the goal it states is now served BETTER, not worse.** A dim7 volley still has to
> look and sound unlike a maj7 volley; the absorbed beams are where a defence
> becomes audible. And *"a note leaving the rival's voicing"* still happens — it
> is now the 🗡️ **Swing's** exclusive job (§4.1), which makes it **one loud moment
> instead of a drizzle**: SMASH, and their Cmaj9 drops to a bare fifth, and the
> whole table hears it.

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

⁉️ **OPEN: the exact re-basing curve.** 8 ranks → a 1–5 opening band, with Db
upgrades pushing it up from there.

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

**Result:** 3 hits → Vibe (`SONIC_VIBE_CAP`), **3 hexes of knockback**
(`sonicKnockback`), Fame off the hit count (`sonicFame`). ⭐ **The rival's Sustain
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

🎯 **All three are long-game, and all three land on the SPIRIT.** Nothing on that
list ever ends anybody, and nothing on it touches a chord.

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
              SUSTAIN_FRAY_CAP )     ← ⁉️ open, §3.5.3
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

### 3.5.3 ⛔ THE CAP IS OPEN, AND IT IS A FUNCTION OF `speed`

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

⁉️ **Decide after §2.1's re-basing curve and the `speed` numbers settle.** Start
at **2** — it is the safe direction to be wrong in.

### 3.5.4 ⛔ THIS RULE HARD-BLOCKS THE AP QUESTION

The bill is bounded **only** because a turn holds one attack. ⚠️ If AP ever allows
two Sonics in a turn, or if 🌀 Bushido / 🔊 Goes to 11 count as extra attacks, the
bound is gone and §3.5.2's per-hit disaster walks back in through the side door.

⛔ **So the AP question must resolve to "one attack per turn", or this rule needs
its own independent cap. It cannot be left open underneath this** — which is why
it is promoted out of the bottom of §10 to a blocker.

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

## 4. 🗡️ THE SWING — concentrated

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

Drive 1–5 dice on **d6**, Sustain 1–5, a **3-segment** shield.

> ⚠️ **§5.1's HEADING IS NOW WRONG AND THE NUMBERS ARE NOT.** Under §3 a success
> is a **beam through**, not a segment broken. Read the table below as **expected
> HITS per volley** — the arithmetic is unchanged, only what a hit *does* is.

### 5.1 Sonic — expected ~~segments broken~~ **HITS** per volley

|  | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|
| **D1** | 0.83 | 0.67 | 0.50 | 0.33 | 0.17 |
| **D2** | 1.67 | 1.33 | 1.00 | 0.67 | 0.33 |
| **D3** | 2.50 | 2.00 | 1.50 | 1.00 | 0.50 |
| **D4** | 3.00 | 2.67 | 2.00 | 1.33 | 0.67 |
| **D5** | 3.00 | 3.00 | 2.50 | 1.67 | 0.83 |

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

🎯 **And the Swing needed no nerf.** §3.5's upkeep means a Swing-every-turn player
is spending their whole charge on a gamble while a Sonic player keeps **building**
— the two lines diverge on their own.

### 5.4 ✅ The dead corner — CLOSED 2026-09-11

D1–D2 against S3+ is **0%** on the Swing and a fraction of a segment on the
Sonic. A player who commits a bad chord into a defended rival has **no attack at
all** — not a weak one, none. ⚠️ **That is the "impossible rather than merely
weak" category, which is a bug and not a balance question.**

⭐ **§3.5's upkeep bill closes this for free.** A doomed volley still forces the
rival to hold their shield, and **holding costs them a note at their turn start.**
The player with a junk chord is no longer weak-with-no-move — firing anyway taxes
the target's guard, which is a real reason to pull the trigger.

🎯 **Better than the floor-hack this section was reaching for** (*"a Swing that
clears one segment's worth still breaks one segment"*), because it needs no new
special case — it falls out of a rule that exists for other reasons.

⚠️ **IT DOES AMEND §4's "A FAILED SONIC IS NOTHING HAPPENING."** The new line:
**a failed Sonic does not hurt them, but it does cost them.** 📌 That is a better
principle than the original — it keeps the Sonic from ever being a dead action —
but it is a deliberate change, and is recorded as one rather than left to drift.

### 5.5 ❤️ Vibe is too small

A landed Swing averages **~2.5 Vibe**; a landed Sonic **~1.2**. Against pools of
4–5, a Spirit dies to **two** connected Swings.

⭐ **Alex: 4–5 are "wimpy numbers" and Vibe goes up.** For a knockdown to be an
earned event of three or four solid connections rather than two lucky ones, the
band to tune against is **≈12–15**. That also gives Sonic chip damage somewhere
to accumulate, which at Vibe 5 it does not have. ⁉️ Exact number open.

---

## 6. 🎤 THE FAN ECONOMY — re-pointed

⭐ **Fans no longer multiply Fame. Casuals set your DIE SIZE** (d6 → d8 → d10 →
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

⁉️ **OPEN, and it is the whole size of the fork: does the carrot add a DIE or a
+1?** Nine points or twenty-nine. 🎯 A note is a note — it should probably add a
die.

📌 **The leverage is loudest at the START of a match** (+29 on turn three, +7 in
the endgame). The moment that teaches the lesson is the most dramatic one the
player will ever get. Most games do this backwards.

⚠️ **Rule 10's own warning stands:** the fork must not inherit the Harmonic Lock
cliff (`melodyCommit.js:441` — a non-standard ending forfeits the lock too, so a
colour ending costs up to 6 Db, not 3). A fork where one prong secretly costs
extra Db is not a fork.

---

## 8. 📡 RANGE IS DELETED

⭐ **Amps have free range. There is no radius.** `rigRadius`, `inRange`, the
out-of-rig d4 (`SONIC_DEF_DIE_OUT_OF_RIG`), the neon ring in `board/ampDecks.jsx`
and the `distFromHome` reads all go.

🎯 **This also deletes the anti-spiral `sonicRig.js` flags in its own comments** —
Sustain frays when hit → the rig shrinks → the defence die shrinks → harder hits.

⚠️ **BUT IT COSTS THE BOARD SOMETHING, AND THE BILL IS NOT ZERO.** `rigRadius` is
the leash tying a Spirit to their home hex. With free range, Sonic ignores
position entirely and movement's only remaining jobs are pickups and melee — on a
board that just had 🌀 Shukuchi's hops and 🗡️ Bushido's lane built into it.

💡 **The middle option: let DISTANCE RAISE THE TARGET NUMBER** instead of gating
the shot. Range stops being a refusal ("you may not fire") and becomes a cost
("their shield reads two higher from way over there"). Same free-range feel, no
new subsystem — one term in a number already being computed. ⁉️ Not decided.

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

## 10. ⁉️ OPEN DECISIONS, in the order they block each other

✅ **CLOSED 2026-09-11:** the old **#2** (do the Sonic and the Swing stop
competing — §5.3) and the **§5.4 dead corner**. Both fell out of §3/§3.5 rather
than needing their own fix.

1. ⛔ **The Swing's wall formula.** §5.3. 🆕 **Re-examine before solving it** —
   §5.3.1: the "3 segments" the knife edge is computed against existed so the
   **Sonic** could chip them, and the Sonic no longer does. **Check whether
   `segments` still refers to anything before tuning a formula that multiplies by
   it.**
2. ⛔ **`SUSTAIN_FRAY_CAP`.** §3.5.3. Ship **2**; the real answer is a function
   of `speed` and the §2.1 curve. ⚠️ **The bill must never consume a full turn's
   note income**, or the leader stops being able to attack at all.
3. ⛔ **AP — does a turn hold ONE attack or more?** 🚨 **Promoted from the
   bottom of this list to a blocker** (§3.5.4). §3.5's entire safety argument rests
   on the fray bill being bounded by the player count, and that bound only exists
   if a turn holds one attack. It cannot be left open underneath §3.5.
4. ⛔ **The chord table re-basing curve.** §2.1.
5. ⛔ **Vibe's new number.** §5.5.
6. ⁉️ **The Swing's risk model.** §4.2 — three outcome-keyed prices are on the
   table; **Alex has not ruled.** The cooldown he opened with was argued against
   and is filed in §11.
7. ⛔ **Does the melody carrot add a die or a +1?** §7.
8. ⛔ **The roster.** 👹 Metalness is the bruiser and the Swing is the marquee
   move; 🐀 Riff Rat was never formally decided. ⚠️ **Still designing combat for
   a cast that is not cast**, and still the thing most likely to invalidate every
   number in §5.
9. ⁉️ Distance-raises-the-target-number, or true free range? §8.
10. ⁉️ **Ties.** `attackerWon = atkTotal > defTotal` gives ties to the defender.
    📌 §3.1's worked example **assumes this** — the rolled 4 against Sustain 4 was
    absorbed. On an all-or-nothing Swing that costs everything, is it too harsh?
11. ⁉️ **Does the turn-start fray need its own HUD element?** §3.5.1 bills the
    defender for something that happened on **other people's turns**, so the count
    has to be visible while it accrues or the cost arrives as a mystery. 🎭 The
    payoff is a good moment — your turn opens with *three of them came at you, and
    your Cmaj9 is a bare fifth* — but only if the player watched it coming.
12. ⁉️ **Does the Swing take a player INPUT, or is it watched?** §12.5. ⚠️ A
    timing input costs the same determinism guarantee §11 rejected the hidden bid
    over. 💡 The dodge — timing drives the **camera and the sound**, never the
    numbers — is cheap and probably right.

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

> **Status: VISION. Nothing built.** Opened 2026-09-11 with Alex, off the back of
> §3/§3.5. 📌 This section is about **staging**, not rules — but §12.7 is a real
> mechanical flag, and §12.5 is an open decision.

### 12.0 ⭐ THE STRUCTURAL PROBLEM, and the one rule that solves it

🎯 **The Sonic's drama is PARALLEL and SPATIAL. The Swing's has to be SEQUENTIAL
and VERTICAL.**

Five beams is cinematic for free — five independent yes/nos, spread across the
board, resolving at once, and you can cut between them. ⚠️ **A sum is the least
cinematic operation in dice gaming.** Five dice land, a number appears, the player
is told a verdict. That is the thing the Swing's staging has to beat.

⭐ **THE RULE: NEVER REVEAL THE TOTAL. MAKE IT CLIMB.**

📌 Everything else in this section is a consequence of that one line.

### 12.1 🔊 The Sonic — Alex's picture, 2026-09-11

> *"Different camera angles zooming and watching the Sonic attacks blast from the
> amps around the attacker and into the Rival Spirit's shield — or breaking
> through to the Rival."*

⭐ **The two outcomes must look completely different**, because §3 made them
different: a beam is **absorbed** (it detonates against the shield, which flares
and holds) or it **goes past** (it reaches the Spirit). 🎯 **This is where a
defence becomes visible** — §3.1: the defender gets to *feel* their Sustain work,
and high Sustain should read as **absorption**, not attrition.

📌 **Three beams through = three hexes of knockback** (§3.1). The camera can
follow the last beam into the hit and ride the rival backwards. One number, two
jobs, one shot.

### 12.2 ⭐ THE SWING: the dice stack IS a chord — and so is the wall

This is the answer to Alex's *"dice stack battle?"*, and the game's own fiction
does all the work.

📌 **§1's rule applies here too: notes, not bolts.** Your Swing dice **are the
notes of your chord**. The wall is **their** chord, drawn as a stacked voicing with
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
