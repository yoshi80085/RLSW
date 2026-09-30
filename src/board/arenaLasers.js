import * as THREE from 'three';
import { createLaserPod, createLaserLane, matchLaserLayout, flightPose, angleDelta, LASER_LOOK, disposeLaserObject } from './laserRig.js';
import { laserEnvelope } from './laserPresentation.js';

// Lives on the foreground canvas, above the CSS3D tactical board, with real
// depth against arena solids. The smoke compositor consumes this depth too.
export function createArenaLasers(scene) {
  const root = new THREE.Group(); root.name = 'Live laser show'; scene.add(root);
  const fleet = [], lanes = [];
  let layout = [], origins = [], key = '', mode = 'off', start = 0, clock = 0, reduced = false, disposed = false;
  let envelope = laserEnvelope('off', 0), departure = [];
  const snapshot = () => fleet.map(p => ({ point: p.group.position.clone().add(new THREE.Vector3(0, p.moving.position.y - .7, 0)), yaw: p.group.rotation.y }));
  const clearLanes = () => { for (const lane of lanes) disposeLaserObject(lane.group); lanes.length = 0; };
  function tick(now, options = {}) {
    if (disposed) return;
    clock = now; reduced = !!options.reduced;
    envelope = laserEnvelope(mode, Math.max(0, now - start), { reduced });
    fleet.forEach((p, id) => {
      const lane = layout[Math.floor(id / 2)], end = id % 2 ? 'b' : 'a', other = id % 2 ? 'a' : 'b';
      const origin = origins[id];
      p.group.visible = !!lane && mode !== 'off' && (mode !== 'leave' || envelope.busy);
      if (!p.group.visible) return;
      const color = new THREE.Color(LASER_LOOK.colors[Math.floor(id / 2)]);
      if (mode === 'leave') {
        p.group.position.copy(departure[id].point); p.group.rotation.y = departure[id].yaw;
      } else {
        p.group.position.copy(mode === 'move' ? flightPose(origin.point, lane[end], envelope.travel, id) : lane[end]);
        const yaw = Math.atan2(lane[other].x - lane[end].x, lane[other].z - lane[end].z);
        p.group.rotation.y = mode === 'move' ? origin.yaw + angleDelta(origin.yaw, yaw) * envelope.travel : yaw;
      }
      p.moving.visible = envelope.lift > .005;
      p.moving.position.y = .7 + 9 * (1 - envelope.lift);
      p.moving.rotation.z = mode === 'move' && !reduced ? Math.sin(Math.PI * envelope.travel) * (id % 2 ? -.1 : .1) : 0;
      p.left.position.x = -.11 - envelope.shutter * .23; p.right.position.x = .11 + envelope.shutter * .23;
      p.lens.material.color.copy(color).multiplyScalar(LASER_LOOK.intensity * 2); p.lens.material.opacity = envelope.lens;
      p.status.material.color.copy(color); p.status.material.opacity = .4 + .6 * envelope.lens;
      for (const light of p.navigation) light.material.color.copy(color).multiplyScalar(1.7);
      p.thruster.material.opacity = .6 + (mode === 'move' ? .4 * Math.sin(Math.PI * envelope.travel) : 0);
    });
    lanes.forEach(lane => {
      lane.beam.visible = envelope.beam > 0 && envelope.lift === 1 && envelope.travel === 1;
      lane.spill.visible = lane.beam.visible;
      lane.spill.material.opacity = .1 * LASER_LOOK.intensity * envelope.beam;
      lane.shells.forEach((m, i) => { m.material.opacity = [1, .42, .07 * LASER_LOOK.halo][i] * envelope.beam; m.visible = !options.lite || i < 2; });
    });
  }
  return {
    root,
    update(lines, round, now = clock) {
      if (disposed) return;
      const nextKey = lines?.length ? JSON.stringify([lines, round ?? null]) : '';
      if (nextKey === key) return;
      tick(now, { reduced });
      const current = snapshot(), wasVisible = fleet.some(p => p.group.visible);
      clearLanes(); key = nextKey; start = now;
      if (!nextKey) { departure = current; mode = wasVisible ? 'leave' : 'off'; tick(now, { reduced }); return; }
      const previous = current.reduce((out, pose, id) => {
        (out[Math.floor(id / 2)] ??= {})[id % 2 ? 'b' : 'a'] = pose.point; return out;
      }, []);
      layout = matchLaserLayout(lines, wasVisible ? previous : []);
      if (!layout.length) { mode = 'off'; tick(now, { reduced }); return; }
      while (fleet.length < layout.length * 2) {
        const id = fleet.length, lane = layout[Math.floor(id / 2)], end = id % 2 ? 'b' : 'a', other = id % 2 ? 'a' : 'b';
        const p = createLaserPod(root, lane[end], lane[other]); p.group.name = `Laser pod ${id + 1}`; fleet.push(p);
      }
      origins = fleet.map((p, id) => current[id] ?? { point: p.group.position.clone(), yaw: p.group.rotation.y });
      layout.forEach((lane, i) => lanes.push(createLaserLane(root, lane, LASER_LOOK.colors[i])));
      mode = wasVisible ? 'move' : 'enter'; tick(now, { reduced });
    },
    tick,
    diagnostics: () => ({ phase: mode, pods: fleet.filter(p => p.group.visible && p.moving.visible).length,
      lanes: lanes.length, busy: envelope.busy, beam: envelope.beam, travel: envelope.travel }),
    dispose() { if (disposed) return; disposed = true; disposeLaserObject(root); fleet.length = lanes.length = 0; },
  };
}
