import { useState } from "react";

// ─── RIFF STATE ──────────────────────────────────────────────────────────────
// Owns the riffbook discoveries, the riff/cadence toasts, and the riffbook /
// signature-abilities overlay UI state. Pure state slice — values + setters only;
// the logic that drives these still lives in Game and consumes the setters.
// Extracted verbatim from Game (no behavior change: a custom hook shares the
// component's state and preserves hook-call order).
export function useRiffState() {
  // riffBook: global discoveries — riffId → spiritId of the first player to find it
  const [riffBook, setRiffBook] = useState({});
  // riffBanner: { riffId, spiritId, fp, isNew } — toast after a riff fires
  const [riffBanner, setRiffBanner] = useState(null);
  const [showRiffbook, setShowRiffbook] = useState(false);
  // 🗡️ Signature-abilities reference overlay — holds the spiritId being viewed.
  const [signatureSpirit, setSignatureSpirit] = useState(null);
  // 'discoveries' = player view (hidden riffs stay ???) · 'legacy' = full designer codex
  const [riffbookTab, setRiffbookTab] = useState('discoveries');
  const [legacyPlayingId, setLegacyPlayingId] = useState(null); // riff currently auditioning in the codex
  // cadenceToast: { cadenceId, spiritId, fp } — toast after resolving a cadence objective
  const [cadenceToast, setCadenceToast] = useState(null);

  return {
    riffBook, setRiffBook,
    riffBanner, setRiffBanner,
    showRiffbook, setShowRiffbook,
    signatureSpirit, setSignatureSpirit,
    riffbookTab, setRiffbookTab,
    legacyPlayingId, setLegacyPlayingId,
    cadenceToast, setCadenceToast,
  };
}
