# Audit refactor verification — 2026-09-05

Work was performed in the current local project after a successful create/read/
delete write probe. Existing uncommitted work was retained. The starting diff and
client source were saved under `.scratch/refactor-baseline` for local comparison;
no stash, reset or checkout was used.

## Completed stages

1. Restored Windows esbuild using the existing lockfile's optional platform
   dependency. The system npm launcher points at a missing roaming installation;
   verification used `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"`.
   Added jsdom as a locked development dependency for real DOM interaction tests.
   Replaced the Unix `/dev/null` bundle command with a portable, in-memory,
   media-stubbed check. SSR now exits after its synchronous assertions, because
   bundled React scheduler handles otherwise kept the Windows process alive.
2. Added a client journey that clicks through a three-note melody, commit,
   movement phase, end turn, and the next player's melody and commit. It passed
   before and after extraction. DOM interaction is real; audio and Web Animations
   rendering are stubbed. Seed 4242, human seats, beginner tips disabled.
3. Moved the app shell and seeded crowd drawing into separate modules. Static
   routing/imports, markup, timers and network-return behavior are retained.
4. Extracted Bushido's lane geometry and pre-Swing payment patch. All three
   callers share the walk, and client/headless execution share the payment.
   Existing warp/AP/patch/log/Swing order and caller-specific gates remain intact.

## Verification results

- `test:all`: all 27 top-level groups pass, including the added journey.
- Bushido: 82 existing + 9 new = 91 assertions; no existing assertions removed.
- Legal 581; eval 156; transition 257; turnflow 73; determinism 20; battleflow 65;
  winconditions 79; stackslots 115; melody 163; slime 127; eleven 38; score 122;
  harness 1,530; riff parity 127,598; skilltree 147; shamisen 34; Shukuchi 68;
  overlay 80; client references 6 across 52 JSX files; render 8; trace 1,205;
  architecture 8. Engine and b0 pass. All five riff constituent suites pass;
  their reported 253,506 and 70,970 totals are not a combined suite total.
- `check:bundle`: passes, zero warnings.
- `lint:baseline`: 334 errors, 16 warnings, zero increased rule/severity categories.
  Baseline covers src/server and is stored in `docs/lint-baseline.json`.
  This ceiling does not prove that an equal count contains identical violations.
- Production build succeeds in 1.06 seconds. Main JS: 1,248.38 kB, gzip 404.31 kB.
  Vite still reports its large-chunk warning. This is a fresh size measurement,
  not evidence of improved runtime performance.

## Explicit remaining stages

Bushido's occupancy policies already differ: the client resolver ignores bodies,
the highlight stops at live spirits, and the bot also stops at amps/decoys. The
helper preserves each policy. Resolving that disagreement would change gameplay.
Its eligibility gates also remain at callers; this is a geometry/payment pilot,
not a completed unified ability operation.

Before moving battle, ability activation, network, bot scheduling or turn-timer
orchestration, extend the DOM journeys to representative abilities and a completed
battle, and add replay/reconnect coverage for networking. Migrate subsequent
abilities individually, then retire compatibility setters only when their callers
are gone. Browser profiling of crowded boards, bot audit on/off, loading requests
and long-session memory remains to be done. No runtime optimization is claimed.
