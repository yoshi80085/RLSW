# SEQUENCING — 🧭 the live handoff, the findings, and the index

> **For AI editors + Alex.** This file was **4,763 lines on 2026-09-04** — 31
> session handoffs stacked newest-first, with the original ordering thesis buried
> at line ~1347 between two of them. It was also the doc every session was told to
> read FIRST. **21% of all design text in the repo, of which 132 lines were live.**
>
> ✅ **RESTRUCTURED 2026-09-04.** The complete original is
> `docs/archive/SEQUENCING-full-through-2026-09-04.md`, unedited, searchable by
> section id. What stays here is what a session actually needs:
>
> | § | what it is |
> |---|---|
> | **A** | 🧭 **the current handoff** — what just happened and what is next |
> | **B** | 🎓 **the findings** — lessons that cost real money to learn, kept because each one is now a live defence in the test suite |
> | **C** | 📇 **the index** — every handoff (99 rows), dated, one line each, pointing into the archive |
>
> ⚠️ **NOTHING WAS DELETED.** If a line below is too short to act on, the full
> text is in the archive under the same section id.
>
> 📌 **NEW ENTRY POINT: read `STATE_OF_PLAY.md` first.** It is the current state
> of the whole game in one screen. This file is the *narrative* — what happened
> and what it taught. That file is the *state* — what is true right now.

---

# A. 🧭 THE CURRENT HANDOFF

## 66-iwatotrap. 🪤 The Cursed Shamisen becomes a trap — v3 designed and built — 2026-10-09

Alex (Cowork, linked to his machine): *"lets bring up Ronin's Cursed Shamisen ability - I believe it was changed recently"* → found v2 ("the haunting", 10-03) written but never built → *"How about this - Ronin can 'curse' a certain note on the board. It's invisible to any other player - it can be any note anywhere on the board - catch is, it only lasts 1 turn … The note that is cursed for the turn does not simply vanish and change locations"* → rulings one by one (melody only; the draw follows the curse halfway; the curse runs on if he is KO'd; one at a time; the Action Token, wasted or not; keep the 2-round cooldown; until his next turn; his own pickup disarms; *"It should be the note that is cursed - not Ronin's key"*; the springing turn counts — *"lets run with that"*; *"lets make all 3 notes come from creepy notes - the trapped note just sets the key. lets create the curse!"*) → build order: **rules in the game first**, the laying animation as its own preview next. Spec: `IWATO_CURSE_V3_SPEC.md` (v2 marked superseded; §2.3.00 kept as v1's record).

### What shipped
- **Rules** `engine/systems/iwatoCurse.js` (rewritten): `layCheck` / `layPatch` (token + cooldown; refusals: kit, trap armed, his curse still standing, token spent, recharging), `trapAt` / `armedTrapHexes`, **`springOutcome`** (disarmed · sprung · fizzled), `orphanedTraps`, `cursedPalette` on `curse.root`, `hauntedNotes`, **`liftOutcome`** (accumulating, several at once), `endCursedTurn` (3 turns; ~~`turnStartCurse`, the refresh~~ — removed by rule 16), `curseScene` (public: never the armed trap). The trap lives on HIS sheet (`ns.shamisenTrap`), the curse on theirs (`{ key, by, root, fromHex, targets, lifted, turnsLeft }`).
- `board/cursedShamisen.js`: `CURSE_TURNS` 3, `HAUNTED_NOTES` 3, `CREEPY_IVS` / `CREEPY_WEIGHTS` (♭2 3 · 4 1 · ♭5 3 · ♭7 1), **`hauntRand`** (seeded from the curse key — no draw from the match stream) and `pickHaunted`; `canTune` / `exorcises` / `EXORCISE_NOTES` gone.
- `board.js` `applyTokensDrifted`: an armed trap's Lost Chord holds hex AND age. `turnFlow.js`: his turn start wastes the trap (and clears a v1 `shamisen`); **the cursed draw seeps in** ⅓ → ⅔ (`music/cadence.js` `randomNoteBlend`, `cursedDrawShare` — same one-draw-per-note contract). `melodyCommit.js`: lifts replace the exorcism (`report.liftedNow`). `policies/transition.js` `collectPickups`: the spring on the bench's path too.
- **Client**: `layShamisenTrap` / `springShamisenTrap` replace `takeUpShamisen` / `resolveIwatoCast`; the spring runs inside `checkTokenPickup` before the token is taken; `myTrap` / `viewerSeesTrap` draw the trap **for the Ronin's screen only** (2D: a dashed violet hex, `data-shamisen-trap`; 3D: the crystal's `claim: 'cursed'`, `lostChords.js` `L.cursed`); one rail button (*Curse a Lost Chord* → *Trap set* / *Curse haunting* / recharging); the reach lights every Lost Chord; the STRINGS row, the `'strings'` dest and Tab's third stop (`noteKeys.js`) are gone; the cursed wheel gets `haunted` + the curse root; logs: nothing on lay or waste, the spring is public, each lift is announced.
- **Picture**: `cursedShamisenArena.js` rewritten — a new curse springs ANCHORED ON ITS HEX (`pointFor` = `arenaPoint`), the ghost shamisen plays the haunted notes, **all three wisps circle** the Rival (`cursedShamisenVisuals.js`: the slapping one orbits too; `burnOne` = a lift, it rises as it burns; the caller ends the curse). `CursedWheel`: haunted slots black with a breathing ring, ✓ when lifted, readout = lifted n/3 · held · turns left. The loadout pop-out (`abilityDemo.js`) tells the v3 story with the v1 cast as the spring (placeholder).
- Text: skill-tree description, applySkillEffects log, `MatchSurface` prompt, Spirit-window status, `gameConstants` comments, `ARCHITECTURE.md` rows.

### Found on the way
- ⚠️ **The spring's sound threw without an audio context** (`setValueAtTime` of undefined in jsdom) — and because the spring runs before the pickup, it **cost the pickup** (the token stayed, the note was never banked). v1 had the cast's sound as its LAST line, so the same throw was always silent. The theatre is now in a `try`.
- ⚠️ **Turn order is chord → melody → move.** A Rival springs the trap after their melody, so the springing turn's melody is never cursed: in practice two cursed melodies, with the refresh landing just before the first. ✅ Ruled by Alex: two cursed melodies is right (spec rule 15); the refresh is replaced by the seeping draw (rule 16).
- 🧰 `device_commit_files` again reported "written" over a file it had written earlier while the VM kept the old bytes (the spec) — committed under a new name and `cp`'d into place, `md5sum`-checked. Background jobs die with the `device_bash` call; the sweep ran in ≤165 s foreground batches.
- 🧹 Two stray files from this session's own scripts (`sweep.txt`, `_lintcheck_old.jsx`) were moved into `.scratch/_backup-iwato-v3/`; the pre-change copies of every touched file are there too.

### Evidence
- `test:shamisen` **113** (rewritten), mutation-tested **10/10** (the pin, the accumulation, the refresh's exclude, the cursed draw, the waste, the bench spring, the client spring, the disarm, one-at-a-time, the weighting).
- `test:shamisenjourney` **27** (rewritten; seeds 4 and 7): the real Game, clicks only — lay, token + cooldown, the mark on his screen and not the Rival's, the held hex, the spring on a real step (Iwato on the note, three creepy notes, the cursed wheel with three marks), the countdown, the refresh, a lift, the end.
- **Follow-up, same day (spec rules 15–16):** two cursed melodies confirmed; the refresh removed (`turnStartCurse`, `REFRESH_AT_TURNS_LEFT`, `refreshed`, `prefer`, the client log); the draw seeps in ⅓ → ⅔ (`cursedDrawShare`, `randomNoteBlend`). `test:shamisen` 113 (§8/§9 rewritten), mutation 3/3; `test:shamisenjourney` 26.
- **Then the noroi card (rules 17–18):**
  - The preview was dialled in (2 of 35 levers) and ported.
  - New: `board/noroiCard.js`, wired through `cursedShamisenArena.js` (`trap` / `ashes` / `onShatter` / `attachCrystals`).
  - Engine: `ashPatch` and `shamisenAsh`. Client: `shamisenAshTheatre`, `myTrap` into the frame, the cast's sound delayed by `NOROI_SPRING_CAST_DELAY_MS`.
  - Tests: `test:shamisen` 123 and `test:cursedshamisen` 132 + 44, mutation 6/6. Sweep 97/101, the same four red.
- `test:cursedshamisen` **132 + 23** (the arena stage rewritten for the spring on the hex, lifts, late joins, smoke). `test:abilitydemo` 143 + the same pre-existing red (the old preview lever). `test:notetechniques` 50, `test:lostchords` 89, `test:attacktiles` 29, `test:journey`, `test:arch` 8, `test:notekeys` 210.
- **Full sweep on the device VM: 93/97 green — the same four red as `64-lostchords`** (`bushido`, `swing`, `abilitydemo`, `bats`' rolldown half). `check:bundle` 0 warnings. ESLint: the monolith's 127 findings identical before and after; nothing new in the touched modules.
- ⏳ **Not rendered in WebGL** (no GPU run this session) and **not yet played by Alex**.

### Next
- ⏳ Alex: play it. Then the **laying / armed animation** as its own preview (ideas in the spec), and the ruling on when the 3-turn clock starts.
- Bots never lay it (a Ronin bot needs a rule for where); bots walk into it like anyone.

## 64-lostchords. 💎 The Lost Chords as 3D crystals — pitched, previewed, dialled, ported — 2026-10-08

Alex: *"Lets make the notes on the board 3D - Do you have a good idea to integrate them with the environment?"* → three pitches (crystals / a pick in the stone / notes riding the Riven debris) → *"the crystal idea sounds great, lets see it in the preview"* → *"can you set the preview in here?"* (published as the claude.ai Artifact *Lost Chord Crystals*) → his dial-in, **4 of 44 levers** (size .50→.44, stretch 2.20→2.15, embedded 3→6, letterGlow 1.6→1.7) → *"Looks great! Wire it in please!"*

### The idea
The round-end log already said Lost Chords *"crystallise from the harmonic interference"*; the 3D board now shows it. A faceted quartz shard floats over a lit crack in the hex, six small shards stuck in the crack, the note inside (a camera-facing sprite, so top-down reads), a pooled point light on the stone, motes. **The hunt colour is the client's own `unlockClaim` call**, the same one the 2D chip's hex glow makes. Moments: spawn (Riven-palette bolts rise from the crack), drift (motes stream to the new hex), Thrash scatter (shards burst off the hit Spirit and bounce), pickup (it lifts over the standee's head, rings, shatters; the note plays in the picker-up's own amp settings). Crystals hum their pitch when hovered and when a walk is armed (its reach rings, low to high).

### What shipped
- `src/board/lostChords.js` — `LOST_CHORD_LOOK` (= the dial-in), the pure clocks, **`planLostChordMoments`** (names each change from the token DIFF; the engine's `last*` notes only NAME a change, so a stale `lastThrashTokens` never replays a scatter), `createLostChords`, and **`createLostChordLayer`** (the game half).
- `src/audio/lostChordSfx.js` — the hum / crackle / whoosh / clinks / shatter / pluck; notes on the NOTES fader, effects on the SFX fader; the pluck keeps the client's register (`PC_FREQ_BASE`, C4–B4 — the suite reads that table).
- `arenaFrame` takes `lostChords` ({ tokens + claim, drifted, thrashed, hover, tones }); `arenaVisuals` mounts the layer (**floor on the arena canvas, crystal on the FOREGROUND scene** above the SVG click layer with the standees); `arenaRenderer`'s reduced-motion loop draws while a moment plays.
- Client (monolith): feeds `lostChords` (tokens + `unlockClaim(...).which`, `lastTokensDrifted`, `lastThrashTokens`, `hovered`, each Spirit's `toneOf`); the SVG token chip carries `data-arena-flat="lost-chord"` and `BoardViewport` hides it in 3D; **`checkTokenPickup` skips its own pluck while the 3D arena is up** (the crystal plays it at the break, so it sounds once).
- `.scratch/lost-chord-preview.html` now imports the game's two files (one copy of the look); the claude.ai Artifact was republished from it. The old `.scratch/lostChordCrystals.js` / `lostChordSfx.js` are in `_to_delete/`.

### Found on the way
- ⚠️ **A pickup waits for the standee.** The engine drops the token on the click; the standee hops ~420 ms later. The crystal is held until the pawn stands on it (2.5 s cap; 0.45 s with no pawn — a smoke-hidden Spirit or the Ronin's double).
- ⚠️ **Lights are a fixed pool** (`LIGHT_POOL` 8 + one spawn flash). The preview built a light per crystal and per spawn; in three.js a new light recompiles every lit material in the arena — a hitch at every round end. The suite caught the spawn flash (17 lights vs 8).
- ⚠️ The pickup pluck register: I first assumed A4–G#5; the suite reading `PC_FREQ_BASE` showed C4–B4.
- 🧰 **device_commit_files can silently not overwrite** a file it wrote earlier in the session (it reported "written", the VM saw the old bytes). Committing under a NEW name and `cp`-ing into place on the device works; verify with `md5sum` every time.

### Evidence
- `test:lostchords` **88** (new, in `test:all`): the dial-in, the clocks, every naming case, two canvases, the constant light count, the pickup that waits, the frame, the client's three touch points, one copy of the look, the pluck register. **5/5 mutants caught** (no wait, a light per crystal, one canvas, first frame spawns, a scatter from anywhere — the last one added a check).
- Full sweep on the device VM: **93/97 green**. Red, none from this: `bushido` (the Shadow-double gap), `abilitydemo` (the old preview lever), `swing` (`fallen` after a knockdown) — all three red in `63-hammeron` too — and `bats`, whose plain-node half passes (179) and whose second half needs rolldown's linux binding the VM lacks. `test:arch` green, `check:bundle` **0 warnings**.
- The REAL `mountArena` + `arenaFrame` rendered headless (SwiftShader, `.scratch/lcGameProbe.entry.js`): six crystals on their hexes with the red/blue hunt hexes, a spawn, a Thrash scatter beside Glamarchy, the Ronin's pickup — 0 page errors.

### Next
- ⏳ Alex to play it on his GPU: brightness of the crystals at Standard, the 8 lights' cost, the hum's level in a real match.
- The pickup's flying chip into the HUD stock (the preview's mock) is not in the game; the 2D stock still updates as before.
- Bots don't trigger a reach hum (no armed walk); hover hums only for the person at the mouse.

### ➕ Same day, separate ask: 🎯 the camera comes to each Spirit (2026-10-08)
Alex: *"the camera ignores their entrance … make it so the camera zooms into their space as they begin - Same goes for all players - When it becomes a new players turn, the camera should come to that Spirit"*.
- **Why it ignored them:** the intro's lens only *leaned* 28% toward seat one's pad, and returned null after `cameraUntil` — so a later seat's riff and hop (its own first turn) played wherever the player had left the camera. A new turn moved the lens only through the auto camera, i.e. after 10 s of no input.
- **Entrance close-up:** `openingAct.ENTRANCE_CAMERA` + pure `entranceLens` / `inEntranceLens`; `openingActStage.camera(now, aspect, { reduced, follow, from })` flies it for whichever seat is in its window (riffAt → doneAt + 500 ms), snapshotting `from` when it starts so it eases in (spherically, 1.1 s) instead of cutting. Board side of the pad, tilt 62°, 9.5 → push-in 8% → 13 on the home hex (⚠️ ≥ OrbitControls' minDistance 12, so the hand-back never jumps). The old lean survives only with ☰ Auto camera off.
- **Turn focus:** `arenaRenderer` notices `frame.actingId` change (not the first one it sees) and runs the existing refocus ease (now with a duration, `TURN_FOCUS_MS` 1100) once the Sonic shot has let go — skipped if the director is already flying (it re-aims on a new turn itself), under ⌗ top-down, with Auto camera off, or mid-drag. An entrance close-up clears it.
- **Hand-backs:** a drag drops the close-up it lands on (`lensDropped`); a close-up cut short (⏭ mid-riff) eases out onto the Spirit instead of leaving a lens closer than 12.
- ⚠️ **House rule bent:** no `.scratch` preview first — Alex asked for it straight, as with the 2026-09-25 refocus-on-break. The levers are all in `ENTRANCE_CAMERA` and `TURN_FOCUS_MS`; if it feels off, they are the dial-in a preview would expose.
- **Evidence:** `test:entrance` 2,716 → **2,732** (the lens: no cut at start, on the pad, board side, push-in, follows the hop, lands ≥ 12, narrow screen, reduced motion, later seats, the stage on a ring-out return, Auto camera off) · `test:cameradirector` 93 → **97** (the wiring) · `test:topview` 60 · `test:entrancejourney` 29 · `test:arch` 8 · beamlayer / headdial / lostchords / movetiles / pyrostage / standeemove green · `check:bundle` **0 warnings** (with a linux esbuild binary via `ESBUILD_BINARY_PATH` — the tree's `node_modules` is win32). ⏳ **Not seen moving** (no WebGL run).

### ➕ Same day, separate ask: 🎪 a taken marquee relights at the turn end + ✨ the special-dice design (2026-10-09) — `68-marqueeturn`

Alex: *"New marquee spaces shouldn't appear again on the same turn if one was taken. And about the marquee spaces - I find sometimes that the dice card doesn't make any effect. Lets design how special dice are used and look. They shouldn't just appear as normal dice, and they perhaps shouldn't get rolled at all (if its a decided dice number for example)"*.

- **🎪 Built.** `applyEventHexTriggered` still CHOOSES the replacement at the take (same three draws, same order) but parks it in `board.marqueePending` ([{ hexNum, kind, from }]); `applyTurnEnded` lights it last (`marqueeSpaces.js` `lightPendingMarquees`, no rng). Waiting marquees count toward one-per-seat and one-per-quadrant (`plannedMarqueeHexes`), so the round-end top-up and a second take the same turn cannot double a quadrant. One stood on (or under a Lost Chord) at the turn end waits another turn. Logs moved to the turn end (client after `turnEnded`; headless `transition.js` END_TURN). Thrash tokens and the top-up avoid a waiting hex.
- **Evidence.** `test:cards` → **448** (the 360-take sweep now asserts waiting-unlit then lit-at-turn-end; new block: board one short all turn, top-up leaves it, TURN_ENDED lights it with its kind, **the same hex and kind the old rule drew off the same seed**, stood-on waits, two takes both wait in separate quadrants) · `test:engine` selftest updated + green · `test:cardjourney` 15 · `test:marqueejourney` 14 · `test:marqueemarkers` 50 · `test:determinism` 20 · `test:turnflow` 73 · `test:harness` 1,758 · `test:transition` 292 · `test:legal` 706 · `test:battleflow` 69 · `test:eval` 191 · `test:arch` 8 · `check:bundle` 0 warnings.
- **✨ Diagnosed and designed.** Every die card bent the pool's weakest die, which keep-the-best usually drops: no effect 13–40%, and Loaded 4 made the throw worse ~1 in 3. Preview `.scratch/special-dice/` (artifact *Special Dice Bench*): before vs a BONUS die that always counts. A rule where the card die takes one of your seats was measured worse than today and dropped.
- **🃏 Ported the same evening at Alex's dial-in** (5 of 13 levers: rule bonus, finish rim, size 1.15, badge off, ring .31, entrance deal) + *"the d8 and d12 maybe can be a bit bigger"*.
  - **Rule** (`marqueeCards.js` `applyCard`): a die card appends its die with one more seat; the `fixed` entry is `{ idx, pin, bonus, face? }`; `dicePool.js` `keepBest` gained `pinned` (kept like the Eleven die) and `throwPool` reads pins from `fixed`. Every call site (Thrash, Sonic, Bushido, at-the-roll, Code Injection's reroll) was already passing `fixed`, so nothing else moved. Old replays' `{ idx, face }` throw as before. Card texts rewritten. Full Stack on d10s+ is no longer refused.
  - **Look** (`combatDice.js` `finish:'card'`, `COMBAT_DIE_RADIUS`, `CARD_DIE_GOLD`; `arenaDiceSequence.js` `CARD_DIE_LOOK`, `CARD_DIE_COLORS`, `cardDieOf`): the set die is dealt from the card onto the open floor between the two landing areas and rises face up, on the WALL clock (the throw is held at its gate while a card is played, so sequence time does not move); a thrown bonus die flies first with a trail; both dock first, `gap` .5 apart; ring .31, name on the floor, "(card +6)" in the total; Encore's saved die wears the rim + ring. d8 .72 → .84, d12 .68 → .80 (my numbers; levers on the bench).
  - ⚠️ **Found: a card played at the roll never reached the 3D table.** `arenaFrame.js` keyed the battle by `swingKey` / `sonicId` alone, and `arenaVisuals` rebuilds the floor dice only on a new key, so after the re-throw the table kept the pre-card dice while the totals used the new ones — likely half of what Alex saw. The key now carries the card; both clocks run off the ROLL marks, so the rebuild is safe. Mutation-tested.
  - The bench v2's right monitor IS the game's sequence (`createArenaDiceSequence` + `cardDieOf`, fed by `applyCard` + `throwPool`); its levers are `CARD_DIE_LOOK` + `COMBAT_DIE_RADIUS`. Moved the card spot after seeing it: the bench's x −6.1 was off-frame.
  - **Evidence.** `test:cards` → **457** (the bonus die; pin kept; own dice unchanged; the set die's rng draw; a pre-bonus replay entry; never nothing/never worse over 10,000 throws, mutation-caught) · `test:dice` + **35** card-die checks (the dial-in, set vs thrown, header, gold edges, the deal on the wall clock, the row, the total, reduced motion, Encore, the frame key — mutation-caught) · `test:cardjourney` 15 · `test:battlejourney` · `test:sonicjourney` · `test:sonic` 100 · `test:battledirector` 45 · `test:battlelens` 18 · `test:arena` · `test:render` 13/13 · `test:bushidoburst` 1,025 · `test:topview` 81 · `test:legal` 706 · `test:battleflow` 69 · `test:determinism` 20 · `test:harness` 1,758 · `test:engine` · `test:arch` 8 · `check:bundle` 0 warnings. `test:swing` red at `swingClashCheck` line 58 (a fallen flag after Vibe damage) — the known red, nothing to do with dice. Seen in a software-WebGL browser on the bench, not in a real match on a GPU. 📌 Balance: +4 to +6 a card, Encore now the weakest — flagged, not rebalanced.

### ➕ Same day, separate ask: 🧭 Face north (2026-10-09) — `67-facenorth`

Alex: *"Give a North orientation button. It can keep the same level of zoom or whatever but it should automatically orient so the camera faces north. This helps a lot when trying to use the num pad to move - and the keyboard buttons such as these help progress the game a lot"* (the first of "a few changes in this thread").

- **Why it was needed.** The numpad walks BOARD north (`numpadMove.js` ruling 2), so once the lens is orbited, 8 can step a Spirit sideways on screen. Board north is world −z; a lens facing north sits due south of its target — ⌗ Top's `TOP_OFFSET` already does (x = 0).
- **What shipped.** `board/topDownView.js`: `lensHeading`, `facesNorth`, `NORTH_TOLERANCE`, `turnLens`, `northLens` (pure). `arenaRenderer` `north()`: a 450 ms smoothstep swing about the vertical through the target (`northSwing` / `northPose`, no `controls.update()` while it runs, like refocus); counts as taking over like zoom; a drag, ☰ view or zoom cancels it; a refocus started mid-swing starts from the finished pose. `BoardViewport`: `cameraRef.north()`, `view('north')` routed to the turn **without** leaving ⌗ Top, and a **🧭 N** chip in the corner status row (now always shown once ready). Client: ☰ Camera view → 🧭 Face north; **Numpad 5** by `e.code`, off during `battleState` (the Riff-Off reads `e.key` '5') and in text fields; not turn-gated.
- ⚠️ **House rule bent:** no `.scratch` preview — Alex asked for it straight, and the chip reuses Follow battle's existing style. The only lever is `NORTH_MS`.
- **Evidence.** `test:topview` 60 → **81** (§7: lands due south at the same distance/height/aim over a ring of orbits, short way round, mid-swing never dips or zooms, ⌗ Top is a no-op, overhead counts as north, and the wiring) · `test:numpadjourney` 23 → **24** (Numpad 5 walks nothing) · `test:cameradirector` **97** (two wiring regexes widened for the new branch) · `test:arch` 8 · `test:arena`, `test:client`, `test:render` 13/13, `test:journey`, `test:battlejourney`, `test:standeemove` 318, `test:movetiles` 47 green · `check:bundle` **0 warnings** (linux esbuild via `ESBUILD_BINARY_PATH`). ⏳ **Not seen moving** (no WebGL run). Systems Map not republished (no rule change).
- 📌 Open: the auto camera can still drift off north after 10 s idle (☰ Auto camera off prevents it). A compass needle on the chip showing the current heading would be the natural next step if wanted.

### ➕ Same day, separate ask: 🌊 the Sonic's tail follows the head (2026-10-08) — `65-sonictail`

Alex: *"The whole Sonic energy blast tail doesn't 'straighten out' before 'ramming' into the shield - So it looks like it becomes 'frozen' in its shape"* → (a straightening built straight into the client, ⛔ reverted: *"not 'straighten out' - I used the wrong words"*) → preview v1, rings slide and pack → *"it should condense and follow through in the same way the front does. If the front goes up, down, up at the end, the tail should as well go up, down, up … it might mean the tail 'speeds up'"* → preview v2 → *"This is how the attack should play out."* 6 of 9 levers moved.

- **Cause.** Each ring of the ring beam stays on the path station where it lit. In the slow approach (slowmo 52) the back of the beam stood still, then the 160 ms contact squeeze flattened it and the whole beam was hidden at contact — "up, down" and never the last "up".
- **What shipped** (`board/sonicZigzagVisuals.js` `RING_FOLLOW`, ring mode only): over the last `approach` 1 unit each ring rides the HEAD'S OWN TRACK, `k` × its old distance behind (k → `compress` 0), with the wave the head had there (`replay` 1, phase at `tauAt(p)`); the beam then stays drawn `drain` 0.8 s (beam clock) while the rest pours into the impact; squeeze off (`ram` 0); `slim` .4 / `swell` .6 / `calm` 1 / `ease` 3. Before the catch-up the code takes the original path — **byte-identical**, and costs nothing. Reduced motion keeps the old beam.
- `board/sonicClashVisuals.js`: one preview-only `beamTuning` passthrough (the game passes none).
- ⚠️ **A lag measured in TIME was tried and rejected**: in the slow approach the head covers almost no ground, so it collapsed the tail into one disc on the shield. The lag is in distance along the track.
- **Evidence.** New `sonicFollowCheck.mjs` in `test:sonicfx` — 6 checks: the dial-in; the flight up to the catch-up byte-identical to the old beam (62 frames); back-to-front 5.37 → 0.04 units by contact (old 5.37 → 2.29); every ring at the impact at contact; drawn through the drain, gone after; seek-stable, reduced motion = old. 3 mutants caught. `sonicGlitterCheck` now asserts the beam follows through until the drain ends (it asserted the old cut-off). Green: `test:sonicfx`, `test:sonic` 100, `test:beamlayer` 53, `test:bushidoarena` 15, `test:battlelens` 18, `test:battledirector` 45, `test:topview` 60, `test:spotlight` 362, `test:arch` 8. ⚠️ `check:bundle` / journeys could not run (Windows esbuild in `node_modules`).
- **Preview:** `.scratch/sonic-follow/` (source, built page, README) and the *Sonic Tail Follow* artifact. Not on a real GPU yet; Systems Map not republished (no rule change).
- 📌 Found: the spark ribbon in ring mode is not seek-stable (stale buffer) on the shipped beam too — harmless, unhidden meshes only. Open: the draining tail freezes in the hit-stop like everything else.


# B. 🎓 THE FINDINGS — what this project has learned the expensive way

⚠️ **THESE ARE NOT HISTORY. Every one is a live defence**, and most are the
reason a specific test exists. A session that does not know them re-learns them
at full price — which has already happened more than once.

### B1. 🪦 A doc that reads as current and is not is worse than no doc

`ARCHITECTURE.md` called `engine/` a *"~300 line scaffold"* for months while it
grew into the whole game, **because nothing could tell.** That is why
`test:arch` exists and why it is the only machine-checked doc: it asserts the map
names every module, points at no file that does not exist, and lists no export
that is not real.

📌 **The other design docs have no such check**, which is why they are to be read
with suspicion — including whichever one you are reading now.

### B2. ⛔ A passing test is not evidence a rule is real

`legalActionsCheck` §15 was green **for months** against a skill-purchase mechanic
the game does not have — because the test was written from the same
misunderstanding as the code. 🎯 **When checking whether the engine matches the
game, read the CLIENT (`rlsw-simulator-v3_8_1.jsx`), not the test.**

### B3. 🪦 A suite no script runs is not a suite

`b0check` was quoted as green in every handoff for months while **nothing ran
it**, and five riff test files carrying **132 assertions** had never been wired at
all. ✅ Write a check, give it a script in the same pass, add it to `test:all`.

### B4. 🎲 A threshold on one seed passes on luck

`harnessCheck` §9 asserted `max(owned) > 2` on a single seed. Measured: **only 20%
of seeds have a seat that passes it.** Seed 4242 was one of the lucky one in five,
so it broke on the first unrelated change and looked like a regression that was
not one. ✅ Aggregate over fixed seeds with a wide margin.

⚠️ **And the replacement was mis-calibrated too** — set from a duel bench and
applied to a trio. **A finding can be a property of the measurement rather than of
the game**, which is the single most expensive mistake available here.

### B5. ⛔ A cut can run past its own end with every suite still green

The 2026-08-26 Shamisen rework removed a feeding block — and took **the last two
lines of the melody commit and the whole `startNewTurnNotes` function** with it.
No move phase after a commit, no cards dealt next turn, **all eighteen suites
green throughout.** `test:client` exists because of this. ✅ Delete in small
steps, with `test:client` and `check:bundle` between them.

### B6. ⚠️ The obvious fix can undo the previous session's biggest call

Waking four dead flags by re-granting their skill ids would have **silently
deleted the colour payout** — those same ids widen `keyScale`, and a wider palette
means fewer notes need pardoning, and the pardon *is* the payout. ✅ The two jobs
were split at their own sites, and `b0check` now guards the revival.

### B7. 📏 A warning that is always there is indistinguishable from one that never matters

`check:bundle` sat at **"6 warnings" for months. All six were real** — import
paths whose CASE did not match the file on disk, which Windows resolves and the
Linux box Render builds on does not. ✅ **The count is the check: non-zero is a
failure, not scenery.**

### B8. 🎯 Read the payout table, not the formula

Psycho Bushido's bonus was `apLeft − distToTarget`, which paid **most** for a
charge of zero hexes — *"the ability rewarded standing still and called it
lightning."* Alex caught it by reading what it paid, not what it said.

### B9. 🪦 A decision filed in the wrong doc reads exactly like no decision *(2026-09-04)*

The Ronin's full kit respec — including an entirely new ability — was captured
correctly and in detail on 2026-09-02i, **in `UPGRADE_SHOP_DESIGN.md`, a pricing
doc.** For two days the canonical Ronin file went on calling the old kit "FIRM
DECISIONS" and had never heard the word *Shukuchi*. **Neither doc was wrong on its
own facts; the failure was one of ADDRESS.** ✅ `IDEAS_INBOX.md` and
`STATE_OF_PLAY.md` exist because of this one.

### B10. 🧊 While the kit is in flux, imbalance is information, not a defect

**Alex, 2026-09-04.** Do not open a session proposing to rebalance a character.
`UPGRADE_SHOP_DESIGN.md` §0⃣.4 is the standing instruction. ⚠️ **The exception:**
a change that makes something *impossible* rather than merely weak — an ability
that cannot fire, a purchase nobody can make, a flag that can never be true. Those
are bugs wearing balance's clothes and B6 is what they cost.

### B11. 🏷️ A step labelled "unblocked" is read as a step with nothing to ask *(2026-09-04f)*

Both `STATE_OF_PLAY.md` §7 and `SEQUENCING.md` §5-hopport.F called step (c) *"a
pure number edit, ✅ no longer blocked."* It carried **three** live decisions —
an unlock price the flat-cost rule already voided, a brand-new Drive-stack cost
its own doc says *"nobody has costed"*, and a duration cut that turns the exact
dial §6.3 warned about. All three were correctly written down, in the right doc,
in the right section.

🎯 **§B9 IS ABOUT A DECISION FILED AT THE WRONG ADDRESS. THIS IS THE SAME FAILURE
AT THE RIGHT ONE.** The ⬅️ **NEXT** arrow outranked the paragraph underneath it,
because a reader looking for what to do next stops reading at the label.
✅ **The defence is the decision board**, which reads the whole set at once and has
now found something new on all three of its runs — and, this time, found it inside
the very step it was standing next to.

### B12. 🎸 The safe-looking convention can be the drifting one *(2026-09-04f)*

Psycho Bushido's new Drive-stack bill was first written to take notes off the
**back** of the stack, to avoid re-pointing the player's hunt as a side effect of
an attack. The reasoning was sound and the conclusion was backwards: **every Swing
in the game already spends off the front**, and `music/stackSlots.js` documents
that as the design's own way of re-pointing a hunt. Taking from the back would
have put two directions on one stack inside a single action.

✅ `test:bushido` now asserts the direction **against `SWING_DRIVE_SPEND` itself**
rather than against a literal, so the two cannot diverge in silence.
📌 And the check found the ability's real price while it was there: a draw costs
**4** notes of Drive stack, not 2, because the strike at the end of it is a Swing.

### B13. 🏷️ A discrepancy "preserved on purpose" still needs an OWNER *(2026-09-05)*

§5-refactor found that one ability answered *"what stops the lane?"* three
different ways — the client click passed no blockers, the highlight passed live
spirits, the searcher passed spirits + amps + the decoy — and **wrote it down
correctly, in the right file, in the right words**, then preserved it rather than
resolving it inside a refactor. That instinct was right. What was missing was one
sentence: **whose call is it?**

🎯 **§B9 IS A DECISION AT THE WRONG ADDRESS; §B11 IS A DECISION UNDER A LABEL THAT
SAYS "NOTHING TO ASK"; THIS IS A DECISION WITH NO NAME ON IT.** All three are the
same failure — a fact that is true, findable and correctly filed, and still does
not reach the one person who can settle it. A discrepancy that is deliberately
kept is a **decision waiting for its owner**, and it belongs on the board.

✅ The defence is `bushidoCheck` §7: the counting assertion
(`bushidoLane(` calls vs blocked ones) makes a *fourth* answer impossible to add
in silence, and three of its checks read the CLIENT source rather than the
kernel, because the split lived in the half no headless run reaches (§B2).

---

# C. 📇 THE INDEX — 101 rows; each names its archive (`docs/archive/SEQUENCING-*.md`)

Newest first. **Search the archive by the section id in column 1.**

| id | date | what it did |
|---|---|---|
| `66-iwatotrap` | 2026-10-09 | The Cursed Shamisen v3, "the trap": the Action Token curses a hidden Lost Chord (his screen only, pinned until his next turn); a Rival who takes it gets Iwato on that note with three creepy haunted notes to lift (accumulating, 3 turns = two cursed melodies, no refresh, the draw seeps in ⅓ → ⅔). `iwatoCurse.js` rewritten; spring in the client pickup and `collectPickups`; arena springs on the hex. `IWATO_CURSE_V3_SPEC.md`. `test:shamisen` 113, `test:shamisenjourney` 27. Live §A. |
| `65-sonictail` | 2026-10-08 | The Sonic ring beam's tail follows the head at Alex's 6-lever dial-in: `RING_FOLLOW` in `board/sonicZigzagVisuals.js` — on the last stretch the rings ride the head's own track (its ups and downs, faster), catch it by contact and pour into the impact for 0.8 s; first half byte-identical. Live §A (same-day addition). `test:sonicfx` (`sonicFollowCheck`). |
| `64-lostchords` | 2026-10-08 | The Lost Chords as 3D crystals at Alex's 4-lever dial-in: `board/lostChords.js` (look, clocks, `planLostChordMoments`, the game layer) + `audio/lostChordSfx.js`; crystal on the foreground scene, floor on the arena canvas; pickup waits for the standee; pooled lights; the client's pickup pluck moved to the shatter. `test:lostchords` 88. |
| `63-hammeron` | 2026-10-08 | Archived in `../docs/archive/SEQUENCING-2026-10-08-before-lost-chords.md`. The Ronin's hammer-on / pull-off: `music/noteTechniques.js` (the smart rule on the payout's own readers), `ui/HammerOn.jsx` at Alex's 0-lever dial-in, charges dealt 1 / +1 at his turn end / bank 2, H key, button, ghost, slur, legato KATANA; pays and moves but never exorcises; Ronin only. `test:notetechniques`, `test:hammeronjourney`. Live §A. |
| `62-spiritsheet` | 2026-10-07 | Archived in `../docs/archive/SEQUENCING-2026-10-08-before-hammer-on.md`. The Spirit window rebuilt in the arena's look (previewed, dialled at 6 of 25 levers, ported; the old 2D card gone) + one Enter, one act (`e.defaultPrevented`). `test:spiritsheet`, `test:notekeysjourney`. |
| `61-roninart` | 2026-10-06 | Archived in `../docs/archive/SEQUENCING-2026-10-08-before-hammer-on.md`. The Ronin's new art: white masters keyed/cropped/traced by `scripts/standee-art.py`; his own Thrash1/Thrash2 prints replace the stick figure, 'hit' on any shove and on a lost/tied Thrash, a blank back, the lens films his front. `test:standee`. |
| `60-openingport` | 2026-10-06 | Archived in `../docs/archive/SEQUENCING-2026-10-08-before-hammer-on.md`. The opening act in the game: Spirits wait off the board on pads, enter on their own first turn with 2 fans, home hex reserved; Bardbarian intro on the live arena at Alex's dial-in; bots and online. `test:entrance`, `test:entrancejourney`. |
| `59-intro` | 2026-10-04 | Archived in `../docs/archive/SEQUENCING-2026-10-06-before-opening-port.md`. Bardbarian introduction preview, saved Alex dial-in and portable Claude handoff; branch reconciliation. Ported by `60-openingport`. |
| `59-triage` | 2026-10-04 | Archived in `../docs/archive/SEQUENCING-2026-10-04-test-triage.md`. The 21 red suites brought up to the current rules (Thrash clash, no radius, Eleven die, cuts, rebase); `spendDriveStack` deleted; 14 ARCHITECTURE rows. Left red for Alex: the Shadow CD/duration invariant, and three suites needing uncommitted `.scratch/` previews. |
| `54-sustain` | 2026-10-04 | Living Sustain shield production port. Archived in `../docs/archive/SEQUENCING-2026-10-04-before-bardbarian.md`. |
| `58-thrashbill` | 2026-10-03 | Thrash bill: attacker 2 Drive notes, defender 1, win/lose/tie; a Thrash (and the Tentacle) needs 2 Drive notes; a tie throws both back a hex, no Vibe. Shadow whiffs pay the Drive price; the Sonic whiff's AP fixed to 1. Thrash constants moved to `gameConstants` so `battleFlow` stays art-free (`test:sandbox`). `test:legal`, `test:swing`. |
| `57-thrash` | 2026-10-03 | Swing renamed **Thrash** in every player-facing string (rail, overlay, 3D captions, prompts, tutorial, ability/card text, logs). Internal identifiers stay `swing` — replays and network actions carry the kind. Journey checks click `Thrash`. |
| `56-sonic1note` | 2026-10-03 | Sonic spends 1 Drive note off the top again (the 09-11 whole-charge rule reversed — an empty rig was a free kill for the next Thrash). `SONIC_DRIVE_SPEND` wired into the client and `transition.js`. `test:legal`. |
| `55-sonicreach` | 2026-10-03 | Sonic reaches 2–3 hexes, never adjacent: `SONIC_MIN_RANGE`, `sonicBeam` skips hex 1; client `getSonicBeam` delegates to it; Blaster of Ra keeps the full line (`getBlasterBeam`). A same-day Swing version of this rule was reverted — Alex meant the Sonic. `test:legal`, `test:sonicjourney`, `test:riffarenajourney`. |
| `54-sonic1ap` | 2026-10-03 | Sonic Attack costs 1 AP (was 2): `SONIC_AP_COST` and every client gate/charge/label read it; riff-off follows. `test:legal`. |
| `53-pyro` | 2026-10-02 | Archived in `../docs/archive/SEQUENCING-2026-10-04-before-bardbarian.md`. Pyro v2: Astra's mortars fire at every END TURN (5/10/13 by show round), a shove stops on one, 3 Vibe; the pyro-shove preview ported into `board/pyroMortars.js` / `pyroShove.js` / `pyroBlast.js` / `pyroStage.js` and `audio/pyroSfx.js`. `test:pyrorules`, `test:pyroshove`, `test:pyrostage`. |
| `52-dbcut` | 2026-10-02 | Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. Db cut entirely: abilities gated by kit + 2-round cooldown only, melody pays fans only, upgrade shop and old event cards / Major-Minor bonus removed. `test:loadouts`, `test:skilltree`, `test:playfinder`. |
| `51-iwatoport` | 2026-10-02 | Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. The Iwato curse goes into the game: take up, three strings from the next turn (up to 3 a turn, from the hand), the cast, the cursed palette everywhere, exorcism in the commit, the arena stage, the infected wheel, the sound, and the loadout pop-out. `test:shamisen`, `test:shamisenjourney`. |
| `50-iwatocurse` | 2026-10-02 | Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. The Cursed Shamisen redesigned as the Iwato curse (strings, cast, a cursed Scale Wheel, exorcism); its five animated moments built for the dial-in. `test:cursedshamisen`. |
| `49-abilitypopouts` | 2026-10-01 | Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. Hover an ability in the loadout and a pop-out plays it — Shukuchi's blink and the Bushido strike, the game's own code on real standees. `test:abilitydemo`. |
| `48-riffarena-live` | 2026-10-01 | Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. Dual board tracks, alternating short melodies, continuous acceleration, amp rings/core, smooth motion and energy-driven shaking. |
| `47-bushidoburst` | 2026-10-01 | Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. ⚡ Psycho Bushido is a Drive-vs-Sustain burst: range turns 2/3/4 d6s into d8s, the Rival's Sustain is a shield (brighter for a stronger roll), damage = what gets through, pushed like a Sonic, no counter-blow; the lightning strike in the arena with its own sound. `test:bushidoburst`, `test:bushidoarena`. |
| `46r-riffarena` | 2026-10-01 | 🎸 Riff Off arena study (another session) — two guitar tracks over the real board, call/answer volleys feeding a central clash; awaiting Alex's dial-in. `test:riffarena`. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`; scope in `../previews/riff-arena/README.md`. |
| `46-standeemoves` | 2026-09-30 | 🎭 Standees hop between hexes (blink for a leap, skate + clack for a shove) and land on Alex's stone-on-glass sound with a ripple; ⌨️ the numpad walks (4/6 nothing, up = board north). `test:standeemove`, `test:numpadjourney`. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md` (with an orphaned Bushido-lane block found under it). |
| `45-playtest` | 2026-09-30 | 🧹 Melodies no longer cut off (every note unplugs itself — connected filters kept ~25 s of silent voices on the audio thread); ⏳ one found seat per stack per round; 🎚️ the craft +2 needs a six-note run; 🎲 extra dice name their buff in the log. 🎛️ Db readout + Drive-bonus badge on a preview, not ported. `test:voiceleak`. | Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`.
| `44-beamlayer` | 2026-09-30 | 🔊 The Sonic clash draws LAST on the foreground canvas with its own bloom, over amps, fans, dice and both standees; only the attacker's print can hide it (the far side of the loop). `test:beamlayer`. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `43-stagefx` | 2026-09-29 | 🗓️ Stage Effects fire on a round schedule (7, then every 5; the last runs to the buzzer) instead of at Fame thresholds; 📱 phone play archived. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `42-phone` | 2026-09-29 | On a phone the whole game was a blank white screen; the sideways phone layout. 🗄️ The layout itself was archived next session (43-stagefx). Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `41-title` | 2026-09-29 | The title screen is the real arena, far off and turning. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `40-rounds` | 2026-09-29 | Alex's marquee size, and two kinds of round: solo on a clock, community first-right-wins. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `39-marquee3d` | 2026-09-29 | The marquee gets a marquee. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `38-quadrants` | 2026-09-29 | One marquee per seat in its own quadrant, and the charge spaces retire. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `37-cards` | 2026-09-29 | Every marquee is the same, and it pays a prize card for battle. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `36-clearlens` | 2026-09-28 | The battle camera stops filming into nothing, and an attack's reach glows on hover. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `35-stings` | 2026-09-28 | The Eleven die is a d6, every Spirit gets a calling card, and the calling card becomes how commits sound. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `34-glowsticks` | 2026-09-25 | The crowd waves glow sticks. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `33-spotlights` | 2026-09-25 | Four owned spotlights, poses that cost −1 instead of everything, and Sustain stops leaking. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `32-colours` | 2026-09-25 | No Spirit has a colour of its own; the head in the banner (preview); the amps and fans stop being black glass. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `31-picker` | 2026-09-25 | The select screen shows the standees, they pop, they tell a story — and the acrylic cuts the figure only. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `30-topdown` | 2026-09-24 | Top-down holds its axis, 📌 Hold keeps the camera still, and amps/fans/dice turn solid. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `29-sandbox` | 2026-09-24 | Testing Grounds revived, the ring beam restored, the Sonic clash and the push-in. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `28-standees` | 2026-09-18 | Your 2D characters, stood up in acrylic. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `27-calmcam` | 2026-09-18 | The same camera, dialled down. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `26-camtiles` | 2026-09-17 | The camera stays on the Spirit, and the move tiles turn magenta. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `25-autocam` | 2026-09-17 | The camera follows the action, and lets go when you grab it. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `24-crowdfix` | 2026-09-17 | First run on Alex's machine, three finder bugs fixed. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `23-crowdport` | 2026-09-16 | The crowd is in the game. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `22-bubbles` | 2026-09-16 | The crowd found its voice — and the first draft lied about the notes. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `21-finder` | 2026-09-16 | The beginner finder's brain — and the brute force found three bugs that were not in it. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `20-lever` | 2026-09-15 | The mode flipped, and one constant had been quietly lying for weeks. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `19-cheapest` | 2026-09-15 | Three cheap things, and one of them was a rule that never existed. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `18-coreloop` | 2026-09-15 | The loop got decided, and four changes turned out to be one. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `17-riffoff` | 2026-09-14 | 📊 Alex's 2D **attack axis grid** recovered and verified against the code (§13), a sixth column — **miss cost** — added. 🎤 The **Riff-Off is a BET, not an attack**, and it runs on the **melody line**, not Drive — which the code already did. 🎼 **Note strength solved without a new judgement** (§14.9): dud / plain / strong / hook, all from arithmetic the commit already performs — hands decide IF a note fires, the melody decides what it WEIGHS. ⭐ Two rulings: the first caller keeps their advantage; the duel reads the craft run's LENGTH while the Fame cap stays a Fame cap. 🎓 **And the fifth's rationale was recovered from Alex before it was lost** — it is stronger than the tonic to push chord changes, which makes `endingDb` a lever on the chord economy and existed in no file. 🚩 Three findings: riff-off Vibe still on the legacy `marginToDamage`; a `committedMelody` clear that is documented but could not be found; `endingDb` unnamed and uncommented. ⛔ **Design only — nothing built, and the Swing question it opened with is still unanswered** Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `16-ringbeam` | 2026-09-13 | ⭐ The Sonic projectile decided — the **ring beam**, dialled in by Alex on a live preview and signed off. ⛔ Nothing in `src/`; the one-pass brief is `.scratch/sonic-rework/RING_BEAM_BRIEF.md`. ⚠️ The approved contact push-in still has no home in the renderer Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `15-drawer` | 2026-09-12 | ⌐ The step-1 stack-commit drawer joined the bracket system — the last 2D panel in the arena, and the one every stack commit goes through. 🐛 The flush-left gutter bug fixed by construction. ⚠️ Nearly broke two journey suites by lowercasing a button label the mockup had restyled Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `14-accidentals` | 2026-09-12 | ♯♭ A two-glyph note is TYPESET rather than shrunk — the letter holds 34px, the accidental is a smaller raised mark. 🐛 Two hardcoded `fontSize={34}`s, the second on the burst's lifted letter. 🙈 And the finding that cost the least and taught the most: **my own preview had misdrawn the component**, so half the reported problem was not in the game Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `13-hud` | 2026-09-12 | The HUD joined the bracket system and all five frosted slabs went; 🌊 the melody line gained three overtones at deliberately non-round ratios and a pulse train. 🐛 Source of the backtick-in-a-template-literal lesson Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `12-board` | 2026-09-12 | ⌐ ⌐ The bracket language reached the board: one `Bracket` primitive, both chord stacks, the melody track. 🌊 The melody drawn as a wave — the one thing deliberately off the grid. 🐛 Closed `11-dials`' own leftover: the board was still drawing the amp knob it had replaced Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `11-dials` | 2026-09-11 | 🎛️ 🎛️ The 3D arena's Drive/Sustain dials redrawn from an amp knob into a Tron segment gauge. ⭐ **Previewed at true size before any code moved**, which is what cut two candidates that only worked zoomed Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `10-pointer` | 2026-09-11 | 🖱️ 🖱️ The pointer redrawn from Alex's reference as a filled arrowhead with a press bob. ⭐ **The shape was fitted numerically, not traced** — a blurred upscale cannot be measured by eye. Also closed two long-red `test:arch` rows Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `9-immersive-hud` | 2026-09-09 | the space-saving live HUD. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `8-arena-fidelity` | 2026-09-08 | Preview materials/scenery, live rigs/FX, explicit quality and preview camera gestures. ⚠️ Its row read **"LIVE — §A above"** until 2026-09-11, two handoffs after it stopped being §A — the exact drift B1 is about, found while filing `10-pointer`. Archived in `../docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md`. |
| `7-immersive-hud` | 2026-09-07 | Structural handoff archived in `../docs/archive/SEQUENCING-hud-2026-09-07.md`. |
| `6-arena-live`, `6-arena`, `5-lane` (resumed) | 2026-09-05–06 | Prior live handoffs preserved in `../docs/archive/SEQUENCING-before-immersive-hud-2026-09-07.md`: arena study, live integration, lane port and verification. |
| `5-lane` | 2026-09-05 | Archived in the 2026-09-07 handoff snapshot. The board's fourth run (14 calls, 2 newly named, both inside 🗡️ Bushido); ⭐ **one occupancy policy — ANY BODY BLOCKS**, shared by the click, the highlight and the searcher; the lane previewed as a payout-graded glow |
| `5-refactor` | 2026-09-05 | Windows verification, DOM turn journey, shell/crowd extraction and shared Bushido geometry/payment. ⚠️ Its preserved three-way targeting split became `5-lane`'s first decision |
| `5-draw` | 2026-09-04f | The board's third run (15 calls, 3 of the 5 new ones found INSIDE the step marked unblocked); 🗡️ Bushido respecced to a 3–5 draw with the ladder, a flat 3 AP bill and a Drive-stack price; 👤 Illusion respecced; ⭐ **the flat unlock number answered — 6, for everything** |
| `5-hopport` | 2026-09-04e | The board run a second time (11 calls, 5 newly enumerated); ✅ Bushido's +2/+3/+4 ladder settled; 🌀 Shukuchi's overlay PORTED and SSR-diffed at 80 assertions; the searcher's hop un-refused |
| `5-hopui` | 2026-09-04d | The decision board's first run; ✅ per-activation Db and ✅ per-hop targeting settled; Shukuchi's overlay previewed and parity-probed at 896 assertions |
| `5-hop` | 2026-09-04c | 🌀 Shukuchi BUILT HEADLESS. 1 AP a hop turned it from a movement turn into a movement mode; two canaries fired and both were right |
| `5-cut` | 2026-09-04b | 🪦 Wa no Koe DELETED; the three suites that stood on it inverted into a revival guard, and the Ronin ledger filed |
| `5-flags` | 2026-09-02i | Four dead melody flags ungated; the chromatic pardon fires 19.4% under the searcher, not the 1% the comment claimed |
| `5-ident` | 2026-09-02h | The melody-identity arm opened — four verbs (Kata/Dissonance/Loop/Hook), one motif detector instead of thirty rules |
| `5-glow` | 2026-09-02g | The hunt marker — the hex holding your next stack seat lights up. Three bugs caught in verification, only one in the port |
| `5-seats` | 2026-09-02f | 🅰️ **Theory came off the tree.** Stack seats 4–6 found on the board; the pardon ladder went universal and free |
| `5-bands` | 2026-09-02e | 🎸 **Battle of the Bands BUILT** — elimination as its own axis, playable from `runMatch` |
| `5-window` | 2026-09-02d | The scaled Fame window |
| `5-win` | 2026-09-02c | 🏆 The win conditions — how a match ends became a setting |
| `5-fans` | 2026-09-02b | The fan re-weight; the seeded-stream mechanism that makes harness counts move |
| `5-race` | 2026-09-02 | The race → margin change. ⚠️ **Source of B4's lesson** |
| `5-fame` | 2026-09-01 | The Fame instrument |
| `5-clean` | 2026-09-01 | The clear-out |
| `5-hud` | 2026-08-29 | The step-3 rail. ⚠️ Also holds the original **§0–§2 ordering thesis** that got buried after it |
| `5` | 2026-08-29 | The HUD cuts, and a strip on a preview |
| `5-aug28c` | 2026-08-28c | The tilt, the honeycomb, the burst |
| `5-aug28b` | 2026-08-28b | The commit chips and the flight |
| `5-aug28` | 2026-08-28 | The note-commit overlay, wired in |
| `5-aug26b` | 2026-08-26b | 🐛 **The Shamisen rework REPAIRED** — source of B5, the most expensive lesson here |
| `5-aug25b` | 2026-08-25b | The Shamisen built. 🪦 **Now void** — the ability has changed verb twice since |
| `5-aug25a` | 2026-08-25 | The Shamisen settled, design only |
| `5-aug22c` | 2026-08-22c | The per-use Db + cooldown rule, applied across Intergalactic 0 |
| `5-aug22b` | 2026-08-22 | 🗡️ **The Ronin foundation** — `cooldowns.js`, the general cooldown system |
| `5-aug22a` | 2026-08-22 | The rule, design only |
| `5-aug21` | 2026-08-21 | The clutter pass |
| `5-aug20pm` | 2026-08-20 | Evening. ⚠️ **Source of B8** — the Bushido sign flip |
| `5-aug20am` | 2026-08-20 | Day |
| `5-aug19` | 2026-08-19 | — |
| `5-prev` | 2026-08-18 | Evening |
| `5-day` | 2026-08-18 | Day |
| `5-late` | 2026-08-17 | Late |
| `5-eve` | 2026-08-17 | Evening |
| `5-am` | 2026-08-17 | Morning |
| `5-old` | 2026-08-17 | ✅ The evaluator can see a fight |

📌 **The original 2026-08-15 ordering thesis** — §0 *the diagnosis: three docs, one
deferral loop*, §1 *where the loop breaks*, §2 *the order*, §4 *the stop rule* — is
in the archive at its old line ~1347. ⚠️ **It is largely spent**: it sequenced the
bot / Metalness / Theory arms, and Theory has shipped while the bot and Metalness
are both parked. Read it for the *stop rule*, not for the order.
