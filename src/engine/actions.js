// ─── ENGINE ACTIONS ──────────────────────────────────────────────────────────
// Action type constants + creators. Payloads must be plain-JSON serializable
// (they will cross the network / be written to replay logs verbatim).
//
// Growth plan (see src/MULTIPLAYER_HANDOFF.md §5): each extraction phase adds
// its action types here.

export const GAME_INIT = "GAME_INIT";

// ── Phase 2: turn & movement ────────────────────────────────────────────────
export const TURN_STARTED    = "TURN_STARTED";
export const TURN_ENDED      = "TURN_ENDED";
export const TURN_SKIPPED    = "TURN_SKIPPED";
export const MOVE_BUDGET_SET = "MOVE_BUDGET_SET";
export const MOVE_STEP       = "MOVE_STEP";
export const BEATS_SPENT     = "BEATS_SPENT";
export const SPIRIT_WARPED   = "SPIRIT_WARPED";
export const SPIRIT_FACED      = "SPIRIT_FACED";
export const SPIRIT_ELIMINATED = "SPIRIT_ELIMINATED";
export const SPIRITS_SYNCED  = "SPIRITS_SYNCED"; // TEMP bridge — remove in Phase 3

// ── Phase 4: riff-off (the multiplayer seam) ────────────────────────────────
export const RIFF_OFF_STARTED       = "RIFF_OFF_STARTED";
export const RIFF_RESULTS_SUBMITTED = "RIFF_RESULTS_SUBMITTED";
export const RIFF_RESOLVED          = "RIFF_RESOLVED";
export const RIFF_ROUND2_STARTED    = "RIFF_ROUND2_STARTED";
export const RIFF_CLOSED            = "RIFF_CLOSED";

// ── Phase 3b: combat rolls ──────────────────────────────────────────────────
export const ATTACK_ROLLED = "ATTACK_ROLLED";

// Phase 3 (combat, remaining):  DAMAGE_APPLIED, KNOCKBACK_MOVED, KNOCKED_OUT, RETALIATION_*
// Phase 5 (economy/skills):   COMMIT_TRACK, VOICE_CHORD, PLAY_MOD_CARD, …
// Phase 6 (events/FX/god):    EVENT_DRAWN, STAGE_FX_TICK, GOD_ATTACK, …

/** Mark the state as initialized (a no-op record for the replay log's head). */
export function gameInit() {
  return { type: GAME_INIT };
}

/** A spirit's turn begins — engine records limelight-start flag. */
export function turnStarted(spiritId) {
  return { type: TURN_STARTED, spiritId };
}

/** The acting spirit ends its turn (full end-of-turn resolution). */
export function turnEnded() {
  return { type: TURN_ENDED };
}

/** The acting spirit's turn is skipped (knock-down recovery). */
export function turnSkipped() {
  return { type: TURN_SKIPPED };
}

/**
 * Melody commit grants a movement budget.
 * `tripped` is client-supplied until noteStates joins the engine (Phase 5).
 */
export function moveBudgetSet(steps, tripped = false) {
  return { type: MOVE_BUDGET_SET, steps, tripped };
}

/**
 * One hex of movement by the acting spirit.
 * `dazed` is client-supplied until noteStates joins the engine (Phase 5).
 */
export function moveStep(spiritId, toNum, dazed = false) {
  return { type: MOVE_STEP, spiritId, toNum, dazed };
}

/** Combat action pays AP; most also exhaust the action token. */
export function beatsSpent(n, exhaustToken = false, { all = false } = {}) {
  return { type: BEATS_SPENT, n, all, exhaustToken };
}

/** Teleport (Displace): position change + AP cost, no facing change. */
export function spiritWarped(spiritId, toNum, cost = 0) {
  return { type: SPIRIT_WARPED, spiritId, toNum, cost };
}

/** Turn in place to aim — costs 1 step (human "face" action + bot aimFace). */
export function spiritFaced(spiritId, facing, cost = 1) {
  return { type: SPIRIT_FACED, spiritId, facing, cost };
}

/** Spirit is out of lives — permanently removed from the turn queue. */
export function spiritEliminated(spiritId) {
  return { type: SPIRIT_ELIMINATED, spiritId };
}

/** TEMP Phase 2 bridge — push React-owned spirit mutations into the engine. */
export function spiritsSynced(spirits) {
  return { type: SPIRITS_SYNCED, spirits };
}

/** A riff-off begins — engine generates both riffs + skill mods on its rng.
 *  slayer/eRush are client-supplied until noteStates joins the engine (Ph 5). */
export function riffOffStarted(attackerId, defenderId, { slayer = false, eRush = false } = {}) {
  return { type: RIFF_OFF_STARTED, attackerId, defenderId, slayer, eRush };
}

/** A performer submits their results array [{hit, rt, grade, noteIdx}]. */
export function riffResultsSubmitted(role, results) {
  return { type: RIFF_RESULTS_SUBMITTED, role, results };
}

/** Both results are in — compute the verdict. */
export function riffResolved() {
  return { type: RIFF_RESOLVED };
}

/** Beams locked — sudden-death Round 2 with fresh, faster riffs. */
export function riffRound2Started() {
  return { type: RIFF_ROUND2_STARTED };
}

/** The duel is over (or aborted) — clear the battle slice. */
export function riffClosed() {
  return { type: RIFF_CLOSED };
}

/**
 * Phase 3b — an attack's dice are rolled in the engine (seeded rng) and the
 * verdict (rolls + margin + damage) is stored in `state.battle`. The client
 * pre-computes the stat modifiers (they read `noteStates`, which joins the
 * engine in Phase 5) and passes them as payload; the spin overlay then just
 * displays the already-decided face. Shared by the human and bot swing paths.
 *
 * @param {"swing"} kind          attack type (only 'swing' in this pass)
 * @param {object}  p
 * @param {number}  p.atkStat         attacker's pre-roll total (chord+edge+mods)
 * @param {number}  p.defStat         defender's pre-roll total
 * @param {boolean} [p.posing]        defender is posing → rolls no die (0)
 * @param {boolean} [p.halveDef]      Laser Show → defender's die halved (min 1)
 * @param {boolean} [p.psychoEligible] attacker owns Psycho Bushido (5/6 → def die → 1)
 * @param {number[]} [p.dicePool]     SONIC keep-highest pool of die sizes
 *                                     (e.g. [6,6], [6,6,8], [8,8,8]); omit for a
 *                                     plain swing (single d6).
 */
export function attackRolled(kind, attackerId, defenderId,
  { atkStat, defStat, posing = false, halveDef = false, psychoEligible = false, dicePool = null }) {
  return {
    type: ATTACK_ROLLED, kind, attackerId, defenderId,
    atkStat, defStat, posing, halveDef, psychoEligible, dicePool,
  };
}
