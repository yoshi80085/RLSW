// =============================================================================
// ui/SignatureAbilities.jsx  —  extracted verbatim from the Game render.
// Presentational: all values/handlers via props, zero app imports.
// =============================================================================
import React from "react";

export function SignatureAbilities({ SKILL_BY_ID, SKILL_TREE, SPIRIT_DEFS, noteStates, setSignatureSpirit, signatureSpirit, spirits }) {
  return (<>
      {signatureSpirit && (() => {
        const route = SKILL_TREE.routes.find(r => r.spiritOnly === signatureSpirit);
        const sp    = spirits.find(s => s.id === signatureSpirit)
                   || Object.values(SPIRIT_DEFS).find(s => s.id === signatureSpirit);
        if (!route) return null;
        const unlocked = noteStates[signatureSpirit]?.unlockedSkills ?? [];
        const col = route.color;
        return (
          <div onClick={() => setSignatureSpirit(null)} style={{position:'fixed', inset:0, zIndex:9100,
            background:'rgba(2,6,16,0.88)', display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(3px)', padding:20}}>
            <div onClick={e => e.stopPropagation()} style={{width:560, maxWidth:'94vw', maxHeight:'88vh',
              overflowY:'auto', background:'linear-gradient(180deg,#0a1428,#070d18)', border:`2px solid ${col}`,
              borderRadius:16, boxShadow:`0 0 50px ${col}55`, padding:'22px 24px'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4}}>
                <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:18, letterSpacing:2, color:col,
                  textShadow:`0 0 16px ${col}77`}}>{route.icon} {sp?.name ?? route.label}</div>
                <button onClick={() => setSignatureSpirit(null)} style={{fontFamily:'inherit', fontSize:10,
                  padding:'3px 10px', cursor:'pointer', background:'#0a1020', border:'1px solid #1e3a5f',
                  borderRadius:8, color:'#8aa5c5'}}>✕ CLOSE</button>
              </div>
              <div style={{fontSize:10, color:'#7a95b5', marginBottom:16}}>Signature abilities — exclusive to this Spirit</div>

              {route.skills.map(sk => {
                const owned = unlocked.includes(sk.id);
                const prereqLabel = sk.prereq ? (SKILL_BY_ID[sk.prereq]?.label ?? sk.prereq) : null;
                return (
                  <div key={sk.id} style={{display:'flex', gap:12, alignItems:'flex-start', padding:'11px 12px',
                    marginBottom:9, borderRadius:10, background: owned ? `${col}14` : '#0b1322',
                    border:`1px solid ${owned ? col + '66' : '#16243c'}`, opacity: owned ? 1 : 0.82}}>
                    <div style={{fontSize:26, lineHeight:1, filter: owned ? 'none' : 'grayscale(0.6)'}}>{sk.icon}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                        <span style={{fontSize:13, fontWeight:800, color: owned ? '#fff' : '#b9c8db'}}>{sk.label}</span>
                        <span style={{fontSize:8.5, padding:'1px 7px', borderRadius:8, letterSpacing:1,
                          background: owned ? '#1c3a22' : '#241a0a',
                          border:`1px solid ${owned ? '#3fae5a' : '#caa24a'}66`,
                          color: owned ? '#7fe39a' : '#e0bd6a'}}>
                          {owned ? '✓ UNLOCKED' : `🔒 ${sk.hcCost} HC`}
                        </span>
                        {prereqLabel && (
                          <span style={{fontSize:8.5, color:'#7a95b5'}}>needs {prereqLabel}</span>
                        )}
                      </div>
                      <div style={{fontSize:10.5, color:'#9fb4cd', lineHeight:1.55, marginTop:4}}>{sk.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

  </>);
}
