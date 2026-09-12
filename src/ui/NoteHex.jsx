// ─── 🎵 THE NOTE HEX ─────────────────────────────────────────────────────────
//
// One note chip, drawn as inline SVG: a bright outer ring, a deeper bracket ring
// inside it, and a white letter with a violet halo. Alex's design, 2026-08-26,
// from two reference PNGs and a preview page in `.scratch/note-hex-preview.html`.
//
// ⚠️ WHY SVG AND NOT THE `.hexw`/`.hexi` CLIP-PATH DIVS THE HUD USED TO USE.
// The chip has to GLOW, and `filter: drop-shadow()` blurs an element's SILHOUETTE.
// A clip-path div is a SOLID hexagon, so its drop-shadow is a blurred solid
// hexagon sitting directly behind an opaque one — nearly all of it hidden, and
// blurring harder only spreads the surviving fringe thinner. The glow looked
// frozen no matter what radius it was given. A STROKED ring has a thin silhouette,
// so the same filter throws a real halo. That one fact is why this file exists.
//
// 🪦 THE ARGUMENT WON, AND THE CLIP-PATH CLASSES ARE NOW GONE ENTIRELY. This file
// used to end this paragraph with "the classes are untouched and still correct for
// the Commit Track and the two Chord Stacks, which are filled chips and want to
// stay that way." That was never a design position, only an unfinished port — the
// moment a glowing chip sat next to a filled one, the filled one read as dead. As
// of 2026-08-28 every note in the game is a NoteHex: the stock, the step-1 commit
// grid, the eight track seats, the twelve stack seats, and the chip in flight.
//
// ⚠️ EVERY NUMBER IN `NOTE_HEX` WAS DIALLED BY EYE ON THE PREVIEW PAGE, NOT
// DERIVED. If a value here looks arbitrary it is because it IS a taste call —
// re-open `.scratch/note-hex-preview.html` to change one, rather than nudging
// numbers blind in this file.

/** 🎛️ THE ONLY THINGS MEANT TO BE TUNED. */
export const NOTE_HEX = {
  // 🎛️ ALEX'S DIAL-IN, 2026-08-26, read off the preview page's control panel.
  size:         60,        // px per chip. ⚠️ SEE THE WRAP TABLE BELOW — this is 4 rows.
  flatTop:      true,      // vertices at 3 and 9 o'clock — matches the BOARD's hexes
  bloom:        0.72,      // multiplier on every glow radius; 0 = flat, no halo
  brackets:     true,      // the inner corner-bracket ring
  bracketR:     0.82,      // its radius, as a fraction of the outer ring
  bracketArm:   0.50,      // arm length as a fraction of each edge, in from the vertex
  bracketEvery: 2,         // 2 = three alternating corners. 🎯 SEE THE NOTE BELOW.
  outerEdges:   0,         // extra faint rings OUTSIDE the main one
  letterGlow:   null,      // null = the letter glows in the STATE'S OWN HUE, not violet

  /* ♯♭ THE ACCIDENTAL PAIR — Alex's dial-in, 2026-09-12, read off the control
     panel of `.scratch/note-hex-accidentals.html` ("B · typeset pair"). He
     picked it over a uniform shrink, over a condense and over real ♭/♯ glyphs.

     🎯 THE RULE IT ENCODES: **the LETTER never changes size.** A two-glyph note
     is not a smaller note — it is a letter with a mark beside it, which is how
     music has always set it. So `A♭` and `C` carry the same 34px letter and a
     grid of chips keeps one rhythm, which is the thing a uniform shrink gives
     away (an `Ab` beside a `C` reads as the lesser note, most visibly in the
     stock where they sit in a grid).

     ⚠️ THE SQUEEZE IS PURELY HORIZONTAL, AND THAT IS WHY THIS WORKS. Measured on
     the preview in the real face: a plain letter spends ~44% of the bracket
     ring's 55.8 of clearance, a two-glyph note spends 75–82% — while the hex's
     VERTICAL room goes almost unused. `accRise` spends the axis that has room to
     buy back the axis that does not. */
  accScale:   0.60,        // the accidental's size, as a fraction of the letter's
  accRise:       4,        // px the accidental lifts above the letter's centre line
  accKern:      -1,        // px of extra tracking between the letter and the mark
};

/** ♯♭ The accidentals a note name can end in. ⚠️ A DELIBERATE WHITELIST, NOT
 *  `length > 1`. `letter` is not always a note: the staggered seat passes `⚡`
 *  (`rlsw-simulator-v3_8_1.jsx` ~11548), and anything else added later would be
 *  silently typeset as "a letter plus an accidental" if the test were length
 *  alone. `PITCH_INDEX` tops out at two characters, so this is the whole set.
 *  📌 ♭ and ♯ are here even though nothing SPELLS notes with them today — the
 *  probe on the preview page decides whether Saira Stencil One can draw them,
 *  and if that is ever switched on this function needs no second edit. */
const ACCIDENTALS = new Set(['b', '#', '♭', '♯']);

/** Splits `Ab` into `A` + `b`, and leaves everything else whole. */
function splitNote(letter) {
  const s = String(letter);
  const acc = s.length === 2 && ACCIDENTALS.has(s[1]) ? s[1] : '';
  return { base: acc ? s[0] : s, acc };
}


/** 🎆 THE COMMIT BURST — Alex's dial-in, read off the preview's BURST row.
 *  📌 `variant` is fixed at the "overdrive" preset he selected: flash + core +
 *  lifted letter + the detent spin. The page's other three presets (magic,
 *  shockwave, starburst) add expanding rings and spokes; they are not ported,
 *  because a preset that is not selected is not a taste call that was made. */
export const NOTE_BURST = {
  duration:  849,    // ms for a DEPARTURE ("SPEED")
  inScale:   0.72,   // an ARRIVAL is shorter — it is an answer, not a statement
  intensity: 1.5,    // glow multiplier ("INTENSITY")
  landScale: 0.86,   // the arrival's intensity, relative ("LAND BURST")
  detent:    120,    // degrees per turn. ⚠️ see the b-detent comment in GameStyles
  turns:     3,      // turns on departure ("TURNS")
  landTurns: 3,      // turns on arrival ("LAND TURNS")
  spinTime:  129,    // the detent runs at this % of the burst's own duration
  ease:      'cubic-bezier(.16,.84,.36,1)',   // "EASE — glide"
};

// 🎯 WHY `bracketEvery: 2` IS RIGHT HERE AND I ARGUED AGAINST IT.
// I tested three-alternating at a 22% arm and reported it reads as a BROKEN ring
// rather than a deliberate one. That was true — at 22%. At the 50% arm Alex landed
// on it is a different shape entirely: with alternate corners drawn, every edge
// gets exactly one half-length arm, so the ring is 50% drawn in a rotationally
// symmetric pinwheel. It reads as designed, not as damaged. 📌 The two numbers are
// coupled — drop `bracketArm` back toward 0.25 and `bracketEvery: 2` starts looking
// broken again. Change them together or not at all.
//
// 📌 `letterGlow: null` is also a departure from the reference PNGs, which use a
// constant violet on every chip. Alex chose the state's own hue instead, which
// trades the letter's cross-state consistency for a stronger colour signal per
// chip. Set it back to '#b81ff5' to get the reference behaviour.

// 📏 THE WRAP TABLE — measured in the real 238px HUD column with a 10-note stock
// (11 for the Ronin). `size` is not a free parameter; it decides the row count:
//
//     29px → 7 + 3     32px → 6 + 4     38px → 5 + 5     46px → 4 + 4 + 2
//
// 🎯 38 is two clean rows of five and costs no extra height. 46 is where the
// brackets genuinely READ, and it buys a third row in a panel that already
// collapses to 36px during move_act. That is the whole trade.

const VB = 120, C = 60, R = 34;   // viewBox is square; the hex is centred in it

/**
 * ♯♭ THE LETTER, TYPESET — the one place a note name is drawn.
 *
 * ⚠️ THIS EXISTS BECAUSE THERE WERE **TWO** HARDCODED `fontSize={34}` SITES: the
 * chip's own letter and the BURST's lifted copy, the one that peels off the chip
 * when you commit it. Changing only the first made the note change size at the
 * exact moment of the click — a glitch in the one animation the game most wants
 * to feel solid. One function now serves both, so they cannot drift again. It is
 * the same lesson `SEQUENCING.md` §12-board paid for with the amp knob: *finding
 * every mount is the work.*
 *
 * 📌 THE GEOMETRY IS THE PREVIEW'S, TRANSCRIBED — not re-derived. `0.52` is the
 * assumed advance of the accidental and `0.34` the letter's half-advance; both
 * were dialled by eye against the real face and a "tidier" derivation from
 * `getComputedTextLength` would move the pair off the values Alex actually
 * approved (and would force a measure pass on every chip, every render).
 *
 * @param letter the note name, e.g. `C` or `Ab`
 * @param glow   the `filter` string for the halo — applied to the PAIR, so the
 *               two glyphs share one filter region instead of blooming apart
 */
function noteLetter(letter, glow, cfg = NOTE_HEX, extraStyle = undefined) {
  const { base, acc } = splitNote(letter);
  // a natural is unchanged from what shipped before this pass: one centred text
  if (!acc) {
    return (
      <text x={C} y={C} textAnchor="middle" dominantBaseline="central"
        fontSize={34} fill="#ffffff" style={{ filter: glow, ...extraStyle }}>{base}</text>
    );
  }
  const as  = 34 * cfg.accScale;
  // the pair is centred as a UNIT: the letter shifts left by half the mark's
  // advance so the GROUP sits on the hex's axis. Centring the letter instead
  // pushes the pair right and the mark rides the bracket ring.
  const adv = as * 0.52 + cfg.accKern;
  return (
    <g style={{ filter: glow, ...extraStyle }}>
      <text x={(C - adv / 2).toFixed(2)} y={C} textAnchor="middle"
        dominantBaseline="central" fontSize={34} fill="#ffffff">{base}</text>
      <text x={(C - adv / 2 + 34 * 0.34 + cfg.accKern).toFixed(2)}
        y={(C - cfg.accRise).toFixed(2)} textAnchor="start" dominantBaseline="central"
        fontSize={as.toFixed(1)} fill="#ffffff" opacity=".92">{acc}</text>
    </g>
  );
}

/** Corner list. Flat-top steps 0°, 60°, …; pointy-top is the same rotated 30°. */
function corners(cx, cy, r, flatTop) {
  const off = flatTop ? 0 : Math.PI / 6;
  return Array.from({ length: 6 }, (_, i) => {
    const a = off + i * Math.PI / 3;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

function polyPoints(cx, cy, r, flatTop) {
  return corners(cx, cy, r, flatTop).map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
}

/** The chip's own hexagon, as an SVG `points` string in the 0 0 120 120 viewBox.
 *  Exported so anything drawing IN THE CHIP'S COORDINATE SPACE — the rings the
 *  flying chip sheds behind it — traces the same outline rather than a second
 *  hexagon that drifts out of step the first time the geometry changes. */
export function hexPoints(rFrac = 1, flatTop = NOTE_HEX.flatTop) {
  return polyPoints(C, C, R * rFrac, flatTop);
}

/**
 * 🔶 The bracket ring — corners only, sides open.
 *
 * Measured off Alex's reference: the arms run ~21% in from each vertex and the
 * middle ~58% of every edge is EMPTY. ⚠️ There is no faint hairline joining them
 * — a perpendicular scan across the gap decays smoothly from the outer ring with
 * no local peak. Do not "helpfully" add one back.
 */
function bracketPath(cx, cy, r, armFrac, every, flatTop) {
  const P = corners(cx, cy, r, flatTop);
  const at = (from, to, t) => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  const f = ([x, y]) => x.toFixed(2) + ',' + y.toFixed(2);
  let d = '';
  for (let i = 0; i < 6; i += every) {
    const cur = P[i], prev = P[(i + 5) % 6], next = P[(i + 1) % 6];
    d += `M${f(at(cur, prev, armFrac))} L${f(cur)} L${f(at(cur, next, armFrac))} `;
  }
  return d.trim();
}

/**
 * The brackets sit a shade DEEPER than the outer ring — `#28C1DE` against
 * `#00A8DC` in the reference, i.e. the same hue pushed to full saturation and
 * darkened a touch.
 *
 * 📌 DERIVED, NOT A TABLE. Every state has its own hue and each needs its own
 * matched pair; a lookup would be twelve more numbers to keep in step with the
 * twelve in the client. Greys are returned untouched — saturating a grey invents
 * a colour the state never had.
 */
export function deepen(hex) {
  const h = String(hex).replace('#', '').slice(0, 6);
  if (h.length < 6) return hex;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return hex;
  let hu = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hu *= 60; if (hu < 0) hu += 360;
  const s2 = Math.min(1, (d / (1 - Math.abs(2 * l - 1))) * 1.45), l2 = l * 0.86;
  const c = (1 - Math.abs(2 * l2 - 1)) * s2;
  const x = c * (1 - Math.abs((hu / 60) % 2 - 1)), m = l2 - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hu / 60) % 6];
  return '#' + seg.map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

/**
 * @param hue    the state's colour — the SAME `borderC` the old chip used, so the
 *               twelve-state colour language carries over untouched.
 * @param letter the note name. '' renders an empty socket (a spent slot).
 * @param dull   locked discord / staggered / empty — thin, dim, NO halo. 🎯 This
 *               is load-bearing: if every chip glowed, the panel would lose the
 *               one distinction it most needs to make at a glance.
 * @param stackSupport which chord stack makes this note legal. This is drawn as
 *               a small caret INSIDE the otherwise normally-coloured note, so
 *               payout information never replaces the note's musical state.
 *               `'both'` draws the Drive and Sustain carets side by side.
 * @param dual   legacy whole-chip dual pulse. New payout cues use stackSupport.
 * @param gold   resolves a cadence — outranks everything, keeps its own pulse.
 */
/** 🎆 The burst's two halves, built here so they share the chip's viewBox.
 *  `under` goes BEHIND the rings (the white core blooming out of / falling into
 *  the seat); `over` goes in front (the flash rim, the letter lifting away, the
 *  bracket ring taking its detent). ⚠️ THEY ARE KEYED ON `burst.key`. React
 *  reuses a DOM node whose position and type are unchanged, and a CSS animation
 *  does NOT restart on a node that was merely re-rendered — so committing a
 *  second note would fire silently, which reads as "the click didn't register".
 *  A fresh key forces a fresh node, which is the same trick the preview page
 *  uses when it clones the burst group rather than re-adding a class. */
function burstLayers(burst, flat, chipHue) {
  const B = NOTE_BURST;
  const IN  = burst.dir === 'in';
  const D   = Math.round(B.duration * (IN ? B.inScale : 1));
  const i   = B.intensity * (IN ? B.landScale : 1);
  // 📌 THE BURST BORROWS THE CHIP'S OWN HUE BY DEFAULT, and that is the point of
  // drawing it in here. The flare a note throws is the note's colour — root
  // green, tritone red, the stack's orange or blue once it seats — and the
  // caller firing the burst is a click handler that does not know any of that.
  // Letting the chip answer keeps one colour source instead of two that drift.
  const hue = burst.hue ?? chipHue, deep = deepen(hue);
  const total = B.detent * (IN ? B.landTurns : B.turns) * (IN ? -1 : 1);
  const anim = (name, ms, ease, delay = 0) => `${name} ${ms}ms ${ease} ${delay}ms both`;
  const under = (
    <g className="notehex-burst" key={`u${burst.key}`}>
      <polygon points={polyPoints(C, C, R * 0.9, flat)} fill="#ffffff"
        style={{ filter: `drop-shadow(0 0 ${(10 * i).toFixed(1)}px ${hue}) `
                       + `drop-shadow(0 0 ${(22 * i).toFixed(1)}px ${hue}aa)`,
          animation: anim(IN ? 'b-seat' : 'b-core', D, B.ease) }} />
    </g>
  );
  const over = (
    <g className="notehex-burst" key={`o${burst.key}`}>
      <polygon points={polyPoints(C, C, R, flat)} fill="none" stroke="#ffffff"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 ${(6 * i).toFixed(1)}px #ffffff) `
                       + `drop-shadow(0 0 ${(16 * i).toFixed(1)}px ${hue})`,
          animation: anim('b-flash', D, B.ease, IN ? Math.round(D * 0.5) : 0) }} />
      {/* The letter peels off the chip on the way out. There is nothing to peel
          on the way in — the letter is arriving, not leaving.
          ⚠️ THIS GOES THROUGH `noteLetter` FOR ONE REASON: it must be the SAME
          typesetting as the chip's own letter. It used to carry its own
          `fontSize={34}`, so an accidental set one way on the chip and another
          way here would have changed shape at the instant of the click. */}
      {!IN && burst.letter && noteLetter(burst.letter,
        `drop-shadow(0 0 ${(5 * i).toFixed(1)}px ${hue}) `
        + `drop-shadow(0 0 ${(13 * i).toFixed(1)}px ${hue}cc)`,
        NOTE_HEX, { animation: anim('b-lift', D, 'cubic-bezier(.2,.8,.3,1)') })}
      {NOTE_HEX.brackets && (
        <path d={bracketPath(C, C, R * NOTE_HEX.bracketR, NOTE_HEX.bracketArm,
                             NOTE_HEX.bracketEvery, flat)}
          fill="none" stroke={deep} strokeWidth={2.6} strokeLinejoin="miter"
          style={{ '--det': `${total}deg`,
            // the overshoot the ring settles back from — this is what makes the
            // spin read as a mechanism clicking home rather than as a fade
            '--det-over': `${total + B.detent * 0.14 * (IN ? -1 : 1)}deg`,
            filter: `drop-shadow(0 0 ${(5 * i).toFixed(1)}px ${deep}) `
                  + `drop-shadow(0 0 ${(13 * i).toFixed(1)}px ${deep}88)`,
            animation: anim('b-detent', Math.round(D * B.spinTime / 100), B.ease) }} />
      )}
    </g>
  );
  return [under, over];
}

export default function NoteHex({
  hue, letter = '', dull = false, dual = false, gold = false, stackSupport = null,
  size = NOTE_HEX.size, cfg = NOTE_HEX, burst = null,
}) {
  const flat = cfg.flatTop;
  const g = px => (px * cfg.bloom).toFixed(1);
  const deep = deepen(hue);

  const bloom = dull
    ? (cfg.bloom > 0 ? `drop-shadow(0 0 ${g(1.2)}px ${hue}66)` : 'none')
    : `drop-shadow(0 0 ${g(1.6)}px #ffffffcc) drop-shadow(0 0 ${g(4)}px ${hue}) `
      + `drop-shadow(0 0 ${g(11)}px ${hue}99)`;

  // Faint rings outside the main one. Off by default — they compete with the
  // bloom and lose above roughly 70%.
  const EDGE = [{ r: R * 1.20, w: 1.5, o: dull ? .10 : .34 },
                { r: R * 1.40, w: 1.1, o: dull ? .05 : .16 }];

  const lg = cfg.letterGlow ?? hue;
  const [burstUnder, burstOver] = burst ? burstLayers(burst, flat, hue) : [null, null];

  return (
    <svg className={`notehex${dual ? ' notehex-dual' : ''}`} width={size} height={size}
      data-note-support={stackSupport || undefined}
      viewBox={`0 0 ${VB} ${VB}`} style={{ overflow: 'visible', display: 'block' }}
      aria-hidden="true" focusable="false">
      {/* ⚠️ A transparent fill, NOT `fill="none"`. The hex is hollow, and `none`
          lets a pointer fall straight through the middle to whatever is behind. */}
      <polygon points={polyPoints(C, C, R, flat)} fill="transparent" />
      {burstUnder}

      <g className="notehex-glow" style={{
        filter: bloom,
        animation: gold ? 'cadence-gold-pulse 1.6s ease-in-out infinite' : undefined,
      }}>
        {EDGE.slice(0, cfg.outerEdges).map((e, i) => (
          <polygon key={i} className="notehex-ring" points={polyPoints(C, C, e.r, flat)}
            fill="none" stroke={hue} strokeWidth={e.w} strokeOpacity={e.o} strokeLinejoin="round" />
        ))}
        <polygon className="notehex-ring" points={polyPoints(C, C, R, flat)} fill="none"
          stroke={hue} strokeWidth={dull ? 2 : 3.4} strokeOpacity={dull ? .55 : 1}
          strokeLinejoin="round" />
        {/* the white-hot core of the filament, sitting inside the hue stroke */}
        {!dull && (
          <polygon points={polyPoints(C, C, R, flat)} fill="none" stroke="#ffffff"
            strokeWidth={1.1} strokeOpacity={.55} strokeLinejoin="round" />
        )}
      </g>

      {/* 📌 `notehex-brk-g` AND THE TRANSFORM BOX ARE FOR THE FLYING CHIP.
          NoteFlyChip spins this group on the way to its seat; an SVG group
          rotates about the USER-SPACE origin (0,0 — the chip's top-left corner)
          unless told otherwise, so without `view-box` + an explicit centre the
          ring would swing round the corner instead of spinning in place. Inert
          on every chip that is not in flight. */}
      {cfg.brackets && (
        <g className="notehex-brk-g"
          style={{ filter: dull ? 'none' : `drop-shadow(0 0 ${g(2.5)}px ${deep}bb)`,
            transformBox: 'view-box', transformOrigin: `${C}px ${C}px` }}>
          <path className="notehex-brk"
            d={bracketPath(C, C, R * cfg.bracketR, cfg.bracketArm, cfg.bracketEvery, flat)}
            fill="none" stroke={deep} strokeWidth={dull ? 1.6 : 2.6}
            strokeOpacity={dull ? .5 : 1} strokeLinejoin="miter" strokeLinecap="butt" />
        </g>
      )}

      {letter !== '' && noteLetter(letter,
        dull ? 'none'
          : `drop-shadow(0 0 ${g(2.5)}px ${lg}) drop-shadow(0 0 ${g(7)}px ${lg}cc)`,
        cfg)}
      {/* A payout hint belongs inside the note, not in the note's ring colour.
          The open chevron stays legible at the smallest in-game chip size and
          leaves enough air around flat/sharp note names. */}
      {letter !== '' && stackSupport && (
        <g className="notehex-support" fill="none" strokeWidth={3.6}
          strokeLinecap="round" strokeLinejoin="round">
          {(stackSupport === 'drive' || stackSupport === 'both') && (
            <path className="notehex-support-drive"
              d={stackSupport === 'both' ? 'M45 88 L51 82 L57 88' : 'M52 88 L60 80 L68 88'}
              stroke="#ff6644" style={{ filter:'drop-shadow(0 0 3px #ff6644aa)' }} />
          )}
          {(stackSupport === 'sustain' || stackSupport === 'both') && (
            <path className="notehex-support-sustain"
              d={stackSupport === 'both' ? 'M63 88 L69 82 L75 88' : 'M52 88 L60 80 L68 88'}
              stroke="#44aaff" style={{ filter:'drop-shadow(0 0 3px #44aaffaa)' }} />
          )}
        </g>
      )}
      {burstOver}
    </svg>
  );
}
