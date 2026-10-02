// ─── Builds the DOUBLE-CLICK copy of the Pyro shove study ────────────────────
// `index.html` imports modules (three, the real standee, the real board, the art),
// so it only loads through Vite. Opened off the disk it is blank (the picker's
// lesson, 2026-09-25). This bundles the same page into ONE file; the art is
// inlined, so it is ~12 MB.
//
// Run:  node .scratch/pyro-shove/build.mjs   → .scratch/pyro-shove/pyro-shove.standalone.html
// ⚠️ Re-run it after editing anything in this folder, `standeeMotion.js` or Astra's
// `../stage-hazards`, or the standalone copy is stale.
// ESBUILD_MODULE lets a Linux VM point at its own esbuild when node_modules was installed on Windows.
const { build } = await import(process.env.ESBUILD_MODULE ?? 'esbuild');
import { readFileSync, writeFileSync } from 'node:fs';

const result = await build({
  entryPoints:['.scratch/pyro-shove/preview.js'], bundle:true, format:'iife', write:false, outdir:'.scratch/_pyroshove',
  minify:true, loader:{ '.png':'dataurl' }, logLevel:'warning',
});
const js = result.outputFiles.find(f => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const tag = '<script type="module" src="./preview.js"></script>';
const html = readFileSync('.scratch/pyro-shove/index.html', 'utf8');
if (!html.includes(tag)) throw new Error('script tag not found in index.html');
// ⚠️ A FUNCTION replacer: minified code is full of `$&` / `$'`.
const out = html.replace(tag, () => `<script>${js}</script>`);
writeFileSync('.scratch/pyro-shove/pyro-shove.standalone.html', out);
// 📌 The ARTIFACT copy: the publish tool adds the doctype/head/body itself, so this is
// just the title, the style and the body (with the bundle inlined). One file, ~12 MB.
const title = html.match(/<title>[\s\S]*?<\/title>/)[0], style = html.match(/<style>[\s\S]*?<\/style>/)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(tag, () => `<script>${js}</script>`);
writeFileSync('.scratch/pyro-shove/pyro-shove.artifact.html', `${title}\n${style}\n${body}`);
console.log(`wrote .scratch/pyro-shove/pyro-shove.artifact.html`);
console.log(`wrote .scratch/pyro-shove/pyro-shove.standalone.html (${(out.length / 1e6).toFixed(1)} MB)`);
