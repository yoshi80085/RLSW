# THEORY ROUTES DESIGN — 🎼 making the ladder a technique instead of a licence

> **For AI editors + Alex.** A proposal to split the Theory skill ladder into a
> shared capacity spine and a per-Spirit technique branch. Written 2026-08-15
> out of a design conversation. Companion to `BOT_STRATEGY_HANDOFF.md` §3.2 (Db:
> unlock vs. fuel), `CHARACTER_HANDOFF.md` (the kits), `ECONOMY_HANDOFF.md`.
>
> ⚠️ **NOTHING HERE IS IMPLEMENTED.** This is a design argument and a route
> sketch. Every claim about current behaviour is cited to the constant or
> function it came from and was read out of source during the conversation that
> produced this doc; every claim about *proposed* behaviour is a proposal.

---

## 0. The diagnosis — every Theory rung is a permission

Walk the current ladder and ask what each rung lets you DO:

| Rung | What it actually does |
|---|---|
| `discord_1` Blues Lick | the ♭7 stops costing you (major only) |
| `discord_2` Borrowed Chord | the maj3 stops costing you (minor only) |
| `discord_3` Devil's Interval | the tritone stops costing you (both modes) |
| `discord_4` Chromatic Climb | a run of 3+ stops costing you |
| `theory_dom7` | +1 stack slot |
| `theory_modes` | +1 stack slot |
| `theory_chromatic` | +1 stack slot |
| `theory_sus` | one specific ending pays +1 Performance Score |
| pardon tiers (`chord`/`extension`/`approach`) | your chord excuses more notes |

That is **one idea, stated nine times: *this used to be wrong, now it isn't.***
Roughly 46 Db of ladder spent removing penalties and buying shelf space.

**And the idea has a mathematical ceiling, which the codebase already measured.**
From the B4 comment in `confirmNoteTrack`:

> *"The Db audit found the pardon ladder worth only ~+0.24 Db per commit across
> all 46 Db of Theory — because a pardon can never be worth more than the penalty
> it forgives, and most tracks carry 0–1 wrong notes."*

`discordPenaltyFor` gives the first wrong note free and floors at 3, so the whole
pardon ladder is bidding against a penalty worth **at most 3 Db and usually 0**.
The slots do better — Harmonic Lock climbs 0.00 → 0.83 Db on slots alone — but
that is still ~1 Db a commit for an investment worth about eighteen commits of
income (mean ≈2.6 Db/commit, `DB_UPGRADE_THRESHOLD` 4).

This is not a tuning miss. **Permissions cannot excite, because their upside is
bounded by the size of a penalty you deliberately made small.**

### 0.1 The three rungs that give the game away

`theory_dom7`, `theory_modes` and `theory_chromatic` are named after the three
most characterful ideas in tonal harmony — the dominant seventh, the mode,
chromaticism — and **all three do the same thing, which is storage.**

`theory_chromatic` is the sharpest case: it used to have a real chromatic effect
(the "penalties halved" tier, and B6's chromatic-run payout). Both were deleted —
B6 measured its payout at 0.02 Db per commit, firing on 1% of commits — and the
replacement was *the sixth stack slot*. The idea was removed and the shelving
kept the name.

### 0.2 The half of music the ladder never touches

Theory today is entirely **vertical** — chords, palette, what is legal. Nothing
in it touches the **horizontal**: time, phrase, shape, repetition.

And the detectors already exist, all live, all feeding the Drive/Sustain boosts
and `performanceScore`:

`detectDiatonicRun` · `detectSkipClimb` · `detectRepeatPattern` ·
`detectMotifRepeat` · `detectChromaticRun` · `detectCadence`

**Six detectors, none purchasable.** There is a second skill ladder's worth of
built machinery with nothing attached to it — and it is the half that would make
phrasing something a player *develops* rather than something the game silently
scores behind them.

### 0.3 The fix is already in the codebase, applied once

**B4 — "colour notes pay the stack that authorized them."** A pardoned off-scale
note does not merely escape the penalty; it *earns*, in Drive and Sustain. The
comment states the principle exactly:

> *"Db answers 'did you play it right'; colour answers 'did you play it hard.'"*

That is a permission converted into an income, and it is the **only** rung on the
ladder that got the treatment. The design rule this doc proposes is simply to
propagate it:

> ⚠️ **A Theory rung should pay for a gesture, not forgive a mistake.**
> Not "the tritone is no longer discord" but "a tritone that resolves does X."
> Not "you get a slot" but "a dom7 in your stack does Y *because it is a dom7*."
> That is what a musician actually buys when they learn theory — vocabulary,
> not amnesty.

### 0.4 What to PROTECT

Not everything here is broken, and a rebuild could easily throw out the parts
that work:

- **The slots genuinely matter, and it is measured** (0.83 Db of Harmonic Lock
  rides on them). The problem is not that capacity is a bad purchase — it is that
  three differently-named rungs all sell the same one.
- **"Db pays for FACTS, not taste"** is the reason the currency is legible at
  all. Every Db source that was cut was some version of scoring taste. Keep it.
- **`discordPenaltyFor`'s grace note and floor** — forgiving without being free.

---

## 1. The structural decision: split the ladder

Theory cannot go *entirely* per-Spirit, because `stackCapFor()` is load-bearing
for everyone — without slots, Harmonic Lock never pays and nobody can build a
chord worth landing on.

**So: two ladders.**

### 1a. The shared spine — capacity, honestly named
Three rungs that sell stack slots (3 baseline → 6 at `STACK_CAP_MAX`), renamed
for what they do rather than for musical ideas they do not deliver. Everyone buys
these. This is "learn to hold more."

⚠️ Renaming is not cosmetic here — it is what frees `dom7` / `modes` /
`chromatic` to become real techniques on the branches below, instead of being
permanently spent as synonyms for "shelf."

### 1b. The per-Spirit branch — technique
Three rungs per Spirit, exclusive, each one a verb. This is "learn to *do*
something." Narrow on purpose: it should COLOUR the commit phase, not dictate it.

**Machinery that already exists for this:**
- `SPIRIT_ONLY_ROUTE` (`policies/bot.js`) already gates routes by Spirit — today
  `{ shredding_ronin: 'cosmic_ronin', metalness: 'Metalness_Monster' }`. The
  arsenals are already spirit-only routes; this is a second one of a different
  kind.
- `classifyTrack(track, keyScale, driveStack, sustainStack, unlockedSkills, routing)`
  and `chordContext(drive, sustain, unlockedSkills)` **already take
  `unlockedSkills`** — the per-Spirit hook is a parameter that is already threaded.
- `modeFromStack(driveStack, unlockedSkills, currentMode)` — same.

---

## 2. The routes

> Each is three tiers, cheap → identity-defining. Db costs are **not** proposed
> here; §3.2's unlock-vs-fuel tension and the remaining-match-length weighting
> should set them, and ideally the §6.6 harness should check them.

### 2a. 🤘 METALNESS MONSTER — *the flat side*
Metal's harmony is the tritone, the ♭2 and ♭5, Phrygian and Locrian, and the
power chord that refuses to say whether it is major or minor.

1. **Diabolus** — the tritone is clean in both modes **and it pays**. Not
   `discord_3`'s permission: a tritone on the track feeds the slime (a longer
   trail, or the next trail hex bites harder — see `METALNESS_REWORK_DESIGN.md`).
   ⚠️ This is the single most under-used idea in the harmony system: §3.4 notes
   the tritone's *only* surviving payout is +1 Performance Score, after B5
   removed the "Damage ×2" charge that multiplied nothing.
2. **Power Chord** — root and fifth, no third. `modeFromStack` derives your mode
   from the Drive stack's *quality*, so a stack with no third is **unreadable**.
   He picks his mode instead of inheriting one. Musically exact, mechanically a
   real power, and it bites on a system that already exists.
3. **Drop Tuning** — B8 sets your next root to the last note of your track
   (`newRootRaw`). This lets him force it *down* a fixed interval instead.
   Choosing your key rather than inheriting it is the deepest rung on his ladder
   and it is literally what down-tuning is.

**Through-line: vertical and dark.** His theory is about which notes exist, and
he wants the ones nobody else does.

### 2b. 🗡️ SHREDDING RONIN — *the horizontal*
Shred is runs, sweeps and modal colour. Where Monster's theory is about chords,
Ronin's is about motion — the clean contrast.

1. **The Run** — `detectDiatonicRun` already exists and currently feeds only a
   generic Drive boost. Long runs scale for him. It is his vocabulary and nobody
   owns it.
2. **Sweep** — `detectSkipClimb` is arpeggiation: skipping through chord tones. A
   skip climb through **your own stack's** tones pays big. That ties melody to
   chord, which is already the Wa no Koe theme, so his ladder and his capstone
   finally point the same direction.
3. **Exotic** — a non-diatonic scale (harmonic minor's raised 7th, Phrygian
   dominant) or a mid-phrase modal shift. The virtuoso rung, and it feeds his P≥5
   cliff directly: `performanceScore` already rewards interval variety and
   contour change.

### 2c. 🌀 INTERGALACTIC 0 — *extensions and the outside note*
Also vertical, but the opposite end from Monster — rich rather than dark. And
`PARDON_ORDER = ['literal', 'chord', 'extension', 'approach']` already has two
tiers nobody owns.

1. **Extensions** — the `extension` tier becomes his, and **pays** rather than
   pardons. 9ths and 13ths are the space-funk sound.
2. **Approach** — the `approach` tier: a chromatic note that *resolves* onto a
   chord tone. The most jazz idea on the pardon ladder, and the natural upgrade
   path for a Spirit whose innate is already "your first wrong note landed on
   purpose" (Freestyle).
3. **Voicing** — he already gets +1 Sustain on every voicing. A rung where *how*
   you spread the chord matters — inversion, close vs. open — would be uniquely
   his; nothing in the game reads voicing shape today.

### 2d. 🐀 RIFF RAT — *refusing theory is his theory*
See `RIFF_RAT_DESIGN.md`. **His ladder is already built and nobody noticed:**
`CADENCE_OBJECTIVES` includes "THE FULL RESOLVE — end on C, then F, then G, then
C." **That is I–IV–V–I. That is the three chords.**

1. **Three Chords** — cadences resolve faster and pay harder; `finalsTrail` is
   his instrument.
2. **Two Minutes Flat** — `scoreTrackDB` pays for length. He gets paid for
   **brevity**. Inverting the spine's incentive for exactly one Spirit makes his
   commit phase a different game rather than a differently-flavoured one.
3. **Three Chords and the Truth** — the discord inversion: `gainFans` only pays
   out on `allInScale`; flip it. Dirty tracks win the crowd, clean tracks bore it.

Every rung he buys makes him **worse** at conventional scoring and better at his
own.

---

## 3. Why this helps the bot work rather than costing it

§5's whole thesis is "the Spirit IS the plan." But look at the shipped eval
table: **`perfCliff` is the only musical term in it.** Every other weight —
`survival`, `fame`, `fanMult`, `drive`, `sustain`, `apBanked`, `inRig`, `charge`,
`refillDenied`, `adjWounded`, `edgeSafety`, `dbHorizon`, `rivalPose`,
`targetUpside` — is combat, board or economy.

So today, four Spirits **fight** differently and **play music** identically. The
commit phase is the game's spine (§1) and where most of its decisions live, and
it is currently characterless.

Per-Spirit theory gives each Spirit a distinct commit-phase objective the
searcher can score. That is a new *class* of eval term, not a re-weighting of the
existing ones — which §5 already flags as the kind of change most likely to move
observed win rates, because it corrects a blind spot rather than adjusting sight.

---

## 4. Sequencing — read this before starting

This is more new surface than any other open item. Honest ordering:

1. **Metalness's innate lands first** (`CHARACTER_HANDOFF.md` "NEXT TASK",
   §4.3). Cross-Spirit tuning is blocked on it, and a theory route on a
   half-finished character measures the design gap rather than the route.
2. **Build ONE route end-to-end — Monster's** — and see whether a three-rung
   musical branch actually changes how a turn feels. Do not commit the roster
   before that.
3. **The §6.6 harness** is what turns "feels better" into evidence. It is
   unblocked (`applyBotAction` + `melodyCommit` are both in), unbuilt.

## 5. Open questions

- **Does the shared spine stay at three rungs?** If per-Spirit branches carry the
  identity, capacity could compress to two rungs and free Db for the branch.
- **What happens to the four `discord_*` unlocks?** Blues Lick / Borrowed Chord /
  Devil's Interval are *specific intervals in specific modes* — i.e. they are
  already half-way to being per-Spirit techniques. Devil's Interval in particular
  should probably become Monster's tier 1 rather than surviving as a shared rung.
- **Do bots need a per-Spirit `skillOrder`?** §0.1 notes the persona
  `skillOrder` arrays are entirely generic rungs. Per-Spirit theory makes a
  generic order actively wrong.
- **Is `theory_sus` a route rung or a spine rung?** It is the one existing rung
  that already pays for a gesture (a suspended ending → +1 P). It might be the
  template for all of them rather than a stray.
