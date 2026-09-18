// =============================================================================
// ui/crowdCoach.js  —  🎤 WHAT THE CROWD SHOUTS, AND WHICH NOTES GLOW
// -----------------------------------------------------------------------------
// IDEAS_INBOX [P1] "Beginner chord finder", step 2's logic half. Step 1
// (`engine/policies/playFinder.js`) knows the best play a hand can make; this
// file turns that play into the two things a beginner actually sees:
//
//   🎤 crowdAsks  — the MELODY step. The acting player's own fans say, in speech
//                   bubbles, what line they want next: the fans play first (what
//                   pays the crowd), the Db ending second. Alex, 2026-09-16:
//                   own crowd only · the crowd picks, no goal menu.
//   🔴🔵 chordGlow — the CHORD step. The fans cannot sensibly ask for a Dominant
//                   7, so the suggested stack notes glow red (Drive) or blue
//                   (Sustain) in the Note Stock instead. Alex, 2026-09-16: glow,
//                   not Pickles.
//
// ⚠️ NOTHING HERE DECIDES A NOTE. Every note, gesture, ending and fan count is
// read off the finder's result, which is read off the game's own scorers. This
// file only chooses WORDS and COLOURS. If a bubble ever names a note the finder
// did not return, that is a bug here, and `crowdCoachCheck.mjs` asserts against
// exactly that.
//
// 📌 THE WORDS ARE A TASTE CALL and so they are data (`CROWD_VOICES`), not
// literals in the logic — the preview page (`.scratch/fan-bubble-preview.html`)
// switches between them, and whatever Alex lands on is the one that ships.
//
// Pure module — no React, no DOM, no rng.
// =============================================================================
import { detectSpiritStyle } from "../music/spiritStyle.js";
import { paletteScaleFor } from "../music/notes.js";
import { scorePlay } from "../engine/policies/playFinder.js";

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const letterOf = note => LETTERS.indexOf(String(note ?? '')[0]);

/** Chip-friendly spelling: the game stores `Bb`/`F#`; a bubble shows ♭/♯. */
export const prettyNote = note => String(note ?? '').replace(/b$/, '♭').replace(/#$/, '♯');

/**
 * The two voices on the preview's lever. `{n}` is a note, `{a}`/`{b}` the two
 * notes of a return phrase. Every key the logic can reach must exist in every
 * voice — the suite checks it.
 */
export const CROWD_VOICES = Object.freeze({
  hype: Object.freeze({
    scalar_shred_up:   'Run it UP!',
    scalar_shred_down: 'Run it DOWN!',
    even_skip_up:      'Skip up the neck!',
    even_skip_down:    'Skip back down!',
    pedal_chug:        'Hit {b}, SLAM back to {a}!',
    signal_circle:     '{a}, {b}, back to {a}!',
    craft_up:          'Keep climbing!',
    craft_down:        'Keep falling!',
    lead_up:           'Take it up — we want MORE!',
    lead_down:         'Take it down — we want MORE!',
    ending_fifth:      'End on {n}! 🤘',
    ending_fourth:     'Land it on {n}!',
    ending_tonic:      'Bring it home to {n}!',
    in_key:            'Stay in key!',
  }),
  plain: Object.freeze({
    scalar_shred_up:   'Step up through the letters',
    scalar_shred_down: 'Step down through the letters',
    even_skip_up:      'Skip a letter, going up',
    even_skip_down:    'Skip a letter, going down',
    pedal_chug:        'Play {b}, then back to {a}',
    signal_circle:     '{a} → {b} → {a}',
    craft_up:          'A long run up pays extra',
    craft_down:        'A long run down pays extra',
    lead_up:           'Start here — it builds to a crowd-pleaser',
    lead_down:         'Start here — it builds to a crowd-pleaser',
    ending_fifth:      'Finish on {n} — the fifth',
    ending_fourth:     'Finish on {n} — the fourth',
    ending_tonic:      'Finish on {n} — home',
    in_key:            'Keep your notes in key',
  }),
});

const fill = (template, vars) => template.replace(/\{(\w)\}/g, (_, k) => prettyNote(vars[k] ?? ''));

/** +1 when the letters climb, −1 when they fall, 0 when they repeat. */
function letterDirection(a, b) {
  const x = letterOf(a), y = letterOf(b);
  if (x < 0 || y < 0 || x === y) return 0;
  const up = (y - x + 7) % 7;
  return up <= 3 ? 1 : -1;
}

/** The first two notes of the line that move, from `from` onwards. */
function directionFrom(line, from) {
  for (let i = Math.max(1, from); i < line.length; i += 1) {
    const d = letterDirection(line[i - 1], line[i]);
    if (d) return d;
  }
  return 0;
}

/**
 * 🎤 What the crowd asks for during the melody step.
 *
 * 🎯 THE WORDS AND THE NOTES MUST DESCRIBE THE SAME THING. A first draft shouted
 * the gesture the line completes *somewhere* while its chips showed the next
 * three notes — "Hit B♭, SLAM back to A♭!" over chips reading C E♭ F. A beginner
 * reads the bubble as one instruction, so each bubble now carries a WINDOW: the
 * notes from the player's next seat up to the note that completes what it names.
 *
 * @param {string} spiritId
 * @param {object} ns     the acting Spirit's note sheet (for the line so far)
 * @param {object} plays  `findBestPlays(spiritId, ns, { goals: ['fans', 'db'] })`
 * @param {object} [opts]
 * @param {'hype'|'plain'} [opts.voice='hype']
 * @param {number}  [opts.chips=4]   the most notes one bubble may carry
 * @param {boolean} [opts.dbBubble=true]  whether the ending gets its own bubble
 * @param {'same-line'|'best-db'} [opts.ending='same-line']
 *   · `same-line` — the ending bubble names the FANS line's own last note, so the
 *     two bubbles are one plan. Quiet when that line does not resolve.
 *   · `best-db` — the ending of the best-Db line, which may be a different line
 *     from the one the fans bubble is walking the player through.
 * @returns {Array<{ kind:'fans'|'db', key:string, text:string, notes:string[],
 *   idx:number[], payoff:{fans:number, db:number}, goal:'fans'|'db' }>}
 *   Ordered: the bubble to show first is first. Empty when there is nothing
 *   worth asking for — the crowd stays quiet rather than cheering noise.
 */
export function crowdAsks(spiritId, ns = {}, plays = {}, opts = {}) {
  const voice = CROWD_VOICES[opts.voice ?? 'hype'] ?? CROWD_VOICES.hype;
  const maxChips = Math.max(1, opts.chips ?? 4);
  const prefix = ns?.melodyLine ?? [];
  if (ns?.hasConfirmed) return [];
  const asks = [];
  const from = prefix.length;
  // 📌 Nothing on the track has paid yet — the line pays once, at commit — so a
  // bubble's PAYOFF is the whole line's. "The line so far" is only read to decide
  // whether the finder's line adds anything the notes already placed would not
  // pay on their own (if not, the crowd has nothing new to ask for). Read through
  // the finder's own referee so both are scored the same way.
  const sofar = prefix.length ? scorePlay(spiritId, ns, { line: prefix }) : { fans: 0, db: 0 };

  // ── 🎤 THE FANS BUBBLE ───────────────────────────────────────────────────
  const fans = plays.fans;
  const fansGained = fans ? fans.result.fans - sofar.fans : 0;
  if (fans && fans.melody.length && fansGained > 0) {
    const line = fans.line;
    // ⚠️ Same palette as the payout, or the words name a shape that pays nothing.
    const palette = paletteScaleFor(spiritId, ns);
    const before = detectSpiritStyle(spiritId, prefix, palette).hits;
    const firstHit = detectSpiritStyle(spiritId, line, palette).hits
      .filter(h => !before.includes(h))
      .map(id => ({ id, at: firstCompletion(spiritId, line, from, id, palette) }))
      .sort((x, y) => x.at - y.at)[0];
    let key, vars = {}, end;
    if (firstHit && Number.isFinite(firstHit.at)) {
      end = firstHit.at;                         // exclusive: line[end - 1] completes it
      if (firstHit.id === 'pedal_chug' || firstHit.id === 'signal_circle') {
        const [a, b] = line.slice(end - 3, end - 1);
        key = firstHit.id; vars = { a, b };
      } else {
        const d = letterDirection(line[end - 2], line[end - 1]) || directionFrom(line, Math.max(1, end - 3));
        key = `${firstHit.id}_${d < 0 ? 'down' : 'up'}`;
      }
    } else {
      // Craft only — the run is the reason, so the window is the run's new notes.
      end = line.length;
      key = directionFrom(line, from) < 0 ? 'craft_down' : 'craft_up';
    }
    // ⚠️ A window too long for the bubble is cut, and then the named gesture is
    // not IN the chips any more — so the words fall back to a lead-in that is
    // true of the notes shown. The gesture gets named once the player is close.
    if (end - from > maxChips) {
      key = directionFrom(line, from) < 0 ? 'lead_down' : 'lead_up';
      vars = {};
    }
    const window = fans.melody.slice(0, Math.max(1, Math.min(end - from, maxChips)));
    asks.push({
      kind: 'fans', goal: 'fans', key,
      text: fill(voice[key], vars),
      notes: window.map(m => m.note),
      idx: window.map(m => m.idx),
      payoff: { fans: fans.result.fans, db: fans.result.db },
    });
  }

  // ── 💰 THE ENDING BUBBLE ─────────────────────────────────────────────────
  const source = (opts.ending ?? 'same-line') === 'best-db' ? plays.db : (asks.length ? fans : plays.db);
  if ((opts.dbBubble ?? true) && source && source.melody.length && source.result.ending && source.result.ending !== 'normal') {
    const last = source.melody.at(-1);
    const key = `ending_${source.result.ending}`;
    asks.push({
      kind: 'db', goal: source.goal, key,
      text: fill(voice[key], { n: last.note }),
      notes: [last.note],
      idx: [last.idx],
      payoff: { fans: source.result.fans, db: source.result.db },
    });
  }

  // Nothing shaped to ask for, but clean notes still pay: a gentle nudge.
  const db = plays.db;
  if (!asks.length && db && db.melody.length && db.result.db > sofar.db) {
    const window = db.melody.slice(0, maxChips);
    asks.push({
      kind: 'db', goal: 'db', key: 'in_key',
      text: fill(voice.in_key, {}),
      notes: window.map(m => m.note),
      idx: window.map(m => m.idx),
      payoff: { fans: db.result.fans, db: db.result.db },
    });
  }
  return asks;
}

/** Index of the note that first completes gesture `id` at or after `from`. */
function firstCompletion(spiritId, line, from, id, palette) {
  for (let end = from + 1; end <= line.length; end += 1) {
    if (detectSpiritStyle(spiritId, line.slice(0, end), palette).hits.includes(id)) return end;
  }
  return Infinity;
}

/**
 * 🔴🔵 Which stock slots glow during the chord step.
 *
 * @param {object} plays  `findBestPlays(spiritId, ns, { goals: ['drive', 'sustain'] })`
 * @param {'drive'|'sustain'|'both'} [source='both']
 *   · `drive`/`sustain` — only that goal's play glows, in its destinations'
 *     colours (a Drive play can still park a note in Sustain).
 *   · `both` — the Drive play's Drive notes glow red and the Sustain play's
 *     Sustain notes glow blue. ⚠️ When one slot is the best note for BOTH, it
 *     glows for the stack the player's dials need more (lower value), and Drive
 *     wins a tie — one slot, one colour, never a blend a beginner has to decode.
 * @param {object} [dials]  `{ drive, sustain }` as the pocket shows them now.
 * @returns {Map<number, 'drive'|'sustain'>}  stock index → colour
 */
export function chordGlow(plays = {}, source = 'both', dials = {}) {
  const glow = new Map();
  if (source === 'drive' || source === 'sustain') {
    for (const s of plays[source]?.stack ?? []) glow.set(s.idx, s.dest);
    return glow;
  }
  const red = (plays.drive?.stack ?? []).filter(s => s.dest === 'drive');
  const blue = (plays.sustain?.stack ?? []).filter(s => s.dest === 'sustain');
  const preferSustain = (dials.sustain ?? Infinity) < (dials.drive ?? Infinity);
  for (const s of red) glow.set(s.idx, 'drive');
  for (const s of blue) {
    if (!glow.has(s.idx) || preferSustain) glow.set(s.idx, 'sustain');
  }
  return glow;
}

// =============================================================================
// 🎛️ CROWD_BUBBLE — ALEX'S DIAL-IN, 2026-09-16
// -----------------------------------------------------------------------------
// Read off the copy-dial-in block of `.scratch/fan-bubble-preview.html`. Alex
// moved SIX of 33 levers; they are marked ★ and carry the default he moved them
// from. ⚠️ EVERY UNMARKED VALUE IS A DEFAULT HE LEFT ALONE, not a choice he made —
// if one of them feels wrong in play, that is new information, not a regression.
// Re-open the preview to change any of them rather than nudging numbers here.
//
// 📌 Four levers did not ship because they were preview-only: `headDial` (the
// clash check), `reduced` (the game follows the OS setting), `offX`/`offY` were
// left at 0 and ship as 0.
// =============================================================================
export const CROWD_BUBBLE = Object.freeze({
  // Words
  voice: 'hype', chips: 4, payoff: 'fans', dbBubble: true, ending: 'same-line',
  // Bubble look
  style: 'neon', colour: 'spirit', font: 15, maxw: 220,
  rad: 12,          // ★ default 8
  glow: 1,
  chipSize: 22,     // ★ default 24
  tail: 'point',
  // Where it comes from
  anchor: 'stand',  // ★ default 'peek' — a fan in the acting Spirit's own grandstand
  offX: 0, offY: 0, fanHop: true,
  // Timing (ms)
  delay: 950,       // ★ default 350 — the crowd waits a beat before it speaks
  popFrom: 0.6, popMs: 220, hold: 2750, fade: 260,
  gap: 1500,        // ★ default 250 — a real pause between the two bubbles
  cycle: 'loop', thinking: true,
  // Stock highlight (melody step)
  hl: 'pulse', hlWhich: 'next', hlPulseMs: 900,
  // Chord glow (chord step)
  glowSrc: 'both', glowStyle: 'pulse', glowInt: 1,
  glowMs: 1500,     // ★ default 1200 — a slower breath
});

/** The levers Alex moved, and the defaults they moved from — so a check can tell
 *  "he chose 12" from "nobody touched it". */
export const CROWD_BUBBLE_CHANGED = Object.freeze({
  rad: 8, chipSize: 24, anchor: 'peek', delay: 350, gap: 250, glowMs: 1200,
});

/**
 * ⏱️ Where the bubble sequence is at `elapsed` ms after the asks arrived.
 *
 * Pure, so the component is only timer glue and the suite can walk a whole
 * sequence at exact milliseconds — the same split as `dialTick.js`.
 *
 * Phases, per bubble: `pop` (popMs) → `hold` (hold) → `fade` (fade) → `gap` (gap).
 * `cycle: 'loop'` repeats forever; `'once'` ends quiet after the last bubble;
 * `'first'` holds bubble 0. `hold: 0` also holds the first bubble until the asks
 * change (the preview's "until the next note").
 * ⚠️ REDUCED MOTION KEEPS THE CLOCK AND DROPS THE MOTION: a bubble still takes
 * the same time to arrive and leave, it just appears and disappears whole.
 *
 * @returns {{ phase:'wait'|'pop'|'hold'|'fade'|'gap'|'done', index:number, t:number }}
 *   `t` is progress through the current phase, 0..1.
 */
export function crowdBubbleFrame(elapsed, count, B = CROWD_BUBBLE) {
  if (!count) return { phase: 'done', index: -1, t: 0 };
  const e = Math.max(0, elapsed);
  if (e < B.delay) return { phase: 'wait', index: -1, t: B.delay ? e / B.delay : 1 };
  let local = e - B.delay;
  if (B.cycle === 'first' || B.hold === 0) {
    return local < B.popMs ? { phase: 'pop', index: 0, t: B.popMs ? local / B.popMs : 1 } : { phase: 'hold', index: 0, t: 0 };
  }
  const per = B.popMs + B.hold + B.fade + B.gap;
  const total = per * count;
  if (B.cycle === 'once' && local >= total) return { phase: 'done', index: -1, t: 0 };
  local %= total;
  const index = Math.floor(local / per);
  let r = local - index * per;
  for (const [phase, len] of [['pop', B.popMs], ['hold', B.hold], ['fade', B.fade], ['gap', B.gap]]) {
    if (r < len) return { phase, index, t: len ? r / len : 1 };
    r -= len;
  }
  return { phase: 'gap', index, t: 1 };
}

/**
 * 🎯 Which stock slots the melody-step highlight marks for the bubble on screen.
 * `hlWhich: 'next'` → only the first chip; `'window'` → every chip in the bubble.
 * @returns {Map<number, 'fans'|'db'>}
 */
export function crowdStockMarks(ask, B = CROWD_BUBBLE) {
  const marks = new Map();
  if (!ask || B.hl === 'off') return marks;
  for (const i of (B.hlWhich === 'next' ? ask.idx.slice(0, 1) : ask.idx)) marks.set(i, ask.kind);
  return marks;
}
