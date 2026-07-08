// ─── BOT POLICIES ───────────────────────────────────────────────────────────
// Phase 7a — pure scorer functions + constants extracted from the Game
// component. Policies are *players*, not rules — they choose what to do given
// the current game state, but they don't mutate anything. The React
// step-machine survives as a pacer: take next policy action → dispatch → wait
// cinematic → repeat.
//
// Every function here is PURE: (state-slice, params[, rng]) → decision.
// No React, no refs, no side effects, no DOM.

import { hexRingFromCenter } from "../../board/boardHelpers.js";
import { axialDist } from "../../board/hexGeometry.js";
import { skillEligibility } from "../systems/skills.js";

// ── Constants ───────────────────────────────────────────────────────────────

export const BOT_PERSONALITIES = {
  maestro:  { name:'The Maestro',  emoji:'🎼', note:'musical',
    blurb:'wins on pure musicianship — Theory, clean tracks, cadences & riffs.',
    move:{ center:1.2, rival:0.4, token:1.4, spotlight:1.1, edgeFear:1.6 },
    skillOrder:['theory_major','fans_4eva','theory_minor','amp_1','theory_dom7','fandom_army','theory_modes','amp_2','theory_chromatic','amp_3'] },
  moshlord: { name:'The Mosh Lord', emoji:'🤘', note:'combat',
    blurb:'pure aggression — CQC, hunts the wounded and the leader, swings for knockouts.',
    move:{ center:1.0, rival:1.9, token:0.6, spotlight:0.8, edgeFear:0.5 },
    skillOrder:['shank_skank','junkyard_dog','cosmic_boogaloo','fandom_army','moon_shuffle','amp_1','fans_4eva','amp_2','amp_3'] },
  diva:     { name:'The Diva',     emoji:'✨', note:'clean',
    blurb:'owns the spotlight — holds centre stage, works the crowd, grabs Lost Chords.',
    move:{ center:1.9, rival:0.7, token:1.2, spotlight:1.4, edgeFear:1.2 },
    skillOrder:['fans_4eva','fandom_army','amp_1','junkyard_dog','theory_major','pranksta','amp_2','theory_minor','amp_3'] },
  saboteur: { name:'The Saboteur', emoji:'🪤', note:'disrupt', targetLeader:true,
    blurb:'controls the board — amps & ranged Sonic, unplugs rivals, drains & staggers the leader.',
    move:{ center:0.9, rival:1.1, token:0.8, spotlight:0.9, edgeFear:1.0 },
    skillOrder:['amp_1','pranksta','theory_major','amp_2','theory_minor','fandom_army','theory_dom7','amp_3','theory_modes'] },
};
export const BOT_PERSONA_KEYS = ['maestro','moshlord','diva','saboteur'];

export const BOT_SKILL_PRIORITY_BASE = [
  'fans_4eva', 'shank_skank', 'amp_1', 'junkyard_dog', 'fandom_army',
  'theory_major', 'cosmic_boogaloo', 'amp_2', 'theory_minor', 'pranksta',
  'moon_shuffle', 'theory_dom7', 'amp_3', 'theory_modes', 'theory_chromatic',
];

// Exclusive-route passives, slotted in up front for the spirit that owns them.
export const BOT_SPIRIT_SKILLS = {
  cosmic_ronin:      ['psycho_bushido', 'e_rush'],
  Metalness_Monster: ['azrael', 'master_moshpits', 'paranoia'],
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
 * Pick the juiciest rival to hit from a candidate list (already filtered to
 * those it can actually reach). Priority: close a knockdown first, then lean
 * on the Fame front-runner, then break ties on lowest Vibe.
 * Pure — fame comes from `noteStates`.
 */
export function botPickTarget(candidates, noteStates) {
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => {
    const ka = (a.vibe ?? 99) <= 2 ? 1 : 0;
    const kb = (b.vibe ?? 99) <= 2 ? 1 : 0;
    if (ka !== kb) return kb - ka;
    if (ka && kb)  return (a.vibe ?? 99) - (b.vibe ?? 99);
    const fa = noteStates?.[a.id]?.fame ?? 0;
    const fb = noteStates?.[b.id]?.fame ?? 0;
    if (fb !== fa) return fb - fa;
    return (a.vibe ?? 99) - (b.vibe ?? 99);
  })[0];
}

/**
 * Score a destination hex by everything that actually wins the game.
 * Pure — all data in `ctx` (built by the caller from engine state).
 * ctx: { p (persona), center (hex obj), hurt (bool), myFame, spot (hex obj),
 *        tokens [{num, q, r}], events [{num, q, r}],
 *        rivals [{r (spirit), h (hex), fame}] }
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
