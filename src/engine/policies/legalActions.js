// ─── LEGAL ACTIONS ──────────────────────────────────────────────────────────
// `legalActions(state, spiritId, view) -> action[]` — BOT_STRATEGY_HANDOFF §6.1.
//
// The piece every other part of the searcher was blocked on. Everything in
// `policies/bot.js` is a *chooser* — `botPlanMove` returns ONE hex,
// `botPlanNoteStep` returns ONE step, `botPickTarget` returns ONE target. A
// chooser cannot be searched: by the time you have its answer it has already
// thrown away the branches you wanted to look at. This returns the branches.
//
// PURE, and deliberately DUMB. It answers "what is legal", never "what is
// good" — ranking is `evaluate.js`'s job and beaming is `beamActions`'s. Any
// preference smuggled in here would be invisible to tuning, because the
// harness only ever sees the actions that survived.
//
// ⚠️ THE CONTRACT THAT MATTERS: an action emitted here MUST be one the client
// would actually accept. A single over-permissive gate and the searcher plans
// lines the game will refuse, the bot stalls mid-turn, and the failure surfaces
// as "the bot is bad" rather than "the bot is wrong". Every gate below is
// transcribed from the shipped handler, cited by name, and pinned in
// `legalActionsCheck.mjs`. When a rule moves, this file moves with it.
//
// ── THE TURN HAS TWO PHASES, AND THAT IS THE WHOLE SHAPE ────────────────────
// `hasConfirmed` splits a turn cleanly in half, and the split IS §1's spine:
//
//   COMPOSITION (before confirm) — you spend stock. Notes to the Melody Line,
//     up to STACK_COMMIT_BUDGET notes to the stacks. Nothing on the board moves.
//     Confirming converts the melody into AP: `usableMoves = min(len, speed)`.
//     ⚠️ The melody you commit literally buys your ability to act, so the
//     composition phase is not a warm-up — it is the budget decision.
//
//   ACTION (after confirm) — you spend AP. Movement and violence out of one
//     pool, and exactly ONE attack, because `actionTokenUsed` is a single token.
//
// That second fact collapses the branching enormously and is easy to miss:
// a turn contains at most one Swing OR Sonic OR Smash, ever. An evaluator that
// searches two attacks in a turn is searching a game that does not exist.

import { HEX_BY_NUM, HEX_BY_QR } from "../../board/hexMap.js";
import { slideTarget, trailRun } from "../systems/slime.js";
import { axialNeighbors, angleTo, angleDiff, getFlatTopNeighborSlots, neighborInDirection } from "../../board/hexGeometry.js";
import { usedHas } from "../systems/economy.js";
import { skillEligibility } from "../systems/skills.js";
import { sonicRig } from "../systems/sonicRig.js";
import { SPIRIT_DEFS } from "../../data/spirits.js";
import { LIMELIGHT_HEX, STACK_COMMIT_BUDGET, stackCapFor, SMASH_AP_COST } from "../../data/gameConstants.js";
import { CONE_HALF_ARC, SPIRIT_ONLY_ROUTE } from "./bot.js";
// 📻 distFromHome carries the Boom Box rule with it — Intergalactic 0 reads
// distance 0 while charged, which is exactly what keeps his Sonic legal out
// on the board. Shared with evaluate.js so the innate has one implementation.
import { distFromHome } from "./evaluate.js";

// ── Costs and caps, named where the client names them ───────────────────────

export const SWING_AP_COST = 1;   // `resolveSwing`: dispatch(beatsSpent(1, true))
export const SONIC_AP_COST = 2;   // the Sonic button: moveStepsLeft < 2 greys it
export const MOVE_AP_COST  = 1;   // one hex, one step
export const FACE_AP_COST  = 1;   // `applySpiritFaced` default cost
export const MELODY_MAX    = 8;   // `if (melodyLine.length >= 8) return;`
export const SONIC_BEAM_REACH = 3; // flat 3 for everyone since Sunbeam stopped being a range capstone

// ── Geometry, mirrored from the client ──────────────────────────────────────

/**
 * The Swing cone: the forward hex plus its two diagonal-forward neighbours.
 * Mirrors `getSwingCone`. The half-arc is imported from `bot.js` rather than
 * re-typed so there is exactly one number to retune.
 */
export function swingCone(spirit) {
  const hex = HEX_BY_NUM[spirit?.num];
  if (!hex) return new Set();
  const cone = new Set();
  for (const nb of getFlatTopNeighborSlots(hex)) {
    if (angleDiff(angleTo(hex, nb), spirit.facing ?? 0) <= CONE_HALF_ARC) cone.add(nb.num);
  }
  return cone;
}

/**
 * 🐙 THE TENTACLE — every way the Monster can strike from his own trail.
 * `METALNESS_REWORK_DESIGN.md` §4a. Returns one entry per reachable ORIGIN:
 * `{ origin, spend, reach, cone }`.
 *
 * ⚠️ **THE ARM HAS ITS OWN FACING, AND IT IS THE ROAD.** A cone needs a
 * direction and he never turns, so the direction is the one the tentacle
 * travelled to arrive: from the previous hex of the run into the origin. That
 * keeps the Swing's existing cone geometry (one `CONE_HALF_ARC` to retune), and
 * it makes HOW HE LAID THE TRAIL into the decision — §2's "his movement is an
 * attack", turned into something a player can aim.
 *
 * ⚠️ **REACH IS PRICED BY INDEX.** Striking from `run[k]` consumes `run[0..k]`,
 * so the far origin costs the whole road. §4a's four jobs all fall out of that
 * one rule: range is priced, it competes with the Slide and the Slam, rivals
 * can COUNT the threat because the road is public, and the branching stays
 * bounded by trail length rather than by board size.
 *
 * A body standing on the trail does NOT block the arm — it slithers along the
 * ground past ankles. (It does block the SLIDE, which is a body moving.)
 */
export function tentacleOptions(state, self) {
  const run = trailRun(state, self?.id);
  const out = [];
  for (let k = 0; k < run.length; k++) {
    const originHex = HEX_BY_NUM[run[k]];
    const prevHex   = HEX_BY_NUM[k === 0 ? self.num : run[k - 1]];
    if (!originHex || !prevHex) break;
    out.push({
      origin: run[k],
      spend:  run.slice(0, k + 1),
      reach:  k + 1,
      cone:   swingCone({ num: run[k], facing: angleTo(prevHex, originHex) }),
    });
  }
  return out;
}

/**
 * The Sonic beam: a STRAIGHT line of 3, not a cone. Mirrors `getSonicBeam`,
 * including the trick that keeps it straight — lock the axial step in from the
 * first forward neighbour and repeat it, rather than re-deriving a direction
 * per hex, which staircases.
 */
export function sonicBeam(spirit) {
  const origin = HEX_BY_NUM[spirit?.num];
  if (!origin) return new Set();
  const first = neighborInDirection(origin, spirit.facing ?? 0);
  if (!first) return new Set();
  const dq = first.q - origin.q, dr = first.r - origin.r;
  const beam = new Set();
  let q = origin.q, r = origin.r;
  for (let depth = 0; depth < SONIC_BEAM_REACH; depth++) {
    q += dq; r += dr;
    const hex = HEX_BY_QR[`${q},${r}`];
    if (!hex) break;          // the beam runs off the edge of the stage
    beam.add(hex.num);
  }
  return beam;
}

/** The six facings a Spirit can turn to, as angles to each neighbouring hex. */
export function facingOptions(spirit) {
  const hex = HEX_BY_NUM[spirit?.num];
  if (!hex) return [];
  return getFlatTopNeighborSlots(hex).map(nb => angleTo(hex, nb));
}

// ── The generator ───────────────────────────────────────────────────────────

/**
 * Every action `spiritId` may legally take right now.
 *
 * @param {object} state     engine GameState
 * @param {string} spiritId  the acting Spirit (non-acting Spirits get [] — see below)
 * @param {object} [view]    client-owned slices this cannot read off the engine:
 *   · `posing`     { [id]: bool }        — §3.3, React state
 *   · `amps`       [{ hexNum }]          — amp furniture blocks movement, React state
 *   · `shadowHex`  number|null           — 👤 the decoy blocks like a body
 *   · `skillById`  { [id]: skill }       — SKILL_TREE still lives in the monolith
 *   · `rockGodActive` bool               — PvP is off during the God fight
 * @returns {action[]} `{ kind, apCost, ... }`, in no meaningful order
 *
 * Returns `[]` for a Spirit who is not `state.acting`: they have no AP, no
 * token and no turn, and emitting hypothetical actions for them would let a
 * search invent replies the rules never offered.
 */
export function legalActions(state, spiritId, view = {}) {
  const {
    posing = {}, amps = [], shadowHex = null,
    skillById = null, rockGodActive = false,
  } = view;

  const self = (state?.spirits ?? []).find(s => s.id === spiritId);
  if (!self || self.knockedOut) return [];
  if (state?.acting !== spiritId) return [];
  if (state?.winner) return [];

  const ns   = state?.noteStates?.[spiritId] ?? {};
  const def  = SPIRIT_DEFS[spiritId] ?? {};
  const turn = state?.turn ?? {};
  const ap   = turn.moveStepsLeft ?? 0;
  const tokenSpent = !!turn.actionTokenUsed;
  const out = [];

  // ── SKILL UNLOCKS — phase-agnostic: Db is not AP and buying is not acting.
  // Gated on `skillById` because SKILL_TREE has not been extracted from the
  // monolith yet; without it this family is simply absent rather than guessed.
  if (skillById) {
    const unlocked = ns.unlockedSkills ?? [];
    const db = ns.dbPoints ?? 0;
    for (const [id, skill] of Object.entries(skillById)) {
      if (!skill || (skill.dbCost ?? Infinity) > db) continue;
      const ownerRoute = Object.entries(SPIRIT_ONLY_ROUTE)
        .find(([, owner]) => owner === skill.spiritOnly)?.[1] ?? skill.spiritOnly ?? null;
      if (!skillEligibility(skill, unlocked, { ownerRoute, selfId: spiritId }).ok) continue;
      out.push({ kind: 'skillUnlock', skillId: id, dbCost: skill.dbCost, apCost: 0 });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // COMPOSITION PHASE — spending stock, before the melody is confirmed.
  // ═════════════════════════════════════════════════════════════════════════
  if (!ns.hasConfirmed) {
    const stock  = ns.noteStock ?? [];
    const used   = ns.usedStockIdx;
    const track  = ns.melodyLine ?? [];
    const unused = stock.map((n, i) => ({ note: n, idx: i })).filter(({ idx }) => !usedHas(used, idx));

    // ⚡ A pending Major/Minor declaration freezes every note action — the
    // client refuses both the melody and the stack until it is answered.
    if (!ns.pivotPending) {
      // Melody notes. Each one is +1 potential AP, capped by speed at confirm.
      if (track.length < MELODY_MAX) {
        for (const { note, idx } of unused) {
          out.push({ kind: 'melodyNote', stockIdx: idx, note, apCost: 0 });
        }
      }

      // Stack commits. TWO independent ceilings, and conflating them is the
      // classic bug: `stackCommitsThisTurn` is a per-TURN budget of 3 shared
      // across both stacks, while `stackCapFor()` is a per-STACK capacity that
      // is EARNED (3 → 6 on Theory rungs), never a flat 5.
      const commitsLeft = STACK_COMMIT_BUDGET - (ns.stackCommitsThisTurn ?? 0);
      if (commitsLeft > 0) {
        const cap = stackCapFor(ns.unlockedSkills ?? []);
        for (const dest of ['drive', 'sustain']) {
          const stack = (dest === 'sustain' ? ns.sustainStack : ns.driveStack) ?? [];
          if (stack.length >= cap) continue;
          for (const { note, idx } of unused) {
            out.push({ kind: 'stackCommit', dest, stockIdx: idx, note, apCost: 0 });
          }
        }
      }
    }

    // Confirming is only legal with something to confirm, and it is the single
    // most consequential action in the turn: it fixes the AP budget for
    // everything that follows. `apGranted` is surfaced so a searcher can price
    // the commit without re-deriving §1's rule.
    if (track.length > 0) {
      out.push({
        kind: 'confirmMelody',
        apCost: 0,
        apGranted: Math.min(track.length, def.speed ?? 5),
      });
    }
    return out;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ACTION PHASE — spending AP, after the melody is confirmed.
  // ═════════════════════════════════════════════════════════════════════════

  const here    = HEX_BY_NUM[self.num];
  const rivals  = (state.spirits ?? []).filter(s => s.id !== spiritId && !s.knockedOut);
  const blocked = new Set([
    ...rivals.map(s => s.num),
    ...(amps ?? []).map(a => a.hexNum),
    ...(shadowHex != null ? [shadowHex] : []),   // 👤 the decoy blocks like a body
  ]);

  // MOVEMENT — one hex at a time into an unoccupied neighbour.
  if (here && ap >= MOVE_AP_COST) {
    for (const { q, r } of axialNeighbors(here.q, here.r)) {
      const h = HEX_BY_QR[`${q},${r}`];
      if (h && !blocked.has(h.num)) out.push({ kind: 'move', to: h.num, apCost: MOVE_AP_COST });
    }
  }

  // 🧪 THE SLIDE — free retreat BACKWARDS along your own slime trail.
  //
  // ⚠️ IT IS NOT GATED ON `ap`, AND THAT IS THE POINT. §1's spine is that every
  // hex costs AP; this is the one exception the Monster's innate exists to be,
  // and a searcher that never sees it will conclude he is simply slow. §2: his
  // old innate rewarded moving while speed 4 punished it, so his identity fought
  // his win path — now moving generates movement.
  //
  // ⚠️ It is also not gated on the ACTION TOKEN, which is what makes him "the
  // only melee Spirit who can hit and leave" (§2). Swing, then slide out. A
  // searcher that only offers the slide before an attack has deleted the line
  // the ability was designed around.
  //
  // The destination is `slideTarget` — always one hex, always the one he most
  // recently vacated, and it consumes that slime. Sliding is therefore priced
  // against the Tentacle's reach and the Slam's fuel (§3's one meter), which is
  // why there is no `apCost` here but there IS a real cost.
  {
    const slideTo = slideTarget(state, spiritId);
    if (slideTo != null && !blocked.has(slideTo)) {
      out.push({ kind: 'slide', to: slideTo, apCost: 0 });
    }
  }

  // FACING — costs a full AP, i.e. a hex you will not walk.
  //
  // ⚠️ NOT gated on the attack token, and the reason is easy to get wrong.
  // Facing looks like a pure targeting decision, but `isRearHit` reads it on
  // DEFENCE too: a blow landing in your rear wedge strips an extra Sustain
  // note. So turning to face a threat is a real play with the token already
  // spent — it is the last thing a bot should do before ending a turn next to
  // something dangerous, and `botPlanMove`'s rearFear term already knows it.
  // Gating this on `!tokenSpent` would silently delete that whole line of play.
  if (here && ap >= FACE_AP_COST) {
    for (const facing of facingOptions(self)) {
      if (angleDiff(facing, self.facing ?? 0) < 1e-9) continue;   // already looking there
      out.push({ kind: 'face', facing, apCost: FACE_AP_COST });
    }
  }

  // ── ATTACKS — at most ONE per turn (`actionTokenUsed`), and PvP is switched
  // off entirely while the Rock God is on the board: the table is united.
  if (!tokenSpent && !rockGodActive) {
    const cone = swingCone(self);
    const beam = sonicBeam(self);

    // SWING — 1 AP, the cone.
    if (ap >= SWING_AP_COST) {
      for (const r of rivals) {
        if (cone.has(r.num)) out.push({ kind: 'swing', targetId: r.id, apCost: SWING_AP_COST });
      }
    }

    // 🐙 THE TENTACLE — the same 1 AP jab, launched from a hex on his trail.
    //
    // ⚠️ EVERY (rival × origin) PAIR IS EMITTED, NOT JUST THE CHEAPEST REACH,
    // and that is §6a's rule rather than an oversight: this file answers what is
    // LEGAL, never what is good. Emitting only the shortest reach would smuggle
    // a preference in where tuning can never see it — and the longer reach is
    // sometimes the better play, because it strikes from a different angle.
    //
    // ⚠️ THIS IS WHAT MAKES `beamActions`' NULL `score` A BLOCKER. §6 predicted
    // it: cone-from-each-trail-hex multiplies his jab branches by trail length,
    // and an unranked beam is just "the first 5", so a long trail would push
    // real options off the end of an arbitrary list. `spend` and `reach` ride on
    // each action so a scorer can price them the moment one exists.
    if ((ns.unlockedSkills ?? []).includes('tentacle')) {
      for (const opt of tentacleOptions(state, self)) {
        for (const r of rivals) {
          if (!opt.cone.has(r.num)) continue;
          out.push({
            kind: 'tentacle', targetId: r.id, apCost: SWING_AP_COST,
            origin: opt.origin, spend: opt.spend, reach: opt.reach,
          });
        }
      }
    }

    // SONIC — 2 AP, the straight beam, and OFFLINE outside your own rig radius.
    // That last gate is §3.1's worst square made concrete: stranded, the ranged
    // attack simply is not available to you.
    if (ap >= SONIC_AP_COST) {
      const chargeBoost = (ns.chargeCeilTurns ?? 0) > 0 ? 1 : 0;
      const { inRange } = sonicRig(ns.unlockedSkills ?? [], distFromHome(self, ns), chargeBoost);
      if (inRange) {
        for (const r of rivals) {
          if (beam.has(r.num)) out.push({ kind: 'sonic', targetId: r.id, apCost: SONIC_AP_COST });
        }
      }
    }

    // SMASH / 🌀 BLASTER OF RA — 2 AP, and it ENDS ALL REMAINING MOVEMENT, so
    // `apCost` alone understates it. `endsMovement` is flagged rather than
    // folded into the cost because the searcher has to know the difference
    // between "2 AP" and "2 AP and everything after it".
    //
    // The Blaster REPLACES the Smash for Intergalactic 0 — different geometry
    // (the beam, piercing every rival in line) and a different fuel bar (2
    // unused notes, no Drive-stack requirement).
    if (ap >= SMASH_AP_COST) {
      const unusedCount = (ns.noteStock ?? []).filter((_, i) => !usedHas(ns.usedStockIdx, i)).length;
      const hasBlaster = spiritId === 'intergalactic_0' && (ns.unlockedSkills ?? []).includes('blaster_of_ra');

      if (hasBlaster) {
        if (unusedCount >= 2) {
          const struck = rivals.filter(r => beam.has(r.num)).map(r => r.id);
          if (struck.length) {
            out.push({ kind: 'blaster', targetIds: struck, apCost: SMASH_AP_COST, endsMovement: true });
          }
        }
      } else if (unusedCount >= 1 && (ns.driveStack ?? []).length >= 1) {
        // 🎸 The fuel gate: the Smash IS your chord, swung. No stack, no haymaker.
        for (const r of rivals) {
          if (cone.has(r.num)) {
            out.push({ kind: 'smash', targetId: r.id, apCost: SMASH_AP_COST, endsMovement: true });
          }
        }
      }
    }
  }

  // 🎤 STRIKE A POSE — free to open, but it is a COMMITMENT, not a tap: no
  // defence die at all until it breaks (§3.3). Legal only standing on the
  // Limelight and not already posing; it resolves at end of turn.
  if (self.num === LIMELIGHT_HEX && !posing[spiritId]) {
    out.push({ kind: 'pose', apCost: 0 });
  }

  // Always legal, and always last: you may stop.
  out.push({ kind: 'endTurn', apCost: 0 });
  return out;
}

// ── Beaming (§6.3) ──────────────────────────────────────────────────────────

/**
 * Cap the branching factor without ever losing an option CLASS.
 *
 * §6.3 asks for a beam rather than full width, and note-track construction is
 * the reason: it is combinatorial and will blow up a naive tree. But a beam
 * that simply takes the global top N silently deletes whole kinds of play —
 * with twenty melody notes on offer, the top 5 are all melody notes and the bot
 * stops being able to consider attacking at all.
 *
 * So the beam is PER KIND: each kind keeps its own best `limit`, which bounds
 * the tree while guaranteeing that if a Smash was legal, a Smash is still on
 * the table. Kinds are returned in their first-seen order so the output stays
 * deterministic — a beam that reorders under an equal-score tie would break the
 * §6.6 determinism regression, and it would break it intermittently, which is
 * the worst way for it to break.
 *
 * @param {action[]} actions
 * @param {object}   opts
 *   · `limit`  max per kind (default 5)
 *   · `score`  (action) => number, higher is better. Omitted = keep first-seen.
 */
export function beamActions(actions, { limit = 5, score = null } = {}) {
  const byKind = new Map();
  for (const a of actions ?? []) {
    if (!byKind.has(a.kind)) byKind.set(a.kind, []);
    byKind.get(a.kind).push(a);
  }
  const out = [];
  for (const group of byKind.values()) {
    if (!score || group.length <= limit) { out.push(...group.slice(0, limit)); continue; }
    // Decorate-sort-undecorate with the original index as the tie-break, so
    // equal scores keep source order instead of depending on sort stability.
    const ranked = group
      .map((a, i) => ({ a, i, s: score(a) }))
      .sort((x, y) => (y.s - x.s) || (x.i - y.i))
      .slice(0, limit)
      .map(({ a }) => a);
    out.push(...ranked);
  }
  return out;
}

/** Count of distinct action kinds available — a cheap "how stuck am I" read. */
export function actionKinds(actions) {
  return [...new Set((actions ?? []).map(a => a.kind))];
}
