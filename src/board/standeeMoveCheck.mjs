// ─── 🎭 STANDEE MOVE CHECK — the hop, the stone-on-glass landing, the numpad ──
// `npm run test:standeemove`. Alex, 2026-09-30: the standees stop sliding and
// start MOVING — a hop per step that lands with a sound he dialled in himself
// (`.scratch/standee-move-preview.html`: "I found a good sound I think. I'd like
// to run with this for now"). The same day: "the numlock numbers can move the
// spirit".
//
// ⚠️ WHAT THIS SUITE GUARDS, and why each is here:
//   §0 — THE DIAL-IN. His six moved levers are what ships, and the preview page
//        and `STANDEE_MOVE` name exactly the same levers — the page imports its
//        defaults from here, so a lever added to one and not the other would
//        make the next dial-in measure against the wrong baseline.
//   §1 — the pure motion: every style × kind × turn mode starts on its hex,
//        touches down at `land`, ends upright, at rest, facing the step.
//   §2 — the three.js half driven by hand: a step queues, hops, lands ONCE with
//        the dialled sound, hands the pawn back at rest; a shove clacks; a leap
//        blinks and lands on two notes; reduced motion snaps but still sounds;
//        a bot is quieter; `pawn.visible` is never touched (the Swing owns it).
//   §3 — the standee keeps its shadow and acting ring on the deck in the air.
//   §4 — 🧹 teardown (the 45-playtest finding: stop() is not cleanup): every
//        node a landing builds is disconnected once its tail has run out, and
//        the room + echo bus is built ONCE per context, not once per arena.
//   §5 — the numpad: 8/2/7/9/1/3 are the six real neighbours, 4/6 are nothing,
//        up is board north, and the client routes a key through the same
//        `onHexClick` / `move` a click uses.
//   §6 — the wiring in arenaVisuals / arenaFrame, and the scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = rel => fs.readFileSync(path.join(HERE, rel), 'utf8');

let pass = 0;
const failures = [];
function ok(cond, msg) { if (cond) pass++; else { failures.push(msg); console.log('  ✗', msg); } }

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const timers = [];
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };

const THREE = await import('three');
const M = await import('./standeeMotion.js');
const { createStandeeSteps } = await import('./standeeSteps.js');
const { createStandee } = await import('./standee.js');
const { createLandingSfx, bodyFreq } = await import('../audio/landingSfx.js');
const { HEX_BY_NUM } = await import('./hexMap.js');
const N = await import('../ui/numpadMove.js');
const { STANDEE_MOVE: T, planStep, stepPose, MOVE_STYLES, stepKind, styleFor, landingNotes } = M;

// ── §0 the dial-in ───────────────────────────────────────────────────────────
console.log('§0 the dial-in');
ok(T.voice === 'slab', 'voice is Stone on glass (Alex moved it from Crystal chime)');
ok(T.weight === 0.45, 'weight .45 under the voice');
ok(T.echo === 0.06, 'a touch of space echo, .06');
ok(T.sparkleTail === 2, 'two sparkle pings');
ok(T.travelSound === 'rumble', 'a heavy rumble while it travels');
ok(T.pitchMode === 'fixed', 'one note, every landing');
ok(T.style === 'hop' && T.shukuchiStyle === 'blink' && T.shoveStyle === 'skate' && T.shoveSound === 'clack',
  'the motion he left alone ships as the page offered it: hop, blink for a leap, skate + clack for a shove');
ok(Object.isFrozen(T), 'STANDEE_MOVE is frozen');
{
  const page = fs.readFileSync(path.join(HERE, '../../.scratch/standee-move-preview.js'), 'utf8');
  const keys = new Set([...page.matchAll(/\b[RS]\('\w+', '(\w+)'/g)].map(m => m[1]));
  for (const id of ['cosmic_ronin', 'Metalness_Monster', 'intergalactic_0', 'Glamarchy']) if (page.includes(`'${id}'`)) keys.add(`style_${id}`);
  const shipped = new Set(Object.keys(T));
  ok(keys.size === 61, `the page has 61 levers (found ${keys.size})`);
  ok([...keys].every(k => shipped.has(k)), 'every lever on the page is named in STANDEE_MOVE');
  ok([...shipped].every(k => keys.has(k)), 'every STANDEE_MOVE value has a lever on the page');
  ok(/from '\.\.\/src\/board\/standeeMotion\.js'/.test(page) && /from '\.\.\/src\/audio\/landingSfx\.js'/.test(page),
    'the page drives the game\'s own motion and sound modules (one copy)');
  ok(/l\.def = STANDEE_MOVE\[l\.key\]/.test(page), '…and takes its defaults from STANDEE_MOVE, so Reset = the game');
}

// ── §1 the pure motion ───────────────────────────────────────────────────────
console.log('§1 the pure motion');
for (const turnMode of ['first', 'during', 'snap']) for (const kind of ['walk', 'shukuchi', 'shove']) for (const style of MOVE_STYLES) {
  const L = { ...T, turnMode };
  const step = { style, kind, yaw0:0, yaw1:kind === 'shove' ? 0 : 2, speed:1 };
  const plan = planStep(step, L), tag = `${style}/${kind}/${turnMode}`;
  const a = stepPose(step, plan, 0, L), z = stepPose(step, plan, plan.total + 1, L), l = stepPose(step, plan, plan.land, L);
  ok(Math.abs(a.p) < 1e-6, `${tag} starts on its hex`);
  ok(Math.abs(z.p - 1) < 0.01 && Math.abs(z.y) < 1e-3 && Math.abs(z.sy - 1) < 0.02 && z.vis === 1
    && Math.abs(z.pitch) < 0.01 && Math.abs(z.roll) < 0.01 && Math.abs(z.yaw - step.yaw1) < 0.02, `${tag} ends at rest, upright, facing the step`);
  ok(Math.abs(l.p - 1) < (style === 'shipped' ? 0.06 : 0.01) && l.y < 0.02, `${tag} touches down at land`);
  let finite = true, maxY = 0;
  for (let ms = 0; ms <= plan.total; ms += 5) { const P = stepPose(step, plan, ms, L); maxY = Math.max(maxY, P.y); for (const v of Object.values(P)) if (typeof v === 'number' && !Number.isFinite(v)) finite = false; }
  ok(finite, `${tag} every pose is finite`);
  if (style === 'hop') ok(maxY > 0.7, `${tag} actually leaves the deck (${maxY.toFixed(2)})`);
}
{
  const a = planStep({ style:'hop', kind:'walk', yaw0:0, yaw1:1, speed:1 }), b = planStep({ style:'hop', kind:'walk', yaw0:0, yaw1:1, speed:2 });
  ok(Math.abs(b.total * 2 - a.total) < 1e-6, 'catch-up: a step with a queue behind it runs faster');
  ok(stepKind(1) === 'walk' && stepKind(2) === 'shukuchi' && stepKind(4) === 'shukuchi' && stepKind(1, { shoved:true }) === 'shove', 'stepKind: walk / leap / shove');
  ok(styleFor('cosmic_ronin', 'walk') === 'hop' && styleFor('cosmic_ronin', 'shukuchi') === 'blink' && styleFor('Glamarchy', 'shove') === 'skate', 'styleFor reads the dial-in');
  const hira = [0, 2, 3, 5, 7, 8];
  ok(JSON.stringify(landingNotes({ scale:hira, kind:'walk' }).midis) === '[84]', 'fixed pitch: every walk lands on C6');
  ok(JSON.stringify(landingNotes({ scale:hira, kind:'shukuchi' }).midis) === '[84,87]', '…a leap on C6 + the Spirit\'s third degree (E♭6 for the Ronin)');
  ok(JSON.stringify(landingNotes({ scale:hira }, { ...T, pitchMode:'spent' }).midis) === '[84]', '"spent" falls back to fixed in the game (the renderer is not told the note)');
  const walk = {}, L = { ...T, pitchMode:'walk' };
  const run = [0, 400, 800].map(t => landingNotes({ scale:hira, now:t, walk }, L).midis[0]);
  ok(JSON.stringify(run) === '[84,86,87]', 'walk mode (preview only) still climbs the scale');
  ok(bodyFreq(1046.5) > 45 && bodyFreq(1046.5) <= 150 && Math.abs(Math.log2(1046.5 / bodyFreq(1046.5)) % 1) < 1e-9, 'bodyFreq drops the note whole octaves into 45–150 Hz');
}

// ── §2 the three.js half, driven by hand ────────────────────────────────────
console.log('§2 steps, driven by hand');
function recorder() {
  const calls = [];
  return { calls, setMix(o) { calls.push(['mix', o]); },
    land(voice, freqs, o) { calls.push(['land', voice, freqs, o]); }, travel(kind, sec, f, o) { calls.push(['travel', kind, sec, f, o]); },
    takeoff(f, o) { calls.push(['takeoff', f, o]); }, clack(f, o) { calls.push(['clack', f, o]); } };
}
const pointFor = (num, y = 0.2) => (num > 0 && num < 100 ? new THREE.Vector3(num * 2, y, 0) : null);
function rig() {
  const root = new THREE.Scene(), sfx = recorder();
  const steps = createStandeeSteps(root, { pointFor, distance:(a, b) => Math.abs(a - b), scaleFor:() => [0, 2, 3, 5, 7, 8], sfx });
  const pawn = new THREE.Group(); pawn.rotation.order = 'YXZ'; pawn.position.copy(pointFor(1)); root.add(pawn);
  return { root, sfx, steps, pawn };
}
function runTo(steps, pawn, from, to, dt = 16, reduced = false) {
  let out = null, maxY = 0;
  for (let t = from; t <= to; t += dt) { out = steps.drive(pawn, t, reduced); maxY = Math.max(maxY, pawn.position.y); }
  return { out, maxY };
}
{
  const { sfx, steps, pawn, root } = rig();
  ok(sfx.calls[0]?.[0] === 'mix' && sfx.calls[0][1].echoAmt === 0.06 && sfx.calls[0][1].room === 0.3, 'the mix is set from the dial-in (echo .06, room .3)');
  ok(steps.drive(pawn, 0) === null, 'no step → drive hands back null (the caller rests the pawn)');
  ok(steps.step(pawn, { id:'cosmic_ronin', from:1, to:2, yaw:Math.PI / 2, color:'#4488ff' }), 'a hex change queues a step');
  ok(steps.busy(pawn), '…and the pawn is busy');
  const plan = planStep({ style:'hop', kind:'walk', yaw0:0, yaw1:Math.PI / 2, speed:1 });
  const mid = runTo(steps, pawn, 1000, 1000 + plan.land - 20);
  ok(mid.maxY > 0.8, `it hops (peak ${mid.maxY.toFixed(2)} above the deck)`);
  ok(!sfx.calls.some(c => c[0] === 'land'), 'no landing sound before it touches down');
  ok(sfx.calls.some(c => c[0] === 'travel' && c[1] === 'rumble'), 'the rumble plays while it travels');
  runTo(steps, pawn, 1000 + plan.land - 4, 1000 + plan.total + 40);
  const lands = sfx.calls.filter(c => c[0] === 'land');
  ok(lands.length === 1, 'it lands ONCE');
  ok(lands[0][1] === 'slab' && lands[0][3].weight === 0.45 && lands[0][3].sparkle === 2, '…with the stone-on-glass voice, the weight and two sparkle pings');
  ok(Math.abs(lands[0][2][0] / 1046.5 - 1) < 0.01, '…on C6 (±6 cents of wobble)');
  ok(Math.abs(pawn.position.x - 4) < 1e-6 && Math.abs(pawn.position.y - 0.2) < 1e-6, 'it ends ON the new hex, on the deck');
  ok(pawn.rotation.x === 0 && pawn.scale.x === 1 && pawn.scale.y === 1 && Math.abs(pawn.rotation.y - Math.PI / 2) < 1e-6, '…level, full size, facing the step');
  ok(!steps.busy(pawn), '…and at rest');
  ok(steps.live > 0, 'the landing lights the hex (ripple, flash, sparkles)');
  steps.update(performance.now() + 5000, 0.016);
  ok(steps.live === 0, '…and the light clears itself');
  ok(pawn.visible === true, 'pawn.visible is never touched');
  steps.dispose();
  ok(!root.children.some(c => c.name === 'Standee landings'), 'dispose takes the landing group off the scene');
}
{
  const { sfx, steps, pawn } = rig();
  steps.step(pawn, { id:'cosmic_ronin', from:1, to:2, yaw:0 });
  steps.step(pawn, { id:'cosmic_ronin', from:2, to:3, yaw:0 });
  runTo(steps, pawn, 0, 3000);
  ok(sfx.calls.filter(c => c[0] === 'land').length === 2, 'two quick clicks: both steps land — none is skipped');
  ok(Math.abs(pawn.position.x - 6) < 1e-6, '…and it ends two hexes on');
}
{
  const { sfx, steps, pawn } = rig();
  steps.step(pawn, { id:'cosmic_ronin', from:1, to:2, yaw:0, shoved:true });
  runTo(steps, pawn, 0, 2000);
  ok(sfx.calls.some(c => c[0] === 'clack') && !sfx.calls.some(c => c[0] === 'land'), 'a shove clacks instead of ringing');
  ok(!sfx.calls.some(c => c[0] === 'travel'), '…and has no travel rumble');
}
{
  const { sfx, steps, pawn } = rig();
  steps.step(pawn, { id:'cosmic_ronin', from:1, to:3, yaw:0 });
  let minScale = 1;
  for (let t = 0; t < 2000; t += 10) { steps.drive(pawn, t); minScale = Math.min(minScale, pawn.scale.y); }
  const land = sfx.calls.find(c => c[0] === 'land');
  ok(minScale < 0.01, 'a 2-hex leap blinks out (scale ~0, not visible=false)');
  ok(land && land[2].length === 2, '…and lands on two notes');
}
{
  const { sfx, steps, pawn } = rig();
  steps.step(pawn, { id:'cosmic_ronin', from:1, to:2, yaw:0 });
  steps.drive(pawn, 0, true);
  ok(Math.abs(pawn.position.x - 4) < 1e-6 && !steps.busy(pawn), 'reduced motion: the piece is simply there');
  ok(sfx.calls.some(c => c[0] === 'land') && !sfx.calls.some(c => c[0] === 'travel'), '…the landing still sounds, the travel does not');
  ok(steps.group.children.every(c => !(c.isPoints) && !(c.geometry?.type === 'RingGeometry')), '…and the hex fades in without the moving ripple or sparkles');
}
{
  const { sfx, steps, pawn } = rig();
  steps.step(pawn, { id:'cosmic_ronin', from:1, to:2, yaw:0, bot:true });
  runTo(steps, pawn, 0, 2000);
  ok(sfx.calls.find(c => c[0] === 'land')[3].vel <= 0.55 + 1e-9, 'a bot lands at .55 or quieter');
  ok(!steps.step(pawn, { id:'x', from:1, to:500, yaw:0 }), 'a step to nowhere (off the map) is refused');
  steps.forget(pawn);
  ok(pawn.userData.steps === undefined, 'forget drops the queue');
}

// ── §3 the standee's shadow stays on the deck ────────────────────────────────
console.log('§3 the shadow stays on the deck');
{
  const st = createStandee({ id:'cosmic_ronin', color:'#4488ff' }, { loader:() => null });
  const shadow = st.parts[0], ring = st.parts[st.parts.length - 1];
  const base = shadow.scale.x;
  st.frame(0, { lift:1.2 });
  ok(Math.abs(shadow.position.y - (-0.01 - 1.2)) < 1e-9 && Math.abs(ring.position.y - (0.01 - 1.2)) < 1e-9, 'lifted: shadow and ring are pushed back down to the deck');
  ok(shadow.scale.x < base, '…and the shadow shrinks with height');
  st.frame(0, {});
  ok(Math.abs(shadow.position.y + 0.01) < 1e-9 && Math.abs(shadow.scale.x - base) < 1e-9, 'at rest: exactly where it always was');
  st.dispose();
}

// ── §4 teardown ──────────────────────────────────────────────────────────────
console.log('§4 teardown');
function mockCtx() {
  const nodes = [];
  const param = (v = 0) => ({ value:v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const mk = (kind, extra = {}) => { const n = { kind, ...extra, out:true, edges:[], connect(d) { n.edges.push(d); return d; }, disconnect() { n.out = false; } }; nodes.push(n); return n; };
  const ctx = {
    nodes, currentTime:0, sampleRate:44100, state:'running', destination:mk('destination'),
    createGain:() => mk('gain', { gain:param(1) }),
    createOscillator:() => mk('osc', { frequency:param(), detune:param(), type:'sine', start() {}, stop() {} }),
    createBiquadFilter:() => mk('biquad', { frequency:param(), Q:param(), type:'lowpass' }),
    createBufferSource:() => mk('source', { buffer:null, loop:false, start() {}, stop() {} }),
    createBuffer:(ch, len) => ({ getChannelData:() => new Float32Array(len) }),
    createConvolver:() => mk('convolver', { buffer:null }),
    createDelay:() => mk('delay', { delayTime:param() }),
    createDynamicsCompressor:() => mk('comp', { threshold:param(), ratio:param(), attack:param(), release:param() }),
  };
  return ctx;
}
{
  const ctx = mockCtx();
  const a = createLandingSfx({ context:() => ctx, output:c => c.destination });
  const b = createLandingSfx({ context:() => ctx, output:c => c.destination });
  a.ensure(); b.ensure();
  ok(ctx.__rlswLandingBus && ctx.nodes.filter(n => n.kind === 'convolver').length === 1, 'the room + echo bus is built ONCE per context (two instances, one bus)');
  timers.length = 0;
  const built = a.land(T.voice, [1046.5], { weight:T.weight, sparkle:T.sparkleTail, ring:T.ring, bright:T.bright });
  const travel = a.travel('rumble', 0.4, 1046.5);
  const clack = a.clack(1046.5);
  const all = [...built, ...travel, ...clack];
  ok(built.length > 0 && built.some(n => n.kind === 'biquad'), 'a landing reports the nodes it built (outs and filters)');
  ok(all.every(n => n.out), '…and they are live while it rings');
  const landTimer = timers.find(t => t.ms >= 4000);
  ok(!!landTimer && landTimer.ms <= 6000, `the landing's teardown waits out the longest tail (${landTimer?.ms} ms)`);
  for (const t of timers.splice(0)) t.fn();
  ok(all.every(n => !n.out), 'after the tails: every node a landing, travel and clack built is disconnected');
  ok(ctx.__rlswLandingBus.echoIn.out && ctx.__rlswLandingBus.verb.out, '…but the shared room and echo stay up');
}

// ── §5 the numpad ────────────────────────────────────────────────────────────
console.log('§5 the numpad');
{
  const h = HEX_BY_NUM[56];
  const got = Object.fromEntries(['Numpad8', 'Numpad2', 'Numpad9', 'Numpad3', 'Numpad7', 'Numpad1'].map(c => [c, N.numpadTarget(c, h)]));
  ok(Object.values(got).every(Boolean) && new Set(Object.values(got).map(x => x.num)).size === 6, '8/2/9/3/7/1 are the six different neighbours');
  ok(got.Numpad8.px === h.px && got.Numpad8.py < h.py, '8 is straight up — board north (py decreasing)');
  ok(got.Numpad2.px === h.px && got.Numpad2.py > h.py, '2 is straight down');
  ok(got.Numpad9.px > h.px && got.Numpad9.py < h.py && got.Numpad3.px > h.px && got.Numpad3.py > h.py, '9 up-right, 3 down-right');
  ok(got.Numpad7.px < h.px && got.Numpad7.py < h.py && got.Numpad1.px < h.px && got.Numpad1.py > h.py, '7 up-left, 1 down-left');
  ok(N.numpadTarget('Numpad4', h) === null && N.numpadTarget('Numpad6', h) === null, '4 and 6 do nothing (Alex\'s ruling — no left/right neighbour)');
  ok(!N.isNumpadMove({ code:'Numpad4' }) && !N.isNumpadMove({ code:'Numpad6' }) && N.isNumpadMove({ code:'Numpad8' }), '…so the handler does not even claim them');
  ok(!N.isNumpadMove({ code:'Digit8', key:'8' }), 'the top-row 8 is not the numpad 8 (the Riff-Off owns 1–6 on e.key)');
  ok(N.numpadTarget('Numpad8', HEX_BY_NUM[1]) === null, 'off the edge of the board → null');
  const c = read('../rlsw-simulator-v3_8_1.jsx');
  const fn = c.slice(c.indexOf('function numpadMove(e)'), c.indexOf('useEffect(() => { numpadHandlerRef.current = numpadMove; });'));
  ok(fn.length > 100, 'the client has numpadMove');
  ok(/if \(action === 'move'\) \{ onHexClick\(to\.num\); return true; \}/.test(fn), '…a key takes the SAME path as a click on a lit hex');
  ok(/isNumpadMove\(e\)/.test(fn) && /e\.repeat/.test(fn) && /INPUT\|TEXTAREA\|SELECT/.test(fn), '…only numpad keys, no auto-repeat, never while typing');
  ok(/!isMyTurn \|\| !canAct \|\| isBot\(acting\)/.test(fn) && /battleState \|\| activeEvent/.test(fn), '…only on your own turn, never in a battle or an event');
  ok(/turnStep !== 'move_act'/.test(fn), '…only in the Move & Act step');
  ok(/action && action !== 'move'\) return false/.test(fn), '…and leaves another armed action (Swing, Face, Shukuchi) alone');
  ok(/action === 'move_shadow'/.test(fn), '…and walks the Shadow when its walk is armed');
  ok(/window\.addEventListener\('keydown', onKey\);[\s\S]{0,80}numpadHandlerRef|numpadHandlerRef\.current\(e\)/.test(c), 'the listener is bound once and reads the live handler');
}

// ── §6 the wiring ────────────────────────────────────────────────────────────
console.log('§6 wiring');
{
  const v = read('./arenaVisuals.js');
  ok(/createStandeeSteps\(root,\{pointFor:arenaPoint/.test(v), 'arenaVisuals builds the steps on the arena, at the real hex points');
  ok(/sfx:typeof window!=='undefined'\?createLandingSfx\(\):null/.test(v), '…with the landing sound (silent headless)');
  ok(/standeeSteps\.step\(pawn,\{id:spirit\.id,from:pawn\.userData\.num,to:spirit\.num/.test(v), 'a hex change becomes a step');
  ok(/shoved:pawn\.userData\.hitBackCount!=null&&pawn\.userData\.hitBackCount!==spirit\.hitBackCount/.test(v), '…a knockback makes it a shove');
  ok(/bot:!!spirit\.bot/.test(v), '…and a bot is marked');
  ok(/const stepping=pawn\.userData\.standee\?standeeSteps\.drive\(pawn,performance\.now\(\),reduced\):null;/.test(v), 'the frame loop drives a stepping pawn');
  ok(/if\(!stepping\)\{\s*pawn\.position\.lerp\(target/.test(v), '…and a resting one still eases as before');
  ok(/lift:stepping\?\.lift\?\?0/.test(v), 'the standee is told its lift');
  ok(/pawn\.rotation\.z=wobble\+\(stepping\?\.roll\?\?0\)/.test(v), 'the knockback wobble and the step roll share rotation.z');
  ok(/if\(standee\)pawn\.rotation\.order='YXZ'/.test(v), 'a standee pawn turns YXZ');
  ok(/standeeSteps\.forget\(pawn\)/.test(v) && /standeeSteps\.dispose\(\)/.test(v) && /standeeSteps\.update\(performance\.now\(\),dt\)/.test(v), 'forget / dispose / update are wired');
  ok(/bot:!!s\.cpu/.test(read('./arenaFrame.js')), 'arenaFrame passes the bot flag');
  ok(/standeeSteps:standeeSteps\.live/.test(v) && /stats\.standeeSteps>0/.test(read('./arenaRenderer.js')),
    'under reduced motion the renderer keeps drawing until a landing light has faded');
  const pkg = JSON.parse(fs.readFileSync(path.join(HERE, '../../package.json'), 'utf8'));
  ok(pkg.scripts['test:standeemove']?.includes('src/board/standeeMoveCheck.mjs'), 'a script runs this suite');
  ok(/npm run test:standeemove/.test(pkg.scripts['test:all']), '…and test:all runs the script');
  ok(pkg.scripts['test:numpadjourney']?.includes('numpadJourneyCheck.jsx') && /npm run test:numpadjourney/.test(pkg.scripts['test:all']),
    'the numpad journey (the real Game, walked from the keys) has a script, and test:all runs it');
  const arch = read('../ARCHITECTURE.md');
  ok(['standeeMotion.js', 'standeeSteps.js', 'landingSfx.js', 'numpadMove.js', 'standeeMoveCheck.mjs'].every(f => arch.includes(`\`${f}\``)), 'ARCHITECTURE.md names every new module');
}

globalThis.setTimeout = realSetTimeout;
console.log(failures.length ? `\n❌ standeeMoveCheck: ${failures.length} failed, ${pass} passed` : `\n✅ standeeMoveCheck: ${pass} passed`);
if (failures.length) process.exitCode = 1;
