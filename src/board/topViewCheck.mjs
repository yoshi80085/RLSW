// ⌗ THE TOP-DOWN VIEW IS A LOCK (Alex, 2026-09-24): "If the camera is set to
// top-down view, don't let the camera wander … keep it as is permanently. So —
// same goes for the battle sequence … let the battle play out as it normally
// would (no slow motion or anything) but each action still plays out."
// And the same day: *"Make sure top-down does not 'equal' stationary. Any
// movement that tilts the axis means not top-down … just zooming in or out …
// still keeps with top-down view. A separate option to keep stationary …"*
// §1 the clocks (behavioural) · §2 the held battle lens (behavioural, real
// sonicCamera) · §3 the wiring the two depend on (source) · §4 the top-down
// AXIS (behavioural) · §5 📌 Hold · §6 🧱 the solid layer (amps/fans/dice).
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { resolveSonicBarrage } from '../engine/systems/sonicBarrage.js';
import { arenaFrame } from './arenaFrame.js';
import { barrageContact, barrageTime, barrageSimulationTime, barrageHitstop, barrageLanded, barrageRealtime, BARRAGE_LAUNCH, SONIC_GATE } from './sonicBarrageTiming.js';
import { scheduleSonicBarrage } from './sonicPresentation.js';
import { barrageDelay } from '../audio/sonicBarrageAudio.js';
import { createSonicCamera } from './sonicCamera.js';
import { TOP_OFFSET, TOP_TOLERANCE, onTopAxis, topAxisAngle } from './topDownView.js';
import { SOLID_LAYER, isSolidMesh, markSolid, markOccluders, OCCLUDER_LAYER } from './solidLayer.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.log('  ❌ ' + name); } };
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const near = (a, b) => Math.abs(a - b) < 1e-9;

console.log('§1 a top-down bout keeps real time on every clock');
const drive = [6, 5, 4, 6, 3], ledger = resolveSonicBarrage(drive, 12);
const base = { attackerId: 'a', defenderId: 'b', sonicAttack: true, sonicVersion: 2, sonicId: 'top', phase: 'sonic_roll',
  dicePool: drive.map(() => 6), diceVals: drive, diceHits: ledger.shots.map(s => s.through > 0), shieldValue: 12, ...ledger };
const top = { ...base, realtime: true };
ok('the test bout really breaks the shield (so there IS a slow burst to remove)', base.breakIndex >= 0);
ok('barrageRealtime: off by default, on for reduced motion, on for a top-down bout', !barrageRealtime(base) && barrageRealtime(base, true) && barrageRealtime(top));
let identity = true, noStops = true;
for (let t = 0; t < 9; t += .013) {
  identity &&= near(barrageTime(top, t), t) && near(barrageSimulationTime(top, t), t);
  noStops &&= barrageHitstop(top, t) === null;
}
ok('picture clock = wall clock (no freezes, no slow burst)', identity);
ok('no hit-stop anywhere, so the lens never shakes', noStops);
ok('…while the normal bout still has both (the flag is what removes them)',
  barrageHitstop(base, barrageTime(base, barrageContact(0)) + .1) !== null && barrageTime(base, 6) > 6 + .5);
ok('every beat still plays: each contact lands, at its own real second', ledger.shots.every(s => near(barrageTime(top, barrageContact(s.index)), barrageContact(s.index))));
ok('the result lands exactly when a reduced-motion bout would', near(barrageLanded(top), barrageLanded(base, true)) && barrageLanded(top) < barrageLanded(base));
const plan = { ...top, shots: top.shots.map(s => ({ ...s, at: BARRAGE_LAUNCH + barrageContact(s.index) })) };
const last = plan.shots.at(-1).at;
ok('the chords run on the same real clock (shield release delay)', near(barrageDelay(plan, last, SONIC_GATE), last - SONIC_GATE));
const timers = b => { const at = []; scheduleSonicBarrage({ battle: b, schedule: (fn, ms) => at.push(ms), phase() {}, close() {} }); return at; };
ok('the rules\' result timer is the realtime one', near(timers(top).at(-2), timers(base).at(-2) - (barrageLanded(base) - barrageLanded(top)) * 1000));
const spirits = [{ id: 'a', num: 7, corner: 'blue', color: '#62dbff' }, { id: 'b', num: 16, corner: 'red', color: '#b0a0ff' }];
ok('arenaFrame carries the flag to the renderer', arenaFrame({ spirits, noteStates: {}, battle: top }).battle.realtime === true
  && arenaFrame({ spirits, noteStates: {}, battle: base }).battle.realtime === false);

console.log('§2 the battle director cannot take a locked lens');
{
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, .1, 500);
  const controls = { target: new THREE.Vector3(0, 0, 0), enabled: true, enableDamping: true, update() {} };
  camera.position.set(0, 33, 12); camera.lookAt(controls.target);
  const sonic = createSonicCamera({ camera, controls, pointFor: () => new THREE.Vector3() });
  sonic.autoCamera(false); // what arenaRenderer's syncBattleCamera does under ⌗ Top
  const frame = { battle: { volley: true, key: 'k', phase: 'sonic_volley', attackerId: 'a', defenderId: 'b' }, spirits: [] };
  const directed = { key: 'charge', pos: new THREE.Vector3(9, 2, 9), target: new THREE.Vector3(3, 1, 3), fov: 22, focus: 6 };
  const before = camera.position.clone(), fov = camera.fov;
  for (let i = 0; i < 30; i++) sonic.update(frame, null, 1 / 60, false, directed);
  ok('a directed shot never moves the camera', camera.position.equals(before) && controls.target.lengthSq() === 0);
  ok('…nor zooms it, nor asks for depth of field', camera.fov === fov && sonic.focusDistance === null);
  ok('the renderer is told it is held (no speed lines, no bokeh)', sonic.active && sonic.manual);
  sonic.update({ spirits: [] }, null, 1 / 60, false, null);
  ok('when the bout ends nothing flies back: the camera stays where it is', camera.position.equals(before) && !sonic.active);

  // Switching to Top MID-shot: the zoom the director had applied comes off at once.
  const cam2 = new THREE.PerspectiveCamera(40, 1, .1, 500), ctl2 = { target: new THREE.Vector3(), enabled: true, enableDamping: false, update() {} };
  const s2 = createSonicCamera({ camera: cam2, controls: ctl2, pointFor: () => new THREE.Vector3() });
  s2.update(frame, null, 1 / 60, false, directed);
  ok('(control) an auto camera does take the directed zoom', Math.abs(cam2.fov - 22) < 1e-9);
  s2.autoCamera(false);
  ok('turning the lock on mid-shot restores the lens fov', cam2.fov === 40 && s2.focusDistance === null);
}

console.log('§3 the wiring');
{
  const r = read('./arenaRenderer.js'), v = read('../ui/BoardViewport.jsx'), c = read('../rlsw-simulator-v3_8_1.jsx');
  ok('renderer: the auto camera is never asked while top-down is on (and idle flow gets no shot to drift)', /cameraShot=autoCamera&&!topView\?director\.update\(/.test(r));
  ok('renderer: the battle lens follows the lock', /syncBattleCamera=\(\)=>sonicCamera\.autoCamera\(autoCamera&&!topView\)/.test(r) && /autoCamera\(on\)\{[^}]*syncBattleCamera\(\)/.test(r));
  ok('renderer: only ⌗ Top sets it, any other view clears it', /view\(name\)\{const top=name==='tactical';/.test(r));
  ok('renderer: "Follow battle" cannot unlock it', /followBattle\(\)\{if\(topView\)return;/.test(r));
  ok('renderer: the badge says top', /reportCamera\(topView\?'top':/.test(r));
  // 🎛️ Since 2026-09-25 the view buttons are ☰ → Camera view rows, reaching the
  // runtime through BoardViewport's cameraRef.view(name) with the same meanings.
  ok('viewport: Top sets it, Arena and Spirit clear it, a saved choice is applied on mount', /if \(name === 'top'\) \{ latest\.current\.onTopView\?\.\(true\); runtime\.current\?\.view\('tactical'\); return; \}/.test(v)
    && /latest\.current\.onTopView\?\.\(false\);\s*runtime\.current\?\.view\(name === 'spirit' \? 'focus' : 'arena'\)/.test(v)
    && /if \(latest\.current\.topView\) runtime\.current\.view\('tactical'\)/.test(v));
  ok('client: ☰ shows the lock (Camera view reads "Top", Top-down lit)', /value: topView \? 'Top' : undefined/.test(c) && /id:'top',\s+icon:'⌗', label:'Top-down', accent:'#c9d8ea', on: topView/.test(c));
  ok('client: persisted locally, default OFF', /localStorage\.getItem\('rlsw\.topView'\) === '1'/.test(c));
  ok('client: the flag is stamped once, at the start of the Sonic presentation', /function startSonicPresentation\(verdict, remoteView = false\) \{[\s\S]{0,400}if\(board3D&&topViewRef\.current\)verdict=\{\.\.\.verdict,realtime:true\};/.test(c));
  ok('client: hands the lock to the arena', /topView=\{topView\} onTopView=\{setTopView\}/.test(c));
}

console.log('§4 top-down is an axis: zoom and pan keep it, tilt and turn end it');
{
  const target = { x: 1.5, y: 0, z: -2 }, at = d => ({ x: target.x + TOP_OFFSET[0] * d, y: target.y + TOP_OFFSET[1] * d, z: target.z + TOP_OFFSET[2] * d });
  ok('the ⌗ Top preset itself is on the axis, at any distance', [12, 35, 110].every(d => onTopAxis(at(d), target)));
  const pos = at(35), shift = { x: 7.2, y: 0, z: -4.1 }, moved = p => ({ x: p.x + shift.x, y: p.y + shift.y, z: p.z + shift.z });
  ok('a pan (lens and target move together) keeps it', onTopAxis(moved(pos), moved(target)));
  ok('a zoom (lens slides along the line) keeps it, in and out', onTopAxis(at(35 * .85 ** 6), target) && onTopAxis(at(35 * 1.18 ** 4), target));
  const orbit = (p, dTheta, dPhi) => { // the same spherical step OrbitControls takes
    const v = { x: p.x - target.x, y: p.y - target.y, z: p.z - target.z }, r = Math.hypot(v.x, v.y, v.z);
    const theta = Math.atan2(v.x, v.z) + dTheta, phi = Math.acos(v.y / r) + dPhi;
    return { x: target.x + r * Math.sin(phi) * Math.sin(theta), y: target.y + r * Math.cos(phi), z: target.z + r * Math.sin(phi) * Math.cos(theta) };
  };
  ok('a tilt of one degree ends it', !onTopAxis(orbit(pos, 0, Math.PI / 180), target) && !onTopAxis(orbit(pos, 0, -Math.PI / 180), target));
  ok('a turn of three degrees ends it', !onTopAxis(orbit(pos, 3 * Math.PI / 180, 0), target));
  ok('the tolerance is float noise only (≤ 0.5°)', TOP_TOLERANCE <= Math.PI / 360 && topAxisAngle(at(35), target) < 1e-6);
  ok('a degenerate lens (on its own target) is not top-down', !onTopAxis(target, target));
}

console.log('§5 📌 Hold = the Auto camera switch, off (the ☰ toggle since 2026-09-25)');
{
  const r = read('./arenaRenderer.js'), v = read('../ui/BoardViewport.jsx'), c = read('../rlsw-simulator-v3_8_1.jsx');
  ok('renderer: leaving the axis ends top-down and tells the client', /function leaveTopIfTilted\(\)\{\s*if\(!topView\|\|onTopAxis\(camera\.position,controls\.target\)\)return;\s*topView=false;syncBattleCamera\(\);onTopView\?\.\(false\);/.test(r)
    && /const change=\(\)=>\{dirty=true;leaveTopIfTilted\(\);\}/.test(r));
  ok('renderer: ⌗ Top places the lens on the SAME axis it is judged by', /camera\.position\.set\(\.\.\.TOP_OFFSET\)/.test(r) && /import \{ TOP_OFFSET, onTopAxis \} from '\.\/topDownView\.js'/.test(r));
  ok('renderer: a preset does not inherit a flick\'s damping tail', /controls\._sphericalDelta\?\.set\(0,0,0\)/.test(r));
  ok('viewport: the arena\'s "tilted off" reaches the client', /onTopView: on => \{ if \(!cancelled\) latest\.current\.onTopView\?\.\(on\); \}/.test(v));
  // 🎛️ The toolbar's 📌 Hold was the ☰ Auto camera switch inverted; with the
  // toolbar folded into ☰ it is not listed twice — one switch, still default ON.
  ok('viewport: no second "Hold" switch (the ☰ Auto camera toggle is the one setting)', !/📌 Hold/.test(v) && !/onAutoCamera/.test(v));
  ok('client: the ☰ toggle drives setAutoCamera, and Auto camera still defaults ON', /kind:'toggle', icon:'🎥', label:'Auto camera'/.test(c) && /onClick:\(\) => setAutoCamera\(v => !v\)/.test(c) && /localStorage\.getItem\('rlsw\.autoCamera'\) !== '0'/.test(c));
  ok('⌗ Top from ☰ still turns top-down on and frames it', /if \(name === 'top'\) \{ latest\.current\.onTopView\?\.\(true\); runtime\.current\?\.view\('tactical'\)/.test(v));
  // What "held" must mean, in the renderer: no director, no idle flow, no battle shot.
  ok('held = no director (idle flow then has no shot to drift) and no battle lens', /cameraShot=autoCamera&&!topView\?director\.update\(/.test(r) && /sonicCamera\.autoCamera\(autoCamera&&!topView\)/.test(r));
}

console.log('§6 🧱 amps, fans and dice are a solid layer above the board');
{
  const box = () => new THREE.BoxGeometry(1, 1, 1);
  const amp = new THREE.Mesh(box(), new THREE.MeshStandardMaterial());
  const fanBody = new THREE.Mesh(box(), new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false })); // cosmicFans' body: transparent for its tail, opacity 1
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, blending: THREE.AdditiveBlending }));
  const glow = new THREE.Mesh(box(), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending }));
  const shadow = new THREE.Mesh(box(), new THREE.MeshBasicMaterial({ transparent: true, opacity: .48 }));
  const label = new THREE.Mesh(box(), new THREE.MeshBasicMaterial({ transparent: true, map: new THREE.Texture() }));
  ok('solid: an amp cabinet and a fan\'s body', isSolidMesh(amp) && isSolidMesh(fanBody));
  ok('not solid: halos, additive glows, a faint shadow, a clear-backed label card', !isSolidMesh(halo) && !isSolidMesh(glow) && !isSolidMesh(shadow) && !isSolidMesh(label));
  const root = new THREE.Group(); root.add(amp, fanBody, halo, glow, shadow, label);
  ok('markSolid tags exactly the solid ones', markSolid([root]) === 2 && amp.layers.isEnabled(SOLID_LAYER) && !halo.layers.isEnabled(SOLID_LAYER));
  ok('…and never takes them off the arena layer', [amp, fanBody, halo].every(o => o.layers.isEnabled(0)));
  fanBody.material.opacity = .2; markSolid([root]);
  ok('re-marked every frame: a mesh that fades out drops off', !fanBody.layers.isEnabled(SOLID_LAYER));
  const r = read('./arenaRenderer.js'), vis = read('./arenaVisuals.js');
  ok('renderer: clear once, copy the solids, THEN the standees on the same depth', /foreground\.clear\(\);markSolid\(\[crowd\.group,\.\.\.visuals\.solidRoots\(\)\]\);solid\.render\(scene,camera\);foreground\.render\(foregroundScene,camera\);/.test(r)
    && /foreground\.autoClear=false/.test(r));
  ok('renderer: the copy runs AFTER the arena is drawn (its pixels are the source)', r.indexOf('composer.render();') < r.indexOf('solid.render(scene,camera)'));
  ok('visuals: every amp tier and the Sonic floor dice are solid roots', /solidRoots:\(\)=>\[\.\.\.\[\.\.\.rigs\.values\(\)\]\.flatMap\(r=>r\.levels\),sonic\?\.dice\?\.group\]/.test(vis));
  const src = read('./solidLayer.js');
  // 🪦 2026-09-25: the pixel copy drew black glass on Alex's GPU. It is a re-draw now.
  ok('the solids are RE-DRAWN with their own materials — no canvas copy', !/CanvasTexture|gl_FragCoord|uSolidSource/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
  ok('…depth first (a transparent fan body still hides a standee behind it), then colour with no override',
    /scene\.overrideMaterial = depthOnly; foreground\.render\(scene, camera\);\s*camera\.layers\.set\(SOLID_LAYER\);\s*scene\.overrideMaterial = overrideMaterial; foreground\.render\(scene, camera\);/.test(src));
  // 🪨 2026-09-25: the amps' bases are modelled half a unit INTO the Stage; the
  // re-draw painted them on top of the board as a plinth until the ground joined
  // the depth pass. Depth: solids + ground. Colour: solids only.
  ok('🪨 the depth pass also holds the ground (Stage, Island) so buried amp bases stay buried',
    /camera\.layers\.enable\(OCCLUDER_LAYER\);\s*scene\.overrideMaterial = depthOnly/.test(src)
    && /markOccluders\(\[model\.getObjectByName\('Stage'\),model\.getObjectByName\('Island'\)\]\)/.test(r));
  {
    const ground = new THREE.Group(); const slab = new THREE.Mesh(box(), new THREE.MeshStandardMaterial()); ground.add(slab);
    ok('🪨 markOccluders tags the ground on its own layer, never the solid one', markOccluders([ground, null]) === 1
      && slab.layers.isEnabled(OCCLUDER_LAYER) && !slab.layers.isEnabled(SOLID_LAYER) && slab.layers.isEnabled(0));
  }
  ok('…lit by the arena\'s own lights (a light off the layer is not in the room), and only for this pass',
    /o\.isLight && !o\.layers\.isEnabled\(SOLID_LAYER\)/.test(src) && /for \(const o of lit\) o\.layers\.disable\(SOLID_LAYER\)/.test(src));
  ok('…at the arena\'s tone mapping and exposure', /foreground\.toneMapping = renderer\.toneMapping;/.test(src) && /foreground\.toneMappingExposure = renderer\.toneMappingExposure;/.test(src));
}

console.log(fail ? `\n❌ topViewCheck: ${fail} failed, ${pass} passed` : `\n✅ topViewCheck: ${pass} assertions passed`);
process.exit(fail ? 1 : 0);
