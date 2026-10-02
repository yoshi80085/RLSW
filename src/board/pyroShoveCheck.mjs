// ─── 🔥 PYRO SHOVE CHECK — the hit's pure half, Astra's mortars, the sound ────
// `npm run test:pyroshove`. Ported 2026-10-02 from `.scratch/pyro-shove/check.mjs`
// (§1, verbatim: determinism, no NaN on the timeline, continuity at every seam,
// whole-turn tumbles land upright, end states, slow motion, cues), then:
//   §2 the dial-in — Alex's 10 levers, and lever-for-lever parity with the page
//   §3 the show clock — hit-stop + slow motion as a mapping, and its inverse
//   §4 the show timeline — deploy / volley / retract cues, and the crown heard
//      when it is SEEN (the preview played it 0.35 s early)
//   §5 the mortars — construction options, named parts, `mortarByHex`, every
//      beat of the cue contract read back off the real three.js objects
//   §6 the sound — the API, silent without a context, voices on the SFX fader
// ⚠️ The preview's own `check.mjs` now runs THIS file: one copy of the assertions.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { PYRO_SHOVE as D, reactionAt, timeline, timeRate, cues, shakeAt, makeShowClock,
  SHELL_FLIGHT, MORTAR_SOUND_MARKS, SHOW_PANS, MECH_VOICES, deployCues, retractCues, volleyTimes, volleyCues, retractAt } from './pyroShove.js';
import { createPyroMortars, MORTAR_TIMING, MORTAR_LOOK, particlesPerMortar, point } from './pyroMortars.js';
import { createPyroSfx } from '../audio/pyroSfx.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('✗', m); } };
const near = (a, b, e, m) => ok(Math.abs(a - b) <= e, `${m}: ${a} vs ${b}`);
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
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

// ── §2 the dial-in ───────────────────────────────────────────────────────────
{
  const DIAL = { slowRate:0.45, launchH:3, airMs:1100, tumble:'spin', crown:1.55, bass:1.7, boom:1.65, tail:2, shake:0.3, punch:0.2 };
  for (const [k, v] of Object.entries(DIAL)) ok(D[k] === v, `dial-in: ${k} = ${JSON.stringify(v)} (Alex)`);
  ok(D.turns === 1, 'dial-in: one spin (turns untouched)');
  // the three calls shipped at the default, not decided (flagged in the header)
  ok(D.endState === 'dazed' && D.hitStopMs === 70 && D.shell === 'on', 'the three open calls ship at their defaults');
  ok(D.drift === 'stay', 'Alex: the standee comes down ON the mortar');
  ok(D.fxSource === 'astra', "Astra's mortars and fire, my movement and sound");
  ok(Object.isFrozen(D), 'PYRO_SHOVE is frozen');
  // 🎯 every lever the page offers is a key here (the page throws otherwise) — and
  // no key here is orphaned by the page (one copy, both ways)
  const page = readFileSync(new URL('../../.scratch/pyro-shove/preview.js', import.meta.url), 'utf8');
  const keys = [...page.matchAll(/\b[RS]\('[a-z]+', '([A-Za-z]+)'/g)].map(m => m[1]);
  ok(keys.length >= 70, `the page still offers its levers (${keys.length})`);
  for (const k of keys) ok(k in D, `page lever "${k}" is a PYRO_SHOVE key`);
  for (const k of Object.keys(D)) ok(keys.includes(k), `PYRO_SHOVE key "${k}" has a lever on the page`);
  ok(page.includes("from './shoveReaction.js'") && readFileSync(new URL('../../.scratch/pyro-shove/shoveReaction.js', import.meta.url), 'utf8').includes("export * from '../../src/board/pyroShove.js'"),
    'the page reads its defaults from THIS module (no second copy)');
}

// ── §3 the show clock ────────────────────────────────────────────────────────
for (const v of [{}, { hitStopMs:0 }, { slowMs:0 }, { slowRate:1 }, { fuseMs:0 }, { fuseMs:400, hitStopMs:200, slowMs:1200, slowRate:0.2 }]) {
  const L = make(v), T = timeline(L), C = makeShowClock(L), tag = JSON.stringify(v);
  let prev = -1;
  for (let r = -0.2; r < 4; r += 0.007) {
    const a = C.ageAt(r);
    ok(a >= prev - 1e-12, `${tag}: the clock never runs backwards @${r.toFixed(3)}`);
    ok(a <= r + 1e-9, `${tag}: the show is never AHEAD of real time`);
    near(C.realAt(a), r <= 0 ? r : C.realAt(a), 1e-9, 'realAt is defined');
    if (r > 0) near(C.ageAt(C.realAt(a)), a, 0.0015, `${tag}: realAt inverts ageAt @${r.toFixed(3)}`);
    prev = a;
  }
  near(C.ageAt(T.ti), T.ti, 1e-9, `${tag}: before the bang the show runs in real time`);
  if (L.hitStopMs > 0) {
    near(C.ageAt(T.ti + L.hitStopMs / 1000 * 0.5), T.ti, 1e-9, `${tag}: ❄ held on the flash frame through the hit-stop`);
    near(C.hold, L.hitStopMs / 1000, 1e-9, `${tag}: the hold is hitStopMs`);
  }
  const slowCost = L.slowMs > 0 && L.slowRate < 1;
  ok(C.lag >= C.hold - 1e-9 && (slowCost ? C.lag > C.hold + 0.01 : C.lag < C.hold + 0.003), `${tag}: the lag is the hold plus what slow motion costs (${C.lag.toFixed(3)})`);
  near(C.ageAt(10) , 10 - C.lag, 1e-6, `${tag}: after the slow window the show runs at 1× again`);
}
{
  const R = makeShowClock(make(), { reduced:true });
  ok(R.hold === 0, '♿ reduced motion: no hit-stop (the preview\'s rule)');
}

// ── §4 the show timeline ─────────────────────────────────────────────────────
{
  ok(SHELL_FLIGHT === MORTAR_TIMING.flight, "SHELL_FLIGHT mirrors Astra's shell flight exactly");
  const L = make(), T = timeline(L), c = cues(L);
  const crown = c.find(x => x.type === 'crown');
  near(crown.at, T.ti + MORTAR_TIMING.flight, 1e-9, "the struck mortar's crown is HEARD when Astra's burst is SEEN");
  near(cues(make({ fxSource:'mine' })).find(x => x.type === 'crown').at, T.ti + 1.15, 1e-9, "…and on the page's own fire, when ITS shell bursts");
  const dep = deployCues(5, 13, L);
  eq(dep.length, 3 * MECH_VOICES, 'the machinery is four voices however big the wave');
  eq(dep.filter(x => x.type === 'unlock').map(x => x.pan), [...SHOW_PANS], '…panned like the page');
  near(dep.find(x => x.type === 'lock').at, 5 + MORTAR_SOUND_MARKS.deploy.lock, 1e-9, 'the lock lands as the barrel locks home');
  ok(MORTAR_SOUND_MARKS.deploy.lock <= MORTAR_TIMING.deployed, '…which is no later than "fully deployed"');
  const ret = retractCues(9, 2, L);
  eq(ret.map(x => x.type), ['release', 'retract', 'seal', 'release', 'retract', 'seal'], 'a small set retracts with one voice per mortar');
  ok(ret.every(x => x.at >= 9 && x.at <= 9 + MORTAR_TIMING.petalsClose + 0.2), 'the retract machinery sits inside the retract');
  const f = volleyTimes(10, 5, L);
  eq(f, [10, 10 + L.sympStagger, 10 + 2 * L.sympStagger, 10 + 3 * L.sympStagger, 10 + 4 * L.sympStagger], 'the volley rolls at the page\'s stagger');
  const g = volleyTimes(10, 3, L, [4.2]);
  eq(g, [4.2, 10, 10 + L.sympStagger], 'a struck mortar keeps its own earlier bang');
  const v = volleyCues(g, L, { skip:[0] });
  eq(v.filter(x => x.type === 'launch').length, 2, "the struck mortar's launch is the reaction's, not the volley's");
  ok(v.filter(x => x.type === 'burst').every(x => v.some(y => y.type === 'launch' && Math.abs(y.at + SHELL_FLIGHT - x.at) < 1e-9)), 'every burst is SHELL_FLIGHT after its launch');
  const big = volleyCues(volleyTimes(0, 13, L), L), small = volleyCues(volleyTimes(0, 3, L), L);
  ok(big[0].lv < small[0].lv && small[0].lv === L.launchVol, 'a 13-mortar volley shares the level; three or four play at full');
  near(retractAt(g, L), 10 + L.sympStagger + L.holdS, 1e-9, 'a set folds away holdS after its LAST mortar');
  eq(retractAt([Infinity, Infinity], L), Infinity, 'a set that has not fired does not retract');
}

// ── §5 the mortars ───────────────────────────────────────────────────────────
{
  const scene = new THREE.Scene(), nums = [12, 40, 56, 77];
  const P = createPyroMortars(scene, nums);
  eq(P.mortars.length, 4, 'one mortar per hex');
  eq([...P.mortarByHex.keys()], nums, 'mortarByHex finds each by its hex number');
  ok(P.cannons.length === 0 && P.truss === null, 'the game build has no blasters and no truss (Alex: mortars only)');
  eq(P.particleCount, nums.length * particlesPerMortar(1), 'the particle pool is sized to what was built — not 22,000');
  const F = createPyroMortars(new THREE.Scene(), nums, { cannons:true, curtain:true, maxDensity:1.8 });
  ok(F.cannons.length === 12 && F.truss, "Astra's full show is still one option away");
  for (const m of P.mortars) {
    for (const part of ['g', 'base', 'barrel', 'petals', 'warning', 'bore', 'exhaust']) ok(m[part], `mortar ${m.num} has a named ${part}`);
    ok(m.petals.length === 6, `mortar ${m.num} has six petals`);
    near(m.g.position.x, point(m.num).x, 1e-9, `mortar ${m.num} sits on its hex (arenaPoint's mapping)`);
  }
  const M = P.mortarByHex.get(40), S = P.mortarByHex.get(56), Tm = MORTAR_TIMING;
  const cue = { deployedAt:1, fireAt:[Infinity, 6, 5, Infinity], endAt:12, showAt:Infinity, hit:56, contact:{ 56:4.9 } };
  const at = t => { P.update(t, MORTAR_LOOK, cue); return { up:M.barrel.position.y, open:M.petals[0].rotation.x, vis:M.g.visible, sy:S.barrel.position.y, sOpen:S.petals[0].rotation.x, flame:M.exhaust.uniforms.power.value }; };
  ok(!at(0.9).vis, 'nothing shows before deployedAt');
  near(at(1).open, 0, 1e-9, 'the hatch starts shut');
  near(at(1 + Tm.petalsOpen).open, 1.65, 1e-9, 'the petals are open 1.30 s after deploy');
  near(at(1 + Tm.barrelRiseAt).up, -0.9, 1e-9, 'the barrel waits 0.40 s');
  near(at(1 + Tm.deployed).up, 0.08, 1e-9, '…and is fully up at +1.90 s');
  ok(at(6 + Tm.recoil / 2).up < 0.08 - 0.2, 'the barrel recoils when it fires');
  near(at(6 + Tm.recoil + 0.01).up, 0.08, 1e-9, '…and recovers');
  ok(at(6.02).flame > 0.9, 'the flame roars on ignition');
  // the struck mortar: pressed down from CONTACT, then the struck sink after its bang
  ok(at(4.95).sy < at(4.85).sy, "a standee's weight presses the struck barrel down from contact, before the bang");
  ok(at(4.85).sy > 0.07, '…and not before contact');
  near(at(5 + Tm.struckAt + Tm.struckOver + 0.01).sOpen, 0, 1e-9, 'the struck mortar closes its petals over the piece');
  ok(at(5.6).sy < -0.8, '…and its barrel sinks out from under it');
  ok(at(5.6).open > 1.6, 'the OTHER mortars are untouched by the strike');
  near(at(12 + Tm.barrelLower).up, -0.9, 1e-9, 'the barrel is down 1.10 s after endAt');
  near(at(12 + Tm.petalsClose - 1e-6).open, 0, 1e-4, 'the petals are shut at +1.40 s');
  ok(!at(12 + Tm.petalsClose + 0.01).vis, '…and the assembly is gone');
  eq(P.doneAt(cue), 12 + Tm.petalsClose, 'doneAt is when the set can be disposed');
  // deterministic + scrub-safe: the same t twice gives the same picture
  const snap = t => { const n = P.update(t, MORTAR_LOOK, cue); const a = P.root.children.find(o => o.isPoints).geometry.attributes.position.array; return [n, a[0], a[n * 3 - 1] ?? 0, M.barrel.position.y].join(); };
  const a1 = snap(7.3); snap(2); snap(11); ok(snap(7.3) === a1, 'scrubbing away and back leaves nothing behind');
  // several hits in one set (two shoves in one turn)
  P.update(6.6, MORTAR_LOOK, { ...cue, hit:[40, 56], contact:{} });
  ok(M.petals[0].rotation.x < 1.6, 'hit can name several mortars');
  P.dispose(); ok(!scene.children.includes(P.root), 'dispose takes the set off the scene');
}

// ── §6 the sound ─────────────────────────────────────────────────────────────
{
  const voices = ['plate', 'whine', 'boom', 'crackle', 'shell', 'crown', 'land', 'burn', 'unlock', 'lift', 'lock', 'release', 'retract', 'seal', 'launch', 'flame', 'curtain'];
  const silent = createPyroSfx({ context:() => null });
  ok(silent.ensure() === false && silent.running === false, 'no AudioContext → silent, not a throw');
  for (const v of voices) { ok(typeof silent[v] === 'function', `voice ${v} exists`); silent[v](1, 0.5, 1); ok(true, `voice ${v} is a no-op without a context`); }
  const cueTypes = new Set([...cues(make()).map(c => c.type), ...deployCues(0, 4).map(c => c.type), ...retractCues(0, 4).map(c => c.type), ...volleyCues([0]).map(c => c.type)]);
  for (const t of cueTypes) ok(t === 'bounce' || t === 'burst' || voices.includes(t), `cue "${t}" has a voice (bounce → land, burst → crown)`);
  const sfxSrc = readFileSync(new URL('../audio/pyroSfx.js', import.meta.url), 'utf8');
  ok(/import \{ getRiffAudio, getSfxBus \} from '\.\/riffSfx\.js'/.test(sfxSrc) && /output = getSfxBus/.test(sfxSrc), 'the game plays it through the SFX fader');
  ok(!/^import .*stage-pyro/m.test(sfxSrc), "Astra's audio is not used (Alex)");
  ok(/__rlswPyroChain/.test(sfxSrc), 'one chain per AudioContext, not one per mount');
}

console.log(`✅ pyroShoveCheck: ${pass} assertions passed`);
if (fail) process.exit(1);
