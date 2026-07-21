// ─── AMP DECKS — the rig at your corner (AMP_DECK_DESIGN.md §3) ──────────────
// Every Spirit's rig lives just off-board at their home corner: TWO stacks,
// one hugging each of the two board edges that meet at the pocket (art from
// the amp_level_1/2/3 sheets — 8 pre-rotated positions, 2 per corner).
//   • BOTH stacks grow together, level 1→3, as Amp/Power upgrades land
//   • Power tiers also heat the glow (hotter colour)
//   • Range tiers make the rig GLOW and arc with lightning — the higher the
//     tier, the brighter the aura and the more arcs crawl over the cabinets.
//     While aiming a Sonic Attack, the neon RADIUS RING pulses out from the
//     home hex, teaching "inside = full rig".
// Magenta for all corners (art as-is); ownership reads from position.

import React from "react";
import { HEX_BY_NUM } from "./hexMap.js";
import { SCALE, HEX_SIZE, COL_SPACING, SVG_W, SVG_H } from "./constants.js";
import { CORNERS } from "../data/corners.js";
import { LIMELIGHT_HEX, RIG_RADIUS_BY_TIER } from "../data/gameConstants.js";
import { RIG_AMP_IDS, RIG_POWER_IDS, RIG_RANGE_IDS } from "../engine/systems/sonicRig.js";

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
const ARC_CORE = "#e8f6ff";     // lightning — white-blue core over magenta glow

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

// Deterministic jagged lightning bolt path near a stack (seeded, no jitter).
function boltPath(x0, y0, len, seed) {
  const rnd = (i) => {
    const v = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const segs = 4, pts = [`M ${x0.toFixed(1)} ${y0.toFixed(1)}`];
  let x = x0, y = y0;
  const dir = rnd(0) > 0.5 ? 1 : -1;
  for (let i = 1; i <= segs; i++) {
    x += dir * (rnd(i) - 0.3) * len * 0.45;
    y -= len / segs;
    pts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

// One stack (one of the corner's two decks).
function DeckStack({ pos, stage, powT, rangeT, thump, seed }) {
  const sp = SPRITES[pos][stage - 1];
  const a = ANCHORS[pos];
  const W = sp.w * PX, H = sp.h * PX;
  const ax = a.fx * SVG_W, ay = a.fy * SVG_H;
  const x = ax - W / 2;
  const y = a.top
    ? Math.min(SVG_H - H - 1, ay)                      // head planted, grows down
    : Math.max(2, Math.min(SVG_H - H - 1, ay - H));    // feet planted, grows up
  const plantY = a.top ? "0%" : "100%";                // squash/bounce from the planted end
  // Range drives the aura; Power heats the colour.
  const glow = 1.2 + rangeT * 2.2 + powT * 0.8;
  const glowCol = powT > 0 ? MAGENTA_HOT : MAGENTA;
  const arcs = rangeT >= 2 ? rangeT : 0;   // Range II: arcs start crawling

  return (
    <g style={{ pointerEvents: "none" }}>
      <g key={`stack-${stage}`}
         style={{ animation: "amp-drop-in 0.55s cubic-bezier(.5,1.5,.6,1) both",
           transformBox: "fill-box", transformOrigin: `50% ${plantY}` }}>
        <g key={thump ?? "idle"}
           style={thump ? { animation: "amp-thump 0.3s ease-out",
             transformBox: "fill-box", transformOrigin: `50% ${plantY}` } : undefined}>
          {/* aura pad under the stack so the glow reads on the dark margin */}
          {rangeT > 0 && (
            <ellipse cx={ax} cy={y + H * 0.92} rx={W * 0.7} ry={H * 0.18}
              fill={glowCol} opacity={0.10 + rangeT * 0.07}
              style={{ filter: `blur(${3 + rangeT * 2}px)`,
                animation: "amp-led-pulse 2.4s ease-in-out infinite" }}/>
          )}
          <image href={sp.src} x={x} y={y} width={W} height={H}
            style={{ filter: `drop-shadow(0 0 ${glow}px ${glowCol})` +
              (rangeT >= 3 ? ` drop-shadow(0 0 ${glow * 2}px ${MAGENTA})` : "") }}/>
          {/* lightning arcs crawling over the cabinets (Range II+) */}
          {Array.from({ length: arcs }, (_, i) => {
            const bx = x + W * (0.22 + 0.28 * i + ((seed + i) % 2) * 0.12);
            const by = y + H * (0.25 + 0.5 * (((seed * 3 + i) % 3) / 2));
            return (
              <path key={i} d={boltPath(bx, by, H * (0.22 + rangeT * 0.05), seed * 8 + i)}
                fill="none" stroke={ARC_CORE} strokeWidth={0.9} strokeLinecap="round"
                opacity={0}
                style={{ filter: `drop-shadow(0 0 3px ${MAGENTA_HOT})`,
                  animation: `amp-arc-flicker ${(1.7 + (i % 3) * 0.6).toFixed(1)}s linear infinite`,
                  animationDelay: `${((seed + i * 7) % 10) / 6}s` }}/>
            );
          })}
        </g>
      </g>
    </g>
  );
}

// Neon radius ring — pulses out from the home hex while its Spirit aims a
// Sonic Attack. Inside the ring the full rig applies; outside, baseline 1d6.
// Range III (Infinity) shows no ring: the whole venue is your stage.
function RangeRing({ spirit, unlocked }) {
  const home = HEX_BY_NUM[CORNERS[spirit.corner]?.homeNum];
  if (!home) return null;
  const rangeT = countOf(unlocked, RIG_RANGE_IDS);
  const radius = RIG_RADIUS_BY_TIER[rangeT];
  if (!Number.isFinite(radius)) return null;
  const hx = home.px * SCALE, hy = home.py * SCALE;
  const ringR = (radius + 0.5) * COL_SPACING * SCALE;
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
 * The full layer: both stacks at every occupied corner, plus the acting
 * Spirit's radius ring while they line up a Sonic Attack.
 *
 * Level mapping (tunable): BOTH stacks grow together — every Amp or Power
 * purchase builds the rig out one level, capped at the level-3 art.
 *
 * @param spirits    spirits array (only those with a corner render)
 * @param noteStates per-spirit note state (unlockedSkills drives the tiers)
 * @param actingId   the acting spirit's id (ring owner)
 * @param aiming     true while the Sonic Attack targeting UI is open
 * @param thumpFx    { id, key } — bumps a 300ms thump on that spirit's stacks
 */
export default function AmpDecks({ spirits, noteStates, actingId, aiming, thumpFx }) {
  return (
    <g>
      {aiming && spirits.filter((s) => s.corner && s.id === actingId).map((s) => (
        <RangeRing key={`ring-${s.id}`} spirit={s}
          unlocked={noteStates[s.id]?.unlockedSkills ?? []}/>
      ))}
      {spirits.filter((s) => s.corner).map((s, si) => {
        const unlocked = noteStates[s.id]?.unlockedSkills ?? [];
        const ampT = countOf(unlocked, RIG_AMP_IDS);
        const powT = countOf(unlocked, RIG_POWER_IDS);
        const rangeT = countOf(unlocked, RIG_RANGE_IDS);
        const stage = Math.min(1 + ampT + powT, 3);
        const thump = thumpFx?.id === s.id ? thumpFx.key : null;
        return CORNER_DECKS[s.corner]?.map((pos, di) => (
          <DeckStack key={`${s.id}-${pos}`} pos={pos} stage={stage}
            powT={powT} rangeT={rangeT} thump={thump} seed={si * 2 + di + 1}/>
        ));
      })}
    </g>
  );
}
