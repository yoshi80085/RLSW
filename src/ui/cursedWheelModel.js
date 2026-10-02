// ─── 🎡🌑 THE CURSED WHEEL — the model half ──────────────────────────────────
// What `CursedWheel.jsx` draws over the rival's real `ScaleWheel` while the
// Iwato curse holds (`RONIN_ABILITY_DESIGN.md` §2.3.00): which of their twelve
// slots are Iwato (lit ghost-violet), which are their own scale's and now dead
// (cracked, greyed), where each sits. Split off so the .jsx exports components only.
//
// ⚠️ THE GEOMETRY IS THE WHEEL'S, COPIED — `ScaleWheel.jsx` keeps VB/C/R/R_IN/CHIP
// private. `test:cursedshamisen` reads them out of that file and fails if these
// drift, so the overlay can never sit a slot off from the chips under it.
import { pitchIndex } from '../music/notes.js';
import { wheelModel } from './scaleWheelModel.js';
import { iwatoPcs, iwatoNames, iwatoDegree } from '../board/cursedShamisen.js';

export const WHEEL_GEO = Object.freeze({ VB:360, C:180, R:118, R_IN:72, CHIP:38 });
const { C, R, R_IN } = WHEEL_GEO;
export const slotXY = (k, r) => { const a = (-90 + k * 30) * Math.PI / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };

/** @returns slots[12] with k, chip xy, whether Iwato (on the RONIN'S root), whether it was the rival's own. */
export function cursedWheelModel({ spiritId, root, roninRoot, hand = [] }) {
  const m = wheelModel({ spiritId, root, hand });
  const iw = new Set(iwatoPcs(roninRoot));
  const slots = m.slots.map(s => ({ pc:s.pc, k:s.k, xy:slotXY(s.k, R), inner:slotXY(s.k, R_IN), iwato:iw.has(s.pc),
    ownLost:s.inPal && !iw.has(s.pc), name:String(s.name).replace(/b$/, '♭').replace(/#$/, '♯'), degree:iwatoDegree(s.pc, roninRoot), held:s.held.length }));
  const iwatoPoly = slots.filter(s => s.iwato).sort((a, b) => a.k - b.k).map(s => s.inner.map(v => v.toFixed(1)).join(',')).join(' ');
  const ownPoly = slots.filter(s => m.palPcs.has(s.pc)).sort((a, b) => a.k - b.k).map(s => s.inner);
  const heldIwato = new Set(hand.map(n => pitchIndex(n)).filter(pc => iw.has(pc))).size;
  return { slots, iwatoPoly, ownPoly, names:iwatoNames(roninRoot), heldIwato, accent:m.look.accent };
}

/** Jagged crack lines across the rival's own palette shape — seeded, so a replay cracks the same way. */
export function cracksFor(ownPoly, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return ownPoly.map(([x, y]) => {
    const pts = [[C + (x - C) * 0.15, C + (y - C) * 0.15]];
    for (let i = 1; i <= 5; i++) {
      const u = 0.15 + i * 0.19, j = (rnd() - 0.5) * 16;
      pts.push([C + (x - C) * u + j * (C - y) / R, C + (y - C) * u + j * (x - C) / R]);
    }
    return pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
  });
}
