# SEQUENCING §A as it stood before `71-padturn` (archived 2026-10-14)

> Moved here unedited when the next handoff took §A. Index row: `SEQUENCING.md` §C `70-controller`.

## 70-controller. 🎮 Controller support — the foundation — 2026-10-14

**Alex:** *"lets talk about controller support - how big of a job would this be?"* → *"When I think of scalability and how modern games are played, I think x box controller … the first thing I usually do is search for a way to play it with my controller"* → *"Lets build the foundation now then"*, with a sketch for the Riff-Off (1 LT · 2 LB · 3 D-pad right · 4 X · 5 RB · 6 RT), then *"I'd like to hear what you think is the best way … first do what you think is most ergonomic and we can discuss finer points like that later"*.

### The idea that carries it
⭐ **A pad press IS a key press (or a click).** The game never learns a controller exists: each button sends the keyboard event or the mouse click that already does that job, so it goes through the same handler and the same gates (`keyboardNoteCommit`, `numpadMove`, `enterEndTurn`, all three Riff-Off listeners). There's no second code path to drift.

### What shipped
- **`src/input/`** (new directory, 4 modules, rows in `ARCHITECTURE.md`):
  - `padMap.js`: the whole map and every feel number (`PAD_TUNING`, `RIFF_LAYOUT`, `TURN_LAYOUT`).
  - `gamepad.js`: the 4 ms poll, the two layers and `mountGamepad`.
  - `padFocus.js`: the on-screen highlight and `PAD_RING`.
  - `padNav.js`: which box the D-pad goes to next.
- 🎸 **Riff layer** (my ergonomic pick, open for Alex):
  - Six strings on six fingers: 1 LT · 2 LB · 3 **any** D-pad direction · 4 **any** face button · 5 RB · 6 RT. That's Alex's own shape, except each thumb gets its whole cluster.
  - Bends are a flick of **either stick**, up or down. Menu = Enter (start). View = Escape (back), because B is a string here.
- 🎲 **Turn layer:**
  - D-pad moves the highlight; A presses it. The first A only shows the highlight, so a press is never blind.
  - **Y = Enter**, which advances the turn (Continue → ✓ Commit → End).
  - X = Backspace · LB = W (🎡 the Scale Wheel) · RB = Tab (Drive ⇄ Sustain) · B = Escape · R3 = Numpad5 (🧭 face north) · Menu = ☰.
  - The **left stick walks toward screen-up**: `stickBoardAngle` turns the stick by the lens heading into a board direction, then `walkCodeFor` sends that direction's numpad key.
  - The **right stick** turns and tilts the lens (a stick held over counts as a mouse drag: `grab` → `takeOver`/`letGo`). LT / RT zoom.
- **The highlight** (`padFocus`):
  - Targets are what a mouse could click: buttons, ARIA roles, `[data-stock-idx]` chips, `[data-pad-hex]`, `[data-pad]`, and inline `cursor: pointer`.
  - ⭐ A target only counts if `elementFromPoint` lands on it, so a modal scopes the highlight with no registration.
  - A press is the full pointer/mouse/click sequence. Hover comes free, because mouseover/out is what React's onMouseEnter is built from.
  - On a slider, ←/→ nudges it. A real mouse move hides the ring.
  - Every event carries `rlswPad`.
- **Wiring:**
  - `App.jsx` mounts it once.
  - The monolith: `providePadCamera`; `claimPadLayer('riff')` inside the Riff-Off key effect; `data-pad-hex` on hexes **only while an action is armed** (otherwise ~40 hexes would sit between the HUD and the rail).
  - `RiffArenaBattle` claims the riff layer only while its clock runs (so A can press "Start Riff Off"). `arrowHighwayEngine` claims it while mounted.
  - `arenaRenderer`: `heading` / `grab` / `orbit`, and it hears `PAD_ACTIVITY_EVENT`. Without that event, a player using only the sticks would lose the lens to the 10 s idle camera.
  - `BoardViewport` passes those through. `GlobalCursor` ignores pad events, so the arrow doesn't jump.
- 🧪 **Controller Lab** (`.scratch/pad-lab.html` + `.js`, `npm run dev:padlab`, double-click copy `npm run build:padlab` → `pad-lab.standalone.html`):
  - It runs the game's own runtime, map and ring: live pad state, the six lanes, a mock HUD with a modal, and a lens-heading slider for the stick walk.
  - Feel and ring levers, localStorage, and a 📋 dial-in box that marks changed vs default.

### Evidence
- `test:gamepad` **184**:
  - The map: six strings, six fingers, no button doing two jobs.
  - Trigger hysteresis by value.
  - Screen-up walking checked against a **real three.js camera** across 864 heading × push cases.
  - Both layers; the highlight in jsdom; the wiring.
  - **3/3 mutants caught:** trigger hysteresis, the walk's sign, and the layer-switch guard (that last one needed a new check: an A landing on the poll a duel ends clicks nothing).
- `test:padjourney` **10**: the real `Game`, a turn from a fake pad. Y Continue / Commit / End turn, a **held** Y fires once, the stick walks one hex per push, and a part-way nudge walks nowhere.
- Both are in `test:all`.
- Green:
  - `check:bundle` 0 warnings
  - `test:arch`
  - `test:cameradirector` 97 (its activity-list regex now includes the pad event)
  - `test:topview` 81
  - `test:numpadjourney` 24
  - `test:notekeysjourney` 29
  - `test:riffarena` 34
  - `test:riffarenajourney`
  - `test:client`
  - `test:journey`
  - `test:render` 13
- Changed files lint clean. The one warning, `BoardViewport.jsx:105`, was already there.
- 🐛 **Found in the Lab** (headless Chromium driving a fake pad): from a wide button, Right dropped to a chip in the row below, because nav was measured centre to centre. `padNav` now measures **edge to edge**, and a box must reach further that way. Regression is in §7.
- 🐛 **Found when Alex first plugged in his pad (same afternoon):**
  - The Lab's top line only listened for `gamepadconnected`, so it said "no controller" while the log showed his presses. It now polls `getGamepads` and says **why** (blocked in a preview pane, tab not focused, press a button, `joy.cpl`).
  - `mountGamepad` also probes once a second, and its `getGamepads` reads can no longer throw.
  - A **self-ticking "Try this" checklist** now shows what each button should do.
  - Nav: Right from a button hopped UP to a note chip that overlapped it sideways. `pickNeighbor` now prefers boxes **in line** (`inLine`) and only cuts across when nothing is in line. Regressions are in §7.
- 🧰 This session ran on the device: `ESBUILD_BINARY_PATH=node_modules/@esbuild/.linux-x64-TXItLeJJ/bin/esbuild` (a Linux esbuild 0.28.1 already sits there, hidden) makes every bundling suite run on the VM.

### Not done / not verified
- ✅ **Alex's pad, in the Lab (14 Oct, 13:58):** the checklist ran through, and the dial-in came back **0 of 18 levers moved**. `PAD_TUNING` and `PAD_RING` are his call now; their comments say so. ⏳ Not yet played in a real match.
- **Picking a note on a pad** is highlight + A on the chips for now. The Scale-Wheel-on-a-stick design is the next real decision.
- No button prompts: the hint copy still says keys.
- No pad-per-seat for hot-seat (every pad drives the acting seat).
- The riff mapping is open for discussion (Alex asked to talk it through).
- `_to_delete/_dbgCheck.mjs` is mine (a debug copy; deletion is off in this folder).

### Next
1. Alex tries the Lab with his pad → dial-in → the riff layout talk.
2. The note-picking design (Scale Wheel + stick).
3. Button prompts that follow the last device used.
4. The "pad-ready" rule (CLAUDE.md) applies to every new screen from now on.
