# CALL & ANSWER HANDOFF — the riff-off as a derivation puzzle

> **For AI editors + Alex.** Design + build record for the riff-off's fourth
> view, written 2026-08-06 from a design session. Marked ✅ where coded.
> Companion to `RIFFOFF_HANDOFF.md` (the duel), `GUITAR_NECK_HANDOFF.md` (the
> neck model) and `PRACTICE_MODES_HANDOFF.md` (the lobby harness). Read
> `ARCHITECTURE.md` §Design lenses (STICs + Earned) first.

---

## 0. The ruling that governs everything

**This mechanic generates nothing and judges nothing.**

`generateDefenderRiff` already produces the correct answer and the engine
already owns it. Call & Answer changes exactly one thing: **what the player is
told about each answer note.** The run, the judge (`|press − hitTime|` plus
correct key), the results array `[{hit, rt, grade, noteIdx}]` and the verdict
math in `engine/systems/riffOff.js` are untouched.

That is not a convenience — it is what keeps `RIFFOFF_HANDOFF.md` §0 intact.
Derive the note wrong and you press the wrong letter; the existing judge grades
it `wrong`. No new scoring surface means no new place for a skill, an item or a
stat to reach into the verdict.

**Corollary — the fairness floor.** A note may only be hidden if the player
could have worked it out. Anything underivable reveals at every tier, VIRTUOSO
included. A tier may make the game harder; it may never make it unfair. This is
asserted in `riff/callAnswer.test.mjs` §1 and will fail the suite if broken.

---

## 1. The problem this solves

The three existing views (🎹 piano, 🎸 falling-gem guitar, 🎯 neon neck) all ask
the same question: *can you find this note and hit it in time?* On a real guitar
that question is musicianship. On a keyboard it is a lookup table with a timer
on it — read "string 3, fret 4", convert to a note letter, press that letter.
Three mental steps to produce one input, none of them musical.

Rocksmith gets away with a fretboard because the fretboard **is** the
controller. We do not have that, and no amount of rendering polish fixes it —
it is not a rendering problem.

Meanwhile the duel already has a mechanic nobody is playing.
`generateDefenderRiff` does not invent an answer; it **transforms the call** by
a stated rule. Right now the defender is shown the result and asked to hit it.
State the rule and withhold the notes, and the defender's turn becomes what a
riff-off actually is: someone throws a lick, you work out the reply.

---

## 2. ✅ BUILT (2026-08-06)

### `riff/callAnswer.js` — the pure occlusion module

No React, no audio, no app state, no RNG. Reuses `RIFF_ANSWER_LABELS` and
`riffDegreesToNotes` from `riffGeneration.js` so the flavour text and the note
alphabet have exactly one source each.

| Export | Does |
|---|---|
| `ANSWER_OPS` / `answerRule(kind)` | The rule as the player is told it, plus its shape: `mirror` \| `shift` \| `keep` |
| `ANSWER_REVEAL` / `revealForTier(id)` | The occlusion policy per difficulty tier |
| `answerSlots(call, ans, kind, reveal)` | Per note: `callKey`, `ansKey`, `derivable`, `anchor`, `revealAt` |
| `slotRevealed(slot, p)` | Has this slot's letter appeared yet, at progress `p` |
| `ghostTrack(call, kind, ans)` | The derived line for the teaching overlay |
| `ruleText` / `shiftOf` | Rule-card copy, modulation interval |
| `answerReview` / `derivationScore` | Post-round teaching reveal + the "how much did you work out" stat |

`revealAt` is a **fraction of the note's own lead time**, not a millisecond
value. That is deliberate: it keeps the reveal correct under every difficulty
preset and under the 🐢 tempo dial without a second scaling path.

### The fairness floor, per answer kind

`generateDefenderRiff` is not uniformly derivable, and pretending otherwise
would be a taught-vs-coded mismatch (`DESIGN_AUDIT_v2.md` §2):

| Kind | Derivable? | Ruling |
|---|---|---|
| `inversion` | **All notes** | Every note follows from the root. Hides completely at VIRTUOSO. |
| `modulation` | All but note 0 | The shift is announced nowhere, so **note 0 is an ANCHOR** — always shown, at every tier. Hearing the new root is how a real player finds the key; everything after follows the contour. Excluded from the derivation score. |
| `variation` | All but the bends | Two notes are randomly bent, the rest are the call verbatim. The bent ones are underivable by construction, so they reveal late and wear a `BENT` tag. **That is the mechanic, not a concession** — play the call back and catch the bends. |
| `resolution` | The opening half | Indices `0..ceil(len/2)-1` are the call verbatim. The walk home is generated and cannot be predicted note-for-note, so it reveals. |

### The occlusion ladder

Rides the existing `RIFF_FALL_DIFFICULTY` tiers — one difficulty concept, not
two.

| Tier | `answerKey` | Call letters | Ghost track | Effect |
|---|---|---|---|---|
| 📱 INFLUENCER | `always` | on | on | Same as today, plus the rule is visible on screen |
| 🔥 GIGGING | `late` @ 0.55 | on | on | Derive it, or wait and react |
| ⚡ SHREDDER | `late` @ 0.80 | on | **off** | The rule is stated, not drawn |
| 🌟 VIRTUOSO | `never` | **off** | off | The call's shape and the rule name. Nothing else. |

Monotonicity — a later tier never reveals a note *earlier* than an easier one —
is asserted in the test suite (§7).

### `ui/CallAnswer.jsx` — the view

Deliberately shares no geometry with the neck views; this is not an instrument
simulation.

- **Rule card** — transform name plus a specific one-liner (`ruleText` prints
  the actual interval for modulation: "shifted +2 steps").
- **Call strip** — the call as a contour with an explicit dashed **ROOT line**,
  because that is what an inversion mirrors around. At the two lower tiers the
  derived line (`ghostTrack`) is drawn over it in magenta: *seeing* the mirror
  sit on the original is how the rule teaches itself, which is the Intuitive
  lens paid for in training wheels.
- **Answer conveyor** — cards travel right → left onto a strike marker.
  Horizontal on purpose: it reads as a tape, and it is instantly distinguishable
  from the three vertical/depth views.
- **The glyph rule is the whole mechanic.** Each card carries the ANSWER letter
  (what to press) over the CALL letter it derives from (dimmed). As the tier
  climbs the answer withdraws until only the source note is left and the rule is
  the only bridge across.
- **Letter keyboard** at the bottom — 7 naturals + 5 sharps, `onPointerDown` →
  `onPressKey`. This is the mouse path, replacing the neck's tap cells.
- Motion is one rAF loop reading `run.startedAt`, per the warning
  `RiffHighway.jsx` documents. The same loop owns the letter reveal, so reveal
  and motion cannot drift.

### Wiring — ✅ practice only, by design

- **`ui/RiffHighway.jsx`** — new optional `callAnswer` prop
  (`{ call, ans, kind, tier }`) and a `view === 'answer'` route. **Guarded**: a
  caller that hasn't been taught to supply the call falls back to the neon neck
  rather than rendering a broken puzzle. Every existing call site is unchanged.
- **`ui/RiffPractice.jsx`** — 🗣️ view button; `launchRiff` generates the
  call/answer **pair** and runs the defender's riff when the answer view is
  active (`viewRef`, because `launchRiff` fires from a timer). Everything
  downstream — voicing, timeline, judging, `riffStats` — is identical. A riff is
  a riff, whoever threw it.
- **`riff/callAnswer.test.mjs`** — 25 assertions over a 400-riff seeded corpus
  covering all four kinds. Run: `node src/riff/callAnswer.test.mjs`.
  **Re-run after touching `riffGeneration.js`** — the fairness rules here are
  assertions *about* `generateDefenderRiff`, so a change to how answers are
  built can silently make the occlusion unfair. §2 of the suite is the one that
  catches it: every slot marked derivable must be reproducible from the call by
  the rule we printed on screen.

---

## 3. STICs + Earned verdict

| Lens | Verdict | Notes |
|---|---|---|
| **S**implicity | ✓✓ | One sentence: *answer the lick*. Zero new resources, zero new HUD numbers, zero engine actions. The rule card states the whole rule. |
| **T**hematic | ✓✓✓ | The strongest in the game. This **is** a riff-off — call and response is the ritual the mode is named after, and until now it was flavour text on a generator. |
| **I**ntuitive | ~ | **The weak lens, stated deliberately.** "Mirror it around the root" is not guessable cold. Mitigated by: the ghost track at the two lower tiers (the rule drawn, not described), the ROOT line, the source note on every card, and the fairness floor. Needs a `LegendLessons` entry before it ships to the duel — see §4. |
| **C**oherent | ✓✓ | Consumes `defRiff` exactly as generated; reuses the difficulty ladder, the tempo dial, the judge and the results shape. The one new module is pure and tested against the generator it describes. |
| **Earned** | ✓✓✓ | Nothing bought, nothing rolled, no stat. The number traces to a musical operation the player performed in their head seconds earlier. `derivationScore` measures precisely that. |

Guardrail applied throughout: *does a different melody produce a different
experience?* Yes — the call is `melodyToRiff` output in a duel, so the melody
you committed on the board is the material your rival must derive from, and a
harder melody is a harder derivation for them. The thesis survives intact.

---

## 4. NOT BUILT — the duel wiring

Practice was the whole scope: it is the A/B harness, it touches no engine, and
`PRACTICE_MODES_HANDOFF.md` §0.3 already rules that practice modes stay
client-side. Taking this into a duel is the next phase and needs decisions, not
just code.

| Phase | Deliverable | Files |
|---|---|---|
| CA1 | `LegendLessons` entry teaching inversion + modulation. **Blocks duel rollout** — the Intuitive lens is unpaid until this exists. | `ui/LegendLessons.jsx` |
| CA2 | Add `'answer'` to the `riffView` picker + the `riffView` localStorage guard in the main file (`~L1362`) and `BattleMeterOverlay.jsx` (`~L691`). | main file, `ui/BattleMeterOverlay.jsx` |
| CA3 | Pass `callAnswer={{ call: battleState.atkRiff, ans: battleState.defRiff, kind: defRiff.kind, tier: riffDifficulty }}` on the **defender's turn only**. | `ui/BattleMeterOverlay.jsx` (`~L763`) |
| CA4 | The attacker's turn has no call to answer — decide what they see (§5 Q1). | main file |
| CA5 | Post-round teaching reveal on the result card using `answerReview` + `derivationScore`. | `ui/BattleMeterOverlay.jsx` |
| CA6 | Bot `botRiffResults` must model derivation failure, not just timing jitter — a bot at VIRTUOSO should occasionally answer *wrong*, not merely late. | main file |

---

## 5. Open questions

1. **What does the ATTACKER do in this view?** They throw the call; there is
   nothing to derive. Options: (a) they play their committed melody as written
   and only the defender gets the puzzle — asymmetric but *correct*, and it
   sharpens the R1 rehearsal edge (`RIFFOFF_HANDOFF.md` §2: you rehearsed
   yours, they sight-read it); (b) the attacker's own riff hides its letters
   too, on the grounds that you should know your own melody. **Leaning (a)** —
   the asymmetry is the fiction.
2. **Does the derivation score pay anything?** It must not touch the verdict
   (§0). Candidates: a Riffbook unlock, a practice medal, or a log line only.
   `derivationScore` is honest only at VIRTUOSO (`answerKey: 'never'`); at
   'late' tiers the run does not record what was on screen at press time, so
   treat it as difficulty-weighted accuracy, not proof.
3. **Multiplayer.** Same open question as `RIFFOFF_HANDOFF.md` §7.7 — the tier
   decides how much is hidden, so it must be room-level and engine-owned before
   netcode riff-offs, or one player derives while the other reads.
4. **Should `variation`'s bends be audible before they are visual?** Playing the
   bent note a beat early through `ampVoice.js` would let a good ear beat the
   reveal. Strongest version of the mechanic; needs an audio hook that does not
   exist yet.

---

## 6. Note on doc drift

`RIFFOFF_HANDOFF.md` §5 records Phase R4 (Acoustic Duel) as ✅ built, but
`engine/systems/riffOff.js` L86–87 states the tier was **cut** and every
riff-off is the plugged-in duel. The code is the truth; the handoff is stale.
Not touched here — flagging it so the next session doesn't build against §5.
