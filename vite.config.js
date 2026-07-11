import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

export default defineConfig({
  base: '/RLSW/',
  plugins: [react()],
  // N8: build stamp for the netcode version handshake (src/net/client.js).
  // Clients on different builds are refused at the room door by the server.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
