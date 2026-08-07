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
import { generateAttackerRiff, generateDefenderRiff, riffDegreesToNotes } from "../riff/riffGeneration.js";
import {
  RIFF_FALL_DIFFICULTY, RIFF_FALL_DEFAULT,
  buildRiffTimeline, riffOkWindow, gradeRiffOffset,
  RIFF_SPEED_MIN, RIFF_SPEED_MAX, RIFF_SPEED_DEFAULT,
  clampRiffSpeed, scalePresetForSpeed, scaleTimelineForSpeed,
  loadRiffSpeed, saveRiffSpeed,
} from "../riff/fallingNotes.js";
import { micAvailable, startMicListening } from "../audio/micPitch.js";
import { voiceRiff } from "../riff/guitarMap.js";
import { getRiffAudio, riffDegreeFreq, playRiffWrong, playRiffMiss } from "../audio/riffSfx.js";
import { RiffHighway } from "./RiffHighway.jsx";
import { riffStats } from "../engine/systems/riffOff.js";
import { RIG_ORDER, RIG_LABEL, RIG_LS_KEY, loadRig, playRigHit, RigPicker } from "./RigPicker.jsx";

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

// ── Component ────────────────────────────────────────────────────────────────
export function RiffPractice({ initialDiff, onBack }) {
  const [diff, setDiff]             = useState(initialDiff || RIFF_FALL_DEFAULT);
  // 🎯 NEON is the standard riff-off view — practice on what you duel on.
  const [view, setView] = useState(() => {
    try {
      const v = localStorage.getItem('rlsw.riffView');
      if (v === 'piano' || v === 'guitar' || v === 'neon' || v === 'answer') return v;
    } catch { /* default */ }
    return 'neon';
  });
  // 🗣️ The call the current riff answers — null in every view but 'answer'.
  // Practice normally streams lone attacker riffs; the answer view needs a PAIR,
  // so launchRiff generates both and hands the call to the view.
  const [callAnswer, setCallAnswer] = useState(null);
  useEffect(() => {
    try { localStorage.setItem('rlsw.riffView', view); } catch { /* non-fatal */ }
  }, [view]);
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
  // 🐢 TEMPO — separate from difficulty on purpose: difficulty picks the riff
  // and the reading aids, this stretches the clock. SHARED with the main game
  // (same localStorage key), so the speed you get comfortable with here is the
  // speed your duels run at.
  const [speed, setSpeed] = useState(loadRiffSpeed);
  // 🎤 real guitar — same judge as the keyboard and the neck taps.
  const [micOn, setMicOn] = useState(() => {
    try { return localStorage.getItem('rlsw.riffMic') === '1'; } catch { return false; }
  });
  const [micHeard, setMicHeard] = useState(null);  // { key, at }
  const [micErr,   setMicErr]   = useState(null);

  // Refs for timing-critical state (closures inside rAF / setTimeout must
  // always read the latest value, not a stale React snapshot).
  const engineRef  = useRef(null);
  const diffRef    = useRef(diff);
  const streakRef  = useRef(0);
  const phaseRef   = useRef('idle');
  const rigRef     = useRef(rig);
  const speedRef   = useRef(speed);
  const viewRef    = useRef(view);
  diffRef.current  = diff;
  phaseRef.current = phase;
  rigRef.current   = rig;
  speedRef.current = speed;
  viewRef.current  = view;

  function cycleRig() {
    const next = RIG_ORDER[(RIG_ORDER.indexOf(rigRef.current) + 1) % RIG_ORDER.length];
    setRig(next);
    try { localStorage.setItem(RIG_LS_KEY, next); } catch {}
    // Audition the new rig immediately — one open-A power chord
    playRigHit(110, 'good', next);
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
    const p0    = RIFF_FALL_DIFFICULTY[diffRef.current] || RIFF_FALL_DIFFICULTY[RIFF_FALL_DEFAULT];
    const spd   = clampRiffSpeed(speedRef.current);
    // 🐢 The whole run restated at `spd` tempo: lead-in, note gaps and grade
    // windows all stretch together. Build the timeline at the WRITTEN lead time
    // and scale afterwards — hitAt[0] IS the lead time and later entries are
    // lead + cumulative gaps, so one uniform divide moves both.
    const p        = scalePresetForSpeed(p0, spd);
    // 🗣️ In the answer view you play the REPLY, not the call: generate the pair
    // and run the defender's riff. Everything downstream (voicing, timeline,
    // judging, stats) is identical — a riff is a riff, whoever threw it.
    const call     = generateAttackerRiff(Math.random, p0.maxLen);
    const wantsCA  = viewRef.current === 'answer';
    const answer   = wantsCA ? generateDefenderRiff(call, Math.random) : null;
    const riff     = answer ?? call;
    setCallAnswer(answer ? { call, ans: answer, kind: answer.kind, tier: diffRef.current } : null);
    const notes    = riffDegreesToNotes(riff.degrees, riff.sharps);
    const freqs    = riff.degrees.map((d, i) => riffDegreeFreq(d, riff.sharps[i]));
    const voicing  = voiceRiff(riff.degrees, riff.sharps, riff.rhythm);
    const timeline = scaleTimelineForSpeed(buildRiffTimeline(riff.rhythm, 1, p0.leadTime), spd);
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
      leadTime: p.leadTime, difficulty: diffRef.current, speed: spd,
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
    if (hit) playRigHit(eng.freqs[n.idx], grade, rigRef.current);
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

  // ── 🎤 Mic: play the riff on a real guitar ─────────────────────────────────
  // A third route into pressKey, alongside the keyboard and neck taps. No
  // translation needed: micPitch and guitarMap index the same PC_KEYS alphabet
  // from the same DEGREE0_PITCH anchor, so the mic's `key` IS a pressKey key.
  // (Pinned by riff/neonNeck.test.mjs — it plays every cell on the neck through
  // the detector's maths and asserts the judge would accept it.)
  const micHandleRef = useRef(null);
  const micPressRef  = useRef(() => {});
  const micClearRef  = useRef(null);
  // The readout self-clears on a timer rather than being derived from a
  // timestamp at render time. Comparing performance.now() during render is both
  // impure and broken in practice: nothing re-renders when the note goes stale,
  // so the last note heard would sit on screen until something else moved.
  useEffect(() => { micPressRef.current = ({ key }) => {
    setMicHeard(key);
    clearTimeout(micClearRef.current);
    micClearRef.current = setTimeout(() => setMicHeard(null), 900);
    pressKey(key);
  }; });

  // Held open for the whole practice session rather than per-riff: riffs
  // auto-advance every couple of seconds, and re-acquiring getUserMedia between
  // them would drop the opening notes each time. pressKey already ignores
  // anything outside the 'playing' phase, so a hot mic costs nothing here.
  useEffect(() => {
    let cancelled = false;
    if (micOn && !micHandleRef.current) {
      startMicListening(payload => {
        // Runs inside micPitch's rAF loop — an uncaught throw here vanishes into
        // the audio thread and reads as a detection failure. Log it loudly.
        try { micPressRef.current(payload); }
        catch (err) { console.error('[RLSW MIC] practice press failed:', err); }
      })
        .then(h => {
          if (cancelled) { h.stop(); return; }
          micHandleRef.current = h;
          setMicErr(null);
        })
        .catch(() => { if (!cancelled) { setMicErr('blocked'); setMicOn(false); } });
    } else if (!micOn && micHandleRef.current) {
      micHandleRef.current.stop();
      micHandleRef.current = null;
      setMicHeard(null);
    }
    return () => { cancelled = true; };
  }, [micOn]);

  // Hand the device back when the practice screen goes away.
  useEffect(() => () => {
    micHandleRef.current?.stop(); micHandleRef.current = null;
    clearTimeout(micClearRef.current);
  }, []);

  function toggleMic() {
    if (!micAvailable()) { setMicErr('no mic'); return; }
    setMicOn(v => {
      const next = !v;
      try { localStorage.setItem('rlsw.riffMic', next ? '1' : '0'); } catch { /* non-fatal */ }
      return next;
    });
  }

  function changeSpeed(v) { setSpeed(saveRiffSpeed(v)); }

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
      {/* 🎯 the neon neck is a wide instrument — it takes the full practice
          window rather than the 500px column the piano/highway views want. */}
      <div style={(view === 'neon' || view === 'answer')
        ? { ...S.highwayWrap, maxWidth: 'none' } : S.highwayWrap}>
        {riffRun && (
          <RiffHighway
            run={riffRun}
            results={results}
            ghostHit={null}
            view={view}
            accent={ACCENT}
            onPressKey={pressKey}
            showLabels={showLabels}
            callAnswer={callAnswer}
          />
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div style={S.bottomBar}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setView('piano')}  style={viewBtn(view === 'piano')}>🎹</button>
          <button onClick={() => setView('guitar')} style={viewBtn(view === 'guitar')}>🎸</button>
          <button onClick={() => setView('neon')}   style={viewBtn(view === 'neon')}
            title="Riff Off — landing-target rings on the neck">🎯</button>
          {/* 🗣️ Call & Answer — the derivation view. Switching takes effect on
              the NEXT riff: the current run's notes are already scheduled, and
              the answer view needs a call/answer PAIR the run wasn't built with. */}
          <button onClick={() => setView('answer')} style={viewBtn(view === 'answer')}
            title="Call & Answer — work out the reply instead of reading it">🗣️</button>
          <RigPicker rig={rig} onCycle={cycleRig} accent={ACCENT} />

          {/* ── 🐢 TEMPO DIAL ── takes effect on the NEXT riff (the current run's
                 hit-times are already scheduled on the engine clock). ── */}
          <div style={S.dialWrap} title="Slow the whole riff down — lead-in, note spacing and timing windows together">
            <span style={S.dialIcon}>🐢</span>
            <input type="range" min={RIFF_SPEED_MIN} max={RIFF_SPEED_MAX} step={0.05}
              value={speed} onChange={e => changeSpeed(parseFloat(e.target.value))}
              style={S.dial} />
            <span style={S.dialIcon}>🐇</span>
            <span style={{ ...S.dialVal, color: speed < 1 ? '#4ade80' : speed > 1 ? '#ff8a2a' : ACCENT }}>
              {Math.round(speed * 100)}%
            </span>
            {speed !== RIFF_SPEED_DEFAULT && (
              <button onClick={() => changeSpeed(RIFF_SPEED_DEFAULT)} style={S.dialReset}
                title="Back to written tempo">↺</button>
            )}
          </div>

          {/* 🎤 real guitar */}
          <button onClick={toggleMic} style={{ ...viewBtn(micOn), borderColor: micOn ? '#4ade80' : undefined,
                                               color: micOn ? '#4ade80' : undefined }}
            title={micErr === 'no mic' ? 'No microphone (needs HTTPS or localhost)'
                 : micErr === 'blocked' ? 'Microphone permission denied'
                 : 'Play the riff on a real guitar'}>
            🎤
          </button>
          {micOn && (
            <span style={S.micHeard}>
              {micHeard
                ? (micHeard === micHeard.toUpperCase() ? `${micHeard}♯` : micHeard.toUpperCase())
                : '···'}
            </span>
          )}
          {micErr && <span style={S.micErr}>{micErr === 'no mic' ? 'NO MIC' : 'BLOCKED'}</span>}
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
  // 🐢 tempo dial
  dialWrap: {
    display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10,
    padding: '5px 10px', borderRadius: 6,
    background: '#0a1424', border: '1px solid #24405e',
  },
  dialIcon:  { fontSize: 11, opacity: 0.75, lineHeight: 1 },
  dial:      { width: 116, accentColor: ACCENT, cursor: 'pointer' },
  dialVal:   { fontSize: 10, letterSpacing: 1, minWidth: 34, textAlign: 'right' },
  dialReset: {
    fontFamily: "'Saira Stencil One', sans-serif", fontSize: 11, lineHeight: 1,
    cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
    background: 'transparent', border: '1px solid #24405e', color: '#5a7a9a',
  },
  micHeard: {
    fontSize: 11, letterSpacing: 1, color: '#4ade80',
    minWidth: 26, textAlign: 'center',
  },
  micErr: { fontSize: 9, letterSpacing: 1, color: '#ff6b6b' },
};
