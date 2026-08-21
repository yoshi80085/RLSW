// Every N Decibills -> player unlocks their targeted skill.
// Points carry over after crossing a threshold.
//
// ⚠️ 6 → 4 WHEN THE Db SOURCES WERE CUT FROM NINE TO FOUR. Removing the Style
// payout, the Drive/Sustain overflow, the Performance-Score top-up and the
// chromatic payout took mean income from 3.98 Db per commit to ~2.6 — a 35% drop.
// At a threshold of 6 that would have been 2.3 commits per upgrade instead of 1.5,
// i.e. the game silently got a third slower. Lowering the threshold is the honest
// lever: it holds the pacing without re-inflating a source we deleted for being
// illegible. Re-measure with `node src/engine/dbaudit.mjs` before touching it.
export const DB_UPGRADE_THRESHOLD = 4;

// Stock is a reservoir, not a fresh hand. Unused notes carry
// over; only this many spent slots recharge per turn.
export const STOCK_REFILL_RATE = 6;

// -- DRIVE / SUSTAIN STACK SPLIT (DRIVE_SUSTAIN_SPLIT_DESIGN.md) --
export const STACK_COMMIT_BUDGET = 3;   // max notes committed to stacks per turn (split freely between Drive & Sustain)

// -- STACK CAPACITY IS EARNED (THEORY_REWRITE_LOG B0b) --
// The cap is no longer a global constant. Slots 1-3 are baseline; slot 4 is
// bought with `theory_dom7` and slot 5 with `theory_modes`. The skill named
// "Blues / Dominant 7th" is the same purchase that lets you BUILD a dominant
// 7th — melody permission and harmony capacity arrive together.
export const STACK_CAP_BASE = 3;   // slots available with no Theory investment
export const STACK_CAP_MAX  = 6;   // ceiling once all three gating tiers are owned

// Single source of truth for the derived cap. DO NOT inline this rule — every
// read of "how many slots does this spirit have" must come through here.
// ⚠️ `theory_chromatic` NOW GRANTS A SLOT — it is the whole reason to buy it.
// Measured over 15,000 simulated commits, the capstone used to pay LESS than the
// rung below it (−0.04 Db): its only lever was the approach-note pardon, which
// shaved an already-tiny discord penalty, and its headline chromatic payout fired
// on 1% of commits. Meanwhile the audit showed stack SLOTS are what actually make
// the Theory ladder pay — Harmonic Lock climbs 0.00 → 0.83 Db on slots alone,
// because a bigger stack is a bigger chord to land in. So the most expensive skill
// in the game now sells the only 6-note stack there is.
export function stackCapFor(unlockedSkills = []) {
  let cap = STACK_CAP_BASE;
  if (unlockedSkills.includes('theory_dom7'))      cap += 1;
  if (unlockedSkills.includes('theory_modes'))     cap += 1;
  if (unlockedSkills.includes('theory_chromatic')) cap += 1;
  return Math.min(STACK_CAP_MAX, cap);
}

// NOTE: the old flat `STACK_CAP = 5` export is GONE on purpose. Anything that
// used to compare a stack length against it must now call stackCapFor(); use
// STACK_CAP_MAX only for layout loops that draw every slot, locked ones
// included. Archived code (Rake's noteCost, gallopCondition) will fail to
// import rather than silently assuming 5 — fix it to take the derived cap.

// -- 🧪 THE SLIDE (METALNESS_REWORK_DESIGN.md §2) --
// Free movement BACKWARDS along your own slime trail. Speed 4 + 2 slide steps
// is the "~6 effective moves" the rework quotes.
//
// ⚠️ THE CAP AND THE CONSUMPTION ARE BOTH LIVE, AND THEY PRICE DIFFERENT THINGS.
// Sliding eats the slime it crosses (§5's ruling: all three uses on one meter),
// which prices a retreat against the Tentacle's reach and the Slam's fuel — a
// long escape costs a long road. That is the INTERESTING cost, and it is
// self-limiting only in the long run. The cap is what stops one enormous
// disengage in a single turn, which no amount of trail-spending would prevent.
// Tune the cap; the consumption is the design.
export const SLIDE_STEPS_PER_TURN = 2;

// -- 🧪 SLIME IS AN ABILITY, NOT A PASSIVE (2026-08-17 rework) --
//
// ⚠️ IT USED TO TRAIL BEHIND HIM FOR FREE, and that was the design's one
// unanswered complaint. §5 of the rework doc says it plainly: "it is a resource
// he accrues for free that rivals can only avoid." Everything else in §3 treats
// the trail as a CURRENCY — three uses competing for one pool — and a currency
// nobody pays for is not a currency, it is weather.
//
// So laying road is now a deliberate act. It costs 1 AP, it can be called once
// per turn, and it SETS his movement for that turn rather than adding to it.
// Walking with it off lays nothing at all.
//
// ⚠️ SET, NOT ADD — and the distinction is the whole shape of the turn. AP is
// `min(melody, speed)`, so a good melody already buys 4 steps; paying 1 for
// Slime and keeping 3 would make it a straight tax on a good turn. Setting it
// instead means Slime is worth exactly the same three steps whatever you rolled
// up — it turns a BAD melody into a road-building turn, which is the first thing
// in his kit that gives a weak commit somewhere useful to go. (Same idiom as
// `Goes to 11` in §4d: the interesting version of a number is the one that sets.)
export const SLIME_AP_COST    = 1;   // to call it
export const SLIME_MOVE_STEPS = 3;   // …and your movement BECOMES this

// -- 🧪 THE ROAD IS CAPPED BY LENGTH, NOT BY TIME (METALNESS_REWORK_DESIGN.md §3) --
//
// TWO rules end a hex, and under normal play they agree.
//
// ⚠️ THE LIFETIME IS COUNTED IN HIS OWN TURNS, NOT IN SPIRIT-TURNS. The shipped
// decay ticked at the end of EVERY Spirit's turn, which in a four-handed game
// burns a "3 turn" trail in less than one revolution — the road would be gone
// before its owner ever acted again. `economy.js` carries the same warning about
// Sunbeam's `blindTurns`, and `decayPoisonSlime` fell into it once already. This
// is the third system with that shape. Tick it on the OWNER'S turn end.
//
// Three of his turns and a hard cap of six means: lay 3 on turn one, lay 3 more
// on turn two and the board holds all six, lay a third batch on turn three and
// the FIRST batch is pushed off the end. If he stops laying, the clock catches
// it instead. That is one rule the player can state — "your last two batches" —
// expressed as the two mechanisms that enforce it from either side.
export const SLIME_LIFETIME_TURNS = 3;   // ticked on HIS turn end, never anyone else's
export const SLIME_TRAIL_MAX      = 6;   // …and a third batch evicts the first

// -- AMP / DICE SYSTEM --
// ── NEW RIG SYSTEM (AMP_DECK_DESIGN.md) ──
// Every Spirit starts with a Main Amp at their corner: baseline 1d6, board-wide.
// Amp I–III add dice to the pool; Power I–III upgrade dice d6→d8 (gated behind
// matching Amp tier); Range I–III extend the radius where rig bonuses apply.
// Roll is keep-highest. Outside your Range you fall back to baseline 1d6.
export const SONIC_BASE_DIE     = 6;
export const SONIC_UPGRADED_DIE = 8;
export const SONIC_POOL_MAX     = 4;                    // 1 base + 3 amp tiers
// 🌀 PSYCHO BUSHIDO — the Iaijutsu dash (§4.1). The cooldown was already ticked
// by `turnFlow` and stored by `economy` long before the move was reachable to a
// bot; these two are the rest of its rule, hoisted out of the monolith so the
// engine and the client cannot drift.
// ⚠️ THE BONUS IS THE GROUND HE COVERED — `dist - 1` — and the sign matters. It
// used to be `apLeft - dist`, which paid MOST for a charge of zero hexes and
// nothing for a full-length one. Alex caught it 2026-08-20.
export const PSYCHO_BUSHIDO_CD     = 2;   // rounds, ticked in turnFlow
export const PSYCHO_BUSHIDO_MIN_AP = 2;   // 1 hex of run-up + the Swing's own AP

// 🫁 THE RIG BREATHES — SEQUENCING.md §5.H⁶, shipped 2026-08-20.
//
// The radius is no longer a tier you bought. It is
//
//     RIG_RADIUS_FLOOR + (your turn ? Drive stack : Sustain stack).length
//
// which means the rig reaches further the more you have going on, and shrinks
// when you spend or get frayed. `RIG_RADIUS_BY_TIER = [4, 5, 7, Infinity]` is
// GONE rather than deprecated, on purpose: nothing should be able to quietly
// keep asking a Range tier how far it carries when Range tiers no longer exist.
//
// ⚠️ THE FLOOR IS THE ANTI-SPIRAL AND 3 IS NOT ARBITRARY. `makeInitialNoteState`
// seeds both stacks with the ROOT ALONE, so every Spirit opens the game at
// 3 + 1 = 4 — exactly the old tier-0 radius. Nothing about the resting state of
// the board changed. Only a Spirit who has genuinely been emptied out (a Swing
// spends 2 Drive; a Pose sheds Sustain; `chordFray` eats it under a beating)
// drops to 3, and a full six-note stack reaches 9. Lower this and you build a
// game where the Spirit already losing is the one who cannot answer a beam.
export const RIG_RADIUS_FLOOR = 3;

// ─── 🎛️ THE RIG WORKOUT (MARQUEE_QUIZ_DESIGN.md §4–5) ────────────────────────
//
// Pool size and die size are no longer bought with Db. They are WON at the
// marquee quiz's RIG lane, spent immediately on one of two tracks, and lost to
// neglect rather than to a timer.
//
//   `rigPool`  — extra d6 in the Sonic pool. Stands in for the old Amp tier.
//   `rigPower` — dice upgraded d6 → d8. Stands in for the old Power tier.
//
// ⚠️ THE CEILING IS THE OLD CEILING, ON PURPOSE. `AMP_DECK_DESIGN.md` §2.5 is
// explicit that the keep-highest rework dropped the maximum Sonic roll from 12
// to 8, and that every rule leaning on high Sonic rolls — margin-scaled push
// `ceil(margin/2)`, the knockback tiers, the 7+ Performance triggers — was
// re-checked against that 8. Capping the workout at 3 pool + 3 power reproduces
// Amp III / Power III exactly, so nothing downstream needs re-checking. A hard
// question that wants to feel special should feel special by LASTING LONGER,
// never by introducing a d10.
export const RIG_TIER_MAX = 3;

// ⚠️ THE FLOOR IS TODAY'S FREE GRANT, AND IT IS WHAT STOPS THE SPIRAL. Every
// Spirit used to start with `amp_1` seeded into `unlockedSkills` — 2d6 in range,
// 1d6 out of it. `rigPool` starts AT this floor and atrophy can never take it
// below, so the worst case of total neglect is exactly where everyone begins
// the game: survivable by definition, and no way to be quizzed out of existence
// by a rival who happens to know their gear.
export const RIG_POOL_FLOOR = 1;

// 🏋️ ATROPHY — one tier shed for every N of the OWNER'S OWN turns that pass
// without training at a marquee.
//
// ⚠️ COUNTED IN HIS OWN TURNS, NOT IN SPIRIT-TURNS, and this is the third
// system in the file to carry that warning (see `SLIME_LIFETIME_TURNS` and
// Sunbeam's `blindTurns`). Tick it on every Spirit's turn end in a four-handed
// game and a "3 turn" clock expires before its owner has acted twice.
//
// 📌 3 IS A GUESS AND IS FLAGGED AS ONE in MARQUEE_QUIZ_DESIGN.md §9. It wants
// a bench: too fast and the marquee becomes a treadmill nobody can step off,
// too slow and the "workout" is a purchase with extra steps.
export const RIG_ATROPHY_TURNS = 3;
// 🛡️ Sonic DEFENCE die. A rival inside their own rig radius answers the beam
// with their amp behind them (d6). Caught outside it, they have nothing to push
// back with and scramble a bare d4 — the same die a Thrash defence rolls. This
// is also what makes a RIFF-OFF impossible: no live rig, no answering riff.
export const SONIC_DEF_DIE            = 6;
export const SONIC_DEF_DIE_OUT_OF_RIG = 4;

export const CAMERA_ZOOM_MS  = 620;          // push-in tween length; impact rumble lands as it settles

// -- LIMELIGHT SYSTEM --
export const LIMELIGHT_HEX    = 56;   // centre stage hex
export const LIMELIGHT_TO_WIN = 3;    // (legacy -- instant Limelight win removed; kept for overlay refs)
export const LIMELIGHT_FAME   = 1;    // (legacy) the old flat payout for merely STANDING on the centre.
                                      // Superseded by the Pose economy below -- kept only so old
                                      // saves / overlay refs don't explode. Nothing grants it now.

// -- STRIKE A POSE (2026-08 Limelight rework) --------------------------------
// Standing on the centre hex pays NOTHING. The Limelight only pays a Spirit who
// STRIKES A POSE on it, and a pose is a defenceless stance: a posing Spirit
// rolls NO defence die (engine/systems/combat.js -- defTotal is a flat 0), so
// anyone who reaches them lands automatically and hard.
//
// Why the escalating payout: a flat rate makes the centre a place you either
// always want or never want. An escalating one makes it a place you have to
// SURVIVE to profit from -- round one in the middle is barely worth the risk,
// round four is a Spirit the whole table has to deal with. The count is
// CUMULATIVE and never resets (getting shoved off costs you the tempo, not the
// reputation you built), so the threat level of a repeat poser is legible: the
// HUD shows exactly how dangerous the middle has made them.
export const POSE_FP_STEP = 1;   // FP added per pose round survived
export const POSE_FP_MAX  = 4;   // ...capped here. Matches FAME_PER_TURN_CAP -- a
                                 // maxed poser earns a whole turn's FP ceiling by
                                 // standing still with their guard down.
// A pose costs a Sustain note per round -- posturing is not playing defence, and
// the armour audibly decays while you hold it. Camping the middle therefore
// erodes the exact stat that keeps you alive there. A Spirit with an empty
// Sustain Stack may STILL pose: they just do it with nothing between them and
// the next swing. Their funeral.
export const POSE_SUSTAIN_COST = 1;
// FP-per-life scales with player count: fewer players → more FP per life.
// 2P → 8, 3P → 7, 4P → 6.  fameToWin = startingLives × fpPerLife(playerCount).
export function fpPerLife(playerCount) { return Math.max(5, 10 - playerCount); }
export const FAME_TO_WIN      = 24;   // legacy fallback (3 lives × 8) — runtime uses startingLives × fpPerLife(playerCount)

// HARD per-turn FP ceiling (2026-07-16 balance pass). Overlapping FP systems
// (sonic margin + spotlight + rider + groove, riff replays, Azrael, Limelight,
// boss damage) compounded with the underdog/crowd multipliers into 20+ FP
// turns. Every grant flows through grantFame, which clamps the TOTAL a spirit
// can earn inside one turn window (any spirit's turn) to this. Overflow is
// DISCARDED — the crowd can only scream so loud. Applies to boss-fight FP too.
export const FAME_PER_TURN_CAP = 4;

// 🎤 THE DUEL'S OWN CEILING (2026-08-18) — and it is a HIGHER cap, not an
// exemption. `awardRiffFame` builds a payout out of six terms and then hands it
// to `grantFame`, which was clipping the lot at 4: measured over 94 bench duels,
// one that went to sudden death banked 3.81 FP and one that ended in Round 1
// banked 3.89 (`BOT_STRATEGY_HANDOFF.md` §6.6.9). Margin, perfects, the
// Headliner belt, the stage-FX rider and the whole Round-2 bonus were being
// awarded in full and discarded — the marquee event paid exactly what a maxed
// pose pays, which is `POSE_FP_MAX` above, matched to the general cap on purpose.
//
// ⚠️ WHY NOT UNCAPPED. The reason the general cap exists has not gone away: the
// crowd and underdog multipliers compound, and an unclipped duel with the belt,
// stage FX and a comeback multiplier can print double figures in one action.
// This is deliberately a MULTIPLE of the general cap rather than a free number,
// so the two move together if the economy is ever retuned: a duel is worth up to
// two ordinary turns of crowd noise, and never a whole life (`fpPerLife` is 8
// at two players).
//
// ⚠️ IT SHARES ONE WINDOW WITH EVERYTHING ELSE, which is the property that keeps
// it honest. `fameThisTurn` is per Spirit per turn, so a Spirit who already
// banked 3 FP this turn and then wins a duel takes 5, not 8 — and once they are
// above 4 for the turn, every ordinary payout after it banks nothing.
export const RIFF_FP_TURN_CAP = FAME_PER_TURN_CAP * 2;

// UNDERDOG comeback tuning -- see awardFame/underdogBonus.
export const UNDERDOG_MIN_DEFICIT    = 6;    // must be trailing the loser by at least this much Fame
export const UNDERDOG_DEFICIT_PER_STEP = 6;  // every 6 Fame of deficit adds +0.5 to the multiplier
export const UNDERDOG_MAX_MULT       = 2.5;  // hard ceiling on the comeback multiplier
export const TOKEN_MAX        = 6;    // max board mini-goal tokens on the board at once (all Lost Chords now)
export const TOKEN_BASE_POOL  = 10;   // target total tokens regardless of player count — fewer players → more starting tokens
export const TOKEN_PER_ROUND_BASE = 2; // tokens scattered per round with a full roster (scales up as players drop)
// ⏱️ ROUND CLOCK (2026-08-05): shared board timers below are counted in ROUNDS
// (one full revolution of the turn order), not in individual player-turns.
// Values are restated to keep roughly the same real-time length they had on the
// old per-turn cadence at 3–4 players — see NETCODE/PENDING notes.
export const TOKEN_DRIFT_TURNS   = 1; // rounds an uncollected Lost Chord sits before it drifts (was 3 spirit-turns)

// -- FAN ECONOMY --
// Fans never convert to Fame -- they MULTIPLY the Fame every deed is worth.
// Two bands: Diehards (loyal core, stable) and Casuals (fickle, volatile).
export const FAN_DIEHARD_WEIGHT  = 0.10;  // multiplier added per Diehard (loyal core -- worth ~3 casuals)
export const FAN_CASUAL_WEIGHT   = 0.03;  // multiplier added per Casual (fickle fringe)
export const FAN_MULT_CAP        = 2.0;   // hard ceiling -- a full house tops out at x2
export const FAN_DIEHARD_CAP     = 6;
export const FAN_CASUAL_CAP      = 14;
export const FAN_DIEHARD_START   = 2;
export const FAN_CASUAL_START    = 0;
export const EXCITE_PER_CASUAL   = 14;    // performance excitement to draw 1 new Casual fan
export const LOYALTY_PER_DIEHARD = 24;    // performance loyalty to harden 1 Casual -> Diehard
export const FAN_GAIN_BY_RING    = { main: 2, pit: 1, floor: 1, back: 0 }; // casuals gained on a clean commit, by zone
export const FAN_DECAY           = 2;     // casuals bored off per turn once the outer-edge grace runs out
export const FAN_BORED_AFTER     = 3;     // consecutive turns in the OUTER ring before fans start drifting off
export const FAN_PROMOTE_EVERY   = 3;     // consecutive centre-perform turns to harden 1 casual -> diehard
export const FAN_RECOVERY_LAG    = 3;     // your turns locked out of crowd-gain after a demolition
export const FAN_FLEE_MIN        = 2;     // casuals that scatter on a knockdown (low end)
export const FAN_FLEE_MAX        = 3;     // (high end)
export const FAN_DEFECT_TO_VICTOR = 2;    // of the fled casuals, how many swing straight to the demolisher

// -- EVENT SPACES --
// 🎪 TWO MARQUEES, NOT ONE (2026-08-20, MARQUEE_QUIZ_DESIGN.md §1). One event
// hex on a 111-hex board is not a decision, it is proximity: whoever already
// stood nearby takes it and everyone else concedes the round. Two makes the
// player choose which to route toward, and gives a second Spirit a target
// instead of a spectator's seat.
// ⚠️ THIS IS A THROUGHPUT CHANGE AS WELL AS A CHOICE ONE. Trivia pays FANS, and
// fans are the one economy with no per-turn ceiling (`FAME_PER_TURN_CAP` clamps
// Fame and never touches them, because fans MULTIPLY Fame rather than being
// it). Doubling the marquees roughly doubles quiz throughput, so if the crowd
// multiplier starts topping out at `FAN_MULT_CAP` too early, the payouts in
// `TRIVIA_REWARD` are the dial to turn — not this count.
export const EVENT_HEX_COUNT     = 2;  // marquee hexes live at once
export const EVENT_RESPAWN_TURNS = 1;  // ROUNDS after a trigger before a new marquee lights up (was 3 spirit-turns)
// 🎪 Minimum axial distance between two live marquees.
// ⚠️ TWO MARQUEES IN ONE CORNER IS WORSE THAN ONE ANYWHERE — a pair inside a
// single Spirit's pocket hands them BOTH over uncontested, which is the exact
// failure the second hex exists to fix. Home → Limelight is 5 on this map, so 4
// stops them sharing a neighbourhood without shoving them to opposite edges.
export const EVENT_MIN_SEPARATION = 4;

// -- FLAMING DISC / GROUPIE --
export const FLAMING_DISC_COUNT  = 6;
export const FLAMING_DISC_ROUNDS = 2;


// -- CHARGE ZONES -- (ECONOMY_HANDOFF.md — the Lighters replacement objective)
// Fixed (non-roaming) board hexes, picked once at setup — unlike Lost Chords,
// they don't move or vanish, they just go dormant for a bit after use.
// Zones only spawn on hexes the lightning bolt overlay actually touches
// (LIGHTNING_TRACK_HEXES). Tapping one CHARGES the Spirit: a random 50/50
// grant of either a die FLOOR charge (attack dice can't roll below 3) or a
// die CEILING charge (attack dice upgrade one size — d6→d8, etc.). Floor and
// ceiling STACK with each other but never with themselves: a duplicate draw
// flips to the other type; holding both refreshes both. A charge lasts
// CHARGE_ZONE_BOOST_TURNS of the holder's turns (≈2 rounds) or until a battle
// ensues — fighting burns the charge, win or lose. The Overcharge skill
// (Electric route) unlocks an alternative chord-assist payout instead.
export const CHARGE_ZONE_COUNT       = 2;  // fixed lightning hexes on the board
export const CHARGE_ZONE_BOOST_TURNS = 2;  // charge duration (holder's turns) on pickup
export const CHARGE_ZONE_COOLDOWN    = 2;  // ROUNDS before a drained zone relights (was 4 spirit-turns)
export const CHARGE_FLOOR_BONUS      = 2;  // floor charge: attack die results below 1+2 read as 3

// -- 🎸💥 THE SMASH (2026-08-05 rework) --
// The all-out front. You spend EVERYTHING that makes you dangerous — every
// unused note in your stock, your ENTIRE Drive stack, and a note off your
// Sustain — and in return the payout is fixed, undefendable, and aimed at the
// rival's defence rather than their health bar: 2 Vibe, 2 notes torn off their
// Sustain stack, 2 hexes of knockback.
//
// WHY FLAT: the old Smash scaled with notes thrown, which made it a numbers
// puzzle ("hoard stock, then dump") rather than a decision. Paying with your
// chord makes the decision the interesting part — you are trading your next
// turn's offence for a guaranteed hole in their defence, right now.
// The old `smashOutcome` scaling survives in engine/systems/combat.js because
// Intergalactic 0's BLASTER OF RA still uses it — that skill spends the same
// stock but hits a whole beam, so it keeps the throw-count curve.
export const SMASH_AP_COST       = 2;  // Action Points (also ends all remaining movement)
export const SMASH_DAMAGE        = 2;  // Vibe, undefendable
export const SMASH_SUSTAIN_STRIP = 2;  // notes torn off the rival's Sustain stack
export const SMASH_KNOCKBACK     = 2;  // hexes the rival is hurled
export const SMASH_SELF_SUSTAIN  = 1;  // notes it costs YOU off your own Sustain stack

// -- THRASH / SONIC ATTACK SPLIT --
// Thrash (melee) — d4-based, Vibe-focused, minimal push/FP.
// -- 🔊 GOES TO 11 (METALNESS_REWORK_DESIGN.md §4d) --
// It SETS the attack stat rather than adding to it, which is why it can be
// louder than ATK_BONUS_CAP without the special case the ability it replaced
// needed — and why calling it while ALREADY above 11 turns him DOWN. The amp
// only goes to 11. See engine/systems/eleven.js for the full argument.
export const ELEVEN_DRIVE = 11;

// ⚠️ TWO, NOT ONE, and the sum is in eleven.js because getting it wrong makes
// the cost silently free: ticked at the END of his own turn, a seed of 1 clears
// before he ever plays a turn without a rig. Two buys the full turn.
export const ELEVEN_AMP_BLOWN_TURNS = 2;

export const ATK_BONUS_CAP           = 5;   // hard ceiling on stacked attack bonuses (tempDrive + stance) -- keeps the accumulative wave in check
export const THRASH_DIE              = 4;   // base die for both attacker and defender in Thrash
export const THRASH_CEIL_DIE         = 6;   // ceiling charge upgrades d4 → d6
export const THRASH_DAMAGE_CAP       = 4;   // max Vibe damage from a single Thrash hit
export const THRASH_WHIFF_DMG        = 1;   // losing attacker only takes this much Vibe (humiliation tap)
export const THRASH_PUSH_THRESHOLD   = 1;   // margin needed before Thrash pushes 1 hex — any successful hit shoves the target
// Sonic (ranged) — keep-highest pool, FP/push focused, minimal Vibe damage.
export const SONIC_VIBE_CAP          = 2;   // max Vibe damage from a Sonic hit
export const SONIC_LIMELIGHT_FP      = 1;   // bonus FP when Sonic fires from main/pit ring
// Hexes crossed by the animated lightning bolt on the board art (measured from
// board_lightning_animated.png against the hex grid; #56 Limelight also under
// the bolt but stays excluded from the spawn pool).
export const LIGHTNING_TRACK_HEXES   = [28, 37, 47, 55, 57, 64, 65, 75];

// -- STYLE SYSTEM -- REMOVED.
// `STYLE_DB_CAP` capped the per-commit Style payout. The Style Db payout is gone
// (it re-scored gestures the Drive and Sustain boosts already pay for, and it was
// an aesthetic judge in a currency that now pays only for facts), so the cap has
// nothing to clamp. Style survives as character flavour in data/styles.js.

// -- DISSONANCE EDGE -- REMOVED (system cut — Theory learning streamlined).


// ─── PER-SPIRIT ABILITY TUNING ──────────────────────────────────────────────
// ⚠️ MOVED OUT OF THE MONOLITH 2026-08-16, and the reason is worth recording
// because it is the same reason twice over.
//
// These thirteen numbers are RULES — Db prices, ring radii, drain amounts,
// blindness durations — and they lived beside the JSX purely by accident of
// where the abilities were first written. That had two costs. `SKILL_TREE`
// interpolates every one of them into its skill descriptions, so the tree could
// not be extracted while they stayed here; and the engine could not read a Db
// price without the client handing it over. §7 has been asking for an
// innate-constants module since `PERF_CLIFF` landed in two policy files; this
// is that module's first tenant.
//
// 📌 They are grouped by the ability that owns them rather than sorted, so a
// retune reads as one block.

// 🔊 THE SONIC BEAM'S LENGTH — flat 3 for everyone since Sunbeam stopped being a
// range capstone. It is the LONGEST reach any attack in the game has, which is
// why it lives here rather than in one policy file: `legalActions` uses it to
// build the beam, and `evaluate` uses it as the distance past which a rival is a
// plan rather than a target. One number, two consumers, no transcription.
export const SONIC_BEAM_REACH = 3;

// ☀️ SUNBEAM — the whiteout.
export const SUNBEAM_DB_COST         = 2;    // Db charged per connecting attack
export const SUNBEAM_BLIND_TURNS     = 1;    // turns of whiteout on a clean proc
export const SUNBEAM_LINGER_CHANCE   = 0.5;  // odds the burn sears in for a 2nd turn
export const SUNBEAM_MAX_BLIND_TURNS = 2;    // hard ceiling — the sun always sets

// 🌀 SPACE IS DISPLACED — the paid blink. §2 of the Metalness rework cites this
// as the roster's only other free-ish movement, which is why its price matters
// to a doc two directories away.
export const DISPLACE_DB_COST   = 1;   // Db charged per warp
export const DISPLACE_MIN_RINGS = 2;   // nearest legal landing ring (1 = a normal step, so it's excluded)
export const DISPLACE_MAX_RINGS = 3;   // furthest legal landing ring

// 🕳️ GRAVITY CONTROL — the black hole vortex.
export const GRAVITY_DB_COST     = 1;  // Db charged per vortex
export const GRAVITY_PLACE_RINGS = 2;  // how far out he can drop it
export const GRAVITY_PULL_RINGS  = 2;  // rivals this close (or closer) get dragged
export const GRAVITY_PULL_HEXES  = 1;  // hexes each caught rival is dragged inward
export const GRAVITY_NOTE_DRAIN  = 2;  // notes cut from NEXT turn's refill for anyone dragged INTO it

// 💻 CODE INJECTION — the hidden commit.
export const CODE_INJECT_DB_COST = 1;  // Db burned at COMMIT, win or lose
