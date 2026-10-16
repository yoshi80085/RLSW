// ─── 🎤 THE FAN MC CHECK (2026-10-15) ────────────────────────────────────────
// Alex: before a stage effect, the wallpaper's fan comes out with a mic — the
// standings, (once) the riff of the night, then he CALLS the effect. Rulings pinned
// here: the replay at his LAST show of the match, whatever its length (10-15: 20
// rounds only; widened 10-16 — 7 of 10, his only show; 12 of 15; 17 of 20); the
// match remembers ONE duel, the best so far, replaced only by a
// better one; the mic never ends up in his head; the effect's rules never wait,
// only its picture does. Reads the CLIENT for the wiring (§B2).
// Run: npm run test:fanmc
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  FAN_MC, replayShow, mcIntermission, compileIntermission, intermissionAt, skipTarget, rankPlayers, raceShape,
  replayPlan, energyAt, fanMcSoundTimes, fanMcColor, BLAST_S, demoRiff,
} from '../data/fanMc.js';
import { STAGE_FX_META } from '../data/stageEffects.js';
import { applyRiffClosed, riffMoment, riffMomentScore, RIFF_GRADE_WEIGHT } from './systems/riffOff.js';
import { riffSides } from '../data/fanMc.js';
import { assertJsonSafe } from './serialize.js';

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, `${msg} (${a} vs ${b})`);

// ── §1 Alex's dial-in, pinned ────────────────────────────────────────────────
eq([FAN_MC.color, FAN_MC.offHand, FAN_MC.energy, FAN_MC.talkSpeed, FAN_MC.hold], ['white', 'free', 1.2, 37, 1.35], 'his five moved levers');
eq([FAN_MC.standStyle, FAN_MC.riffShow, FAN_MC.replayLen, FAN_MC.ffShare, FAN_MC.nameIt, FAN_MC.skipTo], ['bars', 'tv', 5.4, .34, 'name', 'call'], 'the r2/r3 defaults he kept');
ok(!('laterShows' in FAN_MC), 'laterShows is retired: the replay rule decides which show has a riff beat');
eq(fanMcColor(FAN_MC), '#dfe8ff', 'moon white — nobody\'s seat colour');
eq(fanMcColor({ ...FAN_MC, color:'leader' }, '#ff6600'), '#ff6600', 'leader option');

// ── §2 the replay: his LAST show of the match, whatever its length ─────────
// Alex 10-16: "Lets make that last appearance of the MC showcase the best riff off replay
// (even in 15 rounds or 10 rounds only matches - in case of the 10 rounds - its the only
// appearance so have him showcase here too)".
for (const [lim, r] of [[10, 7], [15, 12], [20, 17], [null, 17]])
  ok(replayShow(lim, r), `${lim ?? 'Legend Run'}: the last show (round ${r}) replays`);
for (const [lim, r] of [[20, 7], [20, 12], [15, 7], [null, 7], [null, 12], [10, 8], [10, 12], [5, 7], [6, 7]])
  ok(!replayShow(lim, r), `no replay at ${lim ?? 'Legend Run'} round ${r}`);

// ── fixtures ──
const P = [['a', 'Shredding Ronin', '#4488ff', 24, 14], ['b', 'Glamarchy', '#ff6600', 22, 11], ['c', 'Intergalactic 0', '#aa55ff', 17, 9], ['d', 'Metalness Monster', '#ffcc00', 12, 6]]
  .map(([id, name, color, fame, fans]) => ({ id, name, color, fame, fans }));
const notes = s => s.split('').map(c => ({ grade:{ P:'perfect', g:'good', o:'ok', m:'miss', w:'wrong' }[c], key:'c', string:2 }));
const GREAT = { round:4, turn:13, attackerId:'a', defenderId:'b', winnerId:'b', margin:3, exchanges:2, decidedBy:'performance · Exchange 2', bothStrong:false,
  atk:{ quality:74, perfects:3, avgRt:88, energy:13.4, notes:notes('PgPgogmPgo') }, def:{ quality:86, perfects:5, avgRt:71, energy:16.9, notes:notes('PPgPgPgPoP') } };
const WEAK = { ...GREAT, atk:{ ...GREAT.atk, quality:44 }, def:{ ...GREAT.def, quality:48 } };
const fx = { id:'pyrotechnics', ...STAGE_FX_META.pyrotechnics };
const facts = over => ({ players:P, round:7, roundLimit:10, best:GREAT, replay:false, fx, show:{ round:7, untilRound:10 }, seed:'a|b|c|d', ...over });
const ids = beats => beats.map(b => b.id);

// ── §3 the words ─────────────────────────────────────────────────────────────
eq(ids(mcIntermission(facts())), ['arrive', 'standings', 'tease', 'reveal', 'exit'], 'a show that is not his last: standings and the call, no riff beat — even with a great duel remembered');
eq(ids(mcIntermission(facts({ replay:replayShow(10, 7) }))), ['arrive', 'standings', 'riff', 'tease', 'reveal', 'exit'], '10 rounds: his only show IS his last, so it replays');
eq(ids(mcIntermission(facts({ round:7, roundLimit:15, replay:replayShow(15, 7), show:{ round:7, untilRound:9 } }))), ['arrive', 'standings', 'tease', 'reveal', 'exit'], '15 rounds, show 1: no replay');
eq(ids(mcIntermission(facts({ round:12, roundLimit:15, replay:replayShow(15, 12), show:{ round:12, untilRound:15 } }))), ['arrive', 'standings', 'riff', 'tease', 'reveal', 'exit'], '15 rounds, show 2 (the last): the replay');
const last = mcIntermission(facts({ round:17, roundLimit:20, replay:true, show:{ round:17, untilRound:20 } }));
eq(ids(last), ['arrive', 'standings', 'riff', 'tease', 'reveal', 'exit'], '20 rounds, the last show: the riff of the night');
ok(last[2].card?.riff === GREAT && last[2].card.winnerId === 'b' && last[2].card.loserId === 'a', 'the riff card carries the remembered duel');
ok(/Glamarchy/.test(last[2].lines[1].text) && last[2].lines[1].to === 'b', 'he names the winner and turns to them');
const weak = mcIntermission(facts({ replay:true, best:WEAK }));
ok(weak[2].id === 'riff' && !weak[2].card && /riff/i.test(weak[2].lines[0].text), 'a duel under the bar (60%) gets a line, not a replay');
const none = mcIntermission(facts({ replay:true, best:null }));
ok(none[2].id === 'riff' && !none[2].card, 'no duel all match: a line');
eq(ids(mcIntermission(facts({ replay:true, best:null }), { ...FAN_MC, noRiff:'skip' })), ['arrive', 'standings', 'tease', 'reveal', 'exit'], 'noRiff skip drops the beat');
const gone = mcIntermission(facts({ replay:true, best:{ ...GREAT, defenderId:'zz' } }));
ok(!gone[2].card, 'a duel with a Spirit no longer in the match is not replayed');
const st = mcIntermission(facts())[1];
eq(st.card.rows.map(r => r.id), ['a', 'b', 'c', 'd'], 'standings ranked by Fame');
ok(st.lines[0].to === 'a' && st.card.shape === 'close' && /\b2\b/.test(st.lines[0].text), 'a 2-point lead is neck and neck, and he says by how much');
ok(st.lines.some(l => l.to === 'd'), 'a word for last place (4 players)');
ok(/4 rounds/.test(st.lines[st.lines.length - 1].text), 'rounds left counts the round about to open (7 of 10 → 4)');
eq(raceShape(rankPlayers(P.map(p => p.id === 'b' ? { ...p, fame:24 } : p))), 'tie', 'a tie at the top');
eq(rankPlayers(P.map(p => p.id === 'b' ? { ...p, fame:24, fans:14 } : p)).map(r => r.place).slice(0, 2), [1, 1], 'equal Fame and fans share a place');
ok(/\{/.test(mcIntermission(facts()).flatMap(b => b.lines).map(l => l.text).join('')) === false, 'no unfilled {placeholders}');
eq(mcIntermission(facts()), mcIntermission(facts()), 'seeded: the same match says the same lines (every peer agrees)');
const legend = mcIntermission(facts({ roundLimit:null, show:{ round:7, untilRound:9 } }));
ok(/Legend Run/.test(legend[1].lines.at(-1).text) && legend[1].card.left === null, 'Legend Run: no buzzer to count down');
ok(mcIntermission(facts())[3].card.howLong === 'until the final buzzer' && legend[3].card.howLong === 'rounds 7–9', 'how long the effect runs');

// ── §4 the clock ─────────────────────────────────────────────────────────────
const tl = compileIntermission(mcIntermission(facts()), FAN_MC);
ok(tl.segs.every((s, i) => i === 0 || Math.abs(s.t0 - tl.segs[i - 1].t1) < 1e-9), 'beats are back to back');
ok(tl.segs.every(s => s.t1 > s.t0) && tl.T === tl.segs.at(-1).t1, 'every beat has length; T is the end');
const rv = tl.segs.find(s => s.id === 'reveal');
ok(tl.hit > rv.t0 && tl.hit < rv.t1 && tl.hit === rv.hit, 'the call lands inside the reveal beat');
ok(tl.segs[0].lines[0].t0 > FAN_MC.flyIn * .5, 'he talks as he lands, not mid-flight');
for (const s of tl.segs) for (const l of s.lines) near(l.typed - l.t0, l.text.length / FAN_MC.talkSpeed, 1e-9, `typed at his talk speed: "${l.text}"`);
ok(tl.T > 15 && tl.T < 40, `a normal show runs ${tl.T.toFixed(1)} s`);
const tlR = compileIntermission(last, FAN_MC), tv = tlR.segs.find(s => s.id === 'riff').tv;
ok(tv && tv.in < tv.on && tv.on < tv.start && tv.start < tv.end && tv.end < tv.verdict && tv.verdict <= tv.rise && tv.rise < tv.out, 'the TV: drop → on → replay → verdict → rise');
near(tv.end - tv.start, FAN_MC.replayLen, 1e-9, 'the replay runs replayLen');
ok(tlR.segs.find(s => s.id === 'riff').lines[1].t0 >= tv.end, 'the result line waits for the replay to end');
ok(tlR.T > tl.T, 'the replay show is the long one');
eq(intermissionAt(tl, tl.hit + .01).seg.id, 'reveal', 'intermissionAt finds the beat');
eq(skipTarget(tl, 1), tl.hit - .35, 'Skip lands just before the call');
eq(skipTarget(tl, tl.hit + 1), tl.hit + 1, 'Skip never goes backwards');
eq(skipTarget(tl, 1, { ...FAN_MC, skipTo:'end' }), tl.T, 'skipTo end');
const sounds = fanMcSoundTimes(tl);
eq(sounds.map(x => x.kind), ['arrive', 'tap', 'roll', 'hit', 'leave'], 'the sounds');
eq(sounds.find(x => x.kind === 'hit').at, tl.hit, 'the hit sound IS the call');

// ── §5 the replay's clock: the ball builds, the last notes feed it, the blast ─
const plan = replayPlan(GREAT, FAN_MC.replayLen, FAN_MC);
eq(plan.notes.length, FAN_MC.replayNotes * 2, 'the last N notes of each side');
ok(plan.notes.filter(x => x.side === 0).every(x => x.at < plan.sides[1].from), 'the call before the answer');
near(plan.blast, FAN_MC.replayLen - BLAST_S + .12, 1e-9, 'the blast leaves ~1.25 s to land');
eq(energyAt(GREAT, plan, 0, RIFF_GRADE_WEIGHT), [0, 0], '⏩ the build-up starts from nothing');
eq(energyAt(GREAT, plan, plan.blast, RIFF_GRADE_WEIGHT), [13.4, 16.9], 'by the blast the ball is the duel\'s whole energy');
{ let prev = -1, mono = true; for (let s = 0; s <= FAN_MC.replayLen; s += .05) { const e = energyAt(GREAT, plan, s, RIFF_GRADE_WEIGHT); const t = e[0] + e[1]; if (t < prev - 1e-9) mono = false; prev = t; }
  ok(mono, 'the ball never shrinks before the blast'); }

// ── §6 the engine remembers ONE duel: the best so far ───────────────────────
const res = s => s.split('').map((c, i) => { const grade = { P:'perfect', g:'good', o:'ok', m:'miss' }[c]; return { hit:grade !== 'miss', rt:grade === 'miss' ? null : 80, grade, noteIdx:i }; });
const duel = (atk, def, attackerWon, extra = {}) => ({ turn:{ round:5, count:20 }, bestRiff:extra.best ?? null, battle:{ kind:'riffOff', attackerId:'a', defenderId:'b', round:extra.round ?? 1,
  atkResults:res(atk), defResults:res(def), arenaEnergy:extra.energy ?? [0, 0],
  atkRiff:{ degrees:[0, 1, 2, 3], sharps:[false, false, false, false] }, defRiff:{ degrees:[0, 1, 2, 3], sharps:[false, false, false, false] },
  verdict:{ round:extra.round ?? 1, attackerWon, margin:2, tie:!!extra.tie, decidedBy:'performance', bothStrong:false } } });
const s1 = applyRiffClosed(duel('PPgP', 'gomm', true));
ok(s1.battle === null && s1.bestRiff?.winnerId === 'a', 'the first duel is remembered');
eq(s1.bestRiff.atk.notes.map(x => x.grade), ['perfect', 'perfect', 'good', 'perfect'], 'its notes, in play order');
ok(s1.bestRiff.atk.notes.every(x => typeof x.key === 'string'), 'each note keeps its key');
near(s1.bestRiff.atk.energy, 3.7, 1e-9, 'energy = the duel\'s score');
const s2 = applyRiffClosed({ ...duel('gomm', 'Pgoo', false), bestRiff:s1.bestRiff });
ok(s2.bestRiff === s1.bestRiff, 'a worse duel is forgotten');
const s3 = applyRiffClosed({ ...duel('PPPP', 'PPPg', true, { round:2, energy:[3, 3] }), bestRiff:s1.bestRiff });
ok(s3.bestRiff !== s1.bestRiff && s3.bestRiff.exchanges === 2, 'a better one replaces it (and the old one is gone)');
near(s3.bestRiff.atk.energy, 7, 1e-9, 'energy includes the earlier exchanges (arenaEnergy)');
const s4 = applyRiffClosed({ ...duel('PPgP', 'gomm', true), bestRiff:s1.bestRiff });
ok(s4.bestRiff === s1.bestRiff, 'an EQUAL duel does not knock the first one out');
const s5 = applyRiffClosed({ ...duel('PPPP', 'PPPP', true, { tie:true }), bestRiff:null });
ok(s5.bestRiff === null, 'a tie is never remembered');
const s6 = applyRiffClosed({ turn:{ round:5 }, bestRiff:s1.bestRiff, battle:{ kind:'riffOff', verdict:null } });
ok(s6.bestRiff === s1.bestRiff && s6.battle === null, 'an aborted duel (no verdict) changes nothing');
ok(riffMomentScore(null) === -Infinity && riffMoment({ battle:null }) === null, 'nothing to remember from nothing');
ok(assertJsonSafe(s3), 'the record survives a save (JSON-safe)');

// ── §7 the arena: the MC, the mic, the TV (three, no WebGL) ─────────────────
globalThis.document ??= { createElement:() => ({ width:0, height:0, getContext:() => null, style:{} }) };
globalThis.performance ??= { now:() => Date.now() };
const { createFanMcStage } = await import('../board/fanMcStage.js');
const root = new THREE.Group(), pointFor = num => new THREE.Vector3(num % 7, .18, Math.floor(num / 7) % 5);
const stage = createFanMcStage(root, { pointFor });
const spirits = P.map((p, i) => ({ id:p.id, num:20 + i * 9, color:p.color, corner:'blue', imageSrc:null }));
const show = { key:'17:pyrotechnics', startMs:1000, timeline:tlR, players:P, fx, round:17, roundLimit:20, spirits };
stage.update(show);
const at = t => stage.tick(1000 + t * 1000, { camera:null, clock:t });
at(-.1); ok(!stage.group.visible, 'nobody on stage before the show starts');
at(.3); const mid = stage.group.position.y; ok(stage.group.visible && mid > FAN_MC.height + 2, 'he arrives from the sky');
at(FAN_MC.flyIn + .2); near(stage.group.position.y, FAN_MC.height, FAN_MC.bob + .01, 'he settles at his height over centre stage');
ok(Math.abs(stage.group.position.x) < 1e-6 && Math.abs(stage.group.position.z) < 1e-6, '…over centre stage');
const rs = tlR.segs.find(s => s.id === 'riff');
at(rs.tv.start + 1); ok(stage.tv.visible, 'the TV is down during the replay');
at(tlR.segs.find(s => s.id === 'standings').t0 + 1); ok(!stage.tv.visible, 'and up otherwise');
const te = tlR.segs.find(s => s.id === 'tease');
ok(stage.light(1000 + (te.t0 + .8) * 1000).dim > .4, 'the lights drop on the tease');
ok(stage.light(1000 + (tlR.hit + .1) * 1000).flash > .5, 'and flash on the call');
eq(stage.light(1000 + 2000).dim + stage.light(1000 + 2000).flash, 0, 'normal light otherwise');
const wide = { position:new THREE.Vector3(20, 15, 25), target:new THREE.Vector3(1, -2.8, 0) };
stage.update(null); stage.update({ ...show, key:'cam' });
let lens = null; for (let k = 0; k <= 60; k++) lens = stage.camera(1000 + (FAN_MC.flyIn + 2) * 1000 + k * 50, 1.6, { follow:true, from:wide, wide });
ok(lens && lens.position.distanceTo(new THREE.Vector3(0, FAN_MC.height, 0)) < FAN_MC.camDist * 1.6, 'the lens comes to him');
for (let k = 0; k <= 80; k++) lens = stage.camera(1000 + (tlR.hit + 1) * 1000 + k * 50, 1.6, { follow:true, wide });
ok(lens.position.distanceTo(wide.position) < .3, 'on the call it pulls back to the ◈ Arena view');
ok(stage.camera(1000 + (tlR.T + 2) * 1000, 1.6, { follow:true, wide }) === null, 'and lets go after the show');
ok(stage.camera(1000 + 3000, 1.6, { follow:false, wide }) === null, '☰ Auto camera off: he never takes the lens');

// 🎤 THE MIC NEVER ENDS UP IN HIS HEAD (r2: "no matter what the settings")
{
  let worst = Infinity;
  for (const micSize of [.6, 1, 1.3, 1.8, 2.2]) for (const micToMouth of [0, .5, .85, 1]) for (const micStyle of ['ball', 'retro']) {
    stage.setLook({ micSize, micToMouth, micStyle });
    stage.update(null); stage.update({ ...show, key:`m${micSize}${micToMouth}${micStyle}` });
    for (const t of [FAN_MC.flyIn + .3, rs.lines[0].t0 + .3, te.t0 + .6, tlR.hit + .2, ...Array.from({ length:12 }, (_, i) => FAN_MC.flyIn + i * .7)]) {
      for (let k = 0; k < 12; k++) at(t + k / 30);   // let the moods settle
      const fan = stage.group.children[0].children.find(c => c.isGroup && c.children.some(f => f.userData?.hands))?.children.find(f => f.userData?.hands);
      const head = fan.children.find(c => c.isGroup && Math.abs(c.position.y - .49) < .06), hand = fan.userData.hands[1], mic = hand.children.find(c => c.name === 'MC mic');
      const len = (micStyle === 'retro' ? .14 : .155) * micSize, gR = (micStyle === 'retro' ? .04 : .05) * micSize;
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(mic.quaternion);
      const grille = hand.position.clone().addScaledVector(axis, len);
      worst = Math.min(worst, grille.distanceTo(head.position) - (.12 + gR));
    }
  }
  ok(worst > 0, `the mic's head stays outside his head at every size, style and pose (closest gap ${worst.toFixed(3)})`);
}
stage.setLook(FAN_MC);
ok(stage.diagnostics().live && typeof stage.busy(1000) === 'boolean', 'diagnostics + busy');
stage.dispose(); ok(!root.children.some(c => c.name === 'Fan MC' || c.name === 'Replay TV'), 'dispose cleans up');
// 🔝 Alex 10-16: "it looked like he was appearing 'behind' other assets". He, his light and
// the TV go on the renderer's MC layer (`floatRoot`); only the board wash stays on the board.
{
  const board = new THREE.Group(), layer = new THREE.Scene();
  const s2 = createFanMcStage(board, { pointFor, floatRoot:layer });
  ok(s2.group.parent === layer && s2.tv.parent === layer, 'he and the TV live on the MC layer, not the arena');
  ok(layer.children.some(c => c.isSpotLight) && !board.children.some(c => c.isSpotLight), 'his spotlight comes with him (it lights HIM)');
  ok(board.children.some(c => c.isMesh) && !layer.children.some(c => c.isMesh), 'the board wash stays on the board');
  s2.dispose(); ok(!layer.children.some(c => c.name === 'Fan MC' || c.name === 'Replay TV' || c.isSpotLight), 'dispose cleans the layer too');
}

// ── §8 the client wiring (§B2: read the client, not just the module) ────────
const M = readFileSync(new URL('../rlsw-simulator-v3_8_1.jsx', import.meta.url), 'utf8');
ok(/const fanMcLive = fanMcTestLive \|\| \(fanMcWanted && !!fxDrawKey && fxDraw\.round === engineState\.turn\?\.round && fanMcDone !== fxDrawKey\);/.test(M), 'the hold is DERIVED from the engine\'s draw in render (or a Testing Grounds summon)');
ok(/const fanMcTestLive = testMode && !!fanMcTest && fanMcDone !== fanMcTest\.key;/.test(M), '🧪 a summon exists only in Testing Grounds (testMode, never online)');
eq((M.match(/if \(openingLive \|\| fanMcLive\) return true;/g) ?? []).length, 3, 'all three key handlers hold for him');
ok(/if \(openingLive \|\| fanMcLive\) return;\s*\{\s*const hold = entranceHoldRef/.test(M), 'the bots hold for him');
ok(/if \(battleState\) return; \/\/ a battle is animating[^\n]*\n[^\n]*\n[^\n]*\n\s*if \(openingLive \|\| fanMcLive\) return;/.test(M), 'the bot watchdog does not fire mid-show');
ok(/if \(fanMcLiveRef\.current\) return;/.test(M), 'the bat clock waits for his call');
ok(/const fxView = fanMcVeil \? \{\} : engineState\.stageFx;/.test(M), 'the effect\'s views are veiled until the call');
ok(/fanMcWanted \? fanMcDeferredRef\.current : null\);/.test(M) && /dispatch\(stageFxActivated\(/.test(M), 'the effect still ACTIVATES in the rules at once; only its words wait');
ok(/replay: test \? !!test\.replay : replayShow\(roundLimit, draw\.round\)/.test(M) && /best: test \? \(test\.best \?\? null\) : st\.bestRiff \?\? null/.test(M), 'a match show reads the replay rule and the engine\'s remembered duel');
ok(/fanMc:fanMcLive \? fanMcShow : null/.test(M) && /<FanMcOverlay show=\{fanMcShow\} onSkip=\{skipFanMc\}/.test(M), 'the arena and the overlay get the show');
const R = readFileSync(new URL('../board/arenaRenderer.js', import.meta.url), 'utf8');
ok(/visuals\.fanMcCamera\(/.test(R) && /visuals\.fanMcLight\(/.test(R), 'the renderer gives him the lens and the light');
// 🔝 his own layer, drawn LAST on the foreground canvas after a depth clear
ok(/createArenaVisuals\(scene,\{foregroundScene,beamScene:beams\.scene,mcScene\}\)/.test(R), 'the renderer hands the visuals his layer');
{ const draw = R.indexOf('foreground.render(mcScene,camera)'), beamsAt = R.indexOf('beams.render(camera'), selfAt = R.indexOf('smoke.drawSelf(camera'), fgAt = R.indexOf('foreground.render(foregroundScene,camera)');
  ok(draw > beamsAt && draw > selfAt && draw > fgAt && beamsAt > 0, 'he is drawn AFTER the standees, the smoke and the Sonic\'s rings');
  ok(/foreground\.clearDepth\(\);foreground\.render\(mcScene,camera\)/.test(R), '…after a depth clear, so nothing drawn before can hide him'); }
ok(/visuals\.fanMcPrerender\(foreground\)/.test(R), 'the TV\'s picture is drawn by the renderer that draws the TV (a target is per context)');
const AV = readFileSync(new URL('../board/arenaVisuals.js', import.meta.url), 'utf8');
ok(/createFanMcStage\(root,\{pointFor:arenaPoint,floatRoot:mcScene\?\?root\}\)/.test(AV), 'the visuals put him on that layer');
// ⚠️ Seen live 10-15: the full ◈ Arena preset left the board a speck for his call. His wide is the preview's (.6 of it).
ok(/const f=fit\(Math\.max\(camera\.aspect,\.25\)\)\*\.6,target=/.test(R), 'his wide pull-back is the one Alex dialled (.6 of the ◈ Arena preset), not a speck');
const O = readFileSync(new URL('../ui/FanMcOverlay.jsx', import.meta.url), 'utf8');
ok(/<button type="button" className="fanmc-skip" data-fanmc-skip data-pad-default=/.test(O) && /'Escape'/.test(O), 'pad-ready: Skip is a real button, the ring starts there, B / Escape skips');

// ── §9 🧪 summoned in Testing Grounds (Alex 10-16: "make sure he can be summoned") ──
{
  const d = demoRiff(['a', 'b'], 9);
  eq(Object.keys(d).filter(k => k !== 'demo').sort(), Object.keys(GREAT).sort(), 'the demo duel has the engine record\'s shape');
  ok(d.winnerId === 'b' && riffSides(d).w.quality >= FAN_MC.riffBar, 'and is good enough to replay');
  ok(demoRiff(['a']) === null && demoRiff(null) === null, 'no demo duel with fewer than two Spirits');
  const beats = mcIntermission(facts({ replay:true, best:d, show:null, roundLimit:null }));
  ok(beats.find(b => b.id === 'riff')?.card?.riff === d, 'a summon with the replay puts the demo duel on the TV');
  eq(beats.find(b => b.id === 'reveal').card.howLong, '', 'a summon has no run length to announce');
  ok(/function devSummonFanMc\(/.test(M) && /activateStageFx\(id, \{ round: st\.turn\?\.round \}, fanMcDeferredRef\.current\);/.test(M),
    'a summon fires the effect the real way: live in the rules now, its words deferred to his call');
  ok(/const best = replay === 'none' \? null : st\.bestRiff \?\? demoRiff\(/.test(M), 'the match\'s own duel first; the demo only when there is none');
  ok(!/dispatch\([^)]*demoRiff/.test(M), 'the demo duel never reaches the engine');
  const TG = readFileSync(new URL('../ui/TestingGrounds.jsx', import.meta.url), 'utf8');
  ok(/devSummonFanMc\(\{ fxId: mcFx, replay \}\)/.test(TG) && /data-tg-fanmc=/.test(TG), 'the 🧪 panel has the summon buttons');
  ok(/\{testMode && !fanMcLive && \(/.test(TG), 'the 🧪 layer steps aside while he is on stage');
  ok(/devSummonFanMc=\{devSummonFanMc\}/.test(M) && /fanMcLive=\{fanMcLive\}/.test(M), 'the monolith wires it');
}

// ── §10 🎩 his look: Alex's Wardrobe dial-in (2026-10-16, 7 of 16 levers) ─────────
{
  const { MC_OUTFIT, MC_OUTFIT_BEFORE, outfitFanStyle } = await import('../board/fanMcOutfit.js');
  eq([MC_OUTFIT.head, MC_OUTFIT.eyes, MC_OUTFIT.aura, MC_OUTFIT.mic, MC_OUTFIT.main, MC_OUTFIT.accent, MC_OUTFIT.metal],
    ['mohawk', 'visor', 'notes', 'neon', '#0f2e2a', '#ff4fd8', 'silver'], 'his seven moved levers');
  eq([MC_OUTFIT.neck, MC_OUTFIT.body, MC_OUTFIT.hatSize, MC_OUTFIT.hatTilt, MC_OUTFIT.glow], ['none', 'none', 1, .18, 1], 'the ones he left alone');
  eq(Object.keys(MC_OUTFIT).filter(k => MC_OUTFIT[k] !== MC_OUTFIT_BEFORE[k]).length, 7, 'the "before" differs in exactly his seven');
  eq([outfitFanStyle(MC_OUTFIT), outfitFanStyle(MC_OUTFIT_BEFORE), outfitFanStyle(MC_OUTFIT_BEFORE, 'plain')], ['plain', 'ronin', 'plain'], 'a mohawk needs the plain head; the band IS the ronin style');
  const s3 = createFanMcStage(new THREE.Group(), { pointFor });
  s3.update({ ...show, key:'look' });
  for (let k = 0; k < 20; k++) s3.tick(1000 + (FAN_MC.flyIn + 1 + k / 30) * 1000, { camera:null, clock:k / 30 });
  const fan = (() => { let f = null; s3.group.traverse(o => { if (!f && o.userData?.hands && o.userData?.tick) f = o; }); return f; })();
  ok(fan && !fan.getObjectByName('Ronin hachimaki'), 'no Ronin band under the mohawk');
  const hw = fan.getObjectByName('MC headwear'), ew = fan.getObjectByName('MC eyewear'), au = fan.getObjectByName('MC aura');
  ok(hw && (() => { let c = 0; hw.traverse(o => { if (o.geometry?.type === 'ConeGeometry') c++; }); return c === 7; })(), 'the mohawk: seven spikes');
  ok(ew && ew.children.some(o => o.geometry?.type === 'CylinderGeometry'), 'the LED visor across his eyes');
  ok(!!au, 'the notes aura is mounted (its glyphs need a canvas, so node draws none)');
  const mic = fan.userData.hands[1].children.find(c => c.name === 'MC mic');
  ok((() => { let neon = false; mic.traverse(o => { if (o.material?.emissive && o.material.emissive.getHexString() === 'ff4fd8') neon = true; }); return neon; })(), 'the neon mic glows in his accent');
  s3.setOutfit({ head:'band', mic:'chrome' });
  const fan2 = (() => { let f = null; s3.group.traverse(o => { if (!f && o.userData?.hands && o.userData?.tick) f = o; }); return f; })();
  ok(fan2 !== fan && !!fan2.getObjectByName('Ronin hachimaki') && fan2.getObjectByName('MC headwear').children.length === 0, 'setOutfit re-dresses him (the band comes back, the mohawk goes)');
  s3.dispose();
  const ST = readFileSync(new URL('../board/fanMcStage.js', import.meta.url), 'utf8');
  ok(/dress = dressMc\(fan, O\);/.test(ST) && /dress\?\.tick\(clock, \{ mood, dt, reduced \}\)/.test(ST), 'the stage dresses him after every build and ticks it with his mood');
  const PV = readFileSync(new URL('../../.scratch/fan-mc-fashion-preview.js', import.meta.url), 'utf8');
  ok(/from '\.\.\/src\/board\/fanMcOutfit\.js'/.test(PV) && !/function dressMc/.test(PV), 'the Wardrobe page runs the game\'s wardrobe (one copy, §B1)');
}

console.log(`✅ fanMcCheck: ${n} assertions passed`);
