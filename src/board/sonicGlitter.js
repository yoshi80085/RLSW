import * as THREE from 'three';

const TAU = Math.PI * 2;
const fract = x => x - Math.floor(x);
const random = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// Alex's approved Sonic soundform, 2026-10-03. Shared by Sonic, Riff Off,
// and the ring-free Thrash amp feed. Keep these exact dial-in values together.
export const SONIC_GLITTER = Object.freeze({
  turns: 4.5, strands: 3, radius: 0.63, spread: 0.23,
  density: 2000, size: 3, brightness: 0.8, twinkle: 0.85,
  spin: 0.19, flow: 0.06, filament: 0.025, iridescence: 0.8,
  ringOpacity: 1, coreOpacity: 1,
});
export const SONIC_WAVE = Object.freeze({ ringGap: 0.59, beamRadius: 0.66 });
const DEFAULTS = SONIC_GLITTER;

export const LIMITS = Object.freeze({
  turns: [0.5, 8], strands: [1, 4], radius: [0.1, 0.94], spread: [0, 0.24],
  density: [200, 7000], size: [1, 5], brightness: [0, 1.5], twinkle: [0, 1],
  spin: [-0.6, 0.6], flow: [-0.5, 0.5], filament: [0, 0.4], iridescence: [0, 1],
  ringOpacity: [0, 1.5], coreOpacity: [0, 1.5],
});

export function normalizeSettings(values = {}) {
  return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => {
    const value = Number(values?.[key] ?? fallback);
    const [min, max] = LIMITS[key];
    const valid = Number.isFinite(value) ? THREE.MathUtils.clamp(value, min, max) : fallback;
    return [key, key === 'strands' || key === 'density' ? Math.round(valid) : valid];
  }));
}

// Read the actual deformed ring mesh. The preview does not approximate the
// game's path, breathing, radius, tail or compression with a second solver.
// Both particle spread and the faint helix spine fit inside its inner edge.
export function readRingStations(mesh, pool = [], stations = []) {
  const position = mesh.geometry.attributes.position;
  const index = mesh.geometry.index.array;
  let segments = 1;
  while (segments * 6 < index.length && index[segments * 6] === segments * 2) segments++;
  const stride = (segments + 1) * 2;
  stations.length = 0;
  for (let slot = 0; slot < position.count / stride; slot++) {
    const base = slot * stride;
    const station = pool[slot] ??= { slot, center: new THREE.Vector3(), across: new THREE.Vector3(), up: new THREE.Vector3(), radius: 0 };
    const { center, across, up } = station;
    center.set(0, 0, 0);
    for (let i = 0; i < segments; i++) {
      const k = base + i * 2;
      center.x += position.getX(k); center.y += position.getY(k); center.z += position.getZ(k);
    }
    center.divideScalar(segments);
    across.fromBufferAttribute(position, base).sub(center);
    const radius = across.length();
    if (radius < 0.0001) continue; // Collapsed, unlit station.
    across.divideScalar(radius);
    const angle = TAU / segments;
    up.fromBufferAttribute(position, base + 2).sub(center)
      .addScaledVector(across, -radius * Math.cos(angle)).normalize();
    station.radius = radius;
    stations.push(station);
  }
  return stations;
}

function sample(stations, u, angle, radial, result) {
  const along = u * (stations.length - 1);
  const index = Math.min(stations.length - 2, Math.floor(along));
  const a = stations[index], b = stations[index + 1], t = along - index;
  const radius = THREE.MathUtils.lerp(a.radius, b.radius, t) * radial;
  // Interpolating the frame vectors without renormalizing can only shrink the
  // radius, which keeps the spiral inside the interpolated ring aperture.
  result.copy(a.center).lerp(b.center, t);
  result.addScaledVector(a.across, radius * Math.cos(angle) * (1 - t));
  result.addScaledVector(b.across, radius * Math.cos(angle) * t);
  result.addScaledVector(a.up, radius * Math.sin(angle) * (1 - t));
  result.addScaledVector(b.up, radius * Math.sin(angle) * t);
  return result;
}

export function createSpiralGlitter(ringMesh = null, { capacity = DEFAULTS.density, tint = null } = {}) {
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.Float32BufferAttribute(new Float32Array(capacity * 3), 3);
  const seeds = new THREE.Float32BufferAttribute(Array.from({ length: capacity }, (_, i) => random(i + 1)), 1);
  const fades = new THREE.Float32BufferAttribute(new Float32Array(capacity), 1);
  const jitterAngle = Float32Array.from({ length: capacity }, (_, i) => random(i + 12) - .5);
  const jitterRadius = Float32Array.from({ length: capacity }, (_, i) => random(i + 47) - .5);
  positions.setUsage(THREE.DynamicDrawUsage);
  fades.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('seed', seeds);
  geometry.setAttribute('fade', fades);
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: {
      time: { value: 0 }, size: { value: DEFAULTS.size }, amount: { value: DEFAULTS.brightness },
      twinkle: { value: DEFAULTS.twinkle }, iridescence: { value: DEFAULTS.iridescence }, pixelRatio: { value: 1 },
      tint: { value: tint ? new THREE.Color(tint) : new THREE.Color(.76, .96, 1) },
    },
    vertexShader: `
      attribute float seed;
      attribute float fade;
      uniform float time, size, twinkle, pixelRatio;
      varying float vSeed, vLight, vFade;
      void main() {
        vSeed = seed; vFade = fade;
        float pulse = pow(.5 + .5 * sin(time * (2. + seed * 3.) + seed * 93.), 7.);
        vLight = mix(.7, .18 + pulse * 1.8, twinkle);
        vec4 view = modelViewMatrix * vec4(position, 1.);
        float hero = seed > .96 ? 1.75 : 1.;
        gl_PointSize = clamp(size * pixelRatio * hero * (1. + vLight * .8) * clamp(12. / -view.z, .4, 2.5), 1., 42.);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform float amount, iridescence;
      uniform vec3 tint;
      varying float vSeed, vLight, vFade;
      void main() {
        vec2 p = abs(gl_PointCoord - .5) * 2.;
        float core = pow(max(0., 1. - length(p)), 2.);
        float star = pow(max(0., 1. - min(p.x, p.y) * 8.), 3.) * pow(max(0., 1. - max(p.x, p.y)), 1.4);
        vec3 prism = .65 + .35 * cos(6.28318 * (vSeed + vec3(0., .33, .67)));
        vec3 color = mix(tint, prism, iridescence);
        color = mix(color, vec3(1.), min(.6, vLight * .3));
        float alpha = (core * .55 + star * .65) * vLight * amount * vFade;
        if (alpha < .004) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
  const group = new THREE.Group();
  group.name = 'Sonic inner spiral glitter';
  group.visible = false;
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 148;
  group.add(points);
  const spines = Array.from({ length: 4 }, () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(240 * 3), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: tint ?? '#b8f1ff', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false,
    }));
    line.frustumCulled = false;
    line.renderOrder = 147;
    group.add(line);
    return line;
  });
  const position = new THREE.Vector3();
  const stationPool = [], sampledStations = [];
  let disposed = false;
  return {
    group, points, spines,
    update(time, settings = DEFAULTS, { enabled = true, reduced = false, pixelRatio = Math.min(2, globalThis.devicePixelRatio || 1), stations: suppliedStations = null, opacity = null } = {}) {
      if (disposed) return;
      if (!enabled) { group.visible = points.visible = false; geometry.setDrawRange(0, 0); return; }
      const s = normalizeSettings(settings);
      const stations = suppliedStations ?? (ringMesh ? readRingStations(ringMesh, stationPool, sampledStations) : []);
      const sourceVisible = suppliedStations ? true : ringMesh?.visible && ringMesh?.parent?.visible;
      group.visible = !!(enabled && sourceVisible && stations.length > 1);
      points.visible = group.visible;
      if (!group.visible) { geometry.setDrawRange(0, 0); return; }
      const t = reduced ? 0 : time;
      const alive = THREE.MathUtils.clamp(opacity ?? (ringMesh ? ringMesh.material.opacity / 0.3 : 1), 0, 1.5);
      const rotation = t * s.spin * TAU;
      const count = Math.min(capacity, s.density);
      for (let i = 0; i < count; i++) {
        const strand = i % s.strands;
        const u = fract(Math.floor(i / s.strands) / Math.ceil(count / s.strands) + t * s.flow);
        const angle = u * s.turns * TAU + rotation + strand * TAU / s.strands + jitterAngle[i] * s.spread * 2;
        const radial = THREE.MathUtils.clamp(s.radius + jitterRadius[i] * s.spread * 2, .02, .96);
        sample(stations, u, angle, radial, position);
        positions.setXYZ(i, position.x, position.y, position.z);
        fades.setX(i, Math.min(1, u * 14, (1 - u) * 14));
      }
      positions.needsUpdate = true;
      fades.needsUpdate = true;
      geometry.setDrawRange(0, count);
      material.uniforms.time.value = t;
      material.uniforms.size.value = s.size;
      material.uniforms.amount.value = s.brightness * alive;
      material.uniforms.twinkle.value = reduced ? 0 : s.twinkle;
      material.uniforms.iridescence.value = s.iridescence;
      material.uniforms.pixelRatio.value = pixelRatio;
      spines.forEach((line, strand) => {
        line.visible = strand < s.strands && s.filament > 0;
        if (!line.visible) return;
        const attr = line.geometry.attributes.position;
        for (let i = 0; i < attr.count; i++) {
          const u = i / (attr.count - 1);
          sample(stations, u, u * s.turns * TAU + rotation + strand * TAU / s.strands, s.radius, position);
          attr.setXYZ(i, position.x, position.y, position.z);
        }
        attr.needsUpdate = true;
        line.material.opacity = s.filament * alive * s.brightness;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
      group.clear();
    },
  };
}

// A ring-free aperture along any segment, used for Thrash and Sonic contact.
// Pool all stations/vectors so a live volley does not allocate per particle.
export function createHelixStations(count = 32) {
  return Array.from({ length: count }, () => ({ center: new THREE.Vector3(), across: new THREE.Vector3(), up: new THREE.Vector3(), radius: 0 }));
}
const stationDirection = new THREE.Vector3(), stationAcross = new THREE.Vector3(), stationUp = new THREE.Vector3();
const worldY = new THREE.Vector3(0, 1, 0), worldX = new THREE.Vector3(1, 0, 0);
export function writeHelixStations(stations, from, to, radius, taper = .9) {
  stationDirection.subVectors(to, from);
  if (stationDirection.lengthSq() < 1e-12) stationDirection.set(1, 0, 0);
  stationDirection.normalize();
  stationAcross.crossVectors(stationDirection, Math.abs(stationDirection.y) > .98 ? worldX : worldY).normalize();
  stationUp.crossVectors(stationAcross, stationDirection).normalize();
  stations.forEach((s, i) => {
    const u = i / (stations.length - 1);
    s.center.copy(from).lerp(to, u);
    s.across.copy(stationAcross); s.up.copy(stationUp);
    s.radius = radius * (1 - taper + taper * Math.sin(u * Math.PI) ** .6);
  });
  return stations;
}
