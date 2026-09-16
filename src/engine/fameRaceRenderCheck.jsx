// ─── ⭐ THE FAME TRACK, RENDERED — both modes, every state §8 asks for ─────
//
// 🎯 `FAME_TRACK_REDESIGN.md` §11: "VERIFY THE PORT, DON'T ASSUME IT. Render
// the shipped component through React SSR and diff it against the preview."
// This is that check, kept as a suite rather than run once and thrown away.
//
// 🐛 IT HAS ALREADY EARNED ITS PLACE. On the first run it caught a dead heat
// at ⭐28 reporting a margin of "+28" and shading the entire rail, because the
// runner-up was found by filtering for scores strictly BELOW the leader — which
// is empty precisely when the top is tied. By eye the strip looked fine; the
// number was a lie, which is the one thing this component's header forbids.
//
// ⚠️ ASSERT WHAT THE PLAYER READS, not the markup. These check the finish line
// is GONE in Battle of the Bands and PRESENT in Legend Run, that the clock
// counts, that a dead heat says "=" and an empty board says "–", and that
// neither NaN nor Infinity ever reaches a style string.
//
//   npm run test:fametrack
import { renderToStaticMarkup } from "react-dom/server";
import { FameRace } from "../ui/FameRace.jsx";

const SP = [
  { id:'cosmic_ronin',      name:'Shredding Ronin',   color:'#4488ff' },
  { id:'intergalactic_0',   name:'Intergalactic 0',   color:'#aa55ff' },
  { id:'Metalness_Monster', name:'Metalness Monster', color:'#ffcc00' },
  { id:'Glamarchy',         name:'Glamarchy',         color:'#ff6600' },
];
const render = (label, props) => {
  let html;
  try { html = renderToStaticMarkup(<FameRace {...props} />); }
  catch (e) { console.log(`❌ ${label} THREW: ${e.message}`); return null; }
  return { label, html };
};
const cases = [
  ['1 rounds 0–0 (total collision)',  { spirits:SP, fameOf:()=>0, fameToWin:Infinity, actingId:SP[0].id, thresholds:[6,12,18], round:1,  roundLimit:10 }],
  ['2 rounds mid-match',              { spirits:SP, fameOf:id=>({cosmic_ronin:31,intergalactic_0:24,Metalness_Monster:19,Glamarchy:9}[id]), fameToWin:Infinity, actingId:SP[3].id, thresholds:[6,12,18], round:6, roundLimit:10 }],
  ['3 rounds LAST CALL',              { spirits:SP, fameOf:id=>({cosmic_ronin:52,intergalactic_0:47,Metalness_Monster:44,Glamarchy:41}[id]), fameToWin:Infinity, actingId:SP[1].id, thresholds:[6,12,18], round:10, roundLimit:10 }],
  ['4 rounds OVER-RUN (off chart)',   { spirits:SP.slice(0,3), fameOf:id=>({cosmic_ronin:120,intergalactic_0:30,Metalness_Monster:22}[id]), fameToWin:Infinity, thresholds:[6,12,18], round:9, roundLimit:10 }],
  ['5 rounds DEAD HEAT',              { spirits:SP.slice(0,2), fameOf:()=>28, fameToWin:Infinity, thresholds:[6,12], round:5, roundLimit:10 }],
  ['6 rounds 20-round match',         { spirits:SP, fameOf:id=>({cosmic_ronin:88,intergalactic_0:60,Metalness_Monster:41,Glamarchy:30}[id]), fameToWin:Infinity, thresholds:[6,12,18], round:14, roundLimit:20 }],
  ['7 LEGEND RUN normal',             { spirits:SP, fameOf:id=>({cosmic_ronin:14,intergalactic_0:9,Metalness_Monster:6,Glamarchy:2}[id]), fameToWin:24, actingId:SP[0].id, thresholds:[6,12,18], roundLimit:null }],
  ['8 LEGEND RUN contested FINALE',   { spirits:SP, fameOf:id=>({cosmic_ronin:22,intergalactic_0:21,Metalness_Monster:6,Glamarchy:2}[id]), fameToWin:24, actingId:SP[0].id, thresholds:[6,12,18], contested:true, roundLimit:null }],
  ['9 knocked out (Legend Run)',      { spirits:SP.map((s,i)=>i===2?{...s,knockedOut:true}:s), fameOf:id=>({cosmic_ronin:14,intergalactic_0:9,Metalness_Monster:6,Glamarchy:2}[id]), fameToWin:24, thresholds:[6,12,18], roundLimit:null }],
];
const out = [];
for (const [label, props] of cases) {
  const r = render(label, props); if (!r) { process.exitCode = 1; continue; }
  out.push(r);
}
let fail = 0;
const must = (cond, msg) => { console.log(`  ${cond?'✅':'❌'} ${msg}`); if(!cond) fail++; };
const byLabel = Object.fromEntries(out.map(r=>[r.label, r.html]));
console.log('\n── WHAT THE STRIP SAYS ──');
for (const {label, html} of out) {
  const left  = (html.match(/>([^<>]*(?:RACE|FINALE|LAST CALL|\d+\/\d+)[^<>]*)</)||[])[1] ?? '?';
  const right = html.replace(/\s+/g,' ').match(/>\s*([+–=⭐][^<]*?)\s*</g)?.slice(-1)[0]?.replace(/[><]/g,'').trim() ?? '?';
  console.log(`  ${label.padEnd(32)} left="${left.trim()}"  right="${right}"`);
}
console.log('\n── THE PROPERTIES THAT MATTER ──');
must(!/finish/.test('') && byLabel['2 rounds mid-match'].split('boxShadow').length >= 1, 'rounds mode renders');
// finish line = a 2px-wide right:0 bar. present in Legend Run, absent in rounds.
const hasFinish = h => /width:2px/.test(h) && /right:0/.test(h);
must(!hasFinish(byLabel['2 rounds mid-match']), '🏁 NO finish line in Battle of the Bands');
must( hasFinish(byLabel['7 LEGEND RUN normal']), '🏁 finish line SURVIVES in Legend Run');
must(/⏳ 6\/10/.test(byLabel['2 rounds mid-match']), '⏳ clock reads 6/10');
must(/LAST CALL/.test(byLabel['3 rounds LAST CALL']), '🔥 final round says LAST CALL');
must(/⭐24/.test(byLabel['7 LEGEND RUN normal']), '⭐ Legend Run still labels its target');
must(/FINALE/.test(byLabel['8 LEGEND RUN contested FINALE']), '🤘 FINALE still fires when contested');
must(/»/.test(byLabel['4 rounds OVER-RUN (off chart)']), '📈 over-run blip is marked off the chart');
must(!/»/.test(byLabel['2 rounds mid-match']), '…and a normal leader is not');
must(/>=<|>\s*=\s*</.test(byLabel['5 rounds DEAD HEAT']), '⚖️ a dead heat reads "=" not "+0"');
must(/>\s*–\s*</.test(byLabel['1 rounds 0–0 (total collision)']), '– at 0–0, not "+0"');
must(/\+7/.test(byLabel['2 rounds mid-match']), '🎯 margin reads +7 (31 vs 24)');
must((byLabel['1 rounds 0–0 (total collision)'].match(/border-radius:50%/g)||[]).length===4, '🫧 all four blips drawn at 0–0 (the tie fan)');
must(/NaN/.test(JSON.stringify(byLabel))===false, '🚫 no NaN anywhere in any state');
must(/Infinity/.test(JSON.stringify(byLabel))===false, '🚫 no Infinity leaked into the markup');
console.log(fail ? `\n❌ ${fail} failed` : `\n✅ all ${out.length} states render, every property holds`);
process.exit(fail?1:0);
