// 🚪 The front door. While the gate is on (app/gateConfig.js), a BUILT copy of
// the game opens on a fake "502 Bad Gateway" page and only downloads the real
// game (boot.jsx) after the hidden code. `npm run dev` goes straight in.
// ⚠️ Keep this file tiny and keep boot.jsx behind the dynamic import — see
//    boot.jsx's header for why.
import { runGate } from './app/gate.js'

runGate(() => import('./boot.jsx'))
