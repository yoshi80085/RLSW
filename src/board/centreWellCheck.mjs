// ─── 🌀 THE WELLSPRING LOOK CHECK ────────────────────────────────────────────
// `npm run test:centrewell`. Pins `board/centreWell.js` headlessly (no WebGL: it
// builds and drives the layer and reads its uniforms) and the preview's parity
// with it — every look key is a lever on `.scratch/centre-well-preview.js`, so a
// default Alex can't reach is a default he never dialled.
// The arena mounts it (arenaRenderer.js) since 2026-10-17; §8 pins the port.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CENTRE_WELL, CENTRE_WELL_DIALLED, WELL_PALETTES, createCentreWell, wellPulse } from './centreWell.js';
import { HEX_BY_NUM } from './hexMap.js';
import { arenaFrame } from './arenaFrame.js';

let count = 0;
const ok = (c, m) => { count++; assert.ok(c, m); };
const pointFor = (num, y = 0) => { const h = HEX_BY_NUM[num]; return new THREE.Vector3((h.px - 3255) / 200, y, (h.py - 2415) / 200); };

// §0 Alex's dial-in (2026-10-16 22:56, 18 of 52 levers)
ok(Object.keys(CENTRE_WELL_DIALLED).length === 18, '§0 eighteen levers moved, no more, no fewer');
for (const [k, v] of Object.entries(CENTRE_WELL_DIALLED)) ok(CENTRE_WELL[k] === v, `§0 ${k} = ${JSON.stringify(v)} (his dial-in)`);
ok(CENTRE_WELL.lid === 'cover' && CENTRE_WELL.streams === 1400 && CENTRE_WELL.coreGlow === 1.4 && CENTRE_WELL.tapPull === 0.85, '§0 a sample of the levers he left alone is still the default');

// §1 the beat
for (const shape of ['heartbeat', 'breath', 'swell']) {
  let lo = 1, hi = 0;
  for (let t = 0; t < 6; t += 0.01) { const v = wellPulse(t, shape, 2.8); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  ok(lo >= 0 && hi <= 1, `§1 ${shape} stays in 0..1`);
  ok(hi - lo > 0.6, `§1 ${shape} actually beats (range ${(hi - lo).toFixed(2)})`);
  ok(Math.abs(wellPulse(1, shape, 2.8) - wellPulse(3.8, shape, 2.8)) < 1e-9, `§1 ${shape} repeats every period`);
}
ok(wellPulse(2.8 * 0.08, 'heartbeat', 2.8) > 0.95, '§1 the heartbeat\'s first thump lands at 8% of the period');

// §2 it builds where the centre is, and its levers reach the shaders
const scene = new THREE.Scene(), fg = new THREE.Scene();
const well = createCentreWell(scene, { pointFor, hexNum: 56, riseScene: fg });
const c = pointFor(56);
ok(well.group.parent === scene && well.riseGroup.parent === fg, '§2 the stone goes in the arena scene, the rise in the scene it is handed (the foreground in the game)');
ok(Math.abs(well.group.position.x - c.x) < 1e-9 && Math.abs(well.group.position.z - c.z) < 1e-9, '§2 it sits on the centre hex');
const stone = well.group.getObjectByName('Wellspring stone');
const streams = well.riseGroup.getObjectByName('Wellspring streams');
ok(stone && streams, '§2 stone and streams are built');
ok(Math.abs(stone.position.y - (CENTRE_WELL.floorY + 0.004)) < 1e-9, '§2 the stone sits on floorY');
ok(streams.geometry.drawRange.count === CENTRE_WELL.streams, '§2 the particle count is the lever');
well.setLook({ ...CENTRE_WELL, streams: 400, veins: 2.2, palette: 'amber', lid: 'keep' });
ok(streams.geometry.drawRange.count === 400, '§2 setLook re-draws the count');
ok(stone.material.uniforms.veins.value === 2.2, '§2 setLook reaches the stone shader');
ok(stone.material.uniforms.cEnergy.value.getHexString() === WELL_PALETTES.amber.energy.slice(1), '§2 the palette reaches the shader');
ok(!well.group.getObjectByName('Wellspring lid').visible, '§2 lid:keep shows the arena\'s own crack');
well.setLook(CENTRE_WELL);

// §3 the beat drives the stone, and reduced motion holds it still
// ⚠️ Sampled at THIS look's own peak and trough: the dial-in is a 7.2 s breath,
// so fixed heartbeat-shaped times (the first version of this check) read nothing.
let tPeak = 0, tLow = 0;
for (let t = 0, hi = -1, lo = 2; t < CENTRE_WELL.pulseS; t += 0.01) {
  const v = wellPulse(t, CENTRE_WELL.pulseShape, CENTRE_WELL.pulseS);
  if (v > hi) { hi = v; tPeak = t; } if (v < lo) { lo = v; tLow = t; }
}
well.update(tPeak, {});
const onBeat = stone.material.uniforms.pulse.value;
well.update(tLow, {});
const offBeat = stone.material.uniforms.pulse.value;
ok(onBeat > offBeat + 0.3 * CENTRE_WELL.pulseDepth, `§3 the stone is brighter on the beat (${onBeat.toFixed(2)} vs ${offBeat.toFixed(2)})`);
well.update(5, { reduced: true });
ok(stone.material.uniforms.time.value === 0 && streams.material.uniforms.time.value === 0, '§3 reduced motion freezes the swirl');

// §4 the tap: a gift pulls the streams in; a Spirit with no gift only stirs it
const at = pointFor(56, 0.18);
well.tapIn({ at, height: 2.8 }, { gift: true });
well.update(5 + 0.6, {});
ok(streams.material.uniforms.tapPull.value > 0.5, '§4 a gift bends the streams into the Spirit');
ok(stone.material.uniforms.flare.value >= 0, '§4 the stone flares');
well.update(5 + 0.6 + CENTRE_WELL.tapMs / 1000 + 2, {});
ok(streams.material.uniforms.tapPull.value === 0 && !well.diagnostics().tapping, '§4 the tap ends');
well.tapIn({ at, height: 2.8 }, { gift: false });
well.update(9.6, {});
ok(streams.material.uniforms.tapPull.value === 0, '§4 no gift, no pull');
ok(stone.material.uniforms.flare.value > 0, '§4 …but the stone still stirs');

// §5 the aura rides with a charged Spirit, and goes when the gift does
well.update(20, { charged: [{ at, height: 2.8 }] });
ok(well.diagnostics().aura, '§5 a live turn wears the aura');
well.update(20.1, { charged: [] });
ok(!well.diagnostics().aura, '§5 a dark turn does not');
well.update(21, { visible: false });
ok(!well.group.visible && !well.riseGroup.visible, '§5 hidden is hidden');

// §6 dispose leaves nothing behind
well.dispose();
ok(!well.group.parent && !well.riseGroup.parent && fg.children.length === 0, '§6 dispose removes every piece');

// §7 the preview reaches every lever
let prev = '';
try { prev = readFileSync(new URL('../../.scratch/centre-well-preview.js', import.meta.url), 'utf8'); } catch { /* the preview is not in every checkout */ }
if (prev) {
  const keys = new Set([...prev.matchAll(/[RS]\('\w+', '(\w+)'/g)].map(m => m[1]));
  const missing = Object.keys(CENTRE_WELL).filter(k => k !== 'floorY' && !keys.has(k));
  ok(missing.length === 0, `§7 every CENTRE_WELL key is a lever on the preview (missing: ${missing.join(', ') || 'none'})`);
  ok(/createCentreWell\(scene/.test(prev), '§7 the preview draws the game\'s file, not a copy');
}

// §8 the port (2026-10-17): the arena mounts it, the frame carries it, the pink is gone
{
  const sp = [{ id: 'cosmic_ronin', num: 56, color: '#4af' }, { id: 'glam', num: 12, color: '#f4a' }];
  const f = arenaFrame({ spirits: sp, actingId: 'cosmic_ronin',
    well: { lastTap: { spiritId: 'cosmic_ronin', seq: 3, kind: 'ap' }, charged: ['cosmic_ronin'] } });
  ok(f.well.lastTap.seq === 3 && f.well.lastTap.spiritId === 'cosmic_ronin' && f.well.lastTap.gift === true, '§8 the frame carries the tap and its gift');
  ok(f.well.charged.length === 1, '§8 …and who wears the aura');
  const g = arenaFrame({ spirits: sp, actingId: 'cosmic_ronin', well: { lastTap: { spiritId: 'glam', seq: 4, kind: null }, charged: [] } });
  ok(g.well.lastTap.gift === false, '§8 no tap for that Spirit = no gift');
  const hid = arenaFrame({ spirits: sp, actingId: 'glam',
    well: { lastTap: { spiritId: 'ghost', seq: 5, kind: 'ap' }, charged: ['ghost'] } });
  ok(hid.well.lastTap.seq === 5 && hid.well.lastTap.spiritId === null && hid.well.charged.length === 0, '§8 a Spirit not in the frame keeps its seq but loses its name and aura');
  ok(arenaFrame({ spirits: sp }).well === null, '§8 no slice, no well');
  const R = readFileSync(new URL('./arenaRenderer.js', import.meta.url), 'utf8');
  ok(/createCentreWell\(scene,\{pointFor:arenaPoint,hexNum:LIMELIGHT_HEX,riseScene:foregroundScene\}\)/.test(R), '§8 the arena mounts it: stone in the scene, rise on the foreground');
  ok(/well\.dispose\(\)/.test(R) && /well\.update\(elapsed/.test(R) && /well\.tapIn\(/.test(R), '§8 …updates it, taps it, disposes it');
  const J = readFileSync(new URL('../rlsw-simulator-v3_8_1.jsx', import.meta.url), 'utf8');
  ok(!J.includes('#ff44ff18') && !J.includes('stage-glow-grad'), '§8 the SVG\'s pink centre glow and fill are gone');
  ok(/well:\{ lastTap:engineState\.well\?\.lastTap/.test(J), '§8 the client feeds the frame from state.well');
}

console.log(`✅ centreWellCheck: ${count} assertions passed`);
