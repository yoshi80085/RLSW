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

// -- STACK CAPACITY IS EARNED (PENDING_CHANGES B0b) --
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

// -- AMP / DICE SYSTEM --
// ── NEW RIG SYSTEM (AMP_DECK_DESIGN.md) ──
// Every Spirit starts with a Main Amp at their corner: baseline 1d6, board-wide.
// Amp I–III add dice to the pool; Power I–III upgrade dice d6→d8 (gated behind
// matching Amp tier); Range I–III extend the radius where rig bonuses apply.
// Roll is keep-highest. Outside your Range you fall back to baseline 1d6.
export const SONIC_BASE_DIE     = 6;
export const SONIC_UPGRADED_DIE = 8;
export const SONIC_POOL_MAX     = 4;                    // 1 base + 3 amp tiers
export const RIG_RADIUS_BY_TIER = [4, 5, 7, Infinity];  // Range 0/I/II/III radii (axial hex distance)
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
export const EVENT_HEX_COUNT     = 1;  // one marquee hex live at a time
export const EVENT_RESPAWN_TURNS = 1;  // ROUNDS after a trigger before a new marquee lights up (was 3 spirit-turns)

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

