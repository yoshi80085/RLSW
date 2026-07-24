# LEGEND LESSONS HANDOFF — 🎸 sound like the greats

> **For AI editors + Alex.** Design plan for a third practice pillar: guided
> lessons that teach you to SOUND LIKE a famous guitarist — tone, note
> palette, and signature moves. Written 2026-07-24. Nothing below is coded.
> Companion to `PRACTICE_MODES_HANDOFF.md` (Recon + Discord Coach — read its
> §0 rulings first; they all apply here) and `audio/ampVoice.js`
> (`SPIRIT_TONES` is the seed of this idea).

---

## 0. Rulings

1. **All of `PRACTICE_MODES_HANDOFF.md` §0 applies.** Skill, never currency.
   Real game systems, no imitations. Engine untouched.
2. **⚠️ IP ruling — no real guitarist names or likenesses.** "Sound like
   Hendrix" is the pitch, not the product. Ship in-world LEGENDS whose styles
   are *unmistakably inspired by* real players (style is not protectable;
   names/likenesses are). Inspirations are documented here for the design's
   sake and never appear in-game.
3. **A style is three things the game can actually hear:** a TONE (amp
   knobs), a PALETTE (pitch-class sets over a chord bed), and MOVES
   (detectable phrase patterns). If a signature trait can't be detected from
   tap history — bends, vibrato, pick squeals — it is *flavor text only*,
   never graded.

---

## 1. The Legend roster (v1 = first three)

Each legend is pure data (§4): a tone preset, a bed, a palette, 2–3 moves,
and coach lines. Inspirations in *italics* — design reference only.

| # | Legend | *Inspired by* | TONE (drive/tone/echo/verb/voice) | Bed | Palette + star spice | Signature MOVES (detectable) |
|---|---|---|---|---|---|---|
| 1 | 🌀 **VOODOO COMET** | *Hendrix* | .70/.45/.35/.30/fuzz | E dom7♯9 | minor pent + blues ♭5; star = **♯9** | DOUBLE-STOP: two taps < 150ms apart on adjacent strings; SLIDE-IN: chromatic approach from below into the 3rd |
| 2 | 🐍 **DORIAN SERPENT** | *Santana* | .55/.40/.30/.45/triangle | A min7 vamp | Dorian; star = **natural 6** | SUSTAIN SINGER: sparse density (≤ 20 notes/min) with ≥ 70% chord/color; THE GLOW: nat-6 resolved by step |
| 3 | 🌑 **IRON RIFFLORD** | *Iommi* | .85/.25/.15/.10/fuzz | E5 drone, low | minor pent + **tritone as home** | THE LOOP: same 3–4 pc cycle repeated ≥ 3× ; DOOM STEP: tritone → 5th resolution |
| 4 | 🌕 **MOONLIT ARCHITECT** | *Gilmour* | .30/.35/.60/.65/sine | Dm slow arc | natural minor; star = **9th** | SPACE: ≥ 1.5s gaps between phrases; FOUR-NOTE PRAYER: ≤ 4-note stepwise phrase ending on a chord tone |
| 5 | ⚡ **LIGHTNING TAPPER** | *Van Halen* | .65/.60/.40/.20/square | A maj vamp | major pent + chromatic runs | WIDE ARP: ≥ 3 consecutive leaps ≥ 4 semitones, all chord tones; BURST: ≥ 5 notes < 200ms apart |
| 6 | 👑 **ONE-NOTE ORACLE** | *B.B. King* | .40/.55/.20/.25/sine | B♭ dom7 | major/minor blend (both 3rds legal) | ECONOMY: score ∝ style-fit ÷ note count; THE ANSWER: 2–3 note reply after a bed strum |

Roster note: legends 1–3 ship v1 (fuzz/mellow/doom — maximum contrast);
4–6 are specced so the data shape is proven against them.

---

## 2. Lesson loop — RIG → ECHO → STEAL

One lesson = one legend, three phases, ~5 min. Reuses `FretboardFull`, the
Discord Coach bed scheduler, and the tone panel. No new synth code.

### 2.1 Phase RIG — dial the sound (~1 min)

The coach auditions the legend's tone on a reference lick (scheduled via
`opts.when`). Player gets the tone panel and the same lick on demand; goal is
to match by EAR. Match = every knob within ±0.12 of target and same voice.
Knobs deliberately unlabeled with the answer — "chase the sound, not the
numbers." SKIP button after two failed audits applies the preset (learning
tone-dialing is the point, gating is not).

### 2.2 Phase ECHO — steal the lick (~2 min)

Coach plays 2–3 signature licks (4–6 notes each) through the legend rig,
flashing each cell as it sounds. Player replays. **Graded on pitch-class
sequence only — free time, order not rhythm** (same ruling as Discord Coach:
rhythm pressure is the highway's job). 2 of 3 licks correct → phase clear.
Licks are authored per legend in the data module — the ONLY hand-authored
musical content in the mode.

### 2.3 Phase STEAL — make it yours (~2 min, the payoff)

Free play over the legend's bed — Discord Coach's exact frame (bed +
layered neck + classifier), but the coach now grades STYLE FIT:

| Component | Weight | Source |
|---|---|---|
| Palette fit — % of notes in legend palette | 40% | `paletteFit(hist)` |
| Signature moves — count of detected MOVES | 40% | per-legend detectors §4 |
| Phrasing stat — legend-specific (density / space / bursts) | 20% | `phraseStats(hist)` |

Live STYLE METER (0–100%) in the HUD. Coach lines fire on detected moves:
*"THAT double-stop — the Comet grins."* Session card: **STYLE MATCH %**,
moves landed, best phrase (its pc line named via `evaluateChord`, same
reward-line trick as Discord Coach §4.7).

### 2.4 Progression

Medal per legend at ≥ 70% style match (`rlsw.practice.legends`). Legends
unlock in roster order by *playing* (not medaling) the previous one — taste
everything, master what you love. No currency, ever.

---

## 3. Where it lives

Fourth lobby card: **🎸 LEGEND LESSONS** → legend picker (locked legends
show silhouette + one-line style tease) → RIG → ECHO → STEAL → card.
`practiceMode` gains `{ mode: 'legend', legendId }`. ESC exits anywhere;
bed cleanup on unmount (same pattern as `DiscordCoach.jsx`).

---

## 4. Files + build notes

- **`music/styles.js` (new, PURE — the whole brain).**
  - `LEGENDS` — array of `{ id, name, emoji, tease, tone, bed: { rootPc,
    chordId, mode, spacingMs }, palette(rootPc) → Set<pc>, starSpice,
    licks: pc[][], moves: MoveDef[], phraseStat, coachLines }`.
  - Detection primitives (all pure, all over the same `{ pc, time }` history
    Discord Coach already keeps): `paletteFit`, `detectMoves`, `phraseStats`
    (density, gap lengths, burst runs, repetition cycles, leap sizes),
    `toneMatch(knobs, target, tol)`.
  - Unit-test in `engine/selftest.mjs`: cycle detection (THE LOOP), burst
    boundaries, double-stop timing window, tone-match tolerance edges.
- **`ui/LegendLessons.jsx` (new)** — phase state machine, legend picker,
  style meter, session card. Bed via `playAmpNote` with `opts.when`
  scheduling + the ambient options (`attackTime`, low `volume`, `knobs`)
  added 2026-07-24 — note `playAmpNote` takes `{ holdTime, fadeTime,
  volume, attackTime, knobs }`; knobs do NOT go top-level.
- Lick playback: schedule on the audio clock, flash cells via the existing
  `flash` prop; playback speed slow (~600ms/note) — this is show-me, not
  a rhythm test.
- `SPIRIT_TONES` stays untouched; legend tones are their own presets. (Open
  Q for Alex: should medaling a legend add their tone to the rig picker
  cycle? Leaning yes — it's a trophy that is also a tool, and it's not
  currency.)

### Build order

| Phase | Deliverable |
|---|---|
| L1 | `music/styles.js` + selftest (pure, no UI) |
| L2 | RIG + ECHO phases (tone match, lick playback/grade) |
| L3 | STEAL phase (style meter over the Discord Coach frame) + card + lobby hookup |
| L4 | Legends 4–6 (data-only if §4's shapes held) |

---

## 5. STICs + Earned

| Lens | Verdict |
|---|---|
| Simple | ✓ three phases, one meter |
| Thematic | ✓✓ becoming your heroes is THE guitarist fantasy |
| Intuitive | ✓✓ hear the tone, copy the lick, feel the meter move |
| Coherent | ✓✓ amp, neck, chord brain, classifier, coach-line grammar — all existing organs |
| Earned | ✓✓ pays out taste + vocabulary; medals local; zero currency |

---

*Related reading: `PRACTICE_MODES_HANDOFF.md` (frame + rulings),
`audio/ampVoice.js` (`SPIRIT_TONES`, `TONE_VOICES`), `music/spice.js`
(classifier this mode extends), `DESIGN_AUDIT_v2.md` §9 (Edge — DOOM STEP
and THE GLOW are Edge resolves wearing legend clothes).*
