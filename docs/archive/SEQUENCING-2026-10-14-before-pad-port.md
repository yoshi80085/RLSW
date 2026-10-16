# SEQUENCING §A — archived 2026-10-14, before the pad-turn port

> Moved out of `src/SEQUENCING.md` §A when `72-padport` replaced it. Unedited.
> Its row is in §C (`71-padturn`).

---

## 71-padturn. 🎮 Pad mode, the ring that starts where the step does, and the pad-turn preview — 2026-10-14

**Alex:** *"The game should differentiate between controller use vs not using a controller. So when the controller is in use (controller version), the mouse pointer should go away - and the box that is selected should be 'lit up' for whatever option is being selected. This includes menus, menu options, and in game sequences. The start of any turn is the chord selection so those boxes should immediately light up … Note committing - control with note is selected with the left joystick. Hammer on/pull offs? What do you think? … the option for abilities should be able to be accessed easily without mouse/keyboard - what do you think about this? I have my own ideas, but I'd like to hear your ideas unfiltered by my notions."* → I proposed four things (the Scale Wheel as a stick picker, the hammer-on as a right-stick flick, the D-pad as the ability cross with legal-only aiming, and a button bar) → *"your ideas sound great - I like these. Lets get started on them"*.

### What shipped (behaviour — no new visuals, so no preview needed)
- 🎮 **Pad mode vs mouse mode** (`input/padFocus.js`): the last device used wins.
  - Any pad input → `<html data-rlsw-input="pad">` (`GlobalCursor` hides its arrow on that) and a transparent **shield** over the page, so the resting mouse hovers nothing (no stray `:hover` box lit beside the ring).
  - ⚠️ The shield would blind the "is it on top?" test, so `onTop` now reads `elementsFromPoint` and looks **through** the shield and the ring.
  - Real mouse travel (≥ `PAD_RING.hideOnMouse`, 6 px), a real press or a wheel on the shield → mouse mode. A press that lands on the shield is spent waking the mouse.
  - `INPUT_MODE_EVENT` (`rlsw:input-mode`) fires on every flip, for the button bar to come.
- 💡 **The ring lights at once** (`input/gamepad.js`): any pad input on a turn screen shows it. ⚠️ A D-pad or A press that WAKES it is spent waking it (a blind move/click is never right); Y / X / RB… still go through. In a Riff-Off it's pad mode (no arrow) but no ring.
- 🎯 **Each step names where the ring starts**: `data-pad-default="<key>"`; the ring jumps when the **key** changes (a `MutationObserver` marks it due). ⚠️ Keyed on the value, not the element: the chord step's default is "the first open chip", a different chip after every commit — keyed on the element, the ring would be yanked back after every note.
  - Monolith `padTurnKey` = turn count + seat, human turns only. Chord: **Drive** (or Sustain if Drive is full) → once a stack is picked, the hand's first open chip → **Continue** when the budget is spent. Melody: the first playable chip → **✓ Commit** when the hand is spent. Move & Act: **Move**. The next human turn is a new key, so the ring jumps again.
  - Menus: `TitleMenu` (first open option), `SpiritDraft` (first pickable Spirit → first ability not taken → LOCK IN), `Lobby` (ENTER ARENA once it can go).

### The preview (the visual half — waits on Alex's dial-in)
- **`.scratch/pad-turn-preview.html`** (`npm run build:padturn`; source `.scratch/pad-turn-preview.jsx` + `.template.html`). Runs the game's own `ScaleWheel`, `NoteHex`, `hammerCandidate`, `readPad`; a pad, or the keyboard standing in (WASD/IJKL sticks, arrows D-pad, Space A…).
- **`src/input/padTurn.js`** (new, pure, ⚠️ nothing in the game reads it yet): `PAD_TURN` = every lever's default (24), `CROSS_MAPS`, and the geometry: `pickWheelSlot` (stick → note, **magnetic** to the notes you hold), `stepWheelSlot` (D-pad ◀▶ round the wheel), `hopTarget` (aim → the next LEGAL target that way, ±60°), `cycleTarget` (LB/RB round the circle).
- What it shows: 🎡 the wheel as the picker (needle, ring/glow, audition on sweep, rumble tick, keep/clear on release, centre/dock/HUD placement) · 🎸 the hammer-on as a right-stick flick (↑ hammer, ↓ pull; the wrong way says which it is; RT as the alternative) with a gold arc hint · ✚ the ability cross (around the standee / a corner / the bar only; two mappings), aiming that only lands on legal hexes, B cancels, View = the HUD · 🧭 the button bar (place, size, Xbox colours or mono, labels; **keys in mouse mode**) · "Today (ring only)" as the honest comparison.
- 📋 localStorage from the one lever chokepoint + a selectable dial-in box that marks CHANGED vs default.

### Evidence
- `test:gamepad` **257** (was 184): §5 the waking rules, §8b pad/mouse mode + the shield + the default keys in jsdom, §10 the `padTurn` rules, §9 the wiring (every step default, the menus, the cursor rule). **4/4 mutants caught** (default keyed on the element; no look-through; a waking A that presses; the magnet off).
- `test:padjourney` **17** (was 10): the real `Game` — the turn opens on Drive, picking Drive moves the default to the first open chip, a commit keeps the KEY, Melody and Move & Act name theirs, and the next human turn is a new key.
- Green: `check:bundle` 0 warnings · `test:arch` · notekeysjourney 29 · numpadjourney 24 · hammeronjourney 30 · spiritpicker 67 · client · journey · render 13 · loadoutui. Changed files lint clean (Lobby.jsx's messages are all pre-existing lines).
- The preview, driven headless in Chromium by the keyboard stand-in: chord commits to Drive and Sustain, the hammer-on lands and the wrong-way flick is refused, Psycho Bushido / Shukuchi arm, aim and fire, mouse movement flips to mouse mode and the bar to keys, a reload restores the levers. 🐛 Found there: a key tapped faster than one frame was missed (latched now); a step didn't light a note until the stick moved (it opens lit now).

### Addendum, same evening — the let-go fix (preview)
- **Alex, on his pad:** *"its hard to get it to 'stick' to one of the diagonal directions - it usually feels like it 'wants' to snap to the nearest 4 directions."*
- **Cause:** a stick let go from a diagonal doesn't come home in a straight line — one axis springs back a frame or two first, so the last readings above the dead zone point straight up/down/left/right, and `wheelRelease: 'keep'` kept that.
- **Fix** (`padTurn.js` `createWheelAim`, three new levers): the pick only moves while the stick is held at ≥ `wheelSteady` (.8) of its recent peak; on release it rewinds to what the stick pointed at `wheelSettleMs` (90) before; a picked note is sticky by `wheelStickDeg` (8°). `test:gamepad` **270**: the real let-go recreated, each guard shown to hold it alone, and all three off reproduces the bug.

- **And a stuck rumble:** Alex heard *"a constant 'ringing' of a note - even though the preview isn't open"*. Most likely the pad's light motor left spinning (it whines at low speed; Chrome on Windows doesn't always stop an effect). The preview now `reset()`s the actuator after every buzz and on hide / blur / close. ⏳ Unconfirmed: if it rings with the pad switched off, it's something else.

- **Dial-in #1 (Alex, 19:50):** 1 of 27 moved — `wheelSize` 370, now the default. Then *"the note letter hexes can be a bit bigger"* → `wheelChip` 44 (the wheel takes `opts.chip`; unset = the nav wheel's 38, so the game is unchanged), and *"the line that emits from the center looks a little 'crude'"* / *"perhaps that line might not even be necessary at all"* → `wheelPointer` replaces `wheelNeedle`: 'beam' (tapered neon blade from the hub rim, hex jewel tip, eased), 'arc' (a lit sweep on the outer track), 'both' (default), 'line' (the old one), 'off'. His call which.

- **Dial-in #2 (20:03):** `wheelPointer` 'arc' (now the default). ⭐ And a ruling: *"I think this can totally replace the current 'note pool' that I have in the game … This totally brings sense and order to the note pool."* → STATE_OF_PLAY §4; its own preview is next.

- **The wheel as the note pool — ruled and previewed (20:10):** **everyone** (mouse clicks a slot, a–g still types, the pad uses the stick), **centre of the arena, big, in Chord and Melody**. `ui/ScaleWheel.jsx` gained two optional props — unset, the wheel is unchanged, so the game is too: `marks` (per pitch class: `support` → NoteHex's own red/blue chevron · `coach` → the crowd's dashed pulsing ring · `staggered` → ⚡ badge, those copies unplayable · `mixer` → a used note stays pickable with ⟳ · `fresh` → the held badge pops in) and `hub` (Chord Stack: the hub in the destination's colour, the budget pips under it). `opts.chip` (the hex size). Preview: a States row (crowd hint, staggered, Mixer, fresh, ⌨️ keys type notes via `noteKeys.stockIndexForKey`), levers `poolHub`, `poolStrip`. Headless: every state drawn, a–g typing commits. `test:scalewheel` 312 · `test:gamepad` 272 · check:bundle 0. ⏳ Not built into the game; still to design on the page: the Iwato curse (today it swaps to `CursedWheel`), and where the stack chips / melody track sit once the honeycomb is gone.

- **Dial-in #3 (20:19): 0 of 30 moved** — every `PAD_TURN` number is his call now (the comment says so). Then the open pool items, on the page: 🌑 **the curse as the pool** — `CursedWheel` gained `pool` (off = unchanged): overlay sized to `opts.chip`, held notes outside Iwato only veiled with their name in discord grey (playable, no fans), every held note's count badge on top (violet for Iwato), the inner shroud lighter. Preview state 🌑 uses the real `CursedWheel` + its CSS (build loads `.css` as text; `CursePool` is a module-level component so the ink doesn't remount per frame). 🎵 **Flights leave from the wheel slot** (the game's `NoteFlyChip`) to the Drive/Sustain row or the track seat. The HUD column without the honeycomb is the preview's: stack rows / track / 🔨 / Commit stay. `test:cursedshamisen` 132 + 44 · check:bundle 0. Port notes: the flight source is looked up by `data-stock-idx` today (one chip per index) — the wheel slot holds several indices, so the lookup moves to the slot by pitch class; the tutorial's `note-stock` anchor moves to the wheel; the 1.5 s hover-scale tip goes (the wheel is the scale).

### Not done / not verified
- ⏳ **Not yet seen on Alex's machine** — neither pad mode in a real match nor the preview with his pad (beyond the diagonal report).
- The ring still walks the arena's 3D overlays the old way; the 3D standee-hover etc. under the shield is untested on a GPU.
- `padTurn.js` is preview-only; the port (wheel picker in the game, the cross, the bar, the flick) waits on the dial-in.
- 📌 Mouse-mode first click after pad use is spent waking the mouse (by design; say if it annoys).

### Next
1. Alex: try pad mode in a match, and dial in `.scratch/pad-turn-preview.html` → paste the dial-in.
2. Port at his numbers: the wheel picker into the Chord/Melody steps, the flick into `hammerOn`, the cross + legal-only aiming into Move & Act, the bar listening to `INPUT_MODE_EVENT`.
3. Still open from `70-controller`: the riff layout talk; one pad per seat for hot-seat.
