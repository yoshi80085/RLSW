import { SpiritDraft } from './SpiritDraft.jsx';
import { validLoadout } from '../data/loadouts.js';
import { seatId } from '../data/spiritIdentity.js';
import { useState, useEffect, useRef } from "react";
import { SPIRIT_DEFS, UNLOCKED_DEFAULT, MAX_PLAYERS } from "../data/spirits.js";
import { CORNERS, CORNER_LABELS, CORNERS_ORDER } from "../data/corners.js";
import { cornerFacing } from "../board/boardHelpers.js";
import { buildTestingGroundsConfig } from "../data/matchSetup.js";
import { makeNetClient } from "../net/client.js";
import { RIFF_FALL_DIFFICULTY, RIFF_FALL_DEFAULT,
         RIFF_SPEED_MIN, RIFF_SPEED_MAX, RIFF_SPEED_DEFAULT,
         loadRiffSpeed, saveRiffSpeed, riffSpeedLabel } from "../riff/fallingNotes.js";
import { fpPerLife, ROUND_LIMIT_CHOICES, ROUND_LIMIT_DEFAULT } from "../data/gameConstants.js";
import menuSong3 from "../music/Menu_song_3.mp3";
import { musicVol } from "../audio/mixer.js";
import boardImg from "../board.png";
import boardOutlineImg from "../board_outline.png";
import boardStarsImg from "../board_stars_animated.png";
import boardLightningImg from "../board_lightning_animated.png";
import { SVG_W, SVG_H } from "../board/constants.js";

// Short display names for the riff-off difficulty row (full label in tooltip)
const RIFF_DIFF_SHORT = { rookie: 'INFLUENCER', gigging: 'GIGGING', shredder: 'SHREDDER', virtuoso: 'VIRTUOSO' };

const MENU_SONGS = [menuSong3];

/* 🎮 THE OPENING STATE OF A MATCH, Alex 2026-08-31.
   ⚠️ THESE THREE ARE ONE FACT SPLIT ACROSS THREE useStates, which is exactly why
   they are derived from a shared helper instead of typed out three times: the
   player count, which corners that count uses, and which of those corners is
   waiting on a pick. Get them out of step — seed `cpuCorners` for two corners
   while `activeCorners` builds three, say — and the lobby renders a chair nobody
   is sitting in.
   📌 2P IS OPPOSITE CORNERS, not the first two of CORNERS_ORDER (which would put
   both players on adjacent walls). That rule lived as an inline ternary at the
   one place `activeCorners` was computed; it is a function now because the
   initial state below needs the same answer before any effect has run. */
const DEFAULT_PLAYERS = 2;
const cornersFor = (n) => n === 2 ? ["blue", "red"] : n ? CORNERS_ORDER.slice(0, n) : [];
/** Corner 0 is the human; everyone else starts as a bot. Smash's rule. */
const seedCpu = (n) => Object.fromEntries(cornersFor(n).map((c, i) => [c, i !== 0]));

export function Lobby({ onStart, onBackToMenu }) {
  /* 🎮 TWO PLAYERS IS THE STANDING ASSUMPTION, Alex 2026-08-31 — the Smash Bros
     rule: the match already exists, you are adjusting it.
     🪦 THIS WAS `null`, and null meant an EMPTY SCREEN. Every section below is
     gated `{playerCount && …}` — the roster, the corner row, the settings block
     — so the first thing the lobby ever showed was a row of 2P/3P/4P buttons
     over nothing, and picking a number did not start anything, it merely
     revealed the screen you came here for. A modal step whose only outcome is
     "now you may begin" is a door, not a choice.
     📌 THE COUNT IS STILL FULLY LIVE. 3P/4P (once the roster supports them) and
     the online host's ± Bot buttons all still write it; two is only where it
     starts. `activeCorners` reads 2 → ["blue","red"], and the cpuCorners effect
     below seats corner 0 as the human and the rest as bots, so the default the
     player lands in is P1 vs one CPU — a playable match, one click from starting. */
  const [playerCount, setPlayerCount] = useState(2);
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
  const [loadouts, setLoadouts] = useState({});
  const [cpuCorners, setCpuCorners] = useState(() => seedCpu(DEFAULT_PLAYERS));
  // 🧠 WHICH BOT IS IN THE CHAIR. Unchecked = the legacy step-machine that has
  // always shipped; checked = `engine/policies/play.js`'s searcher, the one
  // BOT_STRATEGY_HANDOFF §6.6 has been tuning against the bench. Per-corner
  // rather than global so the two can be played against each other.
  const [cpuSearcher, setCpuSearcher] = useState({});
  const [, setStep] = useState("count");
  /* 🎸🏆 HOW THE MATCH ENDS — a setting as of 2026-09-16.
     ⚠️ BATTLE OF THE BANDS IS THE DEFAULT, and that is not a new preference:
     the ENGINE has defaulted to it since 2026-09-15 (`state.js` normalises an
     unspecified `winCondition` to 'rounds'). The lobby simply never said so and
     never passed one, so every match ran round-limited underneath while the
     client still crowned a Legend on a Fame target the mode had removed.
     📌 Legend Run is NOT retired — Alex, 2026-09-16: "I don't want to totally
     throw out all of that". It is the other button. */
  const [winCondition, setWinCondition] = useState('rounds');
  const [roundLimit, setRoundLimit] = useState(ROUND_LIMIT_DEFAULT);
  const [startingLives, setStartingLives] = useState(3);
  const beginnerMode = false; // Pickles introduction archived.
  /* ⚠️ SEEDED, NOT LEFT TO THE EFFECT BELOW. A roster tile is clickable only
     while `choosingCorner` is set (see the tile's onClick and its cursor), so if
     this started null the first paint of the lobby would be a full roster that
     does nothing, correcting itself a frame later when the effect fires. That is
     the same "looks ready, isn't" the player-count gate used to be, just shorter.
     The effect still owns every LATER change; this owns the first render. */
  const [choosingCorner, setChoosingCorner] = useState(() => cornersFor(DEFAULT_PLAYERS)[0] ?? null);
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
  // 🐢 Riff-off TEMPO — shared with the practice trainer (same localStorage
  // key), so a speed dialled in while practising is the speed duels run at.
  // Difficulty picks the riff and the reading aids; this stretches the clock.
  const [riffSpeed, setRiffSpeed] = useState(loadRiffSpeed);
  function pickRiffSpeed(v) { setRiffSpeed(saveRiffSpeed(v)); }
  const [announcer] = useState(null);
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
    audio.volume = musicVol(0.45);   // 🎚️ 0.45 is the song's mix level; the fader scales it
    /* ⚠️ THE LATCH IS RELEASED ON FAILURE, and that is new. `active` is now true
       on mount rather than on the player-count click, so this fires one gesture
       further from the user's last one. Reaching the lobby always costs a click
       on the title menu, so the document has sticky activation and autoplay is
       allowed — but if a browser ever refuses anyway, latching `menuSongStarted`
       eagerly would mean the menu music never plays again for the whole visit.
       Releasing it lets the next player-count change — a real gesture — retry,
       which is exactly what used to start the song. */
    audio.play()
      .then(() => { menuAudioRef.current = audio; })
      .catch(() => { menuSongStarted.current = false; });
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
  const activeCorners = cornersFor(playerCount);
  const allAssigned = activeCorners.every(c=>assignments[c] && validLoadout(assignments[c], loadouts[c]));
  useEffect(()=>{if(!playerCount)return;setCpuCorners(prev=>{const next={...prev};activeCorners.forEach((c,i)=>{if(next[c]===undefined)next[c]=i!==0;});return next;});},[playerCount]);
  useEffect(()=>{if(!playerCount){setChoosingCorner(null);return;}const f=activeCorners.find(c=>!assignments[c]);setChoosingCorner(f??null);},[playerCount]);
  function assign(corner, spiritId) {
    setAssignments(a => ({...a, [corner]: spiritId}));
    if (assignments[corner] !== spiritId) setLoadouts(a => ({...a, [corner]: []}));
  }
  function confirmSeat() {
    setChoosingCorner(activeCorners.find(c => c !== choosingCorner && !validLoadout(assignments[c], loadouts[c])) ?? null);
  }
  function handleStart(){if(!allAssigned)return;const spirits=activeCorners.map(corner=>{const def=SPIRIT_DEFS[assignments[corner]];const{homeNum}=CORNERS[corner];const facing=cornerFacing(homeNum);const{color:cc}=CORNER_LABELS[corner];return{...def,id:seatId(def.id,corner),characterId:def.id,abilities:[...loadouts[corner]],num:homeNum,facing,corner,color:cc,cpu:!!cpuCorners[corner],botPolicy:(cpuCorners[corner]&&cpuSearcher[corner])?"searcher":"legacy"};});const teams=mode==="team"?{a:activeCorners.slice(0,2),b:activeCorners.slice(2,4)}:null;onStart({spirits,mode,teams,startingLives,beginnerMode,winCondition,roundLimit});}
  function handleStartOnline(){if(!allAssigned)return;const hs=netRoom.seats.filter(s=>!s.isBot);const spirits=activeCorners.map((corner,ci)=>{const def=SPIRIT_DEFS[assignments[corner]];const{homeNum}=CORNERS[corner];const facing=cornerFacing(homeNum);const{color:cc}=CORNER_LABELS[corner];return{...def,id:seatId(def.id,corner),characterId:def.id,abilities:[...loadouts[corner]],num:homeNum,facing,corner,color:cc,cpu:ci>=hs.length};});const teams=mode==="team"?{a:activeCorners.slice(0,2),b:activeCorners.slice(2,4)}:null;const config={spirits,mode,teams,startingLives,beginnerMode,winCondition,roundLimit};const seatMap=hs.map((s,i)=>({seatId:s.seatId,spiritId:activeCorners[i]?seatId(assignments[activeCorners[i]],activeCorners[i]):null}));const botSeats=activeCorners.slice(hs.length).map(c=>({name:SPIRIT_DEFS[assignments[c]]?.name??"Bot",spiritId:seatId(assignments[c],c)}));netClient.startGame(config,{seatMap,botSeats:botSeats.length?botSeats:undefined});}
  function startTestingGrounds(){onStart(buildTestingGroundsConfig({beginnerMode}));}
  const iBase={fontFamily:"inherit",background:"#0a1020",border:"1px solid #1e3a5f",borderRadius:4,color:"#c0d0e0",fontSize:11,padding:"8px 10px",outline:"none"};
  const seg=(on,ac="#4488ff")=>({fontFamily:"'Saira Stencil One',sans-serif",cursor:"pointer",borderRadius:4,padding:"6px 14px",fontSize:10,letterSpacing:1,transition:"all .15s",border:"1px solid",background:on?ac+"22":"#0a1020",borderColor:on?ac:"#1e3a5f",color:on?ac:"#5a7a9a"});
  const online=netStatus==="in-room", showCfg=online?isHost:true, canGo=allAssigned;  // mode is always FFA now — a full roster is the only gate

  return (
    <div className="arena-lobby" style={{minHeight:"100vh",background:"#050810",display:"flex",flexDirection:"column",fontFamily:"'Share Tech Mono','Courier New',monospace",overflow:"hidden",position:"relative"}}>
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
                  /* ⚠️ THE NO-OP CLICK IS GUARDED, and it matters more now than it
                     did: changing the count clears every Spirit pick (the corners
                     themselves change — 2P is blue/red, 3P is the first three of
                     CORNERS_ORDER), and with 2P now PRE-SELECTED the obvious
                     gesture for a player who has just chosen two Spirits is to
                     press the lit 2P button to confirm. Without this that press
                     silently wiped both picks. */
                  onClick={()=>{if(tooMany||n===playerCount)return;setPlayerCount(n);setAssignments({});setStep("assign");}}
                  style={{...seg(playerCount===n),...(tooMany?{opacity:0.3,cursor:"not-allowed",borderColor:"#1a2a40",color:"#2a3a4a"}:{})}}>{n}P</button>;})}</div>
              {MAX_PLAYERS<4&&<span style={{fontSize:8,color:"#3a5a7a"}}>🚧 {4-MAX_PLAYERS} Spirit{4-MAX_PLAYERS!==1?'s':''} still in development</span>}</>}
            {online&&isHost&&playerCount&&<><span style={{fontSize:9,color:"#3a5a7a",letterSpacing:2,fontFamily:"'Saira Stencil One',sans-serif"}}>{playerCount} PLAYERS</span>
              {playerCount<MAX_PLAYERS&&<button onClick={()=>{setPlayerCount(p=>Math.min(MAX_PLAYERS,p+1));setAssignments({});}} style={{...seg(false),background:"#1a2a10",borderColor:"#44cc66",color:"#44ff88",cursor:"pointer"}}>+ Bot</button>}
              {playerCount>(netRoom?.seats?.filter(s=>!s.isBot).length??2)&&<button onClick={()=>{setPlayerCount(p=>Math.max(netRoom.seats.filter(s=>!s.isBot).length,p-1));setAssignments({});}} style={{...seg(false),background:"#301520",borderColor:"#ff4488",color:"#ff88bb",cursor:"pointer"}}>− Bot</button>}</>}
          </div>
          <SpiritDraft corners={activeCorners} assignments={assignments} loadouts={loadouts}
            choosingCorner={choosingCorner} onChooseCorner={setChoosingCorner} onChooseSpirit={assign}
            onLoadout={(corner, ids) => setLoadouts(v => ({...v, [corner]: ids}))} onConfirm={confirmSeat}
            cpuCorners={cpuCorners} onCpu={(corner, value) => setCpuCorners(v => ({...v,[corner]:value}))}
            cpuSearcher={cpuSearcher} onSearcher={(corner, value) => setCpuSearcher(v => ({...v,[corner]:value}))}
            online={online} unlocked={unlocked}/>
          {/* SETTINGS */}
          {playerCount&&<div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",maxWidth:1180,margin:"0 auto 20px",width:"100%",padding:"12px 16px",background:"#080f1e",borderRadius:8,border:"1px solid #1a2a40"}}>
            {/* MODE — FFA is on by default and stays on. TEAM is parked until
                multiplayer is built out; it's shown disabled rather than hidden
                so it reads as "planned", not "missing". */}
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>MODE</span>
              <button title="Free-for-all — the standard match. Everyone for themselves." style={{...seg(true,"#4488ff"),cursor:"default"}}>FFA</button>
              <button disabled title="Team mode arrives with multiplayer. FFA is the standard until then."
                style={{...seg(false,"#aa55ff"),opacity:0.3,cursor:"not-allowed",borderColor:"#1a2a40",color:"#2a3a4a"}}>TEAM 🔒</button>
              <span style={{fontSize:8,color:"#3a5a7a"}}>standard</span></div>
            <div style={{width:1,height:20,background:"#1a2a40"}}/>
            {/* 🎸🏆 HOW THE MATCH ENDS. Drawn as a segment row — the shape MODE
                and KDs already use — because Alex signed that treatment off on
                2026-09-16 off the preview page, noting the whole lobby gets a
                3D pass later. `.scratch/fame-track-preview.html` → 🏆 Lobby mode
                toggle still carries the two alternatives (cards, single pill).
                ⚠️ WIN_CONDITIONS_DESIGN.md §8 step 6 put this control under the
                preview rule, which is why it was built there first. */}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>🏆 WIN</span>
              <button onClick={()=>setWinCondition('rounds')}
                title="Battle of the Bands — a fixed number of rounds, then the buzzer. Most Fame wins. Nobody is knocked out."
                style={{...seg(winCondition==='rounds',"#ff8a2a")}}>🎸 ROUNDS</button>
              <button onClick={()=>setWinCondition('fame')}
                title="Legend Run — the original: first to the Fame target is crowned, and knock-downs can put you out for good."
                style={{...seg(winCondition==='fame',"#ffd700")}}>🏆 FAME</button>
            </div>
            {winCondition==='rounds'&&<>
              <div style={{width:1,height:20,background:"#1a2a40"}}/>
              <div style={{display:"flex",alignItems:"center",gap:6}}
                title="How many rounds before the buzzer. Every Spirit gets the same number of turns.">
                <span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>⏳ ROUNDS</span>
                {ROUND_LIMIT_CHOICES.map(n=><button key={n} onClick={()=>setRoundLimit(n)}
                  style={{...seg(roundLimit===n,"#ff8a2a"),padding:"6px 10px"}}>{n}</button>)}</div>
            </>}
            <div style={{width:1,height:20,background:"#1a2a40"}}/>
            {/* 🚨 KDs IN A MODE WHERE NOTHING IS KNOCKED OUT. Battle of the Bands
                runs with elimination OFF (`state.js` pairs them), so lives are
                never decremented at all — a knock-down still scatters your
                notes, resets your Vibe and pays the attacker, it just cannot end
                your match. The control is DIMMED rather than hidden: the number
                still shapes the Stage-FX thresholds, and hiding a setting that
                is still doing something is its own kind of lie. */}
            <div style={{display:"flex",alignItems:"center",gap:6,opacity:winCondition==='rounds'?0.45:1}}
              title={winCondition==='rounds'
                ?"Nobody is eliminated in Battle of the Bands — a knock-down still costs you the crowd and your Vibe, but it cannot end your match."
                :"How many knock-downs before a Spirit is out for good."}>
              <span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>KDs</span>
              {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setStartingLives(n)} style={{...seg(startingLives===n,"#ff4488"),padding:"6px 10px"}}>{n}</button>)}
              {winCondition==='rounds'&&<span style={{fontSize:8,color:"#5a7a9a"}}>— no KO this mode</span>}
            </div>
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
            {/* 🐢 TEMPO — the calibration dial. Difficulty above chooses WHAT you
                play; this chooses HOW FAST it comes at you. Slowing it stretches
                the lead-in, the note spacing AND the timing windows together, so
                the riff keeps its groove and only the clock moves. */}
            <div style={{display:"flex",alignItems:"center",gap:6}}
              title="How fast riff-offs come at you. Shared with the Riff Practice trainer — find a speed there and duels use it too.">
              <span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>🐢 SPEED</span>
              <input type="range" min={RIFF_SPEED_MIN} max={RIFF_SPEED_MAX} step={0.05}
                value={riffSpeed} onChange={e=>pickRiffSpeed(parseFloat(e.target.value))}
                style={{width:110,accentColor:"#f6ad55",cursor:"pointer"}}/>
              <span style={{fontSize:9,letterSpacing:1,minWidth:46,
                color: riffSpeed<1?"#44ff88":riffSpeed>1?"#ff8a2a":"#f6ad55"}}>
                {riffSpeedLabel(riffSpeed)}
              </span>
              {riffSpeed!==RIFF_SPEED_DEFAULT&&
                <button onClick={()=>pickRiffSpeed(RIFF_SPEED_DEFAULT)} title="Back to written tempo"
                  style={{...seg(false,"#f6ad55"),padding:"4px 7px"}}>↺</button>}
            </div>
            <div style={{width:1,height:20,background:"#1a2a40"}}/>
            {/* 📝 THE LINE YOU READ BEFORE PRESSING START — and until 2026-09-16
                BOTH HALVES OF IT WERE FALSE. It said "3 Knock Downs = KO — 18 FP
                to win" in a mode with no KOs and no target, because it was
                written when Legend Run was the only game. It now says what the
                match you are about to play actually does. */}
            <span style={{fontSize:8,color:"#3a5a7a",flex:1,minWidth:100}}>
              {winCondition==='rounds'
                ? <>{roundLimit} rounds, then the buzzer — <b style={{color:"#ff8a2a"}}>most Fame wins</b> · nobody is knocked out · ties go to diehards, then damage 🤘</>
                : <>{startingLives===1?`Sudden death — ${fpPerLife(playerCount ?? 2)} FP to win`:`${startingLives} Knock Downs = KO — ${startingLives*fpPerLife(playerCount ?? 2)} FP to win`}{startingLives>=3?" 🤘":""}</>}
            </span>
            <button onClick={online?handleStartOnline:handleStart} disabled={!canGo} style={{fontFamily:"'Saira Stencil One',sans-serif",cursor:canGo?"pointer":"not-allowed",borderRadius:6,padding:"10px 28px",fontSize:13,fontWeight:700,letterSpacing:3,transition:"all .2s",border:"2px solid",background:canGo?"#1a3020":"#0a1020",borderColor:canGo?"#44cc66":"#1e3a5f",color:canGo?"#44ff88":"#2a3a4a",boxShadow:canGo?"0 0 20px #44cc6633":"none",opacity:canGo?1:0.5}}>{online?"START ONLINE":"ENTER ARENA"}</button>
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
