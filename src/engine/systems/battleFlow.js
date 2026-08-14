// --- ENGINE: BATTLE FLOW -----------------------------------------------------
// The ORDERED CONSEQUENCE SEQUENCE of a resolved battle, extracted from the
// React monolith so the UI and the headless harness run the SAME rules.
//
// WHY A GENERATOR, AND NOT A PLAN-THEN-APPLY LIST.
// The obvious shape is `plan(state) -> action[]`, caller dispatches them. That
// breaks here for two reasons:
//   1. Branches read state the earlier steps just wrote. Whether a knockdown
//      fires depends on the Vibe left AFTER damageApplied; whether Azrael pays
//      depends on the streak written a step earlier.
//   2. One branch is RNG-dependent (Sunbeam's linger roll). A pre-built list
//      would have to either bake in a result the caller then re-rolls — two
//      draws off the seeded stream, i.e. the exact desync BOT_STRATEGY_HANDOFF
//      §0.4 warns about — or leave a hole the interpreter fills, which puts the
//      rule back in the caller and defeats the extraction.
//
// So this file yields ONE effect at a time and receives the post-effect state
// back. The interpreter decides pacing, not order:
//   · UI       — drives a step per setTimeout, plays 'fx' and 'log' effects.
//   · Harness  — drives to completion synchronously, drops 'fx' and 'log'.
// Ordering is therefore identical by construction, which is the property the
// determinism regression actually tests.
//
// EFFECT KINDS
//   { kind:'action', action }        engine action -> applyAction/dispatch
//   { kind:'patch',  spiritId, patch } noteStates merge -> NOTE_SHEET_PATCHED
//   { kind:'log',    text }          player-facing line; no rule meaning
//   { kind:'fx',     name, ... }     presentation only; harness drops it
//   { kind:'hook',   name, ... }     a sequence still owned by the client this
//                                    pass (demolishFans, summonRockGod, knockOut,
//                                    endBerserk, dismissShadowIllusion). The
//                                    ORDER is shared even though the body isn't
//                                    yet — that is the point of naming them.
//
// Rules for this file: plain JSON effects, no DOM, no timers, no Math.random.
// Every draw goes through the `rng` handed to the interpreter, via an action.

import {
  damageApplied, knockdownResolved, fameChanged,
  noteSheetPatched, thrashTokensSpawned, randomBatchDrawn,
  spiritsSynced,
} from "../actions.js";
import {
  thrashKnockback, sonicKnockback, chordFrayAmount, underdogBonus,
  thrashFame, sonicFame, isRearHit,
} from "./combat.js";
import { HEX_BY_NUM } from "../../board/hexMap.js";
import { neighborInDirection, angleTo, angleDiff } from "../../board/hexGeometry.js";
import { hexRingFromCenter, crowdMultiplier } from "../../board/boardHelpers.js";
import {
  FAME_PER_TURN_CAP, FAN_DIEHARD_START, LIMELIGHT_HEX,
  SONIC_LIMELIGHT_FP, fpPerLife,
} from "../../data/gameConstants.js";
import { ROCK_GOD_RUNAWAY_LEAD } from "../../data/rockGods.js";

// ── Sunbeam (Intergalactic 0) ────────────────────────────────────────────────
// Transcribed from rlsw-simulator-v3_8_1.jsx:555-558 at extraction. Left here
// rather than in gameConstants so the move is a pure lift with no constant
// re-homing in the same pass; fold them into gameConstants when the monolith's
// copies are deleted.
export const SUNBEAM_DB_COST         = 2;
export const SUNBEAM_BLIND_TURNS     = 1;
export const SUNBEAM_LINGER_CHANCE   = 0.5;
export const SUNBEAM_MAX_BLIND_TURNS = 2;

export const SLIME_DB_COST = 1;

// ── effect constructors ──────────────────────────────────────────────────────
const act   = (action)          => ({ kind: 'action', action });
const patch = (spiritId, p)     => ({ kind: 'patch', spiritId, patch: p });
const log   = (text)            => ({ kind: 'log', text });
const fx    = (name, props={})  => ({ kind: 'fx', name, ...props });
const hook  = (name, props={})  => ({ kind: 'hook', name, ...props });

// ── small readers (kept local so callers can't drift on lookup shape) ────────
const spiritOf = (state, id) => state.spirits.find(s => s.id === id) ?? null;
const nsOf     = (state, id) => state.noteStates?.[id] ?? {};
const nameOf   = (state, id) => spiritOf(state, id)?.name ?? id;

/** Fame needed to win, per BOT_STRATEGY_HANDOFF §2. */
export function fameToWin(state) {
  const lives = state.config?.startingLives ?? 3;
  return lives * fpPerLife(state.spirits.length);
}

/** Was this blow landed on the defender's rear wedge? */
export function hitFromBehind(attacker, defender) {
  if (!attacker || !defender) return false;
  const defHex = HEX_BY_NUM[defender.num];
  const atkHex = HEX_BY_NUM[attacker.num];
  if (!defHex || !atkHex || defHex.num === atkHex.num) return false;
  return isRearHit(defender.facing ?? 0, angleTo(defHex, atkHex), angleDiff);
}

const anyStageEffectActive = (state) => {
  const f = state.stageFx;
  return !!(f?.smoke || f?.laser || f?.pyro || (f?.animatronics?.length));
};

const headlinerRider = (state, id) => (state.headliner === id ? 1 : 0);

// ═════════════════════════════════════════════════════════════════════════════
// 1. CHORD FRAY — the defender's Sustain stack takes real damage on a landed
//    blow. Margin-scaled, +1 from the rear wedge. A posing Spirit has no chord
//    to fray (they gave up defence entirely, §3.3), and one note always
//    survives so a stack is never wiped to nothing by fray alone.
// ═════════════════════════════════════════════════════════════════════════════
export function* chordFray({ state, targetId, margin, fromBehind = false, posing = {}, chordOf }) {
  const none = { frayed: 0, destroyed: false, fromBehind: false };
  const nsD   = nsOf(state, targetId);
  const stack = nsD.sustainStack ?? [];
  if (stack.length <= 1 || posing[targetId]) return none;

  const amount = chordFrayAmount(margin, fromBehind);
  if (amount <= 0) return none;

  const fray        = Math.min(amount, stack.length - 1);
  const frayedNotes = stack.slice(0, stack.length - fray);
  const lostNotes   = stack.slice(stack.length - fray);

  const before = chordOf(targetId, stack);
  const after  = chordOf(targetId, frayedNotes);

  yield patch(targetId, { sustainStack: frayedNotes });
  yield fx('spentNotes', { spiritId: targetId, notes: lostNotes, stack: 'sustain' });
  if (fromBehind) {
    yield log(`🔪 FROM BEHIND! ${nameOf(state, targetId)} never saw it coming — the guard never came up.`);
  }
  yield log(`🛡️ ${nameOf(state, targetId)}'s chord frays under the blow — ${before.name} → ${after.name} (🛡️${after.sustain}, −${fray} note${fray !== 1 ? 's' : ''})`);

  return {
    frayed: fray,
    destroyed: stack.length >= 2 && frayedNotes.length <= 1,
    destroyedDrive: before.drive,
    fromBehind,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. KNOCKBACK — resolve the slide one hex at a time.
//
// ⚠️ NOT presentation. The per-step hazard checks (slime, vortex, flaming disc,
// stage FX) are RULES: being shoved through a hex triggers it exactly as
// walking in does, and the sequence can kill. The React version expressed the
// steps as nested setTimeouts, which is why this read as animation; the timing
// is the interpreter's business, the stepping is ours.
//
// Yields a 'hazard' hook per hex entered so the client's existing checks stay
// authoritative this pass, in the right order.
// ═════════════════════════════════════════════════════════════════════════════
export function* knockback({ state, fromId, targetId, spaces, amps = [] }) {
  const fromSp = spiritOf(state, fromId);
  const target = spiritOf(state, targetId);
  if (!fromSp || !target || target.knockedOut || spaces <= 0) return { path: [] };

  // 6️⃣ BERSERK — the Beast does not get moved. He comes at you.
  if (nsOf(state, targetId).berserk) {
    yield log(`6️⃣ ${target.name} doesn't move an inch — the Beast eats the hit and keeps coming.`);
    yield fx('rumble', { spiritId: targetId });
    return { path: [] };
  }

  // 🌀 ROLLS HARD — Intergalactic 0 shrugs off a hex of any shove, but a floor
  // of 1 always lands or he'd be immune to Thrash's flat push and could squat
  // the centre untouchable.
  if (targetId === 'intergalactic_0') {
    if (spaces > 1) {
      spaces -= 1;
      yield log(`🌀 ${target.name} Rolls Hard — he digs in and eats a hex of the shove.`);
    } else {
      yield log(`🌀 ${target.name} Rolls Hard — he gives up the one hex and not an inch more.`);
    }
  }

  const fromHex = HEX_BY_NUM[fromSp.num];
  const tgtHex  = HEX_BY_NUM[target.num];
  if (!fromHex || !tgtHex) return { path: [] };

  const angle = fromSp.num === target.num
    ? (fromSp.facing ?? 0)
    : angleTo(fromHex, tgtHex);

  yield log(`💢 ${target.name} is KNOCKED BACK ${spaces} hex${spaces !== 1 ? 'es' : ''}!`);
  yield fx('rumble', { spiritId: targetId });

  const path = [];
  let curNum = target.num;

  for (let step = 0; step < spaces; step++) {
    const curHex = HEX_BY_NUM[curNum];
    if (!curHex) break;
    const nextHex = neighborInDirection(curHex, angle);
    if (!nextHex) {
      yield log(`💥 ${target.name} slams into the edge of the stage at #${curNum}!`);
      break;
    }
    const occupied =
      state.spirits.some(s => !s.knockedOut && s.id !== targetId && s.num === nextHex.num) ||
      amps.some(a => a.hexNum === nextHex.num);
    if (occupied) {
      yield log(`💥 ${target.name} crashes to a stop at #${curNum}!`);
      break;
    }

    // Fresh-state guard, ported from the React version's `aborted` check: the
    // target may have been KO'd, respawned or relocated by a hazard mid-slide
    // (battle damage landing between steps). Dragging their respawned standee
    // onward from a stale hex was the bug this guards.
    const live = spiritOf(state, targetId);
    if (!live || live.knockedOut || (live.vibe ?? 0) <= 0 || live.num !== curNum) break;

    const fromNum = curNum;
    state = yield act(spiritsSynced(
      state.spirits.map(s => s.id === targetId ? { ...s, num: nextHex.num } : s)
    ));
    curNum = nextHex.num;
    path.push(curNum);

    // Names come off the LIVE state, not the `target` snapshot taken before the
    // slide began — a hazard mid-path can respawn them, and the old code read a
    // stale standee here.
    if (fromNum === LIMELIGHT_HEX) {
      yield hook('leftLimelight', { spiritId: targetId });
      yield log(`🎤 ${nameOf(state, targetId)} knocked off the Limelight!`);
    }
    if (nextHex.edge) yield log(`⚠️ ${nameOf(state, targetId)} skids onto the EDGE — #${nextHex.num}!`);

    // Rules, not decoration — and they can end the slide.
    state = yield hook('hexHazards', { spiritId: targetId, hexNum: nextHex.num });
  }

  return { path };
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. FAME GRANT — the win condition's one door.
//
// Order matters and is load-bearing: crowd multiplier, THEN the per-turn cap,
// THEN the win check. Capping before amplifying would quietly make the fan
// multiplier worthless at the top of the range (§3.6's whole investment case).
//
// `fameThisTurn` is threaded in and out rather than read from a ref, because
// the cap is a per-turn window the harness has to own too.
// ═════════════════════════════════════════════════════════════════════════════
export function* grantFame({ state, spiritId, fp, reason, amplify = true, fameThisTurn = {} }) {
  if (fp <= 0) return { granted: 0, fameThisTurn };

  const ns       = nsOf(state, spiritId);
  const assigned = (ns.assignments ?? []).length;
  const mult     = amplify
    ? crowdMultiplier(ns.diehards ?? FAN_DIEHARD_START, ns.casuals ?? 0, assigned)
    : 1;
  const uncapped = amplify ? Math.max(fp, Math.round(fp * mult)) : fp;

  const earnedSoFar = fameThisTurn[spiritId] ?? 0;
  const room        = Math.max(0, FAME_PER_TURN_CAP - earnedSoFar);
  const finalFp     = Math.min(uncapped, room);
  const clipped     = uncapped - finalFp;

  if (finalFp <= 0) {
    yield log(`⭐🚫 ${nameOf(state, spiritId)} is already at the ${FAME_PER_TURN_CAP} FP turn cap — the crowd can only scream so loud${reason ? ` (${reason} lost to the noise)` : ''}.`);
    return { granted: 0, fameThisTurn };
  }

  const nextWindow = { ...fameThisTurn, [spiritId]: earnedSoFar + finalFp };
  const fameBefore = ns.fame ?? 0;

  state = yield act(fameChanged(spiritId, finalFp));

  const target   = fameToWin(state);
  const crowdStr = (amplify && uncapped !== fp) ? ` (${fp} ×🎤${mult.toFixed(2)} crowd)` : '';
  const capStr   = clipped > 0 ? ` ⛔ capped at ${FAME_PER_TURN_CAP}/turn (${clipped} lost to the noise)` : '';
  const myFame   = nsOf(state, spiritId).fame ?? (fameBefore + finalFp);
  yield log(`⭐ ${nameOf(state, spiritId)} earns ${finalFp} Fame Point${finalFp !== 1 ? 's' : ''}${crowdStr}${capStr}${reason ? ` — ${reason}` : ''}! (${Math.min(myFame, target)}/${target})`);

  yield hook('stageFxThresholds', { spiritId, from: fameBefore, to: myFame });

  if (myFame < target) return { granted: finalFp, fameThisTurn: nextWindow };

  // A Rock God already holds the gate — Fame alone can't end it now.
  if (state.rockGod?.summoned) return { granted: finalFp, fameThisTurn: nextWindow };

  // 🤘 THE RULE OF THE GODS — a runaway lead is crowned outright; a close race
  // summons a God to settle it. Read rivals from the state we just wrote, not a
  // pre-dispatch mirror: back-to-back grants in one beat (riff payouts, Azrael
  // chains) left the old client copy stale and summoned the God into a blowout.
  const rivalBest = Math.max(0, ...state.spirits
    .filter(s => s.id !== spiritId && !s.knockedOut)
    .map(s => nsOf(state, s.id).fame ?? 0));
  const lead = myFame - rivalBest;
  const shortGame = (state.config?.startingLives ?? 3) < 3;

  if (lead >= ROCK_GOD_RUNAWAY_LEAD || shortGame) {
    yield log(`🌟🌟🌟 ${nameOf(state, spiritId)} reaches ${target} Fame — ⭐${myFame} vs ⭐${rivalBest}, a runaway lead of ${lead}. A LEGEND IS BORN! 🌟🌟🌟`);
    yield hook('declareWinner', { spiritId });
  } else {
    yield log(`⭐ ${nameOf(state, spiritId)} hits ${target} Fame — but ⭐${myFame} vs ⭐${rivalBest} is only a ${lead}-point lead (needs ${ROCK_GOD_RUNAWAY_LEAD}). The Gods demand a FINALE.`);
    yield hook('summonRockGod', { spiritId });
  }
  return { granted: finalFp, fameThisTurn: nextWindow };
}

/** Thrash win: flat 1, plus Headliner and stage-FX riders, then underdog. */
export function* awardThrashFame({ state, spiritId, loserId, fameThisTurn }) {
  const rider   = headlinerRider(state, spiritId);
  const fxBonus = anyStageEffectActive(state) ? 1 : 0;
  const base    = thrashFame() + rider + fxBonus;

  if (fxBonus) yield log(`🎇 The stage effects amplify the battle — +1 FP!`);

  const { fp, deficit, mult } = underdogBonus(
    nsOf(state, spiritId).fame ?? 0,
    nsOf(state, loserId).fame ?? 0,
    base,
  );
  const tag = `thrash win${rider ? ' +👑' : ''}${fxBonus ? ' +🎇' : ''}`;

  let amount = base;
  if (deficit > 0 && fp > base) {
    yield log(`🔥 UNDERDOG! ${nameOf(state, spiritId)} was down ${deficit} Fame — the crowd ROARS! (${base} → ${fp}, ×${mult.toFixed(2)})`);
    yield fx('flash', { spiritId, icon: '🔥', text: 'UNDERDOG!', color: '#ffaa22' });
    amount = fp;
  }

  const res = yield* grantFame({ state, spiritId, fp: amount, reason: tag, fameThisTurn });
  if (fxBonus) yield hook('gainFans', { spiritId, n: 1, reason: '🎇 stage effects spectacle' });
  return res;
}

/** Sonic win: margin-scaled, plus a Limelight-ring bonus. */
export function* awardSonicFame({ state, spiritId, loserId, margin, centerBonus = 0, fameThisTurn }) {
  const rider   = headlinerRider(state, spiritId);
  const fxBonus = anyStageEffectActive(state) ? 1 : 0;
  const base    = sonicFame(margin) + rider + fxBonus + centerBonus;

  const { fp, deficit, mult } = underdogBonus(
    nsOf(state, spiritId).fame ?? 0,
    nsOf(state, loserId).fame ?? 0,
    base,
  );
  const tag = `sonic win (margin ${margin})${rider ? ' +👑' : ''}${fxBonus ? ' +🎇' : ''}${centerBonus ? ' +🎤' : ''}`;

  let amount = base;
  if (deficit > 0 && fp > base) {
    yield log(`🔥 UNDERDOG! ${nameOf(state, spiritId)} was down ${deficit} Fame — the crowd ROARS! (${base} → ${fp}, ×${mult.toFixed(2)})`);
    yield fx('flash', { spiritId, icon: '🔥', text: 'UNDERDOG!', color: '#ffaa22' });
    amount = fp;
  }
  return yield* grantFame({ state, spiritId, fp: amount, reason: tag, fameThisTurn });
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. VIBE DAMAGE — and the knockdown cascade it can open.
// ═════════════════════════════════════════════════════════════════════════════
export function* vibeDamage({ state, targetId, dmg, sourceLabel, attackerId = null, fameThisTurn = {} }) {
  if (targetId === 'cosmic_ronin' && dmg > 0) {
    yield hook('dismissShadowIllusion', { reason: 'the Ronin was attacked' });
  }
  if (dmg > 0) {
    const tgtNow = spiritOf(state, targetId);
    if (tgtNow) {
      yield fx('damageNumber', { hexNum: tgtNow.num, text: `−${dmg} ❤️`, color: '#ff4455', source: sourceLabel });
      yield fx('focus', { hexNum: tgtNow.num, ms: 950, zoom: 0.42, rumble: true });
    }
  }

  state = yield act(damageApplied(targetId, dmg));

  const tgt = spiritOf(state, targetId);
  if (!tgt || tgt.vibe > 0) return { knockedDown: false, fameThisTurn };

  // ── Vibe hit 0 — KNOCK DOWN ──
  const newLives = (tgt.lives ?? 1) - 1;
  const fellOn   = tgt.num;   // respawn moves them after this; the crowd scatters where they FELL
  yield log(`💥 ${tgt.name} is KNOCKED DOWN! (${newLives} life${newLives !== 1 ? 's' : ''} left)`);
  yield hook('demolishFans', { targetId, attackerId, hexNum: fellOn });

  // 6️⃣ BERSERK ends here either way round — the charge landed, or the cannons won.
  if (attackerId && attackerId !== targetId && nsOf(state, attackerId).berserk) {
    yield hook('endBerserk', { spiritId: attackerId, reason: `${tgt.name} went down — the charge landed` });
  }
  if (nsOf(state, targetId).berserk) {
    yield hook('endBerserk', { spiritId: targetId, reason: 'he charged the cannons and the cannons won' });
  }

  // 💀 AZRAEL — a rival going down feeds Metalness Fame equal to his streak.
  if (attackerId && attackerId !== targetId) {
    const atkNs = nsOf(state, attackerId);
    if ((atkNs.unlockedSkills ?? []).includes('azrael')) {
      const streak = (atkNs.knockStreak ?? 0) + 1;
      state = yield patch(attackerId, { knockStreak: streak });
      yield log(`💀 AZRAEL — ${nameOf(state, attackerId)} feeds on the fallen! Knockdown streak ${streak} → +${streak} FP.`);
      yield fx('flash', { spiritId: attackerId, icon: '💀', text: `AZRAEL ×${streak}`, color: '#ff2244' });
      const r = yield* grantFame({ state, spiritId: attackerId, fp: streak, reason: `Azrael streak ${streak}`, fameThisTurn });
      fameThisTurn = r.fameThisTurn;
    }
  }

  if (newLives <= 0) {
    yield hook('knockOut', { spiritId: targetId });
    return { knockedDown: true, knockedOut: true, fameThisTurn };
  }

  // Straight back up in the home corner at full Vibe — no turn is skipped.
  // Knock-down tax is 1 FP (the engine floors at 0). Azrael's streak resets.
  // Not rebound to `state`: the interpreter owns the running state and nothing
  // below re-reads it. Anything added after these MUST take the yield's return.
  yield act(fameChanged(targetId, -1));
  yield patch(targetId, { recovering: false, knockStreak: 0 });
  yield log(`💸 ${tgt.name} loses 1 FP and gets straight back up in their home corner!`);
  yield fx('respawnFlash', { spiritId: targetId });
  yield act(knockdownResolved(targetId));

  return { knockedDown: true, knockedOut: false, fameThisTurn };
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. THE CONSEQUENCE SEQUENCE — what `closeBattleOverlay` did.
//
// `battle` is the resolved verdict already computed by ATTACK_ROLLED; nothing
// here re-rolls it. This is purely what the verdict COSTS and PAYS.
// ═════════════════════════════════════════════════════════════════════════════
// NOTE: chord fray is NOT here. It resolves at the moment the verdict lands,
// at the attack-declaration site (the React version calls applyChordFray right
// after the roll, before the overlay opens) — measured against the positions as
// they stand AT THE VERDICT, not after knockback has shoved anyone. `chordFray`
// is exported separately so the caller keeps that ordering.
export function* battleConsequences({ state, battle, chordOf, amps = [], fameThisTurn = {} }) {
  const {
    attackerWon, damage, margin, attackerId, defenderId, sonicAttack,
    swingChordLeft = [], swingChordSpent = [],
  } = battle;

  if (!attackerWon) {
    // ── ATTACKER LOST ──
    // Thrash whiff is the flat humiliation tap; Sonic whiff scales with margin.
    const selfDmg = sonicAttack ? Math.max(1, Math.ceil(margin / 2)) : damage;
    const r1 = yield* vibeDamage({
      state, targetId: attackerId, dmg: selfDmg, sourceLabel: 'whiff',
      attackerId: defenderId, fameThisTurn,
    });
    fameThisTurn = r1.fameThisTurn;
    state = yield ({ kind: 'peek' });

    const r2 = sonicAttack
      ? yield* awardSonicFame({ state, spiritId: defenderId, loserId: attackerId, margin, fameThisTurn })
      : yield* awardThrashFame({ state, spiritId: defenderId, loserId: attackerId, fameThisTurn });
    fameThisTurn = r2.fameThisTurn;
    state = yield ({ kind: 'peek' });

    yield* knockback({
      state, fromId: defenderId, targetId: attackerId,
      spaces: sonicAttack ? 1 : thrashKnockback(margin), amps,
    });
    yield* clearBattleBuffs({ attackerId, defenderId });
    return { fameThisTurn };
  }

  // ── ATTACKER WON ──
  // 🎸 Drive notes burn ON A HIT ONLY — whiffing keeps the stack intact.
  if (!sonicAttack && swingChordSpent.length) {
    const left = swingChordLeft.length
      ? chordOf(attackerId, swingChordLeft).name
      : 'drive exhausted (base stats until committed)';
    yield log(`🎸 ${nameOf(state, attackerId)} burns ${swingChordSpent.join('+')} from the drive stack — ${left}.`);
    state = yield patch(attackerId, { driveStack: swingChordLeft });
    yield fx('spentNotes', { spiritId: attackerId, notes: swingChordSpent, stack: 'drive' });
  }

  // ── KNOCKBACK, routed by attack kind ──
  const def = spiritOf(state, defenderId);
  const spaces = sonicAttack
    ? sonicKnockback(margin, def?.vibe ?? 1, def?.maxVibe ?? 1)
    : thrashKnockback(margin);
  yield* knockback({ state, fromId: attackerId, targetId: defenderId, spaces, amps });
  state = yield ({ kind: 'peek' });

  const rd = yield* vibeDamage({
    state, targetId: defenderId, dmg: damage,
    sourceLabel: nameOf(state, attackerId), attackerId, fameThisTurn,
  });
  fameThisTurn = rd.fameThisTurn;
  state = yield ({ kind: 'peek' });

  // ── FP — Sonic is the Fame engine; Thrash earns a flat 1 ──
  if (sonicAttack) {
    const ring = hexRingFromCenter(spiritOf(state, attackerId)?.num ?? -1);
    const centerBonus = (ring === 'main' || ring === 'pit') ? SONIC_LIMELIGHT_FP : 0;
    const r = yield* awardSonicFame({ state, spiritId: attackerId, loserId: defenderId, margin, centerBonus, fameThisTurn });
    fameThisTurn = r.fameThisTurn;
  } else {
    const r = yield* awardThrashFame({ state, spiritId: attackerId, loserId: defenderId, fameThisTurn });
    fameThisTurn = r.fameThisTurn;
  }
  state = yield ({ kind: 'peek' });

  // ── Thrash impact knocks Lost Chords loose near the defender ──
  if (!sonicAttack) {
    const defSpirit = spiritOf(state, defenderId);
    if (defSpirit) {
      const tier = margin >= 6 ? 'heavy' : margin >= 3 ? 'medium' : 'light';
      const occupied = [
        ...state.spirits.filter(sp => !sp.knockedOut).map(sp => sp.num),
        ...(state.boardCards ?? []).map(c => c.hexNum),
        ...state.board.chargeZones.map(z => z.num),
        ...state.board.eventHexes,
        ...state.board.boardTokens.map(t => t.num),
        state.board.spotlightHex, LIMELIGHT_HEX,
      ];
      state = yield act(thrashTokensSpawned(defSpirit.num, occupied, tier, 1));
      const report = state.board.lastThrashTokens;
      if (report?.added?.length) {
        yield log(`🎵 ${report.added.length} Lost Chord${report.added.length !== 1 ? 's' : ''} knocked loose from the impact!`);
      }
    }
  }

  // ── 🧪 SLIME (Metalness) — melee-only, auto-spends 1 Db, halves rival regen ──
  if (!sonicAttack && attackerId === 'Metalness_Monster') {
    const atkNs = nsOf(state, attackerId);
    if ((atkNs.unlockedSkills ?? []).includes('slime') && (atkNs.dbPoints ?? 0) >= SLIME_DB_COST) {
      yield patch(attackerId, { dbPoints: (atkNs.dbPoints ?? 0) - SLIME_DB_COST });
      state = yield patch(defenderId, { halfRefillNextTurn: true });
      yield log(`🧪 SLIMED! ${nameOf(state, defenderId)} is coated in toxic goo — note regen HALVED next turn! (−${SLIME_DB_COST} Db)`);
      yield fx('flash', { spiritId: defenderId, icon: '🧪', text: 'SLIMED!', color: '#44ff44' });
    }
  }

  // ── ☀️ SUNBEAM (Intergalactic 0) — any connecting attack, Swing or Sonic ──
  // ⚠️ The linger is a 50/50 and it goes through the SEEDED stream, not
  // Math.random: replays and the online desync tripwire both compare rng
  // cursors. This is exactly the branch that made a plan-then-apply list
  // unworkable — see the header.
  if (attackerId === 'intergalactic_0') {
    const atkNs = nsOf(state, attackerId);
    if ((atkNs.unlockedSkills ?? []).includes('sunbeam') && (atkNs.dbPoints ?? 0) >= SUNBEAM_DB_COST) {
      state = yield act(randomBatchDrawn(1));
      const lingerRoll = state.lastRandomBatch?.[0] ?? 1;
      const lingers = lingerRoll < SUNBEAM_LINGER_CHANCE;
      const turns = Math.min(SUNBEAM_MAX_BLIND_TURNS, SUNBEAM_BLIND_TURNS + (lingers ? 1 : 0));

      state = yield patch(attackerId, { dbPoints: (atkNs.dbPoints ?? 0) - SUNBEAM_DB_COST });
      // Blinds do NOT stack — a fresh proc takes the HIGHER clock, so being hit
      // twice in a round can never bury someone past the ceiling.
      state = yield patch(defenderId, {
        blindTurns: Math.max(nsOf(state, defenderId).blindTurns ?? 0, turns),
      });
      yield log(`☀️ SUNBEAM! ${nameOf(state, attackerId)} opens the star and ${nameOf(state, defenderId)}'s world goes WHITE — blinded for ${turns} turn${turns !== 1 ? 's' : ''}. (−${SUNBEAM_DB_COST} Db)`);
      if (lingers) yield log(`☀️ The burn is seared in — ${nameOf(state, defenderId)} is still seeing nothing but light next turn.`);
      yield fx('flash', { spiritId: defenderId, icon: '☀️', text: 'BLINDED!', color: '#ffffff' });
    }
  }

  yield* clearBattleBuffs({ attackerId, defenderId });
  return { fameThisTurn };
}

/** Temp buffs are battle-scoped and expire with it, win or lose. */
export function* clearBattleBuffs({ attackerId, defenderId }) {
  if (attackerId) yield patch(attackerId, { tempDrive: 0, edgeStage: 0 });
  if (defenderId) yield patch(defenderId, { tempSustain: 0, edgeStage: 0 });
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. THE SYNCHRONOUS INTERPRETER — what the harness drives.
//
// The UI drives the same generators with its own paced interpreter so the
// cinematic keeps its timing; only the ORDER is shared, which is the part that
// has to be identical.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Run a battleFlow generator to completion, applying every effect immediately.
 *
 * @param {Generator} gen
 * @param {object} state       starting GameState
 * @param {object} opts
 * @param {function} opts.applyAction  (state, action) => state
 * @param {object} [opts.hooks]        { [name]: (state, effect) => state }
 * @param {function} [opts.onLog]      collect log lines (default: drop)
 * @param {function} [opts.onFx]       play a presentation effect (default: drop).
 *   The harness never passes this. The client does, for the short sequences it
 *   needs to run to completion synchronously (chord fray) rather than paced.
 * @returns {{ state: object, result: any, logs: string[] }}
 */
export function runBattleFlow(gen, state, { applyAction, hooks = {}, onLog, onFx } = {}) {
  const logs = [];
  let res = gen.next(state);
  while (!res.done) {
    const e = res.value;
    switch (e.kind) {
      case 'action':
        state = applyAction(state, e.action);
        break;
      case 'patch':
        state = applyAction(state, noteSheetPatched(e.spiritId, e.patch));
        break;
      case 'log':
        logs.push(e.text);
        onLog?.(e.text);
        break;
      case 'fx':
        onFx?.(e);
        break;
      case 'peek':
        break;                              // state re-read only
      case 'hook': {
        const h = hooks[e.name];
        if (h) state = h(state, e) ?? state;
        break;
      }
      default:
        // A typo'd effect kind is a bug, and a silent one — it would drop a
        // rule. Loud here, same posture as the reducer's unknown-action warn.
        console.warn(`[battleFlow] unknown effect kind: ${e.kind}`);
    }
    res = gen.next(state);
  }
  return { state, result: res.value, logs };
}
