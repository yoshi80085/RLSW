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
5. Added a completed client battle journey. It enters the action rail, targets a
   legal Swing, advances both dice through the real battle overlay, closes the
   result, and verifies the deterministic Vibe consequence plus the spent Action
   Token. The current immersive-HUD cursor styling now falls back to `/` when
   these Node-bundled checks do not provide Vite's `BASE_URL`.
6. Extended the immersive client journey through an actual Shukuchi activation.
   It arms the ability after the Bushido presentation check, selects a legal
   ring-two landing, and verifies position, origin, movement marker and the
   shared one-AP spend. The order intentionally retains three AP for Bushido's
   own targeting precondition before the hop consumes one.
7. Extended that same journey through Shadow Illusion. The fixture gives Ronin
   its required Sustain, invokes the live rail control after a Shukuchi landing,
   and verifies that the decoy begins stacked on Ronin with duration and an
   independent movement budget. The active control must show that duration.
8. Extended the journey through Cursed Shamisen activation and its live debt
   control. It verifies the timed curse begins unpaid, then that paying the debt
   updates authoritative state and the control's confirmation mark. The existing
   headless Shamisen suite continues to cover later-round cooldown and penalty
   behavior.
9. Added a mounted-client CATCH_UP journey. A network fixture supplies an
   authoritative action log after the game has mounted; the client rebuilds its
   live state from that log and must not relay historical actions back to the
   server. Engine-level snapshot/replay proofs remain the broader determinism
   coverage; this is the missing UI integration boundary.
10. Extended the mounted network journey through local socket loss/recovery and
    ROOM_STATE presence updates. It verifies the reconnecting banner appears and
    clears for the local seat, while a rival disconnect/reconnect appears and
    clears independently. Together with CATCH_UP, this covers the intended
    reconnect path at the client boundary.

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
orchestration, migrate subsequent abilities individually and retire compatibility
setters only when their callers are gone. Browser profiling of crowded boards,
bot audit on/off, loading requests and long-session memory remains to be done.
No runtime optimization is claimed.
