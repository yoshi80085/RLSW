# Swing clash prototype

Swing runs inside the 3D board. Two procedural stick figures replace the standees temporarily: instrument overhead while dice roll, then instrument forward at the shared contact point. Both face each other. Floor dice use the Sonic presentation, with both rows labelled Drive. Each Drive cabinet charges its owner's instrument; glow and shake build before the climax. Normal standees return for the shove.

Both sides roll their current Drive pool and sum every die. Sustain, posing, and rear-facing defence do not modify a clash. The lower total takes the full difference as Vibe damage and a one-hex push, subject to existing occupied-space, edge, hazard, and knockback-immunity rules. Ties cause neither damage nor push. The winner spends two Drive notes and earns the existing Thrash fame reward. Old serialized actions without `swingVersion: 2` retain the old verdict path.

All knockback now carries a presentation counter. Wobble increases as remaining Vibe decreases; ordinary movement does not trigger it. Only zero Vibe causes a fall. Existing life, home respawn, fan demolition, elimination, and fame-loss rules remain. Surviving Spirits stay prone until their own next turn, then pay two stock notes after refill. If fewer are available, the remaining note cost carries forward. Clearing the melody does not refund recovery notes.

Checks: `src/engine/swingClashCheck.mjs` covers totals, both winners, ties, push, Sustain exclusion, facing, rerolls, deterministic rolls, falling, recovery, and wobble. `src/engine/clientSwingJourneyCheck.jsx` mounts the game and verifies the board presentation and consequence timing. `swing-preview.html` is a standalone motion study served by Vite; it uses the same figure and charging implementation.

The older general selftest and transition assertions still encode retired Swing/Sonic rules and need a separate fixture migration. The targeted clash, existing battle-flow, turn-flow, Sonic barrage, floor dice, camera, and determinism checks are the current verification set for this prototype.
