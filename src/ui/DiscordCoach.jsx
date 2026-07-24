// =============================================================================
// ui/DiscordCoach.jsx — 🎩 DISCORD COACH — dissonance with intent
// -----------------------------------------------------------------------------
// The game already SELLS dissonance — Discord notes buy Drive. But nothing
// TEACHES the ear judgment underneath: which off-notes add depth, and how to
// resolve them. This mode is that teacher: a chord ringing underneath you, the
// fretboard lit with chord/color/spice layers, and a coach that rewards
// tension you actually release.
//
// Free time — no metronome, no falling gems. Harmony practice.
// =============================================================================
import React, { useState, useRef, useEffect, useCallback } from "react";
import { STRING_OPENS, MAX_FRET, cellKey } from "../riff/guitarMap.js";
import { CHORD_TEMPLATES, PC_NAMES } from "../music/chords.js";
import { spiceSetFor, classifyNote, expireOpenNotes, coachLine } from "../music/spice.js";
import { TONE_KNOB_DEFAULTS, TONE_VOICE_ORDER, TONE_VOICES, playAmpNote } from "../audio/ampVoice.js";
import { getRiffAudio } from "../audio/riffSfx.js";
import { FretboardFull } from "./FretboardFull.jsx";
import { ToneFader } from "./ToneFader.jsx";
// RigPicker not used — Discord Coach has its own inline tone panel

// ── Neon palette ────────────────────────────────────────────────────────────
const ACCENT     = '#19e6ff';
const NEON_GREEN = '#44ff88';
const NEON_VIOLET  = '#8a5cff';
const NEON_MAGENTA = '#ff2d95';

// ── Chord rung ladder (consonance → dissonance arc) ─────────────────────────
const RUNG_ORDER = ['power', 'min', 'maj', 'sus2', 'sus4', 'min7', 'maj7', 'dom7', 'dim', 'aug', 'dom9', 'min9'];

// ── Ambient bed — single notes arpeggiated slowly, not strummed ─────────────
const BED_NOTE_SPACING = 2400;  // ms between individual bed notes (slow)
const BED_NOTE_HOLD    = 4.0;   // seconds each note rings (long sustain)
const BED_VELOCITY     = 0.06;  // very gentle

// ── Player tone defaults — ambient, clean, spacious ─────────────────────────
// Intentionally different from the game's heavy lead defaults. The Discord
// Coach is a peaceful practice space, not a battle stage.
const DISCORD_TONE_DEFAULTS = {
  drive: 0.08, tone: 0.30, echo: 0.60, verb: 0.50, voice: 'triangle',
};

// ── Tone panel persistence ──────────────────────────────────────────────────
const TONE_LS_KEY = 'rlsw.practice.discord.tone';
function loadTone() {
  try { const t = JSON.parse(localStorage.getItem(TONE_LS_KEY)); return t && t.drive != null ? t : { ...DISCORD_TONE_DEFAULTS }; }
  catch { return { ...DISCORD_TONE_DEFAULTS }; }
}
function saveTone(t) { try { localStorage.setItem(TONE_LS_KEY, JSON.stringify(t)); } catch {} }

// ── PC helper ───────────────────────────────────────────────────────────────
const PC_DISPLAY = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];

// Cell pitch class from string/fret
function cellPc(s, f) {
  return (STRING_OPENS[s] + f) % 12;
  // STRING_OPENS are semitones above E2; mod 12 gives pitch class relative to E
  // But PC_NAMES uses C=0. Offset: E = 4 semitones above C.
}

// Actually we need absolute pitch class (0=C). STRING_OPENS[0]=0 = E2.
// E = pc 4. So cellPc = (STRING_OPENS[s] + f + 4) % 12  (since STRING_OPENS[0]=0 maps to E=4)
function cellPcAbsolute(s, f) {
  return (STRING_OPENS[s] + f + 4) % 12; // +4 because STRING_OPENS[0] = E2, E = pc 4 in C-based system
}

// Root name → pc (C-based, 0=C)
function rootNameToPc(name) {
  const idx = PC_NAMES.indexOf(name);
  return idx >= 0 ? idx : 9; // default A
}

// ── Component ───────────────────────────────────────────────────────────────
export function DiscordCoach({ onBack }) {
  const [rootName, setRootName]   = useState('A');
  const [mode, setMode]           = useState('minor');
  const [rungId, setRungId]       = useState('power');
  const [phase, setPhase]         = useState('setup'); // setup | playing | complete
  const [tone, setTone]           = useState(loadTone);  // player's amp knobs
  const [coachMsg, setCoachMsg]   = useState('');
  const [depthCount, setDepthCount] = useState(0);
  const [noiseCount, setNoiseCount] = useState(0);
  const [offAttempts, setOffAttempts] = useState(0);
  const [spiceVariety, setSpiceVariety] = useState(new Set());
  const [flash, setFlash]         = useState(null);
  const [toneOpen, setToneOpen]   = useState(false);    // tone panel visibility

  const toneRef = useRef(tone);
  const historyRef = useRef([]); // { pc, time, classified? }
  const bedTimerRef = useRef(null);
  const chordCtxRef = useRef(null);
  const rootPcRef = useRef(rootNameToPc('A'));
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  toneRef.current = tone;

  // ── Tone knob helpers ───────────────────────────────────────────────────
  function updateTone(updater) {
    setTone(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      toneRef.current = next;
      saveTone(next);
      return next;
    });
  }
  function cycleVoice() {
    const cur = tone.voice ?? 'saw';
    const i = TONE_VOICE_ORDER.indexOf(cur);
    const next = TONE_VOICE_ORDER[(i + 1) % TONE_VOICE_ORDER.length];
    updateTone(k => ({ ...k, voice: next }));
    // Audition
    const ctx = getRiffAudio(); if (ctx) playAmpNote(ctx, 110, { holdTime: 0.3, fadeTime: 0.4, volume: 0.16, knobs: { ...toneRef.current, voice: next } });
  }
  function auditTone() {
    const ctx = getRiffAudio(); if (ctx) playAmpNote(ctx, 110, { holdTime: 0.3, fadeTime: 0.4, volume: 0.16, knobs: { ...toneRef.current } });
  }

  // ── Compute chord context ───────────────────────────────────────────────
  function computeCtx() {
    const rpc = rootNameToPc(rootName);
    rootPcRef.current = rpc;
    const ctx = spiceSetFor(rpc, rungId, mode);
    chordCtxRef.current = ctx;
    return ctx;
  }

  // ── Ambient chord bed — single notes arpeggiated, gentle and slow ────────
  function startBed() {
    const audioCtx = getRiffAudio(); if (!audioCtx) return;
    const rpc = rootPcRef.current;
    const tpl = CHORD_TEMPLATES.find(t => t.id === rungId) || CHORD_TEMPLATES[CHORD_TEMPLATES.length - 1];
    const rootFreq = 110 * Math.pow(2, (rpc - 9) / 12);
    // Build the arpeggio sequence: chord tones voiced low, root doubled an octave below
    const arpFreqs = [rootFreq / 2, ...tpl.ivals.map(iv => rootFreq * Math.pow(2, iv / 12))];
    let noteIdx = 0;

    function playNextBedNote() {
      if (phaseRef.current !== 'playing') return;
      const freq = arpFreqs[noteIdx % arpFreqs.length];
      playAmpNote(audioCtx, freq, {
        holdTime: BED_NOTE_HOLD, fadeTime: 2.5, volume: BED_VELOCITY,
        attackTime: 1.2, // slow swell — pad, not pick
        knobs: { voice: 'sine', drive: 0, tone: 0.18, echo: 0, verb: 0.6 },
      });
      noteIdx++;
    }

    playNextBedNote();
    bedTimerRef.current = setInterval(playNextBedNote, BED_NOTE_SPACING);
  }

  function stopBed() {
    if (bedTimerRef.current) { clearInterval(bedTimerRef.current); bedTimerRef.current = null; }
  }

  // ── Start session ─────────────────────────────────────────────────────────
  function startSession() {
    computeCtx();
    historyRef.current = [];
    setDepthCount(0);
    setNoiseCount(0);
    setOffAttempts(0);
    setSpiceVariety(new Set());
    setCoachMsg('Play over the chord. Spice notes pulse — resolve them by step onto a chord tone.');
    setPhase('playing');
    setTimeout(() => startBed(), 100);
  }

  // ── End session ─────────────────────────────────────────────────────────
  function endSession() {
    stopBed();
    setPhase('complete');
  }

  // Cleanup on unmount
  useEffect(() => () => stopBed(), []);

  // ── ESC to exit ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { stopBed(); onBack(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  // ── Handle cell tap ─────────────────────────────────────────────────────
  function handleTap(s, f) {
    if (phaseRef.current !== 'playing' || !chordCtxRef.current) return;
    const pc = cellPcAbsolute(s, f);
    const now = performance.now();
    const hist = historyRef.current;
    hist.push({ pc, time: now });

    // Classify
    const result = classifyNote(hist, pc, chordCtxRef.current);

    // Handle resolved off-notes
    for (const r of result.resolved) {
      hist[r.idx].classified = 'DEPTH';
      setDepthCount(c => c + 1);
      const line = coachLine('DEPTH', hist[r.idx].pc, pc, chordCtxRef.current);
      setCoachMsg(line);
      setFlash({ cellId: `${s},${f}`, grade: 'perfect' });
    }

    // Track spice variety
    if (chordCtxRef.current.spice.has(pc)) {
      setSpiceVariety(prev => new Set([...prev, pc]));
    }

    // Track off-note attempts
    if (result.current === 'SPICE-OPEN' || result.current === 'RAW-OPEN') {
      setOffAttempts(c => c + 1);
    }

    // Expire old open notes as NOISE
    const expired = expireOpenNotes(hist, chordCtxRef.current, now);
    for (const idx of expired) {
      if (!hist[idx].classified) {
        hist[idx].classified = 'NOISE';
        setNoiseCount(c => c + 1);
        const line = coachLine('NOISE', hist[idx].pc, pc, chordCtxRef.current);
        setCoachMsg(line);
      }
    }

    // Visual feedback based on classification
    if (result.current === 'SAFE') {
      setFlash({ cellId: `${s},${f}`, grade: 'good' });
    } else if (result.current === 'COLOR') {
      setFlash({ cellId: `${s},${f}`, grade: 'ok' });
    }

    // Keep history manageable
    if (hist.length > 20) hist.splice(0, hist.length - 20);
  }

  // ── Free audition — plays through the player's tone knobs ──────────────
  function playNote(freq) {
    const ctx = getRiffAudio(); if (!ctx) return;
    playAmpNote(ctx, freq, { holdTime: 1.8, fadeTime: 0.8, volume: 0.25, knobs: { ...toneRef.current } });
  }

  // ── Build fretboard layers ────────────────────────────────────────────
  const layers = {};
  if (phase === 'playing' || phase === 'setup') {
    const ctx = phase === 'playing' ? chordCtxRef.current : spiceSetFor(rootNameToPc(rootName), rungId, mode);
    if (ctx) {
      for (let s = 0; s < 6; s++) {
        for (let f = 0; f <= MAX_FRET; f++) {
          const pc = cellPcAbsolute(s, f);
          const id = `${s},${f}`;
          if (ctx.chord.has(pc))      layers[id] = { color: ACCENT, style: 'solid' };
          else if (ctx.color.has(pc)) layers[id] = { color: NEON_VIOLET, style: 'dim' };
          else if (ctx.spice.has(pc)) layers[id] = { color: NEON_MAGENTA, style: 'pulse' };
        }
      }
    }
  }

  const tpl = CHORD_TEMPLATES.find(t => t.id === rungId);
  const chordName = `${rootName} ${tpl?.label ?? rungId}`;
  const resRate = offAttempts > 0 ? Math.round((depthCount / offAttempts) * 100) : 0;

  // ── Setup screen ──────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div style={S.root}>
        <div style={{ maxWidth: 500, width: '100%', padding: 24 }}>
          <div style={S.title}>🎩 DISCORD COACH</div>
          <div style={{ fontSize: 10, color: '#4a6a8a', marginBottom: 24, textAlign: 'center' }}>
            Learn which off-notes add depth — and how to resolve them
          </div>

          {/* Root selector */}
          <div style={S.row}>
            <span style={S.rowLabel}>ROOT</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {PC_NAMES.map(n => (
                <button key={n} onClick={() => setRootName(n)}
                  style={segBtn(rootName === n)}>{n}</button>
              ))}
            </div>
          </div>

          {/* Mode selector */}
          <div style={S.row}>
            <span style={S.rowLabel}>MODE</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setMode('minor')} style={segBtn(mode === 'minor')}>MINOR</button>
              <button onClick={() => setMode('major')} style={segBtn(mode === 'major')}>MAJOR</button>
            </div>
          </div>

          {/* Chord rung */}
          <div style={S.row}>
            <span style={S.rowLabel}>CHORD</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {RUNG_ORDER.map(id => {
                const t = CHORD_TEMPLATES.find(t => t.id === id);
                return <button key={id} onClick={() => setRungId(id)}
                  style={segBtn(rungId === id)}>{t?.label ?? id}</button>;
              })}
            </div>
          </div>

          {/* Preview neck */}
          <div style={{ marginTop: 16 }}>
            <FretboardFull layers={layers} showLabels playNote={playNote} />
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: 9, color: '#5a7a9a' }}>
            <span><span style={{ color: ACCENT }}>●</span> Chord</span>
            <span><span style={{ color: NEON_VIOLET }}>●</span> Color</span>
            <span><span style={{ color: NEON_MAGENTA }}>●</span> Spice</span>
          </div>

          {/* Tone panel */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'flex-end', marginTop: 20 }}>
            {(() => {
              const V = TONE_VOICES[tone.voice ?? 'saw'] ?? TONE_VOICES.saw;
              return <button onClick={cycleVoice} title="VOICE — wave character"
                style={{ fontFamily: "'Saira Stencil One',sans-serif", cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 46, borderRadius: 6, flexShrink: 0,
                  background: 'linear-gradient(135deg,#1c1230,#0e0a1e)', border: '2px solid #aa66ff',
                  boxShadow: '0 0 8px #aa66ff44, inset 0 0 4px #aa66ff22' }}>
                <span style={{ fontSize: 5, letterSpacing: 1, color: '#b98aff', fontWeight: 700 }}>VOICE</span>
                <span style={{ fontSize: 8, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginTop: 1, textShadow: '0 0 6px #aa66ff' }}>{V.label}</span>
              </button>;
            })()}
            <ToneFader label="GAIN" color="#ff6644" value={tone.drive} defaultValue={TONE_KNOB_DEFAULTS.drive}
              onChange={v => updateTone(k => ({ ...k, drive: v }))} onCommit={auditTone} title="GAIN — distortion" />
            <ToneFader label="TONE" color="#ffcc44" value={tone.tone} defaultValue={TONE_KNOB_DEFAULTS.tone}
              onChange={v => updateTone(k => ({ ...k, tone: v }))} onCommit={auditTone} title="TONE — brightness" />
            <ToneFader label="ECHO" color="#44ddff" value={tone.echo} defaultValue={TONE_KNOB_DEFAULTS.echo}
              onChange={v => updateTone(k => ({ ...k, echo: v }))} onCommit={auditTone} title="ECHO — slapback" />
            <ToneFader label="VERB" color="#aa88ff" value={tone.verb} defaultValue={TONE_KNOB_DEFAULTS.verb}
              onChange={v => updateTone(k => ({ ...k, verb: v }))} onCommit={auditTone} title="VERB — reverb" />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
            <button onClick={startSession} style={S.goBtn}>START SESSION</button>
          </div>

          <button onClick={onBack} style={{ ...S.lobbyBtn, marginTop: 16, alignSelf: 'center', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}>← LOBBY</button>
        </div>
      </div>
    );
  }

  // ── Complete screen ───────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div style={S.root}>
        <div style={{ maxWidth: 420, textAlign: 'center', padding: 32 }}>
          <div style={S.title}>SET COMPLETE</div>
          <div style={{ fontSize: 14, color: '#6a8aaa', marginBottom: 20 }}>{chordName}</div>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 28, color: NEON_GREEN, fontWeight: 700 }}>{depthCount}</div>
              <div style={{ fontSize: 9, color: '#4a6a8a' }}>DEPTHS</div>
            </div>
            <div>
              <div style={{ fontSize: 28, color: '#f6ad55', fontWeight: 700 }}>{resRate}%</div>
              <div style={{ fontSize: 9, color: '#4a6a8a' }}>RESOLUTION RATE</div>
            </div>
            <div>
              <div style={{ fontSize: 28, color: NEON_MAGENTA, fontWeight: 700 }}>{spiceVariety.size}</div>
              <div style={{ fontSize: 9, color: '#4a6a8a' }}>SPICE VARIETY</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => { setPhase('setup'); }} style={S.goBtn}>NEW SESSION</button>
            <button onClick={onBack} style={S.lobbyBtn}>← LOBBY</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing screen ────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {/* HUD */}
      <div style={S.hud}>
        <div>
          <div style={S.hudLabel}>DISCORD COACH</div>
          <div style={{ fontSize: 14, color: ACCENT, letterSpacing: 1 }}>{chordName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: NEON_GREEN }}>⚡ {depthCount} DEPTH{depthCount !== 1 ? 'S' : ''}</div>
          <div style={{ fontSize: 10, color: '#5a7a9a' }}>{resRate}% resolution</div>
        </div>
      </div>

      {/* Coach message */}
      <div style={S.coachArea}>
        <div style={S.coachMsg}>{coachMsg}</div>
      </div>

      {/* Fretboard */}
      <div style={S.neckWrap}>
        <FretboardFull
          onTapCell={handleTap}
          layers={layers}
          showLabels
          flash={flash}
          accent={ACCENT}
          playNote={playNote}
        />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 9, color: '#5a7a9a', marginBottom: 8 }}>
        <span><span style={{ color: ACCENT }}>●</span> Chord (safe)</span>
        <span><span style={{ color: NEON_VIOLET }}>●</span> Color (safe)</span>
        <span><span style={{ color: NEON_MAGENTA }}>●</span> Spice (resolve by step!)</span>
      </div>

      {/* Tone panel (floating, toggled) */}
      {toneOpen && (
        <div style={{ position: 'absolute', left: 24, bottom: 52, zIndex: 15,
          display: 'flex', alignItems: 'flex-end', gap: 5,
          background: 'linear-gradient(180deg,#161d30ee,#0a0e1cee)', border: '1px solid #aa66ff55',
          borderRadius: 6, padding: '6px 7px 4px 7px', boxShadow: '0 4px 16px #000000aa, 0 0 12px #aa66ff22',
          backdropFilter: 'blur(6px)' }}>
          {(() => {
            const V = TONE_VOICES[tone.voice ?? 'saw'] ?? TONE_VOICES.saw;
            return <button onClick={cycleVoice} title="VOICE — wave character"
              style={{ fontFamily: "'Saira Stencil One',sans-serif", cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 46, borderRadius: 6, flexShrink: 0,
                background: 'linear-gradient(135deg,#1c1230,#0e0a1e)', border: '2px solid #aa66ff',
                boxShadow: '0 0 8px #aa66ff44, inset 0 0 4px #aa66ff22' }}>
              <span style={{ fontSize: 5, letterSpacing: 1, color: '#b98aff', fontWeight: 700 }}>VOICE</span>
              <span style={{ fontSize: 8, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginTop: 1, textShadow: '0 0 6px #aa66ff' }}>{V.label}</span>
            </button>;
          })()}
          <ToneFader label="GAIN" color="#ff6644" value={tone.drive} defaultValue={TONE_KNOB_DEFAULTS.drive}
            onChange={v => updateTone(k => ({ ...k, drive: v }))} onCommit={auditTone} title="GAIN — distortion" />
          <ToneFader label="TONE" color="#ffcc44" value={tone.tone} defaultValue={TONE_KNOB_DEFAULTS.tone}
            onChange={v => updateTone(k => ({ ...k, tone: v }))} onCommit={auditTone} title="TONE — brightness" />
          <ToneFader label="ECHO" color="#44ddff" value={tone.echo} defaultValue={TONE_KNOB_DEFAULTS.echo}
            onChange={v => updateTone(k => ({ ...k, echo: v }))} onCommit={auditTone} title="ECHO — slapback" />
          <ToneFader label="VERB" color="#aa88ff" value={tone.verb} defaultValue={TONE_KNOB_DEFAULTS.verb}
            onChange={v => updateTone(k => ({ ...k, verb: v }))} onCommit={auditTone} title="VERB — reverb" />
        </div>
      )}

      {/* Bottom bar */}
      <div style={S.bottomBar}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setToneOpen(o => !o)} title="Tone panel — shape your sound"
            style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 10, letterSpacing: 1,
              cursor: 'pointer', padding: '6px 12px', borderRadius: 6,
              background: toneOpen ? '#1c1230' : '#080f1e',
              border: `1px solid ${toneOpen ? '#aa66ff' : '#1a2a40'}`,
              color: toneOpen ? '#aa66ff' : '#3a5a7a', transition: 'all .2s' }}>
            🎛️ AMP
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={endSession} style={{ ...S.goBtn, fontSize: 9, padding: '6px 14px' }}>END SET</button>
          <button onClick={() => { stopBed(); onBack(); }} style={S.lobbyBtn}>← LOBBY</button>
        </div>
      </div>
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────
function segBtn(active) {
  return {
    fontFamily: "'Saira Stencil One', sans-serif",
    fontSize: 9, letterSpacing: 1, cursor: 'pointer',
    padding: '5px 8px', borderRadius: 4,
    background: active ? ACCENT + '22' : '#0a1020',
    border: `1px solid ${active ? ACCENT : '#1a2a40'}`,
    color: active ? ACCENT : '#5a7a9a',
    transition: 'all .15s',
  };
}

const S = {
  root: {
    position: 'fixed', inset: 0, background: '#050a14',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Saira Stencil One', sans-serif", color: '#e0f0ff', zIndex: 100,
  },
  title: {
    fontSize: 18, letterSpacing: 3, color: ACCENT, textAlign: 'center', marginBottom: 8,
    textShadow: `0 0 16px ${ACCENT}44`,
  },
  row: { marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  rowLabel: { fontSize: 10, color: '#4a6a8a', letterSpacing: 2, minWidth: 50 },
  hud: {
    position: 'absolute', top: 16, left: 24, right: 24, zIndex: 10,
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  hudLabel: { fontSize: 11, letterSpacing: 2, color: '#3a5a7a', marginBottom: 4 },
  coachArea: { marginTop: 64, minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' },
  coachMsg: {
    fontSize: 11, color: '#8aaabb', fontStyle: 'italic', textAlign: 'center',
    maxWidth: 500, lineHeight: 1.5,
  },
  neckWrap: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', maxWidth: 680, padding: '0 16px',
  },
  bottomBar: {
    position: 'absolute', bottom: 16, left: 24, right: 24, zIndex: 10,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  goBtn: {
    fontFamily: "'Saira Stencil One', sans-serif",
    fontSize: 11, letterSpacing: 2, cursor: 'pointer',
    padding: '10px 24px', borderRadius: 6,
    background: '#1a3020', border: '1.5px solid #44cc66', color: '#44ff88',
    boxShadow: '0 0 16px #44cc6633',
  },
  lobbyBtn: {
    fontFamily: "'Saira Stencil One', sans-serif",
    fontSize: 10, letterSpacing: 1, cursor: 'pointer',
    padding: '8px 16px', borderRadius: 6,
    background: '#1a1020', border: '1px solid #4a3060', color: '#c080ff',
  },
};
