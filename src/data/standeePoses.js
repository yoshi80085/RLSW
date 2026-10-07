// 🎭 STANDEE POSES — the extra prints a Spirit's standee can swap to.
//
// Alex, 2026-10-06: "I've replaced Cosmic_Ronin standee in the files - and with
// it, the 2 Thrash phases (instrument over head + 'clash' (Thrash1 and
// Thrash2), as well as a 'hit' picture … phase 1 of Thrash is Thrash1, phase 2
// is Thrash2, and whenever Ronin gets hit back (loses a bout), use the 'hit'
// picture for the standee."
//
//   thrash1 — the Thrash's raise: the shamisen over his head (the stick
//             figure's 'ready', Figure 1)                  → swingStandee.js
//   thrash2 — the Thrash's clash (the stick figure's 'strike', Figure 2)
//   hit     — thrown back: a Thrash or tie he loses, and any shove that moves
//             him (`hitBackCount`)                         → arenaVisuals.js
//
// 📌 A SEPARATE FILE, NOT A FIELD ON `SPIRIT_DEFS` — same reason as
// `spiritStories.js`: a SPIRIT_DEFS entry is copied into every match and rides
// the netcode snapshots; three image URLs for the 3D board have no business there.
//
// ⚠️ The PNGs are GENERATED — `python scripts/standee-art.py --splice` keys the
// white masters in `src/standees/source/` to transparency, crops them to the
// figure, and traces each one's cut into `board/standeeOutlines.js` (`poses`).
// A pose with art here but no traced cut is ignored by the standee.
// ⚠️ `new URL(…, import.meta.url)`, NOT `import art from '…png'` — the same call
// as `board/bardbarian.js`: Vite bundles both, but a static PNG import breaks
// every headless suite that loads the arena under plain Node or a loader-less
// esbuild (test:arena, test:sonicfx). Keep each URL a LITERAL in the call, or
// Vite cannot see it to bundle it.
import { characterId } from "./spiritIdentity.js";

export const STANDEE_POSE_ART = Object.freeze({
  cosmic_ronin: Object.freeze({
    thrash1:new URL('../standees/Cosmic_Ronin_Thrash1.png', import.meta.url).href,
    thrash2:new URL('../standees/Cosmic_Ronin_Thrash2.png', import.meta.url).href,
    hit:new URL('../standees/Cosmic_Ronin_hit.png', import.meta.url).href,
  }),
});

/** The pose prints for a Spirit (any seat id), or null. */
export const posesFor = id => STANDEE_POSE_ART[characterId(id)] ?? null;
