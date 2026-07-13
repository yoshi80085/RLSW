import { useState, useEffect, useRef } from "react";
import { SPIRIT_DEFS, SPIRIT_OPTIONS, ROSTER_ORDER, UNLOCKED_DEFAULT } from "../data/spirits.js";
import { CORNERS, CORNER_LABELS, CORNERS_ORDER } from "../data/corners.js";
import { cornerFacing } from "../board/boardHelpers.js";
import { makeNetClient } from "../net/client.js";

export function Lobby({ onStart, onTutorial }) {
  const [playerCount, setPlayerCount] = useState(null);
  const [mode, setMode] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [cpuCorners, setCpuCorners] = useState({});
  const [step, setStep] = useState("count");
  const [startingLives, setStartingLives] = useState(3);
  const [beginnerMode, setBeginnerMode] = useState(true);
  const [choosingCorner, setChoosingCorner] = useState(null);
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
  function startTestingGrounds(){const ids=Object.keys(SPIRIT_DEFS);const spirits=CORNERS_ORDER.map((corner,i)=>{const def=SPIRIT_DEFS[ids[i%ids.length]];const{homeNum}=CORNERS[corner];const facing=cornerFacing(homeNum);const{color:cc}=CORNER_LABELS[corner];return{...def,num:homeNum,facing,corner,color:cc,cpu:i!==0};});onStart({spirits,mode:"ffa",teams:null,startingLives:3,testMode:true,beginnerMode});}
  const iBase={fontFamily:"inherit",background:"#0a1020",border:"1px solid #1e3a5f",borderRadius:4,color:"#c0d0e0",fontSize:11,padding:"8px 10px",outline:"none"};
  const seg=(on,ac="#4488ff")=>({fontFamily:"'Orbitron',sans-serif",cursor:"pointer",borderRadius:4,padding:"6px 14px",fontSize:10,letterSpacing:1,transition:"all .15s",border:"1px solid",background:on?ac+"22":"#0a1020",borderColor:on?ac:"#1e3a5f",color:on?ac:"#5a7a9a"});
  const online=netStatus==="in-room", showCfg=online?isHost:true, canGo=allAssigned&&mode;

  return (
    <div style={{minHeight:"100vh",background:"#050810",display:"flex",flexDirection:"column",fontFamily:"'Share Tech Mono','Courier New',monospace",overflow:"hidden",position:"relative"}}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#2d3748}
@keyframes chooser-pulse{0%,100%{box-shadow:0 0 12px #fff2}50%{box-shadow:0 0 24px #fff4,inset 0 0 12px #fff1}}
@keyframes announcer-in{0%{opacity:0;letter-spacing:12px;transform:scale(1.3)}30%{opacity:1}100%{opacity:0;letter-spacing:28px;transform:scale(1)}}`}</style>
      {autoRejoining&&<div style={{position:"fixed",inset:0,zIndex:100,background:"#050810ee",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}><div style={{fontFamily:"'Orbitron',sans-serif",fontSize:16,color:"#f6ad55",letterSpacing:4}}>RECONNECTING</div><div style={{fontSize:10,color:"#3a5a7a",letterSpacing:1}}>Reclaiming your seat...</div></div>}
      {announcer&&<div style={{position:"fixed",inset:0,zIndex:90,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}><div style={{fontFamily:"'Orbitron',sans-serif",fontSize:48,fontWeight:700,color:announcer.color,textShadow:"0 0 30px "+announcer.color+", 0 0 60px "+announcer.color+"55",animation:"announcer-in 700ms ease-out forwards",whiteSpace:"nowrap"}}>{announcer.name.toUpperCase()}</div></div>}
      {/* HEADER */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 24px",borderBottom:"1px solid #1a2a40",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"baseline",gap:12}}>
          <span style={{fontFamily:"'Orbitron',sans-serif",fontSize:20,color:"#f6ad55",letterSpacing:4,fontWeight:700}}>RLSW</span>
          <span style={{fontSize:10,color:"#3a5a7a",letterSpacing:2}}>SPIRIT WARS</span></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onTutorial} style={{fontFamily:"inherit",cursor:"pointer",background:"#0a1020",border:"1px solid #2a4a6a",borderRadius:4,color:"#5a8aaa",fontSize:9,padding:"6px 14px",letterSpacing:1,transition:"all .15s"}} onMouseEnter={e=>{e.target.style.borderColor="#4488ff";e.target.style.color="#88bbff";}} onMouseLeave={e=>{e.target.style.borderColor="#2a4a6a";e.target.style.color="#5a8aaa";}}>HOW TO PLAY</button>
          <button onClick={()=>setBeginnerMode(b=>!b)} style={{fontFamily:"inherit",cursor:"pointer",background:beginnerMode?"#1a2a10":"#0a1020",border:"1px solid "+(beginnerMode?"#44cc66":"#2a4a6a"),borderRadius:4,color:beginnerMode?"#44ff88":"#5a8aaa",fontSize:9,padding:"6px 14px",letterSpacing:1,transition:"all .15s"}}>BEGINNER {beginnerMode?'ON':'OFF'}</button></div>
      </div>
      {/* BODY */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"auto",padding:"0 24px"}}>
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
            <span style={{fontFamily:"'Orbitron',sans-serif",fontSize:18,color:"#f6ad55",letterSpacing:6}}>{netRoom.code}</span>
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
            {!online&&<><span style={{fontSize:9,color:"#3a5a7a",letterSpacing:2,fontFamily:"'Orbitron',sans-serif"}}>PLAYERS</span>
              <div style={{display:"flex",gap:6}}>{[2,3,4].map(n=><button key={n} onClick={()=>{setPlayerCount(n);setAssignments({});setMode(null);setStep("assign");}} style={seg(playerCount===n)}>{n}P</button>)}</div></>}
            {online&&isHost&&playerCount&&<><span style={{fontSize:9,color:"#3a5a7a",letterSpacing:2,fontFamily:"'Orbitron',sans-serif"}}>{playerCount} PLAYERS</span>
              {playerCount<4&&<button onClick={()=>{setPlayerCount(p=>Math.min(4,p+1));setAssignments({});setMode(null);}} style={{...seg(false),background:"#1a2a10",borderColor:"#44cc66",color:"#44ff88",cursor:"pointer"}}>+ Bot</button>}
              {playerCount>(netRoom?.seats?.filter(s=>!s.isBot).length??2)&&<button onClick={()=>{setPlayerCount(p=>Math.max(netRoom.seats.filter(s=>!s.isBot).length,p-1));setAssignments({});setMode(null);}} style={{...seg(false),background:"#301520",borderColor:"#ff4488",color:"#ff88bb",cursor:"pointer"}}>− Bot</button>}</>}
          </div>
          {/* ROSTER */}
          {playerCount&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",gap:12,maxWidth:780,margin:"0 auto 20px",width:"100%"}}>{ROSTER_ORDER.map(id=>{
            const sp=SPIRIT_DEFS[id];if(!unlocked.has(id))return<div key={id} style={{aspectRatio:"3/4",background:"#080f1e",border:"2px solid #1a2a40",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",opacity:0.4,cursor:"not-allowed"}}><span style={{fontFamily:"'Orbitron',sans-serif",fontSize:36,color:"#1e3a5f"}}>?</span></div>;
            const tb=Object.entries(assignments).find(([,v])=>v===id)?.[0],tbo=tb&&tb!==choosingCorner,sel=choosingCorner&&assignments[choosingCorner]===id;
            const gl=sel?sp.color:tbo?"#1e3a5f":"#1a2a40",chip=tb?CORNER_LABELS[tb]:null;
            return<div key={id} onClick={()=>{if(!tbo&&choosingCorner)assign(choosingCorner,id);}}
              style={{aspectRatio:"3/4",background:"#080f1e",position:"relative",border:"2px solid "+gl,borderRadius:8,overflow:"hidden",cursor:(tbo||!choosingCorner)?"not-allowed":"pointer",opacity:tbo?0.35:1,transition:"all .15s",boxShadow:sel?"0 0 20px "+sp.color+"44, inset 0 0 20px "+sp.color+"22":"none"}}
              onMouseEnter={e=>{if(!tbo&&choosingCorner){e.currentTarget.style.transform="scale(1.04)";e.currentTarget.style.boxShadow="0 0 24px "+sp.color+"55";e.currentTarget.style.borderColor=sp.color;}}}
              onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";if(!sel){e.currentTarget.style.boxShadow="none";e.currentTarget.style.borderColor=gl;}}}>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"8%"}}><img src={sp.imageSrc} alt={sp.name} draggable={false} style={{width:"85%",height:"85%",objectFit:"contain",objectPosition:"top",filter:tbo?"saturate(0.2)":"none",pointerEvents:"none"}}/></div>
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent, #050810ee 40%)",padding:"20px 8px 8px",textAlign:"center"}}>
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:10,fontWeight:700,color:tbo?"#3a5a7a":sp.color,letterSpacing:1,textShadow:tbo?"none":"0 0 8px "+sp.color+"88"}}>{sp.name.toUpperCase()}</div>
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
                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontFamily:"'Orbitron',sans-serif",fontSize:10,color,fontWeight:700,letterSpacing:1}}>{label.split(" ")[0].toUpperCase()}</span>{sn&&<span style={{fontSize:8,color:"#5a7a9a"}}>{sn}</span>}</div>
                {!online&&<label style={{fontSize:8,color:cpuCorners[corner]?"#44ff88":"#3a5a7a",cursor:"pointer",display:"flex",alignItems:"center",gap:3,userSelect:"none"}} onClick={e=>e.stopPropagation()}><input type="checkbox" checked={!!cpuCorners[corner]} onChange={e=>setCpuCorners(c=>({...c,[corner]:e.target.checked}))} style={{accentColor:"#44cc66",cursor:"pointer",width:12,height:12}}/>CPU</label>}
              </div>
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {sp?<div style={{textAlign:"center"}}><img src={sp.imageSrc} alt={sp.name} draggable={false} style={{height:80,objectFit:"contain",transform:ir?"scaleX(-1)":"none",filter:"drop-shadow(0 0 8px "+sp.color+"66)",pointerEvents:"none"}}/><div style={{fontFamily:"'Orbitron',sans-serif",fontSize:10,color:sp.color,letterSpacing:1,marginTop:4,textShadow:"0 0 8px "+sp.color+"55"}}>{sp.name.toUpperCase()}</div><div style={{fontSize:8,color:"#5a7a9a",marginTop:2}}>D{sp.drive} · S{sp.sustain} · SP{sp.speed}</div></div>
                :<div style={{textAlign:"center",opacity:0.4}}><div style={{width:50,height:70,border:"2px dashed "+color+"44",borderRadius:8,margin:"0 auto 6px"}}/><div style={{fontSize:9,color:color+"88",letterSpacing:1}}>{ic?"PICK YOUR SPIRIT":"WAITING"}</div></div>}
              </div></div>})}</div>}
          {/* SETTINGS */}
          {playerCount&&<div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",maxWidth:900,margin:"0 auto 20px",width:"100%",padding:"12px 16px",background:"#080f1e",borderRadius:8,border:"1px solid #1a2a40"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>MODE</span>
              <button onClick={()=>setMode("ffa")} style={seg(mode==="ffa","#4488ff")}>FFA</button>
              {playerCount===4?<button onClick={()=>setMode("team")} style={seg(mode==="team","#aa55ff")}>TEAM</button>:<span style={{fontSize:8,color:"#1e3a5f",padding:"6px 10px"}}>Team @ 4P</span>}</div>
            {mode==="team"&&<span style={{fontSize:8,color:"#5a7a9a"}}>Blue+Purple vs Red+Yellow</span>}
            <div style={{width:1,height:20,background:"#1a2a40"}}/>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>KDs</span>
              {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setStartingLives(n)} style={{...seg(startingLives===n,"#ff4488"),padding:"6px 10px"}}>{n}</button>)}</div>
            <div style={{width:1,height:20,background:"#1a2a40"}}/>
            <span style={{fontSize:8,color:"#3a5a7a",flex:1,minWidth:100}}>{startingLives===1?"Sudden death":startingLives+" Knock Downs = KO"}</span>
            <button onClick={online?handleStartOnline:handleStart} disabled={!canGo} style={{fontFamily:"'Orbitron',sans-serif",cursor:canGo?"pointer":"not-allowed",borderRadius:6,padding:"10px 28px",fontSize:13,fontWeight:700,letterSpacing:3,transition:"all .2s",border:"2px solid",background:canGo?"#1a3020":"#0a1020",borderColor:canGo?"#44cc66":"#1e3a5f",color:canGo?"#44ff88":"#2a3a4a",boxShadow:canGo?"0 0 20px #44cc6633":"none",opacity:canGo?1:0.5}}>{online?"START ONLINE":"START"}</button>
          </div>}
        </>}
      </div>
      {netStatus!=="in-room"&&<button onClick={startTestingGrounds} title="Skip setup" style={{position:'fixed',bottom:14,right:14,zIndex:50,fontFamily:"'Orbitron',sans-serif",fontSize:10,letterSpacing:1,cursor:'pointer',padding:'9px 14px',borderRadius:7,background:'#2a1030',border:'1.5px solid #cc66ff',color:'#e0a0ff',boxShadow:'0 0 18px #cc66ff55'}}>TESTING GROUNDS</button>}
    </div>
  );
}
