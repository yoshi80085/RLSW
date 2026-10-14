# SEQUENCING §A — archived 2026-10-14, before `70-controller`

> Moved here unedited when `70-controller` became the live handoff. Index rows: `SEQUENCING.md` §C.

## 69-sonicpoints. 🔊 The Sonic pays on points through the shield + 🛡️ a held shield pays + 🔮 the Lost Chords become energy balls — 2026-10-13

**Alex** (2026-10-11, the Tune of DOOM design talk): *"Something wrong with the Vibe damage for Sonic attacks. It shouldn't be as high as Thrash - but it should be a bit higher perhaps"*; *"this should move to points as well. It should reward more FP per win than Thrash"*; *"winning after* being *attacked should win some FP"*. Spec: project doc `claude/sonic-vibe-fame-rework-spec.md`. Then 2026-10-13: *"Sonic Fame - no more 'max' FP gain. Shield held - 1 FP + whatever fan bonus exists. (fan bonus should basically exist in all facets of FP gain. keep crystal hum and shatter - Ok"* — and a minute later, *"perhaps you mean 'per attack' the base limit being '5' - maybe thats a good idea afterall"*. Built with the cap on the BASE.

### What shipped — the Sonic
- `data/gameConstants.js`: `SONIC_VIBE_CAP` 2 → 3; new `SONIC_VIBE_PER_STRENGTH` 4, `SONIC_FAME_PER_STRENGTH` 3, `SONIC_FAME_CAP` 5, `SHIELD_HELD_FP` 1.
- `engine/systems/combat.js`: `sonicVibe(through)` = ceil(through/4) ≤ 3; `sonicStrengthFame(through)` = 1 + ceil(through/3) ≤ 5. `resolveVolley` (first throw, Code Injection reroll, marquee-card re-throw — every staged path) sets `damage: sonicVibe(strengthThrough)`. Bushido's `bushidoDamage` override still wins. The legacy `sonicDamage` / `sonicVolleyFame` / `sonicFame` are untouched, so a v1 replay re-scores the same.
- `engine/systems/battleFlow.js`: `awardSonicFame` takes `strengthThrough` and prefers it — ⚠️ a staged battle ALSO carries `hitCount`, so the order is load-bearing (a mutant that flips it is caught). `battleConsequences` passes it on `sonicVersion === 2`. New `awardShieldHeldFame`: in the `hitCount <= 0` branch, staged only, 1 FP through `grantFame` (so × crowd), no other riders.
- Client: the scene's `sonicFame` is `sonicStrengthFame(strengthThrough)` (`initiateSonicAttack` and the card re-throw); `ui/BattleMeterOverlay.jsx` shows it; the tutorial's two Fame lines and the Sonic tooltip state the new numbers (the tooltip also lost a stale "one hex per ring" line).
- 🎤 **"Fan bonus in all facets of FP gain" was already true**: every positive grant, engine and client, goes through `grantFame` with `amplify` on; the only opt-out is the 🧪 dev test grant. `test:sonic` §R9 now reads the source and fails if a payout skips the crowd.

### What shipped — the energy balls
- `board/lostChords.js`: `LOST_CHORD_STYLE = 'orb'`; `createLostChordLayer({ style })` passes it to place / spawn / scatter. Under `driftStyle:'rise'` the layer queues the SPAWN sound at 40% of `driftMs` instead of the drift whoosh (as the dial-in page does). Every sound is the crystal's (Alex). Back to crystals = one word.
- Docs: `ARCHITECTURE.md` rows, `arenaVisuals.js` comment, `STATE_OF_PLAY.md`, project doc `claude/lost-chord-energy-balls-preview-handoff.md`. `PROJECTILE_COMBAT_DESIGN.md` gained a "superseded in part" banner over its dice-through payout tables.

### Calls I made (on the Systems Map board)
- A shield that breaks on EXACTLY its last point (0 through) pays the defender: nothing reached them.
- Held-shield pay is the crowd only — no Headliner / stage / underdog (Alex named the crowd).
- A Bushido draw a shield holds pays the same.

### Evidence
- `test:sonic` **174** (was 129): §R1 Vibe table, §R2 Fame table + always > Thrash, §R3 legacy tables unchanged, §R4 2-dice-9-through vs 5-dice-3-through, §R5 the crowd rides past the cap (base 5 × a 5-diehard crowd = 15), §R6 held shield (crowd only, no 👑, exact break pays, broken shield doesn't, v1 never), §R7 Bushido held / landed, §R8 reroll recompute, §R9 the crowd guard. Three old assertions moved with the rule (10 through → 3 Vibe; 15 → the cap of 3; the defender is now paid for a block). **8/8 mutants caught** (both divisors, both caps, the +1 base, the held-shield branch, points-first precedence, the Vibe call).
- `test:lostchords` **115** (was 103; §9 new).
- **Full sweep, cloud, every `test:all` suite one by one, before (this tree minus the Sonic change) and after: 97 suites, 91 green on BOTH, the same 6 red with the same first failure.** Four of the six only lack `.scratch` files the cloud copy doesn't carry — `test:lostchords` 115, `test:pyroshove` 116,482, `test:standeemove` 318 and `test:dice` all pass on Alex's machine. The two real reds predate this: `test:bushido` (the 👤 Shadow cooldown call, deliberate since 2026-10-04) and `test:swing` (`swingClashCheck.mjs:58` still expects a knocked-down Spirit to stay `fallen`, which the 2026-10-07 knockdown ruling removed — stale, not fixed here).
- `check:bundle` zero warnings; `test:arch`, `test:client`, `test:sonicjourney`, `test:cursedshamisen`, `test:shamisen` green.
- 🧰 Same as before: the device's `node_modules` holds the Windows esbuild, so bundling suites ran in the cloud copy (`npm install`, not `npm ci`: the lock file has react 19.2.5 against package.json's 19.3.0).

### Next
- ⏳ Alex: fire a big and a small Sonic, hold a shield, look at the balls on High.
- Then **Tune of DOOM** (project doc `claude/tune-of-doom-spec.md`): every rule ruled; next is its preview.
- Bot bench not re-run since the payouts moved — record, don't rebalance.
- Nothing committed. Backups of the pre-change files: `.scratch/_backup-sonic-rework/`, `.scratch/lostChords.before-orb-port.js`.

### ➕ Same evening: ⚖️ four rulings, one built (2026-10-13)
Alex: *"1. shadow's cooldown - for now its cool down begins after the previous 'shadow' has been exhausted. It lasts as long as everything else. 2. Sunbeam and Azrael are cut. 3. Db is gone (for now - will find a place later when difficulty settings are being built out) - In beginner mode - the default for now - there is no Db. Tune of DOOM can stay as a write up for now - I'll get to that once I start making broader changes to I0."*
- **Built:** `engine/systems/cooldowns.js` `HELD_WHILE_LIVE` — `tickCooldowns` holds `shadow_illusion` while `ns.shadowIllusion` stands. ⚠️ It reads the sheet BEFORE this turn's double tick (`turnFlow.js` passes the old `ns`), so the turn a double times out counts as its "fire": cast t0 → falls t2 → ready t4. A double dismissed mid-round (hit, attack) starts its clock at once. Card text in `data/skillTree.js`.
- `test:bushido` §7: the deliberate red is replaced by the real tick (holds, others tick, the turn walk, a source check) → **106 green**; the revert mutant is caught. Green: `test:skilltree` 101, `legal` 706, `turnflow` 73, `engine`, `transition` 292, `harness` 1761, `loadouts`, `melody` 115, `client`, `journey`, `loadoutui`; `check:bundle` zero warnings.
- 📌 Found: `test:abilitydemo` fails on Alex's machine only (`every lever in ABILITY_DEMO is on the preview`): his `.scratch/ability-demo-preview.jsx` (10-01) predates a lever added since. The cloud copy skips that check. Not this change.
- Recorded: Sunbeam/Azrael cut (confirmed); Db stays gone, may return with difficulty settings (inbox); Tune of DOOM parked as a write-up (STATE §4). Gravity Control's revisit is in the inbox too.

---


### ➕ 2026-10-14: 🌌 every standee's back is its own nebula
Alex: *"Lets make the back of the standees shimmer/sparkle - like it is its own 'nebula' instead of being plain"* → preview → dial-in pasted (16 of 23 levers) → *"Can you hook it up?"*
- **New:** `board/standeeNebula.js` (`STANDEE_NEBULA` = the dial-in; the page imports it). **Wired:** `board/standee.js` builds the back with `createNebulaBackMaterial` (seed = seat id), `frame()` ticks it, `hasBlankBack` is true for every Spirit (`who:'all'`). `blankBackMaterial` and `STANDEE_BACK.color/glow/roughness` are gone (the values are in the comment). Page: `.scratch/standee-nebula-preview.*` (+ Artifact *Standee Nebula Backs*); its "BEFORE" twin wears a page-local copy of the retired card.
- **Evidence:** `test:standee` **171** (was 161: the dial-in, every Spirit has one, the player colour, the shader hooks, the clock and reduced motion; 2/2 mutants caught). Green: `test:battledirector` 45, `spiritpicker` 67, `standeemove` 318, `knockdown` 37, `cursedshamisen` 132 + 44, `pyrostage` 62, `bushidoarena` 15, `arch`. `test:abilitydemo` 149 + its known red (the old preview lever, noted 10-13). Rendered in headless Chromium on the real arena.
- **Calls:** each sky seeded by seat id; the plain card retired rather than kept as an option. With 'all' the battle lens treats every print as one-sided (films the front).
- **Next:** ⏳ Alex: look at it on High and Standard in a real match. Backups: `.scratch/standee.before-nebula-port.js`, `.scratch/standeeCheck.before-nebula-port.mjs`. Nothing committed.
