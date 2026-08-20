// 🎤 IS THE ZERO DEFENCE DIE EVER PAID? A posing Spirit rolls no defence die at
// all (`combat.js` — `defTotal` is a flat 0). That is supposed to be the price of
// the pose. This asks whether anybody ever collects it.
//
// ⚠️ DUPLICATES `playTurn`'s INNER LOOP for the same reason `fpledger.mjs` does:
// the fact we need — was the DEFENDER posing at the moment of the attack — is
// gone by the time the turn returns.
import { matchConfig, MAX_TURNS, harnessHooks, startSpiritTurn, POLICIES } from '../src/engine/policies/play.js';
import { applyBotAction } from '../src/engine/policies/transition.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { isPosing, poseRounds } from '../src/engine/systems/limelight.js';
import { HEX_BY_NUM } from '../src/board/hexMap.js';
import { axialDist } from '../src/board/hexGeometry.js';

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
const ATTACKS = new Set(['swing','sonic','riffOff','tentacle']);
const distBuckets = {};           // distance to nearest rival at the moment a pose was struck
let poses = 0, atkOnPoser = 0, atkOnStanding = 0;
let vibeOffPoser = 0, vibeOffStanding = 0;
let poserTurnsExposed = 0;        // rival-turns that began with a poser inside 3 hexes
let poserTurnsTotal = 0;

const nearest = (st, id) => {
  const me = HEX_BY_NUM[st.spirits.find(s => s.id === id)?.num];
  if (!me) return Infinity;
  let d = Infinity;
  for (const r of st.spirits) {
    if (r.id === id || r.knockedOut) continue;
    const rh = HEX_BY_NUM[r.num];
    if (rh) d = Math.min(d, axialDist(me.q, me.r, rh.q, rh.r));
  }
  return d;
};
const vibeOf = (st, id) => {
  const s = st.spirits.find(x => x.id === id);
  return (s?.vibe ?? 0) + 10 * (s?.lives ?? 0);
};

for (const SPIRITS of PAIRS) for (let i = 0; i < 6; i++) {
  const seed = (i * 2654435761 + 999) >>> 0;
  const rng = makeRng(seed);
  let state = makeInitialState(matchConfig(SPIRITS, { startingLives: 3 }), seed);
  const ctx = { rng, hooks: harnessHooks({ rng }) };
  let v = { amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID };
  const policy = POLICIES.searcher({});
  let t = 0;
  while (!state.winner && t < MAX_TURNS && state.acting) {
    state = startSpiritTurn(state, rng);
    const spiritId = state.acting;
    // Was a RIVAL posing when this turn opened, and could this Spirit reach them?
    for (const r of state.spirits) {
      if (r.id === spiritId || r.knockedOut) continue;
      if (!isPosing(state, r.id)) continue;
      poserTurnsTotal++;
      if (nearest(state, r.id) <= 3) poserTurnsExposed++;
    }
    let cur = state; v = { ...v, fameThisTurn: {} };
    let guard = 0, ended = false;
    while (!ended && guard++ < 60) {
      const answer = policy(cur, spiritId, v, ctx) ?? { kind: 'endTurn', apCost: 0 };
      for (const a of (Array.isArray(answer) ? answer : [answer])) {
        if (a.kind === 'pose') { poses++; const d = nearest(cur, spiritId);
          const k = d >= 4 ? '4+' : String(d); distBuckets[k] = (distBuckets[k] ?? 0) + 1; }
        const tgt = a.targetId;
        const wasPosing = ATTACKS.has(a.kind) && tgt ? isPosing(cur, tgt) : false;
        const vBefore = tgt ? vibeOf(cur, tgt) : 0;
        const r = applyBotAction(cur, a, { rng, view: v, hooks: ctx.hooks });
        if (!r.ok) { ended = true; break; }
        cur = r.state; v = r.view ?? v;
        if (ATTACKS.has(a.kind) && tgt) {
          const lost = vBefore - vibeOf(cur, tgt);
          if (wasPosing) { atkOnPoser++; vibeOffPoser += lost; }
          else { atkOnStanding++; vibeOffStanding += lost; }
        }
        if (a.kind === 'endTurn' || cur.winner) { ended = true; break; }
      }
    }
    state = cur; t++;
  }
}

console.log(`18 matches, 3 lives, searcher both seats\n`);
console.log(`🎤 ${poses} poses struck. Distance to the nearest live rival at that moment:`);
for (const [k, n] of Object.entries(distBuckets).sort())
  console.log(`     ${k} hex${k==='1'?'':'es'} away  ${String(n).padStart(4)}  (${(100*n/poses).toFixed(0)}%)`);
console.log(`\n👀 rival turns that OPENED with a poser on the board: ${poserTurnsTotal}`);
console.log(`   ...of those, the poser was within 3 hexes: ${poserTurnsExposed} (${(100*poserTurnsExposed/Math.max(1,poserTurnsTotal)).toFixed(0)}%)`);
console.log(`\n⚔️ attacks thrown at a POSING defender (no defence die):  ${atkOnPoser}  → ${(vibeOffPoser/Math.max(1,atkOnPoser)).toFixed(2)} Vibe+lives each`);
console.log(`⚔️ attacks thrown at a defender who rolled a die:        ${atkOnStanding}  → ${(vibeOffStanding/Math.max(1,atkOnStanding)).toFixed(2)} Vibe+lives each`);
