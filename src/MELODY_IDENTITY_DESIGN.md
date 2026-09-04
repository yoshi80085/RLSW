# MELODY IDENTITY DESIGN — 🎼 what each Spirit's fans came to hear

> **Design conversation, 2026-09-02. Alex's material, audited against source.**
>
> The home for `PROGRESSION_REWRITE_DESIGN.md` §3's one open line — *"the
> per-character gesture table. Nothing is decided beyond the Ronin's run."*
> This doc fills that hole and, in doing so, proposes **removing** two payouts
> rather than adding four.
>
> ⚠️ **STATUS: NOTHING HERE IS BUILT.** §1 and §6 are a direction Alex has
> stated; §4 and §5 are proposals he raised and asked for a read on; §8 is his
> own first-pass table, preserved verbatim so the audit in §9 can be checked
> against it. Every claim about *current* behaviour was read out of source and
> is cited to a file. Read §2 and §3 before proposing a single number — they are
> the two sections that kill ideas.
>
> Companions: `PROGRESSION_REWRITE_DESIGN.md` (§3 payout split, §4 ending fork,
> §5 the Db sink), `CHARACTER_HANDOFF.md` (the kits), `RIFF_RAT_DESIGN.md`,
> `METALNESS_REWORK_DESIGN.md`, `GAME_BRIEF.md` §17 (one gesture, one currency).

---

## 0. The one-line version

**The crowd gets a taste, and the taste is the character.** Melody *shape* stops
paying Drive and Sustain for anybody and pays only the crowd; which shapes a
Spirit's crowd pays for is what makes them play differently. Modes come back not
as a scale ladder but as **one nasty note, resolved** — bought with the Db you
gave up to play it.

---

## 1. 🎯 THE FOUR VERBS — the spine, and the part to lock first

| Spirit | Verb | The fantasy |
|---|---|---|
| 🗡️ Shredding Ronin | **KATA** | Master the instrument |
| 👹 Metalness Monster | **DISSONANCE** | Break the instrument |
| 📻 Intergalactic 0 | **LOOP** | Hack the instrument |
| 🐀 Riff Rat | **HOOK** | Make the crowd remember the instrument |

One word each, nameable in fiction, showable on a HUD, and matching the
archetype quartet already in `CHARACTER_HANDOFF.md` (virtuoso / bruiser /
controller / opportunist). 📌 **Lock these before any number is assigned.**
Everything below is an argument about how to spell them; if the verbs are wrong
the spelling does not matter.

⚠️ **THIS SHEET QUIETLY DECIDES THE RIFF RAT / GLAMARCHY SWAP.**
`RIFF_RAT_DESIGN.md` §0 *proposes* replacing her and says nothing is implemented;
`CHARACTER_HANDOFF.md` still lists her as an open lane. A four-column table with
Rat in it and Glamarchy absent assumes the swap happened. That is a defensible
call — the Glam Reaper name collision is real and she has no kit to migrate — but
it should be **recorded as a decision**, not inherited from a table.

---

## 2. ⚠️ WHAT THE DATA CAN AND CANNOT CARRY

`melodyLine` is **pitch classes, no octave, no rhythm**, and every interval is
folded to the nearer direction (`spiritStyle.js` `diffsOf`, matching
`performanceScore`'s fold). Three consequences, and each has already cost this
project a mechanic:

### 2.1 There is no such thing as a big leap

The largest interval that can exist is **six semitones**. So these cannot be
built, at all:

- **Octave jump** — that is interval 0, i.e. literally the same detector as
  "same note repeated".
- **Large interval leap / "the bigger the jump, the more Monster"** — the
  biggest jump in the game is a tritone.
- **Increasing / decreasing interval size (escalation)** — over a 0–6 range with
  no octave, this reads as arbitrary rather than as building tension.
- **Root → 5th → octave** — collapses to root → 5th → root.
- **Rhythmic repetition** — there is no rhythm in the data. (The *cross-turn*
  half of that idea survives and is §7, which is the best item in this doc.)

🪦 **MEASURED, NOT ARGUED.** The Ronin's original second gesture was "the leap,
answered"; it **fired on 87% of his commits** and was replaced by the sweep.
`spiritStyle.js` carries the headstone: *"there is no such thing as a big leap in
pitch-class space, and pretending otherwise was measuring the fold."*

### 2.2 A single named interval is a coin toss

The note stock is **ten independent uniform draws from twelve pitch classes**
(`economy.js:171` `stockSize` 10, 11 for the Ronin → `refillStock` →
`getSpelledPool`, which returns all 12). `MELODY_MAX` is 8
(`legalActions.js:63`). So over seven adjacencies, by accident:

| shape | ≈ chance it appears in a random track |
|---|---|
| perfect 5th (folds to \|5\|) or minor 2nd (\|1\|) | ~70% |
| tritone (\|6\|), or a repeated note (\|0\|) | ~45% |
| an A–B–A alternation | ~40% |
| a specific ORDERED interval pair (e.g. ♭2→1) | ~5% |

🪦 **AGAIN MEASURED:** the bare adjacent tritone **fired on 67% of all commits**,
which is why Metalness's version was hardened into *"the tritone, walked away
from"* — three notes, not two.

> 🎯 **THE RULE THIS GIVES YOU.** A gesture must be **a move, not a note**.
> Anything spelled as "played interval X" needs a second condition — answered,
> resolved, repeated on purpose, or placed — before it is an identity rather
> than a tax rebate.

### 2.3 A shape must be buildable from many different draws

The 34-riff library was retired on 2026-08-17 because *"the Fame came from the
note draw, not from a decision"* — four exact pitches in order is mostly a
question of what your stock happened to hold. Every gesture here must be a
**shape** (a direction, an interval class, a repetition) so many draws can spell
it. That is not a style preference; it is the standing constraint on this seat.

📌 **And the noise floor cuts both ways.** Over 536 commits the searcher landed
the one gesture whose ladder cleared the floor (Metalness's tritone, 180 times)
and essentially never landed the other five (11–19 each). Equal *rows* is not
equal *game*. §9 is the fix.

---

## 3. 📏 WHAT ALREADY PAYS WHAT — the corrected ledger

⚠️ **THIS TABLE EXISTS BECAUSE THE FIRST DRAFT OF IT WAS WRONG IN THIS SAME
CONVERSATION**, in the direction that matters: it over-claimed which gestures
already pay Drive, which would have justified deleting payouts that do not
exist. Read out of source 2026-09-02.

| Gesture | Detector | What it pays TODAY |
|---|---|---|
| Diatonic step run | `detectDiatonicRun` | **Drive** (`driveBoostFromRun` → `tempDrive`) |
| Repeat pattern | `detectRepeatPattern` | **Sustain** (`sustainBoostFromPattern` → `tempSustain`) |
| Chord-pardoned notes, anywhere in the line | `countPardonedByStack` | **Drive/Sustain** (`colorDrive`/`colorSustain`, cap 2) |
| 🪦 ~~Melody ⊂ stack (Ronin)~~ | ~~`checkWaNoKoe`~~ | **NOTHING — the ability was CUT and deleted 2026-09-04.** The Ronin is paid no differently from anyone else for playing inside his own chord. ⚠️ Any §5 weighting that assumed this seat exists is weighting a rule the game does not have |
| Skip climb / arpeggio | `detectSkipClimb` | ❗ **CROWD ONLY** — one point in `perfGest`. It does NOT pay Drive. |
| Chromatic run | `detectChromaticRun` | ❗ **NOTHING in Db.** `chromaticPayout` was DELETED — it fired on 1% of commits, worth 0.02 Db each over 15,000 commits. It now only flips `allInScale` (see §5.3). |
| Tritone present | `trackHasTritone` | Crowd (`perfGest`) |
| Motif repeat | `detectMotifRepeat` | Crowd (`perfMotif`) |
| This Spirit's own style | `detectSpiritStyle` | Crowd (`perfBig`, cap 2) |

🎯 **So melody shape reaches Drive/Sustain through exactly TWO functions**, plus
the colour pardons and a Ronin passive that is already scheduled for
replacement. That is the whole surface §4 proposes to remove, and it is far
smaller than the conversation implied.

---

## 4. 🅰️ THE WITHDRAWAL — melody shape stops paying Drive and Sustain

> **Alex, 2026-09-02:** *"These shouldn't really be affecting Sustain/Drive. We
> already have systems that have an effect on these — namely the Chord stacks
> and finishing the melody line on a blue or red note."*
>
> ⚠️ **DIRECTION STATED, NOT YET LOCKED — it needs the bench in §4.3.**

### 4.1 The change

Delete `driveBoostFromRun(diatonicRunLen)` and
`sustainBoostFromPattern(repeatPatLen)` from the commit, and let
`PROGRESSION_REWRITE_DESIGN.md` §4 narrow the colour payout to the **final
note**. Three currencies, three clean sources:

| Source | Pays | Character |
|---|---|---|
| **The chord stack** | Drive / Sustain | power you built and keep |
| **The final note of the line** | Db **or** colour | the one-turn trade, decided once |
| **The shape of the line** | the crowd | and nothing else |

### 4.2 🎯 THE PRIZE: §3'S HARDEST RULE DISSOLVES

`PROGRESSION_REWRITE_DESIGN.md` §3's law reads *"ONE GESTURE PAYS ONE CURRENCY.
WHICH currency depends on the CHARACTER"* — the Ronin's run pays him fans so it
must stop paying him Drive, while the same run still pays Drive for everyone
else. That per-character partition is the fiddliest thing in the rewrite, it is
a table somebody must maintain forever, and it is the likeliest source of a
"why did that pay differently for me" moment.

**If the run pays NOBODY Drive, the law collapses to the plain version** —
melody shape pays the crowd, full stop — and the character difference lives
entirely in *which shapes a crowd likes*. Same outcome, one fewer rule.

### 4.3 ⚠️ What it costs, and what must be measured

1. **Drive/Sustain supply drops, and combat was tuned with those boosts live.**
   `radius = RIG_RADIUS_FLOOR + stack length` is already flagged in
   `PROGRESSION_REWRITE_DESIGN.md` §8 for a re-bench when *slot* supply moves;
   this moves supply the other way at the same time. **Bench the two together,
   not separately** — they are the same question asked from both ends.
2. **The temp-stat machinery narrows but does not die.** The "highest wins, the
   loser is discarded" comparison in `melodyCommit.js` exists because several
   sources compete for one slot; with only the ending colour left it becomes a
   plain assignment. Psycho Bushido and Wa no Koe still write `tempDrive`, so
   `ATK_BONUS_CAP` and `clearBattleBuffs` are untouched.
3. ⚠️ **WITH COLOUR AT THE ENDING ONLY, THE CHORD STOPS TOUCHING THE MIDDLE OF
   THE LINE** — especially if §3's recommendation to delete the discord penalty
   also lands. That is acceptable **only because the fan route pays the middle
   instead**. It is what makes §3 load-bearing rather than decorative: without
   it, the middle of a melody would pay nothing but length. Do not ship the
   withdrawal before the fan route exists.

---

## 5. 🅱️ THE MODAL DIP — the exotic note as a purchase, not a key

> **Alex, 2026-09-02:** *"Which do you play/sacrifice — play cleanly in scale
> and earn your harmony Db points, or play to your fans, perhaps playing an
> exotic scale that might mean sacrificing some Db points to make the fans
> happy… I wonder if it could be considered a clever 'trick' to sort of dip into
> these modes."*
>
> ⚠️ **DESIGNED HERE, NOT DECIDED.**

### 5.1 Don't detect the mode. Detect its characteristic MOVE.

The version that fails is *"Ronin +3 for playing Mixolydian"*: a key-signature
bonus needing a mode you cannot infer from eight notes and a declaration B8
deleted on purpose. It also re-opens the scale ladder
`PROGRESSION_REWRITE_DESIGN.md` §1 just took off the tree, and widening the
palette **deletes the colour payout** — that section's ⚠️ in caps.

The version that works is already sitting there as an **absence**. The palette is
Major Pentatonic `[0,2,4,7,9]` or natural minor `[0,2,3,5,7,8,10]`
(`notes.js` `playableScale`), so every modal colour tone is *already* off-palette
and *already* pays nothing:

- **Mixolydian ♭7** — not in the pentatonic
- **Phrygian ♭2** — not in natural minor
- **Dorian ♮6** — not in natural minor

🎯 **So no new scale system is needed. The mechanism exists as a hole; the
feature is a rule that says THIS wrong note, for THIS Spirit, pays the crowd.**
No mode inference, no declaration, no palette widening, and no pardon is
devalued.

### 5.2 It must be a move — §2.2's rule, and it is musically the honest version

A single pitch class shows up in ~50% of random eight-note tracks, so "played
the ♭2" is a coin toss. **A ♭2 that does not lean onto the tonic is not
Phrygian, it is a wrong note.** So the unit is the *ordered pair*: ♭2→1 (which
IS the Phrygian cadence), ♭7→1 for Mixolydian. ~5% by accident, fully under the
player's control, buildable from many draws. The constraint and the musicology
agree, which is usually the sign of the right spelling.

**Depth without a ladder:** one characteristic move is a **dip**; two different
ones in the same line means you are **in** the mode. Additive and capped — never
the escalating-combo shape (§8.1).

| Spirit | The dip | Why it fits |
|---|---|---|
| 🗡️ Ronin | **♭7**, resolved | 📌 And it rhymes with the board: *a 7th of your root* is the note that opens **stack seat 4** (`stackSlots.js` `SLOT_LADDER`), so his modal colour and his chord hunt point at the same pitch class |
| 👹 Metalness | **♭2**, plus the ♭5 he already owns | Phrygian is his existing tritone with one note added — same territory, more of it |
| 📻 Intergalactic 0 | **♮6 over minor** | Dorian is darkness that is *not* aggression — exactly the distinction Alex drew between him and Monster |
| 🐀 Riff Rat | **no mode — an off-palette note played TWICE** | Punk: a mistake repeated is a style choice. Cheapest possible theory, mechanically distinct from all three, perfect character fit |

### 5.3 ⛔ THE TRADE DOES NOT EXIST YET — THE WIRING IS CURRENTLY INVERTED

**This is the most important finding in this doc.** The code does the opposite of
what the dichotomy assumes:

- **An off-palette note costs almost no Db.** `scoreTrackDB`'s step A is
  `Math.floor(track.length / 2) - 1` — pure length, **blind to cleanliness**.
  `DISCORD_GRACE` is 1 (`context.js:474`), so the first offender is free. And the
  ending bonus is **not** gated on `allInScale` in the kernel, despite the
  comment above `scoreTrackDB` saying the caller guards it — 📌 **verify whether
  the client still does; it changes the arithmetic.**
- **It costs you your entire crowd.** `positionFanGain` returns `null` unless
  `clean` (`melodyCommit.js:102`), so a dirty track earns **no positional fans
  at all** and does not even advance the promotion streak.

> 🎯 **PLAYING DIRTY IS NEARLY FREE IN Db AND FATAL IN FANS. The dichotomy is
> the exact inverse of the shipped game.**

Two moves make it real, and §3 already proposes the first:

1. **Db reads clean notes instead of raw length** — that is what gives the dip a
   price.
2. **The fan gate becomes per-character instead of a universal `clean` flag** —
   dirt in *your* idiom still pays the crowd.

⚠️ **THE PRECEDENT FOR (2) IS WRITTEN, AND IT IS CURRENTLY DEAD — corrected
2026-09-02.** `melodyCommit.js:361` reads `if (chromClimbActive) allInScale =
true;` — a chromatic run's dirt declared not-dirt, the crowd paid as if the line
were clean, with a comment explaining why. **The code path is exactly the right
shape and it has not fired since the Theory branch was deleted**, because
`chromClimbActive` requires `discord_4`, `discordUnlocks` is only ever written by
the client's skill-unlock site, and no route in `SKILL_TREE` sells that id any
more (`skills.js:28` — `THEORY_DISCORD_GRANTS` was deleted with the branch).

🎯 **That is better news than it sounds, and it is the join between this doc and
§4 of the rewrite.** The mechanism is built and waiting for a granter; **the
per-character rule IS the granter**. What must not happen is anyone reading the
line as live evidence that the crowd already forgives characterful dirt — it
does not, for anybody, today. See §5.6.

### 5.6 ✅ FOUR DEAD FLAGS, NOT THREE — FIXED 2026-09-02i

> ✅ **ALL FOUR ARE UNGATED AND THE CROWD SEAT FIRES.** `SEQUENCING.md` §5-flags,
> measured in `.scratch/_gatedflags_results.md`. What follows is the diagnosis as
> written, kept because the reasoning is what made the fix safe — read §5.6.1
> beneath the table for what actually shipped and the trap it avoided.

`GAME_BRIEF.md` §16 #1 and `PROGRESSION_REWRITE_DESIGN.md`'s header both record
that **three** unlock-gated endings went unreachable when the Theory table was
deleted. The set is **four**, and the fourth has knock-ons neither doc names.
`discordUnlocks` can never become non-empty again, so all of these are pinned:

| flag | gated on | what dies with it |
|---|---|---|
| `hasBlues` | `discord_1` | `isMinorSeventhEnd` — recorded |
| `hasBorrowed` | `discord_2` | `isMajorThirdEnd` — recorded |
| `hasTritoneUp` | `discord_3` | `isTritoneEnd` — recorded |
| **`hasChromClimb`** | **`discord_4`** | ⛔ **`chromClimbActive`, i.e. the `allInScale` override of §5.3 — NOT recorded anywhere** |

And two consequences that follow from the first three but are written down
nowhere:

- 🎭 **`hasGatedEnding` IS A PERMANENTLY-ZERO INPUT TO `performanceScore`.** It
  is `isMinorSeventhEnd || isMajorThirdEnd || isTritoneEnd` — all three dead — so
  one of `perfGest`'s six flags can never fire. 📌 **Be precise: the seat is
  REDUCED, not broken.** `perfGest` is `Math.min(3, …)` over six flags and the
  other five still reach the cap. But it is the same shape as `perfSusEnd`, which
  this project already found reading `false` on every commit since the tree was
  written — and §10.1 proposes making these seats **per-character weight
  vectors**. ⚠️ **Weighting a seat whose terms cannot fire is calibrating against
  a rule the game does not have** (`CLAUDE.md`'s §15 warning, again).
- 🎨 **Three note colours never render.** `rlsw-simulator-v3_8_1.jsx` ~11624 and
  ~13804 gate `showTritoneColor` / `showMinorSeventhColor` / `showMajorThirdColor`
  on the same dead ids. The stock has three colour states that cannot occur.
- 🤖 **The bot's discord tiers are always empty** (`bot.js:354`), so
  `botIsNotePlayable` treats every off-scale note as unplayable-dirty. That is
  currently correct-by-accident, and it stops being correct the moment §5's dip
  pays.

📌 **The client's grant site still exists** (`rlsw-simulator-v3_8_1.jsx:4510`,
pushing `discord_1..4` into `discordUnlocks`) — so re-granting these ids is a
data edit, not a rebuild. Whatever §4's ending fork lands on should decide
whether that plumbing is reused or deleted; leaving it half-alive is the
`legalActionsCheck` §15 shape.

#### 5.6.1 ✅ What shipped, and the trap in the obvious fix

⛔ **RE-GRANTING THE FOUR IDS WOULD HAVE DELETED THE COLOUR PAYOUT.** They feed
`keyScale` as well as the endings — `unlockedIntervalKeys` widens what counts as
CLEAN — and `SEQUENCING.md` §5-seats' fifth decision keeps everyone on the
pentatonic base precisely because a wider palette means fewer notes need
pardoning, **and the pardon IS the colour payout**. The two jobs were split at
their own sites instead: the palette read is deleted (a provable no-op, the set
was always empty) and the four flags are ungated where they are used. `b0check`
now pins the kernel against a revival.

📏 **AND THE FIRE RATES SAY SOMETHING THIS DOC SHOULD ACT ON** (real committed
tracks; every row read 0.00% before, by construction):

| flag | RANDOM | STEERED | gap |
|---|---:|---:|---:|
| `isMinorSeventhEnd` | 8.27% | 7.58% | −0.68pp |
| `isTritoneEnd` | 8.27% | 6.88% | −1.39pp |
| **`chromClimbActive`** | **3.80%** | **19.40%** | **+15.60pp** |

🎯 **THE THREE ENDINGS ARE SCENERY; THE CHROMATIC PARDON IS THE ONLY TARGET.** By
§2's own >25%/<2%/gap rule, the endings fire no more often under steering than
under chance — so **they are not yet worth a character's taste weight**, and §10.1
should not spend one on them until §4's fork gives them a reason to be aimed at.
⚠️ Read the steered column as a FLOOR: it is a bot that does not know fans got
better (§5-fans.E).

⛔ **AND `music/context.js`'s "1% OF COMMITS" FOR THE CHROMATIC RUN IS OFF BY MORE
THAN AN ORDER OF MAGNITUDE** against today's searcher (19.4%). The figures are not
directly comparable — the old one counted a payout that also needed a 16 Db
purchase — but the *design reasoning* built on it ("a run eats 3+ of your 8 slots,
so almost nobody plays one") does not survive the bot, which plays one on nearly
one commit in five as a side effect of its ascending note preference. **That makes
the chromatic pardon the loudest of the four and the one whose per-character
narrowing matters most** — §5.5's granter is now a live knob rather than a plan.

📌 **THE PARDON IS LEFT UNIVERSAL ON PURPOSE.** §5.5's per-character rule is the
intended granter, but the four verbs are not locked (§5-ident.E step 1) and a
taste table written before the hit-rate probe is a guess. Universal makes the
mechanism live and therefore MEASURABLE, which is what the probe needs.

⚠️ **WHAT THE A/B SAYS ABOUT THIS WHOLE ARM.** Restoring the pardon grew the crowd
(×2.90 → ×2.99, diehards +4%) and moved banked Fame **not at all** (4313 → 4305),
because the extra crowd fell into a discard already running at 55.7%. **No
per-character crowd tuning this doc proposes can pay off while `FAME_PER_TURN_CAP`
eats half the amplified Fame.** That makes the scaled window (`PROGRESSION_REWRITE_DESIGN.md`
§7.7/§7.8) a prerequisite for §10 in the same way §5 is a prerequisite for §3.

---

### 5.4 ⚠️ Two calls it forces

- **📻 Intergalactic 0 already dips for free.** Freestyle pardons his first
  out-of-scale note every turn (`melodyCommit.js:315` `freestylePardon`), so his
  sacrifice is zero. Either that breaks the dichotomy for him, or it becomes his
  identity — *the one who can afford to be wrong*. It must be a decision, not an
  accident.
- **The discord penalty decision flips.** `PROGRESSION_REWRITE_DESIGN.md` §3
  recommends deleting the −1-per-note penalty outright. **This dichotomy is an
  argument for keeping a small one**, because a sacrifice you cannot feel is not
  a sacrifice — the same reasoning that drove §7.7's fan re-weight. The
  alternative is that the penalty goes and the cost is purely the forgone
  clean-note Db: cleaner, but quieter. Pick deliberately.

### 5.5 ⛔ AND THE EXCHANGE RATE CANNOT BE SET UNTIL §5 OF THE REWRITE EXISTS

"Sacrifice Db for fans" prices Db against **what Db buys**. Today Riff Rat
inherits Glamarchy's problem — no route, nothing to purchase, every Db banks
forever. So the trade is *free* for some Spirits and *expensive* for the Ronin.

> 🎯 **`PROGRESSION_REWRITE_DESIGN.md` §5 (per-ability upgrade streams) stops
> being the last item in that doc and becomes a PREREQUISITE for §3's trade
> meaning anything.**

---

## 6. 🧩 ONE DETECTOR FAMILY, FOUR IDENTITIES

Strip out interval-size (§2.1) and mode-as-key (§5.1) and what remains is
**pattern space** — the one axis the engine barely pays for, that pitch-class
data represents perfectly, that has a high noise floor, and that many draws can
spell. Every criterion the riff library failed.

And it splits four ways on its own:

- 🗡️ **Ronin — transformation WITH direction.** The sequence
  (`C D E → D E F → E F G`), symmetry, ascend-then-descend. Order applied to a
  shape. *Kata.*
- 📻 **0 — transformation WITHOUT change.** Exact repetition, transposition,
  palindrome, and the loop that survives across turns. Invariance. *Loop.*
- 🐀 **Rat — repetition WITH corruption.** The riff, the riff with one note
  wrong, the riff again. Call-and-response as contour-preserved,
  pitch-changed. Mutation. *Hook.*
- 👹 **Monster — the REFUSAL of pattern.** His gestures are not patterns at all:
  the answered tritone, the chromatic grind, and — per §3's own line — **the
  notes that pay no Db**. Destruction. *Dissonance.*

📌 **So it is one motif matcher parameterised by transform**, not thirty rules:

| transform | who it belongs to |
|---|---|
| identity | 0, Rat |
| transposition | 0 (signature); Ronin's *sequence* is overlapping transposition |
| retrograde | 0's palindrome |
| edit-distance-1 | Rat's twist (signature) |
| contour-preserving, pitch-differing | Rat's call & response |
| **the complement** — no motif, plus answered dissonance | Monster |

Six behaviours, one function, four identities — and one place to hang the
`styleProgress` steering half, without which the bot never plays any of it
(`spiritStyle.js`: *"exactly how the bot went 1,218 commits without playing a
single riff"*).

---

## 7. 🌀 THE CROSS-TURN MOTIF — build this one first

> *"Don't spend that note yet. I can use it to complete the loop."*

**The only proposal in this whole arm that changes a resource decision rather
than scoring a track after the fact.** Everything else changes what a commit is
worth; this changes what a player does with their stock three turns out. It is
also the one thing that would make 📻 Intergalactic 0's *turn* feel different
rather than his *scoring* feel different.

✅ **The state seat already exists.** `committedMelody` is written onto the sheet
at every commit (`melodyCommit.js`'s patch), and `recentP` already keeps a
two-deep history. So *"did this turn's line quote last turn's line"* is reachable
with no new plumbing.

📌 Build it ahead of the rest of the table. It is the highest-value single item
here and it is the proof that this arm is more than re-labelling.

---

## 8. 📋 ALEX'S BALANCE SHEET v1 — preserved, with the audit

Kept verbatim so §9's measurement can be checked against the intent. Values:
0 = no affinity, 1 = likes, 2 = strongly likes, 3 = signature.

| Melody shape / behavior | 🗡️ Ronin | 👹 Monster | 📻 0 | 🐀 Rat | audit |
|---|:--:|:--:|:--:|:--:|---|
| Ascending scale | 3 | 1 | 1 | 1 | pays Drive today (§3) |
| Descending scale | 3 | 1 | 1 | 1 | pays Drive today |
| Ascend → descend | 3 | 1 | 2 | 1 | ✅ was `detectContourTurn`, deleted with Style |
| Stepwise movement | 3 | 1 | 2 | 1 | pays Drive today |
| Chromatic ascent | 1 | 3 | 1 | 2 | ✅ free — `chromaticPayout` is deleted |
| Chromatic descent | 1 | 3 | 1 | 2 | ✅ free |
| Large interval leap | 1 | 2 | 2 | 3 | ⛔ **impossible** (§2.1) |
| Octave jump | 2 | 2 | 2 | 3 | ⛔ **is interval 0** (§2.1) |
| Perfect 5th | 2 | 2 | 1 | 3 | ⚠️ ~70% noise floor |
| Tritone | 1 | 3 | 2 | 0 | ⚠️ 67% measured — needs the "walked" form |
| Minor 2nd | 1 | 3 | 2 | 1 | ⚠️ ~70% noise floor |
| Minor key | 1 | 3 | 2 | 2 | ⚠️ see §5.1 — becomes the ♭2/♮6 move |
| Major key | 2 | 1 | 1 | 2 | ⚠️ same |
| Mixolydian | 3 | 1 | 2 | 1 | → **♭7 resolved** (§5.2) |
| Dorian | 2 | 2 | 3 | 1 | → **♮6 over minor** |
| Phrygian | 1 | 3 | 2 | 1 | → **♭2→1** |
| Minor pentatonic | 2 | 3 | 2 | 2 | ⚠️ it is the base palette in minor |
| Arpeggio | 3 | 2 | 1 | 1 | ✅ crowd-only today — free to re-point |
| Repeated motif | 1 | 1 | 3 | 3 | pays Sustain + crowd today |
| Transposed motif | 2 | 1 | 3 | 2 | ✅ **new, and good** |
| Sequential pattern | 3 | 2 | 3 | 1 | ✅ **new, and good** |
| Symmetrical phrase | 3 | 1 | 3 | 1 | ✅ **new, good, low noise** |
| Palindrome | 2 | 0 | 3 | 0 | ✅ **new, good, low noise** |
| Short 2–4 note riff | 1 | 2 | 2 | 3 | ✅ |
| Riff repeated exactly | 1 | 2 | 3 | 3 | pays Sustain today |
| Riff repeated with variation | 2 | 2 | 3 | 3 | ✅ **new — Rat's signature** |
| Call & response | 2 | 2 | 3 | 3 | ✅ = contour-preserving transposition |
| Tension → resolution | 2 | 3 | 2 | 1 | pays colour Drive/Sustain today |
| Increasing interval size | 3 | 3 | 2 | 2 | ⛔ **impossible** (§2.1) |
| Decreasing interval size | 3 | 2 | 2 | 1 | ⛔ **impossible** |
| Alternating two notes | 1 | 2 | 3 | 3 | ⚠️ ~40% noise floor |
| Same note repeated | 0 | 2 | 3 | 2 | ⚠️ ~45% noise floor |
| Root → 5th → octave | 2 | 3 | 2 | 3 | ⛔ collapses to root → 5th → root |

**Read of the audit:** the rows that survive cleanly cluster in **pattern
space** — transposition, sequence, symmetry, palindrome, variation,
call-and-response — which is §6. The rows that die cluster in **interval size**
and **mode-as-key**. That is not a coincidence; it is the shape of the data.

### 8.1 ⚠️ Two proposals in the source conversation contradict each other

Mid-document: escalating combos (Ronin's ascending + Mixolydian + arpeggio =
1 → 2 → 4). At the end: components at +1 each with a cap.

**The capped version wins, for three reasons.** Superlinear combos get found by
the searcher and then played exclusively; they turn `styleGain` from a hill
climb into a combinatorial problem, which is what stops the bot playing the
mechanic at all; and the capped-components architecture is *already built* —
see §10.1.

---

## 9. ⚖️ HOW TO BALANCE IT — measured hit rates, not row counts

"~8 signature behaviours each" is not balance. Shapes differ in **reachability**
by an order of magnitude, and that is measured in this repo: over 536 commits
the searcher landed Metalness's tritone **180** times and the other five
gestures **11–19** times each. Same row count, different games.

🎯 **THE INSTRUMENT TO BUILD FIRST** (`.scratch/`, one probe, the §7.1 pattern —
instrument, measure, then tune): run every candidate detector over a few
thousand real committed tracks from the bench and print, per detector per
Spirit, **two columns**:

| column | what it means |
|---|---|
| hit rate under RANDOM play | above ~25% → it is scenery, not an identity |
| hit rate with the searcher STEERING at it | below ~2% → unreachable, drop it |

⭐ **The gap between the two columns is the number that should be equal across
characters**, because that gap *is* "how much does playing in character change
what I do". Equalising the taste values instead equalises nothing.

⚠️ **AND THE UNITS ARE WRONG IN THE SOURCE SHEET.** "+3 Fans" is not a unit the
engine has. Gestures feed `perfBig` → Performance Score → **excitement**, and it
takes `EXCITE_PER_CASUAL` = **14** excitement to draw one casual and
`LOYALTY_PER_DIEHARD` = **24** to harden one. Denominating in fans would
multiply the crowd by roughly an order of magnitude, at a moment when the crowd
already saturates the Fame window (48% discarded, `PROGRESSION_REWRITE_DESIGN.md`
§7.7). **Denominate in score points.**

---

## 10. 🔧 THE CHEAP ROUTE — two things are already built for one character each

### 10.1 The scoring architecture already exists

`performanceScore` (`economy.js:78`) is already the capped-components system the
source conversation independently re-derives: `perfShape` (direction, leaps,
interval variety), `perfPalette` (distinctness), `perfGest` (named gestures),
`perfMotif` (repetition), `perfBig` (this Spirit's style, cap 2). Four of the
five proposed dimensions, already built, already capped, already feeding **only**
the crowd.

> 🎯 **The minimum-change version of this entire doc: make the SEAT WEIGHTS
> per-character, and refill `perfBig` from §6's detector family.** Four weight
> vectors and one function — not a second scoring system running beside the
> first.

### 10.2 The per-character crowd already exists — for the Ronin

`perfExciteGain` gives 🗡️ the Ronin a **cliff**: P ≥ `RONIN_PERF_CLIFF` (5) wins
~double the crowd; below it the meter goes negative and sustained mediocrity
sheds a casual. Every other Spirit gets one flat slope. **That cliff is this
whole doc in miniature, built for one character and never given to anyone else.**

Three dials per Spirit, all with existing code seats:

1. **What they play for** — `STYLE_GESTURES` (§6)
2. **How their crowd reacts** — the shape of `perfExciteGain`: cliff, slope,
   ratchet, floor-with-no-decay
3. **Which band they grow** — casuals vs diehards, already two bands at ~3.3:1
   (0.12 / 0.40, caps 14 / 6) with promotion by streak

📌 Sketches: Ronin = connoisseurs (the cliff, as built). 0 = the patient crowd,
no spikes and **no decay** — his Freestyle already forgives; his fans should be
the ones who never walk out. Monster = fed by discord and knockdowns rather than
by playing well. Rat = a big fickle casual flood, cheap to win and cheap to lose.

---

## 11. ❓ OPEN CALLS — nothing below is decided

1. **Lock the four verbs** (§1) — and with them, record the Riff Rat /
   Glamarchy swap as a decision.
2. **Does the withdrawal (§4) ship?** Needs the joint bench of §4.3.1.
3. **Does the discord penalty survive?** §5.4 argues yes, small;
   `PROGRESSION_REWRITE_DESIGN.md` §3 argues no. They cannot both hold.
4. **Is Intergalactic 0's free dip a bug or his identity?** (§5.4)
5. **Does the crowd's taste get a HUD surface?** The stated design audience is
   *the ultimate beginner* (`SEQUENCING.md` §5-glow.A). A hidden scoring rule is
   not a taste the player can play toward; the unlock-hex glow is the precedent
   for making one visible.
6. **Can you play to a RIVAL's crowd and steal it?** `FAN_DEFECT_TO_VICTOR`
   already swings 2 casuals to a demolisher, and `CREW_SYSTEM_DESIGN.md` has a
   Heckler. This is the fan-economy twin of §2's denial rule, and it is
   completely unexplored.

---

## 12. Where the code is

| Thing | File |
|---|---|
| Per-spirit gestures, detection + steering | `music/spiritStyle.js` — `STYLE_GESTURES`, `detectSpiritStyle`, `styleProgress`, `styleGain` |
| The Performance Score seats | `engine/systems/economy.js` — `performanceScore` |
| The crowd curve, the Ronin's cliff | `engine/systems/melodyCommit.js` — `perfExciteGain`, `RONIN_PERF_CLIFF` |
| Drive/Sustain from melody (§4's target) | `engine/systems/melodyCommit.js` — `driveBoostFromRun`, `sustainBoostFromPattern`, `colorDrive`/`colorSustain` |
| The Db payout, and its length-blindness | `music/cadence.js` — `scoreTrackDB` |
| Discord grace/floor | `music/context.js` — `discordPenaltyFor`, `DISCORD_GRACE`, `DISCORD_FLOOR` |
| ⛔ The inverted fan gate (§5.3) | `engine/systems/melodyCommit.js` — `positionFanGain`, `allInScale`, `chromClimbActive` |
| The palette (why modal tones are already off it) | `music/notes.js` — `playableScale`, `getSpelledPool`, `NOTE_POOL` |
| The stock draw (the noise floor's source) | `engine/systems/economy.js` `makeInitialNoteState` · `music/cadence.js` `refillStock` |
| Track length ceiling | `engine/policies/legalActions.js` — `MELODY_MAX` = 8 |
| Fan bands, weights, thresholds | `data/gameConstants.js` — `EXCITE_PER_CASUAL`, `LOYALTY_PER_DIEHARD`, `FAN_*` |
| The live gesture detectors | `music/cadence.js` — `detectDiatonicRun`, `detectSkipClimb`, `detectRepeatPattern`, `detectMotifRepeat`, `detectChromaticRun` |
| The stack seat ladder (Ronin's ♭7 rhyme) | `music/stackSlots.js` — `SLOT_LADDER` |
