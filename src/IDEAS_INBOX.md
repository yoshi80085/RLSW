# 💡 IDEAS INBOX — the cheap place to put a thought

> **Alex has an idea mid-session. It goes HERE, in thirty seconds, and the session
> carries on.** It does not become a design doc, it does not derail the work in
> progress, and it does not get filed into whatever document happened to be open.
>
> 🪦 **THIS FILE EXISTS BECAUSE OF A SPECIFIC FAILURE.** The Ronin's entire kit
> respec — including a brand-new ability — was mentioned in passing during a
> conversation about *pricing*, so it was written into the pricing doc. It was
> captured correctly and in full, and it still read like it had never been decided,
> because the canonical file went on describing the old kit for two days.
> `SEQUENCING.md` §B9. **An idea with no cheap home lands in the wrong one.**

---

## 📋 HOW TO USE IT

**Adding — Alex or an editor, three lines, no ceremony:**

```
### YYYY-MM-DD — one-line title
What it is, in a sentence or three. Half-formed is fine. Contradicting something
already built is fine — say so and move on.
```

**For an AI editor, the rules are short and they matter:**

1. ⚠️ **CAPTURE, DO NOT DESIGN.** Write down what Alex said. Do not price it, do
   not name the files it touches, do not raise objections. **An inbox entry that
   turns into an analysis has defeated the inbox** — the whole point is that it
   costs nothing to file.
2. 🎯 **If it changes something already decided, SAY SO IN ONE LINE and stop.**
   That line is what makes it findable later; the argument can wait for the day it
   gets picked up.
3. ✅ **PROMOTING is a separate, deliberate act.** When Alex chooses to work on an
   entry, it moves into the real design doc **in full**, and the entry here is
   struck through with a pointer to where it went. **Never leave a live copy in
   two places** — that is the drift this repo keeps paying for.
4. 🧊 **Do not tidy this file.** A messy inbox is working correctly. Struck-through
   entries stay as the record of what became what.

---

## 🆕 OPEN — not yet promoted

## 🗂️ FUTURE EDITS — indexed by importance

> Priority is Alex's ranking: **1 = do soon**, **5 = can wait until after the game is mainly done**. These are capture-only entries; they are not implementation decisions.

### ~~2026-09-08 — [P1] Reshape HUD for the 3D Cosmic Arena~~
✅ **Done for now — 2026-09-11.** Reshape the HUD so it reflects the 3D Cosmic Arena’s full-screen display and visual style.

### ~~2026-09-08 — [P1] Everyone starts with a basic ability~~
✅ **Done — 2026-09-11.** Everyone picks one basic signature ability before the first turn.

### ~~2026-09-08 — [P1] Gate stack upgrades and scale Drive with stack size~~
✅ **Done — 2026-09-11.** Fix the stack upgrades. They can currently be upgraded from turn 1, possibly twice, if found near the player in the right order. Add a gate behind which upgrades can be found on the board through scattered notes; plan what that gate should be. Also fix cases where gaining a 4th/5th note stack does not scale Drive and it stays the same.

### ~~2026-09-08 — [P1] Remove notes from Drive/Sustain stacks~~
✅ **Done — 2026-09-11.** Each occupied Drive/Sustain stack seat has a remove button; it returns that note to the player's available note stock.

### ~~2026-09-08 — [P1] Ability cooldown neon fill~~
✅ **Done — 2026-09-11.** Cooldown-backed ability buttons fill with their neon colour as they recharge and show exact turns remaining.

### ~~2026-09-08 — [P1] Remove the end-move button~~
✅ **Done — 2026-09-11.** The redundant End Move button is removed; players can select another action or end their turn.

### 2026-09-08 — [P1] Larger Drive/Sustain HUD dials
Make the Drive/Sustain dials a bit bigger in the HUD.

### 2026-09-08 — [P1] Animated Drive/Sustain dial changes
Show the Drive/Sustain dials slowly ticking up/down with any action affecting them.

### 2026-09-08 — [P2] Tune performance-power meter
Build out a meter when committing a tune that tells the player how much performance power the tune has: the relationship between using notes in scale, resolving a Discord, and playing what a certain character’s audience wants to hear. It should tell beginner players how much Db and how many fans they can expect, and how to make the most of the notes they have.

### 2026-09-08 — [P2] Auto-complete note commits and collapsible hints
Add auto-complete for committing notes based on the highest possible outcome for Db/fans/Drive/Sustain. Make commit hints collapsible and concise rather than unnecessarily wordy.

### 2026-09-08 — [P2] Story reason for board notes
Develop a solid story for why there are notes on the board to “get.”

### 2026-09-08 — [P2] Character-specific charge zones
Change what charge zones do. For example, they could give a special benefit to Intergalactic 0 through his boom box. Every character should have something like this instead of charge zones simply raising the floor/ceiling.

### 2026-09-08 — [P2] Simultaneous split-screen Riff Offs
Make Riff Offs happen more simultaneously with split-screen play. Players watch for their own notes and bring notes down faster; make sure the system has all the nuts and bolts of the scratch preview. Each player plays to their own style while remaining musically similar. Start with only a few notes, then gradually become more sophisticated and faster if both players keep pace. The Riff Off ends if one player cannot keep up or the battle concludes. In a decisive battle, both players can potentially score FP; one player is still blown away and loses some Vibe.

### 2026-09-08 — [P2] Backing abilities
Introduce backing abilities, potentially as another type of board hex. There are three non-unique abilities every player can get, but only one can be held at a time, and they cost more AP than normal: *Rest* (spend 2 AP to recover Vibe), *Break* (spend 2 AP to disrupt a Rival’s Sustain), and *Solo* (spend 2 AP to charge an attack by increasing the Dice pool and Dice number, replacing the old charge mechanic).

### 2026-09-08 — [P2] Discord-note usage by character
Discuss whether it matters how Discord notes are used, per character.

### ~~2026-09-08 — [P2] Recorded motion-capture animation pipeline~~
→ **`MOCAP_DESIGN.md`** (2026-09-08).

### 2026-09-08 — [P3] Famous-riff acknowledgements
Quietly acknowledge famous riffs as generic reactions such as “Super Riff!” or “I’ve heard that one before!” Award extra points such as fans, or trigger explosions of excitement. Build an archive of hundreds of riffs that trigger a small in-game acknowledgement without explicitly naming the tune.

### 2026-09-08 — [P3] Marquee spaces by category
Make marquee spaces something that is not chosen. Since the choice layer is often a pain and gets chosen randomly, show different marquee areas on the board differently: some as equipment marquee zones, others as general trivia questions. These may be split up more later; flag for now.

### 2026-09-08 — [P3] Pickles replaces Picky as a beginner music-fit tool
Rename Picky to Pickles. Pickles is picky about what kind of music gets played and, as a beginner tool, helps players find the right fit for the tune being played, showing how to maximize both economic and performative value with the available notes.

### ~~2026-09-08 — [P3] AI finger/guitar mapping for animated characters~~
→ **`MOCAP_DESIGN.md`** §2c and §9 (2026-09-08).

### 2026-09-07 — [P1] Melody scale-building guidance and rewards
Help players learn to build melody scales for the biggest effect in gaining fans/Db (the notes committed in the middle of the melody track) or Sustain/Drive/Db (the last note committed).

### 2026-09-07 — [P2] Comic-style fan blurbs
Add comic-style “blurbs” to fans so players can hear what they say when satisfied, excited, or unhappy.

### 2026-09-07 — [P2] Randomized animatronics
Build animatronics out in a random fashion, varying their color, size, and shape.

### 2026-09-07 — [P2] Edge push-off FP bonus
Pushing a player off the edge grants more FP than normal.

### 2026-09-07 — [P2] Customizable stage colors
Make the stage colors customizable.

### 2026-09-07 — [P2] Dynamic 3D battle overlay
Replace the current battle overlay with a dynamic overlay where camera angles show the 3D assets fighting on the stage itself.

### 2026-09-07 — [P2] 3D dice renders
Make the dice 3D renders.

### 2026-09-07 — [P2] Drive/Sustain tower battle meter
Make a tower instead of the battle meter that swings back and forth with the pick: two towers run next to each other and rise together, representing Drive and Sustain. Attacks connect; the question is whether they are strong enough to break through rather than missing/whiffing. Dice appear, resolve the tower, and show the rival’s tower clearly so the winner is visible.

### 2026-09-07 — [P3] Team play and Spirit harmonies
Add team play where harmonies matching up power the Spirits. Db as a resource depends on the Spirits playing in harmony with each other.

### 2026-09-07 — [P3] Zoom-reactive fan voices
Add mini voices to the fans. They normally cannot really be heard, but can be heard when the player zooms in on them.

### 2026-09-07 — [P3] Stage events
Add stage events: *Bat Snack* (bats fly around; if they get the player from behind, they take a bite and the player loses 1 Vibe; if approached, the player bites off the bat’s head and gains fans), *Orb of Pure Evil* (avoid it; if it approaches, fans melt to green goo), *Satanic Panic*, *Labyrinth*, *Crossroads Deal* (possibly trade Vibe for increased Drive/Sustain), *Sledgehammer Duel (Streets of Fire)*, and *Perfect Pitch (Rock and Rule)*.

### 2026-09-07 — [P3] Spirit-specific fan use
Give each Spirit unique ways to use fans/diehards, such as Groupies.

### 2026-09-07 — [P3] How to Play rewrite
Redo the How to Play section.

### 2026-09-07 — [P3] Riff Off upgrades
Give players upgrades that affect the Riff Off in some way.

### 2026-09-07 — [P3] Timed commit strategy and difficulty rules
Make the chord/melody commit a timed strategy for normal levels. Beginner levels are not timed. Default to beginner. Hard mode offers no colored hints. Extreme mode has a timer and no color hints.

### 2026-09-07 — [P3] Guitar lessons aligned to game theory
The guitar lessons section should cover everything related to the game first and foremost, helping players realize exactly which theory steps are used in the game and translating these into guitar theory lessons.

### 2026-09-07 — [P4] Japanese language option
Make an option for Japanese language.

### 2026-09-07 — [P4] Riff Listener / Ear Spy
Attempt to finish out Ear Spy as a tool. Add a Riff Listener (Ear Spy) that can pick up the root note, how the passage ended, and give hints on how to riff off the played passage, like online with another player.

### 2026-09-07 — [P4] Freeze-frame battle moments
Freeze-frame action/battles as they are taking place: slow down, zoom in, and blur, like the slow-motion attack mechanic in newer Legend of Zelda games. Slow it down to just before the hit/not breaking through is confirmed.

### 2026-09-07 — [P5] Collectibles
Add collectibles for the game: outfits, instruments, pedals that can affect the sound, cards, and more.

### 2026-09-07 — [P5] Overworld note-tile puzzler
Turn the overworld idea into a puzzler with random notes: a sandbox randomly generated with note tiles where the player decides how to move/end movement. No hints; clicking the wrong hex incurs a penalty.

### 2026-09-07 — [P5] Chord inversion Note Recon
Do a chord inversion version of Note Recon.

### 2026-09-07 — [P5] Riff Listener character/filter mode
Build out Riff Listener so the player can become one of the playable characters, with their avatar playing back from the screen. It needs tracking/filters and may be an addition after the game is completed.

### 2026-09-04 — 🎵 Wa no Koe, new form: the notes come to him

Declared by pushing the ability button. If any space on the board holds a note
matching your **root Drive or Sustain note**, you get a temporary bonus Drive and
Sustain buff, and **the note comes flying to you from across the board.** They
stack one for one — 1 is 1, 2 is 2, and so on.

⚠️ Contradicts §2.4's cut only in name: the old passive is deleted and the
Resonant-note/Echoes design is shelved. This is a **third** ability wearing the
name, and it would take the empty 12 Db mastery slot.

---

## ✅ PROMOTED — where things went

### ~~2026-09-08 — the mocap pipeline, and the finger/guitar mapping~~
→ **`MOCAP_DESIGN.md`.** Body, face and guitar as **three separate captures** —
and the guitar is not a capture at all, it is solved from the two wrists. Recorded
once and baked to animation clips, so ⭐ **no player ever needs a webcam**; the
live-camera version is deferred in its §8. ⛔ Blocked on a rigged character and on
nothing else.

⚠️ **[P5] *Riff Listener character/filter mode* deliberately stays OPEN above.**
It is the live-camera toy, which `MOCAP_DESIGN.md` §8 defers rather than adopts —
folding it in here would be filing a decision that was not made (§B9).

### ~~2026-09-04 — the Cursed Shamisen becomes a siphon~~
→ **`RONIN_ABILITY_DESIGN.md` §2.3.0.** Swing-area, pick a rival's ability with no
cooldown readout; if it is recharging the rival is pushed +1 and Ronin's own
cooldowns drop by however many turns it had left.

### ~~2026-09-04 — flat base cost, one free ability, rising upgrade prices~~
→ **`UPGRADE_SHOP_DESIGN.md` §0⃣.** Every base ability costs the same; every seat
starts with one already active; each further step on an ability costs more than
the last. Supersedes that doc's R2 and R3.

### ~~2026-09-04 — every Spirit gets a cooldown, most 3–4 turns~~
→ **`STATE_OF_PLAY.md` §4** and `RONIN_ABILITY_DESIGN.md` §2.3.0. The rule the
siphon depends on.

### ~~2026-09-04 — balance is deferred while the kit is in flux~~
→ **`UPGRADE_SHOP_DESIGN.md` §0⃣.4**, as a standing instruction for every doc.

### ~~2026-09-02 — Shukuchi Arpeggio, and the Ronin kit respec~~
→ **`RONIN_ABILITY_DESIGN.md` §2.** 🪦 Originally landed in `UPGRADE_SHOP_DESIGN.md`
§3.1 and sat there for two days. **The reason this file exists.**
