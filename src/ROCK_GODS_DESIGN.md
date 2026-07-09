# ROCK_GODS_DESIGN — the rest of the pantheon, build-ready

> **For a future AI session.** The Feedback Warlock, Sonic Sorceress, and
> Glam Reaper already exist as stubs in `data/rockGods.js` (name / icon /
> colors / title / blurb) and `pickRockGod` already scores them — they fall
> back to the Bardbarian only because `attacks: [] , taunts: {}` and they're
> absent from `ROCK_GOD_IMPLEMENTED`. This doc designs their full kits so a
> session can build them straight through. **Do not start until every
> MULTIPLAYER_HANDOFF phase is complete** — unlike the POLISH doc, these ARE
> engine changes (the Rock God is engine state, Phase 6c), so all the ground
> rules apply: owner commits from Windows, owner smoke-tests via
> `npm run dev`, one god per commit, green after each.

---

## 0. The shared skeleton (what "building a god" means)

The Bardbarian is the proven template. A god = five pieces:

1. **`data/rockGods.js`** — fill the god's `attacks` deck and `taunts`
   (paste-ready literals below). Add the god's id to `ROCK_GOD_IMPLEMENTED`
   **last** — that flip is what makes `pickRockGod` route to them, so it is
   the go-live switch for the commit.
2. **`engine/systems/rockGod.js` → `applyGodActed`** — a branch per new
   `attackId`, following the existing three-beat shape: armed telegraph
   RESOLVES → winded god RECOVERS → else OPEN a new attack (weighted
   `pickGodAttack`, no immediate repeat). Every effect is a report on
   `rockGod.lastAct` ({ kind, attackId, … }); state changes (positions, HP,
   telegraphs) happen here. **All randomness through the injected `rng`** —
   never `Math.random()` — or replays break. Targeting reads engine state
   (`state.spirits`, `state.amps`, fame) only.
3. **Client playback** — main file, `ROCK GOD SYSTEM` banner (search
   `act.attackId === 'thunderclap'` for the pattern): logs, damage
   application to Vibe, FX, camera per report kind. Presentation delays live
   here, rules don't.
4. **`ui/RockGodLayer.jsx`** — telegraph hexes render generically from
   `god.telegraph.hexes` already; add the god to the per-attack telegraph
   icon pick (currently `isSlide ? '🛝' : '⚡'` — grow this into a small
   `{ attackId: icon }` map). Add art to `GOD_ART` when the owner supplies
   it (3:2 image, renders as a circular medallion like `Bardbarian.png`);
   until then the emoji-colossus fallback covers it — **art is never a
   blocker**.
5. **Board geometry helpers** — `board/rockGodFx.js` already has
   `hexesWithin`, `slideLine`, `shoveAwayHex`, `nearestSpiritTo`. New
   shapes (the Sorceress's ribbon, pulls toward the god) go there, pure.

**One code fix that ships with the FIRST new god:** `pickRockGod` currently
falls back to `bardbarian` whenever the top-scoring god is unimplemented.
Change the last line to walk `ranked` and return the first implemented god,
so a two-god pantheon actually uses both:

```js
const picked = ranked.find(([id]) => ROCK_GOD_IMPLEMENTED.includes(id))?.[0] ?? 'bardbarian';
return picked;
```

**Recommended build order** (cheapest reuse first): Glam Reaper (his big
attack is a re-skinned power slide) → Feedback Warlock (needs amp-state
reads) → Sonic Sorceress (most new geometry + the note-sheet touch). One
god per session is a fine pace.

**Shared balance baseline** (Bardbarian's proven numbers): HP
`ROCK_GOD_HP_PER_SPIRIT` (20) × living Spirits, deck weights 3/3/2/2, two
telegraphed / two instant, damage 1–3, exactly one attack that leaves the
god WINDED (the punish window). All three kits below keep that frame —
deviate only after playtests.

---

## 1. 🌀 THE FEEDBACK WARLOCK — "Hexmaster of the Howling Amp"

Descends on amp-and-gear leaders (`pickRockGod`: ampsOwned + gear skills).
Identity: **your own rig betrays you.** He doesn't bring weapons — he takes
yours.

### The twist — HIJACKED RIG

On summon, **every amp on the board (any owner) is hijacked**: it glows in
his aura (`#6633cc`), and its field becomes his weapon. If fewer than 2
amps are on the board at summon, he conjures cursed amps (his color, no
owner) on free hexes within 2 of the Limelight until there are 2 — the
Warlock never arrives unarmed. Engine: `rockGod.hijacked: [ampIds]` set in
`applyGodSummoned`; cursed-amp spawn hexes drawn on engine rng.

**Counterplay — RE-TUNE:** a Spirit on or adjacent to a hijacked amp can
spend 2 Beats to re-tune it: the amp returns to its owner (or despawns if
cursed) and the feedback snaps back — **2 damage to the Warlock**. This is
the fight's shape: dive the amps or drown in the fields. (Client: an action
button next to the existing amp actions; engine: one action
`GOD_AMP_RETUNED { spiritId, ampId }`.)
*Cheap v1 fallback if the session runs short:* skip the re-tune action;
hijack then only drives `feedback_loop` targeting. Still a coherent boss —
commit that and leave re-tune as a flagged TODO.

### Attack deck — paste into `data/rockGods.js`

```js
attacks: [
  { id: 'feedback_loop', weight: 3, telegraph: true,  dmg: 2,
    label: 'FEEDBACK LOOP',
    warn: 'Every hijacked amp HOWLS — clear their fields!' },
  { id: 'static_hex',    weight: 3, telegraph: false, dmg: 1,
    label: 'STATIC HEX' },
  { id: 'the_big_suck',  weight: 2, telegraph: true,  dmg: 3,
    label: 'THE BIG SUCK',
    warn: 'He inhales — the feedback drags you IN!' },
  { id: 'encore_hijack', weight: 2, telegraph: false, dmg: 0,
    label: 'ENCORE HIJACK' },
],
```

Attack rules (engine branches):

- **FEEDBACK LOOP** (telegraph): armed hexes = union of
  `hexesWithin(amp.num, AMP_RANGE)` over every hijacked amp. Resolve: 2 dmg
  to every Spirit caught. The more amps players built, the scarier — that's
  the point (he was summoned BY an amp-heavy game).
- **STATIC HEX** (instant): `nearestSpiritTo(god.num)` takes 1 dmg AND two
  of their note-stock slots are **staggered** next turn (the existing
  `staggeredSlots` mechanic the melody UI already honors — slot indices
  drawn on engine rng, patched via the existing note-sheet action; report
  carries them for the log).
- **THE BIG SUCK** (telegraph): armed hexes = `hexesWithin(god.num, 3)`.
  Resolve: every caught Spirit is pulled 1 hex toward him (inverse of
  `shoveAwayHex` — add `pullTowardHex` to `board/rockGodFx.js`), then
  Spirits adjacent to him after the pull take 3. **He is WINDED after** —
  this is his punish window.
- **ENCORE HIJACK** (instant): hijacks the oldest un-hijacked amp on the
  board; if all amps are his, conjures a cursed amp on a random free hex
  within 2 of him (engine rng). 0 dmg — a board-state turn, the dread
  builds.

Telegraph icon: `🌀`. FX language: purple lightning arcs hex-to-hex between
hijacked amps (client-only).

### Taunts — paste into `data/rockGods.js`

```js
taunts: {
  summon: [
    `🌀 "Your rig answers to ME now. Listen to how it SCREAMS."`,
    `🌀 "Sixty cycles of hum, mortals. Let us make it HOWL."`,
  ],
  hit: [
    `🌀 "A tickle. My noise floor is higher than that."`,
    `🌀 "You call that signal? All I hear is noise."`,
  ],
  bigHit: [
    `⚡ "GRK— you found the resonant frequency..."`,
    `⚡ "That one CLIPPED. Who gave you that much gain?!"`,
  ],
  winded: [
    `😮‍💨 "The loop... must... re-stabilize..."`,
    `😮‍💨 "Hhh... impedance mismatch... a moment..."`,
  ],
  kill: [
    `💀 "Unplugged. Forever."`,
    `💀 "Silence — the one frequency you had left."`,
  ],
  victory: [
    `👑 "Every amp on this stage sings MY name. Crawl home through the hum."`,
  ],
  defeat: [
    `🌩️ "The circuit... breaks. You EARNED the signal. Take the crown — and keep it LOUD."`,
  ],
},
```

Acceptance: summon with 0 amps on board → 2 cursed amps appear; feedback
loop telegraph covers every hijacked field; re-tune returns/despawns the
amp and damages him; big-suck pull respects hazards (reuse the shove code's
hazard-entry checks, inverted); replay determinism selftest passes with him
in the log.

---

## 2. 🔮 THE SONIC SORCERESS — "Weaver of the Infinite Waveform"

Descends on theory-heavy leaders (`pickRockGod`: theory_* skills).
Identity: **she rewrites the music you're standing on.** The board is her
staff paper.

### The twist — THE WAVEFORM

Each round she attunes to a key, announced loud (banner + log: *"The
Waveform sings in F♯ minor"*). Stored as `rockGod.waveKey { root, mode }`,
drawn on engine rng at summon and re-drawn each round tick.

- **Harmonize to hurt her:** a Spirit whose committed track was fully
  in-scale **in HER key** deals +2 on their next attack against her (the
  engine already sees commit results; flag rides on the Spirit's noteState,
  consumed on hit). Theory players — the ones who summoned her — get to
  flex; everyone else fights her flat.
- *Cheap v1 fallback:* ship the key announcements + `modulate` (below)
  without the +2 harmony bonus; add the bonus in a follow-up commit.

### Attack deck

```js
attacks: [
  { id: 'waveform_crash',  weight: 3, telegraph: true,  dmg: 2,
    label: 'WAVEFORM CRASH',
    warn: 'A standing wave builds — get off the ribbon!' },
  { id: 'modulate',        weight: 3, telegraph: false, dmg: 0,
    label: 'MODULATE' },
  { id: 'perfect_cadence', weight: 2, telegraph: true,  dmg: 3,
    label: 'PERFECT CADENCE',
    warn: 'She weaves your resolution — the leader resolves NEXT.' },
  { id: 'glissando',       weight: 2, telegraph: false, dmg: 1,
    label: 'GLISSANDO' },
],
```

Attack rules:

- **WAVEFORM CRASH** (telegraph): armed hexes = a **sine ribbon** across
  the board through her hex — new pure helper `sineRibbon(originNum, dirIdx,
  amplitude=1)` in `board/rockGodFx.js`: walk the hex line in a direction
  (engine-rng pick of 3 axes), offsetting alternately ±1 every two steps.
  Reads as a waveform on the board — HER telegraph language. Resolve: 2 dmg
  to Spirits on the ribbon.
- **MODULATE** (instant, 0 dmg): every living Spirit's root note transposes
  a tritone (+6 semitones) via the existing note-sheet patch action, one per
  Spirit. Their prepared plans go sour mid-flight — brutal, but it costs her
  the turn and telegraphs itself in the log (*"the key lurches under your
  feet"*). This is the attack people will tell stories about.
- **PERFECT CADENCE** (telegraph): armed hexes = the engine FP leader's hex
  + neighbors (radius 1). Resolve: 3 dmg to anyone caught. **She is WINDED
  after** — the big spell drains her.
- **GLISSANDO** (instant): she teleports (portamento shimmer, client FX) to
  a random legal hex within 4 (engine rng; not onto Spirits/hazards/the
  Limelight edge rules the Bardbarian follows), then 1 dmg to every Spirit
  adjacent to her arrival hex. Keeps the fight mobile — she never gets
  cornered like the melee gods.

Telegraph icon: `🔮` (ribbon hexes), `🎼` for the cadence. FX language:
cyan waveform traces, key-signature glyphs floating off her.

### Taunts

```js
taunts: {
  summon: [
    `🔮 "Your little songs. So finite. Let me show you the INFINITE."`,
    `🔮 "Twelve notes, mortals? I sing between them."`,
  ],
  hit: [
    `🔮 "Out of key. As always."`,
    `🔮 "You struck the waveform. The waveform barely noticed."`,
  ],
  bigHit: [
    `✨ "That... resolved. How DARE you resolve."`,
    `✨ "Mm. Someone has been practicing their intervals."`,
  ],
  winded: [
    `😵 "The cadence... took more than it gave..."`,
    `😵 "Sustain... failing... hold... hold..."`,
  ],
  kill: [
    `💀 "Rest, little melody. Every phrase must end."`,
    `💀 "Decrescendo... al niente."`,
  ],
  victory: [
    `👑 "The waveform is eternal. You were a grace note."`,
  ],
  defeat: [
    `🌊 "You modulated... past me. Magnificent. The crown rings in YOUR key now."`,
  ],
},
```

Acceptance: waveKey announces at summon and re-draws each round; modulate
actually shifts every Spirit's root (check the Root Note UI); ribbon
telegraph renders as a recognizable wave at all four board orientations;
glissando never lands illegally; harmony bonus (if built) applies exactly
once then clears; replay selftest green.

---

## 3. 💀 THE GLAM REAPER — "Death, But Make It Fabulous"

Descends when the leaders have been dying (`pickRockGod`: livesLost × 2).
Identity: **death as the ultimate showstopper** — sequins, feather boa,
scythe that is obviously a mic stand. He has watched every Knockdown this
game with professional interest.

### The twist — THE GUEST LIST

- **He arrives fed:** +2 max HP (and current HP) per Knockdown suffered
  **game-wide** before he descends (engine tracks lives per Spirit; sum
  `startingLives − livesRemaining`). A bloody game summons a fat Reaper —
  thematic AND self-balancing, since a knockdown-heavy game usually means
  weakened Spirits summoned him.
- **He feeds mid-fight:** any Spirit knocked down during the boss phase
  heals him 5 and his next attack deals +1 (*"an encore for the fallen"* —
  flag `rockGod.encoreFed`, consumed on the next damage roll). Dying to the
  Reaper makes the Reaper worse: the fight teaches you to play safe, which
  is exactly the read on the players who summoned him.
- *Cheap v1 fallback:* summon HP bonus only; add the mid-fight feed in a
  follow-up commit.

### Attack deck

```js
attacks: [
  { id: 'curtain_call',   weight: 3, telegraph: true,  dmg: 2,
    label: 'CURTAIN CALL',
    warn: 'The spotlight swings to the weakest — a finale has been BOOKED.' },
  { id: 'sequin_storm',   weight: 3, telegraph: false, dmg: 1,
    label: 'SEQUIN STORM' },
  { id: 'last_dance',     weight: 2, telegraph: true,  dmg: 3,
    label: 'LAST DANCE',
    warn: 'He extends a gloved hand — the dance floor is MARKED.' },
  { id: 'steal_the_show', weight: 2, telegraph: false, dmg: 0,
    label: 'STEAL THE SHOW' },
],
```

Attack rules:

- **CURTAIN CALL** (telegraph): armed hexes = the **lowest-Vibe** living
  Spirit's hex + neighbors (ties: engine rng). Resolve: 2 dmg to anyone
  caught. He hunts the dying — the healthy must decide whether to body-block
  for their weakest rival. Delicious.
- **SEQUIN STORM** (instant): 1 dmg to every Spirit within
  `hexesWithin(god.num, 2)`. Glitter shrapnel; cheap, constant pressure.
- **LAST DANCE** (telegraph): a re-skinned **power slide** — reuse that
  branch nearly verbatim (`slideLine` toward the engine FP leader, length
  3): resolve 3 dmg along the line, he ends at the far end, **WINDED**
  (the costume change — his punish window). This is why he's the cheapest
  god to build first.
- **STEAL THE SHOW** (instant, 0 dmg): he poses; every Spirit loses 2
  casual fans (existing fans-changed action — they've drifted off to watch
  HIM) and he heals 2. An economy sting that makes the fight leak Fame
  pressure, on-brand for the god of upstaging.

Telegraph icon: `🎯` for curtain call, `💃` for the dance line. FX
language: pink/gold glitter bursts, a spotlight cone on the curtain-call
target (the client already has spotlight visuals to crib from).

### Taunts

```js
taunts: {
  summon: [
    `💀 "Daaarlings! I've watched every little death tonight — I came for the ENCORE."`,
    `💀 "Death arrives when the show gets GOOD. Take it as a compliment."`,
  ],
  hit: [
    `💅 "Careful, sweetie — you'll chip the sequins."`,
    `💅 "Was that aggression or choreography? Commit to ONE."`,
  ],
  bigHit: [
    `😱 "MY BOA! You absolute animal— ...no, I felt that. I FELT that."`,
    `😱 "Brutal. Gorgeous. BRUTAL. Do it again, I dare you."`,
  ],
  winded: [
    `🥀 "The dance... demands a costume change..."`,
    `🥀 "Even death... needs a breather between numbers..."`,
  ],
  kill: [
    `⚰️ "And THAT, darlings, is how you exit. Study it."`,
    `⚰️ "A front-row seat to your own finale. You're WELCOME."`,
  ],
  victory: [
    `👑 "The crown suits me. Then again — everything does."`,
  ],
  defeat: [
    `🌹 "Upstaged... at my own funeral... darling, that was FABULOUS. The stage is yours."`,
  ],
},
```

Acceptance: summon HP scales with game-wide knockdowns (Testing Grounds:
dev-force knockdowns pre-summon, check the HP bar); curtain call retargets
as Vibe totals change between open and resolve — decide and DOCUMENT: lock
the target at telegraph time (recommended — telegraphs are promises);
knockdown-feed heals and buffs exactly once; steal-the-show shows the fan
loss on the (grandstand!) crowds; replay selftest green.

---

## 4. Art & asset checklist (owner supplies; never blocks a build)

| God | File wanted | Style anchor |
|---|---|---|
| Feedback Warlock | `Feedback_Warlock.png` (3:2, medallion crop) | Purple storm, amp-stack throne, arcing cables |
| Sonic Sorceress | `Sonic_Sorceress.png` (3:2) | Cyan waveforms, floating staff-lines, regal |
| Glam Reaper | `Glam_Reaper.png` (3:2) | Pink/gold sequins, boa, mic-stand scythe |

Wire into `GOD_ART` in `ui/RockGodLayer.jsx`; until then each god renders
as the emoji colossus (🌀/🔮/💀) in their aura colors, which already reads
fine.

## 5. Per-god commit checklist

For each god, in order: (1) data literals (attacks + taunts) → (2) engine
branches + any new `rockGodFx` geometry, selftest a scripted fight →
(3) client playback (logs/FX/damage) → (4) twist mechanic (or its flagged
v1 fallback) → (5) telegraph icons + GOD_ART hook → (6) add id to
`ROCK_GOD_IMPLEMENTED` + the `pickRockGod` ranked-walk fix (first god only)
→ owner smoke-test: force-summon via the dev panel (search `devSetup` /
🧪 TESTING GROUNDS), one full fight, win AND lose. Commit:
`gods: feedback warlock` / `gods: sonic sorceress` / `gods: glam reaper`.
