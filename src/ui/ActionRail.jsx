// ─── 🎛️ THE ACTION RAIL — Step 3's buttons, split into what everyone has and
//     what you paid for ────────────────────────────────────────────────────────
//
// Ported from `.scratch/hud-step3-rail.html` at the values Alex landed on
// 2026-08-29. Four things moved at once and they are one design, not four:
//
//   ① the rail came UP. It used to sit at the very bottom of the HUD column,
//      below the RACE meter and the Note Stock, so "what can I do" was the
//      furthest thing from the card that says who you are. It now sits directly
//      under the spirit card, where the eye already is during step 3.
//   ② the buttons got bigger and they RAKE — a shear and a corner chamfer, the
//      amp-panel language the channel strip and the board panels already speak.
//   ③ the Note Stock folded into the KEY plate as a drawer (see ChannelStrip).
//   ④ the plate turned step-aware (same file).
//
// ⚠️ WHY THIS IS A COMPONENT AND NOT MARKUP IN THE CLIENT — the same reason
// `ChannelStrip.jsx` is. Everything here is SHELL: geometry, lighting, which
// side a button sits on. Every button, every gate and every handler stays in
// `rlsw-simulator-v3_8_1.jsx`. A mistake in this file can misdraw the rail; it
// cannot let you swing twice.

/** 🎛️ ALEX'S DIAL-IN, 2026-08-29, read off the preview page's readout bar.
 *  ⚠️ DO NOT NUDGE THESE BY EYE. Re-open `.scratch/hud-step3-rail.html`, move
 *  the slider, screenshot the readout, port the line. That loop exists because
 *  the last four HUD passes that skipped it had to be redone.
 *
 *  📌 `splitPct: 40` is not a typo for half. The universal side holds five or
 *  six buttons that never change; the signature side is the one that GROWS as a
 *  Spirit unlocks its kit, so it gets the wider half. A 50/50 split looked
 *  right on the Ronin and wrapped Intergalactic 0 to four rows. */
export const ACTION_RAIL = {
  // the buttons
  shear:      -8,     // deg. The strip leans -4; these lean harder because they
                      // are the thing you are meant to reach for.
  chamfer:     5,     // px of corner cut, ON TOP of the shear — both, not either
  chamCnr: 'tl-br',   // 'br' | 'tl-br' | 'tr-bl'
  height:     33,     // px
  font:       12,     // px
  padX:       11,     // px, before the shear's slack is added
  gap:         4,     // px between buttons
  minW:        0,     // px floor per button. 0 = shrink to content.
  grow:    false,     // stretch buttons to fill the row's slack
  bloom:    1.05,     // multiplier on a live button's outer glow
  wash:     0.18,     // how much of its own colour a live button is washed with

  // the split
  split: 'columns',   // 'columns' | 'rows' | 'off'
  splitPct:   40,     // % of the rail the UNIVERSAL side takes. See 📌 above.
  seam:   'wedge',    // 'wedge' | 'rule' | 'gap' | 'none'
  labels: 'words',    // 'words' | 'short' | 'none'
  tint:     true,     // a faint amber ground behind the signature side
};

const R = ACTION_RAIL;

/* 🪚 THE CHAMFER. Cut on the button itself, so a sheared button still gets a
   square-cut corner rather than a skewed one — clip-path is applied in the
   element's own box, before the transform. */
function chamPath(px, cnr) {
  if (!px) return 'none';
  const p = `${px}px`;
  if (cnr === 'tl-br')
    return `polygon(${p} 0,100% 0,100% calc(100% - ${p}),calc(100% - ${p}) 100%,0 100%,0 ${p})`;
  if (cnr === 'tr-bl')
    return `polygon(0 0,calc(100% - ${p}) 0,100% ${p},100% 100%,${p} 100%,0 calc(100% - ${p}))`;
  return `polygon(0 0,100% 0,100% calc(100% - ${p}),calc(100% - ${p}) 100%,0 100%)`;
}

/** ⚠️ THE SHEAR'S SLACK, twice over, and it is the same fact both times.
 *  A skew rotates the box but lays its CONTENT out in the pre-skew rectangle, so
 *  anything near a raked edge walks out past it and `overflow:hidden` eats it.
 *  The button pays for it in side padding; the two sides pay for it in the
 *  gutter between them, or the last button of the universal half collides with
 *  the SIGNATURE label. Both scale with the angle, so at shear 0 they correctly
 *  vanish — the same trick `KeyPlate` uses to stop "m7" falling off the plate. */
const SLACK  = Math.round(Math.abs(Math.tan(R.shear * Math.PI / 180)) * R.height * 0.55);
const GUTTER = R.gap + 4 + Math.round(Math.abs(Math.tan(R.shear * Math.PI / 180)) * R.height);

/** The CSS custom properties the `.arail` rules in GameStyles.jsx read.
 *  📌 They are set HERE rather than hardcoded in the stylesheet so that the one
 *  dial-in object above stays the single source of these numbers. */
export const RAIL_VARS = {
  '--rb-h':      `${R.height}px`,
  '--rb-px':     `${R.padX + SLACK}px`,
  '--rb-fs':     `${R.font}px`,
  '--rb-gap':    `${R.gap}px`,
  '--rb-minw':   R.minW ? `${R.minW}px` : '0',
  '--rb-shear':  `${R.shear}deg`,
  '--rb-unshear':`${-R.shear}deg`,
  '--rb-clip':   chamPath(R.chamfer, R.chamCnr),
  '--rb-bloom':  String(R.bloom),
  '--rb-wash':   `${Math.round(R.wash * 100)}%`,
};

const LABELS = { words: ['UNIVERSAL', 'SIGNATURE'], short: ['ALL', 'YOURS'], none: null };

function SideLabel({ text, color }) {
  if (!text) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5,
      fontFamily: "'Saira Stencil One',sans-serif", fontSize: 6.5,
      letterSpacing: 2.2, whiteSpace: 'nowrap', color }}>
      {text}
      <i style={{ flex: 1, height: 1,
        background: `linear-gradient(90deg,${color}44,transparent)` }} />
    </div>
  );
}

/**
 * 🎚️ THE RAIL.
 * @param universal the buttons every Spirit has — Move, Face, Swing, Smash,
 *        Sonic, Pose, Strike, End. `data-tip-anchor="actions-bar"` lives on this
 *        side; four tutorial pages aim at it and it must not move.
 * @param signature what THIS Spirit owns. ⚠️ NOT the same as "unlocked" — the
 *        Monster's Slime is innate and still belongs here, because the question
 *        the split answers is "is this mine, or is this everyone's". A rival can
 *        predict the left half of your rail and cannot predict the right.
 *
 * 🌀 THE ONE GENUINELY AMBIGUOUS BUTTON is Intergalactic 0's Blaster of Ra: an
 * unlock, Spirit-specific, and therefore signature by the rule above — but it
 * does not ADD a button, it REPLACES the Smash. It is filed universal because
 * the SLOT is universal, and a rival looking at that rail still sees "he has an
 * attack there", which is the thing the left half is for.
 */
export function ActionRail({ universal, signature }) {
  const lab = LABELS[R.labels];
  const hasSig = !!signature;

  const uniSide = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <SideLabel text={lab?.[0]} color="#5a7a9a" />
      <div className="arail-row" data-tip-anchor="actions-bar">{universal}</div>
    </div>
  );
  const sigSide = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
      ...(R.tint ? { background: 'linear-gradient(100deg,#ffcc4407,transparent)',
        borderRadius: 4, padding: '3px 4px', margin: '-3px -4px' } : {}) }}>
      <SideLabel text={lab?.[1]} color="#ffcc44" />
      <div className="arail-row">{signature}</div>
    </div>
  );

  /* 🪚 THE SEAM rakes by the SAME angle as the buttons, so the divide reads as
     part of the panel rather than as a border someone added afterwards. At
     shear 0 it stands upright, which is correct: nothing should lean alone. */
  const seam = R.seam === 'none' ? null
    : R.seam === 'gap' ? <div style={{ flex: `0 0 ${R.gap * 3}px` }} />
    : <div style={{ flex: '0 0 1px', width: 1, alignSelf: 'stretch',
        transform: R.seam === 'wedge' ? `skewX(${R.shear}deg)` : undefined,
        background: R.seam === 'wedge'
          ? 'linear-gradient(180deg,transparent,#2b3f5c,transparent)' : '#1d2a3d' }} />;

  if (R.split === 'off' || !hasSig) {
    return (
      <div className="arail" style={RAIL_VARS}>
        <div className="arail-row" data-tip-anchor="actions-bar">{universal}{signature}</div>
      </div>
    );
  }
  if (R.split === 'rows') {
    return (
      <div className="arail" style={{ ...RAIL_VARS, display: 'flex',
        flexDirection: 'column', gap: R.gap + 3 }}>
        {uniSide}
        {R.seam !== 'none' && (
          <div style={{ height: 1, background: 'linear-gradient(90deg,#2b3f5c,transparent)' }} />
        )}
        {sigSide}
      </div>
    );
  }
  return (
    <div className="arail" style={{ ...RAIL_VARS, display: 'flex',
      alignItems: 'stretch', gap: GUTTER }}>
      <div style={{ flex: `0 0 ${R.splitPct}%`, minWidth: 0 }}>{uniSide}</div>
      {seam}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>{sigSide}</div>
    </div>
  );
}

/**
 * 🔘 ONE BUTTON. A plain `<button>` with the label wrapped in a counter-skewed
 * span, and nothing else — every prop, handler, title and inline colour passes
 * straight through to the real element.
 *
 * ⚠️ THE WRAPPER SPAN IS THE WHOLE POINT OF THIS COMPONENT. One un-skew layer,
 * never two — the same rule the strip, the plate and the board panels obey. The
 * BOX rakes and the words stay upright, because a leaning label reads as a
 * rendering fault while a leaning box reads as a design. There is no CSS-only
 * way to counter-skew a text node, which is why every rail button goes through
 * here instead of the raw `.btn` class.
 */
export function RailBtn({ children, ...rest }) {
  return <button {...rest}><span className="rb-in">{children}</span></button>;
}
