// Preserve the selected rock pigment while grading reflected light toward the nebula.
export function applyRockLook(material) {
  const original=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    original.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 rockWorldNormal=inverseTransformDirection(normal,viewMatrix);
      float nebulaSide=smoothstep(-.8,.8,rockWorldNormal.x*.7+rockWorldNormal.z*.5);
      vec3 reflectedHue=mix(vec3(.67,.30,1.),vec3(1.,.32,.68),nebulaSide);
      vec3 luminanceWeights=vec3(.2126,.7152,.0722);
      float rockLight=dot(totalDiffuse,luminanceWeights);
      float pigmentLight=max(dot(diffuseColor.rgb,luminanceWeights),.0001);
      float nebulaSpecular=dot(totalSpecular,luminanceWeights);
      outgoingLight=diffuseColor.rgb*(rockLight/pigmentLight)*.88
        + reflectedHue*(rockLight*.12+nebulaSpecular)+totalEmissiveRadiance;
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>cacheKey+':nebula-rock-v2';
  material.color.set('#263a60').multiplyScalar(.6);
  return material;
}
