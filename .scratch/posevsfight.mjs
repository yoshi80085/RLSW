// 🎤 vs ⚔️ — WHEN THE BOT COULD POSE OR COULD FIGHT, WHAT DID IT PRICE THEM AT?
// §6.6.10's decision dump, run over a whole bench instead of one hand-picked
// turn. The journal's `considered` array already carries every priced option, so
// this needs no new machinery: find the decisions where BOTH were on the table
// and read the gap.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
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
const journal = [];
for (const S of PAIRS) for (let i = 0; i < 6; i++) {
  const policies = Object.fromEntries(S.map(x => [x.id,
    POLICIES.searcher({ trace: e => journal.push(e), audit: false })]));
  runMatch({ seed: (i * 2654435761 + 999) >>> 0, spirits: S, policies, lives: 3 });
}
const ATTACK = new Set(['swing','sonic','riffOff','tentacle','eleven']);
const best = (list, pred) => list.filter(pred).reduce((m, e) => (!m || e.score > m.score ? e : m), null);

const rows = [];
for (const e of journal) {
  if (e.t !== 'action' || !e.considered?.length) continue;
  const pose = best(e.considered, c => c.kind === 'pose');
  const atk  = best(e.considered, c => ATTACK.has(c.kind));
  const end  = best(e.considered, c => c.kind === 'endTurn');
  if (!pose || !atk) continue;
  rows.push({ spiritId: e.spiritId, pose: pose.score, atk: atk.score, atkKind: atk.kind,
    end: end?.score ?? null, chosen: e.chosen?.kind ?? null, top: e.score });
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
// ⚠️ MEDIAN, NOT MEAN, and the first run of this probe is why: one option was
// priced in the millions and another at -Infinity, and a mean of either is a
// reading of the outlier rather than of the game.
const med = (xs) => { const a = xs.filter(Number.isFinite).sort((x,y)=>x-y); return a.length ? a[a.length>>1] : NaN; };
{
  const all = rows.map(r => r.atk);
  const bad = all.filter(x => !Number.isFinite(x)).length;
  const huge = all.filter(x => Number.isFinite(x) && Math.abs(x) > 100);
  console.log(`\n\u26a0\ufe0f PRICING ANOMALIES on the best attack in each of those ${rows.length} decisions:`);
  console.log(`   non-finite (-Infinity): ${bad}`);
  console.log(`   |score| > 100:          ${huge.length}${huge.length ? '  e.g. ' + huge.slice(0,5).map(x=>x.toFixed(1)).join(', ') : ''}`);
  const allp = rows.map(r => r.pose);
  console.log(`   same two, for the best POSE: ${allp.filter(x=>!Number.isFinite(x)).length} non-finite, ${allp.filter(x=>Number.isFinite(x)&&Math.abs(x)>100).length} over 100\n`);
}
console.log(`${journal.filter(e=>e.t==='action').length} action decisions; ${rows.length} where a POSE and an ATTACK were both legal\n`);
const bySeat = {};
for (const r of rows) (bySeat[r.spiritId] ??= []).push(r);
for (const [id, rs] of Object.entries(bySeat)) {
  const gap = rs.map(r => r.pose - r.atk);
  const chose = {};
  for (const r of rs) chose[r.chosen] = (chose[r.chosen] ?? 0) + 1;
  console.log(`${id}  — ${rs.length} such decisions`);
  console.log(`   best pose priced   ${mean(rs.map(r=>r.pose)).toFixed(3)}`);
  console.log(`   best attack priced ${mean(rs.map(r=>r.atk)).toFixed(3)}`);
  console.log(`   endTurn priced     ${mean(rs.filter(r=>r.end!=null).map(r=>r.end)).toFixed(3)}`);
  console.log(`   🎤 pose − ⚔️ attack  ${mean(gap) >= 0 ? '+' : ''}${mean(gap).toFixed(3)}   (pose priced higher in ${(100*gap.filter(g=>g>0).length/gap.length).toFixed(0)}% of them)`);
  console.log(`   actually chose: ${Object.entries(chose).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`).join(', ')}\n`);
}
