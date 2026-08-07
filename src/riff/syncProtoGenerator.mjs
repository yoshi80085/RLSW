// =============================================================================
// riff/syncProtoGenerator.mjs — inline riffArchetypes.js into the prototype
// -----------------------------------------------------------------------------
//     node src/riff/syncProtoGenerator.mjs
//
// arrow-highway-proto.html is opened straight off disk (file://), where browsers
// refuse ES-module imports. So the generator has to live inline in the page —
// but riffArchetypes.js stays the single source of truth and this script copies
// it in, between the ARCHETYPES markers. Same pattern as calibrateNeonNeck.mjs
// regenerating neonNeckGeometry.js: never hand-edit the copy.
//
// Run this after ANY change to riffArchetypes.js.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC  = path.join(here, 'riffArchetypes.js');
const HTML = path.join(here, '..', '..', 'arrow-highway-proto.html');

const OPEN  = '// <<<<<< ARCHETYPES: GENERATED FROM src/riff/riffArchetypes.js — DO NOT EDIT';
const CLOSE = '// >>>>>> END ARCHETYPES';

let mod = fs.readFileSync(SRC, 'utf8');

// strip ES module syntax — the page runs as a classic script
mod = mod
  .replace(/^export\s+const\s+/gm, 'const ')
  .replace(/^export\s+function\s+/gm, 'function ')
  .replace(/^import[^\n]*\n/gm, '');

if (/^export/m.test(mod)) {
  console.error('❌ leftover `export` after stripping — check riffArchetypes.js syntax');
  process.exit(1);
}

const html = fs.readFileSync(HTML, 'utf8');
const i = html.indexOf(OPEN);
const j = html.indexOf(CLOSE);
if (i < 0 || j < 0) {
  console.error(`❌ markers not found in ${path.basename(HTML)}`);
  console.error(`   expected:\n     ${OPEN}\n     ${CLOSE}`);
  process.exit(1);
}

const next = html.slice(0, i + OPEN.length) + '\n' + mod + '\n' + html.slice(j);
fs.writeFileSync(HTML, next);

const lines = mod.split('\n').length;
console.log(`✅ inlined ${lines} lines of riffArchetypes.js into ${path.basename(HTML)}`);
