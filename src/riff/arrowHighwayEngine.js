// =============================================================================
// riff/arrowHighwayEngine.js — 🎸 THE ARROW HIGHWAY, verbatim from the prototype
// -----------------------------------------------------------------------------
// This IS arrow-highway-proto.html's engine — the canvas renderer, the amp, the
// one-key judge, sustains, bends, chords and every tuning knob — lifted out of
// the page and given a mount/unmount contract so React can host it.
//
// It is deliberately NOT a React rewrite. The prototype is the version that got
// playtested and signed off; re-expressing it in JSX would re-introduce exactly
// the drift that made the first port "not it". Rendering is canvas + rAF and
// stays that way. React's only jobs are to hand it a <canvas> and to render the
// knob panel that writes into K.
//
// The one substitution: the generator is imported from riff/riffArchetypes.js
// instead of being inlined, so the module and the practice mode cannot drift.
//
// USAGE
//   const h = mountArrowHighway(canvasEl);   // starts its own rAF loop
//   h.K.tier = 'shredder';                   // knobs are live-mutable
//   h.newRiff(); h.start(); h.replay();
//   h.onStats = (s) => ...                   // fired on every judgment
//   h.destroy();                             // cancels rAF, releases audio
// =============================================================================

import {
  generateArchetypeRiff, analyseArrows, GENRES, SCALES, STYLE_BIAS,
} from './riffArchetypes.js';


/* ══════════════════════════════════════════════════════════════════════════
   1. CONSTANTS — mirrored from src/riff/fallingNotes.js + guitarMap.js
   ══════════════════════════════════════════════════════════════════════════ */

// showNums mirrors R2's showLabels ladder: the teaching tiers print the key on
// the gem, the high tiers make you read the lane.
const TIERS = {
  rookie:   { label:'INFLUENCER', leadTime:2000, perfect:150, good:320, ok:520, maxLen:9,  showNums:true  },
  gigging:  { label:'GIGGING',    leadTime:1600, perfect:120, good:250, ok:420, maxLen:11, showNums:true  },
  shredder: { label:'SHREDDER',   leadTime:1150, perfect:90,  good:190, ok:340, maxLen:13, showNums:false },
  virtuoso: { label:'VIRTUOSO',   leadTime:900,  perfect:75,  good:160, ok:280, maxLen:16, showNums:false },
};

// guitarMap.js: semitones above low E2 for each open string. Index 0 = low E.
const STRING_OPENS = [0, 5, 10, 15, 19, 24];
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const LOW_E_HZ     = 82.41;
const MAX_FRET     = 12;

// RiffHighway.jsx palette — cyan → magenta across the strings.
const NEON = { cyan:'#19e6ff', magenta:'#ff2d95', violet:'#8a5cff', orange:'#ff8a2a', white:'#ffffee' };
const STRING_COLORS = ['#19e6ff', '#33ccff', '#6699ff', '#8a5cff', '#cc44dd', '#ff2d95'];
const GAUGE = [11.98, 11.86, 11.02, 9.62, 8.29, 6.02].map(g => g / 11.98); // relative thickness

const GRADE_COLOR = { perfect:NEON.white, good:NEON.cyan, ok:NEON.violet, miss:'#555566', wrong:'#555566' };

const DIR_GLYPH = { up:'↑', down:'↓', same:'→' };

// ── Direction palettes ───────────────────────────────────────────────────────
// rgb: the intuitive one — green up, red down, blue same.
//   Costs: red/green is the worst pair for colour-vision deficiency (~8% of
//   men), and red already means "you missed" everywhere else in the UI.
// neon: same job, moved onto the blue↔yellow axis that survives every common
//   CVD type, and onto the game's own outrun palette instead of stoplight RGB.
const DIR_PALETTES = {
  rgb:  { up:'#3ddc6b', down:'#ff3b3b', same:'#3b82ff' },
  neon: { up:'#19e6ff', down:'#ff8a2a', same:'#c66cff' },
};

/* ══════════════════════════════════════════════════════════════════════════
   2. RIFF GENERATION — archetypes, not a random walk
   ══════════════════════════════════════════════════════════════════════════ */

let seed = 1337;
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }


/**
 * Mount the highway onto a canvas. Everything below this line is the
 * prototype's own code, with `document.getElementById('cv')` replaced by the
 * canvas passed in and the panel wiring replaced by the returned handle.
 */
export function mountArrowHighway(canvasEl) {
  const cv = canvasEl;

  // Voice an archetype riff onto the neck. The generator works in semitones above
  // a riff root; this drops it into a comfortable register and picks playable
  // cells, keeping the hand near where it just was.
  function voiceOntoNeck(notes) {
    let ref = 5;
    for (const n of notes) {
      let best = null;
      for (let s = 0; s < 6; s++) {
        const fret = n.pitch - STRING_OPENS[s];
        if (fret < 0 || fret > MAX_FRET) continue;
        const cost = Math.abs(fret - ref) + (fret === 0 ? -1.5 : 0);
        if (!best || cost < best.cost) best = { s, fret, cost };
      }
      if (!best) { // out of range — fold an octave into the neck
        n.pitch += n.pitch > 30 ? -12 : 12;
        for (let s = 0; s < 6; s++) {
          const fret = n.pitch - STRING_OPENS[s];
          if (fret < 0 || fret > MAX_FRET) continue;
          const cost = Math.abs(fret - ref);
          if (!best || cost < best.cost) best = { s, fret, cost };
        }
      }
      best = best || { s: 0, fret: 5 };
      n.string = best.s; n.fret = best.fret;
      if (best.fret > 0) ref = best.fret;
    }
    return notes;
  }

  let LAST_BUILD = null;

  /**
   * Force the sustain rate to the knob, with a FLOOR so holds are always part of
   * play. Left purely to the genre weights, a thrash riff can come out with zero
   * sustains and the hold mechanic silently disappears for that round — you'd
   * never learn it exists. Every riff gets at least one, and its last note always
   * rings, so a riff ends by being held rather than by stopping dead.
   *
   * Sustains prefer ACCENTS and never land in the MIDDLE of a chug run: holding
   * a note that's meant to be a machine-gun palm mute fights the groove. The note
   * that ENDS a chug run is fair game though — chug-chug-chug-CHUNNNG is one of
   * the most standard riff endings there is, so that case is allowed on purpose.
   */
  function applySustainRate(notes) {
    const want = Math.max(1, Math.round(notes.length * (K.susRate / 100)));
    notes.forEach(n => { n.sustain = 0; n.bend = false; });

    const last = notes.length - 1;
    const midChug = i => !!(notes[i + 1] && notes[i + 1].chugPart);   // a repeat follows ⇒ mid-run
    const eligible = notes.map((n, i) => i)
      .filter(i => i !== last && !midChug(i))
      .sort((a, b) => (notes[b].accent ? 1 : 0) - (notes[a].accent ? 1 : 0) || rand() - 0.5);

    const dur = () => 420 + Math.round(rand() * 620);
    notes[last].sustain = 640 + Math.round(rand() * 700);          // always ring out
    for (let k = 0; k < Math.min(want - 1, eligible.length); k++) notes[eligible[k]].sustain = dur();

    applyBends(notes);
  }

  /**
   * BENDS — a gesture performed on a note that is already ringing.
   *
   * You cannot bend a note you are not fretting, so a bend only ever rides a
   * SUSTAIN: hold the number, then push ↑ or ↓ while it rings. That mirrors the
   * real motion (fret hand holds, bending hand pushes) and it means the arrow
   * keys came back for something the hands can actually do — unlike chording a
   * number and an arrow on every single note.
   *
   * The bend needs ROOM. A 300ms tail cannot host a gesture with a judging
   * window on either side, so short sustains are stretched or skipped.
   */
  const BEND_MIN_SUSTAIN = 520;      // ms — below this there is no room to bend
  const SHOWPIECE_MIN_SUSTAIN = 900; // a minor-third bend needs a tail to sing on

  /**
   * BALANCE: a showpiece bend is worth something because it's RARE and because
   * it lands somewhere it can breathe. Scattering minor-thirds through a riff
   * makes them wallpaper. So:
   *   • most bends are subtle or standard, chosen by roll
   *   • at most ~1 showpiece per 9 notes, and never more than 2 in a riff
   *   • a showpiece is PROMOTED onto the best host — the longest tail, with the
   *     final note preferred, because a riff that ends on a screaming bend is a
   *     riff that ends on a statement
   *   • a tail too short to carry the gesture never gets promoted at all
   */
  function applyBends(notes) {
    const want = K.bendRate / 100;
    for (const n of notes) {
      n.bend = false; n.bendDir = null; n.bendAmt = 0; n.bendAt = 0; n.bendWeight = null;
      if (!n.sustain || rand() >= want) continue;
      if (n.sustain < BEND_MIN_SUSTAIN) n.sustain = BEND_MIN_SUSTAIN + Math.round(rand() * 260);

      n.bend = true;
      // Real bends push the pitch UP the overwhelming majority of the time —
      // a down-bend is a pre-bend release, a rarer and more advanced move.
      n.bendDir = rand() < 0.82 ? 'up' : 'down';
      // Default weight: mostly the workhorse whole step, a decent share of
      // half-step nudges. Showpieces are NOT rolled here — they're promoted.
      n.bendWeight = rand() < 0.42 ? 'subtle' : 'standard';
      // land the gesture in the middle of the tail, never at either edge
      n.bendAt = Math.round(n.sustain * (0.34 + rand() * 0.24));
    }

    // ── promote a showpiece, if the riff has earned one ────────────────────
    if (K.bendDepth >= 3) {
      // Rarity is the whole point. Roughly one riff in three gets a showpiece at
      // all; only a long riff can ever carry two. Tuned by measurement, not by
      // feel — the first pass handed one to 59% of riffs and made them wallpaper.
      let budget = rand() < 0.32 ? 1 : 0;
      if (notes.length >= 14 && budget && rand() < 0.22) budget = 2;
      const hosts = notes
        .map((n, i) => ({ n, i }))
        .filter(({ n }) => n.bend && n.sustain >= SHOWPIECE_MIN_SUSTAIN)
        .sort((a, b) =>
          // last note wins ties — ending on a scream is the strongest placement
          (b.i === notes.length - 1 ? 1e6 : 0) - (a.i === notes.length - 1 ? 1e6 : 0) ||
          b.n.sustain - a.n.sustain);

      for (let k = 0; k < Math.min(budget, hosts.length); k++) {
        const { n } = hosts[k];
        n.bendWeight = 'showpiece';
        n.bendDir = 'up';                       // you don't scream downward
        n.bendAt = Math.round(n.sustain * 0.30); // start early — it needs runway
      }
    }

    // depth follows weight, capped by the knob
    for (const n of notes) {
      if (!n.bend) continue;
      n.bendAmt = Math.min(K.bendDepth, BEND_WEIGHTS[n.bendWeight].semis);
    }
  }

  /**
   * TWO-NOTE CHORDS — the power chord.
   *
   * Partner is a fifth above the root, voiced on the ADJACENT string. That is
   * not an arbitrary choice: in standard tuning the fifth above a root on string
   * s sits on string s+1 two or three frets up, which means the two gems land on
   * ADJACENT NUMBER KEYS. One hand can press 3+4 comfortably; it could not press
   * 2+6. The instrument's tuning is doing the ergonomics for us.
   *
   * Inserted AFTER the timeline is built, sharing the root's hit time exactly.
   */
  function applyChords(notes, times) {
    const rate = K.chordRate / 100;
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.partnerOf != null || n.hasPartner) continue;
      if (!n.accent && rand() > rate * 0.4) continue;
      if (rand() >= rate) continue;
      if (n.chugPart) continue;                          // chugs stay single-note

      const target = n.pitch + 7;                        // the fifth
      const s = n.string + 1;
      if (s > 5) continue;                               // no string above the high e
      const fret = target - STRING_OPENS[s];
      if (fret < 0 || fret > MAX_FRET) continue;

      const partner = {
        ...n, pitch: target, string: s, fret,
        sustain: n.sustain, bend: false, bendDir: null, bendAmt: 0, bendAt: 0,
        partnerOf: i, dir: n.dir, accent: n.accent,
      };
      n.hasPartner = true;
      notes.splice(i + 1, 0, partner);
      times.splice(i + 1, 0, times[i]);                  // same instant, exactly
      // reindex partnerOf for anything shifted right
      for (let k = i + 2; k < notes.length; k++) {
        if (notes[k].partnerOf != null && notes[k].partnerOf >= i + 1) notes[k].partnerOf++;
      }
    }
  }

  // fallingNotes.js buildRiffTimeline. The archetype generator supplies its own
  // gapBefore per note (a gallop's short-short is not negotiable), so use it.
  function buildTimeline(notes, leadTime, spacing) {
    let t = leadTime;
    return notes.map((n, i) => {
      if (i > 0) t += (n.gapBefore ?? 300) + spacing;
      return t;
    });
  }

  function freqOf(note) {
    return LOW_E_HZ * Math.pow(2, (STRING_OPENS[note.string] + note.fret) / 12);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     3. AUDIO — the pitch is REAL. Arrows are input; this is what it sounds like.
     ══════════════════════════════════════════════════════════════════════════ */

  let actx = null;
  function audio() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  // ── THE AMP ──────────────────────────────────────────────────────────────────
  // One shared signal path, built once — a real rig is one amp, not one per note.
  // This matters for more than tidiness: because each note's pick envelope runs
  // INTO the distortion rather than after it, the chain compresses the way a real
  // cranked amp does — hitting harder makes it saturate, not get louder. That
  // compression is most of what makes a distorted guitar sound like one.
  //
  //   notes → [pre-gain] → [waveshaper] → [high-pass] → [mid hump] → [cab] → out
  //
  let AMP = null;

  function distortionCurve(amount) {
    const n = 8192, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      // asymmetric soft clip — even harmonics, which is the "tube" flavour
      curve[i] = Math.tanh(amount * x) * (x > 0 ? 1 : 0.88);
    }
    return curve;
  }

  function getAmp() {
    if (AMP) return AMP;
    const ac = audio();

    const input = ac.createGain();  input.gain.value = 1;
    const pre   = ac.createGain();  pre.gain.value   = 1;
    const shaper = ac.createWaveShaper();
    shaper.curve = distortionCurve(8);
    shaper.oversample = '4x';

    // Guitar speakers have no bottom below ~90Hz and nothing above ~5kHz. That
    // band-limiting is what stops a distorted saw sounding like a chainsaw.
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 95; hp.Q.value = 0.7;

    const mid = ac.createBiquadFilter();          // the presence hump
    mid.type = 'peaking'; mid.frequency.value = 1400; mid.Q.value = 0.9; mid.gain.value = 5;

    const scoop = ac.createBiquadFilter();        // classic metal mid-scoop
    scoop.type = 'peaking'; scoop.frequency.value = 500; scoop.Q.value = 1.1; scoop.gain.value = -4;

    const cab = ac.createBiquadFilter();
    cab.type = 'lowpass'; cab.frequency.value = 4600; cab.Q.value = 0.9;

    const out = ac.createGain(); out.gain.value = 0.22;

    input.connect(pre); pre.connect(shaper); shaper.connect(hp);
    hp.connect(mid); mid.connect(scoop); scoop.connect(cab); cab.connect(out);
    out.connect(ac.destination);

    AMP = { ac, input, pre, shaper, cab, out };
    return AMP;
  }

  function setDrive(v) {                          // 0..1 → clean-ish to cranked
    const amp = getAmp();
    amp.shaper.curve = distortionCurve(2 + v * 26);
    amp.pre.gain.value = 0.6 + v * 2.6;
    amp.cab.frequency.value = 3600 + v * 1800;
  }

  /**
   * THE SHAPE OF A BEND.
   *
   * A bend is not a pitch jump — it's a journey, and the journey is the
   * expression. Three things make it read as a real one:
   *
   *   1. TRAVEL. The ear needs time to hear the pitch move. A 130ms snap is
   *      barely a bend; ~220ms is a player leaning into it.
   *   2. OVERSHOOT. Hands overshoot slightly and settle back. That tiny
   *      correction is most of what makes it sound human rather than pitch-shifted.
   *   3. VIBRATO at the top. Nobody holds a bend dead still — the wobble at the
   *      peak is the signature of a player, and it's what carried the "way up"
   *      drama in the broken replay.
   *
   * `v.base` is the source of truth, never `frequency.value` — see mk().
   */
  // Not every bend is a showpiece. A half-step nudge and a minor-third scream are
  // different gestures, and playing them with the same shape makes both wrong:
  // the small one sounds overwrought, the big one sounds flat. Weight class
  // drives depth, travel time, overshoot and vibrato together.
  const BEND_WEIGHTS = {
    subtle:    { semis: 1, travel: 0.52, over: 0.08, vib: 0.07, cycles: 3, rate: 0.075, label: '' },
    standard:  { semis: 2, travel: 1.00, over: 0.26, vib: 0.20, cycles: 6, rate: 0.090, label: '' },
    showpiece: { semis: 3, travel: 1.55, over: 0.44, vib: 0.40, cycles: 9, rate: 0.105, label: 'SING' },
  };

  /**
   * THE SHAPE OF A BEND.
   *
   * A bend is a journey, not a pitch jump, and the journey is the expression:
   *   1. TRAVEL — the ear needs time to hear pitch move. 130ms is a blip; a
   *      showpiece leans in over a third of a second.
   *   2. OVERSHOOT — hands go slightly past and settle back. That correction is
   *      most of what separates "played" from "pitch-shifted".
   *   3. VIBRATO at the peak — nobody holds a bend dead still. This is what
   *      carried the drama in the broken replay, so it's kept deliberately.
   * All three scale with weight, so a subtle bend stays subtle.
   *
   * `v.base` is the source of truth, never `frequency.value` — see mk().
   */
  function scheduleBend(v, at, semis, ac, weight = 'standard') {
    const w = BEND_WEIGHTS[weight] ?? BEND_WEIGHTS.standard;
    const travel = K.bendTravel * w.travel;
    const sign = Math.sign(semis) || 1;
    const target = v.base * Math.pow(2, semis / 12);
    const over   = v.base * Math.pow(2, (semis + sign * w.over) / 12);
    const p = v.o.frequency;

    p.setValueAtTime(v.base, at);
    p.linearRampToValueAtTime(over, at + travel * 0.82);      // lean past it
    p.linearRampToValueAtTime(target, at + travel);            // settle onto pitch

    let t = at + travel;
    const depth = Math.pow(2, w.vib / 12);
    for (let k = 0; k < w.cycles; k++) {
      const d = 1 + (depth - 1) * (1 - k / (w.cycles + 2));    // decaying wobble
      p.linearRampToValueAtTime(target * (k % 2 ? d : 1 / d), t + w.rate);
      t += w.rate;
    }
    return target;
  }

  /**
   * One note through the amp.
   * @param {number} freq
   * @param {number=} when      ac time, default now
   * @param {number=} dur       ringing length in seconds
   * @param {object=} opts      { bend, palm, fifth, gain }
   */
  function pluck(freq, when, dur, opts = {}) {
    const amp = getAmp();
    const ac = amp.ac;
    const t0 = when ?? ac.currentTime;
    const len = dur ?? 0.55;
    const palm = !!opts.palm;

    const env = ac.createGain();
    const tone = ac.createBiquadFilter();
    tone.type = 'lowpass';
    // palm mutes are darker and choke fast — that's the chug
    tone.frequency.setValueAtTime(palm ? Math.min(2600, freq * 7) : Math.min(6500, freq * 13), t0);
    tone.frequency.exponentialRampToValueAtTime(palm ? 700 : Math.max(600, freq * 3), t0 + len);
    tone.Q.value = 1.2;

    const voices = [];
    const mk = (type, f, detune, level) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t0);
      o.detune.setValueAtTime(detune, t0);
      g.gain.value = level;
      o.connect(g); g.connect(tone);
      // Keep the base frequency ON the voice. Reading it back off the AudioParam
      // later does NOT work: `.value` returns the param's value at the CURRENT
      // time, and for a note scheduled in the future setValueAtTime hasn't taken
      // effect yet — so `.value` hands back the OscillatorNode default of 440Hz.
      // That was the replay bend bug: every bend ramped toward 440·2^(n/12)
      // regardless of the note, which sounded huge and was completely wrong.
      voices.push({ o, g, base: f });
      return o;
    };

    // two detuned saws = the thickness; a square an octave down = body
    const a = mk('sawtooth', freq,  -7, 1.0);
    const b = mk('sawtooth', freq, +8,  0.85);
    mk('square', freq / 2, 0, 0.28);
    // a fifth on top turns single notes into power chords — accents only
    if (opts.fifth) mk('sawtooth', freq * Math.pow(2, 7 / 12), 4, 0.5);

    if (opts.bend) {                              // pre-scheduled bend (replay only)
      const semis = (opts.bendAmt ?? 2) * (opts.bendDir === 'down' ? -1 : 1);
      const start = t0 + (opts.bendAt ?? Math.min(0.18, len * 0.35));
      for (const v of voices) scheduleBend(v, start, semis, ac, opts.bendWeight);
    }

    // Pick envelope: near-instant attack, then a long ring. Distorted guitar
    // sustains far longer than clean — that's the compression again.
    const peak = (opts.gain ?? 0.5) * (palm ? 0.85 : 1);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    if (palm) {
      env.gain.exponentialRampToValueAtTime(peak * 0.25, t0 + 0.06);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.min(len, 0.3));
    } else {
      env.gain.setTargetAtTime(peak * 0.55, t0 + 0.02, 0.15);
      env.gain.setTargetAtTime(0.0001, t0 + len * 0.75, Math.max(0.05, len * 0.18));
    }

    tone.connect(env); env.connect(amp.input);
    const stop = t0 + len + 0.4;
    for (const v of voices) { v.o.start(t0); v.o.stop(stop); }

    // A LIVE handle. Bends happen to a note that is already ringing, so the
    // caller has to be able to reach back into it and move the pitch — fire and
    // forget is not enough once the player is bending in real time.
    return {
      voices,
      /** Bend a note that is ALREADY RINGING — the live path. */
      bendTo(semis, weight = 'standard') {
        const now = ac.currentTime;
        const travel = K.bendTravel * (BEND_WEIGHTS[weight] ?? BEND_WEIGHTS.standard).travel;
        for (const v of voices) {
          v.o.frequency.cancelScheduledValues(now);
          scheduleBend(v, now, semis, ac, weight);
        }
        // A real bend opens the tone up as the string tightens, and digs in —
        // both help you HEAR that the gesture landed.
        const tf = tone.frequency.value;
        tone.frequency.cancelScheduledValues(now);
        tone.frequency.setValueAtTime(tf, now);
        tone.frequency.linearRampToValueAtTime(Math.min(7000, tf * 1.9), now + travel);
        const gv = env.gain.value;
        env.gain.cancelScheduledValues(now);
        env.gain.setValueAtTime(gv, now);
        env.gain.linearRampToValueAtTime(gv * 1.28, now + travel * 0.6);
        env.gain.setTargetAtTime(gv * 0.9, now + travel, 0.5);
      },
      release() {
        const now = ac.currentTime;
        env.gain.cancelScheduledValues(now);
        env.gain.setValueAtTime(env.gain.value, now);
        env.gain.setTargetAtTime(0.0001, now, 0.06);
      },
    };
  }

  function thud(kind) {                          // ui feedback, not musical
    const ac = audio();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(kind === 'bad' ? 90 : 320, ac.currentTime);
    g.gain.setValueAtTime(0.05, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.09);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.1);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     4. STATE
     ══════════════════════════════════════════════════════════════════════════ */

  const S = {
    notes: [], times: [], judged: [],
    running: false, t0: 0, now: 0,
    held: new Set(),          // string numbers 1-6 currently down
    sustains: new Map(),      // key → live sustain; a chord holds two at once
    stats: { perfect:0, good:0, ok:0, miss:0, streak:0, bestStreak:0,
             bends:0, bendTotal:0, showpieces:0, susHeld:0, susTotal:0, chords:0 },
    flashes: [],              // {x,y,color,at,text}
    lit: {},                  // string -> until-ms, for the bridge glow
    active: null,             // note currently ringing (for sustain/bend)
  };

  const K = {
    persp: 2.6, depth: 0.72, far: 0.20,
    lead: 1600, space: 380, len: 11,
    tier: 'gigging', genre: 'metal', style: null, arch: null,
    gemForm: 'shape', colorMode: 'both', palette: 'neon', gemSize: 1,
    showNums: true, susRate: 28, drive: 0.62, bendRate: 30, chordRate: 25,
    bendDepth: 3, bendTravel: 0.22,
  };

  /* ══════════════════════════════════════════════════════════════════════════
     5. GEOMETRY — the neck IS the highway
     ----------------------------------------------------------------------------
     z = 1 at the nut (far, small, top), z = 0 at the bridge (near, wide, bottom).
     Perspective compresses z near the nut so notes appear to accelerate as they
     come at you — but JUDGING IS LINEAR IN TIME. Only the pixels are curved.
     ══════════════════════════════════════════════════════════════════════════ */

  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.floor(r.width * DPR); cv.height = Math.floor(r.height * DPR);
    W = r.width; H = r.height;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);

  function geom() {
    const bridgeY = H * 0.845;                      // strike line — where notes land
    const nutY    = H * (0.845 - K.depth);          // vanishing end of the neck
    return {
      bridgeY, nutY,
      cx: W / 2,
      nearHalf: Math.min(W * 0.44, 430),            // half-width at the bridge
      farHalf:  Math.min(W * 0.44, 430) * K.far,    // half-width at the nut
    };
  }

  // perspective curve: 0 (bridge) → 1 (nut), compressed toward the nut
  function persp(z) {
    const k = K.persp;
    if (k <= 0.001) return z;
    return (z / (1 + k * z)) * (1 + k);
  }

  function project(z) {                             // z ∈ [0,1] → screen
    const g = geom();
    const p = persp(Math.max(0, Math.min(1, z)));
    return {
      y: g.bridgeY - (g.bridgeY - g.nutY) * p,
      half: g.nearHalf + (g.farHalf - g.nearHalf) * p,
      scale: 1 + (K.far - 1) * p,
    };
  }

  function laneX(stringIdx, half) {
    const g = geom();
    return g.cx + ((stringIdx - 2.5) / 2.5) * half;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     6. DRAW
     ══════════════════════════════════════════════════════════════════════════ */

  function glow(color, blur, fn) {
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore();
  }

  function drawNeck() {
    const g = geom();
    const nut = project(1), bridge = project(0);

    // ── the fretboard slab ────────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g.cx - bridge.half - 22, bridge.y + 26);
    ctx.lineTo(g.cx + bridge.half + 22, bridge.y + 26);
    ctx.lineTo(g.cx + nut.half + 7,     nut.y);
    ctx.lineTo(g.cx - nut.half - 7,     nut.y);
    ctx.closePath();
    const slab = ctx.createLinearGradient(0, nut.y, 0, bridge.y + 26);
    slab.addColorStop(0,   'rgba(10,23,42,0.15)');
    slab.addColorStop(0.6, 'rgba(6,17,31,0.55)');
    slab.addColorStop(1,   'rgba(3,8,16,0.9)');
    ctx.fillStyle = slab; ctx.fill();
    ctx.strokeStyle = 'rgba(25,230,255,0.22)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();

    // ── fret wires, spaced by real temperament so they bunch at the nut ────
    for (let f = 0; f <= MAX_FRET; f++) {
      const along = 1 - Math.pow(2, -f / 12);        // 0 at nut … →1 toward bridge
      const z = 1 - along / (1 - Math.pow(2, -MAX_FRET / 12));
      const p = project(z);
      const isNut = f === 0;
      ctx.save();
      ctx.strokeStyle = isNut ? 'rgba(25,230,255,0.85)' : `rgba(25,230,255,${0.06 + 0.10 * (1 - z)})`;
      ctx.lineWidth = isNut ? 2 : 1;
      if (isNut) { ctx.shadowColor = NEON.cyan; ctx.shadowBlur = 12; }
      ctx.beginPath();
      ctx.moveTo(g.cx - p.half, p.y); ctx.lineTo(g.cx + p.half, p.y);
      ctx.stroke();
      ctx.restore();

      // inlay dots
      if ([3,5,7,9].includes(f) || f === 12) {
        const pf = project(z + 0.012);
        ctx.save(); ctx.fillStyle = 'rgba(138,92,255,0.34)';
        ctx.shadowColor = NEON.violet; ctx.shadowBlur = 8;
        if (f === 12) {
          for (const o of [-0.42, 0.42]) {
            ctx.beginPath(); ctx.arc(g.cx + o * pf.half, pf.y, 3.2 * pf.scale + 1, 0, 7); ctx.fill();
          }
        } else {
          ctx.beginPath(); ctx.arc(g.cx, pf.y, 3.4 * pf.scale + 1, 0, 7); ctx.fill();
        }
        ctx.restore();
      }
    }

    // ── the six strings, converging toward the nut ────────────────────────
    for (let s = 0; s < 6; s++) {
      const x0 = laneX(s, bridge.half), x1 = laneX(s, nut.half);
      const isLit = (S.lit[s] ?? 0) > S.now;
      ctx.save();
      ctx.strokeStyle = isLit ? NEON.white : STRING_COLORS[s];
      ctx.globalAlpha  = isLit ? 1 : 0.55;
      ctx.lineWidth    = GAUGE[s] * 2.4;
      ctx.shadowColor  = isLit ? NEON.white : STRING_COLORS[s];
      ctx.shadowBlur   = isLit ? 22 : 7;
      ctx.beginPath(); ctx.moveTo(x0, bridge.y + 26); ctx.lineTo(x1, nut.y); ctx.stroke();
      ctx.restore();
    }

    // ── the bridge / strike line ──────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = NEON.magenta; ctx.lineWidth = 3;
    ctx.shadowColor = NEON.magenta; ctx.shadowBlur = 26;
    ctx.beginPath();
    ctx.moveTo(g.cx - bridge.half - 30, bridge.y);
    ctx.lineTo(g.cx + bridge.half + 30, bridge.y);
    ctx.stroke();
    ctx.restore();

    // ── string buttons at the bridge ──────────────────────────────────────
    for (let s = 0; s < 6; s++) {
      const x = laneX(s, bridge.half), y = bridge.y + 46;
      const down = S.held.has(s + 1);
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, 15, 0, 7);
      ctx.fillStyle   = down ? STRING_COLORS[s] : 'rgba(6,17,31,0.85)';
      ctx.strokeStyle = down ? NEON.white : STRING_COLORS[s];
      ctx.lineWidth   = 2;
      ctx.shadowColor = STRING_COLORS[s]; ctx.shadowBlur = down ? 22 : 8;
      ctx.fill(); ctx.stroke();
      ctx.restore();

      ctx.fillStyle = down ? '#06111f' : STRING_COLORS[s];
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(s + 1), x, y);
      ctx.fillStyle = 'rgba(160,180,205,0.6)';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(STRING_NAMES[s], x, y + 25);
    }
  }

  function drawNote(n, i) {
    const tier = TIERS[K.tier];
    const dt = S.times[i] - S.now;                 // ms until this note lands
    const z  = dt / K.lead;
    const j  = S.judged[i];

    if (z > 1.02) return;                          // not spawned yet
    if (j && j.grade !== 'sustaining' && dt < -260) return;
    if (!j && dt < -tier.ok - 130) return;

    const p = project(Math.max(0, z));
    const x = laneX(n.string, p.half);
    const size = (17 + 13 * (1 - Math.max(0, Math.min(1, z)))) * (0.5 + p.scale * 0.5) * K.gemSize;

    const col = j ? (GRADE_COLOR[j.grade] ?? STRING_COLORS[n.string]) : STRING_COLORS[n.string];
    const dead = j && (j.grade === 'miss' || j.grade === 'wrong');

    // ── sustain tail, drawn receding up the string ────────────────────────
    if (n.sustain) {
      const zEnd = (S.times[i] + n.sustain - S.now) / K.lead;
      const pe = project(Math.max(0, Math.min(1, zEnd)));
      const xe = laneX(n.string, pe.half);
      const act = [...S.sustains.values()].find(s => s.idx === i);

      ctx.save();
      ctx.globalAlpha = dead ? 0.16 : (j && j.grade === 'sustaining' ? 0.95 : 0.5);
      ctx.strokeStyle = dead ? '#555566' : col;
      ctx.lineWidth = size * 0.44;
      ctx.lineCap = 'round';
      ctx.shadowColor = col; ctx.shadowBlur = dead ? 0 : 16;

      if (n.bend) {
        // The tail physically DEFLECTS at the bend point — the same way the
        // string moves under your finger. Direction of the deflection is the
        // direction you push, so the shape tells you which arrow before you
        // read any glyph.
        const zB = (S.times[i] + n.bendAt - S.now) / K.lead;
        const pb = project(Math.max(0, Math.min(1, zB)));
        const xb = laneX(n.string, pb.half);
        // Deflection scales with weight, so you can SEE a showpiece coming and
        // brace for it — a half-step nudge barely leans, a minor third swings out.
        const wgt = BEND_WEIGHTS[n.bendWeight] ?? BEND_WEIGHTS.standard;
        const isBig = n.bendWeight === 'showpiece';
        const push = (n.bendDir === 'up' ? -1 : 1) * size * (0.45 + wgt.semis * 0.34)
                   * (act?.bent ? 1 : 0.45);
        const markCol = isBig ? NEON.magenta : NEON.orange;
        if (isBig) { ctx.strokeStyle = dead ? '#555566' : NEON.magenta; ctx.shadowColor = NEON.magenta; }
        ctx.beginPath();
        ctx.moveTo(x, p.y);
        ctx.lineTo(xb, pb.y);
        ctx.quadraticCurveTo(xb + push, (pb.y + pe.y) / 2, xe + push, pe.y);
        ctx.stroke();

        // the moment to push, marked on the tail
        if (!dead) {
          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(xb, pb.y, size * (isBig ? 0.44 : 0.34), 0, 7);
          ctx.fillStyle = act?.bent ? NEON.white : markCol;
          ctx.shadowColor = markCol; ctx.shadowBlur = isBig ? 28 : 18;
          ctx.fill();
          ctx.fillStyle = '#06111f';
          ctx.font = `bold ${Math.round(size * (isBig ? 0.52 : 0.44))}px ui-monospace, monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(n.bendDir === 'up' ? '↑' : '↓', xb, pb.y + 1);
        }
      } else {
        ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(xe, pe.y); ctx.stroke();
      }
      ctx.restore();
    }

    // ── chord link — the bar that says "these two are one press" ──────────
    if (n.hasPartner && S.notes[i + 1]) {
      const q = S.notes[i + 1];
      const xq = laneX(q.string, p.half);
      ctx.save();
      ctx.globalAlpha = dead ? 0.2 : 0.75;
      ctx.strokeStyle = NEON.white;
      ctx.lineWidth = Math.max(2, size * 0.16);
      ctx.setLineDash([size * 0.22, size * 0.22]);
      ctx.shadowColor = NEON.white; ctx.shadowBlur = dead ? 0 : 12;
      ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(xq, p.y); ctx.stroke();
      ctx.restore();
    }

    // ── colour channels ───────────────────────────────────────────────────
    // Direction and string both want colour. Whichever one loses the fill takes
    // the rim, so no encoding is ever silently dropped.
    const dirCol = DIR_PALETTES[K.palette][n.dir];
    const strCol = STRING_COLORS[n.string];
    let fillCol = col, rimCol = col;
    if (!j) {
      if (K.colorMode === 'direction')  { fillCol = dirCol; rimCol = dirCol; }
      else if (K.colorMode === 'both')  { fillCol = dirCol; rimCol = strCol; }
      else                              { fillCol = strCol; rimCol = strCol; }
    }

    ctx.save();
    ctx.globalAlpha = dead ? 0.3 : 1;
    ctx.translate(x, p.y);

    const r = size / 2;

    // ── silhouette carries the direction ──────────────────────────────────
    // This is the part that actually fixes legibility. As text glyphs, ↑ and ↓
    // differ only in which end the head sits on — a few pixels at speed. As
    // shapes they differ in overall mass and outline, which is readable
    // peripherally and at any size, and survives colourblindness entirely.
    ctx.beginPath();
    if (K.gemForm === 'glyph') {
      ctx.roundRect(-r, -r * 0.82, r * 2, r * 1.64, r * 0.42);
    } else if (n.dir === 'up') {
      ctx.moveTo(0, -r * 1.1);                     // chunky arrowhead, pointing up
      ctx.lineTo(r * 1.05, r * 0.25);
      ctx.lineTo(r * 0.42, r * 0.25);
      ctx.lineTo(r * 0.42, r * 0.95);
      ctx.lineTo(-r * 0.42, r * 0.95);
      ctx.lineTo(-r * 0.42, r * 0.25);
      ctx.lineTo(-r * 1.05, r * 0.25);
      ctx.closePath();
    } else if (n.dir === 'down') {
      ctx.moveTo(0, r * 1.1);                      // same mass, inverted
      ctx.lineTo(r * 1.05, -r * 0.25);
      ctx.lineTo(r * 0.42, -r * 0.25);
      ctx.lineTo(r * 0.42, -r * 0.95);
      ctx.lineTo(-r * 0.42, -r * 0.95);
      ctx.lineTo(-r * 0.42, -r * 0.25);
      ctx.lineTo(-r * 1.05, -r * 0.25);
      ctx.closePath();
    } else {
      // "same" is a wide flat bar — no vertical intent at all, which is exactly
      // what it means. Reads instantly as "not moving" next to the two spikes,
      // and a chug run of them draws one continuous ladder down the string.
      ctx.roundRect(-r * 1.05, -r * 0.38, r * 2.1, r * 0.76, r * 0.3);
    }

    ctx.fillStyle   = dead ? 'rgba(40,44,56,0.6)' : `${fillCol}44`;
    ctx.strokeStyle = dead ? '#555566' : rimCol;
    ctx.lineWidth   = 2.4;
    ctx.shadowColor = fillCol; ctx.shadowBlur = dead ? 0 : (n.feel === 'rushed' ? 26 : 15);
    ctx.fill(); ctx.stroke();

    // ── bendable halo ─────────────────────────────────────────────────────
    // Shape belongs to direction, so a bendable note takes a ring instead —
    // early warning that a gesture is coming, before the tail's marker arrives.
    if (n.bend && !dead) {
      ctx.beginPath(); ctx.arc(0, 0, r * 1.34, 0, 7);
      ctx.strokeStyle = NEON.orange; ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      ctx.shadowColor = NEON.orange; ctx.shadowBlur = 12;
      ctx.stroke(); ctx.setLineDash([]);
    }

    // ── what you actually press ───────────────────────────────────────────
    // The number IS the input now, so at the teaching tiers it prints right on
    // the gem. Higher tiers drop it and you read the lane instead — the same
    // labels-on → labels-off ladder R2 already uses for note names.
    if (TIERS[K.tier].showNums !== false && K.showNums) {
      ctx.shadowBlur = dead ? 0 : 10;
      ctx.fillStyle  = dead ? '#666' : NEON.white;
      ctx.shadowColor = NEON.white;
      ctx.font = `bold ${Math.round(size * 0.62)}px ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const dy = n.dir === 'up' ? size * 0.20 : n.dir === 'down' ? -size * 0.20 : size * 0.02;
      ctx.fillText(String(n.string + 1), 0, dy);
    } else if (K.gemForm !== 'shape') {
      ctx.shadowBlur = dead ? 0 : 10;
      ctx.fillStyle  = dead ? '#666' : NEON.white;
      ctx.font = `bold ${Math.round(size * (K.gemForm === 'glyph' ? 0.86 : 0.6))}px ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(DIR_GLYPH[n.dir], 0, size * 0.04);
    }
    ctx.restore();
  }

  function drawFlashes() {
    S.flashes = S.flashes.filter(f => S.now - f.at < 620);
    for (const f of S.flashes) {
      const age = (S.now - f.at) / 620;
      ctx.save();
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color; ctx.shadowBlur = 16;
      ctx.font = `bold ${Math.round(15 + 7 * (1 - age))}px ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.text, f.x, f.y - age * 46);
      ctx.restore();
    }
  }

  function drawHUD() {
    const st = S.stats;
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';

    ctx.fillStyle = 'rgba(25,230,255,0.5)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(TIERS[K.tier].label, 18, 16);

    if (st.streak > 1) {
      ctx.fillStyle = NEON.orange;
      ctx.shadowColor = NEON.orange; ctx.shadowBlur = 14;
      ctx.font = 'bold 26px ui-monospace, monospace';
      ctx.fillText(`${st.streak}×`, 18, 32);
    }

    // sustain meter — the one thing you hold, so it deserves its own readout
    const a = S.active;
    if (a && S.notes[a.idx]?.sustain && S.judged[a.idx]?.grade === 'sustaining') {
      const n = S.notes[a.idx];
      const prog = Math.max(0, Math.min(1, (S.now - S.times[a.idx]) / n.sustain));
      const bw = 190, bx = 20, by = H - 34;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(25,230,255,0.14)';
      ctx.fillRect(bx, by, bw, 7);
      ctx.fillStyle = S.held.has(a.key) ? NEON.cyan : NEON.magenta;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
      ctx.fillRect(bx, by, bw * prog, 7);
      ctx.shadowBlur = 0;
      ctx.fillStyle = S.held.has(a.key) ? 'rgba(25,230,255,0.8)' : NEON.magenta;
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textBaseline = 'bottom';
      ctx.fillText(S.held.has(a.key) ? `HOLD ${a.key}` : `RELEASED — HOLD ${a.key}`, bx, by - 4);
    }
    ctx.restore();

    if (!S.running) {
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(25,230,255,0.75)';
      ctx.shadowColor = NEON.cyan; ctx.shadowBlur = 18;
      ctx.font = 'bold 15px ui-monospace, monospace';
      ctx.fillText('HIT THE STRING NUMBER AS IT LANDS', W / 2, H * 0.30);
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(255,45,149,0.7)';
      ctx.shadowColor = NEON.magenta;
      ctx.fillText('press  ▶ RUN THE RIFF', W / 2, H * 0.30 + 26);
      ctx.restore();
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    S.now = performance.now() - S.t0;

    ctx.clearRect(0, 0, W, H);

    // deep background wash
    const bg = ctx.createRadialGradient(W/2, H*0.85, 40, W/2, H*0.85, Math.max(W,H)*0.85);
    bg.addColorStop(0, 'rgba(18,35,61,0.55)');
    bg.addColorStop(1, 'rgba(3,8,16,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    drawNeck();

    if (S.running) {
      // far notes first so near ones overlap correctly
      const order = S.notes.map((n, i) => i).sort((a, b) => S.times[b] - S.times[a]);
      for (const i of order) drawNote(S.notes[i], i);
      tickMisses();
      tickSustains();
    }

    drawFlashes();
    drawHUD();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     7. JUDGING — linear in time, regardless of what perspective does to pixels
     ══════════════════════════════════════════════════════════════════════════ */

  function flashAt(i, grade, text) {
    const n = S.notes[i];
    const p = project(0);
    S.flashes.push({
      x: laneX(n.string, p.half), y: p.y - 34,
      color: GRADE_COLOR[grade] ?? NEON.white,
      at: S.now, text,
    });
  }

  function gradeFor(absDt) {
    const t = TIERS[K.tier];
    const tighten = 1;
    if (absDt <= t.perfect * tighten) return 'perfect';
    if (absDt <= t.good * tighten)    return 'good';
    if (absDt <= t.ok * tighten)      return 'ok';
    return null;
  }

  /**
   * ONE KEY. The player presses the string number as the gem crosses the bridge.
   *
   * The arrows are still drawn — they are just no longer something the hands have
   * to execute. Contour became notation you READ instead of a second key you
   * CHORD. That is the whole simplification: the melody stays visible, the
   * ergonomics collapse to one hand on the number row.
   */
  function strike(stringNum) {
    if (!S.running) return;
    const t = TIERS[K.tier];

    // Nearest unjudged note inside the reachable window. Prefer a note actually
    // on the pressed string — otherwise a correct press near a wrong-string note
    // would eat the wrong gem and read as a bug.
    let idx = -1, bestDt = Infinity;
    let anyIdx = -1, anyDt = Infinity;
    for (let i = 0; i < S.notes.length; i++) {
      if (S.judged[i]) continue;
      const dt = Math.abs(S.times[i] - S.now);
      if (dt > t.ok) continue;
      if (dt < anyDt) { anyDt = dt; anyIdx = i; }
      if (S.notes[i].string + 1 === stringNum && dt < bestDt) { bestDt = dt; idx = i; }
    }

    if (idx < 0) {
      if (anyIdx < 0) { thud('bad'); return; }     // nothing reachable — silent whiff
      S.judged[anyIdx] = { grade: 'wrong' };
      S.stats.miss++; S.stats.streak = 0;
      flashAt(anyIdx, 'wrong', 'WRONG STRING');
      thud('bad');
      updateStats();
      return;
    }

    const n = S.notes[idx];
    const grade = gradeFor(bestDt) ?? 'ok';
    S.judged[idx] = { grade: n.sustain ? 'sustaining' : grade, base: grade, at: S.now };
    S.stats[grade]++;
    S.stats.streak++;
    S.stats.bestStreak = Math.max(S.stats.bestStreak, S.stats.streak);
    S.lit[n.string] = S.now + 220;

    // A chord's two notes are judged independently — but if both land inside the
    // good window we say so, because "I nailed the chord" is the thing the player
    // actually feels. No bonus scoring; it is a readout, not a payout.
    const partnerIdx = n.hasPartner ? idx + 1 : (n.partnerOf != null ? n.partnerOf : -1);
    const partnerHit = partnerIdx >= 0 && S.judged[partnerIdx] &&
                       ['perfect','good','ok','sustaining'].includes(S.judged[partnerIdx].grade);
    if (partnerHit) { S.stats.chords++; flashAt(idx, grade, 'CHORD'); }
    else flashAt(idx, grade, grade.toUpperCase());

    // The partner note doubles the fifth already, so don't stack another one.
    const handle = pluck(freqOf(n), undefined, n.sustain ? n.sustain / 1000 + 0.7 : 0.6, {
      palm: !!n.chugPart && !n.sustain,            // chug runs are palm-muted
      fifth: !!n.accent && partnerIdx < 0,         // accents ring as power chords
      gain: grade === 'perfect' ? 0.58 : 0.5,
    });

    const act = { idx, key: stringNum, bent: false, handle,
                  until: n.sustain ? S.times[idx] + n.sustain : S.now + 420 };
    if (n.sustain) {
      S.stats.susTotal++;
      if (n.bend) S.stats.bendTotal++;
      // Track sustains per key so a chord can hold BOTH notes at once.
      S.sustains.set(stringNum, act);
    }
    S.active = act;
    updateStats();
  }

  function tickMisses() {
    const t = TIERS[K.tier];
    for (let i = 0; i < S.notes.length; i++) {
      if (S.judged[i]) continue;
      if (S.now - S.times[i] > t.ok) {
        S.judged[i] = { grade: 'miss' };
        S.stats.miss++; S.stats.streak = 0;
        flashAt(i, 'miss', 'MISS');
        updateStats();
      }
    }
    // run over?
    if (S.notes.length && S.judged.filter(Boolean).length === S.notes.length) {
      const last = S.times[S.notes.length - 1] + (S.notes[S.notes.length - 1].sustain || 0);
      if (S.now > last + 900) { S.running = false; showVerdict(); }
    }
  }

  // Every ringing sustain ticks — a chord holds two at once, so this can't be a
  // single "active note" any more.
  function tickSustains() {
    for (const [key, a] of [...S.sustains]) {
      const n = S.notes[a.idx];
      const j = S.judged[a.idx];
      if (!n?.sustain || !j || j.grade !== 'sustaining') { S.sustains.delete(key); continue; }

      const holding = S.held.has(a.key);
      if (holding) S.lit[n.string] = S.now + 90;

      // an unbent bend that runs out of tail is a missed gesture
      if (n.bend && !a.bent && S.now > S.times[a.idx] + n.bendAt + TIERS[K.tier].ok) {
        a.bendMissed = true;
      }

      if (S.now >= a.until) {                      // completed the tail
        j.grade = j.base;
        S.stats.susHeld++;
        flashAt(a.idx, j.base, a.bendMissed ? 'NO BEND' : 'HELD');
        a.handle?.release();
        S.sustains.delete(key);
        if (S.active === a) S.active = null;
        updateStats();
      } else if (!holding) {                       // dropped it early
        const got = (S.now - S.times[a.idx]) / n.sustain;
        j.grade = got > 0.65 ? j.base : 'ok';
        if (got > 0.65) S.stats.susHeld++;
        flashAt(a.idx, j.grade, got > 0.65 ? 'HELD' : 'DROPPED');
        a.handle?.release();
        S.sustains.delete(key);
        if (S.active === a) S.active = null;
        updateStats();
      }
    }
  }

  /**
   * BEND — push ↑ or ↓ while a bendable note is ringing and its number is held.
   * Judged against the moment marked on the tail, not just "any time during".
   */
  function bend(dir) {
    if (!S.running) return;

    // find a ringing, still-held, bendable, not-yet-bent sustain
    let best = null, bestDt = Infinity;
    for (const a of S.sustains.values()) {
      const n = S.notes[a.idx];
      if (!n?.bend || a.bent || !S.held.has(a.key)) continue;
      const dt = Math.abs(S.now - (S.times[a.idx] + n.bendAt));
      if (dt < bestDt) { bestDt = dt; best = a; }
    }
    if (!best) { thud('bad'); return; }

    const n = S.notes[best.idx];
    const win = TIERS[K.tier].ok;
    if (bestDt > win) { thud('bad'); return; }     // too early or too late — no penalty, just nothing

    if (n.bendDir !== dir) {                       // bent the wrong way
      best.bent = true; best.bendMissed = true;
      S.stats.streak = 0;
      flashAt(best.idx, 'wrong', 'WRONG WAY');
      thud('bad');
      updateStats();
      return;
    }

    best.bent = true;
    S.stats.bends++;
    if (n.bendWeight === 'showpiece') S.stats.showpieces++;
    const semis = n.bendAmt * (dir === 'down' ? -1 : 1);
    best.handle?.bendTo(semis, n.bendWeight);
    const w = BEND_WEIGHTS[n.bendWeight];
    flashAt(best.idx, bestDt <= TIERS[K.tier].good ? 'perfect' : 'good',
            w?.label || (dir === 'up' ? `BEND ↑${n.bendAmt}` : `BEND ↓${n.bendAmt}`));
    updateStats();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     8. INPUT
     ══════════════════════════════════════════════════════════════════════════ */

  const KEYDOWN = (e) => {
    if (e.repeat) { if (e.key.startsWith('Arrow')) e.preventDefault(); return; }
    if (e.key >= '1' && e.key <= '6') {
      S.held.add(+e.key);
      strike(+e.key);                   // press IS the strike — one key, one hand
      e.preventDefault(); return;
    }
    if (e.key === 'ArrowUp')   { bend('up');   e.preventDefault(); return; }
    if (e.key === 'ArrowDown') { bend('down'); e.preventDefault(); return; }
    if (e.key === 'Enter')     { start(); e.preventDefault(); }
  };

  const KEYUP = (e) => {
    if (e.key >= '1' && e.key <= '6') S.held.delete(+e.key);
  };

  window.addEventListener('keydown', KEYDOWN);
  window.addEventListener('keyup', KEYUP);

  /* ══════════════════════════════════════════════════════════════════════════
     9. HOST INTERFACE
     ---------------------------------------------------------------------------
     The prototype page bound knobs to DOM inputs here. React owns that now, so
     the knobs are just K — mutate it and the next frame picks it up. Readouts
     that used to write innerHTML are pushed out through callbacks instead.
     ══════════════════════════════════════════════════════════════════════════ */

  /** Fired after every judgment with the live run stats. */
  let onStats = () => {};
  /** Fired when a new riff is built, with what it's made of. */
  let onRiff = () => {};
  /** Fired when a run finishes, with the clean %. */
  let onVerdict = () => {};

  function updateStats() { onStats({ ...S.stats }); }

  function readabilityNote() {
    const bits = [];
    if (K.colorMode === 'direction')
      bits.push('String identity is now carried by lane position alone — check it still reads at the nut end, where the lanes crowd.');
    if (K.palette === 'rgb')
      bits.push('Green/red is the pairing red-green colorblind players cannot separate (~8% of men). Shape still carries direction, so it degrades rather than breaks — unless gem form is GLYPH only.');
    if (K.palette === 'rgb' && K.gemForm === 'glyph' && K.colorMode !== 'string')
      bits.push('⚠ This combination encodes direction in colour ONLY. A red-green colorblind player cannot play it.');
    return bits.length ? bits : ['Direction is in the silhouette, so it survives any colour setting. This is the safe default.'];
  }

  function newRiff() {
    seed = (Math.random() * 4294967296) >>> 0;
    // honour a forced archetype by threading it through the generator
    const forced = K.arch;
    const origRand = rand;
    S.notes = (function () {
      const built = generateArchetypeRiff({
        genre: K.genre, style: K.style, len: Math.round(K.len),
        rand: origRand, archetype: forced,
      });
      LAST_BUILD = built;
      // Riffs live LOW — median generated offset is +2 semitones from the root.
      // Left at a single low register the high e and B strings never sound and
      // the highway runs with two dead lanes (the exact defect GUITAR_NECK_HANDOFF
      // §1 recorded against the old first-position display). So the riff gets a
      // per-riff register: usually low, sometimes lifted an octave the way a
      // lead-register riff sits up the neck.
      const REGISTER = 7 + (rand() < 0.28 ? 12 : 0);
      const notes = built.notes.map(n => ({
        pitch: n.semi + REGISTER, feel: n.feel, sustain: n.sustain, bend: n.bend,
        accent: n.accent, outOfScale: n.outOfScale, gapBefore: n.gapBefore,
      }));
      voiceOntoNeck(notes);
      notes.forEach((n, i) => {
        n.dir = i === 0 ? 'same'
              : n.pitch > notes[i-1].pitch ? 'up'
              : n.pitch < notes[i-1].pitch ? 'down' : 'same';
        n.chugPart = i > 0 && n.pitch === notes[i-1].pitch;
      });
      applySustainRate(notes);
      return notes;
    })();
    S.times = buildTimeline(S.notes, K.lead, K.space);
    applyChords(S.notes, S.times);                 // after timing — partners share the beat
    S.judged = new Array(S.notes.length).fill(null);
    S.active = null;
    describeRiff();
  }

  function describeRiff() {
    const b = LAST_BUILD;
    const a = analyseArrows(S.notes.map(n => ({ semi: n.pitch })));
    onRiff({
      archetype: (b?.archetype ?? '—').replace('_', ' ').toUpperCase(),
      scaleName: b?.scaleName ?? '', form: b?.form ?? '',
      genre: b?.genre, style: b?.style,
      count: S.notes.length,
      up: a.counts.up, down: a.counts.down, same: a.counts.same,
      samePct: a.samePct, longestRun: a.longestDirNoteRun,
      clustered: a.sameClustered, scattered: Math.max(0, a.sameScattered),
      sustains: S.notes.filter(n => n.sustain).length,
      bends:    S.notes.filter(n => n.bend).length,
      chords:   S.notes.filter(n => n.hasPartner).length,
      outOfScale: S.notes.filter(n => n.outOfScale).length,
      showpieces: S.notes.filter(n => n.bendWeight === 'showpiece').length,
    });
  }

  function start() {
    audio(); getAmp(); setDrive(K.drive);
    if (!S.notes.length) newRiff();
    S.times = buildTimeline(S.notes, K.lead, K.space);
    S.judged = new Array(S.notes.length).fill(null);
    S.stats = { perfect:0, good:0, ok:0, miss:0, streak:0, bestStreak:0,
                bends:0, bendTotal:0, showpieces:0, susHeld:0, susTotal:0, chords:0 };
    S.flashes = []; S.lit = {}; S.active = null; S.sustains.clear();
    S.t0 = performance.now(); S.now = 0;
    S.running = true;
    updateStats();
  }

  function replay() {                            // hear the riff through the amp
    const amp = getAmp();
    setDrive(K.drive);
    const t0 = amp.ac.currentTime + 0.15;
    S.notes.forEach((n, i) => {
      const at = t0 + (S.times[i] - S.times[0]) / 1000;
      pluck(freqOf(n), at, n.sustain ? n.sustain / 1000 + 0.5 : 0.5, {
        // Replay performs the SAME bend the chart asks you for — same direction,
        // same depth, same moment in the tail.
        bend: n.bend, bendAmt: n.bendAmt, bendDir: n.bendDir,
        bendAt: n.bendAt / 1000, bendWeight: n.bendWeight,
        palm: !!n.chugPart && !n.sustain, fifth: !!n.accent, gain: 0.42,
      });
    });
  }

  function showVerdict() {
    const st = S.stats;
    const total = st.perfect + st.good + st.ok + st.miss;
    const score = total ? Math.round(((st.perfect * 1 + st.good * 0.7 + st.ok * 0.4) / total) * 100) : 0;
    onVerdict({ score, ...st });
  }

  // roundRect polyfill for older engines
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      this.moveTo(x + r, y);
      this.arcTo(x + w, y,     x + w, y + h, r);
      this.arcTo(x + w, y + h, x,     y + h, r);
      this.arcTo(x,     y + h, x,     y,     r);
      this.arcTo(x,     y,     x + w, y,     r);
      this.closePath();
      return this;
    };
  }

  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => resize()) : null;
  ro?.observe(cv.parentElement ?? cv);
  window.addEventListener('resize', resize);

  resize();
  newRiff();
  let RAF = requestAnimationFrame(frame);

  return {
    K, S,
    start, newRiff, replay,
    readabilityNote,
    setDrive: (v) => { K.drive = v; if (actx) setDrive(v); },
    set onStats(fn)   { onStats = fn; },
    set onRiff(fn)    { onRiff = fn; },
    set onVerdict(fn) { onVerdict = fn; },
    isRunning: () => S.running,
    destroy() {
      cancelAnimationFrame(RAF);
      RAF = 0;
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', KEYDOWN);
      window.removeEventListener('keyup', KEYUP);
      try { actx?.close(); } catch { /* already gone */ }
      actx = null; AMP = null;
    },
  };
}
