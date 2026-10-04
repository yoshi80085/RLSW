# Bardbarian — the opening act

Run `npm run dev:intro`, or visit `/RLSW/previews/bardbarian-intro/` on the Vite server.
The `.scratch/bardbarian-intro-preview.html` entry redirects here.

This is the tunable visual preview required by the repository's preview-first
workflow. **The normal game's opening and combat rules have not been changed.**

**2026-10-04: Alex's dial-in is saved.** `alex-dial-in.json` preserves his exact
export and original changed-vs-default comparison. `timeline.js` imports its
settings as the current baseline. Fresh previews and Reset look use that look.
For Claude continuation, start at
[CLAUDE_BARDBARIAN_INTRO_HANDOFF.md](../../CLAUDE_BARDBARIAN_INTRO_HANDOFF.md).
The editable source, dependencies and assets are also packaged in
`handoffs/bardbarian-intro-2026-10-04.zip` in the repository.

## The sequence

1. The real cosmic arena appears below a colossal Bardbarian: a spectral,
   transparent contour with outstretched hands and an axe-guitar. Animated
   nebula veils and branching lightning surround him; a low thunder cue begins
   the introduction. No voice-over is invented.
2. Each real acrylic Spirit falls onto its own landing pad between the existing
   grandstand and home hex. Impact rings, fragments, a rebound and tunable
   camera shake mark the landing. They wait with zero fans.
3. Each seat's first-turn rehearsal plays the **same `playSpiritSting`** used by
   the character picker. Its full duration determines when the step begins.
   The standee turns to perform, hops onto its original starting hex and turns
   to its game facing. Exactly two fans appear on arrival.

The 4-player preset uses a second Ronin in the fourth seat, with a unique seat
identity and its own corner colour. It does not unlock unfinished Glamarchy.
Two players use opposite corners; three and four use the normal corner order.
The preview runs first-turn entrances sequentially for inspection. Normal turns
would occur between these entrances in a real match.

## Controls

Sound starts off. Enable **Sound on** and press **Play introduction** or **Replay**.
Replay, pause, skip to the first turn, scrub, jump to a chapter, or advance the
next player's first turn. Seeking does not replay crossed audio cues. Hiding the
tab pauses playback; reduced motion removes falling, hopping, shake, lightning
flashes, drifting clouds and cinematic camera travel.

Tune scale, outline strength, contour isolation, storm strength, arrival spacing,
fall height, impact size, shake, bloom, exposure and camera framing. Settings
persist at this browser address and restore both the scene and its inputs.
**Copy dial-in** shows selectable JSON before attempting clipboard copying. The
export contains the full settings, defaults and changed-from-default values.
Copy before changing address. **Reset look** restores Alex's saved 2026-10-04
dial-in. Existing browser experiments are retained until reset. **Hide controls**
expands the scene. Future exports compare against the selected baseline; the
original JSON retains the original comparison.

## Rule change recorded for the production port

Alex's requested rule is accepted: normal matches begin in protected waiting
spaces, no fans; each Spirit plays its picker riff and enters the old home hex
on its own first turn, gaining two fans. Waiting Spirits must be excluded from
all combat, area effects, occupancy and movement targets. This preview has no
combat input: its `targetable` field documents the intended entrance boundary,
and **does not prove the live engine has that protection**.

The port needs one authoritative entrance state used by the client, engine and
bot, idempotent fan grants, startup control locking, skipped/disabled intro
handling, replay/network compatibility and a mounted normal-match test covering
the four-player exploit. Testing Grounds and existing saves need explicit
compatibility. The current root note grants are not being redesigned here. A
blocked home hex on a later first turn still needs a deterministic port policy
(reserve those entrance hexes, or resolve the blocking piece); the preview has
no moves that could create that situation. Do not silently add a displacement
or delay rule. Intro geometry belongs in presentation, never in the reducer.

## Files and validation

- `bardbarian.js`: apparition material, procedural storm and lightning.
- `scene.js`: arena, standees, landing pads, impacts, crowd and camera.
- `timeline.js`: pure sequence and entrance states; production sting durations.
- `alex-dial-in.json`: exact saved user export; its settings drive the defaults.
- `audio.js`: production picker riffs and local thunder/impact synthesis.
- `main.js`, `index.html`, `style.css`: transport, tuning, persistence and export.
- `bardbarian-spectral.png`: original generated asset. [Prompt and provenance](ASSET.md).
- `preview.jpg`: first-draft browser screenshot, predating Alex's saved dial-in.

`npm run test:intro`: **98 checks**, included at the beginning of `test:all`.
Preview lint, preview esbuild and the app's `check:bundle` pass, zero warnings.
Browser: complete 4-player playback, later seats remaining at zero fans, all four
ending on two fans, 2/3-player variants, reduced motion, replay, chapter seeking,
saved controls and changed-value export; no browser warnings or errors. Audio
was exercised in the browser, but speaker balance still needs a listening pass.
The full sweep passes intro (98), vocabulary (640), cards (441), then stops at
the unrelated `clientCardJourneyCheck` assertion `enabled` (the clicked button
is disabled). Logs: `.scratch/bardbarian-full-suite.log`.
`test:arch` also finds 14 pre-existing missing entries for laser/smoke, bats and
crumbling modules; all 497 documented paths and 684 listed exports still resolve.

The external Claude Systems Map could not be updated: this session has no
Artifact read/republish tool. The canonical repository documents record the
preview status and unported rule so it is not mistaken for live gameplay.
