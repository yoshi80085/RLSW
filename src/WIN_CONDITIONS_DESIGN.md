# WIN CONDITIONS — 🏆 Legend Run and 🎸 Battle of the Bands

> **Design sketch, 2026-09-02. Alex's call, out of the Fame-economy conversation.**
> ⛔ **NOTHING HERE IS BUILT.** Not a config key, not a buzzer, not a menu
> button. The game ships exactly one win condition today and this doc exists so
> the next session starts from the decisions instead of re-deriving them.
>
> Companion to `GAME_BRIEF.md` (§8 the music economy), `PROGRESSION_REWRITE_DESIGN.md`
> (§7 the Fame economy, measured), `SEQUENCING.md`.

---

## 0. The one-line version

**How a match ends becomes a setting.** 🏆 **Legend Run** is the game that ships
today — first to the Fame target, or last Spirit standing. 🎸 **Battle of the
Bands** runs a fixed number of rounds and the biggest Fame score at the buzzer
wins, with **nobody eliminated**: a knockdown still costs you, but it costs you
your *crowd*, not your place in the match.

⚠️ **THIS IS NOT A SECOND GAME AND THE PROGRESSION REWRITE IS NOT ONE EITHER.**
`PROGRESSION_REWRITE_DESIGN.md` moves the Theory branch off the skill tree and
re-cuts the melody payout; it does not touch how a match ends. Both modes here
play the same game with the same board, kits, economy and rules. Only the
ending changes.

---

## 1. ⚠️ THREE AXES, NOT ONE MODE FLAG

This is the decision that everything else hangs off, and getting it wrong is
cheap to do and expensive to undo.

| Axis | Values | What it means | Where it lives |
|---|---|---|---|
| `config.mode` | `ffa` / `team` | **Table structure.** Who is on whose side, and therefore turn order. | **EXISTS.** `matchConfig`, read by `turn.js` |
| `config.winCondition` | `fame` / `rounds` | **How the match ends.** | 🆕 |
| `config.elimination` | `on` / `off` | **Whether running out of lives removes you.** | 🆕 |

⚠️ **DO NOT FOLD THE WIN CONDITION INTO `config.mode`.** That field already
means table structure and `advanceTurnQueue` reads it at two sites
(`turn.js:88`, `turn.js:138`). A field with two meanings is how this codebase's
older bugs were written, and `legalActionsCheck` §15 is the standing monument to
a rule everyone believed because one field said two things.

📌 **AND ELIMINATION IS ITS OWN AXIS, NOT A PROPERTY OF THE MODE.** Alex,
2026-09-02: *"Later on, in higher difficulty levels, the KO literally means the
player is out. But for now — no elimination."* So the pairing below is a
**default**, not a coupling. A difficulty setting must be able to turn
elimination on inside Battle of the Bands without touching `winCondition`, and
in principle to turn it off inside Legend Run (which leaves Fame as the only
route — a legitimate, gentle variant nobody has to build yet).

| | `winCondition` | `elimination` |
|---|---|---|
| 🏆 **Legend Run** (ships today) | `fame` | `on` |
| 🎸 **Battle of the Bands** (new) | `rounds` | `off` *by default* |

⚠️ **AND DO NOT BUILD THIS OUT OF `config.fameTarget` + `maxTurns`.** Those are
the bench's measurement instruments and both carry an explicit
*"a run with this set is not a game"* warning (`battleFlow.fameToWin`,
`matchConfig`, `play.MAX_TURNS`). Reaching for them because the shape looks
similar would make the shipped game indistinguishable from a probe, and the
comments would become lies the moment it landed. **New keys, or rewrite those
comments honestly in the same pass.**

---

## 2. ✅ The round clock already exists, and it is already careful

`state.js:130–145` + `turn.js:71–95` (`rollRound`). **A ROUND is one full
revolution of the turn order**, tracked by **anchor** (`roundStarterId`) rather
than by `count % aliveCount` — because that arithmetic drifts the instant a
Spirit is knocked out or a turn is skipped, which is exactly when the board is
most dangerous. A round banked by a skipped turn parks in `roundPending` and is
spent on the next real turn end, so a round is never silently dropped.

🎯 **So the buzzer is `state.turn.round > roundLimit` and nothing else needs
building.** The hard part of a round clock — the part a naive implementation
gets wrong — shipped on 2026-08-05 for the board effects.

📌 `rollRound` already re-anchors when the round-opener is *eliminated*. With
elimination off that branch simply never fires in Battle of the Bands; it stays
because Legend Run still needs it.

---

## 3. 🎸 Battle of the Bands — the rules

- **Length:** a fixed number of rounds, set in the lobby. Default **open** (§6).
- **The verdict:** most Fame at the buzzer.
- **Nobody is eliminated.** Running out of lives does not remove you.
- **A knockdown still hurts, and here is the whole design:**

### 🎤 ⚠️ COMBAT'S PURPOSE CHANGES, AND THIS IS THE LOAD-BEARING CLAIM

In Legend Run you attack to remove a rival. With elimination off that reason is
gone — so **if attacking has no purpose in Battle of the Bands, the mode
collapses into two players farming Fame in separate corners and never touching.**
That is the failure mode to design against, and it is the one to bench for.

**The answer is already in the game: a knockdown scatters the victim's crowd.**
`demolishFans` (`battleFlow.js:658` → the client's `demolishFans`, and
`harnessHooks` in `play.js:222`) takes `FAN_FLEE_MIN..MAX` (2–3) casuals off the
victim, **defects `FAN_DEFECT_TO_VICTOR` (2) of them straight to the attacker**,
resets the victim's centre streak, and locks them out of crowd gain for
`FAN_RECOVERY_LAG` (3) of their own turns.

🎯 **So in Battle of the Bands you attack to SUPPRESS A RIVAL'S MULTIPLIER, and
to steal part of it.** Violence is crowd denial rather than removal, which is
both a real reason to fight and a thematically correct one: you are not killing
them, you are stealing their audience.

📌 **AND THE 2026-09-02 FAN RE-WEIGHT MAKES THIS LAND MUCH HARDER THAN IT WOULD
HAVE A DAY EARLIER.** At the old weights three casuals were worth 0.09 on a
multiplier — nothing. At `FAN_CASUAL_WEIGHT` 0.12 they are worth **0.36**, plus
0.24 handed to the attacker, plus three turns of lockout. See
`PROGRESSION_REWRITE_DESIGN.md` §7.7. **The mode needs the re-weight to work,
and the re-weight found its best use in the mode.**

⚠️ **UNBENCHED.** Everything in this section is an argument, not a measurement.
`.scratch/famerace.mjs` can be pointed at it once the mode exists: the number to
watch is how often a searcher chooses to attack when attacking cannot win.

---

## 4. ⚠️ The couplings that break, and where

### 4.1 🎯 Lives and the Fame target are ONE DIAL today

`fameToWin = startingLives × fpPerLife(playerCount)` (`battleFlow.js:130`), and
the lobby says so out loud: *"3 Knock Downs = KO — 24 FP to win"*
(`Lobby.jsx:381`). **In Battle of the Bands there is no target, and with
elimination off there are no lives either — so that dial means nothing at all.**

📌 **Which is convenient: the lives control becomes the ROUNDS control.** Same
position in the lobby, same segmented-button shape, different meaning per
`winCondition`. One control, two labels, nothing added to the screen.

### 4.2 ⚠️ The Fame Race HUD has no right-hand end without a target

`ui/FameRace.jsx` takes `fameToWin` as *"the target; the right end of the
track"*. Remove the target and the track has no scale. **Open, and it is a
VISUAL change** — so it goes to a `.scratch/` preview page before any client
edit, per `CLAUDE.md`.

🎯 **THIS NOW HAS ITS OWN DOC: `FAME_TRACK_REDESIGN.md`.** It found that
`fameToWin` is load-bearing in **seven** places in a 139-line component — it is
the coordinate system, not a prop — and it names the trap that decides the
design (a leader-anchored scale makes every other blip slide sideways when the
leader scores, which is a lie). Candidates below are summarised; the doc has
them properly, plus the states and levers the preview page needs:

- scale to the current leader (the pack always fills the track; the gap is the
  whole message, and §"THE TIE FAN IS LOAD-BEARING" already handles the collision
  at 0–0)
- a fixed generous scale with the round counter as the real clock
- swap the track for a **rounds-remaining** readout and show Fame as numbers

⚠️ Whatever it becomes, the component's own header warns that four parallel bars
do not show a race and that the strip has room for one row. Do not solve this by
adding a second row.

⚠️ **And the round clock has a collision waiting in that same strip** — a
`🔥💿 DISCO INFERNO — N rounds left` chip already sits beside the track in the
same pill shape. A second "rounds left" chip would read as another temporary
board effect rather than as the match clock. `FAME_TRACK_REDESIGN.md` §6.

### 4.3 `decideWinner` must stay, and must not fire

`combat.js:127` crowns the last Spirit standing. With elimination off it can
never trigger — every Spirit stays in `survivors`. **Do not delete it or gate it
behind the mode flag**; it is Legend Run's second win route and `play.js:268`
calls it on every knockdown resolution. Gate `resolveKnockdown`'s
*lives-to-zero* branch instead, which is the one place the removal actually
happens (`combat.js:140–151`).

### 4.4 The per-turn Fame cap means something different in each mode

`PROGRESSION_REWRITE_DESIGN.md` §7.5 measured `FAME_PER_TURN_CAP` as a **catch-up
brake** in a race — it holds the leader back and keeps the finish close. In a
fixed-length game every seat gets the *same number of turns*, so the same
constant is a **score flattener**: it compresses everyone toward
`roundLimit × cap` and makes a big crowd worthless (§7.7 measured 48% of awarded
Fame already discarded at the new fan weights).

🎯 **So the cap probably wants a different value per mode, or the crowd-scaled
window §7.7 proposes** (`4 × mult` rather than a flat 4). **Open.** ⚠️ It should
NOT be settled by argument — §7.5 and §7.7 both exist because the intuitive
answer about this constant was wrong twice.

---

## 5. 💰 Why this de-risks the FP inflation Alex wants

Alex, 2026-09-02: *"I want to increase the amount of FP that players gain in a
game by a LARGE amount. So the amount of FP to win — I don't know this yet, I'd
need to play the game."*

🎯 **Battle of the Bands is the mode where that is free.** In Legend Run, FP is a
**finish line**, so multiplying it means re-deriving `fameToWin`, re-checking
match length, margin and the discard — the whole tangle §7.1–§7.7 has been
measuring. In Battle of the Bands, FP is a **score**, and a score can be any
size: nobody calibrates it, you play and compare.

📌 **So the order that falls out of this:** inflate FP, play Battle of the Bands
to find what a satisfying score curve feels like, and *then* set `fpPerLife` from
what a good game actually produced. That is Alex's "I'd need to play the game",
made into a procedure.

⚠️ **`fpPerLife` is the only formula between the two modes**, so an inflation
pass must state which mode it was tuned in.

---

## 6. ❓ Open — decide before building

1. **Default round count.** Nothing measured. §7.5 says a Legend Run lasts a
   median of 8–9 turns per player, so ~8 rounds is the like-for-like length —
   but a Battle of the Bands has no early finish, so it will *feel* longer than
   a Legend Run of the same nominal length. Needs playing, not arithmetic.
2. **Tie at the buzzer.** Sudden-death round? Most Diehards? Shared win? A tie
   in a two-player game is likelier than it sounds once the per-turn cap is
   compressing scores (§4.4).
3. **The per-turn cap per mode** (§4.4).
4. **The Fame Race HUD** (§4.2) — preview page first.
5. **Does the round limit show as a countdown, and does anything change in the
   final round?** A last-round klaxon is the obvious dramatic beat and costs
   nothing mechanically. Flagged, not designed.
6. **Do stage-FX Fame thresholds still fire?** They are keyed to absolute Fame
   (`stageFxThresholds`), which is fine in a race and arbitrary in a score game —
   and about to be doubly arbitrary after an FP inflation pass.

---

## 7. Where the code is

| Thing | File |
|---|---|
| The round clock | `engine/state.js` (`turn.round`), `engine/systems/turn.js` (`rollRound`, `applyTurnEnded`) |
| Match config + the whitelist | `engine/policies/play.js` (`matchConfig`), `engine/state.js` |
| ⭐ The Fame win, the target | `engine/systems/battleFlow.js` — `grantFame`, `fameToWin` |
| 💀 The last-standing win | `engine/systems/combat.js` — `decideWinner` |
| 💀 Lives → eliminated (the branch to gate) | `engine/systems/combat.js` — `resolveKnockdown` |
| 🎤 The crowd scatter that carries the mode | `engine/systems/battleFlow.js:658`, client `demolishFans`, `play.js` `harnessHooks` |
| 🎤 Fan constants | `data/gameConstants.js` — `FAN_FLEE_*`, `FAN_DEFECT_TO_VICTOR`, `FAN_RECOVERY_LAG` |
| ⛔ The per-turn cap | `data/gameConstants.js` — `FAME_PER_TURN_CAP` |
| The menu | `ui/Lobby.jsx` — the `mode` pattern (~line 58), the lives dial (~line 351, 381) |
| ⚠️ The Fame Race track | `ui/FameRace.jsx` — and `FAME_TRACK_REDESIGN.md` |
| The end screen | `ui/GameOverOverlay.jsx` |
| The match loop | `engine/policies/play.js` — `runMatch` |

---

## 8. 🧭 Build order, when it is time

1. **`config.winCondition` + `config.elimination` as real axes**, defaulted so
   every existing caller gets today's game unchanged. Whitelist them in
   `engine/state.js` in the same pass — that is the step `fameTarget`/`fameCap`
   needed and it is easy to miss.
2. **Gate `resolveKnockdown`'s lives-to-zero branch** on `elimination`. Nothing
   else about knockdowns changes: the scatter, the respawn, the Vibe reset and
   the attacker's Fame all still fire.
3. **The buzzer** — `runMatch` and the client's turn-end path stop on
   `turn.round > roundLimit` and declare the highest Fame.
4. **Tests in the same pass**, and give them a script — `CLAUDE.md`'s standing
   rule. A round-limit ending that no suite runs is not a rule.
5. **The bench**, pointed at the §3 question: does a searcher still fight when
   fighting cannot win?
6. **The menu, LAST, and via a `.scratch/` preview page** — both the mode toggle
   and whatever replaces the Fame Race track.

⚠️ **Steps 1–5 are headless and safe. Step 6 is the one with the standing rule
on it**: do not edit the HUD, the board or any visual element straight into the
client.
