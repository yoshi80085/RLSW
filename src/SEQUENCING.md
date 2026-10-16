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
> | **C** | 📇 **the index** — every handoff (108 rows), dated, one line each, pointing into the archive |
>
> ⚠️ **NOTHING WAS DELETED.** If a line below is too short to act on, the full
> text is in the archive under the same section id.
>
> 📌 **NEW ENTRY POINT: read `STATE_OF_PLAY.md` first.** It is the current state
> of the whole game in one screen. This file is the *narrative* — what happened
> and what it taught. That file is the *state* — what is true right now.

---

# A. 🧭 THE CURRENT HANDOFF

## 74-fanmc2. 🎤 The MC: replay at his last show of ANY match, never behind anything, summoned in Testing Grounds, and a wardrobe — 2026-10-16

**Alex:** *"Lets make that last appearance of the MC showcase the best riff off replay (even in 15 rounds or 10 rounds only matches - in case of the 10 rounds - its the only appearance so have him showcase here too)"* · *"on the screenshot that I saw of the MC in the chat - it looked like he was appearing 'behind' other assets? I haven't seen him in the game - can you make sure he can be summoned in the testing grounds? Lets make sure that he doesn't get obscured by anything when he comes out."* · *"Lastly, lets make a fashion preview for the MC - he should get a special 'look'"*. The 10-15 handoff is `docs/archive/SEQUENCING-2026-10-16-before-fan-mc-r2.md`.

### What shipped
- 📺 **The replay is at his LAST show, whatever the match length** — 7 of 10 (his only show), 12 of 15, 17 of 20. `data/fanMc.js` `replayShow(roundLimit, round)` is now "the last round of `stageFxSchedule(roundLimit)`"; `FAN_MC_REPLAY_ROUNDS` is gone. 📌 My call: a Legend Run's schedule is fixed (7, 12, 17), so its show at 17 replays too — and if the crown is taken first there is no replay.
- 🔝 **He is never behind anything.** Cause (the 10-15 screenshot): he lived in the ARENA scene, the bottom of three stacked layers (WebGL arena z0 → the board's SVG on CSS3D z1 → the foreground canvas z2 with the amps, fans, dice, standees, smoke, lasers and Sonic rings), so all of those — and the hex tints — painted over him however near he was. Now `arenaRenderer.js` builds his own scene (`mcScene`, its own hemisphere + key light, like the standees' layer) and draws it LAST on the foreground canvas after a `clearDepth()`, after the beams and the smoke's self-pass. `fanMcStage.js` takes `floatRoot`: he, his spotlight and the TV go there; only the board wash stays on the board. ⚠️ The TV's render target is now filled by the FOREGROUND renderer (`fanMcPrerender(foreground)`: a target is per WebGL context), with its clear colour saved and restored (the foreground runs `autoClear=false`). DOM: the stage-effect status pills (`StageFXBanner`, now `data-stagefx-pills`) and the crowd's speech bubble (`data-arena-crowd-speaker`) step aside under `body[data-fanmc-live]` — in Chromium the 💨 SMOKE pill landed on his head at the call.
- 🧪 **Summon him in Testing Grounds.** 🧪 TEST → 🎤 THE FAN MC: pick the effect (or 🔁 each in turn), then **🎤 Summon** (standings + the call), **🎤📺 + Replay** (his last-show version with the TV; the match's own best riff-off, or a demo duel `demoRiff` between the first two Spirits — a picture only, never written to the engine) or **🎤 No-duel line**. It is the real show: the monolith's `devSummonFanMc` activates the effect in the rules at once with its words deferred (`activateStageFx(…, fanMcDeferredRef.current)`), and `fanMcTest` feeds the same derived hold (`fanMcTestLive`, gated on `testMode`), veil (keyed by `fanMcKey`) and show-builder. The 🧪 layer hides while he is on. No `Math.random` (test:determinism counts call sites).
- 🎩 **The wardrobe preview** — `.scratch/fan-mc-fashion-preview.html` (`npm run dev:fanmcfashion`; double-click copy `npm run build:fanmcfashion`; claude.ai Artifact **Fan MC Wardrobe** https://claude.ai/artifact/Ay3peZPtABXagUqZJPgVs3). The game's own MC (stage, mic, moods, clock) on his own layer like the arena; the clothes are `.scratch/fan-mc-fashion/outfit.js` (`MC_OUTFIT`, `dressMc`, `outfitFanStyle` — written to move to `src/board/fanMcOutfit.js` as-is). Slots: head (Ronin band = today, top hat, crown, backwards cap, headphones, halo, mohawk), eyes (aviators, star shades, LED visor, monocle), neck (bow tie, MC chain, scarf, backstage pass), body (tux front, sequins, cape, sash — laid on the body's own surface), aura (sparkle, notes, confetti on a cheer), mic (chrome, gold, rhinestone, neon); garment / accent / metal colours; six size-and-shine sliders. Eight rack looks (In the game now, Ringmaster, Black Tie, Showman, Rock Royalty, Hype MC, Cosmic Host, Mosh Pit). Moods loop the show's real moments; an inset shows **his in-game lens** (close while he talks, the wide at the call); Space flips to today's look; paste a match screenshot as the backdrop; 📋 dial-in marks changed-vs-the-game. Defaults = what he wears today, so nothing changes in the game until Alex picks.
- The **Fan MC Intermission** preview now labels 7 of 10 and 12 of 15 as replay shows (it already read `replayShow`); republished (version 5).

### Evidence
- `test:fanmc` **129** (was 101): the replay rule for 10 / 15 / 20 / Legend Run × every show; his layer (`floatRoot`, the spot comes with him, the wash stays, dispose cleans both); the renderer draws him after the standees / smoke / rings, after a depth clear, and prerenders the TV with the foreground renderer; the summon (`demoRiff` shape and bar, the wiring, the demo never dispatched, the 🧪 panel hides). Mutation: the 20-only rule → red.
- `test:fanmcsummon` **21** (new, ~40 s, in `test:all`): the real Game on the Testing Grounds config by clicks — 🧪 → 💨 → 🎤📺 → smoke live in the rules, veiled on the board, 🧪 gone, the riff beat on a demo duel with `bestRiff` still null, Escape → SMOKE MACHINE called and on the board, he leaves, 🧪 back; a plain summon has no riff beat. Mutation: veil keyed to the draw only → red.
- `test:fanmcjourney` 26 · `test:stagefx` 99 · `test:determinism` 20 · `test:sandbox` 35 · `test:client` 6 · `test:render` 13 · `test:journey` · `test:padjourney` · `test:gamepad` · `test:arch` 8 · `check:bundle` 0 warnings (Linux copy, and `check:bundle` / `test:fanmc` / `test:arch` / `test:determinism` on Alex's machine with a Linux esbuild).
- 👁️ **Chromium (software GPU) on the real Testing Grounds:** summon + replay → he lands in front of the board and the Ronin's standee, the bar chart, the TV replaying the demo duel, the dim, SMOKE MACHINE called with him drawn OVER the smoke cloud and the pill gone. A DOM audit at his projected head through every beat found nothing painted over him. The wardrobe page rendered all eight looks in Chromium (Vite and the double-click file).

### Not done / not verified
- ⏳ Not on Alex's GPU; not in a real 10- or 15-round match (the rule is one function the client already reads; the 20-round journey still passes).
- 📌 His layer has **no bloom** (the foreground canvas has none; the Sonic's rings carry their own). His rim, mic band and gems are `toneMapped:false`, so they stay bright, but softer than in the arena's bloom. If Alex wants the old glow back, the beam layer's bloom pass is the model.
- 📌 He no longer dims with the arena on the tease (the dim is the arena's exposure) — he reads as spotlit in the dark. Flag if unwanted.
- 🎩 The wardrobe is a preview only — nothing ported. ⁉️ My calls: defaults are today's look; the confetti fires on every cheer (his call, his sign-off); the rack looks are first proposals.
- 🗑️ Alex can delete `_to_delete/rlsw-src-for-cloud-2026-10-16.tgz` (the source copy sent to the cloud for the Chromium check).

### Addendum (same evening) — 🎩 his look, ported at Alex's dial-in
- **Alex pasted the Wardrobe dial-in** (7 of 16): head `mohawk`, eyes `visor`, aura `notes`, mic `neon`, main `#0f2e2a`, accent `#ff4fd8`, metal `silver`; everything else default.
- **Ported:** `.scratch/fan-mc-fashion/outfit.js` moved to **`src/board/fanMcOutfit.js`** as written (the old file is in `_to_delete/fan-mc-outfit.superseded-by-src-board-fanMcOutfit.js`, so there is one copy, §B1). `MC_OUTFIT` = his dial-in; `MC_OUTFIT_BEFORE` = the Ronin-band look. `fanMcStage.js`: `outfit` option, `dressMc` after every `buildMc` (after the mic, which the neon finish re-skins), `dress.tick` at the end of `poseMc` with the mood it computes, `setOutfit` / `outfit` for the page, the fan style from `outfitFanStyle(O, L.style)` (any headwear but the band needs the plain head). The Wardrobe page now drives the stage (`setOutfit`) instead of dressing him itself; its defaults are the game's look and its rack gains *Ronin Band*.
- **Evidence:** `test:fanmc` **141** (§10: his seven pinned, the band gone, seven spikes, the visor, the aura, the neon mic in his accent, `setOutfit` re-dresses, the page imports the game's module; mutation: no `dressMc` → red) · `test:fanmcsummon` 21 · `test:stagefx` 99 · `test:determinism` 20 · `test:arch` 8 · `check:bundle` 0 warnings. 👁️ Chromium on the real Testing Grounds: the pink mohawk, the neon mic, the notes, over the board and the standee; nothing on the page over his head through the show.
- ⚠️ **The claude.ai Wardrobe artifact could not be updated:** the publisher refused it three times as an "artifact-pr-review" page ("too large for a review page") — a misclassification; nothing in the page is a review. The live artifact is still r1 (its defaults are the old look; a dial-in from it still marks changes correctly against the band look). The repo copies are current: `fan-mc-fashion-preview.standalone.html` (double-click) and `npm run dev:fanmcfashion`. The *Fan MC Intermission* artifact republished fine (v6, wearing the new look).

### Next
1. Alex: in Testing Grounds, 🧪 TEST → 🎤 THE FAN MC → 🎤📺 + Replay — watch him land, the TV, the call.
2. Alex: dial a look on **Fan MC Wardrobe**, copy the dial-in → port: `outfit.js` → `src/board/fanMcOutfit.js`, `MC_OUTFIT` = his numbers, `fanMcStage.buildMc` dresses him (fan style from `outfitFanStyle`), `poseMc` ticks it with its mood.

---

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

# C. 📇 THE INDEX — 107 rows; each names its archive (`docs/archive/SEQUENCING-*.md`)

Newest first. **Search the archive by the section id in column 1.**

| id | date | what it did |
|---|---|---|
| `74-fanmc2` | 2026-10-16 | 🎤 The replay at the MC's LAST show of any match (7 of 10, 12 of 15, 17 of 20); he is drawn on his own layer LAST on the foreground canvas (was under the board, the standees, the smoke); summoned in Testing Grounds (`devSummonFanMc`, `demoRiff`); the **Fan MC Wardrobe** preview and, same evening, his look at Alex's dial-in (`board/fanMcOutfit.js`: mohawk, LED visor, notes, neon mic, pink on teal). `test:fanmc` 141, `test:fanmcsummon` 21. Live §A. |
| `73-fanmc` | 2026-10-15 | 🎤 The fan MC announces the stage effects (7 of 10; 7, 12 of 15; 7, 12, 17 of 20): the wallpaper fan on his own hex with a mic, the Fame bar chart, the call that brings the effect onto the board; the TV replay of the remembered best riff-off ONLY at the last show of a 20-round match (widened to every length by `74-fanmc2`). Archived in `../docs/archive/SEQUENCING-2026-10-16-before-fan-mc-r2.md`. Engine `state.bestRiff` (strictly better replaces); `data/fanMc.js`, `board/fanMcStage.js`, `ui/FanMcOverlay.jsx`, `audio/fanMcSfx.js`; the rules never wait, the picture does. `test:fanmc` 101, `test:fanmcjourney` 26. |
| `72-padport` | 2026-10-14 | Archived in `../docs/archive/SEQUENCING-2026-10-15-before-fan-mc.md`. 🎮🎡 The pad turn in the game, and the note pool IS the wheel for everyone (`ui/PoolWheel.jsx`, centre of the arena; honeycomb + step-1 grid gone); the pad's turn modes (`providePadTurn`: wheel picker + hammer flick, ability cross, legal-only aiming, HUD on View); the button bar; Escape backs out of an aim. `test:gamepad` 334, `test:padjourney` 37, `test:scalewheel` 319. + the wheel's own window (scrim + frosted disc) and the emulation guard. Live §A. |
| `71-padturn` | 2026-10-14 | Archived in `../docs/archive/SEQUENCING-2026-10-14-before-pad-port.md`. 🎮 Pad mode vs mouse mode (the last device wins: arrow hidden, a shield so nothing stray hovers, the ring lit at once); `data-pad-default` keyed per step so each turn opens on Drive and follows the steps (and the title / draft / lobby); the pad-turn PREVIEW (`input/padTurn.js` + `.scratch/pad-turn-preview.html`: wheel stick-picker, hammer flick, ability cross, button bar), dialled 0 of 30. `test:gamepad` 272, `test:padjourney` 17. |
| `70-controller` | 2026-10-14 | Archived in `../docs/archive/SEQUENCING-2026-10-14-before-pad-turn.md`. 🎮 Controller foundation: `src/input/` (a pad press IS a key press or a click). Riff: six strings on six fingers, sticks bend; turn: highlight (D-pad + A), Y = Enter, the left stick walks toward screen-up, the right stick turns the lens. Controller Lab page. `test:gamepad` 184, `test:padjourney` 10. |
| `69-sonicpoints` | 2026-10-13 | The Sonic pays on points through the shield (`sonicVibe` 1 per 4 ≤ 3, `sonicStrengthFame` 1 + 1 per 3 ≤ 5 base per attack, riders and crowd on top); a held shield pays its owner 1 FP × crowd (`awardShieldHeldFame`); the crowd-on-every-Fame guard (`test:sonic` §R9). The Lost Chords are energy balls (`LOST_CHORD_STYLE` 'orb', crystal sounds kept). `test:sonic` 174, `test:lostchords` 115; sweep 91/97 before and after, same 6 red. `docs/archive/SEQUENCING-2026-10-14-before-controller.md` (with its 10-13 rulings and 10-14 nebula addenda). |
| `68-marqueeturn` | 2026-10-09 | Archived in `../docs/archive/SEQUENCING-2026-10-13-before-sonic-points.md`. A taken marquee's replacement is chosen at the take but lights at the turn end (`board.marqueePending`, `lightPendingMarquees`); the special-dice diagnosis (a die card bent the weakest die, often dropped) → a card die is a BONUS die with its own seat, always kept (`applyCard` / `keepBest` pins), dealt gold onto the table; the card at the roll finally reaches the 3D floor (battle key fix). |
| `67-facenorth` | 2026-10-09 | Archived in `../docs/archive/SEQUENCING-2026-10-13-before-sonic-points.md`. 🧭 Face north: a 450 ms swing that puts the lens due south of its target (`topDownView.js` `northLens`, `arenaRenderer.north()`), Numpad 5 does it; no preview (Alex asked straight). |
| `66-iwatotrap` | 2026-10-09 | Archived in `../docs/archive/SEQUENCING-2026-10-13-before-sonic-points.md`. The Cursed Shamisen v3, "the trap": the Action Token curses a hidden Lost Chord (his screen only, pinned until his next turn); a Rival who takes it gets Iwato on that note with three creepy haunted notes to lift (accumulating, 3 turns = two cursed melodies, no refresh, the draw seeps in ⅓ → ⅔). `iwatoCurse.js` rewritten; spring in the client pickup and `collectPickups`; arena springs on the hex. `IWATO_CURSE_V3_SPEC.md`. `test:shamisen` 113, `test:shamisenjourney` 27. |
| `65-sonictail` | 2026-10-08 | Archived in `../docs/archive/SEQUENCING-2026-10-13-before-sonic-points.md`. The Sonic ring beam's tail follows the head at Alex's 6-lever dial-in: `RING_FOLLOW` in `board/sonicZigzagVisuals.js` — on the last stretch the rings ride the head's own track (its ups and downs, faster), catch it by contact and pour into the impact for 0.8 s; first half byte-identical. `test:sonicfx` (`sonicFollowCheck`). |
| `64-lostchords` | 2026-10-08 | Archived in `../docs/archive/SEQUENCING-2026-10-13-before-sonic-points.md`. The Lost Chords as 3D crystals at Alex's 4-lever dial-in: `board/lostChords.js` (look, clocks, `planLostChordMoments`, the game layer) + `audio/lostChordSfx.js`; crystal on the foreground scene, floor on the arena canvas; pickup waits for the standee; pooled lights; the client's pickup pluck moved to the shatter. `test:lostchords` 88. |
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
