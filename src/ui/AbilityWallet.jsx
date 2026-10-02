import { useState } from 'react';
import { SKILL_BY_ID } from '../data/skillTree.js';
import { cooldownLeft } from '../engine/systems/cooldowns.js';
import { AbilityInfo } from './SpiritDraft.jsx';

// 🪦 THE Db HEADER AND THE "⬆ UPGRADES · SOON" BUTTON ARE GONE (2026-10-02).
// Db was cut and the upgrade shop with it (Alex: "the cooldowns and 'sacrifices'
// are the gate"), so the wallet is now just the seat's two drafted abilities and
// how long each has left to recharge. ⚠️ A removal only — every surviving row is
// styled exactly as before; anything NEW here goes through a `.scratch` preview.
export function AbilityWallet({ ns = {} }) {
  const [info, setInfo] = useState(null);
  return <div data-tip-anchor="ability-wallet" style={{padding:'8px 0'}}>
    <div style={{display:'grid',gap:5}}>{(ns.unlockedSkills ?? []).map(id=>{
      const skill = SKILL_BY_ID[id]; if(!skill) return null;
      const cd = cooldownLeft(ns,id);
      return <div key={id} style={{display:'flex',alignItems:'center',gap:5,fontSize:9,color:'#c9d6eb',padding:'5px 0'}}>
        <span>{skill.icon}</span><span style={{flex:1}}>{skill.label}</span>
        <span style={{color:cd?'#efb381':'#91eab9'}}>{cd?`${cd} rounds`:'READY'}</span>
        <button className="draft-info-button" style={{width:20,height:20,fontSize:12}} aria-label={`About ${skill.label}`} onClick={()=>setInfo(skill)}>i</button>
      </div>;
    })}</div>
    {info && <AbilityInfo skill={info} onClose={()=>setInfo(null)}/>}
  </div>;
}
