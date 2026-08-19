// 🧠 DOES THE CLIENT'S TRANSLATION TABLE COVER WHAT THE SEARCHER ACTUALLY PLAYS?
//
// `legalActionsCheck` §16 pins the SET of kinds; this counts the ONES CHOSEN over
// real matches. A kind that is legal once a game and a kind the bot picks every
// turn are the same assertion and very different problems — a gap in the second
// column is a bot that visibly gives up mid-turn in front of a player.
// Run: node --import ./src/engine/testAssetStub.mjs .scratch/clientkinds.mjs 3 10
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { BOT_CLIENT_KINDS, BOT_CLIENT_GAPS } from '../src/engine/policies/bot.js';
const sp = (ids, hexes, corners) => ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: corners[i], num: hexes[i],
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe,
  speed: SPIRIT_DEFS[id].speed, facing: 0, cpu: true,
}));
const PAIRS = [
  sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']),
  sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']),
  sp(['Metalness_Monster','intergalactic_0'],[12,44],['yellow','purple']),
];
const lives = Number(process.argv[2] ?? 3);
const n = Number(process.argv[3] ?? 10);
const chosen = {};
let turnsWithGap = 0, turns = 0;
for (const S of PAIRS) for (let i = 0; i < n; i++) {
  const policies = Object.fromEntries(S.map(x => [x.id, (st, sid, v, ctx) => {
    const p = POLICIES.searcher({})(st, sid, v, ctx);
    const list = Array.isArray(p) ? p : (p ? [p] : []);
    turns++;
    let gapped = false;
    for (const a of list) {
      chosen[a.kind] = (chosen[a.kind] ?? 0) + 1;
      if (!BOT_CLIENT_KINDS.has(a.kind)) gapped = true;
    }
    if (gapped) turnsWithGap++;
    return p;
  }]));
  runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: S, policies, lives });
}
const rows = Object.entries(chosen).sort((a, b) => b[1] - a[1]);
const total = rows.reduce((s, r) => s + r[1], 0);
console.log(`chosen actions: ${total} over ${turns} decisions, ${n * PAIRS.length} matches`);
for (const [k, c] of rows) {
  const tag = BOT_CLIENT_KINDS.has(k) ? '✅ client path' : (BOT_CLIENT_GAPS.has(k) ? '🪦 GAP' : '❌ UNKNOWN');
  console.log(`  ${k.padEnd(14)} ${String(c).padStart(6)}  ${(100 * c / total).toFixed(1).padStart(5)}%  ${tag}`);
}
console.log(`decisions containing a kind with NO client path: ${turnsWithGap}/${turns} (${(100*turnsWithGap/turns).toFixed(2)}%)`);
