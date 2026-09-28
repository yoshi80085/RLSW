import * as THREE from 'three';

export function createNebula(){
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{intensity:{value:1},time:{value:0},cloudTime:{value:0},breath:{value:.10},breathPeriod:{value:12},puffiness:{value:.25}},
    vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 v;uniform float intensity;uniform float time;uniform float cloudTime;uniform float breath;uniform float breathPeriod;uniform float puffiness;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*noise(p);p=p*2.07+vec3(11.7,4.1,7.3);a*=.5;}return f;}
      void main(){vec3 p=normalize(v);float t=cloudTime;
        vec3 q=p*3.3+vec3(t*.001,t*.0015,0);
        // Small spatially varying currents bend neighboring wisps differently.
        // Subtract the initial phase so enabling motion preserves the starting sky.
        vec3 phase=vec3(q.y*1.3+q.z*.7,q.z*1.1-q.x*.6,q.x*1.2+q.y*.5);
        vec3 current=(sin(phase+vec3(t*.16,t*.13,-t*.11))-sin(phase))*.045;
        q+=current;
        // Different flows through the noise fields slowly reshape the clouds,
        // rather than simply translating a fixed texture across the background.
        vec3 warp=vec3(fbm(q+3.+vec3(t*.004,0,-t*.002)),fbm(q+19.+vec3(0,-t*.003,t*.002)),fbm(q-8.+vec3(-t*.002,t*.003,0)));
        float band=exp(-pow((p.y+.12+sin(p.x*3.+p.z*2.)*.24)*1.65,2.));
        // Broad, feathered gas envelopes carry stretched turbulent threads.
        // Independently drifting veils overlap optically instead of filling a
        // thresholded cloud with opaque color, which read as a solid surface.
        float envelope=pow(smoothstep(.22,.76,fbm(q*.85+warp*1.4)),mix(1.8,1.4,puffiness))*band;
        vec3 curl=q+warp*mix(2.2,1.4,puffiness);
        float flow=fbm(curl*mix(vec3(2.1,7.5,2.8),vec3(2.7,2.9,2.7),puffiness)+vec3(t*.004,-t*.002,0));
        float wisps=pow(max(0.,1.-abs(flow-.51)*4.2),4.);
        float breakup=smoothstep(.26,.72,fbm(q*3.8+warp*3.+vec3(0,t*.005,-t*.003)));
        float billows=pow(smoothstep(.25,.76,flow),1.25);
        float nearGas=envelope*mix(.08+wisps*breakup*.95,.14+billows*.85,puffiness);
        vec3 back=q*vec3(1.7,4.1,2.3)-warp*.8+vec3(23.-t*.002,-t*.001,11.);
        float farGas=pow(smoothstep(.24,.78,fbm(back)),2.5)*band*mix(.20,.35,puffiness);
        float dust=fbm(curl*2.+17.);
        nearGas*=1.-smoothstep(.38,.73,dust)*.78;
        float nearAlpha=1.-exp(-nearGas*1.65),farAlpha=1.-exp(-farGas*1.2);
        vec3 hue=mix(vec3(.046,.006,.14),vec3(.16,.013,.11),smoothstep(.30,.70,warp.z));
        // A smooth twelve-second inhale/exhale, confined to the cloud emission.
        // Keep the void steady; the brighter filaments breathe a little more.
        float pulse=sin(time*6.2831853/max(1.,breathPeriod));
        vec3 voidColor=vec3(.0015,.0008,.005);
        vec3 farGlow=vec3(.065,.009,.14)*farAlpha;
        vec3 gasGlow=hue*nearAlpha+vec3(.14,.045,.17)*nearGas*wisps*.24;
        vec3 c=voidColor+intensity*(farGlow*(1.-nearAlpha*.4)*(1.+breath*pulse)+gasGlow*(1.+breath*1.5*pulse));
        gl_FragColor=vec4(c,1.);
      }`
  });const mesh=new THREE.Mesh(new THREE.SphereGeometry(185,32,20),material);mesh.name='Storm nebula';return mesh;
}
