import { build } from 'esbuild';

// Syntax/import verification needs asset URLs, not embedded media or /dev/null.
const result = await build({
  entryPoints: ['src/rlsw-simulator-v3_8_1.jsx'], bundle: true,
  write: false, jsx: 'automatic', format: 'esm', external: ['react', 'react-dom'],
  loader: Object.fromEntries(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'mp3', 'wav', 'ogg', 'm4a'].map(ext => [`.${ext}`, 'empty'])),
});
if (result.warnings.length) process.exitCode = 1;
else console.log('Bundle check passed with zero warnings (media stubbed).');
