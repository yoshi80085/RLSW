// 🌌 THE NEBULA BACK — a standee's unprinted side as its own little galaxy.
//
// Alex, 2026-10-13: "Lets make the back of the standees shimmer/sparkle - like
// it is its own 'nebula' instead of being plain". The back he means is the
// Ronin's BLANK BACK (`standee.js` `STANDEE_BACK`, 2026-10-06): the same cut as
// the print, unprinted, so it is obvious which side is the front. This keeps
// that job — no print, no character — and fills the card with drifting gas,
// three depths of stars, sparkle flares, a holo-foil sweep and a lit cut edge.
//
// ✅ IN THE GAME 2026-10-14, at Alex's dial-in off `.scratch/standee-nebula-preview.html`
// (16 of 23 levers moved, from the "In the Spirit's colour" preset): EVERY Spirit
// gets a nebula back, in its own player colour, dim (glow .2) with dense small
// clouds (gas 1.75, size .45), fewer stars, smaller flares and a brighter edge.
// `standee.js` builds the back with `createNebulaBackMaterial` and ticks it in
// `frame()`; `who:'all'` is what makes `hasBlankBack` true for every Spirit.
// ⭐ The page imports `STANDEE_NEBULA` as its defaults, so a re-dial starts here.
//
// 📌 TWO HALVES like `standee.js`: the dial-in and palettes on top are pure; the
// material below is three.js. It is a MeshStandardMaterial with the nebula added
// to its EMISSION (not a ShaderMaterial), so the arena's lights, fog and ACES
// tone mapping still apply and it sits in the same lighting as the print.
import * as THREE from 'three';

/**
 * Alex's dial-in, 2026-10-14 (✎ = a lever he moved). Every number is a lever on
 * the preview page, which reads this object as its defaults — one copy.
 */
export const STANDEE_NEBULA = Object.freeze({
  who:'all',             // 'blank' = only the Spirits in STANDEE_BACK.blank (the Ronin) · 'all' = every standee ✎
  palette:'spirit',      // a key of NEBULA_PALETTES ✎ — the player's own colour
  glow:0.2,              // the whole back's brightness ✎ (was 1)
  gloss:0.35,            // how much arena light the card itself catches (0 = matte)
  gas:1.75, gasScale:0.45, wisps:0.25, drift:0.5, depth:0.5,       // ✎ gas, gasScale, wisps, drift
  stars:0.24, starSize:1, starGlow:1.4, twinkle:0.33, twinkleSpeed:3.9,   // ✎ stars, twinkle, twinkleSpeed
  sparkle:0.65, sparkleSize:0.6, sparkleGlow:2.5,                  // ✎ all three
  sweep:0.45, sweepPeriod:6, sweepWidth:0.52, holo:0.25,           // ✎ sweep, sweepWidth
  rim:1.1, rimWidth:0.06,                                           // ✎ rim
});

/**
 * The gas colours. `void` is the empty space between clouds, `a`/`b` the two
 * gases, `star` the tint some stars take. 'spirit' swaps `b` for the standee's
 * own (player) colour, so a Spirit's back reads as theirs from across the board.
 */
export const NEBULA_PALETTES = Object.freeze({
  riven: { label:'Riven World (the arena sky)', void:'#06020e', a:'#4a1290', b:'#c02a86', star:'#cfe0ff' },
  spirit:{ label:'The Spirit\'s colour',          void:'#040612', a:'#24145e', b:null,      star:'#ffffff' },
  aurora:{ label:'Aurora',                       void:'#020a10', a:'#0f6a78', b:'#7a32c0', star:'#c8fff0' },
  ember: { label:'Ember',                        void:'#0d0306', a:'#7a1238', b:'#ff7a2a', star:'#ffe2b8' },
  ice:   { label:'Ice',                          void:'#020816', a:'#16488a', b:'#7fe0ff', star:'#ffffff' },
});

/** Which palette colours a back actually uses (pure). */
export function paletteFor(look = STANDEE_NEBULA, spiritColor = '#88ccff') {
  const p = NEBULA_PALETTES[look.palette] ?? NEBULA_PALETTES.riven;
  return { void:p.void, a:p.a, b:p.b ?? spiritColor, star:p.star };
}

// ── three.js ─────────────────────────────────────────────────────────────────

// ⚠️ The same threshold as `standee.js`'s ALPHA_TEST (.45 = the trace's 115/255).
// The rim reads the print's alpha around each pixel; a different threshold puts
// the glow a few pixels inside or outside the real cut edge.
const CUT = 0.45;

const GLSL = /* glsl */`
uniform float nTime, nGas, nGasScale, nWisp, nDrift, nDepth, nStars, nStarSize, nStarGlow,
  nTwinkle, nTwinkleSpeed, nSparkle, nSparkleSize, nSparkleGlow, nSweep, nSweepPeriod,
  nSweepWidth, nHolo, nRim, nRimWidth, nGlow, nSeed, nTop;
uniform vec3 nVoid, nGasA, nGasB, nStarTint;
uniform vec2 nUvPerM;
varying vec3 vNebPos;
varying vec3 vNebCam;
float nHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float nNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(nHash(i), nHash(i + vec2(1, 0)), f.x), mix(nHash(i + vec2(0, 1)), nHash(i + vec2(1, 1)), f.x), f.y); }
float nFbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * nNoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= .5; } return s; }
// One star per cell (or none): a soft point that twinkles on its own clock.
vec3 nStarLayer(vec2 p, float cell, float seed){
  vec2 g = p / cell, id = floor(g), f = fract(g) - .5;
  float h = nHash(id + seed);
  if (h > nStars * .75) return vec3(0.);
  vec2 o = (vec2(nHash(id + seed + 1.7), nHash(id + seed + 3.1)) - .5) * .7;
  float d = length(f - o) * cell;
  float r = nStarSize * (.35 + .9 * nHash(id + seed + 7.3)) * .011;
  float tw = 1. - nTwinkle * .5 * (1. + sin(nTime * nTwinkleSpeed * (.5 + 1.5 * nHash(id + seed + 9.1)) + h * 91.));
  return mix(vec3(1.), nStarTint, nHash(id + seed + 11.)) * exp(-d * d / (r * r)) * tw;
}
// A sparkle: each cell flares a four-point star now and then (nSparkle ≈ flares
// per second per square metre of card), with a fainter diagonal cross.
float nFlare(vec2 p, float cell, float seed){
  vec2 g = p / cell, id = floor(g), f = fract(g) - .5;
  float h = nHash(id + seed);
  float period = max(.5, 1. / max(nSparkle * cell * cell, 1e-3)) * (.6 + .8 * nHash(id + seed + 2.2));
  float lt = mod(nTime + h * period * 7., period), dur = .7;
  if (lt > dur) return 0.;
  float env = pow(sin(3.14159 * lt / dur), 2.);
  vec2 o = (vec2(nHash(id + seed + 4.4), nHash(id + seed + 5.5)) - .5) * .6;
  vec2 d = (f - o) * cell / (nSparkleSize * .12);
  float ax = exp(-abs(d.x) * 1.3) * exp(-abs(d.y) * 28.) + exp(-abs(d.y) * 1.3) * exp(-abs(d.x) * 28.);
  vec2 dr = vec2(d.x + d.y, d.x - d.y) * .7071;
  float dg = exp(-abs(dr.x) * 3.) * exp(-abs(dr.y) * 40.) + exp(-abs(dr.y) * 3.) * exp(-abs(dr.x) * 40.);
  return env * (ax + .45 * dg + 2. * exp(-dot(d, d) * 30.));
}
vec3 nebulaColor(){
  // 🔭 Parallax: each layer is looked up a little further along the view ray, so
  // the card reads as a WINDOW into deep space rather than a printed picture.
  vec3 ray = normalize(vNebPos - vNebCam);
  vec2 slope = ray.xy / max(abs(ray.z), .35);
  vec2 P = vNebPos.xy;
  float t = nTime * nDrift;
  vec2 q = (P + slope * .5 * nDepth) / nGasScale * .9 + nSeed;
  vec2 w = vec2(nFbm(q * 1.2 + vec2(t * .06, -t * .035)), nFbm(q * 1.2 + vec2(5.2, 1.3) + vec2(-t * .045, t * .03)));
  float n = nFbm(q * 1.5 + w * 1.9 + vec2(0., t * .025));
  float cloud = smoothstep(.38, .86, n);
  float ridge = pow(1. - abs(nFbm(q * 2.6 + w * 2.4 - vec2(t * .03)) * 2. - 1.), 4.) * smoothstep(.3, .62, n);
  vec3 gas = mix(nGasA, nGasB, smoothstep(.32, .72, w.x));
  vec3 c = nVoid + gas * (cloud * 1.4 + ridge * nWisp * 1.6) * nGas;
  vec2 q2 = (P + slope * 1.8 * nDepth) / nGasScale * .6 + nSeed + 31.;
  c += mix(nGasA, nGasB, .35) * pow(smoothstep(.42, .9, nFbm(q2 + vec2(t * .012, 0.))), 2.) * .7 * nGas;
  // ✨ The sweep: a diagonal band of light crossing the card, like tilting foil.
  float s = dot(P, normalize(vec2(.55, 1.)));
  float at = mix(-.8, nTop + .8, fract(nTime / max(.5, nSweepPeriod)));
  float band = exp(-pow((s - at) / max(.02, nSweepWidth), 2.)) * nSweep;
  vec3 st = nStarLayer(P + slope * .25 * nDepth, .17, nSeed + 1.) * 1.2
          + nStarLayer(P + slope * 1. * nDepth, .11, nSeed + 2.) * .8
          + nStarLayer(P + slope * 2.4 * nDepth, .07, nSeed + 3.) * .55;
  c += st * nStarGlow * (1. + band * 2.5);
  float fl = nFlare(P + slope * .25 * nDepth, .42, nSeed + 4.) + nFlare(P + slope * nDepth, .3, nSeed + 5.) * .6;
  c += mix(vec3(1.), nStarTint, .35) * fl * nSparkleGlow;
  // 🌈 Holo foil: a hue that shifts with the viewing angle, so it shimmers as the
  // standee turns or the camera moves, even when nothing on the card animates.
  float hue = fract(dot(ray, vec3(.6, .35, .9)) * 1.6 + (P.x + P.y) * .22 + nTime * .015);
  vec3 holo = .5 + .5 * cos(6.2831 * (hue + vec3(0., .33, .67)));
  c += holo * (nHolo * .22 * (.25 + cloud + ridge) + band * .35) + vec3(.9, .95, 1.) * band * .08;
  #ifdef USE_MAP
  // 💡 The cut edge glows: how much of a small ring around this pixel is OFF the
  // print's silhouette. Reads the print's ALPHA only, like the blank back.
  vec2 rr = nRimWidth * nUvPerM; float a = 0.;
  for (int i = 0; i < 8; i++) { float an = float(i) * .785398;
    a += step(${CUT.toFixed(2)}, texture2D(map, vMapUv + rr * vec2(cos(an), sin(an))).a);
    a += step(${CUT.toFixed(2)}, texture2D(map, vMapUv + .5 * rr * vec2(cos(an + .39), sin(an + .39))).a); }
  float rim = 1. - a / 16.;
  c += mix(nGasB, vec3(1.), .35) * rim * nRim * (1.2 + band * 2.);
  #endif
  return c * nGlow;
}
`;

/**
 * UV units per metre along x and y of a planar-UV'd sheet: the rim is dialled
 * in metres, but it samples the print in UV. Read off the geometry itself (two
 * far-apart vertices per axis), so a pose with a different aspect still gets a
 * rim of the same width.
 */
export function uvPerMeter(geometry) {
  const pos = geometry.attributes.position, uv = geometry.attributes.uv;
  if (!pos || !uv || pos.count < 2) return new THREE.Vector2(0.3, 0.3);
  let ix0 = 0, ix1 = 0, iy0 = 0, iy1 = 0;
  for (let i = 1; i < pos.count; i++) {
    if (pos.getX(i) < pos.getX(ix0)) ix0 = i; if (pos.getX(i) > pos.getX(ix1)) ix1 = i;
    if (pos.getY(i) < pos.getY(iy0)) iy0 = i; if (pos.getY(i) > pos.getY(iy1)) iy1 = i;
  }
  const sx = Math.abs((uv.getX(ix1) - uv.getX(ix0)) / ((pos.getX(ix1) - pos.getX(ix0)) || 1));
  const sy = Math.abs((uv.getY(iy1) - uv.getY(iy0)) / ((pos.getY(iy1) - pos.getY(iy0)) || 1));
  return new THREE.Vector2(sx || 0.3, sy || 0.3);
}

/**
 * The nebula back's material. Bind the PRINT's texture: only its alpha is read
 * (the card has the print's exact silhouette and holes, none of its colour).
 * ⚠️ Not `alphaMap` — three reads an alphaMap's GREEN channel (see standee.js).
 */
export function createNebulaBackMaterial(texture, { look = STANDEE_NEBULA, color = '#88ccff', seed = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({
    color:0x000000, emissive:0x000000, map:texture, transparent:true, alphaTest:CUT,
    roughness:1, metalness:0, side:THREE.BackSide, depthWrite:true,
  });
  const u = {
    nTime:{ value:0 }, nSeed:{ value:seed * 13.7 }, nTop:{ value:2.8 }, nUvPerM:{ value:new THREE.Vector2(0.3, 0.3) },
    nVoid:{ value:new THREE.Color() }, nGasA:{ value:new THREE.Color() }, nGasB:{ value:new THREE.Color() }, nStarTint:{ value:new THREE.Color() },
    nGas:{ value:1 }, nGasScale:{ value:1 }, nWisp:{ value:1 }, nDrift:{ value:1 }, nDepth:{ value:1 },
    nStars:{ value:1 }, nStarSize:{ value:1 }, nStarGlow:{ value:1 }, nTwinkle:{ value:1 }, nTwinkleSpeed:{ value:1 },
    nSparkle:{ value:1 }, nSparkleSize:{ value:1 }, nSparkleGlow:{ value:1 },
    nSweep:{ value:1 }, nSweepPeriod:{ value:1 }, nSweepWidth:{ value:1 }, nHolo:{ value:1 },
    nRim:{ value:1 }, nRimWidth:{ value:1 }, nGlow:{ value:1 },
  };
  m.userData.nebula = { uniforms:u, geometry:null, time:0 };
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, u);
    s.vertexShader = 'varying vec3 vNebPos;\nvarying vec3 vNebCam;\n' + s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n\tvNebPos = position;\n\tvNebCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('void main() {', `${GLSL}\nvoid main() {`)
      .replace('#include <map_fragment>', '#ifdef USE_MAP\n\tdiffuseColor.a *= texture2D( map, vMapUv ).a;\n#endif')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += nebulaColor();');
  };
  m.customProgramCacheKey = () => 'standee-nebula-back';
  m.userData.blankBack = true;      // still the unprinted side, for anyone who asks
  setNebulaLook(m, look, color);
  return m;
}

/** Push a look (any subset of STANDEE_NEBULA's keys) onto a nebula material. */
export function setNebulaLook(m, look = STANDEE_NEBULA, color = '#88ccff') {
  const L = { ...STANDEE_NEBULA, ...look }, u = m.userData.nebula.uniforms, p = paletteFor(L, color);
  u.nVoid.value.set(p.void); u.nGasA.value.set(p.a); u.nGasB.value.set(p.b); u.nStarTint.value.set(p.star);
  const map = { nGas:'gas', nGasScale:'gasScale', nWisp:'wisps', nDrift:'drift', nDepth:'depth', nStars:'stars',
    nStarSize:'starSize', nStarGlow:'starGlow', nTwinkle:'twinkle', nTwinkleSpeed:'twinkleSpeed', nSparkle:'sparkle',
    nSparkleSize:'sparkleSize', nSparkleGlow:'sparkleGlow', nSweep:'sweep', nSweepPeriod:'sweepPeriod',
    nSweepWidth:'sweepWidth', nHolo:'holo', nRim:'rim', nRimWidth:'rimWidth', nGlow:'glow' };
  for (const [k, key] of Object.entries(map)) u[k].value = L[key];
  // The card catches a little arena light in its own void colour, more with gloss.
  m.color.set(p.void).multiplyScalar(1 + L.gloss * 2);
  m.roughness = 1 - L.gloss * 0.75;
}

/**
 * Per frame. `reduced` freezes the nebula where it stands — no drift, twinkle,
 * flares or sweep — but keeps the picture (and the holo, which only moves when
 * the VIEW does). Re-reads the sheet's UV scale when a pose swap changed it.
 */
export function tickNebulaBack(mesh, time, { reduced = false } = {}) {
  const n = mesh.material.userData.nebula;
  if (!n) return;
  if (!reduced) n.time = time;
  n.uniforms.nTime.value = n.time;
  if (n.geometry !== mesh.geometry) {
    n.geometry = mesh.geometry;
    n.uniforms.nUvPerM.value.copy(uvPerMeter(mesh.geometry));
    mesh.geometry.computeBoundingBox();
    n.uniforms.nTop.value = mesh.geometry.boundingBox.max.y;
  }
}
