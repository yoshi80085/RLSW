// 🔊 LOST CHORD SOUNDS — the crystal hums its note, the stage crackles it into
// being, and the note is plucked in the picker-up's own voice.
//
// 🎯 WHY IT HUMS: a Lost Chord is a NOTE. Today the board says "F#" in print;
// a crystal that rings F# when your walk can reach it (or when you point at it)
// lets the ear find it before the eye does — the same ear-training the rest of
// the game leans on. Every sound here is quiet by default and has a lever.
//
// 📌 Everything goes through the game's own amp buses (`getAmpBuses`: one
// compressor, one reverb, the NOTES fader), so a crystal can never be louder
// than a played note and the mixer's fader reaches it.
// 🎚️ Two faders, by what the sound IS: a crystal's NOTE (the hum, the pluck)
// rides the NOTES fader with every other played note; the crackle, the whoosh,
// the clinks' burst and the shatter ride the SFX fader (`getSfxBus`).
// ✅ In the game since 2026-10-08 (Alex's dial-in); `board/lostChords.js` plays it.
// The dial-in page `.scratch/lost-chord-preview.html` imports this file.
import { getAmpBuses, playAmpNote, SPIRIT_TONES } from './ampVoice.js';
import { getRiffAudio, getSfxBus } from './riffSfx.js';
import { characterId } from '../data/spiritIdentity.js';

export const NOTE_PCS = Object.freeze({ C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11 });
export const noteFreq = (note, octave = 5) => {
  const pc = NOTE_PCS[note] ?? 0;
  return 440 * Math.pow(2, (12 * (octave + 1) + pc - 69) / 12);
};

/** ⚠️ The client's pickup pitch, kept exactly: `PC_FREQ_BASE` in the monolith
 *  is the octave C4 → B4 (its table starts at A only because it is indexed from A).
 *  Same note, same register as the pluck the 2D board plays. `test:lostchords`
 *  reads that table and holds the two together. */
export const pluckFreq = note => noteFreq(note, 4);

/** The game's shared sound-effects context (the riff / landing / pyro one). */
export function audioCtx() { return getRiffAudio(); }

function out(c, verb = 0.35, fader = 'notes') {
  const { master, verbBus } = getAmpBuses(c);
  const g = c.createGain(); g.connect(fader === 'sfx' ? getSfxBus(c) : master);
  if (verb > 0) { const s = c.createGain(); s.gain.value = verb; g.connect(s); s.connect(verbBus); }
  return g;
}
function noise(c, secs) {
  const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * secs)), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; return s;
}

// The three hum timbres. Glass = a struck wine glass (nearly harmonic, long);
// bell = the inharmonic partials of a small bell; sine = just the pitch.
const PARTIALS = {
  glass: [[1, 1], [2, 0.22], [3.01, 0.07], [4.2, 0.03]],
  bell:  [[1, 1], [2.76, 0.32], [5.4, 0.14], [8.93, 0.05]],
  sine:  [[1, 1]],
};

/** The crystal rings its pitch. `level` 0..1 (the lever × how loud this ring is). */
export function hum(note, { voice = 'glass', volume = 0.5, octave = 5, dur = 1.6, when = 0 } = {}) {
  const c = audioCtx(); if (!c || volume <= 0) return;
  const t = Math.max(c.currentTime, when), f = noteFreq(note, octave), o = out(c, 0.45);
  const peak = 0.07 * volume;
  o.gain.setValueAtTime(0.0001, t);
  o.gain.exponentialRampToValueAtTime(peak, t + (voice === 'bell' ? 0.006 : 0.09));
  o.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.value = f * 0.003;
  lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.05);
  for (const [k, a] of PARTIALS[voice] ?? PARTIALS.glass) {
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = 'sine'; osc.frequency.value = f * k; lg.connect(osc.frequency);
    g.gain.value = a; osc.connect(g); g.connect(o);
    // the upper partials die first, as a struck glass does
    g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, a * 0.02), t + dur / (0.6 + k * 0.5));
    osc.start(t); osc.stop(t + dur + 0.05);
  }
}

/** ⚡ The spawn: a crackle, a low thump, then the crystal's note shimmering in. */
export function spawnSound(note, { volume = 0.6, octave = 5, voice = 'glass', style = 'below' } = {}) {
  const c = audioCtx(); if (!c || volume <= 0) return;
  const t = c.currentTime, o = out(c, 0.25, 'sfx');
  if (style !== 'grow') {
    // crackle: gated band-passed noise
    const n = noise(c, 0.6), bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = style === 'sky' ? 2600 : 3600; bp.Q.value = 0.8;
    n.connect(bp); bp.connect(g); g.connect(o);
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 14; i++) { const at = t + (style === 'sky' ? 0 : 0.18) + i * 0.028 + Math.random() * 0.02; g.gain.setValueAtTime((0.25 + Math.random() * 0.25) * volume * (1 - i / 16), at); g.gain.setValueAtTime(0, at + 0.012); }
    n.start(t); n.stop(t + 0.7);
    // thump
    const th = c.createOscillator(), tg = c.createGain();
    th.frequency.setValueAtTime(style === 'sky' ? 110 : 80, t + (style === 'sky' ? 0.05 : 0.4)); th.frequency.exponentialRampToValueAtTime(38, t + 0.8);
    tg.gain.setValueAtTime(0.0001, t); tg.gain.exponentialRampToValueAtTime(0.35 * volume, t + (style === 'sky' ? 0.07 : 0.45)); tg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    th.connect(tg); tg.connect(o); th.start(t); th.stop(t + 1.2);
  }
  // the note grows in with the crystal
  hum(note, { voice, volume:volume * 1.3, octave, dur:2.2, when:t + 0.5 });
  hum(note, { voice:'sine', volume:volume * 0.5, octave:octave + 1, dur:1.6, when:t + 0.62 });
}

/** 🌀 The drift: a soft glassy whoosh with the note at both ends. */
export function driftSound(note, { volume = 0.6, octave = 5, voice = 'glass', ms = 1700 } = {}) {
  const c = audioCtx(); if (!c || volume <= 0) return;
  const t = c.currentTime, d = ms / 1000, o = out(c, 0.4, 'sfx');
  const n = noise(c, d), bp = c.createBiquadFilter(), g = c.createGain();
  bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(700, t + d * 0.15); bp.frequency.exponentialRampToValueAtTime(3800, t + d * 0.5); bp.frequency.exponentialRampToValueAtTime(900, t + d * 0.8);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * volume, t + d * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.85);
  n.connect(bp); bp.connect(g); g.connect(o); n.start(t); n.stop(t + d);
  hum(note, { voice, volume:volume * 0.7, octave, dur:0.8, when:t });
  hum(note, { voice, volume:volume * 1.0, octave, dur:1.6, when:t + d * 0.72 });
}

/** 💥 A scattered shard lands: a small clink of its note, an octave up. */
export function clink(note, { volume = 0.6, octave = 5, when = 0 } = {}) {
  const c = audioCtx(); if (!c || volume <= 0) return;
  hum(note, { voice:'bell', volume:volume * 0.9, octave:octave + 1, dur:0.7, when:Math.max(c.currentTime, when) });
}
export function thrashBurst({ volume = 0.6 } = {}) {
  const c = audioCtx(); if (!c || volume <= 0) return;
  const t = c.currentTime, o = out(c, 0.15, 'sfx'), n = noise(c, 0.3), hp = c.createBiquadFilter(), g = c.createGain();
  hp.type = 'highpass'; hp.frequency.value = 2400; n.connect(hp); hp.connect(g); g.connect(o);
  g.gain.setValueAtTime(0.4 * volume, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); n.start(t); n.stop(t + 0.3);
}

/** 🎵 The pickup: the glass breaks, then the note is PLAYED — by the picker-up's amp voice, or as glass. */
/** `knobs`: the picker-up's live amp settings (the client's tone panel); without
 *  them, its Spirit's stock rig (`SPIRIT_TONES`). */
export function pickupSound(note, { volume = 0.6, octave = 5, voice = 'glass', pluck = 'spirit', spiritId = 'cosmic_ronin', knobs = null, ringMs = 425 } = {}) {
  const c = audioCtx(); if (!c || volume <= 0) return;
  const t = c.currentTime, shatterAt = t + ringMs / 1000, o = out(c, 0.3, 'sfx');
  // the ring-up before the break
  hum(note, { voice, volume:volume * 1.1, octave, dur:ringMs / 1000 + 0.3, when:t });
  // the break: a highpassed burst and a scatter of tiny pings
  const n = noise(c, 0.35), hp = c.createBiquadFilter(), g = c.createGain();
  hp.type = 'highpass'; hp.frequency.value = 3200; n.connect(hp); hp.connect(g); g.connect(o);
  g.gain.setValueAtTime(0.0001, shatterAt); g.gain.exponentialRampToValueAtTime(0.32 * volume, shatterAt + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, shatterAt + 0.3);
  n.start(shatterAt); n.stop(shatterAt + 0.36);
  for (let i = 0; i < 9; i++) {
    const p = c.createOscillator(), pg = c.createGain(), at = shatterAt + 0.01 + Math.random() * 0.22;
    p.frequency.value = 3000 + Math.random() * 4500; pg.gain.setValueAtTime(0.0001, at); pg.gain.exponentialRampToValueAtTime(0.05 * volume, at + 0.002); pg.gain.exponentialRampToValueAtTime(0.0001, at + 0.06 + Math.random() * 0.08);
    p.connect(pg); pg.connect(o); p.start(at); p.stop(at + 0.2);
  }
  // the note itself
  if (pluck === 'spirit') {
    // 📌 The client's old pickup pluck, moved to the break: 0.22 at the dial-in's 0.6.
    playAmpNote(c, pluckFreq(note), { when:shatterAt + 0.04,
      knobs:knobs ?? SPIRIT_TONES[characterId(spiritId)] ?? SPIRIT_TONES.cosmic_ronin,
      volume:0.22 * volume / 0.6, holdTime:0.6, fadeTime:0.8 });
  } else if (pluck === 'glass') {
    hum(note, { voice:'bell', volume:volume * 1.4, octave, dur:1.8, when:shatterAt + 0.04 });
  }
}
