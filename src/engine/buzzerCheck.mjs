// ─── ⏱️🎸 THE BUZZER, AND THE SCOREBOARD'S SCALE ─────────────────────────────
//
// 🚨 WHAT THIS SUITE EXISTS TO STOP HAPPENING AGAIN.
// Between 2026-09-15 and 2026-09-16 the engine defaulted every match to Battle
// of the Bands while the CLIENT still crowned a Legend on `startingLives ×
// fpPerLife` — a Fame target the mode had removed. Nothing was red. The engine
// suites all passed, because the engine was right; the client had quietly
// computed its own answer to "what wins here", and no suite compared the two.
//
// 🎯 SO THESE ASSERT THE CONTRACT THE CLIENT NOW LEANS ON, not the client's own
// code: that the Fame crown is UNREACHABLE in a score game, that the buzzer
// fires exactly once and only after the last round is played out in full, and
// that the scoreboard always has a finite scale to draw against.
//
//   node --import ./src/engine/testAssetStub.mjs src/engine/buzzerCheck.mjs
import assert from "node:assert";
import { makeInitialState } from "./state.js";
import { fameToWin, roundLimitFor, buzzerReached, buzzerVerdict, famePerTurnCap } from "./systems/battleFlow.js";
import { fameScaleFor, ROUND_LIMIT_CHOICES, ROUND_LIMIT_DEFAULT, fpPerLife } from "../data/gameConstants.js";

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };

const SPIRITS = [
  { id:'cosmic_ronin',      name:'Shredding Ronin',   corner:'blue',   num:12, vibe:15, maxVibe:15, speed:5, facing:0 },
  { id:'intergalactic_0',   name:'Intergalactic 0',   corner:'purple', num:44, vibe:12, maxVibe:12, speed:4, facing:0 },
  { id:'Metalness_Monster', name:'Metalness Monster', corner:'yellow', num:28, vibe:15, maxVibe:15, speed:4, facing:0 },
  { id:'Glamarchy',         name:'Glamarchy',         corner:'pink',   num:60, vibe:12, maxVibe:12, speed:5, facing:0 },
];
const st = (over = {}, count = 2) =>
  makeInitialState({ spirits: SPIRITS.slice(0, count), startingLives: 3, ...over }, 7);

// ═══ 1. THE DEFAULT IS BATTLE OF THE BANDS, AND IT HAS NO TARGET ════════════
{
  const s = st();
  eq(s.config.winCondition, 'rounds', '🎸 an unspecified match is Battle of the Bands');
  eq(s.config.elimination, 'off', '…with elimination off, the documented pairing');
  eq(roundLimitFor(s), ROUND_LIMIT_DEFAULT, '…and a real round limit');

  /* 🚨 THE ASSERTION THAT WOULD HAVE CAUGHT THE BUG. The client compared a
     player's Fame against its OWN computed target and crowned them. Infinity is
     what makes every such comparison false, so a crowning path that reads the
     engine cannot fire here no matter how much Fame is banked. */
  eq(fameToWin(s), Infinity, '🚨 no Fame total can win a score game — the target is Infinity');
  for (const fame of [18, 24, 100, 10_000, Number.MAX_SAFE_INTEGER]) {
    ok(!(fame >= fameToWin(s)), `⭐${fame} does NOT crown anybody in Battle of the Bands`);
  }
}

// ═══ 2. LEGEND RUN SURVIVES, FINISH LINE AND ALL ════════════════════════════
{
  const s = st({ winCondition: 'fame' });
  eq(s.config.winCondition, 'fame', '🏆 Legend Run is still selectable');
  eq(s.config.elimination, 'on', '…and still pairs with elimination on');
  eq(roundLimitFor(s), null, '…and has no clock');
  eq(fameToWin(s), 3 * fpPerLife(2), '…and its target is `lives × fpPerLife`, the rule');
  ok(Number.isFinite(fameToWin(s)), '…which is a real number a finish line can be drawn at');
}

// ═══ 3. THE BUZZER IS `>`, NOT `>=` — THE OFF-BY-ONE THAT EATS A ROUND ══════
{
  const s = st();
  const limit = roundLimitFor(s);
  const at = (round) => buzzerReached({ ...s, turn: { ...s.turn, round } });

  for (let r = 1; r <= limit; r++) {
    ok(!at(r), `round ${r}/${limit} — still playing`);
  }
  /* ⚠️ `turn.round` increments as a revolution CLOSES, so `round > limit` means
     the last round was played out IN FULL and every seat had the same number of
     turns. `>=` would end the match with the final round unplayed — and in a
     4-player game that is four whole turns, one of them somebody's last chance. */
  ok(at(limit + 1), `round ${limit + 1} — the buzzer goes`);
  ok(at(limit + 5), 'and it stays gone (idempotent, so the end screen cannot un-fire)');

  eq(buzzerReached(st({ winCondition: 'fame' })), false,
     '🏆 Legend Run never reaches a buzzer — it has no limit to pass');
  for (const rl of ROUND_LIMIT_CHOICES) {
    const s2 = st({ roundLimit: rl });
    eq(roundLimitFor(s2), rl, `⏳ the lobby's ${rl}-round choice reaches the engine`);
    ok(!buzzerReached({ ...s2, turn: { ...s2.turn, round: rl } }), `…and ${rl} rounds means ${rl} played`);
    ok(buzzerReached({ ...s2, turn: { ...s2.turn, round: rl + 1 } }), `…then stops`);
  }
}

// ═══ 4. THE VERDICT NAMES THE RUNG — AND A DRAW IS A REAL ENDING ════════════
{
  const board = ({ fame, diehards, dealt, taken }, count = 2) => {
    const s = st({}, count);
    const ids = s.spirits.map(x => x.id);
    return {
      ...s,
      noteStates: Object.fromEntries(ids.map((id, i) => [id,
        { ...(s.noteStates?.[id] ?? {}), fame: fame[i], diehards: diehards?.[i] ?? 2 }])),
      damageLedger: Object.fromEntries(ids.map((id, i) =>
        [id, { dealt: dealt?.[i] ?? 0, taken: taken?.[i] ?? 0 }])),
    };
  };

  let v = buzzerVerdict(board({ fame: [30, 12] }));
  eq(v.decidedOn, 'fame', '⭐ most Fame takes it');
  eq(v.winnerId, 'cosmic_ronin', '…and names the band');
  eq(v.tied, [], '…with nobody tied');

  v = buzzerVerdict(board({ fame: [20, 20], diehards: [2, 6] }));
  eq(v.decidedOn, 'diehards', '🎤 level on Fame → the hardcore decide');
  eq(v.winnerId, 'intergalactic_0', '…and the bigger core wins it');

  v = buzzerVerdict(board({ fame: [20, 20], diehards: [4, 4], dealt: [9, 2], taken: [2, 9] }));
  eq(v.decidedOn, 'net', '💥 level on both → net damage decides');
  eq(v.winnerId, 'cosmic_ronin', '…the band that did the hitting');

  /* ⚖️ THE DRAW, WHICH IS WHY THE END SCREEN CANNOT BE GATED ON `winner`.
     `winnerId` is null here and the match is still completely over. A client
     that only watches `winner` leaves the board live forever. */
  v = buzzerVerdict(board({ fame: [7, 7], diehards: [3, 3], dealt: [4, 4], taken: [4, 4] }));
  eq(v.winnerId, null, '⚖️ a dead heat crowns nobody…');
  eq(v.decidedOn, null, '…on no rung…');
  eq(v.tied.length, 2, '…and names both bands instead');
  ok((v.standings ?? []).length === 2, '…with full standings either way');

  v = buzzerVerdict(board({ fame: [40, 9, 22, 31] }, 4));
  eq(v.standings.length, 4, '📊 standings carry every seat at the table');
  eq(v.winnerId, 'cosmic_ronin', '…and 4P resolves the same way');
}

// ═══ 5. THE SCOREBOARD ALWAYS HAS A FINITE SCALE ════════════════════════════
{
  /* 📏 `ui/FameRace.jsx` maps every blip through this. If it were ever Infinity
     the whole pack would collapse onto 0 and the strip would show one blip at
     the start line all match. */
  for (const P of [2, 3, 4]) {
    for (const rl of ROUND_LIMIT_CHOICES) {
      const v = fameScaleFor(P, rl);
      ok(Number.isFinite(v) && v > 0, `📏 ${P}P/${rl}r → a real scale (⭐${v})`);
      eq(v % 5, 0, '…rounded to 5s, so it reads as furniture');
    }
  }
  ok(fameScaleFor(3, 20) > fameScaleFor(3, 10), '📈 longer match ⇒ bigger scale');
  ok(fameScaleFor(3, 10) > fameScaleFor(4, 10), '🎤 3P outscores 4P — measured, not assumed');
  ok(fameScaleFor(4, 10) < fameScaleFor(2, 10), '…and 4P is the lowest of the three');

  /* ⚠️ A scale keyed on player count MUST cope with counts nobody measured —
     a spectator seat, a future 5-player table — rather than returning
     undefined and painting NaN% into a style string. */
  for (const P of [0, 1, 5, 9, undefined, null]) {
    const v = fameScaleFor(P, 10);
    ok(Number.isFinite(v) && v > 0, `🛟 unmeasured player count ${String(P)} still yields ⭐${v}`);
  }
  ok(Number.isFinite(fameScaleFor(4)), '🛟 …and the round limit defaults rather than vanishing');

  /* 📏 THE EXPONENT IS THE POINT, SO ASSERT IT TIGHTLY ENOUGH TO FEEL ITS
     LOSS. ⚠️ A first draft of this allowed 2.0–3.0 and a mutant that flattened
     the curve to a flat per-round RATE sailed straight through at 2.14 — the
     assertion was decorative. Measured leaders roughly 2.5× their 10-round
     score by round 20 (37→96 at 2P, 47→105 at 3P) because fans accumulate and
     the crowd multiplier compounds; a linear scale lands near 2.1. The band
     below sits above anything linear can reach. */
  for (const P of [2, 3, 4]) {
    const ratio = fameScaleFor(P, 20) / fameScaleFor(P, 10);
    ok(ratio > 2.25 && ratio < 3.0,
       `📈 ${P}P: 20r/10r scale ratio ${ratio.toFixed(2)} — super-linear, not a flat rate`);
  }
}

// ═══ 6. THE MODE CHANGES THE CAP, WHICH IS WHY THE SCALE IS SO BIG ══════════
{
  ok(famePerTurnCap(st()) > famePerTurnCap(st({ winCondition: 'fame' })),
     '🎤 a score game runs on a looser per-turn cap than a race');
}

console.log(`✅ buzzerCheck — ${n} assertions passed`);
