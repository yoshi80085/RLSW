import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const random = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = n => { n = clamp(n, 0, 1); return n * n * (3 - 2 * n); };
export const DAMAGE_DEFAULTS = Object.freeze({
  hits: 4, interval: 2.2, shed: 1, throw: 1, linger: 1.8,
  fray: .7, breakGlitter: 1.2, breakScatter: 1.1, fragments: 28,
});
export const DAMAGE_LIMITS = Object.freeze({
  hits: [2, 8], interval: [1, 3.5], shed: [0, 2.5], throw: [.2, 2.5], linger: [.5, 3],
  fray: [0, 1], breakGlitter: [0, 2.5], breakScatter: [.2, 2.5], fragments: [0, 48],
});
export function normalizeDamage(values = {}) {
  return Object.fromEntries(Object.entries(DAMAGE_DEFAULTS).map(([key, fallback]) => {
    const n = Number(values?.[key] ?? fallback);
    const value = Number.isFinite(n) ? clamp(n, ...DAMAGE_LIMITS[key]) : fallback;
    return [key, key === 'hits' || key === 'fragments' ? Math.round(value) : value];
  }));
}
// Each impact opens a small wound and a ragged outward seam. The same mask is
// used on ring ribbons and the field, so the shield loses pieces, not just light.
export function damageVisibility(u, radius, state, d) {
  let visible = 1;
  for (const hit of state.events) {
    if (hit.breaking) continue;
    const wear = 1 - hit.after, growth = smooth(hit.age / .3) * d.fray;
    let du = Math.abs(u - hit.u); du = Math.min(du, 1 - du);
    const hole = 1 - smooth((Math.hypot(du * 5, radius - hit.r) - .04) / (.07 + wear * .18));
    const seam = radius > hit.r ? (1 - smooth(du / (.006 + wear * .021))) : 0;
    visible *= 1 - clamp(Math.max(hole, seam) * growth * 1.65, 0, 1);
  }
  return Math.max(0, visible);
}

export function createDamageEffects(sourceMaterial, surface) {
  const group = new THREE.Group(); group.name = 'Sustain shed glitter and broken rings';
  const capacity = 16000;
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.Float32BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const fades = new THREE.Float32BufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positions); geometry.setAttribute('fade', fades);
  geometry.setAttribute('seed', new THREE.Float32BufferAttribute(Array.from({ length: capacity }, (_, i) => random(i + 907)), 1));
  geometry.setDrawRange(0, 0);
  const material = sourceMaterial.clone();
  const particles = new THREE.Points(geometry, material); particles.frustumCulled = false; particles.renderOrder = 150; group.add(particles);
  const shards = Array.from({ length: DAMAGE_LIMITS.fragments[1] }, () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(13 * 6), 3));
    const index = [];
    for (let i = 0; i < 12; i++) { const k = i * 2; index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#dfbfff', transparent: true,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
    mesh.frustumCulled = false; mesh.renderOrder = 149; mesh.visible = false; group.add(mesh); return mesh;
  });
  const origin = new THREE.Vector3(), point = new THREE.Vector3();
  let disposed = false;
  return { group, particles, shards,
    update(state, s, values, { layer = 'combined', reduced = false, pixelRatio = 1 } = {}) {
      if (disposed) return;
      const d = normalizeDamage(values);
      group.visible = !reduced;
      particles.visible = layer !== 'rings';
      let count = 0;
      if (!reduced && particles.visible) for (const event of state.events) {
        const life = d.linger * (event.breaking ? 1.4 : 1);
        if (event.age > life * 1.12) continue;
        const lostEnergy = event.amount == null ? 1 : clamp(.3 + event.amount * 2.8, .3, 1.8);
        const number = Math.round(event.breaking ? 2600 * d.breakGlitter : 650 * d.shed * lostEnergy);
        const breath = 1 + s.breath * Math.sin(event.at * 1.5);
        for (let i = 0; i < number && count < capacity; i++) {
          const seed = i + event.index * 8191;
          const a = random(seed + 5), b = random(seed + 17), c = random(seed + 63);
          const age = event.age, ttl = life * (.65 + .47 * c);
          if (age > ttl) continue;
          const u = event.breaking ? a : (event.u + (a - .5) * .13 + 1) % 1;
          const radius = event.breaking ? .16 + .84 * Math.sqrt(b) : clamp(event.r + (b - .5) * .27, .05, 1);
          surface(u, radius, s, origin);
          origin.x *= breath; origin.y *= breath;
          const angle = random(seed + 113) * TAU;
          const velocity = (.35 + random(seed + 193) * 1.65) * (event.breaking ? d.breakScatter : d.throw);
          const vx = event.breaking ? origin.x / s.width * 2 * velocity + Math.cos(angle) * .3 : Math.cos(angle) * velocity * .7;
          const vy = event.breaking ? origin.y / s.height * 2 * velocity + .2 : Math.sin(angle) * velocity * .6 + .35;
          // Positive Z throws energy off the attacking face, away from the Spirit.
          positions.setXYZ(count, origin.x + vx * age, origin.y + vy * age - .32 * age * age,
            origin.z + .045 + velocity * (.45 + c * .8) * age);
          fades.setX(count, (1 - age / ttl) ** 1.25 * (event.breaking ? 1.15 : .95)); count++;
        }
      }
      positions.needsUpdate = fades.needsUpdate = true; geometry.setDrawRange(0, count);
      material.uniforms.time.value = state.time;
      material.uniforms.size.value = s.size * 1.15;
      material.uniforms.amount.value = s.brightness * 1.2;
      material.uniforms.twinkle.value = s.twinkle;
      material.uniforms.iridescence.value = s.iridescence;
      material.uniforms.pixelRatio.value = pixelRatio;
      material.uniforms.tint.value.setHSL(s.hue / 360, .5, .8);
      const age = state.breakAge;
      shards.forEach((shard, i) => {
        shard.visible = !reduced && layer !== 'glitter' && age >= 0 && age < d.linger * 1.15 && i < d.fragments;
        if (!shard.visible) return;
        const u = i / Math.max(1, d.fragments), radius = i % 3 === 0 ? 1 : .3 + .65 * random(i + 83);
        const arc = .018 + random(i + 39) * .025;
        surface(u, radius, s, origin);
        const attr = shard.geometry.attributes.position;
        for (let j = 0; j <= 12; j++) for (let side = 0; side < 2; side++) {
          surface((u + (j / 12 - .5) * arc + 1) % 1, radius + (side - .5) * s.rim * .7, s, point);
          point.sub(origin); attr.setXYZ(j * 2 + side, point.x, point.y, point.z);
        }
        attr.needsUpdate = true;
        const velocity = (.5 + random(i + 147) * 1.3) * d.breakScatter;
        shard.position.set(origin.x * (1 + velocity * age), origin.y * (1 + velocity * age) - .28 * age * age,
          origin.z + velocity * age * .6);
        shard.rotation.set(age * (random(i + 97) - .5) * 4, age * (random(i + 12) - .5) * 4, age * (random(i + 78) - .5) * 2);
        shard.material.color.setHSL(s.hue / 360, .4, .8);
        shard.material.opacity = Math.max(0, 1 - age / (d.linger * 1.15)) ** 1.5 * .8;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true; group.removeFromParent();
      group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); group.clear();
    },
  };
}
