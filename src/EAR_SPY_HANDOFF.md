# EAR SPY HANDOFF — 👂 hear a room, read the neck

> **For AI editors + Alex.** The listening system: microphone → chords → key →
> frets → riff verdict, plus the online room that lets a friend's playing land
> on your screen. Written 2026-08-09. Unlike the other handoffs in this folder,
> **everything below is SHIPPED and tested** unless marked 🔭. Companion to
> `PRACTICE_MODES_HANDOFF.md` (its §0 rulings all apply — Ear Spy is a fifth
> practice room) and `NETCODE_HANDOFF.md` (the room server this rides on).
>
> Run `npm run test:chroma` (126), `npm run test:vision` (197),
> `npm run test:detect` (48, 1 pending) and `cd server && npm test`
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
- **`audio/chromaSelftest.mjs`** — 110 assertions. `npm run test:chroma`.

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

⚠️ **AND HERE IS WHAT THAT 100% MISSED, BECAUSE IT IS THE BEST WARNING IN THIS
FILE ABOUT WHAT A SYNTHETIC SUITE CAN AND CANNOT TELL YOU.** `tone()` weights
partial *n* by 1/n^bright, so **the fundamental is always the loudest partial** —
and that is precisely the one arrangement in which the harmonic-suppression pass
cannot go wrong, because magnitude order and frequency order agree. A hundred and
four assertions, ten chord types, overdrive and detune and noise, and every one
of them was built on the assumption that hid the bug. The first person to point a
microphone at an actual guitar saw it in seconds: *"the gems are jittery, and it
gets confused on octaves."* A real low E's 82 Hz fundamental is routinely weaker
than its octave. **When you add a synthetic case, ask what it is quietly holding
constant.**

⚠️ **AND THE SAME QUESTION, ASKED AGAIN, FOUND THE SAME BUG ONE STEP FURTHER
ALONG.** The fix above assumes the fundamental is in the peak list at all. Here
is what happens as it gets quieter, measured on an E2 with a real low string's
partial balance:

| fundamental, relative to the strongest partial | what comes back |
|---|---|
| −12 dB | E2 1.00 · E3 0.50\* · B3 0.39\* · E4 0.33\* |
| −20 dB | E2 1.00 · E3 0.79\* · B3 0.61\* · E4 0.53\* · G♯4 0.43\* · B4 0.35\* |
| **−26 dB** | **E3 1.00 · B3 0.77 · G♯4 0.54 · D5 0.38** |

(`*` = flagged as an overtone.) The cliff is at **−24.4 dB**, where the
fundamental drops under `peakFloorRatio` — which is measured against the loudest
peak *anywhere in the band*, not against its own neighbourhood, so any low-end
rolloff walks you toward it. Below the cliff nothing is flagged, because there
is no lower peak left to flag anything against, and one plucked string is four
confidently-played notes an octave up. **A threshold that deletes evidence
disables every guard that runs downstream of it.**

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
| **One plucked string read as three notes, and the neck jittered** | `chromaFromPeaks` walked peaks STRONGEST-first while only letting already-seen (therefore louder) lower peaks act as parents — so a harmonic was discounted only if its own fundamental happened to be louder than it, which on a low string it often is not | Suppression pass runs in ascending FREQUENCY order + "a weak fundamental must not become three phantom notes" |
| The melody trail walked away from the plucked string | The trail follows the TOP VOICE, and an overtone is always higher than the note that made it, so any surviving harmonic captured the melody | `notes[].harmonic` flag + the trail skips flagged notes + "four frames of one held note make ONE melody step" |
| **One plucked string read as FOUR notes an octave up, none of them flagged** | The row above fixes a fundamental that is *weak*. `pickPeaks` deletes one that is *quiet*: `peakFloorRatio` is measured against the loudest peak anywhere in 73–2093 Hz, so a low E's 82 Hz fundamental vanishes at −24.4 dB relative to its own strongest partial — ordinary rolloff for a laptop mic. Every partial is then an orphan, takes full weight and `harmonic: false`, so the trail's skip-the-flagged rule has nothing to skip | `inferVirtualFundamentals` recovers f0 from the partial SPACING + "an ABSENT fundamental must not become four phantom notes" |
| A D minor 7 lost its seventh and read as a triad | The first draft of that inference counted every matching peak as evidence. **A major triad is roughly 4:5:6 — i.e. itself a harmonic series** — so a chord's own upper partials voted for a root underneath it, which then suppressed a real chord tone as its overtone | Three guards, all load-bearing: only *unexplained* peaks count; ±7¢ not ±60¢ (equal temperament is measurably not the harmonic series); coprime indices + "a chord is not a harmonic series" |
| A note blinked on and off through its own decay | `noteFloor` is a cliff, and the partial balance moves continuously while a string rings. Measured: the discounted octave crosses 0.30 at a partial ratio of ~1.5 and the ratio wanders either side of it | `makeNoteHold` — admit at `noteFloor`, release at `noteFloorRelease` + "nothing is ever dropped with it" |

---

## 4. Known limits — documented, not bugs

- **Exact octave doubles collapse.** E4 is the 4th harmonic of E2, so "E2 played
  brightly" and "E2 + E4 together" are the same spectrum. No mic-based method
  separates them. We keep the lower note. Lowering `noteFloor` to "recover" the
  octave does not recover information that was never there — it prints a phantom
  octave above every single note.
- **A missing fundamental is recovered for ONE string, not for a chord.**
  `inferVirtualFundamentals` needs four partials that nothing else in the frame
  explains. A single plucked note leaves exactly that ({2,3,5,7}; 4, 6 and 8 are
  covered by 2, 3 and 4). A chord does not — its bass partials are mostly
  accounted for by the other notes — so a strummed chord whose lowest
  fundamental was rolled off will *not* have it restored. That is the correct
  side to fail on: declining costs the old behaviour, while a false invention
  prints a note nobody played, an octave down, as the loudest thing in the
  frame. The octave jitter this exists for lives on single notes anyway.
- **A recovered fundamental is an inference and says so.** `notes[].virtual`
  marks it, `energy` excludes it, and `listen-test.html` prints it as `~`. A `~`
  under everything you play means the low end is being lost before we see it —
  worth fixing at the mic, where the information still exists.
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
npm run test:chroma          # 126 assertions, pure, no mic
npm run test:vision          # 197 assertions — camera geometry, fusion, the snap, the hand, the coach
npm run test:detect          #  38 on auto-detection (1 PENDING — see §6b)
cd server && npm test        # includes N13 ear spy smoke (21 checks)
npm run dev                  # → /RLSW/listen-test.html  (tuning bench)
                             # → /RLSW/camera-test.html  (§6 fusion bench)
                             # → Riff Mode → 👂 EAR SPY  (the real room)
```

**Tuning to a real room** happens in `listen-test.html`, which now also prints
the **register list** under the gate panel — the thing the neck actually draws.
The chroma bars cannot show you an octave error, because they have folded the
octave away: a low E read as its own second partial looks identical to a low E
read correctly. That row is where you see it. `*` = overtone, `~` = inferred
fundamental. The sliders retune the
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
> noted in `fretFusion.js`. Run `npm run test:vision` (197) and
> `npm run test:detect` (48, 1 pending) first; between them they state every
> claim this section makes.

**Status: measured twice, and it won both times. Now wired in.** The bench was
built first, the camera was scored against the audio heuristic on hand-logged
ground truth, and the bar — set in advance — was 0.35 frets, below which the
camera is *not worth the dependency*.

| | run 1 · 8 logs | run 2 · 10 logs |
|---|---|---|
| | 📷 camera / 👂 audio | 📷 camera / 👂 audio |
| median absolute error | **0.44** / 2.53 | **0.21** / 3.22 |
| mean absolute error | **0.55** / 3.19 | **0.22** / 2.94 |
| within one fret | **88%** / 25% | **100%** / 10% |
| worst miss | **1.4** / 7.9 | **0.4** / 5.7 |
| camera wins by | 1.98 frets | **3.01 frets** |

⚠️ **BOTH RUNS ARE KEPT ON PURPOSE, AND THE SPREAD BETWEEN THEM IS THE POINT.**
The camera's median halved between sessions while nothing in the code changed
that would explain it. The variable is the one §6 says is yours and not the
software's — **camera placement**. So the honest reading is not "the camera is
accurate to 0.21 frets", it is "the camera is accurate to somewhere between 0.2
and 0.45 frets *depending on how you set it up*, and both ends of that range win
by a mile". Collapsing this to the better number would turn a range into a
promise.

⚠️ **Read the log, not just the summary.** In run 1 the audio estimate never left
a three-fret band around its rest position (3.1, 6.1, 5.4, 6.1, 6.0, 4.9, 3.1,
5.9 against truths of 2, 4, 5, 7, 9, 9, 11, 12). Run 2 is tighter still — 5.0,
5.4, 5.7, 5.8, 6.1, 6.2, 6.3, 6.4, 6.7, a **1.7-fret band**, against truths from
2 to 12. It is not estimating position badly; it is reporting `restFret: 5` with
a wobble. **It carries almost no positional information at all.** That is not a
defect in `neckPlacement` — it is what a pitch can tell you about a position, and
that module has said so about itself from the beginning.

**What run 2 means for §6a's requirement.** Candidates are ≥4 frets apart, so the
decision boundary sits 2.0 frets away. Run 2's RMS is ~0.25 against run 1's 0.66,
and the **worst single miss was 0.4 — a 5× safety factor on the worst observed
case**, not on the average. Every logged position would have snapped
*confidently*: the tightest, 7.4, gives a margin of 1.6 against the 1.2 bar, and
11.6 gives 2.1. Not one would have fallen back to the audio guess.

⚠️ **A caveat about the bench itself, since it flatters nobody to leave it out.**
The strip you click to log truth also carries a live marker for each estimator,
so the camera's answer is on screen at the moment you record the truth. That
cannot manufacture sub-fret accuracy — clicks are quantised to whole frets, and
no anchoring effect makes a reading of 7.2 out of a click of 7 — but it can bias
*when* you click, toward moments when the markers look settled. Anyone repeating
this should log to a metronome, or hide the markers while logging.

Caveat that stands: eighteen logs across two sessions, one room, one angle, one
guitar. Decisive on the gap, still silent on whether it holds in a dark room or
on a different instrument.

### What was wired, and how little of it

- `music/neckPlacement.js` gained `setRef` / `refSource` on `makeNeckTracker`.
  The camera supplies **`placePitch`'s `ref` argument**. Audio says WHEN and
  WHAT; video says WHERE.
- ✅ **…and now `setSnap` / `snapping` as well — the exact answer, wired.** A
  reference and a snap are two strengths of the same help and both earn their
  place: a reference re-ranks `placePitch`'s candidates and still yields a
  continuous estimate, while a snap names the position outright and reports the
  margin to the boundary. See §6a — this is the step that makes the reading
  exact rather than merely nearer, and until now it was built and tested but
  **not on screen**. ⚠️ `neckPlacement` must never import the vision code: the
  snap is a FUNCTION the caller closes over, so the audio side stays runnable
  and testable with no camera, no MediaPipe and no vision module in the graph.
  Twelve assertions in `npm run test:vision` say what it must do.
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
| ⇒ accuracy it has | 0.66 RMS run 1, **0.25 run 2** — 3× to 8× better than required |
| ⇒ simulated wrong-pick rate | **0.24%** at 0.66 RMS; nothing missed at all in run 2 |

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

✅ **Wired into the room** (see §6). Three rulings worth keeping if you touch it:

1. **A boundary case declines and the audio estimate stands.** `confident` is
   false within 1.2 frets of the flip point; snapping anyway would put a
   specific, confidently wrong fret on screen in exactly the cases the maths
   calls a coin toss. The failure mode is a quieter reading, never a wrong one.
2. **An exact cell is drawn at full `level`, a guessed one at `guessLevel`
   (0.55) — and only while the camera is on.** With no resolver attached there
   is nothing to contrast against, so `level` is left absent entirely and
   `FretboardFull` draws precisely what it always drew. ⚠️ Grading every cell
   down unconditionally would dim the whole neck for the players who never turn
   the camera on, who are the default. There is a test named for that.
3. **The hand tracker is fed the SNAPPED positions.** A measured position is
   better evidence of where the hand is than an inferred one, so the fallback
   gets sharper the more the camera resolves — same argument as the note on
   `externalRef`, and tested the same way.

⚠️ **Turning the camera off tears down the reading, not just the panel.**
Unticking the box unmounts `CameraCalibrator`, but the last hand position it
delivered is still in the ref — without an explicit teardown the neck goes on
snapping every note to wherever your hand was when the panel closed.
Stale-but-plausible is the worst failure this feature has.

### 6c. ✅ 🖐 One hand — the chord constraint, shipped

Notes sounding together must be reachable by **one hand**, which is a far
stronger constraint than each note alone. `handShape` decides; `snapChord`
solves the whole frame against it.

⚠️ **THE CONSTRAINT IS NOT A FILTER, IT IS EXTRA INFORMATION.** This is the part
worth understanding before touching it. Rejecting impossible shapes after the
fact would be worth little; solving the notes JOINTLY is worth a lot, because a
note whose own margin is a coin toss is frequently settled outright by its
neighbours — often only one assignment leaves the chord playable. The constraint
makes the answer *better*, not just safer.

**Three rules, and one of them replaced three.**

1. **Span** — `maxSpan` comes from `guitarMap.WINDOW`, not from a number chosen
   here. That constant already means "the frets a hand covers without moving"
   and the riff voicer has used it for ages. ⚠️ A project holding two opinions
   about how far a hand reaches would eventually draw a chord its own voicer
   would never have written.
2. **One string, one note** — the cheapest check and the one the independent
   snap broke most often: two notes a fourth apart both land happily on the same
   string and nothing downstream noticed.
3. **Fingers**, with ⚠️ **barres NOT special-cased.** Writing a rule for a barre,
   another for a partial barre and another for the low-fret exception is how
   this gets complicated and wrong. One finger lies flat across a **run of
   adjacent strings at one fret** — a full barre and a two-string ring-finger
   squash are the same physical act at different widths, so they get one rule
   and both fall out of it. A run breaks on a string the finger would have to
   lie on and must not: one that is **open** (it would be muted) or fretted
   **lower** (the note nearer the bridge is the one that sounds, so the lower
   note could never speak). An unplayed string is no obstacle.

⚠️ **The thumb is not a fifth finger.** It comes over the top, reaches exactly
one string — the fattest — and only near the shape's lowest fret. Modelled as
that narrow allowance, because "five fingers" would wave through shapes no hand
can make. There is a test asserting the same five-note shape is playable with the
spare note on the low E and impossible with it anywhere else.

⚠️ **Every count is a LOWER BOUND, deliberately.** `handShape` answers "could a
hand do this", and does not decide which finger goes where — a much harder
problem, with many valid answers, none of them needed to reject an impossible
shape. Erring toward *reachable* is the safe direction: a false rejection changes
the note on screen, a false acceptance merely fails to improve it.

⚠️ **And it never blanks.** No reachable assignment ⇒ the independent snaps
stand. Handoff ruling 3 — a rejected frame HOLDS. Showing nothing because the
chord "should be impossible" would be the system calling the player wrong.

**Measured cost**, because it runs twice per animation frame:

| frame | µs/call | share of a 60 Hz frame, both calls |
|---|---|---|
| one note | 13.9 | 0.17% |
| triad | 28.8 | 0.34% |
| four-note voicing | 27.1 | 0.32% |
| six-string barre | **37.4** | **0.45%** |
| six notes, nothing playable | 7.5 | 0.09% |

Branch-and-bound plus most-constrained-note-first ordering is what keeps it
there; `maxHandSearch` is a ceiling that is never reached in practice and exists
only so a pathological frame cannot stall the render loop.

**Tested against chords that exist** — open E, C and G, the F barre, the Hendrix
E7♯9 — rather than against the rule restating itself. Plus what is *not*
playable: a seven-fret spread, five notes on five frets, two notes on one string,
and a barre broken by an open string in its middle.

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
survives outliers. **`detectNeck` returns null and is not wired into the bench.**
The test suite marks this ⏳ PENDING rather than asserting it, so the gap stays
visible without leaving a permanently red suite.

⚠️ **The nut is no longer the blocker, and the previous entry here named the
wrong cause.** It said `looksLikeBoardEnd` was being handed a stray outer line.
The real defect was a **coordinate-space mismatch**, and it is worth reading
because it is the kind that cannot be found by reasoning about the algorithm:

- ρ is normalised by `max(w, h)`, so `lineIntersection` returns points in **Hough
  space**, while `looksLikeBoardEnd` indexes `gray[y·w + x]` and needs **pixels**.
- Handed Hough-space points, both the inside strip and the beyond strip sampled
  pixel (0, 0). `diff` was **exactly 0.000 at every candidate line**, so `isEnd`
  was never true, so the anchor never landed.
- The proposed fix — try more candidate lines — **could never have worked**:
  every candidate returned the same zero. There is now a test that asserts the
  contrast is exactly zero in Hough space and non-zero in pixels.
- A **third** space is in play: `CameraCalibrator` collects clicks and MediaPipe
  reports landmarks as `[x/w, y/h]`, which is *anisotropic* and so is neither of
  the other two. `detectNeck` now converts explicitly at both boundaries.

Two more real defects fell out alongside it: the homography block walked
`ident.frets` (inliers only) with an index into `frets` (every line), reading
past the end of the shorter array; and the pass-2 line cap was shared with
pass 1, which **deletes the extremities first** — a foreshortened edge fret
scored 0.77 against a cut of 0.776, so the nut was dropped by four thousandths of
a vote in all three views. Fixed, and both have tests.

**What is actually left is condensing lines**, and it is a real problem rather
than a loose end. Pass 2 has to reach deep into the ranked candidates or it loses
the nut; reaching that deep also admits the **shoulders of each fret's Hough
ridge** — phantom lines ~7 px from a real fret while real frets are 14–24 px
apart. (Not a fixture artefact: the synthetic board fill was checked and is
solid.) `mergeNearby` cannot remove them, because its tolerance is derived from
the observed gaps and **fret spacing varies threefold along one neck**, so no
single tolerance separates a duplicate from a genuine high fret. With the
shoulders present, `identifyFrets` prefers a **stretched** labelling that gives a
fret and its own shoulder consecutive numbers — residual 0.0024, 20 inliers, and
**one label in twenty correct**. Widening `nmsRhoFrac` to 0.025 gives 17/17
correct labels square-on and starves the other two views of lines entirely.

✅ **The good news is that it now fails the right way.** Both ends of the board
pass the nut test with contradictory labellings, and rather than picking one,
`detectNeck` declines. That veto (`labellingsAgree`) is the only thing that can
catch a wrong anchor — the module header explains why no geometric test can —
and it is tested against a reversed labelling, a one-fret-shifted labelling, and
the no-overlap case. Previously the detector returned null for a trivial units
reason; it now returns null because the evidence genuinely does not support an
answer, which is the behaviour that should survive whatever comes next.

⚠️ **Cost is a constraint on any fix.** `identifyFrets` searches pairs of lines
against pairs of fret numbers, so it is O(m²·F²): **194 ms at m = 20, 1.4 s at
m = 44, 3.5 s at m = 60**, and the nut search calls it once per surviving
candidate. `thinByPosition` exists to hold m near the number of frets that can be
in shot; it keeps runtime around 700 ms, and it is *also* currently costing
accuracy. Anything that solves condensation has to stay inside that budget.

Next step, in the order that looks most likely to pay:
1. **Kill the ridge shoulders at the source** — a per-fret-orientation local
   maximum along ρ, rather than one global NMS radius that has to be right for
   both a 24 px gap at the nut and a 14 px gap at the 12th.
2. **Inlay dots** as the anchor instead (needs three or more, or the visually
   distinct double dot — two plain dots are as reversible as two frets).
3. If neither holds up, the literature's answer is a trained detector: TapToTab
   went to YOLO for exactly this reason.

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

**How it was decided — ✅ ANSWERED, TWICE, AND THE TEST IS KEPT HERE ON PURPOSE.**
The rule was written before any data existed, which is the only time such a rule
is worth anything:

- **camera wins by ≥ 0.35 frets** → worth wiring in. The integration is one
  argument: feed the smoothed fret to `placePitch(pitch, ref)` as `ref`, keep the
  audio hand tracker as the fallback for when the camera has no answer. Nothing
  else in the chain changes. `@mediapipe/tasks-vision` becomes a real dependency
  at that point and not before.
- **tie, or the guess wins** → the honest answer, and the cheap one. Delete
  `camera-test.html` and `src/vision/`. **This was a live possibility, not a
  formality** — if the angle is bad enough the heuristic wins, and learning that
  in a bench page is exactly what the bench page is for.

**Outcome: 1.98 frets in run 1, 3.01 in run 2 — five to eight times the bar.**
Wired in, and `@mediapipe/tasks-vision` still is *not* an npm dependency, because
it loads from a CDN on demand and bundling it would cost ~2 MB for every player
who never ticks the box.

⚠️ **Do not delete the bench now that the answer is in.** It is the only thing
that can tell you a *new* camera position is worse than an old one, and run 2
showed that placement moves the median by 2×. It is also the only check on the
aliasing failure in §6a, which no guard covers.

---

## 7. File map

| I want to change… | Go to |
|---|---|
| Mic sensitivity / what counts as music | `audio/chroma.js` → `GATE_DEFAULTS` (measured — see §2) |
| Chroma accuracy, harmonic suppression | `audio/chroma.js` → `CHROMA_DEFAULTS` |
| Whether a fundamental the mic lost gets recovered | `audio/chroma.js` → `inferVirtualFundamentals` (⚠️ read all three guards before loosening any of them — a chord IS nearly a harmonic series) |
| How long a marginal note stays on screen | `audio/chroma.js` → `noteFloor` / `noteFloorRelease`, applied by `makeNoteHold` (⚠️ analysis must run at the RELEASE floor or the hold sees nothing to hold) |
| Key detection weighting | `music/keyDetect.js` → `KS_MAJOR` / `KS_MINOR` |
| Which scales can be named | `music/keyDetect.js` → `SCALE_SHAPES` (keep the list SHORT — seven notes will always fit something) |
| Fret placement / hand assumptions / trail feel | `music/neckPlacement.js` → `PLACEMENT_DEFAULTS` |
| How certain vs guessed positions are drawn | `music/neckPlacement.js` → `guessLevel` (⚠️ only applied while a snap is attached — see §6a) |
| Where the exact-position snap plugs in | `music/neckPlacement.js` → `setSnap` on `makeNeckTracker`; supplied by `ui/ListenNeck.jsx` (⚠️ never import vision code here; the resolver takes the WHOLE frame — see §6c) |
| What one hand can hold / chord snapping | `vision/fretFusion.js` → `HAND_DEFAULTS`, `handShape`, `snapChord` (⚠️ `maxSpan` comes from `guitarMap.WINDOW` — don't fork it) |
| Phrase length, implied-chord weighting | `music/riffAnalysis.js` → `RIFF_DEFAULTS` |
| Discord vs noise judgement | `music/spice.js` (shared with Discord Coach — changing it changes both) |
| Online send rate / wire shape | `net/riffWire.js` → `WIRE_DEFAULTS` (⚠️ stay under the server's 30 msg/s) |
| Floor / turn-taking rules | `server/index.js` → `case "FLOOR"` + `net/earSpyLink.js` |
| Whether Ear Spy is open to playtesters | `ui/RiffMenu.jsx` → `RIFF_MODES_UNLOCKED` |
| Camera geometry, fret spacing, hand reading | `vision/neckGeometry.js` → `VISION_DEFAULTS` (⚠️ `stringSlack` is loose on purpose — §6) |
| Snapping a pitch to a position, the learner | `vision/fretFusion.js` → `FUSION_DEFAULTS` (⚠️ read the aliasing limit first — §6a) |
| The camera sensor at runtime | `vision/cameraHand.js` (CDN-loaded MediaPipe; deliberately not an npm dependency) |
| What the camera panel says when it's wrong | `vision/visionCoach.js` (every fix is an ACTION; only one shown at a time) |
| Automatic neck detection | `vision/neckDetect.js` (⚠️ §6b — `detectNeck` still returns null, but the blocker is now line condensation, not the nut) |
| How many lines pass 2 keeps | `vision/neckDetect.js` → `maxFretLines` / `positionBins` (⚠️ never rank frets by votes — it deletes the nut first) |
| The scoring bench | `camera-test.html` (bench only — never built, never shipped) |
