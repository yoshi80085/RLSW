// =============================================================================
// audio/spiritSting.js — 🎭 THE SPIRIT-SELECT STING (2026-09-28)
// -----------------------------------------------------------------------------
// Alex: *"Menu screen - there should be a sound when a Spirit is selected - have
// it play something that signifies 'who they are' as a Spirit."*
//
// A two-to-three-second calling card per Spirit, built ONLY from things that
// are already that Spirit in the game, so the sting teaches what the match will
// sound like instead of inventing a second identity:
//   • their OWN palette (`music/melodyIdentity.js` SPIRIT_MELODY_MODES) — every
//     pitched note is in their mode, and the phrase leans on the note that
//     makes the mode theirs (the Ronin's ♭6, the Monster's ♭2, Zero's ♮6);
//   • their OWN rig (`ampVoice.js` SPIRIT_TONES) — KATANA, FUZZ, the cosmic
//     triangle — plus the Ronin's shamisen;
//   • a noise that is their character (a blade drawn, a cabinet slam, a laser).
//
//   🗡️ Ronin     — the blade is drawn; a Tsugaru shamisen strike; a KATANA run
//                  up Hirajoshi that bends a whole step into the singing fifth.
//   👹 Monster   — a palm-muted gallop with the Phrygian ♭2 snarling at the end
//                  of it, then the power-chord SLAM and the cabinet boom.
//   🌀 Zero      — a laser zap; a Dorian arpeggio (the ♮6 is the bright one);
//                  a falling-then-rising orbit note that echoes out, a sub drop.
//   🎀 Glamarchy — stomp-stomp-CLAP, a Lydian strut (the ♯4), a glitter gliss.
//                  (IN DEVELOPMENT — her card is locked, so this never plays in
//                  the lobby today; it exists so the bench can audition her.)
//
// ⚠️ PRESENTATION ONLY and LOCAL ONLY. Nothing here touches the engine, and the
// lobby plays it for the player who CLICKED — a remote player's pick arrives as
// room state and is silent, or four online players would hear four stings.
//
// 📌 `SPIRIT_STING` is Alex's dial-in; each Spirit's phrase is still a first
// guess. The Spirit Sound Bench plays them.
// =============================================================================

import { SPIRIT_TONES, playAmpNote, getAmpBuses } from "./ampVoice.js";
import { getSfxBus } from "./riffSfx.js";

/** Shared levers. 🎛️ notes / fx / tempo are ALEX'S DIAL-IN (2026-09-28, the
 *  Spirit Sound Bench v4): louder than the first guess on both halves, and
 *  22% slower — the stings breathe. `duck` and `cutMs` were not on the bench. */
export const SPIRIT_STING = Object.freeze({
  notes: 1.35,    // × every phrase note's own volume
  fx:    1.42,    // × every character noise
  tempo: 1.22,    // × every `at` — above 1 is slower
  duck:  0.35,    // the menu song drops to this share while a sting plays
  cutMs: 90,      // a new pick fades the last sting out over this
});

const A4 = 440;
const NOTE_INDEX = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
/** Hz of `root` in octave `octave`, moved `semis` semitones. */
export function stingHz(root, octave, semis) {
  return A4 * Math.pow(2, (NOTE_INDEX[root] + (octave - 4) * 12 + semis) / 12);
}

// A phrase note: `at` ms from the start · `s` semitones above the root ·
// `hold`/`fade` seconds · `vol` · optional `bend` (semitones it starts away and
// slides in from), `bendTime`, `knobs` (a per-note rig override, e.g. shamisen).
// ⚠️ `s` mod 12 MUST be in the Spirit's mode — `spiritStingCheck` §1 holds it.
// A power-chord note is written as its own entry at the same `at`.
const SHAMI = { voice: 'shamisen', drive: 0.1, tone: 0.62, echo: 0.16, verb: 0.32 };   // = commitStyles `tsugaru`

export const SPIRIT_STINGS = Object.freeze({
  // 🗡️ Hirajoshi + P4 on E: E F♯ G A B C (0 2 3 5 7 8).
  cosmic_ronin: Object.freeze({
    label: 'The draw', mode: 'hirajoshi', root: 'E', octave: 4, rig: SPIRIT_TONES.cosmic_ronin,
    fx: Object.freeze([{ kind: 'sheath', at: 0, level: 0.16 }]),
    notes: Object.freeze([
      { at: 220, s: -12, hold: 0.30, fade: 0.5,  vol: 0.20, knobs: SHAMI },   // TON — the open string, struck
      { at: 470, s: 0,   hold: 0.07, fade: 0.1,  vol: 0.14, knobs: SHAMI },   // te
      { at: 540, s: 3,   hold: 0.07, fade: 0.1,  vol: 0.14, knobs: SHAMI },   // te
      { at: 610, s: 8,   hold: 0.14, fade: 0.2,  vol: 0.17, knobs: SHAMI },   // TON on the ♭6 — the Hirajoshi colour
      { at: 820, s: 5,   hold: 0.06, fade: 0.06, vol: 0.13 },                 // KATANA: the run up
      { at: 880, s: 7,   hold: 0.06, fade: 0.06, vol: 0.13 },
      { at: 940, s: 8,   hold: 0.06, fade: 0.06, vol: 0.14 },
      { at: 1000, s: 12, hold: 0.06, fade: 0.06, vol: 0.15 },
      { at: 1080, s: 19, hold: 1.05, fade: 0.9,  vol: 0.19, bend: -2, bendTime: 0.22 }, // bent into the fifth; RONIN_LEAD sings it
    ]),
  }),
  // 👹 Phrygian on E: E F G A B C D (0 1 3 5 7 8 10). Low, gallop, then SLAM.
  Metalness_Monster: Object.freeze({
    label: 'The slam', mode: 'phrygian', root: 'E', octave: 2, rig: SPIRIT_TONES.Metalness_Monster,
    fx: Object.freeze([{ kind: 'slam', at: 700, level: 0.5 }]),
    notes: Object.freeze([
      ...[0, 90, 150, 300, 390, 450].map(at => ({ at, s: 0, hold: 0.05, fade: 0.05, vol: 0.15, knobs: { tone: 0.16 } })), // palm-muted gallops
      { at: 560, s: 1,  hold: 0.08, fade: 0.08, vol: 0.16 },                  // the ♭2 — the Phrygian snarl
      { at: 700, s: 0,  hold: 1.10, fade: 1.0,  vol: 0.22 },                  // SLAM: root
      { at: 700, s: 7,  hold: 1.10, fade: 1.0,  vol: 0.13 },                  //       fifth
      { at: 700, s: 12, hold: 1.10, fade: 1.0,  vol: 0.10 },                  //       octave
    ]),
  }),
  // 🌀 Dorian on A: A B C D E F♯ G (0 2 3 5 7 9 10). Up the arp, out into orbit.
  intergalactic_0: Object.freeze({
    label: 'The launch', mode: 'dorian', root: 'A', octave: 3, rig: { ...SPIRIT_TONES.intergalactic_0, echo: 0.82, verb: 0.34 },
    fx: Object.freeze([{ kind: 'laser', at: 0, level: 0.10 }, { kind: 'drop', at: 980, level: 0.35 }]),
    notes: Object.freeze([
      { at: 260, s: 0,  hold: 0.10, fade: 0.14, vol: 0.14 },
      { at: 350, s: 3,  hold: 0.10, fade: 0.14, vol: 0.14 },
      { at: 440, s: 7,  hold: 0.10, fade: 0.14, vol: 0.14 },
      { at: 530, s: 9,  hold: 0.10, fade: 0.14, vol: 0.15 },                  // the ♮6 — the bright Dorian note
      { at: 620, s: 12, hold: 0.10, fade: 0.14, vol: 0.15 },
      { at: 710, s: 15, hold: 0.10, fade: 0.14, vol: 0.15 },
      { at: 800, s: 19, hold: 0.10, fade: 0.14, vol: 0.15 },
      { at: 980, s: 21, hold: 0.9,  fade: 1.1,  vol: 0.17, bend: -7, bendTime: 0.34 }, // swoops up a fifth into orbit
    ]),
  }),
  // 🎀 Lydian on C: C D E F♯ G A B (0 2 4 6 7 9 11).
  Glamarchy: Object.freeze({
    label: 'The strut', mode: 'lydian', root: 'C', octave: 4, rig: SPIRIT_TONES.Glamarchy,
    fx: Object.freeze([{ kind: 'stomp', at: 0, level: 0.35 }, { kind: 'stomp', at: 260, level: 0.35 },
      { kind: 'clap', at: 520, level: 0.16 }, { kind: 'glitter', at: 1150, level: 0.05 }]),
    notes: Object.freeze([
      { at: 520, s: 0,  hold: 0.10, fade: 0.1, vol: 0.15 },
      { at: 640, s: 4,  hold: 0.10, fade: 0.1, vol: 0.15 },
      { at: 760, s: 6,  hold: 0.18, fade: 0.1, vol: 0.16 },                   // the ♯4 — the Lydian sparkle
      { at: 940, s: 7,  hold: 0.10, fade: 0.1, vol: 0.15 },
      { at: 1060, s: 11, hold: 0.80, fade: 0.9, vol: 0.17, bend: -1 },        // leans into the major 7th
    ]),
  }),
});

/** How long the sting lasts (ms), counting each note's hold + fade.
 *  ⚠️ `tempo` stretches the ONSETS only — a note's hold and fade are sound, not
 *  timing, so a slower sting is more space between notes, not longer notes. */
export function stingDuration(spiritId, { S = SPIRIT_STING, sting } = {}) {
  const st = sting ?? SPIRIT_STINGS[spiritId];
  if (!st) return 0;
  const k = S.tempo ?? 1;
  const noteEnd = st.notes.reduce((m, n) => Math.max(m, n.at * k + (n.hold + n.fade) * 1000), 0);
  const fxEnd = st.fx.reduce((m, f) => Math.max(m, f.at * k + (FX_LENGTH[f.kind] ?? 0) * 1000), 0);
  return Math.round(Math.max(noteEnd, fxEnd));
}

// ── The character noises ─────────────────────────────────────────────────────
const FX_LENGTH = { sheath: 0.9, slam: 1.2, laser: 0.4, drop: 0.9, stomp: 0.3, clap: 0.25, glitter: 0.8 };

function noise(ctx, seconds) {
  const key = `__rlswStingNoise${Math.round(seconds * 10)}`;
  if (ctx[key]?.sampleRate === ctx.sampleRate) return ctx[key];
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  ctx[key] = buf;
  return buf;
}
function env(ctx, t, level, attack, length) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + length);
  return g;
}
function tone(ctx, out, t, type, from, to, level, length, attack = 0.004) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(from, t);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + length * 0.8);
  const g = env(ctx, t, level, attack, length);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + length + 0.05);
}
function hiss(ctx, out, t, type, hz, q, level, length, sweepTo = hz) {
  const n = ctx.createBufferSource(); n.buffer = noise(ctx, Math.max(0.3, length));
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(hz, t);
  if (sweepTo !== hz) f.frequency.exponentialRampToValueAtTime(sweepTo, t + length * 0.7);
  const g = env(ctx, t, level, 0.006, length);
  n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + length + 0.05);
  // 🧹 Unplug once the noise has stopped — a connected biquad keeps being
  // processed (silently) for its tail, up to 30 s. See `playAmpNote`'s teardown.
  n.onended = () => { try { f.disconnect(); g.disconnect(); } catch { /* already gone */ } };
}

const FX = {
  // 🗡️ Steel sliding out of the saya, then the blade ringing (two inharmonic partials).
  sheath(ctx, out, t, L) {
    hiss(ctx, out, t, 'highpass', 1800, 0.7, L, 0.42, 7000);
    tone(ctx, out, t + 0.36, 'sine', 3140, 3140, L * 0.45, 0.9, 0.002);
    tone(ctx, out, t + 0.36, 'sine', 4710, 4710, L * 0.25, 0.6, 0.002);
  },
  // 👹 The cabinet hits the floor: a sub boom and a dark crash.
  slam(ctx, out, t, L) {
    tone(ctx, out, t, 'sine', 110, 34, L, 1.1, 0.008);
    hiss(ctx, out, t, 'lowpass', 2600, 0.5, L * 0.35, 0.9, 500);
  },
  // 🌀 A laser zap, straight down.
  laser(ctx, out, t, L) { tone(ctx, out, t, 'square', 2600, 160, L, 0.36, 0.002); },
  // 🌀 The sub drop under the orbit note.
  drop(ctx, out, t, L) { tone(ctx, out, t, 'sine', 90, 38, L, 0.9, 0.02); },
  // 🎀 Stomp, clap, glitter.
  stomp(ctx, out, t, L) { tone(ctx, out, t, 'sine', 140, 55, L, 0.28, 0.004); },
  clap(ctx, out, t, L) {
    for (const d of [0, 0.012, 0.026]) hiss(ctx, out, t + d, 'bandpass', 1400, 1.2, L, 0.18);
  },
  glitter(ctx, out, t, L) {
    [0, 2, 4, 6, 7, 9, 11, 12, 14, 16].forEach((s, i) =>
      tone(ctx, out, t + i * 0.035, 'triangle', stingHz('C', 6, s), stingHz('C', 6, s), L, 0.35, 0.002));
  },
};

/** Kinds of character noise, for the commit layer and its checks. */
export const SPIRIT_FX_KINDS = Object.freeze(Object.keys(FX));

/**
 * 🎭 One character noise on the SFX fader, at an audio-clock time. This is how
 * the commit builds' signature layer (`commitStyles.js` COMMIT_LAYERS) reaches
 * the same blade / slam / laser the stings use — one set of noises, two users.
 * @returns {boolean} false for an unknown kind or no context
 */
export function playSpiritFx(ctx, kind, when, level) {
  const fn = FX[kind];
  if (!ctx || !fn || !(level > 0)) return false;
  try { fn(ctx, getSfxBus(ctx), Math.max(ctx.currentTime, when ?? 0), level); return true; }
  catch { return false; }
}

// ── Play ──────────────────────────────────────────────────────────────────────
// ⚠️ One sting at a time, per context. A second pick fades the first out over
// `cutMs` rather than stacking on it — clicking down the roster to compare
// Spirits must sound like four Spirits, not one noise.
/**
 * @param {AudioContext} ctx
 * @param {string} spiritId   a character id (`cosmic_ronin`, …)
 * @param {{S?:object, sting?:object}} [opts]  lever overrides (the bench)
 * @returns {number} the sting's length in ms (0 = none played)
 */
export function playSpiritSting(ctx, spiritId, { S = SPIRIT_STING, sting } = {}) {
  const st = sting ?? SPIRIT_STINGS[spiritId];
  if (!ctx || !st) return 0;
  try {
    stopSpiritSting(ctx, S);
    const { master, verbBus } = getAmpBuses(ctx);
    const sfxBus = getSfxBus(ctx);
    const outs = [ctx.createGain(), ctx.createGain(), ctx.createGain()];
    outs[0].connect(master); outs[1].connect(verbBus); outs[2].connect(sfxBus);
    ctx.__rlswSting = outs;
    const t0 = ctx.currentTime + 0.03, k = S.tempo ?? 1;
    for (const n of st.notes) {
      playAmpNote(ctx, stingHz(st.root, st.octave, n.s), {
        when: t0 + n.at * k / 1000, holdTime: n.hold, fadeTime: n.fade, volume: n.vol * S.notes,
        bend: n.bend, bendTime: n.bendTime, knobs: { ...st.rig, ...(n.knobs ?? {}) },
        out: outs[0], verbOut: outs[1],
      });
    }
    for (const f of st.fx) FX[f.kind]?.(ctx, outs[2], t0 + f.at * k / 1000, f.level * S.fx);
    return stingDuration(spiritId, { S, sting: st }) || 1;
  } catch { return 0; }
}

/** Fade out whatever sting is sounding on this context. */
export function stopSpiritSting(ctx, S = SPIRIT_STING) {
  const outs = ctx?.__rlswSting;
  if (!outs) return;
  ctx.__rlswSting = null;
  const t = ctx.currentTime, end = t + S.cutMs / 1000;
  for (const g of outs) {
    try {
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, end);
      setTimeout(() => { try { g.disconnect(); } catch { /* already gone */ } }, S.cutMs + 60);
    } catch { /* a closed context */ }
  }
}
