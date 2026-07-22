# Rock Legends: Spirit Wars — Stance System Design (v1 — SUPERSEDED)

> **⚠️ SUPERSEDED** by `STANCE_V2_HANDOFF.md`. All v1 passive effects, the Groove
> counter, the stance skill route, and stance switching have been CUT. v2 stances
> are ability kits (specials + passive + commit Db generator). This doc is kept
> for historical reference only.

Supersedes the CQC/Thrash skill branch (§6.6 of `DESIGN_AUDIT_v2.md`). Emerged from
design dialogue about how to give players agency over combat identity without adding
systems parallel to the chord spine. Stances sit *on top of* the chord — they modify
how your chord translates to combat, performance, and crowd response, not what your
chord is.

---

## 1. Design principles

**One rule:** every number on the board traces back to a choice the player made. Stances
are a choice about *how you deliver* the music you built — your physical posture with
the instrument. They are not a second stat layer.

**What stances replace:**

- The entire CQC skill branch (`shank_skank`, `cosmic_boogaloo`, `moon_shuffle`) and its
  five %-proc status effects (slip, trip, dazed, drop, confused). These are cut.
- `junkyard_dog` (+2 flat swing bonus) — cut. Modifier soup.
- `psycho_bushido` (force defender die to 1) — cut from the universal tree; relocated
  to the Ronin's Signature arsenal if kept at all.
- The disabled counter/retaliation system (Phase 3d). Retaliation is no longer a separate
  mechanic — it emerges naturally from Thrash adjacency (see §3).

**What stances do NOT replace:**

- Sonic vs. Thrash as delivery methods. Those remain as physics (see §2).
- The Theory ladder, Electric route, Crew route, or Signature arsenals. Untouched.
- The chord → Drive/Sustain table (`evaluateChord`). The spine stays.
- The Dissonance Edge. Stays, with stance interaction (see §7).

---

## 2. Sonic vs. Thrash — delivery physics, not skill trees

These are properties of the attack, not branches to invest in. No separate systems needed.

| Property | Thrash (melee) | Sonic (ranged) |
|---|---|---|
| **Range** | Adjacent (1 hex) | Forward beam (3 hex, extends with amps) |
| **Vibe damage** | High (1–4, capped at `THRASH_DAMAGE_CAP`) | Low (1–2, capped at `SONIC_VIBE_CAP`) |
| **Push/knockback** | Low (0–1 hex) | High (1–5 hex, scales with margin + Vibe deficit) |
| **Fame gain** | Flat 1 FP | Scales with margin (`ceil(margin/2)`) |
| **Dice** | Small (d4 base) | Scales with amp count (d6→d8→d10→d12) |
| **Unique flavour** | Chord fray on both sides; Lost Chords scatter on impact | Amp-range die growth; Limelight FP bonus |
| **Chord cost** | Spends first 2 chord-stack notes | Spends first 1 chord-stack note |
| **Exposure** | Swing Exposure (−1 Sustain until your next turn) | None (ranged safety) |

The stance modifies how your chord *interacts* with whichever delivery method you use.
A Power stance makes your Thrash more devastating AND your Sonic hit slightly harder,
because the stance is about *you*, not the attack type.

---

## 3. Natural retaliation (no separate system)

Retaliation is not a phase, a prompt, a timer, or a separate dice roll. It is the
natural consequence of Thrash adjacency:

1. Attacker Thrashes the defender. Chord-vs-chord resolution (existing system).
2. Both chords fray from the exchange (attacker spends 2 notes; defender loses 1 note
   per hit absorbed).
3. After resolution, the attacker is still adjacent. The defender still has a chord
   voiced — a loaded weapon.
4. On the defender's next turn, they can Thrash back with whatever chord survived.

The attacker accepted this risk by closing distance. The stance determines how well
each side survives the exchange — that's where CQC mastery lives now.

**Why this works without new rules:** the chord system already handles everything.
A CQC-focused player (Power or Cool stance, upgraded) survives exchanges better
than an unfocused one. No status-effect dice needed.

---

## 4. The four stances

Each stance modifies four things: **chord fray** (how your chord holds up in combat),
**attack bonus** (how your chord's Drive translates to hits), **Fame/crowd** (how your
performance converts to fans and FP), and **vulnerability** (what you give up).

### 4.1 Soloist — "Foot on Monitor"

*The showoff. Playing for the crowd, not the brawl.*

| Aspect | Effect |
|---|---|
| **Attack bonus** | Performance score (P) adds directly to Drive for the attack. A well-voiced, clean chord hits harder — not because of raw dissonance, but because you played it beautifully. |
| **Fame/crowd** | Fame gain from all sources multiplied ×1.5 (rounded). Casual fan acquisition boosted. |
| **Chord fray** | Defensive chord fray **doubled** (lose 2 notes per hit absorbed instead of 1). You're exposed — foot up, eyes on the crowd, not on the threat. |
| **Vulnerability** | Glass cannon for Fame. If someone closes to Thrash range, your chord melts fast. |

**Fantasy:** "I played something brilliant and turned it into a weapon. But I'm wide open."

**Cross-cutting tension:** Consonant chords (Major triad, Maj7) give high Sustain by
default, which is defensive. In Soloist stance, the *craftsmanship* of voicing them
cleanly becomes offensive power via P — so a defensive chord becomes a weapon if you
played it well. But the doubled fray means that Sustain wall crumbles fast under
pressure. You're rewarded for quality, punished for getting caught.

**Starting spirit:** Shredding Ronin (Shred style, Drive 8). The blade-meets-riff
fantasy — technically brilliant, aggressive, but glass if cornered.

---

### 4.2 Power — "Wide Leg"

*Mutual destruction. You both lose, but they lose more.*

| Aspect | Effect |
|---|---|
| **Attack bonus** | Thrash hits fray **1 extra note** from the opponent's chord (2 notes stripped instead of 1 on a successful hit). Sonic hits fray the normal 1 but deal +1 Vibe damage (capped at `SONIC_VIBE_CAP + 1 = 3`). |
| **Fame/crowd** | Flat — no Fame modifier. Power doesn't play to the crowd. |
| **Chord fray** | Your own defensive fray is also **+1** (lose 2 notes per hit absorbed). You hit hard but absorb hard. |
| **Vulnerability** | Burns through chords fast on both sides. Loses to sustained, efficient play. Riff-offs gain no stance bonus. |

**Fantasy:** "I smash your sound apart. Mine takes a beating too, but yours is worse."

**Cross-cutting tension:** Bigger chords (Extended 9ths/11ths/13ths, 5 notes) are
normally valued for their raw Drive/Sustain. In Power stance, their *size* matters
because you burn through notes faster — more notes = more exchanges before you're
naked. A single-note or power-chord player in Power stance is terrifying for one hit
and then has nothing left.

**Starting spirit:** Metalness Monster (Shred style, Drive 7). Trash-metal violence.
Gets in your face, wrecks everything, doesn't care about looking cool.

---

### 4.3 Cool — "Low Slung"

*Efficiency. Take the hit. Keep playing.*

| Aspect | Effect |
|---|---|
| **Attack bonus** | None. No Drive modifier — your chord is your chord. |
| **Fame/crowd** | Diehard fan conversion rate improved (lower threshold to harden Casuals → Diehards). The cool player builds a loyal core, not a flash mob. |
| **Chord fray** | Defensive fray **halved** (round down, minimum 0 — on a margin ≤ 2 hit, your chord doesn't fray at all). Your sound holds together under pressure. |
| **Vulnerability** | No offensive boost. Exchanges are survivable but slow — you outlast, you don't dominate. Weak against Smash (bypasses Sustain entirely, so your durability advantage is irrelevant). |

**Fantasy:** "Hit me. I'm still here. And my chord is still intact."

**Cross-cutting tension:** Dissonant chords (Dominant 7th, Augmented, Diminished) give
high Drive but low Sustain — normally they're glass cannons. In Cool stance, the halved
fray means a dissonant chord *survives* longer than it should, turning what's normally a
spike into a sustained threat. The cool player voices a nasty chord and just... keeps it.

**Starting spirit:** Glamarchy (Flair style, Sustain 8). Effortlessly stylish. Looks
better than everyone. Doesn't flinch.

---

### 4.4 Groove — "Behind the Back"

*Rhythm and control. Build the wave, then ride it.*

| Aspect | Effect |
|---|---|
| **Attack bonus** | Each consecutive turn you maintain your chord (don't revoice AND don't get frayed below your current voicing), gain a stacking **+1 Groove counter** (max 3). Your next attack adds the Groove counter to Drive. The counter resets on attack, on chord fray, or on revoice. |
| **Fame/crowd** | Groove counter also adds to Fame earned from the attack that spends it. Patient play → big payoff. |
| **Chord fray** | Normal (1 note per hit absorbed). No defensive bonus, no penalty. |
| **Vulnerability** | Tempo-dependent — being attacked resets your counter (chord fray breaks the groove). Requires space and time to build, which means positioning and board control matter. Aggressive opponents shut it down by staying in your face. |

**Fantasy:** "I'm building something. Don't interrupt me. ...Too late."

**Cross-cutting tension:** The Groove counter rewards *not attacking* — banking turns
for a bigger payoff. This creates a genuine choice against the chord table: you could
revoice to a stronger chord (resetting the counter) or hold your current chord and let
the counter climb. A power chord held for 3 turns with a +3 Groove bonus (effective
Drive 8) might outperform a Dominant 7th (Drive 8, counter 0) that was just revoiced
into. Patience vs. optimization.

**Starting spirit:** Intergalactic 0 (Groove style, Drive 6, Sustain 7). The cosmic
zoner. Sits back, controls space with Sonic and Blaster of Ra, builds the wave, then
unleashes. The teleport (Displace) helps them reposition to avoid getting rushed down
before the counter peaks.

> **OPEN QUESTION:** "Behind the Back" is the most unconventional guitar stance, which
> fits Intergalactic 0's cosmic weirdness. But if it doesn't land thematically, alternatives:
> "Hip Slung" (funk/groove association), "Seated" (sit down and lock in — Hendrix at
> Monterey before the burn), or simply "Locked In" as a stance name that communicates the
> mechanic directly. The fantasy — patient rhythmic buildup into a devastating release —
> is the constant; the pose is flexible.

---

## 5. Spirit → Stance summary

| Spirit | Style | Starting Stance | Fantasy |
|---|---|---|---|
| Shredding Ronin | Shred | **Soloist** | Technical brilliance weaponized; exposed to brawlers |
| Metalness Monster | Shred | **Power** | Mutual destruction; wrecks your chord, doesn't care about his own |
| Glamarchy | Flair | **Cool** | Untouchable; chord holds under pressure; builds loyal fans |
| Intergalactic 0 | Groove | **Groove** | Patient zoner; builds momentum, devastating when it lands |

Each spirit can **learn** the other three stances through the skill tree (see §6).
Switching stances costs an action (not a full turn — you can still move, but you can't
attack on the turn you switch). This makes the choice sticky enough to matter but not
permanent.

---

## 6. Stances on the skill tree

The CQC route (`id: 'cqc'`) is replaced by a **Stance** route. Structure:

```
── Stance Route ──────────────────────────────────────────────
│
├─ Tier 1: Learn a second stance              (8 HC)
│    Pick any stance you don't already have.
│
├─ Tier 2: Learn a third stance               (12 HC)
│    Pick any stance you don't already have.
│
├─ Tier 3: Learn the fourth stance            (16 HC)
│    The last remaining stance.
│
└─ Upgrades (branching from each learned stance):
     Each stance has 1–2 upgrades that deepen its identity.
     Upgrades require owning the stance + a prereq tier.
```

### 6.1 Stance upgrades

Upgrades are small, focused enhancements — not new systems. Each deepens the stance's
existing mechanic.

**Soloist upgrades:**

- **Encore** (prereq: Soloist + Tier 1, 10 HC): When your P score is ≥ 7 on the attack
  that earns Fame, earn +1 Diehard fan (normally only Casuals from combat). The showman
  converts spectacle into loyalty.

**Power upgrades:**

- **Demolition** (prereq: Power + Tier 1, 10 HC): When a Power-stance Thrash hits fray
  the opponent's chord below 2 notes (effectively destroying their voicing), the
  destroyed chord's Drive is added as bonus Vibe damage. Reward for total destruction.
- **Aftershock** (prereq: Power + Tier 2, 14 HC): Lost Chord tokens scattered by your
  Thrash hits land 1 hex further from the defender. Board control through violence.

**Cool upgrades:**

- **Ironclad** (prereq: Cool + Tier 1, 10 HC): When a hit would fray your chord but the
  halved-fray rounds to 0 (margin ≤ 2), gain +1 temp Sustain until your next turn. You
  didn't just survive — you hardened.
- **Riposte** (prereq: Cool + Tier 2, 14 HC): When you successfully defend a Thrash
  attack (attacker lost), your next Thrash against that same opponent frays +1 extra
  note. The patient read into a punishing counter.

**Groove upgrades:**

- **Resonance** (prereq: Groove + Tier 1, 10 HC): Groove counter cap increases from 3
  to 5. The wave builds higher.
- **Sustain Wave** (prereq: Groove + Tier 2, 14 HC): When you spend your Groove counter
  on an attack, the counter value also adds to your Sustain for the defender's immediate
  retaliation (if any). The wave protects you on the backswing.

---

## 7. Interaction with existing systems

### 7.1 The Smash

Unchanged. The Smash bypasses Sustain entirely — it's the anti-turtle, and stances don't
block it. A Soloist or Cool player sitting behind a fat chord wall still gets Smashed.
This is intentional: stance advantages are combat advantages, not invulnerability.

Power stance has a natural affinity with the Smash (aggressive identity), but the Smash
doesn't get stance bonuses — it's raw stock, not chord-delivered. This keeps the Smash
as the primal, stance-independent channel it was designed to be.

### 7.2 Dissonance Edge

The Edge trades Sustain for Drive (ending on a Discord note). Stances interact:

- **Soloist + Edge:** Dangerous combo. The Edge's +Drive stacks with P-score Drive bonus.
  But the Edge's −Sustain *plus* Soloist's doubled fray makes you extremely fragile.
  High-risk, high-reward showmanship.
- **Power + Edge:** Double aggression. Extra fray on hits + Edge Drive bonus = maximum
  destruction potential, but your own chord is being eaten from both ends (your own
  increased fray + the Edge's Sustain penalty).
- **Cool + Edge:** The stabilizer. Cool's halved fray partially offsets the Edge's
  Sustain penalty. This is the "controlled dissonance" playstyle — riding the Edge
  without collapsing because your chord holds together.
- **Groove + Edge:** Tension. The Edge wants you to resolve within 2 turns; Groove wants
  you to hold still and build the counter. These pull in opposite directions unless you
  time it so the Groove counter peaks on the same turn you resolve the Edge — then you
  get the Edge resolve HC bonus AND the Groove-powered attack. Hard to execute, massive
  payoff.

### 7.3 Riff-offs

Stances apply their Fame modifier to riff-off FP awards. Soloist's ×1.5 makes riff-off
victories more valuable for Fame; Groove's counter adds to riff-off Fame if it was built
up before the riff-off triggered. Power and Cool have no riff-off modifier (flat).

Stances do NOT modify the riff-off's timing/performance mechanics — those stay pure
skill.

### 7.4 Chord table (`evaluateChord`)

Untouched. The chord table is the spine. Stances modify the *output* of the table
(how Drive/Sustain are used), not the table itself.

### 7.5 Charge Zones

If Charge Zones survive the system audit (see §8), stance interaction is minimal —
Charge Zones modify die size/floor, stances modify chord translation. They're
orthogonal. If Charge Zones are cut, their board-objective role could be partially
absorbed by Lost Chord token density (already scattered by Thrash hits).

---

## 8. What gets cut (full list)

| System | Reason |
|---|---|
| **CQC skill branch** (shank_skank, cosmic_boogaloo, moon_shuffle) | Replaced by Stance route |
| **CQC status effects** (slip, trip, dazed, drop, confused) | %-proc system from a different game; no musical connection |
| **Guaranteed-proc mechanic** (`rollSwingEffects`, `applySwingEffects`) | Entire subsystem removed with the status effects |
| **`getCQCChances` / `SWING_FX_INFO` / `SWING_EFFECT_CHANCES`** | Implementation of the above |
| **Junkyard Dog** (+2 flat swing bonus) | Modifier soup; flat bonus with no musical connection |
| **Psycho Bushido** (force die to 1) | Relocate to Ronin Signature if kept; remove from universal tree |
| **Fandom Army** (+2 Sustain for next battle) | Modifier soup; Cool stance now fills the "durable defense" role |
| **Counter/retaliation system** (Phase 3d, `applyCounterRolled`, `counterOutcome`) | Replaced by natural Thrash adjacency retaliation (§3) |
| **`retaliationTimer` state** | No longer needed |
| **`ownsCQC()` gating function** | No CQC branch to gate behind |
| **Mod Cards** (Chromatic Shift, Overdrive, Transpose) | Theory ladder already handles rescuing bad tracks (per DESIGN_AUDIT_v2 §5) |

### 8.1 What stays in Crew

Crew route keeps `fans_4eva` (Vibe heal) and `pranksta` (disconnect rival amps) — these
are deployable, cooldown-gated abilities with clear identities that don't overlap with
stances. `junkyard_dog` and `fandom_army` are cut (modifier soup).

---

## 9. Revised skill tree (post-stance)

```
── Music Theory (spine) ───────────────────────────────
  Full Scale → Minor → Blues/Dom7 → Modal → Chromatic

── Electric (rig) ─────────────────────────────────────
  Amp I → Amp II → Roadie → Amp III
                 └→ Overcharge

── Stances (combat/performance identity) ──────────────
  Learn Stance 2 → Learn Stance 3 → Learn Stance 4
       └→ Stance upgrades (1–2 per stance owned)

── Crew (deployables) ─────────────────────────────────
  Fans 4Eva    (heal)
  Pranksta     (disconnect amps)

── Signature (per-spirit, exclusive) ──────────────────
  Ronin:          Psycho Bushido · E-Rush · Hydra
  Monster:        Master of Moshpits · Riff Slayer · Paranoia · Azrael
  Intergalactic:  Blaster of Ra · Displace · Sunbeam
  Glamarchy:      (still needs a signature — OPEN)
```

Four routes down from six (Theory, Electric, Stances, Crew) plus per-spirit Signatures.
Cleaner, less overlap, every route has a distinct identity.

---

## 10. Open questions

> ✅ RESOLVED 2026-07-16 (implementation session) — #4 and #5 were decided and
> are now coded; see §12 for every locked decision. Still open: #1, #2, #3, #6.

1. **Glamarchy's Signature arsenal.** Still missing. Should reflect Flair identity —
   perhaps abilities around fan manipulation, performance scoring, or styled movement.

2. **Intergalactic 0's stance name.** Shipped under the working name **"Groove"**
   (pose string still "Behind the Back"). Rename is a one-line change in
   `data/stances.js` (`STANCE_DEFS.groove`).

3. **Charge Zones.** Keep, fold into amp proximity, or cut? They add a board objective
   but overlap with the chord system's positioning incentives. If kept, interaction with
   stances is minimal (orthogonal modifier on dice, not chord translation).

4. ~~**Stance switching cost.**~~ **DECIDED: costs your action** — you can still
   move, you can't attack the turn you switch. Coded in `Game.switchStance`
   (consumes the Action Token via `beatsSpent(0, true)`).

5. ~~**Groove counter and multiplayer.**~~ **DECIDED: only chord fray resets the
   counter** (plus your own attack/revoice). Hits that don't fray don't touch it —
   the 4-player dogpile can't shut Groove down by tapping. Coded in
   `applyChordFray`.

6. **Dissonance Edge + stances: too many modifiers?** The Edge already modifies
   Drive/Sustain via `edgeStage`. Stances also modify chord translation. Both feeding
   into the same combat roll could recreate the modifier soup being cut. Monitor during
   playtest — if the math gets opaque, consider making the Edge and stances
   mutually exclusive (you can't ride the Edge while in a stance that modifies combat
   stats, only while in a "neutral" stance).

---

## 11. Implementation seams

The existing code already has clean seams for this work:

- **`evaluateChord(noteSet)`** → unchanged, still returns `{ name, drive, sustain }`.
- **`atkStat` / `defStat` assembly** (lines ~6140–6161 of `Game`) → the stance modifier
  inserts here, after chord lookup and before dice roll. One new term in the sum.
- **Chord fray** (lines ~6147–6151 of `Game`) → stance modifies the fray amount. One
  conditional branch.
- **Fame award** (`awardSonicFame`, `awardThrashFame`) → stance multiplier on the FP
  value. One multiplication.
- **Skill tree** (`SKILL_TREE.routes`) → replace the `cqc` route object with the Stance
  route. Same data shape.
- **`rollSwingEffects` / `applySwingEffects` / `getCQCChances`** → delete entirely.
- **`SWING_FX_INFO` / `SWING_EFFECT_CHANCES`** → delete.
- **Bot policy** (`bot.js`) → replace CQC skill references with stance selection logic.
  Bots pick a stance matching their persona (`combat` → Power, `clean` → Cool, etc.).

New state needed: `stance: string` on each spirit (one of `'soloist'|'power'|'cool'|'groove'`),
`grooveCounter: number` (for Groove stance, 0–3 or 0–5 with upgrade), and
`stanceUpgrades: string[]` (list of unlocked stance upgrades).

---

## 12. ✅ IMPLEMENTED (2026-07-16) — status + locked decisions

The system above is CODED. Everything in §8's cut list is gone (one survivor:
the starter Transpose one-shot was kept as a beginner mercy — the rest of the
Mod Card system is cut). Tuning data + pure stance math live in
`data/stances.js`; per-spirit state (`stance`, `stancesKnown`, `grooveCounter`)
lives on the engine-owned note sheet (`makeInitialNoteState`). Upgrades are
plain skills in `unlockedSkills` (ids `stance_*`) — no separate
`stanceUpgrades` array was needed.

**Decisions locked during implementation** (design dialogue, 2026-07-15/16):

| Question | Decision |
|---|---|
| Switch cost (§10.4) | Your **Action** — move yes, attack no. |
| Groove reset (§10.5) | **Only chord fray** (plus own attack / revoice). Untouched by no-fray hits. |
| Groove build timing | +1 at end of a turn where you used **no Action and no revoice** (attack turns don't build). |
| Soloist Drive bonus | **⌈P/2⌉**, not full P (comparable to Edge/Groove magnitudes; §4.1 amended). |
| Soloist Fame ×1.5 | Applied in `grantFame` (all sources), **before** the crowd multiplier. |
| Chord fray model | **Post-roll, hits only, margin-scaled**: 1 note on margin ≤ 2, 2 on ≥ 3, floored at 1 note remaining. Replaces the old pre-roll unconditional 1-note fray. Stance mods per `stanceFrayAmount`. |
| Cool Diehard conversion | Centre-streak promote every **2** turns (base 3); perf loyalty **16**/Diehard (base 24). |
| Power Sonic | +1 Vibe on a hit, cap `SONIC_VIBE_CAP + 1 = 3`. |
| Stance name (§10.2) | Shipping as **"Groove"** for now; pose string stays "Behind the Back". |
| Learning tiers | `stance_2/3/4` skills; humans pick via modal, bots via `BOT_STANCE_PREF`. |
| Upgrade gating | `requiresStance` field on the skill + `skillEligibility` check; effects only fire while **in** the stance. |

**Skill ids:** `stance_2/3/4`, `stance_encore`, `stance_demolition`,
`stance_aftershock`, `stance_ironclad`, `stance_riposte`, `stance_resonance`,
`stance_sustainwave`.

**⚖️ Balance pass (2026-07-16, after first playtest):** a "6+6" attack line
prompted an audit of stacked bonuses. Changes:
- **Soloist subsumes the track Drive boost** — ⌈P/2⌉ and `tempDrive` both come
  from the same commit, so the Soloist bonus now only counts what EXCEEDS
  `tempDrive` (one great commit pays once, not twice).
- **`ATK_BONUS_CAP = 5`** (gameConstants) — hard ceiling on
  `tempDrive + Edge + stance` for both attack types (was theoretically +10).
- **Demolition capped at `THRASH_DAMAGE_CAP`** (+4 max bonus, was uncapped).
- **`ROCK_GOD_RUNAWAY_LEAD` 5 → 3** — the boss finale is for close races only;
  plus a stale-fame-read bug in the runaway check was fixed (it compared the
  lead using a client mirror that lagged the engine by a grant or more).

**⚠️ Playtest watchlist:**
- Soloist + Edge stacking (§7.2) and the §10.6 modifier-soup concern.
- Riposte persists until spent (no expiry) — watch for stale armed reads.
- Sustain Wave banks as `tempSustain` (max, not add), which survives until the
  next defended battle clears it — slightly longer than "immediate retaliation."
