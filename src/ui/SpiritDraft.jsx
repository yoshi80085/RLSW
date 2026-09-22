import { useEffect, useRef, useState } from 'react';
import { SPIRIT_DEFS, ROSTER_ORDER, IN_DEVELOPMENT } from '../data/spirits.js';
import { CORNER_LABELS } from '../data/corners.js';
import { abilitiesFor, validLoadout } from '../data/loadouts.js';

export function AbilityInfo({ skill, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.showModal();
    return () => previous?.focus?.();
  }, []);
  return <dialog ref={ref} className="ability-info" aria-labelledby="ability-info-title" onCancel={onClose}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="draft-eyebrow">ABILITY / FIELD GUIDE</div>
    <h2 id="ability-info-title">{skill.icon} {skill.label}</h2>
    <div className="draft-price">5 Db per use <span>•</span> 2 rounds to recharge</div>
    <p>{skill.desc}</p>
    <button className="draft-confirm" onClick={onClose} autoFocus>GOT IT</button>
  </dialog>;
}

export function SpiritDraft({ corners, assignments, loadouts, choosingCorner, onChooseCorner, onChooseSpirit,
  onLoadout, onConfirm, cpuCorners, onCpu, cpuSearcher, onSearcher, online, unlocked }) {
  const [info, setInfo] = useState(null);
  const corner = choosingCorner;
  const chosen = assignments[corner];
  const spirit = SPIRIT_DEFS[chosen];
  const selected = loadouts[corner] ?? [];
  const accent = CORNER_LABELS[corner]?.color ?? '#a4ffcc';
  return <section className="spirit-draft" style={{'--draft-accent':accent}} aria-label="Choose Spirits and abilities">
    <div className="draft-heading">
      <div><div className="draft-eyebrow">BACKSTAGE / MATCH SETUP</div><h1>Take the stage.</h1></div>
      <p>Choose your Spirit. Make their sound your own.<br/>Two abilities. Yours for the whole match.</p>
    </div>
    <div className="draft-seats" style={{'--seat-count':corners.length}}>
      {corners.map((c,i) => {
        const sp = SPIRIT_DEFS[assignments[c]];
        const ready = validLoadout(assignments[c],loadouts[c]);
        return <div key={c} className={`draft-seat ${corner===c?'is-active':''}`} style={{'--seat-color':CORNER_LABELS[c].color}}>
          <button onClick={()=>onChooseCorner(c)} aria-pressed={corner===c}>
            <span className="draft-eyebrow">PLAYER {i+1} <b>{ready?'READY':'SETUP'}</b></span>
            <strong>{sp?.name ?? 'Choose a Spirit'}</strong>
            <small>{sp ? `${loadouts[c]?.length ?? 0} / 2 abilities selected` : 'Your place in the spotlight'}</small>
          </button>
          {!online && <div className="draft-seat-options">
            <label><input type="checkbox" checked={!!cpuCorners[c]} onChange={e=>onCpu(c,e.target.checked)}/> CPU</label>
            {cpuCorners[c] && <label title="Use the searching bot"><input type="checkbox" checked={!!cpuSearcher[c]} onChange={e=>onSearcher(c,e.target.checked)}/> Search bot</label>}
          </div>}
        </div>;
      })}
    </div>
    {corner ? <div className="draft-workbench">
      <div className="draft-roster"><div className="draft-eyebrow">01 / CHOOSE YOUR SPIRIT</div>
        <div className="draft-portraits">{ROSTER_ORDER.map(id=>{
          const sp = SPIRIT_DEFS[id], locked = IN_DEVELOPMENT.has(id) || !unlocked.has(id);
          return <button key={id} className={`draft-portrait ${chosen===id?'is-selected':''}`} disabled={locked}
            aria-pressed={chosen===id} onClick={()=>onChooseSpirit(corner,id)} style={{'--spirit-color':sp.color}}>
            <span className="draft-portrait-halo"/>
            <img src={sp.imageSrc} alt="" draggable={false}/>
            <span className="draft-plinth"/>
            <span className="draft-portrait-caption"><strong>{sp.name}</strong><small>{locked?'IN DEVELOPMENT':`${sp.style} / ${sp.speed} speed`}</small></span>
          </button>;
        })}</div>
        <p className="draft-note">Same Spirit, different player. Duplicate picks welcome.</p>
      </div>
      <div className="draft-arsenal">
        <div className="draft-eyebrow">02 / BUILD YOUR LOADOUT <span>{selected.length}/2</span></div>
        <h2>{spirit ? spirit.name : 'Find your sound'}</h2>
        <p className="draft-subtitle">{spirit ? 'Choose two abilities to take into the arena.' : 'Select a Spirit to reveal their abilities.'}</p>
        <div className="draft-price">5 Db per use <span>•</span> 2-round cooldown</div>
        <div className="draft-skills">{abilitiesFor(chosen).map(skill=>{
          const on = selected.includes(skill.id);
          return <div key={skill.id} className={`draft-skill ${on?'is-selected':''}`}>
            <button className="draft-skill-pick" aria-pressed={on} disabled={!on&&selected.length===2}
              onClick={()=>onLoadout(corner,on?selected.filter(id=>id!==skill.id):[...selected,skill.id])}>
              <span className="draft-skill-icon">{skill.icon}</span><strong>{skill.label}</strong><span className="draft-check">{on?'✓':'+'}</span>
            </button>
            <button className="draft-info-button" aria-label={`About ${skill.label}`} onClick={()=>setInfo(skill)}>i</button>
          </div>;
        })}</div>
        <button className="draft-confirm" disabled={!validLoadout(chosen,selected)} onClick={onConfirm}>LOCK IN PLAYER {corners.indexOf(corner)+1} <span>→</span></button>
        <p className="draft-note">Abilities start ready. Earn Db on the board to use them.</p>
      </div>
    </div> : <div className="draft-ready"><span>✦</span><h2>Your lineup is ready.</h2><p>Adjust the match below, then enter the arena.</p><button onClick={()=>onChooseCorner(corners[0])}>EDIT LOADOUTS</button></div>}
    {info && <AbilityInfo skill={info} onClose={()=>setInfo(null)}/>}
  </section>;
}
