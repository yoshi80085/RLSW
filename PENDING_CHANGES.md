# PENDING CHANGES — Chord Strength + Theory Tree Redesign (v2)

Supersedes the v1 draft. v1's Task B has been replaced wholesale: the tree no longer
hands out a scatter of flat +1s, it sells one idea across five tiers.

**The one idea:** *your chord stack defines the local key.* Notes that are Discord against
the song's key stop being Discord when the chord you built makes them legal. Each Theory
tier widens how far that permission reaches. Buying Theory doesn't raise your numbers —
it changes what counts as a wrong note.

**What that collapses.** These v1 mechanics are all cut, absorbed into the ladder below:
Scale Variety Bonus, Harmonic Resonance I, Harmonic Resonance II, Harmonic Balance,
Tension & Release, Chromatic Approach, Color Bonus, Chord Resonance. Eight mechanics → one.

**Implementation order:** A → B0 → B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9 → B10 → C.
B0 is the spine; several later items assume it. Task C depends on B3 shipping first.
(B8 was pulled forward — its pure core shipped alongside B3, since the mode
question turned out to be a chord-context question. Only its wiring is outstanding.)

**Status:** ✅ Task A, B0 (a + b), B1, **B2 and B3** are SHIPPED on branch
`feat/chord-strength-b0` (local only — nothing pushed). Two changes were made that
this doc did not ask for: the **note speller** was rewritten (it was mis-spelling
14 borrowed degrees) and **B8 was reopened and reversed** — see below. Next up is
wiring the derived mode into the turn flow, then B4.

### Notes from the B2 / B3 pass

- **⚠️ B3's `theory_dom7` tier was a NO-OP as specified.** The spec's example —
  "stack reads C-E-G-B♭ → dom7 → the ♭7 is clean even if you never placed a B♭" —
  contradicts itself: `evaluateChord` does **subset** matching, so it only returns
  dom7 when the B♭ is literally in the stack. Verified across all 14 templates:
  the implied chord's tones are always exactly the stack's literal notes, so the
  tier would have pardoned nothing beyond `theory_minor`. **Resolved:** at this
  tier a *triad implies its natural seventh* (maj→♮7, min→♭7, dim→♭♭7, aug→♭7,
  sus→♭7). Power chords are excluded — no third means no quality to complete, and
  handing the ♭7 to the one stack every player holds from turn one is a far bigger
  grant than the tier is priced for. Already-complete 7ths and 9ths gain nothing;
  their payoff for this tier is the 4th stack slot.
- **Tiers are cumulative** (`theory_modes` implies `theory_dom7` implies
  `theory_minor`). A purchase that removed a pardon you already had would be a
  downgrade wearing an upgrade's clothes. Asserted in `b0check.mjs`.
- **`chordContext` deliberately cannot express the approach-note tier** — it's a
  condition on the *next* note, so it only exists per-position. Use it for the note
  stock highlight ("would this be clean right now"); use `classifyTrack` for
  scoring. An approach note isn't clean until you commit to landing it.
- **The C4 landmine is now guarded in three places**: a comment at the
  `keyScale` / `contextPcs` declarations, the module header of `context.js`, and a
  regression assertion that a pardoned note still reports `inScale: false`. Pardon
  changes **scoring**, never **classification**.
- `discordCount` (placement-time) and `unpardonedDiscord` (commit-time, from
  `classifyTrack`) now coexist as B7 intended. They agree at every tier except
  `theory_chromatic`, where the commit count can only be *lower* — the
  approach-note pardon is revealed at the moment the player resolves it.
- **B4/B5/B7 have their inputs waiting for them** at the commit site:
  `trackClassified`, `unpardonedDiscord`, and `contextPardons` (`{drive, sustain}`).
  Count from those; do not re-derive the pardon.
- B2's base is `max(0, floor(len/2) - 1)` → **0/0/0/1/1/2/2/3 for lengths 1–8**.
  (The doc said "0/1/1/2/2/3/3 across lengths 3–8" — seven values for six lengths;
  that list is right for lengths 3–9, and tracks cap at 8. The formula was the
  intent and the formula is what shipped.) Best-case track: **6 Db, was 9.**
- The tutorial's "WHAT EARNS DECIBILLS" table was stale in ways predating B2 — it
  advertised a Major-3rd cleanse removed in B1 and an octave value that never
  matched the code. Rewritten to the shipped numbers.

### ⚠️ Unasked-for change 1: the note speller was rewritten

`getSpelledPool` picked one global sharp-or-flat pool per key signature and named
all twelve notes from it. That produced **14 wrong spellings** on the borrowed
degrees players actually see — most damagingly, **in C (the default root) the blues
♭7 displayed as "A♯"**, i.e. the signature note of the entire `theory_dom7` tier,
misspelled in the most common key.

Replaced with **degree-based spelling**: a note's name comes from which degree it
is, so the ♭7 of C is B♭ because a seventh is some kind of B and this one is flat.
Two readability escapes, both hit only on exotic roots: a white key never takes an
accidental (no F♭/C♭/B♯/E♯), and double accidentals fall back to a plain enharmonic
name. The ♯4-never-♭5 rock bias is now applied from every root, not just F.

This also **removes mode from spelling almost entirely** — it turned out mode only
changed the spelling of 3 of 12 roots to begin with. `FLAT_ROOTS` was **removed**,
not deprecated, so archived code that revives it fails to import (same treatment as
`STACK_CAP`). Mode now only survives in `canonicalRoot`, for the genuinely
ambiguous split roots (D♭ major vs C♯ minor).

### ⚠️ Unasked-for change 2: B8 is reversed — the pivot is derived, not declared

See the rewritten §B8. Also fixed while in there: **`declarePivot` paid minor
`+1 tempDrive`, contradicting both the comment directly above it and this doc**,
which say Sustain. B8's argument for keeping the pivot asymmetric is "major is
tempo, minor is defense" — paying minor in Drive made both branches aggressive and
silently deleted the asymmetry it was defending. Now `tempSustain`.

### Notes from the earlier A / B0 / B1 passes

- **B1 correction — the statuses did NOT die with their triggers.** Mojo Drain,
  Stagger and Burn each have independent sources (Riff-Off "convicted" verdict;
  an ultimate + the candle event; Pyrotechnics). Only the arming fields were
  removed. Consequently the `isMojoDrained` gates were **kept** — stripping them
  as B1 asked would have quietly gutted the Riff-Off penalty.
- `feedbackBoost` is set at commit and cleared **only** by `consumeAttackCharges`
  on a hit — there is no turn-start reset, so that call must survive. Separately:
  nothing actually multiplies damage by `feedbackBoost`; the "Damage ×2" is a HUD
  badge only. **Pre-existing gap, worth a decision before B5.**
- A lot of copy still taught the removed mechanics (tier descriptions, skill
  descriptions, two beginner tips, two tutorial sections, a hint line). All
  rewritten. B9 will still need a pass for the *context tiers*.

- The B0a warning about keeping `economy.js` and `Game.makeInitialNoteState`
  byte-identical was **stale** — the client duplicate was already deleted at the
  Phase-5c flip. `economy.js` is the single source; there is no second copy.
- `STACK_CAP` was **removed**, not just deprecated, so any archived code that
  revives it fails to import rather than silently assuming 5.
- Fray / sustain-chip / finisher-wipe were checked and need no change — they only
  ever subtract, and never read the cap.
- ⚠️ `npm run test:engine` is **broken on main, pre-existing**: `selftest.mjs`
  pulls in `data/spirits.js`, which imports `.png` standees that bare node can't
  resolve. It throws before the first assertion. A/B0 coverage therefore lives in
  `src/engine/b0check.mjs` (`node src/engine/b0check.mjs`) — fold it back into
  selftest once the png import chain is fixed.

---

## Task A: Chord Strength Redesign ✅ SHIPPED

**Problem:** Current `CHORD_TEMPLATES` drive/sustain values use a consonance/dissonance
model that fights the Drive/Sustain split. A Major triad (1-3-5) in the Drive Stack gives
only `drive:4`, punishing players who correctly recognize chord shapes.

**Direction:** Base power scales with note count. Consonance/dissonance becomes a ±1 tilt,
not the driver. More notes = stronger chord.

**File:** `src/music/chords.js`

```js
// Base from note count: 2-note=5, 3-note=6, 4-note=7, 5-note=8
// Then ±1 affinity tilt (drive-lean / sustain-lean / neutral)
export const CHORD_TEMPLATES = [
  // 5-note (base 8)
  { id:'dom9',  label:'Dominant 9',   ivals:[0,4,7,10,2], rank:7, drive:9, sustain:7 },  // drive-lean
  { id:'min9',  label:'Minor 9',      ivals:[0,3,7,10,2], rank:7, drive:7, sustain:9 },  // sustain-lean
  // 4-note (base 7)
  { id:'dim7',  label:'Diminished 7', ivals:[0,3,6,9],    rank:6, drive:8, sustain:6 },  // drive-lean
  { id:'dom7',  label:'Dominant 7',   ivals:[0,4,7,10],   rank:6, drive:8, sustain:6 },  // drive-lean
  { id:'maj7',  label:'Major 7',      ivals:[0,4,7,11],   rank:6, drive:6, sustain:8 },  // sustain-lean
  { id:'min7',  label:'Minor 7',      ivals:[0,3,7,10],   rank:6, drive:6, sustain:8 },  // sustain-lean
  { id:'m7b5',  label:'Half-dim 7',   ivals:[0,3,6,10],   rank:6, drive:8, sustain:6 },  // drive-lean
  // 3-note (base 6)
  { id:'dim',   label:'Diminished',   ivals:[0,3,6],      rank:5, drive:7, sustain:5 },  // drive-lean
  { id:'aug',   label:'Augmented',    ivals:[0,4,8],      rank:5, drive:7, sustain:5 },  // drive-lean
  { id:'maj',   label:'Major triad',  ivals:[0,4,7],      rank:4, drive:5, sustain:7 },  // sustain-lean
  { id:'min',   label:'Minor triad',  ivals:[0,3,7],      rank:4, drive:5, sustain:7 },  // sustain-lean
  { id:'sus2',  label:'Sus2',         ivals:[0,2,7],      rank:3, drive:6, sustain:6 },  // neutral
  { id:'sus4',  label:'Sus4',         ivals:[0,5,7],      rank:3, drive:6, sustain:6 },  // neutral
  // 2-note (base 5)
  { id:'power', label:'Power chord',  ivals:[0,7],        rank:2, drive:5, sustain:5 },  // neutral
];
const SINGLE  = { id:'single',  label:'Single note',  drive:3, sustain:3 };  // unchanged
const CLUSTER = { id:'cluster', label:'Tone cluster', drive:3, sustain:2 };  // was drive:7, sustain:1
```

**Note on tuning:** these values were drafted assuming every spirit can reach a dom9 from
turn one. **B0 removes that assumption** — 4- and 5-note chords become gated. Once B0 lands,
the note-count curve *is* the progression curve, so this table should need less hand-tuning,
not more. Ship these values, then re-check after B0 rather than tuning twice.

---

## Task B: Theory Tree Redesign

### B0 — Stack seeds down to 1 note; slots 4 and 5 gated ✅ SHIPPED

Two changes to the chord stacks.

**B0a — Seed one note, not two.**

**Files:** `src/engine/systems/economy.js` (`makeInitialNoteState`, ~line 137) **and**
`Game.makeInitialNoteState` in `src/rlsw-simulator-v3_8_1.jsx`. ⚠️ These two are
byte-identical today by design and **must stay in sync** until the Phase-5c client flip.

```js
// ── Current ──
const fifth = semitonesUp(root, 7);
driveStack:      [root, fifth],
sustainStack:    [root, fifth],
chordStack:      [root, fifth],  // DEPRECATED — save compat

// ── New ──
driveStack:      [root],
sustainStack:    [root],
chordStack:      [root],         // DEPRECATED — save compat
// `fifth` may now be unused here — check before deleting, it may serve other fields.
```

Effect: you open on a **Single note** (D3/S3) instead of a free Power Chord (D5/S5), and
you *earn* the power chord with your first stack commit. Note the old comment said the
R+5 seed "costs no pool notes" — that's no longer true, the 5th now costs a stock note.
With `STACK_COMMIT_BUDGET = 3` you can still reach a full triad on turn one if you spend
for it, so this is a *choice* added, not a delay imposed.

**B0b — Gate slots 4 and 5.**

`STACK_CAP` stops being a global constant and becomes a **derived per-spirit value**:

| Slots | Requirement | Chords reachable |
|---|---|---|
| 1–3 | baseline | single, power, maj, min, sus2, sus4, dim, aug |
| 4 | `theory_dom7` | dom7, maj7, min7, m7b5, dim7 |
| 5 | `theory_modes` | dom9, min9 |

The skill named "Blues / Dominant 7th" is the same purchase that lets you *build* a
dominant 7th. Melody permission and harmony capacity arrive together.

Both slots sit on Theory by design — the branch's pitch is that it's the one that changes
what you're *able to play*, and capacity is half of that. Note the spread: `dom7` gives
slot 4, `modes` gives slot 5, and `chromatic` gives the Approach Notes licence plus the
chromatic-run payout (B6). Every tier from `dom7` up hands over a structural capability,
so there's no dead purchase on the way to the capstone.

> **⚠️ Consequence to watch.** Theory now gates the stat ceiling, the melody palette, the
> Db payout *and* chord capacity. That makes it effectively mandatory, which means "which
> branch first" stops being a decision unless the other branches own comparable ceilings
> of their own. The fix is to raise the others, not to nerf Theory — but until that
> happens, expect every build to open Theory-first. Worth a follow-up pass on Electric/amp
> and Crew to give each of them one thing nobody else can grant.

**Suggested shape:**

```js
// src/data/gameConstants.js
export const STACK_CAP_BASE = 3;   // was STACK_CAP = 5
export const STACK_CAP_MAX  = 5;

// new helper — single source of truth, do not inline this rule
export function stackCapFor(unlockedSkills = []) {
  let cap = STACK_CAP_BASE;
  if (unlockedSkills.includes('theory_dom7')) cap += 1;
  if (unlockedSkills.includes('theory_modes')) cap += 1;
  return Math.min(STACK_CAP_MAX, cap);
}
```

**⚠️ Cap-derivation touch list — everything that currently assumes `STACK_CAP === 5`:**

> Rake (`noteCost: 3`) and `gallopCondition` (stack ≥ max) both read the cap, but **both
> are archived and not in the live game** — skip them unless they're ever revived, in
> which case they must take the derived cap.

- **Bank-on-full** (`bankLostChordNote` at cap) — fires earlier than intended.
- **Lost Chord pickup** (`resolveLostChordPickup`) — auto-banks when the targeted stack is
  at cap; same fix.
- **Finisher `stackWipe`**, **Fray**, **swing/sonic spends** — verify none assume 5.
- **`botPlanStackCommit`** (`src/engine/policies/bot.js`) — must take the cap as a
  parameter rather than reading the constant.
- **Commit UI** — render locked slots visibly (greyed with a lock icon) so the gate reads
  as progression, not as a missing feature.

---

### B1 — Remove combat flavor triggers ✅ SHIPPED

Remove these four entirely. They're skippable, awkward, and their removal is what frees
the discord unlocks to become the context system instead.

1. **Blues Lick / Mojo Drain** — ending on ♭7 arms a Mojo Drain debuff.
2. **Devil's Interval / Burn** — ending on tritone arms a Burn.
3. **Borrowed Chord / Maj3 Cleanse+Shield** — ending on major 3rd in minor cleanses or shields.
4. **Stagger** — chromatic run inflicts Stagger.

**Files:**

- `src/rlsw-simulator-v3_8_1.jsx` — `confirmNoteTrack()` holds all four. Look for
  `isMinorSeventhEnd`, `burnArm` / `isTritoneEnd`, `isMajorThirdEnd`, `chromStagger`.
  Remove the arming/application logic; **keep the interval detection**, B5 needs it.
- Trace and remove reads of `pendingMojoDrain`, `pendingStagger`, `burnArmed`,
  `statusShield` from `noteStates`. Also `mojoDrain` in `declarePivot` (`isMojoDrained`)
  and in `driveBoostFromRun`'s call site.
- `performanceScore` takes `hasGatedEnding: isMinorSeventhEnd || isMajorThirdEnd ||
  isTritoneEnd` — decide whether P keeps rewarding those endings. Recommended: keep it,
  it's a *flair* signal and independent of the removed combat effects.

**Do NOT remove:** the Discord system itself; the discord unlock IDs as scale-expansion
flags; the tritone → `feedbackBoost` link; `detectResolvedDiscords` (B7 and the Flair
exemption both use it).

---

### B2 — Rescore melody Db ✅ SHIPPED

**File:** `src/music/cadence.js`, `scoreTrackDB()` (line 216). Update the header comment
block at lines 211–215 too, it documents the old formula.

| Term | Current | New |
|---|---|---|
| Base | `floor(len / 2)` | `floor(len / 2) - 1`, floored at 0 |
| 5th ending | +5 | **+3** |
| 4th ending | +4 | **+2** |
| Octave (first === last) | +2 | **+1** |

Base gives 0/1/1/2/2/3/3 across lengths 3–8 — roughly halves income while keeping length
a real slope. (`floor(len/3)` was considered and rejected: it makes a 6-note and an 8-note
track score identically, flattening length out of the Db game entirely.)

**Deliberately not added: no 7th/9th ending bonus.** The 4th/5th/octave ladder is
*cadential* — it asks where the line came to rest. A ♭7 doesn't resolve, it hangs; paying
a premium for ending on the least-resolved note inverts the lesson the rest of the system
teaches. Color gets rewarded in the **body** of the track instead — see B4.

---

### B3 — The Chord Context ladder (core mechanic) ✅ SHIPPED

At commit, `evaluateChord()` already returns the implied chord for each stack. Its pitch
classes form a **context set**. Melody notes are judged against `currentScale` ∪ context
rather than `currentScale` alone. Each tier widens the reach.

| Tier | Name | Rule |
|---|---|---|
| `theory_major` *(free at start)* | — | No context. Melody judged against the key only. |
| `theory_minor` | **Chord Tone Pardon** | A melody note **literally present** in either stack is never Discord. |
| `theory_dom7` | **Play the Changes** | Pardon extends from literal stack notes to the **whole implied chord, completed to its seventh**. Stack reads C-E-G → maj → maj7 → the ♮7 is clean in your melody even though you never placed a B. A minor triad hands over the ♭7 the same way. ⚠️ The original wording of this row described a no-op — see the correction note at the top. |
| `theory_modes` | **Extensions** | Context grows to the chord's available tensions, by quality: ♯4 over major, natural 6 over minor, ♭9 and 9 over dominant. |
| `theory_chromatic` | **Approach Notes** | **Any** note is clean if the *next* note is a chord tone of either stack. Total chromatic freedom, conditional on landing it. |

Design notes for whoever implements this:

- `theory_minor` still gates the minor pivot as it does today (see B8) — the pardon is
  *additional*, not a replacement.
- The player never learns a list of notes. The rule is "whatever your chord made legal,"
  and it re-derives every turn from the stack in front of them. Do not surface this as a
  note table in the UI; surface it as **live highlighting on the note stock** — a note the
  context has legalized should visibly light up the moment the stack qualifies it. That
  highlight *is* the teaching.
- Ordering matters at `theory_chromatic`: the approach-note pardon looks at `track[i+1]`,
  so the final note of a track can never be pardoned by it. That's intended — it pushes
  players toward resolving.

**Shipped as** `src/music/context.js`, alongside `chords.js` and `cadence.js`.
Exports `chordContext`, `classifyTrack`, `stackContext`, `modeFromStack`,
`countUnpardoned`, `countPardonedByStack`, plus `CONTEXT_TIERS` / `PARDON_ORDER`:

```js
/** Pitch classes made legal by the stacks, given the player's unlocked tiers.
 *  Returns a Set of pcs. Pure — no game state. */
export function chordContext(driveStack, sustainStack, unlockedSkills): Set<number>

/** Per-note classification for a committed track. Returns one entry per note:
 *  { pc, inScale, pardonedBy: null|'literal'|'chord'|'extension'|'approach',
 *    stack: null|'drive'|'sustain' }
 *  `stack` is which stack authorized it — B4 needs this for routing. */
export function classifyTrack(track, currentScale, driveStack, sustainStack, unlockedSkills)
```

Keeping `classifyTrack` pure and returning per-note provenance means B4, B5, B7 and the
commit log all read the same single pass. Don't recompute the pardon in three places.

---

### B4 — Color notes pay the stack that authorized them

A pardoned off-scale note isn't merely forgiven, it **earns** — but in Drive/Sustain, not Db.

- Pardoned because of the **Drive Stack** chord → **+1 Drive** (tension = aggression).
- Pardoned because of the **Sustain Stack** chord → **+1 Sustain** (color = width).
- Legal in both → route to the stack whose chord has the higher `rank`; tie goes to Drive.

**Cap at +2 per stack per commit.** Feeds `tempDrive` / `tempSustain`, exactly like
`driveBoostFromRun` and `sustainBoostFromPattern` already do.

**Why not Db:** the game already teaches a positional rule — *the middle of the track
builds Drive/Sustain* (`driveBoostFromRun`, `sustainBoostFromPattern` read the interior),
*the ending pays Db* (`scoreTrackDB` reads the last note). Routing color to Db would have
forced players to hold a second mental column of "which notes are for the middle." Routing
it to Drive/Sustain keeps the existing rule intact and adds nothing to memorize.

Player-facing model stays two sentences:

> **Land on the 5th, 4th, or octave.** → Db
> **Notes your chord makes legal pay you.** → Drive/Sustain, into the stack that legalized them

---

### B5 — Harmonic Lock (the Db escalation)

If the melody's **final** note is a chord tone of a stack holding a *recognized* chord
(not single, not cluster), the ending bonus escalates by that chord's `rank`:

| Stack chord rank | Bonus |
|---|---|
| rank ≤ 4 (triads, sus, power) | +0 |
| rank 5 (dim, aug) | **+1** |
| rank ≥ 6 (7ths, 9ths) | **+2** |

Stacks with B5 on top of B2's ladder, so a 5th ending into a dom9 stack is 3 + 2 = 5 Db —
about the old value, but *earned* rather than baseline.

This replaces v1's Harmonic Resonance I/II. Those paid a flat +1 for merely *having* a
recognized chord, which after Task A is true almost always — a stat bump wearing a
mechanic's clothes. Harmonic Lock requires you to build something sophisticated **and**
land on it, and it makes Task A's note-count curve and the Theory tree pull in the same
direction.

Musically it's the real lesson: you stopped thinking in the home key and started thinking
in the chord.

---

### B6 — Chromatic run: pardon becomes payout

Chromatic Climb currently *pardons* discord when a chromatic run of 3+ is present. With
`theory_chromatic`, make it **pay** instead: a chromatic run of 3+ earns **+3 Db**, +1 per
note beyond 3, capped at +5.

The risk is intrinsic and needs no balancing scaffold: a chromatic run eats 3+ of your 8
melody slots, drains `noteStock` you'd otherwise spend on the stacks, and pre-unlock every
note in it is a Discord costing −1 each under B7. Before the skill it wrecks you; after it,
it's your biggest single payout.

**This is a deliberate exception to B4's routing rule** (interior gesture, pays Db). Keep
it *the* exception — a capstone that breaks the game's own grammar is how an unlock earns
the word "mastery." Make sure the UI reads it as singular, not as one row in a table.

Also retire the current `theory_chromatic` effect, "All Discord penalties are halved"
(`applySkillEffects`, ~line 3531) — the Approach Notes tier in B3 replaces it and the two
would stack into near-total immunity.

---

### B7 — Discord penalty gets teeth

**File:** `src/rlsw-simulator-v3_8_1.jsx`, DB scoring block (~lines 2964–2977).

Currently a flat **−1 for the whole track** regardless of how many wrong notes. That makes
the entire pardon economy worth at most 1 Db — the tree would be selling a 46-Db ladder to
dodge a one-point tax.

```js
// Current
const discordFlat    = effectiveDiscord > 0 ? 1 : 0;
const discordPenalty = chromClimbActive ? 0 : (hasChromMastery ? Math.floor(discordFlat / 2) : discordFlat);

// New — per note, first one free, floored at 3
const unpardoned     = /* count from classifyTrack (B3) where pardonedBy === null */;
const discordPenalty = Math.min(3, Math.max(0, unpardoned - 1));
```

**The first-discord grace is load-bearing.** A strong track under B2+B5 is worth ~5 Db;
without the grace and the floor, three wrong notes wipe 60% of a turn from a player still
learning which notes are grey. `freestylePardon` (Intergalactic 0) already establishes the
"one pardoned wrong note" pattern — this generalizes it.

Note `discordCount` currently increments at *placement* time, before the stacks are known.
With B3 the real count can only be resolved at **commit**. Keep the placement-time counter
for live UI feedback, but score from `classifyTrack`'s result.

---

### B8 — Major/Minor pivot: **REVERSED.** The chord declares the mode, not the player

🔶 **Pure core SHIPPED** (`modeFromStack` in `src/music/context.js`, covered in
`b0check.mjs`). **Turn-flow wiring outstanding — this is the next task.**

**What the previous revision said.** "The code is already right, change nothing:
major → +1 Db, minor → +1 `tempSustain`." Two things were wrong with that. The code
was in fact paying minor `+1 tempDrive` (now fixed). And the larger question —
whether a per-turn Major/Minor prompt still earns its place — hadn't been asked.

**Why it stops earning its place.** Measured, not asserted:

- At full unlock the two branches differ by **two notes you can't reach any other
  way** — ♭3 and ♭6 — against three the other branch owns (maj3, ♯4, maj7). In C:
  major gives `C D E F F♯ G A B♭ B`, minor gives `C D E♭ F G A♭ A B♭`, and six of
  those are shared.
- The prompt fires **every turn**, because the root changes every turn. It is the
  highest-frequency modal interruption in the game, and it asks a music-theory
  question of players who may not have one.
- **B3 already eroded its exclusivity.** Stack a minor triad and Chord Tone Pardon
  legalizes the ♭3 without ever declaring minor. Harmony had quietly taken over
  half the pivot's job.
- Mode turned out to drive spelling for only 3 of 12 roots — and after the speller
  rewrite, for none of them except the split roots themselves.

**The replacement.** `modeFromStack(driveStack, unlockedSkills, currentMode)`:

| Drive Stack reads | Mode | Reason |
|---|---|---|
| min, min7, min9, dim, dim7, m7b5 | **minor** | `'quality'` |
| maj, maj7, dom7, dom9, aug | **major** | `'quality'` |
| power, sus2, sus4, single, cluster | *hold current* | `'ambiguous'` |
| minor quality, but no `theory_minor` | **major** | `'locked'` |

The decision doesn't disappear — it moves into the thing the player is already
manipulating. Stack a ♭3 and watch which notes go grey. That's the same lesson B3
teaches everywhere else, applied to the one place the game was still asking the
player to state it out loud.

Two details worth keeping:

- **Ambiguous holds, never flips.** A power chord has no third; that is precisely
  why rock leans on it, and the game shouldn't pretend to hear one. This also means
  the B0 single-note seed never force-flips a spirit on turn one.
- **`'locked'` is a feature.** A spirit without `theory_minor` whose stack wants
  minor holds major and the UI says so. Being able to *hear* the minor chord and be
  told the game can't spell it yet advertises the skill far better than a greyed-out
  button at the moment of least interest.

**The bonus survives unchanged** and simply becomes automatic: major → +1 Db,
minor → +1 `tempSustain`. Still asymmetric, still major-is-tempo /
minor-is-defense — the argument for the asymmetry was always right, it just wasn't
what the code was doing.

#### Wiring plan (outstanding)

Lowest-risk shape: **do not rip out `pivotPending`.** Leave the ~30 guard sites in
place and simply stop ever setting it true, so nothing can deadlock a turn.

1. Three sites set `pivotPending: true` — `startNewTurnNotes` (~3509),
   `resolveTransposeCard` (~3934), and `makeInitialNoteState`
   (`engine/systems/economy.js:157`). Each instead derives the mode, respells root
   + stock, and leaves `pivotPending: false`.
2. `declarePivot(mode)` survives as the **applier** (respell + bonus + upgrade
   award), called with the derived mode rather than from a button. All of its
   existing plumbing is reusable as-is; only its trigger changes.
3. The mode bonus has side effects (`advanceDB`, `awardTargetSkill`) that can't run
   inside the `setNoteStates` reducer. Stage it: write `pendingModeBonus` in the
   reducer, apply it in a small effect. Do **not** try to inline `advanceDB` into
   the reducer.
4. **UI** (~10849–10990): replace the two pivot buttons with a read-only line
   naming the derived mode and the chord that caused it — "🌑 MINOR — your C minor
   triad", "☀️ MAJOR — hold (power chord has no third)", "🔒 your stack wants minor
   — unlock Minor Tonality". The `turnStep === 'pivot'` HUD stage collapses.
5. **Bot** (~8941): the `ns.pivotPending` branch becomes dead. Delete it rather
   than leaving it — a bot branch that can never fire is a trap for the next reader.
6. ⚠️ Mode must be derived **at turn start**, not on every stack commit. Re-deriving
   mid-turn would respell the stock underneath notes the player has already placed.

---

### B9 — Skill descriptions and grants table

**`SKILL_TREE`** (~line 457) — each `desc` should state the scale expansion **and** the
context tier **and** the slot unlock where applicable. Suggested:

| Skill | Cost | Sells |
|---|---|---|
| `theory_major` | 6 *(free at start)* | The 4th & 7th go Discord-free — your Major scale is complete. |
| `theory_minor` | 8 | Declare Minor at the pivot. **Chord Tone Pardon** — notes sitting in your stacks are never Discord. |
| `theory_dom7` | 10 | The ♭7 joins your clean palette. **Play the Changes** — your stack's whole implied chord goes clean. **+1 stack slot (4).** |
| `theory_modes` | 12 | **Extensions** — your chord's tensions (♯4, nat-6, ♭9, 9) go clean and pay Drive/Sustain. **+1 stack slot (5).** |
| `theory_chromatic` | 16 | **Approach Notes** — any note is clean if you land the next one on a chord tone. Chromatic runs pay big. |

**`applySkillEffects`** log lines (~3526–3531) need matching rewrites; the current
`theory_chromatic` line ("All Discord penalties are halved") is now wrong per B6.

**`THEORY_DISCORD_GRANTS`** (`src/engine/systems/skills.js`, line 19) — the discord IDs
still work as scale-expansion flags gating `playableScale`. Keep the mappings, strip the
dead trigger names from the comments:

```js
export const THEORY_DISCORD_GRANTS = {
  theory_dom7:      ["discord_1"],              // ♭7 clean
  theory_modes:     ["discord_3"],              // tritone clean
  theory_chromatic: ["discord_2", "discord_4"], // maj3 + chromatic clean
};
```

Also fix the stale comment block at ~lines 401–408 ("Keep all existing special effects
(tritone feedback, m7 mojo drain, etc.)") — mojo drain is gone as of B1.

---

### B10 — Wa no Koe: promote, don't replace

Cosmic Ronin's passive (`applyWaNoKoe`, line 6752 → `checkWaNoKoe`) is melody/chord
alignment for +1 Drive/Sustain — i.e. this whole system, as one character's signature.

Don't cut it. **Grant Ronin the `theory_minor` tier (Chord Tone Pardon) for free from turn
one**, and let Wa no Koe stack on top as his personal amplifier. He becomes the character
who plays over the changes natively — the branch's flagship and its in-game tutorial —
instead of the character whose gimmick the tree obsoleted.

Note `applyWaNoKoe` currently reads `driveStack ?? sustainStack` (line ~3182), which only
ever looks at the Drive Stack since it's never nullish. Worth fixing while you're in there.

---

## Task C: Make Style Legible

**Problem:** Style is fixed per Spirit and dictates how that Spirit most effectively earns
Db — but a player has no way to *recognize* which shapes pay them. Style resolves once, at
commit, and reports itself in a log line. Feedback that arrives after the decision teaches
very slowly: you learn you played Shred correctly at the exact moment it's too late to play
more Shred.

This is **not a content problem.** `src/data/styles.js` already carries `tagline`,
`earnDesc` and `bonusDesc` for all three styles. It's a surfacing-and-timing problem.

**Current implementation (all working, all pure — this is why C1 is cheap):**

- `src/data/styles.js` — `STYLE_DEFS`, `styleOf(spiritId)`, `styleDef(spiritId)`. Style
  read from `SPIRIT_DEFS[id].style`, falls back to `'Groove'`.
- `src/music/cadence.js` — `detectStyleRun`, `detectContourTurn`, `detectCellRepeat`,
  `detectResolvedDiscords`, `detectRepeatPattern`.
- `src/engine/systems/economy.js` — `styleCommitDb({ style, track, currentScale, rootNote })`
  (~line 436) returns `{ db, tier, bonus, label, detail }`, clamped to `STYLE_DB_CAP`.
  `styleLengthTier(len)`: ≥7 → 3, ≥5 → 2, ≥3 → 1.
- Called once per commit from `confirmNoteTrack`.

---

### C1 — Live style prediction (the core change)

`styleCommitDb` is **already pure and already takes exactly the arguments a live preview
needs.** Nothing stops calling it on every note placement instead of once at commit.

Call it from the note-placement path (`addNoteToTrack` / the mixer and banked-note paths
too) against the *provisional* track, and render the result on the Commit Track:

> Player places C-D-E → track shows **SHRED RUN ×3 · +1 Db**
> Player adds F → **SHRED RUN ×4 · +1 Db**
> Player adds G → **SHRED RUN ×5 · +2 Db**

The rule is now taught by the thing itself, every turn, with no tutorial. The tier
thresholds (3/5/7) become visible as they're crossed, which is the part players currently
cannot see at all.

Implementation notes:

- Preview must use the same `currentScale` and `rootNote` the commit will use, or the
  number will jump at commit and destroy trust. Derive both from one place.
- The mic voice-roll bonus note (`confirmNoteTrack`) is rolled *at commit* and can push a
  run over a tier boundary. Do **not** try to predict it — show the preview as a floor and
  let the roll be an upside surprise.
- Zero-state matters: when nothing qualifies, show the style's `earnDesc` in the same slot
  rather than an empty bar. That's the tooltip that never needs opening.

---

### C2 — One highlight language, shared with B3

B3 already calls for live highlighting on the note stock: notes your chord has legalized
light up. **Style wants exactly the same affordance**, and they should look the same:

| Style | Highlight in note stock |
|---|---|
| **Shred** | Notes that would *extend* the current run (next step / 3rd / 4th in the established direction) |
| **Groove** | Notes that would repeat the current cell, or land the root |
| **Flair** | Off-scale notes currently pardoned by your chord context |

One rule for the player to internalize across both systems: **lit notes are notes that pay
you right now.** That's worth more than either feature alone — they learn one habit instead
of two. Use the style's own `color` from `STYLE_DEFS` (`#4488ff` / `#aa55ff` / `#ff6600`)
for the glow so the affordance is also character-identifying.

Note Flair's row is *literally* the B3 context set — no separate detector needed.

---

### C3 — HUD goal line

One always-visible line stating the current target in style-specific language. Dynamic,
derived from the same preview call as C1:

- **Shred** — "Longest run: 3 → keep stepping up for +2"
- **Groove** — "Root landings: 1 → return to C to score"
- **Flair** — "Colors resolved: 1 → land one more off-note back in scale"

Between C1, C2 and C3 the style stops needing to be explained anywhere.

---

### C4 — Style × chord context (the balance fix)

**The problem B3 creates.** Look at how each style interacts with the new context system:

- **Flair** earns from out-of-scale notes that resolve — that *is* B3/B4. Pulls **with** Theory.
- **Shred** wants long in-scale directional runs; off-scale notes break runs. Pulls **against**.
- **Groove** wants repetition and root resolution; color notes are a distraction. Pulls **against**.

So post-redesign, Flair spirits get double value from every Theory purchase while
Shred/Groove get taxed for the same investment. Because Style is *fixed per Spirit*, that
skew is permanent and baked in at character select. Fix it by giving each style its own
read on the context:

| Style | Interaction | Real technique it teaches |
|---|---|---|
| **Shred** — *Chromatic Passing* | A run that travels **through** a pardoned color note doesn't break; the note counts as part of the run length. | Chromatic passing tones |
| **Groove** — *Locked In* | Repeating a pardoned color note counts **double** toward the repetition/cell detectors. | Vamping on a color tone |
| **Flair** — *Outside* | Pardoned notes pay **Db** instead of Drive/Sustain — B4's routing rule, inverted for Flair only. | Outside playing |

Every style now wants Theory for a different reason, each reason is a technique a guitarist
actually learns, and Flair gets a one-line rule that explains why the character *feels*
different rather than merely scoring higher.

This also settles the `STYLE_DB_CAP` question below: with Flair converting color into Db,
the cap of 3 is doing real bounding work rather than sitting arbitrarily.

**⚠️ Landmine — do not widen `currentScale` for the Flair detector.**
`detectResolvedDiscords(track, currentScale)` classifies a note as a discord by testing it
against `currentScale`. If B3's context set is folded into `currentScale` before this call,
pardoned notes stop reading as discords, `count` collapses toward zero, and **Theory
investment would actively destroy Flair's earning** — the exact opposite of the intent.

The pardon changes **scoring**, not **classification**. `detectResolvedDiscords` must keep
receiving the unextended key scale. Keep the two concepts in separate variables from the
start (`keyScale` vs `legalScale`) rather than mutating one — this bug would be silent,
would only affect one of three styles, and would look like a tuning problem rather than a
logic error.

`styleCommitDb`'s signature grows to accept the context:

```js
export function styleCommitDb({
  style, track, keyScale, rootNote,
  context,            // Set<number> of pcs pardoned by the stacks (B3) — may be empty
})
```

---

### C5 — Surface the style before the first turn

Character select shows the style's `icon`, `label`, `color` and `tagline`, plus `earnDesc`
and `bonusDesc` verbatim. The strings already exist and are already written well; they're
simply not being rendered where the choice is made. Repeat the same block in the pause /
info screen so it's reachable mid-game.

---

### C6 — Retune `STYLE_DB_CAP`

**File:** `src/data/gameConstants.js`, line 119. Currently 3, with the comment "DB_UPGRADE_THRESHOLD
is 6, so cap 3 = two perfect commits per upgrade."

B2 roughly halves base melody Db (best-case track drops from ~9 to ~5), so Style silently
grows from ~25% of a strong turn to ~37%. Combined with C1 making Style *legible* — players
will start actually hitting the cap instead of stumbling into it — the effective shift is
larger than the arithmetic suggests.

Don't pre-emptively change the number. Ship C1–C4, then measure: if Style is carrying more
than about a third of Db income, drop the cap to 2 rather than re-inflating B2's base.
The comment on line 117 needs updating either way — its math refers to the old base.

---

## Verification

**Where the tests live:** `node src/engine/b0check.mjs` — 31 checks covering
Task A, B0, B2, B3, the speller and B8's core. `npm run test:engine` is still
broken on main (pre-existing `.png` import chain in `data/spirits.js`); fold
`b0check` into `selftest.mjs` once that's fixed.

Already covered:

- `stackCapFor()` at every unlock combination.
- `chordContext()` handing over the implied 7th at `theory_dom7` but **not** at
  `theory_minor` — note this is the *corrected* case (a C-E-G triad completing to
  maj7), since the doc's original C-E-G-B♭ example was a no-op.
- Tier monotonicity: no purchase is ever a downgrade.
- `classifyTrack` provenance and B4's stack routing (higher rank wins, ties to Drive).
- The approach tier never pardoning a track's final note.
- The C4 landmine: a pardoned note still reports `inScale: false`.
- All 24 speller pools: 12 unique, correctly-pitched, chip-readable names.
- `modeFromStack` across quality / ambiguous / locked.

Still to add: Harmonic Lock rank thresholds (B5); discord penalty floor and
first-note grace (B7).
- Play-test target: a turn-one spirit should reach a triad in one turn if they spend for
  it, and a mid-game spirit with `theory_dom7` should be able to say in one sentence why
  they built the chord they built.

**Task C specifically:**

- `selftest.mjs` already imports `styleCommitDb` and all four style detectors — extend
  those cases rather than writing new ones.
- Regression test the C4 landmine directly: a Flair track whose off-notes are *all*
  pardoned by the chord context must still return `tier > 0`. If it returns 0, `keyScale`
  and `legalScale` have been conflated somewhere.
- Preview/commit agreement: for a fixed track with no mic unlock, the C1 preview value must
  equal the value `confirmNoteTrack` finally awards. Fuzz it — a preview that disagrees
  with the payout is worse than no preview.
- Play-test target: a new player should be able to state their spirit's earning rule out
  loud after three turns, without having opened a menu.

## Unresolved before implementation

1. **Does `performanceScore` keep `hasGatedEnding`** after B1 removes the combat effects
   those endings triggered. (Recommended: yes, it's a flair signal.)
   *Still open — B3 didn't touch it.*
2. **Do Style Db and the P-score top-up need retuning** once B2 halves base income —
   `STYLE_DB_CAP` is 3 against a new best-case track of ~5, so Style becomes a much larger
   share of Db than it was designed to be. See Task C.
3. **Other branches need ceilings of their own** so Theory-first isn't automatic — see the
   consequence note in B0b. Not blocking, but don't let it slide. **B3 made this
   worse, as predicted:** Theory now gates the stat ceiling, the melody palette, the
   Db payout, chord capacity *and* the pardon economy. Electric/amp and Crew each
   need one thing nobody else can grant.
4. **Does the `theory_dom7` seventh-completion want a power-chord case?** Shipped
   without one — a power chord has no third, so no quality to complete. If the tier
   plays as too thin at purchase, the ♭7-over-power read is the lever to pull, but
   it's a large grant (every player holds a power chord from turn one) and should be
   a deliberate choice rather than a tuning nudge.
5. **`theory_modes` gives no extensions to dim / aug / m7b5 / sus / power.** Only the
   three qualities the design names (♯4 over major, ♮6 over minor, ♭9+9 over
   dominant) contribute tensions; everything else stays at its chord tones. This is
   what stops `theory_modes` from quietly pardoning most of the chromatic scale, but
   it does mean a dim-stack build gets nothing from that tier beyond slot 5.
