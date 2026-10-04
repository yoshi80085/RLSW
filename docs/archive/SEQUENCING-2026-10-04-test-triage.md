# Archived test-triage handoff

Preserved verbatim from the incoming merge while completing the Bardbarian handoff, 2026-10-05.

## 59-triage. 🧪 The 21 red suites — brought up to the code, four left with owners — 2026-10-04

Alex: *"Triage the 21 red suites in test:all."* The standee import-case fix
(`f98c35a`) let the esbuild suites run on Linux for the first time in weeks,
and 21 of the 89 in `test:all` were red. Each was read against the CLIENT
before anything moved (§B2): almost all were a test written before a rule
changed, not a code fault.

**What the tests had not caught up with** (one commit per group, all on
`chore/cleanup-rockgods-tutorial`):
- 🤘 **The Thrash is the clash.** `attackRolled` stamps every Swing/Sonic v2 since
  2026-09-20, so `selftest`'s Phase 3b now guards the *legacy* (un-versioned)
  replay path on purpose; `attackParams`' old single-die tower is unreachable,
  so `test:transition` §6–7 test the shared rig; both sides pay (2 / 1, off the
  TOP) win or lose; a Thrash squares the fighters up (`test:slime`'s Tentacle);
  a Thrash never consumes Smash exposure (Sonic and Bushido do).
- 🔊 **No rig radius** (`rigRadius` is 0 since the vocabularies): `inRig` means the
  amp is not blown — `test:eval` §8, the riff-off's stranded case, `test:eleven` §4.
- 🎲 **Dice are the Drive dial**; Goes to 11 is the Eleven die swapped for the
  weakest, always kept (`test:eleven` §3); the beam is hexes 2–3, so the riff-off
  fixture stands two apart.
- 🪦 **Cuts**: Sunbeam and Azrael (both left `battleConsequences` on 2026-09-22);
  Db (no ability is priced in it — `test:b0`); the 2D board (no 3D/2D switch —
  `test:journey`); the old timed Shamisen curse (the journey takes the Iwato
  Shamisen up); Pickles' tip overlay (`test:crowdbubble`); the archived 2D battle
  overlay (`test:battlejourney` drives the 3D clash and keeps the aftermath).
- 📏 The chord table's 1–5 rebase is asserted THROUGH the rebase (`test:b0`), and it
  ties dom9 with dom7 in total power — recorded, not tuned (§B10).
- 🧩 Six source-reading checks pinned a line's exact shape (`moving=` chain, a
  200-char window, `markSolid`'s list, the Island) and now assert membership.
- 🗑️ **Deleted `spendDriveStack`** (transition.js): only `test:bushido` called it, it
  still took from the FRONT, and §6 compared it to a hand-written front slice —
  green for weeks against a rule the game dropped on 2026-09-27. §6 now reads
  `bushidoDrawPatch` against `attackParams`' real Thrash plan.
- 🗺️ `ARCHITECTURE.md` gained rows for 14 stage-effect modules (lasers, smoke, bats,
  crumbling); `test:arch` is green. CLAUDE.md's "twenty-six suites" is 89.

**⛔ LEFT RED, ON PURPOSE — each needs Alex, not a test edit:**
1. ⁉️ `test:bushido` — **the Shadow cooldown (2) no longer outlasts the double (2
   turns)**, so it can be kept up rather than spent. Flattening every CD to 2 at
   the Db cut did it. Which number moves is a rule.
2. 📂 `test:shukuchiui`, `test:standeemove`, `test:dice` read `.scratch/` preview
   files that were **never committed** (`shukuchi-hop-preview.html`,
   `standee-move-preview.js`, `sonic-rework/barrage.{mjs,html}`). Commit them from
   Alex's machine and they run anywhere; making them skip would hide the port check.

**⁉️ To confirm:** Sunbeam and Azrael went inside a commit titled "3D arena edits".
The kits agree they are gone; the suites now assert it. If that was an accident,
those two sections are where to start the revival.

🎯 **Next:** Alex's two calls above; then `test:all` runs end to end.
