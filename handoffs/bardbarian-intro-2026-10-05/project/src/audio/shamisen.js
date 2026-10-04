// =============================================================================
// audio/shamisen.js — 🪕 THE SHAMISEN STRING, rendered (2026-09-28)
// -----------------------------------------------------------------------------
// Alex: *"I wonder if Ronin's sound could be closer to a shamisen for the base
// sound? Possibly incorporating actual 'shamisen' notes? Or digitally making it
// sound like a shamisen?"* — digitally, so there are no sample files to license,
// ship or keep in tune, and every note of every root is available.
//
// WHAT MAKES A SHAMISEN A SHAMISEN, and where each part lives below:
//   1. A PLUCKED STRING that dies fast and dry — Karplus-Strong: a noise burst
//      circulating through a tuned delay line with a gentle lowpass in the loop.
//   2. THE BACHI — a big wooden plectrum that strikes the string AND the skin in
//      one blow. A bright click on top, a short body THUMP underneath (the body
//      is a small drum; the thump is its head).
//   3. SAWARI (障り) — the first string rests against a notch on the neck, so it
//      BUZZES, and the buzz is what keeps a shamisen note singing ("bin—"). It is
//      the string's own waveform clipped hard and lopsided, band-passed into the
//      sizzle region, and held up a little longer than the string itself — see
//      the SAWARI block for why it is not inside the loop.
//
// PURE: `renderShamisenPluck` takes a sample rate and returns samples — no Web
// Audio — so a node check can measure it. `shamisenBuffer` wraps it in an
// AudioBuffer and caches per context (a note renders in ~1 ms; a shred of forty
// notes re-uses the same six).
// =============================================================================

/** Every dial-in lever. Frozen: callers override per note with `opts.pluck`.
 *  🎛️ DIALLED IN BY ALEX on the Spirit Sound Bench, 2026-09-28: t60, bright,
 *  pluckPos, sawariEdge, sawariHz, bachi and skin are his values — a longer,
 *  brighter, twangier string with a harder bachi and a heavier skin. */
export const SHAMISEN = Object.freeze({
  length:     2.4,   // s rendered (was 1.8 — Alex's longer t60 needs the room; the last 40 ms fade out)
  t60:        3.15,  // s for the string to fall 60 dB
  bright:     0.87,  // 0 dark … 1 bright: how little the loop filter damps the highs
  pluckPos:   0.09,  // where the bachi meets the string (0.5 = middle; small = twangy)
  sawari:     0.55,  // 0 = a plain string, 1 = full buzz
  sawariEdge: 0.67,  // the neck contact, as a fraction of the string's current swing
  sawariHz:   4650,  // where the sizzle sits
  sawariQ:    1.1,
  sustainBias: 0.35, // how much slower the buzz fades than the string (0 = same)
  bachi:      1.16,  // the plectrum click
  skin:       0.79,  // the skin-head thump under it
  skinHz:     150,
  level:      0.9,   // peak after normalisation
});

const clamp01 = v => Math.max(0, Math.min(1, v));

/** Tiny deterministic PRNG — the same note always renders the same string, so
 *  the cache is exact and a repeated note never changes colour. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Render one shamisen note.
 * @param {number} sampleRate
 * @param {number} freq  Hz
 * @param {object} [params]  overrides for SHAMISEN
 * @returns {Float32Array}
 */
export function renderShamisenPluck(sampleRate, freq, params = {}) {
  const P = { ...SHAMISEN, ...params };
  const sr = sampleRate;
  const n = Math.max(1, Math.floor(sr * P.length));
  const out = new Float32Array(n);
  if (!(freq > 20) || !(sr > 0)) return out;
  const rand = mulberry32(Math.round(freq * 100) ^ 0x5a17);

  // ── the loop ──
  // y = g · ((1−S)·y[t−D] + S·y[t−D−1]). The two-tap average is the loop's
  // lowpass; its weight S also adds S samples of delay, so D is read that much
  // shorter and the string stays in tune at every brightness.
  const period = sr / freq;
  const S = 0.5 - 0.4 * clamp01(P.bright);
  const D = Math.max(2, period - S);
  const g = Math.pow(10, -3 / (Math.max(0.05, P.t60) * freq));   // −60 dB over t60, per circulation
  const size = Math.ceil(D) + 4;
  const ring = new Float32Array(size);
  let w = 0;
  const read = d => {
    let r = w - d; while (r < 0) r += size;
    const i0 = Math.floor(r), f = r - i0;
    return ring[i0 % size] * (1 - f) + ring[(i0 + 1) % size] * f;
  };

  // ── the excitation: one period of noise, softened, with the pluck-point notch ──
  const L = Math.max(2, Math.round(period));
  const ex = new Float32Array(L);
  const soft = 0.25 + 0.7 * clamp01(P.bright);
  let lp = 0;
  for (let i = 0; i < L; i++) { lp += soft * ((rand() * 2 - 1) - lp); ex[i] = lp; }
  const k = Math.max(1, Math.round(clamp01(P.pluckPos) * L));
  for (let i = L - 1; i >= k; i--) ex[i] -= ex[i - k];
  let exPeak = 0; for (const v of ex) exPeak = Math.max(exPeak, Math.abs(v));
  if (exPeak > 0) for (let i = 0; i < L; i++) ex[i] /= exPeak;

  // ── circulate: the plain string ──
  for (let i = 0; i < n; i++) {
    const y = (i < L ? ex[i] : 0) + g * ((1 - S) * read(D) + S * read(D + 1));
    ring[w] = y; w = (w + 1) % size;
    out[i] = y;
  }

  // ── SAWARI: the buzz off the neck ──
  // ⚠️ NOT IN THE LOOP. A one-sided clip inside Karplus-Strong was tried first and
  // measured as nothing but extra damping — the loop filter smooths away every
  // harmonic the contact makes, one circulation later (`.scratch/shamSpec.mjs`:
  // spectral centroid unchanged, level −45%). So the contact is modelled where the
  // ear hears it: the string's own waveform, normalised to its running swing and
  // clipped HARD and LOPSIDED (the string only hits the neck on one side), then
  // band-passed into the sizzle region. Its level follows the string, but falls
  // slower than it — `sustainBias` — which is what makes a shamisen note SING
  // on after the pluck ("bin—") instead of simply dying.
  if (P.sawari > 0) {
    const edge = Math.max(0.02, P.sawariEdge);
    const att = Math.exp(-1 / (0.0015 * sr)), rel = Math.exp(-1 / (0.03 * sr));
    // RBJ bandpass (constant 0 dB peak) around the sizzle
    const fc = Math.min(sr * 0.45, P.sawariHz ?? 3200), q = P.sawariQ ?? 1.1;
    const w0 = 2 * Math.PI * fc / sr, al = Math.sin(w0) / (2 * q), cw = Math.cos(w0), a0 = 1 + al;
    const b0 = al / a0, b2 = -al / a0, a1 = -2 * cw / a0, a2 = (1 - al) / a0;
    let env = 0, peakEnv = 1e-9, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const buzz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s0 = out[i], a = Math.abs(s0);
      env = a > env ? att * env + (1 - att) * a : rel * env;
      if (env > peakEnv) peakEnv = env;
      const u = s0 / (env + 1e-9);
      const v = u > edge ? 1 : u > 0 ? u / edge : Math.max(-0.35, u * 0.6);   // the lopsided contact
      const y = b0 * v + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = y;
      const rel01 = env / peakEnv;
      buzz[i] = y * env * Math.pow(rel01 + 1e-6, -(P.sustainBias ?? 0.35));
    }
    for (let i = 0; i < n; i++) out[i] += P.sawari * buzz[i];
  }

  // ── the bachi: a bright click and the skin thump under it ──
  const clickLen = Math.min(n, Math.floor(0.012 * sr));
  let prev = 0;
  for (let i = 0; i < clickLen; i++) {
    const nz = rand() * 2 - 1, hp = nz - prev; prev = nz;          // first difference = bright
    out[i] += P.bachi * 0.6 * hp * Math.exp(-i / (0.0035 * sr));
  }
  const thumpLen = Math.min(n, Math.floor(0.25 * sr));
  let ph = 0;
  for (let i = 0; i < thumpLen; i++) {
    const t = i / sr;
    const f = P.skinHz * (1 + 0.6 * Math.exp(-t / 0.012));           // the head's pitch drops as it settles
    ph += 2 * Math.PI * f / sr;
    out[i] += P.skin * Math.sin(ph) * Math.exp(-t / 0.045) * Math.min(1, t / 0.0015);
  }

  // A string rendered shorter than it rings would stop with a click — fade the
  // last 40 ms so the buffer always ends in silence, whatever t60 is dialled to.
  const tailN = Math.min(n, Math.floor(0.04 * sr));
  for (let i = 0; i < tailN; i++) out[n - 1 - i] *= i / tailN;

  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) { const s = P.level / peak; for (let i = 0; i < n; i++) out[i] *= s; }
  return out;
}

const CACHE_MAX = 96;
/** The rendered note as an AudioBuffer, cached on the context. */
export function shamisenBuffer(ctx, freq, params = {}) {
  const P = { ...SHAMISEN, ...params };
  const key = `${Math.round(freq * 8)}|${Object.keys(P).sort().map(k => P[k]).join('|')}`;
  const cache = ctx.__rlswShamisen ??= new Map();
  const hit = cache.get(key);
  if (hit && hit.sampleRate === ctx.sampleRate) { cache.delete(key); cache.set(key, hit); return hit; }
  const data = renderShamisenPluck(ctx.sampleRate, freq, P);
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  if (buf.copyToChannel) buf.copyToChannel(data, 0); else buf.getChannelData(0).set(data);
  cache.set(key, buf);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return buf;
}
