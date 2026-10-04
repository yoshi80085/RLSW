# Approved Sonic, Riff Off and Thrash soundforms

Run `npm run dev:sonicglitter` and open the URL printed by Vite. The preview is
at `/RLSW/previews/sonic-glitter/`.

The approved settings are now used in the game. `src/board/sonicGlitter.js`
owns the shared effect and exact approved preset; `spiral.js` re-exports it for
the inspector. The production ring spacing is 0.59 and beam radius is 0.66.

Open `/RLSW/previews/sonic-glitter/attacks.html` to compare all three production
effects, with playback speed and a sequence scrubber:

- **Sonic:** rings and the approved inner glitter helix, continuing through
  contact compression and impact. Playback uses the game's barrage clock,
  contact hitstop and shield-break slowdown.
- **Riff Off:** matching ring and helix streams, plus glitter in the central
  soundform. Existing energy growth and stream movement remain in place.
- **Thrash:** glitter helix only, directed from each amp into its Spirit's
  raised instrument and following the approach and strike. No beam rings or
  solid beam are added.

Combat rules, outcomes and audio are unchanged.

Glitter winds along the beam as one to four helical strands. It samples the
actual ring mesh after each update, so it follows the shipped path, taper,
breathing, flight timing and contact compression. Radial scatter is clamped to
96% of the interpolated inner ring radius. Particles have smooth twinkle and
a small four-point glint, with optional faint threads under the particle bands.

- **Inspect wave** holds the attack frame while animating the glitter.
- **Attack loop** plays launch, approach, contact hitstop and absorbed impact.
- **Rings only / Glitter only / Combined** isolates the layers.
- **Side / Three-quarter / Down the beam** changes the camera. Drag to orbit.
- Shape, glitter, motion, and underlying-wave controls apply immediately.
- Pause stops both clocks. Scrubbing sets the exact attack frame and pauses.
- **Approved** restores the exact accepted settings. Inspector adjustments
  stay local to the preview; they do not rewrite the game's preset.
- Settings persist locally. **Copy settings** exports versioned JSON; a
  selectable text field is provided if clipboard access is unavailable.
- A reduced-motion preference starts paused. Play is an explicit opt-in.

Glitter rotation is in revolutions per animation second and particle flow is
in beam lengths per animation second. Attack playback speed scales both.
The held inspector runs glitter at its native speed. The preview is silent.

Validation completed: preview geometry checks, `test:sonicfx`,
`test:sonicjourney`, `test:swing`, `test:dice`, the Riff arena preview checks,
`test:riffarenalive`, changed JavaScript lint, and the production build.
The architecture audit still reports 14 unrelated undocumented modules
(existing bat, crumbling, laser and smoke files).

Focused checks:

```sh
node previews/sonic-glitter/check.mjs
node src/board/sonicGlitterCheck.mjs
npm run test:sonicfx
npm run test:sonicjourney
npm run test:swing
node previews/riff-arena/check.mjs
npm run test:riffarenalive
npm run build
```
