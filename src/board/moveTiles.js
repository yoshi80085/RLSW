// 🟪 MOVE TILES — the hexes you can step to, drawn IN the 3D arena.
//
// Alex, 2026-09-17: the move tiles "are nearly the same color as the tiles in the
// 3D arena - making it very difficult to tell which space is able to be moved to
// or if movement even remains." Colour ruling: "Pink instead of gold."
//
// ⚠️ WHY THE OLD HIGHLIGHT VANISHED. The client painted a reachable hex with a 9%
// white fill and a white stroke on the SVG click layer — and in 3D BoardViewport
// hides every hex stroke (the flat outlines slice through the standees). Only the
// 9% fill survived, over a model whose tiles already have pale edges. The SVG
// stays the click surface; this module is the picture, and BoardViewport hides
// the SVG fill (`[data-move-tile]`) once the arena is ready.
//
// ⭐ EVERY NUMBER IS ALEX'S DIAL-IN off `.scratch/camera-move-tiles-preview.html`
// (2026-09-17): magenta, drawn as a glowing OUTLINE in the Spirit's colour over a
// faint magenta fill, glow 2.25, pulse 2.4 s, next-step tiles only (farReach off),
// hover lifts .75, a ring of step pips at the Spirit's feet, the board dimmed .25.
// Move a number here → move it on the page too.
//
// 📌 TWO HALVES. The top is pure (no three): what each tile wants to look like
// at a given millisecond, and the step budget the pips count against. The bottom
// is the three.js half. Only the move tiles live here — Shukuchi's landings keep
// their own SVG tint.
import * as THREE from 'three';

export const MOVE_TILES = Object.freeze({
  color:'#ff3df2', style:'outline', rim:'spirit', brightness:2.25,
  nearOpacity:0.7, plateHeight:0.22, plateInset:0.86,
  pulseS:2.4, pulseDepth:0.35, hoverBoost:0.75,
  pips:'ring', boardDim:0.25, fadeMs:180,
  // 📌 Recorded, not built: the dial-in turned the "later this turn" tiles OFF.
  farReach:'off', farOpacity:0.1,
});

// ── pure ─────────────────────────────────────────────────────────────────────

/** What one tile wants THIS frame: `a` its strength, `lift` how far it rises. */
export function tileWant({ near, hot, nowMs, reduced = false, T = MOVE_TILES }) {
  if (!near) return { a:0, lift:0 };
  // Reduced motion: no pulse — a steady tile at its mid strength.
  const pulse = reduced ? 1 - T.pulseDepth / 2 : 1 - T.pulseDepth * (0.5 + 0.5 * Math.sin(nowMs / 1000 * Math.PI * 2 / T.pulseS));
  let a = T.nearOpacity * pulse, lift = 0;
  if (hot) { a += T.hoverBoost * (1 - a); lift = T.hoverBoost * 0.15; }
  return { a, lift };
}

/** Exponential fade toward `want`; instant under reduced motion or fadeMs 0. */
export function fadeToward(cur, want, dtMs, { reduced = false, T = MOVE_TILES } = {}) {
  if (reduced || T.fadeMs <= 0) return want;
  return cur + (want - cur) * (1 - Math.exp(-Math.max(0, dtMs) / (T.fadeMs / 3)));
}

/**
 * How many pips a turn has. The engine only keeps steps LEFT, so the budget is
 * the most steps seen for this owner on this turn (the grant is the high-water
 * mark — steps only ever go down after it). An explicit `max` wins.
 */
export function createStepBudget() {
  let key = null, max = 0;
  return {
    read(reach) {
      if (!reach) return 0;
      if (Number.isFinite(reach.max)) return reach.max;
      const k = `${reach.kind}:${reach.ownerId}:${reach.turn}`;
      if (k !== key) { key = k; max = 0; }
      max = Math.max(max, reach.steps ?? 0);
      return max;
    },
  };
}

// ── three.js ─────────────────────────────────────────────────────────────────

const BASE_Y = 0.2;   // the hazard discs' height: on the board, under the pawns
const plateGeo = new THREE.CylinderGeometry(0.93, 0.93, 1, 6).rotateY(Math.PI / 6).translate(0, 0.5, 0);
const ringGeo = new THREE.RingGeometry(0.8, 0.93, 6).rotateX(-Math.PI / 2);
const pipGeo = new THREE.SphereGeometry(0.17, 16, 10);
const additive = () => new THREE.MeshBasicMaterial({ transparent:true, opacity:0, depthWrite:false,
  blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });

export function createMoveTiles(root, { pointFor, T = MOVE_TILES }) {
  const group = new THREE.Group(); group.name = 'Move tiles'; root.add(group);
  const tiles = new Map(), budget = createStepBudget();
  const pips = new THREE.Group(); pips.name = 'Step pips'; group.add(pips);
  // The board dim is a dark disc under the tiles rather than a change to the
  // arena's materials: the GLB is shared scenery, and a disc cannot leave it dimmed.
  const dim = new THREE.Mesh(new THREE.CircleGeometry(15, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0, depthWrite:false, toneMapped:false }));
  dim.position.y = BASE_Y - 0.01; dim.renderOrder = 55; dim.visible = false; group.add(dim);
  let reach = null, ownerColor = '#ffffff', lastMs = null, moveVis = 0;
  const glow = new THREE.Color(T.color).multiplyScalar(T.brightness), grey = new THREE.Color(0x3a4666), white = new THREE.Color(2, 2, 2);

  function tileFor(num) {
    let t = tiles.get(num);
    if (!t) {
      const p = pointFor(num, BASE_Y); if (!p) return null;
      const plate = new THREE.Mesh(plateGeo, additive()), rim = new THREE.Mesh(ringGeo, additive());
      plate.position.copy(p); rim.position.copy(p); plate.renderOrder = rim.renderOrder = 60;
      plate.material.color.copy(glow);
      group.add(plate, rim); t = { num, plate, rim, a:0, lift:0 }; tiles.set(num, t);
    }
    return t;
  }

  return {
    /** `next` is arenaFrame's `reach` (or null); `spirits` its visible spirits. */
    update(next, spirits = []) {
      reach = next ?? null;
      ownerColor = spirits.find(s => s.id === reach?.ownerId)?.color ?? T.color;
      for (const n of reach?.near ?? []) tileFor(n);
    },
    tick(nowMs, camera, pawns, { reduced = false } = {}) {
      const dt = lastMs == null ? 16 : Math.min(100, nowMs - lastMs); lastMs = nowMs;
      const near = new Set(reach?.near ?? []);
      const rimCol = T.rim === 'spirit' ? new THREE.Color(ownerColor).multiplyScalar(T.brightness)
        : T.rim === 'white' ? new THREE.Color(1, 1, 1).multiplyScalar(T.brightness) : glow;
      for (const t of tiles.values()) {
        const want = tileWant({ near:near.has(t.num), hot:near.has(t.num) && reach?.hover === t.num, nowMs, reduced, T });
        t.a = fadeToward(t.a, want.a, dt, { reduced, T }); t.lift = fadeToward(t.lift, want.lift, dt, { reduced, T });
        const on = t.a > 0.004;
        t.plate.visible = on;
        t.rim.visible = on && (T.rim !== 'none' || T.style === 'outline');
        if (!on) continue;
        const h = T.style === 'plate' && near.has(t.num) ? Math.max(0.012, T.plateHeight) : 0.012;
        t.plate.scale.set(T.plateInset, h, T.plateInset); t.plate.position.y = BASE_Y + t.lift;
        t.plate.material.opacity = T.style === 'outline' ? t.a * 0.15 : t.a;
        t.rim.scale.setScalar(T.plateInset); t.rim.position.y = BASE_Y + h + t.lift + 0.005;
        t.rim.material.color.copy(T.style === 'outline' && T.rim === 'none' ? glow : rimCol);
        t.rim.material.opacity = Math.min(1, t.a * (T.style === 'outline' ? 2.2 : 1.6));
      }
      moveVis = fadeToward(moveVis, near.size ? 1 : 0, dt, { reduced, T });
      dim.visible = moveVis * T.boardDim > 0.002; dim.material.opacity = moveVis * T.boardDim;

      // Pips: one per step this turn, lit = steps left, grey once spent. Only for
      // a real walk — the Shadow's legs belong to a decoy the arena does not draw.
      const max = reach?.kind === 'move' && T.pips !== 'off' ? budget.read(reach) : 0;
      const pawn = pawns?.get?.(reach?.ownerId);
      pips.visible = max > 0 && !!pawn && !!camera;
      if (pips.children.length !== max) {
        for (const m of [...pips.children]) { pips.remove(m); m.material.dispose(); }
        for (let i = 0; i < max; i++) { const m = new THREE.Mesh(pipGeo, new THREE.MeshBasicMaterial({ toneMapped:false, transparent:true, depthTest:false })); m.renderOrder = 120; pips.add(m); }
      }
      if (pips.visible) {
        const base = pawn.position;
        // An arc on the camera's side of the pawn, so the pawn never hides its own pips.
        const toCam = Math.atan2(camera.position.z - base.z, camera.position.x - base.x);
        pips.children.forEach((m, i) => {
          const ang = toCam + (i - (max - 1) / 2) * 0.42;
          m.position.set(base.x + Math.cos(ang) * 1.3, 0.45, base.z + Math.sin(ang) * 1.3);
          const lit = i < (reach.steps ?? 0);
          // Pips burn hotter than the tiles, so a lit pip over a lit tile still reads.
          m.material.color.copy(lit ? glow.clone().lerp(white, 0.35) : grey);
          m.material.opacity = lit ? 1 : 0.8;
        });
      }
    },
    /** Anything still fading or lit — the reduced-motion render loop keeps drawing while > 0. */
    active() { let n = moveVis > 0.004 ? 1 : 0; for (const t of tiles.values()) if (t.a > 0.004) n++; return n; },
    diagnostics() { return { lit:[...tiles.values()].filter(t => t.plate.visible).map(t => t.num), pips:pips.visible ? pips.children.length : 0, dim:dim.material.opacity }; },
    dispose() {
      for (const t of tiles.values()) { t.plate.material.dispose(); t.rim.material.dispose(); }
      for (const m of pips.children) m.material.dispose();
      dim.geometry.dispose(); dim.material.dispose();
      tiles.clear(); root.remove(group);
    },
  };
}
