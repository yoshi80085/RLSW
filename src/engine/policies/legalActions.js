import { bushidoLane } from "../systems/bushido.js";
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
import { slideTarget, trailRun, canCallSlime } from "../systems/slime.js";
import { axialNeighbors, angleTo, angleDiff, getFlatTopNeighborSlots, neighborInDirection } from "../../board/hexGeometry.js";
import { usedHas } from "../systems/economy.js";
import { skillEligibility } from "../systems/skills.js";
import { rigFor } from "../systems/attackParams.js";
import { canCallEleven } from "../systems/eleven.js";
import { canFire } from "../systems/cooldowns.js";
import { canHop, shukuchiLandings } from "../systems/shukuchi.js";
import { posingMap } from "../systems/limelight.js";
import { SPIRIT_DEFS } from "../../data/spirits.js";
import { LIMELIGHT_HEX, STACK_COMMIT_BUDGET, stackCapFor, SMASH_AP_COST, SLIME_AP_COST, SLIME_MOVE_STEPS, SONIC_BEAM_REACH, PSYCHO_BUSHIDO_AP_COST, PSYCHO_BUSHIDO_MIN_RANGE, SHUKUCHI_AP_PER_HOP } from "../../data/gameConstants.js";
import { CONE_HALF_ARC, SPIRIT_ONLY_ROUTE } from "./bot.js";
// 📻 The Boom Box rule — Intergalactic 0 reads distance 0 while charged, which
// is what keeps his Sonic legal out on the board — used to be imported here as
// `distFromHome`. It is now reached through `rigFor`, which is the better
// route: a blown amp reads as out-of-rig on the same call, so 🔊 Goes to 11's
// second cost needs no idea that this file exists. (Dead import removed
// 2026-08-16; it went unused in 1fab215 and lint caught it here.)

// ── Costs and caps, named where the client names them ───────────────────────

export const SWING_AP_COST = 1;   // `resolveSwing`: dispatch(beatsSpent(1, true))
export const SONIC_AP_COST = 2;   // the Sonic button: moveStepsLeft < 2 greys it
export const MOVE_AP_COST  = 1;   // one hex, one step
export const FACE_AP_COST  = 1;   // `applySpiritFaced` default cost
export const MELODY_MAX    = 8;   // `if (melodyLine.length >= 8) return;`
// 🔊 Re-exported, not defined: it moved to `gameConstants` when `evaluate` needed
// the same number to decide what counts as "in reach" (§5 `pressure`). Importers
// that already read it from here keep working.
export { SONIC_BEAM_REACH };

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
 *   · ~~`posing`~~ ✅ engine state since 2026-08-17 — `state.limelight.posing`
 *   · `amps`       [{ hexNum }]          — amp furniture blocks movement, React state
 *   · `shadowHex`  number|null           — 👤 the decoy blocks like a body
 *   · `skillById`  { [id]: skill }       — SKILL_TREE still lives in the monolith
 * @returns {action[]} `{ kind, apCost, ... }`, in no meaningful order
 *
 * Returns `[]` for a Spirit who is not `state.acting`: they have no AP, no
 * token and no turn, and emitting hypothetical actions for them would let a
 * search invent replies the rules never offered.
 */
export function legalActions(state, spiritId, view = {}) {
  const {
    amps = [], shadowHex = null,
    skillById = null,
  } = view;
  const posing = posingMap(state);

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

  // ── 🎯 SKILL TARGETING — phase-agnostic: Db is not AP, and choosing what to
  // save for is not acting.
  //
  // ⚠️ THIS WAS `skillUnlock` AND IT MODELLED A MECHANIC THE GAME DOES NOT HAVE.
  // Until 2026-08-16 this file emitted `{ kind: 'skillUnlock', skillId, dbCost }`
  // gated on `dbPoints >= dbCost`, and `transition.js` paid for it by subtracting
  // the cost and pushing the id into `unlockedSkills` — a shop. There is no shop.
  // The shipped flow is four steps and the monolith spells them out:
  //
  //   1. you pick a TARGET skill  →  `targetSkillId`
  //   2. every Db earned counts toward it (`advanceDB`, overflow carries)
  //   3. the bar fills → the skill is awarded AUTOMATICALLY, inside the commit
  //   4. you pick the next target
  //
  // So the only decision a player ever makes here is step 1, and it is free.
  // The award is `commitMelodyEconomy`'s, and its state half is already modelled.
  //
  // ⚠️ THE INVENTED RULE WAS INVISIBLE FOR THE SAME REASON THE OTHER TWO WERE:
  // this family is emitted only when the caller passes `skillById`, and nothing
  // could until SKILL_TREE left the monolith. `transition.js`'s header warns that
  // a transition inventing a rule "shows up as a bot that is confidently wrong,
  // which is not visible" — this was one, sitting in the pair of files that warn
  // about it. Found by the §6.6 bench: Spirits were filling a 4 Db bar over and
  // over (the no-target fallback) and never receiving a single skill.
  //
  // ⚠️ NO Db GATE. You may save toward anything you are ELIGIBLE for, however
  // broke you are — that is what saving means. Gating on affordability was part
  // of the shop fiction, and it hid every capstone from the searcher precisely
  // when deciding to aim at one is the interesting decision (§3.2).
  //
  // ⚠️ AND IT IS OFFERED ONLY WHEN THERE IS NO TARGET — which is the client's
  // own flow ("skill awarded automatically, overlay opens to pick next"), and
  // also the only version of this that TERMINATES. A free, unlimited re-aim is a
  // zero-cost action that changes the position — `dbHorizon` divides by the
  // target's cost — so a greedy searcher will re-aim, re-score, re-aim forever
  // and burn the whole turn without touching the board. The §6.6 harness hit its
  // per-turn ceiling on the first run after this family went live, which is
  // exactly what that ceiling is for.
  if (skillById && !ns.targetSkillId) {
    const unlocked = ns.unlockedSkills ?? [];
    for (const [id, skill] of Object.entries(skillById)) {
      if (!skill) continue;
      // ⚠️ `skill.spiritOnly` WAS ALWAYS `undefined` UNTIL 2026-08-16, so this
      // gate could never fire — the old round-trip through `SPIRIT_ONLY_ROUTE`
      // was searching a map BY OWNER to recover the owner it already had, off a
      // field the tree builder never populated. `SKILL_BY_ID` now pushes the
      // route's owner down onto every skill, so the honest read is the direct
      // one. Falls back to the route map for any caller passing a hand-built
      // `skillById` that predates the push-down.
      const ownerRoute = skill.spiritOnly ?? SPIRIT_ONLY_ROUTE[skill.routeId] ?? null;
      if (!skillEligibility(skill, unlocked, { ownerRoute, selfId: spiritId }).ok) continue;
      out.push({ kind: 'skillTarget', skillId: id, dbCost: skill.dbCost, apCost: 0 });
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
      // is FOUND on the board (3 → 6 as each stack's seats are opened), never a
      // flat 5. ⚠️ AND IT IS READ PER STACK NOW — Drive and Sustain have
      // different roots, so they open their seats independently and one being
      // full says nothing about the other.
      const commitsLeft = STACK_COMMIT_BUDGET - (ns.stackCommitsThisTurn ?? 0);
      if (commitsLeft > 0) {
        for (const dest of ['drive', 'sustain']) {
          const cap   = stackCapFor(ns, dest);
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

  // 🌀 SHUKUCHI ARPEGGIO — the same 1 AP as a step, for two hexes and no regard
  // for what is in between (`RONIN_ABILITY_DESIGN.md` §2.5.0).
  //
  // ⚠️ IT SITS BESIDE `move`, NOT INSIDE THE SKILL BLOCK BELOW, and the placement
  // is the rule. Shukuchi is not an action he takes INSTEAD of moving — it is
  // what a move step buys while it is up, billed from the same pool. Emitting it
  // here is what makes a line like [hop, hop, swing] reachable to the searcher;
  // in the ability block it would read as a one-shot and the beam would price it
  // against Bushido rather than against walking.
  //
  // 💿🕒 `canHop` asks the Db-and-clock question ONCE, and asks the right one:
  // the first hop needs `canFire`, the second and third need only the budget on
  // the sheet. ⚠️ A continuation that re-checked `canFire` would find the clock
  // it just started and refuse — a three-hop ability that could only ever hop
  // once. See `shukuchi.js`.
  //
  // 📌 `blocked` is passed for the LANDING only. `shukuchiLandings` never looks
  // between the two hexes, which is the whole ability.
  if (here && ap >= SHUKUCHI_AP_PER_HOP && canHop(ns)) {
    for (const to of shukuchiLandings(state, spiritId, blocked)) {
      out.push({ kind: 'shukuchi', to, apCost: SHUKUCHI_AP_PER_HOP });
    }
  }

  // 🔊 GOES TO 11 — free to call, and priced in Sustain and silence instead.
  //
  // ⚠️ NO AP COST, and that is not generosity. §1's spine is that AP buys hexes
  // and violence; this buys neither. It spends the Sustain stack (the stat §0
  // says nothing in his kit ever read) and one turn of his rig. Charging AP as
  // well would make the loudest turn in the game also the one where he cannot
  // reach anybody, which is not a trade-off, it is a refusal.
  //
  // ⚠️ GATED ON THE ACTION TOKEN because setting your attack stat AFTER you have
  // attacked does nothing at all — offering it there would be offering a button
  // that lies. And gated on a non-empty Sustain stack by `canCallEleven`: if the
  // price is "your Sustain stack", an empty stack makes it free.
  if (!tokenSpent && ns.hasConfirmed && canCallEleven(state, spiritId)
      && (ns.unlockedSkills ?? []).includes('goes_to_11')) {
    out.push({ kind: 'eleven', apCost: 0 });
  }

  // 🧪 SLIME — call the ooze. 1 AP, once a turn, and movement BECOMES 3.
  //
  // ⚠️ INNATE, so there is no `unlockedSkills` gate here. `CHARACTER_HANDOFF`
  // lists "arsenal, no innate identity" as the gap this whole rework exists to
  // close; charging Db for the road as well as AP would re-open it, and a Spirit
  // whose signature is a purchase has no signature until he can afford one.
  //
  // ⚠️ BUT INNATE MEANS NO PURCHASE, NOT NO OWNER — and getting that wrong is
  // how this gate shipped open. Until 2026-08-16 the only thing standing between
  // any Spirit and the ooze was a JSX render condition
  // (`acting?.id === 'Metalness_Monster'`), which this file had nothing to
  // transcribe from. No player could reach it; the §6.6 harness reached it on
  // its first headless match and had the Ronin laying road. Ownership now lives
  // in `canCallSlime` beside the rest of the trail rules — see its header.
  //
  // ⚠️ THE `slimingId` CHECK IS THE ONCE-PER-TURN RULE and it is doing real work.
  // Because the call SETS movement rather than adding to it, a second call would
  // top the pool back up to 3 for 1 AP — repeatable, so 1 AP would buy 2 net
  // steps for as long as the AP held out. That is a movement engine, not an
  // ability, and the ceiling on his road (§3's whole currency premise) would go
  // with it.
  //
  // ⚠️ Emitted with `apGranted` for the same reason `confirmMelody` is: this
  // action REWRITES the budget every action after it spends from, and a searcher
  // that priced it as "-1 AP" would have the sign wrong on a bad melody, where
  // calling it is a net GAIN of steps.
  if (canCallSlime(spiritId) && !turn.slimingId && ap >= SLIME_AP_COST) {
    out.push({ kind: 'slime', apCost: SLIME_AP_COST, apGranted: SLIME_MOVE_STEPS });
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

  // ── ATTACKS — at most ONE per turn (`actionTokenUsed`).
  if (!tokenSpent) {
    const cone = swingCone(self);
    const beam = sonicBeam(self);

    // 🌀 PSYCHO BUSHIDO — the Iaijutsu dash, and the Ronin's only ranged opener.
    //
    // Straight down the facing line, stopping at the FIRST body: a charge does not
    // curve and it does not pass through people. The blow is a Swing — same token,
    // same dice — so this emits a target and a distance and lets `transition.js`
    // fall through into the combat path rather than growing a second one.
    //
    // ⚠️ THE DISTANCE IS THE PAYLOAD, NOT THE COST OF REACHING IT. It selects a
    // rung of `PSYCHO_BUSHIDO_DRIVE_LADDER`, so a long charge hits harder.
    //
    // ⭐ AND SINCE 2026-09-04f THERE IS A MINIMUM RANGE, WHICH THERE DELIBERATELY
    // WAS NOT BEFORE. The old rule let the close charge be legal and merely bad
    // (it spent the whole AP pool for +0). The bill is now FLAT, so "bad" would
    // have become "free" — a flat 3 AP charge from next door would be a Swing
    // with a Drive bonus attached. §2.1.1: the window is the legality rule.
    // ⚠️ A BODY INSIDE THE WINDOW STILL BLOCKS THE LANE WITHOUT BEING A TARGET,
    // which is what makes standing at range 2 a defence against this ability —
    // and what makes the 👤 decoy worth parking in front of a Ronin.
    //
    // 📌 GATED ON THE SKILL, NOT ON THE SPIRIT. `psycho_bushido` is `spiritOnly`
    // in the tree, so the roster gate already exists one layer up; reading the
    // unlock here keeps this file's contract ("what is legal") free of a
    // hard-coded name it would have to keep in step.
    // 💿 AND GATED ON Db AS WELL AS ON THE CLOCK since 2026-08-22. `canFire`
    // asks both questions at once deliberately — a generator that emitted a move
    // the resolver would then refuse for want of 1 Db is a searcher planning
    // turns it cannot play, and the refusal happens after the dash has already
    // committed the turn.
    if (ap >= PSYCHO_BUSHIDO_AP_COST
        && (ns.unlockedSkills ?? []).includes('psycho_bushido')
        && canFire(ns, 'psycho_bushido')) {
      for (const step of bushidoLane(self, blocked)) {
        if (!blocked.has(step.num)) continue;
        const rival = rivals.find(x => x.num === step.num);
        if (rival && step.dist >= PSYCHO_BUSHIDO_MIN_RANGE) {
          out.push({ kind: 'psychoBushido', targetId: rival.id, to: step.to, dist: step.dist, apCost: PSYCHO_BUSHIDO_AP_COST });
        }
        break;
      }
    }

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
    // ⚠️ THROUGH `rigFor`, NOT `sonicRig` DIRECTLY — that is what makes a blown
    // amp mean OFFLINE here rather than merely weaker. `rigFor` reports a Spirit
    // with a blown rig as out-of-range wherever he stands, so 🔊 Goes to 11's
    // second cost lands on exactly the gate §3.1 already built, and this file
    // needs no idea that the ability exists.
    if (ap >= SONIC_AP_COST) {
      const { inRange } = rigFor(self, ns, state);
      if (inRange) {
        for (const r of rivals) {
          if (!beam.has(r.num)) continue;
          // 🎤 THE RIFF-OFF IS THE SAME BUTTON, and that is why it is emitted in
          // PLACE of the Sonic rather than alongside it.
          //
          // ⚠️ EMITTING BOTH WOULD BE THE §5b BUG ALL OVER AGAIN. The client has
          // no separate riff-off action: `resolveSonic` checks these conditions
          // and, if they hold, the Sonic BECOMES a duel — the player never gets
          // to decline it. A generator that offered a plain `sonic` on a
          // beam-to-beam target would be over-permissive in exactly the way §5b
          // catalogues, and the searcher would happily plan a line no player can
          // take. One target, one action, whichever the rules say it is.
          //
          // Three conditions, all required, transcribed from `resolveSonic`:
          //   1. they sit in my beam (true to get here),
          //   2. I sit in THEIRS — beam-to-beam down the same line,
          //   3. their rig is live. A rival caught outside their own amp radius
          //      has nothing to answer with, so there is no duel: the beam just
          //      lands and they scramble a d4.
          // Plus: a posing Spirit cannot answer either — they are mid-pose with
          // their guard down, which is the trade §3.3 already priced.
          const rns  = state.noteStates?.[r.id] ?? {};
          const duel = !posing[r.id] && sonicBeam(r).has(self.num) && rigFor(r, rns, state).inRange;
          out.push(duel
            ? { kind: 'riffOff', targetId: r.id, apCost: SONIC_AP_COST }
            : { kind: 'sonic',   targetId: r.id, apCost: SONIC_AP_COST });
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
