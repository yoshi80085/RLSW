// ─── 🎚️ MIXER CHECK ──────────────────────────────────────────────────────────
// The three volume channels: the store, the persistence, the multiplier
// semantics, and the two WebAudio buses the faders actually reach.
//
// ⚠️ WHAT THIS SUITE IS REALLY GUARDING is the multiplier rule. Every sound in
//    the game carries its own mix level and the fader SCALES it. The tempting
//    "simplification" — have the fader just set the volume — flattens the bed,
//    the menu song and a battle song to one loudness, and it does so silently:
//    the game still plays, it just stops having dynamics. §3 is that tripwire.
//
// Run: npm run test:mix
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

let pass = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { failures.push(msg); console.log('  ✗', msg); }
}
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// ── a localStorage that behaves like the real one, before the module loads ───
let store = {};
globalThis.localStorage = {
  getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};

const M = await import('./mixer.js');

// ═══ 1. THE DIAL-IN ═════════════════════════════════════════════════════════
console.log('\n§1 the defaults are the levels Alex landed on');
{
  ok(near(M.MIX_DEFAULTS.music, 0.44), 'music defaults to 0.44');
  ok(near(M.MIX_DEFAULTS.notes, 0.61), 'notes defaults to 0.61');
  ok(near(M.MIX_DEFAULTS.sfx,   0.54), 'sfx defaults to 0.54');
  ok(M.MIX_CHANNELS.length === 3, 'three channels, no more');
  ok(M.MIX_CHANNELS.map(c => c.id).join(',') === 'music,notes,sfx',
     'in the order they are drawn: music, notes, sfx');
  ok(M.MIX_CHANNELS.every(c => c.icon && c.label && c.color && c.title),
     'every channel carries the icon, label, colour and tooltip the ☰ row needs');
}

// ═══ 2. THE STORE ═══════════════════════════════════════════════════════════
console.log('\n§2 setting, clamping and subscribing');
{
  M.setLevel('notes', 0.25);
  ok(near(M.getLevel('notes'), 0.25), 'a level round-trips');

  M.setLevel('notes', 5);   ok(near(M.getLevel('notes'), 1), 'above 1 clamps to 1');
  M.setLevel('notes', -3);  ok(near(M.getLevel('notes'), 0), 'below 0 clamps to 0');

  const before = M.getLevel('notes');
  M.setLevel('notes', 'loud');
  ok(near(M.getLevel('notes'), before), 'a non-number is refused, not coerced to NaN');

  M.setLevel('nope', 0.5);
  ok(M.getLevel('nope') === 1, 'an unknown channel reads as 1 — a typo is silent, never mute');

  var seen = [];
  const off = M.onMixChange(m => seen.push(m.sfx));
  M.setLevel('sfx', 0.3);
  M.setLevel('sfx', 0.3);                       // unchanged — must not re-notify
  ok(seen.length === 1, `a no-op set does not notify (${seen.length} notification)`);
  off();
  M.setLevel('sfx', 0.9);
  ok(seen.length === 1, 'unsubscribe actually unsubscribes');

  const snap = M.getMix(); snap.music = 999;
  ok(!near(M.getLevel('music'), 999), 'getMix() hands out a copy, not the live object');

  // A subscriber that throws must not take the others down with it.
  var reached = false;
  const offBad  = M.onMixChange(() => { throw new Error('boom'); });
  const offGood = M.onMixChange(() => { reached = true; });
  M.setLevel('music', 0.2);
  ok(reached, 'a throwing subscriber does not deafen the ones after it');
  offBad(); offGood();
}

// ═══ 3. MULTIPLIER SEMANTICS — the tripwire ═════════════════════════════════
console.log('\n§3 the fader SCALES each sound, it does not replace it');
{
  M.setLevel('music', 0.5);
  ok(near(M.musicVol(0.4), 0.20), 'the bed at 0.40 → 0.200');
  ok(near(M.musicVol(0.7), 0.35), 'a battle song at 0.70 → 0.350');
  ok(M.musicVol(0.7) > M.musicVol(0.4),
     '⚠️ the battle song is still LOUDER than the bed — the mix survived the fader');

  M.setLevel('sfx', 0.5);
  ok(near(M.sfxVol(0.85), 0.425), 'thunder at 0.85 → 0.425');
  ok(near(M.musicVol(), 0.5), 'musicVol() with no base is the raw level');

  M.setLevel('music', 0);
  ok(near(M.musicVol(0.7), 0), 'zero is silence — there is no mute button by design');
}

// ═══ 4. PERSISTENCE ═════════════════════════════════════════════════════════
console.log('\n§4 the levels survive a reload');
{
  M.setLevel('music', 0.33);
  const raw = store['rlsw.mix.v1'];
  ok(!!raw, 'the mix was written to localStorage');
  ok(near(JSON.parse(raw).music, 0.33), 'the stored value is the one that was set');

  // Corrupt storage must degrade to defaults, not throw on import.
  store['rlsw.mix.v1'] = '{not json';
  const M2 = await import('./mixer.js?corrupt');
  ok(near(M2.getLevel('music'), 0.44), 'unparseable storage falls back to the defaults');

  // ⚠️ null and '' are the dangerous ones: Number() turns both into 0, i.e. a
  //    silent channel that looks like a deliberate setting. They must be refused.
  store['rlsw.mix.v1'] = JSON.stringify({ music: 'x', notes: 0.9, sfx: null });
  const M3 = await import('./mixer.js?partial');
  ok(near(M3.getLevel('notes'), 0.9),  'a valid stored channel is honoured');
  ok(near(M3.getLevel('music'), 0.44), 'an invalid one falls back to its default');
  ok(near(M3.getLevel('sfx'),   0.54), 'a null one falls back to its default, NOT to 0');

  store['rlsw.mix.v1'] = JSON.stringify({ music: '', notes: [], sfx: '0.8' });
  const M3b = await import('./mixer.js?coerce');
  ok(near(M3b.getLevel('music'), 0.44), 'an empty string does not read as 0');
  ok(near(M3b.getLevel('notes'), 0.61), 'an empty array does not read as 0');
  ok(near(M3b.getLevel('sfx'),   0.54), 'a numeric STRING is refused too — storage holds numbers');

  // ⚠️ localStorage throws outright in a private window. Importing must survive.
  const realLS = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const M4 = await import('./mixer.js?throws');
  ok(near(M4.getLevel('notes'), 0.61), 'storage that throws still yields a working mixer');
  M4.setLevel('notes', 0.5);
  ok(near(M4.getLevel('notes'), 0.5), 'and it still takes changes it cannot persist');
  globalThis.localStorage = realLS;

  M.resetMix();
  ok(near(M.getLevel('music'), 0.44) && near(M.getLevel('notes'), 0.61) && near(M.getLevel('sfx'), 0.54),
     'resetMix() puts all three back to the dial-in');
}

// ═══ 5. THE BUSES THE FADERS ACTUALLY REACH ═════════════════════════════════
// A fake WebAudio context: enough graph to prove the routing, and it RECORDS
// connections so the test can assert where the gain sits in the chain.
console.log('\n§5 the gain nodes are wired into the audio graph');
{
  function fakeCtx() {
    const edges = [];
    const node = (kind) => ({
      kind, gain: { value: 1, setTargetAtTime(v) { this.value = v; } },
      frequency: { value: 0, setValueAtTime() {} }, Q: { value: 0 },
      threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 },
      attack: { value: 0 }, release: { value: 0 }, buffer: null, type: '',
      connect(t) { edges.push([this, t]); return t; }, disconnect() {},
    });
    const ctx = {
      currentTime: 0, sampleRate: 44100, edges,
      destination: node('destination'),
      createGain: () => node('gain'),
      createDynamicsCompressor: () => node('compressor'),
      createConvolver: () => node('convolver'),
      createBiquadFilter: () => node('filter'),
      createOscillator: () => ({ ...node('osc'), start() {}, stop() {} }),
      createBufferSource: () => ({ ...node('bufsrc'), start() {}, stop() {} }),
      createWaveShaper: () => node('shaper'),
      createDelay: () => ({ ...node('delay'), delayTime: { value: 0 } }),
      createBuffer: (ch, len) => ({ sampleRate: 44100, length: len,
        getChannelData: () => new Float32Array(len) }),
    };
    return ctx;
  }

  const amp = await import('./ampVoice.js');
  M.setLevel('notes', 0.61);
  const ctx = fakeCtx();
  const buses = amp.getAmpBuses(ctx);
  ok(!!buses.notesGain, 'getAmpBuses exposes the notes gain');
  ok(near(buses.notesGain.gain.value, 0.61), 'it opens at the stored notes level');

  const from = e => e[0], to = e => e[1];
  const masterOut = ctx.edges.filter(e => from(e) === buses.master).map(to);
  ok(masterOut.includes(buses.notesGain) && !masterOut.includes(ctx.destination),
     '⚠️ the compressor feeds the fader, NOT the destination — a gain before the '
     + 'compressor would be undone by it');
  ok(ctx.edges.some(e => from(e) === buses.notesGain && to(e) === ctx.destination),
     'the fader is the last node before the speakers');
  ok(ctx.edges.some(e => from(e) === buses.verbBus && to(e) === buses.master),
     'the reverb bus still lands on the compressor, so verb is faded too');

  M.setLevel('notes', 0.2);
  ok(near(buses.notesGain.gain.value, 0.2), 'moving the fader moves the live gain node');

  ok(amp.getAmpBuses(ctx) === buses, 'the buses are cached per context, not rebuilt');

  // ── SFX: every sound in riffSfx must land on one shared bus ───────────────
  const sfxSrc = fs.readFileSync(path.join(HERE, 'riffSfx.js'), 'utf8');
  const stray = sfxSrc.split('\n').filter(l =>
    l.includes('ctx.destination') && !l.includes('bus.connect(ctx.destination)'));
  ok(stray.length === 0,
     `no sound bypasses the SFX bus (${stray.length} stray connect(s) to ctx.destination)`);
  ok(sfxSrc.match(/getSfxBus\(ctx\)/g).length >= 9,
     `all nine emitters route through getSfxBus (${(sfxSrc.match(/getSfxBus\(ctx\)/g) || []).length} call sites)`);
  ok(/__rlswSfxBus/.test(sfxSrc), 'the bus is cached on the context, so it is not built twice');
}

// ═══ 6. THE ☰ ROW ═══════════════════════════════════════════════════════════
console.log('\n§6 TopMenu can draw a fader');
{
  const menuSrc = fs.readFileSync(path.join(HERE, '..', 'ui', 'TopMenu.jsx'), 'utf8');
  ok(/const PANEL_W = 216;/.test(menuSrc), 'the panel widened to 216 for the faders');
  ok(/it\.kind === "fader"/.test(menuSrc), 'the render has a fader branch');
  ok(/function Fader\(/.test(menuSrc), 'the Fader component exists');
  ok(!/kind === "fader"[\s\S]{0,400}mute/i.test(menuSrc),
     'no mute control — zero is mute, per the dial-in');

  const stylesSrc = fs.readFileSync(path.join(HERE, '..', 'ui', 'GameStyles.jsx'), 'utf8');
  ok(/rlsw-fader/.test(stylesSrc),
     '⚠️ the fader CSS is in GameStyles — a range input is drawn by pseudo-elements '
     + 'that an inline style cannot reach');
  ok(/::-webkit-slider-thumb/.test(stylesSrc) && /::-moz-range-thumb/.test(stylesSrc),
     'both engines are dressed, so it is never the default blue slider');
}

console.log(
  failures.length
    ? `\n✗ MIXER CHECK FAILED — ${pass} passed, ${failures.length} failed:\n    ` + failures.join('\n    ')
    : `\n✓ Mixer check passed — ${pass} assertions`
);
assert.equal(failures.length, 0);
