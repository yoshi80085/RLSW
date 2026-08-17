// =============================================================================
// ui/Riffbook.jsx  —  extracted verbatim from the Game render.
//
// 🪦 THE RIFF HALF RETIRED 2026-08-17. This panel used to carry three tabs —
// 🎼 DISCOVERIES and 📜 LEGACY CODEX browsed a 34-entry library of named tunes,
// and both went when that library was retired (see `systems/melodyCommit.js` for
// why). 🎯 CADENCES stayed, and is now the whole panel: cadences are a melody
// FEAT the player composes rather than a canon they recite, which is the
// direction the per-Spirit style system builds on.
// Presentational: all values/handlers via props, zero app imports.
// =============================================================================
import React from "react";

export function Riffbook({ CADENCE_OBJECTIVES, PC_PLAY_NAMES, acting, noteStates, setShowRiffbook, showRiffbook }) {
  return (<>
      {showRiffbook && (
        <div onClick={() => setShowRiffbook(false)} style={{
          position:'fixed', inset:0, background:'#000000d8', zIndex:9300,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width:560, maxHeight:'86vh', overflowY:'auto',
            background:'#080f1e', border:'2px solid #ffd700', borderRadius:12,
            boxShadow:'0 0 50px #ffd70044',
          }}>
            <div style={{padding:'14px 20px', borderBottom:'1px solid #ffd70044',
              background:'linear-gradient(135deg, #ffd70018 0%, #0a1020 100%)',
              display:'flex', alignItems:'center', gap:10, position:'sticky', top:0, backdropFilter:'blur(4px)'}}>
              <span style={{fontSize:22}}>📖</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Saira Stencil One',sans-serif", fontSize:13, color:'#ffd700', letterSpacing:2, fontWeight:700}}>
                  THE CADENCE BOOK
                </div>
                <div style={{fontSize:8, color:'#6a8aaa', marginTop:2}}>
                  the pitch of each turn's FINAL track note builds a run ·
                  string the right endings together to land a cadence
                </div>
              </div>
              <button onClick={() => setShowRiffbook(false)} style={{fontFamily:'inherit', fontSize:10,
                background:'none', border:'1px solid #ffd70055', borderRadius:4, color:'#ffd700',
                padding:'3px 10px', cursor:'pointer'}}>✕</button>
            </div>

            {/* ── CADENCES — multi-turn resolution objectives ── */}
            {(
            <div style={{padding:'12px 16px'}}>
              <div style={{fontSize:8.5, color:'#7a9a8a', marginBottom:10, padding:'7px 10px',
                background:'#081a14', border:'1px dashed #44ffaa44', borderRadius:6, lineHeight:1.6}}>
                🎯 The LAST note of your confirmed track each turn is your <b style={{color:'#44ffaa'}}>FINAL</b>.
                String the right finals together across consecutive turns — in ANY key — to resolve a
                cadence for Fame. Example: end a turn on C, the next on F, the next on G, then back
                on C — that's THE FULL RESOLVE. Each cadence has a 3-turn cooldown after completion.
              </div>
              {acting && (() => {
                const trail = noteStates[acting.id]?.finalsTrail ?? [];
                return (
                  <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:12,
                    padding:'7px 10px', background:'#0a0e16', border:'1px solid #44ffaa33', borderRadius:6}}>
                    <span style={{fontSize:8, color:'#44ffaa', letterSpacing:1, fontFamily:"'Saira Stencil One',sans-serif"}}>
                      {acting.name?.split(' ')[0]?.toUpperCase()}'S RUN
                    </span>
                    {trail.length === 0
                      ? <span style={{fontSize:9, color:'#3a5a7a'}}>— no finals yet, confirm a track to begin</span>
                      : trail.map((pc, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span style={{fontSize:8, color:'#2a4a3a'}}>→</span>}
                            <span style={{fontSize:10, fontWeight:700, color:'#e8fff4',
                              background:'#0e2018', border:'1px solid #44ffaa44',
                              borderRadius:3, padding:'1px 7px', fontFamily:"'Share Tech Mono',monospace"}}>
                              {PC_PLAY_NAMES[pc]}
                            </span>
                          </React.Fragment>
                        ))}
                    {trail.length > 0 && <span style={{fontSize:9, color:'#2a4a3a'}}>→ ?</span>}
                  </div>
                );
              })()}
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {CADENCE_OBJECTIVES.map(cad => {
                  const exampleNotes = cad.degrees.map(d => PC_PLAY_NAMES[d % 12]);
                  const cd = acting ? (noteStates[acting.id]?.cadenceCooldowns?.[cad.id] ?? 0) : 0;
                  return (
                    <div key={cad.id} style={{borderRadius:8, padding:'9px 12px',
                      background: cd > 0 ? '#0a0e16' : '#081a14',
                      border:`1px solid ${cd > 0 ? '#1a2a40' : '#44ffaa44'}`,
                      opacity: cd > 0 ? 0.6 : 1}}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <span style={{fontSize:16}}>{cad.icon}</span>
                        <span style={{fontFamily:"'Saira Stencil One',sans-serif", fontSize:9.5, fontWeight:700,
                          color:'#44ffaa', letterSpacing:1, flex:1}}>
                          {cad.name} <span style={{color:'#7a9a8a', fontWeight:400}}>· {cad.formula}</span>
                        </span>
                        {cd > 0 && <span style={{fontSize:8, color:'#ff8800'}}>⏳ {cd}t cooldown</span>}
                        <span style={{fontSize:9, color:'#ffd700', fontWeight:700}}>⭐{cad.fp}</span>
                      </div>
                      <div style={{display:'flex', gap:4, alignItems:'center', marginTop:5, flexWrap:'wrap'}}>
                        <span style={{fontSize:7, color:'#3a5a7a', letterSpacing:1, width:62}}>e.g. IN C</span>
                        {exampleNotes.map((n, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span style={{fontSize:7, color:'#44ffaa'}}>then</span>}
                            <span style={{fontSize:9, fontWeight:700, color:'#e8fff4',
                              background:'#0e2018', border:'1px solid #2a4a3a',
                              borderRadius:3, padding:'1px 6px', fontFamily:"'Share Tech Mono',monospace"}}>
                              {n}
                            </span>
                          </React.Fragment>
                        ))}
                        <span style={{fontSize:7, color:'#44608088', marginLeft:4}}>
                          · {cad.degrees.length} consecutive turn-finals
                        </span>
                      </div>
                      <div style={{fontSize:8, color:'#7a8aa0', fontStyle:'italic', marginTop:4}}>{cad.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {/* ── LEGACY CODEX — full designer reference: every combination, spoilers and all ── */}
          </div>
        </div>
      )}

  </>);
}
