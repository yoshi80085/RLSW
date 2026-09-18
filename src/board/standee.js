// 🎭 STANDEES — the Spirits' own art, cut out of acrylic and stood on the board.
//
// Alex, 2026-09-18: "Would you be able to take my 2D characters and make them
// like a standee in the 3D game - give them some 'depth' and stand them up?"
// This replaces `spiritMiniature`'s block pawns in `arenaVisuals.js`.
//
// ⭐ EVERY NUMBER HERE IS ALEX'S DIAL-IN off `.scratch/standee-preview.html`
// (2026-09-18): 1 of 26 levers moved — `height` 2.6 → 2.8. Move a number here →
// move it on the page too, or the next dial-in is measured against the wrong
// defaults. `standeeCheck.mjs` §0 fails if they drift apart.
//
// 🎯 HIS THREE RULINGS, and they are why this file looks the way it does:
//
//  1. FACING — "the facing is the way the spirit is facing - so the only true
//     'direct' facing is the angle at which the Spirit is actually facing on the
//     board", and "lets do away with 'mirror'". So the sheet turns with the
//     Spirit and NOTHING turns it toward the camera, there is one print (not a
//     mirrored pair), and it is `DoubleSide` — the back is the front seen from
//     behind, through the sheet, which is what a real printed standee does.
//     ⚠️ `facing:'soft'`/`'camera'` exist as the settings he rejected; the only
//     thing the camera may ever change is PITCH (`steepLean`), never yaw.
//  2. LOOK — "make it look acrylic with neon edges - but behind that, a
//     transparent gloss look". An extruded sheet, a neon ribbon on the cut edge
//     in the Spirit's colour, and real transmission behind the print.
//  3. CUT — "cut everything in the art". `standeeOutlines.js` holds both cuts;
//     `tight` (the default) keeps the Ronin's lightning as spurs of acrylic.
//
// 📌 TWO HALVES, like `moveTiles.js`. The top is pure — no three, no DOM, no
// clock: where the geometry's points go, what the yaw is, how far a high camera
// may tip a sheet. The bottom is the three.js half. A Spirit with no traced
// outline gets a plain rectangular cut of its art rather than nothing.
import * as THREE from 'three';
import { STANDEE_OUTLINES } from './standeeOutlines.js';

export const STANDEE = Object.freeze({
  cut:'tight', panelLook:'glass',
  height:2.8, thickness:0.1, lip:'lip', lipScale:1.03,
  panelTint:'#9fd8ff', panelOpacity:0.16, gloss:0.92, artLift:0.85,
  edgeColor:'spirit', edgeFixed:'#4fe8ff', edgeGlow:2, edgeSpread:0.35,
  base:'disc', baseGlow:0.9, lean:4, bob:0.025, sink:0.06, shadow:0.35, koTilt:78,
  facing:'board', softDeg:25, steepLean:35, actingRing:'on', nameTag:'off',
});

/** The board height a standee stands at — its stand's underside, on the deck. */
export const STANDEE_Y = 0.2;
/** ⚠️ The trace threshold in `standeeOutlines.js` is this × 255 (= 115). */
const ALPHA_TEST = 0.45;
/** A Spirit with no traced outline: the whole image, cut square. */
const PLAIN_CUT = Object.freeze({ panel:[[[0, 0], [1, 0], [1, 1], [0, 1]]], art:[[[0, 0], [1, 0], [1, 1], [0, 1]]] });

// ── pure ─────────────────────────────────────────────────────────────────────

/** The outline record for a Spirit, and the cut `T.cut` asks for. */
export function cutFor(id, T = STANDEE) {
  const o = STANDEE_OUTLINES[id];
  if (!o) return { w:1, h:1, foot:1, ...PLAIN_CUT };
  return { w:o.w, h:o.h, foot:o.foot, ...(o[T.cut] ?? o.tight) };
}

/**
 * One outline point in world units. The outline is 0…1 of the image with y from
 * the TOP, so this flips y and puts the feet on 0; x is centred on the Spirit.
 */
export const outlinePoint = ([x, y], w, h, height, scale = 1) =>
  [(x - 0.5) * height * (w / h) * scale, (1 - y) * height * scale];

/** Half the cut's width in world units — what the stand has to be wide enough for. */
export function halfWidth(rings, w, h, height, scale = 1) {
  let m = 0;
  for (const r of rings) for (const p of r) m = Math.max(m, Math.abs(outlinePoint(p, w, h, height, scale)[0]));
  return m;
}

/**
 * Which way the sheet turns. ⭐ `board` is Alex's ruling and the only setting
 * shipped: the Spirit's own facing, with no cheat toward the camera.
 *
 * ⭐ THE FLAT ART IS THE DIRECTION (Alex, 2026-09-18: *"I'd like the base art
 * part to be the 'direction'"*). The sheet's FACE points where the Spirit is
 * facing, so a Spirit walking toward you is a Spirit you are looking at. The
 * cut edge is what you see from the side, which is what a standee on a table
 * does. Three facts pin the one line below, and all three are load-bearing:
 *
 *  1. `hexGeometry.facingAngle` is `atan2(dy, dx)` in SVG PIXELS, and
 *     `arenaPoint` maps px → +x and py → +z. So facing `f` is the world
 *     direction `(cos f, 0, sin f)`.
 *  2. A three.js Y rotation of `yaw` points local +z at `(sin yaw, 0, cos yaw)`
 *     — an angle of `π/2 − yaw` in the same convention as (1).
 *  3. The art plane is a `ShapeGeometry` in XY, so its normal IS local +z.
 *
 * Put together: `yaw = π/2 − f`.
 *
 * ⚠️ IT IS A MINUS, NOT A PLUS, AND THAT IS THE WHOLE BUG THIS REPLACED.
 * `spiritMiniature` used `facing + π/2`, which is this MIRRORED about the x
 * axis: right at facing 0° and 180°, a full 180° wrong at 90° and 270°, and
 * exactly 90° wrong on the diagonals — which on a hex board is most of the
 * time, and is why the standees read edge-on. The block pawn had the same bug
 * for as long as it existed; nobody could see it because a chunky block has no
 * readable front. ⭐ The blocks now share this function, so there is one
 * convention on the board instead of two.
 *
 * `toCamera` is a YAW (what you would set `rotation.y` to), not a world angle —
 * do not pass an `atan2` straight in.
 */
export function standeeYaw(facing, { toCamera = 0, T = STANDEE } = {}) {
  const base = Math.PI / 2 - (facing ?? 0);
  if (T.facing === 'camera') return toCamera;
  if (T.facing !== 'soft') return base;
  const d = ((toCamera - base + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return base + Math.max(-1, Math.min(1, d / (Math.PI / 2))) * THREE.MathUtils.degToRad(T.softDeg);
}

/**
 * How far to tip the sheet BACK under a high camera, in radians.
 *
 * 📌 PITCH ONLY, and that is the whole point. The tactical view looks almost
 * straight down and a standee is a sheet — from up there it is a line. Tipping
 * it back keeps it readable without touching WHICH WAY the Spirit faces, which
 * is the thing Alex ruled on. `steepLean:0` leaves them honest and thin.
 */
export function steepPitch(elevation, T = STANDEE) {
  const t = Math.max(0, Math.min(1, (elevation - Math.PI / 5) / (Math.PI * 0.38)));
  return THREE.MathUtils.degToRad(T.steepLean) * (t * t * (3 - 2 * t));
}

// ── three.js ─────────────────────────────────────────────────────────────────

const shapeFrom = (points, w, h, height, scale = 1) =>
  new THREE.Shape(points.map(p => new THREE.Vector2(...outlinePoint(p, w, h, height, scale))));
const shapesFrom = (rings, w, h, height, scale = 1) => rings.map(r => shapeFrom(r, w, h, height, scale));

function ribbon(points, w, h, height, depth, scale = 1) {
  const v = [], n = [], P = points.map(p => outlinePoint(p, w, h, height, scale));
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = dy / len, ny = -dx / len;
    v.push(a[0], a[1], depth / 2, b[0], b[1], depth / 2, a[0], a[1], -depth / 2,
      b[0], b[1], depth / 2, b[0], b[1], -depth / 2, a[0], a[1], -depth / 2);
    for (let q = 0; q < 6; q++) n.push(nx, ny, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  return g;
}

/** One ribbon per ring, merged by hand — BufferGeometryUtils is a whole extra import. */
export function ribbons(rings, w, h, height, depth, scale = 1) {
  const gs = rings.map(r => ribbon(r, w, h, height, depth, scale));
  if (gs.length === 1) return gs[0];
  const pos = [], nor = [];
  for (const g of gs) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); g.dispose(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/** UVs straight off the geometry's own x/y, so the print lands where it was cut. */
export function planarUV(geo, w, h, height, scale = 1) {
  const uv = [], pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (height * (w / h) * scale) + 0.5, y = 1 - pos.getY(i) / (height * scale);
    uv.push(x, 1 - y);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

/**
 * One standee. `spirit` is an `arenaFrame` spirit — `{ id, color, imageSrc }`.
 *
 * The returned Group is a drop-in for `spiritMiniature`'s: the caller still owns
 * where it stands and which way it turns. Everything the SHEET does — lean, the
 * knocked-out fall, the idle sway, the acting ring, the tip under a high camera
 * — is this object's `frame()`, so the caller must not also rotate or scale it.
 */
export function createStandee(spirit, { T = STANDEE, loader = defaultLoader } = {}) {
  const group = new THREE.Group();
  group.name = `Spirit standee: ${spirit.id}`;
  const color = new THREE.Color(spirit.color ?? '#88ccff');
  const o = cutFor(spirit.id, T);
  const lip = T.lip === 'lip';
  const rings = lip ? o.panel : o.art, scale = lip ? T.lipScale : 1;
  const parts = [];
  const keep = m => { parts.push(m); group.add(m); return m; };

  const shadow = keep(new THREE.Mesh(new THREE.CircleGeometry(0.75, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:T.shadow, depthWrite:false })));
  shadow.position.y = -0.01;

  // ── the clear sheet ────────────────────────────────────────────────────────
  // ⚠️ `tint` is a see-through colour, NOT acrylic: over a dark board a 16%
  // white sheet reads as a grey CARD behind the character. `glass` is real
  // transmission — the board bends through it — which is what Alex's
  // "transparent gloss look" actually looks like. It costs one extra pass.
  const glass = T.panelLook === 'glass';
  const edgeColor = (T.edgeColor === 'spirit' ? color.clone() : new THREE.Color(T.edgeFixed)).multiplyScalar(T.edgeGlow);
  const panelGeo = new THREE.ExtrudeGeometry(shapesFrom(rings, o.w, o.h, T.height, scale), { depth:T.thickness, bevelEnabled:false });
  panelGeo.translate(0, 0, -T.thickness / 2);
  const panel = keep(new THREE.Mesh(panelGeo, new THREE.MeshPhysicalMaterial({
    // ⚠️ In glass, `color` MULTIPLIES what you see through the sheet — a tint
    // there paints the print, not the acrylic. The tint belongs in the
    // attenuation (the colour light picks up crossing the material), scaled by
    // how solid the sheet is meant to look.
    color:glass ? 0xffffff : new THREE.Color(T.panelTint),
    transmission:glass ? 1 : 0, ior:1.49, thickness:glass ? T.thickness * 4 : 0,
    transparent:!glass, opacity:glass ? 1 : T.panelOpacity,
    attenuationColor:new THREE.Color(T.panelTint),
    attenuationDistance:glass ? Math.max(0.4, T.thickness * 2 / Math.max(0.02, T.panelOpacity)) : Infinity,
    roughness:Math.max(0.02, (1 - T.gloss) * 0.6), metalness:0,
    clearcoat:T.gloss, clearcoatRoughness:(1 - T.gloss) * 0.4,
    // ⚠️ NEVER depthWrite. The sheet's front face is nearer than the print
    // inside it, so a sheet that writes depth makes the print fail the depth
    // test and the standee comes out an empty pane of glass.
    side:THREE.DoubleSide, depthWrite:false, emissive:edgeColor, emissiveIntensity:T.edgeSpread * 0.25,
  })));
  panel.renderOrder = 8; panel.visible = T.panelLook !== 'off';

  // ── the cut edge, lit like piped neon ──────────────────────────────────────
  const edge = keep(new THREE.Mesh(ribbons(rings, o.w, o.h, T.height, T.thickness, scale),
    new THREE.MeshStandardMaterial({ color:0x0b1020, emissive:edgeColor, emissiveIntensity:1,
      roughness:0.35, metalness:0.2, side:THREE.DoubleSide })));
  edge.renderOrder = 9;

  // ── the print itself ───────────────────────────────────────────────────────
  // ⚠️ TRANSPARENT, and drawn AFTER the sheet (renderOrder 10 > 8). three draws
  // the whole transparent queue after the opaque one, so an "opaque" print is
  // drawn BEFORE the sheet and the sheet then washes over it — which is how a
  // 16% tint turned every character into a grey ghost during the preview. The
  // print is in the SAME queue as the sheet and simply sorted after it.
  // 📌 One texture, DoubleSide: the back is the front seen from behind, through
  // the sheet. Alex, 2026-09-18: "lets do away with 'mirror'".
  const texture = spirit.imageSrc ? loader(spirit.imageSrc) : null;
  const artGeo = planarUV(new THREE.ShapeGeometry(shapesFrom(o.art, o.w, o.h, T.height, 1)), o.w, o.h, T.height, 1);
  const art = keep(new THREE.Mesh(artGeo, new THREE.MeshStandardMaterial({
    map:texture, emissiveMap:texture, emissive:0xffffff, emissiveIntensity:T.artLift,
    transparent:true, alphaTest:ALPHA_TEST, roughness:0.85, metalness:0.02,
    side:THREE.DoubleSide, depthWrite:true,
  })));
  art.renderOrder = 10;

  // ── what it stands in ──────────────────────────────────────────────────────
  // 📌 The stand follows the CUT, not a fixed radius: the Ronin is 1.1 art
  // widths wide and the Monster nearly square, and a disc sized for one looks
  // like a coaster under the other. Capped at .8 — a hex is .8 to its flat.
  const r = Math.min(0.8, Math.max(0.46, halfWidth(rings, o.w, o.h, T.height, scale) * 0.62));
  let baseMesh = null, halo = null;
  if (T.base === 'disc') {
    baseMesh = keep(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, 0.1, 6).rotateY(Math.PI / 6),
      new THREE.MeshStandardMaterial({ color:0x111a2d, metalness:0.65, roughness:0.4,
        emissive:color, emissiveIntensity:0.25 * T.baseGlow })));
    halo = keep(new THREE.Mesh(new THREE.TorusGeometry(r * 1.08, 0.05, 8, 36).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color:color.clone().multiplyScalar(1.6 * T.baseGlow), toneMapped:false })));
  } else if (T.base === 'clip') {
    const w = Math.min(1.5, halfWidth(rings, o.w, o.h, T.height, scale) * 1.15);
    baseMesh = keep(new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.42),
      new THREE.MeshPhysicalMaterial({ color:new THREE.Color(T.panelTint), transparent:true,
        opacity:Math.min(0.5, T.panelOpacity * 2), roughness:0.05, clearcoat:1,
        side:THREE.DoubleSide, emissive:edgeColor, emissiveIntensity:0.3 * T.baseGlow })));
    halo = keep(new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.02, 0.46),
      new THREE.MeshBasicMaterial({ color:edgeColor, toneMapped:false })));
  }
  if (baseMesh) baseMesh.position.y = 0.05;
  if (halo) halo.position.y = 0.1;
  const ring = keep(new THREE.Mesh(new THREE.RingGeometry(r * 1.2, r * 1.5, 6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color:color.clone().multiplyScalar(2), transparent:true,
      opacity:0.8, toneMapped:false, depthWrite:false })));
  ring.position.y = 0.01;
  shadow.scale.setScalar(Math.max(0.6, r / 0.75));

  const api = {
    group, radius:r, height:T.height, parts,
    /**
     * @param time seconds · `knockedOut` / `acting` from the frame · `cameraPos`
     * a THREE.Vector3 (omit it and the sheet simply never tips back).
     */
    frame(time, { knockedOut = false, acting = false, reduced = false, cameraPos = null } = {}) {
      const sway = reduced || !T.bob ? 0 : Math.sin(time * 1.6 + group.position.x) * T.bob;
      let steep = 0;
      if (cameraPos) {
        const elev = Math.atan2(cameraPos.y - group.position.y,
          Math.hypot(cameraPos.x - group.position.x, cameraPos.z - group.position.z));
        steep = steepPitch(elev, T);
      }
      const lean = THREE.MathUtils.degToRad(T.lean) + steep + sway * 0.4;
      const ko = knockedOut ? THREE.MathUtils.degToRad(T.koTilt) : 0;
      for (const m of [panel, edge, art]) {
        m.rotation.x = -lean - ko;
        m.position.y = 0.02 - T.sink + (knockedOut ? 0.05 + T.sink : 0);
      }
      shadow.material.opacity = T.shadow * (knockedOut ? 0.6 : 1);
      ring.visible = T.actingRing === 'on' && acting && !knockedOut;
      ring.material.opacity = reduced ? 0.7 : 0.55 + 0.25 * Math.sin(time * 2.2);
      if (baseMesh) baseMesh.visible = !knockedOut;
      if (halo) halo.visible = !knockedOut;
    },
    dispose() {
      for (const m of parts) { m.geometry.dispose(); m.material.dispose(); }
      texture?.dispose();
      group.clear();
    },
  };
  group.userData.standee = api;
  return api;
}

// ⚠️ ONE TEXTURE PER STANDEE, NOT A SHARED CACHE. `releaseArenaObject` disposes
// every texture it finds on a released subtree, so a cache would let one Spirit
// leaving the board blank the other three. The browser still fetches the image
// once; only the GPU upload is per standee, and there are at most four.
const textureLoader = new THREE.TextureLoader();
function defaultLoader(url) {
  const t = textureLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
