# PRACTICE MODES HANDOFF — Fretboard Recon + Discord Coach

> **For AI editors + Alex.** Design + build plan for two new lobby practice
> modes, written 2026-07-24 from a design session. Nothing below is coded yet
> unless marked ✅. Companion to `RIFFOFF_HANDOFF.md` (the duel itself) and
> `GUITAR_NECK_HANDOFF.md` (the neck model). Read `ARCHITECTURE.md` §Design
> lenses (STICs + Earned) first.

---

## 0. Rulings that govern everything

1. **Practice pays in skill, never in currency.** No FP, no HC, no fans, no
   riffbook unlocks from any practice mode. `RIFFOFF_HANDOFF.md` §0 bans
   purchases from touching duel verdicts; the mirror rule is that practice
   must never become a resource faucet — otherwise "practice" becomes a grind
   obligation instead of a place to get good. Rewards are local: medals,
   bests, streaks, the neck-mastery heatmap. What practice ACTUALLY pays out
   is duel performance — and that's Earned.
2. **Practice plays the real game's systems, not imitations.** Same amp
   (`audio/ampVoice.js`), same neck model (`riff/guitarMap.js`), same chord
   brain (`music/chords.js`), same theory palette (`music/notes.js`
   `playableScale`). If a practice mode needs logic the game doesn't have,
   build it as a pure module the game COULD use (see `music/spice.js`, §4).
3. **The engine is never touched.** All three practice modes (including the
   existing Riff Stream) are client-side lobby features. No engine actions,
   no `state.battle`, no multiplayer surface.

---

## 1. ✅ Shipped with this doc (2026-07-24): the Spirit amp everywhere

- ✅ **`audio/ampVoice.js` (new)** — the canonical amp chain, extracted from
  the main file's `playNoteSound`: dual detuned osc + sub (+ octave-up for
  FUZZ) → drive → waveshaper → tone stack → echo/verb sends → shared master
  limiter. Exports `playAmpNote(ctx, freq, opts)`, `playAmpPowerChord(ctx,
  freq, grade, knobs)`, `getAmpBuses`, `makeDistortionCurve`, plus the tone
  data: `TONE_KNOB_DEFAULTS`, `SPIRIT_TONES`, `TONE_VOICES`,
  `TONE_VOICE_ORDER`. Per-context resources cached ON the ctx (`__rlswBuses`,
  `__rlswReverbIR`) so any caller shares one bus.
- ✅ **Main file delegates.** `playNoteSound` is now a thin wrapper (freq +
  live knob lookup → `playAmpNote`); `getAudioBuses` aliases `getAmpBuses`;
  tone constants imported. The scratch synth keeps its own chain but uses the
  shared `makeDistortionCurve`. No audible change in-game.
- ✅ **Riff Practice plays through the rig.** The old electronically-picked
  sawtooth `playHit` is gone; landed gems now fire `playAmpPowerChord` —
  root + fifth, grade-scaled hold/volume, identical to the duel's
  `riffPressKey` hit path. New **rig picker** in the bottom bar cycles
  🎛️ HOUSE → ⚔️ RONIN → 🛸 IG-0 → 🤘 MONSTER → 👑 GLAM (the Spirit signature
  tones), auditions on switch, persists to `rlsw.practice.rig`.

Both new modes below inherit this: **all melodic audio goes through
`playAmpNote` with the player's chosen rig.** No new synth code.

---

## 2. Shared infrastructure (build first)

### 2.1 `ui/FretboardFull.jsx` — the interactive full neck

The one component both modes stand on. NOT the riff-off's `GuitarStrike`
(that's a phrase-window strike zone); this is the WHOLE neck, tappable.

- **Geometry from `riff/guitarMap.js`** — `STRING_NAMES`, `STRING_OPENS`,
  `MAX_FRET` (12). 6 string rows × 13 fret columns (fret 0 = open, rendered
  as the nut column). Identity: `cellKey(string, fret)` gives the riff-format
  note key; `cellFreq = 110 * 2^((STRING_OPENS[s] + f − 5) / 12)` aligns with
  `riffDegreeFreq` (degree 0 = open A = A2 = 110 Hz).
- **Neon pass visual language** (Phase R3): near-black void, glowing string
  lines via the cyan→magenta `NEON_STRING_COLORS` gradient, violet inlay dots
  (3/5/7/9/12), bloom-filtered nut, `Saira Stencil One`. SVG filter IDs
  namespaced (`neonFbBloom`) to avoid collisions.
- **Props API** (render-only — no game logic inside):
  - `onTapCell(string, fret)` — every tap reports; parent decides meaning.
  - `layers` — map of cellId → `{ color, style: 'solid'|'dim'|'pulse'|'hot' }`
    for highlight overlays (chord/scale/spice/target — see §4).
  - `showLabels` — per-cell note letters on/off (difficulty lever, same
    pattern as the highway's `showLabels`).
  - `flash(cellId, grade)` — judgment burst on a cell, reusing the highway's
    burst grammar (perfect = white-hot, good = cyan, ok = violet,
    wrong = gray tumble).
- **Touch targets ≥ 40px**; mobile renders the neck full-width, landscape
  preferred (same constraint handling as `RiffHighway`).
- **Free audition:** any tap ALWAYS sounds its cell through the rig
  (`playAmpNote(cellFreq)`), even between prompts — the neck is an
  instrument first, a quiz second.

### 2.2 Lobby practice hub

`practiceMode` state in the main file becomes `{ mode: 'riff' | 'fretboard'
| 'discord', diff }`. Lobby shows three cards: **🎸 RIFF STREAM** (existing),
**🗺️ FRETBOARD RECON**, **🎩 DISCORD COACH**. Shared bits extracted from
`RiffPractice.jsx`: the rig picker (small `ui/RigPicker.jsx`), the
countdown/results overlay styles. localStorage namespace: `rlsw.practice.*`.

---

## 3. Mode 1 — 🗺️ FRETBOARD RECON (find the note)

**The pitch:** the game tells you a note and a string — you find it. Pure
neck knowledge, the literal skill the riff-off's guitar view sight-reads at
SHREDDER+ (where labels vanish and *position IS the notation*). This mode
manufactures that knowledge.

### 3.1 Loop

1. **Prompt card** (top HUD): "find **C** on the **A string**". Target =
   (string, pitch class). Timer starts the frame the prompt renders.
2. Player taps cells. Every tap sounds (free audition). A tap on the target
   string is JUDGED; taps on other strings are exploration — quiet, unjudged,
   but counted (see accuracy).
3. **Correct cell** → `playAmpPowerChord` slam + burst + grade. **Wrong cell
   on the target string** → `playRiffWrong` sour + gray tumble + accuracy hit.
4. Results flash (grade, time, streak) → next prompt after ~1.2s. Endless
   stream, RiffPractice-style.

### 3.2 Judging — speed × accuracy

Two axes, one grade (all constants tunable, live in the mode file):

| Grade | time-to-find | wrong taps on target string |
|---|---|---|
| PERFECT | < 1.5s | 0 |
| GOOD | < 3s | 0 |
| OK | < 6s | ≤ 1 |
| FUMBLED | ≥ 6s or ≥ 2 wrong | — |

Off-string exploration taps don't wreck the grade (the neck is an
instrument) but > 3 of them caps the grade at OK — wandering isn't knowing.

### 3.3 Tier ladder (RiffPractice escalation pattern: 3-streak up, fumble down)

| Tier | Pool | Frets | Labels | Prompt aid |
|---|---|---|---|---|
| 📱 OPEN MIC | naturals | 0–5 | on | target string glows |
| 🔥 GIGGING | + sharps | 0–12 | on | target string glows |
| ⚡ SHREDDER | all | 0–12 | **off** | string named only |
| 🌟 VIRTUOSO | all | 0–12 | off | **"find EVERY position of E"** — all cells sounding the pc, any order, one shared clock |

VIRTUOSO's find-all prompts reuse `positionsForPitch`/`nearestPositionForKey`
math; grade by total time ÷ position count so 2-position and 4-position
notes compare fairly.

### 3.4 The neck-mastery heatmap (the long-game reward)

Per-cell record in `rlsw.practice.neck`: `{ attempts, hits, avgMs }`.

- **Prompt selection is weighted toward weak cells** — spaced-repetition-lite:
  weight ∝ (1 − hit rate) + staleness. The mode quietly drills what you
  don't know instead of letting you farm E on the low E string.
- **Lobby card shows NECK MASTERY %** (cells with hit rate ≥ 80% over ≥ 3
  attempts ÷ 78 cells). A heatmap toggle on the results screen paints the
  neck green→red by avgMs. This is the medal case: visible, earned, worthless
  as currency — exactly §0.

### 3.5 Files + build notes

- `ui/FretboardFull.jsx` (new, §2.1), `ui/FretboardRecon.jsx` (new — prompt
  gen, judge, tiers, heatmap store), `ui/RigPicker.jsx` (extracted).
- Prompt generator must avoid immediate repeats (same pattern as
  `pickRandomOneLiner`'s last-used guard) and respect the tier's pool.
- Note spelling: riff key convention internally (`cellKey` — lowercase
  natural / UPPERCASE sharp), display via `getSpelledPool` with a fixed
  A-minor context (matches the riff pitch space; no key-context UI in v1).
- Sfx reuse: tier-up = `playBeamSurge`, tier-down = `playRiffMiss`.

### 3.6 STICs + Earned

| Lens | Verdict |
|---|---|
| Simple | ✓✓ one prompt, one tap, one grade |
| Thematic | ✓ knowing your neck is the most guitarist skill there is |
| Intuitive | ✓✓ the neck teaches itself — tap = sound, always |
| Coherent | ✓✓ same neck model, keys, amp, burst grammar as the duel |
| Earned | ✓✓ output is skill + a heatmap; zero currency |

---

## 4. Mode 2 — 🎩 DISCORD COACH (dissonance with intent)

**The pitch:** the game already SELLS dissonance — Discord notes buy Drive,
the Dissonance Edge stance is literally "end unresolved, then land the
resolve" (`DESIGN_AUDIT_v2.md` §9). But nothing TEACHES the ear judgment
underneath: which off notes add depth over a given chord, and how to resolve
them so they read as tension instead of noise. This mode is that teacher —
the same fretboard, a chord ringing under you, and a coach that rewards
tension you actually release.

### 4.1 Session setup

Pick (or accept defaults): **root** (default A), **mode** (minor), **chord
rung**. The rung ladder IS the game's consonance→dissonance arc, ordered by
`CHORD_TEMPLATES` rank:

POWER (E5-style) → MAJ / MIN triad → SUS2 / SUS4 → MIN7 / MAJ7 / DOM7 →
DIM / AUG → DOM9 / MIN9

Each rung re-derives every highlight layer from the template's `ivals` —
nothing hand-authored per chord.

### 4.2 The bed

The chord loops underneath: root + `ivals` voiced low, played through
`playAmpNote` on the MELLOW (triangle) voice, low drive, scheduled with
`opts.when` on the audio clock (sample-accurate restrum every ~2.6s, gentle
velocity so the player's rig sits on top). The player's own notes go through
their chosen rig as usual. Free time — **no metronome, no falling gems**.
This is harmony practice; rhythm pressure is the highway's job.

### 4.3 Fretboard layers (the coach's map)

All derived per (root, chord, mode) — rendered via `FretboardFull` `layers`:

| Layer | Cells (pitch classes) | Render |
|---|---|---|
| **CHORD** | root + `ivals` | cyan, solid — home |
| **COLOR** | `playableScale(root, mode, ALL_THEORY)` minus chord tones | violet, dim — safe color |
| **SPICE** | curated per chord quality (below) | magenta, slow pulse — the invitation |
| raw | everything else | unlit (still playable, still judged) |

**Spice sets** (the coach's whitelist — off notes with a known payoff):

- over any triad/power: **♭7** (blues snarl) and **chromatic approach cells**
  one semitone below/above each chord tone
- over major quality: **♯4** (Lydian lift)
- over minor quality: **natural 6** (Dorian glow)
- over dom7/9: **♭9** (the menace note)
- everywhere: the **tritone** against the root, flagged extra-hot

These map 1:1 onto the theory tree's color tones (`theory_dom7`,
`theory_modes`) — the coach teaches the notes the tree sells.

### 4.4 Judging — phrases, not notes (the whole point)

A note alone is never wrong. The classifier watches the last 2–3 notes:

| Event | Call | Feedback |
|---|---|---|
| chord tone | **SAFE** | soft cyan tick; consecutive safes build a small SUSTAIN glow |
| color tone | **COLOR** | violet tick |
| spice/raw note → **resolved by step (≤ 2 semitones) onto a chord tone within 2 notes / ~1.5s** | **⚡ EDGE — DEPTH** | white-hot burst on the resolution cell, +big score. The tension→release shape, same grammar as the in-game Edge resolve (land your Root/3rd/5th) |
| spice/raw note left hanging past the window, or resolved by leap | **NOISE** | gentle gray fade — no punishment spiral, the coach just didn't buy it |

Raw (unlit) notes CAN score DEPTH too — rarer payoff, same rule. The
whitelist is a map, not a cage.

**Coach behavior:** after an unresolved off note, the nearest resolution
target pulses white-hot for a beat (the coach shows the exit, never takes
the wheel). After each phrase, one line of coaching in the HUD, template +
context: "that ♭7 wanted to fall into the 3rd — let it." On a DEPTH: "THAT'S
the Edge. Same move wins you Drive in the pit."

### 4.5 Scoring + session end

Session = open-ended; SET COMPLETE card on demand (or after N phrases):
**depth count**, **resolution rate %** (depths ÷ off-note attempts),
**spice variety** (distinct spice pcs landed). Medals local
(`rlsw.practice.discord`), per rung. Rung unlock: resolution rate ≥ 60%
over ≥ 10 attempts — you climb the arc by EARNING the previous dissonance.

### 4.6 Explicit non-goals (v1)

- No rhythm grid, no timing grades — free time only. (v2 idea: optional
  groove bed + on-beat bonus. Parked.)
- No engine/campaign coupling; full theory palette always available here.
  A small badge on off-scale notes — "costs Discord in-game" — is the only
  bridge, teaching the economy without simulating it. *(Open Q for Alex:
  should the badge reflect the player's actual campaign unlocks when a save
  exists? Leaning no for v1 — lobby modes shouldn't read saves.)*
- The coach never grades TONE choices (rig is aesthetic, §0-adjacent).

### 4.7 Files + build notes

- **`music/spice.js` (new, PURE)** — `spiceSetFor(rootPc, chordId, mode)` →
  pc sets per §4.3; `classifyNote(history, pc, chordCtx)` → SAFE / COLOR /
  SPICE-OPEN / DEPTH / NOISE, implementing the step-resolution window. Pure
  and deterministic → unit-test in `engine/selftest.mjs` alongside the other
  music-theory tests (resolution windows are the fiddly part — test the
  boundary cases: leap-resolve, double-spice chains, window expiry).
- `ui/DiscordCoach.jsx` (new — session state, bed scheduler, coach lines,
  scoring), reuses `FretboardFull`, `RigPicker`.
- Chord bed voicing: root low (fold into pitch 0–12 region via the
  `bestOctaveShift` idea — or simply root at pitch ≤ 7 + ivals above),
  velocity ~0.10, MELLOW voice, so the bed never masks the player.
- `evaluateChord` is NOT needed for judging (the chord is known), but the
  SET COMPLETE card should run the player's landed pcs through it and name
  what they implied — "your line spelled A min9" is a hell of a reward line.

### 4.8 STICs + Earned

| Lens | Verdict |
|---|---|
| Simple | ✓ three colors + one rule: tension must resolve by step |
| Thematic | ✓✓ IS the Dissonance Edge, taught by hand |
| Intuitive | ✓✓ hear it: the bed makes consonance/dissonance audible, not abstract |
| Coherent | ✓✓ chord templates, theory palette, Edge resolve rule, amp — all the game's own organs |
| Earned | ✓✓ trains the exact judgment the Edge stance and discord tax price in-game; pays nothing but skill |

---

## 5. Build order

| Phase | Deliverable | Files |
|---|---|---|
| P1 | `FretboardFull` + `RigPicker` extraction + lobby hub | `ui/FretboardFull.jsx` (new), `ui/RigPicker.jsx` (new), `ui/RiffPractice.jsx`, `ui/Lobby.jsx`, main file (practiceMode shape) |
| P2 | Fretboard Recon (tiers, judge, heatmap) | `ui/FretboardRecon.jsx` (new) |
| P3 | `music/spice.js` + selftest cases | `music/spice.js` (new), `engine/selftest.mjs` |
| P4 | Discord Coach (bed, layers, classifier UI, coach lines) | `ui/DiscordCoach.jsx` (new) |

P1+P2 ship alone (Recon is complete without Coach). P3 before P4 — the
classifier is pure and testable before any UI exists.

---

*Related reading: `RIFFOFF_HANDOFF.md` §0 (hands-not-purchases — §0 here is
its mirror), `GUITAR_NECK_HANDOFF.md` (neck model + camera), `DESIGN_AUDIT_v2.md`
§9 (Dissonance Edge — the mechanic Coach trains for), `music/chords.js`
(CHORD_TEMPLATES), `music/notes.js` (`playableScale`).*
