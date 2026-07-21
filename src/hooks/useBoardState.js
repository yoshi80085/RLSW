import { useState } from "react";

// ─── BOARD CARD / DEPLOYABLES STATE ──────────────────────────────────────────
// Owns the on-board deployable state: face-down board cards + respawn counter,
// and the pending card-pickup choice. Driving logic stays in Game. Pure slice.
export function useBoardState() {
  // boardCards: [{ id, hexNum, spawnTurn }] — face-down cards on the board
  const [boardCards, setBoardCards] = useState([]);
  // cardRespawnIn: turns until next spawn attempt (counts down in endTurn)
  const [cardRespawnIn, setCardRespawnIn] = useState(1);
  // pendingCardPickup: { spiritId, cardType, cardId } — waiting for keep/replace/discard choice
  const [pendingCardPickup, setPendingCardPickup] = useState(null);
  return {
    boardCards, setBoardCards,
    cardRespawnIn, setCardRespawnIn,
    pendingCardPickup, setPendingCardPickup,
  };
}
