// node .scratch/pyro-shove/check.mjs  —  the pure half of the Pyro shove study.
// Pins: determinism, no NaN anywhere on the timeline, continuity at every seam
// (fuse → air → land), whole-turn tumbles land the right way up, the end states
// end where they say, slow motion stays inside its bounds, the cues are ordered.
import { PYRO_SHOVE as D, reactionAt, timeline, timeRate, cues, shakeAt } from './shoveReaction.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('✗', m); } };
const near = (a, b, e, m) => ok(Math.abs(a - b) <= e, `${m}: ${a} vs ${b}`);
const TAU = Math.PI * 2, wrap = a => Math.abs(((a % TAU) + TAU + Math.PI) % TAU - Math.PI);
const dir = { x:0.866, z:-0.5 };
const make = o => ({ ...D, ...o });

const variants = [
  {}, { tumble:'flip', turns:2 }, { tumble:'flip', turns:3, flipDir:'front' }, { tumble:'cartwheel', turns:2 }, { tumble:'spin', turns:3 }, { tumble:'flail', flail:1.4 },
  { drift:'back', driftHex:2 }, { drift:'onward', driftHex:1.5 }, { endState:'stand' }, { endState:'down' }, { endState:'downRise' }, { bounces:0 }, { bounces:3 },
  { fuseMs:0, hitStopMs:0, slowMs:0 }, { fuseMs:500, airMs:2000, launchH:6 }, { launchH:0 },
];

// ── determinism + no NaN ─────────────────────────────────────────────────────
for (const v of variants) {
  const L = make(v), T = timeline(L);
  for (let t = -0.2; t < T.end + 0.5; t += 0.013) {
    const a = reactionAt(t, L, { dir }), b = reactionAt(t, L, { dir });
    ok(JSON.stringify(a) === JSON.stringify(b), `deterministic ${JSON.stringify(v)} @${t}`);
    for (const k of ['x', 'z', 'y', 'pitch', 'roll', 'yaw', 'sy', 'sxz', 'ko', 'heat', 'char', 'burn', 'plate']) ok(Number.isFinite(a[k]), `${k} finite ${JSON.stringify(v)} @${t}`);
    ok(a.y > -1e-9, `never underground ${JSON.stringify(v)} @${t}: ${a.y}`);
    ok(a.sy > 0.4 && a.sy < 1.6, `squash sane ${JSON.stringify(v)} @${t}: ${a.sy}`);
    ok(a.ko >= -1e-9 && a.ko <= 1 + 1e-9, `ko in 0..1 @${t}`);
  }
}

// ── seams: nothing teleports ─────────────────────────────────────────────────
for (const v of variants) {
  const L = make(v), T = timeline(L), e = 1e-4;
  for (const [t, name] of [[T.ti, 'ignite'], [T.tl, 'land']]) {
    if (t <= 0) continue;
    const a = reactionAt(t - e, L, { dir }), b = reactionAt(t + e, L, { dir });
    // pitch/roll/yaw are compared modulo a whole turn: a flip ends at 2π·n, which IS upright
    near(a.y, b.y, 0.05, `y continuous at ${name} ${JSON.stringify(v)}`);
    near(wrap(a.pitch), wrap(b.pitch), 0.18, `pitch continuous at ${name} ${JSON.stringify(v)}`);
    near(wrap(a.roll), wrap(b.roll), 0.18, `roll continuous at ${name} ${JSON.stringify(v)}`);
    near(wrap(a.yaw), wrap(b.yaw), 0.18, `yaw continuous at ${name} ${JSON.stringify(v)}`);
    near(a.x, b.x, 0.08, `x continuous at ${name}`); near(a.z, b.z, 0.08, `z continuous at ${name}`);
  }
}

// ── shape of the arc ─────────────────────────────────────────────────────────
{
  const L = make({ hang:1, launchH:3, fuseMs:100, airMs:1000, stretch:0 }), T = timeline(L);
  near(reactionAt(T.ti + T.air / 2, L, { dir }).y, 3, 0.02, 'apex = launchH');
  near(reactionAt(T.tl + 0.001, L, { dir }).y, 0, 0.05, 'back on the deck at touchdown');
}
{ // a flatter top hangs longer than a sharp one
  const hi = make({ hang:0.5 }), lo = make({ hang:1.3 }), T = timeline(hi);
  ok(reactionAt(T.ti + T.air * 0.8, hi, { dir }).y > reactionAt(T.ti + T.air * 0.8, lo, { dir }).y, 'low hang value is floatier near the top');
}
// ── landing places ───────────────────────────────────────────────────────────
{
  const stay = make({ drift:'stay' }), T = timeline(stay), end = T.end;
  const s = reactionAt(end, stay, { dir }); near(s.x, 0, 1e-9, 'stay x'); near(s.z, 0, 1e-9, 'stay z');
  const back = reactionAt(end, make({ drift:'back', driftHex:1 }), { dir }); near(back.x, -dir.x * 1.93, 1e-6, 'back x'); near(back.z, -dir.z * 1.93, 1e-6, 'back z');
  const on = reactionAt(end, make({ drift:'onward', driftHex:2 }), { dir }); near(on.x, dir.x * 3.86, 1e-6, 'onward x');
}
// ── whole turns land upright ─────────────────────────────────────────────────
for (const tumble of ['flip', 'cartwheel', 'spin']) for (const turns of [1, 2, 3]) {
  const L = make({ tumble, turns, bounces:0, landWobble:0, blastLean:0, endState:'stand' }), T = timeline(L);
  const o = reactionAt(T.tl - 1e-5, L, { dir });
  near(wrap(tumble === 'flip' ? o.pitch : tumble === 'cartwheel' ? o.roll : o.yaw), 0, 0.02, `${tumble}×${turns} ends upright`);
}
// ── end states ───────────────────────────────────────────────────────────────
{
  const dn = make({ endState:'down' }), Td = timeline(dn); near(reactionAt(Td.end, dn, { dir }).ko, 1, 1e-9, 'down stays down');
  const dr = make({ endState:'downRise' }), Tr = timeline(dr);
  ok(reactionAt(Tr.tl + Tr.fall + 0.1, dr, { dir }).ko > 0.99, 'downRise goes flat'); near(reactionAt(Tr.end, dr, { dir }).ko, 0, 1e-9, 'downRise gets up');
  const st = make({ endState:'stand' }); near(reactionAt(timeline(st).end, st, { dir }).ko, 0, 1e-9, 'stand never falls');
  const dz = make({ endState:'dazed', landWobble:0 }), Tz = timeline(dz); let sway = 0;
  for (let t = Tz.tb; t < Tz.tb + 1; t += 0.02) sway = Math.max(sway, Math.abs(reactionAt(t, dz, { dir }).roll));
  ok(sway > 0.03, `dazed sways (${sway})`);
}
// ── reduced motion keeps the beat, loses the throw ───────────────────────────
{
  const L = make({ tumble:'flip', launchH:5 }), T = timeline(L);
  for (let t = 0; t < T.end; t += 0.05) { const o = reactionAt(t, L, { dir, reduced:true }); ok(o.y === 0 && o.pitch === 0 && o.roll === 0, `reduced is still @${t}`); }
  ok(reactionAt(T.ti + 0.01, L, { dir, reduced:true }).ignited, 'reduced still ignites');
}
// ── clock + cues + shake ─────────────────────────────────────────────────────
{
  const L = make(), T = timeline(L);
  for (let t = -1; t < T.end; t += 0.01) { const r = timeRate(t, L); ok(r >= L.slowRate - 1e-9 && r <= 1 + 1e-9, `rate bounded @${t}: ${r}`); }
  near(timeRate(T.ti + 0.001, L), L.slowRate, 0.02, 'slow motion starts at the bang'); near(timeRate(T.ti + L.slowMs / 1000 + 0.01, L), 1, 1e-9, 'and ends');
  ok(timeRate(1, make({ slowMs:0 })) === 1, 'slowMs 0 = real time');
  const c = cues(L); ok(c.every((x, i) => i === 0 || c[i - 1].at <= x.at), 'cues sorted'); ok(c.some(x => x.type === 'boom' && Math.abs(x.at - T.ti) < 1e-9), 'boom is on the bang');
  ok(c.filter(x => x.type === 'land' || x.type === 'bounce').length === 1 + L.bounces, 'one landing cue per touchdown');
  ok(shakeAt(T.ti + 0.01, L).amp > shakeAt(T.ti + 1, L).amp, 'shake dies away'); ok(shakeAt(0.3, make({ shake:0 })).amp === 0, 'shake 0 = none');
  const s1 = shakeAt(0.5, L), s2 = shakeAt(0.5, L); ok(s1.x === s2.x && s1.y === s2.y, 'shake is deterministic');
}
console.log(`pyro-shove check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
