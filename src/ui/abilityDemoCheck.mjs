// ─── test:abilitydemo — the ability pop-out's pure half (2026-10-01) ─────────
// The window SHOWS an ability, so what it shows must be the rules: every
// Shukuchi leap exactly two hexes over the thing it claims to jump, every
// Bushido bout the engine's own d6 → d8 / keep-best / shield ledger. Plus the
// demo clock (fast through the dice, 1× for the move, an exact inverse), the
// placement of the window, and the wiring the header promises.
// Run: node --import ./src/engine/testAssetStub.mjs src/ui/abilityDemoCheck.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ABILITY_DEMO, DEMO_ABILITIES, hasDemo, shukuchiScript, bushidoScenario, SCENARIO_ORDER, KEEP, demoWarp,
  bushidoCaptions, captionAt, bushidoEndCard, shukuchiEndCard, popoutPlace, driveLandings, ring,
  SHAMISEN_DEMO, SHAMISEN_ENDINGS, shamisenScript, shamisenCaptions, shamisenEndCard,
} from './abilityDemo.js';
import { isIwato, CURSE_TURNS, HAUNTED_NOTES, CREEPY_IVS, stringIv } from '../board/cursedShamisen.js';
import { CURSED_SHAMISEN_CD } from '../data/gameConstants.js';
import { NOROI_CARD, NOROI_SPRING_CAST_DELAY_MS } from '../board/noroiCard.js';
import { axialDist } from '../board/hexGeometry.js';
import { planStrike, BUSHIDO_STRIKE } from '../board/bushidoStrike.js';
import { BARRAGE_LAUNCH, SONIC_DICE, SONIC_GATE } from '../board/sonicBarrageTiming.js';
import { bushidoUpgrade } from '../engine/systems/bushido.js';
import { keepForSeats } from '../engine/systems/dicePool.js';
import { resolveSonicBarrage } from '../engine/systems/sonicBarrage.js';
import { abilitiesFor } from '../data/loadouts.js';
import {
  SHUKUCHI_HOP_RINGS, SHUKUCHI_MAX_HOPS, SHUKUCHI_CD, PSYCHO_BUSHIDO_MIN_RANGE, PSYCHO_BUSHIDO_MAX_RANGE,
  PSYCHO_BUSHIDO_AP_COST, psychoBushidoD8s,
} from '../data/gameConstants.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log(`  ✗ ${msg}`); } };
const section = t => console.log(`§ ${t}`);
const read = rel => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const d = (a, b) => axialDist(a[0], a[1], b[0], b[1]);

section('0 · the dial-in and which abilities have a demo');
ok(Object.isFrozen(ABILITY_DEMO), 'ABILITY_DEMO is frozen (one copy)');
const ronin = abilitiesFor('cosmic_ronin').map(s => s.id);
for (const id of DEMO_ABILITIES) ok(ronin.includes(id), `${id} is a real Ronin ability`);
ok(hasDemo('shukuchi') && hasDemo('psycho_bushido') && hasDemo('cursed_shamisen'), 'Shukuchi, Bushido and the Shamisen have demos');
ok(!hasDemo('shadow_illusion'), 'Shadow Illusion keeps the text guide');
for (const [k, v] of Object.entries({ openDelay:2000, swapDelay:400, closeDelay:160, side:'auto', width:400, sound:'off', diceSpeed:2.6, scenario:'cycle' }))
  ok(ABILITY_DEMO[k] === v, `default ${k} = ${JSON.stringify(v)}`);

ok(ABILITY_DEMO.openDelay >= 1000, 'the pop-out waits for a real dwell, not a pass-over (Alex, 2026-10-03)');
ok(ABILITY_DEMO.swapDelay > 0 && ABILITY_DEMO.swapDelay < ABILITY_DEMO.openDelay, 'an open window moves rows after a short beat, never instantly');
{
  const hooks = read('./abilityDemoHooks.js');
  ok(/open \? look\.swapDelay : look\.openDelay/.test(hooks), 'the hook waits swapDelay to move an open window, openDelay to open one');
  ok(/onPointerDown:\(\) => \{ if \(!open\) clear\(\); \}/.test(hooks), 'pressing a row cancels a pending open');
}
ok(KEEP === keepForSeats(2) && KEEP === 2, 'the demo Ronin has two seats: keeps 2 dice a side');

section('1 · Shukuchi: the script is the rule');
const S = shukuchiScript();
ok(S.steps.length === SHUKUCHI_MAX_HOPS, `${SHUKUCHI_MAX_HOPS} leaps`);
for (const [i, s] of S.steps.entries()) {
  ok(d(s.from, s.to) === SHUKUCHI_HOP_RINGS, `leap ${i + 1} is exactly ${SHUKUCHI_HOP_RINGS} hexes`);
  ok(d(s.from, s.mid) === 1 && d(s.mid, s.to) === 1, `leap ${i + 1}'s "over" hex is between`);
  ok(!S.rival || d(s.to, S.rival) > 0, `leap ${i + 1} does not land on the Rival`);
  ok(ring(s.from, SHUKUCHI_HOP_RINGS).some(c => c[0] === s.to[0] && c[1] === s.to[1]), `leap ${i + 1} lands on a lit target`);
  ok(S.cells.some(c => c[0] === s.to[0] && c[1] === s.to[1]), `leap ${i + 1} lands on the island`);
}
ok(S.steps.some(s => s.over === 'rival' && s.mid[0] === S.rival[0] && s.mid[1] === S.rival[1]), 'one leap jumps the Rival');
ok(S.steps.some(s => s.over === 'slime' && s.mid[0] === S.slime[0] && s.mid[1] === S.slime[1]), 'one leap jumps the slime');
ok(S.note && S.steps.at(-1).to.join() === S.note.join(), 'the last leap lands on the note');
ok(ring([0, 0], 2).length === 12, 'ring 2 has 12 hexes');
const sc = shukuchiEndCard();
ok(!/\bDb\b/.test(sc.lines.join(' ')) && sc.lines.join(' ').includes(`${SHUKUCHI_CD}-round`), 'the summary reads the real costs (a cooldown — no Db since 2026-10-02)');

section('2 · Psycho Bushido: every bout is the engine\'s');
const verdicts = {};
for (const name of SCENARIO_ORDER) {
  const b = bushidoScenario(name);
  ok(b.dist >= PSYCHO_BUSHIDO_MIN_RANGE && b.dist <= PSYCHO_BUSHIDO_MAX_RANGE, `${name}: a legal range`);
  ok(JSON.stringify(b.pool) === JSON.stringify(bushidoUpgrade(b.base, b.dist)), `${name}: the pool is bushidoUpgrade's`);
  ok(b.d8s === Math.min(psychoBushidoD8s(b.dist), b.base.filter(s => s === 6).length), `${name}: ${b.d8s} d8s at range ${b.dist}`);
  ok(b.faces.every((f, i) => f >= 1 && f <= b.pool[i]), `${name}: every face fits its die`);
  ok(b.drive.vals.length === KEEP && b.sus.vals.length === KEEP, `${name}: keeps ${KEEP} a side`);
  ok(Math.min(...b.drive.vals) >= Math.max(...b.drive.droppedVals), `${name}: kept the best Drive`);
  ok(b.shieldValue === b.sus.vals.reduce((a, v) => a + v, 0), `${name}: the shield is his kept Sustain`);
  ok(JSON.stringify(b.ledger) === JSON.stringify(resolveSonicBarrage(b.drive.vals, b.shieldValue)), `${name}: the shield's ledger`);
  ok(b.push === Math.ceil(b.ledger.strengthThrough / 2), `${name}: pushed a hex per 2 strength through (${b.ledger.strengthThrough} → ${b.push})`);
  ok(b.battle.bushido && b.battle.bushidoDist === b.dist && b.battle.damage === b.ledger.strengthThrough, `${name}: the battle the visuals get`);
  verdicts[name] = b.ledger.strengthThrough;
}
ok(verdicts.r3 > 0 && verdicts.r4 > 0 && verdicts.r5 > 0, 'ranges 3–5 all get through');
ok(verdicts.holds === 0 && bushidoScenario('holds').push === 0, 'the "holds" bout really holds');
ok(new Set(SCENARIO_ORDER.map(n => bushidoScenario(n).dist)).size === 3, 'the cycle shows all three ranges');
ok(bushidoScenario('nope').name === 'nope' && bushidoScenario('nope').dist === 4, 'an unknown scenario falls back to range 4');
const lands = driveLandings(bushidoScenario('r4'));
ok(lands.every(l => l.at <= SONIC_DICE.landedAt[0] * 1000 + 1) && lands.at(-1).at >= SONIC_DICE.landedAt[0] * 1000 - 1, 'his dice land on the floor dice\'s beat');
const eb = bushidoEndCard().lines.join(' ');
ok(eb.includes(`${PSYCHO_BUSHIDO_AP_COST} AP`) && !/\bDb\b/.test(eb), 'the summary reads the real costs (AP, no Db)');

section('3 · the demo clock');
const plan = planStrike(BUSHIDO_STRIKE, { dist:4, clashMs:BARRAGE_LAUNCH * 1000, shots:KEEP });
const W = demoWarp(ABILITY_DEMO, plan);
let mono = true, inv = true, prev = -1;
for (let s = 0; s <= W.endSeq; s += 0.013) {
  const t = W.toDemo(s); if (t < prev) mono = false; prev = t;
  if (Math.abs(W.toSeq(t) - s) > 1e-9) inv = false;
}
ok(mono, 'toDemo never runs backwards');
ok(inv, 'toSeq is its exact inverse');
ok(W.duration < W.endSeq * 0.75, `fast-forwarded: ${W.duration.toFixed(1)} s for a ${W.endSeq.toFixed(1)} s bout`);
// demo seconds per bout second: 1 = real time, under 1 = fast-forwarded
const rateAt = s => (W.toDemo(s + 0.01) - W.toDemo(s)) / 0.01;
ok(Math.abs(rateAt(plan.vanish / 1000) - 1) < 1e-6, 'the draw plays at 1×');
ok(Math.abs(rateAt(SONIC_GATE - 0.7) - 1) < 1e-6, 'the d6 → d8 beat plays at 1×');
ok(rateAt(2) < 0.67 && rateAt(8) < 0.67, 'the throws are fast-forwarded');
const W1 = demoWarp({ ...ABILITY_DEMO, diceSpeed:1 }, plan);
ok([0.5, 5, 9, 15].every(s => Math.abs(W1.toDemo(s) - s) < 1e-9), 'diceSpeed 1 is the game\'s own timing');

section('4 · captions');
for (const name of SCENARIO_ORDER) {
  const b = bushidoScenario(name), p = planStrike(BUSHIDO_STRIKE, { dist:b.dist, clashMs:BARRAGE_LAUNCH * 1000, shots:KEEP });
  const caps = bushidoCaptions(b, p);
  ok(caps.every((c, i) => !i || c.at >= caps[i - 1].at), `${name}: in order`);
  const last = captionAt(caps, 99);
  ok(b.ledger.strengthThrough > 0 ? last.includes(`${b.ledger.strengthThrough} damage`) : /holds/.test(last), `${name}: the verdict is the ledger's`);
  ok(captionAt(caps, SONIC_GATE - 1).includes(`${b.d8s} of your d6s`), `${name}: the d8 caption is the real count`);
}

section('4b · the Cursed Shamisen: the script is the rule (v3, the trap)');
{
  const D = SHAMISEN_DEMO, sh = shamisenScript();
  ok(D.haunted.length === HAUNTED_NOTES && D.haunted.every(n => isIwato(n, D.root) && CREEPY_IVS.includes(stringIv(n, D.root))), `${HAUNTED_NOTES} haunted notes, every one a creepy Iwato note on the cursed note`);
  ok(D.stepAt > D.layAt + NOROI_CARD.layMs / 1000 && D.wasteAt > D.layAt + NOROI_CARD.layMs / 1000, 'laid (the card has stuck), then sprung — or wasted');
  ok(Math.abs(sh.castAt - D.stepAt - NOROI_SPRING_CAST_DELAY_MS / 1000) < 1e-9 && sh.shatterAt > D.stepAt && sh.shatterAt < sh.castAt,
    '⏱ the arena\'s clock: the step, the shatter (the card comes out), then the cast at the shared delay');
  ok(sh.landed > sh.castAt && sh.burnAt > sh.landed && sh.endAt > sh.burnAt && sh.total > sh.endAt, 'the spring lands, a ghost lifts, then it ends');
  ok(sh.burntAt > sh.ashAt && sh.wasteTotal > sh.burntAt, 'wasted: the card burns, then the loop ends');
  ok(SHAMISEN_ENDINGS.join() === 'exorcised,expired,wasted', 'the loop takes turns through all three endings (rule 18: the waste is shown too)');
  {
    const caps = shamisenCaptions(sh, 'wasted');
    ok(/only you can see it/.test(captionAt(caps, 0.1)) && /noroi card/.test(captionAt(caps, 0.1)), 'wasted: the noroi card, hidden');
    ok(/burns to ash, for everyone/.test(captionAt(caps, 999)), 'wasted: the ash is public');
  }
  for (const end of ['exorcised', 'expired']) {
    const caps = shamisenCaptions(sh, end);
    ok(caps.every((c, i) => !i || c.at >= caps[i - 1].at), `${end}: captions in order`);
    ok(/only you can see it/.test(captionAt(caps, 0.1)) && /Action Token/.test(captionAt(caps, 0.1)), `${end}: the trap — the token, hidden`);
    ok(captionAt(caps, sh.landed + 0.1).includes(`${HAUNTED_NOTES} haunted notes`), `${end}: the haunted count is the rule's`);
    ok(end === 'exorcised' ? /curse lifts/.test(captionAt(caps, 999)) : captionAt(caps, 999).includes(`${CURSE_TURNS} of their turns`), `${end}: the ending says how`);
  }
  const card = shamisenEndCard().lines.join(' ');
  ok(card.includes('Action Token') && !/\bDb\b/.test(card) && card.includes(`${CURSED_SHAMISEN_CD}-round`), 'the summary reads the real costs (no Db)');
}

section('5 · where the window goes');
const view = { w:1400, h:900 }, L = ABILITY_DEMO;
const row = { left:980, right:1330, top:340, bottom:400, width:350, height:60 };
const a = popoutPlace(row, L, view);
ok(a.where === 'left' && a.left + a.width <= row.left, 'auto: to the left of the row, clear of it');
const b2 = popoutPlace({ ...row, left:200, right:550 }, L, view);
ok(b2.where === 'right' && b2.left >= 550, 'no room left → right');
const c = popoutPlace({ left:20, right:380, top:600, bottom:660, width:360, height:60 }, L, { w:420, h:900 });
ok(c.where === 'above' && c.top + c.height <= 600, 'no room either side → above');
const e = popoutPlace({ ...row, top:880, bottom:900 }, L, view);
ok(e.top + e.height <= view.h - 8 + 1e-9 && e.top >= 8, 'clamped into the viewport');
ok(e.arrow >= 18 && e.arrow <= e.height - 18, 'the arrow stays on the window');
ok(popoutPlace(row, { ...L, side:'right' }, view).where === 'right', 'side lever is obeyed');

section('6 · wiring');
const mod = read('./abilityDemo.js'), jsx = read('./AbilityDemo.jsx'), hooks = read('./abilityDemoHooks.js'), css = read('./AbilityDemo.css');
ok(/createBushidoStrikeVisuals\(/.test(mod) && /createSonicClashVisuals\([^]*beams:false/.test(mod), 'Bushido is the arena\'s strike + shield');
ok(/createStandeeSteps\(/.test(mod) && /STANDEE_MOVE/.test(mod), 'Shukuchi is the shipped standee step');
ok(/createStandee\(/.test(mod), 'the real standees');
ok(/createCursedShamisenVisuals\(/.test(mod) && /scheduleCast\(curseSfx/.test(mod), 'the Shamisen is the arena\'s own curse, with its own cast score');
ok(/createNoroiCard\(/.test(mod) && /createLostChords\(/.test(mod), '🪤 the noroi card and its crystal are the game\'s own (`noroiCard.js`, `lostChords.js`)');
ok(/curseSfx\?\.stopAll\?\.\(\)/.test(mod), 'closing the window cuts the scheduled cast');
ok(!/arenaVisuals/.test(mod.replace(/\/\/.*$/gm, '')), 'does not drag the whole arena in');
ok(/canUseWebGL\(\)/.test(hooks) && /return ok \? get : null/.test(hooks), 'no WebGL2 → no player (text guide stays)');
ok(/halt\(\);\s+\/\/ ⚠️ NOT stop\(\)/.test(mod), 'play() never detaches the canvas it was just given');
ok(/strikeSfx\?\.stopAll\?\.\(\)/.test(mod), 'closing the window cuts the scheduled thunder');
ok(/onFocus:/.test(hooks) && /Escape/.test(hooks), 'focus opens it, Escape closes it');
ok(/demo\.attach\(/.test(jsx) && /return \(\) => demo\.stop\(\)/.test(jsx), 'the window gives the canvas back when it closes');
ok(/prefers-reduced-motion/.test(css), 'reduced motion: no slide-in');
const draft = read('./SpiritDraft.jsx'), indexCss = read('../index.css');
ok(/useAbilityDemo\(ABILITY_DEMO\)/.test(draft) && /useAbilityPopout\(ABILITY_DEMO\)/.test(draft), 'the game mounts it with the dial-in');
ok(/pop\.bind\(skill\)/.test(draft) && /hasDemo\(skill\.id\)/.test(draft), 'only rows with a demo pop out');
ok(/demoable = !!getDemo/.test(draft), 'no WebGL → no pop-out (the text guide stays)');
ok(/variant="inline"/.test(draft) && /ABILITY_DEMO\.inGuide === 'on'/.test(draft), 'the Field Guide plays it too');
ok(/@import "\.\/ui\/AbilityDemo\.css"/.test(indexCss), 'its CSS is in the app stylesheet');
ok(/createPortal\(win, document\.body\)/.test(jsx), 'the pop-out is portalled to <body>');
let prev2 = '';
try { prev2 = read('../../.scratch/ability-demo-preview.jsx'); } catch { /* the preview is not in every checkout */ }
if (prev2) {
  const keys = [...prev2.matchAll(/[RS]\('(?:window|picture|script|sound)', '(\w+)'/g)].map(m => m[1]);
  ok(Object.keys(ABILITY_DEMO).every(k => keys.includes(k)), 'every lever in ABILITY_DEMO is on the preview');
  ok(keys.every(k => k in ABILITY_DEMO), 'and the preview has no lever the module ignores');
  ok(/ABILITY_DEMO\[l\.key\]/.test(prev2), 'the preview\'s defaults ARE ABILITY_DEMO');
}

console.log(`\nabilitydemo: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
