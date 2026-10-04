import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSonicClashVisuals } from '../../src/board/sonicClashVisuals.js';
import { barrageSimulationTime, barrageTime } from '../../src/board/sonicBarrageTiming.js';
import { createDuelWaveforms } from '../../src/board/riffWaveforms.js';
import { createSwingClashVisuals } from '../../src/board/swingClashVisuals.js';
import { SWING_TIMING } from '../../src/board/swingTiming.js';

const $ = selector => document.querySelector(selector);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#080e15');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('#scene').append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(40, 1, .1, 150);
const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 4; controls.maxDistance = 60;
scene.add(new THREE.HemisphereLight('#c4ebf3', '#142636', 3));
const light = new THREE.DirectionalLight('#d1eaf7', 3); light.position.set(0, 8, 4); scene.add(light);
const grid = new THREE.GridHelper(40, 40, '#27404e', '#142731'); grid.material.transparent = true; grid.material.opacity = .5; scene.add(grid);
const fixed = new THREE.Group(); scene.add(fixed);
const actors = new THREE.Group(); fixed.add(actors);
const colors = ['#63d9ed', '#e7ad76'];
const origins = [V(-9, 1.6, -2), V(9, 1.6, -2)];
for (let i = 0; i < 2; i++) {
  const material = new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: .16 });
  const amp = new THREE.Mesh(new THREE.BoxGeometry(.8, 2.6, .8), material);
  amp.position.copy(origins[i]).setY(1.3); fixed.add(amp);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.5, .6, .12, 12), material);
  base.position.set(i ? 4 : -4, .06, 0); actors.add(base);
  const actor = new THREE.Mesh(new THREE.CapsuleGeometry(.25, 1.1, 4, 8), material);
  actor.position.set(i ? 4 : -4, .9, 0); actors.add(actor);
}
const effects = new THREE.Group(); scene.add(effects);
const sonicBattle = { shieldValue: 8, diceVals: [3, 6, 5], dicePool: [6, 6, 6], sustainRolls: [4, 4], sustainPool: [6, 6], breakIndex: 1,
  shots: [{ index: 0, strength: 3, before: 8, after: 5, absorbed: 3, through: 0 },
    { index: 1, strength: 6, before: 5, after: 0, absorbed: 5, through: 1 },
    { index: 2, strength: 5, before: 0, after: 0, absorbed: 0, through: 5 }] };
const thrashBattle = { diceVals: [6, 5], defenderDiceVals: [3, 4], dicePool: [6, 6], defenderDicePool: [6, 6], atkTotal: 11, defTotal: 7, damage: 4, tied: false, attackerWon: true };
let effect = 'sonic', visual, time = 1.9, duration = 10, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, speed = 1;
let frameId, disposed = false;
const descriptions = {
  sonic: 'Your ring wave and glitter spiral, through compression, impact and shield break.',
  riff: 'Opposing ring streams with the same glitter helix, feeding a growing, revolving soundform.',
  thrash: 'Glitter helices only: each amp directs its charge into its Spirit. The stronger roll makes the stronger helix.',
};
function resize() {
  const host = $('#scene'); renderer.setSize(host.clientWidth, host.clientHeight, false);
  camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
}
function load(name) {
  visual?.dispose(); effects.clear(); effect = name;
  actors.visible = name !== 'thrash';
  $('#description').textContent = descriptions[name];
  if (name === 'sonic') {
    visual = createSonicClashVisuals({ battle: sonicBattle, attackerPosition: V(-4, 1.7, 0), defenderPosition: V(4, 1.7, 0),
      ampOrigins: [origins[0]], color: colors[0], shieldColor: colors[1], shieldRadius: 2.4, shieldSize: 2.1 });
    effects.add(visual.group); duration = barrageTime(sonicBattle, 5.7); time = 1.9;
  } else if (name === 'riff') {
    visual = createDuelWaveforms(effects, colors); visual.setOrigins(origins);
    visual.update({ time: 0, energy: [12, 10] }); time = 4; duration = 16;
  } else {
    visual = createSwingClashVisuals({ battle: thrashBattle, attacker: { num: 0, color: colors[0] }, defender: { num: 1, color: colors[1] },
      pointFor: n => V(n ? 4 : -4, .2, 0), ampOrigins: origins });
    effects.add(visual.group); duration = SWING_TIMING.close; time = SWING_TIMING.read;
  }
  camera.position.set(-1, 6, camera.aspect < 1 ? 30 : 21); controls.target.set(0, 1.6, 0); controls.update();
  $('#timeline').max = duration;
  document.querySelectorAll('[data-effect]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.effect === name)));
  sync();
}
function sync() {
  $('#play').textContent = playing ? 'Pause' : 'Play';
  $('#timeline').value = Math.min(time, duration); $('#time-value').value = `${Math.min(time, duration).toFixed(2)} s`;
}
document.querySelectorAll('[data-effect]').forEach(button => button.addEventListener('click', () => load(button.dataset.effect)));
$('#play').addEventListener('click', () => { playing = !playing; sync(); });
$('#speed').addEventListener('change', () => { speed = Number($('#speed').value); });
$('#timeline').addEventListener('input', () => { time = Number($('#timeline').value); playing = false; if (effect === 'riff') { visual.reset(); visual.update({ time: 0, energy: [12, 10] }); } sync(); });
const observer = new ResizeObserver(resize); observer.observe($('#scene')); resize(); load('sonic');
let previous = performance.now(), phase = '';
function draw(now) {
  if (disposed) return;
  const dt = Math.min(.06, (now - previous) / 1000); previous = now;
  if (playing && !document.hidden) { time += dt * speed; if (time > duration + .5) { time = 0; if (effect === 'riff') visual.reset(); } }
  let nextPhase;
  if (effect === 'sonic') {
    const sim = barrageSimulationTime(sonicBattle, time); visual.update(sim, { camera });
    nextPhase = sim < 2.4 ? 'Sonic · approach' : sim < 3.65 ? 'Sonic · shield impact' : sim < 4.9 ? 'Sonic · shield break' : 'Sonic · Spirit impact';
  } else if (effect === 'riff') {
    visual.update({ time: time * 1000, energy: [12, 10] }); nextPhase = 'Riff Off · opposing soundforms';
  } else {
    visual.update(time); nextPhase = time < SWING_TIMING.attackerAmp ? 'Thrash · roll and raise' : time < SWING_TIMING.rivalAmp ? 'Thrash · attacker charge' : time < SWING_TIMING.clash ? 'Thrash · both Spirits charged' : 'Thrash · clash';
  }
  if (phase !== nextPhase) { phase = nextPhase; $('#phase').textContent = phase; }
  sync(); renderer.render(scene, camera); frameId = requestAnimationFrame(draw);
}
frameId = requestAnimationFrame(draw);
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed = true; cancelAnimationFrame(frameId); observer.disconnect(); controls.dispose(); visual.dispose();
  const resources = new Set(); fixed.traverse(o => { if (o.geometry) resources.add(o.geometry); if (o.material) resources.add(o.material); });
  resources.forEach(r => r.dispose()); grid.geometry.dispose(); grid.material.dispose(); renderer.dispose();
});
