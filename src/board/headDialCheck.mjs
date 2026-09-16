// 🎛️ headDialCheck — `test:headdial`. A Drive/Sustain change pops a dial over
// the head of the Spirit it happened to, ticks there, lingers, and fades
// (Alex, 2026-09-16; dial-in off `.scratch/head-dial-preview.html`).
//
// Plain node. The state is pure and TIME-DRIVEN, so every assertion names an
// exact millisecond instead of sleeping — nothing here can be flaky on a slow VM.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { HEAD_DIAL, createHeadDialState } from './headDial.js';
import { createHeadDials, HEAD_DIAL_GEOMETRY, HEAD_DIAL_COLORS } from './headDialVisuals.js';
import { arenaFrame } from './arenaFrame.js';
import { DIAL_TICK } from '../ui/dialTick.js';

let n = 0;
const ok = (c, m) => { n++; assert.ok(c, m); };
const eq = (a, b, m) => { n++; assert.deepEqual(a, b, m); };
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const { delayMs, stepMs } = DIAL_TICK;
const { leadMs, lingerMs, fadeOutMs, fadeInMs } = HEAD_DIAL;
const values = (st, t) => Object.fromEntries(st.sample(t).dials.map(d => [d.stat, d.value]));

console.log('🎛️  headDialCheck — the number moves where the Spirit is\n');

console.log('§1 the numbers are the dial-in');
// ⚠️ All 23 levers came back UNTOUCHED — defaults approved as they stood.
eq({ ...HEAD_DIAL }, { height: 2.75, lift: 0.45, screenSize: 0.06, spacing: 1.04, leadMs: 220, fadeInMs: 180,
  popFrom: 0.62, lingerMs: 900, fadeOutMs: 420, rise: 0.3, bob: 0.04, glow: 1.5 }, 'HEAD_DIAL matches the 2026-09-16 dial-in');
ok(Object.isFrozen(HEAD_DIAL), 'HEAD_DIAL is frozen');
const pocket = read('../ui/ArenaDial.jsx');
for (const [k, v] of Object.entries(HEAD_DIAL_GEOMETRY))
  ok(new RegExp(`\\b${k} = ${String(v).replace('.', '\\.')}\\b`).test(pocket), `head dial ${k}=${v} matches ArenaDial.jsx — two drawings of one dial`);
const surface = read('../ui/MatchSurface.jsx');
ok(surface.includes(`color:${HEAD_DIAL_COLORS.drive}`) && surface.includes(`color:${HEAD_DIAL_COLORS.sustain}`), 'stat colours match the pocket');

console.log('§2 a change, start to finish');
{
  const st = createHeadDialState({ drive: 4, sustain: 3 });
  ok(!st.sample(0).visible, 'first sight shows nothing');
  st.set('drive', 7, 1000);
  const s0 = st.sample(1000);
  ok(!s0.visible || s0.opacity < .01, 'pops in from nothing');
  ok(st.sample(1000 + fadeInMs).opacity === 1, `fully in after ${fadeInMs} ms`);
  eq(st.sample(1000 + fadeInMs).dials.map(d => d.stat), ['drive'], 'ONLY the stat that changed appears');
  ok(Math.abs(st.sample(1000).pop - HEAD_DIAL.popFrom) < 1e-9 && st.sample(1000 + fadeInMs).pop === 1, `pop-in grows from ${HEAD_DIAL.popFrom}× to full size (overshooting a little on the way, as in the preview)`);
  const first = 1000 + delayMs + leadMs;
  eq(values(st, first - 1), { drive: 4 }, `holds the old value through beat + lead (${delayMs}+${leadMs} ms)`);
  eq(values(st, first), { drive: 5 }, 'first tick is one block');
  eq(values(st, first + stepMs), { drive: 6 }, 'then one block per step');
  eq(values(st, first + 2 * stepMs), { drive: 7 }, 'lands');
  const f = st.sample(first).dials[0].flash;
  eq({ index: f.index, dir: f.dir }, { index: 4, dir: 1 }, 'gained block #4 flashes white');
  eq(st.sample(first).tag, [{ stat: 'drive', net: 3 }], '±N tag reads the whole change, +3');
  const land = first + 2 * stepMs;
  ok(st.sample(land + lingerMs).opacity === 1, `lingers ${lingerMs} ms after the last tick`);
  ok(st.sample(land + lingerMs + fadeOutMs / 2).opacity < 1 && st.sample(land + lingerMs + fadeOutMs / 2).rise > 0, 'fades while drifting up');
  ok(!st.sample(land + lingerMs + fadeOutMs).visible, 'gone after the fade');
  ok(!st.active(land + lingerMs + fadeOutMs), 'and no longer active — the renderer may rest');

  // A second change after it faded is a fresh pop, with a fresh ±N.
  const t2 = land + lingerMs + fadeOutMs + 500;
  st.set('drive', 5, t2);
  eq(st.sample(t2 + delayMs + leadMs).tag, [{ stat: 'drive', net: -2 }], 'next change counts from where the last one ended');
  const loss = st.sample(t2 + delayMs + leadMs).dials[0].flash;
  eq({ index: loss.index, dir: loss.dir }, { index: 6, dir: -1 }, 'lost block #6 flashes red');
}

console.log('§3 overlapping changes');
{
  const st = createHeadDialState({ drive: 2, sustain: 3 });
  st.set('drive', 6, 0);
  const t = delayMs + leadMs + stepMs;          // standing on 4, heading for 6
  eq(values(st, t), { drive: 4 }, 'mid-run');
  st.set('drive', 3, t);
  eq(values(st, t + stepMs - 1), { drive: 4 }, 'a change of mind does not jump');
  eq(values(st, t + stepMs), { drive: 3 }, 'it turns round one step later — no second beat, no lead');
  eq(st.sample(t + stepMs).tag, [{ stat: 'drive', net: 1 }], 'the tag nets the whole change (2 → 3)');

  st.set('sustain', 5, t + 10);
  eq(st.sample(t + 10).dials.map(d => d.stat), ['drive', 'sustain'], 'a second stat joins the rig in Drive, Sustain order');
  eq(values(st, t + 10 + delayMs - 1).sustain, 3, 'a dial already up waits only the ordinary beat …');
  eq(values(st, t + 10 + delayMs).sustain, 4, '… not the pop-in lead');
  const lastLand = t + 10 + delayMs + stepMs;   // sustain 3→5: two steps, the second one stepMs after the first
  eq(values(st, lastLand), { drive: 3, sustain: 5 }, 'both landed');
  ok(st.sample(lastLand + lingerMs).opacity === 1 && st.sample(lastLand + lingerMs + 50).opacity < 1,
    'the rig lingers from the LAST stat to land, then fades');

  const same = createHeadDialState({ drive: 5, sustain: 5 });
  same.set('drive', 5, 0);
  ok(!same.active(0), 'setting the value it already has is not a change');
  same.set('drive', 7, 0, { snap: true });
  ok(!same.active(0) && !same.sample(0).visible, 'snap moves the value silently');
  same.set('drive', 8, 100);
  eq(same.sample(100 + delayMs + leadMs).tag, [{ stat: 'drive', net: 1 }], 'and the next real change counts from the snapped value');

  const unknown = createHeadDialState({});
  unknown.set('drive', 6, 0);
  ok(!unknown.active(0), 'the first known value after unknown is first sight, not a change');
}

console.log('§4 reduced motion');
{
  const st = createHeadDialState({ drive: 1, sustain: 1 });
  st.set('sustain', 9, 0, { reduced: true });
  const s = st.sample(0, { reduced: true });
  ok(s.visible && s.opacity === 1 && s.pop === 1, 'still SHOWS the dial — the information is not motion');
  eq(values(st, 0), { sustain: 9 }, 'but lands at once');
  ok(s.dials[0].flare === 0, 'no glow pulse');
  ok(st.sample(lingerMs + 1, { reduced: true }).visible === false, 'and leaves without a fade');
}

console.log('§5 over the right head, in three.js');
{
  const root = new THREE.Group();
  const dials = createHeadDials(root);
  const pawns = new Map([['ronin', new THREE.Object3D()], ['monster', new THREE.Object3D()]]);
  pawns.get('ronin').userData.target = new THREE.Vector3(2, .34, 1);
  pawns.get('monster').userData.target = new THREE.Vector3(-5, .34, 3);
  const camera = new THREE.PerspectiveCamera(43, 1.6, .1, 500);
  camera.position.set(27, 20.8, 37); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const spirits = (rd, rs, md, ms, extra = {}) => [{ id: 'ronin', drive: rd, sustain: rs, ...extra.ronin }, { id: 'monster', drive: md, sustain: ms, ...extra.monster }];
  const shown = () => root.getObjectByName('Head dials').children.filter(o => o.visible);

  dials.update(spirits(4, 3, 5, 6), 0); dials.tick(0, camera, pawns);
  eq(shown().length, 0, 'first frame: no dial over anyone');
  eq(dials.active(0), 0, 'first frame: nothing active');

  dials.update(spirits(4, 3, 5, 4), 1000);    // the Monster's shield breaks
  dials.tick(1000 + delayMs + leadMs + 10, camera, pawns);   // just after the first tick (fade-in is done by then: 180 < 340)
  const vis = shown();
  eq(vis.length, 2, 'one dial + its ±N tag');
  const dial = vis.find(o => o.userData.drawn?.stat);
  eq({ stat: dial.userData.drawn.stat, value: dial.userData.drawn.value }, { stat: 'sustain', value: 5 }, 'the SUSTAIN dial, mid-tick');
  const head = pawns.get('monster').userData.target;
  ok(Math.hypot(dial.position.x - head.x, dial.position.z - head.z) < 3 && dial.position.y > head.y + HEAD_DIAL.height,
    'it floats over the MONSTER, not the acting Ronin');
  eq(dials.active(1500), 1, 'one rig active — the renderer keeps drawing');
  ok(dial.material.depthTest === false && dial.renderOrder >= 170, 'drawn over everything, like sonicSceneLabel');

  dials.tick(9000, camera, pawns);
  eq(shown().length, 0, 'gone once it has faded');

  dials.update(spirits(4, 3, 5, 4, { monster: { knockedOut: true } }), 9100);
  ok(!dials.rigs.has('monster'), 'a knocked-out Spirit loses its rig');
  dials.update([spirits(4, 3, 5, 4)[0]], 9200);
  ok(!dials.rigs.has('monster'), 'a Spirit hidden by smoke (absent from the frame) loses its rig');
  dials.update(spirits(4, 3, 9, 9), 9300);
  eq(dials.active(9300), 0, 'coming back with new numbers is first sight — no reveal of what changed in the smoke');

  dials.dispose();
  ok(!root.getObjectByName('Head dials'), 'dispose removes the group');
}

console.log('§6 the frame carries the numbers, and only for visible Spirits');
{
  const frame = arenaFrame({ spirits: [{ id: 'ronin', num: 7 }, { id: 'monster', num: 16 }],
    stats: { ronin: { drive: 6, sustain: 3 }, monster: { drive: 2 }, smoked: { drive: 9, sustain: 9 } } });
  eq(frame.spirits.map(s => [s.id, s.drive, s.sustain]), [['ronin', 6, 3], ['monster', 2, null]], 'drive/sustain per visible spirit, null when unknown');
  ok(!JSON.stringify(frame).includes('smoked'), 'a Spirit filtered out by smoke leaks no numbers');
  eq(arenaFrame({ spirits: [{ id: 'ronin', num: 7 }] }).spirits[0].drive, null, 'no stats → no head dial (and no crash)');
}

console.log('§7 the wiring');
{
  const visuals = read('./arenaVisuals.js'), renderer = read('./arenaRenderer.js'), client = read('../rlsw-simulator-v3_8_1.jsx');
  ok(/headDials\.update\(frame\.spirits,clock\*1000/.test(visuals), 'arenaVisuals feeds every frame on the arena clock');
  ok(/headDials\.tick\(time\*1000,camera,pawns/.test(visuals), 'arenaVisuals places the dials over the live pawns each tick');
  ok(/headDials\.dispose\(\)/.test(visuals), 'and disposes them with the scene');
  ok(/moving=stats\.effects>0\|\|stats\.headDials>0/.test(renderer), 'reduced-motion rendering keeps drawing while a dial is up (or it would never disappear)');
  const call = client.slice(client.indexOf('sceneFrame={board3D ? arenaFrame({'), client.indexOf('}) : undefined}>', client.indexOf('sceneFrame={board3D ? arenaFrame({')));
  ok(/stats:Object\.fromEntries\(spirits\.map/.test(call), 'the client passes stats into the scene frame');
  ok(/spiritChord\(s\.id, noteStates\[s\.id\]\?\.driveStack \?\? \[\]\)\.drive/.test(call)
    && /spiritChord\(s\.id, noteStates\[s\.id\]\?\.sustainStack \?\? \[\]\)\.sustain/.test(call), 'using the same spiritChord read as the pocket dial');
  ok(/drive: spiritChord\(acting\.id, actingDriveStack\)\.drive/.test(client), 'the pocket still reads spiritChord too — they cannot disagree');
}

console.log(`\n✅ headDialCheck: ${n} assertions passed`);
