// 🧠 DOES THE REVIEW PANEL ACTUALLY RENDER? A server-render smoke test, same
// trick as `__smoke.jsx`: no browser, but it proves the component runs against a
// real journal and that the numbers reach the DOM instead of throwing.
// Run: npx esbuild .scratch/reviewsmoke.jsx --bundle --format=esm --outfile=/tmp/rs.mjs && node /tmp/rs.mjs
// (react-dom/server.browser, deliberately — server.node does not survive being
//  bundled to ESM, and this component only ever needs the string.)
import React from "react";
import { renderToString } from "react-dom/server.browser";
import BotReview from "../src/ui/BotReview.jsx";

const journal = [
  // ⚠️ A PRE-2026-08-19 COMPOSE ENTRY, ON PURPOSE. Journals get downloaded and
  // kept — `.scratch/journals/` exists for exactly that — so the panel has to
  // survive a file written by the version before the one reading it. No
  // `chosenKinds`, no `legalKinds`, no `terms`.
  { t:'compose', turn:1, spiritId:'Metalness_Monster', name:'Metalness Monster', ms:31,
    curve:[{len:1,score:10.2},{len:2,score:11.9},{len:3,score:12.4}], chosen:{len:3}, score:12.4 },
  // 🥁 And the shape it writes now: two notes and a chord commit, not "3 steps".
  { t:'compose', turn:2, spiritId:'Metalness_Monster', name:'Metalness Monster', ms:29,
    curve:[{len:1,score:10.0},{len:2,score:11.4},{len:3,score:13.1}],
    steps:[{ i:0, took:{kind:'melodyNote',key:2}, cands:[{kind:'melodyNote',key:2,score:10.0}] },
           { i:1, took:{kind:'stackCommit',key:'drive'},
             cands:[{kind:'melodyNote',key:5,score:11.1},{kind:'stackCommit',key:'drive',score:11.4}] }],
    legalKinds:['melodyNote','stackCommit'], chosenKinds:{ melodyNote:2, stackCommit:1 },
    chosen:{len:3}, score:13.1, terms:{ drive:0.33, sustain:0.0, fame:0.2 } },
  { t:'action', turn:1, spiritId:'Metalness_Monster', name:'Metalness Monster', ms:22,
    legalKinds:['move','face','eleven','slime','endTurn'], legal:14, beamed:9, pruned:5,
    considered:[{kind:'slime',key:null,score:13.1,terms:{pressure:0.40,beamSetup:0.10}},
                {kind:'move',key:33,score:12.8,terms:{pressure:0.31,beamSetup:0.55}},
                {kind:'face',key:'∠1.05',score:12.2}],
    chosen:{kind:'slime',key:null}, score:13.1,
    bestPruned:{ kind:'move', key:41, score:13.9 } },   // the beam threw away a better one
  { t:'action', turn:2, spiritId:'Metalness_Monster', name:'Metalness Monster', ms:18,
    legalKinds:['move','face','eleven','endTurn'], legal:8, beamed:8, pruned:0,
    considered:[{kind:'endTurn',key:null,score:9.0,terms:{apBanked:0.5,beamSetup:0.2}},
                {kind:'face',key:'∠2.10',score:8.9,terms:{apBanked:0.5,beamSetup:0.44}}],
    chosen:{kind:'endTurn',key:null}, score:9.0, bestPruned:null },
];
globalThis.window = { addEventListener(){}, removeEventListener(){} };
const html = renderToString(
  <BotReview journal={journal} spirits={[{ id:'Metalness_Monster', name:'Metalness Monster' }]} onClose={()=>{}} />
);
const has = (s) => html.includes(s);
const rows = [
  ['renders at all',                 html.length > 500],
  ['names the seat',                 has('Metalness Monster')],
  ['⚠️ the never-played sweep fired', has('eleven (legal 2')],
  ['🎯 flags the beam losing a move', has('threw away')],
  ['reports the beam cost',           has('BEAM COST THE POSITION')],
  // 🥁 The composition phase, told apart by KIND rather than counted as steps.
  ['names the notes in a track',      has('2 notes')],
  ['...and the chord commits in it',  has('+ 1 🥁')],
  ['reports commits per turn',        has('TURNS THAT LOADED A STACK')],
  // ⚠️ The old entry has no `chosenKinds`; it must still render its length
  // rather than blowing up or printing "undefined notes".
  ['survives a pre-2026-08-19 entry', has('3 notes')],
  // 🎯 What the coin flips are flipping on.
  ['names what close calls turn on',  has('WHAT THE CLOSE CALLS TURN ON')],
  ['...and ranks the terms',          has('beamSetup')],
];
for (const [k, v] of rows) console.log(`${v ? '✅' : '❌'} ${k}`);
if (rows.some(([, v]) => !v)) process.exit(1);
console.log(`✅ reviewsmoke — the panel renders and says what it is for (${html.length} bytes)`);
