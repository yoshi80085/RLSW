// 🤕 knockdownHelpersCheck — the knockdown's picture (board/knockdownHelpers.js).
// Alex, 2026-10-07: *"The standee 'falls down' on the spot - a few fans come out
// to the stage and 'help him' up … He gets back up where he got knocked down."*
// Pins the beats (pure), the three.js half (three helpers leave his stand, gather
// round his hex, go home, clean up) and the arena's wiring (source).
// Run: node --import ./src/engine/testAssetStub.mjs src/board/knockdownHelpersCheck.mjs
import * as THREE from 'three';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
globalThis.document ??= {
  createElementNS:() => ({ addEventListener() {}, removeEventListener() {}, set src(v) { void v; } }),
  createElement:() => ({ getContext:() => null, style:{} }),
};
const { KO_HELP, koPlan, koDown, helperPose, createKnockdownHelpers } = await import('./knockdownHelpers.js');
const { grandstandPlacement } = await import('./cosmicFans.js');
const { HEX_BY_NUM } = await import('./hexMap.js');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const P = koPlan();

// ── the beats ──
ok(P.arrive < P.riseAt && P.riseAt < P.upAt && P.upAt < P.homeAt, 'run out → lift → up → home, in that order');
ok(koDown(0) === 0 && koDown(KO_HELP.fallMs / 2) > 0 && koDown(KO_HELP.fallMs / 2) < 1, 'he topples over the first beat');
ok(koDown(P.arrive) === 1 && koDown(P.riseAt - 1) === 1, '…and lies flat until his fans have him');
ok(koDown((P.riseAt + P.upAt) / 2) > 0 && koDown((P.riseAt + P.upAt) / 2) < 1, 'they lift him');
ok(koDown(P.upAt) === 0 && koDown(P.homeAt) === 0, '…and he is standing again while they head home');
for (let i = 0; i < KO_HELP.helpers; i++) {
  ok(!helperPose(i, 0).visible, `helper ${i + 1} is not on stage before he falls`);
  const there = helperPose(i, P.arrive + 10);
  ok(there.visible && there.t === 1 && there.crouch === 1, `helper ${i + 1} is beside him, crouched, by the time all have arrived`);
  ok(helperPose(i, P.homeAt + 50).visible === false, `helper ${i + 1} is back in the stand at the end`);
  const run = helperPose(i, KO_HELP.fallMs + KO_HELP.leaveMs + i * KO_HELP.stagger + KO_HELP.runMs / 2);
  ok(run.t > 0 && run.t < 1 && run.hop >= 0, `helper ${i + 1} runs out`);
  const r = helperPose(i, P.arrive - 200, { reduced: true });
  ok(r.visible && r.t === 1 && r.hop === 0, `reduced motion: helper ${i + 1} is simply beside him, no run`);
}

// ── the three.js half ──
const point = (num, y = 0) => { const h = HEX_BY_NUM[num]; return h ? new THREE.Vector3((h.px - 3255) / 200, y, (h.py - 2415) / 200) : null; };
const root = new THREE.Group();
const H = createKnockdownHelpers(root, { pointFor: point });
const num = 56, start = 1000;
H.start('vera', { num, corner: 'purple', color: '#ff4a6a', now: start });
ok(H.live === 1 && H.busy, 'a knockdown starts one helper run');
const fans = () => H.group.children.filter(o => o.name.startsWith('Helper fan'));
ok(fans().length === KO_HELP.helpers, `${KO_HELP.helpers} of his fans`);
H.tick(start + 1);
ok(fans().every(f => !f.visible), '…none on stage yet');
ok(H.down('vera', start + KO_HELP.fallMs + 5) === 1, 'down() reports him flat');
ok(H.down('nobody', start) === null, 'down() is null for a Spirit nobody is helping');
H.tick(start + KO_HELP.fallMs + KO_HELP.leaveMs + 30);
const stand = grandstandPlacement('purple').position;
const at = point(num, .2);
const d = f => Math.hypot(f.position.x - at.x, f.position.z - at.z);
ok(fans()[0].visible && Math.hypot(fans()[0].position.x - stand.x, fans()[0].position.z - stand.z) < Math.hypot(at.x - stand.x, at.z - stand.z),
  'the first one leaves from the front of HIS stand');
H.tick(start + P.arrive + 50);
ok(fans().every(f => f.visible && d(f) < KO_HELP.spread + .05), 'all of them gather round his hex');
ok(fans().every(f => f.rotation.x > 0), '…bent over him');
H.tick(start + P.total + 400);
ok(H.live === 0 && fans().length === 0, 'and when they are home the run is cleaned up');
H.start('vera', { num, corner: 'purple', now: 5000 }); H.start('vera', { num, corner: 'purple', now: 5100 });
ok(H.live === 1 && fans().length === KO_HELP.helpers, 'a second knockdown restarts the run instead of stacking two');
H.dispose();
ok(!root.children.includes(H.group), 'dispose removes the group');

// ── the wiring ──
const arena = readFileSync(new URL('./arenaVisuals.js', import.meta.url), 'utf8');
ok(/koHelpers\.start\(spirit\.id/.test(arena) && /knockdownCount\?\?0\)>pawn\.userData\.knockdownCount/.test(arena), 'the arena starts it when a Spirit\'s knockdown count moves');
ok(/!spirit\.waiting&&!spirit\.knockedOut/.test(arena), '…only for a knockdown on a hex (not a ring-out to the pad, not a knockout)');
ok(/const helped=koHelpers\.down\(pawnId,openNow\);/.test(arena) && /knocked=helped\?\?/.test(arena), 'his standee leans as far over as the helpers say');
ok(/\+koHelpers\.live,/.test(arena), 'the renderer keeps drawing while they run');
const frame = readFileSync(new URL('./arenaFrame.js', import.meta.url), 'utf8');
ok(/knockdownCount:s\.knockdownCount\?\?0/.test(frame), 'the frame carries the knockdown count');
const standee = readFileSync(new URL('./standee.js', import.meta.url), 'utf8');
ok(/typeof knockedOut === 'number'/.test(standee), 'the standee can be part-way over');

console.log(`✅ knockdownHelpersCheck: ${n} checks passed`);
