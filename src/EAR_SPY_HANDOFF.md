# EAR SPY HANDOFF — 👂 hear a room, read the neck

> **For AI editors + Alex.** The listening system: microphone → chords → key →
> frets → riff verdict, plus the online room that lets a friend's playing land
> on your screen. Written 2026-08-09. Unlike the other handoffs in this folder,
> **everything below is SHIPPED and tested** unless marked 🔭. Companion to
> `PRACTICE_MODES_HANDOFF.md` (its §0 rulings all apply — Ear Spy is a fifth
> practice room) and `NETCODE_HANDOFF.md` (the room server this rides on).
>
> Run `npm run test:chroma` (104 assertions) and `cd server && npm test`
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
cd server && npm test        # includes N13 ear spy smoke (21 checks)
npm run dev                  # → /listen-test.html   (tuning bench)
                             # → Riff Mode → 👂 EAR SPY  (the real room)
```

**Tuning to a real room** happens in `listen-test.html`. The sliders retune the
gate live *without restarting the mic* — deliberately, because the adapted noise
floor is part of what you're tuning and restarting throws it away. Sit in
silence and watch it say "ignoring"; talk near the mic, still "ignoring"; play,
"MUSIC". When the wrong thing gets through, the panel names which test let it
through.

---

## 6. 🔭 NOT BUILT — camera fusion

The open proposal, and the natural next step.

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

**Proposed first step:** a `camera-test.html` bench in the spirit of
`listen-test.html` — corner calibration, hand landmarks projected into neck
coordinates, and a readout of the camera's fret-region guess next to the
audio-only heuristic's. That tells you whether it beats the guess in *your* room
at *your* camera angle before any dependency is committed or anything is wired
in. **It may not clear the bar** — if the angle is bad enough the heuristic
wins, and it is much cheaper to learn that in a bench page.

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
