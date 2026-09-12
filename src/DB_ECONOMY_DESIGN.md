# 💰 Db ECONOMY — what the money is for

> **Decisions taken with Alex, 2026-09-09 → 2026-09-10.** This doc is the
> economy statement the melody seats hang off. §1–§3 are **DECIDED**. §4 is a
> code audit — every claim read out of source and cited to a file. §5 is a
> **kill list**: decisions still sitting in docs with no weight left, which
> should stop being quoted at new proposals.
>
> ⚠️ **THIS SUPERSEDES `ECONOMY_HANDOFF.md` ENTIRELY.** That doc is dated
> **4 July 2026** and is built on a currency called **Harmonic Charge (HC)**
> that does not exist anywhere in the source (`scoreTrackHC`, `perfHcBonus`,
> `harmonicCharge`, `HC` — **zero occurrences**). See §5.1.
>
> Companions: `MELODY_IDENTITY_DESIGN.md` §5⃣.0 (the palette decision this
> implements), `PROGRESSION_REWRITE_DESIGN.md` §4 (the ending fork), §5 (the
> sink), `STATE_OF_PLAY.md` §6 (the sink's open half).
>
> ✅ **EVERY SOURCE CLAIM IN §4 AND §5 IS MACHINE-CHECKED.** Run
> `bash .scratch/dbecon-verify.sh` from `src/` — 26 assertions, all green as of
> 2026-09-10. When one goes red, the code moved and this doc is the thing that
> is wrong.

---

## 0. The one-line version

**Db is paid for staying in your mode and landing the phrase. Fans are paid for
the shape you played. Every note buys a hex. Nothing else pays Db.**

---

## 1. 💰 THE ECONOMY IN PLAIN TERMS

Five taps, and each one is asked at a **different moment of the same turn**.
That is what stops them competing.

| what you do | what it pays | when it is asked |
|---|---|---|
| commit notes to the chord stack | **Drive / Sustain** | while you place |
| play notes inside your Spirit's mode | **Db, per note** | while you place |
| play your Spirit's characteristic shape | **fans** | while you place |
| land the final note | **Db** (cadence + lock) **or** the red/blue carrot | once, at commit |
| play any note at all | **one hex**, up to `speed` | at commit |

Three sentences carry the whole thing:

1. ⭐ **A CLEAN NOTE IS INCOME.** Half a Db, every one worth the same.
2. ⭐ **A DIRTY NOTE IS A CONNECTOR.** It pays nothing, resolves nothing, and
   cannot end a phrase — but it can carry a shape across a gap the mode does not
   contain, and it still buys a hex.
3. ⭐ **THE LANDING IS A FORK.** Money or power, chosen once, priced before you
   choose.

🎯 **And that is the dichotomy, finally real.** Db reads **contiguity** — how
much of the line stayed home. Fans read **contour** — what the line did. One
interior dirty note is cheap in the first and free in the second. Before today
both currencies read the same boolean and there was no choice in the room.

### 1.1 📏 Why the rate is 0.5 and not 1

`STOCK_REFILL_RATE = 6` (`gameConstants.js:15`) is the only balance dial this
economy needs. Stock is 10 (11 for the Ronin), `MELODY_MAX` is 8,
`STACK_COMMIT_BUDGET` is 3 — so a turn can **spend 11 notes and get 6 back**.
The refill is gradual: unused notes carry over, only spent slots recharge, and
oldest-spent first (`turnFlow.js` — `usedIdxs.slice(0, refillRate)`).

| you spend this turn | available next turn |
|---|---|
| 4 | 10 |
| **6** | **10** |
| 8 | 8, then 6 |
| 10 | 6 |

⭐ **SUSTAINABLE SPEND IS EXACTLY 6, AND THE BUFFER ABOVE IT IS 4 DEEP.**
`turnFlow.js` says it in its own comment: *"Spend big one turn, run short the
next — that is the whole tempo of §1."*

🎯 **So 6 × 0.5 = 3.0 Db per turn sustainable — which is exactly today's step-A
ceiling** (`floor(8/2) - 1 = 3`). The flat rate at 0.5 puts sustainable income
where today's *best case* sits and leaves a borrowable spike above it. At 1.0 it
would double Db income at unchanged tempo. 📌 **The rate is not a taste
judgement; it is the number that makes `STOCK_REFILL_RATE` the dial** — and that
constant already has abilities hanging off it (🪓 Axe Swing halves it, 🕳️ Gravity
Control drains it), so the economy gets a difficulty and a disruption surface for
free.

### 1.2 🎯 The choice this actually creates

Those six notes are bid for by the **melody** and the **chord stack**. That
choice already exists in the game. What it has never had is a readable price,
because `floor(clean/2) - 1` is a step function:

| Nth clean note | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| marginal Db, today | 0 | 0 | 0 | **1** | 0 | **1** | 0 | **1** |
| marginal Db, flat rate | .5 | .5 | .5 | .5 | .5 | .5 | .5 | .5 |

⚠️ **HALF YOUR MARGINAL NOTES ARE CURRENTLY WORTH NOTHING**, so "melody note or
stack seat?" cannot be evaluated — the answer depends on parity. The flat rate's
argument is **legibility, not supply**. It makes the bid arithmetic.

📌 **It also revives the top of the melody line.** `usableMoves = min(totalNotes,
speed)` and speed is 5 (Ronin) / 4 (everyone else), while `dbOverflow` is
hardcoded **0** (`melodyCommit.js:381`). So notes 5–8 buy no movement and no
overflow Db, and under the step function the 5th and 7th clean notes pay
literally nothing. Today the top half of a track is a dead zone. The dividend is
what gives it a reason to exist.

### 1.3 ⛔ NO Db CAP. NOT NOW, NOT LATER.

✅ **DECIDED (Alex, 2026-09-10):** *"If there is a problem with numbers running
too high compared to what we have at the upgrade store, then perhaps numbers at
the upgrade store need to change, and not the other way around."*

📌 **And there is no cap today.** `melodyCommit.js:464` reads
`earnedTotal = earned + dbOverflow + perfDbBonus + edgeDbBonus - edgeDbCost` — a
plain sum, no clamp. `STYLE_DB_CAP` went with the Style payout
(`gameConstants.js:693`). **Db has never had a ceiling, because the note economy
is the ceiling.** A numeric cap would double-cap the same thing.

⚠️ **AND A TOTAL CAP BREAKS THREE THINGS, NOT ONE:**

1. **It breaks the fork.** The ending choice is made *at commit*. If the +3
   depends on how big the placement slope came out, the player cannot price the
   fork before choosing it — and an unpriceable fork is not a decision.
2. **It re-creates the cliff.** `melodyCommit.js:394` gates harmonic lock on
   `baseScore.endingBonus > 0`. A cap that truncates the ending cascades into the
   lock — `MELODY_IDENTITY_DESIGN.md` §5.3's 6-Db hole arriving by a new road.
3. **It punishes the target play.** The long clean line that lands on the 5th is
   the line most likely to hit a cap.

🪦 **The precedent is already written down for the other currency.**
`economy.js:137` on `perfBig`: *"⚠️ CAPPED AT 3 TOGETHER… the overflow would
silently eat every other term's headroom rather than reading as a big turn."*
Same failure, same shape.

📌 **If a ceiling is ever genuinely needed:** cap the **placement slope alone**
and add the ending **after** the cap. Never cap the sum.

---

## 2. ✅ THE DECISIONS

1. ⭐ **Clean notes pay a flat per-note dividend** — **0.5 Db each**, replacing
   `floor(cleanCount/2) - 1` as the placement term.
2. ⭐ **A streak bonus sits on top, FLAT AND CAPPED** — opening proposal
   **+0.5 for any unbroken clean run of ≥4, at most two** (ceiling 4.5).
   ⚠️ Never scale the bonus with run length: `0.5 × (longest − 3)` reaches **6.5**
   on a clean eight, more than the ending bonus and the lock combined, which
   makes placement the main event.
3. ⭐ **Db is stored as INTEGER HALVES** (`dbHalves`), rendered `/2`. Never a
   float. ✅ **Verified safe:** `crowdMultiplier` multiplies **Fame**, not Db
   (`play.js:1114`), and `perfDbBonus` / `dbOverflow` are both hardcoded 0 — so
   nothing fractional ever meets a multiplier. Spending stays integer (the shop's
   flat rule is built at 6 Db).
   📌 **Do this while the sink is still open.** There is almost nothing
   downstream to migrate today. That window shuts when the depth ladder is built.
4. ⭐ **FANS STOP READING PURITY.** `positionFanGain`'s `clean` gate is removed.
   ⚠️ **This is load-bearing, not a tuning knob** — see §4.2.
5. ⭐ **THE ENDING MUST BE CLEAN TO TAKE THE Db FORK.** Already supported:
   `melodyCommit.js:392` passes `endingClean: endingChoice === 'db' && endingClean`.
   🎯 **The rule teaches in one line: discord is legal in the interior, fatal at
   the landing.**
6. ⭐ **THE RONIN'S RUN BECOMES A LETTER CONTOUR** — the note *letters* must climb
   or fall, adjacent letters only, and a same-letter inflection (E♭→E) is a free
   passenger that neither advances nor breaks it. Three letter-advances to
   complete. See §3 for why this is free.
7. ⭐ **NO Db CAP** — §1.3.
8. ⭐ **THE SINK IS NOT THIS DOC'S PROBLEM.** Alex, 2026-09-10: the missing
   depth of the upgrade shop *"will eventually get built out… if there is a
   discrepancy with how much Db is being 'wasted' it is a waste of time to think
   about."* 📌 Recorded so no future proposal re-derives it as a blocker.
   ⚠️ **One rider survives:** when the depth ladder IS built, price it against
   3 Db/turn, not 2. Sustainable income rises ~50% here.

---

## 3. 📏 MEASURED, NOT ARGUED

200k random stocks, C Lydian, 10-note stock, 4-note run. Scripts in
`.scratch/` — `dbecon-runfeas.mjs` (semitone feasibility + clean distribution),
`dbecon-letterrule.mjs` (the three contour rules), `dbecon-streak.mjs` (count vs.
per-segment placement), `dbecon-curves.mjs` (dividend curves + free inflection).

📌 **Monte Carlo, so read ±0.3pp between runs.** The equality below is not a
rounding coincidence: `dbecon-letterrule.mjs` scores every rule **on the same
stocks in the same run**, and S and L1 come out on the same figure every time.

| rule | all-clean | +1 discord | total | spellable at all |
|---|---|---|---|---|
| semitone step (today) | 32.6% | 36.8% | 69.4% | 92.9% |
| **letters adjacent, strict** | **32.6%** | 30.3% | 62.9% | 70.4% |
| **letters + free inflection** | **33.0%** | 30.4% | 63.4% | 70.8% |
| 🪦 letters, gaps allowed | 80.0% | 17.6% | 97.6% | 99.3% |

🎯 **THE LETTER RULE AND THE SEMITONE RULE GIVE THE IDENTICAL CLEAN NUMBER, and
it is not luck.** In any seven-note mode each letter is used exactly once, so two
adjacent letters that are both in the mode **are** a scale step. Switching the
run to letters changes nothing about clean play — it only changes what the dirty
notes may do. ⭐ **A rule change with no rebalance attached.**

⚠️ **AND IT KILLS THE CHROMATIC EXPLOIT FOR FREE.** Under the semitone rule a
fully chromatic ascent satisfies `bestRun(diffs, stepwise) >= 3` **by
definition**, so the moment fans stop reading purity, "play four chromatic notes,
collect the gesture" becomes the dominant fan line for anyone who has written off
their Db. Under the letter rule the repeated letter stalls it: three letter-
advances chromatically takes six notes and **three** discords. **No purity floor
needed inside the gesture.** 📌 This is the whole reason §2's rule 6 is a
decision and not a flavour preference.

🪦 **GAPS ARE REFUSED.** 80% clean / 97.6% with a bridge is
`MELODY_IDENTITY_DESIGN.md` §2.2's noise floor — a tax rebate, not a gesture.
Gapped/thirds contour already lives in **the sweep**; it does not need a second
home.

Other numbers this economy rests on:

- **5.83** — average clean notes in a 10-note stock (7 of 12 pitch classes are in
  a seven-note mode). A fully clean eight-note line is usually not on the table.
- **~49%** — turns where you hold **fewer than 4** clean notes at sustainable
  6-note supply. 📌 This is what keeps the movement-fuel trade alive; see §4.4.
- **1.13 → 0.54** — average placement Db under random play, count vs. per-segment
  streak. ⚠️ A floor, not a forecast: random play is not searcher play.

---

## 4. ⚠️ WHAT IN THE CODE IS AGAINST THIS

Read out of source 2026-09-10. Ordered by how much damage it does.

### 4.1 ⛔ THE SEARCHER CANNOT SEE Db FROM THE MELODY — the elephant

`scoreTrackDB`, `earnedTotal` and `dbGain` appear **nowhere in
`engine/policies/`**. The composition search ranks notes through
`botNoteStepOrder` (`bot.js:386`), a persona heuristic
(`musical | combat | disrupt | clean`) that reserves an ending note by cadence
hint. `evaluate.js` scores Db **BANKED** (§3.6 `dbHorizon`, §13b kit conversion)
— never Db **earned this commit**.

🎯 **So the dividend, the streak and the bridged run are all invisible to the
thing that chooses the notes.** The damage is not "the bot plays badly":

> ⚠️ **YOU WILL RUN THE BENCH, THE NUMBERS WILL BARELY MOVE, AND IT WILL READ AS
> BALANCED.** It will not have been measured. It will have been unmeasurable.

That is `CLAUDE.md` §15's warning and `SEQUENCING.md` §B's recurring lesson in
one place. `STATE_OF_PLAY.md`'s chain already ends
`💰 Db sink → 🎼 melody identity → 🤖 bot retune` — **this is that third node,
arriving early and dressed as optional.**

📌 **And the bot is already scoring against two retired concepts.**
`botNoteStepOrder` reads `ns.scaleMode ?? 'major'` and `ns.discordUnlocks`.
§5⃣.0.3 deletes the first; the second is already dead in the kernel
(`skills.js`: *"`discordUnlocks` IS NO LONGER READ BY THE MELODY KERNEL"*).

### 4.2 ⛔ `positionFanGain` STILL GATES THE WHOLE CROWD ON PURITY

`melodyCommit.js:540` passes `allInScale`; `positionFanGain`
(`melodyCommit.js:102`) returns `null` unless `clean`. `null` is **not** zero —
`gainFans` early-returns before touching `centerStreak`, so a single interior
bridge note costs the crowd payout **and freezes the promotion clock** that makes
diehards, which multiply FP.

⚠️ **LEAVE THIS IN AND THE TRADE IS NOT A TRADE, IT IS A TRAP.** Against that
loss, a bridged gesture pays into `perfBig` — capped at 3, inside a score clamped
at 10.

✅ **The gesture route needs no change at all.** `performanceScore` is already
purity-blind, and `detectSpiritStyle` works on folded pitch-class intervals and
never looks at the mode. **One boolean argument is the whole obstacle.**

⚠️ **Bench rider:** ungating also speeds the promotion clock for everybody. That
is a fame-race change riding in on a melody change, and it should be benched as
one.

### 4.3 ⚠️ TWO DEFINITIONS OF "ASCENDING" IN ONE COMMIT

If the Ronin's `run` goes letter-based, `detectDiatonicRun`, `detectSkipClimb`
and `performanceScore`'s shape terms stay semitone-based on the folded interval —
and `perfGest` pays **crowd** for `diatonicRunLen >= 3` while `spiritStyle` pays
**crowd** for the letter run. Same currency, same commit, two incompatible
notions of a run.

`spiritStyle.js`'s own header warns about exactly this: *"a gesture defined
against a different fold would disagree with the score it feeds."*
🎯 **`MELODY_IDENTITY_DESIGN.md` §4 already plans to remove
`detectDiatonicRun`'s payout — do it in the same change or ship the
disagreement.**

📌 **Also: `spiritStyle.js` throws the letter away.** `pcsOf` maps names →
pitch classes via `pitchIndex`. Names DO arrive (the file's header is *"Note NAMES
in, numbers out"*), so the fix is local to that file — but the bot's
`actionScore` steering reads the same detectors and must follow.

### 4.4 ⚠️ MOVEMENT CAPS AT 4–5, SO RULE 4 IS NARROWER THAN IT READS

`usableMoves = min(totalNotes, speed)` (`melodyCommit.js:334`) and speed is
**5** for the Ronin, **4** for everyone else (`spirits.js`). `dbOverflow` is
hardcoded **0** (`melodyCommit.js:381`).

⚠️ **So past note 4 or 5 a dirty note is worth EXACTLY ZERO** — no Db, no fans,
no hex. Not a sacrifice; a dead slot. `MELODY_IDENTITY_DESIGN.md` §5⃣.0 rule 4
calls the movement-fuel trade *"the whole sacrifice mechanic and it already works
mechanically."* **It works for at most four notes.**

📌 **It is not dead, and the number is 49%** — the share of turns holding fewer
than 4 clean notes at sustainable supply. The trade bites about half the time.
**Rule 4 should say four, not eight.**

📌 The one live reason to exceed speed: `canBank = overflow >= 1 && !existingBank`
copies the **last** note into the bank without consuming it — so speed+1 hands you
a free copy of your cadence note. Interaction, not a bug; worth a look once the
dividend makes long lines attractive.

### 4.5 ⚠️ THE ENDING SETS THE ROOT, AND THE ROOT RE-LETTERS HELD NOTES

`newRootRaw = lastNote` (`melodyCommit.js:329`), and `startTurnNotes` respells
every carried-over note into the new root's pool (`modePool[pi]`). Under a letter
contour, **a held note's letter changes when the root moves.**

⚠️ **And the Db ending steers you at the 5th**, so the root moves up a fifth on
most turns — maximum re-lettering, every turn, **caused by the payout the player
is aimed at.** Melody lines clear each turn (`melodyLine: []` in the patch) so
within-turn play is safe; it is the *banking* plan that silently breaks, and it
will read as a bug.

📌 Fix: show the next-turn spelling on the chip before commit, or make sure the
HUD never implies a held note keeps its name.

---

## 5. 🪦 THE KILL LIST — decisions with no weight left

⚠️ **These are still quotable out of the repo and should stop being quoted.**
Deletion is the expensive operation here (`SEQUENCING.md` §B), so these are
headstones, not removals.

### 5.1 🪦 `ECONOMY_HANDOFF.md` — SUPERSEDED IN FULL

Last touched **4 July 2026** (nine weeks). Its central frame is *"three
currencies: FP / HC / Fans"* built on **Harmonic Charge**.

⛔ **HC DOES NOT EXIST.** `scoreTrackHC`, `perfHcBonus`, `harmonicCharge`, `HC` —
**zero occurrences in the source.** Every payout row naming it describes a
currency the game does not have.

🪦 **Its one open question is moot.** *"Legendary riffs still pay FP directly
(`grantFame` off `detectRiff`) — 💬 open, don't change without asking."* The
**riff library was retired 2026-08-17**; `detectRiff` survives only in two
comments. There is nothing to decide.

📌 Its **STICs + Earned** lens and its *"hand out raw material freely, keep the
decision the player's"* rule are still good and still binding. **Keep the lens,
retire the ledger.**

### 5.2 🪦 `chromClimbActive` IS NOT A PRECEDENT

`MELODY_IDENTITY_DESIGN.md` §5.5 cites it as *"the working precedent for
characterful dirt."* It occurs in **exactly one place in the repo** — the
past-tense comment at `skills.js:41` describing it — and per that comment it
*"had never once executed."*

⛔ **So §4.2's ungating is a NEW RULE, not the restoration of one.** §5.5's
citation must not make it sound safer than it is.

### 5.3 🪦 §4'S "DIRECTION STATED, NOT YET LOCKED" — THE WITHDRAWAL ALREADY HAPPENED

`MELODY_IDENTITY_DESIGN.md` §4 is still marked *"⚠️ DIRECTION STATED, NOT YET
LOCKED — it needs the bench in §4.3."* In source:

| function | callers | state |
|---|---|---|
| `driveBoostFromRun` | **0** | 🪦 definition only (`cadence.js:143`) |
| `sustainBoostFromPattern` | **0** | 🪦 definition + one comment (`cadence.js:224`, `:190`) |
| `analyseTrack` | **0** | 🪦 definition + one comment, returns `{points: 0}` (`cadence.js:291`, `:288`) |

📌 **The column is CALLERS, not occurrences** — each still has a definition and
some carry a comment, so a `grep -c` will not read zero. `.scratch/dbecon-verify.sh`
checks the right thing.

✅ **Melody shape no longer pays Drive or Sustain. The withdrawal shipped.** §4's
status marker is nine weeks stale and should read ✅.

### 5.4 🪦 §5⃣.0.3's COST TABLE IS MOSTLY ALREADY PAID

That table lists what the palette decision *would* cost. Verified now:

| item | claimed status | actual |
|---|---|---|
| Db length counts clean notes | ⛔ mandatory, not done | ✅ **BUILT** — `cadence.js:265` sizes off `cleanNoteCount` |
| the ending fork (rule 10) | concrete but unbuilt | ✅ **BUILT** — `melodyCommit.js:357` `endingChoice` |
| `discordPenaltyFor`, `DISCORD_GRACE`, `DISCORD_FLOOR` | retires | ✅ **GONE** — 0 occurrences |
| `modeFromStack` / derived `scaleMode` | needs deletion | ✅ **GONE from the kernel** — 0 occurrences ⚠️ **but the bot still reads `ns.scaleMode`** (§4.1) |
| `checkWaNoKoe` | already cut | ✅ **GONE** — 0 occurrences |
| 🌀 Freestyle pardon | rule 12 cuts it | ✅ **GONE** — one comment in `spiritStyle.js:217` |

🎯 **§5⃣.0 is far closer to built than its own banner claims.** The banner still
says *"⚠️ STATUS: NOTHING HERE IS BUILT."* **That line is now false and is the
single most misleading sentence in the melody docs.**

### 5.5 🪦 STALE COMMENTS THAT ASSERT LIVE PAYOUTS

- `cadence.js:290` — *"overflow from non-stacking still does [produce Db points]."*
  ⛔ **`dbOverflow` is hardcoded 0** (`melodyCommit.js:381`). Nothing overflows into Db.
- `cadence.js:273` — *"ending bonus (clean tracks only — caller guards this)."*
  ✅ **Now true** — the caller passes `endingClean` (`melodyCommit.js:392`). §5.3's
  *"the caller does not"* finding is **closed**; the comment is no longer stale and
  the doc should stop citing it as a hole.

### 5.6 🪦 §5.1 / §5.2 — THE MODAL DIP

Already headstoned in place, restated here so it is not re-proposed: **their
reasoning still binds** (noise floors, ordered pairs, "a gesture must be a move,
not a note") and **their conclusion does not**. The per-Spirit resolved-dip
payout is dead — §5⃣.0 rule 5, and Alex's reason should outlive every attempt to
reopen it: **the game cannot predict what subjectively sounds good.**

📌 **This economy does not reopen it.** The bridge note pays nothing, resolves
nothing, and is invisible to the crowd score. It is a **connector, not a payer**.
Rule 4 survives with one word changed: discord is **inert, not forbidden**.

### 5.7 ⚠️ THE GLAMARCHY / RIFF RAT SWAP IS STILL UNRECORDED

`spirits.js:15` still ships **Glamarchy** with a full stat line. Every four-column
identity table in the melody docs has **Riff Rat** in her seat and her absent.
⛔ **A roster swap is being inherited from a table rather than decided.** Not this
doc's call — but it should stop being assumed by omission.

---

## 6. ⛔ WHAT IS STILL OPEN

1. **The streak's exact size.** §2 rule 2 is an opening number, not a bench result.
2. **Whether the searcher ever spikes above 6 notes.** The buffer is 4 deep, so a
   spike is one turn, not a plan. If the bot never chooses it, the tempo story is
   nicer on paper than in play — and per §4.1 the bot cannot currently even see the
   question.
3. **🌀 Intergalactic 0's missing innate.** Rule 12 binned Freestyle and left a
   hole. Unchanged by this doc.
4. **📇 The second mode / difficulty tier.** Indexed, not built — §5⃣.0.1. Nothing
   here touches it.
5. **The letter rule across all twelve roots.** From root C the letters **C** and
   **G** have exactly one spelling each (the white-key escape plus the *"always F♯,
   never G♭"* rock bias), while every other letter has two — so they are bottleneck
   letters, and the bottlenecks move as the root moves. ⚠️ **A cosmetic spelling
   rule has acquired mechanical weight.** `notes.js` should say so, and the sweep
   across twelve roots should be run before anyone leans on the texture.
