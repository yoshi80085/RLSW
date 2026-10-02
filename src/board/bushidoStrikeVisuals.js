// ─── ⚡ PSYCHO BUSHIDO — THE STRIKE ON THE ARENA ───────────────────────────────
// Alex's dial-in of `.scratch/bushido-strike-preview` (2026-10-01): "Everything
// looks good in the preview - Just make sure the amps are sending the Sustain
// shield power up - the stronger the roll - the brighter the shield."
//
// WHAT DRAWS WHAT, on one Bushido bout:
//   · the SHIELD, and the Rival's Sustain amp throwing rings up into it, as
//     bright as his roll is strong — `sonicClashVisuals` with `beams: false`
//     (that is the amp → shield the ask is about, and the Sonic already had it);
//   · the dice — `arenaDiceSequence`, as for a Sonic: his Sustain first;
//   · EVERYTHING OF THE RONIN'S — this file: the charge that grows as each of
//     his dice lands (aura, crawling arcs, sparks, a jolt bolt on a big face, the
//     lane lighting as far as his charge reaches), the rumble before take-off
//     (scaled by how many dice he threw), the draw (a gold bolt down the lane,
//     the ghost he leaves, afterimages), the sky striking every hex he crosses
//     (with scorch), each of his kept dice coming down on the shield's face as a
//     bolt at its contact beat, and the cut when he gets through.
//
// ⭐ ONE CLOCK: the bout's own gated sequence seconds (`sonicTime` in
// arenaVisuals), on which the Bushido's beats are laid by `planStrike` with the
// Sonic's launch as the draw. No hit-stops (BUSHIDO_BEATS), so the shield's
// simulation time and this clock agree after the launch.
// ⭐ THE PIECE IS POSED, NOT MOVED: `update` returns the pose (`strikePose` +
// the shiver), and arenaVisuals applies it to the Ronin's carrier — crouch,
// lean, the rumble's stamping, "gone" as a scale of ~0 during the dash — the
// same doctrine as `standeeSteps` (it never touches `visible`).
import * as THREE from 'three';
import { BUSHIDO_STRIKE, BOLT_COLORS, planStrike, strikePose, rollCharge, strikeIntensity, rumbleWeight,
  boltPath, boltBranches, zigPoints, seeded } from './bushidoStrike.js';
import { barrageContact, BUSHIDO_BEATS } from './sonicBarrageTiming.js';

const additive = (color, opacity = 0) => new THREE.MeshBasicMaterial({ color, transparent:true, opacity, depthWrite:false,
  blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });

/** Two crossed ribbons along a jagged line: reads as a bolt from any angle. */
function ribbonGeo(pts, width) {
  const n = pts.length, pos = new Float32Array(n * 12), idx = [];
  const up = new THREE.Vector3(0, 1, 0), t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    t.set(q.x - o.x, q.y - o.y, q.z - o.z).normalize();
    a.crossVectors(t, up); if (a.lengthSq() < 1e-4) a.set(1, 0, 0); a.normalize();
    b.crossVectors(t, a).normalize();
    const w = width * (0.45 + 0.55 * Math.sin((i / Math.max(1, n - 1)) * Math.PI)) * 0.5;
    pos.set([p.x + a.x * w, p.y + a.y * w, p.z + a.z * w, p.x - a.x * w, p.y - a.y * w, p.z - a.z * w,
      p.x + b.x * w, p.y + b.y * w, p.z + b.z * w, p.x - b.x * w, p.y - b.y * w, p.z - b.z * w], i * 12);
    if (i < n - 1) { const k = i * 4, m = k + 4; idx.push(k, k + 1, m, k + 1, m + 1, m, k + 2, k + 3, m + 2, k + 3, m + 3, m + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}

/**
 * @param options {
 *   battle       the frame's volley battle (shots, dice, `bushidoDist`, `damage`)
 *   from, to, target   THREE.Vector3 on the deck: where he stands, where he lands, the Rival
 *   lane         Vector3[] — every hex centre from `from` (0) to the Rival (dist)
 *   shieldFace   Vector3 — the middle of the shield's face toward him
 *   landings     [{ at, face, amt }] his Drive dice (sequence ms), from the floor dice
 *   launch       the draw, in sequence seconds (the Sonic's launch beat)
 *   color        the Ronin's seat colour (for `boltColor: 'seat'`)
 *   art          () => the art Mesh of his standee, for the silhouette afterimages
 *   L            BUSHIDO_STRIKE (Alex's dial-in)
 * }
 */
export function createBushidoStrikeVisuals(options) {
  const L = { ...BUSHIDO_STRIKE, ...options.look };
  const { battle, from, to, target, lane, shieldFace } = options;
  const group = new THREE.Group(); group.name = 'Psycho Bushido';
  const shots = battle.shots ?? [];
  const launchMs = options.launch * 1000;
  const plan = planStrike(L, { dist:battle.bushidoDist ?? lane.length - 1, clashMs:launchMs, shots:shots.length });
  const kept = battle.diceVals ?? [], pool = battle.dicePool ?? [];
  const ceiling = Math.max(1, Math.max(6, ...pool) * Math.max(1, kept.length));
  const charge = rollCharge(options.landings ?? [], { keptTotal:kept.reduce((a, v) => a + v, 0), ceiling, joltMs:L.joltMs });
  const k = strikeIntensity(plan.dist, charge.final, L);
  const weight = rumbleWeight([...pool, ...(battle.droppedDicePool ?? [])]);
  const rand = seeded((battle.diceVals ?? []).reduce((h, v, i) => h * 31 + v * (i + 7), 17) >>> 0);
  const col = new THREE.Color(BOLT_COLORS[L.boltColor] ?? options.color ?? '#4488ff');
  const white = new THREE.Color(0xffffff);
  const dir = to.clone().sub(from).setY(0).normalize();
  const zig = zigPoints({ x:from.x, z:from.z }, { x:to.x, z:to.z }, { count:L.zigCount, width:L.zigWidth, rand });
  const fired = new Set(), fx = [];
  const fire = (key, fn) => { if (!fired.has(key)) { fired.add(key); fn(); } };

  // ── reusable bits ──
  const dot = (() => {
    const c = globalThis.document?.createElement?.('canvas'); if (!c) return null;
    c.width = c.height = 64; const g = c.getContext('2d'); if (!g) return null;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#fffa'); gr.addColorStop(1, '#fff0'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map:dot, color:col, transparent:true, opacity:0, depthWrite:false,
    blending:THREE.AdditiveBlending, toneMapped:false }));
  aura.renderOrder = 11; group.add(aura);
  const hexGeo = new THREE.CircleGeometry(0.95, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
  const ringGeo = new THREE.RingGeometry(0.86, 1, 6, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
  const slashGeo = new THREE.RingGeometry(0.9, 1.05, 40, 1, -0.9, 1.8);
  // the lane's hexes: a glow (charge, the landing) and a burn (scorch) each
  const tiles = lane.map((p, i) => {
    const glow = new THREE.Mesh(hexGeo, additive(col)); glow.position.copy(p).setY(p.y + 0.03); glow.renderOrder = 9;
    const burn = new THREE.Mesh(hexGeo, new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0, depthWrite:false }));
    burn.position.copy(p).setY(p.y + 0.025); burn.renderOrder = 8;
    group.add(burn, glow);
    return { i, p, glow, burn, flash:0, burnAt:null };
  });
  let arcs = [];

  function bolt(pts, width, color) {
    const g = new THREE.Group(); g.renderOrder = 20;
    const core = additive(0xffffff), glow = additive(color);
    pts.forEach((line, j) => {
      const w = j === 0 ? width : width * 0.5;
      g.add(new THREE.Mesh(ribbonGeo(line, w * 0.28), core), new THREE.Mesh(ribbonGeo(line, w * 1.25), glow));
    });
    g.userData.mats = [core, glow]; group.add(g); return g;
  }
  function dropGroup(g) { group.remove(g); g.traverse(o => o.geometry?.dispose()); for (const m of g.userData.mats ?? []) m.dispose(); }
  function spawnBolt(a, b, { width, dur, flickers = 0, branches = 0, jag = L.boltJag }, ms) {
    const make = () => { const main = boltPath(a, b, { jag, rand }); return bolt([main, ...boltBranches(main, { count:branches, reach:1 + width * 0.3, rand })], width, col); };
    fx.push({ kind:'bolt', obj:make(), t0:ms, dur, flickers, make, re:0 });
  }
  function sparks(at, n, color, spread, up, ms) {
    if (n <= 0 || !dot) return;
    const pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = rand() * spread;
      pos.set([at.x + Math.cos(a) * r, at.y + rand() * 0.5, at.z + Math.sin(a) * r], i * 3);
      vel.push([Math.cos(a) * (0.8 + rand() * 2), up * (0.4 + rand()), Math.sin(a) * (0.8 + rand() * 2)]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color:color.clone().lerp(white, 0.45), size:0.14, map:dot,
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    group.add(pts); fx.push({ kind:'sparks', obj:pts, t0:ms, dur:700, vel, last:ms });
  }
  function ring(at, size, ms, delay = 0) {
    const m = new THREE.Mesh(ringGeo, additive(col)); m.position.copy(at).setY(at.y + 0.04); group.add(m);
    fx.push({ kind:'ring', obj:m, t0:ms + delay, dur:500, size });
  }
  // 📌 THE SILHOUETTE: the print's alpha, filled white, so his dark robes still glow.
  let silTex = null;
  function silhouette() {
    if (silTex !== null) return silTex;
    const map = options.art?.()?.material?.map, img = map?.image;
    if (!img?.width || !globalThis.document) return (silTex = false);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    silTex = new THREE.CanvasTexture(c); silTex.colorSpace = THREE.SRGBColorSpace; silTex.flipY = map.flipY;
    return silTex;
  }
  // ⚠️ THE GHOSTS ARE CUT FROM HIS LAST FULL-SIZE FRAME (`ref`, kept up to the
  // draw). During the dash his carrier is scaled to ~0 — "gone" — so an
  // afterimage built from the live matrix would be a speck.
  let ref = null;
  function keepRef(pawn) {
    const art = options.art?.(); if (!art || !pawn) return;
    pawn.updateWorldMatrix(true, true);
    ref = { m:art.matrixWorld.clone(), pos:pawn.position.clone() };
  }
  function ghost(pawn, at, ms, fade, strength) {
    const art = options.art?.(); if (!art || !ref) return;
    const tex = L.afterLook === 'print' ? art.material.map : silhouette() || art.material.map;
    const m = new THREE.Mesh(art.geometry, new THREE.MeshBasicMaterial({ map:tex, color:col, transparent:true, opacity:strength,
      depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide }));
    m.matrixAutoUpdate = false; m.matrix.copy(ref.m);
    m.matrix.setPosition(new THREE.Vector3().setFromMatrixPosition(ref.m).add(at.clone().sub(ref.pos).setY(0)));
    m.renderOrder = 19; group.add(m);
    fx.push({ kind:'ghost', obj:m, t0:ms, dur:fade, strength, shared:true });
  }

  let shake = 0, lastMs = null, lastArc = -1e9, sparkAcc = 0, dustAcc = 0, lastGhost = 0, lastZig = 0;
  const point = p => pathPoint(p);
  function pathPoint(p) { return from.clone().lerp(to, p); }
  const lean = { fwd:1, side:0 };

  function update(t, { reduced = false, pawn = null, camera = null } = {}) {
    const ms = t * 1000, dt = lastMs == null ? 0 : Math.max(0, Math.min(100, ms - lastMs)) / 1000; lastMs = ms;
    const c = charge.at(ms);
    const P = strikePose(plan, ms, L, c, weight);
    if (ms < plan.vanish && pawn) keepRef(pawn);
    if (pawn) {
      const y = pawn.rotation.y;
      lean.fwd = dir.dot(new THREE.Vector3(Math.sin(y), 0, Math.cos(y)));
      lean.side = dir.dot(new THREE.Vector3(Math.cos(y), 0, -Math.sin(y)));
    }
    // ── his dice land: a jolt each, as big as its face ──
    for (const d of options.landings ?? []) if (ms >= d.at) fire(`die${d.idx ?? d.at}`, () => {
      if (reduced || !pawn) return;
      const at = pawn.position.clone().setY(pawn.position.y + 0.6 + rand());
      sparks(at, Math.round(4 + 16 * d.amt), col, 0.6, 1.5 + 2 * d.amt, ms);
      if (d.amt > 0.6) {
        const p = pawn.position;
        spawnBolt({ x:p.x + (rand() - 0.5) * 0.6, y:p.y + 2.8 + rand(), z:p.z + (rand() - 0.5) * 0.6 }, { x:p.x, y:p.y + 0.05, z:p.z },
          { width:0.1 + 0.12 * d.amt, dur:220, flickers:1, branches:1, jag:0.3 }, ms);
      }
    });
    // ── the draw ──
    if (ms >= plan.vanish) fire('vanish', () => {
      if (L.originGhost === 'on' && !reduced) ghost(pawn, from, ms, L.afterFade * 1.3, 0.9);
      const y = L.boltHeight, w = 0.3 * L.boltWidth * (0.8 + 0.35 * k);
      const common = { dur:L.boltLinger, flickers:reduced ? 0 : L.boltFlicker, branches:L.boltBranches };
      if (L.style === 'zigzag') {
        for (let i = 1; i < zig.length; i++) spawnBolt({ x:zig[i - 1].x, y:from.y + y, z:zig[i - 1].z }, { x:zig[i].x, y:from.y + y, z:zig[i].z }, { ...common, width:w * 0.8 }, ms);
      } else if (L.style === 'skyfall') {
        spawnBolt({ x:from.x, y:from.y + 0.3, z:from.z }, { x:from.x, y:from.y + L.skyHeight, z:from.z }, { ...common, width:w }, ms);
      } else {
        spawnBolt({ x:from.x, y:from.y + y, z:from.z }, { x:to.x, y:to.y + y, z:to.z }, { ...common, width:w }, ms);
      }
      if (!reduced) shake = Math.max(shake, L.shake * k);
    });
    for (const s of plan.sky) if (ms >= s.at) fire(`sky${s.index}`, () => {
      const tile = tiles[s.index]; if (!tile) return;
      const p = tile.p;
      spawnBolt({ x:p.x + (rand() - 0.5) * 2, y:p.y + L.skyHeight, z:p.z + (rand() - 0.5) * 2 }, { x:p.x, y:p.y + 0.05, z:p.z },
        { width:0.22 * L.skyWidth * (0.8 + 0.3 * k), dur:reduced ? 250 : 380, flickers:reduced ? 0 : Math.max(1, Math.round(L.boltFlicker * 0.6)),
          branches:Math.round(2 + L.boltBranches * 0.5), jag:0.18 }, ms);
      tile.flash = 1; if (L.scorch === 'on') tile.burnAt = ms;
      if (!reduced) { ring(p, 1.1 + 0.2 * k, ms); ring(p, 0.8, ms, 60); sparks(p.clone().setY(p.y + 0.1), Math.round(10 * k), col, 0.4, 3, ms); shake = Math.max(shake, 0.35 * L.shake * k); }
    });
    if (ms >= plan.arrive) fire('arrive', () => {
      const tile = tiles[plan.travel]; if (tile) tile.flash = 1;
      if (L.style === 'skyfall') spawnBolt({ x:to.x, y:to.y + L.skyHeight, z:to.z }, { x:to.x, y:to.y + 0.05, z:to.z }, { width:0.3 * L.boltWidth, dur:L.boltLinger, flickers:reduced ? 0 : L.boltFlicker, branches:L.boltBranches }, ms);
      if (!reduced) sparks(to.clone().setY(to.y + 0.1), Math.round(16 * k), col, 0.5, 2.6, ms);
    });
    // ── his kept dice hit the shield, one by one, on its own contact beats ──
    shots.forEach(shot => {
      if (ms < launchMs + barrageContact(shot.index, BUSHIDO_BEATS) * 1000) return;
      fire(`shot${shot.index}`, () => {
        const amt = Math.min(1, shot.strength / 8);
        const up = shot.before > 0;
        const hit = (up ? shieldFace : target.clone().setY(target.y + 1.1)).clone()
          .add(new THREE.Vector3((rand() - 0.5) * 0.6, (rand() - 0.3) * 0.8, (rand() - 0.5) * 0.6));
        spawnBolt({ x:hit.x + (rand() - 0.5) * 1.5, y:hit.y + L.skyHeight, z:hit.z + (rand() - 0.5) * 1.5 }, hit,
          { width:(0.16 + 0.2 * amt) * L.skyWidth, dur:260, flickers:1, branches:2, jag:0.2 }, ms);
        if (!reduced) { sparks(hit, 10, up ? col : white, 0.25, 2, ms); shake = Math.max(shake, 0.25 * L.shake * k * (0.5 + amt)); }
        if (shot.index === battle.breakIndex && !reduced) shake = Math.max(shake, 0.8 * L.shake * k);
      });
    });
    // ── the cut, when he got through ──
    if (ms >= plan.burstEnd && (battle.strengthThrough ?? battle.damage ?? 0) > 0) fire('cut', () => {
      const at = target.clone().setY(target.y + 1.4);
      for (const [c0, sc, dur] of [[white, 1, 280], [col, 1.25, 380]]) {
        const m = new THREE.Mesh(slashGeo, additive(c0)); m.renderOrder = 25; m.position.copy(at);
        if (camera) m.lookAt(camera.position); m.rotateZ(-0.4); m.scale.setScalar(sc); group.add(m);
        fx.push({ kind:'slash', obj:m, t0:ms, dur });
      }
      if (!reduced) { sparks(at, 18, white, 0.3, 2, ms); shake = Math.max(shake, 0.5 * L.shake * k); }
    });

    // ── afterimages while he crosses ──
    if (P.phase === 'dash' && !reduced && L.afterCount > 0 && pawn) {
      if (L.style === 'zigzag') {
        if (P.vis > 0 && P.seg > 0 && P.seg !== lastZig) { lastZig = P.seg; const z = zig[Math.min(zig.length - 1, P.seg)]; ghost(pawn, new THREE.Vector3(z.x, from.y, z.z), ms, L.afterFade, 0.7); }
      } else {
        const n = L.afterCount, idx = Math.floor(P.p * (n + 1));
        if (idx >= 1 && idx <= n && idx !== lastGhost) { lastGhost = idx; ghost(pawn, point(idx / (n + 1)), ms, L.afterFade, 0.55 + 0.25 * (idx / n)); }
      }
    }

    // ── the charge on him ──
    const charging = P.phase === 'stance' || P.phase === 'rumble' || P.phase === 'hush';
    const before = ms < plan.vanish;
    aura.visible = !!pawn && ((charging && ms > 0) || P.phase === 'hold') && L.auraGlow > 0;
    if (aura.visible) {
      const flick = P.phase === 'hush' ? 1 : 0.75 + 0.25 * Math.sin(ms * 0.09) * Math.sin(ms * 0.037);
      aura.material.opacity = 0.7 * L.auraGlow * (charging ? P.charge * flick : 0.6 * Math.max(0, 1 - (ms - plan.arrive) / Math.max(1, plan.holdEnd - plan.arrive)));
      aura.position.copy(pawn.position).setY(pawn.position.y + 1.3);
      aura.scale.set(2.6 + 0.4 * P.charge, 4 + 0.4 * P.charge, 1);
    }
    if ((P.phase === 'stance' || P.phase === 'rumble') && !reduced && pawn) {
      sparkAcc += dt * L.sparks * P.charge;
      if (sparkAcc >= 1) { const n = Math.floor(sparkAcc); sparkAcc -= n; sparks(pawn.position.clone().setY(pawn.position.y + 0.3 + rand() * 1.8), n, col, 0.5, 1.2, ms); }
      if (P.phase === 'rumble') {
        dustAcc += dt * L.rumbleDust * P.rumble;
        if (dustAcc >= 1) { const n = Math.floor(dustAcc); dustAcc -= n; sparks(pawn.position.clone().setY(pawn.position.y + 0.05), n, new THREE.Color(0x8a93a8), 0.75, 0.9 + 0.8 * P.rumble, ms); }
        shake = Math.max(shake, L.rumbleCam * 0.35 * P.rumble);
      }
      if (ms - lastArc > 70) {
        lastArc = ms;
        for (const a of arcs) dropGroup(a); arcs = [];
        const n = Math.round(L.arcs * P.charge), p = pawn.position;
        for (let i = 0; i < n; i++) {
          const y0 = p.y + 0.3 + rand() * 2.6, ang = rand() * Math.PI * 2, r = 0.5 + rand() * 0.3;
          const a = bolt([boltPath({ x:p.x + Math.cos(ang) * r, y:y0, z:p.z + Math.sin(ang) * r },
            { x:p.x + Math.cos(ang + 1.2) * r, y:y0 + (rand() - 0.5) * 1.2, z:p.z + Math.sin(ang + 1.2) * r }, { jag:0.35, depth:3, rand })], 0.05 + 0.04 * P.charge, col);
          for (const m of a.userData.mats) m.opacity = 0.9;
          arcs.push(a);
        }
      }
    } else if (arcs.length) { for (const a of arcs) dropGroup(a); arcs = []; }
    // the lane lights as far as his charge reaches
    tiles.forEach(tile => {
      tile.flash *= Math.exp(-dt / 0.3);
      let glow = tile.flash;
      if (charging && L.laneLight !== 'off' && tile.i >= 1) {
        const on = L.laneLight === 'on' ? P.charge : Math.max(0, Math.min(1, P.charge * (plan.dist + 0.6) - (tile.i - 1)));
        glow = Math.max(glow, (tile.i === plan.dist ? 1 : 0.7) * on * (P.phase === 'hush' ? 1 : 0.85 + 0.15 * Math.sin(ms * 0.02 + tile.i)));
      }
      tile.glow.material.opacity = 0.55 * glow;
      if (tile.burnAt != null) {
        const b = Math.max(0, 1 - (ms - tile.burnAt) / L.scorchMs);
        tile.burn.material.opacity = 0.55 * b;
        if (glow < 0.25 * b) { tile.glow.material.color.set(0xff6a1a); tile.glow.material.opacity = 0.2 * b; } else tile.glow.material.color.copy(col);
      }
    });

    // ── fx ──
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], a = (ms - f.t0) / f.dur;
      if (a < 0) { f.obj.visible = false; continue; }
      f.obj.visible = true;
      if (a >= 1) { drop(f); fx.splice(i, 1); continue; }
      if (f.kind === 'bolt') {
        const n = f.flickers, s = a * (n + 1), j = Math.floor(s), fr = s - j;
        const o = Math.pow(0.72, j) * (fr < 0.18 ? 1 : Math.max(0.15, 1 - (fr - 0.18) * 1.6)) * (1 - a * 0.6);
        if (n > 0 && j > 0 && j !== f.re) { f.re = j; const old = f.obj; f.obj = f.make(); dropGroup(old); }
        const [core, glow] = f.obj.userData.mats; core.opacity = o; glow.opacity = o * 0.55;
      } else if (f.kind === 'ring') {
        f.obj.scale.setScalar(0.5 + a * 1.1 * f.size); f.obj.material.opacity = Math.pow(1 - a, 1.5) * 0.95;
      } else if (f.kind === 'sparks') {
        const p = f.obj.geometry.attributes.position, dts = Math.max(0, Math.min(0.1, (ms - f.last) / 1000)); f.last = ms;
        for (let j = 0; j < f.vel.length; j++) {
          const v = f.vel[j]; v[1] -= 7 * dts;
          p.setXYZ(j, p.getX(j) + v[0] * dts, Math.max(from.y, p.getY(j) + v[1] * dts), p.getZ(j) + v[2] * dts);
        }
        p.needsUpdate = true; f.obj.material.opacity = 1 - a * a;
      } else if (f.kind === 'ghost') {
        f.obj.material.opacity = f.strength * Math.pow(1 - a, 1.4);
      } else if (f.kind === 'slash') {
        f.obj.material.opacity = a < 0.15 ? 1 : 1 - (a - 0.15) / 0.85; f.obj.scale.multiplyScalar(1 + dt * 0.6);
      }
    }
    shake *= Math.exp(-dt / 0.11);

    // ── the pose for his piece ──
    const tr = reduced ? 0 : P.tremble;
    const pose = {
      phase:P.phase, before, vis:P.vis > 0.02 ? P.vis : 0.001, sy:P.sy, sxz:P.sxz, y:P.y,
      pitch:P.pitch * lean.fwd, roll:P.roll - P.pitch * lean.side + (rand() - 0.5) * 0.05 * tr,
      jitter:new THREE.Vector3((rand() - 0.5) * 0.06 * tr, 0, (rand() - 0.5) * 0.06 * tr),
      // where he is: on his own hex until the draw, on the landing after it
      at:P.p >= 1 ? to : from,
      active:ms < plan.recoverEnd,
    };
    return { pose, shake:reduced ? 0 : shake, plan };
  }
  function drop(f) {
    if (f.kind === 'bolt') dropGroup(f.obj);
    else { group.remove(f.obj); if (!f.shared) f.obj.geometry?.dispose(); f.obj.material?.dispose(); }
  }
  return {
    group, update, plan, charge, weight,
    dispose() {
      for (const f of fx) drop(f); fx.length = 0;
      for (const a of arcs) dropGroup(a); arcs = [];
      for (const t of tiles) { t.glow.material.dispose(); t.burn.material.dispose(); }
      hexGeo.dispose(); ringGeo.dispose(); slashGeo.dispose(); aura.material.dispose(); dot?.dispose(); if (silTex) silTex.dispose();
      group.clear(); group.removeFromParent();
    },
  };
}
