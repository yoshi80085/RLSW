// Every 8 Decibills -> player unlocks their targeted skill.
// Points carry over after crossing a threshold.
export const DB_UPGRADE_THRESHOLD = 8;

// Stock is a reservoir, not a fresh hand. Unused notes carry
// over; only this many spent slots recharge per turn.
export const STOCK_REFILL_RATE = 4;

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

export const CAMERA_ZOOM_MS  = 620;          // push-in tween length; impact rumble lands as it settles

// -- LIMELIGHT SYSTEM --
export const LIMELIGHT_HEX    = 56;   // centre stage hex
export const LIMELIGHT_TO_WIN = 3;    // (legacy -- instant Limelight win removed; kept for overlay refs)
export const LIMELIGHT_FAME   = 1;    // Fame paid (x crowd) for holding the centre Limelight a full turn
export const FAME_TO_WIN      = 25;   // Fame Points needed for a Fame Legend victory

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
export const TOKEN_DRIFT_TURNS   = 3; // uncollected Lost Chords relocate after this many spirit-turns

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
export const EVENT_RESPAWN_TURNS = 3;  // turns after a trigger before a new marquee lights up

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
export const CHARGE_ZONE_COOLDOWN    = 4;  // turns (any spirit's) before a drained zone relights
export const CHARGE_FLOOR_BONUS      = 2;  // floor charge: attack die results below 1+2 read as 3

// -- THRASH / SONIC ATTACK SPLIT --
// Thrash (melee) — d4-based, Vibe-focused, minimal push/FP.
export const ATK_BONUS_CAP           = 5;   // hard ceiling on stacked attack bonuses (tempDrive + stance) -- keeps the accumulative wave in check
export const THRASH_DIE              = 4;   // base die for both attacker and defender in Thrash
export const THRASH_CEIL_DIE         = 6;   // ceiling charge upgrades d4 → d6
export const THRASH_DAMAGE_CAP       = 4;   // max Vibe damage from a single Thrash hit
export const THRASH_WHIFF_DMG        = 1;   // losing attacker only takes this much Vibe (humiliation tap)
export const THRASH_PUSH_THRESHOLD   = 3;   // margin needed before Thrash pushes 1 hex
// Sonic (ranged) — keep-highest pool, FP/push focused, minimal Vibe damage.
export const SONIC_VIBE_CAP          = 2;   // max Vibe damage from a Sonic hit
export const SONIC_LIMELIGHT_FP      = 1;   // bonus FP when Sonic fires from main/pit ring
// Hexes crossed by the animated lightning bolt on the board art (measured from
// board_lightning_animated.png against the hex grid; #56 Limelight also under
// the bolt but stays excluded from the spawn pool).
export const LIGHTNING_TRACK_HEXES   = [28, 37, 47, 55, 57, 64, 65, 75];

// -- STANCE v2 ABILITY KITS --
// Commit generators (Trill / Chug / Dive Bomb) grant this many Db on trigger.
// Once per commit, on top of normal Db earnings. ⚠️ TUNABLE
export const STANCE_COMMIT_DB = 1;

// Bots only spend Db on stance specials when they have at least this many Db.
// Prevents bots from starving their own skill upgrades. ⚠️ TUNABLE
export const BOT_DB_SPEND_THRESHOLD = 3;

// -- DISSONANCE EDGE -- REMOVED (system cut — Theory learning streamlined).

