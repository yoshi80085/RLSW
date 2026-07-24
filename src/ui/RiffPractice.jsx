// =============================================================================
// ui/RiffPractice.jsx — 🎸 RIFF PRACTICE — endless riff stream with tier escalation
// -----------------------------------------------------------------------------
// A standalone mini-game accessible from the lobby: riffs keep coming, difficulty
// escalates after good streaks, pure sight-reading practice with the full-neck
// guitar view (or piano). No duel state machine, no beams, no verdicts — just
// the player vs. an infinite supply of randomly generated riffs.
//
// Reuses: generateAttackerRiff (riff generation), voiceRiff (guitar-neck
// voicing), buildRiffTimeline + riffOkWindow + gradeRiffOffset (timing/judging),
// RiffHighway (rendering), riffStats (scoring).
//
// ── Gameplay ──
// • Endless stream: each riff auto-starts after a brief results flash
// • Tier escalation: 3 consecutive riffs ≥ 80% quality → tier up
// • Tier de-escalation: any riff < 50% quality → tier down
// • Stats persisted to localStorage (best streak, total riffs, best accuracy)
// • ESC or ← LOBBY button returns to the lobby
// =============================================================================
import React, { useState, useRef, useEffect } from "react";
import { generateAttackerRiff, riffDegreesToNotes } from "../riff/riffGeneration.js";
import {
  RIFF_FALL_DIFFICULTY, RIFF_FALL_DEFAULT,
  buildRiffTimeline, riffOkWindow, gradeRiffOffset,
} from "../riff/fallingNotes.js";
import { voiceRiff } from "../riff/guitarMap.js";
import { getRiffAudio, riffDegreeFreq, playRiffWrong, playRiffMiss } from "../audio/riffSfx.js";
import { TONE_KNOB_DEFAULTS, SPIRIT_TONES, playAmpPowerChord } from "../audio/ampVoice.js";
import { RiffHighway } from "./RiffHighway.jsx";
import { riffStats } from "../engine/systems/riffOff.js";

// ── Constants ────────────────────────────────────────────────────────────────
const TIER_ORDER = ['rookie', 'gigging', 'shredder', 'virtuoso'];
const TIER_LABEL = {
  rookie:   '📱 INFLUENCER',
  gigging:  '🔥 GIGGING',
  shredder: '⚡ SHREDDER',
  virtuoso: '🌟 VIRTUOSO',
};
const STREAK_TO_PROMOTE = 3;
const GOOD_THRESHOLD    = 80;   // quality % → streak counts
const BAD_THRESHOLD     = 50;   // quality % → tier demotion
const RESULTS_PAUSE     = 2200; // ms between riffs (results flash)
const ACCENT            = '#19e6ff';

// ── localStorage ─────────────────────────────────────────────────────────────
const LS_KEY = 'rlsw.practice';
function freshStats() { return { bestStreak: 0, totalRiffs: 0, totalHits: 0, bestQuality: 0 }; }
function loadStats() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) ?? freshStats(); }
  catch { return freshStats(); }
}
function saveStats(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} }

// ── 🎛️ Spirit rig — practice plays through the SAME amp chain as the game ────
// (ampVoice.js: dual detuned osc + sub → drive → waveshaper → tone stack →
// echo/verb → shared limiter). The player picks whose rig they're borrowing;
// hits land as power chords exactly like the duel's riffPressKey path.
const RIG_ORDER = ['default', 'cosmic_ronin', 'intergalactic_0', 'Metalness_Monster', 'Glamarchy'];
const RIG_LABEL = {
  default:           '🎛️ HOUSE',
  cosmic_ronin:      '⚔️ RONIN',
  intergalactic_0:   '🛸 IG-0',
  Metalness_Monster: '🤘 MONSTER',
  Glamarchy:         '👑 GLAM',
};
const RIG_LS_KEY = 'rlsw.practice.rig';
function loadRig() {
  try { const r = localStorage.getItem(RIG_LS_KEY); return RIG_ORDER.includes(r) ? r : 'default'; }
  catch { return 'default'; }
}
function rigKnobs(rig) {
  return rig === 'default'
    ? TONE_KNOB_DEFAULTS
    : { ...TONE_KNOB_DEFAULTS, ...(SPIRIT_TONES[rig] ?? {}) };
}

// Landed gem → power chord through the Spirit amp (root + fifth, grade-scaled)
function playHit(freq, grade, rig) {
  const ctx = getRiffAudio(); if (!ctx || !freq) return;
  playAmpPowerChord(ctx, freq, grade, rigKnobs(rig));
}

// ── Component ────────────────────────────────────────────────────────────────
export function RiffPractice({ initialDiff, onBack }) {
  const [diff, setDiff]             = useState(initialDiff || RIFF_FALL_DEFAULT);
  const [view, setView]             = useState('guitar');
  const [phase, setPhase]           = useState('idle'); // idle | countdown | playing | results
  const [countdown, setCountdown]   = useState(3);
  const [riffRun, setRiffRun]       = useState(null);
  const [results, setResults]       = useState([]);
  const [streak, setStreak]         = useState(0);
  const [riffCount, setRiffCount]   = useState(0);
  const [lastResult, setLastResult] = useState(null); // { ...riffStats, gradeCount, total }
  const [tierFlash, setTierFlash]   = useState(null); // 'up' | 'down' | null
  const [stats, setStats]           = useState(loadStats);
  const [rig, setRig]               = useState(loadRig); // 🎛️ whose amp we borrow

  // Refs for timing-critical state (closures inside rAF / setTimeout must
  // always read the latest value, not a stale React snapshot).
  const engineRef  = useRef(null);
  const diffRef    = useRef(diff);
  const streakRef  = useRef(0);
  const phaseRef   = useRef('idle');
  const rigRef     = useRef(rig);
  diffRef.current  = diff;
  phaseRef.current = phase;
  rigRef.current   = rig;

  function cycleRig() {
    const next = RIG_ORDER[(RIG_ORDER.indexOf(rigRef.current) + 1) % RIG_ORDER.length];
    setRig(next);
    try { localStorage.setItem(RIG_LS_KEY, next); } catch {}
    // Audition the new rig immediately — one open-A power chord
    playHit(110, 'good', next);
  }

  const preset = RIFF_FALL_DIFFICULTY[diff] || RIFF_FALL_DIFFICULTY[RIFF_FALL_DEFAULT];

  // ── Countdown → launch ────────────────────────────────────────────────────
  function beginCountdown() {
    setPhase('countdown');
    setCountdown(3);
    setTierFlash(null);
    setLastResult(null);
    let c = 3;
    const iv = setInterval(() => {
      c--;
      if (c > 0) setCountdown(c);
      else { clearInterval(iv); launchRiff(); }
    }, 600);
  }

  // ── Generate, voice, and launch a riff ─────────────────────────────────────
  function launchRiff() {
    getRiffAudio(); // unlock audio context on user gesture
    const p = RIFF_FALL_DIFFICULTY[diffRef.current] || RIFF_FALL_DIFFICULTY[RIFF_FALL_DEFAULT];
    const riff     = generateAttackerRiff(Math.random, p.maxLen);
    const notes    = riffDegreesToNotes(riff.degrees, riff.sharps);
    const freqs    = riff.degrees.map((d, i) => riffDegreeFreq(d, riff.sharps[i]));
    const voicing  = voiceRiff(riff.degrees, riff.sharps, riff.rhythm);
    const timeline = buildRiffTimeline(riff.rhythm, 1, p.leadTime);
    const t0       = performance.now();

    const eng = {
      preset: p, t0, timers: [], freqs,
      notes: notes.map((k, i) => {
        const feel = timeline[i]?.feel ?? 'steady';
        return {
          idx: i, key: k, feel,
          pos: voicing?.positions?.[i] ?? null,
          hitAt: timeline[i]?.hitAt ?? (p.leadTime + i * 1000),
          okWin: riffOkWindow(p, feel, false),
          resolved: false, hit: false, grade: null, rt: null,
        };
      }),
      anchors: voicing?.anchors ?? null,
    };
    engineRef.current = eng;

    // Miss timers — fire once the gem is past saving
    eng.notes.forEach(n => {
      eng.timers.push(setTimeout(() => {
        if (engineRef.current !== eng || n.resolved) return;
        n.resolved = true; n.grade = 'miss';
        playRiffMiss();
        setResults(prev => [...prev, { hit: false, rt: null, grade: 'miss', noteIdx: n.idx }]);
        endCheck(eng);
      }, n.hitAt + n.okWin + 40));
    });

    setResults([]);
    setRiffRun({
      turn: 'attacker', round: 1, startedAt: t0,
      leadTime: p.leadTime, difficulty: diffRef.current,
      notes: eng.notes.map(n => ({
        idx: n.idx, key: n.key, hitAt: n.hitAt,
        feel: n.feel, ghostKey: null, okWin: n.okWin, pos: n.pos,
      })),
      anchors: eng.anchors,
    });
    setPhase('playing');
  }

  // ── Key press judge (keyboard + strike-zone taps) ─────────────────────────
  function pressKey(key) {
    const eng = engineRef.current;
    if (!eng?.notes || phaseRef.current !== 'playing') return;
    const now  = performance.now() - eng.t0;
    const live = eng.notes
      .filter(n => !n.resolved && Math.abs(now - n.hitAt) <= n.okWin)
      .sort((a, b) => Math.abs(now - a.hitAt) - Math.abs(now - b.hitAt));
    if (!live.length) return;
    // Prefer a note this key matches; among matches, take earliest
    const matches = live.filter(x => key === x.key);
    const n = matches.length
      ? matches.reduce((a, b) => a.hitAt <= b.hitAt ? a : b)
      : live[0];
    const offset = Math.round(now - n.hitAt);
    n.resolved = true;
    const hit   = key === n.key;
    const grade = hit ? (gradeRiffOffset(offset, eng.preset, n.feel) ?? 'ok') : 'wrong';
    n.hit = hit; n.grade = grade; n.rt = hit ? Math.abs(offset) : null;
    if (hit) playHit(eng.freqs[n.idx], grade, rigRef.current);
    else     playRiffWrong(key);
    setResults(prev => [...prev, { hit, rt: n.rt, grade, noteIdx: n.idx }]);
    endCheck(eng);
  }

  // ── All notes resolved? → finish after a brief hold ────────────────────────
  function endCheck(eng) {
    if (eng.notes.some(n => !n.resolved)) return;
    eng.timers.forEach(clearTimeout);
    setTimeout(() => {
      if (engineRef.current !== eng) return;
      // Compute stats from engine notes (synchronous — no React timing risk)
      const res = eng.notes.map(n => ({
        hit: n.hit, rt: n.rt, grade: n.grade ?? 'miss', noteIdx: n.idx,
      }));
      const st = riffStats(res);
      const gradeCount = { perfect: 0, good: 0, ok: 0, miss: 0, wrong: 0 };
      res.forEach(r => { gradeCount[r.grade] = (gradeCount[r.grade] || 0) + 1; });
      setLastResult({ ...st, gradeCount, total: res.length });
      setPhase('results');

      // Streak logic
      const good = st.quality >= GOOD_THRESHOLD;
      const bad  = st.quality < BAD_THRESHOLD;
      const curStreak = good ? streakRef.current + 1 : 0;
      streakRef.current = curStreak;
      setStreak(curStreak);
      setRiffCount(prev => prev + 1);

      // Tier change
      let tc = null;
      if (curStreak > 0 && curStreak % STREAK_TO_PROMOTE === 0) {
        const idx = TIER_ORDER.indexOf(diffRef.current);
        if (idx < TIER_ORDER.length - 1) {
          diffRef.current = TIER_ORDER[idx + 1];
          setDiff(diffRef.current);
          tc = 'up';
        }
      } else if (bad) {
        const idx = TIER_ORDER.indexOf(diffRef.current);
        if (idx > 0) {
          diffRef.current = TIER_ORDER[idx - 1];
          setDiff(diffRef.current);
          tc = 'down';
        }
      }
      setTierFlash(tc);

      // Persist stats
      setStats(prev => {
        const next = {
          bestStreak:  Math.max(prev.bestStreak, curStreak),
          totalRiffs:  prev.totalRiffs + 1,
          totalHits:   prev.totalHits + st.hits,
          bestQuality: Math.max(prev.bestQuality, st.quality),
        };
        saveStats(next);
        return next;
      });

      // Auto-advance to next riff
      setTimeout(() => {
        if (phaseRef.current !== 'results') return;
        beginCountdown();
      }, RESULTS_PAUSE);
    }, 700); // let the last judgment burst breathe
  }

  // ── Keyboard: note presses ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e) => {
      if (e.repeat || e.key.length !== 1 || !/[a-gA-G]/.test(e.key)) return;
      pressKey(e.key);
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, riffRun?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard: ESC to exit ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        engineRef.current?.timers?.forEach(clearTimeout);
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  // ── Auto-start on mount ────────────────────────────────────────────────────
  useEffect(() => {
    beginCountdown();
    return () => engineRef.current?.timers?.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────────
  const tierLabel  = TIER_LABEL[diff] || diff.toUpperCase();
  const showLabels = preset.showLabels;

  return (
    <div style={S.root}>
      {/* ── HUD (top) ── */}
      <div style={S.hud}>
        <div>
          <div style={S.hudLabel}>PRACTICE MODE</div>
          <div style={S.hudTier}>{tierLabel}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {streak > 0 && <div style={S.streak}>🔥 {streak}</div>}
          <div style={S.hudStat}>Riffs: {riffCount}</div>
          <div style={S.hudStat}>Best streak: {stats.bestStreak}</div>
        </div>
      </div>

      {/* ── Countdown overlay ── */}
      {phase === 'countdown' && (
        <div style={S.overlay}>
          <div style={S.countdownNum}>{countdown}</div>
        </div>
      )}

      {/* ── Results overlay ── */}
      {phase === 'results' && lastResult && (
        <div style={{ ...S.overlay, background: '#050a14cc' }}>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 2,
              color: lastResult.quality >= 80 ? '#44ff88' : lastResult.quality >= 50 ? '#f6ad55' : '#ff4466',
              textShadow: `0 0 24px ${lastResult.quality >= 80 ? '#44ff8844' : lastResult.quality >= 50 ? '#f6ad5544' : '#ff446644'}`,
              marginBottom: 8 }}>
              {lastResult.quality}%
            </div>
            <div style={{ fontSize: 11, color: '#6a8aaa', letterSpacing: 1, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {lastResult.gradeCount.perfect > 0 && <span style={{ color: ACCENT }}>PERFECT {lastResult.gradeCount.perfect}</span>}
              {lastResult.gradeCount.good > 0    && <span style={{ color: '#44ff88' }}>GOOD {lastResult.gradeCount.good}</span>}
              {lastResult.gradeCount.ok > 0      && <span style={{ color: '#f6ad55' }}>OK {lastResult.gradeCount.ok}</span>}
              {lastResult.gradeCount.miss > 0    && <span style={{ color: '#ff4466' }}>MISS {lastResult.gradeCount.miss}</span>}
              {lastResult.gradeCount.wrong > 0   && <span style={{ color: '#ff2d95' }}>WRONG {lastResult.gradeCount.wrong}</span>}
            </div>
            <div style={{ fontSize: 10, color: '#4a6a8a', marginTop: 8 }}>
              {lastResult.hits}/{lastResult.total} notes hit
              {lastResult.avgRt != null && <span> · avg {lastResult.avgRt}ms</span>}
            </div>
            {tierFlash === 'up'   && <div style={{ fontSize: 13, color: '#44ff88', marginTop: 16, letterSpacing: 2 }}>⬆ TIER UP → {tierLabel}</div>}
            {tierFlash === 'down' && <div style={{ fontSize: 13, color: '#ff4466', marginTop: 16, letterSpacing: 2 }}>⬇ TIER DOWN → {tierLabel}</div>}
          </div>
        </div>
      )}

      {/* ── Highway ── */}
      <div style={S.highwayWrap}>
        {riffRun && (
          <RiffHighway
            run={riffRun}
            results={results}
            ghostHit={null}
            view={view}
            accent={ACCENT}
            onPressKey={pressKey}
            showLabels={showLabels}
          />
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div style={S.bottomBar}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setView('piano')}  style={viewBtn(view === 'piano')}>🎹</button>
          <button onClick={() => setView('guitar')} style={viewBtn(view === 'guitar')}>🎸</button>
          <button onClick={cycleRig} title="Amp rig — play through a Spirit's signature tone"
            style={{ ...viewBtn(rig !== 'default'), fontSize: 10, letterSpacing: 1,
                     fontFamily: "'Saira Stencil One', sans-serif" }}>
            {RIG_LABEL[rig]}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 9, color: '#3a5a7a', letterSpacing: 1 }}>
            Best: {stats.bestQuality}% · {stats.totalRiffs} riffs
          </div>
          <button onClick={onBack} style={S.lobbyBtn}>← LOBBY</button>
        </div>
      </div>
    </div>
  );
}

// ── Style helpers ────────────────────────────────────────────────────────────
function viewBtn(active) {
  return {
    fontSize: 16, cursor: 'pointer', padding: '6px 12px', borderRadius: 6,
    background: active ? '#102030' : '#080f1e',
    border: `1px solid ${active ? ACCENT : '#1a2a40'}`,
    color: active ? ACCENT : '#3a5a7a',
    transition: 'all .2s',
  };
}

const S = {
  root: {
    position: 'fixed', inset: 0, background: '#050a14',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Saira Stencil One', sans-serif", color: '#e0f0ff', zIndex: 100,
  },
  hud: {
    position: 'absolute', top: 16, left: 24, right: 24, zIndex: 10,
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  hudLabel:  { fontSize: 11, letterSpacing: 2, color: '#3a5a7a', marginBottom: 4 },
  hudTier:   { fontSize: 16, letterSpacing: 1, color: ACCENT },
  hudStat:   { fontSize: 10, color: '#5a7a9a' },
  streak:    { fontSize: 14, color: '#ff6644', marginBottom: 4 },
  overlay: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },
  countdownNum: {
    fontSize: 72, color: ACCENT,
    textShadow: `0 0 40px ${ACCENT}55`,
  },
  highwayWrap: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', maxWidth: 500,
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
};
