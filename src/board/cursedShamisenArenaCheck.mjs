// ─── 🎸 the Iwato curse's ARENA STAGE — `cursedShamisenArena.js` (v3) ────────
// Part of `npm run test:cursedshamisen`. Drives the stage with the frames the
// client really sends (`iwatoCurse.js` curseScene → `arenaFrame` → here) on an
// injected clock, against stand-in standees, and checks it plays each moment
// once, in order, and leaves the rival exactly as it found them.
// ⭐ v3 "the trap" (2026-10-09): there is no instrument any more — a curse
// SPRINGS on its Lost Chord's hex (`fromHex`, anchored with `pointFor`) and its
// three ghosts are the haunted notes; each lift (`lifted`) burns one.
import * as THREE from 'three';
import { createShamisenStage } from './cursedShamisenArena.js';
import { CURSED_SHAMISEN, planCast, CURSE_TURNS, HAUNTED_NOTES } from './cursedShamisen.js';
import { NOROI_CARD, NOROI_SPRING_CAST_DELAY_MS, ashPlan } from './noroiCard.js';

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
const pointFor = num => new THREE.Vector3(num, 0.18, -num);
let clock = 1000;
const root = new THREE.Group();
const stage = createShamisenStage({ root, standee: id => standees[id] ?? null, pointFor, castDelayMs: 0, now: () => clock });
const tick = (ms = 16) => { clock += ms; return stage.tick(clock / 1000, {}); };
const run = (ms, step = 50) => { let out; for (let t = 0; t < ms; t += step) out = tick(step); return out; };
const d = () => stage.diagnostics();
const plan = planCast(CURSED_SHAMISEN, [1, 6, 10]);
const edgeWas = rival.edge.material.emissive.getHex();

section('1 · nothing to draw until a curse springs (the trap is hidden)');
stage.update({ instruments: [], curses: [] });
ok(d().curses === 0 && root.children.length === 0, 'an armed trap puts nothing in the arena');
ok(!stage.busy, 'and the stage is idle');

section('2 · the spring plays on the cursed hex');
const sprung = { key: 'R#4>T@9', roninId: 'R', color: '#4488ff', targetId: 'T', fromHex: 17, ivs: [1, 6, 10], lifted: 0, turnsLeft: CURSE_TURNS, ended: null };
stage.update({ instruments: [], curses: [sprung] });
ok(d().curses === 1 && d().phases[0] === 'cast', '⭐ a new curse key: the cast plays');
ok(root.children.some(c => c.isGroup && c.position.x === 17 && c.position.z === -17), '…anchored ON the trapped Lost Chord\'s hex');
const hush = run(plan.phraseStart + 600);
ok(hush.dim > 0.2, `the arena hushes as the ghost shamisen plays (dim ${hush.dim.toFixed(2)})`);
run(plan.total);
ok(d().phases[0] === 'cursed', 'the spring lands and the rival is cursed');
ok(rival.edge.material.emissive.getHex() !== edgeWas, 'their neon edge has turned');
ok(tick().dim === 0, '…and the world comes back up');
stage.update({ curses: [sprung] });
ok(d().curses === 1 && d().phases[0] === 'cursed', 'the same curse in the next frame is not cast again');

section('3 · the lifts and the full lift');
stage.update({ curses: [{ ...sprung, lifted: 1 }] }); tick();
ok(d().lifted[0] === 1 && d().phases[0] === 'cursed', 'a lifted note burns one ghost — still cursed');
stage.update({ curses: [{ ...sprung, lifted: 1, turnsLeft: 2 }] }); tick();
ok(d().lifted[0] === 1, 'a turn passing burns nothing (v3: the ghosts are the notes, not the turns)');
stage.update({ curses: [{ key: sprung.key, roninId: null, targetId: 'T', fromHex: null, ivs: [], lifted: 3, turnsLeft: 0, ended: 'exorcised' }] });
run(200);
ok(d().lifted[0] === HAUNTED_NOTES && d().phases[0] === 'exorcised', '🔥 the last ghosts burn, then the paper lifts');
run(8000, 200);
ok(d().curses === 0, 'the finished curse is cleared away');
ok(rival.edge.material.emissive.getHex() === edgeWas, '⚠️ and the rival\'s edge is EXACTLY its old colour');
ok(root.children.length === 0, 'nothing left in the arena (the hex anchor too)');

section('4 · the rules running ahead of the picture');
const fast = { ...sprung, key: 'R#7>Q@12', targetId: 'Q', fromHex: 22 };
stage.update({ curses: [fast] }); tick();
// A bot rival lifts one AND runs out of turns while the spring is still on screen.
stage.update({ curses: [{ ...fast, roninId: null, lifted: 1, turnsLeft: 0, ended: 'expired' }] }); tick();
ok(d().phases[0] === 'cast', '⚠️ an early expiry waits — the spring is not cut short');
run(plan.total + 200);
run(400);
ok(d().lifted[0] === 1 && d().phases[0] === 'expired', '…then the lift plays, then it expires');

section('5 · late arrivals and hidden targets');
const s2 = createShamisenStage({ root: new THREE.Group(), standee: id => standees[id] ?? null, pointFor, castDelayMs: 0, now: () => clock });
s2.update({ curses: [{ key: 'old', roninId: 'R', targetId: 'T', ivs: [], lifted: 0, turnsLeft: 0, ended: 'expired' }] });
ok(s2.diagnostics().curses === 0, 'an ENDED curse this stage never saw is history, not a show');
s2.update({ curses: [{ ...sprung, key: 'live', lifted: 1, turnsLeft: 2 }] });
s2.tick(clock / 1000, {});
ok(s2.diagnostics().phases[0] === 'cursed', 'a curse already part-way through is drawn as it stands, without replaying the spring');
const s3 = createShamisenStage({ root: new THREE.Group(), standee: id => standees[id] ?? null, pointFor, castDelayMs: 0, now: () => clock });
s3.update({ curses: [{ ...sprung, key: 'smoke', targetId: null }] });
ok(s3.diagnostics().curses === 0, 'a target hidden in smoke: nothing yet…');
s3.update({ curses: [{ ...sprung, key: 'smoke' }] });
ok(s3.diagnostics().curses === 1 && s3.diagnostics().phases[0] === 'cast', '…and the spring plays once they can be seen');
const s4 = createShamisenStage({ root: new THREE.Group(), standee: id => standees[id] ?? null, castDelayMs: 0, now: () => clock });
s4.update({ curses: [{ ...sprung, key: 'nohex' }] });
ok(s4.diagnostics().curses === 1, 'no `pointFor` (or no hex): it springs on the rival themself');
// ═══ 6. 🪤 the noroi card (rules 17–18, Alex's dial-in 2026-10-09) ═════════
section('6 · the noroi card: thrown, stuck, sprung — on his seat only');
// A stand-in for the Lost Chords: where each crystal floats, and the claims the ash borrows.
const claims = new Map([[30, null], [31, 'drive']]), claimLog = [];
const crystals = { floatAt: n => claims.has(n) ? new THREE.Vector3(n, 0.82, -n) : null, tokens: () => [...claims].map(([num, claim]) => ({ num, claim })),
  setClaim: (n, c) => { if (claims.has(n) && claims.get(n) !== c) { claims.set(n, c); claimLog.push(`${n}:${c}`); } } };
const fg = new THREE.Group();
const s5 = createShamisenStage({ root: new THREE.Group(), floatRoot: fg, standee: id => standees[id] ?? null, pointFor, crystals, now: () => clock });
const t5 = (ms = 16) => { clock += ms; return s5.tick(clock / 1000, {}); };
const run5 = (ms, step = 50) => { for (let k = 0; k < ms; k += step) t5(step); };
const card5 = () => s5.diagnostics().cards;
s5.update({ curses: [] });
ok(card5().length === 0 && fg.children.length === 0, 'a Rival\'s frame (no `trap`): no card, nothing drawn');
const TRAP = { key: 'R#9', hexNum: 30, note: 'D', roninId: 'R' };
s5.update({ curses: [], trap: TRAP }); t5();
ok(card5().length === 1 && card5()[0].phase === 'lay' && card5()[0].shown, '⭐ his own trap appears: the card is THROWN from his standee');
run5(NOROI_CARD.layMs + 100);
ok(card5()[0].phase === 'armed', '…and sticks to the crystal (armed)');
s5.update({ curses: [] }); t5();
ok(card5().length === 1 && !card5()[0].shown, 'hot-seat: the next seat\'s frame has no trap — the card is hidden, not dropped');
s5.update({ curses: [], trap: TRAP }); t5();
ok(card5()[0].shown && card5()[0].phase === 'armed', '…and back (no second throw) when his seat is on again');
const SPRUNG = { key: 'R#9>T@3', roninId: 'R', color: '#4488ff', targetId: 'T', fromHex: 30, ivs: [1, 6, 10], lifted: 0, turnsLeft: CURSE_TURNS, ended: null };
s5.update({ curses: [SPRUNG] }); t5();
ok(s5.diagnostics().phases[0] === 'waiting', '⏱ the step: the ghost shamisen waits for the hop and the shatter');
ok(card5()[0].phase === 'armed' && card5()[0].shown, '…and the card stays on his screen meanwhile (no flicker)');
run5(300);
ok(card5()[0].phase === 'armed', 'no shatter yet (the standee is still hopping): the card waits');
s5.onShatter(30, new THREE.Vector3(30, 0.82, -30)); t5();
ok(card5()[0].phase === 'spring', '⭐ the crystal shatters: the card comes out of it');
run5(NOROI_SPRING_CAST_DELAY_MS);
ok(s5.diagnostics().phases[0] === 'cast', `⏱ the cast starts ${NOROI_SPRING_CAST_DELAY_MS} ms after the step — when the client's sound does`);
run5(planCast(CURSED_SHAMISEN, [1, 6, 10]).slapAt + 200, 100);
ok(card5().length === 0, '⭐ the card lands on the Rival at the slap and hands over to the curse\'s charm');
ok(fg.children.filter(c => c.name === 'Noroi card').length === 0, '…and is gone from the foreground');

section('7 · the ash — public, on every seat (rule 18)');
const s6 = createShamisenStage({ root: new THREE.Group(), floatRoot: fg, standee: id => standees[id] ?? null, pointFor, crystals, now: () => clock });
const t6 = (ms = 16) => { clock += ms; return s6.tick(clock / 1000, {}); };
const card6 = () => s6.diagnostics().cards;
s6.update({ curses: [], ashes: [{ key: 'OLD~wasted', trapKey: 'OLD', hexNum: 30, roninId: 'R', how: 'wasted' }] }); t6();
ok(card6().length === 0, 'an ash this stage never saw happen (a late join) is history, not a show');
const T2 = { key: 'R#10', hexNum: 31, note: 'G', roninId: 'R' };
s6.update({ curses: [], trap: T2, ashes: [{ key: 'OLD~wasted', trapKey: 'OLD', hexNum: 30, roninId: 'R', how: 'wasted' }] });
for (let k = 0; k < 60; k++) t6(20);
s6.update({ curses: [], ashes: [{ key: 'R#10~wasted', trapKey: 'R#10', hexNum: 31, roninId: 'R', how: 'wasted' }] }); t6();
ok(card6().length === 1 && card6()[0].phase === 'ash', '⭐ his next turn start: HIS card burns (no second card)');
const P = ashPlan(NOROI_CARD, { seen: true });
for (let k = 0; k < (P.burnAt + 200) / 50; k++) t6(50);
ok(claimLog.includes('31:cursed'), '⭐ the crystal glows violet under the burning card — for every seat');
for (let k = 0; k < (NOROI_CARD.burnMs * 0.85) / 50; k++) t6(50);
ok(claims.get(31) === 'drive', '…fading back to ITS OWN colour as the card burns away (a hunt crystal stays a hunt crystal)');
for (let k = 0; k < (P.done - P.burnAt) / 50 + 4; k++) t6(50);
ok(card6().length === 0, 'burnt to ash, the card is gone');
ok(claims.get(31) === 'drive', '…and the crystal is itself again (its hunt colour put back exactly)');
const s7 = createShamisenStage({ root: new THREE.Group(), floatRoot: fg, standee: id => standees[id] ?? null, pointFor, crystals, now: () => clock });
s7.update({ curses: [] });
s7.update({ curses: [], ashes: [{ key: 'R#11~wasted', trapKey: 'R#11', hexNum: 30, roninId: 'R', how: 'wasted' }] }); s7.tick(clock / 1000, {});
ok(s7.diagnostics().cards.length === 1 && s7.diagnostics().cards[0].phase === 'ash', 'a Rival\'s seat never saw the card: it appears, then burns');
s7.update({ curses: [], ashes: [{ key: 'R#11~wasted', trapKey: 'R#11', hexNum: 30, roninId: 'R', how: 'wasted' }] }); s7.tick(clock / 1000, {});
ok(s7.diagnostics().cards.length === 1, 'the same ash in the next frame is not burnt twice');
s5.dispose(); s6.dispose(); s7.dispose();
ok(fg.children.length === 0, 'disposing leaves nothing on the foreground');

s2.dispose(); s3.dispose(); s4.dispose(); stage.dispose();
ok(rival.edge.material.emissive.getHex() === edgeWas && other.edge.material.emissive.getHex() === 0xffcc00, 'disposing puts every rival back as found');
void ronin;

console.log(`\ncursedShamisenArena: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
