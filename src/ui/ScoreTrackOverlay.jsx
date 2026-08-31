// ─── ❤️ LIVES ────────────────────────────────────────────────────────────────
//
// 🪦 THIS FILE USED TO BE THE SCORE TRACK OVERLAY, and the whole of it was one
// idea: each corner of the board art has a five-slot track painted into it, and
// a spirit's remaining lives were shown by parking a coloured blip on the slot
// that matched the count. `SCORE_TRACK_CORNERS` below is what is left of it —
// four hand-measured slot lists in board-SVG coordinates.
//
// ⚠️ IT WAS RETIRED 2026-08-31, AND NOT BECAUSE IT WAS UGLY. It failed at the
// only job it had. A 4.5px dot, parked in the outer corner of a board the player
// is not looking at, encoding a number BY POSITION against an unlabelled track —
// so reading it meant knowing the track had five slots and counting inward from
// the end. Three separate things had to go right before it told you anything,
// and the thing it was telling you is how close a spirit is to being out of the
// game. Alex's call: put it in the HUD, on the row it actually belongs to.
//
// 📌 WHERE IT WENT: `LifePips`, below, beside the 💗 VIBE label on the player
// card and on every rival row. That is the mechanically honest home — Vibe
// reaching zero is the event that SPENDS a life, so the counter that shows how
// many are left belongs next to the bar that spends them. Two tutorial pages
// already point at `vibe-bar` and both of them talk about lives
// (`rlsw-simulator-v3_8_1.jsx` ~2316, ~2317); they now point at something that
// shows lives.
//
// 🎨 THE COLOUR CHANGED ON PURPOSE. The blip used `CORNER_LABELS[corner].color`,
// because out at the board's edge the corner was the only thing identifying
// whose blip it was. Inside a card that already carries the spirit's portrait,
// name and coloured border, identity is settled before the pips are reached, so
// they take `s.color` and match the card they sit in.
//
// ⚠️ `SCORE_TRACK_CORNERS` IS KEPT DELIBERATELY. Those coordinates were measured
// against `board.png` by hand and cannot be recovered by reasoning if the art is
// ever re-cut. Nothing imports it today. Delete it only alongside the board art
// it describes.

/** Hand-measured slot positions of the five-step track painted into each corner
 *  of the board art, in board-SVG coordinates. See the ⚠️ above before removing. */
export const SCORE_TRACK_CORNERS = {
  blue:   { slots: [{x:138.1,y:175.0},{x:138.1,y:157.8},{x:153.1,y:149.8},{x:153.6,y:132.6},{x:168.6,y:124.3}] },
  yellow: { slots: [{x:641.4,y:175.3},{x:641.3,y:158.3},{x:626.4,y:150.0},{x:626.4,y:132.7},{x:613.7,y:126.6}] },
  purple: { slots: [{x:171.0,y:454.9},{x:154.8,y:446.4},{x:154.8,y:428.2},{x:139.1,y:419.3},{x:139.0,y:400.8}] },
  red:    { slots: [{x:613.2,y:455.5},{x:628.3,y:447.0},{x:628.3,y:429.6},{x:643.6,y:421.0},{x:643.1,y:403.3}] },
};

/**
 * ❤️ LIFE PIPS — how many lives this spirit has left, as filled and hollow dots.
 *
 * @param lives          lives remaining right now
 * @param startingLives  how many the match began with — sets the number of dots
 * @param color          the spirit's own colour (NOT the corner's — see 🎨 above)
 * @param size           pip diameter in px
 *
 * ⚠️ THE SPENT PIPS STAY ON SCREEN. Rendering only the lives you still have
 * makes three-of-three and one-of-one look identical, which is the exact
 * confusion that matters most — one is a full health bar and the other is a
 * spirit one knockdown from leaving the game. The hollow dots ARE the warning.
 *
 * 📌 The pip count comes from `startingLives`, not from a constant: a match can
 * be configured for 2 (`matchSetup.js`), and `fameToWin` is derived from the
 * same number, so a hard-coded 3 here would disagree with the Fame target on the
 * card directly above it.
 *
 * ⚠️ `Math.max` GUARDS AGAINST A GAIN, not against bad data. Nothing grants a
 * life today, but if anything ever does, a spirit on 4 of 3 should grow a fourth
 * pip rather than silently cap and read as though it gained nothing.
 */
export function LifePips({ lives, startingLives = 3, color = "#ffffff", size = 5, title }) {
  const total = Math.max(0, startingLives, lives ?? 0);
  const left  = Math.max(0, lives ?? 0);
  const last  = left <= 1 && left > 0;   // one bad turn from out — this is the alarm
  const lit   = last ? "#ff2a2a" : color;
  return (
    <span
      title={title ?? `${left} of ${total} li${total === 1 ? "fe" : "ves"} left`}
      style={{ display: "inline-flex", alignItems: "center", gap: Math.max(1.5, size * 0.34),
        flexShrink: 0, lineHeight: 1 }}>
      {Array.from({ length: total }, (_, i) => {
        const alive = i < left;
        return (
          <span key={i} style={{
            width: size, height: size, borderRadius: "50%", display: "block",
            background: alive ? lit : "transparent",
            border: alive ? "none" : `1px solid ${color}33`,
            boxSizing: "border-box",
            boxShadow: alive ? `0 0 ${last ? 5 : 3}px ${lit}${last ? "" : "aa"}` : "inset 0 1px 1px #000a",
            /* the last life breathes. `life-pulse` is defined in GameStyles. */
            animation: alive && last ? "life-pulse 0.7s ease-in-out infinite alternate" : undefined,
          }}/>
        );
      })}
    </span>
  );
}
