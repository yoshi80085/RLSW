// =============================================================================
// ui/TestingGrounds.jsx  —  extracted verbatim from the Game render.
// Presentational: all values/handlers via props, zero app imports.
//
// 🧪 2026-09-24 REVIVAL — the three levers that make it a sandbox rather than a
// cheat menu (Alex: "take any player, drop them anywhere, use any move at any
// time"): 🎮 PLAY AS (take the controls of any Spirit, mid-turn), 📍 DROP (arm,
// then click any hex), and 🆓 FREE PLAY (the acting Spirit is kept topped up,
// plus a turn-step jump). The rules behind them live in the monolith's dev
// helpers and `engine/systems/sandbox.js`; this file only draws the buttons.
// =============================================================================
import React from "react";

const STEPS = [['chord','🎸 Chord'],['melody','🎵 Melody'],['move_act','⚔️ Move & Act']];
const smallBtn = {background:'#0a0814',border:'1px solid #4a2a60',color:'#d0c0e0',borderRadius:5,fontSize:9,padding:'4px 7px',cursor:'pointer',fontFamily:'inherit'};

export function TestingGrounds({ SIGNATURE_TESTS, STAGE_FX_META, devCurrentSpiritId, devFireStageFx, devFireSignature, devGrant, devDamage, devOpen, devUnlockSkill, noteStates, setDevOpen, spiritById, spirits, testMode, devExportLog,
  actingId = null, devTakeControl, devPlaceId = null, devArmPlace, devFreePlay = false, setDevFreePlay, turnStep, devJumpStep }) {
  const placing = devPlaceId ? spiritById[devPlaceId] : null;
  return (<>
      {testMode && (
        <>
          {/* 📍 The drop banner lives OUTSIDE the panel on purpose: you close the
              panel to see the board, and the instruction must survive that. */}
          {placing && (
            <div style={{position:'fixed',top:12,left:'50%',transform:'translateX(-50%)',zIndex:9997,display:'flex',alignItems:'center',gap:10,
              padding:'8px 12px',borderRadius:8,background:'#2a1030ee',border:`1.5px solid ${placing.color ?? '#cc66ff'}`,
              boxShadow:'0 0 20px #cc66ff66',fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:'#f0d8ff',pointerEvents:'auto'}}>
              <span>📍 Click any hex to drop <b style={{color:placing.color ?? '#e0a0ff'}}>{placing.name}</b></span>
              <button onClick={()=>devArmPlace?.(devPlaceId)} style={smallBtn}>Cancel</button>
            </div>
          )}
          <button onClick={()=>setDevOpen(o=>!o)} title="Testing Grounds"
            style={{position:'fixed',bottom:14,left:14,zIndex:9996,fontFamily:"'Saira Stencil One',sans-serif",fontSize:11,letterSpacing:1,
              cursor:'pointer',padding:'8px 13px',borderRadius:8,background:'#2a1030',border:'1.5px solid #cc66ff',color:'#e0a0ff',
              boxShadow:'0 0 16px #cc66ff55'}}>
            🧪 {devOpen ? 'CLOSE' : 'TEST'}{devFreePlay ? ' · FREE' : ''}
          </button>
          {devOpen && (
            /* ⚠️ THE PANEL OPENS ON THE RIGHT, not above its button (2026-09-24).
               Bottom-left it sat squarely on the 3D HUD's left column — the
               Spirit card, the chord stack and the whole MOVE & ACT rail — so the
               moment you took a Spirit and jumped to Move & Act, the buttons you
               came to press were under the panel (found driving it in Chromium:
               the Face button was unclickable). The right edge between the
               TURN/SPIRIT/RIVALS tabs and the Sustain stack is empty board. */
            <div style={{position:'fixed',top:160,right:14,zIndex:9996,width:252,
              maxHeight:'max(260px, calc(100vh - 420px))',overflowY:'auto',overscrollBehavior:'contain',
              background:'linear-gradient(165deg,#140a20,#0a0814)',border:'1.5px solid #cc66ff',borderRadius:10,
              padding:'12px 14px',boxShadow:'0 0 30px #cc66ff44',fontFamily:"'Share Tech Mono',monospace"}}>
              <div style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:10,color:'#e0a0ff',letterSpacing:2,marginBottom:8}}>🧪 TESTING GROUNDS</div>
              <div style={{fontSize:8,color:'#9a7ab5',marginBottom:10}}>Acting spirit: <span style={{color:'#e0a0ff'}}>{spiritById[devCurrentSpiritId()]?.name ?? '—'}</span></div>

              {/* 🎮 PLAY AS · 📍 DROP — one row per Spirit. */}
              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,marginBottom:4}}>🎮 PLAY AS · 📍 DROP ON A HEX</div>
              {spirits.map(s => {
                const dead = !!s.knockedOut, isActing = s.id === actingId, isPlacing = s.id === devPlaceId;
                return (
                  <div key={s.id} data-tg-seat={s.id} style={{display:'flex',alignItems:'center',gap:5,marginBottom:4,opacity:dead?0.45:1}}>
                    <span style={{flex:1,fontSize:8.5,color:s.color ?? '#d0c0e0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {isActing ? '▶ ' : ''}{s.name} <span style={{color:'#7a6a95'}}>#{s.num}</span>
                    </span>
                    <button disabled={dead || isActing} onClick={()=>devTakeControl?.(s.id)} title={isActing ? 'You are playing this Spirit' : 'Take the controls of this Spirit now'}
                      style={{...smallBtn,...(isActing ? {background:'#16331e',border:'1px solid #44cc66',color:'#88ffaa',cursor:'default'} : {})}}>
                      {isActing ? '🎮 Playing' : '🎮 Play'}
                    </button>
                    <button disabled={dead} onClick={()=>devArmPlace?.(s.id)} title="Then click any hex on the board"
                      style={{...smallBtn,...(isPlacing ? {background:'#33204a',border:'1px solid #cc66ff',color:'#f0c0ff'} : {})}}>
                      {isPlacing ? '📍 …' : '📍 Drop'}
                    </button>
                  </div>
                );
              })}

              {/* 🆓 FREE PLAY + the turn-step jump. */}
              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,margin:'12px 0 4px'}}>🆓 FREE PLAY</div>
              <button onClick={()=>setDevFreePlay?.(v=>!v)} data-tg-freeplay={devFreePlay ? 'on' : 'off'}
                title="Keep the acting Spirit topped up: AP, action token, cooldowns, Db, and every ability in its kit"
                style={{...smallBtn,width:'100%',textAlign:'left',padding:'6px 8px',
                  ...(devFreePlay ? {background:'#16331e',border:'1px solid #44cc66',color:'#88ffaa'} : {})}}>
                {devFreePlay ? '✓ ON' : '○ OFF'} — no AP, cooldown or Db limits · full kit
              </button>
              <div style={{fontSize:7,color:'#6a5a85',margin:'4px 0 5px',lineHeight:1.4}}>Jump the acting Spirit to a turn step:</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:2}}>
                {STEPS.map(([id, lbl]) => (
                  <button key={id} onClick={()=>devJumpStep?.(id)}
                    style={{...smallBtn,...(turnStep === id ? {border:'1px solid #cc66ff',color:'#f0c0ff'} : {})}}>{lbl}</button>
                ))}
              </div>
              <div style={{height:11}}/>

              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,marginBottom:4}}>🎇 STAGE EFFECTS</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:11}}>
                {Object.entries(STAGE_FX_META).map(([fxId, meta]) => (
                  <button key={fxId} onClick={()=>devFireStageFx(fxId)}
                    style={{background:'#0a0814',border:`1px solid ${meta.color}`,color:meta.color,borderRadius:5,fontSize:9,padding:'5px 8px',cursor:'pointer',fontFamily:'inherit'}}>
                    {meta.icon} {meta.name}
                  </button>
                ))}
              </div>

              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,marginBottom:4}}>GRANT TO ACTING SPIRIT</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {[['hc','+3 DB'],['cas','+5 Casuals'],['die','+1 Diehard'],['uns','+5 Unsure'],['vup','+1 Vibe'],['vdn','−1 Vibe'],['fp','+3 FP']].map(([k,lbl])=>(
                  <button key={k} onClick={()=>devGrant(k)}
                    style={{background:'#0a0814',border:'1px solid #4a2a60',color:'#d0c0e0',borderRadius:5,fontSize:9,padding:'5px 8px',cursor:'pointer',fontFamily:'inherit'}}>{lbl}</button>
                ))}
              </div>

              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,margin:'12px 0 4px'}}>💥 DEAL DAMAGE</div>
              <div style={{fontSize:7,color:'#6a5a85',marginBottom:5,lineHeight:1.4}}>Real combat damage — drives knockdown → respawn → KO → win.</div>
              {spirits.map(s => {
                const dead = !!s.knockedOut;
                return (
                  <div key={s.id} style={{display:'flex',alignItems:'center',gap:5,marginBottom:4,opacity:dead?0.45:1}}>
                    <span style={{flex:1,fontSize:8.5,color:s.color ?? '#d0c0e0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {s.name} <span style={{color:'#7a6a95'}}>{dead ? 'KO’d' : `❤️${s.vibe}/${s.maxVibe}·${s.lives}L`}</span>
                    </span>
                    <button disabled={dead} onClick={()=>devDamage(s.id, 3)} title="Deal 3 Vibe damage"
                      style={{background:'#0a0814',border:'1px solid #4a2a60',color:dead?'#6a5a85':'#ff8899',borderRadius:5,fontSize:9,padding:'4px 7px',cursor:dead?'default':'pointer',fontFamily:'inherit'}}>−3</button>
                    <button disabled={dead} onClick={()=>devDamage(s.id, 'ko')} title="Zero their Vibe — instant knockdown (spends a life)"
                      style={{background:'#0a0814',border:`1px solid ${dead?'#4a2a60':'#cc3344'}`,color:dead?'#6a5a85':'#ff5566',borderRadius:5,fontSize:9,padding:'4px 7px',cursor:dead?'default':'pointer',fontFamily:'inherit'}}>💀</button>
                  </div>
                );
              })}

              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,margin:'12px 0 4px'}}>SIGNATURE SKILLS</div>
              {Object.entries(SIGNATURE_TESTS).map(([sid, route]) => {
                const inGame = spirits.some(s => s.id === sid);
                const unlocked = noteStates[sid]?.unlockedSkills ?? [];
                return (
                  <div key={sid} style={{marginBottom:8,opacity:inGame?1:0.5}}>
                    <div style={{fontSize:8,color:(spirits.find(s => s.id === sid || s.id?.startsWith(`${sid}::`))?.color ?? '#d0c0e0'),marginBottom:3}}>{route.name}{!inGame && ' (not in game)'}</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {route.skills.map(sk => {
                        const on = unlocked.includes(sk.id);
                        return (
                          <button key={sk.id} disabled={!inGame}
                            onClick={()=> devUnlockSkill(sid, sk.id, sk.pre)}
                            title={on ? 'Already unlocked' : 'Unlock'}
                            style={{background: on ? '#16331e' : '#0a0814',
                              border:`1px solid ${on ? '#44cc66' : '#4a2a60'}`,
                              color: on ? '#88ffaa' : '#d0c0e0',
                              borderRadius:5,fontSize:8.5,padding:'4px 7px',cursor:inGame?'pointer':'default',fontFamily:'inherit'}}>
                            {sk.label}{on ? ' ✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,margin:'12px 0 4px'}}>📼 REPLAY (Phase 8a)</div>
              <button onClick={devExportLog}
                title="Download the full action log (seed + config + every dispatched action) — replaying it through the engine reproduces this game"
                style={{background:'#0a0814',border:'1px solid #4a2a60',color:'#d0c0e0',borderRadius:5,fontSize:9,padding:'5px 9px',cursor:'pointer',fontFamily:'inherit'}}>
                💾 EXPORT ACTION LOG
              </button>

              <div style={{fontSize:7,color:'#6a5a85',marginTop:11,lineHeight:1.45}}>
                Stage FX fire via the engine (seeded rng). A new lever goes in <span style={{color:'#cc99ff'}}>devGrant</span>.
              </div>
            </div>
          )}
        </>
      )}

  </>);
}
