// ─── THE OPENING ACT'S CAPTION AND SKIP ──────────────────────────────────────
// While the Bardbarian introduces the Spirits the board is his: this layer
// sits over the HUD, takes every click (so nobody commits a note into the
// storm), names the chapter like the preview did, and offers ⏭ Skip. Enter,
// Space and Escape skip too. The client owns the clock (`openingAct.js`); this
// file only reads it, so it can never disagree with the arena or the sound.
import { useEffect, useState } from 'react';

const CHAPTERS = [
  { until: 3.8, chapter: '01 / THE SUMMONING', title: 'A storm. A god. A stage.', line: 'The Bardbarian introduces the Spirits.' },
  { until: -1, chapter: '02 / THE ARRIVAL', title: 'Spirits, descend.', line: 'Each Spirit crashes into a waiting space beyond the board.' },
  { until: 0, chapter: '03 / BEFORE THE FIRST NOTE', title: 'Every entrance has its moment.', line: 'No fans yet. Each Spirit waits for its own first turn.' },
];

/** The caption for intro second `t` of an intro ending at `end` (exported for the check). */
export function openingCaption(t, end, firstName) {
  if (t < CHAPTERS[0].until) return CHAPTERS[0];
  if (t < end - 1) return CHAPTERS[1];
  if (t < end) return CHAPTERS[2];
  return { chapter: '04 / PLAYER 1 · FIRST TURN', title: `${firstName}. Your stage.`, line: 'Their signature riff calls the first two fans.' };
}

export function OpeningActOverlay({ schedule, firstName = 'Player 1', onSkip }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(id);
  }, []);
  // 🎬 The HUD steps aside while the Bardbarian has the stage and comes back
  // when he goes (the rule below keys off this body flag; removed on unmount).
  useEffect(() => {
    document.body.dataset.openingLive = '';
    return () => { delete document.body.dataset.openingLive; };
  }, []);
  useEffect(() => {
    const onKey = e => {
      if (e.repeat || !['Enter', ' ', 'Escape'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation(); onSkip?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onSkip]);
  const pending = !schedule;
  const t = pending ? 0 : (now - schedule.startMs) / 1000;
  const end = pending ? 1 : (schedule.endMs - schedule.startMs) / 1000;
  const cap = pending ? null : openingCaption(t, end, firstName);
  return <div data-opening-act={pending ? 'pending' : 'playing'} role="dialog" aria-label="The opening act"
    onClickCapture={e => { if (!e.target.closest?.('[data-opening-skip]')) { e.stopPropagation(); e.preventDefault(); } }}
    style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'auto', display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end', alignItems: 'center', padding: '0 16px 7vh', background: 'transparent' }}>
    <style>{`
      body[data-opening-live] .match-surface > :not(.match-board-column),
      body[data-opening-live] .match-board-column .match-board-preparation,
      body[data-opening-live] .match-board-column .match-board-frame > button { opacity: 0; visibility: hidden; pointer-events: none; }
    `}</style>
    {cap && <div data-opening-caption style={{ textAlign: 'center', color: '#e8e4ff', textShadow: '0 2px 18px #000c, 0 0 2px #000',
      maxWidth: 'min(920px, 100%)', lineHeight: 1.15, opacity: Math.min(1, Math.max(0, (t - .2) / .6)) }}>
      <div style={{ fontSize: 11, letterSpacing: '.32em', color: '#b9a6ff' }}>{cap.chapter}</div>
      <div style={{ fontSize: 'clamp(22px, 3.4vw, 38px)', fontWeight: 800, margin: '6px 0 4px' }}>{cap.title}</div>
      <div style={{ fontSize: 14, color: '#c9cbe8' }}>{cap.line}</div>
    </div>}
    <button type="button" className="btn" data-opening-skip onClick={onSkip}
      style={{ position: 'absolute', right: 16, bottom: 16, padding: '8px 14px', fontSize: 12, color: '#e6f5ff',
        background: '#0b1425e6', border: '1px solid #9dbfe46b', borderRadius: 6, cursor: 'pointer' }}>
      ⏭ Skip intro
    </button>
  </div>;
}
