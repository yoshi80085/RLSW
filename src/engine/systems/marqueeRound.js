// ─── ENGINE SYSTEM: 🎤 THE MARQUEE ROUND — solo on a clock, or community ─────
// `MARQUEE_QUIZ_DESIGN.md` §13 — Alex, 2026-09-29:
//
//   "1/3 of the time they are community driven — the first to get the right
//    answer gets the card. Wrong answer and don't get it. 2/3 of the time they
//    are non community but run on a timer — say 10 seconds. If the right answer
//    isn't clicked by then, it's treated the same as a wrong answer."
//   + his picks: every player answers on their OWN row of buttons; community
//     marquees are marked on the board; a community round is open 15 s.
//
// Pure. The client drives the clock (a human's click is a real-time event);
// these functions decide what the clicks MEAN, and the headless path (bots
// only) resolves a whole round from them at once.
//
// 🎲 DRAWS. A marquee trigger pre-draws `marqueeDrawCount(kind, bots)` floats:
// [0] the question, [1] the lander's bot odds (solo), [2] the prize, then TWO
// per bot participant (right-or-wrong, then when) in participant order. All
// drawn before anyone answers, so the stream never depends on an outcome.
import {
  MARQUEE_SOLO_SECONDS, MARQUEE_COMMUNITY_SECONDS, MARQUEE_BOT_ANSWER_S,
} from "../../data/gameConstants.js";
import { TRIVIA_BOT_ODDS } from "../../data/trivia.js";

export const roundLimitMs = kind => (kind === 'community' ? MARQUEE_COMMUNITY_SECONDS : MARQUEE_SOLO_SECONDS) * 1000;

/** Floats a trigger must pre-draw for this round. */
export const marqueeDrawCount = (kind, botCount = 0) => 3 + (kind === 'community' ? 2 * botCount : 0);

/**
 * Who answers a community round: every Spirit still in the match, the lander
 * first, then the rest in seat order. `isBot(spirit)` says who is a computer.
 */
export function communityParticipants(spirits = [], landerId, isBot = s => !!s?.cpu) {
  const live = spirits.filter(s => !s.knockedOut);
  const lander = live.find(s => s.id === landerId);
  return [...(lander ? [lander] : []), ...live.filter(s => s.id !== landerId)]
    .map(s => ({ id: s.id, bot: !!isBot(s) }));
}

/**
 * 🤖 Each bot's answer in a community round, from its two pre-drawn floats:
 * right with `TRIVIA_BOT_ODDS[difficulty]`, at a moment inside
 * `MARQUEE_BOT_ANSWER_S`. A wrong bot still CLICKS (and is locked out then).
 * @param floats the batch AFTER the first three — two per bot, in order
 */
export function botAnswers(participants = [], floats = [], difficulty = 'medium') {
  const [lo, hi] = MARQUEE_BOT_ANSWER_S;
  const odds = TRIVIA_BOT_ODDS[difficulty] ?? 0.5;
  let k = 0;
  return participants.filter(p => p.bot).map(p => {
    const right = floats[k++] ?? 1, when = floats[k++] ?? 1;
    return { id: p.id, correct: right < odds, atMs: Math.round((lo + (hi - lo) * when) * 1000) };
  });
}

/**
 * Settle a community round from the answers so far.
 * @param answers [{ id, correct, atMs }] — one per participant at most (a
 *   second click from a locked-out player is ignored); ties go to the earlier
 *   entry in the list, so callers list answers in the order they happened.
 * @returns {{ winnerId: string|null, atMs: number|null, lockedOut: string[], settled: boolean }}
 *   settled — true once someone is right, everyone has answered, or time is up.
 */
export function communityOutcome(answers = [], { nowMs = Infinity, limitMs = roundLimitMs('community'), participants = null } = {}) {
  const seen = new Set(), inTime = [];
  answers.forEach((a, i) => { if (!seen.has(a.id) && a.atMs <= limitMs) { seen.add(a.id); inTime.push({ ...a, i }); } });
  inTime.sort((a, b) => a.atMs - b.atMs || a.i - b.i);
  const lockedOut = [];
  for (const a of inTime) {
    if (a.atMs > nowMs) break;
    if (a.correct) return { winnerId: a.id, atMs: a.atMs, lockedOut, settled: true };
    lockedOut.push(a.id);
  }
  const everyone = participants && participants.every(p => lockedOut.includes(p.id));
  return { winnerId: null, atMs: null, lockedOut, settled: !!everyone || nowMs >= limitMs };
}

/** Solo: a click counts only inside the clock; no click by then is a wrong answer. */
export function soloOutcome({ correct = false, atMs = null } = {}, limitMs = roundLimitMs('solo')) {
  const inTime = atMs != null && atMs <= limitMs;
  return { won: inTime && !!correct, timedOut: atMs == null || atMs > limitMs };
}
