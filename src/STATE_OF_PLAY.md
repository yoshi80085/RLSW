# 🧭 STATE OF PLAY — the whole game, current truth only

> **READ THIS FIRST. It is the entry point for every session.**
>
> ⚠️ **CURRENT TRUTH ONLY — NO HISTORY, NO REASONING.** Why a thing is the way it
> is lives in its own design doc; what it *taught us* lives in `SEQUENCING.md` §B.
> **This file answers one question: what is true right now?**
>
> 📌 **Written 2026-09-04**, last updated **2026-09-17** (the auto camera v2 and the 3D move tiles; earlier: the Ronin's palette and amp voice, the weighted note draw, the beginner finder), when the design set
> reached 37 files and 222,000
> words and no single view of the game existed. Keep it short or it stops being
> read — if a section needs a paragraph, it belongs in its own doc with a link
> from here.

---

## 1. 🎸 WHAT THE GAME IS

A **music-battle board game**. Spirits move on a hex stage, attack, pick up notes,
and **commit melody lines** that pay a crowd. Fame decides the winner. The
audience is *"the ultimate beginner"* — someone who does not read music.

**Four pillars**, and each Spirit is meant to own one and bend a rule of it:
**Movement · Combat · Melody Line/space · The crowd.**

---

## 2. 🎭 THE ROSTER — 4 Spirits, and only 2 are settled

| Spirit | archetype | state |
|---|---|---|
| 🗡️ **Shredding Ronin** | Burst / virtuoso | **Respec partly shipped:** Shukuchi, Bushido and Shadow updates built; Shamisen siphon pending. §3 |
| 🌀 **Intergalactic 0** | Control / zoner | ✅ **Done and shipped.** 5 abilities, all priced and cooled. 🪦 **But his Freestyle innate is CUT 2026-09-09** and nothing replaces it — `MELODY_IDENTITY_DESIGN.md` §11.1 |
| 👹 **Metalness Monster** | Bruiser | ⏸️ **ON HOLD pending redesign.** ⛔ His 4 abilities have **no cooldowns at all** |
| 🎀 **Glamarchy** | Star | 🪦 **BEING CUT.** 🐀 Riff Rat proposed as her replacement — ⁉️ **never formally decided** |

⛔ **THE ROSTER IS AN OPEN QUESTION AND EVERY BALANCE SHEET DEPENDS ON IT.**
`RIFF_RAT_DESIGN.md` §0 *proposes* the swap and implements nothing;
`MELODY_IDENTITY_DESIGN.md` already assumes Rat is in and Glamarchy is out.
**Make it a decision or those docs are built on a roster the game does not have.**

---

## 3. 🗡️ THE RONIN'S KIT — respecced 2026-09-04, partly shipped

Spec: `RONIN_ABILITY_DESIGN.md` §2. Build order: its §8.1.

| ability | verb | state |
|---|---|---|
| 🌀 **Shukuchi Arpeggio** | a step that leaps **2 hexes** and clears everything between, **up to 3 per turn, 1 AP each**, any direction; every landing picks up | ✅ **DONE — HEADLESS *AND* IN THE CLIENT, 2026-09-04e.** `test:shukuchi` 68 · `test:shukuchiui` 80. Button, ring-2 targeting, arcs, hover ghost, budget rail. 🎯 **Out of `BOT_CLIENT_GAPS`** — the bench and the played game agree about it again |
| 🗡️ **Psycho Bushido** | draw on a rival **3–5 hexes** directly in front, ⭐ **+2 / +3 / +4 Drive across the window**, **3 AP flat**, **−2 off the Drive stack**, and ⭐ **any body in the lane stops it** | ✅ **BUILT HEADLESS AND IN THE CLIENT.** `test:bushido` **108**. Lane geometry, the pre-Swing payment **and now the blocker set** (`bushidoBlockers`) all come from `engine/systems/bushido.js`. ✅ **The three-way occupancy split is CLOSED 2026-09-05** — click, highlight and searcher read one set. 🚩 **A draw costs up to 4 stack notes** — 2 for the ability, 2 for the Swing. 🎨 **Lane overlay shipped at Alex’s screenshot settings** — `ui/BushidoOverlay.jsx`; `test:bushidoui` 331 checks, plus real client arm/cancel coverage |
| 👤 **Shadow Illusion** | body double, **2 turns**, drinks Sustain | ✅ **DONE 2026-09-04f.** CD 3→4, per-use 2→1 Db, duration 3→2. `SHADOW_ILLUSION_TURNS` hoisted out of the monolith. ⚠️ §6.3's rider rides with it: the duration was cut with all three pop conditions still live |
| 🎸 **Cursed Shamisen** | ⭐ **SIPHON** — Swing-area, pick a rival's ability; if recharging, they are pushed **+1** and Ronin's cooldowns drop by **N** = turns it had left | 🚨 **a different ability entirely from what ships** |
| 🎵 ~~Wa no Koe~~ | — | 🪦 **CUT, AND DELETED 2026-09-04.** Gone from kernel, client, data, bot and 3 suites. `melodyCommitCheck` §13 is now the revival guard. The **12 Db mastery slot is empty** |

⛔ **The siphon cannot ship before cooldowns are universal** (§4), or it does
nothing against Metalness. That is the one hard ordering constraint in the kit.

🎸 **His sound (2026-09-16):** plays **Hirajoshi + P4** (§4) through the **KATANA**
amp voice — `audio/ampVoice.js` `RONIN_LEAD`, commit endings bend up a whole step.
⏳ **Built on first-guess numbers; Alex's dial-in is pending** on
`.scratch/ronin-tone-preview.html`. Port whatever he lands on into `RONIN_LEAD`.

---

## 4. ⚙️ RULES IN FLIGHT — decided, not yet true in the code

| rule | decided | built? |
|---|---|---|
| Every ability costs **≥1 Db per use** | 2026-08-22 | ✅ 7 of 13 |
| Every ability has a **cooldown** | 2026-08-22 | ✅ 7 of 13 |
| ⭐ **Every Spirit gets a cooldown; most land at 3–4 turns** | 2026-09-04 | ⛔ **not built — and the siphon depends on it** |
| ⭐ 🌀 **Shukuchi's hops jump OVER everything** — units, hazards, walls, slime | 2026-09-04 | ✅ **BUILT.** ⚠️ Knowingly a hard counter to area denial; the accepted brake is the **AP bill**, not a hazard exception |
| ⭐ 🌀 **A hop costs 1 AP, like a step** — 3 hops = 3 of his steps | 2026-09-04 | ✅ **BUILT.** 🎯 This one line is the whole balance of the ability — it replaced *"it IS the movement turn"* |
| ⭐ **Shukuchi's 1 Db is charged PER ACTIVATION** — hop 1 pays the Db and starts the clock; hops 2–3 are free | 2026-09-04 | ✅ **BUILT — and now decided, not merely shipped.** §2.5.0a is closed |
| ⭐ **A hop is TARGETED, one click per hop** — not a mode you toggle; walking may be interleaved | 2026-09-04 | ✅ **BUILT 2026-09-04e.** The rail arms it, ring 2 lights, and it stays armed between hops |
| ⭐ 🗡️ **Bushido pays +2 / +3 / +4 across its 3–5 window** — the window is the legality rule, the ladder is the payout | 2026-09-04e | ✅ **BUILT 2026-09-04f.** The window is a **refusal**, not a poor payout — with a flat AP bill, "bad" would have been "free" |
| ⭐ 🗡️ **A draw costs 3 AP flat and 2 off the Drive stack** | 2026-09-04f | ✅ **BUILT.** ⚠️ The stack spend takes from the **FRONT**, like every other Drive spend in the game — so it *re-points what he is hunting*, which is `stackSlots.js`'s own documented mechanic |
| ⭐ 🗡️ **Any body stops Bushido's lane** — a spirit, an amp or his own 👤 decoy | 2026-09-05 | ✅ **BUILT.** One `bushidoBlockers` set for the click, the highlight and the searcher, which had three different answers. ⚠️ The **click got stricter** — a shot that worked yesterday can be refused today. 📌 A body at 3–5 is not a screen, it is a *nearer target*, paid its own rung |
| ⭐ 🗡️ **The lane's glow carries the PAYOUT, and shows only when armed** | 2026-09-05 | ✅ **BUILT.** Screenshot-selected blue-to-pale +2/+3/+4 ramp, dim run-up, stop bar, widening spine, labels and target ring. Hidden until armed and usable. |
| ⭐ **The flat unlock number is 6 Db** — every ability, every Spirit | 2026-09-04f | ✅ **BUILT.** All 13 arsenal prices flattened from a 6–14 spread. `test:skilltree` and `test:bushido` both guard it |
| ⭐ **Every base ability costs the SAME to unlock** | 2026-09-04 | ✅ **BUILT 2026-09-04f** — the number is **6**, and the uniformity is asserted rather than left to good manners |
| ⭐ **Every seat starts with ONE ability already active** | 2026-09-04 | ⛔ not built |
| ⭐ **Upgrade prices rise per ability** (depth costs more) | 2026-09-04 | ⛔ not built — ⁉️ **and its SHAPE is still open** (+2/step? doubling? a cap?) |
| Innate passives are **out of scope** for both rules | 2026-08-22 | ✅ n/a |
| ⭐ 🎲 **THE FAN-DRIVEN SONIC DIE LADDER IS CUT** — `sonicDieSides` and `peakCasuals` deleted; both sides roll a **d6 baseline** and only the COUNT varies (the chord's job) | 2026-09-15 | ✅ **BUILT.** R5 — runaway risk. 🎯 Half of one change: the ladder was what Casual fans bought, so it ships with the fan-weight restore below. ⚠️ **The charge-zone `+2` die bump SURVIVES and R8 says it should not** — charge should raise the FLOOR, never the roof. That is Phase 2 item 2, ⛔ **not done**, flagged at the site |
| ⭐ 🎤 **FANS PAY FAME AGAIN** — `FAN_CASUAL_WEIGHT` 0 → **0.12**, `FAN_MULT_CAP` 3.0 → **5.0** | 2026-09-15 | ✅ **BUILT.** The numbers were already derived in `gameConstants.js`'s own 2026-09-02 comment block and walked back anyway, because the per-turn cap made them unusable. 🎓 **The comment and the code disagreed for two weeks and only the comment was true.** ⭐ Restoring this FIXED an already-red assertion in `evalCheck` — *"more fans → higher multiplier term"* — which had been failing because fans did nothing |
| ⭐ ✨ **THE POSE CEILING RIDES THE MODE** — `POSE_FP_MAX_ROUNDS = Infinity` | 2026-09-15 | ✅ **BUILT.** 🐛 `POSE_FP_MAX`'s own comment claimed it *"matches `FAME_PER_TURN_CAP`"*, and that match broke silently the day `FAME_PER_TURN_CAP_ROUNDS` was added: the riff cap learned to follow the mode, the pose ceiling never did. In a round-limited match every other Fame source ran uncapped while a maxed pose stayed pinned at **4**. 🎓 **A constant defined as "matches X" does not follow X — it copies X once, and the copy rots** |
| ⭐ 🎼 **CLEAN IS THE SPIRIT'S OWN MODE** — one palette per Spirit, derived from nothing | 2026-09-09 | ⛔ **not built.** The whole melody-identity decision is `MELODY_IDENTITY_DESIGN.md` §5⃣.0 |
| ⭐ 🪦 **`modeFromStack` IS DELETED** — no major/minor derived from the Drive Stack | 2026-09-09 | ⛔ not built. ⚠️ **Not a one-line deletion** — touches `turnFlow.js`, note spelling, `canonicalRoot`'s split roots, `b0check`, `turnFlowCheck`, `selftest` and the client |
| ⭐ **DISCORD NOTES ARE INERT** — no Db, no fans, no power to resolve an ending | 2026-09-09 | 🟡 **fans half BUILT 2026-09-17** — discord breaks a fan shape (`spiritStyle.js`, every reader passes the palette via `notes.js` `paletteScaleFor`); the red/blue carrot needs a clean final. ⛔ The Db half is the next row. 🎯 Their only uses are **held for a later turn** or **spent as movement fuel** |
| ⭐ **Db LENGTH MUST COUNT CLEAN NOTES, NOT RAW LENGTH** | 2026-09-09 | ⛔ **not built, and MANDATORY** — `scoreTrackDB` step A is `floor(len/2) - 1`, blind to cleanliness, so junk still pays. Without this the decision above is decorative |
| ⭐ **FANS PAY FOR *HOW*; Db PAYS FOR *WHICH* AND *WHERE*** — asked at different moments, so they stop competing | 2026-09-09 | ⛔ not built. ✅ This is `MELODY_IDENTITY_DESIGN.md` §4's withdrawal, now decided |
| ⭐ **THE ENDING IS A FORK** — the Db boost **or** the red/blue Drive/Sustain carrot, chosen at commit | 2026-09-09 | ⛔ not built. ⚠️ Must not inherit the Harmonic Lock cliff — see §5.3 of that doc |
| ⭐ 🎚️ **DIFFICULTY CHANGES THE ASSIST, NEVER THE RULES OR THE SCORE** — beginner: one mode, colours on; unassisted: two modes, no colours | 2026-09-09 | 📇 **INDEXED, not built.** Rides `WIN_CONDITIONS_DESIGN.md`'s settings surface, which also has ⛔ no menu. ⚠️ The bot always plays unassisted, so every bench number describes expert play |
| ⭐ 🎼 **HALF OF EVERY NEW HAND NOTE IS GUARANTEED IN THE PALETTE, HALF IS CHANCE** — opening stock, turn refill and the Ronin's extra find note. Ronin 75% in tune, seven-note modes ~79% (was uniform: 50% / 58%). Chosen over a flat 75% for the variance | 2026-09-16 | ✅ **BUILT.** `STOCK_PALETTE_GUARANTEE` → `music/cadence.js` `randomNote`. `test:stockdraw` 73. ⚠️ Board tokens are NOT weighted (shared by everyone). ⚠️ Every Spirit's melody economy got richer and all bot benches before it are incomparable — recorded, not rebalanced |
| ⭐ 🗡️ **The Ronin's mode is HIRAJOSHI + the perfect 4th** — 1 2 ♭3 4 5 ♭6, six clean notes (replaces Lydian) | 2026-09-16 | ✅ **BUILT.** `music/melodyIdentity.js`; a new sheet takes it from `melodyModeFor`. `test:ronintone` 100 · `test:turnflow` · `test:b0`. Six clean notes, not seven — offset by the weighted draw above (75% in tune for him). The other Spirits' final modes are ⁉️ **open** |
| 🪦 **🌀 Intergalactic 0's Freestyle is CUT** | 2026-09-09 | ⛔ not built — still live in `melodyCommit.js` / `economy.js`. ⚠️ `attackParams.js:85` says "Freestyle" too and is a **different** mechanic; do not delete it with the pardon |
| ⭐ 🎤 **THE RIFF-OFF IS A BET, NOT AN ATTACK** — no Sustain, no shield, and it is powered by the **Melody Line**, not by Drive | 2026-09-14 | ⛔ not built — but ✅ **already half true**: the duel has never touched `sustainStack`, and `startRiffOff` already builds the riff from `committedMelody`. `PROJECTILE_COMBAT_DESIGN.md` §14 |
| ⭐ 🎤 **THE FIRST CALLER KEEPS THEIR ADVANTAGE** in an alternating duel — it is paid for in board position | 2026-09-14 | ⛔ not built. 🎯 Alex's ruling **closes** the three compensations that were offered (warm-up exchange, defender ante, end-on-completed-answer). §14.5 |
| ⭐ 🎼 **THE FIFTH PAYS MOST ON PURPOSE, AND FOR TWO REASONS** — it is the rock interval, **and it is stronger than the tonic to push players into changing chords often** | recovered 2026-09-14 | ✅ **BUILT — the number is live; the REASONS were not written anywhere.** 🚨 Reason 2 makes `endingDb` a lever on the **chord economy**, not melody flavour. `PROJECTILE_COMBAT_DESIGN.md` §14.9.3. ⛔ Its real home is a comment on the constant — not yet written |
| ⭐ 🎼 **NOTE STRENGTH = the line's own arithmetic, read twice** — dud 0 / plain 1 / strong 2 (inside the craft run) / **+ the ending value for the hook**, stacking where they overlap | 2026-09-14 | ⛔ not built. ⭐ **Hands decide IF a note fires, the melody decides what it WEIGHS.** §14.9 |
| ⁉️ 🎼 **The tonic rises from 1 to 2** | provisional 2026-09-14 | ⛔ not built, and ⁉️ **not settled** — Alex said *"2 times or so, 1.5 even"*. ⚠️ At 2 the tonic and the fourth become the same rung. §14.9.4 |
| ⭐ 🏆 **THE FAME RACE SURVIVES — rounds becomes the DEFAULT, the race stays selectable** | **2026-09-15** | ✅ **BUILT 2026-09-15.** One line in `state.js` — `winCondition` normalises to `'rounds'` unless `'fame'` is named. `test:winconditions` **87** (§1 inverted, §1b added to prove the race is still reachable).⚠️ **The blast radius is real and deliberate:** anything that used to arrive with `winCondition` undefined — old saves, bench harnesses, fixtures — now plays a 10-round set. `battleFlowCheck`'s Fame-economy fixture had to be pinned to `'fame'` or it asserted against Infinity. ~~⛔ not built.~~ ✅ **Closes `CORE_LOOP_REWORK_BRIEF.md` §2.4**, which was Phase 1's first blocker. ⚠️ **It is not a free answer:** `FAME_TO_WIN`, `fpPerLife`, `FAME_RACE_CONTESTED_LEAD` and `underdogBonus` all stay alive and must keep working once Fame runs in the **hundreds** (R3) — trap 8 notes `fpPerLife` becomes noise at that scale. 🎯 The large simplification is **declined on purpose** |
| ⁉️ Is 🌀 Blaster of Ra an ability at all? | — | ⛔ **OPEN — Alex's call.** It *replaces* the Smash, so pricing it leaves a Spirit with no basic attack |
| ⁉️ 🗡️ **What does the Swing DO to a shield?** Alex's *Smack-down*: *"still the big Vibe hitter"* | reopened 2026-09-14 | ⛔ **OPEN, and it is §5.3's closed decision proposed in REVERSE.** ⚠️ The session that reopened it ended up reworking the Riff-Off instead and never answered it. §14.8 |

🧊 **BALANCE IS DELIBERATELY DEFERRED while the kit is in flux** (Alex,
2026-09-04). Record imbalance, do not act on it. **Exception:** anything that
makes a thing *impossible* rather than weak is a bug, not balance.

---

## 5. 🏗️ SYSTEMS — what actually runs

**✅ BUILT AND UNDER TEST**

- 🌌 **3D cosmic arena** — full-width live scene with the approved space-saving HUD: a permanent player/resource pocket, phase rail, edge-mounted chord/melody controls, separate floating melody track, shallow Step 3 dock, and compact camera strip. Preview indigo materials, fractured island/fissures, planets, 48 rocks + seven shards, moving beams, live-tier cabinets and 3D movement/combat/hazard effects remain live. High detail forces full effects; Standard retains scenery; Auto reports its effective level. Left-drag orbits, right-drag pans, wheel zooms; simple clicks retain gameplay targeting. Stable controls survive 2D/3D switches. Ordinary characters/tactical overlays remain flat SVG without scene-depth occlusion. See `../docs/cosmic-arena.md` and `../docs/immersive-hud-handoff.md`.

- The engine kernel, board, combat, turn flow, economy — `test:all`, **28 groups passing** (⚠️ last full `test:all` was 2026-09-05 morning; the 2026-09-05 lane pass could not run it — see `SEQUENCING.md` §5-lane.E), including a DOM melody-to-next-turn journey
- 🕒 **The cooldown system** (`cooldowns.js`) — one map, one tick, one gate
- 🌀 **Shukuchi Arpeggio** — `shukuchi.js` + `ui/ShukuchiOverlay.jsx`. ✅ **Played, not just simulated.** `test:shukuchi` (the rule) and `test:shukuchiui` (the picture, an SSR diff against the preview). ⚠️ **Ronin bench numbers from 2026-09-04c/d were read against a client that could not take the hops the searcher planned** — they are not comparable with anything measured after this, and only a re-bench closes that
- 🏆 **Win conditions** — Legend Run + Battle of the Bands, headless, playable from `runMatch`. ⛔ **No menu, no HUD**
- 🎼 **Theory off the tree** — pardon ladder universal and free; stack seats 4–6 found on the board
- 🔦 **The hunt marker** — the hex holding your next seat lights up
- 🗡️👤 **The Ronin's respec** — `bushidoCheck.mjs` (`test:bushido`, **108**). The window, ladder, flat AP bill, Drive-stack spend, shared extraction contracts, Shadow constants, flat unlock price and ⭐ **the one blocker policy** — three of whose assertions read the CLIENT source, because that is where the split lived
- 🧱 **Refactor foundation** — app shell and crowd drawing extracted; Windows build/render verification restored; lint baseline enforced by `lint:baseline` (334 errors, 16 warnings). Ability/battle journeys, replay coverage and browser profiling remain open. See `docs/refactor-verification.md`
- 🔊 **The per-lap Sonic tally** — ⭐ **NEW 2026-09-15.** `noteStates[id].pendingSonicAttacks` is written by `combat.js` and now **cleared at the defender's OWN turn end** (`turn.js` → `applyTurnEnded`), so the window is one full lap of rivals at any player count. 🐛 **It was written and never read or reset** — a lifetime tally wearing a per-round name, which made `PROJECTILE_COMBAT_DESIGN.md` §3.5.1's turn-start shield bill a **doc-only rule the game never had**. ⛔ **Nothing CONSUMES it yet**; it is the input §3.5.1 and R12 both want, now correct instead of wrong. `.scratch/sonicTallyCheck.mjs`, 20 assertions, mutation-tested
- 🎨 **The Face button reads as available** — 🐛 fixed 2026-09-15. Idle was hardcoded at **2.15:1** against every other rail button's 12.04:1, and because `.arail .btn` builds its wash, bloom and left spine out of `currentColor`, the dim colour **put the lamp out** rather than merely greying the label. ⚠️ The inline override is gone entirely (Alex's call), so Face now wears `.btn`/`.btn.on` like Move, Sonic and Swing — **which surrenders the cyan `#44ccff` armed state** for `.btn.on`'s `#88bbff`. One prop restores it; the site says how
- 🎭 **The Spirits stand on the board as acrylic standees** — ⭐ **NEW 2026-09-18.** Each Spirit's own drawing, cut out of its art, given thickness and stood on a lit base: a neon edge in the Spirit's colour, a clear glass sheet behind the print, and one print seen from both sides (no mirrored art). ⭐ **Facing is the Spirit's own facing, and the FLAT ART is the direction** (Alex, 2026-09-18) — a Spirit walking toward you is a Spirit you are looking at, and the cut edge is what you see from the side. Nothing turns a standee toward the camera, so a rival's back is their back. ⚠️ `yaw = π/2 − facing`, a MINUS: the block pawn's old `facing + π/2` is that mapping mirrored, 90° out on every diagonal, and both pawn kinds now share one function. ⚠️ The one thing the camera may move is PITCH: under the near-overhead tactical view a sheet is a line, so it tips back 35° (`steepLean`, never yaw). Cut `tight` — everything in the art, so the Ronin's lightning is spurs of acrylic. `spiritMiniature`'s block pawns survive only as the fallback for a Spirit with no art. At **Alex's dial-in** (1 of 26 levers: height 2.6 → **2.8** world units, against a 1.86-wide hex). `board/standee.js` + `standeeOutlines.js` (traced from `src/standees/*.png` by `.scratch/trace-standees.py`). `test:standee` **93**, 16/16 mutants caught; the real `mountArena` driven headless with the real art, 12/12
- 🎥 **The 3D camera follows the action** — ⭐ **NEW 2026-09-17, reworked the same day (v2).** It stays on the acting Spirit: between actions it changes shot every **20 s** — a close shot (distance 19, tilt 44°), the Spirit's surroundings (it leans toward a rival within 9 rather than framing across the board), a low hero shot. A **move is a slow Ken Burns push-in** that keeps the camera's angle (−11% over 3.6 s, 9° pan, from distance 27). Battles and effects (lasers, pyro, falls, vortex, tentacle) still get their own shots, held 2.3 s. **The wide shot only comes after 60 s of quiet** (no action, new turn or camera grab), and then holds. ⚠️ **Calm by dial-in** (2026-09-18): swing 0.5, drift 0.5°/s, and **breathing OFF** — the slow 0.5°/s drift is the only idle movement left, so it moves, but barely. (Alex turned breathing off in a third one-lever pass the same day.) Dragging, scrolling, pinching or a camera button hands the camera to the player — **a click that picks a hex does not** — and it comes back 6.5 s after the last input. The Sonic shot still owns a volley. ☰ **Auto camera** switch (on by default, per machine); a toolbar badge shows *Auto* / *Yours · auto in N s*. Reduced motion: off. `board/cameraDirector.js`, Alex's dial-in, twice (2026-09-17 then the calmer pass 2026-09-18). `test:cameradirector` **87**. ⚠️ Built while the device shell was down — verified in the cloud on a full copy of the tree (`SEQUENCING.md` §A 26-camtiles)
- 🟪 **Move tiles you can actually see in 3D** — ⭐ **NEW 2026-09-17.** The hexes the acting Spirit (or its Shadow) can step to glow **magenta** with an outline in the Spirit's own colour, pulse, and lift under the mouse; the board dims slightly while a walk is armed; a row of **step pips** at the pawn shows steps left and greys out when spent. The old 9% white SVG fill is hidden once the arena is ready. `board/moveTiles.js`, fed by `arenaFrame`'s `reach` (the client's own `reachable` sets). Alex's dial-in; the "later this turn" tiles were turned off. `test:movetiles` **41**. Shukuchi's landing tint is unchanged (still SVG only)
- 🎛️ **A dial pops over the head of the Spirit whose Drive/Sustain changed** — ⭐ **NEW 2026-09-16.** In the 3D arena only; ticks on the pocket's timing, lingers 0.9 s, fades. ⭐ **Every Spirit's Drive and Sustain is now public** — a rival's Drive was shown nowhere before (Alex's call). `board/headDial.js` + `headDialVisuals.js`, fed through `arenaFrame`. Alex's dial-in (all 23 levers left at default). `test:headdial` **67**, and `test:arena`'s presentation suite still passes with the real GLB. ⚠️ Adjacent pawns' dials can overlap from the wide Arena camera — accepted in the dial-in. ⚠️ Same caveat as below: `test:all`, `check:bundle`, `lint:baseline` not run on the device
- ⏱️ **The Drive/Sustain dials TICK** — ⭐ **NEW 2026-09-16.** A change waits a beat, then steps one block at a time (white flash gained, red flash lost, the number counting along), capped at ~1.1 s for any jump; a turn handoff and reduced motion snap. `ui/dialTick.js` + `ui/ArenaDial.jsx`, Alex's dial-in (every lever left at its default). `test:dialtick` **43 + 19**. ⚠️ **Written while the device shell was down** — both halves passed in the cloud against copies with React/jsdom installed standalone; `test:all`, `test:arena`, `check:bundle` and `lint:baseline` **did not run**
- 🎯 **The beginner finder's BRAIN** — ⭐ **NEW 2026-09-16, headless only.** `engine/policies/playFinder.js` → `findBestPlays`: for Drive, Sustain, Db and fans, the best stack commits AND melody line a hand can make, scored only by the game's own readers. `test:playfinder` **819** (every play committed through the real `commitMelodyEconomy`; brute force on seeded small hands). ⛔ **No UI** — Alex's delivery is the fans saying what they want in **speech bubbles** (step 2: a `.scratch` preview). ⚠️ Db/fans are line-first by definition. 🐛 **Three bugs found beside it, none fixed** — `SEQUENCING.md` §A 21-finder: the style coach reads the START of the line as its "trailing" run (coach + bot); an **empty** stack fights at the sheet stat (Ronin Drive 8) while every chord is 1–5; a discord ending still pays the Sustain carrot
- 🎤 **The fans' speech bubbles + chord glow — ✅ IN THE CLIENT, beginner mode only** — ⭐ **NEW 2026-09-16.** Melody step: the acting human's own front-row fan says what to play next (neon bubble, Spirit colour, the next note pulses in the stock); chord step: the notes worth stacking glow red/blue. Hidden while a Pickles tip is open. 🎤 **Its own ☰ menu switch, *Fan hints*, since 2026-09-17** — separate from *Beginner tips*, so dismissing Pickles no longer mutes the fans (both start from the lobby's Beginner choice). The finder runs in a **Worker** (`ui/crowdFinderClient.js` → `engine/policies/playFinder.worker.js`). At **Alex's dial-in** (`CROWD_BUBBLE`: radius 12 · chips 22 · anchor = his stand · 950 ms before speaking · 1500 ms gap · glow breathes 1500 ms). `test:crowdbubble` **116** · `test:crowdcoach` **3,204** · `test:playfinder` **821**. Rendered beside the preview in Chromium: identical box (129×95), zero style differences. ✅ **2026-09-17: all suites run on Alex's machine**; coach bugs fixed (open-run contour, discord shapes, carrot). ⏳ **Playtest next** — `.scratch/crowd-coach-playtest.md`. 📌 Drive/Sustain usually want the same notes, so the glow mostly shows one colour — that's the *Glow source* lever at its default, and it's on the checklist.
- ⭐ **The flat unlock price** — `FLAT_ABILITY_UNLOCK_DB = 6`. 🎯 It deletes the variable behind `UPGRADE_SHOP_DESIGN.md` §1.1's central finding (arsenals bought in *price* order, not value order): with one price, the only thing left to choose on is what the ability does

**⛔ DESIGNED, NOT BUILT** *(8 docs say "design only")*

| what | doc | note |
|---|---|---|
| 💰 **The Db sink / upgrade shop** | `UPGRADE_SHOP_DESIGN.md` | ⚠️ **premise changed 2026-09-04**, R2/R3 superseded. ✅ **Rule 1 is now BUILT at 6 Db**, so §0⃣.3's first bullet is closed — the other three riders are not |
| 🎼 **Melody identity** (4 verbs) | `MELODY_IDENTITY_DESIGN.md` | blocked on the Db sink |
| ⭐ **Fame track redesign** | `FAME_TRACK_REDESIGN.md` | ✅ **BUILT 2026-09-16** — §12. 🎨 due a 3D-aesthetic pass |
| 👹 **Metalness rework** | `METALNESS_REWORK_DESIGN.md` | ⏸️ on hold — but now on the Ronin's critical path |
| 🐀 **Riff Rat** | `RIFF_RAT_DESIGN.md` | least resolved of any doc |
| 🕺 **Mocap → character animation** | `MOCAP_DESIGN.md` | ⛔ **blocked on a rigged character**, and on nothing else — it is off the §6 bottleneck entirely |

**⏸️ PARKED ON PURPOSE**

- 🤖 **The bot** — *"if I keep having to recalibrate how the bots think after every implementation, I'd be doubling my work"* (Alex). ⚠️ Every bench since 2026-09-02b reads a bot that does not know fans got better.

---

## 6. ⛔ THE BOTTLENECK, AND IT IS ONE THING

Almost everything open funnels through the same node:

```
   universal cooldowns  ──┐
                          ├──►  🎸 the siphon  ──►  the Ronin's kit
   👹 Metalness rework  ──┘                              │
                                                         ▼
   💰 the Db sink (upgrade shop)  ──►  🎼 melody identity  ──►  🤖 bot retune
```

🎯 **`METALNESS_REWORK_DESIGN.md` is parked and is now blocking the Ronin.** It
was a parallel arm until the siphon needed a rival with cooldowns to steal from.
**If the Shamisen is wanted before Metalness, that is a trade to make on purpose.**

💰 **The Db sink is the other node** — two docs name it a prerequisite. ✅ **And
half of it is now BUILT.** The flat-cost rule is real at **6 Db**, which removes
the measured *"bought in price order, not value order"* problem the shop existed
to solve. ⛔ **What is left of the node is DEPTH**: the rising per-ability ladder
has no shape and no cap, and until it does, a seat with surplus Db still has
nowhere to put it. 🎯 **The sink was never one problem — it was breadth and depth,
and only breadth was answered.**

---

## 7. 🎯 THE SHORTEST USEFUL NEXT STEPS

> 🚨 **0. ⭐ BUILD THE CORE LOOP REWORK — `CORE_LOOP_REWORK_BRIEF.md`. THIS IS
> THE JOB.** A long design conversation on 2026-09-15 ruled on the Sonic
> barrage, the Swing's identity, the Riff Off's trigger, the dice sources, the
> charge zones and the match's whole scoring shape. **22 rulings, 8 open
> questions, 6 phases, one brief.**
>
> ⚠️ **AND IT PARKS EVERYTHING BELOW THAT TOUCHES AN ABILITY** (Alex): *"the
> core loop needs to be strong and solid before we worry about the abilities
> that are meant to break it."* Items 5–9 of this list are **on hold** — they are
> not cancelled, and the roster question in §6 stops blocking anything while the
> freeze holds.
>
> 🎯 **Start at the brief's §0** — four changes that look independent are one
> lever pulled in sequence, and doing them out of order makes each look like it
> is breaking something.
>
> ✅ **§0's LEVER IS PULLED, 2026-09-15.** All four steps shipped together:
> rounds is the default → the per-turn cap has no job → the fan weights are
> restored → the Sonic die ladder is deleted. 🎯 They had to land in ONE pass:
> stopping after the fan restore would have left casuals paying **twice**
> (Fame multiplier *and* permanent die size), which is the runaway R5 exists to
> prevent.
>
> ⛔ **PHASES 2 (rest), 3, 4, 5, 6 ARE STILL OPEN** — the charge FLOOR rework and
> the marquee card, the barrage port, the Swing rewrite, the Riff-Off trigger,
> presentation.
>
> ✅ **PHASE 1's HUD HALF IS DONE, 2026-09-16** — rounds readout, lobby toggle and
> the Fame track's rework all shipped. `test:buzzer` **81**, `test:fametrack`
> **9 states**, `test:harness` back to green at **1816**.
>
> 🚨 **AND IT FOUND THAT THE CLIENT WAS NEVER PLAYING THE MODE.** The buzzer had
> no client path at all — `buzzerReached`/`buzzerVerdict` appeared nowhere in
> `rlsw-simulator-v3_8_1.jsx` — so the only surviving ending was a Fame crown
> firing on `startingLives × fpPerLife` (⭐18 at 4P), a target this mode does not
> have. With elimination off nothing else could end a match either.
> **Every match was ending as a Legend Run, roughly half-played** (measured
> leaders bank ⭐38–47 by round 10). `WIN_CONDITIONS_DESIGN.md` §8b has the
> anatomy.


🚩 **`test:b0` AND `test:bushidoui` ARE RED** (2026-09-18, and they pre-date that
session's work). `b0check.mjs:61` expects a seeded single note to read **Drive 3**
and the engine says **1** — the 1–5 chord-table rebase that is already an open
question on the board. `test:bushidoui` dies on `ENOENT: Claude outputs/bushido-lane-preview.html`.
⚠️ **`test:all` stops on the first red, so the full sweep does not currently run
end to end.** Neither is a balance item; both are a test disagreeing with the code.

1. 🎨 **Bushido lane port complete.** Recovered the saved preview and applied the three 2026-09-05 screenshots. `test:bushidoui`: 331 checks across 11 scenarios × 6 facings. `test:journey` verifies arm/cancel and turn handoff. Next engineering work: a completed client battle journey before extracting combat orchestration.
2. ⚠️ **STALE — THE RING BEAM IS PORTED.** `sonicZigzagVisuals.js` (72KB),
   `sonicRingCheck.mjs`, `arenaDiceSequence.js` and `combatDice.js` are all in
   `src/` as of 2026-09-15. 📌 The project doc `claude/sonic-volley-rework-handoff.md`
   is stale the same way. ⛔ **What remains unported is the contact push-in**, which
   still has no home in `stageSonicCamera` — `RING_BEAM_BRIEF.md` §4. The original
   entry follows, kept only so the claim can be traced:
   ~~🔊 **Port the Sonic ring beam** — ⭐ **the projectile is DECIDED** (2026-09-13, off a live preview; `PROJECTILE_COMBAT_DESIGN.md` §12.1c). ⛔ **Nothing is in `src/` yet.** The whole sonic rework — readable dice, the player-pressed ROLL gate, the camera fix and now the beam — is drafted and checked in `.scratch/sonic-rework/`, and the one-pass build brief is that folder's `RING_BEAM_BRIEF.md`.~~
3. ~~🎼 **Name the ending constant, and write Alex's rationale onto it.**~~ ✅ **DONE 2026-09-15.** `music/melodyPayout.js` → **`ENDING_DB`**, exported, carrying both §14.9.3 reasons, §14.9.5's one-number-two-jobs cost and §14.9.4's unsettled tonic in the comment above it. Rename verified behaviourally inert — `.scratch/endingDbCheck.mjs`, **28,807 assertions, 0 failures**, old ternary vs new map over 9,600 random lines × 8 keys × 3 Spirits. Indexed in `ARCHITECTURE.md`'s export row **and** its "where do I change X?" table. 🎯 **The tonic number (§14.9.4) may now move safely** — the thing that had to happen first has happened.
4. 🎤 **Decide the Riff-Off's wager, then its knockback** — ⭐ **NEW 2026-09-14**, `PROJECTILE_COMBAT_DESIGN.md` **§14**. ✅ §14.9 now answers the *strength* half — dud/plain/strong/hook, all from arithmetic the commit already performs, with the duel reading the craft run's **length** while the Fame route keeps its cap. ⁉️ **Still open: what surviving collision weight actually does**, and the tonic's number. The duel is settled as a *bet* powered by the **melody line**, and the first-caller ruling is Alex's. ⁉️ **What is actually at stake is not decided** (§14.6) — a melody is spent, paid and cleared before the duel begins, so the row has no cost column. 🚨 **And §14.7 is a blocker, not a balance item**: `riffSkill` has no tempo term, so an escalating duel makes bots immune to its own difficulty ramp. **Answer that before building escalation.** 📌 Two cheap verifications first: does anything actually clear `committedMelody` (§14.5), and is the melody's Fame paid before `startRiffOff` reads the stash (§14.6)?
5. 🤖 **Re-bench the Ronin** — **OVERDUE THREE TIMES NOW.** Every Ronin number from 2026-09-04c/d was taken while the client refused hops the searcher planned; his whole kit changed shape again on 2026-09-04f; and on 2026-09-05 the lane rule changed what the searcher may plan at all. Nothing but a re-run is comparable with anything.
6. 💰 **The three riders on the flat number**, now that the number itself is 6 and built. Filed only as prose in `UPGRADE_SHOP_DESIGN.md` §0⃣.3: ⁉️ is the free starting ability free later · ⁉️ what shape is the rising ladder, and is there a cap · ⁉️ do per-use costs flatten too (assumed **no**, and `test:bushido` asserts the assumption so it cannot drift silently).
7. ⚠️ **Re-price the two abilities the flat rule made cheap.** ☀️ Sunbeam went 14 → 6 and 💀 Azrael 12 → 6. §1.2 named them as barely-seen content; they are now *the same price as everything*, and the first trace after the change shows 🌀 Blaster of Ra being saved for where it never was. 🧊 Not a rebalance — a **measurement** to take once the bench is re-run.
8. **Decide the roster** — Glamarchy out, Riff Rat in? Two docs already assume yes.
9. 🚨 **Answer the Ronin ledger** — `CHARACTER_HANDOFF.md` → "THE RONIN LEDGER". Four passes made him weaker and each deferred the compensation to the next. ⚠️ **Shukuchi is now built, which does NOT close it** — it is a 6 Db mobility tool where a 12 Db payout used to be, and the 12 Db slot is still empty. 🧊 §B10 does not cover this: it is a slot question, not a balance tweak.
10. ~~🪦 Delete Wa no Koe properly.~~ ✅ **DONE 2026-09-04.** · ~~🌀 Build Shukuchi.~~ ✅ **DONE headless 2026-09-04.** · ~~🖥️ Port Shukuchi's overlay.~~ ✅ **DONE 2026-09-04e.** · ~~🗡️👤 Step (c), the respec.~~ ✅ **DONE 2026-09-04f.** · ~~💰 Pick the flat unlock number.~~ ✅ **6, DONE 2026-09-04f.** · ~~🗡️ Give Bushido's lane one blocker rule.~~ ✅ **DONE 2026-09-05.**

---

## 8. 🗺️ WHERE EVERYTHING LIVES

| you want | read |
|---|---|
| **what is true right now** | 🧭 **this file** |
| what happened, and what it taught | `SEQUENCING.md` (§A live, §B findings, §C index) |
| the full history | `docs/archive/SEQUENCING-full-through-2026-09-04.md` |
| where code lives / "where do I change X?" | `ARCHITECTURE.md` — 🎯 the only machine-checked doc |
| the game explained from scratch | `GAME_BRIEF.md` |
| a Spirit's kit | `CHARACTER_HANDOFF.md`, then the per-character design doc |
| **a half-formed idea** | 💡 `IDEAS_INBOX.md` — put it there, not in whatever doc is open |

⚠️ **The design docs are not machine-checked and drift.** `ARCHITECTURE.md` is the
only one a suite verifies. Read the rest with suspicion, and when one is stale,
**say so plainly rather than editing around it.**
