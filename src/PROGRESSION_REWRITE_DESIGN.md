# PROGRESSION REWRITE — the Theory branch comes off the tree

> **Design sketch, 2026-09-01. Alex's call, out of a long conversation.**
> **NO GAME RULE HERE IS BUILT.** Not a stack slot, not a pardon, not a payout —
> the game plays exactly as it did. This doc exists so the next session starts
> from the decisions instead of re-deriving them.
>
> ✅ **WHAT HAS LANDED IS THE INSTRUMENTATION, and it moved the plan.** Step 1
> of the agreed order (instrument, measure, then tune) shipped on 2026-09-01:
> `grantFame` now reports what the per-turn cap discards, the harness pays and
> scatters fans like the client does, and a bench run can be pinned to a fixed
> horizon with the cap lifted. **§7.1 has the numbers and §7.2 says what they
> change** — in short, the crowd multiplier is not the lever, the cap is.
>
> Companion to `GAME_BRIEF.md` (§8 the music economy, §16 known problems #1),
> `THEORY_ARCHITECTURE.md`, `THEORY_ROUTES_DESIGN.md`, `SEQUENCING.md`.

---

## 0. The one-line version

**Music Theory stops being something you buy.** Chord capacity moves onto the
board and is *found*. The pardon ladder stops being gated and becomes universal.
Melody payout splits in two — clean notes pay Db, characterful playing pays fans —
and the Db that Theory used to absorb goes into upgrade streams on the abilities
characters already have.

This closes `GAME_BRIEF.md` §16 problem #1 ("Theory is close to the only ladder,
and buying it is close to automatic"), which has been the most valuable open
problem in the project.

---

## 1. What the Theory branch was doing, and where each job goes

The branch gated **five** separate things. Deleting it without rehoming all five
is how you delete the best idea in the game by accident.

| Job it did | Where it goes now |
|---|---|
| **Stack slots 4, 5, 6** (`theory_dom7/modes/chromatic`) | 🅰️ Found on the board (§2) |
| **Chord-tone pardon** — a note in your stack is never Discord | 🅱️ Universal, free, turn one (§3) |
| **Play the changes / extensions / approach notes** | 🅱️ Universal, free, turn one (§3) |
| **Scale expansion** — pentatonic → major → minor → modal | 🅱️ Gone as a gate. Play anything; clean pays, Discord doesn't (§3) |
| **52 Db of sink** | 🅳 Per-ability upgrade streams (§5) |

---

## 2. 🅰️ Stack slots live on the board

**The ladder is already written in `music/chords.js`.** These are not new chords —
they are the existing `CHORD_TEMPLATES` rank bands, in order:

| Slot | Note you find | What it makes buildable | Rank |
|---|---|---|---|
| 4 | a **7th** of your root | Dom7 / Min7 / Maj7 / Dim7 / m7♭5 | 6 |
| 5 | the **9th** | Dom9 / Min9 | 7 |
| 6 | the **11th or 13th** | Min11 `[0,3,7,10,2,5]` / Dom13 `[0,4,7,10,2,9]` | 8 |

Rules, as decided:

- **The root is the first note committed to that stack.** ⚠️ This is a real change:
  `evaluateChord` is order-free today — it tries every pitch class present and keeps
  the best-ranked match. The unlock target cannot be knowable in advance without a
  fixed root.
- **"A 7th", not "the ♭7".** ♭7, ♮7 and the 𝄫7 (=6th) all count, or Maj7 and Dim7
  builders are locked out of their own chords. 📌 `theory_dom7`'s existing
  "play the changes" pardon already computes *your stack's implied chord completed
  to its seventh* — reuse that function rather than writing a new one.
- **The found note fills the seat it opened.** Walk onto a B♭ holding C–E–G and you
  are playing a C7 the same instant. Unlock and payoff are one gesture.
- **Per stack.** Drive and Sustain have different roots, so two different notes on
  the board are live for you at any moment. This doubles supply for free.
- **A slot, once earned, is never lost** — not to fray, not to removing the note
  that opened it.

### The board is not allowed to gate you by chance

Supply is the thing that kills this design if it is ignored. `makeBoardToken` rolls
a **uniform pitch class out of 12**; `TOKEN_MAX` is 6; the bench mean match is ~34
turns across all seats, i.e. **~11 turns per player**. So a specific note is on the
board at all roughly 41% of the time, and then you still have to walk to it.

⚠️ **THE MARQUEE IS THE CAUTIONARY TALE AND IT IS ALREADY IN THE BRIEF:** 85% of
simulated Spirits finish at the rig floor and marquee visits run ~0.5 per match —
and the marquee is *two permanent, published, central hexes*. A drifting 1-in-12
token is a harder target than the thing nobody already goes to.

Two rules fix it, both small:

1. **Weighted spawn.** A tunable share of new tokens roll a note that would unlock
   a slot for *somebody*. One function — `unlockTargets(noteState)` → the pitch
   classes live for that Spirit right now — feeds both this and the HUD.
2. **📌 THE PIN RULE.** A token that is a live unlock for any player **is never
   rotated out** by `applyTokensDrifted`. It may still drift to a new hex; it may
   not vanish. The board holds the opportunity open instead of teasing with it.

**Open, and worth deciding deliberately:** anyone can pick up a pinned note, which
makes denial a real play — I take the B♭ you need though it is useless to me. That
reads as good counterplay and it makes the board contested. Confirm it is intended
rather than discovering it in a bench run.

---

## 3. 🅱️ The pardon ladder becomes universal; the fans pay for style

### The gate comes off, the mechanic stays

"Your chord decides which notes are legal" is the best idea in the game and it is
**not** what is being deleted. Only the price tag is.

📌 **This is a smaller change than it sounds.** `music/context.js` already routes
everything through `tiersFor(unlockedSkills)`, which returns which pardon tiers are
live. Make it return all tiers unconditionally and the whole ladder is universal —
including the red/blue note colouring in the stock, which today returns `null` for
anyone without `theory_minor` (`contextClaim`'s first line).

### The new payout split

| Where in the melody | What it pays |
|---|---|
| **The middle — clean notes** | **Db.** Off-scale, unpardoned notes simply pay nothing. |
| **The middle — characterful playing** | **Fans.** What counts depends on the character. |
| **The ending** | **Db** (resolve to tonic / 4th / 5th) **or Drive/Sustain** (land on a red/blue colour note). |

- **Discord is not a punishment, it is an absence of payment.** 🎲 Decide whether
  the current −1-per-unpardoned-note penalty (grace 1, floor −3) survives at all.
  Recommendation: delete it. "No Db for that note" is the whole cost, and it makes
  the fan route a real alternative instead of a fine you are buying your way out of.
- **The fan route can pay for Discord.** A character whose genre likes it gets paid
  in fans for notes that pay no Db. That is the dichotomy, and it is characterful.

### ⚠️⚠️ THE ONE LAW, AND THE SCAR THAT WROTE IT

**The Style system was DELETED for exactly this.** Its detectors —
`detectStyleRun`, `detectContourTurn`, `detectCellRepeat`, `detectResolvedDiscords` —
were removed from `music/cadence.js` because they **re-scored gestures the Drive and
Sustain bonuses already paid for**. `GAME_BRIEF.md` §17 states the principle it left
behind: *"Don't score the same gesture twice in two currencies."*

This design walks straight back into that room. The rule that keeps it out of
trouble:

> 🎯 **ONE GESTURE PAYS ONE CURRENCY. WHICH currency depends on the CHARACTER.**

The Ronin's driving up-and-down run pays **fans** — so it does *not* also pay Drive
for him. Another Spirit's run pays Drive — so it does *not* pay fans for them. The
partition is per character, and that is what makes characters play differently at
the melody level, which nothing in the game currently does (Style is flavour-only
now, by the brief's own admission).

📌 **The detectors you need mostly already exist and are live.** `detectDiatonicRun`
and `detectSkipClimb` feed the Drive boost; `detectRepeatPattern` feeds the Sustain
boost; `detectMotifRepeat` feeds the Performance Score, which feeds the crowd. The
Ronin's "driving string of notes" *is* `detectDiatonicRun`. This is re-pointing
existing functions per character, not writing new ones.

**Open:** the per-character gesture table. Nothing is decided beyond the Ronin's run.

---

## 4. 🅲 The ending is a fork

Currently: ending on the 5th +3 Db, the 4th +2, octave +1, plus Harmonic Lock
(+1/+2/+3 by chord rank). Colour notes pay Drive/Sustain anywhere in the line.

**New:** colour notes pay Drive/Sustain **only as the final note**. So every melody
ends on one decision — *resolve for money, or land on colour for power* — and it is
one gesture paying one currency, per the law above.

---

## 5. 🅳 The Db sink: upgrade streams on the abilities you already have

Each character ability gets its own short upgrade stream rather than a new ladder.
Psycho Bushido: a longer dash, or a shorter cooldown. Same for the rest.

⚠️ **GO SHALLOW.** The brief's own numbers: ~2.7 skills bought per player per match,
and matches run ~11 turns per player. Intergalactic 0's route is already 44 Db across
five abilities and most of it is never seen in a single game. Deep trees on all
thirteen abilities would be balance surface nobody ever plays. One or two steps on
the abilities that actually get bought is the right size.

📌 Apply the existing test: each stream should sell **one thing nobody else can grant**.

---

## 6. Settled in the same conversation (not open)

- **🛡️ Sustain fray stays as it is — from the tail, cheapest note first.** Root-first
  fraying was considered and rejected: it puts you in a no-chord Tone Cluster
  (Sustain 2) 67–92% of the time, on a stack that must survive three opponents'
  turns before you can touch it. That is a death spiral, and an opponent gets a free
  read on it. `RIG_RADIUS_FLOOR` exists to prevent exactly this shape.
- **⚔️ The Drive spend keeps taking the ROOT** (`slice(SWING_DRIVE_SPEND)`), and the
  asymmetry is now deliberate and sayable: **their attacks take your extensions,
  your own attacks take your foundation.** Drive is only read on your own turn and
  you get three commits to rebuild before it matters again; Sustain is not and does
  not. 📌 So the four front-slicing sites (`attackParams.js:267`, the client's
  `resolveSwing` and Sonic, `transition.js:504`) are CORRECT and stay.
  ⚠️ But `combat.js`'s `sonicDriveSpend` / `physicalDriveSpend` / `sustainChip` pop
  from the *back*, are called by **nothing**, and carry ~10 green assertions in
  `selftest.mjs` describing a rule the game does not have. Same shape as
  `legalActionsCheck` §15. Delete them or invert them; do not leave them.
- **🗑️ Click a committed note to remove it.** Costs **1 stack-commit** out of 3 and
  the note is **destroyed**, not returned to stock. The root is removable (that is
  how you re-point which note you are hunting on the board). Gated to the chord
  step on your own turn. Confirm-or-hold, not a bare click.

---

## 7. 📏 Measured, so nobody re-runs it

### 7.1 🎪 THE FAME ECONOMY — measured 2026-09-01, and §8's first trap is now numbers

`.scratch/famedist.mjs` + `.scratch/_famedist_results.md`. 150 matches per cell,
2 seats, searcher v searcher, 3 lives, `fameTarget: ∞` so the finish line does
not truncate the distribution. Every `HARNESS_GAPS` caveat applies.

**The instrument had to be built first, and building it found two bugs.**
`grantFame` DISCARDS everything above `FAME_PER_TURN_CAP` and said so only in a
log line, so nothing could count it; and `transition.js` was dropping the
`fameThisTurn` window on the `attack` and `riffOff` cases, which made the
per-turn cap per-ACTION in the harness and per-turn in the client. Both fixed;
see §7.3.

| tpp | cap | Fame/seat | med | p90 | max | FP/turn | awarded | **discarded** | crowd × | ♥ | actually played |
|----:|:---:|----:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 4   | 14.5 | 13 | 27 |  42 | 1.5 | 20.8 | **26.3%** | 1.37 | 2.1 |  9.4 |
| 10 | off | 21.7 | 19 | 42 |  76 | 2.3 | 22.5 | — | 1.38 | 2.1 |  9.6 |
| 15 | 4   | 19.8 | 19 | 37 |  55 | 1.6 | 29.8 | **30.0%** | 1.46 | 2.4 | 12.4 |
| 15 | off | 31.3 | 28 | 60 | 112 | 2.5 | 32.4 | — | 1.48 | 2.6 | 12.6 |
| 20 | 4   | 22.0 | 21 | 40 |  63 | 1.6 | 34.4 | **32.5%** | 1.49 | 2.5 | 13.9 |
| 20 | off | 36.6 | 33 | 71 | 136 | 2.6 | 37.7 | — | 1.51 | 2.6 | 14.3 |
| 30 | 4   | 23.1 | 21 | 44 |  89 | 1.5 | 36.5 | **33.2%** | 1.49 | 2.5 | 15.4 |
| 30 | off | 39.1 | 34 | 77 | 173 | 2.5 | 40.3 | — | 1.51 | 2.7 | 15.9 |

- 🧱 **THE PER-TURN CAP IS A WALL, NOT A RAIL.** It throws away **26–33% of every
  Fame point the rules award**, and the share RISES with the horizon. The
  ordinary bench agrees: 29.1% over 40 full matches under real rules.
- ⏳ **THE HORIZON SATURATES AT ~15 TURNS PER PLAYER.** A 30-turn horizon plays
  15.4 — 130 of 150 matches end on a KNOCKOUT first. **20 and 30 are not
  horizons this roster reaches**, so a design tuned for them is tuned for a game
  nobody plays. §2's "~11 turns per player" is the *with-finish-line* figure and
  is still right.
- 🎤 **THE CROWD RUNS AT A QUARTER OF ITS RANGE.** Diehards average 2.1–2.7
  against `FAN_DIEHARD_CAP` 6; the effective multiplier is 1.37–1.51 against
  `FAN_MULT_CAP` 2.0. It barely moves with the horizon.

**The cap curve at 15 tpp** — `fameCap` scales every ceiling, so `RIFF_FP_TURN_CAP`
stays at ×2 throughout:

| cap | 4 (today) | 5 | 6 | 8 | 12 | off |
|---|---:|---:|---:|---:|---:|---:|
| Fame/seat | 19.8 | 22.5 | 25.2 | 27.9 | 29.2 | 31.3 |
| p90 | 37 | 42 | 50 | 54 | 56 | 60 |
| max | 55 | 67 | 93 | 104 | 105 | 112 |
| discarded | 30.0% | 22.6% | 16.6% | 8.6% | 3.9% | 0% |

### 7.2 🎯 WHAT THIS DOES TO §8's PLAN, AND IT IS A REORDERING

**Raising the crowd multiplier pushes on the wrong end of the pipe.** A third of
what the crowd already amplifies is destroyed before it lands, and the discard
share GROWS with the crowd — so every point of extra multiplier is taxed hardest
exactly where the design wants it to pay. Moving the cap 4 → 6 buys **+27%
banked Fame**; the entire remaining crowd headroom (×1.48 → ×2.00) is worth less
than that, and most of it would be clipped anyway.

📌 **And the Fame target is set just past the horizon the board allows.**
`fameToWin` at 2 players × 3 lives is 24. At the measured 1.5 FP/turn that needs
~16 turns per player, and the match lasts ~15. That is why so many end on a
knockout rather than on Fame — the race is calibrated to a game one turn longer
than the one being played.

⚠️ **So the recommended order changes:** the cap is the constant to move first,
and it must move **before** the fan payouts of §3, not after. §8's own warning
("decide the cap before shipping the style payouts, not after") is now a number
rather than a worry, and the number says the cap is already binding without any
new fan source at all.

### 7.3 🐛 Found while instrumenting — both shipped

- **The Fame window was leaking.** `transition.js` threw away the `fameThisTurn`
  that `battleConsequences` and `riffOffConsequences` return, on the `attack` and
  `riffOff` cases. `confirmMelody` and `endTurn` always threaded it. Effect: the
  per-turn cap was per-ACTION headlessly, so a Spirit could bank 8 from a duel
  and 4 more from a pose in one turn — which the shipped client does not allow.
  **Every headless Fame number in this repo's history over-counts.**
- **The fan hooks were declared gaps and were not cosmetic.** `gainFans` and
  `demolishFans` were `HARNESS_GAPS` entries whose own comment said "these two
  carry real economy". Fans MULTIPLY Fame inside `grantFame`, so a bench without
  them priced every payout against a crowd that could only ever grow. Both are
  implemented in `harnessHooks` now, and the keys are deleted rather than
  softened.

### 7.4 🎸 The stack, from the earlier pass

`.scratch/rootloss.mjs` and `.scratch/rootloss2.mjs`, 20,000 trials per cell,
seeded. Evidence for one session; not suites.

- After a root is consumed, **sacrificing the shifted 2nd note is right 27–35%**
  (Drive) and 27–33% (Sustain, cap 4+) against a real 6-note stock — *not* the
  automatic play. It rises to **62% at cap 3 Sustain**.
- "Makes no difference" is the largest column every time, because under subset
  matching **a stray note never lowers your chord's rank — it only costs a seat.**
- Losing a root under fixed-root evaluation: **67–92%** of leftovers spell no chord;
  Drive **6.5 → 3.1–4.0**. Today's free-root evaluator: 24.7% cluster at cap 6.
- The voluntary swap on a full stack is worth **+1.5 to +2** stat about a third of
  the time and **loses under 1%** of the time at cap ≥4 — which is why it must cost
  a commit, or it is a checkbox rather than a decision.

---

## 8. Traps and knock-ons

- 🎪 ~~**Fans have NO per-turn cap** and multiply Fame up to 2.0×. Adding a whole
  new fan source is the most likely balance blowout in this design. The brief
  already flags the uncapped fan economy as unmeasured.~~
  ✅ **MEASURED 2026-09-01 — see §7.1, and the answer is the opposite of the
  worry.** The fan economy is not blowing anything out; it is running at a
  quarter of its range (♥2.1–2.7 of 6, ×1.37–1.51 of 2.0) and barely moves with
  the horizon. What IS binding is the thing on the other side of it:
  `FAME_PER_TURN_CAP` destroys 26–33% of every Fame point the rules award, and
  the share grows with the crowd. **A new fan source is not the blowout risk —
  it is a payment into a pipe that is already 30% blocked.** Decide the cap
  first; §7.2 has the curve to decide it against.
- 🔊 **`radius = RIG_RADIUS_FLOOR + stack length`.** That formula was tuned against a
  slot ladder costing 38 Db. If slots 5 and 6 become genuinely reachable, beams reach
  8–9 hexes on a 111-hex board and Dom13 (Drive 10) arrives in real matches for the
  first time. Re-bench after, do not guess before.
- 🤖 **The bot needs all of it** — unlock-hunting in the cost web, and the remove
  action in `legalActions` + `actionScore` — or every bench number describes a game
  the human plays differently. ⚠️ And score the *resulting chord*, not the act of
  tidying or the walk toward a token: 📏 paying the bot for good facing made it spin
  in place instead of acting. **Value on the approach funds orbiting rather than
  arriving.**
- 📌 **Doc drift found while writing this.** `GAME_BRIEF.md` §8 and the Theory branch
  blurb both say you start with the full Major scale via a "free `theory_major`
  grant". `economy.js:286` grants `unlockedSkills: []` to everyone but the Ronin, and
  `playableScale` starts you on the **Major Pentatonic**. The grant does not exist.
  It stops mattering when the gate comes off — but fix the docs in that pass.
- **`stackCapFor()` is the single choke point** for "how many slots does this Spirit
  have" — 45 call sites across 10 files, all going through one function. It becomes a
  read of per-stack state instead of a read of `unlockedSkills`. That is the whole
  migration.

---

## 9. Where the code is

| Thing | File |
|---|---|
| Chord templates, `evaluateChord` | `music/chords.js` |
| Pardon tiers, `tiersFor`, `contextClaim`, `classifyTrack` | `music/context.js` |
| Gesture detectors (live + the deleted Style ones, documented in place) | `music/cadence.js` |
| Playable scale, `NOTE_POOL` | `music/notes.js` |
| `stackCapFor`, `STACK_CAP_*`, `STACK_COMMIT_BUDGET` | `data/gameConstants.js` |
| The Theory branch itself | `data/skillTree.js` |
| Board tokens: `makeBoardToken`, spawn, drift | `board/boardHelpers.js`, `engine/systems/board.js` |
| Drive spend / fray | `engine/systems/attackParams.js`, `combat.js`, `battleFlow.js` |
| Stack seats (HUD) | `rlsw-simulator-v3_8_1.jsx` ~14360, `ui/NoteCommitOverlay.jsx` |
| ⭐ Fame grant, the cap, the discard | `engine/systems/battleFlow.js` — `grantFame`, `fameToWin` |
| 📏 The ledger channel (`kind:'ledger'`) | `engine/systems/battleFlow.js` header + `runBattleFlow` |
| 📏 Fixed-length + cap-off instruments | `config.fameTarget` / `config.fameCap` — `matchConfig`, `runMatch`, `engine/state.js`'s config whitelist |
| 🎤 The harness's fan hooks | `engine/policies/play.js` — `harnessHooks` |
| 📏 The measurement itself | `.scratch/famedist.mjs`, `.scratch/_famedist_results.md` |

⚠️ **The stack seats are a VISUAL change**, so the remove-a-note affordance goes to a
standalone preview page in `.scratch/` first — see `CLAUDE.md`. Good news: the seat
already carries `data-stack-slot={i}` and a per-seat `burst` channel, and is
`cursor:'default'` with no handler, so there is nothing to unpick.
