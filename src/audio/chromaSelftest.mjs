// ─── CHROMA / KEY-DETECT SELF-TEST ───────────────────────────────────────────
// Headless node test — no DOM, no mic. Run:  node src/audio/chromaSelftest.mjs
// Exits non-zero on failure.
//
// Synthesizes plucked-string-ish tones (fundamental + decaying harmonic series
// + a little noise), runs them through the real detection chain, and asserts
// the answers. The harmonic series is the point: a pure sine test would pass
// trivially and prove nothing, because the whole difficulty of polyphonic
// chroma is that a guitar's overtones land on OTHER chord tones.
//
// ⚠️ This is a floor, not a ceiling. Passing here means the maths is right; it
// says nothing about a real room, a real mic or a real amp. `listen-test.html`
// is where the actual tuning happens.

import assert from "node:assert/strict";
import {
  chromaFromSamples, freqToMidiFloat, fftMagnitudes, chromaFromSpectrum,
  spectralFlatness, chromaEntropy, chromaSimilarity, makeFrameGate, GATE_DEFAULTS,
} from "./chroma.js";
import {
  detectKey, chordCandidates, keyPitchClasses, activeNotes, keyToScale, detectPalette,
} from "../music/keyDetect.js";
import { PC_NAMES, evaluateChord } from "../music/chords.js";
import {
  midiToPitch, pitchToMidi, foldOntoNeck, placePitch, placeNotes, makeNeckTracker,
} from "../music/neckPlacement.js";
import {
  makePhraseRecorder, weighPhrase, impliedChord, analysePhrase,
} from "../music/riffAnalysis.js";

const SR = 44100;
const N = 8192;

// ── Synthesis ───────────────────────────────────────────────────────────────
const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);

/** Note names → MIDI numbers, e.g. 'C4' → 60. */
function midi(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note: ${name}`);
  return PC_NAMES.indexOf(m[1]) + (Number(m[2]) + 1) * 12;
}

/**
 * Additive plucked-string tone. Harmonic amplitudes fall as 1/n^0.8 — shallower
 * than a pure 1/n so the upper partials stay strong enough to actually threaten
 * the detector, the way a bright or overdriven guitar does.
 */
function tone(freq, len, bright = 0.8) {
  const buf = new Float64Array(len);
  for (let h = 1; h <= 8; h++) {
    const f = freq * h;
    if (f > SR / 2) break;
    const a = (1 / Math.pow(h, bright)) * (0.9 + 0.2 * Math.sin(h * 1.7));
    const phase = h * 0.61;
    for (let i = 0; i < len; i++) buf[i] += a * Math.sin((2 * Math.PI * f * i) / SR + phase);
  }
  return buf;
}

/**
 * Mix note names into one buffer, plus a low noise floor.
 * `bright` is the harmonic roll-off exponent: 0.8 is a clean electric, 0.45 is
 * an overdriven one with partials nearly as loud as the fundamentals.
 * `cents` detunes each note randomly — a human tuning, not a strobe tuner.
 */
function chordBuffer(names, { len = N, noise = 0.004, bright = 0.8, cents = 0 } = {}) {
  const buf = new Float32Array(len);
  for (const name of names) {
    const detune = cents ? (Math.random() * 2 - 1) * cents : 0;
    const t = tone(midiToFreq(midi(name) + detune / 100), len, bright);
    for (let i = 0; i < len; i++) buf[i] += t[i];
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(buf[i]));
  for (let i = 0; i < len; i++) buf[i] = buf[i] / (peak || 1) + (Math.random() * 2 - 1) * noise;
  return buf;
}

const analyse = (names, opts) => chromaFromSamples(chordBuffer(names, opts), SR);

let pass = 0;
const check = (label, fn) => { fn(); pass++; console.log(`  ✓ ${label}`); };

// ── 1. Frequency mapping ────────────────────────────────────────────────────
console.log("\nfrequency mapping");
check("A440 → MIDI 69", () => assert.equal(Math.round(freqToMidiFloat(440)), 69));
check("E2 82.41 Hz → MIDI 40", () => assert.equal(Math.round(freqToMidiFloat(82.4069)), 40));
check("C4 → MIDI 60", () => assert.equal(midi('C4'), 60));

// ── 2. Single notes land in the right bin ───────────────────────────────────
console.log("\nsingle notes (harmonic series must not steal the win)");
for (const [name, pc] of [['A4', 9], ['C4', 0], ['E2', 4], ['F#3', 6], ['B4', 11]]) {
  check(`${name} → strongest chroma bin is ${PC_NAMES[pc]}`, () => {
    const { chroma } = analyse([name]);
    let top = 0;
    for (let i = 1; i < 12; i++) if (chroma[i] > chroma[top]) top = i;
    assert.equal(top, pc, `got ${PC_NAMES[top]} (chroma: ${fmt(chroma)})`);
  });
}

// ── 3. Chord identification ─────────────────────────────────────────────────
console.log("\nchords (no key bias — hardest case)");
const CHORD_CASES = [
  [['C4', 'E4', 'G4'],               'maj',   'C'],
  [['A3', 'C4', 'E4'],               'min',   'A'],
  [['E2', 'B2', 'E3'],               'power', 'E'],
  [['G3', 'B3', 'D4', 'F4'],         'dom7',  'G'],
  [['D3', 'F3', 'A3', 'C4'],         'min7',  'D'],
  [['F3', 'A3', 'C4', 'E4'],         'maj7',  'F'],
  [['D3', 'G3', 'A3'],               'sus4',  'D'],
];
for (const [notes, id, root] of CHORD_CASES) {
  check(`${notes.join(' ')} → ${root} ${id}`, () => {
    const { chroma, bass } = analyse(notes);
    const { best, ranked } = chordCandidates(chroma, { bass });
    assert.ok(best, "a candidate was returned");
    assert.equal(`${best.root} ${best.id}`, `${root} ${id}`,
      `got ${best.name} (${best.score.toFixed(3)}); runners-up: ` +
      ranked.slice(1).map(r => `${r.name} ${r.score.toFixed(3)}`).join(', '));
  });
}

// ⚠️ REGRESSION GUARD — THE 7TH PARTIAL. Harmonic 7 of the root lands in the ♭7
// bin, so with harmonic suppression stopping at 6 every bright major triad read
// as a dominant 7th. `maxHarmonic: 8` in CHROMA_DEFAULTS is what fixes it; this
// case fails loudly if anyone trims it back. Overdriven + detuned + noisy on
// purpose, because that is the condition under which it broke.
console.log("\nregression: overdriven triads must not turn into dominant 7ths");
for (const [notes, want] of [
  [['C3', 'G3', 'C4', 'E4'], 'C maj'],
  [['D3', 'A3', 'D4', 'F#4'], 'D maj'],
  [['E3', 'G#3', 'B3'], 'E maj'],
]) {
  check(`${want} survives overdrive + 12¢ detune + noise (×10)`, () => {
    for (let i = 0; i < 10; i++) {
      const { chroma, bass } = analyse(notes, { bright: 0.45, cents: 12, noise: 0.03 });
      const { best } = chordCandidates(chroma, { bass });
      assert.equal(`${best.root} ${best.id}`, want, `run ${i}: got ${best.name}`);
    }
  });
}

check("a ringing chord beats its own top rival by a visible margin", () => {
  const { chroma, bass } = analyse(['C4', 'E4', 'G4']);
  const { margin, confidence } = chordCandidates(chroma, { bass });
  assert.ok(margin > 0, `margin ${margin.toFixed(4)} should be positive`);
  assert.ok(confidence > 0, `confidence ${confidence.toFixed(3)} should be positive`);
});

// ── 4. The bridge back into the game's own chord brain ──────────────────────
console.log("\nhand-off to evaluateChord");
check("activeNotes → evaluateChord reads the same triad", () => {
  const { chroma } = analyse(['C4', 'E4', 'G4']);
  const names = activeNotes(chroma, 0.5);
  const ev = evaluateChord(names);
  assert.ok(['maj', 'power', 'single'].includes(ev.id),
    `evaluateChord returned ${ev.id} from ${names.join(',')}`);
});

// ── 5. Key detection over a progression ─────────────────────────────────────
console.log("\nkey detection (many frames, one answer)");

/** Sum chroma frames for a progression, the way makeKeyTracker would. */
function histogramFor(progression) {
  const hist = new Float64Array(12);
  for (const notes of progression) {
    const { chroma } = analyse(notes);
    for (let i = 0; i < 12; i++) hist[i] += chroma[i];
  }
  return hist;
}

const C_MAJOR_PROG = [
  ['C3', 'E3', 'G3'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['A3', 'C4', 'E4'],
  ['C3', 'E3', 'G3'], ['G3', 'B3', 'D4'],
];
check("I–IV–V–vi in C reads as C major", () => {
  const k = detectKey(histogramFor(C_MAJOR_PROG));
  assert.equal(k.best.name, 'C major', `got ${k.best.name} (r=${k.best.score.toFixed(3)})`);
  assert.ok(k.confidence > 0.2, `confidence ${k.confidence.toFixed(3)} too low to be useful`);
});

// A minor's tell is the G# from the dominant — without it, a natural-minor
// passage is genuinely ambiguous with its relative major and SHOULD read as a
// coin flip rather than a confident wrong answer.
const A_MINOR_PROG = [
  ['A3', 'C4', 'E4'], ['D3', 'F3', 'A3'], ['E3', 'G#3', 'B3'], ['A3', 'C4', 'E4'],
  ['F3', 'A3', 'C4'], ['E3', 'G#3', 'B3'], ['A3', 'C4', 'E4'],
];
check("i–iv–V–i in A reads as A minor", () => {
  const k = detectKey(histogramFor(A_MINOR_PROG));
  assert.equal(k.best.name, 'A minor', `got ${k.best.name} (r=${k.best.score.toFixed(3)})`);
});

check("E major blues-ish vamp reads as an E key", () => {
  const k = detectKey(histogramFor([
    ['E2', 'B2', 'E3'], ['A2', 'E3', 'A3'], ['B2', 'F#3', 'B3'],
    ['E2', 'B2', 'E3'], ['E2', 'G#3', 'B3'],
  ]));
  assert.equal(k.best.rootPc, 4, `got ${k.best.name}`);
});

check("silence yields no key and no confidence", () => {
  const k = detectKey(new Float32Array(12));
  assert.equal(k.best, null);
  assert.equal(k.confidence, 0);
});

check("a chromatic wash is reported as LOW confidence, not a wrong key", () => {
  const flat = new Float32Array(12).fill(1);
  const k = detectKey(flat);
  assert.ok(k.confidence < 0.15, `confidence ${k.confidence.toFixed(3)} should be near zero`);
});

// ── 6. Key bias helps rather than hurts ─────────────────────────────────────
console.log("\nkey bias");
check("diatonic bias does not overturn a clearly-heard chord", () => {
  const { chroma, bass } = analyse(['G3', 'B3', 'D4', 'F4']);
  const biased = chordCandidates(chroma, { bass, keyPcs: keyPitchClasses(0, 'major') });
  assert.equal(biased.best.root, 'G', `got ${biased.best.name}`);
});

check("keyToScale spells the scale the game already draws", () => {
  assert.deepEqual(keyToScale(0, 'major').notes, ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  assert.equal(keyToScale(9, 'minor').root, 'A');
});

// ── 7. Musical-frame gating ─────────────────────────────────────────────────
// The gate exists because the first live test picked up "any and all sounds".
// These cases are the non-music it has to refuse. Each generator is crude, and
// crude is fine: the separation between music and noise on these measures is
// wide enough that a rough impostor still lands unambiguously on the noise side.
console.log("\nnon-music rejection");

function whiteNoise(amp = 0.5) {
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) b[i] = (Math.random() * 2 - 1) * amp;
  return b;
}

/** Pink-ish noise — fans, traffic, air conditioning, room rumble. */
function pinkNoise(amp = 0.5) {
  const b = new Float32Array(N);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < N; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.0990460;
    b1 = 0.96300 * b1 + w * 0.2965164;
    b2 = 0.57000 * b2 + w * 1.0526913;
    b[i] = (b0 + b1 + b2 + w * 0.1848) * amp * 0.2;
  }
  return b;
}

/** A transient — door, dropped pick, keyboard, footstep. */
function clickNoise() {
  const b = new Float32Array(N);
  let peak = 0;
  for (let i = 0; i < N; i++) b[i] = (Math.random() * 2 - 1) * Math.exp(-i / 300);
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(b[i]));
  for (let i = 0; i < N; i++) b[i] /= peak || 1;
  return b;
}

/** Voiced speech: three drifting formants over a moving glottal pulse. */
function speechish(t = 0) {
  const b = new Float32Array(N);
  const formants = [500 + 180 * Math.sin(t), 1500 + 400 * Math.sin(t * 1.7), 2500 + 300 * Math.sin(t * 2.3)];
  for (const f of formants) {
    let ph = 0;
    for (let i = 0; i < N; i++) {
      ph += (2 * Math.PI * f * (1 + 0.06 * Math.sin(i / 900 + t))) / SR;
      b[i] += Math.sin(ph) * (0.6 + 0.4 * Math.sin((2 * Math.PI * (110 + 8 * Math.sin(t)) * i) / SR));
    }
  }
  let peak = 0;
  for (let i = 0; i < N; i++) b[i] += (Math.random() * 2 - 1) * 0.25;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(b[i]));
  for (let i = 0; i < N; i++) b[i] /= peak || 1;
  return b;
}

function measure(gen) {
  const mags = fftMagnitudes(gen(0));
  const flatness = spectralFlatness(mags, SR, N);
  const { chroma } = chromaFromSpectrum(mags, SR, N);
  let stability = 0;
  let prev = chroma;
  for (let i = 1; i <= 4; i++) {
    const { chroma: c } = chromaFromSpectrum(fftMagnitudes(gen(i)), SR, N);
    stability += chromaSimilarity(c, prev) / 4;
    prev = c;
  }
  return { flatness, entropy: chromaEntropy(chroma), stability };
}

const SIGNALS = [
  ['clean triad',      () => chordBuffer(['C4', 'E4', 'G4']),                       true],
  ['overdriven triad', () => chordBuffer(['E2', 'B2', 'E3', 'G#3'], { bright: 0.4, noise: 0.02 }), true],
  ['noisy acoustic',   () => chordBuffer(['G3', 'B3', 'D4'], { noise: 0.05 }),      true],
  ['speech',           t => speechish(t * 0.35),                                    false],
  ['pink noise',       () => pinkNoise(),                                           false],
  ['white noise',      () => whiteNoise(),                                          false],
  ['click',            () => clickNoise(),                                          false],
];

console.log('    signal              flatness  entropy  stability   verdict');
for (const [label, gen, isMusic] of SIGNALS) {
  const m = measure(gen);
  // A frame is musical only if it clears EVERY gate — the same AND the live
  // listener applies. Any single measure has an impostor; the conjunction does
  // not (speech beats flatness, noise beats nothing, a click beats stability).
  const passes = m.flatness <= GATE_DEFAULTS.maxFlatness
    && m.entropy <= GATE_DEFAULTS.maxEntropy
    && m.stability >= GATE_DEFAULTS.minStability;
  console.log(
    `    ${label.padEnd(18)} ${m.flatness.toFixed(3).padStart(7)} ` +
    `${m.entropy.toFixed(3).padStart(8)} ${m.stability.toFixed(3).padStart(9)}   ` +
    `${passes ? 'MUSIC' : 'reject'}`
  );
  check(`${label} → ${isMusic ? 'accepted' : 'REJECTED'}`, () => {
    assert.equal(passes, isMusic,
      `flatness ${m.flatness.toFixed(3)} entropy ${m.entropy.toFixed(3)} stability ${m.stability.toFixed(3)}`);
  });
}

// ⚠️ REGRESSION GUARD — STABILITY MUST BE MEAN-REMOVED. Plain cosine similarity
// scores two independent noise frames at ~0.81, because all-positive vectors
// that are both roughly uniform look alike. That single detail is what let noise
// through the first version of the gate. If this assertion fails, someone has
// turned chromaSimilarity back into a plain dot product.
// Averaged over many pairs, because any TWO noise frames can correlate by
// chance — a single draw hit 0.48 while this was being written. The claim
// worth asserting is about the expectation, which sits near zero for a
// mean-removed measure and near 0.8 for a plain dot product.
check("noise frames do not correlate with each other (mean of 40 pairs)", () => {
  let sum = 0;
  const TRIALS = 40;
  for (let i = 0; i < TRIALS; i++) {
    const a = chromaFromSpectrum(fftMagnitudes(whiteNoise()), SR, N).chroma;
    const b = chromaFromSpectrum(fftMagnitudes(whiteNoise()), SR, N).chroma;
    sum += chromaSimilarity(a, b);
  }
  const mean = sum / TRIALS;
  assert.ok(mean < 0.25, `mean noise self-similarity ${mean.toFixed(3)} — cosine leak?`);
});

console.log("\ngate behaviour over time");
check("a held chord passes, but only after stableFrames", () => {
  const gate = makeFrameGate();
  const buf = chordBuffer(['C4', 'E4', 'G4']);
  const mags = fftMagnitudes(buf);
  const flatness = spectralFlatness(mags, SR, N);
  const { chroma } = chromaFromSpectrum(mags, SR, N);
  const results = [];
  for (let i = 0; i < 6; i++) results.push(gate.push({ db: -20, flatness, chroma, dtMs: 16.7 }));
  assert.equal(results[0].pass, false, "frame 1 must not pass — nothing to be stable against yet");
  assert.equal(results[0].reject, 'settling');
  assert.ok(results[4].pass, `frame 5 should pass, rejected as '${results[4].reject}'`);
});

check("noise is rejected as 'noisy' and never settles", () => {
  const gate = makeFrameGate();
  let everPassed = false;
  for (let i = 0; i < 30; i++) {
    const mags = fftMagnitudes(whiteNoise());
    const v = gate.push({
      db: -20,
      flatness: spectralFlatness(mags, SR, N),
      chroma: chromaFromSpectrum(mags, SR, N).chroma,
      dtMs: 16.7,
    });
    if (v.pass) everPassed = true;
    assert.equal(v.reject, 'noisy', `frame ${i} rejected as '${v.reject}'`);
  }
  assert.equal(everPassed, false, "noise must never pass, no matter how long it runs");
});

check("the noise floor adapts — a loud room raises the bar", () => {
  const gate = makeFrameGate();
  const chordChroma = chromaFromSpectrum(fftMagnitudes(chordBuffer(['C4', 'E4', 'G4'])), SR, N).chroma;
  const play = (db, frames, chroma, flatness) => {
    let last;
    for (let i = 0; i < frames; i++) last = gate.push({ db, flatness, chroma, dtMs: 16.7 });
    return last;
  };

  // Ten seconds of a genuinely noisy room at -30 dB. Noise is what the floor
  // is allowed to learn from — a loud ROOM, not a loud performance.
  const noisyFrame = () => {
    const mags = fftMagnitudes(whiteNoise());
    return {
      chroma: chromaFromSpectrum(mags, SR, N).chroma,
      flatness: spectralFlatness(mags, SR, N),
    };
  };
  let last;
  for (let i = 0; i < 600; i++) {
    const f = noisyFrame();
    last = gate.push({ db: -30, flatness: f.flatness, chroma: f.chroma, dtMs: 16.7 });
  }
  // 10 s at a 3 s half-life is ~3.3 half-lives, so it closes ~90% of the gap
  // from the seeded floor and lands around -31.3. Asymptotic, never exact.
  assert.ok(last.floorDb > -32.5 && last.floorDb <= -30.0 + 1e-6,
    `floor ${last.floorDb.toFixed(2)} should have climbed to meet the -30 dB room`);

  // A clean chord only 4 dB above that floor is not a performance, it's spill.
  const quiet = play(-26, 5, chordChroma, 0.01);
  assert.equal(quiet.reject, 'floor',
    `-26 dB over a ${last.floorDb.toFixed(1)} dB floor should fail 'floor', got '${quiet.reject}'`);

  // The same chord played properly loud clears it.
  const loud = play(-10, 6, chordChroma, 0.01);
  assert.ok(loud.pass, `-10 dB should clear the floor, rejected as '${loud.reject}'`);
});

// ⚠️ REGRESSION GUARD — A SUSTAINED NOTE MUST NOT GATE ITSELF OUT. A plain
// asymmetric follower creeps up during anything held until the floor swallows
// it, and the detector goes deaf part way through a ringing chord. The floor
// only rises on non-musical frames, which is what this pins down.
check("a long sustained chord does not raise the floor onto itself", () => {
  const gate = makeFrameGate();
  const chroma = chromaFromSpectrum(fftMagnitudes(chordBuffer(['C4', 'E4', 'G4'])), SR, N).chroma;
  let last;
  for (let i = 0; i < 1800; i++) {   // 30 seconds of drone
    last = gate.push({ db: -20, flatness: 0.01, chroma, dtMs: 16.7 });
  }
  assert.ok(last.pass, `still ringing after 30 s, but rejected as '${last.reject}'`);
  assert.ok(last.floorDb < -20, `floor ${last.floorDb.toFixed(1)} crept up onto the note`);
});

check("a chord change costs a few frames, then re-locks", () => {
  const gate = makeFrameGate();
  const c = chromaFromSpectrum(fftMagnitudes(chordBuffer(['C4', 'E4', 'G4'])), SR, N).chroma;
  const g = chromaFromSpectrum(fftMagnitudes(chordBuffer(['G3', 'B3', 'D4'])), SR, N).chroma;
  for (let i = 0; i < 6; i++) gate.push({ db: -20, flatness: 0.01, chroma: c, dtMs: 16.7 });
  const swap = gate.push({ db: -20, flatness: 0.01, chroma: g, dtMs: 16.7 });
  assert.equal(swap.pass, false, "the frame you change chords on should not be trusted");
  let relocked = false;
  for (let i = 0; i < 5; i++) {
    if (gate.push({ db: -20, flatness: 0.01, chroma: g, dtMs: 16.7 }).pass) { relocked = true; break; }
  }
  assert.ok(relocked, "the new chord must lock within a few frames");
});

// ── 8. Register survives, and lands on the right frets ──────────────────────
console.log("\nregister — the octave chroma throws away");
check("chromaFromSamples reports absolute MIDI notes", () => {
  const { notes } = analyse(['C4', 'E4', 'G4']);
  const midis = notes.map(n => n.midi).sort((a, b) => a - b);
  for (const want of [60, 64, 67]) {
    assert.ok(midis.includes(want),
      `expected MIDI ${want} in [${midis.join(',')}]`);
  }
});

check("two DIFFERENT pitch classes in different octaves stay separate notes", () => {
  const { notes } = analyse(['E2', 'C4']);
  const midis = notes.map(n => n.midi);
  assert.ok(midis.includes(40) && midis.includes(60),
    `E2 and C4 should both survive: [${midis.join(',')}]`);
});

// ⚠️ A DOCUMENTED LIMIT, NOT A BUG. E4 is exactly the 4th harmonic of E2, so
// "E2 alone, brightly" and "E2 and E4 together" produce the same spectrum.
// Nothing downstream of a microphone can separate them, and any code claiming
// to has simply chosen one. This asserts the behaviour we actually ship —
// collapse to the lower note — so that if someone later loosens the harmonic
// discount to "fix" it, this test explains what they are really trading away
// (phantom octaves on every single note) before they do it.
check("an exact octave double collapses to the lower note — and that is correct", () => {
  const { notes, chroma } = analyse(['E2', 'E4']);
  const midis = notes.map(n => n.midi);
  assert.ok(midis.includes(40), `the fundamental survives: [${midis.join(',')}]`);
  assert.equal(chroma[4], 1, "chroma still reads E, which is all it ever claimed to know");
  // ⚠️ AND SINCE ECHOES WENT OFF BY DEFAULT, THE CONSOLATION WENT WITH THEM.
  // The neck now shows the lower E only. Turning echoes back on is what
  // surfaces the octave the player may have actually used — which is exactly
  // what that toggle is for, and the honest reason to keep it in the UI rather
  // than deleting the option.
  const quiet = placeNotes(notes, { ref: [2, 5] }).layers;
  assert.ok(!quiet['4,5'], "by default we do not claim an octave we cannot hear");
  const withEchoes = placeNotes(notes, { ref: [2, 5], showEchoes: true }).layers;
  assert.ok(withEchoes['4,5'] || withEchoes['3,9'] || withEchoes['5,0'],
    "with echoes on, the E4 positions come back");
});

console.log("\nneck placement");
check("E2 is pitch 0 — the two coordinate systems agree", () => {
  assert.equal(midiToPitch(40), 0);
  assert.equal(pitchToMidi(0), 40);
});

check("E4 lands on the B string, 5th fret", () => {
  // E4 = MIDI 64 = pitch 24. It exists at G/9, B/5 and high-e/0. With the hand
  // resting at fret 5 the B string is the cheapest move — and is where a
  // guitarist actually plays it.
  const { best, alternates } = placePitch(midiToPitch(64), [2, 5]);
  assert.deepEqual(best, [4, 5], `got string ${best[0]} fret ${best[1]}`);
  assert.equal(alternates.length, 2, "the other two positions stay available");
});

check("a hand up at the 12th fret picks the position up there instead", () => {
  const { best } = placePitch(midiToPitch(64), [3, 11]);
  assert.deepEqual(best, [3, 9], `got string ${best[0]} fret ${best[1]}`);
});

check("notes off the neck fold into it rather than vanishing", () => {
  const low = foldOntoNeck(midiToPitch(28));    // E1, an octave below the guitar
  assert.equal(low.pitch, 0, "E1 folds up to open low E");
  assert.equal(low.folded, 1);
  // E6 folds down exactly ONE octave, to E5 — the top of the neck (high e,
  // fret 12), not all the way to E4. Folding stops as soon as it is reachable.
  const high = foldOntoNeck(midiToPitch(88));
  assert.equal(high.pitch, 36, "E6 folds down to E5 at the 12th fret");
  assert.equal(high.folded, -1);
});

check("layers mark the best guess hot and the alternates dim", () => {
  const { layers, placements } = placeNotes([{ midi: 64, pc: 4, strength: 1 }],
    { ref: [2, 5], showAlternates: true });
  assert.equal(layers['4,5'].style, 'hot', "the chosen position is hot");
  assert.equal(layers['3,9'].style, 'dim', "an alternate for the same pitch is dim");
  assert.equal(placements.length, 1);
  assert.deepEqual(placements[0].position, [4, 5]);
});

// ⚠️ REGRESSION GUARD — QUIET BY DEFAULT. Alternates and echoes were on
// originally and one note lit up to seven cells, which reads as a neck that is
// simply on. Anything that flips these defaults back should fail here.
check("by default only the position actually heard is lit", () => {
  const { layers } = placeNotes([{ midi: 64, pc: 4, strength: 1 }], { ref: [2, 5] });
  assert.deepEqual(Object.keys(layers), ['4,5'],
    `one note should light exactly one cell, got: ${Object.keys(layers).join(' ')}`);
});

// ⚠️ PAINT ORDER MATTERS. Echoes (other octaves of the same pitch class) are
// theory; a placed note is an observation. If echoes were painted last they
// would bury the actual detection under a dim layer of its own pitch class,
// which is the one cell the whole view exists to show.
check("an observed position is never overwritten by its own echo", () => {
  const { layers } = placeNotes([{ midi: 64, pc: 4, strength: 1 }], { ref: [2, 5], showEchoes: true });
  assert.equal(layers['4,5'].style, 'hot', "echo layer buried the real placement");
});

check("echoes light other octaves of the pitch class when asked for", () => {
  const { layers } = placeNotes([{ midi: 64, pc: 4, strength: 1 }], { ref: [2, 5], showEchoes: true });
  assert.ok(layers['0,0'], "open low E is an echo of E4 and should be lit");
  assert.equal(layers['0,0'].style, 'dim');
});

console.log("\nneck tracker over time");
check("a trail decays after the note stops", () => {
  const t = makeNeckTracker();
  t.push([{ midi: 64, pc: 4, strength: 1 }], 16.7);
  assert.equal(t.notes().length, 1, "the note is live while sounding");
  for (let i = 0; i < 300; i++) t.push([], 16.7);   // 5 seconds of silence
  assert.equal(t.notes().length, 0, "the trail should have faded out");
});

check("a held note stays at full brightness instead of fading under itself", () => {
  const t = makeNeckTracker();
  for (let i = 0; i < 120; i++) t.push([{ midi: 64, pc: 4, strength: 1 }], 16.7);
  assert.equal(t.notes()[0].strength, 1, "a note still ringing must not decay");
});

check("the hand follows a run up the neck, then settles", () => {
  const t = makeNeckTracker();
  const startFret = t.ref()[1];
  // A run high up the neck: E5, F#5, G#5 — only reachable above fret 9ish.
  for (let i = 0; i < 90; i++) {
    t.push([{ midi: 76, pc: 4, strength: 1 }, { midi: 80, pc: 8, strength: 0.8 }], 16.7);
  }
  assert.ok(t.ref()[1] > startFret + 2,
    `hand should have moved up from ${startFret}, sits at ${t.ref()[1].toFixed(1)}`);
});

check("one stray note does not yank the hand up the neck", () => {
  const t = makeNeckTracker();
  for (let i = 0; i < 60; i++) t.push([{ midi: 52, pc: 4, strength: 1 }], 16.7);  // settled low
  const before = t.ref()[1];
  t.push([{ midi: 88, pc: 4, strength: 1 }], 16.7);   // one note way up top
  assert.ok(Math.abs(t.ref()[1] - before) < 1,
    `hand jumped ${(t.ref()[1] - before).toFixed(2)} frets on a single note`);
});

// ── 8b. What's being USED — the session picture ─────────────────────────────
console.log("\nusage — what the whole passage is made of");

/** Play a sequence of note-sets through a tracker, half a second each. */
function playThrough(tracker, sequence, msEach = 500) {
  for (const set of sequence) {
    const notes = set.map(m => ({ midi: m, pc: ((m % 12) + 12) % 12, strength: 1 }));
    for (let i = 0; i < msEach / 16.7; i++) tracker.push(notes, 16.7);
    for (let i = 0; i < 6; i++) tracker.push([], 16.7);   // a beat of silence between
  }
}

check("usage accumulates while the live trail moves on", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52], [55], [59]]);          // E3, G3, B3
  assert.equal(Object.keys(t.usedCells()).length, 3, "three positions used");
  for (let i = 0; i < 300; i++) t.push([], 16.7);
  assert.equal(t.notes().length, 0, "the live trail has faded");
  assert.equal(Object.keys(t.usedCells()).length, 3, "but the session picture remains");
});

check("usage is weighted by seconds sounding, not frames rendered", () => {
  const a = makeNeckTracker();
  const b = makeNeckTracker();
  const note = [{ midi: 52, pc: 4, strength: 1 }];
  // Same one second of sound, rendered at 60fps and at 15fps.
  for (let i = 0; i < 60; i++) a.push(note, 16.7);
  for (let i = 0; i < 15; i++) b.push(note, 66.7);
  const ua = a.usageByPc()[4];
  const ub = b.usageByPc()[4];
  assert.ok(Math.abs(ua - ub) / ua < 0.02,
    `frame rate changed the usage weight: ${ua.toFixed(3)} vs ${ub.toFixed(3)}`);
});

check("held notes read forward of notes touched once", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52]], 3000);                 // three seconds leaning on E3
  playThrough(t, [[55]], 600);                  // a passing G3
  // Let the live trail clear first — otherwise the NOW layer is still sitting
  // on top of both cells and the used layer underneath is what's being hidden,
  // not what's being measured.
  for (let i = 0; i < 300; i++) t.push([], 16.7);

  const used = Object.entries(t.layers()).filter(([, v]) => v.color === '#44ff88');
  assert.equal(used.length, 2, `both notes should be in the session picture: ${JSON.stringify(used)}`);
  // Brightness is a continuous `level`, not a style bucket — what matters is
  // that the note leaned on outshines the one passed through.
  const levels = Object.fromEntries(used.map(([id, v]) => [id, v.level]));
  const sorted = used.map(([, v]) => v.level).sort((a, b) => b - a);
  assert.ok(sorted[0] > sorted[1], `the leaned-on note should be brighter: ${JSON.stringify(levels)}`);
  for (const [, v] of used) assert.equal(v.style, 'pulse', "used notes flash");
});

check("a note barely touched drops out of the picture entirely", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52]], 4000);
  playThrough(t, [[55]], 100);                  // a fortieth of the time
  for (let i = 0; i < 300; i++) t.push([], 16.7);   // let the live layer clear
  assert.equal(Object.keys(t.usedCells()).length, 2, "usage still records it");
  const shown = Object.entries(t.layers({ showUsed: true }))
    .filter(([, v]) => v.color === '#44ff88');
  assert.equal(shown.length, 1, "but it is below minUsed and is not drawn");
});

// ⚠️ PAINT ORDER, AGAIN. The used layer covers far more cells than the live one.
// If it were merged last it would erase the note currently sounding — the one
// cell the view is most about.
check("the used layer never buries what is ringing right now", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52]], 2000);
  t.push([{ midi: 52, pc: 4, strength: 1 }], 16.7);
  const layers = t.layers();
  const cell = Object.entries(layers).find(([, v]) => v.style === 'hot' || v.color === '#19e6ff');
  assert.ok(cell, `a live note should still be on top: ${JSON.stringify(layers)}`);
});

check("clearUsage wipes the session picture but not the hand", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52], [55]]);
  t.clearUsage();
  assert.deepEqual(t.usedCells(), {});
  assert.equal(t.usageByPc().reduce((a, b) => a + b, 0), 0);
});

console.log("\nmelody trail — the line from note to note");
check("a played line becomes an ordered path across the neck", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52], [55], [59], [60]], 300);   // E3 G3 B3 C4
  const path = t.melodyTrail();
  assert.equal(path.length, 4, `four notes, four steps: ${JSON.stringify(path)}`);
  assert.ok(path.every(p => /^\d,\d+$/.test(p.cellId)), "each step is a real cell");
  // Newest step is the brightest.
  assert.ok(path[3].fade > path[0].fade, "the path should fade toward its tail");
});

// ⚠️ ONE STEP PER NOTE, NOT ONE PER FRAME. A note held for a second is ~60
// frames; recording each would stack sixty identical points on one cell, which
// draws as a blob and silently eats the path length cap.
check("a held note is one step, not sixty", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52]], 1000);
  assert.equal(t.melodyTrail().length, 1, "a held note is a single step");
});

check("the trail follows the TOP voice through chords", () => {
  const t = makeNeckTracker();
  // Same bass note underneath, moving top voice: the path should track the top.
  playThrough(t, [[40, 64], [40, 65], [40, 67]], 300);
  const path = t.melodyTrail();
  assert.deepEqual(path.map(p => p.midi), [64, 65, 67],
    `expected the top line, got ${path.map(p => p.midi).join(',')}`);
});

// ⚠️ REGRESSION GUARD — THE SNAKE MUST DRAIN DURING SILENCE. The tracker's
// clock only advances when it is pushed, so a caller that skips pushing while
// nothing is sounding freezes the trail on screen forever. Ear Spy did exactly
// that (it returned early on a rejected frame) and the trail sat there
// mid-phrase. Pushing an EMPTY frame is what keeps time moving.
check("empty pushes still expire the trail — silence has to be told to the clock", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52], [55], [59]], 200);
  assert.ok(t.melodyTrail().length > 0, "a path exists after playing");
  const frozen = makeNeckTracker();
  playThrough(frozen, [[52], [55], [59]], 200);
  // Not pushing at all: the clock never advances and nothing can expire.
  assert.equal(frozen.melodyTrail().length, 3, "no pushes means no time passes");
  // Pushing empties: time passes and the path drains.
  for (let i = 0; i < 300; i++) t.push([], 16.7);
  assert.equal(t.melodyTrail().length, 0, "empty pushes drain it");
});

// ⚠️ THE HEAD HAS TO TRAVEL. A span that appears at full length in a single
// frame reads as a new object rather than as the same line moving. `grow` ramps
// 0 → 1 over growMs so the renderer can draw the head partway there.
check("the newest step grows out rather than appearing whole", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52]], 300);
  t.push([{ midi: 55, pc: 7, strength: 1 }], 16.7);   // a new note, just landed
  const fresh = t.melodyTrail();
  assert.ok(fresh.at(-1).grow < 0.3, `a just-landed step starts short: ${fresh.at(-1).grow}`);
  for (let i = 0; i < 12; i++) t.push([{ midi: 55, pc: 7, strength: 1 }], 16.7);
  assert.equal(t.melodyTrail().at(-1).grow, 1, "and reaches full extent within ~120 ms");
});

check("grow stays in range for every step, however old", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52], [55], [59]], 200);
  for (const p of t.melodyTrail()) {
    assert.ok(p.grow >= 0 && p.grow <= 1, `grow out of range: ${p.grow}`);
  }
});

check("the trail tapers — the newest step is the brightest", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52], [55], [59], [60]], 200);
  const path = t.melodyTrail();
  for (let i = 1; i < path.length; i++) {
    assert.ok(path[i].fade >= path[i - 1].fade,
      `fade must rise toward the head: ${path.map(p => p.fade.toFixed(2)).join(' ')}`);
  }
});

check("used cells carry a continuous brightness, not two tiers", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52]], 3000);      // leaned on
  playThrough(t, [[55]], 1200);      // middling
  playThrough(t, [[59]], 500);       // touched
  for (let i = 0; i < 300; i++) t.push([], 16.7);
  const levels = Object.values(t.layers())
    .filter(v => v.color === '#44ff88')
    .map(v => v.level)
    .sort((a, b) => a - b);
  assert.equal(levels.length, 3, "three notes in the picture");
  assert.ok(new Set(levels.map(l => l.toFixed(3))).size === 3,
    `three distinct brightnesses expected, got ${levels.join(', ')}`);
  for (const l of levels) assert.ok(l >= 0.25 && l <= 1, `level out of range: ${l}`);
});

check("the path expires during a rest instead of freezing", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52], [55]], 300);
  assert.ok(t.melodyTrail().length > 0);
  for (let i = 0; i < 300; i++) t.push([], 16.7);   // 5 s of silence
  assert.equal(t.melodyTrail().length, 0, "an old phrase should clear itself");
});

check("fade never leaves the 0..1 range, even across a reset", () => {
  const t = makeNeckTracker();
  playThrough(t, [[52], [55]], 300);
  t.reset();
  playThrough(t, [[59]], 300);
  for (const p of t.melodyTrail()) {
    assert.ok(p.fade >= 0 && p.fade <= 1, `fade out of range: ${p.fade}`);
  }
});

console.log("\nmelodic structure — what scale is this?");
const PC = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function usageOf(names, weights = null) {
  const u = new Float32Array(12);
  names.forEach((n, i) => { u[PC[n]] = weights ? weights[i] : 1; });
  return u;
}

check("five notes of A minor pentatonic, with the key known, read as A minor pentatonic", () => {
  const p = detectPalette(usageOf(['A', 'C', 'D', 'E', 'G']), { keyRootPc: 9 });
  assert.equal(p.best.name, 'A minor pentatonic', `got ${p.best.name}`);
});

// ⚠️ THE LIMIT, STATED AS A TEST. A minor pentatonic and C major pentatonic are
// the same five pitch classes. Without a tonic from somewhere else the question
// has no answer, and the right behaviour is to pick the right SHAPE and be
// arbitrary about the root — not to invent evidence. This pins that down so the
// tie is understood as a known property rather than found later as a bug.
check("without a key hint, relative modes are a genuine tie", () => {
  const p = detectPalette(usageOf(['A', 'C', 'D', 'E', 'G']));
  assert.equal(p.best.id, 'pent_maj', `shape should still be right: ${p.best.name}`);
  const aMinor = p.ranked.find(r => r.rootPc === 9 && r.id === 'pent_min');
  if (aMinor) {
    assert.ok(Math.abs(aMinor.fMeasure - p.best.fMeasure) < 1e-9,
      "the two readings should be numerically tied on the evidence available");
  }
});

check("the key hint flips a tie without overturning real evidence", () => {
  const asC = detectPalette(usageOf(['A', 'C', 'D', 'E', 'G']), { keyRootPc: 0 });
  assert.equal(asC.best.name, 'C major pentatonic', `got ${asC.best.name}`);
  // But a hint cannot make a wrong shape win: seven notes of C major stay C
  // major even if the key detector is insisting on A.
  const seven = detectPalette(usageOf(['C', 'D', 'E', 'F', 'G', 'A', 'B']), { keyRootPc: 9 });
  assert.equal(seven.best.pcs.length, 7, `got ${seven.best.name}`);
});

// ⚠️ THE TEST THE WHOLE SCORING DESIGN EXISTS FOR. A minor pentatonic sits
// inside A natural minor, C major, D dorian and more — precision alone cannot
// separate them, because all of them "explain" every note played. The recall
// term, which asks whether the shape's own notes are actually being used, is
// what makes the five-note answer win. If someone simplifies the score to a
// containment check, this is what breaks.
check("a pentatonic passage is NOT reported as the seven-note scale containing it", () => {
  const p = detectPalette(usageOf(['A', 'C', 'D', 'E', 'G']), { keyRootPc: 9 });
  assert.equal(p.best.pcs.length, 5, `claimed a ${p.best.pcs.length}-note scale: ${p.best.name}`);
  const minorFull = p.ranked.find(r => r.id === 'minor');
  if (minorFull) {
    assert.ok(p.best.score > minorFull.score, "pentatonic must outscore natural minor here");
  }
});

check("all seven notes present reads as the full scale, not a pentatonic", () => {
  const p = detectPalette(usageOf(['C', 'D', 'E', 'F', 'G', 'A', 'B']), { keyRootPc: 0 });
  assert.equal(p.best.name, 'C major', `got ${p.best.name}`);
});

check("the blues ♭5 is recognised rather than called an outsider", () => {
  const p = detectPalette(usageOf(['A', 'C', 'D', 'D#', 'E', 'G']), { keyRootPc: 9 });
  assert.equal(p.best.id, 'blues', `got ${p.best.name}`);
  assert.equal(p.best.outside.length, 0, "every note played is in the blues scale");
});

check("notes outside a shape are reported on it, not hidden", () => {
  const p = detectPalette(usageOf(['A', 'C', 'D', 'E', 'G', 'A#']), { keyRootPc: 9 });
  // Checked on a NAMED candidate rather than the winner: the mechanism is what
  // matters, and which shape wins is a separate question (see below).
  const pent = p.ranked.concat(
    detectPalette(usageOf(['A', 'C', 'D', 'E', 'G', 'A#']), { keyRootPc: 9 }).ranked,
  ).find(r => r.rootPc === 9 && r.id === 'pent_min');
  if (pent) assert.ok(pent.outside.includes('A#'), `A# should be outside A minor pentatonic: ${pent.outside}`);
});

// ⚠️ WRITTEN AS A FAILING TEST FIRST, AND THE CODE WAS RIGHT. The expectation
// was that A minor pentatonic plus a B♭ would report the B♭ as an outsider.
// It reports A PHRYGIAN instead — which contains all six notes, because a ♭2
// over a minor pentatonic is exactly what phrygian IS. Preferring a shape that
// explains every note over one that needs an exception is the behaviour we
// want; the test was wrong, not the scoring. Kept as documentation of why.
check("a shape that explains the 'outside' note wins over one that excuses it", () => {
  const p = detectPalette(usageOf(['A', 'C', 'D', 'E', 'G', 'A#']), { keyRootPc: 9 });
  assert.equal(p.best.name, 'A phrygian', `got ${p.best.name}`);
  assert.equal(p.best.outside.length, 0, "nothing is outside once the shape fits");
});

check("a note no shape can absorb IS flagged as outside", () => {
  // C and C♯ together over an A tonic: no scale in the vocabulary carries both
  // a ♭3 and a ♮3, so whatever wins has to admit something doesn't fit.
  const p = detectPalette(usageOf(['A', 'C', 'C#', 'D', 'E', 'G']), { keyRootPc: 9 });
  assert.ok(p.best.outside.length > 0,
    `something must be reported outside ${p.best.name}, got none`);
});

check("a weak stray note does not count as part of the palette", () => {
  // Five strong pentatonic notes plus a whisper of something chromatic.
  const p = detectPalette(usageOf(['A', 'C', 'D', 'E', 'G', 'F#'], [1, 1, 1, 1, 1, 0.03]),
    { keyRootPc: 9 });
  assert.ok(!p.notesUsed.some(n => n.name === 'F#'),
    "a 3% note is detection leakage, not a note choice");
});

check("silence produces no palette rather than a guess", () => {
  const p = detectPalette(new Float32Array(12));
  assert.equal(p.best, null);
  assert.equal(p.confidence, 0);
});

// ── 8d. Riff analysis — the look back after the phrase ──────────────────────
console.log("\nphrase segmentation");

/** Build phrase events at a fixed note spacing. */
function phraseOf(pcs, { start = 1000, step = 220, durations = null } = {}) {
  let t = start;
  return pcs.map((pc, i) => {
    const e = { pc, midi: 60 + pc, t, duration: durations ? durations[i] : step };
    t += durations ? durations[i] : step;
    return e;
  });
}

check("a phrase closes on a rest, not on a note count", () => {
  const rec = makePhraseRecorder();
  let t = 0;
  for (const pc of [9, 0, 4, 7]) { rec.push({ pc, midi: 60 + pc, t }); t += 200; }
  assert.equal(rec.tick(t), null, "still inside the phrase");
  assert.equal(rec.tick(t + 500), null, "a short gap is not the end");
  const phrase = rec.tick(t + 1200);
  assert.ok(phrase, "a long gap closes it");
  assert.equal(phrase.length, 4);
});

check("a stab of one or two notes is not a phrase", () => {
  const rec = makePhraseRecorder();
  rec.push({ pc: 9, midi: 69, t: 0 });
  rec.push({ pc: 0, midi: 60, t: 100 });
  assert.equal(rec.tick(2000), null, "two notes is not a riff");
});

check("durations come from the gaps between onsets", () => {
  const rec = makePhraseRecorder();
  rec.push({ pc: 9, midi: 69, t: 0 });
  rec.push({ pc: 0, midi: 60, t: 800 });     // the A was held 800 ms
  rec.push({ pc: 4, midi: 64, t: 900 });     // the C only 100 ms
  const phrase = rec.tick(2200);
  assert.equal(phrase[0].duration, 800);
  assert.equal(phrase[1].duration, 100);
});

console.log("\nimplied harmony — what is the line played OVER?");

// ⚠️ TIME, NOT NOTE COUNT. This is the assertion that stops the analysis being
// a majority vote of onsets, where sixteen passing notes outvote the whole note
// the ear is actually hanging the chord on.
check("a long note outweighs a flurry of short ones", () => {
  const flurry = phraseOf([1, 3, 6, 10], { durations: [90, 90, 90, 90] });
  const held = phraseOf([9], { start: 1400, durations: [1600] });
  const w = weighPhrase([...flurry, ...held]);
  assert.ok(w[9] > w[1] + w[3] + w[6] + w[10],
    "the held note should dominate the harmonic weight");
});

check("a line on A C E reads as A minor", () => {
  const p = phraseOf([9, 0, 4, 9], { durations: [500, 400, 400, 700] });
  const { best } = impliedChord(p);
  assert.equal(best.name, 'A Minor triad', `got ${best?.name}`);
});

// ⚠️ THE SCORING DIFFERENCE FROM detectPalette, AS A TEST. A melody need not
// state its own chord. This line never plays the third at all, and the answer
// still has to be a sensible A-rooted shape rather than whatever tiny template
// happens to fit two notes.
check("a line that never plays the third still gets an A-rooted answer", () => {
  const p = phraseOf([9, 4, 9, 7, 9], { durations: [500, 300, 400, 300, 800] });
  const { best } = impliedChord(p);
  assert.equal(best.rootPc, 9, `got ${best?.name}`);
});

// ⚠️ REGRESSION GUARD — A BACKDROP THAT ABSORBS EVERYTHING JUDGES NOTHING.
// Scoring against the full CHORD_TEMPLATES list returned "D Dominant 9" for
// this line, because a 9th chord contains all four notes including the passing
// F♯. Nothing is ever outside such a chord, so the deliberate-discord verdict
// becomes structurally impossible — every note reads as a chord tone. The
// backdrop is capped at four notes for exactly this reason.
check("the implied backdrop is a triad or seventh, never a 9th that eats the passing note", () => {
  const p = phraseOf([9, 0, 4, 6, 0, 9], { durations: [400, 300, 300, 250, 300, 600] });
  const { best } = impliedChord(p);
  assert.ok(best.pcs.length <= 4, `backdrop claimed ${best.pcs.length} notes: ${best.name}`);
  assert.equal(best.name, 'A Minor triad', `got ${best.name}`);
  const a = analysePhrase(p, { mode: 'minor' });
  assert.ok(a.dropPcs.has(6), "and the passing F♯ can therefore be judged at all");
});

// ⚠️ REGRESSION GUARD — DON'T CREDIT THE LANDING NOTE THREE TIMES. weighPhrase
// already boosts the final note 1.6x; reading root share off those boosted
// weights counted it again, and landingRootBonus a third time. This exact line
// came back as "E Augmented" purely for ending on the E.
check("ending on a note does not hand it the root", () => {
  const p = phraseOf([9, 0, 4, 6, 0, 4], { durations: [400, 300, 300, 250, 300, 600] });
  const { best } = impliedChord(p);
  assert.equal(best.name, 'A Minor triad',
    `the line is in A minor and merely ENDS on E; got ${best.name}`);
});

check("a phrase with no harmonic shape declines to name a chord", () => {
  const p = phraseOf([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], { durations: Array(12).fill(200) });
  const { best } = impliedChord(p, { minChordScore: 0.9 });
  assert.equal(best, null, "a chromatic run should not be called a chord");
});

console.log("\nnote roles — deliberate discord vs a note that missed");

check("a chromatic approach that resolves by step is kept as flavour", () => {
  // A minor line with a G♯ leaning into A — the classic approach note.
  const p = phraseOf([9, 0, 4, 8, 9], { durations: [400, 300, 300, 200, 700] });
  const a = analysePhrase(p, { mode: 'minor' });
  assert.ok(a.chord, "a chord should be identified");
  assert.ok(a.flavorPcs.has(8), `G♯ should be earned flavour, roles: ${JSON.stringify(a.notes)}`);
  assert.ok(!a.dropPcs.has(8), "and must not be dropped from the pattern");
});

// ⚠️ THE POINT OF THE WHOLE MODULE. An outside note is not wrong for being
// outside. If this ever starts dropping notes purely for being off-scale, the
// neck stops showing the ♭5s and chromatic approaches that make a riff sound
// like a riff.
check("an outside note is judged on whether it RESOLVES, not on being outside", () => {
  // Resolved: G♯ steps straight up into the A.
  const resolved = analysePhrase(
    phraseOf([9, 0, 8, 9, 9], { durations: [400, 300, 200, 600, 400] }), { mode: 'minor' });
  // Stranded: the same G♯, but the line walks away and never comes back to A
  // within the resolution window. Note it takes THREE following notes to strand
  // it — the coach's rule looks two notes ahead, so [.., G♯, E, A] still counts
  // as resolved, and correctly so.
  const stranded = analysePhrase(
    phraseOf([9, 0, 8, 4, 0, 4], { durations: [400, 300, 200, 400, 400, 600] }), { mode: 'minor' });
  const rRole = resolved.notes.find(n => n.pc === 8)?.role;
  const sRole = stranded.notes.find(n => n.pc === 8)?.role;
  assert.notEqual(rRole, sRole,
    `the same G♯ should be judged differently by what follows it (both ${rRole})`);
});

check("notes that never land are reported for dropping", () => {
  const p = phraseOf([9, 0, 4, 6, 9], { durations: [400, 300, 300, 250, 700] });
  const a = analysePhrase(p, { mode: 'minor' });
  const all = new Set([...a.keepPcs, ...a.dropPcs]);
  assert.equal(all.size, a.notes.length, "every note is either kept or dropped");
  for (const pc of a.dropPcs) assert.ok(!a.keepPcs.has(pc), "and never both");
});

check("a pitch class that lands once is deliberate, even if it also missed", () => {
  // G♯ appears twice: once stranded, once resolving into A. That's a player
  // using a note, not a player missing one.
  const p = phraseOf([9, 8, 4, 0, 8, 9], { durations: [400, 200, 300, 300, 200, 700] });
  const a = analysePhrase(p, { mode: 'minor' });
  assert.ok(!a.dropPcs.has(8), `G♯ resolved at least once: ${JSON.stringify(a.notes)}`);
});

check("chord tones are kept and never called flavour", () => {
  const p = phraseOf([9, 0, 4, 9], { durations: [400, 400, 400, 700] });
  const a = analysePhrase(p, { mode: 'minor' });
  for (const pc of a.chord.pcs) {
    if (a.notes.some(n => n.pc === pc)) {
      assert.ok(a.keepPcs.has(pc), `chord tone ${pc} must be kept`);
      assert.ok(!a.flavorPcs.has(pc), `chord tone ${pc} is not flavour`);
    }
  }
});

check("the report speaks in Discord Coach's voice, not a new one", () => {
  const p = phraseOf([9, 0, 4, 8, 9], { durations: [400, 300, 300, 200, 700] });
  const a = analysePhrase(p, { mode: 'minor' });
  assert.ok(a.coach.length > 0, "a phrase with an earned discord gets a line");
  assert.ok(a.summary.includes('over '), `summary reads oddly: ${a.summary}`);
});

check("an empty or trivial phrase analyses to nothing rather than guessing", () => {
  assert.equal(analysePhrase([]).chord, null);
  assert.equal(analysePhrase([{ pc: 9, midi: 69, t: 0, duration: 100 }]).chord, null);
});

// ── 9. End to end: audio in, fret shape out ─────────────────────────────────
// The claim the whole feature rests on. Everything above tests a stage; this
// tests the pipeline — synthesized chord → spectrum → peaks → register →
// placement → the cells a fretboard would actually light.
console.log("\nend to end — a chord becomes a shape");
check("an open E major sounds out as the open E shape", () => {
  // The real voicing a guitarist plays: E2 B2 E3 G#3 B3 E4.
  const { notes } = analyse(['E2', 'B2', 'E3', 'G#3', 'B3', 'E4']);
  // Hand at the nut, where this chord is played.
  const { layers } = placeNotes(notes, { ref: [1, 1], showEchoes: false });

  // Open low E, A string 2nd fret, G string 1st fret — three of the six cells
  // of the open E shape, and the three whose pitches survive octave collapse.
  for (const [cell, what] of [['0,0', 'open low E'], ['1,2', 'B on the A string'], ['3,1', 'G# on the G string']]) {
    assert.ok(layers[cell], `expected ${what} (${cell}) to be lit; got ${Object.keys(layers).join(' ')}`);
    assert.ok(['hot', 'solid'].includes(layers[cell].style),
      `${what} should be a placement, not a dim alternate`);
  }
});

check("a barre chord up the neck places up the neck", () => {
  // A major at the 5th fret: A2 E3 A3 C#4 E4.
  const { notes } = analyse(['A2', 'E3', 'A3', 'C#4', 'E4']);
  const { layers } = placeNotes(notes, { ref: [2, 5], showEchoes: false });
  const lit = Object.entries(layers)
    .filter(([, v]) => v.style !== 'dim')
    .map(([cell]) => cell.split(',').map(Number));
  assert.ok(lit.length > 0, "something should be lit");
  const avgFret = lit.reduce((n, [, f]) => n + f, 0) / lit.length;
  assert.ok(avgFret >= 3, `placements averaged fret ${avgFret.toFixed(1)} — should sit up the neck`);
});

// The whole feature in one assertion: a lick goes in, and what comes out is the
// shape a guitarist would name — box 1 of A minor pentatonic at the 5th fret,
// with a path traced through it and the scale identified from usage alone.
check("an A minor pentatonic lick draws box 1 and names itself", () => {
  const t = makeNeckTracker();
  // 200 ms a note: the whole nine-note phrase fits inside the trail's 3.5 s
  // window. Played slower, the opening note ages off the path before the last
  // one lands — which is the window working, not a bug (see the next case).
  playThrough(t, [[57], [60], [62], [64], [67], [64], [62], [60], [57]], 200);

  const cells = Object.keys(t.usedCells()).sort();
  assert.deepEqual(cells, ['2,7', '3,5', '3,7', '4,5', '4,8'],
    `expected the 5th-fret pentatonic box, got ${cells.join(' ')}`);

  const path = t.melodyTrail().map(p => p.cellId);
  assert.equal(path.length, 9, "every note of the lick is a step on the path");
  assert.equal(path[0], '2,7', "the line starts on the A");
  assert.equal(path[4], '4,8', "and turns around at the top note");

  const p = detectPalette(t.usageByPc(), { keyRootPc: 9 });
  assert.equal(p.best.name, 'A minor pentatonic', `named it ${p.best.name}`);
  assert.equal(p.best.outside.length, 0, "nothing played falls outside the shape");
});

// ⚠️ THE TWO LAYERS HAVE DIFFERENT MEMORIES, AND THAT IS THE POINT. The trail
// is a moving 3.5 s window — play the same lick slowly and its opening note
// drops off the path. The session picture does not forget, which is why both
// exist: one shows the phrase, the other shows the material.
check("played slowly, the path is a window but the picture is not", () => {
  const t = makeNeckTracker();
  playThrough(t, [[57], [60], [62], [64], [67], [64], [62], [60], [57]], 600);
  assert.ok(t.melodyTrail().length < 9, "the path holds only the recent phrase");
  assert.equal(Object.keys(t.usedCells()).length, 5,
    "the session picture still has the whole box");
});

// The full loop the mode actually runs: notes → neck tracker → melody steps →
// phrase recorder → rest → analysis → the pitch classes the neck should stop
// lighting. Nothing mocked between the tracker and the verdict.
check("a lick with a stranded note ends up dropping exactly that note", () => {
  const neck = makeNeckTracker();
  const rec = makePhraseRecorder();
  const play = (midis, ms) => {
    const notes = midis.map(m => ({ midi: m, pc: ((m % 12) + 12) % 12, strength: 1 }));
    for (let i = 0; i < ms / 16.7; i++) {
      const step = neck.push(notes, 16.7);
      if (step) rec.push(step);
    }
  };
  const rest = ms => {
    for (let i = 0; i < ms / 16.7; i++) {
      const step = neck.push([], 16.7);
      if (step) rec.push(step);
    }
  };

  // A minor line with an F♯ that goes nowhere. Note the care needed to strand
  // it: F♯→E would be a step and would COUNT as resolved, so the line has to
  // walk away to C and then A, neither of which is a step from F♯.
  play([57], 400); play([60], 300); play([64], 300);
  play([66], 250);                                  // F♯ — stranded
  play([60], 300); play([57], 600);
  rest(1400);

  const phrase = rec.tick(neck.now());
  assert.ok(phrase, "the rest should have closed the phrase");
  const report = analysePhrase(phrase, { mode: 'minor' });
  assert.ok(report.chord, `a chord should be implied, got ${report.summary}`);
  assert.ok(report.dropPcs.has(6), `F♯ never landed and should drop: ${JSON.stringify(report.notes)}`);
  assert.ok(report.keepPcs.has(9) && report.keepPcs.has(0),
    "the notes that carried the line are kept");

  // And the neck honours the verdict: the F♯ cell stops being drawn.
  const before = neck.layers({});
  const after = neck.layers({ dropPcs: report.dropPcs });
  const cellsOf = ls => Object.keys(ls).length;
  assert.ok(cellsOf(after) < cellsOf(before), "the dropped note leaves the picture");
  // ...but the evidence is not destroyed, so a later phrase can redeem it.
  assert.ok(neck.usageByPc()[6] > 0, "usage still remembers it was played");
});

check("the same chord heard twice places the same way", () => {
  const a = placeNotes(analyse(['C3', 'E3', 'G3']).notes, { ref: [2, 5] }).layers;
  const b = placeNotes(analyse(['C3', 'E3', 'G3']).notes, { ref: [2, 5] }).layers;
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(),
    "placement must be deterministic for the same input");
});

function fmt(chroma) {
  return Array.from(chroma)
    .map((v, i) => (v > 0.25 ? `${PC_NAMES[i]}:${v.toFixed(2)}` : null))
    .filter(Boolean).join(' ');
}

console.log(`\nchroma selftest: ${pass} assertions passed\n`);
