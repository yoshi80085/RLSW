// ─── 🎸 PICKLES ───────────────────────────────────────────────────────────────
// The beginner-tip mascot: a guitar pick with eyes and a mouth who flies around
// the HUD dispensing advice. Think Clippy, but he shreds.
//
// Contract:
//   <Pickles x={} y={} size={} talking={} lookAt={} point={} emote={} act={} tag={}/>
//     x, y    — viewport coords of his CENTRE (position:fixed). Changing them
//               makes him FLY there (CSS transition on left/top), so the caller
//               just moves the numbers between tip pages.
//     talking — mouth flaps + little notes drift off him. Drive this from the
//               typewriter's "still typing" flag.
//     lookAt  — viewport point his pupils track.
//     point   — viewport point his POINTED END aims at. He physically rotates;
//               the face counter-rotates so it stays upright and readable.
//     emote   — 'drive' | 'sustain' | 'flex' | 'paid' | 'ko' | 'gold' | 'fame'
//     act     — one-shot motion: 'lunge' | 'recoil' | 'swing' | 'smash' | 'travel'
//     tag     — { text, color } floating damage/reward label that drifts off him
//     foe     — show the GRAY PICK sparring partner. Only means anything with
//               act 'lunge' (he rams it) or 'recoil' (it rams him back), because
//               those are the two beats where "hitting" and "getting hit" need a
//               second body on screen to be legible at all.
//     crowd   — fans run in and gather around him. They arrive ONCE (staggered),
//               then stay and cheer, so "you gain fans" is a thing the player
//               watches happen rather than a noun in a sentence.
//
// Pure presentation: no game state, no engine imports, no DOM reads.

// viewBox is 100 × 104.83 — the exact aspect of the traced silhouette below.
// All face geometry lives in this space and scales with `size`.
const VB = 100;
const VB_H = 104.83;

// 🔻 THE SILHOUETTE — not eyeballed. This is battle_pick.png's own outline:
// its alpha channel was traced (6× upsample → contour trace), de-rotated by the
// 0.2° tilt in the source art, mirrored about its centre to kill the pixel
// wobble, then simplified to 31 points and fitted with centripetal Catmull-Rom
// beziers. Max deviation from the traced edge is 0.24 viewBox units — 0.24% of
// its width — so Pickles and the battle pick are the same object.
//
// ⚠️ If battle_pick.png is ever redrawn, this path is STALE. Re-derive it
// rather than nudging control points by hand; the whole point is that the
// mascot can't drift away from the asset.
const PICK_PATH =
  "M 45.1 2.0 C 48.4 1.8 51.6 1.8 54.9 2.0 C 58.5 2.2 62.2 2.7 65.7 3.4 " +
  "C 69.2 4.2 72.8 5.2 76.0 6.3 C 78.8 7.4 81.4 8.7 83.7 10.1 " +
  "C 85.9 11.4 87.7 12.8 89.5 14.4 C 91.2 16.1 92.9 18.2 94.2 20.2 " +
  "C 95.5 22.3 96.5 24.4 97.1 26.8 C 97.7 29.5 98.1 32.7 98.0 35.4 " +
  "C 97.9 38.0 97.5 40.1 96.6 42.8 C 95.5 46.3 94.0 50.3 92.3 54.1 " +
  "C 90.3 58.2 88.2 62.2 85.5 66.4 C 82.5 71.2 78.5 76.9 75.2 81.3 " +
  "C 72.5 85.0 70.1 87.7 67.4 90.6 C 64.7 93.4 61.8 96.3 59.0 98.5 " +
  "C 56.5 100.4 53.7 102.1 51.3 102.8 C 49.7 103.3 48.5 102.8 47.0 102.2 " +
  "C 45.1 101.4 43.0 100.0 41.0 98.5 C 38.9 96.9 37.0 95.1 34.8 92.8 " +
  "C 32.2 90.2 29.8 87.8 26.7 83.7 C 22.4 78.0 16.6 69.6 12.8 63.6 " +
  "C 10.3 59.7 9.2 57.3 7.7 54.1 C 6.3 51.0 5.0 47.7 4.0 44.8 " +
  "C 3.2 42.4 2.6 40.7 2.3 38.3 C 2.0 35.7 1.9 32.4 2.3 29.7 " +
  "C 2.6 27.3 3.4 25.0 4.4 22.9 C 5.2 21.0 6.3 19.2 7.7 17.5 " +
  "C 9.0 15.8 10.6 14.2 12.5 12.8 C 14.4 11.2 16.8 9.7 19.0 8.5 " +
  "C 21.1 7.4 23.0 6.6 25.4 5.8 C 28.1 4.9 31.2 4.1 34.3 3.4 " +
  "C 37.7 2.8 41.5 2.2 45.1 2.0 Z";

// Measured half-widths of the silhouette, for placing the face. Every feature
// below is checked against these — the shape is widest at y≈34 and tapers to
// x 43.5–57.5 by y=100, so nothing wide can sit low.
//   y=24 → x  4.5–96.5    y=44 → x  3.5–96.5    y=70 → x 16.3–83.7
//   y=34 → x  2.0–98.0    y=56 → x  8.4–90.9    y=94 → x 35.3–64.7

// Pupil travel, in viewBox units, from the centre of each eye.
const PUPIL_REACH = 3.6;
// He rotates about his face, not his centroid — pivoting on the eyes keeps them
// in roughly the same spot on screen however hard he's pointing.
const PIVOT_X = 50, PIVOT_Y = 46;
// At rest the point hangs straight DOWN, which is +90° in screen space. Aiming
// is therefore "rotate by (angle to target) − 90°".
const REST_POINT_DEG = 90;

// 🎭 EMOTES — a tint, a held prop, and/or orbiting glyphs. Kept declarative so
// a tip page can name a feeling ("drive") instead of poking at colours.
const EMOTES = {
  drive:   { shell: ['#ffb08a', '#f0503a', '#8c1230'], prop: '⚔️' },
  sustain: { shell: ['#a8e4ff', '#3f95e8', '#123a70'], prop: '🛡️' },
  flex:    { prop: '💪' },
  paid:    { orbit: ['💲', '💰', '💲'] },
  ko:      { eyes: 'x' },
  gold:    { shell: ['#fff6c0', '#ffcc33', '#b07d10'], orbit: ['✨', '✨'] },
  fame:    { orbit: ['⭐', '⭐', '⭐'], rising: true },
};
const DEFAULT_SHELL = ['#ffd479', '#f6883f', '#c9357f'];
// 🩶 THE SPARRING PARTNER — a washed-out pick with none of Pickles' colour, so
// at a glance you read "him" and "not him" without anyone having to say so.
const FOE_SHELL = ['#d6dae2', '#8b93a1', '#3d4350'];

// 🩶 GRAY PICK — the thing Pickles hits, and the thing that hits him back.
// Deliberately thin: same silhouette (so it's obviously the same kind of
// object), flat dot eyes, a flat mouth. It is scenery with a face, not a second
// character — any more personality here and it steals the page.
function GrayPick({ size, mode }) {
  const w = size;
  const h = size * (VB_H / VB);
  return (
    <div
      className="pickles-foe"
      style={{
        position: 'absolute',
        top: '22%',
        // He rams RIGHTWARD, so the target stands to his right. When he's the
        // one getting hit, the aggressor comes in from the left instead —
        // matching `pickles-recoil`, which knocks him to the RIGHT (+24%).
        ...(mode === 'ram' ? { left: '84%' } : { right: '84%' }),
        width: w, height: h,
        pointerEvents: 'none',
        animation: mode === 'ram'
          // Pickles' lunge lands at 42% of a 900ms cycle — the knock starts one
          // beat after that so contact reads as cause, not coincidence.
          ? 'pickles-foe-knocked 900ms cubic-bezier(.2,.8,.3,1) infinite'
          // Pickles' recoil takes the hit at 18% of a 1000ms cycle, so the
          // charge has to be arriving just before then.
          : 'pickles-foe-charge 1000ms cubic-bezier(.2,.8,.3,1) infinite',
      }}
    >
      <svg viewBox={`0 0 ${VB} ${VB_H}`} width="100%" height="100%"
        style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="pickles-foe-shell" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%"   stopColor={FOE_SHELL[0]}/>
            <stop offset="46%"  stopColor={FOE_SHELL[1]}/>
            <stop offset="100%" stopColor={FOE_SHELL[2]}/>
          </linearGradient>
        </defs>
        {/* Upright, point down — the same rest pose Pickles holds. The lean
            into (or away from) the collision is the animation's job, not the
            geometry's; a rotated silhouette here just read as a second,
            unrelated object. */}
        <path d={PICK_PATH} fill="url(#pickles-foe-shell)"
          stroke="#20242c" strokeWidth="3.2" strokeLinejoin="round"/>
        {/* flat little face */}
        <circle cx="36" cy="44" r="6.2" fill="#20242c"/>
        <circle cx="64" cy="44" r="6.2" fill="#20242c"/>
        <path d="M38 70 L 62 70" fill="none"
          stroke="#20242c" strokeWidth="3.4" strokeLinecap="round"/>
      </svg>
      {/* 💥 impact star, timed to the frame of contact */}
      <div className="pickles-foe" style={{
        position: 'absolute', top: '30%',
        ...(mode === 'ram' ? { left: -size * 0.18 } : { right: -size * 0.18 }),
        fontSize: size * 0.42, lineHeight: 1,
        animation: mode === 'ram'
          ? 'pickles-foe-pow 900ms ease-out infinite'
          : 'pickles-foe-pow-in 1000ms ease-out infinite',
      }}>💥</div>
    </div>
  );
}

// 🎟️ THE CROWD — the fans who gather around him on the "gain FANS" beat.
//
// ⚠️ MIRRORS `fanPawnShape` in rlsw-simulator-v3_8_1.jsx: detached round head
// over a downward-pointing triangle body, solid = Diehard, hollow = Casual.
// Redrawn rather than imported on purpose — Pickles.jsx stays free of engine
// imports, and importing the main file from here would close a cycle. If the
// board's fans are ever restyled, restyle these to match; a tutorial that
// teaches a pawn shape the game doesn't use is worse than no tutorial.
//
// Laid out as an arc across a band WIDER than Pickles, so they read as gathering
// AROUND him rather than standing in a line under him. `from` is the side each
// one runs in from; the middle of the arc is left thin so his point stays clear.
const CROWD_FANS = [
  { x: 0.04, lift: 0.10, s: 0.74, die: false, from: -70 },
  { x: 0.15, lift: 0.30, s: 0.92, die: true,  from: -60 },
  { x: 0.27, lift: 0.06, s: 0.80, die: false, from: -48 },
  { x: 0.38, lift: 0.34, s: 1.00, die: false, from: -30 },
  { x: 0.62, lift: 0.34, s: 1.00, die: true,  from:  30 },
  { x: 0.73, lift: 0.06, s: 0.80, die: false, from:  48 },
  { x: 0.85, lift: 0.30, s: 0.92, die: false, from:  60 },
  { x: 0.96, lift: 0.10, s: 0.74, die: true,  from:  70 },
];

// One fan pawn, drawn around the origin at radius `r`. Proportions copied from
// fanPawnShape so the two crowds are recognisably the same species.
function FanPawn({ r, color, filled }) {
  const headR = r * 0.40, headCy = -r * 0.88;
  const topY = -r * 0.28, botY = r * 0.72, halfW = r * 0.60;
  const eyeY = headCy - headR * 0.05, eyeDX = headR * 0.36, eyeR = headR * 0.2;
  return (
    <g>
      {/* 🙌 arms up — this crowd is only ever seen mid-cheer, so they're always
          raised. The board's fans cycle poses; these have one job. */}
      <g stroke={color} strokeWidth={r * 0.15} strokeLinecap="round" fill="none">
        <path d={`M ${-halfW * 0.72} ${topY + r * 0.1} L ${-halfW * 1.25} ${headCy - headR * 0.75}`}/>
        <path d={`M ${halfW * 0.72} ${topY + r * 0.1} L ${halfW * 1.25} ${headCy - headR * 0.75}`}/>
      </g>
      <path d={`M ${-halfW} ${topY} L ${halfW} ${topY} L 0 ${botY} Z`}
        fill={filled ? color : 'none'} stroke={color} strokeWidth={r * 0.16} strokeLinejoin="round"/>
      <circle cx="0" cy={headCy} r={headR}
        fill={filled ? color : '#0a0e18'} stroke={color} strokeWidth={r * 0.16}/>
      <circle cx={-eyeDX} cy={eyeY} r={eyeR} fill={filled ? '#0a0e18' : color}/>
      <circle cx={eyeDX} cy={eyeY} r={eyeR} fill={filled ? '#0a0e18' : color}/>
    </g>
  );
}

// The whole crowd, as a band sitting at Pickles' base.
function PicklesCrowd({ size }) {
  const bandW = size * 2.5;
  const bandH = size * 0.72;
  return (
    <div
      className="pickles-crowd"
      style={{
        position: 'absolute', left: '50%', bottom: -size * 0.16,
        width: bandW, height: bandH, marginLeft: -bandW / 2,
        pointerEvents: 'none',
      }}
    >
      {CROWD_FANS.map((f, i) => (
        <div key={i} className="pickles-fan"
          style={{
            position: 'absolute',
            left: `${f.x * 100}%`, bottom: f.lift * bandH,
            width: 0, height: 0,
            ['--from']: `${f.from}px`,
            // Arrive once, staggered, then cheer forever. Two animations rather
            // than one loop: a crowd that keeps re-arriving reads as a glitch.
            animation: `pickles-fan-in 460ms cubic-bezier(.2,1.4,.5,1) ${i * 90}ms both,`
                     + ` pickles-fan-cheer ${1.05 + (i % 4) * 0.13}s ease-in-out ${460 + i * 90}ms infinite`,
          }}>
          <svg width={size * 0.5 * f.s} height={size * 0.5 * f.s} viewBox="-14 -16 28 28"
            style={{ display: 'block', overflow: 'visible',
              position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)' }}>
            <FanPawn r={10} color={f.die ? '#ff66cc' : '#7ee3ff'} filled={f.die}/>
          </svg>
        </div>
      ))}
    </div>
  );
}

export function Pickles({
  x = 0,
  y = 0,
  size = 78,
  talking = false,
  lookAt = null,
  point = null,
  emote = null,
  act = null,
  tag = null,
  mood = 'happy',            // 'happy' | 'wow'
  foe = false,
  crowd = false,
}) {
  const w = size;
  const h = size * (VB_H / VB);
  const em = EMOTES[emote] ?? {};
  const shell = em.shell ?? DEFAULT_SHELL;
  // 🩶 The sparring partner only exists for the two beats it explains. Asking
  // for it on any other act is a no-op rather than a stray pick on screen.
  const foeMode = !foe ? null : act === 'lunge' ? 'ram' : act === 'recoil' ? 'charge' : null;

  // 👀 Pupil offset — normalised direction from Pickles to whatever he's
  // looking at, capped at PUPIL_REACH so the pupils never leave the whites.
  let px = 0, py = 0.6;
  if (lookAt) {
    const dx = lookAt.x - x, dy = lookAt.y - y;
    const d = Math.hypot(dx, dy) || 1;
    // Soft ramp: close targets don't peg the pupils to the edge.
    const pull = Math.min(1, d / 180);
    px = (dx / d) * PUPIL_REACH * pull;
    py = (dy / d) * PUPIL_REACH * pull;
  }

  // 👉 AIM — swing the whole pick so its point leads at `point`. The face group
  // below cancels this exact rotation, so he can aim straight up without ending
  // up upside-down. Without `point` he just leans a few degrees toward whatever
  // he's looking at, which is enough attitude to not read as a sticker.
  let aimDeg = 0;
  if (point) {
    aimDeg = Math.atan2(point.y - y, point.x - x) * 180 / Math.PI - REST_POINT_DEG;
  }
  const tilt = point ? 0 : (lookAt ? Math.max(-9, Math.min(9, (lookAt.x - x) / 40)) : 0);

  return (
    <div
      style={{
        position: 'fixed',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        pointerEvents: 'none',
        zIndex: 3,
        // ✈️ THE FLIGHT: page changes move x/y, and this transition is what
        // turns that into Pickles swooping across the HUD. The overshoot in the
        // easing curve is the little arrival bounce.
        transition: 'left 720ms cubic-bezier(.34,1.28,.4,1), top 720ms cubic-bezier(.34,1.28,.4,1)',
      }}
    >
      <style>{`
        @keyframes pickles-float {
          0%, 100% { transform: translateY(0)   rotate(var(--tilt)); }
          50%      { transform: translateY(-7px) rotate(calc(var(--tilt) + 2deg)); }
        }
        @keyframes pickles-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          95%           { transform: scaleY(0.08); }
        }
        @keyframes pickles-talk {
          0%, 100% { transform: scaleY(0.35); }
          50%      { transform: scaleY(1.15); }
        }
        @keyframes pickles-note-drift {
          0%   { opacity: 0;   transform: translate(0,0) scale(.6) rotate(0deg); }
          25%  { opacity: .95; }
          100% { opacity: 0;   transform: translate(16px,-34px) scale(1) rotate(22deg); }
        }
        @keyframes pickles-glow {
          0%, 100% { filter: drop-shadow(0 0 6px #ff66cc66) drop-shadow(0 0 14px #f6ad5533); }
          50%      { filter: drop-shadow(0 0 12px #ff66ccaa) drop-shadow(0 0 22px #f6ad5555); }
        }
        /* 🎬 ONE-SHOT ACTIONS — these live on their own wrapper so they can't
           fight the float/glow animation for the transform property. */
        @keyframes pickles-lunge {
          0%   { transform: translateX(0) scale(1); }
          22%  { transform: translateX(-14%) scale(0.95, 1.05); }   /* wind up */
          42%  { transform: translateX(26%) scale(1.12, 0.9); }     /* strike  */
          100% { transform: translateX(0) scale(1); }
        }
        /* ⚠️ PURELY PASSIVE. This used to swing back through translateX(-10%)
           rotate(-4deg) after the hit, which read as Pickles RETALIATING — wrong
           on a page whose whole point is that getting hit is something that
           happens TO you. He now takes it, rides the knockback, and settles back
           to his stance without ever crossing back past centre. */
        @keyframes pickles-recoil {
          0%   { transform: translateX(0) rotate(0deg); }
          18%  { transform: translateX(24%) rotate(9deg); }         /* took it */
          46%  { transform: translateX(16%) rotate(6deg); }         /* absorbs   */
          78%  { transform: translateX(4%) rotate(1.5deg); }        /* recovers  */
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes pickles-swing {
          0%   { transform: rotate(0deg); }
          25%  { transform: rotate(-38deg); }
          55%  { transform: rotate(30deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes pickles-smash {
          0%   { transform: translateY(0) rotate(0deg) scale(1); }
          30%  { transform: translateY(-26%) rotate(-34deg) scale(1.06); }  /* raise */
          46%  { transform: translateY(14%) rotate(24deg) scale(0.9, 1.14); } /* DOWN */
          62%  { transform: translateY(6%) rotate(16deg) scale(1.1, 0.88); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
        }
        @keyframes pickles-travel {
          0%, 100% { transform: translateX(-16%); }
          50%      { transform: translateX(16%); }
        }
        /* 🩶 THE SPARRING PARTNER — two halves of one collision. Percentages are
           pinned to the beat where Pickles' own animation makes contact, so the
           two sprites meet instead of merely gesturing near each other. */
        @keyframes pickles-foe-knocked {   /* he rams it — lunge strikes at 42% */
          0%, 40% { transform: translateX(0) rotate(0deg); }
          52%     { transform: translateX(34%) rotate(20deg); }   /* sent flying */
          70%     { transform: translateX(12%) rotate(7deg); }
          100%    { transform: translateX(0) rotate(0deg); }
        }
        @keyframes pickles-foe-charge {    /* it rams him — recoil lands at 18% */
          0%   { transform: translateX(-34%) rotate(-6deg); }     /* wound back */
          16%  { transform: translateX(22%) rotate(14deg); }      /* IMPACT     */
          40%  { transform: translateX(-30%) rotate(-4deg); }     /* bounces off */
          100% { transform: translateX(-34%) rotate(-6deg); }
        }
        @keyframes pickles-foe-pow {       /* contact at 42–52% (lunge) */
          0%, 38% { opacity: 0; transform: scale(.4); }
          48%     { opacity: 1; transform: scale(1.15); }
          66%     { opacity: 0; transform: scale(1.3); }
          100%    { opacity: 0; transform: scale(.4); }
        }
        @keyframes pickles-foe-pow-in {    /* contact at 16–18% (recoil) */
          0%, 10% { opacity: 0; transform: scale(.4); }
          18%     { opacity: 1; transform: scale(1.15); }
          36%     { opacity: 0; transform: scale(1.3); }
          100%    { opacity: 0; transform: scale(.4); }
        }
        /* 🎟️ THE CROWD — they run in from their own side (--from), overshoot,
           settle, and then cheer. Staggered per fan by the delay, so the crowd
           assembles instead of appearing. */
        @keyframes pickles-fan-in {
          0%   { opacity: 0; transform: translateX(var(--from)) translateY(10px) scale(.3); }
          60%  { opacity: 1; }
          100% { opacity: 1; transform: translateX(0) translateY(0) scale(1); }
        }
        @keyframes pickles-fan-cheer {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50%      { transform: translateY(-5px) rotate(3deg); }
        }
        @keyframes pickles-speedline {
          0%   { opacity: 0;   transform: translateX(8px); }
          40%  { opacity: .85; }
          100% { opacity: 0;   transform: translateX(-22px); }
        }
        @keyframes pickles-orbit {
          0%   { opacity: 0;   transform: translateY(4px) scale(.7); }
          30%  { opacity: 1; }
          100% { opacity: 0;   transform: translateY(-26px) scale(1.05); }
        }
        @keyframes pickles-tag {
          0%   { opacity: 0;   transform: translateY(6px) scale(.85); }
          20%  { opacity: 1;   transform: translateY(0) scale(1); }
          100% { opacity: 0;   transform: translateY(-30px) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pickles-body, .pickles-act, .pickles-foe { animation: none !important; }
          /* the crowd still needs to END UP visible, so kill only the cheer and
             let the arrival snap to its finished state */
          .pickles-fan { animation: pickles-fan-in 1ms both !important; }
        }
      `}</style>

      {/* 🩶 the sparring partner. Rendered BEFORE the action layer so Pickles
          overlaps it at the moment of contact rather than sliding behind it —
          he is the one telling the story, so he stays in front. Keyed with the
          act so switching pages restarts both halves of the hit together. */}
      {foeMode && <GrayPick key={`foe-${foeMode}`} size={size * 0.74} mode={foeMode}/>}

      {/* 🎟️ the fans, gathered at his base. Also before the action layer, so he
          stands in FRONT of his crowd rather than behind it. */}
      {crowd && <PicklesCrowd size={size}/>}

      {/* 🎬 action layer — one-shot motions. Keyed by `act` so re-issuing the
          same emote restarts the animation instead of being ignored. */}
      <div className="pickles-act" key={act ?? 'still'}
        style={{ width: '100%', height: '100%',
          animation: act === 'lunge'  ? 'pickles-lunge 900ms cubic-bezier(.2,.8,.3,1) infinite'
                   : act === 'recoil' ? 'pickles-recoil 1000ms cubic-bezier(.2,.8,.3,1) infinite'
                   : act === 'swing'  ? 'pickles-swing 850ms ease-in-out infinite'
                   : act === 'smash'  ? 'pickles-smash 1100ms cubic-bezier(.3,.9,.4,1) infinite'
                   : act === 'travel' ? 'pickles-travel 1600ms ease-in-out infinite'
                   : 'none' }}>
        <div
          className="pickles-body"
          style={{
            ['--tilt']: `${tilt}deg`,
            width: '100%',
            height: '100%',
            transform: `rotate(${tilt}deg)`,
            animation: 'pickles-float 3.1s ease-in-out infinite, pickles-glow 2.4s ease-in-out infinite',
          }}
        >
          {/* overflow visible: aiming rotates the body about his face, which
              can swing the point outside the viewBox. Clipping it would lop off
              the very end we're using to point with. */}
          <svg viewBox={`0 0 ${VB} ${VB_H}`} width="100%" height="100%"
            style={{ display: 'block', overflow: 'visible' }}>
            <defs>
              <linearGradient id="pickles-shell" x1="0" y1="0" x2="0.4" y2="1">
                <stop offset="0%"   stopColor={shell[0]}/>
                <stop offset="46%"  stopColor={shell[1]}/>
                <stop offset="100%" stopColor={shell[2]}/>
              </linearGradient>
              <linearGradient id="pickles-sheen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.55"/>
                <stop offset="60%"  stopColor="#ffffff" stopOpacity="0.05"/>
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
              </linearGradient>
              <radialGradient id="pickles-eye" cx="0.4" cy="0.35" r="0.8">
                <stop offset="0%"   stopColor="#ffffff"/>
                <stop offset="100%" stopColor="#cfe4f5"/>
              </radialGradient>
            </defs>

            {/* 👉 AIM GROUP — the body swings to point; the face inside cancels
                the rotation so it never reads upside-down. */}
            <g transform={`rotate(${aimDeg} ${PIVOT_X} ${PIVOT_Y})`}>
              {/* 🔻 the battle pick's own outline — see PICK_PATH */}
              <path d={PICK_PATH}
                fill="url(#pickles-shell)" stroke="#2a0f1e" strokeWidth="3.2" strokeLinejoin="round"/>
              {/* glossy highlight raking across the top-left shoulder. Hugs the
                  real edge: the body spans x 21.8–81.6 at y=8 and 8.4–93.6 at
                  y=18, so this stays a couple of units inside all the way round. */}
              <path
                d="M50 7 C 64 7, 76 9.5, 85 14 C 66 10, 34 11, 15 21 C 23 12, 36 7, 50 7 Z"
                fill="url(#pickles-sheen)"/>
              {/* the tip is where a pick actually wears — scuff it. Body spans
                  x 35.3–64.7 at y=94, so this sits inside the point. */}
              <path d="M43 92 C 46.5 96, 53.5 96, 57 92"
                fill="none" stroke="#00000038" strokeWidth="2.6" strokeLinecap="round"/>

              <g transform={`rotate(${-aimDeg} ${PIVOT_X} ${PIVOT_Y})`}>
                {/* 👀 eyes — whites blink, pupils track `lookAt`. Centred at
                    y=44, the pick's broad upper third (x 3.5–96.5 there), so
                    13.5-radius whites at x 36/64 keep ~19u of shell either side. */}
                {[36, 64].map((cx, i) => (
                  <g key={i}>
                    {em.eyes === 'x' ? (
                      // 😵 KO'd — the universal cartoon shorthand for "you blew it"
                      <g stroke="#2a0f1e" strokeWidth="3.6" strokeLinecap="round">
                        <path d={`M ${cx - 9} 35 L ${cx + 9} 53`}/>
                        <path d={`M ${cx + 9} 35 L ${cx - 9} 53`}/>
                      </g>
                    ) : (
                      <>
                        <g style={{
                          transformOrigin: `${cx}px 44px`,
                          animation: `pickles-blink ${5.4 + i * 0.13}s ease-in-out infinite`,
                        }}>
                          <ellipse cx={cx} cy="44" rx="13.5" ry={mood === 'wow' ? 15 : 13.5}
                            fill="url(#pickles-eye)" stroke="#2a0f1e" strokeWidth="2.6"/>
                        </g>
                        <circle cx={cx + px} cy={44 + py} r={mood === 'wow' ? 4.6 : 5.6} fill="#1a0a18"/>
                        <circle cx={cx + px - 1.8} cy={44 + py - 2.2} r="1.9" fill="#ffffff" opacity="0.9"/>
                      </>
                    )}
                  </g>
                ))}
                {/* brows — a little attitude, because he is a pick with
                    opinions. At y≈24 so the 'wow' eyes (top edge y=29) clear them. */}
                <path d="M25 24 L 47 28" fill="none" stroke="#2a0f1e" strokeWidth="3" strokeLinecap="round"/>
                <path d="M75 24 L 53 28" fill="none" stroke="#2a0f1e" strokeWidth="3" strokeLinecap="round"/>

                {/* 👄 mouth — flaps while typing, settles into a grin when done.
                    At y=70 the taper has closed to x 16.3–83.7; the open mouth's
                    widest moment (rx 11, scaled 1.15) still clears the edge. */}
                {talking ? (
                  <g style={{
                    transformOrigin: '50px 70px',
                    animation: 'pickles-talk 220ms ease-in-out infinite',
                  }}>
                    <ellipse cx="50" cy="70" rx="11" ry="9" fill="#3a0d20" stroke="#2a0f1e" strokeWidth="2.4"/>
                    <ellipse cx="50" cy="75.5" rx="6" ry="3.6" fill="#e8557f"/>
                  </g>
                ) : (
                  <path d="M38 66 Q 50 78, 62 66" fill="none"
                    stroke="#2a0f1e" strokeWidth="3.4" strokeLinecap="round"/>
                )}
              </g>
            </g>

            {/* 🗡️ held prop — sits beside him, OUTSIDE the aim group so it stays
                upright and legible no matter which way he's pointing. */}
            {em.prop && (
              <text x="92" y="60" fontSize="34" textAnchor="middle"
                style={{ filter: 'drop-shadow(0 2px 4px #00000088)' }}>{em.prop}</text>
            )}

            {/* 💲 orbiting glyphs — money, sparkles, stars */}
            {em.orbit?.map((g, i) => (
              <text key={i} x={[4, 96, 22][i % 3]} y={[52, 40, 88][i % 3]}
                fontSize="26" textAnchor="middle"
                style={{
                  animation: `pickles-orbit ${1.5 + i * 0.3}s ease-out ${i * 0.4}s infinite`,
                  transformBox: 'fill-box', transformOrigin: 'center',
                }}>{g}</text>
            ))}

            {/* 💨 speed lines while travelling */}
            {act === 'travel' && [0, 1, 2].map(i => (
              <rect key={i} x="-6" y={34 + i * 16} width="20" height="3.4" rx="1.7" fill="#7ee3ff"
                style={{ animation: `pickles-speedline ${700 + i * 120}ms ease-out ${i * 90}ms infinite` }}/>
            ))}

            {/* 🎵 notes puffing off him while he talks. Anchored OUTSIDE the
                taper — the body is only x 19.4–80.4 at y=74 — so they read as
                coming off him rather than as decals stuck on his face. */}
            {talking && !em.prop && [0, 1].map(i => (
              <text key={i} x={i ? 84 : 6} y={i ? 72 : 78}
                fontSize="17" fill={i ? '#ff66cc' : '#7ee3ff'}
                style={{
                  animation: `pickles-note-drift ${1.5 + i * 0.35}s ease-out ${i * 0.55}s infinite`,
                  transformBox: 'fill-box', transformOrigin: 'center',
                }}>
                {i ? '♪' : '♫'}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* 🏷️ floating tag — "−1 DRIVE" and friends. Lives outside the SVG so it
          never inherits the aim rotation or the float bob. */}
      {tag && (
        <div key={tag.text} style={{
          position: 'absolute', left: '50%', top: -6, transform: 'translateX(-50%)',
          whiteSpace: 'nowrap', fontFamily: "'Saira Stencil One',sans-serif",
          fontSize: Math.max(10, size * 0.15), letterSpacing: 1,
          color: tag.color ?? '#ff6644',
          textShadow: `0 0 10px ${tag.color ?? '#ff6644'}, 0 2px 4px #000`,
          animation: 'pickles-tag 1.6s ease-out infinite',
        }}>{tag.text}</div>
      )}
    </div>
  );
}
