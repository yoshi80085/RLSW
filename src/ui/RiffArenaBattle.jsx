import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {RiffHighway} from './RiffHighway.jsx';
import {arenaInputRole,judgeArenaNote,arenaBotResults,arenaSeatControl} from '../riff/arenaDuel.js';
import {riffStats} from '../engine/systems/riffOff.js';
const css = `.riff-arena-battle{position:absolute;inset:0;z-index:12;pointer-events:none;color:#e9f5ff;font-family:system-ui,sans-serif;overflow:hidden;background:linear-gradient(#0306118c,transparent 27%,transparent 78%,#03061166)}
.riff-arena-title{position:absolute;top:12px;left:50%;transform:translateX(-50%);text-align:center;width:48%;text-shadow:0 2px 12px #000}
.riff-arena-title small{font-size:9px;letter-spacing:2px}.riff-arena-title strong{display:block;font-size:16px;margin:6px 0;text-transform:uppercase}.riff-arena-title span{font-size:10px;color:#b8cee3}
.riff-arena-lane{position:absolute;width:340px;transform-origin:top center;pointer-events:auto;opacity:.7}.riff-arena-lane.live{opacity:1}.riff-arena-lane>div:first-child{display:flex;justify-content:space-between;font-size:10px;color:var(--riff-color);letter-spacing:1px}.riff-arena-lane>div:first-child span{font-size:9px;color:#c1d2e4}.riff-arena-lane>b{display:block;text-align:center;color:var(--riff-color);font-size:13px;letter-spacing:2px}
.riff-arena-name{position:absolute;transform:translateX(-50%);text-align:center;white-space:nowrap;text-shadow:0 2px 8px #000}.riff-arena-name strong{display:block;font-size:12px}.riff-arena-name small{font-size:10px;color:#bed7eb}
.riff-arena-start{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);text-align:center;background:#071023e8;border:1px solid #7cd8ff50;padding:24px;border-radius:12px;pointer-events:auto}.riff-arena-start p{font-size:12px}.riff-arena-start button{background:#b9f1ff;color:#092037;border:0;border-radius:6px;padding:12px 24px;font-weight:800;cursor:pointer}
`;

// Both highways share the engine's epoch. Local results are submitted once per
// role/round/clock; remote cues only animate sound and never decide the winner.
export function RiffArenaBattle({battle,spirits,net,projectionRef,onStart,onSubmit,onNote,onProgress}){
  const [view,setView]=useState(null),[resume,setResume]=useState(()=>{
    const c=arenaSeatControl(battle,spirits,net);
    return battle.arenaStartedAt!=null&&!battle.verdict&&c.own.some((own,i)=>own&&!c.bots[i]
      &&!battle[i===0?'atkResults':'defResults']&&Date.now()-battle.arenaStartedAt>battle.arenaExchange.runs[i].firstHit);
  });
  const latest=useRef(null),runtime=useRef(null),lanes=useRef([]),names=useRef([]);
  const control=arenaSeatControl(battle,spirits,net);
  useLayoutEffect(()=>{latest.current={battle,control,onStart,onSubmit,onNote,onProgress,resume};});
  useEffect(()=>{
    const ex=battle.arenaExchange,epoch=battle.arenaStartedAt;
    const e={ex,epoch,results:[battle.atkResults??[],battle.defResults??[]].map(a=>a.map(r=>({...r}))),submitted:[!!battle.atkResults,!!battle.defResults],
      held:new Set(),sustains:new Map(),feedback:[null,null],cueNotes:new Set(),startedAt:performance.now()-(epoch==null?0:Date.now()-epoch)};
    runtime.current=e;
    let raf,lastPaint=0,autoStarted=false;
    function publish(side,result,audible=true){
      if(e.results[side].some(r=>r.noteIdx===result.noteIdx))return;
      e.results[side].push(result);e.feedback[side]=result.grade.toUpperCase();
      if(audible)try{latest.current.onNote?.(side,ex.runs[side].notes[result.noteIdx],result);}catch{/* audio never gates scoring */}
    }
    e.publish=publish;
    function tick(now){
      if(runtime.current!==e)return;
      const {battle:b,control:c,resume:needsResume}=latest.current;
      const time=epoch==null?0:Date.now()-epoch;
      if(epoch==null&&c.conductor&&c.bots.every(Boolean)&&projectionRef.current&&!autoStarted){autoStarted=true;latest.current.onStart();}
      [b.atkResults,b.defResults].forEach((r,side)=>{if(r){e.results[side]=r.map(n=>({...n}));e.submitted[side]=true;}});
      if(epoch!=null&&!b.verdict&&!needsResume){
        ex.runs.forEach((run,side)=>{
          if(e.submitted[side])return;
          if(c.bots[side]){
            const scored=arenaBotResults(run,ex.botOffsets[side]);
            run.notes.forEach((n,i)=>{if(time>=n.hitAt+(ex.botOffsets[side][i]??n.okWin+1))publish(side,scored[i]);});
          }
          // Every viewer hears the seeded bots; only their host submits results.
          if(!c.own[side])return;
          run.notes.forEach(n=>{if(time>n.hitAt+n.okWin)publish(side,{noteIdx:n.idx,hit:false,grade:'miss',rt:null});});
          if(time>run.end&&e.results[side].length===run.notes.length){
            e.submitted[side]=true;latest.current.onSubmit(side,e.results[side].map(r=>({...r})));
          }
        });
      }
      const points=projectionRef.current;
      points?.forEach((p,side)=>{
        const el=lanes.current[side];if(!el)return;
        const width=Math.min(270,p.width*.28),scale=width/340,top=52,height=Math.max(140,(p.y-top)/scale);
        el.style.left=`${p.x}px`;el.style.top=`${top}px`;el.style.transform=`translateX(-50%) scale(${scale})`;
        e.height=height;
        const name=names.current[side];if(name){name.style.left=`${p.x}px`;name.style.top=`${Math.min(p.height-54,p.footY+8)}px`;}
      });
      if(now-lastPaint>45){
        lastPaint=now;
        // Freeze the preloaded next phrase at the decision boundary when a
        // network result is late. The engine rebases it before anybody plays.
        const next=b.arenaNext,early=next.runs[next.caller].firstHit-next.runs[next.caller].preset.ok;
        const shown=epoch==null||needsResume?ex.runs[ex.caller].firstHit-1900:b.verdict&&!b.verdict.close?time:Math.min(time,early-1);
        e.startedAt=now-shown;
        setView({time,results:e.results.map(a=>[...a]),feedback:[...e.feedback],startedAt:e.startedAt,height:e.height??240});
        latest.current.onProgress({time:Math.max(0,shown),energy:b.arenaEnergy.map((n,i)=>n+riffStats(e.results[i]).score)});
      }
      raf=requestAnimationFrame(tick);
    }
    raf=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(raf);if(runtime.current===e)runtime.current=null;};
  },[battle.round,battle.arenaClock]); // eslint-disable-line react-hooks/exhaustive-deps -- a performance owns its initial chart; live authority and callbacks are ref-backed
  const previousClock=useRef(battle.arenaClock);
  useEffect(()=>{if(previousClock.current!==battle.arenaClock){previousClock.current=battle.arenaClock;setResume(false);}},[battle.arenaClock]);

  function press(string,side=null){
    const e=runtime.current,{battle:b,control:c}=latest.current;
    if(!e||e.epoch==null||b.verdict||resume)return;
    const time=Date.now()-e.epoch,owner=arenaInputRole(e.ex,time);
    if(owner<0||!c.own[owner]||c.bots[owner]||(side!=null&&side!==owner)||e.submitted[owner])return;
    const result=judgeArenaNote(e.ex.runs[owner],e.results[owner],string,time);if(!result)return;
    e.held.add(string);e.publish(owner,result);
    const note=e.ex.runs[owner].notes[result.noteIdx];
    if(result.hit&&note.sustain)e.sustains.set(string,{side:owner,note,until:note.hitAt+note.sustain,bent:false});
    net?.client?.sendCue('riff-note',`${b.round},${b.arenaClock},${owner},${result.noteIdx},${result.grade},${result.rt??0}`);
  }
  const input=useRef(press);useLayoutEffect(()=>{input.current=press;});
  useEffect(()=>{
    const key=e=>{
      if(e.repeat||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
      if(/^Digit[1-6]$/.test(e.code)){e.preventDefault();input.current(Number(e.code.slice(-1)));}
      if(e.key==='ArrowUp'||e.key==='ArrowDown'){
        const rt=runtime.current;if(!rt?.epoch)return;const time=Date.now()-rt.epoch;
        for(const [string,s] of rt.sustains)if(rt.held.has(string)&&!s.bent&&time<=s.until&&s.note.bend
          &&Math.abs(time-s.note.hitAt-s.note.bendAt)<=rt.ex.runs[s.side].preset.ok){
          s.bent=true;e.preventDefault();
          const hit=s.note.bendDir===(e.key==='ArrowUp'?'up':'down');
          try{latest.current.onNote(s.side,{...s.note,pitch:s.note.pitch+(e.key==='ArrowUp'?1:-1)*(s.note.bendAmt??2)},{hit,grade:hit?'good':'wrong'});}catch{/* audio only */}
        }
      }
    };
    const up=e=>{if(/^Digit[1-6]$/.test(e.code)){runtime.current?.held.delete(Number(e.code.slice(-1)));runtime.current?.sustains.delete(Number(e.code.slice(-1)));}};
    window.addEventListener('keydown',key);window.addEventListener('keyup',up);
    return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',up);};
  },[]);
  useEffect(()=>net?.client?.on('CUE',frame=>{
    if(frame.kind==='riff-resume'){
      const b=latest.current.battle,seat=net.seats?.find(s=>s.seatId===frame.seatId);
      const side=[b.attackerId,b.defenderId].indexOf(seat?.spiritId);
      if(latest.current.control.conductor&&side>=0&&!b.verdict&&!b[side===0?'atkResults':'defResults']
        &&frame.id===`${b.round},${b.arenaClock}`)latest.current.onStart();
      return;
    }
    if(frame.kind!=='riff-note')return;
    const [round,clock,side,index,grade,rt]=String(frame.id).split(','),b=latest.current.battle,e=runtime.current;
    const seat=net.seats?.find(s=>s.seatId===frame.seatId),id=Number(side)===0?b.attackerId:b.defenderId;
    if(!e||Number(round)!==b.round||Number(clock)!==b.arenaClock||seat?.spiritId!==id||!['0','1'].includes(side))return;
    const note=e.ex.runs[Number(side)].notes[Number(index)];
    if(!note||!['perfect','good','ok','wrong','miss'].includes(grade)||latest.current.control.own[Number(side)])return;
    e.publish(Number(side),{noteIdx:note.idx,grade,hit:['perfect','good','ok'].includes(grade),rt:Number(rt)});
  }),[net]);

  const ex=battle.arenaExchange,time=view?.time??0,active=arenaInputRole(ex,time),v=battle.verdict;
  const waiting=battle.arenaStartedAt!=null&&time>ex.end&&!v;
  return <div className="riff-arena-battle" data-riff-arena={battle.round}><style>{css}</style>
    <div className="riff-arena-title"><small>RIFF OFF · EXCHANGE {battle.round} · {ex.bpm} BPM</small>
      <strong>{v&&!v.close?`${spirits.find(s=>s.id===(v.attackerWon?battle.attackerId:battle.defenderId))?.name} breaks through!`:waiting?'Waiting for the other performance…':active>=0?`${spirits.find(s=>s.id===(active===0?battle.attackerId:battle.defenderId))?.name} · ${active===ex.caller?'CALL':'ANSWER'}`:'SOUNDFORM DUEL'}</strong>
      <span>{v&&!v.close?'The crowd has its answer.':`Breakthrough at ${ex.gapLimit} points apart · 1–6 to play · hold tails · ↑ / ↓ to bend`}</span>
    </div>
    {[0,1].map(side=>{
      const sp=spirits.find(s=>s.id===(side===0?battle.attackerId:battle.defenderId)),current=ex.runs[side],next=battle.arenaNext.runs[side];
      const result=view?.results[side]??[],offset=battle.arenaNext.round*100;
      const run={...current,startedAt:view?.startedAt??0,notes:[...current.notes,...(!v?next.notes.map(n=>({...n,idx:n.idx+offset,partnerOf:n.partnerOf==null?null:n.partnerOf+offset})):[])]};
      return <div key={side}>
        <section ref={el=>{lanes.current[side]=el;}} className={`riff-arena-lane ${active===side?'live':''}`} style={{'--riff-color':sp?.color??'#75dfff'}} aria-label={`${side===0?'Attacker':'Rival'} guitar track`}>
          <div>{active===side?'PLAY NOW':time>current.end?'NEXT PHRASE LOADING':'GET READY'} <span>{control.own[side]&&!control.bots[side]?'YOUR TRACK':sp?.name}</span></div>
          <RiffHighway run={run} results={result} accent={sp?.color} height={view?.height??240} onPressKey={n=>press(n,side)}/>
          <b>{view?.feedback[side]??'\u00a0'}</b>
        </section>
        <div className="riff-arena-name" ref={el=>{names.current[side]=el;}}><strong>{sp?.name}</strong><small>{riffStats(result).quality}% clean · {result.length}/{current.notes.length}</small></div>
      </div>;
    })}
    {(battle.arenaStartedAt==null||resume)&&<div className="riff-arena-start"><p>Short calls. Immediate answers. Keep the clash alive.</p>
      {control.conductor?<button onClick={()=>{setResume(false);onStart();}}>{resume?'Resume pending performances':'Start Riff Off'}</button>:resume?<button onClick={()=>net?.client?.sendCue('riff-resume',`${battle.round},${battle.arenaClock}`)}>Resume my performance</button>:<p>Waiting for the initiating player…</p>}
    </div>}
  </div>;
}

