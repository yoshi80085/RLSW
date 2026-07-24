// =============================================================================
// ui/LegendLessons.jsx — 🎸 LEGEND LESSONS — sound like the greats
// -----------------------------------------------------------------------------
// Third practice pillar: guided lessons that teach you to channel a famous
// guitarist's tone, palette, and signature moves. Three phases per lesson:
//   RIG   — match the legend's amp tone by ear
//   ECHO  — replay 2–3 signature licks (pitch-class sequence, free time)
//   STEAL — free play graded on STYLE FIT (palette + moves + phrasing)
//
// Reuses FretboardFull, the Discord Coach bed pattern, and the tone panel.
// No new synth code — everything through playAmpNote.
// =============================================================================
import React, { useState, useRef, useEffect, useCallback } from "react";
import { STRING_OPENS, MAX_FRET, cellKey } from "../riff/guitarMap.js";
import { CHORD_TEMPLATES, PC_NAMES } from "../music/chords.js";
import { spiceSetFor } from "../music/spice.js";
import { LEGENDS, LEGEND_BY_ID, paletteFit, detectMoves, styleMeter, toneMatch, lickMatch } from "../music/styles.js";
import { TONE_KNOB_DEFAULTS, TONE_VOICE_ORDER, TONE_VOICES, playAmpNote } from "../audio/ampVoice.js";
import { getRiffAudio } from "../audio/riffSfx.js";
import { FretboardFull } from "./FretboardFull.jsx";
import { ToneFader } from "./ToneFader.jsx";

// ── Neon palette ────────────────────────────────────────────────────────────
const ACCENT       = '#f6ad55';   // warm gold — legend-specific
const NEON_GREEN   = '#44ff88';
const NEON_CYAN    = '#19e6ff';
const NEON_MAGENTA = '#ff2d95';
const NEON_VIOLET  = '#8a5cff';

// ── Bed scheduling ──────────────────────────────────────────────────────────
const BED_NOTE_HOLD = 4.0;
const BED_VELOCITY  = 0.06;

// ── Player tone defaults — clean and spacious for learning ──────────────────
// Intentionally gentle so the player hears notes clearly, not crunch. The
// LEGEND'S tone is crunchy; the player starts clean and chases it in RIG phase.
const LEGEND_TONE_DEFAULTS = {
  drive: 0.10, tone: 0.35, echo: 0.45, verb: 0.40, voice: 'triangle',
};

// ── Tone persistence ────────────────────────────────────────────────────────
const TONE_LS_KEY = 'rlsw.practice.legend.tone';
function loadTone() {
  try { const t = JSON.parse(localStorage.getItem(TONE_LS_KEY)); return t && t.drive != null ? t : { ...LEGEND_TONE_DEFAULTS }; }
  catch { return { ...LEGEND_TONE_DEFAULTS }; }
}
function saveTone(t) { try { localStorage.setItem(TONE_LS_KEY, JSON.stringify(t)); } catch {} }

// ── Medal persistence ───────────────────────────────────────────────────────
function loadMedals() {
  try { const m = JSON.parse(localStorage.getItem('rlsw.practice.legends')); return m && typeof m === 'object' ? m : {}; } catch { return {}; }
}
function saveMedals(m) { try { localStorage.setItem('rlsw.practice.legends', JSON.stringify(m)); } catch {} }
function loadPlayed() {
  try { const p = JSON.parse(localStorage.getItem('rlsw.practice.legends.played')); return Array.isArray(p) ? new Set(p) : new Set(); } catch { return new Set(); }
}
function markPlayed(id) {
  try { const p = loadPlayed(); p.add(id); localStorage.setItem('rlsw.practice.legends.played', JSON.stringify([...p])); } catch {}
}

// ── PC helpers ──────────────────────────────────────────────────────────────
const PC_DISPLAY = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
function cellPcAbsolute(s, f) { return (STRING_OPENS[s] + f + 4) % 12; }

// ── Seg button style (matches Discord Coach) ───────────────────────────────
const segBtn = (on, ac = ACCENT) => ({
  fontFamily: "'Saira Stencil One',sans-serif", cursor: 'pointer', borderRadius: 4,
  padding: '6px 12px', fontSize: 9, letterSpacing: 1, transition: 'all .15s',
  border: '1px solid', background: on ? ac + '22' : '#0a1020',
  borderColor: on ? ac : '#1e3a5f', color: on ? ac : '#5a7a9a',
});

// ── Shared styles ───────────────────────────────────────────────────────────
const S = {
  root: { minHeight: '100vh', background: '#050810', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', fontFamily: "'Share Tech Mono','Courier New',monospace",
    overflow: 'hidden', position: 'relative', padding: 16 },
  title: { fontFamily: "'Saira Stencil One',sans-serif", fontSize: 22, color: ACCENT,
    letterSpacing: 4, fontWeight: 700, textAlign: 'center', marginBottom: 8,
    textShadow: `0 0 18px ${ACCENT}66` },
  goBtn: { fontFamily: "'Saira Stencil One',sans-serif", fontSize: 12, letterSpacing: 2,
    cursor: 'pointer', padding: '10px 24px', borderRadius: 6, background: '#1a3020',
    border: '2px solid #44cc66', color: '#44ff88', boxShadow: '0 0 14px #44cc6633',
    transition: 'all .2s' },
  lobbyBtn: { fontFamily: "'Saira Stencil One',sans-serif", fontSize: 9, letterSpacing: 1,
    cursor: 'pointer', padding: '6px 14px', borderRadius: 4, background: '#0a1020',
    border: '1px solid #2a4a6a', color: '#5a8aaa', transition: 'all .15s' },
  skipBtn: { fontFamily: "'Saira Stencil One',sans-serif", fontSize: 8, letterSpacing: 1,
    cursor: 'pointer', padding: '4px 10px', borderRadius: 4, background: '#0a1020',
    border: '1px solid #3a3a5a', color: '#6a6a8a', transition: 'all .15s' },
  hud: { width: '100%', maxWidth: 640, display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', padding: '8px 0', marginBottom: 4 },
  hudLabel: { fontFamily: "'Saira Stencil One',sans-serif", fontSize: 9, color: '#3a5a7a',
    letterSpacing: 2 },
  coachArea: { width: '100%', maxWidth: 640, minHeight: 32, display: 'flex',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  coachMsg: { fontSize: 11, color: '#9ab0cc', fontStyle: 'italic', textAlign: 'center',
    transition: 'opacity .3s', lineHeight: 1.4 },
  neckWrap: { width: '100%', maxWidth: 640, marginBottom: 8 },
  meter: { width: '100%', maxWidth: 400, height: 14, borderRadius: 7, background: '#0a1020',
    border: '1px solid #1e3a5f', overflow: 'hidden', position: 'relative' },
  meterFill: (pct, color) => ({ width: `${Math.min(100, pct)}%`, height: '100%',
    background: `linear-gradient(90deg, ${color}44, ${color})`, borderRadius: 7,
    transition: 'width 0.5s ease-out', boxShadow: `0 0 8px ${color}66` }),
  bottomBar: { width: '100%', maxWidth: 640, display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', paddingTop: 8 },
};

// ── Component ───────────────────────────────────────────────────────────────
export function LegendLessons({ onBack }) {
  const [selectedId, setSelectedId] = useState(null);
  const [phase, setPhase] = useState('picker'); // picker | rig | echo | steal | card
  const [tone, setTone] = useState(loadTone);
  const [coachMsg, setCoachMsg] = useState('');
  const [flash, setFlash] = useState(null);
  const [toneOpen, setToneOpen] = useState(false);
  const [medals] = useState(loadMedals);
  const [played] = useState(loadPlayed);

  // RIG phase
  const [rigAttempts, setRigAttempts] = useState(0);
  const [rigPassed, setRigPassed] = useState(false);

  // ECHO phase
  const [currentLick, setCurrentLick] = useState(0);
  const [licksCleared, setLicksCleared] = useState(0);
  const [lickHistory, setLickHistory] = useState([]);

  // STEAL phase
  const [meter, setMeter] = useState(0);
  const [moveLog, setMoveLog] = useState({});
  const [stealTime, setStealTime] = useState(0);

  const toneRef = useRef(tone);
  const historyRef = useRef([]);
  const bedTimerRef = useRef(null);
  const phaseRef = useRef(phase);
  const meterTimerRef = useRef(null);
  phaseRef.current = phase;
  toneRef.current = tone;

  const legend = selectedId ? LEGEND_BY_ID[selectedId] : null;
  const rootPc = legend ? legend.bed.rootPc : 0;
  const palette = legend ? legend.palette(rootPc) : new Set();

  // ── Tone helpers ──────────────────────────────────────────────────────
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
    const ctx = getRiffAudio(); if (ctx) playAmpNote(ctx, 110, { holdTime: 0.25, fadeTime: 0.2, volume: 0.16, knobs: { ...toneRef.current, voice: next } });
  }
  function auditTone() {
    const ctx = getRiffAudio(); if (ctx) playAmpNote(ctx, 110, { holdTime: 0.25, fadeTime: 0.2, volume: 0.16, knobs: { ...toneRef.current } });
  }

  // ── Bed scheduling (same pattern as DiscordCoach) ─────────────────────
  function startBed() {
    if (!legend) return;
    const audioCtx = getRiffAudio(); if (!audioCtx) return;
    const { bed } = legend;
    const tpl = CHORD_TEMPLATES.find(t => t.id === bed.chordId) || CHORD_TEMPLATES[CHORD_TEMPLATES.length - 1];
    const rootFreq = 110 * Math.pow(2, (bed.rootPc - 9) / 12);
    const arpFreqs = [rootFreq / 2, ...tpl.ivals.map(iv => rootFreq * Math.pow(2, iv / 12))];
    let noteIdx = 0;
    function playNext() {
      if (!['echo', 'steal', 'rig'].includes(phaseRef.current)) return;
      const freq = arpFreqs[noteIdx % arpFreqs.length];
      playAmpNote(audioCtx, freq, {
        holdTime: BED_NOTE_HOLD, fadeTime: 2.5, volume: BED_VELOCITY,
        attackTime: 1.2, knobs: { voice: 'sine', drive: 0, tone: 0.18, echo: 0, verb: 0.6 },
      });
      noteIdx++;
    }
    playNext();
    bedTimerRef.current = setInterval(playNext, bed.spacingMs);
  }
  function stopBed() { if (bedTimerRef.current) { clearInterval(bedTimerRef.current); bedTimerRef.current = null; } }

  // ── Reference lick playback (scheduled notes, slow — show-me pace) ────
  function playLick(lickPcs) {
    if (!legend) return;
    const audioCtx = getRiffAudio(); if (!audioCtx) return;
    const rootFreq = 110 * Math.pow(2, (rootPc - 9) / 12);
    const delay = 0.5; // 500ms per note
    lickPcs.forEach((iv, i) => {
      const freq = rootFreq * Math.pow(2, iv / 12);
      setTimeout(() => {
        playAmpNote(audioCtx, freq, { holdTime: 0.38, fadeTime: 0.25, volume: 0.22, knobs: { ...legend.tone } });
      }, i * delay * 1000);
    });
  }

  // ── Unlock logic ──────────────────────────────────────────────────────
  function isUnlocked(idx) {
    if (idx === 0) return true;
    const prevId = LEGENDS[idx - 1]?.id;
    return prevId && played.has(prevId);
  }

  // ── Phase transitions ─────────────────────────────────────────────────
  function enterRig(leg) {
    setSelectedId(leg.id);
    setPhase('rig');
    setRigAttempts(0);
    setRigPassed(false);
    setCoachMsg('Tone shapes everything. Listen to the legend\'s reference, then dial your knobs to match what you hear — not what you see.');
    setTimeout(() => startBed(), 200);
  }

  function enterEcho() {
    setPhase('echo');
    setCurrentLick(0);
    setLicksCleared(0);
    setLickHistory([]);
    historyRef.current = [];
    setCoachMsg('Listen to the lick, then replay the notes in order. No rush — this is about the note choices, not speed.');
    if (legend) playLick(legend.licks[0]);
  }

  function enterSteal() {
    setPhase('steal');
    historyRef.current = [];
    setMeter(0);
    setMoveLog({});
    setStealTime(0);
    setCoachMsg('Free play over the bed. Lit notes are the palette — pulsing notes are the star spice. Read the hints below for how to land moves.');
    // Start style meter polling
    meterTimerRef.current = setInterval(() => {
      if (phaseRef.current !== 'steal') return;
      const hist = historyRef.current;
      if (hist.length >= 3 && legend) {
        const m = styleMeter(legend, hist, rootPc);
        setMeter(m);
      }
      setStealTime(t => t + 1);
    }, 1000);
  }

  function enterCard() {
    stopBed();
    if (meterTimerRef.current) { clearInterval(meterTimerRef.current); meterTimerRef.current = null; }
    setPhase('card');
    if (legend) {
      markPlayed(legend.id);
      if (meter >= 70) {
        const m = loadMedals();
        m[legend.id] = Math.max(m[legend.id] || 0, meter);
        saveMedals(m);
      }
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────
  useEffect(() => () => {
    stopBed();
    if (meterTimerRef.current) clearInterval(meterTimerRef.current);
  }, []);

  // ESC exits
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { stopBed(); if (meterTimerRef.current) clearInterval(meterTimerRef.current); onBack(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  // ── RIG: check tone match ────────────────────────────────────────────
  function checkRig() {
    if (!legend) return;
    setRigAttempts(a => a + 1);
    if (toneMatch(tone, legend.tone)) {
      setRigPassed(true);
      setCoachMsg('Tone matched! You found the sound. Training your ear to recognize gain, brightness, and space is a skill that transfers to every rig you\'ll ever touch.');
      setTimeout(enterEcho, 1800);
    } else {
      const hints = [];
      if (Math.abs(tone.drive - legend.tone.drive) > 0.12) hints.push(tone.drive > legend.tone.drive ? 'Less gain' : 'More gain');
      if (Math.abs(tone.tone - legend.tone.tone) > 0.12) hints.push(tone.tone > legend.tone.tone ? 'Darker' : 'Brighter');
      if (tone.voice !== legend.tone.voice) hints.push('Try a different voice');
      const hintStr = hints.length ? ` Hint: ${hints.join(', ').toLowerCase()}.` : '';
      setCoachMsg(rigAttempts >= 1
        ? `Getting closer.${hintStr} Or skip to move on — tone matching is a bonus, not a gate.`
        : `Not quite — listen again and adjust.${hintStr} Chase the sound, not numbers.`);
    }
  }
  function skipRig() {
    // Apply the legend's tone preset
    updateTone({ ...legend.tone });
    setRigPassed(true);
    setCoachMsg('Tone preset applied. Moving on...');
    setTimeout(enterEcho, 800);
  }

  // ── ECHO: handle cell tap ─────────────────────────────────────────────
  function handleEchoTap(s, f) {
    if (!legend || phase !== 'echo') return;
    const pc = cellPcAbsolute(s, f);
    const newHist = [...lickHistory, { pc, time: performance.now() }];
    setLickHistory(newHist);

    // Check if current lick is matched
    const lick = legend.licks[currentLick];
    if (lick && lickMatch(lick, newHist, rootPc)) {
      const cleared = licksCleared + 1;
      setLicksCleared(cleared);
      setFlash({ cellId: `${s},${f}`, grade: 'perfect' });
      if (cleared >= 2 || currentLick >= legend.licks.length - 1) {
        // Phase clear
        setCoachMsg('Those licks are the vocabulary. Now use them freely — improvise over the bed and the meter will track your style fit.');
        setTimeout(enterSteal, 1500);
      } else {
        const next = currentLick + 1;
        setCurrentLick(next);
        setLickHistory([]);
        setCoachMsg('Nailed it. Next lick — listen to what\'s different about this one.');
        setTimeout(() => { if (legend.licks[next]) playLick(legend.licks[next]); }, 600);
      }
    }
  }

  // ── STEAL: handle cell tap ────────────────────────────────────────────
  function handleStealTap(s, f) {
    if (!legend || phase !== 'steal') return;
    const pc = cellPcAbsolute(s, f);
    const now = performance.now();
    historyRef.current.push({ pc, time: now });
    const hist = historyRef.current;

    // Detect moves and fire coach lines
    const counts = detectMoves(legend.moves, hist, rootPc, palette);
    for (const m of legend.moves) {
      const prev = moveLog[m.id] || 0;
      if (counts[m.id] > prev) {
        setMoveLog(l => ({ ...l, [m.id]: counts[m.id] }));
        const lines = legend.coachLines.onMove[m.id];
        if (lines) setCoachMsg(lines[Math.floor(Math.random() * lines.length)]);
        setFlash({ cellId: `${s},${f}`, grade: 'perfect' });
      }
    }

    // Palette feedback
    if (palette.has(pc)) {
      if (!flash) setFlash({ cellId: `${s},${f}`, grade: 'good' });
    }

    // Star spice bonus
    if (pc === (rootPc + legend.starSpice) % 12) {
      setFlash({ cellId: `${s},${f}`, grade: 'perfect' });
    }

    // Keep manageable
    if (hist.length > 50) hist.splice(0, hist.length - 50);
  }

  // ── Play note through player's rig ────────────────────────────────────
  function playNote(freq) {
    const ctx = getRiffAudio(); if (!ctx) return;
    playAmpNote(ctx, freq, { holdTime: 0.45, fadeTime: 0.35, volume: 0.25, knobs: { ...toneRef.current } });
  }

  // ── Build fretboard layers ────────────────────────────────────────────
  const layers = {};
  if (legend && ['rig', 'echo', 'steal'].includes(phase)) {
    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= MAX_FRET; f++) {
        const pc = cellPcAbsolute(s, f);
        const id = `${s},${f}`;
        if (palette.has(pc)) {
          const isStar = pc === (rootPc + legend.starSpice) % 12;
          layers[id] = { color: isStar ? NEON_MAGENTA : NEON_CYAN, style: isStar ? 'pulse' : 'solid' };
        }
      }
    }
  }

  // ── PICKER ────────────────────────────────────────────────────────────
  if (phase === 'picker') {
    return (
      <div style={S.root}>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Saira+Stencil+One&family=Saira:wght@400;600;700&display=swap" rel="stylesheet"/>
        <div style={{ maxWidth: 560, width: '100%', padding: 24 }}>
          <div style={S.title}>🎸 LEGEND LESSONS</div>
          <div style={{ fontSize: 10, color: '#4a6a8a', marginBottom: 24, textAlign: 'center' }}>
            Channel the greats — learn their tone, steal their licks, master their style
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {LEGENDS.map((leg, idx) => {
              const unlocked = isUnlocked(idx);
              const medal = medals[leg.id];
              return (
                <div key={leg.id} onClick={() => unlocked && enterRig(leg)}
                  style={{
                    background: '#080f1e', border: `2px solid ${unlocked ? ACCENT + '88' : '#1a2a40'}`,
                    borderRadius: 10, padding: 18, cursor: unlocked ? 'pointer' : 'not-allowed',
                    opacity: unlocked ? 1 : 0.4, transition: 'all .2s',
                    position: 'relative', display: 'flex', gap: 16, alignItems: 'flex-start',
                  }}
                  onMouseEnter={e => { if (unlocked) { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = `0 0 20px ${ACCENT}44`; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = unlocked ? ACCENT + '88' : '#1a2a40'; e.currentTarget.style.boxShadow = 'none'; }}>
                  {/* Left: emoji + name */}
                  <div style={{ textAlign: 'center', minWidth: 64, flexShrink: 0 }}>
                    <div style={{ fontSize: 36, marginBottom: 6 }}>{unlocked ? leg.emoji : '🔒'}</div>
                    <div style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 10, color: ACCENT, letterSpacing: 1 }}>
                      {unlocked ? leg.name.toUpperCase() : '???'}
                    </div>
                    {medal && <div style={{ fontSize: 8, color: NEON_GREEN, fontFamily: "'Saira Stencil One',sans-serif", marginTop: 4 }}>🏅 {medal}%</div>}
                  </div>
                  {/* Right: description + lessons */}
                  {unlocked ? (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: '#8a9ab0', lineHeight: 1.5, marginBottom: 8 }}>
                        {leg.description || leg.tease}
                      </div>
                      {leg.lessons && (
                        <div style={{ fontSize: 9, color: '#5a7a9a', lineHeight: 1.4 }}>
                          <span style={{ color: '#4a6a8a', fontFamily: "'Saira Stencil One',sans-serif", fontSize: 7, letterSpacing: 1 }}>WHAT YOU'LL LEARN</span>
                          {leg.lessons.map((l, i) => (
                            <div key={i} style={{ marginTop: 3, paddingLeft: 8, borderLeft: `2px solid ${ACCENT}33` }}>{l}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 9, color: '#3a4a5a', lineHeight: 1.3, alignSelf: 'center' }}>
                      Play the previous legend to unlock
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={onBack} style={{ ...S.lobbyBtn, marginTop: 20, display: 'block', marginLeft: 'auto', marginRight: 'auto' }}>← LOBBY</button>
        </div>
      </div>
    );
  }

  // ── RIG PHASE ─────────────────────────────────────────────────────────
  if (phase === 'rig' && legend) {
    return (
      <div style={S.root}>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Saira+Stencil+One&family=Saira:wght@400;600;700&display=swap" rel="stylesheet"/>
        <div style={{ maxWidth: 480, width: '100%', padding: 24 }}>
          <div style={S.hud}>
            <div>
              <div style={S.hudLabel}>RIG — {legend.emoji} {legend.name.toUpperCase()}</div>
              <div style={{ fontSize: 10, color: '#5a7a9a' }}>Match the legend's tone by ear</div>
            </div>
          </div>

          {/* Tone hint */}
          {legend.rigHint && (
            <div style={{ fontSize: 10, color: '#7a8a9a', lineHeight: 1.5, marginBottom: 14,
              padding: '10px 14px', background: '#0a101e', borderRadius: 6, border: '1px solid #1a2a40' }}>
              <span style={{ color: ACCENT, fontFamily: "'Saira Stencil One',sans-serif", fontSize: 7, letterSpacing: 1 }}>LISTEN FOR</span>
              <div style={{ marginTop: 4 }}>{legend.rigHint}</div>
            </div>
          )}

          {/* Reference button */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <button onClick={() => {
              const ctx = getRiffAudio(); if (!ctx) return;
              const rootFreq = 110 * Math.pow(2, (rootPc - 9) / 12);
              playAmpNote(ctx, rootFreq, { holdTime: 0.5, fadeTime: 0.35, volume: 0.25, knobs: { ...legend.tone } });
            }} style={{ ...segBtn(true, ACCENT), fontSize: 11, padding: '8px 20px' }}>
              🔊 HEAR THE LEGEND'S TONE
            </button>
          </div>

          {/* Player tone panel */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'flex-end', marginBottom: 16 }}>
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
              onChange={v => updateTone(k => ({ ...k, drive: v }))} onCommit={auditTone} title="GAIN" />
            <ToneFader label="TONE" color="#ffcc44" value={tone.tone} defaultValue={TONE_KNOB_DEFAULTS.tone}
              onChange={v => updateTone(k => ({ ...k, tone: v }))} onCommit={auditTone} title="TONE" />
            <ToneFader label="ECHO" color="#44ddff" value={tone.echo} defaultValue={TONE_KNOB_DEFAULTS.echo}
              onChange={v => updateTone(k => ({ ...k, echo: v }))} onCommit={auditTone} title="ECHO" />
            <ToneFader label="VERB" color="#aa88ff" value={tone.verb} defaultValue={TONE_KNOB_DEFAULTS.verb}
              onChange={v => updateTone(k => ({ ...k, verb: v }))} onCommit={auditTone} title="VERB" />
          </div>

          {/* Audition + check */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
            <button onClick={auditTone} style={segBtn(false, NEON_CYAN)}>🔊 YOUR TONE</button>
            <button onClick={checkRig} style={{ ...S.goBtn, fontSize: 10, padding: '8px 18px' }}>
              {rigPassed ? '✓ MATCHED' : 'CHECK MATCH'}
            </button>
          </div>

          {rigAttempts >= 2 && !rigPassed && (
            <div style={{ textAlign: 'center' }}>
              <button onClick={skipRig} style={S.skipBtn}>SKIP — apply preset</button>
            </div>
          )}

          <div style={S.coachArea}><div style={S.coachMsg}>{coachMsg}</div></div>
          <button onClick={() => { stopBed(); setPhase('picker'); }} style={{ ...S.lobbyBtn, display: 'block', margin: '8px auto 0' }}>← LEGENDS</button>
        </div>
      </div>
    );
  }

  // ── ECHO PHASE ────────────────────────────────────────────────────────
  if (phase === 'echo' && legend) {
    return (
      <div style={S.root}>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Saira+Stencil+One&family=Saira:wght@400;600;700&display=swap" rel="stylesheet"/>
        <div style={S.hud}>
          <div>
            <div style={S.hudLabel}>ECHO — {legend.emoji} {legend.name.toUpperCase()}</div>
            <div style={{ fontSize: 10, color: '#5a7a9a' }}>Lick {currentLick + 1} of {legend.licks.length} · {licksCleared} cleared</div>
          </div>
          <button onClick={() => { if (legend.licks[currentLick]) playLick(legend.licks[currentLick]); }}
            style={segBtn(true, ACCENT)}>🔊 HEAR LICK</button>
        </div>

        {/* Lick explanation */}
        {legend.echoHints && legend.echoHints[currentLick] && (
          <div style={{ fontSize: 10, color: '#7a8a9a', lineHeight: 1.5, marginBottom: 8,
            padding: '10px 14px', background: '#0a101e', borderRadius: 6, border: '1px solid #1a2a40',
            maxWidth: 640, width: '100%' }}>
            <span style={{ color: NEON_CYAN, fontFamily: "'Saira Stencil One',sans-serif", fontSize: 7, letterSpacing: 1 }}>WHY THIS LICK</span>
            <div style={{ marginTop: 4 }}>{legend.echoHints[currentLick]}</div>
          </div>
        )}

        <div style={S.coachArea}><div style={S.coachMsg}>{coachMsg}</div></div>

        <div style={S.neckWrap}>
          <FretboardFull onTapCell={handleEchoTap} layers={layers} showLabels flash={flash} accent={ACCENT} playNote={playNote} />
        </div>

        {/* Tone panel toggle */}
        {toneOpen && (
          <div style={{ position: 'absolute', left: 24, bottom: 52, zIndex: 15,
            display: 'flex', alignItems: 'flex-end', gap: 5,
            background: 'linear-gradient(180deg,#161d30ee,#0a0e1cee)', border: '1px solid #aa66ff55',
            borderRadius: 6, padding: '6px 7px 4px 7px', boxShadow: '0 4px 16px #000000aa, 0 0 12px #aa66ff22',
            backdropFilter: 'blur(6px)' }}>
            {(() => {
              const V = TONE_VOICES[tone.voice ?? 'saw'] ?? TONE_VOICES.saw;
              return <button onClick={cycleVoice} title="VOICE"
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
              onChange={v => updateTone(k => ({ ...k, drive: v }))} onCommit={auditTone} />
            <ToneFader label="TONE" color="#ffcc44" value={tone.tone} defaultValue={TONE_KNOB_DEFAULTS.tone}
              onChange={v => updateTone(k => ({ ...k, tone: v }))} onCommit={auditTone} />
            <ToneFader label="ECHO" color="#44ddff" value={tone.echo} defaultValue={TONE_KNOB_DEFAULTS.echo}
              onChange={v => updateTone(k => ({ ...k, echo: v }))} onCommit={auditTone} />
            <ToneFader label="VERB" color="#aa88ff" value={tone.verb} defaultValue={TONE_KNOB_DEFAULTS.verb}
              onChange={v => updateTone(k => ({ ...k, verb: v }))} onCommit={auditTone} />
          </div>
        )}

        <div style={S.bottomBar}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setToneOpen(o => !o)} title="Tone panel"
              style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 10, letterSpacing: 1,
                cursor: 'pointer', padding: '6px 12px', borderRadius: 6,
                background: toneOpen ? '#1c1230' : '#080f1e',
                border: `1px solid ${toneOpen ? '#aa66ff' : '#1a2a40'}`,
                color: toneOpen ? '#e0a0ff' : '#5a7a9a' }}>
              🎛️ RIG
            </button>
            <button onClick={() => { stopBed(); setPhase('picker'); }} style={S.lobbyBtn}>← LEGENDS</button>
          </div>
          <button onClick={enterSteal} style={S.skipBtn}>SKIP →</button>
        </div>
      </div>
    );
  }

  // ── STEAL PHASE ───────────────────────────────────────────────────────
  if (phase === 'steal' && legend) {
    const totalMoves = Object.values(moveLog).reduce((a, b) => a + b, 0);
    const meterColor = meter >= 70 ? NEON_GREEN : meter >= 40 ? ACCENT : '#5a7a9a';

    return (
      <div style={S.root}>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Saira+Stencil+One&family=Saira:wght@400;600;700&display=swap" rel="stylesheet"/>
        <div style={S.hud}>
          <div>
            <div style={S.hudLabel}>STEAL — {legend.emoji} {legend.name.toUpperCase()}</div>
            <div style={{ fontSize: 10, color: '#5a7a9a' }}>
              {legend.moves.map(m => <span key={m.id} style={{ marginRight: 10 }}>{m.label}: {moveLog[m.id] || 0}</span>)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 22, color: meterColor }}>
              {meter}%
            </div>
            <div style={{ fontSize: 8, color: '#4a6a8a' }}>STYLE MATCH</div>
          </div>
        </div>

        {/* Style meter bar */}
        <div style={{ ...S.meter, marginBottom: 8 }}>
          <div style={S.meterFill(meter, meterColor)} />
          {/* 70% threshold marker */}
          <div style={{ position: 'absolute', left: '70%', top: 0, bottom: 0, width: 2, background: NEON_GREEN + '66' }} />
        </div>

        {/* Move & phrasing hints — collapsible guide panel */}
        <div style={{ width: '100%', maxWidth: 640, marginBottom: 6,
          padding: '8px 14px', background: '#0a101e', borderRadius: 6, border: '1px solid #1a2a40' }}>
          <span style={{ color: '#4a6a8a', fontFamily: "'Saira Stencil One',sans-serif", fontSize: 7, letterSpacing: 1 }}>HOW TO SCORE</span>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
            {legend.moves.map(m => (
              <div key={m.id} style={{ flex: '1 1 200px', fontSize: 9, color: '#6a7a8a', lineHeight: 1.4 }}>
                <div style={{ color: (moveLog[m.id] || 0) > 0 ? NEON_GREEN : ACCENT, fontFamily: "'Saira Stencil One',sans-serif", fontSize: 8, letterSpacing: 1, marginBottom: 2 }}>
                  {m.label} {(moveLog[m.id] || 0) > 0 ? `× ${moveLog[m.id]}` : ''}
                </div>
                {m.hint || ''}
              </div>
            ))}
            {legend.phraseStat.hint && (
              <div style={{ flex: '1 1 200px', fontSize: 9, color: '#6a7a8a', lineHeight: 1.4 }}>
                <div style={{ color: NEON_VIOLET, fontFamily: "'Saira Stencil One',sans-serif", fontSize: 8, letterSpacing: 1, marginBottom: 2 }}>
                  {legend.phraseStat.label} (20%)
                </div>
                {legend.phraseStat.hint}
              </div>
            )}
          </div>
        </div>

        <div style={S.coachArea}><div style={S.coachMsg}>{coachMsg}</div></div>

        <div style={S.neckWrap}>
          <FretboardFull onTapCell={handleStealTap} layers={layers} showLabels flash={flash} accent={ACCENT} playNote={playNote} />
        </div>

        {/* Tone panel toggle */}
        {toneOpen && (
          <div style={{ position: 'absolute', left: 24, bottom: 52, zIndex: 15,
            display: 'flex', alignItems: 'flex-end', gap: 5,
            background: 'linear-gradient(180deg,#161d30ee,#0a0e1cee)', border: '1px solid #aa66ff55',
            borderRadius: 6, padding: '6px 7px 4px 7px', boxShadow: '0 4px 16px #000000aa, 0 0 12px #aa66ff22',
            backdropFilter: 'blur(6px)' }}>
            {(() => {
              const V = TONE_VOICES[tone.voice ?? 'saw'] ?? TONE_VOICES.saw;
              return <button onClick={cycleVoice} title="VOICE"
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
              onChange={v => updateTone(k => ({ ...k, drive: v }))} onCommit={auditTone} />
            <ToneFader label="TONE" color="#ffcc44" value={tone.tone} defaultValue={TONE_KNOB_DEFAULTS.tone}
              onChange={v => updateTone(k => ({ ...k, tone: v }))} onCommit={auditTone} />
            <ToneFader label="ECHO" color="#44ddff" value={tone.echo} defaultValue={TONE_KNOB_DEFAULTS.echo}
              onChange={v => updateTone(k => ({ ...k, echo: v }))} onCommit={auditTone} />
            <ToneFader label="VERB" color="#aa88ff" value={tone.verb} defaultValue={TONE_KNOB_DEFAULTS.verb}
              onChange={v => updateTone(k => ({ ...k, verb: v }))} onCommit={auditTone} />
          </div>
        )}

        <div style={S.bottomBar}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setToneOpen(o => !o)} title="Tone panel"
              style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 10, letterSpacing: 1,
                cursor: 'pointer', padding: '6px 12px', borderRadius: 6,
                background: toneOpen ? '#1c1230' : '#080f1e',
                border: `1px solid ${toneOpen ? '#aa66ff' : '#1a2a40'}`,
                color: toneOpen ? '#e0a0ff' : '#5a7a9a' }}>
              🎛️ RIG
            </button>
            <button onClick={() => { stopBed(); setPhase('picker'); }} style={S.lobbyBtn}>← LEGENDS</button>
          </div>
          <button onClick={enterCard} style={{ ...S.goBtn, fontSize: 10, padding: '8px 18px' }}>FINISH</button>
        </div>
      </div>
    );
  }

  // ── SESSION CARD ──────────────────────────────────────────────────────
  if (phase === 'card' && legend) {
    const totalMoves = Object.values(moveLog).reduce((a, b) => a + b, 0);
    const medaled = meter >= 70;
    return (
      <div style={S.root}>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Saira+Stencil+One&family=Saira:wght@400;600;700&display=swap" rel="stylesheet"/>
        <div style={{ maxWidth: 420, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{legend.emoji}</div>
          <div style={S.title}>{legend.name.toUpperCase()}</div>
          <div style={{ fontSize: 11, color: '#6a8aaa', marginBottom: 20 }}>
            {medaled ? '🏅 STYLE MASTERED' : 'Keep practicing — 70% to medal'}
          </div>

          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 32, color: medaled ? NEON_GREEN : ACCENT, fontWeight: 700 }}>{meter}%</div>
              <div style={{ fontSize: 9, color: '#4a6a8a' }}>STYLE MATCH</div>
            </div>
            <div>
              <div style={{ fontSize: 28, color: NEON_CYAN, fontWeight: 700 }}>{totalMoves}</div>
              <div style={{ fontSize: 9, color: '#4a6a8a' }}>MOVES</div>
            </div>
          </div>

          {/* Move breakdown */}
          <div style={{ marginBottom: 16 }}>
            {legend.moves.map(m => (
              <div key={m.id} style={{ fontSize: 10, color: '#5a7a9a', marginBottom: 4 }}>
                {m.label}: <span style={{ color: (moveLog[m.id] || 0) > 0 ? NEON_GREEN : '#3a3a5a' }}>{moveLog[m.id] || 0}</span>
              </div>
            ))}
          </div>

          {/* What you practiced — takeaways */}
          {legend.lessons && (
            <div style={{ textAlign: 'left', marginBottom: 16, padding: '10px 14px',
              background: '#0a101e', borderRadius: 6, border: '1px solid #1a2a40' }}>
              <span style={{ color: '#4a6a8a', fontFamily: "'Saira Stencil One',sans-serif", fontSize: 7, letterSpacing: 1 }}>TAKEAWAYS</span>
              {legend.lessons.map((l, i) => (
                <div key={i} style={{ fontSize: 9, color: '#6a8a9a', lineHeight: 1.4, marginTop: 4,
                  paddingLeft: 8, borderLeft: `2px solid ${ACCENT}33` }}>{l}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => enterRig(legend)} style={S.goBtn}>RETRY</button>
            <button onClick={() => setPhase('picker')} style={S.lobbyBtn}>← LEGENDS</button>
            <button onClick={onBack} style={S.lobbyBtn}>← LOBBY</button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return <div style={S.root}><button onClick={onBack} style={S.lobbyBtn}>← LOBBY</button></div>;
}
