# RLSW Simulator — Architecture

This document describes the project **as the files actually exist today**. The game began as a single ~15,700-line React file and has been progressively split into focused modules, presentational components, and state hooks. One large component (`Game`) still holds most of the game logic; everything around it has been pulled into small, editable files.

> **Line numbers drift.** Where a location inside the big file is given, treat it as approximate and navigate by the **section banner comments** (`// ─── NAME ───`), which are the real landmarks.

---

## Boot flow / entry points

```
index.html
  └─ main.jsx            React root, StrictMode, imports index.css
       └─ App.jsx        thin wrapper, renders <RLSWSimulator/>
            └─ rlsw-simulator-v3_8_1.jsx
                 ├─ RLSWSimulator()   app shell: shows Lobby → Tutorial → Game
                 └─ Game()            the actual gameplay component
```

- **`main.jsx`** — Vite entry. Mounts `<App/>` into `#root`.
- **`App.jsx`** — one-liner that renders `RLSWSimulator`.
- **`rlsw-simulator-v3_8_1.jsx`** — the heart of the project. Holds the default export `RLSWSimulator` (the lobby/tutorial/game router) and the `Game` component plus all the gameplay logic that hasn't been extracted yet.

---

## Directory map

| Path | What lives here |
|------|-----------------|
| `rlsw-simulator-v3_8_1.jsx` | Main file (~10,700 lines): module-level data/constants/helpers/components, the `RLSWSimulator` app shell, and the `Game` component with the bulk of game logic. |
| `App.jsx`, `main.jsx` | Vite/React entry wiring. |
| `data/` | Pure game data with no logic. `spirits.js`, `corners.js`. |
| `board/` | Board geometry & the 111-hex map. `constants.js`, `hexMap.js`, `hexGeometry.js`. |
| `music/` | Music theory + scoring (the "rules" of notes, riffs, cadences). `notes.js`, `riffLibrary.js`, `cadence.js`. |
| `tutorial/` | The illustrated in-game tutorial UI. `content.jsx`. |
| `ui/` | Presentational React components extracted from `Game`'s render (overlays, modals, panels). 14 files. |
| `hooks/` | Custom React hooks that own a slice of `Game`'s state. 6 files. |
| `standees/` | Character standee PNGs (normal + `_mirror`). |
| `bgm/`, `sfx/` | Background-music tracks and sound effects. |
| `assets/`, `*.png`, `*.css` | Board images, card art, crowd art, global CSS (`index.css`, `App.css`). |

---

## The main file, layer by layer

`rlsw-simulator-v3_8_1.jsx` is organized top-to-bottom in three layers. Navigate by the banner comments.

### 1. Imports + module-level code (top of file → `─── APP ───`)

Asset imports and re-imports from the extracted modules sit at the top (lines ~1–40), with a few module imports placed further down next to where the code used to live (the `music/` imports are around the `NOTE SYSTEM` / `RIFF LIBRARY` / `CADENCE` banners). Also at module level (outside `Game`):

- **Board logic still in main:** `AMP RIGS` (`ampLinked`, `ampMstEdges`, `computeAmpRigs`), `cornerFacing`, and `fanPawnShape` (a JSX crowd-pawn renderer that wasn't moved because it returns markup).
- **Standalone components:** `Lobby` (player/mode select), `BoardFX`, `VoiceRollDie`, `NeonStrikeFX` (HUD neon glow), `ScoreTrackOverlay`, `AmpKnob` (rotary tone knob).
- **Tunable game constants & tables** (this is where most balance/content lives that hasn't moved to `data/`):
  - `HC_UPGRADE_THRESHOLD` (harmonic-charge cost) · `AMP_RANGE`, `AMP_LINK_DIST`, `AMP_UNPLUG_DIST`
  - `LIMELIGHT_HEX`, `LIMELIGHT_TO_WIN`, `FAME_TO_WIN` (win conditions)
  - `SPARK_MAX`, `SPARKS_PER_FP`, `FAN_MULT_CAP`, `FAN_DIEHARD_CAP/START`, `FAN_CASUAL_CAP/START` (fan economy)
  - `SPOTLIGHT_POOL`, `EVENT_DECK` / `EVENT_BY_ID`, `BTTP_STAGES`, `SIGNATURE_TESTS`
  - `SWING_UPGRADE_TIERS`, `SWING_EFFECT_CHANCES`, `DISCORD_UPGRADE_TIERS`, `SKILL_TREE` / `SKILL_BY_ID`
  - `RIFF_LEN`, `RIFF_NOTE_WINDOW`, `RIFF_CONTOUR_LABELS` (riff-off timing/labels)
- **Riff-off audio:** `MIRROR SPRITES`, `RIFF-OFF` scoring, and the synthesized **RIFF AUDIO** / **BEAM-CLASH SFX** (Web Audio, no sample files).

### 2. `RLSWSimulator` (`─── APP ───`, ~line 1827)

The app shell / router. Holds top-level UI state (player count, assignments, starting lives, whether the tutorial is showing) and switches between `Lobby`, `Tutorial`, and `Game`.

### 3. `Game` (`─── GAME ───`, ~line 1846 → end)

The big component (~9,000 lines). Still contains the majority of the game's state, effects, system logic, and the giant render tree. Its internal sections (by banner) group the systems:

| Banner (inside `Game`) | Responsibility |
|---|---|
| `BATTLE STATE` | Core combat state + the many `useRef` mirrors used by async combat/bot callbacks. |
| `NOTE SYSTEM STATE` | `makeInitialNoteState()` — the per-spirit state shape (note track, harmonic charge, fame, fan sub-state). |
| `POINTS FLASH` / `EVENT SPACES STATE` / `FAME SPARKS` | Transient board state. |
| `BGM SETUP` | Background-music playback effects. |
| `DERIVED STATE` | Computed values (acting spirit, current scale, amps in range, etc.). |
| `NOTE SOUND` / `AMP KNOBS` | Web-Audio synth for note playback + player-tunable tone (`TONE_KNOB_DEFAULTS`, `TONE_VOICES`). |
| `RIFF PLAYBACK` / `NOTE TRACK FUNCTIONS` | `playRiffSequence`, and `confirmNoteTrack()` — the turn's note-track scoring pipeline (mixer, mode bonus, mic roll, riff detection, cadence check, interval effects, HC scoring). |
| `SKILL TREE …` / `CREW & GEAR` / `MODULATION CARDS` | Upgrade selection, deployables, mod cards. |
| `SWING EFFECTS` / `AMP UNPLUG` / `BOARD CARD SYSTEM` / `EVENT SPACES SYSTEM` | Per-system handlers. |
| `BACK TO THE PAST` / `TESTING GROUNDS` | Mini play-challenge engine + dev helpers. |
| `BATTLE SYSTEM` / `FAME POINTS` / `FAN ECONOMY HELPERS` / `BATTLE KNOCKBACK` / `SONIC ATTACK` / `RIFF-OFF ENGINE` / `BEAM CLASH` / `RETALIATION` | The full combat pipeline. |
| `END TURN` / `KNOCK OUT` | Turn resolution, end-of-turn ticks (burn, fan economy, spotlight, sparks), knockouts. |
| `BOT …` | AI turn step-machine and bot riff-off synthesis. |
| `HEX CLICK` / `HEX VISUAL HELPERS` / `RUMBLE & DAMAGE FLOAT` / `CAMERA ZOOM` / `MANUAL ZOOM/PAN` | Board interaction & camera. |
| `RENDER` (~line 7789 → end) | The JSX tree. Most overlays/modals/panels are now `<Component/>` calls into `ui/` (see below); the header, three-column grid wrapper, and the **LEFT** and **CENTER** (board) columns are still inline. |

---

## Extracted modules

### `data/` — pure data
- **`spirits.js`** — `SPIRIT_DEFS` (per-character stats: drive/sustain/speed/vibe/style + standee art) and `SPIRIT_OPTIONS`. **Change character balance here.**
- **`corners.js`** — `CORNERS` (home hexes), `CORNER_LABELS`, `CORNERS_ORDER`.

### `board/` — geometry & map
- **`constants.js`** — board image size, hex size, scale, spacing.
- **`hexMap.js`** — `buildHexMap()` and the resulting `HEX_BY_NUM` / `HEX_BY_QR` / `ALL_HEXES`; the 111-hex column layout and edge set.
- **`hexGeometry.js`** — pure math: `pointyCorners`, `axialDist`, `axialNeighbors`, `angleTo/angleDiff`, `getFlatTopNeighborSlots`, `neighborInDirection`, `facingAngle`, plus `fanGesture`/`FAN_GESTURES`.

### `music/` — the music rules
- **`notes.js`** — note theory: `NOTE_POOL`, pitch-class lookup, scale spelling (`getSpelledPool`, `buildScale`, `MAJOR/MINOR_SCALES`), and interval helpers (`getIntervalNotes`, `getFourthFifth`). **Change scales/spelling here.**
- **`riffLibrary.js`** — `RIFF_LIBRARY` (the legendary-riff table), genre metadata, and `detectRiff`. **Add/edit riffs here.**
- **`cadence.js`** — `CADENCE_OBJECTIVES` + `cadenceHints`/`detectCadence`, and the **note-track scoring functions** (`detectChromaticRun`, `detectDiatonicRun`, `detectSkipClimb`, `detectRepeatPattern`, `scoreTrackHC`, `randomNote`, `refillStock`, …). **Change scoring numbers and cadence goals here.**

### `tutorial/`
- **`content.jsx`** — the entire illustrated tutorial: mock components, all `TutSection_*` pages, the section registries, and the `Tutorial` overlay. Self-contained; only `Tutorial` is exported.

---

## `ui/` — presentational components

Each was lifted verbatim from `Game`'s render and takes everything it needs via props (the toasts import their data tables from `music/`). They hold **no game logic** — they render what `Game` passes down.

| Component | Screen |
|---|---|
| `GameStyles.jsx` | Global `<style>` block (CSS keyframes/classes). No props. |
| `GameOverOverlay.jsx` | End-of-game victory screen. |
| `RiffBanner.jsx`, `CadenceToast.jsx` | The "legendary riff" and "cadence resolved" toasts. |
| `BattleMeterOverlay.jsx` | The full battle / riff-off duel overlay (dice, beams, crowds, retaliation, beam clash). Largest component (~1,850 lines, 35 props). |
| `Riffbook.jsx` | Discovery codex / cadence list / legacy reference. |
| `EventModal.jsx` | Event-space marquee ticket. |
| `BackToThePast.jsx` | The play-challenge overlay. |
| `TestingGrounds.jsx` | In-game dev panel. |
| `SignatureAbilities.jsx` | Per-spirit signature-route reference. |
| `ThousandBeats.jsx` | Fame-spark spacebar-mash overlay. |
| `CardPickupModal.jsx` | Keep/replace/discard board-card choice. |
| `UpgradeModal.jsx` | Harmonic-charge upgrade picker. |
| `RightPanel.jsx` | HUD right column (rival spirits, fan counts, mod cards). |

> The HUD **left** column (loadout / note track) and **center** column (the board itself) are still inline in `Game`'s render — they have the largest coupling to `Game` state and are the natural next extraction once state is grouped further.

---

## `hooks/` — state slices

Each hook owns a cohesive group of `useState` and returns the values + setters. They are **pure state containers**: a custom hook shares `Game`'s component instance, so this is behavior-neutral — the *logic* that drives the state still lives in `Game`.

| Hook | Owns |
|---|---|
| `useRiffState.js` | Riffbook discoveries, riff/cadence toasts, riffbook + signature UI state. |
| `useFanEconomy.js` | Limelight scores, posing flags, the "Unsure" crowd, fan reactions, spotlight hex (`SPOTLIGHT_POOL` passed in). |
| `useBgmState.js` | `<audio>` ref, track-index ref, mute/volume/track state. |
| `useBoardState.js` | Amps, board cards + respawn counter, pending card pickup, roadie action/animations, amp placement. |
| `useTransientFx.js` | Knockback slides, respawn flashes, rumble set, floating damage, status VFX. |
| `useNoteSystem.js` | `noteStates` — the core per-spirit note-track map (lazy initializer passed in). |

`Game` still declares ~31 `useState` directly — primarily the densely interwoven battle/turn/spirits state and its mirror refs/effects, which is the harder, logic-level work left for later.

---

## Systems map — how the big systems relate

- **Notes / music (the turn engine).** A turn is built around the **note track**. `Game.confirmNoteTrack()` is the pipeline: it reads scales/intervals from `music/notes.js`, detects legendary riffs via `music/riffLibrary.js`, checks cadence objectives and runs the pattern/HC scoring from `music/cadence.js`, applies interval effects, and updates `noteStates` (owned by `useNoteSystem`). Audio is synthesized in `Game`'s `NOTE SOUND` section, tuned by the amp-knob state.
- **Battle.** Triggered from board actions. Lives in `Game`'s `BATTLE SYSTEM` → `KNOCKBACK` → `SONIC ATTACK` → `RIFF-OFF ENGINE` → `BEAM CLASH` → `RETALIATION` sections. All of its on-screen UI is the `ui/BattleMeterOverlay.jsx` component; combat constants (`RIFF_LEN`, timing, swing tiers) are module-level in main.
- **Fan economy.** State in `useFanEconomy`; per-turn logic in `Game`'s `FAN ECONOMY HELPERS` and the end-of-turn tick; tuning constants (`FAN_*`, `SPARKS_PER_FP`) are module-level. Drives the crowd multiplier and limelight victory path.
- **Board.** Geometry/map from `board/`; on-board deployables state in `useBoardState`; placement/interaction handlers + the rendered board are in `Game` (`HEX CLICK`, `BOARD CARD SYSTEM`, `CAMERA/ZOOM`, and the inline CENTER render column).
- **Events / spaces.** `EVENT_DECK` table is module-level; `EVENT SPACES SYSTEM` logic and `eventHexes`/`activeEvent` state in `Game`; the popup is `ui/EventModal.jsx`.
- **Skill tree & upgrades.** `SKILL_TREE`/`SKILL_BY_ID` and the swing/discord tier tables are module-level data; selection/award logic is in `Game`; the picker UI is `ui/UpgradeModal.jsx`.

---

## "Where do I change X?"

| I want to change… | Go to |
|---|---|
| Character stats / balance | `data/spirits.js` |
| Win conditions (fame target, limelight turns) | `FAME_TO_WIN` / `LIMELIGHT_TO_WIN` (main, `LIMELIGHT SYSTEM` banner) |
| Scales, note spelling, intervals | `music/notes.js` |
| Legendary riffs (add/edit) | `music/riffLibrary.js` |
| Cadence objectives | `music/cadence.js` (`CADENCE_OBJECTIVES`) |
| Note-track scoring numbers | `music/cadence.js` (scoring fns) + `Game.confirmNoteTrack` |
| Fan-economy tuning | `FAN_*`, `SPARKS_PER_FP`, `FAN_MULT_CAP` (main, `FAN ECONOMY` banner) |
| Harmonic-charge cost | `HC_UPGRADE_THRESHOLD` (main) |
| Skill tree / upgrades | `SKILL_TREE`, `DISCORD_UPGRADE_TIERS`, `SWING_UPGRADE_TIERS` (main) |
| Event spaces | `EVENT_DECK` (main) + `EVENT SPACES SYSTEM` in `Game` |
| Amp range / chaining | `AMP_RANGE`, `AMP_LINK_DIST`, `AMP_UNPLUG_DIST` (main) |
| Riff-off feel (length, timing window) | `RIFF_LEN`, `RIFF_NOTE_WINDOW` (main) |
| A specific overlay/modal's look | the matching file in `ui/` |
| Tutorial content | `tutorial/content.jsx` |
| The board map / hex layout | `board/hexMap.js`, `board/constants.js` |

---

## Conventions & caveats

- **Navigate by banner comments, not line numbers** — line numbers shift with every edit.
- **`Game` is still a "God component."** It holds most state, all the system logic, the async-combat refs, and the left/center render columns. The extracted `hooks/` and `ui/` files are the seams; further reduction means moving *logic* (effects/handlers) into hooks, which changes behavior risk and is best done in small, individually play-tested steps.
- **Module imports are partly mid-file.** The `music/` and some board imports sit next to their old banner positions rather than at the very top — harmless, just unexpected if you only look at line 1.
- **Filename case:** `App.jsx` imports `./rlsw-simulator-V3_8_1` while the file is `rlsw-simulator-v3_8_1.jsx`. This works on case-insensitive filesystems (Windows/macOS default) but would break on a case-sensitive one; likewise line 9 imports `./groupie_fans.png` for a file named `.PNG`.
- **No behavior was changed during extraction** — every module/component/hook was moved verbatim, with imports/exports added and wiring verified (syntax, no-undef, and a full bundle of the whole graph).
