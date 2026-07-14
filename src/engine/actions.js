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

// ── Phase 3d: retaliation (counter) roll ────────────────────────────────────
export const COUNTER_ROLLED = "COUNTER_ROLLED";

// ── Phase 5c: spirit combat-ownership (the deferred 3c flip, engine side) ────
// The engine's `spirits` becomes the source of truth for Vibe / lives / KO.
// These reducers own the rule transitions; the client keeps the cinematics
// (damage numbers, slide-off, respawn flash) and dispatches the action at the
// beat the rule fires. Wired into `Game` in the client-flip step; until then
// they're dormant and the SPIRITS_SYNCED bridge still carries spirit state.
export const DAMAGE_APPLIED     = "DAMAGE_APPLIED";
export const KNOCKDOWN_RESOLVED = "KNOCKDOWN_RESOLVED";
export const WINNER_DECLARED    = "WINNER_DECLARED";

// ── Phase 5c: spirit generic patch (mirrors NOTE_SHEET_PATCHED) ──────────────
// The `setSpirits` shim's diff action — merges a client-computed field patch
// into ONE spirit. Retires SPIRITS_SYNCED from normal play (the full-replace
// bridge becomes roster-change fallback only, exactly as NOTE_STATES_SYNCED did).
export const SPIRIT_PATCHED = "SPIRIT_PATCHED";

// ── Phase 5c: noteStates ownership bridge (mirrors SPIRITS_SYNCED) ────────────
// TEMP full-replace bridge so the client can flip `noteStates` to a view of
// `engineState.noteStates` cheaply (engine becomes source of truth), keeping all
// ~60 setNoteStates sites working. Individual sites migrate to semantic actions
// (NOTE_TRACK_CONFIRMED, SKILL_AWARDED, FANS_CHANGED, …) later; this bridge dies
// with them, exactly as SPIRITS_SYNCED does for spirits.
export const NOTE_STATES_SYNCED = "NOTE_STATES_SYNCED";

// ── Phase 5c: noteStates SEMANTIC actions (retire the full-replace bridge site
// by site, exactly as the combat actions retired SPIRITS_SYNCED). ─────────────
export const FAME_CHANGED = "FAME_CHANGED";
export const FANS_CHANGED = "FANS_CHANGED";
export const NOTE_SHEET_PATCHED = "NOTE_SHEET_PATCHED";
export const FANS_TICKED = "FANS_TICKED";

// ── Phase 6d: end-of-turn ticks ─────────────────────────────────────────────
export const DEBUFFS_TICKED = "DEBUFFS_TICKED";
export const BURN_TICKED    = "BURN_TICKED";

// ── Phase 6b: stage FX ───────────────────────────────────────────────────────
export const STAGE_FX_DRAWN        = "STAGE_FX_DRAWN";
export const STAGE_FX_ACTIVATED    = "STAGE_FX_ACTIVATED";
export const STAGE_FX_TURN_TICKED  = "STAGE_FX_TURN_TICKED";
export const STAGE_FX_ROUND_TICKED = "STAGE_FX_ROUND_TICKED";

// ── Phase 6c: Rock God ───────────────────────────────────────────────────────
export const GOD_ATTACK_PICKED  = "GOD_ATTACK_PICKED";
export const GOD_SUMMONED       = "GOD_SUMMONED";
export const GOD_DAMAGED        = "GOD_DAMAGED";
export const GOD_ACTED          = "GOD_ACTED";
export const GOD_DEFEATED       = "GOD_DEFEATED";
export const GOD_TRIUMPHED      = "GOD_TRIUMPHED";
export const GOD_TIMER_EXPIRED  = "GOD_TIMER_EXPIRED";

// ── Phase R5: headliner ─────────────────────────────────────────────────────
export const HEADLINER_CHANGED = "HEADLINER_CHANGED";

// Phase 5c (economy/skills flip): NOTE_TRACK_CONFIRMED, SKILL_AWARDED, FANS_CHANGED, …
// Phase 6 (events/FX/god):        EVENT_DRAWN, STAGE_FX_TICK, GOD_ATTACK, …

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
 *  slayer/eRush are client-supplied until noteStates joins the engine (Ph 5).
 *  melodyLine (optional): attacker's committed melody (NOTE_POOL format) —
 *  when present the engine builds the riff from it (Phase R1: Rhythm Creation
 *  Device). hasRiff flags a legendary-riff bonus on the melody.
 *  maxLen (Phase R2): difficulty-tier cap on riff length.
 *  tier (Phase R4): 'acoustic' | 'stadium' — acoustic duels skip beam clash. */
export function riffOffStarted(attackerId, defenderId, { slayer = false, eRush = false, melodyLine = null, hasRiff = false, maxLen = 6, tier = 'stadium' } = {}) {
  return { type: RIFF_OFF_STARTED, attackerId, defenderId, slayer, eRush, melodyLine, hasRiff, maxLen, tier };
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
 * @param {number}  [p.atkFloor]      ⚡ attacker die floor — every attacker die
 *                                     result reads as at least 1+atkFloor (Charge
 *                                     Zone floor charge / octave-resolution boost).
 * @param {number}  [p.atkDie]        THRASH die size for the attacker (default 6;
 *                                     a Charge Zone ceiling charge bumps it to 8).
 *                                     Ignored when dicePool is provided — Sonic
 *                                     ceilings are baked into the pool client-side.
 */
export function attackRolled(kind, attackerId, defenderId,
  { atkStat, defStat, posing = false, halveDef = false, psychoEligible = false, dicePool = null,
    atkFloor = 0, atkDie = 6 }) {
  return {
    type: ATTACK_ROLLED, kind, attackerId, defenderId,
    atkStat, defStat, posing, halveDef, psychoEligible, dicePool, atkFloor, atkDie,
  };
}

/**
 * Phase 3d — a glanced defender (CQC, margin ≤ 2) swings BACK: the engine rolls
 * the counter d6 on seeded rng, adds the Vibe bonus, and decides success vs the
 * attacker's winning die. Merged into the existing `battle` slice; the spin
 * overlay reads `battle.counterRoll`. Damage application stays client (3c flip).
 * @param {number} vibe/maxVibe  defender's Vibe (drives the bonus) — Phase 5 slice
 * @param {number} target        the attacker's winning die to out-swing (bs.atkRoll)
 */
export function counterRolled(defenderId, { vibe = 1, maxVibe = 1, target = 1 }) {
  return { type: COUNTER_ROLLED, defenderId, vibe, maxVibe, target };
}

/**
 * Phase 5c — a landed hit subtracts Vibe from the target on the engine spirits
 * (floored at 0). The KO/respawn decision is a SEPARATE action so the client can
 * play its cinematic beat between the hit and the fall (as `applyVibeDamage` does
 * today). Damage magnitude is decided upstream (`marginToDamage`, riff verdict,
 * `counterOutcome`); this just applies it.
 */
export function damageApplied(targetId, dmg) {
  return { type: DAMAGE_APPLIED, targetId, dmg };
}

/**
 * Phase 5c — a spirit at 0 Vibe falls. The engine runs the `resolveKnockdown`
 * kernel: respawn at the home corner with full Vibe (a life spent), or, out of
 * lives, KO for good. One action subsumes the doc's RESPAWNED / KNOCKED_OUT — the
 * reducer owns the branch so client & server can never disagree on when a life is
 * spent. (The client still fires `spiritEliminated` + the slide-off on a true KO.)
 */
export function knockdownResolved(targetId) {
  return { type: KNOCKDOWN_RESOLVED, targetId };
}

/**
 * Phase 5c — record the match winner. The boss-aware decision is the pure
 * `decideWinner` kernel (which the client/server runs to get the id); this action
 * just locks the resulting `winner` slice.
 */
export function winnerDeclared(winnerId) {
  return { type: WINNER_DECLARED, winnerId };
}

/** TEMP Phase 5c bridge — push React-owned noteStates mutations into the engine
 *  (full map replace). Mirrors `spiritsSynced`; retired as sites migrate to the
 *  semantic noteStates actions. */
export function noteStatesSynced(noteStates) {
  return { type: NOTE_STATES_SYNCED, noteStates };
}

/**
 * Phase 5c — a spirit's Fame changes by `amount` (signed), floored at 0. One
 * action for the whole fame economy: grants (grantFame, always positive) and the
 * knockdown penalty (−1). The crowd multiplier / underdog ramp / win-check are
 * client orchestration that decide the amount; this just applies it.
 */
export function fameChanged(spiritId, amount) {
  return { type: FAME_CHANGED, spiritId, amount };
}

/**
 * Phase 5c — patch one spirit's FAN block (diehards/casuals/streaks/lag/acted/
 * divineShield). The zone rules, promotion cadence, demolition scatter (incl.
 * its flee roll — an OUTCOME payload, like RIFF_RESULTS_SUBMITTED) and the
 * Unsure pool stay client orchestration for now; the reducer merges ONLY
 * whitelisted fan fields (see FAN_FIELDS in systems/economy.js), so a stray
 * payload can never clobber skills/notes/fame. No-op if the spirit has no sheet.
 */
export function fansChanged(spiritId, fans) {
  return { type: FANS_CHANGED, spiritId, fans };
}

/**
 * Phase 5c — merge a client-computed field patch into ONE spirit's note sheet.
 * This is the generic migration action the `setNoteStates` shim emits (it diffs
 * the updater's result per spirit) in place of full-map NOTE_STATES_SYNCED
 * replaces: same final state, but the replay log carries small, per-spirit,
 * inspectable writes. Sites still graduate to true semantic actions
 * (NOTE_TRACK_CONFIRMED, SKILL_AWARDED, …) as the rules move into reducers;
 * until then every remaining legacy write is at least scoped and serialized.
 */
export function noteSheetPatched(spiritId, patch) {
  return { type: NOTE_SHEET_PATCHED, spiritId, patch };
}

/**
 * Phase 5c — merge a client-computed field patch into ONE spirit (the spirits
 * twin of NOTE_SHEET_PATCHED). Emitted by the `setSpirits` shim's per-spirit
 * diff in place of SPIRITS_SYNCED full replaces: same final state, but the
 * replay log carries small, per-spirit, inspectable writes. Sites still
 * graduate to true semantic actions (VIBE_CHANGED, SPIRIT_MOVED, …) as rules
 * move into reducers; until then every remaining legacy write is scoped and
 * serialized.
 */
export function spiritPatched(spiritId, patch) {
  return { type: SPIRIT_PATCHED, spiritId, patch };
}

/**
 * Phase 5d — the end-of-turn fan tick is an ENGINE RULE (the first noteStates
 * rule to fully move server-side): positional boredom (outer-ring streak →
 * casuals drift), centre-streak upkeep, demolition-lag recovery, and the
 * per-turn fanActedThisTurn reset. The reducer derives the zone from its own
 * spirit position; the client just dispatches at the end-of-turn beat it always
 * did (tick ORDER relative to the other — still client — END_TURN ticks is
 * unchanged; those fold in at Phase 6d). Report rides in `state.turn.lastFanTick
 * { spiritId, zone, lost }` for the client's log/FX.
 */
export function fansTicked(spiritId) {
  return { type: FANS_TICKED, spiritId };
}

/**
 * Phase 6d — end-of-turn debuff countdown. Clears tripped/dazed/instrumentDropped,
 * decrements mojoDrain, and ticks stagger's turnsLeft. Pure — no rng. The report
 * in `state.turn.lastDebuffTick` lets the client log what cleared.
 */
export function debuffsTicked(spiritId) {
  return { type: DEBUFFS_TICKED, spiritId };
}

/**
 * Phase 6d — end-of-turn burn tick. The engine flips a 50/50 rng coin: heads →
 * 1 Vibe damage (applied directly to engine spirits, like DAMAGE_APPLIED); always
 * decrements burn.turnsLeft. The report in `state.turn.lastBurnTick` carries
 * `{ spiritId, burnDamage, turnsLeft, expired }` for the client's log/FX.
 * If the burn damage reduces Vibe to 0 the client dispatches KNOCKDOWN_RESOLVED
 * after its 80ms cinematic delay (same pattern as combat damage).
 */
export function burnTicked(spiritId) {
  return { type: BURN_TICKED, spiritId };
}

/**
 * Phase 6b — a Fame threshold (⭐8/16/24) was crossed: the engine records the
 * fired threshold (exactly-once, replacing the client firedRef Set) and draws
 * the next effect off the SEEDED deck. The client reads the report off
 * `state.stageFx.lastDraw` and runs the activation cinematic; the crossing
 * detection itself stays in grantFame until fame thresholds move engine-side.
 */
export function stageFxDrawn(threshold) {
  return { type: STAGE_FX_DRAWN, threshold };
}

/**
 * Phase 6b — the drawn effect goes LIVE: the engine creates the active-effect
 * state (state.stageFx.smoke/laser/pyro/animatronics), rolling beam patterns /
 * pyro hexes / animatronic spawns on ENGINE rng. `occupied` = hex nums the
 * animatronics must avoid (spirits + amps — amps are still client-owned, so
 * the client passes the list; the RIFF_RESULTS context pattern). The client
 * plays the activation cinematic off `state.stageFx.lastActivation`.
 */
export function stageFxActivated(fxId, occupied = []) {
  return { type: STAGE_FX_ACTIVATED, fxId, occupied };
}

/**
 * Phase 6b — per-TURN stage-FX cadence (pyro arm→erupt→re-arm; animatronic
 * steps/slams/expiry) as an engine rule. Dispatched at the same end-of-turn
 * beat the client ticked before; report in `state.stageFx.lastTurnTick`.
 */
export function stageFxTurnTicked() {
  return { type: STAGE_FX_TURN_TICKED };
}

/**
 * Phase 6b — per-ROUND stage-FX cadence (smoke spreads/clears; lasers
 * re-pattern/power down) as an engine rule. Report in
 * `state.stageFx.lastRoundTick`.
 */
export function stageFxRoundTicked() {
  return { type: STAGE_FX_ROUND_TICKED };
}

/**
 * Phase 6c — the Rock God opens a new attack: a weighted draw over its deck
 * (no immediate repeat) on ENGINE rng. The client passes the context it still
 * owns (godId + the last attack id — the ATTACK_ROLLED pattern) and reads the
 * decided id off `state.rockGod.lastPick`; telegraphs/cinematics stay client.
 */
export function godAttackPicked(godId, lastAttackId = null) {
  return { type: GOD_ATTACK_PICKED, godId, lastAttackId };
}

/**
 * Phase 6c — ONE Rock God per game descends to the Limelight. The god pick
 * (`pickRockGod`) stays client — it reads amps, still React-owned — and rides
 * in the payload; the engine owns the flag, the god object, and scales HP off
 * its own living-spirit count. Squatter shove + pageantry stay client.
 */
export function godSummoned(leaderId, godId) {
  return { type: GOD_SUMMONED, leaderId, godId };
}

/**
 * Phase 6c — a Spirit's strike lands on the God. `dmg` is RAW chord-drive
 * damage; the reducer owns the winded ×2 and the HP floor. Read the final
 * number off `state.rockGod.lastHit` for the log + Fame grant.
 */
export function godDamaged(spiritId, dmg) {
  return { type: GOD_DAMAGED, spiritId, dmg };
}

/**
 * Phase 6c — the God's end-of-turn answer: telegraph resolve / winded
 * recovery / new attack (weighted engine-rng pick; mosh shoves move the
 * engine spirits). The client renders `state.rockGod.lastAct`.
 */
export function godActed() {
  return { type: GOD_ACTED };
}

/** Phase 6c — the God falls (locks outcome:'spirits'); crowning stays client. */
export function godDefeated(killerId) {
  return { type: GOD_DEFEATED, killerId };
}

/** Phase 6c — every Spirit is down; the God keeps the crown (outcome:'god'). */
export function godTriumphed() {
  return { type: GOD_TRIUMPHED };
}

/**
 * Phase 6c — the boss clock died on the acting human. The countdown itself is
 * CLIENT (the retaliation-timer pattern); this action is the replay-log seam.
 * The Vengeance damage flows through DAMAGE_APPLIED like any hit.
 */
export function godTimerExpired(spiritId) {
  return { type: GOD_TIMER_EXPIRED, spiritId };
}

// ── Phase 6a: board state ───────────────────────────────────────────────────
// TEMP full-replace bridge so the client can flip board state (spotlight, events,
// tokens, charges, flaming hexes) to an engine view cheaply. Semantic actions
// below retire each bridge site; this bridge dies with them.
export const BOARD_SYNCED = "BOARD_SYNCED";

export function boardSynced(board) {
  return { type: BOARD_SYNCED, board };
}

// ── Phase 6a: board SEMANTIC actions (retire the bridge site by site) ────────

/** Spotlight heal: acting spirit ends turn on the spotlight hex → +1 Vibe. */
export const SPOTLIGHT_HEALED = "SPOTLIGHT_HEALED";
export function spotlightHealed(spiritId) {
  return { type: SPOTLIGHT_HEALED, spiritId };
}

/** Spotlight moves to a new hex at round end. `occupied` = spirit+amp hexes. */
export const SPOTLIGHT_MOVED = "SPOTLIGHT_MOVED";
export function spotlightMoved(occupied = []) {
  return { type: SPOTLIGHT_MOVED, occupied };
}

/** Scatter fresh Lost Chord tokens at round end. `occupied` = everything.
 *  `aliveCount` / `totalPlayers` drive the resonance-scaling formula. */
export const TOKENS_SCATTERED = "TOKENS_SCATTERED";
export function tokensScattered(occupied = [], aliveCount, totalPlayers) {
  return { type: TOKENS_SCATTERED, occupied, aliveCount, totalPlayers };
}

/** Disco Inferno flames decay one round. */
export const FLAMING_DECAYED = "FLAMING_DECAYED";
export function flamingDecayed() {
  return { type: FLAMING_DECAYED };
}

/** Event marquee respawn countdown ticks once per spirit turn. */
export const EVENT_RESPAWN_TICKED = "EVENT_RESPAWN_TICKED";
export function eventRespawnTicked() {
  return { type: EVENT_RESPAWN_TICKED };
}

/** A new marquee event hex spawns (when respawn counter hits 0). `occupied` =
 *  everything that should be avoided. */
export const EVENT_HEX_SPAWNED = "EVENT_HEX_SPAWNED";
export function eventHexSpawned(occupied = []) {
  return { type: EVENT_HEX_SPAWNED, occupied };
}

/** Charge zone cooldowns tick once per spirit turn. */
export const CHARGE_ZONES_TICKED = "CHARGE_ZONES_TICKED";
export function chargeZonesTicked() {
  return { type: CHARGE_ZONES_TICKED };
}

/** A spirit steps on a marquee event hex — hex is consumed, respawn timer set. */
export const EVENT_HEX_TRIGGERED = "EVENT_HEX_TRIGGERED";
export function eventHexTriggered(spiritId, hexNum) {
  return { type: EVENT_HEX_TRIGGERED, spiritId, hexNum };
}

/** A successful Thrash hit knocks Lost Chords loose around the defender. */
export const THRASH_TOKENS_SPAWNED = "THRASH_TOKENS_SPAWNED";
export function thrashTokensSpawned(defenderHex, occupied, crashTier) {
  return { type: THRASH_TOKENS_SPAWNED, defenderHex, occupied, crashTier };
}

/** A spirit picks up a Lost Chord token — token is removed from the board. */
export const TOKEN_PICKED_UP = "TOKEN_PICKED_UP";
export function tokenPickedUp(spiritId, hexNum) {
  return { type: TOKEN_PICKED_UP, spiritId, hexNum };
}

/** A spirit taps a charge zone — cooldown is set. */
export const CHARGE_ZONE_USED = "CHARGE_ZONE_USED";
export function chargeZoneUsed(spiritId, hexNum) {
  return { type: CHARGE_ZONE_USED, spiritId, hexNum };
}

/** Disco Inferno event fires — places flaming discs on random hexes. */
export const FLAMING_HEXES_SET = "FLAMING_HEXES_SET";
export function flamingHexesSet(hexes, rounds) {
  return { type: FLAMING_HEXES_SET, hexes, rounds };
}

// ── Phase 6 remaining: event resolution rng ─────────────────────────────────
// Generic "draw N raw random values from the engine rng" action. The client
// dispatches this BEFORE event resolution (resolveActiveEvent / pickTrivia / bot
// trivia odds) and reads the drawn [0,1) floats off `state.lastRandomBatch`.
// Every draw is in the action log -> replay-deterministic. The client turns them
// into d6 / pool-picks / odds checks as needed.
export const RANDOM_BATCH_DRAWN = "RANDOM_BATCH_DRAWN";
export function randomBatchDrawn(count) {
  return { type: RANDOM_BATCH_DRAWN, count };
}

// ── Phase R5: headliner ─────────────────────────────────────────────────────
/** The Headliner title transfers to a new spirit (riff-off winner) or is
 *  vacated (null). Engine-owned so it replays deterministically. */
export function headlinerChanged(spiritId) {
  return { type: HEADLINER_CHANGED, spiritId };
}
