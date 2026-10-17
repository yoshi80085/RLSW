// 🎸 The real game's mount — what main.jsx used to do directly.
// ⚠️ Only ever reached through `import('./boot.jsx')` in main.jsx, so that a
//    gated build (app/gate.js) does not download React, the game or its art
//    until the code is in. A STATIC import of this file — or of App.jsx, react,
//    or index.css — from main.jsx would put the whole game back on the fake
//    502 page's download list. `test:gate` §6 guards that.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
