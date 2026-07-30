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
(Within C, **C4 shipped before C1** — C4 grows `styleCommitDb`'s signature and C1's
preview calls that same function, so the doc's order would have meant writing C1
twice. C2, C3, C5 and C6 remain.)
(B8 was pulled forward and is fully shipped — the mode question turned out to be a
chord-context question, so it landed alongside B3 rather than after B7. B6 and B7
shipped together in one pass: B6's stated risk — "before the skill it wrecks you" —
is only true once B7's per-note penalty exists, so shipping B6 alone would have
advertised a downside the game didn't have.)

**Status:** ✅ Task A, B0 (a + b), B1, B2, B3, B4, B5, B7, B8 (core + wiring), B9 and
B10 are SHIPPED on `feat/chord-strength-b0`. **B6 was shipped and then deleted** (its
payout fired on 1% of commits). **Task C was shipped and then reversed in full** —
C4 and C1 landed, an audit of the Db economy showed the Style system they served
shouldn't exist, and Style was cut entirely. C2/C3/C5/C6 are retired with it.
**A commit now has four Db sources, down from nine.** See the simplification notes
immediately below — read them before adding anything back.

### 🔄 Notes from the SIMPLIFICATION pass — TASK C WAS REVERSED

**Task C shipped, was measured, and was then deleted along with the system it was
making legible.** C4 and C1 landed earlier the same day; an audit of the Db economy
that afternoon showed the thing they were polishing shouldn't exist. That sequence is
the lesson, so it's recorded rather than tidied away.

**What prompted it.** A review against the three original goals — build chords
without being punished, make Theory fun to buy, tie chords to melody — found the
first and third in good shape and the second at risk. But the stated premise,
*simplify*, was failing outright: this doc had gone 609 → 1400 lines while
implementing a plan whose thesis was "eight mechanics → one," and a single commit
was moving the Db number **nine** different ways.

#### The audit — `node src/engine/dbaudit.mjs`

A new harness that mirrors `confirmNoteTrack`'s arithmetic and scores 3000 commits
per Theory tier. **Build it before deleting things; it changed every decision below.**

Measured on the pre-cut game (mean 3.98 Db/commit):

| source | share | fires |
|---|---|---|
| track length | 35% | 89% |
| ending bonus | 22% | 44% |
| Style Db | 15% | 40% |
| Drive/Sustain overflow | 13% | 35% |
| P-score top-up | 10% | 35% |
| Harmonic Lock | 8% | 16% |
| discord penalty | −5% | 13% |
| Flair Outside | 2% | 5% |
| chromatic payout | **1%** | **1%** |

Four findings, in order of how much they mattered:

- **🔴 HARMONIC LOCK PAID NOTHING FOR A MAJOR OR MINOR TRIAD.** `LOCK_BONUS_BY_RANK`
  banded at rank 5, and triads are rank 4. The one mechanic built to reward "you
  built a chord and landed the line on it" ignored the two most musical chords there
  are — and since the stack cap is 3 until Blues/Dom7 is bought, **a triad is the
  only chord a new player can build.** Lock measured a flat 0.00 across the first
  three Theory tiers. Fixed: rank 4–5 pay 1, rank 6–7 pay 2, rank 8 pays 3.
- **🔴 THE THEORY LADDER'S FIRST TWO RUNGS WERE ECONOMICALLY INVISIBLE.** Income by
  tier ran 3.25 → 3.31 → 3.30 → 4.83 → 5.20. Eighteen Db spent on Minor Tonality and
  Blues/Dom7 moved income by −0.01. The flat, tier-blind sources were drowning out
  the signal from the ones that respond to Theory.
- **🔴 THE CAPSTONE'S HEADLINE FIRED ON 1% OF COMMITS.** The chromatic payout was
  worth 0.02 Db per commit — 16 Db of ladder buying something a player would never
  see. Every one of its assertions passed. **Tests prove a mechanic works; they do
  not prove it matters.**
- **The pardon economy is worth only ~+0.24 Db across the entire 46-Db ladder**,
  because a pardon can never exceed the penalty it forgives and most tracks carry
  0–1 wrong notes. Left alone deliberately: colour's real payoff is Drive/Sustain
  via B4, which the audit didn't measure. Db answers "did you play it right", colour
  answers "did you play it hard".

#### The cuts — nine Db sources down to four

    earned = max(0, length + ending + lock − penalty)

    length   — how much did you play?
    ending   — where did you come to rest?
    lock     — was that landing in YOUR CHORD?
    penalty  — how many notes fought the key?

**The line that decided every cut: Db pays for FACTS, not for taste.** "You landed on
the 5th" and "your last note was in your chord" are facts a player can hear, aim at
and verify. "That phrase was interesting" is not — and every source cut was some
version of trying to score it.

- **STYLE IS GONE ENTIRELY**, and with it Task C (C1 shipped, C2/C3/C5/C6 retired).
  Its detectors re-scored gestures the game already paid for: `detectStyleRun` was
  written as a generalisation of the Drive boost's own run detectors, and
  `detectRepeatPattern` was *literally the same function* the Sustain boost calls.
  Three gestures, scored twice, in two currencies. It was also assigned rather than
  chosen, so it rewarded a play pattern without ever requiring one — a player could
  ignore their Style completely and lose 0.59 Db a commit. Character flavour
  survives in `data/styles.js`; nothing reads it for scoring.
- **THE PERFORMANCE SCORE NOW FEEDS THE CROWD AND ONLY THE CROWD.** P is the game's
  aesthetic judge — contour, leaps, variety, motifs. That question has no honest
  answer, which made it a bad Db source and makes it a **good crowd source**: a
  crowd's taste is *supposed* to be impressionistic. Nobody minds a fickle audience;
  everybody minds a fickle upgrade bar. P is untouched and still drives excitement,
  loyalty, fans and the Fame multiplier. It just stops minting Decibills.
  → This also answers unresolved item 3 at last: **Theory owns Db, showmanship owns
  Fame.** Two routes to winning, and Theory gates only one of them.
- **The Drive/Sustain overflow no longer becomes Db.** It was 13% of all income paid
  out of the half of a comparison that *lost* — the largest source a player could
  neither see, name, nor aim at. The boosts themselves are untouched.
- **The chromatic payout is deleted.** The run still lands: `detectChromaticRun`
  flips `allInScale`, which feeds `gainFans`. Flair pays the crowd now.

#### The capstone, and a trap inside the fix

`theory_chromatic` was paying **−0.04 Db** — literally less than the rung below it.
The audit showed stack SLOTS are what make the ladder pay (Lock climbs 0.00 → 0.83 on
slots alone), so the capstone now grants **slot 6**, `STACK_CAP_MAX` 5 → 6.

**⚠️ That fix did nothing on its own, and the audit caught it.** The largest chord in
`CHORD_TEMPLATES` was five notes, so a six-note stack evaluated as a plain Dominant 9
— same rank, same Drive/Sustain, same Lock. Slot 6 had nothing to hold. Added
**Dominant 13** and **Minor 11** at rank 8 (6 notes, base 9), with a new +3 Lock band.
Pinned by an assertion that the biggest chord must exactly fill the biggest stack, so
a future slot grant can't be dead on arrival the same way.

#### Results

Mean Db 3.98 → **2.52**, so `DB_UPGRADE_THRESHOLD` drops **6 → 4** to hold pacing —
the honest lever, rather than re-inflating a source deleted for being illegible.

Income by tier, before and after:

    before   3.25  3.31  3.30  4.83  5.20     (flat for three rungs, then a jump)
    after    1.96  2.20  2.41  3.02  3.24     (climbs at every rung)

**Cutting the noise didn't just make Db legible — it un-masked the Theory ladder.**
The flat sources were drowning the tier signal, so the same change served both goals.

#### Process notes worth keeping

- **🔴 A SEEDED-LCG FUZZ WAS DRAWING WITH `seed % n`, AND LOW BITS ARE DEGENERATE.**
  `rnd(2)` returned 0 on **99.7%** of draws, so every power-of-two choice was a
  constant: C1's fuzz generated almost exclusively descending runs and almost no
  consecutive repeats while reporting 4000 cases of coverage, and the audit's first
  run showed the Drive/Sustain overflow as identically zero. Odd moduli looked fine,
  which is what hid it. **Always take the high bits (`seed >>> 15`).**
- **The C1 preview/commit fuzz found a real bug that had nothing to do with C1** —
  the mic voice roll could append a note that erased a Groove spirit's root landing.
  Comparing two independent paths finds things neither path's own tests would.
- **Groove's root bonus had never read the root**: the commit passed `newRootRaw`,
  next turn's root, derived from the track's own last note. Both that bug and its fix
  are gone with Style, but the class of error — passing a plausible-looking variable
  that is silently the wrong one — is not.
- `assert.equal(fn.length, N)` is **not** a way to check a signature: `Function.length`
  stops counting at the first default parameter.

**Assertion groups: 60 → 53.** Six Style groups deleted, three chromatic-payout
groups deleted, plus new ones for the four-source economy, the Lock's triad band, the
6-note chords and the capstone's slot.

### ⚠️ Notes from the B9 / B10 pass — READ THE FIRST ITEM

- **🔴 THE `theory_major` AUTO-GRANT HAD NEVER FIRED ONCE.** The initial-skill
  `useEffect` gated on `unlockedSkills.length === 0`, but `makeInitialNoteState`
  seeds `["amp_1"]` for every spirit, so the condition was false on turn one and
  every turn after. **Every spirit in every playtest has been playing the Major
  Pentatonic — no 4th, no 7th** — while the comment above the grant, the skill's own
  description, and every "46-Db ladder" figure in this document (= 52 list price
  minus theory_major's 6) all assume the full scale is free from the start.
  - **Fixed** to gate on `unlockedSkills.includes('theory_major')`. Emptiness could
    never be the right test while any starting skill exists, and B10 would have
    broken it a second way by giving Ronin `theory_minor`.
  - **⚠️ THIS IS A LIVE BALANCE CHANGE, AND IT IS THE BIGGEST ONE IN THE PASS.** Two
    notes per key move from grey to clean for every spirit. It also means **B7 was
    tuned against a harsher palette than the design intends** — the per-note penalty
    and its 1-note grace were measured in a world where the 4th and 7th cost Discord.
    Re-measure B7 before treating its numbers as settled; the grace may now be too
    generous rather than load-bearing.
  - The branch blurb said "Start on the Major Pentatonic", which was accidentally
    accurate for as long as the grant was broken. Rewritten.
  - Pinned in `b0check` as a regression witness: the test asserts the OLD emptiness
    gate stays closed on a fresh spirit, so the bug cannot silently return.
- **B10 grants Ronin the WHOLE `theory_minor` skill, not just the tier.** Decided
  deliberately over the narrower alternative. Three accepted consequences, all
  documented at the grant in `economy.js` and asserted in `b0check`:
  1. Chord Tone Pardon from turn one — what B10 actually asked for.
  2. He also gets the **minor scale** in `playableScale` and `modeFromStack` may flip
     his key to minor. Fitting for the character, and not separable without a second
     code path that `context.js` explicitly warns against.
  3. `theory_dom7`'s prereq is satisfied, so **his climb is 38 Db against everyone
     else's 46.** That's the price of the flagship, and it's now a test rather than a
     surprise.
  The B0a invariant survives: his seed stack is still a quality-**ambiguous** single
  note, so turn one cannot force-flip his mode despite the tier being live. Asserted
  both ways — a real minor third *does* flip him from turn one, where an ungranted
  spirit is held at major with `reason: 'locked'`.
- **The `driveStack ?? sustainStack` bug is fixed.** `??` only falls through on
  null/undefined and both stacks are always arrays (B0a seeds them with the root), so
  **Wa no Koe never once saw the Sustain Stack.** Now passes both, which is what the
  skill's own text promises and what B4 and B5 already do. Note `checkWaNoKoe` was
  *already* reading both stacks to decide which stat to boost, so the call site was
  inconsistent with the function it called.
- **`THEORY_DISCORD_GRANTS` is a palette table, and now says so.** Its ids gate
  `playableScale` and nothing else: B1 took their combat riders, B3 moved the pardon
  to `CONTEXT_TIERS`, B5 deleted the tritone's damage, B6 turned `discord_4`'s pardon
  into a payout. **The asymmetry worth knowing:** `theory_minor` is absent from the
  table but is the *first rung* of the context ladder — so the table is **not** the
  list of Theory tiers, and a reader who "fixes" it to match will grant a context
  tier through the palette. Asserted, including that every value matches
  `/^discord_\d+$/`.
- **The stale comment B9 points at (~401–408, "tritone feedback, m7 mojo drain") no
  longer exists** — an earlier pass already removed it. Nothing to do.
- **Two new assertion groups (54 total, was 52):** the initial-grant invariant with
  the old gate pinned as a witness, and the palette-table contract. Plus three groups
  for B10 folded in above.
- **Two pre-existing lint errors were left alone,** both in `styleCommitDb`
  (`economy.js` ~492, `no-useless-assignment` on `tier`/`label`). Unrelated to this
  pass; Task C will be in that function anyway.

### Notes from the B6 / B7 pass

- **The double-pay decision: IT STACKS.** At `theory_chromatic` a chromatic run's
  notes are pardoned as approach notes and so already pay Drive/Sustain under B4;
  B6 pays the same run +3 Db on top. The alternative — suppressing colour routing
  for notes inside the run — was rejected for three reasons, recorded at
  `chromaticPayout` in `context.js`:
  1. It needs run **membership** threaded through `classifyTrack`, which today
     classifies each note independently. That's a new cross-note dependency in the
     one function B4, B5, B7 and the log all read, paid to make a capstone smaller.
  2. **The stacking isn't automatic.** Approach Notes only pardons a note whose
     *next* note is a chord tone, so a run collects Drive only where it actually
     resolves into the harmony. A run that wanders pays the +3 and nothing else.
     That's a skill gradient, not a loophole — and it's asserted in both directions.
  3. It reads correctly: "the run paid Db and the chord it landed on paid Drive" is
     one sentence, which is the bar Task C sets.
  If it proves too strong in play, **the lever is the curve, not the routing.**
- **⚠️ B6's real substance was deleting the blanket pardon, not adding the payout.**
  The old rule set `allInScale = true` for the whole track, which pardoned every
  *unrelated* wrong note elsewhere in the melody too — one chromatic run bought
  total discord immunity. That's gone. The run's own notes are now pardoned only
  where the Approach tier genuinely pardons them, and anything else you got wrong
  still costs under B7. Without this, B7 would have been trivially bypassed.
- **`allInScale` survives, but only for flavour.** It still flips true on a 3+ run
  and now feeds exactly two things: `gainFans` and the maj3 gated ending. A
  deliberate chromatic run should read to the *crowd* as intent rather than as a
  fistful of mistakes. The **scoring path no longer reads the flag at all** — that
  decoupling is the thing to preserve if this is ever revisited.
- **B6's payout lands in the same Db pot as the ending and the lock, *before* the
  discord subtraction.** One arithmetic path, and a run that leaves the rest of the
  track in ruins still pays for the ruins. Because the payout starts at 3 and the
  penalty is floored at 3, a run is never a net loss at the capstone — asserted
  directly, along with the mirror case that below the capstone it always *is* one.
- **B7's grace stacks with `freestylePardon`,** so Intergalactic 0 gets two free
  wrong notes. Deliberate: freestyle also feeds the P-score and the crowd, so it
  isn't merely a discount on this one line, and it's his identity. Note this differs
  from the spec snippet, which computed the grace off the raw `classifyTrack` count
  and dropped freestyle entirely. If two free notes proves too generous, subtract
  the grace before the freestyle pardon rather than after.
- **`hasChromMastery` and the "penalties halved" effect are both gone.** The halving
  never lived in `applySkillEffects` (~3531) where this doc said it did — it was
  inline in the DB scoring block. B3's Approach Notes tier plus halving was near
  total immunity: two effects doing one job, one of them invisible.
- **`staggerDuration` is deleted.** B1 kept that 3/4/5+ → 1/2/3 curve alive purely
  as a guess at B6's shape. B6 landed on 3/4/5+ → 3/4/5 capped, so the guess was
  wrong and the function is gone.
- **The skill's advertisement now fires for players who don't have the skill.** The
  "a run would pay you +N" flash is gated on run *length*, not on `chromClimbActive`
  — `discord_4` is **granted by** `theory_chromatic` (`THEORY_DISCORD_GRANTS`), so a
  spirit holding the climb but not the capstone barely exists, and gating on it
  would have hidden the pitch from exactly the players who need to see it.
- **Copy rewritten in four places** plus the tutorial: the skill-tree description
  (which still advertised the deleted halving and never mentioned Approach Notes at
  all — arguably the tier's *main* effect), the unlock log line, the commit flash,
  the commit log fragment, and `TutSection_Dischord` + the Decibills panel, both of
  which taught the old flat −1. The discord flash now shows the count *and* the
  charge, since with the grace they're different numbers and otherwise it reads as
  a bug.
- **Six new assertion groups in `b0check.mjs` (49 groups, was 43):** the payout
  curve at every length 0–12 including the cap and NaN-safety, zero at all four
  lower tiers, `detectChromaticRun` actually registering the lengths B6 prices, the
  double-pay documented in *both* directions (stacks when the run resolves, doesn't
  when it wanders), B7's curve/grace/floor/monotonicity, the penalty falling as the
  ladder widens, and B6+B7 on one track proving the gain/loss asymmetry.
- **⚠️ Item 2 (STYLE_DB_CAP) moved again, and this time upward a lot.** Best-case Db
  is now ~5 base + 2 lock + 5 chromatic run = **~12**, against `STYLE_DB_CAP` 3. The
  B2-era fear that Style would become too large a share of Db is now firmly the
  wrong direction. **Re-measure in Task C, don't retune from the old estimate.**
- **⚠️ The bot re-tuning flagged in the B5 pass is now due.** `botPlanStackCommit`'s
  Brawler tritone rule traded a −1 Db for a damage effect that no longer exists,
  and B7 has now made the Db half of that trade cost up to 3. The bot also has no
  concept of the chromatic payout, so `theory_chromatic` is worth strictly more to a
  human than to a bot that never builds runs. Not blocking, but it's real now.

### Notes from the B5 pass

- **The tritone's "Damage ×2" is gone, effect and all.** This was the open
  `feedbackBoost` question and it resolved by deletion. The measurement that
  settled it: damage is **banded and hard-capped** — Thrash 1/2/3/4 by margin
  (cap 4), Sonic 1–2 (cap 2) — against a `maxVibe` of **4–5**. An honest ×2 would
  have one-shot every spirit in the game from full health, so there was no version
  of the advertised effect worth shipping. Removed: the `feedbackBoost` field,
  `newFeedbackBoost`, the HUD badge, the commit flash, the log fragment, and
  `consumeAttackCharges` plus all three of its call sites (the charge was its only
  remaining job after B1). **No melody trigger now reaches combat at all** — B1
  cut four of the five, this cut the fifth.
- **What the tritone keeps:** its red colour, the `discord_3` "Devil's Interval"
  unlock, and **+1 Performance Score** (`economy.js` ~105). All three do exactly
  what they say. `trackHasTritone` therefore survives — it feeds the P-score kernel
  and nothing else. The `discord_3` description and the tutorial's interval table
  both claimed the feedback charge and were rewritten.
- **⚠️ Harmonic Lock requires an ending bonus to escalate.** The spec says it
  "stacks on top of B2's ladder" and gives the arithmetic `3 + 2 = 5`, so a track
  whose final note earns *no* ending bonus gets no lock even if that note is a
  chord tone. This makes B5 meaningfully tighter than "land on any chord tone": the
  last note must resolve at the **key** level (5th/4th/octave) *and* belong to a
  chord worth building. If it plays as too demanding, this gate is the lever.
- **`scoreTrackDB` now returns `endingBonus` and `endingKind`.** B5 needed to know
  an ending bonus existed, and the only other signal was the `breakdown` strings —
  which are display copy and will change. `endingBonus` is the ending's exact share
  of `points`, asserted so the two can't drift.
- **`stackContext` gained a `tones` set, and it is NOT `chordTones`.** `tones` is
  what the chord *is* (literal notes + its own template); `chordTones` is the pardon
  set, one tier wider, including the seventh the quality merely *implies*. B5 reads
  `tones`, so **landing on a maj triad's ♮7 pays nothing** — that note is an
  implication, not the chord, and paying for it would let a player collect on a
  chord they never built. Asserted both ways.
- **B5 takes no `unlockedSkills`,** deliberately. Harmonic Lock reads what the stack
  IS, and no tier changes that. The pardon ladder is a separate question that
  `classifyTrack` already answers.
- Stack selection reuses **B4's rule verbatim** (higher rank wins, ties to Drive),
  decided inside `harmonicLock` so there is exactly one tie-break in the codebase.
  Change it and you must change `claimAt` and both assertion groups together.
- **⚠️ B6 still has the double-pay decision from the B4 pass,** now more concrete:
  at `theory_chromatic` a chromatic run's notes are pardoned as approach notes and
  so already pay Drive/Sustain under B4, and B6 wants to pay the same run +3 Db.
  Decide whether B6 suppresses the color routing inside the run or is priced
  knowing it stacks.
- Five new assertion groups in `b0check.mjs` (**43 total**, was 38): all 14 rank
  bands, rank-0 stacks claiming nothing, the `tones`-vs-`chordTones` distinction in
  both directions, stack selection matching B4, and the `scoreTrackDB` contract
  including the spec's headline `3 + 2 = 5`.
- **Tidied while in there:** the commit log line still ended `· Next RN: X (pick
  Major/Minor)`. B8 deleted that prompt; the parenthetical is gone.
- **⚠️ Bot note:** `botPlanStackCommit`'s Brawler tritone rule was justified in
  comment by "Damage×2 worth the −1 DB." That justification no longer exists. The
  behaviour is kept — the tritone still pays +1 P, and after B4 a tritone the bot's
  own stack legalizes also pays Drive — but it wants re-tuning once **B7** makes the
  −1 DB half of that trade more expensive.

### Notes from the B4 pass

- **Color folds into the raw boost, it does not add on top.** B4 said "feeds
  `tempDrive`/`tempSustain`, exactly like `driveBoostFromRun` already do," and those
  two are not additive — they're **highest-wins with the loser discarded into Db**.
  So the shipped line is `driveBoostFromRun(runLen) + colorDrive`, and the sum then
  runs through the existing comparison untouched. The alternative (add color after
  `newTempDrive` settles) would have made color the only boost in the game that
  can't be discarded — a guaranteed +2 that ignores the overflow economy the other
  two sources pay into.
- **A consequence worth knowing:** because color raises `rawDriveBoost`, it can push
  the total past `prevTempDrive` and thereby **convert a stale temp Drive into Db**
  as overflow. That's the existing machinery behaving normally, but it means color
  notes have a second-order Db effect the design didn't predict. It's small and it
  points the right way (color is never dead value), so it shipped as-is.
- **Mojo Drain blocks the color payout,** matching the other two boosts. The flash
  line says so out loud (`— Mojo Drain, no payout`) rather than silently paying
  nothing, because "your chord legalized 2 notes" with no Drive movement next to it
  reads as a bug.
- **Routing was already done by B3.** `classifyTrack` stamps each pardoned note with
  the stack that authorized it and `claimAt` resolves "legal in both" to the higher
  `rank` with ties to Drive. The commit site counts `contextPardons` and nothing
  more — it does **not** re-derive which stack wins. If you ever need to change the
  tie-break, `claimAt` in `context.js` is the only place it lives.
- **⚠️ B6 has a double-pay decision waiting.** At `theory_chromatic` the notes in a
  chromatic run get pardoned as approach notes, so under B4 they already pay
  Drive/Sustain. B6 then wants to pay the same run **+3 Db** as its deliberate
  exception. That's both currencies for one gesture. Either B6's payout should
  suppress the color routing for notes inside the run, or the exception should be
  priced knowing it stacks. **Decide this in B6, not by accident.**
- Three new assertion groups in `b0check.mjs` (38 checks total, was 35): every
  pardon pays exactly **one** stack (never zero, never twice), rank breaks the tie
  and the tie goes to Drive across 20 repeat runs, and buying a higher tier never
  *reduces* what a track pays. The `min(2, n)` cap is restated in the test as a
  reminder that the real one lives in the JSX and can't be imported.

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

### Notes from the B8 wiring pass

- **`payModeBonus` is the old `declarePivot`.** Same bonus maths, same Mojo Drain
  block on the minor branch, no respell (that moved to turn start) and no trigger of
  its own — it is called by an effect watching `pendingModeBonus`. B1's cleanup list
  mentions `declarePivot` by name; look for `payModeBonus`.
- **`pivotPending` is a zombie by design.** Never written true, ~30 read sites left
  intact and all reading false. Anyone tempted to finish the removal should do it as
  its own commit, not folded into a mechanic change.
- **New fields on the note sheet:** `modeReason` (`'quality' | 'ambiguous' |
  'locked'`), `modeChordName` (e.g. `"C Minor triad"`, what the HUD cites), and the
  transient `pendingModeBonus`. The first two are what any future UI should read to
  explain the key — do not re-derive the mode in a component, because the live stack
  may already imply something different from what this turn locked in.
- **The HUD carries a "↻ next turn" hint** when the current Drive Stack would derive
  a different mode than the one in force. Without it, stacking a ♭3 mid-turn looks
  like nothing happened — the derivation is deliberately deferred to turn start so
  the stock can't respell under already-placed notes, and that delay needs saying out
  loud. Task C's live style prediction should sit next to this line, not compete with it.
- **Not done, deliberately:** the bot no longer has any mode preference. Its old Flair
  minor lean lived in the deleted pivot branch; giving it back means teaching
  `botPlanStackCommit` to stack a minor third on purpose. Worth doing when B4 lands,
  since B4 gives stacking a scoring reason.

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
- ~~`feedbackBoost` is set at commit and cleared **only** by `consumeAttackCharges`
  on a hit — there is no turn-start reset, so that call must survive. Separately:
  nothing actually multiplies damage by `feedbackBoost`; the "Damage ×2" is a HUD
  badge only. **Pre-existing gap, worth a decision before B5.**~~
  **✅ RESOLVED in the B5 pass — by deletion.** The effect, the field, the badge and
  `consumeAttackCharges` are all gone. See "Notes from the B5 pass".
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
  `statusShield` from `noteStates`. Also `mojoDrain` in `payModeBonus` (`isMojoDrained`
  — the function that was `declarePivot` before B8) and in `driveBoostFromRun`'s call
  site.
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

- `theory_minor` still gates minor as it does today (see B8 — it now gates whether a
  minor *stack* can move the key, rather than whether a button can be pressed) — the
  pardon is *additional*, not a replacement.
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

### B4 — Color notes pay the stack that authorized them ✅ SHIPPED

A pardoned off-scale note isn't merely forgiven, it **earns** — but in Drive/Sustain, not Db.

- Pardoned because of the **Drive Stack** chord → **+1 Drive** (tension = aggression).
- Pardoned because of the **Sustain Stack** chord → **+1 Sustain** (color = width).
- Legal in both → route to the stack whose chord has the higher `rank`; tie goes to Drive.

**Cap at +2 per stack per commit.** Feeds `tempDrive` / `tempSustain`, exactly like
`driveBoostFromRun` and `sustainBoostFromPattern` already do.

**Shipped in** `confirmNoteTrack` (`src/rlsw-simulator-v3_8_1.jsx` ~3110–3145) as
`colorDrive` / `colorSustain`, folded into `rawDriveBoost` / `rawSustainBoost` so the
sum flows through the existing highest-wins/overflow-to-Db comparison. Blocked by
Mojo Drain like its two neighbours. See "Notes from the B4 pass" at the top for the
fold-vs-add reasoning and the B6 double-pay warning.

**Why not Db:** the game already teaches a positional rule — *the middle of the track
builds Drive/Sustain* (`driveBoostFromRun`, `sustainBoostFromPattern` read the interior),
*the ending pays Db* (`scoreTrackDB` reads the last note). Routing color to Db would have
forced players to hold a second mental column of "which notes are for the middle." Routing
it to Drive/Sustain keeps the existing rule intact and adds nothing to memorize.

Player-facing model stays two sentences:

> **Land on the 5th, 4th, or octave.** → Db
> **Notes your chord makes legal pay you.** → Drive/Sustain, into the stack that legalized them

---

### B5 — Harmonic Lock (the Db escalation) ✅ SHIPPED

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

**Shipped as** `harmonicLock(lastNote, driveStack, sustainStack)` in
`src/music/context.js`, wired at the Db scoring block in `confirmNoteTrack`
(`src/rlsw-simulator-v3_8_1.jsx` ~3195–3215). Returns
`{ bonus, stack, rank, chordName }`; the flash and log both cite `chordName` so the
player sees which chord paid.

```js
/** B5 — the ending escalation for landing on a stack's chord. Pure.
 *  Reads `stackContext().tones` (the chord itself), NOT `chordTones` (the pardon
 *  set, which includes the seventh the quality only implies).
 *  Takes no unlockedSkills: no tier changes what the stack IS. */
export function harmonicLock(lastNote, driveStack, sustainStack)
```

⚠️ **Requires an ending bonus** (`scoreTrackDB().endingBonus > 0`) — it escalates
that bonus rather than standing alone. See "Notes from the B5 pass" at the top for
why, and for the `tones` vs `chordTones` distinction.

---

### B6 — Chromatic run: pardon becomes payout ⏹️ SHIPPED, THEN DELETED

> Deleted in the simplification pass: the payout fired on **1% of commits** (0.02 Db
> each). The run still pays the crowd via `allInScale`. Chromatic Mastery sells the
> 6th stack slot instead.

**Shipped as** `chromaticPayout(runLen, unlockedSkills)` in `src/music/context.js`,
wired at the Db scoring block in `confirmNoteTrack` (`src/rlsw-simulator-v3_8_1.jsx`
~3222). Returns `{ db, runLen }`; the flash and log both cite `runLen` so the player
can see the payout scales with it. `staggerDuration` in `cadence.js` is deleted (its
curve was a wrong guess at this one). **The double-pay question resolved as "it
stacks"** — see the B6/B7 notes at the top for the three reasons and the lever.

⚠️ **The load-bearing half of this change is a deletion:** the old blanket
`allInScale = true` pardon is gone from the scoring path. It used to excuse every
unrelated wrong note in the track, which would have made B7 trivially bypassable.
`allInScale` still flips true on a 3+ run but now feeds only `gainFans` and the maj3
ending — flavour, not Db.

```js
/** B6 — the chromatic run's Db payout. Pure. Gated on theory_chromatic
 *  (unlike B5, which takes no skills): the run is worth nothing until the
 *  capstone says it is. 3→+3, 4→+4, 5+→+5. */
export function chromaticPayout(runLen = 0, unlockedSkills = [])
```

---

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

### B7 — Discord penalty gets teeth ✅ SHIPPED

**Shipped as** `discordPenaltyFor(unpardoned)` in `src/music/context.js` (kept pure
and next to `countUnpardoned`, which supplies its input), wired at the Db scoring
block ~3213. The old `discordFlat` / `hasChromMastery` halving / `chromClimbActive`
full pardon are all gone.

⚠️ **The grace stacks with `freestylePardon`,** so Intergalactic 0 gets two free wrong
notes. Deliberate — see the B6/B7 notes. This differs from the snippet below, which
computed the grace off the raw count and dropped freestyle. If two proves generous,
subtract the grace *before* the freestyle pardon.

```js
/** B7 — per-note discord penalty. Pure. min(3, max(0, unpardoned − 1)).
 *  `unpardoned` is countUnpardoned(classifyTrack(...)) with any spirit-specific
 *  pardon already subtracted. */
export function discordPenaltyFor(unpardoned = 0)
```

---

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

### B8 — Major/Minor pivot: **REVERSED.** The chord declares the mode, not the player ✅ SHIPPED

Pure core (`modeFromStack` in `src/music/context.js`) **and** the turn-flow wiring
are both in, covered by 35 checks in `b0check.mjs`. The per-turn Major/Minor prompt
no longer exists anywhere in the game.

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

#### Wiring — as shipped

The plan's lowest-risk shape was kept: **`pivotPending` was not ripped out.** Its
~30 read sites are still there, all reading false, gating nothing. Nothing sets it
true, so no turn can deadlock on it, and no 30-site surgery had to land in the same
commit as a mechanic change.

1. All three writers now derive instead of prompting. `startNewTurnNotes` derives,
   respells root + stock and stages the bonus; `resolveTransposeCard` derives and
   respells around the new root; `makeInitialNoteState` ships `pivotPending: false`
   with `modeReason: 'ambiguous'` — B0a's single-note seed has no third, so turn one
   can't force a mode. A `b0check` case asserts the seeded sheet agrees with what
   `modeFromStack` would derive from its own stack, so if that seed ever grows a
   third the test says so.
2. **The refill had to move inside the derivation.** Not in the plan, and the reason
   is worth recording: `startNewTurnNotes` drew this turn's new stock notes with
   `randomNote(ns.rootNote, ns.scaleMode)` — *last* turn's mode. When mode was
   declared afterwards, `declarePivot`'s respell cleaned that up. With the respell
   moved to turn start, drawing first would spell fresh notes in the old mode and
   nothing would come along behind to fix them. Mode is now derived **before** the
   refill; fresh notes are drawn in the new key and carried notes are respelled into
   it, in one pass.
3. `declarePivot` is gone as such — it became **`payModeBonus(spiritId)`**, which does
   only what the reducer can't: pay the bonus, log it, award a skill if the DB bar
   tipped. The respell moved to turn start (see 2), so the applier no longer touches
   spelling at all. Staging works as planned: the reducer writes `pendingModeBonus`,
   a small effect pays it and clears the flag, so it fires exactly once and
   `advanceDB` never runs inside a functional update.
4. **UI**: ~140 lines deleted — both buttons and the two-column "how would your stock
   look in each mode?" preview. In its place a read-only line naming the mode and
   citing the chord: "☀️ C MAJOR — C Major triad sets the key", "☀️ C MAJOR — C Power
   chord — no third to read, mode held", "🔒 C MAJOR — C Minor triad wants minor —
   🔒 unlock Minor Tonality". The amber Root badge treatment (was "PICK MODE") is
   reused for the `locked` state, so the one case worth interrupting for is the one
   that still gets colour.
5. **Bot**: the `ns.pivotPending` branch is deleted. Flair's minor lean is noted as
   belonging in `botPlanStackCommit` if anywhere — a bot that wants minor should
   stack a minor third and earn it the way a player does. Not implemented; the bot
   currently takes whatever mode its stacking happens to produce.
6. ⚠️ Mode is derived **at turn start only**. Two `b0check` cases defend it from the
   other side: derivation is a **fixed point** (feeding the previous mode back in with
   an unchanged stack never drifts the key, so an untouched stack can't oscillate),
   and the turn-start respell is **stable** (five consecutive respells never walk a
   note's name, so a held note can't rename itself while the player watches).

**⚠️ Two decisions this plan didn't cover.**

- **Transpose does not re-pay the mode bonus.** The old flow re-opened the prompt, so
  a transpose paid a second +1 Db — affordable when it cost the player a decision.
  Automatic, it would make Transpose a Db battery. Its `usableWhen` was relabelled
  `'during-pivot'` → `'before-build'` (a descriptive field; nothing branches on it).
  A transpose can therefore change the mode without paying for it, which is the
  intended asymmetry: the card buys you a root, not a bonus.
- **The `pivot` HUD stage and its tutorial tip are gone, and the steps renumbered**
  Chord → Melody → Move & Act as **1–2–3**. `turnStep` now initializes to `'chord'`
  and `endTurn` resets to `'chord'`. The pivot tip's content wasn't discarded — it
  moved into the chord tip as a third page anchored on the new mode line, which is
  where the player now actually influences the key. Player-facing copy that promised
  a pivot was corrected in the same pass: `theory_minor`'s skill description and
  unlock log ("declare Minor at the pivot" → "stack a minor third"), the Transpose
  and Chromatic Shift card blurbs, and the tutorial's "⚡ THE PIVOT — set your key
  first" panel, now "⚡ THE KEY — your chord sets it".

---

### B9 — Skill descriptions and grants table ✅ SHIPPED

All five Theory `desc` strings now state the scale expansion **and** the context tier
**and** the slot unlock; the five matching `applySkillEffects` unlock logs were
rewritten the same way (the unlock moment is the one time the player is guaranteed to
be reading). The branch blurb was corrected. `THEORY_DISCORD_GRANTS` keeps its
mappings and gained a comment block explaining what its ids no longer do — plus the
`theory_minor` asymmetry, which is the trap in that table. **The stale comment at
~401–408 was already gone.** See the B9/B10 notes at the top, especially the
`theory_major` auto-grant bug this pass uncovered.

---


**`SKILL_TREE`** (~line 457) — each `desc` should state the scale expansion **and** the
context tier **and** the slot unlock where applicable. Suggested:

| Skill | Cost | Sells |
|---|---|---|
| `theory_major` | 6 *(free at start)* | The 4th & 7th go Discord-free — your Major scale is complete. |
| `theory_minor` | 8 | Stack a minor third and the song follows you into a minor key. **Chord Tone Pardon** — notes sitting in your stacks are never Discord. |
| `theory_dom7` | 10 | The ♭7 joins your clean palette. **Play the Changes** — your stack's whole implied chord goes clean. **+1 stack slot (4).** |
| `theory_modes` | 12 | **Extensions** — your chord's tensions (♯4, nat-6, ♭9, 9) go clean and pay Drive/Sustain. **+1 stack slot (5).** |
| `theory_chromatic` | 16 | **Approach Notes** — any note is clean if you land the next one on a chord tone. Chromatic runs pay big. |

**`applySkillEffects`** log lines (~3526–3531) need matching rewrites; the current
`theory_chromatic` line ("All Discord penalties are halved") is now wrong per B6.
✅ `theory_minor`'s `desc` and its unlock log were already corrected during the B8
wiring pass — they promised "declare Minor at the pivot", which stopped being true
the moment the prompt was deleted. The rest of the table is still outstanding.

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

### B10 — Wa no Koe: promote, don't replace ✅ SHIPPED

Ronin starts with `theory_minor` in `unlockedSkills` (`makeInitialNoteState`,
`economy.js`) — **the whole skill, not just the tier**, with three accepted
consequences recorded in the B9/B10 notes above and asserted in `b0check`. The
`driveStack ?? sustainStack` bug is fixed to read both stacks. Wa no Koe's `desc` and
unlock log now describe it as the amplifier on a pardon he already owns.

---


Cosmic Ronin's passive (`applyWaNoKoe`, line 6752 → `checkWaNoKoe`) is melody/chord
alignment for +1 Drive/Sustain — i.e. this whole system, as one character's signature.

Don't cut it. **Grant Ronin the `theory_minor` tier (Chord Tone Pardon) for free from turn
one**, and let Wa no Koe stack on top as his personal amplifier. He becomes the character
who plays over the changes natively — the branch's flagship and its in-game tutorial —
instead of the character whose gimmick the tree obsoleted.

Note `applyWaNoKoe` currently reads `driveStack ?? sustainStack` (line ~3182), which only
ever looks at the Drive Stack since it's never nullish. Worth fixing while you're in there.

---

## Task C: Make Style Legible — ⏹️ RETIRED IN FULL

> **The Style system was deleted.** C1 and C4 shipped and were reversed; C2, C3, C5
> and C6 are retired unbuilt. Kept below as the record of a plan that was correct
> about its own premise (Style was illegible) and wrong about the remedy (it was
> illegible because it was redundant, not because it was hidden).

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

### C1 — Live style prediction (the core change) ⏹️ SHIPPED, THEN REVERSED

> Deleted with the Style system it previewed. The technique was sound and may be
> worth reviving for the four surviving Db sources, which are all pure functions of
> the provisional track. Its preview/commit fuzz found a real bug on the way out.

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

### C4 — Style × chord context (the balance fix) ⏹️ SHIPPED, THEN REVERSED

> Deleted with Style. Note the problem C4 existed to solve — Theory skewing the
> styles against each other — dissolved rather than being solved: with no Style
> there is no skew.

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

**Where the tests live:** `node src/engine/b0check.mjs` — 60 assertion groups covering
Task A, B0, B2, B3, B4, B5, B6, B7, B9, B10, **C4, C1**, the initial-grant invariant,
the speller and B8 (core + wiring). `npm run test:engine` is
still broken on main (pre-existing `.png` import chain in `data/spirits.js`); fold
`b0check` into `selftest.mjs` once that's fixed. Its stale init-sheet block was
corrected in passing anyway — it still asserted B0a's removed power-chord seed.

⚠️ **`vite build` cannot be verified in the Linux sandbox** — loading the `vite`
module there dies with a bus error before any transform runs, so this pass was
checked with `esbuild` parse runs over every touched file plus `b0check`. **Run a
real build on Windows before pushing.**

⚠️ **`eslint` on `rlsw-simulator-v3_8_1.jsx` did not finish in the sandbox either** —
it ran past ten minutes on the 13.9k-line file and was abandoned, so the C1 render
block and the `confirmNoteTrack` edits are **parse-verified only** (esbuild) and have
not been lint-verified. `cadence.js`, `economy.js` and `b0check.mjs` all lint clean
apart from the pre-existing `analyseTrack` trio. **Lint the simulator on Windows
alongside the build.** The one rule worth checking by hand is
`react-hooks/exhaustive-deps`: `stylePreview` is deliberately *not* memoised (see the
comment there), so there is no dependency array for it to complain about.

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
- B8 wiring: the initial sheet ships a derived mode rather than a pending prompt;
  derivation is a fixed point across turns; turn-start respelling is stable across
  repeats; buying Minor Tonality promotes a `locked` stack and never demotes any
  other stack.
- `modeFromStack` across quality / ambiguous / locked.
- B4 routing: every pardon pays exactly one stack (never zero, never twice) across
  210 track×stack×tier combinations; rank breaks the tie and the tie goes to Drive;
  buying a higher tier never reduces what a track pays.
- B5 Harmonic Lock: all 14 rank bands; rank-0 stacks (single, cluster) claiming
  nothing; `tones` vs `chordTones` in both directions (an implied ♮7 pays nothing, a
  placed one pays 2); stack selection matching B4; and the `scoreTrackDB`
  `endingBonus`/`endingKind` contract including the spec's headline `3 + 2 = 5`.

- B6 chromatic payout: the curve at every run length 0–12 including the +5 cap and
  NaN/garbage safety; zero at all four tiers below the capstone; `detectChromaticRun`
  registering the exact lengths B6 prices (ascending, descending, partial, zigzag
  rejected, whole steps rejected); and the **double pay asserted in both
  directions** — it stacks when the run resolves onto a chord tone, it does not when
  the run wanders.
- B7 discord penalty: the full curve 0/0/1/2/3/3/3, the first-discord grace, the
  floor of 3, monotonicity to 20 notes, never negative or NaN, and explicit
  `notEqual` checks against the old flat −1 so the change can't silently revert.
- B7 × the ladder: the penalty falls monotonically as tiers are bought (3 at tier 0
  on a four-wrong-note track, less at the capstone) — buying Theory can only ever
  reduce it.
- B6 + B7 on one track: the run is a **net gain** at the capstone and a **net loss**
  below it, which is the asymmetry the spec's risk framing depends on.

⚠️ **Two pre-existing lint errors are unrelated to this pass** and were left alone:
`analyseTrack`'s three unused params (`cadence.js` ~265) and an unused `iv` in the
tutorial's interval reference (`content.jsx` ~524).

- B10: Ronin's grant reaching the pardon ladder on turn one; the B0a ambiguous-seed
  invariant surviving the free tier (and a real minor third still flipping him); and
  the accepted 38-vs-46 Db ladder cost, documented rather than accidental.
- The initial-grant invariant: every spirit starts with a non-empty skill list, so
  emptiness can never gate the `theory_major` grant — **with the old broken gate
  asserted to stay closed**, as a regression witness.
- B9: `THEORY_DISCORD_GRANTS` grants no context tiers and only ever hands out
  `discord_N` palette flags.

Added for C4 / C1:

- **C4 back-compat:** an absent, empty, `null` or garbage context reproduces pre-C4
  scoring exactly, through the detectors and through `styleCommitDb` — a tier-0
  spirit must not be able to tell C4 shipped.
- **C4 Shred (Chromatic Passing):** the same track scores 0 without the pardon and
  ×5 with it; trailing colour can't pad a run and leading colour can't open one (it
  has to be *passed through*); a pardon doesn't excuse an illegal interval; and the
  contour-turn bonus agrees with the tier rather than contradicting it.
- **C4 Groove (Locked In):** a colour vamp goes from tier 0 → tier 3 while an
  all-diatonic vamp is untouched by holding a context; both halves of
  `detectRepeatPattern` carry the doubling; **and the context-free default is pinned,
  because the universal Sustain boost shares that detector and must not see one** (B4
  already pays pardoned notes into Sustain — passing a context there would pay the
  same note twice through the same stack).
- **C4 the landmine, from three directions:** pardoning *every* off-note in a Flair
  track changes the payout by zero; the fully-pardoned track still returns
  `tier > 0`; `detectResolvedDiscords` demonstrably *ignores* a third argument while
  the other four detectors demonstrably read theirs (so the pair can't both pass by
  the context being wired up nowhere); plus a source check that the word "context"
  never appears inside that one function.
- **C4 monotonicity:** across 225 style×track×context combinations, widening the
  context can only ever hold or raise the payout — for **all three** styles. That is
  the entire point of C4 and it is now a test.
- **C4 the `newRootRaw` witness:** asserted in both directions, with the old argument
  pinned as a regression witness that pays a bonus it did not earn.
- **C4 Flair "Outside":** pays exactly what B4 would have paid (same caps, 0–4), the
  cap never invents income, and it is asserted to be *allowed* above `STYLE_DB_CAP`
  so "why is Flair over cap?" reads as intent rather than a bug.
- **C1 preview/commit agreement:** 4000 fuzzed style×track×context×root cases,
  deterministic seed, with interleaved partial-track preview calls between the two
  reads. Also asserts purity (no argument mutation, no drift over 20 identical
  calls) and that a missing `keyScale` returns zero rather than throwing, since the
  preview can render before a scale exists.
- **C1 the floor:** driven through the real `micBonusNote` selection rule, asserting
  the roll can only ever raise the payout, that the guard substitutes nothing but the
  root, and that **it only ever fires for Groove** — a substitution anywhere else
  means a new non-monotone rule was added and the reasoning needs revisiting.
- **The fuzz asserts its own warmth** (see the notes at the top): the run fails if
  fewer than a quarter of cases score, or if any one style is paid fewer than 100
  times.

Still to add: **re-measure B7 against the corrected (post-auto-grant-fix) palette**,
then C2 / C3 / C5's cases. ⚠️ **C6's measurement now has three new inputs**: the
Groove root-bonus fix (probably *reduces* Groove income), Flair's uncapped Outside
(0–4 Db that no other style can earn), and C1 making all of it legible enough that
players will start hitting the ceilings deliberately.
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
   *Still open — B3 didn't touch it, and B5 left it alone deliberately: with the
   tritone's damage effect deleted, `hasGatedEnding` and the tritone's +1 P are the
   only things those endings still pay, which is an argument for keeping them.*
2. **Do Style Db and the P-score top-up need retuning** once B2 halves base income —
   `STYLE_DB_CAP` is 3 against a new best-case track of ~5, so Style becomes a much larger
   share of Db than it was designed to be. See Task C.
   **⚠️ B5 moved this number.** Best-case Db is now ~5 base + 2 Harmonic Lock = **~7**,
   so `STYLE_DB_CAP` 3 is a smaller share than the B2-era estimate — the opposite
   direction from what this item feared. Re-measure before retuning; B6 and B7 will
   move it again.
6. ~~**Does B6's chromatic payout double-pay with B4?**~~ ✅ **RESOLVED — yes, and
   deliberately.** It stacks and the +3/+5 is priced knowing it stacks; suppressing
   colour routing inside the run was rejected because it needs run membership
   threaded through `classifyTrack`, because the stacking is conditional on the run
   actually resolving (so it's a skill gradient, not a flat bonus), and because it
   reads correctly in one sentence. Asserted in both directions. **The lever if it's
   too strong is the payout curve, not the routing.** Full reasoning at
   `chromaticPayout` in `context.js` and in the B6/B7 notes at the top.
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
