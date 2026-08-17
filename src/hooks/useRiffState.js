import { useState } from "react";

// ─── CADENCE / OVERLAY STATE ─────────────────────────────────────────────────
// 🪦 WAS "RIFF STATE" until 2026-08-17. `riffBook`, `riffBanner`, `riffbookTab`
// and `legacyPlayingId` all served the legendary-riff library and went with it
// (see `engine/systems/melodyCommit.js` for why). What is left is the cadence
// toast and the two overlay flags, which have nothing to do with riffs.
// Owns the cadence toast and the cadence-book / Pure state slice — values + setters only;
// the logic that drives these still lives in Game and consumes the setters.
// Extracted verbatim from Game (no behavior change: a custom hook shares the
// component's state and preserves hook-call order).
export function useRiffState() {
  const [showRiffbook, setShowRiffbook] = useState(false);
  // 🗡️ Signature-abilities reference overlay — holds the spiritId being viewed.
  const [signatureSpirit, setSignatureSpirit] = useState(null);
  // cadenceToast: { cadenceId, spiritId, fans } — toast after resolving a cadence objective
  // (pays fans, not FP — cadences are a melody-line feat; see ECONOMY_HANDOFF.md)
  const [cadenceToast, setCadenceToast] = useState(null);

  return {
    showRiffbook, setShowRiffbook,
    signatureSpirit, setSignatureSpirit,
    cadenceToast, setCadenceToast,
  };
}
