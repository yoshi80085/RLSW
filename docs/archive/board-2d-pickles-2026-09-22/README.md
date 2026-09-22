# Archived 2D board and Pickles introduction — 2026-09-22

At Alex's request, the playable presentation is now always the 3D arena. The 2D/3D switches and the 2D Stage skin setting are removed from the active interface. The old skin value in browser localStorage is left untouched, so it can be recovered if this presentation returns. The SVG target/click surface remains shared infrastructure for the 3D arena; it must not be deleted. Dormant flat-board branches and manual pan/zoom helpers remain in the simulator to avoid disturbing that infrastructure. This is retirement from active play, not a complete code extraction.

Pickles' introduction, beginner popups, and Beginner controls are disabled, including for old match configurations with beginnerMode=true. The introductory text, event triggers, and character components remain dormant pending a redesigned structure. The independent Fan hints option remains available and defaults on. Beginner-only stock assistance is also inactive along with its tutorial.

source.zip preserves the pre-change simulator (including the complete inline board, settings, tutorial text and triggers), Lobby, BoardViewport, MatchSurface, BeginnerTipOverlay, Pickles, stageSkins, global CSS and board/outline art. Files use their original basenames inside the archive; restore them to their corresponding src locations only after comparing with current code. This is a reference snapshot, not a standalone game or a browser-storage export. Do not overwrite the current simulator wholesale: it includes unrelated in-progress gameplay changes.

Graphics startup failures now offer Retry arena. There is no 2D fallback; WebGL is required for the supported presentation. Retry preserves match state and the targeting DOM.

Swing/Sonic fixture migration is separate work. A fixture is a prepared test game state with expected outcomes. Older general engine/transition tests still expect superseded combat behavior. Update these expectations to the approved current rules while retaining explicit coverage for legacy replay actions. Do not change current gameplay merely to satisfy old expectations, or delete failing assertions without replacement. See src/SWING_CLASH_DESIGN.md.

Verification: client reference checks (6), client render checks (13), bundle check (zero warnings), actual WebGL failure/retry and HUD mounting checks passed. Vite production build passed with chunk-size and mixed static/dynamic import warnings. No deployment was performed; the general Swing/Sonic test fixture migration remains separate.
