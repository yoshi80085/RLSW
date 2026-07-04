# RLSW — Economy & Board-Objectives Handoff

Pick-up notes for continuing the FP / HC / Fan separation work. Read this +
`ARCHITECTURE.md` (where things live) + `DESIGN_AUDIT_v2.md` (combat thesis)
and you're caught up — this doc exists so the fan/FP design conversation
doesn't need to be re-run every session.

---

## The big idea

Three currencies, three single-purpose taps. Before this pass they were
tangled (a battle win handed out both FP *and* fans in the same breath;
cadences and trivia paid FP/HC despite being melody or knowledge feats, not
combat or performance). The rule going forward:

- **Fame Points (FP)** — battles only. `fameFromMargin(margin)` scaled by the
  crowd multiplier (already existed). Also the Limelight hold payout and the
  Azrael knockdown-streak bonus (both battle-adjacent; left as-is).
- **Harmonic Charge (HC)** — performance only. How well you build/commit your
  melody line (`scoreTrackHC` + the small `perfHcBonus` flair top-up). Trivia
  used to pay HC — moved to fans (see below), since knowing rock history
  isn't melodic skill.
- **Fans** — the catch-all for everything expressive/social: performance
  quality (`perfExciteGain`), stage position (`gainFans`, ring-based), trivia
  knowledge, and now cadence completion.

This maps onto the existing two-axis frame in `DESIGN_AUDIT_v2.md` §6.1
(melody→movement, harmony→combat): extend it one step further —
**melody/performance → fans, harmony/combat → fame.**

Every payout should still pass the STICs + Earned checklist now living in
`ARCHITECTURE.md` — check there before adding a new one.

---

## Status — this session's decisions

✅ = built this session · 🔜 = designed and locked, not yet built · 💬 = discussed, still open

| Decision | Status | Where |
|---|---|---|
| Battles grant FP only (no more fan-gain side effect on a win) | ✅ | `awardFame` |
| Cadence completion pays fans, not FP | ✅ | cadence resolution (was `grantFame(…, cadence.fp, …)`) |
| Trivia/marquee correct answer pays fans, not HC | ✅ | `answerTrivia`, bot branch of `checkEventTrigger` |
| Lighters removed entirely (were unearned instant FP) | ✅ | `makeBoardToken`, `checkTokenPickup` |
| Low-performance fan loss generalized beyond Ronin (streak-based, mirrors positional boredom decay) | ✅ | `confirmNoteTrack` perf block |
| Note Stock: used/empty slots visually distinct from discord notes (no more "both look dark") | ✅ | Note Stock render (~line 8500) |
| Note Stock refill: pop-in animation + "+N notes" flash + log line | ✅ | `startNewTurnNotes`, `GameStyles.jsx` |
| **Charge zones** — 3 fixed (non-roaming) board hexes, lightning-bolt visual pulsing up from the board (blue palette matching the Sonic-beam hue, not a new color), picked up as an objective. Base effect: temporary die-tier boost, reusing the existing "Goes to Eleven" `elevenTurns` field (proven, on-theme, doesn't touch chord-derived Drive/Sustain). Zones don't vanish on pickup — they go on a cooldown and relight. Upgrade path: the new Electric-route skill "Overcharge" (sits beside Amp I/II/III, prereq `amp_2`) lets the player instead choose the chord-assist option below via a small pick-one modal. | ✅ | `chargeZones` state, `checkChargeZonePickup`, `grantChargeBoost`, `SKILL_TREE.electric.overcharge` |
| **Chord-assist option for charge** (the Overcharge alternative) — grants ONE extra Chord Stack note, curated toward the current chord via the same weighted-candidate logic the bot's revoice planner uses (`curatedChordNote`), *and* an extra revoice this turn to spend on it. Kept as its own `bonusRevoiceAvailable` flag (not `revoiceUsedThisTurn`) with a dedicated, visibly-labeled "⚡ BONUS REVOICE" widget in the Actions panel — so it reads as a separate one-shot, not a second free budget. Expires unspent at the start of the spirit's next turn. | ✅ | `grantChargeChordAssist`, `curatedChordNote`, `spendBonusRevoiceAdd`/`spendBonusRevoiceDrop` |
| **Lost Chord pickup**: reuses the Note Stock pop-in animation (`freshNoteIdx`, same treatment as a turn-start refill) so the note visibly arrives instead of silently splicing in. Landing on a token now opens a small modal — "add to Chord Stack" (spends this turn's one revoice) vs. "bank it" (stock, as before). If the revoice is already spent, the modal is skipped and it auto-banks (still animated). Ronin's 50% bonus note always banks to stock regardless of choice. | ✅ | `checkTokenPickup`, `bankLostChordNote`, `resolveLostChordPickup`, `pendingLostChordPickup` modal |
| Legendary riffs still pay FP directly (`grantFame` off `detectRiff`) | 💬 open | Same "melody feat, not a battle" argument as cadences applies here — never explicitly decided. Don't change without asking. |
| Limelight hold payout, Azrael streak bonus | kept as FP | Both are battle/combat-adjacent, not melody feats — deliberately left alone as the two non-battle-win FP taps. |

---

## Design lenses used throughout

Every item above was run through **STICs + Earned** (now formalized in
`ARCHITECTURE.md`) before being locked in. The recurring failure mode this
session was **laundering a free handout through an earned-looking mechanic**
— e.g. auto-picking a "good note" for a player, or letting a board tile grant
a second revoice per turn. The fix pattern that kept working: hand out **raw
material** (a note, an extra opportunity) freely, but require the **decision**
(which note, whether to spend it) to stay the player's.

---

## Next session

All three 🔜 items from the last session (Charge zones, the Overcharge
chord-assist alternative, Lost Chord choice-on-pickup) are now built — see
the table above. Nothing is currently 🔜; the only open item is the 💬 one
(legendary riffs paying FP directly) which still needs a decision, not code.

Untested by this session (no dev server access — see the verification quirk
below): the Overcharge choice modal, the bonus-revoice widget's stock-index
bookkeeping when notes are staggered/mixer-doubled, and charge-zone hex
placement not overlapping Lost Chords/event hexes on unlucky RNG. Worth a
few real turns in `npm run dev` before calling this fully done — in
particular, confirm the ⚡ BONUS REVOICE widget's stock chips line up with
the same note the player thinks they're clicking (stock index vs. displayed
value) once staggered slots are in the mix.

Also worth a design pass: `SPOTLIGHT_POOL`/board-token respawn and
`spawnEventHex` now all exclude `chargeZones` hexes from their placement
pools, but the reverse isn't enforced (charge zones only exclude tokens at
*setup*, not on every board-token respawn tick) — a Lost Chord could still
scatter onto a charge-zone hex later in a long game. Low-stakes (worst case
a token and a zone icon overlap visually) but flag it if it looks off.

## ⚠️ Verification quirk (same as the other handoff docs)

The shell (`mcp__workspace__bash` / equivalent) serves a **truncated
mid-write snapshot** of files edited through the canonical file tools — a
whole-file bundle can spuriously fail on EOF even when the real file is fine.
Read/search with the file tools + Grep (canonical). Validate risky edits by
isolate-compiling just the changed function. **Final truth is `npm run dev`,
run by the user** — this session cannot run the dev server itself.
