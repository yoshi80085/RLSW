# RLSW — Character Build Handoff

Pick-up notes for continuing the Spirit-identity work. Read this + `DESIGN_AUDIT_v2.md`
(design thesis) + `ARCHITECTURE.md` (where things live) and you're caught up.

> ⚠️ **2026-08-22 — TWO GAME-WIDE RULES LANDED, AND THE RONIN IS NO LONGER "COMPLETE".**
> Alex's call: **every ability costs at least 1 Db per use, and every ability has a
> cooldown.** **`RONIN_ABILITY_DESIGN.md` is the canonical statement of all of it**,
> including the ledger of who still owes what and the exemptions that need Alex's call.
>
> ✅ **THE FOUNDATION IS BUILT.** `engine/systems/cooldowns.js` is the general cooldown
> system — one map (`ns.abilityCd`), one tick, one gate — replacing `psychoBushidoCd`,
> which was the *only* cooldown the game had. Ronin's three actives now pay Db per use
> and take a cooldown, and Shadow Illusion's Drive-token cost became a Sustain drain.
> The mechanism is what mattered: giving any remaining ability a cooldown is now a data edit.
>
> ✅ **AND THE RULE'S OPEN CALLS ARE SETTLED (2026-08-22).** **No exemptions — only
> different rates** (Alex). Space is Displaced, the strongest exemption case in the
> game, took **1 round** rather than a pass; Gravity, Code Injection and Sunbeam took
> 2 each. **Innate passives are out of scope** — an innate is the character, an active
> is a choice. **7 of 13 abilities pay Db, 7 of 13 are cooled.**
>
> ⁉️ **ONE FORK OPEN: is 🌀 Blaster of Ra an ability?** It *replaces* the Smash, so
> pricing it leaves Intergalactic 0 with no Smash at all for a stretch. Deliberately
> absent from both tables. May mean a third category — *permanent upgrade to a basic
> action* — which 🐙 Tentacle would also join. `RONIN_ABILITY_DESIGN.md` §0.5.
>
> ⏳ **STILL DESIGN ONLY:** Cursed Shamisen's rework and the Wa no Koe replacement.
>
> ⏸️ **ON HOLD (Alex, 2026-08-22):** the **bot strategy** work — designing a bot around a
> game still in flux is a fool's errand — **Metalness Monster**, which is getting a
> redesign, and the **theory-off-the-ladder** change. Don't spend a session on any of the
> three. Amps are already off the ladder; theory is not, and its capstone still sells the
> 6th stack slot, so that slot needs a new home whenever theory does move.

---

## The big idea (how we're building characters)

Each Spirit should **own one of the game's four pillars and bend one rule of it**, so choosing
a Spirit changes *what you're trying to do*, not just your stats. The four pillars:

- **Melody Line** (`melodyLine` — notes → movement) · **Chord Stack** (`chordStack` — notes → combat Drive/Sustain)
- **The board / space** (amps, positioning, fire) · **The crowd / Fame**

Reminder: combat Drive/Sustain now come from the **Chord Stack** (`music/chords.js` `evaluateChord`),
NOT the static `data/spirits.js` sheet (that's only the empty-chord fallback). So a character's
identity must live in the **systems**, never the stat block.

Archetype quartet: **Ronin = Burst/virtuoso · Intergalactic 0 = Control/zoner · Metalness = Bruiser · Glamarchy = Star.**

---

## Status

| Spirit | Stats (Drive/Sus/Spd/Vibe) | Status |
|---|---|---|
| **Shredding Ronin** (`cosmic_ronin`) | 8/5/5/5, Shred | 🔁 **Built, then re-designed 2026-08-22** — see `RONIN_ABILITY_DESIGN.md` |
| **Intergalactic 0** (`intergalactic_0`) | 6/7/**4**/4, Groove | ✅ Built · ✅ Db + cooldowns done 2026-08-22 · ⁉️ Blaster of Ra open |
| **Metalness Monster** (`Metalness_Monster`) | 7/6/4/5, Shred | ⏸️ **ON HOLD — redesign pending.** Has arsenal, no innate identity; all 4 skills owe Db **and** cooldown, deliberately unpaid until the redesign lands |
| **Glamarchy** (`Glamarchy`) | 5/8/5/4, Flair | ❌ **Not started** (no innate, no arsenal) |

⚠️ **"Complete" used to mean "the code runs".** It was doing double duty as "the design
is settled", and the Ronin row is why that broke: every one of his four abilities shipped,
and three of them no longer match what they are supposed to be. Read the status column as
*build* state and the design docs as *intent* — they are not the same axis.

### Ronin — the fragile ranged virtuoso (REWORKED)

> 🎯 **THIS SECTION DESCRIBES WHAT THE CODE DOES. `RONIN_ABILITY_DESIGN.md` DESCRIBES
> WHAT IT IS SUPPOSED TO DO, AND THEY DIVERGE.** Read that doc's §4 before treating any
> line below as a rule: Wa no Koe is being **replaced** rather than tuned, Cursed
> Shamisen's minor-key gate is being **removed**, and Shadow Illusion's cost is moving
> from a Drive token to a **Sustain drain**. Only Psycho Bushido survives roughly intact.

- **Innate:** crowd virtuosity (Performance Score ≥5 wins ~2× fans, <5 cools/sheds fans);
  Smash relationship (his own Smash hits soft; a Smash *on* him double-scatters); note-greed
  (~50% second note off a Lost Chord); 10-slot stock.
- **Arsenal (reworked):**
  - **Psycho Bushido** (6 Db unlock, **1 Db/use**, 2-round CD) — Iaijutsu dash in a straight line from facing, into an auto-Swing.
    Leftover AP (`apLeft - distToTarget`) rides that Swing as `tempDrive`. ⚠️ **`tempDrive`, not `driveStack`** —
    it is a battle-scoped attack bonus under `ATK_BONUS_CAP`, and `clearBattleBuffs` wipes it when the
    battle ends. The doc used to say "on top of your Drive stack", which described an ability the code has
    never had; Alex's call 2026-08-20 was that the CODE is right and the wording was wrong.
    📌The strike is dispatched SYNCHRONOUSLY — see `resolvePsychoBushido`'s comment for why the 100ms
    `setTimeout` that used to sit there silently discarded the entire bonus.
    ⚠️ **THE BONUS IS `dist - 1`, THE GROUND HE COVERED.** It used to be `apLeft - dist`, which paid
    MOST for a charge of zero hexes and nothing for a full-length one — the ability rewarded standing
    still and called it lightning. Because the move spends the whole remaining pool the flipped sign
    self-polices: a charge from next door is strictly worse than the 1 AP Swing it replaces, so there
    is deliberately NO minimum-range rule.
    ✅ **ENGINE-MODELLED since 2026-08-20** — `kind:'psychoBushido'`, joined to the `swing` group in
    `transition.js`. The searcher draws it on 23.3% of the turns it is legal, against 10.2% for a
    plain Swing. 🗡️ Shadow Illusion and Cursed Shamisen are still client-only — `SEQUENCING.md`
    §5.E⁶ item 2 has the estimates.
  - **Shadow Illusion** (6 Db unlock, **2 Db/use**, **3-round CD**, **−1 Sustain per turn it
    stands**) — The Ronin splits into a **body double**: a second,
    pixel-identical Ronin standee, born **stacked on his own hex** (single-click, no hex to target). The
    stacked spawn is the point — a decoy that popped into an empty adjacent tile would identify itself as
    the copy on the spot. Starting superimposed means there's no "where it came from" to reason about;
    they walk apart and by then the two are indistinguishable.
    Rivals cannot tell the two apart — same sprite, same base ring, same
    hex tint, same facing arrow, same acting-turn glow, and it blocks movement like a real body. It also
    **walks the board on its own set of legs**: its movement pool refreshes each of Ronin's turns to match
    whatever budget the real body was granted, so it has the Ronin's *range* without costing him a single
    Action Point. (Sharing his AP was tried and rejected — it made summoning the double a self-inflicted
    tempo tax rather than a threat.) Only the Ronin's own client sees a faint 👤 pip on the
    fake. Lasts **3 of Ronin's turns**. Pops if it is struck, if Ronin attacks, or if Ronin is attacked.
    A rival who swings at the double burns their AP **and** their Action Token for zero damage.
    ⚠️ **THE COST CHANGED 2026-08-22: 1 Drive token at summon → Db + a recurring Sustain
    drain**, charged in `turnFlow.js`'s `tickShadowIllusion`. The double **collapses** when
    he has no Sustain to feed it, and summoning is refused on an empty guard so the Db can't
    buy a body that never stands. A token is a price you pay once and forget; a drain is a
    clock you can hear running — and it puts the Ronin at his most fragile exactly while
    rivals cannot tell which body to hit. 📌 Starvation does **not** bleed Vibe: Sustain is
    what is spent, so Sustain is what runs out. The report separates `shadowExpiring` (out
    of time) from `shadowStarved` (drank him dry) because they look identical on the board
    and must not read identically in the log.
  - **Cursed Shamisen** (8 Db unlock, 2 Db/use, **no cooldown**) — Set down on Ronin's hex, where it
    plays a **haunting melody every round** (real audio: an insen-scale phrase that drops an octave and
    speeds up once it has prey). Aura is a **fixed 2 rings** (`SHAM_RINGS`), and it lives **3 rounds**
    (`SHAM_ROUNDS`), ticked once per round from `endTurn`'s `roundCompleted` block.
    ⚠️ **IT ONLY HAUNTS SPIRITS IN A MINOR KEY** (`inMinorKey`) — Ronin included, so his own key decides
    whether it is a weapon or a haunting. Anyone in minor inside the rings loses 1 **Sustain**
    (`tempSustain`), and only bleeds **Vibe** once Sustain is gone. Every Spirit the melody reaches is
    marked with a pulsing 🎶 aura until it next plays, so the damage is never a mystery.
    Each round it **wanders one hex toward the nearest minor-key Spirit** (ties broken toward the
    lowest Vibe), walking *around* bodies; with the whole board in major it has no prey, no destination,
    and stands still. Calmed by walking onto its hex — whatever key you're in — which also hands the
    walker a bonus note. The safe approach is to be in **major** when you go and touch it.
    🪦 **THIS ENTRY USED TO DESCRIBE THREE STAGES** — *Listening → Swelling → Hunting*, 2 rings growing
    to 3, a frozen aura, and "spares Ronin" — **and none of it has ever been in the code.** There is no
    stage field, `SHAM_RINGS` is a constant, and the thing wanders from round 1. Corrected 2026-08-22.
    Board art: `SHAMISEN_ART` at the top of the simulator (currently a vector placeholder; drop
    `src/standees/Cursed_Shamisen.png` in and point the constant at it to swap).
  - **Wa no Koe** (12 Db, **no per-use cost, no cooldown**) — Passive: when **half or more** of the
    committed melody sits inside the Drive+Sustain stacks, it pays **+1 Drive or Sustain for 3 rounds**
    (whichever stack is longer). ⚠️ The rule is a pure function in the **kernel** —
    `checkWaNoKoe` in `engine/systems/melodyCommit.js` — not in this file; the monolith keeps only
    `tickWaNoKoe` (expiry is a turn-start rule, not a commit rule). The kernel deliberately reproduces
    the shipped B10 bug where pre-commit `tempDrive` overwrites the boost the same commit just earned
    (one-place fix, `BOT_STRATEGY_HANDOFF` §7).
    🚨 **THIS ABILITY IS BEING REPLACED, NOT TUNED** — the designed Wa no Koe makes **one chosen note
    Resonant board-wide** and puts Ronin in a vulnerable **Harmony** state. It shares only the name and
    the 12 Db. See `RONIN_ABILITY_DESIGN.md` §2.4. 📌 Don't spend a session fixing the B10 bug first;
    the replacement makes it moot.

### Intergalactic 0 — the slow forgiving cosmic controller (done · UNLOCKED 2026-08-08)
- **Innate:** speed 4; knockback −1 ("Rolls Hard"); **Freestyle** (first out-of-scale note/turn
  lands perfect, no penalty +Flair; tone cluster reads **8/2** for him); +1 Sustain on every voicing;
  **📻 Boom Box** (below).
- **📻 Boom Box (innate, free).** Everyone else's Sonic rig radiates from the Main Amp at their
  corner. While Intergalactic 0 holds a **⚡ Charge Zone charge**, his `distFromHome` reads **0**
  wherever he stands, so he is never stranded. That one flag is worth four things: full dice pool
  instead of dropping to the lone Main Amp die, Power d6→d8 upgrades staying live, the Riff-Off gate
  opening, and defending on a d6 instead of the stranded d4 (plus keeping the right to retaliate).
  Measured: stranded 2d6 → portable 2d8+2d6.
  **The Charge Zones ARE the batteries** — no new resource, no Db toll, and the balance falls out of
  a system that already exists: he must physically reach one of only `CHARGE_ZONE_COUNT` zones while
  being the slowest Spirit on the board (Space is Displaced is the obvious answer, which makes the
  kit cohere), it lasts `CHARGE_ZONE_BOOST_TURNS`, and `burnChargesAfterBattle` kills it the moment
  any battle resolves, win or lose. So it powers his **roaming** and dies the instant he **fights**.
  ⚠️ Applied in **two** places — `distFromHome` (render snapshot) *and* `rigForSpirit` (every combat
  path, including the defender's rig). Patch one and not the other and it works on attack but
  vanishes on defence. If charges ever survive battles, re-balance this first.
- **Arsenal:**
  - **Blaster of Ra** (10 Db) — replaces the Smash. Ranged, piercing bass-drop.
  - **Space is Displaced** (8 Db unlock, **1 Db/use**) — blink to any open hex **2 or 3 rings**
    away. No Action Points, no cooldown, no amp rig; movement is untouched, so he can still walk
    after landing. Ring 1 is excluded on purpose — an adjacent hex is a free step, and he moves
    *through* the space between, not across it.
  - **Gravity Control** (6 Db unlock, **1 Db/use**) — tear open a **Black Hole Vortex** on any hex
    within **2 rings** (occupied hexes allowed — dropping it on someone's head is the point). Every
    rival within **2 rings** is dragged **1 hex** inward; anyone who ends up standing **in** it has
    **2 notes** cut from next turn's stock refill (`refillDrain`), with the notes visibly torn off
    their standee via `showSpentNotes`. The vortex **hangs for one full round**, grabbing anyone who
    wanders into range, then collapses. **It never touches Intergalactic 0.** One vortex at a time.
    Verified exhaustively over all 111 hexes: every ring-1 rival lands in the hole, every ring-2
    rival is pulled strictly closer and can never reach it in one step — so the drain is exactly
    "was adjacent when it opened".
  - **Code Injection** (6 Db unlock, **1 Db to commit**) — a blind bet. Commit on your turn and say
    nothing; for one full round the **first rival whose attack would beat you** has their dice thrown
    out and re-rolled, and lives with the second result. Nobody attacks, or nobody lands? The Db is
    gone. Gated on the attacker actually *winning*, so a whiff doesn't burn the patch (and a re-roll
    could only ever turn a miss into a hit).
    ⚠️ **It is HIDDEN INFORMATION and that is the ability.** `codeInjectTurns` syncs like any sheet
    field, but syncing ≠ displaying: the only surface it ever gets is the button in the acting
    Spirit's own HUD. No aura, no standee marker, no shared banner. The commit's log line is written
    by `addLog` on his client only — remote clients apply engine actions *without* orchestration, so
    it doesn't travel. Move that announcement into a reducer or a synced banner and the bluff dies.
    📊 **Measured save rates** (20k trials each): Thrash single-die **36%**, Sonic 1 amp **22%**,
    2 amps **15%**, 3 amps **16%**, maxed 3d8 **12%**. Keep-highest is biased high, so a re-drawn
    pool usually lands high again — the bigger the attacker's rig, the less a forced re-roll can do.
    If it wants to be scarier, the lever is re-rolling *and taking the lower* result, not the cost.
  - **Sunbeam** (14 Db unlock, **2 Db/use**) — on any connecting attack (Swing *or* Sonic), the
    rival's screen whites out completely for **1 turn**; 50% chance it lingers for a 2nd, capped
    at 2. Fires automatically whenever he can afford it (the Slime pattern). Purely a *view*
    effect — the blinded player keeps every move and button, they just can't see to aim.
- ⚠️ **Both actives were REWORKED (2026-08-08) and the old versions are gone.** Sunbeam used to be
  the Amp-3 capstone (Sonic beam +2 hexes + scorched fire trail); Displace used to warp you beside
  your amp rig for 3 AP on a 2-turn cooldown. `displaceCd` is dead, `getSonicBeam` no longer widens
  for him, and the Sonic resolution lays no flaming hexes. The only survivor of the old Sunbeam is
  the cosmetic golden over-lit beam on the battle overlay (`battleState.sunbeam`). If you find a
  reference to beam reach 5 or a `displaceCd` tick, it's a leftover — delete it, don't revive it.
- **Tuning constants** live together above `SKILL_TREE` in the simulator: `SUNBEAM_DB_COST`,
  `SUNBEAM_BLIND_TURNS`, `SUNBEAM_LINGER_CHANCE`, `SUNBEAM_MAX_BLIND_TURNS`, `DISPLACE_DB_COST`,
  `DISPLACE_MIN_RINGS`, `DISPLACE_MAX_RINGS`, `GRAVITY_DB_COST`, `GRAVITY_PLACE_RINGS`,
  `GRAVITY_PULL_RINGS`, `GRAVITY_PULL_HEXES`, `GRAVITY_NOTE_DRAIN`, `CODE_INJECT_DB_COST`.

**A battle is decided in ONE action.** `ATTACK_ROLLED` resolves both rolls, the winner, the margin
*and* the damage up front; the battle overlay only ANIMATES a result that already exists in engine
state. So anything that "changes a die" must re-resolve the whole verdict in a reducer, off the
seeded rng — `ATTACK_REROLLED` / `applyAttackRerolled` is the template. Re-spinning a number in
React would desync online (clients compare rng cursors frame-by-frame and freeze on a mismatch) and
would leave `damage` describing a roll that no longer exists. `ATTACK_ROLLED` now preserves
`dicePool` / `atkFloor` / `atkDie` on `state.battle` precisely so a re-roll can reuse the dice shape.

**Board hazards that live one FULL ROUND.** Poison Slime, and now the Gravity Vortex, both count
their lifetime in **spirit-turns seeded with the living-Spirit count**, because the decay hook runs
at the end of *every* spirit's turn — the caster's included, moments after they placed it. Seeding
with a flat `1` deletes the hazard before a single rival can move. It also self-scales as Spirits
are knocked out. There are unit tests for this cadence; keep them passing if you retune.

**Pulls are not knockbacks.** `battleKnockback` bakes in "push away from `fromId`", Rolls Hard, and
a "KNOCKED BACK" log line. `gravityPull` is a deliberate sibling, not a caller: same slide loop,
same edge/occupancy/abort guards, same per-landing hazard checks, but the angle is measured from
the target *toward* the hole. Routing a pull through `battleKnockback` with a mirrored phantom
origin was tried and is worse. If you fix a bug in one slide loop, check the other.

**Re-entrancy on hazard checks.** `checkGravityVortex` fires from the same move/push sites as
`checkPoisonSlime` — but unlike slime, its effect *relocates* the victim, which re-fires the
proximity check. The `pulled: []` list on the vortex is what stops that becoming a movement lock
(and a repeating note drain). Any future hazard that moves the thing it just checked needs the
same guard.
- He's the Sun Ra homage ("Space is the place"). Note: we kept the homage *subtle* on purpose —
  "Ra" + "Space is Displaced" are fine; we deliberately did NOT use the verbatim album/film title.

**Per-client view effects (new pattern, set by Sunbeam).** The blind is the first effect that
changes what ONE player sees rather than what everyone sees. Two rules came out of it:
- Store the status on the victim's **note sheet** (`blindTurns`). `setNoteStates` diffs and
  dispatches `NOTE_SHEET_PATCHED` per spirit, so it syncs online for free — no bespoke netcode.
- Decide "is it me?" from **`netRef.current.mySpiritId`** online, and from **`acting.id`** offline
  (hotseat is one shared screen, so a blind can only mean anything on the victim's own turn).
  Spectators and resyncing clients are never blinded. See `blindedSpiritId` / `isBlinded`.

**Per-use Db costs.** `dbCost` in `SKILL_TREE` is the one-time UNLOCK price. A per-use cost is a
separate `ns.dbPoints` check + deduction inside the resolver (Cursed Shamisen was the first;
Space is Displaced and Sunbeam now follow it). Both numbers belong in named constants, and the
skill `desc` should interpolate them so the tree text can never drift from the behaviour.

**Randomness in on-hit riders.** Sunbeam's 50% linger goes through
`dispatch(randomBatchDrawn(1))` + `engineRef.current.lastRandomBatch[0]`, **never** `Math.random()`.
Online clients compare rng cursors frame-by-frame and freeze on a mismatch, so an unseeded roll in
a game rule is a desync bug, not a style nit. `closeBattleOverlay` (where both Slime and Sunbeam
resolve) runs on the **attacker's client only** — remote viewers dismiss the overlay without
calling it — so exactly one dispatch happens and every client advances the cursor identically.

---

## NEXT TASK: design + build a third Spirit

> ⚠️ **THIS IS NO LONGER THE ONLY OPEN LANE.** As of 2026-08-22 there are two more, and
> both are *game-wide* rather than per-Spirit: the **Db + cooldown rule** (which needs a
> general cooldown system before anything else in it can land) and the **Ronin re-design**
> (`RONIN_ABILITY_DESIGN.md`). Alex is also reworking the **HUD** independently and will
> upload it — worth knowing before anyone adds screen furniture, because thirteen cooldown
> timers plus an Echo counter is exactly the clutter that pass is meant to solve.
> Sequencing between the three is Alex's call and is **not** settled here.

Two candidates. **Glamarchy is the cleaner open lane** (owns the crowd pillar, which no one else
touches). Recommended order: design Glamarchy first, then give Metalness its innate identity.

### Glamarchy — "the Star" (owns the crowd / Fame)
Flair, highest Sustain (8), lowest Drive, glam spectacle. Fantasy: **wins the popularity contest,
not the fight.** Lives at the *consonant* pole of the consonance→dissonance spine.
- Direction we sketched: amplify her fan multiplier / Limelight; **convert defense into Fame**
  (every blow absorbed on a lush Maj7/min7 wall pays the crowd); maybe a taunt/lure or reflect.
  She barely needs to attack. Entirely different win-path.
- Needs: an **innate package** + a **3-skill signature arsenal** (she has none yet).
- Open: design session first (same cadence as Ronin/Intergalactic — lock the kit, then build
  incrementally with a verify after each piece).

### Metalness Monster — "the Juggernaut" (owns Chord Stack / dissonance)
Already has an arsenal (Master of Moshpits, Riff Slayer, Paranoia, Azrael) but **no defining
innate identity**. Fantasy: the unkillable attrition wall that gets scarier as it snowballs.
- Direction we sketched: **chaos/dissonance that punishes others feeds him** — the Smash is his
  home (make it cheaper / non-Exposing for him?); resist knockback; Azrael (knockdown streak →
  Fame) is the snowball. He's the anti-turtle bruiser.
- **Poison Slime (innate passive, live):** he leaves slime on every hex he vacates — 1 Vibe to any
  rival who walks onto it or is pushed into it; he's immune to his own goo. The trail lasts a
  **full round**: `turnsLeft` is counted in *spirit-turns* and seeded with the number of living
  Spirits, so it expires exactly as the turn order comes back to him, and self-scales as Spirits
  are knocked out. (It used to be seeded with a flat `1`, but `decayPoisonSlime()` fires at the end
  of every spirit-turn *including his own* — so the whole trail evaporated the moment he ended his
  turn and no rival ever stepped in it. If you touch the lifetime, keep that decay cadence in mind.)
  Tiles fade in opacity as they age so the board shows how long a detour is still needed.
- Needs: the rest of the **innate identity** (arsenal already exists; may want a pass for cohesion).

---

## Established patterns (reuse these — they're proven)

**Innate vs arsenal split.** Identity passives = innate (always on, keyed on `spirit.id`).
Active/unlockable powers = a **signature arsenal route** in `SKILL_TREE` with `spiritOnly:'<id>'`.

**Per-spirit chord tweaks → `spiritChord(spiritId, notes)`** (defined in `Game`, ~just before
`getSwingCone`). It wraps `evaluateChord` and applies a spirit's innate harmony bonuses (e.g.
Intergalactic's +1 Sustain / cluster +1 Drive). **All combat + HUD + bot chord reads go through
it** — use it (not raw `evaluateChord`) for any new chord-based passive (e.g. Glamarchy's wall).

**Adding a signature skill** (3 edits to define + behavior):
1. `SKILL_TREE.routes` — add to the spirit's route (`hcCost`, `gated:true`+`prereq:'amp_3'` for a capstone).
2. `SIGNATURE_TESTS` — add an entry so it's unlockable from the dev/Testing Grounds panel.
3. `applySkillEffects(spiritId, skillId)` — add the `if (skillId === '…') addLog(…)` line.
4. Behavior: a `resolveX()` fn; for an **active** ability also add an `action` string, an
   `onHexClick` branch, a button (near the Smash/Sonic buttons), a `hexFill`/`hexStroke`
   highlight, and a Cancel. (See `resolveBlasterOfRa` / `resolveDisplace` as templates.)

**🆕 EVERY ABILITY COSTS ≥1 Db PER USE AND HAS A COOLDOWN** (Alex, 2026-08-22, game-wide).
An ability with no per-use price and no recharge isn't a decision, it's a default — it gets
taken every turn it's legal and stops competing with the rest of the turn. ⚠️ **The game does
not currently obey this**: 5 of 13 abilities pay Db, **1 of 13 has a cooldown**, and three
(Space is Displaced, Code Injection, Gravity Control) were designed *around* having none, with
written reasons. The violation table and the exemption calls Alex still owes are in
`RONIN_ABILITY_DESIGN.md` §0. **Innate passives are NOT settled** — recommendation there is that
the rule binds actives only, since Boom Box and Poison Slime have no moment to charge for.

**Cooldowns and per-use Db → `engine/systems/cooldowns.js`.** Add a row to `ABILITY_CD`
and/or `ABILITY_DB_COST` (numbers live in `gameConstants.js`), then call `firePatch(ns, skillId)`
in the resolver and gate the button/`legalActions` on `canFire(ns, skillId)`. That is the whole
job — `ns.abilityCd` is seeded in `economy.js` and ticked once per owner-turn in `turnFlow.js`,
so nothing per-ability is needed in either.

⚠️ **DO NOT ADD A NAMED `<x>Cd` FIELD.** That was the old pattern and it is exactly why twelve
abilities had no cooldown: a named field needs an `economy` seed, a `turnFlow` tick, a
`legalActions` gate and a HUD read before it can exist at all, and at four edits a time nobody
does it. `psychoBushidoCd` was the only one anybody ever finished, and it is now gone —
anything still reading it reads `undefined`, i.e. no cooldown. `displaceCd` is likewise dead.

⚠️ **AND THE CLIENT AND THE SEARCHER MUST CHARGE THROUGH THE SAME `firePatch`.** The client's
resolver and `transition.js` both call it; if only one does, the kernel plays a cheaper game than
the player and every bench number about that ability is fiction.

📌 **Rounds, not spirit-turns.** The tick fires at the start of the OWNER's turn, so a `2` costs
two of his own turns whatever the player count. Board hazards (Poison Slime, the Gravity Vortex)
use the opposite convention for a good reason — their decay hook runs at the end of *every*
spirit's turn. Don't unify them.

**Turn-scoped debuffs on the victim:** add the field to `makeInitialNoteState`, then tick it in
`applyDebuffsTicked` (`engine/systems/economy.js`) — and remember to add it to that function's
`hadDebuff` early-return check, or it will silently never decrement. It fires at the **end** of the
afflicted spirit's own turn, which is what makes a `1` cost a full turn (see `blindTurns`).

**Crowd / Fame mechanics:** the seam is `confirmNoteTrack`'s **Performance Score** (`perfScore`,
0–10) → `perfExciteGain` → casual/diehard fans, and `effectiveDiscord` (discord pardon). Ronin's
virtuosity and Intergalactic's Freestyle both ride this. Glamarchy's crowd kit will too.

**Knockback:** `battleKnockback(fromId, targetId, spaces)` — per-spirit resistance goes at the top
(see the `intergalactic_0` −1).

---

## ⚠️ Verification quirk (important)

The shell (`mcp__workspace__bash`) serves a **truncated mid-write snapshot** of files edited via
the canonical file tools — the **tail is cut off**, so a whole-file `esbuild` bundle of
`rlsw-simulator-v3_8_1.jsx` / overlay / etc. fails with a spurious **EOF** even when the file is
fine (mid-file edits and greps DO show up). So:
- Read/search with the **file tools + Grep** (canonical).
- Validate edits by **isolate-compiling the edited functions**: extract the function's exact line
  range, wrap in `function W(){ … }` (or `const x = (<>…</>)` for a JSX block), and
  `npx esbuild --loader:.jsx=jsx --jsx=automatic`. Watch boundaries — slice from one `function`/
  `const` to just before the next so braces balance.
- Standalone small files (`data/*.js`, `music/*.js`, `data/trivia.js`) bundle fine **only if last
  written via bash**; if edited via the file tool, isolate-check the changed function instead.
- Final truth = **`npm run dev`** (user runs it).

---

## Naming / conventions
- **Melody Line** = `melodyLine` (melody → movement). **Chord Stack** = `chordStack` (combat harmony).
  "Note Stock" (`noteStock`) is the draw pool — a separate thing, not renamed.
- Function names like `confirmNoteTrack`/`clearNoteTrack` were intentionally left as-is.
- Sonic dice are **keep-highest** now: 1 amp 2d6 · 2 amps 3d6 · 3 amps 2d6+1d8 · Hydra 3d8 (defender flat d6).
- Amps build **outward** as a contiguous rig (`ampPlaceCandidates`).
