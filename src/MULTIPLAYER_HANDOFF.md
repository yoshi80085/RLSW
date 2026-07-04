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
- **3d — retaliation chain.** `RETALIATION_OFFERED/ROLLED/EXPIRED` actions;
  the ’prompt→spin→settling→result’ phases become engine `battle.phase`
  transitions; the countdown timer stays client and dispatches EXPIRED.
- **3e — riff-off damage hookup.** `closeRiffOff` currently applies damage
  client-side from the Phase-4 verdict; route it through the same 3c actions
  and delete `marginToDamage` double-call drift risk.

Landmine: `resolveWinDamage`/`battleKnockback` fire inside timeout chains that
read `battleStateRef`/`spiritsRef` — port them to read the engine state
snapshot returned by `dispatch` instead (the Phase-2 `dispatch` already
returns next state synchronously for exactly this).

## 6. First-session kickoff checklist

1. Confirm the working tree is committed (owner does this).
2. Read `ARCHITECTURE.md`, skim `Game`'s banner map, then start Phase 1.
3. After each phase: `/tmp` lint + node tests, owner smoke-test, commit,
   update `ARCHITECTURE.md` + tick the phase here.

| Phase | Status |
|---|---|
| 1. Scaffold + RNG | ☑ engine/ created (state, actions, rng, reduce, serialize + selftest.mjs); `Game` holds `engineState`; selftest green, engine lint clean. Owner: smoke-test + commit from Windows. |
| 2. Turn & movement | ☑ engine owns turnQueue/beats/facing/limelight-flags/counters via 10 actions; `Game` wired through `dispatch` (24 call sites); `spiritsSynced` bridge until Phase 3; selftest extended, `/tmp` esbuild compile green. TIP: `git show HEAD:path` beats the stale mount for reading true file bytes; verify main-file edits by replaying the same string replacements onto a `/tmp` copy and compiling with `npx esbuild --loader:.jsx=jsx`. |
| 3. Combat | ◑ **3a + 3b COMPLETE, 3c kernels done** — pure combat math (`marginToDamage`, `fameFromMargin`, `knockbackSpaces`, `underdogBonus`) extracted to `engine/systems/combat.js`; `Game` imports all four (locals deleted; `underdogBonus` now takes the two Fame totals, keeping the spirit-identity guard in `Game`). selftest extended (bands, sonic caps, underdog ramp + exact regression grid vs old math) — full suite green; engine lint clean; HEAD+edits esbuild-compile clean. **3b complete** — swing (d6) + sonic (keep-highest `dicePool`) via `ATTACK_ROLLED`/`applyAttackRolled` on engine rng; smash via pure `smashOutcome` (no roll), shared by `resolveSmash` + `resolveBlasterOfRa`. Human + bot share all three. selftest + esbuild + engine lint green. **3c kernels done** — `decideWinner` + `resolveKnockdown` extracted (pure, single-source) and wired into the win-check + respawn/KO paths; game identical. selftest + esbuild + engine lint green. **Remaining:** the 3c ownership flip (engine `spirits` becomes source of truth, `DAMAGE_APPLIED/KNOCKED_OUT/...` actions, kill `spiritsSynced`) — a big-bang across ~25 sites best done where the app can be RUN — then 3d retaliation + 3e riff-off damage hookup. Owner: `npm run dev` smoke-test + commit from Windows. |
| 4. Riff-off | ☑ done BEFORE Phase 3 (cleanest seam, budget call). Engine owns riff generation (rng threaded through `riff/riffGeneration.js` via optional `rand` param), Riff Slayer glitch sets, E-Rush ghosts, results submission, verdict math incl. Round-2 sudden-death fallback (`systems/riffOff.js`). Client submits `[{hit, rt, grade, noteIdx}]` per performer — the exact networked flow. Timing/gems/beam cinematics stay client. `riffStats` + scoring constants moved to engine; main imports `riffStats` from there. Damage application still client (waits on Phase 3). |
| 5. Economy & skills | ☐ |
| 6. Events / FX / Rock God | ☐ |
| 7. Bot policies | ☐ |
| 8. Serialize + replay | ☐ |
