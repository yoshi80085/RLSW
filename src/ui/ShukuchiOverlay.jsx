// ─── 🌀 SHUKUCHI'S OVERLAY — the arcs, the ghost, and the budget bar ─────────
//
// 縮地, "shrinking the earth": the step that crosses ground without covering it.
// This file is the PICTURE of that. The rules are in `engine/systems/shukuchi.js`
// and nothing here may re-derive one.
//
// ⚠️ WHY THIS IS A COMPONENT AND NOT MARKUP IN THE CLIENT — the same reason
// `ActionRail.jsx` and `ChannelStrip.jsx` are, plus one that is specific to this
// ability. `CLAUDE.md`'s rule is "verify the port, don't assume it": render the
// shipped component through React SSR and diff it against the preview page at
// the same settings. 🎯 A geometry buried inside a 15,000-line component cannot
// be rendered on its own, so it cannot be diffed, so the rule cannot be obeyed.
// `.scratch/_glowssr.jsx` is what that looks like when it goes wrong — it
// RE-IMPLEMENTED the shipped geometry in order to print it, which checks that
// two transcriptions agree and says nothing about the thing on screen.
// `engine/shukuchiOverlayCheck.jsx` renders what follows, and only what follows.
//
// ⚠️ EVERY NUMBER HERE IS ALEX'S, READ OFF A SCREENSHOT. `RONIN_ABILITY_DESIGN.md`
// §2.5.0c is the port spec. DO NOT NUDGE THEM BY EYE: re-open
// `.scratch/shukuchi-hop-preview.html`, move the lever, screenshot the panel,
// port the line. The page keeps no state, so a fresh copy loads with defaults
// and wipes the dial-in — which is why the numbers live in the doc and here,
// and not in `.scratch/`.

import { HEX_BY_NUM } from "../board/hexMap.js";
import { pointyCorners, facingAngle } from "../board/hexGeometry.js";
import { SCALE } from "../board/constants.js";
import { SHUKUCHI_MAX_HOPS } from "../data/gameConstants.js";

/** 🎛️ ALEX'S DIAL-IN, 2026-09-04d. §2.5.0c is the table these came from.
 *
 *  ⚠️ THE COLOUR IS A KNOWN COLLISION, TAKEN ON PURPOSE. `#4488ff` is also
 *  Psycho Bushido's targeting tint, so two of the Ronin's four abilities light
 *  the board identically. Alex chose it knowing that. 📌 The escape hatch is the
 *  LANDING MARKER, deliberately left at "none" and therefore still free: the day
 *  the board has to show a Ronin mid-Shukuchi hovering a Bushido, the fix is a
 *  marker, NOT a hue. Recorded here so nobody re-derives it. */
export const SHUKUCHI_LOOK = {
  color:     '#4488ff',
  fill:      '#4488ff28',   // fill alpha 40 — brighter than walking's #ffffff18
  stroke:    '#4488ffc8',   // stroke alpha 200
  strokeW:   2,             // matches Bushido's and the blink's 2, not walking's 1.5
  marker:    'none',        // 🚫 no dot, no ring, no chevron — see the note above
  arc:       'parabolic',
  rise:      140,           // board units; DOUBLED into the control point
  arcW:      4,
  trailKeep: 3,             // the whole activation stays on the board
  trailFade: 55,            // %
  ghost:     true,          // hover ghost + facing arrow
  dbPip:     true,
  freeLabel: false,         // ⚠️ OFF, and it is a bet — see ShukuchiBudget
  clockOnHop1: true,
  stayInMode: true,         // three hops is three clicks
};

/**
 * The path of one hop, in SVG user units.
 *
 * ⚠️ THE CONTROL POINT IS `rise × 2` ALONG THE PERPENDICULAR, not `rise`. The
 * preview's slider reads 140 and the curve it draws uses 280, because a
 * quadratic Bézier only reaches HALF way to its control point. Drop the 2 and
 * the arc flattens to a little more than a straight line — which is the one
 * thing the picture must not say, since "he went over it" is the whole ability.
 */
export function shukuchiArcPath(fromNum, toNum, scale = SCALE, look = SHUKUCHI_LOOK) {
  const f = HEX_BY_NUM[fromNum], t = HEX_BY_NUM[toNum];
  if (!f || !t) return null;
  const fx = f.px * scale, fy = f.py * scale;
  const tx = t.px * scale, ty = t.py * scale;
  if (look.arc === 'line') return `M${fx},${fy}L${tx},${ty}`;
  const mx = (fx + tx) / 2, my = (fy + ty) / 2;
  const dx = tx - fx, dy = ty - fy, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;          // perpendicular — the arc rises
  const rise = look.rise * 2 * scale;
  return `M${fx},${fy}Q${mx + nx * rise},${my + ny * rise} ${tx},${ty}`;
}

/** How faded the i-th kept arc is. The oldest fades hardest, so the whole
 *  activation stays readable with the newest hop brightest. */
export function shukuchiTrailOpacity(i, kept, look = SHUKUCHI_LOOK) {
  const age = (kept - 1 - i) / Math.max(1, look.trailKeep);
  return Math.max(0.08, 1 - age * (look.trailFade / 100) - 0.15);
}

/**
 * 🌀 THE ARCS. Every hop of this activation, plus the hovered one as a ghost.
 *
 * ⭐ THE CALLER MUST RENDER THIS OVER THE HEXES AND THE STANDEES — it is the
 * identity call of §2.5.0c. The arc passes ABOVE the hex art rather than tinting
 * or crossing it, so the picture says "he went over it" instead of annotating
 * what he passed. ⚠️ Put it under the standees and the arc disappears in exactly
 * the case that proves the ability: a hop straight over somebody's head.
 *
 * @param trail    [{from, to}] this activation's hops, oldest first
 * @param ghostFrom / ghostTo  the hovered landing, or null
 * @param hs       the client's hex radius in screen units
 */
export function ShukuchiArcs({ trail = [], ghostFrom = null, ghostTo = null,
                               hs = 10, scale = SCALE, look = SHUKUCHI_LOOK }) {
  const kept = trail.slice(-look.trailKeep);
  if (!kept.length && ghostTo == null) return null;
  const from = ghostFrom != null ? HEX_BY_NUM[ghostFrom] : null;
  const t    = ghostTo   != null ? HEX_BY_NUM[ghostTo]   : null;
  const gd   = (from && t) ? shukuchiArcPath(ghostFrom, ghostTo, scale, look) : null;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {kept.map((h, i) => {
        const d = shukuchiArcPath(h.from, h.to, scale, look);
        if (!d) return null;
        return <path key={`sk-${i}-${h.from}-${h.to}`} d={d} fill="none"
          stroke={look.color} strokeWidth={look.arcW * 8 * scale}
          strokeLinecap="round" opacity={shukuchiTrailOpacity(i, kept.length, look)} />;
      })}
      {gd && look.ghost && (() => {
        const tx = t.px * scale, ty = t.py * scale;
        const a  = facingAngle(from, t);
        return (
          <g>
            <path d={gd} fill="none" stroke={look.color}
              strokeWidth={look.arcW * 10 * scale} strokeLinecap="round" opacity={0.95} />
            {/* 👻 THE GHOST — where he would stand, and which way he would be
                looking. ⚠️ THE ARROW IS NOT DECORATION. The hop RE-FACES him
                exactly as walking does (the warp deliberately does not), so the
                facing it promises is half of the Bushido setup the player is
                buying with this click. `facingAngle` is the same function
                `applyShukuchiHop` uses, so the promise and the result cannot
                drift apart. */}
            <polygon points={pointyCorners(tx, ty, hs * 0.68)}
              fill="#4488ff55" stroke={look.color} strokeWidth={1.4} />
            <line x1={tx} y1={ty}
              x2={tx + Math.cos(a) * hs * 0.95} y2={ty + Math.sin(a) * hs * 0.95}
              stroke="#cfe6ff" strokeWidth={2} strokeLinecap="round" />
          </g>
        );
      })()}
    </g>
  );
}

/**
 * The state of each mark on the budget readout, as data.
 *
 * ⭐ THE BUDGET READS FORWARD, AND THAT IS A CORRECTION TO THE PREVIEW, MADE
 * DELIBERATELY DURING THE PORT. The page derived "spent" from
 * `MAX_HOPS − hopsLeft`, and a READY ability carries `hopsLeft === 0` — so it
 * drew a ready Shukuchi with every mark greyed out: an empty budget on an
 * ability whose budget is untouched.
 *
 * 🎯 IT MATTERS MORE THAN IT LOOKS. §2.5.0c switched the "FREE" label OFF and
 * bet that this readout alone teaches the §2.5.0a trap — that the clock starts
 * on hop 1, so hops 2 and 3 cost nothing and a Ronin who hops once and stops has
 * spent the whole ability. **A bar that starts empty cannot carry that bet.**
 * 📌 If playtesters hop once and stop anyway, `freeLabel` is the first thing to
 * turn back on, and it is one line.
 *
 * The preview was corrected to match, so the SSR diff compares like with like.
 */
export function shukuchiBudgetMarks(hopsLeft, mid, look = SHUKUCHI_LOOK) {
  const remaining = mid ? hopsLeft : SHUKUCHI_MAX_HOPS;
  return {
    segs: Array.from({ length: SHUKUCHI_MAX_HOPS }, (_, i) => i < remaining),
    // 💰 Spent only once a hop has actually been taken. Out of AP with a full
    // budget is not "paid" — the Db is still in hand and the pip must say so.
    dbSpent: !!mid,
    show: look.dbPip,
  };
}

/** 💰 THE Db PIP SITS BEFORE THE BAR, and this is the one placement §2.5.0c
 *  left to the port. Left to right it reads "one Db buys three hops", which is
 *  the sentence the rail is trying to teach. ⚠️ After the bar was the
 *  alternative and it is worse: a fourth mark in a row of three reads as a
 *  fourth hop. */
export function ShukuchiBudget({ hopsLeft = 0, mid = false, look = SHUKUCHI_LOOK }) {
  const m = shukuchiBudgetMarks(hopsLeft, mid, look);
  return (
    <span style={{ display: 'inline-flex', gap: 2, marginLeft: 5,
                   alignItems: 'center', verticalAlign: 'middle' }}>
      {m.show && (
        <i data-mark="db" style={{ width: 6, height: 6, borderRadius: 2, display: 'inline-block',
          background: m.dbSpent ? '#3a3213' : '#ffd700',
          boxShadow: m.dbSpent ? 'none' : '0 0 4px #ffd700' }} />
      )}
      {m.segs.map((live, i) => (
        <i key={`sg${i}`} data-mark={live ? 'live' : 'spent'}
          style={{ width: 12, height: 5, borderRadius: 1, display: 'inline-block',
                   background: live ? '#7fc0ff' : '#243449' }} />
      ))}
    </span>
  );
}
