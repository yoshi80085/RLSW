// 💎 test:lostchords — the Lost Chords as crystals (board/lostChords.js, audio/lostChordSfx.js).
// Alex's dial-in 2026-10-08 (4 of 44 levers), the clocks, the diff that names
// each moment, the game wiring (two canvases, the light pool, the pickup that
// waits for the standee), the frame, and the client's three touch points.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  LOST_CHORD_LOOK as L, LIGHT_POOL, idlePose, spawnPhase, driftPhase, pickupPhase, scatterPoint,
  planLostChordMoments, createLostChords, createLostChordLayer, noteLabel, noteFreq,
} from './lostChords.js';
import { pluckFreq, NOTE_PCS } from '../audio/lostChordSfx.js';
import { arenaFrame } from './arenaFrame.js';
import { HEX_BY_NUM } from './hexMap.js';
import { STANDEE } from './standee.js';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const near = (a, b, m, e = 1e-9) => ok(Math.abs(a - b) <= e, `${m} (${a} vs ${b})`);
const pointFor = (num, h = 0.18) => { const x = HEX_BY_NUM[num]; return x ? new THREE.Vector3((x.px - 3255) / 200, h, (x.py - 2415) / 200) : null; };
const src = p => readFileSync(new URL(p, import.meta.url), 'utf8');

// ── §1 the dial-in ───────────────────────────────────────────────────────────
{
  // ⭐ What Alex moved (and only that): a drift here is a port nobody asked for.
  eq([L.size, L.stretch, L.embedded, L.letterGlow], [0.44, 2.15, 6, 1.7], 'the four levers Alex moved are his numbers');
  eq([L.shape, L.hoverY, L.letter, L.spawnStyle, L.boltColor, L.hum, L.humVoice, L.pluck, L.neutral],
    ['shard', 0.62, 'inside', 'below', 'riven', 'reach', 'glass', 'spirit', '#7fe0ff'], 'the switches he kept');
  eq([L.drive, L.sustain], ['#ff6644', '#44aaff'], 'hunt colours are the game\'s Drive / Sustain');
  eq([L.spawnMs, L.driftMs, L.scatterMs, L.pickupMs, L.light, L.letterSize, L.letterBack], [1500, 1700, 950, 1250, 2.2, 0.7, 0.7], 'timings and the rest of the kept defaults');
  ok(Object.isFrozen(L), 'the look is frozen (the page copies it, never edits it)');
  eq(noteLabel('F#'), 'F♯', 'sharps print as ♯'); eq(noteLabel('Bb'), 'B♭', 'flats print as ♭'); eq(noteLabel('A'), 'A', 'naturals untouched');
  near(noteFreq('A', 4), 440, 'A4 = 440');
  // ⚠️ The pickup note keeps the client's old register (PC_FREQ_BASE is C4 → B4).
  near(pluckFreq('A'), 440, 'pluck A = A4', 1e-6); near(pluckFreq('C'), 261.63, 'pluck C = C4', 0.01); near(pluckFreq('B'), 493.88, 'pluck B = B4', 0.01);
  const mono = src('../rlsw-simulator-v3_8_1.jsx');
  const base = mono.match(/const PC_FREQ_BASE = \[([\s\S]*?)\];/)[1].match(/\d+\.\d+/g).map(Number);
  const idx = Object.fromEntries([...mono.match(/const NOTE_FREQS = \{([\s\S]*?)\};/)[1].matchAll(/'([A-G][#b]?)':(\d+)/g)].map(m => [m[1], Number(m[2])]));
  ok(Object.keys(NOTE_PCS).every(k => Math.abs(pluckFreq(k) - base[idx[k]]) < 0.01),
    'pluckFreq agrees with the monolith\'s PC_FREQ_BASE for every pitch class');
}

// ── §2 the clocks ────────────────────────────────────────────────────────────
{
  const ys = [...Array(50).keys()].map(i => idlePose(L, i * 0.13, 47).y);
  ok(ys.every(y => Math.abs(y - L.hoverY) <= L.bobAmp + 1e-9), 'the float stays within bobAmp of hoverY');
  ok(Math.max(...ys) - Math.min(...ys) > L.bobAmp, 'and does bob');
  ok(idlePose(L, 1, 47).y !== idlePose(L, 1, 48).y, 'two hexes never bob in step');
  const r = [0, 2, 7].map(t => idlePose(L, t, 47, true));
  ok(r.every(p => p.y === L.hoverY && p.pulse === 1 && p.yaw === r[0].yaw), 'reduced motion: still, no breath, no spin');
  for (const style of ['below', 'sky', 'grow']) {
    const a = spawnPhase(0, style), z = spawnPhase(1, style);
    ok(a.grow < 0.05 && a.letter === 0, `${style}: starts with no crystal and no note`);
    ok(Math.abs(z.grow - 1) < 1e-9 && z.letter === 1 && z.crack === 1, `${style}: ends grown, cracked, lettered`);
    ok([...Array(21).keys()].every(i => spawnPhase(i / 20, style).bolt === 0) === (style === 'grow'), `${style}: lightning ${style === 'grow' ? 'never' : 'at some point'}`);
  }
  ok(Math.max(...[...Array(41).keys()].map(i => spawnPhase(i / 40, 'below').grow)) > 1, 'the crystal overshoots as it grows (a pop)');
  const d0 = driftPhase(0), d1 = driftPhase(1);
  ok(d0.out === 1 && d0.in === 0 && d1.out === 0 && Math.abs(d1.in - 1) < 1e-9, 'drift: the old one dissolves, the new one forms');
  ok(driftPhase(0.5).streamVis > 0.9, '…and mid-drift the motes are streaming');
  const pk = [0, 0.2, 0.33, 0.35, 0.8, 1].map(pickupPhase);
  ok(!pk[0].shattered && !pk[2].shattered && pk[3].shattered, 'pickup: whole until a third of the way, then it breaks');
  ok(pk[2].lift > 0.99, '⚠️ it is fully over his head BEFORE it breaks (a floor-level shatter hid behind the standee)');
  ok(!pk[3].handoff && pk[4].handoff, 'the note rises, then is handed on');
  const from = { x:0, y:1.7, z:0 }, to = { x:3, y:0.25, z:1 };
  const s0 = scatterPoint(from, to, 0, L), sL = scatterPoint(from, to, 0.78, L), s1 = scatterPoint(from, to, 1, L);
  near(s0.x, 0, 'scatter leaves the hit Spirit'); ok(sL.landed && sL.x === 3 && s1.landed, 'and lands on its hex');
  near(s1.y, to.y + L.hoverY, 'then floats up to its float height', 1e-6);
  ok(Math.max(...[...Array(20).keys()].map(i => scatterPoint(from, to, i / 25, L).y)) > from.y, 'it arcs up first');
}

// ── §3 naming the moments ────────────────────────────────────────────────────
{
  const P = planLostChordMoments;
  const M = o => new Map(Object.entries(o).map(([k, v]) => [Number(k), typeof v === 'string' ? { note:v, claim:null } : v]));
  eq(P(null, [{ num:5, note:'A' }, { num:9, note:'C', claim:'drive' }]).map(o => o.op), ['place', 'place'], 'the first frame PLACES (no replayed round end)');
  eq(P(M({ 5:'A' }), [{ num:5, note:'A' }]), [], 'nothing changed → nothing happens');
  eq(P(M({ 5:'A' }), [{ num:5, note:'A' }, { num:40, note:'G' }]), [{ op:'spawn', num:40, note:'G', claim:null }], 'a new token is a round-end spawn');
  eq(P(M({ 20:'E' }), [{ num:30, note:'E' }], { drifted:{ moved:[{ from:20, to:30 }] } }).map(o => o.op), ['drift'], 'the engine\'s drift pair is a drift');
  eq(P(M({ 20:'E' }), [{ num:30, note:'F' }], { drifted:{ moved:[{ from:20, to:30 }] } }).map(o => o.op).sort(), ['shatter', 'spawn'], '…but only when the note matches');
  eq(P(M({ 20:'E' }), [{ num:30, note:'E' }]).map(o => o.op).sort(), ['shatter', 'spawn'], 'no drift note → no invented drift');
  eq(P(M({ 47:'A' }), [], { standing:new Map([[47, 'ronin']]) }), [{ op:'pickup', num:47, note:'A', spiritId:'ronin' }], 'gone from under a Spirit → a pickup by that Spirit');
  eq(P(M({ 47:'A' }), []).map(o => o.op), ['shatter'], 'gone from an empty hex → it just shatters');
  const t = P(M({}), [{ num:76, note:'B' }], { thrashed:{ added:[76] }, standing:new Map([[75, 'glam']]) });
  eq(t, [{ op:'scatter', num:76, note:'B', claim:null, fromHex:75 }], 'a Thrash token bursts off the Spirit next to it');
  eq(P(M({}), [{ num:76, note:'B' }], { thrashed:{ added:[76] } }).map(o => o.op), ['spawn'], 'no Spirit beside it → a spawn, never a burst from nowhere');
  eq(P(M({}), [{ num:76, note:'B' }], { thrashed:{ added:[76] }, standing:new Map([[1, 'far']]) }).map(o => o.op), ['spawn'], '…nor from a Spirit across the board (only one within 2 hexes was hit)');
  // ⚠️ `lastThrashTokens` stays on the state long after its Thrash.
  eq(P(M({ 76:'B' }), [{ num:76, note:'B' }], { thrashed:{ added:[76] }, standing:new Map([[75, 'glam']]) }), [], 'a STALE Thrash note never replays a scatter');
  eq(P(M({ 5:{ note:'A', claim:null } }), [{ num:5, note:'A', claim:'sustain' }]), [{ op:'claim', num:5, claim:'sustain' }], 'the hunt colour follows the acting Spirit');
  eq(P(M({ 5:'A' }), [{ num:5, note:'C' }]).map(o => o.op).sort(), ['shatter', 'spawn'], 'a different note on the same hex is a new token');
  eq(P(M({}), [{ num:999, note:'A' }, { num:5 }, { note:'A' }]).length, 1, 'malformed tokens are dropped (only the 999 on no hex survives the plan, and the layer skips it)');
}

// ── §4 the three half: crystals, two canvases, the light pool ────────────────
{
  const root = new THREE.Scene(), top = new THREE.Scene();
  const lc = createLostChords(root, { pointFor, floatRoot:top });
  const lights = () => { let k = 0; root.traverse(o => { if (o.isLight) k++; }); return k; };
  eq(lights(), LIGHT_POOL + 1, 'the light pool (and the one spawn flash) is built up front');
  const t = lc.place(47, 'A', 'drive');
  ok(top.getObjectByName('Lost Chord crystal A @47'), 'the crystal floats in the FOREGROUND root (above the SVG)');
  ok(root.getObjectByName('Lost Chord A @47') && !root.getObjectByName('Lost Chord crystal A @47'), 'its floor stays on the arena canvas');
  let litNow = 0; root.traverse(o => { if (o.isLight && o.intensity > 0) litNow++; });
  eq(litNow, 1, 'it borrows one light');
  for (const [i, num] of [28, 39, 84, 45, 66, 57, 58, 59, 60].entries()) lc.spawn(num, ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C#', 'D#'][i]);
  eq(lights(), LIGHT_POOL + 1, '⚠️ the light COUNT never changes, spawn flashes included (a new light recompiles the whole arena)');
  lc.update(0.01); let busy = 0; root.traverse(o => { if (o.isLight && o.userData.busy) busy++; });
  eq(busy, LIGHT_POOL, 'more crystals than lights: the pool fills and the rest go unlit');
  lc.setClaim(47, 'sustain');
  ok(t.parts.claimRing && t.parts.claimRing.material.color.b > t.parts.claimRing.material.color.r, 'a claim change re-colours to Sustain blue');
  eq(t.parts.embedded.length, 6, 'six shards stuck in the crack (Alex: embedded 6)');
  ok(t.parts.letter?.isSprite && t.parts.letter.material.depthTest !== false, 'the note is a camera-facing sprite, depth-tested (a standee in front still hides it)');
  lc.clear();
  eq(top.children[0].children.length, 0, 'clear empties the foreground'); eq(lights(), LIGHT_POOL + 1, '…and keeps the pool');
  let lit = 0; root.traverse(o => { if (o.isLight && (o.intensity > 0 || o.userData.busy)) lit++; }); eq(lit, 0, '…dark and returned');
  lc.dispose(); eq([root.children.length, top.children.length], [0, 0], 'dispose leaves both roots empty');
}

// ── §5 the game wiring: the pickup waits for the standee ─────────────────────
{
  const root = new THREE.Scene(), top = new THREE.Scene();
  const layer = createLostChordLayer(root, { pointFor, floatRoot:top, sound:false });
  layer.update({ tokens:[{ num:47, note:'A', claim:'drive' }, { num:28, note:'D' }] }, [{ id:'r', num:37 }]);
  layer.tick(0); eq(layer.diagnostics().tokens.sort(), [28, 47], 'the board places');
  eq(layer.active(), 0, 'placing is not a moment');
  layer.update({ tokens:[{ num:28, note:'D' }] }, [{ id:'r', num:47 }]);
  const pawn = new THREE.Group(); pawn.position.copy(pointFor(37, 0.2)); const pawns = new Map([['r', pawn]]);
  layer.tick(100, { pawns }); layer.tick(400, { pawns });
  eq(layer.diagnostics().pending, [47], 'the step is taken, but the crystal waits while the standee hops');
  ok(layer.active() > 0, '…and the reduced-motion loop keeps drawing while it waits');
  pawn.position.copy(pointFor(47, 0.2)); layer.tick(500, { pawns });
  eq([layer.diagnostics().pending, layer.diagnostics().tokens], [[], [28]], 'the standee lands → it lifts and breaks');
  for (let t = 500; t <= 500 + L.pickupMs + 50; t += 50) layer.tick(t, { pawns });
  eq(layer.active(), 0, 'and is gone after pickupMs');
  // a pickup with no pawn to watch (a smoke-hidden Spirit, the Ronin's double)
  layer.update({ tokens:[] }, [{ id:'r', num:28 }]); layer.tick(2000, { pawns:new Map() });
  eq(layer.diagnostics().pending, [28], 'no pawn: it waits a beat…'); layer.tick(2500, { pawns:new Map() });
  eq(layer.diagnostics().pending, [], '…then breaks anyway');
  // a standee that never arrives
  layer.update({ tokens:[{ num:40, note:'G' }] }, []); layer.tick(5000, { pawns });
  layer.update({ tokens:[] }, [{ id:'r', num:40 }]); layer.tick(5100, { pawns }); layer.tick(7700, { pawns });
  eq(layer.diagnostics().pending, [], 'a standee that never lands still lets it break (2.5 s)');
  // no frame → nothing changes
  layer.update({ tokens:[{ num:28, note:'D' }] }); layer.tick(9000); layer.update(null); layer.tick(9100);
  ok(layer.diagnostics().tokens.includes(28), 'a frame with no lostChords leaves the board alone');
  layer.dispose(); eq([root.children.length, top.children.length], [0, 0], 'dispose cleans both roots');
}

// ── §6 the frame ─────────────────────────────────────────────────────────────
{
  const f = arenaFrame({ spirits:[], lostChords:{ tokens:[{ num:5, note:'A', claim:'drive' }, { num:'x' }, { num:6 }],
    drifted:{ moved:[{ from:1, to:2, extra:1 }] }, thrashed:{ added:[3] }, hover:5, tones:{ r:{ voice:'ronin' } } } });
  eq(f.lostChords.tokens, [{ num:5, note:'A', claim:'drive' }], 'the frame keeps well-formed tokens only');
  eq(f.lostChords.drifted, { moved:[{ from:1, to:2 }] }, 'drift pairs copied');
  eq([f.lostChords.thrashed, f.lostChords.hover, f.lostChords.tones.r.voice], [{ added:[3] }, 5, 'ronin'], 'thrash, hover and tones pass through');
  eq(arenaFrame({ spirits:[] }).lostChords, null, 'no lostChords in → null out (the layer leaves the board alone)');
}

// ── §7 the client's three touch points, and one copy of the look ─────────────
{
  const mono = src('../rlsw-simulator-v3_8_1.jsx'), vp = src('../ui/BoardViewport.jsx'), vis = src('./arenaVisuals.js'), ren = src('./arenaRenderer.js');
  ok(/data-arena-flat="lost-chord"/.test(mono) && /\[data-arena-flat="lost-chord"\][^{]*\{ display:none; \}/.test(vp), 'in 3D the flat SVG chip is hidden (the crystal replaces it)');
  ok(/claim:actingNoteState \? \(unlockClaim\(actingNoteState, tok\.note, acting\?\.id\)\?\.which/.test(mono), 'the crystal\'s hunt colour is the 2D chip\'s own `unlockClaim` call');
  ok(/if \(!arenaPlaysIt\) playNoteSound\(tok\.note/.test(mono), 'the client\'s pickup pluck stands down while the 3D arena plays it (no double note)');
  ok(/createLostChordLayer\(root,\{pointFor:arenaPoint,floatRoot:foregroundScene/.test(vis), 'arenaVisuals floats the crystals on the foreground scene');
  ok(/lostChords\.tick\(time\*1000,\{reduced,pawns\}\)/.test(vis) && /lostChords\.dispose\(\)/.test(vis), 'it ticks them with the pawns and disposes them');
  ok(/stats\.lostChords>0/.test(ren), 'the reduced-motion loop draws while a moment plays');
  const page = src('../../.scratch/lost-chord-preview.js');
  ok(/from '\.\.\/src\/board\/lostChords\.js'/.test(page) && /from '\.\.\/src\/audio\/lostChordSfx\.js'/.test(page), 'the dial-in page imports the GAME\'s files (one copy of the look)');
  ok(!/LOST_CHORD_LOOK = Object\.freeze/.test(page), '…and keeps no look of its own');
  ok(STANDEE.height > 2, 'the pickup rises over a standee of real height');
}

console.log(`✅ test:lostchords — ${n} checks`);
