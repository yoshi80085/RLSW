# GUITAR NECK HANDOFF — the Full-Neck Riff-Off (Rocksmith pass)

> **For AI editors + Alex.** Design + build plan for reworking the riff-off's
> guitar view: all 6 strings, frets 0–12, riffs voiced in hand positions that
> move along the neck. Written 2026-07-24 from a design session. Read
> `ARCHITECTURE.md` §Design lenses (STICs + Earned) first, and
> `RIFFOFF_HANDOFF.md` §0 — its ruling still governs. All design decisions
> below are SETTLED (§2, §7); the remaining work is implementation (§4).
> The hard math is already built and tested (§3) — do not rewrite it.

---

## 0. Rulings that govern this build

1. **`RIFFOFF_HANDOFF.md` §0 is supreme.** Nothing here touches `riffStats`,
   grade windows, or verdict math. Voicing is presentation + input geometry.
2. **Pitch-true always.** The Guitar Hero abstraction (5 colored lanes, pitch
   deleted) was evaluated and **banned** — it kills R1's melody-as-riff thesis
   (verdict recorded in §7 so nobody re-proposes it). Every gem is a real
   pitch; every neck cell sounds its real note.
3. **Both duelists sight-read the same deterministic voicing.** `voiceRiff`
   has no RNG. Same riff → same positions, both clients, every time.
4. **Keyboard input is untouched.** `riffPressKey` judges pitch-class letters
   (a–g, Shift = sharp) and stays position-agnostic. The neck is display +
   touch. This preserves piano/guitar keyboard parity.
5. **The camera may move only at phrase boundaries** — never while a gem is
   within `leadTime` of the strike line. Anchors are per-phrase by
   construction, so violating this is always an implementation bug.

---

## 1. Why (design rationale, compact)

`melodyToRiff` octave-unwraps degrees to preserve melodic contour (G→A = +1,
not −6) — then the old first-position display threw the octave away, packed 7
naturals onto 4 strings (E/F and A/B/C shared lanes — unreadable with labels
off), left the B and high-e strings dead, and let string-strip taps
auto-resolve pitch (easier than piano — an Earned gap). The full-neck pass
fixes all four at once: **the contour you built is the motion your rival
watches.** Model: Rocksmith (string+fret display, position anchoring,
string-colored notes); RB3 Pro Guitar proved 6-string charting on a falling
highway; open-note bar shape from GH.

---

## 2. What's already built ✅ (do not rewrite)

### ✅ `riff/guitarMap.js` — pure module, no React/audio/state

| Export | Contract |
|---|---|
| `STRING_NAMES` `STRING_OPENS` | `['E','A','D','G','B','e']`, opens `[0,5,10,15,19,24]` (semitones above low E2) |
| `MAX_FRET` = 12, `WINDOW` = 4 | anchor window spans `fret..fret+4` (5 frets) |
| `degreePitch(deg, sharp)` | continuous riff degree → semitones above E2. **Aligned with `riffDegreeFreq`**: degree 0 = a = open A string (A2). Sharps ignored on b/e, same as audio. |
| `pitchKey(pitch)` | pitch → riff key letter (lowercase natural, UPPERCASE sharp) |
| `cellKey(string, fret)` | what a neck cell sounds — **the tap contract**: feed this to `riffPressKey` |
| `positionsForPitch(pitch)` | all `[string, fret]` cells sounding that exact pitch |
| `nearestPositionForKey(key, ref)` | nearest cell sounding `key`'s pitch class, closest to `ref` — **for ghost gems and glitch swaps** (§5) |
| `voiceRiff(degrees, sharps, rhythm?)` | → `{ positions: [[s,f],…], anchors: [{start,end,fret},…], octaveShift, overflow: [] }` |

`voiceRiff` internals (for orientation only): global octave fold centers the
riff low on the neck (contour preserved exactly); phrases split at
`feel === 'rest'` notes; DP picks one anchor per phrase balancing register
fit (high phrases voice HIGH on the neck) against hand travel; per-note
choice minimizes string/fret movement, open strings always allowed.

### ✅ `riff/guitarMap.test.mjs` — run `node src/riff/guitarMap.test.mjs`

750-riff corpus from the REAL generators (attacker/defender/melody, seeded
RNG), ~55,000 assertions, all passing as of 2026-07-24:

- every voiced cell sounds its note's pitch (octave-exact unless flagged;
  `overflow` is empty across the whole corpus)
- `cellKey(position) === riffDegreesToNotes(...)[i]` — tap key === judge key
- fretted notes sit inside their phrase's anchor window; anchors on-neck
- contour: relative pitch direction between consecutive notes survives
  voicing (a climb never renders as a fall)
- determinism (double-run deep-equal); all 6 strings used across corpus;
  ~29% open strings; anchors move at ~1/3 of phrase boundaries, max 8 frets

**Re-run this test after ANY edit to `guitarMap.js`, `riffGeneration.js`, or
`melodyRiff.js`.** It has no framework deps — plain node.

---

## 3. Data flow (where voicing enters the pipeline)

Voicing rides along with the riff, computed once per side when the duel
starts, client-side (it's presentation — the engine never reads it):

```
startRiffOff (main file ~L6880s)
  atkRiff: { notes, freqs, …, voicing: voiceRiff(atk.degrees, atk.sharps, atk.rhythm) }
  defRiff: { …,              voicing: voiceRiff(def.degrees, def.sharps, def.rhythm) }

riffBeginTurn (~L6929, builds the run from buildRiffTimeline)
  run.notes[i] gains  pos:  side.voicing.positions[i]   // [string, fret]
  run gains           anchors: side.voicing.anchors      // camera script
```

`RiffHighway` then reads `n.pos` instead of computing `guitarPos(n.key)`.
Round 2 (`speedUpRiffRhythm`) keeps the same degrees/sharps → **reuse the
same voicing object**; only timing changes.

---

## 4. Build phases

### N1 — wire voicing into the run ✅ (2026-07-24)
- `startRiffOff`: `voicing: voiceRiff(...)` attached to both `atkRiff`/`defRiff`.
- `riffStartRun`: each run note gets `pos: voicing.positions[i]`; run gets
  `anchors: eng.anchors`.
- Round 2: engine stores `origRhythm` pre-speedup; client voices from
  `r.origRhythm ?? r.rhythm` (phrase boundaries preserved).
- Glitch swap: `pos: nearestPositionForKey(newKey, oldPos)` set alongside
  the key/freq swap.
- Files: main file + `engine/systems/riffOff.js` (1-line `origRhythm` add).

### N2 — `RiffHighway.jsx` guitar view rework ✅ (2026-07-24)
- **Lanes**: 6 fixed string lanes (`laneX` for guitar = string index only —
  delete the `guitarPos`/`GPOS` lookup). Lane guides = all 6 strings, always.
- **Gem color = string color** (`NEON_STRING_COLORS[n.pos[0]]`) — Rocksmith
  convention, replaces feel-based coloring *in guitar view only* (piano view
  keeps current colors). Keep: ghost gems violet, glitched magenta (state
  overrides string color); diamond shape for sharps stays.
- **Gem glyph = fret number** (`n.pos[1]`), the tab-mode read. Label tiers
  (`showLabels: true`): letter AND fret (e.g. `A♯` above, `4` inside — or
  `A♯4` if space is tight; executing model's call, keep it legible at
  GEM_R=16). Shredder/Virtuoso: **fret number only**.
- **Open notes** (`fret === 0`): render as a short horizontal BAR across the
  lane instead of a circle (GH open-strum convention). Sharp-diamond rule
  doesn't collide — open cells are never sharp *display* problems since the
  number/letter still shows; keep the bar.
- **Strike zone**: neck widens to `MAX_FRET` frets. Render the full 13-fret
  neck in an inner SVG `<g>`, camera = `translateY` on that group showing a
  ~7-fret viewport centered on the active anchor window; highlight the
  anchor window rows (dim cyan fill). Slide the camera when the active
  anchor changes.
  - **CAMERA INVARIANT (§0.5)**: anchor changes happen at phrase boundaries;
    animate the slide over ≤300ms starting when the previous phrase's last
    gem is judged OR its `hitAt + ok` passes. Never mid-phrase.
  - **⚠️ THE rAF RULE**: gem motion is rAF-driven for a documented reason
    (see the header comment in `RiffHighway.jsx` — React re-renders break
    CSS animation clocks). The camera slide is LOW-frequency, so a CSS
    `transition: transform 300ms` on the `<g>` is fine — but do NOT tie gem
    positions to the camera transform. Gems fall in lane-space (string x),
    which never moves. Only the STRIKE ZONE scrolls.
- **Taps**: delete `resolveStringKey`. Tap targets = fret CELLS (string ×
  fret in the viewport, plus the nut row for opens). Tap fires
  `onPress(cellKey(s, f))`. This restores pitch-choice parity with piano
  (Earned gap closed): tapping the wrong fret on the right string is now a
  `wrong`, exactly like keyboard.
- **Lit blips on hit**: use the judged note's `pos` directly (delete the
  `guitarPos(k)` lookup — a key letter no longer determines a unique cell).

### N3 — main-file mirror + GPOS deletion ✅ (2026-07-24)
- `renderInstrument`: local `GPOS` + `posOf` deleted; notes now placed via
  `nearestPositionForKey(k, [1, 2])` with fret clamped to 7 (`Math.min`).
  Board guitar stays 7 frets (decorative).
- Grepped `src/`: no remaining `GPOS`/`guitarPos` refs in active code
  (only doc mentions + `src(update2)` backup snapshot).

### N4 — docs ✅ (2026-07-24)
- `ARCHITECTURE.md`: `riff/` dir description updated; `guitarMap.js` entry
  updated (wiring locations listed, "not yet built" removed); `RiffHighway`
  reference row annotated with Rocksmith pass changes.
- This file: all phases marked ✅ with build notes.

---

## 5. Traps (read before coding N2)

1. **E-Rush ghost gems** (`n.ghostKey`) aren't in `degrees` — they have no
   voiced position. Use `nearestPositionForKey(n.ghostKey, n.pos)` at
   render/run-build time. Ghost gem lane = that position's string.
2. **Glitch swaps** (`pickGlitchRiffNote`, main file ~L6974) replace a
   defender note's key/freq MID-RUN. The swapped note needs
   `pos: nearestPositionForKey(newKey, oldPos)` in the same state update
   that swaps `notes`/`freqs` — a swapped gem with a stale `pos` will sound
   one note and sit on another. This is the sneakiest one.
3. **Same-letter, different octave**: two gems can share a key letter but
   sit on different cells. `riffPressKey` matches by letter (earliest
   hit-time wins) — correct and untouched. But `litKeys` in `RiffHighway`
   is letter-keyed; switch guitar-view lit blips to note-index → `pos`
   keyed, or two simultaneous same-letter hits will light the wrong cell.
4. **Virtuoso density**: 15–16 gems, 6 lanes → same-lane pileups. The gem
   tail + fret numbers carry the info; verify at VIRTUOSO with a long
   same-string pedal riff (attacker riffs pedal the root constantly). If
   unreadable, raise `SPAWN_PAD` stagger — do NOT lengthen leadTime
   (that's difficulty tuning, locked).
5. **Round 2** reuses degrees → reuse the SAME voicing. Recomputing is
   harmless (deterministic) but wasteful; don't voice from the sped-up
   rhythm — phrase boundaries come from the ORIGINAL rhythm's rests
   (`speedUpRiffRhythm` converts rests to rushes, which would merge phrases
   and re-anchor mid-duel).
6. **Acoustic tier** (`riffTier === 'acoustic'`) uses the same highway —
   no special-casing needed; confirm nothing assumes stadium.
7. **Piano view untouched.** Every guitar change above is gated on
   `view === 'guitar'`.

---

## 6. QA checklist (executing model: run ALL before marking N2/N3 done)

- [ ] `node src/riff/guitarMap.test.mjs` — 0 failures
- [ ] Riff-off at each tier × both views; labels/fret-glyph rules per tier
- [ ] Keyboard play and touch play both produce hits AND wrongs on guitar
- [ ] E-Rush duel: ghost gem renders on a valid cell, both presses judge
- [ ] Glitched defender note: gem visibly moves to the swapped note's cell
- [ ] Round 2: camera script identical to Round 1, timing faster
- [ ] VIRTUOSO 15+ note riff readable; camera never moves mid-phrase
- [ ] Acoustic duel end-to-end
- [ ] Board-side idle instrument still renders melody notes (N3)

---

## 7. STICs + Earned verdicts (recorded 2026-07-24)

| Piece | S | T | I | C | Earned | Notes |
|---|---|---|---|---|---|---|
| Full-neck contour voicing | ✓ | ✓✓ | ✓ | ✓✓ | ✓✓ | Renders the octave-unwrap `melodyToRiff` already does. Your melody's shape = visible motion. |
| Tab-mode fret glyphs | ✓ | ✓✓ | ✓ | ✓ | n/a | Reading tab IS guitar sight-reading; honors R2's intent better than blank gems. |
| String-colored gems | ✓✓ | ✓ | ✓✓ | ✓ | n/a | Rocksmith convention; string identity readable without labels. |
| Fret-cell taps | ✓ | ✓ | ✓ | ✓✓ | ✓✓ | Closes the tap-parity Earned gap (string-strips auto-resolved pitch). |
| Sliding camera / anchors | ✓ | ✓✓ | ✓ | ✓ | n/a | Presentation. Guarded by the phrase-boundary invariant (§0.5). |
| Multi-position pitch reading | ✓ | ✓✓ | ~ | ✓ | ✓ | Deliberate call: labels-off keyboard players must know the neck (D str fret 7 = a). Real musicianship, tiered behind Shredder, mitigated by string colors + anchoring. |
| ~~GH 5-lane abstraction~~ | ✓✓ | ✓ | ✓✓ | ✗ | ✗✗ | **Banned** (§0.2). Deletes pitch → kills melody-as-riff and the theory ladder's riff-off relevance. Recorded so nobody re-proposes it. |
| Sustains (GH import) | — | — | — | — | — | Approved in principle, NOT in this pass — separate handoff after the neck lands (touches grading + `riffStats` shape). |

---

## 8. Decisions log (settled with Alex, 2026-07-24)

1. **Rocksmith frame**: all 6 strings, frets 0–12, position anchoring. ✅
2. **Anchors follow register** — high phrases play high on the neck (not
   high strings in home position). Verified: neck moves at ~1/3 of phrase
   boundaries on the generated corpus. ✅
3. **Tab glyphs**: label tiers = letter + fret; Shredder+ = fret only. ✅
4. **Keyboard input unchanged; taps become fret-cells.** ✅
5. **GH abstraction banned; sustains deferred to their own pass.** ✅
6. **Camera moves only at phrase boundaries** (≤300ms slide). ✅
7. Degree-0 anchor = A2 = open A string, matching `riffDegreeFreq`'s octave
   drop — display, audio, and judge agree on every pitch. ✅

---

*Related reading: `RIFFOFF_HANDOFF.md` (§0 ruling, R1–R6 build notes),
`ARCHITECTURE.md` §Design lenses, `ui/RiffHighway.jsx` header (the rAF
warning). The sustain/hold-note design from the same session is intentionally
NOT in this doc — it needs its own STIC pass once the neck ships.*
