# Handoffs before the Bardbarian preview

## 54-sustain. Living Sustain shield — 2026-10-04

Alex supplied the complete oval-hex/glitter settings, asked for progressive shedding,
weakening and breaking, then requested implementation in the game. The preview's
renderer is now `board/sustainShield.js`; shed glitter, wounds and curved ring
fragments are `board/sustainDamage.js`. `sonicClashVisuals` feeds the real shot
ledger to them, including Bushido's shield-only route. No synthetic preview hit
count reaches gameplay. The taller shield stays above the floor, while its shallow
face meets the beam at the same stand-off. The existing combat clock freezes and
slows all shield motion and debris together.

The inspector remains adjustable, importing production code. Its previous shield
comparison is frozen in `previews/sustain-shield/legacyShield.js`. The exact shape
is the **Your shape** preset; the damage knobs use the defaults at implementation.
Checks: six new production Sustain checks (included in `test:sonicfx`), existing
Sonic visuals, the real Bushido arena sequence, browser rendering and production
build. The unrelated ability-demo suite reports one existing scratch-preview
coverage failure: `swapDelay` is absent from `.scratch/ability-demo-preview.jsx`.


## 53-pyro. 🎆 Pyro is Astra's mortars — they fire every turn, a shove stops on one — 2026-10-02

Alex, on porting the pyro-shove preview: *"I want a Spirit that if it gets shoved
into or in the way of a blaster/mortar to stop on the mortar — get blasted up and
fall back on the mortar that then disassembles down into the arena again."* Then the
rules: *"they fire under 2 conditions — 1. end of a player's turn (not a full round)
… coming back before the start of the next player's turn, or 2. if a player gets
pushed into it … it stops on the mortar and takes damage … 1st round about 5
mortars, 2nd 10 or so, 3rd 13 or so"*, and *"real Vibe damage — like 3 or so"*.
Mortars only — no blasters, no curtain.

- 🎲 **The rules — pyro v2** (`data/stageEffects.js`, `engine/systems/stageFx.js`):
  `PYRO_TURN_ENDED` (every armed mortar fires; `caught` = whoever stands on one),
  `PYRO_TURN_STARTED` (re-arm on fresh hexes, sized `PYRO_ROUND_HEXES` 5/10/13 by
  show round), `PYRO_CHARGE_STRUCK` (a forced move entered one: it is spent, the
  state remembers who in `pyro.struck`). The round tick is only the show clock.
  `PYRO_DAMAGE` 1 → **3**. ⚠️ **Versioned**: only an activation carrying
  `pyroVersion: 2` runs them — the client opts in; a replay log recorded before
  keeps the old round-clock cadence, bit for bit (`test:stagefx` unchanged, 90).
- 💥 **The stop** — `battleFlow.js` `knockback` ends the slide ON an armed mortar
  (read inline: `stageFx.js` already imports `battleFlow`) and hands the client's
  `hexHazards` hook `pyroStruck`; the client's own pushes (`battleKnockback`, the
  one-hex push, the TV scatter) ask `strikePyroCharge` first. Walking / sliding /
  Shukuchi do not set one off — you are simply standing on it at your turn's end.
  The END TURN volley runs before the round block, the re-arm after it, so a show's
  last volley closes it and no armed mortar is left to fizzle.
- 🎬 **The look** — one tracked copy of each preview module, which the `.scratch`
  pages now import: `board/pyroMortars.js` (Astra's mortar, blasters/curtain as
  options; parity-checked against her original over 4,218 frames, Δ = 0),
  `board/pyroShove.js` (the reaction + Alex's 10-lever dial-in + a show clock that
  turns hit-stop and slow motion into a real↔show mapping + the deploy / volley /
  retract cue builders), `board/pyroBlast.js` (the hit's fire), `audio/pyroSfx.js`
  (my voices byte-for-byte, on the SFX fader). `board/pyroStage.js` puts it on the
  board: each wave a set (the wave number is its identity), the reaction started by
  `standeeSteps`' new `onLand` hook so the approach stays the game's skate, the
  struck mortar redrawn on the reaction's own clock so it freezes with the piece;
  the renderer adds the lens shake and zoom punch around its draw and puts the
  camera back.
- 🐛 **Fixed on the way** — the struck mortar's crown was heard 1.15 s after the
  bang (the page's own shell) while Astra's burst is SEEN at 1.5 s; a frame landing
  before the stage's first tick would have deployed a wave at second 0 and dropped
  its machinery; the piece kept the daze's last micro-tilt after the hand-back.
- 🧪 **Evidence** — `test:pyrorules` **92** (mutation-checked: disable the stop,
  it goes red), `test:pyroshove` **116,482** (the page's 98,738-assertion check ported;
  it is ~102k now because airMs 950 → 1100 lengthens every sampled timeline),
  `test:pyrostage` **62** (the real GLB arena; mutation-checked on the pose),
  `test:pyrojourney` **8** (the real `Game` by its own controls: a new set every
  END TURN, 5 → 10 → 13, the show ending; mutation-checked on the volley).
  Every suite, isolated baseline worktree (56b7656) vs this tree: **87 suites on both, plus the 4 new ones: 21 red before and 21 red after — the same 21, each with the same first failure** (the known combat-fixture, Db-cut and missing-`.scratch`-file reds), and every passing suite reports the same count on both.
  Bundle (case-tolerant twin, see below): **0 warnings**, before and after.
- ⚠️ **This machine is case-sensitive** — the client's three case-mismatched PNG
  imports (`STATE_OF_PLAY` 🚩, Alex's call) stop `check:bundle` and every suite that
  bundles the client. The evidence above used temporary untracked symlinks for those
  three files in both trees; nothing about them is committed.
- ⏳ **Not seen on real hardware.** The cloud browser is software-rendered: nobody
  has seen this on a real GPU or heard it on speakers.

**Next — Alex's calls:** (1) the end state (`dazed`), hit-stop on every mortar hit,
and the shell + burst in a hit — shipped at their defaults; (2) the **Burn** was
kept as it was — he set only the damage; (3) should a vortex DRAG stop on a mortar
(it does not — a pull, not a push); (4) the page's "sympathy" volley is now
page-only (in the game the others fire at END TURN, by the rule); (5) a real-GPU
look and a listen.

---

