# Claude handoff — Bats + Crumbling Stage

**Revolving Stage is now available separately:** read
[CLAUDE_REVOLVING_STAGE_HANDOFF.md](CLAUDE_REVOLVING_STAGE_HANDOFF.md).
Its current fitted mechanism, earlier comparison, source dependencies, character
art and browser-ready preview are in `handoffs/revolving-stage-2026-10-03.zip`.
The older Bat + Crumbling ZIP described below remains its original snapshot.

Prepared 2026-10-03 (Asia/Tokyo) for Alex. Project: `C:\Users\ATBro\rlsw-sim`.
Base Git commit: `b25813170b217cc5cfe6b1d97a8f9a8892995644`.

## The request

Continue the **Bat Stage Effect graphics** and the **Crumbling Stage graphics**
from the builds already here. Alex asked for the bats to get the graphics they
deserve and for ideas beyond the bat chase, then asked to make both builds
accessible to Claude to continue. No visual dial-in or live integration was
approved in this conversation. Do not mistake the agent's QA settings for Alex's
choices.

**Alex's latest instruction: KEEP BOTH BAT ASSETS.** He likes the previously
created Sol 6.1 bat's charm. Preserve the original `src/board/batStage.js` model
AND the new `.scratch/stage-bats/batShow.js` model. Do not overwrite or delete
either. The original remains the live renderer and can be viewed through the
study's Compare current bat toggle. If integrating later, keep both available
as selectable visual styles; a full-scene style selector is not implemented yet.

Read `CLAUDE.md`, `src/STATE_OF_PLAY.md` and `src/SEQUENCING.md` first. The local
preview-first workflow applies. Preserve all pre-existing uncommitted work.

## Start here — runnable files

Run from the project root:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175
```

A server was left running on port 5175 at handoff. Reuse it if it still responds;
otherwise start the command above. These links work only on this computer:

- Bats: http://127.0.0.1:5175/RLSW/.scratch/stage-bats/
- Crumbling: http://127.0.0.1:5175/RLSW/.scratch/crumbling-stage/

| Build | Entry point | Core visual source | Notes / evidence |
|---|---|---|---|
| Bats / Night Flight | `.scratch/stage-bats/index.html` | `batShow.js`, `preview.js`, `style.css` in that folder | `README.md`, `preview-desktop.png` |
| Crumbling Stage | `.scratch/crumbling-stage/index.html` | `stage.js`, `preview.js`, `style.css` in that folder | `README.md`, `preview-desktop.jpg`; `original.html` + `original.js` preserve its original study |

**Both preview folders are Git-ignored. A Git diff alone does not transfer them.**
They have been copied explicitly into the handoff ZIP. The combined source
Markdown is also suitable to attach to a Claude conversation for source review.

## Bats — state of the work

Live rules and a simple renderer already existed before this graphics pass:
`src/engine/systems/bats.js`, `src/board/batRules.js`,
`src/board/batStage.js`, and `src/ui/StageFXLayer.jsx`.

- Four bats; a step every 30 seconds. Target priority: greatest FP, then longest
  turn timing, then nearest Spirit. Read the actual target function for ties.
- A Spirit entering a bat's hex gains 2 fans. A bat reaching a Spirit deals
  1 Vibe. Both collisions respawn the bat.
- Bat occupied-hex markers are already pinned to rule positions while the
  original flying prop interpolates. Preserve this clarity in any port.
- `stageFx.lastBats` contains `hits`, `eaten`, and `moves`; the bat carries `key`,
  `num`, `targetId`, and `flight`. Use these for real choreography later.

**The new build is a presentation study, not a chase/rules simulator.** It uses
the actual Cosmic Arena GLB, arena lighting and Ronin acrylic standee. Procedural
bats have scalloped wine-red membranes, articulated shoulder/wrist wings, curved
finger bones, dark bodies, inner ears, luminous eyes and fangs.

An 18-second timeline stages: swarm entrance → hover/sonar → bite/recoil →
catch/gold fan reward → spiral exit. It compresses game timing and uses fixed
fixture positions. The new choreography is NOT wired into the live renderer.
No audio was built in this pass.

Controls: seven sliders, three presets, three camera views, five toggles,
pause/seek/half-speed, current-model comparison and Copy dial-in. Settings save
under `rlsw.bats.look.v1:<pathname>`; copied JSON separates changed from untouched
defaults. Copying values is necessary when moving to a different browser or host.

Suggested extension discussed: **amp roosts**, flushed by an owner's melody.
This is an agent proposal, NOT an agreed rule. Entrance, sonar, bite/catch and
exit are visual options already demonstrated; do not add new balance mechanics
without a decision. Further art polish, camera scrutiny, reduced-motion visual
review and actual-event integration remain possible next steps.

## Crumbling Stage — state of the work

This build was already present and was preserved as found. Its README is the
source for the earlier visual verification. Unlike the bat film, this preview
uses the real reducers and seeded game state.

- Four new holes per show round: 4 → 8 → 12; the stage repairs when the show ends.
- Collapse excludes occupied spaces, current amps, starting homes and Limelight.
- Entering a hole via movement/shove/warp removes the Spirit from the board,
  loses 10% whole FP rounded UP, and returns it to its starting hex next own turn.
- `abyssPending`, `stageFx.crumbling`, and `stageFx.lastAbyss` are the integration
  points. Existing respawn restores max Vibe. Inspect the code before changing it.
- Engine source: `src/engine/systems/crumbling.js`; tests:
  `src/engine/crumblingCheck.mjs`. Wiring touches reducers, turns, combat,
  battleFlow and stageFx. These changes predated this bat graphics conversation.
- It is deliberately excluded from `STAGE_FX_IDS` until a live board
  presentation is approved. Do not enable invisible holes in matches.

Its visual study has stone/metal slabs, fractured collars and shafts, procedural
nebula, debris, acrylic standees, shove/fall/return animation, camera presets,
orbit/zoom, bloom, reduced motion, persistence and dial-in export.

Settings are stored under `rlsw-crumbling-stage-v2`. The staged Wildaxe/Vera
fixtures use Ronin/Monster art. `original.html` preserves the earlier 2D version.

## Verification and limitations

- Re-ran bats engine checks here: **179 assertions passed**.
- Re-ran crumbling engine checks here: **344 assertions passed**.
- App bundle check: **passed, zero warnings** (media stubbed).
- New bat preview syntax checks passed. Browser rendered the actual arena;
  inspected stalking and bite, verified catch reward, current-model comparison,
  preset changes, changed/default export, and reload persistence. Browser logs
  had no errors or warnings at the check. Screenshot in the bat folder.
- Crumbling README records prior browser checks: 4 → 8 → 12 → 0 holes,
  Fame 23 → 20 on a shove, next-own-turn return to #105 at 10/10 Vibe, controls
  and persistence. This handoff independently reran its engine checks, not all
  those earlier browser scenarios.
- Full-suite rerun passed vocab (640), cards (441), card journey (14), marquee
  markers (50), and marquee journey (14), then stopped at the already documented
  combat assertion at `src/engine/selftest.mjs:457`
  (`atkTotal = stat + roll`, actual 4 vs expected 11). The exact output is in
  `.scratch/stage-bats/full-suite.log`; do not call the whole
  project green merely because these two engine suites pass.
- Plain `npm` resolved to a broken roaming npm install in this environment.
  Direct `node` works. For npm commands use `C:\Program Files\nodejs\npm.cmd`
  and put that directory first in the process PATH. Restricted execution also
  blocked esbuild from resolving the parent directory; the approved unrestricted
  bundle check passed. Do not treat those environment errors as code regressions.

## Transfer package

`handoffs/stage-effects-2026-10-03/` contains:

- this handoff and `CLAUDE_STAGE_EFFECTS_SOURCE.md` (readable preview source bundle);
- `files/` with both complete preview folders plus full snapshots of all
  currently changed/untracked project source files;
- `working-tree.patch` for the tracked changes and `git-status.txt`;
- `manifest.json` with original paths, byte sizes and SHA-256 hashes.

`handoffs/stage-effects-2026-10-03.zip` is the same package zipped.
The ZIP is an **overlay for this repository**, not a standalone installed game:
it excludes `node_modules`, `.git`, unrelated assets and credentials. On a
different computer, use a checkout at the recorded base commit with the normal
repository assets and dependencies. Compare and merge the `files/` overlay
carefully; do not both copy source snapshots and blindly apply the same patch.

In this existing workspace no import/copy step is necessary: work directly in
the original `.scratch` folders and `src` files. The package is a snapshot and
will not automatically follow later changes.

## Suggested first Claude prompt

> Read CLAUDE_STAGE_EFFECTS_HANDOFF.md in C:\Users\ATBro\rlsw-sim, then continue
> the Bat Stage Effect and Crumbling Stage from the existing preview builds.
> Preserve the current uncommitted changes and gameplay rules. Review both
> previews and continue their graphics and customization before live integration.
> Keep BOTH bat models: Alex likes Sol 6.1's original bat as well as the new one.
> The handoff names all source files, previews, tests, and outstanding decisions.

In plain terms: both effects' working parts and visual studies are available.
Continue from them; the new looks have not yet been approved for live matches.
