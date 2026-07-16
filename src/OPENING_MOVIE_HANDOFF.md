# OPENING_MOVIE_HANDOFF.md — "ROCK LEGENDS" animated intro cinematic

Handoff spec for rebuilding the opening movie as a fully code-driven animated
scene inside `src/ui/OpeningMovie.jsx`. Replaces the `rl_movie_1.m4v` scene.
Written 2026-07-16.

## Why in-engine instead of a rendered video

The owner tried TikTok's glitch/distortion generators: wrong output proportions,
and no Ken Burns control. Building the cinematic in React/CSS/SVG solves both —
it renders at ANY window aspect, Ken Burns is a CSS transform we own, and every
effect syncs to narration beats. It also weighs ~nothing vs a 120s m4v.

## Hard constraints (read `OpeningMovie.jsx` first)

- **Pure presentation.** No engine imports, no game state. Same rule as the
  existing file.
- **Skippable.** The existing any-key/click/tap skip must keep working. Build
  the cinematic as ONE new scene in the `STORYBOARD` array (new scene kind,
  e.g. `cinematic: true`) so the storyboard player, crossfade, and skip logic
  stay untouched. Keep the existing `logo` scene after it.
- **Muted-safe.** Autoplay policies: no audio before user gesture is
  guaranteed. Narration is on-screen CAPTION TEXT (styled, per beat). SFX/BGM
  optional and must fail silently.
- **Single file preferred.** All keyframes/SVG in `OpeningMovie.jsx` (inline
  `<style>` tag for @keyframes, as the file already does). One new asset
  import.

## Assets

| Asset | Path | Status |
|---|---|---|
| Hero artwork (island in space) | `src/assets/opening_island.png` | ⚠️ OWNER MUST SAVE IT HERE (2521×2600 PNG from design session) |
| Spirit silhouettes | `src/standees/Cosmic_Ronin.png`, `Glamarchy.png`, `Intergalactic_0.png`, `Metalness_Monster.png` | exists — silhouette via `filter: brightness(0) drop-shadow(...)` |
| Fan/crowd silhouettes | `src/groupie_fans.PNG`, `src/crowd_blue.png`, `src/crowd_pink.png` | exists — same silhouette treatment |
| Rock God silhouette | `src/hydra.PNG` (plus custom SVG towering figures) | partial — draw 2 generic towering horned/winged figures as inline SVG paths |
| Instrument silhouettes | none | draw inline SVG: flying-V guitar, keytar, drum kit + sticks, mic on stand (simple filled paths, ~40 pts each) |

## Image geometry map (percent of image width/height — resolution independent)

Anchor every effect to these regions of `opening_island.png`:

- **Stage deck (pink neon rim + hex grid):** x 30–68%, y 28–36%. Limelight hex centre ≈ (50%, 33%).
- **Island rock mass:** x 28–70%, y 28–76% (bottom tip ≈ y 76%).
- **Baked-in lightning bolts on the rock:** blue ≈ (36–46%, 40–62%), green ≈ (52–64%, 37–55%). Pulse-animate OVER these with matching colors.
- **Planets:** dark sphere left ≈ (15%, 29%) r 4.5%; planet right ≈ (76%, 30%) r 5%; small moon top-right ≈ (72%, 12%).
- **Nebula clouds (electric-pulse targets):** TL (9–36%, 4–25%) · TR (65–98%, 8–25%) · mid-L (0–29%, 32–59%) · centre-behind-island (23–46%, 52–62%) · mid-R (59–90%, 49–65%) · BL (2–41%, 73–98%) · BR (54–98%, 75–98%).

## Effects toolkit (CSS/SVG recipes)

1. **Ken Burns:** the image sits in an oversized layer; animate
   `transform: scale()/translate()` with long `ease-in-out` keyframes. Never
   animate width/height. Camera keyframes live in one `@keyframes om-cine-cam`
   (or JS-driven beat-indexed transforms — beats already need JS timing).
2. **Glitch / screen tear:** 2 extra copies of the image layer, clipped to
   3–6 thin horizontal bands (`clip-path: inset()`), offset ±4–12px X, tinted
   red/cyan (`mix-blend-mode: screen`), visible only in 80–200ms bursts via
   steps() keyframes. Randomize band Y positions per burst (JS re-roll).
3. **Analog distortion:** SVG `<filter>` with `feTurbulence` +
   `feDisplacementMap` (scale 0 → 25 → 0) applied to the image layer during
   burst moments; plus a faint scanline overlay (repeating-linear-gradient,
   3px period, 4–6% opacity) that's ALWAYS on.
4. **Chromatic aberration (constant, subtle):** the 2 tinted copies at ±1.5px
   offset, low opacity, always on — sells the "broadcast from space" look.
5. **Cloud electric pulses:** per cloud region, a radial-gradient blob
   (`#c084fc` core → transparent) with `mix-blend-mode: screen`, flickering
   opacity 0 → 0.5 → 0 on randomized 2–5s cycles, plus occasional intra-cloud
   micro-arcs: short 3-segment SVG polylines, 2px, white→violet glow
   (`feGaussianBlur` glow filter), 120ms lifetime.
6. **Lightning bursts:** full bolts as SVG polylines (6–10 jagged segments,
   generated once with a seeded random walk), stroke white with a colored
   glow, revealed with a 3-frame flicker (on/off/on) + a full-screen white
   flash div at 12–18% opacity for 90ms. Reuse for the two baked-in island
   bolts (trace over their coordinates above) and for sky strikes.
7. **Silhouettes:** PNGs with `filter: brightness(0)` + colored rim
   (`drop-shadow(0 0 12px <realm color>)`). Enter via scale-up + fade +
   1 glitch burst; idle with a slow bob; exit via dissolve (opacity +
   `feTurbulence` displacement ramp).
8. **Title blast ("ROCK LEGENDS"):** SVG `<text>` (Orbitron, the game's
   display font), fill `#0a0a14`, stroke `#ff2fd6` → animate stroke to
   `#66e0ff` shimmer, heavy multi-layer glow. Entrance: mega lightning strike
   hits the stage → white flash → letters slam in with a 2-frame RGB-split
   shake → sparks (10–15 short lines radiating, 300ms). Subtitle
   `SPIRIT WARS` fades in under it. Hold ≥ 2.5s.

## Script (final — additions marked ★)

> From the furthest corners of the Cosmos, Spirits arise — each born from a
> unique Musical Realm, each Dimension carrying its own Space-Time signature
> and genre.
>
> These Spirits have mastered their music completely. Their instruments are
> their weapons. Their sound is their power.
>
> ★ Four realms. Four sounds. One stage.
>
> For eons, Genre Gate-keepers and Purists bickered endlessly about whose
> music was the greatest. To settle the debate once and for all, The Gods
> deployed a concert stage at the very edge of the Cosmos.
>
> This isn't just a battle for glory and legend status. It's a battle for the
> soul of Music itself — to pilot the very Destiny of the Cosmos. The Gods and
> History await its Victor.
>
> ★ The amps are humming. The Cosmos is listening.
>
> **ROCK LEGENDS** *(title blast — the narration's answer, not a cold card)*

## Timeline (≈72s total · captions render 1 beat at a time, bottom third)

| Beat | Time | Narration | Camera (Ken Burns) | Effects & silhouettes |
|---|---|---|---|---|
| 0 | 0–3s | — | static wide, scale 1.0 | black → glitch-in reveal (2 tear bursts), scanlines fade in |
| 1 | 3–16s | "From the furthest corners… genre." | slow zoom 1.0→1.12, centred | cloud pulses begin; 4 Spirit silhouettes rise from the 4 corner clouds (staggered 1.2s), each rimmed in their realm color (Ronin gold, Glamarchy pink, Intergalactic teal, Metalness red) |
| 2 | 16–26s | "These Spirits have mastered… their power." | 1.12→1.25, drift toward stage | on "instruments are their weapons": 4 instrument silhouettes flash in sequence next to their Spirits, one RGB-split pulse per flash |
| 3 | 26–30s | ★ "Four realms. Four sounds. One stage." | quick settle, micro zoom-out 1.25→1.22 | all 4 silhouettes pulse once in unison; stage rim brightens |
| 4 | 30–42s | "For eons, Genre Gate-keepers… greatest." | lateral pan L→R across clouds, hold 1.22 | fan-crowd silhouettes fill opposing clouds (blue vs pink, from `crowd_*.png`); alternating flicker glow = the bickering; micro-arcs jump BETWEEN cloud groups |
| 5 | 42–50s | "To settle the debate… edge of the Cosmos." | punch-in 1.22→1.55 onto the island | biggest lightning burst + white flash on "deployed"; 2 Rock God silhouettes tower BEHIND the island (scale ~2× island height, backlit violet); hex grid ripple (opacity wave across the deck region) |
| 6 | 50–62s | "This isn't just a battle… await its Victor." | slow push 1.55→1.85 into the Limelight hex | heartbeat sync: clouds, bolts, stage rim all pulse on a shared 1.1s cycle; glitch bursts ramp in frequency |
| 7 | 62–66s | ★ "The amps are humming. The Cosmos is listening." | hold 1.85, slight shake | silhouettes dissolve INTO the stage; distortion ramps to max |
| 8 | 66–72s | — | snap back to 1.3 on the strike | mega bolt strikes the Limelight → white flash → **ROCK LEGENDS** title blast + sparks; `SPIRIT WARS` subtitle; hold; fade to black → existing `logo` scene |

## Caption styling

Monospace or Orbitron, ~1.1rem, `#e8e0ff`, subtle violet text-shadow, bottom
12% of frame, max-width 34rem, fade 300ms in/out per beat. Beat timing table
lives in one `BEATS` array (start, end, text, cameraKeyframe, cues[]) — the
owner tunes the movie by editing that array only, same philosophy as
`STORYBOARD`.

## Acceptance checklist

- [ ] Plays on launch before Spirit Select; any input skips instantly
- [ ] No aspect-ratio letterbox bugs at 16:9, 16:10, and a phone-ish portrait window
- [ ] All 8 beats fire with captions matching the script above
- [ ] Silhouettes: 4 Spirits, 4 instruments, 2 crowd factions, 2 Rock Gods
- [ ] Ken Burns is continuous — no visible jumps except the intended beat-8 snap
- [ ] Title blast lands with lightning + flash + shake, holds ≥ 2.5s
- [ ] 60fps-friendly: transforms/opacity only (no layout animation); `feTurbulence` filters active only during bursts
- [ ] `logo` scene still follows; total runtime ≈ 75s
- [ ] No engine imports; works with `image: null` fallback if the PNG is missing (placeholder frame, movie still runs)
