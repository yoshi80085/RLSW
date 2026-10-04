import * as THREE from 'three';

// ═══ 🪩 THE CROWD'S GLOW STICKS ═══════════════════════════════════════════════
// Alex, 2026-09-25: "Lets give the fans glow sticks to wave around and use."
// Ruled the same day: VISUAL ONLY (no rule, balance stays frozen) and EVERYONE
// holds one, Casuals and Diehards alike.
//
// Dialled on `.scratch/glowstick-preview.html` (also published as the
// "Glow Stick Study" artifact), 15 of 23 levers moved. The preview builds its
// stands through THIS module, so the page and the game cannot drift.
//
// ⭐ ONE DRAW CALL PER PART PER STAND, NOT PER STICK. The preview's first cut
// was a mesh per stick (core + cap + haze + three trail ghosts = six draws a
// fan) and the default shot measured 2,776 draw calls with sticks in only two
// stands. Here every part is one `InstancedMesh` for the whole stand, so a
// full house of 30 fans with sticks in both hands costs the same six draws as
// one fan does.
//
// ⭐ THE POSE IS A PURE FUNCTION OF TIME (`glowPose`). That is what lets a trail
// ghost be "where the stick was 45 ms ago" rather than "where it was two frames
// ago". The frame-history version drew an X instead of a streak whenever the
// frame rate dipped, because a ghost two frames back could be half a swing away.
//
// 🧱 THE SOLID LAYER (solidLayer.js). The core and cap are opaque, so they are
// "solid" and get re-drawn on the foreground canvas, which has no bloom: the
// core is sharp and its bloom spills out from the arena pass underneath. The
// haze and the trail are additive, so they are drawn in the arena pass only,
// and a fan re-drawn in front of one will cover it. Seen in Chromium, NOT yet
// on Alex's GPU.
// =============================================================================
export const GLOW_LOOK = Object.freeze({
  // — the stick —  (fan-model units; a fan's head is 0.24 across)
  length:     0.35,
  thickness:  0.02,
  grip:       0.25,   // where along the stick the hand holds it (0 = the very end)
  brightness: 4.6,    // × colour. The bloom threshold is 1.05; under ~1.6 nothing glows
  haze:       0.36,   // the additive sleeve — what reads when bloom is off (lite quality)
  hazeSize:   3,      // sleeve radius ÷ core radius
  trail:      3,      // ghosts behind a moving stick; one draw call each per stand
  trailFade:  0.45,
  trailGap:   0.045,  // SECONDS between ghosts — time, not frames (see header)
  // — the colour —
  colorMode:  'neon', // owner | ownerWhite | hueJitter | neon
  hueJitter:  0.05,   // only read by 'hueJitter'
  // — the wave —
  hands:      'mix',  // one | both | mix
  bothShare:  0.3,    // with 'mix': the share of fans holding one in each hand
  style:      'mix',  // sway | pump | circle | mix
  bpm:        77,     // one full sway is two beats
  amp:        0.38,   // radians of swing
  raise:      0.58,   // 0 = in the lap, 1 = fully overhead
  sync:       0.35,   // 0 = every fan its own phase, 1 = the stand as one
  idleShare:  0.46,   // share of the stand waving when nothing is happening
  pulse:      0.17,   // brightness throb on the beat
  // — the reactions (arenaCrowd `react`) —
  winSpeed:   1.3,    // × tempo when their Spirit wins a bout
  winAmp:     1.2,    // × swing
  lossDim:    0.35,   // × brightness on a loss; the sticks also droop
});

const NEON = ['#39ff14', '#ff2bd6', '#00e5ff', '#ffe600', '#ff6a00', '#b45bff'];
const STYLES = ['sway', 'pump', 'circle'];

/** Deterministic per-seat randomness: the same seat always gets the same stick. */
const rand = (seed, salt) => { const x = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };

export function stickColor(look, owner, diehard, seed) {
  if (look.colorMode === 'ownerWhite' && !diehard) return new THREE.Color('#e6f2ff');
  if (look.colorMode === 'neon') return new THREE.Color(NEON[Math.floor(rand(seed, 3) * NEON.length)]);
  const c = new THREE.Color(owner);
  if (look.colorMode === 'hueJitter') {
    const hsl = {}; c.getHSL(hsl);
    c.setHSL((hsl.h + (rand(seed, 4) - .5) * 2 * look.hueJitter + 1) % 1, hsl.s, hsl.l);
  }
  return c;
}

/** The sticks one fan holds: which hands, which wave, which phase. Pure. */
export function sticksForFan(look, seed) {
  const both = look.hands === 'both' || (look.hands === 'mix' && rand(seed, 1) < look.bothShare);
  const side = rand(seed, 2) < .5 ? -1 : 1;
  const style = look.style === 'mix' ? STYLES[Math.floor(rand(seed, 5) * 3)] : look.style;
  const common = { both, style, waver: rand(seed, 6), phase: rand(seed, 7) * Math.PI * 2 };
  return (both ? [-1, 1] : [side]).map(sign => ({ ...common, sign }));
}

/** The mood a bout puts a stand in, as the three weights the pose reads. */
export function glowMood(look, mood = 0, amount = 0) {
  const win = mood > .5 ? amount : 0, loss = mood < 0 ? amount : 0, tie = mood > 0 && mood <= .5 ? amount : 0;
  return { win, loss, tie,
    bpm: look.bpm * (1 + (look.winSpeed - 1) * win + .15 * tie),
    amp: look.amp * (1 + (look.winAmp - 1) * win) };
}

/**
 * ⭐ Where a stick is at time `t`, in its fan's own space. PURE — the trail
 * depends on it (see the header). `rest` is the hand's rest position.
 */
export function glowPose(look, stick, rest, t, M, reduced = false) {
  const lerp = THREE.MathUtils.lerp;
  const beat = t * M.bpm / 60 * Math.PI;
  const ph = lerp(stick.phase, 0, look.sync) + (stick.sign < 0 && stick.both ? Math.PI : 0);
  const waving = !reduced && (stick.waver < look.idleShare || M.win > .1 || M.tie > .1);
  const raise = lerp(look.raise, Math.max(look.raise, .95), M.win) * (1 - M.loss * .8);
  const w = Math.sin(beat + ph);
  let x = rest.x * (waving ? .85 : 1), y = lerp(.28, .74, waving ? raise : raise * .25), rx = .12, rz = stick.sign * .12;
  if (waving) {
    if (stick.style === 'sway') { rz = w * M.amp; x += w * .05; }
    if (stick.style === 'pump') { const p = Math.max(0, Math.sin(beat * 2 + ph)); y += p * .07; rx = .25 + p * .55 * (M.amp / .55); rz = stick.sign * .18; }
    if (stick.style === 'circle') { rz = w * M.amp; rx = .2 + Math.cos(beat + ph) * M.amp * .7; }
  } else if (!reduced) {
    rz = stick.sign * .12 + Math.sin(t * 1.3 + stick.phase) * .06;   // held low, idly bobbing
  }
  // 😞 A loss droops the stick forward and down (and `update` dims it).
  rx = lerp(rx, 1.35, M.loss); rz = lerp(rz, stick.sign * .3, M.loss);
  const throb = reduced ? 1 : 1 - look.pulse * .5 + look.pulse * .5 * Math.cos(beat * 2);
  return { x, y, z: rest.z + (waving ? .03 : 0), rx, rz, waving, throb };
}

/** 🌫️ The haze: brightest where you look straight through it, gone at its
 *  silhouette, so it reads as light around the stick. A flat additive sleeve
 *  was tried first and drew a pale translucent plank at arena distance. */
function hazeMaterial(opacity) {
  return new THREE.ShaderMaterial({
    uniforms: { opacity: { value: opacity } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main(){
        mat4 m = modelViewMatrix * instanceMatrix;
        vec4 mv = m * vec4(position, 1.0);
        vN = normalize(mat3(m) * normal); vV = normalize(-mv.xyz);
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #else
          vC = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float opacity; varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.5) * opacity;
        gl_FragColor = vec4(vC * f, f); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

/**
 * Hand every fan in a stand its stick(s). The meshes are children of `group`
 * (the stand), and each fan must carry `userData.hands` (see `fanPawn3D`).
 * @returns {{ update(t, mood, amount, opts), dispose(), count, meshes }}
 */
export function createGlowSticks(group, fans, { owner = '#8a91ff', look = GLOW_LOOK, seedOffset = 0 } = {}) {
  const sticks = [];
  fans.forEach((fan, k) => {
    const hands = fan.userData.hands;
    if (!hands?.length) return;
    const seed = k + seedOffset;
    const base = stickColor(look, owner, fan.name === 'Diehard fan', seed);
    for (const stick of sticksForFan(look, seed)) {
      const hand = hands[stick.sign < 0 ? 0 : 1];
      sticks.push({ ...stick, fan, hand, base, rest: hand.position.clone() });
    }
  });
  const n = sticks.length;
  const mid = look.length * (0.5 - look.grip), hazeR = look.thickness * look.hazeSize;
  const geos = [
    new THREE.CapsuleGeometry(look.thickness, Math.max(.001, look.length - look.thickness * 2), 3, 8).translate(0, mid, 0),
    new THREE.CylinderGeometry(look.thickness * 1.15, look.thickness * 1.15, look.length * .1, 8)
      .translate(0, -look.length * look.grip + look.length * .05, 0),
    new THREE.CapsuleGeometry(hazeR, look.length, 4, 12).translate(0, mid, 0),
  ];
  const coreMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const capMat = new THREE.MeshStandardMaterial({ color: '#1b2233', roughness: .6 });
  const hazeMat = hazeMaterial(look.haze);
  const make = (geo, mat, name) => {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    mesh.count = n; mesh.name = name;
    // ⚠️ Instances move every frame and the sphere three caches is computed
    // once — a culled stand would blink out mid-wave. The stand is small.
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh); return mesh;
  };
  const core = make(geos[0], coreMat, 'Glow stick'), cap = make(geos[1], capMat, 'Glow stick cap');
  const haze = look.haze > 0 ? make(geos[2], hazeMat, 'Glow stick haze') : null;
  const ghosts = Array.from({ length: look.trail }, (_, i) => make(geos[0], new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    opacity: look.trailFade * (1 - i / look.trail) * .6 }), 'Glow trail'));
  const tint = new THREE.Color();
  sticks.forEach((s, i) => { for (const m of [haze, ...ghosts]) m?.setColorAt(i, s.base); core.setColorAt(i, s.base); });

  const local = new THREE.Matrix4(), world = new THREE.Matrix4(), q = new THREE.Quaternion(),
    e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const place = (mesh, i, fan, pose) => {
    p.set(pose.x, pose.y, pose.z); q.setFromEuler(e.set(pose.rx, 0, pose.rz));
    local.compose(p, q, one); world.multiplyMatrices(fan.matrix, local); mesh.setMatrixAt(i, world);
  };
  return {
    count: n,
    meshes: [core, cap, haze, ...ghosts].filter(Boolean),
    /** Call after the fans have been posed (their own tick, then any react). */
    update(t, mood = 0, amount = 0, { reduced = false } = {}) {
      if (!n) return;
      const M = glowMood(look, mood, amount), fade = 1 - M.loss * (1 - look.lossDim);
      for (let i = 0; i < n; i++) {
        const s = sticks[i], pose = glowPose(look, s, s.rest, t, M, reduced);
        s.hand.position.set(pose.x, pose.y, pose.z);   // the hand holds the stick
        s.fan.updateMatrix();
        place(core, i, s.fan, pose); place(cap, i, s.fan, pose); if (haze) place(haze, i, s.fan, pose);
        core.setColorAt(i, tint.copy(s.base).multiplyScalar(look.brightness * pose.throb * fade));
        haze?.setColorAt(i, tint.copy(s.base).multiplyScalar(fade));
        ghosts.forEach((g, j) => {
          if (!pose.waving) { g.setMatrixAt(i, zero); return; }
          place(g, i, s.fan, glowPose(look, s, s.rest, t - (j + 1) * look.trailGap, M, reduced));
        });
      }
      for (const m of [core, cap, haze, ...ghosts]) if (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    },
    dispose() {
      for (const m of [core, cap, haze, ...ghosts]) if (m) { m.removeFromParent(); m.dispose?.(); m.material.dispose(); }
      geos.forEach(g => g.dispose());
    },
  };
}
