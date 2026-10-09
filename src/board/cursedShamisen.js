// ─── 🎸 CURSED SHAMISEN — THE IWATO CURSE (the pure half) ───────────────────
// ⭐ v3, "THE TRAP" (Alex, 2026-10-09 — `src/IWATO_CURSE_V3_SPEC.md`). The rules,
// in one line each:
//   · THE TRAP — the Ronin spends his Action Token to curse ONE Lost Chord
//     anywhere on the board. Only he can see it. It holds its hex (no drift) and
//     stays armed until the start of his next turn, then it is wasted.
//   · THE SPRING — a Rival who picks it up banks the note as usual AND is cursed:
//     their wheel is Iwato ON THE TRAPPED NOTE (1 ♭2 4 ♭5 ♭7 from it), with
//     three HAUNTED notes marked — all three from the creepy degrees (♭2 4 ♭5
//     ♭7, weighted toward ♭2 and ♭5); the trapped note only sets the key.
//   · THE LIFTS — each haunted note they commit in a MELODY lifts one ghost;
//     progress accumulates across turns; all three lift the paper.
//   · THE CLOCK — 3 of the Rival's turns, the springing turn counting as the
//     first (Alex, 2026-10-09: "2 rounds to deal with the curse in the melody";
//     melody comes before the move, so the springing turn has none). After the
//     third it expires. The haunted notes never change once sprung (no refresh).
//   · THE DRAW SEEPS IN — the guaranteed slice of their new notes is split
//     between the cursed wheel and their own palette: ⅓ cursed on their 2nd
//     cursed turn, ⅔ on their 3rd (`CURSED_DRAW_SHARE`). The other half stays
//     all twelve, as for everyone.
// (v1 — take up, tune three strings, cast within 3 hexes, exorcise with 3
// different Iwato notes — is `RONIN_ABILITY_DESIGN.md` §2.3.00, kept as record.)
//
// THIS FILE: the scale helpers, the haunted-note draw (pure, seeded from the
// curse's own key so every client agrees without touching the match's random
// stream) and every number of the LOOK (`CURSED_SHAMISEN`, ONE copy), plus the
// cast's beat plan — the spring plays it. The three.js half is
// `cursedShamisenVisuals.js`, the sound `audio/shamisenCurseSfx.js`, the wheel
// `ui/CursedWheel.jsx`, the rules `engine/systems/iwatoCurse.js`.
import { pitchIndex } from '../music/notes.js';

// ── 🎵 the scale ─────────────────────────────────────────────────────────────
/** Iwato: 1 ♭2 4 ♭5 ♭7. The darkest of the Japanese pentatonics — the ♭5 is
 *  what makes it haunted rather than merely sad. */
export const IWATO = Object.freeze([0, 1, 5, 6, 10]);
export const IWATO_DEGREES = Object.freeze(['1', '♭2', '4', '♭5', '♭7']);
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export const STRINGS = 3;          // a shamisen has three (the ghost instrument the spring plays)
export const CURSE_TURNS = 3;      // v3: three of the Rival's turns, the springing turn the first → two cursed melodies
/** The share of the guaranteed draw slice that comes off the cursed wheel, by
 *  cursed turn already behind them (0 = the springing turn, drawn before it). */
export const CURSED_DRAW_SHARE = Object.freeze([0, 1 / 3, 2 / 3]);
export const cursedDrawShare = turnsLeft =>
  CURSED_DRAW_SHARE[Math.min(CURSED_DRAW_SHARE.length - 1, Math.max(0, CURSE_TURNS - (turnsLeft ?? CURSE_TURNS)))];
export const HAUNTED_NOTES = 3;    // v3: three different haunted notes, each lifted by a melody
/** The creepy degrees (all of Iwato but the root) and how strongly each is drawn:
 *  ♭2 and ♭5 (the tritone) favoured. Intervals above the curse's root. */
export const CREEPY_IVS = Object.freeze([1, 5, 6, 10]);
export const CREEPY_WEIGHTS = Object.freeze({ 1:3, 5:1, 6:3, 10:1 });

/** The five Iwato pitch classes on a root (a note name or a pitch class). */
export function iwatoPcs(root) {
  const r = typeof root === 'number' ? root : pitchIndex(root);
  return IWATO.map(iv => (r + iv) % 12);
}
/** Spelled with flats — every Iwato degree but the root is a flattened one. */
export const iwatoNames = root => iwatoPcs(root).map(pc => FLATS[pc]);
export const isIwato = (note, root) => iwatoPcs(root).includes(typeof note === 'number' ? note : pitchIndex(note));
/** Which degree of Iwato a note is ('♭2'), or null. */
export function iwatoDegree(note, root) {
  const i = iwatoPcs(root).indexOf(typeof note === 'number' ? note : pitchIndex(note));
  return i < 0 ? null : IWATO_DEGREES[i];
}

// ── 👻 the haunted notes ─────────────────────────────────────────────────────
/** A small seeded PRNG (mulberry32 over a string hash). The haunted notes are
 *  drawn from the CURSE'S OWN KEY, so every client, a replay and the headless
 *  path agree without consuming a draw from the match's seeded stream. */
export function hauntRand(seed = '') {
  let h = 2166136261 >>> 0;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return () => {
    h = (h + 0x6D2B79F5) >>> 0;
    let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/**
 * Draw `n` DIFFERENT creepy intervals, weighted (`CREEPY_WEIGHTS`), never one in
 * `exclude`.
 * @returns intervals above the curse's root
 */
export function pickHaunted(rand, n = HAUNTED_NOTES, { exclude = [] } = {}) {
  const out = [];
  const taken = iv => exclude.includes(iv) || out.includes(iv);
  const weightedPick = pool => {
    const total = pool.reduce((a, iv) => a + (CREEPY_WEIGHTS[iv] ?? 1), 0);
    let u = rand() * total;
    for (const iv of pool) { u -= CREEPY_WEIGHTS[iv] ?? 1; if (u < 0) return iv; }
    return pool.at(-1);
  };
  while (out.length < n) {
    const pool = CREEPY_IVS.filter(iv => !taken(iv));
    if (!pool.length) break;
    out.push(weightedPick(pool));
  }
  return out;
}

/** The rival's wheel under the curse: which of their twelve slots are Iwato. */
export function curseSlots(roninRoot) {
  const pcs = new Set(iwatoPcs(roninRoot));
  return Array.from({ length: 12 }, (_, pc) => ({ pc, iwato: pcs.has(pc), degree: iwatoDegree(pc, roninRoot) }));
}

// ── 🎛️ the look — every taste call ──────────────────────────────────────────
export const CURSED_SHAMISEN = Object.freeze({
  // ① the ghost shamisen + tuning (the tell)
  instHeight: 3.05, instScale: 1.35, instTilt: 26, instOpacity: 0.55, instGlow: 1, instBob: 0.07,
  stringColor: 'violet', tuneMs: 650, slack: 0.16, pluckWobble: 0.11, pluckDecayMs: 900,
  noteLabel: 'on', snapMs: 700,
  // ② the cast
  hushMs: 700, hushDim: 0.55, tint: 0.65, flicker: 0.5,
  phraseTempo: 0.9, bend: 1, echo: 0.35, drone: 0.5, bell: 'on', bellAt: 120,
  wispFlightMs: 1700, wispStagger: 260, wispArc: 2.4, wispSize: 0.55, wispColor: 'ghost', wispTrail: 6,
  ofudaSize: 1.3, ofudaGlyph: '呪', slapShake: 0.45, recoverMs: 900,
  // ③ the infection
  edgeColor: '#8f4dff', infectMs: 1400, orbitRadius: 0.95, orbitHeight: 1.75, orbitSpeed: 0.35,
  miasma: 14, fanDesync: 0.85, fanDim: 0.45,
  wheelInkMs: 1600, wheelCracks: 'on', wheelGlyph: 'on', wheelIwatoGlow: 1,
  // ④ the countdown
  burnMs: 900,
  // ⑤ exorcism / expiry
  ofudaBurnMs: 1300, scatter: 3.2, exorciseFlash: 'on', cheer: 1.35, expireMs: 1600,
  // 🔊
  volume: 0.8, room: 0.45, detune: -28,
});

export const WISP_COLORS = Object.freeze({
  ghost:  { core:'#eaf2ff', rim:'#8f7bff' },   // the hitodama of the prints: blue-white, violet edge
  violet: { core:'#f2e6ff', rim:'#a24dff' },
  onibi:  { core:'#e8fff4', rim:'#3dffa8' },   // the green "demon fire"
});
export const STRING_COLORS = Object.freeze({ violet:'#b07bff', bone:'#efe4c8', player:null });

/** The strings' default tuning when none is given (the preview's story): ♭2, ♭5, ♭7. */
export const DEFAULT_STRINGS = Object.freeze([1, 6, 10]);
/** A note's interval above his root, 0–11. */
export const stringIv = (note, root) => ((typeof note === 'number' ? note : pitchIndex(note)) - (typeof root === 'number' ? root : pitchIndex(root)) + 120) % 12;

/**
 * 🎚️ THE OCTAVES — Alex, 2026-10-02: *"if the Ronin player chose 3 of the same
 * note - that wouldn't be haunting … They could perhaps be presented as different
 * octaves? … An open shamisen has 2 of the same notes."* (Honchōshi and niagari
 * both tune the third string an octave over the first.) So a string that repeats
 * a pitch already on a lower string is tuned AN OCTAVE ABOVE IT: D·D·D sounds as
 * low, middle and high D. Pitch class is unchanged — the rules see three Ds.
 * @param ivs the strings' intervals above his root, in the order they were tuned
 */
export function stringOctaves(ivs) {
  return ivs.map((iv, i) => ivs.slice(0, i).filter(x => x === iv).length);
}

/**
 * 🌑 THE CAST'S MELODY — a score, not a scale run (Alex, 2026-10-02: *"Lets make
 * the melody that plays out more haunting"*). What makes it haunting, line by line:
 *   · MA (間) — the silences are part of it; the notes are far apart and uneven.
 *   · SURI — notes SLIDE into place (`bend`, cents below/above the target).
 *   · the BACHI TREMOLO on ♭5, the note that makes Iwato haunted (`trem`).
 *   · a GHOST — the last string, high and faint, as the wisps leave (`ghost`).
 *   · it never resolves: home arrives with the ♭2 beating against it (`dyad`).
 * `s` = one of HIS STRINGS (so his tuning is the melody's heart); `iv` = a fixed
 * Iwato passing tone. `oct` is added to the string's own octave. `at` is in
 * seconds at `phraseTempo` 1.
 */
export const CAST_SCORE = Object.freeze([
  { at:0.00, s:0, oct:-1, vel:1.0, ring:true },              // the first string, struck low, left to ring
  { at:1.15, s:1, oct:0, vel:0.5, bend:-100 },               // the second slides up into place
  { at:1.70, s:0, oct:0, vel:0.4, bend:80 },                 // the first answers, sighing down onto it
  { at:2.90, iv:6, oct:0, vel:0.85, trem:4 },                // ♭5 — trembled by the bachi
  { at:3.70, iv:5, oct:0, vel:0.5, bend:100 },               // slips down to the 4th
  { at:4.30, iv:-2, oct:0, vel:0.55 },                       // ♭7, under the root
  { at:5.10, s:2, oct:1, vel:0.32, ghost:true, launch:true },// the third string, high and faint — the wisps leave
  { at:6.00, iv:0, oct:-1, vel:0.5, dyad:1 },                // home… with the ♭2 beating against it
].map(Object.freeze));

/**
 * ⏱️ THE CAST, beat by beat, in ms from the press. Pure, so the sound and the
 * picture are scheduled off the same plan.
 *   hush → (bell) → the melody (each of his strings flares when it sounds) → on
 *   the ghost note the three wisps leave the three strings (each string goes dark
 *   as its wisp leaves) → they cross the board while the melody dies away → the
 *   LAST one strikes the rival and becomes the ofuda (the slap) → the two left
 *   circle (they ARE the 2-turn countdown) → the infection → the world comes back.
 * @param ivs his three strings, as intervals above his root (`stringIv`)
 */
export function planCast(L = CURSED_SHAMISEN, ivs = DEFAULT_STRINGS) {
  const tuning = (ivs?.length === STRINGS ? ivs : DEFAULT_STRINGS);
  const octs = stringOctaves(tuning);
  const k = 1000 * Math.max(0.3, L.phraseTempo);
  const phraseStart = L.hushMs * 0.6;
  const notes = CAST_SCORE.map((e, i) => {
    let semis = e.s != null ? tuning[e.s] + 12 * (octs[e.s] + e.oct) : e.iv + 12 * e.oct;
    // ⚠️ the octave rule stacks (D·D·D + the ghost's own +1 = three octaves up): keep it on the instrument
    while (semis > 24) semis -= 12;
    while (semis < -14) semis += 12;
    const pc = ((semis % 12) + 12) % 12;
    const string = e.s != null ? e.s : Math.max(0, tuning.findIndex(t => t === pc)) % STRINGS;
    return { i, at:phraseStart + e.at * k, semis, vel:e.vel, bend:(e.bend ?? 0) * L.bend, trem:e.trem ?? 0,
      ghost:!!e.ghost, ring:!!e.ring, dyad:e.dyad ?? null, string, launch:!!e.launch };
  });
  const launchAt = notes.find(n => n.launch).at;
  const phraseEnd = notes.at(-1).at + 1200;
  const wisps = Array.from({ length:STRINGS }, (_, i) => {
    const launch = launchAt + i * L.wispStagger;
    return { i, launch, arrive:launch + L.wispFlightMs, slap:i === STRINGS - 1 };
  });
  const slapAt = Math.max(wisps.at(-1).arrive, phraseEnd - 400);
  wisps.at(-1).arrive = slapAt;
  const infectStart = slapAt, infectEnd = slapAt + L.infectMs;
  const hushOut = infectEnd, total = hushOut + L.recoverMs;
  return { hushIn:[0, L.hushMs], bellAt:L.bell === 'on' ? L.bellAt : null, notes, phraseStart, phraseEnd, launchAt, wisps, slapAt,
    infectStart, infectEnd, hushOut, total, tuning, octaves:octs };
}

/** 0…1 — how hushed the world is at `ms` into the cast. */
export function hushAt(plan, ms, L = CURSED_SHAMISEN) {
  if (ms < 0 || ms > plan.total) return 0;
  if (ms < plan.hushIn[1]) return easeInOut(ms / plan.hushIn[1]);
  if (ms < plan.hushOut) return 1;
  return 1 - easeInOut((ms - plan.hushOut) / Math.max(1, L.recoverMs));
}
export const easeInOut = u => { u = Math.max(0, Math.min(1, u)); return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2; };

/** A wisp's flight, 0…1 → a point on a lifted arc from `a` to `b` (plain {x,y,z}). */
export function wispArc(a, b, u, arc = 2.4) {
  const e = easeInOut(u);
  return { x:a.x + (b.x - a.x) * e, y:a.y + (b.y - a.y) * e + arc * Math.sin(Math.PI * e), z:a.z + (b.z - a.z) * e };
}
/** A circling wisp at `t` seconds: its angle and bob. `k` of `n` spreads them evenly. */
export function orbitPoint(centre, t, k, n, L = CURSED_SHAMISEN) {
  const a = t * Math.PI * 2 * L.orbitSpeed + (k / Math.max(1, n)) * Math.PI * 2;
  return { x:centre.x + Math.cos(a) * L.orbitRadius, y:centre.y + L.orbitHeight + 0.18 * Math.sin(a * 2 + k),
    z:centre.z + Math.sin(a) * L.orbitRadius };
}
