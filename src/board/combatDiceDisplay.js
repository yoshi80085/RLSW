import * as THREE from 'three';
import {createCombatDie} from './combatDice.js';

function trayLabel(text,color,width,height,{border=false}={}){
 const canvas=globalThis.document?.createElement?.('canvas');let ctx;
 try{if(canvas){canvas.width=Math.round(width*150);canvas.height=Math.round(height*150);ctx=canvas.getContext('2d');}}catch{/* headless */}
 let texture=null;
 if(ctx){
  const w=canvas.width,h=canvas.height;ctx.fillStyle='#091625e8';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(3,3,w-6,h-6,12);else ctx.rect(3,3,w-6,h-6);ctx.fill();
  if(border){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();}
  ctx.font=`bold ${Math.round(h*.58)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,w/2,h/2,w-20);
  texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 }
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:texture?'#ffffff':color,transparent:true,depthTest:false,toneMapped:false}));sprite.scale.set(width,height,1);sprite.userData.text=text;return {sprite,texture};
}

// A separate 3D results tray keeps the readable roll independent of arena cuts.
export function createCombatDiceDisplay({drive=[],sustain=[],driveSides=6,sustainSides=6}={}){
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-10,10,6,-6,.1,100);camera.position.set(0,0,20);
 const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:'#07101c',transparent:true,opacity:.92}));backdrop.position.z=-3;scene.add(backdrop);
 scene.add(new THREE.HemisphereLight('#e4f3ff','#21334f',2.3));const key=new THREE.DirectionalLight('#ffffff',3);key.position.set(-4,7,8);scene.add(key);
 const trays=[],resources=[],dice=[];
 // Match the game's Drive/Sustain readout rather than the Spirit's identity color.
 for(const [title,values,sides,color] of [['DRIVE',drive,driveSides,'#ff6644'],['SUSTAIN',sustain,sustainSides,'#44aaff']]){
  const root=new THREE.Group();scene.add(root);
  const header=trayLabel(`${title} · ${values.length}d${sides}`,color,5.6,.58,{border:true});root.add(header.sprite);resources.push(header);
  const total=trayLabel(title==='DRIVE'?`${values.reduce((n,v)=>n+v,0)} TOTAL STRENGTH`:`${values.reduce((n,v)=>n+v,0)} SHIELD HP`,color,5.8,.52);root.add(total.sprite);resources.push(total);
  const entries=values.map((value,i)=>{
   const die=createCombatDie({value,sides,color,seed:i+(title==='SUSTAIN'?13:0)});root.add(die.group);dice.push(die);
   const index=trayLabel(`#${i+1}`,color,.65,.22);root.add(index.sprite);resources.push(index);return {die,index};
  });
  trays.push({root,entries,header,total});
 }
 let disposed=false;
 function render(renderer,{width,height,progress=1,visible=true,reduced=false}={}){
  if(disposed||!visible)return;
  const aspect=width/height,stacked=aspect<1.45,columns=6,spacing=1.14;
  const heights=trays.map(t=>Math.max(1,Math.ceil(t.entries.length/columns))*1.4+1.7);
  const neededWidth=stacked?7.8:15.5,neededHeight=stacked?heights[0]+heights[1]+.5:Math.max(...heights)+.4;
  // Reserve room above even the largest pool for the playback caption.
  const worldHeight=Math.max(neededHeight+1.5,neededWidth/aspect),worldWidth=worldHeight*aspect;
  backdrop.scale.set(worldWidth,worldHeight,1);backdrop.position.y=.65;
  camera.left=-worldWidth/2;camera.right=worldWidth/2;camera.top=worldHeight/2+.65;camera.bottom=-worldHeight/2+.65;camera.updateProjectionMatrix();
  trays.forEach((tray,t)=>{
   const rows=Math.max(1,Math.ceil(tray.entries.length/columns)),h=heights[t];
   tray.root.position.set(stacked?0:t===0?-3.9:3.9,stacked?(t===0?(heights[1]+.5)/2:-(heights[0]+.5)/2):0,0);
   tray.header.sprite.position.set(0,h/2-.35,0);tray.total.sprite.position.set(0,-h/2+.3,0);
   tray.entries.forEach(({die,index},i)=>{
    const row=Math.floor(i/columns),count=Math.min(columns,tray.entries.length-row*columns),x=(i%columns-(count-1)/2)*spacing,y=(rows-1)/2*1.4-row*1.4;
    die.group.position.set(x,y+(!reduced&&progress<1?Math.abs(Math.sin(progress*Math.PI*3+i*.3))*(1-progress)*.35:0),0);
    die.update(progress,{reduced});index.sprite.position.set(x,y-.62,0);
   });
   tray.total.sprite.visible=progress>=1;
  });
  const auto=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,camera);renderer.autoClear=auto;
 }
 function dispose(){if(disposed)return;disposed=true;for(const die of dice)die.dispose();for(const label of resources){label.texture?.dispose();label.sprite.material.dispose();}backdrop.geometry.dispose();backdrop.material.dispose();scene.clear();}
 return {render,dispose,dice};
}
