// Approved arena-storm camera dial-in, 2026-09-24. Pure presentation only.
// Layer idle travel over the existing action director; action/battle shots retain priority.
// ⏱️ idleMs matches CAMERA_DIRECTOR.resumeAfterMs: 10 s of no input (Alex, 2026-09-25; was 6.5 s).
export const IDLE_FLOW = Object.freeze({speed:1.2,sway:1.3,idleMs:10000});
export function createIdleFlow() {
  let lastActivity=null,phase=0,anchor=null,blend=0;
  const activity=now=>{lastActivity=now;anchor=null;blend=0;};
  return {
    activity,
    update({shot,camera,now,dtMs,center={x:0,y:-3,z:0},scale=1,reduced=false}) {
      if(lastActivity===null)lastActivity=now;
      const action=shot && ['battle','move','event'].includes(shot.shot);
      if(action)activity(now);
      if(reduced||!shot?.driving||action||now-lastActivity<IDLE_FLOW.idleMs) {
        anchor=null;blend=0;return shot;
      }
      const dt=Math.max(0,Math.min(dtMs,100))/1000;
      const range=IDLE_FLOW.sway;
      const wander=p=>Math.sin(p*.13)*.32*range+Math.sin(p*.047)*.23*range;
      if(anchor===null)anchor=Math.atan2(camera.position.x-camera.target.x,camera.position.z-camera.target.z)-phase*.025-wander(phase);
      phase+=dt*IDLE_FLOW.speed;blend=Math.min(1,blend+dt/4);
      const az=anchor+phase*.025+wander(phase);
      const pol=Math.min(Math.PI*.43,1.17+Math.sin(phase*.11+.4)*.14*range);
      const r=Math.min(110,(49+Math.sin(phase*.083)*5*range)*scale);
      const target={x:center.x+Math.sin(phase*.071)*2.6*range,y:center.y+Math.sin(phase*.09)*1.3,z:center.z+Math.sin(phase*.053+1)*2*range};
      const position={x:target.x+r*Math.sin(pol)*Math.sin(az),y:target.y+r*Math.cos(pol),z:target.z+r*Math.sin(pol)*Math.cos(az)};
      const amount=(1-Math.exp(-dt*.32))*blend;
      const mix=(a,b)=>Object.fromEntries(['x','y','z'].map(k=>[k,a[k]+(b[k]-a[k])*amount]));
      return {...shot,shot:'idle-flow',position:mix(camera.position,position),target:mix(camera.target,target)};
    },
  };
}
