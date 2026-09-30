import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMOKE_LOOK as DEFAULTS } from './smokePresentation.js';

function noiseTexture() {
  const size=64,data=new Uint8Array(size**3);
  const hash=(x,y,z)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  const value=(x,y,z,period)=>{
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    const smooth=t=>t*t*(3-2*t),fx=smooth(x-ix),fy=smooth(y-iy),fz=smooth(z-iz);
    const h=(a,b,c)=>hash((ix+a)%period,(iy+b)%period,(iz+c)%period);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(0,0,0),h(1,0,0),fx),THREE.MathUtils.lerp(h(0,1,0),h(1,1,0),fx),fy),THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(0,0,1),h(1,0,1),fx),THREE.MathUtils.lerp(h(0,1,1),h(1,1,1),fx),fy),fz);
  };
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let n=0;for(const [freq,weight] of [[4,.62],[8,.27],[16,.11]])n+=value(x/size*freq,y/size*freq,z/size*freq,freq)*weight;
    data[x+size*(y+size*z)]=Math.round(n*255);
  }
  const texture=new THREE.Data3DTexture(data,size,size,size);
  texture.format=THREE.RedFormat;texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.wrapS=texture.wrapT=texture.wrapR=THREE.RepeatWrapping;texture.unpackAlignment=1;texture.needsUpdate=true;
  return texture;
}

export function createSmokePass(depthTexture,camera) {
  const noise=noiseTexture();
  const uniforms={tDiffuse:{value:null},sceneDepth:{value:depthTexture},volumeNoise:{value:noise},
    inverseProjection:{value:camera.projectionMatrixInverse},cameraWorld:{value:camera.matrixWorld},
    time:{value:0},density:{value:DEFAULTS.density},height:{value:DEFAULTS.height},spread:{value:DEFAULTS.spread},
    billow:{value:1},turbulence:{value:.8},softness:{value:.8},lighting:{value:1.15},
    smokeColor:{value:new THREE.Color(DEFAULTS.color)},amount:{value:1},expansion:{value:1},
    erosion:{value:0},lift:{value:0},emission:{value:0}};
  const material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms,depthTest:false,depthWrite:false,blending:THREE.NoBlending,
    vertexShader:'out vec2 screenUV; void main(){screenUV=uv; gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`precision highp sampler3D;
      in vec2 screenUV; out vec4 result;
      uniform sampler2D tDiffuse,sceneDepth;
      uniform sampler3D volumeNoise;
      uniform mat4 inverseProjection,cameraWorld;
      uniform float time,density,height,spread,billow,turbulence,softness,lighting,amount,expansion,erosion,lift,emission;
      uniform vec3 smokeColor;
      float field(vec3 p){
        float h=(p.y-.24-lift)/height;
        float radius=spread*expansion;
        vec3 flow=vec3(time*.009,-time*.016,time*.005);
        vec3 q=p/(9.*billow)+flow;
        q+=sin(p.zxy*.57+vec3(time*.27,time*.22,-time*.24))*.055*turbulence;
        float a=texture(volumeNoise,q).r;
        float b=texture(volumeNoise,q*2.7+vec3(.31,.17,-time*.013)).r;
        float ceiling=mix(.46,1.,smoothstep(.30,.68,texture(volumeNoise,vec3(q.x,.28,q.z)*.75).r));
        float edge=1.-smoothstep(max(0.,radius-softness*2.2),radius,length(p.xz)+(a-.5)*2.);
        edge*=1.-smoothstep(max(0.,radius-.35),radius,length(p.xz));
        float loft=smoothstep(0.,.065,h)*(1.-smoothstep(ceiling*.45,ceiling,h));
        float wisps=pow(smoothstep(.36+erosion*.19,.64+erosion*.13,a*.70+b*.30),1.6)*loft*edge*3.;
        float jet=exp(-dot(p.xz,p.xz)/( .22+max(0.,p.y)*.7))*exp(-max(0.,p.y-.24)*1.1)*emission*edge;
        return wisps+jet*.9;
      }
      // The foreground texture is linear premultiplied RGBA. Tone-map straight
      // color, then premultiply again for the transparent canvas above CSS3D.
      vec4 finish(vec4 c){
        if(c.a<.00001)return vec4(0.);
        c.rgb/=c.a;
        #ifdef TONE_MAPPING
          c.rgb=toneMapping(c.rgb);
        #endif
        c=linearToOutputTexel(c);
        c.rgb*=c.a;
        return c;
      }
      void main(){
        vec4 base=texture(tDiffuse,screenUV);
        if(amount<.001||density==0.){result=finish(base);return;}
        vec2 ndc=screenUV*2.-1.;
        vec4 farPoint=inverseProjection*vec4(ndc,1.,1.);
        vec3 viewDir=normalize(farPoint.xyz/farPoint.w);
        vec3 rd=normalize(mat3(cameraWorld)*viewDir),ro=cameraWorld[3].xyz;
        // Stop each ray at the actual opaque stage/amp surface, not a flat overlay.
        float depth=texture(sceneDepth,screenUV).r;
        vec4 surface=inverseProjection*vec4(ndc,depth*2.-1.,1.);
        float sceneDistance=length(surface.xyz/surface.w);
        float radius=spread*expansion;
        vec3 safeDir=sign(rd+vec3(.0000001))*max(abs(rd),vec3(.000001));
        vec3 a=(vec3(-radius,.24,-radius)-ro)/safeDir;
        vec3 b=(vec3(radius,.24+height+lift,radius)-ro)/safeDir;
        vec3 nearT=min(a,b),farT=max(a,b);
        float begin=max(0.,max(nearT.x,max(nearT.y,nearT.z)));
        float end=min(sceneDistance,min(farT.x,min(farT.y,farT.z)));
        if(end<=begin){result=finish(base);return;}
        float stepSize=(end-begin)/48.;
        float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        float transmittance=1.;vec3 smoke=vec3(0.);
        for(int i=0;i<48;i++){
          vec3 p=ro+rd*(begin+(float(i)+jitter)*stepSize);
          float d=field(p);
          float alpha=1.-exp(-d*density*amount*stepSize*.52);
          if(alpha>.001){
            float shade=exp(-(field(p+vec3(-.4,.6,.3))+field(p+vec3(-.8,1.2,.6)))*1.1);
            float h=clamp((p.y-.24)/height,0.,1.);
            vec3 tint=mix(vec3(.61,.79,1.),vec3(1.,.70,.86),smoothstep(-spread,spread,p.x));
            vec3 light=smokeColor*(.14+shade*.72+h*.12)*lighting*tint;
            smoke+=transmittance*alpha*light;
            transmittance*=1.-alpha;
          }
          if(transmittance<.015)break;
        }
        result=finish(vec4(base.rgb*transmittance+smoke,1.-(1.-base.a)*transmittance));
      }`});
  const pass=new ShaderPass(material);
  return {pass,uniforms,update(settings,time,envelope={opacity:1,spread:1}){
    for(const key of ['density','height','spread','billow','turbulence','softness','lighting'])uniforms[key].value=settings[key];
    uniforms.smokeColor.value.set(settings.color);uniforms.time.value=time;
    uniforms.amount.value=envelope.opacity;uniforms.expansion.value=envelope.spread;
    uniforms.erosion.value=envelope.erosion??0;uniforms.lift.value=envelope.lift??0;uniforms.emission.value=envelope.emission??0;
  },dispose(){noise.dispose();pass.dispose();}};
}
