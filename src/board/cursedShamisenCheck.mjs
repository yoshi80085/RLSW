// ─── test:cursedshamisen — the Iwato curse's look (v1 2026-10-02 → v3 2026-10-09) ──
// The rules the animation stands on (the scale, the haunted-note draw), the cast's
// beat plan, the wheel overlay's geometry against the REAL wheel, the visuals
// driven headless through a whole curse (tune → cast → cursed → burn/exorcise →
// back to exactly how it was found), the sound laid on the same plan, and lever
// parity with the preview page.
// Run: node --import ./src/engine/testAssetStub.mjs src/board/cursedShamisenCheck.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  IWATO, CURSED_SHAMISEN, STRINGS, CURSE_TURNS, HAUNTED_NOTES, CREEPY_IVS, iwatoPcs, iwatoNames, iwatoDegree,
  pickHaunted, hauntRand, curseSlots, planCast, hushAt, wispArc, orbitPoint, stringOctaves, stringIv, CAST_SCORE, DEFAULT_STRINGS,
} from './cursedShamisen.js';
import { createCursedShamisenVisuals } from './cursedShamisenVisuals.js';
import { scheduleCast } from '../audio/shamisenCurseSfx.js';
import { WHEEL_GEO, cursedWheelModel } from '../ui/cursedWheelModel.js';
import { modeIntervals, melodyModeFor } from '../music/melodyIdentity.js';
import { playableScale, pitchIndex } from '../music/notes.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log(`  ✗ ${m}`); } };
const section = t => console.log(`§ ${t}`);
const read = rel => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const pcsOf = notes => notes.map(n => pitchIndex(n));
const colDist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

section('0 · one copy of every number');
ok(Object.isFrozen(CURSED_SHAMISEN) && Object.isFrozen(IWATO), 'the look and the scale are frozen');
ok(STRINGS === 3 && CURSE_TURNS === 3 && HAUNTED_NOTES === 3, 'three strings on the ghost instrument, three cursed turns, three haunted notes (v3, Alex 2026-10-09)');

section('1 · the scale is Iwato (v3: on the trapped note)');
ok(JSON.stringify(IWATO) === JSON.stringify([0, 1, 5, 6, 10]), 'Iwato = 1 ♭2 4 ♭5 ♭7');
ok(JSON.stringify(iwatoPcs('D')) === JSON.stringify([2, 3, 7, 8, 0]), 'on D: D E♭ G A♭ C');
ok(iwatoNames('D').join(' ') === 'D E♭ G A♭ C', 'spelled with flats');
const hira = modeIntervals(melodyModeFor('cosmic_ronin'));
const shared = IWATO.filter(iv => hira.includes(iv));
ok(JSON.stringify(shared) === JSON.stringify([0, 5]), 'it shares only 1 and 4 with his own scale — the curse runs on his discord');
ok(iwatoDegree('Ab', 'D') === '♭5' && iwatoDegree('A', 'D') === null, 'degrees read right; non-Iwato is null');
ok(curseSlots('D').filter(s => s.iwato).length === 5, 'five slots light on the cursed wheel');

section('2 · the haunted notes — three different, creepy, seeded');
for (let i = 0; i < 200; i++) {
  const h = pickHaunted(hauntRand(`curse-${i}`), HAUNTED_NOTES);
  if (h.length !== 3 || new Set(h).size !== 3 || !h.every(iv => CREEPY_IVS.includes(iv))) { ok(false, `draw ${i} is not three different creepy notes: ${h}`); break; }
}
ok(true, 'every draw: three different notes from ♭2 4 ♭5 ♭7 — never the root (Alex: "all 3 notes come from creepy notes")');
ok(JSON.stringify(pickHaunted(hauntRand('same'), 3)) === JSON.stringify(pickHaunted(hauntRand('same'), 3)), 'the same key draws the same notes on every client');

section('2b · the octave rule — a repeated note rings an octave higher');
ok(JSON.stringify(stringOctaves([0, 0, 0])) === '[0,1,2]', 'D·D·D = low, middle, high');
ok(JSON.stringify(stringOctaves([0, 6, 0])) === '[0,0,1]', 'D·A♭·D = the third an octave over the first (honchōshi\'s open shape)');
ok(JSON.stringify(stringOctaves([1, 6, 10])) === '[0,0,0]', 'three different notes stay put');
ok(stringIv('C', 'D') === 10 && stringIv('Eb', 'D') === 1 && stringIv('D', 'D') === 0, 'intervals above his root');
{ const same = planCast(CURSED_SHAMISEN, [0, 0, 0]).notes.filter(n => n.string != null && CAST_SCORE[n.i].s != null).map(n => n.semis);
  ok(new Set(same).size >= 3, 'three of the same note still make a melody of three different heights');
  const all = [[0, 0, 0], [1, 6, 10], [10, 10, 10], [6, 0, 6]].flatMap(t => planCast(CURSED_SHAMISEN, t).notes.map(n => n.semis));
  ok(all.every(x => x >= -14 && x <= 24), 'no tuning pushes the melody off the instrument'); }

section('4 · the cast, beat by beat');
for (const [look, ivs] of [[CURSED_SHAMISEN, undefined], [{ ...CURSED_SHAMISEN, phraseTempo:0.5, wispStagger:0 }, [0, 0, 0]], [{ ...CURSED_SHAMISEN, bell:'off', hushMs:1800, phraseTempo:1.6 }, [6, 1, 10]]]) {
  const P = planCast(look, ivs);
  ok(P.notes.every((n, i) => !i || n.at > P.notes[i - 1].at), 'phrase notes are in order');
  ok(P.notes.every(n => n.string >= 0 && n.string < STRINGS), 'every note flares a real string');
  ok(P.wisps.length === STRINGS && P.wisps[0].launch === P.launchAt && P.notes.find(n => n.launch).ghost, 'one wisp per string, leaving on the ghost note');
  ok(P.wisps.slice(0, -1).every(w => w.arrive === w.launch + look.wispFlightMs), 'each crosses in wispFlightMs');
  ok(P.slapAt >= P.phraseEnd - 400, 'the ofuda never lands before the melody has died away');
  ok(P.notes.filter(n => CAST_SCORE[n.i].s != null).every(n => ((n.semis % 12) + 12) % 12 === (ivs ?? DEFAULT_STRINGS)[CAST_SCORE[n.i].s]), 'his strings ARE the melody\'s heart');
  ok(P.notes.some(n => n.trem > 0) && P.notes.some(n => n.bend !== 0 || look.bend === 0) && P.notes.at(-1).dyad === 1, 'the tremolo, the slides and the unresolved ♭2 are in it');
  ok(P.wisps.filter(w => w.slap).length === 1 && P.wisps.at(-1).slap, 'exactly one — the last — becomes the ofuda');
  ok(STRINGS === HAUNTED_NOTES, 'one wisp per haunted note — v3: they ALL circle the rival');
  ok(P.slapAt === P.wisps.at(-1).arrive && P.infectStart === P.slapAt, 'the infection starts on the slap');
  ok(P.total > P.infectEnd && P.hushOut === P.infectEnd, 'the world comes back after the infection');
  ok(look.bell === 'on' ? P.bellAt === look.bellAt : P.bellAt === null, 'the bell lever is obeyed');
  ok(hushAt(P, -1, look) === 0 && hushAt(P, P.total + 1, look) === 0 && hushAt(P, P.slapAt, look) === 1, 'the hush rises, holds, falls');
}
{ const a = { x:0, y:1, z:0 }, b = { x:5, y:2, z:-3 };
  const s = wispArc(a, b, 0, 2), e = wispArc(a, b, 1, 2), m = wispArc(a, b, 0.5, 2);
  ok(s.x === 0 && Math.abs(e.x - 5) < 1e-9 && Math.abs(e.y - 2) < 1e-9 && m.y > 2.9, 'a wisp arcs from the string to its target, lifted in the middle');
  const o = orbitPoint({ x:1, y:0, z:1 }, 3.2, 1, 2), r = Math.hypot(o.x - 1, o.z - 1);
  ok(Math.abs(r - CURSED_SHAMISEN.orbitRadius) < 1e-9, 'circling wisps keep their radius'); }

section('5 · the wheel overlay sits on the REAL wheel');
const sw = read('../ui/ScaleWheel.jsx');
const geo = sw.match(/const VB = (\d+), C = VB \/ 2, R = (\d+), R_IN = R - (\d+), CHIP = (\d+);/);
ok(!!geo, 'ScaleWheel.jsx still declares its geometry in one line');
if (geo) ok(+geo[1] === WHEEL_GEO.VB && WHEEL_GEO.C === WHEEL_GEO.VB / 2 && +geo[2] === WHEEL_GEO.R && WHEEL_GEO.R_IN === +geo[2] - +geo[3] && +geo[4] === WHEEL_GEO.CHIP,
  'WHEEL_GEO is the wheel\'s own (VB, C, R, R_IN, CHIP)');
ok(/const slotAngle = k => \(-90 \+ k \* 30\)/.test(sw), 'and its slot angle is the one the overlay uses');
const hands = { can:['E', 'F', 'G', 'A', 'B', 'C', 'D', 'Bb', 'F#', 'G'], cannot:['E', 'F', 'A', 'B', 'F#', 'C#', 'A', 'B', 'E', 'F'] };
const cm = cursedWheelModel({ spiritId:'Metalness_Monster', root:'E', roninRoot:'D', hand:hands.can });
ok(cm.slots.filter(s => s.iwato).length === 5, 'five Iwato slots on the rival\'s wheel');
const phryg = new Set(pcsOf(playableScale('E', 'phrygian')));
ok(cm.slots.filter(s => s.ownLost).every(s => phryg.has(s.pc) && !iwatoPcs('D').includes(s.pc)), '"lost" = their own notes the curse does not keep');
ok(cm.heldIwato === 3, 'the preview\'s "can" hand holds three Iwato notes (G, C, D)');
ok(cursedWheelModel({ spiritId:'Metalness_Monster', root:'E', roninRoot:'D', hand:hands.cannot }).heldIwato === 0, '…and "cannot" holds none');
{ // 👻 v3: the haunted marks — Eb (♭2) haunted, Ab (♭5) lifted, G (the 4) plain Iwato
  const hm = cursedWheelModel({ spiritId:'Metalness_Monster', root:'E', roninRoot:'D', hand:['G', 'Eb', 'E'], haunted:[{ pc:3, lifted:false }, { pc:8, lifted:true }] });
  const at = p => hm.slots.find(s => s.pc === p);
  ok(at(3).haunted && !at(3).lifted && at(8).lifted && !at(8).haunted && !at(7).haunted && !at(7).lifted, 'haunted / lifted / plain marked on the right slots');
  ok(hm.hauntedLeft === 1 && hm.liftedCount === 1 && hm.heldHaunted === 1, 'the readout\'s counts: one left, one lifted, one held');
  const wj = read('../ui/CursedWheel.jsx');
  ok(/cw-haunt-ring/.test(wj) && /fill=\{s\.haunted \? '#000'/.test(wj), 'a haunted note is black with a breathing ring (colour AND motion)');
}

section('6 · the visuals, headless, through a whole curse');
function fakeStandee(pos, colour) {
  const group = new THREE.Group(); group.position.copy(pos);
  const edge = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ emissive:new THREE.Color(colour) })); edge.renderOrder = 9;
  const halo = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color:new THREE.Color(colour) }));
  const shadow = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color:0x000000 }));
  const art = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ map:new THREE.Texture(), emissive:0xffffff }));
  group.add(edge, halo, shadow, art); return { group, parts:[edge, halo, shadow, art], edge, halo, shadow, art };
}
function run(path) {
  const ronin = fakeStandee(new THREE.Vector3(0, 0.2, 0), '#4488ff'), rival = fakeStandee(new THREE.Vector3(6, 0.2, -2), '#ff6600');
  const was = rival.edge.material.emissive.clone();
  const v = createCursedShamisenVisuals({ ronin, rival, color:'#4488ff' });
  let now = 1000; const step = (ms, f = 16) => { let out; for (let t = 0; t < ms; t += f) { now += f; out = v.update(now); } return out; };
  ok(!v.cast(now), 'no cast with untuned strings');
  ['♭2', '♭5', '♭7'].forEach((d, i) => { ok(v.tune(i, d, now), `string ${i + 1} tunes`); step(200); });
  ok(!v.tune(1, '4', now), 'a tuned string cannot be tuned again');
  ok(v.snap(now) && v.state.tuned === 2, 'a hit snaps the last tuned string');
  v.tune(2, '♭7', now); step(800);
  ok(v.state.tuned === 3 && v.cast(now), 'three strings → the cast fires');
  const P = planCast();
  const mid = step(P.phraseEnd);
  ok(mid.dim > 0.3 && mid.tint > 0.3, 'the world hushes and goes violet during the cast');
  step(P.total - P.phraseEnd + 100);
  const after = step(50);
  ok(v.state.phase === 'cursed' && v.state.turnsLeft === HAUNTED_NOTES, 'cursed, with three ghosts');
  ok(v.group.children.filter(c => c.isSprite && c.renderOrder === 30 && c.visible).length === HAUNTED_NOTES, '⭐ v3: all three ghosts circle the rival (the slapping one too)');
  ok(rival.group.children.some(c => c.isMesh && c.renderOrder === 25), 'the ofuda is ON the rival (it rides a shove with them)');
  ok(!rival.edge.material.emissive.equals(was), 'their edge has turned');
  ok(colDist(rival.halo.material.color, new THREE.Color('#ff6600')) > 0.2, '…and their halo with it');
  ok(rival.shadow.material.color.getHex() === 0 && rival.art.material.emissive.getHex() === 0xffffff, 'but never the shadow or the print');
  ok(after.dim < 0.05 && after.fans.sync < 0.3 && after.fans.dim < 0.8, 'the world is back; their fans are out of time and dim');
  if (path === 'expire') {
    ok(v.burnOne(now) && v.state.turnsLeft === 2, 'a lifted note burns one ghost');
    step(1200);
    ok(v.state.phase === 'cursed', '…and the curse holds (v3: only the caller ends it)');
    ok(v.expire(now) && v.state.phase === 'expired', 'out of turns: it expires');
    const end = step(CURSED_SHAMISEN.expireMs + 300);
    ok(end.fans.sync > 0.99 && colDist(rival.edge.material.emissive, was) < 1e-3, 'expired: the fans and the edge are back exactly');
    ok(!rival.group.children.some(c => c.renderOrder === 25), 'the ofuda has fallen off');
  } else {
    ok(v.burnOne(now) && v.burnOne(now) && v.burnOne(now) && v.state.turnsLeft === 0 && v.state.phase === 'cursed', 'three lifts burn the three ghosts');
    ok(v.exorcise(now) && v.state.phase === 'exorcised', 'the paper lifts');
    const e = step(300);
    ok(e.fans.cheer > 0, 'their crowd cheers');
    step(CURSED_SHAMISEN.ofudaBurnMs + 400);
    ok(!rival.group.children.some(c => c.renderOrder === 25), 'the ofuda has burned away');
    ok(!v.burnOne(now), 'no countdown after an exorcism');
  }
  v.dispose();
  ok(rival.edge.material.emissive.equals(was), 'dispose puts the edge back exactly as it was found');
  ok(!rival.group.children.some(c => c.renderOrder === 25), 'and leaves nothing on the rival');
}
run('expire'); run('exorcise');
{ // ⚠️ torn down MID-CURSE (a match ending, a client unmount): nothing may stay violet
  const ronin = fakeStandee(new THREE.Vector3(0, 0.2, 0), '#4488ff'), rival = fakeStandee(new THREE.Vector3(6, 0.2, -2), '#ff6600');
  const was = rival.edge.material.emissive.clone(), v = createCursedShamisenVisuals({ ronin, rival });
  let now = 0; [0, 1, 2].forEach(i => v.tune(i, '', now)); v.cast(now);
  for (let t = 0; t < planCast().total + 200; t += 16) { now += 16; v.update(now); }
  ok(v.state.phase === 'cursed' && colDist(rival.edge.material.emissive, was) > 0.1, 'mid-curse the edge is violet');
  v.dispose();
  ok(colDist(rival.edge.material.emissive, was) < 1e-9 && !rival.group.children.some(c => c.renderOrder === 25), 'disposed mid-curse: edge restored, ofuda gone');
  ok(colDist(rival.halo.material.color, new THREE.Color('#ff6600')) < 1e-9, '…and the halo too');
}

section('7 · the sound is laid on the same plan');
{
  const calls = [];
  const fake = new Proxy({}, { get:(_, k) => (...a) => calls.push([k, a]) });
  const P = planCast(); scheduleCast(fake, P, 50);
  const plucks = calls.filter(c => c[0] === 'pluck');
  ok(P.notes.every(n => plucks.some(c => Math.abs(c[1][1].delay - n.at / 1000) < 1e-9)), 'every score note is plucked on its beat');
  const trem = P.notes.find(n => n.trem);
  ok(plucks.filter(c => c[1][1].delay > trem.at / 1000 && c[1][1].delay < trem.at / 1000 + 0.4).length >= trem.trem, 'the ♭5 is trembled');
  ok(plucks.some(c => c[1][1].bend < 0) && plucks.some(c => c[1][1].bend > 0), 'notes slide in from below and above');
  ok(calls.some(c => c[0] === 'drone'), 'a drone lies under the melody');
  const slap = calls.find(c => c[0] === 'slap'), bell = calls.find(c => c[0] === 'bell');
  ok(slap && Math.abs(slap[1][1].delay - P.slapAt / 1000) < 1e-9, 'the slap lands with the ofuda');
  ok(bell && Math.abs(bell[1][1].delay - P.bellAt / 1000) < 1e-9, 'the bell on its beat');
  ok(calls.some(c => c[0] === 'hyuDoro') && calls.some(c => c[0] === 'hush') && calls.some(c => c[0] === 'infect'), 'the hush, the ghost cue and the infection drone');
}

section('8 · wiring');
const sfx = read('../audio/shamisenCurseSfx.js'), vis = read('./cursedShamisenVisuals.js');
ok(/shamisenBuffer\(ctx, freq\)/.test(sfx), 'the plucks ARE his dialled-in string');
ok(/setTimeout\(\(\) => \{ for \(const n of nodes\)/.test(sfx), 'every sound unplugs itself (the voice-leak lesson)');
ok(/renderOrder === 9/.test(vis), 'the infection tints the standee\'s real cut edge');
let client = ''; try { client = read('../rlsw-simulator-v3_8_1.jsx'); } catch { /* not in every checkout */ }
if (client) {
  // ✅ WIRED 2026-10-02 — this guard used to assert the opposite ("not imported yet").
  ok(/from "\.\/engine\/systems\/iwatoCurse\.js"/.test(client), 'the client plays by the engine\'s rules (iwatoCurse.js)');
  ok(/<CursedWheel\b/.test(client), 'a cursed Spirit\'s Scale Wheel is the infected one');
  ok(/shamisen:\{ \.\.\.curseScene\(spirits, noteStates\), trap: myTrap \}/.test(client), 'the arena is handed the curse, read off the sheets — plus this seat\'s OWN trap only (`myTrap`)');
}
ok(/createShamisenStage/.test(read('./arenaVisuals.js')), 'the arena mounts the curse\'s stage');
ok(/createCursedShamisenVisuals/.test(read('./cursedShamisenArena.js')), '…which draws with these visuals');
let prev = ''; try { prev = read('../../.scratch/cursed-shamisen-preview.jsx'); } catch { /* the preview is not in every checkout */ }
if (prev) {
  const keys = [...prev.matchAll(/[RS]\('(?:tune|cast|infect|wheel|count|end|sound)', '(\w+)'/g)].map(m => m[1]);
  ok(Object.keys(CURSED_SHAMISEN).every(k => keys.includes(k)), 'every lever in CURSED_SHAMISEN is on the preview');
  ok(keys.every(k => k in CURSED_SHAMISEN), 'and the preview has no lever the modules ignore');
  ok(/CURSED_SHAMISEN\[l\.key\]/.test(prev) && /\.\.\.CURSED_SHAMISEN/.test(prev), 'the preview\'s defaults ARE CURSED_SHAMISEN');
}

console.log(`\ncursedshamisen: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
