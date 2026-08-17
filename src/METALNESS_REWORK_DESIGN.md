# METALNESS MONSTER REWORK — 🤘 the slime is the character

> **For AI editors + Alex.** A full kit redesign for `Metalness_Monster`, closing
> the "arsenal, no innate identity" gap that `CHARACTER_HANDOFF.md` lists as NEXT
> TASK and `BOT_STRATEGY_HANDOFF.md` §4.3 flags as blocking cross-Spirit tuning.
> Written 2026-08-15 out of a design conversation.
>
> ⚠️ ~~**NOTHING HERE IS IMPLEMENTED.**~~ **STALE AS OF 2026-08-16 — PARTLY
> SHIPPED.** §2's Slide, §4a's Tentacle and §4d's Goes to 11 are in
> (`systems/slime.js`, `policies/legalActions.js`, `systems/eleven.js`), as is
> §6's `beamActions` scorer. **§4b's Slam and §4c's Master of Moshpits are not,
> and §1a's Azrael is still wired in despite being CUT here.** This banner is a
> patch, not a reconciliation: the rest of the doc still reads as a proposal
> throughout, and `BOT_STRATEGY_HANDOFF.md` §4.3 still lists the pre-rework
> arsenal as shipped. **A full pass over both is outstanding.** Claims about
> *current* behaviour predating this note were cited from source at the time.
> **All names are placeholders.**

---

## 0. Stats, unchanged

`7 / 6 / 4 / 5` — Drive 7, Sustain 6, Speed 4, Vibe 5 (`data/spirits.js`).

Two facts about that line that the old kit ignored and this one is built on:

- **He is the toughest body in the game** — the only Spirit with both 5 Vibe and
  6 Sustain. Ronin is 5/5 (§4.1 calls it the softest real body); Zero is 4/7.
- **Nothing in his kit read his Sustain.** 6 Sustain, second-best stat,
  completely inert. `Goes to 11` (§4) is the fix.

---

## 1. What was dropped, and why

### 1a. 💀 Azrael (12 Db) — CUT
*"Each rival you knock down feeds Fame equal to your knockdown streak (1st→1,
2nd→2…). Resets when YOU go down."*

**It is a multiplier on a capped resource.** `FAME_PER_TURN_CAP` is 4 and §2 is
explicit that overflow is **DISCARDED**. A streak paying 1, then 2, then 3 hits
that ceiling almost immediately, so most of the ability evaporates on the way
out. FP is *already* earned on winning a battle (`awardThrashFame` /
`awardSonicFame`) and already amplified by `underdogBonus` — Azrael was charging
12 Db to re-sell something the game hands out for free and then clips.

It was also thematically inert: the Antichrist reference was doing nothing for a
*Monster*, and it borrowed metal iconography without earning it.

### 1b. 6️⃣ Number of the Beast (6 Db) — CUT
*"BERSERK — 1 Db to call, and only at 2 Vibe or less. +6 Drive with no cap,
immune to knockback, every attack costs 1 Vibe."*

Two reasons.

**It fought Azrael directly.** The Beast *"ends when you put a rival down."*
Azrael pays for a knockdown **streak**. The 6 Db opener self-terminated on the
exact event the 12 Db capstone existed to chain — the two most expensive slots in
his kit were mutually exclusive by rule.

**And the numerology was the point rather than the mechanic.** 666 / +6 Drive /
`BEAST_VIBE_GATE` 2 — the number was chosen first and the design bent to fit it,
which taints an earned result. Spinal Tap's 11 is a better fit for the same
genre-joke slot because the joke is *about a dial*, and this game is made of
dials.

> 📌 **Salvage note.** The Beast's one genuinely good idea — **immunity to
> knockback** — is the only answer to a Smash (2 hexes) or a Blaster this Spirit
> ever had. If nothing else in the new kit provides it, consider hanging it off
> `Goes to 11`.

---

## 2. INNATE — 🧪 Slime Trail + Slide

**Trail:** slime on every vacated hex; 1 Vibe to any rival who enters or is
pushed in; he is immune to his own; **lasts 2 turns** (up from a full round).
Lifetime counted in spirit-turns. Client state today (`poisonSlime{}`), decayed
by `decayPoisonSlime()` at the end of every Spirit's turn.

**Slide (new):** he can move **backwards along his own trail for free** — no AP,
roughly 2 hexes, for ~6 effective moves.

### Why the slide is the load-bearing addition

**It resolves his central contradiction.** The old innate rewarded *moving* — more
vacated hexes, more board tax — but he is joint-slowest at speed 4, and §1 says
movement and attacks come out of ONE AP pool. His innate competed directly with
his win path. Now moving *generates* movement.

**And free movement is genuinely rare.** §1's spine means every hex costs AP. The
only other instance in the roster is Zero's Space is Displaced — an 8 Db paid
blink. This is innate, and it is *directional*.

> ⚠️ **SCOPE IT TO RETREAT.** Backwards along the trail only. If it can close
> distance it stops being a disengage and becomes speed 6, which erases the cost
> his stat line was buying. As a retreat it is a different resource, not a
> bigger one — and it makes him **the only melee Spirit who can hit and leave.**
> That is the real answer to being kited: you do not need reach if you cannot be
> kited.

It also turns §4.3's complaint — *"slime makes his vacated hexes dangerous, so his
movement is an attack. No current bot scorer models 'where I came from'"* — from
a footnote into the mechanic.

---

## 3. THE TRAIL IS A CURRENCY — and this is the design spine

> ⚠️ **The single most important idea in this doc.** The trail is **innate**;
> every way of SPENDING it is **earned**. Three abilities compete for one pool
> the player builds themselves and can see lying on the board.

| Use | Costs | Earned? |
|---|---|---|
| **Slide** — free retreat | trail is traversed (spend TBD) | innate |
| **Tentacle** — reach | the trail reached *through* | upgrade |
| **Slam** — burst | the whole trail | upgrade |

**This answers "why don't the upgrades feel like upgrades."** An upgrade that
replaces Swing is a settings change. These do not add a modifier, they add a
**new cost basis**: Swing spends 1 AP and 2 Drive notes on hit; Tentacle spends
trail. Different currency ⇒ genuinely different decision.

> 📐 **THE RULE, worth stating once and keeping:**
> **An upgrade should add a verb, not a modifier.** Ronin's Psycho Bushido
> converts unspent AP into Drive — a verb. Zero's Gravity Control drags people —
> a verb. "Your Swing is +2" is a modifier, and modifiers are what make an unlock
> feel like a settings change.

It is also §3.2's unlock-vs-fuel tension in a currency better than Db, because
it is **visible on the board** rather than hidden on a sheet.

---

## 4. THE KIT

### 4a. 🐙 Tentacle *(name TBD)* — reach through the slime
A **Swing** launched from any hex on his trail, rather than from where he stands.

**Cost — the trail it reaches through is consumed.** Concretely: he stands on A,
his trail runs A ← B ← C ← D. A rival stands next to D. He reaches through to D
and swings; the slime at B, C and D is **gone from the board**.

That single rule does four jobs:

1. **Range is priced.** Next to B costs 1 slime; next to D costs 3.
2. **It competes with the slide and the Slam.** Every long reach shortens the
   escape route — you used the road to throw the punch.
3. **Rivals can COUNT it.** The threat range is public information sitting on the
   board, so it is a standing threat rather than a gotcha.
4. **The searcher's branching stays bounded** — see §6.

**Second cost — it does NOT re-face him.** `transitionCheck` pins that walking
re-faces you down the direction of travel, and `isRearHit` reads facing on
**defence** (a rear hit strips an extra Sustain note). The tentacle attacks from
the slime; *he* stays where he is, facing where he was. So reaching behind you
means the rival in front of you is now hitting your back. **No new rule at all —
just the deliberate absence of the re-face that walking gives you.**

**And the range is already paid for.** A long trail means turns spent moving, and
§1 says movement and attacks share one AP pool — every hex of reach was bought
with an attack he did not make.

### 4b. 💥 Slam *(name TBD)* — collapse the trail
Spend the **whole** trail for a burst scaled to its length.

**Make it his Smash.** Three reasons:

- **The Smash currently has no owner.** §3.4 (corrected 2026-08-14) documents why
  nobody wants it: variable cost, flat payout, and you cannot cash the hole you
  tear (one action token per turn, and your Drive stack is empty next turn). §7
  logs that it *punishes you for having a good turn*.
- **`smashOutcome(thrown)` already scales damage/knockback/scatter with what you
  threw**, and is already live for Blaster of Ra. `gameConstants` explains why the
  base Smash was flattened away from it ("a numbers puzzle — hoard stock, then
  dump — rather than a decision"); that reasoning holds for *stock*, which is
  passive income, but **not for trail**, which he builds by playing.
- It makes "you spend everything" thematically true for exactly one Spirit.

**Open:** does the Slam replace his Smash entirely (the Blaster-of-Ra pattern) or
sit beside it? Replacing is cleaner and matches `legalActions`' existing
smash/blaster branch.

### 4c. 🤘 Master of Moshpits — fans as bodies on the board
**Redesigned.** Was: *"pulls 3 fans out of the stands onto the board for a pit;
+2 Drive that STANDS."* The +2 Drive was a modifier; the fans were a cinematic.
Make the cinematic true and drop the modifier.

- **Fans become board furniture.** `legalActions` already takes `amps` in its view
  because *furniture blocks movement* — fan tokens ride that exact path. Cheap.
- **The cost is your own crowd.** Those casuals leave your `casuals` count while
  they are out there, so `crowdMultiplier` drops for the duration. You are
  literally spending your audience to build the pit.
- **Theft is folded in, not bolted on:** a rival who ends their turn in or
  adjacent to the pit **loses a casual to you.** Recruitment by intimidation.
  (`FAN_DEFECT_TO_VICTOR` already exists as a constant — fans changing hands has
  precedent.)
- ⚠️ **Steal casuals, not diehards.** `FAN_DIEHARD_WEIGHT` 0.10 vs
  `FAN_CASUAL_WEIGHT` 0.03, and `FAN_DIEHARD_CAP` is 6 — stealing diehards swings
  games far too hard.

**Why it matters beyond flavour: it gives him a PLACE.** Ronin wants a P score,
Zero wants a charge and his rig radius — Metalness has never wanted to be
anywhere in particular. The pit becomes his territory the way the rig radius is
Zero's, and it is somewhere he wants to *fight*, which suits speed 4 and Drive 7.

### 4d. 🔊 Goes to 11 — the dial, not the bonus
Replaces Number of the Beast in the genre-joke slot.

**Everything in this game has a cap, and 11 is one louder than the cap.** That is
the whole joke and it is also the mechanic.

- **It SETS Drive to exactly 11.** Not a bonus — a *setting*. That is why it
  legitimately sidesteps `ATK_BONUS_CAP` (5) without the special-case the Beast's
  uncapped +6 needed.
- ⚠️ **If he is already above 11, calling it turns him DOWN.** The amp only goes
  to 11. Stack Moshpits and a Drive boost and hit the dial and you get quieter.
  The joke and the balance lever are the same rule — it hard-caps his ceiling so
  his buff pile cannot compound.
- **Cost 1: the Sustain stack.** Finally reads his 6 Sustain. Armour into volume.
- **Cost 2: it blows an amp.** If the rig reads the way §3.1 describes, this is
  brutal and entirely free of new systems: outside your own rig radius the Sonic
  is **offline, not weak**, and you defend on a bare **d4** instead of d6
  (`SONIC_DEF_DIE_OUT_OF_RIG`). You get one enormous swing and then stand in
  §3.1's "worst square on the board."

**The amp comes back at the start of his next turn** — one full turn without a
rig. `chargeFloorTurns`, `chargeCeilTurns`, `blindTurns` and `smashExposed` all
tick on the holder's own turn, so `ampBlownTurns` is an obvious sibling and needs
no new machinery.

> ⚠️ **TICK IT AT THE END OF HIS TURN, NOT THE START.** `economy.js` carries a
> long warning on Sunbeam's `blindTurns` about exactly this: decrementing at turn
> START clears a 1-turn debuff before the victim ever draws a hex, so the cost
> silently becomes nothing. `decayPoisonSlime` fell into the same trap. **This
> would be the third time.** Blow the amp, play a full turn on a d4 with no
> Sonic, *then* get it back.

**Graduated alternative** if one turn plays too cheap: amps already have levels
1–3 (`amp_lv1/2/3`, the `amp_1` rung), so instead of offline it drops a level and
re-climbs the path that already exists.

---

## 5. Open questions

- **Naming.** Every name here is a placeholder.
- **Trail counterplay.** Once the trail is his movement network *and* his attack
  platform *and* his Slam fuel, it is a resource he accrues for free that rivals
  can only avoid. Something should contest it — walking through consumes it, an
  opponent action clears it, or it decays faster when stepped on.
- **Slide cost.** Is sliding truly free, or does it consume the slime it slides
  over (which would put all three uses on the same meter)? The latter is more
  elegant and more punishing.
- **Does the Slam replace the Smash or coexist?** (§4b.)
- **Knockback immunity** — salvage from the Beast, or let it go? (§1b.)
- **He still has nothing musical.** All four abilities are board/combat; not one
  touches the melody commit. See `THEORY_ROUTES_DESIGN.md` — Monster's tritone
  route is the intended fifth piece, and the one that would give the *spine* of
  the game a Metalness-shaped decision for the first time.
- **No hidden information — and this is a CHOICE, not a gap.** Ronin has the
  shadow, Zero has Code Injection, Riff Rat will have hiding. Metalness plays
  fully open. He is the one you see coming; that is a characterisation.

## 6. Notes for the bot work

- ~~**⚠️ The Tentacle is what makes `beamActions`' scorer urgent.**~~ ✅ **CLOSED
  2026-08-16** — `policies/actionScore.js`, `npm run test:score`. It was a real
  blocker and it played out exactly as written: cone-**from-each-trail-hex**
  multiplies his Swing branches by trail length, `beamActions` caps at 5 per
  kind, and with `score` still `null` it kept an arbitrary first five. The
  scorer ranks WHO he hits strictly above HOW MUCH ROAD IT COSTS
  (`rank * TENTACLE_RANK_STRIDE - reach`), so reach separates only two ways of
  reaching the *same* rival — and the cheaper reach wins, because the road that
  survives is §3's meter: the Slam's fuel and the next Slide's floor.
  ⚠️ **Ranking the origins did NOT need per-origin target ranking**, which is the
  one thing that looked obvious and was wrong: the rear wedge resolves off the
  attacker's own hex in `combat.js`, and the arm never moves him (§4a — "he
  stays where he is, facing where he was"), so re-ranking per origin would have
  invented a flanking bonus the resolver does not pay.
- **The trail is a new state class the searcher must model** — a set of hexes with
  ages, owned by a Spirit, consumed by three different actions. Nothing in
  `evaluate.js` has a shape like it.
- **New eval terms this kit implies:** trail length (a resource), pit occupancy (a
  place), and — for the first time — a term that is *negative* while an amp is
  blown.
- **§5's weight table needs revisiting for him regardless.** `survival` 0.7 is the
  lowest in the roster and `adjWounded` 1.5 was the highest — a table written for
  the bruiser-with-Azrael he no longer is.
  ⚠️ **`adjWounded` was CUT on 2026-08-17** (`BOT_STRATEGY_HANDOFF.md` §5): it paid
  him for standing beside a bleeding rival, so it paid him for NOT finishing them,
  and at 1.5 he was the roster's most reluctant closer. His share of it lives in
  the new `pressure` term at **1.8**, still the roster's highest. `survival` 0.7
  is untouched and still wants the revisit this bullet asks for.
