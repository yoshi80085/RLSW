// =============================================================================
// audio/commitStyles.js — 🎸 HOW EACH SPIRIT PLAYS A COMMITTED TRACK
// -----------------------------------------------------------------------------
// Alex, 2026-09-28: *"instead of just 1 distinctive 'sound' per Spirit, I wonder
// if they can have several — say 3 or so — So Ronin shreds and plays in a few
// different ways perhaps — so it's not sounding the 'same' all the time."*
//
// So every signature Spirit owns THREE builds. The first of each is the one the
// monolith always had (moved here verbatim, phrasing unchanged); the other two
// are new. The Ronin's two new ones are played on a SHAMISEN
// (`audio/shamisen.js`) — one clean in the Tsugaru style, one through the amp.
//
// WHICH ONE PLAYS is `pickCommitStyle`: deterministic from the seat and the
// ROUND, so (a) every client in an online match hears the same build, (b) one
// seat never hears the same build twice in a row — a seat's own turns are one
// round apart, and three rounds walk its whole set — and (c) two seats of the
// same Spirit start at different points of it.
//
// PRESENTATION ONLY. `rand` is audio flavour (humanised timing, which note a
// variation mutates) and is never a rule; nothing here touches the engine.
//
// The module is PURE of the app: the caller hands in an `api` —
//   now()                         audio-clock seconds (ctx.currentTime)
//   note(name, opts)              play one note (the monolith's playNoteSound)
//   lead(name, prevFreq)          voice-led frequency (the monolith's voiceLeadFreq)
//   pitchIndex(name)              pitch class 0–11
//   scratch(name, hz, pattern, when)  one vinyl scratch (playScratchAtom)
//   rand()                        optional, defaults to Math.random
// — so the tone bench can play every build without the 16k-line client.
// =============================================================================

/** Each Spirit's three builds, signature first. */
export const COMMIT_STYLE_SETS = Object.freeze({
  cosmic_ronin:      Object.freeze(['shred', 'tsugaru', 'iai']),
  Metalness_Monster: Object.freeze(['breakdown', 'tremolo', 'doom']),
  intergalactic_0:   Object.freeze(['scratch', 'arp', 'laser']),
  Glamarchy:         Object.freeze(['strut', 'ballad', 'disco']),
});

/** Per build: a name for the log / bench, and the knob overrides it plays
 *  through (null = the seat's own rig, whatever the player dialled). */
export const COMMIT_STYLES = Object.freeze({
  shred:     { label: 'Shred',        blurb: 'lightning passes and a climbing run to a bent money note' },
  tsugaru:   { label: 'Tsugaru',      blurb: 'clean shamisen — a struck drone, tete-TON runs, a buzzing slide home',
               knobs: { voice: 'shamisen', drive: 0.1, tone: 0.62, echo: 0.16, verb: 0.32 } },
  iai:       { label: 'Iai',          blurb: 'distorted shamisen — a held breath, one sweeping cut, the strike',
               knobs: { voice: 'shamisen_dist' } },
  breakdown: { label: 'Breakdown',    blurb: 'chug gallops, slam clusters, a power-chord SLAM' },
  tremolo:   { label: 'Tremolo',      blurb: 'black-metal tremolo picking over low chugs' },
  doom:      { label: 'Doom',         blurb: 'slow crushing power chords and a diving feedback swell' },
  scratch:   { label: 'Scratch',      blurb: '80s DJ vinyl scratching into a sub drop' },
  arp:       { label: 'Arpeggiator',  blurb: 'synthwave arpeggios, then an octave up, into a swelling chord' },
  laser:     { label: 'Laser',        blurb: 'echoing laser zaps and a rising orbit',
               knobs: { echo: 0.82, verb: 0.34 } },
  strut:     { label: 'Strut',        blurb: 'stomp-stomp-CLAP swagger and a glitter gliss' },
  ballad:    { label: 'Power Ballad', blurb: 'big broken chords and a truck-driver key change',
               knobs: { verb: 0.72, echo: 0.45 } },
  disco:     { label: 'Disco',        blurb: 'octave-bass hustle, string stabs, a rising whoop' },
});

// The six orders of [0,1,2]; a seat's hash picks one, the round walks it.
const ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
function hashStr(s = '') {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/**
 * Which build this seat plays this round. null for a Spirit with no set (the
 * caller falls back to the classic groove).
 * @param {string} characterId  e.g. 'cosmic_ronin'
 * @param {{seatId?:string, round?:number}} at
 */
export function pickCommitStyle(characterId, { seatId = '', round = 0 } = {}) {
  const set = COMMIT_STYLE_SETS[characterId];
  if (!set) return null;
  const order = ORDERS[hashStr(seatId || characterId) % ORDERS.length];
  const r = Math.max(0, Math.floor(Number.isFinite(round) ? round : 0));
  return set[order[r % 3]];
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const SEMI = Math.pow(2, 1 / 12);

// ═════════════════════════════════════════════════════════════════════════════
// 🎭 THE SIGNATURE LAYER — the stings' recipe, on every committed track
// ═════════════════════════════════════════════════════════════════════════════
// Alex, 2026-09-28, on the Spirit-select stings (`audio/spiritSting.js`): *"I love
// how they combined different sounds together - I'd like to make this the
// standard benchmark for how sounds are committed in game as well."* His pick:
// ONE shared layer over all twelve builds, not twelve rewrites.
//
// So whatever build plays, the Spirit's layer rides on top of it:
//   open   — a character noise as the track starts (the blade, the laser…)
//   land   — a character noise under the MONEY NOTE (the slam, the sub drop…)
//   double — the money note (and, for the Ronin, the downbeat) played AGAIN on a
//            second voice: the stings' "two instruments at once".
// The MONEY NOTE is read off what the build actually played — the longest hold,
// then the latest, then the loudest — so a build rewritten tomorrow still gets
// its layer in the right place, with no second copy of its timing here.
//
// ⚠️ THE NOISES NEED `api.fx(kind, when, level)` (the game and the bench pass
// `playSpiritFx`). An api without it gets the doubled voice only — the tone
// bench's old api and `commitStylesCheck`'s budget api stay valid.
// ⚠️ The layer adds NO onset after the build's own last note, so the ~3 s turn
// budget `commitStylesCheck` §3 measures is untouched; the noises only ring on.
// 📌 Noise levels are the stings' own × Alex's sting `fx` dial-in (1.42), copied
// once on purpose — a commit plays over the game, not over the menu song, so
// the two are expected to be dialled apart. `COMMIT_LAYER` is the shared lever.
export const COMMIT_LAYER = Object.freeze({ voice: 1.0, fx: 1.0 });

const SHAMI_KNOBS = Object.freeze({ voice: 'shamisen', drive: 0.1, tone: 0.62, echo: 0.16, verb: 0.32 });   // = `tsugaru`
export const COMMIT_LAYERS = Object.freeze({
  // 🗡️ The blade is drawn as he starts; the shamisen strikes his first and last
  // notes an octave under the KATANA. On a SHAMISEN build it flips: the KATANA
  // sings the money note over the string, bent a whole step in.
  cosmic_ronin: Object.freeze({
    open: [{ kind: 'sheath', level: 0.23 }], land: [],
    double: { knobs: SHAMI_KNOBS, semis: -12, vol: 0.95, on: ['first', 'money'] },
    doubleOnPluck: { knobs: { voice: 'ronin' }, semis: 0, vol: 0.75, bend: -2, bendTime: 0.22, on: ['money'] },
  }),
  // 👹 The cabinet slams under his last hit; a second, cleaner guitar doubles it an octave up.
  Metalness_Monster: Object.freeze({
    open: [], land: [{ kind: 'slam', level: 0.7 }],
    double: { knobs: { voice: 'saw', drive: 0.7 }, semis: 12, vol: 0.45, on: ['money'] },
  }),
  // 🌀 A laser to launch; the last note swoops up a fifth an octave higher on a
  // clean sine, echoing out, over a sub drop.
  intergalactic_0: Object.freeze({
    open: [{ kind: 'laser', level: 0.14 }], land: [{ kind: 'drop', level: 0.5 }],
    double: { knobs: { voice: 'sine', echo: 0.82, verb: 0.4 }, semis: 12, vol: 0.5, bend: -7, bendTime: 0.34, on: ['money'] },
  }),
  // 🎀 A clap to open, glitter on the last note, a bell-ish triangle an octave up.
  Glamarchy: Object.freeze({
    open: [{ kind: 'clap', level: 0.23 }], land: [{ kind: 'glitter', level: 0.07 }],
    double: { knobs: { voice: 'triangle' }, semis: 12, vol: 0.5, on: ['money'] },
  }),
});
const PLUCKED = new Set(['shamisen', 'shamisen_dist']);
/** Which Spirit's set a build belongs to. */
const SPIRIT_OF = Object.fromEntries(Object.entries(COMMIT_STYLE_SETS).flatMap(([id, set]) => set.map(s => [s, id])));

/** The build's downbeat and money note, read off what it played. */
export function layerAnchors(played) {
  const timed = played.filter(p => Number.isFinite(p.o?.when));
  if (!timed.length) return null;
  const hold = p => p.o.holdTime ?? 0, vol = p => p.o.volume ?? 0;
  const money = timed.reduce((a, b) => (hold(b) > hold(a) || (hold(b) === hold(a) && (b.o.when > a.o.when
    || (b.o.when === a.o.when && vol(b) > vol(a))))) ? b : a);
  const first = timed.reduce((a, b) => (b.o.when < a.o.when || (b.o.when === a.o.when && vol(b) > vol(a))) ? b : a);
  return { first, money };
}

function applyLayer(style, played, t0, api, mode, lv = COMMIT_LAYER) {
  const L = COMMIT_LAYERS[SPIRIT_OF[style]];
  const anchors = L && layerAnchors(played);
  if (!anchors) return;
  const D = PLUCKED.has(COMMIT_STYLES[style]?.knobs?.voice) && L.doubleOnPluck ? L.doubleOnPluck : L.double;
  if (D) for (const which of D.on) {
    const p = anchors[which];
    if (which === 'first' && p === anchors.money) continue;   // one note, one double
    const f = p.o.freq ?? api.lead?.(p.note, null);
    if (!f) continue;
    api.note(p.note, {
      when: p.o.when, holdTime: p.o.holdTime, fadeTime: p.o.fadeTime,
      volume: (p.o.volume ?? 0.16) * D.vol * lv.voice,
      freq: f * Math.pow(2, D.semis / 12), knobs: D.knobs,
      ...(D.bend ? { bend: D.bend, bendTime: D.bendTime } : {}),
    });
  }
  if (mode === 'voice' || typeof api.fx !== 'function') return;
  for (const n of L.open) api.fx(n.kind, t0, n.level * lv.fx);
  for (const n of L.land) api.fx(n.kind, anchors.money.o.when, n.level * lv.fx);
}

/**
 * Play `track` as `style`. Returns false for an unknown style (the caller
 * plays its default instead).
 * @param {{layer?: boolean|'voice', levels?: {voice:number, fx:number}}} [opts]
 *   the signature layer: on (default), 'voice' (the double only — the seat-unlock
 *   moment, which has its own boom), or false (the bench's A/B). `levels`
 *   overrides COMMIT_LAYER (the bench's sliders).
 */
export function playCommitStyle(style, track, api, { layer = true, levels = COMMIT_LAYER } = {}) {
  const fn = BUILDS[style];
  if (!fn || !track?.length || !api) return false;
  const knobs = COMMIT_STYLES[style]?.knobs ?? null;
  const t0 = api.now() + 0.06;                         // audio-clock anchor
  const played = [];
  const x = {
    at: ms => t0 + ms / 1000,
    play: (note, o) => { played.push({ note, o: o ?? {} }); return api.note(note, knobs ? { ...o, knobs } : o); },
    lead: api.lead,
    pitchIndex: api.pitchIndex,
    scratch: api.scratch ?? (() => {}),
    rand: api.rand ?? Math.random,
  };
  fn(track, x);
  if (layer) applyLayer(style, played, t0, api, layer, levels);
  return true;
}

// ═════════════════════════════════════════════════════════════════════════════
// 🗡️ SHREDDING RONIN
// ═════════════════════════════════════════════════════════════════════════════

// SHRED — he doesn't play the committed track, he SHREDS it. Same notes, ripped
// as 2–3 lightning passes: the statement, a mutated variation, and (4+ note
// tracks) an accelerating ascending run capped by the money note. Scheduling is
// budgeted to ≈2.5s so turn pacing matches the normal groove. His amp voice is
// the KATANA (`audio/ampVoice.js` RONIN_LEAD); this only changes the PHRASING.
// 🎌 Both ringing endings BEND UP A WHOLE STEP into the final note (2026-09-16)
// — the pushed-string cry of a koto or a shakuhachi's rising breath, played
// on a distorted guitar. `RONIN_MONEY_BEND` is the lever.
function shred(track, x) {
  const RONIN_MONEY_BEND = -2;                       // semitones below; bends up into pitch
  const n = track.length;
  const jitter = () => (x.rand() - 0.5) * 18;        // human, not quantised
  let tMs = 60;

  // Spacing shrinks as the track grows so all passes always fit the budget.
  const sp1 = Math.max(58, Math.min(105, Math.round(640 / n)));

  // ── PASS 1 — the statement: the track in order, brutally fast ──
  let prev = null;
  track.forEach((note, i) => {
    const f = x.lead(note, prev); if (f) prev = f;
    x.play(note, {
      holdTime: 0.12, fadeTime: 0.08,
      volume: i % 2 === 0 ? 0.16 : 0.13,             // alternate-picked accents
      freq: f ?? undefined,
      when: x.at(tMs + jitter()),
    });
    tMs += sp1;
  });
  tMs += 120;                                        // breath

  // ── PASS 2 — the variation: ONE mutation, dealt fresh every commit ──
  const varTrack = [...track];
  const roll = x.rand();
  let octIdx = -1;
  if (roll < 0.34 && n >= 2) {                       // swap two adjacent notes
    const k = Math.floor(x.rand() * (n - 1));
    [varTrack[k], varTrack[k + 1]] = [varTrack[k + 1], varTrack[k]];
  } else if (roll < 0.67) {                          // stutter-double one note
    const k = Math.floor(x.rand() * n);
    varTrack.splice(k, 0, varTrack[k]);
  } else {                                           // one note leaps an octave
    octIdx = Math.floor(x.rand() * n);
  }
  const sp2 = Math.max(50, Math.round(sp1 * 0.85));  // a hair faster — he's warm now
  prev = null;
  varTrack.forEach((note, i) => {
    let f = x.lead(note, prev); if (f) prev = f;
    if (i === octIdx && f) f *= 2;
    x.play(note, {
      holdTime: 0.11, fadeTime: 0.08,
      volume: i % 2 === 0 ? 0.17 : 0.14,
      freq: f ?? undefined,
      when: x.at(tMs + jitter()),
    });
    tMs += sp2;
  });

  // Short tracks stop here — two fast passes IS the shred…
  if (n < 4) {
    const last = track[n - 1];                       // …but the ending still rings.
    x.play(last, {
      holdTime: 1.0, fadeTime: 0.9, volume: 0.19,
      bend: RONIN_MONEY_BEND,
      when: x.at(tMs + 90),
    });
    return;
  }
  tMs += 130;                                        // gather for the climax

  // ── PASS 3 — the climax: ascending run, accelerating, then the money note ──
  const run = [...track].sort((a, b) => x.pitchIndex(a) - x.pitchIndex(b));
  prev = null;
  run.forEach((note, i) => {
    let f = x.lead(note, prev);
    // Force the climb (duplicate pitches would voice-lead flat), but cap it
    // below screech territory.
    if (f && prev && f <= prev && f < 900) f *= 2;
    if (f) prev = f;
    const sp = Math.round(90 - (35 * i) / Math.max(1, run.length - 1)); // 90→55ms accelerando
    x.play(note, {
      holdTime: 0.10, fadeTime: 0.07,
      volume: 0.14 + (0.05 * i) / run.length,        // swelling into the peak
      freq: f ?? undefined,
      when: x.at(tMs + jitter()),
    });
    tMs += sp;
  });
  // 🎸 The money note — the track's real final note, octave up, ringing long.
  const last = track[n - 1];
  const lastF = x.lead(last, prev);
  x.play(last, {
    holdTime: 1.1, fadeTime: 1.0, volume: 0.2,
    freq: lastF ? lastF * 2 : undefined,
    bend: RONIN_MONEY_BEND,
    when: x.at(tMs + 40),
  });
}

// TSUGARU — 🪕 clean shamisen, in the fast percussive Tsugaru-jamisen manner.
// The bachi strikes the OPEN DRONE first (the track's first note an octave
// down, string and skin in one blow); the track follows in the tete-TON rhythm
// (short, short, LONG), each long note SLIDING in from a half-step below
// (`suri`); then the TATAKI shake — note and drone struck alternately, flat out —
// and the last note slides a whole step home over the re-struck drone, left to
// buzz on the sawari.
function tsugaru(track, x) {
  const n = track.length;
  const unit = clamp(Math.round(620 / n), 70, 115);
  const jitter = () => (x.rand() - 0.5) * 10;
  let tMs = 60;
  const f0 = x.lead(track[0], null);
  const drone = f0 ? f0 / 2 : undefined;
  x.play(track[0], { holdTime: 0.45, fadeTime: 0.5, volume: 0.2, freq: drone, when: x.at(tMs) });
  tMs += Math.round(unit * 1.7);

  let prev = f0;
  for (let i = 0; i < n - 1; i++) {
    const note = track[i];
    const f = x.lead(note, prev); if (f) prev = f;
    const long = i % 3 === 2;
    x.play(note, {
      holdTime: long ? 0.3 : 0.11, fadeTime: long ? 0.25 : 0.12,
      volume: long ? 0.19 : 0.15,
      freq: f ?? undefined,
      ...(long ? { bend: -1, bendTime: 0.08 } : {}),
      when: x.at(tMs + jitter()),
    });
    tMs += long ? Math.round(unit * 1.55) : Math.round(unit * 0.8);
  }
  // TATAKI — the Tsugaru shake: the note before the last and the open drone,
  // struck alternately as fast as the bachi will go.
  const shakeNote = track[Math.max(0, n - 2)];
  const sf = x.lead(shakeNote, prev);
  const shakes = n >= 3 ? 6 : 4;
  for (let k = 0; k < shakes; k++) {
    const onDrone = k % 2 === 1;
    x.play(onDrone ? track[0] : shakeNote, { holdTime: 0.05, fadeTime: 0.08, volume: 0.1 + 0.05 * (k / shakes),
      freq: onDrone ? drone : sf ?? undefined, when: x.at(tMs + k * 55) });
  }
  tMs += shakes * 55 + 60;
  const last = track[n - 1];
  const lf = x.lead(last, prev);
  const w = x.at(tMs);
  x.play(last, { holdTime: 1.1, fadeTime: 1.0, volume: 0.2, freq: lf ?? undefined, bend: -2, bendTime: 0.22, when: w });
  x.play(track[0], { holdTime: 0.9, fadeTime: 0.9, volume: 0.12, freq: drone, when: w });
}

// IAI — 🗡️ the quick-draw, on the distorted shamisen. A held breath (a low
// swell under near-silence), then ONE sweeping cut — the track sorted and
// swept up and straight back down, tapping-fast — a beat of stillness, and the
// strike: the last note an octave up, bent a whole step into pitch, over its
// fifth. Then the blade goes back in the sheath: one muted click.
function iai(track, x) {
  const n = track.length;
  const f0 = x.lead(track[0], null);
  x.play(track[0], { attackTime: 0.22, holdTime: 0.12, fadeTime: 0.18, volume: 0.07,
                     freq: f0 ? f0 / 2 : undefined, when: x.at(40) });
  let tMs = 300;
  const up = [...track].sort((a, b) => x.pitchIndex(a) - x.pitchIndex(b));
  const step = clamp(Math.round(420 / n), 26, 42);
  let prev = null;
  const climb = [];
  for (const note of up) {
    let f = x.lead(note, prev);
    if (f && prev && f <= prev && f < 1000) f *= 2;
    if (f) prev = f;
    climb.push([note, f]);
  }
  for (const [i, [note, f]] of climb.entries()) {
    x.play(note, { holdTime: 0.07, fadeTime: 0.06, volume: 0.13 + 0.04 * i / climb.length,
                   freq: f ?? undefined, when: x.at(tMs) });
    tMs += step;
  }
  for (const [note, f] of climb.slice(0, -1).reverse()) {
    x.play(note, { holdTime: 0.06, fadeTime: 0.05, volume: 0.13, freq: f ?? undefined, when: x.at(tMs) });
    tMs += Math.round(step * 0.85);
  }
  tMs += 110;                                         // stillness
  const last = track[n - 1];
  const lf = x.lead(last, null);
  const w = x.at(tMs);
  x.play(last, { holdTime: 1.0, fadeTime: 0.9, volume: 0.21, freq: lf ? lf * 2 : undefined, bend: -2, bendTime: 0.14, when: w });
  x.play(last, { holdTime: 0.9, fadeTime: 0.8, volume: 0.10, freq: lf ? lf * 1.5 : undefined, when: w });
  x.play(track[0], { holdTime: 0.04, fadeTime: 0.05, volume: 0.09, freq: f0 ? f0 / 2 : undefined, when: x.at(tMs + 1350) });
}

// ═════════════════════════════════════════════════════════════════════════════
// 🤘 METALNESS MONSTER
// ═════════════════════════════════════════════════════════════════════════════

// BREAKDOWN — the track dropped two octaves into chug register and played in
// GALLOPS (da-da-DUM palm mutes), trashed up with dissonant slam clusters on the
// offbeats, capped by a full power-chord SLAM. His fuzz voice supplies the
// distortion; this supplies the violence.
function breakdown(track, x) {
  const n = track.length;
  let tMs = 60;
  const jitter = () => (x.rand() - 0.5) * 14;         // tight but human
  const unit = Math.max(72, Math.min(110, Math.round(560 / n)));

  let prev = null;
  track.forEach((note, i) => {
    const f = x.lead(note, prev); if (f) prev = f;
    // Two octaves down = the chug register. If laptop speakers swallow it,
    // owner's first knob: / 4 → / 2.
    const low = f ? f / 4 : undefined;
    if (i === n - 1) return;                          // finale is the SLAM
    // GALLOP — chug, chug, HIT.
    [0, 1, 2].forEach(k => {
      const accent = k === 2;
      x.play(note, {
        holdTime: accent ? 0.16 : 0.08, fadeTime: 0.06,
        volume: accent ? 0.20 : 0.13,
        freq: low,
        when: x.at(tMs + jitter()),
      });
      tMs += accent ? unit * 1.6 : unit * 0.7;
    });
    // Every third note: a trashing CLUSTER — the chug note smeared against
    // its own detuned neighbours, struck together. Pure noise-wall.
    if (i % 3 === 2 && low) {
      const w = x.at(tMs + jitter());
      x.play(note, { holdTime: 0.10, fadeTime: 0.08, volume: 0.13, freq: low * 1.06, when: w });
      x.play(note, { holdTime: 0.10, fadeTime: 0.08, volume: 0.13, freq: low * 0.94, when: w });
      tMs += unit * 0.9;
    }
  });

  // ── THE SLAM — final note as a power chord (root + fifth + sub-octave),
  // struck once after a half-beat of dead air, left to ring ugly and long.
  const lastNote = track[n - 1];
  const lf = x.lead(lastNote, prev);
  const root = lf ? lf / 2 : undefined;
  tMs += 90;
  const wSlam = x.at(tMs);
  x.play(lastNote, { holdTime: 1.2, fadeTime: 1.1, volume: 0.22, freq: root, when: wSlam });
  x.play(lastNote, { holdTime: 1.2, fadeTime: 1.1, volume: 0.15, freq: root ? root * 1.5 : undefined, when: wSlam });
  x.play(lastNote, { holdTime: 1.2, fadeTime: 1.1, volume: 0.17, freq: root ? root / 2 : undefined, when: wSlam });
}

// TREMOLO — black-metal tremolo picking: every note a blur of fast picks in the
// mid register, each blur kicked off by a low chug, rolling straight into the
// next; the last note's blur swells, then one power chord ends it.
function tremolo(track, x) {
  const n = track.length;
  const pick = 42;
  const picks = clamp(Math.floor(1500 / (n * pick)), 3, 8);
  let tMs = 60, prev = null;
  track.forEach((note, i) => {
    const f = x.lead(note, prev); if (f) prev = f;
    const last = i === n - 1;
    x.play(note, { holdTime: 0.07, fadeTime: 0.05, volume: 0.17, freq: f ? f / 2 : undefined, when: x.at(tMs) });
    const count = last ? picks + 4 : picks;
    for (let k = 0; k < count; k++) {
      x.play(note, {
        holdTime: 0.035, fadeTime: 0.03,
        volume: last ? 0.10 + 0.07 * (k / count) : (k % 2 ? 0.11 : 0.13),
        freq: f ?? undefined, when: x.at(tMs + k * pick + (x.rand() - 0.5) * 6),
      });
    }
    tMs += count * pick;
  });
  const lf = x.lead(track[n - 1], prev);
  const root = lf ? lf / 2 : undefined;
  const w = x.at(tMs + 40);
  x.play(track[n - 1], { holdTime: 1.0, fadeTime: 1.0, volume: 0.21, freq: root, when: w });
  x.play(track[n - 1], { holdTime: 1.0, fadeTime: 1.0, volume: 0.14, freq: root ? root * 1.5 : undefined, when: w });
}

// DOOM — slow, and every note weighs a ton: each struck as a low power chord
// (root, fifth, sub) left to hang; the last one DIVES into pitch from a half-step
// sharp, and a feedback howl swells in above it.
function doom(track, x) {
  const n = track.length;
  const gap = clamp(Math.round(1500 / n), 150, 420);
  let tMs = 60, prev = null;
  track.forEach((note, i) => {
    const f = x.lead(note, prev); if (f) prev = f;
    if (i === n - 1) return;
    const root = f ? f / 2 : undefined;
    const w = x.at(tMs);
    const hold = Math.max(0.12, gap / 1000 * 0.85);
    x.play(note, { attackTime: 0.02, holdTime: hold, fadeTime: 0.25, volume: 0.18, freq: root, when: w });
    x.play(note, { attackTime: 0.02, holdTime: hold, fadeTime: 0.25, volume: 0.12, freq: root ? root * 1.5 : undefined, when: w });
    x.play(note, { attackTime: 0.02, holdTime: hold, fadeTime: 0.25, volume: 0.12, freq: root ? root / 2 : undefined, when: w });
    tMs += gap;
  });
  const lf = x.lead(track[n - 1], prev);
  const root = lf ? lf / 2 : undefined;
  const w = x.at(tMs + 60);
  x.play(track[n - 1], { holdTime: 1.3, fadeTime: 1.0, volume: 0.22, freq: root, bend: 1, bendTime: 0.35, when: w });
  x.play(track[n - 1], { holdTime: 1.3, fadeTime: 1.0, volume: 0.14, freq: root ? root / 2 : undefined, bend: 1, bendTime: 0.35, when: w });
  x.play(track[n - 1], { attackTime: 0.7, holdTime: 0.6, fadeTime: 0.7, volume: 0.09, freq: lf ? lf * 2 : undefined, when: w });
}

// ═════════════════════════════════════════════════════════════════════════════
// 👽 INTERGALACTIC 0
// ═════════════════════════════════════════════════════════════════════════════

// SCRATCH — a DJ SCRATCH SESSION: each note becomes a vinyl scratch (the
// caller's `scratch` builds its own sweeping graph through the Spirit's tone
// knobs), cycling patterns on a swung hip-hop grid, finishing with a scribble
// scratch into a deep sub drop.
function scratch(track, x) {
  const n = track.length;
  const BEAT = 270;                                   // ~111 BPM quarter note
  const patterns = ['baby', 'chirp', 'transformer', 'chirp', 'flare', 'baby'];
  let tMs = 60;
  let prev = null;

  track.forEach((note, i) => {
    const f = x.lead(note, prev); if (f) prev = f;
    const base = f ?? 330;
    const last = i === n - 1;

    if (last) {
      // Finale: scribble scratch → deep sub drop
      x.scratch(note, base, 'scribble', x.at(tMs));
      tMs += 380;
      x.play(note, {
        holdTime: 0.85, fadeTime: 1.1, volume: 0.22, freq: base / 4,
        when: x.at(tMs),
      });
      return;
    }

    const pat = patterns[i % patterns.length];
    x.scratch(note, base, pat, x.at(tMs));

    // Swung spacing — long-short pairs with tiny humanisation
    const swing = i % 2 === 0 ? BEAT * 0.62 : BEAT * 0.38;
    tMs += Math.round(swing + (x.rand() * 16 - 8));
    if (i % 4 === 3) tMs += Math.round(BEAT * 0.45);   // phrase breath
  });
}

// ARP — synthwave arpeggiator: the track's notes sorted into a rising pattern
// topped by the root's octave, run twice — the second time an octave up — then
// a slow-swelling chord on the last note.
function arp(track, x) {
  const n = track.length;
  const seen = new Set();
  const up = [...track].sort((a, b) => x.pitchIndex(a) - x.pitchIndex(b))
    .filter(v => { const k = x.pitchIndex(v); if (seen.has(k)) return false; seen.add(k); return true; });
  let prev = null;
  const pattern = up.map(note => { let f = x.lead(note, prev); if (f && prev && f <= prev) f *= 2; if (f) prev = f; return [note, f]; });
  if (pattern[0]?.[1]) pattern.push([pattern[0][0], pattern[0][1] * 2]);
  const step = clamp(Math.round(1700 / (2 * pattern.length)), 60, 110);
  let tMs = 60;
  for (const pass of [1, 2]) {
    for (const [i, [note, f]] of pattern.entries()) {
      const hz = f ? (pass === 2 && f * 2 < 1500 ? f * 2 : f) : undefined;
      x.play(note, { holdTime: 0.08, fadeTime: 0.1, volume: i === 0 ? 0.16 : 0.12, freq: hz, when: x.at(tMs) });
      tMs += step;
    }
  }
  const lf = x.lead(track[n - 1], null);
  const w = x.at(tMs + 30);
  for (const [mul, vol] of [[1, 0.15], [1.5, 0.10], [2, 0.08], [0.5, 0.12]]) {
    x.play(track[n - 1], { attackTime: 0.25, holdTime: 0.9, fadeTime: 0.9, volume: vol, freq: lf ? lf * mul : undefined, when: w });
  }
}

// LASER — every note a "pew": fired an octave high and dropping into pitch,
// on a dotted skip, with the echo knob thrown wide open; the last note RISES
// into orbit from an octave below, over a sub thump.
function laser(track, x) {
  const n = track.length;
  const base = clamp(Math.round(1400 / n), 90, 200);
  let tMs = 60, prev = null;
  track.forEach((note, i) => {
    const f = x.lead(note, prev); if (f) prev = f;
    if (i === n - 1) return;
    x.play(note, { holdTime: 0.1, fadeTime: 0.12, volume: 0.15, freq: f ?? undefined, bend: 12, bendTime: 0.09, when: x.at(tMs) });
    tMs += i % 2 === 0 ? Math.round(base * 1.25) : Math.round(base * 0.75);
  });
  const lf = x.lead(track[n - 1], prev);
  const w = x.at(tMs + 60);
  x.play(track[n - 1], { holdTime: 0.95, fadeTime: 0.9, volume: 0.19, freq: lf ?? undefined, bend: -12, bendTime: 0.45, when: w });
  x.play(track[n - 1], { holdTime: 0.2, fadeTime: 0.4, volume: 0.16, freq: lf ? lf / 4 : undefined, when: w });
}

// ═════════════════════════════════════════════════════════════════════════════
// 👑 GLAMARCHY
// ═════════════════════════════════════════════════════════════════════════════

// STRUT — stomp-stomp-CLAP stadium swagger. Each note stomps low then answers
// itself an octave UP (the wide theatrical leap); every third pair throws a
// bright CLAP stab that the echo knob turns into slapback for free. Finish: a
// glitter glissando up the track's own notes into a held two-octave chord.
function strut(track, x) {
  const n = track.length;
  let tMs = 60;
  const unit = Math.max(120, Math.min(170, Math.round(920 / n))); // half-time swagger
  let prev = null;
  track.forEach((note, i) => {
    const f = x.lead(note, prev); if (f) prev = f;
    if (i === n - 1) return;                          // finale below
    // STOMP — low and fat…
    x.play(note, {
      holdTime: 0.22, fadeTime: 0.14, volume: 0.19, freq: f ? f / 2 : undefined,
      when: x.at(tMs),
    });
    tMs += unit;
    // …answered an octave up on the offbeat — the hip-swing.
    x.play(note, {
      holdTime: 0.12, fadeTime: 0.10, volume: 0.13, freq: f ?? undefined,
      when: x.at(tMs),
    });
    tMs += Math.round(unit * 0.55);
    // Every third pair: the CLAP — two octaves up, short and bright.
    if (i % 3 === 2) {
      x.play(note, {
        holdTime: 0.07, fadeTime: 0.08, volume: 0.15, freq: f ? f * 2 : undefined,
        when: x.at(tMs),
      });
      tMs += Math.round(unit * 0.6);
    }
  });
  // ── GLITTER GLISS — fast run up the track's own notes into the finale.
  const run = [...track].sort((a, b) => x.pitchIndex(a) - x.pitchIndex(b));
  prev = null;
  run.forEach((note, i) => {
    let f = x.lead(note, prev);
    if (f && prev && f <= prev && f < 1200) f *= 2;   // force the climb, capped
    if (f) prev = f;
    x.play(note, {
      holdTime: 0.07, fadeTime: 0.06,
      volume: 0.10 + (0.05 * i) / run.length,
      freq: f ?? undefined,
      when: x.at(tMs),
    });
    tMs += 55;
  });
  // ── THE POSE — final note as a wide two-octave chord, held like a bow.
  const lastNote = track[n - 1];
  const lf = x.lead(lastNote, prev);
  const wPose = x.at(tMs + 60);
  x.play(lastNote, { holdTime: 1.1, fadeTime: 1.0, volume: 0.18, freq: lf ?? undefined, when: wPose });
  x.play(lastNote, { holdTime: 1.1, fadeTime: 1.0, volume: 0.14, freq: lf ? lf / 2 : undefined, when: wPose });
}

// BALLAD — the power ballad: each note as a slow broken chord (the bass, then
// the note) under a wash of reverb; then the TRUCK-DRIVER KEY CHANGE — the last
// three notes again, a half-step higher and louder — into a two-octave hold.
function ballad(track, x) {
  const n = track.length;
  const gap = clamp(Math.round(1150 / n), 110, 260);
  let tMs = 60, prev = null;
  const freqs = track.map(note => { const f = x.lead(note, prev); if (f) prev = f; return f; });
  track.forEach((note, i) => {
    const f = freqs[i];
    x.play(note, { holdTime: 0.45, fadeTime: 0.5, volume: 0.12, freq: f ? f / 2 : undefined, when: x.at(tMs) });
    x.play(note, { holdTime: 0.35, fadeTime: 0.5, volume: 0.14, freq: f ?? undefined, when: x.at(tMs + Math.round(gap * 0.35)) });
    tMs += gap;
  });
  tMs += 90;
  const tail = track.slice(-3), tailF = freqs.slice(-3);
  tail.forEach((note, i) => {
    const f = tailF[i];
    x.play(note, { holdTime: 0.2, fadeTime: 0.3, volume: 0.16, freq: f ? f * SEMI : undefined, when: x.at(tMs) });
    tMs += Math.round(gap * 0.8);
  });
  const lf = tailF[tailF.length - 1];
  const w = x.at(tMs + 40);
  x.play(track[n - 1], { holdTime: 1.1, fadeTime: 1.0, volume: 0.18, freq: lf ? lf * SEMI : undefined, when: w });
  x.play(track[n - 1], { holdTime: 1.1, fadeTime: 1.0, volume: 0.13, freq: lf ? lf * SEMI / 2 : undefined, when: w });
  x.play(track[n - 1], { holdTime: 1.0, fadeTime: 1.0, volume: 0.07, freq: lf ? lf * SEMI * 2 : undefined, when: w });
}

// DISCO — the hustle: octave bass (low on the beat, high on the "and"), a
// bright string stab every other note, and a rising WHOOP to end on.
function disco(track, x) {
  const n = track.length;
  const step = clamp(Math.round(1500 / (2 * n)), 70, 125);
  let tMs = 60, prev = null;
  track.forEach((note, i) => {
    const f = x.lead(note, prev); if (f) prev = f;
    if (i === n - 1) return;
    x.play(note, { holdTime: 0.08, fadeTime: 0.06, volume: 0.17, freq: f ? f / 2 : undefined, when: x.at(tMs) });
    x.play(note, { holdTime: 0.07, fadeTime: 0.06, volume: 0.12, freq: f ?? undefined, when: x.at(tMs + step) });
    if (i % 2 === 1 && f) {
      const w = x.at(tMs + step);
      x.play(note, { holdTime: 0.14, fadeTime: 0.12, volume: 0.08, freq: f * 2, when: w });
      x.play(note, { holdTime: 0.14, fadeTime: 0.12, volume: 0.06, freq: f * 3, when: w });
    }
    tMs += step * 2;
  });
  const lf = x.lead(track[n - 1], prev);
  const w = x.at(tMs + 30);
  x.play(track[n - 1], { holdTime: 0.85, fadeTime: 0.9, volume: 0.17, freq: lf ? lf * 2 : undefined, bend: -12, bendTime: 0.3, when: w });
  x.play(track[n - 1], { holdTime: 0.85, fadeTime: 0.9, volume: 0.14, freq: lf ? lf / 2 : undefined, when: w });
}

const BUILDS = { shred, tsugaru, iai, breakdown, tremolo, doom, scratch, arp, laser, strut, ballad, disco };
