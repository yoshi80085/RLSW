import * as THREE from 'three';
import { smooth, clamp } from './timeline.js';

// The original generated asset stays intact. This material reveals its bright
// filaments and preserves source alpha, so sky shows THROUGH the whole figure.
export function createBardbarian(textureLoader = new THREE.TextureLoader()) {
  const group = new THREE.Group(); group.name = 'Bardbarian — outline in the storm';
  group.position.set(0, 0, -23);
  const texture = textureLoader.load(new URL('./bardbarian-spectral.png', import.meta.url).href);
  texture.colorSpace = THREE.SRGBColorSpace;
  const apparition = new THREE.Mesh(new THREE.PlaneGeometry(54, 36), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { art: { value: texture }, time: { value: 0 }, strength: { value: 0 }, detail: { value: .44 } },
    vertexShader: 'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 p;uniform sampler2D art;uniform float time,strength,detail;
      void main(){vec4 ink=texture2D(art,p);float light=max(ink.r,max(ink.g,ink.b));
        float filament=smoothstep(detail,detail+.29,light);
        float drift=.91+.09*sin(p.x*37.+p.y*23.+time*1.1);
        float fade=smoothstep(.02,.22,p.y);
        gl_FragColor=vec4(mix(vec3(.25,.12,.62),vec3(.63,.52,.95),filament),ink.a*filament*strength*drift*fade);}`,
  }));
  apparition.position.y = 14.5; group.add(apparition);
  // A transparent, irregular storm field around the figure. Soft edges keep it
  // in the existing nebula instead of revealing the rectangular support plane.
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(78, 49), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, amount: { value: 1 }, presence: { value: 1 }, flash: { value: 0 } },
    vertexShader: 'varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 uvp;uniform float time,amount,presence,flash;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
      float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=mat2(.8,-.6,.6,.8)*p*2.07+13.7;a*=.5;}return v;}
      void main(){vec2 p=(uvp-.5)*vec2(1.6,1.);float r=length(p);float an=atan(p.y,p.x);
        vec2 q=vec2(cos(an-r*3.+time*.07),sin(an-r*3.+time*.07))*r*5.;
        float f=fb(q+vec2(time*.018,-time*.025));float wisps=fb(q*2.8+f*3.7);
        float edge=1.-smoothstep(.24,.85,r);float veil=pow(f,2.)*smoothstep(.22,.8,wisps)*edge;
        vec3 c=mix(vec3(.13,.045,.29),vec3(.13,.2,.4),f)*(.7+flash*1.8);
        gl_FragColor=vec4(c,veil*amount*presence*.65);}`,
  }));
  clouds.position.set(0, 14, -.5); group.add(clouds);
  // Fixed topology: playback changes visibility, never allocates bolt meshes.
  const bolts = [];
  for (let b = 0; b < 14; b++) {
    const pts = [], side = b % 2 ? 1 : -1;
    const cx = side * (7 + b % 4 * 4), cy = 11 + b % 5 * 3.4;
    for (let k = 0; k < 13; k++) {
      const a = b * 1.7 + k * .12;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * k * .37 + Math.sin(k * 4.3 + b) * .55,
        cy - k * .62 + Math.cos(k * 3.1 + b) * .45, .3));
    }
    const material = new THREE.LineBasicMaterial({ color: '#c4c8ff', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material); group.add(mesh); bolts.push(mesh);
    const branch = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pts[4], pts[4].clone().add(new THREE.Vector3(side * 2, -1, 0)), pts[4].clone().add(new THREE.Vector3(side * 2.8, -3, 0))]), material); group.add(branch);
  }
  return { group,
    update(t, s, end) {
      const envelope = smooth((t - .25) / 2) * (1 - smooth((t - end + 2.3) / 3.2));
      group.visible = envelope > .001; group.scale.setScalar(s.godScale);
      apparition.material.uniforms.time.value = s.reduced ? 0 : t;
      apparition.material.uniforms.strength.value = envelope * s.presence;
      apparition.material.uniforms.detail.value = s.detail;
      let flash = 0;
      bolts.forEach((bolt, i) => {
        const phase = ((t - 1.1 - i * .23) % 4.7 + 4.7) % 4.7;
        const pulse = s.reduced ? 0 : Math.pow(clamp(1 - Math.abs(phase - .25) / .25), 2) * envelope * s.storm;
        bolt.material.opacity = pulse * .65; flash = Math.max(flash, pulse);
      });
      clouds.material.uniforms.time.value = s.reduced ? 0 : t;
      clouds.material.uniforms.amount.value = s.storm;
      clouds.material.uniforms.presence.value = envelope;
      clouds.material.uniforms.flash.value = flash;
      return envelope;
    },
    dispose() {
      texture.dispose(); const materials = new Set();
      group.traverse(o => { o.geometry?.dispose(); if (o.material) materials.add(o.material); });
      materials.forEach(m => m.dispose()); group.removeFromParent();
    },
  };
}
