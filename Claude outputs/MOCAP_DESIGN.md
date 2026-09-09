# MOCAP DESIGN — 🕺 record the movement once, ship it to everyone

> **For AI editors + Alex.** How Alex's own body, face and guitar become the
> animation the Spirits move with. Written **2026-09-08**, promoted out of
> `IDEAS_INBOX.md` (the 2026-09-08 [P2] mocap pipeline entry and the [P3]
> finger/guitar mapping entry).
>
> ⛔ **DESIGN ONLY. NOTHING HERE IS BUILT.** No module, no suite, no script. The
> only code this doc touches today is `vision/cameraHand.js`, which it copies a
> *shape* from and does not modify.
>
> 🎯 **The one-sentence version.** Alex performs the moves in front of a camera
> **once**; a heavy offline model turns that video into animation clips; the clips
> ship inside the game like any other asset, and **no player ever needs a webcam.**
>
> 📌 Companion to `EAR_SPY_HANDOFF.md` §6 — the camera fusion already shipped
> there is the working proof that this project can point a camera at a person and
> get a usable number out. **Read its §6 and §6a before proposing anything here**;
> half the traps below are ones that section already paid for.

---

## 0. Rulings that govern everything

**1. ⭐ RECORD ONCE, SHIP CLIPS. The webcam is a DEV TOOL, not a runtime.**
The obvious version of this idea is a player's camera driving their character
live. That version is deferred on purpose and §8 says why. Everything in this doc
assumes the capture happens on Alex's machine, at leisure, and the *output* is a
baked animation clip. 🎯 **This single ruling deletes most of the hard problems in
the field**: no latency budget, no CPU contention, no lighting variance, no
"works in my room" — and the model may be as slow and heavy as you like, because
nothing is waiting on it.

**2. ⚠️ THREE STREAMS, THREE PIPELINES, AND THEY ARE NEVER MERGED.**
Body, face and guitar are different problems with different data shapes, and
fusing them into one "holistic" pass is the mistake. This is `EAR_SPY_HANDOFF`
§0.1 one level up: *polyphony is not a tuning problem, it is a different
algorithm class*. Body produces a **skeleton**; face produces **52 scalars**;
the guitar produces **nothing at all** (§2c). A single pipeline carrying all
three would be three pipelines with a shared bug surface.

**3. ⭐ THE GUITAR IS MEASURED WITH MARKERS, AND SOLVED FROM THE WRISTS ONLY AS A
FALLBACK.** 🪦 **SUPERSEDED 2026-09-08, THE SAME DAY IT WAS WRITTEN** — the
original ruling read *"the guitar is SOLVED, not tracked"*, on the argument that
two wrists plus a known instrument length over-determine its pose. ⚠️ **That is
true only while both hands are on it in playing position, and most of §7's clip
list is not that.** See §2c for the failure and the replacement.

**4. ⭐ THE FACE IS A LAYER, NOT A TRACK.**
It is driven by **game state** — took a hit, landed a big note, won the round —
never by the body clip's frame counter. ⚠️ **This is what makes separate takes
free.** Weld the face to the body timeline and you have created a synchronisation
problem that did not previously exist, in exchange for nothing anybody watching
will notice.

**5. ⛔ THE RIG COMES FIRST, AND IT BLOCKS EVERYTHING.**
Motion data with no skeleton to drive is a CSV. The Spirits are currently
`standees/*.png` — flat art. 📌 **`three` 0.180.0 is already a dependency and the
3D cosmic arena already ships** (`STATE_OF_PLAY.md` §5), so the renderer is not
the gap; a *skinned, named, rest-posed character* is. §3.

**6. ⚠️ NOTHING GOES ON THE PLAYER'S CRITICAL PATH.**
`cameraHand.js` earned its keep by keeping MediaPipe off the bundle entirely —
CDN, dynamic import, no npm dependency, invisible until someone ticks a box. The
capture tooling here is stricter still: it is **dev-time only** and need not be in
the shipped bundle at all. What ships is a baked clip, which is just an asset.

**7. A bad frame HOLDS, it does not blank.**
`EAR_SPY_HANDOFF` ruling 3, and it applies to a limb exactly as it applied to a
note. A character whose arm vanishes for two frames when the model loses
confidence reads as broken; one whose arm lags slightly reads as fine.

**8. 📏 SET THE BAR BEFORE MEASURING.**
§6 set 0.35 frets *in advance* and that is why its result meant something. §5
below sets this project's bar before a single frame is captured. ⚠️ Choosing the
bar after seeing the output is how a pipeline passes its own exam.

---

## 1. What already exists and gets reused

| asset | where | what it gives this |
|---|---|---|
| The **sensor shape** | `vision/cameraHand.js` | Dynamic CDN import, `hz` throttle, a `state()` readout the UI can narrate, a teardown that actually tears down. Copy the shape; **do not import it** — it is a fretting-hand sensor, not a base class |
| `makeVisionTracker` | `vision/neckGeometry.js` | Staleness, hold and decay over *any* landmark stream. Ruling 7 is already implemented here |
| **`three` 0.180.0** | `package.json` | Already a dependency. Skinned meshes, `AnimationClip`, GLTF loading — all present, none of it new cost |
| The **3D cosmic arena** | `board/arenaRenderer.js` etc. | The scene the character has to stand in already exists and is under `test:arena` |
| The **bench habit** | `camera-test.html`, `listen-test.html` | The pattern that made §6 trustworthy: build the measuring instrument *before* the feature. §7 step 1 |
| The **preview rule** | `CLAUDE.md` | ⚠️ This is a visual feature end to end. **Every taste call is a slider on a page in `.scratch/`, and nothing is ported until Alex has dialled it in and screenshotted the panel.** |

---

## 2. The three streams — but only TWO takes

| | 🕺 **BODY** | 😐 **FACE** | 🎸 **GUITAR** |
|---|---|---|---|
| model | `pose_landmarker` | `face_landmarker` | ⭐ **none — ArUco geometry** |
| output | 33 joints, `worldLandmarks` (metres, hip origin) | **52 blendshape scalars** (+478 landmarks, unused) | ⭐ **6DoF pose per frame**, + the wrist solve as fallback |
| drives | the rig's bones | morph targets | a rigid prop node |
| take | wide, whole body in frame | **close-up, separate take** | ⭐ **rides along with the body take** — markers on the instrument |
| timeline | the base layer | ⭐ event-driven, own clock | the body take's own frames |

⚠️ **The guitar is not a third session.** It is **the body take with a marked
instrument in it** — same video, same frames, a second pass over them. Only the
face needs a take of its own (§2b).

Both models live in the **same `@mediapipe/tasks-vision` bundle already loaded
from jsDelivr** for the fretting hand — same `FilesetResolver`, same
`createFromOptions`, same `detectForVideo`. 🎯 **The tracking swap is close to
free; everything expensive in this doc is downstream of it.**

### 2a. 🕺 Body — the base layer

`worldLandmarks` are already metric and hip-centred, so **there is no homography,
no four clicks, and no `CameraCalibrator`.** §6b's whole automatic-calibration
thread simply does not apply: nothing is being projected onto a plane, so nothing
can drift off one.

⚠️ **What those 33 points are NOT.** They are shoulders, elbows, wrists, hips,
knees, ankles and a face cluster. There is **no spine chain** — a torso is
inferred from four points — and **no wrist or forearm roll**, which is
unobservable from landmark positions in principle, not just in practice. 📌 **The
rig must therefore not be built expecting data it will never receive**: a
five-bone spine and a twist bone will be animated by interpolation and guesswork,
which is fine as long as nobody later "fixes" them by hunting for missing input.

### 2b. 😐 Face — a separate take, for reasons of physics

A camera framed on a whole body puts the face at perhaps 40 pixels across.
`face_landmarker` wants considerably more. **You cannot have a good wide shot and
a good close-up in one frame**, and no amount of code fixes a face that is four
dozen pixels wide — ergonomic, not algorithmic, exactly like §6's warning that a
laptop camera points at your face and sees the neck end-on.

✅ **And the payoff for splitting is large.** The model returns **ARKit-style
blendshape coefficients** — `jawOpen`, `browInnerUp`, `eyeSquintLeft` and 49 more
— which drop **straight onto morph targets with no retargeting at all.** No
skeleton, no bone roll, no rest pose. It is the cheapest of the three pipelines
by a wide margin *provided* ruling 4 holds and nobody tries to sync it.

### 2c. 🎸 Guitar — MARKED, then measured

⚠️ **THIS SECTION WAS REWRITTEN THE DAY IT WAS WRITTEN, AND THE FIRST VERSION IS
KEPT BECAUSE THE MISTAKE IS INSTRUCTIVE.**

**What the first draft said**, and it was not silly: the strumming hand sits near
the bridge, the fretting hand on the neck, so the line between the two wrists —
scaled to the real instrument — *is* the guitar. A rigid body with both ends held.
Solve it, don't detect it.

🪦 **Why that is wrong, and Alex found it: it holds only in PLAYING POSITION.**
Look at what §7 step 7 actually asks for — play, **weapon swing**, hit, fall,
recover — and the playing pose is one item on a list of five.

| pose | what the two wrists give you |
|---|---|
| playing | hands far apart along the body ⇒ ✅ the line is genuinely the guitar |
| swung like an axe | **both hands gripped together near the neck** ⇒ ⛔ a short baseline, and a centimetre of wrist error swings the far end through a huge arc |
| raised or held overhead, one-handed | ⛔ **no constraint at all** — the guitar rotates freely about the one hand and the wrists cannot say which way it points |

🎯 **It is a lever-arm problem.** The shorter the baseline between the hands, the
more the far end of the instrument amplifies any error in them. The solve does not
degrade gracefully into "approximate"; on a one-handed raise it degrades into
"unconstrained".

### ⭐ The replacement: fiducial markers, and ruling 1 is what makes them free

Put **ArUco / AprilTag squares on the guitar** — printed on paper, taped on. A
marker is a **known-size square with a known pattern**, so a single camera
recovers full **6DoF pose, position *and* rotation, from one visible marker**. It
is plain projective geometry in OpenCV: **no ML, no training set, no model
download, no CDN.**

🎯 **AND THE MARKERS NEVER SHIP, WHICH IS THE WHOLE ARGUMENT.** Because ruling 1
put the capture offline, the tape exists only in Alex's room on the day. No player
sees it; no player is ever asked to sticker their own guitar. ⚠️ **Under the §8
live-webcam design this option would be unavailable** — you cannot ask an audience
of *"the ultimate beginner"* to print fiducials. **The offline decision is what
buys the good answer here**, which is worth noticing the next time §8 is
questioned.

**Three clusters, not one — face, back and headstock.** ⚠️ The guitar body
occludes the strumming arm on most frames of most takes, which was named below as
this project's worst monocular case. Markers on non-coplanar faces mean **at least
one cluster is visible through nearly all of it**, and the occluder becomes the
thing carrying the measurement.

**And a marker of precisely known size fixes SCALE** — the ambiguity monocular
video cannot otherwise resolve. Measure the printed square with calipers and write
the number down; it is a constant of the whole capture.

📌 **The connection to what already shipped.** An ArUco marker is **four known
coplanar points, found automatically, every frame** — the same homography
`vision/neckGeometry.js` already solves for the fret calibration, minus the four
clicks and minus §6b's whole unfinished auto-detection thread. And it is the same
trade `EAR_SPY_HANDOFF` §6 already made once and won: **the camera beat the audio
heuristic because it measured where the other guessed.** Markers over
landmark-inference is that upgrade one level along.

⚠️ **THE COST, AND IT IS A FAMILY ALEX HAS ALREADY PAID INTO.** A marker that
peels, shifts or gets re-taped between takes silently changes the guitar's
geometry — **every number stays plausible and becomes wrong.** That is
`cameraHand.js`'s calibration-drift alarm wearing a different hat. Mitigations:
photograph the placement, never re-tape mid-session, **matte paper only** (a
specular highlight destroys detection), keep them clear of where the hands land,
and open every session with a **still calibration take** relating the marker frame
to the instrument's geometry once.

⭐ **The wrist solve is NOT deleted — it is demoted to the fallback**, for frames
where every cluster is hidden. Ruling 7: a bad frame holds, it does not blank.

### And the photo, which is still worth sending

✅ **For the LOOK, and only that.** Finish, headstock shape, scratch plate,
stickers — asset work for §3a's requirement 5. ⛔ **A photograph contains no
motion**, so it was never going to drive anything. 📌 It now has a second use: the
instrument's real dimensions, alongside the measured marker size, are the scale
reference above.

🪦 **Markerless 6DoF on the guitar's natural appearance** — training a detector on
Alex's specific instrument — stays rejected. It is real work, needs a training
set, and buys nothing over a printed square **in a record-once context**. 🔭 It
would only become interesting if §8 were ever reversed.

---

## 3. ⛔ The rig — the gating dependency, and it is not tracking

Everything above is a week. This is the project.

**What the rig must have:**

1. A **skinned mesh with named bones** in a hierarchy, exported as GLTF.
2. A **known rest pose** — T or A, chosen once and written down. ⚠️ Retargeting is
   almost entirely rest-pose alignment; getting this wrong produces a character
   that is correct in motion and permanently rotated.
3. **Proportions recorded**, because Alex's limb lengths are not the Spirits'. A
   Ronin with Alex's arm-to-torso ratio is Alex in a costume, and the Metalness
   Monster's ratio is not human at all. Retarget by **rotation**, not position.
4. The **guitar as its own node**, parented so §2c can drive it.
5. **Morph targets** for the face layer, named to the blendshape list so §2b is a
   lookup and not a translation table.

**What retargeting actually costs:** rest-pose alignment · bone roll · hip height
and scale normalisation · foot planting so the character does not skate · and a
retarget map that is **written down as data, not inferred**, so a rig change is a
table edit rather than an archaeology session.

### 3a. 📋 The brief to hand whoever makes the model

⚠️ **AN LLM CANNOT PRODUCE THIS ASSET.** A chat model can write the concept
prompt, generate the concept art, script Blender, and write the retarget map — it
cannot emit a GLB with a skinned mesh in it. The realistic chain is **concept
image → an image-to-3D generator with auto-rigging → a rig that meets the list
below**. What the generator is called matters far less than whether the output
satisfies these six lines, so **send the list, not the vibe.**

> **Rig requirements — Rock Legends: Spirit Wars**
>
> 1. **Format:** GLB / glTF 2.0, single file, skinned mesh with the skeleton
>    embedded.
> 2. **Skeleton:** a **standard humanoid bone convention** (Mixamo-style, VRM or
>    Rigify) with the conventional bone names. **Not a bespoke naming scheme.**
> 3. **Rest pose:** T-pose or A-pose — **state which**, and use the same one for
>    every character.
> 4. **Face:** morph targets / shape keys named to the **ARKit blendshape list**
>    (`jawOpen`, `browInnerUp`, `eyeSquintLeft`, …). If the face has no shape
>    keys, the face layer cannot be built later without redoing the head.
> 5. **The guitar is a SEPARATE object**, not merged into the body mesh, with its
>    own origin at the neck-to-body joint.
> 6. **Budget:** browser-real-time. It shares a frame with the 3D cosmic arena.

⚠️⚠️ **REQUIREMENT 5 IS THE ONE THAT GETS SKIPPED, AND IT IS FATAL TO §2c.** An
image-to-3D tool handed a photograph of a person holding a guitar returns **one
welded blob** — arms fused to torso fused to instrument. There is then nothing to
parent, the guitar can never move relative to the body, and the whole
solved-from-the-wrists design has no object to solve *for*. Ask for it separated
at generation time; separating it afterwards is surgery.

⚠️ **Requirement 2 is where the leverage is.** MediaPipe-to-standard-humanoid
retargeting is a solved and published problem. An invented skeleton means writing
that map from nothing, and re-writing it for every character. 🎯 **The convention
is worth more than the mesh.**

⁉️ **OPEN — 👹 the Metalness Monster is not humanoid.** 33 human joints retarget
onto a human-proportioned Spirit by rotation; a bruiser with non-human
proportions needs an explicit answer about what maps to what. **Cheaper decided
than discovered at §7 step 4.**

⭐ **ONE CHARACTER END TO END BEFORE FOUR.** Take the 🗡️ Ronin — the most settled
kit — through rig → capture → retarget → one clip before commissioning anybody
else. A wrong rig spec then costs one asset instead of four. Same instinct as
§7 step 1: build the instrument, measure, *then* commit.

---

## 4. The pipeline, and where the seam is

```
  video file
      │
      ▼   ⬅ OFFLINE. Heavy model, no realtime budget, run it overnight if you like
  landmark extraction  ──►  raw JSON, one record per frame
      │
      ▼   ⬅ OFFLINE. One-euro filter · bone-length constraint · ground lock
  cleaned JSON
      │
      ▼   ⬅ OFFLINE. Rotation retarget against the map from §3
  rig-space rotations
      │
      ▼   ⬅ BAKE
  GLTF AnimationClip  ═══════════════►  the game loads an asset and knows nothing
                                        about MediaPipe, cameras or Alex
```

⚠️ **THE SEAM IS THE POINT, AND IT IS LOAD-BEARING.** Everything left of the bake
is dev tooling that may be slow, ugly and Python if that helps. Everything right
of it is an asset load. **If a runtime module ever needs to know what MediaPipe
is, ruling 1 has quietly been abandoned** and the whole cost argument in §8 comes
back.

**The three cleaning steps, and why each exists:**

- **One-euro filter** — jitter is the failure that reads as broken. Low speed ⇒
  heavy smoothing, high speed ⇒ light, so a held pose is still and a fast strum
  is not mush. ⚠️ It has two constants and they are **taste**, which by
  `CLAUDE.md` means **sliders on a preview page**, not numbers chosen here.
- **Bone-length constraint** — limbs are rigid and their lengths are known from
  frame one. That makes it *free* correction on the weak depth axis: a z estimate
  that changes an upper-arm's length is wrong, and by exactly how much.
- **Ground lock** — a foot in contact must not translate. Without it the
  character skates, which is the second thing anyone notices after jitter.

---

## 5. 📏 The bar, set in advance

Following §6's discipline. ⚠️ **Two bars, because one of them is not a number and
pretending otherwise would be dishonest.**

**Bar 1 — jitter, and it IS numeric.** Per-joint frame-to-frame angular velocity
must stay inside what a human limb does. This is falsifiable, cheap to compute,
and catches the failure that actually kills the feature. **A pipeline that fails
this ships nothing, however good the poses look paused.**

**Bar 2 — recognisability, and it is a blind test.** Capture N moves. Play them
back on the rig, unlabelled, and see whether someone can name each one. 🎯 **The
tolerance here is aesthetic, not metric** — four centimetres of elbow error is
invisible where five frets was a lie on screen — so the honest measurement is
*did it read as the move*, and the honest instrument is a person who was not told
the answer. Pick the pass rate before running it.

⚠️ **AND THE §2 LESSON, ASKED OF THIS PIPELINE: what would a synthetic test be
holding constant?** Validate the retarget on a clean synthetic walk cycle and you
have held **"the input skeleton has correct, consistent proportions"** constant —
which is precisely the thing a real monocular capture of a real person gets wrong.
`EAR_SPY_HANDOFF` §2 spent 104 assertions on an assumption that hid the bug, and
the first real microphone found it in seconds. **The first real video will do the
same here. Budget for it.**

---

## 6. Known limits — documented, not bugs

- **Monocular depth is the weak axis, on all 33 joints.** The bone-length
  constraint recovers much of it and nothing recovers all of it.
- **⚠️ The guitar occludes the strumming arm** on most frames. An occluded joint
  is *invented* by the model, plausibly, with no flag — the stale-but-plausible
  failure `EAR_SPY_HANDOFF` §6a named as the worst one this family has. ⭐ **§2c's
  markers turn the occluder into an instrument**: the thing hiding the arm is now
  the thing being measured most reliably, and the arm can be constrained *to* it.
  The joint is still not observed; it is merely far better bounded.
- **⚠️ A marker that moves between takes is silent** (§2c). Same family as
  `cameraHand.js`'s calibration drift, and it needs the same respect.
- **Forearm roll is unobservable.** A wrist rotating about its own axis moves no
  landmark. It must be inferred from context or animated by hand.
- **No fingers, by choice** — ruling 2 and Alex's call, 2026-09-08. 🔭 See §9.
- **Face and body are different takes on possibly different days.** Expression
  continuity across them is not guaranteed and **does not matter**, because
  ruling 4 never asked for it.
- **A clip is one performance.** Variation comes from capturing more takes or
  from blending, never from the tracker.

---

## 7. Build order

Each step delivers something, and step 0 blocks all of them.

| # | step | done when |
|---|---|---|
| **0** | ⛔ **A rigged character** — §3's five requirements | one GLTF loads in the arena and can be posed by hand |
| **1** | 🧪 **The bench first** — a `.scratch/` page: video in, skeleton drawn over it, **sliders for both filter constants and the bone-length tolerance** | Alex can dial it and screenshot the panel |
| **2** | 🕺 Body extraction → raw JSON | one take, one file, frame count matches the video |
| **3** | 🧹 The cleaning pass → §5 bar 1 | jitter bar passes on a real take |
| **4** | 🎭 Retarget + bake → one clip on one character | §5 bar 2 on a handful of moves |
| **5** | 🎸 **Marker pose** (§2c) — three clusters, a measured square, a still calibration take, wrist solve as the fallback | ⭐ the neck stays under the fretting hand through a whole take **including a one-handed overhead swing**, which is the case the wrist solve could not do at all |
| **6** | 😐 Face layer, event-driven (§2b, ruling 4) | one expression fires on one game event |
| **7** | 📚 The clip library — play, weapon swing, hit, fall, recover | the list in the promoted inbox entry |

⚠️ **Step 1 before step 2, and this is not optional here.** `CLAUDE.md`'s preview
rule exists because visual work edited straight into the client has cost this
project twice. A mocap pipeline is *nothing but* taste calls with numbers
attached.

---

## 8. 🧊 Deferred on purpose — the live webcam

The version where a **player's** camera drives their character in real time.
Deferred 2026-09-08, and the reasons are specific:

1. **CPU.** Ear Spy already runs vision at **12 Hz specifically to stay out of the
   8192-point FFT's way** (`cameraHand.js`), and that was before a three.js arena
   joined the frame. A pose model and a face model on top is not a budget that
   exists.
2. **It requires a webcam, a lit room and space to stand.** The game's audience is
   *"the ultimate beginner"* (`STATE_OF_PLAY.md` §1), not someone with a capture
   setup.
3. **Live means the character is only as good as the worst frame**, in front of an
   opponent. Recorded means the worst frame gets deleted.
4. 🎯 **And it buys nothing Alex asked for.** The whole appeal is *his* movement in
   the game. Recording delivers exactly that, to every player, forever.

📌 `IDEAS_INBOX.md` [P5] *"Riff Listener character/filter mode"* is this idea and
**stays in the inbox** — it is a live-camera toy, not this pipeline, and promoting
it here would be filing a decision in the wrong doc (§B9).

---

## 9. 🔭 The best idea in here, and it is not built

For a character playing an actual **tune**, finger mocap is the wrong tool —
because this project already has something better.

`music/neckPlacement.js` + the camera fusion produce **exact string and exact
fret, per note, with a confidence margin** (`EAR_SPY_HANDOFF` §6a, §6c). That is a
*better* animation driver than watching a hand, because it is already correct,
already tested, and already runs. Mocap the body; **synthesise the fretting hand
procedurally from the note data** with an IK solver placing fingertips at known
fret positions.

🎯 That is how shipping games do hands on instruments, and Alex is one of very few
people who would already have the input lying around. ⛔ Nothing is built. 📌 It
depends on the rig (§3) and on a hand IK chain, and it should not be started until
§7 step 5 proves the guitar stays where it belongs.
