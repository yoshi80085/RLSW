# Pyrotechnics — stage study 03

Run the repository's Vite server, then open `/RLSW/.scratch/stage-pyro/`.

Preview only; the game rules and live arena are untouched. Reuses the game's 111-hex map. Five first-wave and eight finale hexes avoid the three display pawns, centre, and outer edge. Preview seconds compress the round cadence for art direction.

Drag to orbit, scroll to zoom. Use the cue buttons or scrub the timeline to freeze any moment. Try Stage, Low, Top, or Mortar cameras. Tune cannon height, flame fullness, firework spread, spark density, salvo spacing, bloom, palette, and playback speed. Toggle individual layers, try a fresh layout, or choose one of three looks. Settings persist locally and can be copied or downloaded as JSON.

Procedural flame shaders, mechanical mortar petals/barrels/recoil, comet trails, ballistic firework crowns, furnace embers, twelve perimeter cannons, and a physical rear spark truss. All particles derive from absolute preview time, so backward scrubbing and pause are stable. Reduced-motion preference starts paused.

## Sound and turn rules (2026-10-02)

Click **Enable sound & replay** for synthesized stereo steel impacts, motor rumbles, deep mortar reports, flame roars, rolling aerial reports/crackles, and the spark-curtain hiss. **Hear assembly** and **Hear retraction** jump to those visual sequences and start audio. **Bass weight** adjusts the low-frequency body independently of volume (default 1.35×, saved with the dial-in). The volume fader persists; zero is silent. Separate low-frequency brown noise, damped steel resonances, and narrow-spread bass add weight; mild saturation preserves body on smaller speakers. Compression and a final limiter control overlapping volleys. Pause, seek, switching modes, and hiding the page stop active sounds. Scrubbing never plays a backlog of cues. Slower playback slows cue spacing while retaining natural pitch; motor duration stretches to follow the mechanism. Assembly has unlock, lift, and locking cues; disassembly has latch release, lowering, and hatch-seal cues. Both the show and turn sandbox use the same cue builder, with retraction keyed to the geometry's end time.

**Try turn rules** opens a separate interactive sandbox. Five mortars arm on empty hexes each player turn; deployment completes before actions unlock. **Resolve battle** fires unspent mortars without moving them. **End turn** fires anything remaining, lets the visuals finish, then retracts and creates a new layout avoiding both occupied spaces and the old mortar positions. Charges fire only once per layout.

**Push Rival 3 spaces** deliberately sets up a mortar on step two. The pawn animates through the first hex, stops at that first armed mortar, and triggers that mortar on impact; other charges remain armed. This preview interprets the impact as stopping the push. The UI describes the existing 1 Vibe + Burn rule, but does not simulate combat health, turns of Burn, or knockouts. The scenario resets via **Reset sandbox**. A hit charge is not fired again by battle resolution or turn end. **Show playback** restores the original cinematic study.

Live game integration remains a subsequent pass, by user request. The live engine still uses its earlier cadence. Preview rules live in `sandbox.js`; synthesized audio and cue crossing live in `audio.js`.

Files: `choreography.js` (tuning and phase data), `pyro.js` (effect geometry/shaders), `sandbox.js` (preview turn/push rules), `audio.js` (sound design), `preview.js` (stage and controls), `index.html`, `style.css`.

Standee reactions now use the shared study in ../stage-hazards. Use Preview pyro hit, Freeze impact, and the Impact timeline to review the shared shove and blast reaction. The turn sandbox's push uses that same movement timing.

