# RLSW — Character Build Handoff

Pick-up notes for continuing the Spirit-identity work. Read this + `DESIGN_AUDIT_v2.md`
(design thesis) + `ARCHITECTURE.md` (where things live) and you're caught up.

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
| **Shredding Ronin** (`cosmic_ronin`) | 8/5/5/5, Shred | ✅ **Complete** |
| **Intergalactic 0** (`intergalactic_0`) | 6/7/**4**/4, Groove | ✅ **Complete** |
| **Metalness Monster** (`Metalness_Monster`) | 7/6/4/5, Shred | ⚠️ Has arsenal, **no innate identity** |
| **Glamarchy** (`Glamarchy`) | 5/8/5/4, Flair | ❌ **Not started** (no innate, no arsenal) |

### Ronin — the fragile ranged virtuoso (REWORKED)
- **Innate:** crowd virtuosity (Performance Score ≥5 wins ~2× fans, <5 cools/sheds fans);
  Smash relationship (his own Smash hits soft; a Smash *on* him double-scatters); note-greed
  (~50% second note off a Lost Chord); 10-slot stock.
- **Arsenal (reworked):**
  - **Psycho Bushido** (6 Db, 2-round CD) — Iaijutsu dash in a straight line from facing. Remaining AP becomes bonus Drive.
  - **Shadow Illusion** (6 Db, costs 1 Drive token) — The Ronin splits into a **body double**: a second,
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
  - **Cursed Shamisen** (8 Db unlock, 2 Db/use) — Set down on Ronin's hex, where it plays a **haunting
    melody every turn** (real audio: an insen-scale phrase that drops an octave and speeds up once it
    wakes). Everyone inside its rings loses 1 Sustain, then Vibe. Every Spirit the melody reaches is
    marked with a pulsing 🎶 aura until it next plays, so the damage is never a mystery. Three stages,
    ticked at the start of Ronin's turns:
    **1 — Listening** (2 rings, still, spares Ronin) →
    **2 — Swelling** (3 rings, still, spares Ronin) →
    **3 — Hunting** (aura **frozen** at 3 rings; stalks 1 hex/turn toward the nearest Spirit, ties broken
    toward the most wounded; spares nobody, Ronin included).
    The freeze matters: an aura that both grows *and* chases would eventually cover the stage with no
    counterplay. Growth is what it gets for standing still. Calmed by walking onto its hex, which also
    hands the walker a bonus note — the answer is always "go and touch it".
    Board art: `SHAMISEN_ART` at the top of the simulator (currently a vector placeholder; drop
    `src/standees/Cursed_Shamisen.png` in and point the constant at it to swap).
  - **Wa no Koe** (12 Db) — Passive: melody commit aligning with chord stack gives +1 Drive or Sustain for 3 rounds.

### Intergalactic 0 — the slow forgiving cosmic controller (done)
- **Innate:** speed 4; knockback −1 ("Rolls Hard"); **Freestyle** (first out-of-scale note/turn
  lands perfect, no penalty +Flair; tone cluster reads **8/2** for him); +1 Sustain on every voicing.
- **Arsenal:** **Blaster of Ra** (replaces Smash — ranged, piercing bass-drop) · **Displace**
  (warp to a hex beside your amp rig, 3 AP, 2-turn cooldown, needs ≥1 amp) · **Sunbeam** (Amp-3
  capstone: Sonic +2 range + scorches a fire trail + golden extra-lit beam).
- He's the Sun Ra homage ("Space is the place"). Note: we kept the homage *subtle* on purpose —
  "Ra" + "Displace" are fine; we deliberately did NOT use the verbatim album/film title.

---

## NEXT TASK: design + build a third Spirit

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

**Cooldowns:** add a `<x>Cd` field in `makeInitialNoteState`, tick it down in `startNewTurnNotes`
(see `displaceCd`).

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
