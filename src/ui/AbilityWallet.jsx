import { useState } from 'react';
import { SKILL_BY_ID } from '../data/skillTree.js';
import { cooldownLeft } from '../engine/systems/cooldowns.js';
import { AbilityInfo } from './SpiritDraft.jsx';

export function AbilityWallet({ ns = {} }) {
  const [info, setInfo] = useState(null);
  const db = ns.dbPoints ?? 0;
  return <div data-tip-anchor="db-bar" style={{padding:'8px 0'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
      <span style={{color:'#ffd38a',fontSize:13,fontWeight:700}}>{db} <small>Db</small></span>
      <button disabled title="Skill upgrades — coming soon" aria-label="Skill upgrades, coming soon"
        style={{fontFamily:'inherit',fontSize:9,letterSpacing:.6,padding:'7px 9px',borderRadius:6,
          color:'#b0bfd5',border:'1px solid #53627c',background:'linear-gradient(#29354b,#151e2f)',cursor:'not-allowed'}}>
        ⬆ UPGRADES <span style={{fontSize:7,opacity:.7}}>SOON</span>
      </button>
    </div>
    <div style={{display:'grid',gap:5,marginTop:9}}>{(ns.unlockedSkills ?? []).map(id=>{
      const skill = SKILL_BY_ID[id]; if(!skill) return null;
      const cd = cooldownLeft(ns,id);
      return <div key={id} style={{display:'flex',alignItems:'center',gap:5,fontSize:9,color:'#c9d6eb',padding:'5px 0'}}>
        <span>{skill.icon}</span><span style={{flex:1}}>{skill.label}</span>
        <span style={{color:cd?'#efb381':db>=5?'#91eab9':'#a7b2c7'}}>{cd?`${cd} rounds`:db>=5?'5 Db · READY':`${db}/5 Db`}</span>
        <button className="draft-info-button" style={{width:20,height:20,fontSize:12}} aria-label={`About ${skill.label}`} onClick={()=>setInfo(skill)}>i</button>
      </div>;
    })}</div>
    {info && <AbilityInfo skill={info} onClose={()=>setInfo(null)}/>}
  </div>;
}
