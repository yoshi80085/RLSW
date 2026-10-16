// ─── ✚ THE ABILITY CROSS — four chips round your Spirit (Move & Act, pad mode) ─
// Alex, 2026-10-14: *"the option for abilities should be able to be accessed easily
// without mouse/keyboard"* → the D-pad IS the cross: ◀ ▶ your two signatures, ▲ the
// Sonic, ▼ the Thrash (`CROSS_MAPS.sides`, his dial-in). This draws it where the
// preview did (`crossPlace: 'standee'`), round the acting Spirit's hex.
//
// ⭐ IT OWNS NO RULE. Each chip MIRRORS a button on the action rail
// (`[data-pad-ability]`): its icon and words are that button's, it greys when that
// button is disabled, and it lights when that ability is armed. Pressing the
// direction CLICKS that button (the monolith's `padCrossPress`), so every gate the
// mouse meets — AP, the Action Token, the cooldown, Drive notes — is the pad's too.
// Read from the DOM once a frame, because the hex moves whenever the lens turns.
import { useEffect, useRef, useState } from 'react';
import { PAD_RING } from '../input/padFocus.js';
import { PAD_TURN } from '../input/padTurn.js';
import { crossButton } from './padTurnUi.js';


const DIRS = [['Up', 0, -1], ['Right', 1, 0], ['Down', 0, 1], ['Left', -1, 0]];
const ARROW = { Up: '▲', Down: '▼', Left: '◀', Right: '▶' };

function read(doc, hexNum) {
  const hex = doc.querySelector(`[data-hex-num="${hexNum}"]`);
  const r = hex?.getBoundingClientRect?.();
  if (!r || !r.width) return null;
  const chips = DIRS.map(([d]) => {
    const b = crossButton(doc, d);
    if (!b) return { d, none: true };
    const label = (b.textContent ?? '').replace(/\s+/g, ' ').trim();
    return { d, label, off: !!b.disabled, on: /\bon\b/.test(b.className) || b.getAttribute('aria-pressed') === 'true' || b.dataset.padArmed === 'on' };
  });
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, chips };
}
const same = (a, b) => !!a && !!b && Math.abs(a.x - b.x) < .5 && Math.abs(a.y - b.y) < .5 && Math.abs(a.w - b.w) < .5
  && a.chips.every((c, i) => c.label === b.chips[i].label && c.off === b.chips[i].off && c.on === b.chips[i].on && c.none === b.chips[i].none);

export function PadCross({ hexNum, size = PAD_TURN.crossSize, accent = '#80e8ff' }) {
  const [at, setAt] = useState(null);
  const last = useRef(null);
  useEffect(() => {
    if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return undefined;
    let raf = 0;
    const step = () => {
      raf = requestAnimationFrame(step);
      const next = read(document, hexNum);
      if (!same(next, last.current)) { last.current = next; setAt(next); }
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, [hexNum]);
  if (!at) return null;
  const reach = Math.max(46, at.w * .9) * size;
  return <div className="pc-cross" data-pad-cross={hexNum} data-pad="skip" aria-hidden="true">
    {at.chips.map(c => c.none ? null : <div key={c.d} className={`pc-chip${c.on ? ' on' : ''}${c.off ? ' off' : ''}`} data-cross-dir={c.d}
      style={{ left: at.x + DIRS.find(x => x[0] === c.d)[1] * reach, top: at.y + DIRS.find(x => x[0] === c.d)[2] * reach * .78,
        transform: `translate(-50%, -50%) scale(${size})`, '--acc': accent, '--ring': PAD_RING.color }}>
      <i>{ARROW[c.d]}</i><span>{c.label}</span>
    </div>)}
  </div>;
}

