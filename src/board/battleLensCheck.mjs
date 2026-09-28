// ─── battleLensCheck — `test:battlelens`. No lens into nothing, anywhere ──────
// Alex, 2026-09-28 (the THIRD report): "camera glitches at the start of the
// match where it seems like it zooms really far into the arena - into nothing
// for a few seconds before correcting". And the bar he set: "if the battle
// starts, triggers, and plays out the first 5 seconds without any camera
// glitches or bugs, I'd say its working fine."
//
// Measured, not eyeballed: whole bouts played headless through the REAL arena,
// crowd, visuals, director and camera (battleLensHarness.mjs), and every frame
// the lens holds is judged on what is actually on screen:
//   · a standee filling the screen (taller than 1.25× the frame) — the other
//     Spirit's acrylic sheet a metre in front of the lens, the 2026-09-28 bug;
//   · a Spirit the shot is ABOUT, a third or more hidden by an amp stack, a
//     grandstand, the truss, or the other standee;
//   · a Spirit the shot is about, off the screen.
// On the code before the fix the same sweep found it in 11 of 50 Sonics and
// 15 of 40 Swings — almost all in the first charge shot, 5.6–6 s in.
import assert from 'node:assert/strict';
import { simulate, makeCfgs } from './battleLensHarness.mjs';
import { BATTLE_DIRECTOR } from './battleDirector.js';

let passed = 0; const ok = (name, cond, extra = '') => { assert.ok(cond, `${name} ${extra}`); passed++; };
const FIRST = +(process.env.LENS_FIRST ?? 8);   // the opening window that must be spotless
const subjects = key => /^(charge|final)-(\d)/.test(key) ? [+key.match(/-(\d)/)[1]] : /crowds|unlock/.test(key) ? [] : [0, 1];
function judge(F) {
  const bad = [];
  for (const f of F) {
    if (!f.active || !f.key) continue;
    const subj = subjects(f.key);
    const blocked = Math.max(0, ...subj.map(i => f.occl[i]?.frac ?? 0));
    const fill = Math.max(...f.proj.map(p => p && p[0].z < 1 && p[1].z < 1 && Math.min(Math.abs(p[0].x), Math.abs(p[1].x)) < 1.2 ? Math.abs(p[1].y - p[0].y) / 2 : 0));
    const off = subj.some(i => { const p = f.proj[i]; return !p || p[2].z > 1 || Math.abs(p[2].x) > 1 || Math.abs(p[2].y) > 1; });
    const why = [blocked >= .34 && `${Math.round(blocked * 100)}% hidden by ${subj.map(i => f.occl[i]?.by).filter(Boolean).join('/')}`,
      fill > 1.25 && `a sheet ${fill.toFixed(1)}× the screen`, off && 'subject off screen'].filter(Boolean);
    if (why.length) bad.push({ t:f.t, key:f.key, why:why.join(', ') });
  }
  return bad;
}
const run = (kind, cfg) => judge(simulate({ kind, ...cfg, step:.2, secs:kind === 'swing' ? 17 : 19 }));

console.log('§0 the dive-bomb (the cause Alex\'s screen recording showed)');
{
  // The 2D board's battle-opening flourish scales the WHOLE board frame to 7×,
  // blurs it and fades it out over 1.1 s. In 3D that frame holds the arena's
  // canvases, so every bout opened on the page's empty space background.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../rlsw-simulator-v3_8_1.jsx', import.meta.url), 'utf8');
  const uses = [...src.matchAll(/boardDiveBomb\s*(&&[^?]*)?\?\s*\{animation:'board-divebomb/g)];
  ok('the board-frame dive-bomb never plays over the 3D arena', uses.length === 1 && /!board3D/.test(uses[0][1] ?? ''));
}

console.log('§1 the bouts that broke (the 2026-09-28 sweep, before the fix)');
{
  // The default adjacent pair: the Rival's shield shot aimed 3.6 across empty floor.
  const a = run('sonic', { a:45, b:46, ca:'blue', cb:'red' });
  ok('45→46 blue/red Sonic: clean from the first frame to the last', !a.length, JSON.stringify(a[0]));
  // The attacker's charge with the Rival's sheet 1.5 from the lens (4.5× the screen).
  const b = run('sonic', { a:76, b:94, ca:'purple', cb:'blue', viewer:'rival', fb:2.1 });
  ok('76→94 purple/blue Sonic: no sheet in front of the lens', !b.length, JSON.stringify(b[0]));
  const c = run('swing', { a:45, b:46, ca:'blue', cb:'red' });
  ok('45→46 Swing: the first charge shot (6 s in) is clean', !c.length, JSON.stringify(c[0]));
}

console.log(`§2 random bouts — spotless for the first ${FIRST} s (Alex's bar is 5)`);
for (const [kind, n, seed] of [['sonic', +(process.env.LENS_N ?? 6), 21], ['swing', +(process.env.LENS_N ?? 6), 9]]) {
  let later = 0;
  for (const cfg of makeCfgs(kind, n, seed)) {
    const bad = run(kind, cfg), early = bad.filter(b => b.t < FIRST);
    later += bad.length - early.length;
    ok(`${kind} ${cfg.a}→${cfg.b} ${cfg.ca}/${cfg.cb} (${cfg.viewer}'s screen)`, !early.length, JSON.stringify(early[0]));
  }
  console.log(`  ${kind}: ${later} imperfect frame(s) after ${FIRST} s (reported, not failed)`);
}

console.log('§3 the knobs are where the fix left them');
ok('no standee nearer the lens than clearNear', BATTLE_DIRECTOR.clearNear >= 3);
ok('the charge shot aims at most chargeReach past its standee', BATTLE_DIRECTOR.chargeReach > 0 && BATTLE_DIRECTOR.chargeReach < 3);
console.log(`PASS: battle lens — ${passed} checks`);
