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

// 🛑 `ULTIMATE_PREREQS` AND THE `pa` CHAIN GATE WERE DELETED ON 2026-08-20, and
// the reason is worth keeping because it is `CLAUDE.md`'s standing warning
// landing for the second time.
//
// The list was `["mic", "pedal_dist", "amp_1", "mixer"]`. THREE OF THOSE FOUR IDS
// ARE NOT IN THE SKILL TREE and have not been for a long time; the fourth went
// with the rig branch. And no skill anywhere carried `prereq: '__all_pa__'`, so
// the gate could not fire even if the ids had existed. It was nonetheless GREEN
// in `selftest` — against a fake tree written to match the gate rather than the
// game. That is §15 exactly: "a passing test is not evidence a rule is real".
//
// Deleted rather than left with a warning, so that archived code trying to
// revive an Ultimate fails loudly instead of silently gating on ghosts. If a
// capstone is ever wanted, write the prereq list against skills that exist.

// 🪦 `THEORY_DISCORD_GRANTS` WAS DELETED HERE ON 2026-09-02, WITH THE BRANCH.
//
// It was `{ theory_dom7: ['discord_1'], theory_modes: ['discord_3'],
// theory_chromatic: ['discord_2','discord_4'] }` — the table that turned a Theory
// purchase into the colour-note ids `playableScale` and the ending bonuses read.
// All three keys are ids no route sells any more, so the table could only ever
// have looked up nothing.
//
// ⚠️ `discordUnlocks` ITSELF IS STILL LIVE AND STILL READ. `melodyCommit.js` uses
// it for the gated endings (minor-7th, major-3rd, tritone) via
// `DISCORD_INTERVAL_MAP`, and nothing granted those ids except this table — so
// **those three endings are now unreachable for every Spirit**, exactly as the
// six Theory unlock logs are unprintable. That is a real hole rather than dead
// code, and it is `PROGRESSION_REWRITE_DESIGN.md` §4's job: the ending becomes a
// fork (resolve for Db, or land on colour for Drive/Sustain) and colour notes stop
// being something you unlock at all. ⛔ §4 IS NOT BUILT. Until it is, the ending
// bonus is the plain `scoreTrackDB` one for everybody.
//
// Deleted rather than emptied, so archived code reviving a Theory grant fails to
// import instead of quietly granting nothing.

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
 *
 * 📌 THREE GATES, NOT FIVE. The Ultimate and PA-chain branches were deleted on
 * 2026-08-20 — see the note at the top of this file. What is left is: do you
 * already own it, is it somebody else's exclusive route, and are its prereqs met.
 *   reason ∈ 'unknown' | 'already' | 'owner' | 'prereq'
 */
export function skillEligibility(skill, unlocked, { ownerRoute = null, selfId = null } = {}) {
  if (!skill) return { ok: false, reason: "unknown" };
  if (unlocked.includes(skill.id)) return { ok: false, reason: "already" };
  if (ownerRoute && ownerRoute !== selfId) return { ok: false, reason: "owner" };
  // Multi-prereq: prereq can be a string or an array of strings (all must be unlocked).
  if (skill.prereq) {
    const prereqs = Array.isArray(skill.prereq) ? skill.prereq : [skill.prereq];
    const missing = prereqs.filter(id => !unlocked.includes(id));
    if (missing.length) return { ok: false, reason: "prereq", missing: missing };
  }
  return { ok: true };
}
