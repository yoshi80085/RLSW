// ─── TEST ASSET STUB LOADER ──────────────────────────────────────────────────
// The engine selftest runs under plain Node, but the module graph it pulls in
// reaches app data modules that `import` art assets — e.g. selftest → data/
// styles.js → data/spirits.js → standees/Glamarchy.png. Vite rewrites those
// imports to URL strings at build time; Node has no such concept and dies with
// ERR_UNKNOWN_FILE_EXTENSION before a single assertion runs.
//
// These hooks give Node the same contract Vite provides: any asset import
// resolves to a module whose default export is the asset's path string. That's
// enough for data modules that only ever stash the value in an `imageSrc`
// field — nothing headless renders it.
//
// Wired up via `node --import ./src/engine/testAssetStub.mjs` in the
// `test:engine` script. Test-only — never part of a Vite build.

import { registerHooks } from "node:module";

// Everything Vite would treat as a static asset rather than a module.
const ASSET_RE = /\.(png|jpe?g|gif|svg|webp|avif|ico|mp3|wav|ogg|m4a|woff2?|ttf|css)(\?.*)?$/i;

const STUB_SCHEME = "asset-stub:";

if (typeof registerHooks !== "function") {
  throw new Error(
    "testAssetStub.mjs needs Node 22.15+ for module.registerHooks(). " +
    `Running ${process.version}. Upgrade Node to run the engine selftest.`
  );
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (ASSET_RE.test(specifier)) {
      return {
        url: STUB_SCHEME + encodeURIComponent(specifier),
        format: "module",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    if (url.startsWith(STUB_SCHEME)) {
      const original = decodeURIComponent(url.slice(STUB_SCHEME.length));
      return {
        format: "module",
        shortCircuit: true,
        // Mirrors Vite: default export is the asset path string.
        source: `export default ${JSON.stringify(original)};`,
      };
    }
    return nextLoad(url, context);
  },
});
