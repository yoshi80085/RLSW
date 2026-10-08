// ─── 🎸 THE HAMMER-ON'S PICTURE AND SOUND — one copy for the game and the page ─
// The Ronin's hammer-on / pull-off (MELODY_IDENTITY_DESIGN.md §13). The RULE is
// `music/noteTechniques.js`; this file is only how it looks and sounds.
//
// ✅ `HAMMER_LOOK` IS ALEX'S DIAL-IN (2026-10-08, `.scratch/hammer-on-preview.html`):
// *0 of 24 levers moved* — every default below is a decision, not a guess.
// ⚠️ The preview IMPORTS this file and builds its levers from `HAMMER_LOOK`, so
// a re-dial starts at the game's numbers and the two can never drift (§B1).
//
// What the game uses of it: the own-row button above ✓ Commit, the two pick
// pips (button and the MELODY plate), the ghost of the next note in the next
// seat with its H key, the gold slur with h / p over a hammered note, the
// strike-in arrival, and the legato KATANA voice (`hammerVoice`).
import { pitchIndex } from '../music/notes.js';
import { HAMMER_ON, HAMMER_DARK_WHY } from '../music/noteTechniques.js';

export const HAMMER_LOOK = Object.freeze({
  place: 'own row',      // own row · commit row · track only
  label: 'words',        // words · short · icon
  showNote: 'on',
  pays: 'inline',        // inline · hover · off
  dark: 'grey + why',    // grey + why · grey · hidden
  hue: 'gold',           // gold · violet · player
  keyCap: 'on',
  btnPx: 8,              // ✓ Commit is 8
  pips: 'both',          // button · plate · both
  pipStyle: 'picks',     // picks · dots · hammers
  pipPx: 8,
  ghost: 'always',       // always · on hover · off
  ghostAlpha: 0.4,
  mark: 'slur',          // slur · tab · badge · none
  markHue: 'gold',
  markPx: 11,
  chipTint: 'note',      // note · technique
  arrive: 'strike',      // strike · slide · fade · none
  arriveMs: 220,
  slurMs: 25,            // the pitch glides from the note before over this long
  punch: 1.0,            // 1.35 = a picked KATANA note · 1.0 = no pick
  attackMs: 14,
  hammerVol: 0.85,       // vs a picked note
  hammerBeat: 0.5,       // ▶ playback: how soon it follows, as a share of a beat
});

export const HAMMER_HUES = Object.freeze({ gold: '#ffc94a', violet: '#aa88ff', white: '#e8eef8' });
/** The button's colour; `player` is the seat's own. */
export const hammerHue = (look, seatColor) =>
  look.hue === 'player' ? (seatColor ?? HAMMER_HUES.gold) : HAMMER_HUES[look.hue] ?? HAMMER_HUES.gold;

// The two measurements the track's marks are placed by (COMMIT_OVERLAY.trackChip
// and the row's gap in NoteCommitOverlay.jsx). Passed in, not imported, so the
// preview and the game can lay out at their own seat size.
export const HAMMER_CSS = `
  @keyframes hammer-strike{0%{transform:translateY(-26px) scale(1.14);opacity:0}55%{transform:translateY(3px) scale(1.06,.9);opacity:1}100%{transform:none;opacity:1}}
  @keyframes hammer-slide{0%{transform:translateX(var(--hammer-from,-75px));opacity:.15}100%{transform:none;opacity:1}}
  @keyframes hammer-fade{0%{opacity:0}100%{opacity:1}}
  @keyframes hammer-coach-pulse{0%,100%{box-shadow:0 0 4px var(--hammer-coach)}50%{box-shadow:0 0 14px 3px var(--hammer-coach)}}
  @media (prefers-reduced-motion: reduce){[data-hammer-arrive],[data-hammer-coach]{animation:none!important}}
`;
/** The seat's style for a note that just arrived by hammer. */
export const hammerArriveStyle = (look, seat, gap) => look.arrive === 'none' ? {} : {
  animation: `hammer-${look.arrive} ${look.arriveMs}ms cubic-bezier(.2,.9,.3,1.2) both`,
  '--hammer-from': `${-(seat + gap)}px`,
};

export const prettyNote = n => String(n).replace(/^([A-G])b$/, '$1♭').replace(/^([A-G])#$/, '$1♯');
export const paysText = p => p > 0 ? `+${p} fan${p === 1 ? '' : 's'}` : 'no new fans';
export const techName = label => label === 'pull' ? 'Pull-off' : 'Hammer-on';
const techWord = (label, style) => style === 'icon' ? '🔨'
  : style === 'short' ? (label === 'pull' ? 'P-OFF' : 'H-ON')
  : (label === 'pull' ? '🔨 PULL-OFF' : '🔨 HAMMER-ON');
/** What the note carries on, in words. */
export function viaText(c) {
  if (!c?.ok) return '';
  const parts = [];
  if (c.via.contour === 1) parts.push('carries on the shred (letter steps)');
  if (c.via.contour === 2) parts.push('carries on the arpeggio skip (letter skips)');
  if (c.via.craft) parts.push(`makes a ${c.via.craft}-note run`);
  return parts.join(' · ');
}

function Pip({ full, kind, px, hue }) {
  const c = full ? hue : '#3a4258';
  if (kind === 'hammers') return <span style={{ fontSize: px * 1.25, lineHeight: 1, opacity: full ? 1 : 0.28,
    filter: full ? `drop-shadow(0 0 3px ${hue})` : 'none' }}>🔨</span>;
  if (kind === 'dots') return <span style={{ width: px, height: px, borderRadius: '50%', display: 'inline-block',
    background: full ? hue : 'transparent', border: `1px solid ${c}`, boxShadow: full ? `0 0 5px ${hue}` : 'none' }} />;
  // a guitar pick, point down
  return <svg width={px} height={px * 1.15} viewBox="0 0 10 11.5" aria-hidden="true"
    style={{ display: 'block', overflow: 'visible', filter: full ? `drop-shadow(0 0 3px ${hue})` : 'none' }}>
    <path d="M5 11 C2.2 8 0.4 5.2 0.6 3 C0.8 0.9 3 0.5 5 0.5 C7 0.5 9.2 0.9 9.4 3 C9.6 5.2 7.8 8 5 11 Z"
      fill={full ? hue : 'none'} stroke={c} strokeWidth="1" /></svg>;
}

/** The charges: one mark per seat in the bank, filled for each charge held. */
export function HammerPips({ n, look, hue }) {
  return <span data-hammer-pips={n} title={`${n} of ${HAMMER_ON.bank} hammer-on charges · +${HAMMER_ON.perTurn} at the end of each of your turns`}
    style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
    {Array.from({ length: HAMMER_ON.bank }, (_, i) => <Pip key={i} full={i < n} kind={look.pipStyle} px={look.pipPx} hue={hue} />)}
  </span>;
}

/** The charges on the MELODY panel's frame, beside "3 / 8". It sits as an
 *  absolute child of the track's seat row (`CommitTrackPanel` → TrackRow), the
 *  one positioned box that carries both layouts. */
export function HammerPlate({ n, look, hue }) {
  return <span data-hammer-plate style={{ position: 'absolute', top: -18, right: 64, zIndex: 3, display: 'inline-flex', gap: 4,
    alignItems: 'center', padding: '1px 5px', background: '#070b16', font: "700 8px 'Share Tech Mono',monospace", color: hue,
    pointerEvents: 'auto' }}>
    {look.pipStyle === 'hammers' ? null : 'H'} <HammerPips n={n} look={look} hue={hue} /></span>;
}

/**
 * 🔨 The button. `cand` is `hammerCandidate(…)`'s answer; it is lit only when
 * `cand.ok`. `square` = the commit-row variant (preview only today).
 */
export function HammerButton({ cand, charges, look, hue, onHammer, onHover = () => {}, square = false, coach = null, coachMs = 900 }) {
  const lit = !!cand?.ok;
  if (!lit && look.dark === 'hidden') return null;
  const why = lit ? '' : HAMMER_DARK_WHY[cand?.reason] ?? '';
  const tip = lit ? `${techName(cand.label)}: adds ${prettyNote(cand.note)} — ${viaText(cand)} · ${paysText(cand.pays)} · key H · no hand note spent`
    : `Hammer-on unavailable — ${why}`;
  const c = lit ? hue : '#4a5266';
  const showPips = look.pips !== 'plate';
  const word = techWord(lit ? cand.label : 'hammer', square ? (look.label === 'words' ? 'short' : look.label) : look.label);
  // 🎤 The fans are asking for it (`crowdAsks` → `hammerNext`): pulse or ring.
  const coached = lit && (coach === 'pulse' || coach === 'ring');
  return <button type="button" className="btn" data-hammer-button={lit ? 'lit' : cand?.reason} title={tip}
    data-hammer-coach={coached ? coach : undefined}
    aria-disabled={!lit} onClick={lit ? onHammer : undefined}
    onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}
    style={{ borderColor: c, color: c, fontSize: look.btnPx, cursor: lit ? 'pointer' : 'default',
      display: 'flex', alignItems: 'center', gap: 5, justifyContent: square ? 'center' : 'flex-start',
      ...(square ? { flexDirection: 'column', gap: 2, padding: '2px 5px', minWidth: 44 } : { width: '100%', marginBottom: 3 }),
      background: lit ? `color-mix(in srgb, ${hue} 9%, transparent)` : 'transparent',
      boxShadow: lit ? `0 0 6px color-mix(in srgb, ${hue} 35%, transparent)` : 'none', opacity: lit ? 1 : 0.7,
      ...(coached ? { '--hammer-coach': hue,
        ...(coach === 'pulse' ? { animation: `hammer-coach-pulse ${coachMs}ms ease-in-out infinite` } : { outline: `2px solid ${hue}`, outlineOffset: 2 }) } : {}) }}>
    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{word}</span>
    {lit && look.showNote === 'on' && <span style={{ fontWeight: 700, color: '#fff' }}>{square ? prettyNote(cand.note) : `→ ${prettyNote(cand.note)}`}</span>}
    {lit && look.pays === 'inline' && !square && <span style={{ color: cand.pays > 0 ? '#ffe28a' : '#8a94a8' }}>· {paysText(cand.pays)}</span>}
    {!lit && look.dark === 'grey + why' && !square && <span style={{ color: '#7a8296', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {why}</span>}
    <span style={{ marginLeft: square ? 0 : 'auto', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      {showPips && <HammerPips n={charges} look={look} hue={hue} />}
      {look.keyCap === 'on' && !square && <kbd style={{ font: `700 ${Math.max(6, look.btnPx - 1)}px 'Share Tech Mono',monospace`,
        border: `1px solid ${c}`, borderRadius: 2, padding: '0 3px', color: c }}>H</kbd>}
    </span>
  </button>;
}

/** The H key under the ghost of the next note. */
export function HammerGhostKey({ hue }) {
  return <kbd style={{ position: 'absolute', bottom: -3, font: "700 8px 'Share Tech Mono',monospace",
    color: hue, border: `1px solid ${hue}`, borderRadius: 2, padding: '0 3px', background: '#070b16', pointerEvents: 'none' }}>H</kbd>;
}

/**
 * The mark on a hammered note's seat: a slur from the seat before with h / p,
 * the tab letter between the seats, or a badge. Absolute inside the seat.
 * `seat` / `gap` are the track's chip box and the gap between seats.
 */
export function HammerMark({ tech, look, seat, gap, first = false }) {
  const hue = HAMMER_HUES[look.markHue] ?? HAMMER_HUES.gold;
  const ch = tech === 'pull' ? 'p' : 'h';
  const font = `700 ${look.markPx}px 'Share Tech Mono',monospace`;
  if (look.mark === 'badge') return <span data-hammer-mark={ch} style={{ position: 'absolute', top: 4, right: 6, zIndex: 2, font, lineHeight: 1,
    color: '#0a0f1c', background: hue, borderRadius: 3, padding: '1px 3px', boxShadow: `0 0 6px ${hue}`, pointerEvents: 'none' }}>{ch}</span>;
  if (first) return null;   // the slur and the tab letter both reach back to a seat that must exist
  if (look.mark === 'tab') return <span data-hammer-mark={ch} style={{ position: 'absolute', left: -(gap / 2), top: '50%',
    transform: 'translate(-50%,-50%)', zIndex: 2, font, color: hue, background: '#070b16', padding: '0 2px', lineHeight: 1,
    textShadow: `0 0 5px ${hue}`, pointerEvents: 'none' }}>{ch}</span>;
  if (look.mark !== 'slur') return null;
  const w = seat + gap;
  return <svg data-hammer-mark={ch} width={w} height={30} viewBox={`0 0 ${w} 30`} aria-hidden="true"
    style={{ position: 'absolute', left: -(gap + seat / 2), top: -16, overflow: 'visible', pointerEvents: 'none',
      filter: `drop-shadow(0 0 3px ${hue})` }}>
    <path d={`M4 26 Q${w / 2} -2 ${w - 4} 26`} fill="none" stroke={hue} strokeWidth="1.8" strokeLinecap="round" />
    <text x={w / 2} y={9 - look.markPx * 0.25} textAnchor="middle" fill={hue} style={{ font }}>{ch}</text>
  </svg>;
}

/**
 * 🔊 The hammered note's voice, for `playAmpNote` (or the client's
 * `playNoteSound`, which forwards these options): above the note before for a
 * hammer-on, below it for a pull-off, gliding from its pitch over `slurMs`, with
 * the pick's punch taken out. `null` when there is nothing to slur from.
 * ⚠️ `lead` only reaches a voice that has lead stages — the Ronin's KATANA does.
 */
export function hammerVoice(look, prevHz, note, dir, baseVolume = 0.18) {
  const pc = pitchIndex(note);
  if (pc < 0 || !(prevHz > 0)) return null;
  const prev = Math.round(69 + 12 * Math.log2(prevHz / 440));
  let m = prev - (((prev - pc) % 12) + 12) % 12;        // highest at or below
  if (dir === 'up') { if (m <= prev) m += 12; } else if (m >= prev) m -= 12;
  return {
    freq: 440 * 2 ** ((m - 69) / 12), volume: baseVolume * look.hammerVol, attackTime: look.attackMs / 1000,
    lead: { punch: look.punch, pickBright: 1 + (look.punch - 1) * 2 },
    ...(look.slurMs > 0 ? { bend: prev - m, bendTime: look.slurMs / 1000 } : {}),
  };
}
