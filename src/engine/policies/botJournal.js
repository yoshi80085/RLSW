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
//     considered:[{ kind, key, score, terms? }], // every option PRICED, best first
//     chosen:{ kind, key }, score,
//     bestPruned:{ kind, key, score } | null // audit mode only — see below
//   }
//   🧠 `terms` rides on the top TWO entries only — see `play.js` for why. It is
//   `evaluate`'s own term vector, averaged over the same samples as the score.
//
// COMPOSITION PHASE — one per turn:
//   { t:'compose', turn, spiritId, ms,
//     curve:[{ len, score }],                // what each track LENGTH was worth
//     steps:[{ i, took:{kind,key}, cands:[{kind,key,score}] }],
//     legalKinds:[…],                        // composition kinds ever on the menu
//     chosenKinds:{ melodyNote:n, stackCommit:n },
//     chosen:{ len }, score, terms }
//
// 🥁 `chosenKinds` AND `legalKinds` ON A COMPOSE ENTRY ARE 2026-08-19's FIX, AND
// THE REASON IS WORTH KEEPING. Until then a compose entry said only how LONG the
// line was, `journalSummary` bumped `chosen` with the literal 'confirmMelody',
// and nothing fed `legalSeen` — so `melodyNote` and `stackCommit` could appear
// in neither `chosen` nor `neverChosen`. The never-chosen sweep, which exists to
// catch exactly "legal again and again, never once picked", was blind to half of
// every turn. That is how a `stackCommit` the search could not reach until the
// melody line was full went 455 offers without being taken and showed up in no
// column of this file's own output.
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
    // 🥁 The composition phase, which used to report nothing but a length.
    composeKinds: {}, composeTurnsWith: {},
    // 🎯 Which terms decide the close calls — see `termSwing` below.
    termSwingTotal: {}, termSwingN: 0,
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
      // 🥁 THE COMPOSITION PHASE, FED INTO THE SAME TWO COLUMNS AS THE ACTION
      // PHASE. `legalSeen` and `chosen` are what `neverChosen` is derived from
      // below, so a composition kind that is offered and never taken now wears
      // the same fingerprint as an action kind that is.
      for (const k of e.legalKinds ?? []) bump(s.legalSeen, k);
      for (const [k, n] of Object.entries(e.chosenKinds ?? {})) {
        s.composeKinds[k] = (s.composeKinds[k] ?? 0) + n;
        if (n > 0) { bump(s.chosen, k); bump(s.composeTurnsWith, k); }
      }
      continue;
    }

    s.actionDecisions++;
    for (const k of e.legalKinds ?? []) bump(s.legalSeen, k);
    if (e.chosen?.kind) bump(s.chosen, e.chosen.kind);
    s.prunedTotal += e.pruned ?? 0;
    s.prunedMax = Math.max(s.prunedMax, e.pruned ?? 0);
    s.consideredTotal += (e.considered ?? []).length;

    const top = e.considered ?? [];
    const close = top.length >= 2 && Math.abs(top[0].score - top[1].score) < JOURNAL_CLOSE_GAP;
    if (close) s.closeCalls++;

    // 🎯 WHICH TERMS MOVED, ON THE TURNS THAT WERE NEARLY COIN FLIPS.
    //
    // A close call is not a problem by itself — two moves really can be worth
    // the same. It is a problem when 58–79% of a match is close calls, because
    // then the whole game is being decided by whatever term happens to twitch,
    // and until now nothing in this repo could say WHICH one. This is that
    // column: the mean absolute per-term difference between the winner and the
    // runner-up, over close calls only.
    //
    // ⚠️ RAW TERMS, NOT WEIGHTED ONES, AND THE DISTINCTION MATTERS. `evaluate`
    // returns each term before its weight is applied, so a big swing here on a
    // term with a small weight is a term that MOVES a lot and DECIDES little.
    // Read this column next to the weight table, never instead of it.
    if (close && top[0]?.terms && top[1]?.terms) {
      for (const k of new Set([...Object.keys(top[0].terms), ...Object.keys(top[1].terms)])) {
        s.termSwingTotal[k] = (s.termSwingTotal[k] ?? 0) + Math.abs((top[0].terms[k] ?? 0) - (top[1].terms[k] ?? 0));
      }
      s.termSwingN++;
    }

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
    // 🥁 Per COMPOSITION turn, not per decision — "how much did it write and how
    // much did it load, in an average turn" is the question the stack bug was.
    s.meanNotes   = s.composeDecisions ? (s.composeKinds.melodyNote  ?? 0) / s.composeDecisions : 0;
    s.meanCommits = s.composeDecisions ? (s.composeKinds.stackCommit ?? 0) / s.composeDecisions : 0;
    // 🎯 Biggest movers first. `[termName, meanAbsDelta]`, close calls only.
    s.termSwing = Object.entries(s.termSwingTotal)
      .map(([k, v]) => [k, v / Math.max(1, s.termSwingN)])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  }
  return bySpirit;
}
