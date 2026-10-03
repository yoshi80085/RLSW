# 🎸 Cursed Shamisen v2 — "The Haunting" (design spec, 2026-10-03)

> **Status: DESIGN ONLY. Nothing here is built.** Written from the design conversation of 2026-10-03 plus the Iwato curse handoffs (`iwato-curse-handoff`, `iwato-port-handoff`) and `RONIN_ABILITY_DESIGN.md` §2.3.00. I did **not** read the code for this write-up, so every file/identifier below is taken from those handoffs and must be verified before building.
>
> **Supersedes** the *take up → tune strings → cast → exorcise with 3 different Iwato notes* flow of §2.3.00 (the 2026-10-02 port). Keep §2.3.00 as the record, as §2.3.0 (the siphon) was kept.

## Why change it (Alex)

The shipped flow is hard to understand at a glance: press to activate, spend several turns building a 3-note Iwato string set, then cast, then the rival has a cursed scale and must play 3 notes to lift it. Three phases and a rule that the rival's wheel *becomes* Iwato. The v2 goal is **one click, one target, a visible to-do list**, while keeping the cursed scale wheel, which looks great, and the cast animation.

## The ability in one paragraph

Ronin presses **Cursed Shamisen**, picks a Rival, and the Rival is cursed. Three **ghost notes** fly from Ronin's shamisen to the Rival, and a **curse paper (ofuda, 呪)** attaches to them. The Rival's scale wheel becomes **Iwato** for the duration, with the three haunted notes marked on it. Each haunted note the Rival commits **lifts one ghost note**, which rises and dissipates. When all three are lifted, the paper lifts too. If they aren't all lifted by the end of the third round, the curse ends anyway. Lost fans are the penalty: on an Iwato wheel their usual notes are discord and earn nothing.

## ✅ RULED by Alex (2026-10-03)

1. **No strings, no tuning phase.** Press the button, choose a Rival, they're cursed. The Ronin no longer builds anything over several turns.
2. **Three haunted notes, all different**, drawn at random from the Iwato scale, favouring the notes that sound **creepy**. The Rival is **not handed** the notes; they must read their (cursed) wheel and play them.
3. **Haunted notes show purple or black** on the cursed wheel.
4. **Lasts up to 3 rounds.** From **round 2** the haunted notes **refresh to notes in the Iwato scale** so the curse can be lifted at that point. In **round 3** the curse **ends whether or not the notes were played**.
5. **Progress accumulates across rounds** (several rounds is fine). Each cursed note committed → **one ghost note lifts and dissipates**. All 3 lifted → **the curse paper lifts**.
6. **Lost fans is its own penalty.** No extra Sustain drain.
7. **Keep the cursed scale wheel** (`CursedWheel`).

## ⭐ MY RECOMMENDATIONS (not yet ruled — please accept or change)

1. **Refresh from the Rival's stock.** At the round-2 refresh, pick the unlifted haunted notes from Iwato notes the Rival currently *holds*, falling back to random only if they hold fewer than needed. Round 1 stays pure random (can be unlucky); round 2 is the guaranteed way out. This closes the old "unobtainable note" hole without handing them anything.
2. **The refresh re-rolls only unlifted notes.** Progress already made is never undone.
3. **Creepy set.** Iwato is 1 ♭2 4 ♭5 ♭7. Draw the three haunted notes from the **four non-root notes** (♭2, 4, ♭5, ♭7), weighted toward **♭2 and ♭5** (the ♭5 is the tritone; the cast melody already resolves on an unresolved ♭2). The root is just home. *If only the four non-root notes are in the pool, a draw of 3 has just 4 combinations; fine, but predictable. Weighting makes it less so.*
4. **Count in the Rival's turns.** "3 rounds" = **three of the Rival's turns**, decremented at the end of *their* turns as the shipped `iwatoCurse` already is. Easiest rule to state.
5. **Pair the colour with a non-colour cue** (a pulsing ring or the 呪 charm) so purple/black doesn't vanish on a dark arena.
6. **Only melody commits count**, as the existing exorcism does (it lives in `commitMelodyEconomy`). Several haunted notes in one melody lift together.
7. **Record how it ended** (`curseEnded`: *lifted* vs *expired*) and let the animation differ: a lifted paper peels away; an expired one fades.

## ⁉️ OPEN — not decided

- **Which commit destinations count**: melody only (my recommendation), or also Drive/Sustain?
- **Does the Rival's note draw follow the curse?** Stock draw is 50% guaranteed from their scale palette. If the draw ignores the curse, they pull notes the wheel then punishes; if it follows, lifting gets easier. **Check which the code does.**
- **Price.** The shipped port charges 5 Db + Action Token and has a 2-round cooldown, with range 3 and no line of sight. The old brake, tuning strings, is gone; the curse now lasts 3 turns, not 2, but is easier to lift. Balance is deferred per `UPGRADE_SHOP_DESIGN.md` §0⃣.4, so just record that the price is probably the only brake left.
- **What if Ronin is KO'd while a curse stands?** (Open in the old design too.)
- **Two curses at once** (the port said one curse per rival; keep unless ruled otherwise).
- **Does a hit on Ronin do anything?** The old "hit snaps a string" question disappears with the strings. Nothing replaces it unless you want something.

## The animation (Alex: *"The animation … is really what captures the hearts of the players"*)

Reuse the five moments already built in `cursedShamisenVisuals.js` / `shamisenCurseSfx.js`, with these changes:

- **Cast**: the existing wisps' launch becomes **three ghost notes**, one per haunted note, flying to the Rival; the paper attaches.
- **Persist**: ghost notes orbit or hover on the Rival; the haunted notes are lit purple/black on the cursed wheel.
- **Each lift**: the matching ghost note rises and dissipates (reuse the exorcise sound as a single tick); the wheel marker clears.
- **Full lift**: the paper peels or burns away (existing burn/exorcise sounds).
- **Expiry**: the paper fades without the burn (existing expire sound).

## What this retires or changes in the shipped port

*(From the handoffs; verify each in code before deleting.)*

- **Retire**: **Take up** rail action, `ns.shamisen = { strings, ready, root }`, the STRINGS row in the chord step, `clickNoteStock` dest `'strings'` and the Tab-cycle third destination, `stringOctaves` and the strings UI, `startTurnNotes` flipping `ready`, and the "keeps the key it was taken up in" port call.
- **Keep**: Cast as a rail action (range 3, Action Token, Db, cooldown), `rivalNs.iwatoCurse`, `livePalette` (melody readers score on Iwato), `CursedWheel` / `cursedWheelModel`, `cursedShamisenArena`, `shamisenCurseSfx`, the cast score, and `curseEnded`.
- **Change**: the exorcism rule in `commitMelodyEconomy` — from *"3 different Iwato notes in one melody"* to *"each of the three marked notes lifts one ghost; accumulate; all three lifts the curse"*. The curse state needs the three targets and which are lifted (sketch: `{ turnsLeft, targets: [...], lifted: [...], refreshed }`). Duration goes from 2 to 3 of the Rival's turns, with the refresh at the start of their second cursed turn.
- **Replace**: the old exorcism odds (58/32/17%) no longer apply.

## Tests to add or update

`test:shamisen`, `test:shamisenjourney`, `test:cursedshamisen`, `test:abilitydemo` (the loadout pop-out's `buildShamisen` shows the strings flow). New checks: the three targets are distinct and from the creepy pool; accumulation across turns; refresh re-rolls only unlifted notes and prefers notes in stock; the round-3 auto-lift; partial lift leaves the paper on; multi-note melody lifts together; the curse ends by *lifted* or *expired* with the right `curseEnded`. Mutation-test the accumulation and the refresh, as the project does.

## Docs to touch when it's built

`RONIN_ABILITY_DESIGN.md` §2.3.00 (mark superseded) and the §1 table row (the question the rival is asked becomes roughly *"can I play the tune back before it costs me the crowd?"*), `STATE_OF_PLAY.md` Shamisen row, `SEQUENCING.md` §A, the Systems Map, the skill-tree description string and `AbilityInfo` text.
