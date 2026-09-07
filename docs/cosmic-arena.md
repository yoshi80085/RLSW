# Cosmic arena — interactive environment study

Live HUD update, 2026-09-07: 3D mode now uses the full play-area width with
floating Turn / Spirit / Rivals regions. Drafts and board controls stay mounted
when switching views. The initial structural pass is complete; the next Medium
reasoning pass is specified in [the immersive HUD handoff](immersive-hud-handoff.md).

Built 2026-09-06 from Alex's `board2.png` and the existing 111-hex map.

The eight amp stations follow the supplied angular perimeter silhouettes. Corner
units wrap around the stage corners; side units follow the side bends. All have
solid foundation saddles, rock buttresses, and anchor struts. Speaker detail is
interpreted from the finished upper-left cabinet. Heights, rear faces, and hidden
geometry are artistic interpretations, not dimensions specified by the image.

## Open

From the repository, run `powershell -ExecutionPolicy Bypass -File scripts/cosmic-arena/open-preview.ps1` and it will start the local server and open
<http://127.0.0.1:4318>. The manual equivalent is `node scripts/cosmic-arena/serve.mjs`,
then open that URL. Opening `output/cosmic-arena/index.html` directly is not
supported because browsers restrict ES modules and GLB fetches under `file://`.
The server binds only to localhost and serves only `output/cosmic-arena`.

- `output/cosmic-arena/cosmic-arena.blend`: editable Blender scene, materials,
  meaningful object groups, inspection camera, and render lights.
- `output/cosmic-arena/cosmic-arena.glb`: browser geometry, approximately 4 MB.
- `output/cosmic-arena/index.html`: exported browser preview (serve over HTTP).
- `scripts/cosmic-arena/build_scene.py`: deterministic Blender generator.
- `scripts/cosmic-arena/arena.js`, `arena.css`, `index.html`: preview source.
- `.scratch/cosmic-arena`: initial interactive prototype and isolated dependency.

## What is built

The Blender model includes the fractured island and keel, emissive rock fissures,
111 raised hex surfaces with corner illumination, the central Limelight motif,
eight bent amp cabinets with speakers and controls, supported grandstands, and
four concert lighting towers. Static geometry is batched by material and structure
for 79 mesh objects and 77,438 triangles at initial delivery.

The browser adds procedural space, distant planets, orbiting debris, concert
beams, four stylized placeholder spirit miniatures, and sonic pulse, electric amp
beam, and knock-off/return demonstrations. Camera presets inspect the arena,
tactical board, underside, and cabinet fronts. Sliders change glow, rock lighting,
amp height, and fissure energy. Switches control beams, debris, orbit, hex labels,
and rendering detail. Settings persist locally and can be downloaded with the
current camera pose. Reduced-motion preferences disable automatic orbit and idle
debris movement and shorten movement/view transitions.

Movement reads the live hex map and neighbor geometry and calls the existing
`applyMoveStep` reducer, after an isolated preview gate checks adjacency, occupancy,
and remaining steps. Each miniature receives six drill steps; changing miniatures
refills this sandbox budget. The scene converts Blender Z-up to glTF Y-up explicitly:
browser `(x, y, z) = ((px - 3255)/200, height, -(py - 2415)/200)`.

## Live match integration (2026-09-06)

Start the game normally and choose **3D board** at the bottom-right of the board.
**Tactical** and **Arena** change the camera; right-drag or middle-drag orbit/pan,
the wheel and +/− buttons zoom, and **2D board** returns to the original view.
Touch devices use taps for gameplay and the camera buttons for view/zoom.

The match loads `public/cosmic-arena/cosmic-arena.glb` and Three.js only when the
3D view is requested. `src/ui/BoardViewport.jsx` mounts the camera/scenery from
`src/board/arenaRenderer.js`. The same live React SVG is projected onto the arena:
spirit positions, facing, note tokens, targeting, ability layers, smoke/decoys,
and combat effects keep their existing state and event handlers. No sandbox
movement budget, preview spirits, or demo combat buttons enter the match.

This first playable integration is a **hybrid**: character artwork and tactical
effects remain flat on the board and are composited above the scenery. There is
no model-depth occlusion or volumetric character animation. The camera stays
above the board; the preview's underside/orbit demonstration is not a play view.
The GLB's exported Z is reflected to align image Y with world +Z in the match,
keeping the original board orientation and all 111 hex coordinates aligned.
Amp scenery does not change live occupancy, range, access, or upgrade rules.

If graphics or asset loading fails, a status message offers the 2D return button;
the match state remains in the game component. The renderer releases graphics
resources and restores the live SVG when leaving 3D. `test:arena` guards pointer
capture and restoration when React has already removed the camera toolbar.

When rebuilding the Blender model, also copy the exported GLB into
`public/cosmic-arena/cosmic-arena.glb` before building the game.

Live verification completed: normal movement, illegal-move rejection, Shukuchi,
state-preserving view switches, real Swing through both dice and Vibe/Fame
outcome, and next-turn handoff. No console errors were observed in the combat
run. An 800px viewport check caught and fixed camera cropping; distance now
adjusts with aspect ratio. The overall game phone layout has not been redesigned.
Deliberately unavailable WebGL showed a recovery message and allowed continuation
in 2D, also covered by an automated React test in `test:arena`. Final arena,
architecture, bundle and production-build checks pass. The build retains its
large-chunk advisory; the arena renderer is loaded separately (~149 KB gzip).

## Isolated study scope

The standalone preview is a visual and interaction study, **not the full match client**.
Combat buttons are clearly labeled effect demos; they do
not calculate damage, spend game resources, resolve battles, or award Fame.
The sandbox does not include multiplayer, music input, abilities, shops, or a full
turn loop. Placeholder miniatures are not final character models.

The user authorized live integration after reviewing the arena study. Full 3D
character models and depth-aware effects remain a later presentation pass.

## Rebuild

```powershell
npm.cmd install --prefix .scratch/cosmic-arena three@0.180.0 --no-audit --no-fund --ignore-scripts
node scripts/cosmic-arena/build.mjs
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python scripts/cosmic-arena/build_scene.py
node scripts/cosmic-arena/serve.mjs
```

The two reference PNGs in the output folder are copies of the existing board and
the supplied `board2.png`. They are reference images, not textures pasted onto a
flat scene. Rebuilding does not need access to Downloads once those copies exist.

## Verification

- Blender 5.2.1 generated, saved, and exported the scene successfully.
- Browser bundle completed with zero warnings.
- Browser inspection found no console errors or warnings during the initial checks.
- Tactical move 47 → 37 updated the Ronin and reduced the budget from 6 to 5.
- A nonadjacent destination was refused without spending another step.
- Amp beam activation and knock-off return were exercised through the UI.
- Arena, tactical, and underside views and the two-reference dialog were inspected.
- Browser performance observed around 118–120 FPS on this machine during the initial
  desktop checks; this is not a mobile-device performance guarantee.

No live game modules were edited for this study. Existing gameplay tests were not
rerun merely for the isolated visual preview. Full client integration needs its
own gameplay and browser regression checks.
