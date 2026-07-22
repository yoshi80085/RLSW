# Stance System v2 — Implementation Handoff

Supersedes `STANCE_SYSTEM_DESIGN.md` (v1, the passive-modifier model). v1 is CUT in full.
This doc is the complete spec for the replacement. All design decisions below are LOCKED
(design session 2026-07-22) unless marked ⚠️ TUNABLE or ❓ OPEN.

---

## 1. Summary of the change

v1 stances were passive stat modifiers (fray math, Fame multipliers, Groove counter).
v2 stances are **ability kits**: each stance grants named special attacks, one passive,
and one note-commit Db generator. Special attacks are fueled by **Db (Decibills)** —
the same points that buy skill upgrades. The player chooses every time: bank Db toward
the next upgrade, or burn 1 Db now for a special attack.

Three stances (Groove is cut):

| Stance | Pose | Tagline | Icons of the style |
|---|---|---|---|
| **Solo** | Emotional / Shredding | "Every note tells a story." | Vai, Satriani, Petrucci |
| **Low Slung** | Cool | "Less notes. More attitude." | Slash, Johnny Ramone, Billie Joe |
| **Wide Leg** | Power | "Every chord hits like a freight train." | Hetfield, Zakk Wylde, Dimebag |

Stance is **fixed per spirit for the whole match** — no switching, no learning route.

| Spirit | Stance |
|---|---|
| Shredding Ronin (`cosmic_ronin`) | Solo |
| Glamarchy | Low Slung |
| Intergalactic 0 (`intergalactic_0`) | Low Slung |
| Metalness Monster | Wide Leg |

---

## 2. What gets CUT (do this first)

From `data/stances.js`, the engine, and `rlsw-simulator-v3_8_1.jsx`:

- All v1 passive effects: stance modifiers in `stanceFrayAmount` (keep the margin-scaled
  base fray — 1 note on margin ≤ 2, 2 on ≥ 3, floor 1 surviving note — it is now
  stance-neutral), `SOLOIST_FAN_BONUS`, Soloist ⌈P/2⌉ Drive bonus, Power fray/damage
  mods, Cool fray halving, `COOL_PROMOTE_EVERY` / `COOL_LOYALTY_PER_DIEHARD`
  (numbers get reused by Headbang, see §5.4), the entire Groove counter
  (`grooveCounter`, `grooveCap`, build/reset/spend logic, `GROOVE_CAP_*`).
- The **Stance skill route** in `SKILL_TREE.routes`: skills `stance_2/3/4`,
  `stance_encore`, `stance_demolition`, `stance_aftershock`, `stance_ironclad`,
  `stance_riposte`, `stance_resonance`, `stance_sustainwave`. Also `stancesKnown`,
  the stance-pick modal, `Game.switchStance`, `BOT_STANCE_PREF`, and any
  `requiresStance` gating in `skillEligibility`.
- The generic **Smash button**. `resolveSmash` becomes the shared engine core for the
  three stance finishers (§4) — keep `smashOutcome`-style pure math in
  `engine/systems/combat.js`, parameterized per finisher. Remove the Ronin
  special-casing (`roninSmasher` soft-smash attacker penalty — he has Hammer-On now).
  ❓ OPEN: Ronin's *weak-to-smash* double-scatter when targeted — default CUT; flag in
  the commit message so it can be restored if playtest wants it.

Untouched: chord spine (`evaluateChord`), Theory/Electric/Crew/Signature routes,
Thrash/Sonic delivery physics (§2 of v1 doc), fan economy, riff-offs, amps/rig.

---

## 3. Action bar & button model

Every spirit's bar:

| Button | Cost | Availability |
|---|---|---|
| ⚔️ **Swing** | 1 AP | everyone (unchanged) |
| 🔊 **Sonic** | 2 AP | everyone (unchanged) |
| Stance **Physical special** | Swing's AP + **1 Db** (Axe Swing: 2 AP + 1 Db) | stance kit |
| Stance **Sonic special** | 2 AP + **1 Db** | stance kit |
| Stance **Finisher** (replaces Smash slot) | **2 AP, no Db** — full Smash cost model | stance kit |

Rules:

- **Db-costed buttons are disabled at 0 Db.** Spending decrements `dbPoints` by 1
  (never below 0); this directly slows progress to the next skill unlock — that's the
  intended tension. Show current Db on/near the buttons.
- Sonic specials are disabled when their +2 Drive condition isn't met (never let a
  player waste a Db on a bonus that can't fire). ⚠️ TUNABLE if it feels too safe.
- Finishers keep **full Smash DNA**: cost 2 AP, require ≥ 2 unused stock notes, hurl
  ALL unused stock (self-wrecks your notes), root you (no movement after), and leave
  you **Exposed** (`smashExposed`) until your next turn. Damage is FIXED per finisher
  (below), not derived from thrown-note count.
- Physical/Sonic specials resolve through the existing Swing/Sonic pipelines
  (dice, chord-vs-chord, fray, fame) with the listed deltas applied. `ATK_BONUS_CAP`
  still applies to stacked Drive bonuses.
- Naming: keep the internal melee attack kind `'thrash'`/`THRASH_*` constants as-is;
  Wide Leg's finisher uses a distinct id (e.g. `'thrash_finisher'`) to avoid collision.
  User-facing label is still "Thrash".
- **Blaster of Ra** (Intergalactic 0 signature) previously replaced the Smash; it now
  replaces Zero's finisher slot (Slide) when unlocked.

---

## 4. The three kits

### 4.1 SOLO — Emotional / Shredding · "Every note tells a story."

| Slot | Name | Spec |
|---|---|---|
| Physical (1 AP + 1 Db) | **Hammer-On** | Instrument swings down vertically like a hammer. Attacker Drive **−1** for the roll. On a hit: strikes **twice — 2× damage** (compute normal melee damage, double it; cap at 2×`THRASH_DAMAGE_CAP` ⚠️ TUNABLE). Animate a double guitar-smash on the Rival. |
| Sonic (2 AP + 1 Db) | **Pinch Harmonic** | Normal Sonic attack with **+2 Drive** if the chord stack contains a **repeat of the root note** (root appears ≥ 2×). |
| Finisher (2 AP) | **Bend** | Auto-hit (no roll), **range 2** hexes, target loses **1 Vibe** — "overcome with emotion." Wrecks the Rival's chord stack (Smash-style scatter) AND your own notes (full Smash DNA §3). |
| Passive | **Pull-Off** | When a Rival loses a battle against you, they are pushed **+1 hex further** than normal knockback. |
| Note-commit | **Trill** | Committing **3+ consecutive notes alternating between two pitches ≤ a whole step (2 semitones) apart** (e.g. E–F–E, A–B–A–B) grants **+`STANCE_COMMIT_DB` Db**. |

### 4.2 LOW SLUNG — Cool · "Less notes. More attitude."

| Slot | Name | Spec |
|---|---|---|
| Physical (1 AP + 1 Db) | **Rake** | Strings rake the Rival like cutting wires. Spends **3 chord-stack notes instead of 2**, gains **+2 Drive**. Requires ≥ 3 notes in the stack. Animate a scrape across the Rival. |
| Sonic (2 AP + 1 Db) | **Power Chord** | Normal Sonic attack with **+2 Drive** if the chord stack contains the **5th of the root**. |
| Finisher (2 AP) | **Slide** | Auto-hit, from up to **3 hexes** away: the player *slides in* (move attacker adjacent to the target along the line, free, part of the attack), target loses **1 Vibe**. Play a note-slide sound. Full Smash DNA (§3). |
| Passive | **Feedback** | Any Rival whose attack on you deals **0 damage** takes **1 extra Vibe damage** (e.g. whiffed melee: `THRASH_WHIFF_DMG` + 1). |
| Note-commit | **Chug** | Committing **3+ identical notes in a row** grants **+`STANCE_COMMIT_DB` Db**. |

### 4.3 WIDE LEG — Power · "Every chord hits like a freight train."

| Slot | Name | Spec |
|---|---|---|
| Physical (**2 AP** + 1 Db) | **Axe Swing** | Costs 1 extra AP over Swing. **+2 Drive**. On a whiff (attacker loses), next turn's stock recovery is **halved** (`STOCK_REFILL_RATE` 4 → 2 for one refill). |
| Sonic (2 AP + 1 Db) | **Gallop** | Coconut-clack gallop fading into guitar thrum (SFX). Normal Sonic with **+2 Drive** if the chord stack is **full**. |
| Finisher (2 AP) | **Thrash** | Adjacent (melee range). Auto-hit, **2 Vibe damage**, no roll. Rival's chord stack is **totally obliterated** (cleared entirely — stronger than Smash scatter). Smash SFX. Full Smash DNA (§3). |
| Passive | **Headbang** | Fans dig the tune: Casual → Diehard conversion improved. Reuse v1 Cool numbers: promote every **2** centre-streak turns (base 3), **16** perf loyalty per Diehard (base 24). |
| Note-commit | **Dive Bomb** | A committed run that **starts and ends on the same note letter, descends overall, and ends an octave below the start** grants **+`STANCE_COMMIT_DB` Db**. |

---

## 5. Db economy notes

- `advanceDB` / `dbPoints` / `DB_UPGRADE_THRESHOLD` machinery is unchanged for earning.
- New constant `STANCE_COMMIT_DB = 1` ⚠️ TUNABLE (in `gameConstants.js`). Commit
  generators fire **at most once per commit**, on top of normal Db earnings, and are
  detected in `confirmNoteTrack` (alongside the existing run/motif detectors —
  `repeatPatLen` is nearly Chug already; octave-resolution flags help Dive Bomb).
- Spending: specials call a single `spendDb(spiritId, 1)` helper; guard at 0.
- Log lines + a small flash when a commit generator triggers ("🎸 TRILL! +1 Db").

## 6. Implementation seams

- `data/stances.js` — rewrite `STANCE_DEFS` (3 entries: `solo`, `low_slung`,
  `wide_leg`; keep `pose`, `icon`, `color`, `blurb`, add `tagline` + kit metadata:
  button labels, costs, tooltips). Rewrite `STARTING_STANCE` per §1. Keep `stanceOf`.
- `engine/systems/combat.js` — parameterize the finisher math (fixed damage, range,
  stack-wipe mode) next to `smashOutcome`; keep it pure for server parity.
- `rlsw-simulator-v3_8_1.jsx` — action bar (~line 10361+): 5 buttons per §3, with
  the aim-preview modes extended (`previewAction`: add the three specials + finishers;
  reuse swing-cone / sonic-beam previews; Bend/Slide need their own range highlight).
- `engine/policies/bot.js` — bots use specials when Db ≥ threshold-margin (don't let
  bots starve their own upgrades: e.g. only spend when `dbPoints ≥ 3` ⚠️ TUNABLE);
  finishers replace existing Smash logic (turtle-buster heuristic at ~line 8106).
- Tutorial/hints (`tutorial/content.jsx`, `ui/HintScreen.jsx`, hint at ~line 1397) —
  rewrite the "three ways to ruin someone's set" copy for the new bar; remove all
  Groove/stance-switching copy.
- `serialize.js` / multiplayer — remove `stancesKnown`/`grooveCounter` from the wire
  format; add nothing (stance derives from spirit).

## 7. Acceptance checklist

- [ ] All §2 cuts removed; game compiles; no `stance_*` skill ids remain in trees.
- [ ] Each spirit shows its fixed stance + correct 5-button bar.
- [ ] Db-costed buttons disable at 0 Db; spending updates the upgrade progress UI.
- [ ] Each of the 9 attacks + 3 passives + 3 commit generators has a log line, SFX
      hook, and effect flash.
- [ ] Finishers: stock hurled, movement rooted, Exposed applied, fixed damage dealt,
      stack scatter/wipe correct per stance.
- [ ] Blaster of Ra replaces Slide for Intergalactic 0.
- [ ] Bots use the new buttons; smoke tests (`server/n*.mjs`) pass.
- [ ] `STANCE_SYSTEM_DESIGN.md` marked superseded with a pointer to this doc.
