import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULTS, LIMITS, PRESETS, normalizeSettings, createShield } from './shield.js';
import { DAMAGE_DEFAULTS, DAMAGE_LIMITS, normalizeDamage, cycleDuration, breakTime, FIRST_HIT } from './damage.js';
import { createSonicClashVisuals } from './legacyShield.js';
import { createSpiralGlitter, createHelixStations, SONIC_GLITTER } from '../../src/board/sonicGlitter.js';

const root = document.getElementById('sustain-lab');
const $ = selector => root.querySelector(selector);
const $$ = selector => [...root.querySelectorAll(selector)];
// Keep the previous study's saved values available; this edition starts at
// Alex's pasted dial-in, then saves shape and damage controls together.
const host = $('#scene'), STORE = 'rlsw.sustain-shield.damage.v2';
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let settings = { ...DEFAULTS }, damage = { ...DAMAGE_DEFAULTS }, preset = 'Your shape', mode = 'cycle', layer = 'combined';
let time = 3, playing = !motionPreference.matches, speed = 1, manualHits = [], disposed = false;
try {
  const saved = JSON.parse(localStorage.getItem(STORE));
  if (saved?.version === 1 && saved.effect === 'Sustain living oval hex') {
    settings = normalizeSettings(saved.settings);
    damage = normalizeDamage(saved.damage);
    preset = Object.hasOwn(PRESETS, saved.preset) ? saved.preset : 'Custom';
  }
} catch { /* The study also works with storage disabled. */ }
function snapshot() {
  return { version: 1, effect: 'Sustain living oval hex', preset, baseline: 'Your shape · 2026-10-04', settings: { ...settings }, damage: { ...damage },
    changedFromDefault: Object.fromEntries(Object.entries(settings).filter(([key, value]) => value !== DEFAULTS[key])),
    damageChangedFromDefault: Object.fromEntries(Object.entries(damage).filter(([key, value]) => value !== DAMAGE_DEFAULTS[key])) };
}
function persist() { try { localStorage.setItem(STORE, JSON.stringify(snapshot())); } catch { /* Copy still works. */ } }
function syncPreset() {
  $$('[data-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preset === preset)));
  $('#settings-status').textContent = preset;
  $('#copy-fallback').hidden = true;
}
const format = (value, unit, step) => unit === '%' ? `${Number((value * 100).toFixed(1))}%`
  : unit === 'count' ? value.toLocaleString('en-US')
    : unit === 'deg' ? `${Math.round(value)}°` : `${value.toFixed(step < .01 ? 3 : 2)}${unit ? ` ${unit}` : ''}`;
const groups = {
  damage: [
    ['hits', 'Hits to break', 1, 'count'], ['interval', 'Time between hits', .1, 's'],
    ['shed', 'Glitter shed per hit', .05, '×'], ['throw', 'Hit spray distance', .05, '×'],
    ['linger', 'Glitter hang time', .1, 's'], ['fray', 'Ring fraying', .05, '%'],
    ['breakGlitter', 'Glitter on the break', .05, '×'], ['breakScatter', 'Break spread', .05, '×'],
    ['fragments', 'Loose ring fragments', 1, 'count'],
  ],
  shape: [
    ['width', 'Width', .05, ''], ['height', 'Height', .05, ''],
    ['hexness', 'Hex character', .01, '%'], ['rounding', 'Corner softness', .01, '%'],
    ['dome', 'Face curvature', .01, ''], ['rim', 'Edge thickness', .001, ''],
  ],
  ring: [
    ['rings', 'Ring count', 1, 'count'], ['ringLight', 'Ring brightness', .01, '%'],
    ['breath', 'Breathing amount', .005, '%'], ['pulse', 'Travelling pulse', .01, '%'],
  ],
  glitter: [
    ['coils', 'Spiral coils across face', .1, ''], ['turns', 'Helix turns', .1, ''],
    ['strands', 'Helix strands', 1, 'count'], ['spread', 'Helix spread', .005, ''],
    ['density', 'Glitter density', 100, 'count'], ['size', 'Spark size', .1, ''],
    ['brightness', 'Glitter brightness', .05, '%'],
  ],
  motion: [
    ['spin', 'Spiral rotation', .01, 'rev/s'], ['flow', 'Glitter flow', .01, ''],
    ['twinkle', 'Twinkle', .01, '%'], ['iridescence', 'Iridescence', .01, '%'],
    ['filament', 'Helix thread', .005, '%'], ['field', 'Surface glow', .01, '%'],
    ['strength', 'Sustain strength', .01, '%'], ['hue', 'Shield colour', 1, 'deg'],
  ],
};
const syncSliders = [];
for (const [group, rows] of Object.entries(groups)) for (const [key, label, step, unit] of rows) {
  const isDamage = group === 'damage', limits = isDamage ? DAMAGE_LIMITS : LIMITS;
  const wrapper = document.createElement('label'); wrapper.className = 'slider'; wrapper.htmlFor = `control-${key}`;
  wrapper.innerHTML = `<span class="control-heading"><span>${label}</span><output for="control-${key}"></output></span><input id="control-${key}" type="range" min="${limits[key][0]}" max="${limits[key][1]}" step="${step}" aria-label="${label}">`;
  $(`#${group}-controls`).append(wrapper);
  const input = wrapper.querySelector('input'), output = wrapper.querySelector('output');
  const sync = () => { const value = (isDamage ? damage : settings)[key]; input.value = value; output.value = format(value, unit, step); };
  input.addEventListener('input', () => {
    if (isDamage) {
      damage[key] = Number(input.value);
      if (key === 'hits') manualHits = [];
      syncTimeline();
    } else { settings[key] = Number(input.value); preset = 'Custom'; }
    sync(); syncPreset(); persist();
  });
  syncSliders.push(sync); sync();
}

const scene = new THREE.Scene(); scene.background = new THREE.Color('#080e15');
const camera = new THREE.PerspectiveCamera(35, 1, .05, 100);
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
catch (error) {
  $('#error').hidden = false; $('#error').textContent = `This 3D preview needs WebGL. ${error.message}`; throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
host.append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 4; controls.maxDistance = 30; controls.enableDamping = false;
scene.add(new THREE.HemisphereLight('#d9e8ff', '#182337', 2));
const keyLight = new THREE.DirectionalLight('#c5b6fa', 3); keyLight.position.set(2, 5, 6); scene.add(keyLight);
const grid = new THREE.GridHelper(30, 40, '#273042', '#1b2633');
grid.material.transparent = true; grid.material.opacity = .3; scene.add(grid);

const study = createShield(); study.group.position.y = 2.35; scene.add(study.group);
const old = createSonicClashVisuals({
  battle: { shieldValue: 8, sustainRolls: [4, 4], sustainPool: [6, 6], diceVals: [], shots: [], breakIndex: -1 },
  attackerPosition: new THREE.Vector3(0, 2.25, 6), defenderPosition: new THREE.Vector3(0, 2.25, -1.5),
  shieldRadius: 1.5, shieldSize: 4.1, shieldColor: '#b3a0ef', beams: false, buildStart: 0, buildEnd: 0,
});
scene.add(old.group); old.group.visible = false;

function makeSpirit() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: '#465167', roughness: .7, metalness: .2 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(.19, 20, 12), material); head.position.y = 2.55; group.add(head);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.24, .72, 6, 12), material); body.position.y = 1.85; group.add(body);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.095, 1.0, 4, 10), material);
    leg.position.set(side * .18, .73, 0); leg.rotation.z = side * .1; group.add(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .63, 4, 10), material);
    arm.position.set(side * .32, 1.8, .12); arm.rotation.z = side * .3; group.add(arm);
  }
  const guitar = new THREE.Mesh(new THREE.SphereGeometry(.28, 16, 12), material);
  guitar.scale.set(1, 1.35, .22); guitar.position.set(-.05, 1.45, .32); group.add(guitar);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(.09, .95, .08), material);
  neck.position.set(.35, 1.92, .32); neck.rotation.z = -.65; group.add(neck);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.6, .67, .05, 6), material); base.position.y = .05; group.add(base);
  group.position.z = -.9; scene.add(group); return group;
}
const spirit = makeSpirit(), oldSpirit = makeSpirit(); oldSpirit.visible = false;
const amp = new THREE.Group(); amp.position.set(-3.1, .9, -1.5); scene.add(amp);
const cabinetMaterial = new THREE.MeshStandardMaterial({ color: '#323143', roughness: .6 });
const cabinet = new THREE.Mesh(new THREE.BoxGeometry(.75, 1.75, .65), cabinetMaterial); amp.add(cabinet);
for (const y of [-.45, .3]) {
  const speaker = new THREE.Mesh(new THREE.TorusGeometry(.23, .025, 8, 40), new THREE.MeshBasicMaterial({ color: '#8c7fae' }));
  speaker.position.set(0, y, .34); amp.add(speaker);
}
const feed = new THREE.Group(); scene.add(feed);
const feedCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-3.1, 1.3, -1.12), new THREE.Vector3(-2.2, 3.7, -.5), new THREE.Vector3(0, 2.35, .25));
const feedGlitter = createSpiralGlitter(null, { capacity: 1200, tint: '#baa2ee' }); feed.add(feedGlitter.group);
const feedStations = createHelixStations(64), tangent = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
feedStations.forEach((s, i) => {
  const u = i / (feedStations.length - 1); feedCurve.getPoint(u, s.center); feedCurve.getTangent(u, tangent);
  s.across.crossVectors(tangent, up).normalize(); s.up.crossVectors(s.across, tangent).normalize(); s.radius = .17 * Math.sin(Math.PI * u) + .07;
});
const feedRings = Array.from({ length: 7 }, () => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.23, .012, 6, 40), new THREE.MeshBasicMaterial({ color: '#bda5f6', transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
  feed.add(ring); return ring;
});
const aim = new THREE.Vector3();

function frameCamera() {
  const compare = $('#compare').checked, angle = $('#camera').value;
  const distance = Math.max(10.4, 7.7 / camera.aspect) * (compare ? 1.45 : mode === 'cycle' ? 1.18 : 1);
  const centerX = !compare && mode === 'cycle' ? -.45 : 0;
  controls.target.set(centerX, 2.3, 0);
  if (angle === 'front') camera.position.set(centerX, 2.3, distance);
  else if (angle === 'edge') camera.position.set(centerX + distance * .98, 3.1, distance * .2);
  else camera.position.set(centerX + distance * .31, 3.15, distance * .95);
  controls.update();
}
const observer = new ResizeObserver(() => {
  const width = host.clientWidth, height = host.clientHeight;
  renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); frameCamera();
}); observer.observe(host);
function syncComparison() {
  const compare = $('#compare').checked;
  study.group.position.x = spirit.position.x = compare ? 2.3 : 0;
  old.group.position.x = oldSpirit.position.x = -2.3;
  old.group.visible = compare;
  $('.comparison-labels').hidden = !compare;
  frameCamera();
}
function syncTransport() {
  $('#play').textContent = playing ? 'Pause' : 'Play';
  $('#play').setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
  $('#timeline-wrap').hidden = mode !== 'cycle';
  $('#hit').disabled = mode === 'cycle' || manualHits.length >= damage.hits;
  $('#restore').textContent = mode === 'cycle' ? 'Replay' : 'Restore shield';
  $$('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
}
function syncTimeline() {
  $('#timeline').max = (cycleDuration(damage) - .01).toFixed(2);
  if (mode === 'cycle') time %= cycleDuration(damage);
}
$$('[data-preset]').forEach(button => button.addEventListener('click', () => {
  preset = button.dataset.preset; settings = { ...PRESETS[preset] }; syncSliders.forEach(sync => sync()); syncPreset(); persist();
}));
$('#reset').addEventListener('click', () => {
  settings = { ...DEFAULTS }; damage = { ...DAMAGE_DEFAULTS }; preset = 'Your shape'; manualHits = [];
  time = mode === 'cycle' ? 3 : 0; syncSliders.forEach(sync => sync()); syncPreset(); syncTimeline(); persist();
});
$$('[data-layer]').forEach(button => button.addEventListener('click', () => {
  layer = button.dataset.layer;
  $$('[data-layer]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.layer === layer)));
}));
$$('[data-mode]').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.mode; time = mode === 'cycle' ? 0 : 3; manualHits = []; syncTransport(); frameCamera();
}));
$('#play').addEventListener('click', () => { playing = !playing; syncTransport(); });
$('#hit').addEventListener('click', () => {
  if (manualHits.length >= damage.hits) return;
  manualHits.push(time); playing = true; syncTransport();
});
$('#restore').addEventListener('click', () => {
  manualHits = []; time = mode === 'cycle' ? 0 : 3; playing = !motionPreference.matches; syncTransport();
});
$$('[data-stage]').forEach(button => button.addEventListener('click', () => {
  const stage = button.dataset.stage;
  mode = 'cycle'; manualHits = []; playing = false;
  time = stage === 'intact' ? 3 : stage === 'first' ? FIRST_HIT + .4
    : stage === 'critical' ? breakTime(damage) - damage.interval + .65 : breakTime(damage) + .35;
  syncTransport(); frameCamera();
}));
$('#camera').addEventListener('change', frameCamera);
$('#compare').addEventListener('change', syncComparison);
$('#speed').addEventListener('change', () => { speed = Number($('#speed').value); });
$('#timeline').addEventListener('input', () => { time = Number($('#timeline').value); playing = false; syncTransport(); });
$('#copy').addEventListener('click', async () => {
  const text = JSON.stringify(snapshot(), null, 2), fallback = $('#copy-fallback');
  fallback.value = text; fallback.hidden = false; fallback.focus(); fallback.select();
  try { await navigator.clipboard.writeText(text); $('#settings-status').textContent = 'Settings copied'; }
  catch { $('#settings-status').textContent = 'Select and copy below'; }
});
motionPreference.addEventListener('change', event => { if (event.matches) { playing = false; syncTransport(); } });
syncPreset(); syncTransport(); syncTimeline();
let last = performance.now();
function animate(now) {
  if (disposed) return;
  const dt = Math.min(.06, (now - last) / 1000); last = now;
  if (playing && !document.hidden) time += dt * speed;
  const state = study.update(time, settings, { mode, layer, damage, manualHits, pixelRatio: renderer.getPixelRatio() });
  $('#view-caption').textContent = state.phase;
  const health = Math.round(state.health * 100);
  $('#integrity').value = `${health}%`;
  $('#hit-count').textContent = `${state.hits} / ${damage.hits} hits`;
  $('#integrity-fill').style.width = `${health}%`;
  $('#integrity-bar').setAttribute('aria-valuenow', String(health));
  $('#integrity-bar').dataset.state = health === 0 ? 'broken' : state.hits === damage.hits - 1 ? 'critical' : 'holding';
  $('#hit').disabled = mode === 'cycle' || state.health === 0;
  if (mode === 'cycle') { $('#timeline').value = state.time; $('#time-value').value = `${state.time.toFixed(2)} s`; }
  const compare = $('#compare').checked;
  spirit.visible = $('#spirit').checked; oldSpirit.visible = spirit.visible && compare;
  if (compare) { old.update(3, { camera }); old.group.children.filter(c => c.isSprite).forEach(c => { c.visible = false; }); }
  amp.visible = feed.visible = mode === 'cycle' && state.feed && !compare;
  if (feed.visible) {
    feedGlitter.update(state.time, { ...SONIC_GLITTER, density: 1200, size: 2, brightness: .65 }, { stations: feedStations, pixelRatio: renderer.getPixelRatio(), opacity: Math.min(1, state.build * 5 + .2) });
    feedRings.forEach((ring, i) => {
      const u = ((state.time * .6 + i / feedRings.length) % 1);
      feedCurve.getPoint(u, ring.position); feedCurve.getTangent(u, aim); ring.lookAt(aim.add(ring.position));
      ring.material.opacity = Math.sin(u * Math.PI) * .7;
    });
  }
  renderer.render(scene, camera); requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed = true; observer.disconnect(); controls.dispose(); study.dispose(); old.dispose(); feedGlitter.dispose();
  const geometries = new Set(), materials = new Set();
  scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); renderer.dispose();
});
