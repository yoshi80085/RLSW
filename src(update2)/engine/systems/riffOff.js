// ─── ENGINE SYSTEM: RIFF-OFF ─────────────────────────────────────────────────
// Phase 4: the multiplayer seam for the falling-notes duel. The engine owns
// the riff DATA and the VERDICT; each client performs locally (gems, timing,
// keystrokes, beam-clash cinematics stay 100% client) and submits a results
// array [{hit, rt, grade, noteIdx}] — exactly how networked riff-offs will
// work. Damage application is combat (Phase 3) and stays client for now.

import {
  generateAttackerRiff, generateDefenderRiff, speedUpRiffRhythm,
  riffDegreesToNotes,
} from "../../riff/riffGeneration.js";

// Grade → weight for the performance score (single source of truth; the
// client imports riffStats from here for its live overlay too).
export const RIFF_GRADE_WEIGHT = { perfect: 1.0, good: 0.7, ok: 0.45, miss: 0, wrong: 0 };
export const RIFF_MARGIN_SCALE = 2.6; // margin = round(scoreGap × this)
export const RIFF_TIE_EPS      = 0.4; // score gaps below this are "too close to call"

// Riff note token pool (mirrors riffGeneration's naturals/sharpables — kept
// here so the engine never imports the Web-Audio module).
const RIFF_NATURALS  = ["a", "b", "c", "d", "e", "f", "g"];
const RIFF_SHARPABLE = new Set(["a", "c", "d", "f", "g"]);

/** Grade-weighted performance stats for one submitted results array. */
export function riffStats(results) {
  const hits  = results.filter(r => r.hit).length;
  const rts   = results.filter(r => r.hit).map(r => r.rt);
  const avgRt = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;
  const score = results.reduce((a, r) => a + (RIFF_GRADE_WEIGHT[r.grade] ?? 0), 0);
  const perfects = results.filter(r => r.grade === "perfect").length;
  const quality  = results.length ? Math.round((score / results.length) * 100) : 0;
  return { hits, avgRt, score: Math.round(score * 100) / 100, perfects, quality };
}

/** Riff Slayer: pick 2–3 defender note indexes to glitch mid-flight. */
function pickGlitchIndexes(defLen, rng) {
  const glitchN = 2 + Math.floor(rng() * 2); // 2 or 3
  const idxPool = Array.from({ length: defLen }, (_, i) => i);
  for (let i = idxPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idxPool[i], idxPool[j]] = [idxPool[j], idxPool[i]];
  }
  return idxPool.slice(0, Math.min(glitchN, defLen)).sort((a, b) => a - b);
}

/** E-Rush: a ghost key per answer note — any pool letter ≠ the real one. */
function pickGhostLetters(notes, rng) {
  const pool = [];
  RIFF_NATURALS.forEach(n => {
    pool.push(n);
    if (RIFF_SHARPABLE.has(n)) pool.push(n.toUpperCase());
  });
  return notes.map(n => {
    const choices = pool.filter(x => x !== n);
    return choices[Math.floor(rng() * choices.length)] ?? n;
  });
}

/** RIFF_OFF_STARTED — generate both riffs + skill modifiers on engine rng. */
export function applyRiffOffStarted(state, { attackerId, defenderId, slayer, eRush }, rng) {
  const atk = generateAttackerRiff(rng);
  const def = generateDefenderRiff(atk, rng);
  const defNotes = riffDegreesToNotes(def.degrees, def.sharps);
  return {
    ...state,
    battle: {
      kind: "riffOff",
      attackerId, defenderId,
      round: 1,
      atkRiff: atk,                    // {degrees, sharps, contour, rhythm}
      defRiff: def,                    // {degrees, sharps, kind, rhythm}
      defGlitch: slayer ? pickGlitchIndexes(def.degrees.length, rng) : [],
      defGhosts: eRush ? pickGhostLetters(defNotes, rng) : null,
      atkResults: null, defResults: null,
      r1: null,
      verdict: null,
    },
  };
}

/** RIFF_RESULTS_SUBMITTED — a performer's results array arrives. */
export function applyRiffResultsSubmitted(state, { role, results }) {
  if (state.battle?.kind !== "riffOff") return state;
  const key = role === "attacker" ? "atkResults" : "defResults";
  return { ...state, battle: { ...state.battle, [key]: results } };
}

/**
 * RIFF_RESOLVED — the verdict. Pure math over the two submitted results
 * arrays (extracted verbatim from Game.riffResolve): quality gap decides;
 * near-mirrors fall to reaction time; Round 2 is sudden death with a
 * fallback to Round 1's edge; only a double dead-heat ties.
 */
export function applyRiffResolved(state) {
  const b = state.battle;
  if (b?.kind !== "riffOff" || !b.atkResults || !b.defResults) return state;
  const round = b.round ?? 1;
  const A = riffStats(b.atkResults);
  const D = riffStats(b.defResults);
  let attackerWon = false, margin = 0, tie = false, decidedBy = "performance";
  const scoreGap = Math.abs(A.score - D.score);
  if (scoreGap >= RIFF_TIE_EPS) {
    attackerWon = A.score > D.score;
    margin = Math.max(1, Math.round(scoreGap * RIFF_MARGIN_SCALE));
  } else if (A.score === 0 && D.score === 0) {
    tie = true;
  } else if (A.avgRt != null && D.avgRt != null && A.avgRt !== D.avgRt) {
    decidedBy   = "reaction";
    attackerWon = A.avgRt < D.avgRt;
    margin      = Math.abs(A.avgRt - D.avgRt) >= 150 ? 2 : 1;
  } else if (A.score !== D.score) {
    attackerWon = A.score > D.score;
    margin = 1;
  } else {
    tie = true;
  }
  if (round >= 2) {
    if (tie && !b.r1?.tie) {
      tie = false;
      attackerWon = !!b.r1?.won;
      decidedBy = "Round 1 edge";
      margin = Math.max(1, b.r1?.margin ?? 1);
    }
    if (!tie) { margin += 1; decidedBy += " · Round 2"; }
  }
  const verdict = { round, attackerWon, margin, tie, decidedBy, atkStats: A, defStats: D };
  return {
    ...state,
    battle: {
      ...b,
      verdict,
      r1: round === 1 ? { won: attackerWon, tie, margin } : b.r1,
    },
  };
}

/** RIFF_ROUND2_STARTED — sudden death: fresh riffs, faster (0.58×), rerolled skill mods. */
export function applyRiffRound2Started(state, _action, rng) {
  const b = state.battle;
  if (b?.kind !== "riffOff") return state;
  const atk = generateAttackerRiff(rng);
  const def = generateDefenderRiff(atk, rng);
  const speed = r => ({ ...r, rhythm: speedUpRiffRhythm(r.rhythm, 0.58) });
  const defNotes = riffDegreesToNotes(def.degrees, def.sharps);
  return {
    ...state,
    battle: {
      ...b,
      round: 2,
      atkRiff: speed(atk),
      defRiff: speed(def),
      // Riff Slayer / E-Rush carry into Round 2 if active in Round 1
      defGlitch: (b.defGlitch?.length ?? 0) > 0
        ? pickGlitchIndexes(def.degrees.length, rng) : [],
      defGhosts: b.defGhosts ? pickGhostLetters(defNotes, rng) : null,
      atkResults: null, defResults: null,
      verdict: null, // r1 kept — the Round-2 resolve may fall back to it
    },
  };
}

/** RIFF_CLOSED — duel over (or aborted): clear the battle slice. */
export function applyRiffClosed(state) {
  if (state.battle?.kind !== "riffOff") return state;
  return { ...state, battle: null };
}
