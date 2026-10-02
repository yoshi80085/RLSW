// ─── 🎸 CURSED SHAMISEN — THE IWATO CURSE (the pure half) ───────────────────
// Alex, 2026-10-02 — `RONIN_ABILITY_DESIGN.md` §2.3.00. The rules, in one line
// each:
//   · TUNING — a third chord-step destination: three strings, one IWATO note
//     (1 ♭2 4 ♭5 ♭7 on the RONIN'S root) each, one string a turn, kept between
//     turns.
//   · THE CAST spends the three strings (plus the Action Token and cooldown).
//   · THE CURSE — the rival's Scale Wheel becomes Iwato for their next 2 turns;
//     their other notes are discord (no fans — the existing rule).
//   · EXORCISM — on their very next turn, a melody with 3 DIFFERENT Iwato notes
//     lifts it.
// And Alex on the look: *"The animation of it is really what captures the hearts
// of the players"* — five moments (tuning, the cast, the infection, the
// countdown, exorcism/expiry), dialled in on `.scratch/cursed-shamisen-preview`
// before any of it is ported.
//
// THIS FILE: the rule helpers (pure, engine-ready) and every number of the look
// (`CURSED_SHAMISEN`, ONE copy — the preview reads its defaults from here), plus
// the cast's beat plan. The three.js half is `cursedShamisenVisuals.js`, the
// sound `audio/shamisenCurseSfx.js`, the wheel's infection `ui/CursedWheel.jsx`.
//
// ⛔ PREVIEW STAGE. Nothing in the client or the engine imports this yet.
import { pitchIndex } from '../music/notes.js';

// ── 🎵 the scale ─────────────────────────────────────────────────────────────
/** Iwato: 1 ♭2 4 ♭5 ♭7. The darkest of the Japanese pentatonics — the ♭5 is
 *  what makes it haunted rather than merely sad. */
export const IWATO = Object.freeze([0, 1, 5, 6, 10]);
export const IWATO_DEGREES = Object.freeze(['1', '♭2', '4', '♭5', '♭7']);
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export const STRINGS = 3;          // a shamisen has three
export const CURSE_TURNS = 2;      // the rival's next two turns
export const EXORCISE_NOTES = 3;   // different Iwato notes in one melody

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

/**
 * Can this note go on a string? It must be Iwato on the Ronin's root. Repeats
 * ARE allowed (Alex, 2026-10-02: "any random note from the scale"); a repeated
 * pitch is tuned an octave higher (`stringOctaves`), so it still sings.
 * `distinct` keeps the old proposal one switch away. `strings` = notes already tuned.
 */
export function canTune(strings, note, roninRoot, { distinct = false } = {}) {
  if (strings.length >= STRINGS || !isIwato(note, roninRoot)) return false;
  return !distinct || !strings.some(s => pitchIndex(s) === pitchIndex(note));
}

/** Does this melody exorcise the curse? 3 DIFFERENT Iwato pitch classes. */
export function exorcises(line, roninRoot) {
  const pcs = iwatoPcs(roninRoot);
  return new Set(line.map(n => pitchIndex(n)).filter(pc => pcs.includes(pc))).size >= EXORCISE_NOTES;
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
