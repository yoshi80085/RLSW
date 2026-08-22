# Rock Legends: Spirit Wars — design brief

**A self-contained description of the game and every number you can turn.**
Written 2026-08-21 from the code, not from memory. You are reading this because
you are helping think through balance and design changes away from the codebase.

**How to use this with me:** propose changes as *constant name → new value*, or as
a described rule change naming the system it lives in. Both are directly
actionable in the repo. Vague suggestions ("make combat swingier") cost a round
trip; `THRASH_DIE 4 → 6` does not.

**Two honesty markers appear throughout:**

- 🎲 **GUESS** — nobody has measured this. Changing it is cheap; defending it is not.
- 📏 **MEASURED** — this number came out of a simulation or a bench run. Changing it
  should come with a reason that beats the measurement.

---

## 1. What the game is

A **music-battle board game** for **2–4 Spirits** on a **111-hex stage**. Each
player is a guitar spirit fighting for the crowd's attention. You win by being
famous, not by being the last one standing.

The central idea, and the thing every system serves: **you build a chord, and the
chord is simultaneously your combat stats, your musical licence, and your reach.**
There is no separate "attack stat" — the chord you have stacked *is* the attack.

Three things are happening at once on your turn:

1. **A board game.** Move, face a direction, hit people, grab things.
2. **A music game.** Draw notes, build chords, play melodies, get paid for
   playing well.
3. **A popularity contest.** Fans watch, fans defect, and fame is the win
   condition.

---

## 2. Winning

| Route | Value | Constant |
|---|---|---|
| **Fame** | first to **24 Fame** wins | `FAME_TO_WIN` |
| **Limelight** | hold the centre hex (**hex 56**) for **3 of your turns** | `LIMELIGHT_TO_WIN`, `LIMELIGHT_HEX` |
| **Rock God** | if summoned, killing him ends it (see §11) | — |

**Fame is capped at 4 per turn** (`FAME_PER_TURN_CAP`) — so a single monster turn
cannot end the game, and consistency beats a spike. Riff-off fame has its own,
much looser cap of **8 per turn** (`RIFF_FP_TURN_CAP`).

⚠️ **The two routes are not symmetric and that is deliberate.** Fame is earned
everywhere, slowly. The Limelight is one specific, published, central hex — so
going for it announces your intention to three opponents and puts you where
everyone can reach you. Standing on hex 56 pays *nothing* by itself; only
**posing** there does (§7).

---

## 3. The cast

Four Spirits. **Three are playable; Glamarchy is in development** (`IN_DEVELOPMENT`),
and `MAX_PLAYERS` is currently **3**.

| Spirit | Vibe (HP) | Drive | Sustain | Speed | Style | Identity |
|---|---:|---:|---:|---:|---|---|
| **Shredding Ronin** (`cosmic_ronin`) | 5 | 8 | 5 | 5 | Shred | Glass cannon. Highest Drive, lowest Sustain. Starts holding `theory_minor` free. |
| **Intergalactic 0** (`intergalactic_0`) | 4 | 6 | 7 | 4 | Groove | Fragile controller. **Innate: +1 Sustain on every chord voicing, and a cluster also reads +1 Drive.** |
| **Metalness Monster** (`Metalness_Monster`) | 5 | 7 | 6 | 4 | Shred | Bruiser. Leaves a poison slime trail. |
| **Glamarchy** (`Glamarchy`) | 4 | 5 | 8 | 5 | Flair | ⚠️ **NOT PLAYABLE YET.** Highest Sustain, lowest Drive. |

**Drive** = offence. **Sustain** = defence/staying power. **Vibe** = hit points.
**Speed** = movement steps per turn.

⚠️ **"Style" is now flavour only.** Shred/Groove/Flair used to pay Db for matching
a fixed pattern. **That system is deleted** — it re-scored gestures the Drive and
Sustain bonuses already paid for. Style is now an icon, a colour and a tagline. Do
not propose changes that assume Style rewards anything.

---

## 4. The turn

Your turn gives you:

- **Move steps** = your Speed stat (Ronin/Glamarchy 5, others 4).
- **One action token** — most combat actions exhaust it, so it is roughly
  "one big thing per turn".
- **AP (beats)** spent per action.
- **6 note-stock slots refilled** (`STOCK_REFILL_RATE`) — this is *the* budget.
- **3 stack-commit budget** (`STACK_COMMIT_BUDGET`).

| Action | AP | Constant |
|---|---:|---|
| Move one hex | 1 | `MOVE_AP_COST` |
| Change facing | 1 | `FACE_AP_COST` |
| Swing (melee) | 1 | `SWING_AP_COST` |
| Sonic (ranged beam) | 2 | `SONIC_AP_COST` |
| Smash | 2 | `SMASH_AP_COST` |
| Drop slime | 1 | `SLIME_AP_COST` |
| Melody line | up to 8 notes | `MELODY_MAX` |

📌 **The note stock is the real economy.** Every hex you walk and every stack
commit is paid out of those six slots. If you want to change the pace of the whole
game, `STOCK_REFILL_RATE` is the single biggest lever in the file.

**Turn vs round.** A *turn* is one player acting; a *round* is one full revolution
of the turn order. **Rule of thumb: if it can hurt or help someone who isn't
acting, it waits for the round.** Stage effects, spotlight moves, token drift and
board respawns run on the round; debuffs, burn, the fan economy and rig atrophy
run on your own turn.

⚠️ **This distinction is load-bearing for tuning.** A clock counted in
player-turns runs ~3–4× faster than one counted in rounds. Any duration you
change, state which clock it is on.

---

## 5. Facing — the hidden combat layer

Every Spirit faces a direction. It matters in three ways:

- **Swing** only reaches a cone in front of you.
- **Sonic beams** fire along your facing.
- **Rear hits** get a bonus (`REAR_ARC`, `REAR_FRAY_BONUS` in `combat.js`) —
  attacking someone from behind fractures their chord harder.

Turning costs **1 AP**, so orientation is a real resource, not free.

📏 **MEASURED, and worth knowing before you touch it:** paying the bot *more* for
good facing made it play *worse* — it spun in place admiring its angles instead of
acting. The same shape showed up again with the marquee. **Value on the approach
funds orbiting rather than arriving.**

---

## 6. Combat

### The core roll

Attacker and defender each roll. **Margin = attacker's total − defender's total.**

| Margin | Damage | Knockback | Fame |
|---:|---:|---:|---:|
| 0–3 | 1 | 1 | 1 |
| 4–6 | 2 | 1 | 2 |
| 7–9 | 3 | 1 | 3 |
| 10+ | 4 | 1 | 3 |

📌 **Knockback is flat 1 at every margin.** If you want big hits to *move* people,
that table (`knockbackSpaces` in `engine/systems/combat.js`) is where.

**Attack bonuses are capped at +5** (`ATK_BONUS_CAP`). ⚠️ There is a design lesson
embedded here: an old ability got +6 by being written *outside* the cap, and the
note in the code reads **"a cap with an exemption written into it is not a cap."**
Prefer abilities that *set* a total over ones that add outside the cap.

### The three attacks

**⚔️ SWING** — 1 AP, melee, cone in front of you. **Costs 2 notes off your Drive
stack, on a hit only.** Whiffing keeps your stack.

**🔊 SONIC** — 2 AP, ranged beam along your facing, reach **3**
(`SONIC_BEAM_REACH`). **Costs 1 note off your Drive stack, hit or miss** — you
spent it the moment you projected it. Rolls a **dice pool, keep-highest**:

- Pool size = your rig's **pool tier** (1–3), max 4 dice (`SONIC_POOL_MAX`).
- Die size = **d6** base (`SONIC_BASE_DIE`), **d8** upgraded (`SONIC_UPGRADED_DIE`).
- Defender braces on **d6** in your rig radius, **d4** outside it
  (`SONIC_DEF_DIE`, `SONIC_DEF_DIE_OUT_OF_RIG`).
- Max Sonic roll is **8**.

**🎸💥 SMASH** — 2 AP. Flat, no roll: **2 damage, 2 knockback, strips 2 Sustain**,
costs you 1 Sustain (`SMASH_DAMAGE`, `SMASH_KNOCKBACK`, `SMASH_SUSTAIN_STRIP`,
`SMASH_SELF_SUSTAIN`).

⚠️ **The Smash is completely unmodelled in the headless simulation.** It is the
oldest known debt in the project. **Any bench number about combat balance has
never seen a Smash happen.** Treat Smash tuning as unmeasured by definition.

**🪓 THRASH** — a d4 attack (`THRASH_DIE`) with a d6 ceiling die
(`THRASH_CEIL_DIE`), damage capped at 4 (`THRASH_DAMAGE_CAP`), whiff still does 1
(`THRASH_WHIFF_DMG`), pushes at threshold 1 (`THRASH_PUSH_THRESHOLD`).

### Underdog catch-up

If you are behind by **6+ Fame** (`UNDERDOG_MIN_DEFICIT`), your Fame gains
multiply: **+0.5× per 6 Fame of deficit** (`UNDERDOG_DEFICIT_PER_STEP`), capped at
**2.5×** (`UNDERDOG_MAX_MULT`). So −6 → 1.5×, −12 → 2×, −18 and beyond → 2.5×.

📌 This is the main anti-runaway mechanism. It is aggressive. If matches feel like
nobody can close out a win, this is the first suspect.

---

## 7. The Limelight and posing

Hex 56 is the centre of the stage. Standing there does nothing. **Posing** there
pays, and only on a turn you actually held it.

- Payout **ramps +1 per consecutive round** (`POSE_FP_STEP`), **capped at 4**
  (`POSE_FP_MAX`).
- Each pose costs **1 Sustain** (`POSE_SUSTAIN_COST`).
- Holding it **3 times wins the game** (`LIMELIGHT_TO_WIN`).

⚠️ **Posing drops your guard** — a posing Spirit is easier to hit. That is the
counterplay: the crowd-pleasing move is also the vulnerable one.

🎲 **OPEN QUESTION, UNEXAMINED:** posing frequency in simulation fell from **1054
to 224** occurrences after an earlier change and **nobody has worked out why.**
If you propose pose changes, know that the current baseline is not understood.

---

## 8. The music economy — how you get paid

This is the heart of the game and the most intricate part.

### Notes, stacks and chords

You draw notes into a **stock** (6 refilled per turn). You spend them two ways:

1. **Building your chord stacks** — a **Drive stack** and a **Sustain stack**.
2. **Playing a melody line** — up to 8 notes, committed for Db.

Your stacks each hold up to **3 notes** at base (`STACK_CAP_BASE`), rising to
**6** (`STACK_CAP_MAX`) as you climb the Theory ladder.

**The chord you stack sets your combat stats.** Bigger, richer chords hit harder:

| Chord | Rank | Drive | Sustain |
|---|---:|---:|---:|
| Power chord (root + 5th) | 2 | 5 | 5 |
| Sus2 / Sus4 | 3 | 6 | 6 |
| Major / Minor triad | 4 | 5 / 5 | 7 / 7 |
| Diminished / Augmented | 5 | 7 | 5 |
| Dom7 / Dim7 / m7♭5 | 6 | 8 | 6 |
| Maj7 / Min7 | 6 | 6 | 8 |
| Dominant 9 | 7 | 9 | 7 |
| Minor 9 | 7 | 7 | 9 |
| Dominant 13 | 8 | 10 | 8 |
| Minor 11 | 8 | 8 | 10 |

📌 **The shape of this table is the game's whole risk curve.** Dominant chords lean
Drive, minor/major-7 chords lean Sustain, and rank tracks how many notes it costs
to build. Everyone starts able to play a power chord.

### Db (the upgrade currency)

**Db is what you spend on skills.** You earn it by committing melody lines.

**A commit pays:**

| Source | Amount |
|---|---|
| **Length** | `floor(notes / 2) − 1` — so 4 notes → +1, 6 → +2, 8 → +3 |
| **Ending on the 5th** | +3 |
| **Ending on the 4th** | +2 |
| **Octave ending** (first note = last note) | +1 |
| **Harmonic Lock** — final note is a tone of one of your stacks | +1 at chord rank 4–5, **+2** at rank 6–7, **+3** at rank 8 |
| **Discord penalty** | −1 per unpardoned note **past the first**, capped at −3 |

**Skill purchase threshold: `DB_UPGRADE_THRESHOLD` = 4.**

🎯 **The intended feel:** Db pays for *facts you can aim at* — how much you played,
where you came to rest, whether that landing was inside your chord, how many notes
fought the key. It deliberately stopped paying for "was that interesting?" — that
question moved wholesale to the crowd (§9), where being impressionistic is correct.

### The Theory ladder — the pardon economy

This is the one genuinely novel mechanic. **Your chord stack decides which notes
are legal.** Notes that would be Discord against the song's key stop being Discord
when the chord you built makes them legal. Each Theory rung widens how far that
permission reaches.

| Rung | Db | What it widens |
|---|---:|---|
| `theory_major` — The Full Scale | 6 | Adds 4th & 7th; completes the Major scale |
| `theory_minor` — Minor Tonality | 8 | **Chord-tone pardon**: any note in your Drive or Sustain stack is never Discord |
| `theory_dom7` — Blues / Dominant 7th | 10 | **Play the changes**: pardon widens to your stack's *implied* chord completed to its 7th. **+1 stack slot (4)** |
| `theory_modes` — Modal Colour | 12 | **Extensions** by chord quality: ♯4 over major, ♮6 over minor, ♭9/9 over dominant. **+1 stack slot (5)** |
| `theory_chromatic` — Chromatic Mastery | 16 | **Approach notes**: any note is clean if the next lands on a chord tone. **+1 stack slot (6)** |

**Total ladder cost: 52 Db.** The Ronin starts holding `theory_minor` free.

⚠️ **KNOWN DESIGN PROBLEM, AND IT IS THE BIGGEST ONE OPEN.** Theory now gates: the
stat ceiling, the melody palette, the Db payout, chord capacity, *and* the pardon
economy. The competing "Electric/amp" route that used to absorb 110 Db **has been
deleted** — the rig is won at the quiz now (§10). So **Theory is close to the only
ladder in the game, and buying it is close to automatic.** The design note says
each other route needs "one thing nobody else can grant." **This is the most
valuable open problem to think about.**

---

## 9. Fans and the crowd

The crowd is a separate economy from Fame, and it *multiplies* Fame.

- Two fan types: **casuals** (cap 14) and **diehards** (cap 6). You start with
  **0 casuals, 2 diehards** (`FAN_CASUAL_START`, `FAN_DIEHARD_START`).
- **Crowd multiplier** = `1 + 0.1 × diehards + 0.03 × casuals`, **capped at 2.0×**
  (`FAN_DIEHARD_WEIGHT`, `FAN_CASUAL_WEIGHT`, `FAN_MULT_CAP`).
- **Where you stand matters.** Fan gain by ring: **main +2, pit +1, floor +1,
  back +0** (`FAN_GAIN_BY_RING`). Playing to the centre pays.
- **Promotion:** every **3rd** consecutive turn spent in the centre converts a
  casual into a diehard (`FAN_PROMOTE_EVERY`).
- **Boredom:** do nothing for **3 turns** and fans start leaving
  (`FAN_BORED_AFTER`), decaying **2** at a time (`FAN_DECAY`), with a **3-turn
  recovery lag** (`FAN_RECOVERY_LAG`).
- **Defection:** getting knocked out sends **2 fans to the victor**
  (`FAN_DEFECT_TO_VICTOR`); **2–3 flee** outright (`FAN_FLEE_MIN/MAX`).

📌 **Fans are the one economy with no per-turn cap.** Fame is capped at 4/turn;
fan gain is not. That asymmetry is unmeasured and is flagged in the project's own
open-questions list as worth checking.

---

## 10. The rig (your amp) and the marquee quiz

Your Sonic attack's strength comes from your **rig**, which has three properties.

**Radius — it breathes with your chord.**

```
radius = 3 + (your turn ? Drive stack length : Sustain stack length)
```

`RIG_RADIUS_FLOOR = 3`. Everyone opens at **4** (floor + the seeded root note). A
full six-note stack reaches **9** — most of the board, never all of it.

🎯 **Why the turn split:** every offensive check happens on your own turn (can I
fire?) and every defensive one on someone else's (can I answer a beam?). Drive on
your turn, Sustain on theirs, hands each check the stack it was already about.

⚠️ **Floor 3 is an anti-death-spiral.** A Spirit emptied out by spending or by
being beaten drops to 3 but no lower. Lower the floor and the Spirit already
losing is the one who cannot answer a beam.

**Pool and power — won at the marquee, lost to neglect.**

Two marquee hexes sit on the board (`EVENT_HEX_COUNT = 2`, minimum separation 4).
Step on one and you get a **choice card, face-down, before the question is drawn** —
lane × difficulty. The choosing-before-seeing is the whole skill component.

| Lane | Pays | Easy | Medium | Hard |
|---|---|---:|---:|---:|
| 🎤 **CROWD** | fans | +2 | +3 | +4 |
| 🎛️ **RIG** | tiers | 1 | 2 | 3 |

(`TRIVIA_REWARD`, `TRIVIA_TIER_GRANT`. Bot answer odds: easy 0.7 / medium 0.5 /
hard 0.35 — `TRIVIA_BOT_ODDS`.)

- Tiers go into **`rigPool`** (dice count) and **`rigPower`** (die size), each max
  **3** (`RIG_TIER_MAX`), with **`rigPower ≤ rigPool`** enforced.
- `rigPool` starts at **1** (`RIG_POOL_FLOOR`) and atrophy never takes it lower.
- **Atrophy:** one tier shed every **3 of your own turns** without a marquee trip
  (`RIG_ATROPHY_TURNS`). **Power sheds before pool** — shedding pool first would
  silently drop both.
- A wrong answer costs nothing. **The trip resets the clock**; showing up is the
  price, and standing on a published central hex is the counterplay.

**Question bank:** 200 questions. Buckets: crowd easy/medium/hard = 29/56/37, rig
= 22/34/22. Drawing recycles **per bucket**, so a favourite lane cannot run dry
while other buckets sit untouched.

⚠️ ⚠️ **THE SINGLE MOST IMPORTANT CAVEAT IN THIS DOCUMENT.** In simulation,
**85% of Spirits finish a match still at the rig floor**, and marquee visits run
about **0.5 per match**. **No bench measurement anyone has taken describes a game
in which anybody's rig actually grew.** If you propose rig tuning, you are tuning
a system that in practice almost never gets used. The more interesting question is
*why nobody goes*.

🎲 `RIG_ATROPHY_TURNS = 3` is a **GUESS**. So are the two bot weights that decide
whether it walks to a marquee at all.

---

## 11. The Rock God (the endgame boss)

If someone runs away with the game — a lead of **3** (`ROCK_GOD_RUNAWAY_LEAD`) — a
Rock God descends and everyone has a common enemy.

- **HP = 20 per Spirit** (`ROCK_GOD_HP_PER_SPIRIT`).
- **Timer: 45 seconds** (`ROCK_GOD_TIMER_SECONDS`) — ⚠️ **he runs on wall-clock
  time, not turns.** The deliberate exception to everything in §4. Dawdle and he
  swings again.
- Difficulty presets: **chill** 30s/60s, **standard** 20s/45s, **brutal** 12s/30s.
- Vengeance damage **2**, killing blow pays **3 Fame** (`ROCK_GOD_VENGEANCE_DMG`,
  `ROCK_GOD_KILL_BLOW_FP`).
- **Only one god of four is implemented** — Bardbarian. Feedback Warlock, Sonic
  Sorceress and Glam Reaper exist as definitions and fall back to Bardbarian.

---

## 12. Stage effects — the board turning hostile

At **8, 16 and 24 stars** (`STAGE_FX_THRESHOLDS`) one effect fires, drawn from a
per-game shuffled deck so there are no repeats.

| Effect | Damage | Spread / count | Duration |
|---|---:|---|---|
| **Smoke machine** | — | radius 2, spreads | 3 rounds |
| **Laser show** | 1 | 3 beams | 3 rounds |
| **Pyrotechnics** | 1 (+2-turn burn) | 2 waves, 5 then 8 hexes | — |
| **Animatronics** | 1 | 2 of them, chasing | 2 rounds |

⚠️ **Hazards never start on a player.** Beams and pyro are rolled *around*
occupied hexes and nothing damages at roll time — **hazards bite on entry only.**
Walking in costs you; shoving a rival onto a live beam works. That rule is
deliberate and worth preserving in any change.

---

## 13. Board pickups

- **Lost Chords / tokens** — `TOKEN_MAX` 6 on the board, base pool 10, 2 spawn per
  round, drift every turn (`TOKEN_*`).
- **Charge Zones** — 2 on the board, boost for 2 turns, 2-turn cooldown, floor
  bonus +2 (`CHARGE_ZONE_*`, `CHARGE_FLOOR_BONUS`). Tapping one is a **flat 50/50
  spark** — the old "choose your payoff" upgrade was cut.
- **Disco Inferno** — 6 flaming discs, 2 rounds (`FLAMING_DISC_*`).
- **Event spaces** — 10 defined events: `disco_inferno`, `bat_snack`,
  `satanic_panic`, `spinal_tap`, `seance_27`, `hotel_trash`, `payola`,
  `stage_dive`, `backstage_pass`, `divine_mission`.

---

## 14. Character abilities

Each playable Spirit has an exclusive route nobody else can buy.

**🗡️ Shredding Ronin**

| Ability | Db | What |
|---|---:|---|
| Psycho Bushido | 6 | Iaijutsu dash in a straight line; **unused AP becomes bonus Drive on that strike**. Cooldown 2 turns, min 2 AP (`PSYCHO_BUSHIDO_CD/MIN_AP`) |
| Shadow Illusion | 6 | A decoy |
| Cursed Shamisen | 8 | Minor-key haunt — ticks **once per round**, only touches Spirits in a minor scale mode |
| Wa no Koe (和の声) | 12 | ≥half your melody sitting inside your stack pays +1 Drive or Sustain for 3 rounds. **Reworked in B10** (Ronin now gets Chord Tone Pardon free, so this amplifies it). ⚠️ One bug survived that rework — see below |

**🧪 Metalness Monster**

| Ability | Db | What |
|---|---:|---|
| Goes to 11 | 6 | **Sets** Drive to 11 (`ELEVEN_DRIVE`), then the amp blows for 2 turns (`ELEVEN_AMP_BLOWN_TURNS`) — a blown amp is treated as *out of rig wherever you stand*: Sonic offline, bracing on a bare d4 |
| Master of Moshpits | 8 | — |
| Tentacle | 10 | Reach attack |
| Azrael | 12 | Pays for a knockdown streak |

Plus the slime trail (innate): 3-turn lifetime, max 6 tiles, 3 move steps,
2 slide steps per turn (`SLIME_*`, `SLIDE_STEPS_PER_TURN`).

### ⚠️ Wa no Koe — reworked once, and one bug of the same shape survived it

The 12 Db Ronin capstone. It fires on a melody commit when **≥50% of the melody's
note names appear in the combined Drive+Sustain stack**, granting +1 `tempDrive` or
`tempSustain` and pushing a 3-turn entry onto `waNoKoeBuffs`.

**It was reworked in the Theory rewrite (task B10, shipped).** That pass did three
things: it granted the Ronin `theory_minor` — the Chord Tone Pardon — **free from
turn one**, so his signature became the amplifier on an instinct he was born with
rather than a gimmick the Theory tree had obsoleted; it rewrote the card text to say
so; and it fixed a real bug — the call site read `driveStack ?? sustainStack`, and
since `??` only falls through on null/undefined while **both stacks are always
arrays**, *Wa no Koe had never once seen the Sustain stack.* It now passes both.

⚠️ **BUT A SECOND BUG OF EXACTLY THE SAME SHAPE SURVIVED, AND IS STILL OPEN.** The
project's own bot handoff says as much, in as many words — *"this is the second bug
of exactly this shape in this one function — B10's `driveStack ?? sustainStack` was
the first."*

🔴 **THE LIVE BUG — IT CAN LEAVE HIM WEAKER.** The commit sets `tempDrive` to the
run/colour Drive boost (keep-highest, up to **+3**). Wa no Koe then overwrites it
with *pre-commit* `tempDrive + 1`. On a normal turn that pre-commit value is 0, so a
**5-note diatonic run that earned +3 Drive ends at +1** — a net −2 on exactly the
turn he played best, because a long run sitting inside his chord is precisely the
melody that trips both. The on-screen flash still reports the +3 he did not get.
📌 Reproduced in the engine on purpose ("a kernel that quietly plays a better game
than the client is the same failure as an invented rule"), pinned in
`melodyCommitCheck`. **Now a one-place edit**: read the patch's `newTempDrive`
instead of `prevTempDrive`, and drop the pin.

📌 **Two more behaviours that are NOT logged as bugs anywhere** — flagged here so
they are decisions rather than surprises:

- **The stat is chosen by stack SIZE, not by which stack the melody matched**
  (`driveStack.length >= sustainStack.length ? 'drive' : 'sustain'`, ties to Drive).
  A melody sitting entirely inside the Sustain stack pays **+1 Drive** when the
  Drive stack holds more notes. This is original behaviour and B10 explicitly
  noticed the function reads both stacks, so treat it as **accepted, possibly
  intended** — "the stack you invested in" is a defensible rule. It just is not
  what the card's wording implies.
- **"3 rounds" is closer to "until your next fight."** `clearBattleBuffs` zeroes the
  attacker's `tempDrive` and the defender's `tempSustain` after every battle, so a
  Drive buff dies the moment he swings — the thing he bought it for. The counter
  keeps running and on expiry subtracts 1 from whatever `tempDrive` is there by
  then, so a stale entry can shave a point off an unrelated later bonus.
  ⚠️ **This one appears in no design doc** — it may be intended battle-scoping that
  the card never caught up with, or it may be unexamined. Worth a decision.

📌 The bot queues it **last** of the Ronin's four and buys ~2.7 skills a match, so
almost no simulation has ever seen it fire.

**🪐 Intergalactic 0** — innate +1 Sustain on every voicing.

| Ability | Db | What |
|---|---:|---|
| Gravity Control | 6 | Pulls; drains 2 notes (`GRAVITY_*`) |
| Code Injection | 6 | — |
| Space is Displaced | 8 | Teleport, 2–3 rings (`DISPLACE_*`) |
| Blaster of Ra | 10 | Uses Smash math |
| Sunbeam | 14 | Blinds 1 turn, 50% chance to linger, max 2 (`SUNBEAM_*`) |

📌 **Note the asymmetry:** the Ronin's route is 32 Db, the Monster's 36, and
Intergalactic 0's is **44** across five abilities. Against a 52 Db Theory ladder
and roughly 2.7 skills bought per player per match, most of this is never seen in
a single game.

---

## 15. Riff-offs

Two Spirits duel by playing a falling-note rhythm game. Notes are graded:

| Grade | Weight |
|---|---:|
| Perfect | 1.0 |
| Good | 0.7 |
| OK | 0.45 |
| Miss / Wrong | 0 |

Margin scale **2.6**, tie epsilon **0.4** (`RIFF_MARGIN_SCALE`, `RIFF_TIE_EPS`).
The winner's margin converts into damage through the same `marginToDamage` table
as everything else. Riff fame is capped at **8 per turn**.

⚠️ **Round-2 speed is explicitly unmodelled** in simulation.

---

## 16. Known problems, ranked

If you want to work on something that matters, work here.

1. 🕳️ **Theory is close to the only ladder.** It gates the stat ceiling, the
   palette, the Db payout, chord capacity and the pardon economy at once, and the
   110 Db competing route was deleted. Each other route needs one thing nobody
   else can grant. **The most valuable open problem.**
2. 🎛️ **Nobody trains their rig.** 85% of simulated Spirits end at the floor;
   ~0.5 marquee visits per match. The system that hands out dice is almost never
   used, and the reason is probably positional, not numeric.
3. 🔊 **Marquee throughput is unmeasured.** Two marquees roughly double quiz
   income, fans have no per-turn cap, and the same card now hands out dice too.
4. ✨ **Poses fell 1054 → 224** and nobody knows why.
5. 🪦 **The Smash is unmodelled**, so no combat measurement includes it.
6. 🧪 **Board hazards do nothing in simulation** — the ooze never fires in a bench
   match, so hazard tuning is guesswork.
7. 🎸 **Riff fame pricing** (`awardRiffFame`) has never been re-priced against
   the rest of the economy.
8. ⚡ **Dead weight:** `edgeCombatMods` returns a permanent zero from four call
   sites (the Dissonance Edge is removed), and `STYLE_SYSTEM_HANDOFF.md` documents
   a system that no longer exists.

---

## 17. Design principles the codebase actually holds itself to

Worth respecting in anything you propose:

- **The fiction is the rule.** Mechanics should be explicable in music terms.
  "Your chord decides which notes are legal" is the model example.
- **Measure, then tune.** Numbers should come from simulation, not vibes. The
  project has repeatedly been surprised: paying the bot more to approach something
  made it approach *less*.
- **A cap with an exemption is not a cap.** Abilities that *set* a value are
  preferred to abilities that add outside the cap.
- **Pay for facts a player can aim at**, not for aesthetic judgements. That is why
  the Style scoring system was deleted.
- **Don't score the same gesture twice in two currencies.** That was the specific
  sin that got Style cut — its detectors re-found gestures the Drive and Sustain
  bonuses already paid for.
- **The exposed position is the counterplay.** The Limelight and the marquees pay
  well *because* standing on a known central hex invites three opponents.
- **Prefer subtracting.** Recent history is mostly deletions — the whole amp skill
  branch, the Style system, the Dissonance Edge, a chromatic-run payout that fired
  on 1% of commits. Each removal made the game more legible.

---

## Quick reference — the levers most likely to matter

| Want to change | Turn this |
|---|---|
| Match length | `FAME_TO_WIN` (24), `FAME_PER_TURN_CAP` (4) |
| Game pace / how much you can do | `STOCK_REFILL_RATE` (6) |
| Comeback strength | `UNDERDOG_*` (6 / 6 / 2.5×) |
| Combat lethality | the `marginToDamage` table; `ATK_BONUS_CAP` (5) |
| How far beams reach | `RIG_RADIUS_FLOOR` (3), `SONIC_BEAM_REACH` (3) |
| How fast a rig decays | `RIG_ATROPHY_TURNS` (3) 🎲 |
| Crowd influence | `FAN_MULT_CAP` (2.0), `FAN_*_WEIGHT` (0.1 / 0.03) |
| Skill pace | `DB_UPGRADE_THRESHOLD` (4), the per-skill `dbCost` values |
| Chord risk curve | `CHORD_TEMPLATES` drive/sustain/rank table |
| Melody payout | `scoreTrackDB` (length ÷2 −1, endings +3/+2/+1), lock bands (+1/+2/+3) |
| Discord pressure | grace 1, floor −3 |
| Limelight race | `LIMELIGHT_TO_WIN` (3), `POSE_FP_STEP` (1), `POSE_FP_MAX` (4) |
| Boss pressure | `ROCK_GOD_*` (lead 3, 20 HP/Spirit, 45s) |
