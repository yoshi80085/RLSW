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
> | **C** | 📇 **the index** — all 34 handoffs, dated, one line each, pointing into the archive |
>
> ⚠️ **NOTHING WAS DELETED.** If a line below is too short to act on, the full
> text is in the archive under the same section id.
>
> 📌 **NEW ENTRY POINT: read `STATE_OF_PLAY.md` first.** It is the current state
> of the whole game in one screen. This file is the *narrative* — what happened
> and what it taught. That file is the *state* — what is true right now.

---

# A. 🧭 THE CURRENT HANDOFF

## 5-hopport. 🧭 START HERE — session handoff, 2026-09-04e (the board can be asked for the decisions; Shukuchi is PLAYED)

🎯 **THE ABILITY IS NO LONGER HEADLESS.** 🌀 Shukuchi Arpeggio has a button, a
target overlay, arcs, a hover ghost and a budget rail, and the searcher can take
the hops it plans. That last clause is the one that mattered: for two sessions
the bench and the played game disagreed about this ability, and the disagreement
was invisible because every suite was green.

⚡ **AND THE BOARD RAN A SECOND TIME, WHICH IS WHY IT IS WORTH KEEPING AS A
RITUAL.** §5-hopui.A invented the decision board; this session was asked for it
again before any code. Eleven live calls, two of them findable only as prose
inside a design doc.

### 5-hopport.A ⭐ THE BOARD, AND THE ONE DECISION TAKEN OFF IT

**Eleven open calls**, newest first, against nine last session — and the
arithmetic is the interesting part, not the total: two closed (§5-hopui.B), one
was struck as dead, and **five appeared that had never been enumerated**. Three
of the five are the riders on the flat unlock number, filed as bullet points in
`UPGRADE_SHOP_DESIGN.md` §0⃣.3 and named nowhere else; one is the Fame per-turn
cap, measured to three options on 2026-09-02d and never chosen; one is the
Metalness-vs-siphon ordering trade.

🚩 **THE PATTERN IS THE SAME ONE §B9 IS ABOUT, AND IT IS GETTING CLEARER.** A
decision does not go missing by being wrong. It goes missing by being **correctly
recorded in a doc nobody greps for it in.** The board is the only instrument this
repo has that reads the whole set at once, and it has now found something new
both times it has been run.

📌 **IT IS STILL NOT A DOC, AND THAT IS STILL DELIBERATE.** A tenth file to keep
in sync is the exact drift being paid for (§B1, §B9). What it earns each time is
rows in `STATE_OF_PLAY.md` §4 and §7 — which is where it earned them this time.

| ⁉️ was open | ✅ Alex, 2026-09-04e | where it now lives |
|---|---|---|
| 🗡️ Does Psycho Bushido pay **+3 flat**, or the **+2 / +3 / +4** ladder across its 3–5 window? | **The ladder.** The window is the legality rule; the payout is a gradient inside it. | `RONIN_ABILITY_DESIGN.md` §2.1.1, now closed · `STATE_OF_PLAY.md` §4 |

🎯 **BOTH HALVES OF THAT ARGUMENT WERE RIGHT AND THE ANSWER TAKES BOTH.** §2.1
said the ability *is* the distance gradient; the respec said a bright line teaches
better than a curve nobody notices. A window that refuses the close charge
outright **and** pays more the further out you start is the only shape that is
both. ⚠️ The cost is three numbers to read where the flat version had one, and
that is the first thing to look at if the window turns out to be doing the work
alone.

### 5-hopport.B 🖥️ WHAT SHIPPED — and why the overlay is its own file

🌀 **`src/ui/ShukuchiOverlay.jsx`** (191 lines) — the arcs, the hover ghost with
its facing arrow, the budget readout, and `SHUKUCHI_LOOK`, which is Alex's
fifteen-lever dial-in in one object.

⚠️ **IT IS A SEPARATE FILE FOR A REASON THAT IS NOT TIDINESS.** `CLAUDE.md`:
*"verify the port, don't assume it — render the shipped component through React
SSR and diff it against the preview."* **A geometry inlined in a 15,000-line
component cannot be rendered on its own, so it cannot be diffed, so the rule
cannot be obeyed.** `.scratch/_glowssr.jsx` is what the alternative looks like:
faced with an un-renderable component it *re-implemented* the geometry in order
to print it, which proves two transcriptions agree and says nothing about the
screen. The extraction is what makes the check honest.

In the client: the rail button (with its `🕒` / `Db` / `AP` refusal labels), the
ring-2 paint, `resolveShukuchiHop`, the click branch, and the arc layer — placed
**after** the hex map, because the standees are drawn inside it and the arc
passing **over** the body it clears is the identity call of §2.5.0c.

### 5-hopport.C 🚩 THE BUG THE PORT FOUND IN THE THING IT WAS PORTING

The preview derived *"spent"* from `MAX_HOPS − hopsLeft`, and a **ready** ability
carries `hopsLeft === 0`. So the page drew a ready Shukuchi with **every mark
greyed out** — a full budget displayed as an empty bar.

🎯 **IT IS NOT COSMETIC, AND THE REASON IS §2.5.0c.** Alex switched the "FREE"
label OFF and bet that the segmented bar alone would teach §2.5.0a's trap: the
clock starts on hop **1**, so hops 2–3 are free and a Ronin who hops once and
stops has spent the ability. **A bar that starts empty cannot carry that bet.**
Both sides now read forward — three before you fire, counting down as you spend —
and `test:shukuchiui` §5 pins it so it cannot revert quietly.

📌 **The preview page now also opens on Alex's landing instead of factory
defaults.** `CLAUDE.md` warns that a fresh copy wipes a dial-in; once the dial-in
exists, the cheapest fix is for the defaults to *be* it. The page's levers and
`SHUKUCHI_LOOK` are diffed against each other, so they cannot drift in silence.

### 5-hopport.D 🐛 THE BUG THAT WOULD HAVE SHIPPED — the bot's hop, refused

The first draft gated `resolveShukuchiHop` on `shukuchiTargets`, a `useMemo` keyed
on `action === 'shukuchi'`. **The searcher executes by calling `setAction(...)`
and the resolver in the SAME TICK**, so it would have read the previous render's
empty set and been refused every single time.

⚠️ **AND NOTHING WOULD HAVE CAUGHT IT.** `test:legal` §16 asserts a client path
is *declared*, not that it works; the suites are headless; the bench would have
gone on reporting hops. It is §B2 exactly — *a passing test is not evidence a
rule is real* — and the only reason it surfaced is that wiring the bot meant
reading the resolver as the bot would run it. ✅ The landing set is now a
**function** (`shukuchiLandingSet()`), with the memo kept for the paint alone.

📌 `move` is safe from this only because it never reads its own highlight. Any
future resolver that does is exposed to the same trap.

### 5-hopport.E ✅ Verification

`check:bundle` **zero warnings**. **All 25 suites green**, run in batches:
`shukuchi` 68 · 🆕 `shukuchiui` **80** · `legal` **581** ·
`transition` 257 · `harness` 1537 · `trace` 1205 · `skilltree` 135 ·
`melody` 163 · `stackslots` 115 · `slime` 127 · `eleven` 38 · `score` 122 ·
`eval` 156 · `winconditions` 79 · `turnflow` 73 · `battleflow` 65 ·
`determinism` 20 · `shamisen` 34 · `riffparity` 127,598 · `riff` 70,970 ·
`render` 8/8 · `client` 6 · `arch` 8 · `engine`, `b0` green.

**Two counts moved and both were checked rather than waved through:**

- `legal` 580 → **581**. §16 walks `BOT_CLIENT_KINDS` asserting each is a kind
  the rules still emit; `shukuchi` moving out of the gap list and into that set
  adds exactly one.
- `shukuchi` stayed at **68** — but one assertion **inverted**. It used to assert
  the client gap was *declared*; it now asserts the gap is *closed*. 🎯 Same move
  `melodyCommitCheck` §13 made when Wa no Koe was cut: a check standing on an
  absence becomes the guard on its presence rather than being deleted.

🆕 **`test:shukuchiui` — 80 assertions, and it bites.** It slices a new DOM-free
**OVERLAY REGION** out of the preview page and diffs it against the shipped
component: the fifteen levers, the arc path from **every** hex to **every** one of
its ring-2 landings (1,046 pairs), the trail fade, the twelve gallery states of
the budget bar, and the rendered SVG itself. ⚠️ **Confirmed red on a deliberate
one-unit change to the arc rise** — a suite nobody has watched fail is a suite
nobody should quote (§B3).

⚠️ **`test:render` again exceeded a 2-minute shell and passed 8/8 when given its
own.** Exactly as `CLAUDE.md` warns. A timeout there is not a failure.

⏳ **WHAT IS STILL NOT COVERED.** `test:shukuchiui` diffs geometry, colour and
mark-state — it can say the arc is the height Alex set, never that the height is
right. And nothing renders the rail BUTTON: `ShukuchiBudget` is checked, the
`<RailBtn>` around it is not. That is the same DOM-shaped hole `test:render`'s
header already admits to.

### 5-hopport.F 🎯 NEXT

1. 🗡️👤 **Step (c) — respec Bushido and Shadow Illusion.** ✅ **NO LONGER
   BLOCKED** (.A). The 3–5 window, the +2/+3/+4 ladder, and the new unlock and
   cooldown constants. ⚠️ It is a RULE, so it wants its suite in the same pass —
   and `bushidowindow.mjs` / `bushidouse.mjs` in `.scratch/` are the probes the
   old payout was measured with, worth re-running against the ladder.
2. 🤖 **RE-BENCH THE RONIN, and treat it as a correction rather than a
   refresh.** Every Ronin number from `5-hop` and `5-hopui` was measured while
   the searcher could plan hops the client would refuse. Those numbers are not
   comparable with anything taken now, and nothing but a re-run closes that.
3. 💰 **The flat unlock number**, and the three riders that travel with it —
   board rows 3, 4 and 5, all filed only as prose in `UPGRADE_SHOP_DESIGN.md`
   §0⃣.3.
4. 🚨 **The Ronin ledger** — board row 6, six passes deep, still nobody's.
5. ⛔ **The client still won't colour the three endings** — `5-flags.G` item 1,
   untouched for a **fifth** session and still true.


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

---

# C. 📇 THE INDEX — 35 handoffs, in `docs/archive/SEQUENCING-full-through-2026-09-04.md`

Newest first. **Search the archive by the section id in column 1.**

| id | date | what it did |
|---|---|---|
| `5-hopport` | 2026-09-04e | 🔼 **LIVE — §A above.** The board run a second time (11 calls, 5 newly enumerated); ✅ Bushido's +2/+3/+4 ladder settled; 🌀 Shukuchi's overlay PORTED and SSR-diffed at 80 assertions; the searcher's hop un-refused |
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
