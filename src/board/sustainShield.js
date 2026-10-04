import * as THREE from 'three';
import { createSpiralGlitter, createHelixStations, SONIC_GLITTER } from './sonicGlitter.js';
import { DAMAGE_DEFAULTS, normalizeDamage, damageVisibility, createDamageEffects } from './sustainDamage.js';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const fract = n => n - Math.floor(n);
// Alex's complete dial-in, 2026-10-04. Damage controls are a separate study.
export const DEFAULTS = Object.freeze({
  width: 2.9, height: 3.6, hexness: .83, rounding: .72, dome: .13,
  rim: .026, rings: 8, ringLight: .6, field: .21,
  coils: 3.3, turns: .5, strands: 3, spread: .115,
  density: 2600, size: 2.2, brightness: .8, twinkle: .85,
  iridescence: 1, filament: .14, spin: .14, flow: 0,
  breath: .025, pulse: .32, strength: .8, hue: 280,
});
export const LIMITS = Object.freeze({
  width: [1.5, 4.8], height: [2.4, 5.8], hexness: [0, 1], rounding: [0, 1], dome: [0, 1.4],
  rim: [.004, .06], rings: [3, 16], ringLight: [0, 1.2], field: [0, .5],
  coils: [.5, 4], turns: [.5, 8], strands: [1, 4], spread: [.025, .3],
  density: [200, 6000], size: [1, 5], brightness: [0, 1.5], twinkle: [0, 1],
  iridescence: [0, 1], filament: [0, .25], spin: [-.3, .3], flow: [-.25, .25],
  breath: [0, .1], pulse: [0, 1], strength: [.1, 1], hue: [0, 360],
});
export const PRESETS = Object.freeze({
  'Your shape': DEFAULTS,
  'Soft oval': { ...DEFAULTS, width: 3.1, height: 4.4, hexness: .3, rounding: 1, dome: .68, rings: 11, spread: .19, breath: .045 },
  'Cut crystal': { ...DEFAULTS, width: 3.2, height: 3.9, hexness: 1, rounding: .16, dome: .24, rings: 7, rim: .025, coils: 1.7, breath: .012 },
});
export function normalizeSettings(values = {}) {
  return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => {
    const n = Number(values?.[key] ?? fallback);
    const value = Number.isFinite(n) ? clamp(n, ...LIMITS[key]) : fallback;
    return [key, ['rings', 'strands', 'density'].includes(key) ? Math.round(value) : value];
  }));
}

// Six straight sides joined by quadratic corners. The ellipse blend follows
// the same rays, so every nested ring stays inside the convex outer contour.
const vertices = Array.from({ length: 6 }, (_, i) => {
  const a = Math.PI / 2 + i * TAU / 6;
  return new THREE.Vector2(Math.cos(a) / Math.cos(Math.PI / 6), Math.sin(a));
});
export function contour(u, s, target = new THREE.Vector3()) {
  const p = fract(u) * 6, k = Math.floor(p), f = p - k;
  const prev = vertices[(k + 5) % 6], v = vertices[k], next = vertices[(k + 1) % 6];
  const cut = .5 * s.rounding;
  let x, y;
  if (f < .5) {
    const t = f * 2, a = (1 - t) ** 2, b = 2 * t * (1 - t), c = t * t;
    x = a * mix(v.x, prev.x, cut) + b * v.x + c * mix(v.x, next.x, cut);
    y = a * mix(v.y, prev.y, cut) + b * v.y + c * mix(v.y, next.y, cut);
  } else {
    const t = (f - .5) * 2;
    x = mix(mix(v.x, next.x, cut), mix(next.x, v.x, cut), t);
    y = mix(mix(v.y, next.y, cut), mix(next.y, v.y, cut), t);
  }
  y /= 1 - cut * .25; // Keep the height lever literal as corners soften.
  const length = Math.hypot(x, y);
  return target.set(mix(x / length, x, s.hexness) * s.width / 2,
    mix(y / length, y, s.hexness) * s.height / 2, 0);
}
export function surface(u, radius, s, target = new THREE.Vector3()) {
  contour(u, s, target).multiplyScalar(radius);
  target.z = s.dome * (1 - radius * radius);
  return target;
}

const SEGMENTS = 192;
function ribbon() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((SEGMENTS + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage));
  const indices = [];
  for (let i = 0; i < SEGMENTS; i++) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  geometry.setIndex(indices);
  return geometry;
}
const point = new THREE.Vector3();
function writeRibbon(geometry, s, radius, width, lift = 0, state = null, damage = DAMAGE_DEFAULTS) {
  const p = geometry.attributes.position;
  for (let i = 0; i <= SEGMENTS; i++) for (let side = 0; side < 2; side++) {
    const mask = state ? damageVisibility(i / SEGMENTS, radius, state, damage) : 1;
    surface(i / SEGMENTS, radius + (side - .5) * width * mask, s, point);
    p.setXYZ(i * 2 + side, point.x, point.y, point.z + lift);
  }
  p.needsUpdate = true;
}
function material(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, opacity, transparent: true, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
}
export function createSustainShield() {
  const group = new THREE.Group(); group.name = 'Sustain living oval hex';
  const shell = new THREE.Group(); shell.name = 'Sonic shield'; group.add(shell);
  const faceGeometry = new THREE.BufferGeometry();
  const facePositions = [], uv = [], indices = [];
  const radialSegments = 24;
  for (let row = 0; row <= radialSegments; row++) for (let i = 0; i <= SEGMENTS; i++) {
    facePositions.push(0, 0, 0); uv.push(i / SEGMENTS, row / radialSegments);
    if (row < radialSegments && i < SEGMENTS) {
      const a = row * (SEGMENTS + 1) + i, b = a + SEGMENTS + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  faceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(facePositions, 3));
  faceGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); faceGeometry.setIndex(indices);
  const faceMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { time: { value: 0 }, opacity: { value: .12 }, tint: { value: new THREE.Color() }, pulse: { value: .3 }, hit: { value: -1 },
      woundCount: { value: 0 }, wounds: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, fray: { value: .7 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 tint; uniform float time, opacity, pulse, hit, fray;
      uniform int woundCount; uniform vec4 wounds[16];
      void main(){
        float r=vUv.y;
        float rings=pow(.5+.5*cos(r*36.-time*2.),12.);
        float sweep=pow(.5+.5*cos(vUv.x*6.28318-time*.65-r*7.),6.);
        float edge=pow(r,16.);
        float ripple=hit<0.?0.:exp(-pow((r-hit*1.7)*15.,2.))*exp(-hit*2.);
        float alpha=opacity*(.18+edge*.7+rings*.2*pulse+sweep*.3*pulse)+ripple*.3;
        float mask=1.;
        for(int i=0;i<16;i++){
          if(i>=woundCount) break;
          vec4 w=wounds[i];
          float du=abs(vUv.x-w.x); du=min(du,1.-du);
          float hole=1.-smoothstep(.04,.11+w.z*.18,length(vec2(du*5.,r-w.y)));
          float seam=r>w.y ? 1.-smoothstep(0.,.006+w.z*.021,du) : 0.;
          mask*=1.-clamp(max(hole,seam)*w.w*fray*1.65,0.,1.);
        }
        gl_FragColor=vec4(mix(tint,vec3(.85,.95,1.),edge*.45+ripple*.3),alpha*mask);
      }`,
  });
  const face = new THREE.Mesh(faceGeometry, faceMaterial); face.frustumCulled = false; face.name = 'Sonic shield field'; shell.add(face);
  const rim = new THREE.Mesh(ribbon(), material('#bba4ff')); rim.frustumCulled = false; shell.add(rim);
  const halo = new THREE.Mesh(ribbon(), material('#9773ff', .12)); halo.frustumCulled = false; shell.add(halo);
  const rings = Array.from({ length: LIMITS.rings[1] }, () => {
    const m = new THREE.Mesh(ribbon(), material('#bba4ff')); m.frustumCulled = false; shell.add(m); return m;
  });
  const ripple = new THREE.Mesh(ribbon(), material('#d4eeff')); ripple.frustumCulled = false; shell.add(ripple);
  const glitter = createSpiralGlitter(null, { capacity: LIMITS.density[1] });
  glitter.group.name = 'Sustain inner spiral glitter';
  shell.add(glitter.group);
  const debris = createDamageEffects(glitter.points.material, surface); group.add(debris.group);
  const stations = createHelixStations(240);
  const color = new THREE.Color(), frame = new THREE.Vector3();
  let shapeKey = '', disposed = false;
  function update(time, values = DEFAULTS, { state = null, layer = 'combined', damage = DAMAGE_DEFAULTS, strengthScale = 1, reduced = false, pixelRatio = 1 } = {}) {
    if (disposed) return null;
    damage = normalizeDamage(damage);
    const s = normalizeSettings(values);
    state ??= { time, build: 1, health: 1, events: [], hitAge: -1, breakAge: -1 };
    const t = reduced ? 0 : state.time;
    const build = reduced ? 1 : state.build;
    const hitAge = reduced ? -1 : state.hitAge;
    const kick = hitAge < 0 ? 0 : Math.exp(-hitAge * 5) * Math.sin(hitAge * 22);
    const breath = 1 + s.breath * Math.sin(t * 1.5) * (1 + .4 * (1 - state.health));
    shell.scale.set(breath * (.12 + .88 * build), breath * (.05 + .95 * build), 1);
    shell.position.z = -.12 * kick;
    const breakFade = state.breakAge < 0 ? 1 : Math.max(0, 1 - state.breakAge / .2);
    shell.visible = build > .001 && (state.health > 0 || (!reduced && breakFade > 0));
    color.setHSL(s.hue / 360, .65, .7);
    const strength = (.3 + .7 * s.strength) * strengthScale * (.18 + .82 * state.health) * breakFade;
    const key = [s.width, s.height, s.hexness, s.rounding, s.dome, s.rim].join('|');
    if (shapeKey !== key) {
      shapeKey = key;
      const p = faceGeometry.attributes.position;
      for (let row = 0; row <= radialSegments; row++) for (let i = 0; i <= SEGMENTS; i++) {
        surface(i / SEGMENTS, row / radialSegments, s, point);
        p.setXYZ(row * (SEGMENTS + 1) + i, point.x, point.y, point.z);
      }
      p.needsUpdate = true;
    }
    writeRibbon(rim.geometry, s, 1, s.rim, .008, state, damage);
    writeRibbon(halo.geometry, s, 1, s.rim * 5, .004, state, damage);
    face.visible = rim.visible = halo.visible = layer !== 'glitter';
    faceMaterial.uniforms.time.value = t;
    faceMaterial.uniforms.opacity.value = s.field * strength * build;
    faceMaterial.uniforms.tint.value.copy(color);
    faceMaterial.uniforms.pulse.value = s.pulse;
    faceMaterial.uniforms.hit.value = hitAge;
    const wounds = state.events.filter(event => !event.breaking).slice(-16);
    faceMaterial.uniforms.woundCount.value = wounds.length;
    faceMaterial.uniforms.fray.value = damage.fray;
    wounds.forEach((event, i) => faceMaterial.uniforms.wounds.value[i].set(event.u, event.r, 1 - event.after, THREE.MathUtils.smoothstep(event.age, 0, .3)));
    rim.material.color.copy(color).lerp(new THREE.Color('#e4eaff'), .35);
    rim.material.opacity = strength * build * (.7 + .2 * s.pulse * Math.sin(t * 1.5));
    halo.material.color.copy(color); halo.material.opacity = .13 * strength * build;
    rings.forEach((ring, i) => {
      ring.visible = i < s.rings && layer !== 'glitter';
      if (!ring.visible) return;
      const u = (i + 1) / (s.rings + 1);
      const radius = .08 + .88 * u + (.012 * s.pulse + .018 * (1 - state.health)) * Math.sin(t * 1.7 - u * TAU);
      writeRibbon(ring.geometry, s, radius, .004 + s.rim * .14, .009, state, damage);
      ring.material.color.copy(color).lerp(new THREE.Color('#abedfa'), u * .45);
      ring.material.opacity = s.ringLight * strength * build * (.2 + .45 * (1 - u) + s.pulse * .35 * (.5 + .5 * Math.sin(t * 2 - u * TAU)));
    });
    const spiralRotation = t * s.spin;
    stations.forEach((station, i) => {
      const u = i / (stations.length - 1), radius = .09 + .83 * u;
      surface(u * s.coils + spiralRotation, radius, s, station.center);
      contour(u * s.coils + spiralRotation, s, frame);
      frame.normalize();
      station.across.copy(frame).setZ(-s.dome * radius * .45).normalize();
      station.up.set(0, 0, 1).addScaledVector(station.across, -station.across.z).normalize();
      station.radius = s.spread * Math.min(s.width, s.height) * (.25 + .75 * Math.sin(u * Math.PI) ** .5);
      station.center.z += .035;
    });
    glitter.points.material.uniforms.tint.value.copy(color).lerp(new THREE.Color('#baf5ff'), .3);
    glitter.spines.forEach(line => line.material.color.copy(color));
    glitter.update(t, { ...SONIC_GLITTER, turns: s.turns, strands: s.strands, density: Math.round(s.density * (.12 + .88 * state.health)), size: s.size,
      brightness: s.brightness, twinkle: s.twinkle, iridescence: s.iridescence, filament: s.filament,
      spin: s.spin, flow: s.flow }, { stations, enabled: layer !== 'rings', reduced, pixelRatio, opacity: strength * build });
    ripple.visible = layer !== 'glitter' && hitAge >= 0 && hitAge < .8;
    if (ripple.visible) {
      writeRibbon(ripple.geometry, s, clamp(hitAge * 1.7, .02, 1.05), .018 + hitAge * .025, .025);
      ripple.material.opacity = Math.exp(-hitAge * 3) * .85;
    }
    debris.update(state, s, damage, { layer, reduced, pixelRatio });
    return state;
  }
  return { group, shell, face, update, glitter, stations, debris,
    dispose() {
      if (disposed) return;
      disposed = true; glitter.dispose(); debris.dispose();
      group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
      group.clear(); group.removeFromParent();
    },
  };
}
