import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
const output = 'node_modules/.cache/rlsw/loadoutUiCheck.mjs';
await build({entryPoints:['src/engine/loadoutUiCheck.jsx'],bundle:true,platform:'node',packages:'external',jsx:'automatic',format:'esm',outfile:output,
  loader:{'.png':'empty','.jpg':'empty','.svg':'empty','.mp3':'empty','.wav':'empty','.m4v':'empty'},logLevel:'warning'});
const result=spawnSync(process.execPath,[output],{stdio:'inherit'});process.exitCode=result.status??1;
