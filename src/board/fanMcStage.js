import * as THREE from 'three';
import { fanPawn3D, CROWD_LOOK } from './cosmicFans.js';
import { createGlowSticks, GLOW_LOOK, sticksForFan } from './glowSticks.js';
import { createStandee, STANDEE_Y } from './standee.js';
import { createDuelWaveforms } from './riffWaveforms.js';
import { RIFF_ARENA } from '../riff/arenaDuel.js';
import { RIFF_GRADE_WEIGHT } from '../engine/systems/riffOff.js';
import { FAN_MC, FAN_MC_SCREEN, fanMcColor, intermissionAt, replayPlan, energyAt, riffSides } from '../data/fanMc.js';
import { MC_OUTFIT, dressMc, outfitFanStyle } from './fanMcOutfit.js';

// ═══ 🎤 THE FAN MC ON THE REAL BOARD ═════════════════════════════════════════
// Alex, 2026-10-15: the wallpaper's fan, on his own floating hex, with a mic, comes
// out before each stage effect: the standings, (at his LAST show of the match — 7 of
// 10, 12 of 15, 17 of 20) the riff of the night on a TV that drops from the rafters,
// then he CALLS the effect. Dialled on `.scratch/fan-mc-preview.html` (5 of 66 levers; the look
// and the clock are `data/fanMc.js` FAN_MC — this file is the picture).
//
// ⭐ ONE CLOCK. `update(show)` hands it `{ startMs, timeline, players, fx, best,
// spirits }`; every pose is a pure function of `now − startMs` against the timeline
// (`data/fanMc.js compileIntermission`), so a ⏭ Skip is just a new `startMs`, and the
// overlay (ui/FanMcOverlay.jsx) and the sound read the very same seconds.
//
// The MC is built exactly as the wallpaper builds him (`.scratch/wallpaper/fanBuddy.js`):
// one crowd fan (`fanPawn3D`), a glow stick or a free hand, on a floating hex tile —
// then scaled up (`size`). New for the game: the MIC, the spotlight beam, the TV.
// 🎩 And since 2026-10-16 his OWN LOOK (`board/fanMcOutfit.js` MC_OUTFIT, Alex's dial-in on
// the Fan MC Wardrobe page): `dressMc` after every build, ticked from `poseMc` with his mood.
//
// 📺 THE TV'S SCREEN IS A LIVE CAMERA ON THE GAME'S OWN DUEL: a tiny replay stage
// running `createDuelWaveforms` (board/riffWaveforms.js — the real streams, hoops,
// haze and glitter), staged as `riffArenaVisuals.js` stages it and fed the
// remembered duel's energy (`state.bestRiff`, engine/systems/riffOff.js riffMoment):
// it fast-forwards the ball growing, plays the last notes feeding it, then the
// winner's blast drives it into the loser. Rendered into a target that IS the screen
// (`prerender`, called by the arena renderer before its own draw).
//
// 🔝 HE IS NEVER BEHIND ANYTHING (Alex, 2026-10-16: *"it looked like he was appearing
// 'behind' other assets … make sure that he doesn't get obscured by anything when he
// comes out"*). ⚠️ The arena is three stacked layers (beamLayer.js says it best): the
// WebGL arena (z 0), the board's SVG on a CSS3D plane (z 1) and the foreground canvas
// (z 2: amps, fans, dice, the standees, smoke, lasers, the Sonic's rings). He used to
// live in the ARENA scene, so the hex tints, every amp and fan stand and both
// standees painted over him however close he was to the lens. So he, his spotlight
// and the TV go on `floatRoot` — the renderer's own MC layer, drawn LAST on the
// foreground canvas after a depth clear (arenaRenderer.js) — and only the board wash
// (a light ON the board) stays in `root`. ⚠️ The TV's render target therefore belongs
// to the FOREGROUND context: `prerender` must be handed that renderer, never the
// arena's (a target filled in one WebGL context is an empty texture in another).


const V = (x, y, z) => new THREE.Vector3(x, y, z), Y_UP = V(0, 1, 0);
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const outCubic = x => 1 - (1 - clamp01(x)) ** 3;
const outBack = x => { x = clamp01(x); const c = 1.4; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const inCubic = x => clamp01(x) ** 3;
const HEAD_C = V(0, .49, 0), HEAD_R = .125;   // fanPawn3D's head: a .12 sphere at y .49 (+ the headband's lip)
// The game's ◈ Arena view (arenaRenderer frameView) — the side he is framed from until the renderer hands a wide lens.
const DEFAULT_WIDE = { position:V(27, 20.8, 37).multiplyScalar(.6).add(V(1, -2.8, 0)), target:V(1, -2.8, 0) };

export function createFanMcStage(root, { pointFor, look = FAN_MC, floatRoot = root, outfit = MC_OUTFIT } = {}) {
  let L = { ...look }, O = { ...outfit }, dress = null;
  const group = new THREE.Group(); group.name = 'Fan MC'; group.visible = false; floatRoot.add(group);
  const body = new THREE.Group(); group.add(body);   // yaw + bob live here

  // ── his floating hex ──
  const tile = new THREE.Mesh(new THREE.CylinderGeometry(.62, .55, .12, 6), new THREE.MeshStandardMaterial({ color:'#1b2550', roughness:.35, metalness:.3 }));
  tile.rotation.y = Math.PI / 6; body.add(tile);
  const rimMat = new THREE.MeshBasicMaterial({ color:'#c58cff', toneMapped:false });
  // A tube, not a LineLoop: a 1-px line vanishes at arena distance (the wallpaper is a close-up).
  const rimPts = Array.from({ length:7 }, (_, i) => V(Math.cos(i * Math.PI / 3) * .62, .062, Math.sin(i * Math.PI / 3) * .62));
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, false, 'catmullrom', 0), 36, .012, 5, false), rimMat);
  rim.rotation.y = Math.PI / 6; body.add(rim);
  const underGlow = new THREE.Mesh(new THREE.CircleGeometry(.75, 6), new THREE.MeshBasicMaterial({ color:'#8a5cff', transparent:true, opacity:.22, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false }));
  underGlow.rotation.set(-Math.PI / 2, 0, Math.PI / 6); underGlow.position.y = -.09; body.add(underGlow);

  // 🔦 THE SPOTLIGHT: a soft beam from the sky onto him (edge-faded, so it reads as light,
  // not as a pale lampshade — a flat additive cone did exactly that) + a real light on him.
  const beamMat = new THREE.ShaderMaterial({
    uniforms:{ color:{ value:new THREE.Color('#fff2d6') }, opacity:{ value:.5 } },
    vertexShader:`varying vec3 vN; varying vec3 vV; varying float vH;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        vH = uv.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader:`uniform vec3 color; uniform float opacity; varying vec3 vN; varying vec3 vV; varying float vH;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
        float a = edge * (1.0 - vH) * (1.0 - vH) * opacity; gl_FragColor = vec4(color * a, a); }`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.16, .72, 6, 32, 1, true), beamMat);
  beam.position.y = 3.05; body.add(beam);
  const spot = new THREE.SpotLight('#fff1dc', 0, 0, .45, .7, 1.2); floatRoot.add(spot, spot.target);   // lights HIM, so it lives in his layer

  // ── the MC: one crowd fan + the mic (+ a stick in the other hand, if dialled) ──
  let fan = null, sticks = null, holder = null, mic = null, micBand = null, head = null, mcColor = '#dfe8ff', builtKey = '';
  const LEFT_SEED = (() => { const lk = { ...GLOW_LOOK, hands:'one' }; for (let s = 0; s < 64; s++) if (sticksForFan(lk, s)[0].sign < 0) return s; return 0; })();
  function buildMic() {
    const g = new THREE.Group(); g.name = 'MC mic';
    const metal = new THREE.MeshStandardMaterial({ color:'#1a1d26', metalness:.6, roughness:.35 });
    const chrome = new THREE.MeshStandardMaterial({ color:'#c9d0dc', metalness:.95, roughness:.18, emissive:'#20242c', emissiveIntensity:.4 });
    micBand = new THREE.MeshBasicMaterial({ color:mcColor, toneMapped:false });
    if (L.micStyle === 'retro') {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(.032, .07, 6, 14), chrome); b.position.y = .14; g.add(b);
      for (let i = 0; i < 5; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(.033, .004, 5, 18), metal); rib.rotation.x = Math.PI / 2; rib.position.y = .11 + i * .016; g.add(rib); }
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(.012, .016, .1, 10), chrome); neck.position.y = .05; g.add(neck);
      const band = new THREE.Mesh(new THREE.TorusGeometry(.034, .006, 6, 20), micBand); band.rotation.x = Math.PI / 2; band.position.y = .2; g.add(band);
    } else {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(.02, .013, .17, 12), metal); handle.position.y = .03; g.add(handle);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.022, .021, .016, 14), micBand); band.position.y = .118; g.add(band);
      const grille = new THREE.Mesh(new THREE.SphereGeometry(.046, 16, 12), chrome); grille.position.y = .155; g.add(grille);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(.0475, 12, 8), new THREE.MeshBasicMaterial({ color:'#0b0d12', wireframe:true, transparent:true, opacity:.55 }));
      mesh.position.y = .155; g.add(mesh);
    }
    g.scale.setScalar(L.micSize);
    return g;
  }
  function buildMc(leaderColor) {
    const color = fanMcColor(L, leaderColor);
    // 🎩 any headwear but the Ronin band needs the plain head (the band IS the 'ronin' fan style)
    const style = outfitFanStyle(O, L.style);
    const key = `${style}|${color}|${L.offHand}|${L.micStyle}|${L.micSize}|${JSON.stringify(O)}`;
    if (key === builtKey) return;
    builtKey = key; mcColor = color;
    dress?.dispose(); dress = null;
    if (holder) { sticks?.dispose(); holder.removeFromParent(); holder.traverse(o => { o.geometry?.dispose?.(); }); }
    holder = new THREE.Group(); body.add(holder);
    fan = fanPawn3D({ color, filled:true, seed:5, style:style === 'plain' ? null : style, look:CROWD_LOOK });
    holder.add(fan); fan.position.y = .02;
    sticks = L.offHand === 'stick' ? createGlowSticks(holder, [fan], { owner:color, look:{ ...GLOW_LOOK, hands:'one' }, seedOffset:LEFT_SEED }) : null;
    head = fan.children.find(c => c.isGroup && Math.abs(c.position.y - .49) < .05) ?? null;
    mic = buildMic(); fan.userData.hands[1].add(mic);
    rimMat.color.set(color).lerp(new THREE.Color('#ffffff'), .25); underGlow.material.color.set(color);
    // ⚠️ AFTER the mic: the neon / gold / rhinestone finish re-skins the mic this build just made.
    dress = dressMc(fan, O);
  }

  // ── the effect landing on the board: a coloured wash + a light ──
  const wash = new THREE.Mesh(new THREE.CircleGeometry(11.3, 64), new THREE.MeshBasicMaterial({ color:'#ff7722', transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false }));
  wash.rotation.x = -Math.PI / 2; wash.position.y = .32; wash.visible = false; root.add(wash);
  const washLight = new THREE.PointLight('#ff7722', 0, 40, 1.4); washLight.position.set(0, 6, 0); root.add(washLight);

  // ── 📺 THE TV (casing, screen, cables) ──
  const TV_W = 640, TV_H = 400;
  // ⚠️ THE CANVASES ARE MADE ON FIRST USE, not here: the arena is also built headless (the
  // node checks have no `document`), and only his last show of a match needs a TV.
  let tvCanvas = null, tvCtx = null, noiseCanvas = null, noiseCtx = null, noiseImg = null, tvOverlay = null, tvRT = null;
  function ensureTvSurfaces() {
    if (tvRT) return true;
    if (typeof document === 'undefined') return false;
    tvCanvas = document.createElement('canvas'); tvCanvas.width = TV_W; tvCanvas.height = TV_H; tvCtx = tvCanvas.getContext('2d');
    noiseCanvas = document.createElement('canvas'); noiseCanvas.width = 160; noiseCanvas.height = 100;
    noiseCtx = noiseCanvas.getContext('2d'); noiseImg = noiseCtx?.createImageData(160, 100) ?? null;
    tvOverlay = new THREE.CanvasTexture(tvCanvas); tvOverlay.colorSpace = THREE.SRGBColorSpace;
    tvRT = new THREE.WebGLRenderTarget(TV_W * 1.5, TV_H * 1.5, { type:THREE.HalfFloatType, samples:4 });
    tvScreenMat.uniforms.scene.value = tvRT.texture; tvScreenMat.uniforms.overlay.value = tvOverlay;
    return true;
  }
  const tv = new THREE.Group(); tv.name = 'Replay TV'; tv.visible = false; floatRoot.add(tv);
  const tvBody = new THREE.Group(); tv.add(tvBody);
  const tvCase = new THREE.MeshStandardMaterial({ color:'#151a29', metalness:.55, roughness:.4 });
  tvBody.add(new THREE.Mesh(new THREE.BoxGeometry(2.36, 1.56, .26), tvCase));
  const tvBack = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.08, .3), tvCase); tvBack.position.z = -.25; tvBody.add(tvBack);
  const tvScreenMat = new THREE.ShaderMaterial({
    uniforms:{ scene:{ value:null }, overlay:{ value:null }, live:{ value:0 }, gain:{ value:1.15 } },
    vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:`uniform sampler2D scene; uniform sampler2D overlay; uniform float live; uniform float gain; varying vec2 vUv;
      void main(){ vec3 s = texture2D(scene, vUv).rgb * gain * live; vec4 o = texture2D(overlay, vUv);
        gl_FragColor = vec4(mix(s, o.rgb, o.a), 1.0); }`,
  });
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 1.3), tvScreenMat); tvScreen.position.z = .131; tvBody.add(tvScreen);
  const tvRimMat = new THREE.MeshBasicMaterial({ color:'#c58cff', toneMapped:false });
  for (const [w, h, x, y] of [[2.4, .04, 0, .78], [2.4, .04, 0, -.78], [.04, 1.6, 1.18, 0], [.04, 1.6, -1.18, 0]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, .05), tvRimMat); bar.position.set(x, y, .12); tvBody.add(bar);
  }
  const tvCable = new THREE.MeshStandardMaterial({ color:'#0d1018', metalness:.6, roughness:.5 });
  for (const x of [-.8, .8]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 16, 6), tvCable); c.position.set(x, .78 + 8, -.05); tvBody.add(c); }
  const tvTally = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), new THREE.MeshBasicMaterial({ color:'#ff2b3d', toneMapped:false }));
  tvTally.position.set(1.0, .715, .14); tvBody.add(tvTally);
  const tvGlow = new THREE.PointLight('#8fbfff', 0, 9, 1.5); tvGlow.position.set(0, 0, 1.4); tvBody.add(tvGlow);
  // ⚠️ r2 first look: at 1.25× the screen was a postage stamp. At 2.3× it is ~5.4 m wide — a jumbotron.
  const TV_SCALE = 2.3;

  // ── the replay stage (what the TV camera sees) — built only for the show that needs it ──
  let rp = null;
  function buildReplay(r, spirits, P) {
    const key = `${r.turn}|${r.attackerId}|${r.defenderId}`;
    if (rp?.key === key) return rp;
    disposeReplay();
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#05070f');
    scene.add(new THREE.HemisphereLight('#a9c4ff', '#1a1230', 1.6));
    const key2 = new THREE.DirectionalLight('#ffffff', 1.6); key2.position.set(2, 6, 9); scene.add(key2);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9.5, 6), new THREE.MeshStandardMaterial({ color:'#141a3a', roughness:.55, metalness:.3 }));
    floor.rotation.set(-Math.PI / 2, 0, Math.PI / 6); scene.add(floor);
    const grid = new THREE.PolarGridHelper(9.4, 6, 6, 6, '#3c2a78', '#2a2457'); grid.position.y = .01; scene.add(grid);
    const half = 4.6, center = V(0, 1.85, 0), front = V(0, 0, 1);
    const poses = [V(-half, STANDEE_Y, 0), V(half, STANDEE_Y, 0)], origins = [V(-8.2, 1.35, -1.6), V(8.2, 1.35, -1.6)];
    for (const o of origins) { const amp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.9, .9), new THREE.MeshStandardMaterial({ color:'#10131f', roughness:.5 })); amp.position.copy(o).setY(.95); scene.add(amp); }
    const cam = new THREE.PerspectiveCamera(44, TV_W / TV_H, .1, 200);
    const ids = [r.attackerId, r.defenderId];
    const standees = ids.map((id, i) => {
      const sp = spirits?.find(s => s.id === id);
      if (!sp?.imageSrc) return null;
      const st = createStandee(sp); st.group.rotation.order = 'YXZ'; st.group.position.copy(poses[i]);
      st.group.rotation.y = Math.atan2(front.x, front.z) + (i === 0 ? .5 : -.5);   // as riffArenaVisuals poses them
      scene.add(st.group); return st;
    });
    const lights = ids.map((id, i) => { const l = new THREE.PointLight(P(id)?.color ?? '#ffffff', 22, 14, 1.4); l.position.copy(poses[i]).add(V(i ? -1 : 1, 3.2, 2.5)); scene.add(l); return l; });
    const glimmer = new THREE.PointLight('#b7eaff', 0, 10); scene.add(glimmer);
    // 🌟 the TV has no bloom, so the ball gets a soft additive halo in both Spirits' colours
    const haloTex = (() => { const c = typeof document === 'undefined' ? { width:0, height:0, getContext:() => null } : document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      if (g) { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:haloTex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:.6 }));
    scene.add(halo);
    const fx = createDuelWaveforms(scene, ids.map(id => P(id)?.color ?? '#ffffff'));
    fx.setOrigins(origins); fx.reset();
    rp = { key, scene, cam, fx, standees, lights, glimmer, halo, haloTex, half, center, front, poses, last:-1, live:false };
    return rp;
  }
  function disposeReplay() {
    if (!rp) return;
    rp.fx.dispose(); rp.haloTex.dispose(); rp.halo.material.dispose();
    rp.scene.traverse(o => { if (o.isMesh && !o.userData?.standee) { o.geometry?.dispose?.(); } });
    rp = null;
  }

  // ── state ──
  let show = null, yaw = 0, talkW = 0, cheerW = 0, hushW = 0, lastNow = 0, wide = DEFAULT_WIDE, camState = null;
  const tmp = V(0, 0, 0);
  const players = () => show?.players ?? [];
  const P = id => players().find(p => p.id === id);

  function parkPoint() {
    const k = L.height;
    if (L.where === 'front') { const d = wide.position.clone().sub(wide.target).setY(0).normalize(); return d.multiplyScalar(7.2).setY(k); }
    if (L.where === 'leader') {
      const lead = show?.timeline?.segs.find(s => s.id === 'standings')?.beat.card.rows[0];
      const sp = lead && show.spirits?.find(s => s.id === lead.id), p = sp && pointFor?.(sp.num);
      if (p) return p.clone().setY(k + 1.2);
    }
    return V(0, k, 0);
  }
  function edgePoint(park) {
    const d = (park.x || park.z) ? park.clone().setY(0).normalize() : wide.position.clone().setY(0).normalize().applyAxisAngle(Y_UP, .9);
    return d.multiplyScalar(12.6).setY(2.6);
  }
  function arrivePos(u, park) {
    const e = outCubic(u);
    if (L.arrive === 'rise') return park.clone().add(V(0, -(1 - outBack(u)) * 13, 0));
    if (L.arrive === 'swoop') {
      const a = park.clone().add(V(-17, 4, -9)), c = park.clone().add(V(-5, 6.5, 9)), p = V(0, 0, 0);
      return p.addScaledVector(a, (1 - e) ** 2).addScaledVector(c, 2 * e * (1 - e)).addScaledVector(park, e * e);
    }
    const r = 3.2 * (1 - e), ang = u * Math.PI * 1.6;
    return park.clone().add(V(Math.sin(ang) * r, (1 - e) * 15, Math.cos(ang) * r));
  }
  function leavePos(u, park) {
    if (L.leave === 'park') return park.clone().lerp(edgePoint(park), smooth(u));
    if (L.leave === 'reverse') return arrivePos(1 - u, park);
    return park.clone().add(V(0, inCubic(u) * 17, 0));
  }
  function tvBase() {
    const park = parkPoint(), k = L.size / 2.4;
    const dir = wide.position.clone().sub(park).setY(0).normalize();
    const right = V(0, 0, 0).crossVectors(dir.clone().negate(), Y_UP).normalize();
    return park.clone().add(V(0, L.tvLift * k + .55 * L.size + .78 * TV_SCALE * k * L.tvSize, 0))
      .addScaledVector(right, { left:-1, above:0, right:1 }[L.tvSide] * 2.6 * k * L.tvSize);
  }
  const secs = now => (show ? (now - show.startMs) / 1000 : -1);
  const riffSeg = () => show?.timeline?.segs.find(s => s.id === 'riff' && s.tv);

  /** Push the mic (grille at G, handle running back down −A for `len`) out of his head. Fan-model units. */
  function micClear(G, A, len, gR, hc) {
    const d = G.clone().sub(hc), need = HEAD_R + gR + .015, dl = d.length();
    if (dl < need) G.copy(hc).addScaledVector(dl > 1e-6 ? d.divideScalar(dl) : V(0, 0, 1), need);
    const H = G.clone().addScaledVector(A, -len), segV = G.clone().sub(H);
    const u = clamp01(hc.clone().sub(H).dot(segV) / segV.lengthSq()), Pn = H.addScaledVector(segV, u);
    const e = Pn.sub(hc), el = e.length(), needH = HEAD_R + .022 * L.micSize;
    if (el < needH) G.addScaledVector(el > 1e-6 ? e.divideScalar(el) : V(0, 0, 1), needH - el);
  }

  function poseMc(t, dt, clock, { reduced, camera }) {
    const T = show.timeline, ex = T.segs.find(s => s.id === 'exit');
    const parked = L.leave === 'park' && t >= T.T;
    group.visible = t >= 0 && (t < T.T || parked);
    if (!group.visible) { spot.intensity = 0; return; }
    const park = parkPoint();
    let pos;
    if (t < L.flyIn) pos = arrivePos(t / L.flyIn, park);
    else if (t >= ex.leave) pos = leavePos((t - ex.leave) / L.flyOut, park);
    else pos = park.clone();
    const settled = t >= L.flyIn && t < ex.leave;
    if (settled && !reduced) pos.y += Math.sin(clock * 1.1) * L.bob;
    group.position.copy(pos); group.scale.setScalar(L.size);
    tile.scale.setScalar(L.tileSize); rim.scale.setScalar(L.tileSize); underGlow.scale.setScalar(L.tileSize);
    rimMat.color.set(mcColor).lerp(new THREE.Color('#ffffff'), .25).multiplyScalar(L.rimGlow);
    underGlow.material.opacity = L.underGlow * (.6 + .4 * Math.sin(clock * 2) ** 2);
    if (micBand) micBand.color.set(mcColor).multiplyScalar(Math.max(.05, L.micGlow));
    beam.visible = L.spot === 'on'; beamMat.uniforms.opacity.value = .32 * L.spotGlow * (settled ? 1 : .3);
    spot.intensity = (L.spot === 'on' ? 60 : 0) * L.spotGlow;
    spot.position.copy(pos).add(V(0, 7 * L.size / 2.4 + 3, 0)); spot.target.position.copy(pos); spot.target.updateMatrixWorld();

    // who he faces: part-way round to the Spirit he's naming, else the camera
    const { line, lastLine } = intermissionAt(T, t);
    const to = (line ?? lastLine)?.to;
    const eye = camera?.position ?? wide.position;
    const toCam = Math.atan2(eye.x - pos.x, eye.z - pos.z);
    let want = toCam;
    const sp = to && settled ? show.spirits?.find(s => s.id === to) : null, spP = sp && pointFor?.(sp.num);
    if (spP && L.turnTo > 0) {
      let dd = Math.atan2(spP.x - pos.x, spP.z - pos.z) - toCam; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); want = toCam + dd * L.turnTo;
    }
    let d = want - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * (1 - Math.exp(-dt * 5));
    body.rotation.y = yaw;

    // his mood: what the line he's on asks for
    const mood = line?.mood ?? (lastLine && t - lastLine.t1 < .4 ? lastLine.mood : 'idle');
    const talking = !!line && t < line.typed;
    const k = 1 - Math.exp(-dt * 7);
    talkW += ((talking || mood === 'hush' ? 1 : 0) - talkW) * k;
    cheerW += ((mood === 'cheer' || (mood === 'hype' && !talking) || t >= ex.leave - .3 ? 1 : 0) - cheerW) * k;
    hushW += ((mood === 'hush' ? 1 : 0) - hushW) * k;
    const E = L.energy * (reduced ? 0 : 1);
    fan.userData.tick(clock, reduced);
    const beat = Math.abs(Math.sin(clock * 7));
    fan.position.y = (fan.userData.restY ?? .02) + .02 + E * (cheerW * beat * .14 + talkW * Math.abs(Math.sin(clock * 9)) * .012);
    fan.rotation.z = E * (cheerW * Math.sin(clock * 5) * .1 + (1 - cheerW) * Math.sin(clock * 1.3) * .03);
    fan.rotation.x = hushW * .18;
    if (head) head.rotation.x = -.12 * talkW * Math.sin(clock * 11) * E - hushW * .1;

    // ✋ THE MIC HAND (hands[1]). ⭐ POSED FROM THE MIC'S HEAD, NOT FROM THE HAND (r2 —
    // Alex: "the mic ends up going into his head no matter what the settings"): the GRILLE
    // is placed (chest → in front of his mouth → overhead), the hand hangs below it along
    // the mic's axis, and `micClear` keeps the grille AND the handle out of his head.
    const hands = fan.userData.hands, mh = hands[1];
    const retro = L.micStyle === 'retro', len = (retro ? .14 : .155) * L.micSize, gR = (retro ? .04 : .05) * L.micSize;
    const hc = head ? head.position : HEAD_C, front = hc.z + HEAD_R + gR + .025;
    const gRest = V(.17, .36, .13), aRest = V(-.12, 1, .18).normalize();
    const gMouth = V(.035, hc.y - .055, front + (1 - L.micToMouth) * .14), aMouth = V(-.3, 1, -.55).normalize();
    const gUp = V(.2, .84 + .03 * beat * E, .06), aUp = V(.12, 1, .06).normalize();
    const wT = talkW * (.35 + .65 * L.micToMouth), wC = cheerW * (1 - talkW * .6);
    const G = gRest.clone().lerp(gMouth, wT).lerp(gUp, wC), A = aRest.clone().lerp(aMouth, wT).lerp(aUp, wC).normalize();
    micClear(G, A, len, gR, hc);
    mh.position.copy(G).addScaledVector(A, -len);
    mic.quaternion.setFromUnitVectors(Y_UP, A);
    // the free hand points at whoever he's naming and waves on a cheer (a stick drives it otherwise)
    if (!sticks) hands[0].position.set(-.13, .27 + cheerW * (.42 + .04 * Math.sin(clock * 9) * E) + (to && settled ? .14 : 0), .07 + (to && settled ? .12 : 0));
    sticks?.update(clock, cheerW > .3 ? 1 : 0, cheerW, { reduced });
    dress?.tick(clock, { mood, dt, reduced });   // 🎩 the visor's scan, the notes, a cheer's confetti
  }

  function poseWash(t) {
    const T = show.timeline, sinceHit = t - T.hit;
    const on = sinceHit >= 0 ? L.wash * (sinceHit < .3 ? sinceHit / .3 : Math.max(.25, 1 - (sinceHit - .3) / 3)) : 0;
    const k = t > T.T ? 0 : on;
    wash.visible = k > .001; wash.material.color.set(show.fx?.color ?? '#ffffff'); wash.material.opacity = .16 * k;
    washLight.color.set(show.fx?.color ?? '#ffffff'); washLight.intensity = 140 * k;
  }

  // ── 📺 the TV and its picture ──
  function poseTv(t, dt, clock, { reduced, camera }) {
    const seg = riffSeg(), T = seg?.tv;
    if (!T || L.riffShow === 'card' || t < T.in || t > T.out || !ensureTvSurfaces()) { tv.visible = false; tvGlow.intensity = 0; if (rp) rp.live = false; return; }
    tv.visible = true;
    const k = L.size / 2.4, base = tvBase();
    let drop = 0;
    if (t < T.on) drop = (1 - outBack((t - T.in) / (T.on - T.in))) * 11;
    else if (t > T.rise) drop = inCubic((t - T.rise) / (T.out - T.rise)) * 14;
    tv.position.copy(base).add(V(0, drop, 0)); tv.scale.setScalar(k * L.tvSize * TV_SCALE);
    const eye = camera?.position ?? wide.position;
    tv.rotation.y = Math.atan2(eye.x - tv.position.x, eye.z - tv.position.z);
    const since = t - T.on;
    tvBody.rotation.z = since > 0 && !reduced ? Math.sin(since * 5.5) * .06 * Math.exp(-since * 1.7) : 0;
    tvRimMat.color.set(mcColor).multiplyScalar(1.4);
    const lit = t >= T.on && t < T.rise + .2;
    tvGlow.intensity = lit ? 5 : 0; tvTally.visible = lit && Math.floor(t * 2.5) % 2 === 0;
    const r = seg.beat.card.riff, live = t >= T.start && t < T.rise + .15;
    tvScreenMat.uniforms.live.value = live ? 1 : 0;
    let plan = null, s = 0;
    if (live) {
      const R = buildReplay(r, show.spirits, P);
      plan = replayPlan(r, T.end - T.start, L);
      s = Math.min(t, T.end + L.verdictHold) - T.start;            // the picture holds on the aftermath under the verdict
      if (s < R.last - .05) R.fx.reset();                          // scrubbed / skipped back: let it rebuild cleanly
      R.last = s; R.live = true;
      const energy = energyAt(r, plan, s, RIFF_GRADE_WEIGHT), total = energy[0] + energy[1];
      const shift = THREE.MathUtils.clamp((energy[0] - energy[1]) / Math.max(4, total) * 1.3, -1.3, 1.3);
      const winSide = r.winnerId === r.attackerId ? 0 : 1;
      const impact = s >= plan.blast ? { side:winSide, tie:false, born:2 + plan.blast } : null;
      R.fx.update({ ...RIFF_ARENA, time:(2 + s) * 1000, energy, scale:RIFF_ARENA.orb, shift, center:R.center, targets:R.poses, impact,
        reduced, maximumRadius:Math.min(3, R.half * .63), dt:Math.max(dt, 1 / 120) });
      R.glimmer.position.copy(R.fx.ball.position); R.glimmer.intensity = Math.min(8, total * .2);
      R.halo.visible = R.fx.ball.visible; R.halo.position.copy(R.fx.ball.position);
      R.halo.scale.setScalar((R.fx.ball.userData.radius ?? .5) * 4.2 * L.ballGlow);
      R.halo.material.color.set(P(r.attackerId)?.color ?? '#fff').lerp(new THREE.Color(P(r.defenderId)?.color ?? '#fff'), total ? energy[1] / total : .5).lerp(new THREE.Color('#ffffff'), .25);
      R.halo.material.opacity = .55 * Math.min(1, L.ballGlow);
      for (const st of R.standees) st?.frame?.(clock, { reduced, cameraPos:R.cam.position });
      const dist = Math.max(15, R.half * 2.5 / R.cam.aspect), hit = impact ? s - plan.blast - .8 : -1;
      const kick = hit > 0 && hit < .5 && !reduced ? (1 - hit / .5) * .35 : 0;
      R.cam.position.copy(R.center).addScaledVector(R.front, dist * .7).add(V(Math.sin(s * 61) * kick, 4.2 + Math.cos(s * 53) * kick, 0));
      R.cam.lookAt(R.center.clone().add(V(0, .6, 0)));
    } else if (rp) rp.live = false;
    drawTv(t, seg, plan, s, reduced);
    if (tvOverlay) tvOverlay.needsUpdate = true;
  }

  const GRADE_COLORS = { perfect:'#ffffee', good:'#19e6ff', ok:'#8a5cff', miss:'#555566', wrong:'#555566' };
  const GRADE_TEXT = { perfect:'PERFECT!', good:'GOOD', ok:'OK', miss:'MISS', wrong:'WRONG' };
  function drawTv(t, seg, plan, s, reduced) {
    const g = tvCtx; if (!g) return;
    const W = TV_W, H = TV_H, T = seg.tv, card = seg.beat.card, r = card.riff;
    g.clearRect(0, 0, W, H);
    if (t < T.on || t > T.rise + .15) {                         // off: a dark glass with a sheen
      const sh = g.createLinearGradient(0, 0, W, H); sh.addColorStop(0, '#1a2033'); sh.addColorStop(.5, '#06080f'); sh.addColorStop(1, '#0c1020');
      g.fillStyle = sh; g.fillRect(0, 0, W, H); return;
    }
    if (t < T.start) {                                         // power-on: static and a white line
      if (noiseImg) { const d = noiseImg.data; for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 200; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        noiseCtx.putImageData(noiseImg, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(noiseCanvas, 0, 0, W, H); }
      const u = (t - T.on) / (T.start - T.on); g.fillStyle = `rgba(255,255,255,${.8 * (1 - u)})`; g.fillRect(0, H / 2 - 3 - u * H / 2, W, 6 + u * H);
    } else {
      drawReplayHud(g, s, r, plan, T.end - T.start, reduced);
      if (t >= T.end) drawVerdict(g, clamp01((t - T.end) / .35), r);
    }
    g.fillStyle = 'rgba(0,0,0,.22)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);   // CRT lines
    const vg = g.createRadialGradient(W / 2, H / 2, H * .38, W / 2, H / 2, W * .72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function drawReplayHud(g, s, r, plan, len, reduced) {
    const W = TV_W, H = TV_H, energy = energyAt(r, plan, s, RIFF_GRADE_WEIGHT), ids = [r.attackerId, r.defenderId];
    const nm = id => (P(id)?.name ?? '???').toUpperCase();
    g.textBaseline = 'alphabetic';
    // only each side's latest note pops (two close notes used to print on top of each other)
    for (const n of [0, 1].map(side => plan.notes.filter(m => m.side === side && m.at <= s).pop()).filter(Boolean)) {
      const age = s - n.at; if (age > .5) continue;
      const a = 1 - age / .5, x = n.side ? W * .8 : W * .2, col = n.grade === 'miss' || n.grade === 'wrong' ? '#ff5a6e' : GRADE_COLORS[n.grade];
      g.globalAlpha = Math.min(1, a * 1.5); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 14;
      g.font = `900 ${n.grade === 'perfect' ? 34 : 27}px ui-sans-serif,system-ui,sans-serif`; g.textAlign = 'center';
      g.fillText(GRADE_TEXT[n.grade] ?? '', x, 150 - 26 * (1 - a)); g.shadowBlur = 0; g.globalAlpha = 1;
    }
    ids.forEach((id, side) => {
      const x = side ? W - 24 : 24;
      g.textAlign = side ? 'right' : 'left'; g.fillStyle = 'rgba(4,6,14,.55)'; g.fillRect(side ? W - 250 : 10, H - 92, 240, 80);
      g.fillStyle = P(id)?.color ?? '#fff'; g.font = '900 21px ui-sans-serif,system-ui,sans-serif'; g.fillText(nm(id), x, H - 66);
      g.fillStyle = '#ffd166'; g.font = '800 19px ui-monospace,Menlo,monospace'; g.fillText(`⚡ ${energy[side].toFixed(1)}`, x, H - 42);
      const mine = plan.notes.filter(n => n.side === side), dw = 18;
      mine.forEach((n, i) => {
        const cx = side ? x - (mine.length - 1 - i) * (dw + 4) - dw / 2 : x + i * (dw + 4) + dw / 2, landed = s >= n.at;
        g.beginPath(); g.arc(cx, H - 24, dw / 2 - 1, 0, Math.PI * 2);
        g.fillStyle = landed ? GRADE_COLORS[n.grade] ?? '#555566' : 'rgba(255,255,255,.12)'; g.fill();
        if (landed && (n.grade === 'miss' || n.grade === 'wrong')) { g.strokeStyle = '#ff5a6e'; g.lineWidth = 2; g.stroke(); }
      });
    });
    const phase = s < plan.ff ? '⏩ FROM THE TOP ×8 — THE BALL BUILDS' : s < plan.sides[1].from - .05 ? `${nm(r.attackerId)} CALLS` : s < plan.blast ? `${nm(r.defenderId)} ANSWERS` : '💥 THE BLAST';
    g.textAlign = 'center'; g.fillStyle = '#e8ecff'; g.font = '900 17px ui-sans-serif,system-ui,sans-serif'; g.fillText(phase, W / 2, 66);
    const hit = s - plan.blast - .8;
    if (hit > -.05 && hit < .7) { g.fillStyle = `rgba(255,250,235,${Math.max(0, .85 * (1 - Math.max(0, hit) / .7))})`; g.fillRect(0, 0, W, H); }
    if (Math.floor(s * 2.6) % 2 === 0 || reduced) { g.fillStyle = '#ff2b3d'; g.beginPath(); g.arc(30, 30, 8, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.font = '900 22px ui-sans-serif,system-ui,sans-serif'; g.fillText('REPLAY', 46, 38);
    g.textAlign = 'right'; g.fillStyle = '#ffd166'; g.font = '800 16px ui-sans-serif,system-ui,sans-serif';
    g.fillText(`RIFF-OFF · ROUND ${r.round ?? '?'}${r.exchanges > 1 ? ` · EXCHANGE ${r.exchanges}` : ''}`, W - 22, 36);
    g.textAlign = 'center'; g.fillStyle = '#c9d6ee'; g.font = '700 13px ui-monospace,Menlo,monospace';
    g.fillText(`−${Math.max(0, len - s).toFixed(1)} s`, W / 2, H - 22);
  }
  function drawVerdict(g, a, r) {
    const W = TV_W, H = TV_H, { w: wst, l: lst } = riffSides(r), w = P(r.winnerId);
    g.globalAlpha = .7 * a; g.fillStyle = '#05060d'; g.fillRect(0, 0, W, H); g.globalAlpha = a;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = w?.color ?? '#fff'; g.shadowColor = w?.color ?? '#fff'; g.shadowBlur = 24; g.font = '900 54px ui-sans-serif,system-ui,sans-serif';
    g.fillText((w?.name ?? '???').toUpperCase(), W / 2, 160); g.shadowBlur = 0;
    g.fillStyle = '#ffffff'; g.font = '900 26px ui-sans-serif,system-ui,sans-serif'; g.fillText('WINS THE RIFF-OFF', W / 2, 202);
    g.fillStyle = '#ffd166'; g.font = '800 20px ui-monospace,Menlo,monospace';
    g.fillText(`⚡ ${(wst.energy + lst.energy).toFixed(1)} ENERGY BALL`, W / 2, 248);
    g.fillStyle = '#c9d6ee'; g.font = '700 17px ui-monospace,Menlo,monospace';
    g.fillText(`${wst.quality}% vs ${lst.quality}%  ·  ${wst.perfects} PERFECT`, W / 2, 278);
    g.globalAlpha = 1;
  }

  return {
    group, tv,
    get look() { return L; },
    /** The dial-in page's levers (the game passes FAN_MC once, at creation). */
    setLook(next) { L = { ...L, ...next }; builtKey = ''; if (show) buildMc(show.timeline?.segs.find(s => s.id === 'standings')?.beat.card.rows[0]?.color); },
    /** 🎩 The Wardrobe page's outfit (the game passes MC_OUTFIT once, at creation). Rebuilds only on a change. */
    setOutfit(next) { O = { ...O, ...next }; if (show) buildMc(show.timeline?.segs.find(s => s.id === 'standings')?.beat.card.rows[0]?.color); },
    get outfit() { return O; },
    /** `null` ends the show; a new `startMs` (⏭ Skip) moves its clock. */
    update(next) {
      if (!next) { show = null; group.visible = false; tv.visible = false; wash.visible = false; washLight.intensity = 0; spot.intensity = 0; camState = null; return; }
      const fresh = !show || show.key !== next.key;
      show = next;
      if (fresh) { camState = null; yaw = 0; talkW = cheerW = hushW = 0; disposeReplay(); }   // the replay stage is rebuilt lazily
      buildMc(show.timeline?.segs.find(s => s.id === 'standings')?.beat.card.rows[0]?.color);
    },
    /** Pose everything for wall-clock `now` (ms). */
    tick(now, { reduced = false, camera = null, clock = now / 1000 } = {}) {
      const dt = lastNow ? Math.min(.1, Math.max(0, (now - lastNow) / 1000)) : 1 / 60; lastNow = now;
      if (!show) return;
      const t = secs(now);
      poseMc(t, dt, clock, { reduced, camera });
      poseWash(t);
      poseTv(t, dt, clock, { reduced, camera });
    },
    /** Draw the TV's picture (its replay stage) into the screen's target. */
    // ⚠️ `renderer` = the one that DRAWS the TV (the foreground's, see the header). That
    // canvas runs `autoClear = false` and clears to transparent, so the target is cleared
    // by hand, and the clear colour the replay's background leaves behind is put back —
    // otherwise the next frame's `foreground.clear()` paints the whole arena navy.
    prerender(renderer) {
      if (!rp?.live || !tv.visible || !tvRT) return;
      const prev = renderer.getRenderTarget(), exp = renderer.toneMappingExposure, cc = new THREE.Color(), ca = renderer.getClearAlpha();
      renderer.getClearColor(cc);
      renderer.toneMappingExposure = 1;
      try { renderer.setRenderTarget(tvRT); renderer.setClearColor(rp.scene.background, 1); renderer.clear(); renderer.render(rp.scene, rp.cam); }
      finally { renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca); renderer.toneMappingExposure = exp; }
    },
    /** The lens while he has the stage, or null. `from` = the lens to ease in from; `wide` = the game's ◈ Arena view. */
    camera(now, aspect, { follow = true, from = null, wide: w = null, reduced = false } = {}) {
      if (w) wide = { position:w.position.clone(), target:w.target.clone() };
      if (!show || !follow || L.cam !== 'follow') return null;
      const t = secs(now), T = show.timeline;
      if (t < 0 || t > T.T + .6) return null;
      const dt = camState ? Math.min(.1, Math.max(0, (now - camState.at) / 1000)) : 0;
      if (!camState) camState = { position:(from?.position ?? wide.position).clone(), target:(from?.target ?? wide.target).clone(), at:now };
      camState.at = now;
      const park = parkPoint(), rv = T.segs.find(s => s.id === 'reveal'), te = T.segs.find(s => s.id === 'tease');
      const goal = { position:V(0, 0, 0), target:V(0, 0, 0) };
      const isWide = (L.wideReveal === 'wide' && t >= rv.hit - .1) || t >= T.T;
      if (isWide) { goal.position.copy(wide.position); goal.target.copy(wide.target); }
      else {
        const dir = wide.position.clone().sub(park).setY(0).normalize();
        const push = t >= te.t0 && t < rv.hit ? 1 - L.camPush * smooth((t - te.t0) / Math.max(.1, rv.hit - te.t0)) : 1;
        const rs = riffSeg()?.tv;
        const tvK = rs && L.riffShow !== 'card' ? smooth((t - rs.in) / .7) * (1 - smooth((t - rs.rise) / .7)) : 0;
        const dist = L.camDist * push * Math.max(.6, L.size / 2.4) * (1 + L.tvZoomOut * tvK) * Math.max(1, 1.5 / Math.max(.5, aspect));
        // aim at his chest, off-centre so the cards and his words have the middle
        const right = V(0, 0, 0).crossVectors(dir.clone().negate(), Y_UP).normalize();
        const side = { right:-1, centre:0, left:1 }[L.frameSide] * 1.7 * (dist / 11);
        goal.target.copy(park).add(V(0, .62 * L.size, 0)).addScaledVector(right, side);
        if (tvK > 0) goal.target.lerp(tvBase().add(park.clone().add(V(0, .62 * L.size, 0))).multiplyScalar(.5), tvK * .85);
        goal.position.copy(goal.target).addScaledVector(dir, dist).add(V(0, L.camLift + .2 * L.size, 0));
        if (t < L.flyIn * .4) goal.target.lerp(group.position, .5);
      }
      const k = reduced ? 1 : 1 - Math.exp(-dt * (isWide ? 2.2 : 2.8));
      camState.position.lerp(goal.position, k); camState.target.lerp(goal.target, k);
      return { key:`fanmc:${show.key}`, position:camState.position.clone(), target:camState.target.clone(), blend:1, settled:true };
    },
    /** The call's light: the tease's dim and the flash (the renderer's exposure). */
    light(now) {
      if (!show) return { dim:0, flash:0 };
      const t = secs(now), T = show.timeline, te = T.segs.find(s => s.id === 'tease');
      const dim = t >= te.t0 && t < T.hit ? L.dim * smooth((t - te.t0) / .5) : 0;
      const since = t - T.hit, flash = since >= 0 && since < 1.2 ? (1 - since / 1.2) ** 2 * L.flash : 0;
      return { dim, flash };
    },
    /** Project his head and the TV onto the page (viewport px — `rect` is the arena's
     *  getBoundingClientRect), for the overlay's bubble. */
    screen(camera, rect, now = performance.now()) {
      const { left = 0, top = 0, width:w = 1, height:h = 1 } = rect ?? {};
      FAN_MC_SCREEN.w = w; FAN_MC_SCREEN.h = h; FAN_MC_SCREEN.at = now;
      if (!show || !group.visible) { FAN_MC_SCREEN.head = null; FAN_MC_SCREEN.tv = null; return FAN_MC_SCREEN; }
      camera.updateMatrixWorld();
      tmp.copy(group.position).add(V(0, .7 * L.size, 0)).project(camera);
      FAN_MC_SCREEN.head = tmp.z < 1 ? { x:left + (tmp.x * .5 + .5) * w, y:top + (-tmp.y * .5 + .5) * h } : null;
      if (tv.visible) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        tv.updateMatrixWorld();
        for (const [x, y] of [[-1.2, -.8], [1.2, -.8], [-1.2, .8], [1.2, .8]]) {
          const p = tvBody.localToWorld(V(x, y, .13)).project(camera), sx = left + (p.x * .5 + .5) * w, sy = top + (-p.y * .5 + .5) * h;
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
        FAN_MC_SCREEN.tv = { x0, y0, x1, y1 };
      } else FAN_MC_SCREEN.tv = null;
      return FAN_MC_SCREEN;
    },
    busy(now) { return !!show && secs(now) < show.timeline.T + .8; },
    diagnostics(now = performance.now()) {
      return { live:!!show, t:show ? +secs(now).toFixed(2) : null, mc:group.visible, tv:tv.visible, replay:!!rp?.live, wash:wash.visible };
    },
    dispose() {
      disposeReplay(); dress?.dispose(); sticks?.dispose(); tvRT?.dispose(); tvOverlay?.dispose();
      group.removeFromParent(); tv.removeFromParent(); wash.removeFromParent(); washLight.removeFromParent(); spot.removeFromParent(); spot.target.removeFromParent();
    },
  };
}
