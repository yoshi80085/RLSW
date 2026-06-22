// =============================================================================
// ui/BackToThePast.jsx  —  extracted verbatim from the Game render.
// Presentational: all values/handlers via props, zero app imports.
// =============================================================================
import React from "react";

export function BackToThePast({ BTTP_STAGES, bttpChallenge, bttpChoose, bttpInput, bttpStageData, renderInstrument, setBttpChallenge, spirits }) {
  return (<>
      {bttpChallenge && (() => {
        const ch = bttpChallenge;
        const st = BTTP_STAGES[ch.stageKey] || BTTP_STAGES.angel;
        const data = bttpStageData(ch.stageKey);
        const sp = spirits.find(s => s.id === ch.spiritId);
        const accent = st.accent;
        const pads = ['c','d','e','f','g','a','b']; // input row, aligned to the piano
        const gradeColor = ch.lastGrade === 'clean' ? '#7CFFB2'
          : ch.lastGrade === 'clam' ? '#ffb347'
          : ch.lastGrade === 'miss' ? '#ff6b6b' : '#9eb3c8';
        const gradeText = ch.lastGrade === 'clean' ? 'NAILED IT!'
          : ch.lastGrade === 'clam' ? 'CLAMS!'
          : ch.lastGrade === 'miss' ? 'MISSED!' : '';
        const view = ch.view || st.view;
        const renderDiagram = (chord, got) => renderInstrument(view, chord, got, accent);
        return (
          <div style={{position:'fixed',inset:0,background:'#000000e0',zIndex:9995,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{background:'linear-gradient(165deg,#0c0818,#08101e 60%,#050810)',border:`2px solid ${accent}`,borderRadius:12,padding:'18px 22px 20px',maxWidth:400,width:'94%',textAlign:'center',boxShadow:`0 0 44px ${accent}55`}}>
              <div style={{fontSize:8,color:'#3a5a7a',letterSpacing:2,marginBottom:8}}>🎸⏰ BACK TO THE PAST · <span style={{color:sp?.color}}>{sp?.name?.toUpperCase()}</span></div>
              <div style={{fontSize:30,filter:`drop-shadow(0 0 12px ${accent})`}}>{st.icon}</div>
              <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:14,color:accent,letterSpacing:2,textShadow:`0 0 12px ${accent}aa`}}>{st.name}</div>
              <div style={{fontSize:9,color:'#9eb3c8',fontStyle:'italic',margin:'4px 0 12px'}}>{st.blurb}</div>

              <div style={{display:'flex',justifyContent:'center',gap:5,marginBottom:14,flexWrap:'wrap'}}>
                {data.chords.map((c,i) => {
                  const active = ch.phase === 'play' || ch.phase === 'playback';
                  const done = i < ch.idx && active, cur = i === ch.idx && active;
                  return <span key={i} style={{width:9,height:9,borderRadius:'50%',
                    background: cur ? accent : done ? `${accent}99` : '#1a2740',
                    boxShadow: cur ? `0 0 10px ${accent}` : 'none', border:`1px solid ${accent}44`}}/>;
                })}
              </div>

              {ch.phase === 'choose' && (
                <div style={{padding:'6px 0 4px'}}>
                  <div style={{fontSize:10,color:'#c0d0e0',marginBottom:12}}>How do you want to play it?</div>
                  <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                    <button onClick={()=>bttpChoose(ch.spiritId,'piano')} style={{flex:1,maxWidth:150,cursor:'pointer',
                      background:'#0a1426',border:`1.5px solid ${accent}`,borderRadius:10,padding:'14px 10px',color:accent,fontFamily:"'Orbitron',sans-serif"}}>
                      <div style={{fontSize:26}}>🎹</div>
                      <div style={{fontSize:11,letterSpacing:1,marginTop:4}}>PIANO</div>
                      <div style={{fontSize:7.5,color:'#8aa0b8',marginTop:3,fontFamily:'monospace'}}>standard timing</div>
                    </button>
                    <button onClick={()=>bttpChoose(ch.spiritId,'guitar')} style={{flex:1,maxWidth:150,cursor:'pointer',
                      background:'#0a1426',border:`1.5px solid ${accent}`,borderRadius:10,padding:'14px 10px',color:accent,fontFamily:"'Orbitron',sans-serif"}}>
                      <div style={{fontSize:26}}>🎸</div>
                      <div style={{fontSize:11,letterSpacing:1,marginTop:4}}>GUITAR</div>
                      <div style={{fontSize:7.5,color:'#8aa0b8',marginTop:3,fontFamily:'monospace'}}>harder read · +50% time</div>
                    </button>
                  </div>
                </div>
              )}

              {ch.phase === 'countdown' && (
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:13,color:'#ffd98a',letterSpacing:2,padding:'18px 0'}}>GET READY…</div>
              )}

              {ch.phase === 'play' && (
                <>
                  <div style={{fontSize:9,color:'#ffd98a',fontFamily:"'Orbitron',sans-serif",letterSpacing:2,marginBottom:6}}>
                    {view === 'guitar' ? '🎸' : '🎹'} PLAY THE CHORD
                  </div>
                  <div style={{height: view === 'guitar' ? 206 : 104,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                    {ch.flash ? renderDiagram(ch.flash.chord, ch.flash.got)
                      : <div style={{fontSize:12,color:gradeColor,fontFamily:"'Orbitron',sans-serif",letterSpacing:2}}>{gradeText || '…'}</div>}
                  </div>
                  <div style={{fontSize:8,color:'#5a7a9a',marginBottom:8}}>
                    Chord {Math.min(ch.idx+1, data.chords.length)}/{data.chords.length} — hit every lit key (tap or press)
                  </div>
                  <div style={{display:'flex',justifyContent:'center',gap:5,flexWrap:'wrap'}}>
                    {pads.map(k => {
                      const hit = ch.flash && ch.flash.got && ch.flash.got.includes(k);
                      return (
                        <button key={k} onClick={()=>bttpInput(k)} style={{
                          width:36,height:44,borderRadius:8,cursor:'pointer',
                          fontFamily:"'Orbitron',sans-serif",fontSize:15,fontWeight:700,
                          color: hit ? '#06111f' : accent,
                          background: hit ? '#2bd66b' : '#0a1020',
                          border:`1.5px solid ${accent}55`}}>
                          {k.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                  {ch.tally.vibeLost > 0 && (
                    <div style={{fontSize:8,color:'#ff8a8a',marginTop:10}}>💔 fading… −{ch.tally.vibeLost} Vibe so far</div>
                  )}
                </>
              )}

              {ch.phase === 'playback' && (
                <>
                  <div style={{fontSize:9,color:accent,fontFamily:"'Orbitron',sans-serif",letterSpacing:2,marginBottom:6}}>🎵 HOW IT GOES…</div>
                  <div style={{height: view === 'guitar' ? 206 : 104,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {ch.flash ? renderDiagram(ch.flash.chord, ch.flash.chord) : <div style={{height:84}}/>}
                  </div>
                  <div style={{fontSize:8,color:'#5a7a9a'}}>Here's the progression, in rhythm.</div>
                </>
              )}

              {ch.phase === 'stageclear' && (
                <div style={{padding:'10px 0'}}>
                  <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:13,color:'#7CFFB2',letterSpacing:2,marginBottom:8}}>STAGE 1 DONE</div>
                  <div style={{fontSize:9.5,color:'#c0d0e0',lineHeight:1.5,marginBottom:6}}>{ch.lines[ch.lines.length-1]}</div>
                  <div style={{fontSize:9,color:'#ff9a3c',fontStyle:'italic'}}>…now here's something they're not ready for yet. 🦆⚡</div>
                </div>
              )}

              {ch.phase === 'done' && (
                <>
                  <div style={{fontSize:9.5,color:'#c0d0e0',lineHeight:1.6,textAlign:'left',background:'#0a1020',border:`1px solid ${accent}44`,borderRadius:6,padding:'10px 12px',margin:'4px 0 14px'}}>
                    {ch.lines.map((l,i)=>(<div key={i} style={{marginBottom:i<ch.lines.length-1?5:0}}>{l}</div>))}
                    {ch.tally.vibeLost > 0 && <div style={{marginTop:6,color:'#ff8a8a'}}>💔 The fade cost you {ch.tally.vibeLost} Vibe total — but you held on.</div>}
                  </div>
                  <button onClick={()=>setBttpChallenge(null)} style={{fontFamily:"'Orbitron',sans-serif",fontSize:11,letterSpacing:2,cursor:'pointer',padding:'8px 28px',borderRadius:6,color:accent,fontWeight:700,background:'transparent',border:`1.5px solid ${accent}`}}>
                    🤘 ROCK ON
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

  </>);
}
