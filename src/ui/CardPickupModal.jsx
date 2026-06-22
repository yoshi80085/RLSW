// =============================================================================
// ui/CardPickupModal.jsx  —  extracted verbatim from the Game render.
// Presentational: all values/handlers via props, zero app imports.
// =============================================================================
import React from "react";

export function CardPickupModal({ noteStates, pendingCardPickup, resolveCardPickup, spirits }) {
  return (<>
      {pendingCardPickup && (() => {
        const { spiritId, cardType } = pendingCardPickup;
        const spirit = spirits.find(s => s.id === spiritId);
        const ns = noteStates[spiritId] ?? {};
        const hand = ns.modCards ?? [];
        const handFull = hand.length >= 2;
        const def = {
          chromatic_shift: { icon:'🎼', name:'Chromatic Shift', color:'#44ffaa',
            desc:'Rewrites all discord notes in your stock into in-scale notes for your chosen mode.' },
          transpose:       { icon:'🔄', name:'Transpose',       color:'#ffcc44',
            desc:'Pick any note in your stock as your new Root Note — re-prompts Major/Minor.' },
          overdrive:       { icon:'⚡', name:'Overdrive',       color:'#ff8844',
            desc:'One discord note in your committed track counts as in-scale for HC scoring.' },
        }[cardType] ?? { icon:'?', name:cardType, color:'#aaaaff', desc:'' };

        return (
          <div style={{
            position:'fixed',inset:0,background:'#000000cc',zIndex:9990,
            display:'flex',alignItems:'center',justifyContent:'center',
          }}>
            <div style={{
              background:'#080f1e',border:`2px solid ${def.color}`,borderRadius:10,
              padding:'24px 28px',maxWidth:320,width:'90%',
              boxShadow:`0 0 30px ${def.color}44`,
            }}>
              {/* Card reveal */}
              <div style={{textAlign:'center',marginBottom:16}}>
                <div style={{fontSize:36,marginBottom:6}}>{def.icon}</div>
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:13,
                  color:def.color,letterSpacing:2,marginBottom:6}}>{def.name}</div>
                <div style={{fontSize:9,color:'#6a8aaa',lineHeight:1.6}}>{def.desc}</div>
              </div>

              {/* Hand display */}
              <div style={{marginBottom:14,padding:'8px 10px',background:'#0a1020',
                borderRadius:6,border:'1px solid #1a2a40'}}>
                <div style={{fontSize:7,color:'#3a5a7a',letterSpacing:1,marginBottom:6}}>
                  {spirit?.name}'s hand ({hand.length}/2)
                </div>
                {hand.length === 0 && (
                  <div style={{fontSize:8,color:'#2a3a50'}}>Empty — take it free!</div>
                )}
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {hand.map((c, i) => {
                    const cd = {
                      chromatic_shift: { icon:'🎼', name:'Chromatic Shift', color:'#44ffaa' },
                      transpose:       { icon:'🔄', name:'Transpose',       color:'#ffcc44' },
                      overdrive:       { icon:'⚡', name:'Overdrive',       color:'#ff8844' },
                    }[c.type] ?? { icon:'?', name:c.type, color:'#888' };
                    return (
                      <div key={c.id} style={{display:'flex',alignItems:'center',gap:8,
                        padding:'5px 8px',borderRadius:4,
                        background:`${cd.color}11`,border:`1px solid ${cd.color}44`}}>
                        <span style={{fontSize:12}}>{cd.icon}</span>
                        <span style={{flex:1,fontSize:8,color:cd.color}}>{cd.name}</span>
                        {c.exhausted && <span style={{fontSize:6,color:'#3a5070'}}>USED</span>}
                        <button onClick={() => resolveCardPickup(`replace-${i}`)}
                          style={{fontFamily:'inherit',fontSize:7,padding:'2px 7px',
                            background:'#0a1020',border:`1px solid ${def.color}66`,
                            borderRadius:3,color:def.color,cursor:'pointer'}}>
                          Replace
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{display:'flex',gap:8}}>
                {!handFull && (
                  <button onClick={() => resolveCardPickup('take')}
                    style={{flex:1,fontFamily:'inherit',fontSize:9,padding:'8px 0',
                      background:`${def.color}22`,border:`1px solid ${def.color}`,
                      borderRadius:5,color:def.color,cursor:'pointer',fontWeight:700}}>
                    ✓ Take Card
                  </button>
                )}
                <button onClick={() => resolveCardPickup('discard')}
                  style={{flex:handFull?1:0,fontFamily:'inherit',fontSize:9,padding:'8px 12px',
                    background:'#0a1020',border:'1px solid #3a5070',
                    borderRadius:5,color:'#3a5070',cursor:'pointer'}}>
                  Discard
                </button>
              </div>
              {handFull && (
                <div style={{fontSize:7,color:'#3a5a7a',textAlign:'center',marginTop:6}}>
                  Hand full — replace a card or discard
                </div>
              )}
            </div>
          </div>
        );
      })()}

  </>);
}
