# SEQUENCING §A handoffs 8 → 44, archived 2026-09-29 (43 and 44 on 2026-09-30)

> Moved **unedited** out of `src/SEQUENCING.md` §A on 2026-09-29 (43-stagefx), where they had
> restacked since 2026-09-04 despite `CLAUDE.md`'s one-handoff rule. Newest first, exactly as
> they stood. Each has a one-line row in `src/SEQUENCING.md` §C; search here by its id
> (e.g. `## 42-phone`). ⚠️ Relative links inside were written from `src/` — read `../` as
> the repo root.

---

## 44-beamlayer. The Sonic's rings draw over everything but the Spirit they loop round — 2026-09-30

Alex: *"For the Sonic attack - the sound form rings should be in a layer in front of everything (well... there is a moment when the attack 'circles' the attacking Spirit - it should go 'behind' it at this point) - but it seems like it loses out to some assets and gets cut out sometimes, can you fix this?"*

### 🔍 Why it was cut out
The arena is three stacked layers (arena canvas z 0 · the board's SVG on CSS3D z 1 · the foreground canvas z 2, which re-draws amps/fans/dice/crowd — the solid layer — and draws the standees). The whole Sonic clash lived in the ARENA scene, so everything on the two layers above painted over it: amps, fan stands, dice, and **both standees, always** — the beam never once crossed in front of either Spirit, and its hit flash hid behind the Rival. Its `depthTest:false` / renderOrder 137–145 only ever won inside the arena canvas.

### ✅ What shipped
- 🔊 **`board/beamLayer.js`** (new) — the clash (beams, shield, build rings, shards, HP plate) is its own scene, drawn LAST on the foreground canvas, after the solids and the standees. Depth cleared; the **attacker's print alone** is written back depth-only (alpha-tested, so the cut outline; the clear sheet never writes depth) and every beam material depth-tests against it — so the near side of the loop is in front of the attacker and the far side goes behind, and nothing else (Rival, amps, fans, board) can cover it.
- ✨ **It keeps its glow.** The additive parts render into a HalfFloat target with the arena's OWN bloom (same strength/radius/threshold; off in Lite like the arena's), are tone-mapped with the renderer's ACES + exposure, and are **screened** onto the canvas (premultiplied, alpha = brightest channel). The normal-blended parts (only the shield's HP plate today) go on `BEAM_FLAT_LAYER` and draw straight on. An unlit bout (the dice beats) costs nothing — no clear, no bloom.
- 🔌 `arenaVisuals.createArenaVisuals(scene, {foregroundScene, beamScene})` puts the clash there when given one (headless checks without one keep it in the arena, unchanged) and exposes `beamOccluders()` → the attacker's pawn. `arenaRenderer.js` makes the layer from its own bloom's settings and draws it right after `foreground.render(foregroundScene)`.
- 🧪 **`test:beamlayer`** — `board/beamLayerCheck.mjs`, **53** checks, in `test:all`: the live arena hands the clash to the layer and names only the attacker; the five draws in order against a recording renderer; nothing borrowed (materials, layers, camera, clear colour) left changed; an unlit bout draws nothing; the renderer draws it last. Mutation-tested (clash back in the arena, plate on the glow layer, materials not restored, an ADD composite, no depth test, the draw call removed — each fails).

### 🎓 Findings
- ⚠️ **An ADD composite whites out.** The first bloomed version added the tone-mapped glow onto the canvas; the shield break went to a white sheet (`.scratch/beam-layer/rejected-additive-composite-f026.png`). The arena used to tone-map arena + beam TOGETHER, which rolls off; tone-mapping them apart and adding clips. A screen rolls off the same way — and every pixel it writes is valid premultiplied, so it needs no browser tolerance for super-luminous pixels.
- ⚠️ **`toneMapped:false` materials go white off the arena canvas.** The arena's OutputPass tone-maps everything after the fact, whatever the material says; on a canvas drawn directly, the clash's `toneMapped:false` glows (shards, shield) skip ACES and read as pure white. Rendering into a target and tone-mapping in the composite sidesteps it.
- 📌 **What it gives up:** the arena's depth of field no longer blurs the beam (sharp during a focus shot, as the solids are). A stretch of beam physically behind the attacker from the lens (e.g. the first leg out of an amp behind them) also passes behind the print — same geometry as the loop.
- 📌 **Assertion diffs on three.js objects take minutes.** A failing `assert.equal(meshA, meshB)` prints the whole object graph and reads as a hang; the new check compares identity with `assert.ok(a === b, …)`.

### 🧪 Evidence
- 🖼️ `.scratch/beam-layer/before-after.png` — the real `mountArena`, one scripted clash on a virtual clock, same frames old vs new (cloud Chromium, SwiftShader). Probe + README there.
- `test:beamlayer` 53 · `test:arch` 8 (Alex's machine) · `test:sonic` / `test:battledirector` 45 / `test:battlelens` 18 / `test:attacktiles` 28 / `arenaPresentationCheck` / `sonicIntegrationCheck` green (cloud copy of the tree).
- 🧹 eslint clean on `beamLayer.js`, `arenaVisuals.js`, `arenaRenderer.js`.
- 🚩 **Full sweep, every suite run (not stopping at the first red): 52 green, 20 red — the SAME 20 that 43-stagefx listed** (engine, legal, eval, transition, battleflow, winconditions, slime, eleven, harness, skilltree, shamisen, bushido, b0, journey, battlejourney, cameradirector, standee, crowdbubble, loadoutui, topview). The board ones (cameradirector 1/92, standee 1/98, topview 1/60) and five others were re-run on a copy of the tree WITHOUT this change: identical failures. `test:dice`, `test:shukuchiui`, `test:bushidoui` need preview files outside `src/` and were run where those exist: green.
- ⚠️ **Not seen on a real GPU.** The foreground canvas is the `low-power` context; the glow pass adds a bloom there only while the clash is lit.

### ⬅️ NEXT
- 👀 **Alex: play a Sonic** and watch (1) the rings over the amps, fans and dice, (2) the loop going behind your Spirit on its far side, (3) the hit flashes in front of the Rival. If the glow reads hotter or cooler than it did, the lever is the composite in `beamLayer.js` (the bloom settings are the arena's own).
- 📌 FPS during a Sonic on a laptop iGPU — the auto-quality drop to Lite also turns the beam's bloom off.

---

## 43-stagefx. Stage Effects fire on the round clock, and phone play is archived — 2026-09-29

Alex: *"instead of being dependent on the number of FP gained, they should go off at a set round number … They should be random in what gets triggered."* And: *"lets totally archive the whole mobile device play."* Both confirmed as proposed (*"Ok, sounds good"*).

### ✅ What shipped
- 🗓️ **The schedule** — `data/stageEffects.js` `stageFxSchedule(roundLimit)`: round 7, then every 5 (`STAGE_FX_FIRST_ROUND`, `STAGE_FX_EVERY`); every show lasts 3 rounds (`STAGE_FX_SHOW_ROUNDS`) except the last of a timed match, which runs to the buzzer. 10 → 7–10 · 15 → 7–9, 12–15 · 20 → 7–9, 12–14, 17–20. Still the seeded no-repeat deck, so which effect is random per game.
- ⚙️ **Engine** — `stageFxScheduled(round)` (same `STAGE_FX_DRAWN` type) is asked on every round; the reducer draws only on a scheduled round, once, and reports `{ round, untilRound, rounds, fxId }`. `stageFxActivated(fxId, occupied, rounds)` gives each effect that length: smoke/laser `roundsLeft`, animatronics `turnsLeft`, and pyro a new `roundsLeft` clock — it keeps cycling arm → erupt, and if the show ends on an ARMED wave that wave blows as the finale in the same tick (`finale: true`) instead of fizzling. Smoke stops growing at `SMOKE_MAX_RADIUS` (4, what a 3-round cloud always reached), since a to-the-buzzer show can last 4 rounds.
- 🖥️ **Client** — `checkStageFxSchedule` runs in `endTurn`'s roundCompleted block AFTER the smoke/laser/pyro/bot ticks. The Fame trigger is gone: `stageFxThresholds`, `checkStageFxThresholds`, the call in `grantFame`, and the threshold notches on BOTH Fame tracks (the card bar and `FameRace`, which keeps its prop for the render check). Banner and header chip say **ROUND 7** instead of ⭐8; the logs say "3 rounds" or "until the final buzzer". The battleFlow hook `stageFxThresholds` is renamed `fameBanked` (it now only carries the first-Fame tip).
- 📱 **Phone play archived** — `ui/phoneLayout.js` moved unedited to `docs/archive/phone-play-2026-09-29/` with a README (what, why, how to restore); `MatchSurface` no longer mounts it or the rotate prompt. **Kept:** the white-screen fix, `viewport-fit=cover`, `GlobalCursor`'s no-hover rule, the inert `match-commit-row` class.
- 🧪 `test:stagefx` — `engine/stageFxScheduleCheck.mjs`, **90** assertions, in `test:all` (now 71 suites): the three schedules and Legend Run's, draws only on scheduled rounds, no repeats, each effect's life at 3 and 4 rounds, the pyro finale, smoke's cap, legacy replays, byte-identical replay, and — reading the CLIENT — that the schedule is asked in the round block after the ticks and nowhere else.

### 🎓 Findings
- ⚠️ **Legacy replays kept.** `stageFxDrawn(threshold)` and a `rounds`-less activation still resolve exactly as before (old lengths, pyro's wave count), so pre-2026-09-29 action logs and the determinism fixtures are untouched. The Testing Grounds button also uses the old lengths.
- 📌 **A headless match still plays with no stage hazards** — the draw is client-driven, as the Fame one was. Bench numbers are unaffected.
- 📌 **A 10-round game now gets ONE show** where the Fame trigger could fire three. That is the schedule Alex asked for; recorded, not tuned (§B10).

### 🧪 Evidence (Alex's machine, Linux VM; esbuild via `ESBUILD_BINARY_PATH` to a linux-x64 0.28.1 under `$HOME`)
- `check:bundle` 0 warnings · `test:arch` 8 · `test:stagefx` 90 · `test:determinism` 20 · `test:client` 6 · `test:render` 13 · `test:fametrack` 9 · `test:buzzer` 81 · `test:turnflow` 73 · `test:riff` 70,970 · `test:riffparity` 127,598 · `test:trace` 2,232 · `test:arena` · `test:replayjourney` · `test:sonicjourney` · `test:swing` · `test:marqueejourney` and 30 more green.
- 🚩 **19 suites are red, and every one is red IDENTICALLY on the tree without this change** (a copy with the touched files restored from HEAD): engine, legal, eval, transition, battleflow, winconditions, slime, eleven, skilltree, shamisen, bushido, harness, b0, journey, battlejourney, cameradirector, standee, topview, crowdbubble, loadoutui. `test:engine` stops at line 457 (combat fixtures), long before its stage-FX sections — run with soft asserts, both trees fail the same 5,371 checks and **every stage-FX assertion passes**. Same trick on `test:harness`: 1 identical failure, the rest of the Fame/battle path green.
- `lint:baseline` was already over (356 vs its baseline) before this pass; eslint on every touched file reports the same counts before and after.

### ⬅️ NEXT
- 👀 Alex to play a 10-round match to round 7 (and a 15 to round 12) and watch the show open.
- ⁉️ **Legend Run** has no buzzer: it got three 3-round shows (7, 12, 17) by default. Alex's call.
- ⁉️ The lobby's **KDs** control is dimmed, not hidden, in Battle of the Bands because "it still shapes the Stage-FX thresholds" — it no longer does (`Lobby.jsx` comment updated). Hide it or leave it: Alex's call.
- 🚩 The 19 red suites above — they are a combat-fixture migration nobody has owned (`docs/archive/board-2d-pickles-2026-09-22/README.md` names it), not this change.

---

## 42-phone. On a phone the whole game was a blank white screen — 2026-09-29

Alex: *"any way you can make the game playable on a mobile device?"* Rendered the real app in Chromium with an iPhone user agent and touch, landscape 844×390 and portrait 390×844.

### ✅ What shipped
- 🐛 `app/RLSWSimulator.jsx`: the phone colour tint (`mobileColorStyle`, a CSS `filter`) moved from a wrapper div round every screen onto `<html>`. A `filter` makes its element the containing block for `position:fixed` children, and every screen is a full-screen fixed layer inside a wrapper 0 px tall — so on ANY phone (`/Mobi|Android/` UA) the title, lobby and match collapsed to nothing and taps hit `#root`. Desktop never had the wrapper style, which is why nobody saw it. The root element is exempt from that rule; the tint still applies (verified).

### 🔍 What a phone shows now (evidence for the mobile pass — nothing else changed)
- Title: fine in both orientations. Lobby and match: they render and respond to taps.
- Match, landscape: the HUD panels fill the screen and the arena is a strip behind them; the page scrolls to 1,009 px tall.
- Match, portrait: panels overlap (step cards over the Spirit card, TURN/SCALE/RIVALS over the step rail), and the page is 404 px wide on a 390 px screen.
- 29 of 37 lobby controls and 13 of 14 match controls are under 36 px (the × on a stack note is 15 px, checkboxes 13 px). The copy still says "type it", "Tab", "Enter", "Shift". Hover-only things: attack reach, the picker's backstory (long press exists), tooltips. The custom arrow cursor draws on touch screens too.

### 📱 Second pass, same day — the phone match preview
Alex's scope: **phone held sideways, online (one player per phone)**, *"make it up in a scratch preview first"*. Built `.scratch/mobile-hud-preview.html` (and the "Phone Match Dial-in" artifact): the real arena behind a mock touch HUD, all five turn states, four phones at real landscape size and safe areas, thumb-reach overlay, left/right-handed, today's screenshot beside it, 14 levers, copy dial-in. `.scratch/mobile-hud/README.md` says what it proposes.
- 🎓 Twelve 44-px note buttons only fit round a ~225-px wheel (a semitone pair touches below that), so the phone wheel makes only HELD notes buttons.
- 🎓 Two stack trays with three fixed hexes overflow an iPhone SE's middle; the trays size their hexes from width.

### 📱 Third pass, same day — the phone layout is in
Alex: *"everything seems fine to me, lets plug these in"* — every lever at its default. `ui/phoneLayout.js` (`PHONE_HUD`, `PHONE_CSS`, `usePhoneLayout`), mounted by `MatchSurface`:
- Applies on a touch screen with no hover whose short side is ≤ 540 px (`?phone` forces it). Tags `<html>` `rlsw-phone`; held upright during a match, `rlsw-phone-portrait` shows "Turn your phone sideways".
- RE-DOCKS the existing panels, same components and handlers: slim top bar, arena fixed to the whole screen (no page scroll — it was 1,009 px), SPIRIT + SOUND as a 150 px rail on the off-hand side, the tap column (230 px) under the main thumb with the step drawers, Rivals and the roll prompt, and the Scale Wheel under the rail. Taps ≥ 44 px in the column; ✓ Commit pinned to the column's floor (`match-commit-row`, the one monolith edit: a className).
- `GlobalCursor` draws nothing without `(any-hover: hover)`. `index.html` gets `viewport-fit=cover` so the safe-area insets are real.
- 🎓 The preview's step-1 WHEEL was the wrong input: the game builds chords from the stock grid in the drawer, and the wheel only picks while composing. The port follows the game.
- 🎓 The wheel opened OVER the column hid the melody honeycomb and ✓ Commit; under the rail it is reference beside the work. And `.match-hud-bar` is a z-index 43 stacking context, so nothing in the dock can out-rank the turn region (44) — which is why the wheel moved rather than rose.
- 🧪 Evidence (cloud copy; this machine's esbuild is the Windows binary): iPhone UA + touch at 844×390 — all three steps render, page 844×390 (was 1,009 tall), column taps 44 px; portrait shows the rotate prompt; desktop gets no class; the roll prompt checked in isolation. eslint clean, `check:bundle` 0 warnings, `test:arch`, `test:client`, `test:render`, `test:arena` and 40+ more pass. ⚠️ 20 suites (engine, legal, eval, journey, battlejourney, standee, topview…) fail IDENTICALLY on the tree from before the phone work, several from gaps in the cloud copy (empty image stubs, missing `.scratch` files) — run `test:all` here to tell real from environmental.
- 🐛 `test:client` caught `import.meta` in `TitleMenu.jsx` (41-title): the model URL now defaults inside `board/titleArena.js`.
- ⛔ NOT PORTED, on purpose (they change components' shape, not where they sit): the melody hand split into two thumb fans, the round action cluster, held-notes-only wheel buttons, left-handed mode (the CSS is there behind `data-phone-hand="left"`; nothing sets it yet).

### ⬅️ NEXT
- 👀 Alex on a real phone: the tap column's text is still the desktop drawer's 7–8 px copy.
- Touch copy for "type it / Tab / Enter / Shift"; tap-to-show for hover-only reach; a left-handed switch in ☰.

## 41-title. The title screen is the real arena, far off and turning — 2026-09-29

Alex: *"For the game's title screen — let's have the screen show the 3D Cosmic arena from afar — slowly rotating off in the distance."* Preview first (the house rule), then his dial-in: distance 84, fov 33, elevation 13, aim −4, bloom .5, exposure 1.45; everything else untouched.

### ✅ What shipped
- 🌌 `board/titleArena.js` (`TITLE_ARENA`, `mountTitleArena`): the match's own GLB, Riven World, spotlights (decorative sweep) and decorative fans in the four player colours, on a long lens and a slow orbit (2.4°/s). `setViewOffset` lens shift puts it right of the menu without it swinging across the frame as it turns. Reduced motion freezes the turn.
- `ui/TitleMenu.jsx` mounts it behind the menu and disposes it on unmount (every mode pick). The island art is now the FALLBACK — shown only if WebGL is missing, the context is lost or the model fails. Loading is simply dark, then a 1.8 s fade-up.
- `.scratch/title-arena-preview.html` re-exports the shipped module, so the preview and the game cannot drift. Published as the "Title Arena Dial-in" artifact too.

### 🎓 Findings
- 🔒 **A published Artifact cannot `fetch()` anything — not even a `data:` URL** (its CSP's connect-src). The first artifact showed the menu over black. Pages that carry a model must hand over the BYTES and `GLTFLoader.parse` them (`modelData`). Proven with a probe under the same CSP.
- 🧨 `String.replace(x, bundle)` reads `$'` and `$&` inside a minified bundle as replacement patterns and splices the page into its own script. Use a function replacer (`build.mjs`).
- 🗺️ `test:arch` was already RED before this session: the five `board/rivenWorld/*` effect modules (2026-09-28) had no rows. Added.

### 🧪 Evidence (cloud container; this machine's esbuild is the Windows binary)
`test:arch` 8 passed, `check:bundle` zero warnings (plus a `src/main.jsx` bundle, since `check:bundle` enters at the monolith and never reaches `TitleMenu`), `test:arena` all PASS, eslint clean. Mounted the real `<TitleMenu>` in Chromium: the arena reaches `data-title-arena="ready"`, one canvas while mounted, zero after unmount; with WebGL stubbed out the island shows and no canvas is left.

### ⬅️ NEXT
- 📱 Portrait phones: the arena sits behind the menu at push-right .2. Tune on the preview's Phone frame if it matters.
- ⁉️ `RiffMenu.jsx` still uses the island backdrop. Should it follow?

## 40-rounds. Alex's marquee size, and two kinds of round: solo on a clock, community first-right-wins — 2026-09-29

Alex pasted his dial-in (size .76, cardScale .6, cardY 1.2, wall .55, halo .22, bulbs 10, bulbSize .08) and: *"1/3 of the time they are community driven — the first to get the right answer gets the card … 2/3 of the time they are non community but run on a timer — say 10 seconds."* Picks: own answer row each; mark community marquees on the board; 15 s for community.

### ✅ What shipped
- The dial-in is `MARQUEE_LOOK`'s default (the look page's "Current" rebuilt to match).
- 🎤 `engine/systems/marqueeRound.js` + kinds on the board (`board.marqueeKinds`, rolled 1 in 3 as each marquee lights). Solo = 10 s clock, late is wrong. Community = a row per Spirit, first right answer wins (anyone), wrong = out, 15 s; bots click at a seeded 3–12 s. Gold community markers in 3D and 2D. Headless community settles from the bots' pre-drawn answers. Testing Grounds 🎤 Flip marquees.

### 🎓 Findings
- ⏱️ **One settle per round.** The round clock is an interval that can tick again before React re-renders the result; without a closure `done` flag a community card could be handed twice. And the updaters MERGE answers rather than replace them — a human's click can land between the tick's read and its write.
- 🎲 The kind is rolled when the marquee LIGHTS, not when it is stepped on — that is what lets the board show it, and it keeps the trigger's draw count a function of state, not of outcome.

### 🧪 Evidence (Alex's machine)
`test:cards` 441 (5/5 mutants on the round rules and kinds), `test:marqueemarkers` 50, `test:marqueejourney` 14 (new, mounted), `test:cardjourney` 14, client, render, determinism, spotlight, arena (run in parts — the VM is slower than the 175 s shell limit for the whole chain), `check:bundle`. Preview: `.scratch/marquee-round-preview.html`.

### ⬅️ NEXT
- 👀 Alex to play a community round with a friend at the same screen.
- 🌐 Relay community answers online (a CUE like the roll's, the server deciding "first").

## 39-marquee3d. The marquee gets a marquee — 2026-09-29

Alex: *"lets continue with the work - mark a marquee in the 3D arena"*.

### ✅ What shipped
- 🎪 `board/marqueeMarkers.js`: per marquee, a pink neon hex rim with 12 chasing warm bulbs, a pink wash, a rising light wall and an inner ring in the quadrant seat's colour; above it a floating, bobbing, turning prize card with the RL logo back. Pop-in with an overshoot; taken ones lift away. Reduced motion: still and instant.
- Wiring: client `marqueeMarkerList` → `arenaFrame.marquees` → `arenaVisuals` (+ `solidRoots`, diagnostics) → renderer "moving". BoardViewport hides the 2D star in 3D (`data-arena-flat="marquee"`); the 2D label reads MARQUEE.

### 🎓 Findings
- 🧱 **A textured card that BLENDS is not solid.** `isSolidMesh` drops `transparent && map` meshes, and the SVG click layer then paints across them. The card is alpha-TESTED instead. The headless check has no canvas (so no texture) — the first mutant survived until the test put a texture on a clone.
- 🖼️ **Import the art by `new URL(…, import.meta.url)`, not `import x from '*.png'`.** The node-side test bundles (`arenaFallbackCheck`) have no image loader; the URL form needs none and Vite still emits the asset.
- 🎲 The first bulb ring sat under the rim at the same radius and vanished into it; the bulbs now ring just inside a thinner rim.

### 🧪 Evidence (Alex's machine + the cloud render)
`test:marqueemarkers` 32 (4/4 mutants). Green: arena, attacktiles, movetiles, spotlight, client, render, the mounted card journey, `check:bundle`. `test:topview` §6 updated for the new solid root; its one red check (`markOccluders([… 'Island'])`) was red at HEAD — the floating-island commit swapped Island for `rivenWorld.formation`. Screenshots of the real `mountArena` at Standard and High: `.scratch/marquee-probe/`.

### 🎛️ Second pass, same day — the dial-in
Alex: *"lets build it out in scratch first … they might be a bit too big — lets build them out with different options for their appearance."*
- `createMarqueeMarkers(root, { pointFor, T })` now takes overrides, and the look gained switches: `floorStyle` (marquee/ring/bulbs/glow/none), `cardStyle` (card/coin/none), `colorMode` (pink/owner/gold), `size`, `cardScale`. Defaults = the look already in the game, so nothing in play changed.
- `.scratch/marquee-look-preview.html` — the real module on a stand-in board with standee-sized cut-outs; 8 presets, **Compare four looks** (one per quadrant), every lever, four views, Standard/High, 🎯 Take one, 📋 Copy dial-in. One self-contained file (three and the logo inlined), so it also opens straight from the chat.
- `test:marqueemarkers` 45 (+13 for the switches). Headless screenshots of the page: no console errors.

### ⬅️ NEXT
- 🎛️ **Alex to pick a look on the dial-in page** and paste the dial-in; then it becomes `MARQUEE_LOOK`.

## 38-quadrants. One marquee per seat in its own quadrant, and the charge spaces retire — 2026-09-29

Alex: *"Lets retire the 'charge' spaces for now — marquee spaces — make 1 per player — always present on the Spirit's starting corner quadrant … if player 1 lands on a marquee space on turn 1, make another in that same quadrant* or *the 'empty' quadrant. If 4 players — make it persistent … (never more than 1 per quadrant)"*.

### ✅ What shipped
- 🎪 `engine/systems/marqueeSpaces.js`: one marquee per seat (`board.marqueeSeats`), each opening in its own quadrant (the spotlights' quarters, 16 hexes each). Taking one relights one AT ONCE in a quadrant with none — which reads Alex's three cases as one rule (4 seats → same quadrant; 3 → same or the empty one; 2 → same or either empty). ≥ 2 hexes from the one taken (flagged, `MARQUEE_RELIGHT_MIN_DIST`). The respawn timer is gone; the client's round-end driver is only a top-up now.
- 🪦 `CHARGE_ZONE_COUNT` 2 → 0. Code kept; the selftest and evalCheck fixtures lay a zone by hand.

### 🎓 Findings
- 🧩 **Three sentences, one rule.** "Same quadrant or the empty one" and "persistent at four" are the same instruction once it is read as *relight in a quadrant that has none* — the four-seat table simply has no other candidate.

### 🧪 Evidence (Alex's machine)
`test:cards` 204 (§10: 2/3/4 seats × 30 seeds × 12 takes; 4/4 mutants caught). The selftest's two board blocks pass when run alone (the suite still stops at its pre-existing Thrash assertion). Green: determinism, client, render, vocab, sonic, spotlight, winconditions, stackslots, arena, `check:bundle`, and the mounted card, Swing and Sonic journeys.

### ⬅️ NEXT
- 👀 Alex to play a 3- and a 4-seat table.
- 🎨 Mark the marquees in the 3D arena.

## 37-cards. Every marquee is the same, and it pays a prize card for battle — 2026-09-29

Alex: *"Lets make all marquee spaces offer cards as prizes - gear/lore don't matter - they all give bonuses for battle"*, *"no more 'difficulty' settings for marquee spaces - they all are the same, and offer random prizes if correct"*, and the effects: *"some have guaranteed rolls, some increase a dice size (d6 - d8 or d10), still others let users use 1 extra dice"*. Chosen: hold the card and play it on an attack; a hand of 3.

### ✅ What shipped
- 🃏 `engine/systems/marqueeCards.js` — six cards (Loaded 4/5/6, Bigger Cab, Full Stack, Encore), weighted draw, hand of 3 with swap-or-let-go, arm/disarm, `cardedRig` applied at `attackParams` and `rollSwingClash`, spent by the attack reducers (`battle.cardPlayed`, `battle.atkFixed`), kept through rerolls, disarmed at turn end.
- 🎪 The marquee: one question from the whole deck (`drawMarqueeQuestion`), no lane, no difficulty; a correct answer wins a card. The ticket (`EventModal`) and the rail hand (`MarqueeHand`) are new; the choice and spend steps are gone. Fans are no longer paid at the marquee.
- 🤖 Bots: odds by the drawn question's difficulty, keep/swap and arm by card value — in `transition.js` (headless, `collectPickups` now exported as a test hook) and the client.
- `evaluate.js` `loud` reads the hand; `marqueeSeek` damps on a full hand.

### 🎓 Findings
- 🎲 **A card that changes nothing must not be spent.** Encore on a stack that already keeps every die, or any card with an empty Drive stack, would burn a prize for no effect. `applyCard` reports `card: null` and the reducers only spend what played.
- 🎲 **The loaded die still rolls.** Setting its face without spending its `rng.int` would shift every draw after it — the dicePool determinism contract. The check pins it.

### 🧪 Evidence (Alex's machine, Linux VM)
`test:cards` 154 checks, 7/7 mutants caught. Green: vocab 640, determinism 20, sonic 80, swing (+ the mounted journey, which bundles the client), dice, client, render, `check:bundle` 0 warnings. 🔴 Red with pre-existing first failures unrelated to cards: engine (`atkTotal = stat + roll`, the legacy Thrash path), transition (`atkChordDrive` on the Swing branch), battleflow, legal, eval, harness; arch (the `board/rivenWorld/*` rows from the floating-island commit).

### 🂠 Second pass, same day — the card at the roll
Alex: *"use the logo inside the RL_Card for the backside of the card … Give the option to 'use' a card in the form of a button — similar to the roll dice button — perhaps above it. Have the cards spin around a few times before presenting themselves … players can pick 1 card."*
- 🃏 **Use a card ×N** above the Roll button on the attacker's own throw → `ui/MarqueeCardPick.jsx`: face-down (the RL logo cut from `RL_Card.png` → `assets/marquee_card_logo.png`), orbit + spin, gather, deal, flip; pick one. Faces built from scratch (ribbon by kind, dice art, name, effect).
- `MARQUEE_CARD_PLAYED` → `combat.js` `applyMarqueeCardPlayed` RE-THROWS the attacker's dice with the card (the battle was already rolled — the gate only reveals it); the presentation adopts the new verdict before the dice show; auto-roll holds while the picker is open. The rail hand is display-only; bots keep arming pre-attack.
- 🎓 **The Roll button is presentation, so a card at the roll has to be a re-throw.** Adopting it meant turning the presentation's frozen `plan` / `clackPlan` / `powers` into rebuildable bindings; everything else already read `battleStateRef`.
- 🧪 `test:cards` 172 (+18 at-the-roll checks); the mounted Swing and Sonic journeys still pass with the client changes; client, render, determinism, `check:bundle` green. Picker screenshots: `.scratch/card-pick/` (`preview.html?t=500`, `?prompt=1`).

### ⬅️ NEXT
- ✅ **Proved in the mounted game (third pass):** `test:cardjourney` (in `test:all`) deals cards from the new Testing Grounds **+1 🃏 Card** grant, opens a Swing, presses Use a card, holds past the 5 s auto-roll, picks Full Stack and checks the re-throw and the clash — 14 checks; un-holding the auto-roll is caught.
- 👀 Alex to play: Testing Grounds → 🧪 TEST → **+1 🃏 Card** a few times, then Swing or Sonic and press **Use a card** above Roll.
- 🎨 Make the marquee visible in the 3D arena (the other half of the P1).
- 🗑️ Delete the dormant rig workout in one sweep (MARQUEE_QUIZ_DESIGN §10.5 item 3).

## 36-clearlens. The battle camera stops filming into nothing, and an attack's reach glows on hover — 2026-09-28

Alex, the **third** report: *"camera glitches at the start of the match where it seems like it zooms really far into the arena - into nothing for a few seconds before correcting … look very closely"*; then *"the bug … happens right at or near the start of the battle triggering"* and the bar: *"if the battle starts, triggers, and plays out the first 5 seconds without any camera glitches or bugs, I'd say its working fine."* Plus: *"a field of view for hovering over an attack - Swing or Sonic (or other special ability) … the spaces that glow up"*.

### ✅ What shipped
- 🐛 **THE ACTUAL CAUSE, found in Alex's screen recording:** the 2D board's battle-opening **dive-bomb** (`boardDiveBomb` → `@keyframes board-divebomb`: the whole `.match-board-frame` spun −540°, scaled to 7×, blurred 12 px and faded to opacity 0 over 1.1 s, `forwards`, cleared at 1.2 s) still ran in 3D — where that frame HOLDS THE ARENA CANVASES. Every bout opened on the correct two-shot for a few frames, then the arena spun away and the page's own space wallpaper (the "planet") showed for ~2 s on his machine, then it snapped back. Now 2D only (`boardDiveBomb && !board3D`); `test:battlelens` §0 fails if it ever plays over the arena again. 🎓 Three camera "fixes" in a row could only ever make it *better* — the camera was never the thing zooming.
- 🔭 **`battleDirector.clearLens`** — every director shot (chair, two-shot, charge, clash, crowds) is settled once per bout (`ctx.memo`) to the nearest clean lens: no standee within `clearNear` 3.4, no non-subject standee in the foreground, no subject cropped or hidden by the other standee, and — through `ctx.sees`, `arenaVisuals`' raycast against visible amp tiers, the grandstands and the truss — no subject hidden by furniture. The two-shot's push starts from the widest point whose whole path in is clear. The charge shot aims at most `chargeReach` 2.2 past its standee (it used to aim 30% of the way to an amp across the arena — the frame's middle was empty floor). Re-settles only if a Spirit moves > .8.
- 🗡️ **The Swing now passes its prints' real facing** (side-on, the carrier's local x) — the director had assumed they faced down the lane and filmed the first charge shot at an EDGE.
- `arenaVisuals.sees` / `setOccluders` (the renderer hands in the crowd and the truss); sight meshes clustered per cabinet/stand/truss, the truss cut into triangle chunks, rebuilt only when the furniture changes and warmed between bouts. `pawnFor` is a test hook.
- 🎯 **`board/attackTiles.js`** — hovering (or arming) Swing, Sonic, Blaster, Tentacle, Psycho Bushido, Gravity Control, Displace or Shukuchi lights its reach in the 3D arena in the ability's colour; a rival in reach burns brighter, rises and gets a second ring; the board dims .3 under it. Client: one `attackReachFor(kind)` built from the click layer's own sets → `arenaFrame`'s `attack`; hover wrappers (`reachHover`) on the five special-ability buttons (a disabled button fires no mouse events). The flat board gets the same hover tint for the specials.

### 🎓 Findings
- 🎥 **Ask for the recording first.** Two sessions reasoned from the description ("zooms into nothing") to the camera; the recording showed the page background in a frame the 3D scene should have filled — a DOM effect, not a lens. A frame-by-frame pull (`ffmpeg -vf fps=10,tile`) took one minute. Brightening a "black" frame ×6 is what showed it was wallpaper.
- 📐 **It was measured, not guessed.** `battleLensHarness.mjs` plays whole bouts headless on a virtual clock through the real GLB, crowd, visuals, director and camera and asks every frame what is on screen. Before: **11 of 50 Sonics and 15 of 40 Swings** had a bad frame, nearly all in the FIRST charge shot (5.6–6 s in — "near the start"): the other Spirit's sheet 1.5–4 units from the lens (up to 4.5× the screen tall), a lens behind a stacked amp, or an aim across empty floor. After: **0 bad frames in 180 fresh bouts** (whole bout, not just the opening).
- ⚠️ `Ray.intersectBox` from INSIDE a box returns the exit point — the truss's box is the whole arena, so a naive "does the ray cross it before `far`" skipped it. And pooling both Spirits' sight samples let one Spirit 40% behind a truss post average out against a clear one.
- 🐢 The cloud Chromium draws ~1 frame/s (no GPU): in-browser timing-based probes are useless there. The virtual clock (performance.now + rAF replaced) is what made frame-exact screenshots possible.

### 🧪 Evidence
`test:battlelens` (new), `test:attacktiles` (new, 28), `test:battledirector` 45 (§1d: 8 new; 3 mutants caught). See the device run in STATE_OF_PLAY's 2026-09-28 camera line.

### ⬅️ NEXT
- 👀 **Alex to play a few bouts** — Testing Grounds, a Swing and a Sonic from a corner and from the middle.
- The first bout of a session can hitch ~50 ms on the cut (cold JIT + the sight list); later bouts ~20 ms. If his machine stutters there, pre-compile the BokehPass and warm the sight list at load.
- The attack tiles' look (colours, fill .5, dim .3) is a first pass — a dial-in page would be the house way if he wants it tuned.

## 35-stings. The Eleven die is a d6, every Spirit gets a calling card, and the calling card becomes how commits sound — 2026-09-28

Alex, three asks in one session: *"lets change that d12 to a d6"* (Goes to 11), *"there should be a sound when a Spirit is selected — something that signifies 'who they are'"*, and on hearing the stings: *"I'd like to make this the standard benchmark for how sounds are committed in game as well"* → ruled **one shared layer over all 12 builds**, not 12 rewrites.

### ✅ What shipped

1. 🔊 **The Eleven die is a d6: five 11s, one 1.** `ELEVEN_FACES` 12 → **6**; fizzle 1 in 12 → **1 in 6**. `rollDie` now reads the LAST face as the 1 (the d12 comparison `< ELEVEN_DIE` would have read every d6 face as 11 — the die could never fizzle). `combatDice.js` draws it as a rounded d6 body, the 11 opposite the 1.
   - 🐛 **Found beside it: the 3D arena could not draw the Eleven die at all.** `createCombatDie` validated against `COMBAT_DICE_SIDES` (4/6/8/10/12/20), so `sides:11` threw *"Invalid combat die."* — every Goes to 11 throw in the arena since 2026-09-27. No suite fed the arena an 11. Fixed (its own legal case, values 1 or 11 only) and guarded in `combatDiceCheck` + `arenaDiceSequenceCheck`.
   - ⛔ **Not re-priced.** It still costs the whole Sustain stack + a blown amp, priced for eleven d6s. Balance is frozen; recorded in `CHORD_VOCABULARY_DESIGN.md` §8 item 3.
2. 🎭 **The Spirit-select sting** — `audio/spiritSting.js`. A 3 s calling card per Spirit built only from what is already that Spirit: its **own mode** (every note is in it, and it plays the mode's tell note — ♭6 / ♭2 / ♮6 / ♯4), its **own rig** (`SPIRIT_TONES`), plus a **character noise** (blade drawn · cabinet slam · laser + sub drop · stomp-clap-glitter). `Lobby.jsx` `assign()` plays it on THIS player's click (never from room state), ducks the menu song to 35%, and a new pick fades the last sting out (its own gains — `playAmpNote` gained optional `out`/`verbOut`, default path byte-identical, `roninToneCheck` §4 still 100).
   - 🎛️ **Alex's dial-in shipped:** `SPIRIT_STING` notes **1.35** · fx **1.42** · tempo **1.22** (tempo stretches onsets, not notes).
3. 🎭 **The signature layer on every commit** — `commitStyles.js` `COMMIT_LAYERS`. The build plays exactly as before; then the layer reads its **money note off what it played** (longest hold → latest → loudest) and adds: an `open` noise at the downbeat, a `land` noise under the money note, and the money note **doubled on a second voice** (the Ronin: shamisen an octave under the KATANA on his first and money notes; on Tsugaru/Iai it flips to the KATANA bent in over the string). Noises reach the game through `commitApi.fx` → `spiritSting.js` `playSpiritFx` (SFX fader). The seat-unlock fanfare passes `{ layer: 'voice' }` — the unlock hit already is that moment's noise.
   - ⚠️ **No new onset after the build's own last note**, so §3's ~3 s turn budget is untouched (asserted, not assumed).
4. 🎛️ **Spirit Sound Bench → v5** (artifact): stings with their levers, the layer's on/off A/B and `COMMIT_LAYER` voice/fx sliders, copy boxes that list changed-vs-default only.

### 🎓 Findings

⭐ **1. A die that was never drawn looked fine for a day.** The Eleven die had a body, labels and a comment in `combatDice.js` — and a validator one line above that refused it. Every piece was "done"; nothing ever asked the arena to draw an 11. 🎯 The new check feeds the arena a real Goes to 11 pool.
⭐ **2. Changing a die's face count silently broke its roll.** `rng.int(ELEVEN_FACES) < ELEVEN_DIE` was correct only because 12 − 1 happened to equal 11. The d6 would have been a 100% 11. Caught by a per-face assertion, not a seed (§B4).

### 🧪 Evidence (Alex's machine, Linux VM; esbuild via the linux binary)

`test:spiritsting` **84** · `test:commitstyles` **838** (was 723) · `test:vocab` **640** · `test:ronintone` 100 · `test:determinism` 20 · `test:mix` 49 · `test:spiritpicker` 63 · `test:dice` ✅ · `test:sonicfx` ✅ · `test:client` ✅ · `test:notekeysjourney` 23 · `test:replayjourney` ✅ · `test:arch` ✅ · `check:bundle` **0 warnings**. Mutants: sting 5/5 + tempo, layer 5/5, Eleven roll 1/1. Chromium: bench runs with zero page errors, 390 px no horizontal scroll; offline renders — stings RMS 0.07–0.09 vs Shred 0.10; the layer adds ~2–15% RMS (Tsugaru roughly doubles: a clean string under a KATANA).
🔴 Unchanged pre-existing: `test:loadoutui` (Game half, note-stock click — the lobby half passes and now clicks through the sting); `lint:baseline` 5 categories over (none from touched files).

### ⬅️ NEXT

- 🎧 Alex: dial the **layer** on the bench (v5) — Tsugaru's KATANA double is the loudest change. Then hear both in the real lobby / a real commit.
- 🔊 Re-price Goes to 11 (balance-frozen; his call when balance reopens).
- The sting phrases themselves are first guesses; Glamarchy's only plays on the bench (her card is locked).

## 34-glowsticks. The crowd waves glow sticks — 2026-09-25

Alex: *"Lets give the fans glow sticks to wave around and use."* Ruled: **visual only** (no rule, balance frozen) and **everyone holds one**, Casuals and Diehards alike.

### ✅ What shipped
- 🪩 `board/glowSticks.js` (new) — `GLOW_LOOK` (Alex's dial-in, 15 of 23 levers: neon mix, mixed hands and wave styles, 77 bpm, brightness 4.6), `glowPose`, `createGlowSticks`. `makeGrandstand` builds them by default; `glow: null` builds none.
- 🎤 `board/cosmicFans.js` — hands named `Fan hand` and exposed as `userData.hands`; the stand's `tick` poses the sticks, `react` re-poses them after the fans jump or sag (a win raises the whole stand to 1.3× tempo; a loss droops and dims them to 0.35).
- 🎨 `.scratch/glowstick-preview.html` now builds its sticks with the game's module (the preview-only copy is in `_to_delete/2026-09-25-glowstick-bundle/`). Also published as the **Glow Stick Study** artifact so Alex can open it without `npm run dev`; the arena ships as base64 there (`window.__ARENA_GLB`) because artifacts will not serve a `.glb`.
- 🐛 Preview camera shots fixed: the blue standee sits dead on its stand's axis 2.3 m in front and filled "Blue stand"; "Close-up" parked inside the front row; "Sticks vs shipped" framed two stands that both had sticks. Shots are now built from `grandstandPlacement`.

### 🎓 Findings
- ⭐ **Instance per stand, not per stick.** The per-stick first cut measured 2,776 draw calls at the default shot with sticks in two stands; the instanced port is six draws a stand at any crowd size (705 at the same shot, same crowds).
- ⭐ **A trail must be a function of time, not of frames.** Ghosts taken from frame history jumped half a swing on a slow frame and drew an X; `glowPose(t − trailGap)` cannot.
- 🧱 Core and cap are solid → `solidLayer.js` re-draws them unbloomed; haze and trail are additive and never solid, so a fan re-drawn in front hides them. Seen only in Chromium/swiftshader.

### 🧪 Evidence (Alex's machine, Linux VM)
`arenaCrowdCheck` PASS, with the glow section **mutation-tested ×6** (trail from "now", dial-in drift, no loss dim, solid haze, trail never hidden, mix never both — all caught) · rest of `test:arena` PASS (presentation, DOM, fallback) · `test:topview` 55 · `check:bundle` zero warnings · eslint clean on the three touched files · `test:arch` still red on the same 5 pre-existing loadout rows only (`glowSticks.js` row added) · preview rendered headless against the shipped module, zero console errors.

### ⬅️ NEXT
1. 👀 Alex eyeballs the sticks **in the running game** on his GPU — especially the unbloomed core over the solid layer, and whether the purple neon dips under the bloom threshold on the pulse trough (0.93 vs 1.05).
2. `test:all`, `lint:baseline` not run this pass (the VM's 2-minute ceiling); run them in batches.

## 33-spotlights. Four owned spotlights, poses that cost −1 instead of everything, and Sustain stops leaking — 2026-09-25

Alex's ask: keep the four corner lights *"shining at a particular hex and have them roam around that hex for the turn"*, stepping to a nearby hex each round; own light → +1 Drive to attack from there and a heal for posing; a rival's light → steal fans by posing there; and a pose's "no Sustain roll" becomes Sustain −1. Rulings from the Q&A: judged at your next turn start on *still on that hex*; once per round; +1 Drive only for an attack made there that turn; heal ladder 10–14 → 1, 5–9 → 2, 1–4 → 3; steal Casuals; −1 replaces "no defence" everywhere; empty seat's light is scenery; lights keep to their quarter, never on 56, never shared; tinted player colour. Mid-session: *"take away that rule that Sustain gets lost every round."*

### ✅ What shipped
- 🔦 `engine/systems/spotlights.js` (new) — pools, forked-rng round step on `board.spotlightSeed`, ownership, `homeSpotlightDrive`, `poseSpotFor`, strike/verdict/break. Round step lives in `applyTurnEnded`; verdict in `applyTurnStarted`; `enforceSpotPoses` runs after EVERY action in `applyAction`.
- ✨ `attackParams` — a posing defender's `defStat` is Sustain −1 and `posing` is always `false` (the reducer's zero-shield branch stays only for old replays). `sonicRig` gained `extraDrive`; `rigFor`, the Swing branch and `swingClash.js` pass the home light's die.
- 🪦 `turnFlow.js` — `Math.max(1, pendingAttacks)` → `pendingAttacks`. No natural decay.
- 🖥️ Client: `togglePose` asks the engine where you may pose; the existing Pose button appears on a player's light with honest text; one `useEffect` narrates the four engine reports (moved / struck / broken / judged). Dice preview counts the home die.
- 🧪 `test:spotlight` **261**, in `test:all`. `test:sonic` flipped to guard the decay cut (80). `winConditionsCheck` control seed 2 → 3 (fixture move, commented).
- 🎨 `.scratch/spotlight-preview.html` — the look, with levers, localStorage and a 📋 dial-in block.

### 🎓 Findings
- 🐛 **`state.rng.seed` is not the match seed.** `applyAction` overwrites `state.rng` with whatever rng the caller passed, so a system keyed on it moves differently under the harness, the tests and the client. The lights carry their own `board.spotlightSeed`.
- 🐛 **The stack-seat × deletes old notes for free** (not fixed, awaiting Alex): it refunds only a note from this turn's stock, so on a carried-over note or the root it just deletes it — or refunds the wrong slot if the same pitch was used this turn. The likeliest "Sustain vanished" besides decay.
- ⚠️ **Bot stack commits read the render snapshot** (`botExecuteStackCommits` prefers `noteStates` over `engineRef`), whose own comment claims `setNoteField` skips `engineRef` — no longer true. Can write a stale stack back. Bot-only; parked with the bot.
- 🚩 **Many suites were already red before this session** and stay red for the same first assertion (compared against a HEAD copy of the touched engine files): engine/selftest, legal, eval, transition, battleflow, slime, eleven, harness, skilltree, shamisen, bushido, b0, journey, arch (the six loadout rows). `test:all` cannot run end to end.

### 🧪 Evidence (Alex's machine, Linux VM; esbuild via `ESBUILD_BINARY_PATH` to a linux binary, since `node_modules` is Windows)
`test:spotlight` 261 · `test:sonic` 80 · `test:winconditions` 87 · turnflow 73 · determinism 20 · buzzer 81 · stackslots 122 · melody 118 · score 133 · riffparity 127,598 · shukuchi 68 · riff 55,706 · trace **2,541 (was 2,197 — longer seeded matches without decay)** · client 6 · render 13 · swing · dice · sonicjourney PASS · `check:bundle` 0 warnings.

### ⬅️ NEXT
1. Alex dials in `.scratch/spotlight-preview.html` → port into `board/arenaEnvironment.js` (aim each light at `board.spotlights[corner]`, wander + step ease, player colour, ring on the lit hex, range outline, pose halo). `arenaFrame` must pass `engineState.board.spotlights` and seat corners.
2. The × ruling, then the fix.
3. ⁉️ Should a poser still be exempt from Swing fray?
4. 🪦 **Amp dial — built, then PULLED the same afternoon.** Alex dialled it in (brackets on, 0.85 × a speaker), it went in (`board/ampDial.js`, 172 checks against the real GLB), then: *"the 'dial' is far too small to see anyways — what actually does help is the outline over top the amps. So — bring back the old amps, keep the red / blue outline on top."* Asked which "old": **before today's dial**, and the outline is the **top-edge glow**. Now: no label at all, all 8 speakers, the red/blue top glow unchanged. Files parked in `_to_delete/2026-09-25-amp-dial/` (module, check, WebGL probe). 🎓 Worth keeping from it: the angled amp faces run almost through the amp's bounding-box centre (use the arena middle for "out"), and a transparent card on an amp is painted over by `solidLayer`'s cabinet re-draw (use `alphaTest`).
5. 🔦 **Beams over everything** (Alex: *"put the light's beam over top anything else — including the amps"*). ⚠️ The cause was layering, not depth: `solidLayer` re-draws the amps on the FOREGROUND canvas after the arena renders, so no depth setting in the arena could ever let a beam win. The cones now live in the foreground scene with `depthTest:false`, `renderOrder 900`, additive — they draw after the solids and the standees. Pools stay in the arena. Checked in a WebGL browser with the real `mountArena` (beams exaggerated ×5 to see them): beams cross the amps' faces. `test:arena` green, `check:bundle` 0 warnings. 📌 The spotlight PORT (preview dial-in) must keep the cones in `overlay`.
6. 🪨 **The amp "foundations"** (Alex: *"below that is what looks like a 'foundation' … I don't think that was there before"*). He was right. Checked against the last commit and 2026-09-22: the GLB and the tier stacking are identical (GLB unchanged since 2026-09-07, stacking since 09-08). What changed is the solid layer (09-24 pixel copy, 09-25 re-draw): amps are modelled from y −0.42, the Stage top is 0.08, and the foreground re-draw had no Stage in its depth, so the buried half-unit was painted over the board. Fix: Stage + Island on `OCCLUDER_LAYER`, depth-only in the solid pass. Before/after rendered from the real `mountArena` (`.scratch/amp-compare/entry.js`; bundles in `_to_delete/2026-09-25-amp-dial/amp-compare-bundles/`). `test:topview` 55 (was 53; its depth-pass regex updated + two 🪨 checks). ⚠️ A little dark geometry still shows where a cabinet overhangs the Island's jagged rim — that is real geometry, visible in the arena pass too.

## 32-colours. No Spirit has a colour of its own; the head in the banner (preview); the amps and fans stop being black glass — 2026-09-25

Three asks, same day.
1. *"There should be no default colors, the only colors that should be associated with any spirits is the color of what player is choosing. So if player 1 - it should be blue, player 2 - orange... All the standee/colors should reflect this arrangement."*
2. *"after choosing a Spirit - That Spirit should appear in the Player window … Can you put a close up of their heads maybe in that banner area, and make it look cool?"*
3. *"[the amps/fans] are totally black and reflect the whole arena like as if it were some kind of black glass … can you render the textures as how they should be (how they were before)"*

### ✅ What shipped
- 🎨 **The player-colour rule.** `SPIRIT_DEFS` has **no `color` field** any more, and the skill tree's three Spirit routes have none either. A Spirit's only colour is `playerColor(corner)` (`data/corners.js`), which is P1 blue `#4488ff` and P2 orange `#ff6600` (the "red" corner), then purple and yellow. In a match this was already stamped at start (`seatSpirit` / the lobby). What changed is everything that bypassed it:
  - **The picker.** Every roster card, its halo, its 3D standee's neon edge, base and rim light, and the backstory panel wear the CHOOSING seat's colour. `createSpiritPickerStage({ color })` and `stage.setColor()` re-cut the standees when the seat changes; the canvas and its WebGL context stay.
  - **The Game** (`seatColor(id)` beside `triggerEffectFlash`): BUSHIDO!, SHADOW!, SHUKUCHI, WARP, RA!, BLAST!, SWALLOWED!, MOSH PIT!, MIC DROP!, FIRED BACK!, BOOM BOX ON! and the Shadow's GONE / MISS! numbers. Also the rail buttons for Bushido, Shadow, Move Shadow, Shukuchi (with its budget pips), Warp, Gravity and Mosh, via `actingHue` / `actingHueLight` / `actingHueDim`. Also the warp band, Shukuchi's ring and arcs, and the **Bushido lane** (`BushidoOverlay` `hue` prop). The two lanes keep Alex's dial-in shape and alphas; only the starting hue moves. Their defaults are still the dial-in blue, so `test:bushidoui` 331 and `test:shukuchiui` 80 still diff clean against their previews.
  - The signature-abilities modal, the upgrade modal and the Testing Grounds panel read the seat's colour instead of a route's.
  - ⚠️ **Kept on purpose:** colours that mean a THING rather than a Spirit (slime green, damage red, pyro orange, the gravity vortex purple, the Style colours Shred/Groove/Flair) and the art itself (the Ronin's print is still the Ronin's print).
- 🎭 **The head in the seat banner — previewed, then ✅ WIRED at Alex's dial-in the same day** ("Looks rad. Lets wire it in!"). He moved **5 of 33 levers**: height 118 → **141**, width .58 → **.73**, panelAlpha .5 → **.6**, slant 16 → **18**, enterMs 520 → **760**. Every head focus stayed at its default. `SpiritDraft` passes `portrait={SEAT_PORTRAIT}`. `seatPortraitCheck` §0 pins the numbers, and its §5 guard now fails if the portrait ever drops out. The real `SpiritDraft` was rendered in cloud Chromium with P2 choosing: the orange cards and both heads are there (`.scratch/seat-portrait-wired-2026-09-25.png`). `.scratch/seat-portrait-preview.html` (Vite, `npm run dev:seatportrait`) and `seat-portrait-preview.standalone.html` (double-click; `npm run build:seatportrait`).
  - It draws the **real banners**: `DraftSeats` was lifted out of `SpiritDraft` for this.
  - The head is the standee's own print, clipped to the `body` ring and edged along the `panel` ring in the player's colour. It sits on a slanted, striped backdrop with a big stroked player number, breaks out of the top edge, slides in on a pick and drifts slowly.
  - There are 21 look levers, plus x / y / head-height for each Spirit. The page has localStorage and a changed-vs-default copy block.
  - Modules: `ui/seatPortrait.js` (pure), `ui/SeatPortrait.jsx`, `ui/SeatPortrait.css` (through `index.css`).
- 🧱 **The solid layer re-draws instead of copying** (`board/solidLayer.js`).
  - The foreground draws the amps, fans and dice again with their own materials, the arena's lights (enabled on the solid layer for that pass only), its environment, tone mapping and exposure. It draws depth first, pushed back by `polygonOffset`, then colour, then the standees.
  - The hexes still cannot paint over them, and the textures are the real ones.

### 🎓 Findings
1. ⭐ **A CPU renderer cannot vouch for a cross-context canvas read.** 30-topdown's pixel copy (`CanvasTexture` of the arena canvas, sampled at `gl_FragCoord`) passed its before/after in cloud Chromium, which renders on SwiftShader. On Alex's GPU it drew black glass. Uploading one WebGL canvas into another context takes a GPU fast path with its own orientation and freshness, and a software renderer never exercises that path. **Cloud verification of anything that reads a canvas back is not evidence for real hardware.** The re-draw was checked in the same harness (`.scratch/solid-layer/redraw-check-2026-09-25.png`), and it cannot sample the wrong place because it samples nothing.
2. **The four default colours were the four corner colours**, in order. So the bug was invisible in every 4-player setup that happened to seat the Spirits in roster order, and obvious the first time P2 picked the Ronin.
3. **Lights obey camera layers.** Re-drawing PBR meshes on a layer the lights are not on gives unlit meshes plus environment reflections. That is the same "black glass" look, reached from the other side.

### 🧪 Evidence
- `test:seatportrait` **66** after the port (new, in `test:all`; 6 mutants, 6 caught). `test:loadoutui` still reaches its old note-stock red, which means the draft half passes with the heads mounted. `test:topview` **52** (§6 rewritten for the re-draw; 2 mutants caught). `test:spiritpicker` **63**. `test:bushidoui` **331**, `test:shukuchiui` **80** (cloud). `test:winconditions` 87, `test:loadouts` ✅.
- `check:bundle` **0 warnings** and the full `main.jsx` bundle **0 warnings** (cloud, media stubbed).
- The preview was rendered in cloud Chromium at every case: zero page errors.
- 🚩 **Red before this pass and not touched:**
  - `test:engine` ("atkTotal = stat + roll"), `test:legal` ("without the unlock he swings the ordinary Smash") and `test:skilltree` ("the skillTarget family finally appears"). All three fail identically with this pass's `spirits.js` / `skillTree.js` swapped back to HEAD, so they come from the uncommitted working tree.
  - `test:standee` §4.
  - `test:loadoutui` at the note-stock click, after the draft half passes.
  - `test:arch` §1: the five loadout modules.
- ⛔ `test:arena` was not run. The GLB and art are not in the cloud copy, and the device cannot run esbuild.

### ⬅️ NEXT
- ✅ ~~Dial in the seat portrait~~: done and wired, as above.
- **Alex:** look at the amps and fans in the running game. It is the first time the re-draw has been on a real GPU.
- 🐛 **Found beside it, not fixed:** `UpgradeModal`'s route filter compares `route.spiritOnly` against `acting.id`, which is a SEAT id (`cosmic_ronin::blue`), so no Spirit route can ever match. The modal is behind "coming soon", so it is dormant. Fix it with `characterId(acting.id)` the day the shop opens.

## 31-picker. The select screen shows the standees, they pop, they tell a story — and the acrylic cuts the figure only — 2026-09-25

Two asks, same day.
1. *"When the mouse hovers over a character - have it 'pop out' - if it hovers over even longer, have its backstory revealed - place holder story for the time being. Change the buttons so that the 3D standee shows - not just the picture."* Dialled in on `.scratch/spirit-picker-preview.html`: **2 of 31 levers** (`panelLook` → tint; `compare` off, a preview-only switch).
2. *"The Ronin (possibly others?) have slight details (Ronin's lightning emitting from the body) … Only the immediate physical part of the standee should be covered in the acrylic layer, other 'effect' areas should be cut off."* ⚠️ **Reverses the 2026-09-18 ruling** "cut everything in the art".

### ✅ What shipped
- 🎭 **`ui/spiritPickerStage.js`** + `SpiritDraft.jsx`'s `SpiritRoster`: each roster card shows `createStandee` (the board piece), drawn by ONE shared transparent canvas on `<body>` into the card's rect plus a 110px bleed.
  - **Hover:** it pops after 120 ms (×1.3, lifts, turns to face you, edge glow ×2, hex ring) and the others dim.
  - **Long hover:** after 1.3 s the backstory types on beside the card, with a stat line. Escape dismisses it; keyboard focus is the hover; a long press on touch.
  - **Pick:** a 360° spin. Reduced motion snaps everything. The locked Spirit is a silhouette and never pops.
  - ⚠️ **No WebGL2 → today's flat PNG**, so the picker can never go blank (jsdom in `test:loadoutui` takes this path).
- 📖 **`data/spiritStories.js`** — ALL PLACEHOLDER. A separate file, not a `SPIRIT_DEFS` field: those entries ride every match's state and the netcode.
- ✂️ **The standee's shipped cut is now `body`** (`STANDEE.cut`), everywhere — board, Swing, picker. `body` was re-traced (`.scratch/trace-standees.py --splice`): glow off (soft pixels further than 0.4% of the height from solid ink), strokes thinner than 0.8% off, loose crumbs off. The print is clipped to the same ring, so the lightning is gone from the print too.
  - **Per Spirit:** Ronin loses the lightning and the blue haze, keeps the shamisen headstock, pegs and topknot. Monster loses its soft halo and the detached slime drips. Intergalactic 0 loses its orange glow rim. Glamarchy (locked) loses the hair sparks.
  - `tight` is kept byte-for-byte as the record and as a lever on `standee-preview.html`. An unknown cut now falls back to the SHIPPED cut, never to `tight`.

### 🎓 Findings
1. ⭐ **The old `body` could not carry the new ruling.** Its 3.5% opening ate the Ronin's headstock and pegs, which are thin but physical. What separates effect from figure is not size alone: **the glow is soft and far from ink; the bolts are thin; the drips are detached.** Three tests, three steps.
2. **Clip the pop to SCROLLERS, not to `overflow:hidden`.** The workbench is `hidden` for its corners; clipping to it would stop the pop at the panel's edge — the one edge it is meant to break.
3. **`canUseWebGL` asks the window, not a canvas.** Asking a jsdom canvas for a context prints a "not implemented" error into every run of the suite.

### 🧪 Evidence
- `test:spiritpicker` **63** (new; 8 mutants, 8 caught after one was closed with a fake-window case). Framing is checked by projecting through a real three camera: feet within 1.5 px of `footPad`.
- `test:standee` **100** + 1 red (§4, the pre-existing regex against the uncommitted `arenaVisuals.js`, as 30-topdown recorded). Six new assertions on the figure cut (lightning gone, headstock and topknot kept, figure never bigger than `tight`).
- **In the cloud, real Chromium:** `SpiritDraft` mounted with the real CSS under a scrolling panel — rest, pop, story, pick → loadout, and a scroll that proves the standees clip at the header. Zero page errors. `check:bundle` and a full `main.jsx` bundle: zero warnings. eslint clean on every touched file.
- 🚩 **Red and not touched:** `test:loadoutui` fails at the note-stock click, *after* the lobby/draft half passes (`click` asserts `disabled === false` on a `<div>`), identically with the old `SpiritDraft.jsx`. `test:arch` §1 still names the five loadout modules.

### ⬅️ NEXT
- **Alex:** write the real backstories into `data/spiritStories.js` and flip `placeholder:false`.
- Watch the picker's cost on a low-end machine: it is one extra WebGL context, only while the roster is on screen.

## 30-topdown. Top-down holds its axis, 📌 Hold keeps the camera still, and amps/fans/dice turn solid — 2026-09-24

Two passes, same day.
1. *"If the camera is set to top-down view, don't let the camera wander … same goes for the battle sequence … no slow motion or anything, but each action still plays out."*
2. *"Make sure top-down does not 'equal' stationary. Any movement that tilts the axis means not top-down … just zooming in or out … still keeps with top-down view. A separate option to keep stationary … automatically off but can be turned on."* And: *"Make sure amps, fans, and dice are a separate and solid layer of their own — some of the spaces seem to 'shine' through them."*

### ✅ What shipped
- ⌗ **Top-down is an AXIS** (`board/topDownView.js`, pure):
  - It is the line from the target to the lens. Dolly and pan keep it; any orbit ends it.
  - The tolerance is 0.5°, which is float noise only.
  - While top-down is on, `arenaRenderer` asks neither the director nor the idle flow, and holds the battle lens as if the player had grabbed it.
  - The first `change` that leaves the axis drops top-down and tells the client (`onTopView(false)`). The auto camera then gets its normal 6.5 s resume.
  - ◈ Arena / ◎ Spirit still clear it. `rlsw.topView` is saved per machine and is off by default.
- ⏱️ **A Sonic started under Top plays in real time.** `verdict.realtime` is stamped once, at the start. `barrageRealtime` turns off the hit-stops and the slow break on the picture, the chords and the rules' timers together. The ring beam's own eased approach is part of how the beam looks and is unchanged. The Swing had no slow motion.
- 📌 **Hold** (arena toolbar) is **the ☰ Auto camera switch, inverted.** Off means no roaming, no idle drift and no battle shots, which is exactly the "stationary" asked for. Hold is off by default because Auto camera defaults ON. There is one setting, never two that could disagree.
- 🧱 **The solid layer** (`board/solidLayer.js`), with a before/after in `.scratch/solid-layer/`:
  - The foreground canvas re-draws amps (every tier), fans and the Sonic's floor dice as silhouettes that copy the arena canvas's own pixel.
  - It then draws the standees on the same depth, so a standee behind an amp is hidden now too.

### 🎓 Findings
1. ⭐ **"Shining through" was the layer stack, not a material.** The board's SVG is a CSS3D plane between the arena canvas (z 0) and the foreground canvas (z 2). A DOM layer has no depth, so every hex tint painted over whatever stood in front of it on screen. The move tiles had already been moved into WebGL for this reason (`26-camtiles`); the tints never were.
2. ⭐ **The camera can never go under the board** (`maxPolarAngle` 0.43π). So anything standing on it is in front of the SVG on every pixel they share. That makes "copy the finished pixel above the SVG" exact, with no depth sorting against the DOM at all.
3. **Copy, don't re-draw.** Sampling the arena canvas at `gl_FragCoord` brings its lighting, bloom and DOF along for free. A lit copy in the foreground would have drifted from the original on the first material change.
4. **OrbitControls keeps a flick's damping tail in private deltas.** Pressing ⌗ Top mid-tail would tilt the brand-new preset and drop it the same frame, so `frameView` zeroes them first.

### 🧪 Evidence
**On Alex's machine:**
- `test:topview` **49** (8 mutants caught across the two passes)
- `test:cameradirector` 87
- `test:battledirector` 38
- `test:movetiles` 41
- `test:headdial` 67
- `test:sonicfx`, `test:arena`, `test:swing`, `test:sonicjourney`
- `check:bundle` **zero warnings**

**In the cloud** (real Chromium, real GLB, every hex magenta):
- Before and after at the arena camera and a battle's dice.
- Driven with the mouse: after ⌗ Top, a wheel zoom and a right-drag stay top-down; a left-drag orbit leaves it, and the camera resumes 6.5 s later.

🚩 **Red and not touched:**
- `test:standee` §4 (the regex fails on the untouched file too)
- `test:arch` (the six loadout modules)
- eslint `arenaVisuals.js:511` unused `i`

### ⬅️ NEXT
- **Alex:** watch it for cost on his machine. It is one extra canvas upload per drawn frame; if it is heavy, gate it to frames where a solid mesh is on screen.
- **Not solid:** the Rival's shield (translucent by design) and label cards. Hex tints still show through those.

## 29-sandbox. Testing Grounds revived, the ring beam restored, the Sonic clash and the push-in — 2026-09-24

Three asks in one session, in the order Alex made them.

### ✅ What shipped
- 🧪 **Testing Grounds** — *"take any player and drop them anywhere … use any move at any time"*. All seats human; 🎮 Play as / 📍 Drop / 🆓 Free play + step jump. Two new engine actions (`SANDBOX_SEAT_TAKEN`, `SANDBOX_REFILLED`) so an exported sandbox log still replays. `buildTestingGroundsConfig({ freePlay })` — the menu/lobby pass `true`; the journey suites do not (they drive real turns).
- 🔊 **The ring beam, restored** — *"bring those back … I didn't want those to be replaced"*. Found in git: signed off 2026-09-13, in the game 09-15 → 09-19, then wrapped by `createSonicBarrageVisuals` with `tuning:{slowmo:18,burst:2.1,ringTail:16}` and its shield hidden. The code itself was never lost — `sonicZigzagVisuals.js` is untouched since 09-15. Nothing live draws the barrage wrapper now.
- 🛡️ **The Sonic clash** — Alex's beat list, built as `sonicClashVisuals.js` on the restored beam. The freezes are the CLOCK's, not the picture's: `barrageTime` / `barrageSimulationTime` are one exact inverse pair with a hit-stop per contact and a slow break, and the chord clashes, the crack, the push and the result beat were already scheduled through them — so they follow with no edits.
- 🎬 **The camera** — chair/side shots fitted to both Spirits (`fitDistance`); the two-shot push-in with speed lines (`speedLines.js`, a DOM canvas) at the opening and after the dice line up; player-colour dice.

### 🎓 Findings
1. ⭐ **"Zooms in to nothing" was a FIXED camera aimed at a FUTURE thing.** The chair stood 6.5 out, 7 up, aimed at where the dice were about to land — so the first second of every bout was empty floor. A shot must be fitted to what is already there.
2. ⭐ **The quality loss was a `tuning` override at one call site**, not lost code. The ring beam's own defaults were right all along; the barrage passed three smaller numbers to fit its cadence. `sonicBarrageCheck` now asserts the barrage wrapper is not in the live arena.
3. **The dev panel sat on the Move & Act rail.** Found by driving the sandbox in Chromium: the Face button was unclickable under it. It opens on the right now.
4. **Another session was editing the tree at the same time** (idle camera, `idleFlow.js`, 11:13). No clash — every edit here was a read-modify-write of the file as it stood — but a cloud copy taken earlier was missing `idleFlow.js`. Re-stage before trusting a cloud copy.

### 🧪 Evidence (Alex's machine unless marked)
`test:sandbox` 36 (7 mutants caught) · `test:battledirector` 33 (fixed-chair and zoom-to-nothing mutants caught) · `test:sonicfx` (hit-stops, slow break, hit kinds, one ring beam per die, no barrage wrapper) · `test:dice` · `test:cameradirector` 87 · `test:sonicjourney` · `test:swing` · `test:arena` · `test:render` 13 · `test:client` · `test:determinism` 20 · `check:bundle` **zero warnings**. ☁️ Real Chromium (cloud, full tree): menu → Testing Grounds → Play as → Drop → Free play → Face → Sonic, recorded; the clash rendered frame by frame beside the 09-19 barrage.
🚩 Still red and not touched: `test:journey` (looks for the removed "3D board" button), `test:battlejourney` (old 2D Swing overlay), `test:arch` (the six loadout modules — mine are documented).

### 🐛 First report back, fixed the same day
*"The very first camera fixture after a Sonic attack is committed is buggy, pointing at nothing, zoomed in extra far into what looks like the stage. Make sure the amp itself isn't 'pulsing' or moving."*
- 🎓 **Swiftshader hid it twice.** The cloud browser auto-drops to Standard quality, which switches the depth of field OFF, and draws ~1 frame in 2 s — so every earlier capture looked fine. Found by probing the director against the REAL arena headless (every shot, every geometry, projecting each standee and scoring how square-on its print is), then confirmed in Chromium with the downgrade disabled.
- **Cause:** the two-shot was square to the lane. Two standees facing each other are, from there, two sheets of acrylic seen within ~12° of edge-on; at adjacent range the fit put the lens 4.8 from the floor between them. Same fault in charge shots wherever an amp sits square to the Spirit's facing (0.04 square-on measured for Intergalactic 0 at #12 → #38).
- **Fix:** `battleDirector.js` takes the pawns' real print facings (`facings`, from `arenaVisuals` `printFacings`), picks the smallest swing off the front side that sees BOTH prints ≥ `twoGood` (.6) — scored on the ray to each standee, since perspective matters at that range — floors the distance at `twoMin` (8), and bends every charge lens with `readable()` to ≤ 60° off a print. Amp cabinets no longer scale (±2.5% jitter while energised + a kick per attack) — the status lights step up and hold.
- Evidence: `test:battledirector` 38 (§1c new; `twoMin`, `readable` and the search all mutant-caught), `test:sonicfx` (amp scale asserted unchanged through a Sonic; jitter mutant caught), `test:dice`, `test:cameradirector`, `test:arena`, `test:sonicjourney`, `test:swing`, `check:bundle` zero warnings.

### ⬅️ NEXT
Alex plays it in the Testing Grounds and reports what feels off. The obvious levers: `SONIC_BEATS` (spacing 1.25, hit-stop .5, break rate .3), `SONIC_CLASH_LOOK` (weak/strong split, build rings), `BATTLE_DIRECTOR` two-shot (`pushFrom`, `pushTime`), `SPEED_LINES`, `BATTLE_INTRO`. Crack lines are 1 px WebGL lines — if they read too thin, they want to become meshes.

## 28-standees. Your 2D characters, stood up in acrylic — 2026-09-18

✅ **SHIPPED, SAME DAY.** Preview built, dialled in (**1 of 26 levers**: `height`
2.6 → **2.8**), ported. `spiritMiniature`'s block pawns are gone from the board;
each Spirit now stands there as its own drawing, cut out of acrylic.

- `.scratch/standee-preview.html` — one file, 26 levers, the real hex map and the
  real camera. `.scratch/standeeDialInCheck.mjs` — 46 assertions, a probe (it
  needs playwright, which this repo does not depend on).
- `src/board/standee.js` + `src/board/standeeOutlines.js` + `standeeCheck.mjs`
  (`test:standee`, **93 assertions**, 16/16 mutants caught). The outlines are
  traced from the real `src/standees/*.png` by `.scratch/trace-standees.py`.

**Alex's three rulings, and they are the shape of the module:**

- **Facing** — *"the facing is the way the spirit is facing … lets do away with
  'mirror'"*, and then, on seeing it: *"I'd like the base art part to be the
  'direction'"*. `standeeYaw` is the only place it lives; the camera never gets a
  vote. One `DoubleSide` print, so the back is the front seen from behind through
  the sheet — no mirrored art, no second texture.
  🎓 **AND THE FIRST PORT HAD THE MAPPING MIRRORED.** It inherited
  `facing + π/2` from `spiritMiniature`, which is the correct mapping reflected
  about the x axis: right at 0° and 180°, a full 180° out at 90° and 270°, and
  **exactly 90° out on every diagonal** — which on a hex board is most facings,
  and is why Alex saw the edge of the sheet pointing the way a Spirit was
  looking. The true mapping is `yaw = π/2 − facing`, and it follows from three
  facts: `facingAngle` is `atan2(dy, dx)` in SVG pixels, `arenaPoint` maps
  py → +z, and a Y rotation of `yaw` points local +z at `(sin yaw, cos yaw)`.
  ⚠️ **The block pawn carried this bug for as long as it existed** and nobody
  could see it, because a chunky block has no readable front. Both pawn kinds now
  share `standeeYaw`, so there is one convention on the board instead of two.
  📌 The test asserts it **on the mesh, not on the formula** — it turns a real
  standee through 24 facings and reads the art plane's world normal back out.
  ⚠️ One consequence he can see and I could not decide for him: under the
  near-overhead TACTICAL view a sheet is a line. `steepPitch` tips it back —
  **pitch only, never yaw** — and `steepLean:0` turns it off. He kept 35°.
- **Look** — *"acrylic with neon edges - but behind that, a transparent gloss
  look"*. Real `transmission`, `ior` 1.49, the tint in the ATTENUATION.
- **Cut** — *"cut everything in the art"*. `tight` (the default) follows the
  Ronin's lightning as spurs of acrylic; `body` cuts the figure alone.

🎓 **TWO TRAPS THIS COST, both now comments and both now tests:**

1. **The trace threshold has to be the shader's threshold.** The first pass
   traced at alpha ~25 while the print draws at `alphaTest` .45 (= 115/255), so
   the acrylic was cut around a halo of pixels that are never drawn — the
   Metalness Monster stood on a grey card two hexes wide.
2. **three draws the whole transparent queue after the opaque one.** An "opaque"
   print is therefore drawn BEFORE the sheet, and the sheet washes over it:
   every character came out a grey ghost. The print is `transparent` and sorted
   after the sheet (renderOrder 10 > 8), and the sheet never writes depth.

📌 **AND THE CARRIER HAD TO STOP ANIMATING.** `arenaVisuals`'s pawn loop applied
the block's `rotation.z`, scale pulse and bob to every pawn. Left on, they fight
the sheet's own lean, fall and sway — and the tip-back needs the camera, which
only the standee's `frame()` is given. The loop now hands a standee off and
`continue`s, and a regex test holds that line.

📌 A standee **stands on** the deck (`STANDEE_Y` = .2, the same height the move
tiles use); the block floated at .34 because it had no stand of its own.

**Verified:** `test:standee` 93 · `test:movetiles` 41 · `test:cameradirector` 87
· `test:arch` ✅ · `check:bundle` 0 warnings · ESLint clean on every touched file
· and the REAL `mountArena` driven headless with the real art and the real GLB
(12/12: three standees in the live scene, standing at .2, carrying their own
textures, tipping under the tactical camera, turning when a Spirit turns, falling
when one is knocked out).

🚩 **FOUND IN PASSING, NOT FIXED — `test:b0` and `test:bushidoui` are RED, and
they were red before this work** (confirmed by stashing it). `b0check.mjs:61`
asserts a seeded single note reads **Drive 3** and the engine says **1** — that is
the 1–5 chord-table rebase already on Alex's desk ("should an empty Drive stack
hit harder than any chord?"), so the test encodes the pre-rebase table.
`test:bushidoui` dies on `ENOENT: Claude outputs/bushido-lane-preview.html`, a
path that does not exist in this tree. ⚠️ **`test:all` stops on the first red, so
the full sweep cannot currently run end to end** — which is exactly the condition
§B warns about, and it is not caused by the standees.

## 27-calmcam. The same camera, dialled down — 2026-09-18

Alex re-opened the preview and sent a second dial-in: **26 of 55 levers, 19 of them
camera**. Nothing about the SHAPE changed — Ken Burns moves, quiet-earned wide shot,
magenta tiles are all as built — this pass is about pace and framing.

- **Slower:** swing 5 → **0.5**, drift 4 → **0.5°/s**, drift during action .35 → **.1**,
  breathing .17/18 s → **.055/7.5 s** → **off** (a third one-lever pass the same day:
  `breathe 0`, leaving the 0.5°/s drift as the only idle movement — `cameraDirectorCheck`
  §1's "never still" assertion is now judged over a SECOND, not a frame, because 0.17
  units a second is 3 µm in one frame), one idle shot every 7 s → **20 s**, the wide shot
  after 27 s → **60 s**, easing back after a grab 1.6 s → **3 s**.
- **Closer and flatter:** idle 24 → **19** at 52° → **44°**, wide 48 → **36** at 62° → **38°**,
  aim height .9 → **.45**. The Ken Burns numbers and every tile number are unchanged.
- `cameraDirector.js` re-lifted from the page; `test:cameradirector` still **87**, all 15
  mutants still caught, `test:movetiles` 41, `check:bundle` 0 warnings, `test:arch` ✅,
  `test:arena` ✅.
- 🎓 **Finding — the director's own 100 ms cap is a slow-motion switch below ~10 fps.**
  `update()` clamps `dtMs` to 100, so on a machine running at 4 fps the camera moves at
  ~40% speed. It is invisible at 30–60 fps and it is what keeps one long frame from
  teleporting the camera, but it is why the headless render takes ~40 s to settle into a
  shot that lands in ~4 s on real hardware. Do not read a slow headless settle as a bug.
- ⛔ Device shell still down; nothing ran on Alex's machine.

## 26-camtiles. The camera stays on the Spirit, and the move tiles turn magenta — 2026-09-17

Alex played 25-autocam and came back with two notes. For movement the camera should
*"mainly focus on the Spirit in question … more subtle, like a ken burns effect. The wide
shot should only really be used when action has ceased for a period of time - default
camera pan should remain on the character or its surroundings."* And the 3D move tiles
*"are nearly the same color as the tiles in the 3D arena - making it very difficult to
tell which space is able to be moved to or if movement even remains."* Colour ruling on the
proposal: **"Pink instead of gold."**

### 🔍 Why the tiles vanished
The client paints a reachable hex `#ffffff18` (9% white) with a `#ffffff88` stroke. In 3D
`BoardViewport.jsx` hides every hex stroke (`.hex-g > polygon { stroke:transparent }`) so
the flat outlines don't slice through the standees. **Only the 9% fill survived**, over a
model whose tiles already have pale edges. And nothing anywhere showed steps left.

### ✅ What shipped
- 🎛️ **Preview first:** `.scratch/camera-move-tiles-preview.html` (55 levers, a TODAY'S-tiles
  compare button, and a stand-in board closer to the GLB). **The dial-in moved 17 levers**
  and they are now the page's defaults. `auto-camera-preview.html` (v1) is kept as
  history; parity checks now point at the v2 page.
- 🎥 **`cameraDirector.js` v2, lifted line for line from the page.**
  - Idle program is close · surroundings · hero; **wide only after 27 s of quiet**, then
    held (`longIdle:'hold'`). The quiet clock resets on any live action, a new turn, or
    the camera resuming after a grab.
  - A **move is Ken Burns**: keeps the azimuth, eased push on the SHOT's clock (so extra
    steps in one move don't restart it), no drift/breathing during it.
  - Surroundings leans 25% toward a rival farther than 9, instead of framing both.
  - Dial-in: swingRate 5, breathe .17 over 18 s, afterHold 2.3 s, wide after 27 s,
    kbPush .11 over 3.6 s, 9° pan, moveFollowRate 5.2, moveDistance 27.
- 🟪 **`board/moveTiles.js` (new)** draws the tiles in the scene: per-hex additive plate
  plus ring. Dial-in: magenta `#ff3df2`, **outline** style (faint magenta fill, ring in the
  Spirit's colour), glow 2.25, pulse 2.4 s, hover .75. Step pips sit on the camera's side
  of the pawn and the board is dimmed .25 by a dark disc under the tiles (it never touches
  the GLB's materials).
  - The pure half: `tileWant`, `fadeToward`, and `createStepBudget` (the engine only keeps
    steps LEFT, so the pip count is the turn's high-water mark).
  - The Shadow's walk lights tiles but draws no pips (its decoy isn't in the arena).
    `farReach` was turned OFF in the dial-in, so it's recorded, not built.
- 🔌 **Wiring.**
  - `arenaFrame` gained `reach`, dropped when the owner is smoke-hidden or the Shadow has
    no decoy in the frame.
  - The client sends the SAME `reachable` / `shadowReachable` sets the click layer uses,
    plus `moveStepsLeft`, `shadowIllusion.stepsMax` and the existing `hovered`. That's why
    hover needs no raycast.
  - Polygons carry `data-move-tile`, and BoardViewport hides that fill once `data-arena-ready`.
  - `arenaVisuals` owns the tiles like the head dials. The renderer's reduced-motion loop
    keeps drawing while `stats.moveTiles>0`.

### 🧪 Evidence (cloud, full tree + real node_modules)
- `test:cameradirector` **87** (was 74). New: Ken Burns angle/push/no-restart with a
  control that v1 side mode does swing, wide-after-quiet, holds, resets on effect/new
  turn/grab, `mix`, far-rival lean.
- `test:movetiles` **41** (new, in `test:all`).
- **15 mutants across both modules, all caught.**
- `check:bundle` **0 warnings** · `test:arch` ✅ · headdial 67, arena, sonicfx, dialtick,
  render, client, journey, battlejourney, replayjourney, sonicjourney, crowdbubble ✅.
  ESLint on every touched file: clean.
- **Real `mountArena` + GLB in headless Chromium:** tiles around the Ronin with hover,
  pips, zero-steps and cleared states, console clean. Screenshot matches the preview at
  the same settings: solid-looking magenta with a lilac edge, because the additive fill
  blooms on the dark board.
- 📌 **Watch:** the spent-step pips (`#3a4666`) are faint on the blue board, the same as on
  the preview Alex approved. One number if he wants them louder.
- ⛔ Device shell down — nothing ran on Alex's machine.

### ⬅️ NEXT
Alex plays a 3D turn. If the spent pips are too quiet, it's `grey` in `moveTiles.js`
plus a lever on the page.

## 25-autocam. The camera follows the action, and lets go when you grab it — 2026-09-17

Alex picked the camera over the remaining P1s, and closed two in the same breath: the
**beginner chord finder is green** (*"it seems to work fine on my end"*) and **melody
scale guidance is closed** as redundant with the finder and the fans. His ask:
*"a 'moving camera' that instinctively follows the action … never quite just 'sitting'
in one spot … let players take control if they want to - this turns 'off' the moving
camera function. But if its sitting idle, let the camera start to move on its own again
- perhaps after 6 or 7 seconds."*

### ✅ What shipped
- 🎛️ **Preview first** — `.scratch/auto-camera-preview.html` (31 levers, localStorage + 📋
  dial-in). Alex: *"I love it - I wouldn't change a thing."* **All 31 defaults approved.**
- ⭐ **`board/cameraDirector.js` IS the preview's director, copied line for line.** The page was
  written so its director touches no THREE and no DOM. So the thing he judged is the thing
  that ships, and `test:cameradirector` §0 diffs the two whenever `.scratch` is present.
  The one change ported both ways: `nearestRival` guards a missing acting Spirit (knocked
  out / smoke), which would have crashed the rival and hero shots.
- 🎥 **`createCameraSubjects`** turns `arenaFrame` into "what just happened". Moves are hex
  changes: 900 ms, and further steps extend the same move so the side holds. Effects are
  presence **edges**: a laser can stand for turns, so only its arrival is news, and nothing
  on the first frame. Battles need both fighters visible.
- 🔌 **`arenaRenderer.js`**: the director is asked only when `sonicCamera.update` returns
  false (**the Sonic shot outranks it**). The player's hands are **OrbitControls' own
  `start`/`end`**. `keepGameplayClicks` only forwards a left press once it's a 6 px drag, so
  hex clicks can't steal the camera, and wheel/pinch/right-drag count. Toolbar
  view/zoom buttons `userNudge`; the mount-time `frameView('arena')` does not. There is no
  `controls.update()` on a driven frame. Distances stretch by `fit()` like `view()`. Reduced
  motion keeps drawing while it moves. `arenaVisuals` now exports `pointXY` (one SVG→world
  mapping, not two).
- ☰ **Auto camera** toggle (after Lite FX), `localStorage['rlsw.autoCamera']`, default on.
  Turning it back on builds a fresh director that starts from the current pose.
- 🏷️ **The badge moved.** On the page it sat top-right of the stage; in the match that corner
  belongs to the HUD, so it lives at the left of the camera toolbar. Same text, dot colours
  and countdown bar. Hidden when off or during a Sonic shot. The toolbar help line gained
  *"· move it to take over"*. A longer version wrapped to two lines and was cut.

### 🎓 Found by running the real thing
- 🐛 **The renderer's `dt` is capped at 50 ms, and feeding it to the director made the
  camera crawl on a slow machine.** At ~4 fps in headless Chromium the idle shot never
  arrived. The director has its own 100 ms cap, so it now gets `wallDt`. A §3 assertion
  pins it.
- ⚠️ **OrbitControls damping is per FRAME.** At 4 fps the player's own glide takes seconds to
  settle, which made "the director isn't moving it" look false. The real-arena check now
  drags purely sideways, so the camera's height must stay frozen while the player has it,
  and it proves the height does move in auto.

### 🧪 Evidence (cloud, full copy of the tree, real `node_modules`)
- `test:cameradirector` **74** · 9 mutants on the shipped files all caught (plus the preview's 10).
- `check:bundle` **0 warnings** · `test:arch` ✅ · `arena` `sonicfx` `headdial` 67 `dialtick`
  `render` `client` `journey` `battlejourney` `replayjourney` `sonicjourney` `crowdbubble`
  `fametrack` ✅. Logs are identical to before the change on arena/sonicfx/journey/sonicjourney.
- ESLint on every touched file: no new messages (the monolith's counts unchanged).
- 🔴 `bushidoui`, `shukuchiui` red **before and after** in the cloud (env-only, as in earlier
  handoffs). `engine`/`eval`/`transition`/`eleven`/`b0` not re-run (known reds, untouched).
- **Real arena in headless Chromium** (real `mountArena`, real GLB, swiftshader), 17/17:
  auto after mount, drifting idle, through a move and battle, click keeps auto, drag →
  manual + countdown, camera untouched while held, back in ~6.6 s, resume → auto, wheel
  takes over, switch off/on. **Real `BoardViewport` mounted in React**: badge reads
  *🎥 Auto camera* → *✋ Yours · auto in 5.6 s* after ⌗ Top → hidden when off → back.
- ⛔ **Device shell down all session — nothing ran on Alex's machine.** `lint:baseline`
  needs `server/`, which wasn't staged.

### ⬅️ NEXT
Alex plays a match in 3D and tells us how it feels. Then republish the Systems Map.

## 24-crowdfix. First run on Alex's machine, three finder bugs fixed — 2026-09-17

Alex picked this over the other two open P1s. The device shell came back, so this is
the **first time any of the crowd work ran on the real tree**.

### ✅ What changed
- ⭐ **DISCORD BREAKS A FAN SHAPE** (Alex ruled it: *"Discord breaks it"*). This builds
  the fans half of `STATE_OF_PLAY.md` §4 *"DISCORD NOTES ARE INERT"*. `spiritStyle.js` blanks
  out-of-palette notes before any gesture reads the line. Every reader now takes the
  palette: payout, bot `styleGain`, finder bound, crowd coach. They share one new
  helper, `notes.js` → `paletteScaleFor`. 🪦 Superseded: the Ronin's *"free
  same-letter inflection"* (`C D# D E` was a shred).
- 🐛 **`contourRun(…, trailing)` reads the run OPEN AT THE END** (it read the START).
- 🐛 **The red/blue carrot needs a clean final for BOTH colours** (`melodyPayoutFor`
  bound the in-scale test to Drive only).
- 🐛 **`test:journey` was red on the real machine too, and the fault was in the suite.** It counted
  `[data-immersive-stack]`, which the pocket dials also carry (the note-flight landing
  target). It now counts panels (`="true"`) and dials separately.
- 🧹 The finder's own lint (CrowdBubble/crowdCoach/crowdFinderClient/crowdBubbleCheck).
- 📝 `.scratch/crowd-coach-playtest.md`: Alex's 10-minute checklist.
- 📌 Bug 5 (glow mostly one colour) is the preview's *Glow source* lever at its
  default, not a defect. It's on the checklist.

### 🧪 Evidence — Alex's machine
- Tests: `score` **135** · `melody` **124** · 7 mutants across the three fixes, all caught · `playfinder` 821, `crowdcoach`
  3,204, `crowdbubble` 116, `winconditions` 87, `journey` ✅ `battlejourney` ✅
  `arena` ✅, `arch` ✅, `check:bundle` **0 warnings**. All 46 suites ran.
- 🔴 Still red, unchanged: `engine`, `eval`, `transition`, `eleven`, `b0` (the
  pre-barrage assertions, see 18-coreloop).
- 🔴 `lint:baseline` still up in 6 categories, all from files outside this
  work: `only-export-components` 33>30, `no-undef` 7>4 (check files'
  `process`), `parse` 8>7, `set-state-in-effect` 13>12, `exhaustive-deps` 11>9,
  `no-unused-vars` 202>201. `.scratch/lintByFile.mjs` lists them by file.
- ⚠️ **Fixture moves.** The searcher chases different notes now.
  `winConditionsCheck` §6 control seed 3→**2** (seed 3 won on 23). Seeds 100–159
  turn-caps: **7/60** with every fix; 11 with only contour + carrot; 3 on 09-16. Balance is
  deferred, so this is recorded and not tuned (`.scratch/legendStalemateProbe.mjs`).
- ⚠️ **Device VM:** Windows `node_modules` → esbuild needs
  `ESBUILD_BINARY_PATH` pointing at a linux-x64 build under `$HOME`. Background jobs
  die when the shell exits, so run suites in foreground chunks.

### ⬅️ NEXT
Alex plays the checklist. Then promote the inbox entry into a design doc.

## 23-crowdport. The crowd is in the game — 2026-09-16

⭐ **Alex's dial-in arrived: 6 of 33 levers moved** — radius 8→12, chips 24→22,
anchor peek→**stand**, wait 350→**950 ms**, gap 250→**1500 ms**, glow 1200→1500 ms.
Everything else ships at the preview's defaults, and `CROWD_BUBBLE_CHANGED` records
which is which.

### ✅ What shipped
- `ui/crowdCoach.js` → `CROWD_BUBBLE`, `CROWD_BUBBLE_CHANGED`, `crowdBubbleFrame`
  (pure clock), `crowdStockMarks`.
- `ui/CrowdBubble.jsx` → `useCrowdCoach`, `CrowdBubbleCard`, `CrowdBubble`, `crowdCss`.
- `ui/crowdFinderClient.js` + `engine/policies/playFinder.worker.js` — the finder
  in a Worker; no Worker / a Worker that fails to load → the same function inline.
- Client (`rlsw-simulator-v3_8_1.jsx`): `crowdCoachOn` gate (beginner · human ·
  can act · not confirmed · chord or melody step), unconditional hooks, the bubble
  (melody step, not over a Pickles tip), `data-coach` marks on both stock grids,
  `data-crowd-speaker` on the acting Spirit's front-row fan.
- 📏 `test:crowdbubble` **116**, in `test:all`. Mutation ×4, all caught.

### 🧪 Evidence (cloud, staged copies)
- `check:bundle`-equivalent (missing media stubbed): **zero warnings**.
  `test:client` ✅ (60 .jsx). `test:render` ✅ 10/10. `test:arch` §1 + §3 ✅
  (§2 only names suites that were not staged).
- `.scratch/probe/parity.mjs`: the SHIPPED component and the preview at Alex's
  dial-in, same hand, in Chromium — **zero computed-style differences, identical
  129×95 box**, bubble above and pointing at the speaker fan on a 3D-tilted SVG,
  sequence 950 ms → bubble → ~1.5 s gap → ending bubble, stock pulse on the next
  note.
- A Vite build of the worker client: Vite emits `playFinder.worker-*.js`, and in
  Chromium the answer came back **through the worker**.
- ⚠️ `test:journey` fails identically BEFORE and after the change in the cloud
  (`3D chord phase keeps both board stack panels` 4 ≠ 2 — jsdom/env), so it proves
  nothing here either way.

### 🎓 Finding
⭐ **A NOTEHEX IS MOSTLY GLOW.** Its hexagon is 68/120 of its box, while the
preview's hand-drawn chip filled 94%. Ported literally at Alex's 22 px, every chip
was a 12 px hex with an unreadable letter — and every number in the suite matched.
Only rendering the port beside the preview showed it. `chipDrawSize` draws a 36 px
NoteHex inside the dialled 22 px box: same row width, same chip.

### ⛔ Not done
- **Not seen in a real match.** Device shell down. Run `test:all`, `check:bundle`,
  `lint:baseline`, then **play a beginner turn in 2D and 3D**: does the stand sit on
  screen in the Arena camera, and does the bubble clear the head dials?
- ARCH/STATE/SEQUENCING/inbox/map updated; not promoted to a design doc until the
  playtest says it works.

## 22-bubbles. The crowd found its voice — and the first draft lied about the notes — 2026-09-16

⭐ **Step 2 of the beginner finder.** Alex's three calls, asked before building:
**own crowd only** (no heckling) · **the chord hint is a glow**, not Pickles ·
**the crowd picks** what it asks for (no goal menu).

### ✅ What shipped
- 🎤 **`ui/crowdCoach.js`** — `crowdAsks` (melody-step bubbles: the fans line
  first, then its own ending) and `chordGlow` (red/blue stock slots). Words are
  data (`CROWD_VOICES`, hype/plain). Chooses words and colours only.
- `findBestPlays(…, { goals })` — the melody step asks for `fans`+`db` only,
  skipping the two joint stack searches (the dear half).
- 📏 **`test:crowdcoach` 3,204**, in `test:all`; `test:playfinder` **821**.
  Mutation ×5, 5 caught (one only after a new assertion — see finding 2).
- 🎛️ **`.scratch/fan-bubble-preview.html`** — generated by
  `node .scratch/fanBubbleBuild.mjs` from a template, bundling the REAL finder and
  wording (36 KB) into a Web Worker. 33 levers (words, look, anchor, timing, stock
  highlight, chord glow, reduced motion), 7 preset states, Today-vs-new, "Obey the
  crowd", localStorage from `render()`, copy dial-in with ★ changed-vs-default.
  Verified in headless Chromium: no page errors, reload restores levers.

### 🎓 Findings
⭐ **1. A BUBBLE IS ONE INSTRUCTION.** The first draft shouted the gesture the line
completes *somewhere* over chips showing the next three notes — *"Hit B♭, SLAM back
to A♭!"* over **C E♭ F**. Every suite would have passed. Each bubble now carries a
window ending where its gesture lands, and a gesture too far away gets a lead-in.

⭐ **2. Two lines, two endings.** The Db ending was first taken from the best-Db line
while the fans bubble walked a different one. Now the ending is the fans line's own
by default (`ending` lever keeps the other). The mutation that reverted it SURVIVED
the first suite — the tests had only hands where both lines ended the same.

🚩 **3. Drive and Sustain want the same notes.** On most hands both plays pick the
identical three, so a Drive+Sustain glow shows one colour. The preview has a
"lower dial's play" option. ⁉️ Alex's call.

🚩 **4. THE STYLE DETECTOR PAYS FOR OUT-OF-KEY SHAPES.** ✅ *Fixed 2026-09-17 — discord breaks a shape (24-crowdfix).* `spiritStyle.js`'s
letter contours never check the palette, so D♭ B♭ G♭ is a paid Ronin skip in C.
Consistent with today's code, contrary to *"discord notes are inert — no fans"*
(decided 2026-09-09, not built). The crowd will coach it until that lands.

⚠️ **5. THE ARENA DRAWS NO CROWD.** The grandstand is the 2D board's SVG. So the
bubble's anchor is a lever: a fan peeking over the melody track (needs nothing),
a stand (needs [P2] 3D fans), or the pocket's FANS number.

### ⛔ Not run
Device shell still down — cloud copies only. Run `test:playfinder`,
`test:crowdcoach`, `test:arch`, `test:all`, `lint:baseline` on Alex's machine.

### ⬅️ NEXT
**Alex dials in the preview and pastes the block back.** Then step 3, the port:
bubbles over the arena in the melody step, glow in the chord step, beginner mode
only, the finder in a worker (0.2–1.3 s a hand is too slow for the render path).

## 21-finder. The beginner finder's brain — and the brute force found three bugs that were not in it — 2026-09-16

⭐ **ALEX picked IDEAS_INBOX [P1] "Beginner chord finder"**, and chose how it
reaches the player: ***the fans say what melody they want in speech bubbles.***
Three steps — (1) the headless brain, (2) a `.scratch` bubble preview for his
dial-in, (3) the port. **This session built step 1 only.** Also captured: [P2]
*3D fan design*, parked behind the bubbles on purpose (they only need the seat
position, so they survive the swap).

### ✅ What shipped

- 🎯 **`engine/policies/playFinder.js`** — `findBestPlays(spiritId, noteSheet)`
  → for each of **Drive · Sustain · Db · fans**, the whole build: which notes to
  which stack (budget, found seats, no duplicate pitch classes, which note leads
  an empty stack) AND the melody line in order, with concrete stock indices.
  Respects a line already on the track, staggered slots, Mojo Drain, a confirmed
  turn. Ties go to spending fewer notes (unused stock carries over).
- ⭐ **It never scores on its own.** `spiritChord`, `melodyPayoutFor`,
  `stackCapFor` — the commit's own readers. Its only local arithmetic is
  branch-and-bound pruning.
- 📏 **`test:playfinder` 819**, wired into `test:all`: every play committed
  through the REAL `commitMelodyEconomy` and compared; **brute force with no
  pruning** on 48 seeded small hands (300 passed with `PLAYFINDER_BRUTE_SEEDS`);
  the rules; the bounds' gesture list; full hands proven inside the budget.
  Mutation-tested ×10 — 9 caught, 1 equivalent (pruning-only).
- 📏 180 fresh full hands × 4 goals: **every answer proven**; all four goals
  0.2–0.35 s per hand on average, worst 1.7 s.

### ⚠️ One definition, chosen for cost — say it if it matters

**Db and fans are LINE-FIRST**: the best line over the whole hand, then the best
stacks from what it leaves. Searched jointly, every stack plan re-proved the
melody and a hand cost seconds. What it gives up: between two lines that pay the
same, it keeps the shorter, not the one whose leftovers voice the better chord.
Drive and Sustain ARE searched jointly.

### 🎓 THE FINDINGS — the brute force earned its keep

⭐ **1. 🐛 THE STYLE COACH READS THE WRONG END OF THE LINE.** ✅ *Fixed 2026-09-17 (24-crowdfix).* `spiritStyle.js`
`contourRun(line, span, trailing = true)` reverses the notes and then returns the
last run it saw — which is the run at the **START** of the original line. So for
the Ronin, `styleCoachFor` progress / `notesNeeded`, `styleProgress` and the
bot's `styleGain` all measure the opening of the line, not where the player is
about to add a note. `D C A` reports shred ½ done and skip not started; it is the
reverse. ⛔ **Not fixed** — it is live in the coach UI and in the bot, and fixing
it changes bot play. The finder's bound was trusting it and pruned the winning
line (seed 120); the bound now reads the open run itself.

⭐ **2. 🚩 AN EMPTY DRIVE STACK HITS HARDER THAN ANY CHORD.** `attackParams` (and
the client's copy) fall back to the Spirit's **sheet** stat when a stack is
empty — Ronin Drive **8**, Sustain 5 — but the chord table was rebased to 1–5.
So committing your first Drive note drops the Sonic from 8 dice to 1, and the
pocket dial shows 1 the whole time. **Two answers to "what is my Drive?"** The
finder follows the dial; following combat would coach "never build a chord".
⁉️ Alex's call whether the fallback should be rebased or removed — it reads as a
rebase that missed a line.

⭐ **3. 🚩 A DISCORD ENDING STILL PAYS THE SUSTAIN CARROT.** ✅ *Fixed 2026-09-17 (24-crowdfix).* `melodyPayoutFor`:
`scale.includes(last) && samePitch(last, driveRoot) ? 'drive' : samePitch(last,
sustainRoot) ? 'sustain' : null` — the in-scale test binds to the Drive branch
only. A line ending on an out-of-mode note that matches the Sustain root gets
+1 temp Sustain; the same note as the Drive root gets nothing. Contradicts
*"DISCORD NOTES ARE INERT"* (`STATE_OF_PLAY.md` §4). Looks like a precedence
slip. ⛔ Not fixed; the finder reproduces whatever the payout does.

### ⛔ What was NOT run

Device shell down all session — everything ran in the cloud against staged
copies. `test:playfinder` passed there; `test:arch` §1 and §3 passed on the
partial tree (§2 cannot, most files absent). **Run `test:playfinder`, `test:arch`,
`test:all` and `lint:baseline` on Alex's machine.** Nothing existing was edited
except `package.json`, `ARCHITECTURE.md` and the docs.

### ⬅️ NEXT

**Step 2 — the bubble preview** in `.scratch/`: bubble look and timing, one at a
time, only during the melody step, beginner-only, the clash with the head dials
from the wide camera, and what a bubble SAYS for each goal (*"Run it up four!"*,
*"End on G!"*). The chord half needs its own voice (glow or Pickles) — Alex has
not chosen. ⁉️ Also open: own crowd only, or can rivals' fans heckle?

## 20-lever. The mode flipped, and one constant had been quietly lying for weeks — 2026-09-15

⭐ **ALEX: *"I'd really like for the game to be turn based instead of FP race
based, with FP as a tracker to determine who is winning at the moment instead of
who is closest to the finish line."*** That is R1, and this session built §0's
lever — **all four steps in one pass, because they cannot be split.**

### ✅ What shipped

1. 🎸 **Battle of the Bands is the DEFAULT.** One normalising ternary in
   `state.js`. Every downstream reader tests `state.config.winCondition`, which
   is always explicitly set there, so the codebase has exactly one default.
   🏆 The race survives as `winCondition:'fame'` (§2.4, Alex's ruling).
2. 🎤 **Fans pay Fame again** — `FAN_CASUAL_WEIGHT` 0 → **0.12**, `FAN_MULT_CAP`
   3.0 → **5.0**.
3. 🎲 **The Sonic die ladder is DELETED** — `sonicDieSides` plus `peakCasuals`
   across **seven** sites (the brief said six).
4. ✨ **The pose ceiling rides the mode** — `POSE_FP_MAX_ROUNDS = Infinity`.

📏 `test:winconditions` **87** · `test:turnflow` **73** · `test:determinism` **20**
· `test:battleflow` **65** · `test:sonic` **75**. ⚠️ Run in an isolated container
against staged copies — `test:all`, `check:bundle` and `lint:baseline` still have
not run. `esbuild` parse of the monolith: exit 0, zero warnings.

### 🎓 THE FINDINGS, AND THERE ARE THREE

⭐ **1. A CONSTANT THAT SAYS IT "MATCHES" ANOTHER DOES NOT FOLLOW IT.**
`POSE_FP_MAX`'s own comment read *"Matches `FAME_PER_TURN_CAP`"*. That stopped
being true the day `FAME_PER_TURN_CAP_ROUNDS` was added: `RIFF_FP_TURN_CAP` was
taught to follow the mode, the pose ceiling never was. So in a round-limited
match every other Fame source ran uncapped into the hundreds while a maxed pose
stayed pinned at **4** — the Limelight economy quietly worthless in the mode that
was about to become the default. 🎯 **Nothing errored and no suite went red**,
because the comment described a relationship the code had never actually had.
**It copied the number once, and the copy rotted.**

⭐ **2. THE COMMENT WAS RIGHT AND THE CODE WAS WRONG, FOR TWO WEEKS.**
`gameConstants.js`'s 2026-09-02 block *derives* 0.12 and 5.0 in full, complete
with the arithmetic (`1 + 0.40×6 + 0.12×14 = 5.08`), and the constants
underneath it read `0` and `3.0` anyway — because the per-turn cap made the
correct numbers unusable. 🎯 **The fix was never the weight; it was the
constraint.** ⚠️ **If you find yourself zeroing a value whose own comment
explains why it should not be zero, change the constraint instead.**
📌 Proof it was really broken: restoring the weight **turned an already-red
`evalCheck` assertion green** — *"more fans → higher multiplier term"* had been
failing because fans did nothing.

⭐ **3. A FLIPPED DEFAULT TURNS EVERY OMITTED ARGUMENT INTO A BEHAVIOUR CHANGE.**
`battleFlowCheck`'s Fame-economy fixture named no mode, so it had silently
stopped testing the Fame economy and started asserting against Infinity.
`winConditionsCheck`'s Legend Run **control** — the row commented *"if this row
ever changes, the mode leaked"* — became the same match twice. Both are now
pinned to `'fame'` explicitly. 🎯 **The suites caught all of it, which is the
system working**; the danger was never the failures, it was the fixtures that
would have kept passing while measuring nothing.

### 🚨 The trap the brief got backwards

Phase 1 item 2 said *"remove `FAME_PER_TURN_CAP`"* and warned two dependent caps
would go silently uncapped. The real shape: `RIFF_FP_TURN_CAP` already looked
after itself, `POSE_FP_MAX` was already broken before anyone touched anything,
and `FAME_PER_TURN_CAP` **must stay** because the race survives and the cap is
that mode's catch-up brake. Trap 3 is corrected in place.

### ⛔ What is NOT done, and one of it is user-visible

- 🚨 **THE MATCH IS ROUND-LIMITED WITH NOTHING ON SCREEN SAYING SO.** No
  rounds-remaining readout, no lobby toggle. ⚠️ **And `ui/FameRace.jsx` still
  draws a finish line at `fameToWin`, which is Infinity in the default mode** —
  the HUD is now actively lying. `FAME_TRACK_REDESIGN.md` is the job, and
  `.scratch/fame-track-preview.html` already exists from 2026-09-02.
- ⚠️ **R8 is unsatisfied.** The charge-zone `+2` still raises the **roof**.
  Phase 2 item 2, flagged at the site.
- 🐛 **`evalCheck` and `selftest` were ALREADY RED before this pass** and still
  are — `evalCheck` at *"a charge alone does not carry anyone else's rig"*,
  `selftest` at *"keeps the highest die"*. 📌 Verified against a pristine tree,
  and `evalCheck`'s failure point MOVED LATER because this pass fixed one of its
  assertions. **Neither is caused by this work.**
- 🗺️ **The Systems Map is now behind by THREE sessions.**

## 19-cheapest. Three cheap things, and one of them was a rule that never existed — 2026-09-15

⭐ **THE FIRST BUILDING SESSION AFTER `18-coreloop`.** Alex asked for the idea box
and the core-loop rulings **cheapest first**, and chose the zero-risk trio:
Phase 0's Face button, the `endingDb` naming job, and the dead
`pendingSonicAttacks` counter. ⛔ **Nothing from Phases 1–6 was built.**

⚠️ **NO REPO SUITE RAN.** The 2026-09-08 Windows update still stops the Cowork
workspace mounting the repo, so `test:all`, `check:bundle`, `lint:baseline` and
`bench:bot` **did not run**. Files were staged out, edited and written back. What
DID run: two `.scratch/` probes in an isolated container, and an `esbuild` parse
of the monolith (**exit 0, zero warnings**). 📌 **Run the suites in Claude Code
before trusting any count.**

### What shipped

1. 🎨 **The Face button.** Inline override deleted; Face wears `.btn`/`.btn.on`
   like every other rail button. 🎯 **THE FINDING THAT MATTERED:** the brief
   priced this as a **contrast** defect (2.15:1 vs 12.04:1) — but
   `.arail .btn` builds its wash, bloom and `inset 2px 0 0` left spine out of
   **`currentColor`**, so the dim colour **put the lamp out** rather than greying
   the label. ⚠️ A pure WCAG reading would have under-sold it, and a shade picked
   to clear 4.5:1 would have left the button dimmer than the rail it sits in.
   **When a design system keys off `currentColor`, a colour override is a
   component override.** ⚠️ Cost, taken knowingly: the cyan `#44ccff` armed state
   is gone with it; one prop restores it and the site says how.
2. 🎼 **`ENDING_DB` is named and exported** (`music/melodyPayout.js`), carrying
   §14.9.3's two reasons, §14.9.5's cost and §14.9.4's unsettled tonic.
   `PROJECTILE_COMBAT_DESIGN.md` §14.9.5 now points AT the comment and is marked
   historical, so the rationale has **one** live home (§B9). Verified inert:
   **28,807 assertions, 0 failures.**
3. 🔊 **`pendingSonicAttacks` is reset** at the defender's own turn end.

### 🎓 The one worth keeping

⭐ **A COUNTER NOBODY READS IS A RULE THAT DOES NOT EXIST — AND IT LOOKS EXACTLY
LIKE ONE THAT DOES.** `pendingSonicAttacks` was incremented at one site, read at
none, reset at none. Its comment described §3.5.1's turn-start shield bill in the
present tense, `PROJECTILE_COMBAT_DESIGN.md` §3.5.5 argued *from* that bill that
*"defence stops being free"* — and **the bill was never charged.** An entire
design argument rested on a line of code that only incremented an integer.

🎯 **This is §B's "a suite nobody runs" in a second costume**, and the costume is
the point: the first one was a *test* that asserted nothing, this one is a
*counter* that fed nothing. Both passed every reading a human gave them, because
both were syntactically alive. 📌 **The cheap defence is the same in both cases —
grep for the READ, not the write.** A write with no read is the tell.

⭐ **AND THE FIX ANSWERED A SECOND QUESTION FOR FREE.** Clearing at the
*defender's own* turn end — beside the slime decay, for the reason `turn.js`
already documents about spirit-turns vs turns — makes the window "attacks since I
last acted", which is one lap of rivals at **any player count**. That is §3.5.1's
bill *and* R12's diminishing-FP window, **including Alex's actual worry: three
different attackers milking one low-Sustain player, which a per-attacker counter
would have missed entirely.** 🎯 The boundary that was correct for the old rule
turned out to be correct for the new one, because both are really asking *"what
happened to me while I could not act?"*

### ⁉️ What Alex ruled in passing

⭐ **The Fame race SURVIVES — rounds becomes the default, the race stays
selectable** (brief §2.4, previously open). ⚠️ **It is not a free answer:**
keeping the race means `fpPerLife` and friends must keep working at
hundreds-scale Fame, which **converts the brief's trap 8 from a consequence into
a job.**

### ⛔ What the next session must not assume

- **No suite has seen any of this.** `test:render`, `test:turnflow`,
  `test:determinism` and `check:bundle` are all unverified against it.
- The two probes are **`.scratch/` evidence, not suites** — deliberately, per
  `CLAUDE.md`. 🎯 `sonicTallyCheck.mjs`'s assertions belong in **`test:barrage`**
  when Phase 3 writes it, beside R12, the consumer they are really about.
- 🗺️ **The Systems Map has NOT been republished** — and it is now behind by two
  sessions, `18-coreloop`'s changes included.

## 18-coreloop. The loop got decided, and four changes turned out to be one — 2026-09-15

⚠️ **A DESIGN SESSION. NOTHING WAS BUILT, NO SUITE WAS RUN, NO CODE MOVED.**
Documents changed and a build brief was written. Do not read any number below as
a test result — they are simulation output, not assertions.

⭐ **THE OUTPUT IS `CORE_LOOP_REWORK_BRIEF.md`** — 22 rulings, 8 open questions,
6 phases. 🎯 Point the next session there.

### 🎓 What the session actually found

⭐ **FOUR CHANGES ALEX RAISED SEPARATELY ARE ONE LEVER.** Round-limited play →
the per-turn Fame cap has no job → a heavy crowd multiplier becomes safe →
casuals go back to Fame → the Sonic die ladder has nothing left to pay for.
⚠️ **In any other order, each step looks like it is breaking something.**

🚨 **AND THE REPO HALF-AGREED ALREADY.** `FAN_CASUAL_WEIGHT = 0` carries the
comment *"casuals now grow permanent Sonic die size"* — sitting directly beneath
a 2026-09-02 block, **Alex's own call**, that derived the correct weights
(Diehard 0.40, Casual 0.12, cap 5.0) and warned *"THIS PUSHES HARD ON
`FAME_PER_TURN_CAP`, WHICH IS THE POINT OF FRICTION."* The weights were walked
back to fund the die ladder. **Removing the cap removes the reason they were.**

✅ **ROUND-LIMITED PLAY IS BUILT AND SWITCHED OFF.** `WIN_CONDITIONS_DESIGN.md`
§9 item 1 is CLOSED — `ROUND_LIMIT_DEFAULT = 10`, `FAME_PER_TURN_CAP_ROUNDS =
Infinity`, headless, `test:winconditions` green. Missing: the lobby toggle, the
HUD readout, and the default. 📌 Alex believed it unbuilt; it is unswitched.

🐛 **`pendingSonicAttacks` IS WRITTEN AND NEVER READ.** One site in the repo —
the increment at `combat.js:276`. Nothing consumes it, nothing resets it. Two
consequences: §3.5.1's turn-start shield bill **is a doc-only rule and does not
exist in the game**, so every argument in §3.5.5 is unpaid-for; and the counter is
a lifetime tally wearing a per-round name, so the first thing to read it is wrong.
🎯 It is also exactly the counter Alex's new diminishing-FP rule needs.

🐛 **THE FACE BUTTON IS A REAL DEFECT.** Alex reported it as looking
unselectable. `rlsw-simulator-v3_8_1.jsx:12785` hardcodes idle `#1a5066` on
`#0a1020` — **2.15:1** against every other rail button's **12.04:1**, at 10px
where WCAG wants 4.5:1. ⚠️ And `.btn:disabled` is `opacity:.3`, landing in the
same visual place — **so it is styled like the one state it never renders in**,
since Face only appears when `moveStepsLeft > 0`.

### ⭐ The rulings, in one line each

Round-limited, no FP caps ever, Fame in the hundreds, fans multiply Fame · the fan
die ladder is cut · the marquee pays a temporary card (d8/d10/d12 by question
difficulty) · charge zones raise the floor only, never the roof · the Swing
converts contact into damage at the cost of committing to the brawl · **the Riff
Off is not chosen but TRIGGERED by mutual facing in Sonic range**, 1 AP and no
Drive note, running off the last committed melody · **and every special ability
is parked until the loop is solid.**

### 🎯 Why the Riff Off ruling matters more than it looks

⭐ **Facing becomes the mode switch.** Square up and your Sonic is a duel; attack
from an angle and it is a barrage. 🎯 **That closes a hole the barrage opened** —
the rolled shield and the duel both answered *"the defender should get to do
something"* and overlapped. Under the ruling they do not: face them and you answer
with melody, turn away and you answer with your Sustain roll. **One choice, made
in advance, about which kind of fight you are in.** ⚠️ And it relocates combat
choice into the movement pillar — to fire a plain Sonic at someone facing you,
you must move.

### ⚠️ What was NOT decided, and must not be assumed

What produces the Sustain pool (**the most sensitive number in the rework** — one
die of defence outweighs the whole damage divisor) · whether a note-break triggers
on *emptied* or *overwhelmed* · the marquee card's wrong-answer cost, its
add-vs-upgrade shape, and its duration · whether the Fame-race mode survives at
all · the Swing divisor and its re-scaled whiff · whether a duel spends the
melody. 🚨 **All eight are in the brief's §2, labelled as recommendations rather
than rulings. Keep that label.**


## 17-riffoff. We went looking for the Swing and found the duel's currency — 2026-09-14

⚠️ **A DESIGN SESSION. NOTHING WAS BUILT, NO SUITE WAS RUN, AND NO CODE MOVED.**
Four documents changed and that is the whole output. Do not read any count below
as a test result.

### 🎬 How it went sideways, and why that was worth it

Alex opened on the **Sonic**: replace the Sustain threshold with **rolled Sustain
dice that become shield HP**, worn down by Drive projectiles until it busts — and
then, *"where does Swing earn its place?"* with the **Smack-down** image (Drive
energy driven into the instrument for an all-out blow) and *"I think it still earns
its place as the big Vibe hitter."*

🚩 **Both halves collided with §5.3**, which had closed *"the two attacks compete"*
by **separating their targets** — Sonic attacks the Spirit, Swing attacks the chord.
A Sonic that busts shields takes the Swing's exclusive; a Swing whose job is Vibe is
the reversal §5.3 explicitly recorded going the other way. ⚠️ **Either change alone
is arguable. Both together collapse the two attacks back into one system with two
animations.**

🪦 **The Sonic HP idea was set aside, not rejected** — filed in `IDEAS_INBOX.md`
with the two objections it must answer. ⛔ **And the Swing question was never
answered.** `PROJECTILE_COMBAT_DESIGN.md` §14.8 says so in those words, because a
question that merely stops being discussed reads exactly like one that was settled.

### 📊 The thing that unstuck it — Alex's own 2D grid

Alex recalled the original 2D design: **three attack modes rated across five axes**
(Sustain drain · knockback · Fame · Vibe · own Drive drain), and asked whether the
foundation could survive. **It can, and it is now §13** — every cell re-read out of
the code rather than out of memory.

⭐ **His recall of the Swing row was five for five.** The Sonic row was four of five.
🚩 **The Riff-Off row was wrong on two axes, both in the same direction** — he had it
as the showy, low-violence option, and it is the most violent thing in the game:
the *same* `sonicKnockback` (not a lesser one), the *largest* Vibe number in the
rules, the largest Fame payout under a doubled cap — against one inherited note of
Drive. **Three peaks and one cost.** `battleFlow.js:748` had said so for months, in
a comment.

🎯 **The grid's real job is that this spec has been doing grid reasoning without a
grid.** §3.3's *"three jobs and no fourth"* is a budget written as a scold because
there was nothing to point at; §5.3's crisis and its fix are a grid operation; §4.1
is a column with one row in it. ⭐ **A sixth column — MISS COST — was added**, and it
is where §4.2's open risk question finally has somewhere to sit.

### 🎤 Where it landed: the duel is a BET, and it runs on the MELODY

Alex, following the grid down: *"would the riff off live off of Drive at all? Since
these are basically chords."*

⭐ **He was right, and the code already agreed.** `rlsw-simulator-v3_8_1.jsx:8442`
builds the attacker's riff from `committedMelody` — the *Rhythm Creation Device* —
and `riffSkill` keys the bot off the last commit's Performance Score. **Drive's only
involvement is the one note the Sonic already spent on the way in.**

🎸 **The argument underneath it is musical and it is the reason to trust it: a chord
is SIMULTANEOUS, a riff is SEQUENTIAL.** The Drive stack is a voicing — notes with
no order and no rhythm. Only the melody line is riff-shaped.

⭐ **Which produces the result worth keeping.** `DRIVE_SUSTAIN_SPLIT_DESIGN.md` §1's
three commit destinations map one-to-one onto the three modes: **Drive** powers the
two attacks, **Sustain** defends against both, **the Melody Line** powers the duel.
🎯 **That is why the duel has no shield** — not a preference, a structure. It is fed
by the destination that *clears every turn* rather than the two that persist. **It
was never in the same economy.**

### 🎓 And `riff/melodyRiff.js` had written the thesis already

> *"the melody you build is your combat… The attacker rehearsed this riff all turn —
> the defender sight-reads it. Complexity is a weapon paid for in preparation."*

⚠️ **But the shipped lever and Alex's proposed one run on different axes**, and the
session's most useful correction was refusing to conflate them: shipped complexity
moves **how hard the chart is**; proposed cleanliness moves **what a landed note is
worth**. §14.3 keeps them in separate rows on purpose.

### 💡 The risk answer, made of something already counted

Alex: *"Could it be retrospective? A melody line that doesn't get committed well
could become a risk of not producing 'strong' notes for the riff off."*

⭐ **Discord notes become weak projectiles that get swatted in the collision.** 🎯
`STATE_OF_PLAY.md` §4's *"DISCORD NOTES ARE INERT"* (decided 2026-09-09, unbuilt)
gave them two uses, both consolation prizes; **this is a third and a real one, and
it costs nothing to build because the game already counts them.** Play a sloppy line
on Tuesday, lose the duel on Thursday.

⚠️ **§14.4 carries the rider that will otherwise become a bug report**: *inert* means
a discord note does not **pay**, not that it does not **exist**. 📌 And the obvious
input is the wrong one — `perfScore` is **identity-only** by an explicit warning at
`melodyCommit.js:294`, even though it is what `riffSkill` already reads.

### ⭐ THE ONE RULING

**The first caller keeps their advantage.** In Alex's alternating structure — A
calls with their line, B answers, then B calls with theirs — the caller rehearsed
and the answerer sight-reads, so whoever opens has an edge and the loser is nearly
always answering. Alex: *"that is also their positioning that landed them with the
attack that gets them a free go. I think that is fine as it is."*

🎯 **It is paid for in board position.** 🪦 The ruling **closes** all three
compensations that were offered: a warm-up opening exchange, a defender ante as a
fairness fix, and end-only-on-a-completed-answer.

### 🚩 Two code findings, reported rather than edited around

1. ⚠️ **The Riff-Off's Vibe runs on a table the codebase declared superseded.**
   `combat.js:18` — *"LEGACY damage table… New code should use thrashDamage /
   sonicDamage."* Swing and Sonic were both migrated; **the riff-off never was**, so
   it is the only attack still paying out of `marginToDamage` (cap 5). Drift, not a
   design choice. §13.5.
2. ⚠️ **A comment describes a clear that could not be found.**
   `melodyCommit.js:325`: *"the riff-off reads these; turn start clears them"* — and
   **no code clearing `committedMelody`** turned up in the engine or the client.
   📌 It matters: §14.5's alternating duel needs the defender's line to still be
   there. ⛔ **Not fixed, not assumed** — `turn.js` / `turnFlow.js` were not read
   this session. **Verify before building on it.**

### 🚨 THE BLOCKER, AND IT IS NOT A BALANCE ITEM

`riffOff.js:389` declares it against itself: `riffSkill` **has no tempo term**, so a
Spirit plays Round 2 exactly as well as Round 1 on a chart that got 1.7× faster —
`HARNESS_GAPS.riffRound2Speed`. Today that is a bench inconvenience. ⛔ **Under an
escalating go-until-somebody-fails duel it is a bot immune to the difficulty ramp
the mode is built on, compounding every exchange.**

🎯 **§B10 does not cover this.** It does not make the bot *strong*; it makes the
mode's central mechanic *not apply* to half the table — impossible rather than
weak, which is the stated exception. **Decide it before building escalation.**

### 🪦 Rejected in the pass

- **Simultaneous two-sided performance with live collision** — `RIFF_RESULTS_SUBMITTED`
  submits a completed array *after* a performance; live mutual resolution is the
  exact seeded-RNG/desync cost §11 rejected the hidden bid over. It also discards
  `generateDefenderRiff`: play at once and there is no *call* to answer. 💡 **The
  free version is recorded** — keep call-and-response, render it on two tracks with
  their side playing back a *recording*. The projectiles still collide; no netcode moves.
- **The note pool as the duel's currency** — it feeds Drive, Sustain *and* melody,
  so spending it there **starves the system that feeds the duel.** Survives only as
  an ante candidate, and ⭐ the first-caller ruling removed the fairness case for one.

### ⬅️ NEXT

0. 🎼 **Name the ending constant and put Alex's two reasons on it** (§14.9.5). The
   cheapest high-value job here: it is about to price two systems and its rationale
   lives only in a design doc.
1. ⁉️ **What is actually wagered** (§14.6), and ⁉️ **what surviving collision weight
   does** (§14.9.2). The row still has no cost column: a melody is spent, paid and
   cleared before the duel begins. Two candidates recorded, neither decided.
2. 🚨 **§14.7's tempo gap**, before any escalation is built.
3. 📌 **Two cheap verifications**: does anything clear `committedMelody`; is the
   melody's Fame paid before `startRiffOff` reads the stash.
4. ⛔ **The Swing still has no answer**, and the question is now ten days old.

### 🎼 LATER THE SAME DAY — the strength model, and a rationale recovered

Alex, on what makes a note strong: *"I honestly like music for the subjectivity of
it, I'm not so strong in answering objectivity — ie. Theory."*

⭐ **The answer was to stop looking for a new judgement.** `melodyPayout.js` records
that the game already made this call — the subjective half (`excitement`,
`loyalty`, promotions, *"a mood model that decided whether you had been
entertaining and took fans away when it judged you dull"*) was **cut on purpose**
and stays pinned at 0: *"only the arithmetic returns."* 🎯 **And the game has
exactly ONE per-note judgement — `scale.includes(note)`. Everything else it
measures belongs to the LINE.** So: do not grade notes; **read the grade the line
already gave them.** §14.9's four tiers are dud 0 / plain 1 / strong 2 (inside the
craft run) / **+ the ending value for the hook**, stacking where they overlap — and
every input is arithmetic the commit already performs.

⭐ **The split that makes it work: hands decide IF a note fires, the melody decides
what it WEIGHS.** Flawless hands on a sloppy line throw featherweights; a beautiful
line played badly never leaves the amp. 🎯 **This is what finally closes the
objection that killed the Drive version** — a currency paying the entry fee to a
contest it has no say in.

### 🎓 AND THE REAL FIND WAS NOT A DESIGN

Asked why the fifth pays triple the tonic, Alex answered from memory — **and
neither reason existed in any file.** `endingDb` is a bare ternary with no comment
in `melodyPayout.js`, `melodyCommit.js` or `MELODY_IDENTITY_DESIGN.md`.

1. 🎸 *"Nothing is as strong for Rock as the 5th."*
2. ⭐ *"I also wanted to have the players change chords often, so that was another
   reason it was stronger than say the tonic."*

🚨 **Reason 2 makes that number a lever on the CHORD ECONOMY, not melody flavour**
— and it is unreconstructable. Reason 1 a stranger could guess; reason 2 was one
message from being gone. 🎓 **§B9 caught live rather than archaeologically:** the
decision had been made, and for months it read exactly like one that had not.

⛔ **It is still not in the code.** §14.9.5 says where it belongs — `endingDb` has
to become a **named constant** before it prices both the Db payout and the duel's
hook, because one number doing two jobs cannot be tuned apart. That is now
`STATE_OF_PLAY.md` §7 item 3, and it is the cheapest high-value job on the list.

### 🚩 One trap caught before it was built

Alex's shape was *"each bringing a score together to work out a strength
variable."* ⛔ **Summing them breaks on arithmetic already in the file:**
`craftFans` caps at **2**, `endingDb` at **3** — so a flawless eight-note run would
score less than four notes ending on the fifth, after a whole craft layer was built
to make the middle pay.

⭐ **The cause was reading the wrong number.** `craftRunFor` returns the run's
*length*; the cap is applied afterwards and its own comment says why —
**`CRAFT_FAN_CAP = 2` ⚠️ fans feed FAME.** It is a brake on the crowd economy and
has nothing to do with duels. 🎯 **So the duel reads the run LENGTH and the Fame
route keeps its cap** — one measurement, two consumers, each with its own ceiling.
The two halves then become **quantity and quality** rather than a total: the middle
decides how much you throw, the ending decides whether you finish them off.

🧊 **Alex: *"sounds like a satisfying answer — for now at least."*** Recorded as
**provisionally accepted**. The tonic's rise from 1 is ⁉️ **not settled** (*"2 times
or so, 1.5 even"*), and ⚠️ at 2 it becomes the same rung as the fourth.

### 📁 Changed

`PROJECTILE_COMBAT_DESIGN.md` (**§13, §14 and §14.9 new**, header block, §10's
deferred table, §14.4's pointer) · `STATE_OF_PLAY.md` (§4 five rulings + the
reopened Swing row, §7 items 3–4, renumbered) · `IDEAS_INBOX.md` (the Sonic HP
fork) · this file · the Systems Map.

### ⚠️ AND THIS FILE IS STACKING AGAIN — REPORTED, NOT FIXED

**§A now holds ten handoffs** (`17` down to `8-arena-fidelity`) against its own rule
that §A is ONE. 📌 `15-drawer`'s §C row still read **"LIVE — §A above"** while two
newer handoffs existed — **the exact B1 drift that already happened to
`8-arena-fidelity` in September** — and is corrected below. ⛔ **The archival pass
itself was NOT done**: moving nine handoffs out is a destructive change nobody asked
for this session. **It is worth an explicit half hour.**

---

## 16-ringbeam. The Sonic projectile, decided — 2026-09-13

Alex, on the sonic rework preview: *"Instead of 'chevrons' lets use rings that
build out into a beam-like shape. The rings should move more fluidly like the
waveform instead of the zig zag patterns."* Built, dialled in by him on the
page, and **signed off**: *"This was the best version by far."*

⭐ **THE PROJECTILE IS NOW A DECISION, not a proposal** — recorded at its own
address as `PROJECTILE_COMBAT_DESIGN.md` **§12.1c**. ⛔ **Still nothing in
`src/`.** The port is one pass and its brief is
`.scratch/sonic-rework/RING_BEAM_BRIEF.md`.

**What it is.** Hoops at fixed stations along the flight path ignite in turn and
then **inflate** as the wavefront pulls away, so a beam grows backwards out of the
head — tight nose, full body, tapering tail, necking into the impact. It undulates
instead of zigzagging: a sine plus a quiet harmonic on two perpendicular axes,
with the phase advancing on the clock, so the wave runs forward *through* the beam
rather than sitting frozen while the head slides along it.

🎯 **THE CADENCE HAD TO CHANGE WITH THE SHAPE, AND THAT IS THE WHOLE FINDING.** A
smooth wave running on a staccato flight curve reads as a *wobble* — the eye reads
the tick, not the flow. `sonicFlightCurve` gained a `smooth` flag that drops the
per-leg dash-and-ease and keeps the growing legs, so the shot still crosses the
arena early and crawls the approach. ⚠️ **Total flight time is unchanged**, so
`sonicVolleyDuration` reports the same number and §12.1b's pacing table, the
result scheduling and the per-die audio stagger all still hold.

**Three rebuilds it took, each now a comment at its own site** — and each is the
generic version of a mistake, not a quirk of this shot:

1. Rings oriented to the **path's** tangent leave every hoop facing the same way
   while their centres snake between them: a corkscrew spring, not a beam. They
   have to be square to the **displaced** curve, differenced either side.
2. A **fixed hairline** band turns the beam into a wireframe drawing of itself.
   Thickness has to be a fraction of the radius.
3. Twenty additive hoops at a single stroke's opacity and lightness **clip to
   white** before the bloom pass runs, and the volley loses its tint. A beam made
   of many marks runs at about a third of what one mark can afford.

⭐ **Alex's dial-in is in the code with a date and an owner on it**, as
`RING_TUNING` in `board/sonicZigzagVisuals.js`, applied on `strokeStyle:'rings'`
alone so the call site configures nothing. 📌 **Deliberately NOT folded into
`SONIC_TUNING`**: that block is the zigzag/chevron baseline that
`sonicZigzagCheck.mjs` asserts a tested curve against, and seven anonymous numbers
in a shared defaults block read as arbitrary and get tidied. The direction behind
them, which is the part worth keeping in prose: **thinner and sparser but longer**,
brighter filament, far bigger detonation, much slower approach. **Mass came out;
contrast went in.**

### 🧪 Evidence

`sonicZigzagCheck.mjs` passes **unmodified** against the ring build — the cadence,
power ramp, mitred banding, the camera hand-off at 1/2/5/11 dice and single-dispose
are all untouched by it. New `sonicRingCheck.mjs` covers the fluid cadence **at
RING_TUNING's own slow-motion value** rather than the library default (§B2), the
nose/body/tail beam profile, determinism under seeking and single-dispose.

⭐ **And one assertion is there specifically to stop a tidy-up reverting the
look**: it builds one ring volley with no tuning and one with `RING_TUNING`
explicitly and asserts the geometry is byte-identical. **Mutation-tested** — unhook
the overlay and it goes red naming that assertion.

⚠️ **Neither suite has run inside the repo, and `test:all` did not run.** The
Linux workspace on the machine would not start again this session (*"the isolated
Linux environment on this device failed to start"* — the same wall as `5-lane.E`),
so both checks ran against a file-by-file copy, with `three` installed
standalone. The preview itself was driven headless through Playwright at each
step — real render, console clean — which is how the three rebuilds above were
found, but it is not `check:bundle` and it is not `test:all`.

### ⚠️ ONE APPROVED VALUE HAS NOWHERE TO LAND

He took the contact push-in to **0.95**, the top of the slider. In the preview
that is the page's own camera. **`arenaRenderer.js`'s `stageSonicCamera` has no
push-in at all** — it frames a static box per phase and never tightens onto the
impact. The volley module exposes `getFocus()` for exactly this, and brief §4 has
the two lines, but until they are wired **the port delivers the beam and not the
shot**. 🎯 Filed loudly rather than as a footnote: §B11 is a step whose label said
there was nothing left to ask.

### ⬅️ NEXT

1. 🔊 **The port** — `.scratch/sonic-rework/RING_BEAM_BRIEF.md`, one pass. It
   carries the whole sonic rework, not just the beam: the four earlier changes
   (readable dice, the ROLL gate, the camera fix, `diceHits`) have been sitting
   drafted and unapplied since 2026-09-13 morning.
2. 🎥 **The push-in**, above. Same pass if there is room; named in the handoff if
   not.
3. The rest of the board is unchanged and lives in `STATE_OF_PLAY.md` §7.

📌 **Systems Map:** not republished — nothing in the roster, the rules, the
bottleneck or the open decisions moved. This is a presentation treatment that is
still preview-only.

---

## 15-drawer. The last 2D panel in the arena — 2026-09-12

Alex: *"it seems like the stack commit is still using old windows — I'd like
everything to be in sync with the styling and windows"*, and then, exactly right:
*"it seems like its already built out in scratch but not imported to the game yet."*
It was. `.scratch/stack-commit-drawer.html` had been previewed and approved and
never ported. **Ported now, at the page's defaults, which is what he took.**

🎯 **WHY THIS ONE MATTERED MORE THAN IT LOOKED.** The board's two
`ChordStackPanel`s are `visibility:hidden` in 3D (`12-board`), so **this drawer IS
the Drive/Sustain interface during step 1** — every stack commit in the game goes
through the one panel that never joined the system.

What changed, all of it frame: the `#ff66cc` rounded card is a `Bracket` plated
**CHORD STACK**; each stack is its own `corner="sm"` bracket wearing its own stat's
colour and plated `DRIVE 2 / 4`; the `⚔️5` / `🛡️3` emoji readouts are the same
`ArenaDial` the pocket and the board draw; the rounded `<span>` pills are real
`NoteHex`es; the note pool is a bracket plated **STOCK · 9 left**; and the buttons
are the chamfered two-clip-path chips.
🎚️ **The budget stopped being a sentence.** "3 commits left" was a row of its own;
the count is now three segments on the frame line, in the same grammar as the phase
rail's bars and VIBE's pips. The hint text survives — the *number* moved.
🪦 **And the `STEP 1 — CHORD STACK` title line is retired, on the chord step only.**
The bracket's nameplate says it one line lower. ⚠️ Steps 2 and 3 still need that
element, so the condition is on the step, never on the element.

🐛 **THE BUG IN THE SCREENSHOT WAS ONE CSS LINE, AND IT IS NOW GONE BY CONSTRUCTION.**
`MatchSurface.jsx` gives the chord/melody turn region `padding:0; background:none;
border:0` — correct for a note stock that brings its own frame, and the reason the
old title and card sat flush against the column's left edge at x=12. A framed card
needed no CSS change at all: **the frame is the gutter.**

🪦 **TWO IMMERSIVE OVERRIDES DIED WITH THEIR TARGETS** — the rules that softened the
pink card's radius and filled the note pool's box. Both are brackets now: no border,
no radius, no fill, so the rules had nothing to soften and would only have bolted a
border back onto a frame that draws its own corners. 🎯 **The drawer needs no
immersive special-casing at all**, which is the whole point of putting it in the
system.

⚠️ **THE BUTTON LABELS ARE A TEST CONTRACT, AND I NEARLY BROKE THEM.** The preview
said *"Continue to melody"*; `clientJourneyCheck` **and** `clientBattleJourneyCheck`
both click that button with `textContent.includes('Continue to Melody')`, in both the
budget-left and budget-spent states. Lowercasing it to match the mockup would have
taken out two suites. **The strings ship verbatim and the chip renders uppercase
through CSS `text-transform`, which does not touch `textContent`.** 📌 The same trick
is what lets every label in here be restyled safely; do not "tidy" these to match
what is drawn.

⚠️ **The new CSS is UNSCOPED on purpose.** This drawer renders in both layouts, and
the bracket language is now the game's language in both — scoping it under
`[data-match-layout="immersive"]` would have left the 2D board wearing the panel the
arena just retired.

⁉️ **OPEN, AND IT IS A ONE-WORD FIX.** The sub-frame's nameplate says `DRIVE` and the
button inside it also says `DRIVE`. That is the said-it-twice this file has already
deleted twice (the chord stacks' inline titles in 2026-08, the key plate's root
badge). It shipped because it is what Alex approved on the page, and it is not mine
to change silently — but the button wants to be the *verb*, not the noun.

Verification: the ported block was **lifted back out of the monolith verbatim** (194
lines) and rendered through React SSR in four states, rather than a retyped copy —
28 assertions, all green. Both tutorial anchors (`drive-btn`, `sustain-btn`) and
`stack-note-grid` present; both journey suites' `Continue to Melody` lookup satisfied
in **both** states; `.step-active` intact for the beginner glow; no `border-radius`
and no `#ff66cc` anywhere; three nameplates; budget segments lighting 3/2/1/0 across
the states; two `ArenaDial`s; committed notes rendering as `NoteHex`es with the new
typeset accidentals; the pool correctly hiding spent slots and counting `9 left` from
11 minus 2. Measured in the real 238px pocket: **176 / 325 / 328 / 187px** against
666px of room at 1080p. ⚠️ On a 644px-tall window the armed state (325px) exceeds its
306px and scrolls — it does not break, but it is the state to watch.
⚠️ **The suites themselves still could not be run** — same two walls. 🎯 **`npm run
test:journey` and `npm run test:battlejourney` first: they are the two that click
this button.**

---

## 14-accidentals. Two glyphs in a hex built for one — 2026-09-12

Alex, on the step-1 drawer preview: *"the flats along with the note letter look way
too cramped in the hex space. We mayhaps need to make notes smaller for sharps and
flats?"* He was right, and it was two separate things.

🙈 **HALF OF IT WAS MY PREVIEW LYING.** `.scratch/stack-commit-drawer.html` drew the
letter at **44px with a 5px `paint-order` stroke** where the shipped chip uses **34px
with a drop-shadow glow and no stroke**. So he judged the crowding through a chip a
third too large and visually fatter than the game's. 🎯 **A preview that misdraws the
component is worse than no preview** — it does not merely fail to answer the question,
it invents a different one, and he spent a look on it. The page is corrected and its
`noteHex` now carries the shipped numbers with a comment saying why.

⭐ **THE OTHER HALF SHIPS, AND IT SHIPS EVERYWHERE.** `NoteHex.jsx` drew the letter at a
constant `fontSize={34}` whatever the note was. `PITCH_INDEX` accepts nineteen
spellings and **ten of the twelve pitch classes can carry an accidental**, with
`NOTE_POOL` sharp-side by default — so this was the stock, the eight track seats, the
twelve stack seats, the flying chip and the burst, not one panel. **Maximum length is
two**: no double accidentals and no `C#/Db` combined strings, so the fix only ever
places one extra glyph.

🎛️ **SHIPPED: the typeset pair**, chosen from a four-way preview
(`.scratch/note-hex-accidentals.html`) over a uniform shrink, a condense and real ♭/♯
glyphs. Alex's dial-in: **`accScale 0.60 · accRise 4 · accKern -1`**. The letter stays
34px and the accidental becomes a smaller raised mark beside it.
🎯 **THE RULE IT ENCODES IS THAT A TWO-GLYPH NOTE IS NOT A SMALLER NOTE.** A uniform
shrink — the obvious fix, and the one he first proposed — makes an `Ab` read as the
lesser note beside a `C`, which costs a grid of chips its rhythm and is worst in the
stock, where they sit in rows.
⚠️ **THE SQUEEZE IS PURELY HORIZONTAL, WHICH IS THE WHOLE REASON THIS WORKS.** Measured
on the preview in the real face: a plain letter spends ~44% of the bracket ring's 55.8
of clearance and a two-glyph note 75–82%, while the hex's VERTICAL room goes almost
unused. `accRise` spends the axis with room to buy back the axis without.

🐛 **THERE WERE TWO HARDCODED `34`s, AND THAT IS THE FINDING.** `NoteHex.jsx:295` was
the chip's letter; `:205` was **the burst's lifted copy**, the one that peels off when
you commit. Fixing only the first would have made the note change size at the exact
instant of the click — a glitch in the animation the game most wants to feel solid.
Both now go through one module-local `noteLetter`, so they cannot drift again.
📌 **This is §12-board's lesson for the third time in four handoffs** — *replacing a
thing means finding every mount.* The amp knob, the step-1 drawer, and now this.

⚠️ **THE ACCIDENTAL TEST IS A WHITELIST, NOT `length > 1`.** `letter` is not always a
note — the staggered seat passes `⚡` (`rlsw-simulator-v3_8_1.jsx` ~11548) — and a
length test would have silently typeset anything new as "a letter plus a mark".
📌 ♭ and ♯ are in the set even though nothing spells notes with them today, so
switching them on later needs no second edit.

🎯 **`textContent` IS DELIBERATELY UNCHANGED.** An `Ab` is now two `<text>` nodes and
still reads `Ab`, which is what keeps `arenaFallbackCheck`'s pocket regex and every DOM
journey suite green. Asserted, not assumed.

⁉️ **OPEN — real ♭/♯ glyphs.** They are narrower and stop `Ab` reading as the word
"ab", and `notes.js`'s own comments already think in them ("the blues ♭7", "always a
♯4"). ⚠️ But Saira Stencil One is a display stencil face and may not contain them, in
which case the browser swaps a second typeface in for that one mark. **My sandbox
blocks Google Fonts, so I could not test it** — the preview page carries a live probe
that answers it in Alex's browser. `clientRenderCheck` §5 already passes a real `G♭`,
which is worth knowing before anyone assumes the game is ASCII-only.

Verification: the ported component rendered through **React SSR and diffed attribute
by attribute against the preview's own geometry at his three numbers** — ✅ identical,
`x="55.20"`, accidental `x="65.76" y="56.00" font-size="20.4"`. Then eleven assertions
re-run against the port: `clientRenderCheck` §5 verbatim (both of its checks, on its
real `G♭`), `textContent` preserved across `C` / `Ab` / `G#` / `G♭` / `Bb` / `⚡`, the
burst's lifted letter byte-identical to the chip's, a natural still one centred 34px
text, and an empty seat still drawing no text. ✅ 11/11.
⚠️ **The suites themselves still could not be run** — same two walls as `12-board` and
`13-hud`: the 2026-09-08 Windows update stops the workspace mounting the repo, and the
cloud container holds win32 `node_modules`. 🎯 **`npm run test:render` and
`npm run test:journey` first.**

---

## 13-hud. The HUD joined it, and the line started to shimmer — 2026-09-12

The bracket pass finished. `MatchSurface` now draws its chrome the way the board
and the pocket do, and **all five frosted slabs are gone** — player card, sound
readout, turn summary, the three drawers and the note stock. The Cosmic Arena
reads straight through its own HUD: measured on the preview, chrome over the
arena fell from **~22% to ~6.5%**.

What changed, all of it frame: the phase rail is three bracket chips with their
own segment bars; VIBE is segmented like the dial, hot block at the head; the
nav buttons are chamfered chips (two stacked clip-paths, because a real CSS
border cannot follow a 45° cut); the drawers and the note stock are a flat scrim
with a chamfered edge; the action rail's buttons lost their radius.

🌊 **The melody line got its overtones and its pulse.** Alex: *"a few dimmer thin
lines, slightly different wave lengths than the main — make that shit look
magical"*, and a pulse running down the track. Three dim lines now ride the
committed run at **1.47 / 0.79 / 2.31** of the main wavelength.
🎯 **NOT ONE OF THOSE IS A ROUND RATIO, AND THAT IS THE ENTIRE TRICK.** 1.5 would
re-sync every other crest and 2 every crest, and the set would read as one thick
line breathing. Off the round numbers they never come back into phase inside the
track's width, so the interference keeps moving and never repeats — *which is the
difference between shimmer and a pattern.*
⚠️ Only the main line threads the seats; the overtones are the air around it.
🫀 The pulse is a short bright dash repeating every wavelength on its own copy of
the main line, sliding **faster** than the swell beneath it, so it reads as a
glint running down the track rather than the line moving. ⚠️ It is a dash on a
TRANSLATED path — never an animated `stroke-dashoffset`, which repaints the
region every frame over the live WebGL arena.

⚠️ **FOUR PIECES OF TEXT IN `MatchSurface` ARE TEST CONTRACTS** and the restyle
had to route around all four: the pocket's `…VIBE 4/5…DRIVE6…SUSTAIN3…Db8…FANS5`
run, the phase rail's live step matching `/BUILD CHORD/i`, the turn summary's
`9 notes available`, and — the sharp one — `arenaFallbackCheck` finds the Spirit
button with `el.textContent === 'Spirit'`, so **nothing else may ever go inside
those buttons**, not an icon and not a counter.

🐛 **A backtick inside `SURFACE_CSS` ends the template literal.** A CSS comment
written with code ticks round \`backdrop-filter\` silently terminated the string
and the build failed with `Expected ";" but found "backdrop"`. Comments in there
use plain quotes now. Cheap to fix, baffling to read.

Verification: **all seven of `arenaFallbackCheck`'s assertions were re-run
verbatim in a real DOM** — its phase check, its pocket regex, its summary regex,
its exact-textContent button lookup, the region count, plus a computed-style
check that the player frame really has no backdrop filter. ✅ Seven for seven.
The wave was checked across four animation frames to confirm the overtones
actually drift rather than lock.
⚠️ **The suites themselves still could not be run** — same two walls (the
2026-09-08 Windows update on the workspace, win32 `node_modules` in the cloud).
🎯 **`npm run test:arena` and `npm run test:journey`, first.**

---

## 12-board. The board panels joined the system — 2026-09-12

The bracket language went from the pocket to the board. Previewed first, in two
scratch pages Alex picked from (`.scratch/cosmic-arena-hud.html`,
`.scratch/melody-and-chord-stacks.html`), then built.

⌐ **`ui/Bracket.jsx` is new, and it is the arena's one frame primitive** —
corners bright, edges nearly dark, 45° chamfers, a flat scrim instead of frost.
🎯 **It is not a new shape.** It is `NoteHex`'s own corner-bracket ring, squared
off and scaled up: every note chip has worn that ring since Alex's 2026-08-26
dial-in. The chips had been speaking this language for a month; the containers
had not.

🐛 **AND IT CLOSED A BUG THE PREVIOUS HANDOFF OPENED.** `11-dials` replaced the
amp knob in the player pocket and **left the board behind** — `NoteCommitOverlay`
still imported `StatKnob` and drew it at `knobScale: 1.90`, so the game shipped
the new gauge at 74px and the knob it replaced at ~72px **in the same scene**.
📌 The lesson generalises: *replacing a component means finding every mount, not
the one you were looking at.* One grep for the old import would have caught it
on the day.

⭐ **`ArenaDial` gained `boost` and `size`, and the first is not polish.** The
chord stacks answer "where would this note take me" through the old knob's
`boost` channel — gained blocks white, lost blocks red. A straight swap to a dial
without that channel would have **deleted a working feature in silence**, which
is the exact shape of §B5. It is ported, same grammar.

🌊 **THE MELODY IS THE ONE THING OFF THE GRID.** Alex: *"the whole game is very
straight and mathematically symmetrical and sound. The 'sound' part should kind
of break that."* So the track's committed run is drawn as a travelling wave and
everything ahead of it as a taut, dead-straight string. **The melody is what puts
the wave in the line.**
⚠️ **THE WAVE MEASURES THE SEATS; IT DOES NOT ASSUME THEM.** The track's children
are a caption followed by eight seats in one flex row, so the seats do not start
at the row's left edge — and a wave phased to the ROW drifts by however wide that
caption rendered this turn, which at this wavelength is enough to park every note
on a crest instead of on a crossing. The notes come off their own string, which
is the single thing the wave exists to avoid. So it measures, with
`ResizeObserver` **guarded** because the DOM journey suites run this under jsdom.
📌 The travel is a `transform` on a path built two wavelengths wide, not a
morphing `d` — compositor-only, for the same reason `ArenaDial` has no filters.

🪦 **The −6° lean is retired** — Alex, *"let's do away with the 6 degree lean for
now."* ⚠️ Bringing it back needs THREE things, not one: the `skewX` on each panel
root, ONE counter-skew wrapper around the children (never two — a nested un-skew
shears the inner content the other way), and the dial left outside it. The file
header carries the same warning.

📌 **THE CHORD STACKS ARE THE 2D BOARD'S PANELS.** They are `visibility:hidden`
in the arena — worth knowing before going looking for them there. In 3D the
pocket's dials are the Drive/Sustain readout and only the melody track is on the
board.

Two one-line edits in the monolith, both frame-only: the track passes
`filled`/`total` so the wave knows its length, and the inline `TRACK` caption is
deleted because the panel's own nameplate says MELODY one line above it — the
same said-it-twice that cost the chord stacks their inline titles in 2026-08.

Verification: the ported components rendered through **React SSR against the real
`MatchSurface` and the real panel props**, with `arenaFallbackCheck`'s exact regex
re-run on the result — ✅ `DRIVE6SUSTAIN3Db8FANS5`. Every tutorial anchor
(`drive-stack`, `sustain-stack`, `commit-track`), `data-immersive-track`,
`data-stack-slot` and `.step-active` asserted present; `skewX` and
`backdrop-filter` asserted **absent**. The wave's threading was checked in a real
browser layout **with the caption present**, which is the case the naive version
gets wrong.
⚠️ **`test:arena`, `test:journey`, `test:battlejourney`, `test:render`, `lint`
and the build could NOT be run** — the desktop workspace still cannot mount the
repo (the 2026-09-08 Windows update) and the cloud shell holds win32
`node_modules`. 🎯 **Run `npm run test:arena` and `npm run test:journey` first**:
between them they own the pocket's textContent and the DOM melody journey that
walks this very track.

---

## 11-dials. The Drive/Sustain dials became gauges — 2026-09-11

Alex, on the 3D arena HUD: *"the Drive and Sustain dials look a little funny."*
They were a **skeuomorphic amp knob** — gloss highlight, inset bevel, a needle,
and a `repeating-conic-gradient` spraying spokes through the full 360°, including
the bottom 90° the 0–10 scale never uses. He asked for *"space rock Tron neon."*

⭐ **PREVIEWED BEFORE BUILT, AT TRUE SIZE, AT HIS REQUEST** — `.scratch/drive-sustain-dials.html`
(four candidates against the shipping knob) and then `.scratch/drive-sustain-dials-c.html`
(three detailings of the one he picked). 🎯 **The rule the preview enforced is
its own finding:** every candidate was drawn at the size it actually gets — the
pocket is 238px and a dial column is ~81px — because *anything that only works at
3× is not a dial, it is a poster.* Two candidates that looked good zoomed were cut
on that row alone.

🎛️ **SHIPPED: `ui/ArenaDial.jsx`.** Ten hard-edged light blocks for ten units, a
white-hot block at the head, and a chamfered frame that is **bright at the corners
and nearly dark along the edges** — a bracket, not a box, which is the only reason
it can sit behind the ring without competing with it. The label moved into the
gauge's own dead 90° at the bottom, and *that* is what paid for the ring growing
48px → 74px.

⚠️ **THREE THINGS HERE ARE CONTRACTS, NOT STYLE:**
1. 🚩 **The label's `<text>` precedes the value's.** `arenaFallbackCheck` reads the
   pocket's textContent for `DRIVE6` / `SUSTAIN3`; **SVG text counts toward
   textContent**, so the obvious source order (numeral first, it is the important
   one) reads `6DRIVE` and fails `test:arena`. They do not overlap on screen, so
   source order was free to serve the test.
2. 🚩 **No SVG filters.** The bloom is a wide faint stroke under the hot core
   stroke. A `feGaussianBlur` or a `drop-shadow` re-rasterises a filter region over
   the **live WebGL arena** every time Drive or Sustain moves.
3. 🚩 **The dial element is still the note-flight landing target.** `driveRef` /
   `sustainRef` are what `rlsw-simulator-v3_8_1.jsx:3434` aims a flying chord chip
   at in 3D. The refs, `data-immersive-stack` and `data-dial-value` all survived
   the rewrite untouched.

📌 The colours moved to **`#ff6644` / `#44aaff`** — not a free choice: those are
`DRIVE_C` / `SUSTAIN_C` from the monolith, the hues the flying note chips already
arrive in. The dial is the chip's landing target, so a chip that lands should land
in its own colour.

🐛 **One bug only one of the two dials could ever have shown**, caught in the
detailing pass: the frame's bottom edge originally kept a stub either side of the
nameplate gap. Five-letter **DRIVE** cleared them; seven-letter **SUSTAIN** ran
straight through them. The bottom edge is now not drawn at all — the corner
brackets already frame the label.

📐 Sizing is CSS (`width:100%; max-width:74px`), so the dial follows the pocket
down through both narrow breakpoints on its own. **Three hand-written breakpoint
overrides were deleted**, not ported.

Verification: the ported component was rendered through **React SSR against the
real `MatchSurface`**, and `arenaFallbackCheck`'s exact regex re-run against the
resulting pocket textContent — ✅ `DRIVE6SUSTAIN3Db8FANS5`. Screenshot-checked at
true size and at 4×.
⚠️ **`test:arena` itself, `test:render`, `lint` and the build could NOT be run**:
the desktop workspace could not mount the repo this session (a Windows update from
2026-09-08 blocks it) and the earlier half of the session hit the same win32
`node_modules` wall from a Linux shell. **They need a run on Alex's machine.**
🎯 The one to run first is **`npm run test:arena`** — it is the suite that owns the
textContent contract above.

---

## 10-pointer. The cursor became an arrowhead — 2026-09-11

Alex sent a zoomed screenshot of the pointer he wants and said the one in the
game "looks nothing like" it. He was right: `ui/GlobalCursor.jsx` drew a
**chevron** — two arms and no body — where the reference is a filled
**arrowhead**: black glass inside, a hot white rim, a cyan bloom.

The shape was **fitted, not eyeballed.** The reference is a ~5× upscale, so every
edge in it is a gradient and a sharp corner reads blunt. Measuring the outline by
eye put the tip 17px away from where it belongs and disagreed with itself at the
wing. What worked instead: isolate the reference's **black core** (clean — the
white "Riffs" glyphs the cursor sits on contaminate every bright-pixel measurement
but not the black one), then fit four vertices and a rim half-width by rendering a
candidate as a signed-distance field, blurring it to the screenshot's own blur and
maximising core IoU. It settles at **0.937**. Those decimals in `PATH` and `RIM`
are that fit; they are measurements and must not be tidied.

⭐ **The press is a bob down the arrow's own axis**, not a shrink in place. One
2.8px dip along `(0.259, 0.966)` — the tip→tail line — a small rebound, then
still, in 340ms. **Scale pivots on the TIP**, so the hotspot never leaves the
pixel the browser thinks it is on: only the body of the mark moves. The held-down
settle is a separate element from the bob so a long press keeps its dent while
the bob finishes. `prefers-reduced-motion` drops the bob and keeps the shape.

🪦 **One stroke, not two.** An inner cyan line was built and cut in the same
pass: at the size this actually renders, a second edge reads as a seam down the
middle of the rim. The blue lives in the bloom and in the rim's tint.

📌 **Two copies exist on purpose and must move together** — the component and
`public/cursors/neon-pointer.svg`, its static twin for any future `cursor:url()`.
Both say so in their own headers.

Verification: `test:arch` ✅ (it was **red before this change on two counts** —
`GlobalCursor.jsx` had never been added to `ARCHITECTURE.md`, and the doc still
named a deleted `ui/HintScreen.jsx`; both are now closed, the second into the
🪦 forwarding table). `test:engine` ✅, `lint` ✅ on the changed file.
⚠️ **`npm run build`, `test:render` and every esbuild-backed suite could not be
run** — this session's shell is Linux and `node_modules` holds the win32 native
binaries for `rolldown` and `esbuild`. They need a run on Alex's own machine.

---

## 9-immersive-hud. Space-saving live HUD — 2026-09-09

Alex approved the second immersive HUD study for the game. Its composition is
now live in 3D mode: a 238px upper-left player pocket carries portrait, Vibe,
Drive, Sustain, Db and Fans; chord/melody controls unfold directly below it; the
existing melody track floats independently over the board; and Step 3 uses a
shallow centered action dock. Turn/Spirit/Rivals tabs live at upper right and the
camera strip at lower right. The board remains the largest surface in every step.

This is still one live control tree. MatchSurface only arranges disclosure and
read-only summaries; the client retains every handler, tutorial anchor, note
flight endpoint and action permission. The 2D layout is unchanged. At phone
width the board stays above the mounted drawers and the camera controls condense.

Verification: browser review at desktop Chord and Melody states and 390×844;
`test:arena`, `test:journey`, `test:render`, `test:arch` and the zero-warning
bundle check pass. See `../docs/immersive-hud-handoff.md`.

---

## 8-arena-fidelity. Live preview scenery and effects — 2026-09-08

The live arena now carries the preview's authored indigo materials, fractured
island, fissures, detailed live-tier cabinets, moving spotlights/beams, planets,
48 floating rocks and seven metal shards. Movement, resolved attacks, falling
standees, status/ability pulses, tentacles and hazards have a public-state 3D
presentation layer. Game rules and original SVG input targets remain authoritative.

Alex asked for direct comparison with the scratch preview. Opened the exported
preview and live game; their GLBs are byte-identical. Removed the new bright room
reflection that washed out the palette. Matched the inspected preview lighting
(0.9 glow / 1.35 rock / 1.3 fissures), restored planet atmosphere and shards, and
instanced all 48 rocks so Standard retains the full scenery. High now explicitly
overrides Lite FX; Auto explains its effective quality in the toolbar.

Alex also requested preview gestures: left-drag orbits, right-drag pans, wheel
zooms. A six-pixel drag threshold hands capture to OrbitControls; simple clicks
retain their actual SVG target, while drag releases cannot dispatch gameplay.

Verification: full test:all passed, then targeted arena checks cover the final
palette/scenery/gesture changes. The actual GLB is tested for palette, station
binding and tier changes; privacy, effect lifetime, DOM restoration and real
WebGL failure are covered too. Browser checks exercised melody, commit, 7 → 16
for one AP, 2D recovery, detail/camera controls and a live laser show. Build and
zero-warning bundle checks pass; Vite retains its large-chunk advisory.

The renderer remains hybrid: ordinary characters and tactical overlays are flat
SVG above the scene. Full character models, tactical depth occlusion and bespoke
animation for every ability are future work. See ../docs/cosmic-arena.md.
The external Systems Map artifact tool is unavailable; repository docs are current.
Previous structural handoff: ../docs/archive/SEQUENCING-hud-2026-09-07.md.
