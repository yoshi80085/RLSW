# RLSW — Shredding Ronin: Ability Design

**Design pass of 2026-08-22 (Alex).** This is the canonical statement of what the
Ronin's four abilities are *meant to be*. It is a design doc, not a report on the
build.

> ⚠️ **THIS DOC AND THE SHIPPED GAME DISAGREE, AND THE DOC IS THE INTENT.**
> Three of the four abilities described here differ from what
> `rlsw-simulator-v3_8_1.jsx` does today, and **Wa no Koe is a different ability
> entirely** — the shipped one is a passive harmony bonus, the designed one is a
> board-wide resonance state. §5 is the measured difference, line by line.
> **Nothing was built this session.** Read §5 before quoting §2 at the code.
>
> 🪦 **AND `CHARACTER_HANDOFF.md` WAS WRONG ABOUT CURSED SHAMISEN** — it described
> a three-stage escalation the code has never had. §6. It has been corrected in
> the same pass, per CLAUDE.md's rule that a drifted doc is worse than no doc.

---

## 0. Two rules that changed, and they are GAME-WIDE

Alex's call, 2026-08-22:

> *"From now on, all abilities cost at least 1 Db, and all abilities have some
> cooldown."*

### 0.1 Why the rule exists

Both halves point at the same failure: an ability with no per-use price and no
recharge is not a decision, it is a **default**. It gets taken every turn it is
legal, it stops competing with the rest of the turn, and the interesting question
("is this the moment?") never gets asked. Db is the game's scarcity; a power that
never touches it is outside the economy.

📌 This also protects the searcher. `BOT_STRATEGY_HANDOFF` §6.6 already records
that the Ronin picks Psycho Bushido on **23.3%** of turns where it is legal
against **10.2%** for a plain Swing — and that is an ability which *does* have a
cooldown. A free, uncooled ability doesn't get evaluated against alternatives so
much as it removes them.

### 0.2 ⚠️ THE RULE IS CURRENTLY VIOLATED ALMOST EVERYWHERE

Measured from `data/skillTree.js`, `data/gameConstants.js` and the resolvers
(2026-08-22). `dbCost` in the tree is the **one-time unlock** price and is not
what this rule is about — the rule is about the **per-use** cost.

| Spirit | Ability | Db per use | Cooldown |
|---|---|---|---|
| Ronin | 🌀 Psycho Bushido | **0** ❌ | 2 rounds ✅ |
| Ronin | 👤 Shadow Illusion | **0** ❌ (costs 1 Drive token) | **none** ❌ |
| Ronin | 🎸 Cursed Shamisen | 2 ✅ | **none** ❌ |
| Ronin | 🎵 Wa no Koe | **0** ❌ (passive) | **none** ❌ |
| Metalness | 🔊 Goes to 11 | **0** ❌ | **none** ❌ |
| Metalness | 🤘 Master of Moshpits | **0** ❌ | **none** ❌ |
| Metalness | 🐙 Tentacle | **0** ❌ | **none** ❌ |
| Metalness | 💀 Azrael | **0** ❌ | **none** ❌ |
| Intergalactic 0 | 🌀 Blaster of Ra | **0** ❌ | **none** ❌ |
| Intergalactic 0 | 🌌 Space is Displaced | 1 ✅ | **none** ❌ |
| Intergalactic 0 | 🕳️ Gravity Control | 1 ✅ | **none** ❌ |
| Intergalactic 0 | 💻 Code Injection | 1 ✅ | **none** ❌ |
| Intergalactic 0 | ☀️ Sunbeam | 2 ✅ | **none** ❌ |

**5 of 13 pay Db. 1 of 13 has a cooldown.**

🎯 **`psychoBushidoCd` IS THE ONLY COOLDOWN IN THE ENTIRE GAME.** Grep for
`[a-zA-Z]Cd\b` across `src/` and it is the only live hit; the others are the
`displaceCd` tombstone comments. So "all abilities have some cooldown" is not a
tuning pass — **the cooldown system is one field wide and has to be built.**

### 0.3 ⚠️ Three abilities were designed AROUND having no cooldown

These are not oversights. Each has a written reason, and the rule collides with
it head-on. Do not "fix" them without a decision:

- **🌌 Space is Displaced** — `CHARACTER_HANDOFF.md`: *"No Action Points, no
  cooldown, no amp rig."* Intergalactic 0 is the slowest Spirit on the board
  (speed 4) and the blink is his compensation for it. A cooldown re-strands the
  character the ability exists to un-strand. **If any ability gets an exemption,
  it is this one.**
- **💻 Code Injection** — a blind bet that is *already* gated on the attacker
  actually winning. It self-limits: nobody attacks, the Db is gone. A cooldown on
  top taxes a power that measured **12–36% save rates** and is deliberately weak.
- **🕳️ Gravity Control** — "one vortex at a time" is a de-facto cooldown. Adding a
  numeric one may double-charge for the same restriction.

📌 **And Psycho Bushido is the counter-example that proves the rule.** It spends
the *entire* remaining AP pool. That is a cost, and a heavy one — but it is paid
in tempo, not Db, so under the new rule it still needs a number.

### 0.4 ❓ Innate passives — NEEDS A DECISION

"All abilities" is unambiguous about the arsenals. It is genuinely ambiguous
about the always-on innates, and four of them cannot take a per-use Db price
without becoming a different kind of thing:

| Innate | Spirit | Why a Db cost breaks it |
|---|---|---|
| 📻 Boom Box | Intergalactic 0 | Already paid for — it costs a physical trip to a Charge Zone, and `burnChargesAfterBattle` kills it on any battle. |
| 🧪 Poison Slime | Metalness | Fires on *vacating* a hex. There is no moment to charge for. |
| 🎤 Crowd virtuosity | Ronin | A modifier on `perfScore`, not an action. |
| 🎺 Freestyle | Intergalactic 0 | Once per turn, automatic. Nothing to spend on. |

**Recommendation: the rule binds actives, innates stay free.** An innate is the
character; an active is the choice. But it is Alex's call and it is **not settled
here.**

---

## 1. Character thesis

Ronin is a **glass-cannon / threat-architecture** character. He owns the
**Melody Line / space** seam of the four-pillar model (`CHARACTER_HANDOFF.md`
"The big idea"), and the archetype quartet reads
**Ronin = Burst/virtuoso · Intergalactic 0 = Control/zoner · Metalness = Bruiser ·
Glamarchy = Star.**

The kit is about:

- **Distance and line of sight** — he is punished for being close and paid for reach.
- **Deception and positioning** — the opponent should not be sure what they are looking at.
- **A persistent threat** that exists on the board when he is not acting.
- **Turning the stage's music against itself.**
- **Meaningful risk** traded for powerful effect.

🎯 **The design success of this kit is that each ability poses a DIFFERENT
question.** That is worth protecting above any individual number:

| Ability | Role | Manipulates | The rival's question |
|---|---|---|---|
| 🌀 Psycho Bushido | Burst attack | Distance / LOS | *Can I stay out of his kill lane?* |
| 👤 Shadow Illusion | Deception | Position / Sustain | *Which Ronin is real?* |
| 🎸 Cursed Shamisen | Debuff / control | Sustain | *Do I run, or do I exorcise it?* |
| 🎵 Wa no Koe | Mastery / board | One resonant note | *Do I let him hear my music?* |

⚠️ **This is why the kit must not drift back toward note manipulation.** An
earlier version had Cursed Shamisen corrupting the target's notes *and* Wa no Koe
converting other Spirits' notes into Ronin's. Two abilities, one verb, and a pile
of bookkeeping. **Both were deliberately moved off notes.** If a future change
puts a second ability back on note manipulation, this paragraph is the objection.

---

## 2. The four abilities — FIRM DECISIONS

Everything in this section is decided. Numbers are in §4.

### 2.1 🌀 Psycho Bushido — the long-distance strike

**The inspiration is Zenitsu's lightning strike from an absurd distance.** Ronin's
signature.

**Decided:**

- The attack becomes **more powerful the FARTHER the target is.** This is the
  ability. A conventional ranged attack that is equally good at all ranges is not
  this ability.
- The gate is **line of sight**. A Spirit must either **move into** Ronin's
  current line of sight, or **be pushed into it**.
- Ronin is **not a chaser.** He is waiting for someone to enter the kill lane.
- Costs Db and has a cooldown (§0).

**Why it works:** it creates one legible, board-wide threat — *"do not enter
Ronin's line of sight"* — and because other Spirits can **push** a rival into that
lane, opponents can also manufacture Ronin's opportunities. The threat is a shared
object on the board, not a private ability.

✅ **The shipped code already agrees on the important half.** The bonus is
`distToTarget - 1` — the ground he covered — and the comment at line 8138 records
that it used to be `apLeft - distToTarget`, which paid *most* for a charge of zero
hexes. Alex caught it 2026-08-20 by reading the payout table. **Do not let that
sign flip back.** The inversion is also why the ability needs **no minimum-range
rule**: the move spends the whole remaining AP pool, so a charge from next door is
strictly worse than the 1 AP Swing it replaces. The cost polices itself.

### 2.2 👤 Shadow Illusion — the decoy

**Decided:**

- Ronin creates a **perfect-looking decoy**. It looks exactly like him, moves
  freely, and **collects notes**.
- To other players it **appears to be a legitimate competitor.**
- It has **no Health and no attack capability**, and **disappears immediately if
  attacked.**
- ⚠️ **While it is active it DRAINS RONIN'S SUSTAIN.** This is the load-bearing
  cost and it is what makes the ability a trade rather than a freebie: *"I can be
  in two places at once, but I am sacrificing my own defences to do it."*
- Costs Db and has a cooldown (§0).

**What it is actually for** — not just a visual trick:

- makes opponents waste AP positioning against it,
- makes opponents attack the wrong Ronin,
- collects notes for the real Ronin,
- creates uncertainty about where the real threat is,
- **potentially draws players into a Psycho Bushido sightline.**

That last one is the reason the two abilities belong in the same kit.

📌 **Keep the stacked spawn.** The shipped decoy is born on Ronin's own hex, and
the comment at line 8246 has the reason: a decoy that pops into an *empty adjacent
tile* identifies itself as the copy on the spot. Starting superimposed means there
is no "where it came from" to reason about.

**🔮 Shadow Exchange / Kage no Ken — NOT part of the kit.** A swap-places-with-
the-illusion ability was discussed. It is a *possible future addition* if
playtesting shows the illusion needs more depth. It is **not decided** and must
not be built as though it were.

### 2.3 🎸 Cursed Shamisen — the curse Ronin feeds

This one changed the most, and the changes are the point.

**Decided:**

- The Shamisen is a **living musical curse that Ronin feeds with his own notes.**
  It is **not** a passive damage-over-time hazard — it is something he actively
  builds.
- The haunting has a specific melodic sequence:

  > **♭3 → 2 → 1 → ♭6 → 5**

  Each round Ronin has a **required note** for the next link in the haunting, and
  he must feed that note into the Shamisen.
- **Completing the sequence strengthens the haunting.** Feed → complete →
  escalate → repeat.
- ⚠️ **IT ATTACKS THE TARGET'S SUSTAIN STACK.** It does **not** corrupt the
  target's individual notes. This was an explicit reversal (§1) — the Shamisen is
  a debuff against *survivability*, and keeping it off notes is what stops Ronin
  becoming a note-manipulation character.
- **Two counterplays, both real:**
  1. **Leave its range.** Get away from the haunting.
  2. **Exorcise it directly.** Go to the Shamisen and deal with it.
- Costs Db and has a cooldown (§0).

**The fantasy to protect:** the target is not simply taking damage. It should feel
like *"this thing is consuming my ability to withstand attacks — I have to deal
with it."* And because it grows, ignoring it gets worse.

**🌑 Minor key is FLAVOUR, not a gate.** Minor / haunting stays part of the
Shamisen's musical identity and its sound. It is **no longer the mechanical on/off
condition.**

> ⚠️ **THIS IS THE SINGLE BIGGEST BREAK WITH THE SHIPPED CODE, AND IT HAS A
> KNOCK-ON.** Today the melody haunts **only Spirits in a minor key**, and that
> gate is doing real work: it is the counterplay (*change key and it cannot touch
> you*), and it is thematically anchored because **the Ronin is the only Spirit
> who starts holding `theory_minor`** (`engine/systems/economy.js:286`). Remove
> the gate and you remove a counterplay that the two replacements above must now
> carry alone. Budget the exorcism rules accordingly — they are load-bearing now,
> not garnish.

### 2.4 🎵 和の声 — Wa no Koe — the mastery

Ronin's **12 Db** mastery ability, and the most conceptually elegant of the four.

**The central idea: the entire stage becomes part of Ronin's song.** Deliberately
simplified from there.

**Decided:**

- **It affects ONE note.** Not every note in his chord. Ronin **chooses one note
  from his current chord stack**, and that note becomes **Resonant across the
  entire board** for the duration.

  > Chord stack `C – E – G` → he picks `G` → **G is Ronin's resonant note
  > everywhere.**

- **The current chord is what he can choose from.** This ties the ability to the
  existing musical system instead of inventing a separate selection system, and it
  means **Ronin's musical choices matter before he activates it.**
- **Echoes, and they do exactly one thing.** When another Spirit interacts with
  Ronin's Resonant Note, Ronin generates/collects an **Echo**. An Echo is spent to
  **reset a Ronin ability's cooldown.** That is the whole Echo economy.
  ⚠️ **No separate inventory. No temporary-note collection. No second currency.**
  The danger was identified explicitly: Shamisen corrupting notes *plus* Wa no Koe
  absorbing other people's notes is too much bookkeeping. Echoes stay one line
  long, and note the tight coupling to §0 — **Echoes are only meaningful because
  cooldowns now exist on everything.**
- **The Harmony state, and the vulnerability IS the ability.** Wa no Koe puts
  Ronin into a temporary **Harmony** state in which he is **extremely
  vulnerable** — he has turned his attention away from defending himself and
  toward listening to the whole stage.
- 🎯 **No "Harmony protection".** A Dissonant Echo punishing anyone who attacks
  him during Harmony was considered and **left out**. If someone attacks Ronin in
  Harmony they should have a **genuine opportunity** to exploit it. The
  consequence of attacking him does not need to be another subsystem — the
  attacker's decision is already strong enough:

  > *Do I interrupt Ronin now, or let him keep harvesting the Resonant Note?*

**Firm even though the implementation isn't:** Wa no Koe is powerful **because**
Ronin becomes vulnerable while using it. Any implementation that keeps the power
and softens the vulnerability has missed the ability.

---

## 3. Explicitly NOT decided — the playtest bucket

⚠️ **Nothing below is a rule.** These are numbers and implementation choices to
settle once the board/combat flow is nailed down. Do not build from this section.

**Costs and cooldowns**

- Exact Db costs for all four. *(Only **Wa no Koe = 12 Db** is established, from
  the original design — and the shipped `dbCost:12` agrees.)*
- Exact cooldowns for all four.

**Psycho Bushido**

- Exact distance → damage/Drive scaling.

**Shadow Illusion**

- Exact Sustain drain rate.

**Cursed Shamisen**

- Exact feeding requirements and escalation values.
- Exact number of escalation stages.
- Exact Sustain loss at each stage.
- Exact radius.
- Exact exorcism rules. *(⚠️ Now load-bearing — see the warning in §2.3.)*

**Wa no Koe / Harmony**

- Exact duration.
- Exactly what constitutes an Echo-generating interaction.
- Exactly how many Echoes reset each ability.
- Whether taking damage interrupts Harmony.
- Whether Ronin can move or act during Harmony.
- Whether he can perform normal attacks, or rely on normal facing/guarding.

---

## 4. ⚠️ DRIFT — what ships today vs. what this doc says

Measured 2026-08-22 against `rlsw-simulator-v3_8_1.jsx`,
`engine/systems/melodyCommit.js` and `data/skillTree.js` — **the client, not the
tests** (CLAUDE.md: a passing test is not evidence a rule is real).

| | **Shipped today** | **This design** |
|---|---|---|
| **🌀 Psycho Bushido** | Iaijutsu **dash** in a straight line from facing into an auto-Swing. Bonus `= distToTarget − 1` as `tempDrive`. 6 Db unlock, **0 Db/use**, 2-round CD. Engine-modelled, `kind:'psychoBushido'`. | Farther = stronger ✅ **agrees in spirit.** But framed as a **waiting** threat on a sightline rather than a charge, and it must now **cost Db per use**. |
| **👤 Shadow Illusion** | 6 Db unlock, **0 Db/use**, costs **1 Drive token**. Lasts 3 turns. **No Sustain drain.** **No cooldown.** Picks up Lost Chord notes ✅. Pops if struck / if Ronin attacks / **if Ronin is attacked**. | Cost is **Sustain drain while active**, not a Drive token. Needs **Db + cooldown**. "Pops if Ronin attacks or is attacked" is **not in this design** — the sheet only says *disappears if attacked*. ❓ Keep or drop? |
| **🎸 Cursed Shamisen** | 8 Db unlock, **2 Db/use**, no CD. Fixed **2 rings**, lives **3 rounds**, **no stages**. Haunts **ONLY minor-key Spirits** — including Ronin. Wanders 1 hex/round toward nearest minor-key Spirit. Sustain soaks first, then Vibe. Calmed by walking onto its hex (+ a bonus note). | **Ronin feeds it ♭3 → 2 → 1 → ♭6 → 5**; completing the sequence escalates it. **Minor is flavour, not a gate.** Attacks the **Sustain stack**. Counterplay = leave range **or** exorcise. Needs a cooldown. |
| **🎵 Wa no Koe** | 🚨 **A DIFFERENT ABILITY.** 12 Db, **passive**: ≥half your melody sitting inside your Drive/Sustain stack pays **+1 Drive or Sustain for 3 rounds**. Rule lives in `engine/systems/melodyCommit.js` `checkWaNoKoe`. | **Pick one note from the current chord stack → it is Resonant board-wide. Echoes reset cooldowns. Ronin enters a vulnerable Harmony state.** Shares only the name and the 12 Db. |

🚨 **Wa no Koe is not a rework, it is a replacement.** Note what goes with it:

- `checkWaNoKoe` is a **pure function in the engine kernel** and has a test
  (`engine/melodyCommitCheck.mjs`) and a bot path (`engine/policies/bot.js`).
- The kernel **deliberately reproduces a shipped bug**: the pre-commit `tempDrive`
  is read and overwrites the Drive boost the same commit just earned
  (`BOT_STRATEGY_HANDOFF` §7 — a one-place fix). 📌 If the ability is replaced,
  **that bug and its one-place fix both become moot** — don't spend a session on
  the fix first.
- Ronin's chord-tone pardon is separate and is **not** part of Wa no Koe. It stays
  whatever happens here.

**Also stale, minor:** the comment at line 8242 says the decoy *"cannot interact
with board elements (no note pickups…)"* — but line 8336 calls `checkTokenPickup`
and both the skill `desc` and the unlock log advertise note pickup. The comment is
the wrong one; the behaviour is intended.

---

## 5. 🪦 Doc drift found while writing this

`CHARACTER_HANDOFF.md` described Cursed Shamisen as having **three stages** —
*1 Listening (2 rings, still, spares Ronin) → 2 Swelling (3 rings, still, spares
Ronin) → 3 Hunting (frozen at 3 rings, stalks 1 hex/turn, spares nobody)* — with
a whole paragraph justifying why the aura freezes when it starts chasing.

**None of that is in the code.** `SHAM_RINGS = 2` is a fixed constant, there is no
stage field, no growth, and no `spares Ronin` state — the minor-key gate is the
only thing deciding who it touches, and it has never spared him. The shipped
ability wanders from round 1.

That section has been rewritten. It is recorded here because it is the same class
of failure `test:arch` exists to prevent: **a doc that reads as current and is
not.** These design docs have no machine check, which is exactly why
`CHARACTER_HANDOFF.md`'s own advice — read them with suspicion — applies to this
file too.

---

## 6. What this doc does NOT settle

1. **Whether innate passives are covered by the Db rule** (§0.4). Recommendation:
   no. Needs Alex's call.
2. **Whether Space is Displaced is exempt from the cooldown rule** (§0.3). It is
   the strongest case for an exemption in the game.
3. **Which Wa no Koe survives.** This doc assumes the new one replaces the shipped
   passive. If both are wanted, the 12 Db slot only holds one.
4. **Whether Shadow Illusion still pops when Ronin attacks or is attacked.** In the
   code today; absent from this design.
5. **The HUD.** Alex is designing a reduced HUD — fewer elements, bigger buttons,
   only pertinent information — **separately, and will upload it.** Do not
   pre-empt it. 📌 It is relevant here: cooldowns on thirteen abilities plus an
   Echo counter is a lot of new state wanting screen space, and the HUD pass is
   where that gets solved, not here.

---

## 7. If this gets built — rough order

Not a commitment, just the dependency order that falls out of the above.

1. **The cooldown system first.** It is one field wide today (`psychoBushidoCd`)
   and §0 needs it to be general. The pattern already exists —
   `makeInitialNoteState` → `startNewTurnNotes` / `turnFlow.js:128` — it just has
   one member. Everything else in §0 and the Echoes in §2.4 depend on it.
2. **Per-use Db costs.** Cheapest change; the pattern is written down in
   `CHARACTER_HANDOFF.md` ("Per-use Db costs") and Cursed Shamisen is the
   template. Do the exemption decisions (§6.1, §6.2) before, not during.
3. **Cursed Shamisen rework.** Self-contained in the client, and the exorcism
   rules need designing before code.
4. **Shadow Illusion cost swap** (Drive token → Sustain drain). Small, but it
   changes what the ability *is*, so it wants playtesting alone.
5. **Wa no Koe replacement — last, and biggest.** It touches the engine kernel, a
   test suite and the bot policy, unlike the other three which are client-only.

⚠️ **And before any of it: the tree has two sessions of uncommitted work in it**
(`SEQUENCING.md` §5, `COMMIT_MSG_RIG_REWORK.txt`). Commit from a normal terminal
first — §5.G⁸ has the `git rm` the agent shell cannot do.
