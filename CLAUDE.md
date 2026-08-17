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
- `src/CHARACTER_HANDOFF.md` — per-character state

⚠️ A doc that has drifted from the code is worse than no doc. If you find one
that is stale, say so plainly rather than editing around it.

## House style for comments

Load-bearing decisions get a comment that says **why**, and the failure mode it
prevents — not just what the code does. `⚠️` marks a trap someone could
reasonably fall into; `📌` marks a note for later. This is deliberate and worth
matching; the surrounding code is written this way throughout.

## Testing

`npm run test:<suite>` — engine, legal, eval, transition, turnflow,
determinism, battleflow, melody, slime, eleven, score, harness, riffparity.
`npm run bench:bot` runs the §6.6 bot bench (not a test — it prints evidence).

Run the full sweep before reporting anything as done, and quote the assertion
counts. If a count drops, explain why rather than letting it pass unremarked.

⚠️ **`npm run build` currently dies with a bus error on this machine** — a
memory limit in the local VM, not a code fault. Use **`npm run check:bundle`**
instead: esbuild bundles the whole app, monolith included, in ~2 seconds and
catches syntax errors and unresolved imports. Verify with it before and after
touching `rlsw-simulator-v3_8_1.jsx`, which is ~15k lines and cannot be
eyeballed.

⚠️ **A passing test is not evidence a rule is real.** `legalActionsCheck` §15
was green for months against a skill-purchase mechanic the game does not have,
because the test was written from the same misunderstanding as the code. When
checking whether the engine matches the game, read the CLIENT
(`rlsw-simulator-v3_8_1.jsx`), not the test.

## Where the work is

`src/SEQUENCING.md` §5 always holds the current next step and why. Read it
first; it is kept up to date at the end of each session.
