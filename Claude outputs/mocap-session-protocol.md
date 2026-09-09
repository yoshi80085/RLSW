# 🎬 MOCAP SESSION PROTOCOL — how to actually shoot one

> **Operational checklist. Not design** — the design is `src/MOCAP_DESIGN.md`, and
> its §0 rulings govern this file. Written **2026-09-08** for session 01.
>
> ⭐ **SESSION 01 IS A TEST, NOT THE SESSION.** Ten minutes, nine short takes,
> chosen to break things rather than to look good. Process it, find out what this
> room and this phone actually do, *then* shoot the real library. 🎯 Same instinct
> as `MOCAP_DESIGN.md` §7 step 1 and every bench in this repo: **build the
> instrument, measure, then commit.**
>
> ⛔ **Capture does NOT wait on the rig.** §3 blocks retargeting, not recording.
> Video shot today retargets onto a rig that arrives next month.

---

## 0. 📏 The numbers, measured — fill these in on the day

⚠️ **A printer will silently rescale a page, and every distance downstream is
wrong by that factor with nothing looking broken.** Measure, do not assume.

| what | expected | **measured** |
|---|---|---|
| Scale bar on marker sheet p1 | 150.0 mm | `_______` |
| One 80 mm marker (ID 0), black square edge | 80.0 mm | `_______` |
| One calibration-board square (p3) | 25.0 mm | `_______` |
| Camera height off the floor | ~hip | `_______` |
| Camera to the spot you stand on | ~3.0 m | `_______` |

📌 The 80 mm number is **the scale reference for the entire capture**. Write it
down before you shoot, not after.

---

## 1. 🖨️ Before the day — print and stick

**Print `docs/mocap-markers-a4.pdf`, all 3 pages, at 100% / "Actual size".**
⚠️ Never "Fit to page". **Matte paper only** — a glossy sheet throws a specular
highlight that erases the marker for the frames where the light catches it, which
will be the frames where you are moving fastest.

**Cut on the dashed line, NOT on the black edge.** The white border is part of the
marker; a marker trimmed flush to the black is a marker that does not detect.

**Placement — six markers, three surfaces:**

| ID | size | where | why there |
|---|---|---|---|
| **0** | 80 mm | guitar **face**, lower bout | the workhorse — visible through all normal playing |
| **1** | 80 mm | guitar **back**, centre | ⭐ carries the overhead raise and anything played facing away |
| **2** | 55 mm | guitar **face**, upper bout | non-coplanar-ish with 0; two on a face beats one |
| **3** | 55 mm | guitar **back**, upper | pairs with 1 |
| **4** | 30 mm | **headstock**, front | pins the neck direction precisely |
| **5** | 30 mm | **headstock**, back | same, from behind |

- ⚠️ **Keep every marker clear of where your hands land.** A marker under a palm
  is a marker that vanishes exactly when the pose gets interesting.
- Tape **all four edges** so nothing lifts or curls. Removable tape.
- 📸 **Photograph the finished placement from four angles.** Those photos *are*
  the record of the guitar's geometry — there is no other one.
- ⚠️ **Do not re-tape anything mid-session.** `MOCAP_DESIGN.md` §2c: a marker that
  shifts leaves every number plausible and wrong. Same family as the fret
  calibration drift in `cameraHand.js`.

**Tape the calibration board (p3) flat to a clipboard or stiff card.** Do not cut
it. ⚠️ A bent board calibrates a lens that does not exist.

---

## 2. 📱 Phone settings — and the one that decides everything

### ⭐ Shutter speed is the whole ballgame

**Motion blur destroys markers and smears landmarks**, and a fast guitar swing is
exactly where blur is worst — which is exactly where the wrist solve already
failed, so it is the one case that has no backup. Target **1/500 s**; accept
**1/250 s**; below that, expect the swing takes to fail.

- **If your camera app exposes shutter** (Blackmagic Camera on iOS is free; Pro
  mode or Open Camera on Android), set it manually. This is the single highest-value
  five minutes of the whole setup.
- **If it does not**, your only lever is **light** — auto-exposure buys a faster
  shutter when the room is bright. Open everything, turn on every lamp, and shoot
  in daylight if you can.

### The rest of the settings

| setting | value | why |
|---|---|---|
| Resolution / rate | **1080p60** | ⭐ For fast motion, temporal resolution beats spatial — 60 fps matters more than 4K |
| ⚠️ **Stabilisation (EIS)** | **OFF** | It crops and warps frame to frame, silently changing the camera geometry pose estimation depends on. Use the tripod instead |
| Focus | **locked** | Autofocus hunting mid-swing is blur you cannot recover |
| Exposure | **locked** | An AE shift mid-take is a detection dropout |
| Frame rate | **constant** | Phones sometimes record variable frame rate, which corrupts anything frame-indexed. If unsure, normalise later with `ffmpeg` |
| Camera position | ⚠️ **do not move it between takes** | One camera calibration then covers the whole session |

🔬 **And take one measurement while you are there:** shoot take 5 and take 6
**twice** — once at 1080p60 and once at 4K30. ⭐ **4K doubles the marker pixels;
60 fps halves the blur.** Which wins is an empirical question about *your* phone in
*your* light, nobody can answer it from a desk, and knowing it decides the format
of every session after this one.

---

## 3. 🏠 The room

- Camera at **hip height**, on a tripod, **~3 m back**, level — not tilted down.
- **Plain wall behind you.** Clear the floor.
- **Lit from the front.** ⚠️ A window behind you is the worst case: backlighting
  wrecks landmark confidence and the exposure hunts.
- Mark your standing spot on the floor with tape so every take starts in the same
  place.
- ⚠️ **Stand perpendicular to the camera for the playing takes.** A guitar neck
  pointed at the lens is end-on and unreadable — the same failure
  `EAR_SPY_HANDOFF` §6 warned about for the laptop camera, one level up.
- Check your **swing clears the frame edges** before you record. A limb that exits
  frame is *invented* by the model, not measured, and it does not say so.

---

## 4. 🎬 The slate — every single take, no exceptions

1. **Stand still**, guitar held in normal playing position, **2 seconds.**
   ⭐ This is `MOCAP_DESIGN.md` §2c's still calibration — it relates the marker
   frame to the instrument's geometry, and a take without it is much harder to use.
2. **Clap once**, hands high and in frame. Alignment marker, visual *and* audio.
3. **Perform the move.**
4. **Stand still, 1 second**, before you stop recording.

⭐ **ONE FILE PER MOVE. Do not record one long take.** Short clips are easier to
retake, easier to throw away, easier to name — and small enough to actually move
around, which a single 10-minute 60 fps file is not.

**Name them exactly:** `01-calib.mp4`, `02-tpose.mp4`, … and save into
`.scratch/mocap/session-01/` — `.scratch/` is already gitignored, and **video does
not belong in git.**

---

## 5. 🎯 Session 01 — the shot list

⚠️ **These are chosen to BREAK things.** A test session that only contains the
easy poses tells you nothing you did not already believe — the same mistake
`EAR_SPY_HANDOFF` §2 made with its synthetic chords, where 104 assertions all
quietly assumed the thing that was broken.

| # | file | what to do | what it is testing |
|---|---|---|---|
| 1 | `01-calib` | **Camera calibration.** Hold the ChArUco board up and film it for ~30 s: fill the frame, then tilt it left, right, up, down, near, far. ~20 distinct angles. **No guitar.** | Lens intrinsics + distortion. ⛔ Without this, every pose is approximate |
| 2 | `02-tpose` | Stand in **T-pose**, no guitar, 3 s. Then A-pose, 3 s. | ⭐ The rest-pose reference — this is what §3a's requirement 3 gets matched against |
| 3 | `03-play` | Stand and play normally, 10 s. Perpendicular to camera. | The baseline. The easy case, and the only one the wrist solve alone could ever do |
| 4 | `04-swing-slow` | Swing the guitar like an axe, **slowly**, 3 times. | Two hands gripped together — where the wrist solve starts to fail |
| 5 | `05-swing-fast` | The same swing, **full speed**, 3 times. | ⭐ **The shutter test.** If this take is blurred, nothing else in the session matters |
| 6 | `06-overhead` | Raise the guitar **overhead, one-handed**, hold 2 s, lower. | ⭐ The case the wrist solve cannot do **at all**. Marker ID 1 on the back earns its place here or nowhere |
| 7 | `07-turn` | Holding the guitar, turn slowly through a full 360°. | Occlusion, and whether the back markers hand over cleanly as the front ones disappear |
| 8 | `08-hit` | Take an imaginary hit — stagger back, recover. | Whole-body motion with no instrument constraint at all |
| 9 | `09-4k` | **Repeat takes 5 and 6 at 4K30.** | The resolution-vs-frame-rate measurement from §2 |

⏱️ Ten minutes of shooting. Plus about fifteen of setup, most of it taping.

---

## 6. ✅ After the session

1. **Copy the folder off the phone** into `.scratch/mocap/session-01/`.
2. **Fill in §0's measured numbers.** Do it now, while the calipers are out.
3. **Add the four placement photos** as `marker-placement-*.jpg` in the same
   folder.
4. Then the processing pass — `MOCAP_DESIGN.md` §7 steps 1–3. ⛔ **The bench does
   not exist yet.** Take 1 and take 5 are enough to build and tune it against, and
   both are short.

📌 **What to look at first, in order:** does take 1 give a sane calibration ·
does take 5 detect markers on more than half its frames · does take 6 detect the
back marker at the top of the raise. **If take 5 fails, the answer is light and
shutter, and re-shooting is cheap.** That is the entire reason session 01 is nine
short clips and not the whole library.

---

## 7. ⚠️ Two traps that will not announce themselves

**The pipeline must accept marker IDs 0–6 and nothing else.** The calibration
board occasionally throws a false positive in the guitar's dictionary — measured:
it read as ID 48 on the printed sheet. Harmless *if* the code filters to the six
IDs it placed, and a phantom guitar if it does not.

**A dropped detection is not a still guitar.** When no marker is visible the
answer is *unknown*, which must fall through to the wrist solve
(`MOCAP_DESIGN.md` §2c) and not to "wherever it was last". Ruling 7: a bad frame
**holds**, it does not blank — and it especially does not silently persist.
