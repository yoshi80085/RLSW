# Immersive HUD — handoff for Medium reasoning

**2026-09-09 implementation:** the approved space-saving Study 02 composition is
now live in the game. In 3D mode a 238px player pocket keeps portrait, Vibe,
Drive, Sustain, Db and Fans at the upper-left edge. Chord and melody controls sit
directly beneath it, while the existing eight-seat melody track remains a
separate floating board overlay. Step 3 becomes a centered shallow command dock.
Turn/Spirit/Rivals disclosure moved to the upper-right and the camera controls to
a quieter lower-right strip, so those two control families no longer collide.
The phone fallback keeps the board above the mounted drawers and uses a compact
camera row. The 2D layout and all original live controls remain unchanged.

The compact displays read live game values; they do not own or calculate rules.
No note, action or tutorial control was copied. Browser checks covered desktop
Chord and Melody plus a 390×844 responsive view. Arena, journey, render,
architecture and zero-warning bundle checks pass.

**2026-09-09 completion pass:** the classic interiors have now been separated
from the immersive presentation as well. The compact sound pocket uses dedicated
amp-style Drive/Sustain dials; Chord and Melody share one edge-mounted glass note
workspace; the Melody destination is an independent centred floating track; and
Step 3 uses an unskewed, shallow command dock that collapses an empty Signature
side. The two large 2D chord-stack panels no longer cover the 3D arena. They stay
mounted invisibly for stable state/tutorial ownership, while note flights land on
the live immersive dial readout. Returning to 2D restores the original panels and
styling without remounting the match.

**2026-09-08 update:** the live preview-fidelity pass is now implemented. Materials,
lighting, debris, live rigs, effects, quality controls and preview mouse gestures
are described in [Cosmic arena](cosmic-arena.md). The structural contracts below
still apply; their original visual-work list is historical.

2026-09-07. User authorized the initial structural work, then explicitly asked
to stop when the remaining work suits lower reasoning. That stopping point is
here. The next pass is presentation refinement, not another gameplay refactor.

## Implemented foundation

- Selecting **3D board** now gives the scene the full play-area width. The
  existing 2D layout remains available through **2D board**.
- `src/ui/MatchSurface.jsx` owns layout and panel disclosure only. It provides
  a compact active-spirit/phase/AP summary and Turn, Spirit, Rivals controls.
- `HudRegion` supplies three stable, named regions. The original portrait,
  note controls, action rail and rivals remain children of the game component.
  Hidden drawers stay mounted; there are no portals or duplicate action trees.
- Disclosure defaults to Turn on each phase or engine turn change. The owner
  includes `engineState.turn.count`, so repeated turns of the same spirit do
  not revive a stale drawer selection.
- The `.match-board-preparation` region separates chord stacks, melody track,
  and payout routing from the scenery. Existing refs and actual offset-parent
  measurement continue to position the payout router and note flights.
- `BoardViewport` accepts `immersive` to fill the scene's available height.
  Its live React SVG, input routing, renderer and graphics cleanup are retained.
- At widths up to 1000px, the controls flow beneath the board. At phone widths,
  the outer header wraps rather than creating horizontal scrolling. This is a
  usable narrow-screen fallback; a dedicated touch/camera design remains open.
- During tutorials, the original HUD anchors are disclosed in a scrollable
  stack. `BeginnerTipOverlay` scrolls the current page's HUD anchor into view
  before measuring its position.

## Boundaries for the next pass

Keep game rules, permissions, action handlers, turn flow, networking and SVG
ownership in their current homes. Refine `MatchSurface`'s layout/styles first;
use the existing NoteCommitOverlay, ChannelStrip and ActionRail components for
their respective appearance. Preserve tutorial anchors and unique copies of
each live control. Keep the 2D fallback and run the interaction checks when
changing any control hierarchy.

The current panel internals intentionally retain their existing appearance.
The desktop dock is still fairly large, and the compact summary currently shows
name, phase and AP only. These are presentation starting points, not a finalized
art direction. The reviewed standalone arena remains the visual reference in
`scripts/cosmic-arena` / `output/cosmic-arena`.

## Suggested next work (Medium)

1. Preview a more compact turn dock and status summary, including readable
   Vibe/resources and the active action. Reuse authoritative displayed values.
2. Refine spacing and hierarchy across chord, melody and movement; reduce the
   unused space in the existing action rail. Keep legal targets accessible;
   the panel buttons can collapse the selected drawer.
3. Refine camera toolbar labels, reset/focus affordances and framing at phone
   widths. Camera gestures must never dispatch a move or spend AP.
4. Match the preview's materials/lighting incrementally, checking readability
   and performance. The live view still uses flat character artwork and a
   tactical SVG above scenery; depth-aware 3D characters are a separate project.

Follow the repository's preview-first workflow for new art/taste decisions.
The user has authorized this structural integration; no further visual polish
was undertaken in this High-reasoning pass.

## Verification

`test:journey` now enters 3D with a three-note draft, verifies identical board
and stock DOM nodes, opens each drawer, commits, arms/cancels Bushido, ends a
turn, commits for the next player and recovers to 2D. Its click helper rejects
targets in hidden drawers. This is DOM gameplay coverage with unavailable
WebGL; browser checks supply actual rendering evidence.

`test:arena` retains real WebGL constructor-failure recovery and pointer/cleanup
coverage. It also checks a repeated spirit/phase on a later turn resets the
drawer, preserves child identity and discloses tutorial content. The executable
fixture has a local Fast Refresh lint exception, since it is not an app module.

The render check now has 10 assertions. Anchor checks now match actual HTML
elements, so CSS selectors cannot create false positives or false failures.

Browser checks at 1280×720 and 800×900 covered the full scene, composing three
notes, drawer access, commit, movement (3 AP to 2), camera preset/zoom without
spending AP, 2D recovery with AP preserved, and next-player turn controls.
At 390×844 the action-state document width was 384px, with no horizontal
overflow. The phone board is conservatively framed and can be zoomed further.
No browser warning/error logs were observed in the movement/camera check.

Full-suite, lint and build output for this pass is saved locally in
`.scratch/immersive-test-all.log`, `.scratch/immersive-lint.log` and
`.scratch/immersive-build.log`. Production build retains the existing large-chunk
advisory. The external Systems Map cannot be republished with the tools available
in this session; the repository documents carry the current handoff.

Final results: full `test:all` passes; `check:bundle` has zero warnings;
`lint:baseline` passes at 334 existing errors / 16 warnings with no increased
categories; production build passes. Render is 10/10, architecture 8 checks,
Bushido overlay 331. No existing gameplay/parity assertion counts were reduced.

The working tree already contained arena, Bushido and earlier refactor changes
when this pass started. They were retained. No commit or deployment was made.

## Follow-up polish — 2026-09-09

- Drive/Sustain payout support no longer recolours or pulses the whole note.
  Supported notes keep their established note ring—fourths remain purple,
  fifths remain pink, and other playable notes remain neutral—and carry a small
  red or blue caret inside the hex; dual support shows both carets. The same cue
  follows a note from stock into the draft track.
- Immersive player, resource, drawer, note-stock, track, turn-summary, navigation,
  and camera windows now use lighter-alpha layered glass with a directional gloss
  highlight, stronger blur/saturation and a restrained inset reflection.
- The currently disclosed HUD drawer has a faint cyan bloom. The Move & Act
  window keeps that bloom when it becomes the active action dock.
- Runtime inspection confirmed real support notes used a neutral `#c0c8d8` ring
  with only the internal caret carrying Drive red. The action window resolved to
  translucent layered backgrounds, 20px blur and the intended cyan outer glow.
  No browser errors were reported.
