# Style System — Implementation Handoff

Supersedes `STANCE_V2_HANDOFF.md` and `STANCE_SYSTEM_DESIGN.md`. **Stances are CUT in full.**
The nine stance abilities are preserved in `STANCE_PARTS_BIN.md` as a menu for the Spirit
redraw — they are not live game content.

Design decisions below are LOCKED (design session 2026-07-28) unless marked ⚠️ TUNABLE.

---

## 1. The change

Stances were a second identity layer sitting parallel to the `style` field that already
exists on every spirit in `data/spirits.js`. They failed intuitiveness testing — "how you
stand" is not how players identify a character. The layers collapse into one.

**Styles do exactly one job: they dictate how a Spirit most effectively earns Db.**

Styles grant **no** abilities, **no** passives, **no** specials, and **no** stat modifiers.
Combat identity moves entirely to per-Spirit innates and Signature arsenals (the redraw).

| Style | Earns Db by | Musical fantasy |
|---|---|---|
| **Shred** | Long directional runs — steps, 3rds, 4ths, up or down, with peaks and valleys | Velocity and reach |
| **Groove** | Repetition — repeated notes, repeated cells, resolution to the root | The pocket, the riff |
| **Flair** | Intentional flavor — out-of-scale (discord) notes that *resolve* | Spectacle, risk |

Style is **fixed per Spirit**, read directly from `SPIRIT_DEFS[id].style`. There is no
`STARTING_STYLE` table, no switching, no learning route. Current roster:

| Spirit | Style |
|---|---|
| Shredding Ronin (`cosmic_ronin`) | Shred |
| Metalness Monster (`Metalness_Monster`) | Shred |
| Intergalactic 0 (`intergalactic_0`) | Groove |
| Glamarchy (`Glamarchy`) | Flair |

Two Shred spirits is acceptable and intentional: Style is the *earning lane*, not the
character. Ronin and Metalness will diverge through innates and arsenals.

---

## 2. What gets CUT

From `data/stances.js` (delete the file), the engine, the UI, and `rlsw-simulator-v3_8_1.jsx`:

- `STANCE_DEFS`, `STARTING_STANCE`, `stanceOf`, `stanceKit`, `STANCE_PHYSICAL_SKILL`,
  `STANCE_SONIC_SKILL`. **Keep `stanceFrayAmount`** — it is stance-neutral margin math;
  move it verbatim to `engine/systems/combat.js` and rename to `chordFrayAmount`.
- All nine stance abilities and their action-bar buttons: Hammer-On, Pinch Harmonic, Bend,
  Rake, Power Chord, Slide, Axe Swing, Gallop, Thrash-finisher. The **generic Smash button
  returns** in the finisher slot (restore `resolveSmash` / `smashOutcome` as the universal
  2-AP finisher, full Smash DNA: hurl unused stock, root, Exposed).
- All three passives: Pull-Off (`pullOffKnockback`, `extraKnockback`), Feedback
  (`feedbackRetaliation`, `zeroDamageRetaliation`), Headbang (`headbangFanOverrides`,
  `promoteEvery`/`loyaltyPerDiehard` overrides — fan conversion returns to base
  `FAN_PROMOTE_EVERY` 3 / `LOYALTY_PER_DIEHARD` 24).
- Skills `stance_physical`, `stance_sonic`, `stance_passive_up` from `SKILL_TREE.routes`
  (~line 519 of the jsx), their `skillEligibility` handling (~line 599–612), and their
  `UpgradeModal.jsx` description overrides (~line 10–24).
- `detectCommitGenerator`, `detectTrill`, `detectChug`, `detectDiveBomb`, `STANCE_COMMIT_DB`,
  and `spendDb` — Db is no longer spent on specials, only banked toward upgrades.
- **Dead v1 leftovers found in audit:** `ns.stancesKnown` and `sk.requiresStance` gating in
  `UpgradeModal.jsx` (lines ~35, 45, 253, 292) — these reference state that no longer exists.
  `chain.stanceId` in the same file. Remove all of it.
- `BOT_DB_SPEND_THRESHOLD` and the bot's special-attack spending logic in
  `engine/policies/bot.js` (~line 45–46 priority list, ~line 8103 in the jsx).
- Blaster of Ra reverts to replacing **Smash** for Intergalactic 0 (its original wiring).

**Untouched:** the chord spine (`evaluateChord`), Drive/Sustain stack split, Theory/Electric/
Crew/Signature routes, Thrash/Sonic delivery physics, fan economy, riff-offs, amps/rig,
`scoreTrackDB` (Layer-1 Db earning stays exactly as-is — Style pays *on top* of it),
`driveBoostFromRun` / `sustainBoostFromPattern` and their overflow-to-Db behavior.

---

## 3. The Db payout model

Style Db is granted **once per commit**, in `confirmNoteTrack`, after all existing scoring.
It is additive on top of `scoreTrackDB` and the Drive/Sustain overflow.

Every style scores the same shape: a **tier** (1–3 Db) from the primary pattern, plus a
**signature bonus** (+1 Db) for the style's mastery flourish, capped by `STYLE_DB_CAP`.

```
STYLE_DB_CAP = 3      ⚠️ TUNABLE (DB_UPGRADE_THRESHOLD is 6, so cap 3 = two perfect
                         commits per upgrade; raise to 4 only if progression feels slow)
```

### 3.1 SHRED — the run

Qualifying run = 3+ consecutive notes moving in **one consistent direction** through the
scale by a **consistent interval class**: 1 (step), 2 (3rd), or 3 (4th). Out-of-scale notes
break a run. This generalizes the existing `detectDiatonicRun` (interval 1) and
`detectSkipClimb` (interval 2) into one detector — **keep both originals**, they still feed
the Drive boost; the new one is additive and Shred-only.

| Longest run length | Db |
|---|---|
| 3–4 | +1 |
| 5–6 | +2 |
| 7+ | +3 |

**Signature bonus (+1): the contour turn.** The melody contains two qualifying runs in
*opposite* directions (up-then-down or down-then-up), each ≥ 3 notes long. They may share
the pivot note. This is the "up the neck and back down" shred phrase.

### 3.2 GROOVE — the pattern

Qualifying pattern is the longest of:

- **Repeated note** — 3+ identical notes in a row (existing `detectRepeatPattern` case A)
- **Alternating pair** — A-B-A-B, 4+ notes (existing case B)
- **Repeated cell** — a 2-to-4-note cell repeated 2+ times consecutively, e.g. C-E-G-C-E-G
  (**new**). Pattern length = total notes covered by the repetition.

All notes in the pattern must be in scale.

| Longest pattern length | Db |
|---|---|
| 3–4 | +1 |
| 5–6 | +2 |
| 7+ | +3 |

**Signature bonus (+1): the resolution.** The committed melody's **final note is the root**.
This is the pocket closing — the riff comes home.

### 3.3 FLAIR — the flavor

A **resolved discord** is an out-of-scale note (not in `currentScale`) that is immediately
followed by an in-scale note. Discord as the final note of a commit does **not** count —
flavor must land somewhere. Unresolved/trailing discords score nothing and still carry
their normal Performance Score penalty.

| Resolved discords | Db |
|---|---|
| 1 | +1 |
| 2 | +2 |
| 3+ | +3 |

**Signature bonus (+1): the chromatic approach.** A resolved discord that resolves by a
**half step** (1 semitone, either direction) into its following in-scale note — the classic
chromatic passing/leading tone. Scores once regardless of how many qualify.

**Crowd-penalty interaction (important).** `performanceScore` currently subtracts
`perfDiscord` for every out-of-scale note, so Flair would earn Db while losing the crowd.
Fix: pass a `resolvedDiscordCount` into `performanceScore` and exempt **Flair spirits only**
from the P penalty on *resolved* discords, capped at 3 ⚠️ TUNABLE. Unresolved discord still
hurts everyone. This is the same shape as Intergalactic 0's existing `freestylePardon` — and
the two must stack correctly (Zero is Groove, so no overlap today, but keep them independent).

---

## 4. API contract

Both work streams code against these exact signatures.

**`src/data/styles.js`** (new — replaces `data/stances.js`)

```js
export const STYLE_DEFS = {
  Shred: { id:'Shred', label:'Shred', icon:'⚡', color:'#4488ff',
           tagline:'Fast, far, and never twice.',
           earnDesc:'Long directional runs — steps, 3rds or 4ths, up or down.',
           bonusDesc:'Contour turn: a run up AND a run back down.' },
  Groove:{ id:'Groove', label:'Groove', icon:'🔁', color:'#aa55ff',
           tagline:'Say it again. Mean it more.',
           earnDesc:'Repeated notes, alternating pairs, repeated cells.',
           bonusDesc:'Resolution: land the last note on the root.' },
  Flair: { id:'Flair', label:'Flair', icon:'✨', color:'#ff6600',
           tagline:'The wrong note, on purpose.',
           earnDesc:'Out-of-scale notes that resolve back into the scale.',
           bonusDesc:'Chromatic approach: resolve by a half step.' },
};

/** A spirit's style — read straight off the spirit sheet. Falls back to 'Groove'. */
export function styleOf(spiritId): 'Shred'|'Groove'|'Flair'

/** Full style definition for a spirit. */
export function styleDef(spiritId): object
```

**`src/music/cadence.js`** (new pure detectors, alongside the existing ones)

```js
/** Longest run of consistent-direction, consistent-interval-class motion through
 *  the scale. intervals defaults to [1,2,3] (step, 3rd, 4th). Min length 3. */
export function detectStyleRun(track, currentScale, intervals = [1,2,3]): number

/** True if the track contains two qualifying runs (≥3) in OPPOSITE directions.
 *  They may share a pivot note. */
export function detectContourTurn(track, currentScale, intervals = [1,2,3]): boolean

/** Longest span covered by a 2-to-4-note cell repeated 2+ times consecutively.
 *  All notes must be in scale. Returns 0 if none. */
export function detectCellRepeat(track, currentScale): number

/** Out-of-scale notes immediately followed by an in-scale note.
 *  Returns { count, chromatic } where chromatic is true if any resolves by 1 semitone. */
export function detectResolvedDiscords(track, currentScale): { count:number, chromatic:boolean }
```

**`src/engine/systems/economy.js`** (replaces `detectCommitGenerator`)

```js
/** Style Db payout for one commit. Pure — no state, no rng.
 *  Returns { db, tier, bonus, label, detail } — db already clamped to STYLE_DB_CAP.
 *  Returns { db:0, ... } when nothing qualifies. `label` is the log/flash headline
 *  (e.g. 'SHRED RUN', 'GROOVE LOCK', 'FLAIR'). */
export function styleCommitDb({ style, track, currentScale, rootNote }): {
  db: number, tier: number, bonus: number, label: string, detail: string
}
```

**Call site** — `confirmNoteTrack` in `rlsw-simulator-v3_8_1.jsx` (~line 2981, where the
stance commit-generator block currently sits). Replace that block with a `styleCommitDb`
call using `acting.style`, `melodyLine`, `currentScale`, `newRootRaw`; add `db` to
`newDBPoints`; log and `triggerEffectFlash` with the style's icon and color.

---

## 5. UI surface

- Spirit select / HUD: show the Style badge (icon + label + `tagline`) where the stance
  chip used to render (~line 11897 of the jsx).
- Commit log line: `⚡ SHRED RUN ×6 — +2 Db!` / `🔁 GROOVE LOCK ×4 + root — +2 Db!` /
  `✨ FLAIR ×2 chromatic — +3 Db!` Effect flash uses `STYLE_DEFS[style].color`.
- Note-track UI: a one-line "how you earn" hint from `earnDesc`, visible while building the
  melody. This is the intuitiveness fix — the player should never have to guess their lane.
- Action bar returns to: ⚔️ Swing (1 AP) · 🔊 Sonic (2 AP) · 💥 Smash (2 AP). Three buttons.

---

## 6. Acceptance checklist

- [ ] `data/stances.js` deleted; no `stance*` identifier remains outside `STANCE_PARTS_BIN.md`
- [ ] `chordFrayAmount` preserved in `combat.js` with identical margin math (≤2 → 1, ≥3 → 2)
- [ ] Smash restored as the universal finisher; Blaster of Ra replaces it for Zero
- [ ] Fan conversion back to base rates (no Headbang override)
- [ ] Dead `stancesKnown` / `requiresStance` / `chain.stanceId` gone from `UpgradeModal.jsx`
- [ ] Four new detectors pure and unit-tested in `engine/selftest.mjs`
- [ ] `styleCommitDb` tested for all 3 styles: tier boundaries (3/4/5/6/7 notes), signature
      bonus on and off, cap enforcement, and the zero case
- [ ] Flair spirits exempt from P penalty on resolved discords; unresolved still penalized
- [ ] Style badge + earn hint visible in UI; commit log and flash fire per style
- [ ] `node src/engine/selftest.mjs` passes; `npm run build` clean; bots still commit and fight
