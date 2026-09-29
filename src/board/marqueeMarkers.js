// 🎪 MARQUEE MARKERS — the marquee spaces, drawn IN the 3D arena.
//
// Alex, 2026-09-16 (P1): marquee squares are "hard to see on the board"; and
// 2026-09-29: "mark a marquee in the 3D arena". Until now the only mark was the
// 2D board's pink star, painted on the SVG click layer — in 3D that is a flat
// decal under everything, easy to lose among the tiles.
//
// 📌 WHAT IS SHOWN, per marquee (`MARQUEE_QUIZ_DESIGN.md` §11 — one per seat):
//   · on the floor, a THEATRE MARQUEE: a pink neon hex rim with a ring of warm
//     bulbs chasing round it, a faint pink wash, and a light wall rising off it;
//   · an inner ring in the colour of the quadrant's seat — "this is blue's";
//   · above it, the PRIZE: a card with the RL winged-horns back (the same art
//     as the card picker, `ui/MarqueeCardPick.jsx`) floating, bobbing and
//     turning slowly — what you win for answering.
// A new marquee pops in (the card drops in with an overshoot); a taken one's
// card lifts away and fades.
//
// ⚠️ IT HAS TO READ WITHOUT BLOOM — Alex runs Auto: Standard. The rim and bulbs
// are additive, `toneMapped:false`, past 1.0.
// 🧱 THE CARD IS SOLID (`solidLayer.js`): opaque, alpha-TESTED rather than
// blended, so `isSolidMesh` takes it and it is re-drawn on the foreground above
// the SVG click layer — otherwise a hex tint could paint across it. The floor
// pieces are additive and stay on the arena canvas, like the move tiles.
//
// 📌 TWO HALVES, like moveTiles/attackTiles: the pure top (no three) is what a
// marker wants at a given millisecond; the bottom is the three.js half.
import * as THREE from 'three';
// 🂠 The RL logo, by URL rather than by import: Vite emits the asset from this
// exact `new URL(…, import.meta.url)` form, and the node-side test bundles need
// no image loader for it (they never draw it — there is no canvas there).
const logoUrl = (() => { try { return new URL('../assets/marquee_card_logo.png', import.meta.url).href; } catch { return null; } })();

// ⭐ THE DEFAULTS ARE ALEX'S DIAL-IN (2026-09-29, `.scratch/marquee-look-preview.html`):
//   size .76 · cardScale .6 · cardY 1.2 · wall .55 · halo .22 · bulbs 10 · bulbSize .08
// — smaller than the first pass ("they might be a bit too big"). Move a number
// here → move it on the page too (its "Current" preset reads these).
export const MARQUEE_LOOK = Object.freeze({
  // ── the big switches (dial-in: `.scratch/marquee-look-preview.html`) ──
  floorStyle:'marquee',   // 'marquee' rim+bulbs · 'ring' rim only · 'bulbs' bulbs only · 'glow' wash+wall only · 'none'
  cardStyle:'card',       // 'card' the RL prize card · 'coin' the logo on a spinning disc · 'none'
  colorMode:'pink',       // 'pink' the marquee's own · 'owner' the quadrant seat's colour · 'gold'
  size:0.76,              // the floor mark's scale (1 = fills the hex) — Alex's dial-in 2026-09-29
  cardScale:0.6,          // the card / coin's scale — dial-in
  // ── colours and glow ──
  color:'#ff44dd',        // the marquee's own neon (the 2D star's pink)
  gold:'#ffcc44',
  communityColor:'#ffc233',   // 🎤 a community marquee's neon (§13)
  bulbColor:'#ffd36b',    // the chasing bulbs, warm
  brightness:2.4,         // the rim's glow — past 1 so it reads without bloom
  fill:0.22,              // the hex's wash
  ownerRing:0.75,         // the seat-colour inner ring's strength (0 = off)
  wall:0.55, wallOpacity:0.5,  // the light rising off the hex (height in world units; 0 = off) — dial-in
  bulbs:10, bulbSize:0.08, bulbRing:0.64,   // count + size: dial-in
  bulbGlow:2.6, chaseS:1.4, bulbTrail:0.35, bulbLow:0.22,
  cardY:1.2, cardW:0.95, cardH:1.4, cardTilt:0.12,   // cardY: dial-in
   // tilt: leaned back a little so it reads from high shots
  spinS:4.5, bobAmp:0.09, bobS:2.4,
  halo:0.22,              // the glow behind the card (0 = off) — dial-in
  appearMs:560, leaveMs:460,
  plateInset:0.86,
});

// ── pure ─────────────────────────────────────────────────────────────────────

const clamp01 = t => Math.max(0, Math.min(1, t));
const easeOutBack = t => { const c = 1.70158, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

/**
 * What one marker wants THIS frame.
 * @returns {{ show:number, cardScale:number, cardY:number, spin:number, gone:boolean }}
 *   show — 0..1 strength of the floor pieces; cardScale — the card's size factor;
 *   cardY — its height; spin — its yaw (radians); gone — the leave has finished.
 */
export function marqueePose({ nowMs, bornMs, goneMs = null, seed = 0, reduced = false, T = MARQUEE_LOOK }) {
  const phase = seed * 1.7;
  const bob = reduced ? 0 : Math.sin(nowMs / 1000 * Math.PI * 2 / T.bobS + phase) * T.bobAmp;
  const spin = reduced ? 0.5 : (nowMs / 1000) * Math.PI * 2 / T.spinS + phase;
  if (goneMs != null) {
    const k = reduced ? 1 : clamp01((nowMs - goneMs) / T.leaveMs);
    return { show: 1 - k, cardScale: 1 - k, cardY: T.cardY + bob + k * 1.2, spin: spin + k * 6, gone: k >= 1 };
  }
  const k = reduced ? 1 : clamp01((nowMs - bornMs) / T.appearMs);
  const drop = (1 - clamp01(k * 1.25)) * 1.6;
  return { show: k, cardScale: k <= 0 ? 0 : Math.max(0, easeOutBack(k)), cardY: T.cardY + bob + drop, spin: spin - (1 - k) * 4, gone: false };
}

/** A chasing bulb's level, 0..1: bright at the head, fading along a short trail. */
export function bulbLevel(i, nowMs, { reduced = false, T = MARQUEE_LOOK } = {}) {
  if (reduced) return i % 2 ? 1 : T.bulbLow;
  const head = ((nowMs / 1000) / T.chaseS) % 1 * T.bulbs;
  const behind = ((head - i) % T.bulbs + T.bulbs) % T.bulbs;      // how far behind the head
  const trail = Math.max(1, T.bulbTrail * T.bulbs);
  // Two heads, opposite each other, so the ring always has light on both sides.
  const b2 = ((behind - T.bulbs / 2) % T.bulbs + T.bulbs) % T.bulbs;
  const lit = Math.max(Math.max(0, 1 - behind / trail), Math.max(0, 1 - b2 / trail));
  return T.bulbLow + (1 - T.bulbLow) * lit;
}

/** What the arena frame carries: the lit marquees, whose quadrant each is in,
 *  and 🎤 whether it is a COMMUNITY marquee (§13 — drawn gold, so it is a routing choice). */
export function marqueeMarkerList(eventHexes = [], quadrantOf = () => null, colorOf = () => null, kindOf = () => 'solo') {
  return eventHexes.filter(Number.isFinite).map(hex => {
    const corner = quadrantOf(hex);
    return { hex, corner: corner ?? null, color: corner ? colorOf(corner) : null, community: kindOf(hex) === 'community' };
  });
}

// ── three.js ─────────────────────────────────────────────────────────────────

const BASE_Y = 0.2;
const plateGeo = new THREE.CircleGeometry(0.93, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
const rimGeo = new THREE.RingGeometry(0.85, 0.93, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
const ownerGeo = new THREE.RingGeometry(0.4, 0.5, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
const wallGeo = (() => {
  const g = new THREE.CylinderGeometry(0.9, 0.9, 1, 6, 1, true).rotateY(Math.PI / 6).translate(0, 0.5, 0);
  const pos = g.attributes.position, col = [];
  for (let i = 0; i < pos.count; i++) { const k = 1 - pos.getY(i); col.push(k, k, k); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
})();
const additive = color => new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0, depthWrite:false,
  blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });

// 🂠 The prize art, drawn once per shape and shared: the card (navy, a
// cyan→magenta neon frame, the RL logo) or the coin (the logo on a navy disc in
// a neon ring). The logo loads async — the frame shows until it arrives.
// Headless (no canvas) → no texture, a plain-colour shape, which is all the
// geometry checks need.
const artCache = {};
function prizeTexture(shape, url = logoUrl) {
  const key = `${shape}|${url ?? ''}`;
  if (artCache[key]) return artCache[key];
  const canvas = globalThis.document?.createElement?.('canvas');
  let ctx = null;
  const [W, H] = shape === 'coin' ? [256, 256] : [256, 378];
  try { if (canvas) { canvas.width = W; canvas.height = H; ctx = canvas.getContext('2d'); } } catch { /* headless */ }
  if (!ctx) return (artCache[key] = { texture: null });
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const rr = (x, y, w, h, rad) => { ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath(); };
  const neon = () => { const g = ctx.createLinearGradient(0, 0, W * .4, H);
    g.addColorStop(0, '#29d3ff'); g.addColorStop(.55, '#6a5cff'); g.addColorStop(1, '#e24dff'); return g; };
  const navy = () => { const g = ctx.createRadialGradient(W / 2, H * .3, 10, W / 2, H * .45, Math.max(W, H) * .75);
    g.addColorStop(0, '#12235e'); g.addColorStop(.5, '#08134a'); g.addColorStop(1, '#030a26'); return g; };
  const draw = img => {
    ctx.clearRect(0, 0, W, H);
    if (shape === 'coin') {
      ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 3, 0, Math.PI * 2); ctx.fillStyle = navy(); ctx.fill();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 14, 0, Math.PI * 2);
      ctx.lineWidth = 8; ctx.strokeStyle = neon(); ctx.shadowColor = '#29d3ff'; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
      if (img) { const w = W * .78, h = w * img.height / img.width; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); }
    } else {
      rr(2, 2, W - 4, H - 4, 22); ctx.fillStyle = navy(); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#1b1454'; ctx.stroke();
      rr(16, 16, W - 32, H - 32, 14);
      ctx.lineWidth = 6; ctx.strokeStyle = neon(); ctx.shadowColor = '#29d3ff'; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
      if (img) { const w = W * .84, h = w * img.height / img.width; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); }
    }
    texture.needsUpdate = true;
  };
  draw(null);
  try {
    if (url && globalThis.Image) { const img = new globalThis.Image(); img.onload = () => draw(img); img.src = url; }
  } catch { /* the frame alone is still a prize */ }
  return (artCache[key] = { texture });
}

/** The marker's main colour for a quadrant seat colour, by `colorMode`. */
export function marqueeColor(ownerColor, T = MARQUEE_LOOK) {
  if (T.colorMode === 'owner' && ownerColor) return ownerColor;
  if (T.colorMode === 'gold') return T.gold;
  return T.color;
}

/**
 * @param root      the arena scene group
 * @param pointFor  (hexNum, y) → THREE.Vector3 | null
 * @param T         a MARQUEE_LOOK (any subset of keys overrides the defaults)
 */
export function createMarqueeMarkers(root, { pointFor, T: overrides = {} } = {}) {
  const T = { ...MARQUEE_LOOK, ...overrides };
  const group = new THREE.Group(); group.name = 'Marquee markers'; root.add(group);
  const cards = new THREE.Group(); cards.name = 'Marquee prize cards'; root.add(cards);
  const markers = new Map();   // hex → marker
  const bulb = new THREE.Color(T.bulbColor);
  const floorOn = T.floorStyle !== 'none';
  const rimOn = T.floorStyle === 'marquee' || T.floorStyle === 'ring';
  const bulbsOn = T.floorStyle === 'marquee' || T.floorStyle === 'bulbs';
  const washOn = floorOn;
  const shape = T.cardStyle === 'coin' ? 'coin' : 'card';
  const { texture } = T.cardStyle === 'none' ? { texture: null } : prizeTexture(shape, T.logoUrl ?? logoUrl);
  const cw = shape === 'coin' ? 0.8 : T.cardW, ch = shape === 'coin' ? 0.8 : T.cardH;
  const cardGeo = shape === 'coin' ? new THREE.CircleGeometry(0.4, 40) : new THREE.PlaneGeometry(cw, ch);
  const haloGeo = shape === 'coin' ? new THREE.CircleGeometry(0.62, 40) : new THREE.PlaneGeometry(cw * 1.45, ch * 1.3);
  const bulbGeo = new THREE.CircleGeometry(T.bulbSize, 14).rotateX(-Math.PI / 2);
  let list = [], lastNow = null, seedN = 0;

  function build(hex, ownerColor, community = false) {
    const p = pointFor(hex, BASE_Y); if (!p) return null;
    // 🎤 A community marquee is GOLD whatever the colour mode — the difference
    // has to read from across the board, before anyone routes to it.
    const main = new THREE.Color(community ? T.communityColor : marqueeColor(ownerColor, T));
    const floor = new THREE.Group(); floor.position.copy(p); floor.scale.setScalar(T.size);
    const plate = new THREE.Mesh(plateGeo, additive(main)), rim = new THREE.Mesh(rimGeo, additive(main));
    const owner = new THREE.Mesh(ownerGeo, additive(new THREE.Color(ownerColor ?? T.color)));
    const wallMat = additive(main); wallMat.vertexColors = true;
    const wall = new THREE.Mesh(wallGeo, wallMat);
    [plate, rim, owner, wall].forEach((m, i) => { m.position.y = i * 0.003; m.renderOrder = 58; });
    plate.visible = washOn; rim.visible = rimOn; wall.visible = washOn && T.wall > 0;
    owner.visible = floorOn && T.ownerRing > 0 && T.colorMode !== 'owner';
    floor.add(plate, rim, owner, wall);
    const bulbs = [];
    if (bulbsOn) for (let i = 0; i < T.bulbs; i++) {
      const a = (i / T.bulbs) * Math.PI * 2, b = new THREE.Mesh(bulbGeo, additive(bulb));
      b.position.set(Math.cos(a) * T.bulbRing, 0.012, Math.sin(a) * T.bulbRing);
      b.renderOrder = 59; bulbs.push(b); floor.add(b);
    }
    group.add(floor);
    // The prize: a pivot that spins, the card (or coin) and its halo inside it.
    const pivot = new THREE.Group(); pivot.position.copy(p);
    const cardMat = new THREE.MeshBasicMaterial({ map: texture, color: texture ? 0xffffff : main,
      alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false });
    const card = new THREE.Mesh(cardGeo, cardMat); card.name = 'Marquee card'; card.rotation.x = -T.cardTilt;
    const halo = new THREE.Mesh(haloGeo, additive(main)); halo.rotation.x = -T.cardTilt; halo.position.z = -0.02; halo.renderOrder = 57;
    halo.visible = T.halo > 0;
    pivot.add(halo, card); pivot.visible = T.cardStyle !== 'none';
    if (T.cardStyle !== 'none') cards.add(pivot);
    return { hex, community, floor, plate, rim, owner, wall, bulbs, pivot, card, halo, main, seed: (seedN++ % 7) + hex * 0.013,
      bornMs: null, goneMs: null, base: p.clone() };
  }
  function drop(m) {
    group.remove(m.floor); cards.remove(m.pivot);
    for (const o of [m.plate, m.rim, m.owner, m.wall, ...m.bulbs, m.halo, m.card]) o.material.dispose();
  }
  return {
    /** The look this instance was built with (defaults + overrides). */
    look: T,
    /** `next` is arenaFrame's `marquees`: [{ hex, corner, color }]. */
    update(next) {
      list = Array.isArray(next) ? next : [];
      const want = new Set(list.map(m => m.hex));
      for (const m of list) {
        let had = markers.get(m.hex);
        // A marquee whose KIND changed in place (the Testing Grounds flip) is rebuilt.
        if (had && had.community !== !!m.community) { drop(had); markers.delete(m.hex); had = null; }
        if (!had) { const made = build(m.hex, m.color, !!m.community); if (made) markers.set(m.hex, made); }
        else if (had.goneMs != null) had.goneMs = null;          // relit on the same hex before it left
      }
      for (const m of markers.values()) if (!want.has(m.hex) && m.goneMs == null) m.goneMs = -1;  // stamped on the next tick
    },
    tick(nowMs, { reduced = false } = {}) {
      lastNow = nowMs;
      for (const m of [...markers.values()]) {
        if (m.bornMs == null) m.bornMs = nowMs;
        if (m.goneMs === -1) m.goneMs = nowMs;
        const pose = marqueePose({ nowMs, bornMs: m.bornMs, goneMs: m.goneMs, seed: m.seed, reduced, T });
        if (pose.gone) { drop(m); markers.delete(m.hex); continue; }
        const s = pose.show;
        const glow = m.main.clone().multiplyScalar(T.brightness);
        m.plate.material.opacity = s * T.fill;
        m.rim.material.color.copy(glow); m.rim.material.opacity = Math.min(1, s * 1.6);
        m.owner.material.opacity = s * T.ownerRing;
        m.wall.scale.set(T.plateInset, Math.max(0.001, T.wall), T.plateInset); m.wall.material.opacity = s * T.wallOpacity;
        for (const [i, b] of m.bulbs.entries()) {
          const lvl = bulbLevel(i, nowMs + m.seed * 400, { reduced, T });
          b.material.color.copy(bulb).multiplyScalar(1 + lvl * T.bulbGlow); b.material.opacity = Math.min(1, s * (0.35 + lvl));
        }
        for (const o of [m.plate, m.rim, m.owner]) o.scale.setScalar(T.plateInset);
        if (T.cardStyle !== 'none') {
          m.pivot.visible = pose.cardScale > 0.01;
          m.pivot.position.set(m.base.x, pose.cardY, m.base.z);
          m.pivot.rotation.y = pose.spin;
          m.pivot.scale.setScalar(Math.max(0.001, pose.cardScale * T.cardScale));
          m.halo.material.opacity = s * T.halo;
        }
      }
    },
    /** 🧱 The prize cards — re-drawn above the SVG layer (solidLayer.js). */
    solidRoot: cards,
    /** Anything appearing or leaving (the reduced-motion loop keeps drawing while > 0). */
    active(nowMs = lastNow ?? 0) {
      let n = 0;
      for (const m of markers.values()) if (m.bornMs == null || m.goneMs != null || nowMs - m.bornMs < T.appearMs) n++;
      return n;
    },
    diagnostics() {
      return { hexes: [...markers.values()].filter(m => m.goneMs == null).map(m => m.hex),
        community: [...markers.values()].filter(m => m.goneMs == null && m.community).map(m => m.hex),
        leaving: [...markers.values()].filter(m => m.goneMs != null).map(m => m.hex),
        cards: cards.children.filter(c => c.visible).length };
    },
    dispose() {
      for (const m of markers.values()) drop(m);
      markers.clear(); cardGeo.dispose(); haloGeo.dispose(); bulbGeo.dispose();
      root.remove(group, cards);
    },
  };
}
