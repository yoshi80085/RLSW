# 🔊 RING BEAM — build brief, one pass

> **For the session that ports it. Written 2026-09-13, after Alex signed the look off.**
>
> 📌 **Read `.scratch/sonic-rework/README.md` first** — this brief is the *fifth*
> change on top of that draft, not a replacement for it. The draft's four changes
> (dice readability, the ROLL gate, the camera, the `diceHits` pass-through) are
> unchanged and still unapplied.
>
> 🎯 **Everything here has been previewed and approved.** Nothing in this brief is
> a taste call you have to make. Where a number looks arbitrary it is arbitrary
> *on purpose* — it is what Alex picked by eye, and §5 says which ones to protect.

---

## 1. ⭐ WHAT SHIPS, IN ONE SENTENCE

The Sonic projectile becomes a **beam made of shock rings**: hoops at fixed
stations along the flight path that ignite in turn and then **inflate** as the
wavefront pulls away, so a beam grows backwards out of the head, riding a smooth
travelling wave instead of a zigzag.

**Reference:** the *Sonic Volley Rework* artifact, Projectile → **Rings** (the
default). The published page's "Signed off — the dial-in" note carries the same
numbers as §5 below; if the two ever disagree, **the module is right** and the
page is stale.

---

## 2. 🗂️ THE FILES

`.scratch/sonic-rework/board/sonicZigzagVisuals.js` is a **new module**, not a
replacement for anything in `src/`. It is the whole treatment: path drawing,
the Sustain barrier, the flight cadence, per-die power and the camera focus.

| from | to | what |
|---|---|---|
| `.scratch/sonic-rework/board/sonicZigzagVisuals.js` | `src/board/` | ⭐ new — the ring beam (plus a cel-zigzag and chevron treatment behind `strokeStyle`, kept for comparison) |
| `.scratch/sonic-rework/board/sonicRingCheck.mjs` | `src/board/` | ⭐ new — its suite |
| `.scratch/sonic-rework/board/sonicZigzagCheck.mjs` | `src/board/` | ⭐ new — the cel/cadence suite the module also has to satisfy |

Plus the four files the original draft already asks you to copy — see that
README's **Applying it**. Do both in the same pass: the ring beam draws the dice
verdicts' companion picture, and shipping one without the other gives you a
volley whose projectiles say one thing and whose dice say another.

⚠️ **`sonicVolleyVisuals.js` STAYS, AND IS STILL IMPORTED.** The ring module
imports `buildSonicPath` and `sonicVolleyDuration` from it, and
`sonicVolleyVisualsCheck.mjs` still covers it. Its `waveformGlyph` stops being
the shipped projectile but **must not be deleted** — §B5 is exactly this shape:
a cut that runs past its own end and takes a function two other modules need,
with every suite still green.

---

## 3. 🔌 THE CALL SITE — the only wiring change

`src/board/arenaVisuals.js`, in the sonic block (line ~100 in the draft copy):

```js
// before
const volley=createSonicVolleyVisuals({...common,ampOrigins,clearance:1.15,shieldRadius:1.05,
  dice:battle.diceVals.map((value,i)=>({value,passed:battle.diceHits[i]}))});

// after
const volley=createSonicZigzagVisuals({...common,ampOrigins,clearance:1.15,
  shieldRadius:2.4,shieldSize:2.1,strokeStyle:'rings',intensityMode:'margin',
  dice:battle.diceVals.map((value,i)=>({value,passed:battle.diceHits[i],sides:battle.dicePool[i]}))});
```

…and the import beside it. **Nothing else is configured** — `strokeStyle:'rings'`
pulls Alex's numbers in by itself (§5).

Three things in that diff are load-bearing:

- ⚠️ **`sides:battle.dicePool[i]` is NEW and is not optional.** Power is a margin
  against the shield normalised by die size; without `sides` every die is scored
  as a d6, so an upgraded d12 rolling 11 draws a beam the size of a d6 rolling 5.
  The preview has `dicePool` in every scenario for exactly this reason.
- ⚠️ **`shieldRadius` 1.05 → 2.4 moves where an absorbed shot stops.** The barrier
  stands *in front of* the Rival now rather than wrapping it, which is what makes
  absorption readable as a shot dying short. The module clamps the stand-off to
  `laneGap * 0.45`, so at melee range it shrinks rather than landing behind the
  attacker — **eyeball one adjacent-hex volley** and confirm the beam still
  launches on the correct side of the barrier.
- 📌 `intensityMode:'margin'` is the mode Alex has been reviewing: the roll scored
  against the Sustain it had to beat, so a high shield visibly dims the whole
  incoming volley (§3.1 — the defender gets to *see* their Sustain work).
  `'face'` is the raw-roll alternative and is in the preview to be flipped.

---

## 4. 🎥 THE PUSH-IN — the one piece with no home yet

⚠️ **READ THIS BEFORE YOU CALL THE PORT DONE.** Alex dialled the contact
push-in from 0.82 to **0.95** — the hardest setting the slider has. In the
preview that number is consumed by the page's own camera. **The game's
`stageSonicCamera` has no push-in at all**: it frames a static box per phase and
never tightens onto the impact. Port the beam and nothing carries that value, and
the shot he approved is not the shot that ships.

The module already exposes what is needed. `createSonicZigzagVisuals` returns
**`getFocus(elapsedSeconds)`** → `{progress, point, target, closeness, passed}`,
or `null` before launch. `closeness` ramps 0→1 across the last 45% of the flight.

Two steps:

1. `arenaVisuals.js` already holds `sonic.launch` and calls `volley.update()`
   each frame. Have it also stash `sonic.focus = volley.getFocus(clock - sonic.launch)`
   where the renderer can read it (the `battle` frame object is the existing
   channel between the two).
2. `arenaRenderer.js`, inside `stageSonicCamera`'s `battle.phase==='sonic_volley'`
   branch, apply the preview's two lines verbatim — bite the target toward the
   contact and shorten the reach:

```js
// mirrors the preview's frameShot(); RING_CAMERA_ZOOM is exported by the module
if (focus) {
  const bite = focus.point.clone().lerp(focus.target, 0.45);
  target.lerp(bite, 0.4 + focus.closeness * 0.58);
  reach = reach * (1 - focus.closeness * RING_CAMERA_ZOOM);
}
```

⚠️ **And the damping.** The preview had to disable OrbitControls' damping while
a scripted shot writes `camera.position` and `controls.target` every frame —
with both running, they chase each other and the push-in judders instead of
gliding. `stageSonicCamera` already sets `controls.enabled=false` for the whole
volley, so check whether `enableDamping` needs the same treatment on this path
before concluding the move looks wrong.

📌 **`getFocus` follows the FIRST shot launched and never retires it.** The
obvious version — "focus on whichever shot is furthest along, skipping ones that
have landed" — lurches the camera backwards once per die. Do not re-derive it;
`sonicZigzagCheck.mjs` has a regression test at 1, 2, 5 and 11 dice.

🎯 **If you run out of room, land §3 and leave §4** — the beam is correct without
the push-in and the push-in is worthless without the beam. **Say plainly in the
handoff that the camera value did not land**, rather than reporting the port as
complete. A step reported "done" that carried a live decision is §B11.

---

## 5. ⭐ ALEX'S DIAL-IN — approved 2026-09-13, from his panel screenshot

Already in the module as `RING_TUNING`, applied on top of `SONIC_TUNING` whenever
`strokeStyle` is `'rings'`, and still overridable by a caller's `tuning`.

| knob | was | **now** | what it does |
|---|---|---|---|
| `slowmo` | 22 | **52** | how much longer the last leg takes than the first |
| `burst` | 1.0 | **3.1** | size of the detonation at contact |
| `thread` | 1.0 | **1.35** | the filament running down the beam's axis |
| `ringGap` | 0.30 | **0.42** | world distance between ring stations |
| `ringTail` | 18 | **22** | rings standing behind the head |
| `beamRadius` | 0.80 | **0.64** | the beam's calibre at full power |
| `width` | 1.0 | **0.80** | thickness of each ring's band |
| *camera zoom* | 0.82 | **0.95** | the push-in of §4 — not a tuning key |

🎯 **THE DIRECTION, IF ONE OF THESE EVER HAS TO MOVE.** He took the beam
**thinner and sparser but longer**, with a brighter filament, a far bigger
detonation and a much slower final approach. **Mass came out; contrast went in.**
Protect the contrast — the slow approach and the burst — before protecting the
calibre.

⚠️ **These are NOT defaults to tidy into `SONIC_TUNING`.** That block is the
zigzag/chevron baseline and `sonicZigzagCheck.mjs` asserts a tested curve against
it. `sonicRingCheck.mjs` builds one volley with no tuning and one with
`RING_TUNING` explicitly and asserts the geometry is **byte-identical**, so
unhooking the overlay fails loudly instead of silently reverting the look. That
assertion has been mutation-tested: unhook the spread and it goes red.

📌 **Four panel knobs do nothing in ring mode** and exist only for the other two
treatments: `snap` (the fluid cadence has no per-leg dash to shape), `ripple` (no
corners to shed ripples from), `chevronGap` and `chevronTail`. Their values in
Alex's screenshot are defaults, not choices.

---

## 6. ⚠️ FIVE THINGS THAT LOOK WRONG AND ARE NOT

Each cost a rebuild in the preview session. The comments in the module say so at
the site; this is the index.

1. **Rings are oriented to the DISPLACED curve, not the path under it.** The
   frame is differenced either side of each station. Orient them to
   `path.getTangent()` — the obvious version — and every hoop faces the same way
   while their centres snake between them: it reads as a corkscrew spring.
2. **Ring thickness is a FRACTION OF THE RADIUS, not an absolute width.** A fixed
   hairline band turns the beam into a wireframe drawing of itself.
3. **Ring mode runs at roughly a third the per-mark opacity of a single stroke**
   (0.30 / 0.46 against the cel bands' 0.85 / 0.95), and has its own two colour
   tones. Twenty additive hoops at the cel `hot` lightness clip to white and the
   volley loses its tint entirely — before the bloom pass has even run.
4. **`sonicFlightCurve`'s `smooth` flag drops the per-leg dash, NOT the slow
   motion.** The legs still grow toward the Rival, so the shot still crosses the
   arena early and crawls the approach. Total flight time is unchanged, so
   `sonicVolleyDuration` reports the same number and the per-die audio stagger
   needs no adjustment. **Do not "fix" the cadence by restoring the snap.**
5. **Corner ripples and the corner shimmer are OFF in ring mode, deliberately.**
   There are no corners on a smooth wave to hang them from, and the rings already
   *are* a wake — a second field of billboarded rings over the top is haze.

---

## 7. 🧪 EVIDENCE — what to run, and what it must say

```bash
node src/board/sonicVolleyVisualsCheck.mjs   # passes UNMODIFIED — it must still
node src/board/sonicZigzagCheck.mjs          # cadence, power, mitred bands, focus, dispose
node src/board/sonicRingCheck.mjs            # the dial-in, the beam profile, determinism
node src/board/sonicDiceVisualsCheck.mjs     # from the original draft
```

Wire them in the same pass — ⚠️ **§B3: a suite no script runs is not a suite**,
and `sonicVolleyVisualsCheck.mjs` has never been in `test:all` at all:

```json
"test:sonicfx": "node src/board/sonicVolleyVisualsCheck.mjs && node src/board/sonicZigzagCheck.mjs && node src/board/sonicRingCheck.mjs && node src/board/sonicDiceVisualsCheck.mjs"
```

…then add `test:sonicfx` to `test:all`, and add every new module's row to
`ARCHITECTURE.md` — `test:arch` will fail until you do, which is the point.

Also required: **`npm run check:bundle` at zero warnings** (§B7 — the count is
the check), before and after, because `arenaVisuals.js` and `arenaRenderer.js`
both move.

**What a green run does not tell you.** All four suites are headless: they assert
geometry, timing and teardown, never whether it *looks* right. The look is
verified against the artifact — run one volley in the client at the standard
scenario and compare it to the page's figure. §B2 is the general form of this.

---

## 8. ⛔ NOT IN SCOPE

- The **slow-motion beat and one-at-a-time resolution order** (§12.1b beats 4–6).
  The volley still resolves in one pass. Separate job, unchanged by this.
- The **chord-derived volley sound**. The preview has a working draft
  (`sonicChordAudio.js`, in the artifact only) and it is not part of this port.
- The **zigzag and chevron treatments**. They ride along inside the module
  because they share every piece of machinery with the beam, and they are how the
  next look gets auditioned cheaply. They are not reachable from the game and
  need no call site.
- **Any balance or rules change.** This is presentation end to end: no rule, no
  RNG, no dice value and no order of contacts is touched by any of it.
