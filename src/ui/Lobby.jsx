import { useState, useEffect, useRef } from "react";
import { SPIRIT_DEFS, SPIRIT_OPTIONS } from "../data/spirits.js";
import { CORNERS, CORNER_LABELS, CORNERS_ORDER } from "../data/corners.js";
import { cornerFacing } from "../board/boardHelpers.js";
import { makeNetClient } from "../net/client.js";

export function Lobby({ onStart, onTutorial }) {
  const [playerCount, setPlayerCount] = useState(null);
  const [mode, setMode]               = useState(null);
  const [assignments, setAssignments] = useState({});
  const [cpuCorners, setCpuCorners]   = useState({});
  const [step, setStep]               = useState("count");
  const [startingLives, setStartingLives] = useState(3);
  const [beginnerMode, setBeginnerMode] = useState(true);

  const [netClient, setNetClient] = useState(null);
  const [netRoom, setNetRoom]     = useState(null);
  const [netStatus, setNetStatus] = useState("idle");
  const [netError, setNetError]   = useState("");
  const [netDropped, setNetDropped] = useState(false);
  const [playerName, setPlayerName] = useState(() => {
    try { return localStorage.getItem("rlsw.net.name") ?? ""; } catch { return ""; }
  });
  const [joinCode, setJoinCode] = useState("");
  const transitioningRef = useRef(false);

  useEffect(() => () => { if (!transitioningRef.current) netClient?.close(); }, [netClient]);

  // N3: listen for GAME_STARTED on ALL clients (host + joiners)
  useEffect(() => {
    if (!netClient) return;
    return netClient.on("GAME_STARTED", f => {
      transitioningRef.current = true;
      const mySeat = f.seats.find(s => s.seatId === netClient.seatId);
      onStart({
        ...f.config,
        seed: f.seed,
        net: { client: netClient, seatId: netClient.seatId, seats: f.seats, mySpiritId: mySeat?.spiritId ?? null },
      });
    });
  }, [netClient, onStart]);

  // N6: listen for CATCH_UP — spectator mid-join OR player reconnect (F5 / wifi blip)
  useEffect(() => {
    if (!netClient) return;
    return netClient.on("CATCH_UP", f => {
      transitioningRef.current = true;
      const mySeat = f.seats.find(s => s.seatId === netClient.seatId);
      onStart({
        ...f.config,
        seed: f.seed,
        net: {
          client: netClient, seatId: netClient.seatId, seats: f.seats,
          mySpiritId: mySeat?.spiritId ?? null, spectator: netClient.spectator,
        },
        catchUp: { log: f.log, logLines: f.logLines },
      });
    });
  }, [netClient, onStart]);

  // N6: auto-rejoin on mount — if a saved session exists (F5 / tab restore),
  // reconnect and reclaim the seat. The server sends CATCH_UP which the
  // listener above handles.
  const [autoRejoining, setAutoRejoining] = useState(false);
  useEffect(() => {
    if (netClient) return; // already connected
    const probe = makeNetClient();
    const saved = probe.savedSession();
    if (!saved) return;
    setAutoRejoining(true);
    setNetStatus("connecting");
    const c = makeNetClient();
    c.on("ROOM_STATE", f => setNetRoom(f));
    c.on("ERROR", f => {
      // room gone or token invalid — clear stale session and go back to lobby
      setNetError(f.code + ": " + f.msg);
      setAutoRejoining(false); setNetStatus("idle");
      c.leave(); // clears the saved session
    });
    c.on("net:close", () => setNetDropped(true));
    c.on("net:open", () => setNetDropped(false));
    c.connect().then(() => {
      c.joinRoom(saved.code, { name: saved.name, rejoinToken: saved.rejoinToken });
      return c.waitFor("WELCOME", { ms: 5000 });
    }).then(() => {
      setNetClient(c); setNetStatus("in-room"); setAutoRejoining(false);
      // If the game is already playing, CATCH_UP arrives right after WELCOME
      // and the CATCH_UP listener above transitions us into the Game.
      // If the room is back in lobby, we just land in the room normally.
    }).catch(() => {
      c.close();
      setAutoRejoining(false); setNetStatus("idle");
      // Can't reach server — stale session, clear it
      try { localStorage.removeItem("rlsw.net.session"); } catch {}
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // N3: auto-set playerCount from room seat count when online
  const isHost = netClient?.seatId === netRoom?.hostSeatId;
  useEffect(() => {
    if (netStatus === "in-room" && netRoom && isHost) {
      const n = netRoom.seats.filter(s => !s.isBot).length;
      if (n >= 2 && n <= 4) { setPlayerCount(n); setAssignments({}); }
    }
  }, [netStatus, netRoom?.seats?.length]);

  async function goOnline(kind) {
    const name = playerName.trim() || "Player";
    try { localStorage.setItem("rlsw.net.name", name); } catch {}
    setNetStatus("connecting"); setNetError("");
    const c = makeNetClient();
    c.on("ROOM_STATE", f => setNetRoom(f));
    c.on("ERROR", f => setNetError(f.code + ": " + f.msg));
    c.on("net:close", () => setNetDropped(true));
    c.on("net:open", () => setNetDropped(false));
    try {
      await c.connect();
      if (kind === "create") c.createRoom(name);
      else c.joinRoom(joinCode.trim().toUpperCase(), { name });
      await c.waitFor("WELCOME");
      setNetClient(c); setNetStatus("in-room");
    } catch (e) {
      c.close();
      setNetStatus("idle"); setNetError(String(e.message ?? e));
    }
  }

  function leaveRoom() {
    netClient?.leave();
    setNetClient(null); setNetRoom(null); setNetStatus("idle"); setNetDropped(false);
  }

  const activeCorners = playerCount === 2
    ? ["blue", "red"]
    : playerCount ? CORNERS_ORDER.slice(0, playerCount) : [];
  const usedSpirits   = new Set(Object.values(assignments));
  const allAssigned   = activeCorners.every(c => assignments[c]);

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

  // N3: online start
  function handleStartOnline() {
    const spirits = activeCorners.map(corner => {
      const def = SPIRIT_DEFS[assignments[corner]];
      const { homeNum } = CORNERS[corner];
      const facing = cornerFacing(homeNum);
      const { color: cornerColor } = CORNER_LABELS[corner];
      return { ...def, num: homeNum, facing, corner, color: cornerColor, cpu: false };
    });
    const teams = mode === "team"
      ? { a: activeCorners.slice(0,2), b: activeCorners.slice(2,4) }
      : null;
    const config = { spirits, mode, teams, startingLives, beginnerMode };
    const seatMap = netRoom.seats.filter(s => !s.isBot).map((s, i) => ({
      seatId: s.seatId,
      spiritId: activeCorners[i] ? assignments[activeCorners[i]] : null,
    }));
    netClient.startGame(config, { seatMap });
  }

  function startTestingGrounds() {
    const ids = Object.keys(SPIRIT_DEFS);
    const spirits = CORNERS_ORDER.map((corner, i) => {
      const def = SPIRIT_DEFS[ids[i % ids.length]];
      const { homeNum } = CORNERS[corner];
      const facing = cornerFacing(homeNum);
      const { color: cornerColor } = CORNER_LABELS[corner];
      return { ...def, num: homeNum, facing, corner, color: cornerColor, cpu: i !== 0 };
    });
    onStart({ spirits, mode: "ffa", teams: null, startingLives: 3, testMode: true, beginnerMode });
  }

  const btnBase = { fontFamily:"inherit", cursor:"pointer", borderRadius:4, padding:"8px 18px", fontSize:11, transition:"all .15s", border:"1px solid" };
  const inputBase = { fontFamily:"inherit", background:"#0a1020", border:"1px solid #1e3a5f", borderRadius:4, color:"#c0d0e0", fontSize:11, padding:"8px 10px", outline:"none" };

  // spirit picker for one corner
  const spiritPicker = (corner, seatName) => {
    const { label, color } = CORNER_LABELS[corner];
    return (
      <div key={corner} style={{marginBottom:10, padding:"10px 12px", background:"#050810",
        border:"1px solid " + color + "33", borderLeft:"3px solid " + color, borderRadius:5}}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
          <span style={{fontSize:10, color, fontWeight:700}}>{label}</span>
          {seatName && <span style={{fontSize:9, color:"#c0d0e0"}}>{seatName}</span>}
          {!seatName && (
            <label style={{fontSize:9, color: cpuCorners[corner] ? "#44ff88" : "#3a5a7a",
              cursor:"pointer", display:"flex", alignItems:"center", gap:4, userSelect:"none", marginLeft:"auto"}}>
              <input type="checkbox" checked={!!cpuCorners[corner]}
                onChange={e => setCpuCorners(c => ({ ...c, [corner]: e.target.checked }))}
                style={{accentColor:"#44cc66", cursor:"pointer"}}/>
              CPU
            </label>
          )}
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
                  {sp.style}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const modeAndLives = (stepOffset, onGo, goLabel) => (
    <>
      {allAssigned && (
        <div style={{marginBottom:24}}>
          <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10,
            fontFamily:"'Orbitron',sans-serif"}}>{stepOffset} — Game Mode</div>
          <div style={{display:"flex", gap:8}}>
            <button onClick={() => setMode("ffa")}
              style={{...btnBase, flex:1, background: mode==="ffa"?"#1a3560":"#0a1020",
                borderColor: mode==="ffa"?"#4488ff":"#1e3a5f", color: mode==="ffa"?"#88bbff":"#c0d0e0"}}>
              Free For All
            </button>
            {playerCount === 4 ? (
              <button onClick={() => setMode("team")}
                style={{...btnBase, flex:1, background: mode==="team"?"#1a3560":"#0a1020",
                  borderColor: mode==="team"?"#aa55ff":"#1e3a5f", color: mode==="team"?"#cc99ff":"#c0d0e0"}}>
                Team Battle
                <div style={{fontSize:8, color:"#3a5a7a", marginTop:2}}>Blue+Purple vs Red+Yellow</div>
              </button>
            ) : (
              <div style={{flex:1, padding:"8px 18px", fontSize:10, color:"#1e3a5f", textAlign:"center",
                border:"1px solid #1e3a5f33", borderRadius:4}}>
                Team Battle requires 4 players
              </div>
            )}
          </div>
        </div>
      )}
      {allAssigned && mode && (
        <div style={{marginBottom:24}}>
          <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10,
            fontFamily:"'Orbitron',sans-serif"}}>{String(Number(stepOffset)+1).padStart(2,"0")} — Knock Downs Before KO</div>
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
          <div style={{marginTop:6, fontSize:9, color:"#3a5a7a", padding:"6px 10px", background:"#050810",
            borderRadius:4, border:"1px solid #1a2a40"}}>
            {startingLives === 1
              ? "Sudden death -- one Knock Down and you're KO'd!"
              : startingLives + " Knock Downs = KO. Each Knock Down: -1 FP, then straight back up at full Vibe in your home corner."}
          </div>
        </div>
      )}
      {allAssigned && mode && (
        <button onClick={onGo}
          style={{...btnBase, width:"100%", padding:"12px", fontSize:13, fontFamily:"'Orbitron',sans-serif",
            letterSpacing:2, background:"#1a3020", borderColor:"#44cc66", color:"#44ff88", marginTop:4}}>
          {goLabel}
        </button>
      )}
    </>
  );

  return (
    <div style={{minHeight:"100vh", background:"#050810", display:"flex", alignItems:"center",
      justifyContent:"center", fontFamily:"'Share Tech Mono','Courier New',monospace"}}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#2d3748}`}</style>
      <button onClick={startTestingGrounds} title="Skip setup"
        style={{position:'fixed',bottom:14,right:14,zIndex:50,fontFamily:"'Orbitron',sans-serif",fontSize:10,letterSpacing:1,
          cursor:'pointer',padding:'9px 14px',borderRadius:7,background:'#2a1030',border:'1.5px solid #cc66ff',color:'#e0a0ff',
          boxShadow:'0 0 18px #cc66ff55'}}>
        TESTING GROUNDS
      </button>

      {/* N6: auto-rejoin overlay */}
      {autoRejoining && (
        <div style={{position:"fixed", inset:0, zIndex:100, background:"#050810ee", display:"flex",
          alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12}}>
          <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:16, color:"#f6ad55", letterSpacing:4}}>RECONNECTING</div>
          <div style={{fontSize:10, color:"#3a5a7a", letterSpacing:1}}>Reclaiming your seat...</div>
        </div>
      )}

      <div style={{width:520, background:"#080f1e", border:"1px solid #1a2a40", borderRadius:10, padding:32}}>
        <div style={{textAlign:"center", marginBottom:28}}>
          <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:26, color:"#f6ad55", letterSpacing:4, marginBottom:4}}>RLSW</div>
          <div style={{fontSize:11, color:"#3a5a7a", letterSpacing:2}}>ROCK LEGENDS: SPIRIT WARS</div>
          <button onClick={onTutorial}
            style={{marginTop:14, fontFamily:"inherit", cursor:"pointer", background:"#0a1020",
              border:"1px solid #2a4a6a", borderRadius:4, color:"#5a8aaa", fontSize:9,
              padding:"6px 18px", letterSpacing:2, transition:"all .15s"}}
            onMouseEnter={e => { e.target.style.borderColor="#4488ff"; e.target.style.color="#88bbff"; }}
            onMouseLeave={e => { e.target.style.borderColor="#2a4a6a"; e.target.style.color="#5a8aaa"; }}>
            HOW TO PLAY
          </button>
          <button onClick={() => setBeginnerMode(b => !b)}
            style={{marginTop:8, fontFamily:"inherit", cursor:"pointer",
              background: beginnerMode ? "#1a2a10" : "#0a1020",
              border:"1px solid " + (beginnerMode ? "#44cc66" : "#2a4a6a"),
              borderRadius:4, color: beginnerMode ? "#44ff88" : "#5a8aaa", fontSize:9,
              padding:"6px 18px", letterSpacing:2, transition:"all .15s"}}>
            BEGINNER MODE {beginnerMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* PLAY ONLINE */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10,
            fontFamily:"'Orbitron',sans-serif"}}>00 — Play Online</div>
          {netStatus !== "in-room" && (
            <div style={{padding:"10px 12px", background:"#050810", border:"1px solid #1a2a40", borderRadius:5}}>
              <div style={{display:"flex", gap:8, marginBottom:8}}>
                <input value={playerName} onChange={e => setPlayerName(e.target.value)}
                  placeholder="YOUR NAME" maxLength={16} style={{...inputBase, flex:1}}/>
                <button onClick={() => goOnline("create")} disabled={netStatus==="connecting"}
                  style={{...btnBase, background:"#1a3020", borderColor:"#44cc66", color:"#44ff88",
                    opacity: netStatus==="connecting"?0.5:1}}>
                  {netStatus==="connecting" ? "..." : "+ CREATE ROOM"}
                </button>
              </div>
              <div style={{display:"flex", gap:8}}>
                <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE" maxLength={4}
                  onKeyDown={e => e.key === "Enter" && joinCode.trim().length === 4 && goOnline("join")}
                  style={{...inputBase, flex:1, letterSpacing:6}}/>
                <button onClick={() => goOnline("join")}
                  disabled={netStatus==="connecting" || joinCode.trim().length !== 4}
                  style={{...btnBase, background:"#1a3560", borderColor:"#4488ff", color:"#88bbff",
                    opacity:(netStatus==="connecting" || joinCode.trim().length !== 4)?0.5:1}}>
                  JOIN
                </button>
              </div>
              {netError && <div style={{marginTop:8, fontSize:9, color:"#ff6688"}}>{netError}</div>}
            </div>
          )}
          {netStatus === "in-room" && netRoom && (
            <div style={{padding:12, background:"#050810", border:"1px solid #2a4a6a", borderRadius:5}}>
              <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:10}}>
                <div>
                  <span style={{fontSize:9, color:"#3a5a7a", letterSpacing:2}}>ROOM </span>
                  <span style={{fontFamily:"'Orbitron',sans-serif", fontSize:20, color:"#f6ad55",
                    letterSpacing:6}}>{netRoom.code}</span>
                </div>
                <button onClick={leaveRoom}
                  style={{...btnBase, padding:"4px 10px", fontSize:9, background:"#301520",
                    borderColor:"#ff4488", color:"#ff88bb"}}>
                  LEAVE
                </button>
              </div>
              {netRoom.seats.map(s => (
                <div key={s.seatId} style={{display:"flex", alignItems:"center", gap:8, padding:"5px 8px",
                  marginBottom:4, background:"#080f1e", border:"1px solid #1a2a40", borderRadius:4, fontSize:10}}>
                  <span style={{color: s.connected ? "#44ff88" : "#ff6688"}}>{s.connected ? "●" : "○"}</span>
                  <span style={{color:"#c0d0e0", flex:1}}>{s.name}</span>
                  {s.seatId === netRoom.hostSeatId && <span style={{fontSize:8, color:"#f6ad55", letterSpacing:1}}>HOST</span>}
                  {s.seatId === netClient?.seatId && <span style={{fontSize:8, color:"#4488ff", letterSpacing:1}}>YOU</span>}
                </div>
              ))}
              <div style={{marginTop:8, fontSize:9, color: netDropped ? "#ff6688" : "#3a5a7a"}}>
                {netDropped
                  ? "connection lost -- reconnecting..."
                  : (isHost
                    ? "Configure the match below, then start when ready."
                    : "Waiting for host to configure and start...")}
              </div>
            </div>
          )}
        </div>

        {/* OFFLINE CONFIG */}
        {netStatus !== "in-room" && (<>
          <div style={{marginBottom:24}}>
            <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10,
              fontFamily:"'Orbitron',sans-serif"}}>01 — How Many Players?</div>
            <div style={{display:"flex", gap:8}}>
              {[2,3,4].map(n => (
                <button key={n} onClick={() => { setPlayerCount(n); setAssignments({}); setMode(null); setStep("assign"); }}
                  style={{...btnBase, flex:1, background: playerCount===n ? "#1a3560" : "#0a1020",
                    borderColor: playerCount===n ? "#4488ff" : "#1e3a5f",
                    color: playerCount===n ? "#88bbff" : "#c0d0e0"}}>
                  {n} Players
                </button>
              ))}
            </div>
          </div>
          {playerCount && (
            <div style={{marginBottom:24}}>
              <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10,
                fontFamily:"'Orbitron',sans-serif"}}>02 — Choose Your Spirit</div>
              {activeCorners.map(corner => spiritPicker(corner, null))}
            </div>
          )}
          {modeAndLives("03", handleStart, "START GAME")}
        </>)}

        {/* N3: ONLINE HOST CONFIG */}
        {netStatus === "in-room" && isHost && playerCount && (<>
          <div style={{marginBottom:24}}>
            <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10,
              fontFamily:"'Orbitron',sans-serif"}}>
              {"01 — Assign Spirits (" + netRoom.seats.filter(s => !s.isBot).length + " seats)"}
            </div>
            {activeCorners.map((corner, ci) => {
              const seat = netRoom.seats.filter(s => !s.isBot)[ci];
              return spiritPicker(corner, seat ? ("— " + seat.name) : null);
            })}
          </div>
          {modeAndLives("02", handleStartOnline, "START ONLINE GAME")}
        </>)}

        {/* Non-host waiting */}
        {netStatus === "in-room" && !isHost && (
          <div style={{textAlign:"center", padding:"20px 0", fontSize:10, color:"#3a5a7a", letterSpacing:1}}>
            Waiting for the host to configure and start the match...
          </div>
        )}
      </div>
    </div>
  );
}
