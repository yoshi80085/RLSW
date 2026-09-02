# Working on rlsw-sim

## ⚠️ ALWAYS END AN UPDATE WITH AN ELI5

Every time you report a change — a commit, a feature, a bug fix, a bench run,
any "here's what I did" — finish the message with a short plain-language
section, clearly separated, under a heading like **In plain terms**.

**Keep the detailed report.** The details matter and Alex wants them: file
names, section references, the reasoning, the caveats. The ELI5 is an
*addition* at the end, never a replacement and never a reason to thin out what
came before it.

What the ELI5 should do:

- Explain it the way you would to someone smart who has never seen the codebase.
- Use the game, not the code, as the metaphor wherever possible — this is a
  music-battle game, so talk about players, turns, dice, songs and the crowd.
- Say **why it mattered**, not just what changed. "The bot was cheating without
  knowing it" beats "added an ownership gate".
- Three to six sentences, or a few short bullets. If it needs more than that,
  the explanation isn't simple enough yet.
- No jargon that wasn't already defined in plain words in that same paragraph.
  If you must use a term like "the beam" or "the searcher", give it a one-line
  human gloss right there.

Do this **every time**, unprompted, in every session. If a message reports more
than one distinct change, one combined ELI5 covering the lot is fine.

## The docs are the map

This repo carries its design in Markdown next to the code, and those files are
the real handoff. Read before changing anything, and update them in the same
pass as the code:

- `src/BOT_STRATEGY_HANDOFF.md` — the bot/searcher work, the cost web, the kits
- `src/SEQUENCING.md` — what order the open design arms get built in
- `src/METALNESS_REWORK_DESIGN.md` — the Metalness Monster kit redesign
- `src/THEORY_ARCHITECTURE.md` / `THEORY_ROUTES_DESIGN.md` — the music theory routes
- `src/PROGRESSION_REWRITE_DESIGN.md` — 🎼 Theory comes off the tree: board-found
  stack slots, free pardons, Db-vs-fans melody payout, per-ability upgrade streams
- `src/WIN_CONDITIONS_DESIGN.md` — 🏆 Legend Run vs 🎸 Battle of the Bands: how a
  match ends becomes a setting, and elimination becomes its own axis.
  ✅ **BUILT HEADLESS** — steps 1–5 done, `test:winconditions`. ⛔ No menu, no HUD
- `src/FAME_TRACK_REDESIGN.md` — ⭐ the header race track with no finish line to
  race to: margin instead of progress. ⚠️ Visual — preview page first
- `src/CHARACTER_HANDOFF.md` — per-character state

`src/ARCHITECTURE.md` is the map of the code itself — every module, what it
exports, and the "where do I change X?" index. 🎯 **It is the only doc that is
machine-checked**: `npm run test:arch` asserts that it names every source module,
points at no file that does not exist, and lists no export that is not real. **Add
a module, add its row in the same pass** — the suite will fail until you do, and
that is deliberate.

⚠️ A doc that has drifted from the code is worse than no doc. If you find one
that is stale, say so plainly rather than editing around it. ARCHITECTURE.md spent
months calling `engine/` a "~300 line scaffold" while it grew into the whole game,
because nothing could tell. That is what `test:arch` exists to prevent, and it is
why the other docs — which have no such check — are worth reading with suspicion.

## House style for comments

Load-bearing decisions get a comment that says **why**, and the failure mode it
prevents — not just what the code does. `⚠️` marks a trap someone could
reasonably fall into; `📌` marks a note for later. This is deliberate and worth
matching; the surrounding code is written this way throughout.

## Visual changes get a preview first

⚠️ **DO NOT EDIT THE HUD, THE BOARD OR ANY VISUAL ELEMENT STRAIGHT INTO THE
CLIENT.** Build a standalone interactive preview page in `.scratch/` first, send
it to Alex, let him dial it in, and only then port the numbers he lands on. He
asked for this explicitly on 2026-08-26 and it has already paid for itself twice.

What makes a preview page useful:

- **Every taste call is a lever** — a slider or a button row, not a hardcoded
  number. Radius, arm length, bloom, size, colour source, count. If you find
  yourself guessing at a value, that value wants a control.
- **Show the states, not one happy example.** The Note Stock chip has twelve
  states; a design that only looks good on the default one is not finished.
- **Show it in the real container.** The HUD column is 238px and the stock is
  10 notes (11 for the Ronin). A chip that looks great alone can still wrap the
  hand to four rows — put the real column on the page as a dashed outline and
  count the rows.
- **Old look beside new look**, so the comparison is honest.

📌 **YOU CANNOT SEE WHERE HE LANDS.** The page runs in his browser and no state
comes back. Ask for a screenshot of the control panel and read the values off it
— and warn him to screenshot BEFORE opening any new copy you send, because a
fresh file loads with defaults and wipes his dial-in.

⚠️ **VERIFY THE PORT, DON'T ASSUME IT.** Render the shipped component through
React SSR (`esbuild --jsx=automatic` + `react-dom/server`) and diff it against
the preview at the same settings. The chip is the product; "it compiles" is not
evidence that it looks right.

## Testing

**`npm run test:all`** is the full sweep — twenty-one suites, one command,
stops on the first red. Run it before reporting anything as done, and quote the
assertion counts. If a count drops, explain why rather than letting it pass
unremarked.

Individual suites are `npm run test:<suite>`: engine, legal, eval, transition,
turnflow, determinism, battleflow, melody, slime, eleven, score, harness,
riffparity, skilltree, shamisen, client, render, b0, riff, trace, arch. `npm run bench:bot` runs the §6.6 bot
bench (not a test — it prints evidence), and `.scratch/` holds one-off probes,
which are evidence for one session and never a suite.

⚠️ **A SUITE THAT NO SCRIPT RUNS IS NOT A SUITE.** `b0check` was quoted as green
in every handoff in SEQUENCING for months while nothing ran it, and five riff test
files carrying 132 assertions had never been wired at all. If you write a check,
give it a script in the same pass and add it to `test:all`.

⚠️ **`npm run build` currently dies with a bus error on this machine** — a
memory limit in the local VM, not a code fault. ⚠️ **The same ceiling reaches
further than the build**: the VM will restart under memory pressure mid-command,
and `npm install` hangs on its network, so a missing package usually cannot be
fetched here. Bundle with `--loader:.png=empty` rather than `dataurl` for
anything that only needs to RUN — it is the difference between an 81MB bundle
that restarts the box and a 2.5MB one that does not. Use **`npm run check:bundle`**
instead: esbuild bundles the whole app, monolith included, in ~2 seconds and
catches syntax errors and unresolved imports. Verify with it before and after
touching `rlsw-simulator-v3_8_1.jsx`, which is ~15k lines and cannot be
eyeballed.

⚠️ **AND `check:bundle` MUST END WITH ZERO WARNINGS.** It sat at "6 warnings" for
months. All six were real: import paths whose CASE did not match the file on disk,
which Windows resolves and the Linux box Render builds on does not. A warning that
is always there is indistinguishable from one that never matters — so the count is
the check. Treat any non-zero warning count as a failure, not as scenery.

⚠️ **A passing test is not evidence a rule is real.** `legalActionsCheck` §15
was green for months against a skill-purchase mechanic the game does not have,
because the test was written from the same misunderstanding as the code. When
checking whether the engine matches the game, read the CLIENT
(`rlsw-simulator-v3_8_1.jsx`), not the test.

## Where the work is

`src/SEQUENCING.md` §5 always holds the current next step and why. Read it
first; it is kept up to date at the end of each session.
