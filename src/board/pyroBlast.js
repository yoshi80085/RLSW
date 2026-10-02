// ─── 🔥 PYRO BLAST — the hit's own fire: flash, shock rings, smoke, debris, scorch ─
// Ported 2026-10-02 from `.scratch/pyro-shove/blastFx.js` (the page now imports
// THIS file), verbatim but for a headless guard on the canvas textures.
// Every effect is a pure function of the reaction's age: `update` recomputes
// every particle from a hash of its index, so scrubbing, hit-stop and slow
// motion can never leave anything behind.
//
// ⭐ IN THE GAME IT RUNS IN ASTRA MODE (`astra:true`, `PYRO_SHOVE.fxSource`):
// her mortar (`pyroMortars.js`) draws the hatch, the flame and the shell, and
// this file adds only what hers has no answer for — the flash and its light,
// the shock rings, the smoke, the debris, the dust at every touchdown, the
// scorch on the deck and the flames licking the standee. The page's "Mine"
// fire (the hatch, column, fireball, sparks, shell and crown below) is kept so
// the page can still compare; the game never shows it.
// ⚠️ The scorch decal and the licking flames are a DISPLAY-ONLY stand-in for
// the Burn status: what Burn does is the engine's `BURN_TICKED`.
import * as THREE from 'three';
import { hash, timeline } from './pyroShove.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
const easeOut = u => 1 - (1 - u) * (1 - u);
const DECK = 0.2;

function radial(stops) {
  // ⚠️ Headless (the suites, a server) has no canvas: the sprites simply draw
  // untextured, which is invisible at opacity 0 and never reaches a screen.
  const c = globalThis.document?.createElement?.('canvas'); if (!c) return null;
  let g0 = null; try { g0 = c.getContext('2d'); } catch { /* jsdom without canvas */ }
  if (!g0) return null;
  c.width = c.height = 128;
  const g = g0, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let TEX = null;
const tex = () => TEX ??= {
  glow: radial([[0, '#ffffff'], [0.25, '#fff4d8cc'], [0.6, '#ffb04c55'], [1, '#ff802000']]),
  smoke: radial([[0, '#ffffffee'], [0.5, '#ffffff77'], [1, '#ffffff00']]),
  dot: radial([[0, '#fff'], [0.4, '#fffa'], [1, '#fff0']]),
  scorch: radial([[0, '#000000e6'], [0.55, '#0a0604cc'], [0.82, '#3a1407aa'], [1, '#00000000']]),
};
const additive = (color, map = null) => new THREE.MeshBasicMaterial({ color, map, transparent:true, opacity:0, depthWrite:false,
  blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });

// ── the mortar hatch (also used for the four unfired mortars) ───────────────
export function createMortar() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.72, 0.08, 6).rotateY(Math.PI / 6),
    new THREE.MeshStandardMaterial({ color:0x15171d, metalness:0.85, roughness:0.38 }));
  base.position.y = DECK + 0.02; group.add(base);
  const ringMat = new THREE.MeshBasicMaterial({ color:0xff7a1f, toneMapped:false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.045, 8, 36).rotateX(Math.PI / 2), ringMat);
  ring.position.y = DECK + 0.07; group.add(ring);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), additive(0xff8a2a));
  core.position.y = DECK + 0.075; group.add(core);
  // six petals that fold back when it fires
  const tri = new THREE.Shape(); tri.moveTo(-0.34, 0); tri.lineTo(0.34, 0); tri.lineTo(0, -0.58); tri.closePath();
  const petalGeo = new THREE.ExtrudeGeometry(tri, { depth:0.035, bevelEnabled:false });
  const petalMat = new THREE.MeshStandardMaterial({ color:0x24262e, metalness:0.9, roughness:0.32, emissive:0x2a0c00 });
  const petals = [];
  for (let k = 0; k < 6; k++) {
    const hinge = new THREE.Group(), a = (k * Math.PI) / 3;
    hinge.position.set(Math.cos(a) * 0.6, DECK + 0.1, Math.sin(a) * 0.6); hinge.rotation.y = -a - Math.PI / 2;
    const p = new THREE.Mesh(petalGeo, petalMat); p.rotation.x = Math.PI / 2; hinge.add(p);
    group.add(hinge); petals.push(hinge);
  }
  return {
    group,
    /** glow 0…4 (1 = armed), plate 0…1 (pressed), open 0…1 (petals folded back). */
    set({ glow = 1, plate = 0, open = 0 }) {
      const k = Math.max(0, glow);
      ringMat.color.setRGB(1 * (0.45 + k * 0.7), 0.42 * (0.4 + k * 0.5) + Math.max(0, k - 1.4) * 0.35, 0.12 + Math.max(0, k - 2) * 0.4);
      core.material.opacity = Math.min(1, 0.12 + k * 0.28);
      base.position.y = DECK + 0.02 - 0.03 * plate;
      for (const h of petals) h.rotation.x = -open * 1.25;
    },
  };
}

// ── the flame column ─────────────────────────────────────────────────────────
const columnMat = () => new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, toneMapped:false,
  uniforms:{ uAge:{ value:0 }, uA:{ value:0 } },
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`varying vec2 vUv; uniform float uAge; uniform float uA;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    void main(){
      float y=vUv.y;
      float t=n(vec2(vUv.x*9.0, y*3.2-uAge*9.0))*0.6 + n(vec2(vUv.x*18.0+4.0, y*6.0-uAge*14.0))*0.4;
      float a=pow(1.0-y,1.15)*smoothstep(0.0,0.35,t+0.35-y*0.35)*uA;
      vec3 c=mix(vec3(1.0,0.97,0.78), vec3(1.0,0.55,0.12), smoothstep(0.0,0.45,y));
      c=mix(c, vec3(0.55,0.08,0.02), smoothstep(0.4,1.0,y));
      gl_FragColor=vec4(c*a*1.6, a);
    }`,
});

/** One lane's worth of fire, parented to `parent` and placed on the mortar hex. */
export function createBlastFx(parent) {
  const T = tex();
  const root = new THREE.Group(); parent.add(root);

  const mortar = createMortar(); root.add(mortar.group);
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(1.55, 36).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map:T.scorch, transparent:true, opacity:0, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2 }));
  scorch.position.y = DECK + 0.012; root.add(scorch);

  const light = new THREE.PointLight(0xffb060, 0, 16, 2); light.position.set(0, 1.4, 0); root.add(light);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map:T.glow, color:0xffd9a0, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
  flash.position.y = 1.1; root.add(flash);
  const ball = new THREE.Sprite(new THREE.SpriteMaterial({ map:T.glow, color:0xff9a3a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
  root.add(ball);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map:T.dot, color:0xffffff, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
  root.add(core);

  const cMat = columnMat();
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 1, 24, 1, true), cMat);
  column.renderOrder = 6; root.add(column);

  const ringGeo = new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2);
  const shockA = new THREE.Mesh(ringGeo, additive(0xffb060)), shockB = new THREE.Mesh(ringGeo, additive(0xfff0d0));
  shockA.position.y = shockB.position.y = DECK + 0.03; root.add(shockA, shockB);
  const dustRings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(ringGeo, additive(0xd8cfc2)); m.position.y = DECK + 0.025; root.add(m); return m; });

  // sparks (GPU-light: one Points, positions rebuilt each frame from the hash)
  const NS = 360, sPos = new Float32Array(NS * 3), sCol = new Float32Array(NS * 3);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ size:0.13, map:T.dot, vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
  sparks.frustumCulled = false; root.add(sparks);

  const smokes = Array.from({ length:14 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:T.smoke, color:0x2a2522, transparent:true, opacity:0, depthWrite:false }));
    root.add(s); return s;
  });

  const ND = 36, debris = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.05, 0.13), new THREE.MeshStandardMaterial({ color:0x1b1d24, metalness:0.7, roughness:0.5 }), ND);
  debris.frustumCulled = false; root.add(debris);
  const dummy = new THREE.Object3D();

  // the shell and its aerial crown
  const NT = 16, tPos = new Float32Array(NT * 3), tCol = new Float32Array(NT * 3);
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3)); tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  const trail = new THREE.Points(tGeo, new THREE.PointsMaterial({ size:0.22, map:T.dot, vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
  trail.frustumCulled = false; root.add(trail);
  const NC = 160, cPos = new Float32Array(NC * 3), cCol = new Float32Array(NC * 3);
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3)); cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
  const crown = new THREE.Points(cGeo, new THREE.PointsMaterial({ size:0.2, map:T.dot, vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
  crown.frustumCulled = false; root.add(crown);
  const crownFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map:T.glow, color:0xffe0a0, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
  root.add(crownFlash);

  // flames that lick the burning standee
  const NF = 14, flames = Array.from({ length:NF }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:T.glow, color:0xff8a2c, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    root.add(s); return s;
  });

  const SHELL_H = 11.5, CROWN_AT = 1.15, SHELL_AT = 0.12;

  function update(c) {
    const { age, L, reduced, standee, time, hover } = c;             // age = s after CONTACT
    const TL = timeline(L), a = age - TL.ti;                          // a = s after IGNITION
    const pre = age > 0 ? clamp01(age / Math.max(0.05, TL.ti)) : 0;
    const armed = 0.9 + 0.25 * Math.sin(time * 3);
    const plate = age > 0 ? 1 : 0;

    // mortar: armed pulse → white-hot fuse → fired and cooling
    const glow = a < 0 ? armed + pre * 2.2 : 0.4 + 3.2 * Math.exp(-a * 3.2);
    mortar.set({ glow, plate, open: a < 0 ? 0 : smooth(a / 0.07) });

    const fired = a >= 0;
    const E = L.flash;
    // flash + light
    const fl = fired ? Math.exp(-a * 9) : 0;
    light.intensity = fired ? (Math.exp(-a * 5) * 26 + Math.max(0, 1 - a / 1.6) * 3) * E : (a < 0 ? pre * 3 * E : 0);
    flash.material.opacity = Math.min(1, fl * 1.2 * E); flash.scale.setScalar(4 + 7 * Math.min(1, a * 6) * L.fireball);
    // fireball
    const fb = fired ? clamp01(a / 0.7) : 0;
    ball.material.opacity = fired ? Math.pow(1 - fb, 1.4) * 0.9 : 0;
    ball.scale.setScalar((0.8 + easeOut(clamp01(a / 0.3)) * 3.4) * L.fireball); ball.position.y = DECK + 0.6 + fb * 1.2;
    core.material.opacity = fired ? Math.pow(1 - clamp01(a / 0.22), 2) : 0;
    core.scale.setScalar((1.2 + clamp01(a / 0.1) * 1.8) * L.fireball); core.position.y = DECK + 0.5;
    // column
    const ch = 5.6 * L.column;
    const grow = fired ? easeOut(clamp01(a / 0.16)) : 0, collapse = 1 - smooth((a - 0.28) / 0.5);
    column.visible = fired && L.column > 0.01 && collapse > 0.001;
    const colH = Math.max(0.01, ch * grow * (0.55 + 0.45 * collapse));
    column.scale.set(1 + 0.25 * a, colH, 1 + 0.25 * a); column.position.y = DECK + colH / 2;
    cMat.uniforms.uAge.value = Math.max(0, a); cMat.uniforms.uA.value = (fired ? 1 : 0) * collapse;
    // shock rings + tile
    const sa = fired ? clamp01(a / 0.55) : 0;
    shockA.visible = shockB.visible = fired && sa < 1 && L.shock > 0;
    shockA.scale.setScalar(0.6 + easeOut(sa) * 4.6 * L.shock); shockA.material.opacity = Math.pow(1 - sa, 1.6) * 0.95;
    const sb = fired ? clamp01(a / 0.3) : 0;
    shockB.scale.setScalar(0.5 + easeOut(sb) * 2.4 * L.shock); shockB.material.opacity = Math.pow(1 - sb, 1.3) * 0.9;
    scorch.material.opacity = fired ? L.scorchMark * smooth(a / 0.25) * 0.95 : 0;

    // sparks
    const nS = Math.min(NS, Math.round(NS * 0.8 * L.sparks));
    sGeo.setDrawRange(0, reduced ? 0 : nS);
    for (let i = 0; i < nS; i++) {
      const life = 0.5 + hash(i + 3) * 1.1, t = a - hash(i + 71) * 0.06;
      if (!fired || t < 0 || t > life) { sCol[i * 3] = sCol[i * 3 + 1] = sCol[i * 3 + 2] = 0; continue; }
      const sp = 3 + hash(i + 11) * 9, az = hash(i + 29) * Math.PI * 2, el = 0.15 + hash(i + 47) * 1.35, k = 1.3;
      const f = (1 - Math.exp(-k * t)) / k, vh = Math.cos(el) * sp, vy = Math.sin(el) * sp;
      const y = Math.max(DECK + 0.03, DECK + 0.3 + vy * f - 4.9 * t * t);
      sPos[i * 3] = Math.cos(az) * vh * f; sPos[i * 3 + 1] = y; sPos[i * 3 + 2] = Math.sin(az) * vh * f;
      const fade = Math.pow(1 - t / life, 1.4), hot = hash(i + 5);
      sCol[i * 3] = 1.4 * fade; sCol[i * 3 + 1] = (0.55 + 0.5 * hot) * fade; sCol[i * 3 + 2] = (0.1 + 0.5 * hot * hot) * fade * 0.8;
    }
    sGeo.attributes.position.needsUpdate = sGeo.attributes.color.needsUpdate = true;

    // smoke
    for (let i = 0; i < smokes.length; i++) {
      const s = smokes[i], t = a - 0.05 - hash(i + 200) * 0.25, life = 2.4 + hash(i + 220);
      s.visible = fired && t > 0 && t < life && L.smoke > 0 && !reduced;
      if (!s.visible) continue;
      const k = t / life, ang = hash(i + 240) * Math.PI * 2, r = (0.2 + hash(i + 260) * 0.7) * (0.4 + k);
      s.position.set(Math.cos(ang) * r, DECK + 0.4 + t * (0.9 + hash(i + 280) * 0.9), Math.sin(ang) * r);
      s.scale.setScalar(1.2 + k * 3.6); s.material.opacity = L.smoke * 0.5 * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (1 - k * 0.5);
    }

    // debris
    const nD = Math.round(ND * clamp01(L.debris));
    debris.count = reduced ? 0 : nD;
    for (let i = 0; i < nD; i++) {
      const t = a - hash(i + 400) * 0.04, life = 2.2;
      if (!fired || t < 0 || t > life) { dummy.scale.setScalar(0.0001); dummy.position.set(0, -5, 0); dummy.updateMatrix(); debris.setMatrixAt(i, dummy.matrix); continue; }
      const sp = 2.5 + hash(i + 411) * 5.5, az = hash(i + 421) * Math.PI * 2, vy = 4 + hash(i + 431) * 6;
      let y = DECK + 0.2 + vy * t - 4.9 * t * t, bounced = 0;
      if (y < DECK + 0.05) {                                         // one bounce, then it lies there
        const tg = (vy + Math.sqrt(vy * vy + 2 * 9.8 * 0.15)) / 9.8, t2 = t - tg;
        y = t2 > 0 ? DECK + 0.05 + Math.max(0, 0.35 * vy * 0.4 * t2 - 4.9 * t2 * t2) : DECK + 0.05; bounced = 1;
      }
      const fx = 1 - Math.exp(-1.6 * t), shrink = 1 - smooth((t - (life - 0.4)) / 0.4);
      dummy.position.set(Math.cos(az) * sp * fx * 0.9, y, Math.sin(az) * sp * fx * 0.9);
      dummy.rotation.set(t * (4 + hash(i + 441) * 8) * (1 - bounced * 0.9), t * 6, t * 3); dummy.scale.setScalar(shrink); dummy.updateMatrix();
      debris.setMatrixAt(i, dummy.matrix);
    }
    debris.instanceMatrix.needsUpdate = true;

    // shell → crown
    const shellOn = L.shell === 'on' && !reduced, ts = a - SHELL_AT;
    const sk = clamp01(ts / (CROWN_AT - SHELL_AT));
    trail.visible = shellOn && fired && ts > 0 && sk < 1;
    if (trail.visible) {
      for (let j = 0; j < NT; j++) {
        const kk = clamp01((ts - j * 0.022) / (CROWN_AT - SHELL_AT));
        tPos[j * 3] = Math.sin(j) * 0.02; tPos[j * 3 + 1] = DECK + 0.3 + SHELL_H * (1 - Math.pow(1 - kk, 2.2)); tPos[j * 3 + 2] = 0;
        const f = Math.pow(1 - j / NT, 1.8); tCol[j * 3] = 1.5 * f; tCol[j * 3 + 1] = 0.95 * f; tCol[j * 3 + 2] = 0.4 * f;
      }
      tGeo.attributes.position.needsUpdate = tGeo.attributes.color.needsUpdate = true;
    }
    const tc = a - CROWN_AT, cOn = shellOn && L.crown > 0 && fired && tc > 0 && tc < 2.2;
    crown.visible = cOn; crownFlash.material.opacity = cOn ? Math.exp(-tc * 8) : 0; crownFlash.visible = cOn;
    if (cOn) {
      crownFlash.position.set(0, DECK + 0.3 + SHELL_H, 0); crownFlash.scale.setScalar(6 * L.crown);
      for (let i = 0; i < NC; i++) {
        const u = hash(i + 600) * 2 - 1, az = hash(i + 620) * Math.PI * 2, rr = Math.sqrt(1 - u * u), sp = (2 + hash(i + 640) * 3.4) * L.crown;
        const k = 1.5, f = (1 - Math.exp(-k * tc)) / k, life = 1.5 + hash(i + 660) * 0.7;
        cPos[i * 3] = Math.cos(az) * rr * sp * f; cPos[i * 3 + 1] = DECK + 0.3 + SHELL_H + u * sp * f - 2.2 * tc * tc; cPos[i * 3 + 2] = Math.sin(az) * rr * sp * f;
        const fade = tc < life ? Math.pow(1 - tc / life, 1.2) * (0.6 + 0.4 * Math.sin(tc * 40 + i)) : 0;
        cCol[i * 3] = 1.6 * fade; cCol[i * 3 + 1] = (0.78 - 0.3 * hash(i + 680)) * fade; cCol[i * 3 + 2] = 0.22 * fade;
      }
      cGeo.attributes.position.needsUpdate = cGeo.attributes.color.needsUpdate = true;
    }

    // dust at every touchdown
    TL.contacts.forEach((ct, i) => {
      const m = dustRings[i]; if (!m) return;
      const d = age - ct.at, k = clamp01(d / (0.5 + 0.2 * ct.power));
      m.visible = d >= 0 && k < 1 && L.dust > 0 && !reduced && standee != null;
      if (!m.visible) return;
      m.position.set(standee.land.x, DECK + 0.025, standee.land.z);
      m.scale.setScalar(0.5 + easeOut(k) * (1.5 + 2 * ct.power) * L.dust); m.material.opacity = Math.pow(1 - k, 1.7) * 0.5 * ct.power;
    });

    // flames on the standee
    const burn = standee ? standee.burn : 0;
    for (let i = 0; i < NF; i++) {
      const s = flames[i];
      s.visible = burn > 0.01 && !reduced && L.flameSize > 0;
      if (!s.visible) continue;
      const ph = (time * (1.4 + hash(i + 700) * 1.2) + hash(i + 710)) % 1, fl2 = 0.65 + 0.35 * Math.sin(time * 23 + i * 5);
      const ang = hash(i + 720) * Math.PI * 2, h = standee.height * (0.1 + 0.8 * hash(i + 730));
      s.position.set(standee.pos.x + Math.cos(ang) * 0.35, standee.pos.y + h + ph * 0.7, standee.pos.z + Math.sin(ang) * 0.2);
      s.scale.setScalar((0.6 + 0.7 * (1 - ph)) * L.flameSize * (0.7 + 0.5 * standee.burn));
      s.material.opacity = Math.min(0.85, burn * fl2 * (1 - ph) * 1.1);
    }

    if (c.astra) {                       // Astra's mortars, flame and fireworks draw these instead
      mortar.group.visible = false; column.visible = false; ball.visible = false; core.visible = false;
      sparks.visible = false; trail.visible = false; crown.visible = false; crownFlash.visible = false;
    } else { mortar.group.visible = true; ball.visible = true; core.visible = true; sparks.visible = true; }
    return { tile: fired ? L.tileFlash * Math.exp(-a * 2.6) + 0 : pre * 0.25 * L.tileFlash, ignite: a };
  }

  return {
    root, mortar,
    place(x, y, z) { root.position.set(x, y, z); },
    update,
    dispose() { parent.remove(root); root.traverse(o => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose?.()); }); },
  };
}
