// ─── 🎬 ABILITY DEMOS — the pop-out window that SHOWS what an ability does ───
// Alex, 2026-10-01: "In the character selection screen, when choosing
// abilities, instead of just explaining what it does, what if a mini window
// could pop out and literally show what it does? Right now, we've done
// animation work for Shukuchi and Psycho Bushido - Do you think you could wire
// in pop out windows that literally *show* these abilities?"
// Rulings asked the same day: preview first, then port; the window pops out on
// HOVER (and focus) of the ability row.
//
// ⭐ IT PLAYS THE GAME'S OWN ANIMATION, NOT A VIDEO OF IT. The diorama is a
// little hex island at the board's real spacing (`HEX_BY_QR`'s px → world, the
// same mapping as `arenaVisuals.arenaPoint`) with the real standees on it, and:
//   · 🌀 Shukuchi leaps through `createStandeeSteps` — the shipped shimmer blink,
//     beams, landing light and stone-on-glass landing (`STANDEE_MOVE`);
//   · ⚡ Psycho Bushido is `createBushidoStrikeVisuals` (charge, rumble, draw,
//     sky strikes, afterimages, the cut) against `createSonicClashVisuals`'
//     shield with `beams:false`, built by the Rival's Sustain amp — the exact
//     pair `arenaVisuals` builds for a live bout, at Alex's `BUSHIDO_STRIKE`.
// The numbers are the ENGINE's: `bushidoUpgrade` turns the d6s into d8s,
// `keepBest` keeps the dice, `resolveSonicBarrage` runs the shield's ledger.
// So when a dial-in changes the strike or the hop, the demo changes with it —
// there is nothing here to keep in step by hand.
//
// 📌 WHAT IS NOT THE GAME'S: the 3D floor dice. At pop-out size a thrown d8 is a
// few pixels, so the dice are HUD chips over the picture (rolling, then landing,
// the kept ones lit) on the same beats the floor dice use (`SONIC_DICE`).
//
// ⏩ THE BOUT IS FAST-FORWARDED THROUGH THE DICE AND PLAYED AT 1× FOR THE MOVE.
// A live Bushido is ~16 s from the Rival's throw to the cut, most of it dice.
// `demoWarp` is a piecewise clock: `diceSpeed`× through the throws, 1× for the
// d6 → d8 beat and from the rumble on. Everything — the visuals, the HUD and the
// strike's sound (`scheduleBushidoStrike` takes `at`, a seq → seconds-from-now
// map, so it simply gets the warped one) — reads that one clock.
//
// 🖥️ ONE RENDERER, ONE CANVAS, MADE ON FIRST USE AND KEPT. Hovering down the
// list must not mint a WebGL context per row (browsers cap them, ~16), so the
// canvas MOVES to whichever window is open and only the scene is rebuilt.
// The picker's standee stage is the page's other context; that is two, total.
//
// ✅ IN THE GAME (2026-10-01): Alex — "everything is perfect, I didnt need to
// change anything here - lets lock that in." 0 of 24 levers moved, so
// `ABILITY_DEMO` below ships exactly as the preview offered it.
// `SpiritDraft.jsx` mounts it (the loadout rows and the Field Guide).
import * as THREE from 'three';
import { createStandee, STANDEE_Y, standeeYaw } from '../board/standee.js';
import { createStandeeSteps } from '../board/standeeSteps.js';
import { STANDEE_MOVE } from '../board/standeeMotion.js';
import { HEX_BY_QR } from '../board/hexMap.js';
import { axialDist } from '../board/hexGeometry.js';
import { createBushidoStrikeVisuals } from '../board/bushidoStrikeVisuals.js';
import { BUSHIDO_STRIKE, planStrike } from '../board/bushidoStrike.js';
import { createSonicClashVisuals } from '../board/sonicClashVisuals.js';
import { SONIC_DICE, SONIC_GATE, BARRAGE_LAUNCH, BUSHIDO_BEATS, barrageContact } from '../board/sonicBarrageTiming.js';
import { resolveSonicBarrage } from '../engine/systems/sonicBarrage.js';
import { bushidoUpgrade } from '../engine/systems/bushido.js';
import { keepBest } from '../engine/systems/dicePool.js';
import { SPIRIT_DEFS } from '../data/spirits.js';
import {
  SHUKUCHI_CD, SHUKUCHI_MAX_HOPS, SHUKUCHI_HOP_RINGS, SHUKUCHI_AP_PER_HOP,
  PSYCHO_BUSHIDO_CD, PSYCHO_BUSHIDO_AP_COST, PSYCHO_BUSHIDO_STACK_COST,
  PSYCHO_BUSHIDO_MIN_RANGE, PSYCHO_BUSHIDO_MAX_RANGE, psychoBushidoD8s,
} from '../data/gameConstants.js';
import { createLandingSfx } from '../audio/landingSfx.js';
import { createBushidoSfx, scheduleBushidoStrike } from '../audio/bushidoSfx.js';
import { getRiffAudio, getSfxBus } from '../audio/riffSfx.js';
import { createCursedShamisenVisuals } from '../board/cursedShamisenVisuals.js';
import { CURSED_SHAMISEN, planCast, stringIv, stringOctaves, iwatoDegree, STRINGS, CURSE_TURNS, EXORCISE_NOTES } from '../board/cursedShamisen.js';
import { createShamisenCurseSfx, scheduleCast, midiHz } from '../audio/shamisenCurseSfx.js';
import { CURSED_SHAMISEN_CD, SONIC_BEAM_REACH } from '../data/gameConstants.js';

// ── the levers ── ⭐ ONE COPY, and Alex's dial-in (untouched defaults, 2026-10-01).
// The preview page reads its defaults from here.
export const ABILITY_DEMO = Object.freeze({
  // the window
  openDelay:220, closeDelay:160, side:'auto', width:400, aspect:0.62, frame:'glow', inGuide:'on',
  // the picture
  camera:'side', zoom:1, orbit:0.12, backdrop:'island', island:0.6,
  // the script
  diceSpeed:2.6, scenario:'cycle', hopPause:650, targets:'on', rangeMarks:'on',
  captions:'on', hud:'on', endCard:'on', endMs:1700, loopPause:600,
  // sound — off in a hover window unless the player turns it on (the 🔈 button)
  sound:'off', volume:0.6,
});

/** The abilities that have a demo. Every other row keeps today's text-only guide.
 *  🎸 The Cursed Shamisen joined 2026-10-02 with the Iwato curse's port — its
 *  demo plays `createCursedShamisenVisuals`, the arena's own curse. */
export const DEMO_ABILITIES = Object.freeze(new Set(['shukuchi', 'psycho_bushido', 'cursed_shamisen']));
export const hasDemo = id => DEMO_ABILITIES.has(id);

// ── the board, at the real spacing ───────────────────────────────────────────
// ⚠️ DERIVED, NOT A LITERAL: the step from one hex to its (1,0) and (0,1)
// neighbours on the real map, in arenaPoint's world units (px / 200).
const C0 = HEX_BY_QR['0,3'], CQ = HEX_BY_QR['1,3'], CR = HEX_BY_QR['0,4'];
const STEP_Q = { x:(CQ.px - C0.px) / 200, z:(CQ.py - C0.py) / 200 };   // 1.65, .975
const STEP_R = { x:(CR.px - C0.px) / 200, z:(CR.py - C0.py) / 200 };   // 0,    1.95
export const HEX_RADIUS = Math.hypot(STEP_Q.x, STEP_Q.z) / Math.sqrt(3) * 0.95;
export const key = (q, r) => `${q},${r}`;
export const unkey = k => k.split(',').map(Number);
export const hexWorld = (q, r, y = STANDEE_Y) => new THREE.Vector3(q * STEP_Q.x + r * STEP_R.x, y, q * STEP_Q.z + r * STEP_R.z);
/** The board's facing for a step a → b — the px angle `facingAngle` takes. */
export const facingOf = (a, b) => { const p = hexWorld(...a), t = hexWorld(...b); return Math.atan2(t.z - p.z, t.x - p.x); };
export const ring = ([q, r], n) => {
  const out = [];
  for (let dq = -n; dq <= n; dq++) for (let dr = -n; dr <= n; dr++) if (axialDist(0, 0, dq, dr) === n) out.push([q + dq, r + dr]);
  return out;
};
const around = (cells, n) => {
  const set = new Map();
  for (const c of cells) for (let dq = -n; dq <= n; dq++) for (let dr = -n; dr <= n; dr++)
    if (axialDist(0, 0, dq, dr) <= n) set.set(key(c[0] + dq, c[1] + dr), [c[0] + dq, c[1] + dr]);
  return [...set.values()];
};

// ── 🌀 SHUKUCHI: the script ──────────────────────────────────────────────────
/**
 * Three leaps, each EXACTLY `SHUKUCHI_HOP_RINGS` hexes, each over something:
 * a Rival's body, a hex of 🐙 slime, and onto a Lost Chord note he picks up.
 * Pure — `abilityDemoCheck` holds it to the rules (every hop is 2, every
 * landing is empty, the things he jumps are really in between).
 */
export function shukuchiScript() {
  const start = [0, 0];
  const hops = [
    { dir:[1, 0], over:'rival', caption:'Leap 1 · over a Rival — bodies pass underneath' },
    { dir:[1, -1], over:'slime', caption:'Leap 2 · over 🐙 slime — hazards pass underneath' },
    { dir:[1, 0], over:'note', caption:'Leap 3 · land on a note — and pick it up 🎵' },
  ].slice(0, SHUKUCHI_MAX_HOPS);
  let at = start;
  const steps = hops.map(h => {
    const mid = [at[0] + h.dir[0], at[1] + h.dir[1]];
    const to = [at[0] + h.dir[0] * SHUKUCHI_HOP_RINGS, at[1] + h.dir[1] * SHUKUCHI_HOP_RINGS];
    const s = { ...h, from:at, mid, to };
    at = to;
    return s;
  });
  const rival = steps.find(s => s.over === 'rival')?.mid ?? null;
  const slime = steps.find(s => s.over === 'slime')?.mid ?? null;
  const note = steps.find(s => s.over === 'note')?.to ?? null;
  return { start, steps, rival, slime, note, cells:around([start, ...steps.map(s => s.to)], 2) };
}

// ── ⚡ PSYCHO BUSHIDO: the scenarios ─────────────────────────────────────────
// 📌 THE FACES ARE CHOSEN, THE RULES ARE NOT: each scenario fixes what the dice
// show and hands them to the engine's own `bushidoUpgrade`, `keepBest` and
// `resolveSonicBarrage`. Kept = 2 on both sides (two seats in the stack).
const SCENARIOS = {
  r3:{ dist:3, drive:[6, 6, 6, 6], driveFaces:[7, 3, 5, 2], sustain:[6, 6, 6], sustainFaces:[5, 4, 1] },
  r4:{ dist:4, drive:[6, 6, 6, 6], driveFaces:[8, 6, 4, 3], sustain:[6, 6, 6], sustainFaces:[4, 2, 3] },
  r5:{ dist:5, drive:[6, 6, 6, 6], driveFaces:[8, 2, 7, 5], sustain:[6, 6, 6], sustainFaces:[1, 4, 2] },
  holds:{ dist:3, drive:[6, 6, 6, 6], driveFaces:[4, 2, 3, 1], sustain:[6, 6, 6], sustainFaces:[5, 5, 2] },
};
export const SCENARIO_ORDER = Object.freeze(['r4', 'r3', 'r5', 'holds']);
export const SCENARIO_LABELS = Object.freeze({ cycle:'Cycle all four', r3:'Range 3', r4:'Range 4', r5:'Range 5', holds:'Shield holds' });
export const KEEP = 2;

export function bushidoScenario(name = 'r4') {
  const S = SCENARIOS[name] ?? SCENARIOS.r4;
  const pool = bushidoUpgrade(S.drive, S.dist);
  // a d8 face over 6 only exists on a d8 — the d6s keep their own face, capped
  const faces = S.driveFaces.map((f, i) => Math.min(f, pool[i]));
  const drive = keepBest(faces, pool, KEEP);
  const sus = keepBest(S.sustainFaces, S.sustain, KEEP);
  const shieldValue = sus.vals.reduce((a, v) => a + v, 0);
  const ledger = resolveSonicBarrage(drive.vals, shieldValue);
  const push = ledger.shots.filter(s => s.through > 0).length;
  const battle = {
    key:`demo-${name}`, bushido:true, sonicVersion:2, bushidoDist:S.dist,
    dicePool:drive.pool, diceVals:drive.vals, droppedDicePool:drive.droppedPool, droppedDiceVals:drive.droppedVals,
    sustainPool:sus.pool, sustainRolls:sus.vals, sustainDroppedPool:sus.droppedPool, sustainDropped:sus.droppedVals,
    shieldValue, shots:ledger.shots, breakIndex:ledger.breakIndex, strengthThrough:ledger.strengthThrough,
    damage:ledger.strengthThrough, hitCount:push,
  };
  return { name, dist:S.dist, base:S.drive, pool, faces, drive, sus, sustainFaces:S.sustainFaces, sustainPool:S.sustain,
    shieldValue, ledger, push, battle, d8s:pool.filter((s, i) => s !== S.drive[i]).length };
}

/** When each of his thrown dice lands (sequence ms) — staggered into `SONIC_DICE`'s landing. */
export function driveLandings(sc) {
  const n = sc.faces.length, end = SONIC_DICE.landedAt[0];
  return sc.faces.map((face, i) => ({ idx:i, at:(end - 0.55 + 0.55 * (n > 1 ? i / (n - 1) : 1)) * 1000, face, amt:Math.min(1, face / sc.pool[i]) }));
}
export function sustainLandings(sc) {
  const n = sc.sustainFaces.length, end = SONIC_DICE.landedAt[1];
  return sc.sustainFaces.map((face, i) => ({ idx:i, at:(end - 0.5 + 0.5 * (n > 1 ? i / (n - 1) : 1)) * 1000, face }));
}

/**
 * ⏩ The demo's clock. Breakpoints in SEQUENCE seconds, each segment with a
 * playback rate; `toDemo`/`toSeq` are exact inverses. 1× for the d6 → d8 beat
 * (so it can be read) and from just before the rumble to the end (the move).
 */
export function demoWarp(L = ABILITY_DEMO, plan = planStrike(BUSHIDO_STRIKE, { dist:4, clashMs:BARRAGE_LAUNCH * 1000, shots:KEEP }), endSeq = null) {
  const s = Math.max(1, L.diceSpeed);
  const upgradeAt = SONIC_GATE - 1.4;
  const rumble = plan.rumbleStart / 1000 - 0.35;
  const end = endSeq ?? plan.total / 1000 + 2.4;
  const pts = [0, SONIC_DICE.landedAt[1] + 0.35, upgradeAt, SONIC_GATE, SONIC_DICE.landedAt[0] + 0.3, rumble, end];
  // ⚠️ Each fast segment is 1 + (s − 1)·k, so `diceSpeed: 1` is EXACTLY the game's clock.
  const rate = [s, 1 + (s - 1) * 1.3, 1, s, 1 + (s - 1) * 1.5, 1];
  const demoAt = [0];
  for (let i = 0; i < rate.length; i++) demoAt.push(demoAt[i] + (pts[i + 1] - pts[i]) / rate[i]);
  const toDemo = seq => {
    if (seq <= 0) return seq;
    for (let i = 0; i < rate.length; i++) if (seq <= pts[i + 1] || i === rate.length - 1) return demoAt[i] + (seq - pts[i]) / rate[i];
    return seq;
  };
  const toSeq = d => {
    if (d <= 0) return d;
    for (let i = 0; i < rate.length; i++) if (d <= demoAt[i + 1] || i === rate.length - 1) return pts[i] + (d - demoAt[i]) * rate[i];
    return d;
  };
  return { toDemo, toSeq, duration:demoAt.at(-1), endSeq:end, upgradeAt, pts, rate };
}

/** The captions, in sequence seconds — what the window says while it shows it. */
export function bushidoCaptions(sc, plan) {
  const lastShot = (plan.vanish + 1000 * barrageContact(Math.max(0, sc.ledger.shots.length - 1), BUSHIDO_BEATS)) / 1000;
  const verdict = sc.ledger.strengthThrough > 0
    ? `${sc.ledger.strengthThrough} through → ${sc.ledger.strengthThrough} damage · pushed back ${sc.push} hex${sc.push === 1 ? '' : 'es'}`
    : 'The shield holds — nothing happens to either of you';
  return [
    { at:0, text:`A Rival ${PSYCHO_BUSHIDO_MIN_RANGE}–${PSYCHO_BUSHIDO_MAX_RANGE} hexes straight ahead · nothing in the lane` },
    { at:0.45, text:'They brace — the Rival throws Sustain: that is the shield' },
    { at:SONIC_GATE - 1.4, text:`Range ${sc.dist}: ${sc.d8s} of your d6s become d8s` },
    { at:SONIC_GATE, text:'You throw Drive — and charge on every die' },
    { at:plan.rumbleStart / 1000, text:'The rumble before the draw…' },
    { at:plan.vanish / 1000, text:'DRAW — each kept die strikes the shield' },
    { at:lastShot + 0.25, text:verdict },
  ];
}
export const captionAt = (caps, t) => caps.filter(c => t >= c.at).at(-1)?.text ?? '';
export function bushidoEndCard() {
  return { title:'⚡ Psycho Bushido', lines:[`${PSYCHO_BUSHIDO_AP_COST} AP · burns ${PSYCHO_BUSHIDO_STACK_COST} Drive notes`,
    `Range ${PSYCHO_BUSHIDO_MIN_RANGE} / 4 / ${PSYCHO_BUSHIDO_MAX_RANGE} → ${psychoBushidoD8s(PSYCHO_BUSHIDO_MIN_RANGE)} / ${psychoBushidoD8s(4)} / ${psychoBushidoD8s(PSYCHO_BUSHIDO_MAX_RANGE)} d8s`,
    `${PSYCHO_BUSHIDO_CD}-round cooldown · you land with your guard down`] };
}
export function shukuchiEndCard() {
  return { title:'🌀 Shukuchi Arpeggio', lines:[`Up to ${SHUKUCHI_MAX_HOPS} leaps of ${SHUKUCHI_HOP_RINGS} hexes · ${SHUKUCHI_AP_PER_HOP} AP each`,
    `${SHUKUCHI_CD}-round cooldown from the first leap`, 'You end facing your last leap'] };
}

// ── 🎸 CURSED SHAMISEN: the script ──────────────────────────────────────────
// The Iwato curse's whole life in one loop: taken up, three strings tuned, the
// cast (at 1× — the hush, the bell, his melody, the wisps, the 呪 charm), the
// infection, a cursed turn burning a wisp, and the ending — EXORCISED and
// EXPIRED alternate, loop by loop, so both are seen. 📌 The demo's Ronin is in
// D; the strings are ♭2 · ♭5 · ♭7, three DIFFERENT notes, so the melody shows
// its full shape (`planCast`).
export const SHAMISEN_DEMO = Object.freeze({
  root:'D', midi:50, strings:['Eb', 'Ab', 'C'],
  roninCell:[0, 0], rivalCell:[3, -1],             // three hexes apart: in reach
  upAt:0.3, tuneAt:[1.5, 2.3, 3.1], castAt:4.4,   // seconds
  holdAfterCast:1.6, burnAfter:1.3, endAfter:1.6,  // after the cast lands
});
export function shamisenScript(S = SHAMISEN_DEMO, L = CURSED_SHAMISEN) {
  const ivs = S.strings.map(n => stringIv(n, S.root));
  const plan = planCast(L, ivs);
  const landed = S.castAt + plan.total / 1000;
  const burnAt = landed + S.holdAfterCast;
  const endAt = burnAt + S.burnAfter;
  return { ivs, octaves:stringOctaves(ivs), labels:S.strings.map(n => iwatoDegree(n, S.root)), plan, landed, burnAt, endAt, total:endAt + S.endAfter + 1.6,
    reach:axialDist(...S.roninCell, ...S.rivalCell) };
}
export function shamisenCaptions(sc, ending = 'exorcised', S = SHAMISEN_DEMO) {
  const cast = t => S.castAt + t / 1000;
  return [
    { at:0, text:'Take up the Cursed Shamisen — free, and everyone sees it' },
    { at:S.tuneAt[0] - 0.3, text:'Next turn: tune its strings in the chord step — Iwato notes (1 ♭2 4 ♭5 ♭7), up to 3 a turn' },
    { at:S.castAt, text:`Three strings: cast on a rival within ${SONIC_BEAM_REACH} hexes` },
    { at:cast(sc.plan.launchAt), text:'Three ghost-fires leave the strings…' },
    { at:cast(sc.plan.slapAt), text:'呪 — the charm strikes' },
    { at:sc.landed, text:`Their scale IS Iwato for ${CURSE_TURNS} turns — every other note is discord: no fans` },
    { at:sc.burnAt, text:'Each cursed turn burns a wisp' },
    { at:sc.endAt, text:ending === 'exorcised'
      ? `EXORCISED — ${EXORCISE_NOTES} different Iwato notes on their very next turn lift it`
      : 'No exorcism — the curse runs out after two turns' },
  ];
}
export function shamisenEndCard() {
  return { title:'🎸 Cursed Shamisen', lines:[`Take it up · next turn tune ${STRINGS} Iwato strings (up to 3 a turn)`,
    `Cast within ${SONIC_BEAM_REACH} hexes · your Action · ${CURSED_SHAMISEN_CD}-round cooldown`,
    `Their scale = Iwato for ${CURSE_TURNS} turns · exorcise with ${EXORCISE_NOTES} Iwato notes`] };
}

/**
 * Where the window opens. `side:'auto'` = to the LEFT of the row (over the
 * roster, which the player has finished with), else right, else below.
 * Clamped into the viewport. Pure, so `abilityDemoCheck` can pin it.
 */
export function popoutPlace(row, { width, aspect, side = 'auto' }, view = { w:globalThis.innerWidth ?? 1280, h:globalThis.innerHeight ?? 800 }) {
  const h = Math.round(width * aspect) + 92, gap = 14, pad = 8;
  const fitsLeft = row.left - gap - width >= pad, fitsRight = row.right + gap + width <= view.w - pad;
  const where = side === 'left' || side === 'right' || side === 'above'
    ? side : fitsLeft ? 'left' : fitsRight ? 'right' : 'above';
  let left, top;
  if (where === 'left') { left = row.left - gap - width; top = row.top + row.height / 2 - h / 2; }
  else if (where === 'right') { left = row.right + gap; top = row.top + row.height / 2 - h / 2; }
  else {
    left = row.left + row.width / 2 - width / 2;
    top = row.top - gap - h;
    if (top < pad) top = row.bottom + gap;
  }
  left = Math.max(pad, Math.min(view.w - width - pad, left));
  top = Math.max(pad, Math.min(view.h - h - pad, top));
  // the arrow points at the row's middle, wherever the clamp put the window
  const arrow = where === 'above' ? Math.max(18, Math.min(width - 18, row.left + row.width / 2 - left))
    : Math.max(18, Math.min(h - 18, row.top + row.height / 2 - top));
  return { left, top, width, height:h, where, arrow };
}

// ── the three.js half ────────────────────────────────────────────────────────
const additive = (color, opacity = 0) => new THREE.MeshBasicMaterial({ color, transparent:true, opacity, depthWrite:false,
  blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });
function hexShape(r) {
  const s = new THREE.Shape();
  for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; s[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  s.closePath(); return s;
}
function textSprite(text, color = '#ffffff', h = 0.5) {
  const c = globalThis.document?.createElement('canvas'); if (!c) return null;
  c.width = 256; c.height = 128;
  const g = c.getContext('2d'); if (!g) return null;
  g.font = 'bold 84px Saira, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = '#020913d0'; g.strokeText(text, 128, 66); g.fillStyle = color; g.fillText(text, 128, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:t, transparent:true, depthWrite:false, depthTest:false }));
  s.scale.set(h * 2, h, 1); s.renderOrder = 150;
  return s;
}

/**
 * The player. `attach(host, hud)` puts the shared canvas in a window; `play(id)`
 * builds that ability's diorama and loops it until `stop()`.
 * @param o.look   lever overrides (the preview passes its sliders)
 * @param o.reduced () => prefers-reduced-motion
 */
export function createAbilityDemo({ look = {}, reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false } = {}) {
  let L = { ...ABILITY_DEMO, ...look };
  let renderer = null, canvas = null, host = null, hud = null, raf = 0, show = null, soundOn = L.sound === 'on';
  // 🔈 Sound: one gain of our own in front of the SFX bus, so the 🔈 button and
  // closing the window can silence anything already scheduled.
  let gain = null, landing = null, strikeSfx = null, curseSfx = null;
  const out = ctx => { if (!gain) { gain = ctx.createGain(); gain.gain.value = soundOn ? L.volume : 0; gain.connect(getSfxBus(ctx)); } return gain; };
  const setGain = v => { try { gain?.gain.setTargetAtTime(v, gain.context.currentTime, 0.02); } catch { if (gain) gain.gain.value = v; } };
  // ⚠️ The landing bus is cached on the AudioContext by whoever built it first,
  // so our gain cannot sit in front of it — its calls are dropped instead.
  const landingProxy = {
    setMix:(...a) => landing?.setMix?.(...a),
    land:(...a) => soundOn && landing?.land(...a), travel:(...a) => soundOn && landing?.travel(...a),
    takeoff:(...a) => soundOn && landing?.takeoff(...a), clack:(...a) => soundOn && landing?.clack(...a),
  };
  function ensureAudio() {
    if (!soundOn) return;
    landing ??= createLandingSfx({ context:getRiffAudio, output:out });
    strikeSfx ??= createBushidoSfx({ context:getRiffAudio, output:out });
    curseSfx ??= createShamisenCurseSfx({ context:getRiffAudio, output:out });
    landing.ensure?.(); strikeSfx.ensure?.(); curseSfx.ensure?.(); setGain(L.volume);
  }

  function ensureRenderer() {
    if (renderer) return renderer;
    canvas = document.createElement('canvas'); canvas.className = 'ability-demo-canvas';
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'low-power' });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
    return renderer;
  }

  // ── one diorama: scene, camera, board, standees ──
  function stageFor(cells, { focus, span, color, lookY = 1.0 }) {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05070f, 30, 70);
    scene.add(new THREE.HemisphereLight(0xddeaff, 0x34314f, 2.4));
    const k = new THREE.DirectionalLight(0xffffff, 1.8); k.position.set(4, 12, -5); scene.add(k);
    const rim = new THREE.DirectionalLight(new THREE.Color(color).lerp(new THREE.Color(0x8aa8ff), 0.5), 1.3); rim.position.set(-6, 5, -7); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(36, 1.6, 0.1, 200);
    const tileGeo = new THREE.ExtrudeGeometry(hexShape(HEX_RADIUS), { depth:0.08, bevelEnabled:false }).rotateX(-Math.PI / 2);
    const rockGeo = new THREE.ExtrudeGeometry(hexShape(HEX_RADIUS * 1.02), { depth:L.island, bevelEnabled:false }).rotateX(-Math.PI / 2);
    const glowGeo = new THREE.ShapeGeometry(hexShape(HEX_RADIUS * 0.94)).rotateX(-Math.PI / 2);
    const tileMat = new THREE.MeshStandardMaterial({ color:0x141a38, emissive:0x0a1030, roughness:0.55, metalness:0.35 });
    const rockMat = new THREE.MeshStandardMaterial({ color:0x090c1c, emissive:0x05081a, roughness:0.8, metalness:0.2 });
    const lineMat = new THREE.LineBasicMaterial({ color:0x3550a0, transparent:true, opacity:0.85 });
    const tiles = new Map();
    for (const [q, r] of cells) {
      const p = hexWorld(q, r, 0);
      const t = new THREE.Mesh(tileGeo, tileMat); t.position.set(p.x, 0.12, p.z); scene.add(t);
      if (L.backdrop === 'island' && L.island > 0) { const rk = new THREE.Mesh(rockGeo, rockMat); rk.position.set(p.x, 0.12 - L.island, p.z); scene.add(rk); }
      const pts = []; for (let i = 0; i <= 6; i++) { const a = (i * Math.PI) / 3; pts.push(new THREE.Vector3(p.x + Math.cos(a) * HEX_RADIUS, 0.203, p.z + Math.sin(a) * HEX_RADIUS)); }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      const glow = new THREE.Mesh(glowGeo, additive(color)); glow.position.set(p.x, 0.207, p.z); glow.renderOrder = 6; scene.add(glow);
      tiles.set(key(q, r), { glow, p, level:0, pulse:0 });
    }
    if (L.backdrop !== 'void') {
      const n = 260, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, e = Math.random() * 0.8 + 0.05, r = 40 + Math.random() * 20;
        pos.set([focus.x + Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r - 6, focus.z + Math.sin(a) * Math.cos(e) * r], i * 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color:0x9fb6ff, size:0.2, fog:false })));
    }
    const pawns = [];
    const pawn = (id, color, cell, facing) => {
      const st = createStandee({ ...SPIRIT_DEFS[id], color });
      st.group.rotation.order = 'YXZ';
      st.group.position.copy(hexWorld(...cell)); st.group.rotation.y = standeeYaw(facing);
      scene.add(st.group); pawns.push(st);
      return st;
    };
    // the shot: across the lane, from the camera side (+z), lifted
    const aim = (t, shake = 0) => {
      const lift = L.camera === 'high' ? 0.95 : L.camera === 'low' ? 0.28 : 0.55;
      const yaw = Math.sin(t * 0.35) * L.orbit;
      // fit the span across the frame's WIDTH: tan(hfov/2) = tan(vfov/2) × aspect
      const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      const dist = (span * 0.5 + 1.6) / halfW / Math.max(0.4, L.zoom);
      const base = new THREE.Vector3(0.18, 0, 1).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      camera.position.copy(focus).addScaledVector(base, dist * Math.cos(lift)).add(new THREE.Vector3(0, dist * Math.sin(lift) + 0.6, 0));
      if (shake > 0.002) { const w = t * 60, s = shake * 0.22; camera.position.add(new THREE.Vector3(Math.sin(w * 1.3) * s, Math.sin(w * 1.7 + 1) * s * 0.7, Math.cos(w * 1.1) * s)); }
      camera.lookAt(focus.x, lookY, focus.z);
    };
    const dispose = () => {
      for (const st of pawns) st.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); for (const m of [o.material].flat().filter(Boolean)) { m.map?.dispose?.(); m.dispose?.(); } });
    };
    return { scene, camera, tiles, pawn, aim, dispose };
  }

  // ── 🌀 Shukuchi ──
  function buildShukuchi({ color, rivalColor }) {
    const S = shukuchiScript();
    const ends = [S.start, ...S.steps.map(s => s.to)].map(c => hexWorld(...c));
    const focus = ends.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(ends.length);
    const span = Math.max(...ends.map(p => p.distanceTo(focus))) * 2;
    const st = stageFor(S.cells, { focus, span, color });
    const ronin = st.pawn('cosmic_ronin', color, S.start, facingOf(S.start, S.steps[0].to));
    const rival = S.rival ? st.pawn('Metalness_Monster', rivalColor, S.rival, Math.PI / 2) : null;
    if (S.slime) {
      const p = hexWorld(...S.slime, 0.215);
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24).rotateX(-Math.PI / 2), additive(0x64ff72, 0.32)); m.position.copy(p); st.scene.add(m);
    }
    let note = null;
    if (S.note) { note = textSprite('♪', '#ffe08a', 0.9); if (note) { note.position.copy(hexWorld(...S.note, 0.95)); st.scene.add(note); } }
    const steps = createStandeeSteps(st.scene, { pointFor:(k, y) => hexWorld(...unkey(k), y), distance:(a, b) => { const [q1, r1] = unkey(a), [q2, r2] = unkey(b); return axialDist(q1, r1, q2, r2); },
      scaleFor:() => [0, 2, 3, 5, 7, 8, 10], sfx:landingProxy, T:STANDEE_MOVE });
    const occupied = new Set([S.rival && key(...S.rival)].filter(Boolean));
    let i = -1, phase = 'intro', t0 = 0, ap = 3, picked = false, noteAt = null, cardAt = null;
    const caption = { text:'Shukuchi — every step becomes a two-hex LEAP' };
    return {
      st, label:'shukuchi',
      update(now, t, red) {
        const el = (now - t0);
        if (phase === 'intro' && el > 900) { phase = 'aim'; i = 0; t0 = now; }
        else if (phase === 'aim' && el > L.hopPause) {
          const s = S.steps[i];
          steps.step(ronin.group, { id:'cosmic_ronin', from:key(...s.from), to:key(...s.to), yaw:standeeYaw(facingOf(s.from, s.to)), color });
          ap -= SHUKUCHI_AP_PER_HOP; phase = 'hop'; t0 = now;
        } else if (phase === 'hop' && el > 120 && !steps.busy(ronin.group)) {
          if (S.steps[i].over === 'note') { picked = true; noteAt = now; }
          i++; t0 = now; phase = i < S.steps.length ? 'aim' : 'done';
        } else if (phase === 'done' && el > 900) { phase = 'card'; cardAt = now; }
        const s = S.steps[Math.min(Math.max(i, 0), S.steps.length - 1)];
        caption.text = phase === 'intro' ? 'Shukuchi — every step becomes a two-hex LEAP'
          : phase === 'done' || phase === 'card' ? 'Three leaps = three of your steps' : s.caption;
        // targets: every empty hex exactly two away, the chosen one brightest
        for (const tile of st.tiles.values()) tile.level = 0;
        if (L.targets === 'on' && (phase === 'aim' || phase === 'intro') && i < S.steps.length) {
          const from = i < 0 ? S.start : s.from;
          for (const c of ring(from, SHUKUCHI_HOP_RINGS)) { const tile = st.tiles.get(key(...c)); if (tile && !occupied.has(key(...c))) tile.level = 0.22; }
          if (phase === 'aim') { const tile = st.tiles.get(key(...s.to)); if (tile) tile.level = 0.55 + 0.3 * Math.sin(now * 0.012); }
        }
        for (const tile of st.tiles.values()) tile.glow.material.opacity = tile.level;
        const drove = steps.drive(ronin.group, now, red);
        if (!drove) { ronin.group.position.y = STANDEE_Y; }
        ronin.frame(t, { acting:true, reduced:red, cameraPos:st.camera.position, lift:drove?.lift ?? 0 });
        ronin.group.rotation.z = drove?.roll ?? 0;
        rival?.frame(t, { reduced:red, cameraPos:st.camera.position });
        steps.update(now, 1 / 60);
        if (note) {
          if (!picked) { note.position.y = 0.95 + Math.sin(t * 2.4) * 0.12; note.material.opacity = 1; }
          else { const k = Math.min(1, (now - noteAt) / 600); note.position.y = 0.95 + k * 1.8; note.material.opacity = 1 - k; note.scale.set(1.8 * (1 + k), 0.9 * (1 + k), 1); }
        }
        st.aim(t);
        return {
          caption:caption.text, card:phase === 'card' ? shukuchiEndCard() : null,
          chips:[{ label:'AP', pips:3, left:ap }, { label:`${SHUKUCHI_CD}-round CD`, on:i >= 0 && phase !== 'intro' }, ...(picked ? [{ label:'+1 note 🎵', on:true }] : [])],
          over:phase === 'card' && now - cardAt > L.endMs,
        };
      },
      start(now) { t0 = now; },
      dispose() { steps.dispose(); st.dispose(); },
    };
  }

  // ── ⚡ Psycho Bushido ──
  let cycle = 0;
  function buildBushido({ color, rivalColor }) {
    const name = L.scenario === 'cycle' ? SCENARIO_ORDER[cycle++ % SCENARIO_ORDER.length] : L.scenario;
    const sc = bushidoScenario(name);
    // 📌 (1,0) runs right and slightly TOWARD the lens, so his print (which faces
    // down the lane) reads three-quarter on rather than edge-on.
    const DIR = [1, 0];
    const laneCell = i => [DIR[0] * i, DIR[1] * i];
    const dist = sc.dist, push = sc.push;
    const cells = around(Array.from({ length:dist + push + 2 }, (_, i) => laneCell(i - 1)), 1);
    const from = hexWorld(...laneCell(0)), target = hexWorld(...laneCell(dist)), to = hexWorld(...laneCell(dist - 1));
    const focus = from.clone().lerp(hexWorld(...laneCell(dist + push)), 0.5);
    const span = from.distanceTo(hexWorld(...laneCell(dist + push))) + 1.5;
    const st = stageFor(cells, { focus, span, color });
    const facing = facingOf(laneCell(0), laneCell(1));
    const ronin = st.pawn('cosmic_ronin', color, laneCell(0), facing);
    const rival = st.pawn('Metalness_Monster', rivalColor, laneCell(dist), Math.PI / 2);
    // the Rival's Sustain amp, behind him, where its rings come from
    const amp = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.8), new THREE.MeshStandardMaterial({ color:0x121726, roughness:0.5, metalness:0.4 }));
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.05), new THREE.MeshBasicMaterial({ color:new THREE.Color(rivalColor).multiplyScalar(0.55), toneMapped:false }));
    grille.position.set(0, 0.05, 0.41); cab.position.y = 0.75; grille.position.y = 0.8; amp.add(cab, grille);
    amp.position.copy(target).add(new THREE.Vector3(1.2, 0, -2.9)); amp.lookAt(target.x, 0, target.z); st.scene.add(amp);
    const sustainOrigin = amp.position.clone().setY(0.2 + 1.5 * 0.62);
    const lane = Array.from({ length:dist + 1 }, (_, i) => from.clone().lerp(target, i / dist));
    const way = target.clone().sub(from).setY(0).normalize();
    const S = BUSHIDO_STRIKE;
    const shieldFace = target.clone().addScaledVector(way, -Math.min(1.35, 0.82 * S.shieldSize)).setY(target.y + 1.3);
    const landings = driveLandings(sc);
    const art = () => ronin.parts.find(m => m.material?.map) ?? null;
    const strike = createBushidoStrikeVisuals({ battle:sc.battle, from, to, target, lane, shieldFace, landings, launch:BARRAGE_LAUNCH, color, art });
    st.scene.add(strike.group);
    const volley = createSonicClashVisuals({ attackerPosition:hexWorld(...laneCell(0), 1), defenderPosition:hexWorld(...laneCell(dist), 1),
      color, shieldColor:rivalColor, hitCount:sc.battle.hitCount, damage:sc.battle.damage, chordPitches:[], shieldValue:sc.shieldValue,
      battle:sc.battle, ampOrigins:[], sustainOrigin, clearance:1.15, beams:false,
      shieldRadius:Math.min(1.35, 0.82 * S.shieldSize), shieldSize:1.6 * S.shieldSize,
      buildStart:SONIC_DICE.landedAt[1] - BARRAGE_LAUNCH, buildEnd:SONIC_GATE - BARRAGE_LAUNCH });
    st.scene.add(volley.group);
    const plan = strike.plan;
    const pushAt = plan.burstEnd / 1000 + 0.35;
    const endSeq = Math.max(plan.recoverEnd / 1000, pushAt + 0.8 * push) + 1.4;
    const warp = demoWarp(L, plan, endSeq);
    const caps = bushidoCaptions(sc, plan);
    // range marks on the lane: 1 and 2 are too close, 3–5 are the draw
    const marks = [];
    if (L.rangeMarks === 'on') for (let i = 1; i <= PSYCHO_BUSHIDO_MAX_RANGE; i++) {
      const ok = i >= PSYCHO_BUSHIDO_MIN_RANGE, s = textSprite(ok ? String(i) : '✕', ok ? '#ffe08a' : '#ff8a8a', 0.42);
      if (!s) continue; s.position.copy(hexWorld(...laneCell(i), 0.55)); st.scene.add(s); marks.push(s);
    }
    const steps = createStandeeSteps(st.scene, { pointFor:(k, y) => hexWorld(...unkey(k), y), distance:(a, b) => { const [q1, r1] = unkey(a), [q2, r2] = unkey(b); return axialDist(q1, r1, q2, r2); },
      scaleFor:() => [0], sfx:landingProxy, T:STANDEE_MOVE });
    let t0 = 0, pushed = false, scheduled = false;
    const susLand = sustainLandings(sc);
    return {
      st, label:`psycho_bushido:${name}`, scenario:sc,
      start(now) {
        t0 = now;
        if (soundOn && strikeSfx) {
          strikeSfx.stopAll?.();
          scheduleBushidoStrike(strikeSfx, { battle:sc.battle, at:seq => warp.toDemo(seq) - (performance.now() - t0) / 1000,
            landings:landings.map(d => ({ t:d.at / 1000, amt:d.amt })), launch:BARRAGE_LAUNCH, L:S, landing:null });
          scheduled = true;
        }
      },
      update(now, t, red) {
        const d = (now - t0) / 1000, seq = warp.toSeq(d);
        // the lane at the start: where he can draw from, the Rival's hex brightest
        for (const [k2, tile] of st.tiles) {
          const [q, r] = unkey(k2), i = q * DIR[1] === r * DIR[0] && q * DIR[0] >= 0 ? Math.abs(q || r) : -1;
          tile.level = seq < 1.6 && i >= PSYCHO_BUSHIDO_MIN_RANGE && i <= PSYCHO_BUSHIDO_MAX_RANGE ? (i === dist ? 0.5 : 0.18) * Math.min(1, (1.6 - seq) / 0.4) : 0;
          tile.glow.material.opacity = tile.level;
        }
        for (const m of marks) m.material.opacity = Math.max(0, Math.min(1, (2.2 - seq) / 0.5));
        const res = strike.update(seq, { reduced:red, pawn:ronin.group, camera:st.camera });
        volley.update(seq - BARRAGE_LAUNCH, { reduced:red, camera:st.camera, defenderPosition:rival.group.position.clone().setY(1) });
        const bp = res.pose.active ? res.pose : null;
        if (bp) {
          ronin.group.position.set(bp.at.x + bp.jitter.x, bp.at.y + bp.y, bp.at.z + bp.jitter.z);
          ronin.group.rotation.x = bp.pitch; ronin.group.rotation.z = bp.roll;
          ronin.group.scale.set(bp.sxz * bp.vis, bp.sy * bp.vis, bp.sxz * bp.vis);
          ronin.frame(t, { acting:true, reduced:red, cameraPos:st.camera.position, lift:bp.y / Math.max(0.05, bp.sy) });
        } else {
          ronin.group.position.copy(seq >= plan.arrive / 1000 ? to : from); ronin.group.rotation.x = 0; ronin.group.rotation.z = 0; ronin.group.scale.setScalar(1);
          ronin.frame(t, { acting:true, reduced:red, cameraPos:st.camera.position });
        }
        // the push: one hex back along the lane per die that got through — the Sonic's
        if (!pushed && push > 0 && seq >= pushAt) {
          pushed = true;
          for (let i = 0; i < push; i++) steps.step(rival.group, { id:'Metalness_Monster', from:key(...laneCell(dist + i)), to:key(...laneCell(dist + i + 1)),
            yaw:rival.group.rotation.y, shoved:true, color:rivalColor });
        }
        const drove = steps.drive(rival.group, now, red);
        rival.frame(t, { reduced:red, cameraPos:st.camera.position, lift:drove?.lift ?? 0 });
        rival.group.rotation.z = drove?.roll ?? 0;
        steps.update(now, 1 / 60);
        st.aim(t, red ? 0 : res.shake);
        // HUD: the Rival's Sustain, then his Drive (the d6 → d8 flip first)
        const rolling = (thrownAt, landAt) => seq >= thrownAt && seq < landAt;
        const sus = sc.sustainFaces.map((face, i) => ({ sides:sc.sustainPool[i], face:seq >= susLand[i].at / 1000 ? face : rolling(0.25, 9) ? 1 + Math.floor((now / 70 + i * 3) % sc.sustainPool[i]) : null,
          kept:seq >= SONIC_DICE.landedAt[1] + 0.2 && keptIdx(sc.sustainFaces, sc.sustainPool).includes(i), shown:seq >= 0.25 }));
        const flipAt = i => warp.upgradeAt + 0.3 + 0.32 * sc.pool.slice(0, i + 1).filter((s, j) => s !== sc.base[j]).length;
        const drv = sc.faces.map((face, i) => ({ sides:sc.pool[i] !== sc.base[i] && seq >= flipAt(i) ? sc.pool[i] : sc.base[i], flip:sc.pool[i] !== sc.base[i] && seq >= flipAt(i),
          face:seq >= landings[i].at / 1000 ? face : rolling(SONIC_GATE, 99) ? 1 + Math.floor((now / 70 + i * 5) % sc.pool[i]) : null,
          kept:seq >= SONIC_DICE.landedAt[0] + 0.25 && sc.drive.keptIdx.includes(i), shown:seq >= warp.upgradeAt - 0.2 }));
        const over = d >= warp.duration;
        return {
          caption:captionAt(caps, seq), card:d >= warp.duration - 0.01 && L.endCard === 'on' ? bushidoEndCard() : null,
          dice:{ sustain:sus, drive:drv, shield:seq >= SONIC_DICE.landedAt[1] + 0.2 ? sc.shieldValue : null,
            through:seq >= plan.burstEnd / 1000 ? sc.ledger.strengthThrough : null, dist },
          over:over && (d - warp.duration) * 1000 > (L.endCard === 'on' ? L.endMs : 300),
        };
      },
      dispose() { if (scheduled) strikeSfx?.stopAll?.(); steps.dispose(); strike.dispose(); volley.dispose(); st.dispose(); },
    };
  }
  const keptIdx = (faces, pool) => keepBest(faces, pool, KEEP).keptIdx;

  // ── 🎸 Cursed Shamisen ──
  let curseLoop = 0;
  function buildShamisen({ color, rivalColor }) {
    const D = SHAMISEN_DEMO, sc = shamisenScript(D);
    const ending = curseLoop++ % 2 === 0 ? 'exorcised' : 'expired';
    const caps = shamisenCaptions(sc, ending, D);
    const a = hexWorld(...D.roninCell), b = hexWorld(...D.rivalCell);
    // ⚠️ THE INSTRUMENT HANGS ~3 m OVER HIM, so the shot is framed on the pair and
    // lifted: the focus rises toward it and the span is widened to keep it in.
    const focus = a.clone().lerp(b, 0.5);
    const span = a.distanceTo(b) + 5;
    // ⚠️ AIMED HIGHER THAN THE OTHER DEMOS (lookY): the shamisen hangs ~4 m up.
    const st = stageFor(around([D.roninCell, D.rivalCell], 1), { focus, span, color, lookY:2.6 });
    const ronin = st.pawn('cosmic_ronin', color, D.roninCell, facingOf(D.roninCell, D.rivalCell));
    // The rival faces the lens (as in the Bushido demo) — edge-on, the charm and
    // the sick violet edge would be a sliver.
    const rival = st.pawn('Metalness_Monster', rivalColor, D.rivalCell, Math.PI / 2);
    const vis = createCursedShamisenVisuals({ ronin, rival, color });
    vis.group.visible = false;
    st.scene.add(vis.group);
    let t0 = 0, done = new Set(), last = { dim:0 };
    const once = (k, fn) => { if (!done.has(k)) { done.add(k); fn(); } };
    return {
      st, label:`cursed_shamisen:${ending}`, ending,
      start(now) { t0 = now; },
      update(now, t, red) {
        const d = (now - t0) / 1000, at = s => now - (d - s) * 1000;
        if (d >= D.upAt) once('up', () => { vis.group.visible = true; if (soundOn) curseSfx?.pluck(midiHz(D.midi), { vel:0.7, dark:0.55 }); });
        D.tuneAt.forEach((s, i) => { if (d >= s) once(`tune${i}`, () => {
          vis.tune(i, sc.labels[i], at(s));
          if (soundOn) curseSfx?.pluck(midiHz(D.midi + 12 + sc.ivs[i] + 12 * sc.octaves[i]), { delay:CURSED_SHAMISEN.tuneMs * 0.75 / 1000, detune:CURSED_SHAMISEN.detune });
        }); });
        if (d >= D.castAt) once('cast', () => { vis.cast(at(D.castAt), sc.ivs); if (soundOn && curseSfx) scheduleCast(curseSfx, sc.plan, D.midi, CURSED_SHAMISEN); });
        if (d >= sc.burnAt) once('burn', () => { vis.burnOne(at(sc.burnAt)); if (soundOn) curseSfx?.burnOut(); });
        if (d >= sc.endAt) once('end', () => {
          if (ending === 'exorcised') { vis.exorcise(at(sc.endAt)); if (soundOn) curseSfx?.exorcise(midiHz(64)); }
          else { vis.burnOne(at(sc.endAt)); if (soundOn) curseSfx?.expire(midiHz(D.midi + 12)); }
        });
        last = vis.update(now, { reduced:red, camera:st.camera });
        ronin.frame(t, { acting:true, reduced:red, cameraPos:st.camera.position });
        rival.frame(t, { reduced:red, cameraPos:st.camera.position });
        // the reach, at the start: every hex within it, the rival's brightest
        for (const [k2, tile] of st.tiles) {
          const [q, r] = unkey(k2), dist = axialDist(q, r, ...D.roninCell);
          tile.level = d > D.tuneAt[2] && d < D.castAt + 0.8 && dist > 0 && dist <= SONIC_BEAM_REACH
            ? (key(...D.rivalCell) === k2 ? 0.55 : 0.16) * Math.min(1, (D.castAt + 0.8 - d) / 0.4) : 0;
          tile.glow.material.opacity = tile.level;
          tile.glow.material.color.set(CURSED_SHAMISEN.edgeColor);
        }
        st.aim(t, red ? 0 : last.shake);
        const tuned = D.tuneAt.filter(s => d >= s).length;
        const cast = d >= D.castAt;
        return {
          caption:captionAt(caps, d), exposure:1 - 0.6 * Math.min(1, last.dim ?? 0),
          chips:[{ label:'Strings', pips:STRINGS, left:cast ? 0 : tuned }, { label:`${CURSED_SHAMISEN_CD}-round CD`, on:cast }, { label:'Action', on:cast },
            ...(d >= sc.landed && d < sc.endAt + 0.4 ? [{ label:`呪 cursed · ${d >= sc.burnAt ? 1 : 2} turn${d >= sc.burnAt ? '' : 's'}`, on:true }] : [])],
          card:d >= sc.total - 1.6 && L.endCard === 'on' ? shamisenEndCard() : null,
          over:d >= sc.total - 1.6 + (L.endCard === 'on' ? L.endMs : 300) / 1000,
        };
      },
      dispose() { if (soundOn) curseSfx?.stopAll?.(); vis.dispose(); st.dispose(); },
    };
  }

  // ── the HUD (DOM, built here so React does not re-render 60 times a second) ──
  function paintHud(state) {
    if (!hud) return;
    const cap = hud.querySelector('[data-demo=caption]'), chips = hud.querySelector('[data-demo=chips]'), card = hud.querySelector('[data-demo=card]');
    if (cap) { const txt = L.captions === 'on' ? state.caption ?? '' : ''; if (cap.textContent !== txt) cap.textContent = txt; }
    if (chips) {
      const sig = JSON.stringify([state.chips, state.dice]);
      if (chips.dataset.sig !== sig && L.hud === 'on') {
        chips.dataset.sig = sig; chips.replaceChildren();
        const chip = (text, cls = '') => { const s = document.createElement('span'); s.className = `ability-demo-chip ${cls}`; s.textContent = text; chips.append(s); return s; };
        for (const c of state.chips ?? []) {
          if (c.pips) chip(`${c.label} ${'●'.repeat(Math.max(0, c.left))}${'○'.repeat(Math.max(0, c.pips - c.left))}`, 'is-ap');
          else chip(c.label, c.on ? 'is-on' : 'is-off');
        }
        if (state.dice) {
          const row = (label, dice, cls, total) => {
            if (!dice.some(x => x.shown)) return;
            const g = document.createElement('span'); g.className = `ability-demo-dice ${cls}`;
            const b = document.createElement('b'); b.textContent = label; g.append(b);
            for (const x of dice) {
              const s = document.createElement('i');
              s.className = `${x.kept ? 'is-kept' : ''} ${x.flip ? 'is-d8' : ''} ${x.face == null ? 'is-blank' : ''}`;
              s.textContent = x.face == null ? `d${x.sides}` : String(x.face);
              s.title = `d${x.sides}`; s.dataset.sides = `d${x.sides}`;
              g.append(s);
            }
            if (total != null) { const t = document.createElement('em'); t.textContent = total; g.append(t); }
            chips.append(g);
          };
          row('SUSTAIN', state.dice.sustain, 'is-rival', state.dice.shield != null ? `🛡 ${state.dice.shield}` : null);
          row('DRIVE', state.dice.drive, 'is-you', state.dice.through != null ? `⚡ ${state.dice.through} through` : null);
        }
      } else if (L.hud !== 'on' && chips.childElementCount) { chips.replaceChildren(); chips.dataset.sig = ''; }
    }
    if (card) {
      const on = !!state.card;
      card.classList.toggle('show', on);
      if (on && card.dataset.title !== state.card.title) {
        card.dataset.title = state.card.title; card.replaceChildren();
        const h = document.createElement('strong'); h.textContent = state.card.title; card.append(h);
        for (const line of state.card.lines) { const p = document.createElement('span'); p.textContent = line; card.append(p); }
      }
    }
  }

  function frame(now) {
    raf = 0;
    if (!show || !host) return;
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) renderer.setSize(w, h, false);
    show.act.st.camera.aspect = w / h; show.act.st.camera.updateProjectionMatrix();
    const red = reduced();
    const state = show.act.update(now, now / 1000, red);
    // 🌑 the Shamisen's cast hushes the world (`exposure`); every other demo leaves it at 1
    renderer.toneMappingExposure = state.exposure ?? 1;
    renderer.render(show.act.st.scene, show.act.st.camera);
    paintHud(state);
    if (state.over) restart(now + L.loopPause);
    raf = requestAnimationFrame(frame);
  }
  function build() {
    return show.id === 'shukuchi' ? buildShukuchi(show.opts) : show.id === 'cursed_shamisen' ? buildShamisen(show.opts) : buildBushido(show.opts);
  }
  function restart(at = performance.now()) {
    show.act.dispose();
    show.act = build();
    show.act.start(at);
  }

  function halt() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (show) { show.act?.dispose(); show = null; }
    strikeSfx?.stopAll?.(); curseSfx?.stopAll?.();
    setGain(0);
  }

  return {
    get canvas() { return canvas; },
    get playing() { return show?.id ?? null; },
    get scenario() { return show?.act?.scenario?.name ?? null; },
    hasDemo,
    /** Put the canvas in `el` (the window's picture box); `hudEl` holds the caption/chips/card slots. */
    attach(el, hudEl = null) {
      ensureRenderer();
      host = el; hud = hudEl;
      if (canvas.parentNode !== el) el.prepend(canvas);
    },
    play(id, { color = '#4ea6ff', rivalColor = '#ff8a3d' } = {}) {
      if (!hasDemo(id)) return false;
      ensureRenderer();
      if (show?.id === id && show.opts.color === color) { if (!raf) raf = requestAnimationFrame(frame); return true; }
      halt();   // ⚠️ NOT stop(): that also takes the canvas out of the window `attach` just put it in
      ensureAudio();
      show = { id, opts:{ color, rivalColor } };
      show.act = build(); show.act.start(performance.now());
      raf = requestAnimationFrame(frame);
      return true;
    },
    stop() {
      halt();
      if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
      host = null; hud = null;
    },
    setLook(next) { L = { ...ABILITY_DEMO, ...next }; },
    setSound(on) { soundOn = !!on; if (soundOn) ensureAudio(); setGain(soundOn ? L.volume : 0); },
    get sound() { return soundOn; },
    dispose() { this.stop(); renderer?.dispose(); renderer?.forceContextLoss?.(); renderer = null; canvas = null; },
  };
}
