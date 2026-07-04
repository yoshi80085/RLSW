// =============================================================================
// ui/Riffbook.jsx  —  extracted verbatim from the Game render.
// Presentational: all values/handlers via props, zero app imports.
// =============================================================================
import React from "react";

export function Riffbook({ CADENCE_OBJECTIVES, PC_PLAY_NAMES, RIFF_GENRE, RIFF_GENRE_META, RIFF_LIBRARY, acting, legacyPlayingId, noteStates, playRiffSequence, riffBook, riffbookTab, setLegacyPlayingId, setRiffbookTab, setShowRiffbook, showRiffbook, spirits }) {
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
                <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:13, color:'#ffd700', letterSpacing:2, fontWeight:700}}>
                  THE RIFFBOOK
                </div>
                <div style={{fontSize:8, color:'#6a8aaa', marginTop:2}}>
                  {Object.keys(riffBook).length}/{RIFF_LIBRARY.length} legendary riffs discovered ·
                  place a riff's opening intervals on your track (any key!) and CONFIRM ·
                  first discovery = full Fame, replays = 1 FP
                </div>
                <div style={{display:'flex', gap:6, marginTop:7}}>
                  {[['discoveries','🎼 DISCOVERIES'],['cadences','🎯 CADENCES'],['legacy','📜 LEGACY CODEX']].map(([tab,label]) => (
                    <button key={tab} onClick={() => setRiffbookTab(tab)}
                      style={{fontFamily:"'Orbitron',sans-serif", fontSize:8, letterSpacing:1, cursor:'pointer',
                        padding:'4px 12px', borderRadius:4,
                        background: riffbookTab === tab ? '#ffd70022' : 'transparent',
                        border:`1px solid ${riffbookTab === tab ? '#ffd700' : '#ffd70033'}`,
                        color: riffbookTab === tab ? '#ffd700' : '#8a7a3a'}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowRiffbook(false)} style={{fontFamily:'inherit', fontSize:10,
                background:'none', border:'1px solid #ffd70055', borderRadius:4, color:'#ffd700',
                padding:'3px 10px', cursor:'pointer'}}>✕</button>
            </div>
            {riffbookTab === 'discoveries' && (
            <div style={{padding:'12px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              {RIFF_LIBRARY.map(riff => {
                const discovererId = riffBook[riff.id];
                const discovered   = !!discovererId;
                const discoverer   = spirits.find(s => s.id === discovererId);
                return (
                  <div key={riff.id} style={{
                    borderRadius:8, padding:'9px 12px',
                    background: discovered ? '#14110a' : '#0a0e16',
                    border:`1px solid ${discovered ? '#ffd70066' : '#1a2a40'}`,
                    opacity: discovered ? 1 : 0.8,
                  }}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{fontSize:18, filter: discovered ? 'none' : 'grayscale(1) brightness(0.5)'}}>
                        {discovered ? riff.icon : '❓'}
                      </span>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:9, fontWeight:700,
                          color: discovered ? '#ffd700' : '#3a5a7a', letterSpacing:1}}>
                          {discovered ? riff.name : '? ? ? ? ?'}
                        </div>
                        <div style={{fontSize:8, color: discovered ? '#9eb3c8' : '#44608044',
                          fontStyle:'italic', lineHeight:1.4, marginTop:2}}>
                          {discovered ? riff.flavor : riff.hint}
                        </div>
                        {discovered && discoverer && (
                          <div style={{fontSize:7, color: discoverer.color, marginTop:2}}>
                            ✍️ first played by {discoverer.name}
                          </div>
                        )}
                      </div>
                      <span style={{fontSize:9, color: discovered ? '#ffd700' : '#3a5a7a',
                        fontWeight:700, whiteSpace:'nowrap'}}>
                        ⭐{riff.fp}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {/* ── CADENCES — multi-turn resolution objectives ── */}
            {riffbookTab === 'cadences' && (
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
                    <span style={{fontSize:8, color:'#44ffaa', letterSpacing:1, fontFamily:"'Orbitron',sans-serif"}}>
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
                        <span style={{fontFamily:"'Orbitron',sans-serif", fontSize:9.5, fontWeight:700,
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
            {riffbookTab === 'legacy' && (
            <div style={{padding:'12px 16px'}}>
              <div style={{fontSize:8, color:'#8a7a3a', marginBottom:10, padding:'6px 10px',
                background:'#14110a', border:'1px dashed #ffd70044', borderRadius:6}}>
                ⚠️ FULL SPOILERS — every trigger combination in the book. Patterns are shown in C for
                reference, but ANY key works: only the interval spacing matters. Place at least the
                TRIGGER notes (in order, anywhere in your track) and confirm.
              </div>
              {['classical','theory','homage'].map(genre => {
                const meta = RIFF_GENRE_META[genre];
                const riffs = RIFF_LIBRARY.filter(r => RIFF_GENRE[r.id] === genre);
                return (
                  <div key={genre} style={{marginBottom:14}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                      <span style={{fontFamily:"'Orbitron',sans-serif", fontSize:9, letterSpacing:2,
                        color: meta.color, fontWeight:700}}>
                        {meta.label} WING — {riffs.length}
                      </span>
                      <span style={{flex:1, height:1, background:`linear-gradient(90deg, ${meta.color}44, transparent)`}}/>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:6}}>
                      {riffs.map(riff => {
                        const trigOffs = riff.notes.slice(0, riff.triggerLen).map(n => n[0]);
                        const trigNotes = trigOffs.map(off => PC_PLAY_NAMES[((off % 12) + 12) % 12]);
                        const steps = trigOffs.slice(1).map((o, i) => {
                          const d = o - trigOffs[i];
                          return d === 0 ? '±0' : d > 0 ? `+${d}` : `${d}`;
                        });
                        return (
                          <div key={riff.id} style={{borderRadius:7, padding:'8px 12px',
                            background:'#0a0e16', border:`1px solid ${meta.color}33`}}>
                            <div style={{display:'flex', alignItems:'center', gap:8}}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (legacyPlayingId) return; // one audition at a time
                                  const dur = playRiffSequence(riff, 0); // audition in C
                                  setLegacyPlayingId(riff.id);
                                  setTimeout(() => setLegacyPlayingId(p => (p === riff.id ? null : p)), dur + 250);
                                }}
                                title="Audition this riff (played in C)"
                                style={{fontFamily:'inherit', cursor: legacyPlayingId ? 'default' : 'pointer',
                                  width:26, height:22, borderRadius:4, fontSize:10, lineHeight:1,
                                  background: legacyPlayingId === riff.id ? '#ffd70028' : '#10182a',
                                  border:`1px solid ${legacyPlayingId === riff.id ? '#ffd700' : '#ffd70055'}`,
                                  color:'#ffd700',
                                  animation: legacyPlayingId === riff.id ? 'crew-ready-glow 0.7s ease-in-out infinite' : 'none'}}>
                                {legacyPlayingId === riff.id ? '♪' : '▶'}
                              </button>
                              <span style={{fontSize:15}}>{riff.icon}</span>
                              <span style={{fontFamily:"'Orbitron',sans-serif", fontSize:9, fontWeight:700,
                                color:'#ffd700', letterSpacing:1, flex:1}}>
                                {riff.name}
                              </span>
                              <span style={{fontSize:7, color: meta.color, border:`1px solid ${meta.color}55`,
                                borderRadius:3, padding:'1px 5px'}}>{meta.label}</span>
                              <span style={{fontSize:8, color:'#6a8aaa'}}>♩{riff.bpm}</span>
                              <span style={{fontSize:9, color:'#ffd700', fontWeight:700}}>⭐{riff.fp}</span>
                            </div>
                            <div style={{display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginTop:6}}>
                              <span style={{fontSize:7, color:'#3a5a7a', letterSpacing:1, width:62}}>TRIGGER ({riff.triggerLen})</span>
                              {trigNotes.map((n, i) => (
                                <React.Fragment key={i}>
                                  {i > 0 && <span style={{fontSize:7, color: meta.color}}>{steps[i-1]}</span>}
                                  <span style={{fontSize:9, fontWeight:700, color:'#e8f0ff',
                                    background:'#10182a', border:'1px solid #2a3a55',
                                    borderRadius:3, padding:'1px 6px', fontFamily:"'Share Tech Mono',monospace"}}>
                                    {n}
                                  </span>
                                </React.Fragment>
                              ))}
                              <span style={{fontSize:7, color:'#44608088', marginLeft:4}}>
                                · full phrase {riff.notes.length} notes
                              </span>
                            </div>
                            <div style={{fontSize:8, color:'#7a8aa0', fontStyle:'italic', marginTop:4}}>{riff.flavor}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      )}

  </>);
}
