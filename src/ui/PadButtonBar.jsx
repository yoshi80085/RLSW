// ─── 🧭 THE BUTTON BAR — what each button does RIGHT NOW ────────────────────
// Alex, 2026-10-14, took the four pad-turn ideas — the fourth was this: a strip
// under the arena naming, step by step, what each button on the pad does. Ported
// from `.scratch/pad-turn-preview.jsx` at his dial-in (0 of 30 levers moved):
// bottom-centre, ×1, Xbox colours, labels on, .92 opacity, and ⌨️ IN MOUSE MODE IT
// SHOWS THE KEYS instead of hiding (`barMouseKeys`) — the same bar teaches a–g,
// Tab, Enter and H to a keyboard player.
//
// Pure presentation. The verbs are the monolith's (it knows the step); this file
// only draws them and listens for the pad/mouse flip (`INPUT_MODE_EVENT`).
import { PAD_TURN } from '../input/padTurn.js';
import { MOUSE_KEY } from './padTurnUi.js';


const XBOX = { A: '#5cb946', B: '#e0473c', X: '#3e8ed0', Y: '#f5c518' };

/** One button's glyph — Xbox colours, or `mono`; a keycap in mouse mode. */
function PadGlyph({ b, look = PAD_TURN.barGlyphs, mouse = false, hint }) {
  if (mouse) return <kbd className="pb-key">{MOUSE_KEY[hint ?? b] ?? b}</kbd>;
  const mono = look === 'mono';
  if (XBOX[b]) return <span className="pb-face" style={mono ? { borderColor: '#cfe', color: '#cfe' } : { background: XBOX[b], borderColor: XBOX[b], color: '#0b0f1c' }}>{b}</span>;
  if (b === 'LS' || b === 'RS') return <span className="pb-stick" style={{ borderColor: mono ? '#cfe' : '#9ab' }}>{b[0]}</span>;
  if (b.startsWith('D')) return <span className="pb-dpad">{b === 'Dpad' ? '✚' : { DUp: '▲', DDown: '▼', DLeft: '◀', DRight: '▶' }[b]}</span>;
  if (b === 'View') return <span className="pb-bump" style={{ borderColor: mono ? '#cfe' : '#9ab' }}>⧉</span>;
  return <span className="pb-bump" style={{ borderColor: mono ? '#cfe' : '#9ab' }}>{b}</span>;
}


/**
 * @param verbs  `[[button, label, keyHint?, inMouse?]]` — `keyHint` names the MOUSE_KEY to show
 *               in mouse mode; `inMouse === false` drops the verb there (a pad-only verb).
 * @param mode   'pad' | 'mouse' (`usePadMode()`)
 */
export function PadButtonBar({ verbs = [], mode = 'pad', look = PAD_TURN }) {
  const mouse = mode !== 'pad';
  if (!verbs.length || (mouse && !look.barMouseKeys)) return null;
  const shown = verbs.filter(v => !mouse || v[3] !== false);
  if (!shown.length) return null;
  return <div className={`pb-bar pb-${look.barPlace}`} data-pad-bar={mode} aria-label="Controls" data-pad="skip"
    style={{ transform: `${look.barPlace === 'left' ? '' : 'translateX(-50%) '}scale(${look.barScale})`, opacity: look.barOpacity }}>
    {shown.map(([b, label, hint], i) => <span key={i} className="pb-verb" data-pad-verb={b}>
      <PadGlyph b={b} look={look.barGlyphs} mouse={mouse} hint={hint} />{look.barLabels && <em>{label}</em>}</span>)}
  </div>;
}
