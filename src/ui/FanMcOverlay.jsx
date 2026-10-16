// ─── 🎤 THE FAN MC'S WORDS, CARDS AND ⏭ SKIP ─────────────────────────────────
// While the fan MC has the stage (before a stage effect starts), this layer sits
// over the HUD like the opening act's (OpeningActOverlay.jsx): it takes every click
// so nobody commits a note into the show, shows his words, the Fame bar chart, the
// call's banner, and offers ⏭ Skip (Enter / Space / Escape too — a pad's B sends
// Escape). It only READS the show's clock (`show.startMs` + `data/fanMc.js`
// compileIntermission), so it can never disagree with the arena or the sound.
// The look is Alex's dial-in on `.scratch/fan-mc-preview.html` (`FAN_MC`).
// 🔝 Nothing sits on him (Alex, 2026-10-16): the HUD, the board's buttons, the stage-effect
// status pills (they used to land on his head at the call) and the crowd's speech bubble
// all step aside while `body[data-fanmc-live]` is set; the 3D half is his own layer
// (board/fanMcStage.js header).
import { useEffect, useState } from 'react';
import { FAN_MC, FAN_MC_SCREEN, intermissionAt } from '../data/fanMc.js';

const CSS = `
  body[data-fanmc-live] .match-surface > :not(.match-board-column),
  body[data-fanmc-live] .match-board-column .match-board-preparation,
  body[data-fanmc-live] .match-board-column .match-board-frame > button,
  body[data-fanmc-live] [data-stagefx-pills],
  body[data-fanmc-live] [data-arena-crowd-speaker] { opacity: 0; visibility: hidden; pointer-events: none; }
  .fanmc { position: fixed; inset: 0; z-index: 9000; font-family: ui-sans-serif, system-ui, sans-serif; --stencil: 'Saira Stencil One', Impact, 'Arial Narrow', sans-serif; }
  .fanmc-round { position: absolute; left: 14px; top: 14px; font: 400 12px/1 var(--stencil); letter-spacing: .18em; color: #cfd8ff;
    background: #0b1020cc; border: 1px solid #2c3a66; border-radius: 6px; padding: 7px 10px; }
  .fanmc-bubble { position: absolute; width: max-content; max-width: min(330px, 42vw); padding: 11px 15px 10px; background: rgba(13,11,34,.88); color: #f3f1ff;
    border: 1.5px solid var(--mc); border-radius: 16px; box-shadow: 0 0 22px color-mix(in srgb, var(--mc) 40%, transparent), 0 8px 28px #000a; pointer-events: none; }
  .fanmc-bubble::after { content: ''; position: absolute; top: calc(75% - 8px); border: 8px solid transparent; }
  .fanmc-bubble.left { border-radius: 16px 16px 4px 16px } .fanmc-bubble.left::after { right: -9px; border-right: 0; border-left-color: var(--mc) }
  .fanmc-bubble.right { border-radius: 16px 16px 16px 4px } .fanmc-bubble.right::after { left: -9px; border-left: 0; border-right-color: var(--mc) }
  .fanmc-bubble .t { font: 400 10px/1.2 var(--stencil); letter-spacing: .22em; text-transform: uppercase; color: var(--mc); margin-bottom: 4px }
  .fanmc-bubble .x { font-weight: 800; font-size: calc(16px * var(--bs, 1)); line-height: 1.3; min-height: 1.3em }
  .fanmc-caption { position: absolute; left: 0; right: 0; bottom: 7%; text-align: center; color: #e8e4ff; text-shadow: 0 2px 18px #000c, 0 0 2px #000; padding: 0 16px; pointer-events: none }
  .fanmc-caption .c { font-size: 11px; letter-spacing: .32em; color: var(--mc) }
  .fanmc-caption .x { font-size: clamp(20px, 3vw, 34px); font-weight: 800; margin-top: 6px }
  .fanmc-card { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); width: min(520px, 92vw);
    background: linear-gradient(180deg, #141030f0, #0a0818f0); border: 1.5px solid #ffd16688; border-radius: 12px;
    padding: 11px 14px 12px; box-shadow: 0 0 30px #ffd16633, 0 10px 30px #000c; pointer-events: none }
  .fanmc-card.side { left: auto; right: 14px; transform: none; width: min(360px, 46vw) }
  .fanmc-card .h { font: 400 11px/1 var(--stencil); letter-spacing: .26em; color: #ffd166; text-align: center; margin-bottom: 9px }
  .fanmc-card .f { display: flex; justify-content: space-between; margin-top: 8px; font: 400 10px/1 var(--stencil); letter-spacing: .2em; color: #b7c3ea }
  .fanmc-bars { display: flex; flex-direction: column; gap: 6px }
  .fanmc-bar { display: grid; grid-template-columns: 24px minmax(0,128px) minmax(0,1fr) 54px minmax(0,auto); align-items: center; gap: 8px;
    padding: 4px 6px; border-radius: 7px; border: 1px solid transparent; opacity: 0; transform: translateX(-6px); transition: opacity .3s, transform .3s }
  .fanmc-bar.in { opacity: 1; transform: none } .fanmc-bar.lit { border-color: var(--pc) }
  .fanmc-bar .p { font: 400 15px/1 var(--stencil); color: #fff; text-align: center }
  .fanmc-bar .n { font-weight: 800; font-size: 13.5px; color: #f1f3ff; overflow: hidden; white-space: nowrap; text-overflow: ellipsis }
  .fanmc-bar .k { position: relative; height: 18px; border-radius: 0 4px 4px 0; background: #ffffff0d; border-left: 2px solid #ffffff40 }
  .fanmc-bar .k i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 0 4px 4px 0;
    background: linear-gradient(90deg, color-mix(in srgb, var(--pc) 70%, #000), var(--pc)); transition: width .8s cubic-bezier(.2,.9,.3,1) }
  .fanmc-bar.in .k i { width: var(--w) } .fanmc-bar.lead .k i { box-shadow: 0 0 14px color-mix(in srgb, var(--pc) 70%, transparent) }
  .fanmc-bar .v { font: 800 16px/1 ui-monospace, Menlo, monospace; color: #ffd166; text-align: right; font-variant-numeric: tabular-nums }
  .fanmc-x { font: 700 11px/1 ui-monospace, Menlo, monospace; color: #9fb0d8; white-space: nowrap; font-variant-numeric: tabular-nums }
  .fanmc-x .z { color: #7dffb0 } .fanmc-x .g { color: #ff8fa3 }
  .fanmc-cols { display: flex; justify-content: center; gap: 14px; height: 170px; padding: 0 6px }
  .fanmc-col { flex: 1; max-width: 110px; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; border-radius: 7px; border: 1px solid transparent; opacity: 0; transition: opacity .3s }
  .fanmc-col.in { opacity: 1 } .fanmc-col.lit { border-color: var(--pc) }
  .fanmc-col .v { font: 800 14px/1 ui-monospace, Menlo, monospace; color: #ffd166 }
  .fanmc-col .w { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; border-bottom: 2px solid #ffffff40 }
  .fanmc-col .w i { display: block; width: 62%; height: 0; border-radius: 4px 4px 0 0; background: linear-gradient(0deg, color-mix(in srgb, var(--pc) 65%, #000), var(--pc)); transition: height .8s cubic-bezier(.2,.9,.3,1) }
  .fanmc-col.in .w i { height: var(--h) }
  .fanmc-col .n { font-weight: 800; font-size: 12px; color: #f1f3ff; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis }
  .fanmc-row { display: grid; grid-template-columns: 30px 1fr 64px 52px 44px; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; margin: 3px 0;
    background: #ffffff08; border: 1px solid #ffffff10; opacity: 0; transition: opacity .3s }
  .fanmc-row.in { opacity: 1 } .fanmc-row.lit { outline: 2px solid var(--pc) }
  .fanmc-row .n { font-weight: 800; color: #fff } .fanmc-row .v { font: 800 17px/1 ui-monospace, Menlo, monospace; color: #ffd166; text-align: right }
  .fanmc-fx { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); text-align: center; padding: 14px 26px 16px; border-radius: 14px;
    background: linear-gradient(180deg, #131022ee, #0a0816ee); border: 2px solid var(--fc); min-width: min(420px, 80vw);
    box-shadow: 0 0 50px color-mix(in srgb, var(--fc) 55%, transparent), 0 10px 40px #000d; animation: fanmc-pop .35s cubic-bezier(.2,1.6,.4,1); pointer-events: none }
  @keyframes fanmc-pop { from { opacity: 0; transform: translate(-50%,-50%) scale(.9) } to { opacity: 1; transform: translate(-50%,-50%) scale(1) } }
  .fanmc-fx .k { font: 400 11px/1 var(--stencil); letter-spacing: .32em; color: var(--fc) }
  .fanmc-fx .n { font: 400 clamp(26px, 4.4vw, 46px)/1.05 var(--stencil); color: #fff; margin: 8px 0 6px; text-shadow: 0 0 18px var(--fc) }
  .fanmc-fx .b { font-size: 13px; color: #d5d8ef; max-width: 440px; margin: 0 auto }
  .fanmc-fx .r { font: 400 11px/1 var(--stencil); letter-spacing: .24em; color: #ffd166; margin-top: 9px }
  .fanmc-skip { position: absolute; right: 16px; bottom: 16px; padding: 8px 14px; font-size: 12px; color: #e6f5ff; background: #0b1425e6; border: 1px solid #9dbfe46b; border-radius: 6px; cursor: pointer }
  @media (prefers-reduced-motion: reduce) { .fanmc-bar, .fanmc-col, .fanmc-row, .fanmc-bar .k i, .fanmc-col .w i { transition: none } .fanmc-fx { animation: none } }
`;

const CHAPTER = { arrive: 'THE MC', standings: 'THE STANDINGS', riff: 'RIFF OF THE NIGHT', tease: '…', reveal: 'STAGE EFFECT', exit: 'BACK TO THE SHOW' };

function Standings({ card, t0, t, line, o }) {
  const rows = card.rows, max = Math.max(1, ...rows.map(r => r.fame)), n = rows.length;
  const shown = i => t - t0 > .2 + (o.order === 'up' ? n - 1 - i : i) * o.stagger;
  const extra = r => <span className="fanmc-x">{o.showFans === 'on' && `👥${r.fans}`}{o.showFans === 'on' && o.showGap === 'on' && ' · '}
    {o.showGap === 'on' && (r.gap === 0 ? <span className="z">LEAD</span> : <span className="g">−{r.gap}</span>)}</span>;
  const lit = r => line?.to === r.id && r.place !== 1;
  const foot = <div className="f"><span>{card.left == null ? 'LEGEND RUN · NO BUZZER' : `${card.left} ROUND${card.left === 1 ? '' : 'S'} LEFT`}</span>
    <span>NEXT: ROUND {card.round}{card.roundLimit ? ` OF ${card.roundLimit}` : ''}</span></div>;
  const share = o.raceBar === 'on' && <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 7, background: '#ffffff10' }}>
    {rows.map(r => <i key={r.id} style={{ display: 'block', width: `${(r.fame / rows.reduce((a, b) => a + b.fame, 0) * 100).toFixed(1)}%`, background: r.color }} />)}</div>;
  // 📊 THE BAR CHART (Alex: "lets make it a bar chart for easy understanding"): one scale from 0, so length = Fame.
  if (o.standStyle === 'columns') return <>
    <div className="h">FAME ⭐ · AFTER ROUND {card.round - 1}</div>
    <div className="fanmc-cols">{rows.map((r, i) => <div key={r.id} className={`fanmc-col${shown(i) ? ' in' : ''}${lit(r) ? ' lit' : ''}`}
      style={{ '--pc': r.color, '--h': `${(r.fame / max * 100).toFixed(1)}%` }}>
      <div className="v">{r.place === 1 && '👑 '}⭐{r.fame}</div><div className="w"><i /></div><div className="n">{r.name}</div>{extra(r)}</div>)}</div>
    {share}{foot}</>;
  if (o.standStyle === 'rows') return <>
    <div className="h">STANDINGS · AFTER ROUND {card.round - 1}</div>
    {rows.map((r, i) => <div key={r.id} className={`fanmc-row${shown(i) ? ' in' : ''}${lit(r) ? ' lit' : ''}`} style={{ '--pc': r.color }}>
      <div>{r.place === 1 ? '👑' : r.place}</div><div className="n">{r.name}</div><div className="v">⭐{r.fame}</div>{extra(r)}</div>)}
    {share}{foot}</>;
  return <>
    <div className="h">FAME ⭐ · AFTER ROUND {card.round - 1}</div>
    <div className="fanmc-bars">{rows.map((r, i) => <div key={r.id} className={`fanmc-bar${r.place === 1 ? ' lead' : ''}${shown(i) ? ' in' : ''}${lit(r) ? ' lit' : ''}`}
      style={{ '--pc': r.color, '--w': `${(r.fame / max * 100).toFixed(1)}%` }} data-fanmc-bar={r.id}>
      <div className="p">{r.place === 1 ? '👑' : r.place}</div><div className="n">{r.name}</div><div className="k"><i /></div>
      <div className="v">⭐{r.fame}</div>{extra(r)}</div>)}</div>
    {share}{foot}</>;
}

/**
 * @param show   { key, startMs, timeline, players, fx, round, roundLimit } — the client's show (see the monolith's `fanMcShow`)
 * @param onSkip ⏭ — the client moves the show's clock (`skipTarget`)
 */
export function FanMcOverlay({ show, onSkip, look = FAN_MC }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    let raf = 0; const loop = () => { setNow(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    document.body.dataset.fanmcLive = '';
    return () => { delete document.body.dataset.fanmcLive; };
  }, []);
  useEffect(() => {
    const onKey = e => {
      if (e.repeat || !['Enter', ' ', 'Escape'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation(); onSkip?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onSkip]);
  if (!show?.timeline) return null;
  const o = look, T = show.timeline, t = (now - show.startMs) / 1000;
  const { seg, line, lastLine } = intermissionAt(T, Math.max(0, t));
  const shownLine = line ?? (lastLine && t - lastLine.t1 < .25 && t < T.T ? lastLine : null);
  const text = shownLine ? shownLine.text.slice(0, Math.max(0, Math.floor((t - shownLine.t0) * o.talkSpeed))) : '';
  const head = FAN_MC_SCREEN.head, mc = show.mcColor ?? '#dfe8ff';
  const useBubble = o.speech !== 'caption' && !!head, useCaption = o.speech !== 'bubble' || !head;
  // ⭐ the bubble sits BESIDE his head (as on the wallpaper — above it collides with the cards),
  // on the side with room, and drops below the TV if they would meet.
  let bub = null;
  if (shownLine && useBubble) {
    const W = window.innerWidth, H = window.innerHeight, bw = Math.min(330, W * .42), bh = 64;
    const gap = Math.max(26, 60 * o.size / 2.4);
    const leftSide = head.x - gap - bw > 8 ? true : head.x + gap + bw < W - 8 ? false : head.x > W / 2;
    const x = leftSide ? Math.max(8, head.x - gap - bw) : Math.min(W - bw - 8, head.x + gap);
    let y = Math.max(8, Math.min(H - bh - 8, head.y - bh * .75));
    const tv = FAN_MC_SCREEN.tv;
    if (tv && x < tv.x1 && x + bw > tv.x0 && y < tv.y1 && y + bh > tv.y0) y = Math.min(H - bh - 8, tv.y1 + 10);
    bub = { x, y, side: leftSide ? 'left' : 'right', w: bw };
  }
  const reveal = T.segs.find(s => s.id === 'reveal'), card = reveal.beat.card;
  const big = o.nameIt === 'name' && t >= T.hit && t < reveal.t1 + .2;
  const cardSeg = seg && (seg.id === 'standings' ? seg : seg.id === 'riff' && seg.beat.card && o.riffShow !== 'tv' ? seg : null);
  const afterHit = t >= T.hit;
  return <div className="fanmc" data-fanmc={seg?.id ?? 'arrive'} role="dialog" aria-label="The MC's intermission"
    style={{ '--mc': mc }}
    onClickCapture={e => { if (!e.target.closest?.('[data-fanmc-skip]')) { e.stopPropagation(); e.preventDefault(); } }}>
    <style>{CSS}</style>
    <div className="fanmc-round">{afterHit ? `ROUND ${show.round}${show.roundLimit ? ` / ${show.roundLimit}` : ''}` : `ROUND ${show.round - 1} ✓ · INTERMISSION`}</div>
    {cardSeg?.id === 'standings' && <div className={`fanmc-card${o.cardPos === 'side' ? ' side' : ''}`} data-fanmc-card="standings">
      <Standings card={cardSeg.beat.card} t0={cardSeg.t0} t={t} line={line} o={o} /></div>}
    {cardSeg?.id === 'riff' && (() => { const c = cardSeg.beat.card, r = c.riff, P = id => show.players.find(p => p.id === id);
      return <div className={`fanmc-card${o.cardPos === 'side' ? ' side' : ''}`} data-fanmc-card="riff">
        <div className="h">🎸 RIFF OF THE NIGHT · ROUND {r.round}</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', fontWeight: 800, color: '#fff' }}>
          {[r.attackerId, r.defenderId].map((id, i) => { const st = i ? r.def : r.atk;
            return <div key={id} style={{ textAlign: 'center', color: P(id)?.color }}>{P(id)?.name}<div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 20 }}>{st.quality}%</div>
              <div style={{ fontSize: 11, color: '#ffd166' }}>{id === r.winnerId ? `WINNER · ⚡${(r.atk.energy + r.def.energy).toFixed(1)}` : ''}</div></div>; })}
        </div></div>; })()}
    {big && <div className="fanmc-fx" style={{ '--fc': card.fx.color }} data-fanmc-call={card.fx.id}>
      <div className="k">STAGE EFFECT</div><div className="n">{card.fx.icon} {card.fx.name.toUpperCase()}</div>
      <div className="b">{card.fx.blurb}</div>{card.howLong && <div className="r">{card.howLong.toUpperCase()}</div>}</div>}
    {bub && <div className={`fanmc-bubble ${bub.side}`} style={{ left: bub.x, top: bub.y, maxWidth: bub.w, '--bs': o.bubbleSize }} data-fanmc-bubble>
      <div className="t">🎤 THE MC</div><div className="x">{text || '…'}</div></div>}
    {shownLine && useCaption && <div className="fanmc-caption" data-fanmc-caption>
      <div className="c">🎤 INTERMISSION · {CHAPTER[seg?.id] ?? 'THE MC'}</div><div className="x">{text || '…'}</div></div>}
    {t < T.T && <button type="button" className="fanmc-skip" data-fanmc-skip data-pad-default={`fanmc:${show.key}`} onClick={onSkip}>⏭ Skip</button>}
  </div>;
}
