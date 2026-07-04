import { useState, useEffect } from "react";
import { SPIRIT_DEFS, SPIRIT_OPTIONS } from "../data/spirits.js";
import { CORNERS, CORNER_LABELS, CORNERS_ORDER } from "../data/corners.js";
import { cornerFacing } from "../board/boardHelpers.js";

export function Lobby({ onStart, onTutorial }) {
  const [playerCount, setPlayerCount] = useState(null);
  const [mode, setMode]               = useState(null);
  const [assignments, setAssignments] = useState({});
  const [cpuCorners, setCpuCorners]   = useState({}); // { corner: true } → bot-controlled
  const [step, setStep]               = useState("count");
  const [startingLives, setStartingLives] = useState(3);
  const [beginnerMode, setBeginnerMode] = useState(true); // 🎓 Beginner tips — ON by default

  // 2-player: blue (top-left, hex 7) vs red (bottom-right, hex 105) — opposite sides
  const activeCorners = playerCount === 2
    ? ["blue", "red"]
    : playerCount ? CORNERS_ORDER.slice(0, playerCount) : [];
  const usedSpirits   = new Set(Object.values(assignments));
  const allAssigned   = activeCorners.every(c => assignments[c]);

  // 🤖 Default the non-first corners to CPU so a free-for-all is "you vs bots" out of
  // the box. Without this, an un-ticked corner is treated as a human nobody drives —
  // that player just sits in its corner all game. Only fills corners the user hasn't
  // touched, so ticking/unticking (e.g. for hot-seat multiplayer) still works.
  useEffect(() => {
    if (!playerCount) return;
    setCpuCorners(prev => {
      const next = { ...prev };
      activeCorners.forEach((c, i) => { if (next[c] === undefined) next[c] = i !== 0; });
      return next;
    });
  }, [playerCount]);

  function assign(corner, spiritId) {
    setAssignments(a => ({ ...a, [corner]: spiritId }));
  }

  function handleStart() {
    const spirits = activeCorners.map(corner => {
      const def = SPIRIT_DEFS[assignments[corner]];
      const { homeNum } = CORNERS[corner];
      const facing = cornerFacing(homeNum);
      const { color: cornerColor } = CORNER_LABELS[corner];
      return { ...def, num: homeNum, facing, corner, color: cornerColor, cpu: !!cpuCorners[corner] };
    });
    const teams = mode === "team"
      ? { a: activeCorners.slice(0,2), b: activeCorners.slice(2,4) }
      : null;
    onStart({ spirits, mode, teams, startingLives, beginnerMode });
  }

  // 🧪 TESTING GROUNDS — one-click sandbox: 4-spirit free-for-all, dev panel on.
  function startTestingGrounds() {
    const ids = Object.keys(SPIRIT_DEFS);
    const spirits = CORNERS_ORDER.map((corner, i) => {
      const def = SPIRIT_DEFS[ids[i % ids.length]];
      const { homeNum } = CORNERS[corner];
      const facing = cornerFacing(homeNum);
      const { color: cornerColor } = CORNER_LABELS[corner];
      // Sandbox: corner 0 is you, the rest are bots — instant AI demo.
      return { ...def, num: homeNum, facing, corner, color: cornerColor, cpu: i !== 0 };
    });
    onStart({ spirits, mode: "ffa", teams: null, startingLives: 3, testMode: true, beginnerMode });
  }

  const btnBase = { fontFamily:"inherit", cursor:"pointer", borderRadius:4, padding:"8px 18px", fontSize:11, transition:"all .15s", border:"1px solid" };

  return (
    <div style={{minHeight:"100vh", background:"#050810", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Share Tech Mono','Courier New',monospace"}}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#2d3748}`}</style>
      <button onClick={startTestingGrounds} title="Skip setup — launch a 4-spirit sandbox with the dev panel"
        style={{position:'fixed',bottom:14,right:14,zIndex:50,fontFamily:"'Orbitron',sans-serif",fontSize:10,letterSpacing:1,
          cursor:'pointer',padding:'9px 14px',borderRadius:7,background:'#2a1030',border:'1.5px solid #cc66ff',color:'#e0a0ff',
          boxShadow:'0 0 18px #cc66ff55'}}>
        🧪 TESTING GROUNDS
      </button>

      <div style={{width:520, background:"#080f1e", border:"1px solid #1a2a40", borderRadius:10, padding:32}}>
        <div style={{textAlign:"center", marginBottom:28}}>
          <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:26, color:"#f6ad55", letterSpacing:4, marginBottom:4}}>⚡ RLSW</div>
          <div style={{fontSize:11, color:"#3a5a7a", letterSpacing:2}}>ROCK LEGENDS: SPIRIT WARS</div>
          <button onClick={onTutorial}
            style={{marginTop:14, fontFamily:"inherit", cursor:"pointer", background:"#0a1020",
              border:"1px solid #2a4a6a", borderRadius:4, color:"#5a8aaa", fontSize:9,
              padding:"6px 18px", letterSpacing:2, transition:"all .15s"}}
            onMouseEnter={e => { e.target.style.borderColor="#4488ff"; e.target.style.color="#88bbff"; }}
            onMouseLeave={e => { e.target.style.borderColor="#2a4a6a"; e.target.style.color="#5a8aaa"; }}>
            📖 HOW TO PLAY
          </button>
          <button onClick={() => setBeginnerMode(b => !b)}
            style={{marginTop:8, fontFamily:"inherit", cursor:"pointer",
              background: beginnerMode ? "#1a2a10" : "#0a1020",
              border:`1px solid ${beginnerMode ? "#44cc66" : "#2a4a6a"}`,
              borderRadius:4, color: beginnerMode ? "#44ff88" : "#5a8aaa", fontSize:9,
              padding:"6px 18px", letterSpacing:2, transition:"all .15s"}}>
            🎓 BEGINNER MODE {beginnerMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Player count */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10, fontFamily:"'Orbitron',sans-serif"}}>01 — How Many Players?</div>
          <div style={{display:"flex", gap:8}}>
            {[2,3,4].map(n => (
              <button key={n} onClick={() => { setPlayerCount(n); setAssignments({}); setMode(null); setStep("assign"); }}
                style={{...btnBase, flex:1, background: playerCount===n ? "#1a3560" : "#0a1020",
                  borderColor: playerCount===n ? "#4488ff" : "#1e3a5f", color: playerCount===n ? "#88bbff" : "#c0d0e0"}}>
                {n} Players
              </button>
            ))}
          </div>
        </div>

        {/* Spirit assignment */}
        {playerCount && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10, fontFamily:"'Orbitron',sans-serif"}}>02 — Choose Your Spirit</div>
            {activeCorners.map(corner => {
              const { label, color } = CORNER_LABELS[corner];
              return (
                <div key={corner} style={{marginBottom:10, padding:"10px 12px", background:"#050810", border:`1px solid ${color}33`, borderLeft:`3px solid ${color}`, borderRadius:5}}>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6}}>
                    <span style={{fontSize:10, color, fontWeight:700}}>{label}</span>
                    {/* 🤖 CPU toggle — mark this corner as bot-controlled */}
                    <label style={{fontSize:9, color: cpuCorners[corner] ? "#44ff88" : "#3a5a7a",
                      cursor:"pointer", display:"flex", alignItems:"center", gap:4, userSelect:"none"}}>
                      <input type="checkbox" checked={!!cpuCorners[corner]}
                        onChange={e => setCpuCorners(c => ({ ...c, [corner]: e.target.checked }))}
                        style={{accentColor:"#44cc66", cursor:"pointer"}}/>
                      🤖 CPU
                    </label>
                  </div>
                  <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                    {SPIRIT_OPTIONS.map(sp => {
                      const taken = usedSpirits.has(sp.id) && assignments[corner] !== sp.id;
                      const selected = assignments[corner] === sp.id;
                      return (
                        <button key={sp.id} onClick={() => !taken && assign(corner, sp.id)}
                          disabled={taken}
                          style={{...btnBase, padding:"4px 10px", fontSize:10,
                            background: selected ? color+"33" : "#0a1020",
                            borderColor: selected ? color : "#1e3a5f",
                            color: taken ? "#1e3a5f" : selected ? color : "#c0d0e0",
                            opacity: taken ? 0.4 : 1, cursor: taken ? "not-allowed" : "pointer",
                            display:"flex", flexDirection:"column", alignItems:"center", gap:1}}>
                          <span>{sp.name}</span>
                          <span style={{fontSize:8, color: taken ? "#1e3a5f" : selected ? color+"cc" : "#3a5a7a"}}>
                            {sp.style} · ⚔️{sp.drive} 🛡️{sp.sustain}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Game mode */}
        {allAssigned && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10, fontFamily:"'Orbitron',sans-serif"}}>03 — Game Mode</div>
            <div style={{display:"flex", gap:8}}>
              <button onClick={() => setMode("ffa")}
                style={{...btnBase, flex:1, background: mode==="ffa"?"#1a3560":"#0a1020",
                  borderColor: mode==="ffa"?"#4488ff":"#1e3a5f", color: mode==="ffa"?"#88bbff":"#c0d0e0"}}>
                ⚔️ Free For All
              </button>
              {playerCount === 4 && (
                <button onClick={() => setMode("team")}
                  style={{...btnBase, flex:1, background: mode==="team"?"#1a3560":"#0a1020",
                    borderColor: mode==="team"?"#aa55ff":"#1e3a5f", color: mode==="team"?"#cc99ff":"#c0d0e0"}}>
                  🤝 Team Battle
                  <div style={{fontSize:8, color:"#3a5a7a", marginTop:2}}>Blue+Purple vs Red+Yellow</div>
                </button>
              )}
              {playerCount !== 4 && (
                <div style={{flex:1, padding:"8px 18px", fontSize:10, color:"#1e3a5f", textAlign:"center", border:"1px solid #1e3a5f33", borderRadius:4}}>
                  Team Battle requires 4 players
                </div>
              )}
            </div>
          </div>
        )}

        {/* Starting Lives */}
        {allAssigned && mode && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10, fontFamily:"'Orbitron',sans-serif"}}>04 — Knock Downs Before KO</div>
            <div style={{display:"flex", gap:6}}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setStartingLives(n)}
                  style={{...btnBase, flex:1, padding:"6px 4px",
                    background: startingLives===n ? "#301520" : "#0a1020",
                    borderColor: startingLives===n ? "#ff4488" : "#1e3a5f",
                    color: startingLives===n ? "#ff88bb" : "#c0d0e0"}}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{marginTop:6, fontSize:9, color:"#3a5a7a", padding:"6px 10px", background:"#050810", borderRadius:4, border:"1px solid #1a2a40"}}>
              {startingLives === 1 ? "Sudden death — one Knock Down and you're KO'd!" : `${startingLives} Knock Downs = KO. Each Knock Down: −1 FP, then straight back up at full Vibe in your home corner.`}
            </div>
          </div>
        )}

        {allAssigned && mode && (
          <button onClick={handleStart}
            style={{...btnBase, width:"100%", padding:"12px", fontSize:13, fontFamily:"'Orbitron',sans-serif",
              letterSpacing:2, background:"#1a3020", borderColor:"#44cc66", color:"#44ff88", marginTop:4}}>
            ▶ START GAME
          </button>
        )}
      </div>
    </div>
  );
}
