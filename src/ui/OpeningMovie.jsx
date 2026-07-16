import React, { useEffect, useRef, useState } from "react";
import openingIsland from "../assets/opening_island.png";
import cosmicRonin from "../standees/Cosmic_Ronin.png";
import glamarchy from "../standees/Glamarchy.png";
import intergalactic0 from "../standees/Intergalactic_0.png";
import metalnessMonster from "../standees/Metalness_Monster.png";
import crowdBlue from "../crowd_blue.png";
import crowdPink from "../crowd_pink.png";
import rlMovieSong from "../rl_movie_song.mp3";
import thunderSfx from "../thunder.mp3";
import rumbleSfx from "../rumble.mp3";

/* ─── 🎬 OPENING MOVIE (v2) ─────────────────────────────────────────────────
 * Skippable cinematic before Spirit Select. Any key/click/tap skips.
 * Pure presentation — no engine imports, no game state.
 * Owner tunes the movie by editing the BEATS array.
 *
 * STRUCTURE:
 *   Beats 0–3 (0–30s): blank-screen intro. A sparse trail of hexes reveals
 *     (~10, receding into the distance), then each Spirit gets a partial
 *     silhouette reveal — camera panning L/R (alternating), cutting to the
 *     next. Thunder pulses throughout. Story captions roll the whole time.
 *   Beat 4 (30s): the floating board island PUNCHES IN as the fans enter
 *     the story. From here the original island cinematic plays unchanged —
 *     crowds, mega bolt, rock gods, heartbeat, dissolve, title blast.
 * ────────────────────────────────────────────────────────────────────────── */

// ── BEAT TIMELINE ───────────────────────────────────────────────────────────
// camFrom/camTo: [scale, translateX%, translateY%] (island camera, beat 4+)
const BEATS = [
  { id: 0, start: 0,     end: 3000,  text: '',
    camFrom: [1.0, 0, 0], camTo: [1.0, 0, 0], cues: ['hex-reveal'] },
  { id: 1, start: 3000,  end: 16000,
    text: 'From the furthest corners of the Cosmos, Spirits arise — each born from a unique Musical Realm, each Dimension carrying its own Space-Time signature and genre.',
    camFrom: [1.0, 0, 0], camTo: [1.0, 0, 0], cues: ['spirit-intros'] },
  { id: 2, start: 16000, end: 26000,
    text: 'These Spirits have mastered their music completely. Their instruments are their weapons. Their sound is their power.',
    camFrom: [1.0, 0, 0], camTo: [1.0, 0, 0], cues: ['spirit-intros'] },
  { id: 3, start: 26000, end: 30000,
    text: 'Four realms. Four sounds. One stage.',
    camFrom: [1.0, 0, 0], camTo: [1.0, 0, 0], cues: ['pulse-unison'] },
  { id: 4, start: 30000, end: 42000,
    text: 'For eons, Genre Gate-keepers and Purists bickered endlessly about whose music was the greatest.',
    camFrom: [1.22, -4, -2], camTo: [1.22, 4, -2], cues: ['island-punch', 'crowds-enter'] },
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
    camFrom: [1.20, 0, 1], camTo: [1.20, 0, 1], cues: ['title-blast'] },
];

const TOTAL_MS = 72000;
const ISLAND_START_MS = 30000; // beat 4 — island punches in here

// ── SPIRIT INTRO SEGMENTS (beats 1–2, alternating pan direction) ──
const SPIRIT_INTROS = [
  { start: 3000,  end: 8750,  panRight: true  },
  { start: 8750,  end: 14500, panRight: false },
  { start: 14500, end: 20250, panRight: true  },
  { start: 20250, end: 26000, panRight: false },
];

// ── SPIRIT CONFIG (intro reveals + towering silhouettes) ──
const SPIRITS = [
  { id: 'ronin', img: cosmicRonin,      color: '#fbbf24', glowColor: '#fbbf2488' },
  { id: 'glam',  img: glamarchy,         color: '#f472b6', glowColor: '#f472b688' },
  { id: 'inter', img: intergalactic0,    color: '#2dd4bf', glowColor: '#2dd4bf88' },
  { id: 'metal', img: metalnessMonster,  color: '#ef4444', glowColor: '#ef444488' },
];

// ── INTRO HEXES — sparse trail receding into the distance ──
// Front hexes are big/low/bright; they shrink, rise, and dim "going back".
// Reveal order is shuffled (deterministic) so they pop in a random pattern.
const INTRO_HEXES = (() => {
  const rng = seededRand(7);
  const hexes = [];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);                      // 0 = front … 1 = far back
    const size = 8.5 - t * 6;                   // 8.5% → 2.5%
    // Rejection-sample the position so hexes never overlap each other
    let x = 50, y = 50;
    for (let tries = 0; tries < 80; tries++) {
      x = 18 + t * 58 + (rng() - 0.5) * 26;     // wanders across the screen
      y = 76 - t * 44 + (rng() - 0.5) * 10;     // low front → high back
      const clear = hexes.every(h =>
        Math.hypot(x - h.x, y - h.y) > (size + h.size) * 1.25);
      if (clear) break;
    }
    hexes.push({ x, y, size, dim: 0.55 - t * 0.35 });
  }
  // Shuffled reveal order
  const order = hexes.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return hexes.map((h, i) => ({ ...h, revealIdx: order.indexOf(i) }));
})();

function hexCorners(cx, cy, size) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i);
    return `${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * 0.86 * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

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

// ── TOWERING SILHOUETTES (behind island, beat 5–7) ──
const TOWER_CONFIG = [
  { id: 'tw-ronin', img: cosmicRonin,      color: '#fbbf24', x: 24, y: 28, sc: 1 },
  { id: 'tw-glam',  img: glamarchy,         color: '#f472b6', x: 38, y: 26, sc: 0.65 },
  { id: 'tw-inter', img: intergalactic0,    color: '#2dd4bf', x: 52, y: 26, sc: 1 },
  { id: 'tw-metal', img: metalnessMonster,  color: '#ef4444', x: 66, y: 28, sc: 1 },
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
  @keyframes om-hex-pop {
    0%   { opacity:0; transform:scale(0.3); }
    60%  { opacity:1; transform:scale(1.08); }
    100% { opacity:1; transform:scale(1); }
  }
  @keyframes om-spirit-slide-r { 0%{transform:translateX(-16%)}100%{transform:translateX(16%)} }
  @keyframes om-spirit-slide-l { 0%{transform:translateX(16%)}100%{transform:translateX(-16%)} }
  @keyframes om-spirit-fade {
    0%   { opacity:0; }
    22%  { opacity:0.9; }
    82%  { opacity:0.9; }
    100% { opacity:0; }
  }
  @keyframes om-unison-pulse {
    0%   { opacity:0; transform:scale(0.92); }
    30%  { opacity:0.95; transform:scale(1); }
    55%  { transform:scale(1.06); filter:brightness(1.4); }
    75%  { transform:scale(1); filter:brightness(1); }
    100% { opacity:0.95; transform:scale(1); }
  }
  @keyframes om-island-punch {
    0%   { opacity:0; transform:scale(2.6); filter:brightness(2.2) blur(10px); }
    35%  { opacity:1; transform:scale(1.06); filter:brightness(1.25) blur(1px); }
    60%  { transform:scale(0.985); filter:brightness(1) blur(0); }
    80%  { transform:scale(1.005); }
    100% { opacity:1; transform:scale(1); filter:brightness(1); }
  }
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
  const [elapsedMs, setElapsedMs] = useState(0);
  const [titleBlast, setTitleBlast] = useState(false);
  const fireThunderRef = useRef(null);  // set by the thunder effect
  const rumbleRef = useRef(null);

  // ── SFX helper — fire-and-forget, fails silently if autoplay blocked ──
  const playSfx = (src, vol = 0.6) => {
    try {
      const a = new Audio(src);
      a.volume = vol;
      a.play().catch(() => {});
      return a;
    } catch { return null; }
  };

  // ── BGM: play opening song, fail silently if autoplay blocked ──
  const audioRef = useRef(null);
  useEffect(() => {
    if (!visible) return;
    const audio = new Audio(rlMovieSong);
    audio.loop = false;
    audio.volume = 0.7;
    audioRef.current = audio;
    audio.play().catch(() => {});
    return () => {
      audio.pause(); audio.currentTime = 0;
      if (rumbleRef.current) { rumbleRef.current.pause(); rumbleRef.current = null; }
    };
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
      setElapsedMs(elapsed);

      // Current beat
      let b = 0;
      for (let i = BEATS.length - 1; i >= 0; i--) {
        if (elapsed >= BEATS[i].start) { b = i; break; }
      }
      if (b !== prevBeat) {
        prevBeat = b;
        setBeat(b);
        // Beat 8: ROCK LEGENDS reveal — the one and only thunder crack
        if (b === 8) {
          setTitleBlast(true);
          playSfx(thunderSfx, 0.8);
        }
        // Intro beats 1–3: words flash on with a silent flash pulse
        if (b >= 1 && b <= 3 && fireThunderRef.current) {
          fireThunderRef.current();
        }
        // Beat 7: the shake — start the rumble
        if (b === 7) {
          rumbleRef.current = playSfx(rumbleSfx, 0.85);
        }
        // Flash on beat 4 (island punch), 5 (mega bolt) and 8 (title)
        if ((b === 4 || b === 5 || b === 8) && flashRef.current) {
          flashRef.current.style.opacity = b === 8 ? '0.25' : b === 4 ? '0.2' : '0.15';
          setTimeout(() => { if (flashRef.current) flashRef.current.style.opacity = '0'; }, 90);
        }
      }

      // Camera interpolation (island layer, beat 4+)
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

  // ── Flash pulses (intro phase, beats 0–3) — silent, visual only ──
  useEffect(() => {
    if (!visible) return;
    const rng = seededRand(Date.now());
    let timer;
    const strike = () => {
      if (flashRef.current) {
        flashRef.current.style.opacity = '0.1';
        setTimeout(() => { if (flashRef.current) flashRef.current.style.opacity = '0'; }, 70);
      }
    };
    fireThunderRef.current = strike; // beat changes fire this when words flash on
    const fire = () => {
      const elapsed = startRef.current ? performance.now() - startRef.current : 0;
      if (elapsed < ISLAND_START_MS) {
        strike();
        timer = setTimeout(fire, 1600 + rng() * 3200);
      }
    };
    timer = setTimeout(fire, 1400);
    return () => { clearTimeout(timer); fireThunderRef.current = null; };
  }, [visible]);

  // ── Glitch bursts (island phase only, beat 4+) ──
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
      const ramp = elapsed > 50000 ? 0.3 : elapsed > 40000 ? 0.6 : 1;
      glitchTimerRef.current = setTimeout(() => {
        const el = startRef.current ? performance.now() - startRef.current : 0;
        if (el >= ISLAND_START_MS) fireBurst(); // only glitch once island is up
        schedule();
      }, (2000 + rng() * 4000) * ramp);
    };

    schedule();
    return () => clearTimeout(glitchTimerRef.current);
  }, [visible]);

  // ── Derived visibility ──
  const introPhase = beat >= 0 && beat <= 3;         // blank-screen intro
  const islandUp = beat >= 4;                        // island cinematic
  const showCrowds = beat >= 4 && beat <= 7;
  const showRockGods = beat >= 5 && beat <= 7;
  const dissolving = beat === 7;
  const showSkyBolts = beat === 8; // lightning strikes only at the title reveal
  const heartbeat = beat === 6;
  const caption = beat >= 0 && beat < BEATS.length ? BEATS[beat].text : '';

  // Current Spirit intro segment (beats 1–2)
  let introIdx = -1;
  for (let i = 0; i < SPIRIT_INTROS.length; i++) {
    if (elapsedMs >= SPIRIT_INTROS[i].start && elapsedMs < SPIRIT_INTROS[i].end) { introIdx = i; break; }
  }
  const intro = introIdx >= 0 ? SPIRIT_INTROS[introIdx] : null;
  const introSpirit = introIdx >= 0 ? SPIRITS[introIdx] : null;

  // How many intro hexes are revealed (staggered across beat 0, persist after)
  const hexCount = introPhase
    ? Math.min(INTRO_HEXES.length, Math.floor((elapsedMs / 2800) * INTRO_HEXES.length) + 1)
    : 0;

  return (
    <div style={{
      // #131612 = the exact edge color of opening_island.png, so the image
      // boundary dissolves into the backdrop with no visible seam.
      position: 'absolute', inset: 0, overflow: 'hidden', background: '#131612',
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

      {/* ═══ INTRO PHASE (beats 0–3): sparse hex trail ═══ */}
      {introPhase && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none',
        }}>
          {INTRO_HEXES.map((h, i) => h.revealIdx < hexCount && (
            <polygon key={i}
              points={hexCorners(h.x, h.y, h.size)}
              fill="#ff2fd608"
              stroke="#ff2fd6"
              strokeOpacity={h.dim}
              strokeWidth={0.18}
              filter="url(#om-glow)"
              style={{
                transformOrigin: `${h.x}% ${h.y}%`,
                animation: 'om-hex-pop 700ms ease-out both',
              }}
            />
          ))}
        </svg>
      )}

      {/* ═══ INTRO PHASE: Spirit silhouette pan reveals (beats 1–2) ═══ */}
      {intro && introSpirit && (
        <div key={`intro-${introIdx}`} style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
        }}>
          {/* Atmospheric realm-color glow */}
          <div style={{
            position: 'absolute', top: '8%', bottom: '8%',
            left: intro.panRight ? '38%' : '8%', width: '54%',
            background: `radial-gradient(ellipse at center, ${introSpirit.glowColor} 0%, transparent 70%)`,
            mixBlendMode: 'screen', opacity: 0.28,
            animation: `om-spirit-fade ${intro.end - intro.start}ms ease-in-out both`,
          }}/>
          {/* Partial silhouette, panning */}
          <div style={{
            position: 'absolute', top: '4%', bottom: '4%',
            left: intro.panRight ? '52%' : '-8%', width: '56%',
            animation: `${intro.panRight ? 'om-spirit-slide-r' : 'om-spirit-slide-l'} ${intro.end - intro.start}ms ease-in-out both`,
          }}>
            <div style={{
              width: '100%', height: '100%',
              animation: `om-spirit-fade ${intro.end - intro.start}ms ease-in-out both`,
            }}>
              <img src={introSpirit.img} alt="" draggable={false} style={{
                width: '100%', height: '100%', objectFit: 'contain',
                filter: `brightness(0) drop-shadow(0 0 25px ${introSpirit.color}) drop-shadow(0 0 55px ${introSpirit.glowColor})`,
              }}/>
            </div>
          </div>
        </div>
      )}

      {/* ═══ INTRO PHASE: unison pulse (beat 3 — "Four realms…") ═══ */}
      {beat === 3 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '3%', pointerEvents: 'none',
        }}>
          {SPIRITS.map((sp, i) => (
            <div key={sp.id} style={{
              width: '14%', height: '55%',
              animation: `om-unison-pulse 2.6s ease-out ${i * 0.12}s both`,
            }}>
              <img src={sp.img} alt="" draggable={false} style={{
                width: '100%', height: '100%', objectFit: 'contain',
                filter: `brightness(0) drop-shadow(0 0 15px ${sp.color})`,
              }}/>
            </div>
          ))}
        </div>
      )}

      {/* ── ISLAND CAMERA LAYER (Ken Burns, beat 4+) ── */}
      <div style={{
        position: 'absolute', inset: '-25%',
        opacity: islandUp ? 1 : 0,
        pointerEvents: 'none',
        animation: islandUp ? 'om-island-punch 1.6s cubic-bezier(.16,1,.3,1) both' : 'none',
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
          {islandUp && CLOUD_REGIONS.map((c, i) => (
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
          {islandUp && (
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

          {/* ── Crowd silhouettes (the fans — beat 4) ── */}
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
              transform: tw.sc !== 1 ? `scale(${tw.sc})` : 'none',
              transformOrigin: 'bottom center',
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

          {/* ── Sky lightning bolts (beat 8 — ROCK LEGENDS reveal only) ── */}
          {showSkyBolts && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', pointerEvents: 'none',
            }}>
              <polyline points={bolts.current.mega}
                fill="none" stroke="white" strokeWidth="0.7"
                filter="url(#om-glow-lg)"
                style={{ animation: 'om-bolt-flicker 300ms linear forwards' }}/>
              <polyline points={bolts.current.sky2} fill="none"
                stroke="#c084fc" strokeWidth="0.5" filter="url(#om-glow)"
                style={{ animation: 'om-bolt-flicker 300ms linear 80ms forwards' }}/>
              <polyline points={bolts.current.sky3} fill="none"
                stroke="#60a5fa" strokeWidth="0.4" filter="url(#om-glow)"
                style={{ animation: 'om-bolt-flicker 300ms linear 160ms forwards' }}/>
            </svg>
          )}
        </div>{/* end camRef */}
      </div>{/* end camera layer */}

      {/* ── Edge vignette (island phase) — melts the image border into the bg ── */}
      {islandUp && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 48%, #131612 96%)',
        }}/>
      )}

      {/* ── Scanline overlay (always on) ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 3px)',
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
      position: 'fixed', inset: 0, background: '#131612',
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
