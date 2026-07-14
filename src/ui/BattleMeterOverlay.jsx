// =============================================================================
// ui/BattleMeterOverlay.jsx  —  full battle / riff-off duel overlay
// Presentational: every value & handler arrives via props, zero app-STATE
// imports (RiffHighway + the pure fallingNotes data module are the only
// imports). Internal helpers (NeonDie, spiritGlow, crowd fan-fare) live inside
// this block. Extracted from the Game render (BATTLE METER OVERLAY block).
// =============================================================================
import React from "react";
import { RiffHighway } from "./RiffHighway.jsx";
import { RIFF_FALL_DIFFICULTY } from "../riff/fallingNotes.js";

export function BattleMeterOverlay({
  RIFF_ANSWER_LABELS,
  RIFF_CONTOUR_LABELS,
  RIFF_LEN,
  SKILL_BY_ID,
  SWING_FX_INFO,
  SWING_UPGRADE_TIERS,
  battleMeterImg,
  battlePickImg,
  battleState,
  closeBattleOverlay,
  closeRiffOff,
  crowdBlueImg,
  crowdPinkImg,
  fameFromMargin,
  fireBeamClash,
  handleAtkDieClick,
  handleDefDieClick,
  hydraImg,
  knockbackSpaces,
  sonicKnockback,
  thrashKnockback,
  sonicFame,
  thrashFame,
  noteStates,
  playRiffOffPlayback,
  renderInstrument,
  riffBeginTurn,
  riffDifficulty,
  riffPressKey,
  riffStats,
  riffView,
  setBattleState,
  setDiceDisplay,
  setRiffDifficulty,
  setRiffView,
  setSkipBattleIntros,
  skipBattleIntro,
  skipBattleIntros,
  spirits,
}) {
  if (!battleState) return null;
  return (() => {
        const attacker = spirits.find(s => s.id === battleState.attackerId);
        const defender = spirits.find(s => s.id === battleState.defenderId);
        const { phase, atkStat, defStat, atkBase, atkBonus, defBase, defBonus, atkRoll, defRoll, atkTotal, defTotal,
                attackerWon, margin, damage, pickPos,
                spinFaceAtk, spinFaceDef, atkDieReady, defDieReady, sonicAttack } = battleState;

        // ── RETALIATION PHASES ────────────────────────────────────────────────
        // Handled by the dedicated "PART 2" counter screen further down, after
        // NeonDie + spiritGlow + the crowd helpers are in scope (so the counter
        // round can reuse the same dice, glow and fan-fare as the main battle).

        // ── RIFF-OFF PHASES — full-screen rhythm duel overlay ─────────────────
        if (battleState.riffOff) {
          const rTurn     = battleState.turn;
          const isAtkTurn = rTurn === 'attacker';
          const activeSp  = isAtkTurn ? attacker : defender;
          const rRiff     = isAtkTurn ? battleState.atkRiff : battleState.defRiff;
          const rResults  = isAtkTurn ? battleState.atkResults : battleState.defResults;
          const rNoteIdx  = battleState.noteIdx; // last-judged gem (progress-row highlight)
          // Show the latest judgment for this performer's run.
          const fbRaw     = battleState.feedback;
          const fb        = (fbRaw && fbRaw.turn === rTurn) ? fbRaw : null;
          const answerInfo = RIFF_ANSWER_LABELS[battleState.defRiff?.kind] ?? {};
          const noteColor  = activeSp?.color ?? '#f6ad55';
          const GRADE_COLORS = { perfect:'#44ff99', good:'#aaff44', ok:'#ffcc44', miss:'#ff4455', wrong:'#ff4455' };
          const GRADE_TEXT   = { perfect:'PERFECT!', good:'GOOD!', ok:'OK', miss:'MISSED!', wrong:'WRONG NOTE!' };

          // ── BEAM CLASH derived state ──────────────────────────────────────
          const clashing    = phase === 'riff_clash';
          const clashStage  = battleState.clashStage;       // charge | clash | break | escalate
          const round       = battleState.round ?? 1;
          const clashWinner = battleState.clashWinner;       // 'attacker' | 'defender' | null
          const clashIntense = round >= 2;
          const isBreak     = clashing && clashStage === 'break';
          // Round-2 riff phases (the new sudden-death round playing out)
          const r2intro     = phase === 'riff_r2intro';
          const inRiffPlay  = ['riff_countdown','riff_play','riff_handoff'].includes(phase) || r2intro;
          const bgBeams     = round >= 2 && inRiffPlay; // round-1 beams linger behind round 2
          // Lean: how far off-center the beams meet. Pushed toward the WEAKER
          // side (the one losing the push). attacker stronger → meet point right.
          const cLean = battleState.tie ? 0
            : (battleState.attackerWon ? 1 : -1) * Math.min(0.34, 0.06 + (battleState.margin ?? 0) * 0.05);
          // Meeting point as a fraction across the portrait band (0=left,1=right)
          const clashFrac =
              clashStage === 'charge'   ? 0.5
            : clashStage === 'clash'    ? 0.5 + cLean
            : clashStage === 'escalate' ? 0.5
            : clashStage === 'break'    ? (clashWinner === 'attacker' ? 0.86 : clashWinner === 'defender' ? 0.14 : 0.5)
            : 0.5;
          // Beams are "firing" once charged
          const beamsOut = clashing && clashStage !== 'charge';
          const atkColor = attacker?.color ?? '#ff4444';
          const defColor = defender?.color ?? '#00ccff';
          // Loser blast animation on the break
          const atkBlasted = isBreak && clashWinner === 'defender';
          const defBlasted = isBreak && clashWinner === 'attacker';
          // Screen-shake: a jolt on collision, a heavier (doubled on Round 2) quake on the break
          const containerShake =
              clashStage === 'break'    ? `clash-shake ${clashIntense ? '0.6s' : '0.45s'} cubic-bezier(.36,.07,.19,.97) ${clashIntense ? '2' : '1'} both`
            : clashStage === 'clash'    ? 'clash-shake 0.3s ease-out 1'
            : clashStage === 'escalate' ? 'clash-shake 0.45s ease-out 1'
            : undefined;

          // Highlight logic: who's "live" right now
          const atkLive = phase === 'riff_intro' || (['riff_countdown','riff_play'].includes(phase) && isAtkTurn)
            || (phase === 'riff_result' && !battleState.tie && battleState.attackerWon)
            || (clashing && (!isBreak || clashWinner === 'attacker'));
          const defLive = phase === 'riff_intro' || phase === 'riff_handoff'
            || (['riff_countdown','riff_play'].includes(phase) && !isAtkTurn)
            || (phase === 'riff_result' && !battleState.tie && !battleState.attackerWon)
            || (clashing && (!isBreak || clashWinner === 'defender'));

          // ── FAN-FARE: pink fans (attacker/left), blue fans (defender/right) ──
          // Energy tracks the duel: the live performer's side cheers, the
          // beam-lean favourite roars, and the winner's crowd erupts on the break.
          const rfCrowdStyle = (level, color, surge) => {
            const amp = 4 + level * 24, dur = Math.max(0.32, 0.95 - level * 0.55);
            const bright = 0.5 + level * 0.95 + (surge ? 0.5 : 0), glow = 5 + level * 30 + (surge ? 18 : 0);
            return { '--cheer-amp': `-${amp.toFixed(1)}px`,
              animation: `crowd-cheer ${surge ? '0.34' : dur.toFixed(2)}s ease-in-out infinite`,
              filter: `drop-shadow(0 0 ${glow.toFixed(0)}px ${color}) brightness(${bright.toFixed(2)})`,
              opacity: 0.4 + level * 0.6 };
          };
          const atkCheerLvl = isBreak ? (clashWinner === 'attacker' ? 1 : 0.15)
            : clashStage === 'escalate' ? 0.85
            : clashing ? (clashStage === 'clash' && cLean > 0 ? 0.8 : 0.5)
            : ['riff_countdown','riff_play'].includes(phase) ? (isAtkTurn ? 0.7 : 0.2)
            : r2intro ? 0.6 : 0.3;
          const defCheerLvl = isBreak ? (clashWinner === 'defender' ? 1 : 0.15)
            : clashStage === 'escalate' ? 0.85
            : clashing ? (clashStage === 'clash' && cLean < 0 ? 0.8 : 0.5)
            : ['riff_countdown','riff_play'].includes(phase) ? (!isAtkTurn ? 0.7 : 0.2)
            : r2intro ? 0.6 : 0.3;
          const atkSurge = isBreak && clashWinner === 'attacker';
          const defSurge = isBreak && clashWinner === 'defender';

          const noteGlyph = (n) => n === n.toUpperCase() ? `${n}♯` : n.toUpperCase();
          // Falling-notes runs judge gems in whatever order they cross the line,
          // so results carry a noteIdx — look each slot up by it. (Bot-filled
          // results also carry noteIdx; a plain positional array still works.)
          const progressRow = (notes, res, current, accent) => (
            <div style={{display:'flex', gap:8, justifyContent:'center', marginTop:16}}>
              {notes.map((n, i) => {
                const hasIdx = (res ?? []).some(x => x.noteIdx != null);
                const r = hasIdx ? res.find(x => x.noteIdx === i) : res?.[i];
                const played = !!r;
                const isCur  = i === current;
                const col = played ? GRADE_COLORS[r.grade] : isCur ? '#ffffff' : '#2a3a55';
                return (
                  <div key={i} style={{
                    width:34, height:40, display:'flex', alignItems:'center', justifyContent:'center',
                    border:`2px solid ${col}`, borderRadius:6, fontSize:13, fontWeight:700, color:col,
                    background: isCur ? '#16213a' : '#0a1020',
                    boxShadow: isCur ? `0 0 12px ${accent}66` : 'none',
                  }}>
                    {played ? noteGlyph(n) : isCur ? '?' : '·'}
                  </div>
                );
              })}
            </div>
          );
          const cardBase = (borderColor) => ({
            background:'#080f1e', border:`2px solid ${borderColor}`,
            borderRadius:12, padding:'20px 32px', minWidth:420, maxWidth:580, textAlign:'center',
            boxShadow:`0 0 40px ${borderColor}33`,
          });
          const bigBtn = (color) => ({
            fontFamily:'inherit', fontSize:11, padding:'10px 24px', marginTop:14,
            background:'#1a1400', border:`2px solid ${color}`, borderRadius:7,
            color, cursor:'pointer', fontWeight:700, boxShadow:`0 0 14px ${color}44`,
          });

          return (
            <div style={{
              position:'fixed', inset:0, background:'#000000f2', zIndex:9980,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              fontFamily:"'Orbitron',sans-serif",
              animation: clashing ? containerShake : undefined,
            }}>
              <style>{`
                @keyframes riffwin   { from { width:100%; } to { width:0%; } }
                @keyframes riffpulse { 0%{transform:scale(0.4);opacity:0;} 60%{transform:scale(1.18);opacity:1;} 100%{transform:scale(1);opacity:1;} }
                @keyframes riffglitch { 0%{transform:translate(0,0) skewX(0);} 15%{transform:translate(-6px,2px) skewX(-9deg);} 30%{transform:translate(7px,-3px) skewX(8deg);} 45%{transform:translate(-5px,1px) skewX(-5deg);} 60%{transform:translate(4px,2px) skewX(4deg);} 80%{transform:translate(-2px,-1px) skewX(-2deg);} 100%{transform:translate(0,0) skewX(0);} }
                /* ── Beam clash ── */
                @keyframes clash-orb-pulse  { 0%,100%{transform:translate(-50%,-50%) scale(1);} 50%{transform:translate(-50%,-50%) scale(1.16);} }
                @keyframes clash-orb-surge  { 0%,100%{transform:translate(-50%,-50%) scale(1.05);} 50%{transform:translate(-50%,-50%) scale(1.5);} }
                @keyframes clash-crackle    { 0%,100%{filter:brightness(1);} 25%{filter:brightness(1.55);} 50%{filter:brightness(0.8);} 75%{filter:brightness(1.7);} }
                @keyframes clash-charge      { 0%,100%{opacity:0.55; transform:translate(-50%,-50%) scale(0.85);} 50%{opacity:1; transform:translate(-50%,-50%) scale(1.1);} }
                @keyframes clash-blast-burst { 0%{opacity:0; transform:translate(-50%,-50%) scale(0.2);} 30%{opacity:1; transform:translate(-50%,-50%) scale(1);} 100%{opacity:0; transform:translate(-50%,-50%) scale(2);} }
                @keyframes clash-blast-left  { 0%{transform:translateX(0) rotate(0); opacity:1;} 100%{transform:translateX(-200px) rotate(-24deg); opacity:0;} }
                @keyframes clash-blast-right { 0%{transform:translateX(0) scaleX(-1) rotate(0); opacity:1;} 100%{transform:translateX(200px) scaleX(-1) rotate(24deg); opacity:0;} }
                @keyframes clash-flash       { 0%{opacity:0;} 12%{opacity:0.9;} 100%{opacity:0;} }
                @keyframes clash-shake       { 0%,100%{transform:translate(0,0);} 20%{transform:translate(-7px,4px);} 40%{transform:translate(6px,-5px);} 60%{transform:translate(-5px,3px);} 80%{transform:translate(4px,-2px);} }
                @keyframes crowd-cheer       { 0%,100%{transform:translateY(0) scaleY(1);} 50%{transform:translateY(var(--cheer-amp,-6px)) scaleY(1.05);} }
                @keyframes r2-slam           { 0%{opacity:0; transform:scale(0.4) rotate(-8deg);} 55%{opacity:1; transform:scale(1.15) rotate(3deg);} 100%{opacity:1; transform:scale(1) rotate(0);} }
                @keyframes bg-beam-pulse     { 0%,100%{opacity:0.18;} 50%{opacity:0.34;} }
              `}</style>

              {/* ── FAN-FARE — pink fans (attacker/left), blue fans (defender/right) ── */}
              <div style={{position:'absolute', left:0, right:0, bottom:0, height:'30%',
                           zIndex:-1, pointerEvents:'none', overflow:'hidden'}}>
                <div style={{position:'absolute', left:'-3%', bottom:'-2%', width:'52%', maxWidth:660}}>
                  <img src={crowdPinkImg} alt="" draggable={false}
                    style={{width:'100%', display:'block', mixBlendMode:'screen', transformOrigin:'bottom center',
                            ...rfCrowdStyle(atkCheerLvl, '#ff3ad0', atkSurge)}}/>
                </div>
                <div style={{position:'absolute', right:'-3%', bottom:'-2%', width:'52%', maxWidth:660}}>
                  <img src={crowdBlueImg} alt="" draggable={false}
                    style={{width:'100%', display:'block', mixBlendMode:'screen', transformOrigin:'bottom center',
                            ...rfCrowdStyle(defCheerLvl, '#34d6ff', defSurge)}}/>
                </div>
              </div>

              {/* ── LINGERING ROUND-1 BEAMS — locked in the background through Round 2 ── */}
              {bgBeams && (
                <div style={{position:'absolute', left:0, right:0, top:'40%', height:14, zIndex:-1,
                             pointerEvents:'none', animation:'bg-beam-pulse 1.3s ease-in-out infinite'}}>
                  <div style={{position:'absolute', top:'50%', left:'8%', width:'42%', height:12,
                    transform:'translateY(-50%)', borderRadius:12,
                    background:`linear-gradient(90deg, ${atkColor}00, ${atkColor} 80%, #ffffff)`,
                    boxShadow:`0 0 24px ${atkColor}`}}/>
                  <div style={{position:'absolute', top:'50%', right:'8%', width:'42%', height:12,
                    transform:'translateY(-50%)', borderRadius:12,
                    background:`linear-gradient(270deg, ${defColor}00, ${defColor} 80%, #ffffff)`,
                    boxShadow:`0 0 24px ${defColor}`}}/>
                  <div style={{position:'absolute', top:'50%', left:'50%', width:54, height:54,
                    transform:'translate(-50%,-50%)', borderRadius:'50%',
                    background:'radial-gradient(circle, #ffffff, #ffffff00 70%)'}}/>
                </div>
              )}

              {/* Title */}
              <div style={{position:'relative', zIndex:3, fontSize:24, fontWeight:900, letterSpacing:6, marginBottom:16,
                color: round >= 2 ? '#ff7733' : '#ffd700',
                textShadow: round >= 2 ? '0 0 28px #ff5522, 0 0 70px #ff990055' : '0 0 24px #ff444488, 0 0 60px #ffd70044'}}>
                {round >= 2 ? '🔥 RIFF-OFF · ROUND 2 🔥' : '⚡ RIFF-OFF ⚡'}
              </div>

              {/* Portraits — live player glows, the other waits in the dark.
                  During the beam clash this band also hosts the dueling beams. */}
              <div style={{position:'relative', display:'flex', alignItems:'flex-end', justifyContent:'center',
                           gap:70, marginBottom:18, width:'100%', maxWidth:760}}>

                {/* ── BEAM CLASH LAYER (behind the Spirits) ── */}
                {clashing && (() => {
                  const baseTh = clashIntense ? 30 : 18;            // beam thickness (px)
                  const orbSz  = (clashIntense ? 132 : 92) * (isBreak ? 1.25 : 1);
                  const leftW  = `${Math.max(0, (clashFrac - 0.10) * 100)}%`;
                  const rightW = `${Math.max(0, (0.90 - clashFrac) * 100)}%`;
                  const beamTransition = 'width 1.5s cubic-bezier(.6,0,.4,1), left 1.5s cubic-bezier(.6,0,.4,1)';
                  const orbAnim = clashStage === 'escalate' ? 'clash-orb-surge 0.5s ease-in-out infinite'
                                : isBreak ? 'none' : 'clash-orb-pulse 0.7s ease-in-out infinite';
                  return (
                    <div style={{position:'absolute', left:0, right:0, top:'24%', height:'46%',
                                 zIndex:1, pointerEvents:'none'}}>
                      {/* Attacker beam (from left) */}
                      <div style={{position:'absolute', top:'50%', left:'10%', width: beamsOut ? leftW : '0%',
                        height:baseTh, transform:'translateY(-50%)', borderRadius:baseTh, transition:beamTransition,
                        opacity: beamsOut ? 1 : 0,
                        background:`linear-gradient(90deg, ${atkColor} 0%, ${atkColor} 70%, #ffffff 100%)`,
                        boxShadow:`0 0 ${baseTh*1.4}px ${atkColor}, 0 0 ${baseTh*3}px ${atkColor}aa`,
                        animation: clashStage === 'clash' || clashStage === 'escalate' ? 'clash-crackle 0.16s steps(2,end) infinite' : 'none'}}/>
                      {/* Defender beam (from right) */}
                      <div style={{position:'absolute', top:'50%', right:'10%', width: beamsOut ? rightW : '0%',
                        height:baseTh, transform:'translateY(-50%)', borderRadius:baseTh, transition:beamTransition,
                        opacity: beamsOut ? 1 : 0,
                        background:`linear-gradient(270deg, ${defColor} 0%, ${defColor} 70%, #ffffff 100%)`,
                        boxShadow:`0 0 ${baseTh*1.4}px ${defColor}, 0 0 ${baseTh*3}px ${defColor}aa`,
                        animation: clashStage === 'clash' || clashStage === 'escalate' ? 'clash-crackle 0.16s steps(2,end) infinite' : 'none'}}/>
                      {/* Charging orbs at each Spirit while powering up */}
                      {clashStage === 'charge' && [['10%', atkColor], ['90%', defColor]].map(([x,c],i) => (
                        <div key={i} style={{position:'absolute', top:'50%', left:x,
                          width:orbSz*0.5, height:orbSz*0.5, borderRadius:'50%',
                          background:`radial-gradient(circle, #ffffff, ${c} 55%, transparent 72%)`,
                          animation:'clash-charge 0.5s ease-in-out infinite'}}/>
                      ))}
                      {/* Collision orb where the beams meet */}
                      {beamsOut && (
                        <div style={{position:'absolute', top:'50%', left:`${clashFrac*100}%`,
                          width:orbSz, height:orbSz, borderRadius:'50%', transition:'left 1.5s cubic-bezier(.6,0,.4,1)',
                          background:`radial-gradient(circle, #ffffff 0%, ${(clashFrac>0.5?atkColor:defColor)} 45%, transparent 70%)`,
                          boxShadow:`0 0 ${orbSz*0.6}px #ffffff, 0 0 ${orbSz}px ${clashFrac>0.5?atkColor:defColor}`,
                          animation:orbAnim}}/>
                      )}
                      {/* KO blast engulfing the loser on the break */}
                      {isBreak && clashWinner && (
                        <div style={{position:'absolute', top:'50%', left: clashWinner==='attacker' ? '90%' : '10%',
                          width:orbSz*2.4, height:orbSz*2.4, borderRadius:'50%',
                          background:`radial-gradient(circle, #ffffff 0%, ${clashWinner==='attacker'?atkColor:defColor}cc 35%, transparent 70%)`,
                          animation:'clash-blast-burst 1.6s ease-out both'}}/>
                      )}
                    </div>
                  );
                })()}

                <div style={{position:'relative', zIndex:2, textAlign:'center'}}>
                  <img src={attacker?.imageSrc} alt={attacker?.name}
                    style={{height:190, width:'auto', objectFit:'contain', objectPosition:'bottom center',
                      opacity: atkLive ? 1 : 0.35,
                      filter:`drop-shadow(0 0 ${atkLive ? (clashing ? 34 : 26) : 8}px ${atkColor}${atkLive ? 'aa' : '44'})`,
                      transition:'opacity 0.4s, filter 0.4s',
                      animation: atkBlasted ? 'clash-blast-left 0.9s ease-in both' : 'none'}}/>
                  <div style={{fontSize:9, color:attacker?.color ?? '#ff8866', letterSpacing:2, marginTop:4}}>🎤 {attacker?.name}</div>
                </div>
                <div style={{fontSize:20, fontWeight:900, color:'#3a5a7a', paddingBottom:80,
                  opacity: clashing ? 0 : 1, transition:'opacity 0.3s'}}>VS</div>
                <div style={{position:'relative', zIndex:2, textAlign:'center'}}>
                  <img src={defender?.imageSrc} alt={defender?.name}
                    style={{height:190, width:'auto', objectFit:'contain', objectPosition:'bottom center',
                      transform:'scaleX(-1)',
                      opacity: defLive ? 1 : 0.35,
                      filter:`drop-shadow(0 0 ${defLive ? (clashing ? 34 : 26) : 8}px ${defColor}${defLive ? 'aa' : '44'})`,
                      transition:'opacity 0.4s, filter 0.4s',
                      animation: defBlasted ? 'clash-blast-right 0.9s ease-in both' : 'none'}}/>
                  <div style={{fontSize:9, color:defender?.color ?? '#66ccff', letterSpacing:2, marginTop:4}}>🎸 {defender?.name}</div>
                </div>
              </div>

              {/* ── FULL-SCREEN IMPACT FLASH (the break, brighter on round 2) ── */}
              {isBreak && (
                <div key={`flash-${round}`} style={{position:'absolute', inset:0, pointerEvents:'none', zIndex:9,
                  background: clashWinner ? `radial-gradient(circle at ${clashWinner==='attacker'?'78%':'22%'} 42%, #ffffff, ${(clashWinner==='attacker'?atkColor:defColor)}00 60%)` : '#ffffff',
                  animation:`clash-flash ${clashIntense ? '0.7s' : '0.5s'} ease-out both`}}/>
              )}

              {/* ── INTRO ── */}
              {phase === 'riff_intro' && (
                <div style={cardBase('#ffd700')}>
                  <div style={{fontSize:11, color:'#ffd700', letterSpacing:2, marginBottom:10}}>
                    🔊 PLUGGED IN · FACE TO FACE · BEAMS CROSSED
                  </div>
                  <div style={{fontSize:9, color:'#8aa5c5', lineHeight:1.8, marginBottom:8}}>
                    {battleState.atkRiff?.notes?.length ?? RIFF_LEN} notes flash one by one — hit the matching key the INSTANT it appears.<br/>
                    <span style={{color:'#ffcc44'}}>CAPITAL letters are SHARPS — hold SHIFT.</span><br/>
                    <span style={{color:'#ff8855'}}>The riff has a GROOVE — some notes rush in with no warning, some sit behind a rest.</span><br/>
                    Accuracy wins · reaction time breaks ties · loser eats the feedback.
                  </div>
                  <div style={{fontSize:8.5, color:'#6a8aaa', lineHeight:1.7, marginBottom:6}}>
                    {attacker?.name} calls a <span style={{color:attacker?.color ?? '#ff8866'}}>{RIFF_CONTOUR_LABELS[battleState.atkRiff?.contour]}</span><br/>
                    {defender?.name} answers with a <span style={{color:defender?.color ?? '#66ccff'}}>{answerInfo.name}</span> — {answerInfo.desc}
                  </div>
                  <button onClick={() => riffBeginTurn('attacker')} style={bigBtn('#ffd700')}>
                    🎤 {attacker?.name} — DROP THE RIFF
                  </button>
                  <div style={{marginTop:7, fontSize:8.5, color:'#6a8aaa'}}>
                    <span onClick={() => riffBeginTurn('attacker')}
                      style={{cursor:'pointer', textDecoration:'underline', color:'#9ab'}}>Skip intro ▸</span>
                  </div>
                </div>
              )}

              {/* ── COUNTDOWN ── */}
              {phase === 'riff_countdown' && (
                <div style={cardBase(noteColor)}>
                  <div style={{fontSize:10, color:noteColor, letterSpacing:2, marginBottom:8}}>
                    {isAtkTurn ? '🎤 THE CALL' : '🎸 THE ANSWER'} — {activeSp?.name}, GET READY
                  </div>
                  <div key={battleState.countdown} style={{fontSize:64, fontWeight:900, color:'#fff',
                    textShadow:`0 0 30px ${noteColor}`, animation:'riffpulse 0.3s ease-out', lineHeight:1.1}}>
                    {battleState.countdown}
                  </div>
                  <div style={{display:'flex', gap:6, justifyContent:'center', margin:'8px 0 2px'}}>
                    {['piano','guitar'].map(v => (
                      <button key={v} onClick={() => setRiffView(v)} style={{
                        cursor:'pointer', fontFamily:"'Orbitron',sans-serif", fontSize:9, letterSpacing:1, padding:'4px 10px', borderRadius:6,
                        color: riffView === v ? '#06111f' : noteColor,
                        background: riffView === v ? noteColor : 'transparent',
                        border:`1px solid ${noteColor}`}}>
                        {v === 'piano' ? '🎹 PIANO' : '🎸 GUITAR'}
                      </button>
                    ))}
                  </div>
                  {/* 🎚️ fall-speed / window presets — locked in once the riff drops */}
                  <div style={{display:'flex', gap:6, justifyContent:'center', margin:'6px 0 2px'}}>
                    {Object.entries(RIFF_FALL_DIFFICULTY).map(([k, d]) => (
                      <button key={k} onClick={() => setRiffDifficulty?.(k)}
                        title={d.blurb} style={{
                        cursor:'pointer', fontFamily:"'Orbitron',sans-serif", fontSize:8, letterSpacing:1, padding:'3px 8px', borderRadius:6,
                        color: riffDifficulty === k ? '#06111f' : '#8aa5c5',
                        background: riffDifficulty === k ? '#8aa5c5' : 'transparent',
                        border:'1px solid #4a5f80'}}>
                        {d.icon} {d.label}
                      </button>
                    ))}
                  </div>
                  {progressRow(rRiff.notes, rResults, -1, noteColor)}
                  <label style={{marginTop:8, fontSize:8, color:'#6a8aaa', cursor:'pointer',
                    display:'flex', gap:5, alignItems:'center', justifyContent:'center'}}>
                    <input type="checkbox" checked={skipBattleIntros}
                      onChange={e => setSkipBattleIntros(e.target.checked)}
                      style={{accentColor:noteColor, cursor:'pointer'}}/>
                    ⏭ auto-skip battle cinematics (swings, sonics & riff-offs)
                  </label>
                </div>
              )}

              {/* ── PLAY — the falling-notes highway (Guitar Hero style) ── */}
              {phase === 'riff_play' && (
                <div style={cardBase(noteColor)}>
                  <div style={{fontSize:10, color:noteColor, letterSpacing:2, marginBottom:6}}>
                    {isAtkTurn ? '🎤 THE CALL' : '🎸 THE ANSWER'} — {activeSp?.name}
                  </div>
                  {battleState.riffRun ? (
                    <div style={{display:'flex', justifyContent:'center', margin:'2px 0'}}>
                      <RiffHighway
                        run={battleState.riffRun}
                        results={rResults}
                        ghostHit={battleState.ghostHit}
                        view={riffView}
                        accent={noteColor}
                        onPressKey={riffPressKey}
                        showLabels={RIFF_FALL_DIFFICULTY[riffDifficulty]?.showLabels ?? true}
                      />
                    </div>
                  ) : (
                    /* bot performer — no live run to render, just the rip-through beat */
                    <div style={{fontSize:11, color:'#8aa5c5', margin:'18px 0', letterSpacing:1}}>
                      🤖 shredding…
                    </div>
                  )}
                  <div style={{fontSize:9, letterSpacing:2, height:14, marginTop:6,
                    color: (!isAtkTurn && battleState.defGhosts) ? '#b899ff' : '#4a5f80'}}>
                    {(!isAtkTurn && battleState.defGhosts) ? '🎴 GHOST BARRAGE — EVERY NOTE DEMANDS BOTH KEYS'
                     : 'HIT THE LETTER AS THE GEM CROSSES THE LINE — ⬆ GOLD RING = SHARP, HOLD SHIFT'}
                  </div>
                  {/* Timing feedback — how tight to the line the press landed */}
                  <div style={{height:18, marginTop:8, fontSize:12, fontWeight:800, letterSpacing:2,
                    color: fb ? GRADE_COLORS[fb.grade] : 'transparent'}}>
                    {fb ? `${GRADE_TEXT[fb.grade]}${fb.rt != null ? ` · ${fb.early ? '−' : '+'}${fb.rt}ms` : ''}` : '·'}
                  </div>
                  {progressRow(rRiff.notes, rResults, rNoteIdx, noteColor)}
                </div>
              )}

              {/* ── HANDOFF — pass the keyboard ── */}
              {phase === 'riff_handoff' && (() => {
                const aS = riffStats(battleState.atkResults);
                return (
                  <div style={cardBase(defender?.color ?? '#00ccff')}>
                    <div style={{fontSize:11, color:'#ffd700', letterSpacing:2, marginBottom:10}}>
                      🔁 PASS THE KEYBOARD!
                    </div>
                    <div style={{fontSize:9, color:'#8aa5c5', marginBottom:10}}>
                      {attacker?.name} laid down the call: <b style={{color:'#fff'}}>{aS.hits}/{battleState.atkRiff?.notes?.length ?? RIFF_LEN} notes</b>
                      {aS.avgRt != null ? <> · <b style={{color:'#fff'}}>±{aS.avgRt}ms</b> off the line</> : <> · no clean hits</>}
                    </div>
                    {progressRow(battleState.atkRiff.notes, battleState.atkResults, -1, attacker?.color ?? '#ff8866')}
                    <div style={{fontSize:8.5, color:'#6a8aaa', lineHeight:1.7, margin:'14px 0 0'}}>
                      {defender?.name}, your answer is a <span style={{color:defender?.color ?? '#66ccff'}}>{answerInfo.name}</span> — {answerInfo.desc}
                    </div>
                    <button onClick={() => riffBeginTurn('defender')} style={bigBtn(defender?.color ?? '#00ccff')}>
                      🎸 {defender?.name} — DROP THE ANSWER
                    </button>
                  </div>
                );
              })()}

              {/* ── ROUND 2 INTRO — fresh, faster, sudden death ── */}
              {phase === 'riff_r2intro' && (
                <div style={cardBase('#ff7733')}>
                  <div style={{fontSize:16, fontWeight:900, letterSpacing:3, color:'#ff7733',
                    textShadow:'0 0 24px #ff5522', marginBottom:8, animation:'r2-slam 0.6s cubic-bezier(.22,1,.36,1) both'}}>
                    🔥 ROUND 2 🔥
                  </div>
                  <div style={{fontSize:9, color:'#ffcc99', lineHeight:1.8, marginBottom:6}}>
                    Round 1 was too close to call — the beams couldn't break.<br/>
                    <span style={{color:'#fff'}}>Sudden death.</span> New riffs, <span style={{color:'#ff7733'}}>faster windows, no breathers.</span><br/>
                    Whoever plays cleaner here takes the whole duel — winner's blast hits even harder.
                  </div>
                  <div style={{fontSize:8.5, color:'#6a8aaa', lineHeight:1.7, marginBottom:2}}>
                    {attacker?.name} calls a <span style={{color:attacker?.color ?? '#ff8866'}}>{RIFF_CONTOUR_LABELS[battleState.atkRiff?.contour]}</span> ·
                    {defender?.name} answers with a <span style={{color:defender?.color ?? '#66ccff'}}>{answerInfo.name}</span>
                  </div>
                  <button onClick={() => riffBeginTurn('attacker')} style={bigBtn('#ff7733')}>
                    🎤 {attacker?.name} — BRING IT →
                  </button>
                  <div style={{marginTop:7, fontSize:8.5, color:'#9a7'}}>
                    <span onClick={() => riffBeginTurn('attacker')}
                      style={{cursor:'pointer', textDecoration:'underline', color:'#c98'}}>Skip intro ▸</span>
                  </div>
                </div>
              )}

              {/* ── BEAM CLASH — charge → collide → break / escalate ── */}
              {phase === 'riff_clash' && (() => {
                const clashColor = clashStage === 'escalate' ? '#ffaa33'
                  : isBreak ? (clashWinner === 'attacker' ? atkColor : clashWinner === 'defender' ? defColor : '#8aa5c5')
                  : '#ffd700';
                const winName = clashWinner === 'attacker' ? attacker?.name : clashWinner === 'defender' ? defender?.name : null;
                return (
                  <div style={cardBase(clashColor)}>
                    <div style={{fontSize:10, color:clashColor, letterSpacing:3, marginBottom:6}}>
                      🌟 BEAM CLASH · ROUND {round}{clashIntense ? ' — GO BEYOND!' : ''}
                    </div>
                    {clashStage === 'charge' && (
                      <>
                        <div style={{fontSize:9, color:'#8aa5c5', lineHeight:1.7, marginBottom:6}}>
                          Both Spirits plant their feet and pour everything into one beam.<br/>
                          The crowd-pleaser's blast will <span style={{color:'#fff'}}>outclass</span> the other and sweep them away.
                        </div>
                        <button onClick={fireBeamClash} style={bigBtn(clashColor)}>
                          {clashIntense ? '🔥🔥 UNLEASH IT ALL →' : '🔥 FIRE BEAMS →'}
                        </button>
                      </>
                    )}
                    {clashStage === 'clash' && (
                      <div style={{fontSize:13, fontWeight:900, letterSpacing:3, color:'#fff',
                        textShadow:'0 0 20px #ffffff88', animation:'clash-crackle 0.12s steps(2,end) infinite'}}>
                        ⚡ BEAMS COLLIDE ⚡
                      </div>
                    )}
                    {clashStage === 'escalate' && (
                      <div style={{fontSize:12, fontWeight:900, letterSpacing:2, color:'#ffaa33',
                        textShadow:'0 0 20px #ffaa3388'}}>
                        ⚖️ TOO CLOSE — BEAMS LOCK!<br/>
                        <span style={{fontSize:9, color:'#ffcc88', letterSpacing:1}}>Stakes rising — escalating to Round 2…</span>
                      </div>
                    )}
                    {isBreak && (
                      <div style={{fontSize:15, fontWeight:900, letterSpacing:2,
                        color:clashColor, textShadow:`0 0 24px ${clashColor}aa`}}>
                        {winName ? `💥 ${winName}'S BEAM BREAKS THROUGH!` : '🤝 BEAMS CANCEL OUT'}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── RESULT ── */}
              {phase === 'riff_result' && (() => {
                const { atkStats: A, defStats: D, tie, attackerWon: won, margin: m, damage: dmg, decidedBy } = battleState;
                const winSp  = tie ? null : won ? attacker : defender;
                const statCard = (sp, st, riffObj, res, highlight) => (
                  <div style={{flex:1, padding:'12px 14px', borderRadius:8, textAlign:'center',
                    border:`2px solid ${highlight ? (sp?.color ?? '#ffd700') : '#1e3a5f'}`,
                    background: highlight ? '#101a30' : '#0a1020',
                    boxShadow: highlight ? `0 0 18px ${(sp?.color ?? '#ffd700')}44` : 'none'}}>
                    <div style={{fontSize:9, color:sp?.color ?? '#8aa5c5', letterSpacing:1, marginBottom:6}}>{sp?.name}</div>
                    <div style={{fontSize:16, fontWeight:900, color:'#fff'}}>{st.hits}/{riffObj?.notes?.length ?? RIFF_LEN}</div>
                    <div style={{fontSize:9, fontWeight:700, color: highlight ? (sp?.color ?? '#ffd700') : '#8aa5c5', marginBottom:2}}>
                      {st.quality}% clean{st.perfects > 0 ? ` · ${st.perfects}✦` : ''}
                    </div>
                    <div style={{fontSize:8, color:'#6a8aaa', marginBottom:4}}>
                      {st.avgRt != null ? `±${st.avgRt}ms off the line` : 'no clean hits'}
                    </div>
                    <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                      {riffObj.notes.map((n, i) => {
                        const r = (res ?? []).find(x => x.noteIdx === i) ?? res?.[i];
                        return <span key={i} style={{fontSize:10, fontWeight:700,
                          color: r ? GRADE_COLORS[r.grade] : '#2a3a55'}}>{noteGlyph(n)}</span>;
                      })}
                    </div>
                    <button onClick={() => playRiffOffPlayback(riffObj.freqs, riffObj.rhythm)}
                      style={{fontFamily:'inherit', fontSize:8, padding:'4px 10px', marginTop:8,
                        background:'#0a1020', border:`1px solid ${sp?.color ?? '#3a5070'}`,
                        borderRadius:5, color:sp?.color ?? '#8aa5c5', cursor:'pointer', letterSpacing:1}}>
                      ▶ HEAR THE RIFF
                    </button>
                  </div>
                );
                return (
                  <div style={cardBase(tie ? '#8aa5c5' : (winSp?.color ?? '#ffd700'))}>
                    <div style={{fontSize:13, fontWeight:900, letterSpacing:3, marginBottom:12,
                      color: tie ? '#8aa5c5' : (winSp?.color ?? '#ffd700'),
                      textShadow: tie ? 'none' : `0 0 20px ${(winSp?.color ?? '#ffd700')}88`}}>
                      {tie ? '🤝 DEAD HEAT — CROWD CAN\'T DECIDE' : `🏆 ${winSp?.name} WINS THE RIFF-OFF!`}
                    </div>
                    <div style={{display:'flex', gap:12, marginBottom:12}}>
                      {statCard(attacker, A, battleState.atkRiff, battleState.atkResults, !tie && won)}
                      {statCard(defender, D, battleState.defRiff, battleState.defResults, !tie && !won)}
                    </div>
                    <div style={{fontSize:8.5, color:'#6a8aaa', lineHeight:1.7}}>
                      {tie
                        ? 'Beams cancelled out after 2 rounds — no damage, no Fame, both Spirits walk away with their pride.'
                        : <>Won on <span style={{color:'#ffcc44'}}>{decidedBy}</span> · sealed by beam clash{(battleState.round ?? 1) >= 2 ? ' (Round 2!)' : ''} · margin {m} →
                          <span style={{color:'#ff6677'}}> {dmg} Vibe damage</span> +
                          <span style={{color:'#88bbff'}}> knockback</span> ·
                          <span style={{color:'#ffd700'}}> ⭐ Fame to the winner</span></>}
                    </div>
                    <button onClick={closeRiffOff} style={bigBtn(tie ? '#8aa5c5' : (winSp?.color ?? '#ffd700'))}>
                      🤘 ROCK ON →
                    </button>
                  </div>
                );
              })()}
            </div>
          );
        }

        // ── METER GEOMETRY (pixel-measured from 2690×1389 source) ────────────
        // Display: 860 × 444 (scale = 860/2690 = 0.3197)
        // pickPos: 0=center, negative=left(attacker), positive=right(defender)
        const METER_W = 860; const METER_H = 444;
        const TRACK_Y = 336;       // vertical center of number track row
        const CENTER_X = 433.5;    // midpoint between two '1' slots (nudged right)
        const SLOT_W = 32.2;       // px per slot — nudged down from 33.0
        const clampedPos = Math.max(-10, Math.min(10, pickPos ?? 0));
        const pickX = CENTER_X + clampedPos * SLOT_W;

        // Die slots — pixel-measured box centers from Battle_Meter.png (display scale).
        // Pink box center ≈ (301,178); blue box center ≈ (561,178). The art boxes are
        // 156×126, not square — sizing the slot rect to match keeps the die centered.
        const ATK_SQ_X = 301; const ATK_SQ_Y = 178;
        const DEF_SQ_X = 561; const DEF_SQ_Y = 178;
        const SQ_W = 156; const SQ_H = 126;   // actual art-box dimensions (display px)
        const DIE_SIZE = 104; // rendered die — fits within the box, centered within it

        // Phase helpers
        const showAtkDie = ['atk_die_spin','atk_die_settling','pick_atk_slide',
                            'def_die_spin','def_die_settling','pick_def_slide','result'].includes(phase);
        const showDefDie = ['def_die_spin','def_die_settling','pick_def_slide','result'].includes(phase)
                           && !battleState.posing;
        const atkSpinning = phase === 'atk_die_spin';
        const defSpinning = phase === 'def_die_spin';
        const atkFace = showAtkDie ? (spinFaceAtk ?? atkRoll) : null;
        const defFace = showDefDie ? (spinFaceDef ?? defRoll) : null;

        // Spirit visibility
        const atkIn = ['enter_attacker','flash_drive','pick_drive_slide','enter_defender',
                       'flash_sustain','pick_sustain_slide','atk_die_spin','atk_die_settling',
                       'pick_atk_slide','def_die_spin','def_die_settling','pick_def_slide','result'].includes(phase);
        const defIn = ['enter_defender','flash_sustain','pick_sustain_slide','atk_die_spin',
                       'atk_die_settling','pick_atk_slide','def_die_spin','def_die_settling',
                       'pick_def_slide','result'].includes(phase);

        const showFlashDrive   = ['flash_drive','pick_drive_slide'].includes(phase);
        const showFlashSustain = ['flash_sustain','pick_sustain_slide'].includes(phase);

        // Sliding pick uses CSS transition only during slide phases
        const isSliding = ['pick_drive_slide','pick_sustain_slide','pick_atk_slide','pick_def_slide'].includes(phase);
        const pickTransition = isSliding ? 'left 1.2s cubic-bezier(0.25,0.46,0.45,0.94)' : 'left 0s';

        // D6 pip layouts: [value] → array of [cx,cy] offsets from die center (in a 0-1 space, scaled)
        const PIPS = {
          1: [[0,0]],
          2: [[-0.28,-0.28],[0.28,0.28]],
          3: [[-0.28,-0.28],[0,0],[0.28,0.28]],
          4: [[-0.28,-0.28],[0.28,-0.28],[-0.28,0.28],[0.28,0.28]],
          5: [[-0.28,-0.28],[0.28,-0.28],[0,0],[-0.28,0.28],[0.28,0.28]],
          6: [[-0.28,-0.33],[0.28,-0.33],[-0.28,0],[0.28,0],[-0.28,0.33],[0.28,0.33]],
        };

        // Neon die rendered as inline SVG — supports d6 (pips), d8, d10, d12 (numerals)
        function NeonDie({ value, spinning, color, size = 110, sides = 6 }) {
          const glowColor = color ?? '#ff4444';
          const half = size / 2;
          const val = value ?? 1;

          // ── D6: classic rounded-rect with pips ──────────────────────────────
          if (sides === 6) {
            const face = Math.max(1, Math.min(6, val));
            const pips = PIPS[face] || PIPS[1];
            const pipR  = size * 0.09;
            const spread = size * 0.30;
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',overflow:'visible'}}>
                <rect x={4} y={4} width={size-8} height={size-8} rx={14}
                  fill="#060810" stroke={glowColor} strokeWidth={spinning ? 3 : 2}
                  style={spinning ? {filter:`drop-shadow(0 0 10px ${glowColor})`} : {}}/>
                {[[10,10],[size-10,10],[10,size-10],[size-10,size-10]].map(([cx,cy],i) => (
                  <circle key={i} cx={cx} cy={cy} r={2.5} fill={glowColor} opacity={0.25}/>
                ))}
                {pips.map(([ox,oy], i) => (
                  <circle key={i}
                    cx={half + ox * spread * 2} cy={half + oy * spread * 2}
                    r={pipR} fill={glowColor}
                    style={spinning ? {filter:`drop-shadow(0 0 5px ${glowColor})`} : {}}/>
                ))}
              </svg>
            );
          }

          // ── D8: octagon (diamond-ish) ────────────────────────────────────────
          if (sides === 8) {
            const r = half - 5;
            const pts = Array.from({length:8}, (_,i) => {
              const a = (i * Math.PI / 4) - Math.PI / 8;
              return `${half + r * Math.cos(a)},${half + r * Math.sin(a)}`;
            }).join(' ');
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',overflow:'visible'}}>
                <polygon points={pts} fill="#060810" stroke={glowColor}
                  strokeWidth={spinning ? 3 : 2}
                  style={spinning ? {filter:`drop-shadow(0 0 12px ${glowColor})`} : {}}/>
                {/* Inner octagon decoration */}
                {(() => {
                  const r2 = r * 0.72;
                  const pts2 = Array.from({length:8}, (_,i) => {
                    const a = (i * Math.PI / 4) - Math.PI / 8;
                    return `${half + r2 * Math.cos(a)},${half + r2 * Math.sin(a)}`;
                  }).join(' ');
                  return <polygon points={pts2} fill="none" stroke={glowColor} strokeWidth={0.7} opacity={0.25}/>;
                })()}
                <text x={half} y={half + size * 0.13}
                  textAnchor="middle" fontSize={size * 0.38} fontWeight="900"
                  fontFamily="'Orbitron',sans-serif"
                  fill={glowColor}
                  style={spinning ? {filter:`drop-shadow(0 0 8px ${glowColor})`} : {}}>
                  {val}
                </text>
                <text x={half} y={size - 10}
                  textAnchor="middle" fontSize={size * 0.13} fontWeight="700"
                  fontFamily="'Orbitron',sans-serif" fill={glowColor} opacity={0.5}>
                  d8
                </text>
              </svg>
            );
          }

          // ── D10: kite / elongated diamond ───────────────────────────────────
          if (sides === 10) {
            const topY    = 5;
            const botY    = size - 5;
            const midTopY = half - size * 0.08;
            const midBotY = half + size * 0.08;
            const sideX   = half - 4;
            // 10-point kite: top spike → wide sides → bottom spike
            const pts = Array.from({length:10}, (_,i) => {
              const a = (i * 2 * Math.PI / 10) - Math.PI / 2;
              const rx = (i % 2 === 0) ? half - 6 : half - 22;
              const ry = (i % 2 === 0) ? half - 6 : half - 22;
              return `${half + rx * Math.cos(a)},${half + ry * Math.sin(a)}`;
            }).join(' ');
            // Simpler clean kite shape
            const kite = [
              `${half},${topY}`,
              `${half + size*0.42},${half - size*0.07}`,
              `${half + size*0.26},${half + size*0.06}`,
              `${half},${botY}`,
              `${half - size*0.26},${half + size*0.06}`,
              `${half - size*0.42},${half - size*0.07}`,
            ].join(' ');
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',overflow:'visible'}}>
                <polygon points={kite} fill="#060810" stroke={glowColor}
                  strokeWidth={spinning ? 3 : 2}
                  style={spinning ? {filter:`drop-shadow(0 0 12px ${glowColor})`} : {}}/>
                {/* Horizontal mid line */}
                <line x1={half - size*0.38} y1={half - size*0.015}
                      x2={half + size*0.38} y2={half - size*0.015}
                  stroke={glowColor} strokeWidth={0.7} opacity={0.3}/>
                <text x={half} y={half + size * 0.10}
                  textAnchor="middle" fontSize={size * 0.36} fontWeight="900"
                  fontFamily="'Orbitron',sans-serif"
                  fill={glowColor}
                  style={spinning ? {filter:`drop-shadow(0 0 8px ${glowColor})`} : {}}>
                  {val}
                </text>
                <text x={half} y={size - 14}
                  textAnchor="middle" fontSize={size * 0.13} fontWeight="700"
                  fontFamily="'Orbitron',sans-serif" fill={glowColor} opacity={0.5}>
                  d10
                </text>
              </svg>
            );
          }

          // ── D12: regular pentagon ────────────────────────────────────────────
          if (sides === 12) {
            const r = half - 5;
            const pts = Array.from({length:5}, (_,i) => {
              const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
              return `${half + r * Math.cos(a)},${half + r * Math.sin(a)}`;
            }).join(' ');
            const r2 = r * 0.65;
            const pts2 = Array.from({length:5}, (_,i) => {
              const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
              return `${half + r2 * Math.cos(a)},${half + r2 * Math.sin(a)}`;
            }).join(' ');
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',overflow:'visible'}}>
                <polygon points={pts} fill="#060810" stroke={glowColor}
                  strokeWidth={spinning ? 3 : 2}
                  style={spinning ? {filter:`drop-shadow(0 0 14px ${glowColor})`} : {}}/>
                <polygon points={pts2} fill="none" stroke={glowColor} strokeWidth={0.7} opacity={0.22}/>
                <text x={half} y={half + size * 0.14}
                  textAnchor="middle" fontSize={size * 0.36} fontWeight="900"
                  fontFamily="'Orbitron',sans-serif"
                  fill={glowColor}
                  style={spinning ? {filter:`drop-shadow(0 0 10px ${glowColor})`} : {}}>
                  {val}
                </text>
                <text x={half} y={half + size * 0.44}
                  textAnchor="middle" fontSize={size * 0.13} fontWeight="700"
                  fontFamily="'Orbitron',sans-serif" fill={glowColor} opacity={0.5}>
                  d12
                </text>
              </svg>
            );
          }

          return null;
        }

        const SPIRIT_H = 340;

        // ── STAT-STRENGTH GLOW ──────────────────────────────────────────────
        // Effective battle stat → glow intensity. Faint at low Drive/Sustain,
        // brighter + pulsing as it climbs, electric "storm" flicker at the top.
        // `surge` = momentary bright burst during the DRIVE/FEEDBACK reveal beat.
        function spiritGlow(stat, color, surge) {
          const gc = color ?? '#ffffff';
          if (surge) return { '--gc': gc, animation: 'battle-glow-burst 0.9s cubic-bezier(.22,1,.36,1)',
                              filter:`drop-shadow(0 0 60px #ffffff) drop-shadow(0 0 26px ${gc})` };
          const s = stat ?? 0;
          if (s <= 4)  return { filter:`drop-shadow(0 0 14px ${gc}66)` };                          // barely there
          if (s <= 6)  return { filter:`drop-shadow(0 0 26px ${gc}aa)` };                          // soft steady (baseline)
          if (s <= 8)  return { '--gc': gc, filter:`drop-shadow(0 0 34px ${gc}cc)`,
                                animation:'battle-glow-pulse 1.9s ease-in-out infinite' };          // bright + slow pulse
          if (s <= 10) return { '--gc': gc, filter:`drop-shadow(0 0 46px ${gc})`,
                                animation:'battle-glow-pulse-fast 1.1s ease-in-out infinite' };     // intense + fast pulse
          return { '--gc': gc, filter:`drop-shadow(0 0 60px ${gc}) drop-shadow(0 0 10px #ffffff)`,
                   animation:'battle-glow-storm 0.55s steps(6,end) infinite' };                    // electric storm
        }
        const atkGlow = spiritGlow(atkStat, attacker?.color, showFlashDrive);
        const defGlow = spiritGlow(defStat, defender?.color, showFlashSustain);

        // ── FAN-FARE / CROWD CHEER ──────────────────────────────────────────
        // The battle pick is the crowd's heartbeat. The further it slides toward
        // a Spirit, the more that Spirit glows — and the harder that side's fans
        // cheer. pickPos is negative toward the attacker (left / pink fans) and
        // positive toward the defender (right / blue fans), so each side's "lead"
        // is just how far the pick has crossed onto their half. Normalise that
        // lead into a 0..1 cheer level (≈8 slots of lead = full-tilt roar).
        const atkCheer = Math.max(0, Math.min(1, -clampedPos / 8)); // pink, left
        const defCheer = Math.max(0, Math.min(1,  clampedPos / 8)); // blue, right
        // Confirm-beat pops: fans jump when their number is locked in / on a win.
        const atkSurge = showFlashDrive   || (phase === 'result' && attackerWon);
        const defSurge = showFlashSustain || (phase === 'result' && !attackerWon);
        // level→energy: bob height, tempo, brightness and glow all rise together.
        // Even a losing side keeps a gentle idle sway — they're still fans.
        function crowdCheer(level, color, surge) {
          const amp    = 4 + level * 24;                       // bob height (px)
          const dur    = Math.max(0.32, 0.95 - level * 0.55);  // tempo (s) — hyped = faster
          const bright = 0.55 + level * 0.95 + (surge ? 0.5 : 0);
          const glow   = 5 + level * 30 + (surge ? 18 : 0);
          return {
            '--cheer-amp': `-${amp.toFixed(1)}px`,
            animation: `crowd-cheer ${surge ? '0.34' : dur.toFixed(2)}s ease-in-out infinite`,
            filter: `drop-shadow(0 0 ${glow.toFixed(0)}px ${color}) brightness(${bright.toFixed(2)})`,
            opacity: 0.45 + level * 0.55,
          };
        }
        const atkFans = crowdCheer(atkCheer, '#ff3ad0', atkSurge); // pink fanfare
        const defFans = crowdCheer(defCheer, '#34d6ff', defSurge); // blue fanfare

        // ── RETALIATION — DISABLED (pending redesign for Sonic/Thrash split) ──
        // Counter mechanic temporarily removed. The UI is kept but unreachable.
        if (false && (phase === 'retaliation_prompt' || phase === 'retaliation_spin'
            || phase === 'retaliation_settling' || phase === 'retaliation_result')) {
          const bs2        = battleState;
          const target     = bs2.counterTarget ?? bs2.atkRoll ?? 0;
          const vibeBonus  = bs2.vibeBonus ?? Math.round(((defender?.vibe ?? 1) / (defender?.maxVibe ?? 1)) * 3);
          const cFace      = bs2.counterFace ?? bs2.counterRoll ?? 1;
          const spinning   = phase === 'retaliation_spin';
          const settling   = phase === 'retaliation_settling';
          const showResult = phase === 'retaliation_result';
          const showTotal  = (bs2.counterReady || showResult);
          const cTotal     = showTotal ? (bs2.counterTotal ?? (cFace + vibeBonus)) : null;
          const success    = bs2.counterSuccess;
          const atkColor   = attacker?.color ?? '#ff4444';
          const defColor   = defender?.color ?? '#00ccff';
          // Crowd energy for the counter beat: defender's fans drive it, the
          // attacker's fans only roar back if the counter whiffs.
          const cAtk = crowdCheer(showResult ? (success ? 0.2 : 0.9) : 0.25, '#ff3ad0', showResult && !success);
          const cDef = crowdCheer(showResult ? (success ? 1 : 0.25) : 0.7,  '#34d6ff', showResult && success);
          // Defender is the aggressor now: glow scales up as they wind up / land.
          const defCounterGlow = spiritGlow(
            showResult ? (success ? (defStat ?? 6) + 5 : 3) : (defStat ?? 6) + 2,
            defColor, showResult && success);

          return (
            <div style={{position:'fixed', inset:0, background:'#000000f2', zIndex:9980,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              fontFamily:"'Orbitron',sans-serif", overflow:'hidden'}}>
              <style>{`
                @keyframes crowd-cheer { 0%,100%{transform:translateY(0) scaleY(1);} 50%{transform:translateY(var(--cheer-amp,-6px)) scaleY(1.05);} }
                @keyframes counter-click-bounce { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-5px);} }
                @keyframes counter-title-pulse { 0%,100%{text-shadow:0 0 20px #ffcc44, 0 0 50px #ff880055;} 50%{text-shadow:0 0 34px #ffee88, 0 0 80px #ffaa44aa;} }
                @keyframes counter-pop { 0%{opacity:0;transform:scale(0.5);} 55%{opacity:1;transform:scale(1.12);} 100%{opacity:1;transform:scale(1);} }
                @keyframes counter-spirit-l { from{transform:translateX(-45%);opacity:0;} to{transform:translateX(0);opacity:1;} }
                @keyframes counter-spirit-r { from{transform:translateX(45%) scaleX(-1);opacity:0;} to{transform:translateX(0) scaleX(-1);opacity:1;} }
              `}</style>

              {/* Fan-fare — pink (attacker) left, blue (defender) right */}
              <div style={{position:'absolute', left:0, right:0, bottom:0, height:'32%',
                           zIndex:1, pointerEvents:'none', overflow:'hidden'}}>
                <div style={{position:'absolute', left:'-3%', bottom:'-2%', width:'52%', maxWidth:680}}>
                  <img src={crowdPinkImg} alt="" draggable={false}
                    style={{width:'100%', display:'block', mixBlendMode:'screen', transformOrigin:'bottom center', ...cAtk}}/>
                </div>
                <div style={{position:'absolute', right:'-3%', bottom:'-2%', width:'52%', maxWidth:680}}>
                  <img src={crowdBlueImg} alt="" draggable={false}
                    style={{width:'100%', display:'block', mixBlendMode:'screen', transformOrigin:'bottom center', ...cDef}}/>
                </div>
              </div>

              {/* Title */}
              <div style={{position:'relative', zIndex:3, textAlign:'center', marginBottom:4}}>
                <div style={{fontSize:11, color:'#7a6a3a', letterSpacing:6, marginBottom:4}}>BATTLE · PART 2</div>
                <div style={{fontSize:30, fontWeight:900, letterSpacing:6, color:'#ffd34d',
                  animation:'counter-title-pulse 1.6s ease-in-out infinite'}}>🥊 RETALIATION</div>
              </div>

              {/* Spirits + center stage */}
              <div style={{position:'relative', zIndex:3, display:'flex', alignItems:'flex-end',
                           justifyContent:'center', gap:20, marginTop:6}}>

                {/* Attacker — now bracing for the counter */}
                <div style={{width:168, height:270, position:'relative', flexShrink:0,
                             animation:'counter-spirit-l 0.5s cubic-bezier(.22,1,.36,1) both'}}>
                  <img src={attacker?.imageSrc} alt={attacker?.name}
                    style={{height:'100%', width:'auto', objectFit:'contain', objectPosition:'bottom center', display:'block',
                      opacity: showResult && success ? 0.55 : 0.85,
                      filter:`drop-shadow(0 0 ${showResult && success ? 8 : 16}px ${atkColor}${showResult && success ? '55' : 'aa'})`,
                      transition:'opacity .4s, filter .4s'}}/>
                  <div style={{position:'absolute', top:4, left:'50%', transform:'translateX(-50%)',
                    fontSize:9, color:atkColor, letterSpacing:2, whiteSpace:'nowrap'}}>
                    {showResult && success ? 'TAKES IT' : 'BRACING'}
                  </div>
                </div>

                {/* Center: threshold + counter die / result */}
                <div style={{display:'flex', flexDirection:'column', alignItems:'center',
                             minWidth:300, paddingBottom:18}}>
                  <div style={{textAlign:'center', marginBottom:10}}>
                    <div style={{fontSize:9, color:'#6a8aaa', letterSpacing:3}}>OUT-SWING THE HIT</div>
                    <div style={{fontSize:32, fontWeight:900, color:atkColor, lineHeight:1.1,
                      textShadow:`0 0 18px ${atkColor}`}}>{target}</div>
                    <div style={{fontSize:8.5, color:'#3a5a7a', letterSpacing:1, marginTop:2}}>
                      {defender?.name}: d6 + Vibe ({vibeBonus}) — meet or beat it
                    </div>
                  </div>

                  {phase === 'retaliation_prompt' ? (
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:11, color:'#ffcc44', letterSpacing:2, marginBottom:10}}>🛡️ SWING BACK?</div>
                      <div style={{height:4, width:240, background:'#1a2a40', borderRadius:2, marginBottom:14, overflow:'hidden'}}>
                        <div style={{height:'100%', borderRadius:2, background:'#ffcc44',
                          width:`${((retaliationTimer ?? 0) / 3) * 100}%`, transition:'width 1s linear'}}/>
                      </div>
                      <div style={{display:'flex', gap:12, justifyContent:'center'}}>
                        <button onClick={() => resolveRetaliation(true)}
                          style={{fontFamily:'inherit', fontSize:11, padding:'11px 22px', background:'#1a1400',
                            border:'2px solid #ffcc44', borderRadius:7, color:'#ffcc44', cursor:'pointer',
                            fontWeight:700, boxShadow:'0 0 14px #ffcc4444'}}>
                          ⚡ COUNTER! ({retaliationTimer}s)
                        </button>
                        <button onClick={() => resolveRetaliation(false)}
                          style={{fontFamily:'inherit', fontSize:10, padding:'11px 16px', background:'#0a1020',
                            border:'1px solid #3a5070', borderRadius:7, color:'#6a8099', cursor:'pointer'}}>
                          Absorb {bs2.damage} dmg
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                      <div onClick={spinning ? handleCounterDieClick : undefined}
                        style={{cursor: spinning ? 'pointer' : 'default', userSelect:'none',
                          display:'flex', flexDirection:'column', alignItems:'center'}}>
                        <NeonDie value={cFace} spinning={spinning || settling} color={defColor} size={120} sides={6}/>
                        {spinning && (
                          <div style={{marginTop:6, fontSize:10, color:defColor, letterSpacing:3,
                            animation:'counter-click-bounce 0.6s ease-in-out infinite'}}>CLICK TO COUNTER</div>
                        )}
                        {cTotal !== null && (
                          <div style={{marginTop:6, fontSize:11, color:'#ffcc44', letterSpacing:1}}>
                            {cFace} + {vibeBonus} = <b>{cTotal}</b>
                          </div>
                        )}
                      </div>
                      {showResult && (
                        <div key="cres" style={{marginTop:12, textAlign:'center',
                          animation:'counter-pop 0.5s cubic-bezier(.22,1,.36,1) both'}}>
                          <div style={{fontSize:25, fontWeight:900, letterSpacing:3,
                            color: success ? '#44ff99' : '#ff4455',
                            textShadow:`0 0 22px ${success ? '#44ff99' : '#ff4455'}`}}>
                            {success ? '💥 COUNTER LANDS!' : '💔 COUNTER FAILS!'}
                          </div>
                          <div style={{fontSize:10, color:'#9ab', marginTop:6, lineHeight:1.6}}>
                            {success
                              ? <>{defender?.name} swings back for <span style={{color:'#ff6677'}}>{bs2.counterDmg} Vibe</span> + knockback · <span style={{color:'#ffd700'}}>⭐ Fame</span></>
                              : <>caught swinging — <span style={{color:'#ff6677'}}>{bs2.counterDmg} Vibe</span>, worse than absorbing</>}
                          </div>
                          <button onClick={() => { setBattleState(null); setDiceDisplay(null); }}
                            style={{marginTop:14, fontFamily:'inherit', fontSize:11, padding:'10px 24px',
                              background:'#1a1400', border:`2px solid ${success ? '#44ff99' : '#ff4455'}`,
                              borderRadius:7, color: success ? '#44ff99' : '#ff4455', cursor:'pointer', fontWeight:700}}>
                            🤘 ROCK ON →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Defender — the one throwing the counter */}
                <div style={{width:168, height:270, position:'relative', flexShrink:0,
                             animation:'counter-spirit-r 0.5s cubic-bezier(.22,1,.36,1) both'}}>
                  <img src={defender?.imageSrc} alt={defender?.name}
                    style={{height:'100%', width:'auto', objectFit:'contain', objectPosition:'bottom center', display:'block',
                      transform:'scaleX(-1)', ...defCounterGlow, transition:'filter .4s'}}/>
                  <div style={{position:'absolute', top:4, left:'50%', transform:'translateX(-50%)',
                    fontSize:9, color:defColor, letterSpacing:2, whiteSpace:'nowrap'}}>
                    {showResult ? (success ? 'COUNTER!' : 'WHIFFED') : spinning ? 'YOUR ROLL' : 'WINDING UP'}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // ── CONDITION-SPRITE HOOKS ──────────────────────────────────────────
        // Drop custom art in later by adding a `sprites` map to a SPIRIT_DEF,
        // e.g. sprites:{ attack, hit, block, charge }. Falls back to imageSrc.
        const atkImg = (phase === 'result' && !sonicAttack && attacker?.sprites?.attack)
          ? attacker.sprites.attack : attacker?.imageSrc;
        const defImg = (phase === 'result' && defender?.sprites
          ? defender.sprites[attackerWon ? 'hit' : 'block'] : null) ?? defender?.imageSrc;

        // ── CQC CRASH (melee result) ────────────────────────────────────────
        // Lunge force scales with how decisively the attacker won (margin).
        const crashTier = !attackerWon ? 'whiff' : margin >= 6 ? 'heavy' : margin >= 3 ? 'medium' : 'light';
        const isCrash = phase === 'result' && !sonicAttack;
        const crashDur = crashTier === 'heavy' ? '0.6s' : crashTier === 'medium' ? '0.7s' : '0.8s';
        const atkCrashAnim = isCrash
          ? (attackerWon
              ? `battle-crash-${crashTier} ${crashDur} cubic-bezier(0.3,0,0.2,1) both`
              : 'battle-crash-whiff 0.9s cubic-bezier(0.3,0,0.4,1) both')
          : null;
        const defRecoilAnim = isCrash && attackerWon
          ? `battle-recoil-${crashTier} 0.7s cubic-bezier(0.3,0,0.2,1) both`
          : null;
        const rowShakeAnim = isCrash && attackerWon
          ? `battle-row-shake-${crashTier === 'heavy' ? 'hard' : 'soft'} 0.6s ease-out`
          : null;

        // ── SONIC BEAM (ranged) ─────────────────────────────────────────────
        // Charges through the dice spin, then surges to full power once the
        // total is locked. Thickness/length scale with power; connects on a
        // win, sputters on a whiff.
        const beamPhase = !sonicAttack ? null
          : phase === 'result' ? (attackerWon ? 'blast' : 'fizzle')
          : ['atk_die_spin','atk_die_settling','pick_atk_slide','def_die_spin',
             'def_die_settling','pick_def_slide'].includes(phase) ? 'charge'
          : null;
        const beamPower   = beamPhase === 'blast' ? (atkTotal ?? atkStat ?? 6) : (atkStat ?? 6);
        // ☀️ SUNBEAM — Intergalactic 0's capstone fires a fatter, golden, extra-lit beam.
        const sunLit      = !!battleState.sunbeam;
        const beamH       = (beamPhase === 'charge' ? 8 : Math.min(96, Math.round(10 + beamPower * 3.2))) * (sunLit ? 1.6 : 1); // px
        const beamColor   = sunLit ? '#ffcc44' : (attacker?.color ?? '#aa66ff');

        // ── MOVE-NAME NEON CALLOUT (CQC only, fires at result) ──────────────
        let moveFlash = null;
        if (phase === 'result' && !sonicAttack) {
          if (!attackerWon) {
            moveFlash = { text:'whiff…', color:'#6688aa', whiff:true };
          } else {
            const landed = battleState.swingEffectRoll?.effects ?? [];
            if (landed.length > 0) {
              moveFlash = {
                text: (battleState.swingEffectRoll?.upgradeName ?? 'Swing').toUpperCase(),
                color: SWING_FX_INFO[landed[0]]?.color ?? '#ff44aa',
              };
            } else {
              moveFlash = { text: battleState.danceName ?? 'SWING', color:'#44ddff' };
            }
          }
        }

        // ── 🎆 STAGE EFFECTS + 🎸 GEAR (battle-overlay visuals) ───────────────
        // skillMods were rolled at battle start; when a flag is set the effect
        // "fired" this battle, so we play it for the overlay's duration. Stage FX
        // sit BEHIND the performers (zIndex < 3) so they light the stage, like a
        // real show. Gear props are owned-skill readouts tucked by the attacker.
        const sfx = battleState.skillMods ?? {};
        const fxLaser = !!sfx.laserActive;
        const fxLight = !!sfx.stageLightActive;
        const fxFog   = !!sfx.fogActive;
        const fxPyro  = (sfx.pyroBonus ?? 0) > 0;
        const atkGear = (noteStates[battleState.attackerId]?.unlockedSkills) ?? [];
        const hasMicGear   = atkGear.includes('mic');
        const hasPedalGear = atkGear.includes('pedal_dist');
        const hasMixerGear = atkGear.includes('mixer');
        const hasAnyGear   = hasMicGear || hasPedalGear || hasMixerGear;

        return (
          <div style={{
            position:'fixed', inset:0, background:'#000000f2', zIndex:9980,
            display:'flex', flexDirection:'column', alignItems:'center',
            // 'safe center' keeps content centered but never clips the top/bottom;
            // overflowY lets the result banner scroll into view on short screens
            justifyContent:'safe center', overflowY:'auto', overflowX:'hidden',
            padding:'24px 0',
            fontFamily:"'Orbitron',sans-serif",
          }}>
            {/* ⏭ Skip the pre-die intro straight to the dice roll */}
            {skipBattleIntro && ['enter_attacker','flash_drive','pick_drive_slide','enter_defender','flash_sustain','pick_sustain_slide'].includes(phase) && (
              <button onClick={skipBattleIntro}
                style={{position:'absolute', top:14, right:16, zIndex:20, cursor:'pointer',
                  fontFamily:"'Orbitron',sans-serif", fontSize:10, letterSpacing:1,
                  padding:'6px 14px', borderRadius:6, color:'#ccff44',
                  background:'#0a1020', border:'1px solid #aacc00', boxShadow:'0 0 10px #aacc0044'}}>
                ⏭ SKIP TO ROLL
              </button>
            )}
            <style>{`
              @keyframes battle-spirit-left {
                from { transform:translateX(-130%); opacity:0; }
                to   { transform:translateX(0);    opacity:1; }
              }
              @keyframes battle-spirit-right {
                from { transform:translateX(130%);  opacity:0; }
                to   { transform:translateX(0);    opacity:1; }
              }
              @keyframes battle-stat-flash {
                0%   { opacity:0; transform:translate(-50%,-50%) scale(0.3); }
                45%  { opacity:1; transform:translate(-50%,-50%) scale(1.18); }
                70%  { opacity:1; transform:translate(-50%,-50%) scale(1.0); }
                100% { opacity:1; transform:translate(-50%,-50%) scale(1.0); }
              }
              @keyframes battle-result-slam {
                0%   { opacity:0; transform:translateY(40px) scale(0.6); }
                55%  { opacity:1; transform:translateY(-6px) scale(1.06); }
                100% { opacity:1; transform:translateY(0)   scale(1.0); }
              }
              @keyframes battle-pick-glow {
                0%,100% { filter:drop-shadow(0 0 8px #ff44ff) drop-shadow(0 0 4px #ffffff88); }
                50%     { filter:drop-shadow(0 0 20px #ff88ff) drop-shadow(0 0 8px #ffffff); }
              }
              @keyframes battle-die-pulse {
                0%,100% { opacity:1; }
                50%     { opacity:0.7; }
              }
              @keyframes battle-click-bounce {
                0%,100% { transform:translateY(0); }
                50%     { transform:translateY(-4px); }
              }
              @keyframes battle-overlay-fade-out {
                0%   { opacity:1; }
                100% { opacity:0; }
              }
              /* ── Fan-fare crowd bob (amplitude driven by var(--cheer-amp)) ── */
              @keyframes crowd-cheer {
                0%,100% { transform:translateY(0)                       scaleY(1);    }
                50%     { transform:translateY(var(--cheer-amp,-6px))   scaleY(1.05); }
              }
              /* ── Stat-strength glow tiers (var(--gc) = spirit colour) ── */
              @keyframes hydra-loom {
                0%,100% { transform:translateY(0) scale(1);     opacity:0.42; }
                50%     { transform:translateY(-8px) scale(1.03); opacity:0.6; }
              }
              @keyframes battle-glow-pulse {
                0%,100% { filter:drop-shadow(0 0 22px var(--gc)) drop-shadow(0 0 8px var(--gc)); }
                50%     { filter:drop-shadow(0 0 40px var(--gc)) drop-shadow(0 0 16px #ffffff); }
              }
              @keyframes battle-glow-pulse-fast {
                0%,100% { filter:drop-shadow(0 0 34px var(--gc)) drop-shadow(0 0 12px var(--gc)); }
                50%     { filter:drop-shadow(0 0 60px var(--gc)) drop-shadow(0 0 24px #ffffff) brightness(1.15); }
              }
              @keyframes battle-glow-storm {
                0%   { filter:drop-shadow(0 0 30px var(--gc)) drop-shadow(0 0 6px #ffffff); }
                18%  { filter:drop-shadow(0 0 64px var(--gc)) drop-shadow(0 0 20px #ffffff) brightness(1.4); }
                32%  { filter:drop-shadow(0 0 18px var(--gc)) drop-shadow(0 0 4px var(--gc)); }
                55%  { filter:drop-shadow(0 0 70px #ffffff) drop-shadow(0 0 26px var(--gc)) brightness(1.6); }
                70%  { filter:drop-shadow(0 0 24px var(--gc)) drop-shadow(0 0 6px var(--gc)); }
                100% { filter:drop-shadow(0 0 30px var(--gc)) drop-shadow(0 0 6px #ffffff); }
              }
              @keyframes battle-glow-burst {
                0%   { filter:drop-shadow(0 0 20px var(--gc)) drop-shadow(0 0 6px var(--gc)); }
                40%  { filter:drop-shadow(0 0 70px #ffffff) drop-shadow(0 0 30px var(--gc)) brightness(1.5); }
                100% { filter:drop-shadow(0 0 34px var(--gc)) drop-shadow(0 0 12px var(--gc)); }
              }
              /* ── Move-name neon callout (CQC) ── */
              @keyframes battle-move-flash {
                0%   { opacity:0; transform:translate(-50%,-50%) scale(0.4) rotate(-6deg); }
                18%  { opacity:1; transform:translate(-50%,-50%) scale(1.22) rotate(2deg); }
                34%  { opacity:1; transform:translate(-50%,-50%) scale(1.0) rotate(0deg); }
                78%  { opacity:1; transform:translate(-50%,-50%) scale(1.0) rotate(0deg); }
                100% { opacity:0; transform:translate(-50%,-50%) scale(1.1) rotate(0deg); }
              }
              @keyframes battle-move-whiff {
                0%   { opacity:0; transform:translate(-50%,-50%) scale(1.0) rotate(0deg); }
                25%  { opacity:1; transform:translate(-50%,-46%) scale(1.0) rotate(0deg); }
                55%  { opacity:0.9; transform:translate(-50%,-30%) scale(0.92) rotate(-3deg); }
                100% { opacity:0; transform:translate(-50%,4%) scale(0.8) rotate(-8deg); }
              }
              /* ── CQC crash: attacker lunge (right) + defender recoil ── */
              /* ── CQC crash: attacker lunges a short distance INTO the adjacent defender ──
                 Thrash stage has Spirits close together — just a quick, punchy lunge. */
              @keyframes battle-crash-light  { 0%{transform:translateX(0)} 46%{transform:translateX(60px)} 62%{transform:translateX(30px)} 100%{transform:translateX(0)} }
              @keyframes battle-crash-medium { 0%{transform:translateX(0)} 42%{transform:translateX(100px)} 58%{transform:translateX(70px)} 100%{transform:translateX(0)} }
              @keyframes battle-crash-heavy  { 0%{transform:translateX(0)} 36%{transform:translateX(130px)} 52%{transform:translateX(85px)} 100%{transform:translateX(0)} }
              @keyframes battle-crash-whiff  { 0%{transform:translateX(0) rotate(0)} 40%{transform:translateX(110px) rotate(6deg)} 58%{transform:translateX(150px) rotate(13deg)} 100%{transform:translateX(0) rotate(0)} }
              /* ── Defender knockback on impact (+X = driven back right) ── */
              @keyframes battle-recoil-light  { 0%{transform:translateX(0)} 48%{transform:translateX(0)} 58%{transform:translateX(80px)} 76%{transform:translateX(40px)} 100%{transform:translateX(0)} }
              @keyframes battle-recoil-medium { 0%{transform:translateX(0)} 44%{transform:translateX(0)} 56%{transform:translateX(140px)} 74%{transform:translateX(70px)} 100%{transform:translateX(0)} }
              @keyframes battle-recoil-heavy  { 0%{transform:translateX(0) rotate(0)} 40%{transform:translateX(0)} 52%{transform:translateX(200px) rotate(7deg)} 70%{transform:translateX(110px) rotate(3deg)} 100%{transform:translateX(0) rotate(0)} }
              @keyframes battle-row-shake-soft { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-3px,2px)} 40%{transform:translate(3px,-2px)} 60%{transform:translate(-2px,1px)} 80%{transform:translate(2px,-1px)} }
              @keyframes battle-row-shake-hard { 0%,100%{transform:translate(0,0)} 15%{transform:translate(-9px,5px)} 30%{transform:translate(8px,-6px)} 45%{transform:translate(-7px,4px)} 60%{transform:translate(6px,-3px)} 75%{transform:translate(-4px,2px)} 90%{transform:translate(3px,-1px)} }
              /* ── Sonic beam ── */
              @keyframes battle-beam-charge { 0%,100%{opacity:0.45} 50%{opacity:0.8} }
              @keyframes battle-beam-blast  { 0%{opacity:0; transform:translateY(-50%) scaleX(0.1)} 30%{opacity:1; transform:translateY(-50%) scaleX(1.05)} 100%{opacity:1; transform:translateY(-50%) scaleX(1)} }
              @keyframes battle-beam-crackle { 0%,100%{filter:brightness(1)} 25%{filter:brightness(1.5)} 50%{filter:brightness(0.85)} 75%{filter:brightness(1.7)} }
              @keyframes battle-beam-fizzle { 0%{opacity:0.7; transform:translateY(-50%) scaleX(0.6)} 100%{opacity:0; transform:translateY(-30%) scaleX(0.3) rotate(-4deg)} }
              @keyframes battle-impact { 0%{opacity:0; transform:translate(-50%,-50%) scale(0.2)} 25%{opacity:1; transform:translate(-50%,-50%) scale(1.0)} 100%{opacity:0; transform:translate(-50%,-50%) scale(1.6)} }
              @keyframes battle-muzzle { 0%,100%{opacity:0.6; transform:translate(-50%,-50%) scale(0.9)} 50%{opacity:1; transform:translate(-50%,-50%) scale(1.15)} }
              /* ── 🎆 STAGE EFFECTS ── */
              @keyframes sfx-laser-sweep { 0%{transform:rotate(var(--a)) translateX(-5%)} 50%{transform:rotate(calc(var(--a) + 13deg)) translateX(5%)} 100%{transform:rotate(var(--a)) translateX(-5%)} }
              @keyframes sfx-laser-flicker { 0%,100%{opacity:0.6} 45%{opacity:0.95} 60%{opacity:0.4} }
              @keyframes sfx-light-sweep { 0%{transform:rotate(-9deg)} 50%{transform:rotate(9deg)} 100%{transform:rotate(-9deg)} }
              @keyframes sfx-fog-drift { 0%{transform:translateX(-12%) translateY(4%); opacity:0} 22%{opacity:0.55} 78%{opacity:0.55} 100%{transform:translateX(12%) translateY(-4%); opacity:0} }
              @keyframes sfx-pyro-flare { 0%,100%{transform:translateX(-50%) scaleY(0.8) scaleX(0.92); opacity:0.7} 35%{transform:translateX(-50%) scaleY(1.18) scaleX(1.05); opacity:1} 65%{transform:translateX(-50%) scaleY(0.95) scaleX(0.97); opacity:0.85} }
              @keyframes sfx-spark-rise { 0%{transform:translateY(0) scale(1); opacity:1} 100%{transform:translateY(-200px) scale(0.3); opacity:0} }
              /* ── 🎸 GEAR PROPS ── */
              @keyframes gear-mic-bob { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-4px) rotate(3deg)} }
              @keyframes gear-pedal-stomp { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.8)} }
              @keyframes gear-mixer-shimmer { 0%,100%{filter:drop-shadow(0 0 3px #44ffaa)} 50%{filter:drop-shadow(0 0 9px #44ffaa)} }
              /* ── 🎵 NOTE SCATTER — notes fly off defender on Thrash hit (Sonic-loses-rings style) ── */
              @keyframes note-scatter {
                0%   { opacity:1; transform:translate(0,0) rotate(0deg) scale(1); }
                20%  { opacity:1; }
                70%  { opacity:0.7; }
                100% { opacity:0; transform:translate(var(--ns-dx), var(--ns-dy)) rotate(var(--ns-rot)) scale(0.5); }
              }
              @keyframes note-scatter-bounce {
                0%   { opacity:1; transform:translate(0,0) scale(1.2); }
                40%  { transform:translate(calc(var(--ns-dx)*0.6), calc(var(--ns-dy)*0.6)) scale(0.9); }
                60%  { transform:translate(calc(var(--ns-dx)*0.7), calc(var(--ns-dy)*0.5 - 30px)) scale(1.0); }
                100% { opacity:0; transform:translate(var(--ns-dx), var(--ns-dy)) scale(0.4); }
              }
            `}</style>

            {/* ── 🎆 STAGE EFFECTS — fire behind the performers when rolled ── */}
            {fxLight && (
              <div style={{position:'absolute', inset:0, zIndex:1, pointerEvents:'none', overflow:'hidden'}}>
                {[{x:'28%', c:'#ffcc66'}, {x:'50%', c:'#88ccff'}, {x:'72%', c:'#ff88cc'}].map((s,i)=>(
                  <div key={i} style={{
                    position:'absolute', top:'-10%', left:s.x, width:'30%', height:'125%',
                    transformOrigin:'top center',
                    clipPath:'polygon(47% 0, 53% 0, 100% 100%, 0 100%)',
                    backgroundImage:`linear-gradient(180deg, ${s.c}66, ${s.c}10 65%, transparent)`,
                    filter:'blur(2px)', mixBlendMode:'screen',
                    animation:`sfx-light-sweep ${3 + i*0.7}s ease-in-out ${i*0.4}s infinite`,
                  }}/>
                ))}
              </div>
            )}
            {fxLaser && (
              <div style={{position:'absolute', inset:0, zIndex:2, pointerEvents:'none', overflow:'hidden'}}>
                {[
                  {x:'12%', a:'18deg',  c:'#ff2244'},
                  {x:'31%', a:'-11deg', c:'#ff22aa'},
                  {x:'49%', a:'8deg',   c:'#22ddff'},
                  {x:'66%', a:'-16deg', c:'#44ff88'},
                  {x:'83%', a:'12deg',  c:'#ffdd22'},
                ].map((b,i)=>(
                  <div key={i} style={{
                    position:'absolute', top:'-25%', left:b.x, width:4, height:'150%',
                    '--a':b.a, transformOrigin:'top center',
                    background:`linear-gradient(${b.c}00, ${b.c} 42%, ${b.c}cc 72%, ${b.c}00)`,
                    boxShadow:`0 0 12px ${b.c}, 0 0 30px ${b.c}aa`,
                    mixBlendMode:'screen',
                    animation:`sfx-laser-sweep ${2.4 + i*0.3}s ease-in-out infinite, sfx-laser-flicker ${0.5 + i*0.13}s linear infinite`,
                  }}/>
                ))}
              </div>
            )}
            {fxFog && (
              <div style={{position:'absolute', left:0, right:0, bottom:0, height:'48%', zIndex:2, pointerEvents:'none', overflow:'hidden'}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{
                    position:'absolute', bottom:`${-6 + i*7}%`, left:'-10%', width:'120%', height:'72%',
                    background:`radial-gradient(ellipse 60% 70% at ${28 + i*22}% 100%, #cdd8ee${i===1?'5e':'44'}, transparent 70%)`,
                    filter:'blur(15px)',
                    animation:`sfx-fog-drift ${7 + i*2}s ease-in-out ${i*1.3}s infinite`,
                  }}/>
                ))}
              </div>
            )}
            {fxPyro && (
              <div style={{position:'absolute', inset:0, zIndex:2, pointerEvents:'none', overflow:'hidden'}}>
                {[{x:'14%'},{x:'50%'},{x:'86%'}].map((p,i)=>(
                  <div key={i} style={{
                    position:'absolute', bottom:'8%', left:p.x, transform:'translateX(-50%)',
                    width:48, height:180, transformOrigin:'bottom center',
                    background:'linear-gradient(0deg, #ffee66 0%, #ff8822 45%, #ff3311 76%, transparent 100%)',
                    borderRadius:'50% 50% 42% 42% / 70% 70% 30% 30%',
                    filter:'blur(3px)', mixBlendMode:'screen',
                    animation:`sfx-pyro-flare ${0.5 + i*0.12}s ease-in-out infinite`,
                  }}/>
                ))}
                {Array.from({length:12}).map((_,i)=>(
                  <div key={'sp'+i} style={{
                    position:'absolute', bottom:'12%', left:`${8 + (i*7)%84}%`,
                    width:4, height:4, borderRadius:'50%',
                    background:'#ffdd66', boxShadow:'0 0 6px #ffaa33',
                    animation:`sfx-spark-rise ${1 + (i%5)*0.3}s ease-out ${(i%7)*0.25}s infinite`,
                  }}/>
                ))}
              </div>
            )}

            {/* ── FAN-FARE / CROWD ── audience at the foot of the stage.
                Pink fans rally behind the attacker (left), blue behind the
                defender (right). They bob harder the further the battle pick
                slides onto their half (atkCheer / defCheer) and pop on each
                confirmed number. The PNGs are neon-on-black, so screen blend
                drops the black background and leaves only the glowing fans.
                The container spans the full overlay height so the fan-fare
                images can extend upward over the battle content (no clipping). */}
            <div style={{position:'absolute', left:0, right:0, bottom:0, top:0,
                         zIndex:10, pointerEvents:'none'}}>
              {/* pink fanfare — attacker, fades in with their Spirit */}
              <div style={{position:'absolute', left:'-3%', bottom:'-2%',
                           width:'54%', maxWidth:720,
                           opacity: atkIn ? 1 : 0, transition:'opacity 0.7s ease'}}>
                <img src={crowdPinkImg} alt="" draggable={false}
                  style={{width:'100%', display:'block', mixBlendMode:'screen',
                          transformOrigin:'bottom center', ...atkFans}}/>
              </div>
              {/* blue fanfare — defender, fades in with their Spirit */}
              <div style={{position:'absolute', right:'-3%', bottom:'-2%',
                           width:'54%', maxWidth:720,
                           opacity: defIn ? 1 : 0, transition:'opacity 0.7s ease'}}>
                <img src={crowdBlueImg} alt="" draggable={false}
                  style={{width:'100%', display:'block', mixBlendMode:'screen',
                          transformOrigin:'bottom center', ...defFans}}/>
              </div>
            </div>

            {/* ── CROPPED METER TRACK — shows only the number track strip ── */}
            {(() => {
              const CROP_TOP = 250;
              const CROP_H = 145;
              const trackInCrop = TRACK_Y - CROP_TOP;
              return (
                <div style={{
                  position:'relative', width:METER_W, maxWidth:'90vw', height:CROP_H,
                  overflow:'hidden', flexShrink:0, zIndex:6, borderRadius:8,
                  boxShadow:'0 0 40px #ff44ff22, 0 0 20px #00ccff11',
                }}>
                  {/* Black strips to hide the PNG's left/right border edges */}
                  <div style={{position:'absolute',left:0,top:0,bottom:0,width:'2.8%',background:'#000',zIndex:3}}/>
                  <div style={{position:'absolute',right:0,top:0,bottom:0,width:'2.8%',background:'#000',zIndex:3}}/>
                  {battleState.hydra && (
                    <img src={hydraImg} alt="" draggable={false}
                      style={{position:'absolute', left:'-14%', top:'-200%', width:'128%',
                        pointerEvents:'none', mixBlendMode:'screen', opacity:0.5,
                        filter:'drop-shadow(0 0 26px #aa55ff66)', zIndex:1,
                        animation:'hydra-loom 2.4s ease-in-out infinite'}}/>
                  )}
                  <img src={battleMeterImg} alt="Battle Meter Track"
                    style={{position:'absolute', top:-CROP_TOP, left:0, width:'100%',
                            pointerEvents:'none', zIndex:2}}/>
                  <div style={{
                    position:'absolute',
                    left:`${(pickX / METER_W) * 100}%`,
                    top:`${((trackInCrop - 30) / CROP_H) * 100}%`,
                    transform:'translateX(-50%)',
                    width:`${(60 / METER_W) * 100}%`,
                    transition: pickTransition,
                    pointerEvents:'none', zIndex:5,
                    animation:'battle-pick-glow 1.4s ease-in-out infinite',
                  }}>
                    <img src={battlePickImg} alt="pick" style={{width:'100%', display:'block'}}/>
                  </div>
                </div>
              );
            })()}

            {/* ── BATTLE STAGE — hex floor arena with amp cabinet dice on sides ── */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'center',
                         width:'100%', maxWidth:1200, gap:0, marginTop:8,
                         position:'relative',
                         animation: rowShakeAnim ?? 'none'}}>

              {/* ── AMP CABINET · LEFT (Attacker Die) ── */}
              <div style={{
                width:150, minHeight:220, flexShrink:0, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', position:'relative', zIndex:7,
                background:'linear-gradient(180deg, #0c0816, #0a0610)',
                border:`2px solid ${(attacker?.color ?? '#ff4444')}44`,
                borderRadius:10, padding:'12px 8px',
                boxShadow:`0 0 20px ${attacker?.color ?? '#ff4444'}22, inset 0 2px 20px #00000088`,
              }}>
                <div style={{
                  width:'85%', height:50, borderRadius:6, marginBottom:10,
                  border:`1px solid ${(attacker?.color ?? '#ff4444')}33`,
                  background:'repeating-linear-gradient(0deg, #0a0a14 0px, #0a0a14 3px, #12121e 3px, #12121e 6px)',
                  boxShadow:'inset 0 0 12px #000000aa',
                }}/>
                {showAtkDie ? (
                  <div
                    onClick={atkSpinning ? handleAtkDieClick : undefined}
                    style={{
                      cursor: atkSpinning ? 'pointer' : 'default', userSelect:'none',
                      display:'flex', flexDirection:'column',
                      alignItems:'center', justifyContent:'center',
                    }}>
                    {battleState.dicePool ? (
                      <div style={{display:'flex', gap:4, alignItems:'center', justifyContent:'center', flexWrap:'wrap'}}>
                        {battleState.dicePool.map((sides, i) => {
                          const v = atkSpinning
                            ? (battleState.diceSpin?.[i] ?? 1)
                            : (battleState.diceVals?.[i] ?? 1);
                          const kept = !atkSpinning && i === battleState.keptIdx;
                          return (
                            <div key={i} style={{
                              opacity: (atkSpinning || kept) ? 1 : 0.4,
                              transform: kept ? 'scale(1.12)' : 'none',
                              filter: kept ? `drop-shadow(0 0 7px ${attacker?.color ?? '#4488ff'})` : 'none',
                              transition:'all .2s'}}>
                              <NeonDie value={v} spinning={atkSpinning}
                                color={attacker?.color ?? '#4488ff'} size={48} sides={sides}/>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <NeonDie value={atkFace} spinning={atkSpinning} color={attacker?.color ?? '#ff4444'} size={80} sides={battleState.dieSides ?? 6}/>
                    )}
                    {atkSpinning && (
                      <div style={{
                        marginTop:4, fontSize:9, color: attacker?.color ?? '#ff4444',
                        letterSpacing:3, fontFamily:"'Orbitron',sans-serif",
                        animation:'battle-click-bounce 0.6s ease-in-out infinite',
                      }}>CLICK</div>
                    )}
                    {phase === 'result' && atkFace !== null && (
                      <div style={{marginTop:3, fontSize:8, color:'#ffcc44', letterSpacing:1,
                        fontFamily:"'Orbitron',sans-serif"}}>
                        +{atkFace} = {atkTotal}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{width:80, height:80, borderRadius:10,
                    border:`1px dashed ${(attacker?.color ?? '#ff4444')}33`,
                    background:'#06060e'}}/>
                )}
                <div style={{fontSize:8, color:attacker?.color ?? '#ff4444', letterSpacing:2, marginTop:6,
                  fontFamily:"'Orbitron',sans-serif", textTransform:'uppercase'}}>{attacker?.name?.split(' ')[0]}</div>
              </div>

              {/* ── STAGE FLOOR — isometric hex arena + Spirits ── */}
              <div style={{
                position:'relative', flex:1, maxWidth:700, minHeight:380,
                display:'flex', alignItems:'flex-end', justifyContent:'center',
                overflow:'visible',
              }}>

                {/* Isometric hex grid floor */}
                <div style={{
                  position:'absolute', bottom:'2%', left:'50%',
                  transform:'translateX(-50%) perspective(500px) rotateX(55deg)',
                  transformOrigin:'center bottom', zIndex:0, pointerEvents:'none', opacity:0.7,
                }}>
                  <svg width={620} height={340} viewBox="0 0 620 340" style={{display:'block'}}>
                    {Array.from({length:4}).flatMap((_r, row) =>
                      Array.from({length:6}).map((_c, col) => {
                        const sz = 52;
                        const colSp = sz * 2 * 0.75;
                        const rowH = sz * 1.732;
                        const cx = 52 + col * colSp;
                        const cy = 46 + row * rowH + (col % 2 ? rowH / 2 : 0);
                        const pts = Array.from({length:6}).map((_p, k) => {
                          const ang = (Math.PI / 180) * (60 * k);
                          return `${cx + sz * Math.cos(ang)},${cy + sz * Math.sin(ang)}`;
                        }).join(' ');
                        const dist = Math.abs(col - 2.5) + Math.abs(row - 1.5);
                        const br = Math.max(0.12, 0.45 - dist * 0.07);
                        return (
                          <polygon key={`${row}-${col}`} points={pts}
                            fill="none" stroke={`rgba(120, 80, 200, ${br})`}
                            strokeWidth={1.5}/>
                        );
                      })
                    )}
                  </svg>
                </div>

                {/* ── SONIC BEAM LAYER ── */}
                {beamPhase && (
                  <div style={{
                    position:'absolute', left:'30%', right:'12%',
                    top:'50%', height:beamH, transform:'translateY(-50%)',
                    zIndex:4, pointerEvents:'none', transformOrigin:'left center',
                    animation: beamPhase === 'blast'  ? 'battle-beam-blast 0.45s cubic-bezier(0.2,0,0.2,1) both'
                             : beamPhase === 'fizzle' ? 'battle-beam-fizzle 0.6s ease-in both'
                             : 'battle-beam-charge 0.4s ease-in-out infinite',
                  }}>
                    {attacker?.sprites?.beam ? (
                      <img src={attacker.sprites.beam} alt="" style={{width:'100%',height:'100%',objectFit:'fill'}}/>
                    ) : (
                      <div style={{
                        position:'absolute', inset:0, borderRadius:beamH,
                        background:`linear-gradient(90deg, ${beamColor}00 0%, ${beamColor}cc 12%, ${beamColor} 55%, #ffffff 100%)`,
                        boxShadow:`0 0 ${beamH}px ${beamColor}, 0 0 ${beamH*2.4}px ${beamColor}88`,
                        animation: beamPhase === 'blast' ? 'battle-beam-crackle 0.12s steps(2,end) infinite' : 'none',
                      }}>
                        <div style={{position:'absolute', left:'10%', right:0, top:'50%',
                          height:Math.max(2, beamH*0.28), transform:'translateY(-50%)',
                          background:'#ffffff', borderRadius:beamH, opacity:0.9,
                          boxShadow:'0 0 8px #ffffff'}}/>
                      </div>
                    )}
                    <div style={{position:'absolute', left:0, top:'50%',
                      width:beamH*1.8, height:beamH*1.8, borderRadius:'50%',
                      background:`radial-gradient(circle, #ffffff, ${beamColor}aa 40%, transparent 70%)`,
                      animation:'battle-muzzle 0.18s ease-in-out infinite'}}/>
                  </div>
                )}

                {/* ── IMPACT BURST ── */}
                {phase === 'result' && attackerWon && (
                  <div style={{
                    position:'absolute',
                    ...(sonicAttack
                      ? { right:'18%', top:'50%' }
                      : { left:'54%', top:'46%', transform:'translateX(-50%)' }),
                    width:sonicAttack ? 160 : (crashTier === 'heavy' ? 220 : crashTier === 'medium' ? 170 : 120),
                    height:sonicAttack ? 160 : (crashTier === 'heavy' ? 220 : crashTier === 'medium' ? 170 : 120),
                    zIndex:6, pointerEvents:'none',
                    background:`radial-gradient(circle, #ffffff 0%, ${(sonicAttack?beamColor:(attacker?.color))??'#ffaa44'}cc 35%, transparent 70%)`,
                    animation:'battle-impact 0.6s ease-out both',
                  }}/>
                )}

                {/* ── 🎵 NOTE SCATTER — notes fly off defender on Thrash hit ── */}
                {phase === 'result' && attackerWon && !sonicAttack && (() => {
                  const NOTE_GLYPHS = ['♪','♫','♩','♬','𝅘𝅥𝅮','𝅗𝅥','♯','♭'];
                  const noteCount = crashTier === 'heavy' ? 16 : crashTier === 'medium' ? 12 : 8;
                  const defC = defender?.color ?? '#00ccff';
                  return (
                    <div style={{position:'absolute', right:'22%', top:'38%', width:0, height:0,
                      zIndex:8, pointerEvents:'none'}}>
                      {Array.from({length:noteCount}).map((_,i) => {
                        // Deterministic scatter directions based on index
                        const angle = (i / noteCount) * 360 + (i * 37) % 60 - 30;
                        const dist = 80 + (i * 31) % 120;
                        const rad = angle * Math.PI / 180;
                        const dx = Math.round(Math.cos(rad) * dist);
                        const dy = Math.round(Math.sin(rad) * dist);
                        const rot = ((i * 47) % 360) - 180;
                        const delay = (i * 0.04).toFixed(2);
                        const dur = (0.8 + (i * 17) % 6 * 0.1).toFixed(2);
                        const glyph = NOTE_GLYPHS[i % NOTE_GLYPHS.length];
                        const usesBounce = i % 3 === 0;
                        return (
                          <div key={i} style={{
                            position:'absolute',
                            fontSize: 18 + (i * 7) % 14,
                            color: i % 4 === 0 ? '#ffffff' : i % 4 === 1 ? defC : i % 4 === 2 ? '#ffd700' : '#ff66aa',
                            textShadow: `0 0 8px ${defC}, 0 0 16px ${defC}88`,
                            '--ns-dx': `${dx}px`, '--ns-dy': `${dy}px`, '--ns-rot': `${rot}deg`,
                            animation: `${usesBounce ? 'note-scatter-bounce' : 'note-scatter'} ${dur}s cubic-bezier(0.2,0,0.3,1) ${delay}s both`,
                          }}>
                            {glyph}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ATTACKER SPIRIT */}
                <div style={{
                  width: sonicAttack ? 180 : 200, height:SPIRIT_H, flexShrink:0, position:'relative', overflow:'visible',
                  zIndex:5,
                  marginRight: sonicAttack ? 120 : 10,
                  animation: atkCrashAnim ? atkCrashAnim
                            : atkIn ? 'battle-spirit-left 1.1s cubic-bezier(0.22,1,0.36,1) both' : 'none',
                  opacity: atkIn ? 1 : 0,
                }}>
                  <img src={atkImg} alt={attacker?.name}
                    style={{
                      height:'100%', width:'auto', maxWidth:240,
                      objectFit:'contain', objectPosition:'bottom center', display:'block',
                      ...atkGlow,
                    }}/>
                  {hasAnyGear && (
                    <div style={{position:'absolute', bottom:'1%', left:'-4%', zIndex:11,
                      display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                      pointerEvents:'none'}}>
                      {hasMicGear && (
                        <div title="Mic" style={{fontSize:26, lineHeight:1,
                          filter:'drop-shadow(0 0 6px #ff66aa)',
                          animation:'gear-mic-bob 1.6s ease-in-out infinite'}}>🎤</div>
                      )}
                      {hasMixerGear && (
                        <div title="Mixer" style={{fontSize:22, lineHeight:1,
                          animation:'gear-mixer-shimmer 1.4s ease-in-out infinite'}}>🎚️</div>
                      )}
                      {hasPedalGear && (
                        <div title="Distortion Pedal" style={{fontSize:22, lineHeight:1,
                          transformOrigin:'bottom center', filter:'drop-shadow(0 0 5px #44ffaa)',
                          animation:'gear-pedal-stomp 0.9s ease-in-out infinite'}}>🎛️</div>
                      )}
                    </div>
                  )}
                  {showFlashDrive && (
                    <div style={{
                      position:'absolute', top:'22%', left:'50%',
                      animation:'battle-stat-flash 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
                      textAlign:'center', zIndex:10, pointerEvents:'none',
                      transform:'translate(-50%,-50%)',
                    }}>
                      <div style={{fontSize:88, fontWeight:900, lineHeight:1,
                        color:'#ff3322', textShadow:'0 0 30px #ff0000, 0 0 12px #ff6644', letterSpacing:2}}>
                        {atkStat}
                      </div>
                      {atkBonus > 0 && (
                        <div style={{fontSize:13, color:'#ffaa44', letterSpacing:2, marginTop:2}}>
                          ({atkBase} +{atkBonus})
                        </div>
                      )}
                      <div style={{fontSize:12, color:'#ff8844', letterSpacing:4, marginTop:4}}>DRIVE</div>
                    </div>
                  )}
                </div>

                {/* DEFENDER SPIRIT */}
                <div style={{
                  width: sonicAttack ? 180 : 200, height:SPIRIT_H, flexShrink:0, position:'relative', overflow:'visible',
                  zIndex:5,
                  marginLeft: sonicAttack ? 120 : 10,
                  animation: defRecoilAnim ? defRecoilAnim
                            : defIn ? 'battle-spirit-right 1.1s cubic-bezier(0.22,1,0.36,1) both' : 'none',
                  opacity: defIn ? 1 : 0,
                }}>
                  <img src={defImg} alt={defender?.name}
                    style={{
                      height:'100%', width:'auto', maxWidth:240,
                      objectFit:'contain', objectPosition:'bottom center', display:'block',
                      transform:'scaleX(-1)',
                      ...defGlow,
                    }}/>
                  {showFlashSustain && (
                    <div style={{
                      position:'absolute', top:'22%', left:'50%',
                      animation:'battle-stat-flash 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
                      textAlign:'center', zIndex:10, pointerEvents:'none',
                      transform:'translate(-50%,-50%)',
                    }}>
                      <div style={{fontSize:88, fontWeight:900, lineHeight:1,
                        color:'#00ccff', textShadow:'0 0 30px #0088ff, 0 0 12px #88ccff', letterSpacing:2}}>
                        {defStat}
                      </div>
                      {defBonus > 0 && (
                        <div style={{fontSize:13, color:'#88ccff', letterSpacing:2, marginTop:2}}>
                          ({defBase} +{defBonus})
                        </div>
                      )}
                      <div style={{fontSize:12, color:'#88ccff', letterSpacing:4, marginTop:4}}>FEEDBACK</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── AMP CABINET · RIGHT (Defender Die) ── */}
              <div style={{
                width:150, minHeight:220, flexShrink:0, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', position:'relative', zIndex:7,
                background:'linear-gradient(180deg, #0c0816, #0a0610)',
                border:`2px solid ${(defender?.color ?? '#00ccff')}44`,
                borderRadius:10, padding:'12px 8px',
                boxShadow:`0 0 20px ${defender?.color ?? '#00ccff'}22, inset 0 2px 20px #00000088`,
              }}>
                <div style={{
                  width:'85%', height:50, borderRadius:6, marginBottom:10,
                  border:`1px solid ${(defender?.color ?? '#00ccff')}33`,
                  background:'repeating-linear-gradient(0deg, #0a0a14 0px, #0a0a14 3px, #12121e 3px, #12121e 6px)',
                  boxShadow:'inset 0 0 12px #000000aa',
                }}/>
                {showDefDie ? (
                  <div
                    onClick={defSpinning ? handleDefDieClick : undefined}
                    style={{
                      cursor: defSpinning ? 'pointer' : 'default', userSelect:'none',
                      display:'flex', flexDirection:'column',
                      alignItems:'center', justifyContent:'center',
                    }}>
                    <NeonDie value={defFace} spinning={defSpinning} color={defender?.color ?? '#00ccff'} size={80}/>
                    {defSpinning && (
                      <div style={{
                        marginTop:4, fontSize:9, color: defender?.color ?? '#00ccff',
                        letterSpacing:3, fontFamily:"'Orbitron',sans-serif",
                        animation:'battle-click-bounce 0.6s ease-in-out infinite',
                      }}>CLICK</div>
                    )}
                    {phase === 'result' && defFace !== null && (
                      <div style={{marginTop:3, fontSize:8, color:'#ffcc44', letterSpacing:1,
                        fontFamily:"'Orbitron',sans-serif"}}>
                        {battleState?.posing ? '🌟 POSING = 0' : `+${defFace} = ${defTotal}`}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{width:80, height:80, borderRadius:10,
                    border:`1px dashed ${(defender?.color ?? '#00ccff')}33`,
                    background:'#06060e'}}/>
                )}
                <div style={{fontSize:8, color:defender?.color ?? '#00ccff', letterSpacing:2, marginTop:6,
                  fontFamily:"'Orbitron',sans-serif", textTransform:'uppercase'}}>{defender?.name?.split(' ')[0]}</div>
              </div>
            </div>

            {/* ── MOVE-NAME NEON CALLOUT (CQC result) ── */}
            {moveFlash && (
              <div key={`move-${phase}-${moveFlash.text}`} style={{
                position:'absolute', top:'34%', left:'50%', zIndex:9,
                transform:'translate(-50%,-50%)', pointerEvents:'none', textAlign:'center',
                animation: moveFlash.whiff
                  ? 'battle-move-whiff 1.3s ease-in forwards'
                  : 'battle-move-flash 1.6s cubic-bezier(0.22,1,0.36,1) forwards',
              }}>
                <div style={{
                  fontFamily:"'Orbitron',sans-serif", fontWeight:900,
                  fontSize: moveFlash.whiff ? 44 : 76,
                  letterSpacing: moveFlash.whiff ? 4 : 6,
                  color: moveFlash.whiff ? moveFlash.color : '#ffffff',
                  textShadow: moveFlash.whiff
                    ? `0 0 12px ${moveFlash.color}`
                    : `0 0 18px ${moveFlash.color}, 0 0 40px ${moveFlash.color}, 0 0 70px ${moveFlash.color}`,
                  WebkitTextStroke: moveFlash.whiff ? 'none' : `2px ${moveFlash.color}`,
                  fontStyle: moveFlash.whiff ? 'italic' : 'normal',
                }}>
                  {moveFlash.text}
                </div>
              </div>
            )}

            {/* ── Attack name banner ── */}
            {(() => {
              const nsA = noteStates[battleState.attackerId] ?? {};
              // Live CQC chain first (legacy swingUpgrades is never populated)
              const cqcSkills = nsA.unlockedSkills ?? [];
              const cqcTop = ['baki_gravity','moon_shuffle','cosmic_boogaloo','shank_skank']
                .find(id => cqcSkills.includes(id));
              const cqcDef = cqcTop ? SKILL_BY_ID[cqcTop] : null;
              const swingUpgrades = nsA.swingUpgrades ?? [];
              const highestTier = ['swing_3','swing_2','swing_1'].find(t => swingUpgrades.includes(t));
              const tierDef = highestTier ? SWING_UPGRADE_TIERS.find(t => t.id === highestTier) : null;
              const thrashDieLabel = `d${battleState.dieSides ?? 4}`;
              const attackLabel = battleState.sonicAttack
                ? `🔊 Sonic Attack (${battleState.diceLabel ?? 'd6'}, keep best)`
                : cqcDef ? `${cqcDef.icon} ${cqcDef.label} (${thrashDieLabel})`
                : tierDef ? `${tierDef.icon} ${tierDef.label} (${thrashDieLabel})` : `⚔️ Thrash (${thrashDieLabel})`;
              const mods = battleState.skillMods ?? {};
              const activeMods = [
                mods.laserActive      && { icon:'🔴', label:'Laser Show',     color:'#ff4444', desc:"Defender's die halved" },
                mods.stageLightActive && { icon:'💡', label:'Stage Lighting',  color:'#ffcc44', desc:'+1 Vibe on win' },
                mods.fogActive        && { icon:'🌫️', label:'Fog Machine',     color:'#aaccff', desc:'-1 Drive, -1 Sustain' },
                mods.pyroBonus > 0    && { icon:'🔥', label:'Pyrotechnics',    color:'#ff8844', desc:`+${mods.pyroBonus} Drive` },
                (battleState.pedalBonus > 0) && { icon:'🎛️', label:'Pedal Dist', color:'#44ffaa', desc:`+${battleState.pedalBonus} Drive` },
                (battleState.powerBonus > 0) && { icon:'🤘', label:'Power Chords',color:'#ffcc44', desc:`+${battleState.powerBonus} Drive` },
              ].filter(Boolean);
              return (
                <div style={{textAlign:'center'}}>
                  <div style={{
                    marginTop:8,
                    fontFamily:"'Orbitron',sans-serif",
                    fontSize:22, fontWeight:900, letterSpacing:4,
                    color: attacker?.color ?? '#ff4444',
                    textShadow:`0 0 20px ${attacker?.color ?? '#ff4444'}, 0 0 8px ${attacker?.color ?? '#ff4444'}88`,
                    opacity: atkIn ? 1 : 0,
                    transition:'opacity 0.6s',
                    textTransform:'uppercase',
                  }}>
                    {attackLabel}
                  </div>
                  {/* Active skill effect pills */}
                  {activeMods.length > 0 && (
                    <div style={{
                      display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap',
                      marginTop:8, opacity: atkIn ? 1 : 0, transition:'opacity 0.8s 0.3s',
                    }}>
                      {activeMods.map((m, i) => (
                        <div key={i} style={{
                          display:'flex', alignItems:'center', gap:4,
                          background:`${m.color}18`, border:`1px solid ${m.color}66`,
                          borderRadius:4, padding:'3px 8px',
                          fontFamily:"'Orbitron',sans-serif",
                        }}>
                          <span style={{fontSize:11}}>{m.icon}</span>
                          <span style={{fontSize:7, color:m.color, letterSpacing:1}}>{m.label}</span>
                          <span style={{fontSize:7, color:'#4a6a7a'}}>· {m.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Phase status strip ── */}
            <div style={{
              marginTop:10, display:'flex', alignItems:'center', justifyContent:'center',
              gap:40, width:'100%', maxWidth:1300,
            }}>
              <div style={{textAlign:'center', opacity: atkIn ? 1 : 0, transition:'opacity 0.5s'}}>
                <div style={{fontSize:11, color: attacker?.color, letterSpacing:2}}>{attacker?.name}</div>
                <div style={{fontSize:9, color:'#ff8844', marginTop:2}}>
                  ⚔️ Drive {atkBase}{atkBonus > 0 && <span style={{color:'#ffaa44'}}>+{atkBonus}</span>}={atkStat}
                  {phase === 'result' && atkFace !== null &&
                    <span style={{color:'#ffcc44'}}> + {atkFace} = {atkTotal}</span>}
                </div>
              </div>
              <div style={{fontSize:10, color:'#6a8aaa', letterSpacing:2, textAlign:'center', minWidth:260}}>
                {phase==='enter_attacker'     && '⚔️ SWING!'}
                {phase==='flash_drive'        && `${attacker?.name?.split(' ')[0]} DRIVE: ${atkStat}`}
                {phase==='pick_drive_slide'   && `↙ pick slides ${atkStat} toward attacker…`}
                {phase==='enter_defender'     && `${defender?.name} steps up!`}
                {phase==='flash_sustain'      && `${defender?.name?.split(' ')[0]} FEEDBACK: ${defStat}`}
                {phase==='pick_sustain_slide' && `↗ defender pushes back ${defStat}…`}
                {phase==='atk_die_spin'       && '🎲 Click the die to stop it!'}
                {phase==='atk_die_settling'   && '🎲 Rolling…'}
                {phase==='pick_atk_slide'     && `↙ Attack +${atkRoll} — pick slides left!`}
                {phase==='def_die_spin'       && '🎲 Defender — click to stop!'}
                {phase==='def_die_settling'   && '🎲 Rolling…'}
                {phase==='pick_def_slide'     && `↗ Defense +${defRoll} — pick slides right!`}
              </div>
              <div style={{textAlign:'center', opacity: defIn ? 1 : 0, transition:'opacity 0.5s'}}>
                <div style={{fontSize:11, color: defender?.color, letterSpacing:2}}>{defender?.name}</div>
                <div style={{fontSize:9, color:'#88ccff', marginTop:2}}>
                  🛡️ Sustain {defBase}{defBonus > 0 && <span style={{color:'#88ccff'}}>+{defBonus}</span>}={defStat}
                  {battleState?.posing && <span style={{color:'#ffd700'}}> — 🌟 CAUGHT POSING: defense = 0!</span>}
                  {phase === 'result' && defFace !== null && !battleState?.posing &&
                    <span style={{color:'#ffcc44'}}> + {defFace} = {defTotal}</span>}
                </div>
              </div>
            </div>

            {/* ── RESULT BANNER — auto-fades after 3.5s ── */}
            {phase === 'result' && attackerWon !== undefined && (
              <div key="result-banner" style={{
                marginTop:14, marginBottom:10, flexShrink:0,
                animation:'battle-result-slam 0.7s cubic-bezier(0.22,1,0.36,1) forwards',
                textAlign:'center', padding:'14px 40px', borderRadius:14,
                background: attackerWon ? '#140000' : '#00001a',
                border:`3px solid ${attackerWon ? '#ff2222' : '#00aaff'}`,
                boxShadow: attackerWon
                  ? '0 0 50px #ff222255, 0 0 100px #ff222222'
                  : '0 0 50px #00aaff44',
                maxWidth:640,
              }}>
                {attackerWon ? (
                  <>
                    <div style={{fontSize:26, color:'#ff2222', letterSpacing:5, marginBottom:6,
                      textShadow:'0 0 24px #ff0000'}}>
                      💥 HIT!
                    </div>
                    <div style={{fontSize:15, color:'#ffaa44', marginBottom:4}}>
                      {attacker?.name} lands <strong style={{color:'#ff6644'}}>{damage} Vibe damage</strong> on {defender?.name}!
                    </div>
                    <div style={{fontSize:10, color:'#6a8aaa', marginBottom:6}}>
                      Attack {atkTotal} vs Defense {defTotal} — margin {margin}
                    </div>
                    {(() => {
                      const isSonic = !!battleState?.sonicAttack;
                      const fp = isSonic ? sonicFame(margin) : thrashFame();
                      const kb = isSonic
                        ? sonicKnockback(margin, defender?.vibe ?? 1, defender?.maxVibe ?? 1)
                        : thrashKnockback(margin);
                      return (
                        <div style={{display:'flex', justifyContent:'center', gap:10, marginBottom:2}}>
                          <span style={{fontSize:10, color:'#ffd700'}}>
                            ⭐ +{fp} Fame
                          </span>
                          <span style={{fontSize:10, color:'#ff8866'}}>
                            💢 {kb > 0 ? `Knockback ${kb} hex${kb !== 1 ? 'es' : ''}` : 'No push'}
                          </span>
                        </div>
                      );
                    })()}
                    {/* ── SWING / CQC STATUS-EFFECT PREVIEW ── */}
                    {/* Shows whether the attacker's upgrade (e.g. Shank Skank) */}
                    {/* triggered, and exactly what happens once this overlay     */}
                    {/* closes and the defender is pushed back.                   */}
                    {(() => {
                      const roll = battleState?.swingEffectRoll;
                      if (!roll) return null; // no swing upgrade / Sonic attack
                      const landed = roll.effects ?? [];
                      return (
                        <div style={{
                          marginTop:10, padding:'8px 12px', borderRadius:8,
                          background:'#0a0014aa',
                          border:`1px solid ${landed.length ? '#ff44aa66' : '#44557766'}`,
                        }}>
                          <div style={{fontSize:9, letterSpacing:2, color:'#ff66cc',
                            marginBottom: landed.length ? 5 : 0}}>
                            🗡️ {roll.upgradeName}
                          </div>
                          {landed.length === 0 ? (
                            <div style={{fontSize:9, color:'#7a8aa0'}}>
                              Rolled for a status effect — none landed this time.
                            </div>
                          ) : (
                            <>
                              {landed.map(fx => {
                                const info = SWING_FX_INFO[fx];
                                if (!info) return null;
                                const dmgNote = fx === 'confused' && roll.confusedDmg
                                  ? ` (${roll.confusedDmg} Vibe)` : '';
                                return (
                                  <div key={fx} style={{fontSize:9, color:info.color, lineHeight:1.5}}>
                                    {info.icon} <strong>{info.label}!</strong>{' '}
                                    <span style={{color:'#b8c4d4'}}>
                                      {defender?.name} {info.after}{dmgNote}.
                                    </span>
                                  </div>
                                );
                              })}
                              <div style={{fontSize:8, color:'#5a6a80', marginTop:4}}>
                                Applies after you close this overlay & the push-back resolves.
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <div style={{fontSize:26, color:'#00aaff', letterSpacing:5, marginBottom:6,
                      textShadow:'0 0 24px #0088ff'}}>
                      💨 WHIFF!
                    </div>
                    {(() => {
                      const isSonic = !!battleState?.sonicAttack;
                      const selfDmg = isSonic ? Math.max(1,Math.ceil(margin/2)) : damage;
                      const fp = isSonic ? sonicFame(margin) : thrashFame();
                      const kb = isSonic ? 1 : thrashKnockback(margin);
                      return (
                        <>
                          <div style={{fontSize:15, color:'#88ccff', marginBottom:4}}>
                            {attacker?.name} {isSonic ? 'misfires' : 'swings wide'} — <strong style={{color:'#4488ff'}}>{selfDmg} Vibe self-damage!</strong>
                          </div>
                          <div style={{fontSize:10, color:'#6a8aaa', marginBottom:4}}>
                            Attack {atkTotal} vs Defense {defTotal} — margin {margin}
                          </div>
                          <div style={{display:'flex', justifyContent:'center', gap:10}}>
                            <span style={{fontSize:10, color:'#ffd700'}}>
                              ⭐ {defender?.name} +{fp} Fame
                            </span>
                            <span style={{fontSize:10, color:'#88aaff'}}>
                              💢 {kb > 0 ? `Staggered back ${kb} hex${kb !== 1 ? 'es' : ''}` : 'No push'}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
                <div style={{marginTop:10, fontSize:15, letterSpacing:4,
                  color: attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff'),
                  textShadow:`0 0 16px ${attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff')}`,
                }}>
                  🏆 {attackerWon ? attacker?.name?.toUpperCase() : defender?.name?.toUpperCase()} WINS THE EXCHANGE!
                </div>
                {/* Close button */}
                <button
                  onClick={closeBattleOverlay}
                  style={{
                    marginTop:12, padding:'8px 32px', borderRadius:8,
                    background:'transparent',
                    border:`2px solid ${attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff')}`,
                    color: attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff'),
                    fontSize:11, letterSpacing:3, fontFamily:"'Orbitron',sans-serif",
                    cursor:'pointer',
                    textShadow:`0 0 8px ${attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff')}`,
                    boxShadow:`0 0 12px ${attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff')}44`,
                    transition:'all 0.2s',
                  }}
 
                  onMouseOver={e => e.currentTarget.style.background = '#ffffff18'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  BACK TO GAME
                </button>
              </div>
            )}
          </div>
        );
  })();
}
