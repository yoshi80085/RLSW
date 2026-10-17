// 🧪 test:idlereel — the idle camera's reel (board/idleReel.js) and its wiring in arenaRenderer.js.
// Alex, 2026-10-17: the idle camera "zooms out and stays zoomed out … zoom in sometimes as well -
// floor level shots, eye level shots, close ups, over head fly by's … as well as having the current
// zoom out level", then "make it so the camera can move randomly through the different view options".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createIdleReel, IDLE_REEL, IDLE_REEL_DIALLED, REEL_KINDS, refocusPose, toSph } from './idleReel.js';
import { IDLE_FLOW } from './idleFlow.js';
import { HEX_BY_NUM } from './hexMap.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const P = num => { const h = HEX_BY_NUM[num]; return { x:(h.px - 3255) / 200, y:0.34, z:(h.py - 2415) / 200 }; };
const footprint = Object.values(HEX_BY_NUM).map(h => ({ x:(h.px - 3255) / 200, z:(h.py - 2415) / 200 }));
const FLOOR = 0.18;
const groundAt = (x, z) => footprint.some(h => Math.hypot(h.x - x, h.z - z) < 1.25) ? FLOOR : -Infinity;
const ids = ['cosmic_ronin', 'Glamarchy', 'intergalactic_0'], nums = [58, 40, 77];
const yaws = { cosmic_ronin:0.4, Glamarchy:2.6, intergalactic_0:-1.9 };
const subjects = (acting = 0) => ({
  center:{ x:1, y:-2.8, z:0 },
  acting:{ id:ids[acting], point:P(nums[acting]) },
  rivals:ids.map((id, i) => ({ id, point:P(nums[i]) })).filter((_, i) => i !== acting),
});
const driving = { driving:true, mode:'auto', shot:'mid' };
const shotsOf = frames => { const out = []; for (const f of frames) { const h = f.state?.history.at(-1); if (h && out.at(-1)?.at !== h.at) out.push(h); } return out; };

function run({ seconds = 600, tuning = {}, seed = 7, s = subjects(), stepMs = 16 } = {}) {
  const reel = createIdleReel({ tuning, seed, footprint });
  const cam = { position:{ x:28, y:18, z:37 }, target:{ x:1, y:-2.8, z:0 } };
  reel.activity(0);
  const frames = [];
  for (let t = 0; t <= seconds * 1000; t += stepMs) {
    const out = reel.update({ shot:driving, camera:cam, now:t, dtMs:stepMs, subjects:s, center:s.center, groundAt, yawOf:id => yaws[id] });
    if (out.shot === 'idle-reel') { cam.position = out.position; cam.target = out.target; }
    frames.push({ t, out, state:reel.state, pos:{ ...cam.position }, tgt:{ ...cam.target } });
  }
  return { reel, frames };
}

// ── 0. ✎ Alex's dial-in (2026-10-17, 18 of 64 levers) IS the default ──
{
  const want = { pace:1.15, openWith:'any', floorS:15, floorH:0.75, eyeS:15, shoulderS:15, shoulderBack:3.85, shoulderSide:1.3,
    shoulderMaxGap:15.5, flybyS:20.5, flybyLen:42, flybyAhead:13, flybyOver:'middle', craneS:15, topSweep:60, spiritS:15, spiritDistance:13.5, spiritSweep:91 };
  ok(IDLE_REEL_DIALLED.length === 18 && IDLE_REEL_DIALLED.every(k => k in want), 'IDLE_REEL_DIALLED names the 18 he moved');
  for (const [k, v] of Object.entries(want)) ok(IDLE_REEL[k] === v, `✎ ${k} = ${JSON.stringify(v)}`);
  ok(IDLE_REEL.order === 'random' && IDLE_REEL.transition === 'glide' && IDLE_REEL.wideEvery === 3 && IDLE_REEL.wideR === 49, 'untouched: random order, glides, back to wide every 3, wide at 49');
  ok(IDLE_REEL.speed === IDLE_FLOW.speed && IDLE_REEL.sway === IDLE_FLOW.sway && IDLE_REEL.idleMs === IDLE_FLOW.idleMs, 'the wide drift keeps idleFlow\'s own speed, sway and 10 s wait');
}

// ── 1. the same priorities and wait as idleFlow ──
{
  const reel = createIdleReel({ footprint }), cam = { position:{ x:28, y:18, z:37 }, target:{ x:1, y:-2.8, z:0 } };
  const tick = (now, o = {}) => reel.update({ shot:driving, camera:cam, now, dtMs:16, subjects:subjects(), groundAt, ...o });
  reel.activity(0);
  ok(tick(9999) === driving, 'no reel before the full idle delay');
  const p = tick(10000);
  ok(p.shot === 'idle-reel', 'the reel takes over at idleMs');
  ok(Math.hypot(p.position.x - 28, p.position.y - 18, p.position.z - 37) < 0.01, 'the first frame starts exactly where the lens was');
  ok(tick(10016, { reduced:true }).shot === 'mid', 'reduced motion: no reel');
  for (const kind of ['battle', 'move', 'event']) { const a = { ...driving, shot:kind }; ok(tick(10032, { shot:a }) === a, `${kind} shots keep priority`); }
  ok(tick(19999).shot === 'mid', 'an action restarts the whole wait');
  const manual = { driving:false, mode:'manual' }; ok(tick(30000, { shot:manual }) === manual, 'manual control keeps priority');
  ok(tick(30016, { shot:null }) === null, 'auto camera off stays off');
}

// ── 2. ten minutes of reel at the dial-in ──
const { frames } = run();
const reelFrames = frames.filter(f => f.out.shot === 'idle-reel');
ok(reelFrames.every(f => [f.pos.x, f.pos.y, f.pos.z, f.tgt.x, f.tgt.y, f.tgt.z].every(Number.isFinite)), 'every pose is finite');
const kinds = shotsOf(reelFrames).map(x => x.kind);
ok(REEL_KINDS.includes(kinds[0]), `opens on any shot (✎ openWith 'any'): ${kinds[0]}`);
for (const k of REEL_KINDS) ok(kinds.includes(k), `ten minutes plays a ${k} shot`);
ok(kinds.every((k, i) => i === 0 || k !== kinds[i - 1]), 'never the same kind twice running');
let gap = 0, maxGap = 0; for (const k of kinds) { gap = k === 'wide' ? 0 : gap + 1; maxGap = Math.max(maxGap, gap); }
ok(maxGap <= IDLE_REEL.wideEvery, `back to the wide at least every ${IDLE_REEL.wideEvery} shots (max run ${maxGap})`);
ok(reelFrames.filter(f => groundAt(f.pos.x, f.pos.z) === FLOOR).every(f => f.pos.y >= FLOOR + IDLE_REEL.clearance - 1e-9), 'never under the floor + clearance');
let maxStep = 0; for (let i = 1; i < reelFrames.length; i++) { const a = reelFrames[i - 1].pos, b = reelFrames[i].pos; maxStep = Math.max(maxStep, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)); }
ok(maxStep < 1.2, `glides never jump (largest 16 ms step ${maxStep.toFixed(3)})`);
{
  const w = run({ tuning:{ openWith:'wide' }, seconds:30 }).frames;
  ok(shotsOf(w)[0]?.kind === 'wide', 'openWith \'wide\' still opens on today\'s drift');
}

// ── 3. each shot frames what it says ──
const mid = kind => reelFrames.filter(f => f.state?.kind === kind && !f.state.gliding && Math.abs(f.state.t / f.state.len - 0.5) < 0.02);
for (const kind of ['floor', 'eye', 'close']) {
  const fs = mid(kind); ok(fs.length > 0, `${kind}: seen at mid-shot`);
  for (const f of fs) {
    const id = f.state.id, p = P(nums[ids.indexOf(id)]), h = f.pos.y - p.y, d = Math.hypot(f.pos.x - p.x, f.pos.z - p.z);
    const T = IDLE_REEL;
    ok(Math.abs(h - T[kind + 'H']) < 0.05 || f.pos.y >= FLOOR + T.clearance - 1e-9, `${kind}: lens height ${h.toFixed(2)}`);
    ok(d <= T[kind + 'From'] + 0.01 && d >= T[kind + 'To'] - 0.01, `${kind}: distance ${d.toFixed(2)} inside ${T[kind + 'To']}–${T[kind + 'From']}`);
    const az = Math.atan2(f.pos.x - p.x, f.pos.z - p.z), off = Math.abs(((az - yaws[id] + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    ok(off <= T.frontArcDeg * Math.PI / 180 + 1e-6, `${kind}: films the printed front (${(off * 180 / Math.PI).toFixed(0)}° off)`);
  }
}
for (const f of mid('close')) ok(toSph(f.pos, f.tgt).r < 4, 'a close-up is close');
for (const f of mid('flyby')) ok(f.pos.y > 8, `fly-by is high (${f.pos.y.toFixed(1)})`);
for (const f of mid('spirit')) ok(Math.abs(toSph(f.pos, f.tgt).r - IDLE_REEL.spiritDistance) < 1e-6, '◎ Spirit view sits at its distance (✎ 13.5)');
for (const f of mid('top')) ok(Math.abs(toSph(f.pos, f.tgt).r - IDLE_REEL.topDistance) < 1e-6 && toSph(f.pos, f.tgt).pol < 0.4, '⌗ Top-down sits at 35, ≈ 20° off vertical');
for (const f of mid('wide')) { const s = toSph(f.pos, f.tgt); ok(s.r >= 49 - 5 * IDLE_FLOW.sway - 1e-6 && s.r <= 49 + 5 * IDLE_FLOW.sway + 1e-6 && s.pol <= Math.PI * 0.43 + 1e-9, `the wide is today's (r ${s.r.toFixed(1)})`); }

// ── 4. options ──
{
  const lone = { center:{ x:1, y:-2.8, z:0 }, acting:{ id:'cosmic_ronin', point:P(58) }, rivals:[] };
  ok(!shotsOf(run({ seconds:300, s:lone }).frames).some(h => h.kind === 'shoulder'), 'no over-the-shoulder with no rival on the board');
  const only = run({ seconds:120, tuning:{ only:'close' } }).frames.map(f => f.state?.kind).filter(Boolean);
  ok(only.filter(x => x !== 'wide').every(x => x === 'close'), '`only` repeats one kind (the preview\'s 🔂)');
  const off = run({ seconds:400, tuning:Object.fromEntries(REEL_KINDS.filter(k => k !== 'wide').map(k => [k + 'W', 0])) }).frames.map(f => f.state?.kind).filter(Boolean);
  ok(off.length && off.every(x => x === 'wide'), 'every other weight at 0 = the old idle camera, nothing else');
  ok(run({ seconds:120, tuning:{ transition:'fade' } }).frames.some(f => f.out.fade > 0.95), 'fade dips to black between shots');
  ok(run({ seconds:120 }).frames.every(f => !f.out.fade), 'the default glide never fades');
  const a = run({ seconds:90, seed:3 }).frames.at(-1).pos, b = run({ seconds:90, seed:3 }).frames.at(-1).pos;
  ok(a.x === b.x && a.z === b.z, 'the same seed plays the same reel');
  const cyc = shotsOf(run({ seconds:500, tuning:{ order:'cycle', openWith:'wide' } }).frames).map(h => h.kind);
  ok(cyc.slice(0, 9).join() === REEL_KINDS.join(), `🔁 in order plays the list in order (${cyc.slice(0, 9).join(' → ')})`);
}

// ── 5. a requested shot starts at once, even mid-glide ──
{
  const reel = createIdleReel({ footprint, seed:5, tuning:{ openWith:'wide' } }), cam = { position:{ x:28, y:18, z:37 }, target:{ x:1, y:-2.8, z:0 } };
  reel.activity(0); let t = 10000, last = null, worst = 0;
  const go = () => { const o = reel.update({ shot:driving, camera:cam, now:t, dtMs:16, subjects:subjects(), groundAt, yawOf:id => yaws[id] }); t += 16;
    if (last) worst = Math.max(worst, Math.hypot(o.position.x - last.x, o.position.y - last.y, o.position.z - last.z));
    last = { ...o.position }; cam.position = o.position; cam.target = o.target; return o; };
  go(); go(); ok(reel.state.gliding && reel.state.kind === 'wide', 'going idle glides into the wide');
  reel.next('close'); go(); ok(reel.state.kind === 'close', 'next(\'close\') mid-glide starts the close-up on the next frame');
  for (let i = 0; i < 400; i++) go();
  ok(worst < 1.2, `no jump when a shot is asked for mid-glide (largest step ${worst.toFixed(3)})`);
}

// ── 6. the break lands inside OrbitControls' limits ──
{
  const floorPose = { position:{ x:5, y:0.6, z:5 }, target:{ x:0, y:1.6, z:0 } };
  const r = refocusPose(floorPose, { x:1, y:0.79, z:1 }, 19), s = toSph(r.position, r.target);
  ok(s.pol <= Math.PI * 0.43 + 1e-9, `a floor shot's break comes back to ≤ .43π (was ${(toSph(floorPose.position, floorPose.target).pol / Math.PI).toFixed(2)}π)`);
  ok(Math.abs(s.r - 19) < 1e-9, 'and at the director\'s idle distance');
}

// ── 7. the renderer wiring (arenaRenderer.js) ──
{
  const r = readFileSync(new URL('./arenaRenderer.js', import.meta.url), 'utf8');
  ok(/import \{ createIdleReel \} from '\.\/idleReel\.js';/.test(r) && !/createIdleFlow/.test(r), 'the renderer runs the reel, not idleFlow');
  ok(/const idleReel=createIdleReel\(\{seed:[^}]*footprint:/.test(r), 'seeded per mount, with the board\'s footprint');
  ok(/idleReel\.update\(\{shot:cameraShot,[\s\S]{0,200}?subjects:cameraSubjects,[\s\S]{0,200}?groundAt,yawOf:/.test(r), 'update gets the subjects, the floor under the lens and each print\'s yaw');
  ok(/userData\.targetFacing/.test(r.slice(r.indexOf('idleReel.update('), r.indexOf('idleReel.update(') + 600)), 'yawOf is the pawn\'s own facing (standeeYaw)');
  ok(/const groundAt=/.test(r) && /intersectObject\(model,true\)/.test(r), 'groundAt rays down into the arena model');
  ok(/reelFade\.style\.opacity=/.test(r), 'a fade between shots darkens a host overlay');
  ok(/pol1:Math\.min\(controls\.maxPolarAngle,Math\.max\(controls\.minPolarAngle,/.test(r), 'the break (startRefocus) eases the tilt back inside the controls\' range');
  ok((r.match(/idleReel\.activity\(/g) ?? []).length >= 5, 'every place that woke idleFlow wakes the reel');
}
console.log(`PASS idleReelCheck: ${n} assertions · ${kinds.length} shots in 10 min: ${kinds.join(' → ')}`);
