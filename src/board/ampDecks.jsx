// ─── AMP DECKS — the rig at your corner (AMP_DECK_DESIGN.md §3) ──────────────
// Every Spirit's rig lives just off-board at their home corner: TWO stacks,
// one hugging each of the two board edges that meet at the pocket (art from
// the amp_level_1/2/3 sheets — 8 pre-rotated positions, 2 per corner).
//   • AMP tier = cabinet count: Amp I (start) 1 cabinet, Amp II 2, Amp III 3.
//   • POWER tiers ring the KNOBS in vibrant pink, cumulative per cabinet:
//     Power I lights cabinet 1's knobs, Power II adds cabinet 2's, Power III
//     lights the whole wall (positions from ampKnobs.js, per sprite).
//   • RANGE tiers put a hex glow around the base of the stack — slight at
//     Range I, brighter at II, brightest at III. Hovering a stack shows its
//     Spirit's RADIUS RING on the board (also pulses while aiming a Sonic
//     Attack) — inside the ring = full rig.
// Magenta for all corners (art as-is); ownership reads from position.

import React, { useState } from "react";
import { HEX_BY_NUM } from "./hexMap.js";
import { SCALE, HEX_SIZE, COL_SPACING, SVG_W, SVG_H } from "./constants.js";
import { CORNERS } from "../data/corners.js";
import { LIMELIGHT_HEX, RIG_RADIUS_BY_TIER } from "../data/gameConstants.js";
import { RIG_AMP_IDS, RIG_POWER_IDS, RIG_RANGE_IDS } from "../engine/systems/sonicRig.js";
import { AMP_KNOBS } from "./ampKnobs.js";

import ampTl1 from "../amps/amp_tl_lv1.png";
import ampTl2 from "../amps/amp_tl_lv2.png";
import ampTl3 from "../amps/amp_tl_lv3.png";
import ampTr1 from "../amps/amp_tr_lv1.png";
import ampTr2 from "../amps/amp_tr_lv2.png";
import ampTr3 from "../amps/amp_tr_lv3.png";
import ampBl1 from "../amps/amp_bl_lv1.png";
import ampBl2 from "../amps/amp_bl_lv2.png";
import ampBl3 from "../amps/amp_bl_lv3.png";
import ampBr1 from "../amps/amp_br_lv1.png";
import ampBr2 from "../amps/amp_br_lv2.png";
import ampBr3 from "../amps/amp_br_lv3.png";
import ampLu1 from "../amps/amp_l_up_lv1.png";
import ampLu2 from "../amps/amp_l_up_lv2.png";
import ampLu3 from "../amps/amp_l_up_lv3.png";
import ampLl1 from "../amps/amp_l_low_lv1.png";
import ampLl2 from "../amps/amp_l_low_lv2.png";
import ampLl3 from "../amps/amp_l_low_lv3.png";
import ampRu1 from "../amps/amp_r_up_lv1.png";
import ampRu2 from "../amps/amp_r_up_lv2.png";
import ampRu3 from "../amps/amp_r_up_lv3.png";
import ampRl1 from "../amps/amp_r_low_lv1.png";
import ampRl2 from "../amps/amp_r_low_lv2.png";
import ampRl3 from "../amps/amp_r_low_lv3.png";

const HS = Math.round(HEX_SIZE * SCALE * 0.88);
const MAGENTA = "#e648f0";
const MAGENTA_HOT = "#ff66ee";
const KNOB_PINK = "#ff2fd6";    // vibrant pink rings around powered knobs

// Sprite sheets: per position, levels 1–3 with natural crop sizes (px).
const SPRITES = {
  tl:    [{ src: ampTl1, w: 235, h: 267 }, { src: ampTl2, w: 235, h: 295 }, { src: ampTl3, w: 235, h: 327 }],
  tr:    [{ src: ampTr1, w: 234, h: 266 }, { src: ampTr2, w: 234, h: 297 }, { src: ampTr3, w: 234, h: 326 }],
  bl:    [{ src: ampBl1, w: 234, h: 267 }, { src: ampBl2, w: 234, h: 298 }, { src: ampBl3, w: 234, h: 324 }],
  br:    [{ src: ampBr1, w: 234, h: 267 }, { src: ampBr2, w: 234, h: 292 }, { src: ampBr3, w: 234, h: 314 }],
  l_up:  [{ src: ampLu1, w: 197, h: 256 }, { src: ampLu2, w: 213, h: 271 }, { src: ampLu3, w: 229, h: 289 }],
  l_low: [{ src: ampLl1, w: 197, h: 256 }, { src: ampLl2, w: 219, h: 274 }, { src: ampLl3, w: 236, h: 286 }],
  r_up:  [{ src: ampRu1, w: 197, h: 256 }, { src: ampRu2, w: 214, h: 272 }, { src: ampRu3, w: 230, h: 288 }],
  r_low: [{ src: ampRl1, w: 197, h: 256 }, { src: ampRl2, w: 210, h: 273 }, { src: ampRl3, w: 230, h: 284 }],
};

// Anchors as fractions of the board SVG, snugged against the board hexagon:
// each stack was slid along its inward axis until the sprite alpha kissed the
// neon frame (2px gap), so the rigs hug the edge like the reference mock-up.
// tl/tr/l_*/r_* anchor by BOTTOM-center (feet planted, stacks grow up);
// bl/br anchor by TOP-center (head kisses the edge, stacks grow down).
const ANCHORS = {
  tl:    { fx: 0.2376, fy: 0.1785 },
  l_up:  { fx: 0.1279, fy: 0.4204 },
  l_low: { fx: 0.1268, fy: 0.6954 },
  bl:    { fx: 0.2376, fy: 0.8305, top: true },
  tr:    { fx: 0.7633, fy: 0.1812 },
  r_up:  { fx: 0.8729, fy: 0.431  },
  r_low: { fx: 0.8728, fy: 0.6992 },
  br:    { fx: 0.7633, fy: 0.8201, top: true },
};

// Which two stacks belong to each corner (one per board edge at the pocket).
export const CORNER_DECKS = {
  blue:   ["tl", "l_up"],
  purple: ["bl", "l_low"],
  yellow: ["tr", "r_up"],
  red:    ["br", "r_low"],
};

const PX = (HS * 2.7) / 235;    // uniform art scale (diag cabinets ≈ 2.7 hexes wide)

const countOf = (unlocked, ids) => ids.filter((id) => unlocked.includes(id)).length;

// Flat-top hexagon path centered at (cx, cy), radius r, squashed to sy.
function hexPath(cx, cy, r, sy) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a) * sy).toFixed(1)}`;
  });
  return `M ${pts.join(" L ")} Z`;
}

// One stack (one of the corner's two decks).
function DeckStack({ pos, stage, powT, rangeT, thump, seed, onHover }) {
  const sp = SPRITES[pos][stage - 1];
  const a = ANCHORS[pos];
  const W = sp.w * PX, H = sp.h * PX;
  const ax = a.fx * SVG_W, ay = a.fy * SVG_H;
  const x = ax - W / 2;
  const y = a.top
    ? Math.min(SVG_H - H - 1, ay)                      // head planted, grows down
    : Math.max(2, Math.min(SVG_H - H - 1, ay - H));    // feet planted, grows up
  const plantY = a.top ? "0%" : "100%";                // squash/bounce from the planted end
  const glowCol = powT > 0 ? MAGENTA_HOT : MAGENTA;
  // Powered knobs: cabinets 1..powT get vibrant pink rings (cumulative).
  const knobCabs = (AMP_KNOBS[pos]?.[stage] ?? []).slice(0, Math.min(powT, stage));
  // Range: hex glow around the base of the amp — brighter per tier.
  const baseY = a.top ? y + H * 0.04 : y + H * 0.96;   // the planted end

  return (
    <g style={{ animation: `amp-hover-float ${3.5 + (seed % 3) * 0.5}s ease-in-out infinite`,
        animationDelay: `${((seed * 0.4) % 2).toFixed(2)}s` }}>
      <g key={`stack-${stage}`}
         style={{ animation: "amp-drop-in 0.55s cubic-bezier(.5,1.5,.6,1) both",
           transformBox: "fill-box", transformOrigin: `50% ${plantY}` }}>
        <g key={thump ?? "idle"}
           style={thump ? { animation: "amp-thump 0.3s ease-out",
             transformBox: "fill-box", transformOrigin: `50% ${plantY}` } : undefined}>
          {/* RANGE — hex glow around the base: slight → brighter → brightest */}
          {rangeT > 0 && (
            <g style={{ pointerEvents: "none",
                animation: "amp-led-pulse 2.4s ease-in-out infinite" }}>
              <path d={hexPath(ax, baseY, W * 0.62, 0.42)}
                fill={MAGENTA} opacity={0.10 + rangeT * 0.11}
                style={{ filter: `blur(${4 + rangeT * 2}px)` }}/>
              <path d={hexPath(ax, baseY, W * 0.62, 0.42)}
                fill="none" stroke={MAGENTA_HOT} strokeWidth={1 + rangeT * 0.6}
                opacity={0.25 + rangeT * 0.22}
                style={{ filter: `drop-shadow(0 0 ${2 + rangeT * 3}px ${MAGENTA})` }}/>
              {rangeT >= 3 && (
                <path d={hexPath(ax, baseY, W * 0.78, 0.42)}
                  fill="none" stroke={MAGENTA} strokeWidth={1}
                  opacity={0.5}
                  style={{ filter: `drop-shadow(0 0 8px ${MAGENTA_HOT})` }}/>
              )}
            </g>
          )}
          {/* hovering the stack shows this Spirit's range ring on the board */}
          <image href={sp.src} x={x} y={y} width={W} height={H}
            onMouseEnter={() => onHover?.(true)} onMouseLeave={() => onHover?.(false)}
            style={{ pointerEvents: "auto", cursor: "help",
              filter: `drop-shadow(0 0 2.5px ${glowCol})` }}/>
          {/* inner glow — brightened duplicate blended over the dark speaker face */}
          <image href={sp.src} x={x} y={y} width={W} height={H}
            style={{ filter: "brightness(3) saturate(1.5)",
              mixBlendMode: "screen", opacity: 0.06,
              animation: `amp-inner-glow ${(2.5 + (seed % 2) * 0.5).toFixed(1)}s ease-in-out infinite`,
              animationDelay: `${((seed * 0.3) % 2).toFixed(2)}s`,
              pointerEvents: "none" }}/>
          {/* POWER — vibrant pink rings around each powered cabinet's knobs */}
          {knobCabs.map((cab, ci) => (
            <g key={`knobs-${ci}`} style={{ pointerEvents: "none" }}>
              {cab.map(([kx, ky, kMA, kma, kang], ki) => {
                const cx = x + kx * W, cy = y + ky * H;
                const rx = (kMA * W) / 2, ry = (kma * W) / 2;
                return (
                  <g key={ki} transform={`rotate(${kang} ${cx.toFixed(1)} ${cy.toFixed(1)})`}>
                    <ellipse cx={cx} cy={cy} rx={rx * 1.15} ry={ry * 1.15}
                      fill="none" stroke={KNOB_PINK} strokeWidth={2.4} opacity={0.5}
                      style={{ filter: `blur(1.6px)` }}/>
                    <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
                      fill="none" stroke={KNOB_PINK} strokeWidth={1.1}
                      style={{ filter: `drop-shadow(0 0 3px ${KNOB_PINK})`,
                        animation: `amp-knob-pulse ${(1.8 + ((seed + ci) % 3) * 0.4).toFixed(1)}s ease-in-out infinite`,
                        animationDelay: `${(((seed * 5 + ki * 3) % 10) / 8).toFixed(2)}s` }}/>
                  </g>
                );
              })}
            </g>
          ))}
        </g>
      </g>
    </g>
  );
}

// Neon radius ring — pulses out from the home hex while its Spirit aims a
// Sonic Attack, or while anyone hovers that Spirit's amp stacks. Inside the
// ring the full rig applies; outside, the Main Amp floor (2d6). Range III
// (Infinity) draws a venue-wide ring: the whole stage is yours.
function RangeRing({ spirit, unlocked }) {
  const home = HEX_BY_NUM[CORNERS[spirit.corner]?.homeNum];
  if (!home) return null;
  const rangeT = countOf(unlocked, RIG_RANGE_IDS);
  const radius = RIG_RADIUS_BY_TIER[rangeT];
  const drawR = Number.isFinite(radius) ? radius : 11;  // ∞ → encircle the venue
  const hx = home.px * SCALE, hy = home.py * SCALE;
  const ringR = (drawR + 0.5) * COL_SPACING * SCALE;
  return (
    <g style={{ pointerEvents: "none", transformBox: "fill-box", transformOrigin: "center",
        animation: "amp-ring-pulse 2s ease-in-out infinite" }}>
      <circle cx={hx} cy={hy} r={ringR} fill={MAGENTA} opacity={0.05}/>
      <circle cx={hx} cy={hy} r={ringR} fill="none" stroke={MAGENTA} strokeWidth={2}
        strokeDasharray="10 8" opacity={0.8}
        style={{ filter: `drop-shadow(0 0 6px ${MAGENTA})` }}/>
      <circle cx={hx} cy={hy} r={ringR * 0.985} fill="none" stroke="#ffffff"
        strokeWidth={0.7} opacity={0.35}/>
    </g>
  );
}

/**
 * The full layer: both stacks at every occupied corner, plus radius rings —
 * the acting Spirit's while they line up a Sonic Attack, and any Spirit's
 * while their amp stacks are hovered.
 *
 * Level mapping: cabinet count = Amp tier. Amp I (everyone's start) is the
 * single Main Amp cabinet; Amp II stacks the second; Amp III completes the
 * wall at the level-3 art. Power rings the knobs; Range glows the base.
 *
 * @param spirits    spirits array (only those with a corner render)
 * @param noteStates per-spirit note state (unlockedSkills drives the tiers)
 * @param actingId   the acting spirit's id (ring owner)
 * @param aiming     true while the Sonic Attack targeting UI is open
 * @param thumpFx    { id, key } — bumps a 300ms thump on that spirit's stacks
 */
export default function AmpDecks({ spirits, noteStates, actingId, aiming, thumpFx }) {
  const [hoverId, setHoverId] = useState(null);
  const ringIds = new Set();
  if (aiming && actingId) ringIds.add(actingId);
  if (hoverId) ringIds.add(hoverId);
  return (
    <g>
      {spirits.filter((s) => s.corner && ringIds.has(s.id)).map((s) => (
        <RangeRing key={`ring-${s.id}`} spirit={s}
          unlocked={noteStates[s.id]?.unlockedSkills ?? []}/>
      ))}
      {spirits.filter((s) => s.corner).map((s, si) => {
        const unlocked = noteStates[s.id]?.unlockedSkills ?? [];
        const ampT = countOf(unlocked, RIG_AMP_IDS);
        const powT = countOf(unlocked, RIG_POWER_IDS);
        const rangeT = countOf(unlocked, RIG_RANGE_IDS);
        const stage = Math.min(Math.max(ampT, 1), 3);   // cabinets = Amp tier
        const thump = thumpFx?.id === s.id ? thumpFx.key : null;
        return CORNER_DECKS[s.corner]?.map((pos, di) => (
          <DeckStack key={`${s.id}-${pos}`} pos={pos} stage={stage}
            powT={powT} rangeT={rangeT} thump={thump} seed={si * 2 + di + 1}
            onHover={(on) => setHoverId((prev) =>
              on ? s.id : (prev === s.id ? null : prev))}/>
        ));
      })}
    </g>
  );
}
