# RIFF RAT DESIGN — 🐀 anarchy, and the underground

> **For AI editors + Alex.** A new Spirit — punk/grunge/alt, a literal rat —
> intended to **replace `Glamarchy`**. Written 2026-08-15 out of a design
> conversation. Companion to `CHARACTER_HANDOFF.md` (the kits),
> `THEORY_ROUTES_DESIGN.md` (his theory route), `BOT_STRATEGY_HANDOFF.md` §4.
>
> ⚠️ **NOTHING HERE IS IMPLEMENTED**, and this Spirit is **less resolved than
> Metalness** — this is a direction with several strong hooks, not a finished
> kit. Claims about *current* behaviour are cited and were read out of source.

---

## 0. Why replacing Glamarchy costs nothing

`Glamarchy` is `IN_DEVELOPMENT`: a stat block (`5 / 8 / 5 / 4` — Drive 5,
Sustain 8, Speed 5, Vibe 4) with **no innate and no arsenal**.
`BOT_STRATEGY_HANDOFF.md` §0.5 puts her explicitly out of scope. There is nothing
to migrate.

Alex's naming note: "Glam" already collides with an existing character (Glam
Reaper), which is the trigger for the swap.

**Open: does Riff Rat inherit her 5/8/5/4?** 8 Sustain is the highest in the game
and reads as a tank — the opposite of a fast, fragile, underhand rat. Probably
not. See §5.

---

## 1. The character

Punk / grunge / alt-rock, as a **literal rat**. He **bites**. He fights
underhand — no honour, backstabs, exploits the underground, uses his own fans to
do deplorable things to rivals. Anarchy embodied. He should **destroy his own
instrument** in a Smash.

**The missing archetype.** Ronin is the fragile virtuoso (quality), Intergalactic
0 the controller (denial), Metalness the bruiser (attrition). The roster has no
**opportunist/thief**, and that is the lane.

---

## 2. Two hooks the codebase is already holding for him

These are the strongest ideas in the doc because the machinery exists and is
currently dead.

### 2a. ⚠️ `assignments` — the sabotage cost is ALREADY WIRED
`crowdMultiplier(diehards, casuals, assigned)` subtracts `assigned` from active
diehards, and `grantFame` reads `(ns.assignments ?? []).length` on **every
payout**. The crew system was purged (`AMP_DECK_DESIGN.md` §6) but that parameter
survived and is **permanently 0**.

So "send a diehard backstage to take a rival's amp offline" already has its whole
risk/reward loop built: the fan leaves the crowd, your Fame multiplier drops for
the duration, and you get it back when they return.

**This is the cheapest big mechanic available anywhere in the project.** Riff Rat
reviving `assignments` — scoped to one Spirit rather than as a general system —
makes his diehards *materially* different from everyone else's rather than
cosmetically.

Sabotage targets worth considering: take an amp offline (which per §3.1 knocks a
rival's Sonic **offline entirely** and drops them to a d4 defence — devastating,
and free of new systems), halve a refill, steal from the unsure pool.

### 2b. 🎼 The cadence system IS his theory route
`CADENCE_OBJECTIVES` includes "THE FULL RESOLVE — end on C, then F, then G, then
C." **That is I–IV–V–I. That is the three-chord punk progression, already
implemented**, running on `finalsTrail` across turns, with cooldowns.

Nobody owns it. See `THEORY_ROUTES_DESIGN.md` §2d for the three-rung sketch:
**Three Chords** (cadences resolve faster / pay harder) · **Two Minutes Flat**
(paid for *brevity*, inverting `scoreTrackDB`'s length ladder) · **Three Chords
and the Truth** (the discord inversion below).

---

## 3. The kit

### 3a. 🕳️ The Underground — he earns in the back ring
**The strongest single idea for making him PLAY differently rather than just feel
different.**

`FAN_GAIN_BY_RING` pays main 2 / pit 1 / floor 1 / **back 0**, and after
`FAN_BORED_AFTER` 3 turns in the outer ring `FAN_DECAY` sheds 2 casuals a turn.
§3.6 makes centre-stage a compounding lead that every Spirit fights over.

**Invert it for him.** Punk plays the basement, not the mainstage. It reuses
`hexRingFromCenter` untouched, and it means one Spirit is playing a completely
different board — right now all three Spirits want the same hexes.

### 3b. 🎸 Dirty pays — the discord inversion
`gainFans` only pays out when the track was `clean` (`allInScale`). **Flip it.**
He wins the crowd on a dirty track and bores them with a clean one.

⚠️ **Do NOT give him a discord-penalty discount.** Intergalactic 0 already owns
"wrong notes are excused" (Freestyle — first out-of-scale note per turn is
pardoned and pays Flair). Punk is not *excused* wrong notes; wrong is **the
point**. Inverting the fan gate is a different mechanic, not a bigger version of
Zero's.

Mechanically it is one boolean on an existing pipeline, and it means his Db and
his fans pull in **opposite directions all game** — a real standing decision
rather than a discount.

### 3c. 👁️ Stay or Go — hidden, at a price
Can go hidden; sacrifices some Sustain; **movement halved** while used. If he
gets bumped into, potentially devastating.

**Differentiation is the whole problem here** — this is the third hidden-info
ability in the roster:
- Ronin's **Shadow Illusion** hides a *fake body* (a decoy with its own movement
  pool).
- Zero's **Code Injection** hides *dice* (a re-roll the rival cannot see coming).
- Riff Rat should hide a **third kind of thing.** Hiding his *position* is the
  obvious read and is closest to Ronin's lane. Consider instead: hide **which
  trap is real**, or **which fan is sabotaging whom** — information warfare
  rather than concealment.

⚠️ "Devastating if bumped into" is Metalness's Poison Slime trigger shape (enter
or pushed-in → damage). Needs to resolve differently.

⚠️ `tripped` already halves movement — reuse that machinery rather than adding a
second halving rule.

### 3d. 🪤 Rat Trap — the DISGUISE is the mechanic
A trap left behind after leaving a hex during movement, lasting 2 turns; walking
or being pushed into it **takes 2 notes instead of giving them**.

⚠️ **As stated this is Poison Slime twice over.** Metalness leaves slime on every
vacated hex, damaging anyone who enters or is pushed in, for a duration — same
trigger, same shape. And "takes 2 notes" collides a *second* time with Zero's
Gravity Control (`GRAVITY_NOTE_DRAIN` 2 off a refill).

**The salvage is the part that was said in passing: it LOOKS LIKE A NOTE SPACE.**
Slime is visible denial you route around. The trap is **invisible denial
disguised as a reward** — the rival who reaches for the pickup is the one who
gets caught. That is underhand, it is information warfare, and nobody else does
it. **Lead with the disguise, not the note theft.**

Consider **theft rather than denial** — the notes go *to him*. Nothing in the
game transfers resources between Spirits; denial is already Zero's whole
identity, and a thief is a different character from a jailer.

### 3e. 🎸💥 The Smash — he is who it is FOR
§3.4 (corrected 2026-08-14) documents that **nobody in the roster wants to
Smash**: it costs 2 AP, all remaining movement, the action token, every unused
note, the entire Drive stack and 1 Sustain, for a flat 2/2/2 — and you cannot
cash the hole you tear, because one action token per turn means no follow-up and
your Drive stack is empty next turn. §7 logs that its variable cost against a
fixed payout makes it *worst exactly when you are richest*.

"Destroys its own instrument" is the thematic answer to a mechanical problem: a
Spirit whose identity is that **the Smash is correct** — because he has no chord
worth protecting — gives a dead action an owner.

### 3f. 🐭 Diehard cosmetics — cheap, and worth doing
Riff Rat's diehards wear **mouse ears**; Ronin's wear **hachimaki**; etc.
Purely presentational, no rules risk, high identity payoff — and the crowd
already renders per-Spirit (`fans sprites.png`, `crowd_blue.png` /
`crowd_pink.png`, `FAN_DIEHARD_CAP` 6 so the sprite count is bounded).

Makes the fan bands legible at a glance, which matters more once §2a's
`assignments` and §3c's Moshpit-style theft are moving fans between Spirits.

---

## 4. ⚠️ Vibe 4 is not the weakness you think

Proposed weakness: Vibe 4 instead of 5.

Two things to know before pricing it:

1. **Intergalactic 0 is already 4 Vibe.** It is not a distinguishing cost.
2. **It double-dips.** `melodyCommit.js` computes
   `perfVibeFactor = (maxVibe ?? 5) / 5`, which scales the Performance Score →
   excitement pipeline. So 4 Vibe also means **0.8× fan growth**, every commit,
   forever. He would be paying in health *and* in crowd for one stat.

That may be exactly right for a fragile opportunist — but it should be a decision,
not a surprise.

---

## 5. Open questions

- **Stat line.** Inheriting Glamarchy's 5/8/5/4 makes him a tank, which fights
  the concept. A fast/fragile line (high Speed, low Sustain) fits better — and
  Speed matters more than usual under §1's shared AP pool.
- **What does the hidden ability actually hide?** (§3c.) This is the biggest
  open design question in the doc.
- **Does the trap steal or merely deny?** (§3d.) Theft is unclaimed; denial is
  Zero's.
- **How much of the fan-sabotage is his vs. a revived general system?** Scoped to
  one Spirit is cheaper and sharper; general revives a system that was
  deliberately purged.
- **Style flavour.** `data/styles.js` holds Shred / Groove / Flair as *character
  flavour only* (the Style scoring system was deleted), so adding "Punk" is free
  and touches no rules.

## 6. Notes for the bot work

- **A fourth Spirit before the third has an innate is a real risk.** §4.3 says
  Metalness's missing innate blocks honest cross-Spirit tuning; adding Riff Rat
  now means **two** unfinished characters, and the §6.6 harness would be measuring
  design gaps rather than bot skill on both. `METALNESS_REWORK_DESIGN.md` is the
  smaller job and unblocks measurement for everyone.
- **Hidden information breaks a §5 assumption.** `evaluate.js` scores a position
  from full state. A Spirit who can be *genuinely hidden* means the searcher must
  either cheat (see him anyway) or model belief — and §7's "opponent replies need
  a second mode" is already the unresolved version of this question. Ronin's
  Shadow Illusion is handled today via `view.shadowHex`; a third hidden-info kit
  is the point at which that ad-hoc approach stops scaling.
- **`assignments` re-entering play changes `crowdMultiplier` for everyone**, since
  it is read on every `grantFame`. It is currently always 0, so nothing has ever
  exercised the non-zero path — worth a check when it lands.
