# A. 🧭 THE CURRENT HANDOFF

## 6-arena-live. Optional live 3D board — 2026-09-06

Alex authorized connecting the reviewed arena to the match. The game now offers
a 2D/3D switch, tactical/arena cameras and zoom. The GLB is lazy-loaded scenery;
the actual React SVG is projected onto its surface, keeping all existing pieces,
targeting, abilities and effects attached to the real match. Characters remain
flat artwork and overlays draw above scenery. Rules and amp footprints are
unchanged. See `../docs/cosmic-arena.md` for files and limitations.

Browser verification caught two integration traps: OrbitControls captures an
unassigned left pointer, swallowing the subsequent hex click; and React can
remove the toolbar sibling before the SVG restoration cleanup runs. Both now
have guards in `test:arena`, included in `test:all`. The browser verified 7 → 16
for one AP, distant-move rejection without spending AP, 2D/3D preservation of
position and AP, Shukuchi 16 → 35 for one AP, and next-turn continuity in 3D.

Final verification: Swing 45 → 55 completed both dice, applied Vibe/Fame changes,
spent the action and returned to the next turn in 3D without console errors.
An 800px viewport exposed camera cropping in the narrow board column; camera
distance now follows aspect ratio, and the arena fits after resizing. Deliberate
WebGL failure showed the recovery message and allowed play to continue in 2D.
`arenaFallbackCheck.jsx` also verifies actual WebGL constructor failure, state
preservation and interactive recovery under React. Final `test:arena`,
`test:arch`, `check:bundle` and production build pass. This completes the first
playable hybrid port; full 3D characters and a phone-layout redesign are separate.

All pre-existing `test:all` groups passed across the full run plus the resumed
tail after correcting an existing missing architecture row for the battle
journey. Production build passes (large-chunk advisory remains), bundle check
has zero warnings, lint baseline stays 334 errors / 16 warnings with no added
categories, and the new arena DOM checks pass. The external Systems Map could
not be edited because its artifact tool is not available in this session.

## 6-arena. Cosmic island and attached amp study — 2026-09-06

Alex supplied `board2.png` and requested a 3D cosmic stage with the redesigned
amps supported by the board/island. Built an interactive `.scratch/cosmic-arena`
preview first, then saved reproducible source in `scripts/cosmic-arena` and the
Blender/GLB/browser deliverables in `output/cosmic-arena`. The model follows the
existing 111-hex coordinates and eight angular perimeter amp footprints. Geometry
is batched by material; 79 meshes, about 77k triangles, about 4 MB GLB.

Movement in the drill calls the live movement reducer after preview adjacency and
occupancy checks. Attacks are labeled visual demos, not match combat. Browser
checks exercised movement, rejection of a distant target, amp selection and beam,
knock-off return, camera views, height adjustment, and reference comparison. The
2D client and rules were not changed. See `../docs/cosmic-arena.md` for the exact
scope and rebuild steps. Next: visual feedback before connecting this renderer
to real match state, targeting, and combat events. The external Systems Map was
not republished; this standalone study does not change its gameplay dependencies.

## 5-lane. 🗡️ Bushido gets a path, and the lane gets ONE rule — 2026-09-05

### Resumed in Codex — the screenshot-selected lane is now ported

Recovered identical previews from `.scratch/bushido-lane-preview.html` and
`Claude outputs/bushido-lane-preview.html`. Alex supplied the three dial-in
screenshots at 22:18–22:19. `ui/BushidoOverlay.jsx` now paints those values in
the real client: lane under pieces, ring/labels above, hidden unless armed and
usable. Existing blocker rules, attack costs and execution were retained.

Fill .10→.60, gamma 1.25; edge .36→.76, far width 3.1; bloom 26/.72;
dim run-up .03; stop bar, no ghosting; spine 9/.50, widening and arrow enabled;
labels 110, ring and far pulse enabled; Ronin blue shifted toward white.

Verification: all 28 test groups pass, including Bushido 108, overlay 331,
and client arm/cancel/next-turn interaction. Bundle check has zero warnings;
production build succeeds. The recovered preview stays unchanged as the parity
reference. `.scratch/bushido-port-verification.html` shows preview versus port.
The older “not ported” notes below describe the earlier pass, not current status.

### A. The decision board, fourth run — 14 calls, 2 of them new

The board found **two calls nobody had written down as calls**, and both were
inside the ability that was about to be worked on:

- ⭐ **Which occupancy policy Bushido's lane obeys.** §5-refactor recorded the
  three-way split and preserved it *deliberately*, as a not-a-refactor. What it
  did not do was file it as a **decision waiting for its owner** — so it read as a
  footnote rather than as a question. It was one, and it blocked the day's work: a
  glowing path has to light *some* set of hexes, and whichever set it lights
  becomes the rule players read off the board.
- ⭐ **What the lane's brightness is FOR.** §2.1 has said since it was written
  that the ability creates *"one legible, board-wide threat"*. Nothing had ever
  asked whether the board should say that out loud, or when.

🎯 **§B11 AGAIN, ONE RUNG DOWN.** §B11 is *"a step labelled unblocked is read as a
step with nothing to ask."* This is **a discrepancy labelled "preserved on
purpose" being read as a discrepancy with nobody to ask** — an honest,
correctly-worded paragraph that named the right facts and stopped one sentence
short of naming an owner. The other twelve rows of the board were carried
unchanged and live in `STATE_OF_PLAY.md`.

##