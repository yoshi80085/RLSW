// ─── ENGINE ACTIONS ──────────────────────────────────────────────────────────
// Action type constants + creators. Payloads must be plain-JSON serializable
// (they will cross the network / be written to replay logs verbatim).
//
// Growth plan (see src/MULTIPLAYER_HANDOFF.md §5): each extraction phase adds
// its action types here. Phase 1 defines only GAME_INIT.

export const GAME_INIT = "GAME_INIT";

// Phase 2 (turn & movement):  MOVE, FACE, END_TURN, …
// Phase 3 (combat):           SWING, SONIC_ATTACK, SMASH, ROLL_RESOLVED, …
// Phase 4 (riff-off):         RIFF_OFF_STARTED, RIFF_RESULTS_SUBMITTED,
//                             BEAM_CLASH_RESOLVED, …
// Phase 5 (economy/skills):   COMMIT_TRACK, VOICE_CHORD, PLAY_MOD_CARD, …
// Phase 6 (events/FX/god):    EVENT_DRAWN, STAGE_FX_TICK, GOD_ATTACK, …

/** Mark the state as initialized (a no-op record for the replay log's head). */
export function gameInit() {
  return { type: GAME_INIT };
}
