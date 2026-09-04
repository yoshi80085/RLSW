# RLSW — Shredding Ronin: Ability Design

**Design pass of 2026-08-22 (Alex).** This is the canonical statement of what the
Ronin's four abilities are *meant to be*. It is a design doc, not a report on the
build.

> ✅ **THE FOUNDATION SHIPPED THE SAME DAY — see §7.** The general cooldown
> system, per-use Db on the three actives, and Shadow Illusion's Sustain drain
> are all in the code and under test. §0.2's ledger has been updated to match.
>
> ✅ **CURSED SHAMISEN REWORKED AGAIN 2026-08-26 (Alex).** The board-token design
> (phrase feeding, wandering AI, growing aura, exorcism) is gone entirely. §2.3
> now describes a **self-buff that accelerates cooldowns** with a **curse debt**
> mechanic. `test:shamisen` rewritten: 34 assertions.
>
> 🐛 **THAT REWORK ALSO BROKE THE GAME, AND IT IS WORTH KNOWING HOW.** The cut
> that removed the feeding block ran past the end of it and took the last two
> lines of the melody commit and the whole `startNewTurnNotes` function with it —
> no move phase after a commit, no cards dealt on the next turn, all eighteen
> suites green throughout. Repaired 2026-08-26b; `SEQUENCING.md` §5 is the report,
> and `test:client` is the tripwire that now exists because of it. **The mechanic
> in §2.3 was never the problem — the deletion around it was.**

> ⚠️ **THIS DOC AND THE SHIPPED GAME NOW DISAGREE IN EXACTLY ONE PLACE, AND THE
> DOC IS THE INTENT.** **Wa no Koe is a different ability entirely** — the shipped
> one is a passive harmony bonus, the designed one is a board-wide resonance
> state. §4 is the measured difference, line by line. Read it before quoting §2 at
> the code. (Cursed Shamisen was reworked 2026-08-26 — §2.3 now matches the code.)
>
> 🪦 **AND `CHARACTER_HANDOFF.md` WAS WRONG ABOUT CURSED SHAMISEN** — it described
> a three-stage escalation the code has never had. §6. It has been corrected in
> the same pass, per CLAUDE.md's rule that a drifted doc is worse than no doc.

> 🗡️ **THE KIT WAS RESPECCED 2026-09-04 (Alex), AND THIS DOC IS NOW THE RECORD
> OF IT.** Five abilities, not four: 🌀 **Shukuchi Arpeggio is entirely new**,
> 🎵 **Wa no Koe is CUT**, and 🎸 **Cursed Shamisen changed verb twice** — first to
> the cooldown self-buff that ships today, now to a **siphon that steals cooldown
> off a rival**. Costs and cooldowns moved on all four survivors. §2 is rewritten;
> §0.2's ledger and §4's drift table follow it.
>
> 🪦 **AND IT HAD BEEN WRITTEN DOWN IN THE WRONG DOC FOR TWO DAYS.** The spec was
> captured on 2026-09-02i as `UPGRADE_SHOP_DESIGN.md` §3.1 — correctly, in detail,
> and under a heading that said *"the base kit Alex specified is NOT what ships …
> this table is a decision, not a footnote."* Then it stayed there, inside a doc
> about **pricing**, while THIS file — the one `CLAUDE.md` and
> `CHARACTER_HANDOFF.md` both name as canonical for the Ronin — went on calling
> the old four **"FIRM DECISIONS"** and never learned the word *Shukuchi*.
> ⭐ **AND TWO MORE RULES LANDED 2026-09-04, AFTER the respec above.** The siphon's
> steal was settled — **the rival is pushed +1, further from ready**, while Ronin
> takes N (§2.3.0) — and the economy changed under all of it: **every base ability
> now costs the same, every seat starts with one ability active, and upgrade prices
> rise per ability** (`UPGRADE_SHOP_DESIGN.md` §0⃣). **The unlock prices in §2's
> table are void.**
>
> ⚠️ **Neither doc was wrong on its own facts.** The failure was one of ADDRESS:
> a decision filed where only someone pricing a shop would read it. That is a new
> shape of the §5 disease and it is worth naming, because no test can catch it —
> `test:arch` checks that modules exist, not that a decision is filed where the
> next person will look for it.

---

## 0. Two rules that changed, and they are GAME-WIDE

Alex's call, 2026-08-22:

> *"From now on, all abilities cost at least 1 Db, and all abilities have some
> cooldown."*

### 0.1 Why the rule exists

Both halves point at the same failure: an ability with no per-use price and no
recharge is not a decision, it is a **default**. It gets taken every turn it is
legal, it stops competing with the rest of the turn, and the interesting question
("is this the moment?") never gets asked. Db is the game's scarcity; a power that
never touches it is outside the economy.

📌 This also protects the searcher. `BOT_STRATEGY_HANDOFF` §6.6 already records
that the Ronin picks Psycho Bushido on **23.3%** of turns where it is legal
against **10.2%** for a plain Swing — and that is an ability which *does* have a
cooldown. A free, uncooled ability doesn't get evaluated against alternatives so
much as it removes them.

### 0.2 ⚠️ THE LEDGER — WHO PAYS AND WHO STILL OWES

Measured from `data/skillTree.js`, `data/gameConstants.js` and the resolvers.
`dbCost` in the tree is the **one-time unlock** price and is not what this rule is
about — the rule is about the **per-use** cost. ✅ marks what shipped 2026-08-22.

| Spirit | Ability | Db per use | Cooldown |
|---|---|---|---|
| Ronin | 🌀 Shukuchi Arpeggio | **1** ⭐ *(spec — nothing built)* | **3 rounds** ⭐ |
| Ronin | 🗡️ Psycho Bushido | **1** ✅ *(→ CD **4** in the respec)* | 2 rounds ✅ |
| Ronin | 👤 Shadow Illusion | **2** ✅ + 1 Sustain/turn while it stands *(→ **1** Db, per **round**)* | **3 rounds** ✅ *(→ **4**)* |
| Ronin | 🎸 Cursed Shamisen | 2 ✅ *(→ **1**)* | **3 rounds** ✅ *(→ **4**)* |
| ~~Ronin~~ | ~~🎵 Wa no Koe~~ | 🪦 **CUT 2026-09-04 — §2.4** | — |
| Metalness | 🔊 Goes to 11 | **0** ⏸️ | **none** ⏸️ |
| Metalness | 🤘 Master of Moshpits | **0** ⏸️ | **none** ⏸️ |
| Metalness | 🐙 Tentacle | **0** ⏸️ | **none** ⏸️ |
| Metalness | 💀 Azrael | **0** ⏸️ | **none** ⏸️ |
| Intergalactic 0 | 🌀 Blaster of Ra | **0** ⁉️ | **none** ⁉️ — *see §0.5* |
| Intergalactic 0 | 🌌 Space is Displaced | 1 ✅ | **1 round** ✅ |
| Intergalactic 0 | 🕳️ Gravity Control | 1 ✅ | **2 rounds** ✅ |
| Intergalactic 0 | 💻 Code Injection | 1 ✅ | **2 rounds** ✅ |
| Intergalactic 0 | ☀️ Sunbeam | 2 ✅ | **2 rounds** ✅ |

**Was 5 of 13 paying Db and 1 of 13 cooled. Now 7 of 13 and 7 of 13.**

⚠️ **THE RESPEC MOVES THE DENOMINATOR AND THIS TABLE IS NOW A HYBRID — READ THE
PARENTHESES AS INTENT, THE ✅ AS CODE.** Wa no Koe leaves (13 → 12) and Shukuchi
arrives (12 → 13), so the totals happen to land back where they were. **That
coincidence is the only reason the counts still read 7 and 7**, and it will stop
being true the moment either half is built. 📌 The rule itself is unaffected: the
respec prices and cools every one of the five, so the Ronin still owes nothing.

⛔ **AND ONE OF THE TWELVE JUST BECAME A PREREQUISITE INSTEAD OF A DEBT.**
Metalness's four uncooled abilities were parked as *"debt, not oversight"* pending
his redesign. §2.3.0's siphon can only take cooldown that exists, so **his empty
row is now what makes the Ronin's new Shamisen inert against him.** Parking it
costs something specific now.

⏸️ **Metalness's four are untouched ON PURPOSE.** The character is being
redesigned (Alex, 2026-08-22), so pricing a kit that may not survive the redesign
is work thrown away. They stay in this table as debt, not as an oversight.

⁉️ **Blaster of Ra is a question, not a debt — see §0.5.**

⏸️ **Wa no Koe was deliberately skipped, and it is the one exception in the
kit.** It is a *passive* — there is no moment of use to charge for — and §2.4
replaces it outright. Building a per-proc price for an ability scheduled for
deletion is work thrown away twice: once writing it, once removing it. It gets
its cost and its cooldown as part of the replacement, when it becomes an active.

🎯 **`psychoBushidoCd` WAS THE ONLY COOLDOWN IN THE ENTIRE GAME**, which is why
the fix was a system and not a number. A named `<x>Cd` field per ability means
every new ability needs an `economy` seed, a `turnFlow` tick, a `legalActions`
gate and a HUD read before it can have a cooldown at all — four chances to
forget, and twelve abilities that never got one is what that costs. It is now
one map (`ns.abilityCd`), one tick, one gate: `engine/systems/cooldowns.js`.
**Giving the remaining abilities a cooldown is now a data edit** — Intergalactic
0's four took theirs the same day, and Metalness's four are waiting on his
redesign rather than on any code.

### 0.3 ✅ SETTLED — there are no exemptions, only different rates

**Alex, 2026-08-22:** *"Make it a 1 turn cool down. Different abilities can cool
down at different rates."*

🎯 **THAT IS A BETTER RULE THAN THE ONE THIS DOC PROPOSED**, and it is worth
saying why. The question "is this ability special enough to be exempt?" is an
argument with no end — every ability's designer can make the case, and each
exemption granted strengthens the next one's claim. "How long should this one
be?" is a number. Same flexibility, no precedent.

**Space is Displaced was the strongest exemption case in the game and it did not
get one.** Its own skill text used to promise *"No cooldown, no Action Points, no
rig required"*, and the blink is the slowest Spirit's compensation for being
slow. It got **1 round** — short enough that the compensation survives, long
enough that the rule is real. The skill text now says so.

Gravity Control and Code Injection were the other two exemption candidates. Both
took numbers instead: **2 rounds each**. 📌 Code Injection is 2 rather than 1
because `codeInjectTurns` already blocks re-arming while a patch is live, so a 1
would have been decorative — a cooldown that never denies anything.

### 0.4 ✅ SETTLED — innate passives are out of scope

**Alex, 2026-08-22: exempt.** And it is a *scope line* rather than an exemption.
Boom Box, Poison Slime, crowd virtuosity and Freestyle are not things you **do** —
there is no moment of use to charge for. Poison Slime fires when Metalness
*vacates* a hex; crowd virtuosity is a modifier on Performance Score.

**An innate is the character. An active is a choice.** The rule exists to make
choices cost something, so it binds the things you choose.

### 0.5 ⁉️ OPEN — is Blaster of Ra an *ability*?

It is the one thing in the game the rule cannot price without an answer, and the
reason is structural rather than a matter of taste.

**Blaster of Ra does not add an action. It REPLACES the Smash.** `hasBlaster`
branches the Smash button in the client and the smash family in `legalActions`.
So a per-use Db cost or a cooldown on the Blaster means Intergalactic 0 has **no
Smash at all** for a stretch — a basic attack every other Spirit keeps for free.
Nobody designed that; it falls out of pricing a thing that is standing in another
thing's shoes.

Which suggests the rule may need a **third category** beyond *active* and
*innate*: a **permanent upgrade to a basic action**. And Blaster would not be
alone in it — 🐙 Tentacle lets Metalness Swing from anywhere on his slime trail,
which is the Swing wearing a hat rather than a new verb.

Three ways out, and it is Alex's call:

1. **Cooling the Blaster falls back to the ordinary Smash.** The *upgrade* rests;
   the baseline never goes away. Costs one branch in the Smash path.
2. **Blaster is a basic action and is out of scope**, like the innates in §0.4 —
   the Smash itself has no Db cost and no cooldown, so neither does its
   replacement.
3. **Price it anyway** and accept that Intergalactic 0 loses his Smash while it
   recharges, as the price of the upgrade.

📌 It is **absent from `ABILITY_CD` and `ABILITY_DB_COST`**, with a comment saying
why, so nobody reads the gap as an oversight and quietly fills it in.

---

## 1. Character thesis

Ronin is a **glass-cannon / threat-architecture** character. He owns the
**Melody Line / space** seam of the four-pillar model (`CHARACTER_HANDOFF.md`
"The big idea"), and the archetype quartet reads
**Ronin = Burst/virtuoso · Intergalactic 0 = Control/zoner · Metalness = Bruiser ·
Glamarchy = Star.**

The kit is about:

- **Distance and line of sight** — he is punished for being close and paid for reach.
- **Deception and positioning** — the opponent should not be sure what they are looking at.
- **A persistent threat** that exists on the board when he is not acting.
- **Turning the stage's music against itself.**
- **Meaningful risk** traded for powerful effect.

🎯 **The design success of this kit is that each ability poses a DIFFERENT
question.** That is worth protecting above any individual number:

| Ability | Role | Manipulates | The rival's question |
|---|---|---|---|
| 🌀 Shukuchi Arpeggio | Mobility | Distance | *Where can he NOT be next turn?* |
| 🗡️ Psycho Bushido | Burst attack | Distance / LOS | *Can I stay out of his kill lane?* |
| 👤 Shadow Illusion | Deception | Position / Sustain | *Which Ronin is real?* |
| 🎸 Cursed Shamisen | Tempo / theft | **The rival's** cooldowns | *Was I paying attention to what he just used?* |
| ~~🎵 Wa no Koe~~ | 🪦 **CUT 2026-09-04** | — | — |

✅ **THE SIPHON KEEPS THE PROPERTY THIS TABLE EXISTS TO PROTECT, AND SHARPENS
IT.** The old Shamisen asked *"did he pay the debt?"* — a question about **Ronin's**
hidden state, which made it a coin the rival called. The siphon asks a question
about the **rival's own** choices: every ability they fire becomes a thing Ronin
can come and take. 🎯 **It is the only ability in the game that reads an
opponent's SHEET rather than the board**, which is a genuinely new axis and the
strongest argument for it.

⚠️ **Shukuchi's entry is the weakest line in this table and that is a real note,
not a formality.** *"Where can he not be?"* is a question every mobility tool in
every game asks. It earns its slot on the kit's geometry — it is the delivery
system for a Bushido that now needs a rival 3–5 hexes directly in front — rather
than on posing a new question of its own. 📌 If a later pass has to cut something
to make room, this is the ability with the least identity to lose.

⚠️ **This is why the kit must not drift back toward note manipulation.** An
earlier version had Cursed Shamisen corrupting the target's notes *and* Wa no Koe
converting other Spirits' notes into Ronin's. Two abilities, one verb, and a pile
of bookkeeping. **Both were deliberately moved off notes.** If a future change
puts a second ability back on note manipulation, this paragraph is the objection.

---

## 2. The five abilities — FIRM DECISIONS

Everything in this section is decided. **Numbers are Alex's 2026-09-04 respec**,
promoted here from `UPGRADE_SHOP_DESIGN.md` §3.1. §4 measures them against what
the code actually does today — and after this respec, **every one of the five
drifts**, because none of it is built.

⚠️ **THE SUBSECTION NUMBERS DO NOT MOVE, DELIBERATELY.** §2.3 and §2.4 are cited
by `CHARACTER_HANDOFF.md`, `SEQUENCING.md` and three code comments. Wa no Koe
keeps §2.4 as a **tombstone** rather than being deleted and letting Shukuchi
inherit the number — a renumber would silently redirect every one of those
citations to the wrong ability. Shukuchi takes the new §2.5.

| § | ability | unlock | per use | CD | status |
|---|---|---:|---:|---:|---|
| 2.1 | 🗡️ Psycho Bushido | 8 | 1 | 4 | ⚠️ respecced, not built |
| 2.2 | 👤 Shadow Illusion | 10 | 1 + 1 Sustain/round | 4 | ⚠️ respecced, not built |
| 2.3 | 🎸 Cursed Shamisen | **?** | 1 | 4 | ⛔ **new verb entirely** |
| 2.4 | 🎵 Wa no Koe | — | — | — | 🪦 **CUT** |
| 2.5 | 🌀 Shukuchi Arpeggio | 6 | 1 | 3 | ⭐ **new, does not exist** |

⛔ **THE UNLOCK COLUMN ABOVE IS VOID AS OF 2026-09-04.** Alex's flat-cost rule —
**every base ability costs the same, and every seat starts with one already
active** — replaces the 6 / 8 / 10 spread wholesale. `UPGRADE_SHOP_DESIGN.md` §0⃣
is the rule; the flat number itself is not chosen yet. 🎯 **It also answers the
question this paragraph used to ask:** the Shamisen's blank price was never going
to be filled in individually. **Per-use costs and cooldowns are unaffected** —
those are §0's rule, which stands.

🧊 **AND BALANCE IS DEFERRED WHILE THE KIT MOVES (Alex, 2026-09-04).** Prices,
cooldowns and relative strength are all mid-flight; a measured imbalance right now
is information, not a defect. `UPGRADE_SHOP_DESIGN.md` §0⃣.4 is the standing
instruction. ⚠️ **§2.4.2's nerf ledger stays recorded and is explicitly NOT to be
acted on yet.**

### 2.1 🌀 Psycho Bushido — the long-distance strike

**The inspiration is Zenitsu's lightning strike from an absurd distance.** Ronin's
signature.

**Decided:**

- The attack becomes **more powerful the FARTHER the target is.** This is the
  ability. A conventional ranged attack that is equally good at all ranges is not
  this ability.
- The gate is **line of sight**. A Spirit must either **move into** Ronin's
  current line of sight, or **be pushed into it**.
- Ronin is **not a chaser.** He is waiting for someone to enter the kill lane.
- Costs Db and has a cooldown (§0).

**Why it works:** it creates one legible, board-wide threat — *"do not enter
Ronin's line of sight"* — and because other Spirits can **push** a rival into that
lane, opponents can also manufacture Ronin's opportunities. The threat is a shared
object on the board, not a private ability.

✅ **The shipped code already agrees on the important half.** The bonus is
`distToTarget - 1` — the ground he covered — and the comment at line 8138 records
that it used to be `apLeft - distToTarget`, which paid *most* for a charge of zero
hexes. Alex caught it 2026-08-20 by reading the payout table. **Do not let that
sign flip back.** The inversion is also why the ability needs **no minimum-range
rule**: the move spends the whole remaining AP pool, so a charge from next door is
strictly worse than the 1 AP Swing it replaces. The cost polices itself.

#### 2.1.1 ⚠️ THE 2026-09-04 RESPEC — and it deletes the ability's best idea

| | was | now |
|---|---|---|
| unlock | 6 Db | **8 Db** |
| per use | 1 Db | 1 Db |
| cooldown | 2 rounds | **4 rounds** |
| AP | spends ALL remaining | **3 AP flat** |
| target | anyone in the facing line | **a rival 3–5 hexes directly in front** |
| movement | — | **consumed** |
| Drive bonus | `distToTarget − 1`, scaling | **+3 flat** |
| extra cost | — | **spends 2 off the Drive stack** |

⛔ **THE FLAT +3 REMOVES THE DISTANCE GRADIENT, WHICH IS THE THING §2.1 SAYS THE
ABILITY IS.** Read the top of this section: *"The attack becomes more powerful the
FARTHER the target is. This is the ability."* A flat +3 makes every legal charge
identical, so the sentence stops being true the day this ships.

🎯 **The saving grace is the 3–5 window, and it may do the same job better.** The
old design policed range with a *payout curve* — a charge from next door was legal
but bad. The respec polices it with a *rule* — a charge from next door is not
legal at all. **That is far easier to read**, and "the ultimate beginner" is the
stated audience (`SEQUENCING.md` §5-glow.A). A gradient nobody notices is worse
than a bright line everybody does.

⚠️ **But it is a trade, and it should be taken as one.** What is lost is the
*texture*: with a flat bonus there is no longer a best hex to strike from, only a
legal band. 📌 **The cheap hybrid:** keep the 3–5
window as the legality rule and let the bonus be **+2 / +3 / +4** across it. One
line of code, the bright line survives, and the far shot is still the good shot.
✅ **THIS IS WHAT ALEX TOOK, 2026-09-04e — see the box at the top of this section.**

📌 **`2 Drive stack spent` is new and is not a small cost.** The Drive stack is
what opens stack seats (`music/stackSlots.js`); spending two to fire an attack
takes the ability's price out of the *progression* system rather than the combat
one. That is an interesting trade and nobody has costed it.

### 2.2 👤 Shadow Illusion — the decoy

**Decided:**

- Ronin creates a **perfect-looking decoy**. It looks exactly like him, moves
  freely, and **collects notes**.
- To other players it **appears to be a legitimate competitor.**
- It has **no Health and no attack capability**, and **disappears immediately if
  attacked.**
- ⚠️ **While it is active it DRAINS RONIN'S SUSTAIN.** This is the load-bearing
  cost and it is what makes the ability a trade rather than a freebie: *"I can be
  in two places at once, but I am sacrificing my own defences to do it."*
- Costs Db and has a cooldown (§0).

**What it is actually for** — not just a visual trick:

- makes opponents waste AP positioning against it,
- makes opponents attack the wrong Ronin,
- collects notes for the real Ronin,
- creates uncertainty about where the real threat is,
- **potentially draws players into a Psycho Bushido sightline.**

That last one is the reason the two abilities belong in the same kit.

📌 **Keep the stacked spawn.** The shipped decoy is born on Ronin's own hex, and
the comment at line 8246 has the reason: a decoy that pops into an *empty adjacent
tile* identifies itself as the copy on the spot. Starting superimposed means there
is no "where it came from" to reason about.

**🔮 Shadow Exchange / Kage no Ken — NOT part of the kit.** A swap-places-with-
the-illusion ability was discussed. It is a *possible future addition* if
playtesting shows the illusion needs more depth. It is **not decided** and must
not be built as though it were.

#### 2.2.1 The 2026-09-04 respec

| | was | now |
|---|---|---|
| unlock | 6 Db | **10 Db** |
| per use | 2 Db | **1 Db** |
| upkeep | 1 Sustain/turn | 1 Sustain **per round** |
| lasts | 3 turns | **2 turns** |
| cooldown | 3 rounds | **4 rounds** |

🎯 **This is the cleanest of the four respecs: dearer to own, cheaper to fire,
gone sooner.** It pushes the double from a thing you keep up toward a thing you
*spend*, which suits a deception tool — a bluff that stands for three turns stops
being a bluff and becomes a fact.

⚠️ **But it collides with a warning already on the books.** §6.3 records that the
double pops on all three conditions (struck / Ronin attacks / Ronin is attacked)
and flags: *"if the double never survives long enough to matter, this is the first
dial to turn."* **Cutting 3 turns to 2 turns that same dial the wrong way**, at a
10 Db unlock. The two changes were decided months apart and have not been looked
at together. 📌 The upkeep also moved from *per turn* to *per round* — cheaper in
a 3-player match — which pulls the other way and may cover it.

### 2.3 🎸 Cursed Shamisen — the siphon

> ⛔ **REWORKED AGAIN 2026-09-04 (Alex) — AND THIS IS THE THIRD VERB.** Board
> token (cut 2026-08-26) → cooldown self-buff (ships today) → **cooldown THEFT.**
> The ability no longer touches Ronin's own cooldowns directly at all: it reaches
> into a **rival's** sheet and takes tempo off them.
>
> 🪦 **§2.3.1–§2.3.7 below now describe the SHIPPED ability, not the designed
> one.** They are kept because the shipped one is what runs in the build today and
> `test:shamisen`'s 34 assertions stand on it. **Read §2.3.0 for the design.**

#### 2.3.0 ⭐ THE SIPHON — Alex, 2026-09-04

**Ronin plays the shamisen over an area, like a Swing.** The player then picks
**one special ability belonging to a rival in that area**.

- **If that ability is on cooldown, Ronin siphons it.** The rival's cooldown is
  pushed **+1 — further from ready.** Ronin's own cooldowns drop by **N**, where
  **N = the number of turns that ability had left.**
- **If it is not on cooldown, nothing happens.** The turn is spent.

🎯 **THE ASYMMETRY IS THE ABILITY: the rival is set back 1, Ronin takes N.** He is
pulling the *recharge itself* out of their instrument — the turns they had already
served come to him, and they are pushed back a step for the theft. **Pure theft, in
both directions at once**, which is why the read is clean at the table: nobody has
to be told which way the numbers move.

📌 **A "rival −1" version was considered and rejected (Alex, 2026-09-04).** It
would have had Ronin *leak* a turn back — the only ability in the game that helps
an opponent — which self-braked the siphon but muddied what the ability plainly
does. ⚠️ **The consequence of choosing +1 is that nothing brakes it:** siphoning
the same rival's same ability repeatedly is strictly good for Ronin and strictly
bad for them. **The Shamisen's own 4-round cooldown is currently the entire
limiter.** Noted, accepted for now, and the first place to look if one target ever
gets locked out of their own kit.

##### ✅ DECIDED — no reveal, and it is a READ not a GUESS (Alex, 2026-09-04)

**Ronin does not get a readout of a rival's cooldowns.** But — Alex's correction,
and it changes what this rule *is* — **that does not make it guessing.** Ability
use is public: everyone watches Sunbeam fire. With cooldowns eventually universal
and most of them landing at **3–4 turns**, a player who is paying attention knows
that the ability used two turns ago is **ripe**.

🎯 **SO THE INFORMATION IS ALREADY ON THE TABLE — IT IS JUST NOT ON THE SCREEN.**
The siphon pays for **tracking the fight**, and that is an earned right to the
points rather than a coin flip. A player who watched gets paid; a player who did
not, does not. ⚠️ **This is a real design position and it should not be softened
into a UI feature.** A cooldown readout would convert an act of attention into an
act of reading a number, and delete the skill the ability exists to reward.

📌 **It also fixes the scaling worry on its own.** With 3–4 round cooldowns as the
norm, a well-timed siphon takes **2–3 points**, not the 1–2 the current shipped
constants allow — and it sets the rival back on top. **The ability was never small;
the game was just still small around it** (§2.3.0's measured note below).

##### ⛔ FOUR THINGS THIS BREAKS, MEASURED FROM THE CODE

✅ **1 AND 2 ARE ANSWERED — BY A RULE, NOT BY A PATCH (Alex, 2026-09-04).**
**Every Spirit will get a cooldown eventually, and most will land at 3–4 turns.**
That is now the design's stated direction, and it dissolves both objections at
once. They are kept below because **until that rule is actually implemented the
siphon cannot be benched or balanced** — it is theory resting on a rule the game
does not yet have, and Alex has accepted that explicitly. ⚠️ **Do not read a bench
of the siphon against today's constants as evidence of anything.**

1. 🪦 **IT IS BLANK AGAINST METALNESS TODAY. Not weak — blank.** His four
   abilities have **no cooldowns at all**: `goes_to_11`, `master_moshpits`,
   `tentacle` and `azrael` appear in neither `ABILITY_CD` nor `ABILITY_DB_COST`.
   ✅ **Resolved by the universal-cooldown rule** — but note the ORDER it forces:
   **the siphon cannot ship before cooldowns are universal**, or it is an ability
   that does nothing against one of three opponents. §8.1 (d).
2. 📏 **N BARELY SCALES TODAY.** Every rival cooldown in the shipped game:
   `DISPLACE_CD 1`, `GRAVITY_CD 2`, `CODE_INJECT_CD 2`, `SUNBEAM_CD 2` — so N is
   1 or 2, never more. ✅ **Resolved by the 3–4 turn norm**, which puts a
   well-timed siphon at **2–3 points plus the rival's setback**. 🎯 **The payoff
   curve was never the problem; the surrounding game was just still small.**
3. ⚠️ **WHERE DO THE N POINTS GO? STILL UNDECIDED — and it is now the only live
   question in the siphon.** All onto one ability of Ronin's choosing? Split?
   Everything he owns, by N? At N = 2–3 across a four-ability kit, "choose one" is
   almost certainly right, but **it is the difference between a nudge and a reset**
   and nobody has said which.
4. ⚠️ **IT PUTS A REACH CHARACTER AT SWING RANGE.** §1: *"he is punished for being
   close and paid for reach."* A Swing-shaped area means walking into the fight to
   use it. 📌 Shukuchi (§2.5) is the answer if there is one — the in-and-out is
   why the two abilities may belong in the same kit.

##### 🪦 What the siphon DELETES

The glow, the debt, the 1 Db/round protection, the total cooldown reset, and
`ns.shamisenCurse` — the whole 2026-08-26 mechanic, §7b, and the 34 assertions of
`test:shamisen` that cover it. ⚠️ **`UPGRADE_SHOP_DESIGN.md` §4 #4 prices an
upgrade on it** (*"the deeper debt", 8 Db, CD relief −1 → −2, two abilities restart
on Vibe loss*) — **that upgrade is now built on an ability that will not exist.**
It needs redesigning against the siphon, and §3.1 of that doc needs this table.

#### 2.3.1 What it does *(🪦 SHIPPED VERSION — superseded by §2.3.0)*

Ronin invokes the cursed strings (**2 Db**, **3-round cooldown**). For
**3 rounds**, ALL of his **other** ability cooldowns — Psycho Bushido, Shadow
Illusion, Wa no Koe — tick at **2× speed** (one extra tick per round on top of
the normal tick). The Shamisen's **own** cooldown is excluded; it must not
accelerate itself.

⚠️ **Duration equals cooldown (both 3).** The curse expires the same turn it
comes off CD, so there is no overlap window where Ronin can stack two curses.
If this equality ever breaks, the UI needs an "already cursed" guard.

#### 2.3.2 The glow — information asymmetry IS the mechanic

While the curse is active, **Ronin glows purple on the board**. The glow is
visible to everyone for the full 3 rounds, **regardless of whether he paid the
debt**. Rivals can see he is exposed, but they cannot tell whether attacking
him will trigger the penalty or not. **That is the bluff.**

📌 The glow is rendered as:
- A pulsing purple aura under Ronin's standee on the hex board.
- A `shamisen-glow` CSS animation on the Shamisen ability button in the HUD.

#### 2.3.3 The curse — what happens when he is caught

If Ronin takes **any Vibe damage in battle** while the curse is active **and**
he has **not** paid the debt that round, **ALL of his cooldowns RESET to their
full duration**. Every ability he has unlocked goes back to maximum cooldown.
The acceleration he gained — and then some — is wiped out in one hit.

⚠️ **This is the punishment, not a bug.** The whole point of the mechanic is
that getting caught costs the Ronin all the tempo he gained. It makes the
acceleration a genuine gamble rather than free value.

✅ **AND THE CURSE ITSELF ENDS THE MOMENT IT BITES** — `shamisenCurse` is cleared
in the same patch as the reset, so the glow goes out and the acceleration stops.
This doc was silent on it until 2026-08-26b and the code has always done it; the
code is right. Being hit is public anyway, so ending the glow leaks nothing that
§2.3.2's bluff depends on — what stays hidden is whether he *paid*, and a Ronin
who paid keeps both the glow and the curse.

#### 2.3.4 Paying the debt — the bluff within the bluff

Each round while the curse is active, Ronin **may** pay **1 Db** to protect
himself. If he has paid that round, taking Vibe damage does **not** reset his
cooldowns. But the glow stays regardless — rivals see exactly the same purple
aura whether he paid or not.

🎯 **This creates a genuine mind game.** The Ronin spends 2 Db to activate,
then optionally 1 Db per round (up to 3 Db total over the curse's life) for
insurance. A fully-insured curse costs 5 Db total. Running it uninsured costs
2 Db but risks a catastrophic cooldown reset if anyone lands a hit. The
optimal play depends on board state, rival aggression, and how convincingly
the Ronin can bluff invulnerability.

📌 **The debt payment is cheaper than activation on purpose** (1 < 2). If it
cost as much or more, paying every round would be strictly worse than
re-casting, and the bluff collapses.

#### 2.3.5 What is NOT here any more

🪦 Everything from the old §2.3 is retired:

- **Board token** — no hex, no SVG, no standee.
- **Phrase feeding** — no `♭3 → 2 → 1 → ♭6 → 5`, no `feedShamisenPhrase`.
- **Growing aura** — no rings, no `shamisenRings`, no `SHAMISEN_RING_MAX`.
- **Sustain fray** — no `SHAMISEN_FRAY`, no `frayFromSustain` calls.
- **Wandering AI** — no step-toward-nearest, no movement logic.
- **Exorcism** — no click-the-instrument, no resolving pitch class.
- **Minor key gate** — already removed earlier; now doubly gone.
- **`music/cadence.js` functions** — `feedShamisenPhrase`, `shamisenRings`,
  `shamisenResolvingPc`, `shamisenNextPc` are all deleted.

#### 2.3.6 Implementation

| Layer | What |
|---|---|
| **Constants** | `CURSED_SHAMISEN_DURATION = 3`, `CURSED_SHAMISEN_PAYOFF_COST = 1` (new). `CURSED_SHAMISEN_CD = 3`, `CURSED_SHAMISEN_DB_COST = 2` (kept). Old `SHAMISEN_PHRASE`, `SHAMISEN_RING_MAX`, `SHAMISEN_FRAY` deleted. |
| **`cooldowns.js`** | `tickShamisen(ns)` — extra tick for non-Shamisen abilities. `resetAllCooldowns(ns, unlockedSkills)` — slam everything to max. |
| **Client** | `resolveCursedShamisen()` — activation. `payShamisenDebt()` — round payment. `tickCursedShamisen()` — round tick. `checkShamisenCursePenalty()` — damage hook. `playShamisenStrum()` — audio. |
| **State** | `ns.shamisenCurse: { turnsLeft, paidThisRound }` replaces old `ns.cursedShamisen: { hex, linksFed, complete, fedThisRound, touched }`. |
| **Test** | `shamisenCheck.mjs` — 34 assertions covering acceleration, reset, constants, and design invariants. |

### 2.4 🪦 和の声 — Wa no Koe — CUT 2026-09-04

> ⛔ **ALEX CUT THIS ABILITY.** Both of them — the passive that shipped and the
> Resonant-note replacement designed below.
>
> ✅ **AND THE DELETION LANDED 2026-09-04.** Every item §2.4.1 lists is gone from
> the code: `checkWaNoKoe`, `waNoKoeBuffs`, `tickWaNoKoe`, the 5 client
> references, the skill row and its `desc`, the unlock log, the bot ladder entry,
> and the assertions in three suites. ⚠️ **§2.4.1 is kept as the RECORD of what
> the footprint was**, not as an outstanding task — and `melodyCommitCheck` §13
> is now the revival guard, so a re-add goes red instead of green.
>
> 💡 **Alex proposed a NEW form for the name on the same day** — declared by
> button, notes matching your root Drive/Sustain fly to you from across the
> board, stacking 1-for-1. It is in `IDEAS_INBOX.md`, undesigned on purpose.
> ⚠️ **It is not this section**, and it does not revive these symbols. The 12 Db mastery slot is empty and
> the kit is five without it (§2.5's Shukuchi is not its heir; it is a 6 Db
> mobility tool that arrives independently).
>
> 🎯 **THE DESIGN BELOW IS KEPT IN FULL, AND NOT AS SENTIMENT.** §2.4 is cited by
> `CHARACTER_HANDOFF.md`, `UPGRADE_SHOP_DESIGN.md` §3.3 and three code comments,
> and it holds the only worked statement of the **Echo** idea — Echoes spent to
> reset cooldowns — which is now MORE relevant, not less: §2.3.0's siphon is a
> cooldown-theft mechanic that arrived at the same destination by a different
> road. **If Echoes ever come back, they come back here.**

#### 2.4.1 ✅ THE CUT WAS A DELETION PASS, AND IT IS DONE — 📌 RECORD ONLY

`UPGRADE_SHOP_DESIGN.md` §3.3 measured the footprint and it is real:

- `checkWaNoKoe` — a **pure function in the engine kernel** (`melodyCommit.js`)
- `waNoKoeBuffs` — its own seat in `economy.js`'s initial note state
- `tickWaNoKoe` + **5 client references** in the monolith
- the Ronin's `skillOrder` in `engine/policies/bot.js`
- live assertions in **`melodyCommitCheck`, `shamisenCheck` and `harnessCheck`**
- the skill row, the `desc` and the unlock log

⚠️ **Delete it properly or it becomes the next `combat.js` dead-function scar.**
And note the 2026-08-26 precedent in this very file's header: *the cut that removed
the feeding block ran past the end of it and took `startNewTurnNotes` with it,
with all eighteen suites green throughout.* **The same ability, the same file, the
same class of cut.** Do this one with `test:client` and `check:bundle` at every step.

📌 **One thing dies with it that is worth an explicit goodbye:** the kernel
deliberately reproduces the shipped B10 bug where pre-commit `tempDrive` overwrites
the Drive boost the same commit just earned. **That bug and its one-place fix both
become moot** — `BOT_STRATEGY_HANDOFF` §7 should be told, not left waiting.

#### 2.4.2 ⚠️ AND IT IS THE THIRD STRAIGHT NERF TO THE RONIN

This is the pattern this doc should be shouting about, because no single change
looks unreasonable:

1. **2026-09-02** — the Theory ladder went universal, so the Chord Tone Pardon he
   was born with became the roster's floor. He lost a head start; nobody else gave
   anything up. Flagged in `CHARACTER_HANDOFF.md`, **never answered.**
2. **2026-09-03** — the drift sweep found his skill text still selling that head
   start as his. Corrected (§7c). Honest text, **no compensation.**
3. **2026-09-04** — Wa no Koe (**12 Db**) is cut, and Shukuchi (**6 Db**) arrives.
   The explicit consolation for #1 was *"Wa no Koe still stacks on top exactly as
   designed"* — **that sentence is now void.**

⛔ **Meanwhile his other three all got dearer** (Bushido 6→8, Illusion 6→10) **and
slower** (Bushido 2→4, Illusion 3→4, Shamisen 3→4). 🎯 **This is a CHARACTER
decision and it belongs in `CHARACTER_HANDOFF.md`, but it can no longer be filed
as "watch it" — three passes have now each assumed a later one would answer it.**

✅ **FILED 2026-09-04 — `CHARACTER_HANDOFF.md` → "THE RONIN LEDGER".** The
deletion pass was the fourth subtraction, so it wrote the ledger up there as a
table with a one-line question at the bottom rather than adding a fifth deferral.
⚠️ **It is still UNANSWERED, and the answer is Alex's.** Do not price it here.

#### 2.4.3 🪦 The design as it stood — RECORD ONLY, DO NOT BUILD

Ronin's **12 Db** mastery ability, and the most conceptually elegant of the four.

**The central idea: the entire stage becomes part of Ronin's song.** Deliberately
simplified from there.

**Decided:**

- **It affects ONE note.** Not every note in his chord. Ronin **chooses one note
  from his current chord stack**, and that note becomes **Resonant across the
  entire board** for the duration.

  > Chord stack `C – E – G` → he picks `G` → **G is Ronin's resonant note
  > everywhere.**

- **The current chord is what he can choose from.** This ties the ability to the
  existing musical system instead of inventing a separate selection system, and it
  means **Ronin's musical choices matter before he activates it.**
- **Echoes, and they do exactly one thing.** When another Spirit interacts with
  Ronin's Resonant Note, Ronin generates/collects an **Echo**. An Echo is spent to
  **reset a Ronin ability's cooldown.** That is the whole Echo economy.
  ⚠️ **No separate inventory. No temporary-note collection. No second currency.**
  The danger was identified explicitly: Shamisen corrupting notes *plus* Wa no Koe
  absorbing other people's notes is too much bookkeeping. Echoes stay one line
  long, and note the tight coupling to §0 — **Echoes are only meaningful because
  cooldowns now exist on everything.**
- **The Harmony state, and the vulnerability IS the ability.** Wa no Koe puts
  Ronin into a temporary **Harmony** state in which he is **extremely
  vulnerable** — he has turned his attention away from defending himself and
  toward listening to the whole stage.
- 🎯 **No "Harmony protection".** A Dissonant Echo punishing anyone who attacks
  him during Harmony was considered and **left out**. If someone attacks Ronin in
  Harmony they should have a **genuine opportunity** to exploit it. The
  consequence of attacking him does not need to be another subsystem — the
  attacker's decision is already strong enough:

  > *Do I interrupt Ronin now, or let him keep harvesting the Resonant Note?*

**Firm even though the implementation isn't:** Wa no Koe is powerful **because**
Ronin becomes vulnerable while using it. Any implementation that keeps the power
and softens the vulnerability has missed the ability.

---

### 2.5 🌀 Shukuchi Arpeggio — the fourth step

> ⭐ **ENTIRELY NEW, Alex 2026-09-04.** It does not exist in any form: no skill
> row, no constant, no resolver, no test. **`SHUKUCHI` appears nowhere in the
> codebase.** This section and `UPGRADE_SHOP_DESIGN.md` §3.1 are all there is.

**縮地** — *"shrinking the earth"*: the step that crosses ground without covering
it. **An arpeggio is one chord played as separate notes in sequence**, which is
exactly the movement — one distance, taken as three strikes of the foot.

**Decided:**

- **Jump 2 hexes, up to three times.** Each hop clears **two hexes** and lands on
  the far side of whatever was between.
- ⭐ **EACH HOP COSTS 1 AP** *(Alex, 2026-09-04)*. Three hops is three AP —
  the same bill as three ordinary steps, for six hexes of ground and no regard
  for what is in the way.
- ⭐ **Up to three, any direction** *(Alex, 2026-09-04)*. He may stop after one or
  two, and each hop chooses its own heading.
- ⭐ **He jumps OVER everything** *(Alex, 2026-09-04)* — bodies, hazards, walls,
  🐙 the slime trail. §2.5.2 #1.
- ⭐ **Every landing picks up a Lost Chord note** *(Alex, 2026-09-04)*. §2.5.2 #5.
- **Unlock 6 Db · 1 Db per use · 3-round cooldown.**

#### 2.5.0 ⚠️ THE AP RULE REPLACES "IT IS THE MOVEMENT TURN", AND IT IS A BETTER ABILITY

🎯 **This is the load-bearing change and it is not a detail.** The 2026-09-04
sketch said Shukuchi **was** the movement turn — you spend the turn, you get six
hexes. Alex's answer makes it a **movement MODE**: while it is up, a step buys
two hexes instead of one and ignores everything in between, and it is billed out
of the same `moveStepsLeft` pool as walking, Swinging and Bushido.

**Three questions §2.5.2 asked separately collapse into that one answer:**

| | was open | now |
|---|---|---|
| **#3** does it eat the whole movement turn on one hop? | undecided | **no** — one hop costs one AP |
| **#4** can he act after it? | undecided | **yes, if he can afford to.** No special rule; the pool says |
| **#2** must all three be taken, one direction? | load-bearing | **no and no** — up to three, each freely aimed |

⭐ **AND THE ABILITY NOW POLICES ITSELF**, which is what §2.5.2 #2 was worried
about. Three free hops in any direction was "a 6-hex reposition **plus** perfect
facing control" — a great deal on a burst character. Charged at 1 AP a hop it is
a **trade against everything else AP buys**: three hops is a Bushido he did not
throw, or three Swings, or the AP he needed to still be standing somewhere useful.
📌 The brake §2.5.2 reached for was a straight line. **The bill is a better brake
than a geometry rule**, because it scales with what else he wanted to do that
turn instead of being a flat restriction on all of them.

⚠️ **THE HOP RE-FACES HIM, exactly as walking does.** `applyMoveStep` already
turns a Spirit down its direction of travel and `applySpiritWarped` deliberately
does not; the hop follows *walking*, not the teleport. That is the other half of
the answer to "perfect facing control": he ends up facing where he last jumped,
and re-aiming costs a `face` like it does for anyone else. **A hop that let him
keep his old facing would hand him the free half of the Bushido setup.**

#### 2.5.0a ✅ SETTLED 2026-09-04 — PER ACTIVATION. Alex's call, and the build was right

**Is the 1 Db charged per USE or per HOP?** §2.5 says *"1 Db per use"* and was
written when a use was the whole movement turn. With hops billed individually
that sentence has two readings, and they are a factor of three apart.

✅ **BUILT AS PER-ACTIVATION**, which is what the sentence literally says: the
first hop pays the Db and starts the 3-round cooldown, and the second and third
hop of that same turn are free of Db and do not re-fire the clock. ⚠️ **The
cooldown therefore starts on the FIRST hop, not the last** — so a Ronin who hops
once and changes his mind has spent the whole ability.

✅ **AND ALEX CONFIRMED IT, 2026-09-04: PER ACTIVATION STAYS.** The AP bill is
the only brake, which is what §2.5's whole argument asked for. 📌 The alternative
remains one line (`SHUKUCHI_DB_PER_HOP`) if the bill ever proves too weak — but
it is now a **change to a decision**, not an open question, and nothing should be
designed as though the answer were still pending.

#### 2.5.0b ✅ SETTLED 2026-09-04 — the hop is TARGETED, one click each

The engine emits `shukuchi` **beside `move`**, which permits walking and hopping
interleaved inside one activation. Whether the *player* may was never asked.

✅ **Alex's call: per-hop targeting.** Pressing Shukuchi lights the ring-2
landings; each hop is its own click; ordinary walking needs no toggling off. The
rejected alternative was a **mode** that flipped the movement rail so every step
bought two hexes — fewer clicks, but it makes 1-hex walking awkward to reach
while the mode is up, and it hides the interleaving the engine already allows.

⚠️ **THE THREE HOPS ARE ONE CODE PATH, NOT THREE.** The only branch between them
is `hopIsActivation` — hop 1 pays the Db and starts the clock, hops 2 and 3 take
the same reducer and the same target set. The cost of this choice is three
*clicks*, not three implementations. 📌 Dial-in:
`.scratch/shukuchi-hop-preview.html`.

#### 2.5.0c ✅ THE DIAL-IN — Alex's settings, read off his screenshot 2026-09-04d

🎯 **THIS TABLE IS THE PORT SPEC.** The preview page runs in his browser and
**no state comes back**; the screenshot of the control panel IS the handoff, and a
fresh copy of the page loads with defaults and wipes it. So the numbers live here,
in the canonical doc, and not in `.scratch/` where the next clear-out finds them.

| lever | ✅ landed on | note |
|---|---|---|
| overlay colour | 🔵 **Ronin blue `#4488ff`** | ⚠️ **Collides with Psycho Bushido's targeting tint, which is the same blue.** Two of his four abilities light the board identically. Alex chose it knowing that — see the warning below |
| fill alpha | **40** (`#4488ff28`) | brighter than walking's `#ffffff18` |
| stroke alpha | **200** (`#4488ffc8`) | |
| stroke width | **2** | matches Bushido's and the blink's 2, not walking's 1.5 |
| landing marker | 🚫 **none** | no dot, no ring, no chevron — the tint and the arc carry it alone |
| hover ghost + facing arrow | ✅ **on** | |
| arc style | **parabolic** | |
| arc rise | **140** | |
| arc width | **4** | |
| ⭐ the cleared hex | **the arc is drawn OVER it** | 🎯 **this is the identity call.** Not a tint, not a cross — the arc passes above the hex art, so the picture says "he went over it" instead of annotating it |
| trail kept | **3 hops**, fade **55%** | the whole activation stays visible |
| Db pip on the rail | ✅ **on** | spent up front, on hop 1 |
| ⚠️ **"FREE" on hops 2–3** | ❌ **OFF** | see below |
| the 3-round clock on hop 1 | ✅ **on** | |
| stay in hop-target mode after a hop | ✅ **on** | so three hops is three clicks, not press-click-press-click-press-click |
| budget readout | **segmented bar** — three short bars, one greying per hop | ⚠️ Confirmed by Alex directly, 2026-09-04d. 📌 **The Db pip has no natural home beside a bar** the way it does beside pips, and the pip is switched ON — so the port has one thing left to place that the preview did not settle: where the gold Db mark sits relative to the bar.|

⚠️ **THE COLOUR COLLISION IS NOW A KNOWN, ACCEPTED COST, NOT AN OVERSIGHT.**
Bushido tints its targets `#4488ff33` and strokes them `#4488ffcc`; the hop now
lands within a few points of both. 📌 **If the board ever needs to show both at
once — a Ronin mid-Shukuchi hovering a Bushido — there is no colour left to tell
them apart, and the fix at that point is the MARKER, not the hue** (the marker
lever is set to *none*, so it is free). Recorded here so the day it bites, nobody
re-derives it.

⚠️ **AND THE "FREE" LABEL IS OFF, WHICH IS A DELIBERATE BET.** §2.5.0a's trap is
that the clock starts on **hop 1**, so hops 2 and 3 cost nothing and a player who
stops after one has spent the whole ability. The rail now shows a spent Db pip and
a running clock and says nothing about hops 2–3 being free. 🎯 **The bet is that
the budget readout alone teaches it** — three marks, one greying out per hop, with
no second Db pip appearing. 📌 **If playtesting shows people hop once and stop,
this is the first line to change, and it is one checkbox.**

#### 2.5.0d ✅ PORTED 2026-09-04e — and two things the port settled

🖥️ **THE OVERLAY IS IN THE CLIENT.** It lives in `src/ui/ShukuchiOverlay.jsx`
rather than inline in the monolith, and that is not tidiness: `CLAUDE.md` requires
a ported visual to be **verified by SSR against its preview**, and a geometry
buried in a 15,000-line component cannot be rendered on its own, so it cannot be
diffed. `npm run test:shukuchiui` renders the shipped component and diffs it
against a new DOM-free **OVERLAY REGION** in the preview page — 80 assertions,
including the arc path from every hex to every one of its ring-2 landings.

| the port had to settle | ✅ what it did |
|---|---|
| ⚠️ **where the gold Db pip sits beside the segmented bar** — §2.5.0c left this open, and the bar has no natural place for a pip the way the dot readout did | **The pip goes FIRST, before the bar.** Left to right it reads *"one Db buys three hops"*, which is the sentence the rail exists to teach. 📌 After the bar was the alternative and it is worse: a fourth mark in a row of three reads as a fourth hop |
| 🐛 **a bug in the preview's own budget readout, found while porting it** | The page derived *spent* from `MAX_HOPS − hopsLeft`, and a READY ability carries `hopsLeft 0` — so it drew a ready Shukuchi with **every mark greyed out**: an empty budget on an ability whose budget is untouched. 🎯 **It matters because §2.5.0c turned the FREE label OFF and bet that this readout alone teaches that hops 2–3 are free — and a bar that starts empty cannot carry that bet.** Both the port and the page now read FORWARD: three before you fire, counting down as you spend |

📌 **The preview page now opens on Alex's landing rather than on factory
defaults**, which removes the "a fresh copy wipes the dial-in" trap for this page
specifically. The levers there and `SHUKUCHI_LOOK` in the shipped file are diffed
against each other, so they cannot drift apart in silence.

#### 2.5.1 Why the kit needs it

🎯 **IT IS THE DELIVERY SYSTEM FOR THE RESPECCED KIT, AND THAT IS ITS REAL
JUSTIFICATION.** Two of the 2026-09-04 changes create a positioning problem the
old kit did not have:

- **Bushido now needs a rival 3–5 hexes directly in front.** A *window*, not a
  line — too close is as illegal as too far. Reaching a band that specific by
  ordinary walking is most of a turn.
- **The Shamisen now needs him at Swing range**, on a character §1 insists is
  *"punished for being close and paid for reach."*

**A 2-hex hop cleared three times lands on a specific hex at a specific distance**,
which is precisely the shape both problems ask for. 📌 And the three-hop structure
is not decoration: hopping **over** things is where the identity is — if it turns
out to be six hexes of ordinary walking with a Db cost, the ability has no reason
to exist and the answer is to give the hops their jump rule, not to cut it.

#### 2.5.2 ✅ Six things, and ALL SIX ARE NOW ANSWERED (Alex, 2026-09-04)

> 📌 Kept as the record of what had to be settled and what the answer was. The
> ruleset itself is §2.5 and §2.5.0 — **read those, not this.**

1. ✅ **DECIDED — YES, HE JUMPS OVER EVERYTHING.** *(Alex, 2026-09-04.)* Occupied
   hexes, hazards, walls, 🐙 Metalness's slime trail — the hops clear all of it.
   *"Shrinking the earth"* at full flavour.
   ⚠️ **AND THE KNOWN COST IS ACCEPTED, NOT OVERLOOKED:** this makes Shukuchi a
   hard counter to area denial, which is most of what 🧪 hazards and the slime
   trail are for. 🧊 §B10 applies — record it and build it; **if it proves too
   strong the brake is #2 (all three hops, one direction), not a hazard
   exception**, because a Shukuchi that stops at a slime tile is ordinary walking
   with a Db cost and §2.5.1 says that ability has no reason to exist.
   📌 The landing hex is a separate question from the crossing: this decides that
   he may pass OVER an occupied hex, not that he may land on one.
2. ⛔ **Must all three hops be taken, and in one direction?** Three free 2-hex hops
   in any direction is a 6-hex reposition **plus** perfect facing control, which
   on a burst character is a great deal more than it sounds. A straight line, or a
   one-turn-only rule, is the obvious brake if it needs one.
3. **Does it consume the whole movement turn even if he hops once?** (§2.5's
   "it IS the movement turn" implies yes.)
4. **Can he act after it?** If not, it is a repositioning turn and the kit's
   in-and-out never happens in one turn.
5. ✅ **DECIDED — YES, EVERY LANDING PICKS UP.** *(Alex, 2026-09-04.)* Three
   chances at 2-hex intervals, on a Spirit who already has a double-note roll and
   a 👤 decoy that collects for him. ⚠️ **Recorded as knowingly the strongest note
   economy on the roster** — 🧊 §B10 applies, and if it needs a brake the brake is
   the AP bill, which already makes each pickup cost a step.
   📌 It runs through the same `collectPickups` the ordinary `move` uses, so
   charge zones and event hexes behave exactly as they do when he walks on.
6. ✅ **MOOT — nothing in the game punishes movement.** Left as it was; this
   becomes a question again only if something ever should.

📌 **`UPGRADE_SHOP_DESIGN.md` §4 #1 already prices its upgrade** — *"the fourth
step"*, 6 Db, a 4th jump, use cost 1 → 2 Db. ✅ **The rules it was priced against
now exist** — and they change what a fourth step is worth. ⚠️ **A 4th hop costs a
4th AP**, so it is only reachable on a turn he has the pool for, and it competes
with the strike he was hopping toward. It is not "one more hex of value", it is
"spend your whole turn moving". **Re-cut that row against §2.5.0 before quoting
it.**

---

## 3. Explicitly NOT decided — the playtest bucket

⚠️ **Nothing below is a rule.** These are numbers and implementation choices to
settle once the board/combat flow is nailed down. Do not build from this section.

**Costs and cooldowns**

- ~~Exact Db costs for all four.~~ ✅ **Settled by the 2026-09-04 respec for four
  of the five — see §2's table. ⛔ The Shamisen's UNLOCK price is still blank**, and
  it is the one number Alex has not given. *(Wa no Koe's 12 Db is moot; it is cut.)*
- Exact cooldowns for all four.

**Psycho Bushido**

- Exact distance → damage/Drive scaling.

**Shadow Illusion**

- Exact Sustain drain rate.

**Cursed Shamisen** — ✅ **ALL SIX CLOSED 2026-08-25.** See §2.3.

- ~~Exact feeding requirements and escalation values.~~ → the phrase in order
  inside a committed melody line, any number of links per turn; a turn that adds
  none kills it (§2.3.2).
- ~~Exact number of escalation stages.~~ → **five — the links themselves**, and
  they move the **radius** (§2.3.4).
- ~~Exact Sustain loss at each stage.~~ → **1 note off `sustainStack` per round**,
  at every stage, never Vibe (§2.3.3).
- ~~Exact radius.~~ → **grows `ceil(links/2)`: 1 → 3 rings**, 7 → 37 hexes of 111
  (§2.3.4).
- ~~Exact exorcism rules.~~ → **click it from inside its rings, spend his tonic
  from your pool** (§2.3.6).

⏳ Three smaller ones opened in their place — the cooldown's meaning under
permanence, what happens when Ronin is KO'd, and the unobtainable-note case.
§2.3.7 has them.

**~~Wa no Koe / Harmony~~** — 🪦 **ALL MOOT. The ability is CUT (§2.4).** The six
questions below never need answering; they are kept only because §2.4.3 keeps the
design, and if Echoes are ever revived these are the holes to fill first.

- ~~Exact duration.~~
- ~~Exactly what constitutes an Echo-generating interaction.~~
- ~~Exactly how many Echoes reset each ability.~~
- ~~Whether taking damage interrupts Harmony.~~
- ~~Whether Ronin can move or act during Harmony.~~
- ~~Whether he can perform normal attacks, or rely on normal facing/guarding.~~

⭐ **AND FOUR NEW ONES OPENED 2026-09-04, which are the live list:**

**🎸 Cursed Shamisen — the siphon** *(§2.3.0)*

- ⛔ **Where do the N stolen points go?** One ability of Ronin's choosing, split,
  or all of them? **The most load-bearing unanswered question in the respec.**
- **What is the area, exactly?** "Similar to Swing" — the same cone
  (`swingCone`), or a ring? A cone means facing matters and the ability inherits
  a rule players already know.
- **Can he siphon the same rival's same ability on consecutive turns?**
- **What does a whiff cost?** Currently: everything. §2.3.0 flags the consolation
  dial to reach for first if that proves too harsh.

**🌀 Shukuchi Arpeggio** *(§2.5.2)* — six, and #1 (jumping over hazards) and #2
(three free directions) are the two that decide what the ability is.

**🗡️ Psycho Bushido** — whether the flat **+3** stands or the **+2/+3/+4** window
hybrid in §2.1.1 is taken instead.

**💰 And one that is not a game question:** `UPGRADE_SHOP_DESIGN.md` §4's four
Ronin upgrade streams are priced against the old kit, and **#4 is priced against
an ability that will not exist.** That doc needs the respec before it can be built
from.

---

## 4. ⚠️ DRIFT — what ships today vs. what this doc says

Measured 2026-08-22 against `rlsw-simulator-v3_8_1.jsx`,
`engine/systems/melodyCommit.js` and `data/skillTree.js` — **the client, not the
tests** (CLAUDE.md: a passing test is not evidence a rule is real).

> ⛔ **AFTER THE 2026-09-04 RESPEC, ALL FIVE ROWS DRIFT AND THE TABLE BELOW IS
> STALE BY DESIGN.** It measures the pre-respec design against the code. Both
> columns are still *true* — the right-hand one is simply no longer the intent.
> **§4.1 is the current statement; the table below is kept as the 2026-08-22
> reading.** ⚠️ Do not delete it and do not update it in place: it is the only
> record of what §2 meant when §7's foundation pass was built against it.

### 4.1 ⭐ THE CURRENT DRIFT — 2026-09-04

**Nothing in the respec is built. This is the whole gap.**

| ability | ships today | §2 intends | gap |
|---|---|---|---|
| 🌀 **Shukuchi Arpeggio** | ✅ **BUILT HEADLESS** — `shukuchi.js`, 5 constants, a skill row, a `legalActions` kind, a `transition` case and `test:shukuchi` (68 assertions) | leap 2 hexes, **1 AP each**, up to 3, any direction, over everything · 6 / 1 / CD 3 | ⛔ **the CLIENT only** — no button, no animation. Named in `BOT_CLIENT_GAPS` |
| 🗡️ **Psycho Bushido** | 6 / 1 / CD 2 · dash from facing · bonus `dist − 1` · spends all AP | 8 / 1 / CD 4 · 3 AP · rival **3–5 in front** · **+3 flat** · **−2 Drive stack** | numbers **and** the payout model |
| 👤 **Shadow Illusion** | 6 / 2 / CD 3 · lasts 3 · 1 Sustain/turn | 10 / 1 / CD 4 · lasts 2 · 1 Sustain/round | numbers only |
| 🎸 **Cursed Shamisen** | 8 / 2 / CD 3 · self-buff, 2× own cooldowns · purple glow · debt · total reset | **? / 1 / CD 4** · Swing-area · **steal a rival's cooldown**, blind pick, rival −1 / Ronin −N | 🚨 **a different ability** |
| 🪦 ~~**Wa no Koe**~~ | ✅ **GONE** — deleted from kernel, client, data, bot and 3 suites, 2026-09-04 | 🪦 **CUT** | ✅ **no gap — the only line in this table that is closed** |

🎯 **THE SHIPPED KIT IS INTERNALLY CONSISTENT AND THE DESIGNED KIT IS INTERNALLY
CONSISTENT. WHAT DOES NOT EXIST IS A HALFWAY HOUSE**, and building the numbers
without the verbs would produce one: a Bushido at CD 4 that still pays by distance
is strictly worse than today's, not different. 📌 **§8.1 orders this so that no
intermediate state is a downgrade** — that is what the order is FOR, not tidiness.

| | **Shipped today** | **This design** |
|---|---|---|
| **🌀 Psycho Bushido** | Iaijutsu **dash** in a straight line from facing into an auto-Swing. Bonus `= distToTarget − 1` as `tempDrive`. 6 Db unlock, **1 Db/use** ✅, 2-round CD ✅. Engine-modelled, `kind:'psychoBushido'`. | Farther = stronger ✅ **agrees in spirit.** Remaining gap: framed as a **waiting** threat on a sightline rather than a charge. |
| **👤 Shadow Illusion** | 6 Db unlock, **2 Db/use** ✅, **1 Sustain per turn while it stands** ✅, **3-round CD** ✅. Lasts 3 turns; **starves** if he cannot feed it. Picks up Lost Chord notes ✅. Pops if struck / if Ronin attacks / **if Ronin is attacked**. | ✅ **NO GAP.** The "❓ Keep or drop?" that stood here was answered in **§6.3 on the same day this table was written** — all three pop conditions stay — and was never struck through. 📌 A settled question left phrased as open is its own kind of drift: the next reader re-opens it. |
| **🎸 Cursed Shamisen** | ✅ **REWORKED 2026-08-26.** Self-buff: accelerates all other cooldowns at 2× for 3 rounds. Ronin glows purple (visible to all). Taking Vibe damage while glowing and unpaid resets ALL cooldowns. 1 Db/round optional debt payment protects but glow stays — the bluff. 2 Db activation, 3-round CD. | ✅ **NO GAP.** §2.3 matches the code. |
| 🪦 **~~Wa no Koe~~** | ✅ **NOTHING SHIPS.** Deleted 2026-09-04 — no kernel rule, no skill row, no bot path. The 12 Db mastery slot is **empty**. | 🪦 **CUT too.** The Resonant-note / Echoes / Harmony design is §2.4.3, kept as record. ⚠️ Do not build from it. |

🚨 **Wa no Koe is not a rework, it is a replacement.** Note what goes with it:

- 🪦 ~~`checkWaNoKoe` is a **pure function in the engine kernel**~~ — **it is not,
  any more.** Deleted 2026-09-04 along with its test block and its bot path.
- 🪦 ~~The kernel **deliberately reproduces a shipped bug**~~: the pre-commit
  `tempDrive` overwriting the Drive boost the same commit just earned. ✅ **MOOT
  — the bug, the pin in `melodyCommitCheck`, and the one-place fix all went with
  the rule.** 📌 **`BOT_STRATEGY_HANDOFF` §7 is waiting on a fix that no longer
  has anything to fix; it has been told (`GAME_BRIEF.md`).**
  ⚠️ **The read-order TRAP is not moot** — `rlsw-simulator-v3_8_1.jsx` ~7959 keeps
  the warning, because reading a render-scoped sheet and writing back over a
  fresh patch is a shape, not one ability's bug.
- Ronin's chord-tone pardon is separate and is **not** part of Wa no Koe. It stays
  whatever happens here.

**Also stale, minor:** ✅ **FIXED 2026-09-03 — and it was three, not one. §7c.**
The decoy comment (then line 8242) said the double *"cannot interact with board
elements (no note pickups…)"* while the code below it called `checkTokenPickup`.
The comment was the wrong one; the behaviour is intended. Two more of the same
class were found beside it and are recorded in §7c.

---

## 5. 🪦 Doc drift found while writing this

`CHARACTER_HANDOFF.md` described Cursed Shamisen as having **three stages** —
*1 Listening (2 rings, still, spares Ronin) → 2 Swelling (3 rings, still, spares
Ronin) → 3 Hunting (frozen at 3 rings, stalks 1 hex/turn, spares nobody)* — with
a whole paragraph justifying why the aura freezes when it starts chasing.

**None of that is in the code.** `SHAM_RINGS = 2` is a fixed constant, there is no
stage field, no growth, and no `spares Ronin` state — the minor-key gate is the
only thing deciding who it touches, and it has never spared him. The shipped
ability wanders from round 1.

That section has been rewritten. It is recorded here because it is the same class
of failure `test:arch` exists to prevent: **a doc that reads as current and is
not.** These design docs have no machine check, which is exactly why
`CHARACTER_HANDOFF.md`'s own advice — read them with suspicion — applies to this
file too.

### 🪦 And again, 2026-08-25 — the same file, the same ability

`CHARACTER_HANDOFF.md` still labelled Cursed Shamisen **"(8 Db unlock, 2 Db/use,
no cooldown)"**. It has had `CURSED_SHAMISEN_CD = 3` since 2026-08-22, shipped in
the same pass this file records in §7.1, and the **Shadow Illusion entry directly
above it was updated correctly** — so this was a miss, not a disagreement. Fixed
in the same pass as this section.

⚠️ **Note what it took to catch: reading the constant, not the doc.** Twice now
the stale line has been in the same entry for the same ability, and both times
the surrounding entries were fine. A doc that is 95% right is the dangerous
kind — there is nothing in the prose to tell you which 5% to distrust.

---

## 6. What this doc does NOT settle

1. ~~Whether innate passives are covered~~ ✅ **settled — out of scope, §0.4.**
2. ~~Whether Space is Displaced is exempt~~ ✅ **settled — no exemptions, only
   different rates. It took 1 round. §0.3.**
3. ~~Whether Shadow Illusion still pops when Ronin attacks or is attacked~~
   ✅ **settled — it does. All three conditions stay** (struck / Ronin attacks /
   Ronin is attacked), which keeps the double a pure positioning-and-deception
   tool: he cannot fight and hold it at once. 📌 That is a heavier constraint now
   than it was, because the double also drains Sustain every turn — he pays
   continuously for something a rival can delete by swinging at *him*. Watch it
   in playtest; if the double never survives long enough to matter, this is the
   first dial to turn, not the drain.
4. ⁉️ **Whether Blaster of Ra is an ability at all** — §0.5. The one thing the
   rule cannot price without a decision.
5. **Which Wa no Koe survives.** This doc assumes the new one replaces the shipped
   passive. If both are wanted, the 12 Db slot only holds one.
6. **The HUD.** Alex is designing a reduced HUD — fewer elements, bigger buttons,
   only pertinent information — **separately, and will upload it.** Do not
   pre-empt it. 📌 It is relevant here: cooldowns on thirteen abilities plus an
   Echo counter is a lot of new state wanting screen space, and the HUD pass is
   where that gets solved, not here.

---

## 7. ✅ WHAT SHIPPED, 2026-08-22

The foundation pass. **No ability changed what it DOES** — this pass changed only
what each one costs and how often it can be used, plus one cost swap.

### 7.1 🕒 The cooldown system

`engine/systems/cooldowns.js` (new). `ns.abilityCd` is `{ [skillId]: roundsLeft }`,
seeded in `economy.js`, ticked once per owner-turn in `turnFlow.js`, read through
`cooldownLeft` / `onCooldown` / `canFire`, and started by `firePatch`.

📌 **The shape is `cadenceCooldowns`'**, which already lived on the sheet, already
ticked in `turnFlow` and already survived the netcode — a plain JSON string→number
object that `setNoteStates` diffs and syncs for free. Copying a proven shape beat
inventing a second one that would then need proving separately.

⚠️ **`psychoBushidoCd` IS GONE, NOT DEPRECATED.** Anything still reading it reads
`undefined`, i.e. "no cooldown". If you find one, delete it.

⚠️ **ROUNDS, NOT SPIRIT-TURNS** — the opposite convention from board hazards
(Poison Slime, the Gravity Vortex), which count in spirit-turns seeded with the
living-Spirit count because their decay hook fires at the end of *every* Spirit's
turn. Both are right; they count different clocks. The module comment says so.

### 7.2 💿 Per-use Db, and one place that charges it

`firePatch(ns, skillId)` returns the patch — Db off the bar, cooldown started —
and **the client's resolvers and `transition.js`'s searcher both call it.** They
must, or the kernel plays a cheaper game than the player, which is the exact
failure `melodyCommit.js` warns about.

`legalActions.js` now gates Psycho Bushido on `canFire`, which asks affordability
and readiness as **one question**. Two separate checks is how an ability ends up
free — and here it matters twice over, because a generator that offers a dash the
resolver will refuse is a searcher planning turns it cannot play, and the refusal
would land *after* the dash has already committed the turn.

⚠️ **AND THE Db REFUSAL MOVED ABOVE THE WARP** in `resolvePsychoBushido`, next to
the other pre-dash refusals. (It sat beside a `rockGodActive` check until the Rock
God was archived on 2026-09-01.) Everything below that point commits the turn; a Ronin
told he cannot afford the strike *after* dashing has paid his whole AP pool for
nothing. Same class as the unmirrored refusal already documented there.

The tree's `desc` strings interpolate every number, so the text cannot drift.

### 7.3 👤 Shadow Illusion — the cost swap

1 Drive token at summon → **2 Db at summon plus 1 Sustain at the start of every
turn it stands**, and the double **collapses** when he has none left to give.

🎯 A token is a price you pay once and forget. A drain is a clock you can hear
running — and it makes the Ronin most fragile exactly while rivals cannot tell
which of the two bodies to hit, which is the trade the ability is built on.

📌 **Starvation is a real end, not a guard.** The shortfall does *not* bleed Vibe.
Sustain is what is being spent, so Sustain is what runs out; routing it into Vibe
would quietly turn a positioning ability into a self-damage ability. Summoning is
also refused with an empty guard, so the Db can't buy a body that never stands.
The report distinguishes **spent** from **starved** and the log prints a different
sentence for each — otherwise the drain is invisible and the trade is never
learned.

### 7.4 🎯 The counts

Baseline is §5.F⁸ of `SEQUENCING.md` (2026-08-21).

**engine ✓, legal 582, eval 154, transition 242, determinism 22, turnFlow 61 →
73, battleFlow 50 → 54, melody 159, slime 127, eleven 38, score 122, harness 1659
→ 1663, riffparity 127598, skillTree 159, trace 1831 → 1834, b0 55706+7870,
guitarMap 70970, neonNeck 253506, arch 8.** `check:bundle` **0 warnings.**

Four counts moved and **all four went up**:

- **battleFlow +4** — the Sunbeam cooldown, tested rather than assumed. See §7.5
  for why an unchanged count was the thing that prompted it.

- **turnFlow +12** — mine, deliberately. One assertion about `psychoBushidoCd`
  became three about the *mechanism*, and ten new ones cover the Sustain drain,
  starvation, and the fact that time is checked before the bill.
- **harness +4, trace +3** — mine, and **verified by bisection**: HEAD alone
  gives 1659/1831, HEAD plus this pass gives 1663/1834. Both suites assert over
  the decisions a seeded headless match actually produces (`for (const e of
  actions)`), not over a fixed list — so a Ronin who now sometimes cannot afford
  Bushido plays a different game and a few more decision points get asserted.

---

### 7.5 ✅ AND THE SAME DAY: INTERGALACTIC 0'S FOUR, PLUS A FORK CLOSED

Once §0.3 settled "no exemptions, only different rates", his kit followed
immediately — he is not on hold, and the numbers are all short because the zoner's
kit is about doing a small thing often.

**Displace 1 · Gravity 2 · Code Injection 2 · Sunbeam 2.**

☀️ **Sunbeam is the interesting one.** It is the only ability in the game that
fires **without the player choosing it** — it rides any connecting attack whenever
it can be afforded — so the cooldown is the whole of its restraint. It is also the
only one of the four that lives in the **kernel** (`battleFlow.js`), so it went
through `canFire` / `firePatch` there rather than in a client resolver.

⚠️ **AND IT NEEDED A TEST, BECAUSE NOTHING ELSE WOULD HAVE NOTICED IT BREAKING.**
`test:all` came back with every count identical after the Sunbeam change — which
sounds like good news and is actually the warning: no existing assertion touched
the new gate. `battleFlowCheck` now asserts a fired beam goes on cooldown, and
that a *recharging* beam does not fire, does not charge Db, and — the part that
would really hurt — **does not draw off the seeded stream**, since an rng draw
behind a closed gate desyncs every replay and freezes online clients. 50 → 54.

🪦 **A duplicate constant died on the way.** `SUNBEAM_DB_COST` and its three
siblings existed as literals in **both** `gameConstants.js` and `battleFlow.js`;
battleFlow's own header comment had said to fold them in "when the monolith's
copies are deleted", and nobody ever had. They are now re-exports of the
`gameConstants` values — same names for every importer, one number behind each.
⚠️ They are imported **and** re-exported, deliberately: `export … from` creates no
local binding, and this file reads all four. Getting that wrong bundles clean and
gives you a Sunbeam that silently never fires.

📌 **A side effect worth recording, on the Db hole.** `skillTree.js` notes that
killing the rig branch removed the biggest Db sink in the game and left Db piling
up against a tree that could not absorb it, with "grow the ability tree" as the
answer. Per-use costs are the *other* half of that answer and they need no new
rungs at all: seven abilities now draw on the same bar the tree does, every turn
they are used. It does **not** close the hole — six abilities are still free, and a
Spirit who buys nothing still banks everything — but a bench's Db numbers are no
longer measuring a pool with no outlet.

---

## 7b. ✅ WHAT SHIPPED, 2026-08-25 — THE SHAMISEN REWORK, ALL OF IT

§8 item 4's steps (a)–(f) all landed in one pass. **The ability described in §2.3
is the ability that now runs.** `check:bundle` **0 warnings**.

### 7b.1 🎸 What the code does now

| | |
|---|---|
| **Feeding** | `feedShamisenPhrase` in `music/cadence.js`, called from **two** places: the summon (off `ns.committedMelody`) and the melody-commit hook in `confirmNoteTrack` (off `report.melodyLine`). Links must appear **in order inside one track**; one commit may supply all five. |
| **Death** | `!complete && !fedThisRound` at the round tick. **One executioner, not two** — the commit hook deliberately does *not* kill, so a turn where Ronin never commits at all is judged by the same rule as one where he committed the wrong notes. |
| **Permanence** | `complete` flag. `roundsLeft` is **gone**; there is no lifespan field. |
| **Reach** | `shamisenRings(linksFed, SHAMISEN_RING_MAX)` — `ceil(links/2)`, 1 → 3. **Derived at every read**, never stored. |
| **Bite** | `frayFromSustain(stack, SHAMISEN_FRAY)`. Never Vibe. At the one-note floor it says so in the log rather than silently doing nothing. |
| **Exorcism** | `exorciseCursedShamisen(exorcistId, idx)` — two beats: click the instrument to arm, click a note to spend. Gated on range and on the pitch class being Ronin's tonic. |
| **Cooldown** | Set at summon by `firePatch` like every other ability's, **and re-set in `endCursedShamisen`** when the haunting ends. ⚠️ Both, deliberately — a haunting that can stand indefinitely outlives a summon-time cooldown, so the gap it was meant to create would be worth nothing. 🪦 An earlier draft of this row said the summon no longer charged it at all. It does. |

📌 **`calmCursedShamisen` is now a no-op that returns `false`**, kept rather than
deleted so the post-move call site and the hard-won `landedOn` comment above it
both stay put. The free walk-on it used to perform is the thing this rework
existed to remove.

### 7b.2 ⚠️ THE COUNTS DID NOT MOVE, AND THAT WAS THE FINDING

**Every one of the seventeen suites returned a byte-identical count** after a pass
that changed which resource the ability attacks, deleted its lifespan, gave it a
growing radius and added a verb the game did not have.

> 🎯 **That is not a pass, it is a hole — and it is the same hole §7.5 caught with
> Sunbeam, two paragraphs of this very document later.** An unchanged count after a
> real change can only mean **no assertion ever touched the ability.** The Shamisen
> had lived entirely in the client monolith since it was written, where nothing can
> reach it.

✅ **`engine/shamisenCheck.mjs` — `npm run test:shamisen`, 29 assertions**, wired
into `test:all` **in the same pass** (CLAUDE.md: a suite no script runs is not a
suite). To make it possible, the phrase logic was lifted OUT of the monolith into
`music/cadence.js` as four pure functions rather than written inline where it
would have been untestable by construction.

⚠️ **It covers the pure half only.** The tick, the wander, the bite, the summon
guard and the exorcism click are still client-side and still unreachable by any
harness. That is a real remaining gap and it is stated here rather than left to be
assumed away.

📌 **One assertion in it was written wrong and the failure taught something.**
The C-rooted spelling of the phrase, fed to an **A**-rooted Ronin, was asserted to
advance **zero** links. It advances **one** — pitch classes are shared, so a stray
note genuinely can open someone else's phrase; what it cannot do is carry it past
link 2. The assertion now pins the real behaviour and says why.

**Final counts:** engine ✓, legal 582, eval 154, transition 242, turnFlow 73,
determinism 22, battleFlow 54, melody 159, slime 127, eleven 38, score 122,
harness 1663, riffparity 127598, skillTree 159, **shamisen 29 (new)**, b0 ✓,
riff 70970, trace 1834, arch 8.

### 7b.3 📌 Decisions taken during the build that §2.3 did not cover

- **The summon is REFUSED when the committed track opens no link.** Same shape as
  Shadow Illusion's empty-guard refusal (§7.3): a Shamisen born on zero links is
  dead at the end of that very round, so summoning it would be a pure 2 Db
  donation with no moment of play in between. A **refusal now** is learnable; a
  silent death later is not.
- **Feeding is scored off `report.melodyLine`, mic bonus note included.** The
  kernel's own rule is that a note the player never placed still counts for Db,
  Performance, the ending and the AP grant. It counts here too — one rule, not a
  special case.
- **The board token's colour now means "bound".** Blue while the phrase is still
  being fed and could still snap, red once it is permanent. It is the only thing
  on the board that says *starving it is off the table now*. It used to mean
  "somebody is in a minor key".
- **The exorcism names the note outright** in its armed banner. Guessing a pitch
  class out of a foreign key is not the interesting decision; deciding whether it
  is worth standing in the aura to spend it is.

### 7b.4 🐛 THE POST-BUILD AUDIT — three bugs the green suites did not see

Alex asked *"is everything OK with it then?"* after every suite came back green.
Reading the diff back rather than answering from the test output found **three
real defects**, and all three were in exactly the places the tests cannot reach.
📌 **Recorded because the pattern is the lesson, not the bugs.**

1. 🐛 **THE BOARD TOKEN'S TOOLTIP AND READOUT STILL READ DELETED FIELDS.** The
   `<title>` printed `` `${sham.range}` `` and `` `${sham.roundsLeft}` `` — both
   removed in this very pass — so it rendered *"undefined rings, 0 rounds left"*
   and then advertised the **minor-key gate** and the **free walk-on**, neither of
   which exists any more. The stage readout under the token printed `💀 MINOR`.
   ⚠️ **This is `CHARACTER_HANDOFF.md`'s failure mode with a shorter feedback loop
   and a wider audience: stale text that reads as current, except a player sees it
   instead of an editor.** Now shows fed-links, the live radius, and how to end it.

2. 🐛 **THE HEX CLICK ATE CLICKS IT HAD NO RIGHT TO.** Arming the exorcism was
   checked *before* every attack branch and with no range gate, so:
   **(a)** a rival standing on the Shamisen's hex could not be Swung, Sonic'd,
   Smashed, Blastered or Bushido'd — the armed attack silently became an exorcism
   prompt; and **(b)** clicking a *distant* Shamisen in move mode was refused with
   "too far", which quietly made that one hex **unwalkable**. Now gated twice: only
   when no targeting mode is armed, and only when the clicker is already inside the
   rings — out of range it falls through to the ordinary move path.

3. 🐛 **I DOCUMENTED THE COOLDOWN WRONG, IN FIVE FILES.** The comment, this
   section's table, `gameConstants.js`, the skill tree text and the button tooltip
   all said the cooldown was *"charged when the haunting ENDS, not at summon"*.
   **`firePatch` sets it at summon like every other ability's** — I never removed
   that and should not have. The behaviour is right (summon-time charge, plus a
   re-set on the end, because a haunting that stands indefinitely outlives its own
   cooldown); the description was a confident, repeated falsehood. All five now say
   what the code does.

> 🎯 **THE COMMON THREAD, AND IT IS THE POINT.** Every one of the three lived in
> the client monolith — board render, click routing, and prose. `test:shamisen`
> covers the *phrase logic*, which is precisely the half that was already correct.
> A green suite said nothing about the three-quarters of this ability a player
> actually touches, and §7b.2 already said so in the abstract. This is what that
> warning looks like when it comes true, ten minutes later.

⏳ **STILL UNVERIFIED BY ANYTHING BUT READING:** the round tick, the wander, the
fray, the starvation path, the summon refusal, and the two-click exorcism have
never been *executed*. `check:bundle` proves they parse. Nothing proves they run.
**The next person to touch this should play a match before trusting it.**

---

## 7c. ✅ WHAT SHIPPED, 2026-09-03 — THE DRIFT SWEEP

No mechanic changed. **Four statements about the Ronin that the code contradicted
were corrected** — one code comment, two player-facing strings, one doc line.

### 7c.1 The four

| # | Where | Said | Actually |
|---|---|---|---|
| 1 | `rlsw-simulator-v3_8_1.jsx` ~8043 (comment) | the decoy *"cannot interact with board elements (no note pickups, no amp placement, no hazard triggers)"* | It picks up **notes**, deliberately, ~100 lines below in the same function. Charge zones / event hexes / hazards are the real exclusions. |
| 2 | `data/skillTree.js` — 🎸 `cursed_shamisen` `desc` | *"Bushido, Shadow Illusion **and Wa no Koe** all come back in half the time."* | **Wa no Koe has no cooldown.** It is not in `ABILITY_CD`, and `tickShamisen` only walks keys already in `abilityCd`. The player was sold a third beneficiary that cannot exist. |
| 3 | `data/skillTree.js` — 🎵 `wa_no_koe` `desc` **and** the unlock log at jsx ~4481 | *"The Ronin already starts holding CHORD TONE PARDON … the amplifier on an instinct he was born with."* | **The pardon ladder went universal and free on 2026-09-02.** The text sells as his exclusive what is now the roster's floor. |
| 4 | `CHARACTER_HANDOFF.md` — Cursed Shamisen entry | same claim as #2 | same as #2. |

### 7c.2 🎯 THE PATTERN, AND IT IS THE FINDING

**Every one of the four is downstream of a change that was itself made correctly.**
The 2026-08-26 Shamisen rework, the note-pickup grant, the 2026-09-02 pardon
change — each landed with the engine right, a comment explaining *why* at the site
of the change, and a suite green. **What none of them did was walk the strings.**

⚠️ **And #3 is the one with teeth, because it is not just stale — it is a promise.**
`economy.js` and `evaluate.js` both carry careful notes saying the Ronin's head
start is gone and that whether he gets something back is a CHARACTER question. The
skill description meanwhile still tells the player he was born special. **The
engine knows and the game does not say so**, which is the same failure as a stale
doc with a player on the receiving end of it.

📌 **`test:arch` cannot catch this class.** It checks that modules and exports
exist, not that a `desc` string is true. Nothing does — these four were found by
reading the code beside the text, which is the only instrument there is.

### 7c.3 What the strings say now

- 🎸 Shamisen: **"Bushido and Shadow Illusion both come back in half the time."**
  A comment above the entry in `skillTree.js` says why Wa no Koe is absent and to
  **put it back the day §2.4's replacement gives it a cooldown.**
- 🎵 Wa no Koe: **"Every Spirit's notes are pardoned inside their own chord, so
  this is not a pardon stacked on a pardon — it is the only thing in the game that
  pays you EXTRA for playing where your chord already lives."** The unlock log
  matches: *"only the Ronin gets PAID for it."*
  🎯 **That is an honest reading of the shipped ability and it costs him nothing** —
  but it is not compensation. §7c.4.
- 👤 The decoy comment now records what it used to claim and why it was wrong,
  per the house style, rather than being quietly overwritten.

### 7c.4 ⚠️ WHAT THIS PASS DID NOT DO

**The Ronin is still weaker relative to the field and this changed none of it.**
Correcting the text that oversold his head start makes the loss *legible*; it does
not answer it. That remains a CHARACTER decision in `CHARACTER_HANDOFF.md`, open,
untouched, and now slightly more visible for having honest text over it.

### 7c.5 ✅ Verification

`check:bundle` **zero warnings**. No engine or client behaviour was modified — the
only non-comment edits are three display strings — so suite counts are expected to
be unmoved; see the session report for the `test:all` figures.

---

## 8. If the rest gets built — rough order

Not a commitment, just the dependency order that falls out of the above.

1. ~~The cooldown system~~ ✅ **done** — §7.1.
2. ~~Per-use Db costs (Ronin)~~ ✅ **done** — §7.2.
3. ~~Shadow Illusion cost swap~~ ✅ **done** — §7.3.
4. ~~Cursed Shamisen rework~~ ✅ **BUILT 2026-08-25 — §7b.** All six steps
   (a)–(f) landed in one pass, plus the suite that should have existed already.

5. ~~**Wa no Koe replacement — last, and biggest.**~~ 🪦 **MOOT — the ability is
   CUT (§2.4).** The Echoes go with it. What is left of this line is the
   *deletion*, which is now item (a) below.

---

### 8.1 ⭐ THE ORDER AFTER THE 2026-09-04 RESPEC

Dependency order, cheapest-and-safest first. **Nothing here is built.**

| | step | why here | blocked by |
|---|---|---|---|
| ~~**a**~~ | ✅ **DONE 2026-09-04 — Wa no Koe deleted.** Kernel, client, data, bot and three suites; `melodyCommitCheck` §13 is now the revival guard. | Every other step touches files it lived in. | — |
| ~~**b**~~ | ✅ **DONE HEADLESS 2026-09-04 — Shukuchi built.** All six of §2.5.2 answered; the AP rule (§2.5.0) replaced "it IS the movement turn". ⛔ **The client half is deliberately NOT done** — the hop is a visual and `CLAUDE.md` sends a visual to a `.scratch/` preview first. | The only genuinely self-contained item. | — |
| **c** | 🗡️ **Respec Bushido**, 👤 **respec Shadow Illusion** ⬅️ **NEXT, AND UNBLOCKED 2026-09-04e** | Pure number edits on shipped abilities — a constants change, the 3–5 window, and the **+2 / +3 / +4** ladder across it. | ✅ nothing — Alex settled the payout (§2.1.1) |
| **b2** | 🖥️ **Shukuchi's client half** | A `.scratch/` preview of the hop and its target overlay, then the port. ⚠️ Until it lands the searcher plans hops the player cannot take. | — (parallel to c) |
| **d** | 🎸 **Build the siphon** | New verb, new targeting, reads another Spirit's sheet — the first ability in the game to do that. | ⛔ **the Metalness rework**, and §2.3.0's "where do the N points go?" |
| **e** | 💰 **Re-cut the shop** | `UPGRADE_SHOP_DESIGN.md` §3.1 and §4 are priced against the pre-respec kit and one ability that no longer exists. | a–d |

⛔ **(d) IS THE ONE THAT CANNOT BE PULLED FORWARD.** Everything else is a number
or a self-contained build. The siphon needs a rival with cooldowns to steal, and
one of the three rivals has none — so **`METALNESS_REWORK_DESIGN.md` moved onto
the Ronin's critical path**, and it is on hold. If the Shamisen is wanted sooner
than Metalness, that is the trade to make consciously.

🎯 **AND ONE THING BELONGED BEFORE ALL FIVE:** §2.4.2's ledger. ✅ **It is now
written up in `CHARACTER_HANDOFF.md` under "THE RONIN LEDGER"** — four
subtractions, dated, with the question stated in one line. ⛔ **It is filed, not
answered**, and the answer is Alex's, not a session's.

📌 **The nine remaining abilities are now a data edit**, not a build: add rows to
`ABILITY_CD` / `ABILITY_DB_COST` in `cooldowns.js` and call `firePatch` in each
resolver. ⚠️ **But make the exemption calls first** (§6.1, §6.2) — Space is
Displaced advertises "no cooldown" in its own player-facing text, and Metalness is
on hold pending a redesign, so cooling abilities that may not survive it is work
thrown away.
