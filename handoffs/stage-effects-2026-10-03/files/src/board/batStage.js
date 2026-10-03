import * as THREE from 'three';

// A tiny stage prop built from geometry: scalloped wings, ears and ruby eyes.
export function createBatStage(parent, { pointFor, release }) {
  const root = new THREE.Group(); root.name = 'Stage bats'; parent.add(root);
  const live = new Map();
  let clock = 0;
  function model(key) {
    const container = new THREE.Group(); container.name = `${key}-prop`;
    const group = new THREE.Group(); group.name = key;
    const marker = new THREE.Group(); marker.name = `${key}-hex`;
    const rim = new THREE.Mesh(new THREE.RingGeometry(.82, .94, 6),
      new THREE.MeshBasicMaterial({ color: 0xd9b5ff, side: THREE.DoubleSide, depthWrite: false }));
    rim.rotation.x = -Math.PI / 2; marker.add(rim);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(.82, 6),
      new THREE.MeshBasicMaterial({ color: 0x9b55ed, transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = -.005; marker.add(fill);
    const dot = new THREE.Mesh(new THREE.RingGeometry(.11, .17, 20),
      new THREE.MeshBasicMaterial({ color: 0xf4ddff, side: THREE.DoubleSide, depthWrite: false }));
    dot.rotation.x = -Math.PI / 2; dot.position.y = .005; marker.add(dot);
    const tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: 0xd9b5ff, transparent: true, opacity: .65,
        dashSize: .12, gapSize: .1, depthWrite: false }));
    tether.name = `${key}-tether`;
    container.add(marker, tether, group); root.add(container);
    const skin = new THREE.MeshStandardMaterial({ color: 0x201329, roughness: .65,
      emissive: 0x6b2a99, emissiveIntensity: .35, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 8), skin);
    body.scale.set(1, 1.5, .7); group.add(body);
    const wings = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.x = side * .1;
      const shape = new THREE.Shape();
      shape.moveTo(0, .1); shape.quadraticCurveTo(.42, .48, .95, .18);
      shape.lineTo(.78, -.18); shape.quadraticCurveTo(.55, .02, .52, -.3);
      shape.quadraticCurveTo(.3, -.08, .25, -.34); shape.lineTo(0, -.08);
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), skin); wing.scale.x = side;
      pivot.add(wing); group.add(pivot); wings.push({ pivot, side });
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.08, .25, 3), skin);
      ear.position.set(side * .105, .3, 0); ear.rotation.z = -side * .22; group.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xff445c }));
      eye.position.set(side * .07, .12, .13); group.add(eye);
    }
    return { container, marker, tether, group, wings, from: new THREE.Vector3(), to: new THREE.Vector3(), start: clock, flight: -1 };
  }
  return {
    update(bats = []) {
      const keys = new Set(bats.map(b => b.key));
      for (const [key, b] of live) if (!keys.has(key)) { root.remove(b.container); release(b.container); live.delete(key); }
      for (const bat of bats) {
        const p = pointFor(bat.num, 1.9); if (!p) continue;
        let b = live.get(bat.key);
        if (!b) { b = model(bat.key); live.set(bat.key, b); b.group.position.copy(p); b.to.copy(p); }
        // This marker follows the RULE hex immediately, even while the bat
        // itself is still flying there. It never bobs or drifts with the prop.
        b.marker.position.copy(pointFor(bat.num, .24));
        b.marker.userData.hexNum = bat.num;
        if (b.flight !== bat.flight || !b.to.equals(p)) {
          b.from.copy(b.group.position); b.to.copy(p); b.start = clock; b.flight = bat.flight;
        }
      }
    },
    tick(time, { reduced = false } = {}) {
      clock = time;
      let index = 0;
      for (const b of live.values()) {
        const phase = time * 15 + index++ * 1.7;
        const u = reduced ? 1 : Math.min(1, Math.max(0, (time - b.start) / 1.2));
        b.group.position.lerpVectors(b.from, b.to, u * u * (3 - 2 * u));
        if (!reduced) b.group.position.y += Math.sin(u * Math.PI) * .65 + Math.sin(phase * .3) * .09;
        for (const { pivot, side } of b.wings) pivot.rotation.y = reduced ? side * .15 : Math.sin(phase) * side * .7;
        b.group.rotation.z = reduced ? 0 : Math.sin(phase * .24) * .08;
        const endpoints = b.tether.geometry.attributes.position;
        endpoints.setXYZ(0, b.marker.position.x, b.marker.position.y, b.marker.position.z);
        endpoints.setXYZ(1, b.group.position.x, b.group.position.y, b.group.position.z);
        endpoints.needsUpdate = true;
        b.tether.geometry.computeBoundingSphere();
        b.tether.computeLineDistances();
      }
    },
    get count() { return live.size; },
    dispose() { for (const b of live.values()) release(b.container); live.clear(); parent.remove(root); },
  };
}
