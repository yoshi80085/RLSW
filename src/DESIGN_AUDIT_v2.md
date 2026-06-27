# Rock Legends: Spirit Wars — Design Audit v2

Re-audited against **Simplicity · Thematic · Intuitive · Coherent** by reading the
*current* code (`music/`, `data/`, the skill tree, balance constants, the combat
pipeline) — not the prior `DESIGN_AUDIT.md`. The first audit's recommendations have
largely been **acted on**; this v2 records what's fixed, what STIC gaps remain, and
the open battle-system question.

---

## 1. What the refactor already fixed

The game moved decisively toward the v1 thesis ("protect the spine, cut the noise"):

- **The consonance→dissonance arc is now the spine.** The Theory route is literally
  "The Ladder," and the old Discord route is folded into it — colour-note powers
  (Blues 7th, Devil's Interval, Chromatic/Stagger, Borrowed Chord) now arrive *as you
  learn the theory that justifies them*. This is exactly the arc v1 begged for.
- **Skill tree slimmed** to ~6 legible routes (Theory, Electric, CQC, Crew + two
  Signature arsenals) from the old sprawling eight.
- **Fan multiplier reconciled** — code (`FAN_MULT_CAP = 2.0`) and tutorial (×2) now agree.
- **Instant Limelight win removed** and folded into a Fame faucet (as recommended).
  Win conditions are now cleanly two: Fame Legend (25) and Last Spirit Standing.
- **Dischord softened** from a blanket zero to −1 HC — a little dissonance is now affordable.

Verdict: the **core passes STIC strongly**. Pivot → build the note track → commit →
intervals/cadences/riffs → fight → Fame is simple, thematic, intuitive, coherent.

---

## 2. Remaining STIC gaps — mostly *taught vs. coded* mismatches

These make a good game feel broken to a new player. They are cheap, high-value fixes.

| Gap | Lens | Status |
|---|---|---|
| **Interval effects taught as base, coded as Theory unlocks.** Tutorial showed Tritone/Min7/Maj3 as base; code gates them (dom7/modes/Borrowed Chord). Tritone was even described as "×2 damage anywhere" when it actually arms a Burn on track-*end*. | Intuitive·Coherent | ✅ **Fixed** in tutorial (marked 🔒 EARNED; tritone corrected). |
| **Fame Sparks taught but cut in code.** Winning page advertised "✨ Fame Sparks (4 → 1 FP)"; the Thousand Beats system is orphaned (`ownsThousand` checks a skill `thousand_beats` that no longer exists in the tree → always false in real play). | Coherent | ✅ Tutorial reference **removed**. ✅ Dead code **deleted** — the whole Thousand Beats subsystem (`launchThousandBeats`/`resolveThousandBeats`, `thousandBeats` state + masher effect, the orphaned Fame-Spark plumbing `awardSparks`/`SPARKS_PER_FP`/`sparks`, the `thousand_beats` skill checks, and `ui/ThousandBeats.jsx`) is gone. |
| **"Two roads to victory" → three boxes.** Winning listed three headed cards, one of which is explicitly "no instant win." | Coherent | ✅ Line **reworded** (Limelight reframed as a faucet). |
| **Mic (voice roll) + Mixer live in the engine but never taught.** `voiceRollFx` and the Mixer (double one stock note) run in `confirmNoteTrack`; no tutorial section exists for either. | Intuitive | ❌ Open — teach them, or cut them (v1 recommended cut). |
| **Non-stacking Drive/Sustain → HC conversion.** "Higher boost wins; the replaced one converts to HC" + "+varies" on the HC page is unmodelable mid-melody. | Simplicity | ❌ Open — flatten to an immediate flat bonus. |
| **Feedback vs. Sustain naming.** Stat trio is locked clean (Drive/Sustain/Vibe), but the boost that grants Sustain is still called "Feedback Boost" (`sustainBoostFromPattern`). | Coherent | ❌ Open — rename the boost to "Sustain Boost." |
| **Only 2 of 4 spirits have a Signature arsenal** (Ronin, Metalness). Glamarchy and Intergalactic 0 have none. | Coherent | ❌ Open — give all four a signature, or advertise none. |

---

## 3. The battle system — diagnosis

**How it works today.** Two attack modes share one resolution:

- **Swing (melee):** forward 3-hex cone. `atkTotal = drive + tempDrive + mods + d6`
  vs `defTotal = sustain + tempSustain + mods + d6`. Win if `atkTotal > defTotal`.
- **Sonic (ranged):** straight 3-hex beam; die scales with amps in range (d6→d8→d10→d12).
- **Margin → damage** in coarse buckets (`≤3→1, ≤6→2, ≤9→3, ≤12→4, else 5`).
  Knockback: swing = 1 hex; sonic scales with margin (1–3). Edge = knock-off risk.
- The climactic **riff-off** already resolves by a *timing grade*, not a stat roll.

**What's strong (keep):** positional play is excellent — facing, cone vs. straight
beam, amp-range die growth, knockback into edges. Two attack identities (brawl up
close vs. aim a beam from your rig) is a clean, thematic risk/range trade. The
riff-off earning its real-time-ness is the best part of combat.

**Why Drive/Sustain feel arbitrary (the real problem).** The game's promise is
*"the melody you build is your combat."* But in the swing math, the **dominant terms
are a static character stat and a random d6** — and the *earned* term (your playing,
via `tempDrive`/`tempSustain`, capped ~+3 and non-stacking) is a small garnish on top.
So the part that should feel deserved (your performance) barely moves the result, while
the part that's handed to you at character-select (Drive 5–8 / Sustain 5–8) decides it.
Two d6 also swamp a 1–2 stat gap, so many fights are coin-flips regardless of who
played better. On Vibe pools of only 4–5, a single high roll can nearly KO — the
variance *amplifies* the arbitrariness. Net: combat is the **least "you"** part of a
game whose whole identity is expressive musical choice.

**Secondary smell:** modifier soup. One swing roll absorbs pyro (+x), fog (−1/−1),
laser (halve def), junkyard (+2), psycho-bushido (force die to 1), instrument-drop
(−1), posing (def 0)… the same additive-stacking tax v1 flagged elsewhere, now in combat.

---

## 4. Making combat *deserved* — three directions

Goal: every number on the board should trace back to a choice the player made.

**A — Performance *is* power (most thematic).** Demote static Drive/Sustain from "the
number" to *flavor* (a ±1, or just the die *type* like amps already do). Promote the
committed melody to the primary attack value: a longer/cleaner/better-resolved track
hits harder. The three styles stop being stat blocks and become *how you earn* combat
power — Shred rewards runs (Drive), Flair rewards motifs (Sustain), Groove is balanced.
Now "I hit hard" means "I played a strong phrase," and characters differ by their
musical route to power, not an arbitrary sheet.

**B — Replace the random die with a performance grade (smallest change, high payoff).**
You already grade timing in the riff-off. Generalize it: the track you commit yields a
GRADE that *is* your attack die value (or sets its floor — the octave's "die floor +2"
already hints at this). Keep Drive/Sustain as the base; just make the variable part
*earned* instead of luck. Good play removes randomness rather than adding a trickle.

**C — Defense becomes a read, not a roll (more interactive, costs simplicity).** The
defender commits a brace (high/low/dodge) so winning a swing means out-reading, not
out-rolling. Strong for tension; adds rules — lowest STIC-simplicity of the three.

**Recommended:** **A blended with B.** Make the committed melody the dominant attack
term, replace the random d6 with a performance grade, and let Shred/Flair/Groove define
*which kind of phrase* pays you. Then shrink/clean the modifier stack and consider
slightly larger Vibe pools so earned advantages decide fights instead of dice.

This is a design decision worth choosing before it's coded — see the question posed in chat.

---

## 5. Cut / Change / Add (updated)

**Cut:** the orphaned Thousand Beats/Fame Sparks code; Mic + Mixer (or teach them);
Mod Cards 3→1 (Chromatic Shift / Overdrive / Transpose all just rescue a dischord track,
which the Theory ladder already does).

**Change:** flatten the non-stacking Drive/Sustain conversion; rename "Feedback Boost"
→ "Sustain Boost"; give all four spirits a signature; reduce combat modifier stacking.

**Add (next level):** a visible **Tension meter** that fills with dissonance and
discharges for a payout on resolution (surfaces your core arc as a watchable dial);
**live risk on dissonance** so a committed dischord that fails to resolve costs *you*
something (every risky note becomes a real bet, Deceptive-Cadence-style); **per-spirit
modal identity** so the Major/Minor pivot carries character flavor.

---

## 6. Proposed combat redesign — "your harmony IS your fight"

This supersedes the §4 A/B/C options. It came out of design dialogue and replaces the
static-stat + d6 model with one where every combat number is earned from the notes you play.

### 6.1 The two axes

Music has two axes; so does the board. Map them:

- **Melody → movement** (horizontal — a line through time). Unchanged: the notes you
  play out carry you across the board.
- **Harmony → combat** (vertical — notes stacked at once). The chord you voice *is*
  your Drive/Sustain.

### 6.2 Stock as the single combat currency

There is **one resource: your note stock.** All action starts there and is spent from there.

- Each turn you draw notes into stock. You **spend** them on movement (melody) **or save**
  them toward combat (harmony). Notes spent moving you can't fight with, and vice-versa —
  that's the core tension, made economic. Horizontal vs. vertical, every turn.
- **Attacking spends saved notes** (voice a chord and send it / bring it down point-blank).
- **Defending spends saved notes too** (your saved notes form the chord that absorbs the hit).
- **Spend everything and you're depleted** — no real attack or defense for a round or two
  while stock refills. Overcommitment is punished by the economy itself, no extra rule.
- This unifies the old "bank" and "stock" into one pool: your **saved stock IS your chord.**

> **OPEN DECISION (settle before coding).** Depletion only bites if (a) refill is **gradual
> and carried-over** (a few notes/turn into a persistent reservoir) rather than the current
> "refill to 8 every turn," and (b) absorbing a hit **consumes** chord notes (walls erode)
> rather than just checking against a persistent stat. Adopting the vision implies both.
> Also watch **multiplayer drain**: if defending spends stock and you can be attacked by
> several rivals between your turns, set a floor / reserve so a player can't be bled dry
> with no agency.

### 6.3 The chord → Drive/Sustain (the `evaluateChord` table)

Classify the saved pitch-class set against a chord table (pure fn, lives in `music/`
beside `detectCadence`/`detectRiff`). Consonance buys Sustain, dissonance buys Drive,
sophistication buys total power; the ladder gates what you can voice cleanly.

| Chord (root-relative) | Drive | Sustain | Feel | Unlocks at |
|---|:--:|:--:|---|---|
| Single note | 3 | 3 | naked — don't get caught here | start |
| **Power chord** (R+5) | 5 | 5 | the rock default; starting stance | start |
| Major triad (R+3+5) | 4 | 7 | bright, grounded — a wall | start (pentatonic) |
| Minor triad (R+♭3+5) | 5 | 6 | dark but stable | start |
| Sus2 / Sus4 | 6 | 4 | unresolved, restless | start |
| Major 7th | 5 | 8 | lush, sophisticated guard | Full Scale |
| Minor 7th | 6 | 7 | smooth, balanced | Full Scale |
| **Dominant 7th** | 8 | 4 | tritone inside — first true attack chord | Blues/♭7 |
| Augmented | 8 | 3 | eerie, whole-tone, unstable | Modal |
| Diminished / dim7 | 9 | 2 | stacked tritones — glass-cannon spike | Modal |
| Extended (9/11/13) | 9 | 5 | max sophistication & power | Chromatic (5 slots) |
| Tone cluster (no chord) | 7 | 1 | chaos — see The Smash | always (fallback) |

The build order = the consonance→dissonance arc: start on defensive consonant triads,
climb toward aggressive dissonant extended chords. The spine runs through combat.

### 6.4 Theory is the art of control (the pillar)

**Attack can be primal; defense must be earned.** Anyone can deal damage by flailing
(the Smash needs no structure). But Sustain only comes from voicing real consonant
harmony — you can't defend by flailing. So a player with no theory is a glass cannon:
hits, but can't take a hit. Climbing the ladder buys **both** stronger defense (richer
consonant chords) **and** controlled aggression (dissonant chords voiced on purpose =
high Drive without the Smash's self-destruction). The arc: flail-and-pray → surgical
control. This also defines early-game combat (scrappy, primal, high-variance) vs.
late-game (defended, precise). It is **emergent** from §6.3, not a bolted-on rule.

### 6.5 The Smash (the Windmill) — the primal channel

The deliberate weaponization of the tone cluster. The guitar comes down like an axe.

- **Drawn from raw stock, not your chord** — it's *outside* tonal structure, so it never
  touches your voiced chord or cadence progress. You hurl a fistful of raw notes.
- **Undefendable** — ignores the defender's Sustain. You can't guard against pure chaos.
  This is its reason to exist: the answer to a turtle sitting on a high-Sustain wall.
- **Scales with notes thrown** — more notes = harder hit *and* more of the rival's **stock**
  scatters loose (disrupts their next turn without erasing their structure). Both
  instruments spray notes; symmetric chaos.
- **Leaves you Exposed** — you overextended; the next hit on you lands clean regardless of
  your chord. You kept your sound; you lost your balance.
- **No disarm** — knocking the instrument away was cut as too harsh now that the chord and
  cadences are precious.

### 6.6 CQC reframed — delivery, not a different power

Melee isn't "non-sonic." It's your chord delivered **point-blank** instead of projected.

- **Sonic = ranged delivery:** project the chord down a beam; needs amps; amps scale reach.
- **CQC = point-blank delivery:** swing the instrument and drive the same chord into their
  face; no amp needed; but you must be adjacent, which exposes you (`swingExposed`).
- Rebuild the CQC skill route around bashing consequences (knockback, dazed, scatter),
  not generic %-proc Trips.
- *(Bolder option:)* collapse Sonic/CQC into one attack where **distance is a risk/reward
  dial** — melee vs. ranged emerges from where you stand, not a mode switch.

### 6.7 Emergent rock-paper-scissors (no extra rules)

A voiced chord beats normal trades on Sustain; **the Smash** cracks the turtle by
bypassing Sustain; a **precise strike into the Exposed window** destroys the over-committed
Smasher. Turtle ← Smash ← Punish ← turtle. Depth without complexity.

### 6.8 Build order / open items

- **Settle the economy fork in §6.2** (refill model + consume-vs-check) first — it shapes
  everything.
- Write `evaluateChord(noteSet) → { name, drive, sustain }` in `music/`; tune the §6.3 table.
- Point the combat pipeline (`SONIC ATTACK` / swing resolution) at chord-derived Drive/Sustain
  instead of the static `spirits.js` stats; the existing `tempDrive`/`tempSustain` pattern
  detectors are the seam to replace.
- Add the Smash as a CQC action drawing from stock; implement scatter + Exposed.
- Styles (Shred/Flair/Groove) and per-spirit identity = relationship to chaos/control,
  not stat blocks.

---

## 7. Build progress (this collaboration)

- ✅ `evaluateChord` engine (`music/chords.js`), unit-tested. Subset-matches the strongest
  chord present in a note set; consonance→Sustain, dissonance→Drive, cluster fallback.
- ✅ Combat reads Drive/Sustain from the chord (both swing + sonic handlers); battle log
  shows the chord matchup. Static `spirits.js` stats are now just the empty-chord fallback.
- ✅ **Persistent chord stance** — the chord **carries between turns**; everyone starts on a
  **Power Chord** (R+5); you **revoice one note/turn** (Chord-mode tap to add, tap a chip to
  drop; floored at 1 note). State: `chordStack`, `revoiceUsedThisTurn`. (Replaced the earlier
  per-turn "chord bank / chordSlots" — those are fully removed.)
- ✅ **Stock economy** — gradual carried-over refill (`STOCK_REFILL_RATE = 4`, in
  `startNewTurnNotes`); **defense frays the chord** (one note per blow absorbed, floored at 1,
  in both combat handlers).
- ✅ **The Smash** — `resolveSmash`; primal, undefendable melee from raw unused stock; scales
  with notes thrown, scatters the rival's stock, leaves the attacker **Exposed**
  (`smashExposed` → next hit ignores their Sustain). Its own action button + `action==='smash'`
  hex-click branch; resolves directly (no dice-duel overlay).
- ✅ **Auto voice-leading** (`voiceLeadFreq`) on melody + chord playback (nearest-octave
  contour; pitch-class game logic untouched).
- ✅ **Sonic plays the prepared chord** — `playChord` strums `chordStack` when a Sonic fires.
- ✅ **HUD knobs** (`StatKnob` DRIVE/SUSTAIN + rival rows) read the chord via `evaluateChord`,
  not the static sheet.
- ✅ **Chord-build assistance** — in Revoice mode, hovering a stock note previews the resulting
  chord (`Add X → name · ⚔️/🛡️`). Default (non-revoice) hover = scale peek (note's maj/min scale).
- ✅ **Starter one-shot Transpose card** — seeded in `modCards`; `oneShot:true` so it drops
  after use instead of recharging. Rescues a bad opening hand.
- ✅ **Pivot preview respects unlocks** — Major/Minor preview uses `playableScale` (was
  lighting the full diatonic, incl. locked notes).
- ✅ Bug fixes: Revoice toggle no longer locks ON after revoicing (was trapping chord mode and
  blocking melody notes).

**Done since (this collaboration, cont.):**
- ✅ **Swing vs. Smash now read distinct.** Swing is the jab — **1 AP**, once/turn, defended,
  leverages chord Drive, applies CQC statuses, and **spends the first 2 notes of the Chord Stack**.
  Smash is the haymaker — 2 AP, undefendable, **ends all remaining movement that turn**, hurls raw
  stock, leaves you Exposed. Sonic spends the **first 1** Chord-Stack note.
- ✅ **Bots brought up to the current rules.** They now **revoice the Chord Stack** one note/turn
  (`botPlanRevoice`/`botRevoiceChord`, persona-weighted — combat/disrupt chase Drive, clean/Flair
  chase Sustain), rebuilding what attacking/defending drains, and **Smash turtles** (high-Sustain
  cone targets) when they have ≥2 unused stock.

**Still ahead (open threads):**
- **Swing↔Sonic are the same attack at different ranges** — optional "distance dial" merge if a
  tighter kit is wanted (keep Smash distinct).
- CQC skill route still uses %-proc trips — rework into bashing consequences.
- Give all 4 spirits a signature (Glamarchy + Intergalactic have none); consolidate statuses.

### Verification quirk (important for any new session)
The shell sandbox (`mcp__workspace__bash`) serves a **truncated mid-write snapshot** of files
edited through the canonical file tools — the **tail is cut off**, so a whole-file `esbuild`
bundle fails with a spurious EOF even though the real file is fine (and mid-file edits/greps
*are* visible). So: use the **file tools + Grep** (which read the canonical file) for
reading/searching, validate new logic with **isolated esbuild snippets** of the edited
functions in `outputs/`, and confirm the whole thing with **`npm run dev`**. Don't trust a
full-file bundle run in the shell. Naming: **the Chord Stack** (`chordStack`, combat harmony)
vs **the Melody Line** (`melodyLine`, melody/movement).

## 8. Sticky notes (backlog)

- **Wide leap = Flair.** Voice-leading smooths contour by default. Let a player *deliberately*
  opt out with a wide octave jump — a dramatic leap that the auto-smoother would have hidden —
  and score it (Flair / a small payout, or feed the Tension meter). Turns "register" from pure
  polish into an expressive, scorable choice. Especially fits the Flair style (Glamarchy).
- **Octave-accurate riff playback.** `playRiffSequence` currently collapses riff offsets to one
  octave (`pc = (root+off)%12`); using the real offset (`base * 2^(off/12)`) would restore each
  legendary riff's intended contour. Same idea as voice-leading, applied to riffs.
- **Tension meter** (from §5) — surface the consonance→dissonance arc as a visible dial.
- **Scattered notes land on the board.** When a Smash scatters the rival's stock, spawn loose-note
  tokens on hexes around them; a spirit that moves onto one picks it up into their stock. Turns the
  Smash's chaos into a contested scramble and ties into the refill economy. (Designed, not yet built —
  it's a small board-pickup subsystem: loose-note board state + token render + pickup check in `move`.)
