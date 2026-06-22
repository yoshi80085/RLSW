// =============================================================================
// ui/RightPanel.jsx  —  rival-spirits / fan & mod-card column (HUD right column)
// Presentational: all values/handlers via props. Extracted verbatim from Game render.
// =============================================================================
import React from "react";

export function RightPanel({ FAN_CASUAL_CAP, FAN_DIEHARD_CAP, FAN_DIEHARD_START, FAN_MULT_CAP, NeonStrikeFX, acting, crowdMultiplier, log, noteStates, playModCard, queuedSpirits, rlCardImg }) {
  return (<>
        <div style={{display:"flex",flexDirection:"column",gap:0}}>

          {/* TURN ORDER */}
          <div>
            <div className="stitle">Turn Order</div>
            <div className="card" style={{padding:"5px 8px"}}>
              <NeonStrikeFX color="#f6ad55"/>
              {queuedSpirits.map((s, i) => (
                <div key={s.id} style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"3px 4px", marginBottom:2, borderRadius:3,
                  background: i === 0 ? s.color+"22" : "transparent",
                  border: i === 0 ? `1px solid ${s.color}66` : "1px solid transparent",
                  transition:"background .3s",
                }}>
                  <div style={{
                    width:14, height:14, borderRadius:"50%", background:s.color,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:7, fontWeight:700, color:"#000", flexShrink:0,
                  }}>{i+1}</div>
                  <div style={{fontSize:8, color: i === 0 ? s.color : "#7090b0", fontWeight: i === 0 ? 700 : 400, flex:1}}>
                    {s.name.split(" ")[0]}
                  </div>
                  {i === 0 && <div style={{fontSize:6,color:"#f6ad55",fontWeight:700}}>▶ NOW</div>}
                </div>
              ))}
              <div style={{fontSize:7,color:"#3a5a7a",marginTop:3}}>↑ acts next · ↓ waits</div>
            </div>
          </div>


          {/* ── 🎤 CROWD ── */}
          <div>
            <div className="stitle" style={{marginTop:4}}>Crowd</div>
            {(() => {
              if (!acting) return <div style={{fontSize:8,color:'#2a3a50',padding:'4px 8px'}}>No active player</div>;
              const ns = noteStates[acting.id] ?? {};
              const D = ns.diehards ?? FAN_DIEHARD_START, C = ns.casuals ?? 0;
              const m = crowdMultiplier(D, C);
              const pct = Math.min(100, ((m - 1) / (FAN_MULT_CAP - 1)) * 100);
              return (
                <div className="card" style={{padding:'6px 8px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
                    <span style={{fontSize:8,color:'#ff66aa',fontWeight:700}}>🎤 Fame ×{m.toFixed(2)}</span>
                    <span style={{fontSize:7,color:'#3a5a7a'}}>cap ×{FAN_MULT_CAP.toFixed(1)}</span>
                  </div>
                  <div style={{background:'#0d1a2a',borderRadius:2,height:5,marginBottom:5}}>
                    <div style={{width:`${pct}%`,height:5,borderRadius:2,background:'#ff66aa',transition:'width .3s'}}/>
                  </div>
                  <div style={{display:'flex',gap:10,fontSize:8}}>
                    <span style={{color:'#ffcc44'}} title="Diehards — loyal core">♥ {D}<span style={{color:'#3a5a7a'}}>/{FAN_DIEHARD_CAP}</span></span>
                    <span style={{color:'#66ccff'}} title="Casuals — fickle fringe">👥 {C}<span style={{color:'#3a5a7a'}}>/{FAN_CASUAL_CAP}</span></span>
                    {(ns.fanLag ?? 0) > 0 && <span style={{color:'#ff5544'}} title="Shaken from a demolition — no crowd gain">💔 {ns.fanLag}t</span>}
                  </div>
                </div>
              );
            })()}
          </div>


          {/* ── MODULATION CARDS ── */}
          <div>
            <div className="stitle" style={{marginTop:4}}>Mod Cards</div>
            {(() => {
              if (!acting) return <div style={{fontSize:8,color:'#2a3a50',padding:'4px 8px'}}>No active player</div>;
              const ns = noteStates[acting.id] ?? {};
              const cards = ns.modCards ?? [];
              if (cards.length === 0) return <div style={{fontSize:8,color:'#2a3a50',padding:'4px 8px'}}>No cards in hand</div>;
              return (
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {cards.map(card => {
                    const def = {
                      chromatic_shift: { icon:'🎼', name:'Chromatic Shift', color:'#44ffaa',
                        desc:'Rewrite all discord notes → in-scale', when:'After pivot' },
                      transpose:       { icon:'🔄', name:'Transpose',       color:'#ffcc44',
                        desc:'Pick any stock note as your new Root', when:'During pivot' },
                      overdrive:       { icon:'⚡', name:'Overdrive',       color:'#ff8844',
                        desc:'1 discord note counts as in-scale', when:'Before commit' },
                    }[card.type] ?? { icon:'?', name:'Unknown', color:'#888', desc:'', when:'' };

                    const canPlay = !card.exhausted;
                    const isTransposePending = ns.transposeCardPending === card.id;

                    return (
                      <div key={card.id} style={{
                        position:'relative',
                        width:'100%',
                        aspectRatio:'5/7',
                        borderRadius:8,
                        overflow:'hidden',
                        opacity: card.exhausted ? 0.4 : 1,
                        transition:'all .15s',
                        boxShadow: card.exhausted ? 'none' : `0 0 16px ${def.color}55, 0 4px 12px #00000088`,
                        filter: card.exhausted ? 'grayscale(0.6)' : 'none',
                      }}>
                        {/* Card background image */}
                        <img src={rlCardImg} alt="card" style={{
                          position:'absolute', inset:0, width:'100%', height:'100%',
                          objectFit:'cover', display:'block',
                        }}/>
                        {/* Colour tint overlay */}
                        <div style={{
                          position:'absolute', inset:0,
                          background:`radial-gradient(ellipse at 50% 30%, ${def.color}22 0%, transparent 70%)`,
                          pointerEvents:'none',
                        }}/>
                        {!card.exhausted && <NeonStrikeFX color={def.color} calm/>}
                        {/* Card content — bottom half */}
                        <div style={{
                          position:'absolute', bottom:0, left:0, right:0,
                          padding:'8px 10px 10px',
                          background:'linear-gradient(transparent, #050a1acc 40%, #050a1aee 100%)',
                          fontFamily:"'Orbitron',sans-serif",
                          textAlign:'center',
                        }}>
                          <div style={{fontSize:16, marginBottom:3}}>{def.icon}</div>
                          <div style={{fontSize:9, fontWeight:700, color: card.exhausted ? '#3a5070' : def.color,
                            letterSpacing:1, lineHeight:1.2, marginBottom:3}}>
                            {def.name}
                            {card.exhausted && <div style={{fontSize:7,color:'#3a5070',marginTop:1}}>USED</div>}
                            {isTransposePending && <div style={{fontSize:7,color:'#ffcc44',marginTop:1}}>← PICK NOTE</div>}
                          </div>
                          <div style={{fontSize:7, color:'#7090a0', lineHeight:1.3, marginBottom:5}}>{def.desc}</div>
                          <div style={{fontSize:6, color:'#3a5a7a', marginBottom: canPlay ? 6 : 0}}>{def.when} · refreshes next turn</div>
                          {canPlay && (
                            <button
                              onClick={() => playModCard(card.id)}
                              style={{
                                fontFamily:'inherit', fontSize:9, padding:'5px 14px',
                                background:`${def.color}22`, border:`1px solid ${def.color}88`,
                                borderRadius:4, color:def.color, cursor:'pointer',
                                whiteSpace:'nowrap', lineHeight:1, width:'100%',
                                boxShadow:`0 0 8px ${def.color}44`,
                              }}>
                              ▶ Play
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* COMBAT LOG */}
          <div>
            <div className="stitle">Log</div>
            <div style={{position:"relative"}}>
              <div className="card" style={{maxHeight:200,overflowY:"auto",fontSize:8,lineHeight:1.8,padding:"5px 8px"}}>
                {log.map((entry,i) => (
                  <div key={i} style={{color:i===0?"#e2e8f0":"#3a5a7a",
                    borderBottom:i===0?"1px solid #1a2a40":"none",paddingBottom:i===0?2:0}}>
                    {entry}
                  </div>
                ))}
              </div>
              <NeonStrikeFX calm/>
            </div>
          </div>

        </div>
  </>);
}
