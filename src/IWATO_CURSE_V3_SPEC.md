# 🎸 Cursed Shamisen v3 — "The Trap" (design spec, 2026-10-09)

> **Status: ✅ RULES BUILT 2026-10-09; rules 15–16 (two cursed melodies, the draw seeps in ⅓ → ⅔, no refresh) built the same day** (engine, client, arena, wheel, pop-out, bots' pickup path; `SEQUENCING.md` §A `66-iwatotrap`). ⏳ **The laying / armed animation is a PLACEHOLDER** (a violet crystal + dashed hex on the Ronin's screen, one low pluck) — its own preview is the next step. ⏳ Not yet played by Alex. See **"As built"** at the end for the calls made during the port.
>
> **Supersedes** `IWATO_CURSE_V2_SPEC.md` ("The Haunting", 2026-10-03, never built). v3 keeps v2's curse (three haunted notes, lifted one by one) and changes **how it lands on a Rival**: a hidden trap on a Lost Chord instead of a targeted cast. Keep v2 and §2.3.00 as the record.

## The ability in one paragraph

On his turn Ronin spends his **Action Token** to curse **one Lost Chord anywhere on the board**. Only Ronin can see it. The trap lasts **until the start of Ronin's next turn**, so every Rival gets one turn in which they might walk into it. While it is armed the cursed Lost Chord **does not drift**, even if the round end would have moved it. If a Rival picks it up, they get the note as usual **and the curse springs**: three ghost notes rise from the hex and fly to them, the 呪 paper attaches, and their scale wheel becomes Iwato **on the cursed note** with the three haunted notes marked (all three from the creepy notes; the note they picked up only sets the key). From there the curse runs as in v2. If nobody picks it up, the trap is wasted and the Action Token is gone anyway.

## ✅ RULED by Alex (2026-10-09)

1. **The trap.** Ronin curses one Lost Chord on the board, at any distance. It is **invisible to every other player**.
2. **One turn.** The trap is armed until the **start of Ronin's next turn**. Then it is either sprung or wasted.
3. **The cursed note holds its hex.** It does not drift or vanish while armed, even when it would have been its turn to move.
4. **Price: the Action Token**, spent whether the trap is sprung or wasted. **Plus the 2-round cooldown**, starting when the trap is laid.
5. **Ronin steps on his own trap** → he collects the note as normal and the trap is removed (no curse, no refund).
6. **One Shamisen curse at a time.** No new trap while one is armed **or** while a curse still stands on a Rival.
7. **Only melody commits lift haunted notes** (not Drive/Sustain).
8. **If Ronin is KO'd, the curse continues as normal** (and an armed trap stays armed until it would have expired).
9. **From v2, still ruled:** three different haunted notes from Iwato, favouring the creepy ones; not handed to the Rival; shown purple/black on the cursed wheel; progress accumulates; each haunted note committed lifts one ghost; all three lift the paper; lost fans is the only penalty; keep `CursedWheel`. ~~up to 3 rounds; the haunted notes refresh in round 2; in round 3 the curse ends either way~~ → see rules 15 and 16.
10. ~~**The note draw follows the curse halfway**~~ — **replaced by rule 16** (the draw seeps in ⅓ → ⅔). Kept for the record: **The note draw follows the curse halfway** (Alex: *"sounds good"*). Today `startTurnNotes` draws the guaranteed half (`STOCK_PALETTE_GUARANTEE` 0.5) from the Spirit's own palette and ignores the curse. While cursed, draw the guaranteed half from the **cursed Iwato wheel**; the other half stays random across all 12. A given haunted note then shows up in about 14% of new notes (vs ~4–11% today); with up to 6 slots refilling a turn (`STOCK_REFILL_RATE`), that is about a 60% chance per turn of seeing any particular one. Not fully, or the curse stops hurting.
11. **The trapped note sets the key; it is NOT a haunted note** (Alex, 2026-10-09: *"lets make all 3 notes come from creepy notes - the trapped note just sets the key"*). Replaces the earlier "the trapped note is one of the haunted notes".
12. **The curse is Iwato on the CURSED NOTE, not on Ronin's key** (Alex: *"It should be the note that is cursed - not Ronin's key"*). The trapped Lost Chord's pitch is the root of the Rival's cursed wheel (1 ♭2 4 ♭5 ♭7 from it). Ronin chooses the curse's key by choosing which note to trap. Retires the shipped `roninRoot` / "keeps the key it was taken up in".
    - **All three haunted notes are creepy notes:** three different notes from ♭2, 4, ♭5, ♭7 on that root, weighted toward ♭2 and ♭5. The root (the note they picked up) is never haunted.
13. **The springing turn counts as cursed turn 1** (Alex: *"not exactly sure … but let's run with that"* — revisit after playtest). The curse is on from the step; if they still have a melody to play that turn, it is scored on the cursed wheel. Counted down at the end of the Rival's turns, as shipped. **Confirmed 2026-10-09 by rule 15.**
14. **A trap not picked up turns back into a normal note** at the start of Ronin's next turn: an ordinary Lost Chord again, drifting from the next round end.

15. **Two cursed melodies — the curse lasts 3 of their turns, the springing turn counting as the first** (Alex, 2026-10-09: *"I think having 2 rounds to 'deal' with the curse in the melody is good, 3 is overkill. The movement turn that gets 'cursed' counts as the first round."*). Turn order is chord → melody → move, so the springing turn has no melody left; their 2nd and 3rd turns are the two melodies to lift it. `CURSE_TURNS` stays 3. Rejects the alternative of starting the clock on their next turn (that would be three melodies).
16. **No refresh — the draw SEEPS IN instead** (Alex, 2026-10-09: *"from the 75%, 1/3 of the notes are the cursed scale for the 1st round (2nd round technically), if still not exorcised, the next round, 2/3 of the notes from that 75% are from the cursed scale"*). The haunted notes are fixed from the spring. The draw's guaranteed slice (`STOCK_PALETTE_GUARANTEE` 0.5) is split: on their **2nd cursed turn ⅓** of it comes off the cursed wheel and ⅔ off their own palette; on their **3rd, ⅔ / ⅓**. The other half stays random across all 12, as for everyone. Retires the refresh (v2 rule 4, v2 default 1) and rule 10.
    - *Alex's "75%"*: today a 7-note palette's notes come up about 79% of the time (the guaranteed 50% plus the random half landing in key, 50% × 7/12). "From the 75%" is read as **the guaranteed slice**; the random half stays as it is for everyone.
    - **What it does to the odds** (a 7-note palette with no overlap with Iwato, a full 6-note refill): about **38%** of new notes are Iwato on the 2nd cursed turn and **54%** on the 3rd (it was 71% under rule 10). A given haunted note shows up in about **7.5%** then **10.8%** of new notes, so the chance of drawing a particular one in a full refill is about **37%** then **50%** (it was about 60% each turn under rule 10). Without the refresh, the curse is now **much harder to lift in full**. Notes already in their hand still count, and own-palette notes that are also in Iwato raise the odds.
    - Their own-palette notes are still discord while cursed (`livePalette` is Iwato), so the 2nd cursed turn's hand has fewer clean notes than under rule 10. The curse hurts more early and lets go a little as it seeps in.

17. **The trap is the 呪 noroi card** (Alex, 2026-10-09: *"the 'cursed card' can appear on Ronin's screen, be invisible to others. If the Spirit steps into the card, the shamisen can appear and play out"* → *"yes, the noroi card"*). One paper travels the whole story: Ronin sticks it on a Lost Chord, it waits there, and when a Rival steps on it, it flies to them (the 呪 paper the spring already attaches).
    - **Lay** (Ronin's screen only): the card flicks from his standee onto the crystal and sticks to its face; one low pluck; the crystal's light dims violet.
    - **Armed** (Ronin's screen only): the card stays on the crystal, fluttering, with a slow low violet pulse so he can find it again. The crystal keeps its shape.
    - **Spring** (everyone): the crystal starts to shatter as normal → hush → the card shows for everyone out of the shards → the ghost shamisen rises over the hex and plays the haunted notes → the card flies onto the Rival → the three ghosts circle them. The note still banks.
18. **A wasted trap crumbles in PUBLIC** (Alex, 2026-10-09: *"lets have the paper crumbling to ash be public. Since no one was affected, they at least get to see the result publicly."*). At the start of Ronin's next turn everyone sees the card appear on that crystal and crumble to ash; the crystal's normal colour returns. This **reveals where the trap was** after the fact, and replaces call 2's "nothing logged when wasted": the waste gets a public log line too. The lay stays hidden.
    - ⭐ *My call, flag if wrong:* **Ronin stepping on his own trap** (rule 5) and **an eliminated Ronin's trap being cleared** (call 3) crumble in public the same way: no one was affected in either case.
    - Port note: the engine needs a public record of the waste (sketch: `ns.trapWasted = { key, hexNum }` on the Ronin's sheet, cleared next turn start, read by `curseScene`) so every client draws the same crumble; today the waste is only in the turn-start report.

## ⭐ MY DEFAULTS (not ruled — flag if you want them different)

1. **v2's recommendations carry over:** ~~refresh only the unlifted notes, preferring Iwato notes the Rival holds~~ (no refresh: rule 16); pair purple with a pulse so it reads on the dark arena; several haunted notes in one melody lift together; `curseEnded` records *lifted* vs *expired* and the paper peels vs fades.
2. **Anything that moves or clears Lost Chords leaves an armed one alone**, the same as the pin rule. Verify every caller of `boardTokens` (drift, scatter, `battleFlow.js`, `marqueeSpaces.js`).

## Why it works with the board we have

- The board's notes are **Lost Chords** (`state.board.boardTokens`). Walking onto one runs `applyTokenPickedUp` / `bankLostChord` (client: `checkTokenPickup` in `rlsw-simulator-v3_8_1.jsx`).
- `applyTokensDrifted` already **pins** a Lost Chord that is a live unlock for anyone: it holds both its hex and its age. The armed trap uses the same rule. **That is also the trap's cover:** a note that doesn't drift is not proof of a curse, because pinned notes stay put too.

## Port cautions

- **Hidden information.** The trap's hex is in the shared, deterministic state, so every client has it. Only Ronin's client may draw it, and online play should not echo it anywhere visible (logs, toasts, the Spirit window, replays shown to others).
- **Bots must not see it.** The bot policies read the full state. A Rival bot must path as if the trap isn't there; a Ronin bot needs a rule for where to lay it (later).
- **Spring inside the pickup.** The curse must be applied in the same engine step as the pickup, so the bot path and the client path agree (the `SEQUENCING.md` §5.A family of bugs).

## The animation

Reuse `cursedShamisenVisuals.js` / `shamisenCurseSfx.js` / `cursedShamisenArena.js`:

- **Laying it (Ronin's screen only) — ⭐ NEW ANIMATION NEEDED (Alex, 2026-10-09).** The curse must show on Ronin's screen as he lays the trap, and none of the shipped moments covers it. Design it as its own preview first (the project's usual preview → dial-in → port). It needs two parts: **the laying** (a one-off moment when he picks the Lost Chord) and **the armed look** (what the cursed note looks like to him until it springs or fades). Sketch ideas only, nothing ruled: a few shamisen notes from the cast score as he points; a hitodama wisp drifting from him to the note and sinking into it; the Lost Chord darkening to purple/black with the 呪 glyph turning inside it; a slow, low pulse while armed so he can find it again. Others see nothing at either stage.
- **Springing (everyone sees):** the hush and bell, the cast melody, three ghost notes rising from the hex to the Rival, the 呪 paper attaching. This is v2's cast moment, moved to the trigger.
- **Persist / each lift / full lift / expiry:** as v2.
- **Wasted:** ~~only Ronin sees the cursed look fade off the note~~ → **everyone sees the noroi card crumble to ash** (rule 18).

## What this retires or changes in the shipped port

*(Verify each in code before deleting.)*

- **Retire:** the Take up rail action, `ns.shamisen = { strings, ready, root }`, the STRINGS row and Tab's third destination, `clickNoteStock` dest `'strings'`, `stringOctaves`, `startTurnNotes` flipping `ready`; the **cast on a Rival within 3 hexes** (no target, no range).
- **Keep:** the rail button (now "lay the trap": pick a Lost Chord), the Action Token, `canFire` + the 2-round cooldown, `rivalNs.iwatoCurse`, `livePalette`, `CursedWheel` / `cursedWheelModel`, `cursedShamisenArena`, `shamisenCurseSfx`, the cast score, `curseEnded`.
- **Add:** the new laying + armed animation (above), an armed-trap record (sketch: `board.shamisenTrap = { hexNum, by, laidRound }`; the curse root is read from the token's note when it springs), the pin in `applyTokensDrifted`, the spring in the pickup, Ronin-only rendering.
- **Change:** the curse state to v2's shape (sketch: `{ turnsLeft: 3, root, targets, lifted, by }`, `root` = the trapped note's pitch; `livePalette` reads Iwato on `root`); the exorcism in `commitMelodyEconomy` to per-note lifts; `startTurnNotes` to split the guaranteed slice between the cursed wheel and their palette, ⅓ then ⅔ (rule 16).

## Tests to add or update

`test:shamisen`, `test:shamisenjourney`, `test:cursedshamisen`, `test:abilitydemo` (the loadout pop-out still shows the strings flow). New checks: the trap holds its hex through a round end; it expires at the start of Ronin's next turn; the Action Token is spent either way; cooldown starts on laying; no second trap while one is armed or a curse stands; Ronin's own pickup disarms it; a Rival's pickup banks the note **and** curses; a bot doesn't avoid the trap; other clients don't render it; the cursed draw's guaranteed slice is ⅓ then ⅔ Iwato (rule 16); the cursed wheel is Iwato on the trapped note's pitch (not Ronin's key); the three targets are distinct, from ♭2/4/♭5/♭7 on the trapped note's pitch, and never the root; the springing turn's melody is scored cursed and counts as turn 1; an unsprung trap is an ordinary drifting Lost Chord again; KO doesn't end the curse; plus v2's checks (distinct creepy targets, accumulation, no refresh, round-3 end, multi-note lifts, `curseEnded`). Mutation-test the pin, the spring and the accumulation.

## Docs to touch when it's built

`RONIN_ABILITY_DESIGN.md` §2.3.00 (mark superseded) and the §1 table row, `STATE_OF_PLAY.md` Shamisen row, `SEQUENCING.md` §A, the Systems Map, the skill-tree description string and `AbilityInfo` text, the loadout pop-out (`abilityDemo.js` `buildShamisen`).

## ✅ As built (2026-10-09) — and the calls made during the port

**Where it lives.** Rules: `engine/systems/iwatoCurse.js` (`layCheck`/`layPatch`, `springOutcome`, `liftOutcome`, `endCursedTurn`, `orphanedTraps`, `curseScene`); the haunted draw and constants: `board/cursedShamisen.js` (`CURSE_TURNS` 3, `CURSED_DRAW_SHARE` 0 · ⅓ · ⅔ / `cursedDrawShare`, `HAUNTED_NOTES` 3, `CREEPY_IVS`, `CREEPY_WEIGHTS` ♭2 3 · 4 1 · ♭5 3 · ♭7 1, `pickHaunted`, `hauntRand`); the trap on the Ronin's sheet (`ns.shamisenTrap = { hexNum, note, key }`, not on the board); the pin in `board.js` `applyTokensDrifted`; the wasted trap and the seeping cursed draw in `turnFlow.js` (`randomNoteBlend` in `music/cadence.js`); the lifts in `melodyCommit.js`; the spring in the client's `checkTokenPickup` **and** the headless `policies/transition.js` `collectPickups`; the arena springs on the hex (`cursedShamisenArena.js`, `pointFor`); the wheel marks the haunted notes (`CursedWheel.jsx`: black, a breathing violet ring, ✓ when lifted).

**Calls I made (not Alex's — say if any should change):**
1. **The haunted notes are seeded from the curse's own key** (`hauntRand`), not the match's random stream — every client and the bench agree without a new draw in the stream.
2. **Nothing is logged when the trap is laid** ~~or wasted~~ (the waste is public now: rule 18), and a mis-click while picking says nothing — the trap is hidden. Rivals can still see the Ronin's cooldown tick. The spring IS logged (public).
3. **An eliminated Ronin's armed trap is cleared** at the next turn start (his "next turn" never comes); a curse already sprung runs on.
4. **A Rival who already carries a Shamisen curse** (a mirror match) and takes a second trapped note: the trap fizzles, no second curse.
5. **The trap is drawn for "the Ronin's screen"** = online, the seat this client plays; hot-seat, the Ronin's own human turn. The hex is in every client's state (deterministic engine), so online it is hidden by rendering, not by data.
6. **The cursed wheel's readout** counts lifts (n/3), how many haunted notes the hand holds, and turns left — it does not name the notes (the wheel marks them).
7. **The loadout pop-out** (`ui/abilityDemo.js` `buildShamisen`) — ✅ updated 2026-10-09 to the noroi card: see "The loadout pop-out" below.

**✅ RULED (rule 15, 2026-10-09) — was: ⚠️ Found while building:** the turn order is chord → melody → **move**, so a Rival who springs the trap has **already played this turn's melody**. Counting the springing turn as cursed turn 1 (rule 13) therefore gives them **two** cursed melodies, not three — and the round-2 refresh lands right before the first of them. If that turns out too soft, the alternative is to start the 3-turn clock on their NEXT turn.

**Also found:** the spring's sound threw with no audio context (a headless run) and, sitting before the pickup, cost the pickup itself — the theatre is now guarded (`try`), so a sound can never cost a note.

## ✅ Rules 15 + 16 built (2026-10-09)

- **Rule 15** needed no rule change in code (`CURSE_TURNS` 3, springing turn counting). Comments, the skill text and the tests now say "two cursed melodies".
- **Rule 16:** `board/cursedShamisen.js` `CURSED_DRAW_SHARE` = [0, ⅓, ⅔] by cursed turns already behind them, read by `cursedDrawShare(turnsLeft)`; `music/cadence.js` `randomNoteBlend(cursed, own, share, pool, rand)` (one `rand()` per note, as before, and share 0 draws exactly what an uncursed sheet draws); `turnFlow.js` uses it and reports `curseDrawShare`.
- **Refresh removed:** `turnStartCurse`, `REFRESH_AT_TURNS_LEFT`, the curse's `refreshed` field, `report.curseRefreshed`, the client's "the ghosts shift" log, and `pickHaunted`'s `prefer` option.
- **Tests:** `test:shamisen` 113 (§1 the numbers, §8 no refresh, §9 the seeping draw: exact slices at each stage, share 0 = uncursed, the measured rate matches the formula); mutation-tested 3/3 (the share table, the slice comparison, the turnFlow wiring). `test:shamisenjourney` 26 (the haunted notes on their 2nd cursed turn are the ones that sprang; the count varies by which branch the hand takes). `test:cursedshamisen`, `test:turnflow` 73, `test:stockdraw` 73, `test:notetechniques` 50, `test:determinism` 20, `test:spiritsheet` 75, `test:loadoutui` green. `test:abilitydemo` 143 + the same red as before (the old preview lever). ESLint: nothing new.
- ⏳ **No on-screen cue yet** that the curse is seeping into the draw. Worth a look in the playtest.

## 🪤 The noroi card preview (2026-10-09) — rules 17–18 on screen, ✅ dialled in and ported (below)

- **The card:** `src/board/noroiCard.js` (new, game-ready): `NOROI_CARD` (the levers), `createNoroiCard` (`lay` · `arm` · `spring` · `crumble` · `setShown` · `update` → events `stuck` / `shown` / `peel` / `landed` / `burnStart` / `burnt` / `done` + the crystal `tint`), the pure timelines `springPlan` / `ashPlan`, and `burnMap`. It is the curse's own 呪 paper (`cursedShamisenVisuals.js` now exports `ofudaTex`), always turned to face the viewer.
- **The burn** uses no shader: three layers on one fluttering plane share a noise burn map with stepped alpha-tests (paper → black edge → glowing edge), with ash flakes and embers leaving from the burning edge.
- **The spring hand-off:** the card hangs beside the ghost shamisen while it plays, flares on each note of the cast, and lands on the Rival at exactly the cast's `slapAt`, where the curse's own charm takes over. One paper, no swap visible.
- **Who sees what is the caller's job:** `setShown(false)` on a Rival's screen during the lay and while it's armed. The spring and the ash are public, and `seen` says whether this viewer already had it on screen (if not, it pops in). During the ash the crystal turns violet for everyone (rule 18).
- **Small helper:** `lostChords.js` `floatAt(num)` (where a live crystal floats, for the card to stick to).
- **Page:** `.scratch/noroi-card-preview.html` + `.js` in the real arena with the game's files (`npm run dev:noroicard`; `npm run build:noroicard` → standalone + `.artifact.html`; published as the claude.ai Artifact **Noroi Card Trap**, https://claude.ai/artifact/WrX6LtTDupF2JzsiHGs27K). A viewer switch (Ronin / Rival), ▶ Sprung / ▶ Wasted stories, the four moments one at a time, a mock log (the lay line is his only), 35 levers, dial-in copy. Checked headless (SwiftShader): every moment plays through, 0 page errors (a NaN in the flutter on the pinned top row was found and fixed).
- **Dial-in (Alex, 2026-10-09):** 2 of 35 levers moved: `glyphGlow` 1.1 → 0 and `floorRing` 0.55 → 0. The 呪 is the paper's own ink with no glow (so no flare on the cast's notes either), and there is no ring on the hex. Now `NOROI_CARD`'s defaults; the Artifact is republished with them.

## ✅ The noroi card in the game (2026-10-09)

**Engine (rule 18, public ash):**
- `iwatoCurse.js` `ashPatch(trap, how)` clears the trap and writes `shamisenAsh = { key, trapKey, hexNum, note, how }` on the Ronin's sheet: his last trap that caught no one, kept until the next one overwrites it, like `curseEnded`.
- It is written on all four paths: `'wasted'` (`turnFlow.js`, his next turn start), `'disarmed'` and `'fizzled'` (`springOutcome`, so the bench's `collectPickups` writes it too), and `'orphaned'` (the client, for an eliminated Ronin).
- `curseScene` now returns a public `ashes` list. Replaces call 2's silent waste.

**Arena (`cursedShamisenArena.js`):**
- Drives one `createNoroiCard` per trap, on the foreground with the crystals.
- Reads three new frame fields:
  - `trap`: this seat's own trap only. The client passes `myTrap`, so a Rival's arena never has it. A new trap is thrown from his standee; one already armed when the arena mounts is shown stuck.
  - `curses`: a new curse brings the card out of the crystal's real shatter. The Lost Chord layer's new `onShatter` fires when the standee actually lands. The card rises beside the ghost shamisen and lands on the Rival at the slap.
  - `ashes`: the card burns, and the crystal under it glows violet for every seat while it does. A hunt crystal gets its own colour back.
- A seat that had the card on screen sees no pop-in: `wasShown` is read before the engine's clear.

**One clock (`NOROI_SPRING_CAST_DELAY_MS`, 1000 ms):** the ghost shamisen's cast now starts after the hop and the shatter, and the client delays `scheduleCast` by the same constant, so the score and the picture start together. A curse found already sprung on a fresh arena (a reload) is drawn as it stands.

**Client:**
- `shamisenAshTheatre` writes the public log line and plays the burn's crackle (`burnOut`, timed to `ashPlan`) for wasted, disarmed, fizzled and orphaned traps.
- The orphan clear writes `ashPatch(…, 'orphaned')`.
- 2D keeps its dashed violet hex. There is no card in 2D.

**Tests:**
- `test:shamisen`: 123.
- `test:cursedshamisen`: 132 + 44. The arena stage gained §6 (the card: thrown, hidden on the next seat in hot-seat, stays through the hop, waits for the shatter, cast at +1000 ms, lands, gone) and §7 (the ash: no replay on a late join, his own card burns, the crystal tint and its exact restore, the pop-in for a seat that never saw it, no double burn).
- Mutation tests: 6/6 caught.
- `test:shamisenjourney`: 26.
- Device sweep: **97/101**. The 4 failures are the same ones as before (`abilitydemo`, `bats`, `bushido`, `swing`).
- `test:arch` is green (a `noroiCard.js` row was added).
- The real `mountArena` + `arenaFrame` rendered headless: thrown, armed on the F♯ crystal, sprung beside the ghost shamisen, the charm on her. No page errors besides unrelated missing art.
- ⚠️ The monolith's ESLint run is killed for memory on the device VM; the touched modules are clean.

**⏳ Not done:**
- The camera does not turn to the spring yet.
- A bot Ronin never lays a trap.
- Not yet played by Alex.

## ✅ The loadout pop-out (2026-10-09)

Alex: *"What about the menu play window - I suppose this needs to be updated as well?"* The ability pop-out now tells the noroi card's story with the game's own files (`createNoroiCard`, `createLostChords`, `createCursedShamisenVisuals`), from the Ronin's seat:
- The card is thrown onto a D crystal between them, and the crystal turns violet.
- Then one of three endings, taking turns loop by loop (`SHAMISEN_ENDINGS`):
  - **lifted:** she hops on, the crystal shatters, the card comes out beside the ghost shamisen and lands on her as the charm, a ghost lifts, and all three lift.
  - **expired:** the same spring, then the curse runs out.
  - **wasted:** nobody takes it, and the card burns to ash in front of everyone.
- The timing follows the arena's clock: the shatter, then the cast at `NOROI_SPRING_CAST_DELAY_MS`.
- 📌 The pop-out draws the card at size 1.3 (the charm's size on a Spirit) instead of the dial-in's 0.9, because on a crystal at pop-out size it is only a few pixels. This is the same call as the HUD dice.
- The captions, the end card and the skill-tree text now name the noroi card and the public ash.

Tests:
- `test:abilitydemo` 149, with the same single failure as before (the old preview lever).
- `test:shamisen` 123 and `test:loadoutui` green.
- Seen headless on a frozen clock (`.scratch/noroiDemoProbe*`): thrown, stuck and violet; burnt to nothing; the hop, the shatter with the card out, the card beside the shamisen, and the charm on her.

