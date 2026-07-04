import boardStarsImg from "../board_stars_animated.png";
import boardLightningImg from "../board_lightning_animated.png";
import { SVG_W, SVG_H } from "../board/constants.js";

// ─── BOARD FX ─────────────────────────────────────────────────────────────────
export function BoardFX() {
  return (
    <>
      <image
        href={boardStarsImg}
        x={0} y={0} width={SVG_W} height={SVG_H}
        preserveAspectRatio="xMidYMid meet"
        style={{ mixBlendMode: "screen", pointerEvents: "none" }}
      />
      <image
        href={boardLightningImg}
        x={0} y={0} width={SVG_W} height={SVG_H}
        preserveAspectRatio="xMidYMid slice"
        style={{ mixBlendMode: "screen", pointerEvents: "none" }}
      />
    </>
  );
}
