// ─── 🎬 THE IDLE REEL — the idle camera as a reel of shots ──────────────────
// Alex, 2026-10-17: *"lets improve the idle camera a bit - I like how it is so far
// actually. But when it's idle, it zooms out and stays zoomed out. I'd like for it
// to zoom in sometimes as well - floor level shots, eye level shots, close ups,
// over head fly by's - I'd like for the idle camera to be a bit more engaging - as
// well as having the current zoom out level"*, and the same morning *"make it so the
// camera can move randomly through the different view options"*.
//
// ⭐ IT REPLACED `idleFlow.js` IN THE RENDERER (2026-10-17). Same call, same
// priorities, same 10 s wait: `update({ shot, camera, now, dtMs, … })` returns the
// director's shot untouched until the player has been hands-off for `idleMs`, then
// returns its own pose. The old flow was ONE shot (the wide drift, r ≈ 49, forever);
// this plays a REEL, picked at random, and that wide drift is one shot in it, verbatim
// (`wide` below is idleFlow's maths line for line — idleFlow.js stays as its source
// of numbers, `IDLE_FLOW`, and `test:cameradirector` still pins them).
// 🎛️ The defaults are Alex's dial-in on `.scratch/idle-reel-preview.html` (✎ below,
// 18 of 64 moved; `IDLE_REEL_DIALLED`). The page imports THIS file — move a number
// here and the page moves with it.
//
// 📌 PURE, like idleFlow and cameraDirector: no three, no DOM, no clock of its
// own. Plain {x,y,z} in and out. The renderer supplies three optional helpers:
//   • groundAt(x, z) → the arena's floor height there (or -Infinity off it); the
//     lens is kept `clearance` above it, so a floor shot can never dip under a tile.
//   • yawOf(id)      → a standee's yaw (standee.js `standeeYaw`, the way its
//     PRINT faces). Front shots stay inside `frontArcDeg` of it, because the back
//     of every standee is the nebula, not the character (standee.js STANDEE_BACK).
//   • footprint      → the hex centres ({x,z}), at creation. Low shots pick an
//     angle whose whole path stays over the board and clear of other standees.
//
// ⚠️ THE CAMERA LEAVES ORBITCONTROLS' LIMITS. A close-up is ~3 from its subject
// (OrbitControls' floor is 12) and a floor shot looks UP (polar > 90°; the
// controls stop at .43π). That is fine while the reel drives — the renderer never
// calls controls.update() on a driven frame — but the hand-back must bring the lens
// back inside both, or the first controls.update() snaps it. The renderer's
// `startRefocus` lands at 19 and eases the tilt into range (`refocusPose` is the
// pure version of that end pose).
//
// 🎲 Seeded (`seed`), so a check can replay a reel; the renderer seeds it per mount.
import { IDLE_FLOW } from './idleFlow.js';

const TAU = Math.PI * 2;
const wrap = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = p => p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p);
const rad = d => d * Math.PI / 180;
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const V = (x, y, z) => ({ x, y, z });
const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const vlerp = (a, b, k) => V(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k));
// az in OrbitControls' convention (cameraDirector.js): the way from target to camera, atan2(x, z).
const ring = (az, d) => V(Math.sin(az) * d, 0, Math.cos(az) * d);
const up = h => V(0, h, 0);
export function toSph(p, t) {
  const x = p.x - t.x, y = p.y - t.y, z = p.z - t.z, r = Math.hypot(x, y, z) || 1e-6;
  return { r, pol:Math.acos(clamp(y / r, -1, 1)), az:Math.atan2(x, z) };
}
export const fromSph = (t, { r, pol, az }) => V(t.x + r * Math.sin(pol) * Math.sin(az), t.y + r * Math.cos(pol), t.z + r * Math.sin(pol) * Math.cos(az));
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/**
 * 🎞️ GLIDE BETWEEN TWO LIVE POSES. The aim slides straight across; the lens swings
 * round it in spherical terms (distance on a log scale, so a 49 → 3 dive spends as
 * long on the last few units as on the first forty). ⚠️ Straight-line blending of
 * the two POSITIONS would cut through whatever stands between them — a standee, the
 * floor — on a wide-to-floor move; swinging round the aim arcs over it.
 */
// ⚠️ `memo` (one object per glide) keeps the swing going the SAME way round: both
// poses move during a glide, and when the gap between their angles passes 180° the
// "short way" flips to the other side — a 16-unit jump in one frame (seen in the check).
export function blendPose(a, b, e, memo = null) {
  const target = vlerp(a.target, b.target, e);
  const sa = toSph(a.position, a.target), sb = toSph(b.position, b.target);
  let d = wrap(sb.az - sa.az);
  if (memo) { if (memo.d != null) d += TAU * Math.round((memo.d - d) / TAU); memo.d = d; }
  return { target, position:fromSph(target, {
    r:Math.exp(lerp(Math.log(sa.r), Math.log(sb.r), e)), pol:lerp(sa.pol, sb.pol, e), az:sa.az + d * e }) };
}

// 🎛️ THE LEVERS. Heights are above the Spirit's hex point (the floor, ≈ the
// standee's foot); a standee is 2.8 tall (standee.js STANDEE.height). Lengths in s.
export const IDLE_REEL = Object.freeze({
  idleMs:IDLE_FLOW.idleMs,
  pace:1.15 /* ✎ 1 */, transition:'glide', glideS:3.5, firstGlideS:4, fadeS:1.2,
  order:'random', openWith:'any' /* ✎ 'wide' */, wideEvery:3, features:'mostly', frontArcDeg:55, clearance:0.35,
  // 🌌 today's wide drift — speed/sway/r are idleFlow's own numbers
  wideW:3, wideS:22, speed:IDLE_FLOW.speed, sway:IDLE_FLOW.sway, wideR:49,
  // 🐜 floor level: the lens just off the tiles, looking up at the Spirit
  floorW:2, floorS:15 /* ✎ 11 */, floorH:0.75 /* ✎ 0.45 */, floorFrom:7.5, floorTo:5, floorLook:1.3, floorSweep:40,
  // 👁 eye level: standee height, the arena's horizon behind them
  eyeW:2, eyeS:15 /* ✎ 11 */, eyeH:2.1, eyeFrom:7, eyeTo:5.5, eyeLook:1.8, eyeSweep:30,
  // 🔍 close-up: the top of the print, a slow push in
  closeW:2, closeS:9, closeH:2.2, closeFrom:3.6, closeTo:2.6, closeLook:2.05, closeSweep:12,
  // 🎭 over the shoulder: behind one Spirit, looking at the nearest rival
  shoulderW:1, shoulderS:15 /* ✎ 9 */, shoulderBack:3.85 /* ✎ 2.4 */, shoulderSide:1.3 /* ✎ 1.4 */, shoulderH:2.6, shoulderMaxGap:15.5 /* ✎ 12 */,
  // 🛸 overhead fly-by: a straight pass, high, looking ahead and down
  flybyW:2, flybyS:20.5 /* ✎ 13 */, flybyAlt:12, flybyLen:42 /* ✎ 30 */, flybyAhead:13 /* ✎ 12 */, flybyOver:'middle' /* ✎ 'spirit' */,
  // 🏗️ crane reveal: from beside the Spirit up and back to the whole stage
  craneW:1, craneS:15 /* ✎ 12 */, craneFromH:0.8, craneFromD:4, craneToH:16, craneToD:20,
  // ⌗ / ◎ THE ☰ CAMERA VIEWS AS SHOTS (Alex, same day: "make it so the camera can move
  // randomly through the different view options"). arenaRenderer `frameView`: both sit
  // on topDownView's TOP_OFFSET (≈ 20° off vertical) — Top-down 35 from the board's
  // middle, Spirit 18 from the acting Spirit. ◈ Arena is the wide drift above.
  topW:1, topS:12, topDistance:35, topSweep:60 /* ✎ 30 */,
  spiritW:1.5, spiritS:15 /* ✎ 12 */, spiritDistance:13.5 /* ✎ 18 */, spiritSweep:91 /* ✎ 30 */,
});
// topDownView.js TOP_OFFSET = [0, .94, .34] → this many radians off vertical.
const TOP_TILT = Math.atan2(0.34, 0.94);
/** ✎ The 18 levers Alex moved on the preview (2026-10-17); `test:idlereel` pins them. */
export const IDLE_REEL_DIALLED = Object.freeze(['pace', 'openWith', 'floorS', 'floorH', 'eyeS', 'shoulderS', 'shoulderBack', 'shoulderSide',
  'shoulderMaxGap', 'flybyS', 'flybyLen', 'flybyAhead', 'flybyOver', 'craneS', 'topSweep', 'spiritS', 'spiritDistance', 'spiritSweep']);
export const REEL_KINDS = Object.freeze(['wide', 'floor', 'eye', 'close', 'shoulder', 'flyby', 'crane', 'top', 'spirit']);
export const REEL_LABELS = Object.freeze({
  wide:'🌌 Wide drift (today\'s)', floor:'🐜 Floor level', eye:'👁 Eye level', close:'🔍 Close-up',
  shoulder:'🎭 Over the shoulder', flyby:'🛸 Overhead fly-by', crane:'🏗️ Crane reveal',
  top:'⌗ Top-down view', spirit:'◎ Spirit view',
});
const ACTION = ['battle', 'move', 'event'];

export function createIdleReel({ tuning = {}, seed = 1, footprint = null } = {}) {
  const T = { ...IDLE_REEL, ...tuning };
  const rng = mulberry32(seed);
  let lastActivity = null, clock = 0, cur = null, prev = null, glide = null, fade = null;
  let lastKind = null, sinceWide = 0, pending = null;
  const history = [], lastPoint = new Map();
  const W = { phase:0, anchor:null };   // the wide drift's own clock, kept between visits
  const range = () => T.sway;
  const wander = p => Math.sin(p * .13) * .32 * range() + Math.sin(p * .047) * .23 * range();
  const onBoard = p => !footprint?.length || footprint.some(h => Math.hypot(h.x - p.x, h.z - p.z) < 1.25);

  const reset = () => { cur = prev = glide = fade = null; pending = null; W.anchor = null; };
  const activity = now => { lastActivity = now; reset(); };

  // ── who and from where ──────────────────────────────────────────────────────
  function pickSubject(ctx) {
    const { all, acting } = ctx;
    if (!all.length) return null;
    const any = () => all[Math.floor(rng() * all.length)];
    if (T.features === 'acting') return acting ?? any();
    if (T.features === 'mostly') return acting && rng() < 0.65 ? acting : any();
    return any();
  }
  // Score 24 angles round the subject: the whole path over the board, clear of the
  // other standees, and (for front shots) inside the print's front arc.
  function chooseAz(ctx, subj, path, { front = null, allowed = Math.PI } = {}) {
    let best = null, bs = -Infinity;
    for (let k = 0; k < 24; k++) {
      const az = k / 24 * TAU + rng() * TAU / 48;
      if (front != null && Math.abs(wrap(az - front)) > allowed) continue;
      let sc = rng() * 1.5;
      for (const p of path(az)) {
        sc += onBoard(p) ? 1 : -4;
        for (const o of ctx.all) if (o.id !== subj?.id && flat(p, o.point) < 1.5 && p.y < o.point.y + 3.4) sc -= 8;
      }
      if (sc > bs) { bs = sc; best = az; }
    }
    return best ?? front ?? ctx.camAz;
  }
  const frontOf = (ctx, id, sweep) => {
    const yaw = ctx.yawOf?.(id);
    return Number.isFinite(yaw) ? { front:yaw, allowed:Math.max(rad(10), rad(T.frontArcDeg) - sweep / 2) } : {};
  };
  const U = [0, 0.25, 0.5, 0.75, 1];

  // ── the shots: each returns a PLAN with pose(u, pointOf), or null if it can't play ──
  function orbitShot(kind) {
    return ctx => {
      const subj = pickSubject(ctx); if (!subj) return null;
      const H = T[kind + 'H'], from = T[kind + 'From'], to = T[kind + 'To'], look = T[kind + 'Look'], sweep = rad(T[kind + 'Sweep']);
      const sign = rng() < 0.5 ? -1 : 1;
      const at = (az0, u, p) => {
        const az = az0 + sign * sweep * (u - 0.5), d = lerp(from, to, u);
        return { position:add(add(p, ring(az, d)), up(H)), target:add(p, up(look)) };
      };
      const az0 = chooseAz(ctx, subj, az => U.map(u => at(az, u, subj.point).position), frontOf(ctx, subj.id, sweep));
      return { id:subj.id, pose:(u, pt) => at(az0, Math.min(u, 1.3), pt(subj.id)) };
    };
  }
  const BUILD = {
    wide:ctx => {
      if (W.anchor === null) W.anchor = ctx.camAz - W.phase * .025 - wander(W.phase);
      return { id:null, pose:() => {
        // ⭐ idleFlow.js, line for line (its position/target before the lazy chase).
        const phase = W.phase, c = ctx.center, rg = range();
        const az = W.anchor + phase * .025 + wander(phase);
        const pol = Math.min(Math.PI * .43, 1.17 + Math.sin(phase * .11 + .4) * .14 * rg);
        const r = Math.min(110, (T.wideR + Math.sin(phase * .083) * 5 * rg) * ctx.scale);
        const target = V(c.x + Math.sin(phase * .071) * 2.6 * rg, c.y + Math.sin(phase * .09) * 1.3, c.z + Math.sin(phase * .053 + 1) * 2 * rg);
        return { target, position:fromSph(target, { r, pol, az }) };
      } };
    },
    floor:orbitShot('floor'), eye:orbitShot('eye'), close:orbitShot('close'),
    shoulder:ctx => {
      const a = pickSubject(ctx); if (!a) return null;
      const near = ctx.all.filter(o => o.id !== a.id).map(o => ({ o, d:flat(o.point, a.point) }))
        .filter(x => x.d > 1.5 && x.d <= T.shoulderMaxGap).sort((x, y) => x.d - y.d);
      if (!near.length) return null;
      const b = near[0].o;
      const at = (side, u, pa, pb) => {
        const d = Math.hypot(pb.x - pa.x, pb.z - pa.z) || 1, dx = (pb.x - pa.x) / d, dz = (pb.z - pa.z) / d;
        const back = lerp(T.shoulderBack, T.shoulderBack * 0.75, u), off = lerp(T.shoulderSide, T.shoulderSide * 1.3, u) * side;
        return { position:V(pa.x - dx * back + dz * off, pa.y + T.shoulderH, pa.z - dz * back - dx * off), target:add(vlerp(pa, pb, 0.8), up(1.6)) };
      };
      let side = rng() < 0.5 ? -1 : 1;
      const score = sd => U.map(u => at(sd, u, a.point, b.point).position)
        .reduce((n, p) => n + (onBoard(p) ? 1 : -4) - ctx.all.filter(o => o.id !== a.id && flat(p, o.point) < 1.3).length * 8, 0);
      if (score(-side) > score(side)) side = -side;
      return { id:a.id, also:b.id, pose:(u, pt) => at(side, Math.min(u, 1.3), pt(a.id), pt(b.id)) };
    },
    flyby:ctx => {
      const subj = T.flybyOver === 'spirit' ? pickSubject(ctx) : null;
      const c0 = subj?.point ?? V(ctx.center.x, ctx.all[0]?.point.y ?? 0.34, ctx.center.z);
      const alt = T.flybyAlt * ctx.scale, len = T.flybyLen, ahead = T.flybyAhead, off = (rng() - 0.5) * 3;
      // 📌 The AIM crosses the subject at mid-pass, so the Spirit is centre-frame halfway.
      const at = (h, u, c) => {
        const dir = ring(h, 1), perp = V(dir.z, 0, -dir.x), s = (u - 0.5) * len - ahead;
        const base = V(c.x + dir.x * s + perp.x * off, c.y, c.z + dir.z * s + perp.z * off);
        return { position:add(base, up(alt * (1 + 0.06 * Math.sin(Math.PI * clamp(u, 0, 1))))), target:add(base, ring(h, ahead)) };
      };
      const h = chooseAz(ctx, null, hh => [0.2, 0.35, 0.5, 0.65, 0.8].map(u => { const p = at(hh, u, c0).target; return V(p.x, 99, p.z); }));
      return { id:subj?.id ?? null, pose:(u, pt) => at(h, Math.min(u, 1.3), subj ? pt(subj.id) : c0) };
    },
    crane:ctx => {
      const subj = pickSubject(ctx); if (!subj) return null;
      const sweep = rad(25), sign = rng() < 0.5 ? -1 : 1, mid = V(ctx.center.x, subj.point.y, ctx.center.z);
      const at = (az0, u, p) => {
        const e = smooth(u), az = az0 + sign * sweep * (u - 0.5);
        const pos = add(add(p, ring(az, lerp(T.craneFromD, T.craneToD * ctx.scale, e))), up(lerp(T.craneFromH, T.craneToH * ctx.scale, e)));
        return { position:pos, target:vlerp(add(p, up(1.5)), mid, e * 0.6) };
      };
      const az0 = chooseAz(ctx, subj, az => [0, 0.12, 0.25].map(u => at(az, u, subj.point).position), frontOf(ctx, subj.id, sweep));
      return { id:subj.id, pose:(u, pt) => at(az0, u, pt(subj.id)) };
    },
    // ⌗ the ☰ Top-down view, turning slowly round the board's middle
    top:ctx => {
      const sign = rng() < 0.5 ? -1 : 1, sweep = rad(T.topSweep), mid = V(0, ctx.all[0]?.point.y ?? 0.34, 0);
      return { id:null, pose:u => ({ target:mid, position:fromSph(mid, { r:T.topDistance * ctx.scale, pol:TOP_TILT, az:sign * sweep * (u - 0.5) }) }) };
    },
    // ◎ the ☰ Spirit view on a Spirit, turning slowly round them
    spirit:ctx => {
      const subj = pickSubject(ctx); if (!subj) return null;
      const sign = rng() < 0.5 ? -1 : 1, sweep = rad(T.spiritSweep);
      return { id:subj.id, pose:(u, pt) => { const p = pt(subj.id); return { target:p, position:fromSph(p, { r:T.spiritDistance * ctx.scale, pol:TOP_TILT, az:sign * sweep * (u - 0.5) }) }; } };
    },
  };

  function pickKind() {
    const on = REEL_KINDS.filter(k => T[k + 'W'] > 0);
    if (pending && pending !== 'any' && BUILD[pending]) return [pending, ...on];
    if (T.only && BUILD[T.only]) return [T.only, 'wide'];
    if (!lastKind) return T.openWith === 'wide' && T.wideW > 0 ? ['wide', ...on] : order(on);
    // 🔁 In order: every shot that's switched on, round and round (weights only switch them on/off).
    if (T.order === 'cycle') { const i = on.indexOf(lastKind); return [...on.slice(i + 1), ...on.slice(0, i + 1)]; }
    if (T.wideEvery > 0 && sinceWide >= T.wideEvery && T.wideW > 0) return ['wide', ...on];
    return order(on.filter(k => k !== lastKind)).concat(on.includes(lastKind) ? [lastKind] : [], 'wide');
  }
  // A weighted shuffle: the first is the pick, the rest are fallbacks if it can't play.
  function order(kinds) {
    const left = [...kinds], out = [];
    while (left.length) {
      const sum = left.reduce((n, k) => n + T[k + 'W'], 0);
      let r = rng() * sum, i = 0;
      while (i < left.length - 1 && (r -= T[left[i] + 'W']) > 0) i++;
      out.push(left.splice(i, 1)[0]);
    }
    return out;
  }
  function begin(ctx) {
    for (const kind of pickKind()) {
      const plan = BUILD[kind](ctx);
      if (!plan) continue;
      pending = null; lastKind = kind;
      sinceWide = kind === 'wide' ? 0 : sinceWide + 1;
      // ⏱️ `len` is the shot's time on screen up to the moment the NEXT one starts
      // gliding in; its move runs on over the glide-out (`span`), so a shot is never
      // eaten at both ends by its glides (an 8 s close-up held still for 1 s, seen).
      const len = Math.max(2, T[kind + 'S'] * T.pace);
      const span = len + (T.transition === 'glide' ? Math.min(T.glideS, len * 0.5) : 0);
      const shot = { kind, ...plan, t:0, len, span, at:clock };
      history.push({ kind, id:plan.id, at:clock }); if (history.length > 12) history.shift();
      return shot;
    }
    return null;
  }

  return {
    activity,
    retune(next) { Object.assign(T, next); },
    get tuning() { return { ...T }; },
    /** ⏭ Cut short the shot on screen: `kind` names the next one (else the reel picks). */
    next(kind = 'any') { pending = kind; },
    get state() {
      return cur ? { kind:cur.kind, id:cur.id, also:cur.also ?? null, t:cur.t, len:cur.len, gliding:!!glide, fading:!!fade, history:[...history] } : null;
    },
    update({ shot, camera, now, dtMs, subjects:s = {}, center = { x:0, y:-3, z:0 }, scale = 1, reduced = false, groundAt = null, yawOf = null }) {
      if (lastActivity === null) lastActivity = now;
      const action = shot && ACTION.includes(shot.shot);
      if (action) activity(now);
      if (reduced || !shot?.driving || action || now - lastActivity < T.idleMs) { reset(); return shot; }
      const dt = Math.max(0, Math.min(dtMs, 100)) / 1000;
      clock += dt;
      const all = [s.acting, ...(s.rivals ?? [])].filter(Boolean);
      for (const o of all) lastPoint.set(o.id, o.point);
      const ctx = { all, acting:s.acting ?? null, center, scale, yawOf, camAz:toSph(camera.position, camera.target).az };
      const pt = id => lastPoint.get(id) ?? s.acting?.point ?? V(center.x, 0.34, center.z);
      const poseOf = sh => sh.pose(sh.t / sh.span, pt);

      if (!cur) {
        // The reel opens with a glide from wherever the lens is, so going idle is a lean, not a cut.
        const fromPose = { position:{ ...camera.position }, target:{ ...camera.target } };
        cur = begin(ctx); if (!cur) return shot;
        glide = { start:clock, len:T.firstGlideS, fromPose };
      } else {
        cur.t += dt; if (prev) prev.t += dt;
      }
      if (cur.kind === 'wide' || prev?.kind === 'wide') W.phase += dt * T.speed;

      // ── the hand-over to the next shot ──
      const style = T.transition;
      const g = Math.min(T.glideS, cur.len * 0.5);
      // ⏭ Asked for a shot MID-GLIDE (the preview's buttons, a skip): don't wait the
      // glide out — glide on from wherever the blend has the lens this frame.
      if (pending && glide && style !== 'fade') {
        const e = smooth((clock - glide.start) / Math.max(0.01, glide.len));
        const here = blendPose(glide.fromPose ?? poseOf(prev), poseOf(cur), e, glide);
        const nx = begin(ctx);
        if (nx) { cur = nx; prev = null; glide = style === 'cut' ? null : { start:clock, len:g, fromPose:here }; }
      }
      if (style === 'glide' && !glide && (pending || cur.t >= cur.len)) {
        const nx = begin(ctx);
        if (nx) { prev = cur; cur = nx; glide = { start:clock, len:g }; }
      } else if (style === 'cut' && (pending || cur.t >= cur.len)) {
        const nx = begin(ctx); if (nx) { cur = nx; prev = null; glide = null; }
      } else if (style === 'fade' && !fade && (pending || cur.t >= cur.len - T.fadeS / 2)) {
        fade = { mid:clock + T.fadeS / 2, switched:false };
      }
      if (fade && !fade.switched && clock >= fade.mid) {
        const nx = begin(ctx); if (nx) { cur = nx; prev = null; glide = null; }
        fade.switched = true; pending = null;
      }
      const alpha = fade ? clamp(1 - Math.abs(clock - fade.mid) / (T.fadeS / 2), 0, 1) : 0;
      if (fade && clock >= fade.mid + T.fadeS / 2) fade = null;

      let pose = poseOf(cur);
      if (glide) {
        const e = smooth((clock - glide.start) / Math.max(0.01, glide.len));
        pose = blendPose(glide.fromPose ?? poseOf(prev), pose, e, glide);
        if (e >= 1) { glide = null; prev = null; }
      }
      // 🐜 Never under the floor (or a tile's bevel): `clearance` above whatever the arena has there.
      const gy = groundAt?.(pose.position.x, pose.position.z);
      if (Number.isFinite(gy) && pose.position.y < gy + T.clearance) pose = { ...pose, position:{ ...pose.position, y:gy + T.clearance } };
      return { ...shot, shot:'idle-reel', reel:cur.kind, subject:cur.id, position:pose.position, target:pose.target, fade:alpha };
    },
  };
}

/**
 * 🎯 THE BREAK, MADE SAFE FOR THE NEW SHOTS: the pose `startRefocus` should land on
 * when input arrives mid-reel. Keeps the viewing direction (as the shipped refocus
 * does) but pulls the tilt back inside OrbitControls' [minPolar, maxPolar] — a floor
 * shot looks UP, past .43π, and the first controls.update() after the ease would
 * otherwise snap it down. Pure; the renderer eases toward it as it does today.
 */
export function refocusPose({ position, target }, goal, distance, { minPolar = 0.08, maxPolar = Math.PI * 0.43 } = {}) {
  const s = toSph(position, target);
  return { target:{ ...goal }, position:fromSph(goal, { r:distance, pol:clamp(s.pol, minPolar, maxPolar), az:s.az }) };
}
