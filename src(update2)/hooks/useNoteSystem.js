import { useState } from "react";

// ─── NOTE SYSTEM STATE ───────────────────────────────────────────────────────
// Owns noteStates — the per-spirit note-track / harmonic-charge / fame / fan
// sub-state map that is the heart of a turn. The lazy initializer is passed in
// from Game (it closes over gameState + makeInitialNoteState) so this hook stays
// decoupled. All the note-track logic still lives in Game. Pure slice.
export function useNoteSystem(initialNoteStates) {
  const [noteStates, setNoteStates] = useState(initialNoteStates);

  return { noteStates, setNoteStates };
}
