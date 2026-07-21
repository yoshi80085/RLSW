# Rock Legends: Spirit Wars — Amp Deck System Design

Supersedes the on-board amp token system (`board/ampRigs.js`, `AMP_RANGE`/`AMP_LINK_DIST`/
`AMP_UNPLUG_DIST` in `gameConstants.js`), the unplug/replug sabotage loop, **and the entire
Crew system (`CREW_SYSTEM_DESIGN.md`)**. Emerged from the fiction fix: electric Spirits
cannot start unplugged — everyone begins wired into a **Main Amp** at their home corner,
and the rig grows there for the whole table to see. With amps off-board the crew route's
jobs go moot, so the skill tree consolidates to three routes: Theory, Electric, Stances.

---

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

### 2.1 Baseline (turn 1, no unlocks)

Every Spirit: **roll 1d6, keep the highest**, anywhere on the board. The Main Amp has
board-wide reach — you are never "out of range" of your own baseline Sonic. (Sonic's
*targeting* range — the forward beam — is unchanged and separate.)

### 2.2 Amp I–III — pool size

Each tier bolts another cabinet onto a deck and adds **+1 d6 to the roll**. Full track:
roll 4 dice, keep the highest. More dice = consistency — a bigger pool squeezes the
variance out of your attack.

### 2.3 Power I–III — die upgrades

Each tier upgrades the amp *head*, converting **one die in your pool from d6 to d8**:
Power I = one d8 in the pool, Power II = two, Power III = three. Power N requires
Amp N first — the head needs a cabinet to drive, and the gate keeps the DB curve
honest. Full rig: roll 3×d8 + 1×d6, keep the highest.

### 2.4 Range I–III — where the bonuses live

The upgrade stacks are physical hardware at your corner: their boost only carries so
far. **Within radius of your home hex, the full rig applies. Outside it, you fall back
to baseline 1d6** (the Main Amp's board-wide floor).

Proposed radii (tunable, axial distance from `CORNERS[corner].homeNum`):

Measured on the 111-hex map: home → Limelight (hex 56) = **5**, home → adjacent corner
= 5, home → far corner = **10**.

| Tier | Radius | Feel |
|---|---|---|
| Range 0 (start) | 2 | Your corner pocket only |
| Range I | 4 | The approaches — one hex shy of the Limelight |
| Range II | 7 | Limelight AND both adjacent corners inside your field |
| Range III | ∞ | Fully wired — even the far corner (dist 10) is your stage |

This is the positional tension that replaces amp-token play: you're a monster on home
turf, honest in the middle, and baseline in a rival's corner — until you buy Range.
Note Range II deliberately covers the center hex so contesting the Limelight is a
mid-game rig goal, and Range III existing keeps the endgame from turtling.

### 2.5 Tuning guardrails

- Keep-highest means margins stay in familiar territory — no sum inflation. But note
  the **ceiling drops**: the old rig topped out at d12; the new one tops at 8. Check
  every rule that leaned on high Sonic rolls (margin-scaled push `ceil(margin/2)`,
  knockback tiers, 7+ Performance triggers like the Soloist diehard convert) against
  a max roll of 8, and rebalance the defender's die downward if Sonic stops winning
  exchanges it should.
- Full rig (3×d8+1×d6, keep highest) ≈ 7.1 expected, ≥7 about 66% of the time —
  strong and consistent without breaking the cap structure. Baseline 1d6 ≈ 3.5.
- Charge Zone boost (`elevenBoost` currently bumps the amp tier): becomes **+1 d8 to
  the pool** (works anywhere, even past your Range). Overcharge unchanged.
- Suggested DB costs, mirroring existing curves: Amp 8/12/18 (unchanged), Power
  10/14/18, Range 8/12/16.

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

## 4. Skill tree — the new Electric route

Structured as `subChains` (same pattern as the Stances route) so the upgrade modal
renders three labeled columns. IDs `amp_1..3` are **preserved** — every existing prereq
(`ULTIMATE_PREREQS`, PA sub-chain gate, `hydra`/`sunbeam` pre-reqs, `rockGods.js`
counts, bot `skillOrder`s) keeps working without migration.

```js
{
  id: 'electric',
  label: 'Electric',
  icon: '⚡',
  color: '#ffcc44',
  desc: 'Your rig. It lives at your corner and it only gets bigger.',
  subChains: [
    { id:'rig_amps', label:'🔊 Amps', skills: [
      { id:'amp_1', label:'Amp I',  dbCost:8,  prereq:null,    desc:'+1d6 to your Sonic pool (roll 2, keep highest). A second cabinet hits the deck.' },
      { id:'amp_2', label:'Amp II', dbCost:12, prereq:'amp_1', desc:'+1d6 (roll 3, keep highest).' },
      { id:'amp_3', label:'Amp III',dbCost:18, prereq:'amp_2', desc:'+1d6 (roll 4, keep highest). The wall of sound is complete.' },
    ]},
    { id:'rig_power', label:'🎛️ Power', skills: [
      { id:'power_1', label:'Power I',  dbCost:10, prereq:'amp_1', desc:'A real head on the stack — one of your dice becomes a d8.' },
      { id:'power_2', label:'Power II', dbCost:14, prereq:['power_1','amp_2'], desc:'A second die becomes a d8.' },
      { id:'power_3', label:'Power III',dbCost:18, prereq:['power_2','amp_3'], desc:'Three d8s in the pool — maximum wattage.' },
    ]},
    { id:'rig_range', label:'📡 Range', skills: [
      { id:'range_1', label:'Range I',  dbCost:8,  prereq:null,     desc:'Full rig reaches 6 hexes from home.' },
      { id:'range_2', label:'Range II', dbCost:12, prereq:'range_1',desc:'Full rig reaches 9 hexes — the Limelight is inside your field.' },
      { id:'range_3', label:'Range III',dbCost:16, prereq:'range_2',desc:'Fully wired. The whole venue is your stage.' },
    ]},
  ],
  // Overcharge stays, appended to rig_amps (prereq amp_2) unchanged.
}
```

Note: `power_1..3` must not collide with the existing `power_chords` skill — it doesn't,
but double-check the legacy map. Multi-prereq (`['power_1','amp_2']`) needs a small
extension in `skills.js` `canUnlock` if it only supports a single `prereq` string today.

---

## 5. Engine & code changes

### 5.1 The one new pure function

```js
// engine/systems/sonicRig.js
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
