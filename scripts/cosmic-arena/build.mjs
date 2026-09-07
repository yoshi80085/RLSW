// Rebuild the isolated browser preview and refresh coordinates from the live map.
// Install its one additional dependency with the command in docs/cosmic-arena.md.
import { build } from 'esbuild';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_HEXES } from '../../src/board/hexMap.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const out=path.join(root,'output/cosmic-arena');
await mkdir(out,{recursive:true});
await writeFile(path.join(out,'hex-map.json'),JSON.stringify(ALL_HEXES.map(h=>({...h,x:(h.px-3255)/200,z:(h.py-2415)/200})),null,2));
await build({absWorkingDir:root,entryPoints:[path.join(here,'arena.js')],nodePaths:[path.join(root,'.scratch/cosmic-arena/node_modules')],bundle:true,format:'esm',outfile:path.join(out,'arena.js'),sourcemap:true,loader:{'.png':'empty','.jpg':'empty','.svg':'empty'},logLevel:'info'});
for(const file of ['index.html','arena.css'])await copyFile(path.join(here,file),path.join(out,file));
console.log('Preview rebuilt. If the hex map changed, also rerun build_scene.py in Blender.');
