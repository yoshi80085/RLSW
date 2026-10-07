// ─── 🤕 THE KNOCKDOWN — a few fans run out and help him up ────────────────────
// Alex, 2026-10-07: *"Actually something I wanted to do with a Knock out - The
// standee 'falls down' on the spot - a few fans come out to the stage and 'help
// him' up - loses FP in the process, Vibe is restored. A life is lost. He gets
// back up where he got knocked down."*
//
// ⭐ THE RULE IS NOT HERE. The life, the FP and the full Vibe are
// `battleFlow.vibeDamage` → `combat.resolveKnockdown` (which no longer sends him
// home). This file is only the picture: the standee topples, three of his own
// fans leave the front of his grandstand, run to him, crouch round him and lift,
// he comes back up, they run home. `arenaVisuals` starts it when a Spirit's
// `knockdownCount` moves while he is still on a hex, and reads `down(id)` for how
// far over the standee is (`standee.frame`'s `knockedOut`, 0..1).
//
// 📌 TWO HALVES, like `standeeMotion.js`: `koPlan` / `koDown` / `helperPose` are
// pure (no three, no clock) so a check can pin the beats; `createKnockdownHelpers`
// is the three.js half. ⚠️ A FIRST PASS, NOT A DIAL-IN — every number is in
// `KO_HELP` for when Alex wants it in a preview.

import * as THREE from 'three';
import { fanPawn3D, grandstandPlacement } from './cosmicFans.js';

export const KO_HELP = Object.freeze({
  fallMs: 360,     // the standee topples
  leaveMs: 220,    // …and lies there a beat before anyone moves
  runMs: 1150,     // grandstand → beside him
  stagger: 90,     // each helper leaves this much after the last
  liftMs: 900,     // crouched round him, heaving
  riseMs: 520,     // he comes back up
  backMs: 1100,    // and they run home
  helpers: 3,
  spread: 0.62,    // how far from his hex centre they gather
  arc: 1.05,       // radians between helpers round his near side
  hop: 0.11,       // the run's bounce
  size: 1.25,      // on top of a seated fan's own scale (the stand is scaled 1.33)
});

const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = u => { const p = clamp01(u); return p * p * (3 - 2 * p); };
const easeIn = u => clamp01(u) ** 2;
const easeOut = u => 1 - (1 - clamp01(u)) ** 2;

/** The beats, in ms from the knockdown. */
export function koPlan(T = KO_HELP) {
  const arrive = T.fallMs + T.leaveMs + T.runMs + (T.helpers - 1) * T.stagger;
  const riseAt = arrive + T.liftMs;
  const upAt = riseAt + T.riseMs;
  const homeAt = upAt + T.backMs + (T.helpers - 1) * T.stagger;
  return { arrive, riseAt, upAt, homeAt, total: homeAt };
}

/** How far over he is — 0 standing, 1 flat on the deck — `ms` in. */
export function koDown(ms, T = KO_HELP) {
  const p = koPlan(T);
  if (!(ms >= 0) || ms >= p.upAt) return 0;
  if (ms < T.fallMs) return easeIn(ms / T.fallMs);
  if (ms < p.riseAt) return 1;
  return 1 - easeOut((ms - p.riseAt) / T.riseMs);
}

/**
 * Helper `i` at `ms`: `t` 0 at the stand → 1 beside him, `crouch` 0..1, `hop`,
 * `out` true on the way there. Reduced motion: no run, no bounce — they are
 * simply beside him while he is down.
 */
export function helperPose(i, ms, { reduced = false, T = KO_HELP } = {}) {
  const p = koPlan(T), lag = i * T.stagger, leave = T.fallMs + T.leaveMs + lag;
  const none = { visible: false, t: 0, crouch: 0, hop: 0, out: true };
  if (reduced) {
    if (ms < T.fallMs || ms >= p.upAt) return none;
    return { visible: true, t: 1, crouch: ms < p.riseAt ? 1 : 0, hop: 0, out: true };
  }
  if (ms < leave || ms >= p.upAt + T.backMs + lag) return none;
  const bounce = k => Math.abs(Math.sin(ms / 1000 * 15 + i * 1.7)) * T.hop * k;
  if (ms < leave + T.runMs) return { visible: true, t: smooth((ms - leave) / T.runMs), crouch: 0, hop: bounce(1), out: true };
  if (ms < p.riseAt) return { visible: true, t: 1, crouch: 1, hop: 0, out: true };
  if (ms < p.upAt) return { visible: true, t: 1, crouch: 1 - smooth((ms - p.riseAt) / T.riseMs), hop: 0, out: true };
  const back = smooth((ms - p.upAt - lag) / T.backMs);
  return { visible: true, t: 1 - back, crouch: 0, hop: bounce(back > 0 && back < 1 ? 1 : 0), out: false };
}

/**
 * The three.js half. `pointFor(num, y)` is the arena's hex → world point;
 * `release` disposes a fan the way the arena disposes everything else.
 */
export function createKnockdownHelpers(root, { pointFor, release = o => o.removeFromParent(), T = KO_HELP } = {}) {
  const group = new THREE.Group(); group.name = 'Knockdown helpers'; root.add(group);
  const live = new Map();   // spiritId → { start, fans: [{ mesh, from, to }] }
  const plan = koPlan(T);
  function stop(id) {
    const run = live.get(id); if (!run) return;
    for (const f of run.fans) { group.remove(f.mesh); release(f.mesh); }
    live.delete(id);
  }
  return {
    group,
    /** He just went down on hex `num`; his fans come from his corner's stand. */
    start(id, { num, corner = 'blue', color = '#9aa7ff', style = null, now = performance.now() } = {}) {
      stop(id);
      const at = pointFor(num, .2); if (!at) return;
      const stand = grandstandPlacement(corner).position.clone().setY(at.y);
      const dir = at.clone().sub(stand).setY(0).normalize();          // stand → him
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const front = stand.clone().addScaledVector(dir, 1.1);          // the front rail
      const fans = Array.from({ length: T.helpers }, (_, i) => {
        const mesh = fanPawn3D({ color, filled: true, seed: 11 + i * 5, style });
        mesh.scale.multiplyScalar(T.size); mesh.visible = false; mesh.name = `Helper fan ${i + 1} · ${id}`;
        const a = (i - (T.helpers - 1) / 2) * T.arc;
        const to = at.clone().addScaledVector(dir, -T.spread * Math.cos(a)).addScaledVector(side, T.spread * Math.sin(a));
        const from = front.clone().addScaledVector(side, (i - (T.helpers - 1) / 2) * .35);
        group.add(mesh);
        return { mesh, from, to, at };
      });
      live.set(id, { start: now, fans });
    },
    /** Advance every helper. */
    tick(now, { reduced = false } = {}) {
      for (const [id, run] of live) {
        const ms = now - run.start;
        if (ms > plan.total + 300) { stop(id); continue; }
        run.fans.forEach((f, i) => {
          const pose = helperPose(i, ms, { reduced, T });
          f.mesh.visible = pose.visible; if (!pose.visible) return;
          f.mesh.position.copy(f.from).lerp(f.to, pose.t);
          f.mesh.position.y += pose.hop - pose.crouch * .06;
          // Face where they are going; once there, face him.
          const look = pose.t >= 1 || (pose.t > 0 && pose.out) ? (pose.t >= 1 ? f.at : f.to) : f.from;
          f.mesh.rotation.y = Math.atan2(look.x - f.mesh.position.x, look.z - f.mesh.position.z);
          f.mesh.rotation.x = pose.crouch * .55;                       // bent over him, heaving
        });
      }
    },
    /** How far over his standee should be (0..1), or null when he is not being helped. */
    down(id, now) { const run = live.get(id); return run ? koDown(now - run.start, T) : null; },
    get busy() { return live.size > 0; },
    get live() { return live.size; },
    dispose() { for (const id of [...live.keys()]) stop(id); group.removeFromParent(); },
  };
}
