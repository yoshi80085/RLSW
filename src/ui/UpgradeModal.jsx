// =============================================================================
// ui/UpgradeModal.jsx  —  extracted verbatim from the Game render.
// Presentational: all values/handlers via props, zero app imports.
// =============================================================================
import React from "react";

export function UpgradeModal({ SKILL_BY_ID, SKILL_TREE, acting, noteStates, setNoteStates, setSkillTarget, upgradesPending }) {
  return (<>
      {acting && upgradesPending > 0 && (() => {
        const ns           = noteStates[acting.id] ?? {};
        const unlocked     = ns.unlockedSkills ?? [];
        const stancesKnown = ns.stancesKnown ?? [];
        const pendingId    = ns.pendingAwardSkillId;
        const pendingDef   = pendingId ? SKILL_BY_ID[pendingId] : null;
        const activeRoute  = ns.skillRoute ?? null;
        const acColor      = acting.color ?? '#44aaff';

        // Helper: can this skill be set as the next target?
        // Supports both string and array prereqs (multi-prereq: all must be met).
        function canTarget(sk) {
          if (unlocked.includes(sk.id) || sk.id === pendingId) return false;
          if (sk.requiresStance && !stancesKnown.includes(sk.requiresStance)) return false;
          if (sk.prereq && sk.prereq !== '__all_pa__') {
            const prereqs = Array.isArray(sk.prereq) ? sk.prereq : [sk.prereq];
            if (prereqs.some(id => !unlocked.includes(id) && id !== pendingId)) return false;
          }
          if (sk.prereq === '__all_pa__') {
            return ['mic','pedal_dist','amp_1','mixer'].every(id => unlocked.includes(id) || id === pendingId);
          }
          if (sk.chainId === 'pa' && sk.id !== 'amp_1'
              && !unlocked.includes('amp_1') && pendingId !== 'amp_1') return false;
          return true;
        }

        const routeDef = activeRoute ? SKILL_TREE.routes.find(r => r.id === activeRoute) : null;

        const isInitialPick = (unlocked.length === 0) && !pendingId;

        return (
          <div style={{
            position:'fixed', inset:0, background:'#000000dd', zIndex:8000,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:"'Saira Stencil One',sans-serif",
          }}>
            <div style={{
              width: activeRoute ? 560 : 480,
              maxHeight:'90vh', overflowY:'auto',
              background:'#080f1e', border:`2px solid ${acColor}`,
              // NOTE: was overflow:'hidden', which overrode overflowY:'auto' above
              // (the shorthand resets both axes) and made tall routes like Electric
              // unscrollable. overflowX:'hidden' keeps corner clipping horizontally.
              borderRadius:12, overflowX:'hidden',
              boxShadow:`0 0 50px ${acColor}55`,
            }}>
              {/* Header */}
              <div style={{
                padding:'14px 20px', borderBottom:`1px solid ${acColor}44`,
                background:`linear-gradient(135deg, ${acColor}22 0%, #0a1020 100%)`,
              }}>
                {/* Awarded skill banner */}
                {pendingDef && (() => {
                  const rd = SKILL_TREE.routes.find(r => r.id === pendingDef.routeId);
                  return (
                    <div style={{
                      background:`${rd?.color ?? acColor}22`, border:`1px solid ${rd?.color ?? acColor}88`,
                      borderRadius:8, padding:'8px 14px', marginBottom:10,
                      display:'flex', alignItems:'center', gap:10,
                    }}>
                      <span style={{fontSize:24}}>{pendingDef.icon}</span>
                      <div>
                        <div style={{fontSize:10, color: rd?.color ?? acColor, fontWeight:700, letterSpacing:1}}>
                          SKILL UNLOCKED!
                        </div>
                        <div style={{fontSize:12, color:'#ffffff', fontWeight:900, marginTop:1}}>
                          {pendingDef.label}
                        </div>
                        <div style={{fontSize:8, color:'#6a8aaa', marginTop:2}}>{pendingDef.desc}</div>
                      </div>
                    </div>
                  );
                })()}
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <span style={{fontSize:22}}>{isInitialPick ? '🎸' : '🎯'}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, color:acColor, letterSpacing:2, fontWeight:700}}>
                      {isInitialPick
                        ? (activeRoute ? `${routeDef?.icon} ${routeDef?.label} — Pick Your Path` : 'CHOOSE YOUR STARTING PATH')
                        : (activeRoute ? `${routeDef?.icon} ${routeDef?.label} — Pick Your Next Path` : 'SKILL TREE — Choose a Route')
                      }
                    </div>
                    <div style={{fontSize:8, color:'#3a5a7a', marginTop:2}}>
                      {acting.name} · pick a skill to work toward — it unlocks AUTOMATICALLY once your Decibills fill
                    </div>
                  </div>
                  <button onClick={() => setNoteStates(prev => ({
                    ...prev, [acting.id]: { ...prev[acting.id], upgradesPending: 0 }
                  }))} style={{
                    fontFamily:'inherit', fontSize:8, padding:'4px 10px',
                    background:'transparent', border:'1px solid #1e3a5f',
                    borderRadius:4, color:'#3a5a7a', cursor:'pointer',
                  }}>Decide later</button>
                  {activeRoute && (
                    <button onClick={() => setNoteStates(prev => ({
                      ...prev, [acting.id]: { ...prev[acting.id], skillRoute: null }
                    }))} style={{
                      fontFamily:'inherit', fontSize:8, padding:'4px 10px',
                      background:'#0a1020', border:`1px solid ${acColor}55`,
                      borderRadius:4, color:acColor, cursor:'pointer',
                    }}>← Routes</button>
                  )}
                </div>
              </div>

              {/* Route picker */}
              {!activeRoute && (
                <div style={{padding:'16px 20px', display:'flex', flexDirection:'column', gap:8}}>
                  <div style={{fontSize:8, color:'#3a5a7a', marginBottom:4}}>
                    Choose a route to browse. You can switch routes each upgrade.
                  </div>
                  {SKILL_TREE.routes.filter(route => !route.spiritOnly || route.spiritOnly === acting.id).map(route => {
                    const allSkills = route.skills
                      ? route.skills
                      : (route.subChains ?? []).flatMap(c => c.skills.map(sk => ({...sk, chainId:c.id})));
                    const targetable = allSkills.filter(sk => canTarget({...sk, chainId: sk.chainId})).length;
                    const owned      = allSkills.filter(sk => unlocked.includes(sk.id)).length;
                    return (
                      <button key={route.id}
                        onClick={() => setNoteStates(prev => ({
                          ...prev, [acting.id]: { ...prev[acting.id], skillRoute: route.id }
                        }))}
                        style={{
                          fontFamily:'inherit', cursor:'pointer', textAlign:'left',
                          background:'#0a1525', border:`1px solid ${route.color}66`,
                          borderRadius:8, padding:'12px 16px', transition:'all .15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background=`${route.color}18`; e.currentTarget.style.borderColor=route.color; }}
                        onMouseLeave={e => { e.currentTarget.style.background='#0a1525'; e.currentTarget.style.borderColor=`${route.color}66`; }}>
                        <div style={{display:'flex', alignItems:'center', gap:12}}>
                          <span style={{fontSize:26}}>{route.icon}</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11, fontWeight:700, color:route.color, marginBottom:3}}>{route.label}</div>
                            <div style={{fontSize:8, color:'#6a8aaa'}}>{route.desc}</div>
                          </div>
                          <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4}}>
                            {targetable > 0 && (
                              <span style={{fontSize:7, color:'#ffcc44', background:'#1a1200',
                                border:'1px solid #ffcc4444', borderRadius:3, padding:'2px 6px'}}>
                                {targetable} available
                              </span>
                            )}
                            {owned > 0 && (
                              <span style={{fontSize:7, color:route.color, background:`${route.color}18`,
                                border:`1px solid ${route.color}44`, borderRadius:3, padding:'2px 6px'}}>
                                {owned} owned
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Skill list for selected route */}
              {activeRoute && routeDef && (
                <div style={{padding:'14px 20px', display:'flex', flexDirection:'column', gap:10}}>
                  {/* Flat-skills routes */}
                  {routeDef.skills && routeDef.skills.map(sk => {
                    const owned     = unlocked.includes(sk.id);
                    const isPending = sk.id === pendingId;
                    const targetable = canTarget(sk);
                    const prereqIds = !sk.prereq || sk.prereq === '__all_pa__' ? []
                      : Array.isArray(sk.prereq) ? sk.prereq : [sk.prereq];
                    const missingPrereqs = prereqIds.filter(id => !unlocked.includes(id));
                    const locked = !owned && !isPending && !targetable && missingPrereqs.length > 0;
                    return (
                      <button key={sk.id}
                        disabled={owned || isPending || !targetable}
                        onClick={() => setSkillTarget(acting.id, sk.id)}
                        style={{
                          fontFamily:'inherit',
                          cursor: (owned || isPending) ? 'default' : targetable ? 'pointer' : 'default',
                          textAlign:'left', borderRadius:7, padding:'11px 14px',
                          background: isPending ? `${routeDef.color}28` : owned ? `${routeDef.color}14` : '#0a1525',
                          border:`1px solid ${isPending ? routeDef.color : owned ? routeDef.color+'66' : targetable ? routeDef.color+'55' : '#1a2a40'}`,
                          opacity: locked ? 0.35 : 1, transition:'all .15s',
                        }}
                        onMouseEnter={e => { if (targetable) { e.currentTarget.style.background=`${routeDef.color}28`; e.currentTarget.style.borderColor=routeDef.color; }}}
                        onMouseLeave={e => { if (targetable) { e.currentTarget.style.background='#0a1525'; e.currentTarget.style.borderColor=`${routeDef.color}55`; }}}>
                        <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
                          <span style={{fontSize:20, marginTop:1}}>{sk.icon}</span>
                          <div style={{flex:1}}>
                            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:3}}>
                              <span style={{fontSize:10, fontWeight:700,
                                color: isPending ? '#ffffff' : owned ? routeDef.color : targetable ? '#c0d0e0' : '#3a5a7a'}}>
                                {sk.label}
                              </span>
                              {isPending && <span style={{fontSize:7, color:'#ffffff', background:routeDef.color,
                                borderRadius:3, padding:'1px 6px', fontWeight:700}}>✦ JUST UNLOCKED</span>}
                              {owned && !isPending && <span style={{fontSize:7, color:routeDef.color,
                                background:`${routeDef.color}22`, border:`1px solid ${routeDef.color}44`,
                                borderRadius:3, padding:'1px 5px'}}>✓ OWNED</span>}
                              {locked && missingPrereqs.length > 0 && (
                                <span style={{fontSize:7, color:'#3a5a7a'}}>🔒 {missingPrereqs.map(id => SKILL_BY_ID[id]?.label ?? id).join(' + ')}</span>
                              )}
                            </div>
                            <div style={{fontSize:8, color:'#5a7a8a', lineHeight:1.4}}>{sk.desc}</div>
                          </div>
                          <div style={{
                            fontSize:9, fontWeight:700, whiteSpace:'nowrap',
                            color: owned||isPending ? routeDef.color : '#ffcc44',
                            background:'#0a0e18',
                            border:`1px solid ${owned||isPending ? `${routeDef.color}44` : '#ffcc4433'}`,
                            borderRadius:4, padding:'3px 8px', marginTop:1,
                          }}>
                            {owned||isPending ? '✓' : `${sk.dbCost} DB`}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Sub-chain routes (Electric rig + Stances) — each chain is
                      its own window. Stance chains carry their stance's color and
                      lock shut until the stance is learned. Electric chains are
                      always open (no stance gate). */}
                  {routeDef.subChains && routeDef.subChains.map(chain => {
                    const chainColor  = chain.color ?? routeDef.color;
                    const stanceKnown = chain.stanceId ? stancesKnown.includes(chain.stanceId) : true;
                    return (
                    <div key={chain.id} style={{
                      border:`1px solid ${chainColor}${stanceKnown ? '55' : '2a'}`,
                      borderRadius:8, padding:'9px 11px',
                      background: stanceKnown ? `${chainColor}0a` : '#070c16',
                    }}>
                      <div style={{fontSize:8, color: stanceKnown ? chainColor : '#3a5a7a',
                        letterSpacing:2, marginBottom:6, fontWeight:700,
                        borderBottom:`1px solid ${chainColor}${stanceKnown ? '33' : '1a'}`, paddingBottom:4,
                        display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                        <span>{chain.label.toUpperCase()}</span>
                        {chain.stanceId && stanceKnown && (
                          <span style={{fontSize:6, color:chainColor, background:`${chainColor}18`,
                            border:`1px solid ${chainColor}44`, borderRadius:3, padding:'1px 5px',
                            letterSpacing:1}}>✓ STANCE KNOWN</span>
                        )}
                        {chain.stanceId && !stanceKnown && (
                          <span style={{fontSize:6, color:'#ff8866', letterSpacing:1}}>
                            🔒 Learn the {chain.stanceLabel} stance first (Second/Third/Fourth Stance)
                          </span>
                        )}
                        {chain.requiresFirst && !unlocked.includes(chain.requiresFirst) && pendingId !== chain.requiresFirst && (
                          <span style={{color:'#ff4444'}}>
                            🔒 Requires {SKILL_BY_ID[chain.requiresFirst]?.label}
                          </span>
                        )}
                      </div>
                      <div style={{display:'flex', flexDirection:'column', gap:6}}>
                        {chain.skills.map(sk => {
                          const skWithChain = {...sk, chainId: chain.id};
                          const owned      = unlocked.includes(sk.id);
                          const isPending  = sk.id === pendingId;
                          const targetable = canTarget(skWithChain);
                          // Multi-prereq aware: collect all prereq ids for lock display
                          const prereqIds  = !sk.prereq || sk.prereq === '__all_pa__' ? []
                            : Array.isArray(sk.prereq) ? sk.prereq : [sk.prereq];
                          const missingPrereqs = prereqIds.filter(id => !unlocked.includes(id));
                          const stanceLocked = !owned && !isPending
                            && sk.requiresStance && !stancesKnown.includes(sk.requiresStance);
                          const locked = stanceLocked
                            || (!owned && !isPending && !targetable && missingPrereqs.length > 0);
                          return (
                            <button key={sk.id}
                              disabled={owned || isPending || !targetable}
                              onClick={() => setSkillTarget(acting.id, sk.id)}
                              style={{
                                fontFamily:'inherit',
                                cursor: (owned||isPending) ? 'default' : targetable ? 'pointer' : 'default',
                                textAlign:'left', borderRadius:6, padding:'9px 12px',
                                background: isPending ? `${chainColor}24` : owned ? `${chainColor}14` : '#0a1525',
                                border:`1px solid ${isPending ? chainColor : owned ? chainColor+'66' : targetable ? chainColor+'55' : '#1a2a40'}`,
                                opacity: locked ? 0.35 : 1, transition:'all .15s',
                              }}
                              onMouseEnter={e => { if (targetable) { e.currentTarget.style.background=`${chainColor}22`; e.currentTarget.style.borderColor=chainColor; }}}
                              onMouseLeave={e => { if (targetable) { e.currentTarget.style.background='#0a1525'; e.currentTarget.style.borderColor=`${chainColor}55`; }}}>
                              <div style={{display:'flex', alignItems:'flex-start', gap:9}}>
                                <span style={{fontSize:16, marginTop:1}}>{sk.icon}</span>
                                <div style={{flex:1}}>
                                  <div style={{display:'flex', alignItems:'center', gap:7, marginBottom:2}}>
                                    <span style={{fontSize:9, fontWeight:700,
                                      color: isPending ? '#ffffff' : owned ? chainColor : targetable ? '#c0d0e0' : '#3a5a7a'}}>
                                      {sk.label}
                                    </span>
                                    {isPending && <span style={{fontSize:6, color:'#ffffff',
                                      background:chainColor, borderRadius:3, padding:'1px 5px'}}>✦ NEW</span>}
                                    {owned && !isPending && <span style={{fontSize:6, color:chainColor}}>✓</span>}
                                    {stanceLocked && (
                                      <span style={{fontSize:6, color:'#3a5a7a'}}>🔒 {chain.stanceLabel ?? 'Stance'} stance</span>
                                    )}
                                    {locked && !stanceLocked && missingPrereqs.length > 0 && (
                                      <span style={{fontSize:6, color:'#3a5a7a'}}>🔒 {missingPrereqs.map(id => SKILL_BY_ID[id]?.label ?? id).join(' + ')}</span>
                                    )}
                                  </div>
                                  <div style={{fontSize:7, color:'#4a6a7a', lineHeight:1.4}}>{sk.desc}</div>
                                </div>
                                <div style={{
                                  fontSize:8, fontWeight:700, whiteSpace:'nowrap',
                                  color: owned||isPending ? chainColor : '#ffcc44',
                                  background:'#0a0e18',
                                  border:`1px solid ${owned||isPending ? `${chainColor}33` : '#ffcc4433'}`,
                                  borderRadius:4, padding:'2px 7px',
                                }}>
                                  {owned||isPending ? '✓' : `${sk.dbCost} DB`}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );})}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* (legacy purchase modal removed — skill picks set a target path; DB auto-unlocks) */}

  </>);
}
