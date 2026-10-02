// ─── 🔥 PYRO SHOVE — a standee is pushed onto an armed mortar: what should it do? ─
// Alex, 2026-10-02: "Astra made [a preview] to show how the standees react to
// getting 'pushed' into the mortar. Can you check this out and provide your own
// preview for what should happen? … Claude's previews [present] better
// customization options."
//
// ⭐ THE APPROACH IS THE GAME'S. `planStep`/`stepPose` from `standeeMotion.js`
// move the real `createStandee` piece two hexes with the shipped shove. Only the
// REACTION is new (`shoveReaction.js`), plus the fire (`blastFx.js`) and sound
// (`blastSfx.js`). ⚖️ "Compare with Astra's" runs HER module (`../stage-hazards`)
// on the same shove, hit on the same frame, with the same fire drawn on both.
//
// 📌 EVERYTHING IS A FUNCTION OF ONE NUMBER, the scene clock `S`. That is why the
// bar scrubs, ❄ freezes on the flash, and slow motion / hit-stop are just a
// change in how fast `S` advances — nothing accumulates.
//
// 💾 Levers persist to localStorage; 📋 the copy block marks changed-vs-default.
// ⛔ PREVIEW-ONLY. No damage, Burn ticks or knockouts are applied.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createStandee, STANDEE, STANDEE_Y, standeeYaw } from '../../src/board/standee.js';
import { HEX_BY_NUM, HEX_BY_QR } from '../../src/board/hexMap.js';
import { facingAngle, axialDist } from '../../src/board/hexGeometry.js';
import { SPIRIT_DEFS } from '../../src/data/spirits.js';
import { CORNER_LABELS } from '../../src/data/corners.js';
import { STANDEE_MOVE, planStep, stepPose, reducedPose } from '../../src/board/standeeMotion.js';
import { createHazardActors } from '../stage-hazards/actors.js';
import { shovePlan } from '../stage-hazards/motion.js';
import { PYRO_SHOVE, reactionAt, timeline, timeRate, cues, shakeAt } from './shoveReaction.js';
import { createBlastFx, createMortar } from './blastFx.js';
import { createBlastSfx } from './blastSfx.js';
import { createPyro } from '../stage-pyro/pyro.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const STORE = `rlsw.pyroShove.${location.pathname}`;
const BUILT = '2026-10-02';

// ── the levers ───────────────────────────────────────────────────────────────
const NAMES = { cosmic_ronin:'Ronin', Metalness_Monster:'Monster', intergalactic_0:'Intergalactic 0', Glamarchy:'Glamarchy' };
const COLOR = { cosmic_ronin:CORNER_LABELS.blue.color, Metalness_Monster:CORNER_LABELS.red.color, intergalactic_0:CORNER_LABELS.purple.color, Glamarchy:CORNER_LABELS.yellow.color };
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const DIR_LABEL = ['South-east', 'North-east', 'North', 'North-west', 'South-west', 'South'];

const GROUPS = [
  { id:'setup',   title:'Set-up — who, and which way' },
  { id:'approach',title:'The shove (the game\'s own)' },
  { id:'contact', title:'1 · Contact, fuse & hit-stop', open:true, hot:true },
  { id:'launch',  title:'2 · The launch', open:true, hot:true },
  { id:'tumble',  title:'3 · The tumble', open:true, hot:true },
  { id:'landing', title:'4 · The landing' },
  { id:'after',   title:'5 · Afterwards' },
  { id:'scorch',  title:'6 · Scorch & burn' },
  { id:'blast',   title:'The blast itself (fire)' },
  { id:'sound',   title:'Sound' },
  { id:'camera',  title:'Camera' },
  { id:'compare', title:'Astra\'s reaction (compare)' },
];
const R = (group, key, label, min, max, step, unit = '', help = '') => ({ type:'range', group, key, label, min, max, step, unit, help });
const S = (group, key, label, options, help = '') => ({ type:'seg', group, key, label, options, help });
const ONOFF = [['on', 'On'], ['off', 'Off']];

const LEVERS = [
  S('setup', 'who', 'Who is pushed', Object.keys(NAMES).map(k => [k, NAMES[k]])),
  S('setup', 'facing', 'Which way it faces', [['pusher', 'Toward the pusher (the board\'s own)'], ['camera', 'Toward the camera']],
    'A shove keeps the piece\'s facing. Astra\'s lane always faces the pusher, so keep this on "pusher" when comparing.'),
  S('setup', 'dir', 'Push direction', DIRS.map((_, i) => [i, DIR_LABEL[i]])),
  S('setup', 'pusher', 'Show the pusher', ONOFF),

  S('approach', 'pushStyle', 'How it travels', [['skate', 'Skate (shipped)'], ['glide', 'Glide'], ['hop', 'Hop'], ['lift', 'Lift & place']],
    'Only re-times the shipped shove; the reaction does not depend on it.'),
  R('approach', 'pushSpeed', 'Shove speed', 0.5, 2, 0.05, '×'),

  R('contact', 'trip', 'Press into the plate', 0, 0.35, 0.01, '', 'How far the piece sinks onto the trip-plate before it fires.'),
  R('contact', 'fuseMs', 'Fuse (held on the plate)', 0, 500, 10, ' ms', 'The beat of dread between touching it and the bang. 0 = instant.'),
  R('contact', 'rumble', 'Shudder while held', 0, 1, 0.05),
  R('contact', 'hitStopMs', 'Hit-stop on the flash', 0, 300, 5, ' ms', 'The whole scene freezes on the brightest frame. Classic fighting-game impact.'),
  R('contact', 'slowRate', 'Slow-motion speed', 0.1, 1, 0.05, '×', '1 = no slow motion.'),
  R('contact', 'slowMs', 'Slow-motion length', 0, 1500, 10, ' ms', 'Measured in show time, so the launch is what you see slowed.'),

  R('launch', 'launchH', 'Launch height', 0, 6, 0.1, '', 'World units; the standee is 2.8 tall. Astra\'s is ≈1.45.'),
  R('launch', 'airMs', 'Air time', 300, 2000, 25, ' ms'),
  R('launch', 'hang', 'Hang at the top', 0.4, 1.4, 0.05, '', '< 1 flattens the top of the arc (floaty); > 1 is a sharp peak.'),
  R('launch', 'stretch', 'Stretch on the way up', 0, 0.4, 0.01),
  R('launch', 'blastLean', 'Lean away from the blast', 0, 60, 1, '°'),
  S('launch', 'drift', 'Where it comes down', [['stay', 'On the mortar'], ['back', 'One step back'], ['onward', 'Carried onward']],
    'A rules call, not just a look. "On the mortar" is Astra\'s reading: the push stops there.'),
  R('launch', 'driftHex', 'Distance blown', 0.5, 2, 0.5, ' hex', 'Only when it does not come down on the mortar.'),

  S('tumble', 'tumble', 'Tumble', [['none', 'None'], ['flip', 'Flip'], ['cartwheel', 'Cartwheel'], ['spin', 'Spin like a coin'], ['flail', 'Flail']]),
  R('tumble', 'turns', 'Turns in the air', 0, 3, 1, '', 'Whole turns, so it always lands the right way up.'),
  S('tumble', 'flipDir', 'Flip direction', [['back', 'Backward'], ['front', 'Forward']]),
  R('tumble', 'flail', 'Flail amount', 0, 1.5, 0.05, '', 'Only for Flail.'),

  R('landing', 'landSquash', 'Squash on landing', 0, 0.4, 0.01),
  R('landing', 'bounces', 'Bounces', 0, 3, 1),
  R('landing', 'bounceH', 'First bounce height', 0.05, 0.4, 0.01, '', 'A share of the launch height.'),
  R('landing', 'bounceDecay', 'Each bounce keeps', 0.2, 0.8, 0.05, '×'),
  R('landing', 'landWobble', 'Wobble to rest', 0, 20, 0.5, '°'),
  R('landing', 'dust', 'Dust ring', 0, 2, 0.1),

  S('after', 'endState', 'What it does next', [['stand', 'Stands'], ['dazed', 'Sways, dazed'], ['down', 'Knocked flat'], ['downRise', 'Flat, then gets up']],
    'Knocked flat is the shipped 78° fall pose, as a visual stand-in only.'),
  R('after', 'dazeMs', 'Daze length', 300, 3000, 50, ' ms'),
  R('after', 'fallMs', 'Fall time', 100, 900, 10, ' ms'),
  R('after', 'downMs', 'Stays down', 200, 3000, 50, ' ms'),
  R('after', 'riseMs', 'Getting up', 200, 1200, 20, ' ms'),

  R('scorch', 'char', 'Print scorched', 0, 1, 0.05, '', 'Darkens the art, then recovers.'),
  R('scorch', 'charMs', 'Scorch recovers over', 500, 9000, 100, ' ms'),
  R('scorch', 'glow', 'Ember glow', 0, 1.5, 0.05, '', 'Heat in the edge and print.'),
  R('scorch', 'burnMs', 'Flames lick for', 0, 6000, 100, ' ms', 'The visual stand-in for the Burn status. 0 = none.'),
  R('scorch', 'flameSize', 'Flame size', 0, 2, 0.1),

  R('blast', 'flash', 'Flash & light', 0, 2, 0.05),
  R('blast', 'fireball', 'Fireball', 0, 2, 0.05),
  R('blast', 'column', 'Flame column height', 0, 2, 0.05),
  R('blast', 'shock', 'Shockwave ring', 0, 2, 0.05),
  R('blast', 'sparks', 'Sparks', 0, 1.5, 0.05),
  R('blast', 'smoke', 'Smoke', 0, 1.5, 0.05),
  R('blast', 'debris', 'Debris', 0, 1, 0.05),
  S('blast', 'fxSource', 'Whose mortars and fire', [['astra', 'Astra\'s mortars & fireworks'], ['mine', 'Mine']],
    'Astra\'s mortar, flame and shells (stage-pyro/pyro.js) on my movement and sound. Her fire reads these levers: Fireball = flame width, Column = flame height, Sparks = density, Shell + Aerial burst = the fireworks.'),
  R('blast', 'bloom', 'Bloom glow', 0, 1.5, 0.05, '', 'The soft halo round fire. Astra\'s look relies on it.'),
  S('blast', 'shell', 'The shell climbs and bursts overhead', ONOFF),
  R('blast', 'crown', 'Aerial burst size', 0, 2, 0.05),
  R('blast', 'scorchMark', 'Scorch mark on the deck', 0, 1, 0.05),
  R('blast', 'tileFlash', 'Hex lights up', 0, 1.5, 0.05),
  S('blast', 'popups', '"−1 VIBE" and 🔥 BURN labels', ONOFF, 'The rule from Astra\'s README, floated over the piece. Display only.'),

  R('sound', 'volume', 'Volume', 0, 1, 0.01),
  R('sound', 'bass', 'Bass weight', 0, 2, 0.05, '×'),
  R('sound', 'boom', 'Report (the boom)', 0, 2, 0.05),
  R('sound', 'tail', 'Boom tail', 0.5, 3, 0.1, ' s'),
  S('sound', 'click', 'Plate clunk on contact', ONOFF),
  R('sound', 'sirenWhine', 'Charge whine in the fuse', 0, 1, 0.05),
  R('sound', 'crackle', 'Crackle', 0, 1.5, 0.05),
  R('sound', 'rattle', 'Acrylic rattle on landing', 0, 1.5, 0.05, '', 'The light plastic sheet shaking after the heavy iron. The contrast is the point.'),

  S('camera', 'cam', 'Camera', [['arena', 'Arena'], ['low', 'Low hero'], ['close', 'Close'], ['top', 'Top-down'], ['eye', 'Mortar eye']]),
  R('camera', 'shake', 'Impact shake', 0, 1.5, 0.05),
  R('camera', 'punch', 'Zoom punch on the bang', 0, 1.5, 0.05),
  S('camera', 'follow', 'Follow the piece up', ONOFF),

  R('compare', 'astraStrength', 'Her reaction strength', 0.2, 2, 0.05),
  S('compare', 'astraKnockdown', 'Her knockdown outcome', ONOFF),
];
// ⭐ DEFAULTS ARE THE MODULE'S: a lever the module does not name is a build error.
for (const l of LEVERS) { if (!(l.key in PYRO_SHOVE)) throw new Error(`pyro-shove: lever "${l.key}" is not in PYRO_SHOVE`); l.def = PYRO_SHOVE[l.key]; }
const DEFAULTS = Object.fromEntries(LEVERS.map(l => [l.key, l.def]));
const REACTION_GROUPS = new Set(['contact', 'launch', 'tumble', 'landing', 'after', 'scorch', 'blast']);
const REACTION_KEYS = LEVERS.filter(l => REACTION_GROUPS.has(l.group)).map(l => l.key);

// 🎨 Looks: each one starts from the defaults for the reaction levers, then overrides.
const LOOKS = {
  'Recommended':   {},
  'Heavy blast':   { launchH:1.3, airMs:700, hang:1, tumble:'none', turns:0, blastLean:24, stretch:0.04, landSquash:0.28, bounces:1, shock:1.5, fireball:1.3, column:1.25, endState:'down', slowRate:0.22, slowMs:650, hitStopMs:110, shake:1.1, boom:1.35, bounceH:0.1, fallMs:300 },
  'Cartoon pop':   { launchH:4.6, airMs:1400, hang:0.6, tumble:'flip', turns:2, stretch:0.24, bounces:3, bounceH:0.22, endState:'dazed', dazeMs:1800, shake:0.3, punch:0.2, char:0.4, smoke:0.4, hitStopMs:40, slowMs:300, flash:0.8 },
  'Spin-out':      { launchH:2.1, airMs:1050, hang:0.7, tumble:'spin', turns:3, drift:'onward', driftHex:1, bounces:2, endState:'dazed' },
  'Ragdoll flail': { launchH:3.1, airMs:1250, tumble:'flail', flail:1.1, drift:'back', driftHex:1, bounces:2, endState:'downRise', downMs:1100 },
  'Knock flat':    { launchH:1.7, airMs:800, tumble:'none', turns:0, blastLean:30, bounces:1, bounceH:0.1, endState:'down', fallMs:420, landSquash:0.12 },
  'Subtle':        { launchH:0.9, airMs:600, tumble:'none', turns:0, bounces:0, endState:'stand', shake:0.2, hitStopMs:0, slowMs:0, fuseMs:60, char:0.2, burnMs:1200, smoke:0.3, debris:0.2, crown:0.6, shell:'off' },
  'About Astra\'s': { fuseMs:0, hitStopMs:0, slowMs:0, trip:0, rumble:0, launchH:1.45, airMs:560, hang:1, tumble:'none', turns:0, blastLean:35, stretch:0, landSquash:0.19, bounces:0, landWobble:11, endState:'stand', char:0, burnMs:0, glow:0.3, shake:0, punch:0, dust:0.4, sparks:0.5, smoke:0.3, debris:0.2, shell:'off', popups:'off' },
};

// ── state ────────────────────────────────────────────────────────────────────
let L = { ...DEFAULTS };
const U = { compare:false, reduced:false, loop:true, speed:1 };
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved?.L) for (const k of Object.keys(DEFAULTS)) if (k in saved.L) L[k] = saved.L[k];
  if (saved?.U) Object.assign(U, saved.U);
} catch { /* a private window: the page still works, it just forgets */ }

// ── the scene ────────────────────────────────────────────────────────────────
const canvas = $('view'), stage = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05070f); scene.fog = new THREE.Fog(0x05070f, 30, 70);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.12; controls.maxPolarAngle = Math.PI * 0.49;
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.6, 0.5, 0.85); composer.addPass(bloomPass); composer.addPass(new OutputPass());
scene.add(new THREE.HemisphereLight(0xddeaff, 0x34314f, 2.3));
const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(5, 12, 7); scene.add(key);
const rim = new THREE.DirectionalLight(0x8aa8ff, 1.1); rim.position.set(-4, 4, -6); scene.add(rim);
{ const n = 500, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.05, r = 55 + Math.random() * 30;
    p.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color:0x9fb6ff, size:0.18, sizeAttenuation:true, fog:false }))); }

// ⚠️ THE SAME px → world MAPPING AS `arenaVisuals.arenaPoint` (copied, not imported).
const hexWorld = h => new THREE.Vector3((h.px - 3255) / 200, STANDEE_Y, (h.py - 2415) / 200);
const CENTRE = HEX_BY_NUM[56];
const PATCH = Object.values(HEX_BY_NUM).filter(h => axialDist(h.q, h.r, CENTRE.q, CENTRE.r) <= 3);
const HEX_R = 1.04;
const GHOST_OFFSET = new THREE.Vector3(-13.5, 0, 0);
const hexAt = (dirIdx, k, from = CENTRE) => HEX_BY_QR[`${from.q + DIRS[dirIdx][0] * k},${from.r + DIRS[dirIdx][1] * k}`];

function hexShape(r) { const s = new THREE.Shape(); for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; s[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); return s; }
const tileGeo = new THREE.ExtrudeGeometry(hexShape(HEX_R), { depth:0.08, bevelEnabled:false }).rotateX(-Math.PI / 2);
const overlayGeo = new THREE.ShapeGeometry(hexShape(HEX_R * 0.96)).rotateX(-Math.PI / 2);
const tileMat = new THREE.MeshStandardMaterial({ color:0x141a38, emissive:0x0a1030, roughness:0.35, metalness:0.45 });
function buildPatch(offset, dim) {
  const root = new THREE.Group(); scene.add(root);
  const deck = new THREE.Mesh(new THREE.CircleGeometry(7.6, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color:0x0a0f24, roughness:0.6, metalness:0.3 }));
  deck.position.copy(hexWorld(CENTRE)).add(offset); deck.position.y = 0.1; root.add(deck);
  const tiles = new Map();
  for (const h of PATCH) {
    const p = hexWorld(h).add(offset);
    const tile = new THREE.Mesh(tileGeo, tileMat); tile.position.set(p.x, 0.12, p.z); root.add(tile);
    const pts = []; for (let k = 0; k <= 6; k++) { const a = (k * Math.PI) / 3; pts.push(new THREE.Vector3(p.x + Math.cos(a) * HEX_R, 0.203, p.z + Math.sin(a) * HEX_R)); }
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color:dim ? 0x2a3350 : 0x3550a0, transparent:true, opacity:0.85 })));
    const overlay = new THREE.Mesh(overlayGeo, new THREE.MeshBasicMaterial({ color:0xff8a3a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    overlay.position.set(p.x, 0.207, p.z); root.add(overlay);
    tiles.set(h.num, { h, overlay });
  }
  return { root, tiles, offset };
}
const laneA = buildPatch(new THREE.Vector3(), false);            // ← mine
const laneB = buildPatch(GHOST_OFFSET, true);                    // ← Astra's (shown only in compare)

// ── pieces ───────────────────────────────────────────────────────────────────
function makePiece(id) {
  const st = createStandee({ ...SPIRIT_DEFS[id], color:COLOR[id] });
  st.group.rotation.order = 'YXZ'; scene.add(st.group);
  const art = st.parts[3], edge = st.parts[2], panel = st.parts[1];
  st._orig = { artEI:art.material.emissiveIntensity, edgeEm:edge.material.emissive.clone(), edgeEI:edge.material.emissiveIntensity, panelEm:panel.material.emissive.clone(), panelEI:panel.material.emissiveIntensity };
  return st;
}
let pawn = null, pusher = null, pawnId = '';
const pusherId = id => (id === 'Metalness_Monster' ? 'cosmic_ronin' : 'Metalness_Monster');
function ensurePieces() {
  if (pawnId === L.who && pawn) return;
  for (const p of [pawn, pusher]) if (p) { scene.remove(p.group); p.dispose(); }
  pawnId = L.who; pawn = makePiece(L.who); pusher = makePiece(pusherId(L.who));
}
const EMBER = new THREE.Color(1, 0.4, 0.1);
function tint(st, heat, char) {
  const o = st._orig, art = st.parts[3], edge = st.parts[2], panel = st.parts[1], h = Math.min(1, heat);
  art.material.color.setScalar(1 - 0.78 * char);
  art.material.emissive.setRGB(1, 1 - 0.62 * h, 1 - 0.9 * h);
  art.material.emissiveIntensity = o.artEI * (1 - 0.72 * char) + heat * 0.45;
  edge.material.emissive.copy(o.edgeEm).lerp(EMBER, h); edge.material.emissiveIntensity = o.edgeEI * (1 + heat * 1.8);
  panel.material.emissive.copy(o.panelEm).lerp(EMBER, h * 0.6);
}

// ── the staged scenario (rebuilt when the direction changes) ─────────────────
const astra = createHazardActors(scene); astra.root.position.copy(GHOST_OFFSET);
const fxA = createBlastFx(scene), fxB = createBlastFx(scene);
const decoys = [0, 1, 2].map(() => { const m = createMortar(); scene.add(m.group); return m; });
const decoysB = [0, 1, 2].map(() => { const m = createMortar(); scene.add(m.group); return m; });
let SC = null, SC_pending = false;
// ── Astra's mortars (stage-pyro/pyro.js), one set per lane, rebuilt only when the direction changes ──
let pyroA = null, pyroB = null, pyroDir = -1;
const sm01 = v => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
function disposePyro(q) {
  if (!q) return; scene.remove(q.root); const gs = new Set(), ms = new Set();
  q.root.traverse(o => { if (o.geometry) gs.add(o.geometry); if (o.material) ms.add(o.material); }); gs.forEach(g => g.dispose()); ms.forEach(m => m.dispose());
}
function rebuildPyro() {
  disposePyro(pyroA); disposePyro(pyroB);
  const nums = [SC.mortarHex.num, ...SC.armed.map(h => h.num)];
  pyroA = createPyro(scene, nums); pyroB = createPyro(scene, nums); pyroB.root.position.copy(GHOST_OFFSET);
  const h = stage.clientHeight * renderer.getPixelRatio(); pyroA.resize(h); pyroB.resize(h);
}
// ⚠️ createPyro does not expose its parts, so read them by position: mortar group children are
// [base, warning ring, barrel, 6 petals, exhaust flame]. A different shape means Astra restructured it: skip, don't crash.
function tweakMortar(q, age, retract) {
  const g = q.root.children[0]; if (!g || g.children.length !== 10) { if (!tweakMortar.warned) { tweakMortar.warned = true; console.warn('pyro-shove: stage-pyro mortar shape changed; barrel/flame tweaks skipped'); } return; }
  const barrel = g.children[2], flame = g.children[9];
  // the standee's weight presses the barrel down at CONTACT (her own lowering starts after the bang, which would clip it through the piece)
  if (retract && age > 0 && barrel.position.y > -0.87) barrel.position.y += (-0.87 - barrel.position.y) * sm01(age / 0.12);
  flame.scale.y *= L.column; flame.visible = L.column > 0.01;
}
function plan() {
  const step = { style:L.pushStyle, kind:'shove', yaw0:0, yaw1:0, speed:L.pushSpeed };
  return planStep(step, STANDEE_MOVE);
}
function buildScenario() {
  const d = L.dir, pusherHex = hexAt(d, -2), startHex = hexAt(d, -1), midHex = CENTRE, mortarHex = hexAt(d, 1), beyondHex = hexAt(d, 2);
  const p = plan(), lead = 0.55, tc = lead + (p.total + p.land) / 1000;
  const wMortar = hexWorld(mortarHex), travel = wMortar.clone().sub(hexWorld(midHex)).setY(0).normalize();
  const yawPusher = standeeYaw(facingAngle(startHex, pusherHex)), yawRival = L.facing === 'camera' ? 0 : yawPusher;
  const yawPusherPiece = L.facing === 'camera' ? 0 : standeeYaw(facingAngle(pusherHex, startHex));
  const arrival0 = shovePlan(startHex.num, [midHex.num, mortarHex.num], 0).arrival;
  const seq = { ...shovePlan(startHex.num, [midHex.num, mortarHex.num], tc - arrival0), hit:mortarHex.num };
  const armed = [hexAt((d + 2) % 6, 2), hexAt((d + 4) % 6, 2), hexAt((d + 1) % 6, 2)];
  SC = { d, pusherHex, startHex, midHex, mortarHex, beyondHex, armed, plan:p, lead, TC:tc, travel:{ x:travel.x, z:travel.z }, yawRival, yawPusherPiece, astraSeq:seq,
    hexes:[startHex, midHex, mortarHex] };
  if (pyroDir !== d || !pyroA) { pyroDir = d; SC_pending = true; }
  fxA.place(wMortar.x, 0, wMortar.z); fxB.place(wMortar.x + GHOST_OFFSET.x, 0, wMortar.z);
  armed.forEach((h, i) => { const w = hexWorld(h); decoys[i].group.position.set(w.x, 0, w.z); decoysB[i].group.position.set(w.x + GHOST_OFFSET.x, 0, w.z); });
  if (SC_pending) { SC_pending = false; rebuildPyro(); }
}

// ── sound ────────────────────────────────────────────────────────────────────
const sfx = createBlastSfx();
const unlock = $('unlock');
const wake = () => { sfx.ensure(); applyMix(); unlock.hidden = true; };
unlock.addEventListener('click', wake);
window.addEventListener('pointerdown', wake, { capture:true }); window.addEventListener('keydown', wake, { capture:true });
const applyMix = () => sfx.setMix(L.volume, L.bass);
function playCue(c) {
  switch (c.type) {
    case 'plate': sfx.plate(); break;
    case 'whine': sfx.whine(c.dur, L.sirenWhine); break;
    case 'boom': sfx.boom(L.boom, L.tail); break;
    case 'crackle': sfx.crackle(L.crackle); break;
    case 'shell': sfx.shell(); break;
    case 'crown': sfx.crown(); break;
    case 'land': case 'bounce': sfx.land(c.power, L.rattle, L.dust); break;
    case 'burn': sfx.burn(c.dur, 0.6); break;
  }
}

// ── the clock ────────────────────────────────────────────────────────────────
let S_ = 0, playing = true, holdMs = 0, stoppedAtIgnite = false, lastCue = 0, loopWait = 0, END = 5;
let TL = timeline(L), CUES = [];
function recompute() {
  ensurePieces(); buildScenario(); TL = timeline(L); CUES = cues(L).map(c => ({ ...c, abs:SC.TC + c.at })); END = SC.TC + TL.end;
  const sc = $('scrub'); sc.max = Math.round(END * 1000);
}
function restart(play = true) { S_ = 0; lastCue = 0; stoppedAtIgnite = false; holdMs = 0; loopWait = 0; playing = play; }

// ── posing ───────────────────────────────────────────────────────────────────
const tmpV = new THREE.Vector3();
function apply(st, pos, pitch, yaw, roll, sx, sy, ko, time, acting) {
  const g = st.group; g.position.copy(pos); g.rotation.set(pitch, yaw, roll); g.scale.set(sx, sy, sx);
  st.frame(time, { acting, reduced:U.reduced, cameraPos:camera.position, lift:(pos.y - STANDEE_Y) / Math.max(0.05, sy), knockedOut:false });
  if (ko > 0) { st.parts.slice(1, 4).forEach(m => { m.rotation.x -= THREE.MathUtils.degToRad(STANDEE.koTilt) * ko; m.position.y += (0.05 + STANDEE.sink) * ko; }); }
}
function leanFor(from, to, yaw) {
  const d = tmpV.copy(to).sub(from).setY(0).normalize(), f = { x:Math.sin(yaw), z:Math.cos(yaw) }, r = { x:Math.cos(yaw), z:-Math.sin(yaw) };
  return { fwd:d.x * f.x + d.z * f.z, side:d.x * r.x + d.z * r.z };
}
let minePoseOut = null;
function poseMine(S) {
  const age = S - SC.TC, p = SC.plan, yaw = SC.yawRival;
  let pos, pitch = 0, roll = 0, sx = 1, sy = 1, yawOut = yaw, ko = 0, o = null;
  const wMortar = hexWorld(SC.mortarHex);
  if (age < 0) {
    const ms = (S - SC.lead) * 1000;
    const i = Math.max(0, Math.min(1, Math.floor(ms / p.total))), local = ms - i * p.total;
    const a = hexWorld(SC.hexes[i]), b = hexWorld(SC.hexes[i + 1]);
    const step = { style:L.pushStyle, kind:'shove', yaw0:yaw, yaw1:yaw, speed:L.pushSpeed };
    const P = ms <= 0 ? { p:0, y:0, yaw, pitch:0, roll:0, sy:1, sxz:1 } : U.reduced ? { ...reducedPose(step), p:i === 1 && local >= p.land ? 1 : i }
      : stepPose(step, p, local, STANDEE_MOVE, leanFor(a, b, yaw));
    pos = a.clone().lerp(b, Math.min(1.2, P.p)); pos.y = STANDEE_Y + P.y; pitch = P.pitch; roll = P.roll; yawOut = P.yaw; sx = P.sxz; sy = P.sy;
    if (ms <= 0) pos = hexWorld(SC.startHex);
    o = reactionAt(Math.min(0, age), L, { dir:SC.travel, reduced:U.reduced });
  } else {
    o = reactionAt(age, L, { dir:SC.travel, reduced:U.reduced });
    pos = wMortar.clone(); pos.x += o.x; pos.z += o.z; pos.y = STANDEE_Y + o.y;
    pitch = o.pitch; roll = o.roll; yawOut = yaw + o.yaw; sx = o.sxz; sy = o.sy; ko = o.ko;
  }
  apply(pawn, pos, pitch, yawOut, roll, sx, sy, ko, S, false);
  tint(pawn, o.heat, o.char);
  minePoseOut = { o, pos, sy };
  return o;
}
function posePusher(S) {
  pusher.group.visible = L.pusher === 'on';
  if (L.pusher !== 'on') return;
  const base = hexWorld(SC.pusherHex), t = (S - SC.lead + 0.12) / 0.5, k = Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
  const pos = base.clone(); pos.x += SC.travel.x * 0.28 * k; pos.z += SC.travel.z * 0.28 * k;
  const yaw = SC.yawPusherPiece, f = { x:Math.sin(yaw), z:Math.cos(yaw) };
  const lean = (SC.travel.x * f.x + SC.travel.z * f.z) * 0.22 * k;
  apply(pusher, pos, lean, yaw, 0, 1, 1, 0, S, false);
}

// ── popups + tags + HUD ──────────────────────────────────────────────────────
const pops = $('pops'), tagsHost = $('tags');
const popVibe = Object.assign(document.createElement('div'), { className:'pop vibe', textContent:'−1 VIBE' });
const popBurn = Object.assign(document.createElement('div'), { className:'pop burn', textContent:'🔥 BURN' });
pops.append(popVibe, popBurn);
const tagMine = Object.assign(document.createElement('div'), { className:'tag mine', textContent:'MINE' });
const tagAstra = Object.assign(document.createElement('div'), { className:'tag astra', textContent:'ASTRA\'S' });
tagsHost.append(tagMine, tagAstra);
function project(v, el, dx = 0, dy = 0) {
  const p = v.clone().project(camera); el.style.left = `${((p.x + 1) / 2) * stage.clientWidth + dx}px`; el.style.top = `${((1 - p.y) / 2) * stage.clientHeight + dy}px`;
  return p.z < 1;
}
const PHASE = { approach:'SHOVE', fuse:'FUSE — held on the plate', air:'BLAST — in the air', bounce:'LAND — bouncing', recover:'AFTER' };
function updateOverlay(o, S) {
  const age = S - SC.TC, head = minePoseOut.pos.clone().add(new THREE.Vector3(0, STANDEE.height * minePoseOut.sy + 0.35, 0));
  const rate = timeRate(age, L) * U.speed;
  $('phaseChip').textContent = S < SC.lead ? 'SET' : (o.phase === 'recover' ? ({ stand:'AFTER — stands', dazed:'AFTER — dazed', down:'AFTER — knocked flat', downRise:'AFTER — flat, then up' })[L.endState] : PHASE[o.phase]);
  $('timeChip').textContent = `${age >= 0 ? 'contact +' : 'contact '}${age.toFixed(2)} s${holdMs > 0 ? ' · HIT-STOP' : rate < 0.99 * U.speed ? ` · ×${rate.toFixed(2)}` : ''}`;
  const a = age - TL.ti, show = L.popups === 'on';
  const vib = show && a >= 0 && a < 1.5;
  popVibe.style.display = vib && project(head, popVibe, 0, -a * 38) ? '' : 'none'; popVibe.style.opacity = vib ? String(Math.max(0, 1 - a / 1.5)) : '0';
  const burn = show && o.ignited && o.burn > 0.02 && L.burnMs > 0;
  popBurn.style.display = burn && project(head, popBurn, 0, -34) ? '' : 'none'; popBurn.style.opacity = String(Math.min(1, o.burn * 1.5));
  tagMine.style.display = U.compare && project(hexWorld(SC.mortarHex).setY(3.6), tagMine) ? '' : 'none';
  tagAstra.style.display = U.compare && project(hexWorld(SC.mortarHex).add(GHOST_OFFSET).setY(3.6), tagAstra) ? '' : 'none';
}

// ── the loop ─────────────────────────────────────────────────────────────────
const CAMS = { arena:['Arena', 12.5, 36], low:['Low hero', 10, 10], close:['Close', 7.5, 22], top:['Top-down', 16, 78], eye:['Mortar eye', 6, 5] };
let camAim = null;
function camTarget() {
  const m = hexWorld(SC.startHex).lerp(hexWorld(SC.mortarHex), 0.6).setY(0.9);
  return U.compare ? m.clone().add(GHOST_OFFSET.clone().multiplyScalar(0.5)) : m;
}
function aimCamera(snap = false) {
  const [, dist, elev] = CAMS[L.cam], k = U.compare ? 1.7 : 1, tgt = camTarget(), e = THREE.MathUtils.degToRad(elev);
  camAim = { pos:tgt.clone().add(new THREE.Vector3(0, Math.sin(e), Math.cos(e)).multiplyScalar(dist * k)), tgt, t0:performance.now(), from:camera.position.clone(), fromT:controls.target.clone(), snap };
}
function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); composer.setSize(w, h); for (const q of [pyroA, pyroB]) q?.resize(h * renderer.getPixelRatio()); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(stage);

let lastT = performance.now(), lastTime = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  // advance the show clock
  if (playing) {
    if (holdMs > 0) holdMs = Math.max(0, holdMs - dt * 1000);
    else if (S_ >= END) { if (U.loop) { loopWait += dt; if (loopWait > 0.9) restart(true); } else playing = false; }
    else {
      const prev = S_, rate = timeRate(S_ - SC.TC, L) * U.speed;
      S_ = Math.min(END, S_ + dt * rate);
      const ign = SC.TC + TL.ti;
      if (!stoppedAtIgnite && prev < ign && S_ >= ign) { stoppedAtIgnite = true; if (L.hitStopMs > 0 && !U.reduced) { S_ = ign; holdMs = L.hitStopMs / U.speed; } }
      for (const c of CUES) if (c.abs > lastCue && c.abs <= S_) playCue(c);
      lastCue = S_;
    }
    $('scrub').value = String(Math.round(S_ * 1000));
  }
  const S = S_;
  const o = poseMine(S); posePusher(S);
  // astra's lane (same shove, her reaction); hide her extra pieces + her own light show
  const showB = U.compare;
  laneB.root.visible = showB; astra.root.visible = showB; fxB.root.visible = showB; decoysB.forEach(d => { d.group.visible = showB; });
  if (showB) {
    astra.update(S, [SC.startHex.num, SC.pusherHex.num, SC.beyondHex.num], camera, { sequence:SC.astraSeq, kind:'pyro', knockdown:L.astraKnockdown === 'on', strength:L.astraStrength, reduced:U.reduced });
    astra.root.children[2].visible = false;
    astra.root.children[1].visible = L.pusher === 'on';
    astra.root.children[3].visible = false; astra.root.children[5].visible = false; astra.root.children[4].intensity = 0;
  }
  // the fire — mine at my timing, on hers at hers (instant)
  const age = S - SC.TC, time = now / 1000;
  const land = reactionAt(TL.tl + 0.001, L, { dir:SC.travel });
  const useA = L.fxSource === 'astra';
  const fxCtx = { age, L, reduced:U.reduced, time, astra:useA, standee:{ pos:new THREE.Vector3(minePoseOut.pos.x - fxA.root.position.x, minePoseOut.pos.y, minePoseOut.pos.z - fxA.root.position.z), height:STANDEE.height, burn:o.burn, land:{ x:land.x, z:land.z } } };
  const tileA = fxA.update(fxCtx);
  if (showB) fxB.update({ age, L:{ ...L, fuseMs:0 }, reduced:U.reduced, time, astra:useA, standee:null });
  // Astra's mortars: struck one fires at MY bang (her lane: at contact, as she built it)
  pyroA.root.visible = useA; pyroB.root.visible = useA && showB;
  decoys.forEach(d => { d.group.visible = !useA; }); decoysB.forEach(d => { d.group.visible = !useA && showB; });
  if (useA) {
    const inf = Infinity, st = { mortars:true, cannons:false, fireworks:L.shell === 'on' && L.crown > 0, curtain:false, guides:true, width:Math.max(0.5, Math.min(1.8, L.fireball || 0.5)),
      height:7, burst:3.6 * Math.max(0.3, L.crown), density:Math.max(0.05, L.sparks), stagger:0.18, palette:'gold' };
    pyroA.update(S, st, { deployedAt:-10, fireAt:[SC.TC + TL.ti, inf, inf, inf], endAt:inf, showAt:inf, hit:SC.mortarHex.num }); tweakMortar(pyroA, age, true);
    if (showB) { pyroB.update(S, st, { deployedAt:-10, fireAt:[SC.TC, inf, inf, inf], endAt:inf, showAt:inf, hit:SC.mortarHex.num }); tweakMortar(pyroB, 0, false); }
  }
  // tiles: armed mortars glow, the struck hex flashes
  const pulse = 0.22 + 0.08 * Math.sin(time * 3);
  for (const [lane, fx, mortarFlash] of [[laneA, fxA, tileA.tile], [laneB, fxB, showB ? Math.max(0, L.tileFlash * Math.exp(-Math.max(0, age) * 2.6)) * (age >= 0 ? 1 : 0) : 0]]) {
    for (const t of lane.tiles.values()) t.overlay.material.opacity = 0;
    const ids = [SC.mortarHex, ...SC.armed];
    ids.forEach((h, i) => { const t = lane.tiles.get(h.num); if (t) t.overlay.material.opacity = i === 0 ? Math.max(pulse * (age >= 0 && lane === laneA ? 0 : 1), mortarFlash) : pulse * 0.7; });
    void fx;
  }
  tint(pusher, 0, 0);
  // camera
  if (camAim) {
    const k = camAim.snap ? 1 : Math.min(1, (now - camAim.t0) / 600), e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(camAim.from, camAim.pos, e); controls.target.lerpVectors(camAim.fromT, camAim.tgt, e); if (k >= 1) camAim = null;
  } else if (L.cam === 'close' || L.follow === 'on') {
    const goal = L.cam === 'close' ? minePoseOut.pos.clone().setY(minePoseOut.pos.y + 1) : camTarget().setY(0.9 + Math.max(0, minePoseOut.pos.y - 0.4) * 0.7);
    controls.target.lerp(goal, 1 - Math.exp(-dt * (L.cam === 'close' ? 4 : 5)));
  }
  controls.update();
  const sh = U.reduced ? { x:0, y:0, amp:0 } : shakeAt(age, L);
  camera.position.x += sh.x; camera.position.y += sh.y;
  const a = age - TL.ti, punch = U.reduced ? 0 : L.punch * (a >= 0 ? Math.exp(-a * 5) * Math.min(1, a * 40) : 0);
  const fov = 40 - punch * 7; if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  updateOverlay(o, S);
  bloomPass.strength = L.bloom; if (L.bloom > 0.01) composer.render(); else renderer.render(scene, camera);
  camera.position.x -= sh.x; camera.position.y -= sh.y;
  lastTime = time;
  requestAnimationFrame(frame);
}

// ── the panel ────────────────────────────────────────────────────────────────
const leverEls = new Map();
function fmt(l, v) {
  if (l.type === 'seg') return String(l.options.find(o => String(o[0]) === String(v))?.[1] ?? v);
  const d = String(l.step).includes('.') ? String(l.step).split('.')[1].length : 0; return `${Number(v).toFixed(d)}${l.unit}`;
}
function onChange(key) {
  // anything that changes the staging or the timeline rebuilds it; the clock is left where it is
  const rebuild = ['dir', 'who', 'facing', 'pushStyle', 'pushSpeed'].includes(key);
  recompute(); if (rebuild) { restart(true); } else { lastCue = S_; stoppedAtIgnite = S_ >= SC.TC + TL.ti; }
  if (key === 'cam') aimCamera();
  if (['volume', 'bass'].includes(key)) applyMix();
}
function buildPanel() {
  const host = $('levers');
  for (const g of GROUPS) {
    const det = document.createElement('details'); det.dataset.group = g.id; if (g.open) det.open = true; if (g.hot) det.classList.add('hot');
    det.innerHTML = `<summary>${g.title}</summary>`; host.appendChild(det);
    for (const l of LEVERS.filter(x => x.group === g.id)) {
      const el = document.createElement('div'); el.className = 'lever';
      el.innerHTML = `<div class="top"><span>${l.label}</span><span class="v"></span></div>`;
      if (l.type === 'range') {
        const inp = document.createElement('input'); inp.type = 'range'; Object.assign(inp, { min:l.min, max:l.max, step:l.step });
        inp.addEventListener('input', () => { L[l.key] = Number(inp.value); render(); onChange(l.key); }); el.appendChild(inp); el._inp = inp;
      } else {
        const seg = document.createElement('div'); seg.className = 'seg';
        for (const [v, label] of l.options) {
          const b = document.createElement('button'); b.textContent = label; b.dataset.v = v;
          b.addEventListener('click', () => { L[l.key] = typeof l.def === 'number' ? Number(v) : v; render(); onChange(l.key); }); seg.appendChild(b);
        }
        el.appendChild(seg); el._seg = seg;
      }
      if (l.help) { const h = document.createElement('div'); h.className = 'help'; h.textContent = l.help; el.appendChild(h); }
      det.appendChild(el); leverEls.set(l.key, { l, el });
    }
  }
  const looks = $('looks');
  for (const name of Object.keys(LOOKS)) {
    const b = document.createElement('button'); b.textContent = name;
    b.addEventListener('click', () => { for (const k of REACTION_KEYS) L[k] = DEFAULTS[k]; Object.assign(L, LOOKS[name]); render(); onChange('look'); restart(true); });
    looks.appendChild(b);
  }
  const sp = $('speedSeg');
  for (const v of [0.1, 0.25, 0.5, 1]) { const b = document.createElement('button'); b.textContent = `${v}×`; b.dataset.v = v; b.addEventListener('click', () => { U.speed = v; render(); }); sp.appendChild(b); }
  const cs = $('camSeg');
  for (const [k, [label]] of Object.entries(CAMS)) { const b = document.createElement('button'); b.textContent = label; b.dataset.v = k; b.addEventListener('click', () => { L.cam = k; render(); aimCamera(); }); cs.appendChild(b); }
  $('playBtn').addEventListener('click', () => { wake(); restart(true); });
  $('pauseBtn').addEventListener('click', () => { playing = !playing; render(); });
  $('freezeBtn').addEventListener('click', () => { S_ = SC.TC + TL.ti + 0.04; lastCue = S_; stoppedAtIgnite = true; playing = false; render(); });
  $('loopBtn').addEventListener('click', () => { U.loop = !U.loop; render(); });
  $('reducedBtn').addEventListener('click', () => { U.reduced = !U.reduced; render(); });
  $('compareBtn').addEventListener('click', () => { U.compare = !U.compare; render(); aimCamera(); restart(true); });
  $('scrub').addEventListener('input', e => { playing = false; S_ = Number(e.target.value) / 1000; lastCue = S_; stoppedAtIgnite = S_ >= SC.TC + TL.ti; render(); });
  $('surpriseBtn').addEventListener('click', () => {
    const pick = a => a[Math.floor(Math.random() * a.length)], r = (lo, hi, st) => Math.round((lo + Math.random() * (hi - lo)) / st) * st;
    for (const k of REACTION_KEYS) L[k] = DEFAULTS[k];
    Object.assign(L, { launchH:r(0.8, 4.8, 0.1), airMs:r(550, 1500, 25), hang:r(0.55, 1.2, 0.05), stretch:r(0, 0.3, 0.01), blastLean:r(0, 40, 1),
      drift:pick(['stay', 'stay', 'back', 'onward']), tumble:pick(['none', 'flip', 'flip', 'cartwheel', 'spin', 'flail']), turns:pick([0, 1, 1, 2, 3]), flipDir:pick(['back', 'front']),
      landSquash:r(0.05, 0.35, 0.01), bounces:pick([0, 1, 2, 2, 3]), endState:pick(['stand', 'dazed', 'dazed', 'down', 'downRise']), char:r(0, 0.9, 0.05), burnMs:r(0, 4000, 100),
      hitStopMs:pick([0, 40, 70, 110, 160]), slowRate:r(0.2, 0.7, 0.05), slowMs:pick([0, 300, 450, 700]) });
    render(); onChange('look'); restart(true);
  });
  const au = $('audition');
  for (const [label, fn] of [['🔩 Plate', () => sfx.plate()], ['💥 Boom', () => sfx.boom(L.boom, L.tail)], ['✨ Crackle', () => sfx.crackle(L.crackle)], ['🚀 Shell', () => sfx.shell()], ['🎆 Burst', () => sfx.crown()],
    ['🪨 Land', () => sfx.land(1, L.rattle, L.dust)], ['🔥 Burn', () => sfx.burn(2.4, 0.6)]]) {
    const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', () => { wake(); fn(); }); au.appendChild(b);
  }
  $('copyBtn').addEventListener('click', async () => {
    const ta = $('dialIn'); ta.focus(); ta.select();
    try { await navigator.clipboard.writeText(ta.value); $('copyMsg').textContent = 'Copied ✓'; } catch { $('copyMsg').textContent = 'Selected — press Ctrl+C'; }
    setTimeout(() => { $('copyMsg').textContent = ''; }, 2500);
  });
  $('resetBtn').addEventListener('click', () => { L = { ...DEFAULTS }; render(); onChange('who'); restart(true); aimCamera(); });
}
function dialIn() {
  const changed = LEVERS.filter(l => String(L[l.key]) !== String(l.def));
  return [
    `🔥 PYRO SHOVE — dial-in from .scratch/pyro-shove (page built ${BUILT})`,
    `Changed: ${changed.length} of ${LEVERS.length} levers.`,
    `(viewed with: compare ${U.compare ? 'on' : 'off'} · reduced motion ${U.reduced ? 'on' : 'off'} · speed ${U.speed}×)`,
    '', '── CHANGED (Alex moved these) ──',
    ...(changed.length ? changed.map(l => `✎ ${l.key} = ${JSON.stringify(L[l.key])}   [${fmt(l, L[l.key])}; default ${fmt(l, l.def)}] — ${GROUPS.find(g => g.id === l.group).title} › ${l.label}`) : ['(none)']),
    '', '── UNTOUCHED (still the default) ──',
    ...LEVERS.filter(l => !changed.includes(l)).map(l => `· ${l.key} = ${JSON.stringify(L[l.key])}`),
  ].join('\n');
}
function drawTimeline() {
  const segs = $('segs'); segs.innerHTML = '';
  const add = (a, b, c, t) => { const i = document.createElement('i'); i.style.left = `${(a / END) * 100}%`; i.style.width = `${Math.max(0.2, ((b - a) / END) * 100)}%`; i.style.background = c; i.title = t; segs.appendChild(i); };
  const tc = SC.TC; add(0, tc, '#3a6ab0', 'shove'); add(tc, tc + TL.ti, '#ff9a4a', 'fuse'); add(tc + TL.ti, tc + TL.tl, '#ffd166', 'air'); add(tc + TL.tl, tc + TL.tb, '#c98a52', 'bounce'); add(tc + TL.tb, END, '#2f7a6a', 'after');
  for (const m of [...document.querySelectorAll('.timeline .mk')]) m.remove();
  for (const [t, label] of [[tc, 'contact'], [tc + TL.ti, 'bang'], [tc + TL.tl, 'land']]) { const m = document.createElement('span'); m.className = 'mk'; m.style.left = `${(t / END) * 100}%`; m.textContent = label; $('timeline').appendChild(m); }
}
function render() {
  for (const { l, el } of leverEls.values()) {
    const v = L[l.key];
    el.querySelector('.v').textContent = fmt(l, v); el.classList.toggle('changed', String(v) !== String(l.def));
    if (el._inp && Number(el._inp.value) !== Number(v)) el._inp.value = v;
    if (el._seg) for (const b of el._seg.querySelectorAll('button')) b.classList.toggle('on', String(b.dataset.v) === String(v));
  }
  for (const b of $('speedSeg').children) b.classList.toggle('on', Number(b.dataset.v) === U.speed);
  for (const b of $('camSeg').children) b.classList.toggle('on', b.dataset.v === L.cam);
  $('pauseBtn').textContent = playing ? '⏸ Pause' : '▶ Resume';
  $('loopBtn').textContent = `🔁 Loop: ${U.loop ? 'on' : 'off'}`; $('loopBtn').classList.toggle('on', U.loop);
  $('reducedBtn').textContent = `♿ Reduced motion: ${U.reduced ? 'on' : 'off'}`; $('reducedBtn').classList.toggle('on', U.reduced);
  $('compareBtn').textContent = `⚖️ Compare with Astra's: ${U.compare ? 'on' : 'off'}`; $('compareBtn').classList.toggle('on', U.compare);
  $('dialIn').value = dialIn();
  if (SC) { TL = timeline(L); END = SC.TC + TL.end; drawTimeline(); }
  applyMix();
  try { localStorage.setItem(STORE, JSON.stringify({ L, U })); } catch { /* storage blocked: the dial-in box still works */ }
}

ensurePieces(); buildScenario(); buildPanel(); recompute(); render(); resize(); aimCamera(true); restart(true);
requestAnimationFrame(frame);
// 📌 For the headless check: drive the page without a mouse.
window.__pyroShove = { get L() { return L; }, U, setLever:(k, v) => { L[k] = v; render(); onChange(k); }, seek:t => { playing = false; S_ = t; lastCue = t; stoppedAtIgnite = t >= SC.TC + TL.ti; },
  get SC() { return SC; }, get S() { return S_; }, sfx, playCue, get CUES() { return CUES; }, dialIn, restart, look:n => { for (const k of REACTION_KEYS) L[k] = DEFAULTS[k]; Object.assign(L, LOOKS[n]); render(); onChange('look'); }, render };
