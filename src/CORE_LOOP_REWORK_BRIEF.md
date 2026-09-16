# 🎯 CORE LOOP REWORK — the one-pass build brief

> **Written 2026-09-15** from a design conversation with Alex. ⭐ **This is the
> brief a new session reads to build the core loop rework.** It carries the
> rulings, the measured numbers, the file-by-file bill, the build order and the
> traps.
>
> 🧭 **Read `STATE_OF_PLAY.md` first** (it is still the entry point), then this,
> then `PROJECTILE_COMBAT_DESIGN.md` §3.6. Nothing else is required reading.
>
> ⚠️ **READ §2 BEFORE YOU WRITE A LINE.** This brief separates what **Alex
> ruled** from what **a previous session recommended**. They are not the same
> thing and the difference is load-bearing. Anything in §2 is still a question.

---

## 0. 🎓 THE ONE IDEA THAT ORDERS THE WHOLE JOB

Four changes that look independent are **one lever pulled in sequence**, and
doing them out of order makes each one look like it is breaking something:

```
  rounds-limited play          →  the per-turn Fame cap has no job
        │                             │
        ▼                             ▼
  FAME_PER_TURN_CAP removed    →  a heavy crowd multiplier becomes SAFE
        │                             │
        ▼                             ▼
  casuals go back to Fame      →  the Sonic die ladder has nothing left to pay for
        │                             │
        ▼                             ▼
  sonicDieSides DELETED        →  die size stops being a runaway axis
```

🎯 **Do them in that order and each step is obviously correct. Do them in any
other order and you are deleting a mechanic with nothing to replace it.**

📌 **The evidence this is one lever, not four:** `gameConstants.js` currently has
`FAN_CASUAL_WEIGHT = 0` with the comment *"casuals now grow permanent Sonic die
size"*, sitting directly under a 2026-09-02 comment block — **Alex's own call,
recorded as "fans should actually mean something"** — that worked out the correct
weights (Diehard 0.40, Casual 0.12, cap 5.0) and ends with the warning
*"⚠️ THIS PUSHES HARD ON `FAME_PER_TURN_CAP`, WHICH IS THE POINT OF FRICTION."*
The casual weight was zeroed to fund the die ladder. **Removing the cap removes
the friction that made zeroing it seem necessary.**

---

## 1. ⭐ THE RULINGS — Alex, 2026-09-15 unless dated otherwise

These are **decided**. Build them. Do not re-litigate them in the session.

### 1.1 Scoring and match shape

| # | ruling |
|---|---|
| R1 | ⭐ **The match is ROUND-LIMITED, not a Fame race.** Fame is a score at the buzzer, not a finish line. |
| R2 | ⭐ **All per-turn Fame caps are GONE.** *"I don't want to hear any more of FP caps."* |
| R3 | ⭐ **Fame totals in the hundreds are correct and wanted** — *"far more satisfying than the low numbers we were dealing with."* |
| R4 | ⭐ **Fans determine Fame payout, and their multipliers must carry real weight** — *"not just fractions of a percent per fan."* |

### 1.2 Dice sources

| # | ruling |
|---|---|
| R5 | ⭐ **The fan-driven die ladder (`sonicDieSides`) is CUT.** Reason given: *"a potential runaway problem with a player who has stronger dice, even if just for a round or two before the other players catch up."* |
| R6 | ⭐ **Dice count still comes from the CHORD** (unchanged from `PROJECTILE_COMBAT_DESIGN.md` §2). |
| R7 | ⭐ **NEW — the marquee pays a temporary CARD.** Equipment questions grant one better die for an attack: **3 choices → d8 · 4 choices → d10 · 5 choices → d12.** Temporary, **1 turn** (2 was floated and is ⁉️ open). |
| R8 | ⭐ **Charge zones raise the FLOOR, never the roof.** 1 zone → lowest face is **2**. 2 zones → lowest face is **3**. **Capped at 2 zones.** The die-growing ceiling is cut. |

### 1.3 The Sonic barrage *(ruled 2026-09-15, earlier in the same conversation)*

| # | ruling |
|---|---|
| R9 | ⭐ **Sustain rolls dice; they sum into shield HP.** Each Drive face is a projectile spending its strength against HP; excess spills through. Exact break spends the whole projectile and pushes nobody. Full spec: `PROJECTILE_COMBAT_DESIGN.md` §3.6.0. |
| R10 | ⭐ **Sonic damage = `floor(strength_through / 3)`.** Swing = `margin / 2`. **Vibe pools rise to ~15.** |
| R11 | ⭐ **A break knocks ONE note off the tail of the Sustain stack.** ⚠️ This reverses §3 and §3.5 — see §3.6.2. |
| R12 | ⭐ **Repeat attacks on one target in a round give diminishing FP** — *"enough that the 4th player may be discouraged from milking the player with low Sustain."* |

### 1.4 The three verbs

⭐ **Sonic: project force · Riff Off: contest musical dominance · Swing: commit
to physical dominance.**

| # | ruling |
|---|---|
| R13 | ⭐ **THE SWING'S HOME:** *"Swing converts contact into damage, at the cost of committing yourself to the brawl."* It must **not** compete with the Sonic on range or Fame. |
| R14 | ⭐ **Sonic** — damage LOW, push HIGH, Fame HIGH. Cost 1 AP + 1 Drive note, hit or miss. Failure is **a spent shot** — nothing happens. |
| R15 | ⭐ **Swing** — damage HIGH, push LOW, finishing and shield-cracking. Cost 1 AP + 2 Drive notes, hit or miss. Failure is **self-damage, displacement, and Fame to the defender.** |
| R16 | ⭐ **DO NOT ADD MORE SWING PUNISHMENT.** *"The risk should be readable as 'I may lose the exchange and get shoved out,' not 'one failed Swing destroys my character.'"* ⚠️ See §2.6 — this ruling is in tension with R10 and needs a number, not a new rule. |

### 1.5 The Riff Off

| # | ruling |
|---|---|
| R17 | ⭐ **THE RIFF OFF IS NOT CHOSEN — IT IS TRIGGERED.** If two Spirits are **facing each other** and **in Sonic range**, the Sonic attack **becomes** a Riff Off. Neither player picks it from a menu. |
| R18 | ⭐ **It is not a chord-based attack. 1 AP, and NO Drive note is spent.** |
| R19 | ⭐ **No committed melody? It runs off the LAST committed melody.** There is always one, so a duel is never empty. |
| R20 | ⭐ **Turning still costs something.** 📌 It already does — `actions.js:141`, `spiritFaced(spiritId, facing, cost = 1)`. |
| R21 | ⭐ **The picture:** waveforms collide in the middle, and the collision point is **pushed and pulled toward the weaker player** after each round of riffing — a kamehameha struggle. ⚠️ **No overlay. All of it in the 3D arena**, like the barrage. |

### 1.6 Scope

| # | ruling |
|---|---|
| R22 | ⭐ **SPECIAL ABILITIES ARE PARKED.** *"The core loop needs to be strong and solid before we worry about the abilities that are meant to break it."* ⚠️ Do not touch the Ronin's kit, the Metalness rework, the roster decision or the siphon in this pass. |

---

## 2. ⁉️ STILL OPEN — decide these, do not assume them

> 🚨 **EVERYTHING IN THIS SECTION IS A PREVIOUS SESSION'S RECOMMENDATION, NOT
> ALEX'S DECISION.** Each one has the reasoning and the measured numbers so the
> decision is cheap to make — but it has not been made. **Ask, or flag it in the
> report. Do not let a recommendation ship as a ruling.**

### 2.1 🚨 What produces the Sustain pool — DECIDE FIRST, EVERYTHING CALIBRATES OFF IT

There is **no `sustainRig()` anywhere**. `attackParams` produces a scalar
`defStat` and `combat.js` passes `defDie: 0` — the defender draws no RNG today.

⚠️ **This is the most sensitive number in the whole rework.** 200,000 seeded
barrages per row, Drive fixed at 5d6:

| Sustain pool | avg through | avg Vibe @1:3 | Sonics to down 15 Vibe |
|---|---|---|---|
| 2d6 | 10.49 | 3.17 | **4.7** |
| 3d6 | 7.15 | 2.08 | **7.2** |
| 4d6 | 4.25 | 1.17 | **12.8** |
| 5d6 | 2.14 | 0.55 | **27.2** |
| 6d6 | 0.93 | 0.22 | **66.9** |

🎯 **One die of defence outweighs the entire damage divisor.** Moving the pool by
1 changes time-to-down ~60%; moving the divisor 3→2 changes it 33%.

💡 **Recommendation (NOT ruled): the Sustain pool sits about two dice below the
Drive pool** — the *gap* sets the pacing, so it holds as both sides grow:
4v2 → 7.4 · 5v3 → 7.2 · 6v4 → 7.1 Sonics to a knockdown.

📌 **R5 simplifies this question.** With the fan ladder gone, both sides roll
**d6 baseline** and the only question left is *how many*. Chord sustain value is
the obvious mirror of R6 — but whether that lands on Drive−2 in practice has not
been checked against `music/chords.js` rebased values.

### 2.2 🚨 What triggers the note-break — "emptied" is too generous

R11 says a break costs a note. ⚠️ **At the proposed pools the shield empties
92–96% of the time** — a note off almost every attack, in a 4-player game,
against a stack floored at one survivor. That is §3.2's cascade at a slower tick.

| trigger | 4d6 v 2d6 | 5d6 v 3d6 | 6d6 v 4d6 | 5d6 v 5d6 |
|---|---|---|---|---|
| emptied (`hp === 0`) | 96% | 94% | 92% | 53% |
| emptied with spillover | 94% | 91% | 88% | 46% |
| 💡 **overwhelmed** (`through ≥ original HP`) | **53%** | **34%** | **21%** | **2%** |

💡 **Recommendation (NOT ruled): break the note only when the barrage carries
through at least as much strength as the shield started with.** 🎯 It is the only
row whose rate *falls* as the defender invests — 34% against a thin brace, **2%
against a full one**, which is what makes spending notes on Sustain worth doing.

### 2.3 ⁉️ The marquee card — the difficulty ladder is upside-down as specified

For a player who is guessing, `EV = P(correct) × reward`:

| question | odds | die | ΔVibe (upgrade one d6) | EV to a guesser |
|---|---|---|---|---|
| Easy (3 choices) | 1/3 | d8 | +0.32 | 0.107 |
| Normal (4) | 1/4 | d10 | +0.63 | 0.158 |
| **Hard (5)** | 1/5 | d12 | +0.97 | **0.194** |

⚠️ **The reward ladder climbs faster than the odds ladder falls, so nobody should
ever pick the easy question** — a guesser takes the hard one, and someone who
knows the answer takes it too. For easy to compete, the d12 would have to be
worth ~0.53 Vibe, i.e. about a d9. **The difficulty selector is currently not a
decision.**

💡 **Recommendation (NOT ruled): a wrong answer on a harder question costs
something** — the marquee for the round, or the card passes to a rival. That
gives the quiz its own commitment gradient, matching the Sonic/Swing risk axis.

⁉️ **And: does the card ADD a die or UPGRADE one?** It roughly doubles the value:

| | ΔVibe |
|---|---|
| upgrade d6 → d12 | +0.97 |
| **add** a d12 | **+2.10** |

💡 **Recommendation (NOT ruled): UPGRADE.** An added die is also an added
*projectile*, and projectile count drives knockback — so adding quietly grants
board control, which is not what a trivia reward should buy.

⁉️ **1 turn or 2?** R7 floats 2. At +0.97 Vibe on a 2.08 baseline a d12 is nearly
a 50% damage bump; two turns of that is a long time in a ten-round match.

### 2.4 ✅ **RULED *AND BUILT* 2026-09-15 — THE FAME RACE SURVIVES. Default flipped, mode kept.**

> ⭐ **Alex's call: rounds becomes the default, the race stays selectable.** The
> large simplification below is **declined on purpose**, so `FAME_TO_WIN`,
> `fpPerLife`, `FAME_RACE_CONTESTED_LEAD` and `underdogBonus` all stay.
>
> ⚠️ **THIS IS NOT A FREE ANSWER, AND PHASE 1 MUST CARRY THE COST.** Keeping the
> race means every piece of race machinery has to keep working once Fame runs in
> the **hundreds** (R3) — and **trap 8 already says `fpPerLife` becomes noise at
> that scale.** 🎯 So "keep the race" converts trap 8 from *an acceptable
> consequence* into **a job**: the race's numbers need re-deriving against
> hundreds-scale Fame, not merely leaving alone. 📌 Deleting them would have made
> the problem vanish; keeping them means someone has to answer it.

R1 makes rounds the mode. If the race is cut, `FAME_TO_WIN`, `fpPerLife`,
`FAME_RACE_CONTESTED_LEAD` and `underdogBonus` are all race-only machinery and a
large simplification is available. **Today the race is the DEFAULT and rounds is
the option** (`WIN_CONDITIONS_DESIGN.md` §4: Battle of the Bands is `off` by
default). At minimum that flips; whether the race is deleted is not decided.

### 2.5 ⁉️ Does the Swing hit the rolled shield?

Unresolved consequence of R9. 💡 **Recommendation: yes — one shield, two ways at
it.** The Sonic spends its dice one at a time; the Swing throws the whole sum.
⚠️ It replaces the defender's `THRASH_DIE` d4 with their Sustain pool, which is a
real buff to defence and must be said out loud rather than discovered.

### 2.6 🚨 The Swing divisor, and the R16 tension

R10 sets the Swing at `margin / 2`. At 5d6 vs 3d6 that is a 91% hit rate and
**3.34 average Vibe — about 4.5 Swings to a knockdown** against the Sonic's 7.2.

⚠️ **And R16 says do not add punishment — but the Vibe re-base already REMOVED
punishment without anyone choosing to.** Every Swing failure consequence was
sized against a Vibe pool of 4–5:

| on a Swing miss | value | of a 4–5 pool | of a 15 pool |
|---|---|---|---|
| self-damage (`THRASH_WHIFF_DMG`) | **1, flat** — ignores margin | 20–25% | **6.7%** |
| displacement (`thrashKnockback`) | 0 or 1 hex | — | unchanged |
| defender Fame (`thrashFame`) | 1 FP | — | unchanged |

🎯 **R16 is satisfied by RE-SCALING what exists, not by adding anything.** Whiff
damage around **3 of 15** holds the proportion it had. 💡 And `THRASH_WHIFF_DMG`
is flat — the harder you wind up, the same slap. If the fiction is *"the
instrument resonates off the shield at full force,"* it wants to scale with the
wind-up. **That is the one place more punishment is arguably correct, and it is
Alex's call, not the session's.**

### 2.7 ⁉️ The Riff Off has no resource cost

R18 gives it 1 AP and no notes; R19 makes the melody reusable. So once two
Spirits are squared up, **every subsequent round is a duel that costs neither of
them anything to fire.** Two readings, both honest: either symmetric risk *is*
the price (consistent with the three-tier risk axis), or two Spirits lock
face-to-face duelling forever with nothing draining.

💡 **Recommendation (NOT ruled): a committed melody is good for ONE duel**, then
you must commit a fresh line. Makes melody commitment the ammunition, using a
system that already exists.

⁉️ **And when does facing change?** If it is reactive, the defender picks the
combat mode for free. 💡 **Recommendation: facing is set on your own turn only**,
so it reads as a stance you commit to — which rhymes with the Swing.

### 2.8 ⁉️ Deferred by R22, recorded so it is not lost

Alex proposed the Swing hitting **multiple targets** and **sweeping through
charges or notes** in its field of view. ⚠️ **Flagged against `bushido.js`:** the
base Swing is 1 AP, Psycho Bushido is 3 AP with *"any body in the lane stops
it"* — give the ordinary Swing a cone that passes through bodies and the
signature move becomes strictly worse for triple the cost. 📌 **R22 parks this**:
Bushido gets rebuilt against whatever the loop becomes, so the verb leads and the
ability follows. Captured in `IDEAS_INBOX.md`, not built here.

Also from Alex, explicitly *"later"*: the **cornered payoff** — a small crush
bonus when the target cannot retreat. 🎯 Worth noting it makes the verbs *chain*:
the Sonic's push is what creates the corner the Swing crushes in, and in
four-player the player who pins is not the player who crushes.

---

## 3. 🏗️ BUILD ORDER — six phases, each independently verifiable

⚠️ **The order is §0's lever. Do not reorder it.**

### Phase 0 — 🎨 the Face button ✅ **DONE 2026-09-15**

> ✅ **SHIPPED.** The inline `style` prop is gone from the site below, so Face
> wears `.btn` and `.btn.on` exactly like Move, Sonic and Swing — **Alex's call,
> "match the other buttons."**
>
> 🚨 **THE CONTRAST TABLE BELOW UNDERSTATES THE DEFECT, AND THAT IS WORTH
> KEEPING.** `.arail .btn` in `ui/GameStyles.jsx` builds its entire neon
> treatment out of **`currentColor`** — the wash gradient, the `9px` bloom and
> the `inset 2px 0 0 currentColor` left spine. So `color:#1a5066` did not merely
> grey the label: **it put the lamp out.** That is why it read as dead rather
> than as quiet, and why a pure contrast reading would have under-sold the fix.
>
> ⚠️ **ONE THING WAS SURRENDERED ON PURPOSE:** dropping the whole prop also drops
> the cyan `#44ccff` armed state, which falls back to `.btn.on`'s `#88bbff` —
> Face-armed now looks like Move-armed. 📌 If the cyan is wanted back it is one
> prop: keep only the `action === "face"` branch and let idle fall through. The
> comment at the site says so.
>
> ✅ Verified: `esbuild` parse of the whole monolith, **exit 0, zero warnings**.
> ⛔ `npm run check:bundle` and `test:render` **have not run** — no shell.

🐛 **A real defect, not a taste call.** `rlsw-simulator-v3_8_1.jsx:12785` hardcodes
the idle Face button to `color:#1a5066`, `borderColor:#0a3044`:

| button | contrast on `#0a1020` |
|---|---|
| Move / Sonic / Swing (`.btn` default `#c0d0e0`) | **12.04 : 1** |
| End (`#ffaa22`) | 9.95 : 1 |
| Face **active** (`#44ccff`) | 10.22 : 1 |
| **Face idle (`#1a5066`)** | **2.15 : 1** |
| Face idle border | 1.37 : 1 |

The rail is 10px — normal text, so WCAG wants 4.5:1. ⚠️ **And `.btn:disabled` is
`opacity:.3`, which lands in the same visual place — so the button is styled like
"disabled" while being the one state it never renders in.** Face only renders
when `moveStepsLeft > 0`, i.e. **it looks unavailable exactly when it is
available.** Alex reported it as *"it doesn't look selectable."*

**Fix:** drop the idle overrides, keep cyan for active. `#7fb2c8` (~6.6:1) reads
as a secondary action while still being alive. 📌 Alex has not picked the shade.

### Phase 1 — 🏆 the scoring re-base *(R1–R4)* — ✅ **ENGINE DONE 2026-09-15, HUD NOT**

> ✅ **SHIPPED:** the default flipped to rounds (`state.js`, one normalising
> ternary), the fan weights restored (`FAN_CASUAL_WEIGHT` 0 → **0.12**,
> `FAN_MULT_CAP` 3.0 → **5.0**), and the pose ceiling taught to ride the mode.
> `test:winconditions` **87** · `test:turnflow` **73** · `test:determinism` **20**
> · `test:battleflow` **65** · `test:sonic` **75**.
>
> 🚨 **ITEM 2 WAS WRONG AS WRITTEN, AND THE CORRECTION MATTERS.** It said
> *"Remove `FAME_PER_TURN_CAP`"* and warned that `POSE_FP_MAX` and
> `RIFF_FP_TURN_CAP` would go silently uncapped with it. What the code actually
> holds is the opposite shape:
>
> - `FAME_PER_TURN_CAP` **must NOT be removed** — §2.4 is ruled and the race
>   survives, and in a race the cap is the catch-up brake. It was already
>   mode-gated through `battleFlow.famePerTurnCap`, so flipping the default was
>   enough to retire it from the default game.
> - `RIFF_FP_TURN_CAP` **was already mode-aware** via `grantFame`'s `capScale`
>   (`Infinity × 2` is still Infinity). Nothing to do.
> - `POSE_FP_MAX` **was the only one actually broken** — a raw import in
>   `limelight.js`, pinned at 4 while everything around it ran uncapped.
>
> 🎯 **So trap 3 below is half right and half backwards.** One of the two caps it
> warned about looks after itself; the other was already silently wrong before
> anyone touched it.
>
> ⛔ **NOT DONE — the HUD half.** No rounds-remaining readout, no lobby toggle.
> ⚠️ **The match is now round-limited with nothing on screen saying so**, and
> `ui/FameRace.jsx` still draws a finish line at `fameToWin`, which is Infinity
> in the default mode. That is `FAME_TRACK_REDESIGN.md`'s job.


✅ **Most of this is already built and switched off.** `WIN_CONDITIONS_DESIGN.md`
§9 item 1 is **CLOSED**: `config.winCondition: 'fame' | 'rounds'`,
`ROUND_LIMIT_DEFAULT = 10`, `FAME_PER_TURN_CAP_ROUNDS = Infinity`, headless build
done, `test:winconditions` green. **What is missing is the lobby toggle, the HUD
readout, and the default.**

1. Flip rounds to the default (§2.4 decides whether the race survives at all).
2. Remove `FAME_PER_TURN_CAP`. ⚠️ **It does not travel alone** — `POSE_FP_MAX = 4`
   is commented *"Matches `FAME_PER_TURN_CAP` — deliberate"* and
   `RIFF_FP_TURN_CAP = FAME_PER_TURN_CAP * 2`. **Both need re-deriving, not
   deleting**, or posing and duels go silently uncapped.
3. Restore the fan weights the 2026-09-02 comment block already specifies:
   `FAN_CASUAL_WEIGHT` 0 → **0.12**, `FAN_MULT_CAP` 3.0 → **5.0**.
4. Rounds-remaining HUD. 📌 `WIN_CONDITIONS_DESIGN.md` §5 notes the
   `🔥💿 DISCO INFERNO — N rounds left` chip already sits beside the track in the
   same pill shape, and warns a second chip there would read as temporary.

📊 **Expected:** winner Fame 64.8 at ten rounds (already simulated in
`WIN_CONDITIONS_DESIGN.md`), rising past 100 once the casual weight is restored.

### Phase 2 — 🎲 the dice sources *(R5, R7, R8)* — ✅ **ITEM 1 DONE, 2 AND 3 OPEN**

> ✅ **ITEM 1 SHIPPED.** `sonicDieSides` is deleted from `sonicRig.js` and
> `peakCasuals` is gone from all **seven** sites (the brief said six — the
> seventh was the high-water merge in `applyNoteStatesSynced`, which existed so
> a client sync could not lower a ratcheted die size). Both sides now roll a
> **d6 baseline** and only the count varies. `test:sonic` **75** green.
>
> 🎯 **IT SHIPPED WITH PHASE 1's FAN WEIGHTS ON PURPOSE** — §0's lever. Deleting
> the ladder alone leaves casuals doing literally nothing; restoring the weight
> alone has them paid **twice**. The pass that does one must do the other.
>
> ⛔ **ITEM 2 NOT DONE, AND IT LEAVES R8 UNSATISFIED.** `sonicRig.js` still reads
> `SONIC_BASE_DIE + (chargeCeilTurns > 0 ? 2 : 0)`, so a charge zone still raises
> the **roof** — the exact thing R8 says it must never do. The floor mechanism
> (`atkFloor`) already exists and is untouched. Flagged loudly at the site.
> ⛔ **ITEM 3 (the marquee card) NOT STARTED** — §2.3 is still unsettled.


1. **Delete `sonicDieSides`** from `sonicRig.js`. 🎯 **And `peakCasuals` goes with
   it** — that field exists only to make the ladder permanent and irreversible,
   and is threaded through **six sites** in `economy.js` (337, 364, 399, 429, 450,
   470) plus `FAN_FLEE_MIN/MAX`'s *"earned die size survives"* comment.
2. **Charge floors.** ✅ The mechanism already exists: `attackParams` computes
   `atkFloor` and `combat.js` does `Math.max(rng.int(sides)+1, 1 + atkFloor)`.
   "Lowest face 2" is `atkFloor: 1`; "lowest face 3" is `atkFloor: 2`. **The work
   is removing the ceiling** (`chargeCeilTurns` in `sonicRig` and `attackParams`)
   and making the floor scale with zone count, capped at 2.
3. **The marquee card** — new. Settle §2.3 first.

📊 **Measured, 5d6 vs 3d6:**

| charge | ΔVibe | share of attacks where NOTHING gets through |
|---|---|---|
| none | — | **9.1%** |
| 1 zone (floor 2) | +0.23 | 4.9% |
| 2 zones (floor 3) | +0.75 | **0.7%** |

🎯 **The floor barely raises damage — it near-eliminates the total whiff.** A
charge zone stops meaning *"I hit harder"* and starts meaning *"something is
getting through,"* which is legible without arithmetic. ⚠️ **At 2 zones the
defender's clean hold happens 0.7% of the time — possibly too absolute.** Flag it.

### Phase 3 — 🔊 the barrage *(R9–R12)*

Port `barrageModel.mjs`'s `resolveBarrage` into `combat.js`. Full re-plumb bill
at `PROJECTILE_COMBAT_DESIGN.md` §3.6.4. Headline items:

- `rollSonicVolley` → `resolveBarrage`. ⚠️ **Two rng draws now happen where one
  did — replay cursors move.** `determinismCheck` will see it.
- `attackParams` must emit a **`sustainPool`** (§2.1 decides what fills it).
- `sonicDamage` → `floor(through / 3)`; **knockback rides `pushes`, a COUNT**, so
  §3.1's one-hex-per-projectile reuse survives.
- `battleFlow.js` — the shove becomes **one combined push after the barrage
  lands**, not one hex per contact stepped mid-flight.
- ⁉️ **`applyAttackRerolled` is ambiguous.** Its own comment says Code Injection
  *"rewrites the RIVAL'S roll, never your own defence"* — written when the
  defender had no roll. **Does it re-roll the shield? Rule on it.**
- **Vibe re-base to 15** across `SPIRIT_DEFS`, `fpPerLife`, knockdown thresholds
  and every Vibe term in `policies/evaluate.js`.

#### 3a. ✅ The diminishing-FP counter — **THE RESET IS BUILT, 2026-09-15**

> ✅ **HALF OF THIS IS NOW FIXED.** `applyTurnEnded` clears
> `pendingSonicAttacks` at **the defender's OWN turn end**, beside the slime
> decay and for the same documented reason — `turn.js`'s own ⚠️ about a lifetime
> quoted in "turns" silently meaning *spirit*-turns. 🎯 **That boundary serves
> BOTH rules at once, and it is not a coincidence:** "attacks I took since I
> last acted" is exactly one lap of rivals at any player count, so it is
> §3.5.1's bill (still standing at turn start, so it can be charged) *and* R12's
> per-round window — **including Alex's actual worry, three different attackers
> milking one low-Sustain player, which a per-attacker counter would have
> missed.**
>
> 📌 **It writes only when there is something to clear**, so a turn that ate no
> Sonic leaves `noteStates` object-identical and replay cursors do not move.
> ⚠️ **`TURN_SKIPPED` deliberately does NOT clear** — a skipped turn runs no
> end-of-turn ticks, the ooze does not decay there either, and a Spirit on the
> floor has not answered for the barrage that put him there.
>
> ⛔ **STILL NOT BUILT: anything that READS it.** §3.5.1's shield bill and R12's
> diminishing FP are both still unwritten. The counter is now **correct and
> unread** rather than **wrong and unread** — which is the whole of the fix.
>
> ✅ `.scratch/sonicTallyCheck.mjs`, **20 assertions, 0 failures**, and
> **mutation-tested**: removing the clear fails it 2/20. ⚠️ It is a one-off probe
> in `.scratch/`, **not a suite** — `CLAUDE.md`'s own split. 🎯 **Its assertions
> should be folded into `test:barrage` when Phase 3 writes that suite**, beside
> R12, which is the consumer they belong to.

#### 3a (original) — the counter as found: DEAD

⭐ `pendingSonicAttacks` is exactly R12's counter. **It is incremented at
`combat.js:276` and a repo-wide grep finds exactly ONE site — the increment.
Nothing reads it and nothing resets it.**

🚨 **Two consequences, both worth reporting to Alex:**

1. ⛔ **§3.5.1's turn-start shield bill is a DOC-ONLY RULE.** The upkeep cost that
   §3.5.5 calls *"defence stops being free"* **does not exist in the game.** Every
   argument in §3.5.5 is currently unpaid-for.
2. 🐛 **It never resets, so it is a lifetime tally wearing a per-round name.**
   Anything that starts reading it is wrong on first use.

📌 **Fix the reset in the same pass as R12** — they are one counter. 🎓 This is
`SEQUENCING.md` §B's "a suite nobody runs" lesson in a different costume.

### Phase 4 — 🗡️ the Swing *(R13–R16)*

Rewrite `PROJECTILE_COMBAT_DESIGN.md` §4 around R13. ⚠️ **§4 today is a pile of
historical rationale under a "deferred design discussion" banner and does not say
what the Swing IS.** Then:

- Re-scale `THRASH_WHIFF_DMG` (§2.6).
- Settle the divisor (§2.6) and whether the Swing hits the rolled shield (§2.5).
- ⚠️ **§4's wording must change anyway.** *"Count them, or add them up"* is no
  longer literally the branch, because the barrage sums too. The replacement:
  **the Sonic spends its dice one at a time; the Swing spends them all at once.**
  Many small, or one big. 📌 See §3.6.3.

### Phase 5 — 🎤 the Riff Off trigger *(R17–R21)*

⚠️ **This is a genuine structural change: facing becomes the MODE SWITCH.** Square
up and your Sonic is a duel; attack from an angle and it is a barrage. To fire a
plain Sonic at someone facing you, you must move — **combat choice relocates into
the movement pillar.**

🎯 **It also CLOSES a hole.** The rolled shield and the duel both answered *"the
defender should get to do something"* and overlapped. Under R17 they do not: face
them and you answer with melody, turn away and you answer with your Sustain roll.
**One choice, made in advance, about which kind of fight you are in.**

Touches `legalActions.js`, `attackParams.js`, `riffOff.js`, and the facing read in
`combat.js:438`. R19 may make `generateDefenderRiff` unnecessary — check before
deleting.

### Phase 6 — 🎬 presentation

- The barrage scene onto the real hex arena. 📌 **The expensive half already
  landed** — `arenaDiceSequence.js` and `combatDice.js` are in `src/board/` and
  the ring beam is ported. What is left: per-projectile strength through the
  existing beam code, a shield object with HP/crack/shatter, the six camera beats
  through `sonicCamera.js`, and the push-in that `RING_BEAM_BRIEF.md` §4 flagged
  as having **no home in `stageSonicCamera`**.
- R21's waveform collision for the duel.
- The rounds-remaining readout (Phase 1).

---

## 4. 🚨 THE TRAPS — things that look wrong but are not, and things that look fine but are not

1. ⚠️ **`STATE_OF_PLAY.md` §7 item 2 says the ring beam is unported and nothing is
   in `src/`. THAT IS STALE.** `sonicZigzagVisuals.js` (72KB), `sonicRingCheck.mjs`,
   `arenaDiceSequence.js` and `combatDice.js` are all in `src/`. The project
   handoff `claude/sonic-volley-rework-handoff.md` is stale the same way.
2. ⚠️ **`SEQUENCING.md` §A has RESTACKED.** `CLAUDE.md` says §A is one handoff;
   it currently holds **nine** (17-riffoff back to 8-arena-fidelity). The
   archive-and-index ritual has not been run since 2026-09-04. 📌 Left alone
   deliberately in this pass — **archiving is destructive and §B says read it
   first** — but it should be done.
3. ⚠️ ~~**Removing `FAME_PER_TURN_CAP` silently changes two other caps** that are
   defined in terms of it.~~ 🚨 **HALF WRONG, CORRECTED 2026-09-15 — and the
   correction is more useful than the trap was.** `RIFF_FP_TURN_CAP` already
   follows the mode through `grantFame`'s `capScale` and needed nothing.
   `POSE_FP_MAX` did not follow it and **was already silently wrong** before
   anyone touched the cap — pinned at 4 in a mode where every other Fame source
   ran uncapped. And `FAME_PER_TURN_CAP` itself must **stay**, because §2.4 kept
   the race and the cap is that mode's catch-up brake. 🎓 **The general lesson:
   a constant whose comment says it "matches" another does not follow it — it
   copied it once, and the copy rots the day the original learns a new case.**
4. ⚠️ **Deleting `sonicDieSides` without restoring the fan weights leaves fans
   doing NOTHING.** That is why §0's order matters.
5. ⚠️ **`PROJECTILE_COMBAT_DESIGN.md` §2's three-input table loses its middle
   row** when R5 lands — *"how good each die is ← your crowd"* stops being true.
   💡 **Recommendation (NOT ruled): give that row to Db.** Dice count from the
   chord, die size from what you banked, fans entirely on the payday —
   *musicianship makes the shot, the crowd makes the money.*
6. ⚠️ **A Sonic break (R11) and a Swing fray now both crack Sustain.** §4.1's
   *"A SONIC CANNOT REACH A HELD CHORD. A SWING CAN"* is reversed. Degree, not
   kind — but **§4.1's own argument** (that Sonic chipping makes the Swing *"a
   faster way to do what everybody is already doing at range"*) applies at reduced
   force and should be answered in the §4 rewrite, not skipped.
7. ⚠️ **In a round-limited match nothing "ends" the game**, so §4 item 1's *"the
   Swing is how a match ENDS"* is false of every move. 🎯 **The Swing is how you
   take a scoring turn away from someone about to out-earn you** — which fits R13
   better, and makes the timing matter: a knockdown on round 9 is worth far more
   than the same knockdown on round 2.
8. ⚠️ **`fpPerLife` at hundreds-scale is noise.** Losing 8 Fame off a 100+ score
   is nothing. Either re-scale it or accept that a knockdown costs **turns**, not
   Fame — which is trap 7's point from the other side.

---

## 5. 🔬 EVIDENCE PLAN

⚠️ **`npm run test:all` cannot be run from a Cowork session right now** — a
Windows update released 2026-09-08 stops the workspace mounting the repo, so the
shell on Alex's machine is unavailable. **Claude Code is unaffected.** Run the
suites there, or ask Alex to paste the counts.

| what | how |
|---|---|
| model conservation | 200k seeded barrages: `absorbed + through === driveTotal`, zero failures. ✅ Verified 2026-09-15 against `barrageModel.mjs` directly. |
| the worked example | Drive `6,5,4,6,3` vs Sustain `5,4,3` → hp 12→6→1→0, per-shot through `0,0,3,6,3`, total **12**, pushes **3**, breakIndex **2**. ✅ Reproduces. |
| new suite | `test:barrage` — resolution, spillover, exact break, the break trigger (§2.2), the combined shove, determinism across the two-draw change. ⚠️ **`CLAUDE.md`: a suite no script runs is not a suite. Wire it into `test:all` in the same pass.** |
| existing, must stay green | `test:winconditions`, `test:sonic`, `test:sonicfx`, `test:determinism`, `test:engine`, `test:eval`, `test:battleflow` |
| bundle | `npm run check:bundle` — ⚠️ **must end with ZERO warnings**, the count is the check |
| bot | `npm run bench:bot` — ⚠️ **every Vibe term re-bases against 15, so every bench number moves.** Re-run rather than comparing to old figures. |

---

## 6. ⛔ OUT OF SCOPE — do not touch in this pass

- 🪦 **Every special ability** (R22): the Ronin's kit, the Shamisen siphon, the
  Metalness rework, universal cooldowns, the Glamarchy/Riff Rat roster decision.
  📌 **`STATE_OF_PLAY.md` §6 names the roster as blocking every balance sheet —
  under R22 it blocks nothing**, which is a welcome side effect.
- 🪦 Multi-target Swing and note-sweeping (§2.8) — in `IDEAS_INBOX.md`.
- 🪦 The cornered payoff — Alex said *"later"*.
- 🪦 §14's riff-off wager and §14.7's tempo blocker — Phase 5 changes **how a duel
  starts**, not what is at stake in it.
- 🧊 **Balance.** `CLAUDE.md`'s freeze still applies. Record an imbalance and move
  on. ⚠️ **The exception that DOES apply here:** anything that makes a thing
  *impossible* rather than weak. The dead `pendingSonicAttacks` counter (§3a) is
  exactly that — a rule that can never fire.

---

## 7. 📊 APPENDIX — the measured numbers

All figures from 200,000–300,000 seeded trials, generated 2026-09-15 and
cross-checked against `.scratch/sonic-rework/barrageModel.mjs`'s `resolveBarrage`
over 200k random barrages with **zero mismatches**.

**Barrage baseline (5d6 vs 3d6):** through **7.15** · Vibe @1:3 **2.08** ·
pushes **2.27** · break rate **94%** · nothing-through **9.1%**

**Pacing holds on the GAP, not the size** *(Sonics to down 15 Vibe)*:
4v2 → **7.4** · 5v3 → **7.2** · 6v4 → **7.1** · 8v5 → **4.7**

**Card value** *(ΔVibe over baseline)*:
upgrade → d8 **+0.32** · d10 **+0.63** · d12 **+0.97**
add → d8 **+1.44** · d10 **+1.76** · d12 **+2.10**

**Charge floor** *(ΔVibe / nothing-through)*:
floor 2 **+0.23 / 4.9%** · floor 3 **+0.75 / 0.7%**

**Swing at 1:2 (5d6 sum vs 3d6 wall):** 91% hit rate · **3.34** avg Vibe ·
**~4.5** Swings to a knockdown vs the Sonic's 7.2. At 1:1 it is ~2.2.

**Face button contrast on `#0a1020`:** default `.btn` **12.04:1** ·
End **9.95:1** · Face active **10.22:1** · **Face idle 2.15:1** · idle border
**1.37:1**. WCAG wants 4.5:1 at 10px.
