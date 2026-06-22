// =============================================================================
// ui/RiffBanner.jsx  —  legendary-riff discovery toast
// Presentational: state + setter via props; riff data imported from the music module.
// Extracted verbatim from the Game render (RIFF BANNER block).
// =============================================================================
import React from "react";
import { RIFF_BY_ID } from "../music/riffLibrary.js";

export function RiffBanner({ riffBanner, spirits, setRiffBanner }) {
  if (!riffBanner) return null;
  const riff = RIFF_BY_ID[riffBanner.riffId];
  const sp   = spirits.find(s => s.id === riffBanner.spiritId);
  if (!riff) return null;
  return (
    <div onClick={() => setRiffBanner(null)} style={{
      position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      zIndex:9985, cursor:'pointer',
      background:'linear-gradient(135deg, #14081e 0%, #0a0f20 100%)',
      border:'2px solid #ffd700', borderRadius:12, padding:'12px 26px',
      boxShadow:'0 0 36px #ffd70055, inset 0 0 40px #ffd7000c',
      display:'flex', alignItems:'center', gap:14, maxWidth:480,
      animation:'eventTicketIn .4s cubic-bezier(.2,1.4,.4,1)',
    }}>
      <span style={{fontSize:30, filter:'drop-shadow(0 0 10px #ffd700)'}}>{riff.icon}</span>
      <div>
        {riffBanner.isNew && (
          <div style={{fontSize:8, color:'#0a0f20', background:'#ffd700', display:'inline-block',
            borderRadius:3, padding:'1px 7px', fontWeight:900, letterSpacing:2, marginBottom:3,
            fontFamily:"'Orbitron',sans-serif"}}>
            ✨ NEW DISCOVERY
          </div>
        )}
        <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:13, color:'#ffd700',
          letterSpacing:2, textShadow:'0 0 14px #ffd70088'}}>
          🎼 {riff.name}
        </div>
        <div style={{fontSize:9, color:'#9eb3c8', fontStyle:'italic', marginTop:2}}>{riff.flavor}</div>
        <div style={{fontSize:9, color:'#ffd700', marginTop:3, fontWeight:700}}>
          <span style={{color: sp?.color}}>{sp?.name}</span> +{riffBanner.fp} Fame Point{riffBanner.fp !== 1 ? 's' : ''} ⭐
        </div>
      </div>
    </div>
  );
}
