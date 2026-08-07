# Asset provenance

This file records who or what made each asset in RLSW. It exists for two
reasons, and they pull in the same direction:

1. **Authorship.** It's a dated, public statement of which work is original
   and mine, framed by me rather than guessed at by someone reading the
   commit history.
2. **Honesty.** Where generative AI or third-party material was used, it
   says so plainly, in one place, rather than leaving people to wonder.

It also matters legally. Under current U.S. Copyright Office guidance,
purely AI-generated material can't be registered and must be *disclaimed*
on a registration application, with a description of the human
contribution. Overclaiming — registering AI-generated or third-party
material as your own — can get a registration cancelled or challenged. So
the accuracy of the tables below is the whole point of them. **A confident
wrong entry here is worse than an honest "unsure".**

---

## Original work — authored by yoshi80085

### Characters

| Asset | Notes |
|---|---|
| `src/standees/Cosmic_Ronin.png` (+ `_mirror`) | Character art |
| `src/standees/Glamarchy.png` (+ `_mirror`, `_CC_1`) | Character art |
| `src/standees/Intergalactic_0.png` (+ `_mirror`) | Character art |
| `src/standees/Metalness_monster.png` (+ `_mirror`) | Character art |
| `public/standees/flamboyant-g.PNG` | Character art |

### Board, stage and amps

| Asset | Notes |
|---|---|
| `src/board.png`, `src/board3.png` | Board art |
| `src/board_outline.png`, `src/board_score_track.png` | Board art |
| `src/amps/` — all 36 files (`amp_{tl,tr,bl,br,l_up,l_low,r_up,r_low}_lv{1,2,3}.png`) | Amp stack art |
| `src/amp_lv1-3.png`, `src/amp_level_1-3.png`, `src/amp_levels.png` | Earlier amp art |
| `src/assets/opening_island.png` | Floating stage art |
| `src/neon_guitar.png`, `src/neon_guitar_neck.png` | Neon guitar |

### Interface and crowd

| Asset | Notes |
|---|---|
| `src/Battle_Meter.png` | Battle overlay |
| `src/battle_pick.png` | Battle pick art — Pickles' silhouette is traced from it |
| `src/groupie_fans.PNG` | Crowd art |
| `src/crowd_blue.png`, `src/crowd_pink.png` | Crowd art |
| `src/fans sprites.png` | Crowd art |

### Music

| Asset | Notes |
|---|---|
| `src/Master_of_Moshpits_song.mp3` | Metalness Monster's Sustain theme |
| `src/Menu_song_3.mp3` | Menu |
| `src/Riff_off_song.mp3` | Riff-off |
| `src/battle_song.mp3` | Battle |
| `src/rl_movie_song.mp3` | Opening movie |

### Code and writing

All game code is original work: `src/engine/`, `src/net/`, `src/hooks/`,
`src/data/`, `src/music/`, `src/ui/`, `src/board/`, all `.jsx` components,
and `server/`.

All written material is original work: `README.md`, the design and handoff
documents, and the in-game text — character bios, lore, trivia, and tips.

---

## Generative AI was used

No claim of copyright authorship is made over this material.

| Asset | Notes |
|---|---|
| `src/board_lightning_animated.png` | Animation / motion |
| `src/board_stars_animated.png` | Animation / motion |
| `src/amp_pulse.png` | Stage effect |
| `src/amp_hex_ring.png` | HUD / stage effect |
| `src/ui/Pickles.jsx` — face, expressions and motion | See note below |

Motion, animation, stage effects, and HUD treatment throughout were
produced with generative AI assistance.

**Pickles** (`src/ui/Pickles.jsx`) is a mixed case worth stating precisely.
He's the beginner-tip mascot, drawn as inline SVG rather than as an image
file. His *silhouette* is derived from `battle_pick.png` — original art —
by tracing its alpha channel, so that outline is downstream of human work.
His face geometry, expressions, and animation are AI-generated as of this
writing. He is intended to be redrawn by hand, at which point this entry
moves to the original-work table.

---

## Third-party

Not original work, not AI, and **not covered by the copyright claim in
`LICENSE`**.

### Sound effects — ⚠️ sources need to be recovered

These are free sound files sourced online. "Free" is not the same as
unrestricted: most free sound libraries attach conditions, commonly
attribution (CC-BY), and some prohibit redistributing the raw file.
Until each one's origin and licence is identified, this section is
incomplete and these files carry unknown obligations.

| Asset | Source | Licence |
|---|---|---|
| `src/sfx/koto.mp3` | *unknown — to identify* | *unknown* |
| `src/sfx/scratch.mp3` | *unknown — to identify* | *unknown* |
| `src/sfx/shred.mp3` | *unknown — to identify* | *unknown* |
| `src/sfx/spray.mp3` | *unknown — to identify* | *unknown* |
| `src/rumble.mp3` | *unknown — to identify* | *unknown* |
| `src/thunder.mp3` | *unknown — to identify* | *unknown* |

### Software and fonts

- **React**, **Vite**, and **ws** — dependencies under their own licences.
- **Share Tech Mono**, **Saira Stencil One**, **Saira** — Google Fonts,
  loaded via CDN in `index.html`, used under their own licences.

---

## Still unclassified

| Asset | Question |
|---|---|
| `src/Bardbarian.png` | What is this — character art, or unused? |
| `src/RL_Card.png` | Unclear what this is |
| `src/rl_movie_1.m4v` | Opening movie video — original, or rendered with AI? |
| `public/favicon.svg`, `public/icons.svg` | Yours, generated, or from an icon set? |

---

## Maintaining this

Add a row whenever an asset is added. The value of this file is entirely in
it being current and accurate; a stale manifest is worse than none, because
it looks like a claim.
