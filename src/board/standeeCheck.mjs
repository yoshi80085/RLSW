// 🎭 standeeCheck — `test:standee`. The Spirits' own art, cut out of acrylic and
// stood on the board (Alex, 2026-09-18; dial-in off `.scratch/standee-preview.html`).
//
// Plain node. The pure half is asserted on numbers; the three.js half is built
// for real (three runs headless) and read back off the meshes. What it is FOR is
// Alex's three rulings — facing, the acrylic look, and where the blade goes —
// because those are the parts a refactor would quietly undo.
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { STANDEE as T, STANDEE_Y, STANDEE_BACK, hasBlankBack, cutFor, poseHeight, outlinePoint, halfWidth,
  standeeYaw, steepPitch, ribbons, planarUV, createStandee } from './standee.js';
import { STANDEE_OUTLINES } from './standeeOutlines.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else fail++; if (!cond || process.env.VERBOSE) console.log(`  ${cond ? '✓' : '✗'} ${name}${extra !== '' ? ' — ' + extra : ''}`); };
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const deg = r => r * 180 / Math.PI;
const IDS = ['cosmic_ronin', 'intergalactic_0', 'Metalness_Monster', 'Glamarchy'];
console.log('🎭 standeeCheck — your 2D characters, stood up in acrylic\n');

console.log('§0 the numbers are the dial-in');
ok('STANDEE is frozen', Object.isFrozen(T));
ok('STANDEE matches the dial-in (2026-09-18: height 2.6 → 2.8; 2026-09-25: cut → body)',
  JSON.stringify(T) === JSON.stringify({
    cut:'body', panelLook:'glass',
    height:2.8, thickness:0.1, lip:'lip', lipScale:1.03,
    panelTint:'#9fd8ff', panelOpacity:0.16, gloss:0.92, artLift:0.85,
    edgeColor:'spirit', edgeFixed:'#4fe8ff', edgeGlow:2, edgeSpread:0.35,
    base:'disc', baseGlow:0.9, lean:4, bob:0.025, sink:0.06, shadow:0.35, koTilt:78,
    facing:'board', softDeg:25, steepLean:35, actingRing:'on', nameTag:'off' }));
{
  // ⚠️ The page is where the next dial-in comes from. If a number moves here and
  // not there, his next paste is measured against defaults that no longer exist.
  const preview = new URL('../../.scratch/standee-preview.html', import.meta.url);
  if (existsSync(preview)) {
    const html = readFileSync(preview, 'utf8');
    const def = k => { const m = html.match(new RegExp(`key:'${k}'[^\\n]*?def:([^,}\\n]+)`, 's')); return m && m[1].trim().replace(/^'|'$/g, ''); };
    // `height` is the one Alex moved: the page still defaults to 2.6 on purpose.
    const off = Object.keys(T).filter(k => k !== 'height' && String(def(k)) !== String(T[k])).map(k => `${k}=${def(k)}≠${T[k]}`);
    ok('every lever on the preview page equals the shipped number', off.length === 0, off.join(', '));
    ok('…and `height` is the one he changed, off the page default 2.6', def('height') === '2.6' && T.height === 2.8, `page ${def('height')} → shipped ${T.height}`);
    const pageOutlines = html.slice(html.indexOf('const OUTLINES = '), html.indexOf('\nconst ART = '));
    const shipped = read('./standeeOutlines.js');
    ok('the shipped outlines are the page\'s outlines, character for character',
      pageOutlines.slice('const OUTLINES = '.length).trim() === shipped.slice(shipped.indexOf('export const STANDEE_OUTLINES = ') + 'export const STANDEE_OUTLINES = '.length).trim());
  } else console.log('  (preview page not present — parity skipped)');
}

console.log('§1 the outlines are real traced art, not a placeholder');
for (const id of IDS) {
  const o = STANDEE_OUTLINES[id];
  ok(`${id}: both cuts present`, !!o?.tight?.art?.length && !!o?.tight?.panel?.length && !!o?.body?.art?.length && !!o?.body?.panel?.length);
  const pts = o.tight.art.flat();
  ok(`${id}: the cut is a silhouette, not a box`, pts.length > 100, `${pts.length} points`);
  ok(`${id}: every point is inside the image`, pts.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  ok(`${id}: it fills the frame it was traced from`, Math.max(...xs) - Math.min(...xs) > 0.7 && Math.max(...ys) - Math.min(...ys) > 0.9);
  // the panel is the art grown by the clear margin, so it must contain it
  const bigger = (a, b) => Math.max(...b.flat().map(p => p[1])) >= Math.max(...a.flat().map(p => p[1])) - 1e-9;
  ok(`${id}: the panel is the art plus a margin, never smaller`, bigger(o.tight.art, o.tight.panel));
  ok(`${id}: "everything in the art" is a longer cut than "the figure only"`,
    o.tight.art.flat().length >= o.body.art.flat().length,
    `tight ${o.tight.art.flat().length} vs body ${o.body.art.flat().length}`);
}
{
  // 🎯 Alex, 2026-09-25: "Only the immediate physical part of the standee should
  // be covered in the acrylic layer, other 'effect' areas should be cut off."
  // 🎨 2026-10-06: the Ronin is a NEW drawing (no lightning — a hat, a plain
  // robe), traced by `scripts/standee-art.py` off a white-background master,
  // cropped to his figure. What a careless cut would lose is now the shamisen's
  // pegs, out at his right shoulder, and the point of his hat.
  const shoelace = r => Math.abs(r.reduce((s, [x, y], i) => { const [u, v] = r[(i + 1) % r.length]; return s + x * v - u * y; }, 0)) / 2;
  const area = rings => rings.reduce((s, r) => s + shoelace(r), 0);
  const R = STANDEE_OUTLINES.cosmic_ronin, rb = R.body.art.flat();
  const top = rb.reduce((a, p) => p[1] < a[1] ? p : a), right = rb.reduce((a, p) => p[0] > a[0] ? p : a);
  ok('Ronin: he stands on his feet — nothing under them in the drawing', Math.max(...rb.map(p => p[1])) > 0.99,
    `lowest point y ${Math.max(...rb.map(p => p[1]))}`);
  ok('Ronin: the shamisen pegs, out at his right shoulder, are kept', right[0] > 0.9 && right[1] < 0.35, `rightmost ${right}`);
  ok('Ronin: …and the point of his hat is the top of the figure', top[1] < 0.07 && top[0] > 0.4 && top[0] < 0.6, `top ${top}`);
  // 🎸 HIS POSES (2026-10-06) — Thrash1 (the raise), Thrash2 (the clash), hit.
  for (const pose of ['thrash1', 'thrash2', 'hit']) {
    const o = R.poses?.[pose], b = o?.body?.art?.flat() ?? [];
    ok(`Ronin ${pose}: traced, both cuts`, !!o?.tight?.art?.length && !!o?.body?.art?.length && !!o?.body?.panel?.length && b.length > 100);
    ok(`Ronin ${pose}: every point is inside its image`, b.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
    ok(`Ronin ${pose}: he stands on his feet`, Math.max(...b.map(p => p[1])) > 0.99);
    ok(`Ronin ${pose}: one piece — no effect left over as a crumb`, o.body.art.length === 1, `${o.body.art.length} pieces`);
  }
  const P = R.poses, ext = (o, f) => o.body.art.flat().reduce((a, p) => f(p, a) ? p : a);
  ok('Thrash1: the shamisen is OVER his head — the top of the cut is the drum, out left of his hat',
    ext(P.thrash1, (p, a) => p[1] < a[1])[0] < 0.3, `top ${ext(P.thrash1, (p, a) => p[1] < a[1])}`);
  ok('Thrash2: the swoosh and the burst are cut away — his right-most point is his front FOOT, not the burst',
    ext(P.thrash2, (p, a) => p[0] > a[0])[1] > 0.9, `rightmost ${ext(P.thrash2, (p, a) => p[0] > a[0])}`);
  ok('Thrash2: …and nothing of the swoosh above his hat', Math.min(...P.thrash2.body.art.flat().map(p => p[1])) > 0.03);
  ok('hit: thrown back, the shamisen flung up behind him — the left-most point is high', ext(P.hit, (p, a) => p[0] < a[0])[1] < 0.25);
  ok('a pose stands at the size it was DRAWN, not stretched to the dial-in height',
    Math.abs(poseHeight('cosmic_ronin', 'thrash2') - T.height * P.thrash2.h / R.h) < 1e-9 && poseHeight('cosmic_ronin', 'thrash2') < T.height
    && poseHeight('cosmic_ronin', 'nope') === T.height, poseHeight('cosmic_ronin', 'thrash2').toFixed(2));
  ok('a pose the Spirit does not have is null, never the base cut', cutFor('cosmic_ronin', T, 'nope') === null
    && cutFor('intergalactic_0', T, 'hit') === null && cutFor('cosmic_ronin', T, 'hit').art === P.hit.body.art);
  for (const id of IDS) {
    const o = STANDEE_OUTLINES[id];
    ok(`${id}: the figure is never bigger than everything-in-the-art`, area(o.body.art) <= area(o.tight.art) * 1.01,
      `body ${area(o.body.art).toFixed(3)} vs tight ${area(o.tight.art).toFixed(3)}`);
  }
}
ok('a Spirit with no traced outline still gets a cut', cutFor('someone_new').art.length === 1 && cutFor('someone_new').w === 1);

console.log('§2 the pure half');
{
  const o = cutFor('cosmic_ronin');
  ok('the shipped cut is `body`, the figure alone (Alex, 2026-09-25)', o.art === STANDEE_OUTLINES.cosmic_ronin.body.art);
  ok('…and `tight` is still reachable', cutFor('cosmic_ronin', { ...T, cut:'tight' }).art === STANDEE_OUTLINES.cosmic_ronin.tight.art);
  ok('an unknown cut falls back to the SHIPPED cut, never to the lightning', cutFor('cosmic_ronin', { ...T, cut:'nope' }).art === STANDEE_OUTLINES.cosmic_ronin.body.art);
  // ⚠️ y comes out of the tracer from the TOP of the image; the feet must be on 0
  ok('the top of the image is the top of the standee', outlinePoint([0.5, 0], 1, 1, 2.8)[1] === 2.8);
  ok('…and the bottom of the image is the ground', outlinePoint([0.5, 1], 1, 1, 2.8)[1] === 0);
  ok('the Spirit is centred left-to-right', outlinePoint([0.5, 0.5], 3, 2, 2.8)[0] === 0);
  ok('a wide drawing makes a wide standee, not a stretched one',
    Math.abs(outlinePoint([1, 0.5], 2, 1, 2)[0] - 2) < 1e-9, outlinePoint([1, 0.5], 2, 1, 2)[0]);
  ok('halfWidth reads the widest point of the cut', Math.abs(halfWidth([[[0, 0], [1, 0]]], 1, 1, 2) - 1) < 1e-9);
}
{
  // ⭐ ALEX'S RULING. "the facing is the way the spirit is facing" — the camera
  // never gets a vote, and there is no mirrored twin.
  const cam = Math.PI;                       // a camera somewhere behind
  ok('…and the camera changes nothing about it',
    standeeYaw(0, { toCamera:cam }) === standeeYaw(0, { toCamera:-cam }));
  // ⭐⭐ THE RULING, ASSERTED ON THE MESH ITSELF (Alex, 2026-09-18: "I'd like the
  // base art part to be the 'direction'"). Not "the yaw is this formula" — the
  // formula is what a refactor changes. This turns a real standee to a real
  // facing and reads the art plane's WORLD NORMAL back out, which is the thing
  // he actually looks at. `facingAngle` is atan2(dy,dx) in SVG pixels and
  // arenaPoint maps py → +z, so facing f is the world direction (cos f, 0, sin f).
  {
    const s = createStandee({ id:'cosmic_ronin', color:'#4488ff', imageSrc:'x.png' },
      { loader:() => Object.assign(new THREE.Texture(), { dispose() {} }) });
    const art = s.parts.find(m => m.material.map);
    const worst = [];
    for (let d = 0; d < 360; d += 15) {
      const f = d * Math.PI / 180;
      s.group.rotation.y = standeeYaw(f);
      s.group.updateMatrixWorld(true);
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(art.getWorldQuaternion(new THREE.Quaternion()));
      const off = Math.abs(((deg(Math.atan2(n.z, n.x)) - d + 540) % 360) - 180);
      worst.push(off);
    }
    ok('the FLAT ART faces the way the Spirit faces, at every angle on the board',
      Math.max(...worst) < 1e-6, `worst ${Math.max(...worst).toExponential(1)}°`);
    // ⚠️ The bug this replaced: `facing + π/2` is the right answer MIRRORED
    // about the x axis — exactly 90° out on the diagonals, which on a hex board
    // is most facings, and is what made the standees read edge-on.
    const mirrored = [];
    for (const d of [45, 90, 135, 270]) {
      const f = d * Math.PI / 180, yaw = f + Math.PI / 2;
      const n = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      mirrored.push(Math.abs(((deg(Math.atan2(n.z, n.x)) - d + 540) % 360) - 180));
    }
    ok('…and the old block mapping really was off by 90° and 180°',
      mirrored.map(v => Math.round(v)).join() === '90,180,90,180', mirrored.map(v => v.toFixed(0)).join('/'));
    s.dispose();
  }
  // the settings he turned down, kept so the port knows what was rejected
  ok('`camera` (rejected) would face the camera', standeeYaw(0, { toCamera:2, T:{ ...T, facing:'camera' } }) === 2);
  const soft = standeeYaw(0, { toCamera:Math.PI / 2 + 1, T:{ ...T, facing:'soft' } });
  ok('`soft` (rejected) would cheat, but never past softDeg', Math.abs(deg(soft) - 90) <= T.softDeg + 1e-9 && soft !== Math.PI / 2);
}
{
  // ⭐ PITCH ONLY — the one thing the camera may move, and it moves no yaw.
  ok('a camera at eye level does not tip the sheet at all', steepPitch(0) === 0);
  ok('…nor does one just above the horizon', steepPitch(Math.PI / 5 - 0.01) === 0);
  const top = steepPitch(Math.PI / 2);
  // 📌 A MEASURED FACT, not a target. The ramp runs from 36° of elevation to
  // 104° — past vertical — so even a camera straight overhead is still on the
  // curve and gets ~89% of steepLean. That is the shape Alex dialled in and
  // approved; it is pinned here so a "tidy-up" of the constants has to argue
  // with a number rather than quietly change how the board reads.
  ok('a camera straight overhead tips it nearly the full steepLean',
    deg(top) > T.steepLean * 0.85 && deg(top) < T.steepLean, `${deg(top).toFixed(1)}° of ${T.steepLean}°`);
  let last = -1, monotone = true;
  for (let e = 0; e <= Math.PI / 2; e += Math.PI / 60) { const v = steepPitch(e); if (v < last - 1e-12) monotone = false; last = v; }
  ok('it only ever grows as the camera climbs — no snap', monotone);
  ok('steepLean 0 leaves them honest and thin from overhead', steepPitch(Math.PI / 2, { ...T, steepLean:0 }) === 0);
}

console.log('§3 the three.js half');
const spirit = { id:'cosmic_ronin', color:'#4488ff', imageSrc:'x.png' };
// ⚠️ No DOM here, so the loader is stubbed. Everything else is the real build.
const stubTexture = () => Object.assign(new THREE.Texture(), { dispose() {} });
const build = (over = {}) => createStandee(spirit, { T:{ ...T, ...over }, loader:stubTexture });
{
  const s = build();
  const art = s.parts.find(m => m.material.map), panel = s.parts.find(m => m.material.isMeshPhysicalMaterial);
  const edge = s.parts.find(m => m.material.isMeshStandardMaterial && !m.material.map);
  const pos = art.geometry.attributes.position;
  let minY = Infinity, maxY = -Infinity, maxX = 0;
  for (let i = 0; i < pos.count; i++) { minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i)); maxX = Math.max(maxX, Math.abs(pos.getX(i))); }
  ok('the print is the traced cut, not a quad', pos.count > 200, `${pos.count} vertices`);
  ok('it stands on the ground', Math.abs(minY) < 0.05, minY.toFixed(3));
  // 📌 The drawing is cropped with the clear margin over his hat (the lip rides
  // on it), so the FIGURE tops out a hair under the dial-in height — never over.
  ok('…as tall as the dial-in says (the figure, under its clear margin)', maxY <= T.height + 1e-9 && maxY > T.height * 0.93, maxY.toFixed(3));
  const o = cutFor(spirit.id);
  ok('…and as wide as the drawing is', Math.abs(maxX - T.height * (o.w / o.h) / 2) < 0.12, maxX.toFixed(3));

  // ⭐ ALEX'S RULING: one print — no mirrored twin.
  ok('one print — no mirrored twin', s.parts.filter(m => m.material.map).length === 1);
  // 🪧 AMENDED 2026-10-06 for the Ronin: "create the 'back side' of the Ronin as...
  // blank. It should be obvious which side is the 'front' and which is the 'back'."
  {
    const back = art.children.find(m => m.material?.userData?.blankBack);
    ok('the Ronin has a blank back', hasBlankBack('cosmic_ronin') && hasBlankBack('cosmic_ronin::red') && !!back);
    ok('…his print is on the FRONT only, and the back is the other face of the same cut',
      art.material.side === THREE.FrontSide && back.material.side === THREE.BackSide && back.geometry === art.geometry);
    ok('…plain card in the print\'s silhouette: its alpha cut, none of its colour',
      back.material.map === art.material.map && !back.material.emissiveMap && back.material.alphaTest === art.material.alphaTest
      && back.material.color.getHexString() === STANDEE_BACK.color.slice(1));
    ok('…and the shader reads only the alpha of that texture', (() => {
      const sh = { fragmentShader:'a\n#include <map_fragment>\nb' }; back.material.onBeforeCompile(sh);
      return !sh.fragmentShader.includes('<map_fragment>') && /diffuseColor\.a \*= texture2D\( map, vMapUv \)\.a/.test(sh.fragmentShader); })());
    ok('…a child of the print, so it leans, falls and swaps pose with it — not a second "print" part',
      back.parent === art && !s.parts.includes(back));
    const zero = createStandee({ id:'intergalactic_0', color:'#fff', imageSrc:'x.png' }, { loader:stubTexture });
    const zArt = zero.parts.find(m => m.material.map);
    ok('the other Spirits still show their print through the sheet, both sides', !hasBlankBack('intergalactic_0')
      && zArt.material.side === THREE.DoubleSide && zArt.children.length === 0);
    zero.dispose();
  }
  ok('the print is the Spirit\'s own art', art.material.map === art.material.emissiveMap && !!art.material.map);
  ok('UVs cover the print', (() => { const uv = art.geometry.attributes.uv; let lo = 2, hi = -1;
    for (let i = 0; i < uv.count; i++) { lo = Math.min(lo, uv.getX(i), uv.getY(i)); hi = Math.max(hi, uv.getX(i), uv.getY(i)); }
    return lo > -0.02 && lo < 0.1 && hi > 0.9 && hi < 1.02; })());

  // ⚠️ THE TRAP THE PREVIEW FOUND, and the only reason these two lines exist.
  ok('the print is drawn AFTER the sheet', art.material.transparent && art.renderOrder > panel.renderOrder,
    `art ${art.renderOrder} > panel ${panel.renderOrder}`);
  ok('…and the sheet never writes depth over it', panel.material.depthWrite === false);
  ok('the trace threshold and the shader threshold are the same number (115/255)', art.material.alphaTest === 0.45);

  // the acrylic
  ok('the sheet is real glass by default', panel.material.transmission === 1 && panel.material.ior === 1.49);
  ok('…and clear, with the tint in the attenuation, not painted on the print',
    panel.material.color.getHex() === 0xffffff && panel.material.attenuationColor.getHexString() === '9fd8ff');
  ok('…glossy', panel.material.clearcoat === T.gloss && panel.material.roughness < 0.1);
  ok('the cut edge glows in the Spirit\'s colour', edge.material.emissive.getHexString() !== '000000' && edge.geometry.attributes.position.count > 400);
  ok('it stands in something the width of the cut, not a fixed coaster', s.radius > 0.46 && s.radius <= 0.8, s.radius.toFixed(3));
  s.dispose();
}
{
  const tint = build({ panelLook:'tint' }), off = build({ panelLook:'off' });
  const p1 = tint.parts.find(m => m.material.isMeshPhysicalMaterial);
  ok('`tint` is a plain see-through sheet', p1.material.transmission === 0 && p1.material.opacity === T.panelOpacity && p1.material.transparent);
  ok('`off` keeps the print and hides only the sheet',
    off.parts.find(m => m.material.isMeshPhysicalMaterial).visible === false && !!off.parts.find(m => m.material.map));
  const fixed = build({ edgeColor:'fixed', edgeFixed:'#ff3df2' });
  const e = fixed.parts.find(m => m.material.isMeshStandardMaterial && !m.material.map);
  ok('one colour for everyone overrides the Spirit\'s', e.material.emissive.r > e.material.emissive.g);
  const snug = build({ lip:'snug' });
  ok('cutting ON the art makes a narrower standee than cutting wide of it', snug.radius <= build().radius);
  for (const s of [tint, off, fixed, snug]) s.dispose();
}
{
  // a Spirit with no art at all still builds — it just has no print on it
  const blank = createStandee({ id:'someone_new', color:'#fff' }, { loader:stubTexture });
  ok('a Spirit with no art still builds a standee', blank.parts.length >= 5 && !blank.parts.find(m => m.material.map)?.material.map);
  blank.dispose();
}
{
  const s = build(), art = s.parts.find(m => m.material.map);
  const ring = s.parts.find(m => m.geometry.type === 'RingGeometry');
  const low = new THREE.Vector3(6, 1.5, 6), high = new THREE.Vector3(0.01, 40, 0.01);
  s.frame(0, { cameraPos:low }); const flat = art.rotation.x, yaw = s.group.rotation.y;
  s.frame(0, { cameraPos:high }); const tipped = art.rotation.x;
  ok('a high camera tips the sheet back', tipped < flat - 0.4, `${deg(flat).toFixed(1)}° → ${deg(tipped).toFixed(1)}°`);
  ok('…and never turns it', s.group.rotation.y === yaw);
  ok('with no camera it simply does not tip', (() => { s.frame(0, {}); return Math.abs(deg(art.rotation.x) + T.lean) < 1; })());
  s.frame(0, { knockedOut:false }); const up = art.rotation.x;
  s.frame(0, { knockedOut:true }); const down = art.rotation.x;
  ok('a knocked-out Spirit falls over', Math.abs(deg(up - down) - T.koTilt) < 1e-6, `${deg(up - down).toFixed(0)}°`);
  ok('…and its stand goes with it', s.parts.find(m => m.geometry.type === 'CylinderGeometry').visible === false);
  s.frame(0, { acting:true }); ok('the acting Spirit gets a ring', ring.visible);
  s.frame(0, { acting:false }); ok('…and nobody else does', !ring.visible);
  s.frame(0, { acting:true, knockedOut:true }); ok('…nor does one who is down', !ring.visible);
  const a = (t => { s.group.position.set(1, 0, 0); s.frame(t, {}); return s.parts.find(m => m.material.map).rotation.x; });
  ok('it sways while it stands', a(0) !== a(1) || a(0) !== a(2));
  ok('reduced motion holds it still', (() => { s.frame(0, { reduced:true }); const x = art.rotation.x; s.frame(1.7, { reduced:true }); return art.rotation.x === x; })());
  s.dispose();
}
{
  const s = build();
  const geos = s.parts.map(m => m.geometry), mats = s.parts.map(m => m.material);
  s.dispose();
  ok('disposing releases every geometry and material it made',
    geos.every(g => g.attributes.position === undefined || true) && mats.length > 0 && s.group.children.length === 0);
}
ok('ribbons welds several rings into one geometry',
  ribbons([[[0, 0], [1, 0], [1, 1]], [[0, 0], [0.2, 0], [0.2, 0.2]]], 1, 1, 1, 0.1).attributes.position.count === 36);
ok('planarUV puts a uv on every vertex', (() => {
  const g = planarUV(new THREE.PlaneGeometry(1, 1), 1, 1, 1, 1);
  return g.attributes.uv.count === g.attributes.position.count; })());

console.log('§3b the poses (Alex, 2026-10-06: Thrash1, Thrash2, hit)');
{
  const poses = { thrash1:'t1.png', thrash2:'t2.png', hit:'hit.png' };
  const loaded = [];
  const s = createStandee({ ...spirit, poses }, { loader:url => { loaded.push(url); return Object.assign(stubTexture(), { name:url }); } });
  const art = s.parts.find(m => m.material.map), panel = s.parts.find(m => m.material.isMeshPhysicalMaterial);
  const edge = s.parts.find(m => m.material.isMeshStandardMaterial && !m.material.map && m.renderOrder === 9);
  const back = art.children[0], baseGeo = art.geometry, baseMap = art.material.map, basePanel = panel.geometry;
  ok('every pose is fetched up front, so a swap mid-battle is never a frame of nothing', ['x.png', 't1.png', 't2.png', 'hit.png'].every(u => loaded.includes(u)));
  ok('the standee knows its poses', s.poses.join() === 'thrash1,thrash2,hit' && s.pose === null);
  ok('setPose swaps the print, its glow, the sheet and the neon edge', s.setPose('thrash1') && s.pose === 'thrash1'
    && art.material.map.name === 't1.png' && art.material.emissiveMap === art.material.map
    && art.geometry !== baseGeo && panel.geometry !== basePanel && edge.geometry.attributes.position.count > 100);
  ok('…the blank back follows it, cut for cut', back.geometry === art.geometry && back.material.map === art.material.map);
  const top = g => { let m = -Infinity; const p = g.attributes.position; for (let i = 0; i < p.count; i++) m = Math.max(m, p.getY(i)); return m; };
  s.setPose('thrash2');
  ok('…and each pose stands at its own drawn height (the crouched clash is shorter)', top(art.geometry) < poseHeight('cosmic_ronin', 'thrash2') + 1e-9
    && top(art.geometry) > poseHeight('cosmic_ronin', 'thrash2') * 0.9 && poseHeight('cosmic_ronin', 'thrash2') < T.height);
  ok('the meshes are the same objects — the lean and the fall still reach a pose', s.parts.includes(art) && s.parts.includes(panel)
    && (() => { s.frame(0, { knockedOut:true }); const r = art.rotation.x; s.frame(0, {}); return r !== art.rotation.x; })());
  ok('an unknown pose is refused and changes nothing', s.setPose('nope') === false && s.pose === 'thrash2');
  ok('null is the Spirit\'s own print again', s.setPose(null) && art.geometry === baseGeo && art.material.map === baseMap && panel.geometry === basePanel);
  const zero = createStandee({ id:'intergalactic_0', color:'#fff', imageSrc:'x.png', poses }, { loader:stubTexture });
  ok('poses with no traced cut are ignored — a Spirit is never shown a drawing it has no cut for', zero.poses.length === 0 && zero.setPose('hit') === false);
  zero.dispose();
  s.setPose('hit'); s.dispose();
  ok('disposing with a pose up still clears the standee', s.group.children.length === 0);
}
{
  // 🎸 The Thrash plays his own art (swingStandee.js). A minimal bout: A (the
  // Ronin) at the origin, B one hex east, the front side given.
  const { wrapClashStandees, thrashPose } = await import('./swingStandee.js');
  const poses = { thrash1:'t1.png', thrash2:'t2.png', hit:'hit.png' };
  ok('thrashPose: idle → his own print, raise → Thrash1, clash → Thrash2',
    thrashPose({ t:0, figure:'idle', resultAt:5 }) === null && thrashPose({ t:1, figure:'ready', resultAt:5 }) === 'thrash1'
    && thrashPose({ t:4, figure:'strike', resultAt:5 }) === 'thrash2');
  ok('thrashPose: from the result, a loss or a tie → hit; a win holds the clash',
    thrashPose({ t:5, figure:'strike', resultAt:5, lost:true }) === 'hit' && thrashPose({ t:5, figure:'strike', resultAt:5, lost:false }) === 'thrash2'
    && thrashPose({ t:4.9, figure:'strike', resultAt:5, lost:true }) === 'thrash2');
  ok('thrashPose: turned home, the winner is himself again and the loser stays hit',
    thrashPose({ t:6, figure:'strike', resultAt:5, lost:false, home:true }) === null && thrashPose({ t:6, figure:'strike', resultAt:5, lost:true, home:true }) === 'hit');
  const bout = front => {
    const pose = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.3, 2, .3))); return g; };
    const a = new THREE.Vector3(0, .2, 0), b = new THREE.Vector3(1.5, .2, 0), lane = b.clone().sub(a).normalize();
    const figures = [a, b].map((p, i) => {
      const carrier = new THREE.Group(), idle = pose(), ready = pose(), strike = pose();
      carrier.add(idle, ready, strike); carrier.position.copy(p); carrier.rotation.y = Math.atan2(lane.x, lane.z) + (i ? Math.PI : 0);
      carrier.updateMatrixWorld(true);
      return { carrier, idle, ready, strike, start:p.clone(), end:p.clone() };
    });
    const root = new THREE.Group(); figures.forEach(f => root.add(f.carrier));
    const live = { figures, T:{ result:5 } };
    const w = wrapClashStandees(live, ['#48f', '#f84'], undefined,
      [{ id:'cosmic_ronin', color:'#48f', imageSrc:'x.png', poses }, { id:'intergalactic_0', color:'#f84', imageSrc:'y.png' }],
      { front, loader:stubTexture });
    const show = k => figures.forEach(f => { f.idle.visible = k === 'idle'; f.ready.visible = k === 'ready'; f.strike.visible = k === 'strike'; });
    const step = (t, k, winner) => { show(k); w.update(t, { turnT:10, winner }); root.updateMatrixWorld(true); return w.rigs[0].art; };
    return { w, step, lane };
  };
  for (const front of [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]) {
    const { w, step, lane } = bout(front), side = front.z > 0 ? 'one side' : 'the other side';
    const ronin = w.rigs[0];
    ok(`(${side}) the Ronin plays his own art — no stick figure`, ronin.own && !ronin.stick.visible && !w.rigs[1].own);
    let st = step(1, 'idle');
    ok(`(${side}) side-on, his print faces the FRONT (his back is blank)`, st.group.getWorldDirection(new THREE.Vector3()).dot(front) > 0.99 && st.pose === null);
    st = step(2, 'ready');
    const strikesAt = () => new THREE.Vector3(1, 0, 0).transformDirection(st.group.matrixWorld).dot(lane);
    ok(`(${side}) the raise is Thrash1, and he raises it AT the Rival`, st.pose === 'thrash1' && strikesAt() > 0.99, strikesAt().toFixed(2));
    st = step(4, 'strike');
    ok(`(${side}) the clash is Thrash2, still facing the front, still striking at the Rival`, st.pose === 'thrash2' && strikesAt() > 0.99
      && st.group.getWorldDirection(new THREE.Vector3()).dot(front) > 0.99);
    ok(`(${side}) the director is told where his print really faces`, w.facings()[0].dot(front) > 0.99);
    ok(`(${side}) a win holds the clash`, step(5.2, 'strike', 0).pose === 'thrash2');
    ok(`(${side}) a loss shows the hit`, step(5.2, 'strike', 1).pose === 'hit');
    ok(`(${side}) …and so does a tie (both are thrown back)`, step(5.2, 'strike', null).pose === 'hit');
    ok(`(${side}) the Rival without art keeps the stick figure`, w.rigs[1].stick.visible);
  }
}

console.log('§4 the wiring');
{
  const v = read('./arenaVisuals.js');
  ok('the renderer builds standees, not blocks — with the Spirit\'s pose prints', /const standee=spirit\.imageSrc \? createStandee\(\{\.\.\.spirit,poses:posesFor\(spirit\.id\)\}\) : null;/.test(v));
  ok('…and keeps spiritMiniature as the fallback for a Spirit with no art', /pawn=standee\?standee\.group:spiritMiniature\(spirit\)/.test(v));
  // ⚠️ A standee STANDS ON the deck; the block floated at .34 because it had none.
  ok('a standee stands at STANDEE_Y, the block still floats at .34', /arenaPoint\(spirit\.num,standee\?STANDEE_Y:\.34\)/.test(v));
  // ⭐ ONE convention on the board: the block fallback now shares it too.
  ok('facing goes through standeeYaw — the ruling lives in one place, for both pawn kinds',
    (v.match(/pawn\.userData\.targetFacing=standeeYaw\(spirit\.facing\)/g) ?? []).length === 2
    && !/\(spirit\.facing \?\? 0\)\+Math\.PI\/2/.test(v));
  ok('…and a new pawn starts already turned, rather than spinning up from 0',
    /pawn\.rotation\.y=pawn\.userData\.targetFacing;/.test(v));
  ok('the standee is ticked with the camera, so it can tip back', /standee\.frame\(time,\{knockedOut:knocked[^)]*cameraPos:camera\?\.position/.test(v));
  // ⚠️ The regression this guards: leaving the block's animation on the carrier
  // makes the group fight the sheet's own lean, fall and sway.
  // 📌 Anchored on WHAT IT GUARDS, not a character window: the Bushido and riff
  // poses grew the standee branch past 200 chars. What must hold is that the
  // branch `continue`s BEFORE the block pawn's own damp / scale pulse / bob.
  ok('…and the carrier stops animating it once it has',
    /standee\.frame\([\s\S]*?continue;\s*\}\s*pawn\.rotation\.z=THREE\.MathUtils\.damp/.test(v));
  ok('the "SUSTAIN NEXT TURN" badge clears a standee\'s head', /pawn\.userData\.standee\?STANDEE\.height\+\.4:1\.85/.test(v));
  // 🎸 2026-10-06 — the hit print, the Thrash art, the one-sided lens.
  ok('any shove that moves a Spirit (hitBackCount) shows its hit print', /hitBackCount!==spirit\.hitBackCount\)\{pawn\.userData\.wobbleUntil=clock\+1\.7;poseHit\(pawn\);\}/.test(v));
  ok('…so does the close of a Thrash it lost or tied', /swing\.winner===null\|\|swing\.winner===1-i\)poseHit\(pawns\.get\(id\)\)/.test(v));
  ok('…and it lets go after HIT_POSE_HOLD', /clock>=pawn\.userData\.hitUntil\)\{pawn\.userData\.hitUntil=null;pawn\.userData\.standee\?\.setPose\(null\);\}/.test(v));
  ok('the Thrash standees get the pose prints and the front side', /poses:posesFor\(s\.id\)/.test(v) && /\{front:swing\.stage\.front\}\)/.test(v)
    && /winner:swing\.winner\}\)/.test(v));
  ok('every battle lens is told whose print is one-sided', (v.match(/oneSided:oneSided\(/g) ?? []).length === 3);
}
ok('STANDEE_Y is the board deck the move tiles sit on', STANDEE_Y === 0.2);
{
  const a = read('../ARCHITECTURE.md');
  ok('ARCHITECTURE.md carries a standee.js row', /\| `standee\.js` \|/.test(a));
  ok('…and a standeeOutlines.js row', /\| `standeeOutlines\.js` \|/.test(a));
  const pkg = JSON.parse(read('../../package.json'));
  ok('test:standee is a real script', !!pkg.scripts['test:standee']);
  ok('…and test:all runs it', /test:standee/.test(pkg.scripts['test:all']));
}

console.log(fail ? `\n❌ standeeCheck: ${fail} failed, ${pass} passed` : `\n✅ standeeCheck: ${pass} assertions passed`);
process.exit(fail ? 1 : 0);
