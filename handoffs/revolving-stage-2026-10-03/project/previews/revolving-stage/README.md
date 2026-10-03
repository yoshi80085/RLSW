# Revolving Stage — interactive graphics and movement proposal

Created 2026-10-03 for Alex: “I like the Revolving Stage idea — can you show in
a preview how you might build that out?”

Open http://127.0.0.1:5175/RLSW/.scratch/revolving-stage/ with the existing local
Vite server. To start another server from the repository root:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175
```

The files remain in `.scratch/`, following CLAUDE.md's visual-preview-first rule.
Nothing is wired into the live stage-effect deck, engine, or renderer. The bat
models, crumbling build, and their earlier handoff remain untouched.

## Proposed behavior

A central annular turntable carries the selected hex rings together. Alex's
follow-up requested specific rings turning while others stay put. Independent
checkboxes select inner (6), middle (12), and outer (18) rings; any combination
is supported, including inner + outer with a stationary middle. Quick presets
offer Outer only, Alternate rings, and All three. The raised carrier now follows
the actual hex openings, including the inner boundary of isolated rings.
Closed steel housings and inset brass ribs remain attached to the moving cells.
The circular drive gears rotate below the deck without rising through the fixed
floor. No visibility toggle or fade hides the moving machinery during descent.
“Mechanism design” compares this with the previous circular carrier at the same
timeline position; it persists and is included in the version-3 dial-in.
Latches retract smoothly before lift and close after seating. The lift slider
minimum is now 0.70, enough to clear the fitted housings above the fixed tiles;
the default 0.85 lift and the original lift/turn/seat timing and easing remain.
The Limelight centre, unselected rings and outside cells stay fixed. Direction can be clockwise or counterclockwise;
each cycle turns by 60° or 120°. This is a simultaneous permutation: even when a
destination was occupied, its occupant is leaving in the same rotation.

Warning arrows and per-rider coloured paths/ghost landing markers → latches
retract → deck rises clear of surrounding tiles → gears rotate it → it seats
and locks. Spirits and the sample Drive amp ride with the deck. Facing can turn
with it or remain unchanged. There is no damage in this proposal.

Ronin and Monster begin on the inner ring; the amp is on ring two; Glamarchy
holds Limelight; Intergalactic 0 starts on ring three (fixed under the default
inner+middle selection, rides when the outer ring is selected). “Step
Ronin off” is a fixture-editing control, not a simulated legal movement action.
Returning him restores a clear fixture, moving Monster aside if needed.

“Next rotation” starts from the previous cycle's completed destinations.
Scrubbing the timeline never mutates the starting positions. Changing look or
movement controls restarts the current cycle; a completed cycle is retained.
Reset positions restores the fixture without losing the dial-in.

## What is shown

The actual 111-cell hex topology and Spirit acrylic artwork, on a procedural
mechanical board. It does not load the live arena GLB: the deck must split into
movable cells. Coordinates use a regular axial lattice, removing the source
board image's slight horizontal stretch so 60° rotation endpoints fit exactly.

Steel slabs, fitted steel housings and brass ribs, recessed circular drive gears,
fixed bearings and locking blocks, illuminated borders, a lower chassis, star field,
and the shipped standee renderer. Hex numbers mark fixed board addresses; they
hide while the deck lifts and return when it locks.

Three cameras: Arena, Mechanism, Top-down; drag to orbit and scroll to zoom.
Timeline and individual phase buttons; optional half-speed; five numeric visual
controls; movement selectors; destination, labels, facing and reduced-motion
toggles. Reduced motion uses a single relocation at the locking beat with no
lift or spin. It still communicates phases in text.

Optional gesture-enabled mechanical audio: warning ticks, lifting motor, rotation
hum and lock clunk. Pause, seek, settings changes and hidden tabs stop active
voices. No sound starts automatically and no recordings are downloaded.

## Dial-in and remaining decisions

Preferences persist under `rlsw.revolving-stage.v1:<pathname>`; old footprint-size
settings migrate to the matching ring selection. They restore into
both the renderer and the controls. Copy dial-in shows selectable JSON before
attempting clipboard access and separates changed/default settings. Sound stays
off after reload; the scenario resets but preferences persist.

Alex requested independently selectable rings. These remain proposals, not Alex's rulings: fixed centre, carrying
amps and facing, no damage, default 18-cell/60° turn, and one shared movement
beat and one shared direction for the selected rings. Live cadence is not decided; the seconds in the preview only demonstrate
the choreography. No interactions with crumbling holes, smoke, lasers, bats,
ability movement, or other board objects are implemented. Decide those before
production integration. Do not treat QA settings or exported test values as
Alex's chosen dial-in.

## Files and verification

- `model.js`: pure footprint, axial destination, immutable settlement and timeline.
- `stage.js`: Three.js machinery, board, standees, camera and destination markers.
- `preview.js`: controls, fixture, persistence, timeline and phase/audio dispatch.
- `audio.js`: opt-in local synthesis and teardown.
- `index.html`, `style.css`: desktop preview and narrow-pane layout.
- `check.mjs`: one-off scratch evidence. Run `node .scratch/revolving-stage/check.mjs`.

Verification: **13,986 checks passed** across all eight ring selections (including
none), both directions and both angles,
unique valid destinations, physical endpoint agreement, inverse turns, full
revolution, immutable settlement, facing retention, finite scrub poses and
reduced-motion lift suppression. Unselected ring destinations stay fixed.
Syntax and preview bundle pass; **zero bundle
warnings** with media stubbed.

Browser: full normal cycle reached Locked, reverse cycle planned return to each
original hex, smaller footprint leaves the amp stationary, stepping Ronin off
removes him from the riders, reduced-motion sequence and export worked, restored
controls survived reload. Mechanical audio was successfully enabled; its sound
quality has not been auditioned on speakers. No browser errors/warnings observed.

The repository-wide suite was already run in this conversation before this
isolated preview: it stops at the existing selftest.mjs:457 combat expectation
(actual 4 vs expected 11). No production source was changed for this study.

Clearance revision browser check: adjacent rings at full lift, early/half/late
descent and final seating; separated rings at the 0.70 minimum lift; switching
the fitted/previous comparison without moving the timeline. 13,986 existing
movement checks still pass; preview bundle has zero warnings; browser console
has no warnings/errors. `preview-clearance.png` shows the fitted casing early
in descent. This is visual clearance work, not an engineered drivetrain or a
new gameplay implementation.

In plain terms: see where the floor will take everyone, then ride it or step off.
The whole point is a new position and a new angle on the fight.
