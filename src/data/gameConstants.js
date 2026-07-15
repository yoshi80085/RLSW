// Every 8 HC points -> player chooses one upgrade from up to 3 categories.
// Points carry over after crossing a threshold.
export const HC_UPGRADE_THRESHOLD = 8;

// Stock is a reservoir, not a fresh hand. Unused notes carry
// over; only this many spent slots recharge per turn.
export const STOCK_REFILL_RATE = 4;

// -- AMP / DICE SYSTEM --
// Dice tier is determined dynamically by how many amps the acting Spirit is
// within range of (<=4 hexes). Owning an amp upgrade places a physical amp token.
// 0 amps in range = d6, 1 = d8, 2 = d9, 3 = d12.
export const AMP_RANGE      = 4;             // hex distance at which a Spirit is "plugged in"
export const AMP_LINK_DIST  = 3;             // hex distance at which two amps daisy-chain to each other
export const AMP_DICE       = ['d6','d8','d9','d12']; // index = amps in the rig you're plugged into (0-3)
export const AMP_UPGRADE_MAX = 3;            // max amp upgrades (tokens) per spirit
export const CAMERA_ZOOM_MS  = 620;          // push-in tween length; impact rumble lands as it settles

// -- LIMELIGHT SYSTEM --
export const LIMELIGHT_HEX    = 56;   // centre stage hex
export const LIMELIGHT_TO_WIN = 3;    // (legacy -- instant Limelight win removed; kept for overlay refs)
export const LIMELIGHT_FAME   = 1;    // Fame paid (x crowd) for holding the centre Limelight a full turn
export const FAME_TO_WIN      = 25;   // Fame Points needed for a Fame Legend victory

// UNDERDOG comeback tuning -- see awardFame/underdogBonus.
export const UNDERDOG_MIN_DEFICIT    = 6;    // must be trailing the loser by at least this much Fame
export const UNDERDOG_DEFICIT_PER_STEP = 6;  // every 6 Fame of deficit adds +0.5 to the multiplier
export const UNDERDOG_MAX_MULT       = 2.5;  // hard ceiling on the comeback multiplier
export const TOKEN_MAX        = 6;    // max board mini-goal tokens on the board at once (all Lost Chords now)
export const TOKEN_BASE_POOL  = 10;   // target total tokens regardless of player count — fewer players → more starting tokens
export const TOKEN_PER_ROUND_BASE = 2; // tokens scattered per round with a full roster (scales up as players drop)

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
export const FAN_FLEE_MIN        = 7;     // casuals that scatter on a demolition (low end)
export const FAN_FLEE_MAX        = 10;    // (high end)
export const FAN_DEFECT_TO_VICTOR = 2;    // of the fled casuals, how many swing straight to the demolisher

// -- EVENT SPACES --
export const EVENT_HEX_COUNT     = 1;  // one marquee hex live at a time
export const EVENT_RESPAWN_TURNS = 3;  // turns after a trigger before a new marquee lights up

// -- FLAMING DISC / GROUPIE --
export const FLAMING_DISC_COUNT  = 6;
export const FLAMING_DISC_ROUNDS = 2;
export const GROUPIE_COOLDOWN    = 3; // own turns before a deployed groupie crew is ready again

// Hexes away from own amp before it auto-unplugs
export const AMP_UNPLUG_DIST = 3;

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
export const CHARGE_ZONE_COUNT       = 3;  // fixed lightning hexes on the board
export const CHARGE_ZONE_BOOST_TURNS = 2;  // charge duration (holder's turns) on pickup
export const CHARGE_ZONE_COOLDOWN    = 4;  // turns (any spirit's) before a drained zone relights
export const CHARGE_FLOOR_BONUS      = 2;  // floor charge: attack die results below 1+2 read as 3

// -- THRASH / SONIC ATTACK SPLIT --
// Thrash (melee) — d4-based, Vibe-focused, minimal push/FP.
export const ATK_BONUS_CAP           = 5;   // hard ceiling on stacked attack bonuses (tempDrive + Edge + stance) -- keeps the accumulative wave in check
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

// -- DISSONANCE EDGE -- (DESIGN_AUDIT_v2.md §9 v2 — replaces the Tension meter.
// Ending a track on a Discord (off-scale) note puts you ON THE EDGE: Drive up,
// Sustain down, paid for up front in HC + fans. Staying out costs more and buys
// more, but it's a hard 2-stage climb — miss the 3rd turn's resolution (landing
// on Root/3rd/5th) and the whole thing collapses: you lose the stance AND take
// a fan/Vibe hit for nothing. Landing the resolve instead refunds Sustain, plus
// a +1 temp Drive flourish and an HC payout scaled to how deep you were in.
// Every number here is stage-indexed: index 0 = inactive, 1 = first stage
// (round 1 on a Discord), 2 = max stage (round 2 — round 3 must resolve or fall).
export const EDGE_MAX_STAGE               = 2;      // stage cap — the 3rd unresolved turn forces a collapse, not stage 3
export const EDGE_DRIVE_BY_STAGE          = [0, 1, 2]; // temp Drive granted while riding, by stage
export const EDGE_SUSTAIN_PENALTY_BY_STAGE = [0, 1, 2]; // temp Sustain LOST while riding, by stage
export const EDGE_HC_COST_BY_STAGE        = [0, 1, 2]; // HC sacrificed to enter/escalate to this stage
export const EDGE_FAN_COST_BY_STAGE       = [0, 1, 1]; // casual fans sacrificed to enter/escalate to this stage
export const EDGE_RESOLVE_HC_BONUS_BY_STAGE = [0, 2, 4]; // HC payout for landing the resolve FROM this stage
export const EDGE_COLLAPSE_FAN_LOSS       = 2;      // casual fans who walk when the ride collapses unresolved
export const EDGE_COLLAPSE_VIBE           = 1;      // self-inflicted Vibe cost on collapse — the feedback squeal
