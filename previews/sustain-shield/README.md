# Sustain living shield study

Run Vite and open `/RLSW/previews/sustain-shield/` (or `npm run dev:sustainshield`).
The approved form and damage effects are now used by the game's Sonic and
Psycho Bushido Sustain shields. This inspector imports that production renderer.

The starting shape uses Alex's complete 2026-10-04 dial-in: height 3.6, curvature
0.13, eight rings, 3.3 face coils, 0.5 helix turns and hue 280. Every supplied
shape, glitter and light value is preserved in `DEFAULTS`. Nested contours breathe
over the surface. The approved Sonic
glitter renderer follows a coiled path across that face, making a three-strand
helix that belongs to the same visual family as the attacks.

- Width, height, hex character, corner softness, curvature and edge thickness
  sculpt the silhouette. Front and edge cameras make the changes easy to see.
- Ring count, brightness, breathing and travelling pulse adjust the living shell.
- Spiral coils, helix turns, strands, spread and density adjust the glitter.
- Motion and light controls include speed, twinkle, hue, surface glow and strength.
- Your shape restores that exact dial-in; Soft oval and Cut crystal explore
  alternative silhouettes. Reset also restores the initial damage controls.
- Damage sequence starts at the held shield, then plays four hits by default:
  100% → 75% → 50% → 25% → broken. It loops through the amp-fed build again.
  Every hit ejects glitter from a distinct contact point, and the surviving
  rings lose light, become ragged and develop gaps. At zero integrity the shell
  disappears, releasing glitter and short curved pieces of its own rings.
- Intact / First hit / Critical / Break jump directly to paused states. Manual
  hits lets you strike repeatedly and restore the shield. The integrity display
  makes the progression explicit, including when changing the hit count.
- Hits to break, hit spacing, shed amount, spray distance, hang time, fraying,
  break glitter, break spread and ring fragments are adjustable. The preview
  removes equal shares per hit; it does not change combat rules or game timing.
- Compare previous shows a frozen copy of the pre-upgrade shield beside the
  production form, at the same camera scale.
- Pause freezes all motion. The sequence scrubber permits direct seeking.
  A reduced-motion preference starts paused; Play explicitly opts into motion.
- Settings survive reloads under a new damage-study storage key; the previous
  study's saved values are retained. Copy settings provides both JSON and a
  selectable fallback, with separate shape and damage settings and changes.

`src/board/sustainShield.js` and `sustainDamage.js` own the geometry and effects.
The game's clash supplies actual HP loss, hit times and contact placement. The
preview's `damage.js` supplies its synthetic equal-hit sequence instead. Both
sample effects from event ages, so pause, rewind and replay are deterministic.
The preview's hit count and spacing never alter the game's combat rules.

Production validation: `node src/board/sustainShieldCheck.mjs`, `npm run
test:sonicfx`, `npm run test:bushidoarena` and `npm run build`.
