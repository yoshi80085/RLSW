// =============================================================================
// ui/CadenceToast.jsx  —  cadence-objective-resolved toast
// Presentational: state + setter via props; cadence data imported from the music module.
// `riffBanner` is passed only to offset this toast when both are showing.
// Extracted verbatim from the Game render (CADENCE TOAST block).
// =============================================================================
import React from "react";
import { CADENCE_BY_ID } from "../music/cadence.js";

export function CadenceToast({ cadenceToast, spirits, setCadenceToast, riffBanner }) {
  if (!cadenceToast) return null;
  const cad = CADENCE_BY_ID[cadenceToast.cadenceId];
  const sp  = spirits.find(s => s.id === cadenceToast.spiritId);
  if (!cad) return null;
  return (
    <div onClick={() => setCadenceToast(null)} style={{
      position:'fixed', bottom: riffBanner ? 128 : 24, left:'50%', transform:'translateX(-50%)',
      zIndex:9986, cursor:'pointer',
      background:'linear-gradient(135deg, #081a14 0%, #0a0f20 100%)',
      border:'2px solid #44ffaa', borderRadius:12, padding:'12px 26px',
      boxShadow:'0 0 36px #44ffaa44, inset 0 0 40px #44ffaa0c',
      display:'flex', alignItems:'center', gap:14, maxWidth:480,
      animation:'eventTicketIn .4s cubic-bezier(.2,1.4,.4,1)',
    }}>
      <span style={{fontSize:30, filter:'drop-shadow(0 0 10px #44ffaa)'}}>{cad.icon}</span>
      <div>
        <div style={{fontSize:8, color:'#06281c', background:'#44ffaa', display:'inline-block',
          borderRadius:3, padding:'1px 7px', fontWeight:900, letterSpacing:2, marginBottom:3,
          fontFamily:"'Orbitron',sans-serif"}}>
          🎯 CADENCE RESOLVED
        </div>
        <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:13, color:'#44ffaa',
          letterSpacing:2, textShadow:'0 0 14px #44ffaa88'}}>
          {cad.name} · {cad.formula}
        </div>
        <div style={{fontSize:9, color:'#9eb3c8', fontStyle:'italic', marginTop:2}}>{cad.desc}</div>
        <div style={{fontSize:9, color:'#44ffaa', marginTop:3, fontWeight:700}}>
          <span style={{color: sp?.color}}>{sp?.name}</span> +{cadenceToast.fans} Fans 🎤
        </div>
      </div>
    </div>
  );
}
