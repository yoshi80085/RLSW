# Archived phone play — 2026-09-29

Alex, the same day it shipped: *"lets totally archive the whole mobile device play — I don't think it needs to be built out now and I'm afraid it will just waste tokens trying to build out whatever and having to worry about how it ports to mobile."*

🎯 **What that means for the next session:** phones are not a target. Do not design for them, do not check a change on a phone viewport, do not port anything from this folder unless Alex asks for phones again.

## What is in here

- `phoneLayout.js` — `PHONE_HUD`, `PHONE_CSS`, `usePhoneLayout`: the sideways-phone re-dock (arena full screen, SPIRIT/SOUND rail, 230 px tap column, wheel under the rail, ✓ Commit pinned, the "turn your phone sideways" prompt). Moved here unedited from `src/ui/phoneLayout.js`; it was mounted by `ui/MatchSurface.jsx`.
- The preview it was dialled from is still in `.scratch/` (untracked, 6 MB): `.scratch/mobile-hud-preview.html` and its sources in `.scratch/mobile-hud/`. The published "Phone Match Dial-in" artifact is untouched.
- The full account: `src/SEQUENCING.md` §C row **42-phone**, and the project doc `claude/phone-match-handoff.md`.

## What was deliberately KEPT in the live game

- 🐛 **The white-screen fix** (`app/RLSWSimulator.jsx`: the phone tint's CSS `filter` sits on `<html>`, not on a wrapper). Without it every screen collapses to 0 px on any phone. It costs nothing on desktop.
- `index.html` `viewport-fit=cover` — inert on desktop.
- `ui/GlobalCursor.jsx` drawing nothing without `(any-hover: hover)` — a touch-only screen has no pointer to draw.
- The `match-commit-row` className on the ✓ Commit row in the monolith — inert without the phone CSS, kept so restoring needs no monolith edit.

So a phone still *loads* the game; it gets the desktop layout (the panels fill the screen and the page scrolls, as measured before the phone pass).

## To restore

1. `mv docs/archive/phone-play-2026-09-29/phoneLayout.js src/ui/`
2. In `ui/MatchSurface.jsx`: `import { PHONE_CSS, usePhoneLayout } from './phoneLayout.js';`, call `usePhoneLayout();` in `MatchSurface`, style with `SURFACE_CSS + PHONE_CSS`, and put back the rotate prompt as the first child of `.match-surface`:
   `<div className="match-rotate" role="alert"><b aria-hidden="true">📱</b>Turn your phone sideways<small>the arena needs the long side of the screen</small></div>`
3. Give it its `ARCHITECTURE.md` row again (`test:arch` will insist) and its "where do I change X?" row.
4. Compare with the current HUD first — the panels it re-docks will have moved on since 2026-09-29.
