# Stance System — Parts Bin

**Status:** The Stance ability system has been cut from the game. Stances v2 (emotional shredding, cool efficiency, raw power) were fully specced and playtested-adjacent. All ability mechanics below are preserved as a **parts bin** — a menu of ready-to-use abilities the designer can redistribute to individual Spirits during character redraw.

**This is NOT live game content.** For the current Spirit ability system, see [`STYLE_SYSTEM_HANDOFF.md`](./STYLE_SYSTEM_HANDOFF.md).

---

## Active Abilities

### 9 Stance Special Attacks

| Name | Icon | Original Slot | Cost | Full Mechanical Spec | Fits a Spirit who… |
|---|---|---|---|---|---|
| **Hammer-On** | 🔨 | Solo Physical | 1 AP + 1 Db | Instrument swings down like a hammer. Drive **−1** for the roll. On hit: strikes **twice** — compute normal melee damage, double it, cap at **2 × THRASH_DAMAGE_CAP**. | …trades accuracy for burst damage and needs a gimmick to feel special. |
| **Rake** | 🪒 | Low Slung Physical | 1 AP + 1 Db | Spends **3 chord-stack notes instead of 2** (requires ≥ 3 notes in stack). Gains **+2 Drive** on the attack roll. Animate a scrape across the rival. | …needs a high-resource, high-reward physical attack; good for note-hoarding synergies. |
| **Axe Swing** | 🪓 | Wide Leg Physical | **2 AP** + 1 Db | Costs 1 extra AP over Swing. **+2 Drive** on roll. On a whiff (attacker loses): next turn's stock recovery is **halved** (`STOCK_REFILL_RATE` 6 → 3 for one refill cycle). | …punishes whiffs and needs a riskier, costlier physical tool. |
| **Pinch Harmonic** | 🔔 | Solo Sonic | 2 AP + 1 Db | Normal Sonic attack with **+2 Drive** **if** the chord stack contains a **repeat of the root note** (root appears ≥ 2 times). Never let player spend Db when condition unmet. | …rewards root-note stacking and has a reward-gated sonic. |
| **Power Chord** | ⚡ | Low Slung Sonic | 2 AP + 1 Db | Normal Sonic attack with **+2 Drive** **if** the chord stack contains the **perfect 5th of the root**. Disable when condition not met. | …focuses on chord knowledge and interval recognition. |
| **Gallop** | 🐎 | Wide Leg Sonic | 2 AP + 1 Db | Normal Sonic attack with **+2 Drive** **if** the chord stack is **full** (at max capacity). Coconut-clack gallop fading into guitar thrum (SFX). Disable when stack not full. | …incentivizes full stacks and has audio flair. |
| **Bend** | 🎵 | Solo Finisher | **2 AP** + 0 Db | Auto-hit, **range 2 hexes**. Target loses **1 Vibe**. Wrecks the rival's chord stack (**scatter** — Smash-style partial wipe). Wrecks your own notes (full Smash DNA: stocks hurled, movement rooted, **Exposed** status until next turn). | …long-range finisher with emotional appeal and stack disruption. |
| **Slide** | 🎸 | Low Slung Finisher | **2 AP** + 0 Db | Auto-hit from up to **3 hexes** away. Player **slides in** (attacker moves adjacent to target along the line, free, part of the attack). Target loses **1 Vibe**. Wrecks both stacks (**scatter**). Full Smash DNA. Play a note-slide sound. | …the utility finisher; mobility + range combo. |
| **Thrash** | 💥 | Wide Leg Finisher | **2 AP** + 0 Db | Adjacent (melee range only). Auto-hit. **2 Vibe damage**. Rival's chord stack is **totally obliterated** (cleared entirely — stronger than scatter). Full Smash DNA. Smash SFX. | …the raw power finisher; stack destruction over mobility. |

### 3 Passive Effects

| Name | Icon | Original Stance | Full Mechanical Spec | Fits a Spirit who… |
|---|---|---|---|---|
| **Pull-Off** | ↗️ | Solo | When a rival loses a battle against you, they are pushed **+1 hex further** than normal knockback distance. | …controls space and wants positioning leverage. |
| **Feedback** | 📢 | Low Slung | Any rival whose attack on you deals **0 damage** (whiff, blocked, etc.) takes **1 extra Vibe damage** on top of any whiff penalty (e.g., `THRASH_WHIFF_DMG` + 1). | …thrives on punishing whiffs and defensive plays. |
| **Headbang** | 🤘 | Wide Leg | Fans dig the tune: improves Casual → Diehard conversion. Promote every **2** centre-streak turns (base: 3). Award **16 loyalty per Diehard** (base: 24). | …builds fan loyalty faster and needs crowd synergy. |

---

## Commit Generators

The three Stance note-commit detectors are **NOT reusable as-is** because melody-pattern-to-Db assignment is now owned by the Style system. However, their detector logic was deleted from `engine/systems/economy.js` during the cut. If a Spirit ever needs a personal pattern bonus, the implementation can be recovered from git history:

```bash
git log --oneline -- engine/systems/economy.js | head -5
git show <commit>:engine/systems/economy.js | grep -A 30 detectTrill
```

| Name | Icon | Original Stance | Pattern Recognition | Reward |
|---|---|---|---|---|
| **Trill** | 🎼 | Solo | **3+ consecutive notes alternating between two pitches ≤ 2 semitones apart** (e.g., E–F–E–F–E, A–B–A). Fires at most once per committed run. | **+`STANCE_COMMIT_DB` Db** (tunable constant; default 1). |
| **Chug** | 🔁 | Low Slung | **3+ identical notes in a row** (e.g., C–C–C). Fires at most once per committed run. | **+`STANCE_COMMIT_DB` Db**. |
| **Dive Bomb** | 💣 | Wide Leg | A committed run that **starts and ends on the same note letter, descends overall, and ends an octave below the start** (e.g., E5 → D → C → B → E4). Fires at most once per committed run. | **+`STANCE_COMMIT_DB` Db**. |

Detectors fired in `confirmNoteTrack` (alongside existing run/motif detectors). Log lines and small flash on trigger ("🎸 TRILL! +1 Db").

---

## Mechanical Hooks These Relied On

If a redistributed ability is assigned to a Spirit, the engine must support:

- **`driveMod` applied pre-roll** — Hammer-On and Rake modify attacker Drive before the attack dice roll (not post-roll). Axe Swing, Pinch Harmonic, Power Chord, Gallop also use this hook.
- **`doubleDamage` capped at `2 × THRASH_DAMAGE_CAP`** — Hammer-On doubles computed melee damage but never exceeds `2 * THRASH_DAMAGE_CAP`.
- **`stackWipe` modes: scatter vs. obliterate** — Bend and Slide use **scatter** (Smash-style partial wipe); Thrash uses **obliterate** (full clear). Both wipe the attacker's notes too (Smash DNA).
- **`slideIn` movement** — Slide attaches free movement (attacker slides adjacent to target along attack line) as part of the attack resolution, before damage.
- **`whiffPenalty` halfRefill** — Axe Swing: on a whiff, reduce next turn's `STOCK_REFILL_RATE` from 6 → 3 for one refill cycle only.
- **Conditional `+2 Drive` on chord-stack conditions** — Pinch Harmonic (root repeated ≥ 2×), Power Chord (5th present), Gallop (stack full). Disable button UI when condition not met so player doesn't waste Db.
- **`extraKnockback`** — Pull-Off: add +1 hex to knockback distance when rival loses.
- **`zeroDamageRetaliation`** — Feedback: +1 Vibe damage when rival's attack deals 0 damage to you.
- **Fan economy: `promoteEvery` & `loyaltyPerDiehard`** — Headbang: promote Casual → Diehard every 2 centre-streak turns (instead of 3), and award 16 loyalty per new Diehard (instead of 24).
- **Full Smash DNA** — Bend, Slide, Thrash: stock hurled, movement rooted (`smashExposed`), Exposed status until next turn.
- **Fixed finisher damage (not roll-based)** — Bend: 1 Vibe, Slide: 1 Vibe, Thrash: 2 Vibe. Not derived from thrown-note count.

---

## Original Spirit Assignments (Context)

- **Shredding Ronin** (`cosmic_ronin`) → Solo
- **Glamarchy** → Low Slung
- **Intergalactic 0** (`intergalactic_0`) → Low Slung
- **Metalness Monster** → Wide Leg
