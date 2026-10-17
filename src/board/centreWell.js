// ─── 🌀 THE WELLSPRING — the centre hex, drawn ───────────────────────────────
// Alex, 2026-10-16: *"the spot lights 'light up' several spots on the board
// relevant to the player's locations - I'd like the middle instead to pulse
// 'from within' - and for the 'energy' to slightly rise above and 'swirl' around
// - turning to dust/glitter - like as if it is releasing ancient sonic energy.
// Spirits will use this spot to 'tap into' their special powers"*.
//
// So the middle is the one place on the board that is NOT lit from above:
//   · THE STONE — a hex of light under the floor: a hot core, veins of energy
//     that light outward on every beat, an engraved ring of old sound-marks, and
//     a ripple that leaves on the beat. The beat is a slow heartbeat by default.
//   · THE RISE — streams of energy leave the stone on a few strands, swirl up
//     round the centre, widen, and break into dust and glitter that twinkles out.
//     The beat climbs the column too (`travel`), so the pulse is seen going UP.
//   · THE HAZE — a few big soft puffs in the swirl, so it reads as a body of
//     energy and not only as points.
//   · THE TAP — a Spirit steps on: the stone flares, the streams bend into the
//     Spirit and spiral up it, a flash, a ring along the floor. While its gift
//     lasts, a faint orbit of the well's glitter rides with it (the AURA).
//
// The RULE is `engine/systems/wellspring.js`. This file only draws.
// ✅ DIALLED IN 2026-10-16 (`CENTRE_WELL`, 18 of 52) — ✅ IN THE ARENA 2026-10-17:
// `arenaRenderer.js` mounts it (the stone in the arena scene, the RISE and the
// aura on the foreground, over the tactical SVG), fed by `arenaFrame`'s `well`
// slice. The SVG's pink "CENTRE STAGE ENERGY" glow and the centre's pink fill
// came out. `npm run dev:centrewell` still re-dials it on the preview.
//
// ⚡ Cheap on purpose: every particle is placed by its vertex shader from one
// `time` uniform, so a frame costs a handful of uniform writes, not a loop.

import * as THREE from 'three';

const TAU = Math.PI * 2;

/**
 * The levers. ✎ = ALEX'S DIAL-IN, 2026-10-16 22:56 (*"Looks great!"*), 18 of 52
 * moved from the Balanced preset, viewed on Standard (no bloom) at the arena
 * camera with the spotlights on. Everything without ✎ he saw and left alone.
 * His look in one line: a calm, slow BREATH (not a heartbeat), a loose low swirl
 * that barely rises (1.05, under half a standee) and turns to glitter early, in
 * the Riven World's blue/violet, and a strong light on the stage around it.
 * 📌 Re-dial on `.scratch/centre-well-preview.html` — the page reads these.
 */
export const CENTRE_WELL = Object.freeze({
  // the stone
  // ⚠️ floorY .06: just over the arena's ceramic (.004) and its centre crack (.05),
  // under the tactical SVG (.10). The Lost Chords' .2 is a FLOAT height, not the floor.
  floorY: 0.06, floorSize: 1.07 /* ✎ 1.0 */, lid: 'cover', coreGlow: 1.4, coreSize: 0.36, fill: 0.5, veins: 1.4, veinScale: 3.4, veinSharp: 6,
  glyphs: 0.55, glyphSpin: 0.015, edgeGlow: 0.45, ripple: 0.6, rippleSpeed: 0.85,
  // the beat
  pulseShape: 'breath' /* ✎ heartbeat */, pulseS: 7.2 /* ✎ 2.8 */, pulseDepth: 0.48 /* ✎ 0.7 */, travel: 0.55,
  // the rise
  streams: 1400, strands: 3, tightness: 0.31 /* ✎ 0.72 */, trail: 0.1 /* ✎ 1 */, height: 1.05 /* ✎ 2.4 */,
  riseS: 6.3 /* ✎ 3.4 */, baseRadius: 0.47 /* ✎ 0.3 */, topRadius: 1.19 /* ✎ 0.95 */,
  flare: 2.1 /* ✎ 1.5 */, turns: 1.4, spin: 0.05, streamSize: 5.1 /* ✎ 4 */, streamGlow: 0.85,
  // dust & glitter
  dustAt: 0.3 /* ✎ 0.55 */, dustSize: 2.4, dustGlow: 1.1, twinkle: 0.71 /* ✎ 0.85 */, dustDrift: 0.55,
  glitterShare: 0.86 /* ✎ 0.7 */, iridescence: 0.25,
  // haze
  haze: 0.16, hazeCount: 30, hazeSize: 55,
  // colour & light
  // ⚠️ light 8 is a REAL PointLight at 8 (was 3) reaching 5.2: it lights the
  // standees and hexes round the centre. Watch for it washing a Spirit standing
  // next to the well once it is in the arena with the spotlights' own lights.
  palette: 'riven' /* ✎ ancient */, light: 8 /* ✎ 3 */, lightRange: 5.2 /* ✎ 3.5 */,
  // the tap
  tapMs: 1700, tapPull: 0.85, tapFlash: 1, aura: 0.7, auraColor: 'well',
});

/** 📌 Alex's 18 moves, by key — `centreWellCheck` §0 pins them, so a later edit
 *  to a default he chose fails loudly instead of quietly un-dialling him. */
export const CENTRE_WELL_DIALLED = Object.freeze({
  floorSize: 1.07, pulseShape: 'breath', pulseS: 7.2, pulseDepth: 0.48, tightness: 0.31, trail: 0.1,
  height: 1.05, riseS: 6.3, baseRadius: 0.47, topRadius: 1.19, flare: 2.1, streamSize: 5.1,
  dustAt: 0.3, glitterShare: 0.86, twinkle: 0.71, palette: 'riven', light: 8, lightRange: 5.2,
});

/** Colour sets: core (the hot middle), energy (streams, veins), dust (the glitter it becomes). */
export const WELL_PALETTES = Object.freeze({
  ancient: { label: 'Ancient (teal → gold)',     core: '#e8fff8', energy: '#3fe0d0', deep: '#6a3cff', dust: '#ffd98a' },
  riven:   { label: 'Riven World (blue/violet)', core: '#eef6ff', energy: '#6fb8ff', deep: '#a05cff', dust: '#bff3ff' },
  amber:   { label: 'Bronze age (amber)',        core: '#fff6e0', energy: '#ffb04a', deep: '#b0402a', dust: '#fff0b8' },
  spectral:{ label: 'Spectral (violet → white)', core: '#f6eeff', energy: '#c07bff', deep: '#3a5cff', dust: '#ffffff' },
});

const fract = x => x - Math.floor(x);

/**
 * The beat, 0..1, at `t` seconds. `heartbeat` is a lub-dub (two thumps, the
 * second softer), `breath` a slow sine, `swell` a long rise and a quick release.
 */
export function wellPulse(t, shape = 'heartbeat', period = 2.8) {
  const p = fract(t / Math.max(0.2, period));
  if (shape === 'breath') return 0.5 - 0.5 * Math.cos(p * TAU);
  if (shape === 'swell') return p < 0.82 ? Math.pow(p / 0.82, 2.2) : Math.pow(1 - (p - 0.82) / 0.18, 2);
  const thump = (c, w) => Math.exp(-Math.pow((p - c) / w, 2));
  return Math.min(1, thump(0.08, 0.045) + 0.62 * thump(0.24, 0.05));
}
/** When the beat's main thump lands, for the ripple. */
const beatIndex = (t, period) => Math.floor((t / Math.max(0.2, period)) - 0.08);

// ── shaders ─────────────────────────────────────────────────────────────────
const STONE_VS = `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
const STONE_FS = `
uniform float time, pulse, coreGlow, coreSize, veins, veinScale, veinSharp, glyphs, glyphAngle, edgeGlow,
  ripple, rippleAge, rippleSpeed, travel, flare, amount, fill;
uniform vec3 cCore, cEnergy, cDeep;
varying vec2 vP;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
// cracks: the edges between Voronoi cells (F2 − F1 small), cells drifting slowly
float cracks(vec2 p, float t){
  vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 o = hash2(i + g); o = .5 + .38 * sin(t * .15 + 6.2831 * o);
    float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}
// distance to the hex edge, 1 at the edge (vertices on +x, like the board's ring)
float hexD(vec2 p){ p = abs(p); return max(p.y, .8660254 * p.x + .5 * p.y) / .8660254; }
void main(){
  vec2 p = vP; float r = length(p); float hd = hexD(p);
  if (hd > 1.02) discard;
  float inside = 1. - smoothstep(.9, 1.0, hd);
  // ⭐ the beat leaves the core and travels OUT through the cracks: each ring of
  // the stone sees it a little later and a little dimmer than the one inside it.
  float beatOut = pulse * exp(-r * travel * 1.2);
  float core = exp(-r * r / max(.01, coreSize * coreSize)) * coreGlow * (.4 + .9 * pulse + flare * 1.6);
  // the cracks, warped a little so they read as stone and not as tiles
  vec2 q = p * veinScale + .35 * vec2(noise(p * 2.3 + time * .05), noise(p * 2.3 + 9.1 - time * .04));
  float edgeW = .5 / veinSharp;
  float crack = 1. - smoothstep(0., edgeW, cracks(q, time));
  float fine = 1. - smoothstep(0., edgeW * .6, cracks(q * 2.3 + 4.7, time * 1.3));
  float veinLight = (crack + .45 * fine) * veins * inside * (.3 + .7 * exp(-r * 1.4)) * (.28 + .9 * beatOut + flare);
  // the engraved ring: a waveform of old sound-marks round the stone
  float a = atan(p.y, p.x) + glyphAngle;
  float u = (a / 6.2831853 + .5) * 48.;
  float h = .25 + .75 * hash(vec2(floor(u), 3.));
  float band = smoothstep(.6, .615, r) * (1. - smoothstep(.6 + .14 * h, .615 + .14 * h, r));
  float gap = smoothstep(.0, .12, fract(u)) * (1. - smoothstep(.62, .78, fract(u)));
  float ring = smoothstep(.582, .59, r) * (1. - smoothstep(.598, .606, r));
  float glyph = (band * gap + ring * .7) * glyphs * (.3 + .8 * pulse * exp(-.6 * travel) + flare);
  // the edge of the hex, and the ripple the beat sends over it
  float edge = smoothstep(.9, .985, hd) * (1. - smoothstep(.985, 1.02, hd)) * edgeGlow * (.35 + .65 * beatOut + flare);
  float rip = ripple * exp(-pow((r - rippleAge * rippleSpeed) * 7., 2.)) * exp(-rippleAge * 1.6) * inside;
  // light from underneath: a faint fill through the whole stone, deeper at the rim
  float under = fill * inside * (.35 + .65 * beatOut + flare) * (.6 + .4 * (1. - r));
  vec3 col = cCore * core + cEnergy * (veinLight + glyph + rip) + mix(cDeep, cEnergy, .5) * edge + mix(cDeep, cEnergy, 1. - r) * under;
  float alpha = clamp(core + veinLight + glyph + edge + rip + under, 0., 1.);
  gl_FragColor = vec4(col * amount, alpha * amount);
}`;

// One shader for the streams and the haze: `mode` 0 = streams (wisp → dust), 1 = haze.
const RISE_VS = `
attribute vec4 seed;
attribute float trail;
uniform float trailLen;
uniform float time, riseS, height, baseRadius, topRadius, flare, turns, spin, strands, tightness, dustAt, dustDrift,
  streamSize, dustSize, pixelRatio, pulse, travel, mode, glitterShare, beatT, pulseS, flareUp,
  tapAge, tapPull, tapLen, tapH;
uniform vec3 tapAt;
varying float vLife, vDust, vSeed, vAlpha;
void main(){
  float life = fract(time / riseS * (.75 + .5 * seed.y) + seed.x - trail * trailLen * .06);
  float strand = floor(seed.z * strands);
  float jitter = (1. - tightness);
  float ang = strand * 6.2831853 / strands + jitter * (seed.w - .5) * 3.2
    + life * turns * 6.2831853 + time * spin * 6.2831853;
  float dust = mode > .5 ? 0. : smoothstep(dustAt - .08, dustAt + .08, life) * step(seed.y, glitterShare + .001);
  float rad = mix(baseRadius, topRadius, pow(life, flare)) * (1. + jitter * (seed.w - .5) * .5)
    + dust * (life - dustAt) * dustDrift;
  float h = pow(life, .8) * height * (1. + flareUp * .35) * (mode > .5 ? .7 : 1.);
  vec3 pos = vec3(cos(ang) * rad, h, sin(ang) * rad);
  // 🌀 the tap: streams bend into the Spirit and spiral up it, staggered by seed
  if (tapPull > 0.) {
    float k = clamp((tapAge / tapLen) * 1.6 - seed.x * .6, 0., 1.);
    float w = tapPull * sin(k * 3.14159);
    float a2 = ang * 1.7 + k * 9.;
    vec3 onSpirit = tapAt + vec3(cos(a2) * .35 * (1. - k * .6), mix(.1, tapH, fract(life + k)), sin(a2) * .35 * (1. - k * .6));
    pos = mix(pos, onSpirit, w);
  }
  vec4 view = modelViewMatrix * vec4(pos, 1.);
  // the beat climbs the column: a particle at height h sees it h·travel later
  float climb = exp(-pow(fract((beatT - h * travel * .35) / pulseS) * 4.5, 2.));
  float fade = min(1., life * 10.) * (1. - smoothstep(.82, 1., life));
  vAlpha = fade * (.55 + .45 * climb + flareUp) * (1. - trail * .7 * step(.001, trailLen));
  vLife = life; vDust = dust; vSeed = seed.z * 7.13 + seed.w;
  float sz = (mode > .5 ? streamSize : mix(streamSize, dustSize, dust)) * (1. - trail * .35);
  gl_PointSize = clamp(sz * pixelRatio * clamp(12. / -view.z, .35, 2.6), 1., mode > .5 ? 220. : 40.);
  gl_Position = projectionMatrix * view;
}`;
const RISE_FS = `
uniform float time, twinkle, amount, mode, iridescence, dustGlow;
uniform vec3 cEnergy, cDeep, cDust, cCore;
varying float vLife, vDust, vSeed, vAlpha;
void main(){
  vec2 p = abs(gl_PointCoord - .5) * 2.;
  float d = length(p);
  if (mode > .5) {                                   // haze: a big soft puff
    float puff = exp(-d * d * 3.2);
    gl_FragColor = vec4(mix(cDeep, cEnergy, .45) , puff * vAlpha * amount * .5);
    if (gl_FragColor.a < .003) discard;
    return;
  }
  float soft = exp(-d * d * 4.);                    // a wisp of energy
  float core = pow(max(0., 1. - d), 2.);
  float star = pow(max(0., 1. - min(p.x, p.y) * 8.), 3.) * pow(max(0., 1. - max(p.x, p.y)), 1.4);
  float tw = mix(1., .25 + .75 * pow(.5 + .5 * sin(time * 9. + vSeed * 13.), 3.), twinkle * vDust);
  vec3 prism = .65 + .35 * cos(6.28318 * (vSeed + vec3(0., .33, .67)));
  vec3 wisp = mix(cEnergy, cCore, .25 * (1. - vLife));
  vec3 dust = mix(cDust, prism, iridescence);
  vec3 col = mix(wisp, dust, vDust);
  float shape = mix(soft * .6 + core * .25, (core * .55 + star * .75) * dustGlow, vDust);
  float alpha = shape * vAlpha * amount * tw;
  if (alpha < .004) discard;
  gl_FragColor = vec4(col, alpha);
}`;

/** Particles come in runs of TRAIL that share a seed and follow each other a
 *  little apart in time, so a stream reads as a streak, not a string of beads. */
const TRAIL = 4;
function riseGeometry(count, salt) {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 4), trail = new Float32Array(count), pos = new Float32Array(count * 3);
  let s = salt >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < count; i += TRAIL) {
    const v = [rnd(), rnd(), rnd(), rnd()];
    for (let k = 0; k < TRAIL && i + k < count; k++) { seed.set(v, (i + k) * 4); trail[i + k] = k / TRAIL; }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('trail', new THREE.BufferAttribute(trail, 1));
  return g;
}

/**
 * @param scene  where it is drawn
 * @param opts.pointFor  hex → THREE.Vector3 on the floor (the arena's `arenaPoint`)
 * @param opts.hexNum    the centre (56)
 * @param opts.L         the look (CENTRE_WELL by default)
 * @param opts.riseScene where the RISE and the aura go (the foreground in the game); defaults to `scene`
 */
export function createCentreWell(scene, { pointFor, hexNum = 56, L: L0 = CENTRE_WELL, riseScene = null, hexR = 1.08 * 0.93 } = {}) {
  let L = { ...CENTRE_WELL, ...L0 };
  const at = pointFor(hexNum, 0);
  const group = new THREE.Group(); group.name = 'Wellspring'; group.position.set(at.x, 0, at.z); scene.add(group);
  const riseGroup = new THREE.Group(); riseGroup.name = 'Wellspring rise'; riseGroup.position.copy(group.position);
  (riseScene ?? scene).add(riseGroup);

  const col = { core: new THREE.Color(), energy: new THREE.Color(), deep: new THREE.Color(), dust: new THREE.Color() };
  const setColours = () => { const P = WELL_PALETTES[L.palette] ?? WELL_PALETTES.ancient; for (const k of Object.keys(col)) col[k].set(P[k]); };
  setColours();

  // ── the stone ──
  const stoneGeo = new THREE.CircleGeometry(1, 6); // a hex; vertex 0 on +x before the lay-flat turn
  const stoneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: {
      time: { value: 0 }, pulse: { value: 0 }, coreGlow: { value: 1 }, coreSize: { value: .4 }, veins: { value: 1 },
      veinScale: { value: 3 }, veinSharp: { value: 5 }, glyphs: { value: .5 }, glyphAngle: { value: 0 }, edgeGlow: { value: .4 },
      fill: { value: .35 }, ripple: { value: .6 }, rippleAge: { value: 9 }, rippleSpeed: { value: .8 }, travel: { value: .5 }, flare: { value: 0 }, amount: { value: 1 },
      cCore: { value: col.core }, cEnergy: { value: col.energy }, cDeep: { value: col.deep },
    },
    vertexShader: STONE_VS, fragmentShader: STONE_FS,
  });
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  // ⚠️ CircleGeometry's first vertex is on +x; laid flat with -π/2 about x, its
  // local y becomes world -z — so the hex keeps a vertex on +x, like the board's
  // own spotlight ring (`arenaEnvironment.js` hexRing).
  stone.rotation.x = -Math.PI / 2; stone.renderOrder = 55; stone.name = 'Wellspring stone';
  group.add(stone);

  // 🪨 THE LID: the arena model has its own violet crack lit in the middle
  // ("Stage — Crack violet"), which would out-shine the well's core. A dark stone
  // lid over it (lever `lid`) makes the well the only light here.
  const lid = new THREE.Mesh(new THREE.CircleGeometry(1, 6), new THREE.MeshStandardMaterial({ color: '#0a0f1d', roughness: .9, metalness: .1,
    transparent: true, opacity: .94, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  lid.rotation.x = -Math.PI / 2; lid.renderOrder = 54; lid.name = 'Wellspring lid'; group.add(lid);
  const light = new THREE.PointLight(col.energy, 3, 3.5, 2); light.position.set(0, 0.45, 0); group.add(light);

  // ── the rise ──
  const riseUniforms = () => ({
    time: { value: 0 }, riseS: { value: 3 }, height: { value: 2 }, baseRadius: { value: .3 }, topRadius: { value: 1 }, flare: { value: 1.5 },
    turns: { value: 1.4 }, spin: { value: .05 }, strands: { value: 3 }, tightness: { value: .6 }, dustAt: { value: .55 }, dustDrift: { value: .5 },
    streamSize: { value: 2.6 }, dustSize: { value: 1.5 }, pixelRatio: { value: 1 }, pulse: { value: 0 }, travel: { value: .5 }, mode: { value: 0 },
    glitterShare: { value: .7 }, beatT: { value: 0 }, pulseS: { value: 2.8 }, flareUp: { value: 0 },
    tapAge: { value: 0 }, tapPull: { value: 0 }, tapLen: { value: 1.7 }, tapH: { value: 1.6 }, tapAt: { value: new THREE.Vector3() },
    trailLen: { value: 1 }, twinkle: { value: .8 }, amount: { value: 1 }, iridescence: { value: .25 }, dustGlow: { value: 1 },
    cEnergy: { value: col.energy }, cDeep: { value: col.deep }, cDust: { value: col.dust }, cCore: { value: col.core },
  });
  const MAX_STREAMS = 2400, MAX_HAZE = 120;
  const streamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: riseUniforms(), vertexShader: RISE_VS, fragmentShader: RISE_FS });
  const hazeMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: riseUniforms(), vertexShader: RISE_VS, fragmentShader: RISE_FS });
  hazeMat.uniforms.mode.value = 1; hazeMat.uniforms.trailLen.value = 0;
  const streams = new THREE.Points(riseGeometry(MAX_STREAMS, 5150), streamMat);
  const haze = new THREE.Points(riseGeometry(MAX_HAZE, 911), hazeMat);
  for (const p of [streams, haze]) { p.frustumCulled = false; p.renderOrder = 150; riseGroup.add(p); }
  streams.name = 'Wellspring streams'; haze.name = 'Wellspring haze';

  // ── the tap's flash and floor ring ──
  // ⚠️ depthTest off: the flash sits at the Spirit's chest, i.e. IN its standee's plane.
  const flashMat = new THREE.SpriteMaterial({ color: col.core, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false,
    map: glowTexture() });
  const flash = new THREE.Sprite(flashMat); flash.renderOrder = 152; riseGroup.add(flash);
  const ringMat = new THREE.MeshBasicMaterial({ color: col.energy, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 6, 1), ringMat); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 56; group.add(ring);

  // ── the aura: a faint orbit of the well's glitter riding with a charged Spirit ──
  const AURA_N = 90;
  const auraGeo = new THREE.BufferGeometry();
  const auraPos = new Float32Array(AURA_N * 3), auraSeed = new Float32Array(AURA_N);
  for (let i = 0; i < AURA_N; i++) auraSeed[i] = fract(Math.sin(i * 91.7) * 4375.85);
  auraGeo.setAttribute('position', new THREE.BufferAttribute(auraPos, 3));
  const auraMat = new THREE.PointsMaterial({ size: 0.06, map: glowTexture(), color: col.dust, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true });
  const aura = new THREE.Points(auraGeo, auraMat); aura.frustumCulled = false; aura.renderOrder = 151; aura.visible = false;
  (riseScene ?? scene).add(aura);

  let tap = null, lastBeat = -1, rippleT0 = -99, now = 0;
  const auraColour = new THREE.Color();

  function setLook(next) {
    L = { ...CENTRE_WELL, ...next }; setColours();
    const R = hexR * L.floorSize;
    stone.scale.set(R, R, 1); stone.position.y = L.floorY + 0.004;
    lid.visible = L.lid === 'cover'; lid.scale.set(hexR * 0.97, hexR * 0.97, 1); lid.position.y = L.floorY;
    ring.position.y = L.floorY + 0.006;
    light.color.copy(col.energy); light.distance = L.lightRange;
    const u = stoneMat.uniforms;
    u.coreGlow.value = L.coreGlow; u.coreSize.value = L.coreSize; u.veins.value = L.veins; u.veinScale.value = L.veinScale;
    u.veinSharp.value = L.veinSharp; u.fill.value = L.fill; u.glyphs.value = L.glyphs; u.edgeGlow.value = L.edgeGlow; u.ripple.value = L.ripple;
    u.rippleSpeed.value = L.rippleSpeed / Math.max(.2, L.floorSize); u.travel.value = L.travel;
    for (const m of [streamMat, hazeMat]) {
      const v = m.uniforms;
      v.riseS.value = L.riseS; v.height.value = L.height; v.baseRadius.value = L.baseRadius * L.floorSize; v.topRadius.value = L.topRadius * L.floorSize;
      v.flare.value = L.flare; v.turns.value = L.turns; v.spin.value = L.spin; v.strands.value = L.strands; v.tightness.value = L.tightness;
      v.dustAt.value = L.dustAt; v.dustDrift.value = L.dustDrift; v.dustSize.value = L.dustSize; v.travel.value = L.travel;
      v.glitterShare.value = L.glitterShare; v.pulseS.value = L.pulseS; v.twinkle.value = L.twinkle; v.iridescence.value = L.iridescence;
      v.dustGlow.value = L.dustGlow; v.tapLen.value = L.tapMs / 1000; v.trailLen.value = m === hazeMat ? 0 : L.trail;
    }
    streamMat.uniforms.streamSize.value = L.streamSize; hazeMat.uniforms.streamSize.value = L.hazeSize;
    streams.geometry.setDrawRange(0, Math.min(MAX_STREAMS, Math.round(L.streams)));
    haze.geometry.setDrawRange(0, Math.min(MAX_HAZE, Math.round(L.hazeCount)));
    streams.visible = L.streams > 0 && L.streamGlow > 0; haze.visible = L.haze > 0 && L.hazeCount > 0;
    flashMat.color.copy(col.core); ringMat.color.copy(col.energy);
  }
  setLook(L);

  /**
   * A Spirit steps on. `spirit` = { at: Vector3 (its feet), height, color };
   * `gift` false = the well stirs for a Spirit it has nothing for yet (no pull).
   */
  function tapIn(spirit, { gift = true } = {}) {
    tap = { t0: now, at: spirit.at.clone(), height: spirit.height ?? 1.6, gift, color: spirit.color ?? null };
  }

  /**
   * @param time  seconds
   * @param o.charged  [{ at: Vector3 (feet), height, color }] — Spirits whose gift is live (the aura)
   */
  function update(time, { reduced = false, pixelRatio = 1, charged = [], visible = true } = {}) {
    now = time;
    group.visible = riseGroup.visible = visible;
    if (!visible) { aura.visible = false; return; }
    const t = reduced ? 0 : time;
    const beat = reduced ? 0.35 : wellPulse(time, L.pulseShape, L.pulseS) * L.pulseDepth + (1 - L.pulseDepth) * 0.35;
    const b = beatIndex(time, L.pulseS);
    if (!reduced && b !== lastBeat) { lastBeat = b; rippleT0 = time; }
    // the tap's envelope
    let flare = 0, pull = 0, tapAge = 0;
    if (tap) {
      tapAge = time - tap.t0; const len = L.tapMs / 1000;
      if (tapAge > len + 1.2) tap = null;
      else {
        flare = Math.exp(-Math.pow((tapAge - 0.15) / 0.22, 2)) * 0.9 + (tapAge > len * 0.72 ? Math.exp(-(tapAge - len * 0.72) * 4) * 0.8 : 0);
        if (!tap.gift) flare *= 0.45;
        pull = tap.gift && !reduced ? L.tapPull * Math.min(1, tapAge / 0.25) * (tapAge < len ? 1 : Math.max(0, 1 - (tapAge - len) / 0.5)) : 0;
        // the flash at the Spirit's chest, and a ring along the floor
        const fk = tapAge - len * 0.72;
        const flashA = tap.gift && fk > 0 ? Math.exp(-fk * 5) * L.tapFlash : 0;
        flash.position.set(tap.at.x - group.position.x, tap.height * 0.6, tap.at.z - group.position.z);
        flash.scale.setScalar(0.6 + 2.2 * Math.min(1, Math.max(0, fk) * 3)); flashMat.opacity = flashA;
        const rk = Math.max(0, fk) * 1.4;
        ring.scale.setScalar(hexR * L.floorSize * (0.4 + rk * 2.2)); ringMat.opacity = tap.gift && fk > 0 ? Math.max(0, 0.8 - rk) * L.tapFlash : 0;
      }
    }
    if (!tap) { flashMat.opacity = 0; ringMat.opacity = 0; }

    const u = stoneMat.uniforms;
    u.time.value = t; u.pulse.value = beat; u.flare.value = flare; u.glyphAngle.value = t * L.glyphSpin * TAU;
    u.rippleAge.value = reduced ? 9 : time - rippleT0;
    light.intensity = L.light * (0.55 + 0.6 * beat + flare * 1.5);
    for (const m of [streamMat, hazeMat]) {
      const v = m.uniforms;
      v.time.value = t; v.beatT.value = reduced ? 0 : fract((time - 0.08 * L.pulseS) / L.pulseS) * L.pulseS + 0.0001;
      v.pulse.value = beat; v.flareUp.value = flare; v.pixelRatio.value = pixelRatio;
      v.tapPull.value = pull; v.tapAge.value = tapAge;
      if (tap) { v.tapAt.value.set(tap.at.x - group.position.x, 0, tap.at.z - group.position.z); v.tapH.value = tap.height; }
    }
    streamMat.uniforms.amount.value = L.streamGlow; hazeMat.uniforms.amount.value = L.haze;

    // the aura on charged Spirits (pooled for one; a second is drawn on the same orbit set)
    const c = charged[0];
    aura.visible = !!c && L.aura > 0;
    if (aura.visible) {
      auraColour.copy(L.auraColor === 'spirit' && c.color ? new THREE.Color(c.color) : col.dust);
      auraMat.color.copy(auraColour); auraMat.opacity = L.aura;
      const H = c.height ?? 1.6;
      for (let i = 0; i < AURA_N; i++) {
        const s = auraSeed[i], a = s * TAU + t * (0.5 + s * 0.6) * (i % 2 ? 1 : -1);
        const y = fract(s * 3.7 + t * (0.08 + s * 0.06)) * H;
        const r = 0.42 + 0.1 * Math.sin(t * 1.3 + i);
        auraPos[i * 3] = c.at.x + Math.cos(a) * r; auraPos[i * 3 + 1] = c.at.y + y; auraPos[i * 3 + 2] = c.at.z + Math.sin(a) * r;
      }
      auraGeo.attributes.position.needsUpdate = true;
      auraMat.size = 0.05 + 0.03 * (reduced ? 0 : Math.sin(t * 6) * 0.5 + 0.5);
    }
  }

  function dispose() {
    for (const o of [stone, lid, streams, haze, ring, aura]) { o.geometry.dispose(); o.material.dispose(); }
    flashMat.map?.dispose(); flashMat.dispose(); auraMat.map?.dispose();
    group.removeFromParent(); riseGroup.removeFromParent(); aura.removeFromParent();
  }

  return { group, riseGroup, setLook, update, tapIn, dispose, get look() { return L; },
    diagnostics: () => ({ streams: streams.geometry.drawRange.count, haze: haze.geometry.drawRange.count, tapping: !!tap, aura: aura.visible }) };
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = c.height = 64; const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); return glowTex;
}
