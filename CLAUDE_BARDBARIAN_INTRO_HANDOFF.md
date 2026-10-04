# Claude handoff — Bardbarian / The opening act

Completed 2026-10-05 (Asia/Tokyo), preserving Alex's 2026-10-04 dial-in.
Workspace: `C:\Users\ATBro\rlsw-sim`.

## Start here

If Claude has this workspace, edit `previews/bardbarian-intro/` directly. It
contains the complete editable scene and its artwork. It is outside `.scratch`
and is not Git-ignored. The original preview and selected settings are in commit
`61f50a1` (`bardbarian`). This handoff's merge and packaging updates are local;
remote Claude sessions need the resulting commits pushed or the ZIP supplied.

For Claude on another machine, provide `handoffs/bardbarian-intro-2026-10-05.zip`.
It contains an isolated `project/` with all imported local source dependencies,
the arena GLB, character PNGs, Bardbarian artwork, the full dial-in export,
run instructions and SHA-256 manifest. Extract it with its directory structure
intact. This is a preview project, not an overlay for the game's package.json.
Preparing the ZIP does not upload anything or grant a remote Claude chat access.

In this repository:

```text
npm run dev:intro
npm run test:intro
```

Use the URL Vite prints with `/RLSW/previews/bardbarian-intro/` appended. The
usual local preview URL is `http://127.0.0.1:5173/RLSW/previews/bardbarian-intro/`.

In the ZIP's isolated `project/` (Node 22.12+):

```text
npm install
npm run dev
npm test
```

## Branch history and merge — read before continuing

The working branch is `chore/cleanup-rockgods-tutorial`. Both lines below branched
from `5ba5ff1`; this was a local/remote divergence on the same branch:

- Local `61f50a1` (`bardbarian`): opening preview, saved dial-in, artwork and handoff.
- Incoming `6e7238a` (`origin/chore/cleanup-rockgods-tutorial` at inspection): twelve
  commits, starting at `d4dc474`, covering Enter-to-end-turn, image import casing,
  test triage and documentation. Author: Claude.
- The earlier `claude/optimistic-fermat-iccc1e` work through `092f129` (Thrash,
  Sonic cost/range changes) was already merged at `71170f7`, before their common
  ancestor. Do not reapply it or interpret the Bardbarian branch as missing it.

An interrupted merge was present on arrival. Its only conflicted file was
`src/SEQUENCING.md`: both sides replaced the live handoff. The resolution keeps
the Bardbarian entry in §A and preserves Claude's complete `59-triage` entry at
`docs/archive/SEQUENCING-2026-10-04-test-triage.md`, linked in §C. Both histories
are retained; the incoming gameplay/test edits are kept. Windows image filenames
were aligned with their already-tracked capitalization so Linux imports agree.

Check `git status` and `git log --graph --oneline -15` before further work. The
merge is completed locally as part of this handoff; no remote push is performed.
Use the merged branch for continuation. The ZIP is an editable scene snapshot,
not a Git checkout or a replacement for this branch's full gameplay code.

## Alex's saved dial-in — the current baseline

Alex supplied the complete JSON export and asked to make this work findable
and editable by Claude. His exact export is preserved at
`previews/bardbarian-intro/alex-dial-in.json`, including the old defaults and
the eight fields he changed. `timeline.js` imports its **settings** directly
as `DEFAULTS`; do not copy the numbers into a second competing default object.

| Setting | Selected value |
|---|---:|
| Players | 4 |
| Bardbarian scale | 1.17 |
| Outline presence | 0.24 |
| Contour isolation | 0.74 |
| Storm | 0.9 |
| Arrival stagger | 1.1 seconds |
| Fall height | 24 |
| Impact | 1.35 |
| Camera shake | 0.65 |
| Bloom | 0.55 |
| Exposure | 1.15 |
| Camera | cinematic |
| Reduced motion | false |

Fresh previews and **Reset look** use these values. Existing browser storage
can preserve a later experiment; Reset look is the way to return to Alex's
saved baseline. The operating-system reduced-motion preference still wins on
initial load. Future Copy dial-in exports compare to this selected baseline;
the original export retains the earlier default comparison as provenance.

For later visual work, tune the controls, then save a new dated dial-in before
replacing this record. Do not treat new agent experiments as Alex's selections.

## Where to edit

| File under `previews/bardbarian-intro/` | Purpose |
|---|---|
| `alex-dial-in.json` | Alex's exact selected settings and original comparison |
| `bardbarian.js` | Apparition shader, contour filtering, cloud swirl and lightning |
| `bardbarian-spectral.png` | Original generated illustration, alpha preserved |
| `ASSET.md` | Original image-generation prompt and provenance |
| `scene.js` | Real arena, standees, pads, crash effects, crowds and camera |
| `timeline.js` | Intro timing, per-seat entrance state and cue boundaries |
| `audio.js` | Exact production picker riffs, thunder/impact synthesis, audio lifecycle |
| `main.js` | Transport, tuning, storage, copy/export and reduced-motion control |
| `index.html`, `style.css` | Preview UI and layout |
| `check.mjs` | 98 timing, waiting-seat, fan-grant and replay checks |
| `README.md` | Full behavior, validation and production-port boundary |
| `preview.jpg` | Earlier first-draft screenshot; not evidence of the new dial-in |

The local imports are deliberate: `src/board/standee.js`, `arenaCrowd.js`,
`arenaEnvironment.js`, `rivenWorld/`, and `src/audio/spiritSting.js` supply the
same pieces used by the game. The original scene is not a flat movie. All of
its timing, effects, geometry and materials remain editable JavaScript.

## Intended opening and rule

The Bardbarian is a huge outline in the nebula, arms extended, introducing the
Spirits through a swirling thunderstorm. Standees crash down between the fans
and each original starting hex. Spirits wait there with no fans. On each
Spirit's first turn, it plays its existing picker riff, steps onto its original
home hex, and gains exactly two fans. The purpose is to prevent players who
have already built Drive/Sustain from attacking someone who has not started.

The preview supports 2/3/4 seats. Four players use a duplicate Ronin with a
unique corner seat ID; do not unlock unfinished Glamarchy to fill that slot.
It rehearses entrances consecutively; actual gameplay occurs between first
turns in normal matches.

**Current status: selected visual settings saved; still a preview.** This
handoff request does not itself port the cinematic or rules into the game.
No Game/reducer/bot imports this preview, and its `targetable` flag is not live
combat protection. The earlier README's production checklist remains required:
one authoritative entrance state, all targeting/area-effect/occupancy paths,
bot parity, exactly-once fans, skip/reduced-motion paths, replay/network/save
compatibility, and Testing Grounds. Resolve occupied home hexes explicitly;
do not invent a displacement or delay rule. Verify the four-player exploit in
a mounted normal match. Preserve unrelated uncommitted work in this workspace.

## Validation and packaging

Verified on the combined checkout, 2026-10-05:

- `npm run test:intro`: 98 checks; the copied isolated project also passes all 98.
- Preview lint, preview bundle and full application bundle: clean, zero warnings.
- `test:arch`: 8 checks, all 391 modules / 512 paths / 684 exports accounted for.
- Packaged preview in Chromium: exact selected controls and rendered arena,
  Bardbarian and assets; no browser warnings or errors. The first version also
  exercised full entrance playback, 2/3/4 seats, seeking, replay and storage.
- `test:all` now includes 90 suites. It completes 36 suites, including the formerly failing card journey,
  then stops at the documented `test:bushido` Shadow cooldown invariant: cooldown
  2 does not outlast duration 2. This rule decision was already flagged by Claude;
  no cooldown or duration was changed here. Log: `.scratch/bardbarian-merge-full-suite.log`.

The earlier card-journey failure and missing architecture rows were fixed by the
incoming commits. Do not treat that old preview report as the merged branch's
current status. Speaker balance still needs a listening pass; later full-sweep
suites were not reached in this run. The archive preserves Claude's broader
test-triage report, including preview files missing from fresh clones.

To regenerate the source snapshot after edits:

```text
node scripts/package-bardbarian-handoff.mjs --out=handoffs/bardbarian-intro-NEW-DATE
```

Then archive the contents of its output folder into a **new** ZIP, or explicitly
refresh the existing handoff ZIP. `manifest.json` identifies every copied source
and its SHA-256 checksum. The snapshot will not automatically follow live edits.
The external Claude Systems Map was not republished; this environment has no
Artifact publishing tool. `CLAUDE.md`, `STATE_OF_PLAY.md`, `SEQUENCING.md` and
`ARCHITECTURE.md` point to these repository files.
