// 🎯 ATTACK REACH TILES — the hexes an attack can hit, glowing in the 3D arena.
//
// Alex, 2026-09-28: "I'd like for there to be a field of view for hovering over
// an attack - Swing or Sonic (or other special ability) that tells the player
// the 'reach' of the attack - so when the mouse hovers over the ability - there
// should be the spaces that glow up".
//
// ⚠️ WHY IT WAS INVISIBLE. The client already worked the reach out on hover
// (`hoverPreview` → hexFill/hexStroke tint the SVG) — but in 3D BoardViewport
// makes every hex stroke transparent (the flat outlines slice through the
// standees), and what survives is a 7–13% fill over tiles that already glow.
// Same story as the move tiles (moveTiles.js), same cure: the SVG stays the click
// surface, and this module is the picture.
//
// 📌 WHAT IS SHOWN: every hex in reach, as a glowing outline in the ability's own
// colour, pulsing; hexes with a rival IN reach burn brighter, rise a little and
// get a second ring — "this one you can hit". It shows while the button is
// hovered AND while the attack is armed (aiming), and fades out after.
// 📌 TWO HALVES, like moveTiles: the pure top (no three) is what a tile wants at
// a given millisecond; the bottom is the three.js half.
import * as THREE from 'three';
import { boardFootprint } from './moveTiles.js';

export const ATTACK_TILES = Object.freeze({
  // The ability's colour. ⭐ Swing red, Sonic blue — the two buttons' own colours
  // on the Move & Act rail, so the button you hover and the tiles that light match.
  colors:{
    swing:'#ff4a3d', sonic:'#4f7dff', blaster:'#ff3dac', tentacle:'#5cff6a',
    psycho_bushido:'#ffb347', gravity_control:'#9b5cff', displace:'#c77dff', shukuchi:'#e8f4ff',
    cursed_shamisen:'#8f4dff',   // 🎸 the curse's own violet (`CURSED_SHAMISEN.edgeColor`)
  },
  brightness:2.6,           // the rim's glow (bloom picks it up past ~1)
  fill:0.8,                 // the hex's own wash, as a share of its strength
  wall:0.35, targetWall:0.6, // the glow rising off each hex (a fading light wall), in world units
  boardDim:0.3,             // the board darkens a little under them, as for the move tiles
  reachOpacity:0.7,         // an empty hex in reach
  targetBoost:0.85,         // how far a rival's hex climbs from there toward full
  pulseS:1.6, pulseDepth:0.3,
  targetLift:0.14,          // a rival's hex rises this much
  fadeMs:140,
  plateInset:0.86,
});

// ── pure ─────────────────────────────────────────────────────────────────────

/** What one tile wants THIS frame: `a` its strength, `lift` its rise, `ring2` the target ring. */
export function attackTileWant({ inReach, target, nowMs, reduced = false, T = ATTACK_TILES }) {
  if (!inReach) return { a:0, lift:0, ring2:0 };
  const pulse = reduced ? 1 - T.pulseDepth / 2 : 1 - T.pulseDepth * (0.5 + 0.5 * Math.sin(nowMs / 1000 * Math.PI * 2 / T.pulseS));
  let a = T.reachOpacity * pulse;
  if (target) a += T.targetBoost * (1 - a);
  return { a, lift:target ? T.targetLift : 0, ring2:target ? 1 : 0 };
}

/** Exponential fade toward `want`; instant under reduced motion. */
export function attackFade(cur, want, dtMs, { reduced = false, T = ATTACK_TILES } = {}) {
  if (reduced || T.fadeMs <= 0) return want;
  return cur + (want - cur) * (1 - Math.exp(-Math.max(0, dtMs) / (T.fadeMs / 3)));
}

export const attackColor = (kind, T = ATTACK_TILES) => T.colors[kind] ?? T.colors.swing;

// ── three.js ─────────────────────────────────────────────────────────────────

const BASE_Y = 0.21;   // a hair over the move tiles, under the pawns
const plateGeo = new THREE.CircleGeometry(0.93, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
const ringGeo = new THREE.RingGeometry(0.72, 0.93, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
const outerGeo = new THREE.RingGeometry(0.97, 1.05, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
// ✨ "The spaces glow UP": an open hex wall, full colour at the floor fading to
// nothing at its top (additive black adds nothing). ⚠️ It has to read WITHOUT
// bloom — Alex's machine runs the arena at Auto: Standard, where bloom is off.
const wallGeo = (() => {
  const g = new THREE.CylinderGeometry(0.9, 0.9, 1, 6, 1, true).rotateY(Math.PI / 6).translate(0, 0.5, 0);
  const pos = g.attributes.position, col = [];
  for (let i = 0; i < pos.count; i++) { const k = 1 - pos.getY(i); col.push(k, k, k); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
})();
const additive = () => new THREE.MeshBasicMaterial({ transparent:true, opacity:0, depthWrite:false,
  blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });

export function createAttackTiles(root, { pointFor, T = ATTACK_TILES }) {
  const group = new THREE.Group(); group.name = 'Attack reach tiles'; root.add(group);
  const tiles = new Map();
  // The board dim is a dark disc under the tiles (as moveTiles does): the arena's
  // own hex lines glow cyan, and a blue reach on an undimmed board disappears.
  // ⚠️ Cut to the hexes, NOT a disc: the old radius-15 circle reached past the
  // board and dimmed a ring of space around the arena (2026-09-30).
  const dim = new THREE.Mesh(boardFootprint(pointFor),
    new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0, depthWrite:false, toneMapped:false, side:THREE.DoubleSide }));
  dim.position.y = BASE_Y - 0.015; dim.renderOrder = 56; dim.visible = false; group.add(dim);
  let vis = 0;
  let attack = null, color = new THREE.Color(attackColor('swing', T)), lastMs = null;
  function tileFor(num) {
    let t = tiles.get(num);
    if (!t) {
      const p = pointFor(num, BASE_Y); if (!p) return null;
      const plate = new THREE.Mesh(plateGeo, additive()), rim = new THREE.Mesh(ringGeo, additive()), outer = new THREE.Mesh(outerGeo, additive());
      const wallMat = additive(); wallMat.vertexColors = true;
      const wall = new THREE.Mesh(wallGeo, wallMat);
      for (const m of [plate, rim, outer, wall]) { m.position.copy(p); m.renderOrder = 61; m.visible = false; }
      group.add(plate, rim, outer, wall); t = { num, plate, rim, outer, wall, a:0, lift:0, ring2:0 }; tiles.set(num, t);
    }
    return t;
  }
  return {
    /** `next` is arenaFrame's `attack` (or null). */
    update(next) {
      attack = next ?? null;
      if (attack) color = new THREE.Color(attackColor(attack.kind, T));
      for (const n of attack?.near ?? []) tileFor(n);
    },
    tick(nowMs, { reduced = false } = {}) {
      const dt = lastMs == null ? 16 : Math.min(100, nowMs - lastMs); lastMs = nowMs;
      const near = new Set(attack?.near ?? []), hit = new Set(attack?.targets ?? []);
      const glow = color.clone().multiplyScalar(T.brightness);
      for (const t of tiles.values()) {
        const want = attackTileWant({ inReach:near.has(t.num), target:hit.has(t.num), nowMs, reduced, T });
        t.a = attackFade(t.a, want.a, dt, { reduced, T }); t.lift = attackFade(t.lift, want.lift, dt, { reduced, T });
        t.ring2 = attackFade(t.ring2, want.ring2 * t.a, dt, { reduced, T });
        const on = t.a > 0.004;
        t.plate.visible = t.rim.visible = t.wall.visible = on; t.outer.visible = on && t.ring2 > 0.01;
        if (!on) continue;
        const y = BASE_Y + t.lift;
        t.plate.position.y = y; t.rim.position.y = y + 0.004; t.outer.position.y = y + 0.006;
        for (const m of [t.plate, t.rim, t.outer]) m.scale.setScalar(T.plateInset);
        t.wall.position.y = y; t.wall.scale.set(T.plateInset, T.wall + (T.targetWall - T.wall) * t.ring2, T.plateInset);
        t.wall.material.color.copy(color); t.wall.material.opacity = Math.min(1, t.a * 0.9);
        t.plate.material.color.copy(color); t.plate.material.opacity = t.a * T.fill;
        t.rim.material.color.copy(glow); t.rim.material.opacity = Math.min(1, t.a * 1.9);
        t.outer.material.color.copy(glow); t.outer.material.opacity = Math.min(1, t.ring2 * 1.6);
      }
      vis = attackFade(vis, near.size ? 1 : 0, dt, { reduced, T });
      dim.visible = vis * T.boardDim > 0.002; dim.material.opacity = vis * T.boardDim;
    },
    /** Anything still lit or fading — the reduced-motion loop keeps drawing while > 0. */
    active() { let n = vis > 0.004 ? 1 : 0; for (const t of tiles.values()) if (t.a > 0.004) n++; return n; },
    diagnostics() { return { kind:attack?.kind ?? null, lit:[...tiles.values()].filter(t => t.plate.visible).map(t => t.num),
      targets:[...tiles.values()].filter(t => t.outer.visible).map(t => t.num) }; },
    dispose() {
      for (const t of tiles.values()) for (const m of [t.plate, t.rim, t.outer, t.wall]) m.material.dispose();
      dim.geometry.dispose(); dim.material.dispose();
      tiles.clear(); root.remove(group);
    },
  };
}
