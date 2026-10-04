// Copy only this preview's dependency graph and explicit runtime assets.
// No repository reset, browser storage export, network access or credentials.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const root = process.cwd(), preview = 'previews/bardbarian-intro';
const destination = process.argv.find(arg => arg.startsWith('--out='))?.slice(6)
  ?? 'handoffs/bardbarian-intro-2026-10-04';
const out = path.resolve(root, destination), handoffsRoot = path.resolve(root, 'handoffs');
if (!out.startsWith(handoffsRoot + path.sep)) throw new Error('Output must be inside this workspace’s handoffs folder.');
if (fs.existsSync(out) && fs.readdirSync(out).length) throw new Error('Destination already has files. Use --out=handoffs/a-new-folder to preserve it.');
const originals = new Map();
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
function write(name, data) { const target = path.join(out, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data); }
function copy(source, target) {
  const data = fs.readFileSync(path.join(root, source)); write(target, data);
  originals.set(target, { source, sha256: digest(data) });
}
const result = await build({ absWorkingDir: root, entryPoints: [`./${preview}/main.js`],
  bundle: true, format: 'esm', write: false, metafile: true,
  loader: { '.png': 'empty' }, logLevel: 'silent' });
if (result.warnings.length) throw new Error(JSON.stringify(result.warnings));
const dependencies = Object.keys(result.metafile.inputs).map(p => p.replaceAll('\\', '/'))
  .filter(p => !p.includes('node_modules/'));
for (const source of dependencies.filter(p => !p.startsWith(preview + '/'))) copy(source, `project/${source}`);
for (const name of fs.readdirSync(path.join(root, preview))) {
  const source = `${preview}/${name}`;
  if (fs.statSync(path.join(root, source)).isFile()) copy(source, `project/${source}`);
}
copy('public/cosmic-arena/cosmic-arena.glb', 'project/public/cosmic-arena/cosmic-arena.glb');
const handoff = 'CLAUDE_BARDBARIAN_INTRO_HANDOFF.md'; copy(handoff, handoff);
for (const source of ['CLAUDE.md', 'src/STATE_OF_PLAY.md', 'src/SEQUENCING.md', 'src/ARCHITECTURE.md', 'package.json']) copy(source, `context/${source}`);
const version = name => JSON.parse(fs.readFileSync(path.join(root, `node_modules/${name}/package.json`), 'utf8')).version;
write('project/package.json', JSON.stringify({ name: 'rlsw-bardbarian-intro-preview', private: true,
  type: 'module', version: '1.0.0', engines: { node: '>=22.12.0' },
  scripts: { dev: 'vite --host 127.0.0.1 --port 5176 --open /RLSW/previews/bardbarian-intro/',
    test: 'node previews/bardbarian-intro/check.mjs' },
  dependencies: { three: version('three') }, devDependencies: { vite: version('vite') },
}, null, 2) + '\n');
write('project/vite.config.js', "export default { base: '/RLSW/' };\n");
write('README.md', `# Bardbarian — start here

Read ${handoff} before editing. Alex's exact selected settings are saved in
project/previews/bardbarian-intro/alex-dial-in.json and used directly by the preview.

With Node 22.12+ installed, enter project/, run npm install, then npm run dev.
Open the URL printed by Vite at /RLSW/previews/bardbarian-intro/. Run npm test.
The source, real arena GLB, standee art, generated Bardbarian PNG and every local
module imported by the scene are included. npm installs Three.js and Vite.

This is an isolated editable preview, not a full game build or package.json overlay.
All production rule integration remains to be done. Keep the directory structure.
Changes here do not automatically update the original workspace or this ZIP.
The context/ files describe the original repo; they are reference copies only.
The original artwork prompt is project/previews/bardbarian-intro/ASSET.md.
No browser-local settings are needed to recover Alex's look. Existing local
experiments can still override it until Reset look is pressed.
`);
const walk = (dir, prefix = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]);
const files = walk(out).map(name => {
  const data = fs.readFileSync(path.join(out, name)), original = originals.get(name);
  if (original && digest(data) !== original.sha256) throw new Error(`Copy mismatch: ${name}`);
  return { path: name, source: original?.source ?? null, bytes: data.length, sha256: digest(data) };
});
write('manifest.json', JSON.stringify({ createdAt: new Date().toISOString(),
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  kind: 'isolated-editable-preview-with-local-dependencies-and-assets',
  selectedDialIn: 'project/previews/bardbarian-intro/alex-dial-in.json',
  dependencies: { three: version('three'), vite: version('vite') }, files }, null, 2) + '\n');
console.log(`Verified ${files.length} files; ${dependencies.length} local build inputs; zero bundle warnings.\n${out}`);
