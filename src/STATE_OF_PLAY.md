# 🧭 STATE OF PLAY — the whole game, current truth only

**2026-10-07 💢 THE SHIELD PUSH IS THE STRENGTH THROUGH, NOT THE DICE** (Alex, after a real match: a 13-vs-6 Psycho Bushido pushed the Rival ONE hex — *"The push-back should be determined by how many 'points of damage' go through, rather than number of dice … for every 2 points of damage, the Spirit gets pushed back 1 space. So 1-2 = 1 space, 3-4 = 2 spaces, 5-6 = 3 spaces, 7-8 = 4 spaces..."*). 🐛 **Why it pushed 1:** the push was one hex per kept die that got through, and the shield soaks the dice in throw order — 5 then 8 against 6 puts 7 through on one die. 🎲 **The rule** (`combat.js` `sonicPush` = ⌈strength through ÷ 2⌉, `SONIC_PUSH_PER_STRENGTH` 2, read by `battleFlow.battleConsequences`): **the staged Sonic and Psycho Bushido both** push this way, **uncapped**, along the attacker's facing, ring-outs allowed; every stopper still applies (bodies, reserved home hexes, Rolls Hard −1, Goes to 11, pyro). The legacy v1 Sonic (old replays) keeps a hex per hit. Damage, Fame (still per beam through) and dice are unchanged. The client's `knockback` label, the loadout pop-out (`ui/abilityDemo.js`: r3 → 2, r4 → 4, r5 → 5 hexes), the Bushido tooltip and the skill-tree text say the same. `test:bushidoburst` 1016 (the 13-vs-6 case, the 1–2/3–4… table, the whole aftermath on the board), `test:sonic` 81, `test:abilitydemo` 142 (+1 pre-existing preview-lever red), `test:sonicjourney`, `test:replayjourney`, `test:engine`/`battleflow`/`transition`/`harness`/`trace`/`eval`/`determinism`/`legal`/`eleven`/`pyroshove`/`arch` green. 🚩 Balance: a range-5 Bushido through a thin shield can now push 5+ hexes, and big Sonics push much further — a ring-out is far likelier. ⏳ Not yet played.

**2026-10-07 🪪 THE SPIRIT WINDOW IS IN THE GAME, AT ALEX'S DIAL-IN** (*"rebuild that to have the necessary information while keeping the current 'look'"* → *"Lets wire it in!"*, 6 of 25 levers moved: 426 px wide, a bracket per section, scrim .54, a 105 px head banner, status and ability rules on hover): click the SPIRIT card (or its ＋) and the arena opens the **Spirit window** — the seat-portrait head in your colour, ⭐ Fame (FP, lead/behind, this turn's ★ cap, NECK AND NECK), 💗 body (Vibe, lives, speed, hex + edge), ⚠️ every status with turns left (the rule on hover; incl. the Iwato curse, a blown amp, blindness, the Mosh), 🎛️ the Drive/Sustain stacks note by note with the chord and the next note to add (+N dice and why), 🔑 the key (NEXT ROUND after a commit, cursed when cursed, the NOTE STOCK drawer in step 3) and 🗡️ both abilities with cooldown pips and the 'i' Field Guide. ✕ closes it. **The old 2D card is gone** (its turn rail was the phase rail's job); `ChannelStrip` / `AbilityWallet` / `StatKnob` are now mounted nowhere. `ui/spiritSheetModel.js`, `ui/SpiritSheet.jsx`; `test:spiritsheet` **75**; `test:journey` opens and closes it in the real game; `test:render` §4 now counts the stack panels' own dials (it had been passing on the old card's knobs). ⏳ Seen rendered from the real `Game` in a headless browser, not yet in a live match on Alex's machine. `SEQUENCING.md` §A 62-spiritsheet.

**2026-10-07 ⏎ ONE ENTER, ONE ACT** (Alex: *"when I try and press enter to commit my Melody track - it effectively 'ends' the whole turn"*): a single Enter on the Melody step was committing AND ending the turn — the End-Turn listener saw the fresh `move_act` step on the same press. It now ignores any Enter another handler already took (`e.defaultPrevented`). A second press still ends the turn. `test:notekeysjourney` **29** (now runs each listener the way a browser does).

**2026-10-06 🗡️ THE RONIN IS A NEW DRAWING, WITH HIS OWN THRASH AND A BLANK BACK** (Alex: *"phase 1 of Thrash is Thrash1, phase 2 is Thrash2, and whenever Ronin gets hit back (loses a bout), use the 'hit' picture for the standee"*; *"create the 'back side' of the Ronin as... blank. It should be obvious which side is the 'front' and which is the 'back'"*). 🎨 **The art:** Alex's white-background masters live in `src/standees/source/` (never edited); `python scripts/standee-art.py --splice` keys the white to transparency, crops each to the figure (nothing under the feet), traces the cuts (`board/standeeOutlines.js`, the Ronin's `poses`) and refreshes the standee preview page. Thrash2's swoosh and burst are erased by a hand polygon in the script (they touch the drum). 🎸 **The Thrash** (`board/swingStandee.js`): the Ronin has NO stick figure — his own standee turns side-on to face the front (the director's side, away from the amps), shows **Thrash1** on the raise and **Thrash2** on the clash, mirrored where needed so he always strikes AT the Rival; from the result, a loss **or a tie** shows **hit**. 💥 **Hit back** (`board/arenaVisuals.js`): any shove that moves him (`hitBackCount`) and the end of a Thrash he lost/tied show the hit print for 2.4 s from the last one. 🪧 **The back** (`board/standee.js` `STANDEE_BACK`): his print is on the front only; the back is the same silhouette in plain pale card, everywhere a standee appears (board, picker, intro, ability demo). The battle lens is told his print is one-sided and films its front. The other three Spirits are unchanged. Seat-portrait head focus re-read off the new art. `test:standee` **161** (poses, back, the Thrash beats both sides of the lane). ⏳ Seen only rendered headless; **not yet in a real match**. ⁉️ My calls: a tie shows hit; the hit print holds 2.4 s; the back is pale card `#c4cbd6`; poses keep their drawn size (the clash crouch is shorter); the poses are mirrored when the camera side demands it.

**2026-10-06 🎸 THE OPENING ACT IS IN THE GAME** (Alex: *"those players whose turn hasn't come up yet aren't even technically on the board yet … placed in the spot in between the previous 'home hex' and the fan's seats … a space not technically on the board"*, and the home hex is reserved). 🎲 **The rule** (`engine/systems/entrance.js`, lobby matches local and online; **not** Testing Grounds): every Spirit starts **off the board** (`num` null) on a pad between its home hex and its grandstand, with **no fans**; at the start of its **own first turn** (`TURN_STARTED`; seat one at match creation) it steps onto its home hex and gains **exactly 2 Diehards** (the old starting crowd). Until then it **cannot be targeted, pushed, cursed or touched**, and its **home hex is a wall** — nobody walks, hops, slides, warps or is shoved onto it (one blocker set, `bushidoBlockers`, plus the knockback and the reducer's movement door). Bots obey the same legal actions. 🎬 **The picture** (`board/openingAct.js`, `openingActStage.js`, `bardbarian.js`, at Alex's 2026-10-04 dial-in, read from `previews/bardbarian-intro/alex-dial-in.json`): when the arena appears the Bardbarian rises in the storm over the real board, each standee crashes onto its pad, then seat one plays its picker riff and hops on; every later seat plays its riff on its own first turn and hops on, and its two fans arrive with it. The HUD steps aside and the board is held during the intro (⏭ Skip, Enter, Space, Escape); bots wait for it and for their own entrance. No 3D, a reconnect or a spectator: no intro, waiting Spirits simply stand on their pads. `test:entrance` (2,695, incl. whole bot matches at 2/3/4 seats audited every turn) · `test:entrancejourney` (29, the real game). ⏳ **Seen only in a software-rendered browser; not heard on speakers.** The preview is still the place to tune it (`npm run dev:intro`).

**2026-10-04 — Sustain is the living oval-hex shield.** Alex's complete Sustain preview settings are the production defaults in `board/sustainShield.js` (2.9 × 3.6, shallow 0.13 face, eight rings, three glitter strands, selected hue 280). Sonic and Psycho Bushido use that same renderer. Real remaining shield HP dims and frays the form; absorbed damage sheds glitter from the contact point; the real break releases glitter and curved ring fragments. The clock still owns hit-stop and slow motion, and the beam meets the new face at the existing contact stand-off. The Sustain amp feeds rings and glitter into the build. This is a visual change; damage, dice, audio and action costs are unchanged. The selected purple is Alex's shield dial-in; the amp feed retains the defender's colour. The inspector at `previews/sustain-shield/` re-exports the production renderer and offers synthetic damage controls. Production checks are part of `test:sonicfx`.

**2026-10-03 🎭 THE SPIRIT PICKER STOPS JUMPING ON SCROLL, AND THE ABILITY POP-OUT WAITS** (Alex: *"scrolling the window up and down makes the standees have to 'jump' up or down to 'catch up' to the screen"*; *"simply hovering over the button shouldn't spawn the window right away"*). 🎭 The standee canvas now **lives in the panel that scrolls** (`ui/spiritPickerStage.js`, `position:absolute`, sized to the roster + bleed) instead of being fixed over the window and redrawn a frame behind the browser's threaded scroll — cards and standees move in the same paint. The backstory panel rides with it. 🎬 The loadout's ability pop-out opens after a **2 s dwell** (`ABILITY_DEMO.openDelay` 220 → **2000**), moves an open window to another row after **0.4 s** (`swapDelay`, was instant), and a press on a row cancels a pending open (`ui/abilityDemoHooks.js`). ⁉️ 2 s is my reading of "a few seconds" — one number to change. `test:spiritpicker` **64**, `test:abilitydemo` **140**; scroll checked in headless Chromium (card-to-canvas offset unchanged in the scroll's own frame). ⏳ Not yet seen by Alex in the real lobby.

**2026-10-03 🤘 THE THRASH COSTS BOTH SIDES, AND A TIE THROWS BOTH BACK** (Alex: *"Thrash should take 2 notes off Drive, regardless of whether the hit 'missed' or not … An attacker chooses to get into the fight - sacrificing 2 Drive notes sounds right - while a 'defender' doesn't make that choice - but still rolls the dice … taking 1 Drive note - win or lose"*; *"Drive should not be available unless at least 2 notes are in the Drive stack"*; *"The clash sends both back 1 space. No Vibe damage"*). 🎲 **The rule** (`engine/systems/battleFlow.js` `battleConsequences`, the one place it is charged; `SWING_DRIVE_SPEND` 2 / `THRASH_DEFENDER_SPEND` 1 in `data/gameConstants.js`): the attacker pays **2 Drive notes**, the defender **1**, off the top, after the dice, **win, lose or tie** (a defender with fewer pays what he has). Until now only the WINNER paid 2. A Thrash — and the Monster's Tentacle, which is one — **needs 2 Drive notes to throw**: the button greys, the engine, the searcher and the old client bot all refuse. A **tie** throws both Spirits back one hex, straight apart, no Vibe (each is a real knockback: walls, bodies, hazards, pyro, ring-outs). A rival who swings or Sonics the 👤 Shadow by mistake now pays the full Drive price too, and the Sonic whiff's AP is 1 (it was still charging 2). ⚠️ **Every Spirit starts with ONE Drive note (its root), so nobody can Thrash until a second is voiced in the chord step.** `test:legal` **706**, `test:swing` (the bill on a hit, a miss and a tie; ties throw both back; the mounted Thrash).

**2026-10-03 🤘 SWING IS NOW CALLED THRASH** (Alex: *"lets rename Swing to Thrash. Just like Thrash Metal. And its more badass for a Rock game"*; and *"A Sonic attack should be the normal way attacks happen — Swing attacks are an uncontrolled version of both sonic and physical attack manifestation"*). **Every word a player sees** says Thrash: the rail button, its tooltips and target prompt, the battle overlay ("⚔️ THRASH!", "thrashes wide"), the 3D clash captions, the roll prompts ("Thrash! Roll your Drive", "… thrashes back"), the tutorial, the Tentacle and Shadow Illusion texts, the card hints and the log lines. 📌 **The code still says `swing`** — the action kind, `SWING_AP_COST`, `swingCone`, `swingClash`, the `swing_*` phases — on purpose: the kind is written into saved replays and network actions, so renaming it would break them. The engine's dice already called this a Thrash (`THRASH_DIE`, `thrashDamage`). Rules unchanged: 1 AP, the adjacent cone, Drive vs Drive, **2 Drive notes off the top on a hit**.

**2026-10-03 🔊 A SONIC SPENDS ONE DRIVE NOTE AGAIN** (Alex: *"this would break the game, especially with 3 or 4 players. A player who spends their whole Drive stack could simply be attacked with Swing (Drive Vs Drive) and take the full brunt … Sonic takes 1 note off the Drive stack, Swing takes 2 notes. A Sonic attack should be the normal way attacks happen"*): a Sonic pays **1 note off the TOP of the Drive stack, hit or miss** (`SONIC_DRIVE_SPEND` in `engine/systems/attackParams.js`, client `initiateSonicAttack`, engine `transition.js`) — the 2026-09-11 whole-charge rule is reversed. The dice still come off the FULL stack before the note is paid, so the volley you see is the one that counts. The Thrash (was Swing) is unchanged: **2 notes off the top, on a hit only**. `test:legal` **703** (new: a Sonic leaves 3 of 4 notes).

**2026-10-03 🔊 THE SONIC NEEDS ROOM — 2–3 HEXES, NEVER NEXT DOOR** (Alex: *"it should be unable to fire from only 1 space away … the player must be 2 - 3 spaces away. The area of effect also needs to be changed"*): the beam is still the straight line down your facing, but it is now **hexes 2 and 3 only** — the hex in front of you is out of it, in the highlight and the rules alike (`SONIC_MIN_RANGE` = 2 in `data/gameConstants.js`, `sonicBeam` in `engine/policies/legalActions.js`). The client's `getSonicBeam` now calls `sonicBeam`, so the click, the blue tint, the 3D attack tiles, the behind-hit badge, the riff-off check and both bots read one copy. 🎤 A **riff-off** needs both Spirits in each other's beam, so two Spirits face to face next door no longer duel. 🌀 The **Blaster of Ra keeps the whole 1–3 line** (`sonicBeam(…, { minRange: 1 })`, client `getBlasterBeam`). No line of sight — a body on hex 1 does not block. ⏳ Bots' movement scoring still likes closing to next door — not re-benched. `test:legal` **699**, `test:sonicjourney`, `test:riffarenajourney` (fixtures now two apart; the riff journey also stops assuming 2 AP).

**2026-10-03 🔊 THE SONIC COSTS 1 AP** (Alex: *"the Sonic Attack should cost 1 AP from now on"*): `SONIC_AP_COST` 2 → **1** (`engine/policies/legalActions.js`); the client's Sonic button, its gate and its charge (`rlsw-simulator-v3_8_1.jsx` `initiateSonicAttack`) now read the same constant, so a 1-AP Spirit can fire. A **riff-off** started from crossed beams costs what the Sonic costs, so it is 1 AP too. Swing is unchanged at 1 AP. `test:legal` now asserts 1 AP affords the Sonic and 0 AP does not. ⏳ Bot balance not re-benched.

**2026-10-02 🎆 PYRO IS ASTRA'S MORTARS — they fire every turn, and a shove STOPS on one** (Alex: *"they fire under 2 conditions — 1. end of a player's turn (not a full round) … coming back before the start of the next player's turn, or 2. if a player gets pushed into it — doesn't matter if the push would have pushed the Spirit past the mortar — it stops on the mortar and takes damage"*; *"real Vibe damage — like 3 or so"*). 🎲 **The rule** (`data/stageEffects.js` PYRO v2, `engine/systems/stageFx.js`): the show arms **5 → 10 → 13** mortars by show round (3 rounds); **every END TURN** every armed mortar fires (anyone standing on one: **3 Vibe + Burn**), they re-arm on fresh hexes before the next turn; a **forced move that ENTERS an armed mortar stops there** — the engine's knockback and every client push — and that mortar fires on the Spirit (3 Vibe + Burn) and is spent. Walking onto one does nothing by itself. Old replays keep the old cadence (`pyroVersion`, opt-in). 🎬 **The look** (Alex's dial-in off `.scratch/pyro-shove`, 10 levers): Astra's mechanical mortars rise out of the deck, fire as a rolling salvo and fold away (`board/pyroMortars.js`, the one copy — her study imports it); a shoved Spirit lands ON the mortar on the game's own skate, then plate clunk → fuse → ❄ hit-stop → slow motion → thrown **3** high spinning → back down on the mortar → sways dazed, scorched, flames licking, "−3 VIBE" and "🔥 BURN" over it (`board/pyroShove.js`, `pyroStage.js`, `pyroBlast.js`); the lens shakes and punches in; my sounds on Astra's beats through the SFX fader (`audio/pyroSfx.js`, not her audio). Mortars only — no blasters, no spark curtain (options in the module). ⁉️ **Open, Alex's calls:** the end state (`dazed`), hit-stop on every mortar hit (not just a knockout), the shell + aerial burst in a hit — shipped at their defaults; the **Burn** kept as it was (he set only the damage); the vortex's DRAG does not stop on a mortar (a pull, not a push). ⏳ Seen only in a software-rendered browser — **nobody has seen or heard it on a real GPU or speakers.** `test:pyrorules` **92**, `test:pyroshove` **116,482**, `test:pyrostage` **62**, `test:pyrojourney` **8** (the real Game). `SEQUENCING.md` §A 53-pyro.

**2026-10-02 🪦 Db IS CUT** (Alex: *"no more shops, no more Db, the cooldowns and 'sacrifices' are the gate"*): there is no Db on any sheet, HUD, wallet or log. Each seat drafts **two abilities, ready**; one fires when it is in the kit and off its **2-round cooldown** (`engine/systems/cooldowns.js` `canFire`), plus whatever it sacrifices on its own (AP, the Action Token, stack notes, Sustain, strings). A melody pays **fans** (style + craft) and the red/blue stack-root carrot — nothing else. The upgrade shop (`UpgradeModal`), the "⬆ UPGRADES · SOON" button, the Major/Minor pivot bonus and the Séance / Payola / Backstage Pass event cards are **deleted**. The finder's goals are Drive / Sustain / fans. ⁉️ **Open, Alex's calls:** the ending ladder pays nothing for now (so the fifth's chord-change pressure is off); the Iwato curse now bites fans only (rewrite flagged); Displace / Gravity / Code Injection are cooldown-only. Suites: 25 red → 22 red, all 22 red on the baseline too. `SEQUENCING.md` §A 52-dbcut.

**2026-10-02 🎸 THE IWATO CURSE IS IN THE GAME** (Alex: *"lets wire this in as well as the ability selection 'preview'"*; `RONIN_ABILITY_DESIGN.md` §2.3.00, rules `engine/systems/iwatoCurse.js`): 🪕 **take it up** from the rail (free; the ghost shamisen appears over him) → from his **next turn** the chord step has a third row, **STRINGS**: up to **3 Iwato notes a turn from the hand**, out of the same 3-commit budget as Drive/Sustain (Alex's ruling — the sacrifice is the note that could have gone to a stack) → all three tuned: **cast on a rival within 3 hexes** (Action Token, 5 Db, 2-round cooldown) — the hush, the bell, his melody, three hitodama, the 呪 charm on their print → their palette **IS Iwato on his key for their next 2 turns** (counted at the end of THEIR turns): every other note is discord, no Db, no fans; their pocket Scale Wheel is the infected one → **exorcised** by a melody of 3 different Iwato notes on their very next turn (it pays), else it expires. The loadout's 🎸 row now **plays it in a pop-out** too. The glow-and-debt Shamisen is deleted. Port calls (not Alex's — flagged in §2.3.00): the shamisen **keeps the key it was taken up in**; range 3 with no line of sight; no string snaps on a hit. `test:shamisen` **91**, `test:shamisenjourney` **27** (the real Game, clicks only), `test:cursedshamisen` **132 + 24** (the arena stage), `test:abilitydemo` **138**. Seen in Chromium on the real arena. ⛔ Bots never take it up; the real crowd does not fall out of time; no spotlight stutter/shake. ⏳ Nobody has played one in a real match yet.

**2026-10-01 🎬 the loadout's abilities PLAY in a pop-out** (Alex's dial-in off `.scratch/ability-demo-preview.html` — *"everything is perfect … lets lock that in"*, 0 of 24 levers moved): hover or focus 🌀 **Shukuchi** or ⚡ **Psycho Bushido** in the character-select loadout and a window beside the row plays the move with the game's own code on the real standees — Shukuchi's blink (three 2-hex leaps over a Rival, over slime, onto a note), the Bushido strike against the Sustain shield on the engine's own dice rules (ranges 4/3/5 and a shield that holds, dice as chips, the d6 → d8 flip in gold). The 'i' Field Guide plays it too. Sound off until 🔈. One extra WebGL context, only once you hover; no WebGL2 → today's text. Shadow Illusion and the Shamisen: text only (no animation yet). `ui/abilityDemo.js`, `ui/AbilityDemo.jsx`; `test:abilitydemo` **124**. ⏳ Not yet seen in the real lobby.

**2026-10-01 🎸 Riff Off is wired into live matches.** Crossed Sonic beams now
open two guitar tracks over the 3D board. Three–four melody beats per call,
transformed answers, alternating leaders, preloaded next phrases and continuous
exchanges: 138 BPM rising by 8 to 240, breakthrough gap shrinking from 20 to 4.
Both prior melodies survive turn resets in `lastCommittedMelody`. Bots have
seeded physical timing errors judged against the same shrinking windows.
Actual Drive amps emit steady Sonic rings into the growing, unevenly spinning
core with subtle glitter. The ball moves/grows smoothly; the standees shake more
as its energy builds (off under reduced motion). Existing damage, Sonic push,
Fame and Headliner aftermath remains. Versionless replays retain the old duel.
Browser evidence: a real Game duel reached exchange 3, broke through, damaged and
pushed the loser and crowned the winner. `test:riffarenalive`: 16 engine/visual
checks + 10 mounted scenarios; `test:riffarenajourney`: normal targeting and full
aftermath. `test:riffarena`: 34 preview checks. Full suite remains blocked by the
existing `selftest.mjs:457` combat assertion (4 vs 11). Two-device online timing
and the bot-error curve still need playtesting. [Details](../previews/riff-arena/README.md).
Spirit-back work remains paused.

**2026-10-02 Riff Off verification complete for the local game:** all 16 live
engine/visual scenarios, 10 mounted-input scenarios, both Game journeys and 34
preview checks pass. Melody checks: 120; turn flow: 73; legacy riff parity:
127,598. Bundle: zero warnings; new production modules: lint clean. Chromium
completed exchange 3 and its aftermath without console errors, including the
smooth core and growing standee shake. Corrected a test's empty-array expectation
to the existing `null` turn reset. The unrelated full-suite combat failure and
seven missing laser/smoke architecture rows remain. Two-device timing is unverified.

**2026-10-01 ⚡ PSYCHO BUSHIDO IS A LIGHTNING BURST** (Alex's dial-in off `.scratch/bushido-strike-preview.html` — *"Everything looks good in the preview"* — 2 of 76 levers moved: shield size 1.65, sheath off). 🎲 **The rule changed** (his rulings 2026-09-30 → 10-01): the strike is no longer a Swing. The Rival throws his **Sustain** as a shield (his Sustain amp builds it, **as bright as his roll is strong**); the Ronin throws his **Drive** rig — no amp needed — with the range turning **d6s into d8s, 2 / 3 / 4 at range 3 / 4 / 5** (only d6s; a short pool runs out; it REPLACES the old +2/+3/+4 bonus Drive, which the 2-dice cap had flattened); his kept dice hit the shield one by one on the Sonic's own ledger; **what gets through is the damage**, and the Rival is **pushed like a Sonic** (one hex per die through, along the lane, ring-outs allowed). A shield that holds costs the Ronin nothing more — **no counter-blow**. Still 3 AP flat + the Action Token + 2 notes off the top of the Drive stack (no Swing spend on top any more), Db and cooldown unchanged. 🎬 **The show:** the Sonic's staged roll (shield first, then his throw), the Ronin **charging on his own hex as each of his dice lands** (bigger face, bigger jolt; the lane lights as far as his charge reaches), a **rumble before take-off that grows with how many dice he threw**, then on the launch beat a gold bolt down the lane, his ghost left behind, silhouette afterimages, the sky striking every hex he crosses (scorch), each kept die crashing onto the shield, the shatter, the cut; he arrives on the hex before the Rival AT THE DRAW (the warp now follows the dice, in the client and the kernel alike). Thunder, static, the draw, zaps, shield hits and the break are synthesised (`audio/bushidoSfx.js`). Modules: `engine/systems/bushido.js` `bushidoUpgrade`, `attackParams(…,'bushido')`, `combat.js` (kind `bushido`), `board/bushidoStrike.js` (`BUSHIDO_STRIKE`, the dial-in, one copy — the preview re-exports it), `board/bushidoStrikeVisuals.js`, `sonicClashVisuals` `beams:false`, `sonicBarrageTiming` `BUSHIDO_BEATS`. `test:bushidoburst` **1031**, `test:bushidoarena` **15** (the real arena GLB), `test:bushidoui` 331 (the lane labels now read "2d8 / 3d8 / 4d8"). ⏳ **Nobody has played one in a real match yet.** 🚩 Damage = strength through is uncapped (a range-5 draw through a thin shield can do 9–11); balance deferred, recorded.

> **READ THIS FIRST. It is the entry point for every session.**
>
> ⚠️ **CURRENT TRUTH ONLY — NO HISTORY, NO REASONING.** Why a thing is the way it
> is lives in its own design doc; what it *taught us* lives in `SEQUENCING.md` §B.
> **This file answers one question: what is true right now?**
>
> 📌 **Written 2026-09-04**, last updated **2026-10-06** (🗡️ the Ronin's new art: his own Thrash1/Thrash2/hit prints and a blank back; earlier: 🎸 the opening act is in the game — everyone waits off the board, enters on their own first turn with two fans, home hex reserved; earlier: 🎆 pyro is Astra's mortars — they fire every turn end and a shove stops on one, 3 Vibe; earlier: 🪦 Db is cut — cooldowns and sacrifices are the gate, the melody pays fans; earlier: 🎸 the Iwato curse is IN THE GAME — tune, cast, curse, exorcise, and its loadout pop-out; earlier: the Cursed Shamisen became the Iwato curse in preview; 🎬 abilities play in a pop-out on the loadout; ⚡ Psycho Bushido is a lightning burst through a Sustain shield, d6s → d8s by range; earlier: 🌑 the dim ring around the arena is gone; 🎭 standees HOP between hexes and land on stone-on-glass; ⌨️ the numpad walks; earlier: 🧹 melodies no longer cut off; ⏳ one found seat per stack per round; 🎚️ the craft run's +2 needs six notes; 🎲 extra dice say why; earlier: 🔊 the Sonic's rings over everything; 🎬 the loading veil; earlier: 🗓️ stage FX on the round clock + 🗄️ phone play archived; earlier: 📱 phones; 🌌 the title-screen arena; 🃏 marquee prize cards; earlier: 🔭 the battle camera's clear lens + 🎯 attack reach glows on hover; earlier: 🔊 the Eleven die is a d6; 🎭 the Spirit-select stings; earlier: 🎸 chord vocabularies + keep-the-best dice + the blank-dice fix; earlier: 🔦 the four corner spotlights + no more natural Sustain decay; earlier the same day: player colours only, the seat-portrait preview and the solid layer re-draw; earlier the same day: the 3D Spirit picker and the figure-only standee cut; earlier: the staged-roll stop-gap and the battle director preview; earlier: the auto camera v2 and the 3D move tiles; earlier: the Ronin's palette and amp voice, the weighted note draw, the beginner finder), when the design set
> reached 37 files and 222,000
> words and no single view of the game existed. Keep it short or it stops being
> read — if a section needs a paragraph, it belongs in its own doc with a link
> from here.

**2026-09-30 🌑 no more dim ring around the arena** (Alex: *"it seems like there is a dim 'ring' around the 3D arena"*): the dark wash that makes lit move / attack tiles read (`MOVE_TILES.boardDim` .25, `ATTACK_TILES.boardDim` .3) was a **radius-15 disc**; the board is 22 × 19.5, so half the disc lay over the rim, rocks and sky whenever a walk or an attack was armed. Both dims are now cut to the 111 hexes (`board/moveTiles.js` `boardFootprint`, exact edge-to-edge cells, no double-dark overlap). Same strength on the board, nothing outside it. `test:movetiles` §6.

**2026-09-30 🎭 the standees HOP, and land with a sound** (Alex's dial-in off `.scratch/standee-move-preview.html` — *"I found a good sound I think. I'd like to run with this for now"*): every hex change is queued and played out (`board/standeeSteps.js`, the pure half + every number in `board/standeeMotion.js` `STANDEE_MOVE`) — a walk step is a **hop** (crouch, arc, tip forward, squash on landing), a 2+ hex leap (Shukuchi) a **shimmer blink**, a knockback a **skate backwards** with a clack. Each landing rings **stone on glass** (`audio/landingSfx.js` `slab`, a C3 body under a faint C6, weight .45, echo .06, two sparkle pings) after a **heavy rumble** in the air, and lights the hex (ripple, flash, 10 sparkles, in the player's colour). One fixed note for everyone (pitch mode `fixed`); bots at .55. Fast clicks queue and speed up, never skip a landing. Reduced motion: the piece is simply there, the hex fades, the sound still plays. On the SFX fader. Replaced the silent 0.2 s lerp. ⭐ The preview reads its defaults FROM `STANDEE_MOVE` (one copy), and the page offers 14 voices in three families (glass / weighted / space) if a re-dial is wanted. `test:standeemove` **318**. ⏳ Nobody has seen it in a real match yet.

**2026-10-04 ⏎ Enter ends the turn** in Move & Act (Alex) — the turn's third Enter, after *Continue to Melody* and *Commit*. Calls the same `endTurn` as the End ⏭ button. ⚠️ **Never on auto-repeat**: Commit is also Enter, so a held key would otherwise run straight through the action phase; a fresh second press does end it. Your own turn only, never in a battle, event or text field. `test:notekeysjourney` **28** (was 23; mutation-tested).

**2026-09-30 ⌨️ the numpad walks the Spirit** (`ui/numpadMove.js`, Alex: *"8 is up, 2 is down … 7, 9, 1, and 3 are diagonal"*): 8/2 straight up/down, 7/9/1/3 the four diagonals. ⭐ His rulings: **4 and 6 do nothing** (a flat-topped hex has no left/right neighbour) and **up is board north**, whatever the camera does. By `e.code`, so Num Lock on or off both work and the top-row digits (the Riff-Off's strings) are untouched. Move & Act step only, your own turn, never in a battle, event or text field, no auto-repeat; a key goes through the SAME `onHexClick` / `move` as a click, so the budget, blockers, dazed and the free slime slide all hold. Walks the 👤 Shadow when its walk is armed; leaves another armed action (Swing, Face, Shukuchi) alone; with nothing armed a press arms the walk and steps. `test:numpadjourney` **23** (the real `Game`, mutation-tested).

**2026-09-30 🧹 melody lines no longer cut off mid-phrase** (`audio/ampVoice.js`): every note unplugs itself from the audio graph once it has finished — the front of its chain when its oscillators stop, the echo and reverb sends after the echo fade. Connected filters used to keep ~25 s of silent voices per commit on the audio thread, which starved the next phrase. Same treatment for the Zero's scratches and the commit-layer noises. Sound-neutral (≤ −49 dB, tails only). `test:voiceleak`. ⏳ Not yet heard by Alex.

**2026-09-30 ⏳ one found seat per stack per round** (`music/stackSlots.js`): once a stack opens a seat, it cannot open another until your next turn (`driveSeatOpenedThisTurn` / `sustainSeatOpenedThisTurn`, cleared by `startTurnNotes`). The OTHER stack still can. The board keeps the next hunt pinned but stops lighting it for you until then, and the locked seat says "next turn". `test:stackslots` §5b.

**2026-09-30 🎚️ the craft run's +2 needs a SIX-note run** (was five — `music/melodyPayout.js` `CRAFT_FAN_TOP`): runs of 4–5 pay +1, 6+ pay +2. The per-commit ceiling is still 4 (Ronin: shred 1 + skip 1 + craft 2). Alex: a full crowd by round 7 — *"dial back the fan gain slightly"*.

**2026-09-30 🎲 an extra die says where it came from**: arming a Swing or Sonic logs e.g. *"5 dice: Drive 4 +1 standing in your own spotlight"* (`engine/systems/sonicRig.js` `drivePowerBreakdown` — the rig is computed FROM it). One die per Drive point is intact; the dial shows the stack, the dice add its buffs (temp boost, Mosh, home spotlight). 🎛️ **The SOUND plate is at Alex's dial-in** (`ui/MatchSurface.jsx`, `.scratch/sound-plate-preview.html`, 3 of 12 levers moved): labels 10.5 px, numbers 17 px, Db in gold with **READY** / `/5` against the kit's cheapest ability (`hud.dbCost` from `ABILITY_DB_COST` — the preview's 6 was a slip, 5 is the price), and a `+N` chip on the Drive dial (10.5 px) whose hover names the buff (`hud.driveBonus` / `driveWhy`).

✅ **2026-10-04: the standee imports match git's filenames** (`Cosmic_Ronin*.png`, `Metalness_Monster_mirror.png`). The IMPORTS were re-cased; no file was renamed. A Linux build (Render) resolves them now, and `check:bundle` is at zero warnings.

**2026-09-30 🔊 the Sonic's rings draw over EVERYTHING but the attacker** (`board/beamLayer.js`): the whole clash draws last on the foreground canvas, with the arena's own bloom, over amps, fans, dice and both standees; only the attacking Spirit's print can hide it, which is how the far side of the loop goes behind them. Loses the depth-of-field blur on the beam. `test:beamlayer`. ⏳ Not yet seen by Alex on a real GPU.

**2026-09-30 🎬 the match board opens behind a loading veil** (`ui/BoardViewport.jsx`): dark until the arena is fully in — model, textures and shaders (`arenaRenderer.js` `settle()`, capped 2.5 s + 1.5 s) — then one 0.6 s fade. The flat 2D art (`data-arena-flat`) is never painted in 3D, not even while loading, and the title menu pre-fetches the renderer's code chunk. ⏳ Not yet seen by Alex in a real browser.

**2026-09-29 🗓️ Stage Effects fire on the ROUND CLOCK, not on Fame** (`data/stageEffects.js` `stageFxSchedule`):
round 7, then every 5; each show lasts 3 rounds, the last of a timed match runs to the buzzer — 10 rounds: 7→end ·
15: 7–9, 12→end · 20: 7–9, 12–14, 17→end. Random from the seeded no-repeat deck. 🎆 Pyro is the per-turn mortars since 2026-10-02 (top);
smoke stops growing at 4 rings. No Fame notches on either track any more.
⁉️ Legend Run (no buzzer) got 7–9, 12–14, 17–19 by default — not ruled. `test:stagefx` **90**.

**2026-09-29 🗄️ phone play is ARCHIVED** (Alex: *"I don't think it needs to be built out now"*). **Phones are not a
target — do not design or check for them.** The sideways layout is in `docs/archive/phone-play-2026-09-29/` with a
restore recipe; only the white-screen fix (the phone tint on `<html>`) stays live, so a phone still loads the desktop layout.

**2026-09-29 🌌 the title screen is the real arena** (`board/titleArena.js`): the match's GLB, Riven World,
spotlights and a decorative crowd, far off on a long lens, slowly turning to the right of the menu (Alex's dial-in).
The island art is only the fallback when 3D cannot run. Tune on `.scratch/title-arena-preview.html`.

**2026-09-29 🎪 one marquee per seat** (`MARQUEE_QUIZ_DESIGN.md` §11): each opens in its seat's own
quadrant; taking one relights one at once in a quadrant with none (the one just emptied, or an
unseated one), ≥ 2 hexes away, never two per quadrant — at 4 seats it is persistent in that quadrant.
No respawn timer. 🪦 **Charge spaces retired for now** (`CHARGE_ZONE_COUNT` = 0).
🎪 **In 3D** each marquee is a bulb-ringed pink neon hex with a floating, turning RL prize card
above it (`board/marqueeMarkers.js`); new ones pop in, taken ones lift away.
🎤 **Two kinds** (§13), rolled as a marquee lights: **solo** (2 in 3, pink) — the lander alone on a
10 s clock, late = wrong; **community** (1 in 3, gold) — everyone answers on their own A–D row, first
right answer wins the card, wrong = locked out, 15 s. 🌐 Online, other tables' clicks are not relayed yet.

**2026-09-29 🃏 marquee prize cards** (`MARQUEE_QUIZ_DESIGN.md` §10): every marquee is the same —
one question from the whole deck, no lane, no difficulty. A correct answer wins ONE random card
(`engine/systems/marqueeCards.js`): 🎲 Loaded 4/5/6 (the weakest die lands on that face), 🔼 Bigger Cab
(weakest die a size up), ⏫ Full Stack (weakest die → d10), ➕ Encore (+1 kept die). Hold up to 3 (full →
swap or let go). 🂠 **Played at the roll:** "Use a card" above the Roll button on your own throw —
the cards (RL-logo backs) spin, deal and flip; pick one; your dice are re-thrown with it
(`applyMarqueeCardPlayed`). Spent only if it changes the throw. Bots arm theirs before attacking. The marquee no longer pays fans or rig tiers — the
rig workout is dormant (nothing grants it). ⏳ The marquee is still hard to see in 3D.

**2026-09-27 🎸 chord vocabularies, dials to 10, keep-the-best dice** (`CHORD_VOCABULARY_DESIGN.md`):
each Spirit reads its stacks from its OWN ten spellings (`music/vocabularies.js` — root-anchored;
`chords.js` now serves the melody only). Every note is a die; a matching-branch spelling reads
4/6/8/10. Power → one d6 per point to 8, every point past 8 turns a d6 into a d8; each side keeps
its best `min(seats, 5)` (`engine/systems/dicePool.js`); dropped dice land, slide aside and DIM.
Seats 4–6 are hunted with the Spirit's own next note. Amps = seats per stack (3→1 cabinet … 5→3;
the 6th seat glows). 🔊 Goes to 11 swaps in the Eleven die — **a d6 since 2026-09-28: five 11s, one 1** (fizzle 1 in 6, was 1 in 12);
always kept; the 1 fizzles the throw. ⚠️ Its price (whole Sustain stack + blown amp) is still the one set for eleven d6s. Swing / Psycho Bushido spend from the TOP. Intergalactic 0's innate is gone.
🔢 The dice faces were blank — the solid layer re-drew the body over its own numbers; fixed
(`solidLayer.js` `DECAL_LAYER`). ✅ Marquee bonus CARDS replaced the RIG lane (2026-09-29, above).

 The approved Shieldbreaker barrage is now live:
red Drive and blue Sustain floor dice, a two-second totals hold, automatic ring
barrage, shield breakup and one final shove. Sustain rolls one d6 per effective
point into fresh HP each attack. Spillover penetrates; exact breaks do not push.
Per today's explicit confirmation, Vibe damage keeps the current hit-count chip
scale. The broader through/3 and Vibe-pool rebalance in PROJECTILE_COMBAT_DESIGN
§3.6.1 remains deferred. Legacy replay actions retain their old resolution.

**2026-09-20 battle presentation:** Larger corner stacks are Drive; smaller stacks
are Sustain. Drive fires the ring/chord barrage; Sustain visibly feeds the shield
and plays its defending chord. Dice audio uses SFX. Battle cameras permit manual
orbit/pan/zoom, with **Follow battle** to resume automatic action tracking.

---

**2026-09-22 staged roll:** The dice roll one Spirit at a time. 🔊 **Sonic** — the
defending Rival's **Sustain throws first** (it is what the shield is made of),
then the attacker's Drive, then both totals, then the amps and the barrage.
🗡️ **Swing** — the attacker throws, raises the instrument (Figure 1), their own
Drive cabinet fuels it; then the Rival the same; then the totals and the strike
(Figure 2). ⭐ A stronger roll draws a bigger, brighter beam, normalised against
that side's own maximum possible total. A human local Rival presses their own
ROLL; bots roll on a beat; a remote Rival's press crosses as a `CUE` frame.
✅ **2026-09-24 WIRED — both battles, both presses, the new camera, the new sounds.**
A **bot** throws at once; a **local human** gets a ROLL button that fires itself
after **5 s**; a **remote human's** press arrives as a `CUE` (timeout behind it).
The Rival's shield shot holds **2.4 s** (`SONIC_SHIELD_HOLD`; the Sonic gate is
now derived, **6.25**). 🎬 `board/battleDirector.js` films it: dice from your
chair landing by the fight, a charge shot per Spirit with a depth-of-field pull
to its amp and fans, the clash square-on, then the shove and the **winner's fans
reacting**. 🎭 `board/swingStandee.js`: the Swing's stick figures in acrylic,
holding their hexes, turning side-on and back. 🔊 The Sonic plays the players'
**own** chords — the Rival's Sustain chord rises with the shield, the Drive
chord fires, the two **clash** on every hit; the Swing is a **hard** Drive-vs-Drive
power-chord strike (`audio/swingStrikeAudio.js`). Tuning lives in the preview,
`.scratch/battle-sequence-preview.html`. Handoff: `claude/battle-director-handoff.md`.

**2026-09-22 presentation:** 3D is the only active board. The 2D switch, stage-skin controls and Pickles introduction/Beginner controls are archived pending a new tutorial structure. Shared SVG targeting remains; Fan hints stay independently available. [Archive and restoration notes](../docs/archive/board-2d-pickles-2026-09-22/README.md).

## 1. 🎸 WHAT THE GAME IS

A **music-battle board game**. Spirits move on a hex stage, attack, pick up notes,
and **commit melody lines** that pay a crowd. Fame decides the winner. The
audience is *"the ultimate beginner"* — someone who does not read music.

**Four pillars**, and each Spirit is meant to own one and bend a rule of it:
**Movement · Combat · Melody Line/space · The crowd.**

---

## 2. 🎭 THE ROSTER — 4 Spirits, and only 2 are settled

| Spirit | archetype | state |
|---|---|---|
| 🗡️ **Shredding Ronin** | Burst / virtuoso | **Respec partly shipped:** Shukuchi, Bushido and Shadow updates built; the Shamisen is the **Iwato curse**, ✅ built 2026-10-02. §3 |
| 🌀 **Intergalactic 0** | Control / zoner | ✅ **Done and shipped.** 5 abilities, all priced and cooled. 🪦 **But his Freestyle innate is CUT 2026-09-09** and nothing replaces it — `MELODY_IDENTITY_DESIGN.md` §11.1 |
| 👹 **Metalness Monster** | Bruiser | ⏸️ **ON HOLD pending redesign.** ⛔ His 4 abilities have **no cooldowns at all** |
| 🎀 **Glamarchy** | Star | 🪦 **BEING CUT.** 🐀 Riff Rat proposed as her replacement — ⁉️ **never formally decided** |

⛔ **THE ROSTER IS AN OPEN QUESTION AND EVERY BALANCE SHEET DEPENDS ON IT.**
`RIFF_RAT_DESIGN.md` §0 *proposes* the swap and implements nothing;
`MELODY_IDENTITY_DESIGN.md` already assumes Rat is in and Glamarchy is out.
**Make it a decision or those docs are built on a roster the game does not have.**

---

## 3. 🗡️ THE RONIN'S KIT — respecced 2026-09-04, partly shipped

Spec: `RONIN_ABILITY_DESIGN.md` §2. Build order: its §8.1.

| ability | verb | state |
|---|---|---|
| 🌀 **Shukuchi Arpeggio** | a step that leaps **2 hexes** and clears everything between, **up to 3 per turn, 1 AP each**, any direction; every landing picks up | ✅ **DONE — HEADLESS *AND* IN THE CLIENT, 2026-09-04e.** `test:shukuchi` 68 · `test:shukuchiui` 80. Button, ring-2 targeting, arcs, hover ghost, budget rail. 🎯 **Out of `BOT_CLIENT_GAPS`** — the bench and the played game agree about it again |
| 🗡️ **Psycho Bushido** | draw on a rival **3–5 hexes** directly in front, ⚡ **a Drive-vs-Sustain BURST since 2026-10-01** — the range turns **2 / 3 / 4 d6s into d8s**, the Rival's Sustain is a shield, damage = what gets through, the Sonic's push, no counter-blow — **3 AP flat**, **−2 off the Drive stack**, and ⭐ **any body in the lane stops it** | ✅ **BUILT HEADLESS AND IN THE CLIENT.** `test:bushidoburst` **1031**, `test:bushidoarena` **15**, `test:bushido` **100 pass, then 🚩 one deliberate red** (the Shadow invariant below). Lane geometry, the pre-Swing payment **and now the blocker set** (`bushidoBlockers`) all come from `engine/systems/bushido.js`. ✅ **The three-way occupancy split is CLOSED 2026-09-05** — click, highlight and searcher read one set. 🎸 **A draw costs 2 stack notes** (it was up to 4 while the strike was a Swing). 🎨 **Lane overlay shipped at Alex’s screenshot settings** — `ui/BushidoOverlay.jsx`; `test:bushidoui` 331 checks, plus real client arm/cancel coverage |
| 👤 **Shadow Illusion** | body double, **2 turns**, drinks Sustain | ✅ **DONE 2026-09-04f.** ⁉️ **CD is now 2** (every cooldown flattened to the universal 2 when Db was cut) — **equal to the 2-turn double**, so `test:bushido`'s "the cooldown must outlast the double" is RED on purpose: Alex picks which number moves. Was: CD 3→4, per-use 2→1 Db, duration 3→2. `SHADOW_ILLUSION_TURNS` hoisted out of the monolith. ⚠️ §6.3's rider rides with it: the duration was cut with all three pop conditions still live |
| 🎸 **Cursed Shamisen** | ⭐ **THE IWATO CURSE** (Alex, 2026-10-02): take it up (free) → from his NEXT turn tune **3 strings** with Iwato notes (1 ♭2 4 ♭5 ♭7 on the key he took it up in) as the chord step's 3rd destination, **up to 3 a turn from the hand**, out of the 3-commit budget → cast on a rival **within 3 hexes** (Action Token, 2-round CD) → their palette **is Iwato for their next 2 turns** (discord: no fans — ⁉️ **the curse lost half its bite when Db was cut, 2026-10-02**; Alex flagged it for a rewrite) unless they **exorcise** it on their next turn with 3 different Iwato notes. `RONIN_ABILITY_DESIGN.md` §2.3.00 | ✅ **BUILT** — rules, client, arena (`cursedShamisenArena.js`), the infected wheel, sound, loadout pop-out · `test:shamisen` 91 · `test:shamisenjourney` 27 · ⛔ bots never take it up · ⁉️ range, LOS and hit-snaps unruled |
| 🎵 ~~Wa no Koe~~ | — | 🪦 **CUT, AND DELETED 2026-09-04.** Gone from kernel, client, data, bot and 3 suites. `melodyCommitCheck` §13 is now the revival guard. The **12 Db mastery slot is empty** |

⛔ **The siphon cannot ship before cooldowns are universal** (§4), or it does
nothing against Metalness. That is the one hard ordering constraint in the kit.

🎸 **His sound (2026-09-16):** plays **Hirajoshi + P4** (§4) through the **KATANA**
amp voice — `audio/ampVoice.js` `RONIN_LEAD`, commit endings bend up a whole step.
⏳ **Built on first-guess numbers; Alex's dial-in is pending** on
`.scratch/ronin-tone-preview.html`. Port whatever he lands on into `RONIN_LEAD`.

---

## 4. ⚙️ RULES IN FLIGHT — decided, not yet true in the code

| rule | decided | built? |
|---|---|---|
| 🪦 ~~Every ability costs **≥1 Db per use**~~ | 2026-08-22 | 🪦 **SUPERSEDED 2026-10-02 — Db is cut.** The price of an ability is its cooldown plus its own sacrifice (AP, Action Token, stack notes, Sustain, strings) |
| Every ability has a **cooldown** | 2026-08-22 | ✅ 7 of 13 |
| ⭐ **Every Spirit gets a cooldown; most land at 3–4 turns** | 2026-09-04 | ⛔ **not built — and the siphon depends on it** |
| ⭐ 🌀 **Shukuchi's hops jump OVER everything** — units, hazards, walls, slime | 2026-09-04 | ✅ **BUILT.** ⚠️ Knowingly a hard counter to area denial; the accepted brake is the **AP bill**, not a hazard exception |
| ⭐ 🌀 **A hop costs 1 AP, like a step** — 3 hops = 3 of his steps | 2026-09-04 | ✅ **BUILT.** 🎯 This one line is the whole balance of the ability — it replaced *"it IS the movement turn"* |
| ⭐ **Shukuchi's clock starts PER ACTIVATION** — hop 1 starts the cooldown; hops 2–3 are free | 2026-09-04 | ✅ **BUILT.** §2.5.0a. 🪦 It also charged the Db until 2026-10-02 |
| ⭐ **A hop is TARGETED, one click per hop** — not a mode you toggle; walking may be interleaved | 2026-09-04 | ✅ **BUILT 2026-09-04e.** The rail arms it, ring 2 lights, and it stays armed between hops |
| ⭐ 🗡️ **Bushido pays +2 / +3 / +4 across its 3–5 window** — the window is the legality rule, the ladder is the payout | 2026-09-04e | ✅ **BUILT 2026-09-04f.** The window is a **refusal**, not a poor payout — with a flat AP bill, "bad" would have been "free". ⚡ **Since 2026-10-01 the same rungs are d6s turned into d8s**, not bonus Drive (the 2-dice cap made ranges 4 and 5 buy what 3 did) |
| ⭐ ⚡ **Bushido is Drive against a Sustain SHIELD, not a Swing** — the Rival braces, the Ronin bursts through; damage = what gets through; pushed like a Sonic; no counter-blow | 2026-10-01 | ✅ **BUILT** (rules, kernel, client, arena, sound). ⏳ Not yet played |
| ⭐ 🗡️ **A draw costs 3 AP flat and 2 off the Drive stack** | 2026-09-04f | ✅ **BUILT.** ⚠️ The stack spend takes from the **FRONT**, like every other Drive spend in the game — so it *re-points what he is hunting*, which is `stackSlots.js`'s own documented mechanic |
| ⭐ 🗡️ **Any body stops Bushido's lane** — a spirit, an amp or his own 👤 decoy | 2026-09-05 | ✅ **BUILT.** One `bushidoBlockers` set for the click, the highlight and the searcher, which had three different answers. ⚠️ The **click got stricter** — a shot that worked yesterday can be refused today. 📌 A body at 3–5 is not a screen, it is a *nearer target*, paid its own rung |
| ⭐ 🗡️ **The lane's glow carries the PAYOUT, and shows only when armed** | 2026-09-05 | ✅ **BUILT.** Screenshot-selected blue-to-pale +2/+3/+4 ramp, dim run-up, stop bar, widening spine, labels and target ring. Hidden until armed and usable. |
| 🪦 ~~The flat unlock number is 6 Db~~ | 2026-09-04f | 🪦 **GONE 2026-10-02** — nothing is unlocked: the draft hands each seat two abilities, ready. `test:skilltree` now asserts no skill carries a `dbCost` |
| 🪦 ~~Every base ability costs the SAME to unlock~~ | 2026-09-04 | 🪦 **MOOT 2026-10-02** — there is no unlock |
| ⭐ **Every seat starts with its abilities already active** | 2026-09-04 | ✅ **BUILT, and wider than decided** — the draft (`data/loadouts.js`, 2026-09-22) gives TWO, both ready at match start |
| 🪦 ~~Upgrade prices rise per ability~~ | 2026-09-04 | 🪦 **CANCELLED 2026-10-02** (Alex: *"no more shops, no more Db"*). `UPGRADE_SHOP_DESIGN.md` is superseded |
| Innate passives are **out of scope** for both rules | 2026-08-22 | ✅ n/a |
| ⭐ 🎲 **THE FAN-DRIVEN SONIC DIE LADDER IS CUT** — `sonicDieSides` and `peakCasuals` deleted; both sides roll a **d6 baseline** and only the COUNT varies (the chord's job) | 2026-09-15 | ✅ **BUILT.** R5 — runaway risk. 🎯 Half of one change: the ladder was what Casual fans bought, so it ships with the fan-weight restore below. ⚠️ **The charge-zone `+2` die bump SURVIVES and R8 says it should not** — charge should raise the FLOOR, never the roof. That is Phase 2 item 2, ⛔ **not done**, flagged at the site |
| ⭐ 🎤 **FANS PAY FAME AGAIN** — `FAN_CASUAL_WEIGHT` 0 → **0.12**, `FAN_MULT_CAP` 3.0 → **5.0** | 2026-09-15 | ✅ **BUILT.** The numbers were already derived in `gameConstants.js`'s own 2026-09-02 comment block and walked back anyway, because the per-turn cap made them unusable. 🎓 **The comment and the code disagreed for two weeks and only the comment was true.** ⭐ Restoring this FIXED an already-red assertion in `evalCheck` — *"more fans → higher multiplier term"* — which had been failing because fans did nothing |
| ⭐ ✨ **THE POSE CEILING RIDES THE MODE** — `POSE_FP_MAX_ROUNDS = Infinity` | 2026-09-15 | ✅ **BUILT.** 🐛 `POSE_FP_MAX`'s own comment claimed it *"matches `FAME_PER_TURN_CAP`"*, and that match broke silently the day `FAME_PER_TURN_CAP_ROUNDS` was added: the riff cap learned to follow the mode, the pose ceiling never did. In a round-limited match every other Fame source ran uncapped while a maxed pose stayed pinned at **4**. 🎓 **A constant defined as "matches X" does not follow X — it copies X once, and the copy rots** |
| ⭐ 🎼 **CLEAN IS THE SPIRIT'S OWN MODE** — one palette per Spirit, derived from nothing | 2026-09-09 | ⛔ **not built.** The whole melody-identity decision is `MELODY_IDENTITY_DESIGN.md` §5⃣.0 |
| ⭐ 🪦 **`modeFromStack` IS DELETED** — no major/minor derived from the Drive Stack | 2026-09-09 | ⛔ not built. ⚠️ **Not a one-line deletion** — touches `turnFlow.js`, note spelling, `canonicalRoot`'s split roots, `b0check`, `turnFlowCheck`, `selftest` and the client |
| ⭐ **DISCORD NOTES ARE INERT** — no fans, no power to resolve an ending | 2026-09-09 | ✅ **BUILT** — discord breaks a fan shape (`spiritStyle.js`, every reader passes the palette via `notes.js` `paletteScaleFor`) and cannot land the red/blue carrot. 🪦 The Db half became moot 2026-10-02. 🎯 Their only uses are **held for a later turn** or **spent as movement fuel** |
| 🪦 ~~Db length must count clean notes~~ | 2026-09-09 | 🪦 **MOOT 2026-10-02** — no Db |
| 🪦 ~~Fans pay for HOW; Db pays for WHICH and WHERE~~ | 2026-09-09 | 🪦 **SUPERSEDED 2026-10-02** — fans are the melody's only payout; Alex: two meters rewarding one act was confusing |
| ⁉️ **WHAT DOES A GOOD ENDING PAY?** (was: *the ending is a fork — Db or the carrot*) | 2026-10-02 | 🧊 **NOTHING, FOR NOW — Alex's call.** The stack-root carrot still pays; the tonic/4th/5th ladder is dormant data (`ENDING_WEIGHT`). ⚠️ **So the fifth's chord-change pressure (next-but-one row) is currently SWITCHED OFF** — recorded, open |
| ⭐ 🎚️ **DIFFICULTY CHANGES THE ASSIST, NEVER THE RULES OR THE SCORE** — beginner: one mode, colours on; unassisted: two modes, no colours | 2026-09-09 | 📇 **INDEXED, not built.** Rides `WIN_CONDITIONS_DESIGN.md`'s settings surface, which also has ⛔ no menu. ⚠️ The bot always plays unassisted, so every bench number describes expert play |
| ⭐ 🎼 **HALF OF EVERY NEW HAND NOTE IS GUARANTEED IN THE PALETTE, HALF IS CHANCE** — opening stock, turn refill and the Ronin's extra find note. Ronin 75% in tune, seven-note modes ~79% (was uniform: 50% / 58%). Chosen over a flat 75% for the variance | 2026-09-16 | ✅ **BUILT.** `STOCK_PALETTE_GUARANTEE` → `music/cadence.js` `randomNote`. `test:stockdraw` 73. ⚠️ Board tokens are NOT weighted (shared by everyone). ⚠️ Every Spirit's melody economy got richer and all bot benches before it are incomparable — recorded, not rebalanced |
| ⭐ 🗡️ **The Ronin's mode is HIRAJOSHI + the perfect 4th** — 1 2 ♭3 4 5 ♭6, six clean notes (replaces Lydian) | 2026-09-16 | ✅ **BUILT.** `music/melodyIdentity.js`; a new sheet takes it from `melodyModeFor`. `test:ronintone` 100 · `test:turnflow` · `test:b0`. Six clean notes, not seven — offset by the weighted draw above (75% in tune for him). The other Spirits' final modes are ⁉️ **open** |
| 🪦 **🌀 Intergalactic 0's Freestyle is CUT** | 2026-09-09 | ⛔ not built — still live in `melodyCommit.js` / `economy.js`. ⚠️ `attackParams.js:85` says "Freestyle" too and is a **different** mechanic; do not delete it with the pardon |
| ⭐ 🎤 **THE RIFF-OFF IS A BET, NOT AN ATTACK** — no Sustain, no shield, and it is powered by the **Melody Line**, not by Drive | 2026-09-14 | ⛔ not built — but ✅ **already half true**: the duel has never touched `sustainStack`, and `startRiffOff` already builds the riff from `committedMelody`. `PROJECTILE_COMBAT_DESIGN.md` §14 |
| ⭐ 🎤 **THE FIRST CALLER KEEPS THEIR ADVANTAGE** in an alternating duel — it is paid for in board position | 2026-09-14 | ⛔ not built. 🎯 Alex's ruling **closes** the three compensations that were offered (warm-up exchange, defender ante, end-on-completed-answer). §14.5 |
| ⭐ 🎼 **THE FIFTH WEIGHS MOST ON PURPOSE, AND FOR TWO REASONS** — it is the rock interval, **and it was stronger than the tonic to push players into changing chords often** | recovered 2026-09-14 | 🧊 **DORMANT since 2026-10-02** — the ladder paid Db; it is kept as `ENDING_WEIGHT` (the reasons are written on it) for the Riff-Off's hook weight. 🚨 Reason 2 is **not in effect** while the ending pays nothing. `PROJECTILE_COMBAT_DESIGN.md` §14.9.3 |
| ⭐ 🎼 **NOTE STRENGTH = the line's own arithmetic, read twice** — dud 0 / plain 1 / strong 2 (inside the craft run) / **+ the ending value for the hook**, stacking where they overlap | 2026-09-14 | ⛔ not built. ⭐ **Hands decide IF a note fires, the melody decides what it WEIGHS.** §14.9 |
| ⁉️ 🎼 **The tonic rises from 1 to 2** | provisional 2026-09-14 | ⛔ not built, and ⁉️ **not settled** — Alex said *"2 times or so, 1.5 even"*. ⚠️ At 2 the tonic and the fourth become the same rung. §14.9.4 |
| ⭐ 🏆 **THE FAME RACE SURVIVES — rounds becomes the DEFAULT, the race stays selectable** | **2026-09-15** | ✅ **BUILT 2026-09-15.** One line in `state.js` — `winCondition` normalises to `'rounds'` unless `'fame'` is named. `test:winconditions` **87** (§1 inverted, §1b added to prove the race is still reachable).⚠️ **The blast radius is real and deliberate:** anything that used to arrive with `winCondition` undefined — old saves, bench harnesses, fixtures — now plays a 10-round set. `battleFlowCheck`'s Fame-economy fixture had to be pinned to `'fame'` or it asserted against Infinity. ~~⛔ not built.~~ ✅ **Closes `CORE_LOOP_REWORK_BRIEF.md` §2.4**, which was Phase 1's first blocker. ⚠️ **It is not a free answer:** `FAME_TO_WIN`, `fpPerLife`, `FAME_RACE_CONTESTED_LEAD` and `underdogBonus` all stay alive and must keep working once Fame runs in the **hundreds** (R3) — trap 8 notes `fpPerLife` becomes noise at that scale. 🎯 The large simplification is **declined on purpose** |
| ⁉️ Is 🌀 Blaster of Ra an ability at all? | — | ⛔ **OPEN — Alex's call.** It *replaces* the Smash, so pricing it leaves a Spirit with no basic attack |
| ⁉️ 🗡️ **What does the Swing DO to a shield?** Alex's *Smack-down*: *"still the big Vibe hitter"* | reopened 2026-09-14 | ⛔ **OPEN, and it is §5.3's closed decision proposed in REVERSE.** ⚠️ The session that reopened it ended up reworking the Riff-Off instead and never answered it. §14.8 |
| ⭐ 🔦 **FOUR OWNED SPOTLIGHTS** — one per corner, owned by that seat; each parks on one hex of its own six-hex quarter for a round and steps one hex at round end. Empty seat's / teammate's light = scenery | 2026-09-25 | ✅ **ENGINE + RULES IN THE CLIENT.** `engine/systems/spotlights.js`, `test:spotlight` **261**. ⛔ **The 3D lights still roam the old way** — pointing them at their hexes waits on Alex's dial-in of `.scratch/spotlight-preview.html` (house preview rule). Until then the rules are live but only the log shows where a light is |
| ⭐ 🔦 **+1 Drive attacking from under your OWN light** — one more die, that attack only, positional | 2026-09-25 | ✅ **BUILT** — Sonic and Swing, preview dice and the reducer both |
| ⭐ 🔦 **SPOTLIGHT POSE** — costs **1 Sustain** at once, **no Fame**; judged at the start of your next turn on *"still on that hex, still posing"* (the light has always moved by then). **Home** → heal by Vibe left (10–14 → +1, 5–9 → +2, 1–4 → +3). **Rival's** → steal **2 Casuals** (never Diehards) | 2026-09-25 | ✅ **BUILT.** Any displacement breaks it — one invariant after every action (`enforceSpotPoses`). ⚠️ **Bots do not take spotlight poses** (bot parked); they do get the +1 Drive |
| ⭐ ✨ **A POSE DEFENDS AT SUSTAIN −1, NOT AT NOTHING** — Limelight and spotlight alike | 2026-09-25 | ✅ **BUILT** in `attackParams`. ⁉️ **Open:** a poser is still exempt from Swing fray — that exemption was justified by the old "no defence" rule (`battleFlow.js` `chordFray`) |
| ⭐ 🗓️ **STAGE FX RUN ON A ROUND SCHEDULE** — 7, then every 5; 3 rounds each, the last of a timed match to the buzzer; random, no repeats | 2026-09-29 | ✅ **BUILT.** `stageFxSchedule` → engine draw → client asks every round. Replaces the ⭐ Fame thresholds (`WIN_CONDITIONS_DESIGN.md` §6 item 6 answered). ⁉️ Legend Run's schedule is a default, not a ruling |
| ⭐ 🎆 **PYRO MORTARS FIRE AT EVERY END TURN; A SHOVE STOPS ON ONE** — 5 → 10 → 13 by show round, re-armed before the next turn, 3 Vibe + Burn (standing on one, or shoved onto one) | 2026-10-02 | ✅ **BUILT.** `stageFx.js` pyro v2 + `battleFlow` knockback + every client push; `test:pyrorules`. ⁉️ The Burn was kept, not ruled; a vortex DRAG does not stop on a mortar |
| 🪦 **NO NATURAL SUSTAIN DECAY** — a quiet turn keeps every Sustain note; only Sonic volleys you took bill the shield (1 per volley, cap 2, root survives) | 2026-09-25 | ✅ **BUILT.** `turnFlow.js`; guarded by `test:sonic` and `test:spotlight` §12. Supersedes `PROJECTILE_COMBAT_DESIGN.md` §0.1's "one natural decay minimum" |

🧊 **BALANCE IS DELIBERATELY DEFERRED while the kit is in flux** (Alex,
2026-09-04). Record imbalance, do not act on it. **Exception:** anything that
makes a thing *impossible* rather than weak is a bug, not balance.

---

## 5. 🏗️ SYSTEMS — what actually runs

**✅ BUILT AND UNDER TEST**

- 🌌 **3D cosmic arena** — full-width live scene with the approved space-saving HUD: a permanent player/resource pocket, phase rail, edge-mounted chord/melody controls, separate floating melody track, shallow Step 3 dock, and compact camera strip. Preview indigo materials, fractured island/fissures, planets, 48 rocks + seven shards, moving beams, live-tier cabinets and 3D movement/combat/hazard effects remain live. High detail forces full effects; Standard retains scenery; Auto reports its effective level. Left-drag orbits, right-drag pans, wheel zooms; simple clicks retain gameplay targeting. Stable controls survive 2D/3D switches. Ordinary characters/tactical overlays remain flat SVG without scene-depth occlusion. See `../docs/cosmic-arena.md` and `../docs/immersive-hud-handoff.md`.

- The engine kernel, board, combat, turn flow, economy — `test:all`, **28 groups passing** (⚠️ last full `test:all` was 2026-09-05 morning; the 2026-09-05 lane pass could not run it — see `SEQUENCING.md` §5-lane.E), including a DOM melody-to-next-turn journey
- 🕒 **The cooldown system** (`cooldowns.js`) — one map, one tick, one gate
- 🌀 **Shukuchi Arpeggio** — `shukuchi.js` + `ui/ShukuchiOverlay.jsx`. ✅ **Played, not just simulated.** `test:shukuchi` (the rule) and `test:shukuchiui` (the picture, an SSR diff against the preview). ⚠️ **Ronin bench numbers from 2026-09-04c/d were read against a client that could not take the hops the searcher planned** — they are not comparable with anything measured after this, and only a re-bench closes that
- 🏆 **Win conditions** — Legend Run + Battle of the Bands, headless, playable from `runMatch`. ⛔ **No menu, no HUD**
- 🎼 **Theory off the tree** — pardon ladder universal and free; stack seats 4–6 found on the board
- 🔦 **The hunt marker** — the hex holding your next seat lights up
- ⚡ **Psycho Bushido's burst** — `bushidoBurstCheck.mjs` (`test:bushidoburst`, **1031**): d6→d8, the shield, damage = strength through, the kernel's whole draw (no counter-blow, the Sonic push) and the client source; `board/bushidoArenaCheck.mjs` (`test:bushidoarena`, **15**): a whole bout through the real arena — the amp-built shield brighter for a stronger roll, the charge and rumble on his own hex, gone in the dash, no blink on arrival, no ring beams
- 🗡️👤 **The Ronin's respec** — `bushidoCheck.mjs` (`test:bushido`, **108**). The window, ladder, flat AP bill, Drive-stack spend, shared extraction contracts, Shadow constants, flat unlock price and ⭐ **the one blocker policy** — three of whose assertions read the CLIENT source, because that is where the split lived
- 🧱 **Refactor foundation** — app shell and crowd drawing extracted; Windows build/render verification restored; lint baseline enforced by `lint:baseline` (334 errors, 16 warnings). Ability/battle journeys, replay coverage and browser profiling remain open. See `docs/refactor-verification.md`
- 🔊 **The per-lap Sonic tally** — ⭐ **NEW 2026-09-15.** `noteStates[id].pendingSonicAttacks` is written by `combat.js` and now **cleared at the defender's OWN turn end** (`turn.js` → `applyTurnEnded`), so the window is one full lap of rivals at any player count. 🐛 **It was written and never read or reset** — a lifetime tally wearing a per-round name, which made `PROJECTILE_COMBAT_DESIGN.md` §3.5.1's turn-start shield bill a **doc-only rule the game never had**. ⛔ **Nothing CONSUMES it yet**; it is the input §3.5.1 and R12 both want, now correct instead of wrong. `.scratch/sonicTallyCheck.mjs`, 20 assertions, mutation-tested
- 🎨 **The Face button reads as available** — 🐛 fixed 2026-09-15. Idle was hardcoded at **2.15:1** against every other rail button's 12.04:1, and because `.arail .btn` builds its wash, bloom and left spine out of `currentColor`, the dim colour **put the lamp out** rather than merely greying the label. ⚠️ The inline override is gone entirely (Alex's call), so Face now wears `.btn`/`.btn.on` like Move, Sonic and Swing — **which surrenders the cyan `#44ccff` armed state** for `.btn.on`'s `#88bbff`. One prop restores it; the site says how
- 🎭 **The Spirits stand on the board as acrylic standees** — ⭐ **NEW 2026-09-18.** Each Spirit's own drawing, cut out of its art, given thickness and stood on a lit base: a neon edge in the Spirit's colour, a clear glass sheet behind the print, and one print seen from both sides (no mirrored art). ⭐ **Facing is the Spirit's own facing, and the FLAT ART is the direction** (Alex, 2026-09-18) — a Spirit walking toward you is a Spirit you are looking at, and the cut edge is what you see from the side. Nothing turns a standee toward the camera, so a rival's back is their back. ⚠️ `yaw = π/2 − facing`, a MINUS: the block pawn's old `facing + π/2` is that mapping mirrored, 90° out on every diagonal, and both pawn kinds now share one function. ⚠️ The one thing the camera may move is PITCH: under the near-overhead tactical view a sheet is a line, so it tips back 35° (`steepLean`, never yaw). ✂️ **Cut `body` — the physical figure only** (Alex, **2026-09-25**, reversing "cut everything in the art"): no lightning, no glow, no loose drips, on the sheet OR the print; the shamisen's headstock and the topknot stay. `spiritMiniature`'s block pawns survive only as the fallback for a Spirit with no art. At **Alex's dial-in** (1 of 26 levers: height 2.6 → **2.8** world units, against a 1.86-wide hex). `board/standee.js` + `standeeOutlines.js` (traced from `src/standees/*.png` by `.scratch/trace-standees.py`). `test:standee` **93**, 16/16 mutants caught; the real `mountArena` driven headless with the real art, 12/12
- 🎭 **Picking a Spirit plays its calling card** — ⭐ **NEW 2026-09-28.** A 2–3 s sting in the Spirit's own mode, on its own rig, with a noise that is them: 🗡️ the blade drawn, a shamisen strike, a KATANA run bent into the fifth · 👹 a palm-muted gallop, the Phrygian ♭2, the power-chord SLAM + cabinet boom · 🌀 a laser, a Dorian arp, an orbit swoop + sub drop · 🎀 stomp-stomp-clap, a Lydian strut, glitter (locked card, bench only). The menu song ducks to 35% under it; a new pick cuts the last one; local click only (an online lobby does not hear other seats' picks). `audio/spiritSting.js`, `test:spiritsting` **84** (mutation-tested). 🎛️ **At Alex's dial-in**: notes ×1.35 · noises ×1.42 · 22% slower (the phrases themselves are still first guesses). Nobody has heard it in the real lobby yet
- 🎭 **Every committed track carries its Spirit's SIGNATURE LAYER** — ⭐ **NEW 2026-09-28**, Alex: the stings are *"the standard benchmark for how sounds are committed"*. Whichever of the three builds plays, the Spirit's noise opens it or lands under its money note (Ronin: blade · Monster: cabinet slam · Zero: laser + sub drop · Glamarchy: clap + glitter) and the money note is doubled on a second instrument (the shamisen under the KATANA, or the KATANA over a shamisen build; a second guitar an octave over the Monster; a sine swoop over Zero; a bell over Glamarchy). The seat-unlock fanfare gets the doubled voice only. `commitStyles.js` `COMMIT_LAYERS`, noises from `spiritSting.js` `playSpiritFx`; `test:commitstyles` **838**. ⏳ **Levels are first guesses** — on/off A/B and two sliders on the *Spirit Sound Bench* (v5)
- 🎭 **The select screen shows the standees** — ⭐ **NEW 2026-09-25.** Each roster card is the Spirit's real acrylic standee (`ui/spiritPickerStage.js`, one shared canvas). Hover → it **pops** out of the card; keep hovering (1.3 s) → its **backstory** types on beside it (📖 `data/spiritStories.js`, ⚠️ **all placeholder text**); pick → it spins. No WebGL2 → today's flat art. At Alex's dial-in (2 of 31 levers). `test:spiritpicker` **63**
- 🎛️ **The amps carry NO label** — ⭐ **2026-09-25, Alex.** The DRIVE/SUSTAIN word plates are gone; what reads is each cabinet's **top-edge glow, red on Drive amps and blue on Sustain amps** (*"what actually does help is the outline over top the amps"*). All eight speakers stay. 🪦 A dial-in-a-speaker was built and pulled the same afternoon (*"far too small to see"*); its files are in `_to_delete/2026-09-25-amp-dial/`.
- 🪨 **The amps sit IN the stage again, not on it** — 🐛 **FIXED 2026-09-25.** Every amp is modelled from y −0.42 and the Stage top is y 0.08, so half a unit of each cabinet is buried. The solid layer's re-draw (since 2026-09-24) did not know about the Stage and painted that buried base over the board as a dark "foundation" under every amp (Alex spotted it). The Stage and Island now write depth in the solid pass (`solidLayer.js` `OCCLUDER_LAYER` / `markOccluders`). The amp model and stacking are unchanged since 2026-09-08. `test:topview` **55**.
- 🔦 **The spotlight beams draw over everything** — ⭐ **2026-09-25.** The cones render on the foreground canvas with no depth test (`arenaEnvironment.js` `overlay`), above the board and the solid layer's re-drawn amps, so an amp no longer cuts a beam off. The floor pools stay in the arena.
- 🔊 **The Sonic's rings draw over everything but the attacker** — ⭐ **2026-09-30.** The clash (beams, shield, build rings, shards, HP plate) is its own scene drawn LAST on the foreground canvas (`beamLayer.js`), bloomed with the arena's settings (off in Lite) and screened on; the attacker's print is its only occluder, so the loop passes behind them on its far side. No depth of field on it.
- 🎨 **A Spirit's only colour is its PLAYER'S** — ⭐ **NEW 2026-09-25.** P1 blue, P2 orange, then purple and yellow (`playerColor(corner)`). `SPIRIT_DEFS` and the skill routes carry no colour at all. The picker cards and their standees take the colour of the player who is choosing. The standee edge, the fans' halos, every ability flash, the rail buttons, the Bushido lane and Shukuchi's ring all take the owner's colour. The same Spirit picked twice shows as two colours. Colours that mean a thing (slime, damage, pyro) are unchanged. `test:seatportrait` §1
- 🎭 **The chosen Spirit's head in the seat banner** — ⭐ **NEW 2026-09-25, IN THE GAME at Alex's dial-in** (5 of 33 levers moved: banner 141 px tall, portrait 73% of the banner, backdrop .6, slant 18°, 760 ms slide-in). It is a close-up of the standee's print, cut the standee's way, edged in the player's colour, and it breaks out of the banner's top edge. `ui/seatPortrait.js` + `SeatPortrait.jsx`, mounted by `DraftSeats`. `test:seatportrait` **66**. The preview is `.scratch/seat-portrait-preview.standalone.html`, and a published copy of it exists too.
- 🎥 **The 3D camera follows the action** — ⭐ **NEW 2026-09-17, reworked the same day (v2).** It stays on the acting Spirit: between actions it changes shot every **20 s** — a close shot (distance 19, tilt 44°), the Spirit's surroundings (it leans toward a rival within 9 rather than framing across the board), a low hero shot. A **move is a slow Ken Burns push-in** that keeps the camera's angle (−11% over 3.6 s, 9° pan, from distance 27). Battles and effects (lasers, pyro, falls, vortex, tentacle) still get their own shots, held 2.3 s. **The wide shot only comes after 60 s of quiet** (no action, new turn or camera grab), and then holds. ⚠️ **Calm by dial-in** (2026-09-18): swing 0.5, drift 0.5°/s, and **breathing OFF** — the slow 0.5°/s drift is the only idle movement left, so it moves, but barely. (Alex turned breathing off in a third one-lever pass the same day.) Dragging, scrolling, pinching or a camera button hands the camera to the player — **a click that picks a hex does not** — and it comes back 6.5 s after the last input. The Sonic shot still owns a volley. ☰ **Auto camera** switch (on by default, per machine); a toolbar badge shows *Auto* / *Yours · auto in N s*. Reduced motion: off. `board/cameraDirector.js`, Alex's dial-in, twice (2026-09-17 then the calmer pass 2026-09-18). `test:cameradirector` **87**. ⚠️ Built while the device shell was down — verified in the cloud on a full copy of the tree (`SEQUENCING.md` §A 26-camtiles)
- ⌗ **Top-down is an axis, and a battle plays out on it** — ⭐ **NEW 2026-09-24**, reworked the same day. **⌗ Top** looks straight down a fixed axis (`board/topDownView.js`).
  - **While on it,** the camera never wanders and a battle's director shots are held off: the bout plays from where you are looking.
  - **Zooming or panning keeps top-down.** Any tilt or turn ends it, and the auto camera comes back after its usual 6.5 s. ◈ Arena / ◎ Spirit also end it.
  - **A Sonic started under Top runs in real time:** no hit-stops and no slow-motion burst on the picture, the chords or the rules' timers (`barrageRealtime`). Every beat still plays. The ring beam's eased approach is part of how the beam looks and is unchanged. The Swing had no slow motion.
  - **Saved per machine** (`rlsw.topView`, off by default). Badge: *⌗ Top · locked*.
- 📌 **Hold keeps the camera still, anywhere** — ⭐ **NEW 2026-09-24.** A toolbar button that is the ☰ **Auto camera** switch turned off: no roaming, no idle drift, no battle angles. Off by default. It is one setting with two buttons, never two settings.
- 🪩 **The crowd waves glow sticks** — ⭐ **NEW 2026-09-25, at Alex's dial-in** (15 of 23 levers, `board/glowSticks.js` `GLOW_LOOK`). Visual only. Every fan holds one, some two; neon colours; sway, pump or circle at 77 bpm, about half the stand waving at idle. Their Spirit wins a bout → the whole stand waves faster and higher; loses → the sticks droop and dim. One draw call per part per stand, whatever the crowd size. Reduced motion holds them still. `arenaCrowdCheck` glow section. ⚠️ Not yet seen in the running game on real hardware. Preview: `.scratch/glowstick-preview.html` / the *Glow Stick Study* artifact.
- 🧱 **Amps, fans and dice are solid** — ⭐ **FIXED 2026-09-24, REWORKED 2026-09-25.** Hex tints on the board's SVG layer used to paint over anything standing in front of them. The foreground canvas, above the SVG, now draws them again with their own materials and the arena's lights: depth first, then colour (`board/solidLayer.js`). 🪦 The 2026-09-24 version copied the arena's pixels instead, and on Alex's GPU that turned them into black glass. ⚠️ A solid drawn on top is not bloomed or depth-of-field blurred. Not yet seen on real hardware. Standees behind an amp are hidden by it too. Still see-through by design: the Rival's shield and label cards.
- `test:topview` **49**.
- 🟪 **Move tiles you can actually see in 3D** — ⭐ **NEW 2026-09-17.** The hexes the acting Spirit (or its Shadow) can step to glow **magenta** with an outline in the Spirit's own colour, pulse, and lift under the mouse; the board dims slightly while a walk is armed; a row of **step pips** at the pawn shows steps left and greys out when spent. The old 9% white SVG fill is hidden once the arena is ready. `board/moveTiles.js`, fed by `arenaFrame`'s `reach` (the client's own `reachable` sets). Alex's dial-in; the "later this turn" tiles were turned off. `test:movetiles` **41**. Shukuchi's landing tint is unchanged (still SVG only)
- 🎛️ **A dial pops over the head of the Spirit whose Drive/Sustain changed** — ⭐ **NEW 2026-09-16.** In the 3D arena only; ticks on the pocket's timing, lingers 0.9 s, fades. ⭐ **Every Spirit's Drive and Sustain is now public** — a rival's Drive was shown nowhere before (Alex's call). `board/headDial.js` + `headDialVisuals.js`, fed through `arenaFrame`. Alex's dial-in (all 23 levers left at default). `test:headdial` **67**, and `test:arena`'s presentation suite still passes with the real GLB. ⚠️ Adjacent pawns' dials can overlap from the wide Arena camera — accepted in the dial-in. ⚠️ Same caveat as below: `test:all`, `check:bundle`, `lint:baseline` not run on the device
- ⏱️ **The Drive/Sustain dials TICK** — ⭐ **NEW 2026-09-16.** A change waits a beat, then steps one block at a time (white flash gained, red flash lost, the number counting along), capped at ~1.1 s for any jump; a turn handoff and reduced motion snap. `ui/dialTick.js` + `ui/ArenaDial.jsx`, Alex's dial-in (every lever left at its default). `test:dialtick` **43 + 19**. ⚠️ **Written while the device shell was down** — both halves passed in the cloud against copies with React/jsdom installed standalone; `test:all`, `test:arena`, `check:bundle` and `lint:baseline` **did not run**
- 🎯 **The beginner finder's BRAIN** — ⭐ **NEW 2026-09-16, headless only.** `engine/policies/playFinder.js` → `findBestPlays`: for Drive, Sustain, Db and fans, the best stack commits AND melody line a hand can make, scored only by the game's own readers. `test:playfinder` **819** (every play committed through the real `commitMelodyEconomy`; brute force on seeded small hands). ⛔ **No UI** — Alex's delivery is the fans saying what they want in **speech bubbles** (step 2: a `.scratch` preview). ⚠️ Db/fans are line-first by definition. 🐛 **Three bugs found beside it, none fixed** — `SEQUENCING.md` §A 21-finder: the style coach reads the START of the line as its "trailing" run (coach + bot); an **empty** stack fights at the sheet stat (Ronin Drive 8) while every chord is 1–5; a discord ending still pays the Sustain carrot
- 🎤 **The fans' speech bubbles + chord glow — ✅ IN THE CLIENT, beginner mode only** — ⭐ **NEW 2026-09-16.** Melody step: the acting human's own front-row fan says what to play next (neon bubble, Spirit colour, the next note pulses in the stock); chord step: the notes worth stacking glow red/blue. Hidden while a Pickles tip is open. 🎤 **Its own ☰ menu switch, *Fan hints*, since 2026-09-17** — separate from *Beginner tips*, so dismissing Pickles no longer mutes the fans (both start from the lobby's Beginner choice). The finder runs in a **Worker** (`ui/crowdFinderClient.js` → `engine/policies/playFinder.worker.js`). At **Alex's dial-in** (`CROWD_BUBBLE`: radius 12 · chips 22 · anchor = his stand · 950 ms before speaking · 1500 ms gap · glow breathes 1500 ms). `test:crowdbubble` **116** · `test:crowdcoach` **3,204** · `test:playfinder` **821**. Rendered beside the preview in Chromium: identical box (129×95), zero style differences. ✅ **2026-09-17: all suites run on Alex's machine**; coach bugs fixed (open-run contour, discord shapes, carrot). ⏳ **Playtest next** — `.scratch/crowd-coach-playtest.md`. 📌 Drive/Sustain usually want the same notes, so the glow mostly shows one colour — that's the *Glow source* lever at its default, and it's on the checklist.
- 🪦 **No Db** (2026-10-02) — abilities are drafted two per seat, ready, gated by `cooldowns.js` `canFire` (in the kit + off cooldown) and their own sacrifices. The melody pays fans and the red/blue carrot. The shop, the unlock price, per-use Db, the Db HUD and the Major/Minor pivot are deleted

**⛔ DESIGNED, NOT BUILT** *(8 docs say "design only")*

| what | doc | note |
|---|---|---|
| 🪦 ~~The Db sink / upgrade shop~~ | `UPGRADE_SHOP_DESIGN.md` | 🪦 **CANCELLED 2026-10-02** with Db itself |
| 🎼 **Melody identity** (4 verbs) | `MELODY_IDENTITY_DESIGN.md` | ✅ **unblocked 2026-10-02** — the Db sink it waited on is gone; ⚠️ its Db verbs need re-reading as fans/carrot |
| ⭐ **Fame track redesign** | `FAME_TRACK_REDESIGN.md` | ✅ **BUILT 2026-09-16** — §12. 🎨 due a 3D-aesthetic pass |
| 👹 **Metalness rework** | `METALNESS_REWORK_DESIGN.md` | ⏸️ on hold — but now on the Ronin's critical path |
| 🐀 **Riff Rat** | `RIFF_RAT_DESIGN.md` | least resolved of any doc |
| 🕺 **Mocap → character animation** | `MOCAP_DESIGN.md` | ⛔ **blocked on a rigged character**, and on nothing else — it is off the §6 bottleneck entirely |

**⏸️ PARKED ON PURPOSE**

- 🤖 **The bot** — *"if I keep having to recalibrate how the bots think after every implementation, I'd be doubling my work"* (Alex). ⚠️ Every bench since 2026-09-02b reads a bot that does not know fans got better.

---

## 6. ⛔ THE BOTTLENECK, AND IT IS ONE THING

Almost everything open funnels through the same node:

```
   universal cooldowns  ──┐
                          ├──►  🎸 the siphon  ──►  the Ronin's kit
   👹 Metalness rework  ──┘                              │
                                                         ▼
   💰 the Db sink (upgrade shop)  ──►  🎼 melody identity  ──►  🤖 bot retune
```

🎯 **`METALNESS_REWORK_DESIGN.md` is parked and is now blocking the Ronin.** It
was a parallel arm until the siphon needed a rival with cooldowns to steal from.
**If the Shamisen is wanted before Metalness, that is a trade to make on purpose.**

✅ **2026-10-02: THAT TRADE IS NO LONGER NEEDED — AND THE NODE IS DONE.** The siphon is superseded by the **Iwato curse** (`RONIN_ABILITY_DESIGN.md` §2.3.00), which touches notes, the Scale Wheel, Db and fans — things every Spirit already has, and ✅ **it is built** (same day). **Metalness no longer blocks the Ronin.** The diagram above is kept for the record; what is left of Chain A for the Ronin is playtesting the curse and teaching the bots to use it.

✅ **2026-10-02: THE Db SINK NODE IS GONE — BY DELETION.** Alex cut Db outright
(*"the cooldowns and 'sacrifices' are the gate, not another economy over what is
already doing quite a bit"*). With no currency there is nothing to sink, so
🎼 melody identity is unblocked. The diagram above is kept for the record.

---

## 7. 🎯 THE SHORTEST USEFUL NEXT STEPS

> 🚨 **0. ⭐ BUILD THE CORE LOOP REWORK — `CORE_LOOP_REWORK_BRIEF.md`. THIS IS
> THE JOB.** A long design conversation on 2026-09-15 ruled on the Sonic
> barrage, the Swing's identity, the Riff Off's trigger, the dice sources, the
> charge zones and the match's whole scoring shape. **22 rulings, 8 open
> questions, 6 phases, one brief.**
>
> ⚠️ **AND IT PARKS EVERYTHING BELOW THAT TOUCHES AN ABILITY** (Alex): *"the
> core loop needs to be strong and solid before we worry about the abilities
> that are meant to break it."* Items 5–9 of this list are **on hold** — they are
> not cancelled, and the roster question in §6 stops blocking anything while the
> freeze holds.
>
> 🎯 **Start at the brief's §0** — four changes that look independent are one
> lever pulled in sequence, and doing them out of order makes each look like it
> is breaking something.
>
> ✅ **§0's LEVER IS PULLED, 2026-09-15.** All four steps shipped together:
> rounds is the default → the per-turn cap has no job → the fan weights are
> restored → the Sonic die ladder is deleted. 🎯 They had to land in ONE pass:
> stopping after the fan restore would have left casuals paying **twice**
> (Fame multiplier *and* permanent die size), which is the runaway R5 exists to
> prevent.
>
> ⛔ **PHASES 2 (rest), 3, 4, 5, 6 ARE STILL OPEN** — the charge FLOOR rework and
> the marquee card, the barrage port, the Swing rewrite, the Riff-Off trigger,
> presentation.
>
> ✅ **PHASE 1's HUD HALF IS DONE, 2026-09-16** — rounds readout, lobby toggle and
> the Fame track's rework all shipped. `test:buzzer` **81**, `test:fametrack`
> **9 states**, `test:harness` back to green at **1816**.
>
> 🚨 **AND IT FOUND THAT THE CLIENT WAS NEVER PLAYING THE MODE.** The buzzer had
> no client path at all — `buzzerReached`/`buzzerVerdict` appeared nowhere in
> `rlsw-simulator-v3_8_1.jsx` — so the only surviving ending was a Fame crown
> firing on `startingLives × fpPerLife` (⭐18 at 4P), a target this mode does not
> have. With elimination off nothing else could end a match either.
> **Every match was ending as a Legend Run, roughly half-played** (measured
> leaders bank ⭐38–47 by round 10). `WIN_CONDITIONS_DESIGN.md` §8b has the
> anatomy.


🧪 **THE SWEEP, 2026-10-04: `test:all` is 89 suites; 85 pass, 4 are red, and each red has an owner.**
The image-case fix let the esbuild suites run on Linux again, which exposed 21 reds —
nearly all tests written before a rule changed (the Thrash clash, the 2–3 hex beam,
the vocabularies' dice, the Eleven die, Db's cut, spending off the TOP, the 2D board's
archive, the Iwato curse). Those were brought up to the code; the four left are not
the tests' to fix:
- ⁉️ **`test:bushido` — the Shadow cooldown (2) no longer outlasts the double (2 turns).**
  A rule, so it was left failing: Alex decides which number moves.
- 📂 **`test:shukuchiui`, `test:standeemove`, `test:dice` read preview files that were
  never committed** — `.scratch/shukuchi-hop-preview.html`, `.scratch/standee-move-preview.js`,
  `.scratch/sonic-rework/barrage.mjs` + `.html`. They are on Alex's machine only; commit
  them and these three run anywhere. ⚠️ Until then they cannot pass in any fresh clone.
- 📌 **Two removals rode in a commit titled "3D arena edits" (2026-09-22):** ☀️ Sunbeam's
  blind and 💀 Azrael's streak Fame left `battleConsequences`, and neither is in any kit
  now. The suites now assert they are gone — ⁉️ **confirm that was intended.**
- ✅ `test:arch` is green: the 14 unlisted stage-effect modules have rows. The six
  loadout modules this list used to name as unlisted are listed.

⛔ **All thirteen server smokes (`n2`–`n13`) remain unwired** — no npm script runs any
of them (§B3).

1. 🎨 **Bushido lane port complete.** Recovered the saved preview and applied the three 2026-09-05 screenshots. `test:bushidoui`: 331 checks across 11 scenarios × 6 facings. `test:journey` verifies arm/cancel and turn handoff. Next engineering work: a completed client battle journey before extracting combat orchestration.
2. ⚠️ **STALE — THE RING BEAM IS PORTED.** `sonicZigzagVisuals.js` (72KB),
   `sonicRingCheck.mjs`, `arenaDiceSequence.js` and `combatDice.js` are all in
   `src/` as of 2026-09-15. 📌 The project doc `claude/sonic-volley-rework-handoff.md`
   is stale the same way. ⛔ **What remains unported is the contact push-in**, which
   still has no home in `stageSonicCamera` — `RING_BEAM_BRIEF.md` §4. The original
   entry follows, kept only so the claim can be traced:
   ~~🔊 **Port the Sonic ring beam** — ⭐ **the projectile is DECIDED** (2026-09-13, off a live preview; `PROJECTILE_COMBAT_DESIGN.md` §12.1c). ⛔ **Nothing is in `src/` yet.** The whole sonic rework — readable dice, the player-pressed ROLL gate, the camera fix and now the beam — is drafted and checked in `.scratch/sonic-rework/`, and the one-pass build brief is that folder's `RING_BEAM_BRIEF.md`.~~
3. ~~🎼 **Name the ending constant, and write Alex's rationale onto it.**~~ ✅ **DONE 2026-09-15.** `music/melodyPayout.js` → **`ENDING_DB`**, exported, carrying both §14.9.3 reasons, §14.9.5's one-number-two-jobs cost and §14.9.4's unsettled tonic in the comment above it. Rename verified behaviourally inert — `.scratch/endingDbCheck.mjs`, **28,807 assertions, 0 failures**, old ternary vs new map over 9,600 random lines × 8 keys × 3 Spirits. Indexed in `ARCHITECTURE.md`'s export row **and** its "where do I change X?" table. 🎯 **The tonic number (§14.9.4) may now move safely** — the thing that had to happen first has happened.
4. 🎸 **Playtest the live Riff Off** — short alternating calls are on the 3D board, with continuing exchanges and tempo-aware bots. Try humans on two devices, listen to both rig voices, and tune the physical-error curve from play. The old turn-start melody-stash blocker is closed by `lastCommittedMelody`.
5. 🤖 **Re-bench the Ronin** — **OVERDUE THREE TIMES NOW.** Every Ronin number from 2026-09-04c/d was taken while the client refused hops the searcher planned; his whole kit changed shape again on 2026-09-04f; and on 2026-09-05 the lane rule changed what the searcher may plan at all. Nothing but a re-run is comparable with anything.
6. ~~💰 The three riders on the flat number~~ 🪦 **MOOT 2026-10-02** — Db is cut, so there is no number to ride on.
7. ⚠️ **Watch the abilities whose ONLY brake is now the cooldown** — 🌌 Displace, 🕳️ Gravity Control and 💻 Code Injection (Intergalactic 0) lost their Db price and carry no other sacrifice. 🧊 Not a rebalance (§B10) — a **measurement** to take in play / once the bench is re-run.
8. **Decide the roster** — Glamarchy out, Riff Rat in? Two docs already assume yes.
9. 🚨 **Answer the Ronin ledger** — `CHARACTER_HANDOFF.md` → "THE RONIN LEDGER". Four passes made him weaker and each deferred the compensation to the next. ⚠️ **Shukuchi is now built, which does NOT close it** — it is a 6 Db mobility tool where a 12 Db payout used to be, and the 12 Db slot is still empty. 🧊 §B10 does not cover this: it is a slot question, not a balance tweak.
10. ~~🪦 Delete Wa no Koe properly.~~ ✅ **DONE 2026-09-04.** · ~~🌀 Build Shukuchi.~~ ✅ **DONE headless 2026-09-04.** · ~~🖥️ Port Shukuchi's overlay.~~ ✅ **DONE 2026-09-04e.** · ~~🗡️👤 Step (c), the respec.~~ ✅ **DONE 2026-09-04f.** · ~~💰 Pick the flat unlock number.~~ ✅ **6, DONE 2026-09-04f.** · ~~🗡️ Give Bushido's lane one blocker rule.~~ ✅ **DONE 2026-09-05.**
11. ~~🌌 Title screen: the 3D arena, far off and turning.~~ ✅ **DONE 2026-09-29** with Alex's dial-in (`board/titleArena.js`). 📌 `RiffMenu`'s island is open (SEQUENCING 41-title); phones are archived, not open.
12. 🎸 **Play the Iwato curse in a real match** (built 2026-10-02) and rule the three port calls left open in `RONIN_ABILITY_DESIGN.md` §2.3.00 — **range** (3, no line of sight), **does a hit snap a string**, and **the key kept from the take-up**. Then teach the bots to take it up and when a string beats a Drive or Sustain note (they already play a cursed hand, and may exorcise).

---

## 8. 🗺️ WHERE EVERYTHING LIVES

| you want | read |
|---|---|
| **what is true right now** | 🧭 **this file** |
| what happened, and what it taught | `SEQUENCING.md` (§A live, §B findings, §C index) |
| the full history | `docs/archive/SEQUENCING-full-through-2026-09-04.md`, then `docs/archive/SEQUENCING-handoffs-2026-09-08-to-09-29.md` |
| where code lives / "where do I change X?" | `ARCHITECTURE.md` — 🎯 the only machine-checked doc |
| the game explained from scratch | `GAME_BRIEF.md` |
| a Spirit's kit | `CHARACTER_HANDOFF.md`, then the per-character design doc |
| **a half-formed idea** | 💡 `IDEAS_INBOX.md` — put it there, not in whatever doc is open |

⚠️ **The design docs are not machine-checked and drift.** `ARCHITECTURE.md` is the
only one a suite verifies. Read the rest with suspicion, and when one is stale,
**say so plainly rather than editing around it.**

**2026-09-24 idle camera:** Approved scratch flow is integrated: speed 1.2, sway 1.3, 6.5-second quiet delay, four-second easing into travel. Every click resets the delay. Battle/action cameras and manual control take priority. Lightning and rock changes remain scratch-only; all nine approved values are saved in `.scratch/arena-storm/approved-settings.json`.

**2026-09-24 Testing Grounds revived:** every seat is human; the 🧪 panel (now on the RIGHT, clear of the Move & Act rail) has 🎮 **Play as** (take any Spirit mid-turn — `SANDBOX_SEAT_TAKEN` rotates the queue, no turn ends), 📍 **Drop** (arm, click any hex — `SPIRIT_WARPED` at cost 0) and 🆓 **Free play** (on from the menu/lobby: the acting Spirit is topped back up — AP to 10, action token, cooldowns, Db, the FULL kit — plus a Chord / Melody / Move & Act step jump). ⭐ Refill, not bypass: costs are paid through the real gates, then handed back. `engine/systems/sandbox.js`, `test:sandbox` **36**. Offline only (N8).

**2026-09-24 the Sonic clash (Alex's beat list):** the ring beam is back at its signed-off `RING_TUNING` — the 2026-09-19 barrage had cut it to slow-mo 18 / burst 2.1 / 16 rings and hidden its shield, which Alex called "far lower quality". Now: each player's dice in **their own colour** (Sonic and Swing); the Rival's Sustain amp throws wide rings that **build** one shield in their colour, as **bright as the roll is strong**; every Drive hit **freezes the action 0.5 s** (hit-stop, the lens shakes) and **bursts / cracks / both** by strength against one Sustain die; the break **shatters in slow motion**; later dice hit the Spirit, each with its stop; then the push. Shots 1.25 s apart. `board/sonicClashVisuals.js`, `sonicBarrageTiming.js` (`SONIC_BEATS`, one reversible clock — audio and consequences ride it). 🎬 **Camera:** chair and side shots are FITTED to both Spirits (the "zooms way in to nothing" bug), and a **two-shot pushes in on the pair with speed lines from the screen border** at the opening (`BATTLE_INTRO` 1.6 s before the first ROLL) and once the dice line up. `board/speedLines.js`. ⏳ **Alex is to try it in the Testing Grounds and report back.** Rules unchanged.
🐛 **Fixed after his first report (same day):** the opening two-shot stood square to the lane, so two standees facing each other were filmed almost **edge-on** (78° off their print) from **4.8 units** at adjacent range — "pointing at nothing, zoomed in extra far into the stage". It now takes a **three-quarter angle scored on each standee's print** (both ≥ 0.6 square-on) and never frames the pair closer than **8**; every **charge shot** is bent until its standee's print is at most 60° off square. 🔇 **The amps no longer pulse or jitter** — the cabinet scale-thump is gone; live amps light up and hold. `test:battledirector` **38**, `test:sonicfx` asserts no cabinet moves.

**2026-09-28 the clear lens + the attack reach:** 🐛 **the "zooms into nothing" at the start of every battle was the old 2D board dive-bomb** (the board frame spun to 7× and faded out for 1.1 s) still running over the 3D arena — now 2D only. 🔭 every battle shot is checked before it is used and swung to the nearest clean angle — no Spirit's sheet in front of the lens, no Spirit hidden behind the other, an amp stack, a grandstand or the truss; the charge shot aims at most 2.2 past its Spirit; the Swing's side-on prints are known to the director. Measured headless on the real arena: bad frames in 11/50 Sonics and 15/40 Swings before, **0 in 180** after (`test:battlelens`). 🎯 Hovering or arming any attack or special (Swing, Sonic, Blaster, Tentacle, Bushido, Gravity, Displace, Shukuchi) lights its reach in the 3D arena in the ability's colour; a rival in reach burns brighter with a second ring (`board/attackTiles.js`, `test:attacktiles`). ⏳ Alex to play it.
