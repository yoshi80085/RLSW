// =============================================================================
// ui/FretboardRecon.jsx — 🗺️ FRETBOARD RECON — find the note on the neck
// -----------------------------------------------------------------------------
// The game tells you a note and a string — you find it. Pure neck knowledge,
// the literal skill the riff-off's guitar view sight-reads at SHREDDER+ (where
// labels vanish and position IS the notation). This mode manufactures that
// knowledge.
//
// Levels: OPEN MIC → GIGGING → SHREDDER → VIRTUOSO
// Judging: speed × accuracy → PERFECT / GOOD / OK / FUMBLED
// Long-game: per-cell heatmap in localStorage, spaced-repetition-lite prompts.
//
// ─── ⚠️ DON'T CHANGE LEVELS IN THE MIDDLE OF A SET ──────────────────────────
// This mode used to promote you after a 3-answer streak and demote you on any
// fumble, live, mid-run. It was cut, and it should not come back. Two reasons:
//
//   1. It made the difficulty a MOVING TARGET. At SHREDDER the fret labels
//      vanish; at VIRTUOSO the whole task changes to "find every position of
//      this note". Having those rules swap under you between one prompt and the
//      next means a fumble often measured the surprise, not the knowledge.
//   2. It made the session UNSCOREABLE. If the level drifts while you play,
//      "how did I do?" has no answer — there's no fixed thing you were doing.
//
// What replaced it is a deliberate split, and the split is the whole design:
//
//   🔁 PRACTICE — endless, at ONE level you chose. Nothing is scored, nothing
//      is recorded, nothing moves. It's a room to sit in.
//   🎤 LIVE SET — exactly LIVE_SET_LENGTH prompts at ONE level you chose,
//      graded to a letter rank at the end. It's a measurement.
//
// The player picks their own level in both, always. The end of a Live Set
// offers a RECOMMENDATION (go up / hold / drop back) and that is all it is —
// a suggestion with a button next to it. Nothing here ever moves the player
// somewhere they didn't ask to go.
// =============================================================================
import React, { useState, useRef, useEffect, useCallback } from "react";
import { STRING_NAMES, STRING_OPENS, MAX_FRET, cellKey, positionsForPitch } from "../riff/guitarMap.js";
import { playAmpNote } from "../audio/ampVoice.js";
import { getRiffAudio, playRiffWrong, playRiffMiss } from "../audio/riffSfx.js";
import { FretboardFull } from "./FretboardFull.jsx";
import { RIG_ORDER, RIG_LS_KEY, loadRig, rigKnobs, playRigHit, RigPicker } from "./RigPicker.jsx";
import { micAvailable, startMicListening, MIC_DEFAULTS } from "../audio/micPitch.js";

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

const TIER_BLURB = {
  openmic:  'Naturals only, first 5 frets, labels on, target string lit.',
  gigging:  'Every note, full 12 frets, labels on, target string lit.',
  shredder: 'Labels OFF, no string highlight. Position is the notation.',
  virtuoso: 'Find EVERY position of the note. No labels, no help.',
};

const NATURALS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const ALL_KEYS = PC_KEYS;

// ── 🎤 LIVE SET ─────────────────────────────────────────────────────────────
// Fixed at every level ON PURPOSE. A set that got longer as you climbed would
// make the ranks incomparable — "A at SHREDDER" and "A at GIGGING" have to mean
// the same amount of work for the ladder to read as a ladder.
const LIVE_SET_LENGTH = 15;

// Rank thresholds on a blended score (see scoreSet). Accuracy is weighted well
// above speed: this mode teaches you WHERE the notes are, and a fast wrong
// answer is worth nothing. Speed is the tiebreaker, not the test.
const ACC_WEIGHT = 0.72;
const SPD_WEIGHT = 0.28;
// Speed normalisation: 1.2 s/prompt scores full marks, 6 s scores zero. These
// are per-prompt AVERAGES, so a couple of long hunts won't tank an otherwise
// fluent set.
const SPD_FAST_MS = 1200;
const SPD_SLOW_MS = 6000;

const RANKS = [
  { id: 'S', min: 0.93, color: '#19e6ff', label: 'HEADLINER' },
  { id: 'A', min: 0.82, color: '#44ff88', label: 'TIGHT' },
  { id: 'B', min: 0.68, color: '#c3f53b', label: 'SOLID' },
  { id: 'C', min: 0.50, color: '#f6ad55', label: 'SHAKY' },
  { id: 'D', min: 0,    color: '#ff4466', label: 'LOST ON THE NECK' },
];
const RANK_ORDER = ['D', 'C', 'B', 'A', 'S'];
const RANK_BY_ID = Object.fromEntries(RANKS.map(r => [r.id, r]));

/**
 * Blend a finished set into a 0–1 score and a letter.
 *
 * ⚠️ The accuracy term counts NON-FUMBLED prompts, not PERFECTs. A player who
 * finds every note but finds them slowly has genuinely done the thing this mode
 * exists to teach, and should not be ranked below someone who guessed fast and
 * missed. The speed term is what separates them, and it's capped at 28%.
 */
export function scoreSet({ found, total, avgMs }) {
  if (!total) return { score: 0, rank: 'D', accuracy: 0, speed: 0 };
  const accuracy = found / total;
  const speed = Math.max(0, Math.min(1, (SPD_SLOW_MS - avgMs) / (SPD_SLOW_MS - SPD_FAST_MS)));
  const score = accuracy * ACC_WEIGHT + speed * SPD_WEIGHT;
  // ⛔ ACCURACY GATE. Without it, a blazing-fast set that missed a third of its
  // prompts could still reach A on the speed term alone — which would tell the
  // player to move UP a level on the strength of not knowing the neck.
  let rank = (RANKS.find(r => score >= r.min) ?? RANKS[RANKS.length - 1]).id;
  if (accuracy < 0.90 && (rank === 'S')) rank = 'A';
  if (accuracy < 0.75 && (rank === 'S' || rank === 'A')) rank = 'B';
  return { score, rank, accuracy, speed };
}

/**
 * The end-of-set suggestion. Advisory ONLY — the caller renders it next to a
 * button the player is free to ignore, and nothing in this file ever applies it
 * automatically.
 */
export function recommendFor(tier, rank) {
  const idx = TIERS.indexOf(tier);
  const top = idx >= TIERS.length - 1;
  const bottom = idx <= 0;
  if (rank === 'S' || rank === 'A') {
    return top
      ? { move: null, headline: 'You own this neck.',
          body: 'VIRTUOSO is the last room in the building. Run it again for the record, or go put it to work in a riff-off.' }
      : { move: TIERS[idx + 1], headline: `Ready for ${TIER_LABEL[TIERS[idx + 1]]}.`,
          body: 'You cleared this comfortably. The next level will feel wrong for about a minute and then it won\'t.' };
  }
  if (rank === 'B') {
    return { move: null, headline: 'One more set here.',
             body: 'You know these — you\'re just still hunting for them. Another set at this level and the hunting stops.' };
  }
  if (rank === 'C') {
    return { move: null, headline: 'Stay put, and try Practice.',
             body: 'This level isn\'t settled yet. Practice mode is endless and unscored — sit in it for a bit, then come back and test.' };
  }
  return bottom
    ? { move: null, headline: 'Practice, not sets.',
        body: 'This is the ground floor, so there\'s nowhere to drop to. Run Practice until the naturals come without thinking, then test again.' }
    : { move: TIERS[idx - 1], headline: `Drop back to ${TIER_LABEL[TIERS[idx - 1]]}.`,
        body: 'No shame in it — this level is faster than your neck knowledge right now. Build the floor first and this one gets easy.' };
}

// ── Best-rank-per-level persistence ─────────────────────────────────────────
// Deliberately stores the BEST rank ever achieved, not the most recent. This
// number's job is to make the ladder feel like something you're climbing; a
// display that drops every time you have an off night does the opposite.
const RANKS_LS = 'rlsw.practice.neck.ranks';
function loadRanks() {
  try { const r = JSON.parse(localStorage.getItem(RANKS_LS)); return (r && typeof r === 'object') ? r : {}; }
  catch { return {}; }
}
function saveBestRank(tier, rank) {
  try {
    const all = loadRanks();
    const prev = all[tier];
    if (prev && RANK_ORDER.indexOf(prev) >= RANK_ORDER.indexOf(rank)) return all;
    const next = { ...all, [tier]: rank };
    localStorage.setItem(RANKS_LS, JSON.stringify(next));
    return next;
  } catch { return loadRanks(); }
}

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
  // 🚪 screen — 'menu' (pick a level + a mode) | 'run' (playing) | 'results'
  //    (a finished Live Set). Practice never reaches 'results'; it has no end.
  const [screen, setScreen]         = useState('menu');
  const [mode, setMode]             = useState('practice'); // 'practice' | 'live'
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
  const [micActive, setMicActive]   = useState(false);
  const [micError, setMicError]     = useState(null);
  const [micLevel, setMicLevel]     = useState(null); // { db, state, freq?, confidence? }
  const [bestRanks, setBestRanks]   = useState(loadRanks);
  const [setResult, setSetResult]   = useState(null);   // filled in when a Live Set ends

  // 📋 The set in progress. A ref rather than state because finishPrompt writes
  // it from inside a timing-sensitive path and then immediately reads it back to
  // decide whether the set is over — a state update wouldn't have landed yet.
  const setLogRef = useRef([]);   // [{ grade, ms, found }]

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
  const modeRef = useRef(mode);
  const foundCellsRef = useRef(new Set()); // for VIRTUOSO find-all

  tierRef.current = tier;
  streakRef.current = streak;
  rigRef.current = rig;
  phaseRef.current = phase;
  hmRef.current = heatmap;
  modeRef.current = mode;

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
    setPhase('active');
  }, []);

  // ▶️ Begin a run at the level the player chose. This is the ONLY place `tier`
  // is written during play, and it's driven by an explicit click on the menu —
  // which is the whole "don't change levels mid-set" rule, enforced structurally
  // rather than by remembering not to.
  function startRun(nextMode, nextTier) {
    setMode(nextMode);
    setTier(nextTier);
    tierRef.current = nextTier;
    modeRef.current = nextMode;
    setLogRef.current = [];
    promptRef.current = null;
    setPromptCount(0);
    setStreak(0);
    streakRef.current = 0;
    setSetResult(null);
    setShowHeatmap(false);
    setScreen('run');
    launchPrompt();
  }

  // ── ESC ─────────────────────────────────────────────────────────────────
  // Backs out one layer at a time rather than dumping straight to the lobby.
  // Bailing mid-Live-Set discards it: a partial set has no rank, and silently
  // scoring 6 of 15 prompts would poison the best-rank record.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (screen === 'run' || screen === 'results') { setScreen('menu'); setPhase('idle'); }
      else onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, screen]);

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

    // Streak is a flourish now, not a mechanism. It shows the player they're on
    // a roll; it does NOT move them to another level. See the header.
    const isGood = g === 'perfect' || g === 'good';
    const newStreak = isGood ? streakRef.current + 1 : 0;
    streakRef.current = newStreak;
    setStreak(newStreak);

    // ── 🎤 LIVE SET accounting ────────────────────────────────────────────
    // Practice logs nothing: it's unscored by design, so there is deliberately
    // no running grade for the player to feel judged by while they're just
    // learning the neck. (The per-cell heatmap above still records in BOTH
    // modes — that's the spaced-repetition data, not a score.)
    if (modeRef.current === 'live') {
      setLogRef.current = [...setLogRef.current, { grade: g, ms, found: g !== 'fumbled' }];
      if (setLogRef.current.length >= LIVE_SET_LENGTH) {
        finishSet();
        return;   // ⛔ do NOT queue another prompt — the set is over
      }
    }

    // Auto-advance
    setTimeout(() => {
      if (phaseRef.current !== 'result') return;
      launchPrompt();
    }, 1200);
  }

  // ── 🏁 End of a Live Set ────────────────────────────────────────────────
  function finishSet() {
    const log = setLogRef.current;
    const total = log.length;
    const found = log.filter(e => e.found).length;
    const avgMs = total ? log.reduce((s, e) => s + e.ms, 0) / total : 0;
    const { score, rank, accuracy } = scoreSet({ found, total, avgMs });
    const tally = { perfect: 0, good: 0, ok: 0, fumbled: 0 };
    log.forEach(e => { tally[e.grade] = (tally[e.grade] ?? 0) + 1; });

    const ranTier = tierRef.current;
    const prevBest = bestRanks[ranTier] ?? null;
    const improved = !prevBest || RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf(prevBest);
    setBestRanks(saveBestRank(ranTier, rank));

    setSetResult({
      tier: ranTier, rank, score, accuracy, avgMs, found, total, tally,
      prevBest, improved,
      rec: recommendFor(ranTier, rank),
    });
    // ⚠️ Phase stays 'result' through the pause, NOT 'idle'. The last prompt's
    // grade and the "THAT'S THE SET" line are both gated on 'result', so
    // clearing it here would blank the card for the 700 ms before the verdict
    // lands. Taps are already ignored — handleTap gates on 'active'.
    setTimeout(() => { setScreen('results'); setPhase('idle'); }, 900);
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

  // ─── 🚪 MENU — pick a level, then pick what you're doing at it ────────────
  // Level first, mode second, deliberately: the level is the decision that
  // shapes the session, and showing every level's best rank next to it is what
  // makes "where do I stand" answerable before you've played anything.
  if (screen === 'menu') {
    return (
      <div style={S.root}>
        <div style={{ ...S.hud, position: 'static', marginTop: 22, width: '100%',
                      maxWidth: 620, padding: '0 16px', boxSizing: 'border-box' }}>
          <div>
            <div style={S.hudLabel}>FRETBOARD RECON</div>
            <div style={{ ...S.hudTier, fontSize: 13 }}>PICK YOUR LEVEL</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={S.hudStat}>Neck mastery: {mastery}%</div>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: 620, padding: '18px 16px 0', boxSizing: 'border-box',
                      display: 'flex', flexDirection: 'column', gap: 7 }}>
          {TIERS.map(t => {
            const on = t === tier;
            const best = bestRanks[t];
            const bestRank = best ? RANK_BY_ID[best] : null;
            return (
              <button key={t} onClick={() => setTier(t)} title={TIER_BLURB[t]}
                style={{
                  fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 7,
                  background: on ? `${ACCENT}12` : '#080f1e',
                  border: `1px solid ${on ? ACCENT : '#152538'}`,
                  color: on ? ACCENT : '#7a97b5', transition: 'all .15s',
                }}>
                <span style={{ fontSize: 13, letterSpacing: 1, minWidth: 132, flexShrink: 0 }}>
                  {TIER_LABEL[t]}
                </span>
                <span style={{ fontSize: 9, lineHeight: 1.5, color: on ? '#9fd8ea' : '#4a6a8a', flex: 1 }}>
                  {TIER_BLURB[t]}
                </span>
                {/* Best rank ever set here — the ladder made visible. Absent
                    rather than zeroed when unplayed: an empty slot invites,
                    a "D" would just look like a failure you haven't earned. */}
                <span style={{
                  flexShrink: 0, minWidth: 42, textAlign: 'center',
                  fontSize: bestRank ? 15 : 9,
                  color: bestRank ? bestRank.color : '#2a3f56',
                  textShadow: bestRank ? `0 0 12px ${bestRank.color}66` : 'none',
                }} title={bestRank ? `Best Live Set rank here: ${bestRank.id} — ${bestRank.label}` : 'No Live Set run here yet'}>
                  {bestRank ? bestRank.id : '—'}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ width: '100%', maxWidth: 620, padding: '20px 16px 0', boxSizing: 'border-box',
                      display: 'flex', gap: 10 }}>
          <button onClick={() => startRun('practice', tier)}
            title="Endless prompts at this level. Nothing is scored and the level never moves."
            style={{ ...S.modeBtn, borderColor: NEON_GREEN, color: NEON_GREEN }}>
            <div style={{ fontSize: 14, letterSpacing: 1.5 }}>🔁 PRACTICE</div>
            <div style={{ fontSize: 8.5, color: '#5f8f76', marginTop: 5, lineHeight: 1.5 }}>
              Endless. Unscored. Stay as long as you like.
            </div>
          </button>
          <button onClick={() => startRun('live', tier)}
            title={`${LIVE_SET_LENGTH} prompts at this level, then a ranked verdict and a recommendation.`}
            style={{ ...S.modeBtn, borderColor: ACCENT, color: ACCENT }}>
            <div style={{ fontSize: 14, letterSpacing: 1.5 }}>🎤 LIVE SET</div>
            <div style={{ fontSize: 8.5, color: '#5f8296', marginTop: 5, lineHeight: 1.5 }}>
              {LIVE_SET_LENGTH} prompts, one rank, one honest verdict.
            </div>
          </button>
        </div>

        <div style={{ marginTop: 16, fontSize: 8, color: '#33506d', letterSpacing: 1.4, textAlign: 'center' }}>
          THE LEVEL NEVER CHANGES MID-SET — YOU MOVE IT, NOBODY ELSE
        </div>

        <div style={S.bottomBar}>
          <RigPicker rig={rig} onCycle={cycleRig} accent={ACCENT} />
          <button onClick={onBack} style={S.lobbyBtn}>← LOBBY</button>
        </div>
      </div>
    );
  }

  // ─── 🏁 RESULTS — the verdict, then a suggestion with a button beside it ──
  if (screen === 'results' && setResult) {
    const r = setResult;
    const rk = RANK_BY_ID[r.rank];
    const recTier = r.rec.move;
    return (
      <div style={S.root}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', width: '100%', maxWidth: 560, padding: '0 16px' }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: '#3a5a7a' }}>LIVE SET COMPLETE</div>
          <div style={{ fontSize: 12, letterSpacing: 1.5, color: '#7a97b5', marginTop: 6 }}>
            {TIER_LABEL[r.tier]}
          </div>

          <div style={{ fontSize: 78, lineHeight: 1, marginTop: 12, color: rk.color,
                        textShadow: `0 0 34px ${rk.color}66` }}>{rk.id}</div>
          <div style={{ fontSize: 12, letterSpacing: 3, color: rk.color, marginTop: 2 }}>{rk.label}</div>
          {r.improved && (
            <div style={{ fontSize: 9, letterSpacing: 1.6, color: '#ffd166', marginTop: 8 }}>
              ★ NEW BEST AT THIS LEVEL{r.prevBest ? ` (WAS ${r.prevBest})` : ''}
            </div>
          )}

          <div style={{ display: 'flex', gap: 22, marginTop: 20, fontSize: 10, color: '#7a97b5' }}>
            <span title="Prompts you found, out of the set.">
              FOUND <b style={{ color: '#cfe6f5' }}>{r.found}/{r.total}</b>
            </span>
            <span title="Average time per prompt across the whole set.">
              AVG <b style={{ color: '#cfe6f5' }}>{(r.avgMs / 1000).toFixed(2)}s</b>
            </span>
            <span title="Perfect / Good / OK / Fumbled">
              <b style={{ color: ACCENT }}>{r.tally.perfect}</b>·
              <b style={{ color: NEON_GREEN }}>{r.tally.good}</b>·
              <b style={{ color: '#f6ad55' }}>{r.tally.ok}</b>·
              <b style={{ color: '#ff4466' }}>{r.tally.fumbled}</b>
            </span>
          </div>

          {/* 💬 THE RECOMMENDATION. Phrased as advice and rendered as advice —
              the "take it" button sits next to "run it again" and "pick another
              level", all three the same size. Nothing is pre-selected. */}
          <div style={{ marginTop: 24, width: '100%', background: '#080f1e',
                        border: '1px solid #152538', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: '#3a5a7a', marginBottom: 7 }}>
              💬 PICKLES RECKONS — TAKE IT OR LEAVE IT
            </div>
            <div style={{ fontSize: 13, color: '#e0f0ff', letterSpacing: 0.5 }}>{r.rec.headline}</div>
            <div style={{ fontSize: 9.5, color: '#7a97b5', lineHeight: 1.65, marginTop: 6 }}>{r.rec.body}</div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
            {recTier && (
              <button onClick={() => startRun('live', recTier)} style={{ ...S.resultBtn, borderColor: ACCENT, color: ACCENT }}>
                {TIERS.indexOf(recTier) > TIERS.indexOf(r.tier) ? '⬆' : '⬇'} {TIER_LABEL[recTier]}
              </button>
            )}
            <button onClick={() => startRun('live', r.tier)} style={S.resultBtn}>🎤 RUN IT AGAIN</button>
            <button onClick={() => startRun('practice', r.tier)} style={S.resultBtn}>🔁 PRACTICE HERE</button>
            <button onClick={() => setScreen('menu')} style={S.resultBtn}>📋 ALL LEVELS</button>
          </div>
        </div>
        <div style={S.bottomBar}>
          <span style={{ fontSize: 8, color: '#33506d', letterSpacing: 1.4 }}>ESC — BACK TO LEVELS</span>
          <button onClick={onBack} style={S.lobbyBtn}>← LOBBY</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.root}>
      {/* ── HUD ── */}
      <div style={S.hud}>
        <div>
          <div style={S.hudLabel}>
            {mode === 'live' ? '🎤 LIVE SET' : '🔁 PRACTICE'}
          </div>
          {/* The level is stated plainly and never changes while this screen is
              up. That stability IS the feature — see the file header. */}
          <div style={S.hudTier}>{TIER_LABEL[tier]}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {streak > 0 && <div style={S.streak}>🔥 {streak}</div>}
          {mode === 'live'
            ? <div style={{ ...S.hudStat, color: ACCENT }}>{setLogRef.current.length}/{LIVE_SET_LENGTH}</div>
            : <div style={S.hudStat}>Prompts: {promptCount}</div>}
          <div style={S.hudStat}>Mastery: {mastery}%</div>
        </div>
      </div>

      {/* 🎤 Set progress — one pip per prompt, coloured by grade as they land.
          Practice has no bar because Practice has no end to progress toward. */}
      {mode === 'live' && (
        <div style={{ position: 'absolute', top: 62, left: 0, right: 0, zIndex: 10,
                      display: 'flex', gap: 3, justifyContent: 'center' }}>
          {Array.from({ length: LIVE_SET_LENGTH }, (_, i) => {
            const e = setLogRef.current[i];
            return (
              <span key={i} style={{
                width: 13, height: 4, borderRadius: 2,
                background: e ? gradeColor[e.grade] : '#152538',
                boxShadow: e ? `0 0 6px ${gradeColor[e.grade]}77` : 'none',
              }}/>
            );
          })}
        </div>
      )}

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
            {/* ⚠️ The old "⬆ TIER UP / ⬇ TIER DOWN" banners lived here and are
                GONE with the mechanic that produced them. Nothing promotes or
                demotes mid-run any more — see the file header. */}
            {mode === 'live' && setLogRef.current.length >= LIVE_SET_LENGTH && (
              <div style={{ fontSize: 11, color: ACCENT, marginTop: 8, letterSpacing: 2 }}>
                THAT'S THE SET —
              </div>
            )}
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
                <div style={{ position: 'relative', width: 48, height: 6, background: '#0a1020', borderRadius: 3, border: '1px solid #1a2a40', overflow: 'hidden' }}
                  title={`Notes only register above the gate (${MIC_DEFAULTS.gateDb} dB) — play a little louder than the room.`}>
                  <div style={{ width: `${pct * 100}%`, height: '100%', background: stateColor, borderRadius: 3, transition: 'width .05s, background .15s' }} />
                  {/* gate marker — the level a pluck has to clear */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${Math.max(0, Math.min(1, (MIC_DEFAULTS.gateDb + 60) / 50)) * 100}%`,
                    width: 1, background: '#8899aa', opacity: 0.8,
                  }} />
                </div>
                <span style={{ fontSize: 8, color: stateColor, minWidth: 50 }}>{stateLabel}</span>
              </div>
            );
          })()}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Leaving a Live Set early throws it away rather than part-scoring
              it — say so on the button, so nobody discovers it the hard way. */}
          <button onClick={() => { setScreen('menu'); setPhase('idle'); }}
            title={mode === 'live'
              ? 'Back to the level list. This set is discarded — a partial set has no rank.'
              : 'Back to the level list.'}
            style={S.smallBtn}>
            ← {mode === 'live' ? 'ABANDON SET' : 'LEVELS'}
          </button>
          <button onClick={onBack} style={S.lobbyBtn}>← LOBBY</button>
        </div>
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
  // The two mode buttons are deliberately the SAME SIZE and weight. Practice is
  // not a warm-up for the "real" mode — for a player learning the neck it's the
  // more useful of the two, and the layout shouldn't imply otherwise.
  modeBtn: {
    flex: 1, fontFamily: "'Saira Stencil One', sans-serif", cursor: 'pointer',
    textAlign: 'left', padding: '14px 16px', borderRadius: 8,
    background: '#080f1e', border: '1px solid', transition: 'all .15s',
  },
  resultBtn: {
    fontFamily: "'Saira Stencil One', sans-serif",
    fontSize: 10, letterSpacing: 1.2, cursor: 'pointer',
    padding: '9px 14px', borderRadius: 6,
    background: '#080f1e', border: '1px solid #24384e', color: '#8fb0c8',
    transition: 'all .15s',
  },
};
