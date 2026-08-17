// Is the style→fans engine actually on? And where do they stand now?
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { detectSpiritStyle } from '../src/music/spiritStyle.js';
import { crowdMultiplier } from '../src/board/boardHelpers.js';
import { axialDist } from '../src/board/hexGeometry.js';
import { HEX_BY_NUM } from '../src/board/hexMap.js';

const ids = ['cosmic_ronin', 'Metalness_Monster'];
const spirits = ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: i, num: [1, 91][i], facing: 0,
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe, cpu: true,
}));

let commits = 0; const hits = {}; let perfSum = 0; const dists = {};
const finalMult = [];
for (let i = 0; i < 12; i++) {
  const policies = Object.fromEntries(ids.map(id => [id, (st, sid, v, ctx) => {
    const a = HEX_BY_NUM[st.spirits[0]?.num], b = HEX_BY_NUM[st.spirits[1]?.num];
    if (a && b) { const d = axialDist(a.q, a.r, b.q, b.r); dists[d] = (dists[d] ?? 0) + 1; }
    const p = POLICIES.searcher({})(st, sid, v, ctx);
    const arr = Array.isArray(p) ? p : [p];
    if (arr.some(x => x?.kind === 'confirmMelody')) {
      const line = st.noteStates[sid]?.melodyLine ?? [];
      // the line at the moment of the plan's LAST step is what commits
      const track = arr.filter(x => x.kind === 'melodyNote').map(x => x.note);
      const full = [...line, ...track];
      commits++;
      const s = detectSpiritStyle(sid, full);
      for (const h of s.hits) hits[`${sid}:${h}`] = (hits[`${sid}:${h}`] ?? 0) + 1;
    }
    return p;
  }]));
  const r = runMatch({ seed: 3300 + i, spirits, policies });
  for (const id of ids) {
    const ns = r.fame ? null : null;
  }
}
console.log('commits', commits);
console.log('style hits', JSON.stringify(hits));
console.log('rival distance histogram', JSON.stringify(dists));

