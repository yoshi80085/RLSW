import * as THREE from 'three';
import { HEX_BY_NUM } from './hexMap.js';

export const LASER_LOOK = Object.freeze({ colors: ['#ff458c', '#41dfff', '#ae7aff'], intensity: 1.4, width: 1.3, halo: 1.2 });
export function point(num, y = 0) { const h = HEX_BY_NUM[num]; return new THREE.Vector3((h.px - 3255) / 200, y, (h.py - 2415) / 200); }
const metal = color => new THREE.MeshStandardMaterial({ color, metalness: .7, roughness: .34 });
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
function mesh(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
export function createLaserPod(parent, position, toward) {
  const group = new THREE.Group(); group.position.copy(position); group.rotation.y = Math.atan2(toward.x - position.x, toward.z - position.z); parent.add(group);
  const moving = new THREE.Group(); group.add(moving);
  mesh(moving, new THREE.BoxGeometry(.76, .62, .68), metal('#3b4c60'), 0, .72);
  const thruster = mesh(moving, new THREE.TorusGeometry(.22, .035, 8, 24), glow('#77d8f2', .6), 0, .39);
  thruster.rotation.x = Math.PI / 2;
  for (const x of [-.53, .53]) mesh(moving, new THREE.BoxGeometry(.22, .045, .62), metal('#8198ac'), x, .52);
  for (const x of [-.42, .42]) mesh(moving, new THREE.BoxGeometry(.06, .4, .5), metal('#57697b'), x, .69);
  const ring = mesh(moving, new THREE.TorusGeometry(.225, .045, 8, 24), metal('#8294a5'), 0, .74, .354);
  ring.material.emissive.set('#516b86'); ring.material.emissiveIntensity = .15;
  const lens = mesh(moving, new THREE.CircleGeometry(.188, 24), glow('#ff458c'), 0, .74, .369);
  const left = mesh(moving, new THREE.BoxGeometry(.22, .42, .065), metal('#08111e'), -.11, .74, .41);
  const right = mesh(moving, new THREE.BoxGeometry(.22, .42, .065), metal('#08111e'), .11, .74, .41);
  const status = mesh(moving, new THREE.BoxGeometry(.18, .03, .02), glow('#ff458c'), 0, .49, .355);
  const navigation = [-.43, .43].map(x => mesh(moving, new THREE.BoxGeometry(.035, .07, .38), glow('#ff458c'), x, .84));
  for (let z = -.2; z <= .2; z += .1) mesh(moving, new THREE.BoxGeometry(.49, .012, .035), metal('#070d16'), 0, 1.037, z);
  return { group, moving, lens, left, right, status, thruster, navigation };
}

export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// Keep pair identities/colors, choosing the shortest assignment of new lanes
// and endpoint direction. Computed only when a pattern set is created.
export function matchLaserLayout(lines, previous = []) {
  const raw = (lines ?? []).slice(0, 3).filter(line => line?.length > 1 && line.every(n => HEX_BY_NUM[n])).map(hexes => {
    const a = point(hexes[0]), b = point(hexes.at(-1)), dir = b.clone().sub(a).normalize();
    return { hexes: [...hexes], a: a.addScaledVector(dir, -1.25), b: b.addScaledVector(dir, 1.25) };
  });
  if (!previous.length) return raw;
  const permutations = list => list.length ? list.flatMap((v, i) => permutations(list.filter((_, j) => j !== i)).map(tail => [v, ...tail])) : [[]];
  let best = raw, cost = Infinity;
  for (const order of permutations(raw)) for (let flips = 0; flips < (1 << raw.length); flips++) {
    const candidate = order.map((lane, j) => flips & (1 << j) ? { ...lane, a: lane.b, b: lane.a } : lane);
    const distance = candidate.reduce((n, lane, j) => n + (previous[j] ? lane.a.distanceTo(previous[j].a) + lane.b.distanceTo(previous[j].b) : 0), 0);
    if (distance < cost) { best = candidate; cost = distance; }
  }
  return best;
}

export function flightPose(from, to, progress, id) {
  const distance = from.distanceTo(to), route = THREE.MathUtils.smoothstep(progress, .15, .85), arc = Math.sin(Math.PI * route);
  const a = Math.atan2(from.z, from.x), delta = angleDelta(a, Math.atan2(to.z, to.x));
  const radius = Math.hypot(from.x, from.z) * (1 - route) + Math.hypot(to.x, to.z) * route + arc * Math.min(1, distance * .12) * (1 + id * .35);
  // Follow the rim instead of cutting through the centre. A small height offset
  // gives independently flying pods separate tracks, without leaving the view.
  const clearance = THREE.MathUtils.smoothstep(progress, 0, .15) * (1 - THREE.MathUtils.smoothstep(progress, .85, 1));
  return new THREE.Vector3(Math.cos(a + delta * route) * radius,
    from.y * (1 - route) + to.y * route + clearance * Math.min(1, distance) * (.8 + id * .5), Math.sin(a + delta * route) * radius);
}

export function createLaserLane(parent, lane, color, look = LASER_LOOK) {
  const group = new THREE.Group(); group.name = 'Laser lane'; parent.add(group);
  const dir = lane.b.clone().sub(lane.a).normalize();
  const start = lane.a.clone().addScaledVector(dir, .44), end = lane.b.clone().addScaledVector(dir, -.44);
  const length = start.distanceTo(end), mid = start.clone().lerp(end, .5);
  const beam = new THREE.Group(); beam.name = 'Laser light'; beam.position.copy(mid).setY(1.44);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); group.add(beam);
  const hue = new THREE.Color(color);
  const shells = [.025, .065, .15].map((r, i) => {
    const c = hue.clone(); if (i === 0) c.lerp(new THREE.Color('#fff4fb'), .58);
    const m = mesh(beam, new THREE.CylinderGeometry(r * look.width, r * look.width, length, 10, 1, true), glow(c.multiplyScalar(look.intensity * (i === 0 ? 1.2 : 1))));
    return m;
  });
  const tracks = lane.hexes.map(n => {
    const m = mesh(group, new THREE.RingGeometry(.79, .83, 6), glow(color, .45));
    m.name = `Laser hazard hex ${n}`; m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 6; m.position.copy(point(n, .19)); return m;
  });
  const spill = mesh(group, new THREE.PlaneGeometry(.3, length), glow(color, .1 * look.intensity));
  spill.rotation.x = -Math.PI / 2; spill.rotation.z = Math.atan2(dir.x, dir.z); spill.position.copy(mid).setY(.2);
  return { group, beam, shells, tracks, spill };
}

export function disposeLaserObject(root) {
  const resources = new Set();
  root.traverse(o => { if (o.geometry) resources.add(o.geometry); for (const m of o.material ? [o.material].flat() : []) resources.add(m); });
  for (const r of resources) r.dispose();
  root.removeFromParent();
}


