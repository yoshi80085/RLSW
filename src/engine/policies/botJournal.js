// ─── 🧠 THE BOT JOURNAL ──────────────────────────────────────────────────────
// What the searcher decided, and what it decided it AGAINST.
//
// `searcherPolicy` computes an expected score for every action that survives the
// beam and then throws all of them away but the winner. This file is the shape
// of the entries it emits when handed a `trace` sink, and the pure summary the
// review panel renders. Both live here rather than in the client for the reason
// everything else does: a summary that only exists inside a .jsx cannot be
// tested, and cannot be run over a 300-match bench.
//
// ⚠️ THE SINK MUST BE PURE FROM THE ENGINE'S SIDE. `trace` is called with a plain
// object and its return value is ignored; nothing in the search reads it back.
// `botTraceCheck` pins the consequence that matters — a traced match and an
// untraced match from the same seed play EXACTLY the same game — because a
// journal that changed the thing it was journalling would be worse than none.
//
// ── ENTRY SHAPES ────────────────────────────────────────────────────────────
//
// ACTION PHASE — one per decision:
//   { t:'action', turn, spiritId, ms,
//     legalKinds:[…], legal:n, beamed:n, pruned:n,
//     considered:[{ kind, key, score }],     // every option the search PRICED, best first
//     chosen:{ kind, key }, score,
//     bestPruned:{ kind, key, score } | null // audit mode only — see below
//   }
//
// COMPOSITION PHASE — one per turn:
//   { t:'compose', turn, spiritId, ms,
//     curve:[{ len, score }],                // what each track LENGTH was worth
//     chosen:{ len }, score }
//
// 🎯 `bestPruned` IS THE ONE TO READ FIRST. The beam keeps `limit` actions per
// kind and the rest are never priced at all — so "the ranking threw away the
// winning move" has been unanswerable since the beam shipped. In audit mode the
// pruned options are scored too (and then discarded, so play is unchanged), and
// any decision where `bestPruned.score > score` is a case of the ranking costing
// the bot the position. That is `SEQUENCING.md` §5.E⁗ item 1 with an instrument
// pointed at it.

/** A compact identity for an action — enough to tell two of the same kind apart. */
export function traceKey(a) {
  if (!a) return null;
  return a.targetId ?? a.to ?? a.stockIdx ?? a.skillId ?? a.dest
      ?? (a.facing != null ? `∠${a.facing.toFixed(2)}` : null);
}

/**
 * How close two options have to be before the decision counts as a coin-flip.
 *
 * ⚠️ A STARTING POINT, NOT A MEASUREMENT — the same standing warning as every
 * other number in §5. Position scores are weighted sums in the low tens, so 0.25
 * is "the two moves are worth about the same to it"; if close calls turn out to
 * be 90% of decisions the threshold is wrong, not the bot.
 */
export const JOURNAL_CLOSE_GAP = 0.25;

const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

/**
 * Summarise a journal. Pure; safe on a partial or empty journal.
 *
 * 🎯 `neverChosen` IS §5.A's PREDICTOR, AUTOMATED. That section names the most
 * reliable bug in this repo — the game rewards something, the evaluator has no
 * term for it, so the bot never does it and every suite stays green — and it has
 * been found by hand eight times running. An action that was LEGAL again and
 * again and never once picked is that bug's fingerprint, and this is the column
 * where it shows up without anybody thinking to look.
 */
export function journalSummary(entries) {
  const bySpirit = {};
  const get = (id) => (bySpirit[id] ??= {
    decisions: 0, actionDecisions: 0, composeDecisions: 0,
    chosen: {}, legalSeen: {}, neverChosen: [],
    prunedTotal: 0, prunedMax: 0, consideredTotal: 0,
    closeCalls: 0, rankingCost: 0, rankingCostTotal: 0,
    trackLengths: {}, ms: 0, worstMs: 0,
  });

  for (const e of entries ?? []) {
    const s = get(e.spiritId);
    s.decisions++;
    s.ms += e.ms ?? 0;
    s.worstMs = Math.max(s.worstMs, e.ms ?? 0);

    if (e.t === 'compose') {
      s.composeDecisions++;
      bump(s.chosen, 'confirmMelody');
      if (e.chosen?.len != null) bump(s.trackLengths, e.chosen.len);
      continue;
    }

    s.actionDecisions++;
    for (const k of e.legalKinds ?? []) bump(s.legalSeen, k);
    if (e.chosen?.kind) bump(s.chosen, e.chosen.kind);
    s.prunedTotal += e.pruned ?? 0;
    s.prunedMax = Math.max(s.prunedMax, e.pruned ?? 0);
    s.consideredTotal += (e.considered ?? []).length;

    const top = e.considered ?? [];
    if (top.length >= 2 && Math.abs(top[0].score - top[1].score) < JOURNAL_CLOSE_GAP) s.closeCalls++;

    // 🎯 The beam threw away something better than what it kept.
    if (e.bestPruned && Number.isFinite(e.bestPruned.score) && Number.isFinite(e.score)
        && e.bestPruned.score > e.score) {
      s.rankingCost++;
      s.rankingCostTotal += e.bestPruned.score - e.score;
    }
  }

  for (const s of Object.values(bySpirit)) {
    // ⚠️ `confirmMelody` is deliberately excluded from the never-chosen sweep:
    // the composition phase answers with a whole line rather than through the
    // action-phase beam, so it is legal-and-not-chosen on every action decision
    // by construction. Counting it would put a false positive at the top of the
    // one column that is supposed to be read as a bug report.
    s.neverChosen = Object.keys(s.legalSeen)
      .filter(k => !s.chosen[k] && k !== 'confirmMelody')
      .sort((a, b) => s.legalSeen[b] - s.legalSeen[a]);
    s.meanPruned    = s.actionDecisions ? s.prunedTotal / s.actionDecisions : 0;
    s.meanConsidered= s.actionDecisions ? s.consideredTotal / s.actionDecisions : 0;
    s.meanMs        = s.decisions ? s.ms / s.decisions : 0;
  }
  return bySpirit;
}
