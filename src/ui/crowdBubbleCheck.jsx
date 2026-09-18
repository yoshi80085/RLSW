// ─── 🎤 CROWD BUBBLE CHECK ───────────────────────────────────────────────────
// The PORT of `.scratch/fan-bubble-preview.html` (IDEAS_INBOX [P1] beginner
// finder, step 3): Alex's dial-in, the bubble sequence, the card's markup, and the
// client wiring.
//
// ⚠️ WHAT THIS SUITE IS REALLY GUARDING:
//   §1 — THE DIAL-IN IS ALEX'S. The six levers he moved carry his numbers, and the
//        twenty-five he did not move carry the preview's DEFAULTS — transcribed here
//        and, when `.scratch/` is present, cross-read from the preview template.
//   §2 — THE CLOCK. The sequence walked at exact milliseconds: his 950 ms beat
//        before the crowd speaks, pop → hold → fade → his 1500 ms gap, looping.
//   §4 — THE GATE. Beginner mode only, a human's turn only, a build step only, and
//        the hooks unconditional (a hook behind an `if` is a crash, not a toggle).
//
// Run: npm run test:crowdbubble
/* global process */
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

// ⚠️ process.cwd(), not import.meta.url: this file is BUNDLED into
// node_modules/.cache before it runs (it imports JSX), so its own URL is the cache.
const ROOT = process.cwd();
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) pass++;
  else { failures.push(msg); console.log('  ✗', msg); }
}

import { CROWD_BUBBLE as B, CROWD_BUBBLE_CHANGED, crowdBubbleFrame, crowdStockMarks } from './crowdCoach.js';
import { CrowdBubbleCard, crowdBubbleBoxStyle, crowdCss, chipDrawSize, CROWD_SPEAKER_SELECTOR } from './CrowdBubble.jsx';

console.log('🎤 crowdBubbleCheck — the fans\' bubble, at Alex\'s dial-in\n');

// ═══ 1. THE DIAL-IN ═════════════════════════════════════════════════════════
console.log('§1 the numbers are Alex\'s — moved levers his, the rest the preview\'s defaults');
{
  const ALEX = { rad: 12, chipSize: 22, anchor: 'stand', delay: 950, gap: 1500, glowMs: 1500 };
  for (const [k, v] of Object.entries(ALEX)) ok(B[k] === v, `★ ${k} = ${JSON.stringify(v)} (Alex moved it)`);
  ok(JSON.stringify(Object.keys(CROWD_BUBBLE_CHANGED).sort()) === JSON.stringify(Object.keys(ALEX).sort()), 'exactly six levers are recorded as moved');

  // Every lever he did NOT move must equal the preview's own default. The defaults
  // are TRANSCRIBED here, because `.scratch/` is a working pile and is not in git —
  // a suite that needs it would fail on every fresh clone. When the template IS
  // present it is read too, and the transcription must still match it.
  const PREVIEW_DEFAULTS = {
    voice: 'hype', chips: '4', payoff: 'fans', dbBubble: 'on', ending: 'same-line', style: 'neon', colour: 'spirit',
    font: '15', maxw: '220', rad: '8', glow: '1', chipSize: '24', tail: 'point', anchor: 'peek', offX: '0', offY: '0',
    fanHop: 'on', delay: '350', popFrom: '0.6', popMs: '220', hold: '2750', fade: '260', gap: '250', cycle: 'loop',
    thinking: 'on', hl: 'pulse', hlWhich: 'next', glowSrc: 'both', glowStyle: 'pulse', glowInt: '1', glowMs: '1200',
  };
  const tplPath = path.join(ROOT, '.scratch/fan-bubble-preview.template.html');
  if (fs.existsSync(tplPath)) {
    const tpl = fs.readFileSync(tplPath, 'utf8');
    for (const [key, def] of Object.entries(PREVIEW_DEFAULTS)) {
      const m = tpl.match(new RegExp(`key:'${key}'[^\\n]*?def:([^,}]+)`));
      ok(m && m[1].trim().replace(/^'(.*)'$/, '$1') === def, `the transcribed default for ${key} (${def}) matches the preview template`);
    }
  } else {
    console.log('  📌 .scratch/fan-bubble-preview.template.html absent — checking against the transcribed defaults only');
  }
  for (const [k, from] of Object.entries(CROWD_BUBBLE_CHANGED)) ok(String(from) === PREVIEW_DEFAULTS[k], `${k} was moved FROM the preview's real default (${PREVIEW_DEFAULTS[k]})`);
  const asBool = v => v === 'on' ? true : v === 'off' ? false : v;
  for (const key of Object.keys(PREVIEW_DEFAULTS)) {
    if (key in CROWD_BUBBLE_CHANGED) continue;
    const def = asBool(PREVIEW_DEFAULTS[key]);
    const expected = typeof B[key] === 'number' ? Number(def) : def;
    ok(B[key] === expected, `  ${key} = ${JSON.stringify(B[key])} is the untouched default (${JSON.stringify(expected)})`);
  }
}

// ═══ 2. THE CLOCK ═══════════════════════════════════════════════════════════
console.log('§2 the sequence at exact milliseconds');
{
  const per = B.popMs + B.hold + B.fade + B.gap;
  const at = (t, n = 2) => crowdBubbleFrame(t, n);
  ok(at(0).phase === 'wait' && at(B.delay - 1).phase === 'wait', `silent for the first ${B.delay} ms`);
  ok(at(B.delay).phase === 'pop' && at(B.delay).index === 0, 'bubble 0 pops at the delay');
  ok(at(B.delay + B.popMs).phase === 'hold', 'then holds');
  ok(at(B.delay + B.popMs + B.hold).phase === 'fade', `fades after ${B.hold} ms`);
  ok(at(B.delay + B.popMs + B.hold + B.fade).phase === 'gap', 'then a gap');
  ok(at(B.delay + per - 1).phase === 'gap' && at(B.delay + per - 1).index === 0, `the gap lasts ${B.gap} ms`);
  ok(at(B.delay + per).phase === 'pop' && at(B.delay + per).index === 1, 'bubble 1 pops after the gap');
  ok(at(B.delay + 2 * per).index === 0 && at(B.delay + 2 * per).phase === 'pop', 'loop: back to bubble 0');
  ok(at(B.delay + 5 * per + 10, 1).index === 0, 'a single bubble loops with itself');
  ok(at(123456, 0).phase === 'done', 'no asks → nothing');
  ok(crowdBubbleFrame(B.delay + 3 * per, 2, { ...B, cycle: 'once' }).phase === 'done', 'cycle once ends quiet');
  ok(crowdBubbleFrame(99999, 2, { ...B, cycle: 'first' }).phase === 'hold', 'cycle first holds bubble 0');
  let monotone = true, last = -1;
  for (let t = B.delay; t < B.delay + per; t += 10) { const f = at(t); if (f.index !== 0) monotone = false; if (f.t < 0 || f.t > 1) monotone = false; last = f.t; }
  ok(monotone && last >= 0, 'progress stays within 0..1 and bubble 0 owns its whole slot');
  const ask = { kind: 'fans', idx: [4, 7, 2] };
  ok([...crowdStockMarks(ask).entries()].join() === '4,fans', 'hlWhich next → only the next note is marked');
  ok(crowdStockMarks(ask, { ...B, hlWhich: 'window' }).size === 3 && crowdStockMarks(null).size === 0, 'window → every chip; no bubble → no mark');
}

// ═══ 3. THE CARD ════════════════════════════════════════════════════════════
console.log('§3 the card renders the preview\'s bubble');
{
  const ask = { kind: 'fans', key: 'scalar_shred_up', text: 'Run it UP!', notes: ['G', 'A', 'Bb'], idx: [3, 5, 1], payoff: { fans: 4, db: 7.5 } };
  const html = renderToStaticMarkup(<CrowdBubbleCard ask={ask} color="#4488ff" inScale={n => n !== 'Bb'} tailX={40} />);
  ok(html.includes('Run it UP!') && html.includes('data-crowd-bubble="scalar_shred_up"'), 'the words and the key are on the card');
  ok((html.match(/<svg/g) ?? []).length === 3, 'three chips, three NoteHexes');
  ok(html.includes('+4 fans'), 'payoff tag: fans only (Alex left it on "Fans")');
  ok(!html.includes('Db'), '…and no Db on the tag');
  ok(/border-radius:12px/.test(html) && /max-width:220px/.test(html) && /font-size:15px/.test(html), 'radius 12 · max width 220 · 15 px text');
  ok(/padding:9px 12px/.test(html), 'padding 0.6/0.8 × the text size, as the preview computed it');
  ok(/border:1\.5px solid #4488ff/.test(html), 'neon border in the Spirit colour');
  ok((html.match(/width:22px;height:22px/g) ?? []).length === 3, 'chip boxes at 22 px (Alex moved it from 24)');
  ok(chipDrawSize() === 36 && (html.match(/width="36"/g) ?? []).length === 3, '…each drawing a 36 px NoteHex, whose hexagon spans 94% of the box like the preview\'s');
  ok(/border-top:13px solid #4488ff/.test(html) && /left:31px/.test(html), 'a pointer tail aimed at the anchor');
  const s = crowdBubbleBoxStyle('#aa55ff');
  ok(s.boxShadow === '0 0 18px #aa55ff8c, inset 0 0 14px #aa55ff38', 'glow 1: the preview\'s 55% / 22% halos as hex alpha');
  ok(renderToStaticMarkup(<CrowdBubbleCard ask={null} color="#fff" />) === '', 'no ask → no card');
  const css = crowdCss('#4488ff');
  ok(css.includes('--crowd-spirit:#4488ff') && css.includes('--coach-ms:1500ms') && css.includes('--coach-ms:900ms'), 'glow breathes at 1500 ms, the note pulse at 900 ms');
  ok(/prefers-reduced-motion/.test(css) && /!important/.test(css), 'reduced motion stops the pulse; the hop overrides the inline bob');
  ok(CROWD_SPEAKER_SELECTOR === '[data-crowd-speaker]', 'the anchor is the data-crowd-speaker fan');
}

// ═══ 4. THE WIRING ══════════════════════════════════════════════════════════
console.log('§4 the client gates it and wires it');
{
  const c = read('src/rlsw-simulator-v3_8_1.jsx');
  const gate = c.match(/const crowdCoachOn = !!\(([\s\S]*?)\);/)?.[1] ?? '';
  for (const part of ['fanCoachEnabled', 'acting', '!acting.cpu', 'canAct', '!hasConfirmed', "turnStep === 'melody'", "turnStep === 'chord'"]) {
    ok(gate.includes(part), `the gate requires ${part}`);
  }
  // ⚠️ THE FANS AND PICKLES ARE SEPARATE SWITCHES (Alex, 2026-09-17): turning the
  // tips off must not mute the crowd.
  ok(!gate.includes('beginnerEnabled'), 'the crowd coach does not ride the Beginner tips switch');
  const disable = c.match(/onDisable=\{\(\) => \{([^}]*)\}\}/)?.[1] ?? '';
  ok(disable.includes('setBeginnerEnabled(false)') && !disable.includes('setFanCoachEnabled'),
    "the tip's own turn-off button turns off tips only");
  ok(/label:'Fan hints'[\s\S]{0,300}onClick:\(\) => setFanCoachEnabled\(v => !v\)/.test(c), 'the menu has its own Fan hints toggle');
  const hookLine = c.split('\n').find(l => l.includes('const crowdCoach = useCrowdCoach('));
  ok(!!hookLine && /^ {2}const /.test(hookLine), 'useCrowdCoach is called at the top level of Game (never behind an if)');
  ok(/const \[crowdShown, setCrowdShown\] = useState\(null\);/.test(c), '…and so is its state');
  const gameStart = c.indexOf('export function Game(') >= 0 ? c.indexOf('export function Game(') : c.indexOf('function Game(');
  const hookAt = c.indexOf('const crowdCoach = useCrowdCoach(');
  const firstReturn = c.indexOf('\n  return (', gameStart);
  ok(hookAt > gameStart && hookAt < firstReturn, 'the hook sits before Game\'s render return');
  ok(/crowdCoachOn && turnStep === 'melody' && !activeTip && \(\s*<CrowdBubble/.test(c), 'the bubble renders in the melody step only, and never over a Pickles tip');
  ok((c.match(/data-coach=\{/g) ?? []).length === 2, 'both stock grids carry the coach mark (melody pool + chord grid)');
  ok(/data-crowd-speaker=\{s\.id === acting\?\.id && i === 0 \? '' : undefined\}/.test(c), 'the acting Spirit\'s front-row fan is the speaker');
  ok(/goals: turnStep === 'melody' \? \['fans', 'db'\] : \['drive', 'sustain'\]/.test(c), 'melody asks fans+db; chord asks drive+sustain');
  const worker = read('src/engine/policies/playFinder.worker.js');
  ok(/findBestPlays\(spiritId, ns, \{ goals \}\)/.test(worker) && !/melodyPayoutFor|spiritChord/.test(worker), 'the worker only calls the finder');
  const client = read('src/ui/crowdFinderClient.js');
  ok(/new URL\('\.\.\/engine\/policies\/playFinder\.worker\.js', import\.meta\.url\)/.test(client), 'the worker is found the way Vite bundles workers');
  const pkg = JSON.parse(read('package.json'));
  ok(!!pkg.scripts['test:crowdbubble'] && /test:crowdbubble/.test(pkg.scripts['test:all']), 'test:crowdbubble exists and test:all runs it');
}

console.log('');
if (failures.length) {
  console.log(`❌ crowdBubbleCheck: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`✅ crowdBubbleCheck: ${pass} assertions passed`);
