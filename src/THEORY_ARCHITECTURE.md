# THEORY ARCHITECTURE — 🎼 the shape of the two ladders, locked

> 🪦 **SUPERSEDED IN PART, 2026-09-02 — THE THEORY BRANCH IS DELETED.**
> `PROGRESSION_REWRITE_DESIGN.md` §2/§3 shipped: the five rungs are gone from
> `data/skillTree.js`, the pardon ladder is **universal and free for everybody
> from turn one**, and stack seats 4–6 are **found on the board** by walking onto a
> Lost Chord that extends your stack's root (`music/stackSlots.js`).
>
> ⚠️ **READ THIS DOC FOR THE MECHANIC, NOT FOR THE LADDER.** Everything it says
> about *what each pardon tier reaches* — literal notes, the implied seventh,
> extensions by quality, approach notes — is still exactly true of the shipped
> game and is still the best written explanation of it. Everything it says about
> **prices, rungs, gating or purchase order describes a ladder that no longer
> exists.** The tier IDs (`theory_minor` and friends) survive only as the keys of
> `CONTEXT_TIERS`, kept as documentation of which rung was which.

> **For AI editors + Alex.** `SEQUENCING.md` step 2. This doc settles the
> STRUCTURE of the Theory rework and nothing else: what the two ladders are,
> where the line between them falls, and which rules every future rung must
> obey. Written 2026-08-15 out of a design conversation.
>
> ⚠️ **NO RUNG, COST OR NAME IS SET HERE.** Content is `THEORY_ROUTES_DESIGN.md`
> §2 and it lands one Spirit at a time (`SEQUENCING.md` step 5). Db costs wait
> for the §6.6 harness — §5's weights are explicitly not measurements, and this
> ladder is the same.
>
> Companion to `THEORY_ROUTES_DESIGN.md` (the routes),
> `BOT_STRATEGY_HANDOFF.md` §3.2 (unlock vs. fuel), `SEQUENCING.md` (the order).

---

## 0. The diagnosis, restated — and one correction

### 0.1 ⚠️ CORRECTED — the three rungs are not empty, source wins

`THEORY_ROUTES_DESIGN.md` §0.1 says `theory_dom7` / `theory_modes` /
`theory_chromatic` "all three do the same thing, which is storage," and that
the ideas were deleted while "the shelving kept the name." **That is not what
the code does.** Read out of `music/context.js` and `data/gameConstants.js`:

| Rung | Db | Palette it adds | Pardon tier (`CONTEXT_TIERS`) | Slot |
|---|---|---|---|---|
| `theory_major` | 6 | 4th + 7th — completes Ionian | — | — |
| `theory_minor` | 8 | the Minor scale | **literal** — a note in either stack is never Discord | — |
| `theory_dom7` | 10 | ♭7 | **chord** — a triad implies its natural 7th (C-E-G makes B clean) | 4 |
| `theory_modes` | 12 | ♯4, ♭7, tritone | **extension** — tensions *by chord quality*: ♯4 over major, nat 6 over minor, ♭9/9 over dom | 5 |
| `theory_chromatic` | 16 | maj3 in minor | **approach** — any note is clean if the NEXT lands on a chord tone | 6 |

Each rung does **three** things, and the names are accurate to the tier they
gate. B9 rewrote every one of those `desc` strings for exactly this reason; the
branch blurb now opens *"Each rung does two things."* The ladder is 52 Db, not
the 46 the doc quotes.

**Two consequences, both load-bearing:**

1. **`THEORY_ROUTES_DESIGN.md` §2c is built on a factual error.** It says
   `PARDON_ORDER` "already has two tiers nobody owns" and hands `extension` and
   `approach` to Intergalactic 0. They are not unowned — they are `theory_modes`
   and `theory_chromatic`. Giving them to Zero means **taking them from everyone
   else**, which is a real nerf to the whole roster and must be priced as one.
2. **The rename in §1a is unnecessary and would be expensive.** See §3.3.

### 0.2 What survives, and it is the stronger argument

The doc's "these rungs are empty" claim dies. The actual problem does not, and
it is worse:

> **The rungs are not empty. They are GENERIC.**
> Every Spirit climbs the same ladder and arrives at the same musical
> vocabulary. The commit phase is where most of the game's decisions live
> (`BOT_STRATEGY_HANDOFF.md` §1), and it is the one place where four characters
> are indistinguishable. They fight differently and they play music identically.

Two measured facts still stand behind it:

- **The pardon ladder is worth ~+0.24 Db per commit** across the whole Theory
  branch (the B4 comment in `confirmNoteTrack`, now
  `systems/melodyCommit.js`). A pardon can never be worth more than the penalty
  it forgives, and `discordPenaltyFor` gives the first wrong note free and
  floors at 3.
- **Six horizontal detectors are live and none are purchasable** —
  `detectDiatonicRun`, `detectSkipClimb`, `detectRepeatPattern`,
  `detectMotifRepeat`, `detectChromaticRun`, `detectCadence`. Time, phrase,
  shape and repetition are scored behind the player's back and cannot be
  developed. That is half of music, unowned. (§0.2 of the routes doc, untouched
  by the correction above.)

---

## 1. THE LOCK — two ladders

### 1a. The shared spine — capacity and palette, Spirit-independent
**Three rungs. Each sells one stack slot AND one step of the DIATONIC palette.**
Ceiling stays 6 (`STACK_CAP_MAX`). Everyone buys these; nothing here is
characterful and nothing here needs to be.

This is "learn to hold more, and learn the scales."

⚠️ **The `literal` pardon tier stays on the spine.** The other three tiers
leave; this one does not, and the reason is not sentiment. `literal` — *a note
sitting in your Drive or Sustain stack is never Discord* — is what makes a stack
mean anything beyond an attack rating, and B4's colour payout ("colour notes pay
the stack that authorized them") hangs off it. B4 is the ONE rung on the shipped
ladder that already obeys §2's rule. Move `literal` to the branches and the
chord-context system is **switched off by default** for anyone who has not
bought a branch — the game's best-realised idea, gated behind character choice.

### 1b. The per-Spirit branch — technique, exclusive
**Three rungs per Spirit, each one a verb.** This is "learn to *do* something."
Narrow on purpose: it should COLOUR the commit phase, not dictate it.

Machinery that already exists for this, all of it already threaded:
`SPIRIT_ONLY_ROUTE` (`policies/bot.js`) gates routes by Spirit today;
`classifyTrack`, `chordContext` and `modeFromStack` all already take
`unlockedSkills`.

---

## 2. THE RULE every branch rung must obey

> ⚠️ **A rung pays for a GESTURE, not amnesty for a mistake.**
> Not "the tritone is no longer discord" but "a tritone that resolves does X."
> Not "you get a slot" but "a dom7 in your stack does Y *because* it is a dom7."
> That is what a musician buys when they learn theory — vocabulary, not pardon.

This is `THEORY_ROUTES_DESIGN.md` §0.3, promoted from an argument to a
constraint. It has one precedent in the shipped game and the precedent's own
comment states it:

> *"Db answers 'did you play it right'; colour answers 'did you play it hard.'"*

**The test, for any proposed rung:** if it can be restated as *"a thing that
used to cost you now doesn't,"* it belongs on the spine or nowhere. If it can
only be restated as *"when you do X, Y happens,"* it is a branch rung.

---

## 3. WHERE THE LINE FALLS

### 3.1 Diatonic is shared. Chromatic is character.
The split line is already drawn in the data and nobody had noticed:

- The spine's palette steps are the **major and minor scales** — what is inside
  the key. Everyone learns those.
- Everything the current rungs sell *on top* is **chromatic**: the ♭7, the ♯4,
  the tritone, the maj3-in-minor. And that list is not a list of notes, it is a
  list of **genres**. The ♭7 is blues. The tritone is metal. The ♯4 is shred.
  The borrowed major 3rd is doom.

> 📐 **THE LINE: the spine sells what is INSIDE the key. The branches sell what
> is outside it — and what to DO with it.**

That is musically true, which is why it holds: everyone learns the scales, and
what you play outside them is your character.

### 3.2 The four `discord_*` rungs are branch tier-1s
`THEORY_ROUTES_DESIGN.md` §5 half-noticed this — *"Blues Lick / Borrowed Chord /
Devil's Interval are specific intervals in specific modes, i.e. already half-way
to being per-Spirit techniques."* With §3.1's line drawn they are not half-way,
they **are** the tier-1s. Devil's Interval is Metalness's. Blues Lick and the
Borrowed Chord belong to whoever ends up owning that colour.

⚠️ They must be **converted, not moved.** Today each one is a pure permission
("the ♭7 stops costing you"). §2's rule says a branch rung pays. A tier-1 that
is still just amnesty has changed owner without changing kind.

### 3.3 ⚠️ KEEP THE IDS. REWRITE THE LABELS.
`THEORY_ROUTES_DESIGN.md` §1a calls the rename load-bearing — *"it is what frees
`dom7` / `modes` / `chromatic` to become real techniques on the branches
below."* **It frees nothing, because branch rungs get new ids anyway**
(`metal_diabolus`, not `theory_dom7`). There was never a collision.

And the ids are expensive. They appear in `stackCapFor`, `CONTEXT_TIERS`,
`rockGods.js`'s `sonic_sorceress` order, `b0check.mjs`, and — the one that
matters — in every player's `unlockedSkills` array, i.e. in save state and in
the replay contract the netcode compares frame by frame.

**Labels are what a player reads. Ids are internal.** Rewriting labels delivers
the entire intent of §1a at zero migration cost. Do that.

### 3.4 The horizontal detectors go to the branches
§0.2's six detectors are the largest unowned surface in the game, and the
question is whether they are a shared second ladder or character material.

**They are character material.** Phrasing — *how you move through time* — is
what actually distinguishes a shredder from a riff writer, more than which notes
are legal. Ronin's route is the run and the sweep because that is what shred
IS; Riff Rat's is the cadence because `CADENCE_OBJECTIVES` already contains
I–IV–V–I. Putting them on a shared ladder would make phrasing another thing
everyone buys identically, which is the exact failure being fixed.

📌 **Reversible, and worth revisiting once one branch exists.** The cost of this
choice is real: three quarters of the horizontal half of music stays invisible
to any given player. If step 5 shows a branch feels thin, a cheap shared floor
under the detectors (with the per-Spirit rung as the ceiling) is the obvious
first thing to try.

---

## 4. THE PROPOSED SPINE MAPPING — a proposal, not part of the lock

§1a locks *three rungs, slot + palette each*. It does not lock which ids carry
them. The cheapest mapping that keeps every id alive:

| Spine rung | id (kept) | Palette | Pardon | Slot |
|---|---|---|---|---|
| 1 | `theory_minor` | the Minor scale | **literal** | 4 |
| 2 | `theory_dom7` | diatonic completion | — | 5 |
| 3 | `theory_modes` | — | — | 6 |

- `theory_major` becomes the **free starting grant**. It effectively already is
  — B9 corrected the branch blurb because it contradicted the free grant.
- `theory_chromatic` **leaves the spine.** Its `approach` tier is the natural
  tier-2 for Intergalactic 0 (§2c's instinct was right even though its premise
  was wrong), and the id survives as a branch rung.
- `stackCapFor` changes from `dom7 / modes / chromatic` to
  `minor / dom7 / modes` — one line in `gameConstants.js`, plus the combination
  table in `b0check.mjs`.

⚠️ **`theory_minor` is granted free to Cosmic Ronin from turn one (B10).** If it
becomes slot 4, that grant silently becomes a free stack slot. Decide whether
that is a buff he keeps or a grant that needs re-pointing, before this lands.

---

## 5. What this forces elsewhere

- **The bot's `skillOrder` arrays become actively wrong.** `BOT_STRATEGY_HANDOFF.md`
  §0.1 already notes the persona orders are entirely generic rungs. A generic
  order was merely uninspired when every Spirit shared a ladder; with branches it
  is a bot buying the wrong character's theory.
- **A new CLASS of eval term, not a re-weighting.** §3 of the routes doc is right
  about this and it is the payoff: `perfCliff` is the only musical term in the
  shipped weight table. Per-Spirit theory gives the searcher a distinct
  commit-phase objective per Spirit. §5 flags a new class as the change most
  likely to move observed win rates, because it corrects a blind spot rather than
  adjusting sight.
- **The Db curve moves.** Five shared rungs at 52 Db become three plus a branch.
  Re-measure with `node src/engine/dbaudit.mjs` before setting any cost, and note
  `DB_UPGRADE_THRESHOLD` was already dropped 6 → 4 the last time income moved.

---

## 6. Still open

- **The spine mapping in §4** — proposal only. Especially the B10 interaction.
- **Removing `extension` / `approach` from the shared ladder is a roster-wide
  nerf.** Everyone loses the ability to walk in chromatically unless they are
  Zero. That is the intent, and it is still a nerf that needs measuring.
- **Do the spine's three rungs still each carry a palette step**, or is palette
  worth compressing into fewer, larger steps now that the chromatic colours have
  left? §4's rung 3 currently carries none.
- **Riff Rat and Glamarchy are out of scope** (`BOT_STRATEGY_HANDOFF.md` §0.5).
  `RIFF_RAT_DESIGN.md` exists; the roster is three.
- **Every Db cost.** Deliberately. `SEQUENCING.md` step 4.
