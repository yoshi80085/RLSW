// =============================================================================
// ui/TestingGrounds.jsx  —  extracted verbatim from the Game render.
// Presentational: all values/handlers via props, zero app imports.
// =============================================================================
import React from "react";

export function TestingGrounds({ EVENT_DECK, SIGNATURE_TESTS, devCurrentSpiritId, devEventId, devFireEvent, devFireSignature, devGrant, devOpen, devUnlockSkill, noteStates, setDevEventId, setDevOpen, spiritById, spirits, testMode, devSummonGod, devHurtGod, devGodAct, rockGod, bossOutcome }) {
  const godAlive = !!(rockGod && rockGod.hp > 0 && !bossOutcome);
  return (<>
      {testMode && (
        <>
          <button onClick={()=>setDevOpen(o=>!o)} title="Testing Grounds"
            style={{position:'fixed',bottom:14,left:14,zIndex:9996,fontFamily:"'Orbitron',sans-serif",fontSize:11,letterSpacing:1,
              cursor:'pointer',padding:'8px 13px',borderRadius:8,background:'#2a1030',border:'1.5px solid #cc66ff',color:'#e0a0ff',
              boxShadow:'0 0 16px #cc66ff55'}}>
            🧪 {devOpen ? 'CLOSE' : 'TEST'}
          </button>
          {devOpen && (
            <div style={{position:'fixed',bottom:54,left:14,zIndex:9996,width:252,
              background:'linear-gradient(165deg,#140a20,#0a0814)',border:'1.5px solid #cc66ff',borderRadius:10,
              padding:'12px 14px',boxShadow:'0 0 30px #cc66ff44',fontFamily:"'Share Tech Mono',monospace"}}>
              <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:10,color:'#e0a0ff',letterSpacing:2,marginBottom:8}}>🧪 TESTING GROUNDS</div>
              <div style={{fontSize:8,color:'#9a7ab5',marginBottom:10}}>Acting spirit: <span style={{color:'#e0a0ff'}}>{spiritById[devCurrentSpiritId()]?.name ?? '—'}</span></div>

              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,marginBottom:4}}>FIRE EVENT</div>
              <div style={{display:'flex',gap:5,marginBottom:11}}>
                <select value={devEventId} onChange={e=>setDevEventId(e.target.value)}
                  style={{flex:1,background:'#0a0814',color:'#d0c0e0',border:'1px solid #4a2a60',borderRadius:5,fontSize:9,padding:'5px',fontFamily:'inherit'}}>
                  {EVENT_DECK.map(ev => <option key={ev.id} value={ev.id}>{ev.icon} {ev.title}</option>)}
                </select>
                <button onClick={()=>devFireEvent(devEventId)}
                  style={{background:'#3a1550',border:'1px solid #cc66ff',color:'#e0a0ff',borderRadius:5,fontSize:9,padding:'5px 10px',cursor:'pointer',fontFamily:'inherit'}}>FIRE</button>
              </div>

              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,marginBottom:4}}>GRANT TO ACTING SPIRIT</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {[['hc','+3 HC'],['cas','+5 Casuals'],['die','+1 Diehard'],['uns','+5 Unsure'],['vup','+1 Vibe'],['vdn','−1 Vibe'],['fp','+3 FP']].map(([k,lbl])=>(
                  <button key={k} onClick={()=>devGrant(k)}
                    style={{background:'#0a0814',border:'1px solid #4a2a60',color:'#d0c0e0',borderRadius:5,fontSize:9,padding:'5px 8px',cursor:'pointer',fontFamily:'inherit'}}>{lbl}</button>
                ))}
              </div>

              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,margin:'12px 0 4px'}}>🤘 ROCK GOD (BOSS)</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:4}}>
                <button onClick={devSummonGod} disabled={!!rockGod}
                  title={rockGod ? 'One god per game — already summoned' : "Summon the boss now (picked from the acting spirit's playstyle — Bardbarian for now)"}
                  style={{background: rockGod ? '#0a0814' : '#332208', border:`1px solid ${rockGod ? '#4a2a60' : '#ffcc22'}`,
                    color: rockGod ? '#6a5a85' : '#ffcc22', borderRadius:5, fontSize:9, padding:'5px 9px',
                    cursor: rockGod ? 'default' : 'pointer', fontFamily:'inherit'}}>
                  ⚡ SUMMON{rockGod ? 'ED ✓' : ''}
                </button>
                <button onClick={devHurtGod} disabled={!godAlive}
                  title="Deal 10 damage to the god (no FP) — exercises the winded/kill flows"
                  style={{background:'#0a0814', border:'1px solid #4a2a60', color:'#d0c0e0',
                    borderRadius:5, fontSize:9, padding:'5px 9px', opacity: godAlive ? 1 : 0.5,
                    cursor: godAlive ? 'pointer' : 'default', fontFamily:'inherit'}}>
                  🗡️ −10 HP
                </button>
                <button onClick={devGodAct} disabled={!godAlive}
                  title="Force the god's end-of-turn action now (telegraph → resolve)"
                  style={{background:'#0a0814', border:'1px solid #4a2a60', color:'#d0c0e0',
                    borderRadius:5, fontSize:9, padding:'5px 9px', opacity: godAlive ? 1 : 0.5,
                    cursor: godAlive ? 'pointer' : 'default', fontFamily:'inherit'}}>
                  🎬 ACT
                </button>
              </div>
              {rockGod && (
                <div style={{fontSize:8,color:'#9a7ab5',marginBottom:8}}>
                  {godAlive
                    ? <>HP <span style={{color:'#ffcc22'}}>{rockGod.hp}/{rockGod.maxHp}</span>
                        {rockGod.winded ? ' · 😵 winded' : ''}{rockGod.telegraph ? ` · ⚠️ ${rockGod.telegraph.label} armed` : ''}</>
                    : <>fight over — {bossOutcome === 'god' ? 'the God kept the crown' : 'the God fell'}</>}
                </div>
              )}

              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,margin:'12px 0 4px'}}>SIGNATURE SKILLS</div>
              {Object.entries(SIGNATURE_TESTS).map(([sid, route]) => {
                const inGame = spirits.some(s => s.id === sid);
                const unlocked = noteStates[sid]?.unlockedSkills ?? [];
                return (
                  <div key={sid} style={{marginBottom:8,opacity:inGame?1:0.5}}>
                    <div style={{fontSize:8,color:route.color,marginBottom:3}}>{route.name}{!inGame && ' (not in game)'}</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {route.skills.map(sk => {
                        const on = unlocked.includes(sk.id);
                        return (
                          <button key={sk.id} disabled={!inGame}
                            onClick={()=> sk.fire ? devFireSignature(sid, sk) : devUnlockSkill(sid, sk.id, sk.pre)}
                            title={sk.fire === 'hydra' ? 'Unlock + deploy 3 amps' : (on ? 'Already unlocked' : 'Unlock')}
                            style={{background: on && !sk.fire ? '#16331e' : '#0a0814',
                              border:`1px solid ${on && !sk.fire ? '#44cc66' : (sk.fire ? route.color : '#4a2a60')}`,
                              color: on && !sk.fire ? '#88ffaa' : (sk.fire ? route.color : '#d0c0e0'),
                              borderRadius:5,fontSize:8.5,padding:'4px 7px',cursor:inGame?'pointer':'default',fontFamily:'inherit'}}>
                            {sk.label}{sk.fire ? ' ▶' : (on ? ' ✓' : '')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div style={{fontSize:7,color:'#6a5a85',marginTop:11,lineHeight:1.45}}>
                Add tests: a new entry in <span style={{color:'#cc99ff'}}>EVENT_DECK</span> auto-appears above; a new lever goes in <span style={{color:'#cc99ff'}}>devGrant</span>.
              </div>
            </div>
          )}
        </>
      )}

  </>);
}
