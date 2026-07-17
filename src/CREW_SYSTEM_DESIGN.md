# Rock Legends: Spirit Wars — Crew System Design (the Utility Branch)

Reworks the Crew route, which the Stance rework (§8 of `STANCE_SYSTEM_DESIGN.md`)
left desolate — two orphaned deployables (`fans_4eva`, `pranksta`) with no identity.
Emerged from design dialogue (2026-07-17): the Crew route becomes the game's
**utility branch**, and its currency is the fans you already earned. **Diehard fans
are a workforce.** Your most loyal fans don't just cheer — they write letters, haul
cabinets, heckle rivals, and work the merch table.

---

## 1. Design principles

**One rule (inherited):** every number on the board traces back to a choice the player
made. A Diehard exists because you performed well enough to harden them
(`LOYALTY_PER_DIEHARD`, centre streaks, Encore). Assigning one to a task spends that
earned loyalty on utility instead of Fame.

**The core economy — no new stat layer.** Diehards currently do exactly one thing:
add `FAN_DIEHARD_WEIGHT = 0.10` each to the crowd Fame multiplier. The assignment
system's cost is built in for free:

> **A Diehard on assignment steps out of the crowd.** While assigned, they do NOT
> count toward `crowdMultiplier`, and they leave the front rail of the fan-sea
> render (they're drawn at the home-corner crew muster instead).

That's the whole trade: −0.10× on every FP grant, per assigned Diehard, for the
duration. Fame throughput vs. utility, decided turn by turn.

**What this replaces:**

- `fans_4eva` (tap-to-heal, 2 Vibe, cooldown 3) — **absorbed** into the Fan Mail task.
  Same effect slot, better fiction, real cost (see §4.1).
- `roadie_1` in the Electric route — **moved here** as the Stagehand task. Electric
  keeps the hardware (amps, Overcharge); Crew supplies the labor. `amp_3` re-chains
  to `prereq: 'amp_2'`. (Decision locked 2026-07-17.)

**What this does NOT replace:**

- The fan economy itself (gain by ring, boredom decay, promotion streaks,
  knockdown flee). Untouched — assignments sit on top of it.
- Amps, amp range, unplugging. The rig is Electric's identity; Crew just staffs it.
- `pranksta` — **cut**, replaced by Heckler (§4.3) — fan-economy attack instead
  of amp sabotage (overlapped with `AMP_UNPLUG_DIST` auto-unplug).
- Street Team — **cut**, replaced by Merch Table (§4.4) — DB income instead of
  invisible boredom suppression.

---

## 2. The assignment model

- **Staffing requires stock.** A task can only be assigned if you have at least
  one **unassigned** Diehard in your pool. No Diehards, no workforce — the branch
  is earned through performance, always.
- **Assigning** a Diehard to a task is free (no Action) but takes effect at the
  **start of your next turn** — the fan has to get backstage. Same for recalls.
  No same-turn flickering between multiplier and utility. *(Locked 2026-07-17.)*
- **Concurrent assignments: 1**, raised to **2** by the Tour Manager upgrade (§5).
  With `FAN_DIEHARD_CAP = 6`, even the ceiling case costs a third of your loyal core.
- **Assigned Diehards are safe backstage.** Knockdown fan-flee
  (`FAN_FLEE_MIN..MAX`) and Demolition's Diehard shake (2 → Casuals) only touch the
  crowd, never assigned fans. This creates real play: park a Diehard on a task
  before a risky fight — at the price of your multiplier when you most want the FP.
- **Losing the task loses nothing permanent.** Recall returns the Diehard to the
  crowd (next-turn effect). Nothing consumes Diehards; the branch spends their
  *time*, not their lives.

State (per-spirit note sheet): `assignments: { taskId: true|null }` or simply
`assignedDiehards: string[]` of task ids — count derives the multiplier exclusion.
Plain JSON, replay-safe, one field.

---

## 3. Why the Crew route earns "utility branch"

Post-stance, the four universal routes read: Theory (the spine — what you can play),
Electric (hardware — how loud), Stances (combat identity — how you deliver), Crew
(???). This rework gives Crew the missing answer: **logistics**. Everything that
keeps the show running but isn't the music itself — healing, rig work, heckling,
merch sales. Every task is staffed by a fan the player earned, so the route
scales with performance quality rather than raw DB.

---

## 4. The tasks

Each task is a skill unlock; each occupies one assigned Diehard while active.

### 4.1 Fan Mail — "the letter" *(mechanics locked 2026-07-17)*

*The mega-fan writes to their Spirit — pages of loyalty and dedication. Reading it
is a hit of pure Vibe. But first you have to go get it.*

Not a recurring auto-heal — a **player-triggered, cooldown-gated board interaction**:

1. **Trigger:** click your pen-pal fan at the home-corner muster (they idle with a
   💌 and a ♥ above their head while the letter is ready). Requires the Fan Mail
   assignment staffed (which requires a Diehard in the pool, §2).
2. **The throw:** on your turn, the fan hurls the letter — animated arc over the
   crowd — and it lands on a hex **1 away from your Spirit** (first free adjacent
   hex; letter token rendered on the board like a Lost Chord).
3. **The pickup:** the letter does nothing until **you move onto its hex**.
4. **The read:** picking it up spends your **Action** (move yes, attack no — the
   stance-switch cost) and restores **+3 Vibe**.
5. **Cooldown:** **3 of your turns** from the throw (reuse `GROUPIE_COOLDOWN = 3`).
   One letter in flight at a time — no stacking.

Unread letters are addressed: only you can pick yours up. An unclaimed letter
expires when the next one becomes available. *(Optional spice, unlocked-for-later:
rivals stomping the letter to destroy it — adds counterplay but also feel-bad;
playtest first.)*

Why the numbers: `fans_4eva` healed 2 Vibe for a free HUD tap. Fan Mail heals 3
(flagged high, running with it for now) but costs movement + your Action + −0.10×
Fame while staffed — strictly more interesting, and it kills the free-heal turtle
loop instead of feeding it. The whole exchange is public: rivals see the letter
land and know exactly what you'll spend to cash it.

**Fantasy:** "Someone out there believes in me this much." Stopping mid-brawl to
read it — that's a statement.

### 4.2 Stagehand — the Diehard picks up a wrench

*Stage set-ups are heavy work. Your biggest fan volunteers.*

| Aspect | Rule |
|---|---|
| **Assignment** | One Diehard becomes a **Roadie** — mechanically identical to the existing one (move an amp 2 hexes; Fix Cable replugs a sabotaged amp; 2-turn cooldown per job). |
| **Recall** | The wrench goes down, the fan walks back to the rail (next-turn effect). Any in-flight cooldown is forfeit. |

This is the moved `roadie_1`. All the roadie plumbing (`startRoadieAction`,
`roadieMoveAmp`, `roadieReplugAmp`, animations, ghost tokens) is reused as-is —
only the *source* of the roadie changes (assignment instead of permanent hire).

**Route synergy:** Electric builds a rig worth staffing; Crew staffs it. An
amp-less player still gets value from the other tasks, so Crew never dead-ends.

### 4.3 Heckler — the fan-economy attack *(replaces Pranksta, 2026-07-17)*

*Your biggest fan storms the other side and shouts them down.*

| Aspect | Rule |
|---|---|
| **Trigger** | Click the heckler at the corner muster (§7). Auto-targets the rival with the most Casuals. |
| **Effect** | Sets `heckled: true` on the target's note sheet. On that rival's **next** `gainFans()` call, the gain is **zeroed** and the flag clears. One-shot, one-turn debuff. |
| **Cooldown** | `GROUPIE_COOLDOWN = 3` own turns between heckles. |
| **Animation** | `flyCrew` dash to the target side (existing). |

**Why this replaces Pranksta:** amp sabotage overlapped with the built-in
`AMP_UNPLUG_DIST` auto-unplug mechanic — walking near a rival's amp already
disconnects it. Heckler attacks the **fan economy** instead, a vector nothing
else touches. It's also hilarious.

### 4.4 Merch Table — the DB machine *(replaces Street Team, 2026-07-17)*

*Your fan sets up a stall and hawks T-shirts while you play.*

| Aspect | Rule |
|---|---|
| **Passive** | While assigned: every raw FP earned (before crowd multiplier) also grants **+1 DB** via `grantDB(spiritId, fp)`. |
| **Cost** | The usual: one Diehard off the multiplier. |

**Why this replaces Street Team:** boredom suppression was an "invisible when it
works" ability — nobody notices fans *not* leaving. Merch Table has visible, tangible
payoff every turn you earn Fame. The rename from HC to **Decibills** made this
thematically intuitive: your crew sells merch at the show, you get paid more.

---

## 5. The skill tree (Crew route, rebuilt)

Structured as `subChains` like the Stance route — the assignment tiers in one
window, tasks in their own windows:

```
── Crew (utility / labor) ─────────────────────────────────────
│
├─ 🎫 Backstage Pass        (8 DB, tier 1)
│    Unlocks the assignment system + the FAN MAIL task.
│
├─ Tasks (each gated on Backstage Pass):
│    🔧 Stagehand           (12 DB)  — Roadie task (moved from Electric)
│    📢 Heckler             (8 DB)   — zero a rival's next fan-gain
│    🏪 Merch Table         (12 DB)  — +1 DB per raw FP earned
│
└─ 🎩 Tour Manager          (16 DB, prereq: Stagehand)
     Two concurrent assignments. Your operation has an org chart.
```

*(Tour Manager prereq simplified from "any 2 tasks owned" — the engine's
`skillEligibility` only understands single-skill prereqs plus the `__all_pa__`
special case, and one capstone doesn't justify a new gating rule. Locked
2026-07-17.)*

Skill ids: `crew_backstage`, `crew_stagehand`, `crew_heckler`, `crew_merch`,
`crew_manager`. `fans_4eva`, `roadie_1`, `pranksta` are retired (legacy-mapped, §9).

---

## 6. Interactions with existing systems

- **Crowd multiplier (`crowdMultiplier`)** — the one real hook: exclude assigned
  Diehards from the count. Everything else follows.
- **Cool stance (§4.3 of the stance doc)** — Cool hardens Diehards faster
  (`COOL_PROMOTE_EVERY = 2`, loyalty 16), which makes Cool the natural crew-builder.
  A deliberate cross-route synergy: the stance that lacks an attack bonus feeds the
  utility branch.
- **Soloist / Encore** — Encore mints Diehards from spectacle; Soloist players get
  workforce as a byproduct of showing off. Also deliberate.
- **Demolition (Power upgrade)** — shakes 2 Diehards → Casuals on the victim.
  Assigned Diehards are exempt (backstage), so a player expecting a beating can
  shelter loyalty in assignments. Counterplay for the Power matchup.
- **Fan-sea render** — assigned Diehards leave the front rail and appear at the
  home-corner crew muster (both render systems already exist; this is a filter and
  a position change, not new art).
- **Riff-offs, Theory, chord table** — untouched. Crew is orthogonal to the spine.

---

## 7. Embodied crew — the corner IS the UI *(added 2026-07-17)*

The crew stops being a window in the HUD. Diehards with jobs are **board actors**:
they stand at your home-corner muster, look the part, animate, and are **clicked
on the board** to act. The HUD's crew rows shrink to (at most) a status echo.

**Looking the part** — each task has a distinct silhouette/prop at the muster:

| Task | Idle look | Ready tell | Action animation |
|---|---|---|---|
| Fan Mail | Fan clutching pages, ♥ pulse | 💌 + ♥ bobbing overhead | Arcing letter throw → letter token lands on hex |
| Stagehand | Hard hat + wrench (existing roadie art) | Wrench glint when off cooldown | Existing sprint/haul animations (`roadieAnimations`) |
| Heckler | Cupped hands, shouting pose | 📢 flash when off cooldown | `flyCrew` dash to the rival's side |
| Merch Table | Fan behind a stall | 🏪 glow while active | Passive — periodic coin sparkle on FP grants |

**Interaction model:**

- Clicking a mustered crew member starts their action (throw the letter, start the
  roadie flow, launch the prank). Same handlers the HUD buttons call today —
  `startRoadieAction`, `deployGroupie`, the new letter throw — just rehomed onto
  the SVG tokens.
- Click targets get **generous hitboxes** (invisible circle ≥ 2× the sprite) and a
  ready-state glow — corner tokens are small at board scale.
- On-cooldown crew show the existing ghost/dimmed treatment with a turn counter.
- Assignment/recall lives in the rebuilt Crew skill window (you're already in a
  modal when making strategic choices); *using* the staffed crew lives on the board.
- Bots don't click — their crew logic stays programmatic (§8), driving the same
  underlying functions, so spectators still see the animations.

**Why this is cheap:** the muster render (roadies on one flank, groupies on the
other, owner-colored glow), the travel animations, and the ghost-cooldown tokens
all exist. This section is mostly adding `onClick` + poses/props to sprites that
are already drawn every frame.

---

## 8. Bot policy

- `BOT_PERSONAS` skillOrders: swap `fans_4eva` → `crew_backstage`,
  `pranksta` → `crew_heckler`; personas that ran `roadie_1` (rig-focused) add
  `crew_stagehand` after `amp_2`.
- Assignment heuristics (in `botTakeTurn`'s crew block, where `crewReady` lives):
  - Assign Fan Mail when `vibe ≤ maxVibe − 3` and no fight is adjacent; read the
    letter when no attack is available anyway (the Action was going spare).
  - Assign Stagehand when an owned amp is unplugged or > unplug-range behind.
  - Deploy Heckler when a rival has ≥ 3 Casuals (worth zeroing).
  - Recall everyone when Fame multiplier matters most (bot is in the lead-chase
    endgame, `ROCK_GOD_RUNAWAY_LEAD` logic already reads the fame gap).

---

## 9. Cuts, moves, and legacy

| Item | Fate |
|---|---|
| `fans_4eva` | **Cut** — absorbed into Fan Mail (`crew_backstage`). Legacy-map: `fans_4eva → crew_backstage`. |
| `roadie_1` (Electric) | **Moved** — becomes `crew_stagehand`. `amp_3.prereq` → `'amp_2'`. Legacy-map: `roadie_1 → crew_stagehand`. |
| `pranksta` | **Cut** — replaced by Heckler (`crew_heckler`). Legacy-map: `pranksta → crew_heckler`. |
| Street Team | **Cut** — replaced by Merch Table (`crew_merch`). No legacy map needed (never shipped). |
| `groupieCooldowns` | **Kept** — same field drives letter cadence and Heckler recovery. |
| `ns.roadies` | **Kept** — Stagehand pushes/pops entries in the same array the roadie UI reads. |

---

## 10. Open questions

> ✅ RESOLVED 2026-07-17 (design session) — #1–#5 all decided; see §12 for the
> locked-decision table.

1. ~~**Letter magnitude.**~~ **DECIDED: flat +3** ("seems a bit much, running with
   it for now" — first tuning candidate). Not recurring — player-triggered on a
   cooldown, letter must be picked up on the board (§4.1).
2. ~~**Pranksta as assignment**~~ **SUPERSEDED:** Pranksta replaced by Heckler (fan-economy attack).
3. ~~**Tour Manager prereq**~~ **DECIDED: simplify** to `prereq: 'crew_stagehand'`.
   No new gating rule for one capstone.
4. ~~**Multiplayer read**~~ **DECIDED: visible.** Rivals see which task your
   missing Diehard is on — the game telegraphs everything else too.
5. ~~**Recall friction**~~ **DECIDED: next-turn-start**, no extra cooldown for now.

**Still open (playtest watchlist):**

- The +3 Vibe letter — flagged high by design; first knob to turn.
- Letter-hex edge cases: Spirit fully boxed in (no free adjacent hex) → letter
  waits a turn? lands 2 away? Pick during implementation.
- Rival letter-stomping (§4.1 optional spice) — parked.
- Click-target sizes on corner crew at min zoom.

---

## 11. Implementation seams

- **`crowdMultiplier(diehards, casuals)`** — call sites pass
  `diehards − assignedCount` (or add an `assigned` param). One arithmetic change.
- **`applyFansTicked`** (engine, `economy.js`) — no crew hooks needed here
  (Street Team boredom suppression was cut when Merch Table replaced it).
- **Knockdown flee / Demolition shake** — clamp flee/shake pools to *unassigned*
  Diehards. Two call sites.
- **`makeInitialNoteState`** — add `assignments: []` (plain JSON).
- **Fan Mail flow** — cooldown rides `groupieCooldowns['crew_backstage']` (existing
  tick-down in the turn loop). The trigger is an `onClick` on the mustered pen-pal
  sprite; the throw reuses the `flyCrew`/`roadieAnimations` arc; the **letter token**
  is a new board object (`letters: [{ownerId, hexNum}]` alongside amps/Lost Chords in
  render + click handling); pickup fires on move-onto-hex, spends the Action
  (`beatsSpent(0, true)`, the stance-switch pattern), grants Vibe via the existing
  heal path, and clears the token.
- **Stagehand** — on assign, push a roadie into `ns.roadies` (the object the whole
  roadie UI/flow already consumes); on recall, remove it.
- **Skill tree** — Crew route → `subChains` (the Stance-route pattern; the modal
  already renders per-chain windows, colors, and lock badges).
- **`SKILL_TREE` legacyMap** — `fans_4eva → crew_backstage`, `roadie_1 → crew_stagehand`,
  `pranksta → crew_heckler`.
- **Fan-sea + crew-muster renders** — filter assigned Diehards from the rail
  count; append them to the muster row with the task-specific pose/prop (§7).
- **Board-first interaction (§7)** — move the crew action entry points from the
  HUD rows onto the mustered SVG tokens: `onClick` + enlarged invisible hit
  circles + ready-glow. The HUD crew card shrinks to a status echo (or is removed).

No new subsystems: the branch is one sheet field, one multiplier filter, one new
board token type (the letter), and skills wired into hooks that all exist today.

---

## 12. Locked decisions (2026-07-17 design session)

| Question | Decision |
|---|---|
| Letter heal | **Flat +3 Vibe** — flagged as probably high; first tuning knob. |
| Letter cadence | **Not recurring.** Player-triggered by clicking the pen-pal fan; `GROUPIE_COOLDOWN = 3` own turns between letters; one in flight at a time. |
| Letter delivery | Fan throws it (arc animation, 💌 + ♥ tell) → token lands **1 hex from the Spirit** → **must be picked up** (move onto hex) → reading spends the **Action**, grants the Vibe. |
| Task availability | Requires an **unassigned Diehard in the pool** at assignment time. |
| Pranksta → Heckler | **Cut and replaced.** Heckler zeroes a rival's next fan-gain; auto-targets rival with most Casuals. |
| Street Team → Merch Table | **Cut and replaced.** Merch Table grants +1 DB per raw FP earned while assigned. |
| Tour Manager gate | `prereq: 'crew_stagehand'` — no multi-prereq engine rule. |
| Assignment visibility | **Visible to rivals** — which task, not just a missing head. |
| Recall friction | **Next-turn-start**, no extra cooldown. |
| Crew UI | **Board-first (§7):** crew live at the corner muster, look their part, animate their actions, and are **clicked on the board**, not in the HUD. |
| Roadie home | **Crew route** (`crew_stagehand`); Electric re-chains `amp_3` → `amp_2`. |
