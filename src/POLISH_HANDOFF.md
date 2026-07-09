# POLISH_HANDOFF — four presentation upgrades (post-multiplayer)

> **For a future AI session.** Written by a session that mapped the code for all
> four features (anchors verified against the live file). **Do NOT start this
> work until every phase in `MULTIPLAYER_HANDOFF.md` is complete and green.**
> Read `ARCHITECTURE.md` first, and inherit ALL ground rules from
> `MULTIPLAYER_HANDOFF.md` §2 — especially: navigate the main file by banner
> comments (line numbers below are hints, not gospel — the sandbox mount goes
> stale), never commit from the sandbox (the OWNER commits from Windows),
> lint newly created files in `/tmp`, and rely on the owner's `npm run dev`
> to validate main-file edits.

---

## 0. Scope guarantee — read this first

All four features are **pure client/presentation work. Zero engine changes.**
Nothing here touches `src/engine/`, `applyAction`, GameState, or the replay
log. `Math.random()` used for *audio timing jitter* or *visual variety* below
is presentation randomness — it does NOT need engine rng threading (same rule
the multiplayer doc applies to cinematic timers). If you find yourself editing
`src/engine/`, you have misread the task — stop.

The features are independent. Recommended order (cheapest→dearest, each is
its own commit, game fully playable after each):

1. **C — Ronin shred commit** (~1 function, smallest)
2. **D — Fan upgrade** (1 helper + keyframes)
3. **A — Smash-style Spirit Select** (rewrite of one 220-line file)
4. **B — Opening movie template** (1 new file + a 3-line mount)

If the session runs short on budget, stop after any completed feature.

---

## A. Spirit Select — Smash Bros. style, unlock-ready

### Current reality

- `ui/Lobby.jsx` (~220 lines) is the whole pre-game screen: a single 520px
  form card — step state `count → assign` (`useState("count")` — mostly
  vestigial; the sections render conditionally on `playerCount`,
  `allAssigned`, `mode`). Sections: player count (2/3/4) → per-corner spirit
  buttons with 🤖 CPU checkboxes → mode (FFA / Team at 4P) → starting lives
  (1–5) → START.
- **The contract that must not change:** `Lobby({ onStart, onTutorial })`;
  `handleStart()` builds
  `spirits = [{ ...SPIRIT_DEFS[id], num: homeNum, facing, corner, color: cornerColor, cpu }]`
  and calls `onStart({ spirits, mode, teams, startingLives, beginnerMode })`.
  Also preserve: the 🧪 TESTING GROUNDS fixed button (`startTestingGrounds`),
  📖 HOW TO PLAY (`onTutorial`), 🎓 BEGINNER MODE toggle, the 2-player
  corner rule (`["blue","red"]` — opposite corners), and the CPU-default
  effect (non-first corners default to CPU).
- Data: `data/spirits.js` — `SPIRIT_DEFS` (4 spirits, each has `imageSrc`
  = its standee PNG, `color`, `style`, `drive`, `sustain`, `speed`, `vibe`),
  `SPIRIT_OPTIONS = Object.values(SPIRIT_DEFS)`. Corners/colors:
  `data/corners.js` → `CORNERS`, `CORNER_LABELS`, `CORNERS_ORDER`.
- Fonts already loaded in Lobby: `Orbitron` (display) + `Share Tech Mono`.
  Palette: bg `#050810`, panel `#080f1e`, borders `#1a2a40`/`#1e3a5f`,
  accent amber `#f6ad55`.

### Design — the Smash layout

Full-screen, two zones:

```
┌──────────────────────────────────────────────┐
│  ⚡ RLSW — SPIRIT WARS          [📖] [🎓]     │   header strip
│                                              │
│      ┌────┐ ┌────┐ ┌────┐ ┌────┐             │   ROSTER GRID (centre)
│      │ 🗡️ │ │ 👽 │ │ 🤘 │ │ 👑 │  ┌?┐┌?┐     │   portrait tiles + locked "?"
│      └────┘ └────┘ └────┘ └────┘             │
│                                              │
│ ┌─────────┐┌─────────┐┌─────────┐┌─────────┐ │   PLAYER CARDS (bottom)
│ │P1 BLUE  ││P2 RED   ││P3 …     ││P4 …     │ │   big render, name banner,
│ │ (art)   ││ (art)   ││  🤖CPU  ││  🤖CPU  │ │   stats, CPU toggle
│ └─────────┘└─────────┘└─────────┘└─────────┘ │
│  [2P][3P][4P]  [FFA][TEAM]  [♥1-5]  ▶ START  │   settings bar
└──────────────────────────────────────────────┘
```

- **Roster tiles**: one per `SPIRIT_OPTIONS` entry. Tile = spirit `imageSrc`
  (the standee PNG, `object-fit: contain`, slight upward crop so the head
  dominates), name plate along the bottom in Orbitron, border/glow in the
  spirit's own `color`. Hover: scale 1.06 + brighter glow + stat strip
  (`⚔️drive 🛡️sustain 👟speed · style`) fades in. Taken-by-another-corner:
  desaturated + small corner-colored chip showing who took it.
- **Selection model** (click, not drag — this is a mouse/touch game):
  exactly one corner is "choosing" at a time, indicated by its player card
  pulsing. Clicking a tile assigns that spirit to the choosing corner
  (`assign(corner, spiritId)` — keep the existing `assignments` state) and
  auto-advances "choosing" to the next unassigned corner. Clicking an
  already-assigned player card makes it the chooser again (re-pick). On
  assignment, flash the spirit's name huge across the grid centre for ~600ms
  (Orbitron, spirit color, `letter-spacing` animating wider — the "announcer"
  beat) and play a note via a short WebAudio blip (optional; skip if fiddly).
- **Player cards** (bottom row, one per active corner, `CORNER_LABELS`
  color-coded): empty = dashed silhouette + "PICK YOUR SPIRIT"; filled =
  large standee render (mirrored with `transform: scaleX(-1)` for
  right-side cards so they face inward — mirror PNGs also exist in
  `standees/` if that looks better), name banner, stat row, and the existing
  🤖 CPU checkbox. 2P shows 2 cards, 3P shows 3, 4P shows 4.
- **Settings bar**: player count, mode, lives — same logic as today,
  restyled as compact segmented controls. START button only lights when
  `allAssigned && mode` (keep the existing guards).

### Unlock-readiness (Spirits roster will grow)

- Add to `data/spirits.js`:

  ```js
  // Roster order + lock state for the select screen. Spirits not in
  // UNLOCKED_DEFAULT render as "?" tiles until unlocked at runtime.
  export const ROSTER_ORDER = Object.keys(SPIRIT_DEFS);
  export const UNLOCKED_DEFAULT = [...ROSTER_ORDER]; // all 4 launch spirits
  ```

- Select screen reads unlocks from
  `localStorage.getItem('rlsw.unlockedSpirits')` (JSON array of ids),
  falling back to `UNLOCKED_DEFAULT`. Locked spirits render as a darkened
  tile with a big "?" and no interaction. **Do not build the unlock
  *mechanism*** — just the rendering path, so a future session only has to
  append to `SPIRIT_DEFS`/`ROSTER_ORDER` and write the localStorage key.
- **Grid must auto-layout**: `grid-template-columns: repeat(auto-fit,
  minmax(120px, 1fr))` capped at ~6 columns, tiles shrink gracefully as the
  roster grows past 8/12 (Smash does exactly this). Never hard-code "4".

### Implementation notes

- Rewrite `ui/Lobby.jsx` in place (keep the exported name `Lobby` and both
  props — the mount at the `RLSWSimulator` root, search
  `<Lobby onStart=`, must not change).
- Keep everything in the one file; inline styles like the rest of the
  codebase; add any keyframes in a local `<style>` tag (Lobby already has
  one) — do NOT touch `ui/GameStyles.jsx` for this (it mounts inside Game,
  not Lobby).
- Team mode at 4P: keep the "Blue+Purple vs Red+Yellow" pairing text.
- Acceptance: all four flows produce byte-identical `onStart` payloads to
  today (log-compare one manual run); Testing Grounds still one-click;
  locked-tile path proven by temporarily hand-editing the localStorage key.

---

## B. Opening story movie — skippable template, plays before the select screen

### Current reality

The app root is `RLSWSimulator()` in `rlsw-simulator-v3_8_1.jsx` (search
`export default function RLSWSimulator`). Flow today:
`showTutorial ? <Tutorial/> : !gameState ? <Lobby/> : <Game/>`. There is no
title/intro of any kind — Lobby is the first thing seen.

### Design

New file **`ui/OpeningMovie.jsx`**, exporting `OpeningMovie({ onDone })`.
Mount in `RLSWSimulator`:

```jsx
const [introDone, setIntroDone] = useState(false);
...
if (!introDone) return <OpeningMovie onDone={() => setIntroDone(true)} />;
```

(before the tutorial/lobby branches; wrap with the existing
`isMobile ? mobileColorStyle : {}` div like its siblings). Plays on **every
launch**; **any key, click, or tap skips** straight to `onDone()` — owner's
call, arcade attract style.

### The template contract (owner fills content later)

Everything content-ish lives in one data array at the top of the file. The
owner will edit ONLY this array — build the player so that's true:

```js
// ── 🎬 STORYBOARD — the owner's editing surface. Each scene is one shot.
// image: null → renders the blank placeholder frame (dark panel, thin amber
//         border, faint "IMAGE" watermark). Later: an import or /public URL.
// title/caption: empty strings render nothing (layout doesn't jump).
// motion: ken-burns preset applied to the image layer.
const STORYBOARD = [
  { id: 'cold-open', durMs: 4500, motion: 'zoom-in',  image: null,
    title: '', caption: '' },
  { id: 'the-world', durMs: 5000, motion: 'pan-right', image: null,
    title: '', caption: '' },
  { id: 'the-war',   durMs: 5000, motion: 'pan-left',  image: null,
    title: '', caption: '' },
  { id: 'the-call',  durMs: 4500, motion: 'zoom-out', image: null,
    title: '', caption: '' },
  { id: 'logo',      durMs: 3500, motion: 'hold',     image: null,
    title: '⚡ RLSW', caption: 'ROCK LEGENDS: SPIRIT WARS' },
];
```

### Player spec

- **Stage**: full viewport, bg `#050810`, cinematic letterbox bars (top &
  bottom, `#000`, ~10vh each) that slide in on mount.
- **Scene lifecycle**: image layer crossfades between scenes (~700ms,
  absolute-positioned double-buffer — render current + next, animate
  opacity). `motion` presets are pure CSS keyframes on the image layer:
  `zoom-in` (scale 1→1.08), `zoom-out` (1.08→1), `pan-left`/`pan-right`
  (translateX ∓3%), `hold`. Duration = scene `durMs` so the move never
  visibly ends mid-scene.
- **Text**: `title` in Orbitron, large, spirit-amber `#f6ad55`, fades up
  ~400ms after the scene starts; `caption` beneath in Share Tech Mono,
  `#8aa0c0`, fades in ~300ms later. Both sit in the lower third, above the
  letterbox bar.
- **Placeholder frame** (when `image: null`): centered 16:9 panel,
  `#0a1020` fill, 1px `#f6ad5544` border, tiny corner ticks, watermark text
  `IMAGE — {scene.id}` at 10% opacity so the owner can tell shots apart
  while storyboarding.
- **Advance**: `setTimeout` per scene (store the id in a ref and clear on
  unmount/skip). After the last scene, ~600ms fade-to-black then `onDone()`.
- **Skip**: window `keydown` + `pointerdown` listeners (added on mount,
  removed on cleanup) → cancel timers → `onDone()`. Also render a quiet
  `SKIP ▸` chip bottom-right (fades in after 1.5s) and a progress dot row
  (one dot per scene, current lit) bottom-center.
- **Audio**: none for now. Do NOT wire BGM — `useBgmState` lives inside
  `Game` and autoplay-before-gesture will be blocked by the browser anyway.
  Leave a `// 🎵 future: intro music hook` comment where it would go.
- No new deps. One file. Acceptance: fresh `npm run dev` shows the movie,
  every input skips it, Lobby behaves exactly as before, hot-reload with an
  edited STORYBOARD reflects changes.

---

## C. Ronin's commit — he doesn't play the track, he SHREDS it

### Current reality

- `confirmNoteTrack()` (main file, search `function confirmNoteTrack`) is
  the commit. If the track hides a legendary riff it calls
  `playRiffSequence(riff, rootPc)`; **otherwise `playTrackSequence(melodyLine)`**
  — that else-branch is the target. Bots commit through the same function
  (search `confirmNoteTrack(); botStepRef.current = 'committed'`), so a bot
  Ronin shreds too. Good — leave that.
- `playTrackSequence(track)` (search `function playTrackSequence`) plays the
  committed melody as a groove: per-note random eighth/quarter/dotted
  durations, breaths, accents, last note rings ~0.95s. Voice-leading via
  `voiceLeadFreq(note, prevFreq)` keeps each note in the octave nearest the
  last. Notes are scheduled with `setTimeout` → `playNoteSound(note, {
  holdTime, fadeTime, volume, freq })`.
- `playNoteSound` (search `function playNoteSound`) already reads the amp
  knobs per acting spirit — Ronin's default voice is `saw` ("bright cutting
  lead", see `TONE_KNOB_DEFAULTS`-adjacent table, `cosmic_ronin: { ...
  voice: 'saw' }`). So the *tone* is already his; only the *phrasing* needs
  to change.
- `src/sfx/shred.mp3` exists but is currently **unreferenced** anywhere in
  `src/` — optional garnish, see below.

### Design — the shred arrangement

Change the call site to `playTrackSequence(melodyLine, { shred:
acting?.id === 'cosmic_ronin' })` and branch inside the function (keep the
normal path byte-identical for everyone else):

The shred = the same committed notes played as **2–3 lightning passes**,
each pass a slight variation — like a guitarist ripping the lick, then
ripping it again with ornaments:

- **Pass 1 — the statement.** Track in order, brutally fast: per-note
  spacing ~70–100ms (`dur` ~0.10–0.14s, `fadeTime` 0.08), slight jitter so
  it's human. `volume` 0.15.
- **Pass 2 — the variation.** Same notes with 1–2 mutations, chosen per
  commit with plain `Math.random()` (presentation-only — no engine rng):
  swap two adjacent notes, OR double one note as a stutter (same note
  twice at 60ms), OR jump one random note up an octave (pass
  `freq: voiceLeadFreq(note, prevFreq) * 2`). Slightly faster than pass 1
  (~85% spacing), `volume` 0.17. ~120ms breath between passes.
- **Pass 3 — the climax** (only when track length ≥ 4, else stop at 2
  passes): ascending run — the track's notes re-sorted low→high by
  `voiceLeadFreq` chain, spacing tightening 90ms→55ms as it climbs
  (accelerando), then the **final note of the original track** lands last,
  octave-up, ringing long (`holdTime` 1.1, `fadeTime` 1.0, `volume` 0.2)
  — the whammy-bar money note.
- **Length discipline:** total must stay ≤ ~2.8s (≈ today's groove length)
  so turn pacing and the fast-forward feel don't change. Compute pass
  spacing from `track.length` to guarantee it.
- **Optional garnish** (only if trivially clean): a single quiet
  `new Audio(shredMp3).play()` layered under pass 1, volume ~0.25, import
  `./sfx/shred.mp3` Vite-style like the PNGs at the top of the file. If it
  clashes or double-triggers, cut it without ceremony — the synth passes
  are the feature.

Keep `voiceLeadFreq` threading through every pass — that's what makes it a
lick instead of beeps. Acceptance: commit as Ronin → shred; commit as any
other spirit → identical to today; riff-discovery commits still play
`playRiffSequence` (shred only lives in the else-branch); bot Ronin shreds.

> **Drop-in code provided — see §E.1.** Do not re-derive the arrangement;
> paste it, wire the two-line call-site change, then tune by ear.

---

## D. Fan upgrade — richer SVG crowd (the standees got a glow-up; the fans earn theirs)

Owner's decision: **upgrade the drawn SVG fans in code** — no new image
assets, crisp at any zoom. (The PNG crowd art — `crowd_pink/blue.png` in
moshpits and battle fan-fare, `groupie_fans.png` for groupies — already
looks good and is untouched.)

### Current reality

- `fanPawnShape(x, y, r, color, filled, sw, op, face, bodyFlip, hands)` —
  top of the main file (search `function fanPawnShape`, banner `🎟️ A fan =
  a sleek "pawn"`). Detached round head + rounded-triangle body; `filled` =
  diehard (solid, owner color) vs casual (hollow outline `#cfe0ff`);
  `face` 0–3 animated expressions; `bodyFlip` mirrors the silhouette;
  `hands`: `'rest' | 'wave' | 'fist' | 'lighter'`.
- **Five call sites, all in the main file** (search `fanPawnShape(`):
  1. the FAN CROWDS sea (banner `🎤 FAN CROWDS`) — golden-angle phyllotaxis
     cluster per spirit, diehards front/solid, casuals behind/hollow,
     `fan-bob` CSS animation, soft blur glow per fan;
  2. & 3. two smaller clusters in the crew/pop-in blocks nearby;
  4. the Rock God crowd (search `excited ? 'wave' : fanGesture(i)`);
  5. the Game Over celebration fan.
- Variety is **deterministic by index**: `face = i % 4`,
  `bodyFlip = i % 2 === 1`, gesture via `fanGesture(i)` from
  `board/hexGeometry.js`. Keep it that way — **no `Math.random()` in
  render** (re-renders would make the crowd flicker-shuffle).
- `fan-bob` keyframes live in `ui/GameStyles.jsx` (search `@keyframes
  fan-bob`).
- Perf envelope: crowds can reach ~40–60 fans per spirit × 4 spirits, all
  individually CSS-animated. Today each fan ≈ 4–8 SVG nodes. Budget the
  upgrade at **≤ 12 nodes per fan** and keep all animation CSS-only.

### Design — from pawn to person

Upgrade `fanPawnShape` **in place, same signature** (all five call sites
keep working untouched; extra variety derives from the existing `face` /
`bodyFlip` params plus new deterministic derivations of them):

- **Body**: replace the plain triangle with a real silhouette — shoulders,
  waist pinch, and a hint of legs/stance (two short strokes below the hem;
  stance width varies with `bodyFlip`). Two jacket cuts chosen by
  `bodyFlip`: broad biker jacket vs slim tee.
- **Hair** (new, derived `hair = face % 4` — no signature change): 0 spiky
  crown (3–4 short triangles), 1 mohawk fin, 2 long headbanger curtain
  (slight overhang past the head circle — this one sells "metal crowd"),
  3 bald/shaved (nothing). Hair in the ink color (dark on diehards, glow
  color on casuals) so it reads at 5px like today's pawns do.
- **Hands**: keep the four existing gestures but add real forearms (a
  short stroke from the shoulder to the hand-circle) and upgrade `'fist'`
  into proper **devil horns** — hand circle + two tiny prong strokes. Add
  one new gesture `'phone'` (arm up, small glowing rounded-rect,
  cool-white `#cfe0ff` glow) and extend `fanGesture(i)` in
  `board/hexGeometry.js` to deal it out sparingly (~1 in 7).
- **Diehards vs casuals, louder**: diehards get the owner-color jacket
  with a thin lighter-shade collar stroke + slightly stronger glow (bump
  the existing per-fan blur circle at the FAN CROWDS call site from
  `0.20` → `0.26` opacity for diehards only); casuals stay hollow/dimmer —
  the front-row/back-row read must survive.
- **Motion**: add one keyframe set `fan-headbang` (rotate ±9° about the
  neck, `transform-origin` set inline per fan) to `ui/GameStyles.jsx` next
  to `fan-bob`. At the FAN CROWDS call site only, deal it deterministically
  (`i % 5 === 2`) instead of `fan-bob` so ~20% of the crowd headbangs
  while the rest bobs. Faces/mouth sing loops already stagger — keep them.
- **Keep**: the `headR > 2.4` detail gate (tiny fans stay simple — this is
  also the perf valve), the ink-color logic, golden-angle packing, count
  tags, pop-in bursts. None of that changes.

Acceptance: owner eyeballs a 4-spirit Testing Grounds game — crowds read
as rock fans at default zoom AND stay legible zoomed out; no jank while
four full crowds animate (if it stutters, first suspect per-fan `blur()`
filters — cheapen those before cutting figure detail); Rock God and Game
Over call sites render correctly (they pass different params — test both);
`npm run dev` console clean.

> **Drop-in code provided — see §E.2.** The replacement `fanPawnShape`,
> the `FAN_GESTURES` update, the headbang keyframes, and the FAN CROWDS
> call-site tweak are all written out. Do not re-derive the SVG geometry —
> hand-authored silhouettes are the hard part and they're done.

---

## E. Drop-in reference code (paste, don't re-derive)

Written against the live file by the session that authored this doc. The
*structure* is final; the raw numbers (spacings, volumes, path coordinates)
are good starting points — expect the owner to nudge a few by eye/ear in
`npm run dev`. Everything below is presentation-only; nothing touches the
engine.

### E.1 Ronin shred — `playShredSequence`

> **Superseded call-site note:** all four Spirits now get signature commit
> builds (see §E.3), so the gate is a style dispatcher rather than a Ronin
> boolean. Build E.1 and E.3 together as one commit
> (`polish: spirit commit builds`).

**Call-site change** — inside `confirmNoteTrack` (search
`playTrackSequence(melodyLine)`), the else-branch becomes:

```js
} else {
  playTrackSequence(melodyLine, { style: COMMIT_STYLES[acting?.id] });
}
```

**Signature change** — `playTrackSequence` gains a dispatcher at the very
top (its existing body stays byte-identical — it remains the default for
any future Spirit without a signature build):

```js
// 🎸 Signature commit builds — each Spirit plays their committed track in
// their OWN voiceprint. Unknown ids fall through to the classic groove.
const COMMIT_STYLES = {
  cosmic_ronin:      'shred',      // 🗡️ lightning passes + climax run
  Metalness_Monster: 'breakdown',  // 🤘 chug gallops + slam clusters
  intergalactic_0:   'pocket',     // 👽 swung 808 bassline
  Glamarchy:         'strut',      // 👑 stomp-clap swagger + glitter gliss
};

function playTrackSequence(track, opts = {}) {
  if (opts.style === 'shred')     { playShredSequence(track); return; }
  if (opts.style === 'breakdown') { playBreakdownSequence(track); return; }
  if (opts.style === 'pocket')    { playPocketSequence(track); return; }
  if (opts.style === 'strut')     { playStrutSequence(track); return; }
  // ... existing body unchanged ...
```

**New function** — paste directly below `playTrackSequence` (same scope —
it needs `playNoteSound`, `voiceLeadFreq`, and the imported `pitchIndex`):

```js
// 🗡️ SHREDDING RONIN — he doesn't play the committed track, he SHREDS it.
// Same notes, ripped as 2–3 lightning passes: the statement, a mutated
// variation, and (4+ note tracks) an accelerating ascending run capped by
// the money note. Scheduling is budgeted to ≈2.5s so turn pacing matches
// the normal groove. Math.random() here is audio flavour only — never a
// rule — so it needs no engine rng. His amp voice is already 'saw'; this
// only changes the PHRASING.
function playShredSequence(track) {
  const n = track.length;
  if (!n) return;
  const jitter = () => (Math.random() - 0.5) * 18;   // human, not quantised
  let tMs = 60;

  // Spacing shrinks as the track grows so all passes always fit the budget.
  const sp1 = Math.max(58, Math.min(105, Math.round(640 / n)));

  // ── PASS 1 — the statement: the track in order, brutally fast ──
  let prev = null;
  track.forEach((note, i) => {
    const f = voiceLeadFreq(note, prev); if (f) prev = f;
    setTimeout(() => playNoteSound(note, {
      holdTime: 0.12, fadeTime: 0.08,
      volume: i % 2 === 0 ? 0.16 : 0.13,             // alternate-picked accents
      freq: f ?? undefined,
    }), tMs + jitter());
    tMs += sp1;
  });
  tMs += 120;                                        // breath

  // ── PASS 2 — the variation: ONE mutation, dealt fresh every commit ──
  const varTrack = [...track];
  const roll = Math.random();
  let octIdx = -1;
  if (roll < 0.34 && n >= 2) {                       // swap two adjacent notes
    const k = Math.floor(Math.random() * (n - 1));
    [varTrack[k], varTrack[k + 1]] = [varTrack[k + 1], varTrack[k]];
  } else if (roll < 0.67) {                          // stutter-double one note
    const k = Math.floor(Math.random() * n);
    varTrack.splice(k, 0, varTrack[k]);
  } else {                                           // one note leaps an octave
    octIdx = Math.floor(Math.random() * n);
  }
  const sp2 = Math.max(50, Math.round(sp1 * 0.85));  // a hair faster — he's warm now
  prev = null;
  varTrack.forEach((note, i) => {
    let f = voiceLeadFreq(note, prev); if (f) prev = f;
    if (i === octIdx && f) f *= 2;
    setTimeout(() => playNoteSound(note, {
      holdTime: 0.11, fadeTime: 0.08,
      volume: i % 2 === 0 ? 0.17 : 0.14,
      freq: f ?? undefined,
    }), tMs + jitter());
    tMs += sp2;
  });

  // Short tracks stop here — two fast passes IS the shred…
  if (n < 4) {
    const last = track[n - 1];                       // …but the ending still rings.
    setTimeout(() => playNoteSound(last, {
      holdTime: 1.0, fadeTime: 0.9, volume: 0.19,
    }), tMs + 90);
    return;
  }
  tMs += 130;                                        // gather for the climax

  // ── PASS 3 — the climax: ascending run, accelerating, then the money note ──
  const run = [...track].sort((a, b) => pitchIndex(a) - pitchIndex(b));
  prev = null;
  run.forEach((note, i) => {
    let f = voiceLeadFreq(note, prev);
    // Force the climb (duplicate pitches would voice-lead flat), but cap it
    // below screech territory.
    if (f && prev && f <= prev && f < 900) f *= 2;
    if (f) prev = f;
    const sp = Math.round(90 - (35 * i) / Math.max(1, run.length - 1)); // 90→55ms accelerando
    setTimeout(() => playNoteSound(note, {
      holdTime: 0.10, fadeTime: 0.07,
      volume: 0.14 + (0.05 * i) / run.length,        // swelling into the peak
      freq: f ?? undefined,
    }), tMs + jitter());
    tMs += sp;
  });
  // 🎸 The money note — the track's real final note, octave up, ringing long.
  const last = track[n - 1];
  const lastF = voiceLeadFreq(last, prev);
  setTimeout(() => playNoteSound(last, {
    holdTime: 1.1, fadeTime: 1.0, volume: 0.2,
    freq: lastF ? lastF * 2 : undefined,
  }), tMs + 40);
}
```

Tuning notes for the owner: if it feels like beeping, raise `jitter` to ±25
and widen the accent gap (0.18/0.12); if the climax screeches, lower the
900 Hz climb cap; if it drags, drop the two breaths to 90/100ms.

### E.3 Signature commit builds — Monster, Intergalactic 0, Glamarchy

Owner-approved designs. Each Spirit's amp voice already carries the timbre
(`TONE_BY_SPIRIT`: Monster = `fuzz` at drive 0.82, Intergalactic =
`triangle` with verb, Glamarchy = `square` with echo 0.62) — these
functions supply only the PHRASING, same as the shred. Paste all three
below `playShredSequence`; the dispatcher in §E.1 already routes to them.
Same rules as the shred: `Math.random()` is audio flavour only; scheduled
length stays ≤ ~2.8s; bots trigger them through the same
`confirmNoteTrack` path — a bot Monster chugs, and that's correct.

```js
// 🤘 METALNESS MONSTER — the commit is a BREAKDOWN: the track dropped two
// octaves into chug register and played in GALLOPS (da-da-DUM palm mutes),
// trashed up with dissonant slam clusters on the offbeats, capped by a full
// power-chord SLAM. His fuzz voice supplies the distortion; this supplies
// the violence.
function playBreakdownSequence(track) {
  const n = track.length;
  if (!n) return;
  let tMs = 60;
  const jitter = () => (Math.random() - 0.5) * 14;      // tight but human
  const unit = Math.max(72, Math.min(110, Math.round(560 / n)));

  let prev = null;
  track.forEach((note, i) => {
    const f = voiceLeadFreq(note, prev); if (f) prev = f;
    // Two octaves down = the chug register. If laptop speakers swallow it,
    // owner's first knob: / 4 → / 2.
    const low = f ? f / 4 : undefined;
    if (i === n - 1) return;                            // finale is the SLAM
    // GALLOP — chug, chug, HIT.
    [0, 1, 2].forEach(k => {
      const accent = k === 2;
      setTimeout(() => playNoteSound(note, {
        holdTime: accent ? 0.16 : 0.08, fadeTime: 0.06,
        volume: accent ? 0.20 : 0.13,
        freq: low,
      }), tMs + jitter());
      tMs += accent ? unit * 1.6 : unit * 0.7;
    });
    // Every third note: a trashing CLUSTER — the chug note smeared against
    // its own detuned neighbours, struck together. Pure noise-wall.
    if (i % 3 === 2 && low) {
      setTimeout(() => {
        playNoteSound(note, { holdTime: 0.10, fadeTime: 0.08, volume: 0.13, freq: low * 1.06 });
        playNoteSound(note, { holdTime: 0.10, fadeTime: 0.08, volume: 0.13, freq: low * 0.94 });
      }, tMs + jitter());
      tMs += unit * 0.9;
    }
  });

  // ── THE SLAM — final note as a power chord (root + fifth + sub-octave),
  // struck once after a half-beat of dead air, left to ring ugly and long.
  const lastNote = track[n - 1];
  const lf = voiceLeadFreq(lastNote, prev);
  const root = lf ? lf / 2 : undefined;
  tMs += 90;
  setTimeout(() => {
    playNoteSound(lastNote, { holdTime: 1.2, fadeTime: 1.1, volume: 0.22, freq: root });
    playNoteSound(lastNote, { holdTime: 1.2, fadeTime: 1.1, volume: 0.15, freq: root ? root * 1.5 : undefined });
    playNoteSound(lastNote, { holdTime: 1.2, fadeTime: 1.1, volume: 0.17, freq: root ? root / 2 : undefined });
  }, tMs);
}

// 👽 INTERGALACTIC 0 — the commit drops into THE POCKET: an 808-deep swung
// bassline on a fixed head-nod grid. Ronin's shred is chaos; this is a
// metronome with swagger — the groove lives in the SPACE between hits
// (ghost notes, rests, downbeats that THUMP), and it ends on an octave POP
// into a long 808 boom.
function playPocketSequence(track) {
  const n = track.length;
  if (!n) return;
  const SIXTEENTH = 150;                                // ~100 BPM head-nod
  const SWING = 0.64;                                   // long-short pairs
  const longS  = Math.round(SIXTEENTH * 2 * SWING);
  const shortS = SIXTEENTH * 2 - longS;
  let tMs = 80, step = 0;
  let prev = null;
  track.forEach((note, i) => {
    const f = voiceLeadFreq(note, prev); if (f) prev = f;
    const sub = f ? f / 4 : undefined;                  // the 808 register
    const downbeat = i % 2 === 0;
    if (i === n - 1) {
      // Octave POP — the funk flourish…
      setTimeout(() => playNoteSound(note, {
        holdTime: 0.08, fadeTime: 0.06, volume: 0.12, freq: f ?? undefined,
      }), tMs);
      tMs += shortS;
      // …then the BOOM. Nod.
      setTimeout(() => playNoteSound(note, {
        holdTime: 0.9, fadeTime: 1.3, volume: 0.24, freq: sub,
      }), tMs);
      return;
    }
    setTimeout(() => playNoteSound(note, {
      holdTime: downbeat ? 0.30 : 0.16, fadeTime: 0.22,
      volume: downbeat ? 0.22 : 0.15,                   // downbeats THUMP
      freq: sub,
    }), tMs);
    tMs += step % 2 === 0 ? longS : shortS; step++;
    // Ghost note tucked in the gap — felt more than heard.
    if (downbeat && Math.random() < 0.6) {
      setTimeout(() => playNoteSound(note, {
        holdTime: 0.05, fadeTime: 0.05, volume: 0.06,
        freq: sub ? sub * 2 : undefined,
      }), tMs - Math.round(shortS * 0.45));
    }
    // A full breath of SPACE every four hits — the pocket IS the rests.
    if (i % 4 === 3) tMs += SIXTEENTH;
  });
}

// 👑 GLAMARCHY — the commit STRUTS: stomp-stomp-CLAP stadium swagger. Each
// note stomps low then answers itself an octave UP (the wide theatrical
// leap — the Flair idea from the DESIGN_AUDIT backlog, landed here); every
// third pair throws a bright CLAP stab that the echo knob (0.62) turns into
// slapback for free. Finish: a glitter glissando up the track's own notes
// into a held two-octave chord — the pose, the bow.
function playStrutSequence(track) {
  const n = track.length;
  if (!n) return;
  let tMs = 60;
  const unit = Math.max(120, Math.min(170, Math.round(920 / n))); // half-time swagger
  let prev = null;
  track.forEach((note, i) => {
    const f = voiceLeadFreq(note, prev); if (f) prev = f;
    if (i === n - 1) return;                            // finale below
    // STOMP — low and fat…
    setTimeout(() => playNoteSound(note, {
      holdTime: 0.22, fadeTime: 0.14, volume: 0.19, freq: f ? f / 2 : undefined,
    }), tMs);
    tMs += unit;
    // …answered an octave up on the offbeat — the hip-swing.
    setTimeout(() => playNoteSound(note, {
      holdTime: 0.12, fadeTime: 0.10, volume: 0.13, freq: f ?? undefined,
    }), tMs);
    tMs += Math.round(unit * 0.55);
    // Every third pair: the CLAP — two octaves up, short and bright.
    if (i % 3 === 2) {
      setTimeout(() => playNoteSound(note, {
        holdTime: 0.07, fadeTime: 0.08, volume: 0.15, freq: f ? f * 2 : undefined,
      }), tMs);
      tMs += Math.round(unit * 0.6);
    }
  });
  // ── GLITTER GLISS — fast run up the track's own notes into the finale.
  const run = [...track].sort((a, b) => pitchIndex(a) - pitchIndex(b));
  prev = null;
  run.forEach((note, i) => {
    let f = voiceLeadFreq(note, prev);
    if (f && prev && f <= prev && f < 1200) f *= 2;     // force the climb, capped
    if (f) prev = f;
    setTimeout(() => playNoteSound(note, {
      holdTime: 0.07, fadeTime: 0.06,
      volume: 0.10 + (0.05 * i) / run.length,
      freq: f ?? undefined,
    }), tMs);
    tMs += 55;
  });
  // ── THE POSE — final note as a wide two-octave chord, held like a bow.
  const lastNote = track[n - 1];
  const lf = voiceLeadFreq(lastNote, prev);
  setTimeout(() => {
    playNoteSound(lastNote, { holdTime: 1.1, fadeTime: 1.0, volume: 0.18, freq: lf ?? undefined });
    playNoteSound(lastNote, { holdTime: 1.1, fadeTime: 1.0, volume: 0.14, freq: lf ? lf / 2 : undefined });
  }, tMs + 60);
}
```

Per-build tuning notes for the owner:

- **Breakdown:** too muddy → chug register `/ 4` → `/ 2`; not messy enough
  → cluster detune `1.06 / 0.94` → `1.09 / 0.92` and fire it every 2nd note.
- **Pocket:** groove not landing → the grid is sacred, adjust ONLY `SWING`
  (0.58 = tighter, 0.68 = lazier); boom too quiet on laptops → `sub * 2`
  on the final boom only.
- **Strut:** swagger too slow → `920` → `780`; claps drowning → let the
  echo do it: drop clap volume to 0.12 rather than muting the knob.

Acceptance (extends §C's): each of the four Spirits commits with an
audibly DIFFERENT signature; a 1-note track doesn't crash any of the four
(the `i === n - 1` guards make it finale-only — verify by ear); total
commit-to-silence stays under ~4s for all; riff-discovery commits still
bypass all of this.

### E.2 Fan upgrade — replacement `fanPawnShape` + supporting edits

**(a) `board/hexGeometry.js`** — replace the `FAN_GESTURES` array (the
`fanGesture` function itself is unchanged):

```js
// Deterministic per-fan gesture: mostly rest/wave, a fair few horns, the odd
// phone-light (1 in 9) and lighter (1 in 9). Index-keyed so it never flickers.
export const FAN_GESTURES = ['rest','wave','fist','rest','phone','wave','fist','rest','lighter'];
```

**(b) `ui/GameStyles.jsx`** — add next to `@keyframes fan-bob`:

```css
/* 🤘 Headbanging — a hard nod about the hips, for the committed 20% */
@keyframes fan-headbang {
  0%, 100% { transform: rotate(0deg); }
  30%      { transform: rotate(-9deg); }
  45%      { transform: rotate(2deg); }
  70%      { transform: rotate(8deg); }
}
```

**(c) FAN CROWDS call site** (main file, banner `🎤 FAN CROWDS`) — the
per-fan wrapper `<g>` currently animates `fan-bob` only. Replace with:

```jsx
const bang = i % 5 === 2;   // ~20% of the crowd headbangs instead of bobbing
// ...
<g key={i} style={{
  animation: bang
    ? `fan-headbang ${(0.62 + (i % 3) * 0.07).toFixed(2)}s ease-in-out infinite`
    : `fan-bob ${dur}s ease-in-out infinite`,
  animationDelay: `${delay}s`,
  transformBox: 'fill-box', transformOrigin: '50% 85%'}}>
```

Also at this call site: diehard glow circle opacity `0.20` → `0.26`
(diehards only — the `isDie ? 0.20 : 0.10` ternary becomes `isDie ? 0.26 :
0.10`). The other four `fanPawnShape(` call sites need **no changes**.

**(d) The function itself** — replace `fanPawnShape` in the main file
wholesale (search `function fanPawnShape`). Same signature; `bodyFlip` now
picks the jacket cut + stance instead of mirroring the old triangle. The
FACE block is carried over from the current version verbatim:

```jsx
// 🎟️ A fan = a little rocker: haircut, jacketed body, legs, busy hands.
// Still deliberately generic — fans are the crowd, not characters — but they
// read as PEOPLE now, matching the upgraded standees. `filled` = diehard
// (solid, owner colour) vs casual (hollow outline). `face` (0..3) picks the
// expression AND the haircut; `bodyFlip` picks the cut: broad biker jacket
// vs slim tee. `hands`: 'rest'|'wave'|'fist' (devil horns)|'lighter'|'phone'.
// Everything derives from the caller's index params — NO Math.random() in
// here, or the crowd reshuffles on every re-render.
function fanPawnShape(x, y, r, color, filled, sw = 1.2, op = 1, face = null, bodyFlip = false, hands = null) {
  const headR = r * 0.42, headCy = y - r * 0.86;
  const apexY = y - r * 0.30, baseY = y + r * 0.74, halfW = r * 0.66;
  const ink    = filled ? '#0a0e18' : color;  // detail: dark on solid, glow on hollow
  const detail = headR > 2.4;                 // tiny fans stay simple — the perf valve

  // ── BODY — neck → shoulders → waist pinch → hem. Two cuts by bodyFlip. ──
  const biker = !bodyFlip;
  const shW  = halfW * (biker ? 1.04 : 0.86); // shoulder half-width
  const wW   = halfW * (biker ? 0.74 : 0.60); // waist pinch
  const hemW = halfW * (biker ? 0.84 : 0.64); // jacket flares, tee tapers
  const shY  = apexY + r * 0.14;
  const wY   = y + r * 0.26;
  const hemY = y + r * 0.52;
  const body =
    `M ${x - r * 0.15} ${apexY}` +
    ` C ${x - shW * 0.85} ${apexY + r * 0.02}, ${x - shW} ${shY}, ${x - shW * 0.96} ${shY + r * 0.10}` +
    ` C ${x - shW * 0.90} ${wY - r * 0.12}, ${x - wW} ${wY}, ${x - hemW} ${hemY}` +
    ` L ${x + hemW} ${hemY}` +
    ` C ${x + wW} ${wY}, ${x + shW * 0.90} ${wY - r * 0.12}, ${x + shW * 0.96} ${shY + r * 0.10}` +
    ` C ${x + shW} ${shY}, ${x + shW * 0.85} ${apexY + r * 0.02}, ${x + r * 0.15} ${apexY} Z`;

  // ── LEGS — two short strokes under the hem; stance follows the cut ──
  const stance = halfW * (biker ? 0.44 : 0.30);
  const legW   = Math.max(sw, r * 0.20);
  const legs = detail ? (
    <g stroke={color} strokeWidth={legW} strokeLinecap="round" opacity={op}>
      <line x1={x - stance * 0.8} y1={hemY} x2={x - stance} y2={baseY}/>
      <line x1={x + stance * 0.8} y1={hemY} x2={x + stance} y2={baseY}/>
    </g>
  ) : null;

  // ── HAIR — dealt by the face variant so heads vary with expressions ──
  let hairEls = null;
  if (detail && face !== null) {
    const hv = ((face % 4) + 4) % 4;
    const topY = headCy - headR;
    if (hv === 0) {
      // Punk spike crown
      hairEls = <path d={
        `M ${x - headR * 0.85} ${headCy - headR * 0.35}` +
        ` L ${x - headR * 0.72} ${topY - headR * 0.42} L ${x - headR * 0.38} ${headCy - headR * 0.72}` +
        ` L ${x - headR * 0.18} ${topY - headR * 0.62} L ${x + headR * 0.12} ${headCy - headR * 0.80}` +
        ` L ${x + headR * 0.40} ${topY - headR * 0.50} L ${x + headR * 0.62} ${headCy - headR * 0.55}` +
        ` L ${x + headR * 0.85} ${topY - headR * 0.10} L ${x + headR * 0.88} ${headCy - headR * 0.30} Z`}
        fill={ink} opacity={op}/>;
    } else if (hv === 1) {
      // Mohawk fin
      hairEls = <path d={
        `M ${x - headR * 0.22} ${headCy - headR * 0.80}` +
        ` Q ${x} ${topY - headR * 0.95} ${x + headR * 0.22} ${headCy - headR * 0.80}` +
        ` Q ${x} ${headCy - headR * 1.05} ${x - headR * 0.22} ${headCy - headR * 0.80} Z`}
        fill={ink} opacity={op}/>;
    } else if (hv === 2) {
      // Long headbanger curtains, draping past the jaw toward the shoulders
      hairEls = (
        <g fill={ink} opacity={op}>
          <path d={`M ${x - headR * 0.95} ${headCy - headR * 0.25} Q ${x - headR * 1.05} ${headCy + headR * 1.3} ${x - headR * 0.72} ${shY + r * 0.06} L ${x - headR * 0.55} ${headCy + headR * 0.55} Z`}/>
          <path d={`M ${x + headR * 0.95} ${headCy - headR * 0.25} Q ${x + headR * 1.05} ${headCy + headR * 1.3} ${x + headR * 0.72} ${shY + r * 0.06} L ${x + headR * 0.55} ${headCy + headR * 0.55} Z`}/>
          <path d={`M ${x - headR * 0.9} ${headCy - headR * 0.4} A ${headR} ${headR} 0 0 1 ${x + headR * 0.9} ${headCy - headR * 0.4} L ${x + headR * 0.7} ${headCy - headR * 0.15} A ${headR * 0.75} ${headR * 0.75} 0 0 0 ${x - headR * 0.7} ${headCy - headR * 0.15} Z`}/>
        </g>
      );
    }
    // hv === 3 → shaved. The bald head IS the haircut.
  }

  // ── FACE — ⚠️ CARRY OVER VERBATIM from the current fanPawnShape: the whole
  // block from `let faceEls = null;` through the `faceEls = (...)` assignment
  // (dot/happy eyes, four mouth variants, fan-sing / fan-blink loops). It is
  // already gated on `face !== null && headR > 2.4` and uses the same `ink`.
  let faceEls = null;
  /* … existing FACE block, unchanged … */

  // ── HANDS & ARMS — circle hands now get forearms; 'fist' throws HORNS ──
  let handsEls = null;
  if (hands && headR > 2.0) {
    const handR = headR * 0.46;
    const hf    = filled ? color : 'none';
    const armW  = Math.max(sw * 0.9, r * 0.14);
    const shoulderY = shY + r * 0.04;
    const arm = (sx, sy, hx2, hy2, key) => (
      <line key={key} x1={sx} y1={sy} x2={hx2} y2={hy2}
        stroke={color} strokeWidth={armW} strokeLinecap="round" opacity={op * 0.9}/>
    );
    const restY = y + r * 0.12, restDX = halfW * 0.94;
    const restHand = (side, key) => (
      <g key={key}>
        {detail && arm(x + side * shW * 0.9, shoulderY, x + side * restDX, restY - handR * 0.4)}
        <circle cx={x + side * restDX} cy={restY} r={handR}
          fill={hf} stroke={color} strokeWidth={sw} opacity={op}/>
      </g>
    );

    if (hands === 'wave') {
      // Both hands up, swaying in opposite phase — arms ride inside the
      // animated group so they stay attached (the slight shoulder drift is
      // invisible at crowd scale).
      const wy = headCy - headR * 0.7, wdx = halfW * 1.02, sway = headR * 0.55;
      const waver = (side, delay) => (
        <g style={{animation:'fan-wave 1.05s ease-in-out infinite', animationDelay: delay,
          ['--swA']:`${-sway}px`, ['--swB']:`${sway}px`}}>
          {detail && arm(x + side * shW * 0.9, shoulderY, x + side * wdx, wy + handR)}
          <circle cx={x + side * wdx} cy={wy} r={handR} fill={hf} stroke={color} strokeWidth={sw} opacity={op}/>
        </g>
      );
      handsEls = <g>{waver(-1, '0s')}{waver(1, '-0.525s')}</g>;
    } else if (hands === 'fist') {
      // 🤘 One arm thrown up in DEVIL HORNS, pumping; the other rests.
      const fy = headCy - headR * 1.05, fx = x + halfW * 0.35;
      handsEls = (
        <g>
          {restHand(-1, 'rest')}
          <g style={{animation:'fan-fist 0.7s ease-in-out infinite', ['--pump']:`${-(headR * 1.4)}px`}}>
            {detail && arm(x + shW * 0.9, shoulderY, fx, fy + handR)}
            <circle cx={fx} cy={fy} r={handR} fill={hf} stroke={color} strokeWidth={sw} opacity={op}/>
            {detail && <g stroke={color} strokeWidth={armW} strokeLinecap="round" opacity={op}>
              <line x1={fx - handR * 0.55} y1={fy - handR * 0.3} x2={fx - handR * 0.85} y2={fy - handR * 1.5}/>
              <line x1={fx + handR * 0.55} y1={fy - handR * 0.3} x2={fx + handR * 0.85} y2={fy - handR * 1.5}/>
            </g>}
          </g>
        </g>
      );
    } else if (hands === 'lighter') {
      // One hand holds a flickering flame aloft; the other rests.
      const ly = headCy - headR * 0.85, lx = x - halfW * 0.28;
      const flameY = ly - handR * 1.5;
      handsEls = (
        <g>
          {restHand(1, 'rest')}
          {detail && arm(x - shW * 0.9, shoulderY, lx, ly + handR)}
          <circle cx={lx} cy={ly} r={handR} fill={hf} stroke={color} strokeWidth={sw} opacity={op}/>
          <g style={{animation:'fan-flame 0.5s ease-in-out infinite',
            transformBox:'fill-box', transformOrigin:'center bottom',
            filter:'drop-shadow(0 0 2px #ff7a00)'}}>
            <ellipse cx={lx} cy={flameY} rx={handR * 0.5} ry={handR * 0.95} fill="#ff9a2e"/>
            <ellipse cx={lx} cy={flameY + handR * 0.2} rx={handR * 0.26} ry={handR * 0.5} fill="#ffe28a"/>
          </g>
        </g>
      );
    } else if (hands === 'phone') {
      // 📱 A phone-light held high, swaying slow — the modern lighter.
      const py2 = headCy - headR * 1.1, px2 = x - halfW * 0.3;
      handsEls = (
        <g>
          {restHand(1, 'rest')}
          <g style={{animation:'fan-wave 2.2s ease-in-out infinite',
            ['--swA']:`${-headR * 0.3}px`, ['--swB']:`${headR * 0.3}px`}}>
            {detail && arm(x - shW * 0.9, shoulderY, px2, py2 + handR)}
            <rect x={px2 - handR * 0.42} y={py2 - handR * 0.9}
              width={handR * 0.84} height={handR * 1.3} rx={handR * 0.2}
              fill="#cfe0ff" opacity={op} style={{filter:'drop-shadow(0 0 2px #cfe0ff)'}}/>
          </g>
        </g>
      );
    } else {
      handsEls = <g>{restHand(-1, 'l')}{restHand(1, 'r')}</g>;
    }
  }

  return (
    <>
      <path d={body} fill={filled ? color : 'none'} stroke={color} strokeWidth={sw}
        strokeLinejoin="round" strokeLinecap="round" opacity={op}/>
      {legs}
      <circle cx={x} cy={headCy} r={headR} fill={filled ? color : '#0a0e18'}
        stroke={color} strokeWidth={sw} opacity={op}/>
      {hairEls}
      {faceEls}
      {handsEls}
    </>
  );
}
```

Two implementation warnings for the builder: (1) the FACE splice — the
`/* … existing FACE block, unchanged … */` marker must be replaced with the
real block from the current function BEFORE the old function is deleted;
copy it out first. (2) diehards previously used `bodyFlip` to mirror the
triangle — the new meaning (jacket cut) needs no call-site change since
`i % 2 === 1` now simply deals cuts 50/50. Node budget lands at ~10–13 per
fully-detailed fan; the `detail` gates keep zoomed-out fans as cheap as
today's.

---

## F. Corner grandstands — the fan crowds get a home (extends Feature D)

Owner-approved follow-up to D: today the fan clusters float in the dark
margin. Replace the free-floating phyllotaxis cluster with a **terraced
standing riser** at each home corner — steel-blue stepped platforms facing
the board, a barricade rail in the owner's color, fans standing on the
steps. Ship as its own commit (`polish: corner grandstands`), with or after
Feature D — it swaps the *placement* math and keeps the upgraded pawns.

Why it's worth it: the caps (`FAN_DIEHARD_CAP` = 6, `FAN_CASUAL_CAP` = 14,
`data/gameConstants.js`) become **visible capacity** — 20 seats in 4 rows
of 5. A full stand reads "winning the crowd war" at a glance; dashed empty
slots read "room to grow"; a post-battle fan flee visibly empties seats.
Standing risers, NOT seated chairs — it's a rock show, and the pawns'
bob/headbang animations only make sense standing.

### What changes / what doesn't

- **Changes:** the FAN CROWDS placement loop (banner `🎤 FAN CROWDS`), the
  pop-in target math in the same block, and the count tag (becomes
  `🎤 {total} / 20`-style). New pure-geometry helpers go in
  `board/hexGeometry.js` (its header says math lives there).
- **Doesn't change:** `fanPawnShape` itself, the fireworks/scatter/reaction
  FX (they key off `anchorX/anchorY` — untouched), the crew & groupies
  muster (`CREW_OUT = HS * 1.75` puts them between the home pocket and the
  rail — they now read as pit crew inside the barricade, a happy accident),
  the Rock God and Game Over fan call sites, and all fan *economy* rules.
- Diehards keep the existing convention `isDie = i < D` — they fill the
  seat sequence first, which puts them at the front rail.

### F.1 Geometry helpers — add to `board/hexGeometry.js`

```js
// ── 🏟️ GRANDSTAND — seat + tier geometry for the corner fan stands ──────────
// The stand faces the board hub. (ox, oy) is the outward unit vector from hub
// through the home corner (the FAN CROWDS block already computes it); the
// perpendicular (-oy, ox) runs along the rows. Row 0 is the front (nearest
// the board); deeper rows step outward by rowGap. Seats fill CENTRE-OUT
// (slot order 0, -1, +1, -2, +2) so a thin crowd huddles mid-stand instead
// of queueing from one end. Pure math, index-keyed — stable across renders.
export function grandstandSeat(i, anchorX, anchorY, ox, oy, seatGap, rowGap, rowLen = 5) {
  const row = Math.floor(i / rowLen), col = i % rowLen;
  const slot = (col % 2 ? -1 : 1) * Math.ceil(col / 2);   // 0,-1,+1,-2,+2
  const pxv = -oy, pyv = ox;
  const along = slot * seatGap, depth = row * rowGap;
  return { row,
    x: anchorX + pxv * along + ox * depth,
    y: anchorY + pyv * along + oy * depth };
}

// One tier platform as an SVG polygon points string. Slight taper with depth
// fakes perspective; the 0.6-seat overhang past the end seats reads as the
// platform edge.
export function grandstandTier(row, anchorX, anchorY, ox, oy, seatGap, rowGap, rowLen = 5) {
  const pxv = -oy, pyv = ox;
  const halfL = (rowLen / 2 + 0.6) * seatGap * (1 - row * 0.04);
  const d0 = row * rowGap - rowGap * 0.42, d1 = row * rowGap + rowGap * 0.42;
  const pt = (along, depth) =>
    `${(anchorX + pxv * along + ox * depth).toFixed(1)},${(anchorY + pyv * along + oy * depth).toFixed(1)}`;
  return `${pt(-halfL, d0)} ${pt(halfL, d0)} ${pt(halfL * 0.96, d1)} ${pt(-halfL * 0.96, d1)}`;
}
```

Extend the main file's existing `hexGeometry.js` import (search
`fanGesture, axialDist`) with `grandstandSeat, grandstandTier`.

### F.2 FAN CROWDS block — the swap

Inside the block (all existing locals — `anchorX/anchorY`, `ox/oy`, `dot`,
`clamp`, `D`, `C`, `total`, `popN`, `visibleTotal`, `sc` — stay):

**(a) Placement loop.** Replace the phyllotaxis `for` loop (golden-angle
`ang = i * 2.39996` … `MIN_R` push-out) with seat lookup — the `MIN_R`
floor is no longer needed because row 0 sits at the anchor, which is
already beyond it by construction:

```jsx
const CAPACITY = FAN_DIEHARD_CAP + FAN_CASUAL_CAP;      // 20 — 4 rows × 5
const seatGap = HS * 0.62, rowGap = HS * 0.72;
const fans = [];
for (let i = 0; i < Math.min(visibleTotal, CAPACITY); i++) {
  const isDie = i < D;
  let { fx, fy } = (() => {
    const s = grandstandSeat(i, anchorX, anchorY, ox, oy, seatGap, rowGap);
    return { fx: clamp(s.x, 4, SVG_W - 4), fy: clamp(s.y, 4, SVG_H - 4) };
  })();
  fans.push({ i, isDie, fx, fy });
}
```

**(b) Structure — render BEFORE the fans, inside the same `<g>`**
(back-to-front tiers, then empty seats, then fans deepest-row-first so
front-row pawns overlap the row behind, then the rail on top):

```jsx
{/* tiers, back to front */}
{[3, 2, 1, 0].map(rw => (
  <polygon key={`tier-${rw}`}
    points={grandstandTier(rw, anchorX, anchorY, ox, oy, seatGap, rowGap)}
    fill={rw % 2 ? '#101d3a' : '#0d1830'} stroke="#24406a" strokeWidth={1}/>
))}
{/* empty seats — dashed capacity markers (static + cheap: 1 node each) */}
{Array.from({ length: Math.max(0, CAPACITY - visibleTotal) }, (_, k) => {
  const s = grandstandSeat(visibleTotal + k, anchorX, anchorY, ox, oy, seatGap, rowGap);
  return <circle key={`seat-${k}`} cx={clamp(s.x, 4, SVG_W - 4)} cy={clamp(s.y, 4, SVG_H - 4)}
    r={dot * 0.5} fill="none" stroke="#1e3a5f" strokeWidth={1}
    strokeDasharray="2 2" opacity={0.4}/>;
})}
```

Then render `[...fans].reverse().map(...)` instead of `fans.map(...)` —
the per-fan glow + `fanPawnShape` + bob/headbang wrapper is otherwise
unchanged. After the fans, the rail:

```jsx
{/* 🚧 barricade rail — owner colour, in front of row 0 */}
{(() => {
  const pxv = -oy, pyv = ox;
  const halfL = (5 / 2 + 0.6) * seatGap;
  const d = -rowGap * 0.55;
  const rx1 = anchorX - pxv * halfL + ox * d, ry1 = anchorY - pyv * halfL + oy * d;
  const rx2 = anchorX + pxv * halfL + ox * d, ry2 = anchorY + pyv * halfL + oy * d;
  return (
    <g stroke={sc} strokeWidth={1.6} opacity={0.85}
       style={{filter:`drop-shadow(0 0 3px ${sc})`}}>
      <line x1={rx1} y1={ry1} x2={rx2} y2={ry2}/>
      {[0.12, 0.3, 0.5, 0.7, 0.88].map(t => {
        const px2 = rx1 + (rx2 - rx1) * t, py2 = ry1 + (ry2 - ry1) * t;
        return <line key={t} x1={px2} y1={py2}
          x2={px2 + ox * dot * 0.9} y2={py2 + oy * dot * 0.9}/>;
      })}
    </g>
  );
})()}
```

**(c) Pop-in retarget.** In the `🎤 POP-IN` sub-block, replace its copy of
the phyllotaxis math (`ang`/`rad`/`MIN_R`) with the same
`grandstandSeat(i, …)` + clamp — new arrivals now pop into their actual
seats. Everything else in the pop-in (timing, keys, animation) stays.

**(d) Count tag.** Move it past the back row and show capacity:
`y = anchorY + oy * rowGap * 4.6` (keep the x), text `🎤 {total} / {CAPACITY}`.

### F.3 Fit & tuning

- **Clearance:** the stand's back row reaches ≈ `FAN_OUT + 3·rowGap` ≈
  5.7·HS past the home corner vs ≈ 5.1·HS for today's full cluster — close,
  but check all four corners at min zoom. If the top corners clip the SVG
  edge (the `clamp` will pancake the back row flat against it), pull
  `FAN_OUT` from `HS * 3.5` to `HS * 3.1` and/or `rowGap` to `HS * 0.62` —
  both are single constants.
- The `sww`/`r`/opacity per-fan styling and the diehard-vs-casual sizing
  stay exactly as they are; do not shrink back-row pawns in v1 (depth
  taper on the tiers is enough perspective).
- Perf: this REMOVES per-fan trig (phyllotaxis + push-out) and adds ~26
  static nodes per corner (4 tiers + ≤20 seat markers + rail). Net cheaper.

Acceptance: Testing Grounds, all four corners — stands face the hub
correctly (the rotation is pure (ox,oy) math: if one corner's stand faces
sideways, the bug is a sign flip in the perpendicular); fans fill
centre-out, diehards at the rail; buy fans → pop-in lands on seats and
dashed markers disappear; lose a battle → seats visibly empty; fireworks
and scatter FX still centre on the stand; no clipping at any corner at
default and min zoom.

---

## Verification bundle (all features)

- Lint every new/changed file in `/tmp` per the MULTIPLAYER_HANDOFF §2
  workflow; owner smoke-tests via `npm run dev` after EACH feature commit.
- Feature-order commits: `polish: spirit commit builds` (E.1 + E.3
  together), `polish: fan crowd upgrade`, `polish: corner grandstands`,
  `polish: smash-style spirit select`, `polish: opening movie template`.
- Regression sweep after all four: start 2P/3P/4P/team games, one full
  turn each, one riff-off, one Testing Grounds run — identical rules
  behavior throughout (these are presentation-only changes; any rules
  diff = a bug you introduced).
