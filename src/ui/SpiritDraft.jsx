import { useEffect, useRef, useState } from 'react';
import { SPIRIT_DEFS, ROSTER_ORDER, IN_DEVELOPMENT } from '../data/spirits.js';
import { playerColor } from '../data/corners.js';
import { SeatPortrait } from './SeatPortrait.jsx';
import { SEAT_PORTRAIT } from './seatPortrait.js';
import { abilitiesFor, validLoadout } from '../data/loadouts.js';
import { canUseWebGL, createSpiritPickerStage, SPIRIT_PICKER } from './spiritPickerStage.js';

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

/**
 * 🎭 The roster: each card shows the Spirit's real acrylic standee, which POPS on
 * hover and tells its backstory if you stay (Alex, 2026-09-25). The 3D is drawn by
 * `spiritPickerStage.js` on one shared canvas; these cards only report hover,
 * focus and picks to it. ⚠️ No WebGL2 (jsdom in `test:loadoutui`, an old browser,
 * a lost context at start) → today's flat art, so the picker can never go blank.
 * 📌 Hover is on the SLOT, not the button: a disabled button (the locked Spirit)
 * swallows pointer events, and its story should still be readable.
 * 🎨 Every card wears the CHOOSING player's colour (`color`), never a Spirit's
 * own — Spirits have none (Alex, 2026-09-25). P2 choosing → every card orange.
 */
function SpiritRoster({ corner, color, chosen, unlocked, onChooseSpirit }) {
  const [threeD, setThreeD] = useState(() => canUseWebGL());
  const stage = useRef(null), cards = useRef(new Map());
  useEffect(() => {
    if (!threeD) return undefined;
    try { stage.current = createSpiritPickerStage({ color }); }
    // 📌 A failed start (no context, a driver blocklist) is news FROM the outside
    // world, so it lands like any other external callback — on the next tick.
    catch { queueMicrotask(() => setThreeD(false)); return undefined; }
    for (const [id, { el, slot }] of cards.current) stage.current.register(id, el, slot);
    return () => { stage.current?.dispose(); stage.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- colour changes go through setColor below, not a new WebGL context
  }, [threeD]);
  useEffect(() => { stage.current?.setColor(color); }, [color]);
  const keep = (id, key) => node => { const c = cards.current.get(id) ?? {}; c[key] = node; cards.current.set(id, c); };
  return <div style={{'--spirit-color':color}} className={`draft-portraits${threeD && SPIRIT_PICKER.halo === 'off' ? ' no-halo' : ''}`}>{ROSTER_ORDER.map(id=>{
    const sp = SPIRIT_DEFS[id], locked = IN_DEVELOPMENT.has(id) || !unlocked.has(id);
    const s = () => stage.current;
    return <div key={id} className="draft-slot" ref={keep(id, 'slot')}
      onPointerEnter={()=>s()?.hover(id)} onPointerLeave={()=>s()?.leave(id)}>
      <button ref={keep(id, 'el')} className={`draft-portrait ${threeD?'is-3d':''} ${chosen===id?'is-selected':''}`} disabled={locked}
        aria-pressed={chosen===id} aria-describedby={threeD ? 'spirit-story' : undefined}
        onClick={()=>{ s()?.picked(id); onChooseSpirit(corner,id); }}
        onFocus={()=>s()?.hover(id)} onBlur={()=>s()?.leave(id)}
        onKeyDown={e=>{ if (e.key === 'Escape') s()?.dismiss(id); }}
        onContextMenu={threeD ? e=>e.preventDefault() : undefined}>
        <span className="draft-portrait-halo"/>
        {!threeD && <><img src={sp.imageSrc} alt="" draggable={false}/><span className="draft-plinth"/></>}
        <span className="draft-portrait-caption"><strong>{sp.name}</strong><small>{locked?'IN DEVELOPMENT':`${sp.style} / ${sp.speed} speed`}</small></span>
      </button>
    </div>;
  })}</div>;
}

/**
 * 🪑 The player seats across the top of the draft — one banner per player, in
 * that player's colour. A component of its own so the seat-portrait preview
 * (`.scratch/seat-portrait-preview.jsx`) draws THESE banners, not a copy.
 *
 * 🎭 `portrait` is the head close-up's look (`SEAT_PORTRAIT`), or null for none.
 * The game passes `SEAT_PORTRAIT` — Alex's dial-in, 2026-09-25.
 */
export function DraftSeats({ corners, assignments, loadouts, corner, onChooseCorner, cpuCorners = {}, onCpu, cpuSearcher = {},
  onSearcher, online, portrait = null, focus }) {
  return <div className="draft-seats" style={{'--seat-count':corners.length}}>
      {corners.map((c,i) => {
        const sp = SPIRIT_DEFS[assignments[c]];
        const ready = validLoadout(assignments[c],loadouts[c]);
        return <div key={c} className={`draft-seat ${corner===c?'is-active':''}${portrait?' has-portrait':''}`} style={{'--seat-color':playerColor(c)}}>
          {portrait && <SeatPortrait spirit={sp ?? null} color={playerColor(c)} index={i} active={corner===c} P={portrait} focus={focus}/>}
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
    </div>;
}

export function SpiritDraft({ corners, assignments, loadouts, choosingCorner, onChooseCorner, onChooseSpirit,
  onLoadout, onConfirm, cpuCorners, onCpu, cpuSearcher, onSearcher, online, unlocked }) {
  const [info, setInfo] = useState(null);
  const corner = choosingCorner;
  const chosen = assignments[corner];
  const spirit = SPIRIT_DEFS[chosen];
  const selected = loadouts[corner] ?? [];
  const accent = playerColor(corner);
  return <section className="spirit-draft" style={{'--draft-accent':accent}} aria-label="Choose Spirits and abilities">
    <div className="draft-heading">
      <div><div className="draft-eyebrow">BACKSTAGE / MATCH SETUP</div><h1>Take the stage.</h1></div>
      <p>Choose your Spirit. Make their sound your own.<br/>Two abilities. Yours for the whole match.</p>
    </div>
    <DraftSeats corners={corners} assignments={assignments} loadouts={loadouts} corner={corner}
      onChooseCorner={onChooseCorner} cpuCorners={cpuCorners} onCpu={onCpu} cpuSearcher={cpuSearcher}
      onSearcher={onSearcher} online={online} portrait={SEAT_PORTRAIT}/>
    {corner ? <div className="draft-workbench">
      <div className="draft-roster"><div className="draft-eyebrow">01 / CHOOSE YOUR SPIRIT</div>
        <SpiritRoster corner={corner} color={accent} chosen={chosen} unlocked={unlocked} onChooseSpirit={onChooseSpirit}/>
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
