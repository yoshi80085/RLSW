# SEQUENCING — 🧭 what order the three open arms get built in

> **For AI editors + Alex.** Three design docs are open at once and each one
> cites the other two as a prerequisite. This doc pins the order, states the
> evidence for it, and names the single step that breaks the apparent cycle.
> Written 2026-08-15 out of a design conversation. Companion to
> `BOT_STRATEGY_HANDOFF.md`, `METALNESS_REWORK_DESIGN.md`,
> `THEORY_ROUTES_DESIGN.md`.
>
> ⚠️ **This doc settles ORDER, not CONTENT.** It does not decide a single rung,
> ability or eval weight. Where it says "settle X first" it means the decision
> is cheap and constrains everything downstream, not that the answer is here.

---

## 5-clean. 🧭 START HERE — session handoff, 2026-09-01 (the clear-out)

**Three cuts, all Alex's call, all landed. `npm run test:all` green, `check:bundle`
at zero warnings, and `test:arch` green for the first time in weeks.**

### 🪦 1. The Rock God is ARCHIVED, not shelved

He had been shelved behind `ROCK_GODS_SHELVED` since 2026-08-18. He is now DELETED:
`data/rockGods.js`, `engine/systems/rockGod.js`, `board/rockGodFx.js`,
`ui/RockGodLayer.jsx`, `hooks/useRockGod.js`, the `state.rockGod` slice, the seven
`GOD_*` actions and creators, the `rockGodActive` view flag, the `summonRockGod`
hook, the bot's boss-converge branch, the lobby's difficulty dial, the Testing
Grounds boss panel and every assertion that covered any of it. The design survives
at `docs/archive/ROCK_GODS_DESIGN.md`, headed with what it is and is not.

**⚠️ THE ONE RULE CHANGE, and it is the whole point.** Reaching the Fame target now
crowns you outright at ANY margin. Both copies of `grantFame` — the engine's
(`systems/battleFlow.js`) and the client's (monolith, `FAME POINTS`) — lost their
close-race branch. That branch is what produced "I was on ⭐27/21 and the finishing
screen never came" (2026-08-19, §5-aug19): the summon was a ONE-WAY DOOR, and
`rockGod.summoned` then gated the Fame win forever after. There is no door now.

**📌 THE HORIZON IS RECLAIMED FOR REAL.** `matchConfig`'s three-life default was
already restored on 2026-08-18, but the comment above it still explained the
two-life era as a live constraint. It is history now, and `play.js` says so.

**One survivor, and it is cosmetic.** `FAME_RACE_CONTESTED_LEAD` (3) in
`data/gameConstants.js` replaces `ROCK_GOD_RUNAWAY_LEAD` at the two places it
picked a COLOUR — the Fame meter's red state and the spirit card's "🔥 NECK AND
NECK" badge (was "🤘 ROCK GOD WATCH"). Nothing mechanical reads it. Retune freely.

### 📖 2. How to Play is GONE, to be rebuilt from the ground up

`src/tutorial/content.jsx` (1,159 lines) deleted, with the HOW TO PLAY entries on
`TitleMenu.jsx` and `Lobby.jsx` and the `showTutorial` branch in the app shell.

⚠️ **THE ANCHORS ARE STILL LIVE AND STILL LOAD-BEARING.** The `data-tip-anchor`
attributes scattered through the monolith and `ui/` are shared with 🎓 Beginner
Mode, which was NOT touched. So the "four tutorial pages point at this name"
comments in `ActionRail.jsx`, `ChannelStrip.jsx`, `ScoreTrackOverlay.jsx` and the
monolith are still true — of the tips. Do not delete an anchor on the strength of
the tutorial being gone.

Two Beginner tips were rewritten rather than left teaching a dead mechanic: the
note-stock "only the Rock Gods know" line, and the fame-bar page that warned about
the finale.

### 🧹 3. General cleanup

Dead strays, unreferenced modules and stale docs — see §5-clean.C below.

### 📌 Suites, and every count that moved

| suite | before | after | why |
|---|---:|---:|---|
| legal | 582 | 577 | −5: the `rockGodActive` PvP-off block. No state suppresses the attack family wholesale any more. |
| harness | 1663 | 1662 | −1: `HARNESS_GAPS.summonRockGod`, a declared gap for a subsystem that no longer exists. |
| determinism | 22 | 20 | −2: `freeNeighborHex(seeded)`, which lived in the deleted `board/rockGodFx.js`. **And `MATH_RANDOM_BUDGET` 44 → 43** — the boss taunt draw left with him. It is cosmetic; the pin is documented in the file. |
| arch | ❌ | ✅ | was ALREADY red at session start — `ui/FameRace.jsx` and `ui/TopMenu.jsx` (both landed 2026-08-31) had no rows. Both written up properly. |

Every other suite is identical. `engine`, `eval`, `transition`, `turnflow`,
`battleflow`, `melody`, `slime`, `eleven`, `score`, `riffparity` (127,598),
`skilltree`, `shamisen`, `client`, `render`, `b0`, `riff` (70,970), `trace` (1,834).

### 🎯 NEXT

Unchanged from §5-hud: **measure the real client's strip column.** `ChannelStrip.jsx`
claims 238px at every width; the shipped declarations say the flex row breaks below
532px. One of the two is wrong and the rail is sized against it.

Then: rebuild How to Play. It starts from nothing, and the anchors are the map.

---

## 5-hud. 🧭 session handoff, 2026-08-29 — the step-3 rail

**Landed.** Four HUD changes that are one design, dialled by Alex on
`.scratch/hud-step3-rail.html` and ported at his readout values:

1. **The action rail moved up** — out of the bottom of the HUD column (below the
   RACE meter, the Note Stock and every rival row) to directly under the spirit
   card. Physically moved in the JSX, not pulled up with flex `order`, so tab
   order still matches reading order.
2. **The buttons rake and grew** — shear −8°, a 5px `tl-br` chamfer, 33px tall,
   12px text, a `currentColor` wash and bloom so each button glows in its own
   hue. New module `ui/ActionRail.jsx`; the CSS lives under `.arail` in
   `GameStyles.jsx` and reads custom properties that module sets.
3. **UNIVERSAL | SIGNATURE split** — left is the move set every Spirit has,
   right is what this one owns. ⚠️ *Signature ≠ unlocked*: the Monster's Slime is
   innate and sits right, because the question is "mine or everyone's". Blaster
   of Ra sits LEFT — it replaces the Smash rather than adding a button, and the
   slot is universal. Both calls are argued in `ActionRail.jsx`.
4. **The Note Stock became a drawer in the KEY plate**, step 3 only. Steps 1–2
   keep the full panel, because there the grid is the surface you click. The
   grid node is **hoisted and rendered in both places** rather than rebuilt, and
   the `note-stock` tutorial anchor moves with the content — never two copies.

**The one real finding.** Making the plate step-aware turned up that the two
halves of "the key" flip at different moments: `melodyCommit` writes the track's
last note into `rootNote` at COMMIT, while `turnFlow` derives the mode at TURN
START. So step 3 has always shown next round's root against this round's mode,
with nothing saying so — the letter changed under the player silently. The plate
now prints both halves of the next key from the commit onward, behind a
`↻ NEXT ROUND` badge.

**Still open.** `ChannelStrip.jsx` claims the strip column measures 238px at
every viewport width. Probed against the shipped declarations, the card's flex
row breaks below **532px** (286 basis + 238 portrait + 4 inset + 4 border), so at
the documented `minmax(430px,480px)` track the strip and the portrait should
STACK. Alex's screenshots show them side by side. ⚠️ One of the two is wrong and
it was not resolved this session — **measure the real client before trusting
either.** It matters: the rail is sized against the column, and a rail dialled at
560 wraps to more rows at 480.

---

## 0. The diagnosis — three docs, one deferral loop

Read the three sequencing notes side by side and the shape is obvious:

| Doc | Says it is blocked on |
|---|---|
| `BOT_STRATEGY_HANDOFF.md` §4.3 | *"Do not tune his eval weights against the other two until [Metalness's innate] lands."* |
| `METALNESS_REWORK_DESIGN.md` §5 | *"He still has nothing musical… Monster's tritone route is the intended fifth piece."* |
| `THEORY_ROUTES_DESIGN.md` §4 | *"Metalness's innate lands first… a theory route on a half-finished character measures the design gap rather than the route."* |

That reads as a cycle — bot needs character, character wants theory, theory needs
character — and it is the reason the work feels stuck. It is not a cycle. Two of
those three arrows are real dependencies and one is a wish.

⚠️ **The deeper pathology is worth naming, because the ordering below only
treats the symptom.** All three docs open with *"NOTHING HERE IS IMPLEMENTED."*
Design is running ahead of implementation on three fronts simultaneously, which
is precisely the condition under which every front can point at another one as
blocking. The cure is not to pick the right front to design harder. It is to
ship the smallest implemented thing that makes one of the docs falsifiable.

---

## 1. Where the loop breaks, and how we know

**`METALNESS_REWORK_DESIGN.md` depends on neither of the other two.** All four
abilities in §4 — Tentacle, Slam, Master of Moshpits, Goes to 11 — are board and
combat, built on the trail-as-currency spine in §3. Nothing in them reads the
melody commit. The theory route is listed in §5 under *open questions*, as a
**fifth piece**, i.e. an addition to a kit that is already coherent without it.

**And the arrow points the other way, in the text.** Monster's Theory route is
written *against* the rework's mechanics, rung by rung:

- Tier 1 **Diabolus** — *"a tritone on the track feeds the slime — a longer
  trail, or the next trail hex bites harder — see `METALNESS_REWORK_DESIGN.md`."*
  It cannot be specified, let alone costed, before the trail is a currency.
- Tier 2 **Power Chord** reads `modeFromStack`; tier 3 **Drop Tuning** reads B8's
  `newRootRaw`. Both are hooks, not inventions — but the *character* reason to
  hang them on him ("vertical and dark") came out of the Metalness work.

So the Theory doc's route content is downstream of the character. §2d makes the
same point by accident: it designs a complete ladder for **Riff Rat**, who is
not in the bot doc's roster scope at all (§0.5 — three Spirits, Glamarchy in
`IN_DEVELOPMENT`). Designing theory for characters that do not exist yet is the
failure mode already starting.

### 1.1 The distinction that makes "Theory first" half-right

Theory has two layers and only one is blocked:

| Layer | Blocked on characters? | Do it |
|---|---|---|
| **Architecture** — §1's split (shared capacity spine + per-Spirit branch), §0.3's rule (*a rung pays for a gesture, not forgives a mistake*), renaming `dom7`/`modes`/`chromatic` off the slots, the fate of the four `discord_*` rungs | **No.** All Spirit-agnostic. | Now. It is a decision, not a build, and it constrains every rung written afterwards. |
| **Content** — the twelve rungs across four Spirits | **Yes.** | After the characters. |

Conflating these two is what makes the problem feel circular. The architecture
layer is the trunk and it has no dependencies.

### 1.2 The premise that is only half true

*"I can't get a good bot program on a character that isn't developed."*

§4.3 says do not **tune** Metalness's weights. It does not say the searcher
cannot be **built**. `legalActions`, `evaluate`, `applyBotAction`, `beamActions`'
missing `score`, expectimax, the opponent-reply mode, and the §6.6 harness are
all character-agnostic machinery. The bot arm has substantial unblocked work
that waits on no design decision at all.

---

## 2. The order

> Steps 1–2 are infrastructure and outrank all three design arms. Steps 3–6 are
> the arms themselves. Step 4 runs in parallel with 1–3 — it is an instrument,
> not a consumer.

### 1. ✅ Rewire `confirmNoteTrack` onto the melody-commit kernel — **DONE 2026-08-15**
`BOT_STRATEGY_HANDOFF.md` §7 already called this the top open item. It ranks
above the design work for a reason that has nothing to do with tidiness:
**Theory routes ARE commit-phase mechanics.** Every rung in
`THEORY_ROUTES_DESIGN.md` §2 lands in the same arithmetic that was, until today,
duplicated between `systems/melodyCommit.js` and the monolith and guarded only
by a tripwire. Building Theory content on top of a forked economy would have
roughly doubled both the cost of the rewire and the surface it could drift on.

See §3 for what actually landed.

### 2. ✅ Lock Theory's ARCHITECTURE only — **DONE 2026-08-15**, `THEORY_ARCHITECTURE.md`
`THEORY_ROUTES_DESIGN.md` §1 and §0.3, plus the three open questions in §5 that
are structural rather than per-Spirit:

- Does the shared spine stay at three rungs, or compress to two?
- Do the four `discord_*` unlocks survive as shared rungs, or does Devil's
  Interval become Monster's tier 1?
- Is `theory_sus` the template for every rung rather than a stray? (It is the
  one existing rung that already pays for a gesture.)

⚠️ ~~Renaming the three slot rungs is part of this step.~~ **CLOSED — it is a
LABEL change, not an id change.** The ids are in the replay contract; the names
were never blocking anything, because branch rungs get new ids anyway. See
`THEORY_ARCHITECTURE.md` §3.3.

**Deliverable: a page. Not a build.** — `THEORY_ARCHITECTURE.md`.

⚠️ **The step turned up a correction that changes the rework's premise.** The
routes doc's §0.1 claim — that the three rungs are "storage" with the idea
deleted and the name kept — is false: `CONTEXT_TIERS` gives each of them a
pardon tier as well as a slot and a palette step, and the names are accurate to
the tier. §2c's "two tiers nobody owns" is false for the same reason. Both are
corrected in place. The diagnosis that survives is **stronger**: the rungs are
not empty, they are GENERIC, so the commit phase is the one place four
characters are indistinguishable.

Locked: two ladders; three spine rungs (slot + diatonic palette); the `literal`
pardon stays on the spine because B4's colour payout hangs off it; the
diatonic/chromatic line is the split line, so the four `discord_*` rungs become
branch tier-1s; the horizontal detectors go to the branches; **ids are kept and
labels rewritten**, which delivers §1a's intent at zero migration cost.

### 3. Land Metalness's innate + kit
`METALNESS_REWORK_DESIGN.md` §2–§4. This is the loop-breaker: it depends on
neither of the other two arms and it unblocks both.

⚠️ Two things in that doc are ordering hazards and should be settled while
building rather than after:

- **§5's trail counterplay.** The trail becomes his movement network *and* his
  attack platform *and* his Slam fuel. A resource with three uses and no contest
  is a resource rivals can only avoid.
- **§6's `beamActions` note.** Cone-from-each-trail-hex multiplies his Swing
  branches by trail length. `beamActions` caps at 5 per kind but its `score` is
  still `null`, so it would keep an arbitrary first five — which quietly makes
  the Tentacle look bad in exactly the searcher that is supposed to evaluate it.
  That makes step 4 a *co-requisite* of this one, not a successor.

### 4. ✅ **DONE 2026-08-16** — the §6.6 harness AND `beamActions`' `score`
**In parallel with 1–3.** This is the instrument, and it is upstream of all
three arms rather than downstream of any:

- §5's weight table is *"starting points to be tuned by the §6 harness, **not**
  measurements."*
- §7 on the Smash: *"tuning the Smash before anything has played 2000 matches is
  tuning blind."*
- `THEORY_ROUTES_DESIGN.md` §4.3: the harness *"is what turns 'feels better'
  into evidence."*

It is unblocked — `applyBotAction` and `commitMelodyEconomy` are both in, and
§6b.1's caveat is lifted, so a win rate that moves when melody length changes is
now measuring strategy rather than a blind spot. It is also character-agnostic:
you do not need Metalness finished to build the instrument, only to read it.

~~⚠️ The unranked beam is the nearer half of this step.~~ ✅ **BOTH HALVES
LANDED** — `policies/actionScore.js` (`npm run test:score`) and
`policies/play.js` (`npm run test:harness`, `npm run bench:bot`).
**70.7% over 1749 decided matches, ±2.1 points; the bar was ≥60%.**
⚠️ **SUPERSEDED 2026-08-17 — that run contained no fighting and charged nothing
for attacking. Current: 56.3% ±4.5 over 469 decided. See §5.0.**
See `BOT_STRATEGY_HANDOFF.md` §6.6 for what the number does and does not cover —
the short version is that it is evidence about the SEARCHER, not a balance
reading, because every bench match is played on base kits.

⚠️ **And the co-requisite in §3 was discharged in the direction it mattered.**
The `beamActions` note was the half of step 3 that could not wait for step 4 —
the Tentacle's branches multiply with trail length, so an unranked beam would
have made the ability look bad in the very searcher meant to evaluate it.
Closed. §5's trail counterplay is still open and still an ordering hazard.

🧭 ~~The instrument now exists, which moves the bottleneck.~~ ✅ **SKILL_TREE
EXTRACTED, same day** — `data/skillTree.js`, `npm run test:skilltree`. Unlocks
are live in the bench, so Metalness's rework is finally something the searcher
can play rather than something it is blind to.

⚠️ **Handing the engine a real tree armed three gates that had never fired**,
one of which was pinned wrong by a passing test — see `BOT_STRATEGY_HANDOFF.md`
§6.6.1. Worth reading before trusting any other "the engine mirrors the client"
claim in this repo: all three hid the same way, behind a rule that lived only in
a JSX render condition.

🧭 **What is left on the bench's critical path is now the Smash.** §7's "the
Smash punishes you for having a good turn" is the oldest open balance question
here and it is the one thing the harness still cannot see, because `smash` and
`blaster` are UNMODELLED in `transition.js`.

---

## 5. 🧭 session handoff, 2026-08-29 (the HUD cuts, and a strip on a preview)

> 🪦 **THREE SECTIONS CAME OUT OF THE COLUMN BESIDE THE CHARACTER CARD**, at
> Alex's call, and each was a different kind of dead weight worth naming:
>
> 🎴 **MOD CARDS / TRANSPOSE** — a control that existed to rescue a bad opening
> hand, in a game whose opening hand is DEALT to guarantee a playable one. A fix
> for a problem the design already prevents, so it could only ever be pressed by
> someone who did not need it. Gone from the client end to end: the HUD banner,
> `MOD_CARD_DEFS`, `playModCard`, `resolveTransposeCard`, the pick-a-note banner,
> and the tutorial page that named it.
> ⚠️ **THE ENGINE SIDE IS STILL THERE AND IS NOW INERT.** `economy.js` seeds
> `modCards: [starter-transpose]`, `turnFlow.js` refreshes it every turn,
> `melodyCommit.js` still clears `transposeCardPending`. Nothing sets or renders
> any of it. Removing that is an engine change with suite coverage
> (`turnFlowCheck`'s mod-card refresh section) and wants its own pass — it was
> deliberately NOT done as a drive-by inside a HUD edit.
> 🐛 **AND IT LEFT A DEAD EARLY-RETURN IN THE COMMIT PATH.** The Transpose
> intercept sat at the top of `clickNoteStock` and could no longer fire. An
> unreachable `return` there is the exact shape of the 2026-08-26 Shamisen bug
> (§5-shamisen below): a branch nobody can enter reads as a branch somebody
> might, and the next person would have had to prove it dead all over again.
> 🪦 **THE TUTORIAL PAGE WENT WITH IT.** A tip that names a control which is not
> on screen is worse than no tip — the player hunts for it, fails, and stops
> trusting the rest.
>
> ✨ **STYLE (Shred / Groove / …)** — a label with no mechanism behind it as the
> game stands. A word that changes nothing does not earn a titled section.
> 🌳 **SKILLS** — a LIST of things whose buttons are already on screen below. A
> menu of the menu.
>
> 🎛️ **WHAT GOES BACK IN IS ON A PREVIEW PAGE, NOT IN THE CLIENT —
> `.scratch/hud-channel-strip.html`.** The card is the player's amp head and that
> column is its channel strip: a **turn rail** (three lamps, one lit in its own
> step's colour, each carrying its own one-line state) over a **key plate** (root,
> mode, the interval map), with DB Progress as a meter at the foot. Drawn against
> the card's REAL proportions — a fixed 238px portrait column and whatever is
> left — because judging a strip on a blank page is how you ship one at the wrong
> width, and against the real `StatKnob` geometry rather than an approximation.
> 🎯 **AWAITING ALEX'S NUMBERS.** Rail shape / lit style / lamp height / gap /
> glow / off-depth / substate / numerals · plate style / root size / bevel /
> interval layout / mode line · strip width / section gap / faceplate / rivets.
>
> ⚠️ **I GOT A JUSTIFICATION WRONG AND CAUGHT IT BY CHECKING THE MARKUP.** I
> wrote — into the client, in a comment — that the interval legend
> (`4th=G 5th=A tri=G#…`) was trapped inside the step-2 panel and invisible during
> step 1. It is not: it is gated `turnStep !== 'move_act'`, so it is up in BOTH
> building steps. The real complaint is smaller and still stands (it is a wrapping
> row of 7px text under the step panel, so it reads as that panel's footnote, and
> it does vanish in step 3), and the comment now says so. 📌 **If the plate ships,
> the inline row must be DELETED** — two copies of a legend is worse than either.
>
> ✅ **GREEN.** `check:bundle` 0 warnings · `client` 6 · `render` 8/8 · `arch` 8 ·
> `determinism` 22 · `turnflow` 73 · `melody` 159 · `engine` selftest.
>
> 🎛️ **THE STRIP IS BUILT — `src/ui/ChannelStrip.jsx`**, at the values Alex
> landed: chamfered lamps 35px with a 4px gap, lit both (edge + fill) at 50%
> glow, off-depth 56%, plain numerals, substate on; engraved plate, root 30px,
> bevel 55%, intervals in two columns, mode line on; section gap 12, faceplate
> 75%, rivets on, DB meter at the foot, **tilt -4°**. 📌 I argued for tilt 0 and
> he looked at both and chose -4, so -4 ships — recorded because it contradicts
> the "the HUD is a column of square cards" reasoning I wrote a message earlier.
>
> ⚠️ **ONE OF HIS VALUES COULD NOT SHIP, AND IT WAS MY MISTAKE THAT HE SET IT.**
> He dialled STRIP WIDTH to 286px. MEASURED at viewport widths 720 / 980 / 1440 /
> 1600 / 1920: the card is **480px**, the portrait column **238**, and this column
> **238** at every single one. (The HUD grid is `minmax(430px, 480px)` and takes
> its 480 max at every width tested — the 430 floor never actually occurs, the
> board column absorbs the difference.) **My preview page mocked the card wider
> than the card is** — the exact failure CLAUDE.md's "show it in the real
> container" rule exists to prevent, walked straight into, and it cost him a
> dial-in against the wrong geometry. The strip flexes to the column instead.
> 🎯 To actually get 286 the HUD grid's max must go 480 → 528 and the board gives
> up 48px. That is a real trade and it is Alex's call, not a fix to apply quietly.
>
> ✅ **AND THE PORTRAIT KEPT ITS ROOM** — which is what he asked to be sure of.
> 238px before, 238px after, card 480 before and after, verified by measuring the
> rendered client rather than by looking at it.
>
> 📌 **THE STRIP IS SHELL-ONLY**, the same split as `NoteCommitOverlay.jsx`: every
> number and every "which step is live" rule arrives as props from the client, so
> a mistake in the chrome can misdraw a lamp but cannot reach the turn state.
> The rail's three substates read the HUD's own numbers — `stackCommitsThisTurn`
> against `STACK_COMMIT_BUDGET`, `melodyLine.length` against the 8 seats, and the
> engine's `moveStepsLeft`. ⚠️ If one of them ever disagrees with the panel it
> names, the panel is right and the rail is the bug.
>
> ⚠️ **STILL OWED: DELETE THE INLINE INTERVAL LEGEND.** The plate now shows
> `4th / 5th / tri / M3 / m7` permanently; the wrapping 7px row under the step
> panel still shows the same five. Two copies of a legend is worse than either
> one — that row goes in the next pass.
>
> ▶️ **NEXT.** **(1) Delete the inline interval legend** now the plate has it. **(2) The valve-amp
> direction for the stacks and track** — bezel wells on the empty seats and a
> single light source (`SKIN.bezel` / `SKIN.light`, both dialled at 0 today), the
> track as a luminous baseline rather than a row of sockets, faceplates darker
> than the board. Discussed, not designed. **(3) The engine-side mod card
> removal.** **(4) The other half of `test:render`** — still nothing drives a
> click.

## 5-aug28c. 🧭 session handoff, 2026-08-28c (the tilt, the honeycomb, the burst)

> 🎆 **THE COMMIT REGION NOW MATCHES THE PREVIEW PAGE.** Alex asked for three
> things by name — "spinning, glowing notes", "the HUD is slanted", "notes in
> the Stacks are staggered so they all can fit nicely" — and all three were
> layout and FX that §5-aug28b had not reached.
>
> ✅ **THE PANELS LEAN.** `skewX(-6deg)` on the commit track, the payout router
> and both chord stacks, straight off the preview's TILT slider.
> ⚠️ **ONE UN-SKEW LAYER, NEVER TWO.** Each panel stands its contents back up
> exactly once (`Unskew`, and a flex-row variant inside `CommitTrackPanel`
> because the track's children are flex items of the panel itself). Nest a
> second and the contents come out sheared the other way. The preview page
> carries the same warning beside the same line, which is how I knew to look.
> 📌 The dial is deliberately OUTSIDE the un-skew: at 6° a knob leaning with its
> faceplate is the point of the slant.
>
> 🔷 **THE CHORD STACKS ARE A HONEYCOMB, NOT A ROW** — `StackNest` +
> `stackSeatPos`. A column steps 0.78× the chip box across and odd columns drop
> 0.45× down, anchored to each panel's OUTER edge so both stacks grow away from
> the dial in the middle.
>
> 🐛 **AND THAT RETIRES THE 58px FUDGE §5-aug28b SHIPPED.** Last pass I shrank
> the stack chip from Alex's dialled 72 to 58 with an arithmetic justification:
> six 72px chips need 447px and the panel has 368px. The arithmetic was right and
> the conclusion was wrong — **the preview never laid them in a row.** Interlocked,
> six 72px seats are 353px. 🎯 **THE GENERAL LESSON: when a dialled number does
> not fit, check whether the LAYOUT was ported before deciding the number was
> wrong.** It also un-does the `knobPad` patch — the mirrored nest is what keeps
> the Sustain dial off the first committed note, which is how the preview solved
> it in the first place.
>
> ✅ **THE BURST IS IN — `NOTE_BURST` in `NoteHex.jsx`, keyframes in
> `GameStyles.jsx`.** A note flares as it leaves your hand and flares again as it
> seats: white core, flash rim, the letter lifting away, and the bracket ring
> taking three 120° detents with an overshoot it settles back from. That spin is
> the "spinning notes" — the preview's IDLE STEP is off, so a chip at rest does
> not turn; it turns when it is committed.
> ⚠️ **THE BURST IS DRAWN INSIDE `NoteHex`'s OWN `<svg>`, not in an overlay.**
> That is what puts the core BEHIND the chip's rings and the flash IN FRONT, and
> what makes one burst correct on a 67px hand chip and a 72px stack seat with no
> scale factor anywhere. An overlay can do neither.
> 📌 Only the "overdrive" preset is ported, because that is the one selected. The
> other three (magic / shockwave / starburst) add rings and spokes and are not
> taste calls that were made.
> 🐛 **The departure flare takes `borderC`, not the chip's live hue** — the commit
> marks the slot used in the same tick, so by render time the chip is already the
> empty-socket grey and the flare would have been grey with it.
>
> ✅ **`NOTE_FLIGHT.launchDelay` IS BACK TO ALEX'S 289ms** (849 × 0.34). It was 0
> for exactly one session because the delay exists to be covered by the departure
> burst, and the burst was not ported. It is now.
>
> 🕳️ **AN EMPTY SEAT IS A SOCKET, NOT AN ABSENCE.** Caught by SCREENSHOTTING the
> port, not by reading it: empty seats were being dimmed to 30–50% opacity ON TOP
> OF NoteHex's own `dull`, and two reductions stacked leave a ring you cannot
> see — the stacks read as "one note and some padlocks". One `SOCKET_HUE`
> (`#2a1a50`, the preview's), dimmed once.
>
> 🎯 **THE VERIFICATION METHOD IS THE REUSABLE PART.** `.scratch/_shotpage.jsx`
> dumps the SHIPPED client through React SSR as a standalone HTML page, and
> `.scratch/_burstpage.jsx` does the same for a row of chips mid-burst. Rendered
> in a headless Chromium they can be measured and LOOKED AT — the seat offsets
> came back 56.2 / 32.4px, identical to the preview's. ⚠️ Two harness quirks:
> the bundler stubs image assets, so the stage art must be pointed at
> `.scratch/_board_bg.jpg` and the blend layers hidden before screenshotting;
> and the page keeps a timer alive, so node needs killing rather than waiting.
>
> 🐛 **`determinismCheck` COUNTS THE LITERAL CALL TEXT ANYWHERE IN THE MONOLITH,
> COMMENTS INCLUDED.** A comment explaining why the burst key does NOT use a
> random draw spent two of the pinned 44 draws and failed the suite. Worth
> knowing before someone spends an hour hunting a draw that does not exist.
>
> ✅ **GREEN.** `check:bundle` 0 warnings · `arch` 8 · `render` 8/8 · `client` 6 ·
> `determinism` 22 · `engine legal eval transition turnflow battleflow melody
> slime eleven score harness riffparity skilltree shamisen b0 riff trace` —
> riffparity 127598, riff 70970, harness 1663, trace 1834, unchanged.
>
> 🔴🔵 **AND EACH PANEL NOW WEARS ITS OWN STAT'S COLOUR.** Drive is outlined and
> glows red, Sustain blue. Both were being forced to `#ff66cc`, the stack-commit
> accent — survivable while the panels also appeared outside step 1, but they are
> gated TO step 1 now, so the `isChordStep` override was unconditional and the
> two panels were the same pink box at opposite ends of the board. The outline is
> the only thing that says which stack you are looking at from across the screen.
> 📌 The coloured shadows FOLLOW the black one rather than replacing it: the
> panel sits on a lit board, and a coloured glow with nothing dark underneath
> just reads as more neon.
>
> 🎼 **THE COMMIT TRACK IS STEP 2 ONLY**, the same argument as the stacks. Two
> things used to ride along inside it: the "✓ N hex" movement hint (the HUD says
> it in three other places during step 3, the Move button included) and the ZOOM
> RESET — which now has its own permanent home beside the Tone button, because a
> control for panning the board cannot live inside a panel that is up for one
> step of the turn. ⚠️ `clientRenderCheck` §3 changed with it: it asserted "the
> track rendered", which was true for months and became the WRONG assertion the
> moment the panels earned a step to belong to. It now asserts the GATE — stacks
> up, track not — on the step a fresh game opens in.
>
> 🐛 **THE CHORD FLIGHT HAD NO LIVE PATH AND NOTHING SAID SO.** Step 1's
> stack-commit grid (in the HUD, not the board) called `clickNoteStock(idx,
> undefined, true)` — and that second argument IS the flight, because it is the
> only way the handler learns where the note is coming FROM. So every stack
> commit landed with no animation, while the identical commit from the big hand
> flew. Since that grid is the only stack-commit control there is during step 1,
> the chord flight built in §5-aug28b had, in practice, never run once. One
> argument. 📌 The DEPARTURE flare still does not fire there — it is drawn inside
> a `NoteHex` and those 26px grid chips are still old clip-path hexes. The
> arrival flare, at the seat, does.
>
> 📏 **AND THE FLIGHT NOW MEASURES WHAT IT LEFT.** `size0` was hardcoded to
> `NOTE_HEX.size`; a commit can start from the 60px hand or that 26px grid, and a
> chip that pops to the wrong size on frame one breaks the whole illusion that
> the thing flying is the thing you touched. It reads the clicked element's rect.
>
> 🪦 **AND THE CLIP-PATH CHIP IS RETIRED — `.hexw` / `.hexi` NO LONGER EXIST.**
> The last one alive was step 1's stack-commit grid in the HUD, the pool you
> actually pick from when loading a chord, so the notes you were choosing between
> were flat tiles while the seats they flew into were glowing rings.
> ⚠️ **THE SIZE IS MEASURED, NOT CHOSEN.** The grid was rendered through SSR,
> forced to the real 238px HUD column, and the rows counted: 11 chips (the
> Ronin's stock, the biggest there is) at `STACK_GRID_CHIP` = 34 with the grid's
> gap of 2 come out **6 + 5, two rows, 87px** — the same footprint the old 26px
> chip had. 40 breaks it to three, and every row carries a ▲ preview strip, so a
> third row costs more than a third of the height. 📌 It is a 19px hexagon where
> the old chip drew 26 and it still reads better: a stroked ring with a halo
> carries further than a filled slab.
> 🎆 **The chain is now unbroken** — click → departure flare → flight → landing
> flare — because the flare needs a NoteHex to be drawn inside and this grid
> finally has one.
> 📌 **NoteHex.jsx's header carried the excuse and no longer does.** It said the
> clip-path classes were "still correct for the Commit Track and the two Chord
> Stacks, which are filled chips and want to stay that way." That was never a
> design position, only an unfinished port, and it read as one for two days.
>
> ▶️ **NEXT.** **(1) What is still preview-only:** the dial needle swinging from
> its pre-commit value (the preview captures the value BEFORE the stack changes
> so the needle has somewhere to swing from — that is the whole point of it), the
> per-panel headline and `RANK n` readout, lit-vs-dim sockets as a choice, the
> chip's optional bezel + directional light (`SKIN`, dialled at 0 so nothing is
> owed), the idle bracket step (dialled OFF), the note-stock hand restyle, the
> wordless coach layer and the badges. **(2) The other half of `test:render`** —
> ⚠️ NOTHING IN ANY SUITE DRIVES A CLICK, so every burst and flight in this pass
> was verified by screenshot and by reading, not by a test. `jsdom` still will not
> install on this machine.

## 5-aug28b. 🧭 session handoff, 2026-08-28b (the commit chips and the flight)

> 🎵 **THE CHIP THAT FLIES IS NOW THE CHIP THAT LANDS.** Alex reported four
> things off one screenshot; all four were the same fact wearing different
> clothes — §5-aug28 below ported the PANEL SHELLS and nothing inside them, so
> the commit region was a new box around old contents.
>
> ✅ **COMMITTED NOTES ARE REAL `NoteHex` CHIPS.** The eight commit-track seats
> and the twelve chord-stack slots were still the `.hexw`/`.hexi` clip-path
> divs — filled hexagons, 33×37, flat. That is why a note "reverted to the old
> style" the instant it was placed: it did, literally. Track seats are
> `COMMIT_OVERLAY.trackChip` (69, Alex's), stack slots are `stackChip`. Zero
> `.hexw` chips remain in the commit region — probed, not assumed.
>
> ⚠️ **`stackChip` IS 58, NOT THE 72 HE DIALLED, AND THE PREVIEW COULD NOT HAVE
> TOLD HIM.** The preview mocks a chord stack with THREE seats; the real one has
> SIX, because locked slots render greyed rather than absent. Six 72px chips need
> 447px and the panel has 368px. 58 is where the drawn hexagon matches the 33px
> chip it replaces, so the LOOK ports at the footprint the panel already had.
> 🎯 **Put a six-seat stack on the preview page and re-dial STACK CHIP** — this
> is a placeholder wearing an arithmetic justification, not a taste call.
> 📌 The inline `DRIVE`/`SUSTAIN` title and the `⚔️5` readout came out of the
> slot row to make the seats fit. Neither was lost: the `StatKnob` beside them
> already draws its own label and its own value, so both were being said twice.
>
> 🎸 **THE FLIGHT IS PORTED — `src/ui/NoteFlyChip.jsx` (new, 137 lines).** The
> old `.note-fly-chip` was firing correctly and reading as nothing: a solid
> hexagon translated in a straight line and faded out. The preview's is
> ballistic (a 95px bowed arc), it morphs from the hand chip's size to the
> seat's, its bracket ring spins 240°, and it sheds three rings along its own
> path. Web Animations API, not CSS — the endpoints are wherever the seat is,
> and a keyframe cannot be told that.
>
> 🐛 **THE OLD CHIP WAS ALSO BEING KILLED TWO-THIRDS OF THE WAY OVER.** Both
> fly calls wiped their state with `setTimeout(…, 500)` fired at launch — a
> second copy of the duration living in a different file from the animation. The
> flight is 751ms. `onDone` is now the animation reporting its own landing.
> ⚠️ **`NOTE_FLIGHT.launchDelay` IS 0 AND HIS IS 0.34.** The preview holds the
> chip while the DEPARTURE BURST covers the pause; the burst is not ported, so
> the same delay here is a chip sitting still for a third of a second, which
> reads as a dropped click. **Restore it in the pass that lands the burst.**
>
> 🐛 **THE SUSTAIN DIAL WAS SITTING ON THE FIRST COMMITTED NOTE.** `knobX` is
> measured from the panel's INNER edge — the comment said OUTER, which is what
> made it easy to miss. For Drive (panel left, dial right) that is empty space;
> for Sustain the inner edge is the LEFT edge, exactly where the slots start,
> and nothing reserved room. `COMMIT_OVERLAY.knobPad` (78 = a 38px knob at scale
> 1.90, plus its offset) is now padding on whichever side the dial is on.
>
> 🎸 **THE STACKS RETIRE WHEN STEP 1 ENDS.** They rendered through Step 2 and
> Step 3, flanking the board long after the last thing you could do with them was
> over. The gate is `turnStep === 'chord'` and NOT "the budget is spent":
> choosing to commit NOTHING to a chord ends the step just as much as spending
> all three does. Nothing is lost — the mini Drive/Sustain dials on the spirit
> already report what is in them.
>
> 🎯 **AND BOTH FLY AIMS NOW QUERY THE REAL SEAT.** §5-aug28 fixed the chord
> stack's aim and left the track's: it divided the panel width by 8 and added a
> 40px guess for the TRACK label, numbers that stopped being true the moment the
> seats changed size — which they just did. Same bug, same fix, one seam later.
>
> ✅ **GREEN.** `check:bundle` 0 warnings · `test:arch` 8 · `test:render` 8/8 ·
> `test:client` 6 · plus `engine legal eval transition turnflow determinism
> battleflow melody slime eleven score harness riffparity skilltree shamisen b0
> riff trace` — `riffparity` 127598, `harness` 1663, `trace` 1834, unchanged.
> ⚠️ `test:all` in ONE command still restarts the local VM partway (the memory
> ceiling in CLAUDE.md); the suites were run in two halves, not skipped.
>
> ▶️ **NEXT.** Still §5-aug28's two arms, minus what just landed. **(1) The rest
> of the overlay** — the departure/landing BURSTS (and `launchDelay` with them),
> the dial needle swinging from its pre-commit value, lit/dim sockets, the chip's
> bezel + directional light, the idle bracket spin, the note-stock hand restyle,
> the wordless coach layer and the badges. **(2) The other half of
> `test:render`** — a DOM, then commit a track and end a turn; `jsdom` still
> will not install on this machine.

## 5-aug28. 🧭 session handoff, 2026-08-28 (the note-commit overlay, WIRED IN)

> 🎛️ **THE OVERLAY IS IN THE GAME.** `.scratch/note-commit-overlay.html` had been
> a preview page since 2026-08-26; its geometry now renders on the real board.
> Three panels moved, and only their SHELL moved — see the split below.
>
> ✅ **`src/ui/NoteCommitOverlay.jsx` (new, 118 lines)** holds `ChordStackPanel`,
> `CommitTrackPanel`, `PayoutRouterPanel` and the `COMMIT_OVERLAY` tuning block.
> ⚠️ **IT IS SHELL-ONLY, DELIBERATELY.** Every number the panels show and every
> click they answer to stayed in `rlsw-simulator-v3_8_1.jsx` and arrives as
> `children`. The commit region is where the 26 Aug rework cut across a function
> boundary and shipped a game that could not leave turn one; a restyle that
> cannot reach the commit path cannot repeat that, and this one cannot.
>
> 🎸 **THE CHORD STACKS ARE NOW TWO PANELS, NOT ONE.** They flank the bottom of
> the board (`left/right:3%`, `width:45%`, `bottom:3%`) instead of stacking in a
> single column at `left:4`. Each carries the player HUD's own amp knob —
> `StatKnob`, magnified by a CSS transform rather than redrawn, so the geometry
> is bit-identical to the HUD's.
>
> 🐛 **THE SPLIT WOULD HAVE SILENTLY BROKEN THE FLY ANIMATION, and nothing would
> have said so.** `commitNoteToStack` aimed its chip by taking the SHARED panel's
> height and dividing by `STACK_CAP_MAX` — arithmetic that only meant anything
> while both stacks were one tall column. Two panels at opposite ends of the
> board would have thrown every chord note at the middle of the screen. It now
> queries the real `[data-stack-slot]` element, which is correct under any future
> layout. No suite covers this animation; it was caught by reading, not by a test.
>
> 🎯 **THE KNOB'S `boost` IS THE HOVER PREVIEW, and it rides state the client
> already kept.** The HUD's copy of this dial spends `boost` on live combat
> modifiers; saying that twice teaches nothing. On the board it answers "where
> would the note under my cursor take me" — the question the preview's phantom
> needle answered — by reading `hoverScale`, the exact state the STACK COMMIT
> PREVIEW block below the note stock has used for months. A second hover channel
> would have drifted out of step with that one the first time either changed.
>
> ✅ **AND THE CLIENT CAN FINALLY BE DRIVEN — `engine/clientRenderCheck.jsx`,
> `test:render`, 8 checks**, wired into `test:all` and `ARCHITECTURE.md` in the
> same pass. `Game` is now exported (one word) so a test can mount it; the suite
> renders it through `react-dom/server` against `buildTestingGroundsConfig()` and
> asserts the board came out with its panels on it. 🎯 **This is the check the
> last three handoffs asked for, and it is the half that needs no DOM.**
> `clientRefCheck` catches a missing NAME; this catches the THROW — which is what
> both August client bugs actually were.
>
> 🐛 **IT FOUND A REAL DEFECT ON ITS FIRST RUN.** Two `<filter>` elements carried
> `color-interpolation-filters="sRGB"`; React wants `colorInterpolationFilters`
> and was dropping the attribute silently, so the outline-crush filters have been
> compositing in linearRGB the whole time. Fixed.
>
> ⏳ **WHAT `test:render` STILL IS NOT.** It does not click, does not commit a
> track and does not end a turn — so the exact 26 Aug bug would still get past
> it. That half needs a DOM, and **jsdom will not install on this machine**:
> `npm install jsdom` hangs on the local VM's network the same way `npm run
> build` bus-errors on its memory. ⚠️ A partial `node_modules/jsdom` was left
> behind by the interrupted install and should be cleared before the next
> `npm install`.
>
> 🎛️ **FOUR NUMBERS IN THE PORT ARE MINE, NOT ALEX'S** — `COMMIT_OVERLAY`'s
> `knobScale` (1.90), `knobX` (44) and `knobY` (22), plus `ghostBoost`. Every
> other value was read off a control panel he set. They have sliders on the
> preview page's STACK DIAL row; they want landing.
>
> ▶️ **NEXT.** Two arms, in this order. **(1) The rest of the overlay** — the
> note-stock hand restyle, the wordless coach layer, the badges and the burst /
> flight FX are all still preview-only; only the board's three panels crossed
> over. **(2) The other half of `test:render`** — a DOM, then commit a track and
> end a turn. §8 item 5 (the **Wa no Koe replacement**) is still the biggest open
> arm and still the last Ronin ability, and it touches the kernel, its suite AND
> the client, so it is still the pass that most wants a driving test first.

## 5-aug26b. 🧭 session handoff, 2026-08-26b (the Shamisen rework, REPAIRED)

> 🚨 **THE 2026-08-26 SHAMISEN REWORK SHIPPED A GAME THAT COULD NOT LEAVE TURN
> ONE, AND ALL EIGHTEEN SUITES WERE GREEN WHILE IT DID.** Alex reported it as
> "commit options don't show, so no action can happen, only end turn". That is
> exactly what it was.
>
> 🐛 **THE BUG, EXACTLY.** The rework deleted the board-token mechanic. One of
> the deleted blocks — "FEED THE CURSED SHAMISEN" — sat in the **middle of the
> melody commit**, and the cut ran past the end of it. It took with it:
>
> - `setNoteField('cosmic_ronin', { lastMoveBudget: … })` — the shadow's legs;
> - **`setMovedThisTurn(false)` and `setAction('move')`** — the last two lines of
>   the commit, which are what hand the player the move/act phase;
> - **the entire `startNewTurnNotes` function** — the turn-start dispatch, the
>   seeded draw and the refill — while **two call sites kept calling it**.
>
> So: committing a track left the player in no action mode, and ending the turn
> threw a `ReferenceError` before the next Spirit was ever dealt a hand. Restored
> verbatim from `85dcf02` minus the feeding block, with a `⚠️` over the braces
> saying why the region is dangerous to cut across.
>
> 🎯 **NOTHING IN THE REPO COULD HAVE CAUGHT IT, AND THAT IS THE REAL FINDING.**
> `check:bundle` was clean because **esbuild reads a call to a function nobody
> defined as a reference to a global** — legal JavaScript right up until it runs.
> All eighteen suites were clean because **every one of them tests the engine and
> none of them drives the client**, which is where three-quarters of this ability
> lives. §5-aug25b below wrote that same sentence a day earlier and the next pass
> still shipped this.
>
> ✅ **SO THE CLIENT GOT ITS FIRST CHECK: `engine/clientRefCheck.mjs` —
> `test:client`, 6 checks over 41 `.jsx` files**, wired into `test:all` and
> `ARCHITECTURE.md` in the same pass. It parses every `.jsx` with espree and
> asserts that every name it reads is declared, imported, or a real browser
> global. Scope-blind on purpose (`npm run lint` is the thorough, slow version);
> it answers only the question that cost the build. Runs in ~0.4s.
>
> 🐛 **AND IT IMMEDIATELY FOUND A SECOND, OLDER CRASH.** `startSonicAttack` reads
> `atkSkills`, a local that **"clearing old clutter" (52e16a2) deleted weeks ago**
> along with the amp-tier bonuses above it, missing this one surviving use. Every
> **Intergalactic 0 Sonic Attack** threw a `ReferenceError` on that line — and only
> his, because `attacker.id === 'intergalactic_0'` short-circuits for everyone
> else. Nobody had reported it. Now reads `nsA.unlockedSkills` directly.
>
> 🧹 **THREE PIECES OF THE OLD TOKEN WERE STILL LYING AROUND** and are gone:
> `economy.js` still seeded `cursedShamisen: { hex, range, roundsLeft, touched[] }`
> (and never seeded `shamisenCurse` at all — now it does); `GameStyles.jsx` still
> carried `shamisen-sway`, `shamisen-stalk` and `cursed-by-melody`, keyframes for a
> standee that no longer renders; and `cadence.js` still explained the feeding
> phrase at length above its own tombstone.
>
> ✅ **THE ABILITY ITSELF IS CORRECT AGAINST `RONIN_ABILITY_DESIGN.md` §2.3.**
> Activation charges 2 Db and a 3-round CD through `firePatch`; `tickShamisen`
> skips `cursed_shamisen` so the curse cannot accelerate itself; the debt resets
> each round inside the round tick; the penalty hook fires from `applyVibeDamage`
> **before** the engine's damage slice, so it reads the pre-damage cooldown map;
> the glow is identical whether or not he paid. **One thing the code does that the
> doc did not say: the curse ENDS when the penalty bites.** The doc now says it
> (§2.3.3) — the code is right, the doc was silent.
>
> **Counts (all green):** engine ✓, legal 582, eval 154, transition 242, turnFlow 73,
> determinism 22, battleFlow 54, melody 159, slime 127, eleven 38, score 122,
> harness 1663, riffparity 127598, skillTree 159, shamisen 34, **client 6 (new)**,
> b0 ✓ (253506), riff 70970, trace 1834, arch 8 (160 modules, 222 paths, 516
> exports). `check:bundle` **0 warnings**.
>
> ⏳ **STILL UNVERIFIED BY ANYTHING BUT READING.** `test:client` proves the client's
> names exist; it does not prove the client *behaves*. The curse tick, the debt
> button, the penalty on a real hit and the purple glow have never been executed by
> a machine. **Play a match.** That is now the third handoff in a row to end with
> that sentence, which is itself the argument for the next item.
>
> ▶️ **NEXT — and this is a change of order.** §8 item 5 (the **Wa no Koe
> replacement**) is still the biggest open arm and still the last Ronin ability.
> But two consecutive reworks have now shipped client bugs that no suite could
> see, and the second one made the game unplayable. 🎯 **Before Wa no Koe, give the
> client a way to be driven** — even a thin one: mount `Game` headless, commit a
> track, end a turn, assert the next Spirit was dealt a hand. `test:client` is a
> spellchecker; that would be a smoke test. Wa no Koe touches the kernel, its
> suite AND the client, so it is exactly the pass that will need one.

---

## 5-aug25b. 🧭 session handoff, 2026-08-25b (the Shamisen, BUILT — 🪦 NOW VOID)

> ⚠️ **EVERYTHING BELOW DESCRIBES A MECHANIC THAT NO LONGER EXISTS.** The
> 2026-08-26 rework deleted the board token, the feeding phrase, the wander, the
> fray and the exorcism outright — see §5 above. It is kept because its
> **findings** outlived its subject: an unchanged assertion count after a real
> change means nothing was ever asserting, and three of the four bugs that pass
> shipped were in the client, where no suite could see them. That is the same
> sentence §5 above had to write again.

> ✅ **THE WHOLE REWORK LANDED — §8 ITEM 4's STEPS (a) THROUGH (f), IN ONE PASS.**
> The ability described in `RONIN_ABILITY_DESIGN.md` §2.3 is the ability that now
> runs. **§7b of that doc is the build report.** `check:bundle` **0 warnings**;
> **eighteen** suites green.
>
> 🎯 **WHAT THE CODE DOES NOW.** Feeding is `feedShamisenPhrase`, called from two
> places — the summon (off `committedMelody`) and the melody-commit hook (off
> `report.melodyLine`). Death is `!complete && !fedThisRound`, checked **only** at
> the round tick: **one executioner, not two**, so a turn where Ronin never commits
> at all is judged by the same rule as one where he committed the wrong notes.
> Reach is `shamisenRings(linksFed, …)`, derived at every read and never stored.
> The bite is `frayFromSustain`, never Vibe. Exorcism is two beats — click the
> instrument to arm, click a note to spend — gated on range and on the pitch class
> being Ronin's tonic. The cooldown is now charged when the haunting **ENDS**.
>
> 🚨 **AND THE REAL FINDING: EVERY SUITE CAME BACK BYTE-IDENTICAL.** All seventeen,
> unchanged, after a pass that changed which resource the ability attacks, deleted
> its lifespan, gave it a growing radius and added a verb the game did not have.
> ⚠️ **That is not a pass, it is a hole — and it is the SAME hole §7.5 caught with
> Sunbeam three days ago.** An unchanged count after a real change can only mean
> **nothing had ever asserted over this ability**, because it has lived entirely
> inside the 16.5k-line client monolith since it was written.
>
> ✅ **SO THE PHRASE LOGIC WAS LIFTED OUT AND GIVEN A SUITE.**
> `engine/shamisenCheck.mjs` — **`test:shamisen`, 29 assertions**, wired into
> `test:all` in the same pass (CLAUDE.md: a suite no script runs is not a suite).
> The four pure functions live in `music/cadence.js` **specifically so they could
> be tested**, rather than inline in the monolith where they would have been
> untestable by construction. ⚠️ It covers the pure half only — the tick, wander,
> bite, summon guard and exorcism click are still client-side and still
> unreachable by any harness. Stated plainly rather than assumed away.
>
> 📌 **ONE OF MY OWN ASSERTIONS WAS WRONG AND THE FAILURE TAUGHT SOMETHING.** I
> asserted that the C-rooted spelling of the phrase feeds **zero** links to an
> A-rooted Ronin. It feeds **one**: pitch classes are shared, so a stray note
> really can open someone else's phrase — it just cannot carry it past link 2. The
> assertion now pins the true behaviour and says why.
>
> 📌 **DECISIONS TAKEN DURING THE BUILD THAT THE SPEC DID NOT COVER** (§7b.3): the
> summon is **refused** when the committed track opens no link (same shape as
> Shadow Illusion's empty-guard refusal — a refusal is learnable, a silent death
> next round is not); feeding counts the mic's bonus note, like every other commit
> payout; the board token now goes **red when BOUND** and stays blue while it can
> still be starved, which is the only thing on the board that says *starving it is
> off the table now*.
>
> **Counts:** engine ✓, legal 582, eval 154, transition 242, turnFlow 73,
> determinism 22, battleFlow 54, melody 159, slime 127, eleven 38, score 122,
> harness 1663, riffparity 127598, skillTree 159, **shamisen 29 (new)**, b0 ✓,
> riff 70970, trace 1834, arch 8.
>
> 🐛 **AND THEN THE AUDIT FOUND THREE BUGS THE GREEN SUITES DID NOT SEE.** Alex
> asked "is everything OK with it then?"; reading the diff back rather than
> answering from the test output turned up three real defects — §7b.4 has them in
> full. In short: the **board token's tooltip and readout still read `sham.range`
> and `sham.roundsLeft`**, fields deleted in the same pass, so it rendered
> "undefined rings" and advertised the minor gate and the free walk-on; the
> **exorcism hex-click ate attack clicks** at the Shamisen's hex and made that hex
> unwalkable at range; and I had **documented the cooldown wrong in five files** —
> `firePatch` does still charge it at summon, and my comments confidently and
> repeatedly said it did not.
>
> 🎯 **ALL THREE WERE IN THE CLIENT MONOLITH — render, click routing, and prose —
> i.e. exactly the three-quarters of the ability `test:shamisen` cannot reach.**
> The new suite covers the phrase logic, which was the half that was already
> right. §7b.2 said that in the abstract; this is what it looks like ten minutes
> later, in the concrete.
>
> ⏳ **STILL UNVERIFIED BY ANYTHING BUT READING:** the tick, the wander, the fray,
> the starvation path, the summon refusal and the two-click exorcism have never
> been *executed*. `check:bundle` proves they parse; nothing proves they run.
> **Play a match before trusting this.**
>
> ▶️ **NEXT:** §8 item 5 — the **Wa no Koe replacement**, now the only Ronin
> ability left and the biggest of the five. ⚠️ Unlike the others it is **not
> client-only**: it touches the engine kernel (`checkWaNoKoe` in
> `melodyCommit.js`), its suite, and the bot policy. It also brings the Echoes,
> which only mean anything because cooldowns now exist. ⏳ Still design-only —
> §2.4 is firm on the *shape* (one Resonant note board-wide, Echoes reset
> cooldowns, Ronin is vulnerable in Harmony) and §3 lists six open numbers under
> it. 📌 The B10-shaped `tempDrive` bug the kernel deliberately reproduces becomes
> **moot** with the replacement — do not spend a session fixing it first.

---

## 5-aug25a. 🧭 session handoff, 2026-08-25 (the Shamisen, settled — design only)

> 📐 **NO CODE WAS TOUCHED. THIS WAS A DESIGN SESSION AND THE OUTPUT IS A SPEC.**
> `RONIN_ABILITY_DESIGN.md` §2.3 was rewritten from a sketch into a buildable
> rule set. **All six of §3's open Shamisen questions are closed.** §8 item 4 now
> carries a five-step build order (a–e) instead of "needs designing first".
>
> 🎯 **THE PHRASE ENDS ON THE 5 — IT IS A HALF CADENCE, AND THAT IS THE WHOLE
> ABILITY.** ♭3 → 2 → 1 → ♭6 → 5 hangs on the dominant and never lands. Nobody had
> noticed. It gives the curse a *reason* to keep playing, and it hands the
> exorcism its shape for free: **you end the haunting by finishing the sentence he
> refused to finish.** Stand inside its rings, **click the Shamisen, and spend
> HIS tonic from your own note pool.** Right note, foreign key, standing in the
> damage. 🎯 The same pitch is **link 3 of the feeding phrase** — Ronin plays it
> himself mid-build and resolves nothing, because he commits it *into* a melody
> while a rival spends it *at* the instrument. Same note, opposite verb.
>
> ✅ **ALEX'S CALL ON THE CLOCK DELETED A TIMER.** *"If a turn fails to feed notes
> to the Shamisen, it goes away. Once the whole sequence is completed, it doesn't go
> away unless it's exorcised."* There is now **no lifespan field at all** — feeding
> IS the lifespan.
>
> ⚡ **AND THE PHRASE CAN LAND IN A SINGLE TURN.** Feeding is the next links
> appearing **in order inside one committed melody line** — not one note per turn.
> Hold all five degrees, place them in order, and the Shamisen is **finished on the
> turn it is set down**. 🎯 **That is the whole risk curve, and the player picks
> it:** the fast route is a real feat of hand management rewarded with a fully-grown
> haunting; the slow route leaves him weak and interruptible for four extra turns,
> with his next required note public the whole time. Same ability, two games.
>
> ✅ **THE RADIUS GROWS WITH THE PHRASE — 1 → 3 rings, `ceil(links/2)`.** The bite
> never grows: **1 note of fray, always.** One escalating axis, not two. 📌 The
> board is 111 hexes and coverage goes `3r²+3r+1`, so 1 ring = 7 hexes, 3 = 37 (a
> third of the board), **4 = 61 (over half)** and 5 = 91 ≈ everywhere. 4 is the dial
> if 3 is not "wide" enough; 5 is not a number.
>
> 🎯 **THE GROWING RADIUS IS ITS OWN COUNTERPLAY, AND THIS KILLED MY OBJECTION.**
> An earlier draft of §2.3.4 *refused* a growing radius — "it moves the exit out
> from under the player walking toward it". **Wrong, because you must be INSIDE the
> rings to exorcise it.** The number that makes it dangerous is the same number
> that decides who can answer it: **the stronger it gets, the more players it drags
> into exorcism range.** Self-balancing, one number, no catch-up rule. ⚠️ Nor is it
> the resurrected *Listening → Swelling → Hunting* ladder — that grew **on a timer**;
> this grows **only when he pays**, and the growth is what exposes it. Same surface,
> opposite engine.
>
> ⚠️ **THE SHIPPED CODE ATTACKS THE WRONG RESOURCE, AND HAS ALL ALONG.** The doc
> has always said "the Sustain **stack**"; the client drains `tempSustain` (the
> pool) and **then bites Vibe**. Three different things. Settled: **fray
> `sustainStack`, never Vibe** — `frayFromSustain` already floors at one note, so
> the haunting **cannot kill anyone, it makes them killable.** 🎯 Same argument
> §7.3 made for Shadow Illusion's starvation; the same mistake refused twice.
>
> 🔧 **A CLAIM I MADE AND THEN HAD TO WITHDRAW, RECORDED BECAUSE IT MOVES THE COST
> ESTIMATE.** I first wrote that `music/cadence.js` already did the feeding match.
> **It does not.** `cadenceHints`/`detectCadence` match a **trail of one pitch class
> per turn**; feeding is an ordered subsequence **inside a single committed melody
> line**, where one turn may supply all five. Different matcher, different array —
> **new code**, small and well-precedented (`detectChromaticRun` scans within a
> track), but new. Reusable for real: `frayFromSustain`, and the tick, wander, aura,
> insen audio and `touched` mark, which all survive.
>
> 📌 **ONE CALL WENT AGAINST THE RECOMMENDATION AND IS FLAGGED AS THE FIRST DIAL.**
> The Shamisen now **spares Ronin**. That plus permanence plus feeding-ends-at-five
> makes a completed Shamisen a one-sided permanent aura whose only pressure was the
> build. `RONIN_ABILITY_DESIGN.md` §2.3.5 says plainly: if it plays oppressive, turn
> **this** first, before the fray or the radius.
>
> 🪦 **`CHARACTER_HANDOFF.md` WAS STALE AGAIN, SAME ABILITY, SAME ENTRY.** It said
> Cursed Shamisen had **"no cooldown"**; it has had `CURSED_SHAMISEN_CD = 3` since
> 08-22 — and the Shadow Illusion entry *directly above it* was updated correctly in
> that pass. Fixed. ⚠️ Caught by reading the constant, not the prose. Second time
> this file has been 95% right about this one ability, which is the dangerous kind
> of wrong.
>
> ⏳ **THREE SMALL QUESTIONS OPENED IN PLACE OF THE SIX CLOSED** (§2.3.7): what a
> 3-round cooldown means when the instrument can stand forever (proposed: it runs
> from when the Shamisen leaves the board), what a completed Shamisen does if Ronin
> is KO'd, and whether an unobtainable required note should kill the haunting.
>
> ▶️ **NEXT:** build §8 item 4 in its a–f order. ⚠️ **(e) permanence must not ship
> without (f) exorcism** — a permanent haunting answered only by the shipped free
> walk-on is either unkillable or free, and neither is the design. 📌 **(c) feeding
> and (d) the growing radius are one step in two halves**: same progress field, and
> a radius that cannot grow makes the entire build phase invisible. Step (a) — fray
> the stack instead of the pool — stands alone and is worth doing even if the rest
> slips.

---

## 5-aug22c. 🧭 session handoff, 2026-08-22c (the rule, applied)

> ✅ **THREE OPEN CALLS CLOSED, AND ONE OF THEM IMPROVED THE RULE.** Alex on Space
> is Displaced: *"Make it a 1 turn cool down. Different abilities can cool down at
> different rates."* 🎯 **That kills the exemption question outright** — "is this
> ability special enough?" is an argument with no end, "how long should this one
> be?" is a number. The strongest exemption case in the game (its own skill text
> promised "no cooldown", and the blink is the slowest Spirit's compensation for
> being slow) took a **short number** instead of a pass.
>
> ✅ **INNATE PASSIVES ARE OUT OF SCOPE** — a scope line, not an exemption. Boom
> Box, Poison Slime, crowd virtuosity and Freestyle are not things you *do*.
> ✅ **SHADOW ILLUSION KEEPS ALL THREE POP CONDITIONS** (struck / Ronin attacks /
> Ronin is attacked) — it stays a pure positioning tool. 📌 Heavier than it was,
> since the double also drains Sustain now; if it never survives long enough to
> matter in playtest, turn this dial before the drain.
>
> ✅ **INTERGALACTIC 0'S FOUR TOOK COOLDOWNS THE SAME DAY** — Displace 1, Gravity 2,
> Code Injection 2, Sunbeam 2. **7 of 13 abilities pay Db, 7 of 13 are cooled.**
> ⏸️ Metalness's four are still untouched **on purpose** — his redesign is on hold,
> and pricing a kit that may not survive it is work thrown away.
>
> ⁉️ **ONE FORK IS OPEN AND NEEDS ALEX: is 🌀 Blaster of Ra an *ability*?** It does
> not add an action — it **replaces the Smash** (`hasBlaster` branches the Smash
> button and `legalActions`' smash family), so pricing or cooling it leaves
> Intergalactic 0 with **no Smash at all** for a stretch, which no other Spirit
> suffers. That may mean the rule needs a third category — *permanent upgrade to a
> basic action* — and 🐙 Tentacle would be in it too. It is deliberately absent
> from both tables with a comment saying why. `RONIN_ABILITY_DESIGN.md` §0.5.
>
> ⚠️ **AN UNCHANGED ASSERTION COUNT IS WHAT CAUGHT THE SUNBEAM HOLE.** `test:all`
> came back byte-identical after the Sunbeam cooldown landed — which sounds like
> good news and is actually the warning: **no existing assertion touched the new
> gate.** `battleFlowCheck` **50 → 54** now proves a recharging beam does not fire,
> charges no Db, and **draws nothing off the seeded stream** — an rng draw behind a
> closed gate desyncs every replay and freezes online clients.
>
> 🪦 **A DUPLICATE CONSTANT DIED.** `SUNBEAM_DB_COST` and its three siblings were
> literals in **both** `gameConstants.js` and `battleFlow.js` — battleFlow's own
> header said to fold them in "when the monolith's copies are deleted" and nobody
> ever had. Now re-exports, one number each. ⚠️ Imported **and** re-exported on
> purpose: `export … from` binds nothing locally, and that file reads all four.
>
> 📌 **AND THE Db HOLE IS PARTLY CLOSED FROM AN UNEXPECTED DIRECTION.**
> `skillTree.js` records that killing the rig branch removed the biggest sink in
> the game, with "grow the ability tree" as the intended answer. Per-use costs are
> the other half and need no new rungs: seven abilities now draw on the same bar
> the tree does, every turn they are used. Six are still free, so it is not closed
> — but a bench's Db numbers are no longer measuring a pool with no outlet.

---

## 5-aug22b. 🧭 session handoff, 2026-08-22 (the Ronin foundation)

> ⏸️ **THREE ARMS WENT ON HOLD, AND THE REASON IS THE SAME ONE EACH TIME.** Alex:
> *"To design a bot around a game that is in flux seems like a fool's errand."*
> **Bot strategy on hold. Metalness on hold** (he is unsatisfied with the character
> and will rethink it). **Theory-off-the-ladder on hold** too. ⚠️ Do not spend a
> session on any of the three — including "while I'm here" cooldown/Db passes over
> Metalness's four skills, which is work thrown away if the kit changes.
>
> 📌 **Amps ARE already off the ladder** (confirmed — only tombstone comments left in
> `sonicRig.js`, `economy.js`, `evaluate.js`). **Theory is NOT**: the `theory` route
> still has all five rungs, and ⚠️ **its capstone is what sells the 6th stack slot**,
> so the slot upgrades need a new home before theory can move. Stacks stay upgradeable
> either way; each Spirit getting its own melody theory is the eventual shape.
>
> ✅ **SHIPPED: THE COOLDOWN SYSTEM, AND IT IS THE HEADLINE.** `engine/systems/cooldowns.js`
> — one map on the sheet (`ns.abilityCd`), one tick in `turnFlow`, one gate (`canFire`),
> one charge (`firePatch`). It replaces `psychoBushidoCd`, **which was the only cooldown
> in the entire game.** 🎯 The reason that number was 1 and not 13 is structural: a named
> `<x>Cd` field needs four separate edits before it exists, and at four edits a time
> nobody finishes. Giving the remaining nine abilities a cooldown is now a data edit.
>
> ✅ **AND RONIN'S THREE ACTIVES NOW PAY.** Bushido 1 Db / 2 rounds, Shadow 2 Db / 3
> rounds, Shamisen 2 Db / 3 rounds. **7 of 13 abilities pay Db, 3 of 13 are cooled** —
> up from 5 and 1. ⏸️ Wa no Koe was skipped on purpose: it is a passive with no moment
> of use to charge, and it is being replaced outright, so pricing it is work thrown
> away twice.
>
> ✅ **SHADOW ILLUSION'S COST CHANGED SHAPE**: 1 Drive token at summon → 2 Db plus
> **1 Sustain every turn it stands**, and it **starves** if he cannot feed it. A token is
> a price you pay once and forget; a drain is a clock you can hear running.
>
> 🎯 **SUITES — three counts moved and ALL THREE WENT UP.** Baseline §5.F⁸.
> **turnFlow 61 → 73** (mine, deliberate: one assertion about a field became three about
> the mechanism, plus ten for the drain). **harness 1659 → 1663, trace 1831 → 1834** —
> also mine, and **bisected to prove it**: HEAD alone gives 1659/1831. Both suites assert
> over the decisions a seeded match actually produces, so a Ronin who cannot always afford
> Bushido plays a different game and a few more decision points get asserted. Everything
> else identical. `check:bundle` **0 warnings.**
>
> 🐛 **AND THE REPO HAS A STALE `.git/index.lock`.** It is why `git stash` and
> `git checkout --` fail *silently* in the agent shell — no message, exit 128, no stash
> created. Nothing is wrong with the history; delete the file from a normal terminal.
> The agent shell cannot unlink, which is also why one-off probe files are quarantined in
> `_to_delete/baseline-probe-20260822/` rather than removed.
>
> ⏳ **STILL DESIGN ONLY:** Cursed Shamisen's rework (the ♭3→2→1→♭6→5 feeding sequence,
> dropping the minor-key gate) and the Wa no Koe replacement. `RONIN_ABILITY_DESIGN.md`
> §7 records what shipped; §8 has the order for the rest.

---

## 5-aug22a. 🧭 session handoff, 2026-08-22 (design only)

> 📐 **NO CODE WAS TOUCHED.** Alex's call this session was to lock the design and write it
> down, not to build it — the tree is still carrying two sessions of uncommitted work
> (§5 below), and adding a third was the wrong move.
>
> 🆕 **TWO RULES, AND THEY ARE GAME-WIDE.** *"All abilities cost at least 1 Db, and all
> abilities have some cooldown."* Measured against the client: **5 of 13 abilities pay Db
> per use, and 1 of 13 has a cooldown.** 🎯 `psychoBushidoCd` is the **only live cooldown
> in `src/`** — so this is not a tuning pass, the cooldown system is one field wide and has
> to be generalised first. Three abilities (Space is Displaced, Code Injection, Gravity
> Control) were designed *around* having no cooldown, each with a written reason; those are
> exemption calls Alex still owes, along with whether innate passives are covered at all.
>
> 🗡️ **AND THE RONIN'S KIT WAS RE-DESIGNED.** Three of his four abilities no longer match
> what ships, and **Wa no Koe is a replacement, not a rework** — the shipped one is a
> passive harmony bonus in the kernel (`checkWaNoKoe`), the designed one makes a chosen note
> Resonant board-wide and puts Ronin in a vulnerable Harmony state. They share the name and
> the 12 Db.
>
> 📄 **`src/RONIN_ABILITY_DESIGN.md` is the canonical doc** — the four abilities, the firm
> decisions separated from the playtest bucket, the measured drift table, and the open calls.
> `CHARACTER_HANDOFF.md` was updated in the same pass and the Ronin is no longer "Complete".
>
> 🪦 **ONE DOC WAS LYING.** `CHARACTER_HANDOFF.md` described Cursed Shamisen as a three-stage
> escalation — *Listening → Swelling → Hunting*, 2 rings growing to 3, a frozen aura, "spares
> Ronin" — with a paragraph justifying the freeze. **None of it has ever been in the code.**
> `SHAM_RINGS` is a constant, there is no stage field, and the thing wanders from round 1.
> Same class as the `ARCHITECTURE.md` drift below; these design docs have no `test:arch`.
>
> 🖥️ **The HUD rework is Alex's, and he will upload it.** Don't pre-empt it — but note it
> collides with the rule above, because thirteen cooldowns plus an Echo counter is a lot of
> new state wanting screen space.
>
> ⚠️ **THE UNCOMMITTED WORK IS NOW THREE SESSIONS DEEP** and none of it is this one's — the
> 28-file rig rework and the clutter pass are both still sitting there. **Commit from a normal
> terminal**, and read §5.G⁸ in the 2026-08-21 section below first: the deletions need a `git rm`
> the agent shell cannot do.

---

## 5-aug21. 🧭 session handoff, 2026-08-21 (the clutter pass)

> 🧹 **A CLEAR-OUT, NOT A FEATURE.** Alex's call this session: *"let's continue
> clearing out any old clutter, items that may be adding to the bloat of the game
> that are no longer necessary while paving the way forward."* Nothing in the rules
> moved. Ten files left the tree, one doc was renamed and told the truth about
> itself, 332 assertions got a switch, and one live bug fell out of the process.
>
> ⚠️ **UNCOMMITTED, AND NOW IT IS TWO SESSIONS DEEP.** Last session's 28-file rig
> rework is *still* uncommitted (`COMMIT_MSG_RIG_REWORK.txt` is its message, kept
> deliberately); this pass adds to it. **Commit from a normal terminal** — and read
> §5.G⁸ first, because the deletions need a `git rm` the agent shell cannot do.
>
> 🐛 **THE HEADLINE IS A LIVE DEPLOY BUG, AND IT HAS BEEN SHOUTING FOR MONTHS.**
> §5.A⁸. Six standee imports name a file whose case does not match the disk.
> Windows resolves that. **Render builds on Linux, which does not.**
> `check:bundle` has been printing "6 warnings" at the end of every run, and every
> session — this one included, until it looked — read that as noise.
>
> 🗺️ **`ARCHITECTURE.md` WAS A MAP OF A GAME THAT NO LONGER EXISTS** — §5.B⁸ has
> the measurement: it called `engine/` a "~300 line Phase 1 scaffold" when `engine/`
> is the whole game. ✅ **Rewritten in the same session — §5.H⁸ — and `npm run
> test:arch` now fails if it drifts again**, which is the part that matters.
>
> 🪦 **AND REWRITING IT FOUND TWO SYSTEMS THE MAP STILL ADVERTISED AS LIVE** — §5.I⁸.
> The Style system and the Dissonance Edge are both **deleted**, and the index was
> sending readers to five functions and a constant family that do not exist.
>
> 🔇 **332 ASSERTIONS WERE RUNNING FOR NOBODY** — §5.C⁸. `b0check` is quoted as
> green in every handoff in this file and **no npm script has ever run it.**

### 5.A⁸ 🐛 SIX IMPORTS THAT WOULD 404 ON RENDER

On disk: `cosmic_ronin.png`, `Metalness_monster.png`. In the code, six times:
`Cosmic_Ronin.png`, `Metalness_Monster.png` — in `data/spirits.js`,
`ui/GameErrorBoundary.jsx` and `ui/OpeningMovie.jsx`. Fixed to match the disk, plus
the row in `OPENING_MOVIE_HANDOFF.md` that taught the wrong spelling.

🎯 **THIS IS THE SAME BUG AS THE `App.jsx` CAPITAL-V**, which broke a deploy once
already and is written up in the rewrite log. The class repeats because the machine
the game is *developed* on forgives it and the machine it is *served* from does not:
a case-insensitive filesystem cannot tell you that you got the case wrong.

⚠️ **AND THE REASON NOBODY SAW IT IS WORTH MORE THAN THE FIX.** `check:bundle`
reported it correctly, every run, for as long as it has existed — as six warnings in
a wall of esbuild output that ends with a cheerful `⚡ Done in 1.8s`. A warning that
is always present is indistinguishable from a warning that is never important.
**`check:bundle` now ends with zero warnings**, so the next one that appears is
signal. Keep it that way; treat a non-zero warning count as a failure.

📌 `dist/` is gitignored, so the broken build was never committed — the failure only
ever shows on a fresh Linux build. If the live site currently renders standees, it is
serving an artifact built on Windows.

### 5.B⁸ 🗺️ `ARCHITECTURE.md` HAD DRIFTED — THE DIAGNOSIS

> ✅ **REPAIRED LATER THE SAME DAY — see §5.H⁸.** This section is kept because it
> is the *measurement* that justified the rewrite, and because the numbers in it
> are the before-picture. The banner it describes is gone from the doc.


CLAUDE.md's rule is that a drifted doc is worse than no doc, and that the honest move
is to say so rather than edit around it. So the file now opens with a measured
staleness banner instead of a quiet correction. What was counted:

| the doc says | reality |
|---|---|
| `engine/` is a "~300 line Phase 1 scaffold" | **11,694 lines, 29 modules** — the authoritative core |
| `engine/policies/` and `engine/systems/` | **absent entirely** — not stale, missing |
| — | **50 of 130 source modules unlisted** |
| `gameConstants.js`: "39 named constants" | **96** |

⚠️ **IT IS DELIBERATELY NOT FIXED.** A partial repair that *looked* current would be
more dangerous than a banner admitting it isn't — the drift is not a few wrong rows,
it is a missing half. Four rows naming files that no longer exist (`ampRigs.js`,
`useNoteSystem.js`, `RiffBanner.jsx`, `riffLibrary.js`) were removed so it cannot
send anyone to a path that isn't there, `AMP_RANGE`/`AMP_LINK_DIST` were struck, and
the `engine/` row was rewritten. Nothing else was touched.

🎯 **THE PART WORTH SAVING IS THE "WHERE DO I CHANGE X?" INDEX** near the bottom.
That is the single most useful thing in the repo for a cold start, and it is broadly
still accurate. A rewrite should be built outward from it.

### 5.C⁸ 🔇 THE 332 UNWIRED ASSERTIONS, AND `npm run test:all`

| suite | assertions | ran how, before today |
|---|---|---|
| `b0check.mjs` | 200 `assert`/`ok` calls, 55 reported groups | **by hand, never in a script** |
| `riff/arrowHighwayEngine.test.mjs` | 14 | nothing ran it |
| `riff/guitarMap.test.mjs` | 29 (70,970 fuzzed) | nothing ran it |
| `riff/neonNeck.test.mjs` | 43 (253,506 fuzzed) | nothing ran it |
| `riff/riffArchetypes.test.mjs` | 21 | nothing ran it |
| `riff/riffPerformance.test.mjs` | 25 | nothing ran it |

All six pass today. **That is luck, not evidence** — nothing was watching them, so
a break would have sat there until somebody happened to run the file by hand.
They are now `npm run test:b0` and `npm run test:riff`.

🎯 **AND `npm run test:all` EXISTS NOW.** CLAUDE.md demands the full sweep before
anything is reported as done, and the full sweep was seventeen hand-typed commands —
which is exactly how a suite goes unwired in the first place. One command, seventeen
suites, fails on the first red.

📌 **`dbaudit.mjs` moved to `.scratch/`**, where the probes live. It asserts nothing,
prints a table, and its own header admits it hand-transcribes `confirmNoteTrack` and
**drifts silently** when that path changes. That is a probe, not a test, and it was
sitting in `engine/` looking like one. ⚠️ Its stated reason for transcribing — "the
simulator can't be imported here" — predates `testAssetStub.mjs`, which solves
exactly that. Worth rewriting against the real path before anyone quotes it again.

### 5.D⁸ 🪦 WHAT LEFT THE TREE, AND WHY EACH ONE WAS SAFE

Ten files, quarantined in `_to_delete/purge-20260821/` (the agent shell cannot
unlink — §5.G⁸ has the command).

| file | why it was safe |
|---|---|
| `engine/importcheck.mjs` | **17 dangling imports reported, all 17 false.** Its parser cannot read `export function*` or a multi-line import list containing comments, so it flagged `poseConsequences` — exported on line 408 of `battleFlow.js`, called in production every time somebody poses. Superseded by `check:bundle`, which runs a real bundle and resolves imports properly. |
| `board/ampRigs.js` | A 4-line tombstone whose own comment said *"delete entirely once all imports are cleaned."* They are. |
| `hooks/useNoteSystem.js` | Retired in Phase 5c when noteStates moved into the engine. The monolith's line 19 says so. Nothing imported it. |
| `ui/__orig_check.jsx` | A 251-line pre-Pickles backup copy of `BeginnerTipOverlay.jsx`. 482 diff lines out of date. |
| `__p.jsx`, `__smoke.jsx` | Two throwaway render smokes. `__smoke.jsx` hardcoded an **absolute container path** from a previous session's sandbox, so it could not run anywhere. |
| `COMMIT_MSG_C4_C1.txt`, `COMMIT_MSG_SIMPLIFY.txt` | Messages for commits that landed months ago. ⚠️ `COMMIT_MSG_RIG_REWORK.txt` **stays** — that one is still pending. |
| `mic-test.html` | A bare mic-level meter, superseded by `listen-test.html`, which says so in its own header. |
| `PENDING_CHANGES.md` | Renamed, not deleted — see below. |

🛑 **THREE THINGS ON THE CUT LIST WERE NOT CUT, AND THE REASON MATTERS.**
`camera-test.html`, `listen-test.html` and `arrow-highway-proto.html` look exactly
like dead root-level prototypes. They are **live tooling**: the first two are the
standalone tuning benches `EAR_SPY_HANDOFF.md` §2/§6 sends you to and are served by
`npm run dev`, and the third is read **off disk at runtime** by
`riff/syncProtoGenerator.mjs`. 📌 The lesson generalises: in this repo, root-level
HTML is as likely to be a bench as it is to be litter. Grep before you cut.

📌 **`PENDING_CHANGES.md` → `src/THEORY_REWRITE_LOG.md`.** 1,485 lines at the root of
the repo under a name that advertises a work queue, when **every task in it is
shipped, reversed, or retired** — Task C in full. It was the first thing a new
session saw and the last thing it should have been reading. Its six live citations
in code (`gameConstants.js` B0b, `cadence.js` B2, `chords.js` Task A, `context.js`
B3, `b0check.mjs`, and the monolith's Db arithmetic) were updated to the new name in
the same pass, so no comment points at a file that isn't there. Its instruction to
run `importcheck.mjs` was replaced with the account of why that tool is gone.

📌 **`.scratch/` and `_to_delete/` are gitignored now.** ⚠️ Gitignoring does not
untrack: **72 `.scratch` files and 12 `_to_delete` files are still in the index**,
including four ~600 KB source tarballs and a 242 KB diff. §5.G⁸.

### 5.E⁸ 🎯 NEXT, IN DEPENDENCY ORDER

1. ✅ **DONE — `ARCHITECTURE.md` IS REWRITTEN AND CHECKED.** Full account in §5.H⁸
   and §5.I⁸. 502 lines from measurement, `npm run test:arch` keeps it true, and the
   audit turned up two systems the old map still advertised as live (the Style
   system and the Dissonance Edge) that do not exist at all. 📌 Two things it
   surfaced and did NOT fix, both behaviour rather than docs: `Game.edgeCombatMods`
   is a permanent zero called from four sites, and `STYLE_SYSTEM_HANDOFF.md` is a
   246-line handoff for a deleted system.
2. 🔊 **THE THROUGHPUT QUESTION IS STILL UNMEASURED** (carried from §5.E⁷.2). Two
   marquees roughly double quiz income; fans have no per-turn cap; the same card now
   hands out dice as well.
3. 🏋️ **`RIG_ATROPHY_TURNS = 3`, `marqueeSeek: 0.7` AND `loud: 3.0` ARE GUESSES**
   (carried). All three want the ~2000-match bench, together. ⚠️ 85% of seats still
   finish at the rig floor; no bench number yet read a game in which anybody trained.
4. 🧪 **THE OOZE STILL DOES NOTHING IN ANY BENCH MATCH** (carried). `hexHazards` is
   not in `harnessHooks`. 📌 The marquee fix (§5.C⁷) is the shape of this one.
5. 🎸 **THE LEGACY BOT STILL DOES NOT PAY FOR ITS CHORDS** (carried).
6. ✨ **WHY DID POSES FALL 1054 → 224?** (carried, still unexamined.)
7. 🧮 **RE-PRICE `awardRiffFame` INTO THE BAND** (carried).
8. 🪦 **THE SMASH IS STILL UNMODELLED.** Oldest debt, unchanged.

**🎼 And five open design questions, rescued from the retired doc.** They sat at the
bottom of a 1,485-line file called PENDING_CHANGES that nobody read to the end. They
are genuinely open, and the first two have *moved* since they were written:

- 🕳️ **OTHER BRANCHES NEED CEILINGS OF THEIR OWN**, so Theory-first is not automatic.
  ⚠️ **This got dramatically worse on 2026-08-20 and the doc predicted it.** Theory
  already gated the stat ceiling, the melody palette, the Db payout, chord capacity
  *and* the pardon economy; the answer was going to be "Electric and Crew each need
  one thing nobody else can grant" — and **Electric has since been deleted outright.**
  The Theory ladder is now close to the only ladder. This is the same 110-Db hole
  §5.G⁷ logged from the other side.
- 💰 **DOES `STYLE_DB_CAP` NEED RETUNING?** Best-case Db moved twice after the
  estimate that raised the question. Re-measure before touching it. 📌 `.scratch/dbaudit.mjs`
  is the probe for this, and per §5.C⁸ it needs rewriting against the real commit path first.
- 🎺 **DOES `performanceScore` KEEP `hasGatedEnding`** now that the tritone's damage
  effect is deleted? Those endings pay almost nothing else. (Leaning yes: flair signal.)
- 7️⃣ **DOES `theory_dom7`'s SEVENTH-COMPLETION WANT A POWER-CHORD CASE?** Shipped
  without one — a power chord has no third, so no quality to complete. A large grant
  if added (everyone holds a power chord from turn one); make it a decision, not a nudge.
- 🎹 **`theory_modes` GIVES NOTHING TO dim / aug / m7b5 / sus / power.** That is what
  stops it pardoning most of the chromatic scale, but a dim-stack build gets nothing
  from the tier beyond slot 5.

### 5.F⁸ 📌 Suites — every count identical, which is the point

**engine ✓, legal 582, eval 154, transition 242, determinism 22, turnFlow 61,
battleFlow 50, melody 159, slime 127, eleven 38, score 122, harness 1659,
riffparity 127598, skillTree 159, trace 1831** — every one of them exactly the number
§5.F⁷ quoted. 🎯 **A cleanup that moves an assertion count has deleted something that
was load-bearing**; the flat line is the evidence the ten files were dead.

Newly visible rather than new: **b0check 55 groups**, **guitarMap 70,970**,
**neonNeck 253,506**. `check:bundle` **6 warnings → 0**.

⚠️ **AND `npm run lint` IS NOT CLEAN, WHICH §5.F⁷ SAID IT WAS.** It did not
finish in this session either — abandoned past 25 minutes on the 16k-line monolith,
the same behaviour the rewrite log recorded months ago. Every file this pass touched
was linted directly instead: **14 errors, and all 14 reproduce at HEAD**, so nothing
here introduced one. They are 8 × `react-hooks/refs` in `ui/OpeningMovie.jsx`
(reading `ref.current` during render), one `no-unused-vars` on its `React`
import, and 6 × `react-refresh/only-export-components`.

🎯 **THE LIKELY CAUSE IS AN UPGRADE, NOT A REGRESSION** — `react-hooks/refs` is new
in eslint-plugin-react-hooks 7, which `package.json` now pins. That makes "lint
clean" a claim nobody has been able to re-verify on this machine since, and it should
stop being repeated in a handoff until somebody runs it on Windows. 📌 Same disease as
§5.A⁸: a check that is too slow to run is a check that quietly stops being run.

### 5.G⁸ ✋ WHAT IS STILL OUTSTANDING FROM A REAL TERMINAL

✅ **THE COMMIT LANDED** — `52e16a2 "clearing old clutter"`, and it carried the rig
rework with it, so the two-session backlog is closed. `COMMIT_MSG_RIG_REWORK.txt` and
`COMMIT_MSG_CLUTTER_PASS.txt` are both spent and can go.

⚠️ **BUT THE UNTRACKING STEP WAS NOT RUN, AND GITIGNORE DOES NOT UNTRACK.** Both
directories are still in the index: **72 files under `.scratch/` and 12 under
`_to_delete/`**, the latter including four ~600 KB source tarballs and a 242 KB diff.
They are ignored for *future* changes and tracked for *existing* ones, which is the
worst of both — edits to a probe still show up as repo noise.

```bash
cd ~/rlsw-sim
git rm -r --cached _to_delete .scratch    # 84 files out of the index
rm -rf _to_delete                         # the quarantine + 2.6 MB of tarballs
git commit -m "chore: untrack the working piles"
```

📌 The agent shell **cannot unlink**, so `_to_delete/` can only be emptied from a real
terminal. It has since collected the ten quarantined files, a `__drifttest.js` left
by the negative test in §5.H⁸, and a `gitlocks/` folder of `.lock` files the agent's
git reads leave behind and cannot clean up.

⚠️ **AND `npm run build` STILL WANTS RUNNING ON WINDOWS ONCE.** §5.A⁸ was a
Linux-only failure that no check in this repo can reproduce on the dev machine.

### 5.H⁸ 🗺️ THE MAP WAS REWRITTEN, AND IT IS CHECKED NOW

✅ **§5.E⁸ ITEM 1 IS DONE.** `ARCHITECTURE.md` is 502 lines written from
measurement, and `npm run test:arch` is what makes it stay true.

🎯 **THE CHECK IS THE POINT, NOT THE REWRITE.** A rewritten doc drifts again in a
month; that is exactly what happened to the last one. `engine/architectureCheck.mjs`
asserts the three claims a map makes that can actually be falsified:

| § | asserts | caught, today |
|---|---|---|
| 1 | every source module is named in the doc | **157 modules**, all now have a row |
| 2 | every file path the doc names exists | **218 paths**, all resolve |
| 3 | every export the doc lists is really exported | **502 exports**, all real |
| 4 | the doc is intact and keeps its load-bearing sections | — |

⚠️ **AND IT WAS PROVEN BY BREAKING IT, NOT BY PASSING.** CLAUDE.md's rule is that a
passing test is not evidence a rule is real, so all three arms were failed on
purpose before being trusted: a new module with no row (§1 fails), a row renamed to
a file that does not exist (§2 fails), and `styleCommitDb` — the real historical
phantom — added to `chords.js`'s export list (§3 fails). Each failed with the
message a reader needs, and the doc was restored from a backup taken first.

📌 **§3 ONLY READS FOUR-COLUMN ROWS**, and the first draft did not. The `ui/` table
and the directory map are `| file | lines | purpose |`, so treating column 3 as
exports flagged prose words as phantoms — six false positives on the first run. That
is precisely how `importcheck.mjs` earned its deletion yesterday (17 findings, all 17
false), so the row shape is now the gate rather than a regex over the whole line.

### 5.I⁸ 🪦 WHAT THE AUDIT FOUND WHILE MEASURING

Rewriting the map meant checking every claim in it. Six were fiction, and two of
those were pointing at systems that no longer exist at all:

- 🎵 **THE STYLE SYSTEM IS DELETED, AND THE DOC STILL SOLD IT AS LIVE.** The index
  row for Styles named five functions — `styleCommitDb`, `detectStyleRun`,
  `detectContourTurn`, `detectCellRepeat`, `detectResolvedDiscords` — and **not one
  of them exists.** The tombstones in `music/cadence.js` and
  `engine/systems/economy.js` explain why they went: they re-scored gestures the
  Drive and Sustain boosts already pay for, so the same three gestures were being
  paid twice in two currencies. `data/styles.js` survives as flavour — an icon, a
  colour, a tagline. ⚠️ `STYLE_SYSTEM_HANDOFF.md` is a 246-line handoff for a
  deleted system and reads as instructions; it is now labelled history in the new
  doc table, but somebody should decide whether it stays.
- ⚡ **THE DISSONANCE EDGE IS REMOVED AND THE DOC SENT YOU TO A STUB.** The row
  said `data/gameConstants.js → EDGE_*`. **No `EDGE_*` tuning constant exists
  anywhere** — the `EDGE_HEX_NUMS` / `EDGE_DIST` hits are board-edge *distance*,
  unrelated. `Game.edgeCombatMods` is still there at ~6833 and still called from
  four sites, as a function whose own comment reads *"REMOVED. Returns zero mods
  for backward compat."* 📌 Four live call sites into a permanent zero is dead
  weight worth a look, but it is a behaviour change, so it is not this pass.
- 🎛️ `AMP_RANGE` / `AMP_LINK_DIST` — both deleted with the amp-rig graph.
- 🎓 `SKILL_TREE` "main file, module-level" — it moved to `data/skillTree.js`.
- 🎸 `RIFF_NOTE_WINDOW` "main file, module-level" — it is in `riff/riffGeneration.js`.
- 🔤 **Two of the three "Conventions" warnings were already fixed** and the doc still
  warned about them: `App.jsx`'s capital-V import (fixed) and a `groupie_fans.png`
  case mismatch for a file that no longer exists.

🎯 **THE DEAD ROWS WERE NOT SILENTLY DROPPED.** They live in a 🪦 forwarding table at
the end of the index, saying what happened to each. Somebody who learned this file a
month ago will still look for them, and "it moved, here is where" is a cheaper answer
than a silent absence — which is the failure the whole rewrite is about. The check
knows to exempt that table, so naming a dead file there is allowed exactly once.

📌 **The new doc also gained a `🗂️ The other docs` table** — 31 design docs live in
`src/`, and until now nothing said which were live and which were history. Three are
marked superseded in their own headers (`STANCE_*`), one is the retired theory log,
and `STYLE_SYSTEM_HANDOFF.md` is the one whose status the code contradicts.

### 5.J⁸ 📌 Suites, after the rewrite

**legal 582, eval 154, transition 242, determinism 22, turnFlow 61, battleFlow 50,
melody 159, slime 127, eleven 38, score 122, harness 1659, riffparity 127598,
skillTree 159, trace 1831, engine ✓, b0 ✓, riff ✓** — unchanged again, as they must
be for a documentation pass. **New: arch 8 checks**, covering 157 modules, 218 paths
and 502 exports. `check:bundle` still zero warnings. `test:all` now runs **18 suites**.


---

## 5-aug20pm. 🧭 session handoff, 2026-08-20 (evening)

> 🎛️ **THE RIG IS OFF THE SKILL TREE.** Alex's call, this session: *"get rid of the
> branch of the tree, put the power and amp levels into the marquee, and the range
> tied together with the overall strength of Drive and Sustain."* That is §5.H⁶ and
> `MARQUEE_QUIZ_DESIGN.md` §4–§5, built in one pass, radius first — and finished
> with the deletion in §5.G⁷.
>
> ⚠️ **UNCOMMITTED, ALL OF IT.** 24 files. Commit from a normal terminal; git
> writes still fail from the agent's shell on this mount.
>
> 🫁 **THE RIG BREATHES** — §5.A⁷. `radius = RIG_RADIUS_FLOOR + stack length`,
> Drive on your turn and Sustain on theirs, because that is where the existing
> gates already fell. Floor 3, so the opening state is 4 — the old tier-0 number
> exactly, and nothing about the resting board changed.
>
> 🎪 **THE MARQUEE IS A CHOICE CARD** — §5.B⁷. Lane × difficulty, picked before
> the question is drawn. CROWD pays fans; RIG pays tiers you spend at the card on
> pool or power and lose to atrophy rather than to a timer.
>
> 🐛 **AND THE QUIZ WAS CLIENT-ONLY, WHICH WAS ABOUT TO BE A CATASTROPHE** —
> §5.C⁷. A headless Spirit walked onto a marquee and NOTHING happened. Not
> declared in `HARNESS_GAPS`, just absent. Survivable while the rig was a Db
> purchase. It is now the only source of pool and power.
>
> 🔊 **THE EVALUATOR HAD NO OPINION ABOUT VOLUME, AND IT INVERTED** — §5.D⁷.
> Bots sat one hex from a live marquee on 54 decision points of a 43-turn match
> and stepped on it once. Old item 6 ("give `evaluate` a term for being loud")
> was not a nice-to-have; it was load-bearing.

### 5.A⁷ 🫁 THE BREATHING RADIUS

```
radius = RIG_RADIUS_FLOOR + (your turn ? Drive stack : Sustain stack).length
```

`RIG_RADIUS_BY_TIER = [4, 5, 7, Infinity]` is **deleted, not deprecated** — and
`RIG_RANGE_IDS` with it — so nothing can quietly keep asking a Range tier how far
it carries. There is no infinite radius left in the game; a full six-note stack
reaches 9, which is most of the board and never all of it.

🎯 **THE TURN SPLIT IS NOT DECORATION — IT IS WHERE THE GATES ALREADY FELL.**
Every offensive read of `inRange` happens on your own turn (can you fire a Sonic)
and every defensive one on somebody else's (d6 or a bare d4; can a rival ANSWER a
beam). "Drive on your turn, Sustain on theirs" invents no concept: it hands each
gate the stack that gate was already about.

⚠️ **FLOOR 3 IS THE ANTI-SPIRAL, AND IT IS TUNED TO A FACT RATHER THAN A FEELING.**
`makeInitialNoteState` seeds both stacks with the root alone, so every Spirit
opens at 3 + 1 = **4, exactly the old tier-0 radius**. Only a Spirit genuinely
emptied out (a Swing spends 2 Drive; a Pose sheds Sustain; `chordFray` eats it
under a beating) drops to 3. Lower the floor and you build a game where the Spirit
already losing is the one who cannot answer a beam.

📌 `sonicRig` now takes **the note state**, not an unlockedSkills array, plus an
`onTurn` flag that defaults to FALSE on purpose: a caller who forgets it reads the
DEFENSIVE rig, so the failure mode is under-reaching on your own turn — visible,
and never a phantom attack from outside the radius the rules allow. `rigFor` takes
`state` and answers the question once, so no call site has a boolean to get
backwards. `evaluate.js:898`, the one place that called `sonicRig` raw and was
logged as drift in §5.H⁶, goes through `rigFor` now — which also means it can
finally see a blown amp.

🎯 **AND IT RETIRES §6.6.7's CENTRE/RIG TENSION**, four sessions old. "Make
`centreStage` conditional on having the range to shoot from there" was written
when reach was a purchase the evaluator had to check for. It is not one now: a
four-note Drive stack reaches 7 and CAN work the middle; the same Spirit emptied
out cannot. The read that item wanted is already inside `terms.inRig`, live, every
turn. ⚠️ Which makes `centreStage: 0.7–0.9` **inherited, not confirmed** — it was
measured on a board where the centre was unreachable for most of a match.

### 5.B⁷ 🎪 THE CHOICE CARD, AND THE WORKOUT

**Lane × difficulty, face-down.** `EventModal` grew two phases: `choice` (before
anything is drawn — that ordering is the whole skill component, since betting on
`hard` has to be a bet) and `spend` (RIG lane only, one tier at a time).

| | pays | easy | medium | hard |
|---|---|---|---|---|
| 🎤 CROWD | fans | +2 | +3 | +4 |
| 🎛️ RIG | tiers | 1 | 2 | 3 |

**The tiers are `rigPool` and `rigPower` on the note sheet** — the old Amp and
Power tiers by another name, same ceiling (3 + 3 = Amp III / Power III), so
`AMP_DECK_DESIGN.md` §2.5's "max Sonic roll is 8" survives untouched and nothing
downstream needs re-checking. `power ≤ pool` was the tree's `prereq` gate; it is
plain arithmetic now, enforced inside `rigTiers` so no caller can talk itself into
an upgrade for a die that does not exist.

🏋️ **ATROPHY TICKS ON THE OWNER'S OWN TURNS** (`startTurnNotes`, beside the Psycho
Bushido cooldown, for the identical reason — a clock counted in spirit-turns runs
four times too fast in a four-handed game). One tier shed per `RIG_ATROPHY_TURNS`
(3) without a trip to a marquee.

⚠️ **POWER SHEDS BEFORE POOL, AND THE ORDER IS LOAD-BEARING.** `rigTiers` clamps
power to pool, so shedding a pool tier while power equalled it would silently drop
BOTH — one turn of neglect costing two tiers, with only one of them logged.

🎯 **THE FLOOR IS TODAY'S FREE GRANT.** `rigPool` starts at `RIG_POOL_FLOOR = 1` —
exactly what the free `amp_1` handed everyone (2d6 in range, 1d6 out) — and
atrophy can never take it below. Total neglect lands precisely where every Spirit
begins the game: survivable by definition, and nobody can be quizzed out of
existence by a rival who happens to know their gear.

📌 **A wrong answer costs nothing, and the TRIP still resets the clock.** You
turned up. The alternative punishes the reach twice, and the exposure of standing
on a published hex in the middle of the board is paid either way — that exposure
IS the counterplay to the snowball (design doc §5), and it is positional rather
than trivia-based.

### 5.C⁷ 🐛 THE QUIZ WAS CLIENT-ONLY

`checkEventTrigger`, `pickTrivia`, the payout — all of it lived in the monolith. A
headless Spirit stepped on a marquee and nothing happened at all: not declared in
`HARNESS_GAPS`, **absent**. `collectPickups` (`transition.js`) now resolves the
marquee alongside Lost Chords and Charge Zones, by the same rule the client uses.
Three things had to move to make that possible, and each was a fork waiting to
happen:

- 🎤 **`fansFromDeed` → `systems/economy.js`.** The fan-gain arithmetic (centre
  bonus, casual cap, the streak that hardens a casual into a diehard) was a React
  function, so the headless path could not pay a single fan. `gainFansFromDeed` in
  the monolith CALLS it now and keeps only what a React function should: the board
  read, the log, the dispatch.
- 🎪 **`usedTrivia` → engine state.** It was a `useRef(new Set())` —
  unserializable, unreplayable, invisible to the bench. It rides on
  `eventHexTriggered` now.
- 🎲 **`drawTrivia` is pure**, takes and returns an array, and recycles **per
  bucket**: the old `pickTrivia` cleared the used-set only when all 180 questions
  were gone, so a player with a favourite lane could run one bucket dry and then
  draw nothing while sixty cards sat untouched elsewhere.

⚠️ **BOTH RNG DRAWS HAPPEN BEFORE EITHER BRANCH**, client and engine alike. A draw
whose position in the stream depends on an outcome is a replay divergence waiting
to happen.

📌 **The bot's card policy is expected value, and it falls out of constants that
were already in the file** (§6's one pleasant surprise): train while there is
headroom, then play for the crowd; `0.5×3 = 1.50` makes **medium** the fans pick
and `0.35×3 = 1.05` makes **hard** the tiers pick. The two lanes genuinely
disagree about how much risk is worth taking, which is the decision the card is
asking a human.

📌 **Content:** twenty new RIG-lane questions (14 easy / 6 medium), because §2.1's
count left RIG × easy holding **seven** cards against 65 CROWD mediums — and under
the workout that lane is the only source of pool and power. Buckets now
22/34/22 (rig) and 29/56/37 (crowd), and `selftest` asserts **≥15 per bucket** so a
future skew fails loudly. `TRIVIA_CONTENT_BRIEF.md` is the spec for writing more
somewhere cheaper than a coding session.

### 5.D⁷ 🔊 THE EVALUATOR HAD NO OPINION ABOUT VOLUME — AND IT INVERTED

Measured the day the engine learned to draw a question: **0.20 marquee visits per
match** across ~36 turns, and **60 of 60 seats finished at the rig floor**. Then
the mechanism, on one 43-turn match (`.scratch/marqwalk.mjs`):

| distance to the nearest live marquee | decision points |
|---|---|
| 1 hex | **54** |
| 2 | 81 |
| 3 | 51 |
| ≥4 | 27 |

**Fifty-four decision points standing right next to it, and it was stepped on
once.**

🎯 **BECAUSE TAKING IT MADE THE SCORE GO DOWN.** Stepping on a marquee CONSUMES
it, so any term paying for proximity FALLS the moment you collect the prize — and
nothing rose to meet it, because `evaluate` has never read the size of a dice
pool. `inRig` is a yes/no about the radius. While pool and power were a Db purchase
that was a blind spot; once they are won at the marquee it is an inversion, and
the best-scoring move was to hover beside the thing forever.

**Two rows, and the pair is the point** — the same pairing the file already uses
for charges (`chargeSeek` pays the walk, `charge` pays the holding, and the note
there says in as many words that the holding must be worth strictly more):

- `marqueeSeek` (0.7) — the ramp toward a live marquee, **scaled by headroom**, so
  a Spirit at 3/3 is not sprinting for a prize it cannot collect.
- `loud` (3.0) — earned tiers over the maximum earnable. This is old item 6.

⚠️ **AND PAYING MORE FOR THE WALK MAKES IT WORSE — THE SAME SHAPE AS THE FACING
SPIN** (§5.C⁶). 24 matches, two pairings, fixed seeds, `.scratch/marqsweep.mjs`:

| seek | loud | turns/match | marquees/match | seats above floor | decided |
|---|---|---|---|---|---|
| 0.7 | 1.6 | 18.0 | 0.33 | 3/48 | 24/24 |
| **0.7** | **3.0** | **17.4** | **0.50** | **6/48** | **24/24** |
| 1.5 | 3.0 | 65.3 | 0.33 | 1/48 | 21/24 |
| 1.5 | 5.0 | 50.4 | 0.54 | 1/48 | 22/24 |
| 3.0 | 6.0 | 77.7 | 0.96 | 4/48 | 21/24 |

At seek 1.5 the match length **triples**, matches stop being decided, and FEWER
Spirits end up with a rig than at 0.7 — value on the approach funds orbiting
rather than arriving. **Raise `loud` when you want more training, never
`marqueeSeek`.**

⚠️ **AND EVEN THE BEST ARM LEAVES 42 OF 48 SEATS AT THE FLOOR.** 30 matches on the
shipped weights: 0.60 marquees per match, 85% of seats finishing untrained. **No
bench number taken today is a reading of a game in which anybody's rig grew.** 24
matches is also nowhere near §6.6's bar of ~2000.

📌 The term nobody has built: the atrophy clock. "I am one turn from shedding a
tier" should pull harder than "I trained this turn". That is a second dimension
and it wants a bench, not a guess.

### 5.E⁷ 🎯 NEXT, IN DEPENDENCY ORDER

1. ✅ **DONE — the `rig_*` branch is deleted.** Full account in §5.G⁷; the list
   below is what it touched, kept because it is the map of what a reader might
   still expect to find:
   · `engine/policies/bot.js` — four `skillOrder` arrays and `BOT_SKILL_ORDER`
     still queue those ids, so a bot is saving Db for rungs that do nothing. That
     is the §5.D⁶ disease, self-inflicted.
   · `evaluate.js`'s `STARTING_SKILLS`, `data/rockGods.js:157`, and
     `makeInitialNoteState`'s `unlockedSkills: ["amp_1"]` seed.
   · ⚠️ `systems/skills.js`'s `ULTIMATE_PREREQS = ["mic", "pedal_dist", "amp_1",
     "mixer"]` — **three of those four ids are not in the tree at all** and have
     not been for a long time. Pre-existing drift this change walks straight into.
     Decide what the Ultimate gate is; do not edit around it.
   · `AMP_DECK_DESIGN.md` §2.2 / §2.3 / §2.5 now describe a game that does not
     exist. Its own header says rewrite it in the same pass.
   · ⚠️ And the Db hole is real and deliberate (design doc §7): the branch was
     110 Db, the largest sink in the game. Until the ability tree grows to absorb
     it, expect Db inflation and do not read a bench's Db numbers as a verdict.
2. 🔊 **THE THROUGHPUT QUESTION IS STILL UNMEASURED** (carried from §5.I⁶, and now
   bigger). Two marquees roughly double quiz income; fans are the one economy with
   no per-turn cap; and the same card now hands out dice as well.
3. 🏋️ **`RIG_ATROPHY_TURNS = 3` IS A GUESS.** So are `marqueeSeek: 0.7` and
   `loud: 3.0`. All three want the ~2000-match bench, together.
4. 🧪 **THE OOZE STILL DOES NOTHING IN ANY BENCH MATCH** (carried). `hexHazards`
   is not in `harnessHooks`. 📌 The marquee just showed the shape of that fix.
5. 🎸 **THE LEGACY BOT STILL DOES NOT PAY FOR ITS CHORDS** (carried).
6. ✨ **WHY DID POSES FALL 1054 → 224?** (carried, unexamined.)
7. 🧮 **RE-PRICE `awardRiffFame` INTO THE BAND** (carried).
8. 🪦 **THE SMASH IS STILL UNMODELLED.** Oldest debt, unchanged.

### 5.G⁷ 🪓 THE DELETION — the last quarter, done 2026-08-20 (late)

`data/skillTree.js`'s `electric` route is **gone**: `amp_1..3`, `power_1..3`,
`range_1..3` and `overcharge`. Ten rungs, 110 Db, the largest sink in the game.
Deleted rather than deprecated, so anything still asking for a rig id fails loudly
instead of quietly buying nothing.

**Every reader, cleaned in the same pass:**

| site | was | now |
|---|---|---|
| `bot.js` — 4 persona `skillOrder`s + `BOT_SKILL_PRIORITY_BASE` | queued nine dead rungs | Theory only |
| `evaluate.js` `STARTING_SKILLS` | `{amp_1, theory_minor}` | `{theory_minor}` |
| `economy.js` seed | `["amp_1"]` / `["amp_1","theory_minor"]` | `[]` / `["theory_minor"]` |
| `rockGods.js` `feedback_warlock` | counted `amp_*` + two ids not in the tree | reads `rigPool`/`rigPower` |
| client unlock logs, `legacyMap.amp`, Overcharge modal | live | removed |
| `sonicDicePool()` in the monolith | a second, disagreeing copy of the pool table | removed |
| `pedalBonus` / `powerBonus` in the Sonic path | keyed on `pedal_dist` / `power_chords` — **neither id is in the tree** | removed |

⚡ **OVERCHARGE WAS CUT, BY DECISION.** Alex's call. It gated the Charge Zone's
choose-your-payoff modal behind Amp II; with the amps gone it had no gate left, and a
free 12 Db upgrade reachable on turn two is a different skill from the one designed.
Tapping a zone now always takes the ordinary 50/50 spark — which is exactly what the
headless path always did (`HARNESS_GAPS.pickupChoices`), so client and engine agree
for the first time.

🪦 **AND TWO GATES THAT COULD NEVER FIRE WENT WITH IT** — Alex's call, same session.
`ULTIMATE_PREREQS = ["mic", "pedal_dist", "amp_1", "mixer"]` named three ids that are
not in the tree and have not been for a long time, and **no skill anywhere carried
`prereq: '__all_pa__'`**, so the Ultimate branch was unreachable in both directions.
Both were GREEN in `selftest` — against a fake tree written to match the gate rather
than the game.

🎯 **THE REPLACEMENT ASSERTION IS THE ONE THAT WOULD HAVE CAUGHT IT**, and it runs on
the real tree instead of a fixture: *every prereq in `SKILL_BY_ID` must name a skill
that exists*. `skillTreeCheck` also now pins that none of the ten deleted ids can be
offered to anybody, so a half-finished deletion fails rather than lingering.

⚠️ **THE ONE LIVE TRAP THIS CREATED, AND IT IS PINNED.** Most Spirits now start with an
EMPTY `unlockedSkills`. The B9 bug — the free `theory_major` grant gated on
`unlockedSkills.length === 0`, which `amp_1` made permanently false so it never fired —
would now *appear to work*: the list really is empty for three of the four. But the
Ronin starts holding `theory_minor`, so the emptiness test is **asymmetric**. Revive it
and every Spirit gets the full scale except the Ronin, who quietly plays the
pentatonic all match. One character broken instead of all four is far harder to
notice. `b0check.mjs` now asserts the disagreement directly rather than asserting that
the list is never empty.

📌 **THE Db HOLE, FIRST MEASUREMENT** (`.scratch/dbhole.mjs`, 30 matches): **mean 4.0
unspent Db at match end, worst 8, 2.67 skills bought per seat.** `DB_UPGRADE_THRESHOLD`
is 4, so that is roughly "one purchase pending" — no visible inflation. ⚠️ But bench
matches run ~19 turns and the Theory ladder is only five rungs; the pile-up the design
doc warns about would show on long matches, which nobody has run. `runMatch` returns
`db` per seat now, so it is one probe away whenever somebody wants it.

### 5.F⁷ 📌 Suites, and what moved

Everything green, after the deletion as well as before it. **legal 582,
transition 242, determinism 22, turnFlow 61, battleFlow 50, eval 152 → 154,
melody 159, slime 127, score 122, eleven 38, riff parity 127598, `b0check` green,
`check:bundle` clean, `npm run lint` clean.**

- **skillTree 208 → 159, and the arithmetic is exact.** Ten deleted skills × six
  per-skill assertions (id, price, route, `spiritOnly`, the shared-route null, the
  price-sanity sweep) = 60 fewer; +12 new (ten pinning that each deleted id is
  offered to nobody, plus the two ownership pins that replaced the `amp_1` one);
  −1 for the `amp_1` pin itself. 208 − 60 + 12 − 1 = **159**. Nothing was thinned:
  the file asserts strictly more per skill than it did.
- 🎯 **And one assertion got BETTER by failing.** `ok(allSkills().length >= 20)`
  broke on 18 and reported *"the flat lookup found them all"* about a lookup that
  had in fact found them all. It now counts what the routes declare and compares —
  the assertion that was meant all along.

- **eval +2** — the two new rows, caught by the suite's own weight-table sweep.
- **harness 1751 → 1659** and **trace 1683 → 1831.** ⚠️ Both assert inside
  `for (const turn of log) for (const a of turn.actions)`, so their counts track
  HOW MUCH MATCH THERE IS TO WALK, not how much is covered. The trace fixture is
  one match on one seed: 14 turns before this session and 14 after, with more
  actions per turn (bots now walk toward marquees) — and the winner flipped twice
  along the way before landing back where it started.
  Nothing was removed from either suite.
- ⚠️ **Two fixtures were rewritten because they had become fictions**, which is §7
  of the design doc landing exactly where it said it would: `transitionCheck` §21
  bought its riff-off reach with `range_1..3` (it buys reach with stacks now), and
  `selftest`'s rig block walked `RIG_RADIUS_BY_TIER` and counted `amp_*` (it walks
  the stacks and the workout now, and asserts the atrophy floor).

New probes in `.scratch/`: **`rigbreath.mjs`** (the A/B on match shape),
**`rigworkout.mjs`** (does the workout reach the bench at all),
**`marqwalk.mjs`** (the distance histogram that found the inversion),
**`marqsweep.mjs`** (the weight sweep above), plus `rigreach.mjs`, `marqterm.mjs`,
`marqueecheck.mjs`, `onematch.mjs`.

📌 Git writes still fail from the agent's shell on this mount. Commit from a
normal terminal. `_to_delete/` still needs removing by hand.

---

## 5-aug20am. 🧭 session handoff, 2026-08-20 (day)

> ✅ **ALL COMMITTED** — `1f84663` / `1df5e08` / `ed3c9b1`, and the §5.I⁶ marquee
> work in `b8d1626`. Probes included.
> ⚠️ This banner has now gone stale TWICE in one day: it said UNCOMMITTED and
> listed six files, was corrected, and then said the marquee work was
> uncommitted after that had landed too. If you are editing a banner, check the
> log rather than the previous banner.
> The session before this one is §5-aug19 below.
>
> 🌀 **PSYCHO BUSHIDO NEVER LANDED ITS PAYLOAD, AND IT WAS BROKEN FOR HUMANS TOO**
> — §5.A⁶. A `setTimeout` handed the strike a closure that predated the dash, so
> the bonus Drive was computed, logged, written to state and then read at its
> pre-dash value. The only deferred call to `initiateSwing` in the file.
>
> 🌀 **AND THE PAYOUT WAS INVERTED** — §5.B⁶. `apLeft - distToTarget` paid MOST
> for a charge of zero hexes and NOTHING for a full-length one. Alex found it by
> reading the table. One sign flip, and the ability now polices itself.
>
> 🧭 **THE BOTS WERE SPINNING ON THE SPOT** — §5.C⁶, `BOT_STRATEGY_HANDOFF.md`
> §6.6.16. `face` was 41.7% of the Ronin's AP, 100% of multi-face runs were an
> A→B→A→B oscillation, and **a facing term made it worse before the guard fixed
> it**. Read that section before adding a term to anything.
>
> 🗡️ **THE RONIN CANNOT USE THREE OF HIS FOUR ABILITIES** — §5.D⁶. They are not
> action kinds at all. He aims 45% of his skill savings at them anyway.

### 5.A⁶ 🌀 PSYCHO BUSHIDO WAS THROWING ITS OWN PAYLOAD AWAY

`resolvePsychoBushido` ended with `setTimeout(() => initiateSwing(targetId), 100)`
— **the only deferred call to `initiateSwing` anywhere in the monolith.** Every
other call site is synchronous inside a click handler, so `initiateSwing` read its
rule inputs from render-scoped values and was correct BY ACCIDENT.

| what the deferred strike read | value it saw |
|---|---|
| `actionTokenUsed` (:7085) | stale — token looked unspent |
| `moveStepsLeft` (:7090) | stale — pool looked full |
| `spirits.find(...)` (:7086) | stale — **the PRE-DASH hex** |
| `noteStates[attacker.id]` (:7118) | stale — **`tempDrive` predated the buff** |

The two guards passing on stale data is the only reason the swing fired at all.
`nsA` being stale is why **the entire bonus never reached the blow**, and
`clearBattleBuffs` then zeroed it unspent.

⚠️ **THE FILE ALREADY KNEW.** The refs at :1313–1314 sit under *"live-state
mirrors so the async bot loop never reads stale closures"*, and `defenderPosing`
was fixed this exact way in §6.6.8 — twenty lines further down the same function.

**Shipped:** `initiateSwing` reads `engineRef.current` (strictly fresher than the
render values at every call site, not merely equivalent); Bushido pays
`beatsSpent(apLeft - 1, false)` for the dash and lets the Swing spend its own AP
and burn its own token; the strike is synchronous; and a `rockGodActive` guard is
mirrored up front, because the dash commits the turn before the strike is tried.

### 5.B⁶ 🌀 AND THE PAYOUT REWARDED NOT CHARGING

`bonusDrive = max(0, apLeft - distToTarget)`, and the dash warps to
`distToTarget - 1`:

| rival at | hexes charged | bonus (speed 5) |
|---|---|---|
| 1 | **0** | **+4** |
| 5 | **4** | **0** |

**Maximum payout at zero charge.** Alex: *"the player is incentivized to be as
close to the Rival as possible... which is literally the opposite effect of what
I want."*

**Shipped:** `bonusDrive = max(0, distToTarget - 1)` — the ground he covered.

🎯 **AND THAT IS WHY IT NEEDS NO MINIMUM RANGE, which was the other half of the
proposal.** The move already consumes ALL remaining AP, so the flipped sign
polices itself: charging from next door spends five AP for +0 — strictly worse
than the 1 AP Swing — while charging four spends the same five for +4. The cost
scales with the reward with no rule to teach.

⚠️ **AND A HARD GATE WOULD PROBABLY HAVE BEEN A DEAD ABILITY.**
`.scratch/bushidowindow.mjs`, 8261 Ronin decision points, walking all six axes and
stopping at the first body:

| rival on an unblocked axis at | |
|---|---|
| exactly 1 hex | **86.2%** |
| exactly 3 | 0.4% |
| ≥3, with the AP for it | **0.4%** |

⚠️ **A FLOOR, NOT A VERDICT** — these are bot boards, and §6.6.7 documents why the
bots clump (*"declining to travel"*, 83% of turns in contact). A human spaces out
far more. But the direction matters: the game's resting state is everyone
touching, and `eleven` (legal 760×, chosen **0×**) and `tentacle` (legal 9×,
chosen 0×) are what a too-narrow window looks like after it ships.

📌 **THE `tempDrive` WORDING WAS DRIFT, AND THE CODE WON.** The skill said
*"bonus Drive on top of your Drive stack"*; it writes `tempDrive`, a battle-scoped
attack bonus under `ATK_BONUS_CAP` that `clearBattleBuffs` wipes. Alex's call:
code is right. `skillTree.js`, `CHARACTER_HANDOFF.md` and the unlock log line now
say so.

### 5.C⁶ 🧭 THE SPIN — full account in `BOT_STRATEGY_HANDOFF.md` §6.6.16

`face` was 41.7% of the Ronin's entire AP budget; 100% of multi-face runs were a
perfect two-facing oscillation with `endTurn` legal on every step; 16% of all AP
went into it. No term in `evaluate` read `.facing` — every facing priced
identically to four decimals.

⚠️ **THE FACING TERM ALONE DOUBLED IT** (32.7% → 55.7% of actions), because
`legalActions` excludes the facing you are already in, so value on facing is fuel
for the oscillation. The fix is the **dominance guard**: price standing still, and
drop any `face` that does not beat it.

| 60 matches, same seeds | decided | turns | `face` | dominated | `move` | attacks |
|---|---|---|---|---|---|---|
| guard OFF | 49/60 | 104.8 | 55.1% | 8933 | 6.6% | 439 |
| guard ON, `facing: 0` | 59/60 | 43.3 | 10.2% | 0 | 40.6% | 449 |
| **guard ON + term** | **59/60** | **29.1** | **6.5%** | **0** | 36.3% | **508** |

⚠️ 60 matches. §6.6's bar is ~2000 and §5.C⁗'s lesson stands.

### 5.D⁶ 🗡️ THE RONIN'S ARSENAL IS NOT IN THE ENGINE'S VOCABULARY

`MODELLED_KINDS` has no entry for `psycho_bushido`, `shadow_illusion` or
`cursed_shamisen` — not filtered like the Smash, **absent**. Only `wa_no_koe`
works, because it is a passive. The Monster's four are all first-class.

| Ronin skill-target aims, 24 matches | | |
|---|---|---|
| `psycho_bushido` | **24** | ❌ unusable |
| `shadow_illusion` | **24** | ❌ unusable |
| `cursed_shamisen` | 15 | ❌ unusable |
| everything else | 76 | ✅ passive |

🎯 **His top two picks are his two most expensive dead ends** — 63 of 139 aims
(45%) point the Db bar at an ability he has no action for, and §3.2's whole
premise is that Db is finite. Every Ronin bench number ever recorded was a Ronin
with no arsenal.

### 5.E⁶ 🎯 NEXT, IN DEPENDENCY ORDER

1. 🌀 **PLAY-TEST PSYCHO BUSHIDO.** Client-only, no suite covers it. Dash with
   spare AP: does the battle overlay's attack stat include the bonus the log
   promises, and does the blow come from the hex he dashed TO?
2. 🗡️ **WIRE THE RONIN'S REMAINING TWO ACTIVES IN.** 🌀 Psycho Bushido is
   ✅ **DONE** — §5.G⁶, it is a `MODELLED_KIND` and the searcher draws it on 23.3%
   of the turns it is legal. The other two are each a SUBSYSTEM rather than an
   action, and the estimates are not close:
   · 👤 **Shadow Illusion** — a second body with its own movement pool, its own
     pickups, a 3-turn clock and four pop conditions. `legalActions` already
     takes `shadowHex` in `view`, so the BLOCKING half is modelled and nothing
     else is. Needs board state the engine does not have.
   · 🎸 **Cursed Shamisen** — a wandering hazard that ticks per round, chases
     minor-key Spirits, drains Sustain in two rings and can be calmed by walking
     onto it. ⚠️ **Same class as `hexHazards`** (item 3): a per-tick board effect
     the harness has no hook for. Do item 3 FIRST — they want one hook, not two.
3. 🧪 **THE OOZE STILL DOES NOTHING IN ANY BENCH MATCH** (carried, §5.E⁵ 1b).
   `hexHazards` is not in `harnessHooks`. Unchanged.
4. 🎸 **THE LEGACY BOT STILL DOES NOT PAY FOR ITS CHORDS** (carried, §5.E⁵ 1c).
5. ✨ **WHY DID POSES FALL 1054 → 224 WHEN THE FACING TERM WENT IN?** New, §6.6.16.
   Match length explains some of it and not all. Nobody has looked.
6. 🔊 **GIVE `evaluate` A TERM FOR BEING LOUD** (carried, #15). Still legal
   hundreds of times, chosen 0×.
7. 🧮 **RE-PRICE `awardRiffFame` INTO THE BAND** (carried, §5.C‴).
8. 📏 **THEN A REAL BENCH.** §6.6's bar is ~2000. Nothing here is above 135.
9. 🪦 **THE SMASH IS STILL UNMODELLED.** Oldest debt, unchanged.

### 5.G⁶ 🌀 PSYCHO BUSHIDO IS AN ACTION NOW

`legalActions` walks the facing line, stops at the first body, and emits
`{ kind:'psychoBushido', targetId, to, dist, apCost: dist }` when the skill is
unlocked, the cooldown is clear and there is room to move. `transition.js` joins
it to the `swing`/`sonic`/`tentacle` group and pays a **prologue** — warp, dash
AP, `tempDrive`, cooldown — then falls through into the combat path.

🎯 **THE BUFF LANDS ON `pre`, WHICH IS WHAT `attackParams` READS.** The bug the
client carried for months (§6.6.16, §5.A⁶ — a `setTimeout` handing the strike a
pre-dash closure) is not reproducible here, because the ordering is structural
rather than temporal. ⚠️ That is worth stating out loud: the engine copy is not
"the same code that works"; it is a shape in which the failure cannot occur.

**It draws.** 20 matches with the skill seeded: `psychoBushido` legal 163×,
**chosen 38× (23.3%)** — against a plain `swing` at 10.2%. The Ronin prefers the
charge to the jab, which is what the payout now says he should.

⚠️ **AND IT IS GATED ON THE SKILL, NOT ON THE SPIRIT.** `psycho_bushido` is
`spiritOnly` in the tree, so the roster gate exists one layer up; reading the
unlock keeps `legalActions` free of a hard-coded name to keep in step.

📌 **Suites, and every movement is an INCREASE:** legal 580 → **582** (§16's
kind-coverage table asserts `BOT_CLIENT_KINDS` against `MODELLED_KINDS` in both
directions, so one kind adds two), transition 241 → **242**, harness 1665 →
**1703**, trace 1595 → **1598**. Everything else unchanged. `check:bundle` clean.

### 5.H⁶ 🔊 OPEN DESIGN QUESTION — THE RIG THAT BREATHES (Alex, 2026-08-20)

> *"What if the range of the amps increased linearly with Drive and Sustain? When
> the player is actively having their turn, their amps expand to how much Drive
> they currently have. When it's another player's turn, those same amps expand or
> collapse depending on how much Sustain they have."*

**Not decided. Recorded because the fit is unusually good and the analysis should
not have to be redone.**

🎯 **THE EXISTING GATES ALREADY SPLIT ALONG THAT LINE.** Every offensive read of
`inRange` happens on your turn and every defensive one on theirs:

| gate | fires on | the rule says |
|---|---|---|
| `legalActions:450` — can you fire a Sonic | your turn | **Drive** |
| `attackParams:214` — `defInRig`, d6 vs bare d4 | their turn | **Sustain** |
| `legalActions:474` / `evaluate:404` — can a rival ANSWER | their turn | **Sustain** |

`rigFor(spirit, ns)` is the single wrapper nearly everything goes through and it
**already receives `ns`** — which holds both stacks. It needs one more input and
one line of arithmetic. 📌 One tidy-up it forces: `evaluate.js:898` calls
`sonicRig()` directly instead of `rigFor`, and is the one place that would drift.

🎯 **AND IT RETIRES §6.6.7's CENTRE/RIG TENSION** — the four-session-old item
*"make `centreStage` conditional on range"*. Under this rule you PLAY your way to
centre stage: stack Drive and the rig reaches the middle. The tension stops being
a purchase gate and becomes a decision. It also answers the weight table's own
complaint about `drive: 0.6` (*"readiness never spent is worth nothing"*) — a
Drive stack would be worth something standing still.

**Numbers that line up:** `STACK_CAP_BASE` 3 / `STACK_CAP_MAX` 6 against radii
`[4, 5, 7, ∞]`. `radius = RANGE_FLOOR[tier] + stackLen` with floors `[2,3,4,6]`
puts today's flat values mid-range and gives a swing at both ends. The Range rungs
become **the floor — how far you carry when silent**, which is a better purchase
than +3 flat: it is insurance, and it matters most when you are empty.

⚠️ **THE RISK IS A LOSS SPIRAL, AND IT IS REAL.** Sustain frays when you are hit
(`applyChordFray`, +1 from the rear wedge), so a beaten Spirit's rig shrinks →
defence die drops d6 → d4 → they are hit harder → Sustain frays faster. **Tune
the FLOOR before the swing.** A floor that leaves a fully-frayed Spirit still in
rig near home turns the spiral into a readable escape hatch — fall back to your
amp — and a floor of 0 or 1 builds a game the loser cannot come back from.

📌 It composes with the quiz idea rather than replacing it: amps (pool size) and
power (die size) stay pure numbers and stay quiz-able; range stops being one.

🎯 **AND THE QUIZ IDEA IS NOW WRITTEN DOWN TOO** — `MARQUEE_QUIZ_DESIGN.md`,
2026-08-20. Two marquee hexes, a lane × difficulty choice card, and the rig's
pool/power tiers earned at the quiz and lost to **atrophy** rather than to a
timer. ⚠️ It also records the decision that **amps come off the skill tree
entirely**, which this section's radius rework did not anticipate: with no
`rig_*` rungs left, the "Range rungs become the floor" proposal above has
nothing to hang on and the radius floor becomes a flat constant. The two docs
share `sonicRig` and should be built in one pass, radius first.

### 5.I⁶ 🎪 TWO MARQUEES — AND THE ONE THAT NEVER CAME BACK

`MARQUEE_QUIZ_DESIGN.md` §8 slice 1, shipped. `EVENT_HEX_COUNT` 1 → 2, plus a
new `EVENT_MIN_SEPARATION` (4) so a pair cannot light up inside one Spirit's
pocket and hand them both over uncontested.

🐛 **AND IT UNCOVERED A LIVE BUG, WHICH IS THE REAL VALUE OF THE SLICE.** The
client respawn driver watched for a TIMER EDGE — `board.eventRespawnIn <= 0 &&
eventRespawnIn > 0`, where the second half was a **render-scoped copy of the
previous value**. `applyEventHexTriggered` sets that counter to the same value
however many marquees are consumed, so two triggers in one round cross zero
ONCE and light ONE hex. The board then sits a marquee short for the rest of the
match, with no error and no log line.

⚠️ **AT `EVENT_HEX_COUNT = 1` THAT BUG WAS UNREACHABLE**, which is why it
survived: you cannot consume two marquees in a round when only one exists. The
count change did not cause it, it *exposed* it. 📌 Same shape as §5.A⁶ — a
render-scoped copy standing in for live state — and the fix is the same one:
ask `engineRef.current` what the board is short of, rather than asking a stale
number what it used to be.

**Also fixed:** `applyEventHexSpawned` capped on a **literal `2`**, not on
`EVENT_HEX_COUNT`. It happened to agree with the new count, which is exactly what
made it dangerous — a future 3 would have been silently clamped to 2. It reads
the constant now, and re-arms the respawn timer itself when the board is still
short, so a double-trigger recovers over two rounds instead of snapping back to
full in one dispatch.

**Setup and respawn now share one helper** (`eventHexCandidates` in
`board/boardHelpers.js`), so opening placement obeys the separation rule too.
⚠️ Separation is a PREFERENCE, not a gate: on a crowded board the spaced pool
can empty, and returning nothing there would stop marquees respawning for the
rest of the match. It degrades to the unspaced pool — a badly placed marquee
beats no marquee. The selftest proves that path by setting the separation to 99
and watching placement fall back rather than fail.

📌 **Suites — nothing dropped, and two ROSE for a legible reason:**
selftest +9 assertions (the new marquee block), harness **1703 → 1751**, trace
**1598 → 1683**. Both of those assert inside `for (const turn of log) for (const
a of turn.actions)`, so their counts track how much match there is to walk — and
`botMoveCtx` (`policies/bot.js:585`) feeds `eventHexes` into the bot's move
scoring, so two marquees genuinely change where the bots go. Everything else
unchanged: legal 582, transition 242, determinism 22, turnFlow 61, battleFlow 50,
eval 152, melody 159, slime 127, eleven 38, score 122, skillTree 208, riff parity
127598. `check:bundle` clean.

⚠️ **NOT SHIPPED, AND NOT MEASURED:** the throughput question. Trivia pays FANS,
and fans are the one economy with no per-turn ceiling. Doubling the marquees
roughly doubles quiz income and nobody has benched what that does to
`FAN_MULT_CAP`. `TRIVIA_REWARD` is the dial if it turns out to matter.

### 5.F⁶ 📌 Housekeeping

⚠️ **THE SECTION NAMING CHANGED.** The 2026-08-19 handoff is now `## 5-aug19.`
rather than `## 5-prev.`, because `## 5-prev.` was already taken by 2026-08-18
(evening) and the cascade had run out of words. Dated suffixes from here.
This session uses `⁶` subsection markers.

Nine probes in `.scratch/`, all cheap and worth keeping:
- **`facestreak.mjs`** — face run lengths and provably-dominated AP. The
  regression witness for the spin.
- **`facespin.mjs`** — proves the oscillation is A→B→A→B and that `endTurn` was
  legal throughout.
- **`facewhy.mjs`** — the full priced menu on one spin. The clearest single
  picture of why the bot preferred turning to stopping.
- **`faceguardab.mjs`** — the three-arm A/B. ⚠️ **Arms run SEPARATELY** (`noguard`
  / `guard` / `noterm`); the whole thing in one process exceeds the tool's 45s cap
  on this machine, and a truncated run reports nothing at all.
- **`bushidowindow.mjs`** — how often a charge lane is open, by distance.
- **`roninkit.mjs`** — legal-vs-chosen for the Ronin, plus the arsenal-vs-
  `MODELLED_KINDS` table.
- **`ronininvest.mjs`** — what the Ronin saves up for, and how much of it is dead.
- **`faceab.mjs`** — ⚠️ its `apBanked: 0` arm is RETIRED. That hypothesis was
  wrong: zeroing the AP term made the spin worse, not better, because it made
  turning free. Kept as the record of an exonerated suspect.
- **`facewaste.mjs`** — superseded by `facestreak.mjs`. Bin it.

📌 Git writes still fail from the agent's shell on this mount. Commit from a
normal terminal. `_to_delete/` still needs removing by hand.

---

## 5-aug19. 🧭 session handoff, 2026-08-19

> ⚠️ **UNCOMMITTED.** `src/engine/policies/play.js`, `src/engine/policies/botJournal.js`,
> `src/engine/botTraceCheck.mjs`, `src/ui/BotReview.jsx`, `src/rlsw-simulator-v3_8_1.jsx`
> (one constant), `.scratch/journal.mjs`, `.scratch/reviewsmoke.jsx`, and two new
> probes `.scratch/stackorder.mjs` / `.scratch/stackab.mjs`. The session before
> this one is §5-prev below (partly `230ff8e`).
>
> 🥁 **THE BOTS COULD NOT REACH A STACK COMMIT UNTIL THE MELODY LINE WAS FULL** —
> §5.A⁵. Alex found it by playing; it reproduced on the first headless look. It
> is an ARRAY ORDER, not a judgement, and it had been live in every searcher
> match ever benched.
>
> 🧠 **AND THE JOURNAL WAS BLIND TO THE WHOLE COMPOSITION PHASE** — §5.B⁵. The one
> column built to catch "legal again and again, never once picked" could not see
> half of any turn. Fixed in the same pass, which is the only reason the fix can
> be checked by the instrument rather than by a probe written for it.
>
> 🎯 **AND THE CLOSE CALLS NOW NAME THEMSELVES** — §5.C⁵. 70–79% of decisions were
> near coin flips and nothing could say what they were flipping on. They are
> flipping on `posePlay`, `beamSetup`, `centreStage` and `apBanked`. **`pressure`
> and `fame` are in none of the top fours.**
>
> ✅ **THE TWO OWED VERIFICATIONS ARE DONE** — §5.G⁵, on Alex's machine, and they
> cover this session's edits as well as the previous one's: `npm run check:bundle`
> is clean in 2.6s (6 pre-existing `different-path-case` warnings on the standee
> PNGs, unchanged) and `.scratch/reviewsmoke.jsx` renders the panel at 8220 bytes
> with all eleven of its assertions green.
>
> 🏆 **AND A FAME WIN COULD BE SWALLOWED WHOLE** — §5.G⁵. Alex played a match to
> ⭐27/21 and no finishing screen ever came. The client's copy of `grantFame`
> never got the `ROCK_GODS_SHELVED` disjunct the engine's copy got on 2026-08-18.

### 5.A⁵ 🥁 THE FINDING — the stacks were unreachable, and it was an array order

Full account in `BOT_STRATEGY_HANDOFF.md` §6.6.14.

`composePhase` extended its line with `beamActions(steps, { limit: 1, … })[0]`.
`beamActions` groups by KIND and emits groups in first-appearance order;
`legalActions` pushes every `melodyNote` before every `stackCommit`. So `[0]` was
a melody note whenever one was legal, and a commit was unreachable until the
8-note track was full. Over 18 headless matches the picker was offered both kinds
**455 times and took a note 455 times**; every commit in the sample was a
leftover on a full track.

⚠️ **THE TWO KINDS COULD NOT HAVE BEEN COMPARED.** `makeActionScorer`'s contract
is "higher is better, WITHIN A KIND". There is no cross-kind number in it. The
fix gives that one question to `evaluate`, at the confirm, for the same reason
`evaluate` already owned "how many notes".

🎯 **AND IT IS A NEW SHAPE — WORTH A ROW OF ITS OWN IN §5.A's TABLE.** The old
predictor is *the evaluator has no term, so the bot never does it*. Here the term
exists in every column of `EVAL_WEIGHTS`, and forcing commits first through the
**same** evaluator preferred the commits-first line on **231 of 310 turns**.

> **The evaluator already wanted the stacks. It was never consulted, because the
> search could not reach the branch to ask about it.** A term nobody disputes is
> worth nothing if no line ever carries it.

⚠️ **AND THE SHIPPED BUG STILL PRODUCED 148 COMMITS**, so "does it ever commit"
was green throughout. `botTraceCheck` §3b now asserts a commit on a SHORT track
specifically, and the comment says why.

| 18 matches, searcher both seats | before | after |
|---|---|---|
| commits on a track shorter than 8 | **0** | 268 |
| turns that loaded a stack (Ronin/Int/Metal) | 15%/12%/12% | 22%/23%/33% |
| Drive stack at confirm, mean | 2.08/0.78/1.35 | 3.43/3.51/3.00 |
| ...empty at confirm | 11%/46%/27% | **0%/0%/0%** |

### 5.B⁵ 🧠 THE JOURNAL COULD NOT SEE THE COMPOSITION PHASE AT ALL

`journalSummary` bumped `chosen` with the literal `'confirmMelody'` for every
compose entry, and `legalSeen` was fed only from action entries. `melodyNote` and
`stackCommit` could therefore appear in **neither** `chosen` nor `neverChosen`.

🎯 **§5.A's automated predictor was blind to half of every turn.** It found #15
on its first run and could not have found this one, however long it ran.

**Shipped:** compose entries carry `legalKinds`, `chosenKinds`, per-step
`steps[{i, took, cands}]` and the winning line's `terms`; `journalSummary` feeds
composition kinds into the same two columns as action kinds and reports
`meanNotes` / `meanCommits` / `composeTurnsWith`; the 🧠 REVIEW panel grew two
tiles and a compose row that says "5 notes + 2 🥁" instead of "a 7-step track".

### 5.C⁵ 🎯 WHAT THE CLOSE CALLS TURN ON — the term-swing column

§5.J⁗ left "57–79% of decisions are close calls" as unquotable, because nothing
could say whether that was a bad threshold or a bot flipping coins. The journal
now records `evaluate`'s term vector on the top two priced options, and the
summary reports the mean absolute per-term difference between them over close
calls only:

| Spirit | close calls turn on |
|---|---|
| cosmic_ronin | `posePlay` 0.158, `beamSetup` 0.110, `centreStage` 0.052, `apBanked` 0.051 |
| intergalactic_0 | `apBanked` 0.191, `beamSetup` 0.179, `posePlay` 0.057, `centreStage` 0.037 |
| Metalness_Monster | `beamSetup` 0.120, `apBanked` 0.075, `posePlay` 0.037, `centreStage` 0.034 |

**`pressure` and `fame` appear in none of them.** The turns are being decided by
the positioning-and-setup terms, not by either win condition. That is §6.6.10's
rule — *a term that scores GETTING READY must be capped below what DOING it pays*
— measured for the first time instead of inferred from a symptom.

⚠️ **RAW TERMS, NOT WEIGHTED.** A big swing on a small weight moves a lot and
decides little. Read this beside `EVAL_WEIGHTS`, never instead of it.

### 5.D⁵ THE STATE OF THE GAME RIGHT NOW

120 matches a tree, same seeds, 3 lives, same script both trees (the
`pressureab.mjs` discipline, since a formula change cannot go through
`weightOverrides`): decided 119/120 → 119/120, mean turns 36 → 38, FP per turn
0.713 → **0.772**, duels 189 → **251**, swings 719 → **456**, Sonics 158 → 197,
poses 880 → 1221, lives lost 291 → 249. Wall clock 21.4s → **27.8s**.

🎯 **READ IT AS "IT FIGHTS DIFFERENTLY", NOT "IT FIGHTS MORE."** Swings down 37%
while duels are up 33% and Fame per turn is up 8%: a Spirit that walks in with a
loaded Drive stack takes the shot that pays instead of the one that is available.

⚠️ **A 50-MATCH RUN OF THE SAME PROBE SAID "mean turns 43 → 37" AND 120 ERASED
IT.** §5.C⁗'s object lesson, again, at a fifth of the sample. The turn count is
quoted above only to be disowned.

⚠️ **THE FIX COSTS ~30% OF SEARCH TIME.** Every composition step prices two
candidates to their confirm rather than taking the head of a list. Free in the
client (the driver waits ~520ms a tick on animation — §6.6.12), a real tax on a
2000-match bench.

⚠️ **`twogate.mjs` CANNOT MEASURE THIS FIX** — `unranked` gets the cross-kind
price too, deliberately, so both arms have it. 60 seeds read 38.3% ±12.3 before
and 41.4% ±12.7 after: a "nothing broke" reading and nothing more.

📌 **Suites, this pass:** engine ✅, legal 580, eval 151, transition 241, turnflow
61, determinism 22, battleflow 50, melody 159, slime 127, eleven 38, score 122,
**harness 1738 → 1843**, skilltree 208, **trace 1435 → 1700**, riffparity 127598.
⚠️ Neither moved count is coverage. `harness` tracks how many actions the bots
take. `trace` went 1435 → **1363** on the fix alone — 1 fewer action decision, 48
fewer `considered` pairs, 17 fewer curve points, because commits spend stock that
melody notes used to spend — and the new assertions took it to 1700. Nothing was
removed or weakened.

### 5.E⁵ 🎯 NEXT, IN DEPENDENCY ORDER

1. ✅ ~~**RUN `check:bundle` AND `reviewsmoke` ON A REAL MACHINE.**~~ **DONE**,
   §5.G⁵ — both clean, and they now also cover §5.G⁵'s own two edits.
1b. 🧪 **THE OOZE DOES NOTHING IN ANY BENCH MATCH EVER RUN** — new, §5.G⁵, and it
   goes at the top because it invalidates readings rather than adding one.
   `harnessHooks` implements `declareWinner` and `knockOut` and nothing else, so
   the `hexHazards` hook — `play.js` §91 says so out loud, *"client-owned,
   skipped"* — never fires; `transition.js`'s `case 'move'` has no slime cost
   either. So `slimeBites` is called from the CLIENT AND NOWHERE ELSE. Every
   Metalness weight in `EVAL_WEIGHTS` was tuned in a game where his trail cannot
   hurt anybody, and the searcher walks rivals' ooze for free in its own head and
   pays 1 Vibe a step for it on the real board. ⚠️ This is §6.6.8's
   `leftLimelight` finding again, in the hook right next to it: **a hook nobody
   implements is a rule that only applies to humans.**
1c. 🎸 **THE LEGACY BOT DOES NOT PAY FOR ITS CHORDS** — new, §5.G⁵.
   `botExecuteStackCommits` pushes straight onto `driveStack`/`sustainStack` and
   never spends the stock slot; the searcher commits through `clickNoteStock`,
   which does. The monolith's own comment at the `stackCommit` case says this and
   it had no consequence until 2026-08-19 — §5.A⁵ took commits on a short track
   from **0 to 268**, so the searcher has just started paying a bill the old bot
   has never once paid. Alex, playing: *"The Smart bot got crushed. The old bot
   lasted a bit longer than the smart one."*
2. 🥁 **WHY IS `face` HALF THE TURN?** Promoted, because §5.C⁵ has finally aimed
   at it. Before the fix the Ronin chose `face` on **534 of 1162** action
   decisions at `FACE_AP_COST` 1 — about half its AP — and attacked on 5.4%. The
   close-call column says `beamSetup` and `posePlay` are what it is buying. This
   is §6.6.10's "getting ready outranks doing it" for the FOURTH time, and it is
   the first one with an instrument pointed at it before the fix rather than
   after.
3. 🔊 **GIVE `evaluate` A TERM FOR BEING LOUD** (carried, #15). `eleven` legal
   **331×**, chosen 0× on the post-fix run — the detector has not gone quiet, and
   should not until the term lands.
4. 🧮 **RE-PRICE `awardRiffFame` INTO THE BAND** (carried, §5.C‴). Now more
   urgent, not less: duels are up 33% and every term in the payout is still
   invisible to the searcher.
5. 🔊 **MAKE `centreStage` CONDITIONAL ON RANGE** (carried). It is third or fourth
   in every column of §5.C⁵'s table, which is new evidence for an old item.
6. 📏 **THEN A REAL BENCH.** §6.6's bar is ~2000. Nothing here is above 120.
7. 🪦 **THE SMASH IS STILL UNMODELLED.** Oldest debt on the list, unchanged.

### 5.F⁵ 📌 Housekeeping

⚠️ **THE ⁴ MARKERS MOVED DOWN A SECTION.** The 2026-08-18 (evening) handoff is now
`## 5-prev.` and keeps its `⁗` subsection markers; this session uses `⁵`.

Two new probes in `.scratch/`, both worth keeping:
- **`stackorder.mjs`** — what the composition step-picker actually returns, and
  what the bot goes into the action phase holding. ⚠️ Its `[control]` row calls
  the OLD picker directly and will keep reporting `stackCommit 0×` forever; that
  is the regression witness for the ordering bug, not a live reading.
- **`stackab.mjs`** — notes-first vs commits-first through the same evaluator.
  The template for asking *"does the evaluator want the thing the search cannot
  reach"*, which is a question this repo is now known to need.

`BOT_JOURNAL_MAX` in the monolith went **4000 → 12000**, because entries are
several times bigger (term vectors on the top two options, per-step candidates on
a compose entry). Leaving it would have quietly turned "a long match" into "the
last third of a long match".

📌 Git writes still fail from the agent's shell on this mount (§5-prev). Commit
from a normal terminal. `_to_delete/` still needs removing by hand.

### 5.G⁵ 🏆 THE FINISHING SCREEN THAT NEVER CAME — one rule, two copies

Alex played a match to ⭐**27/21** on `first to 21 FP wins` and the game just kept
going. The Fame target is tested in **exactly one place** — the bottom of
`grantFame` — and there are **two `grantFame`s**:

| | `engine/systems/battleFlow.js` | `rlsw-simulator-v3_8_1.jsx` |
|---|---|---|
| who routes through it | Fame banked inside a BATTLE | riff-off payouts, cadences, Azrael streaks, poses, boss damage |
| `ROCK_GODS_SHELVED` disjunct | ✅ added 2026-08-18 | ❌ **never added** |
| `cap` argument (`RIFF_FP_TURN_CAP`) | ✅ added 2026-08-18 | ❌ **never added** — see below |

🎯 **AND THE SUMMON IS A ONE-WAY DOOR.** Crossing the target with a lead under
`ROCK_GOD_RUNAWAY_LEAD` (3) called `summonRockGod` — a finale the design SHELVED
on 2026-08-18 — and `rockGod.summoned` then gates that same branch *for the rest
of the match*. One close crossing outside a battle and the Fame win is
unreachable forever, which is exactly what ⭐27/21-and-still-playing looks like.

**Shipped:** the client's copy gains `ROCK_GODS_SHELVED ||`, so one shelf is read
in both places.

⚠️ **AND A SECOND FIX, BECAUSE THE FIRST ONE ONLY CLOSES THE BRANCH WE FOUND.**
`checkStandingFameWin` now runs at the top of `startNewTurnNotes`. The old check
fires on a TRANSITION and so cannot notice a state the game is already IN — and
at least three routes return from `grantFame` before reaching it: the ⛔ per-turn
cap (`finalFp <= 0`), a throw inside `checkStageFxThresholds` (which runs first),
and the God gate. Whoever is over the line at the top of any turn is crowned
then, whatever happened on the beat they crossed it.

📌 **THE `cap` DRIFT IS LEFT ALONE AND WRITTEN DOWN INSTEAD.** Alex's scope call.
`RIFF_FP_TURN_CAP = 8` exists so a duel can bank more than an ordinary turn's 4 —
and the client's `grantFame` has no `cap` parameter at all, so **in the shipped
game every duel payout is still clipped at 4**. `battleFlowCheck` §5a is green on
the engine's copy throughout. This is the same shape as the row above it.

### 5.H⁵ ⬇ THE JOURNAL DOWNLOAD WROTE 0 BYTES AND SAID NOTHING

Two `bot-journal-*.json` in `.scratch/journals/`, both empty, both from a session
where the panel was showing 80 decisions. A save dialog CREATES the file when it
is confirmed and the bytes only arrive at `close()`, so anything that throws in
between leaves the named file on disk at zero length — and `download()` wrapped
the whole picker branch in a bare `catch {}`, so nothing reached the console
either. **The cause is still unknown and that is the finding**: the instrument
destroyed its own evidence.

**Shipped:** the JSON is built BEFORE the picker opens (so an unserialisable
journal is reported before a file is named), `AbortError` is the only swallowed
error, every other failure is `console.error`'d AND shown in red beside the ⬇
button, and the Blob fallback still runs after a picker failure.

📌 `.scratch/jsonprobe.mjs` rules out the obvious suspect: a 171-entry journal
stringifies fine at 571 KB, and the only non-JSON-safe value in it is a
`-Infinity` score, which serialises to `null` rather than throwing.

### 5.I⁵ 🧪 WHAT THE MONSTER ACTUALLY DOES WITH HIS OOZE

`.scratch/slimeuse.mjs`, 24 matches, searcher every seat, 3 lives, legal-vs-chosen
per kind:

| Metalness_Monster | legal | chosen | took it |
|---|---|---|---|
| `slime` | 478× | 254× | **53.1%** |
| `slide` | 441× | 147× | 33.3% |
| `tentacle` | 9× | **0×** | 0% |
| `eleven` | 760× | **0×** | 0% |
| `swing` | 427× | 24× | 5.6% |

🎯 **HE CALLS SLIME MORE THAN HE DOES ANYTHING BUT MOVE AND FACE — AND NOT ONE
TERM IN `evaluate` MENTIONS THE TRAIL.** `legalActions` hands `slime` an
`apGranted: SLIME_MOVE_STEPS`, and `apBanked` is in every column of §5.C⁵'s
close-call table. **He is not laying ooze; he is buying steps, and the ooze is a
side effect he cannot see.** §5.A's predictor in its purest form.

⚠️ **AND THE BENCH CANNOT DISAGREE, BECAUSE IN THE BENCH THE TRAIL IS INERT** —
§5.E⁵ item 1b. The 53% is a reading of a game where slime is a free AP button
with no downside for anyone.

📌 `eleven` legal **760×**, chosen **0×** — carried item #3, and the detector is
getting louder, not quieter (331× at the last count).

### 5.J⁵ 📌 Housekeeping

Suites, unchanged and quoted because they are: engine ✅, legal 580, eval 151,
transition 241, turnflow 61, determinism 22, battleflow 50, melody 159, slime 127,
eleven 38, score 122, harness 1843, skilltree 208, trace 1700, riffparity 127598.
⚠️ **NOTHING MOVED, AND NOTHING SHOULD HAVE.** Both edits are in the monolith and
in `ui/`, which no suite covers — the win rule has no test because the client's
copy of it has never had one. `reviewsmoke` covers the `BotReview` edit; the
`grantFame` copy is covered by `check:bundle` and by nothing else.

Two new probes in `.scratch/`, both cheap and both worth keeping:
- **`slimeuse.mjs`** — legal-vs-chosen per kind for the whole kit, per seat.
- **`jsonprobe.mjs`** — reproduces `BotReview`'s `payload()` on a real journal.

---

## 5-prev. 🧭 session handoff, 2026-08-18 (evening)

> ⚠️ **PARTLY COMMITTED.** §5.A⁗–5.I⁗ (the `pressure` fix and the searcher
> wiring) are in `230ff8e`; 5.J⁗'s journal is NOT — `package.json`, `play.js`,
> the monolith, `policies/botJournal.js`, `engine/botTraceCheck.mjs`,
> `ui/BotReview.jsx`, `.scratch/journal.mjs`. All suites green. The session
> before this one (§5-day) is `6f2fe00`.
>
> 🧹 **AND `230ff8e` SWALLOWED THE SCRATCH JUNK.** `_to_delete/session0818b/`
> carried a **4.4MB** throwaway tarball and a copy of HEAD's `evaluate.js` into
> history, alongside `_to_delete/gitlocks/`. ⚠️ The agent cannot delete files on
> this mount (`unlink: Operation not permitted`), which is why they were parked in
> `_to_delete/` in the first place — `git rm -r _to_delete` by hand, and note the
> blobs stay in history regardless unless somebody decides that matters.
>
> 🧠 **AND IT REVIEWS ITSELF NOW** — 5.J⁗, the 🧠 REVIEW button. On its first run
> it found #15: Metalness has never once played Goes to Eleven, legal 263 times.
>
> 🧠 **AND THE SEARCHER IS PLAYABLE FOR THE FIRST TIME** — 5.I⁗. Tick the `🧠`
> box next to a CPU corner in the Lobby. Everything §5/§6.6 has been tuning was
> headless-only until tonight; the client did not import `play.js` at all.
>
> ✅ **§5.E‴ ITEM 2 IS CLOSED** — `pressure`'s knockback inversion. Read
> `BOT_STRATEGY_HANDOFF.md` §6.6.11.
>
> 🎯 **AND THE BENCH TOOK YESTERDAY'S WIN RATE BACK.** §6.6.10's "searcher
> 52.5% ±12.7" was 60 seeds. At **300 seeds it is 42.7% ±5.7**, and the fixed
> tree is 41.1% ±5.6 — one point apart, 50% outside both intervals. The beam's
> ranking is not buying nothing; **it is losing to its own absence.** That makes
> §5.E‴ item 4 the top of the list, and it now has a number instead of a shrug.

### 5.A⁗ The pattern is TEN for ten — and a machine found the tenth

§5.A's predictor, unchanged:

> The game rewards something. The evaluator has no term for it — or has a term
> for the reward's RESULT but not for the act of going and getting it. So the bot
> never does it, nothing errors, every suite stays green.

| # | the blind spot | symptom it wore |
|---|---|---|
| 14 | chip Vibe reach-weighted at full strength, against a rule where **every attack knocks the target back** | a landed blow scored `pressure` **negative** on 3% of hits — all of them hits on somebody nearly down |
| 15 | `evaluate` has no term for being LOUD — `atEleven` is in no row of the weight table | 🔊 `eleven` legal on **263** decisions across 12 matches, chosen **0** times (5.J⁗) |

🎯 **#14 IS #10's SHAPE FOR THE THIRD TIME IN THREE SESSIONS.** `adjWounded`
scored standing next to a bleeding rival, so finishing them paid nothing.
`beamSetup` scored lining a Sonic up, so firing it cost 1.96. `pressure` scored
being close enough to convert damage, so dealing it lost more than it gained.
**Every term that scores GETTING READY has to be capped below what DOING it
pays** — that rule has now been derived independently three times, and
`chargeSeek` is still the only term that shipped with it written down.

### 5.B⁗ What shipped (uncommitted)

- 💢 **`chipReachWeight`** in `evaluate.js` — `reachWeight` mixed back toward 1 by
  `PRESSURE_CHIP_REACH_MIX`, and it is the chip-Vibe half of `pressure` that reads
  it. `reachWeight` itself is untouched, because `beamSetup` and `evalCheck` both
  depend on its shape.
- 🧮 **The mix is DERIVED FROM THE ROSTER, not tuned** —
  `0.9 / ((maxVibePool − 1) × (1 − PRESSURE_REACH_FLOOR))`, which is the worst-case
  ratio (a 1-point hit on a rival at 2 Vibe, knocked the full 2 hexes) rearranged.
  0.346 today. A deeper Vibe pool tightens the ratio, so a hard-coded number would
  be correct now and wrong the day the roster grows.
- 🔬 **`evalCheck` 134 → 151 assertions** — the property SWEPT (every roster Vibe
  pool × every Vibe level × knockback 1 and 2), plus three that stop the fix from
  passing by flattening the gradient into a constant. HEAD's own 134 assertions
  were also run against the new `evaluate` and all passed.
- 📒 **`.scratch/pressureswing.mjs`** — the inversion probe. Walks real matches,
  keeps only blows that LANDED, reports the `pressure` delta next to the geometry.
- 📏 **`.scratch/pressureab.mjs`** — the A/B. Runs UNCHANGED on both trees
  (`ab68.mjs` discipline), because a formula change cannot be expressed through
  `weightOverrides`; the header says how to build the HEAD checkout.
- 🧠 **THE SEARCHER, WIRED IN** (5.I⁗) — `botSearcherStep` and its translation
  table in the monolith, a `botPolicy` toggle in `ui/Lobby.jsx`,
  `BOT_CLIENT_KINDS`/`BOT_CLIENT_GAPS` in `policies/bot.js`,
  `legalActionsCheck` §16, and `.scratch/clientkinds.mjs`. `clickNoteStock`'s
  `_forceChordMode` may now NAME the stack ('drive' | 'sustain'); every existing
  caller passed `true` and still means Drive.
- 🧠 **THE JOURNAL** (5.J⁗) — `policies/botJournal.js`, `trace`/`audit` on
  `searcherPolicy`, `ui/BotReview.jsx`, `npm run test:trace` (1435 assertions),
  `.scratch/journal.mjs`.
- 🔧 **The bot watchdog re-arms per ACTION, not per turn**, and the searcher
  driver carries its own 60-tick ceiling because that re-arm opens a live-lock
  the watchdog can no longer see. Both explained in §6.6.12.

### 5.C⁗ 🎯 THE FINDING — the ranking is behind, and 60 seeds hid it

| two-gate, three lives | HEAD | this pass |
|---|---|---|
| 60 seeds | 52.5% ±12.7 | 38.3% ±12.3 |
| **300 seeds** | **42.7% ±5.7** | **41.1% ±5.6** |

Read the top row as an object lesson. It reproduces §6.6.10's headline number
exactly, and it disagrees with the fixed tree by 14 points — a difference that is
entirely gone at 300 seeds. **Two configurations that are one point apart looked
like a 14-point swing.** §6.6's own bar is ~2000 matches and every number in
§6.6.9–11 is 30–300; this is what that warning cashes out as.

⚠️ **AND THE LEVEL MATTERS MORE THAN THE DELTA.** `unranked` is the same searcher
with the beam's `score` turned off, so ~42% with 50% outside the interval says the
ranking is actively costing the bot games. It is not a tie and it is not an edge.

### 5.D⁗ THE STATE OF THE GAME RIGHT NOW

200 matches a tree, same seeds, three lives: decided 199/200 → 198/200, mean turns
35 → 37, FP per turn 0.711 → 0.697, duels 277 → **297**, Sonics 218 → **279**,
swings 1259 → 1207. Two lives: FP per turn 0.716 → **0.759**, duels 255 → 278.

⚠️ **ONLY THE SONIC COLUMN IS A RESULT.** +28%, and it is the action a knockback-
charging term punished hardest — a Sonic shoves the target down the beam by
definition. Everything else is population noise at n=200. Nothing here is quoted
as an improvement; the fix is worth having because the sign was wrong, not because
the bench moved.

📌 **Suites, this pass:** engine ✅, legal 547, eval **151**, transition 241,
turnflow 61, determinism 22, battleflow 50, melody 159, slime 127, eleven 38,
score 122, harness **1738**, riffparity 127598, skilltree 208, `check:bundle` OK.
⚠️ **`harness` went 1709 → 1738 and that is NOT new coverage** — `harnessCheck`
asserts inside `for (const turn of log) for (const a of turn.actions)`, so its
count tracks how many actions the bots take. More Sonics, more assertions. A count
that moves with behaviour cannot be read as a coverage signal in either direction.

### 5.E⁗ 🎯 NEXT, IN DEPENDENCY ORDER

1. 🥁 **WHY IS THE RANKING BEHIND?** Promoted from item 4, and it is the whole
   list's blocker. At 300 seeds the beam's `score` loses to its own absence —
   42.7% / 41.1% against 50%, with 50 outside both intervals.

   🎯 **THE AUDIT HAS ALREADY HALVED THE QUESTION** (5.J⁗). Two hypotheses were on
   the table: the ranking prunes a branch the evaluator would have liked (a SEARCH
   bug), or the evaluator is confidently wrong about a class of position and
   ranking by it just arrives there faster (an EVAL bug). Over ~1,860 action
   decisions the beam threw away a better option **15 times, worth 5.6 points
   total** — so it is not pruning wrong, and the first hypothesis is dead. What is
   left is the expensive one, which is also the one that explains why three
   sessions of eval fixes have not moved this number.

   🧠 **AND THERE ARE TWO INSTRUMENTS ON IT NOW: play it, and read the journal**
   (5.I⁗, 5.J⁗). One candidate no bench could ever have produced is in §6.6.12's
   open list — `attackParams` (what the searcher plans against) and
   `initiateSwing` (what the client actually resolves) are not pinned to each
   other, and nothing in the repo would say so if they disagreed.

2. 🔊 **GIVE `evaluate` A TERM FOR BEING LOUD** (5.J⁗, bug #15). `eleven` legal
   263×, chosen 0×. The Sustain stack leaving is visible to the weight table and
   nothing arriving is. ⚠️ Same shape as `kit` before §6.6.6 — and note that the
   fix is a NEW TERM, which §5's Earned lens says must trace to a decision rather
   than a stat block. It is also the cheapest possible test of the journal: the
   detector should go quiet when the term lands, and if it does not, the term is
   wrong.
3. 🧮 **RE-PRICE `awardRiffFame` INTO THE BAND** (§5.C‴, carried). Mean uncapped
   award 15.85 against a cap of 8, 96% clipped, dominant term `ceil(margin / 2)`
   where `margin` grows with riff LENGTH for no reason a player could see. Every
   term in the payout is invisible to the searcher until this lands.
4. 🔊 **MAKE `centreStage` CONDITIONAL ON RANGE** (carried, unchanged, from §5.E″
   item 2). The middle is outside a tier-0 rig, so centre and `inRig` fight and the
   beam loses.
5. 📏 **THEN A REAL BENCH.** ⚠️ 300 seeds was enough to delete a headline this
   session. §6.6's bar is ~2000 and nothing in §6.6.9–11 is close to it.
6. 🪦 **THE SMASH IS STILL UNMODELLED.** Oldest debt on the list, unchanged.

### 5.I⁗ 🧠 THE SEARCHER IS IN THE CHAIR — Alex's call, and it was the right one

> *"I think a med student can study all the science behind health and the body all
> she wants, but until she gets put in the situation where the tools become
> necessary all it is is theory."*

He asked to have a go at one of these. Checking what he could actually have a go
AT turned up the thing this list should have opened with: **the client imports
`bot.js` and `legalActions.js` and nothing else from `policies/`.** Not `play.js`,
not `evaluate.js`, not `transition.js`. Four sessions of weight tuning, and none
of it had ever run in the game.

**Shipped:** a `🧠` toggle per CPU corner writes `botPolicy` onto the spirit, and
the step-machine hands over to a driver that keeps its CADENCE and replaces its
JUDGEMENT — `POLICIES.searcher` chooses, the existing client functions execute,
one action per tick. `playTurn` is deliberately unused: it would advance the
seeded cursor outside `dispatch()` and desync every peer, and the client resolves
a Swing as a cinematic rather than a call. Full reasoning in
`BOT_STRATEGY_HANDOFF.md` §6.6.12.

🎯 **AND THE FIRST MEASUREMENT PAID FOR THE WHOLE EXERCISE.**
`.scratch/clientkinds.mjs` counts what the searcher CHOOSES against what the
client can PERFORM: **6.50% of decisions contained a kind with no client path**,
all of it Metalness's trail and dial (`slime` 2.8% of actions, `slide` 0.6%). He
would have visibly given up mid-turn in front of a player. Wiring `callSlime`,
`callEleven` and `slide` — three switch cases over functions that already existed
— took it to **0.00%**. No bench could have found that, because the bench IS the
thing that has no client.

⚠️ **THE TWO BOTS ARE NOT THE SAME BOT.** Before anyone compares them: the Smash
and the Blaster are `UNMODELLED_KINDS`, so the searcher can never choose the
legacy bot's two best attacks; and `botExecuteStackCommits` never spends
`usedStockIdx`, so the legacy bot has been getting its chords for free while the
searcher pays. Both are named in §6.6.12 and neither is fixed here.

📌 Pinned: `BOT_CLIENT_KINDS` / `BOT_CLIENT_GAPS` in `bot.js`, asserted both ways
against `MODELLED_KINDS` in `legalActionsCheck` §16 (547 → **580**). It cannot see
the switch statement, and the comment says so.


### 5.J⁗ 🧠 THE FEEDBACK LOOP — and bug #15, found by it on its first run

Alex: *"Is there a way to hook up the Computer players to a feedback system that
can be reviewed after every game?"* There was, and it was nearly free: the
searcher already prices every option the beam keeps and then discards all but the
winner. A `trace` sink keeps them. Full account in `BOT_STRATEGY_HANDOFF.md`
§6.6.13.

**Shipped:** `policies/botJournal.js` (entry shapes + a pure `journalSummary`),
`trace` and `audit` options on `searcherPolicy`, `ui/BotReview.jsx` behind a 🧠
REVIEW button with a JSON download, `npm run test:trace` (**1435** assertions),
and `.scratch/journal.mjs` for the same summary over a bench run.

⚠️ **THE ASSERTION IT ALL RESTS ON:** the same seed played untraced, traced, and
traced-with-audit produces the same winner, the same turns, the same Fame **and
the same list of chosen actions**. A journal that changed the game it journalled
would make every reading taken through it describe a bot nobody plays against.

#### 🐛 #15 — GOES TO ELEVEN HAS NEVER BEEN PLAYED

| # | the blind spot | symptom it wore |
|---|---|---|
| 15 | `evaluate` has no term for being LOUD — `atEleven` is in no row of the weight table | 🔊 `eleven` was legal on **263** decisions across 12 matches and chosen **0** times, while `slime` was chosen 122× from the same kit |

The centrepiece of `METALNESS_REWORK_DESIGN.md` §0 — armour into volume, the one
rule that finally reads his Sustain stat — and the searcher can see the Sustain
stack LEAVE and cannot see anything arrive. Nine for nine on §5.A's predictor, and
this is the first one a machine found rather than a person.

#### 🎯 AND HALF AN ANSWER TO ITEM 1, FROM THE AUDIT

Over ~1,860 action decisions the beam threw away a better option **15 times, worth
5.6 points total**. **The ranking is not losing the game by pruning wrong.** That
kills the cheaper of item 1's two hypotheses and leaves the expensive one: the
evaluator is confidently wrong about a class of position and ranking by it simply
arrives there sooner.

📌 Two unsettled readings, both in §6.6.13: `face` is the single most-chosen action
in the game (349 of the Ronin's 913 decisions), and 57–79% of decisions are
"close calls" — which is either a badly-chosen threshold or a bot whose turns are
coin flips between its top two options. Neither is quotable yet.

### 5.F⁗ 📌 Housekeeping

⚠️ **GIT WRITES FAIL FROM THE AGENT'S SHELL ON THIS MOUNT.** `git stash` died with
`unable to unlink .git/index.lock — Operation not permitted` and left a zero-byte
lock behind; the working tree was untouched, and the lock is now in
`_to_delete/gitlocks/`. **Commit from a normal terminal, not from the agent.**
The A/B's HEAD checkout was built by `cp` + `git show HEAD:…` into `/tmp` for the
same reason — no worktree was created, so §5.G‴'s stale registration is still the
only one and `git worktree prune` is still owed.

`.scratch/` gained `journal.mjs` (the review panel's summary over a bench run —
5.J⁗), `clientkinds.mjs` (what the searcher chooses vs what the
client can perform — 5.I⁗), `pressureswing.mjs` (the inversion probe) and
`pressureab.mjs` (the A/B). Both are worth keeping: the first is the only thing in
the repo that measures whether an attack SCORES like an attack, and the second is
the template for A/B-ing a formula rather than a weight.

⚠️ **AND A PROBE BUG WORTH REMEMBERING:** the first cut of `pressureab.mjs` read
`r.lives` off the match result and reported "lives lost 0" — on **both** trees.
`runMatch` returns `winner / turns / reason / fame / limelightScores / duels` and
nothing else. A metric that reads a field that does not exist reports a tidy zero
and agrees with itself perfectly. Lives are counted off the board between policy
calls now.

📌 `_to_delete/` still holds `riffLibrary.js`, `RiffBanner.jsx` and `mono.diff`,
plus this session's `gitlocks/` and `session0818b/` (throwaway tarball + a HEAD
copy of `evaluate.js`). Still needs removing by hand.

---

## 5-day. 🧭 session handoff, 2026-08-18 (day)

> ⚠️ **NOTHING IS COMMITTED THIS SESSION** — 12 files, all suites green. Read
> this, then `BOT_STRATEGY_HANDOFF.md` §6.6.9. The previous session (§5-late) is
> committed as `805b1ec`.
>
> 🪦 **AND TWO OF ALEX'S CALLS LANDED TODAY:** Rock Gods are shelved (5.F‴), and
> the riff-off has its own Fame ceiling (5.C‴).
>
> 🎯 **THEN ALEX ASKED THE RIGHT QUESTION AND IT BROKE THE SESSION OPEN** — see
> 5.H‴ and `BOT_STRATEGY_HANDOFF.md` §6.6.10. The bots were not failing to finish
> matches. **They were choosing not to play**, and one over-weighted evaluator
> term was the whole of it. Inconclusive matches: **65% → 2%.**

### 5.A‴ The pattern is eight for eight — and this is the THIRD sign it wears

§5.A named the most reliable bug predictor in this repo:

> The game rewards something. The evaluator has no term for it — or has a term
> for the reward's RESULT but not for the act of going and getting it. So the bot
> never does it, nothing errors, every suite stays green.

| # | the blind spot | symptom it wore |
|---|---|---|
| 12 | `verdict.close` was computed and read only by the client | **0 of 238 bench duels ever reached Round 2** — the majority of duels, by the rules |
| 13 | the Round-2 bonus is granted in full and **clipped to nothing** | escalation landed, and FP per turn moved 0.067 → 0.066 |

🎯 **#13 IS A SHAPE THIS LIST HAS NOT HELD BEFORE.** #10 was a reward the bot
could not reach. #11 was a penalty it could not shed. This one is a reward it
reaches, collects, and then hands to `grantFame`, which throws it away at the
4 FP-per-turn cap. A rule can be present, reachable, exercised and green, and
still pay zero.

### 5.B‴ What shipped (uncommitted)

- ⚡ **Round 2 is driven headlessly** — `transition.js`'s `riffOff` case
  escalates on `verdict.close`, the client's own gate, capped at two rounds.
  `HARNESS_GAPS.riffRound2` is **deleted**. 116 of 205 duels (57%) now go to
  sudden death; the both-paid consolation, which `bothStrong` gates on
  `round >= 2`, fires for the first time.
- 📒 **The duel ledger** — `playTurn`/`runMatch` return
  `{ fought, round2, ties, bothPaid, fp, fpRound2 }`. `fp` is the FP that
  actually LANDED, for the same reason `limelightScores` exists: a duel resolved
  and a duel paid are different events, and only the second one is the economy.
- 🔬 **9 new transition assertions**, sweeping 60 seeds rather than pinning one —
  close escalates, decisive does not, nothing reaches Round 3, no close duel is
  allowed to stop at Round 1, and the loser of a hard-fought duel gets paid.
- 📌 **`HARNESS_GAPS.riffRound2Speed`** — sudden death's 0.58× chart is played at
  Round-1 difficulty, because `simulateRiffPerformance` has no tempo term.
  Declared, not patched with a guessed penalty.
- 🎤 **`RIFF_FP_TURN_CAP` = 8** (Alex's call) — a HIGHER cap for the duel, not an
  exemption: overflow is still discarded and `fameThisTurn` is still one shared
  window, so a Spirit carried past 4 by a duel banks nothing else that turn.
  `grantFame` took a `cap` argument to do it; every other caller is unchanged
  because it defaults to `FAME_PER_TURN_CAP`. 5 new battleFlow assertions.
- 🪦 **Rock Gods shelved** (Alex's call) — `ROCK_GODS_SHELVED` in
  `data/rockGods.js`; `grantFame` crowns on the Fame target at any number of
  lives. See 5.F‴.

### 5.C‴ 🎯 THE FINDING — the Fame cap is the ceiling on every play in the game

`awardRiffFame` builds the duel's payout out of six terms and the underdog
multiplier. `grantFame` then clips the lot at `FAME_PER_TURN_CAP` = **4**.

| duels that… | count | FP banked per duel |
|---|---|---|
| ended in Round 1 | 37 | **3.89** |
| went to Round 2 | 57 | **3.81** |

A Round-1 win on margin 2 is already at the ceiling. So sudden death's +2 is
awarded and discarded — and so are the margin scaling, the perfect bonus, the
Headliner belt, the stage-FX rider and the underdog multiplier, all of them, all
the time.

📌 **The biggest Fame play in the rules pays a bot exactly what a pose round
pays it.** `POSE_FP_MAX` is 4 too, matched to the cap on purpose.

✅ **ALEX'S CALL, SAME DAY: the duel gets its own ceiling** — `RIFF_FP_TURN_CAP`
= `FAME_PER_TURN_CAP × 2` = 8. And the searcher answered immediately: duels
chosen went **28 → 37** at two lives and **12 → 29** at three, on the same
policy, the same beam and the same weights. It was never avoiding riff-offs; it
was correctly pricing an action whose reward was deleted after the fact.

⚠️ **THE LADDER IS STILL SATURATED, THOUGH — Round 1 now pays 7.77 and Round 2
7.79.** Instrumenting every riff grant says why: mean base **8.34** before
multipliers, mean crowd multiplier **×1.90**, mean uncapped award **15.85**, mean
banked 7.81, **96% clipped**. `awardRiffFame` is writing 16 FP cheques against a
4 FP account, and a whole life is worth 8. The dominant term is
`ceil(margin / 2)`, where `margin` is a SCALED SCORE GAP that grows with riff
length — the same objection `RIFF_CLOSE_QUALITY_GAP` was introduced to fix on the
Round-2 gate, never carried across to the payout.

📌 **And the cap is load-bearing, so nobody should be tempted to delete it:**
with the duel ceiling lifted entirely, matches end in a mean of **14 turns**,
40/40 decided. The cap is the only thing that has been balancing the riff-off.

### 5.D‴ THE STATE OF THE GAME RIGHT NOW

Same seeds, same fixture, HEAD vs this pass, **250 matches each**: mean length
188 → **182** turns, decided 153/250 → **158/250**, FP per turn 0.067 →
**0.066**, duels reaching Round 2 **0 → 116**.

⚠️ **THE FIRST THREE COLUMNS ARE NOISE AND MUST BE READ AS NOISE.** 250 matches
is roughly ±6 points on the decided rate, and Round 2 draws from the rng, so
every roll after the first duel diverges — these are population comparisons, not
paired ones. The only column that measures the change is the last, and the FP
column is the finding precisely because it did NOT move.

### 5.E‴ 🎯 NEXT, IN DEPENDENCY ORDER

1. ✅ ~~**FIND OUT WHY HALF OF ALL THREE-LIFE MATCHES NEVER FINISH.**~~ **DONE
   THE SAME SESSION — see 5.H‴.** It was not the Fame economy drying up. It was
   `beamSetup` priced above the Fame it sets up, so `endTurn` outscored every
   action on the board. Inconclusive 65% → 2%, three lives is the default, and
   the diagnosis that replaced it is in §6.6.10.
2. ✅ ~~**FIX `pressure`'s KNOCKBACK INVERSION**~~ **DONE 2026-08-18 (evening) — see §5 above and `BOT_STRATEGY_HANDOFF.md` §6.6.11.** The reach gradient is bounded below one point of damage now; 3% of landed blows scored negative, 0% do. (5.H‴). A swing that LANDS scores
   `pressure` **−0.41**, because the term reach-weights chip Vibe and a good hit
   shoves the rival out of reach. §5's comment block solved exactly this for
   lives and left chip Vibe exposed. One variable, one A/B — and it is the last
   term still telling the bot that hurting somebody is a bad idea.
3. 🧮 **RE-PRICE `awardRiffFame` INTO THE BAND** (§5.C‴). Not the cap again — the
   award. Get the uncapped payout to land between 4 and 8 across the realistic
   spread of margins, perfects and rounds, and every term in it becomes visible
   to the searcher for the first time. Start with `ceil(margin / 2)`, where
   `margin` scales with riff LENGTH for no reason a player could see.
4. 🥁 **ASK WHY THE RANKING BUYS NOTHING.** The two-gate bench now runs on a
   population where 98% of matches finish, and the searcher beats the SAME
   searcher-with-ranking-off **52.5% ±12.7**. That is not an edge. It was
   unanswerable while two thirds of matches were excluded; it is answerable now.
5. 🔊 **MAKE `centreStage` CONDITIONAL ON RANGE** (carried, unchanged, from
   §5.E″ item 2). The middle is outside a tier-0 rig, so centre and `inRig`
   fight and the beam loses.
6. 📏 **THEN A REAL BENCH.** ⚠️ Every number in §6.6.9–10 is 30–250 matches;
   §6.6's bar is ~2000. The inconclusive gate finally has a value worth setting:
   2%.
7. 🪦 **THE SMASH IS STILL UNMODELLED.** Oldest debt on the list, unchanged.

### 5.F‴ 🪦 ROCK GODS ARE SHELVED — Alex, 2026-08-18

The finale is off the roadmap for now. The bot's only God-aware behaviour is four
lines in `botPlanMove` (converge on the God while one is summoned), now marked 🪦
and left standing: it cannot fire while nothing summons a God, and cutting a
working rule to express a scheduling decision turns a shelf into a rewrite.
`HARNESS_GAPS.summonRockGod` now names a shelved subsystem rather than owed work.

✅ **AND THE RULE MOVED WITH IT (Alex's call).** `grantFame` no longer summons:
reaching the Fame target crowns a Legend outright at any number of lives. That
was the only thing forcing `matchConfig`'s TWO-life matches, which §3.2 and §3.6
are both clear under-rate every investment term the bot has.

⚠️ **THE BENCH DEFAULT STAYED AT TWO ANYWAY, AND THAT IS A FINDING, NOT A
HESITATION** — see 5.E‴ item 1. Three lives is rule-legal and the game will not
finish it. Pass `startingLives: 3` deliberately to reproduce.

### 5.H‴ 🎯 THE ONE THAT MATTERED — the bots were not playing the game

Alex, reading 5.C‴: *"Yo these bots have a problem if they can't finish a game of
like a race to 20 FP."* He was right, and 5.E‴'s original item 1 — "the Fame
economy stops producing" — was wrong.

A stalled 400-turn match, instrumented: the two Spirits stand **adjacent for 417
of 427 samples**, both in rig, and over those 400 turns they play **2,178 melody
notes, 400 confirms, 5 swings and 0 duels**, finishing on 1 Fame and 3. Nose to
nose, fully armed, composing.

The decision dump at turn 120 says why. Scoring every option the way the searcher
does: the position as it stands **14.42**, `endTurn` 13.52, `move` 13.43, `face`
13.25, a live **riff-off 11.19**, `swing` 10.52. **Doing nothing was the best
move on the board.**

🎯 **ONE TERM CARRIES IT.** Taking the duel loses **1.96** of `beamSetup` — which
scores how close you are to firing a Sonic, and firing it knocks the rival off
the line the term is scoring — and gains **0.73** of `fame` for 8 FP, a third of
a 24-point race. A positional term with a cheap full range outweighed a third of
the win condition.

📌 **AND THE RULE IT BROKE IS ONE TERM ABOVE IT IN THE SAME FILE.** `chargeSeek`
ships with an explicit inequality — `charge` > `chargeSeek` — and an explicit
reason: without the hand-off the bot loiters beside a Charge Zone forever rather
than stepping on it. `beamSetup` was written in the same pass with no hand-off
partner and no inequality, and produced exactly that failure. **Any term that
scores getting ready must be capped below what doing it pays.**

Shipped: the `beamSetup` column scaled ×0.32 (Zero 0.9, Ronin 0.7, Metalness 0.5,
default 0.7), keeping the roster ordering, which is character. Three lives, 30
matches: decided **12/30 → 30/30**, mean turns **267 → 34**, FP per turn
**0.070 → 0.742**, duels **20 → 43**. Two-gate bench over 60 seeds: inconclusive
**65% → 2%**, searcher 42.9% ±21.2 → **52.5% ±12.7**.

⚠️ **THE WIN RATE IS THE HONEST HALF OF THAT.** `unranked` is the same searcher
with the beam's ranking off, so ~52% says the RANKING buys little once both seats
will fight. New question, clean instrument — 5.E‴ item 4.

### 5.G‴ 📌 Housekeeping

⚠️ **`git worktree` left a stale registration.** This session compared trees with
a detached worktree at `/tmp/rlsw-head`; the directory is gone but the metadata
in `.git/worktrees/rlsw-head` could not be removed from where the work was done.
One command clears it: `git worktree prune`.

`.scratch/` gained `ab669.mjs`, the A/B behind every number in §6.6.9, and three
probes behind §6.6.10:

- **`whyendturn.mjs` — the one to keep.** The decision dump: every legal action
  scored the way the searcher scores it, plus the WEIGHTED TERM DELTAS for the
  duel and the swing. It is the file that turned "the economy dries up" into
  "`beamSetup` is 1.96 and the Fame is 0.73". ⚠️ Takes the old weight as a second
  argument, because on the fixed tree these matches END and there is no turn 120
  left to dump: `.scratch/whyendturn.mjs 120 2.2`.
- **`beamsweep.mjs`** — the sweep, and **`twogate.mjs`** — the win rate and the
  inconclusive rate reported together, which is the shape §6.6 asked for. Both
  drive the change through `weightOverrides`, so neither needs a code edit to
  re-run against a future weight table. Like
`ab68.mjs` it runs UNCHANGED on both trees — an older checkout has no `duels` on
its match result and simply reports zeros — which is what makes a real
before/after possible instead of a comparison inside one tree. It also gained
`enginesrc.tgz` / `headsrc.tgz`, throwaway tarballs of the engine subset; both
can go.

📌 `_to_delete/` still holds `riffLibrary.js`, `RiffBanner.jsx` and `mono.diff`.
Still needs removing by hand.

---

## 5-late. 🧭 session handoff, 2026-08-17 (late)

> ✅ **THE PREVIOUS SESSION IS COMMITTED** — `fee7be0`, and §5-eve's "STILL
> NOTHING COMMITTED" banner below is stale as a result; it is left in place
> rather than edited so the sequence still reads. **This** session's work is
> uncommitted: ~20 files, all suites green. Read this, then
> `BOT_STRATEGY_HANDOFF.md` §6.6.8.

### 5.A″ The pattern is seven for seven — and this time the sign was inverted

§5.A named the most reliable bug predictor in this repo:

> The game rewards something. The evaluator has no term for it — or has a term
> for the reward's RESULT but not for the act of going and getting it. So the bot
> never does it, nothing errors, every suite stays green.

| # | the blind spot | symptom it wore |
|---|---|---|
| 10 | the pose paid **nothing** headlessly (`HARNESS_GAPS.pose`) | 34 poses struck across 44 matches, **0 rounds ever banked** |
| 11 | `hook('leftLimelight')` had no headless implementation | a bot shoved off the Limelight rolled a **zero defence die for the rest of the match** |

🎯 **AND #11 IS THE PATTERN WITH THE SIGN FLIPPED, WHICH IS NEW.** Every previous
sighting was a reward the bot could not reach. This was a PENALTY IT COULD NOT
TAKE OFF — welded onto a Spirit who never chose to keep posing, running the whole
time in the direction nobody audits. A hook nobody implements is a rule that only
applies to humans.

### 5.B″ What shipped (uncommitted)

- ✨ **`state.limelight`** — `posing` + `scores`, the last two React-owned slices
  any rule depended on. `engine/systems/limelight.js` owns the ladder, which had
  **three separate transcriptions** that agreed only by convention.
- 🌟 **`poseConsequences`** in `battleFlow.js` — the FP grant and the Sustain
  toll as one ordered beat, through `grantFame` like every other payout.
  `transition.js`'s `endTurn` drives it; **`HARNESS_GAPS.pose` is deleted.**
- 🪦 **`leftLimelight` is a rule, not a hook.** All three pose drop sites —
  walking out, being shoved out, hitting the floor — are engine rules now.
- 🎤 **`evaluate`'s `view` argument carries NO game state.** Only
  `weightOverrides`, the bench's instrument, is left in it.
- ✨ **`posePlay` + `POSE_LOOKAHEAD` + `POSE_RISK`** — see 5.C″.
- 🎸 **The monolith is rewired onto all of it**, and four rule reads that used the
  render snapshot now read `engineRef.current` (a rival shoved off the Limelight
  mid-tick used to read as still posing — i.e. as a free clean hit).
- 🔬 eval 124→134, transition 222→232. harness 1681→**1680** — ⚠️ not a lost
  test: it asserts once per action played, so the count tracks the bot's
  decisions. See §6.6.8.

### 5.C″ 🎯 THE FINDING — a greedy search cannot climb a back-loaded ladder

Wiring the payout up was **not enough**, and the reason is a property of the
searcher rather than of the pose.

`pose` costs 0 AP and moves one flag; the FP lands at `endTurn`. So to a
per-action search, posing scores **exactly the same** as not posing — a coin
flip — while handing over the defence die. And the ladder makes it worse, not
better: round one pays 1 FP and round four pays 4, so held from a standing start
the flight is **10 FP, more than two lives** — but the FIRST rung is priced at a
quarter of the cap against a board where a fight is worth 2.5, available now.

📌 **A search that declines the first step of a staircase whose value is entirely
in the last is not malfunctioning. It is correct, once per turn, forever.**

⚠️ **AND THE FIRST FIX WAS MIS-SHAPED IN A WAY WORTH REMEMBERING.** Scaling the
risk with the prize made paying the term MORE buy LESS of it — poses fell from 18
to 13 when the payoff tripled, because the same factor amplified the penalty for
posing in company. The prize grows with the ladder; the danger does not.

### 5.D″ THE STATE OF THE GAME RIGHT NOW

**Same seeds, same fixture, HEAD vs this pass, 44 matches:** mean length
206→**156** turns, decided 24/44→**30/44**, Fame per turn 0.050→**0.089**, and
pose rounds paid **0→39**. On the §6.6 bench (50 matches, searcher vs unranked):
inconclusive 70%→**58%**, draw-inclusive 49%→**53%**.

⚠️ **NEITHER GATE CLEARS AND 50 MATCHES IS ±21 POINTS.** The inconclusive rate is
still four times its bar. This is a direction, not a measurement, and quoting it
as one would repeat exactly the mistake §5.A was written about.

### 5.E″ 🎯 NEXT, IN DEPENDENCY ORDER

1. 🎤 **DRIVE RIFF-OFF ROUND 2.** Now the largest unlit engine: `verdict.close`
   is computed and ignored headlessly, so close duels never escalate — which
   under-pays the biggest Fame play in the rules by 2 FP, a damage band, and the
   entire both-paid consolation. Alex's direction puts riff-offs at the top of
   the Fame economy; the bench still cannot see most of one.
2. 🔊 **MAKE `centreStage` CONDITIONAL ON RANGE** (carried from §5.D′, and
   §6.6.8 made it sharper rather than settling it). The middle is outside a
   tier-0 rig, so centre and `inRig` fight and the beam loses — and the pose is
   now a second reason to stand there. Range I/II is the game's own answer.
3. 📏 **THEN A REAL BENCH.** ⚠️ Every number in §6.6.8 is 44–50 matches. §6.6's
   bar is ~2000. The two-gate instrument exists and nothing else is blocking it;
   what is missing is the patience to run it before touching another weight.
4. 🪦 **THE SMASH IS STILL UNMODELLED**, and §7 explicitly wants to hold its fix
   until §6.6 can measure it. That debt is now the oldest one on this list.

### 5.F″ 📌 Housekeeping

`.scratch/` gained `posecount`, `posesweep`, `posepaid`, `posetrace`, `ab68` —
every number in §6.6.8 came out of one of them. ⚠️ **`ab68.mjs` is the one to
keep**: it runs UNCHANGED on both trees (an older checkout simply reports 0 in
the pose columns), which is what made a real before/after possible instead of a
weight-regime comparison inside one tree. `_sec668.md` and `_sec5.md` are scratch copies
of the two handoff sections written this session and can go.

📌 `_to_delete/` still holds `riffLibrary.js` and `RiffBanner.jsx` from the
morning session. Still needs removing by hand.

---

## 5-eve. 🧭 session handoff, 2026-08-17 (evening)

> ~~⚠️ **STILL NOTHING COMMITTED.**~~ ✅ It is — `fee7be0`, 2026-08-17 22:22.
> Left struck through rather than deleted: a handoff that quietly rewrites its
> own history is harder to trust than one that shows the correction. One working
> tree, ~25 files, all suites green. The morning session's handoff is kept below
> as §5-am — read this first, then `BOT_STRATEGY_HANDOFF.md` §6.6.7.

### 5.A′ The pattern held, and it is now six for six

§5.A named the most reliable bug predictor in this repo:

> The game rewards something. The evaluator has no term for it — or has a term
> for the reward's RESULT but not for the act of going and getting it. So the bot
> never does it, nothing errors, every suite stays green.

Today added three more sightings and one twist:

| # | the blind spot | symptom it wore |
|---|---|---|
| 7 | walking onto a Lost Chord or Charge Zone paid **nothing** headlessly | Intergalactic 0's 2.2 `charge` weight had never fired in any bench match, ever |
| 8 | `startRiffOff` was client-only, so `legalActions` emitted no `riffOff` | **no bench match in this repo's history has contained a duel** |
| 9 | every attack judged on **one dice roll** (§6.4 unbuilt) | an attack legal at 773 decision points, taken 2 times |

🎯 **AND THE TWIST, WHICH IS THE FINDING OF THE DAY.** Once attacking actually
cost something (yesterday's §6.6.2 fix), the weights became measurable — and
**taking a rival's LIFE scored less than the two Drive notes it cost.** That is
§6.6.1's `kit` bug one pool further on: a resource scored in one state only, so
spending it is a pure loss. A bug fix is a measuring instrument switching on.

### 5.B′ What shipped (uncommitted)

- 🎯 **Four board terms** — `centreStage`, `chargeSeek`, `stock`, `beamSetup`.
- 🎲 **§6.4 expectimax** — `ATTACK_SAMPLES` 6, `WIN_SCORE` finite so it averages.
- 🎤 **The riff-off runs** — `legalActions` emits it IN PLACE of the Sonic when
  the beams cross; `awardRiffFame` moved out of the monolith into `battleFlow`.
- 🎯 **Pickups modelled**, kernels in `systems/board.js`, **client rewired**.
- 🎭 **`music/spiritStyle.js`** — six per-Spirit gestures into `perfBig`, paying
  fans and never Fame. Plus the ladder that steers a track toward one.
- 🐛 **`weightsFor`** — a per-Spirit override used to NaN every other seat.
- 📊 **The §6.6 bar restated as TWO gates** in `bench.mjs`, per §5.A.
- 🔬 New assertions: eval 103→124, transition 197→222, melody 152→159,
  score 100→122.

### 5.C′ THE STATE OF THE GAME RIGHT NOW

**Fame moves again: 0.002 → 0.044 per turn, a 22× A/B on fixed seeds.** Matches
that ran 369 turns run 215; 3 in 18 decided inside the cap became 9. Sonics and
riff-offs went from literally never to 8 and 12 across 18 matches.

⚠️ **HALF THE MATCHES STILL HIT THE 400-TURN CAP**, and the new inconclusive gate
(≤15%) is nowhere near cleared. This is the honest headline, not the 22×.

### 5.D′ 🎯 NEXT, IN DEPENDENCY ORDER

1. 🎤 **MOVE `posing` / `limelightScores` INTO ENGINE STATE.** The pose is a
   whole Fame engine that pays nothing headlessly (`HARNESS_GAPS.pose`) — 1 FP
   per round survived, cumulative to 4, which is a full turn's ceiling standing
   still. It is the largest unlit engine and `evaluate`'s `view` argument was
   always documented to disappear on the day those slices land.
2. 🔊 **MAKE `centreStage` CONDITIONAL ON RANGE.** The middle is outside a tier-0
   rig, so the centre term and `inRig` currently fight, and the loser is the beam
   (§6.6.7). Range I/II is the game's own answer; the evaluator should know that
   working the middle is a thing you EARN.
3. 🎤 **DRIVE RIFF-OFF ROUND 2.** `verdict.close` is computed and ignored
   headlessly, so close duels never escalate — which under-pays them by 2 FP, a
   damage band, and the entire both-paid consolation.
4. 📏 **THEN retune against the two gates.** ⚠️ Every weight in §5 was swept on
   9–14 match samples today. That is enough to find a factor of two and nowhere
   near enough to settle a 0.2.

### 5.E′ 📌 Housekeeping

`.scratch/` gained `probe3-5`, `sweep`, `measure`, `pair`, `tension`, `ab`,
`style`, `final`, `wfix` — every number quoted above came out of one of them.
⚠️ **`ab.mjs` is the one to keep**: it is the A/B that separates this session's
evaluator from the previous one at fixed seeds.
⚠️ **A FIXTURE TRAP, WRITTEN DOWN SO NOBODY REPEATS IT.** A probe that builds
seats with `corner: 0, 1, 2` instead of `'blue' | 'purple' | 'yellow'` makes
`CORNERS[corner]` undefined, so `distFromHome` returns 0 and **every Spirit is
permanently in rig, anywhere on the board.** Half a session's tuning was done in
that regime before it was caught, and it flatters everything — Sonics and duels
are always available. Use `bench.mjs`'s `DUEL` fixture.

---

## 5-am. 🧭 session handoff, 2026-08-17 (morning)

> ⚠️ **NOTHING BELOW IS COMMITTED.** One working tree, ~20 files, all suites
> green. Read this section, then §6.6.6 → §6.6.0 in `BOT_STRATEGY_HANDOFF.md`
> (newest first) for the detail.

### 5.A What the day actually established

**One pattern, found six times, and it is now the most reliable bug predictor in
this repo:**

> The game rewards something. The evaluator has no term for it — or has a term
> for the reward's RESULT but not for the act of going and getting it. So the bot
> never does it, nothing errors, every suite stays green, and the only symptom is
> an unrelated number that looks merely disappointing.

| # | the blind spot | symptom it wore |
|---|---|---|
| 1 | no term for harming a rival | 37% of matches never ended |
| 2 | Swing/Sonic cost nothing headlessly | every bench win rate meaningless |
| 3 | nothing valued a track near a riff | 0 riffs in 1,218 commits |
| 4 | `riffBook` never maintained | every riff forever new — a 4-turn win |
| 5 | `?? []` / `?? {}` defaults | made 2 and 4 SILENT rather than loud |
| 6 | **no board-objective term at all** | bots at distance 1 for 83% of turns |

⚠️ **AND A STATISTICS LESSON WORTH KEEPING:** the §6.6 win rate tracked the
EXCLUSION rate almost perfectly across three runs (37%→65.7%, 49%→84.5%,
9.8%→56.3%). Excluding stalls is honest; the survivors are not a random sample,
because a match resolves when someone runs away with it. **The bar was measuring
its own filter.** Restate it as two gates — a win rate on a fixed denominator AND
a maximum inconclusive rate — before tuning anything against it.

### 5.B What shipped (uncommitted)

- 💢 **`pressure`** — rival lives + Vibe missing, the mirror `survival` never had.
  Lives are NOT reach-weighted, chip Vibe is; reach decays to a floor, not zero.
- 🪦 **`adjWounded` cut** — it paid the bot for NOT finishing anyone.
- 🐛 **Attack costs applied** — Swing's 2 Drive notes (on a hit), Sonic's 1
  (hit or miss), `swingExposed`. All were missing headlessly.
- 🔬 **`bench.mjs --weights='{...}'`** — isolate one term at fixed seeds.
- 🪦 **The riff library retired** — all 34, engine to UI, per Alex.

### 5.C ⚠️ THE STATE OF THE GAME RIGHT NOW — read before playing it

**The Fame economy is EMPTY. 0.000 FP per turn.** A 400-turn duel ends 0/16 on
both sides with both crowds maxed. 7 of 8 matches end by knockout, mean 125
rounds. This is the deliberate hole left by retiring the riffs, and it is
measured rather than assumed. ⚠️ `performanceScore` also lost its largest term
(`hasRiff` was +3), so **`perfCliff` — the Ronin's identity weight — is harder to
reach.** Both seats are left EMPTY rather than backfilled.

📌 **So this is a bad moment to playtest.** Finish 5.D first.

### 5.D 🎯 NEXT, IN DEPENDENCY ORDER

Alex's direction, 2026-08-17: *"Sonic should be the main way to gain Fame. And
Riff Offs even more so. And Sonic plays should be powerful for the attacker since
they get potentially more powerful dice. The system should try and devise ways to
reach these potential Fame awards."*

📌 **The combat payouts already agree** — `thrashFame()` is a flat **1**;
`sonicFame(margin)` is `max(1, ceil(margin/2))`, so the beam already scales with
the dice advantage. Nothing to design there, only to reach.

1. 🎯 **BOARD-OBJECTIVE TERMS FIRST** (§6.6.6). The Limelight / centre ring, the
   Charge Zones, the token-and-upgrade pickups. ⚠️ Before the beam term, not
   after: Alex works the middle for objectives and *manoeuvres from there* for a
   Sonic, so a beam term tuned against bots that never travel is tuned against
   the wrong board.
2. 🔊 **A SONIC-SETUP TERM.** Offered on 1.4% of decision points, chosen zero
   times. The beam is a straight line and the Spirits are jammed together.
3. 🎤 **MODEL THE RIFF-OFF TRIGGER.** `startRiffOff` is client-only;
   `legalActions` emits no `riffOff` kind. The engine already has
   `applyRiffOffStarted` AND the whole duel resolver — **only the trigger is
   missing**. Alex expects "several per game"; the bench has never had one.
   ⚠️ It rides on a Sonic, so it is strictly downstream of 2.
4. 🎸 **PER-SPIRIT STYLE → FANS** (the riff replacement). Metalness landing a
   gallop or working a tritone; a cadence that fits THAT Spirit. **Fans, not
   Fame**, so it compounds through the crowd instead of handing over a third of
   the win in one commit. `economy.js`'s `perfBig` is the seat left empty for it.
5. Then restate the §6.6 bar (5.A), and only then retune weights.

### 5.E 📌 Housekeeping

`_to_delete/` holds `riffLibrary.js` and `RiffBanner.jsx` — this session could
not delete files on the local disk, so they were moved aside. Remove the folder.
`.scratch/` holds the day's probes (`fameaudit2`, `fpsources`, `sonicwhy`,
`riffbook`, `swingsweep`, `finisher`) — they are how every number above was
measured and are worth keeping until 5.D lands.

---

## 5-old. ✅ DONE 2026-08-17 — the evaluator can see a fight

### 5.0 ✅ CLOSED — `pressure` is in, `adjWounded` is out, attacks cost something

`evaluate` had no term for harming a rival, so the bot never attacked, so bench
matches could not end. Full write-up: `BOT_STRATEGY_HANDOFF.md` §6.6.0 (and
§6.6.2 for the bug found underneath it).

**What landed:**

- 💢 **`pressure`** — rival lives and Vibe missing, averaged across the field,
  the mirror `survival` never had. Per-Spirit: Metalness **1.8**, Ronin 1.2,
  Intergalactic 0 **0.6** (denial is his win path, not damage). The load-bearing
  design point is that **lives are not reach-weighted and chip Vibe is** — a life
  taken is banked and survives the respawn, chip damage is provisional and only
  worth what you can reach. Reach decays to a **floor**, not zero, so there is a
  gradient pointing at the wounded rather than a flat board outside melee.
- 🪦 **`adjWounded` cut.** It was `pressure`'s Vibe half with a cliff instead of a
  floor — a double-count whose duplicate inverted. It paid for standing beside
  someone bleeding, so acting on it destroyed the payment, and Metalness held the
  highest weight, making the bruiser the most reluctant finisher.
- 🐛 **Attacks were FREE in the bench** and had always been. The Swing's 2 Drive
  notes, the Sonic's 1 and `swingExposed` were never applied headlessly — a
  defaulted destructure in `battleConsequences` swallowed the omission in
  silence. Fourth bug of the §5b family. `transitionCheck` §8a pins it.

**Measured:** inconclusive **37% → 9.8%** over 520 matches; a duel sample that
logged ZERO attacks now decides **12/12**, mean 167 turns.

⚠️ **BUT THE WIN RATE FELL TO 56.3% ±4.5, BELOW THE ≥60% BAR**, and that is now
the open question rather than a closed step. It may not be a regression at all —
the old 70.7%/65.7% figures were computed over the ~63% of matches that resolved,
and those were never a random sample. See §6.6's step 6 for the two competing
readings and the A/B that separates them.

### 5.0a ✅ DONE — the A/B ran, and it disqualified the bar rather than the term

**`--weights='{"pressure":0}'` over the same 520 seeds** (`bench.mjs` grew the
flag; it merges onto the Spirit's column so a one-key object moves exactly one
row). Result:

| run | inconclusive | decided-only | draw-inclusive |
|---|---|---|---|
| costed attacks, no pressure | 49.2% | **84.5%** | 67.5% |
| costed attacks, `pressure` ON | 9.8% | **56.3%** | 55.7% |

⚠️ **THE ≥60% BAR IS NOT A MEASUREMENT OF ANYTHING WHILE IT RISES WITH THE STALL
RATE.** The decided-only rate tracks the exclusion rate across all three runs on
record; under this bar the WORST configuration measured — half the matches never
finishing — scores the best. The searcher did not lose 28 points. The statistic
was reading its own filter.

📌 **`pressure` is what ends matches, not the cost fix.** Attack costs alone made
stalling worse (36.9% → 49.2%); the term took it to 9.8%.

⚠️ **An ~11.8-point residual survives** on the draw-inclusive basis, so this is
narrowed, not closed. Mean match length drops 331 → 209 turns, and short games
decided by dice compress any skill edge — that is the likelier cause than the
weights. Full write-up: `BOT_STRATEGY_HANDOFF.md` §6.6 step 6.

### 5.0b ✅ DONE 2026-08-17 — the riff ladder shipped, and matches now end on Fame

`actionScore.js` grew `riffProgress`: how many of a riff's opening intervals the
track's tail already spells, key-agnostic like `detectRiff`, scored as the GAIN a
candidate note adds. Noise floor at 2 rungs; riffs that cannot fit in the
remaining slots do not steer. Pinned by `test:score` (111, up from 100), including
that **all 34 riffs are reachable by the ladder**.

🐛 **It immediately exposed a fifth bug of the §5b shape.** `riffBook` is React
state the harness never maintained, so `!(view.riffBook ?? {})[id]` made **every
riff forever new** — the same riff paying full FP every turn. Given a reason to
chase riffs, the searcher farmed one to the 4 FP/turn cap and won in four turns.
`?? {}` could not tell "nothing discovered yet" from "not modelled". Fixed in
`transition.js` alongside `unsurePool`.

| | before | after |
|---|---|---|
| riffs matched | **0** in 1,218 commits | 5–6 distinct per match |
| matches ending by Fame | 1 of 8 | **8 of 8** |
| mean length | 89 rounds | **25 rounds** |
| inconclusive @ 520 | 9.8% | **0.0%** |

✅ **§5.0c's bar problem is discharged by construction** — nothing is excluded, so
the denominator no longer moves. ⚠️ But the 96.2% win rate is weak evidence:
`unranked` never chases riffs at all, so the A/B is close to binary. Re-run it
against `ranked: true` with the riff stride zeroed.

### 5.0d 🪦 RIFF LIBRARY RETIRED 2026-08-17 — and the Fame economy is now EMPTY

Alex's call, taken with the numbers in hand: all 34 riffs gone, the ladder gone
with them. They were not rock, and their Fame came from the note DRAW rather than
a decision — a tight game could turn on a shape one player happened to be dealt.
Full write-up and the removal list: `BOT_STRATEGY_HANDOFF.md` §6.6.5.

⚠️ **Measured consequence: 0.000 FP per turn. A 400-turn duel ends 0/16 on both
sides.** 7 of 8 matches now end by knockout, mean 125 rounds. ⚠️ And
`performanceScore` lost its largest term (`hasRiff` was +3), so **`perfCliff` —
the Ronin's identity weight — is harder to reach**. Both holes are left open
rather than backfilled.

### 5.0e ⚠️ NEXT — SONIC AND THE RIFF-OFF ARE THE NEW FAME ENGINE

> Alex, 2026-08-17: *"Sonic should be the main way to gain Fame. And Riff Offs
> even more so. And Sonic plays should be powerful for the attacker since they
> get potentially more powerful dice. The system should try and devise ways to
> reach these potential Fame awards."*

📌 **The payouts already say this** — no design needed, only measurement:
`thrashFame()` is a flat **1**; `sonicFame(margin)` is `max(1, ceil(margin/2))`,
so the beam already scales with the dice advantage. The Sonic is already the
better Fame play and the bot fires **zero**.

Three pieces, in dependency order:

1. ⚠️ **A POSITION TERM FOR BEAM RANGE.** The Sonic is offered on 1.4% of
   decision points because **the Spirits stand at distance 1 for 83% of all
   turns** — jammed together, where the cone is easy and the beam needs
   alignment. Nothing values standing off at beam range, so the bot never
   creates the shot. This is the "devise ways to reach these awards" half and it
   belongs in `evaluate`, not the scorer.
2. **Make the Sonic worth taking when it IS offered** — its Fame is a post-hit
   consequence a one-ply search discounts against immediate costs.
3. 🐛 **MODEL THE RIFF-OFF.** `startRiffOff` is client-only; `legalActions` emits
   no `riffOff` kind. The engine already has `applyRiffOffStarted` and the whole
   duel resolver — **the missing piece is only the trigger**. ⚠️ It rides on a
   Sonic, so it is strictly downstream of 1 and 2.

📌 Then the melody side: **fans for playing to the Spirit's STYLE** (a gallop, a
tritone, a Spirit-appropriate cadence) — fans, not Fame, so it compounds through
the crowd rather than handing over a third of the win in one commit.
`economy.js`'s `perfBig` is the seat left empty for it.

### 5.0f ⚠️ AND THEN — the two Fame engines still switched off

25 rounds against Alex's 15–20 is in range, and the remaining gap has named
causes rather than mystery:

- ✨ **The pose's FP tick is client-owned**, so §3.3 is unreachable headlessly —
  the bot poses and is paid nothing.
- 🎤 **The riff-off never starts.** Measured, not assumed: the Sonic IS offered
  (1.4% of action-phase decision points) and chosen zero times — outscored, not
  missing.
- 📌 And an oddity worth a look: **the two Spirits stand at distance 1 for 83% of
  all turns.**

### 5.0b-old 🎼 the finding that started it — THE BOT HAD NEVER PLAYED A RIFF

> Found 2026-08-17 from Alex: *"when I play, games end in 15-20 rounds tops."*
> Bench matches run **89 rounds**. Full write-up: `BOT_STRATEGY_HANDOFF.md`
> §6.6.3. ⚠️ **This supersedes the bar question below** — there is no point
> recalibrating a bar against a game that is missing its main scoring system.

`fameToWin` is **16 FP**; the per-turn cap is 4. The bot earns **0.105 FP per
turn — 2.6% of the ceiling** — so it cannot win the Fame race and wins by
elimination instead (7 of 8 matches). **Zero riffs and zero cadences across 1,218
melody commits**, against a library of 34 riffs worth 2–5 FP each, whose triggers
are 4 notes long, matched key-agnostically, anywhere in the line. The detector
works — that was the control. Nothing in §5 scores playing one.

**Third instance of the same shape** (§6.6.0, §6.6.1, now this): a whole scoring
system the evaluator has no term for, so the bot never touches it, every test
stays green, and the symptom surfaces as an unrelated number looking sluggish.

🔧 It is an `actionScore.js` job rather than an `evaluate.js` one — the payoff
already lands correctly *after* a riff; what is missing is anything that values a
track one note away from a trigger, and §6.3's split puts "which note" in the
scorer. 📌 Two more Fame engines ride along: the pose's FP tick is client-owned
(§3.3 is unreachable headlessly), and the riff-off is gated behind the Sonic the
bot never fires — fix that and a second engine switches on for free.

### 5.0c ⚠️ THEN — restate the bar

Two gates, not one: a win rate on a denominator that does not move, **and** a
maximum inconclusive rate. Tuning `pressure` against the current bar would be
optimising a number that rewards games not finishing. ⚠️ Do this AFTER 5.0b —
match length is currently a reading of an attrition game, not of the Fame race.

📌 **And the bot is still attack-shy** — 2 swings per match, and the Sonic is
**never chosen once**, despite scoring above every alternative in an isolated
probe at a 4-note stack. That gap between the probe and the match is a thread
worth pulling: it is the shape of a beam that is not offering the action, not of
a weight that is too low.

---

## 5b. Then — harden the bench, then audit the gates

> Written 2026-08-16 at the end of the harness work, so the next session starts
> warm. Both halves are unblocked; do them in this order.

### 5a. The bench's numbers are not yet worth quoting

**37% of matches end inconclusive** at the 400-turn cap once unlocks are live
(up from 12.6% on base kits — gear makes games grindier). `runBench` correctly
EXCLUDES those from the rate rather than scoring them as losses, so the figure
is honest, but it rests on 303 decided matches out of 480.

⚠️ **More matches will not fix this.** More samples of a truncated game measure
the cap, not the policies. The lever is one of:

- raise `MAX_TURNS` (currently 400 in `policies/play.js`) and eat the runtime;
- shorten the Fame target — `matchConfig` already runs 2 lives to sidestep the
  Rock God, and `fameToWin` is `lives × fpPerLife(count)`;
- or find out WHY games stall. ⚠️ Prefer this one first. A 400-turn two-hander
  that cannot close is telling you something about the Fame economy, and it may
  be the more interesting finding — check whether `FAME_PER_TURN_CAP` plus the
  crowd multiplier simply cannot outrun the target at bench Db rates.

📌 Runtime note: matches cost ~150–270ms each, so a 2000-match run is ~5–9
minutes. `bench.mjs` takes `[n] [a] [b] [offset] [--json]` and the seed sequence
is offset-addressable **precisely so a long run can be split into chunks and the
JSON lines summed** — chunking is not sampling twice.

### 5b. ⚠️ THE GATE AUDIT — the class of bug, not the instances

Three bugs landed in one session and **all three hid the same way**: a rule that
existed only in a JSX render condition, where `legalActions` had nothing to
transcribe from. §6.6.1 has the full write-ups. The shape is worth naming:

> The client gates a button; the engine's generator never learns the rule; the
> generator is therefore over-permissive; nothing notices, because the only
> consumer that would notice is a searcher, and the searcher was blind to that
> family for an unrelated reason.

**There is no reason to think three is all of them**, and the surface is
countable: the monolith holds **26** `acting?.id === …` conditions and **24**
`disabled={…}` button gates, against the **15** action kinds `legalActions`
emits. The audit is mechanical rather than clever — walk each client-side gate
and ask whether `legalActions` knows the same rule.

⚠️ **`legalActionsCheck` will not catch these and must not be trusted to.** §15
of that file PASSED for months against `skillUnlock`, a mechanic the game does
not have — every assertion green, pinning a fiction. A test written from the
same misunderstanding as the code agrees with the code. The audit has to read
the CLIENT as the source of truth, not the check.

### 5. Build ONE Theory route end to end — Monster's
`THEORY_ROUTES_DESIGN.md` §4.2 already says this and it is right: build one
branch, see whether a three-rung musical route actually changes how a turn
feels, and **do not commit the roster before that**. With step 4 in place, "feels
better" is now a measurement rather than an opinion.

### 6. Then, and only then: bot eval terms for the new class, and the rest of the roster
§3 of the Theory doc is the payoff — per-Spirit theory gives the searcher a
distinct commit-phase objective to score, which is *a new class of eval term*
rather than a re-weighting. §5 flags that class of change as the most likely to
move observed win rates, because it corrects a blind spot rather than adjusting
sight. That is worth having, and it is worth having **after** there is a harness
to read it with.

---

## 3. What landed today (step 1)

`confirmNoteTrack` is now a **UI shell** over `systems/melodyCommit.js`. The
client owns no commit arithmetic at all.

**Structure.** The kernel returns `patch`, an ordered `effects` list, `logs`,
`flashLines` and `report`; the client applies the patch, walks the effects, and
renders. What remains client-side is what the kernel cannot know — the d6 spin,
the riff sequence, banners, toasts, tips, fan bursts, `applySkillEffects`, and
the HUD turn-step flow. Those are declared in `melodyCommit.CLIENT_OWNED`.

**⚠️ The rng shim is the netcode contract, and it is the one line to protect.**
The kernel asks for `rng.int(n)`. The client passes
`{ int: (n) => drawSeededInt(n) }` so the mic's voice roll advances the cursor
through `randomBatchDrawn` — a **logged** engine action the netcode relays and
every replay reproduces. A bare `makeRng()` there would roll identical numbers
off an unlogged stream and desync every replay and every online client,
**silently**. That is §0.4's failure mode exactly, and it is now pinned by an
assertion.

**Ordering became structural.** The riff's Fame is multiplied by the crowd, so
it must see the fans this commit won and not the cadence fans that land after
it. The shipped client encoded that as `setTimeout(0 / 0 / 500 / 700)` — a real
rule expressed as three animation delays, breakable by anyone retiming a
banner. The effects list encodes it in the list order, so the state writes now
run synchronously and the stagger is free to be what it looks like: cosmetic.

**Two more copies went with it.** `checkWaNoKoe` and `applyWaNoKoe` were both
defined in the monolith — the rule in three places, the write in two. Both are
gone; the rule is the kernel's and the write is part of the commit patch,
**bug and all** (the B10-shaped bug where a pre-commit `tempDrive` overwrites
the Drive boost the same commit just earned is still faithfully reproduced). Its
fix is now a one-place edit, which is the whole point.

**`melodyCommitCheck` §14 was inverted, not deleted.** It was written to be
deleted the day the rewire landed. Deleting it would have thrown away the
question worth keeping. The old guard asked *"does the second copy still
match?"*; the new one asks *"is there a second copy?"* — it fails if any of the
nine pinned expressions comes back into the monolith, if `awardTargetSkill` is
called at the commit site again, or if the rng shim is replaced.

**Verification.** All nine suites green — `melody` 149, `transition` 182, `eval`
85, `legal` 545, `turnflow` 61, `determinism` 22, `battleflow` 45, `riffparity`
127,598, plus the engine selftest. `eslint` clean on the touched files; the app
bundles.

### 3.1 ⚠️ Deliberate behaviour changes — read before blaming a bug

Four, all judged worth it, none accidental:

1. **Fans, Fame and the unsure pool now land synchronously**, in effects order,
   instead of at 0 / 500 / 700 ms. The arithmetic is identical by construction —
   the constraint the delays encoded is the list order — but a player watching
   closely will see the score track move sooner after a riff.
2. **Log order within one commit shifted slightly.** The `✓ Committed` headline
   now sits below the mic line rather than above it. Cosmetic; the kernel emits
   one ordered array and the client no longer interleaves its own calls.
3. **`showTip('intervals')` now also fires on a tritone ENDING.** The client
   previously tested `isMinorSeventhEnd || isMajorThirdEnd`; it now reads
   `report.hasGatedEnding`, which is that set plus `isTritoneEnd`. This is a
   superset and arguably the intended behaviour, but it is a change.
4. **`awardTargetSkill` no longer runs at the commit site.** It must not: the
   state half is already in the patch (`targetSkillId` cleared), so the old call
   would take its no-op branch and the side-effect chain would never fire. Only
   `applySkillEffects` + `showTip('skill_unlock')` run now. The 🏆 log line is
   the kernel's and keeps the skill icon.

No copy was lost. The kernel now derives the crowd multiplier for the fan log
itself (`crowdMultiplier` was already beside `hexRingFromCenter`, and
`assignments` is on the sheet), so the `(×1.23)` suffix survives in one place
rather than two.

---

## 4. The stop rule

Each step below has a condition that says it is finished. Without one, "the
Theory arm is underdeveloped" has no end state and the loop in §0 reforms.

| Step | Done when |
|---|---|
| 1 · Rewire | ✅ nine suites green, `melodyCommitCheck` §14 inverted, no second copy |
| 2 · Theory architecture | ✅ two ladders locked, the split line drawn, the rename question closed |
| 3 · Metalness kit | the four abilities are in `legalActions` + `applyBotAction`, and the trail is a modelled state class |
| 4 · Harness | 2000 seeded headless matches run, new bot vs. current bot, ≥60% bar, determinism regression pinned |
| 5 · Monster's route | three rungs in, and the harness shows the commit phase changed — not just that it did not break |
| 6 · Roster | only after 5 reports something |

---

## 5. What this doc does NOT settle

- **Any rung, ability, name or number.** All of that is the other three docs'.
- **Whether the Smash's fixed-fuel fix (§7) goes before or after the harness.**
  The doc argues for after, on the grounds that tuning before measurement is
  tuning blind. That argument is about the *larger* exposure lever; the
  one-constant fuel price may be cheap enough to land early. Undecided.
- **Whether search depth is per-Spirit** (§7, last item). It needs measuring,
  which makes it a step-4 consumer.
- **Glamarchy.** Out of scope in `BOT_STRATEGY_HANDOFF.md` §0.5 and out of scope
  here. Adding a fourth Spirit mid-sequence would re-open every step behind it.
