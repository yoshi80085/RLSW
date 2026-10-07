# SEQUENCING §A as it stood before the opening-act port (archived 2026-10-06)

Moved here unedited when `60-openingport` became the live handoff. Index row: `59-intro` in `src/SEQUENCING.md` §C.

## 59-intro. Bardbarian opens the arena — 2026-10-04

Alex requested a larger-than-life outline of the Rock God in the nebula, arms
extended as he introduces the Spirits. Each crashes down between the fans and
its old starting hex. New rule: wait here with no fans; on the first turn play
the same picker riff, step onto the old home hex, and gain two fans. This closes
the four-player opportunity to attack a Spirit before it has taken a turn.

Built the interactive preview first, following CLAUDE.md. The real arena,
standees, crowd and picker riffs run together at `previews/bardbarian-intro/`.
The god uses an original imagegen asset filtered to spectral contours; storms,
lightning, impact rings, fragments, rebound and camera are animated in Three.js.
Two/three/four seats, reduced motion, saved controls, selectable Copy dial-in,
replay, seek and first-turn rehearsal are available. Four seats use a duplicate
Ronin with its proper corner identity, never the locked Glamarchy.

Alex subsequently supplied the complete dial-in and requested a Claude handoff.
His exact export is now `previews/bardbarian-intro/alex-dial-in.json`; its settings
are imported as the preview defaults, preserving the original comparison in
the same file. Scale 1.17, presence .24, detail .74, storm .9, fall height 24,
impact 1.35, shake .65, bloom .55; every unchanged setting is preserved too.
`CLAUDE_BARDBARIAN_INTRO_HANDOFF.md`, linked from CLAUDE.md, maps editing paths,
launch commands, assets, checks and the remaining port. The portable source and
assets snapshot is `handoffs/bardbarian-intro-2026-10-05.zip`. It is a local
handoff, not an upload or a remote Git update.

**Status: selected settings saved; preview only.** No normal-match rule or visual port yet. The accepted
waiting-space rule is in STATE_OF_PLAY; the preview README lists port coverage:
authoritative entrance state, all targeting and bot paths, exactly-once fans,
normal-match UI journey, intro skipping, saved games/network and Testing Grounds.
A later entrant's home hex must also be available; the production policy must
be explicit. Do not mistake a preview's targetable flag for engine immunity.

Checks: 98 intro assertions, lint clean, preview and app bundles clean with zero
warnings. Browser playback reaches each first turn in order: only entrants get
two fans; 2/3/4 players, reduced motion, seek/replay, persistence/export verified,
no browser errors. Fixed an effects teardown that detached its reusable root.
The original full sweep stopped at the card journey; the incoming Claude commits
fix that failure and the 14 missing architecture rows. On 2026-10-05 the combined
checkout passes intro (98), preview lint, both bundles (zero warnings), and
architecture (8 checks; 391 modules, 512 paths, 684 exports). The full sweep completes 36 suites, then
stops at Claude's documented Shadow cooldown rule invariant in `test:bushido`.
The isolated source project also passes 98 intro checks and loads Alex's exact
settings and assets in Chromium without warnings/errors. Audio cues exercised,
speaker mix not judged. The external
Claude Systems Map has no callable Artifact publishing
tool in this environment; the repository handoff records the pending port.

**2026-10-05 branch reconciliation:** local `61f50a1` and incoming `6e7238a`
diverged from `5ba5ff1` on `chore/cleanup-rockgods-tutorial`; the older Thrash
branch was already merged at `71170f7`. Completed the pending local merge,
keeping the Bardbarian handoff here and preserving the incoming `59-triage`
verbatim in `../docs/archive/SEQUENCING-2026-10-04-test-triage.md`. Both are in
the index. No remote push. The root Claude handoff explains the history.

Next: Claude can continue from the saved dial-in and editable handoff. Integrate
the presentation and accepted rule into normal matches when that work resumes.

