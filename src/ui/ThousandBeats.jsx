// =============================================================================
// ui/ThousandBeats.jsx  —  extracted verbatim from the Game render.
// Presentational: all values/handlers via props, zero app imports.
// =============================================================================
import React from "react";

export function ThousandBeats({ spirits, thousandBeats }) {
  return (<>
      {thousandBeats && (() => {
        const sp = spirits.find(s => s.id === thousandBeats.spiritId);
        const col = sp?.color ?? '#4488ff';
        const isMash = thousandBeats.phase === 'mash';
        const clicks = thousandBeats.clicks ?? 0;
        return (
          <div style={{position:'fixed', inset:0, zIndex:9000, background:'rgba(2,6,16,0.86)',
            display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)'}}>
            <style>{`
              @keyframes tb-pop { 0%{transform:scale(0.4);opacity:0;} 60%{transform:scale(1.15);opacity:1;} 100%{transform:scale(1);opacity:1;} }
              @keyframes tb-thump { 0%,100%{transform:scale(1);} 50%{transform:scale(1.08);} }
              @keyframes tb-spark-burst { 0%{transform:scale(0) rotate(0deg);opacity:0;} 40%{opacity:1;} 100%{transform:scale(1.6) rotate(140deg);opacity:0;} }
            `}</style>
            <div style={{width:440, maxWidth:'92vw', textAlign:'center', padding:'30px 26px',
              background:'linear-gradient(180deg,#0a1428,#070d1a)', border:`2px solid ${col}`,
              borderRadius:16, boxShadow:`0 0 50px ${col}66`, animation:'tb-pop 0.3s ease-out'}}>
              <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:22, letterSpacing:3, color:col,
                textShadow:`0 0 18px ${col}88`}}>⚡ THOUSAND BEATS</div>
              <div style={{fontSize:11, color:'#8aa5c5', margin:'6px 0 18px'}}>
                {sp?.name} — a thousand cuts forged into Fame
              </div>

              {isMash ? (<>
                <div style={{fontSize:13, color:'#ffd700', fontWeight:800, letterSpacing:2, marginBottom:10}}>
                  MASH <span style={{padding:'2px 10px', border:'1px solid #ffd70088', borderRadius:6}}>SPACE</span>
                </div>
                <div key={clicks} style={{fontSize:74, fontWeight:900, color:'#fff', lineHeight:1.05,
                  textShadow:`0 0 30px ${col}`, animation:'tb-thump 0.12s ease-out'}}>{clicks}</div>
                <div style={{fontSize:9, letterSpacing:2, color:'#6a8aaa', marginBottom:14}}>BEATS</div>
                {/* countdown bar */}
                <div style={{height:8, background:'#10203a', borderRadius:5, overflow:'hidden'}}>
                  <div style={{height:'100%', background:`linear-gradient(90deg,${col},#ffd700)`,
                    borderRadius:5, transition:'width 1s linear',
                    width:`${(thousandBeats.secondsLeft / 5) * 100}%`}}/>
                </div>
                <div style={{fontSize:11, color:'#8aa5c5', marginTop:8}}>{thousandBeats.secondsLeft}s</div>
              </>) : (<>
                <div style={{fontSize:54, animation:'tb-spark-burst 0.7s ease-out'}}>✨</div>
                <div style={{fontSize:13, color:'#fff', margin:'6px 0'}}>
                  {thousandBeats.clicks} beats → <b style={{color:col}}>{thousandBeats.sparksAwarded} Fame Spark{thousandBeats.sparksAwarded !== 1 ? 's' : ''}</b>
                </div>
                {thousandBeats.fpForged > 0 && (
                  <div style={{fontSize:16, fontWeight:900, color:'#ffd700', textShadow:'0 0 16px #ffd70088'}}>
                    🌟 +{thousandBeats.fpForged} FAME POINT{thousandBeats.fpForged !== 1 ? 'S' : ''} FORGED!
                  </div>
                )}
              </>)}
            </div>
          </div>
        );
      })()}

  </>);
}
