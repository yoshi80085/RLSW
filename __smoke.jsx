import { renderToString } from "react-dom/server";
import { BeginnerTipOverlay } from "/sessions/wonderful-inspiring-turing/mnt/rlsw-sim/src/ui/BeginnerTipOverlay.jsx";
globalThis.window = { innerWidth: 1440, innerHeight: 900, addEventListener(){}, removeEventListener(){}, matchMedia:()=>({matches:false}) };
const tip = { id:'move_act', title:'🚶 Step 3 — Move & Act!', pages:[
  { body:['Three ways to RUIN someone\'s set:','⚔️ SWING (1 AP) — the melee jab.'], anchor:'actions-bar' },
  { body:'Done? Hit END TURN.', anchor:'end-turn' } ] };
const html = renderToString(<BeginnerTipOverlay tip={tip} onClose={()=>{}} onDisable={()=>{}}/>);
console.log("RENDER OK, length:", html.length);
console.log("has PICKLES header:", html.includes("PICKLES SEZ"));
console.log("has pick svg:", html.includes("pickles-shell"));
console.log("hidden text present:", html.includes("Three ways to RUIN"));
