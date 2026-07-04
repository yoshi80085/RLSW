import { useState } from "react";

// ─── BOARD CARD / DEPLOYABLES STATE ──────────────────────────────────────────
// Owns the on-board deployable state: amps, face-down board cards + respawn
// counter, the pending card-pickup choice, roadie action/animations, and the
// amp-placement targeting flag. Driving logic stays in Game. Pure slice.
export function useBoardState() {
  // amps: array of { id, ownerId, ownerColor, hexNum, connected }
  const [amps, setAmps] = useState([]);
  // boardCards: [{ id, hexNum, spawnTurn }] — face-down cards on the board
  const [boardCards, setBoardCards] = useState([]);
  // cardRespawnIn: turns until next spawn attempt (counts down in endTurn)
  const [cardRespawnIn, setCardRespawnIn] = useState(1);
  // pendingCardPickup: { spiritId, cardType, cardId } — waiting for keep/replace/discard choice
  const [pendingCardPickup, setPendingCardPickup] = useState(null);
  // roadieAction: { spiritId, roadieId, phase:'selectHex'|'selectDir', adjHexNum? }
  const [roadieAction, setRoadieAction] = useState(null);
  // roadieAnimations: active roadie token slide animations on the SVG board
  const [roadieAnimations, setRoadieAnimations] = useState([]);
  // ampPlacing: spiritId waiting to click a neighbor hex to drop their new amp
  const [ampPlacing, setAmpPlacing] = useState(null);

  return {
    amps, setAmps,
    boardCards, setBoardCards,
    cardRespawnIn, setCardRespawnIn,
    pendingCardPickup, setPendingCardPickup,
    roadieAction, setRoadieAction,
    roadieAnimations, setRoadieAnimations,
    ampPlacing, setAmpPlacing,
  };
}
