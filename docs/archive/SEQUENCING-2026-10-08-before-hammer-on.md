# SEQUENCING §A — archived 2026-10-08, before `63-hammeron`

> Moved here unedited when `63-hammeron` became the live handoff. Index rows: `SEQUENCING.md` §C.

## 62-spiritsheet. The Spirit window, rebuilt in the arena's look (previewed, dialled, ported) + one Enter, one act — 2026-10-07

**Alex:** *"when I try and press enter to commit my Melody track - it effectively
'ends' the whole turn - the action phase along with it"*; then *"Lets build out a
new version of the Spirit window when clicking the Spirit's image in the player's
HUD in gameplay. Right now, the old 2D version we built out before comes up, lets
rebuild that to have the necessary information while keeping the current 'look'."*

### ⏎ The Enter bug — FIXED
- **Cause:** two `window` keydown listeners. The note-key one commits; the
  browser then runs a microtask checkpoint before the End-Turn one, React flushes
  the keydown's sync render there, and the effect refreshes the End-Turn ref — so
  it read `turnStep === 'move_act'` on the very press that committed. 2026-10-04's
  `e.repeat` guard only covered a HELD key.
- **Fix:** `enterEndTurn` returns early on `e.defaultPrevented` — a key another
  handler already took is never ours.
- 🎓 **Why the suite missed it:** `noteKeysJourneyCheck`'s `press` ran every
  listener inside ONE `act`, so React never flushed between them. It now runs one
  `act` per listener (what a browser does), and asserts the Commit press leaves
  the turn and the actor alone. Red on the old code, `test:notekeysjourney` **29** green.

### 🪪 The Spirit window — the preview
- His picks (AskUserQuestion): body (Vibe, lives, speed, hex), abilities +
  cooldowns, status effects, sound + key detail, **and FP**; **same spot** beside
  the pocket; the **seat-portrait head**.
- `ui/spiritSheetModel.js` (pure: `SPIRIT_SHEET` levers + `sheetModel`) and
  `ui/SpiritSheet.jsx` (one `Bracket`, SeatPortrait head, NoteHex stack chips).
  **Not mounted by the game.** Every number is one another surface already shows
  (readStack, nextStep, cooldownLeft, the old card's own Fame danger test).
- New in this window, not on the old card: the Iwato curse, a blown amp, Sunbeam
  blindness and the Mosh as statuses, each with turns left and its rule in one
  line; "Next: add B → Power chord" per stack; the cursed key.
- ⚠️ `SHEET_CSS` strips the spirit region's own chamfered box (`:has(.ss-root)`),
  so there is ONE frame — the window-in-a-window lesson of 2026-09-12.
- Preview: `.scratch/spirit-sheet-preview.html` (`npm run dev:spiritsheet`), the
  double-click copy `…standalone.html` (`npm run build:spiritsheet`), and the
  published Artifact **"Spirit Window Dial-in"**
  (`https://claude.ai/artifact/5oCFwFvCS2Dyo1VMKYwFUk`). It mounts the REAL
  `MatchSurface` (pocket, rail, dock, region box) with four states (fresh,
  battered, cursed, crown-in-sight), 25 levers, localStorage, and a copy block
  that marks changed-vs-default.
- `test:spiritsheet` **36** (in `test:all`; 4 mutants, all caught). `test:arch`
  green (3 rows added). `check:bundle` 0 warnings. Rendered in cloud Chromium at
  1600×1000, all four states, ✕ closes, the card reopens, zero page errors.

### ✅ PORTED at the dial-in (same day)
Alex: 6 of 25 levers — `width` 480 → **426**, `sections` rules → **brackets**,
`scrim` .5 → **.54**, `heroHeight` 118 → **105**, `statusDetail` always → **hover**,
`abilityDetail` line → **hover**. *"Lets wire it in!"*
- `SPIRIT_SHEET` carries them; `spiritSheetCheck` §0 pins all 25 (moved and kept).
- Monolith `<HudRegion name="spirit">`: the old 2D card (426 lines) is replaced by
  `SpiritSheet` fed by `sheetModel` (acting, its sheet, `fameToWin`, `turnFameCap`,
  `fameThisTurnRef`, `HEX_BY_NUM[num].edge`, `respawnFlashes`, the KEY PLATE's
  `nextKey` test). `actingDriveDice` is now ONE computation shared by the SOUND
  plate's +N chip and the sheet.
- The 2D-layout question answered itself: `board3D` has been `const true` since
  the 2D board was archived (2026-09-22), so there is no classic layout to keep.
- ✕ → `useHudClose()` (new, `MatchSurface`): the same selection the card toggles.
- Kept from the old card, because other code reads them: the tutorial anchors
  (fame-bar, vibe-bar, stat-knobs, ability-wallet, root-note, interval-legend,
  and note-stock on the KEY's stock drawer in step 3 — still one copy in the DOM),
  `data-spirit-id`/`data-vibe` (battle + replay journeys), the 'i' Field Guide
  (`AbilityInfo`, loadoutUiCheck counts the buttons). `charId` keys the portrait
  art (the seat id can be `cosmic_ronin#2`).
- Imports trimmed: `AbilityWallet`, `StatKnob`, `ChannelStrip`/`StripSection`/
  `TurnRail`/`KeyPlate`, `FAME_NEUTRAL`/`fameSet`/`fameFill`. The modules stay on
  disk, marked "mounted nowhere" in ARCHITECTURE.md.
- 🎓 **`test:render` §4 had been passing for the wrong reason.** It counted
  `data-stat-knob-cap` as "the stack panels' amp knobs" — but the panels draw
  `ArenaDial`; the two StatKnobs were the old card's. It now looks for the
  panels' own `rlsw-dial-core-board-drive/sustain`. `loadoutUiCheck` reads
  "2 RND" off the window (the old wallet said "2 rounds").
- Green on Alex's machine: spiritsheet 75 · journey (opens it, ✕ closes it, the
  card reopens it) · notekeysjourney 29 · loadoutui · battlejourney ·
  replayjourney · arena · scalewheel 312 · render 13 · entrancejourney 29 ·
  seatportrait 66 · dialtick 43 · swing · sonicjourney · shamisenjourney 27 ·
  numpadjourney 23 · cardjourney 15 · pyrojourney 8 · marqueejourney 14 ·
  riffarenajourney · crowdbubble 119 · arch · check:bundle 0 warnings.
- Seen: the real `Game` mounted in jsdom (Testing Grounds, a burn + guard patched
  on), the card clicked, the arena's markup rendered in cloud Chromium — 426 px,
  beside the pocket, every section. ⏳ Not yet in a live match on his machine.
- ⁉️ Still my calls: Code Injection's armed turns are not shown; the turn rail
  is not carried over.

## 61-roninart. The Ronin's new drawing: Thrash1, Thrash2, hit, and a blank back — 2026-10-06

**Alex:** *"I've replaced Cosmic_Ronin standee in the files - and with it, the 2
Thrash phases … phase 1 of Thrash is Thrash1, phase 2 is Thrash2, and whenever
Ronin gets hit back (loses a bout), use the 'hit' picture for the standee"*;
*"create the 'back side' of the Ronin as... blank. It should be obvious which
side is the 'front' and which is the 'back'."*

**What arrived:** four RGB PNGs on WHITE (no alpha), 1316×1195, with white
space under the feet. The standee needs alpha (alphaTest .45) and a traced cut,
and stands the image's bottom edge on the deck — as delivered he would have
floated ~0.07 units over his hex inside a white card.

**The art pipeline — `scripts/standee-art.py`.** Masters copied untouched to
`src/standees/source/`; the script keys paper-white (≥236, grey) that touches
the frame plus any enclosed pocket ≥0.01% of the image (the gap between his
raised arms), un-mixes the anti-aliased rim from the white, erases hand-drawn
effect polygons (`ERASE` — only Thrash2's swoosh + burst, which touch the
drum), crops to the `body` figure with the lip margin and nothing under the
feet, and traces `tight`/`body` with `.scratch/trace-standees.py`'s exact
thresholds. `--splice` rewrites the whole Ronin record (base + `poses`) in
`board/standeeOutlines.js` and the same text + a webp of the base into
`.scratch/standee-preview.html` (`test:standee` §0 parity holds). ⚠️ On these
opaque drawings the tracer's "glow off" step does nothing (every painted pixel
is solid), so effects that TOUCH the figure need an `ERASE` polygon; detached
ones (shards, speed lines) are dropped by MINP/THIN as before.

**The standee — `board/standee.js`.** `spirit.poses` ({name: url}) with a cut
each → built up front; `api.setPose(name)` swaps the print/glow texture and the
art, sheet and edge geometries ON THE SAME MESHES, so lean, KO fall, pyro's
`applyKo` (parts 1–3) and the picker's tint keep working. Poses stand at their
drawn size (`poseHeight` = height × pose px h / base px h). `STANDEE_BACK`
(`blank: ['cosmic_ronin']`): print FrontSide + a BackSide CHILD of the print
with the same geometry, reading only the texture's alpha (shader patch — not
`alphaMap`, which reads green). A child, not a part, so "the part with a map"
still finds one print everywhere.

**The Thrash — `board/swingStandee.js`.** `playsOwnThrash(art)` (has thrash1 +
thrash2) → no stick figure; his standee turns to face `front` (`battleStage`'s
`frontSide`, now passed into the wrap) and `thrashPose` maps the stick
figure's own beats: ready → thrash1, strike → thrash2, from `T.result` a loss or
tie → hit; turned home, a winner is his base print again. The drawings strike
to their RIGHT: facing the front puts that toward the Rival on one side of the
lane and away on the other, so there the posed print is mirrored (scale.x −1,
applied only with a pose, so the flip hides in the change of drawing).
`facings()` hands the director his real print normal.

**Hit back — `board/arenaVisuals.js`.** `poseHit(pawn)` on every
`hitBackCount` change and, when a Thrash closes, for its loser (both on a tie);
holds `HIT_POSE_HOLD` 2.4 s from the last trigger, then `setPose(null)`.
Pose art via `data/standeePoses.js` with `new URL(…, import.meta.url)` — a
static PNG import broke `test:arena` (same as the Bardbarian).

**The lens — `board/battleDirector.js`.** `ctx.oneSided[i]`: `readable`,
`printOff` and the two-shot's print score use the signed dot for a blank-backed
print, so a charge shot never films his blank back.

**Also:** `ui/seatPortrait.js` `HEAD_FOCUS.cosmic_ronin` re-read off the new
art (0.49 / 0.134 / 0.235) — the old focus pointed beside his hat.

**Calls made, not Alex's:** a TIE shows hit (both are thrown back) · the hit
print holds 2.4 s · the back colour `#c4cbd6`, lightly self-lit · poses keep
their drawn scale · mirroring the posed print · only the Ronin gets a blank
back · `Cosmic_Ronin_mirror.png` (old art, used by `GameErrorBoundary` and the
archived 2D board) left alone.

**Evidence:** `test:standee` 161 (new: the poses' cuts, setPose, drawn heights,
the blank back's side/alpha/child, a minimal Thrash both sides of the lane:
front-facing, striking at the Rival, Thrash1 → Thrash2 → hit on loss and tie) ·
`test:arch` 8 · `test:seatportrait` 66 · `test:swing`, `test:battledirector`,
`test:battlelens`, `test:arena`, `test:sonicfx`, `test:sonicjourney`,
`test:battlejourney`, `test:entrancejourney`, `test:riffarenalive`,
`test:bushidoarena`, `test:pyrostage`, `test:beamlayer`, `test:cursedshamisen`,
`test:spiritpicker`, `test:standeemove`, `test:topview`, `test:cameradirector`
green · `test:abilitydemo` 142/143 — the one red is its preview-lever parity
(`.scratch/ability-demo-preview.jsx`), untouched here. Rendered headless in
Chromium (swiftshader): front, blank back, each pose, a mirrored pose.
⏳ `check:bundle` not run (the cloud VM cannot run the Windows rollup binary).

**Next:** Alex plays a Thrash with the Ronin on a real GPU — both as attacker
and defender, a win, a loss and a tie — and gets shoved by a Sonic. Rule the
calls above.

---

## 60-openingport. The opening act goes into the game — 2026-10-06

**Start:** two workflows had overlapped (Bardbarian work and Claude's triage
commits). Checked in order: the merge `feb0f2f` of `61f50a1` and `6e7238a` is
complete, no conflict markers, every remote branch is contained in HEAD, and the
249 "modified" files in the working tree were line endings only (zero content
diff with `--ignore-cr-at-eol`). Alex pushed the three local commits. ⚠️ Plain
`git status` from the cloud VM leaves a `.git/index.lock` it cannot delete —
use `git --no-optional-locks` there.

**Alex's ruling (2026-10-06):** *"those players whose turn hasn't come up yet
aren't even technically on the board yet — They should be placed in the spot in
between the previous 'home hex' and the fan's seats — There is a tiny space (not
quite a hex)"*, and the home hex is **reserved** until its Spirit enters.
Testing Grounds keeps everyone on stage (default; not ruled).

**The rule — `engine/systems/entrance.js`.** One state, `spirit.entrance`:
waiting = `num` null + the entrance record. ⭐ Null `num` is the protection: any
path that finds a body by hex finds nothing, so a forgotten filter fails CLOSED.
The paths that MOVE bodies read `entranceHexes`: `bushidoBlockers` (walk, hop,
slide, Bushido lane, every client highlight that uses it), `knockback`, the
reducer's movement door (`MOVE_STEP`/`SHUKUCHI_HOPPED`/`SPIRIT_WARPED`/
`SPIRIT_SLID` refused onto a reserved hex or for a waiting Spirit), the daze
redirect, and `SPIRIT_PATCHED` (drops a `num` that would). `legalActions` leaves
waiting Spirits out of `rivals` explicitly. Entrance only at `TURN_STARTED`
(seat one at `makeInitialState`, because the client never dispatches a turn
start for the opening turn) — exactly once, +`ENTRANCE_FANS` (= the old
`FAN_DIEHARD_START`, 2) Diehards, `turn.lastEntrance` for the theatre.
Opt-in `config.openingAct` (whitelisted in `state.js`); the lobby sets it for
local and online starts. The dealt hands and the rng cursor are identical with
or without it.

**Client rules.** `reservedHexes` joins every occupancy set in `Game` (move
tiles, slide, displace/warp, Shukuchi landings, hazard and token spawns, pyro
arming). Two event bugs a waiting Spirit exposed: `satanic_panic` rolled for
Spirits not in the room, and `stage_dive` would reach `[0].r` of an empty list
if every rival were waiting — both filter `num != null` now.

**The picture.** `board/openingAct.js` is the clock (wall-clock ms stamps from
`openingSchedule` / `entranceAt`, so the arena, the sound and the input lock read
one clock) and the pad geometry (47% home → grandstand, 1.08 units off the home
hex's centre, outside the grid). `board/openingActStage.js` on the live arena:
the Bardbarian (built on first use — his texture needs a DOM), pads, crash
rings, shafts, shards, the hop, the intro lens (ahead of the director in
`arenaRenderer`, never under ⌗ top-down; a skipped intro reframes the arena)
and the bloom/exposure envelope. It holds a pawn through `pose` like the pyro
reaction and lets go if the engine has already moved it. `bardbarian.js` is the
preview's shader unchanged; art by `new URL` (a static PNG import broke
`test:arena`/`test:sonicfx`). Sound: `audio/openingActSfx.js` on the SFX bus +
the picker's `playSpiritSting`. `ui/OpeningActOverlay.jsx`: captions, ⏭ Skip,
HUD hidden by a body flag. Bots wait for the intro and for their own entrance
(`entranceHoldRef` + a nudge — a state-based hold stalled the machine).
Arena failure gives the intro up at once; a 45 s fallback covers a hang.

**Calls made, not Alex's:** Testing Grounds stays as it was · the intro starts
when the arena is ready (behind the veil it would be wasted) · the HUD hides
for the intro · the pads stay after entry, dimmed (as the preview ends) · the
stand stays empty until the hop lands (the engine granted the fans at turn
start) · the intro's bloom/exposure apply only while the Bardbarian is up.

**Evidence:** `test:entrance` 2,695 (opt-in, opening board ×3 sizes, entrance
once, every door, no legal action naming a waiting Spirit, 36 whole bot matches
audited after every turn, the bench end to end, parity with the preview's
timeline) · `test:entrancejourney` 29 (real `Game`, lobby config; mutation:
dropping the client reservation fails it) · mutation-checked engine doors
(blockers, knockback, turn-start entrance) · `check:bundle` 0 warnings ·
`test:arch` 8 · **full sweep (now 92 suites, run one by one in a fresh clone): 88 green**; the 4 red are the known ones — `test:bushido`'s Shadow call, and `shukuchiui` / `standeemove` / `dice`, which need the uncommitted `.scratch/` previews (green on Alex's machine). Chromium (swiftshader, time slowed 4–5×):
storm, landings, seat one's riff and hop, Skip, a bot seat entering and then
playing, no page errors.

**Next:** Alex plays a real match on a real GPU with sound. Rule his calls
above. The preview stays the tuning surface; the game imports the same JSON.
