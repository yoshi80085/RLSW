// ─── 🧹 VOICE TEARDOWN CHECK ─────────────────────────────────────────────────
// Alex's playtest, 2026-09-30: *"Some of the melody lines that play out seem
// like they're getting 'cut off' part way through."*
//
// 🎯 THE CAUSE WAS NOT IN THE PHRASING. Every note `playAmpNote` builds is a
// ~25-node graph (oscillators → drive → one or two 4× waveshapers → a tone
// stack of biquads → envelope → echo loop / reverb send). The oscillators were
// stopped on time, but NOTHING WAS EVER DISCONNECTED — and Chrome keeps a
// BiquadFilter "ringing" for its computed tail, capped at 30 s, dragging the
// shapers behind it through the render the whole time. Measured in Chromium
// (`.scratch/voice-leak-probe/`): 60 KATANA notes burned ~0.8 of a CPU core for
// ~25 s AFTER the last note ended, then dropped to idle. A Ronin commit is ~28
// notes, so two commits and a barrage stack a few hundred silent zombie voices
// on the audio thread, it misses its deadline, and the NEXT phrase drops out
// mid-line.
//
// ⚠️ WHAT THIS SUITE GUARDS:
//   §1 — every voice gets a teardown hook, and the stop times did NOT move
//        (the fix is meant to be sound-neutral; a "tidy-up" that shortened the
//        tail would change Alex's dialled-in echo).
//   §2 — the ORDER: the front of the chain is cut when the sources end (they
//        are silent behind an envelope at −60 dB), the envelope, echo loop and
//        reverb send only after the echo's own fade has run out. Cutting the
//        echo early would clip every repeat; never cutting it is the leak.
//   §3 — after both stages nothing the note built still reaches the speakers.
//   §4 — wiring: a script runs this, and test:all runs the script.
//
// Run: npm run test:voiceleak
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = rel => fs.readFileSync(path.join(HERE, rel), 'utf8');

let pass = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) { pass++; }
  else { failures.push(msg); console.log('  ✗', msg); }
}

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
// ⏱️ Captured, never run on the wall clock — the suite fires them by hand.
const timers = [];
globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };

const A = await import('./ampVoice.js');

// ── a WebAudio graph recorder that also records disconnects ─────────────────
function mockCtx() {
  const nodes = [], edges = [];
  const param = (v = 0) => ({ value: v,
    setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const mk = (kind, extra = {}) => {
    const n = { kind, ...extra, out: true,
      connect(d) { edges.push([n, d]); return d; },
      disconnect() { n.out = false; } };
    nodes.push(n); return n;
  };
  const src = kind => mk(kind, { frequency: param(440), detune: param(0), playbackRate: param(1), buffer: null,
    start(t) { this.started = t; }, stop(t) { this.stopped = t; } });
  return {
    currentTime: 1, sampleRate: 48000, destination: { kind: 'destination', out: true }, nodes, edges,
    createOscillator: () => src('osc'),
    createBufferSource: () => src('buffer'),
    createGain: () => mk('gain', { gain: param(1) }),
    createBiquadFilter: () => mk('biquad', { frequency: param(350), Q: param(1), gain: param(0) }),
    createWaveShaper: () => mk('shaper', { curve: null, oversample: 'none' }),
    createDelay: () => mk('delay', { delayTime: param(0) }),
    createDynamicsCompressor: () => mk('compressor', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createConvolver: () => mk('convolver', { buffer: null }),
    createBuffer: (ch, len, sr) => ({ sampleRate: sr, length: len, getChannelData: () => new Float32Array(len), copyToChannel() {} }),
  };
}

/** Does node `n` still have a live path to the speakers? A disconnected node
 *  has no outputs at all — `disconnect()` with no argument cuts every edge. */
function reachesSpeakers(ctx, n, seen = new Set()) {
  if (n === ctx.destination) return true;
  if (!n.out || seen.has(n)) return false;
  seen.add(n);
  return ctx.edges.some(([a, b]) => a === n && reachesSpeakers(ctx, b, seen));
}

console.log('🧹 voiceTeardownCheck — a finished note leaves the audio graph\n');

// ── §1 + §2 + §3, for every voice the rig offers ─────────────────────────────
for (const voice of A.TONE_VOICE_ORDER) {
  for (const echo of [0, 0.55]) {
    timers.length = 0;
    const ctx = mockCtx();
    A.getAmpBuses(ctx);
    const busCount = ctx.nodes.length;
    const opts = { holdTime: 0.12, fadeTime: 0.08, volume: 0.15, when: 1.5,
      knobs: { voice, drive: 0.6, tone: 0.5, echo, verb: 0.3 } };
    A.playAmpNote(ctx, 330, opts);
    const mine = ctx.nodes.slice(busCount);
    const sources = mine.filter(n => typeof n.start === 'function' && n.started != null);
    const tag = `${voice} (echo ${echo})`;

    // §1 — a hook, and the stop times the rig always had.
    const hooked = sources.filter(s => typeof s.onended === 'function');
    ok(hooked.length === 1, `${tag}: exactly one source carries the teardown hook (got ${hooked.length})`);
    const tail = 0.35 + echo * 1.6;
    const expectStop = 1.5 + 0.12 + 0.08 + tail;
    ok(sources.every(s => Math.abs(s.stopped - expectStop) < 1e-9),
      `${tag}: every source still stops at now + hold + fade + tail (${expectStop.toFixed(3)})`);
    ok(mine.some(n => reachesSpeakers(ctx, n)), `${tag}: the note is audible before it ends`);
    ok(timers.length === 0, `${tag}: nothing is scheduled before the note has ended`);

    // §2 — stage one: the sources end. Only the front of the chain goes.
    ctx.currentTime = expectStop;
    hooked[0]?.onended?.();
    const front = mine.filter(n => ['osc', 'buffer', 'biquad', 'shaper'].includes(n.kind));
    ok(front.every(n => !reachesSpeakers(ctx, n)),
      `${tag}: once the sources end, no oscillator, filter or shaper is still pulled by the speakers`);
    const post = mine.filter(n => n.kind === 'delay' || (n.kind === 'gain' && n.out === true));
    ok(echo === 0 || mine.some(n => n.kind === 'delay' && reachesSpeakers(ctx, n)),
      `${tag}: the echo loop is still connected — its repeats have not finished`);
    ok(timers.length === 1, `${tag}: one clean-up is queued for the echo tail`);
    const echoEnd = 1.5 + 0.12 + 0.08 + 0.6 + echo * 1.6;
    const due = ctx.currentTime + (timers[0]?.ms ?? 0) / 1000;
    ok(due >= echoEnd, `${tag}: the tail clean-up waits for the echo fade (${due.toFixed(3)} ≥ ${echoEnd.toFixed(3)})`);

    // §3 — stage two: nothing the note built can reach the speakers.
    timers[0]?.fn?.();
    ok(mine.every(n => !reachesSpeakers(ctx, n)), `${tag}: after the tail, the whole note is out of the graph`);
    ok(post.length >= 1, `${tag}: (sanity) the note built a post-envelope path to clean up`);
    // The SHARED buses must survive — they serve every note after this one.
    const buses = A.getAmpBuses(ctx);
    ok(buses.master.out && buses.verbBus.out && buses.notesGain.out, `${tag}: the shared master, reverb and fader are untouched`);
  }
}

// ── §4 — the source says why, and the suite is wired ─────────────────────────
{
  const src = read('./ampVoice.js');
  ok(/VOICE TEARDOWN/.test(src) && /30 s/.test(src), 'ampVoice.js carries the teardown and says why (the 30 s biquad tail)');
  const pkg = JSON.parse(read('../../package.json'));
  ok(!!pkg.scripts['test:voiceleak'], 'npm run test:voiceleak exists');
  ok(/test:voiceleak/.test(pkg.scripts['test:all']), '…and test:all runs it');
}

console.log('');
if (failures.length) {
  console.log(`❌ voiceTeardownCheck: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`✅ voiceTeardownCheck: ${pass} assertions passed`);
