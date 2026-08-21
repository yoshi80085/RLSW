# RLSW Simulator — Architecture

> **For AI editors.** This file is the canonical map of the codebase. When you
> make structural changes (new files, moved code, renamed exports, new UI
> regions), **update this file in the same edit session** so the next AI picks
> up where you left off.

Line numbers are approximate — navigate by the **banner comments**
(`// ─── NAME ───`) inside the main file, not by line number.


---

> ## ⚠️ THIS MAP HAS DRIFTED. MEASURED 2026-08-21, NOT REPAIRED.
>
> CLAUDE.md's rule is that a doc which has drifted from the code is worse than no
> doc, and that the honest move is to **say so plainly rather than edit around it.**
> So: this file is a map of the codebase as it stood before the engine existed.
> The numbers below were counted, not estimated.
>
> - 🎮 **It calls `engine/` a "~300 line Phase 1 scaffold."** `engine/` is
>   **11,694 lines across 29 modules** and is the authoritative game core — every
>   rule, every bot decision, every payout. It is where essentially all work since
>   June has happened.
> - 🕳️ **`engine/policies/` and `engine/systems/` are absent entirely.** Not
>   stale — *missing*. `evaluate.js`, `bot.js`, `legalActions.js`, `play.js`,
>   `transition.js`, `battleFlow.js`, `turnFlow.js`, `sonicRig.js`,
>   `economy.js`, `melodyCommit.js`, `limelight.js`, `slime.js`,
>   `attackParams.js` — none of them appear in this file.
> - 📊 **50 of 130 source modules are unlisted**, including all of `ui/Pickles.jsx`,
>   `ui/OpeningMovie.jsx`, `ui/LegendLessons.jsx`, `ui/DiscordCoach.jsx`,
>   `board/ampDecks.jsx`, `data/skillTree.js` and `music/context.js`.
> - 🔢 **`data/gameConstants.js` is listed as "39 named constants."** It exports
>   **96**.
>
> 🎯 **WHAT IS STILL TRUE, AND WHY THE FILE SURVIVES.** The `board/`, `music/`,
> `audio/`, `riff/` and `vision/` tables are broadly accurate, and the
> **"where do I change X?" index near the bottom is the single most useful thing
> in the repo for a cold start** — that is the part worth rebuilding around.
>
> 📌 **The rows that named files which no longer exist were removed on 2026-08-21**
> (`ampRigs.js`, `useNoteSystem.js`, `RiffBanner.jsx`, `riffLibrary.js`), so
> the file no longer sends anyone to a path that isn't there. Nothing else was
> touched: a partial repair that *looked* current would be more dangerous than a
> banner saying it isn't. **Rewriting this properly is its own session** — it is
> logged as the top item in `SEQUENCING.md` §5.E⁸.

---

## Design lenses — the STICs test + Earned

Run every mechanics proposal through this before coding it. Full rationale
lives in `DESIGN_AUDIT.md` / `DESIGN_AUDIT_v2.md`; this is the compact
checklist for future sessions (AI or human).

**STICs** — four independent lenses. A change should pass all four, or the
trade-off should be a deliberate, stated call rather than an accident:

| Lens | Question |
|---|---|
| **S**implicity | Can a player hold this rule in their head? Does it add a new resource/exception, or fold into something that already exists? |
| **T**hematic | Does this make sense for a battle-of-the-bands rock game? Would a rock-myth reference explain *why* the rule works this way? |
| **I**ntuitive | Will a new player guess this correctly, or does it need a tooltip to not feel broken? |
| **C**oherent | Does it agree with the rest of the ruleset — no contradicting a system elsewhere, no "taught vs. coded" mismatch (`DESIGN_AUDIT_v2.md` §2)? |

**Earned** — a fifth, usually-deciding check, orthogonal to STIC: does this
number trace back to a choice the player just made (melody built, chord
voiced, position held), or is it handed out by a static stat, a character
sheet, or a die roll? The game's thesis is *"the melody you build is your
combat"* (`DESIGN_AUDIT.md` §1) — a payout with no traceable player action
undercuts that thesis even if it cleanly passes STIC.

When evaluating a proposal, say explicitly which lens (if any) it's weak on
rather than a flat yes/no.

---

## Boot flow

```
index.html
  └─ main.jsx              React root, StrictMode, imports index.css
       └─ App.jsx           thin wrapper, renders <RLSWSimulator/>
            └─ rlsw-simulator-v3_8_1.jsx
                 ├─ RLSWSimulator()   app shell: Lobby → Tutorial → Game
                 └─ Game()            the gameplay component (~10,000 lines)
```

---

## Directory map

| Path | Contents | Lines |
|------|----------|-------|
| `rlsw-simulator-v3_8_1.jsx` | Main file: module-level data/constants, `RLSWSimulator` shell, and the `Game` component with all gameplay logic. | ~10,650 |
| `App.jsx`, `main.jsx` | Vite/React entry wiring. | 12 |
| `audio/` | Web-Audio SFX and BGM track management. | ~240 |
| `board/` | Board geometry, hex map, amp-rig graph, board helpers. | ~300 |
| `data/` | Pure game data — spirits, corners, events, trivia, tuning constants. | ~2,280 |
| `engine/` | 🎮 **The authoritative game core — not a scaffold.** Plain-JSON `GameState`, `applyAction` reducer, seeded rng, snapshot/replay, plus `systems/` (17 rule modules) and `policies/` (the bot, the evaluator, legal actions, the headless harness). ⚠️ Almost none of it is mapped below; read the modules. See `MULTIPLAYER_HANDOFF.md` and `BOT_STRATEGY_HANDOFF.md`. | ~11,700 |
| `hooks/` | Custom React hooks that own slices of `Game` state. | ~6 files |
| `music/` | Music theory, riff library, cadence scoring, chord evaluation. | ~730 |
| `riff/` | Riff generation engine (contours, rhythms, attacker/defender riffs), melody-to-riff converter (`melodyRiff.js` — Phase R1), falling-notes timing/difficulty (`fallingNotes.js`), + full-neck guitar voicing (`guitarMap.js` — Rocksmith pass). | ~540 |
| `tutorial/` | Illustrated in-game tutorial. | ~1,030 |
| `ui/` | Presentational React components extracted from `Game`'s render. | ~18 files |
| `standees/` | Character standee PNGs (normal + `_mirror`). | — |
| `bgm/`, `sfx/` | Background-music `.mp3` tracks and sound effects. | — |
| `index.css` | Global CSS (Vite starter, overridden by `GameStyles`). | 112 |

---

## The main file — layer by layer

`rlsw-simulator-v3_8_1.jsx` (~10,650 lines) is organized in three layers.

### 1. Imports + module-level code (top → ~line 583)

- **Asset imports** (board, crowd, battle-meter PNGs) — lines 1–8.
- **Module imports** from all extracted directories — lines 9–48.
- **React / library imports** — lines 49–50.
- **Module-level data still in main** (not yet extracted):
  - `SPOTLIGHT_POOL`, `EVENT_HEX_POOL` (depend on runtime `ALL_HEXES`)
  - `BTTP_STAGES`, `SIGNATURE_TESTS`
  - `DISCORD_UPGRADE_TIERS`
  - `SKILL_TREE` / `SKILL_BY_ID`
  - `TONE_VOICES`, `TONE_VOICE_ORDER`, `TONE_KNOB_DEFAULTS`
  - `fanPawnShape()` (returns JSX — can't trivially extract)

### 2. `RLSWSimulator` (~line 584)

App shell / router. Holds top-level UI state (player count, assignments,
starting lives, tutorial flag) and switches between `Lobby`, `Tutorial`, `Game`.

### 3. `Game` (~line 602 → end)

The big component. Its internal sections (by banner):

| Banner | ~Line | Responsibility |
|--------|-------|----------------|
| `BATTLE STATE` | 602 | Core combat state + `useRef` mirrors for async callbacks. |
| `TRANSIENT BOARD FX` | 789 | (Delegated to `hooks/useTransientFx.js`.) |
| `NOTE SYSTEM STATE` | 801 | Per-spirit sheet shape — now built by the ENGINE (`engine/systems/economy.js: makeInitialNoteState`, seeded; the client duplicate was deleted in Phase 5c). `setNoteStates` is a DIFFING shim → per-spirit `NOTE_SHEET_PATCHED` actions (full-map `NOTE_STATES_SYNCED` is fallback-only). |
| `BGM` | 894 | (Delegated to `hooks/useBgmState.js`.) |
| `POINTS FLASH STATE` | 912 | Transient scoring flash. |
| `BOARD DEPLOYABLES` | 919 | (Delegated to `hooks/useBoardState.js`.) |
| `FAN ECONOMY` | 929 | (Delegated to `hooks/useFanEconomy.js`.) |
| `EVENT SPACES STATE` | 942 | Event hex tracking + `STAGE EFFECTS` views (Phase 6b: active effects live in `engineState.stageFx`; only the banner remains in `hooks/useStageEffects.js` — the hazard ref mirror is gone, async checks read `engineRef`). |
| `BOARD MINI-GOALS` | 963 | Lost Chords (Lighters were cut — see `ECONOMY_HANDOFF.md`). |
| `RIFF STATE` | 982 | (Delegated to `hooks/useRiffState.js`.) |
| `BGM SETUP` | 993 | Background-music playback effects. |
| `BEGINNER TIP DEFS` | 1036 | Tutorial tip popup definitions. |
| `DERIVED STATE` | 1112 | Computed values (acting spirit, current scale, amp rigs). |
| `NOTE SOUND` | 1253 | Web-Audio synth for note playback + tone knobs. |
| `RIFF PLAYBACK` | 1537 | `playRiffSequence` — the riff-off playback engine. |
| `MELODY LINE FUNCTIONS` | 1569 | `clickNoteStock`, `confirmNoteTrack`, `clearNoteTrack`, chord revoice (`addChordNote`/`removeChordNote`). |
| `SKILL TREE` | 2470 | Target selection & skill award. |
| `CREW & GEAR` | 2740 | Deployable placement handlers (junkyard_dog / fandom_army CUT with Stance system). |
| `MODULATION CARDS` | 2898 | 🧍 CUT to one survivor: the starter Transpose one-shot (Chromatic Shift + Overdrive gone). |
| `SWING EFFECTS` | 3029 | 🧍 CUT — the CQC %-proc chain is gone; melee identity lives in per-Spirit innates and Signature arsenals (see CHARACTER_HANDOFF.md). |
| `AMP UNPLUG` | 3217 | Amp-unplug system. |
| `BOARD CARD SYSTEM` | 3261 | Board card pickup/replace. |
| `EVENT SPACES SYSTEM` | 3315 | Event space resolution. |
| `BACK TO THE PAST` | 3713 | Play-challenge mini-engine. |
| `BATTLE SYSTEM` | 4040 | Combat entry point. |
| `STAGE EFFECTS SYSTEM` | ~4330 | 🎇 Board Stage Effects — Phase 6b: the RULES (activation, per-turn/per-round ticks) are engine reducers; these functions dispatch and render the reports (logs/FX/damage timing). `checkStageFxHex` hazard-entry damage reads `engineRef.current.stageFx`; `isHiddenBySmoke` reads the view. |
| `ROCK GOD SYSTEM` | ~4530 | 🤘 Endgame boss — Phase 6c: the god/outcome are ENGINE state; `summonRockGod` computes the god pick (amps are client) and dispatches `GOD_SUMMONED`; `attackRockGod` dispatches `GOD_DAMAGED` (engine owns winded ×2 + floor); `rockGodAct` dispatches `GOD_ACTED` and renders the report; the 45s clock stays client (expiry dispatches `GOD_TIMER_EXPIRED`); `godDefeated`/`godTriumphs` lock the engine outcome (+ `WINNER_DECLARED` shadow on the crowning). PvP is guarded off in `initiateSwing`/`initiateSonicAttack`/`resolveSmash`; `knockOut.checkWinner` is boss-aware (total wipe → God wins). Bots converge on the God via branches in `botPlanMove` + the acting step (reading `engineRef.current.rockGod.god`). |
| `FAME POINTS` | 4051 | Fame award pipeline (`grantFame` also fires Stage Effect thresholds). 👑 Phase R5: `headlinerRider(spiritId)` returns +1 when the spirit holds the Headliner title; applied in `awardSonicFame`/`awardThrashFame`/`awardRiffFame` (NOT `grantFame`). Phase R6: `awardRiffFame(winnerId, loserId, battleS, tier)` — dedicated riff-off FP engine replacing `awardSonicFame` in `closeRiffOff`: base 2+ceil(margin/2), style pay +1/3 perfects, acoustic ×0.6/stadium ×1/R2 +2, loser consolation (quality ≥80% → 1 FP). |
| `FAN ECONOMY HELPERS` | 4117 | Per-turn fan logic. |
| `BATTLE KNOCKBACK` | 4294 | Knockback + Swing/Sonic attack. |
| `RIFF-OFF ENGINE` | ~6000 | Falling-notes (Guitar Hero) duel: `startRiffOff(attacker, defender, tier)`, `riffBeginTurn` (count-in), `riffStartRun` (schedules every note's hit-time + miss timers + Riff Slayer/E-Rush hooks), `riffPressKey` (judges presses by |press−hitTime|; fed by keyboard AND strike-zone taps), `riffResolve`, beam clash, `closeRiffOff`. 🎸 Phase R4: `initiateAcousticDuel(targetId)` — adjacency-only riff-off (no amp/beam), 2-turn pair cooldown in `acousticDuelCds`, `riffResolve` skips beam clash for acoustic tier (straight to `riff_result`, no Round 2). Bot policy falls back to acoustic when beam/cone unavailable. Timing/difficulty presets live in `riff/fallingNotes.js`; the highway UI is `ui/RiffHighway.jsx`, fed by `battleState.riffRun`. |
| `END TURN` | 5908 | Turn resolution, end-of-turn ticks. |
| `BOT …` | 6082 | AI turn step-machine + bot riff synthesis. |
| `KNOCK OUT` | 6809 | KO + respawn. |
| `HEX CLICK` | 6894 | Board-click handler. |
| `HEX VISUAL HELPERS` | 6978 | Hex color/glow/label computation. |
| `RUMBLE & DAMAGE FLOAT` | 7125 | Screen-shake + floating numbers. |
| `CAMERA ZOOM` | 7194 | Auto camera. |
| `MANUAL ZOOM/PAN` | 7251 | Player-driven zoom/pan. |
| `RENDER` | 7362 | The JSX tree (see Render Layout below). |

---

## Render layout (inside `Game`, ~line 7362 → end)

The render is a **three-column grid**: left HUD · center board · right header.

### Board overlays (positioned inside the board container)

| Overlay | Position | Purpose |
|---------|----------|---------|
| **Commit Track** | `top:4, centered` | Horizontal 8-slot melody line (left→right). |
| **Chord Stack** | `left:4, top:50` | Vertical 5-slot chord display (top→bottom). Shows Drive/Sustain, revoice toggle. Notes fly in from Note Stock. |
| **Voicing Panel** | `left:4, bottom:8/28` | Toggle button + tone faders (GAIN/TONE/ECHO/VERB + voice cycle). |
| **Note Scale Tip** | fixed, on hover | Tooltip showing a note's major/minor scales. |
| **Fly Note chips** | fixed | Animated hex chips flying from Note Stock to Commit Track or Chord Stack. |

### Left HUD column

The Note Stock grid, scale-peek/chord-preview panel, commit/clear buttons,
transpose/overdrive/banked-note banners, and the Step 2 chord editing UI
(shown during the `chord` turn step with inline note stock + Drive/Sustain
preview arrows).

---

## Extracted modules

### `audio/` — sound

| File | Exports | Purpose |
|------|---------|---------|
| `bgm.js` | `BGM_TRACKS`, `nextBgmTrack` | BGM track imports, shuffle queue, next-track picker. |
| `riffSfx.js` | `getRiffAudio`, `riffDegreeFreq`, `playRiffWrong`, `pickGlitchRiffNote`, `playRiffMiss`, `playBeamClash`, `playBeamSurge`, `playBeamBreak`, `playFanPop` | All riff-off Web-Audio SFX. |

### `board/` — geometry & map

| File | Exports | Purpose |
|------|---------|---------|
| `constants.js` | `HEX_SIZE`, `SCALE`, `SVG_W`, `SVG_H` | Board image dimensions. |
| `hexMap.js` | `HEX_BY_NUM`, `HEX_BY_QR`, `ALL_HEXES` | The 111-hex column layout + edge set. |
| `hexGeometry.js` | `pointyCorners`, `fanGesture`, `axialDist`, `axialNeighbors`, `facingAngle`, `getFlatTopNeighborSlots`, `angleTo`, `angleDiff`, `neighborInDirection` | Pure hex math. |
| `boardHelpers.js` | `cornerFacing`, `advanceTurnQueue`, `makeBoardToken`, `hexRingFromCenter`, `crowdMultiplier`, `advanceHC` | Board utility functions. |
| `stageFx.js` | `smokeHexNums`, `hexInSmoke`, `rollLaserBeams`, `hexInBeams`, `rollPyroHexes`, `spawnAnimatronics`, `animatronicStep` | 🎇 Stage Effects geometry: smoke rings, diagonal laser lines (constant r / constant s axes), pyro rolls, animatronic chase-step. Phase 6b: the rollers take an injectable `rand` (engine passes its seeded rng); `spawnAnimatronics` takes a `keyBase` for deterministic keys. |
| `rockGodFx.js` | `hexesWithin`, `slideLine`, `shoveAwayHex`, `nearestSpiritTo`, `freeNeighborHex` | 🤘 Rock God boss geometry: AoE rings, Power Slide line, Mosh shove, spawn displacement. |

### `data/` — pure game data

| File | Exports | Purpose |
|------|---------|---------|
| `spirits.js` | `SPIRIT_DEFS`, `SPIRIT_OPTIONS` | Per-character stats. **Change character balance here.** |
| `styles.js` | `STYLE_DEFS`, `styleOf`, `styleDef` | 🎵 The STYLE system (replaces STANCE — `STYLE_SYSTEM_HANDOFF.md`): three Styles (Shred/Groove/Flair) that dictate how each Spirit earns Db from melody commits. No abilities, no passives, no stat mods. **Change style definitions here.** |
| `corners.js` | `CORNERS`, `CORNER_LABELS`, `CORNERS_ORDER` | Home hexes per corner. |
| `events.js` | `EVENT_DECK`, `EVENT_BY_ID` | The 10 event-space definitions. |
| `gameConstants.js` | 96 named constants | All gameplay tuning: `HC_UPGRADE_THRESHOLD`, `FAME_TO_WIN`, `LIMELIGHT_*`, `FAN_*`, `TOKEN_MAX`, `RIG_*`, etc. **Change balance numbers here.** ⚠️ `AMP_RANGE` and `AMP_LINK_DIST` were listed here until 2026-08-21; both died with the amp-rig graph. |
| `trivia.js` | `TRIVIA_QUESTIONS`, `TRIVIA_REWARD`, `TRIVIA_BOT_ODDS` | Trivia event question bank. |
| `stageEffects.js` | `STAGE_FX_THRESHOLDS`, `STAGE_FX_META`, `shuffledStageFxDeck`, `SMOKE_*`, `LASER_*`, `PYRO_*`, `ANIMATRONIC_*` | 🎇 Stage Effects meta + tuning. Fired once each at ⭐8/16/24 (any Spirit crossing), drawn from a per-game shuffled deck — no repeats. **Change Stage Effect balance here.** |
| `rockGods.js` | `ROCK_GODS`, `ROCK_GOD_*` tuning, `pickRockGod`, `pickGodAttack`, `godTauntLine` | 🤘 The endgame boss pantheon (Bardbarian live; Feedback Warlock / Sonic Sorceress / Glam Reaper stubbed, fall back to Bardbarian). God chosen from the leader's playstyle. **Change boss balance, attack decks, and taunts here.** |

### `music/` — the music rules

| File | Exports | Purpose |
|------|---------|---------|
| `notes.js` | `NOTE_POOL`, `ENHARMONIC_RESPELL`, `canonicalRoot`, `getSpelledPool`, `pitchIndex`, `semitonesUpSpelled`, `buildScale`, `semitonesUp`, `getIntervalNotes`, `getFourthFifth`, `playableScale` | Note theory, scale spelling, interval helpers. |
| `cadence.js` | `CADENCE_OBJECTIVES`, `cadenceHints`, `detectCadence`, scoring fns | Cadence goals + note-track scoring pipeline. |
| `chords.js` | `evaluateChord`, `CHORD_TEMPLATES` | Chord → Drive/Sustain mapping. |

### `riff/` — riff generation

| File | Exports | Purpose |
|------|---------|---------|
| `riffGeneration.js` | `generateRiffRhythm`, `speedUpRiffRhythm`, `RIFF_CONTOUR_LABELS`, `RIFF_ANSWER_LABELS`, `riffDegreesToNotes`, `generateAttackerRiff`, `generateDefenderRiff`, `RIFF_LEN_DEFAULT` | Riff-off note sequence generation. Generators take an optional `rand` (default `Math.random`) and `len` (default `RIFF_LEN_DEFAULT=6`) — the engine passes its seeded rng; only the engine should generate riffs now. |
| `melodyRiff.js` | `melodyToRiff` | 🎸 Phase R1: converts a committed melody line (NOTE_POOL format) into a riff-off riff. Maps notes → degrees/sharps, detects contour, pads/trims to target length, applies generated rhythm. Returns same shape as `generateAttackerRiff` + `fromMelody` flag. Returns `null` when melody < 4 notes (minimum-material rule). |
| `fallingNotes.js` | `RIFF_FALL_DIFFICULTY`, `RIFF_FALL_DEFAULT`, `buildRiffTimeline`, `riffOkWindow`, `gradeRiffOffset` | Falling-notes (Guitar Hero) riff-off timing: difficulty presets (fall lead-time + grade windows), rhythm→hit-time timeline, |press−hitTime| grading. Pure module — **tune riff-off feel here.** 🎸 Phase R2: each preset now carries `showLabels: boolean` (labels hidden at Shredder+) and `maxLen: number` (tier-caps riff length). VIRTUOSO tier added (`leadTime:1150`, `maxLen:15`, `showLabels:false`). ROOKIE label renamed to SOCIAL MEDIA INFLUENCER (internal id unchanged). |
| `guitarMap.js` | `voiceRiff`, `degreePitch`, `pitchKey`, `cellKey`, `positionsForPitch`, `nearestPositionForKey`, `STRING_NAMES`, `STRING_OPENS`, `MAX_FRET`, `WINDOW`, `NECK_MAX_PITCH` | 🎸 Full-neck guitar map (Rocksmith pass): 6 strings, frets 0–12, deterministic position-anchored riff voicing — phrases sit in 4–5 fret windows that follow the register up/down the neck. Pitch space aligned with `riffDegreeFreq` (degree 0 = open A). Pure module, no RNG. Wired into `startRiffOff` (voicing attached to riff data), `riffStartRun` (pos on each run note, anchors on the run), `RiffHighway.jsx` (string-colored gems, fret glyphs, scrolling camera, fret-cell taps), and `renderInstrument` (board decorative neck). Test: `node src/riff/guitarMap.test.mjs` (750-riff corpus; re-run after touching this file, `riffGeneration.js`, or `melodyRiff.js`). |

### `engine/` — the authoritative game core (in extraction)

| File | Exports | Purpose |
|------|---------|---------|
| `rng.js` | `makeRng`, `restoreRng`, `hashSeed` | Seeded mulberry32 PRNG, serializable as `{seed, cursor}`; `fork(label)` per subsystem. Game rules must draw from this, never `Math.random()`. |
| `state.js` | `makeInitialState` | Lobby config → plain-JSON `GameState`. Slices still `null` are React-owned until their phase lands. |
| `actions.js` | `GAME_INIT`, creators | Serializable action types; grows per phase. |
| `reduce.js` | `applyAction` | `(state, action, rng) → state`, the one door for rule changes; persists rng position into the returned state. |
| `serialize.js` | `snapshot`, `restore`, `replay` | Save/load + action-log replay (determinism proof). |
| `systems/turn.js` | `applyTurnStarted/Ended/Skipped`, `applyMoveBudgetSet`, `applyBeatsSpent`, `applySpiritEliminated`, `applySpiritsSynced` | 🎯 Phase 2: turn queue, beats/AP, limelight-start flags, turn/round counters. `TURN_ENDED` returns a `lastReport` the client uses to run not-yet-extracted ticks. |
| `systems/movement.js` | `applyMoveStep`, `applySpiritFaced`, `applySpiritWarped` | 🎯 Phase 2: movement + facing rules incl. the dazed 33% redirect (engine rng). |
| `systems/combat.js` | `marginToDamage`, `fameFromMargin`, `knockbackSpaces`, `underdogBonus`, `smashOutcome`, `decideWinner`, `resolveKnockdown`, `counterOutcome`, `applyAttackRolled`, `applyCounterRolled` | 🥊 Phase 3a: the pure combat MATH (damage/knockback/Fame tables + underdog ramp) — `Game` imports these (single source, like `riffStats`); `underdogBonus` takes the two resolved Fame totals so it stays pure. 🥊 Phase 3b: `applyAttackRolled` — `ATTACK_ROLLED` rolls the SWING dice on engine rng and stores the verdict in `state.battle` (`{kind:'attack', attackKind:'swing', atkRoll, defRoll, atkTotal, defTotal, attackerWon, margin, damage, psychoBushido}`). The client passes pre-computed `atkStat`/`defStat` + mod flags (posing/halveDef/psychoEligible — they read `noteStates`, Phase 5); the spin overlay displays the decided face. Sonic uses the same action with an optional `dicePool` (keep-highest, amp-scaled — records `diceVals`/`keptIdx`). The Smash has NO roll — `smashOutcome(thrown, {roninSmasher, roninTarget}) → {damage, knockback, scatterN}` is pure deterministic math (like the 3a tables), shared by `resolveSmash` and `resolveBlasterOfRa`. 🏆 Phase 3c (kernels): `decideWinner(spirits, {godSummoned, attackerId, hasWinner})` (boss-aware win check, from `knockOut.checkWinner`) and `resolveKnockdown(spirit, corners)` (respawn-to-home / KO transform, shared by `knockOut` + `applyVibeDamage`). Pure, wired single-source; the cinematics/state-application stay client. The full spirit-ownership flip (DAMAGE_APPLIED/KNOCKED_OUT actions, killing `spiritsSynced`) is the remaining 3c work. 🥊 Phase 3d (retaliation): `applyCounterRolled` (COUNTER_ROLLED — counter d6 + Vibe bonus + success vs the attacker's die, on engine rng, merged into `battle`) and pure `counterOutcome(total, target)` (landed-counter margin/damage). Wired into `resolveRetaliation`/`finishCounter`; the prompt→spin→result phases, countdown timer, and damage application stay client. |
| `systems/riffOff.js` | `applyRiffOffStarted/ResultsSubmitted/Resolved/Round2Started/Closed`, `riffStats`, `RIFF_GRADE_WEIGHT/MARGIN_SCALE/TIE_EPS` | 🎸 Phase 4: riff data + verdict. Generates riffs/glitches/ghosts on engine rng; clients submit results arrays; verdict math incl. Round-2 fallback. `Game` imports `riffStats` from here (single source of truth). 🎸 Phase 3e: the verdict now carries `damage` (`tie?0:marginToDamage(margin+round2bonus)`, imported from `systems/combat.js`) so the client reads it instead of re-deriving — one source, no drift. Damage *application* still client until the 3c ownership flip. |
| `systems/economy.js` | `usedHas/usedList/usedAdd`, `performanceScore`, `makeInitialNoteState`, `applyNoteStatesSynced`, `applyFameChanged`, `applyFansChanged` (+`FAN_FIELDS`), `applyNoteSheetPatched`, `applyFansTicked`, `applyHeadlinerChanged` | 💰 Phase 5a: `usedStockIdx` Set→array helpers + the pure Performance-Score-P kernel. Phase 5c: the engine BUILDS + OWNS `noteStates` (seeded `"noteStatesInit"` fork; single-source `makeInitialNoteState`), and the semantic write layer: `FAME_CHANGED` (signed delta, floored at 0), `FANS_CHANGED` (whitelisted fan-field patch — `FAN_FIELDS` guards fame/skills/notes), `NOTE_SHEET_PATCHED` (the shim's generic per-spirit diff action). Phase 5d: `FANS_TICKED` — the end-of-turn fan tick as an engine RULE (zone derived from the engine's spirit position; boredom/lag/streaks; client report in `turn.lastFanTick`). 👑 Phase R5: `HEADLINER_CHANGED` sets `state.headliner` (spiritId or null); `makeInitialState` inits to null. |
| `systems/skills.js` | `skillEligibility`, `ULTIMATE_PREREQS`, `THEORY_DISCORD_GRANTS` | 🎓 Phase 5b: pure skill-tree gating + grant tables — `botSkillEligible` and `setSkillTarget` share ONE gate. |
| `systems/stageFx.js` | `applyStageFxDrawn`, `applyStageFxActivated`, `applyStageFxTurnTicked`, `applyStageFxRoundTicked` | 🎇 Phase 6b (FULL): `state.stageFx { deck, fired, smoke, laser, pyro, animatronics, lastDraw, lastActivation, lastTurnTick, lastRoundTick }` — deck seeded ONCE at init (`"stageFxDeck"` fork); `STAGE_FX_DRAWN` fires each threshold exactly-once; `STAGE_FX_ACTIVATED` creates the live effect (patterns/spawns on engine rng; deterministic animatronic keys); the TURN tick (pyro cadence + animatronic steps) and ROUND tick (smoke spread, laser re-pattern) are engine rules. Client renders the slices + plays cinematics/damage off the reports. |
| `systems/rockGod.js` | `applyGodAttackPicked`, `applyGodSummoned`, `applyGodDamaged`, `applyGodActed`, `applyGodDefeated`, `applyGodTriumphed`, `applyGodTimerExpired` | 🤘 Phase 6c (FULL): `state.rockGod { summoned, god, outcome, lastPick, lastHit, lastAct, lastTimerExpiry }` — the boss IS engine state. `GOD_DAMAGED` owns the winded ×2 + HP floor; `GOD_ACTED` is the whole end-of-turn answer (telegraph resolve / winded recovery / weighted engine-rng open; mosh shoves move engine spirits). Boss clock stays client; expiry dispatches `GOD_TIMER_EXPIRED`. |
| `selftest.mjs` | — | Headless test: `node src/engine/selftest.mjs`. Extend each phase. |

**Phase 2 state ownership:** the engine owns `turnQueue`, `turn.{count, moveStepsLeft, actionTokenUsed, startedOnLimelight}`, and movement/facing *rules*. `Game` reads them via derived consts (`const moveStepsLeft = engineState.turn.moveStepsLeft`) and mutates them ONLY via `dispatch(...)`. React still owns the `spirits` array (combat writes vibe/KO/knockback); `dispatch(spiritsSynced(spirits))` bridges positions into the engine before `move`/`endTurn`/skip — the bridge dies in Phase 3.

### `tutorial/`

| File | Exports | Purpose |
|------|---------|---------|
| `content.jsx` | `Tutorial` | The full illustrated tutorial overlay. Self-contained. |

### `hooks/` — state slices

Each hook owns a cohesive group of `useState` and returns values + setters.
They are pure state containers sharing `Game`'s component instance.

| Hook | Owns |
|------|------|
| `useRiffState.js` | Riffbook discoveries, riff/cadence toasts, riffbook + signature UI. |
| `useFanEconomy.js` | Limelight scores, posing, "Unsure" crowd, fan reactions, spotlight hex. |
| `useBgmState.js` | `<audio>` ref, track index, mute/volume/track state. |
| `useBoardState.js` | Amps, board cards + respawn counter, pending pickup, roadie actions. |
| `useTransientFx.js` | Knockback slides, respawn flashes, rumble, floating damage, status VFX. |
| `useStageEffects.js` | 🎇 Stage Effects slice — Phase 6b flip: ONLY the activation banner remains; deck/fired/active effects live in `engineState.stageFx`. |
| `useRockGod.js` | 🤘 Rock God slice — Phase 6c flip: ONLY the boss turn-clock + descent banner remain; god/outcome/summoned live in `engineState.rockGod` (ref mirrors dissolved). |

### `ui/` — presentational components

Each takes everything via props. They hold **no game logic**.

| Component | Purpose |
|-----------|---------|
| `GameStyles.jsx` | Global `<style>` block (CSS keyframes/classes, `.note-fly-chip` animation). No props. |
| `GameOverOverlay.jsx` | End-of-game victory screen. |
| `CadenceToast.jsx` | "Cadence resolved" toast. |
| `BattleMeterOverlay.jsx` | Full battle/riff-off duel overlay (~1,870 lines, largest component). |
| `RiffHighway.jsx` | Falling-notes highway for the riff-off: gems fall down neon lanes onto a scaled, tappable piano/guitar strike zone. Gem motion is a rAF loop writing transforms from the engine clock each frame — NOT CSS animations (React re-renders rewrite a running animation's delay without restarting it, which teleports gems; see file header). Renders `battleState.riffRun`; presses route to `Game.riffPressKey`. 🎸 Phase R2: accepts `showLabels` prop — when `false`, `noteGlyph` text is suppressed; sharps render as diamond-shaped gems (`rotate(45deg)`, `borderRadius:3px`), naturals stay round. Diamond shape preserved through burst animations. 🎸 Phase R3 (neon pass): outrun/synthwave visual overhaul — piano keys are transparent with cyan outlines + magenta-filled blacks; guitar strings glow cyan→magenta with violet inlay dots; highway has a scrolling perspective grid and sunset-gradient strike line (orange→magenta); gems are neon-outlined with trailing tails (CSS `::before` using `--gem-color` variable); judgment bursts: perfect=white-hot, good=cyan, ok=violet, miss=gray tumble. Palette constants: `NEON_CYAN`, `NEON_MAGENTA`, `NEON_VIOLET`, `NEON_ORANGE`, `NEON_WHITE`. Board-side `renderInstrument` mirrors the same neon treatment for visual consistency. |
| `Riffbook.jsx` | Discovery codex / cadence list. |
| `EventModal.jsx` | Event-space marquee ticket. |
| `UpgradeModal.jsx` | Harmonic-charge upgrade picker. |
| `SignatureAbilities.jsx` | Per-spirit signature-route reference. |
| `TestingGrounds.jsx` | In-game dev panel. |
| `Lobby.jsx` | Player/mode select screen. |
| `BoardFX.jsx` | Board star/lightning overlay layer. |
| `VoiceRollDie.jsx` | Animated d6 for Mic skill. |
| `NeonStrikeFX.jsx` | HUD neon glow borders + `NEON_STRIKE_PALETTE`. |
| `ScoreTrackOverlay.jsx` | Score-track life indicator + `SCORE_TRACK_CORNERS`. |
| `StatKnob.jsx` | Read-only stat gauge. |
| `ToneFader.jsx` | Vertical mixer fader (GAIN/TONE/ECHO/VERB). |
| `GameErrorBoundary.jsx` | Error boundary + `isMirrorFacing`, `MIRROR_SPRITES`, `mobileColorStyle`. |
| `StageFXLayer.jsx` | 🎇 `StageFXBoardLayer` (SVG: smoke cloud, laser beams, pyro glow/flames, animatronic tokens — mounted late in the board svg so smoke covers standees) + `StageFXBanner` (HTML activation marquee + active-effect status pills). |
| `RockGodLayer.jsx` | 🤘 `RockGodBoardLayer` (SVG: telegraph hexes, god standee/aura/HP bar, winded marker) + `RockGodHUD` (descent marquee, HP/clock/telegraph pills) + `GodVictoryOverlay` (total-wipe game over). |

---

## "Where do I change X?"

| I want to change… | Go to |
|---|---|
| Combat damage / knockback / Fame tables (margin→dmg, underdog ramp) | `engine/systems/combat.js` (Phase 3a — single source; `Game` imports them) |
| Character stats / balance | `data/spirits.js` |
| Gameplay tuning constants (fan caps, amp range, fame target, etc.) | `data/gameConstants.js` |
| Win conditions (fame target, limelight turns) | `data/gameConstants.js` → `FAME_TO_WIN`, `LIMELIGHT_TO_WIN` |
| ✨ Limelight / Strike a Pose economy (payout ramp, Sustain cost) | `data/gameConstants.js` → `POSE_FP_STEP` / `POSE_FP_MAX` / `POSE_SUSTAIN_COST` + `Game.togglePose` + `Game.poseTierFor` (the ONE place the next-round payout is computed) + the faucet in `Game.endTurn`. Standing on hex 56 pays nothing; only a pose does, and only on a `report.limelightHeld` turn. `LIMELIGHT_FAME` is legacy and no longer granted. |
| 🔒 Which Riff Mode rooms are open to playtesters | `ui/RiffMenu.jsx` → `RIFF_MODES_UNLOCKED` (a Set of item ids; `null` disables the gate entirely) |
| 🎨 Board colour schemes (Stage Skins) | `board/stageSkins.js` → `STAGE_SKINS`. Plate = CSS `hue-rotate` (angles are MEASURED against the real art — see the file header before adding one), outline = `feColorMatrix` luminance→exact colour. Purely local + cosmetic; deliberately NOT engine state, so players in one match can run different skins. |
| 🗺️ Fretboard Recon levels / Live Set length / rank thresholds | `ui/FretboardRecon.jsx` → `TIER_CONFIG`, `LIVE_SET_LENGTH`, `RANKS`, `scoreSet()`, `recommendFor()`. ⚠️ The level NEVER changes mid-run — the old streak promote/fumble demote is cut on purpose (header explains why). Recommendations are advisory only. |
| 👂 Ear Spy — mic sensitivity / what counts as "music" vs room noise | `audio/chroma.js` → `GATE_DEFAULTS`. ⚠️ Every threshold is MEASURED, not guessed — `npm run test:chroma` prints the table it came from and asserts the separation still holds. See `EAR_SPY_HANDOFF.md` §2. |
| 👂 Ear Spy — chord/key/scale detection, fret placement, riff verdict | `music/keyDetect.js` (key + palette), `music/neckPlacement.js` (notes → frets, trail, usage), `music/riffAnalysis.js` (post-phrase). The deliberate-discord judgement is `music/spice.js`, SHARED with Discord Coach — changing it changes both. `EAR_SPY_HANDOFF.md` §3 lists the bugs each ⚠️ comment guards. |
| 👂 Ear Spy Online — send rate, wire shape, turn-taking | `net/riffWire.js` → `WIRE_DEFAULTS` + `net/earSpyLink.js` + `server/index.js` → `case "RIFF"` / `case "FLOOR"`. ⚠️ The server closes sockets over 30 msg/s; the 8 Hz coalescing throttle is what stops streaming from disconnecting players. |
| Scales, note spelling, intervals | `music/notes.js` |
| Cadence objectives | `music/cadence.js` → `CADENCE_OBJECTIVES` |
| Melody-line scoring numbers | `music/cadence.js` (scoring fns) + `Game.confirmNoteTrack` |
| Dissonance Edge (stage costs/payouts, Drive/Sustain deltas) | `data/gameConstants.js` → `EDGE_*` + `Game.confirmNoteTrack` (start/escalate/resolve/collapse) + `Game.edgeCombatMods` (combat read) + `Game.clearBattleBuffs` (burn-on-battle) (see `DESIGN_AUDIT_v2.md` §9) |
| Chord → Drive/Sustain table | `music/chords.js` → `CHORD_TEMPLATES` / `evaluateChord` |
| Riff-off generation (contours, rhythms) | `riff/riffGeneration.js` |
| Riff-off timing feel (fall speed, difficulty presets, grade windows, note spacing) | `riff/fallingNotes.js` |
| Riff-off input/judging engine (falling run, miss timers, Riff Slayer lurch, E-Rush ghosts) | `RIFF-OFF ENGINE` banner in `Game` (`riffStartRun` / `riffPressKey`) |
| Riff-off highway visuals (gems, strike zone, bursts) | `ui/RiffHighway.jsx` — Rocksmith pass: string-colored gems, fret-number glyphs, scrolling 13-fret neck, fret-cell taps (GPOS deleted) |
| Riff-off SFX (synth sounds) | `audio/riffSfx.js` |
| BGM tracks | `audio/bgm.js` |
| Fan-economy tuning | `data/gameConstants.js` → `FAN_*` constants |
| Amp range / chaining | `data/gameConstants.js` → `AMP_RANGE`, `AMP_LINK_DIST` |
| Skill tree / upgrades | `SKILL_TREE`, `DISCORD_UPGRADE_TIERS` (main file, module-level) |
| 🎵 Styles (earning lanes: Shred runs / Groove patterns / Flair flavors) | `data/styles.js` (`STYLE_DEFS`, `styleOf`, `styleDef`); `music/cadence.js` (detectors: `detectStyleRun`, `detectContourTurn`, `detectCellRepeat`, `detectResolvedDiscords`); `engine/systems/economy.js` (`styleCommitDb`); `engine/systems/combat.js` (`chordFrayAmount`); see `STYLE_SYSTEM_HANDOFF.md` for the full spec |
| 🎇 Stage Effects (thresholds, damage, durations) | `data/stageEffects.js` (tuning) + `STAGE EFFECTS SYSTEM` in `Game` (logic) + `board/stageFx.js` (geometry) + `ui/StageFXLayer.jsx` (visuals). NOTE: the old skill-based stage effects (laser_show/stage_light/fog_machine/pyrotechnics) are RETIRED — `getBattleSkillMods` now returns permanently-false flags so downstream battle/overlay code stays inert. |
| ⏱️ What ticks per TURN vs per ROUND | `engine/systems/turn.js` (`rollRound`, the anchor) + `Game.endTurn`'s `report.roundCompleted` block — see "The round clock" below |
| 🎸💥 The Smash (cost + payout) | `data/gameConstants.js` → `SMASH_*` + `Game.resolveSmash`. Flat 2/2/2 for your whole Drive stack; `smashOutcome` in `engine/systems/combat.js` is now Blaster-of-Ra-only |
| 🎸 Cursed Shamisen (minor-key haunt) | `Game.resolveCursedShamisen` / `tickCursedShamisen` / `shamisenWanderStep` (`SHAM_RINGS`, `SHAM_ROUNDS`) — ticks once per ROUND, only touches Spirits whose `scaleMode` is `'minor'` |
| 🤘 Rock God boss (trigger margin, HP, timer, attacks, taunts) | `data/rockGods.js` (all tuning — incl. `ROCK_GOD_DIFFICULTY`, the wall-clock pace) + `ROCK GOD SYSTEM` in `Game` (engine) + `board/rockGodFx.js` (geometry) + `ui/RockGodLayer.jsx` (visuals). New gods: add a full def to `ROCK_GODS`, list it in `ROCK_GOD_IMPLEMENTED`, and extend `applyGodActed` (engine/systems/rockGod.js) + the `rockGodAct` report renderer with its attack ids. |
| Event spaces | `data/events.js` + `EVENT SPACES SYSTEM` in `Game` |
| Trivia questions | `data/trivia.js` |
| Riff-off feel (length, timing window) | `RIFF_LEN`, `RIFF_NOTE_WINDOW` (main file, module-level) |
| Board overlay: Commit Track | Main file, `RENDER` banner → search `COMMIT TRACK` |
| Board overlay: Chord Stack | Main file, `RENDER` banner → search `CHORD STACK` |
| Board overlay: Voicing Panel | Main file, `RENDER` banner → search `FLOATING VOICING PANEL` |
| A specific overlay/modal's look | The matching file in `ui/` |
| Tutorial content | `tutorial/content.jsx` |
| Board map / hex layout | `board/hexMap.js`, `board/constants.js` |
| CSS keyframes / global styles | `ui/GameStyles.jsx` |

---

## 🎵 The Style system (2026-07-28) — what changed where

**See `STYLE_SYSTEM_HANDOFF.md` for the full spec.** The nine stance abilities are preserved in `STANCE_PARTS_BIN.md` as menu options for the upcoming Spirit redraw.

In short:
- **Stances are cut completely** from `data/`, skills, and UI.
- **Styles are fixed per Spirit**, read directly from `SPIRIT_DEFS[id].style`. Three styles: **Shred** (long directional runs — earn Db), **Groove** (repetition — earn Db), **Flair** (resolved discords — earn Db). No abilities, no passives, no stat mods.
- **Db payout** happens once per melody commit in `confirmNoteTrack` via `styleCommitDb()`, on top of existing scoring. Tiers 1–3 based on pattern length, +1 signature bonus (contour turn / root resolution / chromatic approach).
- **New detectors** in `music/cadence.js`: `detectStyleRun`, `detectContourTurn`, `detectCellRepeat`, `detectResolvedDiscords` — pure, unit-tested.
- **Chord fray** moved to `engine/systems/combat.js` as `chordFrayAmount` (pure margin math, stance-neutral).
- **Action bar** restored to three buttons: Swing (1 AP) / Sonic (2 AP) / Smash (2 AP). All stance skill routes, `requiresStance` / `stancesKnown` gating, `Game.switchStance`, and the Groove counter are gone.

## ⏱️ The round clock (2026-08-05) — what "a turn" means now

A **TURN** is one player acting. A **ROUND** is one full revolution of the turn
order. Shared board state runs on the ROUND; personal state runs on the TURN.
The rule of thumb: *if it can hurt or help someone who isn't acting, it waits
for the round.*

- **Round detection lives in `engine/systems/turn.js`** (`rollRound`) and is
  anchored, not counted: `turn.roundStarterId` is whoever opened the revolution,
  and the round closes when play comes back to them. The old
  `count % aliveCount` drifted on every knockout and every skipped turn.
  `turn.round` is the round counter; `turn.roundPending` banks a round that a
  SKIPPED turn closed (skips run no ticks, so the next real turn end spends it);
  eliminating the anchor closes the round and re-anchors on the next actor.
- **On the ROUND clock** (`endTurn`'s `report.roundCompleted` block): stage FX
  (smoke, lasers, pyro arm→erupt, animatronic steps), spotlight move, Lost Chord
  scatter + drift, Disco Inferno decay, marquee respawn, charge-zone cooldowns,
  board-card respawn, the Cursed Shamisen.
- **Still on the TURN clock** (the acting Spirit's own end of turn): debuff
  ticks, Burn, the fan economy, the spotlight heal, poison-slime decay (seeded
  with the living-Spirit count, so it already means "one revolution").
- **Durations were RESTATED, not just relabelled** — see the ⏱️ comments in
  `data/stageEffects.js` and `data/gameConstants.js`. e.g. animatronics 5
  player-turns → 2 rounds, pyro 3 waves → 2.
- **The Rock God is the deliberate exception.** He is not board weather: he acts
  on WALL-CLOCK time (`ROCK_GOD_DIFFICULTY.actSeconds`, set from the lobby dial
  and carried in the game config so a room agrees), driven only by the client
  that controls the acting Spirit. Dawdle and he swings again.

**Hazards never start on a player.** Laser beams and pyro charges are rolled
around occupied hexes (`rollLaserBeams(count, rng, avoidNums)` /
`rollPyroHexes(count, excludeNums, rng)`), and nothing deals damage at
roll time — the activation/re-pattern "zap" is gone. Hazards bite on ENTRY
only, via `checkStageFxHex`, which fires on a step OR a knockback: walking in
costs you, and shoving a rival onto a live beam still works.

## Conventions

- **Navigate by banner comments, not line numbers** — lines shift with every edit.
- **`Game` is still a "God component."** It holds most state, all system logic, async-combat refs, and the left/center render columns. The `hooks/` and `ui/` files are the seams; further reduction means moving *logic* (effects/handlers) into hooks.
- **Filename case:** `App.jsx` imports `./rlsw-simulator-V3_8_1` while the file is lowercase `v3_8_1`. Line 7 imports `./groupie_fans.png` for a file named `.PNG`. Both work on case-insensitive filesystems but would break on Linux.
- **No behavior was changed during extraction** — every module was moved verbatim with imports/exports wired and verified.
- **Keep this file updated** — if you add a file, move a section, or create a new board overlay, update this doc before ending your session.
