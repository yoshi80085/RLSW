// ─── 🎆 PYRO MORTARS — Astra's mechanical mortars, the one tracked copy ──────
// Extracted 2026-10-02 from `.scratch/stage-pyro/pyro.js` (Astra's stage study
// 03), which now imports THIS file. The look is hers, untouched: the hex hatch
// and six petals, the barrel that rises out of the floor, the shader flame,
// the comet trail and the aerial burst. What changed is the shape around it:
//
//   ⭐ CONSTRUCTION IS EXPLICIT. `createPyro` always built 12 perimeter cannons,
//      a 22-bar truss and a 22,000-particle buffer whatever the show used. Here
//      the cannons ("blasters") and the spark curtain are OPTIONS, off unless
//      asked (Alex, 2026-10-02: the game wants the mortars only), and the
//      particle pool is sized to what was built.
//   ⭐ THE PARTS HAVE NAMES. Each mortar is `{ g, base, barrel, petals, warning,
//      bore, exhaust, index, num }` and `mortarByHex` finds one by its hex
//      number. The pyro-shove preview used to reach in by child position
//      (`g.children[2]` / `[9]`), which any restructure would have broken.
//   ⭐ OVERRIDES RUN AFTER `update()`. It rewrites every transform from the
//      clock each frame, so anything layered on top (the struck barrel sinking
//      under a standee's weight) lives INSIDE update, after the rewrite —
//      `cue.contact` — rather than in a caller that would have to remember.
//
// 📌 THE CUE CONTRACT (absolute seconds on ONE shared clock):
//   { deployedAt, fireAt:[per mortar, same order as `nums`], endAt, showAt,
//     hit, contact }
//   hatch opens deployedAt → +1.30 s · barrel rises +0.40 → +1.90 s
//   fireAt[i] ignites mortar i (recoil 0.45 s, the shell bursts 1.50 s later)
//   barrel lowers endAt → +1.10 s · petals close → +1.40 s · hidden after
//   `hit` (a hex number, or several) marks a STRUCK mortar: from 0.08 s after
//   its ignition the barrel sinks a further 0.95 and the petals close.
//   `contact` ({ hexNum: seconds }) sinks a struck barrel from the moment a
//   standee lands on it, BEFORE the bang — otherwise it clips through the piece.
// ⚠️ Every particle is a pure function of the clock, so pause, scrub and slow
// motion never leave anything behind. No `Math.random` anywhere in here.
import * as THREE from 'three';
import { HEX_BY_NUM } from './hexMap.js';

// ── timing (Astra's, hard-coded smoothstep curves; named so callers can read them) ──
export const MORTAR_TIMING = Object.freeze({
  petalsOpen: 1.3,         // s, deployedAt → open
  barrelRiseAt: 0.4,       // s after deployedAt
  barrelRise: 1.5,         // s
  deployed: 1.9,           // s after deployedAt: fully up and locked
  recoil: 0.45,            // s after ignition
  flight: 1.5,             // s, the shell's climb — the burst begins here
  burstLife: 4.6,          // s, the burst's particles
  barrelLower: 1.1,        // s after endAt
  petalsClose: 1.4,        // s after endAt — and the assembly is hidden then
  struckAt: 0.08,          // s after ignition the struck barrel starts down
  struckOver: 0.38,        // s
  contactSink: 0.12,       // s to press a struck barrel down under a standee
});
// 📌 The mechanism's SOUND marks (Astra's beats, my voices) live with the show
// timeline in `pyroShove.js` MORTAR_SOUND_MARKS — that file is pure, so it
// mirrors `flight` as SHELL_FLIGHT and `pyroShoveCheck` holds the two equal.

export const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
/** A hex's centre in arena space — ⚠️ the SAME px → world mapping as `arenaVisuals.arenaPoint`. */
export const point = (num, y = 0) => { const h = HEX_BY_NUM[num]; return new THREE.Vector3((h.px - 3255) / 200, y, (h.py - 2415) / 200); };

/** Astra's look settings (`stage-pyro/choreography.js` DEFAULTS, the mortar-relevant half). */
export const MORTAR_LOOK = Object.freeze({
  mortars: true, fireworks: true, cannons: false, curtain: false, guides: true,
  width: 1, height: 7, burst: 3.6, density: 1, stagger: 0.18, palette: 'gold', column: 1,
});

const metal = color => new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.32 });
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
function mesh(root, g, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); root.add(o); return o; }
function ring(root, r, t, mat, y) { const o = mesh(root, new THREE.TorusGeometry(r, t, 8, 32), mat, 0, y); o.rotation.x = Math.PI / 2; return o; }
function flame(root) {
  const uniforms = { time: { value: 0 }, power: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 v;uniform float time;uniform float power;
 float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
 void main(){float y=v.y;float n=noise(vec2(v.x*6.,y*8.-time*6.));float n2=noise(vec2(v.x*13.+time,y*17.-time*10.));float sway=sin(y*9.-time*5.)*.1*y;
 float shape=1.-abs(v.x-.5+sway)*2./max(.04,(1.-y)*.85+.07);float f=shape+(n-.5)*.9+(n2-.5)*.35-y*.3;
 float a=smoothstep(.02,.4,f)*smoothstep(1.,.65,y)*smoothstep(0.,.06,y)*power;
 vec3 col=mix(vec3(1.,.055,.002),vec3(1.,.48,.025),smoothstep(.1,.5,f));col=mix(col,vec3(1.,.94,.58),smoothstep(.5,.95,f)*(1.-y));gl_FragColor=vec4(col*2.1,a);}` });
  const group = new THREE.Group(); root.add(group);
  for (let i = 0; i < 2; i++) { const p = mesh(group, new THREE.PlaneGeometry(1, 1), mat, 0, 0.5); p.rotation.y = i * Math.PI / 2; }
  return { group, uniforms };
}
function mortar(root, num, index) {
  const g = new THREE.Group(); g.position.copy(point(num, 0.09)); g.name = `mortar-${num}`; root.add(g);
  const dark = metal('#171b21'), edge = metal('#8190a0');
  const base = mesh(g, new THREE.CylinderGeometry(0.72, 0.78, 0.14, 6), dark);
  const warning = mesh(g, new THREE.RingGeometry(0.83, 0.88, 6), glow('#ff6a16'), 0, 0.05); warning.rotation.x = -Math.PI / 2;
  const barrel = new THREE.Group(); g.add(barrel);
  mesh(barrel, new THREE.CylinderGeometry(0.32, 0.43, 0.88, 16, 1, true), dark, 0, 0.58);
  for (const y of [0.24, 0.5, 0.92]) ring(barrel, 0.35, 0.055, edge, y);
  mesh(barrel, new THREE.CylinderGeometry(0.29, 0.29, 0.04, 20), glow('#ff6719'), 0, 0.89);
  const bore = mesh(barrel, new THREE.CylinderGeometry(0.25, 0.25, 0.02, 20), glow('#ffd474'), 0, 0.925);
  for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2; mesh(barrel, new THREE.BoxGeometry(0.06, 0.6, 0.06), edge, Math.cos(a) * 0.41, 0.5, Math.sin(a) * 0.41); }
  const petals = [];
  for (let j = 0; j < 6; j++) {
    const pivot = new THREE.Group(); pivot.rotation.y = j * Math.PI / 3; g.add(pivot);
    const hinge = new THREE.Group(); hinge.position.z = 0.53; pivot.add(hinge);
    mesh(hinge, new THREE.BoxGeometry(0.47, 0.07, 0.44), metal('#3f4955'), 0, 0.11, -0.21);
    mesh(hinge, new THREE.BoxGeometry(0.27, 0.012, 0.05), glow('#e69232', 0.65), 0, 0.153, -0.17); petals.push(hinge);
  }
  const exhaust = flame(g); exhaust.group.position.y = 0.6;
  return { g, base, barrel, petals, warning, bore, exhaust, index, num };
}

/** Particles one mortar can draw at `density` (shell trail 65 + burst 150×3 tails + furnace sparks 30). */
export const particlesPerMortar = density => Math.ceil(545 * density);

/**
 * Build mortars on `nums` (hex numbers, in cue order) under `parent`.
 * Options: `cannons` / `curtain` (Astra's blasters and spark truss — off by
 * default), `maxDensity` (sizes the particle pool; a higher `density` setting
 * later just stops drawing when the pool is full).
 */
export function createPyroMortars(parent, nums, { cannons: withCannons = false, curtain: withCurtain = false, maxDensity = 1 } = {}) {
  const root = new THREE.Group(); root.name = 'pyro-mortars'; parent.add(root);
  const mortars = nums.map((n, i) => mortar(root, n, i));
  const mortarByHex = new Map(mortars.map(m => [m.num, m]));
  const cannons = [];
  if (withCannons) for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, g = new THREE.Group(); g.position.set(Math.cos(a) * 13.6, 0.2, Math.sin(a) * 13.6); g.rotation.y = -a; root.add(g);
    mesh(g, new THREE.BoxGeometry(0.85, 0.25, 0.85), metal('#36424f'));
    const nozzle = new THREE.Group(); nozzle.rotation.z = -0.22; g.add(nozzle);
    mesh(nozzle, new THREE.CylinderGeometry(0.2, 0.31, 0.8, 12), metal('#29303a'), 0, 0.47); ring(nozzle, 0.23, 0.055, metal('#acb5bd'), 0.83);
    const f = flame(nozzle); f.group.position.y = 0.8; cannons.push({ g, f });
  }
  // A physical truss is the source of the finale's falling sparks.
  let truss = null;
  if (withCurtain) {
    truss = new THREE.Group(); root.add(truss); truss.position.set(0, 11, -10.8);
    for (const y of [-0.2, 0.2]) mesh(truss, new THREE.BoxGeometry(22, 0.065, 0.065), metal('#566471'), 0, y);
    for (let i = -11; i <= 11; i++) { const bar = mesh(truss, new THREE.BoxGeometry(0.045, 0.55, 0.045), metal('#566471'), i, 0); bar.rotation.z = i % 2 ? 0.75 : -0.75; }
  }
  const count = Math.max(1, nums.length * particlesPerMortar(maxDensity) + (withCurtain ? Math.ceil(1100 * maxDensity) : 0));
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), sizes = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  const particleMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, uniforms: { pixelScale: { value: 800 } },
    vertexShader: 'attribute float size;varying vec3 c;uniform float pixelScale;void main(){c=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*pixelScale/-p.z,1.,38.);}',
    fragmentShader: 'varying vec3 c;void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*5.)*smoothstep(1.,.5,d);gl_FragColor=vec4(c,a);}' });
  const particles = new THREE.Points(geo, particleMat); particles.frustumCulled = false; root.add(particles);
  const light = new THREE.PointLight('#ff862b', 0, 38, 1.2); light.position.set(0, 6, 0); root.add(light);
  let used = 0;
  function dot(x, y, z, size, r, g, b) { if (used >= count) return; const k = used * 3; positions[k] = x; positions[k + 1] = y; positions[k + 2] = z; colors[k] = r; colors[k + 1] = g; colors[k + 2] = b; sizes[used++] = size; }
  function spark(x, y, z, age, life, seed, power = 1) { if (age < 0 || age > life) return; const f = 1 - age / life; dot(x, y, z, 0.065 * power, 2.5 * f, (0.45 + hash(seed) * 1.2) * f, 0.08 * f); }
  function burst(p, age, seed, s) {
    if (age < 0 || age > MORTAR_TIMING.burstLife) return;
    const amount = Math.floor(150 * s.density), fade = Math.pow(1 - age / MORTAR_TIMING.burstLife, 1.3);
    for (let j = 0; j < amount; j++) {
      const a = hash(seed + j * 7) * Math.PI * 2, yy = hash(seed + j * 11 + 7) * 2 - 1, rr = Math.sqrt(1 - yy * yy), speed = s.burst * (0.65 + hash(j + seed) * 0.5);
      const dx = Math.cos(a) * rr * speed, dy = yy * speed, dz = Math.sin(a) * rr * speed;
      const special = j % 4 === 0, red = s.palette === 'red' && special, violet = s.palette === 'electric' && special;
      for (let tail = 0; tail < 3; tail++) {
        const tt = Math.max(0, age - tail * 0.045), sp = (1 - Math.exp(-tt * 0.72)) * 1.45, decay = fade * (1 - tail * 0.24) * (hash(j * 13 + Math.floor(age * 15)) > 0.1 ? 1 : 0.4);
        dot(p.x + dx * sp, p.y + dy * sp - 0.48 * tt * tt, p.z + dz * sp, 0.22 - tail * 0.04, (violet ? 2.6 : 6) * decay, (red ? 0.18 : violet ? 0.6 : 2.9) * decay, (violet ? 6 : 0.32) * decay);
      }
    }
  }
  const isHit = (cue, num) => cue?.hit != null && (Array.isArray(cue.hit) ? cue.hit.includes(num) : cue.hit === num);

  /**
   * Pose everything for absolute time `t`. `s` = look (MORTAR_LOOK shape);
   * `cue` = the contract above, or null for Astra's own 26 s show timeline.
   * Returns the number of particles drawn.
   */
  function update(t, s = MORTAR_LOOK, cue = null) {
    used = 0; let impact = 0; if (truss) truss.visible = !!s.curtain;
    const T = MORTAR_TIMING;
    for (const m of mortars) {
      const wave = m.index < 5 ? 0 : 1, idx = wave ? m.index - 5 : m.index;
      const deploy = cue ? cue.deployedAt : (wave ? 11 : 1), fire = cue ? cue.fireAt[m.index] : (wave ? 14.5 : 5) + idx * s.stagger, end = cue ? cue.endAt : (wave ? 22 : 10);
      const open = smooth((t - deploy) / T.petalsOpen) * (1 - smooth((t - end) / T.petalsClose));
      m.g.visible = !!s.mortars && t >= deploy && t < end + T.petalsClose;
      const a = t - fire, recoil = a >= 0 && a < T.recoil ? Math.sin(a / T.recoil * Math.PI) * 0.24 : 0;
      m.barrel.position.y = -0.9 + (smooth((t - deploy - T.barrelRiseAt) / T.barrelRise) * (1 - smooth((t - end) / T.barrelLower))) * 0.98 - recoil;
      const hit = isHit(cue, m.num), struck = hit && a >= 0 ? smooth((a - T.struckAt) / T.struckOver) : 0;
      m.barrel.position.y -= 0.95 * struck;
      for (const p of m.petals) p.rotation.x = open * 1.65 * (1 - struck);
      m.exhaust.group.position.y = 0.6 - 0.4 * struck;
      m.warning.visible = !!s.guides; m.warning.material.opacity = open * (a < 0 ? 0.45 + 0.3 * Math.sin(t * 8) : 0.8);
      m.bore.material.opacity = open * (0.45 + 0.3 * Math.sin(t * 9));
      const firing = a >= 0 ? Math.exp(-a * 4) : 0, burn = a >= 0 ? smooth(a * 4) * (1 - smooth((t - end + 1) / 1.5)) * 0.42 : 0;
      m.exhaust.uniforms.time.value = t + m.index; m.exhaust.uniforms.power.value = Math.min(1, firing + burn);
      m.exhaust.group.scale.set(s.width * (0.9 + firing * 0.5), (0.9 + firing * 5) * (s.column ?? 1), s.width * (0.9 + firing * 0.5));
      m.exhaust.group.visible = (s.column ?? 1) > 0.01;
      // ⭐ THE OVERRIDE, AFTER THE REWRITE: a standee's weight presses a struck
      // barrel down from CONTACT (her own lowering only starts after the bang,
      // which would clip it up through the piece standing on it).
      const touched = hit ? cue?.contact?.[m.num] : undefined;
      if (touched != null && t >= touched && m.barrel.position.y > -0.87) {
        m.barrel.position.y += (-0.87 - m.barrel.position.y) * smooth((t - touched) / T.contactSink);
      }
      if (s.mortars) impact += firing;
      const origin = point(m.num, 1.15), flight = T.flight, drift = new THREE.Vector3((hash(m.index + 23) - 0.5) * 2, 0, (hash(m.index + 34) - 0.5) * 2), height = 8 + hash(m.index + 17) * 3;
      if (s.fireworks && a >= 0 && a < flight + 0.55) {
        for (let j = 0; j < Math.floor(65 * s.density); j++) {
          const tail = j * 0.009, tt = a - tail; if (tt < 0 || tt > flight) continue;
          const u = tt / flight; dot(origin.x + drift.x * u + (hash(j) - 0.5) * 0.08, origin.y + height * u, origin.z + drift.z * u, 0.15 * (1 - j / 90), 3, 1.5, 0.3);
        }
      }
      if (s.fireworks) burst(origin.clone().add(drift).setY(origin.y + height), a - flight, m.index * 331, s);
      if (s.mortars && a >= 0 && t < end) {
        for (let j = 0; j < Math.floor(30 * s.density); j++) {
          const age = (a + hash(j + 17) * 2) % 1.7, angle = hash(j * 7 + m.index) * Math.PI * 2, speed = 0.2 + hash(j + 4) * 1.4;
          spark(origin.x + Math.cos(angle) * age * speed, origin.y + age * 3 - age * age * 2, origin.z + Math.sin(angle) * age * speed, age, 1.7, j, 0.9);
        }
      }
    }
    cannons.forEach(({ g, f }, i) => {
      g.visible = !!s.cannons; const first = (cue ? cue.showAt : 5) + i * 0.105, final = (cue ? Infinity : 14.5) + i * 0.06;
      const pulse = start => (t < start ? 0 : Math.max(0, 1 - (t - start) / 1.15));
      const chase = !cue && t > 3.5 && t < 14.5 ? Math.pow(Math.max(0, Math.sin(t * 3 - i * 0.8)), 14) * 0.42 : 0;
      const strength = Math.max(chase, pulse(first), pulse(final), pulse(final + 1.8));
      f.uniforms.time.value = t + i * 0.47; f.uniforms.power.value = strength;
      f.group.scale.set(1.4 * s.width, s.height * (0.25 + 0.75 * strength), 1.4 * s.width);
      if (s.cannons) impact += strength * 0.25;
    });
    const curtainAt = cue ? cue.showAt + 0.9 : 15.4;
    if (truss && s.curtain && t >= curtainAt && t < curtainAt + 6.6) {
      for (let j = 0; j < Math.floor(1100 * s.density); j++) {
        const start = curtainAt + hash(j + 128) * 3.2, age = t - start; if (age < 0 || age > 3.1) continue;
        const x = (hash(j * 7 + 3) - 0.5) * 22, y = 10.9 - 0.7 * age - 1.45 * age * age, z = -10.8 + Math.sin(j) * age * 0.2;
        if (y > 0.2) spark(x, y, z, age, 3.1, j, 0.8);
      }
    }
    light.intensity = impact * 9; geo.setDrawRange(0, used); for (const attr of Object.values(geo.attributes)) attr.needsUpdate = true;
    return used;
  }

  /** When this set is entirely gone from view (all retracted), for a caller that pools sets. */
  const doneAt = cue => (cue && Number.isFinite(cue.endAt) ? cue.endAt + MORTAR_TIMING.petalsClose : Infinity);

  function dispose() {
    parent.remove(root);
    const gs = new Set(), ms = new Set();
    root.traverse(o => { if (o.geometry) gs.add(o.geometry); if (o.material) ms.add(o.material); });
    gs.forEach(g => g.dispose()); ms.forEach(m => m.dispose());
  }

  return {
    root, mortars, mortarByHex, cannons, truss, light, particleCount: count,
    update, doneAt, dispose,
    resize: h => { particleMat.uniforms.pixelScale.value = h; },
    focus: () => point(nums[0], 0.5),
  };
}
