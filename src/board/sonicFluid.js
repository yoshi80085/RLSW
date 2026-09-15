// A small incompressible 2D velocity field, mapped onto the 3D note trails.
// Semi-Lagrangian advection and a pressure projection provide real eddies;
// this is presentation only, never collision, dice or combat state.
export function createSonicFluid(size=24) {
  const n=size,total=n*n;
  let u=new Float32Array(total),v=new Float32Array(total),time=0;
  const pressure=new Float32Array(total),nextP=new Float32Array(total),div=new Float32Array(total);
  const index=(x,y)=>((y+n)%n)*n+(x+n)%n;
  function sampleField(field,x,y) {
    x=((x%n)+n)%n;y=((y%n)+n)%n;
    const ix=Math.floor(x),iy=Math.floor(y),a=x-ix,b=y-iy;
    return (field[index(ix,iy)]*(1-a)+field[index(ix+1,iy)]*a)*(1-b)
      +(field[index(ix,iy+1)]*(1-a)+field[index(ix+1,iy+1)]*a)*b;
  }
  function step(dt) {
    time+=dt;
    // Opposing vortices inject the amp's pulse into a continuous flow.
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const k=index(x,y);
      for(let j=0;j<3;j++) {
        const dx=x/n-(.2+j*.3),dy=y/n-(.5+Math.sin(time*1.7+j*2)*.18);
        const force=Math.exp(-(dx*dx+dy*dy)*65)*(j%2?-1:1)*dt*2.8;
        u[k]-=dy*force;v[k]+=dx*force;
      }
    }
    const nextU=new Float32Array(total),nextV=new Float32Array(total);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const k=index(x,y),px=x-dt*n*u[k],py=y-dt*n*v[k];
      nextU[k]=sampleField(u,px,py)*.992;nextV[k]=sampleField(v,px,py)*.992;
    }
    u=nextU;v=nextV;pressure.fill(0);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)div[index(x,y)]=-.5*(u[index(x+1,y)]-u[index(x-1,y)]+v[index(x,y+1)]-v[index(x,y-1)])/n;
    for(let iter=0;iter<14;iter++) {
      for(let y=0;y<n;y++)for(let x=0;x<n;x++)nextP[index(x,y)]=(div[index(x,y)]+pressure[index(x+1,y)]+pressure[index(x-1,y)]+pressure[index(x,y+1)]+pressure[index(x,y-1)])*.25;
      pressure.set(nextP);
    }
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const k=index(x,y);
      u[k]-=.5*n*(pressure[index(x+1,y)]-pressure[index(x-1,y)]);
      v[k]-=.5*n*(pressure[index(x,y+1)]-pressure[index(x,y-1)]);
    }
  }
  // A fixed visual clock makes refresh rate irrelevant; seeking back resets it.
  function update(elapsed) {
    const target=Math.max(0,Math.min(12,elapsed));
    if(target<time){u.fill(0);v.fill(0);time=0;}
    while(time+1/30<=target)step(1/30);
  }
  return {update,sample:(x,y)=>({x:sampleField(u,x*n,y*n),y:sampleField(v,x*n,y*n)})};
}
