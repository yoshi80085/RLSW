# Claude handoff — Revolving Stage

Prepared 2026-10-03 for Alex. Workspace: `C:\Users\ATBro\rlsw-sim`.

## Start here

If Claude Code has this workspace open, read this file and work directly in
`.scratch/revolving-stage/`. No import is necessary. The folder is Git-ignored,
so a commit or Git diff alone will NOT transfer the working preview.

For another machine or a Claude environment with file attachments, use
`handoffs/revolving-stage-2026-10-03.zip`. Extract it before working:

- `START_HERE.html` is the self-contained visual preview: open it in a browser
  with WebGL. Three.js, styles and the four character images are embedded;
  no running RLSW server or package installation is needed to view it.
- `project/` contains editable preview source, all its local imported modules,
  all four character PNGs and a minimal package configuration. This is an
  isolated preview project, not an overlay to copy over the game's package.json.
- `CLAUDE_REVOLVING_STAGE_SOURCE.md` is the combined readable source attachment
  for a Claude chat that can read documents. Attach this handoff alongside it.
- `manifest.json` maps originals to packaged copies and records SHA-256 hashes.
- `context/` contains the repository instructions and state documents for context.

These are local files. Preparing them does not upload them to Claude or grant a
remote chat access to this PC. Give Claude the folder/ZIP or attach the documents.

## Running and editing

In the original workspace, reuse the existing server if available:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175
```

Open `http://127.0.0.1:5175/RLSW/.scratch/revolving-stage/`.

For the extracted isolated `project/`, use Node 22.12+ or the current Node 24:

```text
npm install
npm run dev
```

Open `http://127.0.0.1:5175/RLSW/previews/revolving-stage/`. If Vite chooses another
port because 5175 is occupied, use the port it prints. Run `npm test` in that
project, or `node .scratch/revolving-stage/check.mjs` in the original workspace.
The prebuilt HTML is a snapshot: changes to source require using the dev server
or regenerating the handoff; editing source does not change the embedded HTML.

## What Alex requested and what was built

Alex chose Revolving Stage for an interactive preview and asked to rotate
specific rings while leaving others stationary. Checkboxes independently select
rings 1, 2 and 3; all eight combinations work. The centre stays fixed. The study
carries Spirits and a sample Drive amp to their new hex addresses, with optional
facing rotation. Angles are 60 or 120 degrees in either direction.

Alex preferred the earlier mechanism's natural feel, then identified circular
machinery protruding beyond the openings and appearing to disappear on descent.
The CURRENT default is **Fitted to hex openings**: closed steel housings with
inset brass ribs follow the moving hex footprint. Large circular gears remain
below deck. The housings stay attached during lift, turn and descent; no phase
fade or visibility toggle hides them. Latches release before lift and close
after seating. Minimum lift is 0.70 to clear the casing; default lift remains
0.85. Lift/turn/seat timing and quintic easing are unchanged.

**Keep the previous circular carrier comparison.** The Mechanism design selector
switches both looks at the same paused instant. It is intentionally the older,
unfitted geometry for comparison, not a second fixed version.

Controls include ring presets, direction, angle, warning/turn timing, lift,
glow, bloom, three cameras, timeline/phase buttons, speed, destination ghosts,
hex labels, facing, reduced motion, and optional synthesised mechanical sound.
Settings persist and Copy dial-in separates changed values from defaults.
Sound needs a user gesture and starts muted on reload.

## Files to continue

| Source in `.scratch/revolving-stage/` | Purpose |
|---|---|
| `stage.js` | Three.js board, fitted/previous mechanisms, actors and cameras |
| `model.js` | Selected-ring footprint, hex permutation, timeline and defaults |
| `preview.js` | Controls, saved settings, scenario and playback |
| `audio.js` | Synthesised warning, motor and lock cues |
| `index.html`, `style.css` | Preview layout |
| `check.mjs` | One-off movement/pose verification |
| `README.md` | Full behavior and limitations |
| `preview-clearance.png` | Current fitted casing during descent |
| `preview-rings.png` | Earlier ring-selectable build, before the clearance fix |

Geometry and audio are procedural code. There is no separate revolving-stage
GLB, sprite sheet or audio recording to find. The character PNGs and their
standee outlines are included. This study uses the real 111-cell numbering on a
regular axial lattice; the original board image is slightly stretched, so live
integration must account for that difference instead of blindly rotating its
existing world coordinates.

## Boundaries and checks

- This is a standalone graphics/movement proposal. It is NOT wired into the
  live stage-effect deck, engine or renderer; transfer is not integration approval.
- Fixed centre, carrying amps/facing, no damage, shared timing/direction and
  the default selection are demonstrated proposals, not finalized game rules.
  Live cadence and interactions with holes, other effects and abilities remain open.
- Browser localStorage does not travel with the ZIP. Copy dial-in is the transfer
  mechanism. Last observed bloom was 0.36; cameras, rings and timeline were also
  used for QA, so do not treat those settings as a final approved visual preset.
- Read repository `CLAUDE.md`, `src/STATE_OF_PLAY.md` and `src/SEQUENCING.md` before
  production work. Preserve existing uncommitted changes. Preview first.
- Preserve BOTH bat assets (Sol 6.1's original and the later bat study) and the
  Crumbling Stage work. Their separate handoff remains `CLAUDE_STAGE_EFFECTS_HANDOFF.md`.
- Latest movement verification: 13,986 checks passed; preview bundle: zero
  warnings. Browser checked lift, minimum clearance, separated rings, early/
  half/late descent, seating and same-frame comparison with no console errors.
- The previously run repository suite stops at `src/engine/selftest.mjs:457`
  (`atkTotal = stat + roll`, actual 4 vs expected 11). Do not claim the full game
  suite passes. The isolated export's package commands do not run game suites.

## Suggested first Claude prompt

> Read CLAUDE_REVOLVING_STAGE_HANDOFF.md and continue the existing Revolving Stage
> preview. Preserve independent ring selection, the fitted machinery clearance
> fix, the previous-mechanism comparison, and the original motion easing. Work
> from the supplied source and art rather than recreating the effect. Keep it in
> preview until live integration is explicitly approved. Preserve the Bat and
> Crumbling builds and both bat models.
