// 🎟️ A fan = a geometric "pawn": a detached round head above a downward-pointing
// triangle body. All fans share the same shape; `filled` marks a diehard (solid) vs
// a casual (hollow outline). Centred vertically on (x, y), owner colour from spirit.
//
// BEHAVIOUR CYCLING — every fan has ALL behaviours baked in and cycles through them
// via CSS. Fans are mostly settled (rest ~74% of the time); actions appear briefly
// and at pseudo-random intervals. Each fan gets a unique cycle DURATION (38–60 s)
// and phase offset derived from a seeded hash, so the crowd drifts out of sync and
// never looks patterned. Pass `forcePose` to pin a fan to one behaviour (walk-off,
// pop-in, flying); pass null to let it self-animate.
//
// NO Math.random() — all timing is hash-derived so the crowd is stable across renders.
export function fanPawnShape(x, y, r, color, filled, sw = 1.2, op = 1, seed = 0, _unused = false, forcePose = null) {
  r = r * 1.15;
  const headR  = r * 0.40;
  const headCy = y - r * 0.88;
  const detail = headR > 2.0;
  const ink    = filled ? '#0a0e18' : color;

  // ── BODY — downward-pointing triangle (wide top, point at bottom) ──
  const topY = y - r * 0.28, botY = y + r * 0.72, halfW = r * 0.60;
  const bodyD = `M ${x - halfW} ${topY} L ${x + halfW} ${topY} L ${x} ${botY} Z`;

  // ── SEEDED HASH — stable pseudo-random [0,1) per (seed, offset) pair ──
  const s = typeof seed === 'number' ? ((seed % 997) + 997) % 997 : 0;
  const h = (n) => { const v = Math.sin(s * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); };

  // ── TIMING — each fan gets its own durations so the crowd drifts apart ──
  const cycleDur  = (38 + h(0) * 22).toFixed(2);               // 38–60 s full behaviour cycle
  const cycDelay  = (h(1) * parseFloat(cycleDur)).toFixed(2);   // random phase within cycle
  const bobDur    = (3.5 + h(2) * 2.0).toFixed(2);             // 3.5–5.5 s head bob
  const bobDelay  = (h(3) * 3).toFixed(2);
  const blinkDur  = (4.0 + h(4) * 3.0).toFixed(2);             // 4–7 s blink period
  const blinkDel  = (h(5) * 4).toFixed(2);
  const lookDur   = (12 + h(6) * 10).toFixed(2);               // 12–22 s look-around
  const lookDel   = (h(7) * 8).toFixed(2);
  const tiltDur   = (20 + h(8) * 18).toFixed(2);               // 20–38 s head tilt
  const tiltDel   = (h(9) * 12).toFixed(2);
  const lookRange = (headR * 0.14).toFixed(2);
  const hbob      = (headR * 0.18).toFixed(2);                  // gentler bob
  const tiltDeg   = (6 + Math.floor(h(10) * 8)).toFixed(0);

  // ── EYE geometry — simple filled circles (no outline/pupil) ──
  const eyeY   = headCy - headR * 0.05;
  const eyeDX  = headR * 0.36;
  const eyeR   = headR * 0.18;

  // ── HAND geometry — positions relative to the wide-top body ──
  const handR    = headR * 0.42;
  const hFill    = filled ? color : 'none';
  const restY    = topY + (botY - topY) * 0.25;      // ¼ down the body (shoulder level)
  const restDX   = halfW * 0.78;                      // at the body edges
  const waveY    = headCy - headR * 0.65;
  const waveDX   = halfW * 1.0;
  const sway     = headR * 0.5;
  const fistY    = headCy - headR * 1.05;
  const fistX    = x + halfW * 0.35;
  const lighterY = headCy - headR * 0.85;
  const lighterX = x - halfW * 0.28;
  const phoneY   = headCy - headR * 1.1;
  const phoneX   = x - halfW * 0.3;
  const hornW    = Math.max(sw * 0.9, r * 0.14);

  const animate = !forcePose && detail;

  // ── helper: a single hand circle ──
  const handCircle = (cx, cy, key) => (
    <circle key={key} cx={cx} cy={cy} r={handR}
      fill={hFill} stroke={color} strokeWidth={sw} opacity={op}/>
  );

  // ── FORCED-POSE HANDS (pop-in / walk-off / flying fans) ──
  let forcedHands = null;
  if (forcePose && detail) {
    if (forcePose === 'wave') {
      forcedHands = (
        <g>
          <g style={{animation:'fan-wave 1.4s ease-in-out infinite',
            ['--swA']:`${-sway}px`, ['--swB']:`${sway}px`}}>
            {handCircle(x - waveDX, waveY, 'wl')}
          </g>
          <g style={{animation:'fan-wave 1.4s ease-in-out infinite', animationDelay:'-0.7s',
            ['--swA']:`${-sway}px`, ['--swB']:`${sway}px`}}>
            {handCircle(x + waveDX, waveY, 'wr')}
          </g>
        </g>
      );
    } else if (forcePose === 'fist') {
      forcedHands = (
        <g>
          {handCircle(x - restDX, restY, 'rl')}
          <g style={{animation:'fan-fist 1.0s ease-in-out infinite', ['--pump']:`${-(headR * 1.4)}px`}}>
            {handCircle(fistX, fistY, 'fh')}
          </g>
        </g>
      );
    } else {
      forcedHands = <g>{handCircle(x - restDX, restY, 'rl')}{handCircle(x + restDX, restY, 'rr')}</g>;
    }
  }

  // ── SELF-ANIMATING HANDS — five behaviour groups, CSS cycles opacity ──
  // Rest is visible ~74% of the time; each action gets ~5–6%. Per-fan cycle
  // durations (38–60 s) drift apart so actions appear random across the crowd.
  let cyclingHands = null;
  if (animate) {
    // Negative delay = animation starts already in progress at the offset
    // position, so there's never a gap where all groups default to opacity 1.
    const actStyle = (idx) => ({
      animation: `fan-act-${idx} ${cycleDur}s linear infinite`,
      animationDelay: `-${cycDelay}s`
    });

    cyclingHands = (
      <g>
        {/* Act 0: rest — both hands at sides */}
        <g style={actStyle(0)}>
          {handCircle(x - restDX, restY, 'r0l')}
          {handCircle(x + restDX, restY, 'r0r')}
        </g>
        {/* Act 1: wave — both hands up, swaying in opposite phase */}
        <g style={actStyle(1)}>
          <g style={{animation:'fan-wave 1.4s ease-in-out infinite',
            ['--swA']:`${-sway}px`, ['--swB']:`${sway}px`}}>
            {handCircle(x - waveDX, waveY, 'w1l')}
          </g>
          <g style={{animation:'fan-wave 1.4s ease-in-out infinite', animationDelay:'-0.7s',
            ['--swA']:`${-sway}px`, ['--swB']:`${sway}px`}}>
            {handCircle(x + waveDX, waveY, 'w1r')}
          </g>
        </g>
        {/* Act 2: fist pump — one hand pumping, the other rests */}
        <g style={actStyle(2)}>
          {handCircle(x - restDX, restY, 'f2l')}
          <g style={{animation:'fan-fist 1.0s ease-in-out infinite', ['--pump']:`${-(headR * 1.4)}px`}}>
            {handCircle(fistX, fistY, 'f2r')}
            {detail && <g stroke={color} strokeWidth={hornW} strokeLinecap="round" opacity={op}>
              <line x1={fistX - handR * 0.55} y1={fistY - handR * 0.3} x2={fistX - handR * 0.85} y2={fistY - handR * 1.5}/>
              <line x1={fistX + handR * 0.55} y1={fistY - handR * 0.3} x2={fistX + handR * 0.85} y2={fistY - handR * 1.5}/>
            </g>}
          </g>
        </g>
        {/* Act 3: lighter — one hand holds a flickering flame */}
        <g style={actStyle(3)}>
          {handCircle(x + restDX, restY, 'l3r')}
          {handCircle(lighterX, lighterY, 'l3h')}
          <g style={{animation:'fan-flame 0.6s ease-in-out infinite',
            transformBox:'fill-box', transformOrigin:'center bottom',
            filter:'drop-shadow(0 0 2px #ff7a00)'}}>
            <ellipse cx={lighterX} cy={lighterY - handR * 1.5} rx={handR * 0.5} ry={handR * 0.95} fill="#ff9a2e"/>
            <ellipse cx={lighterX} cy={lighterY - handR * 1.3} rx={handR * 0.26} ry={handR * 0.5} fill="#ffe28a"/>
          </g>
        </g>
        {/* Act 4: phone — a glowing rectangle held high, swaying slowly */}
        <g style={actStyle(4)}>
          {handCircle(x + restDX, restY, 'p4r')}
          <g style={{animation:'fan-phone-sway 3.0s ease-in-out infinite'}}>
            <rect x={phoneX - handR * 0.42} y={phoneY - handR * 0.9}
              width={handR * 0.84} height={handR * 1.3} rx={handR * 0.2}
              fill="#cfe0ff" opacity={op} style={{filter:'drop-shadow(0 0 2px #cfe0ff)'}}/>
          </g>
        </g>
      </g>
    );
  }

  // ── EYES — simple filled circles that blink and look around ──
  let eyes = null;
  if (detail) {
    eyes = (
      <g style={{
        animation: `fan-blink ${blinkDur}s ease-in-out infinite`,
        animationDelay: `-${blinkDel}s`,
        transformBox: 'fill-box', transformOrigin: 'center'
      }}>
        <g style={{animation: `fan-look ${lookDur}s ease-in-out infinite`,
          animationDelay: `-${lookDel}s`, ['--look']: `${lookRange}px`}}>
          <circle cx={x - eyeDX} cy={eyeY} r={eyeR} fill={ink} opacity={op}/>
          <circle cx={x + eyeDX} cy={eyeY} r={eyeR} fill={ink} opacity={op}/>
        </g>
      </g>
    );
  }

  return (
    <>
      {/* Body — downward-pointing triangle */}
      <path d={bodyD} fill={filled ? color : 'none'} stroke={color} strokeWidth={sw}
        strokeLinejoin="round" opacity={op}/>
      {/* Head — circle, with slow internal bob + tilt */}
      <g style={detail ? {
        animation: `fan-head-bob ${bobDur}s ease-in-out infinite, fan-tilt ${tiltDur}s ease-in-out infinite`,
        animationDelay: `-${bobDelay}s, -${tiltDel}s`,
        ['--hbob']: `${-hbob}px`, ['--hbob2']: `${-hbob * 0.35}px`,
        ['--tilt']: `${h(11) > 0.5 ? '' : '-'}${tiltDeg}deg`,
        transformBox: 'fill-box', transformOrigin: 'center bottom'
      } : undefined}>
        <circle cx={x} cy={headCy} r={headR} fill={filled ? color : '#0a0e18'}
          stroke={color} strokeWidth={sw} opacity={op}/>
        {eyes}
      </g>
      {/* Hands */}
      {animate ? cyclingHands : forcedHands}
    </>
  );
}

