# MULTIPLAYER_HANDOFF — extracting the authoritative game core

> **For the next AI session.** This brief was written by a session that already
> mapped the codebase (and rebuilt the riff-off — see `RIFF-OFF ENGINE` notes
> below). Read `ARCHITECTURE.md` first; navigate the main file by its banner
> comments, not line numbers. Keep this doc updated as phases land.

---

## 1. Mission & definition of done

Build the **multiplayer foundation**: extract the game rules out of the
`Game` component (`rlsw-simulator-v3_8_1.jsx`, ~11.8k lines) into a pure,
serializable, deterministic **engine** that a server (or host client) could
run authoritatively later. **Netcode, servers, and lobbies are explicitly out
of scope** — a later, cheaper session bolts those on.

Done means:

1. `src/engine/` holds pure modules: full game state as one plain-JSON object,
   advanced only by `applyAction(state, action, rng) → state`.
2. The React `Game` component consumes the engine: it dispatches actions and
   renders state. Presentation (cinematic timers, FX, overlays) stays in React.
3. Every `Math.random()` in game *rules* goes through an injectable seeded RNG.
4. Headless node tests can simulate a full turn (move → attack → end turn)
   with no DOM and no React.
5. The game plays **identically to today** — hotseat + bots keep working after
   every phase. No rules changes. If a phase can't end green, don't start it.

## 2. Ground rules (hard-won)

- **Incremental, never big-bang.** One system per phase; game playable after
  each; commit per phase.
- The repo owner runs `npm run dev` on Windows to smoke-test. The Cowork
  sandbox **cannot run vite/eslint from the repo's node_modules** (Windows
  binaries) and the file mount goes stale after edits — verify by copying
  changed files to `/tmp`, linting with `npx eslint --no-config-lookup` plus a
  minimal flat config, and running pure-logic tests in node. (Proven workflow.)
- **Never commit from the sandbox.** The stale mount can feed git *truncated*
  file contents — checkpoint `34cd776` stored the main file cut off at ~11.4k
  of 11.8k lines. The OWNER commits from Windows (GitHub Desktop). Sandbox git
  is for reading (`log`/`show`) only. Corollary: the sandbox cannot
  compile-check the main file after editing it (its mount copy is stale);
  newly *created* files propagate fine — lint/test those in `/tmp`, and rely
  on the owner's `npm run dev` to validate main-file edits.
- Update `ARCHITECTURE.md` in the same session as structural changes.

## 3. Current reality (what you'd otherwise spend tokens rediscovering)

State lives in ~dozens of `useState` hooks inside `Game`, plus custom hooks
that own slices: `useNoteSystem` (noteStates — per-spirit resources/skills),
`useFanEconomy`, `useBoardState` (amps/tokens/cards), `useRiffState`,
`useStageEffects`, `useRockGod`, `useBgmState` (client-only).

**Landmine: ref mirrors.** Because rules run inside `setTimeout` chains, the
code keeps refs in sync with state (`battleStateRef`, `noteStatesRef`,
`actingRef`, `spiritsRef`, `winnerRef`, `rockGodRef`, …) and reads refs in
async callbacks. This entire pattern *dissolves* once rules become
`applyAction` on an explicit state object — the reducer never has a stale
closure. Treat every `*Ref` read inside game logic as a marker of code that
belongs in the engine.

**Landmine: time-driven rules.** Cinematics (battle intro timers, beam-clash
stages, Rock God telegraphs, bot pacing via `botBusyRef`/`schedule`) mix
presentation delays with rule transitions. In the engine, a transition is one
action (`BEAM_CLASH_RESOLVED`); the *delay* before dispatching it is client
presentation. The bot step-machine (`BOT …` banner) becomes: bot policy
computes an action → dispatch — pacing stays in React.

**Already-clean seam: the riff-off.** A riff performance reduces to a results
array `[{hit, rt, grade, noteIdx}]` — `botRiffResults` proves the engine never
needs keystrokes. Real-time play (falling gems, `riffEngineRef`, rAF highway
in `ui/RiffHighway.jsx`, timing in `riff/fallingNotes.js`) stays 100%
client-side; the engine action is `RIFF_RESULTS_SUBMITTED { turn, results }`.
This is the template for how multiplayer riff-offs will work: each client
performs locally, submits results.

**Landmine: RNG everywhere.** Riff generation, event decks, trivia, bot
choices, god attack picks, glitch note picks, knockback scatter — all call
`Math.random()` directly (also inside `riff/riffGeneration.js` and
`data/`-adjacent helpers). Engine phases must thread `rng()` through.

## 4. Target shape

```
src/engine/
  state.js       // makeInitialState(gameConfig) → plain JSON GameState
  actions.js     // action type constants + creators (serializable payloads)
  rng.js         // mulberry32-style seeded PRNG; rng.split/fork per subsystem
  reduce.js      // applyAction(state, action, rng) → new state (root reducer)
  systems/       // board.js, movement.js, combat.js, riffOff.js, economy.js,
                 // skills.js, events.js, stageFx.js, rockGod.js, turn.js
  serialize.js   // snapshot/restore + (later) action-log replay
```

GameState (serializable): `spirits, turnQueue, acting, fame, noteStates, amps,
boardTokens, boardCards, chargeZones, eventSpaces, unsurePool, battle
(riff-off = generated riffs + submitted results only), rockGod, stageFx,
winner, rngSeed/cursor`.
Client-only (NOT in GameState): hover/zoom/pan, damageFx/moshpit/FX queues,
`riffRun` + riff engine timers, dice spin faces, BGM, log strings (derive from
actions later), skip-intro prefs, `riffView`/`riffDifficulty`.

## 5. Extraction order (each phase ends green)

1. **Scaffold + RNG** — engine skeleton, seeded RNG, `makeInitialState` from
   `Lobby`'s gameState; wire `Game` to hold `engineState` in one `useState`.
   Nothing else moves yet.
2. **Turn & movement** — turn queue, beats, movement/facing (`board/` helpers
   are already pure — reuse), limelight tracking, `END TURN` ticks.
3. **Combat** — swing/sonic/smash resolution, knockback, KO/respawn/win check
   (`BATTLE SYSTEM`, `BATTLE KNOCKBACK`, `KNOCK OUT` banners). Dice spin stays
   client; roll = engine action with rng.
4. **Riff-off** — riff generation + resolve/margins into engine;
   `RIFF_RESULTS_SUBMITTED` seam as above. (Engine already refactored to a
   clean results pipeline — see `RIFF-OFF ENGINE` banner.)
5. **Economy & skills** — noteStates, chords/melody scoring (`music/` is
   already pure), fan economy, skill tree, mod cards, crew/gear.
6. **Events, stage FX, Rock God** — event deck, stage effects ticks, boss AI
   (attack picks via rng; telegraphs are state, timing is client).
7. **Bots as policies** — `botPlanMove`/step-machine decisions become pure
   `policy(state, rng) → action`; React just paces dispatches.
8. **Serialize + replay test** — snapshot/restore mid-game; headless replay of
   an action log reproduces identical state (determinism proof = the actual
   multiplayer foundation).

Phases 2–4 are the heart; if budget runs short, stopping after any green phase
still leaves the repo better than today.

## 5b. Phase 3 (combat) — surgical plan, pre-analyzed

Written by the session that landed Phases 1/2/4, after mapping the combat
code. Execute in order; each sub-phase ends green (game plays identically).
Combat is a WEB of setTimeout cinematics — the iron rule: **a cinematic waits,
then dispatches; the reducer never waits.** All `Math.random()` in rolls/spins
becomes engine rng; dice *animation* faces stay client.

Function map (navigate by name, not line): `marginToDamage`, `awardFame`,
`knockbackSpaces`, `battleKnockback`, `applyVibeDamage`, `resolveWinDamage`,
`initiateSwing` (~1 AP jab), `resolveSmash` (all-in), `initiateSonicAttack`
(amp-scaled dice), the retaliation chain (`retaliation_prompt/spin/settling/
result` phases + `retaliationTimer` countdown + `ownsCQC` gate +
`retaliationBlocked` for unplugged targets), `applyKnockOut`/respawn, and the
`checkWinner` boss-aware win check.

- **3a — damage & fame math (pure, no wiring risk).** ☑ DONE. `marginToDamage`,
  `fameFromMargin`, `knockbackSpaces`, `underdogBonus` now live in
  `engine/systems/combat.js`; main imports them (same trick as `riffStats`),
  local defs deleted. `underdogBonus` is pure over the two Fame totals — the
  `!loserId`/self guard + `noteStates` reads stay in `Game`'s thin wrapper. No
  actions yet. selftest covers the tables + an exact regression grid vs the old
  `Game` math.
- **3b — rolls as actions. ☑ COMPLETE (swing d6 + sonic keep-highest as
  `ATTACK_ROLLED`; smash as pure `smashOutcome`).** `ATTACK_ROLLED { kind, attackerId, defenderId,
  atkStat, defStat, posing, halveDef, psychoEligible }` → engine rolls via rng,
  stores the verdict in `state.battle` (`atkRoll/defRoll/atkTotal/defTotal/
  attackerWon/margin/damage/psychoBushido`). The spin overlay reads the
  already-decided face; timing stays client. Bot + human paths share it (both
  go through `initiateSwing`). ◑ **SWING done** (owner-chosen incremental
  checkpoint): `applyAttackRolled` in `systems/combat.js`; `initiateSwing`
  dispatches it and reads the verdict off the synchronous `dispatch` return; the
  client still pre-computes `atkStat`/`defStat` (they read `noteStates`, Phase
  5) and passes the mod flags. selftest covers determinism, posing, Laser halve,
  Psycho Bushido, and an exact verdict-regression vs the old `Game` math.
  ◑ **SONIC done** too: `applyAttackRolled` takes an optional `dicePool` — when
  present it rolls each die and KEEPS THE HIGHEST (records `diceVals`+`keptIdx`
  for the overlay), else a single swing d6. `initiateSonicAttack` computes the
  amp-scaled pool client-side (`sonicDicePool`, still reads amp/skill state) and
  dispatches it; defender d6 / posing / Laser are the shared path. selftest adds
  keep-highest correctness across [6,6]/[6,6,6]/[6,6,8]/[8,8,8], the 3d8-beats-d6
  case, and a sonic verdict regression. ☑ **SMASH done** — the Smash has NO dice
  roll, so it's a pure-math extraction (not an rng action): `smashOutcome(thrown,
  {roninSmasher, roninTarget}) → {damage, knockback, scatterN}` in
  `systems/combat.js`, used by both `resolveSmash` and `resolveBlasterOfRa`
  (single source, kills their formula-drift risk). selftest = exact regression
  grid over thrown 2–14 × Ronin flags + caps + Blaster parity. **3b COMPLETE.**
- **3c — damage/knockback/KO as actions.** `DAMAGE_APPLIED`, `KNOCKBACK_MOVED
  { path }`, `KNOCKED_OUT`, `RESPAWNED`, `WINNER_DECLARED`. Engine owns spirit
  vibe/lives/knockedOut — this is the moment the Phase-2 `SPIRITS_SYNCED`
  bridge dies. Remove every `spiritsSynced` dispatch and the ref mirrors that
  only served combat (`spiritsRef`, `battleStateRef` reads inside rules).
  Biggest sub-phase; do swing first, then sonic, then smash, green after each.
  ◑ **KERNELS DONE** (owner-chosen: pure cores first, no ownership flip yet):
  `decideWinner` (boss-aware win check) + `resolveKnockdown` (respawn/KO
  transform) extracted to `systems/combat.js` and wired single-source into
  `knockOut.checkWinner`, `knockOut.applyKnockOut`, and `applyVibeDamage`'s
  inline respawn. selftest covers both; game plays identically. **STILL TO DO —
  the ownership flip:** make the engine `spirits` the source of truth (client
  reads `engineState.spirits` everywhere, ~25 `setSpirits` sites incl. non-combat
  become dispatches), add `DAMAGE_APPLIED/KNOCKED_OUT/RESPAWNED/WINNER_DECLARED`
  actions that mutate engine spirits, and delete the `spiritsSynced` bridge. This
  is a big-bang best done in a session that can RUN the app (build + test the
  flip as it lands), not compile-check only — see the note below.
- **3d — retaliation chain.** ◑ **COUNTER ROLL DONE:** `COUNTER_ROLLED`
  (`applyCounterRolled`) rolls the counter d6 on engine rng, adds the Vibe bonus
  (`round(vibe/maxVibe × 3)`), and decides success vs the attacker's winning die
  — merged into the live `battle` slice; `resolveRetaliation` dispatches it and
  reads the verdict. Landed-counter margin/damage is pure `counterOutcome`
  (`finishCounter`). selftest covers both. **Remaining 3d:** the
  `prompt→spin→settling→result` phases as engine `battle.phase` transitions +
  `RETALIATION_OFFERED/EXPIRED` (the countdown timer stays client and dispatches
  EXPIRED) — lands with the 3c ownership flip, since the damage application it
  gates (`resolveWinDamage`/`awardFame`/`battleKnockback`) is still client.
- **3e — riff-off damage hookup.** ◑ **DRIFT KILLED:** the riff-off `verdict`
  now carries `damage` (computed once in `applyRiffResolved` via the shared
  `marginToDamage`); `riffResolve` reads `verdict.damage` instead of re-deriving
  the round-bonus formula client-side. **Remaining:** route the *application* of
  that damage (still `resolveWinDamage` inside `riffResolve`/`closeRiffOff`)
  through the same `DAMAGE_APPLIED` action combat will use — lands with the 3c
  ownership flip.

> **Phase 3 status — LOGIC-COMPLETE (deliberate stop, owner's call).** All
> combat *rules* are engine-owned and verified: damage/knockback/fame math (3a),
> every roll (3b — swing d6, sonic keep-highest, smash pure math), the win-check
> + knockdown/respawn kernels (3c), the counter roll + outcome (3d), and the
> riff-off verdict damage (3e). What's intentionally NOT done is the **spirit
> ownership flip** (engine `spirits` as source of truth, `DAMAGE_APPLIED/
> KNOCKED_OUT/RESPAWNED/WINNER_DECLARED` actions, deleting `spiritsSynced`).
> That flip reaches into events / stage FX / Rock God / skills (their `setSpirits`
> writes + their not-yet-extracted state), so it's really cross-phase, and it's
> the one change that can only be *compile-checked* here, never run. **Recommended
> next step:** do it in a session that can run `npm run dev`, bundled with Phase 5
> (when `noteStates` and `spirits` move into the engine together). Until then the
> `spiritsSynced` bridge stays and the game plays identically to before Phase 3.

Landmine: `resolveWinDamage`/`battleKnockback` fire inside timeout chains that
read `battleStateRef`/`spiritsRef` — port them to read the engine state
snapshot returned by `dispatch` instead (the Phase-2 `dispatch` already
returns next state synchronously for exactly this).

## 5c. Phase 5 (economy & skills) — pre-analyzed plan

Written after mapping the code (banners + function names below are verified
against the live file). Phase 5 is the biggest remaining phase because it
absorbs the **deferred 3c ownership flip** — `spirits` and `noteStates` become
engine-owned *together* (they're read/written by the same functions). **Do
this in a session where the owner can run `npm run dev` between sub-phases.**

**The state.** `noteStates` (one object per spirit, built by
`makeInitialNoteState`, ~60 fields) is the whole per-spirit economy: note
stock/melody/chord stack, HC + tier points, skill tree progress
(`unlockedSkills`/`targetSkillId`/`discordUnlocks`/`swingUpgrades`), statuses
(burn/stagger/mojoDrain/intimidation/…), crew & gear cooldowns, mod cards,
fame, and the fan economy block (diehards/casuals/streaks/excitement/loyalty).

**Two serialization landmines, fix in 5a:**
1. `usedStockIdx` is a **JS `Set`** — violates the plain-JSON GameState
   contract. ☑ DONE (5a). Converted to a plain **insertion-ordered array** of
   spent-slot indices via three pure helpers in `systems/economy.js`
   (`usedHas`/`usedList`/`usedAdd`); all ~29 sites in the main file now go
   through them. **NOTE: insertion order, NOT sorted** — `startNewTurnNotes`
   recharges the slots spent *first* (`[...usedStockIdx].slice(0,
   STOCK_REFILL_RATE)`); sorting would silently change which slots refill.
   Insertion order is still JSON-safe + replay-deterministic. selftest fuzzes
   `usedAdd` ≡ the old `new Set([...used, ...idxs])` over 200 cases.
2. `makeInitialNoteState` calls `Math.random()` for the starting root — must
   take `rng`. Same for `refillStock` if it randomizes. ◑ **HALF DONE (5a):**
   `randomNote`/`refillStock` (music/cadence.js) and `makeInitialNoteState` now
   accept an **optional `rand` param** (defaults to `Math.random`, so behavior is
   unchanged), same treatment as Phase-4 `riffGeneration`. The actual *threading*
   of the engine rng into the init-hook call site is deferred to **5c**, where
   `noteStates` becomes engine-owned and the seeded rng is naturally in scope.

**Function map** (navigate by name): note track — `clickNoteStock`,
`declarePivot`, `clearNoteTrack`, `useBankedNote`, `confirmNoteTrack`,
`startNewTurnNotes`, `applyPendingCombatEffects`; skills —
`applySkillEffects`, `setSkillTarget`, `awardTargetSkill`, `purchaseSkill`,
`chooseUpgrade`, `grantHC`; crew/gear — `deployGroupie`, `fireUltimate`,
`startRoadieAction`, `roadieReplugAmp`, `placeAmp`, `unplugRivalAmp`; mod
cards — `playModCard`, `resolveTransposeCard`; fame — `grantFame`,
`awardFame` (margin path already engine: `fameFromMargin`/`underdogBonus`);
fan economy — `gainFans`, `tickFans`, `demolishFans`, `gainFansFromDeed`,
`triggerUnsureWin`, `arenaFans`. `music/` is already pure — reuse, don't move.

**Sub-phases (kernels → actions → flip, the proven Phase-3 shape):**

- **5a — contract fixes + scoring kernel. ☑ DONE (sandbox-safe slice).**
  (1) `usedStockIdx` Set→array via `usedHas`/`usedList`/`usedAdd` (see landmines
  above). (2) optional `rand` param on `randomNote`/`refillStock`/
  `makeInitialNoteState` (full rng threading deferred to 5c). (3) **Performance
  Score P extracted** — the pure flair kernel (melodic shape + palette +
  gestures + motif + length nudge + edge/sus/freestyle) is now
  `performanceScore({...}) → {score, freestyle}` in `systems/economy.js`;
  `confirmNoteTrack` calls it at one site. selftest fuzzes it ≡ the old inline
  math over 3000 random tracks. Verified: full main file esbuild-transforms
  clean; engine selftest + economy lint green.
  **NOT extracted (deliberate):** the rest of `confirmNoteTrack`'s "scoring core"
  is mostly *orchestration* over already-pure `music/` helpers (`scoreTrackHC`,
  `detectChromaticRun`, `driveBoostFromRun`, `sustainBoostFromPattern`,
  `detectDiatonicRun`, `detectRepeatPattern`, `detectMotifRepeat`, `advanceHC`)
  interleaved with React setters / FX / `addLog` / a live voice-roll rng and the
  Dissonance-Edge side effects (`applyVibeDamage`, `showTip`). There is no large
  additional *pure* block to lift without running the app — a `trackOutcome`
  that returns all the `setNoteField` effects is really the 5c flip. So P (the
  one clean, self-contained numeric kernel) is the right 5a extraction; the rest
  lands with 5c. Audio/FX/log stay client.
- **5b — skills as pure kernels. ☑ DONE (eligibility + tables; effects deferred).**
  The pure skill-tree **gating** is now `skillEligibility(skill, unlocked,
  {ownerRoute, selfId}) → {ok, reason, missing?}` in `engine/systems/skills.js`,
  plus the pure tables `ULTIMATE_PREREQS`, `THEORY_DISCORD_GRANTS`,
  `CQC_SWING_MAP`. Both call sites now share it: `botSkillEligible` is a one-line
  wrapper, and `setSkillTarget` maps `reason`→its exact toast (they had DRIFTED —
  the bot enforced owner-only routes, the human didn't; the human keeps its
  no-owner behavior by passing no `ownerRoute`). selftest fuzzes
  `skillEligibility` ≡ BOTH old implementations over 4000 combos + reason/missing
  spot-checks. **NOT extracted (deliberate):** `applySkillEffects` is ~95%
  side-effects — `addLog`, `setSpirits` (+1 CQC Drive), `setNoteStates` (discord
  grants, roadie hire), `showTip`. There's no pure `skillEffectsOutcome` to lift
  without turning the writes into the 5c dispatches; the grant *tables* it reads
  are now the single-source pure exports above, so 5c just routes them through a
  `SKILL_AWARDED` reducer. Audio/FX/log stay client.
- **5c — THE OWNERSHIP FLIP** (spirits + noteStates into engine state,
  big-bang by necessity — this is the deferred Phase-3 3c). Split into an
  engine-reducer layer (sandbox-safe, selftest-verifiable) and a client-flip
  layer (needs `npm run dev`, done in owner-smoke-tested increments).
  ◑ **ENGINE FOUNDATION DONE (spirit combat-ownership):** `DAMAGE_APPLIED`
  (Vibe −, floored), `KNOCKDOWN_RESOLVED` (respawn/KO via the `resolveKnockdown`
  kernel — subsumes RESPAWNED/KNOCKED_OUT), `WINNER_DECLARED` (locks the `winner`
  slice; decision = the `decideWinner` kernel) now exist in `actions.js`/
  `combat.js`/`reduce.js` and are selftest-covered (damage floor, respawn-vs-KO,
  winner, replay determinism). They are **dormant** — the client doesn't dispatch
  them yet, so the game plays identically and the `SPIRITS_SYNCED` bridge still
  carries spirit state.
  ◑ **NOTESTATES FOUNDATION DONE:** `makeInitialNoteState` moved into
  `engine/systems/economy.js` (pure, seeded — uses the 5a `rand` param), and
  `makeInitialState` now builds + OWNS `engineState.noteStates` on a FORKED rng
  (`"noteStatesInit"`) so it's replay-deterministic without consuming the main
  stream (`rng.cursor` stays 0 → every existing roll byte-unchanged). Also
  **dormant** — the client still builds/reads its own React `noteStates`; the
  engine copy is authoritative + ready for the flip. selftest covers per-spirit
  build, determinism, cursor-untouched, single-source rebuild, JSON-safety.
  ⚠️ The client's `Game.makeInitialNoteState` is now a temporary DUPLICATE of the
  engine one (byte-identical) — the flip deletes the client copy and reads
  `engineState.noteStates`.
  **CLIENT FLIP — IN PROGRESS (owner-run):**
  ◑ **Slice 1 DONE (source-of-truth shim), pending smoke-test.** `spirits` is now
  a view of `engineState.spirits`; `setSpirits(updater)` is a compat shim that
  applies the update to the live engine spirits and writes back via
  `spiritsSynced` (full replace). Engine is now the single source of truth and all
  ~30 `setSpirits` sites keep working unchanged (behavior-identical). Main file
  esbuild-transforms clean.
  ⚠️ **Bug found + fixed in smoke-test:** the 3 `spiritsSynced(spirits)` bridge
  dispatches (turn-skip, pre-move, end-turn) had to be removed immediately, not in
  "cleanup" — post-flip `spirits` is the render-lagged `engineState.spirits`, so
  re-dispatching it clobbered engine state that had advanced via timeout chains
  (knockback slides settle over ~600ms; `endTurn`'s bridge reverted the knocked-back
  position). Lesson: once `spirits` derives from the engine, any `dispatch(spiritsSynced(spirits))`
  is a stale self-write — the bridge must die WITH the shim, not after. `spiritsRef`
  rule-reads are still fine (they read the rendered value, same as before).
  ◑ **Slice 2a DONE (compile-clean + engine-selftest green), pending smoke-test.**
  `applyVibeDamage`'s Vibe subtraction (the central hit-application, reached by
  swing/sonic/smash/riff/counter via `resolveWinDamage`) now dispatches
  `damageApplied(targetId, dmg)` instead of a `setSpirits` full-replace — a
  behavioral no-op (`applyDamageApplied` does the identical `max(0, vibe−dmg)`
  floor). `damageApplied` imported from `engine/actions.js`. The 80ms knockdown
  check below it still reads the freshly-reduced engine spirits (dispatch updates
  `engineRef` synchronously). Verified: full main file esbuild-transforms clean
  (via the replay-onto-HEAD trick — the mount `cp` truncates); `node selftest.mjs`
  green. ✔ **Owner smoke-tested OK.**
  ◑ **Slice 2b DONE (compile-clean + engine-selftest green), pending smoke-test.**
  `applyVibeDamage`'s post-damage knockdown check (the +80ms `setTimeout`) was a
  `setSpirits(prev => …)` used purely as a *synchronous reader* (`prev` was always
  `engineRef.current.spirits`). Rewrote it to read `engineRef.current.spirits`
  directly and dispatch `knockdownResolved(targetId)` for the respawn transform
  (same `resolveKnockdown` kernel the reducer runs). No-KD / KO-branch early
  returns just bail now (the old `return prev` self-write of an unchanged array
  was a harmless no-op). Zero staleness — the read + dispatch are same-tick.
  `knockdownResolved` imported. ✔ **Owner smoke-tested OK + committed (`9064442`).**
  ◑ **Slice 2c DONE (compile-clean + engine-selftest green), pending smoke-test.**
  `knockOut`'s two `applyKnockOut` sites (the +4s slide-off timeout path and the
  no-hex fallback) now `dispatch(knockdownResolved(tgtId))` and read `.spirits`
  off the return for `checkWinner`. Deleted the `applyKnockOut` helper and dropped
  `resolveKnockdown` from the combat import (no code refs left — only comments).
  Reconfirmed the captured-`tgt` concern is a non-issue: `spiritEliminated`
  (dispatched before the transform for a true KO) only edits `turnQueue`/`acting`,
  so the engine spirit still carries the `lives/num/corner/facing/maxVibe`
  `resolveKnockdown` reads → identical result, no stale-closure risk. `checkWinner`
  now also shadow-writes the engine `winner` slice via `dispatch(winnerDeclared(
  winnerId))` alongside the React `setWinner` (engine slice stays dormant — UI
  still reads React `winner` at line 784 — but is now populated for replay).
  `winnerDeclared` imported. ✔ **Owner smoke-tested OK + committed (`9d11c37`).**
  ◑ **Slice 2d DONE (compile-clean + engine-selftest green), pending smoke-test.**
  The `spiritsRef` mirror is GONE. Its 4 async rule-reads (`triggerMoshpit` loser
  lookup, `botPlanMove`/`botRivalsWithin` occupancy, the bot step-machine
  `liveSelf`) now read `engineRef.current.spirits` — the authoritative store,
  updated synchronously by `dispatch`, so strictly fresher than the render-lagged
  ref ever was (the old `?? spirits` fallbacks are dropped; `engineRef.current`
  is always a valid state). Declaration + its `useEffect` sync deleted. No code
  references to `spiritsRef` remain (only the descriptive comment). Verified:
  replay-onto-HEAD (`9d11c37`, has 2a–2c) esbuild-transforms clean; `node
  selftest.mjs` green. **⚠️ Owner: `npm run dev` — play a full-ish match (bot
  movement/targeting + a moshpit-skill KO if reachable) to confirm bot pathing and
  the Master-of-Moshpits crowd FX still behave.**
  **Remaining spirit-flip cleanup:** the two non-combat `setWinner` sites (Rock God
  champion crowning ~L4616, Fame-runaway victory ~L4789) still don't shadow
  `WINNER_DECLARED` — fold those in when Phase 6 (Rock God) / the fame flip lands.
  The spirit half of the flip is otherwise COMPLETE (all combat spirit writes are
  engine actions; `spiritsSynced` now only carries the remaining non-combat
  `setSpirits` sites — movement/facing/drive/position — which already have Phase-2
  actions and can migrate later). **Next major work — the noteStates half:**
  actions `NOTE_TRACK_CONFIRMED`, `SKILL_AWARDED`, `MOD_CARD_PLAYED`,
  `CREW_DEPLOYED`, `FAME_GRANTED`, `FANS_CHANGED`; move `makeInitialNoteState`
  into the engine (it needs `NOTE_POOL`/`canonicalRoot`/`refillStock` + the seeded
  `rand` from 5a) so `engineState.noteStates` can be built + owned; ~dozens of
  `setNoteStates` sites → dispatches; delete `noteStatesRef` reads inside rules.
  Do the spirit flip first (smaller, unblocks combat), green + smoke-test, THEN
  the noteStates flip.
  ◑ **noteStates SLICE 1 DONE (compile-clean + engine-selftest green), pending
  smoke-test.** The source-of-truth shim (mirrors the spirits slice-1 flip):
  engine side adds a `NOTE_STATES_SYNCED` full-replace bridge action
  (`noteStatesSynced` creator, `applyNoteStatesSynced` reducer in
  `systems/economy.js`, wired in `reduce.js`) — selftest-covered (map replace,
  untouched sheets by-ref, consumes no rng). Client side: `useNoteSystem` retired;
  `noteStates` is now a view of `engineState.noteStates` (built + owned by
  `makeInitialState` on the forked seeded rng), and `setNoteStates(updater)` is a
  compat shim that applies the update to the live engine map and writes it back via
  `noteStatesSynced`. All ~60 `setNoteStates` sites keep working unchanged.
  **⚠️ BEHAVIOR DELTA (intended):** starting hands are now SEEDED per game seed
  instead of `Math.random` — the replay-determinism payoff, but the opening
  roots/stock a given match deals will differ from before. Verified: engine
  `selftest.mjs` green (reconstructed edited engine, dodging the stale mount — the
  mount served a stale `economy.js`); main file esbuild-transforms clean
  (replay-onto-HEAD `6df9561`). **⚠️ Owner: `npm run dev` — thorough smoke-test,
  this touches EVERY note-track / skill / fan / fame interaction: build & confirm a
  note track, buy a skill, deploy crew, play a mod card, gain/lose fans, take a
  knockdown (FP −1), and confirm a full match to a Fame win. Starting hands looking
  different is expected.**
  ◑ **noteStates SLICE 2 DONE (compile-clean), pending smoke-test.** Dropped the
  `noteStatesRef` mirror: all 21 `noteStatesRef.current` rule-reads (burn-armed,
  unlocked-skills, fame sorts, chordStack, bot planning) now read
  `engineRef.current.noteStates` — the authoritative store, synchronously fresh,
  so strictly fresher than the render-lagged ref. Declaration + its sync
  `useEffect` deleted (only the descriptive comment keeps the name). Engine
  untouched (the `NOTE_STATES_SYNCED` bridge is already committed → selftest still
  green); main file esbuild-transforms clean (replay-onto-HEAD `8aebb20`).
  **⚠️ Owner: `npm run dev` — verify bot skill/fame decisions + the burn-armed
  swing bonus still behave (these read the note map in async callbacks).**
  ◑ **noteStates 3a DONE (compile-clean + engine-selftest green), pending
  smoke-test.** First semantic-action migration: `FAME_CHANGED { spiritId, amount }`
  — a SIGNED delta floored at 0 (`applyFameChanged` in `systems/economy.js`, wired
  in `reduce.js`, selftest-covered: +delta, floor-at-0, no-sheet no-op). `grantFame`
  now `dispatch(fameChanged(spiritId, finalFp))` instead of a `setNoteStates`
  full-replace — a no-op there (finalFp>0 so the floor never bites); the crowd
  multiplier / stage-FX thresholds / Fame-win check stay client. One action
  intentionally covers the whole fame economy so the two knockdown −1 penalties
  (currently multi-field `setNoteStates` writes, still on the bridge) can route
  through it later. Verified: engine `selftest.mjs` green (reconstructed edited
  engine); main esbuild-transforms clean (replay-onto-HEAD `2cc0c19`). **⚠️ Owner:
  `npm run dev` — win a battle / land a riff / trigger an Azrael or underdog bonus
  and confirm Fame ticks up correctly and a Fame win still fires.**
  ◑ **noteStates 3b DONE (compile-clean), pending smoke-test.** Both knockdown
  −1 FP penalties (the `applyVibeDamage` respawn path and `knockOut`'s slide-off
  respawn path) now `dispatch(fameChanged(id, -1))` — engine floors at 0
  (selftest-covered since 3a; the reducer's no-sheet no-op replaces the old
  slide-off-site guard, which is also why the guard wasn't re-created client-side:
  it would have read render-scoped `noteStates` inside a 4s timeout — stale). The
  `recovering:false` / `knockStreak:0` resets stay on the bridge (they'll migrate
  with a status-group action). NOTE: the no-hex KO fallback (`knockOut` tail)
  never applied the penalty before and still doesn't — preserved as-is, don't
  "fix" it into the reducer. Engine untouched. Verified: main esbuild-transforms
  clean (replay-onto-HEAD). **⚠️ Owner: `npm run dev` — take a knockdown (Vibe
  loss) and a slide-off knockdown; confirm the −1 FP + respawn both still work.**
  ◑ **noteStates SLICE 4 DONE (FANS_CHANGED — engine + client, compile-clean +
  selftest green), pending smoke-test.** Engine: `FANS_CHANGED { spiritId, fans }`
  merges ONLY the whitelisted fan fields (`FAN_FIELDS` in `systems/economy.js`:
  diehards/casuals/centerStreak/outerStreak/fanLag/fanActedThisTurn/divineShield —
  a stray payload can't clobber fame/skills/notes; no-sheet → no-op; consumes no
  rng). selftest covers every field, both whitelist rejections, by-ref sheets,
  rng-cursor, no-sheet. Client: ALL 10 fan-write sites now dispatch it —
  `gainFans`, `tickFans` (updater rewritten to read `engineRef.current.noteStates`
  — the live map, exactly what the shim's `prev` was), `demolishFans` (target +
  victor-defection as two dispatches; its `Math.random()` flee roll stays client —
  the outcome rides in the payload, the RIFF_RESULTS_SUBMITTED pattern, so replay
  is still exact), `gainFansFromDeed`, the perf-grow block in `confirmNoteTrack`,
  divine_mission (recall + blessing), all 3 divineShield spends (demolition /
  flaming disc / stage hazard), and the two dev-panel grants. The fan economy no
  longer touches the `noteStatesSynced` bridge. `unsurePool` stays React state
  (client), folds in with 5d. Verified: engine selftest green (HEAD+deltas
  reconstruction), main esbuild clean (14-edit replay-onto-HEAD incl. 3b).
  **⚠️ Owner: `npm run dev` — commit a clean track in the centre (fans gain +
  promotion), idle a few turns on the outer ring (boredom decay), get demolished
  centre-stage (scatter + defection + Unsure), play divine_mission if reachable
  (shield blocks the next demolition), and end several turns (tickFans).**
  ◑ **noteStates SLICE 5 DONE (NOTE_SHEET_PATCHED + diffing shim + dup deletion),
  pending smoke-test.** Instead of hand-migrating the remaining ~50 heterogeneous
  `setNoteStates` sites, the SHIM itself now diffs: it applies the updater against
  the live engine map, then dispatches `NOTE_SHEET_PATCHED { spiritId, patch }`
  per changed sheet (field-level diff, `!==`). Anything a merge can't express
  (sheet-key removal, added/removed spirit ids) falls back to the full-map
  `NOTE_STATES_SYNCED` — final state identical either way, so this is a behavioral
  no-op that turns every remaining legacy write into a small, per-spirit,
  replayable action. The full-map bridge is now FALLBACK-ONLY (likely never fires
  in normal play — no site deletes sheet keys). Also: the client
  `makeInitialNoteState` duplicate is DELETED (~90 lines) — the main file imports
  the engine's from `systems/economy.js` (the `actingNoteState` fallback uses it);
  dead imports pruned (`NOTE_POOL`, `semitonesUp`, `refillStock`). True semantic
  actions (NOTE_TRACK_CONFIRMED, SKILL_AWARDED, …) remain future work for
  server-authoritative RULES, but the log/serialization goal of retiring the
  bridge is achieved. selftest covers the reducer (merge scalar/array/object,
  no-whitelist, by-ref, no-rng, no-sheet no-op).
  ◑ **5d DONE (FANS_TICKED — the first noteStates RULE in the engine), pending
  smoke-test.** `applyFansTicked` (economy.js) runs the end-of-turn fan tick
  verbatim from the old `tickFans`: zone from the ENGINE's spirit position
  (`hexRingFromCenter` — pure board helper), centre/floor/outer streak rules,
  FAN_BORED_AFTER/FAN_DECAY boredom, fanLag recovery, acted-flag reset; report in
  `state.turn.lastFanTick { spiritId, zone, lost }`. Client `tickFans` is now a
  one-line dispatch + log/FX off the report, at the SAME end-of-turn beat as
  before — so the rule-critical tick ORDER (§5d note) is unchanged; the remaining
  ticks fold in at Phase 6d. selftest: all zone branches, decay boundary + floor,
  lag recovery, report contents, no-rng, byte-identical replay.
  ◑ **8a DONE (action log + export), pending smoke-test.** `dispatch` now appends
  `{ action, cursorBefore }` to `actionLogRef` (a ref — no re-renders); the
  Testing Grounds panel has **💾 EXPORT ACTION LOG** (`devExportLog`), downloading
  `{ schema, seed, config, actionCount, log }` as JSON — with `makeInitialState`
  that is the complete server-replay bundle. Phase-8 selftest log widened with
  `FAME_CHANGED` / `FANS_CHANGED` / `NOTE_SHEET_PATCHED` (and 5d's `FANS_TICKED`
  block proves its own replay) — the byte-for-byte proof now spans the whole
  economy write layer.
- **5d — fan economy tick as action.** `FANS_TICKED` inside `END_TURN`
  processing (see §5d tick-order note below); `demolishFans` folds into
  `DAMAGE_APPLIED`/`KNOCKED_OUT` handling.

## 5d. Phase 6 (events, stage FX, Rock God) — pre-analyzed plan

**Function map:** events/board — `spawnEventHex`, `pickTrivia` (rng in
`data/trivia.js`), `answerTrivia`, `checkEventTrigger`, `resolveActiveEvent`
(inline `d6()` — rng), `checkFlamingDisc`, `checkTokenPickup`, Lost Chords
(`bankLostChordNote`/`resolveLostChordPickup`), charge zones
(`grantChargeBoost`/`curatedChordNote`/`grantChargeChordAssist`/
`checkChargeZonePickup`/`resolveChargeChoice`), board cards
(`pickRandomCardType`/`spawnBoardCards`/`checkCardPickup`/`resolveCardPickup`);
stage FX — `checkStageFxThresholds`, `activateStageFx`, `zapSpiritsInBeams`,
`checkStageFxHex`, `tickStageFxTurn`, `tickStageFxRound`, `isHiddenBySmoke`;
Rock God — `summonRockGod`, `attackRockGod`, `godDefeated`, `godTriumphs`,
`rockGodAct`, `pickGodAttack` (rng in `data/rockGods.js`).

**Landmines:**
- `useStageEffects` shuffles `stageFxDeck` at mount with `Math.random()` and
  guards fired thresholds in a `firedRef` **Set** — deck order becomes
  engine state (seeded shuffle at `makeInitialState`), fired-set becomes a
  plain array in state.
- `useRockGod` keeps `godSummonedRef`/`rockGodRef` mirrors — same dissolve-
  into-reducer treatment as combat. `bossTimer`/`bossTimerExpired` are the
  retaliation-countdown pattern: timer is CLIENT, expiry dispatches
  `GOD_TIMER_EXPIRED`. Telegraph = state; the wait before it resolves =
  client.
- **END TURN tick order is rule-critical.** Today (inside `endTurn`):
  limelight fame faucet → end-of-turn debuff tick → burn tick → stage FX
  tick → god answers (telegraph resolves / new attack opens) → fan economy
  tick → spotlight heal check → Disco Inferno flame decay. The engine's
  `END_TURN` handler must replicate this exact order or games diverge.
  Write the order as a selftest (fixture state → END_TURN → assert each
  system saw the right pre-state).

**Sub-phases:** 6a event/card/charge picks as rng actions (`EVENT_SPAWNED`,
`CARD_SPAWNED`, `TRIVIA_DRAWN`, pickup resolutions as choice actions);
6b stage FX — ◑ **DECK + THRESHOLDS ENGINE-OWNED (2026-07-07), pending
smoke-test.** `state.stageFx { deck, fired, lastDraw }`: the deck is shuffled
ONCE at `makeInitialState` on a `"stageFxDeck"` fork (main cursor stays 0;
⚠️ behavior delta: show order is now SEEDED per game, was a Math.random mount
shuffle), and `STAGE_FX_DRAWN { threshold }` (`systems/stageFx.js`) records the
threshold exactly-once (replacing the client `firedRef` Set — dup → `lastDraw:
null`) and draws deck[fired.length−1]. Client `checkStageFxThresholds` dispatches
+ reads `lastDraw`; `useStageEffects` lost the deck/ref. selftest: permutation,
seed-determinism, cursor-0, draw order, dedup, no-rng, byte replay, JSON-safe.
**Remaining 6b:** the ACTIVE effects (smoke/laser/pyro/animatronics state, their
rng — `rollLaserBeams`/`rollPyroHexes`/`spawnAnimatronics` — and both ticks).
6c Rock God — ◑ **GOD_ATTACK_PICKED ENGINE-OWNED (2026-07-07), pending
smoke-test.** The boss's attack pick (the fight's rules-rng) rolls on engine rng:
client `rockGodAct` dispatches `godAttackPicked(god.id, god.lastAttack)` (the
ATTACK_ROLLED context pattern) and re-derives the attack def from
`state.rockGod.lastPick.attackId`; taunts stay client Math.random (log-only
flavor, never GameState). selftest: determinism, valid pick, rng consumed,
no-immediate-repeat ×120 seeds, unknown-god/empty-deck null, byte replay.
**Remaining 6c:** summon/act/defeat + HP/telegraph/winded state + the
`GOD_TIMER_EXPIRED` seam. 6d fold all ticks into `END_TURN` in the verified
order. Green after each; boss cinematics stay client.

## 5e. Phase 7 (bots as policies) — pre-analyzed plan

**Precondition: Phases 5–6 landed.** Bot code reads `noteStatesRef`/
`spiritsRef` everywhere; policies must read *engine state* instead — porting
them before the flips just doubles the work.

**Function map:** step-machine — `botStepRef` (`idle → building → committed →
moving → acting → ending`), `schedule()` pacing, `botBusyRef`; decisions —
`botPersona`, `botPickTarget`, `botHexScore`, `botPlanMove`,
`botSkillEligible`, `botPickSkillTarget`, `botBestFacing`,
`botNeighborForAmp`, `botRivalsWithin`, `botPlanNoteStep`, `botPlanRevoice`,
`botRevoiceChord`, `botRiffResults` (already the clean riff seam).

**Target shape:** `engine/policies/bot.js` (policies are *players*, not
rules — keep them out of `systems/`): `botPolicy(state, spiritId, rng) →
action | null` (null = end turn). The React step-machine survives only as a
*pacer*: take next policy action → dispatch → wait cinematic → repeat.
`botRiffResults` already synthesizes the `RIFF_RESULTS_SUBMITTED` payload —
use it as the template for the whole port.

**Sub-phases:** 7a pure scorers (`botHexScore`, `botPickTarget`,
`botPersona` weights) into `policies/` + selftest fixtures; 7b plan
functions → `policy(state, rng)` returning engine actions (rng-thread every
`Math.random()` pick); 7c step-machine slims to dispatch pacing — delete
`botBusyRef` rule-reads. Determinism test: same seed + same state ⇒ same
action sequence (this is what makes bots replayable in Phase 8 and
host-runnable in multiplayer).

## 5f. Phase 8 (serialize + replay) — pre-analyzed plan

**Skeleton already exists:** `engine/serialize.js` has `snapshot`/`restore`
(schema-versioned) and a `replay(initialState, actionLog)` loop;
`engine/rng.js` has `restoreRng({seed, cursor})`; selftest already does one
snapshot→restore round-trip. Phase 8 turns this into the determinism PROOF:

- **8a — action log.** `dispatch` (in `Game`) appends `{action, cursorBefore}`
  to a dev-flag log; add `EXPORT LOG` to the Testing Grounds dev panel.
- **8b — full-state audit. ☑ DONE (engine-only, sandbox-safe).** Grepped the
  whole engine: no `Set`/`Map`/`Date`/function/class-instance is *stored* in any
  GameState slice, and no `Infinity`/`NaN`/`undefined` reaches a stored field
  (the `new Set(...)` in `performanceScore` are transient `.size` locals; the one
  `Date.now()` is only `makeInitialState`'s default seed, captured into
  `state.rng.seed`). Known offenders stay fixed (`usedStockIdx` array; stage-FX
  fired set lands as an array in 6b). **Institutionalized:** added
  `assertJsonSafe(value)` to `serialize.js` — a dev/test walker that throws (with
  the exact path) on the first value that wouldn't round-trip through JSON. This
  closes a real hole in the proof: `snapshot(a) === snapshot(b)` compares two
  LOSSY `JSON.stringify` outputs, so a Set/Infinity/undefined could pass it while
  a live object and its restored twin diverge. selftest now walks a fresh
  `makeInitialState` and a replayed multi-system final state (both must be
  JSON-safe) and asserts the guard BITES on each injected offender (Set, Infinity,
  NaN, undefined, Date, function). No schema bump (nothing had to change).
  ⚠️ VM was down when this landed — `npm run test:engine` is the authoritative check.
  ✔ **Follow-up session verified (2026-07-06):** HEAD engine selftest runs green in
  the sandbox (`git archive HEAD` → /tmp → node, dodging the stale mount); the
  Windows files are intact — `serialize.js` has `assertJsonSafe` (line 49),
  `selftest.mjs` has the 8b guard tests (lines 876–918), and the main file ends
  cleanly at 11,694 lines (no truncation). ⚠️ NOTE: sandbox `git status` reports
  PHANTOM modifications — stale mount copies of committed files (truncated
  `selftest.mjs`, old `serialize.js`) differ from their committed content, so
  they show as "M" when the Windows tree is actually clean. Everything through
  5c slice 1 + 8b IS committed (verified via the real Windows reflog, readable
  with file tools at `.git/logs/HEAD` — that beats sandbox git for repo truth).
  Trust file tools (Windows paths), never the mount/sandbox-git, for "what
  changed".
- **8c — replay test.** Headless: `makeInitialState(seed)` → scripted
  ~50-action log spanning every system (move/attack/track/skill/event/god/
  riff via `botRiffResults`-style payloads) → assert
  `snapshot(replay(s0, log)) === snapshot(liveFinal)` **byte for byte**.
  Then the round-trip variant: snapshot mid-log, restore, replay the tail,
  same assert. Both land in `selftest.mjs` (runs in node, sandbox-safe).
- **8d — divergence hunt.** If bytes differ, bisect the log (replay halves)
  — the first diverging action names the system still calling
  `Math.random()` or mutating shared state. Fix, re-run, done.

Exit criterion = the §1 mission: a server replaying the log gets the same
game. When 8c is green, the multiplayer foundation is DONE; netcode is a
separate, cheaper project.

## 6. First-session kickoff checklist

1. Confirm the working tree is committed (owner does this).
2. Read `ARCHITECTURE.md`, skim `Game`'s banner map, then start Phase 1.
3. After each phase: `/tmp` lint + node tests, owner smoke-test, commit,
   update `ARCHITECTURE.md` + tick the phase here.

| Phase | Status |
|---|---|
| 1. Scaffold + RNG | ☑ engine/ created (state, actions, rng, reduce, serialize + selftest.mjs); `Game` holds `engineState`; selftest green, engine lint clean. Owner: smoke-test + commit from Windows. |
| 2. Turn & movement | ☑ engine owns turnQueue/beats/facing/limelight-flags/counters via 10 actions; `Game` wired through `dispatch` (24 call sites); `spiritsSynced` bridge until Phase 3; selftest extended, `/tmp` esbuild compile green. TIP: `git show HEAD:path` beats the stale mount for reading true file bytes; verify main-file edits by replaying the same string replacements onto a `/tmp` copy and compiling with `npx esbuild --loader:.jsx=jsx`. |
| 3. Combat | ◑ **3a + 3b COMPLETE; 3c kernels, 3d counter-roll, 3e verdict-damage done** — pure combat math (`marginToDamage`, `fameFromMargin`, `knockbackSpaces`, `underdogBonus`) extracted to `engine/systems/combat.js`; `Game` imports all four (locals deleted; `underdogBonus` now takes the two Fame totals, keeping the spirit-identity guard in `Game`). selftest extended (bands, sonic caps, underdog ramp + exact regression grid vs old math) — full suite green; engine lint clean; HEAD+edits esbuild-compile clean. **3b complete** — swing (d6) + sonic (keep-highest `dicePool`) via `ATTACK_ROLLED`/`applyAttackRolled` on engine rng; smash via pure `smashOutcome` (no roll), shared by `resolveSmash` + `resolveBlasterOfRa`. Human + bot share all three. selftest + esbuild + engine lint green. **3c kernels done** — `decideWinner` + `resolveKnockdown` extracted (pure, single-source) and wired into the win-check + respawn/KO paths; game identical. selftest + esbuild + engine lint green. 3d counter-roll (`COUNTER_ROLLED`/`counterOutcome`) and 3e verdict-damage (riff `verdict.damage`) also done + verified. **Remaining:** the 3c ownership flip (engine `spirits` becomes source of truth, `DAMAGE_APPLIED/KNOCKED_OUT/...` actions, kill `spiritsSynced`, route riff + counter damage application through it) — a big-bang across ~25 sites best done where the app can be RUN. Owner: `npm run dev` smoke-test + commit from Windows. |
| 4. Riff-off | ☑ done BEFORE Phase 3 (cleanest seam, budget call). Engine owns riff generation (rng threaded through `riff/riffGeneration.js` via optional `rand` param), Riff Slayer glitch sets, E-Rush ghosts, results submission, verdict math incl. Round-2 sudden-death fallback (`systems/riffOff.js`). Client submits `[{hit, rt, grade, noteIdx}]` per performer — the exact networked flow. Timing/gems/beam cinematics stay client. `riffStats` + scoring constants moved to engine; main imports `riffStats` from there. Damage application still client (waits on Phase 3). |
| 5. Economy & skills | ◑ **5a + 5b DONE** (sandbox-safe slices). **5a:** `usedStockIdx` Set→**insertion-ordered array** via `usedHas`/`usedList`/`usedAdd` (new `engine/systems/economy.js`, ~29 sites rewired); optional `rand` param on `randomNote`/`refillStock`/`makeInitialNoteState` (full rng-thread deferred to 5c); **Performance Score P** → pure `performanceScore()`. **5b:** pure `skillEligibility()` + tables (`ULTIMATE_PREREQS`/`THEORY_DISCORD_GRANTS`/`CQC_SWING_MAP`) in `engine/systems/skills.js`; `botSkillEligible` + `setSkillTarget` now share ONE gate (they had drifted on owner-only routes). selftest extended (usedAdd ≡ old Set ×200; performanceScore ≡ old inline ×3000; skillEligibility ≡ old bot+human ×4000). **5c ENGINE FOUNDATION DONE** (both halves). Spirit combat-ownership: `DAMAGE_APPLIED`/`KNOCKDOWN_RESOLVED`/`WINNER_DECLARED` reducers on engine spirits (reuse `resolveKnockdown`/`decideWinner`). noteStates: `makeInitialNoteState` moved to `engine/systems/economy.js` (seeded), `makeInitialState` builds+owns `engineState.noteStates` on a forked rng (main `rng.cursor` untouched). All selftest-covered, all **dormant** (client unchanged → game identical, `SPIRITS_SYNCED` bridge + client's own `noteStates` stay; client `makeInitialNoteState` is a temp duplicate). **Remaining 5c = the client flip (owner-run, `npm run dev`):** read `engineState.spirits`/`noteStates`, route damage/KO/track/skill writes through the new actions, delete `spiritsSynced` + the client noteState duplicate. **5d** pre-analyzed §5c. Owner: `npm run test:engine` (verifies both foundations) + commit from Windows. **SESSION 2026-07-07 — 5c CLIENT FLIP ESSENTIALLY COMPLETE + 5d DONE (pending smoke-test, see §5c log):** knockdown −1 FP → `FAME_CHANGED` (3b); all 10 fan sites → whitelisted `FANS_CHANGED` (slice 4); the shim now DIFFS per spirit → `NOTE_SHEET_PATCHED` (full-map `NOTE_STATES_SYNCED` is fallback-only) and the client `makeInitialNoteState` dup is deleted (slice 5); the end-of-turn fan tick is an engine RULE — `FANS_TICKED`, zone from engine position, report in `turn.lastFanTick` (5d). `demolishFans`' flee roll still `Math.random` client-side (outcome rides in the payload — replay-exact; make it engine rng in a later slice if desired). |
| 6. Events / FX / Rock God | ◑ **STARTED — data-layer rng prep (6b + 6c).** All direct `Math.random()` in `data/` now takes an injectable `rand = Math.random` (default preserves live behavior — dormant; same treatment as Phase-4 riffGeneration / Phase-5a economy). **6c:** `pickGodAttack`/`godTauntLine` (`data/rockGods.js`) — selftest locks weighted-draw boundaries (cum. weight 3/6/8/10), no-immediate-repeat, single-attack + empty-deck edges, taunt indexing, determinism, `pickRockGod` fallback. **6b:** `shuffledStageFxDeck` (`data/stageEffects.js`) — selftest locks exact Fisher-Yates output for two boundary rands, permutation invariants, determinism, default path. At the flips the engine builds each deck ONCE on the seeded rng so order becomes replay-deterministic GameState. Verified green against real modules (VM up). **2026-07-07:** 6b deck+thresholds and 6c attack-pick are now ENGINE-OWNED (`state.stageFx` + `STAGE_FX_DRAWN`; `systems/rockGod.js` + `GOD_ATTACK_PICKED`) — see §5d for details + the seeded-show-order behavior delta. Rest (6a events/cards/charge picks, 6b active effects + ticks, 6c god-state + timer seam, 6d END-TURN tick order) still pre-analyzed. |
| 7. Bot policies | ☐ pre-analyzed plan ready — §5e. Blocked until 5+6 land (bots must read engine state). |
| 8. Serialize + replay | ◑ **PARTIAL PROOF LANDED** (8c over today's engine-owned systems). selftest replays a scripted multi-system log (turn → move → attack → counter → damage → knockdown → winner → riff-off) and asserts `snapshot(replay(restore(snapshot(s0)), log)) === snapshot(live)` **byte-for-byte**, plus mid-game snapshot/restore/replay-tail and same-seed determinism. Widens to note-track/skill/event/god actions as those land (post-flip). **8b DONE** — full-state audit clean (nothing non-JSON stored) + `assertJsonSafe()` guard added to `serialize.js` and enforced in selftest (walks real + replayed state; asserts it bites on Set/Infinity/NaN/undefined/Date/function). **8a DONE (2026-07-07):** `dispatch` records `{action, cursorBefore}`; Testing Grounds → 💾 EXPORT ACTION LOG downloads `{schema, seed, config, actionCount, log}` (the full server-replay bundle). Replay proof widened over FAME_CHANGED/FANS_CHANGED/NOTE_SHEET_PATCHED/FANS_TICKED. Remaining: 8c full-system widening as Phase 6/7 land + 8d divergence hunt (pre-analyzed §5f). Owner: `npm run test:engine` + commit from Windows. |
