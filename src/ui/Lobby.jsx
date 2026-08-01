import { useState, useEffect, useRef } from "react";
import { SPIRIT_DEFS, SPIRIT_OPTIONS, ROSTER_ORDER, UNLOCKED_DEFAULT, IN_DEVELOPMENT, MAX_PLAYERS } from "../data/spirits.js";
import { CORNERS, CORNER_LABELS, CORNERS_ORDER } from "../data/corners.js";
import { cornerFacing } from "../board/boardHelpers.js";
import { buildTestingGroundsConfig } from "../data/matchSetup.js";
import { makeNetClient } from "../net/client.js";
import { RIFF_FALL_DIFFICULTY, RIFF_FALL_DEFAULT } from "../riff/fallingNotes.js";
import { fpPerLife } from "../data/gameConstants.js";
import menuSong3 from "../Menu_song_3.mp3";
import boardImg from "../board.png";
import boardOutlineImg from "../board_outline.png";
import boardStarsImg from "../board_stars_animated.png";
import boardLightningImg from "../board_lightning_animated.png";
import { SVG_W, SVG_H } from "../board/constants.js";

// Short display names for the riff-off difficulty row (full label in tooltip)
const RIFF_DIFF_SHORT = { rookie: 'INFLUENCER', gigging: 'GIGGING', shredder: 'SHREDDER', virtuoso: 'VIRTUOSO' };

const MENU_SONGS = [menuSong3];

export function Lobby({ onStart, onTutorial, onBackToMenu }) {
  const [playerCount, setPlayerCount] = useState(null);
  // 🏁 FFA is the STANDING DEFAULT, not a button you have to remember to press.
  // It reads from a persisted setting rather than a hardcoded literal so that
  // when multiplayer lands and Team opens up, a chosen mode can stick — FFA
  // just stays the thing you get if you never touch it. Nothing writes this key
  // yet (Team is locked), so today it always resolves to 'ffa'.
  const [mode] = useState(() => {
    try {
      const v = localStorage.getItem('rlsw.defaultMode');
      if (v === 'ffa' || v === 'team') return v;
    } catch { /* private mode / storage disabled — fall through to the default */ }
    return 'ffa';
  });
  const [assignments, setAssignments] = useState({});
  const [cpuCorners, setCpuCorners] = useState({});
  const [step, setStep] = useState("count");
  const [startingLives, setStartingLives] = useState(3);
  const [beginnerMode, setBeginnerMode] = useState(true);
  const [choosingCorner, setChoosingCorner] = useState(null);
  // 🎸 Riff-off difficulty — chosen here on the Spirit select screen and
  // persisted; the Game reads it at mount (localStorage 'rlsw.riffDifficulty').
  const [riffDiff, setRiffDiff] = useState(() => {
    try { const v = localStorage.getItem('rlsw.riffDifficulty'); if (v && RIFF_FALL_DIFFICULTY[v]) return v; } catch {}
    return RIFF_FALL_DEFAULT;
  });
  function pickRiffDiff(k) {
    setRiffDiff(k);
    try { localStorage.setItem('rlsw.riffDifficulty', k); } catch {}
  }
  const [announcer, setAnnouncer] = useState(null);
  const announcerTimer = useRef(null);
  const [unlocked] = useState(() => {
    try { const r=localStorage.getItem('rlsw.unlockedSpirits'); if(r){const a=JSON.parse(r);if(Array.isArray(a))return new Set(a);} } catch{}
    return new Set(UNLOCKED_DEFAULT);
  });
  const [netClient, setNetClient] = useState(null);
  const [netRoom, setNetRoom] = useState(null);
  const [netStatus, setNetStatus] = useState("idle");
  const [netError, setNetError] = useState("");
  const [netDropped, setNetDropped] = useState(false);
  const [playerName, setPlayerName] = useState(() => { try{return localStorage.getItem("rlsw.net.name")??"";}catch{return"";} });
  const [joinCode, setJoinCode] = useState("");
  const transitioningRef = useRef(false);
  const menuAudioRef = useRef(null);
  const menuSongStarted = useRef(false);
  // ── Menu music: pick a random song when the lobby becomes active ──
  useEffect(() => {
    const active = playerCount !== null || netStatus === "in-room";
    if (!active || menuSongStarted.current) return;
    menuSongStarted.current = true;
    const src = MENU_SONGS[Math.floor(Math.random() * MENU_SONGS.length)];
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0.45;
    audio.play().catch(() => {});
    menuAudioRef.current = audio;
  }, [playerCount, netStatus]);
  useEffect(() => () => {
    if (menuAudioRef.current) { menuAudioRef.current.pause(); menuAudioRef.current = null; }
  }, []);
  useEffect(()=>()=>{if(!transitioningRef.current)netClient?.close();},[netClient]);
  useEffect(()=>{if(!netClient)return;return netClient.on("GAME_STARTED",f=>{transitioningRef.current=true;const m=f.seats.find(s=>s.seatId===netClient.seatId);onStart({...f.config,seed:f.seed,net:{client:netClient,seatId:netClient.seatId,seats:f.seats,mySpiritId:m?.spiritId??null,isHost:netClient.seatId===netRoom?.hostSeatId}});});},[netClient,onStart]);
  useEffect(()=>{if(!netClient)return;return netClient.on("CATCH_UP",f=>{transitioningRef.current=true;const m=f.seats.find(s=>s.seatId===netClient.seatId);onStart({...f.config,seed:f.seed,net:{client:netClient,seatId:netClient.seatId,seats:f.seats,mySpiritId:m?.spiritId??null,spectator:netClient.spectator,isHost:netClient.seatId===netRoom?.hostSeatId},catchUp:{log:f.log,logLines:f.logLines}});});},[netClient,onStart]);
  const [autoRejoining, setAutoRejoining] = useState(false);
  useEffect(()=>{if(netClient)return;const p=makeNetClient();const saved=p.savedSession();if(!saved)return;setAutoRejoining(true);setNetStatus("connecting");const c=makeNetClient();c.on("ROOM_STATE",f=>setNetRoom(f));c.on("ERROR",f=>{setNetError(f.code+": "+f.msg);setAutoRejoining(false);setNetStatus("idle");c.leave();});c.on("net:close",()=>setNetDropped(true));c.on("net:open",()=>setNetDropped(false));c.connect().then(()=>{c.joinRoom(saved.code,{name:saved.name,rejoinToken:saved.rejoinToken});return c.waitFor("WELCOME",{ms:5000});}).then(()=>{setNetClient(c);setNetStatus("in-room");setAutoRejoining(false);}).catch(()=>{c.close();setAutoRejoining(false);setNetStatus("idle");try{localStorage.removeItem("rlsw.net.session");}catch{}});},[]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(!netClient)return;return netClient.on("BOOTED",()=>{netClient.leave();setNetClient(null);setNetRoom(null);setNetStatus("idle");setNetDropped(false);setNetError("You were removed from the room by the host.");});},[netClient]);
  const isHost = netClient?.seatId===netRoom?.hostSeatId;
  useEffect(()=>{if(netStatus==="in-room"&&netRoom&&isHost){const n=netRoom.seats.filter(s=>!s.isBot).length;if(n>=2&&n<=4){setPlayerCount(n);setAssignments({});}}},[netStatus,netRoom?.seats?.length]);
  async function goOnline(kind){const name=playerName.trim()||"Player";try{localStorage.setItem("rlsw.net.name",name);}catch{}setNetStatus("connecting");setNetError("");const c=makeNetClient();c.on("ROOM_STATE",f=>setNetRoom(f));c.on("ERROR",f=>setNetError(f.code+": "+f.msg));c.on("net:close",()=>setNetDropped(true));c.on("net:open",()=>setNetDropped(false));try{await c.connect();if(kind==="create")c.createRoom(name);else c.joinRoom(joinCode.trim().toUpperCase(),{name});await c.waitFor("WELCOME");setNetClient(c);setNetStatus("in-room");}catch(e){c.close();setNetStatus("idle");setNetError(String(e.message??e));}}
  function leaveRoom(){netClient?.leave();setNetClient(null);setNetRoom(null);setNetStatus("idle");setNetDropped(false);}
  const activeCorners = playerCount===2?["blue","red"]:playerCount?CORNERS_ORDER.slice(0,playerCount):[];
  const usedSpirits = new Set(Object.values(assignments));
  const allAssigned = activeCorners.every(c=>assignments[c]);
  useEffect(()=>{if(!playerCount)return;setCpuCorners(prev=>{const next={...prev};activeCorners.forEach((c,i)=>{if(next[c]===undefined)next[c]=i!==0;});return next;});},[playerCount]);
  useEffect(()=>{if(!playerCount){setChoosingCorner(null);return;}const f=activeCorners.find(c=>!assignments[c]);setChoosingCorner(f??null);},[playerCount]);
  function assign(corner,spiritId){setAssignments(a=>({...a,[corner]:spiritId}));const sp=SPIRIT_DEFS[spiritId];if(sp){if(announcerTimer.current)clearTimeout(announcerTimer.current);setAnnouncer({name:sp.name,color:sp.color});announcerTimer.current=setTimeout(()=>setAnnouncer(null),700);}const nA={...assignments,[corner]:spiritId};setChoosingCorner(activeCorners.find(c=>!nA[c])??null);}
  function handleStart(){const spirits=activeCorners.map(corner=>{const def=SPIRIT_DEFS[assignments[corner]];const{homeNum}=CORNERS[corner];const facing=cornerFacing(homeNum);const{color:cc}=CORNER_LABELS[corner];return{...def,num:homeNum,facing,corner,color:cc,cpu:!!cpuCorners[corner]};});const teams=mode==="team"?{a:activeCorners.slice(0,2),b:activeCorners.slice(2,4)}:null;onStart({spirits,mode,teams,startingLives,beginnerMode});}
  function handleStartOnline(){const hs=netRoom.seats.filter(s=>!s.isBot);const spirits=activeCorners.map((corner,ci)=>{const def=SPIRIT_DEFS[assignments[corner]];const{homeNum}=CORNERS[corner];const facing=cornerFacing(homeNum);const{color:cc}=CORNER_LABELS[corner];return{...def,num:homeNum,facing,corner,color:cc,cpu:ci>=hs.length};});const teams=mode==="team"?{a:activeCorners.slice(0,2),b:activeCorners.slice(2,4)}:null;const config={spirits,mode,teams,startingLives,beginnerMode};const seatMap=hs.map((s,i)=>({seatId:s.seatId,spiritId:activeCorners[i]?assignments[activeCorners[i]]:null}));const botSeats=activeCorners.slice(hs.length).map(c=>({name:SPIRIT_DEFS[assignments[c]]?.name??"Bot",spiritId:assignments[c]}));netClient.startGame(config,{seatMap,botSeats:botSeats.length?botSeats:undefined});}
  function startTestingGrounds(){onStart(buildTestingGroundsConfig({beginnerMode}));}
  const iBase={fontFamily:"inherit",background:"#0a1020",border:"1px solid #1e3a5f",borderRadius:4,color:"#c0d0e0",fontSize:11,padding:"8px 10px",outline:"none"};
  const seg=(on,ac="#4488ff")=>({fontFamily:"'Saira Stencil One',sans-serif",cursor:"pointer",borderRadius:4,padding:"6px 14px",fontSize:10,letterSpacing:1,transition:"all .15s",border:"1px solid",background:on?ac+"22":"#0a1020",borderColor:on?ac:"#1e3a5f",color:on?ac:"#5a7a9a"});
  const online=netStatus==="in-room", showCfg=online?isHost:true, canGo=allAssigned;  // mode is always FFA now — a full roster is the only gate

  return (
    <div style={{minHeight:"100vh",background:"#050810",display:"flex",flexDirection:"column",fontFamily:"'Share Tech Mono','Courier New',monospace",overflow:"hidden",position:"relative"}}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Saira+Stencil+One&family=Saira:wght@400;600;700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#2d3748}
@keyframes chooser-pulse{0%,100%{box-shadow:0 0 12px #fff2}50%{box-shadow:0 0 24px #fff4,inset 0 0 12px #fff1}}
@keyframes announcer-in{0%{opacity:0;letter-spacing:12px;transform:scale(1.3)}30%{opacity:1}100%{opacity:0;letter-spacing:28px;transform:scale(1)}}
/* ⚡ The bolt across the island. It always had a crackle, but at .12 idle — under
   a backdrop already dimmed to 18% opacity and 0.6 brightness — it never actually
   surfaced. Idle sits at .55 now and the flares reach full, so the bolt reads as
   a live strike the way it does on the game board instead of a hint of one.
   Note the flares are already at opacity 1: past this point the only way UP is
   the brightness filter on .lobby-lightning below, not these numbers. */
@keyframes lobby-lightning-crackle{0%,88%,100%{opacity:.55}89%{opacity:1}90.5%{opacity:.64}92%{opacity:.95}93.5%{opacity:.5}95%{opacity:.88}96.5%{opacity:.58}}
/* The bolt sits inside a group dimmed to .24 opacity and 0.72 brightness, so it
   can never out-glow its parent on opacity alone. This filter multiplies against
   that 0.72 to put the strike back up around full brightness while the rest of
   the island stays down where the menu text can live on top of it. Raise it to
   punch harder; it only ever touches the lightning layer. Screen blend means a
   brighter source really does mean a brighter composite. */
.lobby-lightning{filter:brightness(1.75)}
/* A strobing bolt behind a menu is exactly what this flag is for — hold it lit. */
@media (prefers-reduced-motion: reduce){
  .lobby-lightning{animation:none!important;opacity:.55}
}
@keyframes lobby-outline-pulse{0%,100%{opacity:.25;filter:brightness(0.7) drop-shadow(0 0 2px #ff00ee44)}50%{opacity:.45;filter:brightness(1.0) drop-shadow(0 0 6px #ff44ff44) drop-shadow(0 0 14px #aa00aa44)}}
@keyframes lobby-stars-drift{0%,100%{opacity:.08}50%{opacity:.18}}
/* (lobby-float removed — it was the bob that made the backdrop read as a floating
   window. Nothing references it now; the island is full-bleed and still.) */`}</style>
      {/* ── ISLAND BACKGROUND ── full-bleed, crackles with thunder ───────────────
          Was a "floating island": an 800px-capped board bobbing up and down in the
          middle of the screen, which read as a small window sitting on the page
          rather than as the world behind the menu. Now it fills the viewport.

          `slice` on the SVG itself is what makes that work: the default `meet`
          would letterbox the viewBox into the window and hand back the very margins
          we're trying to kill. `slice` scales to COVER and crops the overflow
          instead — fine here, because this is scenery, not the playable grid.

          The bob is gone too (it was the literal float). Nothing is centred any
          more, so the flex centring on the wrapper goes with it. */}
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* (the float wrapper div that used to sit here went with its animation) */}
        <svg width="100%" height="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid slice"
          style={{display:"block",width:"100%",height:"100%",opacity:0.24,filter:"brightness(0.72) saturate(0.5)"}}>
          <image href={boardImg} x={0} y={0} width={SVG_W} height={SVG_H} preserveAspectRatio="xMidYMid slice"/>
          {/* Stars — subtle twinkle */}
          <image href={boardStarsImg} x={0} y={0} width={SVG_W} height={SVG_H}
            preserveAspectRatio="xMidYMid meet"
            style={{mixBlendMode:"screen",animation:"lobby-stars-drift 6s ease-in-out infinite"}}/>
          {/* Lightning — crackle animation. 4.7s, off-beat from the 5s outline
              pulse: on the same period the two read as one mechanical throb. */}
          <image href={boardLightningImg} className="lobby-lightning" x={0} y={0} width={SVG_W} height={SVG_H}
            preserveAspectRatio="xMidYMid slice"
            style={{mixBlendMode:"screen",animation:"lobby-lightning-crackle 4.7s ease-in-out infinite"}}/>
          {/* Outline glow — dim pulsing */}
          <defs>
            <filter id="lobby-outline-crush" colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="gamma" amplitude="1" exponent="0.5" offset="-0.18"/>
                <feFuncG type="gamma" amplitude="1" exponent="0.5" offset="-0.18"/>
                <feFuncB type="gamma" amplitude="1" exponent="0.5" offset="-0.18"/>
                <feFuncA type="linear" slope="1" intercept="0"/>
              </feComponentTransfer>
            </filter>
          </defs>
          <image href={boardOutlineImg} x={0} y={0} width={SVG_W} height={SVG_H}
            preserveAspectRatio="xMidYMid slice"
            style={{mixBlendMode:"screen",filter:"url(#lobby-outline-crush) blur(3px)",animation:"lobby-outline-pulse 5s ease-in-out infinite"}}/>
          <image href={boardOutlineImg} x={0} y={0} width={SVG_W} height={SVG_H}
            preserveAspectRatio="xMidYMid slice"
            style={{mixBlendMode:"screen",filter:"url(#lobby-outline-crush)",opacity:0.5,animation:"lobby-outline-pulse 5s ease-in-out infinite"}}/>
        </svg>
      </div>
      {autoRejoining&&<div style={{position:"fixed",inset:0,zIndex:100,background:"#050810ee",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}><div style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:16,color:"#f6ad55",letterSpacing:4}}>RECONNECTING</div><div style={{fontSize:10,color:"#3a5a7a",letterSpacing:1}}>Reclaiming your seat...</div></div>}
      {announcer&&<div style={{position:"fixed",inset:0,zIndex:90,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}><div style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:48,fontWeight:700,color:announcer.color,textShadow:"0 0 30px "+announcer.color+", 0 0 60px "+announcer.color+"55",animation:"announcer-in 700ms ease-out forwards",whiteSpace:"nowrap"}}>{announcer.name.toUpperCase()}</div></div>}
      {/* HEADER */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 24px",borderBottom:"1px solid #1a2a40",flexShrink:0,position:"relative",zIndex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {onBackToMenu&&<button onClick={onBackToMenu} title="Back to the main menu" style={{fontFamily:"inherit",cursor:"pointer",background:"#0a1020",border:"1px solid #2a4a6a",borderRadius:4,color:"#5a8aaa",fontSize:9,padding:"6px 12px",letterSpacing:1,transition:"all .15s"}} onMouseEnter={e=>{e.target.style.borderColor="#f6ad55";e.target.style.color="#f6ad55";}} onMouseLeave={e=>{e.target.style.borderColor="#2a4a6a";e.target.style.color="#5a8aaa";}}>← MENU</button>}
          <span style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:20,color:"#f6ad55",letterSpacing:4,fontWeight:700}}>RLSW</span>
          <span style={{fontSize:10,color:"#3a5a7a",letterSpacing:2}}>SPIRIT WARS</span></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onTutorial} style={{fontFamily:"inherit",cursor:"pointer",background:"#0a1020",border:"1px solid #2a4a6a",borderRadius:4,color:"#5a8aaa",fontSize:9,padding:"6px 14px",letterSpacing:1,transition:"all .15s"}} onMouseEnter={e=>{e.target.style.borderColor="#4488ff";e.target.style.color="#88bbff";}} onMouseLeave={e=>{e.target.style.borderColor="#2a4a6a";e.target.style.color="#5a8aaa";}}>HOW TO PLAY</button>
          <button onClick={()=>setBeginnerMode(b=>!b)} style={{fontFamily:"inherit",cursor:"pointer",background:beginnerMode?"#1a2a10":"#0a1020",border:"1px solid "+(beginnerMode?"#44cc66":"#2a4a6a"),borderRadius:4,color:beginnerMode?"#44ff88":"#5a8aaa",fontSize:9,padding:"6px 14px",letterSpacing:1,transition:"all .15s"}}>BEGINNER {beginnerMode?'ON':'OFF'}</button></div>
      </div>
      {/* BODY */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"auto",padding:"0 24px",position:"relative",zIndex:1}}>
{/* ONLINE */}
        <div style={{padding:"12px 0"}}>
          {netStatus!=="in-room"&&<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="YOUR NAME" maxLength={16} style={{...iBase,width:140}}/>
            <button onClick={()=>goOnline("create")} disabled={netStatus==="connecting"} style={{...seg(false),background:"#1a3020",borderColor:"#44cc66",color:"#44ff88",opacity:netStatus==="connecting"?0.5:1,cursor:"pointer"}}>+ CREATE ROOM</button>
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="CODE" maxLength={4} onKeyDown={e=>e.key==="Enter"&&joinCode.trim().length===4&&goOnline("join")} style={{...iBase,width:80,letterSpacing:6,textAlign:"center"}}/>
            <button onClick={()=>goOnline("join")} disabled={netStatus==="connecting"||joinCode.trim().length!==4} style={{...seg(false),background:"#1a3560",borderColor:"#4488ff",color:"#88bbff",opacity:(netStatus==="connecting"||joinCode.trim().length!==4)?0.5:1,cursor:"pointer"}}>JOIN</button>
            {netError&&<span style={{fontSize:9,color:"#ff6688"}}>{netError}</span>}
          </div>}
          {netStatus==="in-room"&&netRoom&&<div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",padding:"8px 12px",background:"#050810",border:"1px solid #2a4a6a",borderRadius:6}}>
            <span style={{fontSize:9,color:"#3a5a7a",letterSpacing:2}}>ROOM</span>
            <span style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:18,color:"#f6ad55",letterSpacing:6}}>{netRoom.code}</span>
            <div style={{display:"flex",gap:6,flex:1,flexWrap:"wrap"}}>{netRoom.seats.map(s=><div key={s.seatId} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:"#080f1e",border:"1px solid #1a2a40",borderRadius:4,fontSize:9}}>
              <span style={{color:s.connected?"#44ff88":"#ff6688"}}>{s.connected?"●":"○"}</span><span style={{color:"#c0d0e0"}}>{s.name}</span>
              {s.seatId===netRoom.hostSeatId&&<span style={{color:"#f6ad55",letterSpacing:1}}>HOST</span>}
              {s.seatId===netClient?.seatId&&<span style={{color:"#4488ff",letterSpacing:1}}>YOU</span>}
              {isHost&&s.seatId!==netClient?.seatId&&!s.isBot&&<button onClick={()=>netClient.send({t:"BOOT_PLAYER",seatId:s.seatId})} style={{fontFamily:"inherit",cursor:"pointer",padding:"1px 6px",fontSize:8,background:"#301520",border:"1px solid #ff4488",borderRadius:3,color:"#ff88bb"}}>✕</button>}
            </div>)}</div>
            <button onClick={leaveRoom} style={{fontFamily:"inherit",cursor:"pointer",padding:"4px 10px",fontSize:9,background:"#301520",border:"1px solid #ff4488",borderRadius:4,color:"#ff88bb"}}>LEAVE</button>
            {netDropped&&<span style={{fontSize:9,color:"#ff6688"}}>connection lost — reconnecting...</span>}
          </div>}
        </div>
        {online&&!isHost&&<div style={{textAlign:"center",padding:"40px 0",fontSize:11,color:"#3a5a7a",letterSpacing:1}}>Waiting for the host to configure and start the match...</div>}
        {showCfg&&<>
          {/* PLAYER COUNT */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
            {!online&&<><span style={{fontSize:9,color:"#3a5a7a",letterSpacing:2,fontFamily:"'Saira Stencil One',sans-serif"}}>PLAYERS</span>
              {/* Every Spirit is unique per match, so the playable roster caps
                  the player count. With two Spirits still in development, 3P/4P
                  can't be filled — they're shown disabled with the reason. */}
              <div style={{display:"flex",gap:6}}>{[2,3,4].map(n=>{
                const tooMany=n>MAX_PLAYERS;
                return<button key={n} disabled={tooMany}
                  title={tooMany?`Needs ${n} finished Spirits — only ${MAX_PLAYERS} are built out right now.`:`${n}-player match`}
                  onClick={()=>{if(tooMany)return;setPlayerCount(n);setAssignments({});setStep("assign");}}
                  style={{...seg(playerCount===n),...(tooMany?{opacity:0.3,cursor:"not-allowed",borderColor:"#1a2a40",color:"#2a3a4a"}:{})}}>{n}P</button>;})}</div>
              {MAX_PLAYERS<4&&<span style={{fontSize:8,color:"#3a5a7a"}}>🚧 {4-MAX_PLAYERS} Spirit{4-MAX_PLAYERS!==1?'s':''} still in development</span>}</>}
            {online&&isHost&&playerCount&&<><span style={{fontSize:9,color:"#3a5a7a",letterSpacing:2,fontFamily:"'Saira Stencil One',sans-serif"}}>{playerCount} PLAYERS</span>
              {playerCount<MAX_PLAYERS&&<button onClick={()=>{setPlayerCount(p=>Math.min(MAX_PLAYERS,p+1));setAssignments({});}} style={{...seg(false),background:"#1a2a10",borderColor:"#44cc66",color:"#44ff88",cursor:"pointer"}}>+ Bot</button>}
              {playerCount>(netRoom?.seats?.filter(s=>!s.isBot).length??2)&&<button onClick={()=>{setPlayerCount(p=>Math.max(netRoom.seats.filter(s=>!s.isBot).length,p-1));setAssignments({});}} style={{...seg(false),background:"#301520",borderColor:"#ff4488",color:"#ff88bb",cursor:"pointer"}}>− Bot</button>}</>}
          </div>
          {/* ROSTER */}
          {playerCount&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",gap:12,maxWidth:780,margin:"0 auto 20px",width:"100%"}}>{ROSTER_ORDER.map(id=>{
            const sp=SPIRIT_DEFS[id];if(!unlocked.has(id))return<div key={id} style={{aspectRatio:"3/4",background:"#080f1e",border:"2px solid #1a2a40",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",opacity:0.4,cursor:"not-allowed"}}><span style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:36,color:"#1e3a5f"}}>?</span></div>;
            // 🚧 IN DEVELOPMENT — the art is done, the kit isn't. Shown so players
            // know who's coming, but desaturated and unclickable.
            if(IN_DEVELOPMENT.has(id))return<div key={id} title={`${sp.name} is still being built — their kit isn't finished yet.`}
              style={{aspectRatio:"3/4",background:"#080f1e",position:"relative",border:"2px dashed #2a3a4a",borderRadius:8,overflow:"hidden",cursor:"not-allowed"}}>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"8%"}}>
                <img src={sp.imageSrc} alt={sp.name} draggable={false} style={{width:"85%",height:"85%",objectFit:"contain",objectPosition:"top",filter:"grayscale(1) brightness(0.45)",opacity:0.55,pointerEvents:"none"}}/></div>
              <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(-45deg,#00000000 0px,#00000000 9px,#0a1424aa 9px,#0a1424aa 18px)",pointerEvents:"none"}}/>
              <div style={{position:"absolute",top:"46%",left:0,right:0,textAlign:"center"}}>
                <div style={{display:"inline-block",padding:"3px 8px",background:"#0a1020ee",border:"1px solid #3a5a7a",borderRadius:3,fontFamily:"'Saira Stencil One',sans-serif",fontSize:8,letterSpacing:1.5,color:"#6a8aaa"}}>🚧 IN DEVELOPMENT</div></div>
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent, #050810ee 40%)",padding:"20px 8px 8px",textAlign:"center"}}>
                <div style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:10,fontWeight:700,color:"#3a5a7a",letterSpacing:1}}>{sp.name.toUpperCase()}</div>
                <div style={{fontSize:8,color:"#2a4a6a",marginTop:2}}>COMING SOON</div></div>
            </div>;
            const tb=Object.entries(assignments).find(([,v])=>v===id)?.[0],tbo=tb&&tb!==choosingCorner,sel=choosingCorner&&assignments[choosingCorner]===id;
            const gl=sel?sp.color:tbo?"#1e3a5f":"#1a2a40",chip=tb?CORNER_LABELS[tb]:null;
            return<div key={id} onClick={()=>{if(!tbo&&choosingCorner)assign(choosingCorner,id);}}
              style={{aspectRatio:"3/4",background:"#080f1e",position:"relative",border:"2px solid "+gl,borderRadius:8,overflow:"hidden",cursor:(tbo||!choosingCorner)?"not-allowed":"pointer",opacity:tbo?0.35:1,transition:"all .15s",boxShadow:sel?"0 0 20px "+sp.color+"44, inset 0 0 20px "+sp.color+"22":"none"}}
              onMouseEnter={e=>{if(!tbo&&choosingCorner){e.currentTarget.style.transform="scale(1.04)";e.currentTarget.style.boxShadow="0 0 24px "+sp.color+"55";e.currentTarget.style.borderColor=sp.color;}}}
              onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";if(!sel){e.currentTarget.style.boxShadow="none";e.currentTarget.style.borderColor=gl;}}}>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"8%"}}><img src={sp.imageSrc} alt={sp.name} draggable={false} style={{width:"85%",height:"85%",objectFit:"contain",objectPosition:"top",filter:tbo?"saturate(0.2)":"none",pointerEvents:"none"}}/></div>
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent, #050810ee 40%)",padding:"20px 8px 8px",textAlign:"center"}}>
                <div style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:10,fontWeight:700,color:tbo?"#3a5a7a":sp.color,letterSpacing:1,textShadow:tbo?"none":"0 0 8px "+sp.color+"88"}}>{sp.name.toUpperCase()}</div>
                <div style={{fontSize:8,color:"#5a7a9a",marginTop:2}}>{sp.style} · D{sp.drive} S{sp.sustain} SP{sp.speed}</div></div>
              {chip&&<div style={{position:"absolute",top:6,right:6,padding:"2px 6px",background:chip.color+"33",border:"1px solid "+chip.color,borderRadius:3,fontSize:7,color:chip.color,fontWeight:700,letterSpacing:1}}>{chip.label.split(" ")[0].toUpperCase()}</div>}
            </div>})}</div>}
          {/* PLAYER CARDS */}
          {playerCount&&<div style={{display:"grid",gridTemplateColumns:"repeat("+activeCorners.length+", 1fr)",gap:12,maxWidth:900,margin:"0 auto 16px",width:"100%"}}>{activeCorners.map((corner,ci)=>{
            const{label,color}=CORNER_LABELS[corner],sid=assignments[corner],sp=sid?SPIRIT_DEFS[sid]:null,ic=choosingCorner===corner,ir=ci>=activeCorners.length/2;
            const sn=online&&netRoom?(()=>{const hs=netRoom.seats.filter(s=>!s.isBot);return ci>=hs.length?"BOT":hs[ci]?.name??null;})():null;
            return<div key={corner} onClick={()=>{if(playerCount)setChoosingCorner(corner);}}
              style={{background:"#080f1e",border:"2px solid "+(ic?color:color+"44"),borderRadius:8,padding:"12px",cursor:"pointer",minHeight:160,display:"flex",flexDirection:"column",transition:"all .2s",animation:ic?"chooser-pulse 1.5s ease-in-out infinite":"none"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:10,color,fontWeight:700,letterSpacing:1}}>{label.split(" ")[0].toUpperCase()}</span>{sn&&<span style={{fontSize:8,color:"#5a7a9a"}}>{sn}</span>}</div>
                {!online&&<label style={{fontSize:8,color:cpuCorners[corner]?"#44ff88":"#3a5a7a",cursor:"pointer",display:"flex",alignItems:"center",gap:3,userSelect:"none"}} onClick={e=>e.stopPropagation()}><input type="checkbox" checked={!!cpuCorners[corner]} onChange={e=>setCpuCorners(c=>({...c,[corner]:e.target.checked}))} style={{accentColor:"#44cc66",cursor:"pointer",width:12,height:12}}/>CPU</label>}
              </div>
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {sp?<div style={{textAlign:"center"}}><img src={sp.imageSrc} alt={sp.name} draggable={false} style={{height:80,objectFit:"contain",transform:ir?"scaleX(-1)":"none",filter:"drop-shadow(0 0 8px "+sp.color+"66)",pointerEvents:"none"}}/><div style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:10,color:sp.color,letterSpacing:1,marginTop:4,textShadow:"0 0 8px "+sp.color+"55"}}>{sp.name.toUpperCase()}</div><div style={{fontSize:8,color:"#5a7a9a",marginTop:2}}>D{sp.drive} · S{sp.sustain} · SP{sp.speed}</div></div>
                :<div style={{textAlign:"center",opacity:0.4}}><div style={{width:50,height:70,border:"2px dashed "+color+"44",borderRadius:8,margin:"0 auto 6px"}}/><div style={{fontSize:9,color:color+"88",letterSpacing:1}}>{ic?"PICK YOUR SPIRIT":"WAITING"}</div></div>}
              </div></div>})}</div>}
          {/* SETTINGS */}
          {playerCount&&<div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",maxWidth:900,margin:"0 auto 20px",width:"100%",padding:"12px 16px",background:"#080f1e",borderRadius:8,border:"1px solid #1a2a40"}}>
            {/* MODE — FFA is on by default and stays on. TEAM is parked until
                multiplayer is built out; it's shown disabled rather than hidden
                so it reads as "planned", not "missing". */}
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>MODE</span>
              <button title="Free-for-all — the standard match. Everyone for themselves." style={{...seg(true,"#4488ff"),cursor:"default"}}>FFA</button>
              <button disabled title="Team mode arrives with multiplayer. FFA is the standard until then."
                style={{...seg(false,"#aa55ff"),opacity:0.3,cursor:"not-allowed",borderColor:"#1a2a40",color:"#2a3a4a"}}>TEAM 🔒</button>
              <span style={{fontSize:8,color:"#3a5a7a"}}>standard</span></div>
            <div style={{width:1,height:20,background:"#1a2a40"}}/>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>KDs</span>
              {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setStartingLives(n)} style={{...seg(startingLives===n,"#ff4488"),padding:"6px 10px"}}>{n}</button>)}</div>
            <div style={{width:1,height:20,background:"#1a2a40"}}/>
            {/* 🎸 Riff-off difficulty — still settable here because it changes
                how duels play in THIS match, but the trainers that share the
                setting now live under Riff Mode on the main menu. */}
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>🎸 RIFF-OFF</span>
              {Object.entries(RIFF_FALL_DIFFICULTY).map(([k,p])=>
                <button key={k} onClick={()=>pickRiffDiff(k)} title={`${p.label} — ${p.blurb}`}
                  style={{...seg(riffDiff===k,"#f6ad55"),padding:"6px 10px"}}>{p.icon} {RIFF_DIFF_SHORT[k] ?? k.toUpperCase()}</button>)}
            </div>
            <div style={{width:1,height:20,background:"#1a2a40"}}/>
            <span style={{fontSize:8,color:"#3a5a7a",flex:1,minWidth:100}}>{startingLives===1?`Sudden death — ${fpPerLife(playerCount ?? 2)} FP to win`:`${startingLives} Knock Downs = KO — ${startingLives*fpPerLife(playerCount ?? 2)} FP to win`}{startingLives>=3?" 🤘":""}</span>
            <button onClick={online?handleStartOnline:handleStart} disabled={!canGo} style={{fontFamily:"'Saira Stencil One',sans-serif",cursor:canGo?"pointer":"not-allowed",borderRadius:6,padding:"10px 28px",fontSize:13,fontWeight:700,letterSpacing:3,transition:"all .2s",border:"2px solid",background:canGo?"#1a3020":"#0a1020",borderColor:canGo?"#44cc66":"#1e3a5f",color:canGo?"#44ff88":"#2a3a4a",boxShadow:canGo?"0 0 20px #44cc6633":"none",opacity:canGo?1:0.5}}>{online?"START ONLINE":"START"}</button>
          </div>}
        </>}
      </div>
      {/* (The floating RECON / DISCORD / LEGENDS buttons moved to Riff Mode on
          the main menu — they're trainers, not match setup, and they were
          cluttering the corner of the lobby. Testing Grounds stays reachable
          from here as well as the menu, since it's the fastest way onto a board
          while you're already staring at one.) */}
      {netStatus!=="in-room"&&<div style={{position:'fixed',bottom:14,right:14,zIndex:50,display:'flex',gap:8,alignItems:'center'}}>
        <button onClick={startTestingGrounds} title="Skip setup — drop straight onto the board with dev tools on" style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:10,letterSpacing:1,cursor:'pointer',padding:'9px 14px',borderRadius:7,background:'#2a1030',border:'1.5px solid #cc66ff',color:'#e0a0ff',boxShadow:'0 0 18px #cc66ff55'}}>🧪 TESTING GROUNDS</button>
      </div>}
    </div>
  );
}
