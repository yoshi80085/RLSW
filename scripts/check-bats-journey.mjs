import { build } from 'vite';
import { spawnSync } from 'node:child_process';

// Vite uses the application's JSX settings and works on the Windows host.
await build({ build: { ssr: 'src/engine/batsJourneyCheck.jsx',
  outDir: 'node_modules/.cache/rlsw/bats-journey', emptyOutDir: true, minify: false },
  logLevel: 'error', ssr: { external: ['react', 'react-dom', 'jsdom'] } });
const result = spawnSync(process.execPath, ['node_modules/.cache/rlsw/bats-journey/batsJourneyCheck.js'],
  { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
