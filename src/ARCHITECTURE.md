# RLSW Simulator — Architecture

> 🗺️ **THIS IS THE MAP OF THE CODEBASE, AND IT IS CHECKED.** Rewritten from
> measurement on 2026-08-21, replacing a version that had drifted so far it called
> `engine/` a "~300 line Phase 1 scaffold" while `engine/` had become 21,595 lines
> and the whole game.
>
> 🎯 **`npm run test:arch` IS WHY YOU CAN TRUST IT.** `engine/architectureCheck.mjs`
> asserts three things against the real tree: every source module is named here,
> every file path named here exists, and every export named here is really
> exported. **A file added without a row fails the suite.** That is the entire
> point — the last version rotted for months because nothing could tell.
>
> ⚠️ **SO WHEN YOU ADD A MODULE, ADD ITS ROW IN THE SAME PASS.** The check will
> stop you, but only if you run `npm run test:all` before calling the work done,
> which CLAUDE.md requires anyway.
>
> 📌 Line counts below are measured and will drift by a few lines constantly —
> they are for *proportion*, not precision, and the check does not assert them.
> Navigate by the **banner comments** (`// ─── NAME ───`), never by line number.

---

## Boot flow

```
index.html
  └─ main.jsx                  React root, StrictMode, imports index.css
       └─ App.jsx              thin wrapper, renders <RLSWSimulator/>
            └─ rlsw-simulator-v3_8_1.jsx
                 ├─ RLSWSimulator()   app shell: Title → Lobby → Game
                 └─ Game()            the gameplay component (~15,700 lines)
```

⚠️ **THE ENGINE IS NOT IN THAT CHAIN, AND THAT IS THE SINGLE MOST IMPORTANT FACT
ABOUT THIS CODEBASE.** `Game` is a *client* of `engine/`. Rules live in the engine
and are reached by `dispatch(action)`; `Game` reads the resulting state and draws
it. A rule implemented inside `Game` is a rule the headless harness, the bot bench
and the determinism replay cannot see — which is how the marquee quiz sat
client-only until 2026-08-20 and did nothing at all in every bench match ever run.

---

## Directory map — measured 2026-08-21

| Path | Lines | Contents |
|------|------:|----------|
| `engine/` | 21,595 | 🎮 **The authoritative game core.** The reducer, seeded rng, snapshot/replay, 17 rule modules in `systems/`, the bot and evaluator in `policies/`, and the test suites. |
| `rlsw-simulator-v3_8_1.jsx` | 16,455 | The monolith: module-level data, the `RLSWSimulator` shell, and `Game` — all rendering, all cinematics, and the shrinking set of rules not yet extracted. |
| `ui/` | 13,508 | Presentational React components lifted out of `Game`'s render. |
| `riff/` | 4,338 | Riff generation, the falling-note highway, guitar-neck voicing. |
| `vision/` | 4,039 | 📷 Camera fretboard detection — neck geometry, homography, fusion with audio. |
| `data/` | 3,702 | Pure game data: spirits, corners, events, the skill tree, trivia, tuning constants. |
| `music/` | 3,516 | Music theory: scales, chords, the chord-context ladder, cadence scoring, key detection. |
| `audio/` | 3,344 | Web-Audio SFX, BGM, the amp voice, mic pitch, chroma analysis. |
| `board/` | 910 | Hex geometry, the 111-hex map, board helpers, stage-effect geometry. |
| `net/` | 522 | 🌐 The multiplayer client and the Ear Spy riff wire. |
| `hooks/` | 144 | Six thin React state slices. ⚠️ Nearly empty by design — see `hooks/` below. |
| `App.jsx`, `main.jsx` | 20 | Vite/React entry wiring. |
| `standees/`, `bgm/`, `sfx/` | — | Character PNGs (normal + `_mirror`), music, sound effects. |

📌 **156 source modules.** `ui/` being the second-largest directory is the shape of
a healthy extraction: rendering left the monolith first, and rules are still
leaving.

---

## `engine/` — the authoritative game core

### The spine

| File | Lines | Key exports | What it owns |
|------|------:|-------------|--------------|
| `rng.js` | 79 | `makeRng`, `restoreRng`, `hashSeed` | Seeded mulberry32, serializable as `{seed, cursor}`, forkable per subsystem. ⚠️ **Game rules must draw from this, never `Math.random()`** — a single stray call breaks replay. |
| `state.js` | 208 | `makeInitialState` | Lobby config → plain-JSON `GameState`. |
| `actions.js` | 659 | `GAME_INIT`…`HEADLINER_CHANGED` + a creator per type | The serializable action vocabulary — ~55 types, each with a creator. Every rule change enters the game through one of these. |
| `reduce.js` | 188 | `applyAction` | `(state, action, rng) → state`. **The one door.** Persists the rng cursor into the returned state so a replay lands on the same numbers. |
| `serialize.js` | 92 | `snapshot`, `restore`, `replay`, `assertJsonSafe` | Save/load and action-log replay — the determinism proof. `assertJsonSafe` is what stops a `Set` or a ref sneaking into state. |

### `engine/systems/` — the rules, one concern per file

| File | Lines | Key exports | What it owns |
|------|------:|-------------|--------------|
| `turn.js` | 194 | `applyTurnStarted`, `applyTurnEnded`, `applyTurnSkipped`, `applyMoveBudgetSet`, `applyBeatsSpent`, `applySpiritEliminated`, `applySpiritsSynced`, `applySpiritPatched` | The turn queue, beats/AP, and the **round anchor** (`rollRound`, module-local) — see "The round clock". |
| `turnFlow.js` | 209 | `startTurnNotes`, `refillRateFor`, `refillDrawCount` | What happens at the *start* of your turn: note-stock refill, cooldown ticks, rig atrophy. |
| `movement.js` | 127 | `applyMoveStep`, `applySpiritFaced`, `applySpiritWarped` | Stepping, facing, and the dazed 33% redirect (on engine rng). |
| `combat.js` | 439 | `marginToDamage`, `knockbackSpaces`, `fameFromMargin`, `underdogBonus`, `decideWinner`, `resolveKnockdown`, `applyAttackRolled`, `applyDamageApplied`, `smashOutcome`, `chordFrayAmount`, `isRearHit`, `sustainChip`, `finisherStackWipe` | The fight **math** — damage/knockback/Fame tables, the underdog ramp, rear-arc bonuses, and the dice rolls themselves. Pure functions plus the roll actions. |
| `battleFlow.js` | 843 | `runBattleFlow`, `battleConsequences`, `poseConsequences`, `riffOffConsequences`, `chordFray`, `knockback`, `grantFame`, `awardSonicFame`, `awardThrashFame`, `awardRiffFame`, `vibeDamage`, `clearBattleBuffs` | The fight's **consequences**, as ordered generators: who gains Fame, who loses stack, who slides. ⚠️ Generators, not plain functions — the client steps them to time its cinematics. |
| `attackParams.js` | 270 | `attackParams`, `rigFor`, `spiritChord`, `SWING_DRIVE_SPEND`, `SONIC_DRIVE_SPEND`, `CHARGE_DIE_CEILING` | One place that answers "what does this attack cost and roll?", so client and bot cannot disagree. |
| `sonicRig.js` | 194 | `sonicRig`, `rigTiers`, `rigStack`, `rigRadius`, `rigSpendable`, `rigTrained`, `rigAtrophyTick`, `rigPoolLabel`, `rigTierSpend` | 🎛️ The amp: dice pool, die size, and the **breathing radius** (`RIG_RADIUS_FLOOR` + your Drive stack on your turn, Sustain on theirs). Won at the marquee, lost to atrophy. |
| `economy.js` | 625 | `makeInitialNoteState`, `performanceScore`, `fansFromDeed`, `applyFameChanged`, `applyFansChanged`, `applyFansTicked`, `applyNoteSheetPatched`, `applyDebuffsTicked`, `applyBurnTicked`, `usedHas`, `usedList`, `usedAdd`, `FAN_FIELDS` | 💰 Fame, fans, and the per-spirit note sheet. `FAN_FIELDS` whitelists what a fan patch may touch so it can't quietly write Fame. |
| `melodyCommit.js` | 693 | `commitMelodyEconomy`, `checkWaNoKoe`, `positionFanGain`, `deedFanGain`, `performanceFanGain`, `SPEED_CAP`, `COLOR_PAYOUT_CAP`, `MIC_VOICE_ROLL_DIE`, `CLIENT_OWNED` | 🎵 What a committed melody pays. `CLIENT_OWNED` names the pieces still living in the monolith — read it before assuming a payout is here. |
| `limelight.js` | 95 | `makeLimelightState`, `posePayout`, `isPosing`, `poseRounds`, `applyPoseSet`, `applyPoseRoundBanked` | ✨ The Limelight hex and the Strike-a-Pose payout ramp. |
| `skills.js` | 88 | `skillEligibility`, `THEORY_DISCORD_GRANTS` | 🎓 The one gate deciding whether a skill can be bought. Shared by the bot and the client so they cannot disagree. |
| `cooldowns.js` | 200 | `ABILITY_CD`, `ABILITY_DB_COST`, `cooldownLeft`, `onCooldown`, `dbCostOf`, `canFire`, `firePatch`, `tickCooldowns`, `tickShamisen`, `resetAllCooldowns` | 🕒💿 What an ability costs to fire and how long it then sleeps. One map on the sheet (`ns.abilityCd`), one tick in `turnFlow`. `tickShamisen` gives non-Shamisen abilities an extra tick (2× speed); `resetAllCooldowns` slams everything to max (the curse penalty). ⚠️ An ability absent from `ABILITY_CD` has no cooldown, which is a **debt** under the 2026-08-22 rule. |
| `board.js` | 411 | `applyBoardSynced`, `applyEventHexTriggered`, `applyEventHexSpawned`, `applyChargeZoneUsed`, `applyChargeZonesTicked`, `applyTokenPickedUp`, `applyTokensDrifted`, `applyTokensScattered`, `applySpotlightMoved`, `applySpotlightHealed`, `applyFlamingHexesSet`, `bankLostChord`, `tokenAt`, `liveChargeZoneAt` | 🗺️ Everything sitting *on* the board: Lost Chords, Charge Zones, marquee event hexes, the spotlight, Disco Inferno. |
| `riffOff.js` | 442 | `riffStats`, `applyRiffOffStarted`, `applyRiffResolved`, `applyRiffRound2Started`, `applyRiffClosed`, `simulateRiffPerformance`, `riffSkill`, `riffIsClose`, `RIFF_GRADE_WEIGHT`, `RIFF_MARGIN_SCALE` | 🎸 The duel: riff generation on engine rng, and the verdict math. `simulateRiffPerformance` is how a bot "plays" one. |
| `slime.js` | 314 | `applySlimeDropped`, `applySlimeDecayed`, `applySlimeCalled`, `applySpiritSlid`, `trailOf`, `slimeAt`, `slimeBites`, `slideTarget`, `canCallSlime`, `SLIME_LIFETIME` | 🧪 The Metalness Monster's trail — where it is, what it costs to walk through, and where it slides you. |
| `eleven.js` | 112 | `atEleven`, `ampBlown`, `canCallEleven`, `applyElevenCalled`, `elevenDrive` | 🔊 Going to eleven, and the blown amp that follows. |
| `stageFx.js` | 221 | `applyStageFxDrawn`, `applyStageFxActivated`, `applyStageFxTurnTicked`, `applyStageFxRoundTicked` | 🎇 Smoke, lasers, pyro, animatronics — deck seeded once at init, each threshold firing exactly once. |

### `engine/policies/` — the bot, and the headless game

⚠️ **NONE OF THIS IS THE GAME'S RULES.** Policies *choose* actions; `systems/`
decides what those actions do. A rule that lives in a policy is a rule only the
bot obeys.

| File | Lines | Key exports | What it owns |
|------|------:|-------------|--------------|
| `legalActions.js` | 613 | `legalActions`, `actionKinds`, `beamActions`, `swingCone`, `sonicBeam`, `facingOptions`, `tentacleOptions`, `SWING_AP_COST`, `SONIC_AP_COST`, `MOVE_AP_COST`, `SONIC_BEAM_REACH` | 🚦 What a Spirit may legally do right now. ⚠️ **Read the CLIENT when checking whether a rule is real** — `legalActionsCheck` §15 was green for months against a mechanic the game does not have. |
| `evaluate.js` | 1,309 | `evaluate`, `evalScore`, `EVAL_WEIGHTS`, `DEFAULT_WEIGHTS`, `weightsFor`, `STARTING_SKILLS`, `posePayout`, `selfPoseValue`, `beamOpportunity`, `facingTrade`, `boomBoxLit` | 🧠 How good is this position? One weighted sum of named terms. ⚠️ Every weight is a **measured** number or a flagged guess — `BOT_STRATEGY_HANDOFF.md` records which is which. |
| `actionScore.js` | 410 | `makeActionScorer`, `beamFor`, `resolvePersona`, `NEUTRAL_PERSONA`, `STYLE_RANK_STRIDE`, `TENTACLE_RANK_STRIDE`, `STYLE_GAIN_FLOOR` | 🎯 Scores a single candidate action, persona-flavoured, so the searcher can rank without simulating everything. |
| `bot.js` | 698 | `botPlanMove`, `botPickTarget`, `botPlanNoteStep`, `botPlanStackCommit`, `botPlanRevoice`, `botPickSkillTarget`, `botRiffResults`, `botAssignPersona`, `BOT_PERSONALITIES`, `BOT_SKILL_PRIORITY_BASE`, `BOT_CLIENT_KINDS`, `BOT_CLIENT_GAPS` | 🤖 The bot's actual choices, per personality. `BOT_CLIENT_GAPS` names what the bot can do in the client but not headless — read it before trusting a bench number. |
| `play.js` | 988 | `runMatch`, `runBench`, `playTurn`, `matchConfig`, `POLICIES`, `HARNESS_GAPS`, `harnessHooks`, `startSpiritTurn`, `MAX_TURNS`, `MAX_ACTIONS_PER_TURN` | 🎲 The headless harness — plays whole matches with no React at all. ⚠️ **`HARNESS_GAPS` is the honesty ledger**: what the harness knowingly does not model. A mechanic missing from it is not "skipped", it is *silently absent*, which is far worse. |
| `transition.js` | 747 | `applyBotAction`, `applyBotLine`, `MODELLED_KINDS`, `UNMODELLED_KINDS`, `PARTIAL_KINDS` | 🔁 Turns a chosen action into dispatched engine actions, and declares which kinds are fully modelled. `collectPickups` (module-local) resolves what you step on. |
| `botJournal.js` | 183 | `journalSummary`, `traceKey`, `JOURNAL_CLOSE_GAP` | 📓 Why the bot did that — a readable per-turn account, used by `test:trace` and `ui/BotReview.jsx`. |

### `engine/` — the suites

⚠️ **A suite that no npm script runs is not a suite** (`b0check` was quoted as
green for months while nothing ran it). Everything below has a script, and
`npm run test:all` runs the lot.

| File | Script | Covers |
|------|--------|--------|
| `selftest.mjs` | `test:engine` | The broadest sweep — state shape, systems, the rig, the skill tree fixtures. |
| `legalActionsCheck.mjs` | `test:legal` | What is and isn't a legal action. |
| `evalCheck.mjs` | `test:eval` | Every weight in the evaluator's table, and the terms that read them. |
| `transitionCheck.mjs` | `test:transition` | Bot action → engine action, and the modelled/unmodelled declarations. |
| `turnFlowCheck.mjs` | `test:turnflow` | Start-of-turn refills, cooldowns, atrophy. |
| `determinismCheck.mjs` | `test:determinism` | Same seed, same match — the replay proof. |
| `battleFlowCheck.mjs` | `test:battleflow` | The ordered consequence generators. |
| `melodyCommitCheck.mjs` | `test:melody` | What a commit pays. |
| `slimeCheck.mjs` | `test:slime` | The trail, the slide, the bite. |
| `elevenCheck.mjs` | `test:eleven` | Eleven and the blown amp. |
| `shamisenCheck.mjs` | `test:shamisen` | 🎸 The Cursed Shamisen's cooldown acceleration (`tickShamisen`), cooldown reset (`resetAllCooldowns`), activation cost, and design invariants. 34 assertions. |
| `actionScoreCheck.mjs` | `test:score` | Per-action scoring and persona strides. |
| `harnessCheck.mjs` | `test:harness` | That the headless harness mounts and every knob is live — **and that each gap is declared**. |
| `skillTreeCheck.mjs` | `test:skilltree` | Every skill's price, route and prereq, and that no prereq names a skill that does not exist. |
| `b0check.mjs` | `test:b0` | The chord-context ladder and the Theory economy (see `THEORY_REWRITE_LOG.md`). |
| `clientRefCheck.mjs` | `test:client` | 🔎 **The only suite that looks at the CLIENT.** Parses every `.jsx` and asserts that every name it reads is declared, imported, or a real browser global. Written after the 2026-08-26 Shamisen rework deleted `startNewTurnNotes` and the end of the melody commit while both stayed green everywhere else — esbuild reads a missing function as a global. Scope-blind on purpose; `npm run lint` is the thorough, slow version. |
| `clientRenderCheck.jsx` | `test:render` | 🎬 **The only suite that RENDERS the client.** Mounts `Game` through `react-dom/server` against `buildTestingGroundsConfig()` and asserts the board came out with the RIGHT commit panels on it for the step it opens in — the chord stacks up, the commit track not. Catches the render-time `ReferenceError` that `clientRefCheck` can only see as a missing *name* — both August client bugs were exactly that. ⏳ Does not click, commit or end a turn: that needs a DOM, and jsdom will not install on this machine. |
| `clientRenderShim.mjs` | — | The smallest browser `clientRenderCheck` can run against — `document`, `localStorage`, `AudioContext` and friends, all inert. ⚠️ Uses `defineProperty`, not assignment: Node 22 ships `navigator` as a getter-only global. |
| `botTraceCheck.mjs` | `test:trace` | A full match walked turn by turn, with the bot's journal. |
| `architectureCheck.mjs` | `test:arch` | **This file** — that it names every module, points at no dead path, and lists no phantom export. |
| `bench.mjs` | `bench:bot` | Not a test. Prints evidence for the §6.6 bot bench. |
| `testAssetStub.mjs` | — | Lets Node import the monolith's `.png`/`.mp3` chain. Loaded via `--import` by every script above. |

---

## The monolith — `rlsw-simulator-v3_8_1.jsx` (16,455 lines)

Three layers. ⚠️ **It cannot be eyeballed** — verify with `npm run check:bundle`
before and after touching it, and navigate by banner.

| Layer | From | What is there |
|---|---:|---|
| Module-level | 1 | Imports, the fan crowd SVG, cadence hints, the Discord upgrade path, stack colours, per-ability tuning, riff-off scoring constants. |
| `RLSWSimulator()` | 676 | The app shell: Title → Lobby → Game. |
| `Game()` | 766 | Everything else — state, handlers, cinematics, and the render. |

**Named banners inside `Game`, in order** — these are the search targets:

| Banner | ~Line | What it is |
|---|---:|---|
| `ENGINE STATE` | 779 | The dispatch seam. Read `MULTIPLAYER_HANDOFF.md` before touching it. |
| `NOTE SYSTEM STATE` | 1692 | The per-spirit sheet — **engine-owned**; this is a diffing shim. |
| `BOARD CARD SYSTEM` | 4752 | Board deployables and respawn. |
| `EVENT SPACES SYSTEM` | 4761 | The marquee hexes and the quiz card. |
| `BATTLE SYSTEM` | 5827 | Attack orchestration and the spin overlays. |
| `STAGE EFFECTS SYSTEM` | 5834 | Smoke/laser/pyro/animatronic cinematics off the engine reports. |
| `RIFF-OFF ENGINE` | 8959 | The falling run, miss timers, Riff Slayer lurch, E-Rush ghosts. |
| `RENDER` | 11891 | The whole render tree, to end of file. |

📌 **The engine-owned banners say so in their own text** (`Phase 6a/6b/6c/6d, fully
migrated`). Where a banner claims engine ownership, the React state beside it is a
mirror for rendering — change the rule in `engine/systems/`, not here.

---

## Extracted modules

### `board/` — geometry & the map

| File | Lines | Key exports | Purpose |
|------|------:|-------------|---------|
| `constants.js` | 10 | `HEX_SIZE`, `SCALE`, `SVG_W`, `SVG_H`, `IMG_W`, `IMG_H`, `COL_SPACING`, `ROW_SPACING` | Board image dimensions. |
| `hexMap.js` | 68 | `HEX_BY_NUM`, `HEX_BY_QR`, `ALL_HEXES`, `COLUMNS`, `EDGE_HEX_NUMS`, `buildHexMap` | The 111-hex column layout and the edge set. |
| `hexGeometry.js` | 114 | `pointyCorners`, `axialDist`, `axialNeighbors`, `facingAngle`, `angleTo`, `angleDiff`, `neighborInDirection`, `getFlatTopNeighborSlots`, `fanGesture`, `grandstandSeat` | Pure hex math, plus the grandstand seating the crowd sits in. |
| `boardHelpers.js` | 117 | `cornerFacing`, `advanceTurnQueue`, `makeBoardToken`, `hexRingFromCenter`, `crowdMultiplier`, `advanceDB`, `SPOTLIGHT_POOL`, `EVENT_HEX_POOL`, `eventHexCandidates` | Board utilities and the pools the spotlight and marquees are drawn from. |
| `stageFx.js` | 144 | `smokeHexNums`, `hexInSmoke`, `rollLaserBeams`, `hexInBeams`, `rollPyroHexes`, `spawnAnimatronics`, `animatronicStep` | 🎇 Stage-effect geometry. ⚠️ The rollers take an injectable `rand` and **avoid occupied hexes** — hazards never start on a player. |
| `stageSkins.js` | 169 | `STAGE_SKINS`, `STAGE_SKIN_BY_ID`, `DEFAULT_SKIN_ID`, `loadStageSkin`, `saveStageSkin`, `stageSkinPlateFilter`, `stageSkinLineMatrix` | 🎨 Board colour schemes. Deliberately **local and cosmetic**, not engine state, so players in one match can run different skins. |
| `ampDecks.jsx` | 278 | `CORNER_DECKS` | The corner amp-stack art. |
| `ampKnobs.js` | 10 | `AMP_KNOBS` | Tone-knob defaults for note playback. |

### `data/` — pure game data

| File | Lines | Key exports | Purpose |
|------|------:|-------------|---------|
| `spirits.js` | 48 | `SPIRIT_DEFS`, `SPIRIT_OPTIONS`, `ROSTER_ORDER`, `PLAYABLE_ORDER`, `IN_DEVELOPMENT`, `isPlayable`, `MAX_PLAYERS` | **Character stats and balance.** |
| `gameConstants.js` | 556 | 106 named constants — `FAME_TO_WIN`, `LIMELIGHT_TO_WIN`, `POSE_FP_STEP`, `RIG_RADIUS_FLOOR`, `RIG_ATROPHY_TURNS`, `FAN_*`, `SMASH_*`, `THRASH_*`, `SONIC_*`, `TOKEN_*`, `stackCapFor`, … | **All gameplay tuning.** |
| `skillTree.js` | 221 | `SKILL_TREE`, `SKILL_BY_ID`, `SPIRIT_ONLY_ROUTE` | 🎓 The ability tree. ⚠️ The `electric` route (`amp_*`, `power_*`, `range_*`, `overcharge`) was **deleted** on 2026-08-20 — the rig is won at the marquee now. |
| `trivia.js` | 2,545 | `TRIVIA_QUESTIONS`, `TRIVIA_BY_ID`, `drawTrivia`, `TRIVIA_BUCKETS`, `TRIVIA_LANES`, `TRIVIA_REWARD`, `TRIVIA_TIER_GRANT`, `TRIVIA_BOT_ODDS`, `bestTriviaDifficulty` | 🎪 The marquee quiz bank. `drawTrivia` is pure and recycles **per bucket**. Write new questions against `TRIVIA_CONTENT_BRIEF.md`. |
| `events.js` | 64 | `EVENT_DECK`, `EVENT_BY_ID` | The event-space definitions. |
| `corners.js` | 18 | `CORNERS`, `CORNER_LABELS`, `CORNERS_ORDER` | Home hexes per corner. |
| `stageEffects.js` | 80 | `STAGE_FX_THRESHOLDS`, `STAGE_FX_META`, `shuffledStageFxDeck`, `SMOKE_ROUNDS`, `LASER_*`, `PYRO_*`, `ANIMATRONIC_*` | 🎇 Stage-effect tuning. Fired once each at ⭐8/16/24 from a per-game shuffled deck. |
| `styles.js` | 43 | `STYLE_DEFS`, `styleOf`, `styleDef` | ⚠️ **FLAVOUR ONLY.** Style stopped affecting scoring — icon, colour and tagline are all that is live. See below. |
| `matchSetup.js` | 52 | `cornersForCount`, `seatSpirit`, `buildTestingGroundsConfig` | Seat assignment and the Testing Grounds config. |

### `music/` — the music rules

| File | Lines | Key exports | Purpose |
|------|------:|-------------|---------|
| `notes.js` | 200 | `NOTE_POOL`, `canonicalRoot`, `getSpelledPool`, `pitchIndex`, `buildScale`, `semitonesUp`, `getIntervalNotes`, `getFourthFifth`, `playableScale`, `MAJOR_SCALES`, `MINOR_SCALES`, `ENHARMONIC_RESPELL` | Scales, note spelling, intervals. |
| `chords.js` | 100 | `CHORD_TEMPLATES`, `evaluateChord`, `PC_NAMES` | **Chord → Drive/Sustain.** |
| `context.js` | 479 | `CONTEXT_TIERS`, `stackContext`, `chordContext`, `contextClaim`, `classifyTrack`, `modeFromStack`, `harmonicLock`, `discordPenaltyFor`, `countUnpardoned`, `PARDON_ORDER` | 🎼 **The chord-context ladder** — the one idea the Theory tree sells: your stack decides which notes are legal. See `THEORY_ARCHITECTURE.md`. |
| `cadence.js` | 358 | `CADENCE_OBJECTIVES`, `CADENCE_BY_ID`, `cadenceHints`, `detectCadence`, `detectChromaticRun`, `detectDiatonicRun`, `driveBoostFromRun`, `detectSkipClimb`, `detectRepeatPattern`, `sustainBoostFromPattern`, `scoreTrackDB`, `analyseTrack`, `randomNote`, `refillStock`, `detectMotifRepeat` | Cadence goals and melody scoring. 🪦 Four `shamisen*` exports removed 2026-08-26 — the Shamisen is no longer a board token with a phrase. |
| `spiritStyle.js` | 366 | `detectSpiritStyle`, `styleProgress`, `styleGain`, `styleProgressWithNote`, `STYLE_GESTURES`, `gesturesFor` | Gesture detection for the character-sheet style read (flavour, not payout). |
| `keyDetect.js` | 433 | `detectKey`, `makeKeyTracker`, `keyToScale`, `keyPitchClasses`, `chordCandidates`, `detectPalette`, `listenFrame`, `SCALE_SHAPES` | 👂 Ear Spy: what key is being played. |
| `neckPlacement.js` | 597 | `placeNotes`, `placePitch`, `makeNeckTracker`, `makeHandTracker`, `foldOntoNeck`, `positionsForPitchClass`, `midiToPitch`, `pitchToMidi`, `PLACEMENT_DEFAULTS` | 👂 Notes → frets, with a trail and hand tracking. |
| `riffAnalysis.js` | 329 | `analysePhrase`, `makePhraseRecorder`, `weighPhrase`, `impliedChord`, `RIFF_DEFAULTS`, `ROLE_LABELS` | 👂 Post-phrase verdict. |
| `spice.js` | 216 | `spiceSetFor`, `classifyNote`, `expireOpenNotes`, `coachLine` | 👂 The deliberate-discord judgement. ⚠️ **Shared with Discord Coach** — changing it changes both. |
| `styles.js` | 444 | `LEGENDS`, `LEGEND_BY_ID`, `paletteFit`, `detectMoves`, `phraseStats`, `styleMeter`, `toneMatch`, `lickMatch` | 🎸 Legend Lessons: matching a player's phrasing against a legend. ⚠️ Unrelated to `data/styles.js` despite the name. |
| `pitchNames.js` | 17 | `PC_PLAY_NAMES` | Display names per pitch class. |

### `riff/` — riff generation and the highway

| File | Lines | Key exports | Purpose |
|------|------:|-------------|---------|
| `riffGeneration.js` | 166 | `generateRiffRhythm`, `speedUpRiffRhythm`, `riffDegreesToNotes`, `RIFF_LEN_DEFAULT`, `RIFF_CONTOUR_LABELS`, `RIFF_ANSWER_LABELS` | Contours and rhythms for the duel. |
| `fallingNotes.js` | 180 | `RIFF_FALL_DIFFICULTY`, `RIFF_FALL_DEFAULT`, `RIFF_SPACING_BASE`, `RIFF_GHOST_WINDOW_MULT`, `RIFF_RUSHED_TIGHTEN` | **Timing feel** — fall speed, difficulty presets, grade windows, note spacing. |
| `melodyRiff.js` | 168 | `melodyToRiff` | Turns a committed melody into a playable riff. |
| `guitarMap.js` | 257 | `STRING_NAMES`, `STRING_OPENS`, `MAX_FRET`, `degreePitch`, `pitchKey`, `cellKey`, `nearestPositionForKey` | Full-neck voicing — which fret on which string. |
| `riffArchetypes.js` | 514 | `SCALES`, `GENRES`, `STYLE_BIAS`, `generateArchetypeRiff`, `arrowsFor`, `analyseArrows`, `longestDirectionalRun` | Genre-flavoured riff archetypes for practice. |
| `riffPerformance.js` | 216 | `applyPerformance`, `applyChords`, `directionsFor`, `BEND_WEIGHTS`, `PERFORMANCE_DEFAULTS`, `BEND_MIN_SUSTAIN` | Bends, showpieces, and how a riff is *played* rather than spelled. |
| `arrowHighwayEngine.js` | 1,368 | `mountArrowHighway`, `TIERS` | The canvas renderer for the arrow highway. 📌 Ported from `arrow-highway-proto.html`, which is still read off disk by `syncProtoGenerator.mjs`. |
| `neonNeckGeometry.js` | 81 | `NECK_IMG`, `FRET_X`, `STRING_LINES`, `stringY`, `cellXY`, `stringPitch`, `stringSpan` | Neon-neck coordinates, calibrated against the art. |
| `calibrateNeonNeck.mjs` | 293 | `FRET_X`, `STRING_LINES`, `stringY`, `cellXY` | The calibration script those numbers came from. |
| `syncProtoGenerator.mjs` | 53 | — | Keeps the prototype HTML and the ported engine in sync. |
| `riffOffParity.test.mjs` | 170 | — | `test:riffparity` — the duel asks for what practice teaches. |
| `arrowHighwayEngine.test.mjs`, `guitarMap.test.mjs`, `neonNeck.test.mjs`, `riffArchetypes.test.mjs`, `riffPerformance.test.mjs` | 872 | — | `test:riff`. ⚠️ These ran for **nobody** until 2026-08-21 — 132 assertions with no script. |

### `audio/` — sound

| File | Lines | Key exports | Purpose |
|------|------:|-------------|---------|
| `chroma.js` | 1,040 | `CHROMA_DEFAULTS`, `chromaFromPeaks`, `chromaFromSpectrum`, `fftMagnitudes`, `pickPeaks`, `inferVirtualFundamentals`, `freqToMidiFloat`, `normalize` | 👂 The listening pipeline. ⚠️ **Every gate threshold is MEASURED, not guessed** — `npm run test:chroma` prints the table it came from. |
| `micPitch.js` | 342 | `startMicListening`, `micAvailable`, `MIC_DEFAULTS`, `pitchToMidi`, `midiToFreq` | Microphone capture and pitch tracking. |
| `ampVoice.js` | 234 | `playAmpNote`, `playAmpPowerChord`, `getAmpBuses`, `makeDistortionCurve`, `SPIRIT_TONES`, `TONE_VOICES`, `TONE_KNOB_DEFAULTS` | The distorted guitar voice notes are played through. |
| `riffSfx.js` | 210 | `getRiffAudio`, `riffDegreeFreq`, `playRiffMiss`, `playRiffWrong`, `playBeamClash`, `playBeamSurge`, `playBeamBreak`, `pickGlitchRiffNote` | Duel and beam sound effects. |
| `bgm.js` | 42 | `BGM_TRACKS`, `nextBgmTrack` | Background music tracks. |
| `chromaSelftest.mjs` | 1,476 | — | `test:chroma` — asserts the measured separation still holds. |

### `vision/` — 📷 the camera fretboard

| File | Lines | Key exports | Purpose |
|------|------:|-------------|---------|
| `neckDetect.js` | 1,006 | `DETECT_DEFAULTS`, `houghLines`, `sobel`, `toGray`, `groupByAngle`, `lineIntersection`, `crossRatio`, `INLAY_FRETS` | Finding a guitar neck in a camera frame. |
| `neckGeometry.js` | 604 | `NECK_STRINGS`, `CORNER_PROMPTS`, `CORNER_TARGETS`, `solveHomography`, `spanToFret`, `fretToSpan`, `spanToPressedFret` | The projective maths turning a photographed neck into fret coordinates. ⚠️ A **separate pure module** on purpose, so it can be tested without a camera. |
| `fretFusion.js` | 471 | `makeFretFusion`, `snapToPosition`, `snapNotes`, `snapChord`, `handShape`, `FUSION_DEFAULTS`, `HAND_DEFAULTS` | Fusing what the camera sees with what the mic hears. |
| `cameraHand.js` | 191 | `startCameraHand`, `cameraAvailable`, `CAMERA_DEFAULTS` | Camera capture and hand tracking. |
| `visionCoach.js` | 183 | `diagnose`, `nextAction`, `COACH_LIMITS` | Telling the player why detection is failing. |
| `neckGeometrySelftest.mjs` | 1,001 | — | `test:vision`. |
| `neckDetectSelftest.mjs` | 583 | — | `test:detect`. |

### `net/` — 🌐 multiplayer

| File | Lines | Key exports | Purpose |
|------|------:|-------------|---------|
| `client.js` | 181 | `makeNetClient`, `CLIENT_SCHEMA`, `defaultServerUrl` | The room/lobby/relay client. See `NETCODE_HANDOFF.md`. |
| `riffWire.js` | 195 | `WIRE_DEFAULTS`, `makeRiffSender`, `encodeRiffFrame`, `decodeRiffFrame`, `holdsFloor`, `isStale`, `FLOOR` | 👂 Ear Spy Online wire format and turn-taking. ⚠️ The server closes sockets over 30 msg/s; the 8 Hz coalescing throttle is what stops streaming from disconnecting players. |
| `earSpyLink.js` | 146 | `makeEarSpyLink`, `LINK_DEFAULTS`, `encodeRiffFrame`, `decodeRiffFrame` | The Ear Spy peer link. |

### `hooks/` — React state slices

⚠️ **NEARLY EMPTY, AND THAT IS THE POINT.** 168 lines across seven files. Each was
a large slice of `Game` state until the engine took ownership of its rules; what
remains is presentation state only. A hook growing again is a signal that a rule
is being written in the client.

| Hook | Lines | Owns |
|------|------:|------|
| `useRiffState.js` | 26 | Riffbook discoveries, riff/cadence toasts, riffbook UI. |
| `useFanEconomy.js` | 33 | Fan reactions, the "Unsure" crowd, spotlight hex display. |
| `useBgmState.js` | 21 | `<audio>` ref, track index, mute/volume. |
| `useBoardState.js` | 19 | Pending pickup and roadie actions. |
| `useTransientFx.js` | 30 | Knockback slides, respawn flashes, rumble, floating damage. |
| `useStageEffects.js` | 15 | 🎇 The activation banner only — the effects are engine state. |

### `ui/` — presentational components

Each takes everything via props. ⚠️ **They hold no game rules.**

| Component | Lines | Purpose |
|-----------|------:|---------|
| `BattleMeterOverlay.jsx` | 2,063 | The full battle/riff-off duel overlay — the largest component. |
| `OpeningMovie.jsx` | 1,051 | The opening cinematic. |
| `FretboardRecon.jsx` | 1,033 | 🗺️ Practice mode: levels, Live Set, ranks. Exports `scoreSet` and `recommendFor`; `TIER_CONFIG`, `RANKS` and `LIVE_SET_LENGTH` are module-local tuning. ⚠️ The level never changes mid-run, on purpose. |
| `ListenNeck.jsx` | 823 | 👂 The live listening fretboard. |
| `LegendLessons.jsx` | 772 | 🎸 Legend Lessons UI. |
| `Pickles.jsx` | 592 | 🎓 The guitar pick with eyes who delivers the tips. |
| `DiscordCoach.jsx` | 580 | 👂 Live "was that discord deliberate?" coaching. |
| `GameStyles.jsx` | 568 | The global `<style>` block — CSS keyframes and classes. No props. |
| `NoteHex.jsx` | — | 🎵 One note chip as inline SVG: outer ring, inner corner-bracket ring, white letter. Used by the Note Stock, the commit track and both chord stacks. Exports `NoteHex` (default), `NOTE_HEX` and `NOTE_BURST` (the tuning blocks) plus `deepen` and `hexPoints` (the chip's own outline, so the flying chip's shed rings trace the same hexagon). ⚠️ SVG rather than the `.hexw` clip-path divs because `drop-shadow` blurs a SILHOUETTE — a filled hexagon's glow hides behind itself, a stroked ring's does not. |
| `BeginnerTipOverlay.jsx` | 506 | Multi-page walkthroughs with an arrow pointing at the real HUD element. |
| `GameOverOverlay.jsx` | 425 | End-of-game victory screen. |
| `FretboardFull.jsx` | 396 | The full-neck fretboard display. |
| `Lobby.jsx` | 373 | Pre-match seating and options. |
| `StageFXLayer.jsx` | 323 | 🎇 `StageFXBoardLayer` + `StageFXBanner`. |
| `RiffPractice.jsx` | 317 | Practice room for the arrow highway. |
| `UpgradeModal.jsx` | 311 | The harmonic-charge upgrade picker. |
| `CameraCalibrator.jsx` | 309 | 📷 Corner-tap calibration for the camera neck. |
| `BotReview.jsx` | 299 | 📓 Reads the bot journal back as prose. |
| `RiffMenu.jsx` | 279 | Riff Mode room list. `RIFF_MODES_UNLOCKED` (module-local) gates which rooms playtesters see. |
| `EventModal.jsx` | 274 | 🎪 The marquee ticket — lane × difficulty chosen **before** the question is drawn. |
| `TopMenu.jsx` | 178 | ☰ The header's fold-away control menu — Cadences, Abilities, speed, fast battles, lite FX, stage skin, tips, Lobby. Exports `TopMenu`. 🎛️ **Shell only, same doctrine as `ChannelStrip.jsx`**: every label, colour and handler arrives in `items`, so a mistake here can misdraw a row but cannot reach game state. ⚠️ Row kind `'action'` closes the menu and `'toggle'`/`'cycle'`/`'submenu'` do not — that is a rule about intent, not a style. |
| `TitleMenu.jsx` | 249 | Title screen. |
| `FameRace.jsx` | 139 | ⭐ The scoreboard: ONE shared track, one blip per Spirit, living in the header since 2026-08-31. Exports `FameRace`. Replaced four stacked per-spirit bars — four parallel bars cannot show a race, because the gap has to be reconstructed by eye across four origins. ⚠️ **The tie fan is load-bearing, not polish**: every match starts with everyone on ⭐0, so without it the opening screen of every game shows one blip and three invisible ones. `contested` is presentation only (`FAME_RACE_CONTESTED_LEAD`). |
| `TentacleFX.jsx` | 250 | 🧪 Metalness Monster tentacle visuals. |
| `TestingGrounds.jsx` | 137 | The sandbox launcher. |
| `Riffbook.jsx` | 127 | Discovery codex and cadence list. |
| `HintScreen.jsx` | 114 | Loading-screen hints. |
| `NeonStrikeFX.jsx` | 85 | Neon strike burst. |
| `SignatureAbilities.jsx` | 65 | Signature ability panel. |
| `ToneFader.jsx` | 61 | Tone slider. |
| `GameErrorBoundary.jsx` | 60 | Crash boundary; also `isMirrorFacing` / `MIRROR_SPRITES`. |
| `VoiceRollDie.jsx` | 59 | The mic voice-roll die. |
| `RigPicker.jsx` | 55 | Amp/rig tone picker. |
| `ScoreTrackOverlay.jsx` | 51 | Corner score tracks. |
| `tipLayout.js` | 51 | `placeTipCard` — where a tip card fits on screen. |
| `StatKnob.jsx` | 47 | A single stat knob. |
| `NoteCommitOverlay.jsx` | 118 | 🎛️ Panel chrome for the note-commit overlay — `ChordStackPanel`, `CommitTrackPanel`, `PayoutRouterPanel`, `StackNest`, `stackSeatPos` and the `COMMIT_OVERLAY` tuning block. Panels lean (`skewX`) and un-skew their contents exactly once; the chord stacks lay their seats out as an interlocking honeycomb anchored to each panel's outer edge. Geometry read off `.scratch/note-commit-overlay.html`. ⚠️ SHELL ONLY: the numbers and the click handlers stay in the client, so a mistake here can misplace a panel but cannot cut across the melody commit. |
| `ChannelStrip.jsx` | 247 | 🎛️ The column beside the character card — the turn rail (three lamps, one lit, each with its own one-line state), the key plate (root, mode, the interval map) and DB Progress at the foot. Exports `ChannelStrip`, `StripSection`, `TurnRail`, `KeyPlate`, `CHANNEL_STRIP` (Alex's dial-in) and `BOARD_TILT`. `KeyPlate` is STEP-AWARE as of 2026-08-29: from the melody commit onward it prints the NEXT round's key with a `↻ NEXT ROUND` badge, and it carries the Note Stock as a fold-away drawer (the panel in the column stands down, and the `note-stock` tutorial anchor moves with the content — never two copies). ⚠️ SHELL ONLY, like `NoteCommitOverlay.jsx`: every number and every "which step is live" rule arrives as props, so a mistake here can misdraw a lamp but cannot reach the turn state. ⚠️ `designWidth` is 286 and the column is 238 — read the note. |
| `ActionRail.jsx` | 250 | 🎛️ Step 3's Move & Act buttons: the raked, chamfered button treatment and the UNIVERSAL / SIGNATURE split. Exports `ActionRail` (the two-sided container, seam and side labels), `RailBtn` (a `<button>` whose label rides in a counter-skewed span) and `ACTION_RAIL` (Alex's dial-in, 2026-08-29). ⚠️ SHELL ONLY, like `ChannelStrip.jsx` — every gate, handler and label stays in the client. ⚠️ `RailBtn` is not optional sugar: there is no CSS-only way to counter-skew a text node, so a rail button written as a bare `<button>` gets sheared words. The geometry CSS lives under `.arail` in `GameStyles.jsx` and reads the `RAIL_VARS` custom properties this file sets. |
| `NoteFlyChip.jsx` | 137 | 🎵 A committed note in flight — a real `NoteHex` on a bowed arc from the note stock to its seat, morphing to the seat's size, its bracket ring spinning, shedding rings behind it. Exports `NoteFlyChip` and the `NOTE_FLIGHT` tuning block (dialled on `.scratch/note-commit-overlay.html`). ⚠️ The path is driven through the Web Animations API, not CSS: the endpoints are wherever the seat is, and a keyframe cannot be told that. |
| `CadenceToast.jsx` | 45 | "Cadence resolved" toast. |
| `BoardFX.jsx` | 24 | Board effect wrapper. |

---

## "Where do I change X?"

> 🎯 **THE MOST USEFUL TABLE IN THE REPO, AND THE ONE WORTH DEFENDING.** Audited
> row by row on 2026-08-21; six rows were fiction and are marked or gone.

| I want to change… | Go to |
|---|---|
| Character stats / balance | `data/spirits.js` → `SPIRIT_DEFS` |
| Any gameplay tuning number | `data/gameConstants.js` — 106 constants, and the first place to look |
| Win conditions | `data/gameConstants.js` → `FAME_TO_WIN`, `LIMELIGHT_TO_WIN` |
| Combat maths — damage, knockback, Fame from margin, the underdog ramp | `engine/systems/combat.js` → `marginToDamage`, `knockbackSpaces`, `fameFromMargin`, `underdogBonus` |
| What a fight *does* afterwards — Fame grants, stack loss, slides | `engine/systems/battleFlow.js` → `battleConsequences`, `runBattleFlow` |
| What an attack costs and rolls | `engine/systems/attackParams.js` → `attackParams` (⚠️ the one place; do not re-derive) |
| 🕒💿 What an ability costs per use, or how long it recharges | `data/gameConstants.js` for the numbers, `engine/systems/cooldowns.js` for the mechanism → `ABILITY_CD`, `ABILITY_DB_COST`, `firePatch`. ⚠️ `dbCost` in `data/skillTree.js` is the **one-time unlock**, a different number. And an ability missing from those tables is free and uncooled — nine still are; `RONIN_ABILITY_DESIGN.md` §0.2 is the ledger. |
| 🎛️ Amp dice pool / die size / radius | `engine/systems/sonicRig.js` → `rigTiers`, `rigRadius`; floors in `data/gameConstants.js` → `RIG_RADIUS_FLOOR`, `RIG_POOL_FLOOR`, `RIG_ATROPHY_TURNS`. ⚠️ Radius **breathes with your stacks** — Drive on your turn, Sustain on theirs. There is no Range skill any more. |
| 🎪 The marquee quiz — payouts, lanes, atrophy | `data/trivia.js` (`TRIVIA_REWARD`, `TRIVIA_TIER_GRANT`, the bank) + `ui/EventModal.jsx` (the card) + `engine/policies/transition.js` (the headless resolve). See `MARQUEE_QUIZ_DESIGN.md`. |
| ✨ Limelight / Strike a Pose economy | `data/gameConstants.js` → `POSE_FP_STEP`, `POSE_FP_MAX`, `POSE_SUSTAIN_COST` + `engine/systems/limelight.js` → `posePayout`. ⚠️ Standing on the hex pays nothing; only a pose does. `LIMELIGHT_FAME` is legacy and no longer granted. |
| 💰 What a committed melody pays | `engine/systems/melodyCommit.js` → `commitMelodyEconomy`; the scoring itself in `music/cadence.js` → `scoreTrackDB`. ⚠️ Read `CLIENT_OWNED` first — some of it is still in `Game.confirmNoteTrack`. |
| 🎼 Which notes are legal / the pardon ladder | `music/context.js` → `CONTEXT_TIERS`, `classifyTrack`, `discordPenaltyFor`. See `THEORY_ARCHITECTURE.md`; history in `THEORY_REWRITE_LOG.md`. |
| Chord → Drive/Sustain | `music/chords.js` → `CHORD_TEMPLATES`, `evaluateChord` |
| Cadence objectives | `music/cadence.js` → `CADENCE_OBJECTIVES` |
| Scales, note spelling, intervals | `music/notes.js` |
| 🎓 The skill tree | `data/skillTree.js` → `SKILL_TREE`; the gate is `engine/systems/skills.js` → `skillEligibility` (⚠️ shared by bot and client — one gate). Routes in `THEORY_ROUTES_DESIGN.md`. |
| Fan economy tuning | `data/gameConstants.js` → `FAN_*`; the rules in `engine/systems/economy.js` → `applyFansTicked`, `fansFromDeed` |
| 🎸💥 The Smash | `data/gameConstants.js` → `SMASH_*` + `Game.resolveSmash`. ⚠️ Still unmodelled headless — the oldest debt in `SEQUENCING.md`. |
| 🧪 The slime trail | `engine/systems/slime.js` + `data/gameConstants.js` → `SLIME_*`. See `METALNESS_REWORK_DESIGN.md`. |
| 🔊 Going to eleven | `engine/systems/eleven.js` + `ELEVEN_DRIVE`, `ELEVEN_AMP_BLOWN_TURNS` |
| 🎇 Stage Effects | `data/stageEffects.js` (tuning) + `engine/systems/stageFx.js` (rules) + `board/stageFx.js` (geometry) + `ui/StageFXLayer.jsx` (visuals) |
| 🎸 Cursed Shamisen | `resolveCursedShamisen` / `payShamisenDebt` / `tickCursedShamisen` / `checkShamisenCursePenalty` — self-buff that accelerates other cooldowns; no board token |
| Event spaces | `data/events.js` + `EVENT SPACES SYSTEM` banner in `Game` |
| Trivia questions | `data/trivia.js` — write against `TRIVIA_CONTENT_BRIEF.md` |
| 🤖 How the bot values a position | `engine/policies/evaluate.js` → `EVAL_WEIGHTS`. ⚠️ **Measure, don't guess** — `BOT_STRATEGY_HANDOFF.md` records which weights are measured and which are still guesses, and §5.D⁷ of `SEQUENCING.md` shows a weight that made things *worse* when raised. |
| 🤖 What the bot is allowed to consider | `engine/policies/legalActions.js` → `legalActions` |
| 🤖 Bot personalities | `engine/policies/bot.js` → `BOT_PERSONALITIES` |
| 🎲 What the headless harness does *not* model | `engine/policies/play.js` → `HARNESS_GAPS` (⚠️ add to it rather than leaving a mechanic silently absent) |
| Riff-off generation | `riff/riffGeneration.js` |
| Riff-off timing feel | `riff/fallingNotes.js` → `RIFF_FALL_DIFFICULTY` |
| Riff-off verdict maths | `engine/systems/riffOff.js` → `riffStats`, `RIFF_GRADE_WEIGHT` |
| Riff-off input/judging | `RIFF-OFF ENGINE` banner in `Game` (`riffStartRun` / `riffPressKey`) |
| Riff-off highway visuals | `ui/RiffHighway.jsx` |
| 🔒 Which Riff Mode rooms playtesters see | `ui/RiffMenu.jsx` → `RIFF_MODES_UNLOCKED` (module-local; `null` disables the gate) |
| 🗺️ Fretboard Recon levels / ranks | `ui/FretboardRecon.jsx` → `TIER_CONFIG`, `RANKS`, `LIVE_SET_LENGTH`, `scoreSet`, `recommendFor` |
| 👂 Ear Spy mic sensitivity | `audio/chroma.js` → `CHROMA_DEFAULTS`. ⚠️ Measured, not guessed — `npm run test:chroma` prints the table. `EAR_SPY_HANDOFF.md` §2. |
| 👂 Ear Spy detection / placement / verdict | `music/keyDetect.js`, `music/neckPlacement.js`, `music/riffAnalysis.js`. The deliberate-discord call is `music/spice.js`, **shared with Discord Coach**. `EAR_SPY_HANDOFF.md` §3. |
| 👂 Ear Spy Online wire | `net/riffWire.js` → `WIRE_DEFAULTS` + `net/earSpyLink.js` + `server/index.js` |
| 📷 Camera fretboard detection | `vision/neckDetect.js` (finding it), `vision/neckGeometry.js` (the maths), `vision/fretFusion.js` (fusing with audio). `GUITAR_NECK_HANDOFF.md`. |
| 🎨 Board colour schemes | `board/stageSkins.js` → `STAGE_SKINS`. ⚠️ Hue angles are MEASURED against the real art — read the file header before adding one. |
| Board map / hex layout | `board/hexMap.js`, `board/constants.js` |
| Board overlay: Commit Track / Chord Stack / Voicing Panel | Monolith, `RENDER` banner → search `COMMIT TRACK`, `CHORD STACK`, `FLOATING VOICING PANEL` |
| A specific overlay or modal's look | The matching file in `ui/` |
| CSS keyframes / global styles | `ui/GameStyles.jsx` |
| BGM tracks / riff SFX | `audio/bgm.js` / `audio/riffSfx.js` |

### 🪦 Rows that used to be here, and what happened to them

⚠️ **Kept deliberately.** Somebody who learned this file a month ago will still
look for these, and "it moved" is a cheaper answer than a silent absence.

| The old row said | Truth |
|---|---|
| Amp range / chaining → `AMP_RANGE`, `AMP_LINK_DIST` | **Both constants deleted.** The amp-rig graph (`board/ampRigs.js`) is gone; radius is `engine/systems/sonicRig.js` → `rigRadius`. |
| 🎵 Styles → `styleCommitDb`, `detectStyleRun`, `detectContourTurn`, `detectCellRepeat`, `detectResolvedDiscords` | **All five deleted with the Style system.** Style pays nothing now; it is an icon, a colour and a tagline. The tombstones in `music/cadence.js` and `engine/systems/economy.js` explain why: they re-scored gestures the Drive and Sustain boosts already pay for. `STYLE_SYSTEM_HANDOFF.md` describes the deleted system and is history, not instructions. |
| Skill tree → `SKILL_TREE` (main file, module-level) | Moved to `data/skillTree.js`. `DISCORD_UPGRADE_TIERS` is still module-level in the monolith. |
| Riff-off feel → `RIFF_LEN`, `RIFF_NOTE_WINDOW` (main file) | `RIFF_NOTE_WINDOW` lives in `riff/riffGeneration.js`; `RIFF_LEN` is still module-level in the monolith. |
| Dissonance Edge → `EDGE_*` + `Game.edgeCombatMods` | ⚠️ **THE MECHANIC IS GONE AND SO IS THE STUB (2026-09-01).** No `EDGE_*` tuning constant exists anywhere (the `EDGE_HEX_NUMS` / `EDGE_DIST` in `board/` and `evaluate.js` are board-edge *distance*, unrelated). `edgeCombatMods` outlived the mechanic for a while as a function returning `{ drive: 0, sustainPenalty: 0 }` from seven call sites — two battle resolvers, both stat knobs, the rival row — and adding `+ 0` in seven places is exactly the kind of scaffolding that invites someone to "fix" the bot by tuning a system that does not exist. It was deleted with its call sites. `DESIGN_AUDIT_v2.md` §9 describes the design it used to have. |
| 🤘 Rock God boss → `data/rockGods.js`, `engine/systems/rockGod.js`, `board/rockGodFx.js`, `ui/RockGodLayer.jsx`, `hooks/useRockGod.js` | **All five deleted 2026-09-01, and the `state.rockGod` slice, the seven `GOD_*` actions and the `rockGodActive` view flag went with them.** The endgame boss is parked as a possible add-on, not shelved-in-place: the design survives at `docs/archive/ROCK_GODS_DESIGN.md`, the code does not. What changed in play: reaching the Fame target now crowns you outright at any margin — it used to summon the boss on a close race, and that summon was a one-way door that made the Fame win unreachable for the rest of the match. `FAME_RACE_CONTESTED_LEAD` in `data/gameConstants.js` is the one survivor, and it only picks a colour. |
| 📖 How to Play → `tutorial/content.jsx` | **Deleted 2026-09-01** — the illustrated rulebook and its two menu entries (TitleMenu, Lobby). To be rebuilt from the ground up. ⚠️ The `data-tip-anchor` attributes it aimed at are STILL LIVE and still load-bearing: 🎓 Beginner Mode uses the same anchors, so the "four tutorial pages point at this name" comments through `ui/` and the monolith remain true of the tips. |
| `engine/systems/skills.js` → `ULTIMATE_PREREQS` | **Deleted 2026-08-20** — it named three ids that were not in the tree, and no skill carried the matching `prereq`, so the Ultimate branch was unreachable in both directions while the test was green against a fake tree. |

---

## ⏱️ The round clock — what "a turn" means

A **TURN** is one player acting. A **ROUND** is one full revolution of the turn
order. Shared board state runs on the ROUND; personal state runs on the TURN.
🎯 **The rule of thumb: *if it can hurt or help someone who isn't acting, it waits
for the round.***

- **Round detection lives in `engine/systems/turn.js`** (`rollRound`, module-local)
  and is **anchored, not counted**: `turn.roundStarterId` is whoever opened the
  revolution, and the round closes when play returns to them. ⚠️ The old
  `count % aliveCount` drifted on every knockout and every skipped turn.
  `turn.roundPending` banks a round that a SKIPPED turn closed, since skips run no
  ticks; eliminating the anchor closes the round and re-anchors on the next actor.
- **On the ROUND clock** (`endTurn`'s `report.roundCompleted` block): stage FX
  (smoke, lasers, pyro arm→erupt, animatronic steps), spotlight move, Lost Chord
  scatter and drift, Disco Inferno decay, marquee respawn, charge-zone cooldowns,
  board-card respawn, the Cursed Shamisen.
- **On the TURN clock** (the acting Spirit's own end of turn): debuff ticks, Burn,
  the fan economy, the spotlight heal, poison-slime decay, **and rig atrophy** —
  ⚠️ a clock counted in spirit-turns runs four times too fast in a four-handed
  game, which is why atrophy ticks on the owner's own turns only.
- **Durations were RESTATED, not relabelled** — see the ⏱️ comments in
  `data/stageEffects.js` and `data/gameConstants.js`. Animatronics went 5
  player-turns → 2 rounds; pyro 3 waves → 2.
- **Everything on the board now runs on one of those two clocks.** The one exception
  was the Rock God, who ran on WALL-CLOCK time; he was archived on 2026-09-01.

**Hazards never start on a player.** Laser beams and pyro charges are rolled around
occupied hexes (`rollLaserBeams`, `rollPyroHexes`), and nothing deals damage at roll
time. Hazards bite on ENTRY only — walking in costs you, and shoving a rival onto a
live beam still works.

---

## 🗂️ The other docs — which map is which

The design lives in Markdown next to the code. ⚠️ **A doc that has drifted is worse
than no doc** — if you find one that has, say so plainly rather than editing around it.

| Doc | What it is |
|---|---|
| `SEQUENCING.md` | 🧭 **START HERE.** §5 is always the current session handoff and the next step. |
| `GAME_BRIEF.md` | 🎲 **The game itself, portable.** Every rule and every live tuning value in one self-contained file, written to be handed to another tool with no repo access so design changes can be thought through away from the code. ⚠️ It quotes ~80 constants by value — regenerate it from the source when they move, or it becomes the exact kind of confidently-wrong map this file's own header is about. |
| `BOT_STRATEGY_HANDOFF.md` | The bot, the evaluator, the cost web, the kits. Which weights are measured, which are guesses. |
| `MULTIPLAYER_HANDOFF.md` | The engine extraction, phase by phase — what the engine owns and what React still holds. |
| `NETCODE_HANDOFF.md` | The server, rooms, relay, spectating. |
| `THEORY_ARCHITECTURE.md` / `THEORY_ROUTES_DESIGN.md` | The chord-context ladder and the Theory routes. |
| `THEORY_REWRITE_LOG.md` | 🪦 History of how that ladder was built. **Nothing in it is pending.** |
| `AMP_DECK_DESIGN.md` | The rig. §2 and §4 are current; ⚠️ §5–§7 are a historical implementation log. |
| `MARQUEE_QUIZ_DESIGN.md` | 🎪 The quiz card, the lanes, the workout, atrophy. |
| `TRIVIA_CONTENT_BRIEF.md` | The spec for writing new trivia, somewhere cheaper than a coding session. |
| `METALNESS_REWORK_DESIGN.md` | 🧪 The Metalness Monster kit. |
| `CHARACTER_HANDOFF.md` | Per-character state. |
| `RIFFOFF_HANDOFF.md` | 🎸 The duel. |
| `EAR_SPY_HANDOFF.md` | 👂 Mic listening, the gates, the benches. |
| `GUITAR_NECK_HANDOFF.md` | 📷 The camera fretboard. |
| `PRACTICE_MODES_HANDOFF.md` / `LEGEND_LESSONS_HANDOFF.md` | The practice rooms. |
| `ROCK_GODS_DESIGN.md` | 🤘 The endgame boss. |
| `CREW_SYSTEM_DESIGN.md` / `RIFF_RAT_DESIGN.md` / `DRIVE_SUSTAIN_SPLIT_DESIGN.md` | Open design arms — see `SEQUENCING.md` for which are live. |
| `ECONOMY_HANDOFF.md` / `DESIGN_AUDIT.md` / `DESIGN_AUDIT_v2.md` | Economy analysis and audits. ⚠️ v2 §9 describes the Dissonance Edge, which is removed. |
| `POLISH_HANDOFF.md` / `OPENING_MOVIE_HANDOFF.md` | Presentation work. |
| `STYLE_SYSTEM_HANDOFF.md` | 🪦 **HISTORY.** Describes the Style system, which is deleted — Style is flavour only now. |
| `STANCE_SYSTEM_DESIGN.md` / `STANCE_V2_HANDOFF.md` / `STANCE_PARTS_BIN.md` | 🪦 **SUPERSEDED**, and they say so in their own headers. Stances are cut; the parts bin is a menu for a future redraw, not live content. |

---

## Conventions

- 🧭 **Navigate by banner comments, not line numbers.** Lines shift with every edit.
- 🎯 **Rules go in `engine/`, not in `Game`.** A rule written in the client is
  invisible to the harness, the bench and the replay. If you must leave one there,
  declare it — `HARNESS_GAPS` in `policies/play.js`, or `CLIENT_OWNED` in
  `systems/melodyCommit.js`.
- 🎲 **Never call `Math.random()` in a rule.** Draw from the engine rng, and draw
  in a position that does not depend on an outcome — a draw whose place in the
  stream moves is a replay divergence waiting to happen.
- ⚠️ **A passing test is not evidence a rule is real.** `legalActionsCheck` §15 was
  green for months against a skill-purchase mechanic the game does not have,
  because the test was written from the same misunderstanding as the code. **When
  checking whether the engine matches the game, read the CLIENT.**
- 📌 **`Game` is still a God component**, and that is a known cost rather than a
  plan. `hooks/` and `ui/` are the seams; further reduction means moving *logic*
  into the engine, not more state into hooks.
- ✍️ **Comment the WHY and the failure mode**, not the what. `⚠️` marks a trap
  someone could reasonably fall into; `📌` marks a note for later.
- 🔤 **Filename case is load-bearing.** Windows resolves a wrong-case import;
  the Linux box Render builds on does not. `npm run check:bundle` must end with
  **zero warnings** — it caught six real case mismatches that had been sitting in
  the output as scenery for months.
- 🗺️ **Update this file in the same pass as the code.** `npm run test:arch` will
  fail if you don't, which is the only reason it is still true.
