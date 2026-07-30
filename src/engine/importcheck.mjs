// ═══ IMPORT CHECK ═══════════════════════════════════════════════════════════
// `node src/engine/importcheck.mjs`  —  exit 1 if any named import is dangling.
//
// ⚠️ WRITTEN AFTER A BROKEN BUILD THAT EVERY OTHER CHECK PASSED. A refactor
// deleted four exports from music/cadence.js. `b0check` passed (53 groups), and
// `esbuild --bundle=false` passed too — because it parses each file in ISOLATION
// and never resolves a cross-module import. `vite build` then failed on a second,
// forgotten import of one of the deleted names.
//
// That is the exact gap this closes: it is the cheapest possible stand-in for the
// real build in an environment where `vite` can't run (the Linux sandbox dies with
// a bus error loading it). It is NOT a substitute for `npm run build` — it doesn't
// typecheck, doesn't run plugins, and doesn't see dynamic imports — but it catches
// the one class of error that deleting code reliably produces.
//
// Run it after ANY pass that removes an export.
//
// Handles destructured exports (`export const { map: HEX_BY_NUM } = ...`), which an
// earlier version flagged as 11 false positives — a checker that cries wolf gets
// ignored, so that mattered as much as the true positive did.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
(function walk(d){ for (const e of readdirSync(d)) { const p = join(d,e);
  if (statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p); }
  else if (['.js','.jsx','.mjs'].includes(extname(p))) files.push(p); } })(ROOT);

// exports per file
const exportsOf = new Map();
for (const f of files) {
  const src = readFileSync(f,'utf8');
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  // destructured: `export const { map: HEX_BY_NUM, byQR: HEX_BY_QR } = ...`
  for (const m of src.matchAll(/^export\s+(?:const|let|var)\s*\{([^}]*)\}\s*=/gm))
    for (const part of m[1].split(',')) { const t=part.trim(); if(!t) continue;
      names.add((t.split(':').pop()||t).trim().replace(/=.*$/,'').trim()); }
  for (const m of src.matchAll(/^export\s+(?:const|let|var)\s*\[([^\]]*)\]\s*=/gm))
    for (const part of m[1].split(',')) { const t=part.trim(); if(t) names.add(t); }
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm))
    for (const part of m[1].split(',')) { const t=part.trim(); if(!t) continue;
      names.add((t.split(/\s+as\s+/).pop()||t).trim()); }
  if (/^export\s+default/m.test(src)) names.add('default');
  exportsOf.set(f, names);
}
let bad = 0;
for (const f of files) {
  const src = readFileSync(f,'utf8');
  for (const m of src.matchAll(/import\s+([^;]*?)\s+from\s+["']([^"']+)["']/gs)) {
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    let target = resolve(dirname(f), spec);
    const cands = [target, target+'.js', target+'.jsx', target+'.mjs', join(target,'index.js')];
    let hit = cands.find(c => files.includes(c));
    if (!hit) {
      // ⚠️ CASE-INSENSITIVE RETRY. Windows (NTFS) resolves `./Foo` to `foo.jsx`
      // happily; Linux does not. Since this project deploys to Render, a casing
      // mismatch is a build that passes locally and fails in production — exactly
      // what `App.jsx` had, importing `rlsw-simulator-V3_8_1` for a file named
      // `...-v3_8_1.jsx`. Report it loudly rather than shrugging.
      const lower = cands.map(c => c.toLowerCase());
      const ci = files.find(fp => lower.includes(fp.toLowerCase()));
      if (ci) {
        console.log(`✗ ${f.replace(ROOT,'src')}\n    imports "${spec}" but the file is "${ci.split('/').pop()}" — CASE MISMATCH, breaks on Linux`);
        bad++; hit = ci;
      } else {
        if (!/\.(png|jpg|jpeg|mp3|m4v|css|svg|PNG)$/i.test(spec))
          console.log(`? unresolved ${spec}  <- ${f.replace(ROOT,'src')}`);
        continue;
      }
    }
    const clause = m[1];
    const braced = clause.match(/\{([^}]*)\}/s);
    if (!braced) continue;
    for (const part of braced[1].split(',')) {
      const t = part.trim(); if (!t) continue;
      const name = t.split(/\s+as\s+/)[0].trim();
      if (!exportsOf.get(hit).has(name)) {
        console.log(`✗ ${f.replace(ROOT,'src')}\n    imports "${name}" from ${spec} — NOT EXPORTED`);
        bad++;
      }
    }
  }
}
if (bad) { console.error(`\n✗ ${bad} dangling import(s) — this WILL fail \`npm run build\``); process.exit(1); }
console.log('✓ every named import in src/ resolves to a real export');
