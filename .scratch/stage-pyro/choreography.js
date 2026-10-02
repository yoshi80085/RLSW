import { ALL_HEXES } from '../../src/board/hexMap.js';
export const DURATION = 26;
export const PAWNS = [38, 57, 85];
export const DEFAULTS = Object.freeze({preset:'arena',palette:'gold',height:7,width:1,burst:3.6,density:1,stagger:.18,glow:.7,speed:1,mortars:true,cannons:true,fireworks:true,curtain:true,bloom:true,guides:true,seed:17});
export const SLIDERS = [['height','Cannon height',3,12,.5],['width','Flame fullness',.5,1.8,.1],['burst','Firework spread',1.5,6,.1],['density','Spark density',.4,1.8,.1],['stagger','Salvo spacing',.05,.35,.01],['glow','Bloom strength',0,1.5,.05]];
export const PRESETS = {arena:{height:7,width:1,burst:3.6,density:1,stagger:.18,glow:.7},stadium:{height:10,width:1.4,burst:5,density:1.5,stagger:.11,glow:.95},precision:{height:5,width:.7,burst:2.6,density:.7,stagger:.28,glow:.45}};
export const smooth = x => { x=Math.max(0,Math.min(1,x));return x*x*(3-2*x); };
export const hash = n => { const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v); };
export function layouts(seed){return ALL_HEXES.filter(h=>!PAWNS.includes(h.num)&&h.num!==56&&!h.edge).sort((a,b)=>hash(a.num+seed*113)-hash(b.num+seed*113)).slice(0,13).map(h=>h.num);}
export function waveAt(t){return t<10.5?0:1;}
export function phaseAt(t){
 if(t<1)return ['STANDBY','The quiet before it hits.','BEFORE THE CUE'];
 if(t<3.5)return ['Steel wakes up','Six petals unlock. Blackened barrels rise from the floor.','WAVE 01 · FIVE MORTARS'];
 if(t<5)return ['Armed & glowing','Orange hex outlines warn where the floor will erupt.','WAVE 01 · FIVE MORTARS'];
 if(t<6.8)return ['Fire the mortars','Recoil, white-hot exhaust, and incandescent comets.','WAVE 01 · IGNITION'];
 if(t<10.5)return ['The sky breaks open','Gold crowns overhead. Furnace hexes burn below.','WAVE 01 · AFTERBURN'];
 if(t<14.5)return ['Reload for excess','The first wave retracts. Eight fresh mortars lock into place.','WAVE 02 · EIGHT MORTARS'];
 if(t<18.5)return ['Everything fires','A rolling salvo, full-height cannons, and a ceiling of sparks.','THE FINALE'];
 if(t<23)return ['Let it burn out','Falling embers and cooling steel carry the last beat.','THE AFTERGLOW'];
 return ['Stage clear','Hatches close. The next song can begin.','END OF SHOW'];
}
