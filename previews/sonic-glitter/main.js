import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSonicZigzagVisuals, RING_TUNING } from '../../src/board/sonicZigzagVisuals.js';
import { DEFAULTS, LIMITS, PRESETS, normalizeSettings, readRingStations } from './spiral.js';
import { sonicClashBeamTime, SONIC_CLASH_LOOK } from '../../src/board/sonicClashVisuals.js';
import { barrageSimulationTime, SONIC_BEATS } from '../../src/board/sonicBarrageTiming.js';

const root = document.getElementById('sonic-glitter-lab');
const $ = selector => root.querySelector(selector);
const $$ = selector => [...root.querySelectorAll(selector)];
const host = $('#scene');
const STORE = 'rlsw.sonic-glitter.preview.approved-2026-10-03';
const previewBattle = { shots: [{}], breakIndex: -1 };
const attackDuration = SONIC_BEATS.flight + SONIC_BEATS.hitstop + SONIC_CLASH_LOOK.settle;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let settings = { ...DEFAULTS }, preset = 'Approved', mode = 'inspect', layer = 'combined';
let playing = !motionPreference.matches, time = .95, glitterTime = 0, speed = .35, disposed = false;
let wave = { ringGap: RING_TUNING.ringGap, beamRadius: RING_TUNING.beamRadius };

function restore(value) {
  if (value?.version !== 1) return;
  settings = normalizeSettings(value.glitter);
  preset = Object.hasOwn(PRESETS, value.preset) ? value.preset : 'Custom';
  if (value.wave) {
    for (const [key, min, max] of [['ringGap', .22, .8], ['beamRadius', .3, 1.1]]) {
      const n = Number(value.wave[key]);
      if (Number.isFinite(n)) wave[key] = THREE.MathUtils.clamp(n, min, max);
    }
  }
}
try { restore(JSON.parse(localStorage.getItem(STORE))); } catch { /* Defaults work without storage. */ }

const sliderGroups = {
  shape: [
    ['turns', 'Spiral turns', .1, 'turns'], ['strands', 'Strands', 1, 'count'],
    ['radius', 'Spiral radius', .01, 'percent'], ['spread', 'Ribbon spread', .005, 'percent'],
  ],
  glitter: [
    ['density', 'Particle density', 100, 'count'], ['size', 'Spark size', .1, 'size'],
    ['brightness', 'Glitter brightness', .05, 'percent'], ['twinkle', 'Twinkle', .05, 'percent'],
  ],
  motion: [
    ['spin', 'Spiral rotation', .01, 'rotation'], ['flow', 'Particle flow', .01, 'flow'],
    ['filament', 'Spiral thread', .005, 'percent'], ['iridescence', 'Iridescence', .05, 'percent'],
  ],
  ring: [
    ['ringOpacity', 'Ring brightness', .05, 'percent'], ['coreOpacity', 'Axial filament', .05, 'percent'],
  ],
};
const format = (value, unit) => {
  if (unit === 'percent') return `${Math.round(value * 100)}%`;
  if (unit === 'count') return value.toLocaleString('en-US');
  if (unit === 'rotation') return `${value.toFixed(2)} rev/s`;
  if (unit === 'flow') return `${value.toFixed(2)} lengths/s`;
  if (unit === 'turns') return `${value.toFixed(1)} turns`;
  if (unit === 'size') return `${value.toFixed(1)}×`;
  return value.toFixed(2);
};
function addSlider(group, key, label, min, max, step, unit, isWave = false) {
  const wrapper = document.createElement('label');
  wrapper.className = 'slider';
  wrapper.htmlFor = `control-${key}`;
  wrapper.innerHTML = `<span class="control-heading"><span>${label}</span><output id="value-${key}" for="control-${key}"></output></span><input id="control-${key}" type="range" min="${min}" max="${max}" step="${step}" data-setting="${key}" aria-label="${label}">`;
  $(`#${group}-controls`).append(wrapper);
  const input = wrapper.querySelector('input'), output = wrapper.querySelector('output');
  const sync = () => { const value = (isWave ? wave : settings)[key]; input.value = value; output.value = format(value, unit); };
  input.addEventListener('input', () => {
    (isWave ? wave : settings)[key] = Number(input.value);
    preset = 'Custom';
    sync();
    if (isWave) buildWave();
    syncPreset();
  });
  input.addEventListener('change', persist);
  sync();
  return sync;
}
const syncSliders = [];
for (const [group, sliders] of Object.entries(sliderGroups)) {
  for (const [key, label, step, unit] of sliders) syncSliders.push(addSlider(group, key, label, ...LIMITS[key], step, unit));
}
syncSliders.push(addSlider('ring', 'ringGap', 'Ring spacing', .22, .8, .01, '', true));
syncSliders.push(addSlider('ring', 'beamRadius', 'Beam radius', .3, 1.1, .01, '', true));

const scene = new THREE.Scene();
scene.background = new THREE.Color('#080e15');
const camera = new THREE.PerspectiveCamera(37, 1, .05, 200);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (error) {
  $('#error').hidden = false;
  $('#error').textContent = `The 3D preview could not start. Try opening it in a browser with WebGL enabled. ${error.message}`;
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.domElement.setAttribute('aria-label', 'Sonic ring beam with interior spiral glitter');
host.append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.minDistance = 2;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * .95;

const grid = new THREE.GridHelper(60, 60, '#1c3341', '#162733');
grid.position.y = -.3;
grid.material.transparent = true;
grid.material.opacity = .3;
scene.add(grid);
const stage = new THREE.Group();
scene.add(stage);
const markerMaterial = new THREE.MeshBasicMaterial({ color: '#81cfc9', transparent: true, opacity: .4 });
for (const x of [-8, 6]) {
  const marker = new THREE.Mesh(new THREE.RingGeometry(.48, .51, 48), markerMaterial);
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(x, -.28, 0);
  stage.add(marker);
}

let visual, spiral, shot, rings, threads;
function buildWave() {
  visual?.dispose();
  visual = createSonicZigzagVisuals({
    ampOrigins: [new THREE.Vector3(-8, 1.7, 0)], attackerPosition: new THREE.Vector3(-5, 1.7, 0),
    defenderPosition: new THREE.Vector3(6, 1.7, 0),
    dice: [{ value: 6, sides: 6, passed: false }], chordPitches: [0],
    color: '#63d9ed', shieldColor: '#beadef', shieldValue: 4, shieldRadius: 1.3,
    intensityMode: 'face', strokeStyle: 'rings', tuning: { ...wave }, glitterCapacity: LIMITS.density[1],
  });
  scene.add(visual.group);
  shot = visual.group.children.find(object => object.name.startsWith('Sonic die'));
  rings = shot.children.filter(object => object.name === 'Harmonic wave rings');
  threads = shot.children.filter(object => object.name === 'Harmonic wave thread');
  spiral = visual.group.getObjectByName('Sonic inner spiral glitter');
  visual.setResolution(host.clientWidth, host.clientHeight);
}
buildWave();

function frameCamera() {
  visual.update(mode === 'inspect' ? Math.min(time, 1.58) : .85, { camera });
  const stations = readRingStations(rings[0]);
  const target = new THREE.Vector3(0, 1.7, 0);
  if (mode === 'inspect' && stations.length > 1) target.copy(stations[0].center).lerp(stations.at(-1).center, .5);
  controls.target.copy(target);
  const narrow = host.clientWidth / host.clientHeight < 1.1;
  const distance = mode === 'attack' ? (narrow ? 24 : 19) : (narrow ? 17 : 12.5);
  const view = $('#camera').value;
  const offset = view === 'front' ? new THREE.Vector3(distance, 1.0, .3)
    : view === 'side' ? new THREE.Vector3(0, 1, distance)
    : new THREE.Vector3(-distance * .36, distance * .32, distance * .9);
  camera.position.copy(target).add(offset);
  camera.lookAt(target);
  controls.update();
}
const resize = () => {
  const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  visual.setResolution(width, height);
};
const observer = new ResizeObserver(resize);
observer.observe(host);
resize();
frameCamera();

function snapshot() {
  return { version: 1, effect: 'Sonic inner spiral glitter', preset, glitter: { ...settings }, wave: { ...wave } };
}
function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(snapshot())); } catch { /* Copy is also available. */ }
}
function syncPreset() {
  $$('[data-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preset === preset)));
  $('#settings-status').textContent = preset;
  $('#copy-fallback').hidden = true;
}
function syncTransport() {
  $('#play').textContent = playing ? 'Pause' : 'Play';
  $('#play').setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
  $$('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  $('#view-caption').textContent = mode === 'inspect' ? `HELD WAVE / ${playing ? 'LIVE GLITTER' : 'PAUSED'}` : `ATTACK / ${playing ? 'SLOW-MOTION LOOP' : 'PAUSED'}`;
  $('#speed').disabled = mode === 'inspect';
  $('#timeline').max = mode === 'inspect' ? visual.duration : attackDuration;
  $('#time-value').value = `${time.toFixed(2)} s`;
  $('#timeline').value = time;
}
$$('[data-preset]').forEach(button => button.addEventListener('click', () => {
  preset = button.dataset.preset;
  settings = { ...PRESETS[preset] };
  syncSliders.forEach(sync => sync());
  syncPreset(); persist();
}));
$$('[data-layer]').forEach(button => button.addEventListener('click', () => {
  layer = button.dataset.layer;
  $$('[data-layer]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.layer === layer)));
}));
$$('[data-mode]').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.mode;
  time = mode === 'inspect' ? .95 : 0;
  buildWave(); frameCamera(); syncTransport();
}));
$('#play').addEventListener('click', () => { playing = !playing; syncTransport(); });
$('#speed').addEventListener('change', () => { speed = Number($('#speed').value); });
$('#camera').addEventListener('change', frameCamera);
$('#timeline').addEventListener('input', () => { time = Number($('#timeline').value); playing = false; syncTransport(); });
$('#reset').addEventListener('click', () => {
  settings = { ...DEFAULTS }; wave = { ringGap: RING_TUNING.ringGap, beamRadius: RING_TUNING.beamRadius };
  preset = 'Approved'; syncSliders.forEach(sync => sync()); syncPreset(); buildWave(); persist();
});
$('#copy').addEventListener('click', async () => {
  const text = JSON.stringify(snapshot(), null, 2);
  try { await navigator.clipboard.writeText(text); $('#settings-status').textContent = 'Settings copied'; }
  catch {
    const fallback = $('#copy-fallback');
    fallback.hidden = false; fallback.value = text; fallback.focus(); fallback.select();
    $('#settings-status').textContent = 'Select and copy below';
  }
});
motionPreference.addEventListener('change', event => { if (event.matches) { playing = false; syncTransport(); } });
syncPreset(); syncTransport();

let last = performance.now();
function animate(now) {
  if (disposed) return;
  const dt = Math.min(.06, (now - last) / 1000);
  last = now;
  if (playing && !document.hidden) {
    glitterTime += dt * (mode === 'attack' ? speed : 1);
    if (mode === 'attack') {
      time = (time + dt * speed) % (attackDuration + .35);
      $('#timeline').value = Math.min(time, attackDuration);
      $('#time-value').value = `${Math.min(time, attackDuration).toFixed(2)} s`;
    }
  }
  const beamTime = mode === 'inspect' ? time : sonicClashBeamTime(barrageSimulationTime(previewBattle, time));
  visual.update(beamTime, { camera, glitterSettings: settings, glitterTime: mode === 'inspect' ? glitterTime : beamTime });
  spiral.visible &&= layer !== 'rings';
  if (mode === 'inspect') for (const child of visual.group.children) if (child !== shot && child !== spiral) child.visible = false;
  for (const ring of rings) ring.visible &&= layer !== 'glitter';
  for (const thread of threads) thread.visible &&= layer !== 'glitter';
  grid.visible = mode === 'attack';
  stage.visible = mode === 'attack';
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Also release the preview's resources when a tab is discarded or navigated.
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed = true; observer.disconnect(); controls.dispose(); visual.dispose();
  grid.geometry.dispose(); grid.material.dispose();
  stage.children.forEach(marker => marker.geometry.dispose()); markerMaterial.dispose(); renderer.dispose();
});
