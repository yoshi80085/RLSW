import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

export default defineConfig(({ command }) => ({
  base: '/RLSW/',
  plugins: [react()],
  // 🎬 .m4v isn't in Vite's default asset list — needed so the opening-movie
  // video (src/rl_movie_1.m4v) can be imported like any other asset.
  assetsInclude: ['**/*.m4v'],
  // N8: build stamp for the netcode version handshake (src/net/client.js).
  // Clients on different builds are refused at the room door by the server.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // N9: production server URL. `npm run build` defaults to the deployed
    // Render service so a plain build can never ship without a server baked
    // in (the empty fallback once produced wss://<pages-host>:8787 — dead).
    // SERVER_URL env still overrides for other targets; `npm run dev` keeps
    // the LAN fallback (ws://<hostname>:8787); ?server= always wins at runtime.
    __SERVER_URL__: JSON.stringify(
      process.env.SERVER_URL ?? (command === 'build' ? 'wss://rlsw.onrender.com' : '')
    ),
  },
}))
