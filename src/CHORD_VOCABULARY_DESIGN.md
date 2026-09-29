# CHORD VOCABULARY DESIGN — 🎸 ten spellings per Spirit, dials to 10, amps = slots

> **For AI editors + Alex.** Written 2026-09-27 out of a design conversation.
> ✅ **BUILT 2026-09-27** (same day, after Alex's second round of rulings — §0b).
> `music/vocabularies.js` (the tables + reader), `engine/systems/dicePool.js`
> (power → dice → keep), `sonicRig.js` (`sustainRig`, `ampStacks`), the Swing and
> Sonic reducers, per-Spirit seat targets (`stackSlots.js`), amps = seats, dimmed
> dropped dice (`arenaDiceSequence.js`), the Eleven die. `test:vocab` 639
> (5/5 mutants). All numbers are placeholders until a bot bench says otherwise —
> balance is frozen.
>
> Verifier: `.scratch/chordVocabProbe.mjs` (pure Node, no imports). It checks
> every vocabulary below: ten distinct spellings, each branch climbs one note
> at a time, every chord reads as itself in its own stack, no chord reads
> higher in the wrong stack, palette fit, dice maths, hand odds. **ALL PASS.**

---

## 0. Alex's rulings (this conversation)

1. **Amps show unlocked chord slots**, per stack, independently. 3 slots = 1
   cabinet, 4 = 2, 5 = 3. **Slot 6 does "something special" — but not a 4th
   cabinet.** Drive and Sustain amps can stand at different heights.
2. **Slots = playable dice.** Every die the chord earns is rolled; the
   **highest faces up to the slot count** are the ones that count. ("A 7 Drive
   chord with 5 slots — 7 are rolled, the 5 most valuable are used.")
3. **Retire the marquee/charge amp-size bonuses** in favour of (1)–(2). (Today
   that is `rigPool`/`rigPower` from the marquee RIG lane — see §7.)
4. **Chords are character-driven.** "A jazzy chord isn't something Riff Rat
   would ever be playing."
5. **Drive/Sustain dials go up to 10**, and to **11 under a certain
   circumstance**.
6. **About ten spellings per Spirit** — "1 being 1 note, 2 being 2… not really
   chords *there*" — ten unique ways to spell for each Spirit in play.
7. **The engine teaches efficient spelling**, colour-coded as it is now, so
   players learn their Spirit.

### 0b. Second round (Alex, 2026-09-27)

- **The 6th seat does not add a kept die.** A six-note chord still reads **10** on
  the dial, still rolls **8** dice and still keeps **5** — but **two of the dice
  become d8s**, and that stack's amp **glows**.
- **Buffs past 8 upgrade more dice** (d6 → d8), not add dice. d8 → d10 is a
  marquee **card** — not built.
- **All marquee lanes will hand out random bonus CARDS** for correct answers:
  guaranteed faces (4s/5s/6s), a die bump (d6 → d8 / d10), or +1 kept die. Its
  own implementation, later. The RIG lane still runs until then; its tiers no
  longer draw the amps.
- **Goes to 11 = the Eleven die**: ~~a d12 with eleven faces reading 11 and one
  reading 1~~ → ✅ **a d6 with five 11s and one 1 (Alex, 2026-09-28)** — fizzle
  1 in 6. At 1 in 12 the fail almost never happened (a free +7); 50/50 with the
  whole-throw fizzle averaged −23% to −36% against not pressing it. Swapped in
  for one of his dice. Built as: replaces his WEAKEST die,
  is ALWAYS kept, and its **1 fizzles the whole throw** (the "absolute fail",
  1 in 6 ≈ 17% since the d6). ⚠️ The rest of this is Claude's reading — Alex asked "what do
  you think?"; the always-kept + fizzle rule is the proposal, easy to change.
- **Intergalactic 0's innate: removed.** Innates want a rethink of their own.
- **Swing and Psycho Bushido spend from the top.** Built.
- **Dropped dice: throw everything, dim the unused.** Built — they land, slide
  to their side of the row and dim; only the kept dice dock and add up.
- 🔢 **Bug: the dice faces were blank.** The solid layer (2026-09-25) re-drew
  each die's BODY on the foreground canvas but left its printed numbers (a clear
  texture card) on the arena canvas underneath. Fixed: `solidLayer.js`
  `DECAL_LAYER` — a mesh tagged `userData.solidDecal` joins the colour pass
  only. The Swing's dice are now solid too. Verified in a headless render
  (`.scratch/dice-probe/`); ⏳ not yet seen on Alex's GPU.

---

## 1. The model in one breath

> **Every note is a die. Spell one of your Spirit's chords and you earn bonus
> dice. Your slots decide how many dice count.**

- Each Spirit has **ten spellings**: a **trunk** of two (root; root + 5th)
  and **two branches of four** — a **Drive branch** (red) and a **Sustain
  branch** (blue) — at 3, 4, 5 and 6 notes.
- **Each branch climbs one note at a time.** Every chord is the one below it
  plus exactly one note. That single fact is the whole teaching aid: *there is
  always exactly one next note per branch*, and that is the note that glows.
- **Dial = notes + spelling bonus.** Spelling a chord from the *matching*
  branch (Drive chord in the Drive stack, Sustain chord in the Sustain stack)
  adds one bonus die per note past the second:

| notes in stack | loose notes / other branch | matching-branch chord |
|---|---|---|
| 1 (root) | 1 | 1 |
| 2 (+5th) | 2 | 2 |
| 3 | 3 | **4** |
| 4 | 4 | **6** |
| 5 | 5 | **8** |
| 6 | 6 | **10** |

- **Power = dial + buffs. Dice thrown = one d6 per point, up to 8; every point
  past 8 turns one of them into a d8** (dial 10 → 8 dice with two d8s).
  **Dice kept = min(that stack's seats, 5)**, highest faces first (3 seats keep
  3, 4 keep 4, 5 and 6 keep 5 — the 6th seat buys the d8s and the glow). The
  dropped dice are the spelling bonus and the buffs — so spelling well means
  **choosing from more dice**.
- **11 is Metalness's alone** — 🔊 Goes to 11 already *sets* the Drive dial to
  11 (`eleven.js`, `ELEVEN_DRIVE = 11`). The dial only goes to 10; he is the one
  person with an amp that goes one louder. That is the "certain circumstance",
  and it needs no new system. (Keep rule: §6.)

### Why the dial isn't a straight 1–10 ladder
Stacks top out at 6 notes, and there are two stacks. Ten rungs on one line
would make one branch top out at 9. The trunk + two branches gives both stacks
the same climb to 10, and the odd numbers still happen — through buffs
(spotlight +1, Moshpit/tempDrive up to +2) and through loose notes.

### What a beginner gets for playing "wrong"
The floor is the note count, so nothing is ever worth *less* than its notes: a
random in-palette triad on the root reads ~3.1 on average vs 4 for a branch
triad (verifier §4). Spelling right is a bonus, never a trap. At 6 notes the
gap is 6 vs 10 — the reward grows with mastery.

---

## 2. Reading a stack

1. **The root is the stack's root** — the first note still standing
   (`stackRoot` in `music/stackSlots.js`, which the seat hunt already uses).
   Both stacks are seeded with the Spirit's root (`makeInitialNoteState`), so a
   fresh stack spells upward from the key.
   - ⚠️ **Anchoring to the root is load-bearing.** Several vocabularies contain
     modes of each other — the Ronin's In-sen (1 ♭2 4 5 ♭6) *is* Hirajoshi
     started on its 5th — so the old "try every note as root" scan would read
     one branch as the other. Root-anchoring also kills the C6-vs-Am7
     ambiguity. It means the old `evaluateChord` scan is **not** reused for
     vocabularies.
2. **Look up which of the Spirit's ten spellings the stack contains** (subset
   match on intervals above the root). Extra notes are dead weight but never
   subtract.
3. **Value for this stack = max(note count, best contained chord's value on
   this side).** The side matters — the same notes can read differently in the
   Drive and Sustain stacks, and that is intended: a Drive chord in the Sustain
   stack is just its notes.
4. **The readout shows the name** ("E 7♭9") and both numbers (rolled / kept).

---

## 3. The vocabularies

Intervals are above the stack root. **Spice** = a note outside the Spirit's
palette: rarer in the hand (≈35% vs ≈70% to be in a fresh 10-note hand —
verifier §6) and a Lost Chord target, so the top of a branch is a hunt.

### 🗡️ Shredding Ronin — Hirajoshi + 4 (1 2 ♭3 4 5 ♭6)
The Sustain branch *is* his scale: rung S5 is the five-note Hirajoshi, S6 is
Alex's six-note palette played at once. The Drive branch is the other
classical Japanese scale, **In-sen / Miyako-bushi** (1 ♭2 4 5 ♭6), and its ♭2
is **"the blade note"** — the one spice he ever needs.

| rung | Drive (red) | notes | D/S | Sustain (blue) | notes | D/S |
|---|---|---|---|---|---|---|
| 3 | Sus4 | 1 4 5 | 4/3 | Sus2 | 1 2 5 | 3/4 |
| 4 | Sus4 ♭6 | 1 4 5 ♭6 | 6/4 | Minor add9 | 1 2 ♭3 5 | 4/6 |
| 5 | **In-sen** | 1 **♭2** 4 5 ♭6 | 8/5 | **Hirajoshi** | 1 2 ♭3 5 ♭6 | 5/8 |
| 6 | Two Blades (In + ♭3) | 1 ♭2 ♭3 4 5 ♭6 | 10/6 | Hirajoshi + 4 | 1 2 ♭3 4 5 ♭6 | 6/10 |

Open and unresolved — no major or minor 3rd until rung 4, and never a 7th.

### 🤘 Metalness Monster — Phrygian (1 ♭2 ♭3 4 5 ♭6 ♭7)
Drive is **Phrygian dominant** — the "Spanish"/neoclassical metal sound. Its
spice is the **major 3rd**: the one note that turns Phrygian evil. Sustain is
the doom wall: minor, then the ♭6, then the ♭2 bite.

| rung | Drive (red) | notes | D/S | Sustain (blue) | notes | D/S |
|---|---|---|---|---|---|---|
| 3 | 5♭9 ("the bite") | 1 ♭2 5 | 4/3 | Minor | 1 ♭3 5 | 3/4 |
| 4 | Major ♭9 | 1 ♭2 **3** 5 | 6/4 | Minor ♭6 (doom) | 1 ♭3 5 ♭6 | 4/6 |
| 5 | **7♭9** | 1 ♭2 3 5 ♭7 | 8/5 | Minor ♭6♭9 | 1 ♭2 ♭3 5 ♭6 | 5/8 |
| 6 | 7♭9♭13 | 1 ♭2 3 5 ♭6 ♭7 | 10/6 | Phrygian Wall | 1 ♭2 ♭3 5 ♭6 ♭7 | 6/10 |

🔊 **Goes to 11** sits on top of this: the only Drive dial in the game past 10.

### 🪐 Intergalactic 0 — Dorian (1 2 ♭3 4 5 6 ♭7)
He is the jazz Spirit, and Dorian is jazz's minor. Drive climbs in **4ths** to
the **So What chord** (Miles Davis's Dorian voicing — stacked 4ths with a 3rd
on top; it sounds like space). Sustain is Dorian's signature: the **natural 6th
over minor**. No spice at all — everything is in his palette.

| rung | Drive (red) | notes | D/S | Sustain (blue) | notes | D/S |
|---|---|---|---|---|---|---|
| 3 | Sus4 | 1 4 5 | 4/3 | Minor | 1 ♭3 5 | 3/4 |
| 4 | 7sus4 | 1 4 5 ♭7 | 6/4 | Minor 6 | 1 ♭3 5 6 | 4/6 |
| 5 | **So What** | 1 ♭3 4 5 ♭7 | 8/5 | Minor 6/9 | 1 2 ♭3 5 6 | 5/8 |
| 6 | Minor 11 | 1 2 ♭3 4 5 ♭7 | 10/6 | Minor 13 | 1 2 ♭3 5 6 ♭7 | 6/10 |

⚠️ His innate (+1 Sustain on every voicing, +1 Drive on a cluster —
`attackParams.spiritChord`) needs a ruling: see §8 Q4.

### 🐀 Riff Rat — proposed Mixolydian (1 2 3 4 5 6 ♭7)
⚠️ He has **no palette yet** (`RIFF_RAT_DESIGN.md` is unimplemented; he
replaces Glamarchy). Mixolydian is rock's own mode — the ♭7 is the ♭VII of
every I–♭VII–IV punk song. **Drive never plays a 3rd**: it is power chords
stacked on power chords, each new note a 5th above or below the last, until
the whole wall is six stacked 5ths — never major, never minor. Sustain is the
bar-band ladder (7, 9, 13) — the one "extensions" ladder every guitarist
already half-knows. No spice: his taste for wrong notes lives in the melody
(`RIFF_RAT_DESIGN.md` §2's discord inversion), not in his chords.

| rung | Drive (red) | notes | D/S | Sustain (blue) | notes | D/S |
|---|---|---|---|---|---|---|
| 3 | Stacked 5ths | 1 5 2 | 4/3 | Major | 1 3 5 | 3/4 |
| 4 | Stacked 5ths ×3 | 1 5 2 6 | 6/4 | Dominant 7 | 1 3 5 ♭7 | 4/6 |
| 5 | Stacked 5ths ×4 | 4 1 5 2 6 | 8/5 | Dominant 9 | 1 2 3 5 ♭7 | 5/8 |
| 6 | **Wall of 5ths** | ♭7 4 1 5 2 6 | 10/6 | Dominant 13 | 1 2 3 5 6 ♭7 | 6/10 |

### Fallback — unsettled seats (Glamarchy, old saves)
The classic ladder, so nothing breaks: Drive Major → Dom7 → Dom9 → Dom13,
Sustain Minor → Min7 → Min9 → Min11. It is the old `CHORD_TEMPLATES` content
re-cut into the new shape. (Its palette is the Lydian fallback, which it fits
badly — irrelevant while Glamarchy is locked.)

---

## 4. Teaching efficient spelling (the colour coding)

Everything the player needs falls out of "one next note per branch":

- **Hand glow — kept exactly as it is now:** red = commit this to Drive, blue
  = commit to Sustain (`ui/crowdCoach.js` `chordGlow`). What changes is the
  *source*: a note glows red if it is the next note of the Drive branch for
  the Drive stack's root, blue likewise. No search needed — it is a lookup.
  - The trunk's 5th climbs both; `chordGlow`'s existing tie-break (favour the
    lower dial) already handles one chip wanted by both stacks.
  - A stack holding loose notes glows the note that gets it onto the nearest
    rung (fewest missing notes, prefer the matching branch).
- **Next-rung ghost** in each stack panel: "E 5♭9 → add **G♯** for Major ♭9
  (6 dice)". Names the chord, the note, and the payoff.
- **Chord book**: each Spirit's ten spellings as one card (two branches, rung
  by rung, spice marked), on the roster/tutorial page and one click from the
  stack panel. Ten things to learn, not a textbook.
- **Lost Chord seats use the same notes** (§5), so the hex that glows on the
  board, the chip that glows in the hand and the ghost in the panel can never
  disagree.

---

## 5. Seats, amps and the hunt

- **Seats stay per stack** (`driveSlots`/`sustainSlots`, 3 → 6, never lost).
- **The seat ladder becomes per Spirit.** Today `SLOT_LADDER` is jazz for
  everyone — a 7th opens slot 4, a 9th slot 5, an 11th/13th slot 6 — so a
  punk Spirit would have to play jazz to power up. New rule: **the target for
  seat N is the next note of whichever branch chord fills the stack at N−1
  notes.** Walk onto it → the seat opens and the note sits in it (as now,
  `applyUnlockClaim`) → the stack *is* the next rung. The `upgradesRequired`
  gate is unchanged.
  - A full stack of loose notes has **no seat target** — you open seats by
    spelling your chords. That is the lesson.
- **Amps = slots − 2** per stack: 1, 2, 3 cabinets; **the 6th seat lights the
  stack** instead of adding a 4th (`sonicRig.js` `ampStacks`).
  `arenaFrame` currently feeds the amp height from `rigTiers(ns).pool`
  (`arenaVisuals.js` shows `levels[i]` while `i < owner.pool`) — swap that for
  each stack's own slots and the two amps can finally stand at different
  heights.

---

## 6. Dice numbers (verifier §5, d6, 200k trials)

| rolled | kept | mean kept total | per kept die |
|---|---|---|---|
| 3 | 3 | 10.5 | 3.50 |
| 4 | 3 | 12.3 | 4.08 |
| 6 | 4 | 17.3 | 4.34 |
| 8 | 5 | 22.4 | 4.48 |
| 8 (six-note: two d8) | 5 | ≈24 | ≈4.8 |

- **Kept dice never exceed 5**, and only kept dice fire beams, so every
  battle-timing budget built around ≤6 beams holds (Sonic spends ~1.25 s per
  die, `SONIC_BEATS.spacing`).
- **Goes to 11** — see §0b: the Eleven die, always kept, its 1 fizzles.

---

## 7. What this replaces or retires

| thing | today | becomes |
|---|---|---|
| `CHORD_TEMPLATES` (`music/chords.js`) | one global 16-chord table, scanned from every root | the fallback vocabulary; Spirits read their own |
| `spiritChord` (3 byte-identical copies: `attackParams.js`, monolith, `bot.js` `botSpiritChord`) | `evaluateChord` + Intergalactic's innate | **the seam**: `spiritChord(spiritId, notes, which)` reads the vocabulary. Collapse the copies while here. |
| `sonicRig` count | `chord.drive + innate + min(2, temp+mosh) + extraDrive` (no slot cap) | rolled = min(10, dial + buffs) (11 at eleven); **kept = slots** |
| `SLOT_LADDER` degrees | universal 7th / 9th / 11th-13th | per-Spirit "next branch note" |
| `rigPool` / `rigPower` / atrophy | won at the marquee RIG lane; today they only drive the amp height, amp HUD, bot scoring and logs — **not** the dice count | retired; amp height = slots. RIG lane: §8 Q2 |
| Charge zones | d8 ceiling / raised floor on attack dice | **unchanged** — they never touched amps |

**Other readers of the chord table** that must follow: `playFinder` (bot
finder), `crowdCoach` (glow), `spice.js` (Discord Coach — imports
`CHORD_TEMPLATES` for chord quality), `evaluate.js` stack-quality terms
(already divide by `stackCapFor`), the chord readout / dials in the monolith.

---

## 8. Open

1. ✅ ~~Slot 6~~ — two d8s + the glow. ✅ ~~Buffs past 10~~ — more d8s.
   ✅ ~~Dropped dice~~ — dimmed. ✅ ~~Swing/Bushido spend~~ — the top.
   ✅ ~~Intergalactic innate~~ — removed.
2. ✅ **Marquee bonus cards** — built 2026-09-29, `MARQUEE_QUIZ_DESIGN.md` §10.
   The RIG lane is gone; `rigPool`/`rigPower` are no longer granted.
3. 🔊 **Goes to 11** — ✅ the die is a d6 (five 11s, one 1), Alex 2026-09-28,
   which implicitly keeps the always-kept + fizzle reading. ⛔ **Still to
   re-price**: it costs the whole Sustain stack + a blown amp, which was priced
   for ELEVEN d6s. Now it is one wild die.
4. 🐀 **Riff Rat's palette** (Mixolydian proposed) and all **chord nicknames**.
5. 🧪 **Balance**: nothing is benched. The dial curve, the d8 threshold and the
   keep cap all want a bot bench before they are called final.
6. Innates want a rethink (Alex).

## 9. Build order (✅ steps 1–3 and the glow/finder part of 4 are built)

1. `music/vocabularies.js` (pure): the five tables + `readStack(spiritId,
   notes, which)` + `nextNotes(spiritId, stack, which)`. Port the verifier's
   checks into `vocabularyCheck.mjs` (in `test:all`).
2. `spiritChord` → vocabulary (collapse the three copies); `sonicRig` rolled /
   kept; the dice presentation keeps the highest `kept` and dims the rest.
3. Seat targets → `nextNotes`; amps → slots; retire `rigPool`/`rigPower`.
4. Glow, ghost, chord book; `playFinder` and `spice.js` onto the vocabulary.
5. Bot bench before any number is called final.
