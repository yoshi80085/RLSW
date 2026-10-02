// ─── 🎸 the Iwato curse's ARENA STAGE — `cursedShamisenArena.js` ─────────────
// Part of `npm run test:cursedshamisen`. Drives the stage with the frames the
// client really sends (`iwatoCurse.js` curseScene → `arenaFrame` → here) on an
// injected clock, against stand-in standees, and checks it plays each moment
// once, in order, and leaves the rival exactly as it found them.
import * as THREE from 'three';
import { createShamisenStage } from './cursedShamisenArena.js';
import { CURSED_SHAMISEN, planCast, CURSE_TURNS } from './cursedShamisen.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error(`  ✗ ${m}`); } };
const section = t => console.log(`\n§ ${t}`);

// A stand-in for `createStandee`: a group, and the cut edge (renderOrder 9) the curse tints.
function fakeStandee(hex) {
  const group = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ emissive: hex }));
  edge.renderOrder = 9; group.add(edge);
  const base = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ emissive: hex }));
  group.add(base);
  return { group, parts: [edge, base], edge };
}
const ronin = fakeStandee(0x4488ff), rival = fakeStandee(0xff4444), other = fakeStandee(0xffcc00);
const standees = { R: ronin, T: rival, Q: other };
let clock = 1000;
const root = new THREE.Group();
const stage = createShamisenStage({ root, standee: id => standees[id] ?? null, now: () => clock });
const tick = (ms = 16) => { clock += ms; return stage.tick(clock / 1000, {}); };
const run = (ms, step = 50) => { let out; for (let t = 0; t < ms; t += step) out = tick(step); return out; };
const d = () => stage.diagnostics();
const plan = planCast(CURSED_SHAMISEN, [1, 1, 6]);
const edgeWas = rival.edge.material.emissive.getHex();

section('1 · the instrument and its strings');
stage.update({ instruments: [{ roninId: 'R', color: '#4488ff', strings: [] }] });
ok(d().instruments === 1 && d().tuned[0] === 0, 'a taken-up shamisen hangs over him, untuned');
ok(root.children.length === 1, '…in the arena\'s own group');
stage.update({ instruments: [{ roninId: 'R', color: '#4488ff', strings: ['♭2'] }] }); tick();
stage.update({ instruments: [{ roninId: 'R', color: '#4488ff', strings: ['♭2', '♭2′', '♭5'] }] }); tick();
ok(d().tuned[0] === 3, 'each new string tunes once — three strings, three tunes');
stage.update({ instruments: [{ roninId: 'R', color: '#4488ff', strings: ['♭2', '♭2′', '♭5'] }] });
ok(d().tuned[0] === 3, 'a repeated frame tunes nothing twice');

section('2 · the cast hands the instrument to the curse');
const cast = { key: 'R>T@4', roninId: 'R', color: '#4488ff', targetId: 'T', ivs: [1, 1, 6], turnsLeft: CURSE_TURNS, ended: null };
stage.update({ instruments: [], curses: [cast] });
ok(d().instruments === 0 && d().curses === 1, '⭐ the cast frame drops his instrument AND the curse takes it (not disposed first)');
ok(d().phases[0] === 'cast', 'the cast plays');
let light = tick();
const hush = run(plan.phraseStart + 600);
ok(hush.dim > 0.2, `the arena hushes while he casts (dim ${hush.dim.toFixed(2)})`);
run(plan.total);
ok(d().phases[0] === 'cursed', 'the cast lands and the rival is cursed');
ok(rival.edge.material.emissive.getHex() !== edgeWas, 'their neon edge has turned');
ok(tick().dim === 0, '…and the world comes back up');
stage.update({ instruments: [], curses: [cast] });
ok(d().curses === 1 && d().phases[0] === 'cursed', 'the same curse in the next frame is not cast again');

section('3 · the countdown and the exorcism');
stage.update({ curses: [{ ...cast, turnsLeft: 1 }] }); tick();
ok(d().phases[0] === 'cursed', 'one cursed turn ends — a wisp burns, still cursed');
stage.update({ curses: [{ key: cast.key, roninId: null, targetId: 'T', ivs: [], turnsLeft: 0, ended: 'exorcised' }] }); tick();
ok(d().phases[0] === 'exorcised', '🔥 the exorcism plays');
run(8000, 200);
ok(d().curses === 0, 'the finished curse is cleared away');
ok(rival.edge.material.emissive.getHex() === edgeWas, '⚠️ and the rival\'s edge is EXACTLY its old colour');
ok(root.children.length === 0, 'nothing left in the arena');

section('4 · the rules running ahead of the picture');
stage.update({ instruments: [{ roninId: 'R', color: '#4488ff', strings: ['♭2', '4', '♭7'] }] }); tick();
const fast = { ...cast, key: 'R>Q@9', targetId: 'Q' };
stage.update({ instruments: [], curses: [fast] }); tick();
// A bot rival finishes BOTH cursed turns while the cast is still on screen.
stage.update({ curses: [{ ...fast, turnsLeft: 0, roninId: null, ended: 'expired' }] }); tick();
ok(d().phases[0] === 'cast', '⚠️ an early expiry waits — the cast is not cut short');
run(plan.total + 200);
run(400);
ok(d().phases[0] === 'expired', '…then the countdown plays out and it expires');

section('5 · late arrivals');
const s2 = createShamisenStage({ root: new THREE.Group(), standee: id => standees[id] ?? null, now: () => clock });
s2.update({ curses: [{ key: 'old', roninId: 'R', targetId: 'T', ivs: [], turnsLeft: 0, ended: 'expired' }] });
ok(s2.diagnostics().curses === 0, 'an ENDED curse this stage never saw is history, not a show');
s2.update({ curses: [{ ...cast, key: 'live' }] });
ok(s2.diagnostics().curses === 1, 'a live curse it never saw cast is drawn as it stands…');
s2.tick(clock / 1000, {});
ok(s2.diagnostics().phases[0] === 'cursed', '…already cursed, without replaying the cast');
const s3 = createShamisenStage({ root: new THREE.Group(), standee: id => standees[id] ?? null, now: () => clock });
s3.update({ instruments: [{ roninId: 'R', color: '#fff', strings: ['♭2', '4', '♭7'] }] });
s3.update({ instruments: [] });                      // ⚠️ the two sheet writes landing in two frames
s3.update({ curses: [{ ...cast, key: 'split' }] });
s3.tick(clock / 1000, {});                           // a late draw would jump straight to 'cursed' here
ok(s3.diagnostics().phases[0] === 'cast', '⭐ a curse arriving a frame after his instrument left still finds it, and still plays the cast');
s3.update({ instruments: [{ roninId: 'R', color: '#fff', strings: [] }] });
ok(s3.diagnostics().instruments === 1 && s3.diagnostics().curses === 1, 'he can take it up again while the old curse still burns — separate strings');
s2.dispose(); s3.dispose(); stage.dispose();
ok(rival.edge.material.emissive.getHex() === edgeWas && other.edge.material.emissive.getHex() === 0xffcc00, 'disposing puts every rival back as found');
void light;

console.log(`\ncursedShamisenArena: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
