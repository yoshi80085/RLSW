/* eslint-disable react-refresh/only-export-components -- Executable DOM test, not a hot-reloaded application module. */
// ⏱️ dialTickMountCheck — the second half of `test:dialtick`: the REAL ArenaDial,
// mounted in jsdom, ticking on real timers.
//
// `dialTickCheck.mjs` proves the timeline; this proves the hook plays it. It
// earned its place on the first run — mounting it found a React duplicate-key
// collision between the bloom's replay key and the flash's (see the ⚠️ at the
// flash in ArenaDial.jsx) that no source read would have caught.
//
// ⚠️ TIMING IS POLLED, NEVER SLEPT-AND-ASSERTED. The local VM stalls under load,
// so "after 150 ms it reads 5" would be a flaky suite. What is asserted is order
// and shape: it waits before moving, never skips a block, never overshoots,
// turns round on a change of mind, and snaps where it must.
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import ArenaDial, { DIAL_CSS } from './ArenaDial.jsx';
import { DIAL_TICK } from './dialTick.js';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node'])
  Object.defineProperty(globalThis, k, { configurable: true, value: k === 'window' ? dom.window : dom.window[k] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Any React warning (duplicate keys, setState after unmount) fails the suite.
const warnings = [];
const realError = console.error;
console.error = (...args) => warnings.push(args.map(String).join(' '));

let n = 0;
const ok = (cond, msg) => { n++; assert.ok(cond, msg); };

const ssr = renderToString(<ArenaDial stat="d" label="DRIVE" value={6} />);
ok(/DRIVE<\/text>.*>6<\/text>/s.test(ssr), 'SSR prints the real value, label first (DRIVE6)');
ok(!/transition-delay/.test(ssr), 'no per-block stagger in the markup');
ok(DIAL_CSS.includes(`rlsw-dial-charge ${DIAL_TICK.flareMs}ms`) && DIAL_CSS.includes(`${DIAL_TICK.gainFlashMs}ms`)
  && DIAL_CSS.includes(`${DIAL_TICK.lossFlashMs}ms`), 'DIAL_CSS is built from DIAL_TICK');

const root = createRoot(document.getElementById('root'));
const tickMs = 10;
const sleep = ms => act(async () => new Promise(r => setTimeout(r, ms)));
const num = () => document.querySelector('.rlsw-dial-num').textContent;
const onPaths = () => [...document.querySelectorAll('g:not(.rlsw-dial-bloom) > .rlsw-dial-on')];
const lit = () => onPaths().filter(p => p.getAttribute('opacity') === '1').length;
const flash = () => document.querySelector('.rlsw-dial-flash');
const draw = (v, key = 'ronin') => act(async () => root.render(<ArenaDial stat="d" label="DRIVE" value={v} snapKey={key} />));
// Poll until `done()`, recording every distinct number seen on the way.
async function watch(done, limitMs = 4000) {
  const seen = [num()], t0 = Date.now();
  while (!done() && Date.now() - t0 < limitMs) { await sleep(tickMs); if (num() !== seen[seen.length - 1]) seen.push(num()); }
  return { seen: seen.map(Number), ms: Date.now() - t0 };
}

try {
  await draw(4);
  ok(num() === '4' && lit() === 4 && !flash(), 'mounts on the real value with no flash');

  await draw(8);
  ok(num() === '4', 'a change does not move the dial in the same frame — it waits a beat');
  const t0 = Date.now();
  await watch(() => num() !== '4');
  ok(Date.now() - t0 >= DIAL_TICK.delayMs - 20, `the first block waits out delayMs (${Date.now() - t0} ms)`);
  ok(num() === '5' && lit() === 5, 'the first tick is ONE block');
  ok(flash()?.classList.contains('gain') && flash().getAttribute('d') === onPaths()[4].getAttribute('d'),
    'the block just gained flashes white');
  const up = await watch(() => num() === '8');
  ok(up.seen.every((v, i) => i === 0 || v - up.seen[i - 1] === 1), `ticks up without skipping (${up.seen.join('→')})`);
  ok(num() === '8' && lit() === 8, 'lands on the value');
  await sleep(DIAL_TICK.stepMs * 2);
  ok(num() === '8', 'and stays there — no overshoot');

  // Change of mind: head for 2, then turn round for 5 before arriving.
  await draw(2);
  await watch(() => Number(num()) <= 6);
  ok(flash()?.classList.contains('loss'), 'the block just lost flashes red');
  await draw(5);
  const back = await watch(() => num() === '5');
  await sleep(DIAL_TICK.stepMs * 2);
  ok(num() === '5' && lit() === 5, `a retarget mid-run turns round and lands (${back.seen.join('→')})`);
  ok(back.seen.every((v, i) => i === 0 || Math.abs(v - back.seen[i - 1]) === 1), 'never skips on the way round');

  // A different player's numbers SNAP.
  await draw(9, 'intergalactic');
  ok(num() === '9' && lit() === 9 && !flash(), 'a new snapKey snaps instantly, with no flash');
  await draw(null, 'intergalactic');
  ok(num() === '—', 'an unknown value shows the dash');
  await draw(3, 'intergalactic');
  ok(num() === '3', 'the first real value after unknown snaps rather than counting from nothing');
  dom.window.matchMedia = () => ({ matches: true });
  await draw(7, 'intergalactic');
  ok(num() === '7', 'prefers-reduced-motion snaps');
  dom.window.matchMedia = undefined;

  // Unmount mid-run: the pending step must be cancelled, not fire into a dead tree.
  await draw(0, 'intergalactic');
  await act(async () => root.unmount());
  await new Promise(r => setTimeout(r, DIAL_TICK.delayMs + DIAL_TICK.maxTotalMs + 200));
  ok(warnings.length === 0, `no React warnings across the run${warnings.length ? ':\n  ' + warnings.join('\n  ') : ''}`);
} finally {
  console.error = realError;
  dom.window.close();
}
console.log(`✅ dialTickMountCheck: ${n} assertions passed`);
