# DRIVE / SUSTAIN STACK SPLIT — Design Spec

Splits the single Chord Stack into two independent stacks: the **Drive Stack**
(attack) and the **Sustain Stack** (defense). Adds a third commit destination
alongside the Melody Line and rebalances the note economy to feed all three.

---

## 1. The Three Commit Destinations

| Destination | Purpose | Cap | Persists? |
|---|---|---|---|
| **Drive Stack** | Attack stat + attack ammo | 5 notes | Yes — spent by attacks |
| **Sustain Stack** | Defense stat / armor | 5 notes | Yes — chipped when hit |
| **Melody Line** | Movement / performance | (unchanged) | Cleared on confirm (unchanged) |

## 2. Stat Derivation

Each stack resolves to a chord shape via `spiritChord(spiritId, stack)`
(wrapper in the JSX over `evaluateChord` from `music/chords.js`) — **but each
stack only reads its own stat**:

- Drive Stack → `spiritChord(id, driveStack).drive` only
- Sustain Stack → `spiritChord(id, sustainStack).sustain` only

The chord table (`CHORD_TEMPLATES`) is unchanged. Building a Dim7 in Drive
(D9) or a Maj7 in Sustain (S8) is now the optimal play per side; the strategic
tension moves from "one stack can't be good at both" to "your note economy
can't feed both fast." `tempDrive` / `tempSustain` modifiers apply on top,
unchanged.

> **Intergalactic 0 note:** `spiritChord` gives I0 +1 Sustain on every voicing.
> This is unchanged — I0's Sustain Stack chord reads one point higher than the
> table. The +1 on the Drive Stack's sustain value is harmless (Drive ignores
> sustain). No rebalance needed.

## 3. Turn Flow (kept deliberately simple)

1. **Regen** — start of turn, refill up to **6** spent stock slots (was 4).
2. **Stack Phase** — commit **0–3 notes** from the pool, split freely between
   Drive and Sustain (all 3 to one stack is fine). Committing is optional.
3. **Melody Phase** — commit remaining pool notes to the Melody Line and
   confirm, as today.

That's it: *Stacks (or not) → Melody.* The single-Revoice-per-turn limit
(`revoiceUsedThisTurn`) is replaced by the 3-note stack budget.

> Tuning knob: if stacks build to full too fast in playtests, drop the budget
> to 2 before touching regen or caps.

## 4. Note Economy

| Constant | Old | New |
|---|---|---|
| Base pool (stock slots) | 8 | **10** |
| Regen per turn (`STOCK_REFILL_RATE`) | 4 | **6** |
| Cosmic Ronin pool | 10 | **11** |
| Cosmic Ronin regen | 4 | **6** (same as base) |

Ronin's edge intentionally shrinks from +2 to +1, and Ronin is the only spirit
whose pool can't fully refill from empty in one turn (11 > 6+spent overlap) —
deeper well, slower to top off.

Axe Swing whiff penalty (halved refill) becomes **6 → 3** for one refill.

## 5. Combat Consumption Rules

**Sonic attacks**
- Attacker spends **1 note from Drive Stack** — *hit or miss* (the note is
  gone either way).
- On hit: Rival loses **1 note from Sustain Stack**.
- On whiff: Rival loses nothing.

**Physical attacks**
- On hit: attacker spends **2 notes from Drive Stack**; Rival loses **1 note
  from Sustain Stack**.
- On whiff: attacker spends **nothing**; Rival loses nothing.

Notes removed from stacks are gone (they return to the pool only via normal
regen). Losing Sustain notes can downgrade the defender's chord shape —
getting hit erodes your armor, which is the point.

*Change from current behavior:* physical attacks today spend 2 notes on the
attempt regardless of outcome; sonic spends `sonicSpendN` up front. New model:
physical only pays on a hit, sonic always pays 1.

## 6. Starting State

Each player starts with a **Power Chord (root + 5th) in BOTH stacks**:
Drive 5 / Sustain 5 — identical starting stats to today's single power chord,
costs no pool notes, and teaches both stacks on turn one.

## 7. Ripple Effects — Everything That Reads `chordStack`

| System | Current behavior | New home |
|---|---|---|
| `pinchHarmonicCondition` (2× root in stack) | single stack | **Drive Stack** (attack skill) |
| `powerChordCondition` (5th in stack) | single stack | **Drive Stack** |
| `gallopCondition` (stack ≥ max) | single stack (default 6) | **Drive Stack** — cap changes to `STACK_CAP` (5); update the default arg from 6 → 5 |
| Fray (removes defender notes) | single stack | **Sustain Stack** — now redundant-adjacent to hit-chip; consider retuning or making Fray remove 2 |
| Swing / Axe Swing note costs | spends 2 up front | Drive, **on hit only** (§5) |
| Rake (`noteCost: 3`) | 3 from chord stack | **3 from Drive Stack** (60% of Drive cap — intentionally steep) |
| Sonic note costs | single stack, variable `sonicSpendN` | Drive, fixed 1 per attack, hit or miss — retire the `sonicSpendN` variable |
| Bank-on-full (`bankLostChordNote` at 5) | one 5-cap check | applies per stack (note routed to whichever stack was targeted) |
| Lost Chord pickup (`resolveLostChordPickup`) | "bank" vs "chord" (single stack) | "bank" / "Drive" / "Sustain" — picker becomes a 3-way choice; auto-bank if the targeted stack is already at `STACK_CAP` |
| Finisher stack-wipe (`stackWipe`) | wipes the single chord stack | wipes **both** Drive and Sustain stacks on the target (scatter removes from both proportionally; obliterate clears both) |
| Defender sustain reads (bot AI, UI knobs, overlays) | `spiritChord(stack).sustain` | `spiritChord(id, sustainStack).sustain` |
| Attacker drive reads | `spiritChord(stack).drive` | `spiritChord(id, driveStack).drive` |

## 8. State & Code Changes

`noteStates` sheet (`engine/systems/economy.js` + client mirror — keep in sync):

```
- chordStack: [root, 5th]
+ driveStack:   [root, 5th]
+ sustainStack: [root, 5th]
- revoiceUsedThisTurn: false
- bonusRevoiceAvailable: false
+ stackCommitsThisTurn: 0        // 0–3 budget, resets each turn
```

`bonusRevoiceAvailable` (Lost Chord → chord pickup grants a free revoice) is
removed alongside `revoiceUsedThisTurn` — the concept of "revoice" is gone;
Lost Chord pickups now route through the 3-way Drive/Sustain/bank choice (§7)
and count against the stack commit budget (or are free if the budget has room
— TBD in playtests).

Keep `chordStack` as a deprecated field for save compat (like `edgeStage`), or
migrate old saves by copying `chordStack` into both stacks once.

Touch list:
- `data/gameConstants.js` — `STOCK_REFILL_RATE` 4 → 6; add `STACK_COMMIT_BUDGET = 3`, `STACK_CAP = 5`
- `engine/systems/economy.js` — `makeInitialNoteState`: stockSize 8→10 (Ronin 11), dual stacks, remove `revoiceUsedThisTurn` + `bonusRevoiceAvailable`, add `stackCommitsThisTurn`
- `engine/systems/combat.js` — condition fns take the right stack; `gallopCondition` default cap 6→5; new hit/miss spend logic
- `data/stances.js` — Axe Swing whiff comment (6→3); `axe_swing.whiffPenalty` comment update
- `rlsw-simulator-v3_8_1.jsx`:
  - all ~40 `chordStack` sites → split into `driveStack`/`sustainStack` reads
  - `spiritChord()` calls split: attack paths read Drive, defense paths read Sustain
  - `resolveLostChordPickup` → 3-way picker (bank / Drive / Sustain), remove `bonusRevoiceAvailable` path
  - finisher `stackWipe` → wipes both stacks on target
  - Rake `noteCost: 3` → spends from Drive Stack explicitly
  - commit UI: render two stacks in the battle panel; enforce `STACK_COMMIT_BUDGET`
  - swing/sonic spends: swap from `chordStack` → `driveStack` with new hit/miss rules
  - fray: swap from `chordStack` → `sustainStack`
- `engine/policies/bot.js` — bot commit logic: budget split heuristic (favor Drive when hunting, Sustain when low Vibe); `botPlanRevoice` → replace with `botPlanStackCommit`
- `engine/selftest.mjs` — see §8a below
- UI: `StatKnob` drive/sustain sources, `HintScreen`/tutorial copy, `GameStyles`

### 8a. Selftest Changes (STICs)

Tests that **break** and must be updated:
- `axeSwingWhiffRefill() === 2` (line ~2314) → assert `=== 3` (STOCK_REFILL_RATE 6/2)
- `ns.chordStack.length === 2` (line ~768) → assert `driveStack` and `sustainStack` each length 2
- `ns.noteStock.length === 8` (line ~767) → assert `=== 10` (Ronin `=== 11`)
- `revoiceUsedThisTurn` / `bonusRevoiceAvailable` assertions → remove
- `botPlanRevoice` tests (line ~1896) → replace with `botPlanStackCommit` tests
- `gallopCondition(['C','D','E','F','G'], 6)` → update cap to 5

New tests to **add**:
- `makeInitialNoteState` produces `driveStack: [root, 5th]` and `sustainStack: [root, 5th]`; no `chordStack` (or deprecated empty)
- `stackCommitsThisTurn` starts at 0, increments per commit, rejects at > `STACK_COMMIT_BUDGET`
- Sonic spend: 1 from `driveStack` hit or miss; defender loses 1 from `sustainStack` on hit only
- Physical spend: 2 from `driveStack` on hit; 0 on whiff; defender loses 1 from `sustainStack` on hit
- `pinchHarmonicCondition` / `powerChordCondition` take `driveStack`
- `gallopCondition(driveStack, 5)` — full at 5
- Fray removes from `sustainStack`, not `driveStack`
- Finisher obliterate clears both stacks; scatter removes from both proportionally

## 9. Stack Cap Enforcement

Committing a note to a stack that is already at `STACK_CAP` (5) is rejected
(same as today's single-stack cap check). The commit UI greys out the
destination when the target stack is full.

## 10. Open Tuning Flags

- With 3 notes/turn to stacks, sustainable melody spend is ~3/turn (regen 6 −
  stack budget). If melodies feel starved, regen 7 is the lever.
- Both stacks at 9th-chord strength (5 notes each) is a 10-note investment the
  economy can only rebuild slowly — full double-stack should feel earned.
- Fray vs. hit-chip overlap (see §7) needs a playtest look.
- Lost Chord pickup: should routing a note to a stack via the 3-way picker
  cost a stack commit budget slot? If yes, mid-turn pickups can starve your
  Stack Phase. If no, it's a free commit and a potential exploit. Lean toward
  "yes, costs a budget slot" and playtest.
