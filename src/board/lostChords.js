// 💎 LOST CHORD CRYSTALS — the board's notes, grown out of the stage in 3D.
//
// Alex, 2026-10-08: *"Lets make the notes on the board 3D - Do you have a good
// idea to integrate them with the environment?"* → the crystal pitch → *"the
// crystal idea sounds great, lets see it in the preview"*.
//
// 🎯 THE STORY IS ALREADY IN THE GAME'S OWN WORDS. The round-end log line reads
// *"The stage resonates — N Lost Chords crystallise from the harmonic
// interference!"* (`rlsw-simulator-v3_8_1.jsx`, TOKENS_SCATTERED). This module
// takes that literally: each Lost Chord is a crystal that GROWS out of a
// glowing crack in the stone, hums its own pitch, and shatters into the note
// when a Spirit walks onto it. It also answers IDEAS_INBOX "[P2] Story reason
// for board notes" (2026-09-08).
//
// 📌 WHAT IS SHOWN, per Lost Chord:
//   · on the floor, a CRACK in the hex, lit from inside (a seeded canvas
//     texture, four variants, turned per hex so no two read the same);
//   · optional small shards stuck in the crack (`embedded`) — the cluster;
//   · above it, the CRYSTAL: a faceted quartz shard (lathe, 6 sides, flat
//     shaded), a see-through body, glowing edges and a brighter core;
//   · the NOTE LETTER inside it, as a sprite, so it always faces the lens and
//     still reads from the top-down view;
//   · a small point light, so the crystal lights the stone around it —
//     that is most of what makes it sit IN the arena rather than on it;
//   · a few motes orbiting it.
// 🔓 THE HUNT COLOUR IS TODAY'S RULE, NOT A NEW ONE. `claim` is what the client's
// `unlockClaim(actingNoteState, tok.note, acting.id)` answers ('drive' /
// 'sustain' / null). The crystal and its crack turn Drive red or Sustain blue,
// the hex lights (as `UNLOCK_GLOW` does in 2D) and the crystal grows by `bump`.
// The page feeds `claim` by hand; the port must feed it from that one function.
//
// 🎬 THE MOMENTS (one per engine event that touches a Lost Chord):
//   · spawn   — TOKENS_SCATTERED (round end): lightning finds the hex (from the
//               sky, or rising out of the crack like the Riven World's bolts
//               climbing the rock), the crack opens, the crystal grows;
//   · drift   — TOKENS_DRIFTED: it breaks into motes that stream low across
//               the floor and re-form on the new hex;
//   · scatter — THRASH_TOKENS_SPAWNED: shards burst off the Spirit who was
//               hit, arc onto the hexes around them and bounce once;
//   · pickup  — TOKEN_PICKED_UP: it rings, shatters, and the note rises into
//               the Spirit (the page hands it to the HUD stock from there).
//
// ⚠️ IT HAS TO READ WITHOUT BLOOM — Alex runs Auto: Standard (bloom off). The
// edges, core, crack and letter are additive / `toneMapped:false`, past 1.0.
// 🧱 TWO CANVASES. In the game the board's SVG click layer sits ABOVE the arena
// canvas (solidLayer.js), so anything floating over a hex can have a hex tint
// painted across it. The FLOATING half of each Lost Chord (crystal, note,
// motes, the pickup's shards) therefore lives in `floatRoot` — the renderer's
// foreground scene, drawn above the SVG with the standees, sharing their depth
// (so a standee in front still hides it, and the solids' depth pass hides it
// behind an amp). The FLOOR half (crack, hunt hex, embedded shards, the light
// on the stone, the lightning, the drift stream) stays on the arena canvas, the
// way the move tiles do. The preview passes no `floatRoot` and gets one scene.
//
// 📌 THREE PARTS: the pure top (the look, the clocks, `planLostChordMoments`),
// `createLostChords` (the crystals and their moments), and `createLostChordLayer`
// (the game's wiring: arenaFrame's `lostChords` in, moments and sounds out).
//
// ✅ IN THE GAME since 2026-10-08, at Alex's dial-in (4 of 44 levers moved —
// size .44, stretch 2.15, embedded 6, letterGlow 1.7). The dial-in page,
// `.scratch/lost-chord-preview.html`, imports THIS file: one copy of the look.
import * as THREE from 'three';
import { HEX_BY_NUM } from './hexMap.js';
import { axialDist } from './hexGeometry.js';
import { STANDEE } from './standee.js';
import { hum, spawnSound, driftSound, clink, thrashBurst, pickupSound, NOTE_PCS } from '../audio/lostChordSfx.js';
// 🎼 One pitch table, in the sound module (it is the one that plays them).
export { NOTE_PCS, noteFreq } from '../audio/lostChordSfx.js';

// ─────────────────────────────────────────────────────────────────────────────
// PURE TOP
// ─────────────────────────────────────────────────────────────────────────────

/** Every taste call is a lever on the dial-in page. ⭐ THESE ARE ALEX'S DIAL-IN
 *  (2026-10-08, `.scratch/lost-chord-preview.html`): he moved size 0.50 → 0.44,
 *  stretch 2.20 → 2.15, embedded 3 → 6 and letterGlow 1.60 → 1.70; the other 40
 *  are the page's defaults, which he saw and kept. Move a number here → the page
 *  follows (it reads this object). */
export const LOST_CHORD_LOOK = Object.freeze({
  // ── the crystal ──
  shape:'shard',          // 'shard' a quartz point · 'double' pointed both ends · 'gem' an octahedron
  size:0.44,              // the crystal's girth, side to side (world units; a hex is ~1.9 across)
  stretch:2.15,           // height ÷ girth
  hoverY:0.62,            // how high it floats over the floor (0 = standing in the crack)
  tilt:0.12,              // a little lean, so it is not a perfectly upright pillar
  spinS:9,                // seconds a turn (0 = still)
  bobAmp:0.06, bobS:3.2,  // the float
  embedded:6,             // small shards stuck in the crack (0 = off)
  // ── glass and glow ──
  neutral:'#7fe0ff',      // today's token cyan
  drive:'#ff6644', sustain:'#44aaff',
  bodyOpacity:0.38,       // the see-through body
  bodyGlow:0.55,          // its own emissive
  edgeGlow:1.9,           // the facet edges — past 1 so they read without bloom
  coreGlow:1.6,           // the inner core
  pulse:0.22, pulseS:1.6, // the core's breath (today's token pulses at 1.6 s)
  light:2.2, lightRange:2.6,   // the point light on the stone (0 = dark; the pool stays, see `LIGHT_POOL`)
  // ── the note ──
  letter:'inside',        // 'inside' the crystal · 'above' it · 'off'
  letterSize:0.7,
  letterGlow:1.7,
  letterOutline:0.55,     // dark rim around the glyph
  letterBack:0.7,         // a soft dark puck behind the note — what keeps it readable from top-down, over the lit crack
  // ── the floor ──
  floorY:0.2,             // the stone's top (move tiles sit at .2)
  crack:1.0,              // the crack's size (× the hex)
  crackGlow:1.0,
  claimHex:0.32,          // the hunt hex's wash + rim strength (0 = off)
  claimBump:1.15,         // the hunt crystal grows (today's chip grows 1.15)
  motes:5,                // motes orbiting each crystal
  // ── the moments ──
  spawnStyle:'below',     // 'below' bolts rise out of the crack · 'sky' a bolt from the nebula · 'grow' no lightning
  spawnMs:1500,
  boltColor:'riven',      // 'riven' the Riven World's blue/green/violet · 'note' the crystal's own colour · 'white'
  driftMs:1700,
  scatterMs:950, scatterArc:1.8, bounce:0.28,
  pickupMs:1250,
  shards:9,               // pieces it shatters into
  // ── sound ──
  hum:'reach',            // 'reach' + 'hover' · 'hover' only · 'off'
  humVoice:'glass',       // 'glass' · 'bell' · 'sine'
  humVolume:0.5, humOctave:5,
  pluck:'spirit',         // 'spirit' the picker-up's own amp voice · 'glass' · 'off'
  sfxVolume:0.6,
});

/** 'F#' → 'F♯', 'Bb' → 'B♭' (the board's chip prints the ASCII; the crystal can afford the glyph). */
export const noteLabel = n => String(n).replace('#', '♯').replace(/^([A-G])b$/, '$1♭');

/** 💡 Point lights kept for the crystals: the board's dynamic cap tops out at 8
 *  (`TOKEN_BASE_POOL` 10 − 2 Spirits); a Thrash can push past it, and those few go unlit.
 *  Plus ONE more, the spawn flash — so the scene always holds LIGHT_POOL + 1. */
export const LIGHT_POOL = 8;

export const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
export const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const easeOutBack = (x, s = 1.9) => { x = clamp01(x) - 1; return 1 + (s + 1) * x * x * x + s * x * x; };
/** 0..1 of a sub-span [a,b] of a 0..1 clock. */
export const span = (u, a, b) => clamp01((u - a) / Math.max(1e-6, b - a));

/** The idle float, by the clock alone. Deterministic per hex, so two crystals never bob in step. */
export function idlePose(L, tSec, num, reduced = false) {
  const ph = (num * 1.618) % (Math.PI * 2);
  if (reduced) return { y: L.hoverY, yaw: ph, pulse: 1 };
  return {
    y: L.hoverY + (L.bobS > 0 ? Math.sin(tSec * Math.PI * 2 / L.bobS + ph) * L.bobAmp : 0),
    yaw: ph + (L.spinS > 0 ? tSec * Math.PI * 2 / L.spinS : 0),
    pulse: 1 + (L.pulseS > 0 ? Math.sin(tSec * Math.PI * 2 / L.pulseS + ph) * L.pulse : 0),
  };
}

/** The spawn clock → what each piece is doing. `u` 0..1 over `spawnMs`. */
export function spawnPhase(u, style) {
  const lit = style === 'grow' ? 0 : style === 'sky' ? 1 - span(u, 0.08, 0.36) : (u < 0.12 ? 0 : 1 - span(u, 0.42, 0.62));
  const strike = style === 'sky' ? (u < 0.03 ? 0 : 1) : style === 'below' ? span(u, 0.12, 0.3) : 0;
  return {
    bolt: u < 0.03 && style === 'sky' ? 0 : lit * (style === 'grow' ? 0 : 1), // bolt visibility 0..1
    boltGrow: style === 'below' ? strike : 1,  // how far up the rising bolts have climbed
    flash: style === 'grow' ? 0 : Math.max(0, 1 - Math.abs(u - (style === 'sky' ? 0.06 : 0.3)) / 0.12),
    crack: smooth(span(u, style === 'sky' ? 0.06 : 0.0, style === 'sky' ? 0.4 : 0.32)),
    crackFlicker: style === 'grow' ? 0 : (u < 0.45 ? 1 : 0),
    grow: easeOutBack(span(u, style === 'sky' ? 0.24 : 0.34, 0.92)),
    rise: smooth(span(u, 0.3, 0.9)),          // 'below': rises out of the floor
    letter: smooth(span(u, 0.78, 1)),
  };
}

/** The drift clock: dissolve → stream → re-form. */
export function driftPhase(u) {
  return {
    out: 1 - smooth(span(u, 0, 0.3)),         // the old crystal's scale
    stream: span(u, 0.18, 0.78),              // the motes' travel 0..1
    streamVis: Math.min(smooth(span(u, 0.12, 0.25)), 1 - smooth(span(u, 0.8, 0.95))),
    crackOld: 1 - smooth(span(u, 0.1, 0.5)),
    crackNew: smooth(span(u, 0.6, 0.85)),
    in: easeOutBack(span(u, 0.7, 1)),
  };
}

/** A shard's flight from `from` to `to` (plain {x,y,z}): an arc down to the floor, then one bounce up to the float. */
export function scatterPoint(from, to, u, L) {
  const land = 0.78;
  if (u < land) {
    const k = u / land;
    const peak = L.scatterArc;
    return { x: from.x + (to.x - from.x) * k, z: from.z + (to.z - from.z) * k,
      y: from.y + (to.y - from.y) * k + 4 * peak * k * (1 - k), landed: false };
  }
  const k = (u - land) / (1 - land);
  return { x: to.x, z: to.z, y: to.y + Math.sin(k * Math.PI) * L.bounce + (L.hoverY * smooth(k)), landed: true, k };
}

/** The pickup clock: it lifts out of the hex and rings OVER the Spirit's head,
 *  shatters there, and the note rises on into the HUD.
 *  ⚠️ OVERHEAD, NOT ON THE HEX: the picker-up is standing on the crystal's hex,
 *  so a ring-and-shatter at floor height happens BEHIND the standee and nobody
 *  sees it (seen headless 10-08: only the letter showed through his robe). */
export function pickupPhase(u) {
  return {
    lift: smooth(span(u, 0, 0.3)),            // up from its float to over his head
    ring: span(u, 0.12, 0.34),                // swell and flare before it breaks
    shattered: u >= 0.34,
    shards: span(u, 0.34, 0.9),
    wave: span(u, 0.0, 0.45),                 // the floor ring as it leaves the hex
    crack: 1 - smooth(span(u, 0.1, 0.7)),
    noteRise: smooth(span(u, 0.34, 0.72)),
    handoff: u >= 0.72,                       // the page takes the note to the HUD from here
  };
}

/**
 * 🧭 WHAT JUST HAPPENED TO THE LOST CHORDS — the board's tokens last frame vs
 * this frame, turned into the moments to play. Pure, so `test:lostchords` can
 * walk every case without a canvas.
 *
 * ⚠️ IT READS THE DIFF, NOT THE LOG. A token can leave the board four ways
 * (picked up by a Spirit, by the Ronin's double, drifted, a reset) and arrive
 * three (round end, a Thrash, a drift); the engine's `last*` notes are only
 * consulted to NAME a change the diff already found, never to invent one —
 * `lastThrashTokens` survives on the state long after its own Thrash, and a
 * stale note must not replay a scatter.
 *
 * @param prev     Map num → { note, claim } from the last frame, or null on the first
 * @param next     [{ num, note, claim }] — this frame's `boardTokens` (+ the hunt colour)
 * @param drifted  `board.lastTokensDrifted` ({ moved:[{from,to}] }) or null
 * @param thrashed `board.lastThrashTokens` ({ added:[num] }) or null
 * @param standing Map hex → id: every VISIBLE Spirit (and double) on the board
 * @returns [{ op:'place'|'spawn'|'drift'|'scatter'|'pickup'|'shatter'|'claim', … }]
 */
export function planLostChordMoments(prev, next, { drifted = null, thrashed = null, standing = new Map() } = {}) {
  const now = new Map((next ?? []).filter(t => Number.isFinite(t?.num) && t.note).map(t => [t.num, t]));
  // The first frame (a match start, a loaded save, the arena coming up) PLACES:
  // replaying a round end for tokens that have sat there for turns would lie.
  if (!prev) return [...now.values()].map(t => ({ op:'place', num:t.num, note:t.note, claim:t.claim ?? null }));
  const ops = [];
  const gone = [...prev.keys()].filter(n => !now.has(n) || now.get(n).note !== prev.get(n).note);
  const came = [...now.keys()].filter(n => !prev.has(n) || prev.get(n).note !== now.get(n).note);
  const goneSet = new Set(gone), cameSet = new Set(came);
  // 🌀 drift: the engine's own pairs, and only those both halves of the diff agree on
  for (const m of drifted?.moved ?? []) {
    if (goneSet.has(m.from) && cameSet.has(m.to) && prev.get(m.from).note === now.get(m.to).note) {
      ops.push({ op:'drift', from:m.from, to:m.to, note:now.get(m.to).note, claim:now.get(m.to).claim ?? null });
      goneSet.delete(m.from); cameSet.delete(m.to);
    }
  }
  // 🎵 a token gone from under a Spirit is a pickup; from an empty hex, it just shatters
  for (const n of goneSet) {
    const who = standing.get(n);
    ops.push(who != null ? { op:'pickup', num:n, note:prev.get(n).note, spiritId:who } : { op:'shatter', num:n, note:prev.get(n).note });
  }
  // 💥 a Thrash's notes burst off the Spirit standing next to them; anything else is a round end
  const thrash = new Set((thrashed?.added ?? []).filter(n => cameSet.has(n)));
  const fromFor = n => {
    const h = HEX_BY_NUM[n]; if (!h) return null;
    let best = null, bestD = Infinity;
    for (const hex of standing.keys()) {
      const o = HEX_BY_NUM[hex]; if (!o) continue;
      const d = axialDist(h.q, h.r, o.q, o.r);
      if (d >= 1 && d <= 2 && d < bestD) { best = hex; bestD = d; }
    }
    return best;
  };
  for (const n of cameSet) {
    const t = now.get(n), from = thrash.has(n) ? fromFor(n) : null;
    ops.push(from != null ? { op:'scatter', num:n, note:t.note, claim:t.claim ?? null, fromHex:from }
      : { op:'spawn', num:n, note:t.note, claim:t.claim ?? null });
  }
  // 🔓 the hunt colour follows the acting Spirit's seats
  for (const [n, t] of now) if (prev.has(n) && !cameSet.has(n) && (prev.get(n).claim ?? null) !== (t.claim ?? null)) ops.push({ op:'claim', num:n, claim:t.claim ?? null });
  return ops;
}

// ─────────────────────────────────────────────────────────────────────────────
// THREE.JS HALF
// ─────────────────────────────────────────────────────────────────────────────

const RIVEN_BOLTS = [0x279dff, 0x39ff99, 0xa66aff];   // rivenWorld/lightning.js palette
const additive = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent:true, opacity,
  depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });

function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

/** The crystal's profile, turned on a 6-sided lathe so it comes out faceted. Unit girth. */
function crystalGeometry(shape, stretch) {
  if (shape === 'gem') return new THREE.OctahedronGeometry(0.5, 0).scale(1, stretch, 1);
  // ⚠️ The profile is in HALF-widths (radius 0.5), so `size` is the girth side
  // to side and `stretch` really is height ÷ girth. At radius 1 a stretch of 2
  // came out as tall as it was wide: a ball, not a shard (seen headless 10-08).
  const h = stretch;
  const pts = shape === 'double'
    ? [[0, -h * 0.5], [0.8, -h * 0.22], [1, 0], [0.8, h * 0.22], [0, h * 0.5]]
    : [[0, -h * 0.42], [0.62, -h * 0.34], [0.9, -h * 0.1], [1, h * 0.12], [0.86, h * 0.28], [0, h * 0.58]];
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x * 0.5, y)), 6);
  g.computeVertexNormals();
  return g;
}

/** A 2D canvas, or null where there is none (node: the test suites). ⚠️ The
 *  textures then come back blank — the crystals still build, so the geometry,
 *  the clocks and the wiring can be tested without a browser. */
function canvas2d(S) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext?.('2d'); return g ? { c, g } : null;
}
const blank = () => { const t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; return t; };

/** A seeded crack, white on clear, drawn once per variant. */
function crackTexture(seed) {
  const S = 256, cv = canvas2d(S); if (!cv) return blank();
  const { c, g } = cv, r = rng(seed);
  g.translate(S / 2, S / 2); g.lineCap = 'round'; g.lineJoin = 'round';
  const branch = (x, y, ang, len, w, depth) => {
    g.beginPath(); g.moveTo(x, y);
    const steps = 5 + Math.floor(r() * 4);
    for (let i = 0; i < steps; i++) {
      ang += (r() - 0.5) * 0.9; const l = len / steps;
      x += Math.cos(ang) * l; y += Math.sin(ang) * l; g.lineTo(x, y);
      if (depth < 2 && r() < 0.28) { const sx = x, sy = y, sa = ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6);
        g.lineWidth = w; g.stroke(); branch(sx, sy, sa, len * 0.45, w * 0.6, depth + 1); g.beginPath(); g.moveTo(x, y); }
    }
    g.lineWidth = w; g.stroke();
  };
  g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 10; g.strokeStyle = 'rgba(255,255,255,.95)';
  const arms = 6 + Math.floor(r() * 3);
  for (let i = 0; i < arms; i++) branch(0, 0, (i / arms) * Math.PI * 2 + r() * 0.5, S * (0.26 + r() * 0.2), 3.2, 0);
  const core = g.createRadialGradient(0, 0, 0, 0, 0, S * 0.16);
  core.addColorStop(0, 'rgba(255,255,255,.95)'); core.addColorStop(0.4, 'rgba(255,255,255,.35)'); core.addColorStop(1, 'rgba(255,255,255,0)');
  g.shadowBlur = 0; g.fillStyle = core; g.beginPath(); g.arc(0, 0, S * 0.16, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const letterCache = new Map();
function letterTexture(note, outline, raw = false, back = 0) {
  const key = `${note}|${outline}|${raw}|${back}`;
  if (letterCache.has(key)) return letterCache.get(key);
  const S = 128, cv = canvas2d(S);
  if (!cv) { const t = blank(); letterCache.set(key, t); return t; }
  const { c, g } = cv, label = raw ? String(note) : noteLabel(note);
  g.font = `900 ${label.length > 1 ? 70 : 84}px "Share Tech Mono", ui-monospace, "Segoe UI Symbol", monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (back > 0) {
    const pk = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    pk.addColorStop(0, `rgba(3,8,20,${0.92 * back})`); pk.addColorStop(0.55, `rgba(3,8,20,${0.75 * back})`); pk.addColorStop(1, 'rgba(3,8,20,0)');
    g.fillStyle = pk; g.fillRect(0, 0, S, S);
  }
  if (outline > 0) { g.lineWidth = 16 * outline; g.strokeStyle = 'rgba(4,10,24,.92)'; g.lineJoin = 'round'; g.strokeText(label, S / 2, S / 2 + 4); }
  g.fillStyle = '#ffffff'; g.fillText(label, S / 2, S / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  letterCache.set(key, t); return t;
}

/** A jagged bolt from a to b, as a thin additive tube (core) inside a wider one (glow). */
function boltMesh(a, b, color, rand, { width = 0.05, kinks = 14, jitter = 0.35, branches = 2, glow = 3.2 } = {}) {
  const group = new THREE.Group();
  // ⚡ ZIGZAG, NOT WOBBLE: each kink steps to the OTHER side of the line, so it
  // reads as lightning rather than a wavy string (headless 10-08: random
  // offsets on a smooth tube looked like noodles).
  const path = (p, q, n, j) => {
    const pts = [p.clone()], dir = q.clone().sub(p).normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
    const side2 = new THREE.Vector3().crossVectors(dir, side).normalize();
    for (let i = 1; i < n; i++) {
      const k = i / n, base = p.clone().lerp(q, k), env = 0.35 + 0.65 * Math.sin(k * Math.PI);
      base.addScaledVector(side, (i % 2 ? 1 : -1) * j * env * (0.4 + rand() * 0.8));
      base.addScaledVector(side2, (rand() - 0.5) * j * env);
      pts.push(base);
    }
    pts.push(q.clone()); return pts;
  };
  const tube = (pts, w, mat) => {
    const curve = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) curve.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 3, w, 5, false), mat));
  };
  const coreMat = additive(new THREE.Color(0xffffff).multiplyScalar(1.6)), glowMat = additive(new THREE.Color(color).multiplyScalar(1.4), 0.55);
  const main = path(a, b, kinks, jitter);
  tube(main, width, coreMat); tube(main, width * glow, glowMat);
  for (let i = 0; i < branches; i++) {
    const from = main[2 + Math.floor(rand() * (main.length - 5))];
    const to = from.clone().add(new THREE.Vector3((rand() - 0.5) * 2.2, -(0.4 + rand()) * Math.abs(b.y - a.y) * 0.18, (rand() - 0.5) * 2.2));
    const bp = path(from, to, 6, jitter * 0.6);
    tube(bp, width * 0.55, coreMat); tube(bp, width * 1.8, glowMat);
  }
  group.userData.mats = [coreMat, glowMat];
  return group;
}

const disposeTree = o => o.traverse(m => { m.geometry?.dispose?.(); const ms = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
  for (const x of ms) { if (x.map && !x.map.userData?.shared) x.map.dispose(); x.dispose(); } });

/**
 * The Lost Chords in the arena.
 * @param root     a THREE.Group / Scene to live in
 * @param pointFor (num, height) → THREE.Vector3 — `arenaPoint`, so the crystals sit on the real hexes
 * @param L        LOST_CHORD_LOOK (or the page's live copy)
 * @param floatRoot where the floating half lives (the game's foreground scene); defaults to `root`
 */
export function createLostChords(root, { pointFor, L: look = LOST_CHORD_LOOK, floatRoot = root } = {}) {
  let L = { ...look };
  const group = new THREE.Group(); group.name = 'Lost Chords'; root.add(group);
  const fx = new THREE.Group(); fx.name = 'Lost Chord moments'; group.add(fx);
  // 🧱 The floating half (see the header): its own group, in `floatRoot`.
  const tops = new THREE.Group(); tops.name = 'Lost Chord crystals'; floatRoot.add(tops);
  // 💡 A FIXED POOL OF LIGHTS, borrowed and returned. ⚠️ Adding or removing a
  // light in three.js recompiles EVERY lit material in the scene — the whole
  // arena — so a light per crystal would hitch the frame at every round end,
  // drift and pickup. The pool's count never changes; an unused light is dark.
  const lights = Array.from({ length:LIGHT_POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 2.6, 2); l.userData.busy = false; group.add(l); return l;
  });
  const flashLight = new THREE.PointLight(0xffffff, 0, 7, 2); group.add(flashLight);
  const borrowLight = (col, t) => {
    if (L.light <= 0) return null;
    const l = lights.find(x => !x.userData.busy); if (!l) return null;   // more crystals than lights: the rest go unlit
    l.userData.busy = true; l.color.copy(col); l.distance = L.lightRange; l.intensity = L.light;
    l.position.set(t.group.position.x, L.hoverY * 0.7 + 0.15, t.group.position.z); return l;
  };
  const crackTex = [11, 23, 37, 51].map(s => { const t = crackTexture(s); t.userData.shared = true; return t; });
  // a soft round dot, so motes read as sparks rather than square pixels
  const moteTex = (() => { const cv = canvas2d(32); if (!cv) { const t = blank(); t.userData.shared = true; return t; } const { c, g } = cv;
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); t.userData.shared = true; return t; })();
  let bodyGeo = null, edgeGeo = null, coreGeo = null, smallGeo = null;
  const hexRing = new THREE.RingGeometry(0.86, 0.95, 6).rotateX(-Math.PI / 2);
  const hexFill = new THREE.CircleGeometry(0.95, 6).rotateX(-Math.PI / 2);
  const waveGeo = new THREE.RingGeometry(0.82, 0.95, 48).rotateX(-Math.PI / 2);
  const chipGeo = new THREE.CircleGeometry(0.28, 40).rotateX(-Math.PI / 2);
  const chipRim = new THREE.RingGeometry(0.265, 0.29, 40).rotateX(-Math.PI / 2);
  const shardGeo = new THREE.TetrahedronGeometry(0.13, 0).scale(0.7, 1.7, 0.7);
  const tokens = new Map();          // num → token
  const effects = new Set();         // transient moments not tied to one crystal
  let hovered = null, nowMs = 0;

  function buildGeos() {
    for (const g of [bodyGeo, edgeGeo, coreGeo, smallGeo]) g?.dispose();
    bodyGeo = crystalGeometry(L.shape, L.stretch);
    edgeGeo = new THREE.EdgesGeometry(bodyGeo, 1);
    coreGeo = crystalGeometry(L.shape, L.stretch * 0.9).scale(0.42, 0.62, 0.42);
    smallGeo = crystalGeometry('shard', 2.4);
  }
  buildGeos();

  const colorOf = claim => claim === 'drive' ? L.drive : claim === 'sustain' ? L.sustain : L.neutral;

  /** One crystal and its floor, built at a hex. `style` 'crystal' | 'today' (the shipped flat chip, for the honest comparison). */
  function makeToken(num, note, claim, style = 'crystal') {
    const base = pointFor(num, 0);
    const t = { num, note, claim, style, mode:'idle', t0:nowMs, ms:0, data:null, alive:true,
      group:new THREE.Group(), top:new THREE.Group(), float:new THREE.Group(), spin:new THREE.Group(), floor:new THREE.Group(),
      crackVariant:num % 4, crackYaw:(num * 2.399) % (Math.PI * 2), hum:0 };
    t.group.position.set(base.x, 0, base.z); t.group.name = `Lost Chord ${note} @${num}`;
    t.top.position.copy(t.group.position); t.top.name = `Lost Chord crystal ${note} @${num}`;
    t.group.add(t.floor); t.top.add(t.float); t.float.add(t.spin);
    group.add(t.group); tops.add(t.top);
    dressToken(t);
    tokens.set(num, t);
    return t;
  }

  function dropToken(t) { stripToken(t); group.remove(t.group); tops.remove(t.top); }
  function stripToken(t) {
    const shared = new Set([bodyGeo, edgeGeo, coreGeo, smallGeo, hexRing, hexFill, waveGeo, chipGeo, chipRim, shardGeo]);
    for (const g of [t.floor, t.spin, t.float]) {
      for (const ch of [...g.children]) {
        if (ch === t.spin) continue; g.remove(ch);
        ch.traverse(m => {
          if (m.geometry && !m.isSprite && !shared.has(m.geometry)) m.geometry.dispose();
          if (m.material) { const ms = Array.isArray(m.material) ? m.material : [m.material]; ms.forEach(x => x.dispose()); }
        });
      }
    }
    if (t.light) { t.light.intensity = 0; t.light.userData.busy = false; t.light = null; }
    if (t.motesPts) { t.top.remove(t.motesPts); t.motesPts.geometry.dispose(); t.motesPts.material.dispose(); t.motesPts = null; }
    t.parts = null;
  }

  /** (Re)dress a token from the look. Called on build and whenever a lever moves. */
  function dressToken(t) {
    stripToken(t);
    const col = new THREE.Color(colorOf(t.claim));
    const P = t.parts = {};
    if (t.style === 'today') {
      // 🪞 TODAY'S CHIP, as the SVG draws it (`rlsw-simulator` BOARD TOKENS): a
      // dark disc, a cyan rim, the letter, pulsing 0.45↔1 on 1.6 s; the hunt
      // hex is an 8% wash with a 1.2px rim. Laid flat, because in 3D the SVG is.
      P.chip = new THREE.Mesh(chipGeo, new THREE.MeshBasicMaterial({ color:0x0a1828, transparent:true, opacity:0.96, depthWrite:false, toneMapped:false }));
      P.rim = new THREE.Mesh(chipRim, new THREE.MeshBasicMaterial({ color:t.claim ? col : new THREE.Color('#44ccff'), transparent:true, depthWrite:false, toneMapped:false }));
      P.flat = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
        map:letterTexture(t.note, 0, true), color:t.claim ? col : new THREE.Color('#7fe0ff'), transparent:true, depthWrite:false, toneMapped:false }));
      P.flat.material.map.userData.shared = true;
      for (const m of [P.chip, P.rim, P.flat]) { m.position.y = L.floorY + 0.012; m.renderOrder = 60; t.floor.add(m); }
      P.rim.position.y += 0.002; P.flat.position.y += 0.004;
      if (t.claim) {
        P.claimFill = new THREE.Mesh(hexFill, new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.08, depthWrite:false, toneMapped:false }));
        P.claimRing = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.81, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color:col, transparent:true, depthWrite:false, toneMapped:false }));
        for (const m of [P.claimFill, P.claimRing]) { m.position.y = L.floorY + 0.008; t.floor.add(m); }
      }
      return;
    }
    // ── floor: the crack, the hunt hex, the embedded shards ──
    P.crack = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map:crackTex[t.crackVariant], color:col.clone().multiplyScalar(L.crackGlow), transparent:true, depthWrite:false,
      blending:THREE.AdditiveBlending, toneMapped:false, polygonOffset:true, polygonOffsetFactor:-2 }));
    P.crack.rotation.y = t.crackYaw; P.crack.position.y = L.floorY + 0.006; P.crack.renderOrder = 58; t.floor.add(P.crack);
    if (t.claim && L.claimHex > 0) {
      P.claimFill = new THREE.Mesh(hexFill, additive(col.clone().multiplyScalar(0.5 * L.claimHex), 1));
      P.claimRing = new THREE.Mesh(hexRing, additive(col.clone().multiplyScalar(2 * L.claimHex), 1));
      for (const m of [P.claimFill, P.claimRing]) { m.position.y = L.floorY + 0.004; m.renderOrder = 57; t.floor.add(m); }
    }
    P.embedded = [];
    const r = rng(t.num * 97 + 5);
    for (let i = 0; i < L.embedded; i++) {
      const m = new THREE.Mesh(smallGeo, new THREE.MeshStandardMaterial({ color:col.clone().multiplyScalar(0.25), emissive:col, emissiveIntensity:L.bodyGlow * 1.4,
        transparent:true, opacity:Math.min(1, L.bodyOpacity + 0.3), roughness:0.18, metalness:0.1, flatShading:true, depthWrite:false }));
      const a = (i / Math.max(1, L.embedded)) * Math.PI * 2 + r() * 0.8, d = 0.18 + r() * 0.2, k = L.size * (0.28 + r() * 0.18);
      m.position.set(Math.cos(a) * d, L.floorY - 0.04, Math.sin(a) * d);
      m.scale.setScalar(k); m.rotation.set(Math.sin(a) * (0.35 + r() * 0.3), r() * 3, -Math.cos(a) * (0.35 + r() * 0.3));
      m.userData.k = k; t.floor.add(m); P.embedded.push(m);
    }
    // ── the crystal ──
    P.body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color:col.clone().multiplyScalar(0.3), emissive:col,
      emissiveIntensity:L.bodyGlow, transparent:true, opacity:L.bodyOpacity, roughness:0.12, metalness:0.15,
      flatShading:true, depthWrite:false, side:THREE.DoubleSide }));
    P.edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color:col.clone().multiplyScalar(L.edgeGlow),
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    P.core = new THREE.Mesh(coreGeo, additive(col.clone().multiplyScalar(L.coreGlow), 0.85));
    P.body.renderOrder = 61; P.core.renderOrder = 62; P.edges.renderOrder = 63;
    t.spin.add(P.core, P.body, P.edges);
    t.spin.rotation.z = L.tilt;
    if (L.letter !== 'off') {
      P.letter = new THREE.Sprite(new THREE.SpriteMaterial({ map:letterTexture(t.note, L.letterOutline, false, L.letterBack), color:new THREE.Color('#ffffff').lerp(col, 0.25).multiplyScalar(L.letterGlow),
        transparent:true, depthWrite:false, toneMapped:false }));
      // 📌 depth-TESTED even 'inside': the glass writes no depth, so the note shows
      // through it, but a standee in front still hides it.
      P.letter.material.map.userData.shared = true;
      P.letter.renderOrder = 70;
      P.letter.position.y = L.letter === 'above' ? L.size * L.stretch * 0.62 + L.letterSize * 0.55 : L.size * L.stretch * 0.05;
      t.float.add(P.letter);
    }
    // ── the light on the stone, and the motes ──
    t.light = borrowLight(col, t);
    if (L.motes > 0) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(L.motes * 3), 3));
      t.motesPts = new THREE.Points(g, new THREE.PointsMaterial({ color:col.clone().multiplyScalar(1.8), size:0.11, map:moteTex, transparent:true, opacity:0.9,
        depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
      t.motesPts.userData.seed = Array.from({ length:L.motes }, (_, i) => [r() * 6.28, 0.32 + r() * 0.3, 0.2 + r() * 0.9, 0.4 + r() * 0.7, i]);
      t.top.add(t.motesPts);
    }
    t.dressedClaim = t.claim;
  }

  // ── transient effects ──
  function addEffect(e) { effects.add(e); if (e.obj) fx.add(e.obj); return e; }
  function endEffect(e) { effects.delete(e); if (e.obj) { fx.remove(e.obj); disposeTree(e.obj); } if (e.flash && ![...effects].some(x => x.flash)) e.flash.intensity = 0; }

  function boltColors(col) {
    return L.boltColor === 'riven' ? RIVEN_BOLTS : L.boltColor === 'white' ? [0xddeeff] : [new THREE.Color(col).getHex()];
  }

  function spawnFx(t) {
    const base = pointFor(t.num, L.floorY), r = rng(t.num * 31 + Math.floor(nowMs));
    const obj = new THREE.Group(), cols = boltColors(colorOf(t.claim));
    if (L.spawnStyle === 'sky') {
      const top = base.clone().add(new THREE.Vector3((r() - 0.5) * 6, 16, (r() - 0.5) * 6));
      obj.add(boltMesh(top, base, cols[0], r, { width:0.05, kinks:18, jitter:0.6, branches:3 }));
    } else if (L.spawnStyle === 'below') {
      for (let i = 0; i < 3; i++) {
        const a = r() * Math.PI * 2, from = base.clone().add(new THREE.Vector3(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25));
        const to = base.clone().add(new THREE.Vector3(Math.cos(a) * (0.3 + r() * 0.5), 1.1 + r() * 1.1, Math.sin(a) * (0.3 + r() * 0.5)));
        const b = boltMesh(from, to, cols[i % cols.length], r, { width:0.016, kinks:13, jitter:0.32, branches:1, glow:2.4 });
        b.userData.from = from; b.userData.len = to.y - from.y; obj.add(b);
      }
    }
    const wave = new THREE.Mesh(waveGeo, additive(new THREE.Color(colorOf(t.claim)).multiplyScalar(1.6), 0));
    wave.position.copy(base).setY(L.floorY + 0.01); obj.add(wave);
    // 💡 ONE pooled flash for every spawn (a light per bolt would recompile the arena).
    flashLight.color.set(cols[0]); flashLight.position.copy(base).setY(1.2);
    return addEffect({ kind:'spawn', t0:nowMs, ms:L.spawnMs, obj, wave, flash:flashLight, token:t });
  }

  // ── public: one call per engine event ──
  const api = {
    group,
    get look() { return L; },
    /** Lever moved → rebuild what depends on it. */
    setLook(next) {
      const geoKeys = ['shape', 'stretch'];
      const rebuild = geoKeys.some(k => next[k] !== L[k]);
      L = { ...next };
      if (rebuild) buildGeos();
      for (const t of tokens.values()) dressToken(t);
    },
    tokens() { return [...tokens.values()].filter(t => t.alive).map(t => ({ num:t.num, note:t.note, claim:t.claim, mode:t.mode, style:t.style })); },
    has(num) { const t = tokens.get(num); return !!(t && t.alive); },
    /** A token, appearing at rest (no moment) — a loaded save, the page's reset. */
    place(num, note, claim = null, style = 'crystal') { api.remove(num); return makeToken(num, note, claim, style); },
    remove(num) { const t = tokens.get(num); if (!t) return; dropToken(t); tokens.delete(num); },
    clear() {
      for (const [k, t] of [...tokens.entries()]) { if (t.data?.shards) { tops.remove(t.data.shards); disposeTree(t.data.shards); }
        if (t.data?.wave) { fx.remove(t.data.wave); t.data.wave.material.dispose(); } api.remove(k); }
      for (const e of [...effects]) endEffect(e);
    },
    /** How many moments are playing (the reduced-motion loop keeps drawing while > 0). */
    active() { let n = effects.size; for (const t of tokens.values()) if (t.mode !== 'idle') n++; return n; },
    setClaim(num, claim) { const t = tokens.get(num); if (t && t.claim !== claim) { t.claim = claim; dressToken(t); } },
    setStyle(num, style) { const t = tokens.get(num); if (t && t.style !== style) { t.style = style; dressToken(t); } },
    setHover(num) { hovered = num ?? null; },
    /** Set the clock a moment starts on, without drawing. ⚠️ Call it before a moment
     *  fired from INSIDE the caller's frame (e.g. a hop that lands this frame):
     *  otherwise the moment starts on the previous frame's time and skips ahead. */
    clock(tSec) { nowMs = tSec * 1000; },
    /** ⚡ TOKENS_SCATTERED — it grows out of the stage. */
    spawn(num, note, claim = null, style = 'crystal') {
      const t = api.place(num, note, claim, style);
      if (style === 'today') return t;
      t.mode = 'spawn'; t.t0 = nowMs; t.ms = L.spawnMs; spawnFx(t); return t;
    },
    /** 🌀 TOKENS_DRIFTED — dissolve, stream low across the floor, re-form. */
    drift(fromNum, toNum) {
      const old = tokens.get(fromNum); if (!old || !old.alive || tokens.has(toNum)) return null;
      const { note, claim, style } = old;
      if (style === 'today') { api.remove(fromNum); return api.place(toNum, note, claim, style); }
      // The old crystal stays to dissolve; the new one waits to re-form.
      old.mode = 'driftOut'; old.t0 = nowMs; old.ms = L.driftMs; old.alive = false;
      tokens.delete(fromNum); const ghostKey = `ghost-${fromNum}-${nowMs}`; tokens.set(ghostKey, old);
      const t = makeToken(toNum, note, claim, style); t.mode = 'driftIn'; t.t0 = nowMs; t.ms = L.driftMs;
      const n = 44, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color:new THREE.Color(colorOf(claim)).multiplyScalar(2.2), size:0.2, map:moteTex, alphaTest:0.01, transparent:true,
        opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
      const r = rng(fromNum * 13 + toNum);
      const from = pointFor(fromNum, L.hoverY), to = pointFor(toNum, L.hoverY);
      const side = new THREE.Vector3(-(to.z - from.z), 0, to.x - from.x).normalize();
      addEffect({ kind:'stream', t0:nowMs, ms:L.driftMs, obj:pts, from, to, side, ghostKey,
        seeds:Array.from({ length:n }, () => [r() * 0.35, (r() - 0.5) * 0.9, r() * 0.4, r() * 6.28]) });
      return t;
    },
    /** 💥 THRASH_TOKENS_SPAWNED — shards off the Spirit who was hit (`from` = their chest, a Vector3). */
    scatter(from, landings) {
      const out = [];
      for (const [i, { num, note, claim = null, style = 'crystal' }] of landings.entries()) {
        if (tokens.has(num)) continue;
        const t = makeToken(num, note, claim, style);
        if (style === 'today') { out.push(t); continue; }
        t.mode = 'scatter'; t.t0 = nowMs + i * 70; t.ms = L.scatterMs; t.data = { from:from.clone(), to:pointFor(num, L.floorY + 0.05) };
        out.push(t);
      }
      const burst = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), additive(new THREE.Color('#ffffff'), 0));
      burst.position.copy(from); addEffect({ kind:'burst', t0:nowMs, ms:420, obj:burst });
      return out;
    },
    /** 🎵 TOKEN_PICKED_UP — ring, shatter, the note rises. `onHandoff(worldPos, note)` fires once, when the page should take it to the HUD. */
    pickup(num, { rise = 2.4, onHandoff = null } = {}) {
      const t = tokens.get(num); if (!t || !t.alive) return null;
      t.alive = false; tokens.delete(num); const key = `pick-${num}-${nowMs}`; tokens.set(key, t);
      if (t.style === 'today') { api.remove(key); onHandoff?.(pointFor(num, L.floorY + 0.3), t.note); return t; }
      t.mode = 'pickup'; t.t0 = nowMs; t.ms = L.pickupMs; t.data = { rise, onHandoff, handed:false, key };
      // the shards
      const r = rng(num * 7 + 3), col = new THREE.Color(colorOf(t.claim));
      const shards = new THREE.Group();
      for (let i = 0; i < L.shards; i++) {
        const m = new THREE.Mesh(shardGeo, additive(col.clone().multiplyScalar(1.7), 1));
        const a = (i / L.shards) * Math.PI * 2 + r() * 0.6;
        m.userData.v = new THREE.Vector3(Math.cos(a) * (1.6 + r() * 1.8), 0.8 + r() * 2.4, Math.sin(a) * (1.6 + r() * 1.8));
        m.userData.w = new THREE.Vector3(r() * 9, r() * 9, r() * 9);
        m.visible = false; shards.add(m);
      }
      shards.position.copy(pointFor(num, 0)); t.data.shards = shards; tops.add(shards);
      const wave = new THREE.Mesh(waveGeo, additive(col.clone().multiplyScalar(1.8), 0));
      wave.position.copy(pointFor(num, L.floorY + 0.012)); fx.add(wave); t.data.wave = wave;
      return t;
    },
    /** Raycast helper: the live token under a ray, by its float's bounding ball. */
    pick(raycaster) {
      let best = null, bestD = Infinity; const c = new THREE.Vector3();
      for (const t of tokens.values()) {
        if (!t.alive || t.mode !== 'idle') continue;
        t.float.getWorldPosition(c);
        if (t.style === 'today') c.y = L.floorY;
        const d = raycaster.ray.distanceSqToPoint(c);
        const R = t.style === 'today' ? 0.35 : Math.max(0.45, L.size * L.stretch * 0.5);
        if (d < R * R) { const along = raycaster.ray.origin.distanceTo(c); if (along < bestD) { bestD = along; best = t.num; } }
      }
      return best;
    },
    /** For the page's hum: ring this crystal (a visual swell, the page plays the tone). */
    ring(num) { const t = tokens.get(num); if (t) t.hum = 1; },
    /** The frame. `tSec` the scene clock, `ms` the same in ms. */
    update(tSec, { reduced = false, camera = null } = {}) {
      nowMs = tSec * 1000;
      for (const [key, t] of [...tokens.entries()]) frameToken(key, t, tSec, reduced);
      for (const e of [...effects]) frameEffect(e, reduced);
    },
    dispose() {
      api.clear(); for (const g of [bodyGeo, edgeGeo, coreGeo, smallGeo, hexRing, hexFill, waveGeo, chipGeo, chipRim, shardGeo]) g?.dispose();
      crackTex.forEach(t => t.dispose()); moteTex.dispose(); root.remove(group); floatRoot.remove(tops);
    },
  };

  function frameToken(key, t, tSec, reduced) {
    const P = t.parts; if (!P) return;
    const pose = idlePose(L, tSec, t.num, reduced);
    const isHover = hovered === t.num && t.alive;
    t.hum = Math.max(0, t.hum - 0.016 / 0.9);
    if (t.style === 'today') {
      const pulse = reduced ? 1 : 0.725 + 0.275 * Math.sin(tSec * Math.PI * 2 / 1.6 + (t.num % 7) * 0.18 * Math.PI * 2 / 1.6);
      const k = t.claim ? 1.15 : 1;
      for (const m of [P.chip, P.rim, P.flat]) { m.material.opacity = (m === P.chip ? 0.96 : 1) * pulse; m.scale.setScalar(k * (isHover ? 1.12 : 1)); }
      if (P.claimRing) P.claimRing.material.opacity = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(tSec * Math.PI * 2 / 1.6);
      return;
    }
    const bump = t.claim ? L.claimBump : 1;
    let scale = bump * (isHover ? 1.08 : 1) * (1 + t.hum * 0.12), y = pose.y, crack = 1, glow = pose.pulse * (1 + t.hum * 0.8 + (isHover ? 0.25 : 0)), letterA = 1, vis = true;
    let embedded = 1;
    const u = t.ms ? clamp01((nowMs - t.t0) / t.ms) : 1;
    if (t.mode === 'spawn') {
      const s = spawnPhase(u, L.spawnStyle);
      scale *= Math.max(0.0001, s.grow); crack = s.crack * (s.crackFlicker && !reduced ? 0.6 + 0.4 * Math.sin(nowMs * 0.09) ** 2 : 1);
      y = L.spawnStyle === 'below' ? -0.2 + (pose.y + 0.2) * s.rise : pose.y; letterA = s.letter; glow *= 1 + s.flash * 2; embedded = s.crack;
      if (u >= 1) t.mode = 'idle';
    } else if (t.mode === 'driftOut') {
      const d = driftPhase(u); scale *= Math.max(0.0001, d.out); crack = d.crackOld; letterA = d.out; glow *= 1 + (1 - d.out) * 1.5; embedded = d.crackOld;
      if (u >= 1) { dropToken(t); tokens.delete(key); return; }
    } else if (t.mode === 'driftIn') {
      const d = driftPhase(u); scale *= Math.max(0.0001, d.in); crack = d.crackNew; letterA = smooth(span(u, 0.85, 1)); embedded = d.crackNew;
      if (u >= 1) t.mode = 'idle';
    } else if (t.mode === 'scatter') {
      if (nowMs < t.t0) { vis = false; crack = 0; embedded = 0; }
      else {
        const p = scatterPoint(t.data.from, t.data.to, u, L);
        t.float.position.set(p.x - t.group.position.x, p.y, p.z - t.group.position.z);
        t.spin.rotation.x = p.landed ? t.spin.rotation.x * 0.85 : u * 14;
        crack = p.landed ? smooth(p.k * 1.6) : 0; embedded = crack; scale *= p.landed ? 1 : 0.75; letterA = p.landed ? smooth(p.k) : 0;
        glow *= p.landed ? 1 + (1 - p.k) * 1.6 : 1.3;
        if (p.landed && !t.data.landedFx) { t.data.landedFx = true; landWave(t); }
        if (u >= 1) { t.mode = 'idle'; t.spin.rotation.x = 0; }
      }
    } else if (t.mode === 'pickup') {
      const ph = pickupPhase(u), D = t.data, top = pose.y + D.rise;
      y = pose.y + ph.lift * D.rise + ph.noteRise * 0.45;
      if (!ph.shattered) { scale *= 1 + ph.ring * 0.4; glow *= 1 + ph.ring * 2.5; }
      else scale = 0.0001;
      crack = ph.crack; embedded = ph.crack;
      D.shards.children.forEach(m => {
        m.visible = ph.shattered && ph.shards < 1;
        const s = ph.shards * L.pickupMs / 1000 * 0.66;
        m.position.set(m.userData.v.x * s, top + m.userData.v.y * s - 4.9 * s * s, m.userData.v.z * s);
        if (m.position.y < L.floorY) m.position.y = L.floorY;
        m.rotation.set(m.userData.w.x * s, m.userData.w.y * s, m.userData.w.z * s);
        m.material.opacity = 1 - ph.shards * ph.shards;
      });
      D.wave.material.opacity = (1 - ph.wave) * 0.8 * Math.min(1, ph.wave * 8); D.wave.scale.setScalar(0.4 + ph.wave * 1.4);
      letterA = ph.handoff ? 0 : 1;
      if (t.light) { t.light.intensity = L.light * (ph.shattered ? 4 * (1 - ph.shards) : 1 + ph.ring * 2); t.light.position.set(t.group.position.x, y, t.group.position.z); }
      if (ph.handoff && !D.handed) { D.handed = true; const w = new THREE.Vector3(); t.float.getWorldPosition(w); D.onHandoff?.(w, t.note); }
      if (u >= 1) { tops.remove(D.shards); disposeTree(D.shards); fx.remove(D.wave); D.wave.material.dispose(); dropToken(t); tokens.delete(key); return; }
    }
    t.float.visible = vis;
    if (t.mode !== 'scatter') t.float.position.set(0, y, 0);
    t.spin.rotation.y = pose.yaw;
    t.spin.scale.setScalar(L.size * scale);
    // the core and the edges carry the breath; the body stays glass
    P.core.material.opacity = Math.min(1, 0.85 * glow);
    P.edges.material.opacity = Math.min(1, 0.7 + 0.3 * glow);
    P.body.material.emissiveIntensity = L.bodyGlow * glow;
    P.crack.material.opacity = Math.min(1, crack * (0.75 + 0.25 * glow));
    P.crack.scale.setScalar(L.crack * Math.max(0.0001, 0.35 + 0.65 * crack));
    for (const m of P.embedded) { m.scale.setScalar(m.userData.k * Math.max(0.0001, embedded)); m.material.emissiveIntensity = L.bodyGlow * 1.4 * glow; }
    if (P.claimRing) { const k = reduced ? 1 : 0.55 + 0.45 * Math.sin(tSec * Math.PI * 2 / 1.6); P.claimRing.material.opacity = k * crack; P.claimFill.material.opacity = 0.5 * crack; }
    if (P.letter) {
      P.letter.material.opacity = letterA;
      const ls = L.letterSize * (isHover ? 1.12 : 1) * (t.claim ? Math.sqrt(L.claimBump) : 1) * (1 + t.hum * 0.1);
      P.letter.scale.set(ls, ls, 1);
      if (t.mode === 'scatter') P.letter.position.set(0, L.letter === 'above' ? L.size * L.stretch * 0.62 + L.letterSize * 0.55 : L.size * L.stretch * 0.05, 0);
    }
    if (t.light && t.mode !== 'pickup') { t.light.intensity = L.light * Math.min(2.5, glow) * Math.max(scale > 0.01 ? 1 : 0, crack * 0.5); t.light.position.set(t.group.position.x + t.float.position.x, Math.max(0.15, y * 0.7 + 0.15), t.group.position.z + t.float.position.z); }
    if (t.motesPts) {
      const pos = t.motesPts.geometry.attributes.position, seeds = t.motesPts.userData.seed;
      seeds.forEach(([a0, rad, h, sp], i) => {
        const a = a0 + (reduced ? 0 : tSec * sp);
        const R = rad * (L.size / 0.5) * (0.7 + 0.3 * scale);
        pos.setXYZ(i, Math.cos(a) * R + t.float.position.x, y + (h - 0.5) * L.size * L.stretch * 0.8 + (reduced ? 0 : Math.sin(tSec * 1.3 + i) * 0.06), Math.sin(a) * R + t.float.position.z);
      });
      pos.needsUpdate = true; t.motesPts.material.opacity = 0.9 * Math.min(1, scale) * (vis ? 1 : 0);
    }
  }

  function landWave(t) {
    const wave = new THREE.Mesh(waveGeo, additive(new THREE.Color(colorOf(t.claim)).multiplyScalar(1.6), 0));
    wave.position.copy(pointFor(t.num, L.floorY + 0.012));
    addEffect({ kind:'wave', t0:nowMs, ms:520, obj:wave });
  }

  function frameEffect(e, reduced) {
    const u = clamp01((nowMs - e.t0) / e.ms);
    if (e.kind === 'spawn') {
      const s = spawnPhase(u, L.spawnStyle);
      e.obj.children.forEach(ch => {
        if (ch.type !== 'Group') return;
        const flick = reduced ? 1 : (Math.sin(nowMs * 0.07 + ch.id) > -0.3 ? 1 : 0.25);
        ch.userData.mats?.forEach((m, i) => { m.opacity = s.bolt * flick * (i ? 0.55 : 1); });
        if (ch.userData.from) { ch.scale.y = Math.max(0.0001, s.boltGrow); ch.position.y = ch.userData.from.y * (1 - ch.scale.y); }
      });
      e.wave.material.opacity = s.flash * 0.9; e.wave.scale.setScalar(0.3 + span(u, 0.04, 0.5) * 1.5);
      e.flash.intensity = Math.max(e.flash.intensity * 0.9, s.flash * 40);
    } else if (e.kind === 'stream') {
      const d = driftPhase(u), pos = e.obj.geometry.attributes.position, mid = new THREE.Vector3();
      e.obj.material.opacity = d.streamVis;
      e.seeds.forEach(([lag, sideOff, lift, ph], i) => {
        const k = smooth(clamp01(d.stream * (1 + lag) - lag));
        mid.copy(e.from).lerp(e.to, k);
        const bow = Math.sin(k * Math.PI);
        mid.addScaledVector(e.side, sideOff * bow * 0.9);
        mid.y = L.floorY + 0.15 + (e.from.y - L.floorY) * (1 - bow) * 0.6 + lift * bow * 0.6 + (reduced ? 0 : Math.sin(nowMs * 0.012 + ph) * 0.05);
        pos.setXYZ(i, mid.x, mid.y, mid.z);
      });
      pos.needsUpdate = true;
    } else if (e.kind === 'burst') {
      e.obj.material.opacity = (1 - u) * 0.8; e.obj.scale.setScalar(0.4 + u * 1.8);
    } else if (e.kind === 'wave') {
      e.obj.material.opacity = (1 - u) * 0.9; e.obj.scale.setScalar(0.4 + u * 1.4);
    }
    if (u >= 1) endEffect(e);
  }

  return api;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE GAME'S WIRING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🎮 The Lost Chords in a live match (arenaVisuals.js).
 * `update(lostChords, spirits, reach, decoys)` takes arenaFrame's `lostChords`
 * ({ tokens, drifted, thrashed, hover, tones }) with the frame's spirits, reach and
 * the Ronin's doubles, and `tick(ms, { reduced, pawns })` plays it.
 * 👤 A DOUBLE PICKS UP EXACTLY LIKE ITS RONIN (its own pawn, its owner's tone):
 * anything else would tell the table which body is real.
 *
 * ⚠️ A PICKUP WAITS FOR THE STANDEE. The engine drops the token the moment the
 * step is taken; the standee then HOPS there (standeeSteps, ~420 ms a hex). A
 * crystal that broke on the click would shatter in front of an empty hex, so a
 * pickup is held until the picker-up's pawn is standing on it (or 2.5 s, or —
 * with no pawn to watch, a smoke-hidden Spirit or the Ronin's double — 0.45 s).
 * 🎵 The pickup's NOTE is played here, at the break, in the picker-up's own amp
 * settings (`tones`, from the client's tone panel); the client skips its own
 * pickup pluck while the 3D arena is up, so the note sounds once.
 */
export function createLostChordLayer(root, { pointFor, floatRoot = root, L = LOST_CHORD_LOOK, sound = true } = {}) {
  const chords = createLostChords(root, { pointFor, L, floatRoot });
  let prev = null, pending = [], hums = [], lastHover = null, reachKey = null, tones = {}, nowMs = 0;
  const say = fn => { if (!sound) return; try { fn(); } catch { /* audio unavailable — silent */ } };
  const rise = () => Math.max(1.2, STANDEE.height + 0.45 - L.hoverY);
  const notes = () => chords.tokens();
  function ringNote(num, note) {
    if (L.hum === 'off') return;
    chords.ring(num);
    say(() => hum(note, { voice:L.humVoice, volume:L.humVolume, octave:L.humOctave }));
  }
  return {
    chords,
    update(lc, spirits = [], reach = null, decoys = []) {
      if (!lc) return;
      tones = lc.tones ?? {};
      const standing = new Map();
      for (const s of spirits) if (Number.isFinite(s?.num) && !s.waiting) standing.set(s.num, s.id);
      for (const d of decoys ?? []) if (Number.isFinite(d?.num) && !standing.has(d.num)) standing.set(d.num, d.id);
      const ops = planLostChordMoments(prev, lc.tokens, { drifted:lc.drifted, thrashed:lc.thrashed, standing });
      prev = new Map((lc.tokens ?? []).filter(t => Number.isFinite(t?.num) && t.note).map(t => [t.num, { note:t.note, claim:t.claim ?? null }]));
      chords.clock(nowMs / 1000);
      const scatters = new Map();
      for (const o of ops) {
        if (o.op === 'place') chords.place(o.num, o.note, o.claim);
        else if (o.op === 'claim') chords.setClaim(o.num, o.claim);
        else if (o.op === 'spawn') { chords.spawn(o.num, o.note, o.claim); say(() => spawnSound(o.note, { volume:L.sfxVolume, octave:L.humOctave, voice:L.humVoice, style:L.spawnStyle })); }
        else if (o.op === 'drift') { chords.drift(o.from, o.to); say(() => driftSound(o.note, { volume:L.sfxVolume, octave:L.humOctave, voice:L.humVoice, ms:L.driftMs })); }
        else if (o.op === 'scatter') { if (!scatters.has(o.fromHex)) scatters.set(o.fromHex, []); scatters.get(o.fromHex).push(o); }
        else if (o.op === 'pickup') pending.push({ num:o.num, note:o.note, spiritId:o.spiritId, t0:nowMs });
        else if (o.op === 'shatter') pending.push({ num:o.num, note:o.note, spiritId:null, t0:nowMs - 1e6 });
      }
      for (const [fromHex, list] of scatters) {
        chords.scatter(pointFor(fromHex, 1.7), list.map(o => ({ num:o.num, note:o.note, claim:o.claim })));
        say(() => thrashBurst({ volume:L.sfxVolume }));
        list.forEach((o, i) => hums.push({ at:nowMs + i * 70 + L.scatterMs * 0.78, fn:() => say(() => clink(o.note, { volume:L.sfxVolume, octave:L.humOctave })) }));
      }
      // 🎧 pointing at a crystal rings it
      const hover = Number.isFinite(lc.hover) ? lc.hover : null;
      if (hover !== lastHover) { const t = notes().find(x => x.num === hover && x.mode === 'idle'); if (t) ringNote(t.num, t.note); }
      chords.setHover(hover); lastHover = hover;
      // 🎯 arming a walk rings what it can reach, low to high — once per armed walk
      const key = reach?.kind === 'move' ? `${reach.ownerId}|${reach.turn}|${[...(reach.near ?? [])].sort((a, b) => a - b).join(',')}` : null;
      if (key && key !== reachKey && L.hum === 'reach') {
        const near = new Set(reach.near ?? []);
        notes().filter(t => near.has(t.num) && t.mode === 'idle')
          .sort((a, b) => (NOTE_PCS[a.note] ?? 0) - (NOTE_PCS[b.note] ?? 0))
          .forEach((t, i) => hums.push({ at:nowMs + i * 260, fn:() => ringNote(t.num, t.note) }));
      }
      reachKey = key;
    },
    tick(ms, { reduced = false, pawns = null } = {}) {
      nowMs = ms; chords.clock(ms / 1000);
      for (const p of [...pending]) {
        const pawn = p.spiritId != null ? pawns?.get?.(p.spiritId) : null, at = pointFor(p.num, 0);
        const here = pawn && at && Math.hypot(pawn.position.x - at.x, pawn.position.z - at.z) < 0.35;
        const waited = ms - p.t0;
        if (!(here || waited > 2500 || (!pawn && waited > 450))) continue;
        pending.splice(pending.indexOf(p), 1);
        const live = notes().find(t => t.num === p.num);
        if (!live) continue;
        chords.pickup(p.num, { rise:p.spiritId != null ? rise() : 0.6 });
        say(() => pickupSound(p.note, { volume:L.sfxVolume, octave:L.humOctave, voice:L.humVoice,
          pluck:p.spiritId != null ? L.pluck : 'off', spiritId:String(p.spiritId ?? '').replace(/:shadow$/, ''), knobs:tones[p.spiritId] ?? tones[String(p.spiritId ?? '').replace(/:shadow$/, '')], ringMs:L.pickupMs * 0.34 }));
      }
      for (const h of [...hums]) if (ms >= h.at) { hums.splice(hums.indexOf(h), 1); h.fn(); }
      chords.update(ms / 1000, { reduced });
    },
    /** Anything moving that the reduced-motion loop must keep drawing. */
    active() { return chords.active() + pending.length; },
    diagnostics() { return { tokens:notes().map(t => t.num), moments:chords.active(), pending:pending.map(p => p.num) }; },
    dispose() { chords.dispose(); },
  };
}
