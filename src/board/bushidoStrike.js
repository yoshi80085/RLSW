// ─── ⚡ PSYCHO BUSHIDO STRIKE — how the Ronin crosses the lane ────────────────
// Alex, 2026-09-30: "We did work on movement of the Standees as well as some
// moves such as Ronin's Shukuchi. I'd like to, in the same vein, work on how
// other abilities might move - for starters, Psycho Bushido. It should be like a
// Zenitsu lightning strike kind of move with lightning strikes."
//
// 📌 The design already says so: RONIN_ABILITY_DESIGN §2.1 — "The inspiration
// is Zenitsu's lightning strike from an absurd distance." Today the game plays
// it as a plain Shukuchi BLINK (the warp is 2–4 hexes, so `stepKind` calls it a
// leap) and then the Swing. This file is what replaces that blink.
//
// ⭐ THE RULES DO NOT MOVE. The rival stands 3–5 hexes straight ahead; the
// Ronin lands on the hex JUST BEFORE him (`resolvePsychoBushido`, the warp to
// `targetStep.to`), and the ordinary Swing follows. Everything here is the look
// and the sound of that one warp — the page never changes where he ends up.
//
// 📌 TWO HALVES, like `standeeMotion.js`. This file is pure — no three, no DOM,
// no clock: `planStrike` says when each beat of the strike happens,
// `strikePose` says where the piece is `ms` into it, `boltPath` / `zigPoints`
// draw the lightning's shape from a seeded `rand`. The page (and later
// `standeeSteps.js`) is the three.js half; `bushidoSfx.js` is the sound.
//
// ⚠️ "GONE" IS A SCALE, NOT `visible`. `standeeSteps.js` never touches
// `pawn.visible` (the arena shows its own figures), so `vis` 0 means "scale the
// piece to ~0", exactly as the Shukuchi blink already does.
//
// ⭐ PORTED 2026-10-01 AT ALEX'S DIAL-IN — "Everything looks good in the
// preview" — 2 of 76 levers moved: `shieldSize` 1.10 → 1.65 and `sheath` off.
// Everything else shipped as the page offered it (style flash, gold bolts, the
// sky striking every hex he crosses, 3 silhouette afterimages, the rumble…).
// 📌 ONE COPY: `.scratch/bushidoStrike.js` re-exports this file, so the preview's
// defaults ARE the game and the next dial-in is measured against what ships.
//
// 🎮 IN THE GAME the strike is the Sonic's staged roll with the Ronin's lightning
// in place of the ring beams (`board/bushidoStrikeVisuals.js`): the Rival's
// Sustain throws first and his Sustain amp builds the shield, as bright as the
// roll is strong (`sonicClashVisuals`); the Ronin's Drive dice charge him; the
// rumble and the hush end on the Sonic's launch beat; his kept dice hit the
// shield at `BUSHIDO_BEATS`. Some levers are the PAGE's only (`chargeSource`,
// `clashShift`, `loseKnockback`, `rivalGuard`, `strike`) — the game always
// charges on the dice, draws on the launch, and takes the verdict from the rules.

export const BUSHIDO_STRIKE = Object.freeze({
  // ── the roll: Drive against Drive, and the charge rides the dice ──
  // ⭐ Alex, 2026-09-30 (second pass): "it should be 'charging' while the dice
  // are rolling (the higher the dice, the more the charge) - it basically
  // functions like a Swing attack - so Drive is rolled against Drive."
  chargeSource:'dice', rollScale:0.6, joltMs:160, clashShift:0, rivalGuard:0.7, loseKnockback:0.5, joltLevel:0.6,
  // ── the rumble before take-off ── ⭐ Alex, 2026-10-01: "the bigger the dice
  // count, the more the standee 'rumbles' and shakes before 'take off'."
  rumbleMs:900, rumbleShake:1, rumbleHop:0.06, rumbleDust:14, rumbleCam:0.25, rumbleSound:0.6,
  // ── the shield (Drive vs Sustain) ── ⭐ Alex, 2026-10-01: "the Rival puts up a
  // shield that Ronin has to 1st Burst through before getting to the Rival".
  burstGap:140, shieldSize:1.65, shieldGlow:0.8,   // ⭐ shieldSize: Alex 1.10 → 1.65
  // ── the move ──
  style:'flash', stanceMs:700, crouch:0.16, stanceLean:14, shiver:0.6, hushMs:120,
  dashMs:70, zigMs:300, zigCount:4, zigWidth:0.8, streakMs:170, skyfallMs:360,
  holdMs:260, followLean:22, arriveSquash:0.12, recoverMs:380,
  // ── the charge ──
  sparks:28, arcs:6, auraGlow:0.6, laneLight:'sweep', dimWorld:0.35,
  // ── the bolt he leaves ──
  boltColor:'gold', boltWidth:1, boltJag:0.22, boltBranches:3, boltHeight:0.9, boltLinger:420, boltFlicker:3,
  // ── lightning from the sky ──
  skyMode:'path', skyOrder:'forward', skyStagger:55, skyDelay:0, skyHeight:9, skyWidth:1,
  scorch:'on', scorchMs:1600,
  // ── afterimages ──
  afterCount:3, afterFade:500, afterLook:'silhouette', originGhost:'on',
  // ── the screen ──
  flash:0.55, shake:0.45, camPunch:'on',
  // ── the blow (a stand-in: in the game the Swing takes over here) ──
  strike:'slash', strikeDelay:40, rivalRecoil:0.5,
  // ── farther = bigger (the +2 / +3 / +4 ladder) ──
  distScale:0.6,
  // ── sound ──
  chargeSound:'both', chargeLevel:0.5, drawShing:'on', thunder:'both', thunderLevel:0.8, thunderDelay:90,
  rumbleSec:2.2, zapLevel:0.5, sheath:'off', sheathMs:750,   // ⭐ sheath: Alex 'ring' → 'off' landSound:'shipped',
  volume:0.75, room:0.35,
});

export const STRIKE_STYLES = Object.freeze(['flash', 'zigzag', 'streak', 'skyfall']);
export const STRIKE_LABELS = Object.freeze({
  flash:'Thunderclap & Flash (vanish → there)',
  zigzag:'Six-fold zigzag (flickers side to side)',
  streak:'Streak (a visible blur down the lane)',
  skyfall:'Sky-fall (up as a bolt, down on the hex)',
});
export const BOLT_COLORS = Object.freeze({ gold:0xffd23a, seat:null, white:0xe6f0ff, violet:0xb58cff, cyan:0x6fe6ff });

const clamp01 = v => Math.max(0, Math.min(1, v));
const easeOutCubic = u => 1 - Math.pow(1 - u, 3);
const easeInOutSine = u => -(Math.cos(Math.PI * u) - 1) / 2;
const easeInQuad = u => u * u;
const DEG = Math.PI / 180;

/** A small seeded generator, so one strike draws the same bolt on every client. */
export function seeded(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/**
 * ⭐ FARTHER = BIGGER. §2.1: "The attack becomes more powerful the FARTHER the
 * target is. This is the ability." The Drive ladder is +2/+3/+4 across the 3–5
 * window, so the SHOW scales the same way: 1 at range 3, `1 + distScale` at 5.
 */
export function intensityFor(dist, L = BUSHIDO_STRIKE) {
  return 1 + L.distScale * clamp01((dist - 3) / 2);
}

/**
 * ⚡ THE CHARGE RIDES THE DICE. `landings` are one side's thrown dice as
 * `{ at, face }` (ms; every die, dropped ones too — they are seen landing), and
 * the charge ends at the KEPT total over that side's own ceiling (`keep` dice ×
 * the biggest die) — "normalised against the side's own ceiling, never the
 * opponent" (the staged-roll ruling, 2026-09-22), or a close clash of two weak
 * rolls would read as one Spirit fully charged.
 * Each landing adds its face's share of that, eased over `joltMs`: a 6 is a big
 * jolt, a 1 barely a flicker.
 * @returns {{ final:number, at:(ms:number)=>number }}
 */
export function rollCharge(landings = [], { keptTotal = 0, ceiling = 1, joltMs = 160 } = {}) {
  const final = clamp01(keptTotal / Math.max(1, ceiling));
  const faces = landings.reduce((s, d) => s + Math.max(0, d.face), 0) || 1;
  return {
    final,
    at:ms => final * landings.reduce((s, d) => s + (d.face / faces) * easeOutCubic(clamp01((ms - d.at) / Math.max(1, joltMs))), 0),
  };
}

// ⚡ THE RANGE'S d8s ARE THE ENGINE'S RULE — one copy, re-exported here so the
// preview page and the arena read the same function the kernel and the client do.
export { bushidoUpgrade } from '../engine/systems/bushido.js';
export { PSYCHO_BUSHIDO_D8_LADDER as BUSHIDO_D8_LADDER, psychoBushidoD8s as bushidoD8s } from '../data/gameConstants.js';

/**
 * 🫨 HOW HARD HE RUMBLES (Alex, 2026-10-01: "the bigger the dice count, the more
 * the standee 'rumbles' and shakes before 'take off'"): the dice he threw, a d8
 * counting 4/3 of a d6 (its size), over four d6s. Four d6s → 1, four d8s → 1.33,
 * six d6s → 1.5, two dice → .5. Every die thrown counts — the dropped ones too.
 */
export function rumbleWeight(pool = []) {
  return pool.reduce((s, sides) => s + Math.min(12, sides) / 6, 0) / 4;
}

/** Win, tie or lose — the Swing's own verdict (`clashVerdict`: higher total wins, margin = damage). */
export function clashOutcome(atkTotal, defTotal) {
  return { kind:atkTotal > defTotal ? 'win' : atkTotal < defTotal ? 'lose' : 'tie', margin:Math.abs(atkTotal - defTotal) };
}

/**
 * How big the strike is: the range (farther = bigger) times the roll (a fuller
 * charge = bigger). `charge` is 0…1 from `rollCharge`; with the timed charge
 * (no dice) it is 1 and only the range counts, as before.
 */
export function strikeIntensity(dist, charge = 1, L = BUSHIDO_STRIKE) {
  return Math.max(0.3, intensityFor(dist, L) * (1 + L.rollScale * (charge - 0.5) * 2));
}

/**
 * ⏱️ THE BURST'S BEATS, in the shape `sonicBarrageTiming.SONIC_BEATS` uses, so
 * the shield, the sound and the rules' timers all read one clock. He goes on the
 * launch; his first die hits after the dash and the blow's delay; the rest follow
 * `burstGap` apart. ⭐ No hit-stops and no slow-motion break — the preview Alex
 * signed off had neither; the Sonic's half-second freezes would stutter a
 * 140 ms burst into a slideshow.
 */
export function bushidoBeats(L = BUSHIDO_STRIKE) {
  return Object.freeze({ flight:(dashTime(L) + L.strikeDelay) / 1000, spacing:L.burstGap / 1000, hitstop:0, breakRate:1, breakSlowFor:0 });
}

/** How long the travel itself takes, per style. */
export function dashTime(L = BUSHIDO_STRIKE) {
  return L.style === 'zigzag' ? L.zigMs : L.style === 'streak' ? L.streakMs : L.style === 'skyfall' ? L.skyfallMs : L.dashMs;
}

/**
 * The strike's beats, in ms from the moment he commits.
 * `dist` is the rival's distance (3–5); he lands on lane index `dist − 1`.
 *
 * Returns `{ stanceEnd, vanish, arrive, holdEnd, recoverEnd, strikeAt, thunderAt,
 * sheathAt, sky:[{ index, at }], boltOff, total, dist, travel }`.
 */
export function planStrike(L = BUSHIDO_STRIKE, { dist = 4, clashMs = null, shots = 0 } = {}) {
  // 🎲 With the dice, he goes on the SWING'S CLASH BEAT (`swingTimingFor`: the
  // totals are read, then the strike) — the stance is the whole roll, and the
  // hush is its last `hushMs`. Without them, the old timed stance.
  const rolled = clashMs != null && L.chargeSource === 'dice';
  const vanish = rolled ? Math.max(L.hushMs, clashMs + L.clashShift) : L.stanceMs + L.hushMs;
  const stanceEnd = vanish - L.hushMs;
  // 🫨 The rumble is the stance's last `rumbleMs`, building to take-off.
  const rumbleStart = Math.max(0, stanceEnd - L.rumbleMs);
  const arrive = vanish + dashTime(L);
  // 🛡️ THE BURST: with a shield, his kept dice hit it one by one (`shots`,
  // `burstGap` apart) from the blow onward, and he holds the follow-through
  // until the last one has landed.
  const burstEnd = shots ? arrive + L.strikeDelay + shots * L.burstGap : arrive;
  const holdEnd = Math.max(arrive + L.holdMs, shots ? burstEnd + 120 : 0);
  const recoverEnd = holdEnd + L.recoverMs;
  const travel = dist - 1;                              // hexes crossed
  // ⚡ WHICH HEXES THE SKY HITS. Lane index 0 is his origin, `dist` the rival.
  const pick = {
    none:[], ends:[0, travel], rival:[dist],
    path:Array.from({ length:travel + 1 }, (_, i) => i),
    all:Array.from({ length:dist + 1 }, (_, i) => i),
  }[L.skyMode] ?? [];
  const order = L.skyOrder === 'backward' ? [...pick].reverse() : pick;
  const sky = order.map((index, k) => ({
    index,
    at:vanish + L.skyDelay + (L.skyOrder === 'together' ? 0 : L.skyOrder === 'random' ? ((index * 7919) % 5) * L.skyStagger : k * L.skyStagger),
  }));
  const strikeAt = L.strike === 'off' ? null : arrive + L.strikeDelay;
  const thunderAt = vanish + L.thunderDelay;
  const sheathAt = Math.max(arrive + L.sheathMs, shots ? burstEnd + 350 : 0);
  const lastSky = sky.reduce((m, s) => Math.max(m, s.at), 0);
  const total = Math.max(recoverEnd, arrive + L.boltLinger, lastSky + 500, sheathAt + 300, L.scorch === 'on' ? vanish + Math.min(L.scorchMs, 1200) : 0);
  return { rumbleStart, stanceEnd, vanish, arrive, burstEnd, holdEnd, recoverEnd, strikeAt, thunderAt, sheathAt, sky, boltOff:arrive + L.boltLinger,
    total:Math.max(total, burstEnd + 900), dist, travel, rolled, shots };
}

/**
 * Where the Ronin is `ms` into the strike.
 *
 * Returns `{ phase, p, y, pitch, roll, sy, sxz, vis, tremble, charge, seg }`:
 * `p` 0…1 along the path (the page maps it onto the straight lane, or onto the
 * zigzag's vertices), `vis` 0…1 how much of him exists, `tremble` 0…1 the
 * shiver of a held draw, `charge` 0…1 how full the stance is.
 * `pitch` is forward lean (radians, toward his own face) — the same rotation
 * order ('YXZ') as `standeeMotion.stepPose`.
 */
export function strikePose(plan, ms, L = BUSHIDO_STRIKE, charge = null, rumbleScale = 1) {
  const P = { phase:'stance', p:0, y:0, pitch:0, roll:0, sy:1, sxz:1, vis:1, tremble:0, charge:0, seg:0, rumble:0 };
  const crouchPose = k => {
    P.sy = 1 - L.crouch * k; P.sxz = 1 + L.crouch * 0.35 * k; P.pitch = L.stanceLean * DEG * k;
  };
  // 🎲 ROLLED: the posture follows the charge — he sinks lower the harder his
  // dice land — with a floor so even a weak roll reads as a stance.
  const k0 = plan.rolled && charge != null
    ? Math.max(easeOutCubic(clamp01(ms / 400)) * 0.3, charge)
    : null;
  if (ms < plan.stanceEnd) {
    const k = k0 ?? easeOutCubic(clamp01(ms / Math.max(1, plan.stanceEnd)));
    crouchPose(k); P.charge = plan.rolled ? (charge ?? 0) : k; P.tremble = Math.max(0.15, k) * L.shiver;
    if (ms >= plan.rumbleStart) {
      // 🫨 THE RUMBLE: 0 → 1 over `rumbleMs`, accelerating, scaled by his dice.
      // Little stamping hops (deterministic — the caller adds the random
      // jitter), and the shiver grows into a shake.
      const r = easeInQuad(clamp01((ms - plan.rumbleStart) / Math.max(1, plan.stanceEnd - plan.rumbleStart)));
      P.phase = 'rumble'; P.rumble = r * rumbleScale;
      P.y = L.rumbleHop * P.rumble * Math.abs(Math.sin(ms * (0.03 + 0.03 * r)));
      P.tremble += L.rumbleShake * P.rumble;
      P.sy -= 0.02 * P.rumble; P.sxz += 0.015 * P.rumble;
    }
    return P;
  }
  if (ms < plan.vanish) {                               // 🤫 the held breath: still, full
    crouchPose(k0 ?? 1); P.phase = 'hush'; P.charge = plan.rolled ? (charge ?? 0) : 1; P.tremble = 0;
    return P;
  }
  if (ms < plan.arrive) {
    P.phase = 'dash'; P.charge = 1;
    const u = clamp01((ms - plan.vanish) / Math.max(1, plan.arrive - plan.vanish));
    switch (L.style) {
      case 'zigzag': {
        // ⚡ He flickers into existence at each corner of the zigzag, then is
        // gone again. `seg` is which corner (0 = origin … zigCount+1 = landing).
        const n = L.zigCount + 1, s = u * n, k = Math.floor(s);
        P.seg = k; P.p = k / n;
        P.vis = s - k < 0.34 ? 1 : 0;
        crouchPose(0.7); P.pitch = L.followLean * DEG * 0.8;
        break;
      }
      case 'streak':
        P.p = easeInQuad(u) * 0.6 + u * 0.4; P.vis = 1;
        crouchPose(0.9); P.pitch = L.followLean * 1.5 * DEG; P.sy *= 0.94;
        break;
      case 'skyfall':
        // Up as a bolt (first 40%), gone, then down onto the hex (last 25%).
        if (u < 0.4) { P.p = 0; P.y = easeInQuad(u / 0.4) * 6; P.vis = 1 - u / 0.4; P.sy = 1 + u; P.sxz = 1 - u * 0.8; }
        else if (u < 0.75) { P.p = 1; P.vis = 0; P.y = 6; }
        else { const d = (u - 0.75) / 0.25; P.p = 1; P.y = (1 - d) * 6; P.vis = d; P.sy = 1.4 - 0.4 * d; P.sxz = 0.6 + 0.4 * d; }
        break;
      default:                                          // 'flash' — simply not there
        P.p = u; P.vis = 0;
    }
    return P;
  }
  if (ms < plan.holdEnd) {                              // 🗡️ the follow-through, frozen (and the burst)
    P.phase = 'hold'; P.p = 1;
    const a = ms - plan.arrive;
    const squash = L.arriveSquash * Math.exp(-a / 70);
    P.sy = 1 - L.crouch * 0.8 - squash; P.sxz = 1 + L.crouch * 0.3 + squash * 0.6;
    P.pitch = L.followLean * DEG; P.roll = -4 * DEG;
    return P;
  }
  if (ms < plan.recoverEnd) {                           // rising out of it
    P.phase = 'recover'; P.p = 1;
    const k = easeInOutSine(clamp01((ms - plan.holdEnd) / Math.max(1, L.recoverMs)));
    P.sy = 1 - L.crouch * 0.8 * (1 - k); P.sxz = 1 + L.crouch * 0.3 * (1 - k);
    P.pitch = L.followLean * DEG * (1 - k); P.roll = -4 * DEG * (1 - k);
    return P;
  }
  P.phase = 'done'; P.p = 1;
  return P;
}

/**
 * The zigzag's corners between two deck points ({x, z}). Alternates sides by
 * `width` (in world units, a hex is ~1.93 across) and returns origin … landing.
 */
export function zigPoints(from, to, { count = 4, width = 0.8, rand = Math.random } = {}) {
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len, nz = dx / len;
  const pts = [{ x:from.x, z:from.z }];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1), side = (i % 2 ? 1 : -1) * width * (0.75 + rand() * 0.5);
    pts.push({ x:from.x + dx * t + nx * side, z:from.z + dz * t + nz * side });
  }
  pts.push({ x:to.x, z:to.z });
  return pts;
}

/**
 * A jagged lightning line from `a` to `b` ({x, y, z}), by midpoint
 * displacement: each split pushes the middle sideways by `jag` × its length.
 * `depth` 5 → 33 points, plenty for a bolt a few hexes long.
 */
export function boltPath(a, b, { jag = 0.22, depth = 5, rand = Math.random } = {}) {
  let pts = [a, b];
  let amp = jag;
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const len = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
      const off = () => (rand() * 2 - 1) * amp * len;
      next.push({ x:(p.x + q.x) / 2 + off(), y:(p.y + q.y) / 2 + off() * 0.6, z:(p.z + q.z) / 2 + off() }, q);
    }
    pts = next; amp *= 0.62;
  }
  return pts;
}

/** Forks off a bolt: short jagged lines leaving from random points along it. */
export function boltBranches(main, { count = 3, reach = 1.2, jag = 0.3, rand = Math.random } = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const k = 2 + Math.floor(rand() * Math.max(1, main.length - 4));
    const s = main[k];
    const end = { x:s.x + (rand() * 2 - 1) * reach, y:Math.max(0.25, s.y + (rand() * 2 - 1) * reach * 0.5), z:s.z + (rand() * 2 - 1) * reach };
    out.push(boltPath(s, end, { jag, depth:3, rand }));
  }
  return out;
}
