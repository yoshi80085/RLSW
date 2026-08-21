# Rock Legends: Spirit Wars — Amp Deck System Design

> ✅ **REWRITTEN 2026-08-20 (evening), IN THE SAME PASS AS THE DELETION** — which is
> what this doc's own header demanded. **§2 and §4 describe the game as it is.**
>
> The rig is no longer bought with Db. Pool size and die size are won at the marquee
> quiz and lost to atrophy (`MARQUEE_QUIZ_DESIGN.md` §4–§5); the radius breathes with
> your stacks (`SEQUENCING.md` §5.A⁷). The CEILING did not move — 3 pool + 3 power is
> exactly the old Amp III / Power III, so §2.5's "the maximum Sonic roll is 8" and
> everything ever checked against it still holds.
>
> ⚠️ **§5 AND §6 AND §7 ARE A HISTORICAL IMPLEMENTATION LOG, NOT INSTRUCTIONS.** They
> record how this system was built in July 2026, including files that no longer exist
> and constants that have since been deleted. §5.1's function signature is two
> rewrites out of date and is kept because the SHAPE of it — one pure function
> everything routes through — is the reason the 2026-08-20 rework was cheap. Read
> `engine/systems/sonicRig.js` for what it says today.

## 1. Design principles

**The fiction is the rule.** Every Spirit's corner has a Main Amp from turn 1. Sonic
Attacks are online immediately — no skill unlock required to *be* electric, only to be
*louder*. The rig never sits on the field; it lives at your corner and physically grows
as you invest, engine-builder style.

**Three axes, one question each:**

| Track | Question | Effect |
|---|---|---|
| **Amp I–III** | How many dice do you roll? | +1 d6 to the Sonic pool per tier (1 → 4 dice) |
| **Power I–III** | How strong are your dice? | Upgrades 1/2/3 of your pool from d6 → d8, gated behind Amp |
| **Range I–III** | How far does the full rig reach? | Radius from home corner where Amp/Power bonuses apply |

The roll is **keep-highest**: roll the whole pool, the single best die is your result.
Amp buys consistency, Power buys ceiling, Range buys territory.

**What this cuts (entirely):**

- The unplug / plug-back-in sabotage loop and the `unplugged` amp flag.
- Amp tokens on the board, amp placement (`ampPlacing`, `placeAmp`, `botNeighborForAmp`).
- Daisy-chain rig math — all of `board/ampRigs.js` (`ampLinked`, `ampMstEdges`, `computeAmpRigs`).
- The instrument-cable and chain-link rendering (cable-fray / cable-flow FX).
- **The entire Crew system** — all five skills, the Diehard assignment layer, groupie
  deployment, Fan Mail letters, and the corner crew muster. Full inventory in §6.
  `CREW_SYSTEM_DESIGN.md` is superseded by this document.
- Constants: `AMP_RANGE`, `AMP_LINK_DIST`, `AMP_UNPLUG_DIST`, `AMP_DICE`, `AMP_UPGRADE_MAX`,
  `GROUPIE_COOLDOWN`, `FAN_MAIL_VIBE`.

**What this keeps untouched:** Sonic vs. Thrash delivery physics (`STANCE_SYSTEM_DESIGN.md`
§2), `SONIC_VIBE_CAP`, Limelight FP bonus, Overcharge, the Theory ladder, chord costs,
and the fan economy itself (diehards/casuals, grandstand, crowd multiplier — minus the
assignment layer that pulled diehards out of it).

---

## 2. The rig — mechanics

> 🎛️ **REWRITTEN 2026-08-20**, the day the rig came off the skill tree. The three
> axes are the same three axes; not one of them is a purchase any more. See
> `MARQUEE_QUIZ_DESIGN.md` §0.1 for the three clocks and `SEQUENCING.md` §5.A⁷–§5.B⁷
> for the measurements.

### 2.1 Baseline — the floor everybody stands on

Every Spirit: **2d6, keep the highest**, anywhere on the board. The Main Amp has
board-wide reach — you are never "out of range" of your own baseline Sonic. (Sonic's
*targeting* range — the forward beam — is unchanged and separate.)

🎯 **THIS IS A FLOOR, NOT A STARTING PURCHASE.** It used to be the free `amp_1` grant
seeded into `unlockedSkills`; it is `RIG_POOL_FLOOR` now, and `rigTiers()` clamps to
it. The number did not change — the reason it exists did. Nothing can take it away:
atrophy stops here, and a Spirit who never answers a single quiz question plays the
whole match on exactly this.

### 2.2 Pool size — how many dice

`rigPool`, 1 → 3, **+1 d6 per tier**. Full pool: roll 4 dice, keep the highest. More
dice is consistency — a bigger pool squeezes the variance out of your attack.

**Won at the marquee**, in the 🎛️ RIG lane: a correct answer grants 1 / 2 / 3 tiers by
difficulty, spent at the card on this track or on power. Lost to **atrophy** — one
tier shed for every `RIG_ATROPHY_TURNS` of your own turns without a trip to a marquee.

### 2.3 Die size — how big those dice are

`rigPower`, 0 → 3, converting **one die in your pool from d6 to d8** per tier. Full
rig: 3×d8 + 1×d6, keep the highest.

⚠️ **POWER CAN NEVER EXCEED POOL** — you cannot upgrade a die you do not have. This
was the tree's `prereq` gate (Power II needed Amp II). With no tree left it is plain
arithmetic, enforced inside `rigTiers()` so that every reader gets the clamped
numbers and no caller can talk itself into an upgrade for a die that does not exist.

📌 **AND ATROPHY SHEDS POWER FIRST**, which is not flavour: shedding a pool tier while
power equalled it would silently drop both, so one turn of neglect would cost two
tiers with only one of them logged. You lose the head before you lose the cabinet.

### 2.4 Radius — 🫁 where the bonuses live, and it breathes

The rig is physical hardware at your corner: its boost only carries so far. **Within
the radius, the full rig applies. Outside it you fall back to the board-wide floor,
the Sonic is OFFLINE for targeting, you brace an incoming beam on a bare d4 instead of
a d6, and no riff-off is possible** — §3.1's "worst square on the board".

What changed is that the radius is no longer a tier you bought:

```
radius = RIG_RADIUS_FLOOR + (your turn ? Drive stack : Sustain stack).length
```

| stack length | radius | when |
|---|---|---|
| 0 (emptied out) | 3 | you spent it, posed it away, or were frayed to nothing |
| 1 (the opening state) | **4** | turn one, every Spirit — the old Range-0 number exactly |
| 4 | 7 | the Limelight is inside your field |
| 6 (a full stack) | 9 | most of the venue, and never all of it |

🎯 **THE TURN SPLIT IS WHERE THE EXISTING GATES ALREADY FELL.** Every offensive read of
`inRange` happens on your own turn (can you fire a Sonic) and every defensive one on
somebody else's (the d6/d4 answer, and whether a rival can riff back). "Drive on your
turn, Sustain on theirs" therefore invents nothing: it hands each gate the stack that
gate was already about. Stack Drive and you reach further when you act; stack Sustain
and you are still standing in your own rig when they come for you.

⚠️ **THE FLOOR IS THE ANTI-SPIRAL AND IT IS TUNED TO A FACT.** Sustain frays when you
are hit, and a shrinking rig means a smaller defence die means a harder hit. Floor 3
plus the root-alone seed puts every Spirit at exactly the old radius on turn one, so
only a genuinely emptied-out Spirit drops below it. Lower the floor and you build a
game where the Spirit already losing is the one who cannot answer a beam.

📌 **There is no infinite radius any more.** Range III used to grant `Infinity`;
anything that drew or compared against it (the neon ring had a `Number.isFinite`
branch) now deals in ordinary numbers.

### 2.5 Tuning guardrails

- Keep-highest means margins stay in familiar territory — no sum inflation. The
  **ceiling is 8**: the old rig topped out at d12, this one at d8. Every rule that
  leaned on high Sonic rolls — margin-scaled push `ceil(margin/2)`, knockback tiers,
  7+ Performance triggers — was checked against a max roll of 8 when that change
  landed.
- 🎯 **AND THE WORKOUT DELIBERATELY REPRODUCES THAT CEILING.** 3 pool + 3 power is
  exactly the old Amp III / Power III, so nothing downstream needed re-checking when
  the source of the tiers changed. A hard question that wants to feel special should
  feel special by LASTING LONGER, never by introducing a d10.
- Full rig (3×d8+1×d6, keep highest) ≈ 7.1 expected, ≥7 about 66% of the time. The
  floor (2d6) ≈ 4.5.
- Charge Zone boost: **+1 d8 to the pool**, and it works anywhere — even outside your
  radius. That is the one part of the rig you can carry.
- ⚠️ **THE PRICES ARE GONE, NOT RE-QUOTED.** This section used to end with suggested
  Db costs. There are none: the rig costs no Db at all. What it costs is EXPOSURE —
  staying loud means walking back onto a published hex in the middle of the board,
  round after round, where everybody can reach you. That is the counterplay, and it
  is positional rather than trivia-based.

---

## 3. Board presentation — the double amp decks

### 3.1 Layout

The fans' grandstand sits radially *behind* the lives dock (the crowd wedge is anchored
on the hub→home outward vector, `FAN_OUT` past the pocket). So the decks flank the dock
**laterally, along the two board edges that meet at the corner** — exactly the two
rectangles in the sketch:

```
        (dark margin)
     🧑‍🤝‍🧑🧑‍🤝‍🧑🧑‍🤝‍🧑   ← grandstand (fans) — radially out, DON'T touch
      🧑‍🤝‍🧑🧑‍🤝‍🧑
       [LIVES DOCK]      ← home pocket hexes
   ┌────┐      ┌────┐
   │AMP │      │PWR │    ← the two decks, hugging the board edge
   │DECK│ ⬡⬡⬡ │DECK│
   └────┘board └────┘
        edge
```

- **Left deck — the Amp stack.** One speaker cabinet per Amp tier, stacking upward.
  Cabinet count is readable at a glance across the table: that's their pool size.
- **Right deck — the Power stack.** The amp *heads* (the electronics-with-dials units).
  Each Power tier adds a head, and one cabinet on the Amp deck flips to a hotter glow —
  the visual for "that die is now a d8."
- **Range** doesn't stack a third deck (no room, and it's a field property, not
  hardware). It renders as: (a) a horn/antenna array that tops the Main Amp, one horn
  per tier, and (b) a **neon radius ring** pulsing out from the corner whenever the
  Spirit aims or lands a Sonic Attack — instantly teaching "inside the ring = full rig."

Each deck sits just off-board in the dark margin, rotated to hug its board edge, in the
corner's color (`CORNER_LABELS[corner].color`). Blue corner: one deck along the NW edge,
one along the W edge, mirroring the sketch. The four corners mirror by symmetry.

### 3.2 Geometry (implementation)

Reuse the fan-crowd math in the main render: outward unit vector `(ox, oy)` from hub
through home hex. The two deck anchors are the home pocket position rotated ±(55–70°)
around the hub at slightly larger radius than the pocket, then each deck is rotated to
align with its nearest board edge. Same pattern `grandstandSeat` uses — no new geometry
primitives needed, just a `deckAnchor(corner, side)` helper.

New file: **`src/board/ampDecks.jsx`** — pure SVG component:

- Cabinet: rounded rect + 1–2 speaker-cone circles (concentric strokes), neon stroke
  in corner color, dark fill matching the board's hex fill.
- Head: shorter rounded rect + dial dots that light per Power tier.
- Unbuilt slots render as faint dashed outlines (like the sketch's empty rectangles) —
  visible ambition, same trick as the fan-capacity tiers.
- On Sonic attack: a 300ms scale "thump" on both decks + cone-flare, synced with the
  beam SFX (`playBeamSurge`). On upgrade purchase: the new cabinet drops in from above
  with a bounce, camera unchanged (the corner glow makes it read peripherally).

### 3.3 HUD

The dice readout (currently the single `diceTier` chip) becomes **"2d8 + 2d6"** (keep
highest is implicit) with an in/out-of-range state: inside Range the chip burns full
color; outside it dims to the baseline "1d6" with a small 📡 hint. Same spot, richer info.

---

## 4. Skill tree — 🛑 THE ELECTRIC ROUTE IS DELETED

This section used to specify the route: three `subChains` (Amps, Power, Range) plus
Overcharge, ids `amp_1..3` / `power_1..3` / `range_1..3` preserved so that every
existing prereq kept working without migration. **All of it was removed from
`data/skillTree.js` on 2026-08-20.** Ten rungs, 110 Db — the single largest sink in
the game, against 52 for the whole Theory route.

**Why, in one line:** a rig you bought in round three is a shopping decision; a rig you
play into existence and then have to maintain is a game. §2 above is the replacement.

**What went with it, and what happened to each:**

| gone | replaced by |
|---|---|
| `amp_1..3` | `rigPool`, won at the marquee (§2.2) |
| `power_1..3` | `rigPower`, same source (§2.3) |
| `range_1..3` | the breathing radius (§2.4) |
| `overcharge` | ⚡ nothing — see below |
| `ULTIMATE_PREREQS`, the `pa` chain gate | 🛑 deleted; neither could fire |

⚡ **OVERCHARGE WAS CUT RATHER THAN REHOUSED**, and it was a decision rather than
collateral. It opened a modal on a Charge Zone — dice charge, or one curated chord
note — gated behind Amp II. With the amps gone it had no gate left, and a free 12 Db
upgrade reachable on turn two is a different skill from the one that was designed.
Tapping a zone now always takes the ordinary 50/50 spark, which is also what the
headless path always did (`HARNESS_GAPS.pickupChoices` declared the modal unmodelled),
so the client and the engine agree for the first time.

🛑 **AND TWO GATES THAT COULD NEVER FIRE WENT AT THE SAME TIME.**
`ULTIMATE_PREREQS = ["mic", "pedal_dist", "amp_1", "mixer"]` named three ids that are
not in the tree and have not been for a long time, and no skill anywhere carried
`prereq: '__all_pa__'`, so the Ultimate branch was unreachable. Both were nonetheless
GREEN in `selftest` — against a fake tree written to match the gate rather than the
game. That is `CLAUDE.md`'s §15 warning landing for the second time, and the
replacement assertion is the one that would have caught it: **every prereq in the real
tree must name a skill that exists.**

⚠️ **THE Db HOLE IS REAL AND IS PARKED DELIBERATELY.** Removing the biggest sink in the
game leaves Db piling up against a tree that cannot absorb it. Alex's answer
(2026-08-20) is to build out the ABILITY tree so a character's kit grows over a match;
that work does not exist yet. First measurement, 30 bench matches on the day of the
deletion: **mean 4.0 unspent Db at match end, worst 8, 2.67 skills bought per seat** —
i.e. no visible inflation yet, but bench matches run ~19 turns and the whole Theory
ladder is only 5 rungs. Re-measure on long matches before calling it fine.

---

## 5. Engine & code changes

### 5.1 The one new pure function

> 📌 **AS SHIPPED IN JULY 2026, AND SUPERSEDED TWICE SINCE.** Kept because it is the
> load-bearing observation of this whole document: the entire rig reduces to two
> integers and a radius, in ONE pure function that everything routes through. That is
> why changing where the numbers come from (2026-08-20) was a change at the BOTTOM of
> the funnel rather than a rewrite of combat. Today's version takes the note state and
> whose turn it is; read the file.

```js
// engine/systems/sonicRig.js — the ORIGINAL, for the shape only
export function sonicRig(unlockedSkills, distFromHome, chargeBoost = 0) {
  const ampT   = countOf(unlockedSkills, ['amp_1','amp_2','amp_3']);
  const powT   = countOf(unlockedSkills, ['power_1','power_2','power_3']);
  const rangeT = countOf(unlockedSkills, ['range_1','range_2','range_3']);
  const inRange = distFromHome <= RIG_RADIUS_BY_TIER[rangeT];
  const size = 1 + (inRange ? ampT : 0);            // total dice in the pool
  const d8s  = (inRange ? Math.min(powT, size) : 0) // upgraded dice…
             + chargeBoost;                          // …charge adds a d8 anywhere
  return {
    pool: Array.from({length: size + chargeBoost},
                     (_, i) => i < d8s ? 8 : 6),     // e.g. [8,8,6,6]
    inRange,
  };
}
// Roll: pool.map(sides => 1 + rand(sides)), result = Math.max(...rolls).
```

### 5.2 Change list

| Area | File | Change |
|---|---|---|
| Constants | `data/gameConstants.js` | Remove `AMP_RANGE`, `AMP_LINK_DIST`, `AMP_UNPLUG_DIST`, `AMP_DICE`, `AMP_UPGRADE_MAX`. Add `SONIC_BASE_DIE = 6`, `SONIC_UPGRADED_DIE = 8`, `SONIC_POOL_MAX = 4`, `RIG_RADIUS_BY_TIER = [2, 4, 7, Infinity]`. |
| Rig math | `board/ampRigs.js` | **Delete file.** Replaced by `engine/systems/sonicRig.js`. |
| Dice calc | main jsx ~1567–1577 | Replace `computeAmpRigs`/`ampsInRange`/`AMP_DICE` tier with `sonicRig(...)` fed by `axialDist(spirit, homeHex)`. |
| Roll + resolve | main jsx Sonic attack path (~8656, 10365, 11469, 5533) | Roll every die in `pool` (mixed d6/d8), result = highest single die. Remove amp-count lookups. |
| Amp state | main jsx | Remove `amps` state, `ampPlacing`, `placeAmp`, amp scatter/drift entries, `unplugged` flag, `roadieStartFix`/`roadieReplugAmp` (~4165–4200, 8095). |
| Cable/token render | main jsx ~13051–13141 | Delete rig chain + instrument-cord SVG block; delete `cable-fray`/`cable-flow` keyframes in `GameStyles.jsx`. |
| Deck render | `board/ampDecks.jsx` (new) | §3 visuals; mounted in the board SVG next to the grandstand layer. |
| Skill tree | main jsx `SKILL_TREE` + `engine/systems/skills.js` | §4 structure; extend prereq check for arrays; `applySkillEffects` amp-placement side effect (~3654) becomes a pure log + deck animation trigger. |
| Bot | `engine/policies/bot.js` | Delete amp-placement block + `botNeighborForAmp` + `ampHexes` avoidance in `botPlanMove`. Add `power_*`/`range_*` to persona `skillOrder`s (Maestro persona leans Range; bruiser personas lean Power). Rewrite the "unplugs rivals" blurb. |
| Crew | everywhere | **Full removal** — inventory in §6.1. |
| UI | `UpgradeModal.jsx`, HUD chip | Three-column Electric window; "2d8 + 2d6" pool chip with in/out-of-range state. |
| Tutorial | `tutorial/content.jsx` | Rewrite amp/unplug beats: one beat for "your rig lives at your corner," one for the Range ring. |
| Selftest | `engine/selftest.mjs` | Replace amp cases with `sonicRig` table tests (tier × distance grid). |
| Docs | `ARCHITECTURE.md` | Note ampRigs.js removal, new sonicRig system, this doc. |

### 5.3 Legacy saves

`unlockedSkills` ids are unchanged (`amp_1..3` persist; `power_*`/`range_*` are new).
Saved `amps` arrays in old states are simply ignored — no migration needed beyond
removing the read. The `legacyMap` changes per §6.2: crew-family ids (old and new
spellings) now filter out silently instead of mapping to crew skills.

---

## 6. Crew system — full removal

The Roadie (move amp / Fix Cable) loses both jobs to this redesign, and with amps
off-board the rest of the route no longer earns its complexity: Fan Mail was a slow
heal-fetch loop, Heckler a one-shot fan-gain zero, Merch a passive DB trickle, and
Tour Manager a slot expander for all of the above. The whole route is cut —
**`CREW_SYSTEM_DESIGN.md` is superseded and the Crew route comes out of the tree**,
leaving three routes: Theory, Electric, Stances.

### 6.1 Removal inventory

| What | Where | Notes |
|---|---|---|
| Crew route in `SKILL_TREE` | main jsx ~536–560 | `crew_backstage`, `crew_stagehand`, `crew_heckler`, `crew_merch`, `crew_manager` + their subChains |
| Skill effects | main jsx ~3579–3593, `engine/systems/skills.js` | The five `crew_*` cases in `applySkillEffects` |
| Assignment layer | `engine/systems/economy.js` (`assignments`, `groupieCooldowns` in noteState ~193–211) | Diehards no longer step out of the crowd multiplier — delete the assignment subtraction in the fan-mult calc |
| Groupie deployment | main jsx `deployGroupie` (~3897), `crewReady`/`crewStaffed`, cooldown ticking (~3320) | |
| Fan Mail | main jsx `fanLetters` state (~1305), letter landing/pickup (~3936–3952, 4334–4355), letter render (~13233), occupied-hex exclusions (3 spots: ~7853, 8330, 3936) | `FAN_MAIL_VIBE` constant goes |
| Corner crew muster render | main jsx ~12489–12643 (`groupiePos`, muster layout, click-to-deploy) | Frees lateral corner space — the amp decks (§3) inherit some of this real estate |
| Asset | `groupie_fans.png` import (main jsx line 7) | Delete import; file can stay or go |
| Bot | `engine/policies/bot.js` | `crewReady` blocks (~8589–8720 in main jsx bot section), all `crew_*` entries in persona `skillOrder`s (lines 27–55) — backfill with `power_*`/`range_*` per §5.2 |
| Constants | `data/gameConstants.js` | `GROUPIE_COOLDOWN`, `FAN_MAIL_VIBE` |
| UI | `UpgradeModal.jsx` crew window; HUD crew hints (~10370–10372) | |
| Tutorial | `tutorial/content.jsx` | Crew/Fan-Mail beats out; replace with the rig beat (§5.2) |
| Selftest | `engine/selftest.mjs` | 4 crew references |
| Docs | `ARCHITECTURE.md`, `CREW_SYSTEM_DESIGN.md` | Mark superseded; point here |

**Do NOT touch:** `Lobby.jsx`'s `assignments` state — that's corner→spirit seat
assignment in the lobby, unrelated to crew despite the name.

### 6.2 Legacy saves

Extend `legacyMap` so old ids resolve to nothing: `roadie_1 / crew_stagehand`,
`fans_4eva / crew_backstage`, `pranksta / crew_heckler`, `crew_merch`, `crew_manager`
→ **drop silently** (filter out, refund nothing). `unlockedSkills` containing crew ids
must not crash prereq checks or the modal.

### 6.3 Design consequences (deliberate, not accidental)

- **DB economy loosens.** Five skills' worth of DB sinks (8+12+8+12+16 = 56 DB) leave
  the game just as Power/Range (≈70 DB) arrive — net sink volume is roughly preserved.
  Watch overall unlock pacing in playtest, not individual costs.
- **Fan Mail was the only mobile heal** besides the Limelight/spotlight heal. Its
  removal makes Vibe attrition slightly harsher and makes contesting the center (the
  heal that remains) more valuable — consistent with §2.4's anti-turtling goal.
- **Heckler was the only fan-economy attack.** Fan counterplay now happens solely
  through knockdown stampedes and defection. Acceptable; note it for the balance pass.
- **Diehards simplify** to pure crowd-multiplier weight + front-rail seating. The
  grandstand render loses its "assigned diehards sit at the muster" branch.

---

## 7. Implementation order

1. **Engine core** — `sonicRig.js` + constants + dice calc swap + selftest. Game is
   fully playable here with old visuals still showing stale amps.
2. **The amp purge** — delete ampRigs.js, amp state, placement flows, cable render,
   bot amp block. (All deletions.)
3. **The crew purge** — §6.1 inventory top to bottom: tree route, effects, assignment
   layer, groupies, Fan Mail, muster render, constants, legacy filter. (All deletions;
   independent of phase 2 but do it before phase 4 so the corner real estate is clear.)
4. **Skill tree** — new Electric subChains + multi-prereq support + UpgradeModal
   (which also loses its crew window in phase 3).
5. **Amp decks** — `ampDecks.jsx` visuals, thump/drop-in animations, Range ring, HUD chip.
6. **Bot + tutorial** — persona skill orders (crew slots → power/range), tutorial beats.
7. **Playtest tuning** — ceiling drop vs. old d12 (§2.5), radii, DB pacing sans crew sinks (§6.3).

Phases 1–2 ship together (the engine swap orphans the visuals); 3 can land any time.

---

## 8. Open questions

- **Ceiling drop** (§2.5): the rig now maxes at 8 where it used to hit 12. Audit
  margin-scaled push, knockback tiers, and 7+ Performance triggers against the new
  distribution; rebalance the defender's die if Sonic underperforms — playtest.
- **Range radii**: 2/4/7/∞ locked to measured map distances (Limelight at 5, far corner
  at 10). Tune only the tier-0 pocket if the early game feels too weak away from home.
- **Vibe attrition without Fan Mail** (§6.3): if playtests feel too grindy, prefer
  buffing the Limelight heal over reintroducing a crew-like fetch loop.
- **Deck sides**: Amp stack on the "outer" edge and Power on the "inner" (Limelight-
  facing) edge, or mirrored per corner for visual symmetry? Pure aesthetics — decide
  in-engine with both mocked.
