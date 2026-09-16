// ⏱️ dialTickCheck — `test:dialtick`. The Drive/Sustain dial TICKS to a new
// value instead of jumping (IDEAS_INBOX [P1] 2026-09-08, dialled in 2026-09-16).
//
// Plain node, no esbuild: the timing lives in `dialTick.js`, which is pure. The
// last section reads ArenaDial.jsx / MatchSurface.jsx SOURCE for the three
// wiring facts the pure module cannot see — the same move `bushidoCheck` makes
// when the thing that can go wrong is at a call site.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DIAL_TICK, dialTickInterval, dialTickStep, dialTickFlash, dialTickSchedule } from './dialTick.js';

const HERE = dirname(fileURLToPath(import.meta.url));
let n = 0;
const ok = (cond, msg) => { n++; assert.ok(cond, msg); };
const eq = (a, b, msg) => { n++; assert.deepEqual(a, b, msg); };

console.log('⏱️  dialTickCheck — the dial travels, it does not jump\n');

console.log('§1 the numbers are the dial-in');
// ⚠️ All sixteen levers came back UNTOUCHED — these are the defaults Alex
// approved. A change here is a change to his dial-in; re-open the page first.
eq({ ...DIAL_TICK }, { delayMs: 120, stepMs: 160, maxTotalMs: 1100, fadeMs: 90,
  flarePeak: 0.46, flareMs: 256, gainFlashMs: 280, lossFlashMs: 340 }, 'DIAL_TICK matches the 2026-09-16 dial-in');
ok(Object.isFrozen(DIAL_TICK), 'DIAL_TICK is frozen — tune it here, not at a call site');

console.log('§2 one step at a time, landing exactly');
eq(dialTickStep(4, 8), 5, 'steps up by one');
eq(dialTickStep(8, 4), 7, 'steps down by one');
eq(dialTickStep(7, 8), 8, 'last step lands');
eq(dialTickStep(3, 3.5), 3.5, 'a fractional target is reached, not overshot');
eq(dialTickStep(5, 5), 5, 'at rest stays at rest');

console.log('§3 the rhythm is even, and a big jump is capped');
eq(dialTickInterval(1), 160, 'a single block takes the full step');
eq(dialTickInterval(4), 160, '4 blocks still fit under the cap at full speed');
eq(dialTickInterval(-4), 160, 'direction does not change the speed');
ok(Math.abs(dialTickInterval(10) - 110) < 1e-9, '0→10 speeds up to 110 ms a block');
for (const [from, to] of [[0, 10], [10, 0], [2, 9], [0, 9.5]]) {
  const run = dialTickSchedule(from, to);
  const last = run[run.length - 1].atMs;
  ok(last <= DIAL_TICK.delayMs + DIAL_TICK.maxTotalMs, `${from}→${to} finishes inside wait + cap (${last} ms)`);
  eq(run[run.length - 1].value, to, `${from}→${to} ends on the value`);
  ok(run.every((s, i) => i === 0 || Math.abs(s.value - run[i - 1].value) <= 1), `${from}→${to} never skips a block`);
  const gaps = run.slice(1).map((s, i) => s.atMs - run[i].atMs);
  ok(gaps.every(g => Math.abs(g - gaps[0]) < 1e-9), `${from}→${to} is evenly spaced`);
}
const run48 = dialTickSchedule(4, 8);
eq(run48.map(s => s.value), [5, 6, 7, 8], '4→8 visits every block');
eq(run48.map(s => s.atMs), [120, 280, 440, 600], '4→8 waits a beat, then 160 ms a block');
eq(dialTickSchedule(6, 6), [], 'no change, no run');

console.log('§4 the flash names the block that changed');
eq(dialTickFlash(4, 5), { index: 4, dir: 1 }, 'gaining the 5th lights block #4 white');
eq(dialTickFlash(5, 4), { index: 4, dir: -1 }, 'losing the 5th darkens block #4 red');
eq(dialTickFlash(0, 1), { index: 0, dir: 1 }, 'first block');
eq(dialTickFlash(1, 0), { index: 0, dir: -1 }, 'last block out');
eq(dialTickFlash(3, 3.5), { index: 3, dir: 1 }, 'a half value lights its block (the dial rounds up)');
eq(dialTickFlash(3.5, 4), null, 'no block changed, no flash');

console.log('§5 the wiring');
const dial = readFileSync(join(HERE, 'ArenaDial.jsx'), 'utf8');
const surface = readFileSync(join(HERE, 'MatchSurface.jsx'), 'utf8');
// ⚠️ SSR / first mount must print the REAL value — `arenaFallbackCheck` reads
// DRIVE6 from a fresh mount, and a dial mounting mid-match must not count up.
ok(/useState\(target\)/.test(dial) && /useRef\(target\)/.test(dial), 'first render draws the real value, not zero');
ok(dial.indexOf('rlsw-dial-cap') < dial.indexOf('className="rlsw-dial-num"'), 'label <text> still precedes the value (DRIVE6 contract)');
ok(!/transitionDelay\s*:/.test(dial), 'the 22 ms ripple is gone — it lagged high blocks behind their own tick');
ok(/DIAL_TICK\.delayMs/.test(dial) && /dialTickInterval\(/.test(dial) && /dialTickStep\(/.test(dial), 'the hook reads its timing from dialTick.js');
ok(/prefers-reduced-motion/.test(dial), 'reduced motion snaps');
ok((surface.match(/<ArenaDial[^>]*snapKey=\{spirit\?\.id\}/g) || []).length === 2, 'both pocket dials SNAP on a turn handoff');
ok(/data-dial-value=\{hud\?\.drive/.test(surface) && /data-dial-value=\{hud\?\.sustain/.test(surface), 'data-dial-value still carries the authoritative value, not the drawn one');

console.log(`\n✅ dialTickCheck: ${n} assertions passed`);
