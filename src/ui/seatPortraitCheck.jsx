// 🎭 seatPortraitCheck — `test:seatportrait`. Two rulings from 2026-09-25:
//   1. The chosen Spirit's head, close up, in its player's banner (preview first).
//   2. "There should be no default colors, the only colors that should be
//      associated with any spirits is the color of what player is choosing."
//
// Bundled by esbuild like `test:bushidoui` (it renders the real `DraftSeats`
// through react-dom/server). ⚠️ The device VM cannot run esbuild (win32
// binaries only) — run it on Windows or in the cloud copy.
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { renderToStaticMarkup } from 'react-dom/server';
import { SEAT_PORTRAIT as P, HEAD_FOCUS, WIDE, artAspect, focusFor, portraitViewBox, cutPaths, ringsPath, rgb01, duotoneTable }
  from './seatPortrait.js';
import { DraftSeats } from './SpiritDraft.jsx';
import { SPIRIT_DEFS, ROSTER_ORDER } from '../data/spirits.js';
import { CORNER_LABELS, CORNERS_ORDER, playerColor, NEUTRAL_SPIRIT_COLOR } from '../data/corners.js';
import { SKILL_TREE } from '../data/skillTree.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else fail++; if (!cond || process.env.VERBOSE) console.log(`  ${cond ? '✓' : '✗'} ${name}${extra !== '' ? ' — ' + extra : ''}`); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const src = p => readFileSync(new URL(p, `file://${process.cwd()}/src/ui/`), 'utf8');
console.log('🎭 seatPortraitCheck — the head in the banner, and the player-colour rule\n');

// ─────────────────────────────────────────────────────────────────────────────
console.log('§1 no Spirit has a colour of its own');
for (const id of ROSTER_ORDER) ok(`${id} carries no colour`, !('color' in SPIRIT_DEFS[id]));
ok('no skill route carries a colour (every route is one Spirit’s)', SKILL_TREE.routes.every(r => !('color' in r)));
{
  const cs = CORNERS_ORDER.map(c => CORNER_LABELS[c].color);
  ok('the four player colours are four different colours', new Set(cs).size === 4);
  ok('P1 is blue', playerColor('blue') === '#4488ff');
  ok('P2 (a 2-player match seats blue v red) is ORANGE', playerColor('red') === '#ff6600');
  ok('no seat → the neutral colour, which is no player’s', playerColor(undefined) === NEUTRAL_SPIRIT_COLOR && !cs.includes(NEUTRAL_SPIRIT_COLOR));
  ok('every player colour is #rrggbb (readers append a 2-digit alpha)', cs.every(c => /^#[0-9a-f]{6}$/i.test(c)));
}
{
  // ⚠️ Source reads, because these sites need a live Game to reach. Each one was a
  // per-Spirit hex until 2026-09-25.
  const game = readFileSync(`${process.cwd()}/src/rlsw-simulator-v3_8_1.jsx`, 'utf8');
  for (const label of ['BUSHIDO!', 'SHADOW!', 'WARP', 'RA!', 'BLAST!', 'SWALLOWED!', 'MIC DROP!', 'FIRED BACK!', 'BOOM BOX ON!', 'SHUKUCHI']) {
    const line = game.split('\n').find(l => l.includes(`'${label}'`) && l.includes('triggerEffectFlash'));
    ok(`the ${label} flash wears its seat's colour`, !!line && /seatColor\(/.test(line), line?.trim());
  }
  ok("the Ronin's / I-0's rail buttons have no hard-coded Spirit hex left",
    !/can(Dash|Summon|Warp|Open|Mosh) \? '#(4488ff|aa55ff|ffcc00)'/.test(game));
  ok('the Bushido lane is painted in the acting seat’s colour', /bushidoPaint = bushidoArmed \? \{\s*hue: actingHue/.test(game));
  ok('Shukuchi’s ring and arcs are painted in the acting seat’s colour',
    game.includes("return actingHue + SHUKUCHI_FILL.slice(7)") && game.includes('look={{ ...SHUKUCHI_LOOK, color: actingHue }}'));
  const draft = src('SpiritDraft.jsx');
  ok('the picker cards take the choosing player’s colour, not the Spirit’s', !/sp\.color/.test(draft) && /createSpiritPickerStage\(\{ color \}\)/.test(draft));
  ok('…and follow the seat when it changes', /setColor\(color\)/.test(draft));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('§0 the numbers are the dial-in');
ok('SEAT_PORTRAIT is the 2026-09-25 dial-in (5 of 33 levers moved: height, width, panelAlpha, slant, enterMs)',
  JSON.stringify(P) === JSON.stringify({
    height:141, width:0.73, headFill:0.9, anchorX:0.6, anchorY:0.38, breakout:28,
    cut:'body', edge:'on', edgeWidth:2, edgeGlow:9,
    look:'full', rim:'on', panel:'stripes', panelAlpha:0.6, slant:18,
    numeral:'on', enter:'slide', enterMs:760, idle:'drift',
    inactive:'dim', empty:'ghost' }));
ok('every head focus was left at its default in the dial-in', JSON.stringify(HEAD_FOCUS) === JSON.stringify({
  cosmic_ronin:{ x:0.555, y:0.14, h:0.27 }, intergalactic_0:{ x:0.56, y:0.25, h:0.24 },
  Metalness_Monster:{ x:0.465, y:0.18, h:0.22 }, Glamarchy:{ x:0.47, y:0.13, h:0.25 } }));

console.log('§2 the head lands where the levers say');
ok('SEAT_PORTRAIT and HEAD_FOCUS are frozen', Object.isFrozen(P) && Object.isFrozen(HEAD_FOCUS));
ok('every roster Spirit has a head focus', ROSTER_ORDER.every(id => HEAD_FOCUS[id]));
for (const id of ROSTER_ORDER) {
  const f = focusFor(id), a = artAspect(id), vb = portraitViewBox(f, a, P);
  const layer = P.height + P.breakout, scale = layer / vb.h;           // px per art unit (height-fit)
  ok(`${id}: the head is headFill × the banner tall`, near(f.h * scale, P.headFill * P.height, 1e-6), (f.h * scale).toFixed(2));
  ok(`${id}: the head's centre sits anchorY down the banner`, near((f.y - vb.y) * scale, P.breakout + P.anchorY * P.height, 1e-6));
  ok(`${id}: the head is centred across the window`, near(vb.x + vb.w / 2, f.x * a));
  // ⚠️ `slice` fits the HEIGHT only while the window is wider than the element.
  // The element is 200% of the portrait: at the widest real seat (2 players,
  // 1180px, 58%) that is ~1340 × layer px. WIDE must beat that aspect.
  ok(`${id}: the window is wide enough that the height always governs`, vb.w / vb.h === WIDE && WIDE > (1180 * 2) / layer);
}
ok('an unknown Spirit still frames something', focusFor('nobody').h > 0 && artAspect('nobody') === 1);
ok('a per-Spirit override (the preview) wins', focusFor('cosmic_ronin', { cosmic_ronin:{ x:0.1, y:0.2, h:0.3 } }).x === 0.1);

console.log('§3 it is cut the standee’s way');
for (const id of ROSTER_ORDER) {
  const c = cutPaths(id, P);
  ok(`${id}: a body clip and an edge ring`, !!c && /^M[\d.,L]+Z/.test(c.clip) && /^M[\d.,L]+Z/.test(c.edge));
}
ok("cut:'full' draws the whole picture (no clip)", cutPaths('cosmic_ronin', { ...P, cut:'full' }) === null);
ok("cut:'tight' is a different ring from body", cutPaths('cosmic_ronin', { ...P, cut:'tight' }).clip !== cutPaths('cosmic_ronin', P).clip);
ok('rings scale x by the aspect, not y', ringsPath([[[1, 1]]], 2) === 'M2,1Z');

console.log('§4 the duotone is the player');
ok('rgb01 reads #rrggbb', JSON.stringify(rgb01('#ff6600')) === JSON.stringify([1, 0.4, 0]));
ok('rgb01 survives junk', rgb01('nope').length === 3);
ok('the ramp’s middle stop IS the player colour', duotoneTable('#ff6600').map(t => +t.split(' ')[1]).join() === '1,0.4,0');

// ─────────────────────────────────────────────────────────────────────────────
console.log('§5 the real banners');
const seats = (portrait, pick) => renderToStaticMarkup(<DraftSeats corners={['blue', 'red']} assignments={pick}
  loadouts={{ blue:['a', 'b'], red:[] }} corner="blue" onChooseCorner={() => {}} cpuCorners={{}} onCpu={() => {}}
  onSearcher={() => {}} online={false} portrait={portrait}/>);
{
  const off = seats(null, { blue:'cosmic_ronin', red:'cosmic_ronin' });
  ok('portrait={null} draws today’s banners exactly (no portrait markup)', !off.includes('seat-portrait') && !off.includes('has-portrait'));
  const on = seats(P, { blue:'cosmic_ronin', red:'cosmic_ronin' });
  ok('with a look, every seat has a portrait', (on.match(/class="seat-portrait /g) ?? []).length === 2);
  ok('the same Spirit in two seats wears two colours — blue edge and orange edge',
    on.includes('stroke="#4488ff"') && on.includes('stroke="#ff6600"'));
  ok('the choosing seat is marked active, the other idle', on.includes('is-active has-spirit') && on.includes('is-idle has-spirit'));
  ok('the head is clipped to the body cut', /clip-path="url\(#sp-clip-/.test(on));
  ok('the portrait is hidden from screen readers (the banner already names the Spirit)', /class="seat-portrait [^"]*" aria-hidden="true"/.test(on));
  const empty = seats(P, { blue:'cosmic_ronin' });
  ok('an empty seat shows the ghost, not a head', empty.includes('seat-portrait-ghost') && (empty.match(/<image /g) ?? []).length === 1);
  const duo = seats({ ...P, look:'duotone' }, { blue:'intergalactic_0', red:'intergalactic_0' });
  ok('duotone builds one filter per seat, in that seat’s colour', (duo.match(/<filter /g) ?? []).length === 2 && duo.includes('0.02 0.267 1'));
}
{
  // ⭐ Wired 2026-09-25, at the dial-in. ⚠️ If this goes red the select screen
  // has quietly lost its heads — `portrait={null}` draws today's plain banners.
  const draft = src('SpiritDraft.jsx');
  ok('the game shows the portrait, at the dial-in look', /<DraftSeats [^>]*portrait=\{SEAT_PORTRAIT\}\/>/.test(draft));
}

console.log(`\n${fail ? '❌' : '✅'} seatPortraitCheck: ${fail ? `${fail} failed, ` : ''}${pass} passed`);
if (fail) process.exit(1);
