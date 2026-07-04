import { CORNER_LABELS } from "../data/corners.js";

// ─── SCORE TRACK OVERLAY ──────────────────────────────────────────────────────
export const SCORE_TRACK_CORNERS = {
  blue:   { slots: [{x:138.1,y:175.0},{x:138.1,y:157.8},{x:153.1,y:149.8},{x:153.6,y:132.6},{x:168.6,y:124.3}] },
  yellow: { slots: [{x:641.4,y:175.3},{x:641.3,y:158.3},{x:626.4,y:150.0},{x:626.4,y:132.7},{x:613.7,y:126.6}] },
  purple: { slots: [{x:171.0,y:454.9},{x:154.8,y:446.4},{x:154.8,y:428.2},{x:139.1,y:419.3},{x:139.0,y:400.8}] },
  red:    { slots: [{x:613.2,y:455.5},{x:628.3,y:447.0},{x:628.3,y:429.6},{x:643.6,y:421.0},{x:643.1,y:403.3}] },
};

export function ScoreTrackOverlay({ spirits, startingLives }) {
  return (
    <g style={{ pointerEvents: "none" }}>
      {spirits.map(spirit => {
        const track = SCORE_TRACK_CORNERS[spirit.corner];
        if (!track) return null;
        const lives = spirit.lives ?? startingLives;
        if (lives <= 0 || spirit.knockedOut) return null;
        const slotIdx = Math.min(lives - 1, track.slots.length - 1);
        const { x: ox, y: oy } = track.slots[slotIdx];
        const r = 4.5;
        const color = CORNER_LABELS[spirit.corner]?.color ?? "#ffffff";
        const isLow = lives <= 1;
        return (
          <g key={spirit.id}>
            <circle cx={ox} cy={oy} r={r + 3} fill="none"
              stroke={isLow ? "#ff2222" : color} strokeWidth={1}
              opacity={0.35}
              style={{ animation: isLow ? "life-pulse 0.7s ease-in-out infinite alternate" : "life-pulse 2s ease-in-out infinite alternate" }}
            />
            <circle cx={ox} cy={oy} r={r}
              fill={isLow ? "#ff2222" : color}
              opacity={0.92}
              filter={`drop-shadow(0 0 ${isLow ? 5 : 3}px ${isLow ? "#ff0000" : color})`}
            />
            <circle cx={ox - r * 0.28} cy={oy - r * 0.28} r={r * 0.38}
              fill="#ffffff" opacity={0.7}
            />
          </g>
        );
      })}
      <style>{`
        @keyframes life-pulse {
          from { opacity: 0.25; }
          to   { opacity: 0.7; }
        }
      `}</style>
    </g>
  );
}
