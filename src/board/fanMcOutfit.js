// ─── 🎩 THE FAN MC'S WARDROBE — what he wears in the game ─────────────────────
// Alex, 2026-10-16: *"lets make a fashion preview for the MC - he should get a special
// 'look'"* → the Fan MC Wardrobe page (`.scratch/fan-mc-fashion-preview.html`) → his
// dial-in the same evening (7 of 16 levers): a MOHAWK, an LED VISOR, NOTES orbiting him,
// a NEON mic, in hot pink on dark teal with silver. `MC_OUTFIT` below is that dial-in.
//
// The MC is one crowd fan (`board/cosmicFans.js` fanPawn3D: a curled spirit body, a
// floating head, two floating hands). This file dresses that fan: a slot each for the
// head, the eyes, the neck, the body, an aura and the mic, in three colours (garment,
// accent, metal). `board/fanMcStage.js` calls `dressMc` every time it builds him and
// ticks it from `poseMc` with the mood it already computes; the Wardrobe page drives
// the game's own stage (`setOutfit`), so the page and the game are one copy (§B1).
//
// ⭐ Pure three.js, no DOM except small canvas textures (guarded, so the node checks
// still run — with no canvas, the visor stripes and the notes' glyphs simply don't draw).
//
// 📐 UNITS: the fan's own (its head is a .12 sphere at y .49; the body runs y .01–.35
// and is ±.13 wide, ±.095 deep at its fullest). The stage scales him ×2.4 and the fan
// is ×1.39 again, so one unit here is ~3.3 m on the board.
// ⚠️ THE MC IS DRAWN ON HIS OWN LAYER WITH NO BLOOM (arenaRenderer.js `mcScene`), so
// anything meant to glow carries its own soft sprite instead of relying on the arena's.
import * as THREE from 'three';

/** ✎ ALEX'S DIAL-IN (2026-10-16, Fan MC Wardrobe, 7 of 16 levers; ✎ = his). Before it he
 *  wore the Ronin band and a chrome mic (head 'band', eyes/neck/body/aura 'none', mic
 *  'chrome', main '#191726', accent '#ffc54a', metal 'gold' — the page's "before" look). */
export const MC_OUTFIT = Object.freeze({
  head: 'mohawk' /* ✎ */,   // band · tophat · crown · cap · headphones · halo · mohawk · none
  eyes: 'visor' /* ✎ */,    // none · aviators · stars · visor · monocle
  neck: 'none',             // none · bowtie · chain · scarf · pass
  body: 'none',             // none · tux · sequins · cape · sash
  aura: 'notes' /* ✎ */,    // none · sparkle · notes · confetti
  mic: 'neon' /* ✎ */,      // chrome · gold · rhinestone · neon
  main: '#0f2e2a' /* ✎ */,  // garment colour: hat, lapels, cape, cap, the visor's frame
  accent: '#ff4fd8' /* ✎ */,// ribbon, bow tie, gems, the visor's light, the mohawk, the neon mic
  metal: 'silver' /* ✎ */,  // gold · silver · rose · black
  hatSize: 1, hatTilt: .18, glow: 1, sparkle: 1, capeLength: 1, sequins: 1,
});
/** The look he wore before the dial-in — the Wardrobe page's honest "before". */
export const MC_OUTFIT_BEFORE = Object.freeze({ ...MC_OUTFIT, head:'band', eyes:'none', aura:'none', mic:'chrome', main:'#191726', accent:'#ffc54a', metal:'gold' });

/** The crowd-fan style the stage must build him with: the Ronin band IS a fan style
 *  (`base`, the stage's own `style` lever); any other headwear needs the plain head. */
export const outfitFanStyle = (o, base = 'ronin') => (o.head === 'band' ? base : 'plain');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const METALS = {
  gold:   { color:'#ffc52e', emissive:'#9b6008' },
  silver: { color:'#e4e9f2', emissive:'#4a5468' },
  rose:   { color:'#f4a68e', emissive:'#7a3424' },
  black:  { color:'#2a2d38', emissive:'#0c0e14' },
};
const hasDoc = typeof document !== 'undefined' && typeof document.createElement === 'function';
function canvasTex(w, h, draw) {
  if (!hasDoc) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); if (!g) return null;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let GLOW_TEX = null, STAR_TEX = null;
const glowTex = () => GLOW_TEX ??= canvasTex(64, 64, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.3, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
const starTex = () => STAR_TEX ??= canvasTex(64, 64, (g, w) => {
  const c = w / 2; g.fillStyle = '#fff'; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 5 : 30; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
  g.closePath(); g.fill();
  const r = g.createRadialGradient(c, c, 0, c, c, c); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(.25, 'rgba(255,255,255,.15)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
const textTex = (lines, { w = 128, h = 128, bg = null, fg = '#fff', font = '900 44px sans-serif' } = {}) => canvasTex(w, h, (g) => {
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach(([text, f, y, color]) => { g.font = f ?? font; g.fillStyle = color ?? fg; g.fillText(text, w / 2, y ?? h / 2); });
});
function glowSprite(color, size, opacity = .6) {
  const tex = glowTex(); if (!tex) return null;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, color, transparent:true, opacity, depthWrite:false, blending:THREE.AdditiveBlending }));
  s.scale.setScalar(size); s.userData.baseOpacity = opacity; return s;
}

/** The body's front (or back) surface at (x, y), from its own vertices — so a lapel or a
 *  sash hugs the curled body instead of floating in front of a guess. Body-local units. */
function surfaceOf(body) {
  const p = body.geometry.attributes.position, pts = [];
  for (let i = 0; i < p.count; i++) pts.push([p.getX(i), p.getY(i), p.getZ(i)]);
  return (x, y, side = 1) => {
    let best = null, bestD = Infinity;
    for (const [px, py, pz] of pts) {
      if (pz * side <= 0) continue;
      const d = (px - x) ** 2 + ((py - y) * 1.3) ** 2;
      if (d < bestD) { bestD = d; best = pz; }
    }
    return best ?? 0;
  };
}
/** A flat 2-D outline laid onto the body's front, lifted `lift` off it. */
function surfacePatch(surface, outline, lift, steps = 6) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ShapeGeometry(shape, steps);
  // subdivide by hand: ShapeGeometry is a fan; tessellate finer so it bends with the body
  const tess = geo.toNonIndexed(), pos = tess.attributes.position, out = [];
  const split = (a, b, c, n) => {
    if (n === 0) { out.push(a, b, c); return; }
    const ab = a.clone().lerp(b, .5), bc = b.clone().lerp(c, .5), ca = c.clone().lerp(a, .5);
    split(a, ab, ca, n - 1); split(ab, b, bc, n - 1); split(ca, bc, c, n - 1); split(ab, bc, ca, n - 1);
  };
  for (let i = 0; i < pos.count; i += 3) split(V(pos.getX(i), pos.getY(i), 0), V(pos.getX(i + 1), pos.getY(i + 1), 0), V(pos.getX(i + 2), pos.getY(i + 2), 0), 2);
  for (const v of out) v.z = surface(v.x, v.y) + lift;
  const g = new THREE.BufferGeometry().setFromPoints(out); g.computeVertexNormals();
  geo.dispose(); tess.dispose(); return g;
}

/**
 * Dress one fan. Returns `{ tick(clock, { mood, dt, reduced }), dispose() }`.
 * @param fan  the fanPawn3D root (has userData.hands; the stage hangs the mic on hands[1])
 * @param o    an outfit (MC_OUTFIT's keys)
 */
export function dressMc(fan, o = MC_OUTFIT) {
  const added = [], swaps = [], ticks = [], mats = [];
  const add = (parent, obj) => { if (obj) { parent.add(obj); added.push(obj); } return obj; };
  const mat = m => { mats.push(m); return m; };
  const head = fan.children.find(c => c.isGroup && Math.abs(c.position.y - .49) < .06) ?? fan;
  const body = fan.getObjectByName('Curled spirit body');
  const hands = fan.userData.hands ?? [];
  const metal = METALS[o.metal] ?? METALS.gold, glow = Math.max(0, o.glow);
  const main = mat(new THREE.MeshStandardMaterial({ color:o.main, roughness:.42, metalness:.12, emissive:o.main, emissiveIntensity:.12 }));
  const accent = mat(new THREE.MeshStandardMaterial({ color:o.accent, roughness:.35, emissive:o.accent, emissiveIntensity:.35 * glow }));
  const shine = mat(new THREE.MeshBasicMaterial({ color:new THREE.Color(o.accent).multiplyScalar(.6 + .6 * glow), toneMapped:false }));
  const gold = mat(new THREE.MeshStandardMaterial({ color:metal.color, emissive:metal.emissive, emissiveIntensity:.45, metalness:.72, roughness:.25 }));
  const white = mat(new THREE.MeshStandardMaterial({ color:'#f4f6ff', roughness:.6, emissive:'#cfd8f0', emissiveIntensity:.15 }));
  const k = o.hatSize;

  // ── 🎩 HEAD ──
  const hat = new THREE.Group(); hat.name = 'MC headwear'; add(head, hat);
  hat.rotation.z = -o.hatTilt; hat.rotation.x = -o.hatTilt * .35;
  if (o.head === 'tophat') {
    const g = new THREE.Group(); g.position.y = .088; g.scale.setScalar(k); hat.add(g);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(.155, .155, .012, 40), main));
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(.088, .094, .17, 36), main); crown.position.y = .09; g.add(crown);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(.089, .089, .006, 36), main); lid.position.y = .177; g.add(lid);
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(.0955, .097, .032, 36), accent); ribbon.position.y = .024; g.add(ribbon);
  } else if (o.head === 'crown') {
    const g = new THREE.Group(); g.position.y = .078; g.scale.setScalar(k); hat.add(g);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.094, .1, .052, 40, 1, true), gold); ring.material.side = THREE.DoubleSide; g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, spike = new THREE.Mesh(new THREE.ConeGeometry(.02, .07, 8), gold);
      spike.position.set(Math.sin(a) * .094, .058, Math.cos(a) * .094); spike.rotation.set(Math.cos(a) * .2, 0, -Math.sin(a) * .2); g.add(spike);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(.011, 10, 8), shine); gem.position.set(Math.sin(a) * .1, .0, Math.cos(a) * .1); g.add(gem);
    }
    const sp = glowSprite(o.accent, .12, .35 * glow); if (sp) { sp.position.y = .03; g.add(sp); }
  } else if (o.head === 'cap') {
    const g = new THREE.Group(); g.scale.setScalar(k); g.rotation.y = Math.PI; hat.add(g);   // worn backwards
    const dome = new THREE.Mesh(new THREE.SphereGeometry(.127, 28, 12, 0, Math.PI * 2, 0, Math.PI * .5), main); dome.position.y = .006; dome.scale.y = .9; g.add(dome);
    const brim = new THREE.Mesh(new THREE.CircleGeometry(.1, 20, 0, Math.PI), accent); brim.material = accent; brim.material.side = THREE.DoubleSide;
    brim.rotation.x = -Math.PI / 2 + .12; brim.position.set(0, .012, .1); brim.scale.set(1, 1.1, 1); g.add(brim);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(.014, 10, 8), accent); btn.position.y = .12; g.add(btn);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(.03, 20), shine); badge.position.set(0, .07, -.105); badge.rotation.y = Math.PI; g.add(badge);
  } else if (o.head === 'headphones') {
    const g = new THREE.Group(); g.scale.setScalar(k); hat.add(g); hat.rotation.set(0, 0, 0);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.137, .012, 8, 40, Math.PI), main); band.position.y = .0; g.add(band);
    for (const s of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(.052, .052, .036, 24), main); cup.rotation.z = Math.PI / 2; cup.position.set(s * .136, 0, 0); g.add(cup);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.044, .007, 8, 28), shine); ring.rotation.y = Math.PI / 2; ring.position.set(s * .156, 0, 0); g.add(ring);
      const sp = glowSprite(o.accent, .09, .4 * glow); if (sp) { sp.position.set(s * .16, 0, 0); g.add(sp); }
    }
  } else if (o.head === 'halo') {
    const g = new THREE.Group(); g.position.y = .2; g.scale.setScalar(k); hat.add(g); hat.rotation.set(0, 0, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.092, .011, 10, 48), shine); ring.rotation.x = Math.PI / 2; g.add(ring);
    const sp = glowSprite(o.accent, .32, .5 * glow); if (sp) g.add(sp);
    ticks.push((t, { reduced }) => { if (!reduced) { g.position.y = .2 + Math.sin(t * 1.6) * .012; ring.rotation.z = t * .6; } });
  } else if (o.head === 'mohawk') {
    const g = new THREE.Group(); g.scale.setScalar(k); hat.add(g); hat.rotation.z = 0;
    for (let i = 0; i < 7; i++) {
      const a = -.9 + i * .3, h = .07 + .045 * Math.sin((i + .5) / 7 * Math.PI);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(.03, h, 10), i % 2 ? accent : shine); spike.scale.x = 1.5;
      spike.position.set(0, Math.cos(a) * (.115 + h / 2), Math.sin(a) * (.115 + h / 2)); spike.rotation.x = a; g.add(spike);
    }
  }

  // ── 🕶️ EYES ── (his eyes sit at x ±.042, y .006, z .113 on the head)
  const eyes = new THREE.Group(); eyes.name = 'MC eyewear'; add(head, eyes);
  if (o.eyes === 'aviators') {
    const glass = mat(new THREE.MeshStandardMaterial({ color:'#0d1220', roughness:.12, metalness:.6, emissive:o.accent, emissiveIntensity:.18 * glow }));
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * .047, .004, .113); g.rotation.y = s * .4; eyes.add(g);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(.04, 24), glass); lens.scale.set(1, .82, 1); lens.position.z = .008; g.add(lens);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.04, .0045, 6, 28), gold); rim.scale.set(1, .82, 1); rim.position.z = .008; g.add(rim);
      const glint = new THREE.Mesh(new THREE.CircleGeometry(.008, 10), mat(new THREE.MeshBasicMaterial({ color:'#ffffff', transparent:true, opacity:.8, toneMapped:false })));
      glint.position.set(-.014, .012, .0095); g.add(glint);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .03, 6), gold); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, .022, .123); eyes.add(bridge);
  } else if (o.eyes === 'stars') {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .021 : .05; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    for (const s of [-1, 1]) {
      const star = new THREE.Mesh(new THREE.ShapeGeometry(shape), shine); star.position.set(s * .048, .006, .122); star.rotation.y = s * .4; eyes.add(star);
      const sp = glowSprite(o.accent, .1, .3 * glow); if (sp) { sp.position.copy(star.position); eyes.add(sp); }
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .03, 6), shine); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, .012, .126); eyes.add(bridge);
  } else if (o.eyes === 'visor') {
    const tex = canvasTex(128, 16, (g, w, h) => { for (let x = 0; x < w; x += 8) { g.fillStyle = `rgba(255,255,255,${.35 + .65 * ((x / 8) % 2)})`; g.fillRect(x, 0, 6, h); } });
    if (tex) { tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1); }
    const vm = mat(new THREE.MeshBasicMaterial({ color:new THREE.Color(o.accent).multiplyScalar(.7 + .5 * glow), map:tex, transparent:true, opacity:.92, side:THREE.DoubleSide, toneMapped:false }));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.127, .127, .048, 36, 1, true, -1.05, 2.1), vm); band.position.y = .008; eyes.add(band);
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(.124, .124, .058, 36, 1, true, -1.12, 2.24), main); frame.material.side = THREE.DoubleSide; frame.position.y = .008; eyes.add(frame);
    const sp = glowSprite(o.accent, .2, .3 * glow); if (sp) { sp.position.set(0, .01, .12); eyes.add(sp); }
    ticks.push((t, { reduced }) => { if (tex && !reduced) tex.offset.x = (t * .8) % 1; });
  } else if (o.eyes === 'monocle') {
    const g = new THREE.Group(); g.position.set(.047, .004, .113); g.rotation.y = .4; eyes.add(g);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.042, .005, 6, 28), gold); rim.position.z = .009; g.add(rim);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.04, 24), mat(new THREE.MeshBasicMaterial({ color:'#cfe6ff', transparent:true, opacity:.22 }))); lens.position.z = .009; g.add(lens);
    const chain = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(.075, -.03, .12), V(.1, -.1, .1), V(.11, -.17, .07)]), 12, .003, 5, false), gold); eyes.add(chain);
  }

  // ── 🎀 NECK ── (between his chin and the top of the body, y ~.33–.37)
  const neck = new THREE.Group(); neck.name = 'MC neckwear'; add(fan, neck);
  if (o.neck === 'bowtie') {
    const g = new THREE.Group(); g.position.set(0, .352, .07); neck.add(g);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(.034, .07, 4), accent); wing.rotation.z = s * Math.PI / 2; wing.position.x = -s * .034; wing.scale.z = .45; g.add(wing);
    }
    g.add(new THREE.Mesh(new THREE.SphereGeometry(.017, 12, 8), accent));
  } else if (o.neck === 'chain') {
    const path = new THREE.CatmullRomCurve3([V(-.1, .34, .03), V(-.07, .28, .085), V(0, .245, .1), V(.07, .28, .085), V(.1, .34, .03)]);
    neck.add(new THREE.Mesh(new THREE.TubeGeometry(path, 24, .011, 6, false), gold));
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.038, .038, .012, 28), gold); disc.rotation.x = Math.PI / 2; disc.position.set(0, .2, .105); neck.add(disc);
    const t = textTex([['MC', '900 60px sans-serif', 68]], { w:128, h:128 });
    if (t) { const face = new THREE.Mesh(new THREE.CircleGeometry(.032, 24), mat(new THREE.MeshBasicMaterial({ map:t, color:o.accent, transparent:true, toneMapped:false }))); face.position.set(0, .2, .112); neck.add(face); }
  } else if (o.neck === 'scarf') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.068, .026, 10, 28), accent); ring.rotation.x = Math.PI / 2; ring.position.y = .352; ring.scale.set(1, 1, .8); neck.add(ring);
    for (const [x, rz, len] of [[.035, .18, .15], [.06, -.08, .12]]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(.042, len, .012), accent); tail.position.set(x, .35 - len / 2, .085); tail.rotation.z = rz; neck.add(tail);
      ticks.push((t, { reduced }) => { if (!reduced) tail.rotation.x = Math.sin(t * 2.2 + x * 40) * .08; });
    }
  } else if (o.neck === 'pass') {
    const path = new THREE.CatmullRomCurve3([V(-.075, .36, -.01), V(-.045, .29, .085), V(0, .225, .105), V(.045, .29, .085), V(.075, .36, -.01)]);
    neck.add(new THREE.Mesh(new THREE.TubeGeometry(path, 24, .006, 5, false), accent));
    const t = textTex([['ALL', '900 26px sans-serif', 30, '#111'], ['ACCESS', '900 22px sans-serif', 56, '#111'], ['MC', '900 44px sans-serif', 104, o.accent]], { w:96, h:128, bg:'#f4f6ff' });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(.06, .08), t ? mat(new THREE.MeshBasicMaterial({ map:t })) : white); card.position.set(0, .18, .112); neck.add(card);
    ticks.push((tt, { reduced }) => { if (!reduced) card.rotation.z = Math.sin(tt * 1.7) * .08; });
  }

  // ── 🧥 BODY ── (on the body mesh itself, so it sways with him)
  const wear = new THREE.Group(); wear.name = 'MC bodywear';
  if (body) add(body, wear);
  const surface = body ? surfaceOf(body) : () => .09;
  if (o.body === 'tux' && body) {
    for (const s of [-1, 1]) {
      const lapel = new THREE.Mesh(surfacePatch(surface, [[s * .012, .345], [s * .105, .3], [s * .1, .22], [s * .02, .14]], .006), main);
      lapel.material = main; main.side = THREE.DoubleSide; wear.add(lapel);
    }
    const shirt = new THREE.Mesh(surfacePatch(surface, [[-.012, .345], [.012, .345], [.02, .14], [-.02, .14]], .007), white); white.side = THREE.DoubleSide; wear.add(shirt);
    for (const y of [.27, .21, .16]) { const stud = new THREE.Mesh(new THREE.SphereGeometry(.007, 8, 6), gold); stud.position.set(0, y, surface(0, y) + .012); wear.add(stud); }
    const rose = new THREE.Mesh(new THREE.SphereGeometry(.016, 10, 8), accent); rose.position.set(-.07, .28, surface(-.07, .28) + .016); wear.add(rose);
  } else if (o.body === 'sequins' && body) {
    const p = body.geometry.attributes.position, nrm = body.geometry.attributes.normal ?? (body.geometry.computeVertexNormals(), body.geometry.attributes.normal);
    const step = Math.max(1, Math.round(4 / Math.max(.25, o.sequins))), picks = [];
    for (let i = 0; i < p.count; i += step) picks.push(i);
    const geo = new THREE.CircleGeometry(.011, 6);
    const sm = mat(new THREE.MeshBasicMaterial({ color:'#ffffff', toneMapped:false, side:THREE.DoubleSide }));
    const inst = new THREE.InstancedMesh(geo, sm, picks.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), base = new THREE.Color(metal.color), acc = new THREE.Color(o.accent);
    const phase = picks.map((_, i) => (i * 2.399) % (Math.PI * 2)), colors = picks.map((_, i) => (i % 3 === 0 ? acc : base).clone());
    picks.forEach((vi, i) => {
      const n = V(nrm.getX(vi), nrm.getY(vi), nrm.getZ(vi)).normalize(), at = V(p.getX(vi), p.getY(vi), p.getZ(vi)).addScaledVector(n, .004);
      q.setFromUnitVectors(V(0, 0, 1), n); m4.compose(at, q, V(1, 1, 1)); inst.setMatrixAt(i, m4); inst.setColorAt(i, colors[i]);
    });
    wear.add(inst);
    const c = new THREE.Color();
    ticks.push((t, { reduced }) => {
      for (let i = 0; i < picks.length; i++) {
        const tw = reduced ? .9 : .55 + 1.6 * Math.max(0, Math.sin(t * 2.2 + phase[i] * 3)) ** 12;
        inst.setColorAt(i, c.copy(colors[i]).multiplyScalar(tw * (.6 + .4 * glow)));
      }
      inst.instanceColor.needsUpdate = true;
    });
  } else if (o.body === 'cape' && body) {
    const W = 10, H = 12, len = .36 * o.capeLength;
    const geo = new THREE.PlaneGeometry(1, 1, W, H), pos = geo.attributes.position;
    const capeMat = mat(new THREE.MeshStandardMaterial({ color:o.accent, roughness:.55, emissive:o.accent, emissiveIntensity:.12, side:THREE.DoubleSide }));
    const cape = new THREE.Mesh(geo, capeMat); wear.add(cape);
    const shape = (t, reduced) => {
      for (let i = 0; i < pos.count; i++) {
        const u = (i % (W + 1)) / W - .5, v = Math.floor(i / (W + 1)) / H;   // v: 0 top → 1 hem
        // gathered at the shoulders, flaring to the hem (a straight half-tube read as a slab)
        const R = .055 + .13 * v, a = u * Math.PI * (.62 + .4 * v);
        const sway = reduced ? 0 : Math.sin(t * 2.1 + u * 4 + v * 3) * .014 * v;
        pos.setXYZ(i, Math.sin(a) * R, .325 - v * len, -Math.cos(a) * R * .85 - .03 - v * .04 + sway);
      }
      pos.needsUpdate = true; geo.computeVertexNormals();
    };
    shape(0, true);
    ticks.push((t, { reduced }) => shape(t, reduced));
    const collar = new THREE.Mesh(new THREE.TorusGeometry(.085, .016, 8, 24, Math.PI), main); collar.rotation.set(0, Math.PI, 0); collar.position.set(0, .345, -.01); collar.scale.set(1, .5, 1); wear.add(collar);
    for (const s of [-1, 1]) { const clasp = new THREE.Mesh(new THREE.SphereGeometry(.016, 12, 8), gold); clasp.position.set(s * .085, .33, .02); wear.add(clasp); }
  } else if (o.body === 'sash' && body) {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const u = i / 14, x = -.1 + .21 * u, y = .335 - .25 * u; pts.push(V(x, y, surface(x, y) + .012)); }
    wear.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .016, 6, false), accent));
    const mid = pts[7], badge = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .008, 5), gold); badge.rotation.x = Math.PI / 2; badge.position.copy(mid).add(V(0, 0, .014)); wear.add(badge);
  }

  // ── 🎤 THE MIC'S FINISH ── (the stage hangs 'MC mic' on hands[1]; its band colour stays the stage's)
  const mic = hands[1]?.children.find(c => c.name === 'MC mic');
  if (mic && o.mic !== 'chrome') {
    mic.traverse(m => {
      if (!m.isMesh || !m.material?.isMeshStandardMaterial || m.material.metalness < .9) return;
      const next = m.material.clone(); mats.push(next);
      if (o.mic === 'gold') { next.color.set(METALS.gold.color); next.emissive.set(METALS.gold.emissive); next.emissiveIntensity = .5; }
      if (o.mic === 'neon') { next.color.set(o.accent); next.emissive.set(o.accent); next.emissiveIntensity = 1.1 * glow; }
      if (o.mic === 'rhinestone') { next.color.set('#f4f7ff'); next.emissive.set('#8fa8d8'); next.emissiveIntensity = .5; }
      swaps.push([m, m.material]); m.material = next;
    });
    const grille = mic.children.find(c => c.geometry?.type === 'SphereGeometry');
    if (o.mic === 'neon' && grille) { const sp = glowSprite(o.accent, .16, .45 * glow); if (sp) { sp.position.copy(grille.position); add(mic, sp); } }
    if (o.mic === 'rhinestone' && grille) {
      const n = 26, inst = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.009), mat(new THREE.MeshBasicMaterial({ color:'#ffffff', toneMapped:false })), n);
      const m4 = new THREE.Matrix4(), c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const y = 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), a = i * 2.399;
        m4.makeTranslation(grille.position.x + Math.cos(a) * r * .05, grille.position.y + y * .05, grille.position.z + Math.sin(a) * r * .05); inst.setMatrixAt(i, m4); inst.setColorAt(i, c.set('#ffffff'));
      }
      add(mic, inst);
      ticks.push((t, { reduced }) => { for (let i = 0; i < n; i++) inst.setColorAt(i, c.set(i % 4 ? '#dfe8ff' : o.accent).multiplyScalar(reduced ? 1 : .5 + 1.5 * Math.max(0, Math.sin(t * 3 + i * 1.7)) ** 10)); inst.instanceColor.needsUpdate = true; });
    }
  }

  // ── ✨ AURA ── (around the whole fan)
  const aura = new THREE.Group(); aura.name = 'MC aura'; add(fan, aura);
  if (o.aura === 'sparkle' && starTex()) {
    const n = Math.round(14 * o.sparkle), parts = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:starTex(), color:i % 3 ? '#ffffff' : o.accent, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
      mats.push(s.material); aura.add(s);
      parts.push({ s, r:.24 + (i * .37 % 1) * .14, y:.06 + (i * .61 % 1) * .58, sp:.25 + (i * .53 % 1) * .4, ph:i * 2.399, size:.035 + (i * .29 % 1) * .035 });
    }
    ticks.push((t, { reduced }) => { for (const p of parts) {
      const a = p.ph + (reduced ? 0 : t * p.sp); p.s.position.set(Math.sin(a) * p.r, p.y + (reduced ? 0 : Math.sin(t * 1.3 + p.ph) * .03), Math.cos(a) * p.r);
      const tw = reduced ? .8 : Math.max(0, Math.sin(t * 2.6 + p.ph * 2)) ** 3; p.s.scale.setScalar(p.size * (.4 + tw)); p.s.material.opacity = .25 + .75 * tw * glow; } });
  } else if (o.aura === 'notes') {
    const glyphs = ['♪', '♫', '♬', '♩'].map(ch => textTex([[ch, '700 96px serif', 70]], { w:128, h:128 }));
    if (glyphs[0]) {
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:glyphs[i % 4], color:i % 2 ? o.accent : '#ffffff', transparent:true, depthWrite:false }));
        mats.push(s.material); aura.add(s); parts.push({ s, ph:i / 7 * Math.PI * 2, rise:(i * .37) % 1 });
      }
      ticks.push((t, { reduced }) => { for (const p of parts) {
        const a = p.ph + (reduced ? 0 : t * .45), u = reduced ? p.rise : (p.rise + t * .12) % 1;
        p.s.position.set(Math.sin(a) * .3, .1 + u * .6, Math.cos(a) * .3); p.s.scale.setScalar(.09);
        p.s.material.opacity = Math.sin(u * Math.PI) * (.6 + .4 * glow); } });
    }
  } else if (o.aura === 'confetti') {
    // 🎉 a burst on every cheer (his call, his sign-off) — idle otherwise
    const n = 70, inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(.018, .028), mat(new THREE.MeshBasicMaterial({ color:'#ffffff', side:THREE.DoubleSide, toneMapped:false })), n);
    const pal = [o.accent, o.main === '#191726' ? '#ffffff' : o.main, METALS[o.metal]?.color ?? '#ffc52e', '#ffffff'].map(c => new THREE.Color(c));
    const ps = Array.from({ length:n }, (_, i) => ({ p:V(0, -9, 0), v:V(), rot:V(i, i * 2, i * 3), spin:V(3 + i % 5, 2 + i % 3, 4), life:0 }));
    for (let i = 0; i < n; i++) inst.setColorAt(i, pal[i % pal.length]);
    aura.add(inst); let lastMood = null;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V(1, 1, 1), zero = V(0, 0, 0);
    ticks.push((t, { mood, dt = 1 / 60, reduced }) => {
      if (mood === 'cheer' && lastMood !== 'cheer' && !reduced) ps.forEach((p, i) => {
        const a = i * 2.399, up = .9 + (i * .37 % 1) * .8;
        p.p.set(0, .55, 0); p.v.set(Math.cos(a) * (.25 + (i * .61 % 1) * .35), up, Math.sin(a) * (.25 + (i * .29 % 1) * .35)); p.life = 2.4;
      });
      lastMood = mood;
      ps.forEach((p, i) => {
        if (p.life > 0) { p.life -= dt; p.v.y -= 1.6 * dt; p.v.multiplyScalar(1 - 1.2 * dt); p.p.addScaledVector(p.v, dt); p.rot.addScaledVector(p.spin, dt); }
        q.setFromEuler(e.set(p.rot.x, p.rot.y, p.rot.z)); m4.compose(p.p, q, p.life > 0 ? one : zero); inst.setMatrixAt(i, m4);
      });
      inst.instanceMatrix.needsUpdate = true;
    });
  }

  return {
    tick(clock, opts = {}) { for (const f of ticks) f(clock, opts); },
    dispose() {
      for (const [m, prev] of swaps) m.material = prev;
      for (const o2 of added) { o2.removeFromParent(); o2.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material?.map && x.material.map !== GLOW_TEX && x.material.map !== STAR_TEX) x.material.map.dispose(); }); }
      for (const m of mats) m.dispose();
      added.length = swaps.length = ticks.length = mats.length = 0;
    },
  };
}
