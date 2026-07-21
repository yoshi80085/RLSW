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
import { axialDist, axialNeighbors } from "../../board/hexGeometry.js";
import { skillEligibility } from "../systems/skills.js";
import { usedHas } from "../systems/economy.js";
import { LIMELIGHT_HEX } from "../../data/gameConstants.js";
import { buildScale, getIntervalNotes, pitchIndex } from "../../music/notes.js";
import { cadenceHints } from "../../music/cadence.js";
import { evaluateChord } from "../../music/chords.js";

// ── Constants ───────────────────────────────────────────────────────────────

export const BOT_PERSONALITIES = {
  maestro:  { name:'The Maestro',  emoji:'🎼', note:'musical',
    blurb:'wins on pure musicianship — Theory, clean tracks, cadences & riffs.',
    move:{ center:1.2, rival:0.4, token:1.4, spotlight:1.1, edgeFear:1.6 },
    skillOrder:['theory_major','range_1','theory_minor','amp_1','stance_2','stance_encore','theory_dom7','theory_modes','amp_2','range_2','theory_chromatic','amp_3','range_3'] },
  moshlord: { name:'The Mosh Lord', emoji:'🤘', note:'combat',
    blurb:'pure aggression — Thrash, hunts the wounded and the leader, swings for knockouts.',
    move:{ center:1.0, rival:1.9, token:0.6, spotlight:0.8, edgeFear:0.5 },
    skillOrder:['stance_2','stance_demolition','power_1','stance_3','stance_aftershock','amp_1','theory_major','amp_2','power_2','theory_minor','amp_3','power_3'] },
  diva:     { name:'The Diva',     emoji:'✨', note:'clean',
    blurb:'owns the spotlight — holds centre stage, works the crowd, grabs Lost Chords.',
    move:{ center:1.9, rival:0.7, token:1.2, spotlight:1.4, edgeFear:1.2 },
    skillOrder:['range_1','stance_2','stance_ironclad','amp_1','theory_major','range_2','amp_2','theory_minor','amp_3'] },
  saboteur: { name:'The Saboteur', emoji:'🪤', note:'disrupt', targetLeader:true,
    blurb:'controls the board — ranged Sonic, zoning, drains & staggers the leader.',
    move:{ center:0.9, rival:1.1, token:0.8, spotlight:0.9, edgeFear:1.0 },
    skillOrder:['amp_1','range_1','power_1','stance_2','stance_resonance','theory_major','amp_2','range_2','power_2','stance_sustainwave','theory_minor','theory_dom7','amp_3','range_3','power_3','theory_modes'] },
};
export const BOT_PERSONA_KEYS = ['maestro','moshlord','diva','saboteur'];

// 🧍 Stance-learning preference per persona (Stance rework). First unlearned
// stance in the list is the one a bot picks when a Stance-route tier awards.
export const BOT_STANCE_PREF = {
  maestro:  ['soloist', 'cool', 'groove', 'power'],  // showmanship suits pure musicianship
  moshlord: ['power', 'soloist', 'groove', 'cool'],  // hits harder, dies louder
  diva:     ['cool', 'soloist', 'groove', 'power'],  // untouchable, builds the loyal core
  saboteur: ['groove', 'cool', 'power', 'soloist'],  // patient zoner, controls the board
};

export const BOT_SKILL_PRIORITY_BASE = [
  'amp_1', 'range_1', 'stance_2',
  'theory_major', 'amp_2', 'power_1', 'theory_minor',
  'theory_dom7', 'amp_3', 'range_2', 'power_2', 'stance_3', 'theory_modes', 'theory_chromatic',
  'range_3', 'power_3',
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
export function botSkillEligible(skillId, unlocked, selfId, skillById, stancesKnown = []) {
  const sk = skillById[skillId];
  return skillEligibility(sk, unlocked, {
    ownerRoute: sk ? SPIRIT_ONLY_ROUTE[sk.routeId] : null, selfId, stancesKnown,
  }).ok;
}

/**
 * Pick the next skill the bot should save toward.
 * `personaKey` = the bot's assigned persona key.
 * `skillById` = the SKILL_BY_ID lookup.
 */
export function botPickSkillTarget(selfId, unlocked, personaKey, skillById, stancesKnown = []) {
  const persona = BOT_PERSONALITIES[personaKey];
  const order = [
    ...(BOT_SPIRIT_SKILLS[selfId] ?? []),
    ...(persona?.skillOrder ?? []),
    ...BOT_SKILL_PRIORITY_BASE,
  ];
  for (const id of order) if (botSkillEligible(id, unlocked, selfId, skillById, stancesKnown)) return id;
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
const DISCORD_INTERVAL_MAP = [
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
 * Decide the bot's next note-track action: { slot } to play a stock index,
 * or { commit: true } to lock the track in. Pure over noteState + persona.
 */
export function botPlanNoteStep(noteState, persona) {
  const ns = noteState ?? {};
  const stock = ns.noteStock ?? [];
  const track = ns.melodyLine ?? [];
  const used  = ns.usedStockIdx;
  const NOTE_CAP = 8;
  if (track.length >= NOTE_CAP) return { commit: true };

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

  // A Brawler welcomes ONE tritone in the body — Damage×2 worth the −1 DB.
  if (style === 'combat') {
    const tri = discord.find(i => stock[i] === iv.tritone);
    if (tri != null && track.length < NOTE_CAP - 1 && !body.includes(tri)) body = [...body, tri];
  }

  if (body.length) return { slot: body[0] };
  if (endIdx != null) return { slot: endIdx };
  if (track.length === 0 && discord.length) return { slot: discord[0] };
  return { commit: true };
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
 * Decide whether to revoice a note into the chord stack this turn.
 * Returns the note string to voice, or null to keep the stance.
 * Pure over noteState + spiritId + persona.
 */
export function botPlanRevoice(noteState, spiritId, persona) {
  const ns = noteState ?? {};
  if (ns.revoiceUsedThisTurn) return null;
  const chord = ns.chordStack ?? [];
  if (chord.length >= 5) return null;  // full — v1 bot doesn't churn/drop
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
  // Always replenish a fragile chord (depleted by attacking) even on a tie.
  if (best == null && chord.length < 2) best = cands[0];
  return best;
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

  const me = live.find(s => s.id === self.id) ?? self;
  const spotlightHex = state.board?.spotlightHex;
  const boardTokens = state.board?.boardTokens ?? [];
  const eventHexes = state.board?.eventHexes ?? [];
  const ctx = {
    p:      persona,
    center: HEX_BY_NUM[LIMELIGHT_HEX],
    hurt:   (me.vibe ?? 9) <= Math.ceil((me.maxVibe ?? 5) * 0.4),
    myFame: state.noteStates?.[self.id]?.fame ?? 0,
    spot:   (typeof spotlightHex === 'number') ? HEX_BY_NUM[spotlightHex] : null,
    tokens: boardTokens.map(t => HEX_BY_NUM[t.num]).filter(Boolean),
    events: eventHexes.map(n => HEX_BY_NUM[n]).filter(Boolean),
    rivals: live.filter(s => !s.knockedOut && s.id !== self.id)
      .map(r => ({ r, h: HEX_BY_NUM[r.num], fame: state.noteStates?.[r.id]?.fame ?? 0 }))
      .filter(x => x.h),
  };
  const here = botHexScore(from, ctx);
  const best = neighbors
    .map(h => ({ num: h.num, s: botHexScore(h, ctx) }))
    .sort((a, b) => b.s - a.s)[0];
  return best && best.s > here + 0.5 ? best.num : null;
}
