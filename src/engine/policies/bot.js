// ─── BOT POLICIES ───────────────────────────────────────────────────────────
// Phase 7a+7b — pure scorer + planner functions extracted from the Game
// component. Policies are *players*, not rules — they choose what to do given
// the current game state, but they don't mutate anything. The React
// step-machine survives as a pacer: take next policy action → dispatch → wait
// cinematic → repeat.
//
// Every function here is PURE: (state-slice, params[, rng]) → decision.
// No React, no refs, no side effects, no DOM.

import { hexRingFromCenter } from "../../board/boardHelpers.js";
import { HEX_BY_NUM, HEX_BY_QR } from "../../board/hexMap.js";
import { axialDist, axialNeighbors, angleTo, angleDiff } from "../../board/hexGeometry.js";
import { isRearHit } from "../systems/combat.js";
import { skillEligibility } from "../systems/skills.js";
import { usedHas } from "../systems/economy.js";
import { LIMELIGHT_HEX, stackCapFor } from "../../data/gameConstants.js";
import { buildScale, getIntervalNotes, pitchIndex } from "../../music/notes.js";
import { cadenceHints } from "../../music/cadence.js";
import { evaluateChord } from "../../music/chords.js";

// ── Constants ───────────────────────────────────────────────────────────────

// 🔪 `rear` = appetite for getting behind a rival (the extra Sustain note a
// backstab strips). `rearFear` = how hard it works to keep its own back
// covered. These are deliberately NOT the same number per persona — a bot that
// hunts backs while carelessly showing its own is a distinct, readable
// personality, and it's the one the Mosh Lord should have.
export const BOT_PERSONALITIES = {
  maestro:  { name:'The Maestro',  emoji:'🎼', note:'musical',
    blurb:'wins on pure musicianship — Theory, clean tracks, cadences & riffs.',
    move:{ center:1.2, rival:0.4, token:1.4, spotlight:1.1, edgeFear:1.6, rear:0.5, rearFear:1.3 },
    skillOrder:['theory_major','range_1','theory_minor','amp_1','theory_dom7','theory_modes','amp_2','range_2','theory_chromatic','amp_3','range_3'] },
  moshlord: { name:'The Mosh Lord', emoji:'🤘', note:'combat',
    blurb:'pure aggression — Thrash, hunts the wounded and the leader, swings for knockouts.',
    move:{ center:1.0, rival:1.9, token:0.6, spotlight:0.8, edgeFear:0.5, rear:1.7, rearFear:0.4 },
    skillOrder:['power_1','amp_1','theory_major','amp_2','power_2','theory_minor','amp_3','power_3'] },
  diva:     { name:'The Diva',     emoji:'✨', note:'clean',
    blurb:'owns the spotlight — holds centre stage, works the crowd, grabs Lost Chords.',
    move:{ center:1.9, rival:0.7, token:1.2, spotlight:1.4, edgeFear:1.2, rear:0.7, rearFear:1.5 },
    skillOrder:['range_1','amp_1','theory_major','range_2','amp_2','theory_minor','amp_3'] },
  saboteur: { name:'The Saboteur', emoji:'🪤', note:'disrupt', targetLeader:true,
    blurb:'controls the board — ranged Sonic, zoning, drains & staggers the leader.',
    move:{ center:0.9, rival:1.1, token:0.8, spotlight:0.9, edgeFear:1.0, rear:1.5, rearFear:1.1 },
    skillOrder:['amp_1','range_1','power_1','theory_major','amp_2','range_2','power_2','theory_minor','theory_dom7','amp_3','range_3','power_3','theory_modes'] },
};

// How far away a rival still has to be worth turning to face. Beyond this the
// rear geometry is noise — they can't reach you this turn anyway, and letting
// distant spirits drag the score around makes the bot pace instead of play.
export const REAR_INTEREST_DIST = 3;

// Half-angle of the forward attack cone. Mirrors getSwingCone's Math.PI / 2.2
// in the game file — if that arc is ever retuned, retune this with it, or the
// bot will start valuing flanks it can't actually shoot from.
export const CONE_HALF_ARC = Math.PI / 2.2;
export const BOT_PERSONA_KEYS = ['maestro','moshlord','diva','saboteur'];

export const BOT_SKILL_PRIORITY_BASE = [
  'amp_1', 'range_1',
  'theory_major', 'amp_2', 'power_1', 'theory_minor',
  'theory_dom7', 'amp_3', 'range_2', 'power_2', 'theory_modes', 'theory_chromatic',
  'range_3', 'power_3',
];

// Exclusive-route passives, slotted in up front for the spirit that owns them.
export const BOT_SPIRIT_SKILLS = {
  cosmic_ronin:      ['psycho_bushido', 'shadow_illusion', 'cursed_shamisen', 'wa_no_koe'],
  Metalness_Monster: ['goes_to_11', 'master_moshpits', 'tentacle', 'azrael'],
};

export const SPIRIT_ONLY_ROUTE = { shredding_ronin: 'cosmic_ronin', metalness: 'Metalness_Monster' };

export const BOT_RIFF_PROFILE = {
  hitRate: 0.78, perfectRate: 0.30, goodRate: 0.40,
  rtPerfect: 45, rtGood: 170, rtOk: 330,
};

// ── Pure scorer functions ───────────────────────────────────────────────────

/**
 * Assign a persona to a bot. Returns the persona key.
 * `takenKeys` = array of persona keys already assigned to other bots.
 * `rngVal` = a [0,1) float from the engine rng for the fallback case
 * (more bots than persona slots).
 */
export function botAssignPersona(takenKeys, rngVal) {
  const taken = new Set(takenKeys);
  return BOT_PERSONA_KEYS.find(k => !taken.has(k))
      ?? BOT_PERSONA_KEYS[Math.floor(rngVal * BOT_PERSONA_KEYS.length)];
}

/**
 * Is `attackerNum` standing in `defender`'s rear wedge? Board-aware wrapper
 * around the engine's pure `isRearHit`, so the bot judges backstabs by exactly
 * the same rule combat resolves them by. A missing hex answers "no".
 */
export function botIsBehind(defender, attackerNum) {
  if (!defender) return false;
  const dh = HEX_BY_NUM[defender.num];
  const ah = HEX_BY_NUM[attackerNum];
  if (!dh || !ah || dh.num === ah.num) return false;
  return isRearHit(defender.facing ?? 0, angleTo(dh, ah), angleDiff);
}

/**
 * Rank a candidate list (already filtered to rivals it can actually reach) from
 * juiciest to least. Priority: close a knockdown first, then lean on the Fame
 * front-runner, then break ties on lowest Vibe.
 * Pure — fame comes from `noteStates`.
 *
 * 🔪 `selfNum` (optional) lets it see which candidates have their backs turned.
 * A backstab strips an extra Sustain note, so among otherwise-equal targets the
 * exposed one wins — but it is deliberately the LAST tiebreak, below finishing
 * a wounded rival and below pressuring the Fame leader. A bot that chases the
 * flanking bonus past a rival it could knock down is a bot playing the bonus
 * instead of the game. Callers that don't pass `selfNum` behave exactly as before.
 *
 * ⚠️ THE FULL ORDER IS THE EXPORT AND `botPickTarget` IS ITS HEAD. §6.3's beam
 * has to RANK attack branches rather than choose one, and re-deriving this
 * priority inside the scorer would fork the tuning across two files that drift
 * in silence — the copy would look right until somebody retuned only one of
 * them. One comparator, two consumers.
 */
export function botTargetOrder(candidates, noteStates, selfNum = null) {
  return [...(candidates ?? [])].sort((a, b) => {
    const ka = (a.vibe ?? 99) <= 2 ? 1 : 0;
    const kb = (b.vibe ?? 99) <= 2 ? 1 : 0;
    if (ka !== kb) return kb - ka;
    if (ka && kb)  return (a.vibe ?? 99) - (b.vibe ?? 99);
    const fa = noteStates?.[a.id]?.fame ?? 0;
    const fb = noteStates?.[b.id]?.fame ?? 0;
    if (fb !== fa) return fb - fa;
    if ((a.vibe ?? 99) !== (b.vibe ?? 99)) return (a.vibe ?? 99) - (b.vibe ?? 99);
    if (selfNum == null) return 0;
    return (botIsBehind(b, selfNum) ? 1 : 0) - (botIsBehind(a, selfNum) ? 1 : 0);
  });
}

/**
 * Pick the juiciest rival to hit — the head of `botTargetOrder`. Behaviour is
 * unchanged, `null` on an empty candidate list included.
 */
export function botPickTarget(candidates, noteStates, selfNum = null) {
  if (!candidates.length) return null;
  return botTargetOrder(candidates, noteStates, selfNum)[0];
}

/**
 * Score a destination hex by everything that actually wins the game.
 * Pure — all data in `ctx` (built by the caller from engine state).
 * ctx: { p (persona), center (hex obj), hurt (bool), myFame, spot (hex obj),
 *        tokens [{num, q, r}], events [{num, q, r}],
 *        rivals [{r (spirit), h (hex), fame}],
 *        from (hex obj — where the mover is standing now),
 *        selfFacing (radians — its facing if it doesn't move) }
 * `from`/`selfFacing` are optional; without them the rear-wedge term is simply
 * skipped, so older callers keep their exact previous scores.
 */
export function botHexScore(h, ctx) {
  const m = ctx.p.move;
  let s = 0;
  const ring = hexRingFromCenter(h.num);
  s += (ring === 'main' ? 16 : ring === 'pit' ? 12 : ring === 'floor' ? 3 : -14) * m.center;
  if (ctx.center) s -= axialDist(h.q, h.r, ctx.center.q, ctx.center.r) * 0.8 * m.center;
  if (h.edge) s -= 8 * m.edgeFear;
  if (ctx.spot) {
    if (h.num === ctx.spot.num) s += (ctx.hurt ? 80 : 14) * m.spotlight;
    else s -= axialDist(h.q, h.r, ctx.spot.q, ctx.spot.r) * (ctx.hurt ? 9 : 1.5) * m.spotlight;
  }
  if (ctx.tokens.some(t => t.num === h.num)) s += 22 * m.token;
  else if (ctx.tokens.length) s -= Math.min(...ctx.tokens.map(t => axialDist(h.q, h.r, t.q, t.r))) * 2 * m.token;
  if (ctx.events.some(t => t.num === h.num)) s += 18 * m.token;
  else if (ctx.events.length) s -= Math.min(...ctx.events.map(t => axialDist(h.q, h.r, t.q, t.r))) * 1.2 * m.token;
  if (ctx.rivals.length) {
    let best = -Infinity;
    for (const rv of ctx.rivals) {
      let w = 2.2 * m.rival;
      if (rv.fame > ctx.myFame + 5) w += 1.6;
      if ((rv.r.vibe ?? 9) <= 2)    w += 1.4;
      if (ctx.hurt)                 w *= 0.5;
      best = Math.max(best, -axialDist(h.q, h.r, rv.h.q, rv.h.r) * w);
    }
    s += best;
  }

  // ── 🔪 REAR WEDGE ─────────────────────────────────────────────────────────
  // Facing isn't free: moving to `h` points the mover at `h` (movement.js sets
  // facing = facingAngle(from, to)), so the destination decides BOTH which
  // backs it can get behind and which back it turns. This term scores both
  // halves of that trade at once, which is why it can't be a post-hoc filter.
  //
  // Weighted by proximity: a rival three hexes off is a hypothetical, one that
  // is adjacent is about to hit you. Beyond REAR_INTEREST_DIST, nothing.
  if (ctx.rivals.length && ctx.from) {
    const moving = h.num !== ctx.from.num;
    const myFacing = moving ? angleTo(ctx.from, h) : (ctx.selfFacing ?? 0);
    for (const rv of ctx.rivals) {
      const d = axialDist(h.q, h.r, rv.h.q, rv.h.r);
      if (d < 1 || d > REAR_INTEREST_DIST) continue;
      const prox = (REAR_INTEREST_DIST + 1 - d) / REAR_INTEREST_DIST;
      const behindThem = isRearHit(rv.r.facing ?? 0, angleTo(rv.h, h), angleDiff);
      // ⚠️ Standing behind someone is worth NOTHING if you're facing away from
      // them — you can't swing or beam through the back of your own head. So
      // the offensive half is gated on them landing in the cone this move
      // leaves us pointing down (same ~80° half-arc getSwingCone uses).
      // Without this gate the scorer rewards blowing straight PAST a rival,
      // which lands you behind them, facing the wrong way, with your own back
      // offered up. That is the exact opposite of a flank.
      const facingThem = angleDiff(angleTo(h, rv.h), myFacing) <= CONE_HALF_ARC;
      if (behindThem && facingThem) s += 9 * prox * (m.rear ?? 1);
      // DEFENCE — from here, is MY back turned to them? Costed slightly higher
      // than the offensive prize: you choose when to take a flank, but you
      // don't choose when a rival takes yours.
      if (isRearHit(myFacing, angleTo(h, rv.h), angleDiff)) {
        s -= 11 * prox * (m.rearFear ?? 1);
      }
    }
  }
  return s;
}

/**
 * Skill eligibility gate — wraps the engine's pure function.
 * `skillById` = { skillId: { id, routeId, prereq, ... } }
 */
export function botSkillEligible(skillId, unlocked, selfId, skillById) {
  const sk = skillById[skillId];
  return skillEligibility(sk, unlocked, {
    ownerRoute: sk ? SPIRIT_ONLY_ROUTE[sk.routeId] : null, selfId,
  }).ok;
}

/**
 * Pick the next skill the bot should save toward.
 * `personaKey` = the bot's assigned persona key.
 * `skillById` = the SKILL_BY_ID lookup.
 */
export function botPickSkillTarget(selfId, unlocked, personaKey, skillById) {
  const persona = BOT_PERSONALITIES[personaKey];
  const order = [
    ...(BOT_SPIRIT_SKILLS[selfId] ?? []),
    ...(persona?.skillOrder ?? []),
    ...BOT_SKILL_PRIORITY_BASE,
  ];
  for (const id of order) if (botSkillEligible(id, unlocked, selfId, skillById)) return id;
  return null;
}

/**
 * Synthesize a bot's riff-off results. `rng` draws from the engine rng
 * (or Math.random for backwards compat). Returns the same shape
 * riffStats consumes: [{ hit, rt, grade, noteIdx }].
 */
export function botRiffResults(len, rng) {
  const P = BOT_RIFF_PROFILE;
  const out = [];
  for (let i = 0; i < len; i++) {
    if (rng() > P.hitRate) { out.push({ hit: false, rt: null, grade: 'miss', noteIdx: i }); continue; }
    const r = rng();
    let grade, rt;
    if (r < P.perfectRate)                   { grade = 'perfect'; rt = P.rtPerfect + rng() * 80; }
    else if (r < P.perfectRate + P.goodRate) { grade = 'good';    rt = P.rtGood + rng() * 120; }
    else                                     { grade = 'ok';      rt = P.rtOk + rng() * 180; }
    out.push({ hit: true, rt: Math.round(rt), grade, noteIdx: i });
  }
  return out;
}

// ── Phase 7b: plan functions ────────────────────────────────────────────────

// Discord-unlock tiers → which interval keys each unlock grants per mode.
// Mirrors DISCORD_UPGRADE_TIERS in the main file (game data, stable).
export const DISCORD_INTERVAL_MAP = [
  { id: 'discord_1', notesByMode: { major: ['minorSeventh'], minor: [] } },
  { id: 'discord_2', notesByMode: { major: [], minor: ['majorThird'] } },
  { id: 'discord_3', notesByMode: { major: ['tritone'], minor: ['tritone'] } },
  // discord_4 (chromatic climb) unlocks run-based clean, no interval keys
];

/**
 * Is a note "playable" (not discord) given the current scale + unlocks?
 * Pure rebuild of Game's closure-based `isNotePlayable`.
 */
function botIsNotePlayable(note, scale, intervals, discordUnlocks, scaleMode) {
  if (scale.includes(note)) return true;
  // Identify which interval key this note is
  const pc = pitchIndex(note);
  let key = null;
  for (const [k, v] of Object.entries(intervals)) {
    if (pitchIndex(v) === pc) { key = k; break; }
  }
  if (!key) return false;
  // Build the unlocked interval keys set from discord unlocks
  const unlocked = new Set(
    DISCORD_INTERVAL_MAP
      .filter(t => discordUnlocks.includes(t.id))
      .flatMap(t => t.notesByMode?.[scaleMode] ?? [])
  );
  return unlocked.has(key);
}

/**
 * RANK every stock index worth adding to the melody line, best first.
 *
 * ⚠️ THIS IS `botPlanNoteStep`'S BODY, PROMOTED — not a second opinion about
 * note choice. The chooser always built a full preference order internally
 * (body ascending by scale degree, then the reserved ending, then a discord
 * opener) and then threw all but the head away. §6.3's beam needs the part that
 * was thrown away: melody notes are the combinatorial kind, so an unranked beam
 * keeps an arbitrary five of them and the bot's musicianship becomes whatever
 * order the stock happened to arrive in.
 *
 * Returns `{ order, commit }`. `order` is stock INDICES, best first; `commit` is
 * true exactly when the chooser would have said so, i.e. when `order` is empty.
 *
 * ⚠️ `order` DOES NOT LIST EVERY LEGAL NOTE, and that is deliberate. Discord
 * notes appear only in the one case the chooser would ever play one — an empty
 * track. A note missing from `order` is not "bad", it is UNRANKED: the scorer
 * floors those to a single shared value so they keep source order among
 * themselves rather than being reshuffled by a preference nobody wrote down.
 */
export function botNoteStepOrder(noteState, persona) {
  const ns = noteState ?? {};
  const stock = ns.noteStock ?? [];
  const track = ns.melodyLine ?? [];
  const used  = ns.usedStockIdx;
  const NOTE_CAP = 8;
  if (track.length >= NOTE_CAP) return { order: [], commit: true };

  const root = ns.rootNote ?? 'C', mode = ns.scaleMode ?? 'major';
  const scale = buildScale(root, mode);
  const iv    = getIntervalNotes(root, mode);
  const style = persona.note;  // musical | combat | disrupt | clean
  const discordUnlocks = ns.discordUnlocks ?? [];

  const avail = [];
  for (let i = 0; i < stock.length; i++) if (!usedHas(used, i)) avail.push(i);
  const clean   = avail.filter(i => botIsNotePlayable(stock[i], scale, iv, discordUnlocks, mode));
  const discord = avail.filter(i => !botIsNotePlayable(stock[i], scale, iv, discordUnlocks, mode));

  // Choose which note to RESERVE for the big ending, by persona.
  let endIdx = null;
  if (style === 'musical') {
    const hints = cadenceHints(ns.finalsTrail ?? [], ns.cadenceCooldowns ?? {});
    for (const hint of hints) {
      const idx = clean.find(i => pitchIndex(stock[i]) === hint.nextPc);
      if (idx != null) { endIdx = idx; break; }
    }
  } else if (style === 'disrupt') {
    endIdx = clean.find(i => stock[i] === iv.minorSeventh)
          ?? clean.find(i => stock[i] === iv.tritone) ?? null;
  }
  if (endIdx == null) {
    endIdx = clean.find(i => stock[i] === iv.fifth)
          ?? clean.find(i => stock[i] === iv.fourth) ?? null;
  }

  // Body = rest of clean notes, ascending by scale degree (builds Drive).
  const deg  = (i) => { const d = scale.indexOf(stock[i]); return d === -1 ? 99 : d; };
  let body = clean.filter(i => i !== endIdx).sort((a, b) => deg(a) - deg(b));

  // A Brawler welcomes ONE tritone in the body. ⚠️ The original reason was
  // "Damage×2 worth the −1 DB" — B5 deleted that effect (it multiplied nothing).
  // The behaviour is kept because the trade still stands on different grounds:
  // the tritone pays +1 Performance, and after B4 a tritone the Brawler's own
  // stack legalizes also pays Drive. Worth re-tuning once B7 gives discord real
  // teeth, since the −1 DB half of this trade is about to get more expensive.
  if (style === 'combat') {
    const tri = discord.find(i => stock[i] === iv.tritone);
    if (tri != null && track.length < NOTE_CAP - 1 && !body.includes(tri)) body = [...body, tri];
  }

  // ⚠️ THE CONCATENATION *IS* THE OLD CASCADE, in the same order the four
  // returns ran in: body first, then the reserved ending, then — only on an
  // empty track — the discord opener. Dedupe keeps first position, which is what
  // makes the Brawler's tritone (appended to `body` above AND sitting in
  // `discord`) rank where the body put it instead of falling to the tail.
  const order = [
    ...body,
    ...(endIdx != null ? [endIdx] : []),
    ...(track.length === 0 ? discord : []),
  ].filter((idx, i, arr) => arr.indexOf(idx) === i);

  return { order, commit: order.length === 0 };
}

/**
 * Decide the bot's next note-track action: { slot } to play a stock index,
 * or { commit: true } to lock the track in. Pure over noteState + persona.
 * The head of `botNoteStepOrder`.
 */
export function botPlanNoteStep(noteState, persona) {
  const { order, commit } = botNoteStepOrder(noteState, persona);
  return commit ? { commit: true } : { slot: order[0] };
}

/**
 * Evaluate a chord with spirit-specific overrides (Intergalactic 0 bonuses).
 * Pure — wraps evaluateChord from music/chords.js.
 */
export function botSpiritChord(spiritId, notes) {
  const ch = evaluateChord(notes);
  if (spiritId === 'intergalactic_0') {
    return {
      ...ch,
      drive:   ch.id === 'cluster' ? ch.drive + 1 : ch.drive,
      sustain: ch.sustain + 1,
    };
  }
  return ch;
}

/**
 * DEPRECATED — kept for save-compat / fallback; replaced by botPlanStackCommit.
 */
export function botPlanRevoice(noteState, spiritId, persona) {
  const ns = noteState ?? {};
  if (ns.revoiceUsedThisTurn) return null;
  const chord = ns.chordStack ?? [];
  if (chord.length >= 5) return null;
  const stock = ns.noteStock ?? [];
  const style = persona.note;
  const have  = new Set(chord.map(pitchIndex));
  const cands = [...new Set(stock.filter(n => !have.has(pitchIndex(n))))];
  if (!cands.length) return null;
  const weight = (c) => {
    if (style === 'combat' || style === 'disrupt')    return c.drive * 2 + c.sustain;
    if (style === 'clean'  || style === 'Flair')      return c.sustain * 2 + c.drive;
    return c.drive + c.sustain;
  };
  const cur = weight(botSpiritChord(spiritId, chord));
  let best = null, bestW = cur;
  for (const note of cands) {
    const w = weight(botSpiritChord(spiritId, [...chord, note]));
    if (w > bestW) { bestW = w; best = note; }
  }
  if (best == null && chord.length < 2) best = cands[0];
  return best;
}

/**
 * DRIVE / SUSTAIN SPLIT — decide how to spend the stack commit budget this turn.
 * Returns an array of { note, dest } where dest is 'drive' | 'sustain', or []
 * if no commits are worthwhile. At most STACK_COMMIT_BUDGET entries.
 *
 * Heuristic: favor Drive when hunting (persona.note === 'combat'/'disrupt'),
 * favor Sustain when low Vibe or defensive style. Splits evenly otherwise.
 * Pure over noteState + spiritId + persona + vibe + cap.
 *
 * `cap` is the spirit's DERIVED stack capacity (B0b) — slots 1-3 baseline, +1 for
 * theory_dom7, +1 for theory_modes. It is passed in rather than read from a
 * constant so this stays pure and so bots respect the same gate players do.
 * Callers should supply `stackCapFor(noteState.unlockedSkills)`; the default
 * derives it from the note sheet so an un-updated caller still behaves correctly.
 */
export function botPlanStackCommit(noteState, spiritId, persona, vibe = 10, maxVibe = 10, cap = null) {
  const ns = noteState ?? {};
  const budget = 3 - (ns.stackCommitsThisTurn ?? 0);
  if (budget <= 0) return [];
  const stackCap = cap ?? stackCapFor(ns.unlockedSkills ?? []);

  const drive   = ns.driveStack   ?? [];
  const sustain = ns.sustainStack ?? [];
  const stock   = ns.noteStock ?? [];
  const used    = ns.usedStockIdx ?? [];
  const style   = persona.note;

  // available pool notes (unused stock)
  const avail = stock.filter((_, i) => !used.includes(i));
  if (!avail.length) return [];

  // weight function — which stat does this persona care about?
  const driveWeight = (c) => c.drive;
  const sustWeight  = (c) => c.sustain;

  // decide priority: drive-first vs sustain-first
  const vibeRatio  = vibe / Math.max(1, maxVibe);
  const preferSust = vibeRatio < 0.4 || style === 'clean' || style === 'Flair';
  const preferDrv  = !preferSust && (style === 'combat' || style === 'disrupt');

  const commits = [];
  let dStack = [...drive], sStack = [...sustain];
  const usedNotes = new Set();

  for (let i = 0; i < Math.min(budget, avail.length); i++) {
    // pick the best destination
    const dFull = dStack.length >= stackCap;
    const sFull = sStack.length >= stackCap;
    if (dFull && sFull) break;

    let dest;
    if (dFull)                         dest = 'sustain';
    else if (sFull)                    dest = 'drive';
    else if (preferSust && !sFull)     dest = 'sustain';
    else if (preferDrv  && !dFull)     dest = 'drive';
    else                               dest = dStack.length <= sStack.length ? 'drive' : 'sustain';

    const stack   = dest === 'drive' ? dStack : sStack;
    const wFn     = dest === 'drive' ? driveWeight : sustWeight;
    const have    = new Set(stack.map(pitchIndex));
    const cands   = avail.filter(n => !usedNotes.has(n) && !have.has(pitchIndex(n)));
    if (!cands.length) {
      // try the other stack
      if (dest === 'drive' && !sFull) { dest = 'sustain'; }
      else if (dest === 'sustain' && !dFull) { dest = 'drive'; }
      else break;
      const s2 = dest === 'drive' ? dStack : sStack;
      const h2 = new Set(s2.map(pitchIndex));
      const c2 = avail.filter(n => !usedNotes.has(n) && !h2.has(pitchIndex(n)));
      if (!c2.length) break;
      // pick the candidate that maximizes the stat
      const wFn2 = dest === 'drive' ? driveWeight : sustWeight;
      let best = c2[0], bestW = wFn2(botSpiritChord(spiritId, [...s2, c2[0]]));
      for (let j = 1; j < c2.length; j++) {
        const w = wFn2(botSpiritChord(spiritId, [...s2, c2[j]]));
        if (w > bestW) { bestW = w; best = c2[j]; }
      }
      commits.push({ note: best, dest });
      usedNotes.add(best);
      if (dest === 'drive') dStack.push(best); else sStack.push(best);
      continue;
    }

    // pick the candidate that maximizes the stat for this stack
    let best = cands[0], bestW = wFn(botSpiritChord(spiritId, [...stack, cands[0]]));
    for (let j = 1; j < cands.length; j++) {
      const w = wFn(botSpiritChord(spiritId, [...stack, cands[j]]));
      if (w > bestW) { bestW = w; best = cands[j]; }
    }

    // only commit if it actually improves the stat (or if the stack is fragile)
    const cur = wFn(botSpiritChord(spiritId, stack));
    if (bestW <= cur && stack.length >= 2) continue;

    commits.push({ note: best, dest });
    usedNotes.add(best);
    if (dest === 'drive') dStack.push(best); else sStack.push(best);
  }

  return commits;
}

/**
 * Live rivals within `dist` hexes. Pure over the spirits array.
 */
export function botRivalsWithin(spirits, selfId, selfNum, dist) {
  const myHex = HEX_BY_NUM[selfNum];
  if (!myHex) return [];
  return spirits.filter(s => {
    if (s.knockedOut || s.id === selfId) return false;
    const h = HEX_BY_NUM[s.num];
    return h && axialDist(myHex.q, myHex.r, h.q, h.r) <= dist;
  });
}

/**
 * Build the `botHexScore` context for one Spirit's seat.
 *
 * ⚠️ EXTRACTED FROM `botPlanMove`, WHICH NOW CALLS IT — this is not a parallel
 * reading of the board. §6.3's beam has to score `move` and `face` branches, and
 * both are `botHexScore` questions: a move re-faces you down the direction of
 * travel, so the destination decides the rear wedge, and a `face` is the same
 * scorer with the position held and only `selfFacing` varied. A second copy of
 * this ctx would be a second board reading to keep in step for no gain.
 *
 * Returns null if the Spirit is not on a hex — the same "no opinion" the callers
 * already have to handle.
 */
export function botMoveCtx(state, self, persona) {
  const from = HEX_BY_NUM[self?.num];
  if (!from) return null;
  const live = state?.spirits ?? [];
  const me = live.find(s => s.id === self.id) ?? self;
  const spotlightHex = state?.board?.spotlightHex;
  const boardTokens = state?.board?.boardTokens ?? [];
  const eventHexes = state?.board?.eventHexes ?? [];
  return {
    p:      persona,
    center: HEX_BY_NUM[LIMELIGHT_HEX],
    hurt:   (me.vibe ?? 9) <= Math.ceil((me.maxVibe ?? 5) * 0.4),
    myFame: state?.noteStates?.[self.id]?.fame ?? 0,
    spot:   (typeof spotlightHex === 'number') ? HEX_BY_NUM[spotlightHex] : null,
    tokens: boardTokens.map(t => HEX_BY_NUM[t.num]).filter(Boolean),
    events: eventHexes.map(n => HEX_BY_NUM[n]).filter(Boolean),
    rivals: live.filter(s => !s.knockedOut && s.id !== self.id)
      .map(r => ({ r, h: HEX_BY_NUM[r.num], fame: state?.noteStates?.[r.id]?.fame ?? 0 }))
      .filter(x => x.h),
    // 🔪 the rear-wedge term needs to know where it's stepping FROM (that's
    // what sets its new facing) and what it's facing if it holds position.
    from: from,
    selfFacing: me.facing ?? 0,
  };
}

/**
 * Decide the next movement step. Returns a hex num to move to, or null to
 * hold position. Pure over engine state + amps (passed separately since
 * amps aren't engine-owned yet).
 *
 * `state` = { spirits, noteStates, rockGod, board }
 * `self`  = the acting spirit object
 * `persona` = the bot's personality object
 * `amps` = [{ hexNum }] array (from React state)
 */
export function botPlanMove(state, self, persona, amps) {
  const from = HEX_BY_NUM[self.num];
  if (!from) return null;
  const live = state.spirits;
  const occupied = new Set(live.filter(s => !s.knockedOut && s.id !== self.id).map(s => s.num));
  const ampHexes = new Set((amps ?? []).map(a => a.hexNum));
  const neighbors = axialNeighbors(from.q, from.r)
    .map(({ q, r }) => HEX_BY_QR[`${q},${r}`])
    .filter(h => h && !occupied.has(h.num) && !ampHexes.has(h.num));
  if (!neighbors.length) return null;

  // Boss fight: converge on the God.
  const bossGod = state.rockGod?.god;
  if (state.rockGod?.summoned && bossGod && !state.rockGod?.outcome) {
    const gh = HEX_BY_NUM[bossGod.num];
    if (gh) {
      const toward = neighbors
        .filter(h => h.num !== bossGod.num)
        .map(h => ({ num: h.num, d: axialDist(h.q, h.r, gh.q, gh.r) }))
        .sort((a, b) => a.d - b.d)[0];
      const hereD = axialDist(from.q, from.r, gh.q, gh.r);
      return toward && toward.d < hereD ? toward.num : null;
    }
  }

  const ctx = botMoveCtx(state, self, persona);
  if (!ctx) return null;
  const here = botHexScore(from, ctx);
  const best = neighbors
    .map(h => ({ num: h.num, s: botHexScore(h, ctx) }))
    .sort((a, b) => b.s - a.s)[0];
  return best && best.s > here + 0.5 ? best.num : null;
}
