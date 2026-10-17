// ═══ THE GATE'S SETTINGS — the one switch ═════════════════════════════════
// 🚪 While `on` is true, a BUILT copy of the game (GitHub Pages, `vite preview`)
//    opens on a plain "502 Bad Gateway" page, and the real game is only fetched
//    after the hidden code is entered on the arrow keys / WASD / a pad's D-pad or
//    left stick. `npm run dev` never shows it.
// ✅ To go public: set `on: false` and rebuild. That is the whole removal — the
//    HTML disguise (vite.config.js, via `gateDisguise.js`) reads the same flag.
// 🔑 To change the code: `npm run gate:code -- up left down right …` rewrites
//    `codeHash` and `codeLength` below. Do not hand-edit them.
// ⚠️ Read `gateCode.js`'s header: this hides the game from a passer-by, it does
//    not protect it from anyone who looks.

export const GATE = {
  on: true,

  // The fake page. Plain on purpose: a real dead server's page is never styled.
  disguiseTitle: '502 Bad Gateway',

  // What the tab goes back to once the code is in.
  realTitle: 'rlsw-sim',
  // ⚠️ Must match the Google Fonts <link> in index.html (dev keeps it there; a
  //    build strips it so the 502 page fetches nothing). `test:gate` §5 pins them.
  fontsHref: 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Saira+Stencil+One&family=Saira:wght@400;600;700&display=swap',

  codeHash: '275uitoivss',
  codeLength: 8,

  // A pause longer than this between presses forgets the presses so far.
  gapMs: 3000,

  // Once opened, a reload in the SAME TAB goes straight to the game (a refresh
  // mid-match should not mean typing the code again). A new tab asks again.
  rememberInTab: true,
};
