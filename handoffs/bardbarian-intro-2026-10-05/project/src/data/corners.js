// ─── CORNERS ──────────────────────────────────────────────────────────────────
export const CORNERS = {
  blue:   { homeNum:7   },
  purple: { homeNum:12  },
  yellow: { homeNum:100 },
  red:    { homeNum:105 },
};

// ─── CORNER LABELS ────────────────────────────────────────────────────────────
export const CORNER_LABELS = {
  blue:   { label:"Blue Corner",   color:"#4488ff" },
  purple: { label:"Purple Corner", color:"#aa55ff" },
  yellow: { label:"Yellow Corner", color:"#ffcc00" },
  red:    { label:"Red Corner",    color:"#ff6600" },
};

export const CORNERS_ORDER = ["blue","purple","yellow","red"];

// 🎨 THE ONLY COLOUR A SPIRIT HAS IS ITS PLAYER'S (Alex, 2026-09-25). A seat's
// corner decides it: P1 blue, P2 orange (the "red" corner, #ff6600), then purple
// and yellow. `SPIRIT_DEFS` carries no colour at all — see `data/spirits.js`.
// 📌 `NEUTRAL_SPIRIT_COLOR` is for a Spirit with no seat yet (a roster card
// before anyone is choosing); it is deliberately no player's colour.
export const NEUTRAL_SPIRIT_COLOR = "#9fb4cd";
export const playerColor = (corner) => CORNER_LABELS[corner]?.color ?? NEUTRAL_SPIRIT_COLOR;
