// ⬇ WHY DOES THE JOURNAL DOWNLOAD WRITE 0 BYTES? Reproduce `BotReview`'s
// `payload()` on a real journal and report what JSON.stringify does with it.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { journalSummary } from '../src/engine/policies/botJournal.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
const sp = (ids, hexes, corners) => ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: corners[i], num: hexes[i],
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe,
  speed: SPIRIT_DEFS[id].speed, facing: 0, cpu: true,
}));
const S = sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']);
const journal = [];
const policies = Object.fromEntries(S.map(x => [x.id,
  POLICIES.searcher({ trace: e => journal.push(e), audit: true })]));
runMatch({ seed: 12345, spirits: S, policies, lives: 3 });
console.log('journal entries:', journal.length);
const summary = journalSummary(journal);
try {
  const s = JSON.stringify({ journal, summary }, null, 2);
  console.log('stringify OK, bytes:', s.length);
} catch (e) {
  console.log('❌ stringify THREW:', e.constructor.name, e.message.slice(0, 200));
}
// What does a single entry look like, and does anything non-JSON ride along?
const seen = new Set();
const walk = (v, path, depth = 0) => {
  if (depth > 6 || v == null) return;
  if (typeof v === 'number' && !Number.isFinite(v)) seen.add(`${path} = ${v}`);
  if (typeof v === 'function') seen.add(`${path} = function`);
  if (typeof v === 'bigint') seen.add(`${path} = bigint`);
  if (typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], `${path}.${k}`, depth + 1);
};
for (const e of journal) walk(e, e.t);
console.log('non-JSON-safe values:', [...seen].slice(0, 20));
