// 🔬 §6.6.8 — WHY DOES A POSE NOT PAY? Drives the match loop by hand so every
// turn boundary is visible: who posed, where they stood at each turn end, and
// what took the pose away.
import { runMatch, POLICIES, startSpiritTurn, playTurn, harnessHooks, MAX_TURNS } from '../src/engine/policies/play.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { LIMELIGHT_HEX } from '../src/data/gameConstants.js';

const sp = (ids, hexes, corners) => ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: corners[i], num: hexes[i],
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe,
  speed: SPIRIT_DEFS[id].speed, facing: 0, cpu: true,
}));
const SEATS = sp(['cosmic_ronin', 'intergalactic_0'], [12, 44], ['blue', 'purple']);
const W = Number(process.argv[2] ?? 1.2);
const SEED = Number(process.argv[3] ?? 0);

const rng = makeRng((SEED * 2654435761 + 12345) >>> 0);
const config = { mode: 'ffa', startingLives: 2, spirits: structuredClone(SEATS) };
let state = makeInitialState(config, (SEED * 2654435761 + 12345) >>> 0);
const ctx = { rng, hooks: harnessHooks({ rng }) };
const policies = Object.fromEntries(SEATS.map(x => [x.id, POLICIES.searcher({})]));
let v = { amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID,
          weightOverrides: { posePlay: W } };

let turns = 0;
const lines = [];
let prevPosing = {};
while (!state.winner && turns < 120 && state.acting) {
  const seat = state.acting;
  state = startSpiritTurn(state, rng);
  const startedOn = !!state.turn.startedOnLimelight[seat];
  const t = playTurn(state, v, policies[seat], ctx);
  state = t.state; v = t.view;
  turns++;

  const posedNow = { ...(state.limelight?.posing ?? {}) };
  const kinds = t.actions.map(a => a.kind);
  const here = state.spirits.find(s => s.id === seat)?.num;
  const scores = state.limelight?.scores ?? {};

  for (const id of Object.keys({ ...prevPosing, ...posedNow })) {
    if (!prevPosing[id] && posedNow[id]) lines.push(`t${turns} ${id} POSE UP (startedOnLimelight=${startedOn}, ends on #${here})`);
    if (prevPosing[id] && !posedNow[id]) lines.push(`t${turns} ${id} pose DROPPED (acting=${seat}, acts=${kinds.join(',')})`);
  }
  if (kinds.includes('pose') || Object.keys(scores).length) {
    lines.push(`  t${turns} ${seat} @#${here} started=${startedOn} banked=${JSON.stringify(scores)} acts=${kinds.join(',')}`);
  }
  prevPosing = posedNow;
}
console.log(lines.slice(0, 60).join('\n'));
console.log(`--- ${turns} turns, banked ${JSON.stringify(state.limelight?.scores ?? {})}`);
