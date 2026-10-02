import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';

import {RiffHighway} from '../../src/ui/RiffHighway.jsx';
import {riffStats} from '../../src/engine/systems/riffOff.js';
import {DEFAULTS,seeded,parseMelody,makeExchange,nextExchange,activeRun,judge,expire,resolveExchange,demoOffset} from './duel.js';
import {createDuelScene,COLORS,SPIRITS} from './scene.js';
import './style.css';

const STORE=`rlsw.riffArena.${location.pathname}`;
const load=()=>{try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(STORE)||'{}')};}catch{return {...DEFAULTS};}};
const label=['ATTACKER','RIVAL'];

export function App(){
  const [config,setConfig]=useState(load),[ready,setReady]=useState(false),[error,setError]=useState('');
  const [playing,setPlaying]=useState(false),[started,setStarted]=useState(false),[copy,setCopy]=useState(''),[panel,setPanel]=useState(false);
  const [view,setView]=useState(null),stage=useRef(null),engine=useRef(null),scene=useRef(null),audio=useRef(null);
  const configRef=useRef(config),playingRef=useRef(false),latest=useRef({}),laneEls=useRef([]),nameEls=useRef([]);
  useLayoutEffect(()=>{configRef.current=config;playingRef.current=playing;latest.current={reset,event};pressRef.current=press;});
  useEffect(()=>{try{localStorage.setItem(STORE,JSON.stringify(config));}catch{/* copy remains available */}},[config]);

  const makeAudio=()=>{if(!audio.current){const ctx=new AudioContext(),gain=ctx.createGain();gain.connect(ctx.destination);audio.current={ctx,gain};}audio.current.ctx.resume();};
  function tone(event){
    const a=audio.current;if(!a||!event.result.hit||!configRef.current.volume)return;
    const t=a.ctx.currentTime,osc=a.ctx.createOscillator(),g=a.ctx.createGain(),filter=a.ctx.createBiquadFilter();
    osc.type=event.run.side===0?'triangle':'sawtooth';osc.frequency.value=82.41*2**(event.note.pitch/12);
    filter.type='lowpass';filter.frequency.setValueAtTime(2400,t);filter.frequency.exponentialRampToValueAtTime(450,t+.22);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(configRef.current.volume*.2,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.28);
    const pan=a.ctx.createStereoPanner();pan.pan.value=event.run.side===0?-.55:.55;
    osc.connect(filter);filter.connect(g);g.connect(pan);pan.connect(a.gain);osc.start(t);osc.stop(t+.3);
    osc.onended=()=>{osc.disconnect();filter.disconnect();g.disconnect();pan.disconnect();};
  }
  function event(e){if(!e)return;engine.current.feedback[e.run.side]={text:e.result.grade.toUpperCase(),at:engine.current.time};scene.current?.hit(e);tone(e);}
  function buildNext(e){return nextExchange(e.exchange,{config:e.config,melodies:e.melodies,rand:e.rand,startedAt:e.t0});}
  function reset(run=false){
    try{
      const c={...configRef.current},melodies=[parseMelody(c.melodyA),parseMelody(c.melodyB)],rand=seeded();
      const t0=performance.now(),exchange=makeExchange({config:c,melodies,rand,startedAt:t0,firstHit:c.lead+300});
      const e={config:c,melodies,rand,t0,time:0,exchange,next:null,feedback:[null,null],history:[],r1:null,outcome:null,demoPlayed:new Set()};
      e.next=buildNext(e);engine.current=e;scene.current?.reset();scene.current?.setSpirits(c);
      setError('');setPlaying(run);setStarted(run);setView({...e});
    }catch(e){setError(e.message);}
  }
  useEffect(()=>{
    try{scene.current=createDuelScene(stage.current,{onReady:()=>setReady(true),onError:setError});scene.current.setSpirits(configRef.current);latest.current.reset(false);}
    catch(e){queueMicrotask(()=>setError(`3D could not start: ${e.message}`));return;}
    let raf,lastPaint=0;
    const tick=now=>{
      const e=engine.current;
      if(e){
        if(!playingRef.current){e.t0=now-e.time;}
        else e.time=now-e.t0;
        e.exchange.runs.forEach(r=>r.startedAt=e.t0);e.next?.runs.forEach(r=>r.startedAt=e.t0);
        if(playingRef.current&&!e.outcome){
          for(const run of e.exchange.runs){
            const automatic=e.config.mode==='demo'||(e.config.mode==='attacker'&&run.side===1)||(e.config.mode==='rival'&&run.side===0);
            if(automatic) for(const [i,n] of run.notes.entries()){
              const id=`${run.round}/${run.side}/${i}`,pressAt=n.hitAt+demoOffset(run,i,e.config.scenario);
              if(!e.demoPlayed.has(id)&&e.time>=pressAt){e.demoPlayed.add(id);latest.current.event(judge(run,n.pos[0]+1,pressAt));}
            }
            expire(run,e.time).forEach(latest.current.event);
          }
          if(e.time>e.exchange.end){
            const result=resolveExchange(e.exchange,e.config,e.r1);
            if(result){
              e.history.push({round:e.exchange.round,caller:e.exchange.caller,...result});e.r1=result.r1;
              if(result.stopped){e.outcome={...result,at:e.time};scene.current.finish(result.verdict,e.time);}
              else {e.exchange=e.next;e.next=buildNext(e);}
            }
          }
        }
        const points=scene.current.frame(e.time,configRef.current,matchMedia('(prefers-reduced-motion: reduce)').matches);
        points.forEach((p,i)=>{
          const el=laneEls.current[i],width=Math.min(configRef.current.laneWidth,stage.current.clientWidth*.30),scale=width/340;
          const top=100,height=Math.max(100,(p.bridge.y-top)/scale);
          if(el){el.style.left=`${p.bridge.x}px`;el.style.top=`${top}px`;el.style.transform=`translateX(-50%) scale(${scale})`;el.style.setProperty('--neck-height',height);}
          if(nameEls.current[i]){nameEls.current[i].style.left=`${p.foot.x}px`;nameEls.current[i].style.top=`${Math.min(stage.current.clientHeight-70,p.foot.y+8)}px`;}
          e.neckHeight=height;
        });
        if(now-lastPaint>45){lastPaint=now;setView({...e});}
        if(e.outcome&&e.time>e.outcome.at+2400) setPlaying(false);
      }
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    const visibility=()=>{if(document.hidden)setPlaying(false);};document.addEventListener('visibilitychange',visibility);
    return()=>{cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);scene.current?.dispose();audio.current?.ctx.close();};
  },[]);

  function press(string,side){
    const e=engine.current;if(!e||!playing||e.outcome||e.config.mode==='demo')return;
    const run=activeRun(e.exchange,e.time);if(!run||(side!=null&&run.side!==side))return;
    if((e.config.mode==='attacker'&&run.side!==0)||(e.config.mode==='rival'&&run.side!==1))return;
    event(judge(run,string,performance.now()-e.t0));
  }
  const pressRef=useRef(press);
  useEffect(()=>{
    const key=e=>{if(e.repeat||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
      if(/^Digit[1-6]$/.test(e.code)){e.preventDefault();pressRef.current(Number(e.code.slice(-1)));}
      if(e.code==='Space'){e.preventDefault();if(engine.current?.outcome)return;makeAudio();setStarted(true);setPlaying(p=>!p);}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[]);

  const e=view,ex=e?.exchange,active=e&&!e.outcome?activeRun(ex,e.time):null;
  const c=e?.config??config,ids=[c.attacker,c.defender];
  function displayRun(side){
    if(!ex)return null;
    const runs=[ex.runs[side],...(!e.outcome?[e.next.runs[side]]:[])];
    return {...runs[0],startedAt:e.t0,notes:runs.flatMap(r=>r.notes.map(n=>({...n,idx:r.round*100+n.idx}))),
      results:runs.flatMap(r=>r.results.map(n=>({...n,noteIdx:r.round*100+n.noteIdx})))};
  }
  const title=e?.outcome?(e.outcome.verdict.tie?'SOUNDFORMS HOLD':`${label[e.outcome.verdict.attackerWon?0:1]} BREAKS THROUGH`):
    !started?'A MELODY BECOMES A DUEL':active?`${label[active.side]} · ${active.kind==='call'?'CALL':'ANSWER'}`:playing?'PHRASE INCOMING':'PAUSED';
  const change=(key,value)=>setConfig(p=>({...p,[key]:value}));
  function dialIn(){
    const text=['Riff Off arena dial-in · 2026-10-01',...Object.entries(config).map(([k,v])=>`${k}: ${JSON.stringify(v)}${v===DEFAULTS[k]?' (default)':` (changed from ${JSON.stringify(DEFAULTS[k])})`}`)].join('\n');
    setCopy(text);navigator.clipboard?.writeText(text).catch(()=>{});
  }
  return <main>
    <div className="arena" ref={stage}/>
    <header><a href="../../">RLSW <span>/ RIFF OFF</span></a><div className="study">INTERACTIVE ARENA STUDY</div><button onClick={()=>setPanel(p=>!p)}>{panel?'Hide tuning':'Tune duel'}</button></header>
    <div className="duel-title"><small>{ex?`EXCHANGE ${ex.round} · ${Math.round(ex.bpm)} BPM`:'SOUNDFORM'}</small><h1>{title}</h1><p>{e?.outcome?'The crowd has its answer.':active?.kind==='call'?'Your committed melody sets the challenge.':'Listen to the call. Make the answer yours.'}</p></div>
    {[0,1].map(side=>{const run=displayRun(side),feedback=e?.feedback[side],current=ex?.runs[side];return <React.Fragment key={side}>
      <section ref={el=>{laneEls.current[side]=el;}} className={`lane ${active?.side===side?'live':''} ${e?.outcome?'finished':''}`} style={{'--color':COLORS[side]}} aria-label={`${label[side]} guitar track`}>
        <div className="lane-state">{active?.side===side?'PLAY NOW':e?.outcome?'COMPLETE':current&&e.time>current.lastHit+current.preset.ok?'NEXT CALL LOADING':'GET READY'}<span>{current?.kind==='call'?'YOUR MELODY':current?.kind?.toUpperCase()}</span></div>
        {run&&<RiffHighway run={run} results={run.results} accent={COLORS[side]} height={e.neckHeight??300} onPressKey={n=>press(n,side)}/>} 
        <div className="grade">{feedback&&e.time-feedback.at<850?feedback.text:'\u00a0'}</div>
      </section>
      <div ref={el=>{nameEls.current[side]=el;}} className="spirit-name" style={{'--color':COLORS[side]}}><small>{label[side]}</small><strong>{SPIRITS[ids[side]][0]}</strong><span>{current?`${riffStats(current.results).quality}% clean · ${current.results.length}/${current.notes.length}`:''}</span></div>
    </React.Fragment>;})}
    <div className="pressure"><span style={{color:COLORS[0]}}>CALL</span><i/><span style={{color:COLORS[1]}}>RESPONSE</span><small className="gap-readout">{ex?`BREAKTHROUGH AT ${ex.gapLimit} POINTS APART`:''}</small></div>
    <footer><div className="transport"><button className="primary" disabled={!ready} onClick={()=>{makeAudio();if(!started||e?.outcome)reset(true);else setPlaying(p=>!p);}}>{!ready?'Loading arena…':!started?'Start duel':e?.outcome?'Play again':playing?'Pause':'Resume'}</button><button onClick={()=>reset(false)}>Reset</button><span>{c.mode==='demo'?'WATCH DEMO':'PRESS 1–6 ON THE ACTIVE TRACK'} <b>·</b> SPACE TO PAUSE</span></div><div className="flow">A calls <b>→</b> B answers <b>→</b> B calls <b>→</b> A answers</div></footer>
    {!started&&ready&&<div className="intro"><span>01 / CALL & RESPONSE</span><h2>Two stages.<br/>One collision.</h2><p>Short melodies. Immediate answers.<br/>Every clean note feeds your Soundform.</p><button className="primary" onClick={()=>{makeAudio();reset(true);}}>Watch the duel ↗</button><small>Choose a playing mode in Tune duel to take a side.</small></div>}
    {panel&&<aside><div className="panel-title">DIRECT THE DUEL<button aria-label="Close tuning" onClick={()=>setPanel(false)}>×</button></div><p className="hint">Timing, tolerance and melody changes apply on Reset. Ball, stream, glitter, glow, width and volume change live.</p>
      <label>Play mode<select value={config.mode} onChange={x=>change('mode',x.target.value)}><option value="demo">Watch both Spirits</option><option value="attacker">Play attacker · Rival automatic</option><option value="rival">Play Rival · attacker automatic</option><option value="both">Two players · pass 1–6 between turns</option></select></label>
      <label>Demo performance<select value={config.scenario} onChange={x=>change('scenario',x.target.value)}><option value="escalate">Long duel → pressure breaks the lock</option><option value="close">Close opening → break in round 2</option><option value="break">Clear gap in round 1</option><option value="locked">Evenly matched · keep trading</option></select></label>
      {[['bpm','Opening tempo',90,200,1,' BPM'],['length','Phrase note limit',3,5,1,' notes'],['lead','Track look-ahead',900,2500,50,' ms'],['handoff','Opening handoff gap',0,350,10,' ms'],['acceleration','Tempo increase / exchange',0,20,1,' BPM'],['gapDecay','Tolerance lost / exchange',0,4,.5,' points'],['gapFloor','Minimum breakthrough gap',1,10,1,' points'],['orb','Soundform ball size',.5,2,.05,'×'],['growth','Ball growth from notes',.05,.3,.01,''],['spin','Uneven ring spin',0,2,.1,'×'],['flow','Ring stream speed',3,10,.5,''],['glitter','Glitter weave',0,.8,.02,''],['laneWidth','Track width',210,340,5,' px'],['boardGlow','Board glow',.05,1,.01,'×'],['volume','Volume',0,.7,.01,'']].map(([key,text,min,max,step,unit])=><label key={key} className="slider"><span>{text}<output>{config[key]}{unit}</output></span><input aria-label={text} type="range" min={min} max={max} step={step} value={config[key]} onChange={x=>change(key,Number(x.target.value))}/></label>)}
      <label>Continue rule<select value={config.rounds} onChange={x=>change('rounds',x.target.value)}><option value="continuous">Until a clear gap · alternating leaders</option><option value="two">Existing two-round limit</option></select></label>
      {[0,1].map(i=><div className="melody" key={i}><label>{label[i]}<select value={config[i?'defender':'attacker']} onChange={x=>change(i?'defender':'attacker',x.target.value)}>{Object.entries(SPIRITS).map(([id,[name]])=><option key={id} value={id}>{name}</option>)}</select></label><label>Committed melody<input value={config[i?'melodyB':'melodyA']} onChange={x=>change(i?'melodyB':'melodyA',x.target.value)}/></label></div>)}
      <button className="wide" onClick={()=>reset(false)}>Apply & reset</button><button className="wide" onClick={dialIn}>Copy dial-in</button>{copy&&<textarea aria-label="Dial-in settings" readOnly value={copy} onFocus={x=>x.target.select()}/>}<p className="hint">Saved on this browser at this URL. Copy before moving it.</p>
      <details><summary>Exchange results</summary>{e?.history.map(h=><p key={h.round}>#{h.round} · {label[h.caller]} called · {h.scores.map(s=>`${s.quality}%`).join(' / ')} · gap limit {h.gapLimit} · {h.stopped?'breakthrough':'locked'}</p>)}</details>
      <p className="hint">Preview only · sample melodies · no match rewards or damage applied. Continuous duels accelerate and narrow the allowed performance difference each exchange. Equal play keeps the duel alive.</p>
    </aside>}
    {error&&<div role="alert" className="error">{error}</div>}
  </main>;
}


