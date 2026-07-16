import React, { useEffect, useRef, useState } from "react";
import openingIsland from "../assets/opening_island.png";
import cosmicRonin from "../standees/Cosmic_Ronin.png";
import glamarchy from "../standees/Glamarchy.png";
import intergalactic0 from "../standees/Intergalactic_0.png";
import metalnessMonster from "../standees/Metalness_Monster.png";
import crowdBlue from "../crowd_blue.png";
import crowdPink from "../crowd_pink.png";
import rlMovieSong from "../rl_movie_song.mp3";

/* ─── 🎬 OPENING MOVIE ──────────────────────────────────────────────────────
 * Skippable cinematic before Spirit Select. Any key/click/tap skips.
 * Pure presentation — no engine imports, no game state.
 * Owner tunes the movie by editing the BEATS array.
 * ────────────────────────────────────────────────────────────────────────── */

// ── BEAT TIMELINE ───────────────────────────────────────────────────────────
// camFrom/camTo: [scale, translateX%, translateY%]
const BEATS = [
  { id: 0, start: 0,     end: 3000,  text: '',
    camFrom: [1.0, 0, 0], camTo: [1.0, 0, 0], cues: ['reveal'] },
  { id: 1, start: 3000,  end: 16000,
    text: 'From the furthest corners of the Cosmos, Spirits arise — each born from a unique Musical Realm, each Dimension carrying its own Space-Time signature and genre.',
    camFrom: [1.0, 0, 0], camTo: [1.12, 0, -2], cues: ['clouds-start', 'spirits-enter'] },
  { id: 2, start: 16000, end: 26000,
    text: 'These Spirits have mastered their music completely. Their instruments are their weapons. Their sound is their power.',
    camFrom: [1.12, 0, -2], camTo: [1.25, 0, -3], cues: ['instruments-flash'] },
  { id: 3, start: 26000, end: 30000,
    text: 'Four realms. Four sounds. One stage.',
    camFrom: [1.25, 0, -3], camTo: [1.22, 0, -2], cues: ['pulse-unison'] },
  { id: 4, start: 30000, end: 42000,
    text: 'For eons, Genre Gate-keepers and Purists bickered endlessly about whose music was the greatest.',
    camFrom: [1.22, -4, -2], camTo: [1.22, 4, -2], cues: ['crowds-enter'] },
  { id: 5, start: 42000, end: 50000,
    text: 'To settle the debate once and for all, The Gods deployed a concert stage at the very edge of the Cosmos.',
    camFrom: [1.08, 0, -1], camTo: [1.12, 0, -2], cues: ['mega-bolt', 'rock-gods-enter'] },
  { id: 6, start: 50000, end: 62000,
    text: "This isn't just a battle for glory and legend status. It's a battle for the soul of Music itself — to pilot the very Destiny of the Cosmos. The Gods and History await its Victor.",
    camFrom: [1.12, 0, -2], camTo: [1.20, 0, -3], cues: ['heartbeat-sync', 'glitch-ramp'] },
  { id: 7, start: 62000, end: 66000,
    text: 'The amps are humming. The Cosmos is listening.',
    camFrom: [1.20, 0, -3], camTo: [1.20, 0, -3], cues: ['dissolve', 'shake'] },
  { id: 8, start: 66000, end: 72000, text: '',
    camFrom: [1.20, 0, 3], camTo: [1.20, 0, 3], cues: ['title-blast'] },
];

const TOTAL_MS = 72000;

// ── CLOUD PULSE REGIONS (% of image) ──
const CLOUD_REGIONS = [
  { id: 'tl', x: 22, y: 14, color: '#c084fc' },
  { id: 'tr', x: 81, y: 16, color: '#818cf8' },
  { id: 'ml', x: 14, y: 45, color: '#a78bfa' },
  { id: 'cb', x: 34, y: 57, color: '#7c3aed' },
  { id: 'mr', x: 74, y: 57, color: '#6366f1' },
  { id: 'bl', x: 21, y: 85, color: '#c084fc' },
  { id: 'br', x: 76, y: 87, color: '#818cf8' },
];

// ── SPIRIT CONFIG ──
const SPIRIT_CONFIG = [
  { id: 'ronin', img: cosmicRonin,      color: '#fbbf24', x: 18, y: 14, delay: 0 },
  { id: 'glam',  img: glamarchy,         color: '#f472b6', x: 78, y: 15, delay: 1.2 },
  { id: 'inter', img: intergalactic0,    color: '#2dd4bf', x: 15, y: 78, delay: 2.4 },
  { id: 'metal', img: metalnessMonster,  color: '#ef4444', x: 80, y: 80, delay: 3.6 },
];

// ── INSTRUMENT SVG PATHS (viewBox 0 0 100 100) ──
const INSTRUMENT_PATHS = [
  'M50 5L35 40L20 90L30 92L42 52L50 56L58 52L70 92L80 90L65 40ZM48 56L48 98L52 98L52 56ZM44 98L56 98L56 95L44 95Z',
  'M10 35L10 65L70 65L70 35ZM70 45L90 30L92 35L72 50ZM18 40L18 60L22 60L22 40ZM26 40L26 60L30 60L30 40ZM34 40L34 60L38 60L38 40ZM42 40L42 60L46 60L46 40ZM50 40L50 60L54 60L54 40ZM58 40L58 60L62 60L62 40Z',
  'M25 55Q25 42 50 42Q75 42 75 55L75 78Q75 88 50 88Q25 88 25 78ZM15 28L42 52M85 28L58 52M15 25L19 22M81 22L85 25M35 48Q35 38 50 38Q65 38 65 48',
  'M44 8Q44 2 50 2Q56 2 56 8L56 24Q56 30 50 30Q44 30 44 24ZM38 18L34 18M62 18L66 18M48 30L48 36L42 38L58 38L52 36L52 30M49 38L49 94L51 94L51 38M40 94L60 94L60 97L40 97Z',
];

// ── TOWERING SILHOUETTES (behind island, beat 5–7) ──
const TOWER_CONFIG = [
  { id: 'tw-ronin', img: cosmicRonin,      color: '#fbbf24', x: 24, y: 28 },
  { id: 'tw-glam',  img: glamarchy,         color: '#f472b6', x: 38, y: 26 },
  { id: 'tw-inter', img: intergalactic0,    color: '#2dd4bf', x: 52, y: 26 },
  { id: 'tw-metal', img: metalnessMonster,  color: '#ef4444', x: 66, y: 28 },
];

// ── UTILITIES ───────────────────────────────────────────────────────────────
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function seededRand(seed) {
  let s = Math.abs(seed) || 1;
  return () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; };
}

function generateBoltPoints(x1, y1, x2, y2, segments, jitter, seed) {
  const rng = seededRand(seed);
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const jx = i > 0 && i < segments ? (rng() - 0.5) * jitter * 2 : 0;
    const jy = i > 0 && i < segments ? (rng() - 0.5) * jitter * 2 : 0;
    pts.push(`${(x1 + (x2 - x1) * t + jx).toFixed(1)},${(y1 + (y2 - y1) * t + jy).toFixed(1)}`);
  }
  return pts.join(' ');
}

// ── CSS KEYFRAMES ───────────────────────────────────────────────────────────
const CINE_STYLES = `
  @keyframes om-cloud-pulse { 0%,100%{opacity:0}50%{opacity:0.45} }
  @keyframes om-bolt-flicker { 0%{opacity:1}20%{opacity:0}40%{opacity:1}60%{opacity:0}100%{opacity:0} }
  @keyframes om-spirit-enter { from{opacity:0;transform:scale(.7) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes om-spirit-bob { 0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)} }
  @keyframes om-inst-flash { 0%{opacity:0;transform:scale(.5)}30%{opacity:1;transform:scale(1.1)}100%{opacity:1;transform:scale(1)} }
  @keyframes om-title-slam { 0%{opacity:0;transform:scale(1.8) translateY(-20px);filter:blur(8px)}15%{opacity:1;transform:scale(1.05) translateY(2px);filter:blur(0)}30%{transform:scale(.98) translateY(-1px)}50%,100%{transform:scale(1)} }
  @keyframes om-subtitle-in { from{opacity:0;letter-spacing:14px}to{opacity:1;letter-spacing:6px} }
  @keyframes om-spark { 0%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(.3)} }
  @keyframes om-hex-ripple { 0%{opacity:0;transform:scale(.8)}50%{opacity:.5}100%{opacity:0;transform:scale(1.6)} }
  @keyframes om-crowd-flicker { 0%,100%{opacity:.5}50%{opacity:.9} }
  @keyframes om-heartbeat { 0%,100%{filter:brightness(1)}50%{filter:brightness(1.3)} }
  @keyframes om-rgb-split { 0%{transform:translate(-3px,1px)}25%{transform:translate(3px,-1px)}50%{transform:translate(-2px,-1px)}75%{transform:translate(2px,1px)}100%{transform:translate(0)} }
  @keyframes om-caption-in {
    0%{opacity:0;transform:translate(0,8px);clip-path:inset(0 0 100% 0)}
    12%{opacity:1;transform:translate(-4px,0);clip-path:inset(0 0 0 0);text-shadow:4px 0 #ff2fd6,-4px 0 #66e0ff}
    18%{opacity:0;transform:translate(5px,2px)}
    30%{opacity:1;transform:translate(-2px,-1px);text-shadow:2px 0 #ff2fd6,-2px 0 #66e0ff}
    38%{opacity:0.2;transform:translate(3px,0)}
    50%{opacity:1;transform:translate(0);text-shadow:none}
    100%{opacity:1;transform:translate(0);text-shadow:none}
  }
  @keyframes om-zoom-in   { from{transform:scale(1)}      to{transform:scale(1.08)} }
  @keyframes om-zoom-out  { from{transform:scale(1.08)}   to{transform:scale(1)} }
  @keyframes om-pan-left  { from{transform:translateX(3%)} to{transform:translateX(-3%)} }
  @keyframes om-pan-right { from{transform:translateX(-3%)}to{transform:translateX(3%)} }
  @keyframes om-hold      { from{transform:none}           to{transform:none} }
  @keyframes om-letterbox  { from{transform:scaleY(0)}to{transform:scaleY(1)} }
  @keyframes om-text-up    { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
  @keyframes om-fade-in    { from{opacity:0}to{opacity:1} }
`;

// ── STORYBOARD ──────────────────────────────────────────────────────────────
const STORYBOARD = [
  { id: 'cinematic', durMs: TOTAL_MS, cinematic: true, motion: 'hold',
    image: null, title: '', caption: '' },
  { id: 'logo', durMs: 3500, motion: 'hold', image: null,
    title: '⚡ RLSW', caption: 'ROCK LEGENDS: SPIRIT WARS' },
];

const XFADE_MS = 700;
const OUTRO_MS = 600;
const MOTION_ANIM = {
  'zoom-in':'om-zoom-in','zoom-out':'om-zoom-out',
  'pan-left':'om-pan-left','pan-right':'om-pan-right','hold':'om-hold',
};

// ═════════════════════════════════════════════════════════════════════════════
//  CINEMATIC LAYER — full animated intro driven by BEATS
// ═════════════════════════════════════════════════════════════════════════════

function CinematicLayer({ visible }) {
  const camRef = useRef(null);
  const flashRef = useRef(null);
  const glitchARef = useRef(null);
  const glitchBRef = useRef(null);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  const glitchTimerRef = useRef(null);
  const [beat, setBeat] = useState(-1);
  const [titleBlast, setTitleBlast] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // ── BGM: play opening song, fail silently if autoplay blocked ──
  const audioRef = useRef(null);
  useEffect(() => {
    if (!visible) return;
    const audio = new Audio(rlMovieSong);
    audio.loop = false;
    audio.volume = 0.7;
    audioRef.current = audio;
    audio.play().catch(() => {});
    return () => { audio.pause(); audio.currentTime = 0; };
  }, [visible]);

  // Pre-generate lightning bolt polyline points
  const bolts = useRef({
    sky1: generateBoltPoints(30, 0, 42, 35, 8, 10, 101),
    sky2: generateBoltPoints(70, 0, 60, 30, 7, 12, 202),
    sky3: generateBoltPoints(50, 0, 50, 28, 9, 8, 303),
    islandBlue: generateBoltPoints(41, 40, 42, 62, 6, 3, 401),
    islandGreen: generateBoltPoints(58, 37, 57, 55, 6, 3, 502),
    mega: generateBoltPoints(50, 0, 50, 33, 10, 14, 600),
  });

  // ── rAF loop: camera + beat tracking ──
  useEffect(() => {
    if (!visible) return;
    startRef.current = performance.now();
    let prevBeat = -1;

    const tick = (now) => {
      const elapsed = now - startRef.current;
      if (elapsed > TOTAL_MS) return;

      // Current beat
      let b = 0;
      for (let i = BEATS.length - 1; i >= 0; i--) {
        if (elapsed >= BEATS[i].start) { b = i; break; }
      }
      if (b !== prevBeat) {
        prevBeat = b;
        setBeat(b);
        if (b === 0) setTimeout(() => setRevealed(true), 200);
        if (b === 8) setTitleBlast(true);
        // Flash on beat 5 and 8
        if ((b === 5 || b === 8) && flashRef.current) {
          flashRef.current.style.opacity = b === 8 ? '0.25' : '0.15';
          setTimeout(() => { if (flashRef.current) flashRef.current.style.opacity = '0'; }, 90);
        }
      }

      // Camera interpolation
      const bt = BEATS[b];
      const progress = Math.min(1, (elapsed - bt.start) / (bt.end - bt.start));
      const t = b === 8 ? 1 : easeInOut(progress);
      const sc = bt.camFrom[0] + (bt.camTo[0] - bt.camFrom[0]) * t;
      const tx = bt.camFrom[1] + (bt.camTo[1] - bt.camFrom[1]) * t;
      const ty = bt.camFrom[2] + (bt.camTo[2] - bt.camFrom[2]) * t;

      // Beat 7: shake
      let sx = 0, sy = 0;
      if (b === 7) {
        sx = Math.sin(elapsed * 0.047) * 2.5;
        sy = Math.cos(elapsed * 0.053) * 1.8;
      }

      if (camRef.current) {
        camRef.current.style.transform =
          `scale(${sc.toFixed(4)}) translate(${(tx + sx).toFixed(2)}%, ${(ty + sy).toFixed(2)}%)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [visible]);

  // ── Glitch bursts ──
  useEffect(() => {
    if (!visible) return;
    const rng = seededRand(Date.now());

    const fireBurst = () => {
      const a = glitchARef.current, b2 = glitchBRef.current;
      if (!a || !b2) return;
      const y1 = (rng() * 85).toFixed(0);
      const h1 = (2 + rng() * 6).toFixed(0);
      const y2 = (rng() * 85).toFixed(0);
      const h2 = (2 + rng() * 6).toFixed(0);
      a.style.clipPath = `inset(${y1}% 0 ${100 - y1 - h1}% 0)`;
      a.style.transform = `translateX(${(4 + rng() * 8).toFixed(0)}px)`;
      a.style.opacity = '1';
      b2.style.clipPath = `inset(${y2}% 0 ${100 - y2 - h2}% 0)`;
      b2.style.transform = `translateX(${-(4 + rng() * 8).toFixed(0)}px)`;
      b2.style.opacity = '1';
      const dur = 80 + rng() * 120;
      setTimeout(() => {
        if (glitchARef.current) glitchARef.current.style.opacity = '0';
        if (glitchBRef.current) glitchBRef.current.style.opacity = '0';
      }, dur);
    };

    const schedule = () => {
      const elapsed = startRef.current ? performance.now() - startRef.current : 0;
      const ramp = elapsed > 50000 ? 0.3 : elapsed > 30000 ? 0.6 : 1;
      glitchTimerRef.current = setTimeout(() => {
        fireBurst();
        schedule();
      }, (2000 + rng() * 4000) * ramp);
    };

    // Initial reveal: 2 quick bursts
    setTimeout(() => { fireBurst(); setTimeout(fireBurst, 300); }, 500);
    schedule();
    return () => clearTimeout(glitchTimerRef.current);
  }, [visible]);

  // ── Derived visibility ──
  const showSpirits = beat >= 1 && beat <= 7;
  const showInstruments = beat >= 2 && beat <= 7;
  const showCrowds = beat >= 4 && beat <= 7;
  const showRockGods = beat >= 5 && beat <= 7;
  const dissolving = beat === 7;
  const showSkyBolts = beat === 5 || beat === 8;
  const showIslandBolts = beat >= 1;
  const heartbeat = beat === 6;
  const pulsing = beat >= 1;
  const caption = beat >= 0 && beat < BEATS.length ? BEATS[beat].text : '';

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden', background: '#050810',
    }}>
      {/* ── SVG filter defs ── */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="om-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="bl"/>
            <feMerge><feMergeNode in="bl"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="om-glow-lg">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="bl"/>
            <feMerge><feMergeNode in="bl"/><feMergeNode in="bl"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
      </svg>

      {/* ── CAMERA LAYER (Ken Burns) ── */}
      <div style={{
        position: 'absolute', inset: '-25%',
        opacity: revealed ? 1 : 0, transition: 'opacity 1.5s ease-in',
      }}>
        <div ref={camRef} style={{
          position: 'absolute', inset: 0,
          transformOrigin: '50% 30%', willChange: 'transform',
        }}>
          {/* Main image */}
          <img src={openingIsland} alt="" draggable={false} style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'contain',
          }}/>

          {/* Chromatic aberration — 2 offset tinted copies */}
          <img src={openingIsland} alt="" style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'contain',
            transform: 'translateX(1.5px)',
            filter: 'hue-rotate(-60deg) saturate(3)',
            mixBlendMode: 'screen', opacity: 0.12, pointerEvents: 'none',
          }}/>
          <img src={openingIsland} alt="" style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'contain',
            transform: 'translateX(-1.5px)',
            filter: 'hue-rotate(60deg) saturate(3)',
            mixBlendMode: 'screen', opacity: 0.1, pointerEvents: 'none',
          }}/>

          {/* ── Cloud pulses ── */}
          {pulsing && CLOUD_REGIONS.map((c, i) => (
            <div key={c.id} style={{
              position: 'absolute',
              left: `${c.x - 8}%`, top: `${c.y - 8}%`,
              width: '16%', height: '16%', borderRadius: '50%',
              background: `radial-gradient(circle, ${c.color}88 0%, transparent 70%)`,
              mixBlendMode: 'screen', pointerEvents: 'none',
              animation: `om-cloud-pulse ${2 + (i % 3)}s ease-in-out ${i * 0.7}s infinite`,
              ...(heartbeat ? { filter: 'brightness(1.3)' } : {}),
            }}/>
          ))}

          {/* ── Island lightning traces ── */}
          {showIslandBolts && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', pointerEvents: 'none',
            }}>
              <polyline points={bolts.current.islandBlue} fill="none"
                stroke="#60a5fa" strokeWidth="0.4" filter="url(#om-glow)"
                style={{ animation: 'om-cloud-pulse 3s ease-in-out infinite' }}/>
              <polyline points={bolts.current.islandGreen} fill="none"
                stroke="#34d399" strokeWidth="0.4" filter="url(#om-glow)"
                style={{ animation: 'om-cloud-pulse 3.5s ease-in-out 1s infinite' }}/>
            </svg>
          )}

          {/* ── Spirit silhouettes ── */}
          {SPIRIT_CONFIG.map((sp, i) => (
            <div key={sp.id} style={{
              position: 'absolute',
              left: `${sp.x - 4}%`, top: `${sp.y - 9}%`,
              width: '8%', height: '18%',
              opacity: !showSpirits ? 0 : dissolving ? 0 : 1,
              transition: dissolving ? 'opacity 2s ease-out, filter 2s ease-out' : 'none',
              animation: showSpirits && !dissolving
                ? `om-spirit-enter 1.2s ease-out ${sp.delay}s both, om-spirit-bob 3s ease-in-out ${4 + i * 0.5}s infinite`
                : 'none',
              filter: dissolving
                ? `brightness(0) drop-shadow(0 0 30px ${sp.color}) blur(8px)`
                : `brightness(0) drop-shadow(0 0 12px ${sp.color})`,
              pointerEvents: 'none',
            }}>
              <img src={sp.img} alt="" style={{
                width: '100%', height: '100%', objectFit: 'contain',
              }}/>
            </div>
          ))}

          {/* ── Instrument silhouettes ── */}
          {SPIRIT_CONFIG.map((sp, i) => (
            <div key={`inst-${sp.id}`} style={{
              position: 'absolute',
              left: `${sp.x + (sp.x > 50 ? -8 : 5)}%`,
              top: `${sp.y - 3}%`,
              width: '5%', height: '10%',
              opacity: !showInstruments ? 0 : dissolving ? 0 : 1,
              transition: dissolving ? 'opacity 2s ease-out' : 'none',
              animation: showInstruments && !dissolving
                ? `om-inst-flash 0.6s ease-out ${sp.delay + 0.3}s both`
                : 'none',
              pointerEvents: 'none',
            }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                <path d={INSTRUMENT_PATHS[i]} fill={sp.color} opacity="0.9"
                  filter="url(#om-glow)"/>
              </svg>
            </div>
          ))}

          {/* ── Crowd silhouettes ── */}
          {[
            { img: crowdBlue, color: '#60a5fa', x: 8,  y: 42, flip: false },
            { img: crowdPink, color: '#f472b6', x: 62, y: 48, flip: true },
          ].map((cr, i) => (
            <div key={`crowd-${i}`} style={{
              position: 'absolute',
              left: `${cr.x}%`, top: `${cr.y}%`,
              width: '28%', height: '18%',
              opacity: !showCrowds ? 0 : dissolving ? 0 : 1,
              transition: dissolving ? 'opacity 2s ease-out' : 'opacity 1.5s ease',
              filter: `brightness(0) drop-shadow(0 0 10px ${cr.color})`,
              transform: cr.flip ? 'scaleX(-1)' : 'none',
              animation: showCrowds && !dissolving
                ? `om-crowd-flicker ${1.5 + i * 0.3}s ease-in-out infinite` : 'none',
              pointerEvents: 'none',
            }}>
              <img src={cr.img} alt="" style={{
                width: '100%', height: '100%', objectFit: 'contain',
              }}/>
            </div>
          ))}

          {/* ── Towering character silhouettes (behind island) ── */}
          {TOWER_CONFIG.map((tw) => (
            <div key={tw.id} style={{
              position: 'absolute',
              left: `${tw.x - 5}%`, top: `${tw.y}%`,
              width: '12%', height: '35%',
              opacity: !showRockGods ? 0 : dissolving ? 0 : 0.7,
              transition: dissolving ? 'opacity 2s ease-out' : 'opacity 2s ease-in',
              filter: `brightness(0) drop-shadow(0 0 18px ${tw.color})`,
              pointerEvents: 'none',
            }}>
              <img src={tw.img} alt="" style={{
                width: '100%', height: '100%', objectFit: 'contain',
                objectPosition: 'bottom center',
              }}/>
            </div>
          ))}

          {/* ── Hex-grid ripple (beat 5-6) ── */}
          {(beat === 5 || beat === 6) && (
            <div style={{
              position: 'absolute',
              left: '35%', top: '26%', width: '30%', height: '12%',
              border: '2px solid #ff2fd655', borderRadius: '50%',
              animation: 'om-hex-ripple 2s ease-out forwards',
              pointerEvents: 'none',
            }}/>
          )}

          {/* ── Sky lightning bolts (beat 5 & 8) ── */}
          {showSkyBolts && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', pointerEvents: 'none',
            }}>
              <polyline
                points={beat === 8 ? bolts.current.mega : bolts.current.sky1}
                fill="none" stroke="white" strokeWidth="0.7"
                filter="url(#om-glow-lg)"
                style={{ animation: 'om-bolt-flicker 300ms linear forwards' }}/>
              {beat === 5 && (<>
                <polyline points={bolts.current.sky2} fill="none"
                  stroke="#c084fc" strokeWidth="0.5" filter="url(#om-glow)"
                  style={{ animation: 'om-bolt-flicker 300ms linear 80ms forwards' }}/>
                <polyline points={bolts.current.sky3} fill="none"
                  stroke="#60a5fa" strokeWidth="0.4" filter="url(#om-glow)"
                  style={{ animation: 'om-bolt-flicker 300ms linear 160ms forwards' }}/>
              </>)}
            </svg>
          )}
        </div>{/* end camRef */}
      </div>{/* end camera layer */}

      {/* ── Scanline overlay (always on) ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 3px)',
        opacity: revealed ? 1 : 0, transition: 'opacity 2s ease',
      }}/>

      {/* ── Glitch layer A (red) ── */}
      <div ref={glitchARef} style={{
        position: 'absolute', inset: '-25%',
        opacity: 0, mixBlendMode: 'screen', pointerEvents: 'none',
        transition: 'opacity 50ms',
      }}>
        <img src={openingIsland} alt="" style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%', objectFit: 'contain',
          filter: 'hue-rotate(-90deg) saturate(5) brightness(1.5)',
        }}/>
      </div>

      {/* ── Glitch layer B (cyan) ── */}
      <div ref={glitchBRef} style={{
        position: 'absolute', inset: '-25%',
        opacity: 0, mixBlendMode: 'screen', pointerEvents: 'none',
        transition: 'opacity 50ms',
      }}>
        <img src={openingIsland} alt="" style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%', objectFit: 'contain',
          filter: 'hue-rotate(90deg) saturate(5) brightness(1.5)',
        }}/>
      </div>

      {/* ── White flash ── */}
      <div ref={flashRef} style={{
        position: 'absolute', inset: 0, background: 'white',
        opacity: 0, transition: 'opacity 90ms ease-out', pointerEvents: 'none',
      }}/>

      {/* ── Heartbeat pulse overlay (beat 6) ── */}
      {heartbeat && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          animation: 'om-heartbeat 1.1s ease-in-out infinite',
        }}/>
      )}

      {/* ── TITLE BLAST (beat 8) ── */}
      {titleBlast && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          {/* RGB split shake frame */}
          <div style={{
            animation: 'om-rgb-split 120ms linear 2',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <svg viewBox="0 0 900 100" style={{
              width: 'min(90vw, 900px)', height: 'auto',
              overflow: 'visible',
              animation: 'om-title-slam 800ms cubic-bezier(.16,1,.3,1) forwards',
              filter: 'drop-shadow(0 0 20px #ff2fd6) drop-shadow(0 0 40px #ff2fd688) drop-shadow(0 0 80px #66e0ff44)',
            }}>
              <text x="450" y="70" textAnchor="middle"
                fontFamily="'Orbitron', sans-serif" fontWeight="700"
                fontSize="72" letterSpacing="10"
                fill="#0a0a14" stroke="#ff2fd6" strokeWidth="2.5"
                style={{ paintOrder: 'stroke fill' }}>
                ROCK LEGENDS
              </text>
            </svg>
            <div style={{
              fontFamily: "'Orbitron', sans-serif", fontWeight: 400,
              fontSize: 'clamp(12px, 2vw, 20px)',
              color: '#66e0ff', textShadow: '0 0 12px #66e0ff88',
              marginTop: 14, opacity: 0,
              animation: 'om-subtitle-in 1s ease-out 600ms forwards',
              letterSpacing: 6,
            }}>SPIRIT WARS</div>
          </div>

          {/* Sparks radiating from center */}
          <div style={{ position: 'absolute', left: '50%', top: '48%', pointerEvents: 'none' }}>
            {Array.from({ length: 14 }, (_, i) => {
              const angle = (i / 14) * 360;
              const len = 28 + (i % 3) * 14;
              return (
                <div key={i} style={{
                  position: 'absolute', width: len, height: 2,
                  background: 'linear-gradient(90deg, #ff2fd6, #66e0ff, transparent)',
                  transformOrigin: '0 50%',
                  transform: `rotate(${angle}deg)`,
                  animation: `om-spark 400ms ease-out ${100 + i * 22}ms forwards`,
                  opacity: 0,
                }}/>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Caption bar (bottom 12%) ── */}
      {caption && (
        <div key={`cap-${beat}`} style={{
          position: 'absolute', left: 0, right: 0, bottom: '12%',
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{
            maxWidth: '34rem', padding: '0 24px',
            fontFamily: "'Orbitron', 'Share Tech Mono', monospace",
            fontSize: 'clamp(11px, 1.3vw, 17px)', lineHeight: 1.7,
            color: '#e8e0ff',
            textShadow: '0 0 8px #7c3aed66, 0 1px 3px #000',
            textAlign: 'center',
            animation: 'om-caption-in 500ms steps(4, jump-none) forwards',
          }}>{caption}</div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  SCENE LAYER — one storyboard scene (image, video, placeholder, or cinematic)
// ═════════════════════════════════════════════════════════════════════════════

function SceneLayer({ scene, visible, onVideoEnd }) {
  const anim = MOTION_ANIM[scene.motion] || 'om-hold';
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible) v.play().catch(() => {});
    else v.pause();
  }, [visible]);

  // Cinematic scene — delegate to CinematicLayer
  if (scene.cinematic) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        opacity: visible ? 1 : 0,
        transition: `opacity ${XFADE_MS}ms ease-in-out`,
        pointerEvents: 'none',
      }}>
        <CinematicLayer visible={visible}/>
      </div>
    );
  }

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
              maxWidth: '94vw', maxHeight: '78vh', objectFit: 'contain', display: 'block',
            }}/>
        ) : scene.image ? (
          <img src={scene.image} alt="" draggable={false} style={{
            maxWidth: '82vw', maxHeight: '62vh', objectFit: 'contain', display: 'block',
          }}/>
        ) : (
          <div style={{
            width: 'min(82vw, calc(62vh * 16 / 9))', aspectRatio: '16 / 9',
            background: '#0a1020', border: '1px solid #f6ad5544',
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
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
              letterSpacing: 4, color: '#f6ad55', opacity: 0.1, userSelect: 'none',
            }}>IMAGE — {scene.id}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  OPENING MOVIE — storyboard player (skip, crossfade, scene advance)
// ═════════════════════════════════════════════════════════════════════════════

export default function OpeningMovie({ onDone }) {
  const [idx, setIdx] = useState(0);
  const [outro, setOutro] = useState(false);
  const timerRef = useRef(null);
  const doneRef = useRef(false);

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
      <style>{CINE_STYLES}</style>

      {/* Scene layers — double-buffered crossfade */}
      {STORYBOARD.map((s, i) => (
        (i === idx || i === idx - 1 || i === idx + 1) &&
          <SceneLayer key={s.id} scene={s} visible={i === idx} onVideoEnd={advanceScene}/>
      ))}

      {/* Lower-third text for non-cinematic scenes */}
      {!scene.cinematic && (
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
      )}

      {/* Letterbox bars */}
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

      {/* Progress dots */}
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

      {/* Skip chip */}
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
