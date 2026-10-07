// ─── 🪪 THE SPIRIT SHEET — the window the SPIRIT card's ＋ opens ─────────────
//
// Alex, 2026-10-07: rebuild "the old 2D version" in the arena's current look.
// Everything this draws is `sheetModel`'s (spiritSheetModel.js); every taste
// call is a field of `P` (`SPIRIT_SHEET`). ✅ IN THE GAME at Alex's 2026-10-07
// dial-in (`.scratch/spirit-sheet-preview.html`, 6 of 25 levers moved) — the
// monolith mounts it in `<HudRegion name="spirit">` in place of the old 2D card.
//
// 🎯 THE LOOK IS THE POCKET'S, NOT A NEW ONE: one `Bracket` (corners bright,
// edges nearly dark, a flat scrim, no blur), stencil plates, the seat portrait's
// head cut, the arena's NoteHex chips. Nothing here is a new visual language.
//
// ⚠️ ONE FRAME, NOT A FRAME IN A BOX. `[data-hud-region="spirit"]` paints its own
// chamfered scrim, and twice already Alex has had a "window inside a window"
// taken out (the step-1 drawer and the step-3 dock, 2026-09-12). So `SHEET_CSS`
// strips the region's paint for THIS region and the sheet's bracket is the only
// frame — the same treatment the Turn drawer got.
import { useState } from 'react';
import Bracket from './Bracket.jsx';
import NoteHex from './NoteHex.jsx';
import { SeatPortrait } from './SeatPortrait.jsx';
import { SEAT_PORTRAIT } from './seatPortrait.js';
import { SPIRIT_SHEET } from './spiritSheetModel.js';
import { fameSet, fameFill, FAME_NEUTRAL } from '../data/fameTheme.js';
import { pretty } from './scaleWheelModel.js';
// 📌 The same Field Guide the draft and the old wallet open — one dialog, not a
// second write-up of each ability. (The game already ships SpiritDraft.)
import { AbilityInfo } from './SpiritDraft.jsx';
import { useHudClose } from './MatchSurface.jsx';
import { SKILL_BY_ID } from '../data/skillTree.js';

const DRIVE_C = '#ff6644', SUSTAIN_C = '#44aaff', ROOT_C = '#44ff88', NEXT_ROOT_C = '#ff99dd';
const HUD_CYAN = '#7fe0ff';

// ⚠️ `anchor` CARRIES THE TUTORIAL'S `data-tip-anchor`s OVER FROM THE OLD CARD —
// fame-bar, vibe-bar, stat-knobs, ability-wallet, root-note, interval-legend.
// Pickles' pages point at those names; a page whose anchor is missing does not
// fail, it silently re-centres (BeginnerTipOverlay), so a dropped one is invisible.
function Sec({ P, title, accent, anchor, className = '', children }) {
  if (P.sections === 'brackets') return <Bracket plate={title} corner="sm" color={accent}
    className={`ss-sec ss-sec-brk ${className}`} data-tip-anchor={anchor}>{children}</Bracket>;
  return <section className={`ss-sec ss-sec-rule ${className}`} data-tip-anchor={anchor}
    style={accent ? { '--ss-sec': accent } : undefined}>
    <h4>{title}</h4>{children}</section>;
}

function Segments({ n, on, color, head = false, cls = '' }) {
  return <i className={`ss-seg ${cls}`} aria-hidden="true" style={{ color }}>
    {Array.from({ length: Math.max(1, n) }, (_, k) =>
      <b key={k} data-on={k < on || undefined} data-head={head && k === on - 1 || undefined} />)}
  </i>;
}

function Fame({ P, f }) {
  const T = fameSet(f.danger);
  const fill = fameFill({ hot: f.hot, contested: f.danger });
  return <Sec P={P} title="FAME" accent={T.mark} anchor="fame-bar" className="ss-fame">
    <div className="ss-fame-head" title={f.danger
      ? `Only a ${f.lead}-point lead — one good rival turn and the crown changes hands.`
      : `Fame Points — first to ${f.toWin} wins.`}>
      <b style={{ color: T.value, textShadow: `0 0 10px ${T.numGlow}88` }}>{f.fp}</b>
      <small style={{ color: T.label }}>/ {f.toWin} FP</small>
      <em data-tone={f.lead > 0 ? 'up' : f.lead < 0 ? 'down' : undefined}>
        {f.lead > 0 ? `LEAD +${f.lead}` : f.lead < 0 ? `BEHIND ${-f.lead}` : 'LEVEL'}</em>
    </div>
    {P.fameStyle === 'segments'
      ? <Segments n={f.toWin} on={f.fp} color={T.mark} cls="ss-fame-seg" />
      : <span className="ss-fame-track" style={{ background: T.ground, borderColor: T.edge }}
          data-danger={f.danger || undefined}>
          <span style={{ width: `${f.pct}%`, background: fill, boxShadow: `0 0 10px ${T.glow}99` }} />
        </span>}
    {(P.capPips === 'on' && f.cap != null || f.danger) && <div className="ss-fame-foot">
      {P.capPips === 'on' && f.cap != null && <>
        <small>THIS TURN</small>
        <span className="ss-pips">{Array.from({ length: f.cap }, (_, i) =>
          <span key={i} style={{ color: i < f.banked ? T.mark : FAME_NEUTRAL.pipUnlit,
            textShadow: i < f.banked ? `0 0 6px ${T.glow}` : undefined }}>★</span>)}</span>
        {f.capped && <small style={{ color: FAME_NEUTRAL.capped }}>⛔ CAPPED</small>}
      </>}
      {f.danger && <small className="ss-neck">🔥 NECK AND NECK</small>}
    </div>}
  </Sec>;
}

function Body({ P, b, color }) {
  const lifeTotal = b.startingLives;
  return <Sec P={P} title="BODY" className="ss-body">
    <div className="ss-tiles">
      <div className="ss-tile ss-vibe" data-tip-anchor="vibe-bar">
        <small>VIBE</small>
        <b>{b.vibe}<span>/{b.maxVibe}</span></b>
        {P.vibeStyle === 'bar'
          ? <span className="ss-bar"><span style={{ width: `${b.maxVibe ? (b.vibe / b.maxVibe) * 100 : 0}%`, background: color }} /></span>
          : <Segments n={b.maxVibe} on={b.vibe} color={b.vibe <= b.maxVibe * 0.3 ? '#ff4a5a' : color} head />}
      </div>
      <div className="ss-tile">
        <small>LIVES</small>
        <b>{b.lives}<span>/{lifeTotal}</span></b>
        <span className="ss-lives" data-last={b.lastLife || undefined}>{Array.from({ length: lifeTotal }, (_, i) =>
          <i key={i} data-on={i < b.lives || undefined} />)}</span>
      </div>
      <div className="ss-tile">
        <small>SPEED</small>
        <b>{b.speed}<span> hex</span></b>
        <Segments n={5} on={b.speed} color="#44cc88" />
      </div>
      <div className="ss-tile" data-edge={b.edge || undefined}>
        <small>HEX</small>
        <b>{b.hex == null ? '—' : `#${b.hex}`}</b>
        <em title={b.edge ? 'An edge hex — a push off it rings you out.' : undefined}>
          {b.hex == null ? 'waiting to enter' : b.edge ? '⚠ edge hex' : 'safe ground'}</em>
      </div>
    </div>
  </Sec>;
}

function Status({ P, rows }) {
  if (!rows.length && P.statusEmpty === 'hide') return null;
  return <Sec P={P} title="STATUS" className="ss-status">
    {!rows.length ? <p className="ss-clear">✓ All clear — nothing on you.</p>
      : <ul>{rows.map(r => <li key={r.id} data-tone={r.tone} title={P.statusDetail === 'hover' ? r.what : undefined}>
          <span className="ss-st-icon">{r.icon}</span>
          <span className="ss-st-copy"><b>{r.label}</b>
            {P.statusDetail === 'always' && <small>{r.what}</small>}</span>
          <span className="ss-st-turns">{r.turns == null ? 'NOW' : `${r.turns}T`}</span>
        </li>)}</ul>}
  </Sec>;
}

function Abilities({ P, rows, color }) {
  const [info, setInfo] = useState(null);
  return <Sec P={P} title="ABILITIES" anchor="ability-wallet" className="ss-abil">
    {!rows.length ? <p className="ss-clear">No abilities drafted.</p>
      : <ul>{rows.map(r => <li key={r.id} title={P.abilityDetail === 'hover' ? r.desc : undefined}>
          <span className="ss-ab-icon" style={{ borderColor: r.ready ? color : '#3a4a66' }}>{r.icon}</span>
          <span className="ss-ab-copy"><b>{r.label}</b>
            {P.abilityDetail !== 'hover' && <small>{P.abilityDetail === 'full' ? r.desc : r.line}</small>}</span>
          <span className="ss-ab-cd" data-ready={r.ready || undefined}>
            {P.cdStyle === 'pips'
              ? <><i className="ss-cdpips">{[0, 1].map(k => <b key={k} data-on={k < 2 - r.cd || undefined} />)}</i>
                  {r.ready ? 'READY' : `${r.cd} RND`}</>
              : r.ready ? 'READY' : `${r.cd} round${r.cd === 1 ? '' : 's'}`}
          </span>
          <button type="button" className="draft-info-button ss-info" aria-label={`About ${r.label}`}
            onClick={() => setInfo(SKILL_BY_ID[r.id])}>i</button>
        </li>)}</ul>}
    {info && <AbilityInfo skill={info} onClose={() => setInfo(null)} />}
  </Sec>;
}

function Stack({ P, s }) {
  const c = s.which === 'drive' ? DRIVE_C : SUSTAIN_C;
  const seats = Array.from({ length: Math.max(s.cap, s.notes.length) }, (_, i) => s.notes[i] ?? null);
  return <div className="ss-stack" style={{ '--ss-c': c }}>
    <div className="ss-stack-head">
      <small>{s.which === 'drive' ? 'DRIVE' : 'SUSTAIN'}</small>
      <b>{s.value}</b>
      {!!s.boost && P.diceWhy === 'on' && <span className="ss-chip" data-neg={s.boost < 0 || undefined}
        title={s.boostWhy ?? undefined}>{s.boost > 0 ? `+${s.boost}` : `−${-s.boost}`}</span>}
      <em>{s.chord}</em>
    </div>
    <div className="ss-seats">{seats.map((n, i) => n
      ? <span key={i} className="ss-seat"><NoteHex hue={c} letter={pretty(n)} size={P.chipPx} /></span>
      : <span key={i} className="ss-seat is-empty" style={{ width: P.chipPx, height: P.chipPx }} />)}
      <span className="ss-cap">{s.notes.length}/{s.cap}</span>
    </div>
    {P.diceWhy === 'on' && s.boostWhy && !!s.boost && <p className="ss-why">🎲 {s.boostWhy}</p>}
    {P.nextNote === 'on' && <p className="ss-next">{s.full ? 'Stack full — find a seat on the board to grow it.'
      : s.next ? <>Next: add {s.next.notes.map((n, i) => <b key={i}>{i ? ' + ' : ''}{pretty(n)}</b>)} → {s.next.label}</>
      : 'Top of the ladder.'}</p>}
  </div>;
}

function Sound({ P, s }) {
  return <Sec P={P} title="SOUND" anchor="stat-knobs" className="ss-sound">
    <Stack P={P} s={s.drive} /><Stack P={P} s={s.sustain} />
  </Sec>;
}

function Key({ P, k, stock }) {
  const c = k.next ? NEXT_ROOT_C : ROOT_C;
  return <Sec P={P} title={k.next ? 'KEY · NEXT ROUND' : 'KEY'} accent={k.next ? NEXT_ROOT_C : undefined} className="ss-key">
    <div className="ss-key-row" data-tip-anchor="root-note">
      {k.root && <NoteHex hue={c} letter={pretty(k.root)} size={Math.round(P.chipPx * 1.3)} />}
      <div><b style={{ color: c }}>{pretty(k.root)} {k.modeName}</b>
        <small>{k.next ? `Your track ended on ${pretty(k.root)} — that opens the next round.` : 'The key this turn is measured against.'}</small></div>
    </div>
    {k.curse && <p className="ss-curse">呪 Cursed: your palette is <b>Iwato on {pretty(k.curse.root)}</b> for {k.curse.turns} more turn{k.curse.turns === 1 ? '' : 's'}.</p>}
    {P.intervals === 'on' && <div className="ss-ivs" data-tip-anchor="interval-legend">{k.intervals.map(([l, n, col]) =>
      <span key={l} style={{ color: col }}><small>{l}</small>{pretty(n)}</span>)}</div>}
    {/* 🎵 THE STOCK DRAWER, carried over from the old KEY plate. ⚠️ It wears
        `note-stock` ONLY while it is up — the Turn panel drops that anchor for
        exactly that span (step 3), so there is always one copy in the DOM. */}
    {stock?.grid && <div className="ss-stock" data-tip-anchor="note-stock">
      <button type="button" className="ss-stock-head" aria-expanded={!!stock.open} onClick={stock.onToggle}
        title={stock.open ? 'Fold the stock away' : 'What is left in your hand for next turn'}>
        <i aria-hidden="true">▶</i><small>NOTE STOCK</small><em>{stock.left} left</em></button>
      {stock.open && <div className="ss-stock-body">{stock.grid}</div>}
    </div>}
  </Sec>;
}

/**
 * @param {object}  model      `sheetModel(...)`
 * @param {object}  [P]        `SPIRIT_SHEET` or the preview's levers
 * @param {string}  imageSrc   the Spirit's art (the seat portrait cuts it)
 * @param {string}  [turnLabel] e.g. 'YOUR TURN · 07'
 * @param {Function} [onClose]  defaults to the arena's own `useHudClose()`
 * @param {object}  [stock]    { grid, open, onToggle, left } — the KEY's stock drawer
 *                             (step 3 after a commit, as the old KEY plate had it)
 */
export function SpiritSheet({ model: m, P = SPIRIT_SHEET, imageSrc, turnLabel, onClose, stock = null }) {
  // ✕ closes through the arena's own selection when mounted in a MatchSurface.
  const hudClose = useHudClose();
  const close = onClose ?? hudClose;
  const accent = P.accent === 'hud' ? HUD_CYAN : (m.color ?? HUD_CYAN);
  const portrait = { ...SEAT_PORTRAIT, height: P.heroHeight, width: P.headWidth, breakout: P.headBreak,
    panel: P.headPanel, numeral: 'off', inactive: 'full', enter: P.enter === 'none' ? 'none' : 'slide' };
  const left = <><Body P={P} b={m.body} color={m.color} /><Status P={P} rows={m.statuses} />
    <Abilities P={P} rows={m.abilities} color={m.color} /></>;
  const right = <><Sound P={P} s={m.sound} /><Key P={P} k={m.key} stock={stock} /></>;
  // ⚠️ `data-spirit-id` / `data-vibe` ARE READ BY SUITES (the battle and replay
  // journeys read the acting Spirit's Vibe off them), as they were off the old card.
  return <div className="ss-root" data-spirit-id={m.id} data-vibe={m.body.vibe} data-enter={P.enter} data-layout={P.layout} data-sections={P.sections}
    style={{ '--ss-w': `${P.width}px`, '--ss-label': `${P.labelPx}px`, '--ss-text': `${P.textPx}px`,
      '--ss-value': `${P.valuePx}px`, '--ss-enter': `${P.enterMs}ms`, '--ss-hero': `${P.heroHeight}px`,
      '--ss-accent': accent, '--ss-seat': m.color ?? HUD_CYAN }}>
    <style>{SHEET_CSS}</style>
    <Bracket plate="SPIRIT" plateRight={m.style ? m.style.toUpperCase() : undefined} color={accent}
      className="ss-frame" style={{ '--brk-scrim': `rgba(6,12,26,${P.scrim})` }}>
      <header className="ss-hero">
        <SeatPortrait spirit={{ id: m.charId ?? m.id, imageSrc }} color={m.color ?? HUD_CYAN} P={portrait} active />
        <div className="ss-id">
          {turnLabel && <small>{turnLabel}</small>}
          <strong style={{ color: m.color }}>{m.name}{m.headliner ? ' 👑' : ''}</strong>
          {m.body.ko ? <em className="ss-ko">💀 KNOCKED OUT</em>
            : m.body.lastLife ? <em className="ss-ko">⚠ LAST LIFE</em> : null}
        </div>
        {close && <button type="button" className="ss-close" aria-label="Close the Spirit window" onClick={close}>✕</button>}
      </header>
      <Fame P={P} f={m.fame} />
      {P.layout === 'two'
        ? <div className="ss-cols"><div>{left}</div><div>{right}</div></div>
        : <div className="ss-one">{left}{right}</div>}
    </Bracket>
  </div>;
}

export const SHEET_CSS = `
  /* ⚠️ ONE FRAME — see the header. The region keeps its position, scroll and
     max-height; only its paint goes, and its width follows the sheet's lever. */
  [data-match-layout="immersive"] [data-hud-region="spirit"]:has(.ss-root) { background:none; box-shadow:none; clip-path:none;
    padding:9px 0 4px; width:auto; }
  .ss-root { width:var(--ss-w); max-width:100%; color:#dceaff; font:400 var(--ss-text)/1.4 'Saira',sans-serif; }
  .ss-root[data-enter="slide"] .ss-frame { animation:ss-in var(--ss-enter) cubic-bezier(.2,.9,.3,1) both }
  .ss-root[data-enter="fade"] .ss-frame { animation:ss-fade var(--ss-enter) ease-out both }
  @keyframes ss-in { from { opacity:0; transform:translateX(-14px) } to { opacity:1; transform:none } }
  @keyframes ss-fade { from { opacity:0 } to { opacity:1 } }
  /* 📌 Own keyframes, not GameStyles' fame-danger / life-pulse — the sheet must
     look the same on the preview page, which has no GameStyles. */
  @keyframes ss-danger { 50% { box-shadow:0 0 12px #ff4422 } }
  @keyframes ss-life { to { opacity:.45 } }
  .ss-frame > .rlsw-brk-body { padding:0 12px 12px }
  .ss-frame .rlsw-brk-plate { font-size:calc(var(--ss-label) * .78) }
  .ss-root small, .ss-sec h4 { font:400 var(--ss-label) 'Saira Stencil One',sans-serif; letter-spacing:1.5px; color:#8ea6c8; }

  /* the hero: the seat portrait's head on the right, the name on the left */
  .ss-hero { position:relative; height:var(--ss-hero); margin:0 -12px 6px; overflow:visible; }
  .ss-hero .seat-portrait-panel { border-radius:0 }
  .ss-hero .seat-portrait-fig { border-bottom-right-radius:0 }
  .ss-id { position:absolute; left:14px; bottom:10px; z-index:2; max-width:58%; display:flex; flex-direction:column; gap:3px;
    text-shadow:0 1px 8px #000d,0 0 2px #000; }
  .ss-id strong { font:700 calc(var(--ss-value) * 1.25)/1.05 'Saira',sans-serif; }
  .ss-ko { font-style:normal; font-size:var(--ss-text); color:#ff6a6a; letter-spacing:.8px }
  .ss-close { position:absolute; top:8px; left:10px; z-index:3; width:22px; height:22px; border:0; cursor:pointer;
    background:#070f1de6; color:#8fb0d4; font-size:11px;
    clip-path:polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px) }
  .ss-close:hover { color:#fff; background:var(--ss-accent) }

  /* sections */
  .ss-sec { margin-top:10px }
  .ss-sec-rule { border-top:1px solid color-mix(in srgb,var(--ss-sec,var(--ss-accent)) 22%,transparent); padding-top:7px }
  .ss-sec-rule > h4 { margin:0 0 6px; color:color-mix(in srgb,var(--ss-sec,var(--ss-accent)) 70%,#c8d6ea) }
  .ss-sec-brk { margin-top:14px; --brk-scrim:rgba(6,12,26,.2) }
  .ss-sec-brk > .rlsw-brk-body { padding:10px 9px 8px }
  .ss-cols { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .ss-cols > div { min-width:0 }
  .ss-root ul { list-style:none; margin:0; padding:0; display:grid; gap:6px }
  .ss-clear { margin:0; color:#7fd8a8; font-size:var(--ss-text) }

  /* segments — the pocket's Vibe language */
  .ss-seg { display:flex; gap:2px; height:4px; font-style:normal }
  .ss-seg > b { flex:1; background:#22324c }
  .ss-seg > b[data-on] { background:currentColor; box-shadow:0 0 6px currentColor }
  .ss-seg > b[data-head] { background:#fff }

  /* ⭐ fame */
  .ss-fame-head { display:flex; align-items:baseline; gap:6px; margin-bottom:5px }
  .ss-fame-head > b { font:400 calc(var(--ss-value) * 1.4)/1 'Saira Stencil One',sans-serif }
  .ss-fame-head em { margin-left:auto; font-style:normal; font-size:var(--ss-text); letter-spacing:1px; color:#8ea6c8 }
  .ss-fame-head em[data-tone="up"] { color:#7fe6b0 } .ss-fame-head em[data-tone="down"] { color:#ff8a7a }
  .ss-fame-track { display:block; position:relative; height:9px; border:1px solid; overflow:hidden;
    clip-path:polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px) }
  .ss-fame-track > span { position:absolute; inset:0 auto 0 0; transition:width .45s cubic-bezier(.2,.9,.3,1) }
  .ss-fame-track[data-danger] { animation:ss-danger 1.1s ease-in-out infinite }
  .ss-fame-seg { height:7px }
  .ss-fame-foot { display:flex; align-items:center; gap:6px; margin-top:5px }
  .ss-pips { display:flex; gap:3px; font-size:calc(var(--ss-text) * 1.05) }
  .ss-neck { margin-left:auto; color:#ff8855 !important }

  /* 💗 body */
  .ss-tiles { display:grid; grid-template-columns:1fr 1fr; gap:8px 10px }
  .ss-tile { display:flex; flex-direction:column; gap:3px; min-width:0 }
  .ss-tile > b { font:400 var(--ss-value)/1 'Saira Stencil One',sans-serif; color:#dceaff }
  .ss-tile > b > span { font-size:.62em; color:#7790b0 }
  .ss-tile > em { font-style:normal; font-size:calc(var(--ss-text) * .9); color:#7f93b2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  .ss-tile[data-edge] > em, .ss-tile[data-edge] > b { color:#ff7a6a }
  .ss-bar { display:block; height:4px; background:#22324c } .ss-bar > span { display:block; height:100% }
  .ss-lives { display:flex; gap:4px; height:8px; align-items:center }
  .ss-lives > i { width:8px; height:8px; border-radius:50%; border:1px solid color-mix(in srgb,var(--ss-seat) 40%,transparent); box-sizing:border-box }
  .ss-lives > i[data-on] { background:var(--ss-seat); border:0; box-shadow:0 0 5px var(--ss-seat) }
  .ss-lives[data-last] > i[data-on] { background:#ff2a2a; box-shadow:0 0 6px #ff2a2a; animation:ss-life .7s ease-in-out infinite alternate }

  /* ⚠️ status */
  .ss-status li { display:flex; align-items:flex-start; gap:7px }
  .ss-st-icon { flex:none; width:20px; text-align:center; font-size:calc(var(--ss-text) * 1.3); line-height:1.2 }
  .ss-st-copy { flex:1; min-width:0; display:flex; flex-direction:column }
  .ss-st-copy b { font:600 var(--ss-text) 'Saira',sans-serif; letter-spacing:1px; color:#ffb3a8 }
  .ss-status li[data-tone="good"] .ss-st-copy b { color:#9ff0c4 }
  .ss-st-copy small { font:400 calc(var(--ss-text) * .92)/1.35 'Saira',sans-serif; letter-spacing:0; color:#93a6c4 }
  .ss-st-turns { flex:none; font:400 var(--ss-label) 'Saira Stencil One',sans-serif; color:#dceaff; border:1px solid #93acd23a; padding:1px 4px }

  /* 🗡️ abilities */
  .ss-abil li { display:flex; align-items:flex-start; gap:7px }
  .ss-ab-icon { flex:none; width:24px; height:24px; display:grid; place-items:center; border:1px solid; font-size:13px;
    clip-path:polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px) }
  .ss-ab-copy { flex:1; min-width:0; display:flex; flex-direction:column }
  .ss-ab-copy b { font:600 var(--ss-text) 'Saira',sans-serif; color:#dceaff }
  .ss-ab-copy small { font:400 calc(var(--ss-text) * .92)/1.35 'Saira',sans-serif; letter-spacing:0; color:#93a6c4 }
  .ss-info.draft-info-button { flex:none; width:18px; height:18px; font-size:11px; align-self:flex-start }
  .ss-ab-cd { flex:none; display:flex; flex-direction:column; align-items:flex-end; gap:3px;
    font:400 var(--ss-label) 'Saira Stencil One',sans-serif; color:#efb381 }
  .ss-ab-cd[data-ready] { color:#91eab9 }
  .ss-cdpips { display:flex; gap:2px; font-style:normal }
  .ss-cdpips > b { width:10px; height:3px; background:#2a3550 }
  .ss-cdpips > b[data-on] { background:currentColor; box-shadow:0 0 5px currentColor }

  /* 🎛️ sound */
  .ss-stack + .ss-stack { margin-top:9px }
  .ss-stack-head { display:flex; align-items:baseline; gap:6px; position:relative }
  .ss-stack-head > small { color:var(--ss-c) }
  .ss-stack-head > b { font:400 var(--ss-value)/1 'Saira Stencil One',sans-serif; color:var(--ss-c) }
  .ss-stack-head > em { margin-left:auto; font-style:normal; font-size:var(--ss-text); color:#c8d6ea; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0 }
  .ss-chip { border:1px solid currentColor; padding:0 3px; font:400 calc(var(--ss-label) * 1.05) 'Saira Stencil One',sans-serif; color:#ffd38a; box-shadow:0 0 6px currentColor }
  .ss-chip[data-neg] { color:#ff6677 }
  .ss-seats { display:flex; flex-wrap:wrap; align-items:center; gap:2px; margin:4px 0 2px }
  .ss-seat { display:inline-flex }
  .ss-seat.is-empty { box-sizing:border-box; border:1px dashed color-mix(in srgb,var(--ss-c) 35%,transparent);
    clip-path:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%) }
  .ss-cap { margin-left:auto; font:400 var(--ss-label) 'Saira Stencil One',sans-serif; color:#7790b0 }
  .ss-why, .ss-next { margin:2px 0 0; font-size:calc(var(--ss-text) * .92); color:#93a6c4 }
  .ss-next b { color:var(--ss-c); font-weight:700 }

  /* 🔑 key */
  .ss-key-row { display:flex; align-items:center; gap:8px }
  .ss-key-row b { display:block; font:600 calc(var(--ss-text) * 1.15) 'Saira',sans-serif }
  .ss-key-row small { font:400 calc(var(--ss-text) * .92)/1.35 'Saira',sans-serif; letter-spacing:0; color:#93a6c4 }
  .ss-curse { margin:6px 0 0; font-size:calc(var(--ss-text) * .92); color:#ffb3a8 } .ss-curse b { color:#ff8a7a }
  .ss-ivs { display:flex; gap:8px; margin-top:6px; flex-wrap:wrap }
  .ss-ivs > span { display:flex; flex-direction:column; align-items:center; font:400 calc(var(--ss-value) * .8)/1 'Saira Stencil One',sans-serif }
  .ss-ivs > span > small { font-size:calc(var(--ss-label) * .85); color:currentColor; opacity:.75 }

  .ss-stock { margin-top:8px; padding-top:6px; border-top:1px solid #93acd21f }
  .ss-stock-head { display:flex; align-items:center; gap:6px; width:100%; background:none; border:0; padding:0;
    cursor:pointer; color:#8ea6c8; font:inherit; text-align:left }
  .ss-stock-head > i { font-style:normal; font-size:8px; transition:transform .2s }
  .ss-stock-head[aria-expanded="true"] > i { transform:rotate(90deg) }
  .ss-stock-head > em { margin-left:auto; font-style:normal; color:#7fb0ff; font-size:var(--ss-text) }
  .ss-stock-body { margin-top:5px }
  @media (prefers-reduced-motion:reduce) { .ss-root .ss-frame { animation:none !important } }
`;
