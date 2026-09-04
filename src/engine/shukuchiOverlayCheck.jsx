// ─── 🌀 SHUKUCHI OVERLAY CHECK — the SSR diff the port owed ──────────────────
//
// ⚠️ THIS IS THE SUITE §5-hopui.D SAID THE PORT WOULD EARN. That handoff shipped
// `.scratch/shukuchiparity.mjs` — a PROBE, deliberately not a suite, because
// nothing was shipped for it to guard. Something is shipped now:
// `src/ui/ShukuchiOverlay.jsx`. So the thing that gets a script and a slot in
// `test:all` is this — the SSR diff of the shipped component against the
// preview page at Alex's settings — and not that.
//
// 🎯 WHAT IT ACTUALLY PROVES, AND WHY IT IS SHAPED LIKE THIS.
// `CLAUDE.md`: "VERIFY THE PORT, DON'T ASSUME IT. Render the shipped component
// through React SSR and diff it against the preview at the same settings. The
// chip is the product; 'it compiles' is not evidence that it looks right."
// ⚠️ `.scratch/_glowssr.jsx` is the cautionary version of this file: it printed
// the hunt marker's geometry by RE-IMPLEMENTING it, which checks that two
// transcriptions of the same idea agree and says nothing whatsoever about what
// is on screen. Everything below renders the real component and nothing else.
//
// ⏳ WHAT IT IS STILL NOT. It is a diff of geometry, colour and mark-state, not
// of taste — it cannot tell you the arc is too tall, only that it is the height
// Alex set. And it does not click: nothing here proves the button fires the
// reducer. `test:legal` §16 and `test:shukuchi` own that half.
//
// Run:  npm run test:shukuchiui

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { ALL_HEXES, HEX_BY_NUM } from '../board/hexMap.js';
import { axialDist } from '../board/hexGeometry.js';
import { SCALE } from '../board/constants.js';
import { SHUKUCHI_MAX_HOPS, SHUKUCHI_HOP_RINGS } from '../data/gameConstants.js';
import {
  SHUKUCHI_LOOK, shukuchiArcPath, shukuchiTrailOpacity,
  shukuchiBudgetMarks, ShukuchiArcs, ShukuchiBudget,
} from '../ui/ShukuchiOverlay.jsx';

let checks = 0, failed = 0;
const ok = (label, cond, detail = '') => {
  checks++;
  if (cond) return;
  failed++;
  console.log(`  ✗ ${label}${detail ? '\n      ' + detail : ''}`);
};
const head = t => console.log('\n' + t);

// ─── slice the preview's OVERLAY REGION ─────────────────────────────────────
// ⚠️ `process.cwd()`, NOT `import.meta.url`. This file is esbuilt into
// `node_modules/.cache/` before it runs (the same trick `test:render` uses), so
// a path relative to the module resolves inside node_modules and finds nothing.
// npm runs scripts from the repo root, which is what makes cwd the stable one.
const html = readFileSync(join(process.cwd(), '.scratch/shukuchi-hop-preview.html'), 'utf8');
const START = '/* ---8<--- OVERLAY REGION START';
const END   = '/* ---8<--- OVERLAY REGION END ---8<--- */';
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < 0) {
  console.error('❌ overlay markers missing from .scratch/shukuchi-hop-preview.html — '
    + 'the page has been edited in a way that makes the port unverifiable. Put them back.');
  process.exit(1);
}
// ⚠️ If this throws on `document`, that is the check doing its job: a taste
// lever has leaked into the half of the page that is supposed to be shareable.
const page = new Function(html.slice(html.indexOf('*/', a) + 2, b)
  + 'return { ALEX_LOOK, arcPathRef, trailOpacityRef, budgetMarksRef, MAX_HOPS_REF };')();

// ─── §1 THE DIAL-IN ─────────────────────────────────────────────────────────
// The page opens on Alex's landing now, so its levers ARE the port spec. If
// somebody nudges one on either side without the other, this section is what
// says so — which is the whole reason §2.5.0c was written into a doc instead of
// left in `.scratch/`.
head('§1 the dial-in — shipped SHUKUCHI_LOOK vs the preview at Alex\'s landing');
for (const k of Object.keys(page.ALEX_LOOK)) {
  ok(`look.${k} = ${JSON.stringify(page.ALEX_LOOK[k])}`,
     SHUKUCHI_LOOK[k] === page.ALEX_LOOK[k],
     `shipped ${JSON.stringify(SHUKUCHI_LOOK[k])} ≠ page ${JSON.stringify(page.ALEX_LOOK[k])}`);
}
ok('the landing marker is still "none" — the escape hatch for the Bushido colour collision',
   SHUKUCHI_LOOK.marker === 'none');
ok('the FREE label is still off — §2.5.0c\'s bet, and the budget bar carries it',
   SHUKUCHI_LOOK.freeLabel === false);
ok('MAX_HOPS agrees', page.MAX_HOPS_REF === SHUKUCHI_MAX_HOPS);

// ─── §2 THE ARC, FROM EVERY HEX TO EVERY LANDING ────────────────────────────
// ⚠️ EVERY PAIR, NOT A SAMPLE. The arc's control point is a PERPENDICULAR
// offset, so its sign flips with the direction of travel — a formula that is
// wrong for hops going one way can be right for hops going the other, and a
// handful of eastward sample hops would never notice.
head('§2 the arc path — every hex, every ring-2 landing');
let pairs = 0, arcMismatch = 0;
for (const f of ALL_HEXES) {
  for (const t of ALL_HEXES) {
    if (axialDist(f.q, f.r, t.q, t.r) !== SHUKUCHI_HOP_RINGS) continue;
    pairs++;
    const shipped = shukuchiArcPath(f.num, t.num, SCALE, SHUKUCHI_LOOK);
    const ref     = page.arcPathRef(f, t, SCALE, page.ALEX_LOOK);
    if (shipped !== ref) {
      arcMismatch++;
      if (arcMismatch <= 3) console.log(`      #${f.num}→#${t.num}\n        shipped ${shipped}\n        page    ${ref}`);
    }
  }
}
ok(`${pairs} hop paths identical to the page`, arcMismatch === 0, `${arcMismatch} differ`);
ok('there are ring-2 landings to check at all', pairs > 1000, `only ${pairs}`);

// 📌 THE RISE IS DOUBLED, AND THAT IS THE ONE NUMBER MOST LIKELY TO BE "TIDIED"
// AWAY. A quadratic Bézier reaches half way to its control point, so a slider
// reading 140 must draw with 280. Asserted directly so the reason survives even
// if both sides get edited together.
{
  const f = HEX_BY_NUM[47], t = HEX_BY_NUM[45];
  const d = shukuchiArcPath(47, 45, 1, SHUKUCHI_LOOK);
  const cp = d.match(/Q([-\d.]+),([-\d.]+)/);
  const mx = (f.px + t.px) / 2, my = (f.py + t.py) / 2;
  const off = Math.hypot(+cp[1] - mx, +cp[2] - my);
  ok('the control point sits rise × 2 off the midpoint (not rise)',
     Math.abs(off - SHUKUCHI_LOOK.rise * 2) < 0.01,
     `offset ${off.toFixed(2)}, expected ${SHUKUCHI_LOOK.rise * 2}`);
  ok('and the arc therefore rises about `rise` at its apex — a leap, not a laser',
     Math.abs(off / 2 - SHUKUCHI_LOOK.rise) < 0.01);
}
ok('an off-board target draws nothing rather than NaNs', shukuchiArcPath(47, 9999) === null);

// ─── §3 THE TRAIL FADE ──────────────────────────────────────────────────────
head('§3 the trail — the whole activation stays visible, oldest faintest');
for (let kept = 1; kept <= SHUKUCHI_LOOK.trailKeep; kept++) {
  for (let i = 0; i < kept; i++) {
    ok(`opacity[${i}/${kept}]`,
       Math.abs(shukuchiTrailOpacity(i, kept, SHUKUCHI_LOOK)
              - page.trailOpacityRef(i, kept, page.ALEX_LOOK)) < 1e-12);
  }
  ok(`the newest of ${kept} is the brightest`,
     shukuchiTrailOpacity(kept - 1, kept) >= shukuchiTrailOpacity(0, kept));
}
ok('even the oldest arc never goes fully invisible',
   shukuchiTrailOpacity(0, 3) >= 0.08);

// ─── §4 THE BUDGET READOUT ──────────────────────────────────────────────────
// The twelve states from the preview's gallery, as {hopsLeft, mid}.
head('§4 the budget bar — the twelve states from the preview\'s gallery');
const STATES = [
  ['ready',            0, false], ['armed',             0, false],
  ['mid-hop · 2 left', 2, true ], ['mid-hop · 1 left',  1, true ],
  ['mid-hop · 0 AP',   2, true ], ['budget spent',      0, false],
  ['recharging · 3',   0, false], ['recharging · 2',    0, false],
  ['recharging · 1',   0, false], ['no Db',             0, false],
  ['no AP',            0, false], ['not unlocked',      0, false],
];
for (const [name, hopsLeft, mid] of STATES) {
  const s = shukuchiBudgetMarks(hopsLeft, mid, SHUKUCHI_LOOK);
  const r = page.budgetMarksRef(hopsLeft, mid, page.ALEX_LOOK);
  ok(`${name} — segments`, JSON.stringify(s.segs) === JSON.stringify(r.segs),
     `shipped ${JSON.stringify(s.segs)} ≠ page ${JSON.stringify(r.segs)}`);
  ok(`${name} — Db pip`, s.dbSpent === r.dbSpent);
}

// ⭐ THE CORRECTION MADE DURING THE PORT, PINNED SO IT CANNOT SILENTLY REVERT.
// The page originally derived "spent" from MAX_HOPS − hopsLeft, and a READY
// ability carries hopsLeft 0 — so it drew a full budget as an empty bar. That is
// not cosmetic: §2.5.0c turned the FREE label OFF and bet that this readout
// alone teaches that hops 2–3 cost nothing, and a bar that starts empty cannot
// carry that bet.
head('§5 the forward reading — the correction this port made, pinned');
{
  const ready = shukuchiBudgetMarks(0, false);
  ok('a READY Shukuchi shows all three segments LIVE, not an empty bar',
     ready.segs.every(Boolean), JSON.stringify(ready.segs));
  ok('and its Db pip is still gold — nothing has been paid yet', ready.dbSpent === false);
  const one = shukuchiBudgetMarks(2, true);
  ok('after hop 1: two segments live, one spent',
     JSON.stringify(one.segs) === JSON.stringify([true, true, false]));
  ok('and the Db pip has gone dark — paid once, on the first hop', one.dbSpent === true);
  ok('after hop 3: no segments live', shukuchiBudgetMarks(0, true).segs.every(v => !v));
}

// ─── §6 THE RENDERED MARKUP ─────────────────────────────────────────────────
// Everything above compares numbers. This renders the component and reads the
// SVG back, because a correct formula wired to the wrong attribute is still a
// blank board.
head('§6 the SSR markup — the component as the browser will get it');
{
  const empty = renderToStaticMarkup(<ShukuchiArcs trail={[]} ghostTo={null} hs={10} />);
  ok('nothing armed, nothing hopped → no layer at all', empty === '');

  const trail = [{from:47,to:45},{from:45,to:43},{from:43,to:41}];
  const m = renderToStaticMarkup(<ShukuchiArcs trail={trail} hs={10} />);
  const paths = [...m.matchAll(/<path[^>]*d="([^"]+)"[^>]*>/g)];
  ok('three hops → three arcs', paths.length === 3, `${paths.length} paths`);
  for (let i = 0; i < trail.length; i++) {
    ok(`arc ${i} is the shipped path for #${trail[i].from}→#${trail[i].to}`,
       m.includes(shukuchiArcPath(trail[i].from, trail[i].to)));
  }
  ok('the arcs are stroked in the Ronin blue', (m.match(/stroke="#4488ff"/g) ?? []).length === 3);
  ok('and at arcW × 8 × SCALE',
     m.includes(`stroke-width="${SHUKUCHI_LOOK.arcW * 8 * SCALE}"`));
  ok('the layer never eats clicks — the hexes under it must stay clickable',
     m.includes('pointer-events:none'));
  ok('a fourth hop cannot appear: only trailKeep are drawn',
     [...renderToStaticMarkup(<ShukuchiArcs trail={[...trail,{from:41,to:39}]} hs={10}/>)
        .matchAll(/<path/g)].length === SHUKUCHI_LOOK.trailKeep);

  const g = renderToStaticMarkup(<ShukuchiArcs trail={[]} ghostFrom={47} ghostTo={45} hs={10} />);
  ok('hovering a landing draws the ghost arc', g.includes(shukuchiArcPath(47, 45)));
  ok('the ghost is drawn heavier than the trail (arcW × 10)',
     g.includes(`stroke-width="${SHUKUCHI_LOOK.arcW * 10 * SCALE}"`));
  ok('the ghost body is a polygon on the landing hex', g.includes('<polygon'));
  ok('AND IT CARRIES THE FACING ARROW — the hop re-faces him, and that facing is '
   + 'half the Bushido setup this click is buying', g.includes('<line'));
  ok('no landing marker is drawn — marker is "none" (§2.5.0c)',
     !/<circle/.test(g));

  const ready = renderToStaticMarkup(<ShukuchiBudget hopsLeft={0} mid={false} />);
  ok('the rail shows the Db pip and three segments',
     (ready.match(/data-mark="/g) ?? []).length === SHUKUCHI_MAX_HOPS + 1);
  ok('the Db pip is FIRST — "one Db buys three hops", read left to right',
     ready.indexOf('data-mark="db"') < ready.indexOf('data-mark="live"'));
  ok('a ready bar renders three LIVE segments',
     (ready.match(/data-mark="live"/g) ?? []).length === 3);
  const midR = renderToStaticMarkup(<ShukuchiBudget hopsLeft={1} mid />);
  ok('two hops in: one live, two spent',
     (midR.match(/data-mark="live"/g) ?? []).length === 1
  && (midR.match(/data-mark="spent"/g) ?? []).length === 2);
}

console.log(`\n${failed ? '❌' : '✅'} shukuchi overlay — ${checks - failed}/${checks} assertions`);
if (failed) process.exit(1);
