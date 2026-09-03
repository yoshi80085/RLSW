# 💰 THE UPGRADE SHOP — what Db is FOR

> **Design only. Nothing is built.** Fills `PROGRESSION_REWRITE_DESIGN.md` §5
> (*"the Db sink: upgrade streams on the abilities you already have"*), which that
> doc marks ⛔ **NOT BUILT — AND THE MOST URGENT ITEM IN THIS DOC**, and which
> `MELODY_IDENTITY_DESIGN.md` §5.5 names a **prerequisite** for the melody arm's
> Db-vs-fans trade. Written 2026-09-02i out of a design conversation with Alex.
>
> ⚠️ **SCOPE IS TWO SPIRITS.** 🗡️ Shredding Ronin and 🌀 Intergalactic 0.
> 👹 Metalness Monster is excluded on Alex's instruction — he needs rewiring first
> (`METALNESS_REWORK_DESIGN.md`). 🎀 Glamarchy is being cut (§5-glow.F).

---

## 0. The one-line version

Db currently buys **one thing per ability, once**. The shop makes it buy **depth**
— and every step is a **TRADE, not an improvement**, because the measured buying
behaviour says a strictly-better step at a reachable price would be bought
automatically, which is the exact fault the Theory branch was deleted for.

---

## 1. 📏 MEASURED FIRST — the budget, and what it says about the shop

`.scratch/dbbudget.mjs`, 200 seats over 100 matches, searcher both sides.

⚠️ **READ THE MEDIANS, NOT THE MEANS.** The 4–11% of matches that hit the harness
turn ceiling (§5-race.D, a bot artifact) drag the mean earnings to 67.73 against a
median of 19. Everything below quotes p50.

| per seat, per match | p50 | p90 | max |
|---|---:|---:|---:|
| **Db EARNED all match** (`totalDB`) | **19** | 45 | 643 |
| spent on the TREE | 12 | 32 | 44 |
| spent on ability USES | 4 | 12 | 596 |
| left UNSPENT at the end | 3 | 7 | 13 |
| skills bought | 2 | 4 | 5 |

### ⛔ 1.1 THE FINDING — the tree is bought in PRICE ORDER, not value order

| skill | Db | share of seats that bought it |
|---|---:|---:|
| `psycho_bushido` | 6 | **98.0%** |
| `gravity_control` | 6 | **93.0%** |
| `shadow_illusion` | 6 | **78.0%** |
| `code_injection` | 6 | **70.0%** |
| `cursed_shamisen` | 8 | 33.0% |
| `displace` | 8 | 27.0% |
| `blaster_of_ra` | 10 | 17.0% |
| `wa_no_koe` | 12 | 11.0% |
| `sunbeam` | 14 | **10.0%** |

🎯 **That is a near-perfect inverse ranking by price, with no reference to what
the ability does.** Every 6 Db skill is bought 70–98% of the time; every skill
above 10 Db is bought by roughly one seat in ten. Against a 19 Db median income
the shop is not a menu, it is a queue: **you buy what you can afford, in the order
you can afford it.**

⚠️ **THIS IS `GAME_BRIEF.md` §16 PROBLEM #1 WEARING A DIFFERENT HAT.** The Theory
branch was deleted because *"buying it is close to automatic"*. The arsenals have
the same disease and nobody had measured it, because until the tree was extracted
from the monolith no bench could see a purchase at all.

### 🎯 1.2 So the shop has TWO jobs, and the second one is the real one

1. **Absorb Db** — the stated job. Easy; almost any sink does it.
2. ⭐ **Give Db somewhere to go that is not "the next cheapest thing".** A seat
   with 19 Db and a price-sorted menu makes no decision. A seat choosing between
   *three abilities* and *two abilities, one of them deepened* is making the first
   real progression choice in the game.

📌 **Which is also why the shop cannot be cheap.** An upgrade priced below the
abilities it sits beside gets bought before them — and 🌀 Blaster of Ra (17%) and
☀️ Sunbeam (10%) barely get seen as it is. **A cheap upgrade stream would starve
the expensive half of the arsenals it is supposed to enrich.**

---

## 2. 🎯 THE THREE RULES

**R1. An upgrade is a TRADE, never a strict improvement.** Every step gives
something and takes something. Alex's own example is the model — 🎸 Cursed
Shamisen cutting **2** turns of cooldown instead of 1 *while its Db cost rises to
2*. A bare "−1 cooldown" is an automatic purchase and re-creates §16 #1 in
miniature.

**R2. An upgrade costs AT LEAST what its base ability cost.** From §1.1: price
IS the purchase order. Pricing depth at or above breadth is what makes
breadth-vs-depth a choice instead of a sequence.

**R3. Go shallow — ONE step per ability.** `PROGRESSION_REWRITE_DESIGN.md` §5's
own instruction, and §1's budget agrees: a seat earning 19 Db will see two or
three purchases all match. A second step is balance surface nobody reaches.

📌 **And the doc's existing test still applies:** each stream must sell **one
thing nobody else can grant**.

---

## 3. ⚠️ BEFORE THE SHOP — the base kit Alex specified is NOT what ships

The abilities Alex described in this conversation differ from the shipped ones in
ways the shop sits directly on top of. **The shop cannot be priced against numbers
that are about to change**, so this table is a decision, not a footnote.

### 3.1 🗡️ Shredding Ronin

| ability | SHIPPED today | ALEX'S SPEC | delta |
|---|---|---|---|
| 🌀 **Shukuchi Arpeggio** | ⛔ **does not exist** | jump 2 hexes ×3 as the movement turn · unlock **6** · use **1** · CD **3** | ⭐ entirely new |
| 🗡️ Psycho Bushido | unlock 6 · use 1 · CD 2 · min 2 AP · charge from facing, **leftover AP becomes bonus Drive**, spends all remaining AP | unlock **8** · use 1 · CD **4** · **3 AP** · rival **3–5 directly in front** · movement consumed · **+3 Drive fixed** · **spends 2 Drive stack** | price ↑, CD ↑, and the **AP→Drive conversion is replaced by a flat bonus + a stack cost** |
| 👤 Shadow Illusion | unlock 6 · use 2 · CD 3 · lasts **3** · 1 Sustain/turn | unlock **10** · use **1** + 1 Sustain per round · lasts **2** · CD **4** | price ↑↑, shorter, cheaper to fire |
| 🎸 Cursed Shamisen | unlock 8 · use 2 · CD 3 · other CDs tick **2× speed** · glows **purple** · Vibe damage unpaid → **ALL** CDs reset · 1 Db/round protection | unlock **?** · use **1** · CD **4** · all CDs **−1 turn** · glows **his own colour** · Vibe loss → **the ability soonest off cooldown restarts** | ⚠️ **mechanic change**: a multiplier becomes a subtraction, a total reset becomes a single-ability reset, and the **paid protection is not mentioned** |
| 🎵 Wa no Koe | unlock 12 · +1 Drive/Sustain for 3 rounds on stack alignment | 🪦 **CUT** | see §3.3 |

### 3.2 🌀 Intergalactic 0 — unchanged

Alex specified no changes, so the shop is priced against what ships: 🌀 Blaster of
Ra (10), 🌌 Space is Displaced (8, use 1, CD 1), 🕳️ Gravity Control (6, use 1,
CD 2), 💻 Code Injection (6, use 1, CD 2), ☀️ Sunbeam (14, use 2/hit, CD 2).

### 3.3 ⛔ Three things §3 forces, and none of them are shop questions

- 🪦 **CUTTING WA NO KOE IS A DELETION PASS, NOT A LINE.** It has a real
  footprint: `checkWaNoKoe` + `waNoKoeBuffs` in `melodyCommit.js`, its own seat in
  `economy.js`'s initial note state, the Ronin's `skillOrder` in `bot.js`, **5
  client references**, and live assertions in `melodyCommitCheck`, `shamisenCheck`
  and `harnessCheck`. ⚠️ Delete it properly or it becomes the next `combat.js`
  dead-function scar (§6 of the rewrite).
- ⚠️ **AND IT MAKES THE RONIN WEAKER AGAIN.** §5-seats.C already flagged that
  losing the shared Theory ladder cost him his head start, and explicitly noted
  *"Wa no Koe still stacks on top exactly as designed"* as the thing he had left.
  Shukuchi (6 Db) arrives as Wa no Koe (12 Db) leaves. 📌 That is a
  `CHARACTER_HANDOFF.md` question and it should be answered there, not here.
- ⚠️ **PSYCHO BUSHIDO'S REWRITE DELETES ITS BEST IDEA.** The shipped
  "whatever AP you did not need becomes bonus Drive" is what makes a charge from
  across the board better than a charge from next door — it prices the run-up.
  A flat +3 removes that gradient entirely. It may still be the right call (it is
  far easier to read, and "the ultimate beginner" is the stated audience, §5-glow.A)
  but it should be a decision rather than a side effect. 📌 The `2 Drive stack
  spent` is new and is a real cost — it eats the thing that opens stack seats.

---

## 4. 🗡️ THE RONIN'S STREAMS

One step each, priced at R2, each a trade per R1.

| # | upgrade | Db | what it gives | ⚠️ what it takes |
|---|---|---:|---|---|
| 1 | 🌀 **Shukuchi · "the fourth step"** | 6 | a **4th** jump on the movement turn | use cost **1 → 2 Db** |
| 2 | 🗡️ **Bushido · "Iai — the drawn cut"** | 8 | AP **3 → 2** (Alex's own "less AP" lever) | Drive bonus **+3 → +2** |
| 3 | 👤 **Shadow Illusion · "the long shadow"** | 10 | lasts **2 → 3** turns | Sustain drain **1 → 2 per round** |
| 4 | 🎸 **Cursed Shamisen · "the deeper debt"** | 8 | cooldown relief **−1 → −2 turns** | use cost **1 → 2 Db**, and on Vibe loss the **two** soonest abilities restart, not one |

🎯 **#3 is the one to keep whatever else changes.** It does not make the illusion
bigger, it makes it *more itself* — the ability's stated identity is already *"IT
FEEDS ON YOU… you are at your most fragile exactly while nobody can tell which
body to hit."* Doubling the drain to buy a third turn sharpens that sentence
instead of diluting it. **That is the shape every upgrade in the game should aim
for.**

📌 **#4 is Alex's own example, with the backfire scaled to match.** He proposed
CD −2 at 2 Db; the extra restart is added because otherwise the *bluff* — the
whole point of the ability — gets cheaper as the power goes up.

---

## 5. 🌀 INTERGALACTIC 0'S STREAMS

| # | upgrade | Db | what it gives | ⚠️ what it takes |
|---|---|---:|---|---|
| 1 | 🌌 **Displace · "the wider fold"** | 8 | landing ring **2–3 → 2–4** | cooldown **1 → 2** |
| 2 | 🕳️ **Gravity · "event horizon"** | 6 | pull **1 → 2 hexes** | ⭐ **the vortex stops sparing him** — he is dragged too, if he is in range |
| 3 | 💻 **Code Injection · "recursive"** | 6 | the reroll covers the first **two** rivals, not one | it now shows a **tell**, so the bet is public |
| 4 | ☀️ **Sunbeam · "corona"** | 14 | the burn **always** sears in for a 2nd turn (linger 50% → 100%) | **2 → 3 Db** per connecting attack |
| 5 | 🌀 **Blaster of Ra · "Ra's judgement"** | 10 | no longer leaves you **Exposed** | costs **2 Drive stack** |

🎯 **#2 is the strongest single idea in this document.** The shipped description
ends *"Gravity is his to command: it never touches him."* The upgrade **buys away
his own immunity**. It is a genuine trade, it is unmistakably his, and nothing
else in the game can grant it — the doc's own test, passed on flavour rather than
on arithmetic.

⚠️ **#3 removes the ability's identity and is the weakest.** Code Injection's
whole design is *"no aura, no tell… nobody can see that you've committed. That's
the bet."* Selling the tell away is coherent as a trade but it turns a bluff into
a buff. 📌 **Offered for completeness; recommend cutting it** unless a second
lever for that ability is wanted.

---

## 6. 🛠️ IMPLEMENTATION — it is DATA, not an engine change

⭐ **`prereq` IS ALREADY BUILT, FULLY GATED, AND NOTHING IN THE TREE USES IT.**
`skillEligibility` (`engine/systems/skills.js`) accepts `prereq` as a string or an
array, returns `reason: 'prereq'` with a `missing` list, and both the bot (`.ok`)
and the human overlay (`.reason`) already consume it. So an upgrade is **one more
row in `SKILL_TREE`**:

```js
{ id:'shadow_illusion_2', label:'The Long Shadow', icon:'👤', dbCost:10,
  prereq:'shadow_illusion', gated:false, desc:'…' }
```

No new state. No new action family. No migration. `unlockedSkills` already carries
it, `botPickSkillTarget` already ranks it, the client overlay already renders it.

### ⚠️ 6.1 The ONE thing that is not free

**Every number an upgrade changes must be read through a resolver, not a
constant.** `PSYCHO_BUSHIDO_CD` is imported directly in several places today; once
an upgrade can change it, a direct read is a second source of truth.

📌 **The precedent is `applyUnlockClaim`** — §5-seats shipped it as *"same function
in `transition.js` and the client, so the bench and the game cannot disagree about
which finds are upgrades"*. Same shape here:

```js
// music/… or engine/systems/abilities.js
export function abilityParams(ns, abilityId) → { dbCost, cd, ap, … }
```

One function, read by the engine, the client and the bot. ⚠️ **The failure this
prevents is the quiet one**: the client showing a 3-turn cooldown while the engine
ticks 4, which no test would catch because both would be internally consistent.

### 6.2 Order of work

1. **Settle §3's base-kit changes** — the shop cannot be priced against numbers in
   flight. This is the gate on everything else here.
2. `abilityParams` resolver + move the direct constant reads through it. Headless.
3. The tree rows. Data only.
4. **`skillTreeCheck` §7 and `selftest`'s `botPickSkillTarget` are pinned ALARMS
   and are EXPECTED TO FAIL** (§5-seats.C). The fix is to assert what can now be
   bought — not to delete them.
5. Re-run `.scratch/dbbudget.mjs`. ⭐ **The success criterion is that the price
   ranking in §1.1 stops predicting the purchase ranking.** If depth is bought in
   price order too, the shop has added items and not choices.
6. ⛔ **THE SHOP UI IS A SEPARATE, PREVIEW-FIRST JOB.** `CLAUDE.md`'s standing
   rule. The rules land headless exactly as `WIN_CONDITIONS_DESIGN.md` did
   (*"BUILT HEADLESS — no menu, no HUD"*).

---

## 7. ⚠️ WHAT THIS DOES NOT SETTLE

- **🎸 Cursed Shamisen's unlock price.** Alex gave use cost and cooldown but not
  an unlock cost. Shipped is 8; §4 assumes 8.
- **Whether the Shamisen's paid protection survives.** The shipped ability lets
  the Ronin pay 1 Db a round to dodge the backfire, and that payment *is* the
  bluff rivals cannot read. Alex's spec does not mention it. Dropping it makes the
  ability simpler and strictly more punishing.
- **Whether Psycho Bushido keeps its AP→Drive gradient** (§3.3).
- **Whether the Ronin needs compensation for Wa no Koe** (§3.3) — a
  `CHARACTER_HANDOFF.md` question.
- **Whether ability USE costs should be upgradeable at all.** §4/§5 move them as
  the *cost* half of trades; nothing here proposes an upgrade that only makes a
  use cheaper, because by R1 that is not a trade.
- ⛔ **Nothing here is benched.** Every price is reasoned from §1's budget, not
  measured. §6.2 step 5 is where that changes.
