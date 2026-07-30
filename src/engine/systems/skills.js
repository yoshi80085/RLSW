// ─── ENGINE SYSTEM: SKILLS ───────────────────────────────────────────────────
// Phase 5b: the pure skill-tree GATING + grant tables, extracted so the human
// overlay (`setSkillTarget`) and the bot (`botSkillEligible`) score eligibility
// from ONE source instead of two hand-kept-in-sync copies (they had already
// drifted — the bot checked owner-only routes, the human didn't). Same trick as
// `smashOutcome`.
//
// Everything here is pure data / pure functions: no React, no FX, no logging.
// The actual *effects* of unlocking a skill (Vibe restores, amp/roadie deploys,
// the +1-Drive CQC buff, log lines) stay in `Game.applySkillEffects` for now —
// they're side effects, and their state writes land in the Phase-5c flip.

// The Ultimate ('__all_pa__') opens only once the whole PA chain is unlocked.
export const ULTIMATE_PREREQS = ["mic", "pedal_dist", "amp_1", "mixer"];

// THE LADDER — climbing a Theory skill also grants the colour-note capabilities
// (discordUnlocks + the matching unlockedSkills flags) the scoring logic reads.
// Pure lookup: skillId → discord-tier ids to grant.
//
// ⚠️ WHAT THESE IDS DO **NOT** DO ANY MORE. They are purely SCALE-EXPANSION flags
// gating `playableScale` — which notes the game will deal you and paint as clean.
// Every other job they once held is gone:
//   • B1 removed the four combat riders (Mojo Drain, Burn, cleanse/shield, Stagger).
//   • B3 moved the real mechanic to the chord-context ladder, which reads
//     `unlockedSkills` directly via `CONTEXT_TIERS` and never looks at these ids.
//   • B5 deleted the tritone's damage effect; `discord_3` now only makes the
//     tritone clean and pays +1 Performance Score.
//   • B6 turned `discord_4`'s chromatic pardon into a Db PAYOUT (`chromaticPayout`)
//     and deleted the blanket "whole track counts as clean" rule it used to apply.
// So: adding an id here widens the PALETTE. It does not widen the pardon, and it
// does not pay anything. The pardon lives in `music/context.js`.
//
// ⚠️ AND NOTE THE ASYMMETRY: `theory_minor` is absent from this table but is the
// FIRST rung of the context ladder (Chord Tone Pardon). Its scale expansion is
// handled directly in `playableScale` rather than through a discord id. Don't read
// this table as the list of Theory tiers — it isn't one.
export const THEORY_DISCORD_GRANTS = {
  theory_dom7:      ["discord_1"],              // ♭7 clean
  theory_modes:     ["discord_3"],              // tritone clean
  theory_chromatic: ["discord_2", "discord_4"], // maj3 + chromatic clean
};

// (CQC_SWING_MAP removed — the CQC branch + %-proc swing effects were CUT in
// the Stance rework; see STANCE_SYSTEM_DESIGN.md §8.)

/**
 * Pure skill-tree gating. Returns a structured verdict both callers can consume:
 * the bot reads `.ok`; the human overlay maps `.reason` (+ `.missing` for the
 * Ultimate case) to its error toast.
 *
 * @param skill     a SKILL_BY_ID entry: { id, prereq?, chainId?, routeId?, … }
 * @param unlocked  the spirit's `unlockedSkills` array
 * @param opts.ownerRoute  SPIRIT_ONLY_ROUTE[skill.routeId] (or null) — the owner
 *                         gate the bot enforces; pass null to skip it (human path,
 *                         which only ever offers the player their own skills)
 * @param opts.selfId      the spirit choosing (only used with ownerRoute)
 * @returns { ok, reason?, missing? }
 *   reason ∈ 'unknown' | 'already' | 'owner' | 'ultimate' | 'prereq' | 'pa'
 */
export function skillEligibility(skill, unlocked, { ownerRoute = null, selfId = null } = {}) {
  if (!skill) return { ok: false, reason: "unknown" };
  if (unlocked.includes(skill.id)) return { ok: false, reason: "already" };
  if (ownerRoute && ownerRoute !== selfId) return { ok: false, reason: "owner" };
  if (skill.prereq === "__all_pa__") {
    const missing = ULTIMATE_PREREQS.filter(id => !unlocked.includes(id));
    return missing.length ? { ok: false, reason: "ultimate", missing } : { ok: true };
  }
  // Multi-prereq: prereq can be a string or an array of strings (all must be unlocked).
  if (skill.prereq && skill.prereq !== '__all_pa__') {
    const prereqs = Array.isArray(skill.prereq) ? skill.prereq : [skill.prereq];
    const missing = prereqs.filter(id => !unlocked.includes(id));
    if (missing.length) return { ok: false, reason: "prereq", missing: missing };
  }
  if (skill.chainId === "pa" && skill.id !== "amp_1" && !unlocked.includes("amp_1")) {
    return { ok: false, reason: "pa" };
  }
  return { ok: true };
}
