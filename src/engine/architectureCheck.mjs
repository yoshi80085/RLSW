// ═══ ARCHITECTURE CHECK ═════════════════════════════════════════════════════
// `npm run test:arch`  —  asserts that `src/ARCHITECTURE.md` still describes the
// code it claims to map.
//
// ⚠️ WRITTEN AFTER THE MAP DRIFTED FOR MONTHS WITH NOTHING ABLE TO NOTICE.
// On 2026-08-21 ARCHITECTURE.md called `engine/` a "~300 line Phase 1 scaffold"
// while `engine/` had grown to 21,595 lines and become the entire game;
// `engine/policies/` and `engine/systems/` did not appear in the file at all;
// 50 of 130 modules were unlisted; four rows named files that no longer existed;
// and the "where do I change X?" index sent readers to five functions that had
// been deleted along with the Style system. Every one of those is the kind of
// mistake a machine catches in a second and a human never catches at all,
// because nothing about a stale doc fails.
//
// 🎯 THE POINT IS NOT COMPLETENESS, IT IS HONESTY. This does not check that the
// prose is good or that a description is apt — it cannot. It checks the three
// claims a map makes that CAN be falsified:
//
//   1. every source module is named somewhere in the doc      (nothing is missing)
//   2. every file path the doc names exists                   (nothing is a dead end)
//   3. every export the doc names is really exported          (nothing is a phantom)
//
// 📌 A new module therefore FAILS this suite until it has a row. That is
// deliberate and it is the whole mechanism: the cost of documenting a file is
// paid at the moment it is cheapest, by the person who already has the context.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC_PATH = join(SRC, 'ARCHITECTURE.md');
const doc = readFileSync(DOC_PATH, 'utf8');

let failures = 0, checks = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const ok   = (cond, msg) => { checks++; if (!cond) fail(msg); };

// ── the tree, as it actually is ─────────────────────────────────────────────
// ⚠️ `.scratch/` and `_to_delete/` are excluded because they are working piles,
//    not source — see .gitignore. `standees/`, `bgm/`, `sfx/` hold no modules.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'standees', 'bgm', 'sfx']);
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|jsx|mjs)$/.test(e.name)) files.push(p);
  }
})(SRC);

const rel = (p) => relative(SRC, p).replace(/\\/g, '/');

// ── exports, read from the source rather than assumed ───────────────────────
function exportsOf(src) {
  const out = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z0-9_$]+)/gm)) out.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]+)\}/gm))
    for (const part of m[1].split(',')) { const n = part.split(/\s+as\s+/).pop().trim(); if (n) out.add(n); }
  for (const m of src.matchAll(/^export\s+const\s*\{([^}]+)\}/gm))
    for (const part of m[1].split(',')) { const n = part.split(':').pop().trim(); if (n) out.add(n); }
  return out;
}
const exportsByFile = new Map();
for (const f of files) exportsByFile.set(rel(f), exportsOf(readFileSync(f, 'utf8')));

console.log('🗺️  architectureCheck — is the map still the territory?\n');

// ═══ 1. EVERY MODULE IS NAMED ═══════════════════════════════════════════════
// Matched on basename, because the doc groups by directory and then lists bare
// filenames inside each section — requiring full paths would make every table
// unreadable for no extra safety.
console.log('§1 every source module is named in the doc');
{
  const missing = [];
  for (const f of files) {
    const name = basename(rel(f));
    if (!doc.includes(name)) missing.push(rel(f));
  }
  ok(missing.length === 0,
    `${missing.length} module(s) exist but are not named in ARCHITECTURE.md:\n      ` +
    missing.join('\n      ') +
    `\n\n    📌 Add a row for each in the matching section. This is not busywork:` +
    `\n       an unlisted module is one a future session has to rediscover.`);
  if (!missing.length) console.log(`  ✓ all ${files.length} modules under src/ have a row`);
}

// ═══ 2. NO DEAD PATHS ═══════════════════════════════════════════════════════
// ⚠️ THE FAILURE MODE THIS CATCHES IS THE WORST ONE A MAP HAS: not silence, but
//    confident wrong directions. `ampRigs.js`, `useNoteSystem.js`, `RiffBanner.jsx`
//    and `riffLibrary.js` all sat in tables for months after deletion, one of them
//    under the heading "Add/edit riffs here."
console.log('\n§2 every path the doc names exists');
{
  const known = new Set(files.map(f => basename(rel(f))));
  const named = new Set();
  for (const m of doc.matchAll(/`([A-Za-z0-9_@./-]+\.(?:js|jsx|mjs))`/g)) named.add(m[1]);
  // 🪦 The "rows that used to be here" table names dead files ON PURPOSE, as
  //    forwarding addresses. Everything after that heading is exempt.
  const graveyard = doc.indexOf('### 🪦 Rows that used to be here');
  const dead = [];
  for (const n of named) {
    const b = basename(n);
    if (known.has(b)) continue;
    if (b === 'index.js' || n.startsWith('server/')) continue;   // server/ is outside src/
    const at = doc.indexOf('`' + n + '`');
    if (graveyard !== -1 && at > graveyard) continue;
    dead.push(n);
  }
  ok(dead.length === 0,
    `the doc points at ${dead.length} file(s) that do not exist: ${dead.join(', ')}` +
    `\n    📌 Either fix the path, or move the row into the 🪦 forwarding table` +
    ` so a reader who remembers it is told where it went.`);
  if (!dead.length) console.log(`  ✓ all ${named.size} file paths named in the doc resolve`);
}

// ═══ 3. NO PHANTOM EXPORTS ══════════════════════════════════════════════════
// Each row is `| \`file.js\` | lines | \`a\`, \`b\`, \`c\` | purpose |`. We read the
// exports column against the file named in the first column.
// 📌 Only checks names the doc presents AS exports. Prose mentions elsewhere are
//    not policed — a check that cried wolf would get ignored, which is exactly
//    how the last one died (`importcheck.mjs`, 17 findings, all 17 false).
console.log('\n§3 every export the doc lists is really exported');
{
  const byBase = new Map();
  for (const [p, ex] of exportsByFile) {
    const b = basename(p);
    if (!byBase.has(b)) byBase.set(b, new Set());
    for (const e of ex) byBase.get(b).add(e);
  }
  const graveyard = doc.indexOf('### 🪦 Rows that used to be here');
  const phantoms = [];
  let listed = 0;
  // ⚠️ ONLY FOUR-COLUMN ROWS. The `ui/` table and the directory map are
  //    `| file | lines | purpose |` — three columns — so reading column 3 as
  //    exports there flags every prose word as a phantom. That false-positive
  //    run is precisely how a checker earns the right to be ignored, so the
  //    shape of the row is the gate.
  const rowRe = /^\|(.+)\|\s*$/gm;
  for (const m of doc.matchAll(rowRe)) {
    if (graveyard !== -1 && m.index > graveyard) continue;
    const cells = m[1].split('|').map(c => c.trim());
    if (cells.length !== 4) continue;
    const head = cells[0].match(/^`([A-Za-z0-9_./-]+\.(?:js|jsx|mjs))`$/);
    if (!head) continue;
    if (!/^[\d,]+$/.test(cells[1])) continue;      // column 2 must be a line count
    m[2] = cells[2];
    const file = basename(head[1]);
    const known = byBase.get(file);
    if (!known) continue;                       // §2 already reports a missing file
    for (const c of m[2].matchAll(/`([A-Za-z0-9_$]+)`/g)) {
      const name = c[1];
      if (!/^[A-Za-z_$]/.test(name)) continue;
      listed++;
      if (!known.has(name)) phantoms.push(`${file} → ${name}`);
    }
  }
  ok(phantoms.length === 0,
    `${phantoms.length} name(s) are listed as exports but are not exported:\n      ` +
    phantoms.join('\n      ') +
    `\n\n    📌 Module-local constants are fine to mention — say so in the purpose` +
    `\n       column instead of the exports column, the way FretboardRecon's` +
    `\n       TIER_CONFIG row does.`);
  if (!phantoms.length) console.log(`  ✓ all ${listed} exports listed in the module tables are real`);
}

// ═══ 4. THE DOC IS NOT SILENTLY EMPTY ═══════════════════════════════════════
// 📌 Cheap insurance against a truncated write leaving a two-line file that
//    trivially passes §1–§3 by naming nothing at all.
console.log('\n§4 sanity');
{
  ok(doc.length > 8000, `ARCHITECTURE.md is only ${doc.length} bytes — did a write truncate it?`);
  for (const heading of ['## Boot flow', '## Directory map', '## "Where do I change X?"', '## Conventions'])
    ok(doc.includes(heading), `the doc has lost its "${heading}" section`);
  console.log('  ✓ the doc is intact and keeps its load-bearing sections');
}

console.log('');
if (failures) {
  console.error(`❌ architectureCheck: ${failures} failure(s) across ${checks} checks`);
  console.error('   The map and the territory disagree. Fix ARCHITECTURE.md, not this file.');
  process.exit(1);
}
console.log(`✅ architectureCheck: ${checks} checks passed — the map matches the territory`);
