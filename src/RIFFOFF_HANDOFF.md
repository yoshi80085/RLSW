# RIFF-OFF HANDOFF — the Expanded Riff-Off

> **For AI editors + Alex.** Design + build plan for making the riff-off the
> game's marquee FP event. Written 2026-07-14 from a design session; nothing
> below is coded yet unless marked ✅. Read `ARCHITECTURE.md` §Design lenses
> (STICs + Earned) first — every piece here was run through it and the
> verdicts are recorded in §8.

---

## 0. The ruling that governs everything

**The riff-off verdict is decided by hands, never by purchases.** It is the
purest Earned moment in the game — zero RNG, zero stats, 100% traceable to
what the player just performed. Therefore:

- **NO skill, item, or stat may ever modify `riffStats` scoring, grade
  windows in the player's favor, or the verdict math in
  `engine/systems/riffOff.js`.**
- The tree and the board own the **frame** of the duel instead: when it
  happens (initiation), what it's worth (stakes), what material is played
  (repertoire), and how hostile the conditions are (sabotage — armed by
  board actions, capped, loud).

E-Rush and Riff Slayer are the template: they change the *conditions*,
they never add invisible points.

---

## 1. Current-state map (where everything lives today)

| Piece | File / anchor |
|---|---|
| Verdict math, grade weights, `riffStats` | `engine/systems/riffOff.js` (`RIFF_GRADE_WEIGHT`, `RIFF_MARGIN_SCALE`, `applyRiffResolved`) |
| Riff generation (attacker call, defender answer, groove) | `riff/riffGeneration.js` (`generateAttackerRiff`, `generateDefenderRiff`, `generateRiffRhythm`, `RIFF_LEN = 6`) |
| Difficulty presets, timeline, judging | `riff/fallingNotes.js` (`RIFF_FALL_DIFFICULTY`: rookie/gigging/shredder) |
| Highway UI, gems, note labels, piano/guitar strike zones | `ui/RiffHighway.jsx` (`noteGlyph`, `gem()`, `laneX`, `guitarPos`) |
| Trigger (sonic attack vs plugged-in defender in beam) | main file `initiateSonicAttack` → `startRiffOff` (banner `RIFF-OFF ENGINE`, ~L6344/6539) |
| Resolve + beam clash + payout | main file `riffResolve` (~L6772), `fireBeamClash`, `closeRiffOff` (~L6869) |
| Payout today | `closeRiffOff` calls **`awardSonicFame`** — identical to a plain sonic win. This is the gap: nothing marks the riff-off as the marquee event. |
| Skills that touch riff-offs | `e_rush` (Ronin signature), `riff_slayer` (Monster signature). Nothing in the shared tree. |
| Difficulty setting | `riffDifficulty` — **client-side state**, not engine. Multiplayer exploit if it becomes the FP engine (§7 open Q). |

---

## 2. Phase R1 — the Rhythm Creation Device (melody → riff) ✅ BUILT

**The headline feature.** Your committed melody line becomes the base of your
riff-off riff. Literalizes the game's thesis — *the melody you build is your
combat* — and gives the theory ladder riff-off relevance without touching
scoring: a chromatic player can field riffs a pentatonic player cannot voice.

The earned asymmetry: **you rehearsed your riff all turn; your rival
sight-reads it.** A harder melody is harder for both — but you practiced
yours. Complexity becomes a weapon paid for in prep.

**What was built (2026-07-14):**

- ✅ **`riff/melodyRiff.js`**: `melodyToRiff(melodyLine, { rand, targetLen })`
  - Maps NOTE_POOL-format notes (`'C'`, `'C#'`, `'Db'`, …) → riff
    `degrees`/`sharps` via `PITCH_TO_RIFF` lookup table.
  - Octave-unwraps degrees so melodic contour is preserved (e.g. G→A
    steps +1, not −6).
  - Auto-detects contour (`climb`/`descent`/`arch`/`valley`/`zigzag`) from
    the degree sequence so the defender-answer labels still make sense.
  - Applies a generated rhythm over the player's pitch contour via
    `generateRiffRhythm` — **your notes, its groove.**
  - **Minimum-material rule:** melody ≥ 4 notes → use it (pad to `targetLen`
    with passing tones between the player's pitches). < 4 notes → returns
    `null`; engine falls back to `generateAttackerRiff` ("showed up without
    material").
  - Trims long melodies to `targetLen` (takes the opening statement).
  - Returns `{ degrees, sharps, contour, rhythm, fromMelody: true }` — same
    shape as `generateAttackerRiff`, so the full pipeline works unchanged.
- ✅ **Variable riff length.** `RIFF_LEN` refactored to `RIFF_LEN_DEFAULT = 6`
  (exported from `riffGeneration.js`). `generateRiffRhythm` and
  `generateAttackerRiff` accept a `len` parameter. `generateDefenderRiff`
  derives length from the attacker riff. All consumers
  (`BattleMeterOverlay`, log lines, bot handler) read `riff.degrees.length`
  / `side.notes.length` with `RIFF_LEN` fallback.
- ✅ **Engine wiring.** `riffOffStarted` action accepts `melodyLine` +
  `hasRiff`. `applyRiffOffStarted` calls `melodyToRiff` when melody ≥ 4
  notes; stores `fromMelody` and `hasRiff` flags in `state.battle`.
- ✅ **Client wiring.** `confirmNoteTrack` stashes the committed melody and
  riff-match as `committedMelody` / `committedHasRiff` on `noteStates`
  (melody line is cleared to `[]` after commit, so the stash bridges it).
  `startRiffOff` reads these and passes them to the engine action. Cleared
  at turn start (`startNewTurnNotes`).
- ✅ **Riffbook synergy.** `hasRiff` flag carried through to `state.battle`
  for bonus-pot wiring (payout itself is Phase R6).
- ✅ **Defender answer unchanged** — `generateDefenderRiff` already transforms
  the attacker's riff, so call-and-response survives intact. The defender
  answers *your melody*, inverted / modulated / twisted / resolved.
- No numeric "rehearsal bonus" for the attacker — the familiarity edge is
  emergent and real; don't double-pay it.

---

## 3. Phase R2 — difficulty overhaul (sight-reading, speed, length) ✅ BUILT

**Advanced players read positions, not letters.** At higher tiers the gem no
longer prints its note name — you know it's a D because of *where it falls*.
The lane mapping already encodes this (`laneX`: piano gems fall onto their
key, guitar gems onto string+fret), so hiding the glyph turns the highway
into real notation-reading.

**Preset changes** (`riff/fallingNotes.js` → `RIFF_FALL_DIFFICULTY`):

| Tier | Labels | Max riff len | leadTime | Windows |
|---|---|---|---|---|
| SOCIAL MEDIA INFLUENCER 📱 *(rename of ROOKIE — internal id `rookie` stays, like `cqc`/Thrash)* | on | 6 | 2500 | 150/320/520 (as today) |
| GIGGING 🔥 | on | 7 | 2000 | 120/250/420 (as today) |
| SHREDDER ⚡ | **off** | 8 | 1500 | 90/190/340 (as today) |
| VIRTUOSO 🌟 *(new)* | **off** | **15** | 1150 | 75/160/280 |

Virtuoso's 15-note cap is deliberate: at its speed a 15-note riff takes
roughly the wall-clock time of an Influencer 6-note — the tier is denser,
not longer. `buildRiffTimeline` handles any length; check gem spawn spacing
doesn't stack gems off the top of the highway at 15 (raise `SPAWN_PAD` /
spawn stagger if so).

**What was built (2026-07-14):**

- ✅ **`showLabels` + `maxLen` per preset.** Each tier in `RIFF_FALL_DIFFICULTY`
  now carries `showLabels: boolean` and `maxLen: number`. Rookie/Gigging show
  labels; Shredder/Virtuoso hide them.
- ✅ **VIRTUOSO tier added.** `leadTime: 1150`, windows `75/160/280`,
  `maxLen: 15`, `showLabels: false`. Denser, not longer.
- ✅ **Label hiding in `RiffHighway.jsx`.** `gem()` accepts `showLabels` prop;
  when `false`, `noteGlyph` text is suppressed entirely.
- ✅ **Diamond sharp cue.** When `showLabels=false`, sharp gems render as
  diamonds (`borderRadius: '3px'`, `transform: 'rotate(45deg)'`); natural
  gems stay round (`borderRadius: '50%'`). Shape-only — colorblind-safe.
  Diamond shape preserved through burst animations.
- ✅ **`BattleMeterOverlay` wiring.** Passes `showLabels={preset.showLabels}`
  prop to `<RiffHighway>`.
- ✅ **`maxLen` wired into engine.** `riffOffStarted` action accepts `maxLen`;
  `applyRiffOffStarted` uses it to cap riff generation length. `startRiffOff`
  reads `activePreset.maxLen` from the difficulty setting.
- ✅ **ROOKIE renamed to SOCIAL MEDIA INFLUENCER** (label only; internal id
  `rookie` unchanged — same pattern as `cqc`/Thrash).

---

## 4. Phase R3 — the neon pass (fantasy '80s outline instrument) ✅ BUILT

Kill the skeuomorphic piano. The instrument becomes a **neon outline** —
outrun/synthwave: dark void, glowing wireframes, chrome-sunset accents.

**What was built (2026-07-14):**

- ✅ **Neon palette constants.** `NEON_CYAN` (`#19e6ff`), `NEON_MAGENTA`
  (`#ff2d95`), `NEON_VIOLET` (`#8a5cff`), `NEON_ORANGE` (`#ff8a2a`),
  `NEON_WHITE` (`#ffffee`). Defined at module scope in both
  `ui/RiffHighway.jsx` and mirrored in the main file (`NEON_CYAN_I` etc.).
- ✅ **Neon piano (PianoStrike).** White keys: transparent fill, 2px glowing
  cyan outline with SVG `<filter>` bloom (stacked `feGaussianBlur` ×2 merged
  — no new deps). Black keys: filled hot-magenta with bloom filter. Key-press
  flood-fills the interior to white-hot (`NEON_WHITE`). Labels glow cyan,
  brighten to white on press.
- ✅ **Neon guitar (GuitarStrike).** Strings rendered as glowing neon lines
  via `NEON_STRING_COLORS` array (cyan at low E → magenta at high e) with
  bloom filter. Fret inlay dots are glowing violet. Nut is outline-only
  (cyan, bloom-filtered, no fill). Fret lines dim cyan. Lit blips white-hot.
- ✅ **Neon highway.** Background `#030810` (near-black void). Scrolling
  perspective grid via CSS `repeating-linear-gradient` + `riff-grid-scroll`
  animation (40px period, 1.2s loop). Lane guides fade from transparent →
  cyan → magenta. Strike line is a sunset gradient (`NEON_ORANGE` →
  `NEON_MAGENTA`) with pulsing `box-shadow`.
- ✅ **Gem neon treatment.** Gems now have translucent fill (`baseCol` at 22%
  opacity) with solid neon border + glow. Color assignments: ghost gems =
  violet, glitched = magenta, rushed = orange, default = cyan. Each gem
  trails a short neon tail via `.riff-gem-tail::before` pseudo-element using
  `--gem-color` CSS variable (3px wide, 18px tall gradient). Half-landed
  E-Rush gems flash white-hot.
- ✅ **Judgment burst overhaul.** Perfect = white-hot (`NEON_WHITE`),
  good = cyan, ok = violet, miss/wrong = gray (#555566) + new
  `riffgem-miss-tumble` animation (grayscale, shrink + rotate + drop).
  Diamond burst preserved via `riffgem-burst-diamond` keyframe (maintains
  `rotate(45deg)` through scale).
- ✅ **Board-side `renderInstrument` mirror.** Both piano and guitar views in
  the main file match the neon treatment: transparent cyan-outlined whites,
  magenta-filled blacks, gradient-colored strings with bloom, violet inlays,
  white-hot lit blips. SVG `<filter>` IDs namespaced (`neonBrdBloom`,
  `neonPnBloom`) to avoid collisions with the highway's filters.
- Contrast preserved: gem shape cue from Phase R2 carries sharp/natural info
  independent of color. Neon palette keeps adequate contrast against the
  near-black highway background.

---

## 5. Phase R4 — initiation ladder (fixing the double-gate) ✅ BUILT

Today's trigger (attacker amped + beam + defender plugged in) stays — it
becomes the **stadium tier**. Problems it leaves: a no-amp Thrash build is
locked out of the top FP faucet (the hero_pose mistake), and a defender can
dodge the marquee event forever by staying unplugged.

**What was built (2026-07-14):**

- ✅ **Engine `tier` parameter.** `riffOffStarted` action accepts `tier`
  (`'acoustic'` | `'stadium'`), stored in `state.battle.tier`.
  `applyRiffOffStarted` passes it through to the battle slice unchanged.
  Default is `'stadium'` — all existing riff-off triggers unchanged.
- ✅ **`initiateAcousticDuel(targetId)`.** New function in the main file:
  - Requires **adjacency** (axialDist = 1).
  - Costs **2 AP** + action token (same as other attacks).
  - **Cooldown**: 2-turn per rival pair. Pair key = sorted IDs joined with
    `:`. Tracked in `noteStates[sid].acousticDuelCds` map (set on BOTH
    combatants). Ticked down in `startNewTurnNotes` alongside other cooldowns.
  - Burns charges via `burnChargesAfterBattle` (same as stadium).
  - No amp requirement. No beam requirement. No plugged-in check.
  - Calls `startRiffOff(attacker, defender, 'acoustic')`.
- ✅ **`startRiffOff` takes `tier` param.** Stored in `battleState.riffTier`.
  Log messages differentiate: acoustic = "no amps, no beams, just chops";
  stadium = "both plugged in, beams crossed".
- ✅ **`riffResolve` acoustic path.** When `riffTier === 'acoustic'`, resolve
  skips the beam clash entirely — sets phase directly to `riff_result` (no
  `riff_clash` phase, no Round 2, no escalation). Stadium retains the full
  beam clash → potential Round 2 escalation flow.
- ✅ **Action button.** "🎸 Acoustic" button in the actions bar. Shown when:
  adjacent rivals exist, 2+ AP, action token available, at least one adjacent
  rival off cooldown. Orange accent (`#ffaa44`). Click → `setAction('acoustic')`
  → click adjacent rival hex → `initiateAcousticDuel(target.id)`.
- ✅ **Hex highlighting.** Acoustic mode highlights adjacent hexes with orange
  tint; adjacent rivals glow bright orange.
- ✅ **Bot policy.** Bots try acoustic duel as a fallback after beam/cone
  attacks fail — if adjacent to an off-cooldown rival and 2+ AP remain.
  Lower priority than sonic/swing (smaller pot), higher priority than "do
  nothing and end turn." Uses `botPickTarget` for target selection.
- ✅ **`BattleMeterOverlay` tier awareness.** Intro card shows "ACOUSTIC DUEL
  · NO AMPS · JUST CHOPS" (orange) vs "PLUGGED IN · FACE TO FACE · BEAMS
  CROSSED" (gold). Result card: "WINS THE ACOUSTIC DUEL" vs "WINS THE
  RIFF-OFF". Tie text: "neither could break through" (acoustic) vs "beams
  cancelled out" (stadium). Result flavor: "busker circle roars" (acoustic)
  vs "sealed by beam clash" (stadium).
- Bot auto-advance hooks unchanged — the `riff_clash` phase never triggers
  for acoustic, so the clash auto-advance code is naturally skipped. The
  `riff_result` auto-close at 1600ms still fires.

---

## 6. Phase R5 — stakes, and Phase R6 — dedicated riff fame

### Stakes (build in this order)

1. ✅ **HEADLINER 👑** — winner of any riff-off holds the title, **stealable
   only via riff-off**, visible on the HUD. Payout (Alex's design, replaces
   the earlier trickle idea): **+1 FP rider on win-FP** — whenever the
   Headliner earns FP from a sonic win, thrash win, or riff-off win, they
   get +1 on top (a 2-FP win pays 3). No per-turn payment: the title only
   pays when the holder *does* something, which keeps it Earned. Implement
   in `awardSonicFame` / `awardThrashFame` / `awardRiffFame` (not in
   `grantFame`, so riff discoveries/cadences/trivia are unaffected).
   Engine state: `headliner: spiritId | null`.
2. ✅ **ONE-LINER 🎤** — before the countdown each side is offered a
   random punny lyric reference (spirit-flavored). "Drop the Mic" to
   commit it, "Play it Safe" to skip. Back it up (win) = 2 casuals
   recruit from the Unsure pool. Talk big and lose = 1.5× Vibe damage +
   3 casuals scatter to Unsure. Tie = no bonus or penalty. The one-liner
   *is* the ante — no separate resource stake.
3. **CALL YOUR SHOT** — declare a quality bar pre-duel ("flawless or
   nothing") for a multiplier if met, a penalty if missed. Self-imposed
   risk; latest priority.

Guardrails: fan movement goes through the Unsure pool (no diehard theft);
the underdog ramp applies normally.

### ✅ Dedicated riff fame — replace `awardSonicFame` in `closeRiffOff`

New `awardRiffFame(winnerId, loserId, verdict, tier)`:

- ✅ **Base**: margin-scaled like sonic but with a higher floor (this is the
  marquee event) — first pass: `2 + ceil(margin/2)`.
- ✅ **Style pay**: +1 per 3 perfects (pay for *how* you played, not just that
  you won — `verdict.atkStats/defStats` already carry `perfects`/`quality`).
- ✅ **Tier mult**: acoustic ×0.6, stadium ×1, Round-2 stadium +2 flat.
- ✅ **Loser consolation**: quality ≥ 80% → 1 FP, "the crowd salutes a worthy
  set." Softens the dexterity gap; the crowd loves a close duel.
- All numbers are first-pass — tune in playtest, keep the *structure*.

### R5/R6 build notes (2026-07-14)

- **Engine**: `headliner: null` added to `makeInitialState` (state.js).
  `HEADLINER_CHANGED` action + `applyHeadlinerChanged` in economy.js,
  wired through reduce.js.
- **Transfer**: `closeRiffOff` dispatches `headlinerChanged(winnerId)` after
  every non-tie riff-off. Log distinguishes "claims" (first) vs "SEIZES"
  (steal). Effect flash 👑 HEADLINER! in gold.
- **+1 FP rider**: `headlinerRider(spiritId)` helper added to
  `awardSonicFame`, `awardThrashFame`, and `awardRiffFame`. Adds +1 to
  base before underdog calc. Log tags with `+👑`. NOT in `grantFame`.
- **`awardRiffFame`**: replaces `awardSonicFame` call in `closeRiffOff`.
  Higher floor (2 + ceil(margin/2)), style pay (+1 per 3 perfects), tier
  mult (acoustic ×0.6, stadium ×1, Round-2 +2), loser consolation (quality
  ≥80% → 1 FP "worthy set"), headliner rider, underdog ramp.
- **HUD**: 👑 shown next to headliner's name in the spirit card.

### R5.2 One-Liner build notes (2026-07-14)

- **Replaces** Throw Down ante and Grudge Match (both reverted — too removed
  from musicality; the one-liner *is* the ante).
- **Flow**: `riff_intro` → `riff_ante` → `riff_ante_respond` →
  `riff_countdown` → ... → `closeRiffOff`. Reuses the existing ante phase
  slots — no new phases. Client orchestration only, no engine actions.
- **`ONE_LINERS` data object** (main file): 5 punny lyric-reference lines per
  spirit ID (`cosmic_ronin`, `intergalactic_0`, `Metalness_Monster`,
  `Glamarchy`). Spirit-flavored easter eggs — close enough to recognize, not
  direct enough for trouble.
- **`pickRandomOneLiner(spiritId)`**: picks a random line, avoids repeating
  the last used line via `noteStates[sid].lastOneLiner`.
- **`enterRiffAnte()`**: picks candidate line for attacker, sets
  `battleState.oneLiner = { attacker: { line, dropped: false }, defender: null }`,
  transitions to `riff_ante`.
- **`pickOneLiner(drop)`**: attacker decides. If `drop=true`: logs the line +
  flash effect, sets `dropped: true`. Then picks defender's candidate line,
  transitions to `riff_ante_respond`.
- **`respondOneLiner(drop)`**: defender decides. Same logging/flash if dropped.
  Then proceeds to `riffBeginTurn` after 300ms delay.
- **Payout in `closeRiffOff`**:
  - Loser dropped a line → `Math.ceil(damage * 1.5)` Vibe damage + 3 casuals
    scatter to Unsure pool via `fansChanged`. Log: "talked big and got SERVED."
  - Winner dropped a line → 2 casuals recruit from Unsure pool via
    `fansChanged`. Log: "backed it up — crowd goes wild."
  - Tie → no one-liner bonus or penalty.
  - `awardRiffFame` signature: `pot` parameter removed.
- **Bot policy**: attackers drop ~40% (`Math.random() < 0.4`), defenders
  drop ~35% (`Math.random() < 0.35`). Random, not resource-gated.
- **BattleMeterOverlay**: `riff_ante` = shows candidate line in quotes,
  "🎤 Drop the Mic" / "🤘 Play it Safe" buttons. `riff_ante_respond` =
  shows defender's candidate line + context if attacker dropped, "🎤 Fire
  Back" / "🤘 Let it Slide" (or "Drop the Mic" / "Play it Safe" if attacker
  didn't drop). Result card: shows dropped lines with outcome summary
  (backed it up / talked big and lost / tie fizzle).

---

## 7. Phase R7 — sabotage (shared tree, later)

After the core lands. 2–3 generic condition-skills any Spirit can buy, each
**armed by a board action** (the E-Rush/Riff Slayer template), each loudly
logged. Hard rule: **max ONE active sabotage per side per duel.**

Candidates: **Feedback Loop** (rival's riff plays 0.85× faster), **Strobe
Stage** (N of the rival's gems reveal late — shortened leadTime on those
gems only), **Detune** (one lane's gems drift ±). E-Rush and Riff Slayer
stay signature exclusives.

### Decisions log (settled with Alex, 2026-07-14)

1. **Labels vanish at SHREDDER.** ✅
2. **Acoustic Duel is a baseline action** (like Swing/Smash — no purchase).
   Rationale: the acoustic tier exists so nobody is locked out of the
   marquee event; gating it behind HC would partially recreate the lockout.
   ✅ Confirmed by Alex.
3. **Headliner = +1 FP rider on win-FP** (sonic/thrash/riff-off wins only),
   NOT a per-turn trickle — pays only when the holder does something. ✅
4. **Melody-riff rhythm: fresh generated groove laid over the player's
   pitches** (`generateRiffRhythm`). The commit flow has no timing data, so
   deriving groove from the track would mean inventing a fake mapping.
   ✅ Confirmed by Alex.
5. **VIRTUOSO cap = 15 notes** — denser, not longer (see §3 note). ✅
6. **One-liner replaces Throw Down ante + Grudge Match** — both reverted as
   too removed from musicality. One-liner is the ante: spirit-flavored lyric
   reference, binary drop/safe choice, fan + Vibe risk/reward. ✅
7. **Multiplayer difficulty lock: the duel's preset lives in the engine
   battle slice** — a room-level setting; both performers always play the
   same preset. `riffDifficulty` stays as the solo-play default but the
   engine value is authoritative in a duel. Must land before netcode
   riff-offs. *(Decision delegated to Claude by Alex.)*

---

## 8. STICs + Earned verdicts (compact)

| Piece | S | T | I | C | Earned | Notes |
|---|---|---|---|---|---|---|
| Melody-as-riff | ✓ | ✓✓ | ✓ | ✓ | ✓✓ | The thesis, literalized. Watch degenerate-melody edge (§2 min-material rule). |
| No-label difficulty | ✓ | ✓ | ✓ | ✓ | ✓✓ | Sight-reading = real musicianship. Needs the sharp shape-cue or it fails Intuitive. |
| Neon pass | ✓ | ✓✓ | ✓ | ✓ | n/a | Pure presentation. Contrast + colorblind guardrails noted. |
| Acoustic duel | ✓ | ✓✓ | ✓ | ✓ | ✓ | Fixes the hero_pose-class lockout AND turtle opt-out. |
| Headliner | ✓ | ✓✓ | ✓✓ | ✓ | ✓✓ | Self-perpetuating marquee. The +1-on-win rider (Alex's design) pays only on deeds — stronger Earned than the rejected per-turn trickle. |
| One-Liner / Call-shot | ✓ | ✓✓ | ✓ | ✓ | ✓✓ | One-liner is musical (lyric refs) and simple (binary choice). Call Your Shot adds a rule — ship after one-liner settles. |
| Dedicated riff fame | ✓ | ✓ | ✓ | ✓✓ | ✓ | Fixes the "sonic hand-me-down" incoherence. Style pay traces to performance. |
| Sabotage (shared) | ✓ | ✓ | ✓ | ✓ | ✓ | Only with the one-per-side cap and loud logging. |
| ~~Score-modifying skills~~ | — | — | ✗ | ✗ | ✗✗ | **Banned by §0.** Recorded so nobody re-proposes it. |

---

## 9. Build order & touch list

| Phase | Deliverable | Files touched |
|---|---|---|
| R1 | ✅ `melodyRiff.js`, variable `RIFF_LEN` refactor, riffbook hook | `riff/melodyRiff.js` (new), `riff/riffGeneration.js`, `engine/systems/riffOff.js`, `engine/actions.js`, main file (`startRiffOff`, `confirmNoteTrack`, `startNewTurnNotes`), `ui/BattleMeterOverlay.jsx` |
| R2 | ✅ `showLabels`/`maxLen` presets, VIRTUOSO, diamond sharp-cue | `riff/fallingNotes.js`, `ui/RiffHighway.jsx`, `ui/BattleMeterOverlay.jsx`, `engine/actions.js`, `engine/systems/riffOff.js`, main file (`startRiffOff`) |
| R3 | ✅ Neon instrument + highway | `ui/RiffHighway.jsx`, main-file `renderInstrument` (keyframes inline in component `<style>`, no `index.css` changes needed) |
| R4 | ✅ Acoustic duel action + cooldowns | `engine/actions.js` (tier param), `engine/systems/riffOff.js` (tier in battle slice), main file (`initiateAcousticDuel`, `startRiffOff` tier, `riffResolve` acoustic path, action button, hex highlight, bot policy), `ui/BattleMeterOverlay.jsx` (tier labels) |
| R5.1 | ✅ Headliner (+1 FP rider) | `engine/state.js`, `engine/actions.js`, `engine/systems/economy.js`, `engine/reduce.js`, main file (`closeRiffOff`, `awardSonicFame`, `awardThrashFame`, `awardRiffFame`, HUD) |
| R5.2 | ✅ One-Liner mic drop | main file (`ONE_LINERS`, `pickRandomOneLiner`, `enterRiffAnte`, `pickOneLiner`, `respondOneLiner`, `closeRiffOff` payout, bot hooks), `ui/BattleMeterOverlay.jsx` (one-liner cards, result summary) |
| R5.3 | Call Your Shot | main file, `ui/BattleMeterOverlay.jsx` |
| R6 | `awardRiffFame` | `engine/systems/combat.js` or `riffOff.js`, main file `closeRiffOff` |
| R7 | Sabotage skills | `SKILL_TREE`, `engine/systems/riffOff.js`, `ui/RiffHighway.jsx` |

Each phase is independently shippable; R1+R2+R3 together are "the rhythm
creation device" Alex asked for and make the strongest first session.
Bot policy note: bots submit synthetic results arrays — `botRiffResults`
must learn the new length/difficulty ranges in R1/R2, and to value duels
at all once stakes exist (R5).

---

*Related reading: `DESIGN_AUDIT_v2.md` §2 (taught-vs-coded), §9 (Dissonance
Edge — the pattern for risk-you-choose mechanics). Thrash-tree defensive
wing discussion from the same session is intentionally NOT in this doc —
Alex is still thinking on it.*
