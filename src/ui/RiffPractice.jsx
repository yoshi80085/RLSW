// =============================================================================
// ui/RiffPractice.jsx — 🎸 RIFF PRACTICE — the arrow highway, with the knobs
// -----------------------------------------------------------------------------
// This is the PROTOTYPE, not a version of it. All the rendering, audio, judging
// and generation live in riff/arrowHighwayEngine.js, which is the prototype's
// own code lifted out of arrow-highway-proto.html with a mount contract bolted
// on. React's entire job here is:
//
//   1. hand the engine a <canvas>
//   2. render the knob panel, which writes straight into engine.K
//   3. show the readouts the engine pushes back out
//
// Nothing about the highway is re-expressed in JSX, deliberately. The first
// attempt at putting this in the game rebuilt it as SVG lanes and it drifted
// immediately — flat gems, no sustains, no bends, no perspective. Owning one
// copy of the engine is the fix.
//
// Knobs are mutated on the LIVE object rather than held in React state: the
// engine reads K every frame, so a slider takes effect on the next frame with
// no re-render. Only the readouts are state.
// =============================================================================
import React, { useEffect, useRef, useState, useCallback } from "react";
import { mountArrowHighway } from "../riff/arrowHighwayEngine.js";
import { GENRES } from "../riff/riffArchetypes.js";

const ACCENT = '#19e6ff';

const ARCHETYPES = [
  ['',            '— archetype: let the genre pick —'],
  ['pedal',       'PEDAL — root pulls you back ↑↓↑↓'],
  ['chug',        'CHUG — repetition in runs →→→'],
  ['gallop',      'GALLOP — long-short-short'],
  ['run',         'RUN — one direction ↑↑↑↑'],
  ['arch_run',    'ARCH RUN — up and back ↑↑↑↓↓↓'],
  ['chromatic',   'CHROMATIC — semitone creep'],
  ['blues_box',   'BLUES BOX — pentatonic + bends'],
  ['power_plane', 'POWER PLANE — wide root leaps'],
  ['alt_cell',    'ALT CELL — A-B-A-B'],
];

const TIERS = [
  ['rookie',   '📱 INFLUENCER — learn the shapes'],
  ['gigging',  '🔥 GIGGING — working tempo'],
  ['shredder', '⚡ SHREDDER — fast drop'],
  ['virtuoso', '🌟 VIRTUOSO — wall of gems'],
];

// [id, key, label, min, max, step, format, rebuildsRiff]
const KNOBS = {
  feel: [
    ['persp',      'perspective',  0,    6,    0.1,  v => v.toFixed(1), false],
    ['depth',      'neck length',  0.3,  0.95, 0.01, v => v.toFixed(2), false],
    ['far',        'nut width',    0.06, 0.7,  0.01, v => v.toFixed(2), false],
    ['lead',       'lead time',    600,  3000, 50,   v => `${Math.round(v)}ms`, false],
    ['space',      'note spacing', 140,  700,  10,   v => `${Math.round(v)}ms`, false],
  ],
  material: [
    ['len',        'riff length',  4,   20,  1,    v => Math.round(v), true],
    ['susRate',    'sustains',     0,   70,  2,    v => `${Math.round(v)}%`, true],
    ['bendRate',   'bends',        0,   100, 5,    v => `${Math.round(v)}% of sustains`, true],
    ['bendDepth',  'bend depth',   1,   3,   1,    v => `${Math.round(v)} semitones max`, true],
    ['bendTravel', 'bend travel',  0.06, 0.5, 0.01, v => `${v.toFixed(2)}s`, false],
    ['chordRate',  'two-note chords', 0, 80, 5,    v => `${Math.round(v)}%`, true],
    ['drive',      'amp drive',    0,   1,   0.02, v => v.toFixed(2), false],
  ],
  readability: [
    ['gemSize',    'gem size',     0.7, 1.8, 0.05, v => `${v.toFixed(2)}×`, false],
  ],
};

export function RiffPractice({ initialDiff, onBack }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const [stats,   setStats]   = useState(null);
  const [riffInfo, setRiffInfo] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [notes,   setNotes]   = useState([]);
  const [, force] = useState(0);
  const redraw = useCallback(() => force(n => n + 1), []);

  // ── Mount the engine once ────────────────────────────────────────────────
  useEffect(() => {
    const h = mountArrowHighway(canvasRef.current);
    engineRef.current = h;
    if (initialDiff && h.K) h.K.tier = initialDiff;
    h.onStats   = setStats;
    h.onRiff    = setRiffInfo;
    h.onVerdict = setVerdict;
    setNotes(h.readabilityNote());
    h.newRiff();
    redraw();
    return () => { h.destroy(); engineRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ESC to exit ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onBack?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const K = engineRef.current?.K;

  function setKnob(key, value, rebuild) {
    const h = engineRef.current;
    if (!h) return;
    h.K[key] = value;
    if (key === 'drive') h.setDrive(value);
    if (rebuild && !h.isRunning()) h.newRiff();
    redraw();
  }

  function setSelect(key, value, rebuild = true) {
    const h = engineRef.current;
    if (!h) return;
    h.K[key] = value;
    if (key === 'tier') {
      const t = h.K.tier;
      h.K.lead = { rookie: 2000, gigging: 1600, shredder: 1150, virtuoso: 900 }[t] ?? 1600;
    }
    setNotes(h.readabilityNote());
    if (rebuild && !h.isRunning()) h.newRiff();
    redraw();
  }

  const knob = ([key, label, min, max, step, fmt, rebuild]) => (
    <div key={key} style={S.knob}>
      <label style={S.knobLabel}>
        <span>{label}</span><b style={{ color: ACCENT }}>{K ? fmt(K[key]) : '—'}</b>
      </label>
      <input type="range" min={min} max={max} step={step}
        value={K ? K[key] : min}
        onChange={e => setKnob(key, parseFloat(e.target.value), rebuild)}
        style={S.range} />
    </div>
  );

  const stat = (label, value, color) => (
    <div style={S.stat}><span>{label}</span><b style={{ color: color || '#ffffee' }}>{value}</b></div>
  );

  return (
    <div style={S.wrap}>
      <style>{RANGE_CSS}</style>

      {/* ── the highway ── */}
      <div style={S.stage}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* ── the panel ── */}
      <div style={S.panel}>
        <h1 style={S.h1}>ARROW HIGHWAY</h1>
        <div style={S.sub}>riff practice</div>

        <button style={S.go} onClick={() => { engineRef.current?.start(); setVerdict(null); redraw(); }}>
          ▶ RUN THE RIFF
        </button>
        <div style={{ height: 6 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.btn} onClick={() => { engineRef.current?.newRiff(); setVerdict(null); }}>↻ new riff</button>
          <button style={S.btn} onClick={() => engineRef.current?.replay()}>♪ hear it</button>
        </div>

        <h2 style={S.h2}>DIFFICULTY</h2>
        <select style={S.select} value={K?.tier ?? 'gigging'}
          onChange={e => setSelect('tier', e.target.value)}>
          {TIERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <h2 style={S.h2}>MATERIAL</h2>
        <select style={S.select} value={K?.genre ?? 'metal'}
          onChange={e => setSelect('genre', e.target.value)}>
          {Object.entries(GENRES).map(([v, g]) => <option key={v} value={v}>{g.label}</option>)}
        </select>
        <div style={{ height: 6 }} />
        <select style={S.select} value={K?.style ?? ''}
          onChange={e => setSelect('style', e.target.value || null)}>
          <option value="">— no Style bias —</option>
          <option value="Shred">⚡ SHRED — the run</option>
          <option value="Groove">🔁 GROOVE — the pattern</option>
          <option value="Flair">✨ FLAIR — the flavor</option>
        </select>
        <div style={{ height: 6 }} />
        <select style={S.select} value={K?.arch ?? ''}
          onChange={e => setSelect('arch', e.target.value || null)}>
          {ARCHETYPES.map(([v, l]) => <option key={v || 'auto'} value={v}>{l}</option>)}
        </select>
        <div style={{ height: 8 }} />
        {KNOBS.material.map(knob)}

        <h2 style={S.h2}>FEEL</h2>
        {KNOBS.feel.map(knob)}

        <h2 style={S.h2}>READABILITY</h2>
        <select style={S.select} value={K?.gemForm ?? 'shape'}
          onChange={e => setSelect('gemForm', e.target.value, false)}>
          <option value="shape">SHAPE only — silhouette</option>
          <option value="both">SHAPE + glyph</option>
          <option value="glyph">GLYPH only — the original</option>
        </select>
        <div style={{ height: 6 }} />
        <select style={S.select} value={K?.colorMode ?? 'both'}
          onChange={e => setSelect('colorMode', e.target.value, false)}>
          <option value="both">COLOR: fill = direction, rim = string</option>
          <option value="direction">COLOR: direction only</option>
          <option value="string">COLOR: string only</option>
        </select>
        <div style={{ height: 6 }} />
        <select style={S.select} value={K?.palette ?? 'neon'}
          onChange={e => setSelect('palette', e.target.value, false)}>
          <option value="neon">PALETTE: neon (colorblind-safe)</option>
          <option value="rgb">PALETTE: green / red / blue</option>
        </select>
        <div style={{ height: 8 }} />
        {KNOBS.readability.map(knob)}
        {notes.map((n, i) => <div key={i} style={S.hint}>{n}</div>)}

        <h2 style={S.h2}>CONTROLS</h2>
        <div style={S.hint}>
          <b style={{ color: ACCENT }}>1</b>–<b style={{ color: ACCENT }}>6</b> the string
          (1 = low E, 6 = high e)<br />
          <b style={{ color: '#ff8a2a' }}>↑ ↓</b> bend a ringing note<br /><br />
          One hand. Hit the number as the gem crosses the bridge. <b>Hold</b> it
          through a tail to sustain. Two gems joined by a dashed bar are a chord —
          press both.
        </div>

        <h2 style={S.h2}>RUN</h2>
        {stat('PERFECT', stats?.perfect ?? 0, '#ffffee')}
        {stat('GOOD',    stats?.good ?? 0,    ACCENT)}
        {stat('OK',      stats?.ok ?? 0,      '#8a5cff')}
        {stat('MISS / WRONG', stats?.miss ?? 0, '#8899aa')}
        {stat('best streak', stats?.bestStreak ?? 0)}
        {stat('sustain held', stats?.susTotal ? `${stats.susHeld}/${stats.susTotal}` : '—')}
        {stat('bends landed', stats?.bendTotal ? `${stats.bends}/${stats.bendTotal}` : '—')}
        {stat('chords nailed', stats?.chords ?? 0)}

        <h2 style={S.h2}>READ</h2>
        {verdict ? (
          <div style={S.read}>
            <b style={{ color: '#ff2d95', fontSize: 15 }}>{verdict.score}%</b> clean<br /><br />
            Now hit <b>♪ hear it</b>. Did your hands know they were playing that?
          </div>
        ) : riffInfo ? (
          <div style={S.read}>
            <b style={{ color: '#ff2d95' }}>{riffInfo.archetype}</b><br />
            <span style={{ color: '#7f8ca3' }}>{riffInfo.scaleName} · form {riffInfo.form}</span><br /><br />
            <b>{riffInfo.count} notes</b> — ↑{riffInfo.up} ↓{riffInfo.down} →{riffInfo.same}{' '}
            <span style={{ color: '#7f8ca3' }}>({riffInfo.samePct}% same)</span><br />
            longest run: <b>{riffInfo.longestRun}</b> notes one way<br />
            → clustered <b>{riffInfo.clustered}</b> · scattered <b>{riffInfo.scattered}</b><br />
            {riffInfo.sustains} sustains · {riffInfo.bends} bends
            {riffInfo.showpieces > 0 && <> (<b style={{ color: '#ff2d95' }}>{riffInfo.showpieces} SING</b>)</>}
            {' '}· {riffInfo.chords} chords<br /><br />
            Hit <b>♪ hear it</b> — that melody is what your arrows played.
          </div>
        ) : <div style={S.read}>Building…</div>}

        <div style={{ height: 14 }} />
        <button style={S.btn} onClick={onBack}>← BACK (esc)</button>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const RANGE_CSS = `
  .rp-range { -webkit-appearance:none; appearance:none; width:100%; height:3px;
              background:#19e6ff2e; border-radius:2px; outline:none; }
  .rp-range::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px;
              border-radius:50%; background:#19e6ff; box-shadow:0 0 8px #19e6ff; cursor:pointer; }
  .rp-range::-moz-range-thumb { width:12px; height:12px; border:none; border-radius:50%;
              background:#19e6ff; box-shadow:0 0 8px #19e6ff; cursor:pointer; }
`;

const S = {
  wrap:  { display: 'flex', height: '100vh', background: '#030810', color: '#ffffee',
           fontFamily: 'ui-monospace, Menlo, Consolas, monospace', overflow: 'hidden' },
  stage: { flex: 1, position: 'relative', minWidth: 0 },
  panel: { width: 276, flex: 'none', padding: '14px 15px', overflowY: 'auto', fontSize: 11,
           background: 'linear-gradient(180deg,#06111f 0%,#030810 100%)',
           borderLeft: '1px solid #19e6ff33' },
  h1:    { fontSize: 13, margin: '0 0 2px', letterSpacing: '.14em', color: ACCENT,
           textShadow: `0 0 10px ${ACCENT}` },
  sub:   { color: '#19e6ff77', fontSize: 9.5, marginBottom: 14, letterSpacing: '.08em' },
  h2:    { fontSize: 9.5, letterSpacing: '.18em', color: '#ff2d95', margin: '16px 0 7px',
           textShadow: '0 0 8px #ff2d9566', borderBottom: '1px solid #ff2d9522', paddingBottom: 4 },
  knob:  { marginBottom: 9 },
  knobLabel: { display: 'flex', justifyContent: 'space-between', color: '#cfd8e8',
               marginBottom: 3, fontSize: 10 },
  range: { width: '100%', height: 3, WebkitAppearance: 'none', appearance: 'none',
           background: '#19e6ff2e', borderRadius: 2, outline: 'none', accentColor: ACCENT },
  select:{ width: '100%', padding: '7px 8px', font: 'inherit', fontSize: 10.5,
           background: '#0a172a', color: '#ffffee', border: '1px solid #19e6ff55',
           borderRadius: 4, cursor: 'pointer' },
  btn:   { width: '100%', padding: '7px 8px', font: 'inherit', fontSize: 10.5,
           background: '#0a172a', color: '#ffffee', border: '1px solid #19e6ff55',
           borderRadius: 4, cursor: 'pointer' },
  go:    { width: '100%', padding: 10, font: 'inherit', fontSize: 10.5, fontWeight: 700,
           letterSpacing: '.12em', background: '#12233d', color: '#ffffee',
           border: '1px solid #ff2d95', borderRadius: 4, cursor: 'pointer',
           textShadow: '0 0 8px #ff2d95' },
  hint:  { color: '#7f8ca3', lineHeight: 1.55, fontSize: 9.5, marginTop: 6 },
  stat:  { display: 'flex', justifyContent: 'space-between', padding: '2px 0',
           color: '#a8b4c8', fontSize: 10 },
  read:  { fontSize: 10, lineHeight: 1.6, color: '#a8b4c8' },
};
