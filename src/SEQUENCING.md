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

## 7-immersive-hud. Structure complete; stop for Medium — 2026-09-07

Alex authorized the initial restructuring and asked to stop once remaining work
suits lower reasoning. The optional 3D view now fills the play area, with stable
Turn / Spirit / Rivals regions, a floating phase/AP summary and a separate board
preparation region. The original controls and SVG stay mounted across views.
No game rules or renderer input handlers were moved. Narrow screens put controls
below the board; tutorials disclose and scroll their original anchors into view.

**Next: use Medium for presentation refinement.** Read
`../docs/immersive-hud-handoff.md` for exact files, contracts, remaining visual
work and verification scope. The current panel internals retain their existing
appearance. No further visual polish, commit or deployment was done this pass.

Full `test:all` passed, including the extended immersive client journey and
actual WebGL fallback. Render check remains 8/8; architecture 8; Bushido overlay
331; existing rule/parity assertion counts did not drop. `check:bundle` has zero
warnings. Production build passes with its existing large-chunk advisory.
`lint:baseline` passes at 334 errors / 16 warnings, zero increased categories;
the executable arena test has a local Fast Refresh exception.

Actual browser checks covered drafting, drawer access, commit, legal movement
for one AP, camera controls without AP spend, state-preserving 2D recovery and
next-player controls. Widths checked: 1280, 800 and 390px. Phone action-state
layout had no horizontal overflow. Dedicated phone camera/touch polish remains.
The external Systems Map artifact tool is unavailable; repository docs are current.

Previous live handoffs are preserved in
`../docs/archive/SEQUENCING-before-immersive-hud-2026-09-07.md`.

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

# C. 📇 THE INDEX — 38 handoffs, in `docs/archive/SEQUENCING-full-through-2026-09-04.md`

Newest first. **Search the archive by the section id in column 1.**

| id | date | what it did |
|---|---|---|
| `7-immersive-hud` | 2026-09-07 | **LIVE — §A above.** Full-width arena, stable HUD regions, turn disclosure, responsive fallback; stop for Medium presentation pass. |
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
