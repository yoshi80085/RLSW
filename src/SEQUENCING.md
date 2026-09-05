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
> | **C** | 📇 **the index** — all 36 handoffs, dated, one line each, pointing into the archive |
>
> ⚠️ **NOTHING WAS DELETED.** If a line below is too short to act on, the full
> text is in the archive under the same section id.
>
> 📌 **NEW ENTRY POINT: read `STATE_OF_PLAY.md` first.** It is the current state
> of the whole game in one screen. This file is the *narrative* — what happened
> and what it taught. That file is the *state* — what is true right now.

---

# A. 🧭 THE CURRENT HANDOFF

## 5-draw. 🧭 START HERE — session handoff, 2026-09-04f (the draw; and one price for everything)

🗡️ **THE RONIN'S KIT IS NOW THREE-QUARTERS BUILT AND ALL OF IT IS PLAYABLE.**
Step (c) landed: 🌀 Psycho Bushido is a **draw** on a rival 3–5 hexes in front,
paying **+2 / +3 / +4** across that window for a **flat 3 AP** and **2 notes off
the Drive stack**; 👤 Shadow Illusion is dearer to own, cheaper to fire and gone
sooner. Only 🎸 the siphon is left, and it is still behind Metalness.

💰 **AND THE ECONOMY'S ONE OPEN NUMBER WAS ANSWERED IN PASSING.** Alex, choosing
between options on Shadow Illusion's price: *"it's not 10 Db, everything should
be 6 Db, not varied among different abilities."* That is board row 4 — *"the
single number the whole economy now turns on"* — closed inside an answer to a
different question. **All thirteen unlock prices are now 6**, down from a 6–14
spread, and two suites assert the uniformity rather than trusting it.

### 5-draw.A ⭐ THE BOARD, ITS THIRD RUN — and the finding moved again

**Fifteen open calls**, against eleven last session. One closed (Bushido's
ladder), **five were new** — and where they came from is the point:

🚩 **THREE OF THE FIVE WERE INSIDE THE STEP THAT WAS MARKED "UNBLOCKED".** Both
`STATE_OF_PLAY.md` §7 and §5-hopport.F called step (c) *"a pure number edit, ✅ no
longer blocked."* Reading the respec table against the code turned up three calls
that had to be made before a constant could be typed: Bushido's 8 Db unlock
against the flat-cost rule that voids it; the brand-new *"−2 off the Drive
stack"*, which §2.1.1 itself says **nobody has costed**; and Shadow Illusion's
3 → 2 turns against §6.3's warning that duration is *"the first dial to turn"*.

🎯 **THIS IS §B9's LESSON WITH A NEW FAILURE MODE, AND IT IS WORTH NAMING.** §B9
is about a decision filed in the wrong doc. These three were filed in the RIGHT
doc, in the right section — and still read as no decision, because they sat
**underneath a ⬅️ NEXT arrow**. A step labelled unblocked is read as a step with
nothing to ask. **The label outranked the contents.**

| ⁉️ was open | ✅ Alex, 2026-09-04f | where it now lives |
|---|---|---|
| 🗡️ Ship Bushido's 8 Db unlock, or leave the price alone? | **Leave it alone — ship mechanics.** | superseded within the hour by the row below |
| 🗡️ Build the −2 Drive stack cost, or file it? | **Build it.** *"I like the +2/+3/+4 ladder, it opens up a real space strategy. But it should also take out 2 of the Drive stack in the process."* | `gameConstants.js` → `PSYCHO_BUSHIDO_STACK_COST` · §4 |
| 👤 Shadow Illusion: 2 turns, or hold at 3? | **2 turns** — and ⭐ *"it's not 10 Db, everything should be 6 Db, not varied among different abilities."* | `FLAT_ABILITY_UNLOCK_DB` · §4 · closes `UPGRADE_SHOP_DESIGN.md` §0⃣.3's first bullet |

📌 **THE THIRD ANSWER OVERTOOK THE FIRST AND THAT IS FINE.** "Leave the unlock
price alone" was a way of not typing a number the flat rule would delete. Two
answers later the flat number existed, so 6 was typed — and Bushido was already 6,
so the two answers never actually disagreed.

### 5-draw.B 🚩 THE BUG THE STACK BILL FOUND IN THE GAME'S OWN RULES

The first draft of `spendDriveStack` took the 2 notes off the **back** of the
stack, and the comment above it was a confident paragraph explaining why: the root
is `stack[0]`, everything downstream hunts from it, and eating the root would
re-point the player's hunt as a side effect of an attack.

⛔ **EVERY WORD OF THAT WAS RIGHT AND THE CONCLUSION WAS BACKWARDS.** Every Swing
in the game already spends `SWING_DRIVE_SPEND` off the **front**
(`attackParams.js` → `driveStack.slice(2)`), and `music/stackSlots.js` documents
the consequence as the intended mechanic in as many words: *"spending your
foundation hands the root to the next note up, and your hunt on the board moves
with it… the design's own 'removing the root is how you re-point what you are
hunting'."*

🎯 **SO THE SAFE-LOOKING CHOICE WAS THE DRIFTING ONE.** Bushido eating the tail
while its own strike ate the head would have put **two directions on one stack
inside a single action**. The bill now takes from the front, and `test:bushido`
asserts it against `SWING_DRIVE_SPEND` itself rather than against a literal — so
the day the two diverge, one line says so.

🚩 **AND IT REVEALED THE ABILITY'S REAL PRICE, WHICH NOTHING HAD STATED.** A
Bushido's strike **is** a Swing. So a draw costs **4 notes of Drive stack** — 2
for the ability, 2 for the strike — where an ordinary Swing costs 2. The bill is
also paid *before* `attackParams` reads the sheet, so **the chord backing the blow
is whatever survives it**. The ladder pays more the further you draw; the stack
bill takes the chord that would have paid alongside it. 🧊 That is a real trade,
it is uncosted, and §B10 says record it rather than tune it. It is recorded.

### 5-draw.C ⭐ WHAT THE FLAT PRICE DID, MEASURED ON THE FIRST TRACE

`UPGRADE_SHOP_DESIGN.md` §1.1's central finding is that the arsenals are bought in
**price order, not value order** — *"with no reference to what the ability does."*
§0⃣.1 predicted a flat price would delete the mechanism rather than mitigate it.
The first traced match after the change says it did:

| seed 4242, searcher, 60 turns | skills aimed at |
|---|---|
| **before** (6–14 spread) | shukuchi · goes_to_11 · gravity_control · psycho_bushido · shadow_illusion · code_injection · master_moshpits |
| **after** (flat 6) | shukuchi · goes_to_11 · **blaster_of_ra** · psycho_bushido · shadow_illusion |

🎯 **🌀 BLASTER OF RA APPEARS, AND IT IS ONE OF THE TWO SKILLS §1.2 NAMED AS
BARELY GETTING SEEN** (17%, against ☀️ Sunbeam's 10%). It cost 10 Db and was not
saved for; it costs 6 and is.

⚠️ **AND IT MAKES BOARD ROW 15 MORE URGENT, NOT LESS.** *Is Blaster of Ra an
ability at all?* It **replaces** the Smash, so it is deliberately absent from
`ABILITY_CD` and `ABILITY_DB_COST`. It is now the same price as everything else
and being bought more — an unpriced, uncooled ability with a rising share of play.

### 5-draw.D ⚠️ `test:harness` DROPPED 1537 → 1530, AND THE REASON IS §B4

`CLAUDE.md` says explain a dropped count rather than letting it pass. This one is
**not a lost assertion.** `harnessCheck`'s last block loops over the `skillTarget`
actions a traced match actually emitted (`for (const b of aimed)`), so its count is
a property of the **trace**, not of the rule. Flat prices changed the searcher's
saving order — `skillTarget` is a *saving* action, and under a spread it re-aimed
whenever a cheaper skill became the better save. With every price equal there is
no cheaper option to switch to, so it picks once and sticks: 7 → 5 aims.

🎓 **THAT IS §B4 IN A NEW PLACE.** *"A finding can be a property of the measurement
rather than of the game."* Here it is the **assertion count itself** that is a
property of the measurement. 📌 Worth knowing before the next session reads a
number move as a regression: this count will keep drifting with bot behaviour, and
the two floors underneath it (`ownedMean ≥ 1.0`, `ownedAny ≥ 75%`) are the
assertions that actually guard anything. Both passed.

### 5-draw.E ✅ Verification

`check:bundle` **zero warnings**, before and after the monolith. **All 26 suites
green**, run in batches:
🆕 `bushido` **82** · `legal` 581 · `skilltree` **147** · `transition` 257 ·
`harness` **1530** · `trace` 1205 · `shukuchi` 68 · `shukuchiui` 80 ·
`melody` 163 · `stackslots` 115 · `slime` 127 · `eleven` 38 · `score` 122 ·
`eval` 156 · `winconditions` 79 · `turnflow` 73 · `battleflow` 65 ·
`determinism` 20 · `shamisen` 34 · `riffparity` 127,598 · `riff` 70,970 ·
`render` 8/8 · `client` 6 · `arch` 8 · `engine`, `b0` green.

**Three counts moved and all three were checked rather than waved through:**

- 🆕 **`test:bushido` — 82 assertions, and it bites.** Confirmed red on three
  deliberate breaks: a descending ladder, dropping the min-range gate in
  `legalActions`, and restoring `apCost: d`. ⚠️ A suite nobody has watched fail is
  a suite nobody should quote (§B3).
- `skilltree` 135 → **147**. Two assertions pinning the old spread (`tentacle` 10,
  `master_moshpits` 8) were **inverted** into the flat-price guard — 13 per-skill
  assertions plus one asserting the whole tree holds exactly one price. Same move
  `melodyCommitCheck` §13 and `shukuchiCheck` both made: a check standing on a
  number becomes the guard on the rule that replaced it.
- `harness` 1537 → **1530**. §D above.

⏳ **WHAT IS STILL NOT COVERED.** `test:bushido` is headless — it asserts that the
kernel's lane and the client's lane are described by the same constants, not that
the client's two lane-walks *run* the same. ⚠️ **THE LANE IS NOW WALKED IN THREE
PLACES** (`legalActions`, `resolvePsychoBushido`, `getPsychoBushidoTargets`) and
only a bench or a played turn can prove all three agree. The re-bench is next for
that reason as well as the obvious one.

### 5-draw.F 🎯 NEXT

1. 🤖 **RE-BENCH THE RONIN — and it is now overdue twice.** §5-hopport.F already
   flagged that every number from `5-hop` and `5-hopui` was taken against a client
   that refused the hops the searcher planned. **His kit has since changed shape
   again**, and the three-way lane duplication above wants a played turn.
2. 💰 **The three surviving riders on the flat number** — `UPGRADE_SHOP_DESIGN.md`
   §0⃣.3, board rows 5, 6 and 7. The rising ladder has no shape and no cap, and
   until it does a rich seat still has nowhere to put Db. 🎯 **The sink was never
   one problem — it was breadth and depth, and only breadth got answered.**
3. ⚠️ **Re-measure ☀️ Sunbeam (14 → 6) and 💀 Azrael (12 → 6)**, the two abilities
   the flat rule made cheapest-fastest. 🧊 A measurement, not a rebalance.
4. 🚨 **The Ronin ledger** — board row 10, six passes deep, still nobody's. ⚠️ And
   note what today did to it: he got *more expensive to fire* (4-round CD, 4 stack
   notes a draw) and *cheaper to own* (every unlock 6). Neither is the 12 Db slot.
5. ⛔ **The client still won't colour the three endings** — `5-flags.G` item 1,
   untouched for a **sixth** session and still true.
6. 🔧 **A stale `.git/index.lock` is sitting in the repo** (0 bytes, no git process
   running). `git stash` and `git checkout --` fail against it silently — `stash`
   exits 1 with no message, which is how it went unnoticed. Everything else works.
   ⚠️ This session could not remove it (the bridge cannot delete files); deleting
   it by hand restores both commands.


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

---

# C. 📇 THE INDEX — 36 handoffs, in `docs/archive/SEQUENCING-full-through-2026-09-04.md`

Newest first. **Search the archive by the section id in column 1.**

| id | date | what it did |
|---|---|---|
| `5-draw` | 2026-09-04f | 🔼 **LIVE — §A above.** The board's third run (15 calls, 3 of the 5 new ones found INSIDE the step marked unblocked); 🗡️ Bushido respecced to a 3–5 draw with the ladder, a flat 3 AP bill and a Drive-stack price; 👤 Illusion respecced; ⭐ **the flat unlock number answered — 6, for everything** |
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
