import React, { useEffect, useRef, useState } from "react";
import rlMovie1 from "../rl_movie_1.m4v";

// ─── 🎬 OPENING MOVIE ────────────────────────────────────────────────────────
// Skippable cinematic that plays before the Spirit Select on EVERY launch
// (arcade attract style — owner's call). Any key, click, or tap skips it.
// Pure presentation: no engine imports, no game state, no deps.
//
// The owner edits ONLY the STORYBOARD array below — the player renders
// whatever it finds there, placeholders and all.

// ── 🎬 STORYBOARD — the owner's editing surface. Each scene is one shot.
// image: null → renders the blank placeholder frame (dark panel, thin amber
//         border, faint "IMAGE" watermark). Later: an import or /public URL.
// video: an imported video asset — plays muted (autoplay policy) and the scene
//         advances when the clip ENDS (durMs is only a safety fallback).
// title/caption: empty strings render nothing (layout doesn't jump).
// motion: ken-burns preset applied to the image layer (ignored for video).
const STORYBOARD = [
  { id: 'rl-movie', durMs: 120000, motion: 'hold', image: null, video: rlMovie1,
    title: '', caption: '' },
  { id: 'logo',     durMs: 3500,   motion: 'hold', image: null,
    title: '⚡ RLSW', caption: 'ROCK LEGENDS: SPIRIT WARS' },
];

const XFADE_MS = 700;   // crossfade between scenes
const OUTRO_MS = 600;   // fade-to-black after the last scene

const MOTION_ANIM = {
  'zoom-in':   'om-zoom-in',
  'zoom-out':  'om-zoom-out',
  'pan-left':  'om-pan-left',
  'pan-right': 'om-pan-right',
  'hold':      'om-hold',
};

// One scene's image layer: real image or the storyboard placeholder frame.
// The ken-burns motion rides on this layer; opacity crossfade rides on the
// wrapper so the two never fight over `transform`.
function SceneLayer({ scene, visible, onVideoEnd }) {
  const anim = MOTION_ANIM[scene.motion] || 'om-hold';
  const videoRef = useRef(null);

  // 🎥 Video scenes: play only while visible (double-buffered neighbours stay
  // mounted but paused). Muted — browsers block audio before a user gesture.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible) v.play().catch(() => {});
    else v.pause();
  }, [visible]);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0,
      transition: `opacity ${XFADE_MS}ms ease-in-out`,
      pointerEvents: 'none',
    }}>
      <div style={{ animation: scene.video ? 'none' : `${anim} ${scene.durMs + XFADE_MS}ms ease-in-out forwards` }}>
        {scene.video ? (
          <video ref={videoRef} src={scene.video} muted playsInline preload="auto"
            onEnded={() => { if (visible && onVideoEnd) onVideoEnd(); }}
            style={{
              maxWidth: '94vw', maxHeight: '78vh', objectFit: 'contain',
              display: 'block',
            }}/>
        ) : scene.image ? (
          <img src={scene.image} alt="" draggable={false} style={{
            maxWidth: '82vw', maxHeight: '62vh', objectFit: 'contain',
            display: 'block',
          }}/>
        ) : (
          // Placeholder frame — a 16:9 panel the owner can storyboard against.
          <div style={{
            width: 'min(82vw, calc(62vh * 16 / 9))', aspectRatio: '16 / 9',
            background: '#0a1020', border: '1px solid #f6ad5544',
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* corner ticks */}
            {[
              { top: -1, left: -1, borderTop: '2px solid #f6ad5588', borderLeft: '2px solid #f6ad5588' },
              { top: -1, right: -1, borderTop: '2px solid #f6ad5588', borderRight: '2px solid #f6ad5588' },
              { bottom: -1, left: -1, borderBottom: '2px solid #f6ad5588', borderLeft: '2px solid #f6ad5588' },
              { bottom: -1, right: -1, borderBottom: '2px solid #f6ad5588', borderRight: '2px solid #f6ad5588' },
            ].map((pos, k) => (
              <div key={k} style={{ position: 'absolute', width: 14, height: 14, ...pos }}/>
            ))}
            <div style={{
              fontFamily: "'Share Tech Mono', monospace", fontSize: 22,
              letterSpacing: 4, color: '#f6ad55', opacity: 0.1,
              userSelect: 'none',
            }}>IMAGE — {scene.id}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OpeningMovie({ onDone }) {
  const [idx, setIdx] = useState(0);
  const [outro, setOutro] = useState(false);
  const timerRef = useRef(null);
  const doneRef = useRef(false);

  // 🎵 future: intro music hook (BGM lives in Game; autoplay-before-gesture
  // is blocked by browsers anyway — do not wire useBgmState here).

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      clearTimeout(timerRef.current);
      onDone();
    };
    const skip = () => finish();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
      clearTimeout(timerRef.current);
    };
  }, [onDone]);

  // Scene advance — one timer at a time, id kept in a ref so skip/unmount
  // can always cancel it.
  useEffect(() => {
    if (outro) {
      timerRef.current = setTimeout(() => {
        if (!doneRef.current) { doneRef.current = true; onDone(); }
      }, OUTRO_MS);
      return () => clearTimeout(timerRef.current);
    }
    const scene = STORYBOARD[idx];
    timerRef.current = setTimeout(() => {
      if (idx < STORYBOARD.length - 1) setIdx(idx + 1);
      else setOutro(true);
    }, scene.durMs);
    return () => clearTimeout(timerRef.current);
  }, [idx, outro, onDone]);

  const scene = STORYBOARD[idx];

  // 🎥 A video scene advances itself when the clip ends (the durMs timer above
  // is just a safety net in case the video errors or never fires `ended`).
  const advanceScene = () => {
    if (doneRef.current || outro) return;
    clearTimeout(timerRef.current);
    if (idx < STORYBOARD.length - 1) setIdx(idx + 1);
    else setOutro(true);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#050810',
      overflow: 'hidden', cursor: 'pointer', zIndex: 50,
      opacity: outro ? 0 : 1, transition: `opacity ${OUTRO_MS}ms ease-in`,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes om-zoom-in   { from { transform: scale(1); }        to { transform: scale(1.08); } }
        @keyframes om-zoom-out  { from { transform: scale(1.08); }     to { transform: scale(1); } }
        @keyframes om-pan-left  { from { transform: translateX(3%); }  to { transform: translateX(-3%); } }
        @keyframes om-pan-right { from { transform: translateX(-3%); } to { transform: translateX(3%); } }
        @keyframes om-hold      { from { transform: none; }            to { transform: none; } }
        @keyframes om-letterbox { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes om-text-up   { from { opacity: 0; transform: translateY(14px); }
                                  to   { opacity: 1; transform: translateY(0); } }
        @keyframes om-fade-in   { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* image layers — double-buffered crossfade: every scene stays mounted,
          only the current one is visible (cheap: they're placeholders/imgs) */}
      {STORYBOARD.map((s, i) => (
        (i === idx || i === idx - 1 || i === idx + 1) &&
          <SceneLayer key={s.id} scene={s} visible={i === idx} onVideoEnd={advanceScene}/>
      ))}

      {/* lower-third text — keyed by scene so the fade-up replays per shot */}
      <div key={scene.id} style={{
        position: 'absolute', left: 0, right: 0, bottom: '13vh',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        {scene.title !== '' && (
          <div style={{
            fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
            fontSize: 'clamp(28px, 5vw, 54px)', letterSpacing: 8,
            color: '#f6ad55', textShadow: '0 0 24px #f6ad5566',
            opacity: 0, animation: 'om-text-up 700ms ease-out 400ms forwards',
          }}>{scene.title}</div>
        )}
        {scene.caption !== '' && (
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 'clamp(11px, 1.6vw, 16px)', letterSpacing: 5,
            color: '#8aa0c0', marginTop: 10,
            opacity: 0, animation: 'om-text-up 700ms ease-out 700ms forwards',
          }}>{scene.caption}</div>
        )}
      </div>

      {/* cinematic letterbox bars — slide in on mount, sit above everything */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '10vh',
        background: '#000', transformOrigin: 'top',
        animation: 'om-letterbox 900ms ease-out forwards',
      }}/>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '10vh',
        background: '#000', transformOrigin: 'bottom',
        animation: 'om-letterbox 900ms ease-out forwards',
      }}/>

      {/* progress dots — one per scene, current lit */}
      <div style={{
        position: 'absolute', bottom: '3.5vh', left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 8, pointerEvents: 'none',
      }}>
        {STORYBOARD.map((s, i) => (
          <div key={s.id} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i === idx ? '#f6ad55' : '#1e3a5f',
            boxShadow: i === idx ? '0 0 6px #f6ad55' : 'none',
            transition: 'background 300ms, box-shadow 300ms',
          }}/>
        ))}
      </div>

      {/* quiet skip chip */}
      <div style={{
        position: 'absolute', bottom: '3vh', right: 24,
        fontFamily: "'Share Tech Mono', monospace", fontSize: 11,
        letterSpacing: 2, color: '#5a7a9a', pointerEvents: 'none',
        border: '1px solid #1e3a5f', borderRadius: 4, padding: '4px 10px',
        opacity: 0, animation: 'om-fade-in 600ms ease 1500ms forwards',
      }}>SKIP ▸</div>
    </div>
  );
}
