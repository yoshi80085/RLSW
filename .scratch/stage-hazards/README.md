# Standee hazard reactions — preview only

Shared by the pyro and laser studies. `actors.js` creates the actual `src/board/standee.js` acrylic pieces and imports the existing Ronin, Monster, and Glamarchy images. `motion.js` uses shipped `STANDEE_MOVE`, `planStep`, and `stepPose` for each shove step. Presentation seconds run on the preview clock, so pause, rewind, and slow playback do not accumulate transforms.

The collision timestamp is the landing time of the intercepted step. The pyro sandbox schedules its single mortar shot and audio on that same timestamp. The standee rises, lands, and settles; the struck barrel lowers to clear the landing. Laser reaction mode holds the first live pattern, chooses a two-step approach with no beam on the initial or intermediate hex and no other standee along the route, then stops and recoils on the first lane. Its sound is a contact zap. Both have contact light/ring/sparks, a recovery pose, and an explicitly selected knockdown demonstration ending in the shipped 78-degree standee fall pose. Reduced motion removes the launch/recoil/shudder, retains contact timing and readable flashes, and respects the selected end state.

Pyro: **Preview pyro hit**, **Freeze impact**, and **Impact timeline**. Laser: **Push into laser**, **Freeze impact**, and the existing cue timeline. Both offer reaction strength, a close Impact camera, and slow playback. Outcome and strength save locally and appear in Copy dial-in. The pyro turn sandbox also uses this animation for its existing Push Rival button. Reset/show playback clears the pose.

These are animation studies, not live engine changes. No real damage, Burn ticks, or knockouts are applied. Knockdown selection is a visual stand-in for that future authoritative outcome; ordinary laser movement rules remain untouched.

Run `node .scratch/stage-hazards/check.mjs` for contact timing, sound/eruption sync, deterministic scrubbing, recovery/knockdown/reduced poses, and clean laser approaches.
