# 🎪 MARQUEE QUIZ & THE RIG WORKOUT — design

> ✅ **§1, §2, §4, §5 AND THE TREE DELETION ARE ALL IMPLEMENTED** as of 2026-08-20 — see §8
> for what landed when, and `SEQUENCING.md` §5.A⁷–§5.D⁷ for the measurements.
> **§3's throughput question is still open; §7's Db hole is now MEASURED and small
> so far (mean 4.0 unspent at match end — but on ~19-turn bench matches); and §6's
> bot odds are the single largest lever on bot strength in the game.**
>
> ⚠️ Originally written 2026-08-20 out of a design
> conversation with Alex. Companion to `SEQUENCING.md` §5.H⁶ ("The rig that
> breathes"), which holds the other half of this rework and was recorded the
> same day.
>
> ⚠️ **THIS DOC PUTS `AMP_DECK_DESIGN.md` ON NOTICE.** It does not supersede it
> yet, because the decision to pull the rig off the skill tree has been *made*
> but not *built*. The moment any of §4 below ships, `AMP_DECK_DESIGN.md` §2.2,
> §2.3, §2.5 and the whole `rig_*` branch of `data/skillTree.js` describe a game
> that no longer exists, and a doc that has drifted from the code is worse than
> no doc. Rewrite it in the same pass, do not edit around it.

---

## 0. What this is, and what it replaces

Today the marquee is a lottery. One event hex is live at a time
(`EVENT_HEX_COUNT = 1`), it respawns one round after being consumed, and
stepping on it draws a random question you had no hand in choosing. Get it
right and you take fans by difficulty (2 / 3 / 4). Get it wrong and nothing
happens. The `sauce` reveal shows either way, which is the best thing about the
current design and is kept untouched below.

Two problems. The board offers **one** of these on 111 hexes, so who gets it is
mostly a question of who already stood nearby; and the player makes **no
decision** at any point — they walk on and a coin flips.

This design fixes both, and in doing so gives the rig somewhere to live now that
it is coming off the skill tree.

### 0.1 The three clocks

The change only makes sense next to §5.H⁶. Between them, **nothing about the rig
is a purchase any more** — every part of it runs on its own clock:

| Part of the rig | Where it comes from | Clock |
|---|---|---|
| **Radius** — how far the rig reaches | Drive on your turn, Sustain on theirs | Moment to moment (§5.H⁶) |
| **Pool size** — how many dice you roll | The marquee quiz | Earned, then atrophies (§5) |
| **Die size** — how big those dice are | The marquee quiz | Earned, then atrophies (§5) |

That is the whole pitch: the rig stops being a thing you *bought in round three*
and becomes a thing you **play into existence and then have to maintain**. It is
also why "workout" is the right word for it and "buff" is the wrong one — see §5.

---

## 1. Two marquees

`EVENT_HEX_COUNT: 1 → 2`.

**Why.** One hex on this board is not a decision, it is proximity. Two hexes
means the player has to choose which one to route toward, and it means a second
Spirit has a target instead of conceding the round. It also halves the sting of
the marquee spawning in someone's corner pocket.

🎯 **THE ENGINE IS ALREADY WRITTEN FOR TWO.** `engine/systems/board.js`
`applyEventHexSpawned` opens with `if (evHexes.length >= 2) return …` — it has
tolerated a second hex all along. Setup is fine too: `engine/state.js:50` places
`EVENT_HEX_COUNT` of them in a loop. Two things are not fine:

⚠️ **THE `2` IN `applyEventHexSpawned` IS A LITERAL, NOT THE CONSTANT.** Bump
`EVENT_HEX_COUNT` to 3 one day and the spawner silently refuses to go past two,
with no error and no log line. Make it read `EVENT_HEX_COUNT` in the same
commit, whether or not anyone ever wants three.

⚠️ **THE RESPAWN DRIVER TOPS UP BY ONE, ON AN EDGE.** The client
(`rlsw-simulator-v3_8_1.jsx:10264`) ticks the counter once per round and spawns
**one** hex on the `eventRespawnIn` transition to 0. If both marquees are
consumed inside the same round, the second one never comes back — the timer only
fires once and there is nothing that notices the board is short. The driver
needs to be "top up toward `EVENT_HEX_COUNT`", not "spawn one when the timer
rings."

### 1.1 Separation rule (new)

Two marquees inside one player's corner is worse than one marquee anywhere,
because it hands a single Spirit both without contest. Placement should reject a
candidate hex that is:

- within some minimum axial distance of the other live marquee (**4** is the
  starting suggestion — home → Limelight is 5, so 4 keeps them from sharing a
  neighbourhood without forcing them to opposite edges); and
- 📌 possibly: inside the same Spirit's rig radius as the other. This one gets
  harder under §5.H⁶, where radius breathes and is no longer a fixed number, so
  it may have to be measured against the *floor* radius rather than the live
  one. Flagged, not decided.

---

## 2. The choice card — lane × difficulty

Landing on a marquee no longer draws a question. It opens a **menu**, and the
player picks two things before seeing anything:

**Lane — what the question is about, which decides what it pays.**

| Lane | Question pool | Pays |
|---|---|---|
| 🎤 **CROWD** | Rock lore, scandal, legend, records, live moments | **Fans** (as today) |
| 🎛️ **RIG** | Theory, gear, guitars, amps, studio, technique | **Rig tiers** (§4) |

The fiction does the work here: knowing the lore is *crowd cred*, knowing the
gear is *musicianship*. That split is already the stated reason trivia pays fans
and not DB (`data/trivia.js` header), so this extends an existing rule rather
than inventing one.

**Difficulty — the bet on yourself.** Easy / medium / hard, chosen face-down.
Reward scales with what you picked (§4). This is the entire skill component: the
player who knows their stuff takes hard questions and gets paid; the player who
doesn't takes easy ones and gets paid less, honestly.

**A wrong answer costs nothing** — decided, unchanged from today. The difficulty
choice already carries the risk: miss a hard one and you get nothing where easy
would have paid. Adding a penalty on top punishes the player for reaching, and
the `sauce` reveal should stay a gift rather than a consolation prize.

### 2.1 The content is already tagged for this

`data/trivia.js` holds **180 questions**, and both axes exist in the data today:

| Difficulty | Count |
|---|---|
| easy | 37 |
| medium | 84 |
| hard | 59 |

Fifteen `era` values, three of which map cleanly onto the RIG lane — *Theory,
Gear & Studio Lore*, *Amps, Effects & Studio Gear*, *Iconic Guitars & Their
Players*. There are also 73 `topic` values, far too granular to show a player
but exactly right as the classifier for sorting the decade eras into lanes too
(`gear`, `tuning`, `studio`, `technique`, `effects` are all already tagged).

⚠️ **AND THIS IS WHERE THE PROBLEM IS. THE SIX BUCKETS ARE NOT REMOTELY EVEN.**
Splitting by era alone, counted 2026-08-20:

| | easy | medium | hard | total |
|---|---|---|---|---|
| 🎛️ **RIG** | **7** | 19 | 17 | 43 |
| 🎤 **CROWD** | 30 | 65 | 42 | 137 |

**RIG × easy holds seven questions.** A player who picks that combination — and
"the safe answer in the lane I actually want" is a perfectly reasonable habit —
sees a repeat inside two games, while 65 CROWD mediums sit untouched.

`pickTrivia` makes this worse than it looks: it clears the used-set only when
**all 180** are exhausted, so a starved bucket has no way to recycle on its own.
This wants **per-bucket exhaustion and per-bucket reset**, not one global set.
And the RIG lane needs roughly 15–20 more easy questions written before the
choice is worth offering — that is content work, and it is on the critical path,
not a polish item.

---

## 3. Rewards — the CROWD lane

Unchanged in kind: fans, by difficulty, `TRIVIA_REWARD = { easy: 2, medium: 3,
hard: 4 }`.

⚠️ **BUT THE RATE DOUBLES, AND FANS ARE THE ONE ECONOMY WITH NO PER-TURN CAP.**
`FAME_PER_TURN_CAP` clamps Fame and does not touch fans, because fans *multiply*
Fame rather than being it. Two marquees roughly doubles trivia throughput, and
the fastest route to a maxed crowd multiplier (`FAN_MULT_CAP`, **5.0 since
2026-09-02** — see `PROGRESSION_REWRITE_DESIGN.md` §7.7) should not be
"answer quiz questions". Either trim the payouts when the count goes to two, or
make the second marquee the cheaper one. This needs a bench run, not a guess.

---

## 4. Rewards — the RIG lane, and why they are not permanent

**Decided: amps come off the skill tree.** The rig is no longer bought with DB
at all. That makes the marquee the only source of pool size and die size, which
in turn makes permanence unacceptable — a permanent tier from a free question is
a snowball on an axis nobody at the table can contest, and it would silently
satisfy prerequisites the tree used to gate.

So a correct RIG answer grants **tiers**, and difficulty sets how many:

| Difficulty | Tiers granted |
|---|---|
| easy | 1 |
| medium | 2 |
| hard | 3 |

Each tier is spent immediately, by the player, on one of two tracks:

- 🔊 **Pool** — add a d6 to the dice pool.
- 🎛️ **Power** — upgrade one die in the pool from d6 to d8.

**Power still cannot exceed pool** — you cannot upgrade a die you do not have.
That was the `prereq` gate in the tree, and it survives as a plain arithmetic
rule with no tree to hang off.

⚠️ **KEEP THE CEILING AT 8.** `AMP_DECK_DESIGN.md` §2.5 is explicit that the
keep-highest rework dropped the maximum Sonic roll from 12 to 8, and that
*"every rule that leaned on high Sonic rolls"* — margin-scaled push
`ceil(margin/2)`, knockback tiers, 7+ Performance triggers — was checked against
that. Cap the workout layer at **3 pool + 3 power**, i.e. exactly the old Amp
III / Power III ceiling, so nothing downstream needs rechecking. A hard question
that wants to feel special should feel special by lasting longer, not by
introducing a d10.

### 4.1 🎯 This is a much cheaper change than it sounds

`engine/systems/sonicRig.js` already reduces the entire skill tree to **two
integers and a radius**:

```js
const ampT   = countOf(unlockedSkills, RIG_AMP_IDS);
const powT   = countOf(unlockedSkills, RIG_POWER_IDS);
const rangeT = countOf(unlockedSkills, RIG_RANGE_IDS);
```

Everything below those three lines is arithmetic on `ampT` / `powT` / radius.
Changing where the numbers come from — workout state instead of
`unlockedSkills`, a breathing radius instead of `RIG_RADIUS_BY_TIER[rangeT]` —
is a change at the *bottom* of the funnel, in one pure function that everything
else already routes through. The tree removal is the larger job, and it is a
deletion.

📌 One known drift to fix in the same pass, already logged in §5.H⁶:
`engine/policies/evaluate.js:898` calls `sonicRig()` directly instead of going
through the `rigFor` wrapper, and is the one place that will not follow.

---

## 5. Atrophy — why it is a workout and not a buff

**Decided.** A quiz-won tier is not on a countdown and is not burned by a
battle. It **decays through neglect**: you shed one tier for every
`RIG_ATROPHY_ROUNDS` (suggest **3**) that pass without training at a marquee.

Three reasons this is the right model, in ascending order of importance:

**It reads correctly.** Muscle, not a potion. You trained, you got louder, you
stopped training, you got quieter. Nobody has to be taught this rule.

**It has no bookkeeping cliff.** A charge-zone-style timer means a player
watches a number tick down and plays around an expiry. Atrophy means a player
just... goes back to the gym. There is no moment where a thing vanishes and the
player feels robbed.

🎯 **AND IT IS THE ANSWER TO THE SNOWBALL, WHICH IS THE REAL REASON.** If the
quiz is the only route to a loud rig, the trivia-strong player pulls ahead on an
axis the table cannot contest — nobody can out-play someone else's rock
knowledge. Under atrophy, **staying** loud means repeatedly walking onto a
known, published hex in the middle of the board, round after round. The leader's
rig strength is therefore continuously purchased in **exposure**, and the
counterplay is positional rather than trivia-based: you cannot answer better
than them, but you can be standing on the marquee when they arrive, or in beam
range when they get there. That is a fair fight, and it is the fight the game is
already good at.

### 5.1 ⚠️ The floor, and the loss spiral

§5.H⁶ raises exactly this warning for the breathing radius — *"tune the FLOOR
before the swing… a floor of 0 or 1 builds a game the loser cannot come back
from."* The same warning applies here with a different mechanism: a player who
routes badly, or answers badly, gets quiet, and a quiet Spirit is worse at
contesting the marquee that would make them loud again.

**Proposed floor: atrophy never takes you below today's starting grant.**
`makeInitialNoteState` seeds `unlockedSkills: ["amp_1"]` for every Spirit, so
everyone already begins at 2d6 in range and 1d6 out of it. Keep that
as a free, permanent baseline that the workout layer sits *on top of*. Then the
worst case of total neglect is **exactly where everyone starts the game**, which
is by definition survivable, and the spiral has a hard bottom.

📌 Under §5.H⁶ the Range rungs were going to become "the floor — how far you
carry when silent". With the rig off the tree there are no rungs left to be that
floor, so the radius floor becomes a flat constant and wants deciding at the
same time as this one. Two floors, one conversation.

---

## 6. ⚠️ Bots — `TRIVIA_BOT_ODDS` is promoted to a top-level difficulty dial

Bots cannot "know" trivia, so they resolve on fixed odds:
`TRIVIA_BOT_ODDS = { easy: 0.7, medium: 0.5, hard: 0.35 }`.

Today that constant governs a small side payout in fans. Under this design **it
governs how loud every bot in the game is, for the whole match.** It stops being
flavour and becomes the single largest lever on bot strength. Whoever tunes it
next needs to know that; it should carry a comment saying so.

Bots also need a **choice policy**, which is the one genuinely pleasant surprise
here: expected value falls straight out of the constants already in the file.
`0.7 × easy` against `0.35 × hard` is a real decision with a computable answer,
and a bot that takes the correct one is neither cheating nor stupid.

⚠️ **AND THE BOT WILL NOT USE WHAT IT WINS.** `SEQUENCING.md` §5.F⁶ open item 6:
*"🔊 give `evaluate` a term for being loud — still legal hundreds of times,
chosen 0×."* The bot does not value volume at all right now. Hand it a rig it
earned and it will bank it and swing a Thrash instead. **That open item stops
being a nice-to-have the moment this ships** — it becomes a prerequisite.

📌 Determinism: `pickTrivia` reads pre-drawn floats off `state.lastRandomBatch`
(`[0]` for the pick, `[1]` for the bot odds). A lane-and-difficulty choice for
bots either needs another draw in that batch or a deterministic rule; the
determinism suite will notice either way, which is the system working.

---

## 7. What this costs elsewhere

**The DB hole is real and is being parked deliberately.** Counted from
`data/skillTree.js`, the rig branch totals **110 DB** — amps 6/10/16, Overcharge
12, power 8/12/16, range 6/10/14 — against 52 for the whole Theory route and
32–44 for a spirit-only route. It is the single largest sink in the game by a
wide margin, and removing it leaves DB piling up against a tree that cannot
absorb it.

**Alex's answer (2026-08-20):** the ability tree gets built out, so a character's
abilities grow over the match instead of sitting static — and that absorbs the
DB. ⚠️ **That work does not exist yet and is explicitly later.** Until it does,
expect DB inflation, and do not treat a bench run's DB numbers as a verdict on
anything.

**Docs:** `AMP_DECK_DESIGN.md` per the header warning above. `SEQUENCING.md`
§5.H⁶ wants a pointer to this file so the two halves reference each other.

**Tests:** `legalActionsCheck`, `transitionCheck`, the harness and the
determinism suite all touch rig state. ⚠️ And `CLAUDE.md`'s standing warning
applies with unusual force here: *"a passing test is not evidence a rule is
real"* — §15 was green for months against a skill-purchase mechanic the game
does not have. This change **removes a skill-purchase mechanic the game does
have**, so any test that asserts on `amp_*` / `power_*` / `range_*` unlocks is
about to be testing a fiction. Read the client, not the test.

---

## 8. 🧭 The smallest falsifiable slice

`SEQUENCING.md` §0 names the pathology this doc is at risk of joining: *"design
is running ahead of implementation on three fronts simultaneously… the cure is
not to pick the right front to design harder. It is to ship the smallest
implemented thing that makes one of the docs falsifiable."* This is now a
fourth front. Taking its own medicine, in order:

1. ✅ **DONE, 2026-08-20** — `SEQUENCING.md` §5.I⁶. `EVENT_HEX_COUNT: 1 → 2`,
   the literal `2` in `applyEventHexSpawned` made to read the constant, the
   respawn driver switched from a timer edge to "what is the board short of",
   and the §1.1 separation rule shared between setup and respawn
   (`EVENT_MIN_SEPARATION = 4`). 🐛 The driver turned out to be **carrying a
   live bug** that `EVENT_HEX_COUNT = 1` had made unreachable: two marquees
   consumed in one round lit only one back, permanently and silently.
   ⚠️ The throughput question in §3 is now *measurable* and still **unmeasured**
   — nobody has benched what doubled quiz income does to `FAN_MULT_CAP`.
   ⚠️ **AND THE STAKES ROSE ON 2026-09-02.** The fan weights were rescaled
   (diehard 0.10 → 0.40, casual 0.03 → 0.12, cap 2.0 → 5.0), so quiz-won fans
   are worth roughly four times what they were when this was written. Still
   unbenched, now more urgently.
2. ✅ **DONE, 2026-08-20 (evening)** — the lane × difficulty card, and it pays
   the REAL rewards on both lanes rather than fans on both: the rig rework landed
   in the same pass, so there was nothing to stub. `EventModal` gained a `choice`
   phase (face-down, before the draw) and a `spend` phase.
   🐛 Building it uncovered that the quiz was **client-only** — a headless Spirit
   walked onto a marquee and nothing happened, undeclared in `HARNESS_GAPS`. With
   the rig off the tree that would have frozen every bench Spirit at the floor
   forever. `collectPickups` resolves it now.
3. ✅ **DONE, 2026-08-20 (evening)** — the rig workout, on top of §5.H⁶'s
   breathing radius, which shipped first exactly as this list said it must.
   `rigPool` / `rigPower` on the note sheet, spent at the card, shed by
   `rigAtrophyTick` on the owner's own turns, floored at the old free grant.
   ⚠️ Bots barely train: 0.60 marquee visits per match and 85% of seats finish at
   the floor even after `evaluate` got the two terms it needed. See
   `SEQUENCING.md` §5.D⁷ before quoting any bench number.
4. ✅ **DONE, 2026-08-20 (late)** — the tree deletion. The whole `electric`
   route is gone: `amp_1..3`, `power_1..3`, `range_1..3` and `overcharge`, plus
   every reader (bot skill orders, `STARTING_SKILLS`, the `amp_1` seed, the Rock
   God scoring, the client's unlock logs and Overcharge modal, and two duplicate
   copies of the pool table that had drifted). `SEQUENCING.md` §5.G⁷ has the full
   account. ⚡ Overcharge was CUT rather than rehoused, and the dead
   `ULTIMATE_PREREQS` / `pa` gates went with it — both Alex's call.

Steps 1 and 2 are independent of the whole rig question and can ship this week.

---

## 9. Open questions

- Exact separation distance (§1.1), and whether the second marquee pays less
  than the first (§3).
- `RIG_ATROPHY_ROUNDS = 3` is a guess. Wants a bench.
- The radius floor under §5.H⁶ now that the Range rungs are gone (§5.1).
- Whether a RIG-lane tier can be spent *later* or must be spent at the card. At
  the card is simpler and keeps the modal self-contained; spending later is a
  better decision but needs UI that does not exist.
- 📌 Does the CROWD lane want a rig-adjacent consolation, or is the fan/rig
  split clean enough to leave alone? Leaving it alone, for now.
