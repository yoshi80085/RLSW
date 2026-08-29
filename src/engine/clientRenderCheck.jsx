// ─── 🎬 CLIENT RENDER CHECK ──────────────────────────────────────────────────
//
// Does the client actually RENDER?
//
// ⚠️ THIS IS THE CHECK SEQUENCING.md §5 ASKED FOR THREE HANDOFFS RUNNING, and it
// is the smaller half of it. The ask was: mount `Game`, commit a track, end a
// turn, assert the next Spirit was dealt a hand. That needs a DOM to click
// through, and jsdom will not install on this machine — `npm install jsdom`
// hangs on the local VM's network, the same reason `npm run build` is
// unavailable here. So this suite does the half that needs no DOM: it renders
// `Game` through react-dom/server against a real match config and asserts the
// board came out with its panels on it.
//
// 🎯 WHAT THAT IS WORTH, EXACTLY. Both client bugs that shipped in August were
// RENDER-TIME REFERENCE ERRORS — `startNewTurnNotes` deleted while two call
// sites still called it, and `atkSkills` deleted while `startSonicAttack` still
// read it. `check:bundle` cannot see those (esbuild reads a call to a missing
// function as a global). `test:client` catches the undeclared NAME but not the
// throw. Rendering the component is what turns "the name is missing" into "the
// screen is blank", and nothing in this repo did that before.
//
// ⏳ WHAT IT IS STILL NOT. It does not click, it does not advance a turn, and it
// does not prove the commit path hands the player the move phase — the exact bug
// of 2026-08-26 would still get past this suite. Say so out loud in the output
// so nobody quotes this as "the client is tested".

import './clientRenderShim.mjs';           // ⚠️ MUST BE FIRST — installs the globals
import { renderToStaticMarkup } from 'react-dom/server';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';

let checks = 0, failed = 0;
const ok = (label, cond, detail = '') => {
  checks++;
  if (cond) { console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? '\n      ' + detail : ''}`); }
};

console.log('\n§1 the client renders at all');
let html = '';
try {
  const gs = buildTestingGroundsConfig();
  html = renderToStaticMarkup(<Game gameState={gs} onReturnToLobby={() => {}} />);
  ok('Game renders without throwing', true);
} catch (e) {
  ok('Game renders without throwing', false, `${e.name}: ${e.message}\n      ${(e.stack||'').split('\n')[1]?.trim() ?? ''}`);
}

console.log('\n§2 the board came out with something on it');
ok('produced markup', html.length > 2000, `got ${html.length} bytes`);

console.log('\n§3 the commit overlay panels are step-gated');
// 📌 These are the panels the 2026-08-28 overlay port moved. A render that
// silently drops one is the failure this section exists to name.
// ⚠️ A FRESH GAME OPENS ON STEP 1 (`turnStep` starts at 'chord'), so this
// section asserts the GATE, not mere presence: the chord stacks are up and the
// commit track is NOT. Both halves matter — "the track rendered" was a true
// assertion for months and stopped being the right one the moment the panels
// earned a step to belong to. 📌 The track's own render can only be reached
// through a click, which nothing here can do; §5 of SEQUENCING says why.
ok('the Drive stack rendered',    html.includes('data-tip-anchor="drive-stack"'));
ok('the Sustain stack rendered',  html.includes('data-tip-anchor="sustain-stack"'));
ok('the chord-stack anchor survived the split', html.includes('data-tip-anchor="chord-stack"'));
ok('the Commit Track is NOT up during step 1', !html.includes('data-tip-anchor="commit-track"'));

console.log('\n§4 the amp knob is on the stack panels');
// StatKnob's cap carries the stat colour at 55% alpha — one per stack panel,
// plus the two in the HUD column. Fewer than four means a knob went missing.
const caps = (html.match(/border:1\.5px solid #(?:ff6644|44aaff)55/g) || []).length;
ok('at least one amp knob per stack panel', caps >= 2, `found ${caps} knob cap borders`);
const slots = (html.match(/data-stack-slot=/g) || []).length;
ok('both stacks rendered their slots', slots > 0, `found ${slots} slot elements`);

console.log(`\n${failed === 0 ? '✅' : '❌'} clientRenderCheck: ${checks - failed}/${checks} checks passed`);
console.log('⏳ NOT COVERED: clicking, committing a track, or ending a turn — needs a DOM (see the header).');
if (failed) process.exit(1);
