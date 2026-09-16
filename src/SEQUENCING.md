# SEQUENCING — 🧭 the live handoff, the findings, and the index

> **For AI editors + Alex.** This file was **4,763 lines on 2026-09-04** — 31
> session handoffs stacked newest-first, with the original ordering thesis buried
> at line ~1347 between two of them. It was also the doc every session was told to
> read FIRST. **21% of all design text in the repo, of which 132 lines were live.**
>
> ✅ **RESTRUCTURED 2026-09-04.** The complete original is
> `docs/archive/SEQUENCING-full-through-2026-09-04.md`, unedited, searchable by
> section id. What stays here is what a session actually needs:
>
> | § | what it is |
> |---|---|
> | **A** | 🧭 **the current handoff** — what just happened and what is next |
> | **B** | 🎓 **the findings** — lessons that cost real money to learn, kept because each one is now a live defence in the test suite |
> | **C** | 📇 **the index** — all 38 handoffs, dated, one line each, pointing into the archive |
>
> ⚠️ **NOTHING WAS DELETED.** If a line below is too short to act on, the full
> text is in the archive under the same section id.
>
> 📌 **NEW ENTRY POINT: read `STATE_OF_PLAY.md` first.** It is the current state
> of the whole game in one screen. This file is the *narrative* — what happened
> and what it taught. That file is the *state* — what is true right now.

---

# A. 🧭 THE CURRENT HANDOFF

> ⚠️ **§A HAS RESTACKED AND THIS ENTRY MAKES TWELVE.** `CLAUDE.md` says §A is ONE
> handoff and the previous one moves to the archive with a row in §C. That ritual
> has not run since 2026-09-04; entries 8 through 19 are all still here. 📌
> **Deliberately not fixed in this pass** — archiving is destructive and §B says
> read it first — but it is the exact regrowth the restructure existed to stop,
> and the next session that touches this file should do it. 🚩 **Flagged twice
> now (18-coreloop, 19-cheapest). A warning that is always there stops being
> read — the same failure `check:bundle`'s "6 warnings" taught.**

## 20-lever. The mode flipped, and one constant had been quietly lying for weeks — 2026-09-15

⭐ **ALEX: *"I'd really like for the game to be turn based instead of FP race
based, with FP as a tracker to determine who is winning at the moment instead of
who is closest to the finish line."*** That is R1, and this session built §0's
lever — **all four steps in one pass, because they cannot be split.**

### ✅ What shipped

1. 🎸 **Battle of the Bands is the DEFAULT.** One normalising ternary in
   `state.js`. Every downstream reader tests `state.config.winCondition`, which
   is always explicitly set there, so the codebase has exactly one default.
   🏆 The race survives as `winCondition:'fame'` (§2.4, Alex's ruling).
2. 🎤 **Fans pay Fame again** — `FAN_CASUAL_WEIGHT` 0 → **0.12**, `FAN_MULT_CAP`
   3.0 → **5.0**.
3. 🎲 **The Sonic die ladder is DELETED** — `sonicDieSides` plus `peakCasuals`
   across **seven** sites (the brief said six).
4. ✨ **The pose ceiling rides the mode** — `POSE_FP_MAX_ROUNDS = Infinity`.

📏 `test:winconditions` **87** · `test:turnflow` **73** · `test:determinism` **20**
· `test:battleflow` **65** · `test:sonic` **75**. ⚠️ Run in an isolated container
against staged copies — `test:all`, `check:bundle` and `lint:baseline` still have
not run. `esbuild` parse of the monolith: exit 0, zero warnings.

### 🎓 THE FINDINGS, AND THERE ARE THREE

⭐ **1. A CONSTANT THAT SAYS IT "MATCHES" ANOTHER DOES NOT FOLLOW IT.**
`POSE_FP_MAX`'s own comment read *"Matches `FAME_PER_TURN_CAP`"*. That stopped
being true the day `FAME_PER_TURN_CAP_ROUNDS` was added: `RIFF_FP_TURN_CAP` was
taught to follow the mode, the pose ceiling never was. So in a round-limited
match every other Fame source ran uncapped into the hundreds while a maxed pose
stayed pinned at **4** — the Limelight economy quietly worthless in the mode that
was about to become the default. 🎯 **Nothing errored and no suite went red**,
because the comment described a relationship the code had never actually had.
**It copied the number once, and the copy rotted.**

⭐ **2. THE COMMENT WAS RIGHT AND THE CODE WAS WRONG, FOR TWO WEEKS.**
`gameConstants.js`'s 2026-09-02 block *derives* 0.12 and 5.0 in full, complete
with the arithmetic (`1 + 0.40×6 + 0.12×14 = 5.08`), and the constants
underneath it read `0` and `3.0` anyway — because the per-turn cap made the
correct numbers unusable. 🎯 **The fix was never the weight; it was the
constraint.** ⚠️ **If you find yourself zeroing a value whose own comment
explains why it should not be zero, change the constraint instead.**
📌 Proof it was really broken: restoring the weight **turned an already-red
`evalCheck` assertion green** — *"more fans → higher multiplier term"* had been
failing because fans did nothing.

⭐ **3. A FLIPPED DEFAULT TURNS EVERY OMITTED ARGUMENT INTO A BEHAVIOUR CHANGE.**
`battleFlowCheck`'s Fame-economy fixture named no mode, so it had silently
stopped testing the Fame economy and started asserting against Infinity.
`winConditionsCheck`'s Legend Run **control** — the row commented *"if this row
ever changes, the mode leaked"* — became the same match twice. Both are now
pinned to `'fame'` explicitly. 🎯 **The suites caught all of it, which is the
system working**; the danger was never the failures, it was the fixtures that
would have kept passing while measuring nothing.

### 🚨 The trap the brief got backwards

Phase 1 item 2 said *"remove `FAME_PER_TURN_CAP`"* and warned two dependent caps
would go silently uncapped. The real shape: `RIFF_FP_TURN_CAP` already looked
after itself, `POSE_FP_MAX` was already broken before anyone touched anything,
and `FAME_PER_TURN_CAP` **must stay** because the race survives and the cap is
that mode's catch-up brake. Trap 3 is corrected in place.

### ⛔ What is NOT done, and one of it is user-visible

- 🚨 **THE MATCH IS ROUND-LIMITED WITH NOTHING ON SCREEN SAYING SO.** No
  rounds-remaining readout, no lobby toggle. ⚠️ **And `ui/FameRace.jsx` still
  draws a finish line at `fameToWin`, which is Infinity in the default mode** —
  the HUD is now actively lying. `FAME_TRACK_REDESIGN.md` is the job, and
  `.scratch/fame-track-preview.html` already exists from 2026-09-02.
- ⚠️ **R8 is unsatisfied.** The charge-zone `+2` still raises the **roof**.
  Phase 2 item 2, flagged at the site.
- 🐛 **`evalCheck` and `selftest` were ALREADY RED before this pass** and still
  are — `evalCheck` at *"a charge alone does not carry anyone else's rig"*,
  `selftest` at *"keeps the highest die"*. 📌 Verified against a pristine tree,
  and `evalCheck`'s failure point MOVED LATER because this pass fixed one of its
  assertions. **Neither is caused by this work.**
- 🗺️ **The Systems Map is now behind by THREE sessions.**

## 19-cheapest. Three cheap things, and one of them was a rule that never existed — 2026-09-15

⭐ **THE FIRST BUILDING SESSION AFTER `18-coreloop`.** Alex asked for the idea box
and the core-loop rulings **cheapest first**, and chose the zero-risk trio:
Phase 0's Face button, the `endingDb` naming job, and the dead
`pendingSonicAttacks` counter. ⛔ **Nothing from Phases 1–6 was built.**

⚠️ **NO REPO SUITE RAN.** The 2026-09-08 Windows update still stops the Cowork
workspace mounting the repo, so `test:all`, `check:bundle`, `lint:baseline` and
`bench:bot` **did not run**. Files were staged out, edited and written back. What
DID run: two `.scratch/` probes in an isolated container, and an `esbuild` parse
of the monolith (**exit 0, zero warnings**). 📌 **Run the suites in Claude Code
before trusting any count.**

### What shipped

1. 🎨 **The Face button.** Inline override deleted; Face wears `.btn`/`.btn.on`
   like every other rail button. 🎯 **THE FINDING THAT MATTERED:** the brief
   priced this as a **contrast** defect (2.15:1 vs 12.04:1) — but
   `.arail .btn` builds its wash, bloom and `inset 2px 0 0` left spine out of
   **`currentColor`**, so the dim colour **put the lamp out** rather than greying
   the label. ⚠️ A pure WCAG reading would have under-sold it, and a shade picked
   to clear 4.5:1 would have left the button dimmer than the rail it sits in.
   **When a design system keys off `currentColor`, a colour override is a
   component override.** ⚠️ Cost, taken knowingly: the cyan `#44ccff` armed state
   is gone with it; one prop restores it and the site says how.
2. 🎼 **`ENDING_DB` is named and exported** (`music/melodyPayout.js`), carrying
   §14.9.3's two reasons, §14.9.5's cost and §14.9.4's unsettled tonic.
   `PROJECTILE_COMBAT_DESIGN.md` §14.9.5 now points AT the comment and is marked
   historical, so the rationale has **one** live home (§B9). Verified inert:
   **28,807 assertions, 0 failures.**
3. 🔊 **`pendingSonicAttacks` is reset** at the defender's own turn end.

### 🎓 The one worth keeping

⭐ **A COUNTER NOBODY READS IS A RULE THAT DOES NOT EXIST — AND IT LOOKS EXACTLY
LIKE ONE THAT DOES.** `pendingSonicAttacks` was incremented at one site, read at
none, reset at none. Its comment described §3.5.1's turn-start shield bill in the
present tense, `PROJECTILE_COMBAT_DESIGN.md` §3.5.5 argued *from* that bill that
*"defence stops being free"* — and **the bill was never charged.** An entire
design argument rested on a line of code that only incremented an integer.

🎯 **This is §B's "a suite nobody runs" in a second costume**, and the costume is
the point: the first one was a *test* that asserted nothing, this one is a
*counter* that fed nothing. Both passed every reading a human gave them, because
both were syntactically alive. 📌 **The cheap defence is the same in both cases —
grep for the READ, not the write.** A write with no read is the tell.

⭐ **AND THE FIX ANSWERED A SECOND QUESTION FOR FREE.** Clearing at the
*defender's own* turn end — beside the slime decay, for the reason `turn.js`
already documents about spirit-turns vs turns — makes the window "attacks since I
last acted", which is one lap of rivals at **any player count**. That is §3.5.1's
bill *and* R12's diminishing-FP window, **including Alex's actual worry: three
different attackers milking one low-Sustain player, which a per-attacker counter
would have missed entirely.** 🎯 The boundary that was correct for the old rule
turned out to be correct for the new one, because both are really asking *"what
happened to me while I could not act?"*

### ⁉️ What Alex ruled in passing

⭐ **The Fame race SURVIVES — rounds becomes the default, the race stays
selectable** (brief §2.4, previously open). ⚠️ **It is not a free answer:**
keeping the race means `fpPerLife` and friends must keep working at
hundreds-scale Fame, which **converts the brief's trap 8 from a consequence into
a job.**

### ⛔ What the next session must not assume

- **No suite has seen any of this.** `test:render`, `test:turnflow`,
  `test:determinism` and `check:bundle` are all unverified against it.
- The two probes are **`.scratch/` evidence, not suites** — deliberately, per
  `CLAUDE.md`. 🎯 `sonicTallyCheck.mjs`'s assertions belong in **`test:barrage`**
  when Phase 3 writes it, beside R12, the consumer they are really about.
- 🗺️ **The Systems Map has NOT been republished** — and it is now behind by two
  sessions, `18-coreloop`'s changes included.

## 18-coreloop. The loop got decided, and four changes turned out to be one — 2026-09-15

⚠️ **A DESIGN SESSION. NOTHING WAS BUILT, NO SUITE WAS RUN, NO CODE MOVED.**
Documents changed and a build brief was written. Do not read any number below as
a test result — they are simulation output, not assertions.

⭐ **THE OUTPUT IS `CORE_LOOP_REWORK_BRIEF.md`** — 22 rulings, 8 open questions,
6 phases. 🎯 Point the next session there.

### 🎓 What the session actually found

⭐ **FOUR CHANGES ALEX RAISED SEPARATELY ARE ONE LEVER.** Round-limited play →
the per-turn Fame cap has no job → a heavy crowd multiplier becomes safe →
casuals go back to Fame → the Sonic die ladder has nothing left to pay for.
⚠️ **In any other order, each step looks like it is breaking something.**

🚨 **AND THE REPO HALF-AGREED ALREADY.** `FAN_CASUAL_WEIGHT = 0` carries the
comment *"casuals now grow permanent Sonic die size"* — sitting directly beneath
a 2026-09-02 block, **Alex's own call**, that derived the correct weights
(Diehard 0.40, Casual 0.12, cap 5.0) and warned *"THIS PUSHES HARD ON
`FAME_PER_TURN_CAP`, WHICH IS THE POINT OF FRICTION."* The weights were walked
back to fund the die ladder. **Removing the cap removes the reason they were.**

✅ **ROUND-LIMITED PLAY IS BUILT AND SWITCHED OFF.** `WIN_CONDITIONS_DESIGN.md`
§9 item 1 is CLOSED — `ROUND_LIMIT_DEFAULT = 10`, `FAME_PER_TURN_CAP_ROUNDS =
Infinity`, headless, `test:winconditions` green. Missing: the lobby toggle, the
HUD readout, and the default. 📌 Alex believed it unbuilt; it is unswitched.

🐛 **`pendingSonicAttacks` IS WRITTEN AND NEVER READ.** One site in the repo —
the increment at `combat.js:276`. Nothing consumes it, nothing resets it. Two
consequences: §3.5.1's turn-start shield bill **is a doc-only rule and does not
exist in the game**, so every argument in §3.5.5 is unpaid-for; and the counter is
a lifetime tally wearing a per-round name, so the first thing to read it is wrong.
🎯 It is also exactly the counter Alex's new diminishing-FP rule needs.

🐛 **THE FACE BUTTON IS A REAL DEFECT.** Alex reported it as looking
unselectable. `rlsw-simulator-v3_8_1.jsx:12785` hardcodes idle `#1a5066` on
`#0a1020` — **2.15:1** against every other rail button's **12.04:1**, at 10px
where WCAG wants 4.5:1. ⚠️ And `.btn:disabled` is `opacity:.3`, landing in the
same visual place — **so it is styled like the one state it never renders in**,
since Face only appears when `moveStepsLeft > 0`.

### ⭐ The rulings, in one line each

Round-limited, no FP caps ever, Fame in the hundreds, fans multiply Fame · the fan
die ladder is cut · the marquee pays a temporary card (d8/d10/d12 by question
difficulty) · charge zones raise the floor only, never the roof · the Swing
converts contact into damage at the cost of committing to the brawl · **the Riff
Off is not chosen but TRIGGERED by mutual facing in Sonic range**, 1 AP and no
Drive note, running off the last committed melody · **and every special ability
is parked until the loop is solid.**

### 🎯 Why the Riff Off ruling matters more than it looks

⭐ **Facing becomes the mode switch.** Square up and your Sonic is a duel; attack
from an angle and it is a barrage. 🎯 **That closes a hole the barrage opened** —
the rolled shield and the duel both answered *"the defender should get to do
something"* and overlapped. Under the ruling they do not: face them and you answer
with melody, turn away and you answer with your Sustain roll. **One choice, made
in advance, about which kind of fight you are in.** ⚠️ And it relocates combat
choice into the movement pillar — to fire a plain Sonic at someone facing you,
you must move.

### ⚠️ What was NOT decided, and must not be assumed

What produces the Sustain pool (**the most sensitive number in the rework** — one
die of defence outweighs the whole damage divisor) · whether a note-break triggers
on *emptied* or *overwhelmed* · the marquee card's wrong-answer cost, its
add-vs-upgrade shape, and its duration · whether the Fame-race mode survives at
all · the Swing divisor and its re-scaled whiff · whether a duel spends the
melody. 🚨 **All eight are in the brief's §2, labelled as recommendations rather
than rulings. Keep that label.**


## 17-riffoff. We went looking for the Swing and found the duel's currency — 2026-09-14

⚠️ **A DESIGN SESSION. NOTHING WAS BUILT, NO SUITE WAS RUN, AND NO CODE MOVED.**
Four documents changed and that is the whole output. Do not read any count below
as a test result.

### 🎬 How it went sideways, and why that was worth it

Alex opened on the **Sonic**: replace the Sustain threshold with **rolled Sustain
dice that become shield HP**, worn down by Drive projectiles until it busts — and
then, *"where does Swing earn its place?"* with the **Smack-down** image (Drive
energy driven into the instrument for an all-out blow) and *"I think it still earns
its place as the big Vibe hitter."*

🚩 **Both halves collided with §5.3**, which had closed *"the two attacks compete"*
by **separating their targets** — Sonic attacks the Spirit, Swing attacks the chord.
A Sonic that busts shields takes the Swing's exclusive; a Swing whose job is Vibe is
the reversal §5.3 explicitly recorded going the other way. ⚠️ **Either change alone
is arguable. Both together collapse the two attacks back into one system with two
animations.**

🪦 **The Sonic HP idea was set aside, not rejected** — filed in `IDEAS_INBOX.md`
with the two objections it must answer. ⛔ **And the Swing question was never
answered.** `PROJECTILE_COMBAT_DESIGN.md` §14.8 says so in those words, because a
question that merely stops being discussed reads exactly like one that was settled.

### 📊 The thing that unstuck it — Alex's own 2D grid

Alex recalled the original 2D design: **three attack modes rated across five axes**
(Sustain drain · knockback · Fame · Vibe · own Drive drain), and asked whether the
foundation could survive. **It can, and it is now §13** — every cell re-read out of
the code rather than out of memory.

⭐ **His recall of the Swing row was five for five.** The Sonic row was four of five.
🚩 **The Riff-Off row was wrong on two axes, both in the same direction** — he had it
as the showy, low-violence option, and it is the most violent thing in the game:
the *same* `sonicKnockback` (not a lesser one), the *largest* Vibe number in the
rules, the largest Fame payout under a doubled cap — against one inherited note of
Drive. **Three peaks and one cost.** `battleFlow.js:748` had said so for months, in
a comment.

🎯 **The grid's real job is that this spec has been doing grid reasoning without a
grid.** §3.3's *"three jobs and no fourth"* is a budget written as a scold because
there was nothing to point at; §5.3's crisis and its fix are a grid operation; §4.1
is a column with one row in it. ⭐ **A sixth column — MISS COST — was added**, and it
is where §4.2's open risk question finally has somewhere to sit.

### 🎤 Where it landed: the duel is a BET, and it runs on the MELODY

Alex, following the grid down: *"would the riff off live off of Drive at all? Since
these are basically chords."*

⭐ **He was right, and the code already agreed.** `rlsw-simulator-v3_8_1.jsx:8442`
builds the attacker's riff from `committedMelody` — the *Rhythm Creation Device* —
and `riffSkill` keys the bot off the last commit's Performance Score. **Drive's only
involvement is the one note the Sonic already spent on the way in.**

🎸 **The argument underneath it is musical and it is the reason to trust it: a chord
is SIMULTANEOUS, a riff is SEQUENTIAL.** The Drive stack is a voicing — notes with
no order and no rhythm. Only the melody line is riff-shaped.

⭐ **Which produces the result worth keeping.** `DRIVE_SUSTAIN_SPLIT_DESIGN.md` §1's
three commit destinations map one-to-one onto the three modes: **Drive** powers the
two attacks, **Sustain** defends against both, **the Melody Line** powers the duel.
🎯 **That is why the duel has no shield** — not a preference, a structure. It is fed
by the destination that *clears every turn* rather than the two that persist. **It
was never in the same economy.**

### 🎓 And `riff/melodyRiff.js` had written the thesis already

> *"the melody you build is your combat… The attacker rehearsed this riff all turn —
> the defender sight-reads it. Complexity is a weapon paid for in preparation."*

⚠️ **But the shipped lever and Alex's proposed one run on different axes**, and the
session's most useful correction was refusing to conflate them: shipped complexity
moves **how hard the chart is**; proposed cleanliness moves **what a landed note is
worth**. §14.3 keeps them in separate rows on purpose.

### 💡 The risk answer, made of something already counted

Alex: *"Could it be retrospective? A melody line that doesn't get committed well
could become a risk of not producing 'strong' notes for the riff off."*

⭐ **Discord notes become weak projectiles that get swatted in the collision.** 🎯
`STATE_OF_PLAY.md` §4's *"DISCORD NOTES ARE INERT"* (decided 2026-09-09, unbuilt)
gave them two uses, both consolation prizes; **this is a third and a real one, and
it costs nothing to build because the game already counts them.** Play a sloppy line
on Tuesday, lose the duel on Thursday.

⚠️ **§14.4 carries the rider that will otherwise become a bug report**: *inert* means
a discord note does not **pay**, not that it does not **exist**. 📌 And the obvious
input is the wrong one — `perfScore` is **identity-only** by an explicit warning at
`melodyCommit.js:294`, even though it is what `riffSkill` already reads.

### ⭐ THE ONE RULING

**The first caller keeps their advantage.** In Alex's alternating structure — A
calls with their line, B answers, then B calls with theirs — the caller rehearsed
and the answerer sight-reads, so whoever opens has an edge and the loser is nearly
always answering. Alex: *"that is also their positioning that landed them with the
attack that gets them a free go. I think that is fine as it is."*

🎯 **It is paid for in board position.** 🪦 The ruling **closes** all three
compensations that were offered: a warm-up opening exchange, a defender ante as a
fairness fix, and end-only-on-a-completed-answer.

### 🚩 Two code findings, reported rather than edited around

1. ⚠️ **The Riff-Off's Vibe runs on a table the codebase declared superseded.**
   `combat.js:18` — *"LEGACY damage table… New code should use thrashDamage /
   sonicDamage."* Swing and Sonic were both migrated; **the riff-off never was**, so
   it is the only attack still paying out of `marginToDamage` (cap 5). Drift, not a
   design choice. §13.5.
2. ⚠️ **A comment describes a clear that could not be found.**
   `melodyCommit.js:325`: *"the riff-off reads these; turn start clears them"* — and
   **no code clearing `committedMelody`** turned up in the engine or the client.
   📌 It matters: §14.5's alternating duel needs the defender's line to still be
   there. ⛔ **Not fixed, not assumed** — `turn.js` / `turnFlow.js` were not read
   this session. **Verify before building on it.**

### 🚨 THE BLOCKER, AND IT IS NOT A BALANCE ITEM

`riffOff.js:389` declares it against itself: `riffSkill` **has no tempo term**, so a
Spirit plays Round 2 exactly as well as Round 1 on a chart that got 1.7× faster —
`HARNESS_GAPS.riffRound2Speed`. Today that is a bench inconvenience. ⛔ **Under an
escalating go-until-somebody-fails duel it is a bot immune to the difficulty ramp
the mode is built on, compounding every exchange.**

🎯 **§B10 does not cover this.** It does not make the bot *strong*; it makes the
mode's central mechanic *not apply* to half the table — impossible rather than
weak, which is the stated exception. **Decide it before building escalation.**

### 🪦 Rejected in the pass

- **Simultaneous two-sided performance with live collision** — `RIFF_RESULTS_SUBMITTED`
  submits a completed array *after* a performance; live mutual resolution is the
  exact seeded-RNG/desync cost §11 rejected the hidden bid over. It also discards
  `generateDefenderRiff`: play at once and there is no *call* to answer. 💡 **The
  free version is recorded** — keep call-and-response, render it on two tracks with
  their side playing back a *recording*. The projectiles still collide; no netcode moves.
- **The note pool as the duel's currency** — it feeds Drive, Sustain *and* melody,
  so spending it there **starves the system that feeds the duel.** Survives only as
  an ante candidate, and ⭐ the first-caller ruling removed the fairness case for one.

### ⬅️ NEXT

0. 🎼 **Name the ending constant and put Alex's two reasons on it** (§14.9.5). The
   cheapest high-value job here: it is about to price two systems and its rationale
   lives only in a design doc.
1. ⁉️ **What is actually wagered** (§14.6), and ⁉️ **what surviving collision weight
   does** (§14.9.2). The row still has no cost column: a melody is spent, paid and
   cleared before the duel begins. Two candidates recorded, neither decided.
2. 🚨 **§14.7's tempo gap**, before any escalation is built.
3. 📌 **Two cheap verifications**: does anything clear `committedMelody`; is the
   melody's Fame paid before `startRiffOff` reads the stash.
4. ⛔ **The Swing still has no answer**, and the question is now ten days old.

### 🎼 LATER THE SAME DAY — the strength model, and a rationale recovered

Alex, on what makes a note strong: *"I honestly like music for the subjectivity of
it, I'm not so strong in answering objectivity — ie. Theory."*

⭐ **The answer was to stop looking for a new judgement.** `melodyPayout.js` records
that the game already made this call — the subjective half (`excitement`,
`loyalty`, promotions, *"a mood model that decided whether you had been
entertaining and took fans away when it judged you dull"*) was **cut on purpose**
and stays pinned at 0: *"only the arithmetic returns."* 🎯 **And the game has
exactly ONE per-note judgement — `scale.includes(note)`. Everything else it
measures belongs to the LINE.** So: do not grade notes; **read the grade the line
already gave them.** §14.9's four tiers are dud 0 / plain 1 / strong 2 (inside the
craft run) / **+ the ending value for the hook**, stacking where they overlap — and
every input is arithmetic the commit already performs.

⭐ **The split that makes it work: hands decide IF a note fires, the melody decides
what it WEIGHS.** Flawless hands on a sloppy line throw featherweights; a beautiful
line played badly never leaves the amp. 🎯 **This is what finally closes the
objection that killed the Drive version** — a currency paying the entry fee to a
contest it has no say in.

### 🎓 AND THE REAL FIND WAS NOT A DESIGN

Asked why the fifth pays triple the tonic, Alex answered from memory — **and
neither reason existed in any file.** `endingDb` is a bare ternary with no comment
in `melodyPayout.js`, `melodyCommit.js` or `MELODY_IDENTITY_DESIGN.md`.

1. 🎸 *"Nothing is as strong for Rock as the 5th."*
2. ⭐ *"I also wanted to have the players change chords often, so that was another
   reason it was stronger than say the tonic."*

🚨 **Reason 2 makes that number a lever on the CHORD ECONOMY, not melody flavour**
— and it is unreconstructable. Reason 1 a stranger could guess; reason 2 was one
message from being gone. 🎓 **§B9 caught live rather than archaeologically:** the
decision had been made, and for months it read exactly like one that had not.

⛔ **It is still not in the code.** §14.9.5 says where it belongs — `endingDb` has
to become a **named constant** before it prices both the Db payout and the duel's
hook, because one number doing two jobs cannot be tuned apart. That is now
`STATE_OF_PLAY.md` §7 item 3, and it is the cheapest high-value job on the list.

### 🚩 One trap caught before it was built

Alex's shape was *"each bringing a score together to work out a strength
variable."* ⛔ **Summing them breaks on arithmetic already in the file:**
`craftFans` caps at **2**, `endingDb` at **3** — so a flawless eight-note run would
score less than four notes ending on the fifth, after a whole craft layer was built
to make the middle pay.

⭐ **The cause was reading the wrong number.** `craftRunFor` returns the run's
*length*; the cap is applied afterwards and its own comment says why —
**`CRAFT_FAN_CAP = 2` ⚠️ fans feed FAME.** It is a brake on the crowd economy and
has nothing to do with duels. 🎯 **So the duel reads the run LENGTH and the Fame
route keeps its cap** — one measurement, two consumers, each with its own ceiling.
The two halves then become **quantity and quality** rather than a total: the middle
decides how much you throw, the ending decides whether you finish them off.

🧊 **Alex: *"sounds like a satisfying answer — for now at least."*** Recorded as
**provisionally accepted**. The tonic's rise from 1 is ⁉️ **not settled** (*"2 times
or so, 1.5 even"*), and ⚠️ at 2 it becomes the same rung as the fourth.

### 📁 Changed

`PROJECTILE_COMBAT_DESIGN.md` (**§13, §14 and §14.9 new**, header block, §10's
deferred table, §14.4's pointer) · `STATE_OF_PLAY.md` (§4 five rulings + the
reopened Swing row, §7 items 3–4, renumbered) · `IDEAS_INBOX.md` (the Sonic HP
fork) · this file · the Systems Map.

### ⚠️ AND THIS FILE IS STACKING AGAIN — REPORTED, NOT FIXED

**§A now holds ten handoffs** (`17` down to `8-arena-fidelity`) against its own rule
that §A is ONE. 📌 `15-drawer`'s §C row still read **"LIVE — §A above"** while two
newer handoffs existed — **the exact B1 drift that already happened to
`8-arena-fidelity` in September** — and is corrected below. ⛔ **The archival pass
itself was NOT done**: moving nine handoffs out is a destructive change nobody asked
for this session. **It is worth an explicit half hour.**

---

## 16-ringbeam. The Sonic projectile, decided — 2026-09-13

Alex, on the sonic rework preview: *"Instead of 'chevrons' lets use rings that
build out into a beam-like shape. The rings should move more fluidly like the
waveform instead of the zig zag patterns."* Built, dialled in by him on the
page, and **signed off**: *"This was the best version by far."*

⭐ **THE PROJECTILE IS NOW A DECISION, not a proposal** — recorded at its own
address as `PROJECTILE_COMBAT_DESIGN.md` **§12.1c**. ⛔ **Still nothing in
`src/`.** The port is one pass and its brief is
`.scratch/sonic-rework/RING_BEAM_BRIEF.md`.

**What it is.** Hoops at fixed stations along the flight path ignite in turn and
then **inflate** as the wavefront pulls away, so a beam grows backwards out of the
head — tight nose, full body, tapering tail, necking into the impact. It undulates
instead of zigzagging: a sine plus a quiet harmonic on two perpendicular axes,
with the phase advancing on the clock, so the wave runs forward *through* the beam
rather than sitting frozen while the head slides along it.

🎯 **THE CADENCE HAD TO CHANGE WITH THE SHAPE, AND THAT IS THE WHOLE FINDING.** A
smooth wave running on a staccato flight curve reads as a *wobble* — the eye reads
the tick, not the flow. `sonicFlightCurve` gained a `smooth` flag that drops the
per-leg dash-and-ease and keeps the growing legs, so the shot still crosses the
arena early and crawls the approach. ⚠️ **Total flight time is unchanged**, so
`sonicVolleyDuration` reports the same number and §12.1b's pacing table, the
result scheduling and the per-die audio stagger all still hold.

**Three rebuilds it took, each now a comment at its own site** — and each is the
generic version of a mistake, not a quirk of this shot:

1. Rings oriented to the **path's** tangent leave every hoop facing the same way
   while their centres snake between them: a corkscrew spring, not a beam. They
   have to be square to the **displaced** curve, differenced either side.
2. A **fixed hairline** band turns the beam into a wireframe drawing of itself.
   Thickness has to be a fraction of the radius.
3. Twenty additive hoops at a single stroke's opacity and lightness **clip to
   white** before the bloom pass runs, and the volley loses its tint. A beam made
   of many marks runs at about a third of what one mark can afford.

⭐ **Alex's dial-in is in the code with a date and an owner on it**, as
`RING_TUNING` in `board/sonicZigzagVisuals.js`, applied on `strokeStyle:'rings'`
alone so the call site configures nothing. 📌 **Deliberately NOT folded into
`SONIC_TUNING`**: that block is the zigzag/chevron baseline that
`sonicZigzagCheck.mjs` asserts a tested curve against, and seven anonymous numbers
in a shared defaults block read as arbitrary and get tidied. The direction behind
them, which is the part worth keeping in prose: **thinner and sparser but longer**,
brighter filament, far bigger detonation, much slower approach. **Mass came out;
contrast went in.**

### 🧪 Evidence

`sonicZigzagCheck.mjs` passes **unmodified** against the ring build — the cadence,
power ramp, mitred banding, the camera hand-off at 1/2/5/11 dice and single-dispose
are all untouched by it. New `sonicRingCheck.mjs` covers the fluid cadence **at
RING_TUNING's own slow-motion value** rather than the library default (§B2), the
nose/body/tail beam profile, determinism under seeking and single-dispose.

⭐ **And one assertion is there specifically to stop a tidy-up reverting the
look**: it builds one ring volley with no tuning and one with `RING_TUNING`
explicitly and asserts the geometry is byte-identical. **Mutation-tested** — unhook
the overlay and it goes red naming that assertion.

⚠️ **Neither suite has run inside the repo, and `test:all` did not run.** The
Linux workspace on the machine would not start again this session (*"the isolated
Linux environment on this device failed to start"* — the same wall as `5-lane.E`),
so both checks ran against a file-by-file copy, with `three` installed
standalone. The preview itself was driven headless through Playwright at each
step — real render, console clean — which is how the three rebuilds above were
found, but it is not `check:bundle` and it is not `test:all`.

### ⚠️ ONE APPROVED VALUE HAS NOWHERE TO LAND

He took the contact push-in to **0.95**, the top of the slider. In the preview
that is the page's own camera. **`arenaRenderer.js`'s `stageSonicCamera` has no
push-in at all** — it frames a static box per phase and never tightens onto the
impact. The volley module exposes `getFocus()` for exactly this, and brief §4 has
the two lines, but until they are wired **the port delivers the beam and not the
shot**. 🎯 Filed loudly rather than as a footnote: §B11 is a step whose label said
there was nothing left to ask.

### ⬅️ NEXT

1. 🔊 **The port** — `.scratch/sonic-rework/RING_BEAM_BRIEF.md`, one pass. It
   carries the whole sonic rework, not just the beam: the four earlier changes
   (readable dice, the ROLL gate, the camera fix, `diceHits`) have been sitting
   drafted and unapplied since 2026-09-13 morning.
2. 🎥 **The push-in**, above. Same pass if there is room; named in the handoff if
   not.
3. The rest of the board is unchanged and lives in `STATE_OF_PLAY.md` §7.

📌 **Systems Map:** not republished — nothing in the roster, the rules, the
bottleneck or the open decisions moved. This is a presentation treatment that is
still preview-only.

---

## 15-drawer. The last 2D panel in the arena — 2026-09-12

Alex: *"it seems like the stack commit is still using old windows — I'd like
everything to be in sync with the styling and windows"*, and then, exactly right:
*"it seems like its already built out in scratch but not imported to the game yet."*
It was. `.scratch/stack-commit-drawer.html` had been previewed and approved and
never ported. **Ported now, at the page's defaults, which is what he took.**

🎯 **WHY THIS ONE MATTERED MORE THAN IT LOOKED.** The board's two
`ChordStackPanel`s are `visibility:hidden` in 3D (`12-board`), so **this drawer IS
the Drive/Sustain interface during step 1** — every stack commit in the game goes
through the one panel that never joined the system.

What changed, all of it frame: the `#ff66cc` rounded card is a `Bracket` plated
**CHORD STACK**; each stack is its own `corner="sm"` bracket wearing its own stat's
colour and plated `DRIVE 2 / 4`; the `⚔️5` / `🛡️3` emoji readouts are the same
`ArenaDial` the pocket and the board draw; the rounded `<span>` pills are real
`NoteHex`es; the note pool is a bracket plated **STOCK · 9 left**; and the buttons
are the chamfered two-clip-path chips.
🎚️ **The budget stopped being a sentence.** "3 commits left" was a row of its own;
the count is now three segments on the frame line, in the same grammar as the phase
rail's bars and VIBE's pips. The hint text survives — the *number* moved.
🪦 **And the `STEP 1 — CHORD STACK` title line is retired, on the chord step only.**
The bracket's nameplate says it one line lower. ⚠️ Steps 2 and 3 still need that
element, so the condition is on the step, never on the element.

🐛 **THE BUG IN THE SCREENSHOT WAS ONE CSS LINE, AND IT IS NOW GONE BY CONSTRUCTION.**
`MatchSurface.jsx` gives the chord/melody turn region `padding:0; background:none;
border:0` — correct for a note stock that brings its own frame, and the reason the
old title and card sat flush against the column's left edge at x=12. A framed card
needed no CSS change at all: **the frame is the gutter.**

🪦 **TWO IMMERSIVE OVERRIDES DIED WITH THEIR TARGETS** — the rules that softened the
pink card's radius and filled the note pool's box. Both are brackets now: no border,
no radius, no fill, so the rules had nothing to soften and would only have bolted a
border back onto a frame that draws its own corners. 🎯 **The drawer needs no
immersive special-casing at all**, which is the whole point of putting it in the
system.

⚠️ **THE BUTTON LABELS ARE A TEST CONTRACT, AND I NEARLY BROKE THEM.** The preview
said *"Continue to melody"*; `clientJourneyCheck` **and** `clientBattleJourneyCheck`
both click that button with `textContent.includes('Continue to Melody')`, in both the
budget-left and budget-spent states. Lowercasing it to match the mockup would have
taken out two suites. **The strings ship verbatim and the chip renders uppercase
through CSS `text-transform`, which does not touch `textContent`.** 📌 The same trick
is what lets every label in here be restyled safely; do not "tidy" these to match
what is drawn.

⚠️ **The new CSS is UNSCOPED on purpose.** This drawer renders in both layouts, and
the bracket language is now the game's language in both — scoping it under
`[data-match-layout="immersive"]` would have left the 2D board wearing the panel the
arena just retired.

⁉️ **OPEN, AND IT IS A ONE-WORD FIX.** The sub-frame's nameplate says `DRIVE` and the
button inside it also says `DRIVE`. That is the said-it-twice this file has already
deleted twice (the chord stacks' inline titles in 2026-08, the key plate's root
badge). It shipped because it is what Alex approved on the page, and it is not mine
to change silently — but the button wants to be the *verb*, not the noun.

Verification: the ported block was **lifted back out of the monolith verbatim** (194
lines) and rendered through React SSR in four states, rather than a retyped copy —
28 assertions, all green. Both tutorial anchors (`drive-btn`, `sustain-btn`) and
`stack-note-grid` present; both journey suites' `Continue to Melody` lookup satisfied
in **both** states; `.step-active` intact for the beginner glow; no `border-radius`
and no `#ff66cc` anywhere; three nameplates; budget segments lighting 3/2/1/0 across
the states; two `ArenaDial`s; committed notes rendering as `NoteHex`es with the new
typeset accidentals; the pool correctly hiding spent slots and counting `9 left` from
11 minus 2. Measured in the real 238px pocket: **176 / 325 / 328 / 187px** against
666px of room at 1080p. ⚠️ On a 644px-tall window the armed state (325px) exceeds its
306px and scrolls — it does not break, but it is the state to watch.
⚠️ **The suites themselves still could not be run** — same two walls. 🎯 **`npm run
test:journey` and `npm run test:battlejourney` first: they are the two that click
this button.**

---

## 14-accidentals. Two glyphs in a hex built for one — 2026-09-12

Alex, on the step-1 drawer preview: *"the flats along with the note letter look way
too cramped in the hex space. We mayhaps need to make notes smaller for sharps and
flats?"* He was right, and it was two separate things.

🙈 **HALF OF IT WAS MY PREVIEW LYING.** `.scratch/stack-commit-drawer.html` drew the
letter at **44px with a 5px `paint-order` stroke** where the shipped chip uses **34px
with a drop-shadow glow and no stroke**. So he judged the crowding through a chip a
third too large and visually fatter than the game's. 🎯 **A preview that misdraws the
component is worse than no preview** — it does not merely fail to answer the question,
it invents a different one, and he spent a look on it. The page is corrected and its
`noteHex` now carries the shipped numbers with a comment saying why.

⭐ **THE OTHER HALF SHIPS, AND IT SHIPS EVERYWHERE.** `NoteHex.jsx` drew the letter at a
constant `fontSize={34}` whatever the note was. `PITCH_INDEX` accepts nineteen
spellings and **ten of the twelve pitch classes can carry an accidental**, with
`NOTE_POOL` sharp-side by default — so this was the stock, the eight track seats, the
twelve stack seats, the flying chip and the burst, not one panel. **Maximum length is
two**: no double accidentals and no `C#/Db` combined strings, so the fix only ever
places one extra glyph.

🎛️ **SHIPPED: the typeset pair**, chosen from a four-way preview
(`.scratch/note-hex-accidentals.html`) over a uniform shrink, a condense and real ♭/♯
glyphs. Alex's dial-in: **`accScale 0.60 · accRise 4 · accKern -1`**. The letter stays
34px and the accidental becomes a smaller raised mark beside it.
🎯 **THE RULE IT ENCODES IS THAT A TWO-GLYPH NOTE IS NOT A SMALLER NOTE.** A uniform
shrink — the obvious fix, and the one he first proposed — makes an `Ab` read as the
lesser note beside a `C`, which costs a grid of chips its rhythm and is worst in the
stock, where they sit in rows.
⚠️ **THE SQUEEZE IS PURELY HORIZONTAL, WHICH IS THE WHOLE REASON THIS WORKS.** Measured
on the preview in the real face: a plain letter spends ~44% of the bracket ring's 55.8
of clearance and a two-glyph note 75–82%, while the hex's VERTICAL room goes almost
unused. `accRise` spends the axis with room to buy back the axis without.

🐛 **THERE WERE TWO HARDCODED `34`s, AND THAT IS THE FINDING.** `NoteHex.jsx:295` was
the chip's letter; `:205` was **the burst's lifted copy**, the one that peels off when
you commit. Fixing only the first would have made the note change size at the exact
instant of the click — a glitch in the animation the game most wants to feel solid.
Both now go through one module-local `noteLetter`, so they cannot drift again.
📌 **This is §12-board's lesson for the third time in four handoffs** — *replacing a
thing means finding every mount.* The amp knob, the step-1 drawer, and now this.

⚠️ **THE ACCIDENTAL TEST IS A WHITELIST, NOT `length > 1`.** `letter` is not always a
note — the staggered seat passes `⚡` (`rlsw-simulator-v3_8_1.jsx` ~11548) — and a
length test would have silently typeset anything new as "a letter plus a mark".
📌 ♭ and ♯ are in the set even though nothing spells notes with them today, so
switching them on later needs no second edit.

🎯 **`textContent` IS DELIBERATELY UNCHANGED.** An `Ab` is now two `<text>` nodes and
still reads `Ab`, which is what keeps `arenaFallbackCheck`'s pocket regex and every DOM
journey suite green. Asserted, not assumed.

⁉️ **OPEN — real ♭/♯ glyphs.** They are narrower and stop `Ab` reading as the word
"ab", and `notes.js`'s own comments already think in them ("the blues ♭7", "always a
♯4"). ⚠️ But Saira Stencil One is a display stencil face and may not contain them, in
which case the browser swaps a second typeface in for that one mark. **My sandbox
blocks Google Fonts, so I could not test it** — the preview page carries a live probe
that answers it in Alex's browser. `clientRenderCheck` §5 already passes a real `G♭`,
which is worth knowing before anyone assumes the game is ASCII-only.

Verification: the ported component rendered through **React SSR and diffed attribute
by attribute against the preview's own geometry at his three numbers** — ✅ identical,
`x="55.20"`, accidental `x="65.76" y="56.00" font-size="20.4"`. Then eleven assertions
re-run against the port: `clientRenderCheck` §5 verbatim (both of its checks, on its
real `G♭`), `textContent` preserved across `C` / `Ab` / `G#` / `G♭` / `Bb` / `⚡`, the
burst's lifted letter byte-identical to the chip's, a natural still one centred 34px
text, and an empty seat still drawing no text. ✅ 11/11.
⚠️ **The suites themselves still could not be run** — same two walls as `12-board` and
`13-hud`: the 2026-09-08 Windows update stops the workspace mounting the repo, and the
cloud container holds win32 `node_modules`. 🎯 **`npm run test:render` and
`npm run test:journey` first.**

---

## 13-hud. The HUD joined it, and the line started to shimmer — 2026-09-12

The bracket pass finished. `MatchSurface` now draws its chrome the way the board
and the pocket do, and **all five frosted slabs are gone** — player card, sound
readout, turn summary, the three drawers and the note stock. The Cosmic Arena
reads straight through its own HUD: measured on the preview, chrome over the
arena fell from **~22% to ~6.5%**.

What changed, all of it frame: the phase rail is three bracket chips with their
own segment bars; VIBE is segmented like the dial, hot block at the head; the
nav buttons are chamfered chips (two stacked clip-paths, because a real CSS
border cannot follow a 45° cut); the drawers and the note stock are a flat scrim
with a chamfered edge; the action rail's buttons lost their radius.

🌊 **The melody line got its overtones and its pulse.** Alex: *"a few dimmer thin
lines, slightly different wave lengths than the main — make that shit look
magical"*, and a pulse running down the track. Three dim lines now ride the
committed run at **1.47 / 0.79 / 2.31** of the main wavelength.
🎯 **NOT ONE OF THOSE IS A ROUND RATIO, AND THAT IS THE ENTIRE TRICK.** 1.5 would
re-sync every other crest and 2 every crest, and the set would read as one thick
line breathing. Off the round numbers they never come back into phase inside the
track's width, so the interference keeps moving and never repeats — *which is the
difference between shimmer and a pattern.*
⚠️ Only the main line threads the seats; the overtones are the air around it.
🫀 The pulse is a short bright dash repeating every wavelength on its own copy of
the main line, sliding **faster** than the swell beneath it, so it reads as a
glint running down the track rather than the line moving. ⚠️ It is a dash on a
TRANSLATED path — never an animated `stroke-dashoffset`, which repaints the
region every frame over the live WebGL arena.

⚠️ **FOUR PIECES OF TEXT IN `MatchSurface` ARE TEST CONTRACTS** and the restyle
had to route around all four: the pocket's `…VIBE 4/5…DRIVE6…SUSTAIN3…Db8…FANS5`
run, the phase rail's live step matching `/BUILD CHORD/i`, the turn summary's
`9 notes available`, and — the sharp one — `arenaFallbackCheck` finds the Spirit
button with `el.textContent === 'Spirit'`, so **nothing else may ever go inside
those buttons**, not an icon and not a counter.

🐛 **A backtick inside `SURFACE_CSS` ends the template literal.** A CSS comment
written with code ticks round \`backdrop-filter\` silently terminated the string
and the build failed with `Expected ";" but found "backdrop"`. Comments in there
use plain quotes now. Cheap to fix, baffling to read.

Verification: **all seven of `arenaFallbackCheck`'s assertions were re-run
verbatim in a real DOM** — its phase check, its pocket regex, its summary regex,
its exact-textContent button lookup, the region count, plus a computed-style
check that the player frame really has no backdrop filter. ✅ Seven for seven.
The wave was checked across four animation frames to confirm the overtones
actually drift rather than lock.
⚠️ **The suites themselves still could not be run** — same two walls (the
2026-09-08 Windows update on the workspace, win32 `node_modules` in the cloud).
🎯 **`npm run test:arena` and `npm run test:journey`, first.**

---

## 12-board. The board panels joined the system — 2026-09-12

The bracket language went from the pocket to the board. Previewed first, in two
scratch pages Alex picked from (`.scratch/cosmic-arena-hud.html`,
`.scratch/melody-and-chord-stacks.html`), then built.

⌐ **`ui/Bracket.jsx` is new, and it is the arena's one frame primitive** —
corners bright, edges nearly dark, 45° chamfers, a flat scrim instead of frost.
🎯 **It is not a new shape.** It is `NoteHex`'s own corner-bracket ring, squared
off and scaled up: every note chip has worn that ring since Alex's 2026-08-26
dial-in. The chips had been speaking this language for a month; the containers
had not.

🐛 **AND IT CLOSED A BUG THE PREVIOUS HANDOFF OPENED.** `11-dials` replaced the
amp knob in the player pocket and **left the board behind** — `NoteCommitOverlay`
still imported `StatKnob` and drew it at `knobScale: 1.90`, so the game shipped
the new gauge at 74px and the knob it replaced at ~72px **in the same scene**.
📌 The lesson generalises: *replacing a component means finding every mount, not
the one you were looking at.* One grep for the old import would have caught it
on the day.

⭐ **`ArenaDial` gained `boost` and `size`, and the first is not polish.** The
chord stacks answer "where would this note take me" through the old knob's
`boost` channel — gained blocks white, lost blocks red. A straight swap to a dial
without that channel would have **deleted a working feature in silence**, which
is the exact shape of §B5. It is ported, same grammar.

🌊 **THE MELODY IS THE ONE THING OFF THE GRID.** Alex: *"the whole game is very
straight and mathematically symmetrical and sound. The 'sound' part should kind
of break that."* So the track's committed run is drawn as a travelling wave and
everything ahead of it as a taut, dead-straight string. **The melody is what puts
the wave in the line.**
⚠️ **THE WAVE MEASURES THE SEATS; IT DOES NOT ASSUME THEM.** The track's children
are a caption followed by eight seats in one flex row, so the seats do not start
at the row's left edge — and a wave phased to the ROW drifts by however wide that
caption rendered this turn, which at this wavelength is enough to park every note
on a crest instead of on a crossing. The notes come off their own string, which
is the single thing the wave exists to avoid. So it measures, with
`ResizeObserver` **guarded** because the DOM journey suites run this under jsdom.
📌 The travel is a `transform` on a path built two wavelengths wide, not a
morphing `d` — compositor-only, for the same reason `ArenaDial` has no filters.

🪦 **The −6° lean is retired** — Alex, *"let's do away with the 6 degree lean for
now."* ⚠️ Bringing it back needs THREE things, not one: the `skewX` on each panel
root, ONE counter-skew wrapper around the children (never two — a nested un-skew
shears the inner content the other way), and the dial left outside it. The file
header carries the same warning.

📌 **THE CHORD STACKS ARE THE 2D BOARD'S PANELS.** They are `visibility:hidden`
in the arena — worth knowing before going looking for them there. In 3D the
pocket's dials are the Drive/Sustain readout and only the melody track is on the
board.

Two one-line edits in the monolith, both frame-only: the track passes
`filled`/`total` so the wave knows its length, and the inline `TRACK` caption is
deleted because the panel's own nameplate says MELODY one line above it — the
same said-it-twice that cost the chord stacks their inline titles in 2026-08.

Verification: the ported components rendered through **React SSR against the real
`MatchSurface` and the real panel props**, with `arenaFallbackCheck`'s exact regex
re-run on the result — ✅ `DRIVE6SUSTAIN3Db8FANS5`. Every tutorial anchor
(`drive-stack`, `sustain-stack`, `commit-track`), `data-immersive-track`,
`data-stack-slot` and `.step-active` asserted present; `skewX` and
`backdrop-filter` asserted **absent**. The wave's threading was checked in a real
browser layout **with the caption present**, which is the case the naive version
gets wrong.
⚠️ **`test:arena`, `test:journey`, `test:battlejourney`, `test:render`, `lint`
and the build could NOT be run** — the desktop workspace still cannot mount the
repo (the 2026-09-08 Windows update) and the cloud shell holds win32
`node_modules`. 🎯 **Run `npm run test:arena` and `npm run test:journey` first**:
between them they own the pocket's textContent and the DOM melody journey that
walks this very track.

---

## 11-dials. The Drive/Sustain dials became gauges — 2026-09-11

Alex, on the 3D arena HUD: *"the Drive and Sustain dials look a little funny."*
They were a **skeuomorphic amp knob** — gloss highlight, inset bevel, a needle,
and a `repeating-conic-gradient` spraying spokes through the full 360°, including
the bottom 90° the 0–10 scale never uses. He asked for *"space rock Tron neon."*

⭐ **PREVIEWED BEFORE BUILT, AT TRUE SIZE, AT HIS REQUEST** — `.scratch/drive-sustain-dials.html`
(four candidates against the shipping knob) and then `.scratch/drive-sustain-dials-c.html`
(three detailings of the one he picked). 🎯 **The rule the preview enforced is
its own finding:** every candidate was drawn at the size it actually gets — the
pocket is 238px and a dial column is ~81px — because *anything that only works at
3× is not a dial, it is a poster.* Two candidates that looked good zoomed were cut
on that row alone.

🎛️ **SHIPPED: `ui/ArenaDial.jsx`.** Ten hard-edged light blocks for ten units, a
white-hot block at the head, and a chamfered frame that is **bright at the corners
and nearly dark along the edges** — a bracket, not a box, which is the only reason
it can sit behind the ring without competing with it. The label moved into the
gauge's own dead 90° at the bottom, and *that* is what paid for the ring growing
48px → 74px.

⚠️ **THREE THINGS HERE ARE CONTRACTS, NOT STYLE:**
1. 🚩 **The label's `<text>` precedes the value's.** `arenaFallbackCheck` reads the
   pocket's textContent for `DRIVE6` / `SUSTAIN3`; **SVG text counts toward
   textContent**, so the obvious source order (numeral first, it is the important
   one) reads `6DRIVE` and fails `test:arena`. They do not overlap on screen, so
   source order was free to serve the test.
2. 🚩 **No SVG filters.** The bloom is a wide faint stroke under the hot core
   stroke. A `feGaussianBlur` or a `drop-shadow` re-rasterises a filter region over
   the **live WebGL arena** every time Drive or Sustain moves.
3. 🚩 **The dial element is still the note-flight landing target.** `driveRef` /
   `sustainRef` are what `rlsw-simulator-v3_8_1.jsx:3434` aims a flying chord chip
   at in 3D. The refs, `data-immersive-stack` and `data-dial-value` all survived
   the rewrite untouched.

📌 The colours moved to **`#ff6644` / `#44aaff`** — not a free choice: those are
`DRIVE_C` / `SUSTAIN_C` from the monolith, the hues the flying note chips already
arrive in. The dial is the chip's landing target, so a chip that lands should land
in its own colour.

🐛 **One bug only one of the two dials could ever have shown**, caught in the
detailing pass: the frame's bottom edge originally kept a stub either side of the
nameplate gap. Five-letter **DRIVE** cleared them; seven-letter **SUSTAIN** ran
straight through them. The bottom edge is now not drawn at all — the corner
brackets already frame the label.

📐 Sizing is CSS (`width:100%; max-width:74px`), so the dial follows the pocket
down through both narrow breakpoints on its own. **Three hand-written breakpoint
overrides were deleted**, not ported.

Verification: the ported component was rendered through **React SSR against the
real `MatchSurface`**, and `arenaFallbackCheck`'s exact regex re-run against the
resulting pocket textContent — ✅ `DRIVE6SUSTAIN3Db8FANS5`. Screenshot-checked at
true size and at 4×.
⚠️ **`test:arena` itself, `test:render`, `lint` and the build could NOT be run**:
the desktop workspace could not mount the repo this session (a Windows update from
2026-09-08 blocks it) and the earlier half of the session hit the same win32
`node_modules` wall from a Linux shell. **They need a run on Alex's machine.**
🎯 The one to run first is **`npm run test:arena`** — it is the suite that owns the
textContent contract above.

---

## 10-pointer. The cursor became an arrowhead — 2026-09-11

Alex sent a zoomed screenshot of the pointer he wants and said the one in the
game "looks nothing like" it. He was right: `ui/GlobalCursor.jsx` drew a
**chevron** — two arms and no body — where the reference is a filled
**arrowhead**: black glass inside, a hot white rim, a cyan bloom.

The shape was **fitted, not eyeballed.** The reference is a ~5× upscale, so every
edge in it is a gradient and a sharp corner reads blunt. Measuring the outline by
eye put the tip 17px away from where it belongs and disagreed with itself at the
wing. What worked instead: isolate the reference's **black core** (clean — the
white "Riffs" glyphs the cursor sits on contaminate every bright-pixel measurement
but not the black one), then fit four vertices and a rim half-width by rendering a
candidate as a signed-distance field, blurring it to the screenshot's own blur and
maximising core IoU. It settles at **0.937**. Those decimals in `PATH` and `RIM`
are that fit; they are measurements and must not be tidied.

⭐ **The press is a bob down the arrow's own axis**, not a shrink in place. One
2.8px dip along `(0.259, 0.966)` — the tip→tail line — a small rebound, then
still, in 340ms. **Scale pivots on the TIP**, so the hotspot never leaves the
pixel the browser thinks it is on: only the body of the mark moves. The held-down
settle is a separate element from the bob so a long press keeps its dent while
the bob finishes. `prefers-reduced-motion` drops the bob and keeps the shape.

🪦 **One stroke, not two.** An inner cyan line was built and cut in the same
pass: at the size this actually renders, a second edge reads as a seam down the
middle of the rim. The blue lives in the bloom and in the rim's tint.

📌 **Two copies exist on purpose and must move together** — the component and
`public/cursors/neon-pointer.svg`, its static twin for any future `cursor:url()`.
Both say so in their own headers.

Verification: `test:arch` ✅ (it was **red before this change on two counts** —
`GlobalCursor.jsx` had never been added to `ARCHITECTURE.md`, and the doc still
named a deleted `ui/HintScreen.jsx`; both are now closed, the second into the
🪦 forwarding table). `test:engine` ✅, `lint` ✅ on the changed file.
⚠️ **`npm run build`, `test:render` and every esbuild-backed suite could not be
run** — this session's shell is Linux and `node_modules` holds the win32 native
binaries for `rolldown` and `esbuild`. They need a run on Alex's own machine.

---

## 9-immersive-hud. Space-saving live HUD — 2026-09-09

Alex approved the second immersive HUD study for the game. Its composition is
now live in 3D mode: a 238px upper-left player pocket carries portrait, Vibe,
Drive, Sustain, Db and Fans; chord/melody controls unfold directly below it; the
existing melody track floats independently over the board; and Step 3 uses a
shallow centered action dock. Turn/Spirit/Rivals tabs live at upper right and the
camera strip at lower right. The board remains the largest surface in every step.

This is still one live control tree. MatchSurface only arranges disclosure and
read-only summaries; the client retains every handler, tutorial anchor, note
flight endpoint and action permission. The 2D layout is unchanged. At phone
width the board stays above the mounted drawers and the camera controls condense.

Verification: browser review at desktop Chord and Melody states and 390×844;
`test:arena`, `test:journey`, `test:render`, `test:arch` and the zero-warning
bundle check pass. See `../docs/immersive-hud-handoff.md`.

---

## 8-arena-fidelity. Live preview scenery and effects — 2026-09-08

The live arena now carries the preview's authored indigo materials, fractured
island, fissures, detailed live-tier cabinets, moving spotlights/beams, planets,
48 floating rocks and seven metal shards. Movement, resolved attacks, falling
standees, status/ability pulses, tentacles and hazards have a public-state 3D
presentation layer. Game rules and original SVG input targets remain authoritative.

Alex asked for direct comparison with the scratch preview. Opened the exported
preview and live game; their GLBs are byte-identical. Removed the new bright room
reflection that washed out the palette. Matched the inspected preview lighting
(0.9 glow / 1.35 rock / 1.3 fissures), restored planet atmosphere and shards, and
instanced all 48 rocks so Standard retains the full scenery. High now explicitly
overrides Lite FX; Auto explains its effective quality in the toolbar.

Alex also requested preview gestures: left-drag orbits, right-drag pans, wheel
zooms. A six-pixel drag threshold hands capture to OrbitControls; simple clicks
retain their actual SVG target, while drag releases cannot dispatch gameplay.

Verification: full test:all passed, then targeted arena checks cover the final
palette/scenery/gesture changes. The actual GLB is tested for palette, station
binding and tier changes; privacy, effect lifetime, DOM restoration and real
WebGL failure are covered too. Browser checks exercised melody, commit, 7 → 16
for one AP, 2D recovery, detail/camera controls and a live laser show. Build and
zero-warning bundle checks pass; Vite retains its large-chunk advisory.

The renderer remains hybrid: ordinary characters and tactical overlays are flat
SVG above the scene. Full character models, tactical depth occlusion and bespoke
animation for every ability are future work. See ../docs/cosmic-arena.md.
The external Systems Map artifact tool is unavailable; repository docs are current.
Previous structural handoff: ../docs/archive/SEQUENCING-hud-2026-09-07.md.

---
# B. ✅ Alex's two calls

1. ⭐ **ANY BODY BLOCKS.** A live spirit, an amp or the 👤 decoy stops the draw
   dead. This is the searcher's policy of the three, promoted to the only one —
   so the client click gets **stricter** than it was, and a shot that worked
   yesterday can be refused today. That is the point: it is what makes standing at
   range 2 a defence, and what makes parking the decoy in front of a Ronin worth
   doing.
2. ⭐ **BRIGHTNESS IS THE PAYOUT, AND THE LANE SHOWS ONLY WHEN ARMED.** The ramp
   carries the **+2 / +3 / +4** ladder rather than raw distance, hexes 1–2 render
   as a visibly refused run-up, and the overlay appears on arming like every other
   targeting highlight. 📌 The always-on threat line was considered and not taken —
   a permanent bright stripe competes with the hunt marker and the note hexes for
   the same attention.

### C. 🖥️ Built: the rule, with its suite in the same pass

- `engine/systems/bushido.js` gains **`bushidoBlockers({spirits, amps, shadowHex,
  selfId})`** — one set, built in one place, handed to all three callers. Self is
  excluded *there* rather than re-checked inside each caller's own loop.
- `policies/legalActions.js` builds its movement `blocked` set from it too, and
  the sharing is deliberate: a hex you cannot walk through must not be one the
  draw pretends is empty.
- The client's **highlight** was live-spirits-only and now uses the shared set.
- The client's **resolver** passed *no blocker set at all* — `bushidoLane(attacker)`
  — so a click would fire straight through a body the highlight beside it refused
  to light. It now walks the blocked lane, and it says **"Screened — the draw
  stops at the first body in the lane"** rather than *"not in the lane"*, which is
  a different sentence about a rival the player can plainly see standing straight
  ahead.

⚠️ **A BODY AT 3–5 IS NOT A SCREEN, IT IS A NEARER TARGET.** The draw retargets to
it and is paid *its* rung, not the far one — so screening a Ronin with a
throwaway body at 4 hands him a +3 instead of denying him a +4. Asserted,
because it is the difference between a defence and a donation.

### D. 🎨 The lane picture — previewed, NOT ported

`.scratch/bushido-lane-preview.html`, per `CLAUDE.md`'s standing rule. Old look
beside new look; the geometry and `bushidoLane` transcribed verbatim inside a
marked parity region (§5-glow.C); ten states including all three rungs, both
refusals, each of the three screens, the retarget, an empty lane and a lane that
runs off the board; the real 238px HUD column with the button's four states.
Levers: the ramp (near / far / gamma), edge alpha and width, bloom, run-up
treatment (dim/hatch/bar/none), stop treatment (bar/cap/none), ghosting beyond
the blocker, the spine and its taper, rung labels, the target ring, pulse, hue.
⛔ **Nothing is ported until Alex screenshots the panel.**

### E. 🧪 Evidence — and what was NOT run

`test:bushido` **91 → 108**. `test:legal` 581 · `test:shukuchi` 68 ·
`test:transition` 257 · `test:turnflow` 73 · `test:battleflow` 65 ·
`test:score` 122 · `test:trace` 1205 — all green, all re-run because
`legalActions.js` moved.

⚠️ **AND HERE IS WHAT WAS NOT RUN, PLAINLY.** The Linux workspace on the machine
would not start this session (*"the isolated Linux environment on this device
failed to start"*), so those suites ran against a **file-by-file copy** of the
source, and **`test:all`, `check:bundle` and `lint:baseline` did not run at
all.** The monolith was verified to transpile through esbuild with zero
warnings, which is weaker than `check:bundle` and is not a substitute for it.
🎯 **Run `npm run check:bundle` and `npm run test:all` before trusting these
counts** — §B3 and §B7 are both about numbers nobody re-ran.

📌 `test:determinism` could not run in that copy either: it reads
`ui/fanPawnShape.jsx`, which was not among the copied files. An environment gap,
not a red suite.

### F. ⬅️ NEXT

1. 🎨 **Lane port complete in the resumed pass above.** The next engineering
   guard is a completed client battle journey before combat orchestration moves.
2. 🤖 **Re-bench the Ronin** — overdue twice, and now three times: this changed
   what the searcher may plan.
3. The rest of the board is unchanged and lives in `STATE_OF_PLAY.md` §7.

📌 **Systems Map:** republished 2026-09-05 from this session, same URL.

### G. 🪦 Two stale lines, reported rather than edited around

- `RONIN_ABILITY_DESIGN.md` §2.1.1's "now" column still says **unlock 8 Db** and
  **Drive bonus +3 flat**. The game ships **6 Db** (the flat rule) and the
  **+2/+3/+4** ladder. The box above the table is right; the table is a week out.
- §3's playtest bucket still calls the Shamisen's unlock price *"the one number
  Alex has not given."* The flat-6 rule answered it on 2026-09-04f.

⛔ **Both left as found**, per `CLAUDE.md`: a session that quietly edits a doc it
was not asked to touch is how two copies of one decision start.

---

# B. 🎓 THE FINDINGS — what this project has learned the expensive way

⚠️ **THESE ARE NOT HISTORY. Every one is a live defence**, and most are the
reason a specific test exists. A session that does not know them re-learns them
at full price — which has already happened more than once.

### B1. 🪦 A doc that reads as current and is not is worse than no doc

`ARCHITECTURE.md` called `engine/` a *"~300 line scaffold"* for months while it
grew into the whole game, **because nothing could tell.** That is why
`test:arch` exists and why it is the only machine-checked doc: it asserts the map
names every module, points at no file that does not exist, and lists no export
that is not real.

📌 **The other design docs have no such check**, which is why they are to be read
with suspicion — including whichever one you are reading now.

### B2. ⛔ A passing test is not evidence a rule is real

`legalActionsCheck` §15 was green **for months** against a skill-purchase mechanic
the game does not have — because the test was written from the same
misunderstanding as the code. 🎯 **When checking whether the engine matches the
game, read the CLIENT (`rlsw-simulator-v3_8_1.jsx`), not the test.**

### B3. 🪦 A suite no script runs is not a suite

`b0check` was quoted as green in every handoff for months while **nothing ran
it**, and five riff test files carrying **132 assertions** had never been wired at
all. ✅ Write a check, give it a script in the same pass, add it to `test:all`.

### B4. 🎲 A threshold on one seed passes on luck

`harnessCheck` §9 asserted `max(owned) > 2` on a single seed. Measured: **only 20%
of seeds have a seat that passes it.** Seed 4242 was one of the lucky one in five,
so it broke on the first unrelated change and looked like a regression that was
not one. ✅ Aggregate over fixed seeds with a wide margin.

⚠️ **And the replacement was mis-calibrated too** — set from a duel bench and
applied to a trio. **A finding can be a property of the measurement rather than of
the game**, which is the single most expensive mistake available here.

### B5. ⛔ A cut can run past its own end with every suite still green

The 2026-08-26 Shamisen rework removed a feeding block — and took **the last two
lines of the melody commit and the whole `startNewTurnNotes` function** with it.
No move phase after a commit, no cards dealt next turn, **all eighteen suites
green throughout.** `test:client` exists because of this. ✅ Delete in small
steps, with `test:client` and `check:bundle` between them.

### B6. ⚠️ The obvious fix can undo the previous session's biggest call

Waking four dead flags by re-granting their skill ids would have **silently
deleted the colour payout** — those same ids widen `keyScale`, and a wider palette
means fewer notes need pardoning, and the pardon *is* the payout. ✅ The two jobs
were split at their own sites, and `b0check` now guards the revival.

### B7. 📏 A warning that is always there is indistinguishable from one that never matters

`check:bundle` sat at **"6 warnings" for months. All six were real** — import
paths whose CASE did not match the file on disk, which Windows resolves and the
Linux box Render builds on does not. ✅ **The count is the check: non-zero is a
failure, not scenery.**

### B8. 🎯 Read the payout table, not the formula

Psycho Bushido's bonus was `apLeft − distToTarget`, which paid **most** for a
charge of zero hexes — *"the ability rewarded standing still and called it
lightning."* Alex caught it by reading what it paid, not what it said.

### B9. 🪦 A decision filed in the wrong doc reads exactly like no decision *(2026-09-04)*

The Ronin's full kit respec — including an entirely new ability — was captured
correctly and in detail on 2026-09-02i, **in `UPGRADE_SHOP_DESIGN.md`, a pricing
doc.** For two days the canonical Ronin file went on calling the old kit "FIRM
DECISIONS" and had never heard the word *Shukuchi*. **Neither doc was wrong on its
own facts; the failure was one of ADDRESS.** ✅ `IDEAS_INBOX.md` and
`STATE_OF_PLAY.md` exist because of this one.

### B10. 🧊 While the kit is in flux, imbalance is information, not a defect

**Alex, 2026-09-04.** Do not open a session proposing to rebalance a character.
`UPGRADE_SHOP_DESIGN.md` §0⃣.4 is the standing instruction. ⚠️ **The exception:**
a change that makes something *impossible* rather than merely weak — an ability
that cannot fire, a purchase nobody can make, a flag that can never be true. Those
are bugs wearing balance's clothes and B6 is what they cost.

### B11. 🏷️ A step labelled "unblocked" is read as a step with nothing to ask *(2026-09-04f)*

Both `STATE_OF_PLAY.md` §7 and `SEQUENCING.md` §5-hopport.F called step (c) *"a
pure number edit, ✅ no longer blocked."* It carried **three** live decisions —
an unlock price the flat-cost rule already voided, a brand-new Drive-stack cost
its own doc says *"nobody has costed"*, and a duration cut that turns the exact
dial §6.3 warned about. All three were correctly written down, in the right doc,
in the right section.

🎯 **§B9 IS ABOUT A DECISION FILED AT THE WRONG ADDRESS. THIS IS THE SAME FAILURE
AT THE RIGHT ONE.** The ⬅️ **NEXT** arrow outranked the paragraph underneath it,
because a reader looking for what to do next stops reading at the label.
✅ **The defence is the decision board**, which reads the whole set at once and has
now found something new on all three of its runs — and, this time, found it inside
the very step it was standing next to.

### B12. 🎸 The safe-looking convention can be the drifting one *(2026-09-04f)*

Psycho Bushido's new Drive-stack bill was first written to take notes off the
**back** of the stack, to avoid re-pointing the player's hunt as a side effect of
an attack. The reasoning was sound and the conclusion was backwards: **every Swing
in the game already spends off the front**, and `music/stackSlots.js` documents
that as the design's own way of re-pointing a hunt. Taking from the back would
have put two directions on one stack inside a single action.

✅ `test:bushido` now asserts the direction **against `SWING_DRIVE_SPEND` itself**
rather than against a literal, so the two cannot diverge in silence.
📌 And the check found the ability's real price while it was there: a draw costs
**4** notes of Drive stack, not 2, because the strike at the end of it is a Swing.

### B13. 🏷️ A discrepancy "preserved on purpose" still needs an OWNER *(2026-09-05)*

§5-refactor found that one ability answered *"what stops the lane?"* three
different ways — the client click passed no blockers, the highlight passed live
spirits, the searcher passed spirits + amps + the decoy — and **wrote it down
correctly, in the right file, in the right words**, then preserved it rather than
resolving it inside a refactor. That instinct was right. What was missing was one
sentence: **whose call is it?**

🎯 **§B9 IS A DECISION AT THE WRONG ADDRESS; §B11 IS A DECISION UNDER A LABEL THAT
SAYS "NOTHING TO ASK"; THIS IS A DECISION WITH NO NAME ON IT.** All three are the
same failure — a fact that is true, findable and correctly filed, and still does
not reach the one person who can settle it. A discrepancy that is deliberately
kept is a **decision waiting for its owner**, and it belongs on the board.

✅ The defence is `bushidoCheck` §7: the counting assertion
(`bushidoLane(` calls vs blocked ones) makes a *fourth* answer impossible to add
in silence, and three of its checks read the CLIENT source rather than the
kernel, because the split lived in the half no headless run reaches (§B2).

---

# C. 📇 THE INDEX — 40 handoffs, in `docs/archive/SEQUENCING-full-through-2026-09-04.md`

Newest first. **Search the archive by the section id in column 1.**

| id | date | what it did |
|---|---|---|
| `17-riffoff` | 2026-09-14 | **LIVE — §A above.** 📊 Alex's 2D **attack axis grid** recovered and verified against the code (§13), a sixth column — **miss cost** — added. 🎤 The **Riff-Off is a BET, not an attack**, and it runs on the **melody line**, not Drive — which the code already did. 🎼 **Note strength solved without a new judgement** (§14.9): dud / plain / strong / hook, all from arithmetic the commit already performs — hands decide IF a note fires, the melody decides what it WEIGHS. ⭐ Two rulings: the first caller keeps their advantage; the duel reads the craft run's LENGTH while the Fame cap stays a Fame cap. 🎓 **And the fifth's rationale was recovered from Alex before it was lost** — it is stronger than the tonic to push chord changes, which makes `endingDb` a lever on the chord economy and existed in no file. 🚩 Three findings: riff-off Vibe still on the legacy `marginToDamage`; a `committedMelody` clear that is documented but could not be found; `endingDb` unnamed and uncommented. ⛔ **Design only — nothing built, and the Swing question it opened with is still unanswered** |
| `16-ringbeam` | 2026-09-13 | Still written out in full below §A. ⭐ The Sonic projectile decided — the **ring beam**, dialled in by Alex on a live preview and signed off. ⛔ Nothing in `src/`; the one-pass brief is `.scratch/sonic-rework/RING_BEAM_BRIEF.md`. ⚠️ The approved contact push-in still has no home in the renderer |
| `15-drawer` | 2026-09-12 | Still written out in full below §A. ⌐ The step-1 stack-commit drawer joined the bracket system — the last 2D panel in the arena, and the one every stack commit goes through. 🐛 The flush-left gutter bug fixed by construction. ⚠️ Nearly broke two journey suites by lowercasing a button label the mockup had restyled |
| `14-accidentals` | 2026-09-12 | ♯♭ A two-glyph note is TYPESET rather than shrunk — the letter holds 34px, the accidental is a smaller raised mark. 🐛 Two hardcoded `fontSize={34}`s, the second on the burst's lifted letter. 🙈 And the finding that cost the least and taught the most: **my own preview had misdrawn the component**, so half the reported problem was not in the game |
| `13-hud` | 2026-09-12 | The HUD joined the bracket system and all five frosted slabs went; 🌊 the melody line gained three overtones at deliberately non-round ratios and a pulse train. 🐛 Source of the backtick-in-a-template-literal lesson |
| `12-board` | 2026-09-12 | ⌐ ⌐ The bracket language reached the board: one `Bracket` primitive, both chord stacks, the melody track. 🌊 The melody drawn as a wave — the one thing deliberately off the grid. 🐛 Closed `11-dials`' own leftover: the board was still drawing the amp knob it had replaced |
| `11-dials` | 2026-09-11 | 🎛️ 🎛️ The 3D arena's Drive/Sustain dials redrawn from an amp knob into a Tron segment gauge. ⭐ **Previewed at true size before any code moved**, which is what cut two candidates that only worked zoomed |
| `10-pointer` | 2026-09-11 | 🖱️ 🖱️ The pointer redrawn from Alex's reference as a filled arrowhead with a press bob. ⭐ **The shape was fitted numerically, not traced** — a blurred upscale cannot be measured by eye. Also closed two long-red `test:arch` rows |
| `9-immersive-hud` | 2026-09-09 | Still written out in full below §A — the space-saving live HUD. |
| `8-arena-fidelity` | 2026-09-08 | Still written out in full below §A. Preview materials/scenery, live rigs/FX, explicit quality and preview camera gestures. ⚠️ Its row read **"LIVE — §A above"** until 2026-09-11, two handoffs after it stopped being §A — the exact drift B1 is about, found while filing `10-pointer`. |
| `7-immersive-hud` | 2026-09-07 | Structural handoff archived in `../docs/archive/SEQUENCING-hud-2026-09-07.md`. |
| `6-arena-live`, `6-arena`, `5-lane` (resumed) | 2026-09-05–06 | Prior live handoffs preserved in `../docs/archive/SEQUENCING-before-immersive-hud-2026-09-07.md`: arena study, live integration, lane port and verification. |
| `5-lane` | 2026-09-05 | Archived in the 2026-09-07 handoff snapshot. The board's fourth run (14 calls, 2 newly named, both inside 🗡️ Bushido); ⭐ **one occupancy policy — ANY BODY BLOCKS**, shared by the click, the highlight and the searcher; the lane previewed as a payout-graded glow |
| `5-refactor` | 2026-09-05 | Windows verification, DOM turn journey, shell/crowd extraction and shared Bushido geometry/payment. ⚠️ Its preserved three-way targeting split became `5-lane`'s first decision |
| `5-draw` | 2026-09-04f | The board's third run (15 calls, 3 of the 5 new ones found INSIDE the step marked unblocked); 🗡️ Bushido respecced to a 3–5 draw with the ladder, a flat 3 AP bill and a Drive-stack price; 👤 Illusion respecced; ⭐ **the flat unlock number answered — 6, for everything** |
| `5-hopport` | 2026-09-04e | The board run a second time (11 calls, 5 newly enumerated); ✅ Bushido's +2/+3/+4 ladder settled; 🌀 Shukuchi's overlay PORTED and SSR-diffed at 80 assertions; the searcher's hop un-refused |
| `5-hopui` | 2026-09-04d | The decision board's first run; ✅ per-activation Db and ✅ per-hop targeting settled; Shukuchi's overlay previewed and parity-probed at 896 assertions |
| `5-hop` | 2026-09-04c | 🌀 Shukuchi BUILT HEADLESS. 1 AP a hop turned it from a movement turn into a movement mode; two canaries fired and both were right |
| `5-cut` | 2026-09-04b | 🪦 Wa no Koe DELETED; the three suites that stood on it inverted into a revival guard, and the Ronin ledger filed |
| `5-flags` | 2026-09-02i | Four dead melody flags ungated; the chromatic pardon fires 19.4% under the searcher, not the 1% the comment claimed |
| `5-ident` | 2026-09-02h | The melody-identity arm opened — four verbs (Kata/Dissonance/Loop/Hook), one motif detector instead of thirty rules |
| `5-glow` | 2026-09-02g | The hunt marker — the hex holding your next stack seat lights up. Three bugs caught in verification, only one in the port |
| `5-seats` | 2026-09-02f | 🅰️ **Theory came off the tree.** Stack seats 4–6 found on the board; the pardon ladder went universal and free |
| `5-bands` | 2026-09-02e | 🎸 **Battle of the Bands BUILT** — elimination as its own axis, playable from `runMatch` |
| `5-window` | 2026-09-02d | The scaled Fame window |
| `5-win` | 2026-09-02c | 🏆 The win conditions — how a match ends became a setting |
| `5-fans` | 2026-09-02b | The fan re-weight; the seeded-stream mechanism that makes harness counts move |
| `5-race` | 2026-09-02 | The race → margin change. ⚠️ **Source of B4's lesson** |
| `5-fame` | 2026-09-01 | The Fame instrument |
| `5-clean` | 2026-09-01 | The clear-out |
| `5-hud` | 2026-08-29 | The step-3 rail. ⚠️ Also holds the original **§0–§2 ordering thesis** that got buried after it |
| `5` | 2026-08-29 | The HUD cuts, and a strip on a preview |
| `5-aug28c` | 2026-08-28c | The tilt, the honeycomb, the burst |
| `5-aug28b` | 2026-08-28b | The commit chips and the flight |
| `5-aug28` | 2026-08-28 | The note-commit overlay, wired in |
| `5-aug26b` | 2026-08-26b | 🐛 **The Shamisen rework REPAIRED** — source of B5, the most expensive lesson here |
| `5-aug25b` | 2026-08-25b | The Shamisen built. 🪦 **Now void** — the ability has changed verb twice since |
| `5-aug25a` | 2026-08-25 | The Shamisen settled, design only |
| `5-aug22c` | 2026-08-22c | The per-use Db + cooldown rule, applied across Intergalactic 0 |
| `5-aug22b` | 2026-08-22 | 🗡️ **The Ronin foundation** — `cooldowns.js`, the general cooldown system |
| `5-aug22a` | 2026-08-22 | The rule, design only |
| `5-aug21` | 2026-08-21 | The clutter pass |
| `5-aug20pm` | 2026-08-20 | Evening. ⚠️ **Source of B8** — the Bushido sign flip |
| `5-aug20am` | 2026-08-20 | Day |
| `5-aug19` | 2026-08-19 | — |
| `5-prev` | 2026-08-18 | Evening |
| `5-day` | 2026-08-18 | Day |
| `5-late` | 2026-08-17 | Late |
| `5-eve` | 2026-08-17 | Evening |
| `5-am` | 2026-08-17 | Morning |
| `5-old` | 2026-08-17 | ✅ The evaluator can see a fight |

📌 **The original 2026-08-15 ordering thesis** — §0 *the diagnosis: three docs, one
deferral loop*, §1 *where the loop breaks*, §2 *the order*, §4 *the stop rule* — is
in the archive at its old line ~1347. ⚠️ **It is largely spent**: it sequenced the
bot / Metalness / Theory arms, and Theory has shipped while the bot and Metalness
are both parked. Read it for the *stop rule*, not for the order.
