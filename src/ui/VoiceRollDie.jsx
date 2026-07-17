import { useState, useEffect } from "react";

// 🎤 VOICE ROLL DIE — self-contained animated d6 for the Mic skill. Flickers
// through random faces for ~0.9s, then SETTLES on the rolled value so the player
// sees a real roll land. 4+ glows green (vocals land, +1 note); 1-3 glows red.
export function VoiceRollDie({ fx }) {
  const [face, setFace] = useState(1);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setFace(1 + Math.floor(Math.random() * 6));
      if (n >= 11) { clearInterval(id); setFace(fx.value); setSettled(true); }
    }, 80);
    return () => clearInterval(id);
  }, [fx.key, fx.value]);

  const accent = fx.success ? '#44ff99' : '#ff5566';
  const shown = settled ? fx.value : face;
  const PIPS = { 1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] };
  const cells = PIPS[shown] ?? [4];
  return (
    <div style={{
      position:'fixed', top:'34%', left:'50%', transform:'translate(-50%,-50%)',
      zIndex:9999, pointerEvents:'none', display:'flex', flexDirection:'column',
      alignItems:'center', gap:10, fontFamily:"'Saira Stencil One',sans-serif",
    }}>
      <div style={{fontSize:13, fontWeight:700, color:accent, letterSpacing:2,
        textShadow:`0 0 12px ${accent}`}}>🎤 VOICE ROLL</div>
      <div style={{
        width:84, height:84, borderRadius:16, position:'relative',
        background:'linear-gradient(145deg,#1a2740,#0a1322)',
        border:`2px solid ${accent}`,
        boxShadow:`0 0 26px ${accent}aa, inset 0 0 18px ${accent}33`,
        display:'grid', gridTemplateColumns:'repeat(3,1fr)', gridTemplateRows:'repeat(3,1fr)',
        padding:12, gap:2,
        animation: settled ? 'voice-die-settle .35s ease-out' : 'voice-die-spin .45s linear infinite',
      }}>
        {Array.from({length:9}, (_,i) => (
          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
            {cells.includes(i) && (
              <div style={{width:13,height:13,borderRadius:'50%',background:accent,
                boxShadow:`0 0 6px ${accent}`}}/>
            )}
          </div>
        ))}
      </div>
      {settled && (
        <div style={{fontSize:12, fontWeight:700, color:accent, letterSpacing:1,
          textShadow:`0 0 10px ${accent}`, animation:'voice-die-settle .35s ease-out'}}>
          {fx.success ? `★ ${fx.value} — VOCALS LAND! +1 note` : `${fx.value} — drowned out`}
        </div>
      )}
    </div>
  );
}
