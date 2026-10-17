// 🔑 Set the front gate's hidden code.
//    npm run gate:code -- up left down right up right down left
// Words: up / down / left / right (or u d l r, or ↑ ↓ ← →). At least 6 presses.
// Rewrites `codeHash` and `codeLength` in src/app/gateConfig.js and prints the
// code back so you can check it. The code itself is never written anywhere.
// 📌 Rebuild and redeploy for a new code to reach the live site.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashCode, GATE_TOKENS } from '../src/app/gateCode.js';

const ALIAS = { u: 'up', d: 'down', l: 'left', r: 'right', '↑': 'up', '↓': 'down', '←': 'left', '→': 'right' };
const words = process.argv.slice(2).flatMap(a => a.split(/[\s,]+/)).filter(Boolean)
  .map(w => ALIAS[w.toLowerCase()] ?? w.toLowerCase());

const bad = words.filter(w => !GATE_TOKENS.includes(w));
if (bad.length || words.length < 6 || words.length > 24) {
  console.error('Usage: npm run gate:code -- up left down right up right down left');
  if (bad.length) console.error(`  ✗ not a direction: ${bad.join(', ')}`);
  if (words.length < 6) console.error(`  ✗ ${words.length} presses — use at least 6`);
  if (words.length > 24) console.error(`  ✗ ${words.length} presses — 24 at most`);
  process.exit(1);
}

const file = fileURLToPath(new URL('../src/app/gateConfig.js', import.meta.url));
const src = readFileSync(file, 'utf8');
const next = src
  .replace(/codeHash: '[^']*'/, `codeHash: '${hashCode(words)}'`)
  .replace(/codeLength: \d+/, `codeLength: ${words.length}`);
if (next === src && !src.includes(`codeHash: '${hashCode(words)}'`)) {
  console.error('  ✗ could not find codeHash / codeLength in gateConfig.js'); process.exit(1);
}
writeFileSync(file, next);
const arrow = { up: '↑', down: '↓', left: '←', right: '→' };
console.log(`🔑 Gate code set (${words.length} presses): ${words.map(w => arrow[w]).join(' ')}`);
console.log('   Keyboard: arrow keys or WASD · Pad: D-pad or left stick · max 3 s between presses');
console.log('   Rebuild + redeploy for the live site to use it.');
