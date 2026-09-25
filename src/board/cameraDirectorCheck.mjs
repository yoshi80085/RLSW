// 🎥 cameraDirectorCheck — `test:cameradirector`. The auto camera: follows the
// action, never sits still, hands over to the player and comes back 10 s after
// the last input of any kind (6.5 s until 2026-09-25) (Alex, 2026-09-17; dial-in off `.scratch/auto-camera-preview.html`,
// all 31 levers untouched).
//
// Plain node on a SIMULATED clock — every assertion names an exact millisecond,
// so nothing here can be flaky on a slow VM.
// §1 is the preview's own director check, re-pointed at the shipped module; it was
// mutation-tested 10/10 there (held shot re-arming its hold, resume while held, no
// clamp, side re-picked per frame, full grip on resume, no drift, resume from the
// director's pose, per-frame lerp, battle priority, a click stealing the camera).
import { readFileSync, existsSync } from 'node:fs';
import { CAMERA_DIRECTOR as D, CAMERA_SUBJECTS, createCameraDirector, createCameraSubjects } from './cameraDirector.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else fail++; if (!cond || process.env.VERBOSE) console.log(`  ${cond ? '✓' : '✗'} ${name}${extra !== '' ? ' — ' + extra : ''}`); };
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
console.log('🎥 cameraDirectorCheck — the camera follows the action, and lets go when you grab it\n');

console.log('§0 the numbers are the dial-in');
ok('CAMERA_DIRECTOR is frozen', Object.isFrozen(D));
{
  const want = { resumeAfterMs:10000, resumeBlendMs:3000, viewButtons:'pause', reducedMotion:'still', zoomMemory:'director',
    followRate:3.2, swingRate:0.5, afterHoldMs:2300, lookHeight:0.45, driftDegPerSec:0.5, actionDrift:0.1, breathe:0, breathPeriodS:7.5,
    idleShots:'cycle', shotHoldS:20, idleDistance:19, idleTilt:44, wideDistance:36, wideTilt:38, heroDistance:15, heroTilt:70,
    moveDistance:27, moveTilt:50, moveLead:0.4, chase:0.25,
    moveAngle:'keep', kbPush:0.11, kbMs:3600, kbPanDeg:9, moveFollowRate:5.2,
    wideAfterS:60, longIdle:'hold', rivalMaxGap:9,
    battlePad:10, battleTilt:56, battleSkew:20, reactToEvents:'on', eventDistance:20,
    minDistance:12, maxDistance:110, minPolar:0.08, maxPolar:Math.PI * 0.43 };
  ok('CAMERA_DIRECTOR matches the 2026-09-18 dial-in exactly (calm camera; breathing off)', JSON.stringify(D) === JSON.stringify(want));
  // 📌 badge 'on' and menuSwitch 'yes' were levers too; they live in BoardViewport and the client (§4).
  const renderer = read('./arenaRenderer.js');
  const limits = /controls\.minDistance=(\d+);controls\.maxDistance=(\d+);controls\.minPolarAngle=([\d.]+);controls\.maxPolarAngle=Math\.PI\*([\d.]+)/.exec(renderer);
  ok('the director\'s limits ARE the OrbitControls limits', !!limits && +limits[1] === D.minDistance && +limits[2] === D.maxDistance && +limits[3] === D.minPolar && Math.abs(Math.PI * +limits[4] - D.maxPolar) < 1e-9);
  // The preview is a working pile (.scratch is gitignored) — compare when it is there.
  const preview = new URL('../../.scratch/camera-move-tiles-preview.html', import.meta.url);
  if (existsSync(preview)) {
    const html = readFileSync(preview, 'utf8'), mod = read('./cameraDirector.js');
    const strip = t => t.replace(/export /g, '').replace(/Object\.freeze\(/g, '').replace(/\}\);/g, '};').replace(/\s+/g, ' ');
    const a = html.slice(html.indexOf('const TAU = Math.PI * 2;'), html.indexOf('// ════════════════════════════ end of the port'));
    const b = mod.slice(mod.indexOf('const TAU = Math.PI * 2;'), mod.indexOf('// ════════════════════════════════════════════════════════════════════════════\n// SUBJECTS'));
    ok('the shipped director is the preview\'s director, line for line', strip(a).trim() === strip(b).trim());
  } else console.log('  (preview page not present — parity skipped)');
}

const P = (x, z, y = .34) => ({ x, y, z });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function world() {
  const cam = { position:{ x:28, y:18, z:37 }, target:{ x:1, y:-2.8, z:0 } };
  const s = { center:{ x:1, y:-2.8, z:0 }, acting:{ id:'ronin', point:P(-6, -4) },
    rivals:[{ id:'monster', point:P(5, 6) }, { id:'io', point:P(-3, -1) }], moves:[], battle:null, events:[] };
  return { cam, s };
}
function rig(tuning = {}) {
  const w = world(), dir = createCameraDirector(tuning);
  let now = 1000, out = null;
  const step = (ms = 1000 / 60) => {
    now += ms;
    out = dir.update({ dtMs:ms, now, subjects:w.s, camera:w.cam });
    if (out.driving) { w.cam.position = { ...out.position }; w.cam.target = { ...out.target }; }
    return out;
  };
  const run = (ms, each) => { const n = Math.round(ms / (1000 / 60)); for (let i = 0; i < n; i++) { step(); each?.(); } return out; };
  return { w, dir, step, run, get now() { return now; }, get out() { return out; } };
}

console.log('§1 the director (the preview\'s own checks, against the shipped module)');
// 1 · never sits still while idle, at any point in a long idle stretch
{
  const r = rig(); r.run(3000);
  // ⚠️ Judged over a SECOND, not a frame. With breathing off (Alex, 2026-09-18) the
  // drift alone moves the camera ~0.17 units a second — smooth, but a single frame of
  // that is 3 µm, so a per-frame test would call a drifting camera "still".
  let worst = Infinity, mark = { ...r.w.cam.position };
  for (let s2 = 0; s2 < 40; s2++) { r.run(1000); worst = Math.min(worst, dist(mark, r.w.cam.position)); mark = { ...r.w.cam.position }; }
  ok('idle 40 s: never still — every second moves the camera', worst > 0.01, `quietest second ${worst.toFixed(4)}`);
  const nb = rig({ breathe:0, idleShots:'orbit' }); nb.run(22000);   // mid-shot: the drift reverses at each shot change (by design)
  const az = c => Math.atan2(c.position.x - c.target.x, c.position.z - c.target.z);
  const az0 = az(nb.w.cam); nb.run(2000); const turned = Math.abs(az(nb.w.cam) - az0) * 180 / Math.PI;
  ok('drift alone (no breathing) still turns the camera', turned > D.driftDegPerSec * 2 * .5, `${turned.toFixed(1)}° in 2 s`);
  // 15 s: inside one idle shot (they last shotHoldS) and long past the swing's lag.
  const r2 = rig({ driftDegPerSec:0, breathe:0 }); r2.run(15000);
  const a = { ...r2.w.cam.position }; r2.run(1000);
  ok('control: with drift and breathing at 0 it DOES settle (the levers are what move it)', dist(a, r2.w.cam.position) < 0.01, dist(a, r2.w.cam.position).toFixed(4));
}
// 2 · idle program cycles on shotHoldS
{
  // ⚠️ wideAfterS is 60 s and three idle shots take exactly that, so the cycle is
  // exercised with the quiet clock pushed out — §4b is where the wide shot is tested.
  const r = rig({ wideAfterS:600 }); const seen = [];
  r.run(D.shotHoldS * 3000 + 500, () => { if (seen[seen.length - 1] !== r.out.shot) seen.push(r.out.shot); });
  ok('idle cycle order close → surroundings → hero → close (no wide in the cycle)', seen.join(',') === 'mid,rival,hero,mid', seen.join(','));
  const o = rig({ idleShots:'orbit' }); const kinds = new Set(); o.run((D.wideAfterS - 2) * 1000, () => kinds.add(o.out.shot));
  ok('"Just circle" never leaves the close shot', [...kinds].join() === 'mid', [...kinds].join());
}
// 3 · bounds: never outside the player's own zoom/tilt limits, whatever the levers say
{
  const r = rig({ idleDistance:5, heroDistance:1, wideDistance:400, heroTilt:89, idleTilt:0, breathe:.2 });
  let bad = 0;
  r.run(40000, () => {
    const c = r.w.cam, dx = c.position.x - c.target.x, dy = c.position.y - c.target.y, dz = c.position.z - c.target.z, rr = Math.hypot(dx, dy, dz), pol = Math.acos(dy / rr);
    if (rr < D.minDistance - .01 || rr > D.maxDistance + .01 || pol < D.minPolar - .01 || pol > D.maxPolar + .01) bad++;
  });
  ok('silly levers still stay inside OrbitControls limits', bad === 0, `${bad} bad frames`);
}
// 4 · a move is a KEN BURNS push-in: the angle holds, the distance falls, a slow pan
{
  const az = c => Math.atan2(c.position.x - c.target.x, c.position.z - c.target.z);
  const r = rig(); r.run(3000);
  const az0 = az(r.w.cam);
  const from = P(-6, -4), to = P(2, -4);
  r.w.s.moves = [{ key:'m1', id:'ronin', from, to, point:{ ...from } }];
  const rs = [], turns = [];
  r.run(D.kbMs + 600, () => {
    const m = r.w.s.moves[0]; m.point.x = Math.min(to.x, m.point.x + 8 / (2.4 * 60));
    const c = r.w.cam; rs.push(Math.hypot(c.position.x - c.target.x, c.position.y - c.target.y, c.position.z - c.target.z));
    turns.push(Math.abs(((az(c) - az0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI);
  });
  ok('move: shot kind is move', r.out.shot === 'move');
  ok('move: aim is on the mover (within lead + lag)', Math.hypot(r.w.cam.target.x - to.x, r.w.cam.target.z - to.z) < D.moveLead + 1.5, Math.hypot(r.w.cam.target.x - to.x, r.w.cam.target.z - to.z).toFixed(2));
  ok('Ken Burns: the camera never swings — at most the pan plus a little breathing drift', Math.max(...turns) < D.kbPanDeg + 3, Math.max(...turns).toFixed(1) + '°');
  ok('Ken Burns: it does pan (not a dead-still frame)', Math.max(...turns) > D.kbPanDeg * 0.5, Math.max(...turns).toFixed(1) + '°');
  const startR = rs[Math.round(rs.length * 0.15)], endR = rs[rs.length - 1];
  ok('Ken Burns: the distance falls by about kbPush', endR < startR && (startR - endR) / startR > D.kbPush * 0.5 && (startR - endR) / startR < D.kbPush * 1.6, ((startR - endR) / startR).toFixed(3));
  ok('Ken Burns: it starts near moveDistance, not at the idle distance', Math.abs(rs[rs.length - 1] / (1 - D.kbPush) - D.moveDistance) < D.moveDistance * 0.3, rs[rs.length - 1].toFixed(1));
  // A second step inside the same move (same key) keeps pushing, never restarts.
  r.w.s.moves[0].to = P(4, -4); r.run(400);
  const c = r.w.cam; ok('a further step in the same move does not restart the push', Math.hypot(c.position.x - c.target.x, c.position.y - c.target.y, c.position.z - c.target.z) < startR, '');
  const side = rig({ moveAngle:'side' }); side.run(3000); const s0 = az(side.w.cam);
  side.w.s.moves = [{ key:'m2', id:'ronin', from:P(-6, -4), to:P(2, -4), point:P(-6, -4) }]; side.run(2500);
  ok("control: v1's 'side' mode DOES swing (so the check above can fail)", Math.abs(((az(side.w.cam) - s0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI > 20);
}
// 4b · the wide shot is earned by quiet
{
  const r = rig(); const at = [];
  r.run((D.wideAfterS + 12) * 1000, () => { if (r.out.shot === 'wide') at.push(r.now); });
  ok('no wide shot before wideAfterS of quiet', at.length > 0 && at[0] - 1000 >= D.wideAfterS * 1000 - 50, at.length ? ((at[0] - 1000) / 1000).toFixed(1) + ' s' : 'never');
  ok("'hold': once wide, it stays wide while nothing happens", r.out.shot === 'wide');
  r.w.s.events = [{ key:'e1', point:P(3, 3) }]; r.run(100); r.w.s.events = []; r.run(D.afterHoldMs + 300);
  ok('an effect ends the quiet: back on the Spirit, not wide', r.out.shot === 'mid', r.out.shot);
  r.run((D.wideAfterS - 3) * 1000); ok('…and the quiet clock started over', r.out.shot !== 'wide', r.out.shot);
  const t = rig(); t.run((D.wideAfterS + 2) * 1000); t.w.s.acting = { id:'monster', point:P(5, 6) }; t.run(300);
  ok('a new turn leaves the wide shot', t.out.shot === 'mid', t.out.shot);
  const g = rig(); g.run((D.wideAfterS + 2) * 1000); g.dir.userNudge(g.now); g.run(D.resumeAfterMs + 200);
  ok('taking the camera resets the quiet clock too', g.out.shot !== 'wide', g.out.shot);
  const mix = rig({ longIdle:'mix' }); const kinds = new Set(); mix.run((D.wideAfterS + D.shotHoldS * 4) * 1000, () => kinds.add(mix.out.shot));
  ok("'mix': wide joins the cycle instead of holding", kinds.has('wide') && kinds.has('hero'), [...kinds].join());
  // surroundings: a far rival is leaned toward, not framed across the board
  const far = rig(); far.w.s.rivals = [{ id:'monster', point:P(12, 10) }];
  far.run(D.shotHoldS * 1000 + 3000);
  ok('surroundings with a far rival stays near the acting Spirit', far.out.shot === 'rival' && Math.hypot(far.w.cam.target.x + 6, far.w.cam.target.z + 4) < 6.5, Math.hypot(far.w.cam.target.x + 6, far.w.cam.target.z + 4).toFixed(2));
}
// 5 · battle framed side-on, result held afterHoldMs, then idle
{
  const r = rig(); r.run(2000);
  const a = P(-6, -4), b = P(4, -4);
  r.w.s.battle = { key:'b1', attacker:a, defender:b };
  r.run(2500);
  const c = r.w.cam; const mid = { x:(a.x + b.x) / 2, z:(a.z + b.z) / 2 };
  ok('battle: aim near the midpoint', Math.hypot(c.target.x - mid.x, c.target.z - mid.z) < 1, Math.hypot(c.target.x - mid.x, c.target.z - mid.z).toFixed(2));
  const view = { x:c.position.x - c.target.x, z:c.position.z - c.target.z }, line = { x:b.x - a.x, z:b.z - a.z };
  const angle = Math.acos(Math.abs(view.x * line.x + view.z * line.z) / Math.hypot(view.x, view.z) / Math.hypot(line.x, line.z)) * 180 / Math.PI;
  ok('battle: looking across the fight line, not down it', angle > 45, `${angle.toFixed(0)}° from the line`);
  ok('battle: both fighters in frame (fov 43, pad)', Math.hypot(view.x, view.z, c.position.y - c.target.y) > 10 * .5 / Math.tan(21.5 * Math.PI / 180), '');
  r.w.s.battle = null;
  r.run(D.afterHoldMs - 150); ok('battle over: still held just before afterHoldMs', r.out.shot === 'battle', r.out.shot);
  r.run(300); ok('battle over: idle again just after afterHoldMs', r.out.shot === 'mid', r.out.shot);
  // regression: the held shot must not re-arm its own hold
  const q = rig(); q.run(500); q.w.s.battle = { key:'b2', attacker:a, defender:b }; q.run(500); q.w.s.battle = null;
  q.run(D.afterHoldMs * 3); ok('regression: a held shot does not hold forever', q.out.shot !== 'battle', q.out.shot);
}
// 6 · priority: battle over move over effect
{
  const r = rig();
  r.w.s.events = [{ key:'e1', point:P(3, 3) }]; r.step(); ok('effect alone → event shot', r.out.shot === 'event');
  r.w.s.moves = [{ key:'m', id:'ronin', from:P(0, 0), to:P(2, 0), point:P(1, 0) }]; r.step(); ok('move beats effect', r.out.shot === 'move');
  r.w.s.battle = { key:'b', attacker:P(0, 0), defender:P(3, 0) }; r.step(); ok('battle beats move', r.out.shot === 'battle');
  const n = rig({ reactToEvents:'off' }); n.w.s.events = [{ key:'e', point:P(3, 3) }]; n.step(); ok('reactToEvents off ignores effects', n.out.shot === 'mid', n.out.shot);
}
// 7 · taking over and giving back
{
  const r = rig(); r.run(3000);
  r.dir.userStart(r.now); r.step(); ok('userStart → manual, not driving', r.out.mode === 'manual' && !r.out.driving);
  r.run(20000); ok('held button: never resumes, however long', r.out.mode === 'manual');
  // the player drags the camera somewhere odd
  r.w.cam.position = { x:-40, y:30, z:5 }; r.w.cam.target = { x:-2, y:0, z:3 };
  r.dir.userEnd(r.now); const released = r.now;
  r.run(D.resumeAfterMs - 100); ok('released: still manual at resumeAfterMs − 100 ms', r.out.mode === 'manual', String(Math.round(r.out.resumeInMs)));
  ok('released: countdown is ~100 ms', Math.abs(r.out.resumeInMs - 100) < 20, String(Math.round(r.out.resumeInMs)));
  const before = { ...r.w.cam.position };
  r.run(120); ok('resumes at resumeAfterMs', r.out.mode === 'resume', `${r.now - released} ms`);
  ok('resume: first frames lean, no teleport', dist(before, r.w.cam.position) < 0.3, dist(before, r.w.cam.position).toFixed(3));
  r.run(D.resumeBlendMs); ok('resume → auto after resumeBlendMs', r.out.mode === 'auto');
  r.run(4000); ok('…and it has actually gone back to work', Math.hypot(r.w.cam.target.x + 6, r.w.cam.target.z + 4) < 1.5, Math.hypot(r.w.cam.target.x + 6, r.w.cam.target.z + 4).toFixed(2));
  // input during the countdown restarts it
  const q = rig(); q.run(500); q.dir.userNudge(q.now); q.run(4000); q.dir.userNudge(q.now); q.run(4000);
  ok('a second nudge restarts the wait', q.out.mode === 'manual');
  q.run(6200); ok('…and it resumes 10 s after the LAST input', q.out.mode !== 'manual');
  // userEnd without userStart (a click) does nothing
  const k = rig(); k.run(500); k.dir.userEnd(k.now); k.step(); ok('userEnd with no drag is a no-op', k.out.mode === 'auto');
}
// 8 · zoom memory
{
  const r = rig({ zoomMemory:'keep' }); r.run(5000);
  r.dir.userStart(r.now);
  const t = r.w.cam.target, p = r.w.cam.position, rr = dist(p, t);
  r.w.cam.position = { x:t.x + (p.x - t.x) * .6, y:t.y + (p.y - t.y) * .6, z:t.z + (p.z - t.z) * .6 };
  r.dir.userEnd(r.now); r.run(D.resumeAfterMs + D.resumeBlendMs + 6000);
  // ⚠️ Judged against idleDistance, not a second sample: breathing (±breathe) makes
  // any two instants differ by far more than a zoom test can tolerate.
  const ratio = dist(r.w.cam.position, r.w.cam.target) / D.idleDistance;
  ok('"keeps your zoom": zoomed in 40 %, stays roughly zoomed in', ratio < .8, ratio.toFixed(2));
  const d = rig(); d.run(5000); d.dir.userStart(d.now);
  const t2 = d.w.cam.target, p2 = d.w.cam.position, r2 = dist(p2, t2);
  d.w.cam.position = { x:t2.x + (p2.x - t2.x) * .6, y:t2.y + (p2.y - t2.y) * .6, z:t2.z + (p2.z - t2.z) * .6 };
  d.dir.userEnd(d.now); d.run(D.resumeAfterMs + D.resumeBlendMs + 8000);
  const ratio2 = dist(d.w.cam.position, d.w.cam.target) / D.idleDistance;
  ok('"its own zoom": returns to the director distance', ratio2 > 1 - D.breathe - .08, ratio2.toFixed(2));
}
// 9 · reduced motion
{
  const w = world(), dir = createCameraDirector();
  ok('reduced "still": not driving', dir.update({ dtMs:16, now:0, subjects:w.s, camera:w.cam, reduced:true }).driving === false);
  const c = rig({ reducedMotion:'cuts' }); const w2 = c.w; const d2 = c.dir; let now = 0; const upd = () => d2.update({ dtMs:16, now:(now += 16), subjects:w2.s, camera:w2.cam, reduced:true });
  let o = upd(); w2.cam.position = o.position; w2.cam.target = o.target;
  const p0 = { ...o.position }; for (let i = 0; i < 300; i++) { o = upd(); }
  ok('reduced "cuts": no drift while idle', dist(p0, o.position) < 1e-6, dist(p0, o.position).toExponential(1));
  w2.s.battle = { key:'bx', attacker:P(0, 0), defender:P(4, 0) }; o = upd();
  ok('reduced "cuts": an action is a jump, not a swing', Math.hypot(o.target.x - 2, o.target.z) < 1e-6, Math.hypot(o.target.x - 2, o.target.z).toFixed(3));
}
// 10 · frame-rate independence (30 fps vs 144 fps end at the same place)
{
  const at = fps => { const w = world(), dir = createCameraDirector(); let now = 0; const ms = 1000 / fps;
    for (let t = 0; t < 700; t += ms) { now += ms; const o = dir.update({ dtMs:ms, now, subjects:w.s, camera:w.cam }); if (o.driving) { w.cam.position = o.position; w.cam.target = o.target; } }
    return w.cam.position; };
  const d = dist(at(30), at(144));
  ok('30 fps and 144 fps agree mid-swing (0.7 s in)', d < .6, d.toFixed(3));
}

console.log('§2 subjects — what just happened, read from arenaFrame');
{
  const pointFor = n => n == null ? null : { x:n, y:.34, z:-n };
  const pointXY = (x, y) => ({ x:x / 10, y:.2, z:y / 10 });
  const sub = createCameraSubjects({ pointFor, pointXY });
  const base = { actingId:'ronin', turn:3, spirits:[{ id:'ronin', num:10 }, { id:'monster', num:20 }, { id:'io', num:30, knockedOut:true }] };
  let s = sub.read({ ...base, laser:[[1, 2, 3]] }, 0);
  ok('acting Spirit and live rivals (knocked out left out)', s.acting?.id === 'ronin' && s.rivals.map(r => r.id).join() === 'monster');
  ok('first frame: a laser already on the board is NOT news', s.events.length === 0);
  s = sub.read({ ...base, laser:[[1, 2, 3]] }, 16);
  ok('a standing laser stays not-news', s.events.length === 0);
  s = sub.read({ ...base, laser:[[1, 2, 3], [7, 8]] }, 32);
  ok('a NEW laser is an event, at its middle', s.events.length === 1 && s.events[0].point.x === 7.5, JSON.stringify(s.events));
  s = sub.read({ ...base, laser:[[1, 2, 3], [7, 8]] }, 32 + CAMERA_SUBJECTS.eventHoldMs + 1);
  ok('…and expires after eventHoldMs', s.events.length === 0);
  const moved = { ...base, spirits:[{ id:'ronin', num:11 }, { id:'monster', num:20 }] };
  s = sub.read(moved, 2000);
  ok('a hex change is a move from → to', s.moves.length === 1 && s.moves[0].from.x === 10 && s.moves[0].to.x === 11);
  const key = s.moves[0].key;
  s = sub.read({ ...base, spirits:[{ id:'ronin', num:12 }, { id:'monster', num:20 }] }, 2300);
  ok('a second step inside the window is the SAME move (the camera keeps its side)', s.moves.length === 1 && s.moves[0].key === key && s.moves[0].from.x === 10 && s.moves[0].to.x === 12);
  s = sub.read({ ...base, spirits:[{ id:'ronin', num:12 }, { id:'monster', num:20 }] }, 2300 + CAMERA_SUBJECTS.moveHoldMs + 1);
  ok('the move ends moveHoldMs after the last step', s.moves.length === 0);
  s = sub.read({ ...base, spirits:[{ id:'ronin', num:12 }, { id:'monster', num:20 }], battle:{ attackerId:'ronin', defenderId:'monster', round:1 } }, 4000);
  ok('a battle carries both fighters', s.battle && s.battle.attacker.x === 12 && s.battle.defender.x === 20 && s.battle.key === '3:ronin:monster:1');
  s = sub.read({ ...base, spirits:[{ id:'ronin', num:12 }, { id:'monster', num:20 }], battle:{ attackerId:'ronin', defenderId:'ghost' } }, 4016);
  ok('a battle with a fighter out of the frame (smoke) is no battle', s.battle === null);
  s = sub.read({ ...base, spirits:[{ id:'ronin', num:12 }, { id:'monster', num:20 }], slides:[{ id:'monster', cx:50, cy:60 }], flashes:[{ key:'f1', spiritId:'ronin' }], vortex:{ hex:5 }, tentacle:{ key:'t', pts:[{ x:0, y:0 }, { x:30, y:40 }] }, pyro:{ hexes:[2, 4], phase:'arming' } }, 5000);
  ok('slide, flash, vortex, tentacle and pyro each arrive as an event', s.events.length === 5, s.events.map(e => e.key).join());
  ok('the slide is placed by its SVG coordinates', s.events.find(e => e.key.startsWith('slide')).point.x === 5);
  s = sub.read({ ...base, spirits:[{ id:'ronin', num:12 }, { id:'monster', num:20 }], pyro:{ hexes:[2, 4], phase:'burst' } }, 5100);
  ok('pyro going from arming to burst is news again', s.events.some(e => e.key === 'pyro:2-4:burst'));
  const dead = sub.read({ actingId:'ronin', spirits:[{ id:'ronin', num:12, knockedOut:true }, { id:'monster', num:20 }] }, 6000);
  ok('a knocked-out acting Spirit → no acting subject', dead.acting === null);
  const dir = createCameraDirector(); let crash = null;
  try { for (let i = 0; i < 600; i++) dir.update({ dtMs:16, now:i * 16, subjects:dead, camera:{ position:{ x:20, y:20, z:20 }, target:{ x:0, y:0, z:0 } } }); } catch (e) { crash = e; }
  ok('the director survives a frame with no acting Spirit, through every idle shot', !crash, crash?.message);
}

console.log('§3 the renderer wiring');
{
  const r = read('./arenaRenderer.js');
  ok('renderer builds a director and a subject reader', /createCameraDirector\(\)/.test(r) && /createCameraSubjects\(\{pointFor:/.test(r));
  ok('the Sonic camera outranks it: the director is only asked when sonicCamera.update returns false', /if\(!sonicCamera\.update\(frame,model,dt,reduced(?:,visuals\.battleShot\(\))?\)\) \{(\s*\/\/[^\n]*)*\s*cameraShot=autoCamera(?:&&!topView)?\?director\.update\(/.test(r));
  ok('subjects are read every frame, before the Sonic check', r.indexOf('subjects.read(frame,now)') > 0 && r.indexOf('subjects.read(frame,now)') < r.indexOf('if(!sonicCamera.update('));
  ok('the director gets the real frame time (its own 100 ms cap), not the 50 ms-capped dt', /director\.update\(\{dtMs:wallDt\*1000,now,/.test(r));
  ok('no controls.update() on a frame the director drives (or the break\'s refocus eases)', /if\(cameraShot\?\.driving\) \{[^}]*camera\.lookAt\(controls\.target\);dirty=true;\s*\} else if\(refocus\) \{[\s\S]{0,700}?if\(k>=1\)refocus=null;\s*\} else controls\.update\(\);/.test(r));
  ok('the player\'s hands are OrbitControls start/end', /controls\.addEventListener\('start',takeOver\)/.test(r) && /controls\.addEventListener\('end',letGo\)/.test(r) && /removeEventListener\('start',takeOver\)/.test(r));
  ok('a click that picks a hex cannot reach them (keepGameplayClicks still guards the overlay)', /keepGameplayClicks\(overlay\.domElement\)/.test(r) && /OrbitControls\(camera,overlay\.domElement\)/.test(r));
  ok('toolbar view buttons and zoom count as taking over', /view\(name\)\{[\s\S]{0,260}?sonicCamera\.userNudge\(\);frameView\(name\);director\.userNudge/.test(r) && /zoom\(factor\)\{[^}]*director\.userNudge/.test(r));
  ok('mounting frames the arena WITHOUT counting as the player taking over', /resize\(\);frameView\('arena'\);/.test(r));
  ok('reduced-motion rendering keeps drawing while the director moves', /moving=stats\.effects>0\|\|stats\.headDials>0\|\|stats\.moveTiles>0\|\|sonicCamera\.active\|\|!!cameraShot\?\.driving/.test(r));
  ok('narrow screens stretch the director\'s distances like view() does', /tuneDirector\(\);dirty=true;/.test(r) && /CAMERA_DIRECTOR\[key\]\*k/.test(r));
  ok('the switch rebuilds the director when turned back on', /autoCamera\(on\)\{[^}]*if\(on\)\{director=createCameraDirector\(\);tuneDirector\(\);\}/.test(r));
  ok('the badge is reported on change only', /if\(key===cameraReport\)return;/.test(r));
  ok('arenaVisuals exports the pointXY the subjects use (one mapping, not two)', /export const pointXY=/.test(read('./arenaVisuals.js')));
}

console.log('§4 the switch and the badge');
{
  const v = read('../ui/BoardViewport.jsx'), c = read('../rlsw-simulator-v3_8_1.jsx');
  ok('BoardViewport takes autoCamera and passes it to the runtime on mount and on change', /autoCamera = true/.test(v) && /runtime\.current\?\.autoCamera\(autoCamera\)/.test(v) && /runtime\.current\.autoCamera\(latest\.current\.autoCamera/.test(v));
  // 🎛️ 2026-09-25: the toolbar (and its countdown badge) moved into the ☰ menu.
  ok('no camera toolbar or badge on the board any more', !/arena-camera-toolbar/.test(v) && !/cameraBadge/.test(v));
  ok('☰ has the camera rows: view (Top/Arena/Spirit), zoom, detail', /label:'Camera view'/.test(c) && /onPick: id => arenaCameraRef\.current\?\.view\(id\)/.test(c)
    && /label:'Zoom'/.test(c) && /label:'Arena detail'/.test(c) && /cameraRef=\{arenaCameraRef\}/.test(c));
  ok('the viewport keeps Retry arena and Follow battle on the board', /Retry arena/.test(v) && /followBattle\(\)/.test(v));
  const r = read('./arenaRenderer.js');
  // 🎯 2026-09-25: a break while the director / idle flow is flying eases back onto the Spirit.
  ok('a break refocuses on the acting Spirit — only when the lens was being flown', /const broke=autoCamera&&!topView&&!sonicCamera\.active&&!!cameraShot\?\.driving&&!refocus;/.test(r)
    && /if\(broke\)startRefocus\(now\);/.test(r) && /frame\.spirits\?\.find\(s=>s\.id===frame\.actingId\)\?\.num/.test(r));
  ok('the refocus keeps the viewing angle and lands at the idle distance', /dir:dir\.divideScalar\(r0\),r0,r1:CAMERA_DIRECTOR\.idleDistance\*fit/.test(r)
    && /controls\.target\.lerpVectors\(refocus\.t0,refocus\.goal,e\)/.test(r));
  ok('a drag, a ☰ view or zoom cancels the refocus; reduced motion snaps', /const takeOver=\(\)=>\{refocus=null;/.test(r)
    && /refocus=null;sonicCamera\.userNudge\(\);frameView\(name\)/.test(r) && /zoom\(factor\)\{refocus=null;/.test(r) && /const k=reduced\?1:/.test(r));
  ok('ANY input is activity: keys, clicks, wheel and mouse movement, document-wide', /\['pointerdown','pointerup','click','auxclick','keydown','wheel','pointermove'\]/.test(r)
    && /document\.addEventListener\(type,noteActivity,\{capture:true,passive:true\}\)/.test(r));
  ok('☰ menu has the Auto camera toggle (menuSwitch lever: yes)', /kind:'toggle', icon:'🎥', label:'Auto camera'/.test(c) && /onClick:\(\) => setAutoCamera\(v => !v\)/.test(c));
  ok('the switch persists locally, default ON', /localStorage\.getItem\('rlsw\.autoCamera'\) !== '0'/.test(c));
  ok('the client hands it to the arena', /<BoardViewport enabled=\{board3D\} immersive=\{board3D\} autoCamera=\{autoCamera\}/.test(c));
}

console.log(fail ? `\n❌ cameraDirectorCheck: ${fail} failed, ${pass} passed` : `\n✅ cameraDirectorCheck: ${pass} assertions passed`);
process.exit(fail ? 1 : 0);
