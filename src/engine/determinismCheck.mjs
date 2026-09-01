// ─── DETERMINISM CHECK ───────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/determinismCheck.mjs
//
// THE PROPERTY: same seed ⇒ same game. It is the precondition for replays, for
// the online desync tripwire (clients compare rng cursors frame-by-frame and
// freeze on mismatch), and for the headless bot harness — BOT_STRATEGY_HANDOFF
// §6.6 wants ~2000 seeded matches and "same seed + same state ⇒ identical
// action sequence", which is unmeasurable if the economy draws off Math.random.
//
// WHAT THIS CAUGHT (2026-08-14). Ten rule-bearing draws were using Math.random:
//   · the per-turn stock refill — §1's spine, ~6 draws per spirit-turn
//   · the Shredding Ronin's Lost Chord greed roll AND its bonus notes (§4.1)
//   · the Mic voice roll and the bonus note it grants
//   · the Encore Apocalypse stagger-slot shuffle
//   · the fan flee count on a demolition
//   · the god's displacement hex
// None were reproducible. All now route through RANDOM_BATCH_DRAWN.
//
// ⚠️ THE GUARD BELOW IS THE POINT. Asserting "two runs match" is not enough —
// a seeded run matches itself trivially. Every case here also proves the draw
// is ACTUALLY RANDOM (different seeds give different results), so a regression
// that hardcodes a value can't pass by being boringly constant.

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { makeRng } from "./rng.js";
import { randomNote, refillStock } from "../music/cadence.js";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

/**
 * Assert a seeded draw is BOTH reproducible and genuinely varying.
 * @param {(seed:number)=>any} run  produce a result from a seed
 */
function reproducibleAndRandom(run, label) {
  const a = JSON.stringify(run(1234));
  const b = JSON.stringify(run(1234));
  ok(a === b, `${label}: same seed reproduces`);

  // Different seeds must differ somewhere — otherwise the "reproducible" half
  // is satisfied by a constant and the test is worthless.
  const others = [1, 7, 99, 4242, 31337, 65535].map(sd => JSON.stringify(run(sd)));
  ok(others.some(o => o !== a), `${label}: different seeds actually differ`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. The primitive: randomNote / refillStock respect an injected rng.
//    This is the call the per-turn refill makes. Before the fix its rng
//    argument was simply not passed at the call site.
// ═════════════════════════════════════════════════════════════════════════════
reproducibleAndRandom(
  seed => { const r = makeRng(seed); return Array.from({ length: 8 }, () => randomNote('C', 'major', r)); },
  'randomNote(seeded)',
);
reproducibleAndRandom(
  seed => refillStock('C', 'major', 10, makeRng(seed)),
  'refillStock(seeded)',
);

// ⛔ The regression itself: the DEFAULT is Math.random, and that is fine as a
// default — what matters is that nothing in the rules relies on it. If this
// ever starts passing, randomNote's default changed and the call sites that
// depend on being handed an rng should be re-audited.
{
  const a = Array.from({ length: 8 }, () => randomNote('C', 'major'));
  const b = Array.from({ length: 8 }, () => randomNote('C', 'major'));
  ok(JSON.stringify(a) !== JSON.stringify(b),
     'randomNote with NO rng is still unseeded — rules must never call it that way');
}

// 🪦 §2 was the boss's displacement hex (`freeNeighborHex`, seeded). The Rock God
// was archived on 2026-09-01 and `board/rockGodFx.js` went with it; nothing else
// in the game draws a free neighbour hex, so the two assertions retired rather
// than moving. Numbering left alone so older handoffs still line up.

// ═════════════════════════════════════════════════════════════════════════════
// 3. RANDOM_BATCH_DRAWN — the transport every client-side rule draw now uses.
//    Same seed ⇒ same batch AND same cursor. The cursor is the half that the
//    online tripwire actually compares.
// ═════════════════════════════════════════════════════════════════════════════
const CONFIG = {
  mode: 'ffa', startingLives: 3,
  spirits: [
    { id: 'cosmic_ronin',      name: 'Ronin',     num: 40, corner: 0, facing: 0, vibe: 5, maxVibe: 5 },
    { id: 'intergalactic_0',   name: 'Zero',      num: 41, corner: 1, facing: 0, vibe: 4, maxVibe: 4 },
    { id: 'Metalness_Monster', name: 'Metalness', num: 55, corner: 2, facing: 0, vibe: 5, maxVibe: 5 },
  ],
};

function drawSequence(seed) {
  let st = makeInitialState(CONFIG, seed);
  const out = [];
  for (const n of [6, 1, 1, 14, 3]) {           // refill, greed roll, mic, stagger, misc
    st = applyAction(st, { type: 'RANDOM_BATCH_DRAWN', count: n });
    out.push(st.lastRandomBatch.map(v => v.toFixed(6)));
  }
  return { draws: out, cursor: st.rng.cursor };
}
reproducibleAndRandom(seed => drawSequence(seed), 'RANDOM_BATCH_DRAWN sequence');

{
  const a = drawSequence(2026), b = drawSequence(2026);
  ok(a.cursor === b.cursor, 'same seed ⇒ identical rng cursor (the online tripwire)');
  ok(a.cursor === 25, `cursor advances by exactly the draws requested (got ${a.cursor}, want 25)`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. The initial deal is seeded — and the whole opening state with it.
//    (This one was ALREADY correct: economy.js passes the forked rng. Pinned so
//    it stays that way.)
// ═════════════════════════════════════════════════════════════════════════════
reproducibleAndRandom(
  seed => {
    const s = makeInitialState(CONFIG, seed);
    return {
      stock:  Object.fromEntries(Object.entries(s.noteStates).map(([k, v]) => [k, v.noteStock])),
      board:  s.board.boardTokens.map(t => t.num),
      charge: s.board.chargeZones.map(z => z.num),
      spot:   s.board.spotlightHex,
    };
  },
  'makeInitialState',
);

// ═════════════════════════════════════════════════════════════════════════════
// 5. Forks are independent AND stable — a subsystem drawing from its own fork
//    can never shift another subsystem's stream (§0.4's whole defence).
// ═════════════════════════════════════════════════════════════════════════════
{
  const parent = makeRng(777);
  const before = parent.state().cursor;
  const search = parent.fork('search');
  Array.from({ length: 50 }, () => search());
  ok(parent.state().cursor === before,
     'forking and draining a fork does NOT advance the parent — search can never desync live play');

  const f1 = makeRng(777).fork('search');
  const f2 = makeRng(777).fork('search');
  ok(f1() === f2(), 'same parent seed + same label ⇒ same fork');
  ok(makeRng(777).fork('search')() !== makeRng(777).fork('events')(),
     'different labels ⇒ different streams');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. THE STATIC GUARD — the only part of this file that watches the client.
//
// Everything above tests the engine primitives, and every one of them PASSED
// while the game was thoroughly non-deterministic: the bug was never in
// randomNote, it was in the ten call sites that didn't hand it an rng. A test
// that can't see the call sites can't see the bug. So this section reads the
// monolith as text.
//
// Yes, source-scanning is crude. It is also the only thing here that would have
// failed on 2026-08-13.
// ═════════════════════════════════════════════════════════════════════════════
{
  const monolith = readFileSync(
    new URL('../rlsw-simulator-v3_8_1.jsx', import.meta.url), 'utf8',
  );

  // ── 6a. Every randomNote call must be handed an rng ──────────────────────
  // Two-argument form == Math.random == a rule nobody can replay.
  //
  // ⚠️ A naive /randomNote\([^)]*\)/ does NOT work here: the third argument is
  // usually an arrow (`() => draw`), so the match stops at the arrow's own close
  // paren and every correct call looks like a two-arg one. Count top-level
  // commas with a depth scan instead.
  const unseeded = [];
  for (let i = monolith.indexOf('randomNote('); i !== -1; i = monolith.indexOf('randomNote(', i + 1)) {
    let depth = 0, commas = 0, j = i + 'randomNote'.length;
    for (; j < monolith.length; j++) {
      const ch = monolith[j];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) break; }
      else if (ch === ',' && depth === 1) commas++;
    }
    const call = monolith.slice(i, j + 1);
    if (call === 'randomNote()') continue;           // the import/definition form
    if (commas < 2) unseeded.push(call.replace(/\s+/g, ' '));
  }
  ok(unseeded.length === 0,
     `every randomNote() in the client must be handed an rng — found ${unseeded.length}: ${unseeded.join(' | ')}`);

  // ── 6b. Pinned Math.random inventory ─────────────────────────────────────
  // 43 remain and every one is PRESENTATION: audio jitter and detune, React
  // keys, die SPIN faces (the landed value comes from the engine), dance names,
  // log-line flavour.
  //
  // 43 → 44 (2026-08-15): 🐙 the Tentacle's FX remount key. It is a React key on
  // a purely cosmetic overlay — the hexes were already spent and the blow
  // already rolled by the time `setTentacleFx` fires, so this draw cannot reach
  // an outcome. The strike itself rolls through `attackRolled` on the seeded
  // stream like every other Swing.
  //
  // 44 → 43 (2026-09-01): the boss taunt draw left with the Rock God. It was the
  // one that picked which line the God spat when he landed — cosmetic, and now
  // there is no God to spit it.
  //
  // This number is pinned ON PURPOSE. If it moves, someone added a draw and has
  // to answer one question: can it change an outcome? If yes it belongs on the
  // seeded stream via drawSeeded/drawSeededInt/drawSeededChance/drawSeededNotes.
  // If it is genuinely cosmetic, bump this number and say so in the commit.
  // A silently-growing count is how the last ten got in.
  const MATH_RANDOM_BUDGET = 43;
  const found = (monolith.match(/Math\.random\(\)/g) ?? []).length;
  ok(found === MATH_RANDOM_BUDGET,
     `Math.random() count changed: ${found} vs pinned ${MATH_RANDOM_BUDGET}. ` +
     `If the new draw can change an outcome it must use the seeded helpers; ` +
     `if it is cosmetic, update MATH_RANDOM_BUDGET.`);

  // ── 6c. The seeded helpers still exist and are actually used ─────────────
  for (const helper of ['drawSeeded', 'drawSeededInt', 'drawSeededChance', 'drawSeededNotes']) {
    const uses = (monolith.match(new RegExp(`\\b${helper}\\(`, 'g')) ?? []).length;
    ok(uses >= 2, `${helper} is defined and called (found ${uses} references)`);
  }
}

console.log(`✅ determinism: ${checks} checks passed`);
