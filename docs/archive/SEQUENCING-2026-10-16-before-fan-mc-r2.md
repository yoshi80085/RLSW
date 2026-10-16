# SEQUENCING §A as it stood on 2026-10-16, before `74-fanmc2`

Moved here unedited when the next handoff took §A (CLAUDE.md: §A is ONE handoff).

## 73-fanmc. 🎤 The fan MC announces the stage effects — in the game — 2026-10-15

**Alex:** before a stage effect, someone gives the standings, a replay if a good riff-off happened, then calls the effect *"so it just doesn't 'randomly' come into being"*. Not the Rock God (*"The King at a Joust … has a servant do the job … We kind of have an MC built out already - he lives in the wallpaper … Lets use him. Lets give him a mic."*). Previewed r1–r4 (mic out of his head, a Fame **bar chart**, a TV that drops and replays the last seconds, *"the energy ball building up … and being blasted forth"*), then his rulings: *"have the replay only play if its a 20 round game - and play at the last appearance of the MC"*; dial-in 5 of 66 (color white, offHand free, energy 1.2, talkSpeed 37, hold 1.35); *"Lets wire it in, shall we?"*; and on the records: *"simply 'remember' the 'best one' … remember *that* one, forget the old one"*.

### What shipped
- 🧠 **Engine — one remembered riff-off.** `state.bestRiff` (null at start). `engine/systems/riffOff.js`: `riffMoment(state)` snapshots a decided duel at RIFF_CLOSED (round, turn, seats, winner, margin, exchanges, decidedBy, bothStrong; each side's quality, perfects, avg reaction, energy, and its notes in order); `riffMomentScore(m)` (winner quality ·6 + perfects ×4 + loser quality ·25 + 18 for a second exchange + 12 when both were strong); `applyRiffClosed` keeps the new one only if it scores STRICTLY higher. Ties and undecided duels are never remembered. Pure, deterministic, JSON-safe.
- 📜 **`data/fanMc.js`** (pure): `FAN_MC` = Alex's dial-in (64 levers; `riffPick` and `laterShows` retired by his two rulings), `replayShow(roundLimit, round)` (true only for 20 rounds at the LAST round of `stageFxSchedule(20)`, i.e. 17), the words `mcIntermission(facts)` → beats (arrive · standings · riff only when `replay` · tease · reveal · exit), `compileIntermission` / `intermissionAt` / `skipTarget` (one clock in seconds; ⏭ = a new start time), `replayPlan` / `energyAt` (the fast-forwarded ball), `fanMcSoundTimes`, `FAN_MC_SCREEN` (where his head and the TV project, for the DOM bubble).
- 🎭 **`board/fanMcStage.js`**: him on his own floating hex (the wallpaper `fanPawn3D` + mic posed from its grille and pushed clear of his head at every size), the camera (`camera()` → the renderer's introShot path, the Auto camera switch respected), the dim / flash (`light()`), the TV (a WebGLRenderTarget on a mini replay stage with the real standees and `createDuelWaveforms`; canvases built lazily so node suites never touch `document`). Wired through `arenaVisuals` / `arenaRenderer` / `arenaFrame` (`fanMc`).
- 🖼️ **`ui/FanMcOverlay.jsx`** (bubble beside his head, or a caption with no 3D; the Fame bars; the call banner; ⏭ Skip, a real button with `data-pad-default`; Enter / Space / Escape skip) and **`audio/fanMcSfx.js`** (arrive, tap, roll, hit, leave).
- 🔌 **Monolith:** the hold `fanMcLive` is DERIVED in render from `stageFx.lastDraw` (drawn for this round, not yet shown) — gated on `config.openingAct && !catchUp`. While live: the effect's board views are veiled (`fxView`), `activateStageFx` defers its log lines and banner to his call (`fanMcDeferredRef`), and keys, the bot step machine, the watchdog, the bat clock and the pad all wait. ⚠️ **The rules never wait**: the engine activates the effect when the round opens, exactly as before; a replay or an online peer sees the same state.
- 🎥 **Fixed on the live look (10-15):** his closing pull-back used the full ◈ Arena preset and left the board a speck under the call; it now ends at .6 of it, the wide Alex dialled on the preview (`arenaRenderer`, pinned in `test:fanmc`).

### Evidence
- `test:fanmc` **101** (new): the dial-in pinned key by key, the replay rule (10 / 15 / 20 × every show), the words, the clock and Skip, the replay's energy curve, the engine's best-riff memory (better replaces, worse and equal do not), the stage in node (mic never in his head at any size / style / pose), and the wiring in the monolith and renderer. Mutation-checked: the mic, the replay rule, an equal duel, the veil, the wide.
- `test:fanmcjourney` **26** (new, ~4 min): the real `Game`, 2 seats, 20 rounds, by keys — round 7 holds the board (a note key does nothing), the effect is live in the rules but not on the board, the bars, Escape lands on the call, the effect appears, the board comes back, play goes on; round 12 has no riff beat; round 17 has it (no duel → he says so). Fails with the veil removed.
- Both in `test:all` (101 suites). `test:stagefx` 99, `test:determinism` 20, `test:entrance` 2741, `test:riffarena` 34, `test:client` 6, `test:arch` 8, `check:bundle` 0 warnings. Full sweep in a Linux copy: all green except the two known pre-existing reds (`bushidoui` needs a file outside the repo, `abilitydemo` an old preview lever).
- 👁️ **Seen in Chromium on the real match** (software GPU, reduced motion so the lens settles per frame): round 7 of 10 — him landing beside the stage with the mic in hand, the bubble beside his head, *"Is this crowd still ALIVE?!"*, the Fame bar chart at the top, the dim, SMOKE MACHINE called, the pull-back. Round 17 of 20 with a remembered duel (a cloud-only hook seeds `bestRiff`): the TV drops on its cables over the stage, ⏩ FROM THE TOP ×8 with the ball growing, 💥 THE BLAST carrying it into the loser, the white flash on impact, then INTERGALACTIC 0 WINS THE RIFF-OFF · 30.3 energy ball, with his line in the bubble. No page errors.

### Not done / not verified
- ⏳ **Not on Alex's GPU.** The software renderer runs ~30 s a frame, so motion (the fly-in, the ball's growth) was judged on the preview, not live.
- 📌 The replay shows energy, not Fame won: the record keeps each side's energy and notes, not a `fameWon`.
- 📌 A 0–0 tie shows both Spirits crowned "LEAD" on the bars.
- ⁉️ My calls: the show rides the opening act's switch (no separate setting); a skipped show still plays his call; the HUD steps aside while he talks (`body[data-fanmc-live]`).
- 🗑️ Alex can delete `_to_delete/rlsw-tree-ci-2026-10-15.tgz` and `_to_delete/fan-mc-script.superseded-by-src-data-fanMc.js` (the old preview's words, now `src/data/fanMc.js`).

### Next
1. Alex: play a 10-round match to round 7, and a 20-round one with a riff-off to round 17 — the MC, the bars, the call, the TV.
2. The Rock God's own later role (approves or disapproves) is in `IDEAS_INBOX.md`, not designed.

