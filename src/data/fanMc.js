// ─── 🎤 THE FAN MC — his dial-in, his words, his timeline ────────────────────
// Alex, 2026-10-15: before a stage effect starts, the wallpaper's fan comes out on
// his floating hex with a MIC: the standings, (at his last show) the riff of the night, then he
// CALLS the effect, "so it just doesn't 'randomly' come into being". Not the Rock
// God: *"The King at a Joust doesn't get up over and over again to announce things.
// He has a servant do the job."*
//
// ⭐ PURE: no three, no DOM. The arena (`board/fanMcStage.js`), the overlay
// (`ui/FanMcOverlay.jsx`) and the dial-in page (`.scratch/fan-mc-preview.html`)
// all read THIS file — the look, the words and the clock are one copy.
//
// ⚠️ IT DECIDES NOTHING ABOUT THE RULES. The effect was drawn by the engine
// (`stageFxScheduled`), the standings are the engine's Fame, the riff of the night
// is the engine's `state.bestRiff` (`systems/riffOff.js` riffMoment). This file only
// chooses words and times — it can never fork a rule the way the client's private
// ⭐18 once did (SEQUENCING §B).
import { stageFxSchedule } from './stageEffects.js';

// ── ALEX'S DIAL-IN (2026-10-15, `.scratch/fan-mc-preview`, 5 of 66 levers; ✎ = his) ──
export const FAN_MC = Object.freeze({
  // the MC himself
  style: 'ronin', color: 'white' /* ✎ Alex (was purple: Player 3's colour) */, size: 2.4,
  offHand: 'free' /* ✎ Alex */, energy: 1.2 /* ✎ Alex */,
  // the mic
  micStyle: 'ball', micSize: 1.3, micGlow: 1.6, micToMouth: 0.85,
  // his floating hex
  tileSize: 1, rimGlow: 1.6, underGlow: 0.35, spot: 'on', spotGlow: 0.7,
  // where he hovers
  where: 'centre', height: 3.6, bob: 0.12, turnTo: 0.55,
  // arriving and leaving
  arrive: 'descend', leave: 'ascend', flyIn: 1.8, flyOut: 1.3,
  // the camera
  cam: 'follow', camDist: 11, camLift: 0.8, frameSide: 'right', camPush: 0.18, wideReveal: 'wide',
  // how he talks
  speech: 'bubble', talkSpeed: 37 /* ✎ Alex */, hold: 1.35 /* ✎ Alex */, bubbleSize: 1, skipTo: 'call',
  // the standings card
  cardPos: 'top', order: 'up', stagger: 0.38, showFans: 'on', showGap: 'on', standStyle: 'bars', raceBar: 'off',
  // the riff of the night (the TV)
  riffShow: 'tv', replayLen: 5.4, ffShare: 0.34, ballGlow: 1, replayNotes: 5, verdictHold: 1.3,
  tvSize: 1, tvSide: 'left', tvLift: 0.7, tvDrop: 0.9, tvZoomOut: 0.3, riffBar: 60, noRiff: 'say',
  // the call
  nameIt: 'name', dim: 0.55, tease: 1.1, wash: 1, flash: 0.8, revealHold: 2.8,
  // the words
  lastPlace: 'on', closeGap: 3, landslideGap: 10,
  // sound
  volume: 0.6, roar: 1,
});

/** 🖥️ Where he and the TV are ON SCREEN (stage pixels), for the overlay's bubble.
 *  Written by the arena (`board/fanMcStage.js` screen()) every frame; the overlay
 *  polls it. Lives here, not in the board file, so the overlay needs no three.js.
 *  📌 One arena per page — a module object is enough. */
export const FAN_MC_SCREEN = { head:null, tv:null, w:0, h:0, at:0 };

/** His colour: house white / gold, the wallpaper's purple, or the leader's. */
export function fanMcColor(o = FAN_MC, leaderColor = null) {
  if (o.color === 'leader') return leaderColor ?? '#ffc54a';
  return { purple:'#aa55ff', gold:'#ffc54a', white:'#dfe8ff' }[o.color] ?? '#dfe8ff';
}

// ── WHEN THE REPLAY PLAYS ─────────────────────────────────────────────────────
// Alex, 2026-10-15: *"have the replay only play if its a 20 round game - and play at
// the last appearance of the MC … it would get too much otherwise"*. Then 2026-10-16:
// *"Lets make that last appearance of the MC showcase the best riff off replay (even in
// 15 rounds or 10 rounds only matches - in case of the 10 rounds - its the only
// appearance so have him showcase here too)"*. So: the LAST show of the schedule,
// whatever the length — 7 of 10 (his only show), 12 of 15, 17 of 20. Earlier shows
// never talk riff-offs.
// 📌 A Legend Run has no buzzer but still a fixed schedule (7, 12, 17), so its last
// scheduled show (17) replays too — if the crown is taken earlier, there is no replay.
// ⚠️ Read the schedule, never a copy of "7, 12, 17": `stageFxSchedule` is the one place.
/** Is THIS show the one that replays the riff of the night? */
export function replayShow(roundLimit, round) {
  const shows = stageFxSchedule(roundLimit);
  return shows.length > 0 && shows[shows.length - 1].round === round;
}

/** 🧪 A stand-in duel for a Testing Grounds summon when the sandbox has none to replay,
 *  so the TV can always be seen: the first two Spirits, the second winning a close one
 *  over two exchanges. Shaped exactly like the engine's `riffMoment` (systems/riffOff.js).
 *  ⚠️ A PICTURE ONLY — the client hands it to the show, never to the engine's `bestRiff`. */
export function demoRiff(ids, round = 1) {
  if (!ids || ids.length < 2) return null;
  const G = { P:'perfect', g:'good', o:'ok', m:'miss' }, KEYS = 'cdefgab';
  const notes = str => str.split('').map((c, i) => ({ grade:G[c], key:KEYS[(i * 3) % 7], string:1 + (i % 6) }));
  return { round:Math.max(1, round - 1), turn:0, attackerId:ids[0], defenderId:ids[1], winnerId:ids[1], margin:3, exchanges:2,
    decidedBy:'performance · Exchange 2', bothStrong:false, demo:true,
    atk:{ quality:74, perfects:3, avgRt:88, energy:13.4, notes:notes('PgPgogmPgo') },
    def:{ quality:86, perfects:5, avgRt:71, energy:16.9, notes:notes('PPgPgPgPoP') } };
}

// ── tiny seeded pick, so one match always says the same line (and every peer agrees) ──
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const pick = (arr, seed) => arr[hash(seed) % arr.length];
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Fame first, fans break a tie; equal on both = a shared place. */
export function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => b.fame - a.fame || b.fans - a.fans);
  let place = 0;
  return sorted.map((p, i) => {
    if (i === 0 || p.fame !== sorted[i - 1].fame) place = i + 1;
    return { ...p, place, gap: sorted[0].fame - p.fame };
  });
}

/** How the race looks from the top: tie | close | landslide | steady. */
export function raceShape(ranked, o = FAN_MC) {
  if (ranked.length < 2) return 'steady';
  const lead = ranked[0].fame - ranked[1].fame;
  if (lead === 0) return 'tie';
  if (lead <= o.closeGap) return 'close';
  if (lead >= o.landslideGap) return 'landslide';
  return 'steady';
}

/** The remembered duel's two sides as winner / loser. */
export const riffSides = r => r.winnerId === r.attackerId
  ? { w: r.atk, l: r.def, loserId: r.defenderId } : { w: r.def, l: r.atk, loserId: r.attackerId };

// ── the words ────────────────────────────────────────────────────────────────
const ARRIVE = [
  ['ROUND {prev} IS IN THE BOOKS!', 'Is this crowd still ALIVE?!'],
  ['Hold it, hold it, HOLD IT!', 'Round {prev} is done — let\'s see where we are!'],
  ['Spirits, take a breath!', 'Round {prev} is in the books!'],
];
const STANDINGS = {
  tie: ['DEAD HEAT! {a} and {b}, both on ⭐{fame}!', 'I can\'t split them! {a} and {b}, ⭐{fame} apiece!'],
  close: ['{a} leads… but only by {lead}! {b} is RIGHT there!', 'Just {lead} Fame between {a} and {b}!'],
  steady: ['{a} on top with ⭐{fame} — {lead} clear of {b}!', '{a} holds the lead, {lead} ahead of {b}!'],
  landslide: ['{a} is running AWAY with it — {lead} Fame clear!', 'Somebody stop {a}! ⭐{fame} and counting!'],
};
const ROUNDS_LEFT = ['{left} to the final buzzer!', 'Still {left} to play — anything can happen!'];
const ROUNDS_LEFT_OPEN = ['No buzzer in a Legend Run — first to the crown takes it!'];
const LAST_PLACE = ['{last}, don\'t you DARE give up!', '{last} — the crowd wants a comeback!'];
const RIFF_INTRO = ['And did you SEE that riff-off?!', 'Now… let\'s talk about that RIFF-OFF!', 'Riff of the night, coming up!'];
const RIFF_WIN = {
  performance: ['{w} took it from {l} by {margin}!', '{w} out-shredded {l} by {margin}!'],
  reaction: ['{w} beat {l} on REACTION — {ms} ms quicker!'],
};
const RIFF_EXTRA = {
  perfects: '{perfects} perfect notes!',
  exchanges: 'It went {exchanges} exchanges deep!',
  bothStrong: 'So good the crowd paid BOTH of them!',
  underdog: 'The underdog bites back!',
};
const NO_RIFF = ['No riff-offs all night?! Somebody step UP!', 'Not ONE riff-off… I wanted a duel, people!'];
const WEAK_RIFF = ['We had riff-offs. We did NOT have a riff of the night!', 'The riff-offs tonight? Scrappy. I want BETTER!'];
const TEASE = ['But the stage… has been listening.', 'And now… the stage wants a turn.', 'Hold onto something…'];
const REVEAL = {
  pyrotechnics: ['Light it UP! PYROTECHNICS!'],
  smoke_machine: ['Can\'t see a THING! SMOKE MACHINE!'],
  laser_show: ['Mind the beams! LASER SHOW!'],
  animatronics: ['The robots are AWAKE! ANIMATRONICS!'],
  bats: ['Something\'s in the rafters… BATS!'],
};
const MYSTERY = ['Something\'s waking up… watch your step!', 'I\'m not saying what it is. You\'ll KNOW.'];
const EXIT = ['Keep it LOUD!', 'Back to the show!', 'Make some NOISE!'];

/**
 * The beats of one intermission.
 * @param f   { players:[{id,name,color,fame,fans}], round, roundLimit (null = Legend Run),
 *              best (state.bestRiff or null), replay (replayShow(...)), fx:{id,name,icon,color,blurb},
 *              show:{round,untilRound}, seed }
 * @returns   [{ id, lines:[{ text, to?, mood }], card? }]
 *   mood: talk | hype | hush | cheer — the MC's body reads it.
 *   `to` is a player id: the MC turns toward that Spirit while he says it.
 */
export function mcIntermission(f, o = FAN_MC) {
  const s = `${f.seed ?? 0}:${f.round}`;
  const ranked = rankPlayers(f.players);
  const shape = raceShape(ranked, o);
  const [a, b] = ranked, last = ranked[ranked.length - 1];
  const left = f.roundLimit == null ? null : f.roundLimit - f.round + 1;
  const beats = [];

  // 1 · ARRIVE
  beats.push({ id: 'arrive', lines: pick(ARRIVE, s + 'a').map((t, i) => ({ text: fill(t, { prev: f.round - 1 }), mood: i ? 'talk' : 'hype' })) });

  // 2 · STANDINGS — "by 1" reads better than "by 1 Fame" in a shout, so the lead is a bare number
  const v = { a: a.name, b: b?.name, fame: a.fame, lead: String(a.fame - (b?.fame ?? 0)),
    left: left == null ? '' : plural(left, 'round'), last: last.name };
  const sl = [{ text: fill(pick(STANDINGS[shape], s + 'st'), v), to: a.id, mood: shape === 'landslide' || shape === 'tie' ? 'hype' : 'talk' }];
  if (o.lastPlace === 'on' && ranked.length >= 3 && last.place > 1 && last.gap > 0) sl.push({ text: fill(pick(LAST_PLACE, s + 'lp'), v), to: last.id, mood: 'talk' });
  sl.push({ text: fill(pick(left == null ? ROUNDS_LEFT_OPEN : ROUNDS_LEFT, s + 'rl'), v), mood: 'talk' });
  beats.push({ id: 'standings', lines: sl, card: { type: 'standings', rows: ranked, shape, left, round: f.round, roundLimit: f.roundLimit } });

  // 3 · THE RIFF OF THE NIGHT — only on the replay show (`replayShow`)
  if (f.replay) {
    const best = f.best && f.players.some(p => p.id === f.best.attackerId) && f.players.some(p => p.id === f.best.defenderId) ? f.best : null;
    const good = best && riffSides(best).w.quality >= o.riffBar ? best : null;
    if (good) {
      const name = id => f.players.find(p => p.id === id)?.name ?? '???';
      const { w: W, l: Lo, loserId } = riffSides(good);
      const kind = /reaction/.test(good.decidedBy ?? '') ? 'reaction' : 'performance';
      const rv = { w: name(good.winnerId), l: name(loserId), margin: good.margin, ms: Math.abs((W.avgRt ?? 0) - (Lo.avgRt ?? 0)),
        perfects: W.perfects, exchanges: good.exchanges };
      const pos = id => ranked.find(p => p.id === id)?.place ?? 1;
      const extra = good.bothStrong ? 'bothStrong' : pos(good.winnerId) > pos(loserId) ? 'underdog'
        : good.exchanges >= 2 ? 'exchanges' : W.perfects >= 3 ? 'perfects' : null;
      beats.push({ id: 'riff', card: { type: 'riff', riff: good, winnerId: good.winnerId, loserId },
        lines: [
          { text: pick(RIFF_INTRO, s + 'ri'), mood: 'hype' },
          { text: fill(pick(RIFF_WIN[kind], s + 'rw'), rv) + (extra ? ' ' + fill(RIFF_EXTRA[extra], rv) : ''), to: good.winnerId, mood: 'cheer' },
        ] });
    } else if (o.noRiff === 'say') {
      beats.push({ id: 'riff', card: null, lines: [{ text: pick(best ? WEAK_RIFF : NO_RIFF, s + (best ? 'wr' : 'nr')), mood: 'talk' }] });
    }
  }

  // 4 · THE TEASE — the lights drop, the stage "listens"
  beats.push({ id: 'tease', lines: [{ text: pick(TEASE, s + 'te'), mood: 'hush' }] });

  // 5 · THE CALL — he calls it, the effect answers
  const howLong = f.show ? (f.roundLimit != null && f.show.untilRound === f.roundLimit
    ? 'until the final buzzer' : `rounds ${f.show.round}–${f.show.untilRound}`) : '';
  beats.push({ id: 'reveal', card: { type: 'effect', fx: f.fx, named: o.nameIt === 'name', howLong },
    lines: [{ text: o.nameIt === 'name' ? pick(REVEAL[f.fx.id] ?? [`${f.fx.name.toUpperCase()}!`], s + 'rv') : pick(MYSTERY, s + 'my'), mood: 'cheer' }] });

  // 6 · EXIT
  beats.push({ id: 'exit', lines: [{ text: pick(EXIT, s + 'ex'), mood: 'cheer' }] });
  return beats;
}

/**
 * The beats laid on a clock, in SECONDS from the start. Every reader (the arena, the
 * overlay, the sound, the page) takes its times from here.
 *   seg = { id, beat, t0, t1, lines:[{…line, t0, typed, t1}], hit? (reveal), leave? (exit), tv? (riff) }
 *   tv  = { in, on, start, end, verdict, rise, out } — the TV drops, powers on, replays, shows the result, rises.
 */
export function compileIntermission(beats, o = FAN_MC) {
  const cps = o.talkSpeed, segs = []; let t = 0;
  const ranked = beats.find(b => b.id === 'standings')?.card?.rows ?? [];
  for (const b of beats) {
    const seg = { id: b.id, beat: b, t0: t, lines: [] };
    let lt = t;
    if (b.id === 'arrive') lt = t + o.flyIn * 0.75;                 // he talks as he lands
    // 📺 the TV beat: line 1 while it drops, the replay plays, line 2 calls the result
    const tvBeat = b.id === 'riff' && b.card && o.riffShow !== 'card';
    let tv = null;
    if (tvBeat) { const tin = t + .1, on = tin + o.tvDrop, start = on + .35, end = start + o.replayLen; tv = { in: tin, on, start, end, verdict: end + o.verdictHold }; }
    b.lines.forEach((ln, i) => {
      if (tvBeat && i === 1) lt = Math.max(lt, tv.end + .05);
      const typed = lt + ln.text.length / cps; seg.lines.push({ ...ln, t0: lt, typed, t1: typed + o.hold }); lt = typed + o.hold;
    });
    let end = lt;
    if (tv) { tv.rise = Math.max(tv.verdict, lt - .2); tv.out = tv.rise + .6; seg.tv = tv; end = Math.max(end, tv.out); }
    if (b.id === 'standings') end = Math.max(end, t + ranked.length * o.stagger + 1.6);
    if (b.id === 'riff' && b.card && !tv) end = Math.max(end, t + o.replayLen + 1.4);
    if (b.id === 'tease') end = lt + o.tease;
    if (b.id === 'reveal') { seg.hit = seg.lines[0].typed - (o.nameIt === 'name' ? 0.15 : 0); end = Math.max(lt, seg.hit + o.revealHold); }
    if (b.id === 'exit') { seg.leave = seg.lines[0].t0 + 0.4; end = seg.leave + o.flyOut; }
    seg.t1 = end; segs.push(seg); t = end;
  }
  return { segs, T: t, hit: segs.find(s => s.id === 'reveal').hit };
}

/** Which segment and line are on at second `t` (the last line said is kept for a beat after). */
export function intermissionAt(timeline, t) {
  const { segs, T } = timeline;
  const seg = segs.find(s => t >= s.t0 && t < s.t1) ?? (t >= T ? segs[segs.length - 1] : segs[0]);
  const line = seg.lines.find(l => t >= l.t0 && t < l.t1) ?? null;
  const lastLine = segs.flatMap(s => s.lines).filter(l => l.t0 <= t).pop() ?? null;
  return { seg, line, lastLine };
}

/** Where ⏭ Skip lands: the call (so the effect still gets named) or the end. */
export const skipTarget = (timeline, now, o = FAN_MC) => (o.skipTo === 'call' ? Math.max(now, timeline.hit - .35) : timeline.T);

// ── 📺 the replay's own clock (the TV) ────────────────────────────────────────
export const BLAST_S = 1.25;   // the ball reaches the loser .8 s after the blast (riffWaveforms) and is gone at 1.05 s

/** When each of the last notes lands, when the fast-forward ends, when the blast goes. Pure. */
export function replayPlan(r, len, o = FAN_MC) {
  const N = Math.max(1, Math.round(o.replayNotes)), notesEnd = Math.max(.6, len - BLAST_S);
  // ⏩ the ball is mostly built BEFORE the last few notes, so on its own the end of the
  // duel barely changes its size. The replay opens fast-forwarding the build-up from an
  // empty stage, so you see how big it got; then the last notes play in time.
  const ff = notesEnd * o.ffShare, live = notesEnd - ff;
  const sides = [{ id: r.attackerId, st: r.atk, from: ff + .08, to: ff + live * .48 }, { id: r.defenderId, st: r.def, from: ff + live * .52, to: notesEnd }];
  const notes = [];
  sides.forEach((sd, side) => { const ns = (sd.st.notes ?? []).slice(-N);
    ns.forEach((n, i) => notes.push({ side, grade: n.grade, key: n.key, at: sd.from + (i + .5) / ns.length * (sd.to - sd.from) })); });
  return { notes, sides, ff, blast: notesEnd + .12 };
}
/** Each side's energy at replay second `s`: the final energy, minus the notes not landed yet. */
export function energyAt(r, plan, s, weight) {
  const e = [r.atk.energy, r.def.energy];
  for (const n of plan.notes) if (n.at > s) e[n.side] = Math.max(0, e[n.side] - (weight[n.grade] ?? 0));
  if (plan.ff > 0 && s < plan.ff) { const x = Math.min(1, Math.max(0, s / plan.ff)), k = x * x * (3 - 2 * x); e[0] *= k; e[1] *= k; }   // ⏩ the build-up, compressed
  return e;
}

/** The MC's sounds on the show's clock (seconds): the client schedules them (audio/fanMcSfx.js). */
export function fanMcSoundTimes(timeline) {
  const S = id => timeline.segs.find(s => s.id === id);
  const tease = S('tease'), exit = S('exit');
  return [
    { kind:'arrive', at:0 },
    { kind:'tap', at:Math.max(0, S('arrive').lines[0].t0 - .3) },
    { kind:'roll', at:tease.t0, dur:Math.max(.4, timeline.hit - tease.t0) },
    { kind:'hit', at:timeline.hit },
    { kind:'leave', at:exit.leave },
  ];
}
