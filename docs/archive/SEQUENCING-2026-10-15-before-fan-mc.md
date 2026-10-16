# SEQUENCING §A — archived 2026-10-15, before the fan MC port

> Moved out of `src/SEQUENCING.md` §A when `73-fanmc` replaced it. Unedited.
> Its row is in §C (`72-padport`).

---

## 72-padport. 🎮🎡 The pad turn is in the game — and the note pool is the wheel — 2026-10-14

**Alex:** *"lets build the pad turn into the actual game"* — at his dial-in (#3: 0 of 30 levers moved, after `wheelSize` 370, `wheelChip` 44, `wheelPointer` 'arc') and his ruling that the wheel replaces the note pool for everyone, centre of the arena, big, in Chord and Melody.

### What shipped
- 🎡 **The note pool IS the wheel** — `ui/PoolWheel.jsx` (the real `ScaleWheel`, or `CursedWheel` with `pool` under the Iwato curse, plus the pad layer: rim arc pointer, pick ring, hammer slur). ⭐ **One copy:** `.scratch/pad-turn-preview.jsx` now imports it, so the dialled page and the match draw the same code. Rendered by `MatchSurface` `pool` into `.match-pool`, centred on the arena's free middle (+115 px right of centre, −48 px up, clear of the pocket, the turn drawer, the nav dock and the floating MELODY track; it shrinks on short / narrow screens). Only the notes and the hub take the mouse, so a drag in the middle still turns the lens.
  - Monolith: `poolPick(pc)` (a click / the pad's A → the first copy you hold → `clickNoteStock`; Chord → `poolChordDest()`, the keyboard's rule; Melody → the Mixer's ⟳ copy when nothing is held), `poolSwitchDest` (the hub), `poolHover` (sound; Chord ghosts the note into the board's stack panel), `poolMarks` (support / coach / staggered / mixer / fresh from `endingStackSupport`, a per-note `spiritChord` preview for the old ▲, `crowdMarks`, `staggeredSlots`, the Mixer gate, `freshNoteIdx`), `poolCurse`.
  - 🪦 Gone: the melody honeycomb (`stockGrid` lives on only in the Spirit sheet's step-3 drawer), the step-1 STOCK grid and `STACK_GRID_CHIP`, the 1.5 s hover scale-peek on chips, the chips' `data-pad-default`s.
  - ✈️ `stockChipEvent(idx)` finds the note's WHEEL SLOT by pitch class (one slot, many copies); the old chip is the fallback.
  - 🧭 Anchors moved: the pool wears `note-stock` (Melody) / `stack-note-grid` (Chord); the panel drops `note-stock` while the pool has it. The ▲ tutorial page now says "on the notes in the wheel".
  - **W / the Scale chip** hide and show the POOL while you compose (`poolHiddenKey`, reset each step); the small Scale card under the chips stands down then, and is back from Move & Act (W and the chip toggle it as before).
- 🕹️ **The pad's turn** — `input/gamepad.js` `providePadTurn(get)` + `modeTick`; the monolith's `padCtxRef` answers every poll: `'wheel'` (stick → `createWheelAim`; D-pad ◀▶ `stepWheelSlot`; a spent pick moves on clockwise, `nextHeldSlot`; A → `padCommit`; right-stick flick → `padHammer` (wrong way = a log line naming it); no ring), `'cross'` (D-pad → `padCrossPress` → CLICKS the rail button `[data-pad-ability]`; the stick still walks; no ring), `'aim'` (the ring lands on `padAimDefault` and only hops among `padAim`; A presses; B = Escape; ⚠️ a ring that fell back onto a HUD button is put back on a target within 100 ms), `null` (the HUD; View toggles it). `padSticks()` feeds the pool's pointer.
  - 🎯 **Legal-only:** hexes carry `data-pad-hex` only when in `padAim` — the set `onHexClick` would accept for the armed action (`reachable`, `shukuchiTargets`, `displaceTargets`, `gravityTargets`, `getPsychoBushidoTargets()`, the Tentacle's rivals, `attackReachFor(…).targets` for Thrash / Sonic / Blaster, Lost Chords for the curse, neighbours for Face).
  - ⎋ **Escape backs out of an aimed ability** on the keyboard too (`keyboardNoteCommit`).
  - ✚ `ui/PadCross.jsx`: four chips round the acting hex mirroring the rail buttons (label, greyed, armed), read from the DOM each frame. `sig1` / `sig2` = the first and second `sig:` buttons in rail order (Move Shadow and every Cancel are not on it).
- 🧭 `ui/PadButtonBar.jsx` (`padVerbs`): Chord / Melody / hidden wheel / Move & Act / aim / HUD; keys in mouse mode.
- 📦 `ui/padTurnUi.js`: the components' data half (CSS, `easePointer`, `pointerShapes`, `usePadMode` on `useSyncExternalStore`, `MOUSE_KEY`, `crossButton`) — fast refresh's export rule.

### Evidence
- `test:gamepad` **322** (was 272): §11 the three modes against a stub context (opens lit, stick picks without walking, A plays, ◀▶, a spent pick moves on, flick ↑/↓, RS still turns the lens for a Spirit with no hammer-on, Y/RB/X/LB still keys; the cross; aim hops only to legal targets, stays put when nothing is that way, RB cycles, A presses, B escapes, a mouse player is never flipped into pad mode, the HUD-button fallback is corrected), §9 the wiring (legal-only hexes, the new step defaults, every signature tagged once, no Cancel on the cross).
- `test:padjourney` **37** (was 17), the real Game from a fake pad: stick + A into Drive, RB → Sustain, three melody notes by stick, the hammer flick (wrong way plays nothing, right way is the technique), X, a typed note, the cross arms Shukuchi with only its legal hexes open and the ring's start on one, B backs out.
- `test:scalewheel` **319** (the pool in Chord commits to a stack, in Melody to the track; W and the chip hide / show it; the card comes back in Move & Act). `test:notekeys` 211, `test:crowdbubble` 129, `test:render` 13, `test:arch`, and the eight journeys that clicked honeycomb chips now click wheel slots (journey, battle, card, entrance, marquee, riffarena, sonic, swing, loadoutui, shamisenjourney).
- Full sweep in a Linux container (99 suites): every suite that was green before is green after with the same or higher counts; the 13 red before are the same 13 after (all missing `.scratch/` previews or stubbed binaries in that copy — none touch this work).
- 👁️ Seen in Chromium on the real match (software render, no 3D model): the pool in Chord and Melody, the arc pointer and pick ring under a fake pad, the bar in both modes, the cross round the Spirit. Screens: Chord / Melody / Move & Act / aim.
- 🐛 Caught on the way: a stub-`document` crash in `usePadMode` (`test:render`), and my own over-wide cut that took `SOCKET_HUE` with the grid's constant — restored; ⚠️ `check:bundle` did NOT catch it (esbuild does not resolve free names) — `test:client` would have.

### Not done / not verified
- ⏳ **Not on Alex's machine, not on a GPU.** The aim ring on the CSS3D hexes is unseen (the container cannot load the arena); the foundation's note stands.
- ⁉️ My calls, each one line to reverse: the small Scale card stands down while composing; the pool sits +115 / −48 px off centre; the bar sits bottom-centre (`barPlace`); the ▲ chord preview became the NoteHex chevron.
- 📌 Known gap: a note your stack has made legal ("pardoned" by chord context) still reads grey on the wheel — the honeycomb lit it. A `legal` mark on the wheel would close it (a visual — preview first).
- 📌 One pad per seat for hot-seat, and the riff layout talk, are still open (`70-controller`).

### Addendum, same day — Alex on the real match: the wheel is buried, the pad moves the mouse
- 🪟 **Own window:** `.match-pool-scrim` (a radial dim round the pool, `PAD_TURN.poolDim` .5, in `MatchSurface`) + `.pw-disc` under the wheel (`poolDisc` .88, `poolBlur` 10 px, `backdrop-filter`). Levers on `.scratch/pad-turn-preview.html` (state 🏟️ Busy arena behind). ⏳ My first-pass numbers, not dialled.
- 🛡️ **Emulation guard:** `padFocus.js` `PAD_GUARD {ms:300, noticeAfter:3}`; `gamepad.js` calls `focus.padPulse(held)` every poll; while guarding, a capture-phase listener swallows untagged clicks / wheel / keys and mouse moves do not leave pad mode; `PAD_ECHO_EVENT` + a one-time notice. Cause on his side: Steam Input Desktop Layout / DS4Windows emitting a mouse and keys alongside the Gamepad API. `test:gamepad` §8c → **334**. Seen in Chromium with a fake pad: a click on Sustain mid-stick swallowed, the notice up, mouse mode back 300 ms after release.
- 🎚️ 22:12 Alex: *"can you make it into a preview? … dark but not totally opaque … control the level of transparency"* → `.scratch/pool-window-preview.jsx` / `.html` (`build:poolwindow`): the game's `PoolWheel` over a drawn busy arena or **his pasted screenshot** (sized by his display scale, wheel at the match's +115/−48), Compare dial / shipped / none (+ hold Space), a see-through % slider with presets, 10 levers, the dial-in box (changed vs default) + localStorage. Seven new `PAD_TURN` levers (`poolDiscEdge`, `poolDiscTint`, `poolDiscSize`, `poolDiscRim`, `poolDiscSoft`, `poolDimHole`, `poolDimReach`); the disc's style moved into `padTurnUi.js` `poolDiscStyle`, the dim into `poolScrimGradient`, so page and match share one drawing. Defaults reproduce the shipped glass exactly — `test:scalewheel` §1b (331, was 319) pins it.
- ✅ 22:32 dial-in ported (`poolDisc` .42, `poolBlur` 3, `poolDiscEdge` .97, `poolDiscRim` 1.25, `poolDiscSoft` 31; 5 of 10). §1b now pins the first pass by its numbers and the defaults as his. ⚠️ The glow ring sits outside the disc, so the soft edge's mask hides it — 1.25 draws nothing at his dial.
- 🐛 Same message: *"the dpad … I'm not able to use any of the abilities"* — MY guard: `padCrossPress` does `el.click()` (untagged, untrusted) while the D-pad holds `guarding()` up → swallowed. Fix: `fromOs` predicate, default `e.isTrusted === true`. 🎓 The journey missed it because it ran with `focus: null` (no guard) — it now mounts a real guard on `dom.window` around the cross press, and fails on the old code (checked).
- ⏳ On Alex's machine: does the guard catch his mapper's echo. 📌 A worn stick drifting past the .25 deadzone keeps the guard up.

### Next
1. Alex: play a match with the pad (and with the mouse) — the pool, the flick, the cross, an aimed Shukuchi / Thrash / Sonic on the 3D board.
2. If the pardoned-note gap matters: a `legal` mark on `.scratch/pad-turn-preview.html` first.

