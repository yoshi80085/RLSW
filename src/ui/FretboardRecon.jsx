// =============================================================================
// ui/FretboardRecon.jsx — 🗺️ FRETBOARD RECON — find the note on the neck
// -----------------------------------------------------------------------------
// The game tells you a note and a string — you find it. Pure neck knowledge,
// the literal skill the riff-off's guitar view sight-reads at SHREDDER+ (where
// labels vanish and position IS the notation). This mode manufactures that
// knowledge.
//
// Tiers: OPEN MIC → GIGGING → SHREDDER → VIRTUOSO
// Judging: speed × accuracy → PERFECT / GOOD / OK / FUMBLED
// Long-game: per-cell heatmap in localStorage, spaced-repetition-lite prompts.
// =============================================================================
import React, { useState, useRef, useEffect, useCallback } from "react";
import { STRING_NAMES, STRING_OPENS, MAX_FRET, cellKey, positionsForPitch } from "../riff/guitarMap.js";
import { playAmpNote } from "../audio/ampVoice.js";
import { getRiffAudio, playRiffWrong, playRiffMiss } from "../audio/riffSfx.js";
import { FretboardFull } from "./FretboardFull.jsx";
import { RIG_ORDER, RIG_LS_KEY, loadRig, rigKnobs, playRigHit, RigPicker } from "./RigPicker.jsx";
import { micAvailable, startMicListening } from "../audio/micPitch.js";

// ── Neon palette ────────────────────────────────────────────────────────────
const ACCENT     = '#19e6ff';
const NEON_GREEN = '#44ff88';

// ── Note display mapping ────────────────────────────────────────────────────
const PC_KEYS = ['a', 'A', 'b', 'c', 'C', 'd', 'D', 'e', 'f', 'F', 'g', 'G'];
const DISPLAY = {
  a: 'A', A: 'A♯', b: 'B', c: 'C', C: 'C♯',
  d: 'D', D: 'D♯', e: 'E', f: 'F', F: 'F♯', g: 'G', G: 'G♯',
};

// ── Tier system ─────────────────────────────────────────────────────────────
const TIERS = ['openmic', 'gigging', 'shredder', 'virtuoso'];
const TIER_LABEL = {
  openmic:   '📱 OPEN MIC',
  gigging:   '🔥 GIGGING',
  shredder:  '⚡ SHREDDER',
  virtuoso:  '🌟 VIRTUOSO',
};
const TIER_CONFIG = {
  openmic:  { pool: 'naturals', maxFret: 5,  showLabels: true,  hlString: true, findAll: false },
  gigging:  { pool: 'all',      maxFret: 12, showLabels: true,  hlString: true, findAll: false },
  shredder: { pool: 'all',      maxFret: 12, showLabels: false, hlString: false, findAll: false },
  virtuoso: { pool: 'all',      maxFret: 12, showLabels: false, hlString: false, findAll: true  },
};

const NATURALS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const ALL_KEYS = PC_KEYS;
const STREAK_TO_PROMOTE = 3;

// ── Grade thresholds ────────────────────────────────────────────────────────
function gradeFind(ms, wrongOnTarget, offStringTaps) {
  if (ms < 1500 && wrongOnTarget === 0 && offStringTaps <= 3) return 'perfect';
  if (ms < 3000 && wrongOnTarget === 0 && offStringTaps <= 3) return 'good';
  if (ms < 6000 && wrongOnTarget <= 1)                        return 'ok';
  return 'fumbled';
}

// ── Heatmap persistence ─────────────────────────────────────────────────────
const HEATMAP_LS = 'rlsw.practice.neck';
function loadHeatmap() {
  try { return JSON.parse(localStorage.getItem(HEATMAP_LS)) ?? {}; }
  catch { return {}; }
}
function saveHeatmap(h) {
  try { localStorage.setItem(HEATMAP_LS, JSON.stringify(h)); } catch {}
}
function updateCell(hm, cellId, hit, ms) {
  const prev = hm[cellId] || { attempts: 0, hits: 0, totalMs: 0 };
  return {
    ...prev,
    attempts: prev.attempts + 1,
    hits: prev.hits + (hit ? 1 : 0),
    totalMs: prev.totalMs + ms,
    avgMs: Math.round((prev.totalMs + ms) / (prev.attempts + 1)),
  };
}

// ── Prompt generation (spaced-repetition-lite) ──────────────────────────────
function generatePrompt(tier, heatmap, lastPrompt) {
  const cfg = TIER_CONFIG[tier];
  const pool = cfg.pool === 'naturals' ? NATURALS : ALL_KEYS;

  // Build candidate list: all valid (key, string) pairs for this tier
  const candidates = [];
  for (const key of pool) {
    for (let s = 0; s < 6; s++) {
      // Find if this key exists on this string within maxFret
      for (let f = 0; f <= cfg.maxFret; f++) {
        if (cellKey(s, f) === key) {
          candidates.push({ key, string: s, fret: f });
          break;
        }
      }
    }
  }

  if (cfg.findAll) {
    // VIRTUOSO: "find EVERY position of X"
    const uniqueKeys = [...new Set(pool)];
    // Weight toward weak keys
    const weighted = uniqueKeys.map(key => {
      let totalRate = 0, count = 0;
      for (let s = 0; s < 6; s++) {
        for (let f = 0; f <= cfg.maxFret; f++) {
          if (cellKey(s, f) === key) {
            const id = `${s},${f}`;
            const cell = heatmap[id];
            if (cell && cell.attempts >= 1) {
              totalRate += cell.hits / cell.attempts;
              count++;
            }
            count++;
          }
        }
      }
      const avgRate = count > 0 ? totalRate / count : 0;
      return { key, weight: 1 - avgRate + 0.2 }; // always some chance
    });
    // Filter out last prompt
    const filtered = weighted.filter(w => !lastPrompt || w.key !== lastPrompt.key);
    const arr = filtered.length ? filtered : weighted;
    const totalW = arr.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * totalW;
    for (const w of arr) { r -= w.weight; if (r <= 0) return { key: w.key, string: -1, findAll: true }; }
    return { key: arr[arr.length - 1].key, string: -1, findAll: true };
  }

  // Weight candidates by weakness (spaced-repetition-lite)
  const weighted = candidates.map(c => {
    const id = `${c.string},${c.fret}`;
    const cell = heatmap[id];
    const rate = cell && cell.attempts >= 1 ? cell.hits / cell.attempts : 0;
    const staleness = cell ? Math.min(1, (Date.now() - (cell.lastSeen || 0)) / 600000) : 1;
    return { ...c, weight: (1 - rate) + staleness * 0.3 + 0.1 };
  });

  // Filter out immediate repeat
  const filtered = weighted.filter(w =>
    !lastPrompt || w.key !== lastPrompt.key || w.string !== lastPrompt.string
  );
  const arr = filtered.length ? filtered : weighted;
  const totalW = arr.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * totalW;
  for (const w of arr) { r -= w.weight; if (r <= 0) return w; }
  return arr[arr.length - 1];
}

// ── Neck mastery % ──────────────────────────────────────────────────────────
function neckMastery(heatmap) {
  let mastered = 0;
  const total = 6 * (MAX_FRET + 1); // 78 cells
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= MAX_FRET; f++) {
      const cell = heatmap[`${s},${f}`];
      if (cell && cell.attempts >= 3 && (cell.hits / cell.attempts) >= 0.8) mastered++;
    }
  }
  return Math.round((mastered / total) * 100);
}

// ── Component ───────────────────────────────────────────────────────────────
export function FretboardRecon({ onBack }) {
  const [tier, setTier]             = useState('openmic');
  const [phase, setPhase]           = useState('idle');     // idle | active | result
  const [prompt, setPrompt]         = useState(null);
  const [grade, setGrade]           = useState(null);
  const [streak, setStreak]         = useState(0);
  const [promptCount, setPromptCount] = useState(0);
  const [heatmap, setHeatmap]       = useState(loadHeatmap);
  const [flash, setFlash]           = useState(null);
  const [rig, setRig]               = useState(loadRig);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [tierFlash, setTierFlash]   = useState(null);
  const [micActive, setMicActive]   = useState(false);
  const [micError, setMicError]     = useState(null);
  const [micLevel, setMicLevel]     = useState(null); // { db, state, freq?, confidence? }

  const micHandleRef = useRef(null);

  // Tracking for current prompt
  const promptRef = useRef(null);
  const startTimeRef = useRef(0);
  const wrongOnTargetRef = useRef(0);
  const offStringRef = useRef(0);
  const tierRef = useRef(tier);
  const streakRef = useRef(0);
  const rigRef = useRef(rig);
  const phaseRef = useRef(phase);
  const hmRef = useRef(heatmap);
  const foundCellsRef = useRef(new Set()); // for VIRTUOSO find-all

  tierRef.current = tier;
  streakRef.current = streak;
  rigRef.current = rig;
  phaseRef.current = phase;
  hmRef.current = heatmap;

  function cycleRig() {
    const next = RIG_ORDER[(RIG_ORDER.indexOf(rigRef.current) + 1) % RIG_ORDER.length];
    setRig(next);
    rigRef.current = next;
    try { localStorage.setItem(RIG_LS_KEY, next); } catch {}
    playRigHit(110, 'good', next);
  }

  // ── Mic input ────────────────────────────────────────────────────────────
  function handleMicNote({ key }) {
    if (phaseRef.current !== 'active' || !promptRef.current) return;
    const p = promptRef.current;
    const cfg = TIER_CONFIG[tierRef.current];

    if (p.findAll) {
      // VIRTUOSO + mic: verify pitch class, auto-mark all positions
      if (key !== p.key) {
        wrongOnTargetRef.current++;
        playRiffWrong(key);
        return;
      }
      // Correct — mark every position found at once (mic can't distinguish cells)
      for (let ss = 0; ss < 6; ss++) {
        for (let ff = 0; ff <= cfg.maxFret; ff++) {
          if (cellKey(ss, ff) === p.key) foundCellsRef.current.add(`${ss},${ff}`);
        }
      }
      const ms = performance.now() - startTimeRef.current;
      const g = gradeFind(ms, wrongOnTargetRef.current, 0);
      finishPrompt(g, ms, [...foundCellsRef.current]);
      return;
    }

    // Single-target mode — pitch class match only (string is honor-system)
    if (key === p.key) {
      const ms = performance.now() - startTimeRef.current;
      const g = gradeFind(ms, wrongOnTargetRef.current, offStringRef.current);
      setFlash({ cellId: `${p.string},${p.fret}`, grade: g });
      finishPrompt(g, ms, [`${p.string},${p.fret}`]);
    } else {
      wrongOnTargetRef.current++;
      playRiffWrong(key);
    }
  }

  async function toggleMic() {
    if (micHandleRef.current) {
      micHandleRef.current.stop();
      micHandleRef.current = null;
      setMicActive(false);
      setMicError(null);
      setMicLevel(null);
      return;
    }
    try {
      setMicError(null);
      const handle = await startMicListening(handleMicNote, {
        onLevel: setMicLevel,
      });
      micHandleRef.current = handle;
      setMicActive(true);
    } catch (err) {
      setMicError('Mic access denied');
      setMicActive(false);
    }
  }

  // Stop mic on unmount
  useEffect(() => () => { if (micHandleRef.current) { micHandleRef.current.stop(); micHandleRef.current = null; } }, []);

  // ── Launch a prompt ─────────────────────────────────────────────────────
  const launchPrompt = useCallback(() => {
    const p = generatePrompt(tierRef.current, hmRef.current, promptRef.current);
    promptRef.current = p;
    startTimeRef.current = performance.now();
    wrongOnTargetRef.current = 0;
    offStringRef.current = 0;
    foundCellsRef.current = new Set();
    setPrompt(p);
    setGrade(null);
    setFlash(null);
    setTierFlash(null);
    setPhase('active');
  }, []);

  // Auto-start on mount
  useEffect(() => { launchPrompt(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ESC to exit ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  // ── Handle cell tap ─────────────────────────────────────────────────────
  function handleTap(s, f) {
    if (phaseRef.current !== 'active' || !promptRef.current) return;
    const p = promptRef.current;
    const cfg = TIER_CONFIG[tierRef.current];
    const tappedKey = cellKey(s, f);

    if (p.findAll) {
      // VIRTUOSO: find ALL positions of this pitch class
      if (tappedKey !== p.key) {
        // Wrong note entirely — count as wrong
        wrongOnTargetRef.current++;
        playRiffWrong(tappedKey);
        setFlash({ cellId: `${s},${f}`, grade: 'wrong' });
        return;
      }
      // Correct pitch class — mark this cell
      const cellId = `${s},${f}`;
      if (foundCellsRef.current.has(cellId)) return; // already found
      foundCellsRef.current.add(cellId);
      setFlash({ cellId, grade: 'good' });

      // Check if all positions found
      const allPositions = [];
      for (let ss = 0; ss < 6; ss++) {
        for (let ff = 0; ff <= cfg.maxFret; ff++) {
          if (cellKey(ss, ff) === p.key) allPositions.push(`${ss},${ff}`);
        }
      }
      if (foundCellsRef.current.size >= allPositions.length) {
        // All found!
        const ms = performance.now() - startTimeRef.current;
        const perCell = ms / allPositions.length;
        const g = gradeFind(perCell, wrongOnTargetRef.current, 0);
        finishPrompt(g, ms, allPositions);
      }
      return;
    }

    // Single-target mode
    if (s !== p.string) {
      // Off-string exploration — unjudged but counted
      offStringRef.current++;
      return;
    }

    // On target string — judged
    if (tappedKey === p.key) {
      // Correct!
      const ms = performance.now() - startTimeRef.current;
      const g = gradeFind(ms, wrongOnTargetRef.current, offStringRef.current);
      setFlash({ cellId: `${s},${f}`, grade: g });
      finishPrompt(g, ms, [`${s},${f}`]);
    } else {
      // Wrong cell on target string
      wrongOnTargetRef.current++;
      playRiffWrong(tappedKey);
      setFlash({ cellId: `${s},${f}`, grade: 'wrong' });
      // Check for auto-fumble
      if (wrongOnTargetRef.current >= 2) {
        const ms = performance.now() - startTimeRef.current;
        finishPrompt('fumbled', ms, [`${p.string},${p.fret}`]);
      }
    }
  }

  function finishPrompt(g, ms, cellIds) {
    setGrade(g);
    setPhase('result');
    setPromptCount(c => c + 1);

    // Play hit sound on correct
    if (g !== 'fumbled') {
      const p = promptRef.current;
      if (p && !p.findAll) {
        playRigHit(110 * Math.pow(2, (STRING_OPENS[p.string] + p.fret - 5) / 12), g, rigRef.current);
      }
    } else {
      playRiffMiss();
    }

    // Update heatmap
    const newHm = { ...hmRef.current };
    for (const cid of cellIds) {
      newHm[cid] = updateCell(newHm, cid, g !== 'fumbled', ms / cellIds.length);
      newHm[cid].lastSeen = Date.now();
    }
    setHeatmap(newHm);
    hmRef.current = newHm;
    saveHeatmap(newHm);

    // Streak + tier logic
    const isGood = g === 'perfect' || g === 'good';
    const newStreak = isGood ? streakRef.current + 1 : 0;
    streakRef.current = newStreak;
    setStreak(newStreak);

    let tc = null;
    if (newStreak > 0 && newStreak % STREAK_TO_PROMOTE === 0) {
      const idx = TIERS.indexOf(tierRef.current);
      if (idx < TIERS.length - 1) {
        tierRef.current = TIERS[idx + 1];
        setTier(tierRef.current);
        tc = 'up';
      }
    } else if (g === 'fumbled') {
      const idx = TIERS.indexOf(tierRef.current);
      if (idx > 0) {
        tierRef.current = TIERS[idx - 1];
        setTier(tierRef.current);
        tc = 'down';
      }
    }
    setTierFlash(tc);

    // Auto-advance
    setTimeout(() => {
      if (phaseRef.current !== 'result') return;
      launchPrompt();
    }, 1200);
  }

  // ── Audition on tap (free play) ─────────────────────────────────────────
  function playNote(freq) {
    const ctx = getRiffAudio(); if (!ctx) return;
    playAmpNote(ctx, freq, { holdTime: 0.4, fadeTime: 0.5, volume: 0.3, knobs: { ...rigKnobs(rigRef.current) } });
  }

  // ── Build layers for the neck ─────────────────────────────────────────
  const layers = {};
  const cfg = TIER_CONFIG[tier];

  if (showHeatmap) {
    // Heatmap mode: green→red by performance
    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= MAX_FRET; f++) {
        const cell = heatmap[`${s},${f}`];
        if (cell && cell.attempts >= 1) {
          const rate = cell.hits / cell.attempts;
          const r = Math.round(255 * (1 - rate));
          const g = Math.round(255 * rate);
          layers[`${s},${f}`] = { color: `rgb(${r},${g},80)`, style: 'solid' };
        }
      }
    }
  } else if (phase === 'active' && prompt) {
    if (prompt.findAll) {
      // VIRTUOSO: highlight found cells
      foundCellsRef.current.forEach(cid => {
        layers[cid] = { color: NEON_GREEN, style: 'solid' };
      });
    }
    // Target highlight would give it away — only highlight the string (if tier allows)
  }

  const mastery = neckMastery(heatmap);
  const gradeColor = { perfect: ACCENT, good: NEON_GREEN, ok: '#f6ad55', fumbled: '#ff4466' };
  const displayPrompt = prompt ? (DISPLAY[prompt.key] || prompt.key) : '';

  return (
    <div style={S.root}>
      {/* ── HUD ── */}
      <div style={S.hud}>
        <div>
          <div style={S.hudLabel}>FRETBOARD RECON</div>
          <div style={S.hudTier}>{TIER_LABEL[tier]}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {streak > 0 && <div style={S.streak}>🔥 {streak}</div>}
          <div style={S.hudStat}>Prompts: {promptCount}</div>
          <div style={S.hudStat}>Mastery: {mastery}%</div>
        </div>
      </div>

      {/* ── Prompt card ── */}
      <div style={S.promptArea}>
        {phase === 'active' && prompt && (
          <div style={S.promptCard}>
            {prompt.findAll ? (
              <div>
                <div style={{ fontSize: 12, color: '#6a8aaa', letterSpacing: 2, marginBottom: 4 }}>
                  FIND EVERY
                </div>
                <div style={{ fontSize: 36, color: ACCENT, textShadow: `0 0 20px ${ACCENT}55` }}>
                  {displayPrompt}
                </div>
                <div style={{ fontSize: 10, color: '#4a6a8a', marginTop: 4 }}>
                  {foundCellsRef.current.size} found
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: '#6a8aaa', letterSpacing: 2, marginBottom: 4 }}>FIND</div>
                <div style={{ fontSize: 36, color: ACCENT, textShadow: `0 0 20px ${ACCENT}55` }}>
                  {displayPrompt}
                </div>
                <div style={{ fontSize: 12, color: '#6a8aaa', marginTop: 4 }}>
                  on the <span style={{ color: ACCENT, fontWeight: 700 }}>{STRING_NAMES[prompt.string]}</span> string
                </div>
              </div>
            )}
          </div>
        )}
        {phase === 'result' && grade && (
          <div style={S.promptCard}>
            <div style={{
              fontSize: 28, fontWeight: 700, letterSpacing: 2,
              color: gradeColor[grade],
              textShadow: `0 0 16px ${gradeColor[grade]}44`,
            }}>
              {grade.toUpperCase()}
            </div>
            {tierFlash === 'up'   && <div style={{ fontSize: 12, color: NEON_GREEN, marginTop: 8, letterSpacing: 2 }}>⬆ TIER UP → {TIER_LABEL[tier]}</div>}
            {tierFlash === 'down' && <div style={{ fontSize: 12, color: '#ff4466', marginTop: 8, letterSpacing: 2 }}>⬇ TIER DOWN → {TIER_LABEL[tier]}</div>}
          </div>
        )}
      </div>

      {/* ── Fretboard ── */}
      <div style={S.neckWrap}>
        <FretboardFull
          onTapCell={handleTap}
          layers={layers}
          showLabels={cfg.showLabels}
          flash={flash}
          highlightString={cfg.hlString && prompt && !prompt.findAll ? prompt.string : -1}
          accent={ACCENT}
          playNote={playNote}
        />
      </div>

      {/* ── Bottom bar ── */}
      <div style={S.bottomBar}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <RigPicker rig={rig} onCycle={cycleRig} accent={ACCENT} />
          <button onClick={() => setShowHeatmap(h => !h)}
            style={{ ...S.smallBtn, borderColor: showHeatmap ? ACCENT : '#1a2a40',
                     color: showHeatmap ? ACCENT : '#3a5a7a' }}>
            {showHeatmap ? 'NECK' : 'HEATMAP'}
          </button>
          {micAvailable() && (
            <button onClick={toggleMic} title="Use your real guitar via microphone"
              style={{ ...S.smallBtn,
                borderColor: micActive ? NEON_GREEN : '#1a2a40',
                color: micActive ? NEON_GREEN : '#3a5a7a',
                background: micActive ? '#0a1e10' : '#080f1e',
                boxShadow: micActive ? `0 0 10px ${NEON_GREEN}33` : 'none',
              }}>
              {micActive ? '🎤 LIVE' : '🎤 MIC'}
            </button>
          )}
          {micError && <span style={{ fontSize: 8, color: '#ff4466' }}>{micError}</span>}
          {/* ── Mic signal meter ── */}
          {micActive && micLevel && (() => {
            // Normalize dB to a 0–1 bar (-60 dB = empty, -10 dB = full)
            const pct = Math.max(0, Math.min(1, (micLevel.db + 60) / 50));
            const stateColor = {
              silent: '#1a2a40', detecting: '#f6ad55',
              'low-confidence': '#ff6644', note: NEON_GREEN,
            }[micLevel.state] || '#1a2a40';
            const dbStr = micLevel.db > -100 ? `${Math.round(micLevel.db)}dB` : '—';
            const stateLabel = {
              silent: `silent ${dbStr}`, detecting: `hearing... ${dbStr}`,
              'low-confidence': `weak ${Math.round((micLevel.confidence || 0) * 100)}% ${dbStr}`,
              note: (() => {
                if (!micLevel.freq) return `♪ ${dbStr}`;
                const pitch = Math.round(12 * Math.log2(micLevel.freq / 82.4069));
                const k = PC_KEYS[(((pitch - 5) % 12) + 12) % 12];
                return `${DISPLAY[k] || '♪'} ${dbStr}`;
              })(),
            }[micLevel.state];
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 48, height: 6, background: '#0a1020', borderRadius: 3, border: '1px solid #1a2a40', overflow: 'hidden' }}>
                  <div style={{ width: `${pct * 100}%`, height: '100%', background: stateColor, borderRadius: 3, transition: 'width .05s, background .15s' }} />
                </div>
                <span style={{ fontSize: 8, color: stateColor, minWidth: 50 }}>{stateLabel}</span>
              </div>
            );
          })()}
        </div>
        <button onClick={onBack} style={S.lobbyBtn}>← LOBBY</button>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = {
  root: {
    position: 'fixed', inset: 0, background: '#050a14',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    fontFamily: "'Saira Stencil One', sans-serif", color: '#e0f0ff', zIndex: 100,
  },
  hud: {
    position: 'absolute', top: 16, left: 24, right: 24, zIndex: 10,
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  hudLabel:  { fontSize: 11, letterSpacing: 2, color: '#3a5a7a', marginBottom: 4 },
  hudTier:   { fontSize: 16, letterSpacing: 1, color: '#19e6ff' },
  hudStat:   { fontSize: 10, color: '#5a7a9a' },
  streak:    { fontSize: 14, color: '#ff6644', marginBottom: 4 },
  promptArea: {
    marginTop: 64, height: 100, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  promptCard: {
    textAlign: 'center', padding: '12px 32px',
    background: '#0a1020', border: '1px solid #1a2a40', borderRadius: 8,
  },
  neckWrap: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', maxWidth: 680, padding: '0 16px',
  },
  bottomBar: {
    position: 'absolute', bottom: 16, left: 24, right: 24, zIndex: 10,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  lobbyBtn: {
    fontFamily: "'Saira Stencil One', sans-serif",
    fontSize: 10, letterSpacing: 1, cursor: 'pointer',
    padding: '8px 16px', borderRadius: 6,
    background: '#1a1020', border: '1px solid #4a3060', color: '#c080ff',
  },
  smallBtn: {
    fontFamily: "'Saira Stencil One', sans-serif",
    fontSize: 9, letterSpacing: 1, cursor: 'pointer',
    padding: '6px 10px', borderRadius: 6,
    background: '#080f1e', border: '1px solid #1a2a40', color: '#3a5a7a',
    transition: 'all .2s',
  },
};
