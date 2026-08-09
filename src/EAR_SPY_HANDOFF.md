# EAR SPY HANDOFF — 👂 hear a room, read the neck

> **For AI editors + Alex.** The listening system: microphone → chords → key →
> frets → riff verdict, plus the online room that lets a friend's playing land
> on your screen. Written 2026-08-09. Unlike the other handoffs in this folder,
> **everything below is SHIPPED and tested** unless marked 🔭. Companion to
> `PRACTICE_MODES_HANDOFF.md` (its §0 rulings all apply — Ear Spy is a fifth
> practice room) and `NETCODE_HANDOFF.md` (the room server this rides on).
>
> Run `npm run test:chroma` (104), `npm run test:vision` (158),
> `npm run test:detect` (38, 1 pending) and `cd server && npm test`
> (includes N13, 21 checks) before and after touching any of it.

---

## 0. Rulings that govern everything

1. **Two algorithms, not one.** `audio/micPitch.js` (YIN) answers "which single
   note did you pluck". `audio/chroma.js` answers "what is ringing". Polyphony
   is not a tuning problem, it is a different algorithm class — YIN fed a
   strummed G returns G, or B, or a harmonic of D, flickering frame to frame.
   micPitch is untouched and keeps its consumers (Fretboard Recon, Discord
   Coach). Do not try to merge them.
2. **The system shows its working.** Chords come back as a ranked top-3 with
   confidences, never one asserted verdict. Polyphonic detection off a room mic
   is genuinely hard; a system that hedges reads as thinking, one that flickers
   between confident wrong answers reads as broken — and is.
3. **A rejected frame HOLDS, it does not blank.** Strobing between an answer and
   nothing every time a note decays past a threshold reads as broken even when
   the detection is fine.
4. **Outside notes are judged on whether they RESOLVE, not on being outside.**
   The ♭5 in a blues lick, the chromatic approach, the ♭9 over a dominant: all
   off-scale, all deliberate, all the point. Dropping notes for being off-key
   would erase exactly what makes a riff sound like anything.
5. **Judgement belongs to Discord Coach.** `music/spice.js` already owns
   "resolves by step = DEPTH, sits there = NOISE". `riffAnalysis.js` reuses it
   rather than growing a second opinion that would eventually contradict the
   coach that taught it.
6. **Ear Spy Online keeps its own socket.** Practice modes never touch the
   engine or `state.battle` (`PRACTICE_MODES_HANDOFF` §0.3). A listening room is
   not a match and must not be able to desync one.

---

## 1. ✅ What shipped

### Audio
- **`audio/chroma.js`** — spectral peaks → 12-bin pitch class profile, plus a
  sub-200 Hz "bass chroma" for root disambiguation, plus `notes` (octave-aware
  MIDI). Ships a dependency-free FFT so the whole chain is Node-testable.
  Musical-frame gating: adaptive noise floor, spectral flatness, chroma entropy,
  frame-to-frame stability, stable-frame debounce.
- **`audio/chromaSelftest.mjs`** — 104 assertions. `npm run test:chroma`.

### Music
- **`music/keyDetect.js`** — Krumhansl-Kessler key detection over a decaying
  histogram; chord matching against the existing `CHORD_TEMPLATES`;
  `detectPalette` (which scale is being played out of).
- **`music/neckPlacement.js`** — heard notes → frets. Hand tracker, usage map,
  melody trail.
- **`music/riffAnalysis.js`** — phrase segmentation on rests, implied harmony
  from a melodic line, per-note roles via `spice.js`.

### UI
- **`ui/ListenNeck.jsx`** — the 👂 EAR SPY room. Fifth entry in Riff Mode.
- **`ui/FretboardFull.jsx`** — extended, backward-compatibly: `showLabels`
  gained `'layers'`, layers gained `level`, and a `trail` prop.
- **`ui/RiffMenu.jsx`** — Ear Spy card, unlocked.
- **`listen-test.html`** — standalone tuning bench with live gate readouts and
  threshold sliders. `npm run dev` → `/listen-test.html`.

### Net
- **`net/riffWire.js`** — the analysis wire format + coalescing throttle.
- **`net/earSpyLink.js`** — client link: floor control, peer tracking.
- **`server/index.js`** — `RIFF` relay + `FLOOR` control, `room.floorSeatId`.
- **`server/n13-earspy-smoke.mjs`** — 21 checks, wired into `npm test`.

---

## 2. The measured numbers

⚠️ **These are measured, not guessed.** The first draft of the gate thresholds
was written from intuition and three of five were wrong enough to matter — one
(stability) let noise through completely. `npm run test:chroma` prints this
table and the tests assert the separation still holds. Re-run it before
changing anything in `GATE_DEFAULTS`.

| signal | flatness | chroma entropy | stability |
|---|---|---|---|
| clean triad | 0.030 | 0.62 | ~1.00 |
| overdriven triad | 0.102 | 0.64 | ~1.00 |
| noisy acoustic | 0.145 | 0.67 | ~0.99 |
| speech | 0.285 | 0.93 | 0.02 |
| pink noise (fan) | 0.744 | 0.97 | 0.08 |
| white noise | 0.846 | 0.94 | 0.04 |
| click (door/keys) | 0.889 | 0.98 | 0.13 |

Chord accuracy on synthetic guitar tones (harmonic series, not sines — sines
would prove nothing): **100% on ten chord types** across clean, ±20¢ detuned,
overdriven and heavy-noise conditions. Treat that as a floor showing the maths
is right, **not** a prediction about a real room.

---

## 3. ⚠️ Bugs found, and the guards that stop them coming back

Each of these is a real defect that was caught and fixed. Every one has a
regression test whose name says what breaks. **Read the ⚠️ comment before
"simplifying" any of them.**

| what went wrong | why it happened | guard |
|---|---|---|
| Every bright major triad read as a **dominant 7th** | Harmonic 7 of the root lands in the ♭7 bin; suppression stopped at 6 | `maxHarmonic: 8` + "overdriven triads must not turn into dominant 7ths" |
| Noise sailed through the gate | Plain cosine scores two noise frames at **0.81** — all-positive near-uniform vectors look alike | `chromaSimilarity` is mean-removed + "noise frames do not correlate" |
| Starting the listener mid-song gated out the song | The floor seeded to the first frame, i.e. to the performance | Floor seeds as *signal*; test "floor adapts" |
| Sustained notes went deaf part-way | A normal follower creeps up until it swallows the note | Floor only rises on non-musical frames + "a long sustained chord does not raise the floor onto itself" |
| Key estimate got *worse* the longer it ran | Room noise puts energy in all 12 bins, flattening the histogram | Only musical frames reach the estimators |
| A line in A minor read as **E Augmented** | The landing note was credited three times (weighting, root share, landing bonus) | Root share uses raw duration + "ending on a note does not hand it the root" |
| Nothing could ever be judged "outside" | Backdrop scored against 9ths/13ths, which absorb any passing tone | `maxChordNotes: 4` + "the implied backdrop is a triad or seventh" |
| The melody trail froze mid-phrase | The tracker's clock only advances when pushed, and Ear Spy returned early on gated frames | Push empties + "empty pushes still expire the trail" |
| All flashing cells looked identical | CSS `opacity` animation beats an SVG attribute, silently discarding `level` | `level` on a wrapping `<g>` |
| **Streaming would disconnect players** | Server token bucket is 30 msg/s and calls `ws.close(1008)` | `makeRiffSender` coalesces to 8 Hz + "sixty offers become eight sends" |
| A tab close could lock a room forever | Floor held by a seat that no longer exists; every claim refused | Floor released on `removeSeat` and on disconnect |

---

## 4. Known limits — documented, not bugs

- **Exact octave doubles collapse.** E4 is the 4th harmonic of E2, so "E2 played
  brightly" and "E2 + E4 together" are the same spectrum. No mic-based method
  separates them. We keep the lower note. Lowering `noteFloor` to "recover" the
  octave does not recover information that was never there — it prints a phantom
  octave above every single note.
- **A note set cannot name its own tonic.** A minor pentatonic and C major
  pentatonic are the same five pitch classes. `detectPalette` gets the SHAPE
  right and takes the root from `detectKey`, which is an independent
  measurement. Without that hint, relative modes tie — correctly.
- **Which string was played is a guess.** Chroma folds octaves; even with
  register, E4 sits on three or four positions. `placePitch` ranks candidates by
  playability and marks the best one. See §6.
- **You cannot play in time with someone over the internet.** ~25 ms is where
  musicians stumble; a normal path is several times that. Turn-taking is the
  design working around physics, not a UI preference.

---

## 5. How to test

```
npm run test:chroma          # 104 assertions, pure, no mic
npm run test:vision          # 158 assertions — camera geometry, fusion, the coach
npm run test:detect          #  38 on auto-detection (1 PENDING — see §6b)
cd server && npm test        # includes N13 ear spy smoke (21 checks)
npm run dev                  # → /RLSW/listen-test.html  (tuning bench)
                             # → /RLSW/camera-test.html  (§6 fusion bench)
                             # → Riff Mode → 👂 EAR SPY  (the real room)
```

**Tuning to a real room** happens in `listen-test.html`. The sliders retune the
gate live *without restarting the mic* — deliberately, because the adapted noise
floor is part of what you're tuning and restarting throws it away. Sit in
silence and watch it say "ignoring"; talk near the mic, still "ignoring"; play,
"MUSIC". When the wrong thing gets through, the panel names which test let it
through.

---

## 6. ✅ SHIPPED — camera fusion

> **▶ START HERE IF YOU ARE PICKING THIS UP COLD.** Camera fusion is built,
> measured, tested and wired into Ear Spy behind a checkbox that is off by
> default. Nothing is outstanding for it to work. The two open threads are
> **§6b** (automatic calibration — theory proven, image pipeline unfinished, one
> ⏳ PENDING test says exactly where it stopped) and the **hand-span constraint**
> noted in `fretFusion.js`. Run `npm run test:vision` (158) and
> `npm run test:detect` (38, 1 pending) first; between them they state every
> claim this section makes.

**Status: measured, and it won. Now wired in.** The bench was built first, the
camera was scored against the audio heuristic on hand-logged ground truth, and it
cleared the bar by six times the margin set in advance:

| against 8 logged positions, frets 2–12 | 📷 camera | 👂 audio heuristic |
|---|---|---|
| median absolute error | **0.44 frets** | 2.53 |
| mean absolute error | **0.55** | 3.19 |
| within one fret | **88%** | 25% |
| worst miss | **1.4** | 7.9 |

⚠️ **Read the log, not just the summary.** Across ten frets of real hand movement
the audio estimate never left a three-fret band around its rest position (3.1, 6.1,
5.4, 6.1, 6.0, 4.9, 3.1, 5.9 against truths of 2, 4, 5, 7, 9, 9, 11, 12). It did
not estimate badly — **it carries almost no positional information at all**. That
is not a defect in `neckPlacement`; it is what a pitch can tell you about a
position, and that module has said so about itself from the beginning.

Caveat that stands: eight logs, one room, one angle, one guitar. Decisive on the
gap, silent on whether it holds in a dark room or on a different instrument.

### What was wired, and how little of it

- `music/neckPlacement.js` gained `setRef` / `refSource` on `makeNeckTracker`.
  The camera supplies **`placePitch`'s `ref` argument and nothing else**. Audio
  says WHEN and WHAT; video says WHERE. Two numbers of integration surface, as §6
  predicted.
- ⚠️ **The audio tracker keeps running underneath.** Stopping it while the camera
  supplies a reference is the obvious economy and it is wrong: when the camera
  loses the hand the fallback has to be current, not a minute stale. Tested.
- **Only the FRET comes from the camera.** Finger height reprojects as ~5 strings
  of error and under half a fret, so the string half of the reference is left to
  the audio tracker, which is no worse at it.
- `vision/cameraHand.js` — the runtime sensor. `ui/CameraCalibrator.jsx` — the
  panel. `ui/ListenNeck.jsx` — one checkbox, **off by default and staying that
  way**: Ear Spy has to work for someone pointing a laptop at a room.
- **No npm dependency.** MediaPipe loads from a CDN on demand; bundling it would
  add ~2 MB for every player who never ticks the box, and the WASM and the model
  come from Google either way. The game builds and runs with no trace of it.

**What the bench answers:** you play, you click the fret you are actually in, and
it scores the camera's guess against the audio heuristic's over your logs. It
refuses to name a winner under 8 logs, and calls anything inside 0.35 frets a tie
— i.e. *not worth the dependency*. Median is reported next to mean because one
mistimed click moves one of them and not the other.

### 6a. 🎯 Pitch + camera → the exact position

The step that makes the reading **exact rather than approximate**, and it came
from Alex asking the right question: if the note is known and the hand position
is roughly known, isn't the answer pinned down?

It is, and by a much wider margin than expected. A heard pitch is playable in
only three or four places on a 12-fret neck, and adjacent strings are a fourth
apart, so those places sit **four or five frets apart**:

| | |
|---|---|
| pitches with more than one position | 27 |
| gap between neighbouring candidates | min **4** frets, median 5 |
| ⇒ accuracy the camera actually needs | **±2.0 frets** |
| ⇒ accuracy it has | 0.66 RMS — **3× better than required** |
| ⇒ simulated wrong-pick rate | **0.24%** |

⚠️ **So do not spend effort making the camera's fret number more precise.** That
was the obvious next move — fit the finger-height parallax, worth ~15% on RMS —
and it is wasted: the output is a choice between options five frets apart and the
input is already accurate to two thirds of one. What the fusion buys instead is a
hard answer (**exact string and exact fret**, which audio alone can never give)
plus a **margin** saying how close the call was, which a continuous estimate
cannot express at all.

**And the audio pays for itself twice.** Once a note is snapped its fret is
KNOWN, so the gap to the camera's raw reading is the parallax error, measured for
free while somebody just plays — no logging session, nobody clicking anything.
`makeFretFusion` accumulates that and fits `trueFret ≈ offset + slope·cameraFret`.

⚠️ **That loop can eat itself**, and the guards are load-bearing: it learns only
from wide-margin picks, refuses residuals too large to be parallax, requires 20
samples spread over ≥4 frets, clamps what the correction may do, and is **thrown
away on every recalibration** — what it learned described one camera in one
position.

⚠️⚠️ **And the limit no guard covers.** A calibration wrong by *about a fourth*
lands on a different REAL position: every snap is confident, every residual is
small, and the answer is consistently wrong by five frets and a whole string.
Same aliasing family as §6b's projective self-similarity — a repeating structure
aliases. Only the drawn fret wires and the off-board rate catch it. There is a
test named for this so nobody mistakes the guards for a proof.

**Not built:** notes sounding together must be reachable by ONE hand, which is a
far stronger constraint than each note alone. `snapNotes` currently snaps each
independently. The hand-span rule needs its own rules about barres and
thumb-overs before it can be trusted to reject anything.

---

### 6b. 🔬 Automatic calibration — the theory, and where it stopped

Four clicks is a setup step most players will skip, and worse, a hand-clicked
calibration goes stale silently the moment you shift in your chair. So: can the
camera just find the neck? `vision/neckDetect.js` + `npm run test:detect`.

⚠️ **The obvious approach cannot work, and it fails in a way that looks like it
works.** Identify which frets you're seeing from the cross-ratio, which is
projectively invariant and so survives an unknown camera. It doesn't, because the
fret sequence is **projectively self-similar**: with u = 2^(−n/12), shifting the
fret index by k scales u, and a scaling is a Möbius map. So *sliding along the
neck is a projective transformation*. Four consecutive frets have cross-ratio
**1.332962922399… everywhere on every guitar** — asserted to twelve places. Every
"which fret does this run start at" hypothesis fits perfectly and the winner is
decided by floating-point noise: a detector confidently wrong by several frets, at
random. **There is a second symmetry too** — u → C/u reverses the sequence and is
also Möbius, so direction isn't recoverable either, and "the gaps get smaller
toward the bridge" is not a usable test.

What breaks both: **an anchor at fret 0**, plus frets not being negative (that is
what defeats the reversal — the mirror image lands on negative frets). A single
interior anchor is *not* enough; there's a test for that trap. So the anchor has
to be the **end of the board**, which is an image test rather than a geometric
one, and that is the point.

**Status: theory proven and tested, image pipeline unfinished.** Stages 1 and 2
work — strings found, board isolated, strings erased, ~17 fret-orientation lines
recovered with spacing visibly following 2^(1/12), and a RANSAC labeller that
survives outliers. What fails is locating the nut: `looksLikeBoardEnd` is handed
the outermost detected line, which is often a stray, so the anchor never lands and
`identifyFrets` refuses. **`detectNeck` returns null and is not wired into the
bench.** The test suite marks this ⏳ PENDING rather than asserting it, so the gap
stays visible without leaving a permanently red suite.

Next step is either testing every plausible outer line as the nut, or detecting
the inlay dots (needs three or more, or the visually-distinct double dot — two
plain dots are as reversible as two frets). If neither holds up, the literature's
answer is a trained detector: TapToTab went to YOLO for exactly this reason.

---

**What the maths already says**, from 124 headless assertions against synthetic
perspective projections of a 648 mm neck (`npm run test:vision`):

| finding | number |
|---|---|
| a fingertip sits ~18 mm above the board; the homography maps the board | — |
| that height costs, in **fret** | **0.35 frets** |
| …and in **string** | **4.96 strings** |
| a linear read of neck distance instead of `spanToFret`'s logarithm | wrong by **>1 fret** mid-neck |

That split is the good outcome: parallax destroys the axis audio was never going
to give you anyway (which string) and barely touches the one `placePitch` wants
(which fret). It also sets a trap — a sane-looking string tolerance rejects every
genuine fretting hand seen from above, so `VISION_DEFAULTS.stringSlack` is 4.5 and
must stay loose. There is a test named after that trap.

⚠️ **Four clicks fit a homography exactly, so the residual is always zero and a
bad calibration is numerically undetectable.** Two things stand in for the check
that cannot exist: the bench draws the predicted fret wires back over the video
(if they don't sit on your real frets, everything below them is meaningless), and
`checkCalibration` tests the SHAPE of the quad rather than the fit — a real
fretboard cannot project to certain outlines, and when it does, the person
clicked something that wasn't a fretboard corner.

**Nothing here fails loudly**, which is the reason `vision/visionCoach.js` exists.
An uncalibrated board, a nut just out of shot, a hand the model can't see, a
calibration that came loose when you shifted — none of them throw, none look like
errors, and every one produces confident numbers that are wrong. `diagnose()`
turns a state snapshot into a ranked list, `nextAction()` picks the one thing to
do now, and the rules are unit-tested because the rules are the part most likely
to be wrong. Two conventions worth keeping if you extend it: **every fix is an
action** (the person is holding a guitar and can't do anything with a number), and
**only one is shown at a time** — six simultaneous complaints read as "this is
broken", one plus a count reads as a queue.

The original case, unchanged:

**The case for it:** every placement in `neckPlacement.js` is a guess, and the
module says so. The camera is weak at what audio is strong at (pitch) and strong
at what audio is *blind to* (position). `placePitch(pitch, ref)` already takes a
hand-position reference — **the camera's entire job would be to supply that one
argument.** Audio says *when* and *what*; video says *where*. Two numbers of
integration surface.

Prior art: [TapToTab (2024)](https://arxiv.org/abs/2409.08618) fuses YOLO
fretboard detection with FFT audio for exactly this reason — neither sensor
alone suffices. The audio half already exists here.

**Realistic capability, worst to best:**

| target | verdict |
|---|---|
| which string the *pick* hit | don't try — ~2 mm apart in image space, motion-blurred at 30 fps |
| exact fingertip→string contact | hard; the fretting hand occludes its own fingers |
| which fret a finger is on | moderate, once the neck is calibrated |
| **which region of the neck the hand is in** | **very achievable, and it's the one actually needed** |

**Path:** [`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision)
— 21 hand landmarks, WASM, in-browser, no training, no server.

**Three things that would bite:**
1. **A laptop camera points at your face.** It sees the neck foreshortened and
   half out of frame. This is the biggest obstacle and it is ergonomic, not
   algorithmic. A propped phone sees the neck; a laptop lid mostly doesn't.
2. **CPU contention.** An 8192-point FFT already runs every animation frame. Run
   vision at 10–15 fps — a hand doesn't move meaningfully in 60 ms.
3. **Calibration drift.** Tap the four neck corners once to solve a homography;
   it holds until you shift in your chair, then it's wrong *silently*. Needs a
   visible confidence readout and a fast re-calibrate.

All three are now instrumented rather than argued about. (1) is yours to solve
with a phone and something to lean it on — the bench cannot fix your camera
angle, it can only tell you the angle is losing. (2) reads out as ms/frame next
to the vision rate, which is a slider. (3) has a **drift alarm**: a fretting hand
the model can see whose fingertips keep projecting *off* the board means the
board has moved, and that is the one failure that is otherwise silent.

**How to decide.** Run it for ten minutes across the neck. Then:

- **camera wins by ≥ 0.35 frets** → worth wiring in. The integration is one
  argument: feed the smoothed fret to `placePitch(pitch, ref)` as `ref`, keep the
  audio hand tracker as the fallback for when the camera has no answer. Nothing
  else in the chain changes. `@mediapipe/tasks-vision` becomes a real dependency
  at that point and not before.
- **tie, or the guess wins** → the honest answer, and the cheap one. Delete
  `camera-test.html` and `src/vision/`. **This is a live possibility, not a
  formality** — if the angle is bad enough the heuristic wins, and learning that
  in a bench page is exactly what the bench page is for.

---

## 7. File map

| I want to change… | Go to |
|---|---|
| Mic sensitivity / what counts as music | `audio/chroma.js` → `GATE_DEFAULTS` (measured — see §2) |
| Chroma accuracy, harmonic suppression | `audio/chroma.js` → `CHROMA_DEFAULTS` |
| Key detection weighting | `music/keyDetect.js` → `KS_MAJOR` / `KS_MINOR` |
| Which scales can be named | `music/keyDetect.js` → `SCALE_SHAPES` (keep the list SHORT — seven notes will always fit something) |
| Fret placement / hand assumptions / trail feel | `music/neckPlacement.js` → `PLACEMENT_DEFAULTS` |
| Phrase length, implied-chord weighting | `music/riffAnalysis.js` → `RIFF_DEFAULTS` |
| Discord vs noise judgement | `music/spice.js` (shared with Discord Coach — changing it changes both) |
| Online send rate / wire shape | `net/riffWire.js` → `WIRE_DEFAULTS` (⚠️ stay under the server's 30 msg/s) |
| Floor / turn-taking rules | `server/index.js` → `case "FLOOR"` + `net/earSpyLink.js` |
| Whether Ear Spy is open to playtesters | `ui/RiffMenu.jsx` → `RIFF_MODES_UNLOCKED` |
| Camera geometry, fret spacing, hand reading | `vision/neckGeometry.js` → `VISION_DEFAULTS` (⚠️ `stringSlack` is loose on purpose — §6) |
| Snapping a pitch to a position, the learner | `vision/fretFusion.js` → `FUSION_DEFAULTS` (⚠️ read the aliasing limit first — §6a) |
| The camera sensor at runtime | `vision/cameraHand.js` (CDN-loaded MediaPipe; deliberately not an npm dependency) |
| What the camera panel says when it's wrong | `vision/visionCoach.js` (every fix is an ACTION; only one shown at a time) |
| Automatic neck detection | `vision/neckDetect.js` (⚠️ §6b — theory proven, `detectNeck` returns null) |
| The scoring bench | `camera-test.html` (bench only — never built, never shipped) |
