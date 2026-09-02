# PROGRESSION REWRITE — the Theory branch comes off the tree

> **Design sketch, 2026-09-01. Alex's call, out of a long conversation.**
>
> ✅ **🅰️ §2 AND THE FIRST HALF OF 🅱️ §3 ARE BUILT — 2026-09-02.** The Theory
> branch is deleted; stack seats 4–6 are found on the board; the pardon ladder is
> universal and free. `music/stackSlots.js`, `test:stackslots` (115 assertions),
> and the corrections §2 needed are marked inline below.
>
> ⛔ **STILL UNBUILT, AND EACH IS NOW A HOLE RATHER THAN AN IDEA:**
> **§3's payout split** (fans for characterful playing) · **§4's ending fork** —
> ⚠️ its three gated endings are currently UNREACHABLE, because the Theory table
> was their only granter · **§5's Db streams** — ⚠️ 52 Db of sink left with the
> branch and 🎀 **Glamarchy can now buy nothing at all** · **§6's remove-a-note**.
>
> ✅ **WHAT HAS LANDED IS THE INSTRUMENTATION, and it moved the plan.** Step 1
> of the agreed order (instrument, measure, then tune) shipped on 2026-09-01:
> `grantFame` now reports what the per-turn cap discards, the harness pays and
> scatters fans like the client does, and a bench run can be pinned to a fixed
> horizon with the cap lifted. **§7.1 has the numbers.**
>
> ⛔ **AND §7.7's PARTING SUGGESTION IS CLOSED — see §7.8, measured 2026-09-02d.**
> The "make the window scale with the crowd" option lands on the **same**
> margin-per-discard curve as simply raising the flat cap, cell for cell. Only
> the ROOM the window leaves is the variable; the mechanism is not. The cap
> decision is the three-way in §7.7 and nothing else. ✅ The instrument for it
> (`config.fameWindowScale`) shipped; no game rule did.
>
> 🪦 **AND §7.2's CONCLUSION WAS WRONG — see §7.5, measured 2026-09-02.** §7.2
> said the cap is the lever because matches end on knockouts rather than on
> Fame. With the finish line ON, **82% end on Fame in 9 turns per player**;
> the knockout reading was an artifact of an instrument that had removed the
> finish line. §7.5/§7.6 replace the recommendation: **the cap is a catch-up
> brake and a shock absorber, and raising it would SHRINK the crowd that §3
> wants to pay in.**
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
| **Stack slots 4, 5, 6** (`theory_dom7/modes/chromatic`) | ✅ 🅰️ Found on the board (§2) — **BUILT** |
| **Chord-tone pardon** — a note in your stack is never Discord | ✅ 🅱️ Universal, free, turn one (§3) — **BUILT** |
| **Play the changes / extensions / approach notes** | ✅ 🅱️ Universal, free, turn one (§3) — **BUILT** |
| **Scale expansion** — pentatonic → major → minor → modal | ✅ 🅱️ Gone as a gate — **BUILT**, and read the ⚠️ below, because the obvious reading was wrong |
| **52 Db of sink** | ⛔ 🅳 Per-ability upgrade streams (§5) — **NOT BUILT. The Db has nowhere to go and one Spirit has nothing to buy.** |

⚠️ **THE SCALE ROW ALMOST WENT THE WRONG WAY, AND IT IS WORTH THE PARAGRAPH.**
"Gone as a gate — play anything" reads as *hand everybody the top of the ladder*
(full Major, ♭7, ♯4 — nine clean notes of twelve). **That would have deleted the
colour payout.** A note that is merely in-scale pays NOTHING; a note your stack
pardons pays Drive or Sustain (`melodyCommit.js`'s `colorDrive`/`colorSustain`).
Widen the key and every pardon you used to be paid for becomes free scenery, and
the chord-tone pardon is left with almost nothing to pardon. So the palette stays
at the base — Major Pentatonic, natural minor in minor — **and the CHORD does the
widening**, which is the doc's own thesis. Alex's call, 2026-09-02.

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

✅ **BUILT, WITH TWO CORRECTIONS THE CODE FORCED:**

1. 🎯 **THE ROOT IS NOT A STATE FIELD. It is `stack[0]`, derived.** "The first note
   committed" IS the first element, because commits push — and storing it as a
   second field that must agree with an array is the exact shape of every desync
   this project has had (`SEQUENCING.md` §5.A), with the client and the engine both
   writing the stacks. Better still, it re-points itself under rules that already
   exist: ⚔️ the Drive spend takes the root, so spending your foundation hands the
   hunt to the next note up — which is §6's "removing the root is how you re-point
   what you are hunting", for free; 🛡️ Sustain frays from the tail, so a Sustain
   hunt stays stable across three opponents' turns.
2. ⚠️ **THE FIXED ROOT DOES NOT REACH SCORING.** `evaluateChord` is still order-free
   and no chord in the game was re-priced. §7.4 measured that root-anchored
   *scoring* leaves 67–92% of stacks spelling no chord once a root is consumed;
   Alex's call was that the root decides only WHICH NOTE YOU ARE HUNTING.

📌 And two details the build settled: the seat is opened **free of the stack-commit
budget** (a Spirit who has spent their three must still be able to walk onto their
own seat), and the found note **does not also bank** — paying the find twice, the
seat and a reservoir slot, is the "one gesture, one currency" line §17 exists to
hold.

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

✅ **BOTH BUILT — and the pin rule as written was a no-op.**
⚠️ **NOTHING IN `applyTokensDrifted` EVER ROTATED A TOKEN OUT.** Tokens leave the
board by being picked up and by nothing else; drift only relocates. The rule above
was already satisfied and would have shipped, passed, and protected against
nothing. 🎯 The failure it was reaching for is the *other* half — a token you are
three hexes from teleporting across the board as you approach — so what was built
is: **a live unlock does not drift at all.** It holds its hex and its age until
somebody takes it. (Freezing the age matters too: resetting it would let the token
drift the instant its hunter's root moved on, which is exactly when the player has
stopped watching it.)
📌 The spawn share is `TOKEN_UNLOCK_SPAWN_SHARE`, 0.35, and it is the first dial to
turn if a bench says seats 5 and 6 are never reached — or are reached by turn three.
⚠️ `makeBoardToken` now draws TWICE, unconditionally, so a board with no live
targets consumes the same stream as one with them. A generator that forked there
would desync every seat downstream in a replay.

✅ **DENIAL IS INTENDED — Alex's call, 2026-09-02.** Anyone can pick up any token,
so taking the B♭ your rival needs though it is useless to you is legitimate
counterplay, and it makes the board contested. `liveUnlockPcs` is therefore
deliberately everybody's targets at once, and both the spawner and the pin rule
read it that way. 🤖 The BOT is the one asymmetry: it hunts only its own seats,
because a bot walking three hexes to spite a rival is not a behaviour anyone asked
for and is not measurable. First thing to revisit if bench matches read as too
cooperative.

---

### ✅ 🔓 AND THE HEX YOU ARE HUNTING LIGHTS UP — built 2026-09-02g

The whole hex, in the colour of the seat the find would fill (`DRIVE_C` / `SUSTAIN_C`,
from `unlockClaim` so the marker and the payout cannot disagree), pulsing 0.45→1
with a 3→10px bloom, plus a ×1.15 bump on the chip. Dialled by Alex on
`.scratch/unlock-glow-preview.html`; `SEQUENCING.md` §5-glow has the reasoning and
the three bugs the SSR diff caught.

⚠️ **RIVAL SEATS ARE NOT MARKED**, and that is a deliberate narrowing of §2's
"denial is real". The rule is unchanged — anyone may still take anyone's Lost Chord,
and `liveUnlockPcs` still answers for the whole table — but only the ACTING Spirit's
hunt is drawn. Marking four Spirits at once is four colours of noise on a 111-hex
board, and the design audience is now stated: **the ultimate beginner.**

📌 **A find fills exactly one seat, so "a note both my stacks want" is not a state.**
`unlockClaim`'s lower-seat-wins tie-break settles it before anything renders. A
consequence: the board reads mostly-red early, because Drive's seat is usually the
lower one and ties go to Drive.

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

✅ **BUILT, AND IT WAS EXACTLY THAT SMALL** — one function, plus dropping the now
meaningless `unlockedSkills` parameter from `chordContext`, `contextClaim` and
`classifyTrack` rather than letting it rot in three public signatures.

⛔ **BUT ONE PROPERTY DID NOT SURVIVE, AND IT IS WORTH KNOWING.** The old ladder was
**monotonic**: buying a tier could never take a pardon away, which `tiersFor`'s
cumulative OR guaranteed. The obvious replacement — "committing a note never takes
a pardon away" — **is false, by design.** The pardon set is a function of the
chord's QUALITY, so `C-E-G` (completes to B, extends to F♯) becomes `C-E-G-B♭`
(already complete, so no B; extends to D♭/D instead) and two notes go grey the
instant the B♭ lands. That is `context.js`'s own thesis — *stack a ♭3 and watch
which notes go grey* — and B8 deleted the declare-your-mode prompt specifically to
move that decision into the stack. The invariant that replaced it in `b0check` is
the one a player can actually reason about: **a note you literally placed is
pardoned, at every quality, always.**

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

⛔ **NOT BUILT — AND IT IS NOW THE MOST URGENT ITEM IN THIS DOC, NOT THE LAST.**
Deleting the branch removed 52 Db of sink and the game's last SHARED ladder in one
move. What is left in `SKILL_TREE` is three exclusive routes, so what a Spirit may
buy is now entirely a function of who they are — and 🎀 **Glamarchy owns no route,
so she can buy nothing at all.** Every Db she earns banks forever. `skillTreeCheck`
§7 and `selftest`'s `botPickSkillTarget` block are pinned as alarms for this and are
**expected to fail when §5 lands**; the fix is to assert what she can buy, not to
delete them.

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
  ⚠️ **These crowd figures are pre-2026-09-02 weights** (0.10 / 0.03 / ×2.0) and
  are not comparable to anything measured after §7.7's re-weight. The reading
  they support — that the crowd had headroom — is what §7.7 acted on.

**The cap curve at 15 tpp** — `fameCap` scales every ceiling, so `RIFF_FP_TURN_CAP`
stays at ×2 throughout:

| cap | 4 (today) | 5 | 6 | 8 | 12 | off |
|---|---:|---:|---:|---:|---:|---:|
| Fame/seat | 19.8 | 22.5 | 25.2 | 27.9 | 29.2 | 31.3 |
| p90 | 37 | 42 | 50 | 54 | 56 | 60 |
| max | 55 | 67 | 93 | 104 | 105 | 112 |
| discarded | 30.0% | 22.6% | 16.6% | 8.6% | 3.9% | 0% |

### 7.2 🎯 WHAT THIS DOES TO §8's PLAN, AND IT IS A REORDERING

> 🪦 **PARTLY RETRACTED 2026-09-02 — read §7.5 before acting on this section.**
> The paragraph below beginning "📌 And the Fame target is set just past the
> horizon the board allows" is **WRONG**, and so is everything that follows from
> it. It was read off `famedist.mjs`, which sets `fameTarget: ∞` — so in that
> instrument a knockout was the ONLY way a match could end, and "most matches
> end on a knockout" was a property of the measurement, not of the game. With
> the finish line ON, **82% of matches are won on Fame, at a median of 9.0 turns
> per player.** The first paragraph — that the cap discards a third of awarded
> Fame and that the crowd has headroom — still stands; it is measured. What does
> not stand is the conclusion that the cap is therefore the lever to move.
> §7.5 has the replacement.

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

### 7.5 🏁 THE RACE, WITH THE FINISH LINE ON — measured 2026-09-02

`.scratch/famerace.mjs` + `.scratch/_famerace_results.md`. 200 matches per cell,
2 seats, 3 lives, searcher v searcher, **no `fameTarget` override** — the finish
line is `fpPerLife`, exactly as shipped. `fameCap` is the only constant moved.

**§7.1 measured the ECONOMY and had to remove the finish line to do it. That is
the right instrument for "how much Fame does this game produce" and the wrong
one for "how does a match end" — and §7.2 read the second answer off the first.**

| cap | ends on FAME | med turns/player | ⭐win | ⭐lose | margin | discard | crowd × | ♥ |
|:---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **4 (today)** | **82%** | **9.0** | 24.2 | 9.4 | 14.8 | 28% | 1.40 | 2.3 |
| 5   | 89% | 7.5 | 25.4 | 9.2 | 16.1 | 17% | 1.36 | 2.1 |
| 6   | 92% | 6.5 | 25.8 | 9.4 | 16.4 | 10% | 1.32 | 2.0 |
| 8   | 93% | 6.0 | 26.9 | 9.0 | 17.9 |  4% | 1.30 | 1.9 |
| 12  | 94% | 6.0 | 27.0 | 9.2 | 17.8 |  1% | 1.29 | 1.9 |
| off | 94% | 6.0 | 27.0 | 8.7 | 18.3 |  0% | 1.28 | 1.9 |

- ⛔ **THE FAME RACE IS NOT BLOCKED.** It is how four matches in five already
  end, and it ends them in nine turns per player, not the sixteen §7.2's
  arithmetic predicted. The arithmetic used the *seat average* 1.5 FP/turn; the
  **winner** is not the average seat, and the loser (⭐9) is what drags that mean
  down.
- 📉 **SO RAISING THE CAP DOES NOT UNBLOCK ANYTHING — IT SHORTENS THE MATCH.**
  4 → 6 takes the median from 9.0 to 6.5 turns per player. That is the real
  effect of the change §7.2 recommended, and it is not the effect it wanted.
- 🎤 ⚠️ **AND IT SHRINKS THE CROWD, MONOTONE, ALL THE WAY TO CAP OFF.** ×1.40 →
  ×1.28, ♥2.3 → ♥1.9. Fans accumulate over turns and a shorter match is a
  smaller crowd. **§3 pays a whole new route in fans. Raising the cap works
  against §3** — which is the exact opposite of the reason §7.2 put the cap
  first.
- ↔️ **THE CAP IS A CATCH-UP BRAKE.** ⭐lose sits at 8.7–9.4 across the entire
  range while ⭐win climbs 24.2 → 27.0. Whatever the cap stops banking, it stops
  the Spirit who is *already ahead* from banking. Lifting it widens the margin
  14.8 → 18.3 and buys the trailing player nothing.

**The pair that preserves the race**, if the 28% discard is judged worth removing
for its own sake (150 matches/cell):

| cap | target | ends on FAME | med turns/player | margin | discard | crowd × |
|:---:|:---:|---:|---:|---:|---:|---:|
| 4 | 24 (shipped) | 81% | 9.0 | 14.5 | 27% | 1.40 |
| **6** | **30** | **82%** | **8.5** | 18.8 | **12%** | **1.40** |

Cap and target move together and the match you get back is the one you had, with
the pipe open. It costs a wider margin (18.8 vs 14.5) — the catch-up brake again.

### 7.6 🎯 SO WHAT THE CAP DECISION ACTUALLY IS

Not "unblock the Fame race" — it is not blocked. The cap does exactly two things
worth deciding about:

1. **It is a catch-up brake.** Keeping it keeps matches closer. That is a
   legitimate reason to keep it at 4 and has nothing to do with Fame supply.
2. **It is 28% of headroom that absorbs a new payment source without
   recalibrating anything else.** §3 is about to add one. A pipe already
   clipping a third of what it carries takes a new fan route and clips a little
   more, instead of the new route inflating the game.

📌 **Reading 2 is an argument for leaving the cap where it is until §3 exists**,
and then measuring the discard again with the fan route live. The cap is the
shock absorber, not the blockage — and §8's original worry ("adding a new fan
source is the most likely balance blowout") is answered by the cap being there,
not by moving it.

⚠️ **What should NOT be tuned against any of this: the absolute FP-per-turn
numbers.** They move with every kit, payout and board change still open in this
doc, and they will settle by being played. The columns that carry the finding are
the comparative ones — ending mix, match length, margin, crowd.

⚠️ **The 4–11% of matches that hit the harness turn ceiling are a BOT artifact,
not a game property.** Nothing in the game caps turns; `MAX_TURNS` (400) is a
safety net in `runMatch`. Those are the searcher failing to close, the share
falls as the cap rises, and they belong in `BOT_STRATEGY_HANDOFF`.

---

### 7.7 🎤 THE FAN RE-WEIGHT — SHIPPED 2026-09-02, and it half-works

**Alex's call: "a player can't tell much difference at all from gaining a few
fans — it's percentages of a percentage point. They should actually mean
something." Correct, and the reason turned out not to be the ceiling.**

⚠️ **`FAN_MULT_CAP = 2.0` WAS NEVER A CAP.** At the fan caps
(`FAN_DIEHARD_CAP` 6, `FAN_CASUAL_CAP` 14) the formula's own ceiling is
`1 + 0.10×6 + 0.03×14 = 2.02`. The clamp shaved 0.02 off a literal full house
and bound **nothing else in the game, ever**. Raising that number alone would
have been a pure no-op.

📌 **The actual culprit was integer rounding.** `grantFame` does
`Math.round(fp × mult)`. At a typical crowd, one Casual at 0.03 moved a 3 FP
payout from 3.87 to 3.96 — both round to 4. Checked across every grant size the
game pays (1, 2, 3, 4, 6, 8): **one Casual changed the payout at none of them
except 8.** A fan you cannot feel is not an economy.

**What shipped** (`data/gameConstants.js`): `FAN_DIEHARD_WEIGHT` 0.10 → **0.40**,
`FAN_CASUAL_WEIGHT` 0.03 → **0.12**, `FAN_MULT_CAP` 2.0 → **5.0**. The weights
are scaled to put a full house just past the new ceiling (5.08 vs 5.0), which is
the same shape the old pair had (2.02 vs 2.0), and the ~3.3:1 Diehard:Casual
ratio is preserved. One Casual now moves the payout at **4 of the 6** grant
sizes; one Diehard at all of them.

| at the shipped per-turn cap of 4 | crowd × | ♥ | ends on FAME | med turns/player | margin | discard |
|---|---:|---:|---:|---:|---:|---:|
| old weights | 1.40 | 2.3 | 82% | 9.0 | **14.8** | 28% |
| **new weights** | **2.42** | 2.1 | 90% | 8.0 | **14.7** | **48%** |

✅ **The re-weight is free on match shape.** +73% crowd, length 9.0 → 8.0 turns
per player, and **the margin does not move** (14.8 → 14.7).

#### ⛔ But the crowd now saturates against `FAME_PER_TURN_CAP`

**A 2 FP deed at ×2.42 is already 5, clipped to 4.** So above roughly ×1.4 the
crowd stops scaling anything and becomes a switch — *do I clear the window in one
deed or two*. **48% of every Fame point the rules award is discarded.**

🎯 **So fans are no longer weightless at the bottom, and are still weightless at
the top.** Half of Alex's complaint is fixed. The other half is now provably a
`FAME_PER_TURN_CAP` problem rather than a fan-weight problem — which §7.6 parked
as "re-measure the discard once §3's fan route exists". The re-weight arrived
first and did the same job.

| per-turn cap | target | crowd × | ends on FAME | med turns/player | margin | discard |
|:---:|:---:|---:|---:|---:|---:|---:|
| **4 (today)** | 24 | 2.42 | 90% | **8.0** | **14.7** | 48% |
| 6 | 24 | 2.06 | 98% | 5.0 | 19.0 | 28% |
| 8 | 24 | 1.98 | 99% | 4.5 | 22.6 | 18% |
| 6 | 32 | 2.41 | 87% | 7.5 | 20.4 | 33% |
| 8 | 32 | 2.17 | 94% | 6.0 | 23.7 | 19% |
| 6 | 40 | 2.74 | 77% | 9.5 | 22.0 | 38% |
| 8 | 40 | 2.48 | 87% | 8.0 | 26.3 | 23% |

↔️ ⚠️ **EVERY ROUTE TO AN UNSATURATED CROWD WIDENS THE MARGIN.** 14.7 → 19.0 →
22.6 as the window opens, and 20.4 → 26.3 when the target rises with it. §7.5
found the per-turn cap is a catch-up brake; a heavier crowd rewards whoever is
already ahead; the two compound. **Nothing measured buys a bigger crowd effect
without a more lopsided game.** That is the trade, and it is Alex's call:

- **Leave the cap at 4** — closest match, crowd saturates, 48% discarded.
- **(6, 32)** — the least-bad opening: ×2.41 and 7.5 turns/player, margin 20.4.
- **(8, 40)** — holds today's 8.0-turn length at 23% discard, margin 26.3.

⚠️ **AND §7.8 CLOSES THE FOURTH.** These three are the whole menu.

📌 **A third option nothing here measures: make the window scale with the crowd**
(`4 × mult` rather than a flat 4). That keeps the brake against a *small* crowd
while letting a *big* one land, which is the only shape that gets both halves of
what Alex asked for. It is a rule change rather than a constant, so it wants its
own design pass.

> 🪦 **MEASURED 2026-09-02d, AND IT IS NOT A THIRD OPTION — see §7.8.** The
> scaled window and the flat window land on the **same** margin-per-discard
> curve, cell for cell. It buys nothing the flat cap does not, and it costs the
> same. The paragraph above is the reasoning, and the reasoning was wrong; the
> shape it describes does not exist in the numbers.

#### ⚠️ 7.7 D — knock-on flagged, NOT fixed

`evaluate.js:907` normalises the bot's `fanMult` term against `FAN_MULT_CAP - 1`,
so the divisor moved 1.0 → 4.0 and the term's shape survived — but fans are worth
~70% more Fame in real play than when that weight was tuned. **The bot will
under-invest in crowd work, and every bench number from 2026-09-02 on is a
reading of a bot that does not know fans got better.** Retuning it is its own
pass with its own bench; do not fold it into a constants change.

📌 Measurements in `.scratch/_fanweight_results.md`, raw in
`_fanweight_raw_A/B.log`.

---

### 7.8 ⛔ THE SCALED WINDOW IS NOT A THIRD OPTION — measured 2026-09-02d

`.scratch/famewindow.mjs` + `.scratch/_famewindow_results.md`. 150 matches per
cell, 2 seats, 3 lives, searcher v searcher, **finish line ON**, stalemate bound
40 turns/player. Instrument: `config.fameWindowScale` = `k`, the share of the
crowd multiplier the per-turn window inherits — `k = 0` is today's flat window,
`k = 1` is fully scaled. ⚠️ A run with it set is not a game.

**§7.7 ended on a hunch and the hunch was good enough to be worth a day.** The
flat window clips two different things at once — *how much you did this turn* and
*how loud your audience is* — and §7.7 could only ever move both together.
Scaling the window by the same crowd that scaled the payout separates them: the
window binds on **raw deed volume** (four deeds' worth a turn, whatever they are
worth to your audience) and stops binding on the crowd at all. If §7.7's margin
widening came from deed volume, the scaled window buys the crowd effect cheaply
and answers both halves of Alex's complaint at once.

✅ **The flat sweep reproduces §7.7 cell for cell** (cap 4 → 48% / 14.7 / 8.0 /
×2.42; cap 6 → 28% / 19.0 / 5.0 / ×2.06; cap 8 → 18% / 22.6 / 4.5), so the
instrument is measuring the same game the last two sessions measured.

⛔ **AND THE TWO MECHANISMS LIE ON ONE CURVE.** Sorted by how much room the
window leaves, flat and scaled cells *interleave*:

| mechanism | window | discard | margin | med tpp | crowd × |
|---|---|---:|---:|---:|---:|
| flat | cap 4 (today) | 48% | 14.7 | 8.0 | 2.42 |
| flat | cap 5 | 38% | 16.6 | 6.5 | 2.22 |
| **scaled** | 4 × k0.25 | 37% | 17.4 | 6.5 | 2.20 |
| **scaled** | 4 × k0.50 | 29% | 19.7 | 5.5 | 2.06 |
| flat | cap 6 | 28% | 19.0 | 5.0 | 2.06 |
| **scaled** | 4 × k0.75 | 22% | 22.0 | 5.0 | 2.00 |
| flat | cap 8 | 18% | 22.6 | 4.5 | 1.98 |
| **scaled** | 4 × k1.00 | 16% | 22.8 | 4.5 | 1.97 |
| flat | cap 12 |  4% | 22.4 | 3.5 | 1.94 |

At matched discard the pairs are identical to within noise — margin 16.6 vs 17.4,
19.0 vs 19.7, 22.6 vs 22.8; match length 6.5 vs 6.5, 5.0 vs 5.5, 4.5 vs 4.5;
crowd ×2.22 vs ×2.20, ×2.06 vs ×2.06, ×1.98 vs ×1.97. Holding the **finish line**
matched instead of the window says the same thing: scaled (4×k1, 40) is 28.1
margin at 18% discard against flat (8, 40)'s 26.3 at 23% — further along the same
curve, never off it.

🎯 **SO ONLY THE ROOM IS THE VARIABLE, AND THE MECHANISM IS NOT.** Whatever opens
the window, the game pays the same price for the same opening. The §7.6 reading
survives untouched: the window is a catch-up brake, and un-braking it is the
entire cost, regardless of which rule does the un-braking.

**Two things the curve says that §7.7 could not:**

- 📉 **THE CROWD SHRINKS ALONG THE WHOLE CURVE**, ×2.42 → ×1.94. Every route that
  lets the crowd land also shortens the match, and a shorter match grows a
  smaller crowd. **"Let the crowd land" and "have a big crowd" are opposed**, and
  no setting of this window separates them. That is a stronger statement than
  §7.5's version of it, because it now holds across a rule change as well as a
  constant change.
- 🧱 **THE MARGIN COST SATURATES BY cap 8 / k1.** cap 8 → cap 12 removes another
  14 points of discard and moves the margin by −0.2. The entire lopsidedness is
  bought in the *first half* of the opening — **there is no cheap region to sit
  in**, which is exactly what a "partial" like `k = 0.25` was hoping to find.
- 🔇 📌 **And `silenced` never leaves 2–4%.** Grants that bank literally nothing
  are rare even at 48% discard, so the discard is overwhelmingly **partial
  clipping of amplified payouts**, not deeds lost whole. §7.7's "the crowd becomes
  a switch" is a payout landing 4 instead of 5 — worth restating precisely,
  because "half the Fame is thrown away" sounds like whole events vanishing and
  it is not that.

#### 🎯 SO THE DECISION IS THE THREE-WAY IN §7.7, AND IT IS STILL ALEX'S

Nothing here changes the menu; it removes the fourth item people would keep
reaching for. §7.6's reading 2 is now the strongest argument on the table:
**leave the window at 4 and re-measure once §3's fan route exists**, because a
pipe already clipping half of what it carries absorbs a new payment source
without recalibrating anything else — and every alternative to it costs margin at
a rate that does not improve however you pay.

⚠️ **AND THE REAL LEVER MAY NOT BE IN THIS DOC AT ALL.** Margin is only a defect
because Legend Run is a **race** — a lopsided race is decided early and stops
being a game. `WIN_CONDITIONS_DESIGN.md`'s 🎸 Battle of the Bands has no finish
line, so FP is a **score**, and a wide scoreline is not the same defect at all:
the buzzer still lands where it was always going to land. **Every cell on the
curve above that was rejected for widening the margin may simply be fine in a
fixed-length mode**, which would let the crowd land fully in one mode and stay
braked in the other. ✅ **MEASURED 2026-09-02e, AND IT HOLDS.** Battle of the
Bands was built headless and benched with the cap off (`WIN_CONDITIONS_DESIGN.md`
§9, `.scratch/_bandsbench_results.md`): **0% of awarded Fame discarded at every
set length, a crowd of ×2.90 at ten rounds against today's ×2.28 — and a
PROPORTIONAL margin of 0.50 against today's 0.48**, flat across four to sixteen
rounds. ⚠️ The absolute margins are much larger and that is not the same thing:
the scores are larger. **The lopsidedness every cell on the curve above was
rejected for does not appear in a score game**, because it was a race's problem
all along. 📌 And the crowd grows with SET LENGTH — the only lever measured
anywhere in this project that makes it bigger rather than smaller. 📌 It also gives `SEQUENCING`'s
§5-win.E open item ("`FAME_PER_TURN_CAP` means something different per mode") a
concrete first hypothesis to test rather than an intuition, and §5-win.E's own
warning applies — **the intuitive answer about this constant has been wrong
twice already.**

✅ **What shipped for this: the instrument only.** `config.fameWindowScale`, in
`grantFame` beside `fameCap`, threaded through `state.js`'s config whitelist and
`matchConfig`/`runMatch`/`runBench`. Defaulted off; with it unset `grantFame` is
byte-identical in behaviour and in log output. ⚠️ **No game rule changed** — the
doc's standing invariant holds.

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
  it is a payment into a pipe that is already 30% blocked.** ✅ **AND §7.5
  (2026-09-02) says the pipe being 30% blocked is the FEATURE here:** the cap is
  a shock absorber that takes a new fan source without inflating the game, and a
  catch-up brake besides. ⚠️ Raising it SHRINKS the crowd (×1.40 → ×1.28) because
  it shortens the match — so "decide the cap first" resolves to **leave it at 4
  and re-measure the discard once §3's fan route exists.** §7.5/§7.6 replace
  §7.2's recommendation.
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
| 🅰️ The seat ladder, the root, the hunt | `music/stackSlots.js` — `SLOT_LADDER`, `unlockTargets`, `unlockClaim`, `applyUnlockClaim` |
| 🅰️ The per-stack cap (the choke point) | `data/gameConstants.js` — `stackCapFor(noteSheet, which)`; ⚠️ throws on the old array |
| 🅰️ Found seats on the sheet | `engine/systems/economy.js` — `driveSlots` / `sustainSlots`, and they only go up |
| 🅰️ The find, headless and in the client | `engine/policies/transition.js` `collectPickups` · `rlsw-simulator-v3_8_1.jsx` `checkTokenPickup` |
| 🔓 Weighted spawn / the pin rule | `board/boardHelpers.js` `makeBoardToken` · `engine/systems/board.js` `applyTokensDrifted` · `TOKEN_UNLOCK_SPAWN_SHARE` |
| 🤖 The bot's hunt | `engine/policies/bot.js` — `botMoveCtx`'s `unlocks`, scored in `botHexScore` |
| ✅ The suite | `engine/stackSlotsCheck.mjs`, `npm run test:stackslots` |
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
| 📏 The economy measurement (finish line OFF) | `.scratch/famedist.mjs`, `.scratch/_famedist_results.md` |
| 🏁 The race measurement (finish line ON) | `.scratch/famerace.mjs`, `.scratch/_famerace_results.md` |
| 🎤 The fan re-weight and its knock-ons | `.scratch/_fanweight_results.md` |
| ⛔ The scaled-window measurement (§7.8) | `.scratch/famewindow.mjs`, `.scratch/_famewindow_results.md` |
| 📏 The window-scale instrument | `config.fameWindowScale` — `grantFame`, `engine/state.js`, `matchConfig` |
| 🎸 The score game where the crowd lands | `WIN_CONDITIONS_DESIGN.md` §9, `.scratch/bandsbench.mjs`, `.scratch/_bandsbench_results.md` |
| 🎤 Fan weights, the crowd ceiling | `data/gameConstants.js` — `FAN_DIEHARD_WEIGHT`, `FAN_CASUAL_WEIGHT`, `FAN_MULT_CAP` |
| 🎤 The multiplier itself | `board/boardHelpers.js` — `crowdMultiplier` |

⚠️ **The stack seats are a VISUAL change**, so the remove-a-note affordance goes to a
standalone preview page in `.scratch/` first — see `CLAUDE.md`. Good news: the seat
already carries `data-stack-slot={i}` and a per-seat `burst` channel, and is
`cursor:'default'` with no handler, so there is nothing to unpick.
