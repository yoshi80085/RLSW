// 🎥 THE AUTO CAMERA — follows the action, never sits still, hands the camera
// to the player the moment they grab it and takes it back after they let go.
//
// Alex, 2026-09-17: *"a 'moving camera' that instinctively follows the action …
// never quite just 'sitting' in one spot … let players take control if they want
// to - this turns 'off' the moving camera function. But if its sitting idle, let
// the camera start to move on its own again - perhaps after 6 or 7 seconds."*
//
// ⭐ THE DIRECTOR BELOW IS LIFTED VERBATIM FROM `.scratch/camera-move-tiles-preview.html`
// (v2). v1 came back with all 31 levers untouched; after playing it Alex asked for
// moves to be "more subtle, like a ken burns effect" and for the wide shot to wait
// until "action has ceased for a period of time". The v2 dial-in moved 10 camera
// levers (2026-09-17), and a second pass the next day moved 19 — a MUCH calmer
// camera (swing 5 → 0.5, drift 4 → 0.5°/s, an idle shot every 20 s, the wide shot
// after a full minute, closer and flatter). Those are the defaults here. If a number here moves, move
// it on the preview page too — the page is where it is judged.
// 🪦 v1's page (`auto-camera-preview.html`) is history now; parity is checked
// against the v2 page.
//
// 📌 TWO HALVES, BOTH PURE (no three, no DOM, no clock of their own):
//   • createCameraDirector — subjects in, a camera pose out. Shot priority is
//     battle > move > effect > the idle program (close · surroundings · hero),
//     and the WIDE shot only after `wideAfterS` of quiet. A move is a Ken Burns
//     push-in that keeps the camera's angle.
//   • createCameraSubjects — turns the renderer's `arenaFrame` into those subjects.
//     The frame says where things ARE; this module notices what just HAPPENED.
// `arenaRenderer.js` is the only file that knows about OrbitControls.
//
// ⚠️ THE SONIC CAMERA OUTRANKS THIS ONE. A Sonic volley is a scripted shot
// (`sonicCamera.js`); the renderer does not even ask the director while it runs.

const TAU = Math.PI * 2;
const wrapAngle = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const smooth01 = p => p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p);
const rad = d => d * Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Azimuth convention matches OrbitControls: the direction from target to camera,
// measured as atan2(x, z). flatAz(a, b) is "the way from a toward b".
const flatAz = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const midpoint = (a, b) => ({ x:(a.x + b.x) / 2, y:(a.y + b.y) / 2, z:(a.z + b.z) / 2 });

export const CAMERA_DIRECTOR = Object.freeze({
  resumeAfterMs:6500, resumeBlendMs:3000, viewButtons:'pause', reducedMotion:'still', zoomMemory:'director',
  followRate:3.2, swingRate:0.5, afterHoldMs:2300, lookHeight:0.45,
  driftDegPerSec:0.5, actionDrift:0.1, breathe:0, breathPeriodS:7.5,
  idleShots:'cycle', shotHoldS:20, idleDistance:19, idleTilt:44, wideDistance:36, wideTilt:38, heroDistance:15, heroTilt:70,
  moveDistance:27, moveTilt:50, moveLead:0.4, chase:0.25,
  // 🎞️ v2: a move is a slow push-in that keeps the camera's angle (Alex: "like a ken burns effect").
  moveAngle:'keep', kbPush:0.11, kbMs:3600, kbPanDeg:9, moveFollowRate:5.2,
  // 🎞️ v2: the wide shot waits for real quiet; idle stays on the Spirit and its surroundings.
  wideAfterS:60, longIdle:'hold', rivalMaxGap:9,
  battlePad:10, battleTilt:56, battleSkew:20,
  reactToEvents:'on', eventDistance:20,
  // Not levers: the renderer's OrbitControls limits, so the director can never
  // hand the player a camera their own mouse could not have produced.
  minDistance:12, maxDistance:110, minPolar:0.08, maxPolar:Math.PI * 0.43,
});
// 🪦 v1 had the wide shot in the idle cycle; v2 keeps it out until wideAfterS of quiet.
export const IDLE_PROGRAMS = Object.freeze({ cycle:['mid','rival','hero'], orbit:['mid'] });

export function createCameraDirector(tuning = {}) {
  const T = { ...CAMERA_DIRECTOR, ...tuning };
  let mode = 'auto', interacting = false, lastInput = -Infinity, resumeStart = 0;
  let cur = null, shot = null, afterUntil = -Infinity, programIdx = 0, programSince = 0;
  let clock = 0, zoomScale = 1, measureZoom = false, shotCount = 0, lastActing = null, restartProgram = false;
  let lastActionAt = null, lastProgramKey = '';

  const fromCamera = (p, t) => {
    const x = p.x - t.x, y = p.y - t.y, z = p.z - t.z, r = Math.hypot(x, y, z) || 1;
    return { tx:t.x, ty:t.y, tz:t.z, r, pol:Math.acos(clamp(y / r, -1, 1)), az:Math.atan2(x, z) };
  };
  const lift = p => ({ x:p.x, y:p.y + T.lookHeight, z:p.z });
  const nearer = (a, b, ref) => Math.abs(wrapAngle(a - ref)) <= Math.abs(wrapAngle(b - ref)) ? a : b;
  const nearestRival = s => {
    if (!s.acting) return null;   // ⚠️ the acting Spirit can be knocked out or smoke-hidden
    let best = null, bd = Infinity;
    for (const r of s.rivals ?? []) { const d = flatDist(r.point, s.acting.point); if (d < bd) { bd = d; best = r; } }
    return best;
  };

  // Which shot does this moment call for? Returns a descriptor with a stable key;
  // a new key is a new shot. Priority: battle > move > effect > the idle program.
  function chooseShot(s, now) {
    if (s.battle) return { kind:'battle', key:`battle:${s.battle.key}`, action:true };
    if (s.moves?.length) return { kind:'move', key:`move:${s.moves[0].key}`, action:true };
    if (T.reactToEvents === 'on' && s.events?.length) { const e = s.events[s.events.length - 1]; return { kind:'event', key:`event:${e.key}`, action:true }; }
    // ⚠️ The after-hold: a battle that just resolved must not be abandoned the
    // same frame — the result IS the action. Hold the last action shot a beat.
    if (shot?.action && now < afterUntil) return { ...shot, held:true };
    // 🎞️ The wide shot is earned by QUIET, not reached by cycling (Alex, v2).
    // 'hold' parks on it until something happens; 'mix' lets it join the cycle.
    const base = IDLE_PROGRAMS[T.idleShots] ?? IDLE_PROGRAMS.cycle;
    const quiet = now - lastActionAt >= T.wideAfterS * 1000;
    const program = !quiet ? base : T.longIdle === 'hold' ? ['wide'] : [...base.slice(0, 2), 'wide', ...base.slice(2)];
    const programKey = program.join(',');
    if (restartProgram || shot?.action || s.acting?.id !== lastActing || programKey !== lastProgramKey) { programIdx = 0; programSince = now; restartProgram = false; }
    else if (now - programSince >= T.shotHoldS * 1000) { programIdx = (programIdx + 1) % program.length; programSince = now; }
    lastProgramKey = programKey;
    const kind = program[programIdx % program.length];
    return { kind, key:`idle:${kind}:${s.acting?.id}:${programSince}`, action:false };
  }

  // Fix the things that must NOT be re-decided every frame — which side of a
  // battle line we stand on — once, when the shot starts. Re-picking them per
  // frame makes the camera flip sides the moment the line crosses 90°.
  function beginShot(next, s, now) {
    shotCount++;
    const drift = shotCount % 2 ? 1 : -1;   // alternate the drift direction, so idle never becomes a turntable
    const base = { ...next, orbit:0, drift, last:null, startedAt:now };
    if (next.kind === 'battle') {
      const th = flatAz(s.battle.attacker, s.battle.defender), off = rad(90 + T.battleSkew);
      base.az = nearer(th + off, th - off, cur.az);
    } else if (next.kind === 'move') {
      if (T.moveAngle === 'side') {
        const m = s.moves[0], th = flatAz(m.from, m.to);
        const side = nearer(th + Math.PI / 2, th - Math.PI / 2, cur.az);
        base.az = side + T.chase * wrapAngle(th + Math.PI - side);
        base.kbR = T.moveDistance; base.kbPol = rad(T.moveTilt);
      } else {
        // 🎞️ KEN BURNS: keep the angle, start from roughly where the camera
        // already is (clamped near moveDistance, so no zoom lurch), then push in.
        base.az = cur.az;
        base.kbR = clamp(cur.r, T.moveDistance * 0.85, T.moveDistance * 1.25);
        base.kbPol = clamp(cur.pol, rad(T.moveTilt - 10), rad(T.moveTilt + 10));
      }
    } else if (next.kind === 'rival') {
      const r = nearestRival(s);
      base.az = r ? nearer(flatAz(s.acting.point, r.point) + Math.PI / 2, flatAz(s.acting.point, r.point) - Math.PI / 2, cur.az) : cur.az;
    } else if (next.kind === 'hero') {
      // Stand between the Spirit and the middle of the stage, looking out at it.
      base.az = s.acting ? flatAz(s.acting.point, s.center) : cur.az;
    } else base.az = cur.az;     // mid / wide / event: keep the angle we already have
    return base;
  }

  // The pose this shot wants THIS frame. Subjects move (a hopping pawn), so the
  // target is recomputed; the angle was fixed in beginShot.
  function poseFor(sh, s, now, cuts) {
    let p = null;
    if (sh.kind === 'battle' && s.battle) {
      const { attacker:a, defender:b } = s.battle;
      p = { t:lift(midpoint(a, b)), r:Math.max(T.minDistance + 1, flatDist(a, b) * 1.25 + T.battlePad), pol:rad(T.battleTilt) };
    } else if (sh.kind === 'move' && s.moves?.length) {
      const m = s.moves[0], th = flatAz(m.from, m.to);
      // ⚠️ Eased on the SHOT's clock, so extra steps inside one move keep pushing
      // rather than restarting; it stops at kbPush however long the walk runs.
      const k = cuts ? 0 : smooth01((now - sh.startedAt) / Math.max(1, T.kbMs));
      p = { t:lift({ x:m.point.x + Math.sin(th) * T.moveLead, y:m.point.y, z:m.point.z + Math.cos(th) * T.moveLead }),
            r:sh.kbR * (1 - T.kbPush * k), pol:sh.kbPol, azOff:cuts ? 0 : rad(T.kbPanDeg) * k * sh.drift };
    } else if (sh.kind === 'event' && s.events?.length) {
      p = { t:lift(s.events[s.events.length - 1].point), r:T.eventDistance, pol:rad(T.idleTilt) };
    } else if (sh.kind === 'wide') {
      p = { t:{ ...s.center }, r:T.wideDistance, pol:rad(T.wideTilt) };
    } else if (sh.kind === 'hero' && s.acting) {
      p = { t:lift(s.acting.point), r:T.heroDistance, pol:rad(T.heroTilt) };
    } else if (sh.kind === 'rival' && s.acting) {
      // 🎞️ v2 "or its surroundings": a far rival no longer drags the frame across
      // the board — the camera leans toward them from the acting Spirit instead.
      const r = nearestRival(s), gap = r ? flatDist(s.acting.point, r.point) : Infinity;
      const a = s.acting.point, lean = r ? { x:a.x + (r.point.x - a.x) * 0.25, y:a.y, z:a.z + (r.point.z - a.z) * 0.25 } : a;
      p = r && gap <= T.rivalMaxGap ? { t:lift(midpoint(a, r.point)), r:Math.max(T.idleDistance, gap * 1.25 + T.battlePad), pol:rad(T.idleTilt) }
            : { t:lift(lean), r:T.idleDistance * 1.15, pol:rad(T.idleTilt) };
    } else if (sh.kind === 'mid' && s.acting) {
      p = { t:lift(s.acting.point), r:T.idleDistance, pol:rad(T.idleTilt) };
    }
    // The subject left the frame (battle over, pawn knocked out): keep the last pose.
    if (!p) return sh.last;
    sh.last = p;
    return p;
  }

  function pose() {
    const sp = Math.sin(cur.pol);
    return { position:{ x:cur.tx + cur.r * sp * Math.sin(cur.az), y:cur.ty + cur.r * Math.cos(cur.pol), z:cur.tz + cur.r * sp * Math.cos(cur.az) },
             target:{ x:cur.tx, y:cur.ty, z:cur.tz } };
  }

  return {
    retune(next) { Object.assign(T, next); },
    // ── the player's hands. A click with no drag never calls these (the adapter's
    // job): picking a hex must not steal the camera from the director.
    userStart(now) { interacting = true; mode = 'manual'; lastInput = now; },
    userEnd(now) { if (!interacting) return; interacting = false; lastInput = now; },
    userNudge(now) { mode = 'manual'; lastInput = now; },   // wheel, view buttons: one-shot inputs
    get mode() { return mode; },

    update({ dtMs, now, subjects:s, camera, reduced = false }) {
      const dt = Math.max(0, Math.min(dtMs, 100)) / 1000;
      if (reduced && T.reducedMotion === 'still') { cur = null; shot = null; return { driving:false, mode:'off' }; }
      if (mode === 'manual') {
        const waited = now - lastInput;
        if (interacting || waited < T.resumeAfterMs)
          return { driving:false, mode, resumeInMs:interacting ? T.resumeAfterMs : T.resumeAfterMs - waited };
        // ⚠️ Pick up from where the PLAYER left the camera, not from where the
        // director last had it — otherwise resuming is a teleport.
        // 📌 Coming back always opens on the acting Spirit (the idle program's
        // first shot), not wherever the cycle had reached while the player drove.
        mode = 'resume'; resumeStart = now; cur = fromCamera(camera.position, camera.target); shot = null; restartProgram = true;
        lastActionAt = now;   // the player just did something — the quiet clock starts over
        measureZoom = T.zoomMemory === 'keep';
      }
      if (!cur) cur = fromCamera(camera.position, camera.target);
      if (mode === 'resume' && now - resumeStart >= T.resumeBlendMs) mode = 'auto';
      clock += dt;

      if (lastActionAt == null) lastActionAt = now;
      // A new turn is not quiet: the next Spirit is who we want to see.
      if ((s.acting?.id ?? null) !== lastActing) lastActionAt = now;
      const next = chooseShot(s, now);
      const isNew = !shot || next.key !== shot.key;
      if (isNew) shot = beginShot(next, s, now);
      // Only a LIVE action extends the hold; a held shot re-arming it would hold forever.
      if (shot.action && !next.held) { afterUntil = now + T.afterHoldMs; lastActionAt = now; }
      lastActing = s.acting?.id ?? null;

      const cuts = reduced && T.reducedMotion === 'cuts';
      const want = poseFor(shot, s, now, cuts);
      if (!want) return { driving:false, mode, shot:shot.kind };
      if (measureZoom) { zoomScale = clamp(cur.r / want.r, 0.5, 2); measureZoom = false; }
      if (T.zoomMemory !== 'keep') zoomScale = 1;

      // The Ken Burns pan replaces the drift on a move; breathing would fight the push.
      const kb = shot.kind === 'move' && T.moveAngle !== 'side';
      if (!cuts && !kb) shot.orbit += rad(T.driftDegPerSec) * dt * (shot.action ? T.actionDrift : 1) * shot.drift;
      const breath = cuts || kb ? 0 : T.breathe;
      const wantR = clamp(want.r * zoomScale * (1 + breath * Math.sin(clock * TAU / T.breathPeriodS)), T.minDistance, T.maxDistance);
      const wantPol = clamp(want.pol + breath * 0.5 * Math.sin(clock * TAU / T.breathPeriodS * 0.73 + 1.1), T.minPolar, T.maxPolar);
      const wantAz = shot.az + shot.orbit + (want.azOff ?? 0);

      if (cuts && isNew) { cur = { tx:want.t.x, ty:want.t.y, tz:want.t.z, r:wantR, pol:wantPol, az:wantAz }; return { driving:true, mode, shot:shot.kind, ...pose() }; }
      // Resume eases the director's grip in from zero, so the hand-off from the
      // player is a lean, not a lurch.
      const grip = mode === 'resume' ? Math.max(0.02, smooth01((now - resumeStart) / Math.max(1, T.resumeBlendMs))) : 1;
      const kf = 1 - Math.exp(-dt * (shot.kind === 'move' ? T.moveFollowRate : T.followRate) * grip), ks = 1 - Math.exp(-dt * T.swingRate * grip);
      cur.tx += (want.t.x - cur.tx) * kf; cur.ty += (want.t.y - cur.ty) * kf; cur.tz += (want.t.z - cur.tz) * kf;
      cur.r += (wantR - cur.r) * ks; cur.pol += (wantPol - cur.pol) * ks;
      cur.az += wrapAngle(wantAz - cur.az) * ks;
      return { driving:true, mode, shot:shot.kind, quietMs:now - lastActionAt, ...pose() };
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// SUBJECTS — what the director should look at, read from `arenaFrame`.
// ════════════════════════════════════════════════════════════════════════════
export const CAMERA_SUBJECTS = Object.freeze({
  // A move in the frame is a hex number changing; the pawn glides there in ~0.3 s
  // (arenaVisuals damps at 14/s), so the move is "happening" a little longer than
  // the glide, and each further step inside the window extends the same move.
  moveHoldMs:900,
  // Effects are persistent HAZARDS in the frame (a laser can stand for turns), so
  // only their ARRIVAL is news. The shot lasts this long after it appears.
  eventHoldMs:1500,
  // The middle of the stage the wide shot frames — arenaRenderer.js view('arena').
  center:Object.freeze({ x:1, y:-2.8, z:0 }),
});

export function createCameraSubjects({ pointFor, pointXY, tuning = {} }) {
  const T = { ...CAMERA_SUBJECTS, ...tuning };
  let lastNums = null, lastPresent = null, seq = 0;
  const moves = new Map(), events = [];
  const avg = pts => {
    const ok = pts.filter(Boolean); if (!ok.length) return null;
    return { x:ok.reduce((n, p) => n + p.x, 0) / ok.length, y:ok.reduce((n, p) => n + p.y, 0) / ok.length, z:ok.reduce((n, p) => n + p.z, 0) / ok.length };
  };

  return {
    read(frame = {}, now) {
      const all = frame.spirits ?? [], live = all.filter(s => !s.knockedOut);
      const byId = new Map(live.map(s => [s.id, s]));

      // ── moves: a Spirit's hex changed since the last frame ──
      if (lastNums) for (const s of live) {
        const was = lastNums.get(s.id);
        if (was == null || was === s.num) continue;
        const to = pointFor(s.num), m = moves.get(s.id);
        if (!to) continue;
        if (m && now < m.until) { m.to = to; m.point = to; m.until = now + T.moveHoldMs; }
        else { const from = pointFor(was); if (from) moves.set(s.id, { key:`${s.id}:${++seq}`, id:s.id, from, to, point:to, until:now + T.moveHoldMs }); }
      }
      for (const [id, m] of moves) if (now >= m.until || !byId.has(id)) moves.delete(id);
      lastNums = new Map(all.map(s => [s.id, s.num]));

      // ── effects: presence EDGES only ──
      const present = new Map();
      for (const sl of frame.slides ?? []) present.set(`slide:${sl.id}`, () => pointXY(sl.cx, sl.cy));
      for (const f of frame.flashes ?? []) present.set(`flash:${f.key}`, () => pointFor(byId.get(f.spiritId)?.num));
      for (const beam of frame.laser ?? []) if (beam?.length) present.set(`laser:${beam.join('-')}`, () => avg([pointFor(beam[0]), pointFor(beam[beam.length - 1])]));
      if (frame.pyro?.hexes?.length) present.set(`pyro:${frame.pyro.hexes.join('-')}:${frame.pyro.phase}`, () => avg(frame.pyro.hexes.map(pointFor)));
      if (frame.vortex) present.set(`vortex:${frame.vortex.hex}`, () => pointFor(frame.vortex.hex));
      if (frame.tentacle?.pts?.length) present.set(`arm:${frame.tentacle.key}`, () => { const p = frame.tentacle.pts[frame.tentacle.pts.length - 1]; return pointXY(p.x, p.y); });
      // ⚠️ The first frame after mount is not news: a board that already has a
      // laser on it must not yank the camera the moment the arena opens.
      if (lastPresent) for (const [key, at] of present) if (!lastPresent.has(key)) { const point = at(); if (point) events.push({ key, point, until:now + T.eventHoldMs }); }
      lastPresent = new Set(present.keys());
      for (let i = events.length - 1; i >= 0; i--) if (now >= events[i].until) events.splice(i, 1);

      // ── battle ──
      const b = frame.battle, attacker = b && byId.get(b.attackerId), defender = b && byId.get(b.defenderId);
      const battle = attacker && defender && pointFor(attacker.num) && pointFor(defender.num)
        ? { key:b.key ?? `${frame.turn}:${b.attackerId}:${b.defenderId}:${b.round ?? 1}`, attacker:pointFor(attacker.num), defender:pointFor(defender.num) } : null;

      const acting = byId.get(frame.actingId);
      return {
        center:{ ...T.center },
        acting:acting && pointFor(acting.num) ? { id:acting.id, point:pointFor(acting.num) } : null,
        rivals:live.filter(s => s !== acting && pointFor(s.num)).map(s => ({ id:s.id, point:pointFor(s.num) })),
        moves:[...moves.values()].map(m => ({ key:m.key, id:m.id, from:m.from, to:m.to, point:m.point })),
        battle,
        events:events.map(e => ({ key:e.key, point:e.point })),
      };
    },
  };
}
