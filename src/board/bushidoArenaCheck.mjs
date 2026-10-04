// ─── ⚡ bushidoArenaCheck — a Psycho Bushido, played through the real arena ───
// The arena GLB, `arenaVisuals`, `arenaFrame` and the client's own Sonic-shaped
// bout timeline (the intro, the Rival's ROLL, the shield, the gate, the Ronin's
// ROLL, the launch, the warp at the draw — exactly as `resolveSonicSequence`
// dispatches it), on a VIRTUAL clock. It asserts what Alex signed off in the
// preview and what he asked for on top (2026-10-01):
//   · "make sure the amps are sending the Sustain shield power up - the stronger
//     the roll - the brighter the shield" — the shield is BUILT (rings from the
//     Rival's Sustain amp) and a stronger roll is a brighter shield;
//   · he stands on his own hex through the roll, crouched and charging as his
//     dice land, and RUMBLES harder the more dice he threw;
//   · he is "gone" in the dash and arrives on the hex before the Rival — with no
//     standee step (no blink) for that move;
//   · no ring beams, and his Drive amp does not fire.
import * as THREE from 'three';
import assert from 'node:assert';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
let vnow = 1000; performance.now = () => vnow;
// 📌 A STANDEE NEEDS A TEXTURE, AND NODE HAS NO DOM. The battle-lens harness
// sidesteps it with block pawns; this check needs the real standee (the pose is
// applied to its carrier), so the image loader gets an inert element — the art
// never loads, which a scene-graph check does not need.
globalThis.document ??= {
  createElementNS:() => ({ addEventListener() {}, removeEventListener() {}, set src(v) { void v; } }),
  createElement:() => ({ getContext:() => null, style:{} }),
};
const { createArenaVisuals, arenaPoint } = await import('./arenaVisuals.js');
const { arenaFrame } = await import('./arenaFrame.js');
const { HEX_BY_NUM, HEX_BY_QR } = await import('./hexMap.js');
const { angleTo, neighborInDirection } = await import('./hexGeometry.js');
const { resolveSonicBarrage } = await import('../engine/systems/sonicBarrage.js');
const { scheduleSonicBarrage } = await import('./sonicPresentation.js');
const { SONIC_GATE, SONIC_DICE, BARRAGE_LAUNCH, barrageContact, beatsFor } = await import('./sonicBarrageTiming.js');
const { BATTLE_INTRO } = await import('./battleRollGate.js');
const { BUSHIDO_STRIKE, planStrike } = await import('./bushidoStrike.js');
const { shieldStrength } = await import('./sonicClashVisuals.js');

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const bytes = readFileSync(new URL('../../public/cosmic-arena/cosmic-arena.glb', import.meta.url));
const baseModel = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;

// A clear lane: the Ronin on 45 facing 0, the Rival 4 hexes on.
const START = 45, o = HEX_BY_NUM[START], f = neighborInDirection(o, 0), dq = f.q - o.q, dr = f.r - o.r;
const laneAt = d => HEX_BY_QR[`${o.q + dq * d},${o.r + dr * d}`].num;
const DIST = 4, RIVAL = laneAt(DIST), LAND = laneAt(DIST - 1);

function bout({ pool, vals, dropped = [], droppedPool = [], sustain, sustainPool }) {
  vnow = 1000;
  const model = baseModel.clone(true); model.scale.z = -1;
  const scene = new THREE.Scene(); scene.add(model);
  const visuals = createArenaVisuals(scene, { foregroundScene:new THREE.Scene() }); visuals.attachModel(model);
  model.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(43, 1.9, .1, 500); camera.position.set(28, 21, 37); camera.lookAt(0, 0, 0);
  const spirits = [
    { id:'cosmic_ronin', num:START, corner:'blue', color:'#4488ff', facing:0, vibe:9, maxVibe:9, imageSrc:'/spirits/ronin.png' },
    { id:'b', num:RIVAL, corner:'red', color:'#ff6600', facing:angleTo(HEX_BY_NUM[RIVAL], HEX_BY_NUM[START]), vibe:9, maxVibe:9 },
  ];
  const noteStates = { cosmic_ronin:{ driveStack:['C', 'E', 'G'], sustainStack:['C', 'E'] }, b:{ driveStack:['C', 'E'], sustainStack:['C', 'E', 'G'] } };
  const shield = sustain.reduce((a, v) => a + v, 0), ledger = resolveSonicBarrage(vals, shield);
  let battle = { attackerId:'cosmic_ronin', defenderId:'b', sonicAttack:true, sonicVersion:2, attackKind:'bushido',
    bushido:true, bushidoDist:DIST, bushidoFrom:START, bushidoTo:LAND,
    dicePool:pool, diceVals:vals, droppedDiceVals:dropped, droppedDicePool:droppedPool,
    diceHits:ledger.shots.map(s => s.through > 0), shieldValue:shield, sustainPool, sustainRolls:sustain,
    hitCount:ledger.shots.filter(s => s.through > 0).length, damage:ledger.strengthThrough, ...ledger,
    sonicChordNotes:[0, 4, 7], sustainChordNotes:[0, 4], sonicId:'b1', phase:'sonic_armed_rival', viewer:'attacker' };
  battle.shots = battle.shots.map(s => ({ ...s, at:BARRAGE_LAUNCH + barrageContact(s.index, beatsFor(battle)) }));
  const push = () => visuals.update(arenaFrame({ spirits, noteStates, actingId:'cosmic_ronin', turn:3, battle }));
  push();
  for (let i = 0; i < 30; i++) { vnow += 33; visuals.tick(vnow / 1000, false, camera); }
  const jobs = []; const T = (fn, ms) => jobs.push({ due:vnow + ms, fn });
  const mark = x => { battle = { ...battle, ...x }; push(); };
  let launchedAt = null;
  T(() => {
    const now = performance.now();
    mark({ sonicShieldRollAt:now, sonicRollStartedAt:now, phase:'sonic_rival_roll' });
    T(() => mark({ phase:'sonic_shield' }), SONIC_DICE.landedAt[1] * 1000);
    T(() => { mark({ phase:'sonic_armed' });
      T(() => { mark({ sonicDriveRollAt:performance.now(), phase:'sonic_roll' });
        scheduleSonicBarrage({ battle, schedule:T, phase:p => mark({ phase:p }), offset:0,
          launch:() => {
            launchedAt = vnow;
            // ⚡ the client's `resolveSonicSequence`: he arrives at the draw
            spirits[0] = { ...spirits[0], num:LAND };
            mark({ sonicStartedAt:performance.now() });
          },
          close:() => {} });
      }, 0);
    }, SONIC_GATE * 1000);
  }, BATTLE_INTRO * 1000);
  const ronin = () => visuals.pawnFor('cosmic_ronin');
  const samples = [];
  const seqStart = vnow + BATTLE_INTRO * 1000;     // the Rival's ROLL = sequence 0
  for (let t = 0; t < BATTLE_INTRO + BARRAGE_LAUNCH + 3; t += 1 / 30) {
    vnow += 1000 / 30;
    for (let i = 0; i < jobs.length;) { if (jobs[i].due <= vnow) { const [j] = jobs.splice(i, 1); j.fn(); } else i++; }
    visuals.tick(vnow / 1000, false, camera);
    const p = ronin();
    const strikeGroup = scene.getObjectByName('Psycho Bushido');
    const shieldGroup = scene.getObjectByName('Sonic shield');
    let field = 0; scene.traverse(n => { if (n.name === 'Sonic shield field' && n.material && n.parent?.visible) field = n.material.uniforms?.opacity?.value ?? n.material.opacity; });
    samples.push({ seq:(vnow - seqStart) / 1000, pos:p.position.clone(), scale:p.scale.clone(), field,
      strikeKids:strikeGroup?.children.filter(c => c.visible).length ?? -1,
      shield:shieldGroup?.visible ?? false, stepping:visuals.diagnostics?.()?.standeeSteps ?? null });
  }
  return { samples, launchedAt, seqStart, scene, visuals, shield, battle };
}

const at = n => arenaPoint(n, 0);
const near = (a, b, tol = .25) => Math.hypot(a.x - b.x, a.z - b.z) < tol;

// ═════════════════════════════════════════════════════════════════════════════
// 1. A burst: three kept dice (8, 8, 6 + a dropped 6) through a 9 shield.
// ═════════════════════════════════════════════════════════════════════════════
const A = bout({ pool:[8, 8, 6], vals:[8, 7, 5], dropped:[2], droppedPool:[6], sustain:[5, 4], sustainPool:[6, 6] });
{
  const { samples } = A;
  const plan = planStrike(BUSHIDO_STRIKE, { dist:DIST, clashMs:BARRAGE_LAUNCH * 1000, shots:3 });
  const s = sec => samples.reduce((b, x) => (Math.abs(x.seq - sec) < Math.abs(b.seq - sec) ? x : b));
  ok(samples.some(x => x.strikeKids > 0), '⚡ the strike draws on the arena');
  ok(samples.some(x => x.shield), '🛡️ the Rival\'s shield goes up');
  // he stands on his own hex through the whole roll…
  for (const sec of [1, SONIC_GATE + 1, BARRAGE_LAUNCH - .6]) {
    ok(near(s(sec).pos, at(START)), `🧍 at ${sec.toFixed(1)} s he is still on his own hex (the roll, the charge, the rumble)`);
  }
  // …crouched once his dice are down…
  ok(s(BARRAGE_LAUNCH - .5).scale.y < .97, `🫨 crouched and rumbling before the draw (sy ${s(BARRAGE_LAUNCH - .5).scale.y.toFixed(3)})`);
  // …gone in the dash…
  ok(samples.some(x => x.seq > plan.vanish / 1000 && x.seq < plan.arrive / 1000 + .02 && x.scale.y < .05) ||
     samples.filter(x => x.seq > plan.vanish / 1000 - .02 && x.seq < plan.arrive / 1000 + .05).length < 3,
    '⚡ "gone" in the dash — a scale of ~0, never `visible`');
  // …and on the landing hex after it, with no standee step for that move.
  ok(near(s(BARRAGE_LAUNCH + 1).pos, at(LAND)), '🏁 he arrives on the hex before the Rival');
  ok(samples.filter(x => x.seq > BARRAGE_LAUNCH && x.seq < BARRAGE_LAUNCH + .8).every(x => !x.stepping),
    '🚫 no standee step (no Shukuchi blink) for the arrival — the strike draws that move');
  ok(Math.abs(s(BARRAGE_LAUNCH + 2.6).scale.y - 1) < .02, '🧍 and he is himself again once it is over');
  // no ring beams anywhere
  let zig = 0; A.scene.traverse(n => { if (/zigzag|Ring beam/i.test(n.name)) zig++; });
  ok(zig === 0, '🔇 no Sonic ring beams in a Bushido');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. "the stronger the roll - the brighter the shield" — and the amp builds it.
// ═════════════════════════════════════════════════════════════════════════════
{
  const weak = { sustainRolls:[1, 2], sustainPool:[6, 6], shieldValue:3 };
  const strong = { sustainRolls:[6, 5], sustainPool:[6, 6], shieldValue:11 };
  ok(shieldStrength(strong) > shieldStrength(weak), '🛡️ a stronger Sustain roll is a stronger (brighter) shield');
  const W = bout({ pool:[8, 8, 6], vals:[8, 7, 5], sustain:[1, 2], sustainPool:[6, 6] });
  const S = bout({ pool:[8, 8, 6], vals:[8, 7, 5], sustain:[6, 5], sustainPool:[6, 6] });
  // measured once it is built and before he throws anything at it
  const glow = run => run.samples.find(x => x.seq >= SONIC_GATE + 1)?.field ?? 0;
  ok(glow(S) > glow(W), `🛡️ …and it is drawn brighter (${glow(S).toFixed(3)} > ${glow(W).toFixed(3)})`);
  let rings = 0; S.scene.traverse(n => { if (n.geometry?.type === 'TorusGeometry' && n.parent?.name === 'Sonic clash') rings++; });
  ok(rings > 0, '🔊 the Rival\'s Sustain amp throws rings up into the shield (it is BUILT, not switched on)');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. He rumbles harder the more dice he threw.
// ═════════════════════════════════════════════════════════════════════════════
{
  const spread = run => {
    const xs = run.samples.filter(x => x.seq > BARRAGE_LAUNCH - .45 && x.seq < BARRAGE_LAUNCH - .15).map(x => x.pos);
    if (xs.length < 2) return 0;
    const c = xs.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / xs.length);
    return xs.reduce((a, p) => a + p.distanceTo(c), 0) / xs.length;
  };
  const few = bout({ pool:[8, 6], vals:[7, 5], sustain:[5, 4], sustainPool:[6, 6] });
  const many = bout({ pool:[8, 8, 8, 8], vals:[8, 7, 6, 5], dropped:[3, 2], droppedPool:[6, 6], sustain:[5, 4], sustainPool:[6, 6] });
  ok(spread(many) > spread(few), `🫨 six dice (four d8s) shake him more than two (${spread(many).toFixed(4)} > ${spread(few).toFixed(4)})`);
}

console.log(`PASS: bushido arena — ${checks} checks: the shield built by his Rival's amp and as bright as the roll, the charge and the rumble on his own hex, gone in the dash, landing without a blink, no ring beams.`);
