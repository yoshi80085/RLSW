// ─── ENGINE SYSTEM: THE FOUR SPOTLIGHTS ─────────────────────────────────────
// Alex, 2026-09-25. One light shines from each corner of the arena. Each is
// OWNED by the seat in that corner, parks on one hex of its own quarter for a
// whole round, and steps to a neighbouring hex of that quarter at round end.
//
//   🏠 your own light   — attack from under it: +1 Drive (one more die).
//                         Pose under it: heal Vibe (more the more hurt you are).
//   🎯 a rival's light  — pose under it and survive: steal a few Casual fans.
//   👻 nobody's light   — (a seat nobody sits in, or a teammate's) is scenery.
//
// Striking a pose under a light costs SPOTLIGHT_POSE_SUSTAIN_COST at once and
// pays NO Fame (only the Limelight does). The pose is judged at the start of the
// poser's NEXT turn: still standing on that hex and still posing → it lands.
//
// ⚠️ THE VERDICT IS "STILL ON THE HEX YOU POSED ON", NOT "STILL IN THE LIGHT".
// The lights move once per round and exactly one round boundary falls between
// any Spirit's turn and their next one, so the light has ALWAYS moved on by the
// time the pose is judged. A rule that asked for the light would never pay.
//
// ⚠️ THE POOLS ARE THE HEXES THE OLD DECORATIVE LIGHTS ALREADY SWEPT. Alex asked
// for the lights to cover "the range of hexes they currently do". The 3D scene
// swept each target over x ∈ ±[1.8, 5.4], z ∈ ±[0.9, 3.5] (world units, see
// `board/arenaEnvironment.js`); `hexWorld` below is the same projection as
// `arenaVisuals.js`. That box holds six hexes per quarter, and the four sets
// are disjoint, which is what makes "two lights never share a hex" true by
// construction rather than by a check someone could forget.
//
// Rules for this file: plain JSON in, plain JSON out; randomness only through a
// FORKED rng keyed on the match seed and the round, so moving the lights never
// draws from the main stream and cannot shift any other seeded outcome.

import { ALL_HEXES, HEX_BY_NUM } from "../../board/hexMap.js";
import { axialDist } from "../../board/hexGeometry.js";
import { makeRng } from "../rng.js";
import {
  LIMELIGHT_HEX, SPOTLIGHT_POSE_SUSTAIN_COST, SPOTLIGHT_HOME_DRIVE,
  SPOTLIGHT_HEAL_LADDER, SPOTLIGHT_STEAL_CASUALS, POSE_SUSTAIN_PENALTY,
  addCasuals,
} from "../../data/gameConstants.js";

/** Corner → which quarter its light shines on. Matches the corners' home hexes
 *  (blue 7 and purple 12 on the left, yellow 100 and red 105 on the right). */
export const SPOTLIGHT_QUARTERS = {
  blue:   { sx: -1, sz: -1 },
  purple: { sx: -1, sz:  1 },
  yellow: { sx:  1, sz: -1 },
  red:    { sx:  1, sz:  1 },
};
export const SPOTLIGHT_ORDER = ["blue", "purple", "yellow", "red"];

const hexWorld = h => ({ x: (h.px - 3255) / 200, z: (h.py - 2415) / 200 });

/** The six-ish hexes one corner's light may stand on. */
function poolFor({ sx, sz }) {
  return ALL_HEXES
    .filter(h => !h.edge && h.num !== LIMELIGHT_HEX)
    .filter(h => {
      const p = hexWorld(h);
      const X = p.x * sx, Z = p.z * sz;
      return X >= 1.35 && X <= 5.85 && Z >= 0.45 && Z <= 3.95;
    })
    .map(h => h.num);
}

export const SPOTLIGHT_POOLS = Object.fromEntries(
  SPOTLIGHT_ORDER.map(c => [c, poolFor(SPOTLIGHT_QUARTERS[c])]));

const dist = (a, b) => {
  const ha = HEX_BY_NUM[a], hb = HEX_BY_NUM[b];
  return ha && hb ? axialDist(ha.q, ha.r, hb.q, hb.r) : Infinity;
};

/** Opening positions: one seeded pick per pool, on a forked stream. */
export function makeSpotlights(seed) {
  const rng = makeRng(seed >>> 0).fork("spotlightsInit");
  return Object.fromEntries(SPOTLIGHT_ORDER.map(c => [c, rng.pick(SPOTLIGHT_POOLS[c])]));
}

/** Where every light is now, or null for a state from before the lights. */
export function spotlightsOf(state) {
  return state?.board?.spotlights ?? null;
}

/** The corner whose light is on `num`, or null. */
export function spotlightOwnerAt(state, num) {
  const lights = spotlightsOf(state);
  if (!lights) return null;
  for (const c of SPOTLIGHT_ORDER) if (lights[c] === num) return c;
  return null;
}

/**
 * Round end: every light steps to a neighbouring hex of its own quarter.
 * ⚠️ It MUST move (Alex: "every turn they should move to a nearby hex"), so
 * the current hex is never a candidate. Keyed on (seed, round) — a replay that
 * reaches the same round lands the lights on the same hexes.
 */
export function stepSpotlights(state, round) {
  const lights = spotlightsOf(state);
  if (!lights) return state;
  // ⚠️ `board.spotlightSeed`, NOT `state.rng.seed` — see state.js for why.
  const rng = makeRng((state.board.spotlightSeed ?? 0) >>> 0).fork(`spotlights:${round}`);
  const next = {};
  const moves = [];
  for (const c of SPOTLIGHT_ORDER) {
    const from = lights[c];
    const taken = new Set(Object.values(next));
    const near = SPOTLIGHT_POOLS[c].filter(n => n !== from && dist(n, from) === 1 && !taken.has(n));
    const any  = SPOTLIGHT_POOLS[c].filter(n => n !== from && !taken.has(n));
    const to = near.length ? rng.pick(near) : any.length ? rng.pick(any) : from;
    next[c] = to;
    moves.push({ owner: c, from, to });
  }
  return { ...state, board: { ...state.board, spotlights: next, lastSpotlightsMoved: { round, moves } } };
}

// ── Who a light belongs to ───────────────────────────────────────────────────

/** The living Spirit sitting in `corner`, or null. */
function seatOf(state, corner) {
  return (state.spirits ?? []).find(s => s.corner === corner && !s.knockedOut) ?? null;
}

function teammates(state, a, b) {
  const t = state.config?.teams;
  if (state.config?.mode !== "team" || !t) return false;
  return (t.a?.includes(a) && t.a?.includes(b)) || (t.b?.includes(a) && t.b?.includes(b));
}

/**
 * What a light at `num` means to `spiritId`: 'home' (their own), 'rival'
 * (another living seat's, not a teammate's) or null (no light, or scenery).
 */
export function spotlightRelation(state, spiritId, num) {
  const owner = spotlightOwnerAt(state, num);
  if (!owner) return null;
  const sp = (state.spirits ?? []).find(s => s.id === spiritId);
  if (!sp) return null;
  if (sp.corner === owner) return "home";
  const seat = seatOf(state, owner);
  if (!seat || teammates(state, sp.corner, owner)) return null;
  return "rival";
}

/** +1 Drive for an attack made from under your own light, else 0. */
export function homeSpotlightDrive(state, spiritId) {
  const sp = (state?.spirits ?? []).find(s => s.id === spiritId);
  if (!sp) return 0;
  return spotlightRelation(state, spiritId, sp.num) === "home" ? SPOTLIGHT_HOME_DRIVE : 0;
}

/** Where may this Spirit strike a pose right now? 'limelight' | 'home' | 'rival' | null. */
export function poseSpotFor(state, spiritId) {
  const sp = (state?.spirits ?? []).find(s => s.id === spiritId);
  if (!sp || sp.knockedOut) return null;
  if (sp.num === LIMELIGHT_HEX) return "limelight";
  return spotlightRelation(state, spiritId, sp.num);
}

/** Alex's heal ladder: the more hurt you are, the more your own light gives. */
export function spotlightHealFor(vibe) {
  for (const rung of SPOTLIGHT_HEAL_LADDER) if (vibe >= rung.minVibe) return rung.heal;
  return SPOTLIGHT_HEAL_LADDER[SPOTLIGHT_HEAL_LADDER.length - 1].heal;
}

/** The Sustain a posing Spirit defends with: one less, never below zero. */
export function posedSustain(sustain) {
  return Math.max(0, sustain - POSE_SUSTAIN_PENALTY);
}

// ── Striking, breaking and judging a spotlight pose ─────────────────────────

/**
 * Called by `applyPoseSet` when a pose goes UP off the Limelight. Records which
 * light it was struck under and bills the Sustain note there and then.
 * ⚠️ Like the Limelight, an EMPTY Sustain stack may still pose — on nerve.
 */
export function strikeSpotPose(state, spiritId) {
  const sp = state.spirits.find(s => s.id === spiritId);
  const kind = spotlightRelation(state, spiritId, sp?.num);
  if (!sp || !kind) return state;
  const owner = spotlightOwnerAt(state, sp.num);
  const ns = state.noteStates?.[spiritId];
  const stack = ns?.sustainStack ?? [];
  const keep = Math.max(0, stack.length - SPOTLIGHT_POSE_SUSTAIN_COST);
  const shed = stack.slice(keep);
  const limelight = state.limelight;
  return {
    ...state,
    ...(ns && shed.length ? { noteStates: { ...state.noteStates, [spiritId]: { ...ns, sustainStack: stack.slice(0, keep) } } } : {}),
    limelight: {
      ...limelight,
      spotPoses: { ...(limelight.spotPoses ?? {}), [spiritId]: { owner, hex: sp.num, kind } },
      lastSpotPoseStruck: { spiritId, owner, kind, hex: sp.num, shed },
    },
  };
}

/**
 * ⚠️ THE INVARIANT, RUN AFTER EVERY ACTION (`reduce.js` → `applyAction`).
 * A spotlight pose ends the moment its Spirit is not on the hex it was struck
 * on — walked off, shoved, pulled, warped, knocked down, anything. There are
 * seven places in the client and engine that move a body, and the Limelight's
 * version of this rule had to be copied into every one of them (and missed
 * some, headlessly, for weeks — see `movement.js` and `battleFlow.js`). One
 * check at the one chokepoint cannot be missed by the eighth.
 * 📌 Returns the SAME object when nothing breaks, so replays do not churn.
 */
export function enforceSpotPoses(state) {
  const poses = state?.limelight?.spotPoses;
  if (!poses) return state;
  let broken = null;
  for (const [id, p] of Object.entries(poses)) {
    const sp = state.spirits.find(s => s.id === id);
    const stillPosing = !!state.limelight.posing?.[id];
    if (!stillPosing || !sp || sp.knockedOut || sp.num !== p.hex) (broken ??= []).push(id);
  }
  if (!broken) return state;
  const spotPoses = { ...poses };
  const posing = { ...(state.limelight.posing ?? {}) };
  const reports = [];
  for (const id of broken) {
    // A pose dropped by its owner's own toggle is not "broken", just ended.
    if (posing[id]) reports.push({ spiritId: id, ...spotPoses[id] });
    delete spotPoses[id];
    delete posing[id];
  }
  return {
    ...state,
    limelight: {
      ...state.limelight, spotPoses, posing,
      lastSpotPoseBroken: reports.length ? reports : (state.limelight.lastSpotPoseBroken ?? null),
    },
  };
}

/**
 * TURN START: judge a spotlight pose struck on this Spirit's previous turn.
 * Home → heal by the ladder. Rival → take up to SPOTLIGHT_STEAL_CASUALS Casuals
 * from the light's owner (never Diehards, never past your own house cap, and
 * only what actually changes hands — no fans are created or destroyed).
 * Either way the pose is over afterwards: the light has already moved on.
 */
export function resolveSpotPose(state, spiritId) {
  const pose = state?.limelight?.spotPoses?.[spiritId];
  if (!pose) return state;
  const sp = state.spirits.find(s => s.id === spiritId);
  const ok = !!sp && !sp.knockedOut && sp.num === pose.hex && !!state.limelight.posing?.[spiritId];
  const report = { spiritId, ok, kind: pose.kind, owner: pose.owner, heal: 0, stolen: 0, victimId: null };
  let next = state;

  if (ok && pose.kind === "home") {
    const heal = Math.min(spotlightHealFor(sp.vibe ?? 0), Math.max(0, (sp.maxVibe ?? 0) - (sp.vibe ?? 0)));
    report.heal = heal;
    if (heal > 0) next = { ...next, spirits: next.spirits.map(s => s.id === spiritId ? { ...s, vibe: s.vibe + heal } : s) };
  }
  if (ok && pose.kind === "rival") {
    const victim = seatOf(next, pose.owner);
    const vNs = victim && next.noteStates?.[victim.id];
    const tNs = next.noteStates?.[spiritId];
    if (victim && vNs && tNs && victim.id !== spiritId) {
      const room = addCasuals(tNs, SPOTLIGHT_STEAL_CASUALS) - Math.max(0, tNs.casuals ?? 0);
      const taken = Math.max(0, Math.min(SPOTLIGHT_STEAL_CASUALS, vNs.casuals ?? 0, room));
      report.victimId = victim.id;
      report.stolen = taken;
      if (taken > 0) {
        next = { ...next, noteStates: {
          ...next.noteStates,
          [victim.id]: { ...vNs, casuals: (vNs.casuals ?? 0) - taken },
          [spiritId]:  { ...tNs, casuals: (tNs.casuals ?? 0) + taken },
        } };
      }
    }
  }

  const spotPoses = { ...next.limelight.spotPoses };
  delete spotPoses[spiritId];
  const posing = { ...(next.limelight.posing ?? {}) };
  delete posing[spiritId];
  return { ...next, limelight: { ...next.limelight, spotPoses, posing, lastSpotPose: report } };
}
